import * as THREE from 'three';

export class Player {
    constructor(scene, audioManager) {
        this.scene = scene;
        this.audioManager = audioManager;
        this.mesh = new THREE.Group();
        this.speed = 8;
        this.isMoving = false;
        this.aiControlled = true;
        
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
        
        this.targetRotation = null;
        this.navTarget = null;

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
        // 1. Hair Cap (Base layer to prevent bald spots)
        const capGeo = new THREE.BoxGeometry(0.37, 0.22, 0.37);
        const hairCap = new THREE.Mesh(capGeo, hairMat);
        hairCap.position.set(0, 0.1, 0); // Top of head
        this.head.add(hairCap);

        // 2. Bangs (More detailed)
        // Center Bangs
        const bangsCenterGeo = new THREE.BoxGeometry(0.14, 0.18, 0.05);
        const bangsCenter = new THREE.Mesh(bangsCenterGeo, hairMat);
        bangsCenter.position.set(0, 0.05, 0.18);
        this.head.add(bangsCenter);
        
        // Left Side Bang
        const bangsSideGeo = new THREE.BoxGeometry(0.12, 0.25, 0.05);
        const bangsLeft = new THREE.Mesh(bangsSideGeo, hairMat);
        bangsLeft.position.set(-0.13, 0.0, 0.18);
        bangsLeft.rotation.z = 0.1;
        this.head.add(bangsLeft);
        
        // Right Side Bang
        const bangsRight = new THREE.Mesh(bangsSideGeo, hairMat);
        bangsRight.position.set(0.13, 0.0, 0.18);
        bangsRight.rotation.z = -0.1;
        this.head.add(bangsRight);

        // 3. Side Locks (Framing the face)
        const sideLockGeo = new THREE.BoxGeometry(0.08, 0.45, 0.12);
        const leftLock = new THREE.Mesh(sideLockGeo, hairMat);
        leftLock.position.set(-0.19, -0.1, 0.12);
        this.head.add(leftLock);
        
        const rightLock = new THREE.Mesh(sideLockGeo, hairMat);
        rightLock.position.set(0.19, -0.1, 0.12);
        this.head.add(rightLock);

        // 4. Back Hair (Fuller)
        const backHairGeo = new THREE.BoxGeometry(0.42, 0.9, 0.2);
        const backHair = new THREE.Mesh(backHairGeo, hairMat);
        backHair.position.set(0, -0.2, -0.12);
        backHair.rotation.x = 0.15; 
        this.head.add(backHair);

        // 5. Twin Tails (More dynamic)
        const tailGeo = new THREE.BoxGeometry(0.12, 0.7, 0.12);
        
        const leftTail = new THREE.Mesh(tailGeo, hairMat);
        leftTail.position.set(-0.28, 0.1, -0.05);
        leftTail.rotation.z = 0.3;
        leftTail.rotation.x = 0.1;
        this.head.add(leftTail);
        
        const rightTail = new THREE.Mesh(tailGeo, hairMat);
        rightTail.position.set(0.28, 0.1, -0.05);
        rightTail.rotation.z = -0.3;
        rightTail.rotation.x = 0.1;
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

    takeDamage(amount, element) {
        // Resistance: Specific Element Spirit Level reduces damage from that element
        // Formula: Diminishing returns (100% / (100% + Spirit*5%))
        if (element && this.spirits[element]) {
            const factor = 1.0 / (1.0 + (this.spirits[element] * 0.05));
            amount *= factor;
        }

        // Earth provides flat physical/general mitigation (Defense)
        const defense = this.spirits.earth * 0.25;
        amount = Math.max(1, amount - defense);

        this.stats.hp -= Math.floor(amount);
    }

    gainXp(amount) {
        this.xp += amount;
        let leveled = false;
        while (this.xp >= this.nextLevelXp) {
            this.xp -= this.nextLevelXp;
            this.level++;
            this.nextLevelXp = Math.floor(this.nextLevelXp * 1.5);
            leveled = true;
        }
        return leveled;
    }

    regenMp(dt) {
        // Base regen + water bonus
        const rate = 0.5 + (this.spirits.water * 0.2);
        this.stats.mp = Math.min(this.stats.maxMp, this.stats.mp + rate * dt);
    }

    update(dt, inputs, world, boundaryCenter = null, boundaryRadius = 0, canMove = true) {
        this.regenMp(dt);

        // Update Location Name UI if world exists
        if (world && Math.random() < 0.05) { // Throttle
            const regionName = world.getRegionName(this.mesh.position.x, this.mesh.position.z);
            const el = document.getElementById('message-box');
            // Hacky way to show location without spamming UIManager, 
            // ideally UIManager should poll player/world.
            // Leaving for now.
        }

        // Handle Rotation (Allowed during cast for aiming adjustments)
        if (this.targetRotation && !this.isMoving) {
            this.mesh.quaternion.slerp(this.targetRotation, 10 * dt);
            if (this.mesh.quaternion.angleTo(this.targetRotation) < 0.01) {
                this.mesh.quaternion.copy(this.targetRotation);
                this.targetRotation = null;
            }
        }

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
                this.rightArm.rotation.x = -0.5 + (2.0) * progress;
                
                // Rotate staff to align with arm (point forward)
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
            this.navTarget = null;
        } else {
            // Check Input first (Joystick/WASD overrides Click-to-Move)
            if (inputs.x !== 0 || inputs.y !== 0) {
                this.isMoving = true;
                this.navTarget = null; 
            } else if (this.navTarget) {
                 this.isMoving = true;
            } else {
                this.isMoving = false;
            }
        }

        if (this.isMoving) {
            this.targetRotation = null; // User input overrides auto-turn

            let moveVec;

            if (this.navTarget) {
                const dist = this.mesh.position.distanceTo(this.navTarget);
                if (dist < 0.5) {
                    this.navTarget = null;
                    this.isMoving = false;
                    moveVec = new THREE.Vector3(0,0,0);
                } else {
                    moveVec = new THREE.Vector3().subVectors(this.navTarget, this.mesh.position).normalize();
                    moveVec.y = 0;
                }
            } else {
                // Inputs are now expected to be relative to camera (handled in Game.js) or raw
                // We assume Game.js passes world-relative direction if it's handling camera rotation, 
                // OR Game.js passes raw inputs and we handle it.
                // NOTE: Game.js will be updated to pass camera-relative inputs. 
                // So inputs.x/y is the final direction vector components.
                // Previously: new THREE.Vector3(inputs.x, 0, -inputs.y)
                // If Game.js transforms inputs, we can just use x/z directly from inputs if passed as such,
                // or keep using x/-y mapping if Game.js respects that convention.
                // Let's assume standard mapping: x is East, y is North (in 2D input space).
                // 3D world: x is East, -z is North.
                moveVec = new THREE.Vector3(inputs.x, 0, -inputs.y).normalize();
            }

            if (this.isMoving) {
                // Rotate player to face movement
                const angle = Math.atan2(moveVec.x, moveVec.z);
                const targetQuat = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0), angle);
                this.mesh.quaternion.slerp(targetQuat, 10 * dt);

                // Move
                const moveAmount = moveVec.multiplyScalar(this.speed * dt);
                const nextPos = this.mesh.position.clone().add(moveAmount);

                this.mesh.position.copy(nextPos);

                // Bobbing animation
                if(this.model) {
                    const walkCycle = Date.now() * 0.015;
                    this.model.position.y = Math.sin(walkCycle * 2) * 0.05;
                    
                    // Arm swing
                    if (this.leftArm) this.leftArm.rotation.x = Math.sin(walkCycle) * 0.5;
                    if (this.rightArm) this.rightArm.rotation.x = -0.5 + Math.sin(walkCycle + Math.PI) * 0.5;
                }
            }
        } else {
             // Idle
             // Rotation handled at top of update
             
             if(this.model) {
                 this.model.position.y = 0;
                 if (this.leftArm) this.leftArm.rotation.x = THREE.MathUtils.lerp(this.leftArm.rotation.x, 0, 0.1);
                 if (this.rightArm) this.rightArm.rotation.x = THREE.MathUtils.lerp(this.rightArm.rotation.x, -0.5, 0.1);
                 if (this.model) this.model.position.x = 0; // Reset vibration
             }
        }

        // Always clamp to terrain (even when not moving)
        if (world) {
            const x = this.mesh.position.x;
            const z = this.mesh.position.z;
            const groundH = world.getHeight(x, z);
            
            // Smooth vertical transition to prevent jagged snapping
            // But we must never clip BELOW.
            if (this.mesh.position.y < groundH) {
                 this.mesh.position.y = groundH;
            } else {
                 this.mesh.position.y = THREE.MathUtils.lerp(this.mesh.position.y, groundH, dt * 10);
            }
        }
    }

    smoothLookAt(quat) {
        this.targetRotation = quat;
    }

    faceTarget(pos) {
        const dummy = new THREE.Object3D();
        dummy.position.copy(this.mesh.position);
        dummy.lookAt(pos.x, this.mesh.position.y, pos.z);
        this.smoothLookAt(dummy.quaternion);
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