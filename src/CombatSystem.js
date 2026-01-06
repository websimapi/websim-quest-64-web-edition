import * as THREE from 'three';
import { Enemy } from './Enemy.js';
import { SpellProjectile } from './Spells.js';

export class CombatSystem {
    constructor(scene, player, audioManager) {
        this.scene = scene;
        this.player = player;
        this.audioManager = audioManager;
        this.active = false;
        
        this.boundaryMesh = null;
        this.radius = 15;
        this.center = new THREE.Vector3();
        
        this.enemies = [];
        this.projectiles = [];
    }

    initBattle(centerPos) {
        this.active = true;
        this.center.copy(centerPos);
        
        // Create Boundary Ring
        const geometry = new THREE.TorusGeometry(this.radius, 0.2, 8, 32);
        const material = new THREE.MeshBasicMaterial({ color: 0xffff00, transparent: true, opacity: 0.6 });
        this.boundaryMesh = new THREE.Mesh(geometry, material);
        this.boundaryMesh.rotation.x = Math.PI / 2;
        this.boundaryMesh.position.copy(centerPos);
        this.boundaryMesh.position.y += 1; // Float slightly
        this.scene.add(this.boundaryMesh);

        // Spawn Enemy
        const enemy = new Enemy(this.scene);
        // Position enemy opposite to player relative to center? Or just random inside ring
        const angle = Math.random() * Math.PI * 2;
        const dist = this.radius * 0.5;
        enemy.mesh.position.set(
            this.center.x + Math.cos(angle) * dist,
            this.center.y, // Will be clamped by gravity/world later
            this.center.z + Math.sin(angle) * dist
        );
        this.enemies.push(enemy);
    }

    cleanup() {
        this.active = false;
        if(this.boundaryMesh) {
            this.scene.remove(this.boundaryMesh);
            this.boundaryMesh = null;
        }
        this.enemies.forEach(e => e.dispose());
        this.enemies = [];
        this.projectiles.forEach(p => p.dispose());
        this.projectiles = [];
    }

    playerCast(element) {
        if (!this.active) return;
        
        this.player.castSpell(element);
        
        // Find nearest enemy
        let target = this.enemies[0]; // Simple single target for now
        
        const spawnPos = this.player.mesh.position.clone();
        spawnPos.y += 1.5;

        let spellType = 'projectile';
        let color = 0xffffff;
        let sfx = 'wind';

        if (element === 'fire') { color = 0xff0000; sfx = 'fire'; }
        if (element === 'water') { color = 0x0000ff; sfx = 'wind'; } // Ice shard
        if (element === 'earth') { color = 0x4caf50; sfx = 'hit'; } // Rock
        if (element === 'wind') { color = 0xffeb3b; sfx = 'wind'; }

        this.audioManager.playSfx(sfx);

        const projectile = new SpellProjectile(
            this.scene, 
            spawnPos, 
            target ? target.mesh.position : null,
            this.player.mesh.quaternion,
            color,
            element
        );
        this.projectiles.push(projectile);
    }

    update(dt, inputs) {
        if (!this.active) return;

        // Update Player in combat context (movement confined usually, but Quest 64 allows running out)
        this.player.update(dt, inputs, null, this.center, this.radius);
        
        // Check Escape
        const dist = this.player.mesh.position.distanceTo(this.center);
        if (dist > this.radius) {
            return 'ESCAPE';
        }

        // Update Enemies
        this.enemies.forEach(enemy => {
            enemy.update(dt, this.player.mesh.position);
        });

        // Update Projectiles
        for (let i = this.projectiles.length - 1; i >= 0; i--) {
            const p = this.projectiles[i];
            const result = p.update(dt, this.enemies);
            
            if (result === 'HIT') {
                this.audioManager.playSfx('hit');
                // Assume hit first enemy
                const dead = this.enemies[0].takeDamage(10);
                if (dead) return 'VICTORY';
                
                p.dispose();
                this.projectiles.splice(i, 1);
            } else if (result === 'TIMEOUT') {
                p.dispose();
                this.projectiles.splice(i, 1);
            }
        }
        
        return 'CONTINUE';
    }
}