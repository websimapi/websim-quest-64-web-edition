import * as THREE from 'three';

export class Enemy {
    constructor(scene, x, z, type = 'GOBLIN', level = 1) {
        this.scene = scene;
        this.type = type;
        this.level = level;
        this.state = 'ROAM';
        
        // Stats defaults
        this.baseHp = 30;
        this.speed = 3;
        this.detectRadius = 15;
        this.yOffset = 0.7;
        this.baseDamage = 5;
        this.isAquatic = false;
        
        // Configure Type
        let geo, color;
        
        switch (type) {
            case 'SLIME':
                this.baseHp = 20; this.speed = 2; this.baseDamage = 4;
                this.element = 'water';
                this.baseXp = 15;
                geo = new THREE.SphereGeometry(0.6, 8, 6);
                geo.scale(1, 0.6, 1);
                color = 0x44ff44;
                this.yOffset = 0.4;
                break;
            case 'SAND_SLIME':
                this.baseHp = 25; this.speed = 2.5; this.baseDamage = 6;
                this.element = 'earth';
                this.baseXp = 20;
                geo = new THREE.SphereGeometry(0.6, 8, 6);
                geo.scale(1, 0.6, 1);
                color = 0xeebb44; // Sand color
                this.yOffset = 0.4;
                break;
            case 'WATER_SLIME':
                this.baseHp = 25; this.speed = 3.0; this.baseDamage = 5;
                this.element = 'water';
                this.baseXp = 20;
                geo = new THREE.SphereGeometry(0.6, 8, 6);
                geo.scale(1, 0.6, 1);
                color = 0x0088ff;
                this.yOffset = -0.2; // Submerged partially
                this.isAquatic = true;
                break;
            case 'WOLF':
                this.baseHp = 25; this.speed = 6; this.baseDamage = 8;
                this.element = 'wind';
                this.baseXp = 30;
                geo = new THREE.BoxGeometry(0.5, 0.5, 1.0);
                color = 0x555555;
                this.yOffset = 0.5;
                break;
            case 'SNOW_WOLF':
                this.baseHp = 40; this.speed = 7; this.baseDamage = 12;
                this.element = 'water'; // Ice
                this.baseXp = 50;
                geo = new THREE.BoxGeometry(0.6, 0.6, 1.2);
                color = 0xddeeff;
                this.yOffset = 0.6;
                break;
            case 'GOLEM':
                this.baseHp = 80; this.speed = 1.5; this.baseDamage = 15;
                this.element = 'earth';
                this.baseXp = 80;
                geo = new THREE.CylinderGeometry(0.6, 0.6, 1.2, 6);
                color = 0x6d4c41;
                this.yOffset = 0.6;
                this.detectRadius = 10;
                break;
            case 'MAGMA_GOLEM':
                this.baseHp = 150; this.speed = 2.0; this.baseDamage = 25;
                this.element = 'fire';
                this.baseXp = 200;
                geo = new THREE.CylinderGeometry(0.8, 0.8, 1.5, 6);
                color = 0x330000;
                this.yOffset = 0.8;
                this.detectRadius = 12;
                break;
            case 'SPIRIT':
                this.baseHp = 15; this.speed = 4; this.baseDamage = 6;
                this.element = 'fire';
                this.baseXp = 25;
                geo = new THREE.OctahedronGeometry(0.5);
                color = 0x00ffff;
                this.yOffset = 1.5; // Flying
                break;
            case 'ICE_SPIRIT':
                this.baseHp = 35; this.speed = 5; this.baseDamage = 10;
                this.element = 'water';
                this.baseXp = 60;
                geo = new THREE.OctahedronGeometry(0.6);
                color = 0xaaddff;
                this.yOffset = 1.8;
                break;
            case 'SERPENT':
                this.baseHp = 60; this.speed = 5; this.baseDamage = 10;
                this.element = 'water';
                this.baseXp = 70;
                // Approximated serpent shape
                geo = new THREE.CylinderGeometry(0.3, 0.2, 2.0, 8);
                geo.rotateX(Math.PI/2); // Align Z
                color = 0x006644;
                this.yOffset = -0.5; // Swimming deep
                this.isAquatic = true;
                break;
            default: // GOBLIN
                this.baseHp = 30; this.speed = 3; this.baseDamage = 5;
                this.element = 'earth';
                this.baseXp = 20;
                geo = new THREE.DodecahedronGeometry(0.7);
                color = 0x882222;
                this.yOffset = 0.7;
                break;
        }

        // Apply Level Scaling
        const scale = 1 + ((level - 1) * 0.2); // +20% stats per level
        this.maxHp = Math.floor(this.baseHp * scale);
        this.hp = this.maxHp;
        this.damage = Math.floor(this.baseDamage * scale);
        this.xpValue = Math.floor((this.baseXp || 10) * (1 + (level - 1) * 0.5));
        
        // Scale size slightly
        const sizeScale = 1.0 + Math.min(0.5, (level - 1) * 0.05);
        
        this.lastPosition = new THREE.Vector3(x, this.yOffset, z);
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
        this.mesh.scale.setScalar(sizeScale);

        // Add emissive glow for Magma Golem
        if (type === 'MAGMA_GOLEM') {
            mat.emissive.setHex(0xff3300);
            mat.emissiveIntensity = 0.5;
        }

        // Special visual parts for Serpent
        if (type === 'SERPENT') {
             // Add dorsal fins
             const finGeo = new THREE.BufferGeometry();
             const vertices = new Float32Array([
                 0, 0.3, 0.5,
                 0, 0.8, 0,
                 0, 0.3, -0.5
             ]);
             finGeo.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
             const fin = new THREE.Mesh(finGeo, new THREE.MeshBasicMaterial({color: 0x00ff00, side: THREE.DoubleSide}));
             this.mesh.add(fin);
        }
        
        this.scene.add(this.mesh);

        // Hitbox for easier selection
        const hitGeo = new THREE.CylinderGeometry(1.5, 1.5, 3, 8);
        const hitMat = new THREE.MeshBasicMaterial({ 
            visible: true, 
            transparent: true, 
            opacity: 0, 
            side: THREE.DoubleSide,
            depthWrite: false
        });
        const hitbox = new THREE.Mesh(hitGeo, hitMat);
        hitbox.userData = { isHitbox: true };
        this.mesh.add(hitbox);
        
        // Eye / Direction Indicator
        const eyeColor = type === 'SPIRIT' ? 0xff0000 : 0xffff00;
        const eye = new THREE.Mesh(new THREE.BoxGeometry(0.2,0.1,0.1), new THREE.MeshBasicMaterial({color: eyeColor}));
        eye.position.set(0, 0.2, 0.5); // Forward Z
        if(type === 'WOLF') eye.position.set(0, 0.2, 0.5);
        if(type === 'GOLEM') eye.position.set(0, 0.4, 0.6);
        if(type === 'SERPENT') eye.position.set(0, 0.3, 1.0);
        this.mesh.add(eye);
    }

    setTexture(texture) {
        this.mesh.material.map = texture;
        this.mesh.material.needsUpdate = true;
    }

    update(dt, playerPos, world) {
        if (!this.mesh) return;
        
        // Update stored position before we move
        this.lastPosition.copy(this.mesh.position);

        // Ensure Y is correct
        if (world) {
            let targetY = 0;
            const h = world.getHeight(this.mesh.position.x, this.mesh.position.z);
            
            if (this.isAquatic) {
                const waterLevel = 1.0;
                targetY = Math.max(h, waterLevel) + this.yOffset;
                
                // If terrain is above water, slide up to terrain
                if (h > waterLevel) targetY = h + 0.5; 
            } else {
                targetY = h + this.yOffset;
            }

            if (this.type === 'SPIRIT' || this.type === 'ICE_SPIRIT') {
                 // Flying units bob
                 this.mesh.position.y = targetY + Math.sin(Date.now() * 0.003) * 0.5;
            } else {
                 this.mesh.position.y = THREE.MathUtils.lerp(this.mesh.position.y, targetY, dt * 10);
            }
        }

        // Animate visuals
        this.animate(dt, this.state === 'CHASE' || (this.waitTime <= 0 && this.state === 'ROAM'));

        if (this.state === 'BATTLE') {
            return;
        }

        // Check distance to player
        const distToPlayer = this.mesh.position.distanceTo(playerPos);
        
        if (distToPlayer < this.detectRadius) {
            this.state = 'CHASE';
        } else if (distToPlayer > this.detectRadius * 1.5) {
            this.state = 'ROAM';
        }

        let isMoving = false;

        if (this.state === 'CHASE') {
            const dir = new THREE.Vector3().subVectors(playerPos, this.mesh.position).normalize();
            dir.y = 0;
            this.mesh.position.add(dir.multiplyScalar(this.speed * dt));
            this.mesh.lookAt(playerPos);
            isMoving = true;
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
                    isMoving = true;
                }
            }
        }
    }

    animate(dt, isMoving) {
        const t = Date.now() * 0.001;
        
        // Reset scale defaults
        // this.mesh.scale.setScalar(1.0); // handled by base scale
        
        if (this.type.includes('SLIME')) {
            // Squash/Stretch
            const freq = isMoving ? 15 : 5;
            const amp = isMoving ? 0.2 : 0.05;
            const s = 1.0 + Math.sin(t * freq) * amp;
            
            // Preserve volume roughly
            this.mesh.scale.set(1/Math.sqrt(s), s, 1/Math.sqrt(s));
            // Apply base size scale on top if needed, but here we assume base is 1 relative to animation
        }
        else if (this.type === 'GOBLIN' || this.type.includes('WOLF')) {
            // Hop / Waddle
            if (isMoving) {
                const hop = Math.abs(Math.sin(t * 12));
                this.mesh.rotation.z = Math.sin(t * 12) * 0.1; // Waddle
                this.mesh.position.y += hop * 0.2; // Hop up
            } else {
                this.mesh.rotation.z = THREE.MathUtils.lerp(this.mesh.rotation.z, 0, dt * 5);
                this.mesh.scale.y = 1.0 + Math.sin(t * 3) * 0.02; // Breathe
            }
        }
        else if (this.type.includes('GOLEM')) {
            // Heavy stomp walk
            if (isMoving) {
                this.mesh.rotation.z = Math.sin(t * 5) * 0.1;
                this.mesh.rotation.x = Math.abs(Math.cos(t * 5)) * 0.1; // Lurch forward
            }
        }
        else if (this.type === 'SERPENT') {
            // Swim undulation
            this.mesh.position.y += Math.sin(t * 3) * 0.1;
            this.mesh.rotation.z = Math.sin(t * 5) * 0.2; // Roll
            this.mesh.rotation.y += Math.sin(t * 2) * 0.01; // Meander yaw
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
                
                if (this.type === 'GOLEM' || this.type === 'MAGMA_GOLEM') {
                    // AoE Slam - No movement, just radius check
                    const radius = (this.type === 'MAGMA_GOLEM') ? 8.0 : 6.0;
                    if (dist < radius) { 
                        damage = this.damage * 1.5; // Heavy hit
                        hit = true;
                    }
                    // Visual shake
                    this.mesh.position.y += Math.sin(Date.now() * 0.5) * 0.1;
                } 
                else if (this.type === 'SPIRIT' || this.type === 'ICE_SPIRIT' || this.type === 'SERPENT') {
                    // Ranged zap / Water Spit
                    const range = (this.type === 'SERPENT') ? 10.0 : 14.0;
                    if (dist < range) {
                        damage = this.damage;
                        hit = true;
                        
                        // Visual Lunge for serpent
                        if (this.type === 'SERPENT') {
                            this.mesh.position.add(dir.multiplyScalar(5.0 * dt));
                        }
                    }
                } 
                else {
                    // Melee Dash (Goblin, Wolf, Slime, etc)
                    const dashSpeed = this.speed * 4;
                    this.mesh.position.add(dir.multiplyScalar(dashSpeed * dt));
                    
                    // Maintain height logic
                    if (world) {
                        if (this.isAquatic) {
                            this.mesh.position.y = Math.max(world.getHeight(this.mesh.position.x, this.mesh.position.z), 1.0) + this.yOffset;
                        } else {
                            this.mesh.position.y = world.getHeight(this.mesh.position.x, this.mesh.position.z) + this.yOffset;
                        }
                    }

                    if (dist < 2.5) {
                        damage = this.damage;
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

    getDrop() {
        const roll = Math.random();
        
        // Default Drop Table
        // 30% chance for Herb
        // 15% chance for HP Potion
        // 15% chance for MP Potion
        // 1% chance for Elixir
        
        if (roll < 0.01) return 'ELIXIR';
        if (roll < 0.16) return 'MP_POTION';
        if (roll < 0.31) return 'HP_POTION';
        if (roll < 0.61) return 'HERB';
        
        return null;
    }

    dispose() {
        if (this.mesh) {
            this.lastPosition.copy(this.mesh.position); // Final save
            this.scene.remove(this.mesh);
            if (this.mesh.geometry) this.mesh.geometry.dispose();
            if (this.mesh.material) this.mesh.material.dispose();
            this.mesh = null;
        }
    }
}