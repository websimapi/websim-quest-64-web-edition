import * as THREE from 'three';

export class Enemy {
    constructor(scene) {
        this.scene = scene;
        this.hp = 30;
        this.speed = 2;
        
        // Simple geometry for enemy
        const geo = new THREE.DodecahedronGeometry(0.7);
        const mat = new THREE.MeshStandardMaterial({ color: 0x882222, flatShading: true });
        this.mesh = new THREE.Mesh(geo, mat);
        this.mesh.castShadow = true;
        this.mesh.position.y = 0.7;
        
        this.scene.add(this.mesh);
    }

    update(dt, playerPos) {
        // Simple follow AI
        const dir = new THREE.Vector3().subVectors(playerPos, this.mesh.position).normalize();
        dir.y = 0; // Stay on plane
        
        this.mesh.position.add(dir.multiplyScalar(this.speed * dt));
        this.mesh.rotation.x += dt * 2;
        this.mesh.rotation.y += dt * 2;
    }

    takeDamage(amount) {
        this.hp -= amount;
        
        // Flash white
        const oldColor = this.mesh.material.color.getHex();
        this.mesh.material.color.setHex(0xffffff);
        setTimeout(() => {
            if(this.mesh) this.mesh.material.color.setHex(oldColor);
        }, 100);

        if (this.hp <= 0) {
            this.dispose();
            return true;
        }
        return false;
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