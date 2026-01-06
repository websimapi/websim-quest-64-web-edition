import * as THREE from 'three';

export const SPELLS = {
    fire: [
        { name: "Fireball", type: "projectile", cost: 3, damage: 15, speed: 18, color: 0xff4400, scale: 0.5, shape: 'sphere' },
        { name: "Inferno", type: "projectile", cost: 8, damage: 35, speed: 22, color: 0xff0000, scale: 1.0, shape: 'sphere' }
    ],
    water: [
        { name: "Ice Shard", type: "projectile", cost: 2, damage: 8, speed: 25, color: 0x88ccff, scale: 0.3, shape: 'cone' },
        { name: "Heal", type: "heal", cost: 10, power: 25, color: 0x00ffff }
    ],
    earth: [
        { name: "Rock", type: "projectile", cost: 4, damage: 20, speed: 12, color: 0x8d6e63, scale: 0.6, shape: 'box' },
        { name: "Spirit Armor", type: "buff", cost: 15, duration: 10, color: 0x5d4037 } // Placeholder for defense
    ],
    wind: [
        { name: "Wind Cutter", type: "projectile", cost: 2, damage: 6, speed: 30, color: 0xffff88, scale: 0.4, shape: 'plane' },
        { name: "Cyclone", type: "projectile", cost: 12, damage: 25, speed: 15, color: 0xffeb3b, scale: 1.5, shape: 'cylinder' }
    ]
};

export class SpellProjectile {
    constructor(scene, startPos, targetPos, directionQuat, config) {
        this.scene = scene;
        this.damage = config.damage;
        this.speed = config.speed;
        this.life = 2.5;
        
        let geo;
        if (config.shape === 'box') geo = new THREE.DodecahedronGeometry(config.scale);
        else if (config.shape === 'cone') { geo = new THREE.ConeGeometry(config.scale/2, config.scale, 8); geo.rotateX(Math.PI/2); }
        else if (config.shape === 'plane') { geo = new THREE.PlaneGeometry(config.scale*2, config.scale*2); }
        else if (config.shape === 'cylinder') { geo = new THREE.CylinderGeometry(config.scale, config.scale*0.5, config.scale*2, 8); geo.rotateX(Math.PI/2); }
        else geo = new THREE.SphereGeometry(config.scale, 8, 8);

        const mat = new THREE.MeshBasicMaterial({ 
            color: config.color, 
            transparent: config.shape === 'plane',
            side: THREE.DoubleSide
        });
        
        this.mesh = new THREE.Mesh(geo, mat);
        this.mesh.position.copy(startPos);
        
        if (config.shape === 'plane') {
            this.mesh.lookAt(targetPos || new THREE.Vector3(0,0,0)); // Billboarding rough
        }

        // Aim
        if (targetPos) {
            this.velocity = new THREE.Vector3().subVectors(targetPos, startPos).normalize().multiplyScalar(this.speed);
            this.mesh.lookAt(targetPos);
        } else {
            const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(directionQuat);
            this.velocity = forward.multiplyScalar(this.speed);
            this.mesh.quaternion.copy(directionQuat);
        }

        this.scene.add(this.mesh);
        
        // Particle emitter could go here
    }

    update(dt, enemies) {
        this.life -= dt;
        if (this.life <= 0) return 'TIMEOUT';

        const move = this.velocity.clone().multiplyScalar(dt);
        this.mesh.position.add(move);
        
        // Spin effect
        this.mesh.rotation.z += dt * 10;

        // Collision Check
        for (let enemy of enemies) {
            // Simple sphere check
            if (this.mesh.position.distanceTo(enemy.mesh.position) < 1.5) {
                return { result: 'HIT', target: enemy, damage: this.damage };
            }
        }
        
        return { result: 'FLYING' };
    }

    dispose() {
        if (this.mesh) {
            this.scene.remove(this.mesh);
            this.mesh.geometry.dispose();
            this.mesh.material.dispose();
            this.mesh = null;
        }
    }
}