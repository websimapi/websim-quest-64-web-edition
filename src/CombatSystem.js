import * as THREE from 'three';
import * as THREE from 'three';
import { SpellProjectile, getSpellConfig } from './Spells.js';

export class CombatSystem {
    constructor(scene, player, audioManager) {
        this.scene = scene;
        this.player = player;
        this.audioManager = audioManager;
        this.active = false;
        
        this.boundaryMesh = null;
        this.radius = 15;
        this.center = new THREE.Vector3();
        
        this.activeEnemies = [];
        this.projectiles = [];
        this.world = null; // Store reference

        // Turn System
        this.turn = 'PLAYER'; // 'PLAYER' | 'ENEMY'
        this.enemyTurnIndex = 0;
        this.maxMove = 8.0;
        this.currentMove = 8.0;
        this.turnTimer = 0;
    }

    initBattle(centerPos, primaryEnemy, allEnemies, world) {
        this.active = true;
        this.world = world;
        this.center.copy(centerPos);
        
        // Find all enemies in radius + the primary one
        this.activeEnemies = allEnemies.filter(e => {
            if (e.hp <= 0) return false;
            if (e === primaryEnemy) return true;
            return e.mesh.position.distanceTo(centerPos) <= this.radius;
        });
        
        // Lock enemy states
        this.activeEnemies.forEach(e => {
            e.state = 'BATTLE';
            e.resetBattleState();
        });

        // Create Boundary Ring conforming to terrain
        const geometry = new THREE.TorusGeometry(this.radius, 0.2, 8, 64);
        geometry.rotateX(Math.PI / 2);
        
        // Modify vertices to sit on terrain
        const posAttribute = geometry.attributes.position;
        const vertex = new THREE.Vector3();
        
        for (let i = 0; i < posAttribute.count; i++) {
            vertex.fromBufferAttribute(posAttribute, i);
            const wx = centerPos.x + vertex.x;
            const wz = centerPos.z + vertex.z;
            const h = world.getHeight(wx, wz);
            posAttribute.setXYZ(i, wx, h + 0.5, wz);
        }
        
        geometry.computeVertexNormals();

        const material = new THREE.MeshBasicMaterial({ color: 0xffaa00, transparent: true, opacity: 0.6 });
        this.boundaryMesh = new THREE.Mesh(geometry, material);
        this.scene.add(this.boundaryMesh);

        this.startPlayerTurn();
    }

    startPlayerTurn() {
        this.turn = 'PLAYER';
        this.currentMove = this.maxMove;
    }

    startEnemyTurn() {
        this.turn = 'ENEMY';
        this.enemyTurnIndex = 0;
        this.prepareNextEnemy();
    }

    prepareNextEnemy() {
        while(this.enemyTurnIndex < this.activeEnemies.length) {
            const enemy = this.activeEnemies[this.enemyTurnIndex];
            if(enemy && enemy.mesh && enemy.hp > 0) {
                enemy.prepareTurn();
                return;
            }
            this.enemyTurnIndex++;
        }
        // No more enemies to act
        this.startPlayerTurn();
    }

    cleanup() {
        this.active = false;
        if(this.boundaryMesh) {
            this.scene.remove(this.boundaryMesh);
            this.boundaryMesh = null;
        }
        this.activeEnemies.forEach(e => {
            if (e.hp > 0) e.state = 'ROAM';
        });
        this.activeEnemies = [];

        this.projectiles.forEach(p => p.dispose());
        this.projectiles = [];
    }

    playerCast(element) {
        if (!this.active || this.player.castState.active) return;
        if (this.turn !== 'PLAYER') return;
        
        const level = this.player.spirits[element];
        
        // Get dynamic spell config
        const spellConfig = getSpellConfig(element, level, this.player.stats.hp, this.player.stats.maxHp);
        
        if (this.player.stats.mp < spellConfig.cost) return;

        // Start Casting (Delay)
        this.player.startCasting(spellConfig, () => {
            this.executeSpell(element, spellConfig);
            // End turn after cast completes
            setTimeout(() => this.startEnemyTurn(), 500);
        });
    }

    executeSpell(element, spellConfig) {
        this.player.stats.mp -= spellConfig.cost;

        // Visual Effects for Heal
        if (spellConfig.type === 'heal') {
            this.player.stats.hp = Math.min(this.player.stats.maxHp, this.player.stats.hp + spellConfig.power);
            this.audioManager.playSfx('cast');
            
            // Add visual healing column
            const healGeo = new THREE.CylinderGeometry(1, 1, 4, 8, 1, true);
            const healMat = new THREE.MeshBasicMaterial({ 
                color: spellConfig.color, 
                transparent: true, 
                opacity: 0.5, 
                side: THREE.DoubleSide 
            });
            const healMesh = new THREE.Mesh(healGeo, healMat);
            healMesh.position.copy(this.player.mesh.position);
            healMesh.position.y += 2;
            this.scene.add(healMesh);
            
            // Animate out
            let scale = 1;
            const anim = setInterval(() => {
                scale += 0.1;
                healMesh.scale.set(scale, 1, scale);
                healMesh.material.opacity -= 0.05;
                if(healMesh.material.opacity <= 0) {
                    clearInterval(anim);
                    this.scene.remove(healMesh);
                    healMesh.geometry.dispose();
                    healMesh.material.dispose();
                }
            }, 50);
            
            return;
        }

        const staffState = this.player.getStaffTipWorldState();
        
        let sfx = 'wind';
        if (element === 'fire') sfx = 'fire';
        if (element === 'earth') sfx = 'hit'; // Thud
        this.audioManager.playSfx(sfx);

        // Auto-target logic for pillars/homing
        let target = null;
        if (this.activeEnemies.length > 0) {
            // Find closest enemy in front of player
            const forward = new THREE.Vector3(0,0,-1).applyQuaternion(this.player.mesh.quaternion);
            let bestDot = 0.5; // 45 degree cone roughly
            
            for(let e of this.activeEnemies) {
                if(e.hp <= 0) continue;
                const dirToEnemy = new THREE.Vector3().subVectors(e.mesh.position, this.player.mesh.position).normalize();
                const dot = forward.dot(dirToEnemy);
                if(dot > bestDot) {
                    bestDot = dot;
                    target = e;
                }
            }
            // Fallback: closest
            if(!target && this.activeEnemies.length > 0) {
                 target = this.activeEnemies[0];
            }
        }

        // Fire Spell
        const projectile = new SpellProjectile(
            this.scene, 
            staffState.position, 
            staffState.quaternion, // Direction from player
            spellConfig,
            this.world,
            target
        );
        this.projectiles.push(projectile);
    }

    update(dt, inputs, world) {
        if (!this.active) return 'ESCAPE';

        // Check Victory
        const liveEnemies = this.activeEnemies.filter(e => e.mesh && e.hp > 0);
        if (liveEnemies.length === 0) return 'VICTORY';

        // Turn Logic
        let canMove = false;

        if (this.turn === 'PLAYER') {
            // Check Move Stamina
            if (this.currentMove > 0 && (inputs.x !== 0 || inputs.y !== 0)) {
                canMove = true;
                this.currentMove -= dt * this.player.speed; 
                if (this.currentMove < 0) this.currentMove = 0;
            } else if (this.currentMove <= 0) {
                canMove = false;
            }
        } else if (this.turn === 'ENEMY') {
            canMove = false;
            const enemy = this.activeEnemies[this.enemyTurnIndex];
            
            if (!enemy || !enemy.mesh || enemy.hp <= 0) {
                this.enemyTurnIndex++;
                this.prepareNextEnemy();
            } else {
                const done = enemy.executeTurn(dt, this.player);
                if (done) {
                    this.enemyTurnIndex++;
                    this.prepareNextEnemy();
                }
            }
        }

        this.player.update(dt, inputs, world, this.center, this.radius, canMove);
        
        const dist = this.player.mesh.position.distanceTo(this.center);
        if (dist > this.radius) {
            return 'ESCAPE';
        }

        // Update Projectiles
        for (let i = this.projectiles.length - 1; i >= 0; i--) {
            const p = this.projectiles[i];
            const result = p.update(dt, this.activeEnemies.filter(e => e.mesh && e.hp > 0));
            
            if (result.result === 'HIT') {
                this.audioManager.playSfx('hit');
                result.target.takeDamage(result.damage);
                p.dispose();
                this.projectiles.splice(i, 1);
            } 
            else if (result.result === 'HIT_AOE') {
                this.audioManager.playSfx('hit');
                result.targets.forEach(t => t.takeDamage(result.damage));
                // Do NOT dispose immediately if we want lingering effects, but for now we do
                // Actually ground targets might linger visually in update() until life runs out
                // But damage triggers once.
            }
            else if (result.result === 'TIMEOUT') {
                p.dispose();
                this.projectiles.splice(i, 1);
            }
        }
        
        return 'CONTINUE';
    }
}