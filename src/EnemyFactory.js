import * as THREE from 'three';

export const EnemyFactory = {
    getDefinition(type) {
        const def = {
            baseHp: 30, speed: 3, detectRadius: 15, yOffset: 0.7,
            baseDamage: 5, isAquatic: false, element: 'earth', baseXp: 20,
            color: 0x882222, animStyle: 'HOP',
            moves: [{ type: 'MELEE', name: 'Attack', power: 1.0, range: 2.5 }],
            createGeo: () => new THREE.DodecahedronGeometry(0.7)
        };

        switch (type) {
            case 'SLIME':
                return { ...def, 
                    baseHp: 20, speed: 2, baseDamage: 4, element: 'water', baseXp: 15, yOffset: 0.4, 
                    color: 0x44ff44, animStyle: 'SQUASH', 
                    moves: [
                        { type: 'MELEE', name: 'Tackle', power: 1.0, range: 2.0 },
                        { type: 'RANGED', name: 'Spit', power: 0.8, range: 10.0, projectile: true }
                    ],
                    createGeo: () => { const g = new THREE.SphereGeometry(0.6, 8, 6); g.scale(1, 0.6, 1); return g; } 
                };
            case 'SAND_SLIME':
                return { ...def, 
                    baseHp: 25, speed: 2.5, baseDamage: 6, element: 'earth', baseXp: 20, yOffset: 0.4, 
                    color: 0xeebb44, animStyle: 'SQUASH', 
                    moves: [
                        { type: 'MELEE', name: 'Tackle', power: 1.0, range: 2.0 },
                        { type: 'AOE', name: 'Quake', power: 1.2, range: 0, radius: 5.0 }
                    ],
                    createGeo: () => { const g = new THREE.SphereGeometry(0.6, 8, 6); g.scale(1, 0.6, 1); return g; } 
                };
            case 'WATER_SLIME':
                return { ...def, 
                    baseHp: 25, speed: 3.0, baseDamage: 5, element: 'water', baseXp: 20, yOffset: -0.2, 
                    color: 0x0088ff, isAquatic: true, animStyle: 'SQUASH', 
                    moves: [
                        { type: 'MELEE', name: 'Splash', power: 1.0, range: 2.0 },
                        { type: 'HEAL', name: 'Regen', power: 5, range: 0 }
                    ],
                    createGeo: () => { const g = new THREE.SphereGeometry(0.6, 8, 6); g.scale(1, 0.6, 1); return g; } 
                };
            case 'WOLF':
                return { ...def, 
                    baseHp: 25, speed: 6, baseDamage: 8, element: 'wind', baseXp: 30, yOffset: 0.5, 
                    color: 0x555555, animStyle: 'WALK', 
                    moves: [
                        { type: 'MELEE', name: 'Bite', power: 1.0, range: 2.0 },
                        { type: 'DASH', name: 'Lunge', power: 1.5, range: 6.0 }
                    ],
                    createGeo: () => new THREE.BoxGeometry(0.5, 0.5, 1.0) 
                };
            case 'SNOW_WOLF':
                return { ...def, 
                    baseHp: 40, speed: 7, baseDamage: 12, element: 'water', baseXp: 50, yOffset: 0.6, 
                    color: 0xddeeff, animStyle: 'WALK', 
                    moves: [
                        { type: 'MELEE', name: 'Frost Bite', power: 1.0, range: 2.0 },
                        { type: 'RANGED', name: 'Ice Breath', power: 0.8, range: 8.0, projectile: true }
                    ],
                    createGeo: () => new THREE.BoxGeometry(0.6, 0.6, 1.2) 
                };
            case 'GOLEM':
                return { ...def, 
                    baseHp: 80, speed: 1.5, baseDamage: 15, element: 'earth', baseXp: 80, yOffset: 1.2, 
                    color: 0x6d4c41, detectRadius: 10, animStyle: 'WALK_HEAVY', 
                    moves: [
                        { type: 'MELEE', name: 'Punch', power: 1.0, range: 3.0 },
                        { type: 'AOE', name: 'Smash', power: 1.5, range: 0, radius: 6.0 }
                    ],
                    createGeo: () => new THREE.CylinderGeometry(0.6, 0.5, 1.0, 6) 
                };
            case 'MAGMA_GOLEM':
                return { ...def, 
                    baseHp: 150, speed: 2.0, baseDamage: 25, element: 'fire', baseXp: 200, yOffset: 1.5, 
                    color: 0x330000, detectRadius: 12, animStyle: 'WALK_HEAVY', 
                    moves: [
                        { type: 'MELEE', name: 'Crush', power: 1.2, range: 3.0 },
                        { type: 'AOE', name: 'Eruption', power: 2.0, range: 0, radius: 8.0 },
                        { type: 'RANGED', name: 'Magma Rock', power: 1.0, range: 15.0, projectile: true }
                    ],
                    createGeo: () => new THREE.CylinderGeometry(0.8, 0.7, 1.2, 6) 
                };
            case 'SPIRIT':
                return { ...def, 
                    baseHp: 15, speed: 4, baseDamage: 6, element: 'fire', baseXp: 25, yOffset: 1.5, 
                    color: 0x00ffff, animStyle: 'FLOAT', 
                    moves: [
                        { type: 'RANGED', name: 'Firebolt', power: 1.0, range: 12.0, projectile: true },
                        { type: 'DASH', name: 'Flyby', power: 0.8, range: 6.0 }
                    ],
                    createGeo: () => new THREE.OctahedronGeometry(0.5) 
                };
            case 'ICE_SPIRIT':
                return { ...def, 
                    baseHp: 35, speed: 5, baseDamage: 10, element: 'water', baseXp: 60, yOffset: 1.8, 
                    color: 0xaaddff, animStyle: 'FLOAT', 
                    moves: [
                        { type: 'RANGED', name: 'Ice Shard', power: 1.0, range: 12.0, projectile: true },
                        { type: 'HEAL', name: 'Chill Heal', power: 10, range: 0 }
                    ],
                    createGeo: () => new THREE.OctahedronGeometry(0.6) 
                };
            case 'SERPENT':
                return { ...def, 
                    baseHp: 60, speed: 5, baseDamage: 10, element: 'water', baseXp: 70, yOffset: -0.5, 
                    color: 0x006644, isAquatic: true, animStyle: 'SWIM', 
                    moves: [
                        { type: 'RANGED', name: 'Spit', power: 1.0, range: 10.0, projectile: true },
                        { type: 'DASH', name: 'Bite', power: 1.2, range: 6.0 }
                    ],
                    createGeo: () => { const g = new THREE.CylinderGeometry(0.3, 0.2, 2.0, 8); g.rotateX(Math.PI/2); return g; } 
                };
            case 'GOBLIN': 
            default:
                return { ...def, 
                    baseHp: 30, speed: 4, baseDamage: 5, element: 'earth', baseXp: 20, yOffset: 0.7, 
                    color: 0x882222, animStyle: 'WALK',
                    moves: [
                         { type: 'MELEE', name: 'Club', power: 1.0, range: 2.0 },
                         { type: 'RANGED', name: 'Stone', power: 0.8, range: 10.0, projectile: true }
                    ],
                    createGeo: () => new THREE.CylinderGeometry(0.3, 0.3, 0.8, 6)
                };
        }
    },

    createMesh(type, def, level) {
        const sizeScale = 1.0 + Math.min(0.5, (level - 1) * 0.05);
        const geo = def.createGeo();
        
        const mat = new THREE.MeshStandardMaterial({ 
            map: null,
            color: def.color, 
            flatShading: true,
            roughness: 0.8
        });
        
        if (type === 'MAGMA_GOLEM') {
            mat.emissive.setHex(0xff3300);
            mat.emissiveIntensity = 0.5;
        }

        const mesh = new THREE.Mesh(geo, mat);
        mesh.castShadow = true;
        mesh.scale.setScalar(sizeScale);

        // Special visual parts
        if (type === 'SERPENT') {
             const finGeo = new THREE.BufferGeometry();
             const vertices = new Float32Array([0, 0.3, 0.5, 0, 0.8, 0, 0, 0.3, -0.5]);
             finGeo.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
             const fin = new THREE.Mesh(finGeo, new THREE.MeshBasicMaterial({color: 0x00ff00, side: THREE.DoubleSide}));
             mesh.add(fin);
        }

        // --- Limbs & Features ---
        if (type.includes('WOLF')) {
            // 4 Legs
            const legGeo = new THREE.BoxGeometry(0.15, 0.4, 0.15);
            const positions = [
                {x:-0.2, y:-0.3, z:0.3}, {x:0.2, y:-0.3, z:0.3}, // Front
                {x:-0.2, y:-0.3, z:-0.3}, {x:0.2, y:-0.3, z:-0.3} // Back
            ];
            positions.forEach((p, i) => {
                const leg = new THREE.Mesh(legGeo, mat);
                leg.position.set(p.x, p.y, p.z);
                leg.name = `leg${i}`;
                mesh.add(leg);
            });
            // Tail
            const tail = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.4, 0.1), mat);
            tail.position.set(0, 0, -0.6);
            tail.rotation.x = 0.5;
            tail.name = 'tail';
            mesh.add(tail);
        } 
        else if (type.includes('GOLEM') || type.includes('GOBLIN')) {
            // Humanoid: 2 Legs, 2 Arms
            const scale = type.includes('GOLEM') ? 0.2 : 0.1;
            const legGeo = new THREE.BoxGeometry(scale, 0.4, scale);
            const armGeo = new THREE.BoxGeometry(scale, 0.35, scale);
            
            // Legs
            const legL = new THREE.Mesh(legGeo, mat);
            legL.position.set(-0.15, -0.4, 0);
            legL.name = 'legL';
            mesh.add(legL);
            
            const legR = new THREE.Mesh(legGeo, mat);
            legR.position.set(0.15, -0.4, 0);
            legR.name = 'legR';
            mesh.add(legR);

            // Arms
            const armL = new THREE.Mesh(armGeo, mat);
            armL.position.set(-0.25, 0.1, 0);
            armL.name = 'armL';
            mesh.add(armL);
            
            const armR = new THREE.Mesh(armGeo, mat);
            armR.position.set(0.25, 0.1, 0);
            armR.name = 'armR';
            mesh.add(armR);
        }
        
        // Eyes
        const eyeColor = (type === 'SPIRIT' || type === 'ICE_SPIRIT') ? 0xff0000 : 0xffff00;
        const eye = new THREE.Mesh(new THREE.BoxGeometry(0.2,0.1,0.1), new THREE.MeshBasicMaterial({color: eyeColor}));
        
        // Eye positioning
        eye.position.set(0, 0.2, 0.5); // Default
        if(type.includes('WOLF')) eye.position.set(0, 0.2, 0.5);
        if(type.includes('GOLEM')) eye.position.set(0, 0.3, 0.6);
        if(type === 'SERPENT') eye.position.set(0, 0.3, 1.0);
        if(type.includes('GOBLIN')) eye.position.set(0, 0.1, 0.4);
        
        mesh.add(eye);

        // Hitbox
        const hitGeo = new THREE.CylinderGeometry(1.5, 1.5, 3, 8);
        const hitMat = new THREE.MeshBasicMaterial({ visible: true, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false });
        const hitbox = new THREE.Mesh(hitGeo, hitMat);
        hitbox.userData = { isHitbox: true };
        mesh.add(hitbox);

        return mesh;
    }
};