import * as THREE from 'three';
import { Enemy } from './Enemy.js';

export class World {
    constructor(scene) {
        this.scene = scene;
        this.ground = null;
        this.size = 200;
        this.segments = 64;
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
        
        // Simple heightmap generation
        const posAttribute = geometry.attributes.position;
        for (let i = 0; i < posAttribute.count; i++) {
            const x = posAttribute.getX(i);
            const y = posAttribute.getY(i);
            
            // Perlin-ish noise (simple sine sum)
            const z = Math.sin(x * 0.1) * 2 + Math.cos(y * 0.1) * 2 + Math.sin(x * 0.3 + y * 0.3) * 1;
            
            // Update Z (which is Y in world space after rotation)
            posAttribute.setZ(i, z);
        }

        geometry.computeVertexNormals();
        geometry.rotateX(-Math.PI / 2); // Make it flat

        const material = new THREE.MeshStandardMaterial({ 
            map: this.grassTexture,
            roughness: 1,
            metalness: 0
        });

        this.ground = new THREE.Mesh(geometry, material);
        this.ground.receiveShadow = true;
        this.scene.add(this.ground);

        // Add some trees
        this.generateTrees();
        this.generateEnemies();
        
        // Lights
        const ambient = new THREE.AmbientLight(0xffffff, 0.6);
        this.scene.add(ambient);

        const sun = new THREE.DirectionalLight(0xffffff, 1);
        sun.position.set(50, 100, 50);
        sun.castShadow = true;
        sun.shadow.camera.left = -50;
        sun.shadow.camera.right = 50;
        sun.shadow.camera.top = 50;
        sun.shadow.camera.bottom = -50;
        this.scene.add(sun);
    }

    generateTrees() {
        const treeGeo = new THREE.ConeGeometry(1, 4, 4); 
        const treeMat = new THREE.MeshStandardMaterial({ color: 0x2e7d32, flatShading: true });
        const trunkGeo = new THREE.CylinderGeometry(0.3, 0.3, 1, 4);
        const trunkMat = new THREE.MeshStandardMaterial({ color: 0x5d4037 });

        for(let i=0; i<40; i++) {
            const x = (Math.random() - 0.5) * 150;
            const z = (Math.random() - 0.5) * 150;
            if(Math.sqrt(x*x + z*z) < 15) continue; // Clear start area

            const y = this.getHeight(x, z);
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
            const scale = 0.8 + Math.random() * 0.5;
            tree.scale.set(scale, scale, scale);
            this.scene.add(tree);
        }
    }

    generateEnemies() {
        const loader = new THREE.TextureLoader();
        loader.load('enemy_texture.png', (tex) => {
            tex.magFilter = THREE.NearestFilter;
            this.enemies.forEach(e => e.setTexture(tex));
        });

        for(let i=0; i<10; i++) {
            const angle = Math.random() * Math.PI * 2;
            const dist = 20 + Math.random() * 60;
            const x = Math.cos(angle) * dist;
            const z = Math.sin(angle) * dist;
            
            const enemy = new Enemy(this.scene, x, z);
            // Height adjust
            enemy.mesh.position.y = this.getHeight(x, z) + 0.7;
            this.enemies.push(enemy);
        }
    }

    update(dt, playerPos) {
        this.enemies.forEach(e => e.update(dt, playerPos, this));
    }

    getHeight(x, z) {
        // Quick raycast-like height finder logic, replicating the generation math
        // In a real engine we'd use a raycaster, but for performance here we reuse the math function
        // Note: The mesh generation used x/y of the plane before rotation. 
        // Plane x -> World x, Plane y -> World -z
        const px = x;
        const py = -z;
        return Math.sin(px * 0.1) * 2 + Math.cos(py * 0.1) * 2 + Math.sin(px * 0.3 + py * 0.3) * 1;
    }
}