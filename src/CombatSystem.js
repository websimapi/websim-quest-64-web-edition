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
        
        this.activeEnemy = null;
        this.projectiles = [];

        // Turn System
        this.turn = 'PLAYER'; // 'PLAYER' | 'ENEMY'
        this.maxMove = 8.0;
        this.currentMove = 8.0;
        this.turnTimer = 0;
    }

    initBattle(centerPos, enemy) {
        this.active = true;
        this.center.copy(centerPos);
        this.activeEnemy = enemy;
        
        // Lock enemy state
        enemy.state = 'BATTLE';
        enemy.resetBattleState();

        // Create Boundary Ring
        const geometry = new THREE.TorusGeometry(this.radius, 0.2, 8, 32);
        const material = new THREE.MeshBasicMaterial({ color: 0xffaa00, transparent: true, opacity: 0.6 });
        this.boundaryMesh = new THREE.Mesh(geometry, material);
        this.boundaryMesh.rotation.x = Math.PI / 2;
        this.boundaryMesh.position.copy(centerPos);
        this.boundaryMesh.position.y += 1;
        this.scene.add(this.boundaryMesh);

        this.startPlayerTurn();
    }

    startPlayerTurn() {
        this.turn = 'PLAYER';
        this.currentMove = this.maxMove;
    }

    startEnemyTurn() {
        this.turn = 'ENEMY';
        if (this.activeEnemy) this.activeEnemy.prepareTurn();
    }

    cleanup() {
        this.active = false;
        if(this.boundaryMesh) {
            this.scene.remove(this.boundaryMesh);
            this.boundaryMesh = null;
        }
        if (this.activeEnemy && this.activeEnemy.hp > 0) {
            this.activeEnemy.state = 'ROAM'; // If escaped
        }
        this.activeEnemy = null;

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

    update(dt, inputs) {
        if (!this.active || !this.activeEnemy) return 'ESCAPE';
        if (!this.activeEnemy.mesh) return 'VICTORY';

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
            // Execute Enemy Turn
            const enemyDone = this.activeEnemy.executeTurn(dt, this.player);
            if (enemyDone) {
                this.startPlayerTurn();
            }
        }

        // Update Player
        this.player.update(dt, inputs, null, this.center, this.radius, canMove);
        
        // Check Escape
        const dist = this.player.mesh.position.distanceTo(this.center);
        if (dist > this.radius) {
            return 'ESCAPE';
        }

        // Collision Check (Only relevant if enemy attacks physically)
        // If enemy hits, it's handled in executeTurn usually, but we keep this for body contact
        // We'll relax it so you don't get hit just by existing, only if enemy dashes

        // Update Projectiles
        for (let i = this.projectiles.length - 1; i >= 0; i--) {
            const p = this.projectiles[i];
            const result = p.update(dt, [this.activeEnemy]);
            
            if (result.result === 'HIT') {
                this.audioManager.playSfx('hit');
                const dead = result.target.takeDamage(result.damage);
                if (dead) return 'VICTORY';
                
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