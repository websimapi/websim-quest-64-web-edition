import * as THREE from 'three';
import { SpellProjectile } from './Spells.js';

export class RoamingSystem {
    constructor(game) {
        this.game = game;
        this.projectiles = [];
        this.aiTarget = null;
        this.aiActionTimer = 0;
        
        // Roaming State
        this.roamState = 'IDLE';
        this.roamTimer = 0;
        this.roamTarget = new THREE.Vector3();
        this.lastMovePos = new THREE.Vector3();
        this.stuckTimer = 0;
        this.wanderDirection = new THREE.Vector3(Math.random()-0.5, 0, Math.random()-0.5).normalize();
    }

    update(dt) {
        // Update Roaming Projectiles
        for (let i = this.projectiles.length - 1; i >= 0; i--) {
            const p = this.projectiles[i];
            const result = p.update(dt, this.game.world.enemies.filter(e => e.hp > 0));
            
            if (result.result === 'HIT' || result.result === 'HIT_AOE') {
                this.game.audioManager.playSfx('hit');
                
                let hitEnemies = [];
                let dyingEnemies = [];

                if (result.result === 'HIT') {
                    if (result.target.takeDamage(result.damage)) {
                         dyingEnemies.push(result.target);
                    }
                    hitEnemies.push(result.target);
                } else {
                    result.targets.forEach(t => {
                        if (t.takeDamage(result.damage)) {
                            dyingEnemies.push(t);
                        }
                    });
                    hitEnemies = result.targets;
                }
                
                // Spawn drops for dead enemies
                dyingEnemies.forEach(e => this.game.trySpawnDrop(e));

                p.dispose();
                this.projectiles.splice(i, 1);

                // Trigger Battle with first hit enemy (only if not already in battle)
                const livingHit = hitEnemies.find(e => e.hp > 0);
                if (this.game.gameState !== 'BATTLE' && livingHit) {
                    this.game.startBattle(livingHit);
                }
            }
            else if (result.result === 'TIMEOUT') {
                p.dispose();
                this.projectiles.splice(i, 1);
            }
        }
    }

    updateAI(dt, inputs) {
        if (this.game.gameState !== 'ROAMING') return;

        // Cooldown for AI actions
        if (this.aiActionTimer > 0) {
            this.aiActionTimer -= dt;
        }

        // Find target if none or dead or too far
        const detectionRange = 150; // Vastly increased range to spot distant enemies
        
        if (!this.aiTarget || this.aiTarget.hp <= 0 || this.aiTarget.mesh.position.distanceTo(this.game.player.mesh.position) > detectionRange) {
            // Get closest living enemy
            let minDist = 999;
            let closest = null;
            for (let e of this.game.world.enemies) {
                if (e.hp > 0) {
                    const d = e.mesh.position.distanceTo(this.game.player.mesh.position);
                    if (d < minDist && d < detectionRange) { minDist = d; closest = e; }
                }
            }
            this.aiTarget = closest;
        }

        if (this.aiTarget) {
            const pPos = this.game.player.mesh.position;
            const tPos = this.aiTarget.mesh.position;
            const dist = pPos.distanceTo(tPos);

            // Intelligent Approach:
            // If out of range (> 20), move closer.
            // If in range (10-20), stop and cast.
            // If too close (< 8), back off.

            if (dist > 18) {
                // Move towards
                const dir = new THREE.Vector3().subVectors(tPos, pPos).normalize();
                inputs.x = dir.x;
                inputs.y = -dir.z; 
            } else if (dist < 8) {
                // Back off slightly to optimal range
                const dir = new THREE.Vector3().subVectors(pPos, tPos).normalize();
                inputs.x = dir.x;
                inputs.y = -dir.z;
            } else {
                // Good range, stop and shoot
                inputs.x = 0;
                inputs.y = 0;
                
                if (this.aiActionTimer <= 0 && !this.game.player.castState.active) {
                    this.game.player.faceTarget(tPos);
                    
                    this.aiActionTimer = 4.0; // Wait before next shot/move
                    
                    // Delay cast to allow rotation to align
                    setTimeout(() => {
                        if (this.game.gameState !== 'ROAMING') return;
                        const elements = ['fire', 'water', 'earth', 'wind'];
                        const el = elements[Math.floor(Math.random() * elements.length)];
                        this.game.handleSpellCast(el);
                    }, 400);
                }
            }
        } else {
             // Smart Exploring Logic - Long Distance Travel with Intent
             
             // Initialize wander direction if missing (Global heading)
             if (!this.wanderDirection) {
                 const angle = Math.random() * Math.PI * 2;
                 this.wanderDirection = new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle));
             }

             if (this.roamState === 'IDLE') {
                 this.roamTimer -= dt;
                 if (this.roamTimer <= 0) {
                     // Determine new roam target
                     let valid = false;
                     let attempts = 0;
                     const currentPos = this.game.player.mesh.position;

                     // Occasionally change general heading (15% chance)
                     if (Math.random() < 0.15) {
                         const angle = Math.random() * Math.PI * 2;
                         this.wanderDirection.set(Math.cos(angle), 0, Math.sin(angle));
                     }

                     while (!valid && attempts < 10) {
                        // Vary the angle slightly from general wander direction (cone +/- 60 deg)
                        const baseAngle = Math.atan2(this.wanderDirection.z, this.wanderDirection.x);
                        const vary = (Math.random() - 0.5) * (Math.PI * 0.66); 
                        const angle = baseAngle + vary;
                        
                        // Pick a longer distance for purposeful travel
                        const range = 50 + Math.random() * 50; // 50-100 units ahead
                        
                        const tx = currentPos.x + Math.cos(angle) * range;
                        const tz = currentPos.z + Math.sin(angle) * range;
                        
                        // Check Terrain
                        const h = this.game.world.getHeight(tx, tz);
                        const waterLevel = this.game.world.waterSystem ? this.game.world.waterSystem.waterLevel : 1.0;
                        
                        // Validation:
                        // 1. Not deep water (allow shallow)
                        // 2. Not too high slope relative to current
                        const curH = this.game.world.getHeight(currentPos.x, currentPos.z);
                        const isSafeLand = h > waterLevel - 0.2;
                        const isTraversable = Math.abs(h - curH) < 20.0; 

                        if (isSafeLand && isTraversable) {
                            this.roamTarget.set(tx, h, tz);
                            valid = true;
                            // Commit to this new direction
                            this.wanderDirection.set(Math.cos(angle), 0, Math.sin(angle));
                        } else {
                            // If blocked, rotate wander direction significantly (90 deg) for next attempt
                            const newAngle = baseAngle + Math.PI / 2 * (Math.random() > 0.5 ? 1 : -1);
                            this.wanderDirection.set(Math.cos(newAngle), 0, Math.sin(newAngle));
                        }
                        attempts++;
                     }

                     if (valid) {
                        this.roamState = 'MOVING';
                        this.roamTimer = 20.0; // Long timeout for long journey
                        this.lastMovePos.copy(currentPos);
                        this.stuckTimer = 0;
                     } else {
                         // Completely blocked? Reverse.
                         this.wanderDirection.negate();
                         this.roamTimer = 0.2; // Try again immediately
                     }
                 }
                 // Stay still
                 inputs.x = 0;
                 inputs.y = 0;
             } 
             else if (this.roamState === 'MOVING') {
                 this.roamTimer -= dt;
                 const currentPos = this.game.player.mesh.position;
                 const dist = new THREE.Vector2(currentPos.x, currentPos.z).distanceTo(new THREE.Vector2(this.roamTarget.x, this.roamTarget.z));
                 
                 // Stuck detection
                 this.stuckTimer += dt;
                 if (this.stuckTimer > 0.5) {
                     const distMoved = currentPos.distanceTo(this.lastMovePos);
                     if (distMoved < 0.2) {
                         // Stuck
                         this.roamState = 'IDLE';
                         this.roamTimer = 0.2; // Quick reset
                         // Break direction
                         const angle = Math.random() * Math.PI * 2;
                         this.wanderDirection.set(Math.cos(angle), 0, Math.sin(angle));
                     }
                     this.lastMovePos.copy(currentPos);
                     this.stuckTimer = 0;
                 }

                 // Check for "Arrived"
                 if (dist < 5.0 || this.roamTimer <= 0) {
                     this.roamState = 'IDLE';
                     // Very rarely stop (5% chance), otherwise keep walking
                     if (Math.random() < 0.05) {
                        this.roamTimer = 2.0 + Math.random() * 2.0; 
                     } else {
                        this.roamTimer = 0; // Seamless next leg
                     }
                     inputs.x = 0; 
                     inputs.y = 0;
                 } else {
                     // Move towards target
                     const dir = new THREE.Vector3().subVectors(this.roamTarget, currentPos).normalize();
                     inputs.x = dir.x;
                     inputs.y = -dir.z; 
                 }
             }
        }
    }

    spawnProjectile(element, config) {
        if (config.type === 'heal') {
            // Self heal logic duplication from CombatSystem (simplified)
            this.game.player.stats.hp = Math.min(this.game.player.stats.maxHp, this.game.player.stats.hp + config.power);
            this.game.audioManager.playSfx('cast');
            return;
        }

        const staffState = this.game.player.getStaffTipWorldState();
        let sfx = 'wind';
        if (element === 'fire') sfx = 'fire';
        if (element === 'earth') sfx = 'hit';
        this.game.audioManager.playSfx(sfx);

        // Aim forward based on player facing
        const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(this.game.player.mesh.quaternion);
        const spawnPos = staffState.position.clone();
        const aimObj = new THREE.Object3D();
        aimObj.position.copy(spawnPos);
        
        // Aim parallel to ground if ground spell, or just straight forward
        const targetPos = spawnPos.clone().add(forward.multiplyScalar(20));
        targetPos.y = spawnPos.y; // Keep level
        aimObj.lookAt(targetPos);

        const proj = new SpellProjectile(
            this.game.scene,
            spawnPos,
            aimObj.quaternion,
            config,
            this.game.world,
            null // No specific target
        );
        this.projectiles.push(proj);
    }
}