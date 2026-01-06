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

    resetBattleState() {
        this.turnPhase = 0;
        this.turnTimer = 0;
    }

    prepareTurn() {
        this.turnPhase = 'MOVE';
        this.turnTimer = 1.0; // Move for 1 second
    }

    executeTurn(dt, player) {
        if (!this.mesh || !player.mesh) return true; // End turn if something missing

        const playerPos = player.mesh.position;
        const dir = new THREE.Vector3().subVectors(playerPos, this.mesh.position).normalize();
        dir.y = 0;
        const dist = this.mesh.position.distanceTo(playerPos);

        switch (this.turnPhase) {
            case 'MOVE':
                // Move towards player
                this.mesh.lookAt(playerPos);
                if (dist > 3.0) {
                    this.mesh.position.add(dir.multiplyScalar(this.speed * dt));
                }
                this.turnTimer -= dt;
                if (this.turnTimer <= 0) {
                    this.turnPhase = 'ATTACK_WARN';
                    this.turnTimer = 0.5;
                }
                break;

            case 'ATTACK_WARN':
                // Flash Red
                this.mesh.material.color.setHex((Date.now() % 100 < 50) ? 0xff0000 : 0x882222);
                this.turnTimer -= dt;
                if (this.turnTimer <= 0) {
                    this.turnPhase = 'ATTACK_EXEC';
                    this.turnTimer = 0.5;
                    this.mesh.material.color.setHex(0xffffff); // Flash white
                }
                break;

            case 'ATTACK_EXEC':
                // Dash or Hit
                // Since player can't move, we guarantee a hit if close, or just projectile
                this.mesh.position.add(dir.multiplyScalar(this.speed * 4 * dt));
                
                // Hit check
                if (this.mesh.position.distanceTo(playerPos) < 2.0) {
                    // Deal damage
                    player.stats.hp -= 8; // Flat damage
                    // Visual feedback
                    const bounce = dir.clone().multiplyScalar(1.5);
                    player.mesh.position.add(bounce);
                    this.turnPhase = 'RETURN';
                    this.turnTimer = 0.5;
                }

                this.turnTimer -= dt;
                if (this.turnTimer <= 0) {
                    this.turnPhase = 'RETURN';
                    this.turnTimer = 0.5;
                }
                break;

            case 'RETURN':
                // Back off slightly
                this.mesh.position.sub(dir.multiplyScalar(this.speed * dt));
                this.mesh.material.color.setHex(0x882222);
                this.turnTimer -= dt;
                if (this.turnTimer <= 0) {
                    return true; // Turn Over
                }
                break;
        }

        return false;
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