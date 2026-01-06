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
        // Detailed Magical Girl Model Construction
        const skinMat = new THREE.MeshStandardMaterial({ color: 0xffe0bd, roughness: 0.5 }); // Pale skin
        const dressMat = new THREE.MeshStandardMaterial({ color: 0x3366cc, roughness: 0.7 }); // Blue dress
        const accentMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3 }); // White accents
        const hairMat = new THREE.MeshStandardMaterial({ color: 0xffd700, roughness: 0.6 }); // Blonde hair
        const staffMat = new THREE.MeshStandardMaterial({ color: 0x8d6e63 });
        const gemMat = new THREE.MeshStandardMaterial({ color: 0xff0055, emissive: 0xaa0033, emissiveIntensity: 0.5 });

        // Container for bobbing animations
        this.model = new THREE.Group();
        this.mesh.add(this.model);

        // -- TORSO & DRESS --
        // Skirt (Cone-ish)
        const skirtGeo = new THREE.ConeGeometry(0.5, 0.8, 8, 1, true);
        const skirt = new THREE.Mesh(skirtGeo, dressMat);
        skirt.position.y = 0.4;
        skirt.castShadow = true;
        this.model.add(skirt);
        
        // Underskirt fill
        const skirtFill = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 0.1, 8), accentMat);
        skirtFill.position.y = -0.35;
        skirt.add(skirtFill);

        // Chest
        const chestGeo = new THREE.CylinderGeometry(0.25, 0.35, 0.5, 8);
        this.torso = new THREE.Mesh(chestGeo, accentMat);
        this.torso.position.y = 1.05;
        this.torso.castShadow = true;
        this.model.add(this.torso);

        // Vest/Top layer
        const vestGeo = new THREE.CylinderGeometry(0.26, 0.36, 0.3, 8);
        const vest = new THREE.Mesh(vestGeo, dressMat);
        vest.position.y = 0.05;
        this.torso.add(vest);

        // -- HEAD --
        const headGeo = new THREE.BoxGeometry(0.35, 0.4, 0.35); // Slightly anime box style
        // Round it a bit with subdivision logic or just standard box
        this.head = new THREE.Mesh(headGeo, skinMat);
        this.head.position.y = 1.6;
        this.head.castShadow = true;
        this.model.add(this.head);

        // Eyes (Simple planes)
        const eyeGeo = new THREE.PlaneGeometry(0.08, 0.1);
        const eyeMat = new THREE.MeshBasicMaterial({ color: 0x0044aa });
        const leftEye = new THREE.Mesh(eyeGeo, eyeMat);
        leftEye.position.set(-0.1, 0.05, 0.18);
        this.head.add(leftEye);
        const rightEye = new THREE.Mesh(eyeGeo, eyeMat);
        rightEye.position.set(0.1, 0.05, 0.18);
        this.head.add(rightEye);

        // -- HAIR --
        // Bangs
        const bangsGeo = new THREE.BoxGeometry(0.38, 0.15, 0.1);
        const bangs = new THREE.Mesh(bangsGeo, hairMat);
        bangs.position.set(0, 0.15, 0.18);
        this.head.add(bangs);
        
        // Back Hair (Long)
        const backHairGeo = new THREE.BoxGeometry(0.4, 0.8, 0.15);
        const backHair = new THREE.Mesh(backHairGeo, hairMat);
        backHair.position.set(0, -0.1, -0.15);
        backHair.rotation.x = 0.1; // Flare out slightly
        this.head.add(backHair);

        // Side tails
        const tailGeo = new THREE.BoxGeometry(0.1, 0.6, 0.1);
        const leftTail = new THREE.Mesh(tailGeo, hairMat);
        leftTail.position.set(-0.22, -0.1, 0);
        leftTail.rotation.z = 0.2;
        this.head.add(leftTail);
        
        const rightTail = new THREE.Mesh(tailGeo, hairMat);
        rightTail.position.set(0.22, -0.1, 0);
        rightTail.rotation.z = -0.2;
        this.head.add(rightTail);

        // -- ARMS --
        const armGeo = new THREE.CylinderGeometry(0.06, 0.06, 0.5);
        
        // Left Arm
        this.leftArm = new THREE.Group();
        this.leftArm.position.set(-0.35, 1.15, 0);
        const laMesh = new THREE.Mesh(armGeo, skinMat);
        laMesh.position.y = -0.2; // Pivot from shoulder
        laMesh.castShadow = true;
        this.leftArm.add(laMesh);
        // Sleeve
        const sleeveGeo = new THREE.CylinderGeometry(0.1, 0.15, 0.2);
        const laSleeve = new THREE.Mesh(sleeveGeo, dressMat);
        laSleeve.position.y = 0;
        this.leftArm.add(laSleeve);
        this.model.add(this.leftArm);

        // Right Arm (Holding Staff)
        this.rightArm = new THREE.Group();
        this.rightArm.position.set(0.35, 1.15, 0);
        const raMesh = new THREE.Mesh(armGeo, skinMat);
        raMesh.position.y = -0.2;
        raMesh.castShadow = true;
        this.rightArm.add(raMesh);
        const raSleeve = new THREE.Mesh(sleeveGeo, dressMat);
        raSleeve.position.y = 0;
        this.rightArm.add(raSleeve);
        this.model.add(this.rightArm);

        // -- STAFF --
        const staffStickGeo = new THREE.CylinderGeometry(0.03, 0.03, 1.8);
        this.staffMesh = new THREE.Mesh(staffStickGeo, staffMat);
        this.staffMesh.rotation.x = Math.PI / 2; // Perpendicular to arm
        this.staffMesh.position.set(0, -0.4, 0.5); // Hold in hand
        
        // Staff Head
        const staffTopGeo = new THREE.TorusGeometry(0.15, 0.03, 8, 16);
        const staffTop = new THREE.Mesh(staffTopGeo, accentMat); // Gold/White ring
        staffTop.position.y = 0.9;
        this.staffMesh.add(staffTop);

        const gemGeo = new THREE.OctahedronGeometry(0.08);
        const gem = new THREE.Mesh(gemGeo, gemMat);
        gem.position.y = 0.9;
        this.staffMesh.add(gem);

        this.rightArm.add(this.staffMesh);
        
        // Default pose
        this.rightArm.rotation.x = -0.5; // Angled slightly forward
        this.leftArm.rotation.z = 0.2;

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
            if(this.model) this.model.position.x = vibration;
            
            // Animate staff to point forward
            // Staff is child of rightArm.
            // Raise arm:
            if(this.rightArm) {
                const progress = 1 - (this.castState.timer / this.castState.maxTime);
                // Rotate arm forward (+1.5 is forward, -0.5 is default)
                // Previous -1.5 pointed backwards, +1.5 points forward
                this.rightArm.rotation.x = -0.5 + (2.0) * progress;
                
                // Rotate staff to align with arm (point forward)
                // Start PI/2 (Perpendicular). End PI (Aligned with Arm Forward).
                if(this.staffMesh) {
                    this.staffMesh.rotation.x = (Math.PI / 2) + (Math.PI / 2) * progress;
                }
            }

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
            const moveVec = new THREE.Vector3(inputs.x, 0, -inputs.y).normalize();
            
            // Rotate player to face movement
            const angle = Math.atan2(moveVec.x, moveVec.z);
            const targetQuat = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0), angle);
            this.mesh.quaternion.slerp(targetQuat, 0.2);

            // Move
            const moveAmount = moveVec.multiplyScalar(this.speed * dt);
            const nextPos = this.mesh.position.clone().add(moveAmount);

            this.mesh.position.copy(nextPos);

            // Bobbing animation for model group
            if(this.model) {
                const walkCycle = Date.now() * 0.015;
                this.model.position.y = Math.sin(walkCycle * 2) * 0.05;
                
                // Arm swing
                if (this.leftArm) this.leftArm.rotation.x = Math.sin(walkCycle) * 0.5;
                if (this.rightArm) this.rightArm.rotation.x = -0.5 + Math.sin(walkCycle + Math.PI) * 0.5;
            }
        } else {
             // Idle
             if(this.model) {
                 this.model.position.y = 0;
                 if (this.leftArm) this.leftArm.rotation.x = THREE.MathUtils.lerp(this.leftArm.rotation.x, 0, 0.1);
                 if (this.rightArm) this.rightArm.rotation.x = THREE.MathUtils.lerp(this.rightArm.rotation.x, -0.5, 0.1);
                 if (this.model) this.model.position.x = 0; // Reset vibration
             }
        }

        // Always clamp to terrain (even when not moving)
        if (world) {
            const groundH = world.getHeight(this.mesh.position.x, this.mesh.position.z);
            this.mesh.position.y = groundH;
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
        if (this.rightArm) this.rightArm.rotation.x = -0.5;
        if (this.staffMesh) this.staffMesh.rotation.x = Math.PI / 2;
    }

    getStaffTipWorldState() {
        // Staff is inside rightArm
        if (!this.staffMesh) return { position: this.mesh.position, quaternion: this.mesh.quaternion };

        // The staff geometry is a cylinder oriented along Y, but rotated X=90 in the arm (so it points forward relative to hand)
        // Wait, in loadAssets: this.staffMesh.rotation.x = Math.PI / 2;
        // So local Z is the length of the staff.
        
        // Actually, cylinder is Y-up by default. 
        // If I rotated it PI/2 around X, the local Y axis points along Parent's Z? No.
        // Rotated X=90 deg: The Cylinder's Y axis (top) points to Parent's Z (forward).
        // Cylinder top is +Y (local).
        
        const tipPos = new THREE.Vector3(0, 0.9, 0).applyMatrix4(this.staffMesh.matrixWorld);
        const handlePos = new THREE.Vector3(0, -0.9, 0).applyMatrix4(this.staffMesh.matrixWorld);
        
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