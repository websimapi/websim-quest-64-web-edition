import * as THREE from 'three';

export class WaterSystem {
    constructor(scene) {
        this.scene = scene;
        this.waterLevel = 1.0; 
        this.time = 0;
        this.mesh = null;
    }

    create() {
        const geometry = new THREE.PlaneGeometry(3000, 3000, 128, 128);
        geometry.rotateX(-Math.PI / 2);

        const material = new THREE.ShaderMaterial({
            uniforms: {
                uTime: { value: 0 },
                uBaseColor: { value: new THREE.Color(0x006994) }, // Deep blue
                uShallowColor: { value: new THREE.Color(0x00a8cc) }, // Light blue
            },
            vertexShader: `
                uniform float uTime;
                varying vec2 vUv;
                varying float vHeight;
                varying vec3 vWorldPos;

                // Simple 2D Noise
                float hash(vec2 p) { return fract(1e4 * sin(17.0 * p.x + p.y * 0.1) * (0.1 + abs(sin(p.y * 13.0 + p.x)))); }
                float noise(vec2 x) {
                    vec2 i = floor(x);
                    vec2 f = fract(x);
                    float a = hash(i);
                    float b = hash(i + vec2(1.0, 0.0));
                    float c = hash(i + vec2(0.0, 1.0));
                    float d = hash(i + vec2(1.0, 1.0));
                    vec2 u = f * f * (3.0 - 2.0 * f);
                    return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
                }

                void main() {
                    vUv = uv;
                    vec3 pos = position;
                    
                    // Tide (Global slow heave)
                    float tide = sin(uTime * 0.3) * 0.8; 

                    // Waves (Detail)
                    float w1 = sin(pos.x * 0.02 + uTime * 0.5);
                    float w2 = cos(pos.z * 0.03 + uTime * 0.4);
                    float n = noise(pos.xz * 0.05 + uTime * 0.2);
                    
                    float displacement = tide + (w1 + w2) * 0.4 + n * 0.3;
                    pos.y += displacement;
                    
                    vHeight = displacement;
                    
                    vec4 worldPosition = modelMatrix * vec4(pos, 1.0);
                    vWorldPos = worldPosition.xyz;
                    gl_Position = projectionMatrix * viewMatrix * worldPosition;
                }
            `,
            fragmentShader: `
                uniform vec3 uBaseColor;
                uniform vec3 uShallowColor;
                uniform float uTime;
                varying float vHeight;
                varying vec3 vWorldPos;

                void main() {
                    // Color based on wave height
                    float t = smoothstep(-1.0, 1.5, vHeight);
                    vec3 col = mix(uBaseColor, uShallowColor, t);
                    
                    // Highlights
                    float highlight = smoothstep(0.8, 1.2, vHeight + sin(vWorldPos.x * 0.5 + uTime) * 0.1);
                    col += vec3(0.3) * highlight;
                    
                    // Fake foam at crests
                    float foam = step(0.9, sin(vWorldPos.x + vWorldPos.z + uTime * 2.0) * 0.5 + 0.5);
                    col += vec3(0.2) * foam * smoothstep(0.5, 1.5, vHeight);

                    // Alpha (transparency)
                    gl_FragColor = vec4(col, 0.75);
                }
            `,
            transparent: true,
            side: THREE.DoubleSide,
            depthWrite: false
        });

        this.mesh = new THREE.Mesh(geometry, material);
        this.mesh.position.y = this.waterLevel;
        this.mesh.receiveShadow = true;
        this.scene.add(this.mesh);
    }

    update(dt) {
        this.time += dt;
        if (this.mesh) {
            this.mesh.material.uniforms.uTime.value = this.time;
        }
    }

    getHeightAt(x, z) {
        // Approximate the shader math for physics
        const tide = Math.sin(this.time * 0.3) * 0.8;
        const w1 = Math.sin(x * 0.02 + this.time * 0.5);
        const w2 = Math.cos(z * 0.03 + this.time * 0.4);
        return this.waterLevel + tide + (w1 + w2) * 0.4;
    }
}