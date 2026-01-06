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
    }

    initBattle(centerPos, enemy) {
        this.active = true;
        this.center.copy(centerPos);
        this.activeEnemy = enemy;
        
        // Lock enemy state
        enemy.state = 'BATTLE';
        enemy.aiState = null; // Reset AI

        // Create Boundary Ring
        const geometry = new THREE.TorusGeometry(this.radius, 0.2, 8, 32);
        const material = new THREE.MeshBasicMaterial({ color: 0xffaa00, transparent: true, opacity: 0.6 });
        this.boundaryMesh = new THREE.Mesh(geometry, material);
        this.boundaryMesh.rotation.x = Math.PI / 2;
        this.boundaryMesh.position.copy(centerPos);
        this.boundaryMesh.position.y += 1;
        this.scene.add(this.boundaryMesh);
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
        
        const level = this.player.spirits[element];
        const spellIndex = level >= 5 ? 1 : 0;
        const spellConfig = SPELLS[element][spellIndex];
        
        if (this.player.stats.mp < spellConfig.cost) return;

        // Start Casting (Delay)
        this.player.startCasting(spellConfig, () => {
            this.executeSpell(element, spellConfig);
        });
    }

    executeSpell(element, spellConfig) {
        this.player.stats.mp -= spellConfig.cost;

        if (spellConfig.type === 'heal') {
            this.player.stats.hp = Math.min(this.player.stats.maxHp, this.player.stats.hp + spellConfig.power);
            this.audioManager.playSfx('cast');
            return;
        }

        const spawnPos = this.player.mesh.position.clone();
        spawnPos.y += 1.5;
        
        let sfx = 'wind';
        if (element === 'fire') sfx = 'fire';
        if (element === 'earth') sfx = 'hit';
        this.audioManager.playSfx(sfx);

        // No lock-on: fires in player's forward direction
        const projectile = new SpellProjectile(
            this.scene, 
            spawnPos, 
            this.player.mesh.quaternion,
            spellConfig
        );
        this.projectiles.push(projectile);
    }

    update(dt, inputs) {
        if (!this.active || !this.activeEnemy) return 'ESCAPE';
        if (!this.activeEnemy.mesh) return 'VICTORY'; // Enemy died/cleaned up unexpectedly

        // Update Player
        this.player.update(dt, inputs, null, this.center, this.radius);
        
        // Check Escape
        const dist = this.player.mesh.position.distanceTo(this.center);
        if (dist > this.radius) {
            return 'ESCAPE';
        }

        // Update Enemy AI
        this.activeEnemy.battleUpdate(dt, this.player.mesh.position);

        // Player vs Enemy Collision (Damage)
        if (this.activeEnemy.mesh && this.player.mesh.position.distanceTo(this.activeEnemy.mesh.position) < 1.5) {
            if (!this.player.invulnerable) {
                this.player.stats.hp -= 5;
                this.audioManager.playSfx('hit');
                // Knockback
                const push = new THREE.Vector3().subVectors(this.player.mesh.position, this.activeEnemy.mesh.position).normalize();
                this.player.mesh.position.add(push.multiplyScalar(3));
                
                // Interrupt Cast
                if (this.player.castState.active) {
                    this.player.stopCasting();
                }

                // Simple I-frame
                this.player.invulnerable = true;
                this.player.mesh.children.forEach(c => c.material.wireframe = true);
                setTimeout(() => {
                    this.player.invulnerable = false;
                     if(this.player.mesh) this.player.mesh.children.forEach(c => c.material.wireframe = false);
                }, 1000);
            }
        }

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