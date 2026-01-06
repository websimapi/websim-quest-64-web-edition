import * as THREE from 'three';

export class Enemy {
    constructor(scene, x, z) {
        this.scene = scene;
        this.hp = 30;
        this.maxHp = 30;
        this.speed = 3;
        this.state = 'ROAM'; // ROAM, CHASE, BATTLE
        
        this.roamOrigin = new THREE.Vector3(x, 0.7, z);
        this.roamRadius = 20;
        this.detectRadius = 15;
        this.roamTarget = this.roamOrigin.clone();
        this.waitTime = 0;

        const geo = new THREE.DodecahedronGeometry(0.7);
        const mat = new THREE.MeshStandardMaterial({ 
            map: null, // assigned later if texture loaded
            color: 0x882222, 
            flatShading: true 
        });
        this.mesh = new THREE.Mesh(geo, mat);
        this.mesh.castShadow = true;
        this.mesh.position.copy(this.roamOrigin);
        
        this.scene.add(this.mesh);
        
        // Add a simple shadow/highlight to show direction
        const eye = new THREE.Mesh(new THREE.BoxGeometry(0.3,0.1,0.2), new THREE.MeshBasicMaterial({color:0xffff00}));
        eye.position.set(0, 0.2, 0.5);
        this.mesh.add(eye);
    }

    setTexture(texture) {
        this.mesh.material.map = texture;
        this.mesh.material.needsUpdate = true;
    }

    update(dt, playerPos, world) {
        if (!this.mesh) return;

        if (this.state === 'BATTLE') {
            // Battle Logic now delegated to battleUpdate called by CombatSystem
            return;
        }

        // Check distance to player
        const distToPlayer = this.mesh.position.distanceTo(playerPos);
        
        if (distToPlayer < this.detectRadius) {
            this.state = 'CHASE';
        } else if (distToPlayer > this.detectRadius * 1.5) {
            this.state = 'ROAM';
        }

        if (this.state === 'CHASE') {
            const dir = new THREE.Vector3().subVectors(playerPos, this.mesh.position).normalize();
            dir.y = 0;
            this.mesh.position.add(dir.multiplyScalar(this.speed * dt));
            this.mesh.lookAt(playerPos);
        } else {
            // Roaming logic
            if (this.waitTime > 0) {
                this.waitTime -= dt;
            } else {
                const dist = this.mesh.position.distanceTo(this.roamTarget);
                if (dist < 1) {
                    // Pick new target
                    const angle = Math.random() * Math.PI * 2;
                    const r = Math.random() * this.roamRadius;
                    this.roamTarget.set(
                        this.roamOrigin.x + Math.cos(angle) * r,
                        this.mesh.position.y,
                        this.roamOrigin.z + Math.sin(angle) * r
                    );
                    this.waitTime = 1 + Math.random() * 2;
                } else {
                    const dir = new THREE.Vector3().subVectors(this.roamTarget, this.mesh.position).normalize();
                    this.mesh.position.add(dir.multiplyScalar((this.speed * 0.5) * dt));
                    this.mesh.lookAt(this.roamTarget);
                }
            }
        }

        // Terrain height
        if (world) {
            const h = world.getHeight(this.mesh.position.x, this.mesh.position.z);
            this.mesh.position.y = h + 0.7;
        }
    }

    takeDamage(amount) {
        this.hp -= amount;
        
        // Flash white
        const oldColor = this.mesh.material.color.getHex();
        this.mesh.material.color.setHex(0xffffff);
        setTimeout(() => {
            if(this.mesh) this.mesh.material.color.setHex(oldColor);
        }, 100);

        if (this.hp <= 0) {
            this.dispose();
            return true;
        }
        return false;
    }

    battleUpdate(dt, playerPos) {
        if (!this.mesh) return;
        
        // AI State Machine
        if (!this.aiState) {
            this.aiState = { state: 'CHASE', timer: 0 };
        }

        const dist = this.mesh.position.distanceTo(playerPos);
        const dir = new THREE.Vector3().subVectors(playerPos, this.mesh.position).normalize();
        dir.y = 0; // Keep horizontal

        switch (this.aiState.state) {
            case 'CHASE':
                if (dist < 5.0) {
                    this.aiState.state = 'TELEGRAPH';
                    this.aiState.timer = 1.0;
                } else {
                    this.mesh.position.add(dir.multiplyScalar(this.speed * dt));
                    this.mesh.lookAt(playerPos);
                }
                break;
            case 'TELEGRAPH':
                this.aiState.timer -= dt;
                this.mesh.lookAt(playerPos);
                // Flash warning
                this.mesh.material.color.setHex((Date.now() % 200 < 100) ? 0xff0000 : 0x882222);
                
                if (this.aiState.timer <= 0) {
                    this.aiState.state = 'ATTACK';
                    this.aiState.timer = 0.5; // Attack duration
                    this.mesh.material.color.setHex(0x882222);
                    // Store attack direction
                    this.aiState.attackDir = dir.clone();
                }
                break;
            case 'ATTACK':
                this.aiState.timer -= dt;
                // Dash forward
                this.mesh.position.add(this.aiState.attackDir.clone().multiplyScalar(this.speed * 4 * dt));
                
                if (this.aiState.timer <= 0) {
                    this.aiState.state = 'COOLDOWN';
                    this.aiState.timer = 2.0;
                }
                break;
            case 'COOLDOWN':
                this.aiState.timer -= dt;
                // Slow strafe or idle
                if (this.aiState.timer <= 0) {
                    this.aiState.state = 'CHASE';
                }
                break;
        }
    }

    dispose() {
        if (this.mesh) {
            this.scene.remove(this.mesh);
            if (this.mesh.geometry) this.mesh.geometry.dispose();
            if (this.mesh.material) this.mesh.material.dispose();
            this.mesh = null;
        }
    }
}