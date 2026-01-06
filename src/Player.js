import * as THREE from 'three';

export class Player {
    constructor(scene, audioManager) {
        this.scene = scene;
        this.audioManager = audioManager;
        this.mesh = new THREE.Group();
        this.speed = 8;
        this.isMoving = false;
        
        this.stats = {
            hp: 50,
            maxHp: 50,
            mp: 20,
            maxMp: 20
        };
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

    update(dt, inputs, world, boundaryCenter = null, boundaryRadius = 0) {
        this.isMoving = (inputs.x !== 0 || inputs.y !== 0);

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

    castSpell(element, targetPos) {
        // Visuals handled by CombatSystem usually, but player initiates animation
        this.audioManager.playSfx('cast');
        
        // Simple animation: Raise staff
        const staff = this.mesh.children[2];
        const originalRot = staff.rotation.x;
        
        // Tween-like animation manually
        let t = 0;
        const animateCast = () => {
            t += 0.1;
            staff.rotation.x = originalRot - Math.sin(t) * 1.0;
            if (t < Math.PI) requestAnimationFrame(animateCast);
            else staff.rotation.x = originalRot;
        };
        animateCast();
    }
}