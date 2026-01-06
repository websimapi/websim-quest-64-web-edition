import * as THREE from 'three';

export class Player {
    constructor(scene, audioManager) {
        this.scene = scene;
        this.audioManager = audioManager;
        this.mesh = new THREE.Group();
        this.speed = 8;
        this.isMoving = false;
        
        this.spirits = {
            fire: 1,
            water: 1,
            earth: 1,
            wind: 1
        };

        this.xp = 0;
        this.nextLevelXp = 50;
        this.level = 1;

        this.stats = {
            hp: 55,
            maxHp: 55,
            mp: 24,
            maxMp: 24
        };
        
        this.castState = {
            active: false,
            timer: 0,
            maxTime: 0,
            onComplete: null
        };

        this.recalcStats();
    }

    async loadAssets() {
        const loader = new THREE.TextureLoader();
        const texture = await loader.loadAsync('brian_texture.png');
        texture.magFilter = THREE.NearestFilter;

        // Simple Brian Model
        const mat = new THREE.MeshStandardMaterial({ map: texture });
        const skinMat = new THREE.MeshStandardMaterial({ color: 0xffccaa });

        // Body
        const bodyGeo = new THREE.BoxGeometry(0.6, 0.8, 0.4);
        const body = new THREE.Mesh(bodyGeo, mat);
        body.position.y = 0.9;
        body.castShadow = true;

        // Head
        const headGeo = new THREE.BoxGeometry(0.4, 0.45, 0.45);
        const head = new THREE.Mesh(headGeo, skinMat);
        head.position.y = 1.6;
        
        // Hair (simple box on top)
        const hairGeo = new THREE.BoxGeometry(0.45, 0.2, 0.5);
        const hair = new THREE.Mesh(hairGeo, new THREE.MeshStandardMaterial({color: 0x5d4037}));
        hair.position.y = 0.3; // relative to head
        head.add(hair);

        // Staff
        const staffGeo = new THREE.CylinderGeometry(0.05, 0.05, 1.5);
        const staff = new THREE.Mesh(staffGeo, new THREE.MeshStandardMaterial({color: 0x8d6e63}));
        staff.position.set(0.4, 1.0, 0.3);
        staff.rotation.x = 0.5;

        this.mesh.add(body);
        this.mesh.add(head);
        this.mesh.add(staff);
        
        this.scene.add(this.mesh);
    }

    recalcStats() {
        this.stats.maxHp = 50 + (this.spirits.earth * 5);
        this.stats.maxMp = 20 + (this.spirits.water * 2) + (this.spirits.wind * 2);
        
        // Clamp current
        this.stats.hp = Math.min(this.stats.hp, this.stats.maxHp);
        this.stats.mp = Math.min(this.stats.mp, this.stats.maxMp);
    }

    gainXp(amount) {
        this.xp += amount;
        if (this.xp >= this.nextLevelXp) {
            this.xp -= this.nextLevelXp;
            this.level++;
            this.nextLevelXp = Math.floor(this.nextLevelXp * 1.5);
            return true; // Level Up
        }
        return false;
    }

    regenMp(dt) {
        // Base regen + water bonus
        const rate = 0.5 + (this.spirits.water * 0.2);
        this.stats.mp = Math.min(this.stats.maxMp, this.stats.mp + rate * dt);
    }

    update(dt, inputs, world, boundaryCenter = null, boundaryRadius = 0, canMove = true) {
        this.regenMp(dt);

        // Casting State logic
        if (this.castState.active) {
            this.castState.timer -= dt;
            
            // Animation for casting (shake)
            const vibration = Math.sin(Date.now() * 0.05) * 0.02;
            this.mesh.position.x += vibration;
            
            // Animate staff to point forward (from 0.5 to -PI/2)
            const progress = 1 - (this.castState.timer / this.castState.maxTime);
            this.mesh.children[2].rotation.x = 0.5 + (-1.57 - 0.5) * progress;

            if (this.castState.timer <= 0) {
                // Complete
                if (this.castState.onComplete) this.castState.onComplete();
                this.stopCasting();
            }
            
            this.isMoving = false;
            return; // Cannot move while casting
        }

        // Override movement if disabled
        if (!canMove) {
            this.isMoving = false;
        } else {
            this.isMoving = (inputs.x !== 0 || inputs.y !== 0);
        }

        if (this.isMoving) {
            // Calculate movement direction relative to camera
            // For now, inputs are absolute world directions (W = -Z)
            // But we want W = Forward (relative to character current facing or camera)
            // Simpler: Tank controls or Screen space. 
            // Let's implement Screen Space movement (Up on stick = Away from camera)
            
            // Assume Camera is roughly behind player usually, but let's just use raw input for simplicity with Fixed Camera angle
            const moveVec = new THREE.Vector3(inputs.x, 0, -inputs.y).normalize();
            
            // Rotate player to face movement
            const angle = Math.atan2(moveVec.x, moveVec.z);
            // Smooth turn
            const targetQuat = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0), angle);
            this.mesh.quaternion.slerp(targetQuat, 0.2);

            // Move
            const moveAmount = moveVec.multiplyScalar(this.speed * dt);
            const nextPos = this.mesh.position.clone().add(moveAmount);

            // Boundary Check (for combat)
            if (boundaryCenter) {
                const dist = nextPos.distanceTo(boundaryCenter);
                if (dist > boundaryRadius) {
                    // In combat, hitting the wall means nothing, or escape. 
                    // Quest 64 lets you run out to escape.
                    // For now, clamp to boundary
                    // Actually, let's allow escape logic in CombatSystem, here we just update pos
                }
            }

            this.mesh.position.copy(nextPos);

            // Terrain clamp
            if (world) {
                const groundH = world.getHeight(this.mesh.position.x, this.mesh.position.z);
                this.mesh.position.y = groundH;
            }

            // Bobbing animation
            this.mesh.children[0].position.y = 0.9 + Math.sin(Date.now() * 0.01) * 0.05;
        } else {
             this.mesh.children[0].position.y = 0.9;
        }
    }

    startCasting(spellConfig, onComplete) {
        this.castState.active = true;
        this.castState.maxTime = spellConfig.castTime || 1.0;
        this.castState.timer = this.castState.maxTime;
        this.castState.onComplete = onComplete;
        this.audioManager.playSfx('cast');
    }

    stopCasting() {
        this.castState.active = false;
        this.castState.onComplete = null;
        this.mesh.children[2].rotation.x = 0.5; // Reset staff
    }

    getStaffTipWorldState() {
        const staff = this.mesh.children[2];
        if (!staff) return { position: this.mesh.position, quaternion: this.mesh.quaternion };

        // Tip of the staff (local Y is length)
        const tipPos = new THREE.Vector3(0, 0.75, 0).applyMatrix4(staff.matrixWorld);
        
        // Handle of the staff for direction calculation
        const handlePos = new THREE.Vector3(0, -0.75, 0).applyMatrix4(staff.matrixWorld);
        
        // Orient a dummy object to look from handle to tip
        const dummy = new THREE.Object3D();
        dummy.position.copy(handlePos);
        dummy.lookAt(tipPos);

        return {
            position: tipPos,
            quaternion: dummy.quaternion
        };
    }
    
    // Legacy method for roaming instant cast (if needed)
    castSpell(element) {
         this.audioManager.playSfx('cast');
    }
}