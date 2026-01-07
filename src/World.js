import * as THREE from 'three';
import { Enemy } from './Enemy.js';

export class World {
    constructor(scene) {
        this.scene = scene;
        this.ground = null;
        this.size = 2000; // Massive world
        this.segments = 200; // Detailed enough for low poly
        this.enemies = [];
    }

    async loadAssets() {
        const loader = new THREE.TextureLoader();
        this.grassTexture = await loader.loadAsync('grass_texture.png');
        this.grassTexture.wrapS = THREE.RepeatWrapping;
        this.grassTexture.wrapT = THREE.RepeatWrapping;
        this.grassTexture.repeat.set(20, 20);
        this.grassTexture.magFilter = THREE.NearestFilter;
        this.grassTexture.minFilter = THREE.NearestFilter;
    }

    generate() {
        const geometry = new THREE.PlaneGeometry(this.size, this.size, this.segments, this.segments);
        
        // Vertex Colors Buffer
        const colors = [];
        const posAttribute = geometry.attributes.position;
        const count = posAttribute.count;

        for (let i = 0; i < count; i++) {
            const x = posAttribute.getX(i);
            const y = posAttribute.getY(i); // This becomes Z in world
            
            // Determine Biome and Height
            const h = this.getHeight(x, -y); // Note: plane Y is world -Z usually, but here we treat plane Y as Z for noise
            
            // Set Z (Up)
            posAttribute.setZ(i, h);

            // Color based on biome
            const biome = this.getBiome(x, -y);
            let color = new THREE.Color(0x55aa55); // Default Grass

            if (biome === 'FOREST') {
                color.setHex(0x228822);
                // Varies slightly
                color.r += Math.random() * 0.1; 
            } else if (biome === 'DESERT') {
                color.setHex(0xeecc66);
            } else if (biome === 'SNOW') {
                color.setHex(0xffffff);
                if (h < 5) color.setHex(0xddeeff); // Ice lowlands
            } else if (biome === 'BADLANDS') {
                color.setHex(0x553333); // Dark rock
                if (h < 2) color.setHex(0xaa4400); // Lava-ish ground
            } else {
                // Grasslands
                color.setHex(0x55aa55);
            }

            colors.push(color.r, color.g, color.b);
        }

        geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
        geometry.computeVertexNormals();
        geometry.rotateX(-Math.PI / 2); // Make it flat (Y up)

        // Use vertex colors. Remove texture map for biome clarity, or mix (Threejs doesn't mix easily without shaders).
        // Let's use vertex colors primarily, maybe blend with a detail texture if we had custom shader,
        // but for now standard material with vertex colors is good for low poly look.
        const material = new THREE.MeshStandardMaterial({ 
            vertexColors: true,
            roughness: 0.9,
            metalness: 0.1
            // map: this.grassTexture // Disabling texture to allow biome colors to pop
        });

        this.ground = new THREE.Mesh(geometry, material);
        this.ground.receiveShadow = true;
        this.scene.add(this.ground);

        this.generateTrees();
        this.generateEnemies();
        
        // Lighting
        const ambient = new THREE.AmbientLight(0xffffff, 0.6);
        this.scene.add(ambient);

        const sun = new THREE.DirectionalLight(0xffffff, 1.2);
        sun.position.set(100, 200, 100);
        sun.castShadow = true;
        // Expand shadow camera for larger world view
        sun.shadow.camera.left = -100;
        sun.shadow.camera.right = 100;
        sun.shadow.camera.top = 100;
        sun.shadow.camera.bottom = -100;
        sun.shadow.mapSize.width = 2048;
        sun.shadow.mapSize.height = 2048;
        this.scene.add(sun);
    }

    generateTrees() {
        const treeGeo = new THREE.ConeGeometry(1, 4, 4); 
        const treeMat = new THREE.MeshStandardMaterial({ color: 0x2e7d32, flatShading: true }); // Green
        const deadTreeMat = new THREE.MeshStandardMaterial({ color: 0x444444, flatShading: true }); // Dead
        const trunkGeo = new THREE.CylinderGeometry(0.3, 0.3, 1, 4);
        const trunkMat = new THREE.MeshStandardMaterial({ color: 0x5d4037 });
        
        // Cactus for desert
        const cactusGeo = new THREE.CylinderGeometry(0.4, 0.4, 3, 5);
        const cactusMat = new THREE.MeshStandardMaterial({ color: 0x669900 });

        // Rock for badlands/snow
        const rockGeo = new THREE.DodecahedronGeometry(1.5);
        const rockMat = new THREE.MeshStandardMaterial({ color: 0x777777 });

        const count = 800; // Lots of props for big world

        for(let i=0; i<count; i++) {
            const x = (Math.random() - 0.5) * this.size;
            const z = (Math.random() - 0.5) * this.size;
            
            const dist = Math.sqrt(x*x + z*z);
            if(dist < 30) continue; // Clear start

            const biome = this.getBiome(x, z);
            const y = this.getHeight(x, z);

            if (biome === 'DESERT') {
                if (Math.random() > 0.8) {
                    const cactus = new THREE.Mesh(cactusGeo, cactusMat);
                    cactus.position.set(x, y + 1.5, z);
                    cactus.castShadow = true;
                    this.scene.add(cactus);
                }
            } else if (biome === 'FOREST') {
                // Dense trees
                const tree = new THREE.Group();
                const trunk = new THREE.Mesh(trunkGeo, trunkMat);
                trunk.position.y = 0.5;
                trunk.castShadow = true;
                const leaves = new THREE.Mesh(treeGeo, treeMat);
                leaves.position.y = 2.5;
                leaves.castShadow = true;
                tree.add(trunk);
                tree.add(leaves);
                tree.position.set(x, y, z);
                const scale = 0.8 + Math.random() * 0.8;
                tree.scale.set(scale, scale, scale);
                this.scene.add(tree);
            } else if (biome === 'BADLANDS') {
                if (Math.random() > 0.7) {
                    const rock = new THREE.Mesh(rockGeo, rockMat);
                    rock.position.set(x, y + 0.5, z);
                    rock.castShadow = true;
                    rock.scale.setScalar(Math.random() * 1.5 + 0.5);
                    this.scene.add(rock);
                } else if (Math.random() > 0.9) {
                    // Dead tree
                    const tree = new THREE.Group();
                    const trunk = new THREE.Mesh(trunkGeo, trunkMat);
                    trunk.position.y = 0.5;
                    const leaves = new THREE.Mesh(treeGeo, deadTreeMat);
                    leaves.position.y = 2.5;
                    leaves.scale.set(0.5, 0.5, 0.5); // Withered
                    tree.add(trunk);
                    tree.add(leaves);
                    tree.position.set(x, y, z);
                    this.scene.add(tree);
                }
            } else if (biome === 'SNOW') {
                if (Math.random() > 0.8) {
                    // Snow covered rock
                    const rock = new THREE.Mesh(rockGeo, new THREE.MeshStandardMaterial({color: 0xeeeeee}));
                    rock.position.set(x, y + 0.5, z);
                    rock.scale.setScalar(Math.random() * 2 + 1);
                    this.scene.add(rock);
                }
            } else {
                // Grassland - Sparse trees
                if (Math.random() > 0.7) {
                    const tree = new THREE.Group();
                    const trunk = new THREE.Mesh(trunkGeo, trunkMat);
                    trunk.position.y = 0.5;
                    const leaves = new THREE.Mesh(treeGeo, treeMat);
                    leaves.position.y = 2.5;
                    tree.add(trunk);
                    tree.add(leaves);
                    tree.position.set(x, y, z);
                    this.scene.add(tree);
                }
            }
        }
    }

    generateEnemies() {
        const loader = new THREE.TextureLoader();
        loader.load('enemy_texture.png', (tex) => {
            tex.magFilter = THREE.NearestFilter;
            this.enemies.forEach(e => {
                if (e.type === 'GOBLIN') e.setTexture(tex);
            });
        });

        const count = 300; // Population explosion
        for(let i=0; i<count; i++) {
            const x = (Math.random() - 0.5) * this.size * 0.9; // Stay within bounds
            const z = (Math.random() - 0.5) * this.size * 0.9;
            
            const dist = Math.sqrt(x*x + z*z);
            if (dist < 40) continue; // Safe zone

            const biome = this.getBiome(x, z);
            
            // Calculate Level based on distance
            // 0-100: Lvl 1-5
            // 100-300: Lvl 5-15
            // 300-600: Lvl 15-30
            // 600+: Lvl 30-50
            const level = Math.max(1, Math.floor(dist / 25));

            let type = 'GOBLIN';

            if (biome === 'GRASSLAND') {
                if (Math.random() > 0.7) type = 'SLIME';
                else type = 'GOBLIN';
            } 
            else if (biome === 'FOREST') {
                if (Math.random() > 0.6) type = 'WOLF';
                else type = 'GOBLIN';
            }
            else if (biome === 'DESERT') {
                if (Math.random() > 0.6) type = 'SAND_SLIME';
                else type = 'GOLEM'; // Stone Golems roam desert too
            }
            else if (biome === 'SNOW') {
                if (Math.random() > 0.7) type = 'SNOW_WOLF';
                else if (Math.random() > 0.5) type = 'ICE_SPIRIT';
                else type = 'GOLEM'; // Frost golem (reusing GOLEM for now, maybe add var later)
            }
            else if (biome === 'BADLANDS') {
                if (Math.random() > 0.6) type = 'MAGMA_GOLEM';
                else type = 'SPIRIT'; // Fire spirit
            }

            const enemy = new Enemy(this.scene, x, z, type, level);
            // Height adjust
            enemy.mesh.position.y = this.getHeight(x, z) + enemy.yOffset;
            this.enemies.push(enemy);
        }
    }

    update(dt, playerPos) {
        // Remove dead enemies safely
        this.enemies = this.enemies.filter(e => e.mesh !== null);
        this.enemies.forEach(e => {
             if(e.mesh) e.update(dt, playerPos, this);
        });
    }

    getBiome(x, z) {
        const dist = Math.sqrt(x*x + z*z);
        if (dist < 150) return 'GRASSLAND';

        const angle = Math.atan2(z, x) / Math.PI; // -1 to 1

        // Map sectors
        // North-ish (z < 0) -> Forest
        // South-ish (z > 0) -> Desert
        // East-ish (x > 0) -> Snow
        // West-ish (x < 0) -> Badlands
        
        // Let's mix them based on angle
        if (angle >= -0.25 && angle <= 0.25) return 'SNOW'; // East
        if (angle > 0.25 && angle < 0.75) return 'DESERT'; // South
        if (angle >= 0.75 || angle <= -0.75) return 'BADLANDS'; // West
        return 'FOREST'; // North
    }

    getHeight(x, z) {
        const biome = this.getBiome(x, z);
        
        let h = 0;
        // Base Noise
        const noise1 = Math.sin(x * 0.02) * 5 + Math.cos(z * 0.02) * 5;
        
        if (biome === 'GRASSLAND') {
            h = noise1 * 0.5; // Gentle hills
        } else if (biome === 'FOREST') {
            h = noise1 * 1.5 + Math.sin(x*0.1)*2; // Hilly
        } else if (biome === 'DESERT') {
            h = Math.sin(x * 0.05 + z * 0.05) * 8; // Dunes
        } else if (biome === 'SNOW') {
            h = Math.abs(noise1) * 3 + Math.sin(x*0.05)*10; // Jagged
            if (h > 15) h += 10; // Peaks
        } else if (biome === 'BADLANDS') {
            h = Math.sin(x * 0.03) * 10 + Math.cos(z * 0.03) * 10;
            // Craters
            if (Math.sin(x*0.1) > 0.8) h -= 5;
        }
        
        return h;
    }
}