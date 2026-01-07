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
        const divisions = 64; // Higher detail for smoother waves
        
        const geometry = new THREE.PlaneGeometry(tileSize, tileSize, divisions, divisions);
        geometry.rotateX(-Math.PI / 2);

        this.material = new THREE.ShaderMaterial({
            uniforms: {
                uTime: { value: 0 },
                uBaseColor: { value: new THREE.Color(0x001e0f) }, // Deep Dark Teal
                uShallowColor: { value: new THREE.Color(0x40a4df) }, // Bright Light Blue
                uFoamColor: { value: new THREE.Color(0xffffff) },
                uSunPosition: { value: new THREE.Vector3(100, 200, 100).normalize() },
                uTideDirection: { value: new THREE.Vector2(1, 0) },
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

                uniform vec2 uTideDirection;

                // Gerstner Wave
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
                
                vec2 rotate(vec2 v, float a) {
                    float s = sin(a);
                    float c = cos(a);
                    return vec2(c * v.x - s * v.y, s * v.x + c * v.y);
                }

                vec3 getDisplacement(vec3 p) {
                    float dist = length(p.xz);
                    
                    // Ocean Factor: 0.0 near center (Inland), 1.0 far out (Ocean)
                    float oceanFactor = smoothstep(400.0, 900.0, dist);
                    
                    vec3 disp = vec3(0.0);
                    
                    // 1. Ocean Swell (Main Tide) - Only strong in ocean
                    // Use dynamic tide direction
                    disp += gerstnerWave(p, 0.35 * oceanFactor, 90.0, 0.8, uTideDirection);
                    
                    // 2. Crossing Ocean Chop
                    vec2 chopDir = rotate(uTideDirection, 0.7);
                    disp += gerstnerWave(p, 0.25 * oceanFactor, 45.0, 1.0, chopDir);
                    
                    // 3. Inland/Local Ripples (Always present but smaller)
                    // Chaotic direction for "pond" feel
                    vec2 rippleDir = normalize(vec2(sin(p.x * 0.05), cos(p.z * 0.05)));
                    float pondDamp = 1.0 - (oceanFactor * 0.5); // Slightly dampen in high seas to prevent noise
                    disp += gerstnerWave(p, 0.08 * pondDamp, 12.0, 1.5, rippleDir);
                    
                    // 4. Micro Detail
                    vec2 microDir = rotate(uTideDirection, -0.5);
                    disp += gerstnerWave(p, 0.03, 5.0, 2.5, microDir);
                    
                    return disp;
                }

                void main() {
                    vec3 gridPos = position;
                    vec4 worldPos = modelMatrix * vec4(gridPos, 1.0);
                    vUv = worldPos.xz;

                    vec3 p = worldPos.xyz;
                    
                    vec3 displacement = getDisplacement(p);
                    
                    vec3 finalPos = p + displacement;
                    vWaveHeight = finalPos.y - p.y;
                    
                    // Analytical Normal Approximation via Finite Difference
                    float delta = 0.5; 
                    vec3 pX = p + vec3(delta, 0.0, 0.0);
                    vec3 finalX = pX + getDisplacement(pX);
                    
                    vec3 pZ = p + vec3(0.0, 0.0, delta);
                    vec3 finalZ = pZ + getDisplacement(pZ);
                    
                    vec3 tangentX = finalX - finalPos;
                    vec3 tangentZ = finalZ - finalPos;
                    
                    vec3 tangentX = finalX - finalPos;
                    vec3 tangentZ = finalZ - finalPos; // order matters for cross product
                    // X cross Z is Up
                    vNormal = normalize(cross(tangentZ, tangentX));

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
                uniform float uTime;
                uniform sampler2D uHeightMap;
                uniform float uWorldSize;
                uniform float uWaterLevel;
                
                varying float vWaveHeight;
                varying vec3 vWorldPos;
                varying vec3 vNormal;
                varying vec3 vViewPosition;
                varying vec2 vUv;

                // Simple Hash Noise
                float hash(vec2 p) {
                    return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
                }
                
                float noise(vec2 p) {
                    vec2 i = floor(p);
                    vec2 f = fract(p);
                    f = f * f * (3.0 - 2.0 * f);
                    return mix(mix(hash(i + vec2(0.0, 0.0)), hash(i + vec2(1.0, 0.0)), f.x),
                               mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
                }

                float fbm(vec2 p) {
                    float v = 0.0;
                    float a = 0.5;
                    for (int i = 0; i < 3; i++) {
                        v += a * noise(p);
                        p *= 2.0;
                        a *= 0.5;
                    }
                    return v;
                }

                void main() {
                    // 1. Calculate Depth
                    vec2 texUv = (vWorldPos.xz / uWorldSize) + 0.5;
                    float terrainHeight = texture2D(uHeightMap, texUv).r;
                    
                    // Depth relative to flat water level, adjusted by wave
                    float waterDepth = uWaterLevel - terrainHeight; 
                    float visualDepth = vWorldPos.y - terrainHeight; 
                    
                    // Safety clamp
                    visualDepth = max(0.0, visualDepth);

                    // 2. Shoreline Simulation
                    // Run-up wave moves towards shore (assuming deep -> shallow)
                    float shoreTime = uTime * 0.8;
                    float shoreWave = sin(shoreTime + waterDepth * 1.5); 
                    
                    // Base foam at very shallow depth
                    float foamMask = smoothstep(0.4, 0.0, visualDepth);
                    
                    // Retreating bubbles: Show when shoreWave is "low" (receding)
                    float bubbleNoise = fbm(vWorldPos.xz * 2.0);
                    
                    float retreatFactor = smoothstep(0.2, -0.8, shoreWave); // Active in trough
                    float shallowArea = smoothstep(2.5, 0.0, waterDepth); // Only near shore
                    
                    float bubbles = retreatFactor * shallowArea * step(0.45, bubbleNoise);
                    foamMask += bubbles * 0.8;
                    
                    // Crest Foam
                    float crestFoam = smoothstep(0.8, 1.2, vWaveHeight - noise(vWorldPos.xz * 0.2) * 0.5);
                    foamMask += crestFoam;

                    foamMask = clamp(foamMask, 0.0, 1.0);

                    // 3. Color Mixing
                    float depthFactor = smoothstep(0.0, 12.0, visualDepth);
                    vec3 waterColor = mix(uShallowColor, uBaseColor, depthFactor);
                    
                    // 4. Lighting
                    vec3 viewDir = normalize(vViewPosition);
                    vec3 normal = normalize(vNormal);
                    
                    // Perturb normal with layered noise for surface detail
                    float n1 = noise(vWorldPos.xz * 0.5 + uTime * 0.5);
                    float n2 = noise(vWorldPos.xz * 1.0 - uTime * 0.8);
                    normal.x += (n1 - 0.5) * 0.2;
                    normal.z += (n2 - 0.5) * 0.2;
                    normal = normalize(normal);

                    vec3 sunDir = normalize(uSunPosition);
                    
                    // Specular
                    vec3 halfVector = normalize(sunDir + viewDir);
                    float NdotH = max(0.0, dot(normal, halfVector));
                    float specular = pow(NdotH, 120.0) * 1.5; 
                    
                    // Fresnel
                    float fresnel = pow(1.0 - max(0.0, dot(viewDir, normal)), 4.0);
                    fresnel = clamp(fresnel, 0.0, 1.0);
                    
                    vec3 skyColor = vec3(0.6, 0.8, 0.95);
                    vec3 finalColor = mix(waterColor, skyColor, fresnel * 0.5);
                    
                    finalColor += specular;
                    finalColor = mix(finalColor, uFoamColor, foamMask * 0.9);

                    // 5. Opacity
                    float opacity = mix(0.5, 0.98, depthFactor);
                    opacity = mix(opacity, 1.0, foamMask); 

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
            
            // Rotate tide slowly
            const tideSpeed = 0.05; // Slow shift
            const tideAngle = this.time * tideSpeed;
            this.material.uniforms.uTideDirection.value.set(Math.cos(tideAngle), Math.sin(tideAngle));
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
        // Approximate physics height
        const dist = Math.sqrt(x*x + z*z);
        const oceanFactor = Math.min(1.0, Math.max(0.0, (dist - 400) / 500));
        
        // Large Swell (Ocean only)
        let y = 0;
        if (oceanFactor > 0.1) {
             const t = this.time * 0.8;
             // Tide dir approx
             const tideAngle = t * 0.05; // Matches update
             const tx = Math.cos(tideAngle);
             const tz = Math.sin(tideAngle);
             
             const k = 2.0 * Math.PI / 90.0;
             const phase = k * ((x * tx + z * tz) - 8.0 * t); // Speed approx
             y += oceanFactor * 2.0 * Math.sin(phase);
        }
        
        // Inland Ripple
        y += 0.2 * Math.sin(x * 0.5 + this.time) * Math.cos(z * 0.5 + this.time);
        
        return this.waterLevel + y;
    }
}