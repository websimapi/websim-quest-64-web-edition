import * as THREE from 'three';
import { Enemy } from './Enemy.js';

export class World {
    constructor(scene) {
        this.scene = scene;
        this.ground = null;
        this.size = 600;
        this.segments = 128;
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
            
            // Perlin-ish noise (simple sine sum) - Expanded for larger world
            const z = Math.sin(x * 0.04) * 6 + Math.cos(y * 0.03) * 5 + Math.sin(x * 0.1 + y * 0.1) * 2;
            
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

        // More trees for larger world
        for(let i=0; i<150; i++) {
            const x = (Math.random() - 0.5) * this.size;
            const z = (Math.random() - 0.5) * this.size;
            if(Math.sqrt(x*x + z*z) < 25) continue; // Clear start area

            const y = this.getHeight(x, z);
            if (y < -2) continue; // Don't put trees in deep pits

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
        // Only goblins get the texture for now, others use colors
        loader.load('enemy_texture.png', (tex) => {
            tex.magFilter = THREE.NearestFilter;
            this.enemies.forEach(e => {
                if (e.type === 'GOBLIN') e.setTexture(tex);
            });
        });

        const count = 60;
        for(let i=0; i<count; i++) {
            const angle = Math.random() * Math.PI * 2;
            // Distribute across the larger world (avoiding spawn area < 30)
            const dist = 30 + Math.random() * 250; 
            const x = Math.cos(angle) * dist;
            const z = Math.sin(angle) * dist;
            
            let type = 'GOBLIN';
            if (dist > 80 && Math.random() > 0.6) type = 'SLIME';
            if (dist > 140 && Math.random() > 0.6) type = 'WOLF';
            if (dist > 180 && Math.random() > 0.5) type = 'GOLEM';
            if (dist > 220 && Math.random() > 0.5) type = 'SPIRIT';

            const enemy = new Enemy(this.scene, x, z, type);
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

    getHeight(x, z) {
        // Quick raycast-like height finder logic, replicating the generation math
        // In a real engine we'd use a raycaster, but for performance here we reuse the math function
        // Note: The mesh generation used x/y of the plane before rotation. 
        // Plane x -> World x, Plane y -> World -z
        const px = x;
        const py = -z;
        return Math.sin(px * 0.04) * 6 + Math.cos(py * 0.03) * 5 + Math.sin(px * 0.1 + py * 0.1) * 2;
    }
}