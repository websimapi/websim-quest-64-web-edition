import * as THREE from 'three';

export class SpellProjectile {
    constructor(scene, startPos, targetPos, directionQuat, color, element) {
        this.scene = scene;
        this.element = element;
        this.speed = 15;
        this.life = 2.0;
        
        const geo = new THREE.SphereGeometry(0.3, 8, 8);
        const mat = new THREE.MeshBasicMaterial({ color: color });
        this.mesh = new THREE.Mesh(geo, mat);
        this.mesh.position.copy(startPos);
        
        // If target exists, aim at it, else aim forward
        if (targetPos) {
            this.velocity = new THREE.Vector3().subVectors(targetPos, startPos).normalize().multiplyScalar(this.speed);
        } else {
            const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(directionQuat);
            this.velocity = forward.multiplyScalar(this.speed);
        }

        this.scene.add(this.mesh);
        
        // Trail particles? (Simplified for performance: just a mesh trail or none)
    }

    update(dt, enemies) {
        this.life -= dt;
        if (this.life <= 0) return 'TIMEOUT';

        this.mesh.position.add(this.velocity.clone().multiplyScalar(dt));

        // Collision Check (Simple distance)
        for (let enemy of enemies) {
            if (this.mesh.position.distanceTo(enemy.mesh.position) < 1.0) {
                return 'HIT';
            }
        }
        
        return 'FLYING';
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