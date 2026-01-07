import * as THREE from 'three';
import { EnemyFactory } from './EnemyFactory.js';

export class Enemy {
    constructor(scene, x, z, type = 'GOBLIN', level = 1) {
        this.scene = scene;
        this.type = type;
        this.level = level;
        this.state = 'ROAM';

        // Load Configuration using Factory
        const def = EnemyFactory.getDefinition(type);
        
        // Apply Stats
        this.baseHp = def.baseHp;
        this.speed = def.speed;
        this.detectRadius = def.detectRadius;
        this.yOffset = def.yOffset;
        this.baseDamage = def.baseDamage;
        this.isAquatic = def.isAquatic || false;
        this.element = def.element;
        this.baseColor = def.color;
        this.animStyle = def.animStyle;

        // Apply Level Scaling
        const scale = 1 + ((level - 1) * 0.2); 
        this.maxHp = Math.floor(this.baseHp * scale);
        this.hp = this.maxHp;
        this.damage = Math.floor(this.baseDamage * scale);
        this.xpValue = Math.floor((def.baseXp || 10) * (1 + (level - 1) * 0.5));

        // Create Mesh using Factory
        this.mesh = EnemyFactory.createMesh(type, def, level);
        
        this.roamOrigin = new THREE.Vector3(x, this.yOffset, z);
        this.lastPosition = this.roamOrigin.clone();
        this.roamRadius = 20;
        this.roamTarget = this.roamOrigin.clone();
        this.waitTime = 0;

        this.mesh.position.copy(this.roamOrigin);
        this.scene.add(this.mesh);
        
        // removed massive switch statement and geometry construction logic
    }

    setTexture(texture) {
        this.mesh.material.map = texture;
        this.mesh.material.needsUpdate = true;
    }

    update(dt, playerPos, world) {
        if (!this.mesh) return;
        
        // Update stored position before we move
        this.lastPosition.copy(this.mesh.position);

        // Ensure Y is correct
        if (world) {
            let targetY = 0;
            const h = world.getHeight(this.mesh.position.x, this.mesh.position.z);
            
            if (this.isAquatic) {
                const waterLevel = 1.0;
                targetY = Math.max(h, waterLevel) + this.yOffset;
                
                // If terrain is above water, slide up to terrain
                if (h > waterLevel) targetY = h + 0.5; 
            } else {
                targetY = h + this.yOffset;
            }

            if (this.type === 'SPIRIT' || this.type === 'ICE_SPIRIT') {
                 // Flying units bob
                 this.mesh.position.y = targetY + Math.sin(Date.now() * 0.003) * 0.5;
            } else {
                 this.mesh.position.y = THREE.MathUtils.lerp(this.mesh.position.y, targetY, dt * 10);
            }
        }

        // Animate visuals
        this.animate(dt, this.state === 'CHASE' || (this.waitTime <= 0 && this.state === 'ROAM'));

        if (this.state === 'BATTLE') {
            return;
        }

        // Check distance to player
        const distToPlayer = this.mesh.position.distanceTo(playerPos);
        
        if (distToPlayer < this.detectRadius) {
            this.state = 'CHASE';
        } else if (distToPlayer > this.detectRadius * 1.5) {
            this.state = 'ROAM';
        }

        let isMoving = false;

        if (this.state === 'CHASE') {
            const dir = new THREE.Vector3().subVectors(playerPos, this.mesh.position).normalize();
            dir.y = 0;
            this.mesh.position.add(dir.multiplyScalar(this.speed * dt));
            this.mesh.lookAt(playerPos);
            isMoving = true;
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
                    isMoving = true;
                }
            }
        }
    }

    animate(dt, isMoving) {
        const t = Date.now() * 0.001;
        
        // Animation Logic based on animStyle
        if (this.animStyle === 'SQUASH') {
            const freq = isMoving ? 15 : 5;
            const amp = isMoving ? 0.2 : 0.05;
            const s = 1.0 + Math.sin(t * freq) * amp;
            // Note: This overwrites specific scale from factory, but squash/stretch implies 
            // the whole body deforms. If we wanted to keep size scaling we'd need to store base scale.
            // For now, assuming relative scale of 1.0 for animation factor.
            const sizeScale = this.mesh.scale.x; // approximate current scale
            // Ideally we should store baseScale in constructor if we want to mix them perfectly
        }
        else if (this.animStyle === 'HOP') {
            if (isMoving) {
                const hop = Math.abs(Math.sin(t * 12));
                this.mesh.rotation.z = Math.sin(t * 12) * 0.1;
                this.mesh.position.y += hop * 0.2;
            } else {
                this.mesh.rotation.z = THREE.MathUtils.lerp(this.mesh.rotation.z, 0, dt * 5);
                this.mesh.scale.y = 1.0 + Math.sin(t * 3) * 0.02; // Breathe
            }
        }
        else if (this.animStyle === 'HEAVY') {
            if (isMoving) {
                this.mesh.rotation.z = Math.sin(t * 5) * 0.1;
                this.mesh.rotation.x = Math.abs(Math.cos(t * 5)) * 0.1;
            }
        }
        else if (this.animStyle === 'SWIM') {
            this.mesh.position.y += Math.sin(t * 3) * 0.1;
            this.mesh.rotation.z = Math.sin(t * 5) * 0.2;
            this.mesh.rotation.y += Math.sin(t * 2) * 0.01;
        }
        else if (this.animStyle === 'FLOAT') {
             // Basic bobbing handled in update(), just add some rotation
             this.mesh.rotation.y += dt;
        }
        
        // removed specific type checks, replaced with animStyle properties
    }

    takeDamage(amount) {
        this.hp -= amount;
        
        // Flash white
        this.mesh.material.color.setHex(0xffffff);
        setTimeout(() => {
            if(this.mesh) this.mesh.material.color.setHex(this.baseColor);
        }, 100);

        if (this.hp <= 0) {
            this.dispose();
            return true;
        }
        return false;
    }

    highlight() {
        if (!this.mesh) return;
        this.mesh.material.color.setHex(0xffff00);
        setTimeout(() => {
            if(this.mesh) this.mesh.material.color.setHex(this.baseColor);
        }, 200);
    }

    resetBattleState() {
        this.turnPhase = 0;
        this.turnTimer = 0;
    }

    prepareTurn() {
        this.turnPhase = 'MOVE';
        this.turnTimer = 1.0;
        this.hasHit = false;
    }

    executeTurn(dt, player, world) {
        if (!this.mesh || !player.mesh) return true;

        const playerPos = player.mesh.position;
        const dist = this.mesh.position.distanceTo(playerPos);
        const dir = new THREE.Vector3().subVectors(playerPos, this.mesh.position).normalize();
        dir.y = 0;

        // Base color restoration helper
        const resetColor = () => {
            if (this.mesh) this.mesh.material.color.setHex(this.baseColor);
        };

        switch (this.turnPhase) {
            case 'MOVE':
                this.mesh.lookAt(playerPos);
                
                // Different movement goals
                let stopDist = 3.0;
                if (this.type === 'SPIRIT') stopDist = 8.0; // Stay ranged
                if (this.type === 'GOLEM') stopDist = 4.0; // AoE range

                if (dist > stopDist) {
                    this.mesh.position.add(dir.multiplyScalar(this.speed * dt));
                    if (world) this.mesh.position.y = world.getHeight(this.mesh.position.x, this.mesh.position.z) + this.yOffset;
                }
                
                this.turnTimer -= dt;
                if (this.turnTimer <= 0) {
                    this.turnPhase = 'ATTACK_WARN';
                    this.turnTimer = (this.type === 'GOLEM') ? 1.5 : 0.5; // Longer telegraph for Golem
                }
                break;

            case 'ATTACK_WARN':
                // Flash Warning
                const color = (Date.now() % 100 < 50) ? 0xff0000 : 0xffffff;
                this.mesh.material.color.setHex(color);
                
                this.turnTimer -= dt;
                if (this.turnTimer <= 0) {
                    this.turnPhase = 'ATTACK_EXEC';
                    this.turnTimer = 0.5;
                    this.mesh.material.color.setHex(0xffffff);
                }
                break;

            case 'ATTACK_EXEC':
                let damage = 0;
                let hit = false;
                
                if (this.type === 'GOLEM' || this.type === 'MAGMA_GOLEM') {
                    // AoE Slam - No movement, just radius check
                    const radius = (this.type === 'MAGMA_GOLEM') ? 8.0 : 6.0;
                    if (dist < radius) { 
                        damage = this.damage * 1.5; // Heavy hit
                        hit = true;
                    }
                    // Visual shake
                    this.mesh.position.y += Math.sin(Date.now() * 0.5) * 0.1;
                } 
                else if (this.type === 'SPIRIT' || this.type === 'ICE_SPIRIT' || this.type === 'SERPENT') {
                    // Ranged zap / Water Spit
                    const range = (this.type === 'SERPENT') ? 10.0 : 14.0;
                    if (dist < range) {
                        damage = this.damage;
                        hit = true;
                        
                        // Visual Lunge for serpent
                        if (this.type === 'SERPENT') {
                            this.mesh.position.add(dir.multiplyScalar(5.0 * dt));
                        }
                    }
                } 
                else {
                    // Melee Dash (Goblin, Wolf, Slime, etc)
                    const dashSpeed = this.speed * 4;
                    this.mesh.position.add(dir.multiplyScalar(dashSpeed * dt));
                    
                    // Maintain height logic
                    if (world) {
                        if (this.isAquatic) {
                            this.mesh.position.y = Math.max(world.getHeight(this.mesh.position.x, this.mesh.position.z), 1.0) + this.yOffset;
                        } else {
                            this.mesh.position.y = world.getHeight(this.mesh.position.x, this.mesh.position.z) + this.yOffset;
                        }
                    }

                    if (dist < 2.5) {
                        damage = this.damage;
                        hit = true;
                        // Bounce player
                        const bounce = dir.clone().multiplyScalar(3.0);
                        player.mesh.position.add(bounce);
                    }
                }

                if (hit && !this.hasHit) {
                    player.takeDamage(damage, this.element);
                    this.hasHit = true; // Ensure one hit per turn
                }

                this.turnTimer -= dt;
                if (this.turnTimer <= 0) {
                    this.turnPhase = 'RETURN';
                    this.turnTimer = 0.5;
                    this.hasHit = false; // Reset for next time
                }
                break;

            case 'RETURN':
                resetColor();
                // Melee units back off
                if (this.type !== 'GOLEM' && this.type !== 'SPIRIT') {
                    this.mesh.position.sub(dir.multiplyScalar(this.speed * dt));
                    if (world) this.mesh.position.y = world.getHeight(this.mesh.position.x, this.mesh.position.z) + this.yOffset;
                }
                
                this.turnTimer -= dt;
                if (this.turnTimer <= 0) {
                    return true;
                }
                break;
        }

        return false;
    }

    getDrop() {
        const roll = Math.random();
        
        // Default Drop Table
        // 30% chance for Herb
        // 15% chance for HP Potion
        // 15% chance for MP Potion
        // 1% chance for Elixir
        
        if (roll < 0.01) return 'ELIXIR';
        if (roll < 0.16) return 'MP_POTION';
        if (roll < 0.31) return 'HP_POTION';
        if (roll < 0.61) return 'HERB';
        
        return null;
    }

    dispose() {
        if (this.mesh) {
            this.lastPosition.copy(this.mesh.position); // Final save
            this.scene.remove(this.mesh);
            if (this.mesh.geometry) this.mesh.geometry.dispose();
            if (this.mesh.material) this.mesh.material.dispose();
            this.mesh = null;
        }
    }
}