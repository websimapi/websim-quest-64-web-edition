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
        this.moves = def.moves || [{ type: 'MELEE', name: 'Attack', power: 1.0, range: 2.0 }];

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
        this.roamRadius = 25;
        this.roamTarget = this.roamOrigin.clone();
        this.waitTime = 0;
        this.moveTimer = 0; // Prevent infinite walking

        this.mesh.position.copy(this.roamOrigin);
        this.scene.add(this.mesh);
        
        this.selectedMove = null;
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
        const isMovingBattle = this.state === 'BATTLE' && (this.turnPhase === 'MOVE' || this.turnPhase === 'RETURN' || (this.turnPhase === 'ATTACK_EXEC' && this.selectedMove && ['MELEE', 'DASH'].includes(this.selectedMove.type)));
        this.animate(dt, isMovingBattle || this.state === 'CHASE' || (this.waitTime <= 0 && this.state === 'ROAM'));

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
                // Idle look around
                if (Math.random() < 0.02) {
                    this.mesh.rotation.y += (Math.random() - 0.5) * 1.0;
                }
            } else {
                const dist = this.mesh.position.distanceTo(this.roamTarget);
                // Also stop if taking too long (stuck?)
                this.moveTimer += dt;
                
                if (dist < 1.0 || this.moveTimer > 10.0) {
                    // Pick new target
                    let valid = false;
                    let attempts = 0;
                    const nextTarget = new THREE.Vector3();
                    
                    while (!valid && attempts < 5) {
                        const angle = Math.random() * Math.PI * 2;
                        const r = Math.random() * this.roamRadius;
                        nextTarget.set(
                            this.roamOrigin.x + Math.cos(angle) * r,
                            0,
                            this.roamOrigin.z + Math.sin(angle) * r
                        );
                        
                        // Validate if world exists
                        if (world) {
                            const h = world.getHeight(nextTarget.x, nextTarget.z);
                            const currentH = world.getHeight(this.mesh.position.x, this.mesh.position.z);
                            
                            // Don't go into water if land
                            if (!this.isAquatic && h < 1.0) { attempts++; continue; }
                            // Don't go on land if aquatic
                            if (this.isAquatic && h > 1.0) { attempts++; continue; }
                            // Don't climb steep cliffs
                            if (Math.abs(h - currentH) > 10.0) { attempts++; continue; }
                        }
                        
                        valid = true;
                    }
                    
                    this.roamTarget.copy(nextTarget);
                    this.waitTime = 1 + Math.random() * 3;
                    this.moveTimer = 0;
                } else {
                    const dir = new THREE.Vector3().subVectors(this.roamTarget, this.mesh.position).normalize();
                    this.mesh.position.add(dir.multiplyScalar((this.speed * 0.5) * dt));
                    // Smoothly rotate towards
                    const targetRot = Math.atan2(dir.x, dir.z);
                    const curRot = this.mesh.rotation.y;
                    let diff = targetRot - curRot;
                    while(diff < -Math.PI) diff += Math.PI*2;
                    while(diff > Math.PI) diff -= Math.PI*2;
                    this.mesh.rotation.y += diff * dt * 5;
                    
                    isMoving = true;
                }
            }
        }
    }

    animate(dt, isMoving) {
        const t = Date.now() * 0.001;
        const mesh = this.mesh;
        
        // --- Limb Animation ---
        const legL = mesh.getObjectByName('legL');
        const legR = mesh.getObjectByName('legR');
        const armL = mesh.getObjectByName('armL');
        const armR = mesh.getObjectByName('armR');
        
        // 4-legged animation
        const leg0 = mesh.getObjectByName('leg0');
        const leg1 = mesh.getObjectByName('leg1');
        const leg2 = mesh.getObjectByName('leg2');
        const leg3 = mesh.getObjectByName('leg3');

        if (this.animStyle.includes('WALK') || this.animStyle === 'HOP') {
            if (isMoving) {
                // Humanoid Walk
                if (legL && legR) {
                    legL.rotation.x = Math.sin(t * 10) * 0.5;
                    legR.rotation.x = Math.sin(t * 10 + Math.PI) * 0.5;
                }
                if (armL && armR) {
                    armL.rotation.x = Math.sin(t * 10 + Math.PI) * 0.5;
                    armR.rotation.x = Math.sin(t * 10) * 0.5;
                }
                
                // Quadruped Walk
                if (leg0) {
                    leg0.rotation.x = Math.sin(t * 12) * 0.4;
                    leg1.rotation.x = Math.sin(t * 12 + Math.PI) * 0.4;
                    leg2.rotation.x = Math.sin(t * 12 + Math.PI * 0.5) * 0.4;
                    leg3.rotation.x = Math.sin(t * 12 + Math.PI * 1.5) * 0.4;
                }
                
                // Body bob
                if (this.animStyle === 'HOP') {
                    mesh.position.y += Math.abs(Math.sin(t * 10)) * 0.1;
                } else {
                    // WALK bob
                    mesh.position.y += Math.sin(t * 15) * 0.03;
                }
            } else {
                // Idle Reset
                if (legL) legL.rotation.x = THREE.MathUtils.lerp(legL.rotation.x, 0, dt * 5);
                if (legR) legR.rotation.x = THREE.MathUtils.lerp(legR.rotation.x, 0, dt * 5);
                if (armL) armL.rotation.x = THREE.MathUtils.lerp(armL.rotation.x, 0, dt * 5);
                if (armR) armR.rotation.x = THREE.MathUtils.lerp(armR.rotation.x, 0, dt * 5);
                if (leg0) [leg0, leg1, leg2, leg3].forEach(l => l.rotation.x = THREE.MathUtils.lerp(l.rotation.x, 0, dt*5));
            }
        }
        else if (this.animStyle === 'SQUASH') {
            const freq = isMoving ? 15 : 5;
            const amp = isMoving ? 0.2 : 0.05;
            // Apply scale to children geometry or uniform scale? 
            // Simple scale Y bob
            const s = 1.0 + Math.sin(t * freq) * amp;
            mesh.scale.set(1.0 + (1-s)*0.5, s, 1.0 + (1-s)*0.5); // Preserve volume roughly
        }
        else if (this.animStyle === 'SWIM') {
             mesh.position.y += Math.sin(t * 2) * 0.05;
             mesh.rotation.z = Math.sin(t * 5) * 0.1;
             // Tail wag for serpent?
        }
        else if (this.animStyle === 'FLOAT') {
             mesh.position.y += Math.sin(t * 2) * 0.005;
             mesh.rotation.y += dt;
        }
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
        // Select Move
        const roll = Math.random();
        // Simple AI: 60% first move (usually basic), 40% second (special)
        if (this.moves.length > 1 && roll > 0.6) {
            this.selectedMove = this.moves[1];
        } else {
            this.selectedMove = this.moves[0];
        }

        this.turnPhase = 'MOVE';
        this.turnTimer = 2.0; // Max time to move into position
        this.hasHit = false;
    }

    executeTurn(dt, player, world) {
        if (!this.mesh || !player.mesh) return true;

        const playerPos = player.mesh.position;
        const dist = this.mesh.position.distanceTo(playerPos);
        const dir = new THREE.Vector3().subVectors(playerPos, this.mesh.position).normalize();
        dir.y = 0;

        const resetColor = () => { if (this.mesh) this.mesh.material.color.setHex(this.baseColor); };
        const move = this.selectedMove || this.moves[0];

        switch (this.turnPhase) {
            case 'MOVE':
                this.mesh.lookAt(playerPos);
                
                // Move until in range of the selected move
                const desiredRange = move.range - 0.5;
                
                // If it's a healing spell, we don't need to be near player, just stop
                if (move.type === 'HEAL') {
                     this.turnPhase = 'ATTACK_WARN';
                     this.turnTimer = 0.5;
                     return false;
                }

                if (dist > desiredRange) {
                    this.mesh.position.add(dir.multiplyScalar(this.speed * dt));
                    if (world) this.mesh.position.y = world.getHeight(this.mesh.position.x, this.mesh.position.z) + this.yOffset;
                    
                    this.turnTimer -= dt;
                    if (this.turnTimer <= 0) {
                         // Timeout, just attack anyway from here
                         this.turnPhase = 'ATTACK_WARN';
                         this.turnTimer = 0.5;
                    }
                } else {
                    // In range
                    this.turnPhase = 'ATTACK_WARN';
                    this.turnTimer = (move.type === 'AOE') ? 1.0 : 0.5; 
                }
                break;

            case 'ATTACK_WARN':
                // Telegraph
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
                let damage = this.damage * (move.power || 1.0);
                let hit = false;
                
                // Logic based on move type
                if (move.type === 'MELEE' || move.type === 'DASH') {
                    // Visual dash
                    const dashSpeed = this.speed * (move.type === 'DASH' ? 6 : 4);
                    this.mesh.position.add(dir.multiplyScalar(dashSpeed * dt));
                    
                    if (world) this.mesh.position.y = world.getHeight(this.mesh.position.x, this.mesh.position.z) + this.yOffset;

                    if (dist < 2.5) {
                        hit = true;
                        // Bounce player
                        const bounce = dir.clone().multiplyScalar(2.0);
                        player.mesh.position.add(bounce);
                    }
                }
                else if (move.type === 'RANGED') {
                    // Just check range roughly (already checked in move phase)
                    if (dist < move.range + 2.0) {
                        // In reality we should spawn a projectile here, 
                        // but for simplicity in this turn-based logic, we assume hit if in range
                        // or just delayed hit.
                        // Let's visual flash the target
                        hit = true;
                    }
                }
                else if (move.type === 'AOE') {
                    const radius = move.radius || 5.0;
                    if (dist < radius) {
                        hit = true;
                    }
                    // Jump/Smash visual
                    this.mesh.position.y += Math.sin(Date.now()*0.5) * 0.2;
                }
                else if (move.type === 'HEAL') {
                     // Self heal
                     this.hp = Math.min(this.maxHp, this.hp + (move.power || 10));
                     // Visual
                     this.mesh.material.color.setHex(0x00ff00);
                }

                if (hit && !this.hasHit) {
                    player.takeDamage(damage, this.element);
                    this.hasHit = true;
                }

                this.turnTimer -= dt;
                if (this.turnTimer <= 0) {
                    this.turnPhase = 'RETURN';
                    this.turnTimer = 0.5;
                    this.hasHit = false;
                }
                break;

            case 'RETURN':
                resetColor();
                // Back off if Melee
                if (move.type === 'MELEE' || move.type === 'DASH') {
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