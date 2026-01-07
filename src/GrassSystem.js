import * as THREE from 'three';

export class GrassSystem {
    constructor(scene, world) {
        this.scene = scene;
        this.world = world;
        this.chunkSize = 250; 
        this.grassMeshes = [];
        this.uniforms = {
            time: { value: 0 },
            playerPos: { value: new THREE.Vector3() }
        };
    }

    generate(grassTexture, player) {
        this.player = player; // Store reference
        
        // Geometry: Crossed Planes for volume
        // Manually build geometry to control UVs and structure
        const geometry = new THREE.BufferGeometry();
        const vertices = [];
        const uvs = [];
        const indices = [];
        
        // 2 planes, 90 deg offset
        const planes = 2;
        const width = 1.5;
        const height = 1.3;
        
        for(let i=0; i<planes; i++) {
            const angle = (Math.PI / 2) * i;
            // Define 4 corners relative to center bottom
            // We want pivot at Y=0
            const dx = (width/2) * Math.cos(angle);
            const dz = (width/2) * Math.sin(angle);
            
            // Quad vertices
            // 0: Bottom Left
            // 1: Bottom Right
            // 2: Top Left
            // 3: Top Right
            const baseIndex = vertices.length / 3;
            
            vertices.push(
                -dx, 0, -dz,  // BL
                 dx, 0,  dz,  // BR
                -dx, height, -dz, // TL
                 dx, height,  dz  // TR
            );
            
            uvs.push(
                0, 0,
                1, 0,
                0, 1,
                1, 1
            );
            
            indices.push(
                baseIndex, baseIndex+1, baseIndex+2,
                baseIndex+2, baseIndex+1, baseIndex+3
            );
        }

        geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
        geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
        geometry.setIndex(indices);
        geometry.computeVertexNormals();

        // Shared Geometry Bounding Sphere for Culling
        // Ensure it covers a chunk: Radius ~200 covers a 250x250 square diagonal from center
        geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(0,0,0), 250);

        // Material setup
        const material = new THREE.MeshStandardMaterial({
            map: grassTexture,
            color: 0x99cc99, // Slightly lighter green
            alphaTest: 0.4,
            side: THREE.DoubleSide,
            roughness: 1.0,
            metalness: 0.0
        });

        // SHADER INJECTION
        const onBeforeCompile = (shader) => {
            shader.uniforms.time = this.uniforms.time;
            shader.uniforms.playerPos = this.uniforms.playerPos;
            
            // Add noise function and varyings
            shader.vertexShader = `
                uniform float time;
                uniform vec3 playerPos;
                
                // Simplex Noise (Lightweight)
                vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
                vec2 mod289(vec2 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
                vec3 permute(vec3 x) { return mod289(((x*34.0)+1.0)*x); }
                float snoise(vec2 v) {
                    const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);
                    vec2 i  = floor(v + dot(v, C.yy) );
                    vec2 x0 = v - i + dot(i, C.xx);
                    vec2 i1;
                    i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
                    vec4 x12 = x0.xyxy + C.xxzz;
                    x12.xy -= i1;
                    i = mod289(i);
                    vec3 p = permute( permute( i.y + vec3(0.0, i1.y, 1.0 )) + i.x + vec3(0.0, i1.x, 1.0 ));
                    vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);
                    m = m*m ;
                    m = m*m ;
                    vec3 x = 2.0 * fract(p * C.www) - 1.0;
                    vec3 h = abs(x) - 0.5;
                    vec3 ox = floor(x + 0.5);
                    vec3 a0 = x - ox;
                    m *= 1.79284291400159 - 0.85373472095314 * ( a0*a0 + h*h );
                    vec3 g;
                    g.x  = a0.x  * x0.x  + h.x  * x0.y;
                    g.yz = a0.yz * x12.xz + h.yz * x12.yw;
                    return 130.0 * dot(m, g);
                }
                
                ${shader.vertexShader}
            `;

            // Inject logic into begin_vertex
            shader.vertexShader = shader.vertexShader.replace(
                '#include <begin_vertex>',
                `
                #include <begin_vertex>
                
                // --- CUSTOM GRASS LOGIC ---
                
                // 1. Get World Position of Instance Pivot
                // instanceMatrix attribute is available here
                vec4 instanceWorldPos = instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
                
                // 2. Wind Animation
                // Coherent noise based on world position
                float noiseVal = snoise(instanceWorldPos.xz * 0.02 + time * 0.5);
                
                // Simple sine wave wind
                float sway = sin(time * 1.5 + instanceWorldPos.x * 0.1 + instanceWorldPos.z * 0.1) * 0.3;
                sway += noiseVal * 0.2;
                
                // Apply based on height (stiffness)
                // transformed.y is local height (0 to 1.3)
                float stiff = smoothstep(0.0, 1.3, transformed.y);
                stiff = pow(stiff, 2.0); // Curve
                
                // Apply local wind (approximate)
                transformed.x += sway * stiff;
                
                // 3. Player Interaction (Bending)
                float dist = distance(instanceWorldPos.xyz, playerPos);
                float radius = 2.0;
                
                if (dist < radius) {
                    // Calculate push direction in World Space
                    vec3 pushDir = normalize(instanceWorldPos.xyz - playerPos);
                    pushDir.y = 0.0;
                    
                    // Transform push direction to Local Space (inverse rotation)
                    // Transpose of rotation matrix = inverse
                    vec3 localPush;
                    localPush.x = dot(pushDir, instanceMatrix[0].xyz);
                    localPush.y = dot(pushDir, instanceMatrix[1].xyz);
                    localPush.z = dot(pushDir, instanceMatrix[2].xyz);
                    
                    float strength = (1.0 - dist / radius);
                    transformed += localPush * strength * 1.5 * stiff;
                    
                    // Squish down slightly
                    transformed.y *= (0.3 + 0.7 * (dist/radius));
                }
                `
            );
        };

        material.onBeforeCompile = onBeforeCompile;
        
        // Depth material for shadow casting (if we want shadows to match sway)
        const depthMaterial = new THREE.MeshDepthMaterial({
            depthPacking: THREE.RGBADepthPacking,
            map: grassTexture,
            alphaTest: 0.4
        });
        depthMaterial.onBeforeCompile = onBeforeCompile;

        // Generate Chunks
        const worldHalf = 1000;
        const step = this.chunkSize;
        
        for (let x = -worldHalf; x < worldHalf; x += step) {
            for (let z = -worldHalf; z < worldHalf; z += step) {
                this.createChunk(x, z, step, geometry, material, depthMaterial);
            }
        }
    }

    createChunk(startX, startZ, size, geometry, material, depthMaterial) {
        const positions = [];
        const dummy = new THREE.Object3D();
        
        // Center of chunk
        const cx = startX + size/2;
        const cz = startZ + size/2;
        
        // Density: Grass per chunk
        const count = 300; 
        
        for(let i=0; i<count; i++) {
            // Random pos relative to center
            const ox = (Math.random() - 0.5) * size;
            const oz = (Math.random() - 0.5) * size;
            
            const wx = cx + ox;
            const wz = cz + oz;
            
            // Biome check
            const biome = this.world.getBiome(wx, wz);
            if (biome !== 'GRASSLAND' && biome !== 'FOREST') continue;
            
            const h = this.world.getHeight(wx, wz);
            if (h < 2.5) continue; // Avoid water edge
            
            // Slope check
            const slope = this.world.getSlopeFactor(wx, wz);
            if (slope > 0.8) continue;
            
            // Create Instance
            // Position relative to Chunk Center for InstancedMesh!
            // Mesh will be at (cx, 0, cz)
            // Instance pos should be (ox, h, oz)
            // Wait, chunk center Y is 0. So Y is just world H.
            
            dummy.position.set(ox, h, oz);
            dummy.rotation.set(0, Math.random() * Math.PI, 0);
            
            // Scale variation
            const s = 0.8 + Math.random() * 0.6;
            dummy.scale.set(s, s, s);
            
            dummy.updateMatrix();
            positions.push(dummy.matrix.clone());
        }
        
        if (positions.length === 0) return;
        
        const mesh = new THREE.InstancedMesh(geometry, material, positions.length);
        mesh.customDepthMaterial = depthMaterial;
        mesh.castShadow = false; // Disable self-shadows for performance/looks
        mesh.receiveShadow = true;
        
        for(let i=0; i<positions.length; i++) {
            mesh.setMatrixAt(i, positions[i]);
        }
        
        mesh.position.set(cx, 0, cz);
        mesh.updateMatrixWorld();
        
        this.scene.add(mesh);
        this.grassMeshes.push(mesh);
    }

    update(dt) {
        this.uniforms.time.value += dt;
        if (this.player && this.player.mesh) {
            this.uniforms.playerPos.value.copy(this.player.mesh.position);
        }
    }
}