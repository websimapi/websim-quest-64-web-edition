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
        if (!this.active) return;
        
        // Determine spell based on Spirit Level
        const level = this.player.spirits[element];
        const spellIndex = level >= 5 ? 1 : 0; // Unlock 2nd spell at level 5
        const spellConfig = SPELLS[element][spellIndex];
        
        if (this.player.stats.mp < spellConfig.cost) {
            // Not enough MP feedback?
            return;
        }

        this.player.stats.mp -= spellConfig.cost;
        this.player.castSpell(element); // Visuals
        
        if (spellConfig.type === 'heal') {
            this.player.stats.hp = Math.min(this.player.stats.maxHp, this.player.stats.hp + spellConfig.power);
            this.audioManager.playSfx('cast'); // Use cast sound for heal
            return;
        }

        // Projectile
        const spawnPos = this.player.mesh.position.clone();
        spawnPos.y += 1.5;
        
        let sfx = 'wind';
        if (element === 'fire') sfx = 'fire';
        if (element === 'earth') sfx = 'hit';
        
        this.audioManager.playSfx(sfx);

        const projectile = new SpellProjectile(
            this.scene, 
            spawnPos, 
            this.activeEnemy.mesh.position,
            this.player.mesh.quaternion,
            spellConfig
        );
        this.projectiles.push(projectile);
    }

    update(dt, inputs) {
        if (!this.active || !this.activeEnemy) return 'ESCAPE';

        // Update Player
        this.player.update(dt, inputs, null, this.center, this.radius);
        
        // Check Escape
        const dist = this.player.mesh.position.distanceTo(this.center);
        if (dist > this.radius) {
            return 'ESCAPE';
        }

        // Update Enemy (Simple attack logic)
        // Move towards player
        const dir = new THREE.Vector3().subVectors(this.player.mesh.position, this.activeEnemy.mesh.position).normalize();
        this.activeEnemy.mesh.position.add(dir.multiplyScalar(this.activeEnemy.speed * 0.5 * dt));
        this.activeEnemy.mesh.lookAt(this.player.mesh.position);

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