import * as THREE from 'three';

export const EnemyFactory = {
    getDefinition(type) {
        const def = {
            baseHp: 30, speed: 3, detectRadius: 15, yOffset: 0.7,
            baseDamage: 5, isAquatic: false, element: 'earth', baseXp: 20,
            color: 0x882222, animStyle: 'HOP',
            createGeo: () => new THREE.DodecahedronGeometry(0.7)
        };

        switch (type) {
            case 'SLIME':
                return { ...def, baseHp: 20, speed: 2, baseDamage: 4, element: 'water', baseXp: 15, yOffset: 0.4, color: 0x44ff44, animStyle: 'SQUASH', createGeo: () => { const g = new THREE.SphereGeometry(0.6, 8, 6); g.scale(1, 0.6, 1); return g; } };
            case 'SAND_SLIME':
                return { ...def, baseHp: 25, speed: 2.5, baseDamage: 6, element: 'earth', baseXp: 20, yOffset: 0.4, color: 0xeebb44, animStyle: 'SQUASH', createGeo: () => { const g = new THREE.SphereGeometry(0.6, 8, 6); g.scale(1, 0.6, 1); return g; } };
            case 'WATER_SLIME':
                return { ...def, baseHp: 25, speed: 3.0, baseDamage: 5, element: 'water', baseXp: 20, yOffset: -0.2, color: 0x0088ff, isAquatic: true, animStyle: 'SQUASH', createGeo: () => { const g = new THREE.SphereGeometry(0.6, 8, 6); g.scale(1, 0.6, 1); return g; } };
            case 'WOLF':
                return { ...def, baseHp: 25, speed: 6, baseDamage: 8, element: 'wind', baseXp: 30, yOffset: 0.5, color: 0x555555, animStyle: 'HOP', createGeo: () => new THREE.BoxGeometry(0.5, 0.5, 1.0) };
            case 'SNOW_WOLF':
                return { ...def, baseHp: 40, speed: 7, baseDamage: 12, element: 'water', baseXp: 50, yOffset: 0.6, color: 0xddeeff, animStyle: 'HOP', createGeo: () => new THREE.BoxGeometry(0.6, 0.6, 1.2) };
            case 'GOLEM':
                return { ...def, baseHp: 80, speed: 1.5, baseDamage: 15, element: 'earth', baseXp: 80, yOffset: 0.6, color: 0x6d4c41, detectRadius: 10, animStyle: 'HEAVY', createGeo: () => new THREE.CylinderGeometry(0.6, 0.6, 1.2, 6) };
            case 'MAGMA_GOLEM':
                return { ...def, baseHp: 150, speed: 2.0, baseDamage: 25, element: 'fire', baseXp: 200, yOffset: 0.8, color: 0x330000, detectRadius: 12, animStyle: 'HEAVY', createGeo: () => new THREE.CylinderGeometry(0.8, 0.8, 1.5, 6) };
            case 'SPIRIT':
                return { ...def, baseHp: 15, speed: 4, baseDamage: 6, element: 'fire', baseXp: 25, yOffset: 1.5, color: 0x00ffff, animStyle: 'FLOAT', createGeo: () => new THREE.OctahedronGeometry(0.5) };
            case 'ICE_SPIRIT':
                return { ...def, baseHp: 35, speed: 5, baseDamage: 10, element: 'water', baseXp: 60, yOffset: 1.8, color: 0xaaddff, animStyle: 'FLOAT', createGeo: () => new THREE.OctahedronGeometry(0.6) };
            case 'SERPENT':
                return { ...def, baseHp: 60, speed: 5, baseDamage: 10, element: 'water', baseXp: 70, yOffset: -0.5, color: 0x006644, isAquatic: true, animStyle: 'SWIM', createGeo: () => { const g = new THREE.CylinderGeometry(0.3, 0.2, 2.0, 8); g.rotateX(Math.PI/2); return g; } };
            default:
                return def;
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

        // Eyes
        const eyeColor = (type === 'SPIRIT' || type === 'ICE_SPIRIT') ? 0xff0000 : 0xffff00;
        const eye = new THREE.Mesh(new THREE.BoxGeometry(0.2,0.1,0.1), new THREE.MeshBasicMaterial({color: eyeColor}));
        
        // Eye positioning logic from original
        eye.position.set(0, 0.2, 0.5);
        if(type === 'WOLF' || type === 'SNOW_WOLF') eye.position.set(0, 0.2, 0.5);
        if(type.includes('GOLEM')) eye.position.set(0, 0.4, 0.6);
        if(type === 'SERPENT') eye.position.set(0, 0.3, 1.0);
        
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