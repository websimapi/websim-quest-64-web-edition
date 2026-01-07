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
                uBaseColor: { value: new THREE.Color(0x005588) },
                uShallowColor: { value: new THREE.Color(0x44aaff) },
                uSunPosition: { value: new THREE.Vector3(100, 200, 100).normalize() }
            },
            vertexShader: `
                uniform float uTime;
                varying float vHeight;
                varying vec3 vWorldPos;
                varying vec3 vNormal;

                // Gerstner Wave approximation
                vec3 calculateWave(vec3 p) {
                    float t = uTime * 0.8;
                    
                    float wave1 = sin(p.x * 0.05 + t);
                    float wave2 = cos(p.z * 0.04 + t * 0.8);
                    float wave3 = sin(p.x * 0.1 + p.z * 0.1 + t * 1.5) * 0.5;
                    
                    float y = (wave1 + wave2 + wave3) * 0.6;
                    return vec3(p.x, p.y + y, p.z);
                }

                // Analytical Normal Calculation
                vec3 calculateNormal(vec3 p) {
                    float t = uTime * 0.8;
                    // Derivatives of the wave function above
                    // dy/dx
                    float dydx = (0.05 * cos(p.x * 0.05 + t) + 
                                  0.1 * 0.5 * cos(p.x * 0.1 + p.z * 0.1 + t * 1.5)) * 0.6;
                    // dy/dz
                    float dydz = (-0.04 * sin(p.z * 0.04 + t * 0.8) + 
                                  0.1 * 0.5 * cos(p.x * 0.1 + p.z * 0.1 + t * 1.5)) * 0.6;
                    
                    return normalize(vec3(-dydx, 1.0, -dydz));
                }

                void main() {
                    vec3 pos = position;
                    
                    // Apply offset based on world position (simulating world-space noise)
                    vec4 worldPos = modelMatrix * vec4(pos, 1.0);
                    
                    // Recalculate based on world coords so seams match
                    vec3 displacedWorld = calculateWave(worldPos.xyz);
                    
                    // Convert back to local for rendering logic if needed, but easier to just use world Y
                    vHeight = displacedWorld.y - worldPos.y; // Relative height
                    vNormal = calculateNormal(worldPos.xyz);
                    vWorldPos = displacedWorld;
                    
                    gl_Position = projectionMatrix * viewMatrix * vec4(displacedWorld, 1.0);
                }
            `,
            fragmentShader: `
                uniform vec3 uBaseColor;
                uniform vec3 uShallowColor;
                uniform vec3 uSunPosition;
                
                varying float vHeight;
                varying vec3 vWorldPos;
                varying vec3 vNormal;

                void main() {
                    // Mix Color
                    float heightFactor = smoothstep(-1.0, 1.0, vHeight);
                    vec3 albedo = mix(uBaseColor, uShallowColor, heightFactor);
                    
                    // Lighting
                    vec3 N = normalize(vNormal);
                    vec3 L = uSunPosition;
                    vec3 V = normalize(cameraPosition - vWorldPos);
                    
                    // Diffuse
                    float diff = max(dot(N, L), 0.0);
                    vec3 diffuse = albedo * (0.6 + 0.4 * diff);
                    
                    // Specular
                    vec3 H = normalize(L + V);
                    float spec = pow(max(dot(N, H), 0.0), 32.0);
                    vec3 specular = vec3(1.0) * spec * 0.5;
                    
                    // Fresnel (Fake reflection)
                    float fresnel = pow(1.0 - max(dot(N, V), 0.0), 3.0);
                    diffuse += vec3(0.5, 0.7, 0.9) * fresnel * 0.5;

                    // Foam at peaks
                    if (vHeight > 0.6) {
                        diffuse = mix(diffuse, vec3(1.0), (vHeight - 0.6) * 2.0);
                    }

                    gl_FragColor = vec4(diffuse + specular, 0.85);
                }
            `,
            transparent: true,
            side: THREE.DoubleSide,
            depthWrite: false // Keep false for transparency sorting, but relying on chunking for better sort
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