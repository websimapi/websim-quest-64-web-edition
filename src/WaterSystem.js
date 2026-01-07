import * as THREE from 'three';

export class WaterSystem {
    constructor(scene) {
        this.scene = scene;
        this.waterLevel = 1.0; 
        this.time = 0;
        this.chunks = [];
        this.material = null;
    }

    create() {
        // Split water into smaller chunks for better depth sorting with NPCs
        const size = 2000;
        const tileSize = 200;
        const divisions = 20;
        
        const geometry = new THREE.PlaneGeometry(tileSize, tileSize, divisions, divisions);
        geometry.rotateX(-Math.PI / 2);

        this.material = new THREE.ShaderMaterial({
            uniforms: {
                uTime: { value: 0 },
                uBaseColor: { value: new THREE.Color(0x004488) }, // Deep Blue
                uShallowColor: { value: new THREE.Color(0x0088cc) }, // Cyan-ish
                uSunPosition: { value: new THREE.Vector3(100, 200, 100).normalize() },
                fogColor: { value: this.scene.fog.color },
                fogNear: { value: this.scene.fog.near },
                fogFar: { value: this.scene.fog.far }
            },
            vertexShader: `
                #include <fog_pars_vertex>
                
                uniform float uTime;
                varying float vHeight;
                varying vec3 vWorldPos;
                varying vec3 vNormal;
                varying vec3 vViewPosition;

                // Improved Wave Function
                vec3 calculateWave(vec3 p) {
                    float t = uTime * 0.6;
                    
                    // Mix of frequencies for more natural look
                    float y = 0.0;
                    y += sin(p.x * 0.05 + t) * 0.5;
                    y += cos(p.z * 0.03 + t * 0.8) * 0.5;
                    y += sin(p.x * 0.15 + p.z * 0.1 + t * 1.5) * 0.2;
                    y += cos(p.x * 0.2 - p.z * 0.15 + t * 2.0) * 0.1;
                    
                    // Sharp peaks, smooth troughs
                    y = y - 0.3; // Lower average level slightly
                    
                    return vec3(p.x, p.y + y, p.z);
                }

                // Analytical Normal (Approximation)
                vec3 calculateNormal(vec3 p) {
                    float d = 0.1;
                    vec3 p1 = calculateWave(p);
                    vec3 p2 = calculateWave(p + vec3(d, 0, 0));
                    vec3 p3 = calculateWave(p + vec3(0, 0, d));
                    
                    vec3 v1 = p2 - p1;
                    vec3 v2 = p3 - p1;
                    
                    return normalize(cross(v2, v1));
                }

                void main() {
                    vec3 pos = position;
                    vec4 worldPos = modelMatrix * vec4(pos, 1.0);
                    
                    vec3 displacedWorld = calculateWave(worldPos.xyz);
                    
                    vHeight = displacedWorld.y - worldPos.y;
                    vNormal = calculateNormal(worldPos.xyz);
                    vWorldPos = displacedWorld;
                    
                    vec4 mvPosition = viewMatrix * vec4(displacedWorld, 1.0);
                    gl_Position = projectionMatrix * mvPosition;
                    
                    vViewPosition = -mvPosition.xyz;
                    
                    #include <fog_vertex>
                }
            `,
            fragmentShader: `
                #include <fog_pars_fragment>
                
                uniform vec3 uBaseColor;
                uniform vec3 uShallowColor;
                uniform vec3 uSunPosition;
                
                varying float vHeight;
                varying vec3 vWorldPos;
                varying vec3 vNormal;
                varying vec3 vViewPosition;

                void main() {
                    // Base Color Mixing
                    float mixFactor = smoothstep(-1.0, 1.5, vHeight);
                    vec3 albedo = mix(uBaseColor, uShallowColor, mixFactor);
                    
                    vec3 viewDir = normalize(vViewPosition);
                    vec3 normal = normalize(vNormal);
                    vec3 sunDir = normalize(uSunPosition);
                    
                    // Specular (Sun reflection)
                    vec3 halfVector = normalize(sunDir + viewDir);
                    float NdotH = max(0.0, dot(normal, halfVector));
                    float specular = pow(NdotH, 100.0) * 1.5; // Sharp highlight
                    
                    // Fresnel (Sky reflection at angles)
                    float fresnel = pow(1.0 - max(0.0, dot(viewDir, normal)), 4.0);
                    vec3 skyColor = vec3(0.6, 0.8, 1.0);
                    
                    vec3 finalColor = mix(albedo, skyColor, fresnel * 0.6);
                    finalColor += vec3(1.0) * specular;
                    
                    // Foam tips
                    if (vHeight > 0.8) {
                        float foam = smoothstep(0.8, 1.2, vHeight);
                        finalColor = mix(finalColor, vec3(1.0), foam);
                    }

                    gl_FragColor = vec4(finalColor, 0.9);
                    
                    #include <fog_fragment>
                }
            `,
            transparent: true,
            fog: true,
            side: THREE.DoubleSide,
            depthWrite: false 
        });

        // Create tiled grid
        const range = size / 2;
        const step = tileSize;
        
        for (let x = -range; x < range; x += step) {
            for (let z = -range; z < range; z += step) {
                const mesh = new THREE.Mesh(geometry, this.material);
                // Center position
                mesh.position.set(x + step/2, this.waterLevel, z + step/2);
                
                // Important: Disable frustum culling or increase bounding box
                // because waves displace vertices outside the flat box
                mesh.frustumCulled = false; 
                
                this.scene.add(mesh);
                this.chunks.push(mesh);
            }
        }
    }

    update(dt) {
        this.time += dt;
        if (this.material) {
            this.material.uniforms.uTime.value = this.time;
        }
    }

    getHeightAt(x, z) {
        // Updated physics approx
        const t = this.time * 0.8;
        const wave1 = Math.sin(x * 0.05 + t);
        const wave2 = Math.cos(z * 0.04 + t * 0.8);
        const wave3 = Math.sin(x * 0.1 + z * 0.1 + t * 1.5) * 0.5;
        const y = (wave1 + wave2 + wave3) * 0.6;
        return this.waterLevel + y;
    }
}