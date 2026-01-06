import * as THREE from 'three';
import { SpellProjectile, SPELLS } from './Spells.js';

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

        // Turn System
        this.turn = 'PLAYER'; // 'PLAYER' | 'ENEMY'
        this.enemyTurnIndex = 0;
        this.maxMove = 8.0;
        this.currentMove = 8.0;
        this.turnTimer = 0;
    }

    initBattle(centerPos, primaryEnemy, allEnemies, world) {
        this.active = true;
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
            
            // Calculate world position for this vertex
            const wx = centerPos.x + vertex.x;
            const wz = centerPos.z + vertex.z;
            
            // Get height at this position
            const h = world.getHeight(wx, wz);
            
            // Set vertex to absolute world position
            posAttribute.setXYZ(i, wx, h + 0.5, wz);
        }
        
        geometry.computeVertexNormals();

        const material = new THREE.MeshBasicMaterial({ color: 0xffaa00, transparent: true, opacity: 0.6 });
        this.boundaryMesh = new THREE.Mesh(geometry, material);
        // Mesh stays at 0,0,0 because vertices are in world space
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
        const spellIndex = level >= 5 ? 1 : 0;
        const spellConfig = SPELLS[element][spellIndex];
        
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

        if (spellConfig.type === 'heal') {
            this.player.stats.hp = Math.min(this.player.stats.maxHp, this.player.stats.hp + spellConfig.power);
            this.audioManager.playSfx('cast');
            // Self-buffs also end turn
            return;
        }

        const staffState = this.player.getStaffTipWorldState();
        
        let sfx = 'wind';
        if (element === 'fire') sfx = 'fire';
        if (element === 'earth') sfx = 'hit';
        this.audioManager.playSfx(sfx);

        // Fire from staff tip in staff direction
        const projectile = new SpellProjectile(
            this.scene, 
            staffState.position, 
            staffState.quaternion,
            spellConfig
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
                this.currentMove -= dt * this.player.speed; // Deplete based on speed/time
                if (this.currentMove < 0) this.currentMove = 0;
            } else if (this.currentMove <= 0) {
                // Stamina depleted
                canMove = false;
            }
        } else if (this.turn === 'ENEMY') {
            canMove = false;
            const enemy = this.activeEnemies[this.enemyTurnIndex];
            
            if (!enemy || !enemy.mesh || enemy.hp <= 0) {
                // Invalid or dead, next
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

        // Update Player
        this.player.update(dt, inputs, world, this.center, this.radius, canMove);
        
        // Check Escape
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
                // Don't return VICTORY here, let next loop catch it so we process things orderly
                
                p.dispose();
                this.projectiles.splice(i, 1);
            } else if (result.result === 'TIMEOUT') {
                p.dispose();
                this.projectiles.splice(i, 1);
            }
        }
        
        return 'CONTINUE';
    }
}