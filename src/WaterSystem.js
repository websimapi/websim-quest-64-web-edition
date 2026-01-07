import * as THREE from 'three';

export class WaterSystem {
    constructor(scene, world) {
        this.scene = scene;
        this.world = world;
        this.waterLevel = 1.0; 
        this.time = 0;
        this.chunks = [];
        this.material = null;
        this.bubbles = null;
        this.heightMap = null;
    }

    create() {
        // 1. Generate Heightmap Texture for depth effects
        this.generateHeightMap();

        const size = 2000;
        const tileSize = 200;
        const divisions = 32; // Higher detail for waves
        
        const geometry = new THREE.PlaneGeometry(tileSize, tileSize, divisions, divisions);
        geometry.rotateX(-Math.PI / 2);

        this.material = new THREE.ShaderMaterial({
            uniforms: {
                uTime: { value: 0 },
                uBaseColor: { value: new THREE.Color(0x001e0f) }, // Deep Dark Teal
                uShallowColor: { value: new THREE.Color(0x40a4df) }, // Bright Light Blue
                uFoamColor: { value: new THREE.Color(0xffffff) },
                uSunPosition: { value: new THREE.Vector3(100, 200, 100).normalize() },
                uHeightMap: { value: this.heightMap },
                uWorldSize: { value: size },
                uWaterLevel: { value: this.waterLevel },
                fogColor: { value: this.scene.fog.color },
                fogNear: { value: this.scene.fog.near },
                fogFar: { value: this.scene.fog.far }
            },
            vertexShader: `
                #include <fog_pars_vertex>
                
                uniform float uTime;
                varying float vWaveHeight;
                varying vec3 vWorldPos;
                varying vec3 vNormal;
                varying vec3 vViewPosition;
                varying vec2 vUv;

                // Gerstner Wave approximation
                vec3 gerstnerWave(vec3 p, float steepness, float wavelength, float speed, vec2 dir) {
                    float k = 2.0 * 3.14159 / wavelength;
                    float c = sqrt(9.8 / k);
                    float f = k * (dot(dir, p.xz) - c * speed * uTime);
                    float a = steepness / k;
                    
                    return vec3(
                        dir.x * (a * cos(f)),
                        a * sin(f),
                        dir.y * (a * cos(f))
                    );
                }

                void main() {
                    vec3 gridPos = position;
                    vec4 worldPos = modelMatrix * vec4(gridPos, 1.0);
                    vUv = worldPos.xz;

                    vec3 p = worldPos.xyz;
                    
                    // Sum of waves
                    vec3 displacement = vec3(0.0);
                    displacement += gerstnerWave(p, 0.2, 15.0, 0.5, vec2(1.0, 0.5));
                    displacement += gerstnerWave(p, 0.15, 7.0, 0.8, vec2(0.7, 0.7));
                    displacement += gerstnerWave(p, 0.1, 3.0, 1.2, vec2(-0.2, 1.0));
                    
                    vec3 finalPos = p + displacement;
                    vWaveHeight = finalPos.y - p.y;
                    
                    // Calc Normal (Analytical is better but standard finite diff is cheaper here)
                    vec3 pA = finalPos;
                    vec3 pB = p + vec3(0.1, 0.0, 0.0) + gerstnerWave(p + vec3(0.1, 0.0, 0.0), 0.2, 15.0, 0.5, vec2(1.0, 0.5)); // simplistic normal approx
                    vec3 tangent = normalize(vec3(1.0, (pB.y - pA.y)*10.0, 0.0));
                    vec3 binormal = vec3(0.0, 0.0, 1.0);
                    vNormal = normalize(cross(binormal, tangent)); 
                    // (Actually let's just use up vector perturbed by wave height for cheap look)
                    vNormal = normalize(vec3(-displacement.x * 0.5, 1.0, -displacement.z * 0.5));

                    vWorldPos = finalPos;
                    
                    vec4 mvPosition = viewMatrix * vec4(finalPos, 1.0);
                    gl_Position = projectionMatrix * mvPosition;
                    
                    vViewPosition = -mvPosition.xyz;
                    
                    #include <fog_vertex>
                }
            `,
            fragmentShader: `
                #include <fog_pars_fragment>
                
                uniform vec3 uBaseColor;
                uniform vec3 uShallowColor;
                uniform vec3 uFoamColor;
                uniform vec3 uSunPosition;
                uniform sampler2D uHeightMap;
                uniform float uWorldSize;
                uniform float uWaterLevel;
                
                varying float vWaveHeight;
                varying vec3 vWorldPos;
                varying vec3 vNormal;
                varying vec3 vViewPosition;
                varying vec2 vUv;

                void main() {
                    // 1. Calculate Depth
                    vec2 texUv = (vWorldPos.xz / uWorldSize) + 0.5;
                    float terrainHeight = texture2D(uHeightMap, texUv).r;
                    
                    // Depth relative to flat water level, adjusted by wave
                    float currentWaterY = vWorldPos.y; // includes wave
                    float waterDepth = uWaterLevel - terrainHeight; // Average depth
                    float visualDepth = currentWaterY - terrainHeight; // Exact at this pixel
                    
                    // Safety clamp
                    visualDepth = max(0.0, visualDepth);

                    // 2. Shoreline Foam
                    // If visual depth is small, we are near shore
                    float foamMask = smoothstep(0.8, 0.0, visualDepth);
                    
                    // Add some wave-based foam modulation
                    float waveFoam = smoothstep(0.3, 0.6, vWaveHeight + sin(vWorldPos.x * 0.5 + vWorldPos.z * 0.5) * 0.2);
                    foamMask = max(foamMask, waveFoam * 0.5); // Foam on crests

                    // 3. Color Mixing
                    // Shallow = Light Blue, Deep = Dark
                    float depthFactor = smoothstep(0.0, 8.0, visualDepth);
                    vec3 waterColor = mix(uShallowColor, uBaseColor, depthFactor);
                    
                    // 4. Lighting
                    vec3 viewDir = normalize(vViewPosition);
                    vec3 normal = normalize(vNormal);
                    vec3 sunDir = normalize(uSunPosition);
                    
                    // Specular
                    vec3 halfVector = normalize(sunDir + viewDir);
                    float NdotH = max(0.0, dot(normal, halfVector));
                    float specular = pow(NdotH, 80.0) * 1.0; 
                    
                    // Fresnel (Reflectivity)
                    float fresnel = pow(1.0 - max(0.0, dot(viewDir, normal)), 3.0);
                    fresnel = clamp(fresnel, 0.0, 1.0);
                    
                    vec3 skyColor = vec3(0.7, 0.9, 1.0);
                    vec3 finalColor = mix(waterColor, skyColor, fresnel * 0.4);
                    
                    finalColor += specular;
                    finalColor = mix(finalColor, uFoamColor, foamMask * 0.8); // Apply foam

                    // 5. Opacity / Transparency
                    // Deep water is more opaque, shallow is clear
                    float opacity = mix(0.4, 0.95, depthFactor);
                    opacity = mix(opacity, 1.0, foamMask); // Foam is opaque

                    gl_FragColor = vec4(finalColor, opacity);
                    
                    #include <fog_fragment>
                }
            `,
            transparent: true,
            fog: true,
            side: THREE.DoubleSide,
            depthWrite: false, // Important for seeing things behind
            blending: THREE.NormalBlending
        });

        // Create Grid
        const range = size / 2;
        const step = tileSize;
        
        for (let x = -range; x < range; x += step) {
            for (let z = -range; z < range; z += step) {
                const mesh = new THREE.Mesh(geometry, this.material);
                mesh.position.set(x + step/2, this.waterLevel, z + step/2);
                mesh.frustumCulled = false; 
                this.scene.add(mesh);
                this.chunks.push(mesh);
            }
        }

        // Add Bubbles System
        this.createBubbles();
    }

    generateHeightMap() {
        if (!this.world) return;
        
        const size = 256;
        const data = new Float32Array(size * size);
        
        const worldBounds = 2000;
        const halfBounds = worldBounds / 2;
        
        for (let y = 0; y < size; y++) {
            for (let x = 0; x < size; x++) {
                // Map texture UV to World XZ
                const wx = (x / size) * worldBounds - halfBounds;
                const wz = (y / size) * worldBounds - halfBounds;
                
                // Get Height (expensive call, but 256x256 is 65k calls, manageable)
                const h = this.world.getHeight(wx, wz);
                
                // Store in Red channel
                data[y * size + x] = h;
            }
        }
        
        const texture = new THREE.DataTexture(data, size, size, THREE.RedFormat, THREE.FloatType);
        texture.magFilter = THREE.LinearFilter;
        texture.minFilter = THREE.LinearFilter;
        texture.needsUpdate = true;
        
        this.heightMap = texture;
    }

    createBubbles() {
        const particleCount = 200;
        const geo = new THREE.BufferGeometry();
        const pos = new Float32Array(particleCount * 3);
        const speeds = new Float32Array(particleCount);
        
        for(let i=0; i<particleCount; i++) {
            this.resetBubble(pos, i, true);
            speeds[i] = 0.5 + Math.random() * 1.5;
        }
        
        geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        geo.setAttribute('speed', new THREE.BufferAttribute(speeds, 1));
        
        const mat = new THREE.PointsMaterial({
            color: 0xffffff,
            size: 0.3,
            transparent: true,
            opacity: 0.6,
            map: this.createBubbleTexture(),
            depthWrite: false,
            blending: THREE.AdditiveBlending
        });
        
        this.bubbles = new THREE.Points(geo, mat);
        this.scene.add(this.bubbles);
    }
    
    createBubbleTexture() {
        const cvs = document.createElement('canvas');
        cvs.width = 32; cvs.height = 32;
        const ctx = cvs.getContext('2d');
        ctx.beginPath();
        ctx.arc(16, 16, 14, 0, Math.PI*2);
        ctx.fillStyle = 'rgba(255,255,255,0.8)';
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = 'rgba(255,255,255,0.4)';
        ctx.stroke();
        
        // Highlight
        ctx.beginPath();
        ctx.arc(10, 10, 4, 0, Math.PI*2);
        ctx.fillStyle = 'white';
        ctx.fill();
        
        const tex = new THREE.CanvasTexture(cvs);
        return tex;
    }

    resetBubble(posArray, i, initial = false) {
        // Random position in world that is underwater
        // We'll try a few times to find a water spot
        let valid = false;
        let x, y, z;
        
        let attempts = 0;
        while(!valid && attempts < 5) {
            x = (Math.random() - 0.5) * 400; // Constrain bubbles to center area mainly
            z = (Math.random() - 0.5) * 400;
            const h = this.world ? this.world.getHeight(x, z) : -10;
            
            if (h < this.waterLevel - 1.0) { // Valid water depth
                const depth = this.waterLevel - h;
                y = h + Math.random() * depth;
                valid = true;
            }
            attempts++;
        }
        
        if (!valid) {
             // Fallback
             x = 0; z = 0; y = -100; // Hide
        }

        posArray[i*3] = x;
        posArray[i*3+1] = y;
        posArray[i*3+2] = z;
    }

    update(dt) {
        this.time += dt;
        if (this.material) {
            this.material.uniforms.uTime.value = this.time;
        }
        
        // Update Bubbles
        if (this.bubbles && this.world) {
            const positions = this.bubbles.geometry.attributes.position.array;
            const speeds = this.bubbles.geometry.attributes.speed.array;
            
            for(let i=0; i<speeds.length; i++) {
                // Move up
                positions[i*3+1] += speeds[i] * dt;
                
                // Wiggle
                positions[i*3] += Math.sin(this.time + i) * dt * 0.5;
                
                // Check surface
                if (positions[i*3+1] > this.waterLevel) {
                    this.resetBubble(positions, i);
                }
            }
            this.bubbles.geometry.attributes.position.needsUpdate = true;
        }
    }

    getHeightAt(x, z) {
        const t = this.time * 0.5;
        // Match approximate wave shape from shader for physics
        const y = Math.sin(x * 0.2 + t) * 0.15 + Math.cos(z * 0.15 + t*0.8) * 0.15;
        return this.waterLevel + y;
    }
}