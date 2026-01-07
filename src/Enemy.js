import * as THREE from 'three';

export class Enemy {
    constructor(scene, x, z, type = 'GOBLIN') {
        this.scene = scene;
        this.type = type;
        this.state = 'ROAM';
        
        // Stats defaults
        this.hp = 30;
        this.maxHp = 30;
        this.speed = 3;
        this.detectRadius = 15;
        this.yOffset = 0.7;
        
        // Configure Type
        let geo, color;
        
        switch (type) {
            case 'SLIME':
                this.hp = 20; this.maxHp = 20; this.speed = 2;
                this.element = 'water';
                this.xpValue = 15;
                geo = new THREE.SphereGeometry(0.6, 8, 6);
                geo.scale(1, 0.6, 1);
                color = 0x44ff44;
                this.yOffset = 0.4;
                break;
            case 'WOLF':
                this.hp = 25; this.maxHp = 25; this.speed = 6;
                this.element = 'wind';
                this.xpValue = 30;
                geo = new THREE.BoxGeometry(0.5, 0.5, 1.0);
                color = 0x555555;
                this.yOffset = 0.5;
                break;
            case 'GOLEM':
                this.hp = 80; this.maxHp = 80; this.speed = 1.5;
                this.element = 'earth';
                this.xpValue = 80;
                geo = new THREE.CylinderGeometry(0.6, 0.6, 1.2, 6);
                color = 0x6d4c41;
                this.yOffset = 0.6;
                this.detectRadius = 10;
                break;
            case 'SPIRIT':
                this.hp = 15; this.maxHp = 15; this.speed = 4;
                this.element = 'fire';
                this.xpValue = 25;
                geo = new THREE.OctahedronGeometry(0.5);
                color = 0x00ffff;
                this.yOffset = 1.5; // Flying
                break;
            default: // GOBLIN
                this.hp = 30; this.maxHp = 30; this.speed = 3;
                this.element = 'earth';
                this.xpValue = 20;
                geo = new THREE.DodecahedronGeometry(0.7);
                color = 0x882222;
                this.yOffset = 0.7;
                break;
        }

        this.roamOrigin = new THREE.Vector3(x, this.yOffset, z);
        this.roamRadius = 20;
        this.roamTarget = this.roamOrigin.clone();
        this.waitTime = 0;
        this.baseColor = color;

        const mat = new THREE.MeshStandardMaterial({ 
            map: null,
            color: color, 
            flatShading: true,
            roughness: 0.8
        });
        
        this.mesh = new THREE.Mesh(geo, mat);
        this.mesh.castShadow = true;
        this.mesh.position.copy(this.roamOrigin);
        
        this.scene.add(this.mesh);

        // Hitbox for easier selection
        const hitGeo = new THREE.CylinderGeometry(1.5, 1.5, 3, 8);
        const hitMat = new THREE.MeshBasicMaterial({ visible: true, transparent: true, opacity: 0, side: THREE.DoubleSide });
        const hitbox = new THREE.Mesh(hitGeo, hitMat);
        hitbox.userData = { isHitbox: true };
        this.mesh.add(hitbox);
        
        // Eye / Direction Indicator
        const eyeColor = type === 'SPIRIT' ? 0xff0000 : 0xffff00;
        const eye = new THREE.Mesh(new THREE.BoxGeometry(0.2,0.1,0.1), new THREE.MeshBasicMaterial({color: eyeColor}));
        eye.position.set(0, 0.2, 0.5); // Forward Z
        if(type === 'WOLF') eye.position.set(0, 0.2, 0.5);
        if(type === 'GOLEM') eye.position.set(0, 0.4, 0.6);
        this.mesh.add(eye);
    }

    setTexture(texture) {
        this.mesh.material.map = texture;
        this.mesh.material.needsUpdate = true;
    }

    update(dt, playerPos, world) {
        if (!this.mesh) return;

        if (this.state === 'BATTLE') {
            // Battle Logic now delegated to battleUpdate called by CombatSystem
            return;
        }

        // Check distance to player
        const distToPlayer = this.mesh.position.distanceTo(playerPos);
        
        if (distToPlayer < this.detectRadius) {
            this.state = 'CHASE';
        } else if (distToPlayer > this.detectRadius * 1.5) {
            this.state = 'ROAM';
        }

        if (this.state === 'CHASE') {
            const dir = new THREE.Vector3().subVectors(playerPos, this.mesh.position).normalize();
            dir.y = 0;
            this.mesh.position.add(dir.multiplyScalar(this.speed * dt));
            this.mesh.lookAt(playerPos);
        } else {
            // Roaming logic
            if (this.waitTime > 0) {
                this.waitTime -= dt;
            } else {
                const dist = this.mesh.position.distanceTo(this.roamTarget);
                if (dist < 1) {
                    // Pick new target
                    const angle = Math.random() * Math.PI * 2;
                    const r = Math.random() * this.roamRadius;
                    this.roamTarget.set(
                        this.roamOrigin.x + Math.cos(angle) * r,
                        this.mesh.position.y,
                        this.roamOrigin.z + Math.sin(angle) * r
                    );
                    this.waitTime = 1 + Math.random() * 2;
                } else {
                    const dir = new THREE.Vector3().subVectors(this.roamTarget, this.mesh.position).normalize();
                    this.mesh.position.add(dir.multiplyScalar((this.speed * 0.5) * dt));
                    this.mesh.lookAt(this.roamTarget);
                }
            }
        }

        // Terrain height
        if (world) {
            const h = world.getHeight(this.mesh.position.x, this.mesh.position.z);
            this.mesh.position.y = h + this.yOffset;
            
            // Bobbing for spirits
            if (this.type === 'SPIRIT') {
                this.mesh.position.y += Math.sin(Date.now() * 0.003) * 0.2;
            }
        }
    }

    takeDamage(amount) {
        this.hp -= amount;
        
        // Flash white
        this.mesh.material.color.setHex(0xffffff);
        setTimeout(() => {
            if(this.mesh) this.mesh.material.color.setHex(this.baseColor);
        }, 100);

        if (this.hp <= 0) {
            this.dispose();
            return true;
        }
        return false;
    }

    highlight() {
        if (!this.mesh) return;
        this.mesh.material.color.setHex(0xffff00);
        setTimeout(() => {
            if(this.mesh) this.mesh.material.color.setHex(this.baseColor);
        }, 200);
    }

    resetBattleState() {
        this.turnPhase = 0;
        this.turnTimer = 0;
    }

    prepareTurn() {
        this.turnPhase = 'MOVE';
        this.turnTimer = 1.0;
        this.hasHit = false;
    }

    executeTurn(dt, player, world) {
        if (!this.mesh || !player.mesh) return true;

        const playerPos = player.mesh.position;
        const dist = this.mesh.position.distanceTo(playerPos);
        const dir = new THREE.Vector3().subVectors(playerPos, this.mesh.position).normalize();
        dir.y = 0;

        // Base color restoration helper
        const resetColor = () => {
            if (this.mesh) this.mesh.material.color.setHex(this.baseColor);
        };

        switch (this.turnPhase) {
            case 'MOVE':
                this.mesh.lookAt(playerPos);
                
                // Different movement goals
                let stopDist = 3.0;
                if (this.type === 'SPIRIT') stopDist = 8.0; // Stay ranged
                if (this.type === 'GOLEM') stopDist = 4.0; // AoE range

                if (dist > stopDist) {
                    this.mesh.position.add(dir.multiplyScalar(this.speed * dt));
                    if (world) this.mesh.position.y = world.getHeight(this.mesh.position.x, this.mesh.position.z) + this.yOffset;
                }
                
                this.turnTimer -= dt;
                if (this.turnTimer <= 0) {
                    this.turnPhase = 'ATTACK_WARN';
                    this.turnTimer = (this.type === 'GOLEM') ? 1.5 : 0.5; // Longer telegraph for Golem
                }
                break;

            case 'ATTACK_WARN':
                // Flash Warning
                const color = (Date.now() % 100 < 50) ? 0xff0000 : 0xffffff;
                this.mesh.material.color.setHex(color);
                
                this.turnTimer -= dt;
                if (this.turnTimer <= 0) {
                    this.turnPhase = 'ATTACK_EXEC';
                    this.turnTimer = 0.5;
                    this.mesh.material.color.setHex(0xffffff);
                }
                break;

            case 'ATTACK_EXEC':
                let damage = 0;
                let hit = false;
                
                if (this.type === 'GOLEM') {
                    // AoE Slam - No movement, just radius check
                    if (dist < 6.0) { // Large radius
                        damage = 25;
                        hit = true;
                    }
                    // Visual shake
                    this.mesh.position.y += Math.sin(Date.now() * 0.5) * 0.1;
                } 
                else if (this.type === 'SPIRIT') {
                    // Ranged zap
                    if (dist < 12.0) {
                        damage = 10;
                        hit = true;
                    }
                } 
                else {
                    // Melee Dash (Goblin, Wolf, Slime)
                    const dashSpeed = this.speed * 4;
                    this.mesh.position.add(dir.multiplyScalar(dashSpeed * dt));
                    if (world) this.mesh.position.y = world.getHeight(this.mesh.position.x, this.mesh.position.z) + this.yOffset;

                    if (dist < 2.0) {
                        damage = (this.type === 'WOLF') ? 12 : 8;
                        hit = true;
                        // Bounce player
                        const bounce = dir.clone().multiplyScalar(3.0);
                        player.mesh.position.add(bounce);
                    }
                }

                if (hit && !this.hasHit) {
                    player.takeDamage(damage, this.element);
                    this.hasHit = true; // Ensure one hit per turn
                }

                this.turnTimer -= dt;
                if (this.turnTimer <= 0) {
                    this.turnPhase = 'RETURN';
                    this.turnTimer = 0.5;
                    this.hasHit = false; // Reset for next time
                }
                break;

            case 'RETURN':
                resetColor();
                // Melee units back off
                if (this.type !== 'GOLEM' && this.type !== 'SPIRIT') {
                    this.mesh.position.sub(dir.multiplyScalar(this.speed * dt));
                    if (world) this.mesh.position.y = world.getHeight(this.mesh.position.x, this.mesh.position.z) + this.yOffset;
                }
                
                this.turnTimer -= dt;
                if (this.turnTimer <= 0) {
                    return true;
                }
                break;
        }

        return false;
    }

    dispose() {
        if (this.mesh) {
            this.scene.remove(this.mesh);
            if (this.mesh.geometry) this.mesh.geometry.dispose();
            if (this.mesh.material) this.mesh.material.dispose();
            this.mesh = null;
        }
    }
}