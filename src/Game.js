import * as THREE from 'three';
import { World } from './World.js';
import { Player } from './Player.js';
import { CombatSystem } from './CombatSystem.js';
import { AudioManager } from './AudioManager.js';
import { SpellProjectile, getSpellConfig } from './Spells.js';
import { UIManager } from './UIManager.js';
import { InputManager } from './InputManager.js';
import { CameraController } from './CameraController.js';

export class Game {
    constructor(audioCtx) {
        this.audioCtx = audioCtx;
        this.container = document.getElementById('game-container');
        
        // Setup Three.js
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x87CEEB); // Sky blue
        this.scene.fog = new THREE.Fog(0x87CEEB, 20, 60);

        this.camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.camera.position.set(0, 5, 10);
        
        this.renderer = new THREE.WebGLRenderer({ antialias: false });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.shadowMap.enabled = true;
        this.container.appendChild(this.renderer.domElement);

        // Inputs (populated by InputManager)
        this.inputs = { x: 0, y: 0, magic: false };
        this.raycaster = new THREE.Raycaster();

        // Subsystems
        this.audioManager = new AudioManager(audioCtx);
        this.world = new World(this.scene);
        this.player = new Player(this.scene, this.audioManager);
        this.combatSystem = new CombatSystem(this.scene, this.player, this.audioManager);
        this.uiManager = new UIManager(this.player, this.combatSystem);

        // Camera controller (handles orbit & compass)
        this.cameraController = new CameraController(this.camera, this.player.mesh);

        // Input manager (joystick, keyboard, pointer)
        this.inputManager = new InputManager(this, this.renderer, this.cameraController);

        this.clock = new THREE.Clock();
        this.gameState = 'ROAMING'; // ROAMING, BATTLE, MENU
        this.messageTimer = null;
        
        this.roamingProjectiles = [];

        // removed cameraState (now handled in CameraController)
        // removed inputState (now handled in InputManager)
    }

    async start() {
        // Load Assets
        await Promise.all([
            this.audioManager.loadSound('bgm', 'bgm_field.mp3'),
            this.audioManager.loadSound('cast', 'sfx_cast.mp3'),
            this.audioManager.loadSound('hit', 'sfx_hit.mp3'),
            this.audioManager.loadSound('wind', 'sfx_wind.mp3'),
            this.audioManager.loadSound('fire', 'sfx_fire.mp3'),
            this.world.loadAssets(),
            this.player.loadAssets()
        ]);

        this.audioManager.playBgm('bgm');
        this.world.generate();
        this.player.mesh.position.y = this.world.getHeight(0, 0);

        // Ensure camera follows the loaded player
        if (this.cameraController) {
            this.cameraController.setTarget(this.player.mesh);
        }

        this.loop();
    }

    // removed setupInputs() {} – now handled by InputManager

    handleTap(x, y) {
        // Prevent click if clicking UI
        const el = document.elementFromPoint(x, y);
        if (el && el !== this.renderer.domElement) return;

        const mouse = new THREE.Vector2();
        mouse.x = (x / window.innerWidth) * 2 - 1;
        mouse.y = -(y / window.innerHeight) * 2 + 1;
        this.raycaster.setFromCamera(mouse, this.camera);

        // 1. Check Enemies (Priority)
        const enemies = (this.gameState === 'BATTLE') 
            ? this.combatSystem.activeEnemies 
            : this.world.enemies.filter(e => e.hp > 0);
            
        const enemyMeshes = enemies.map(e => e.mesh).filter(m => m);
        if (enemyMeshes.length > 0) {
            const intersects = this.raycaster.intersectObjects(enemyMeshes, true);
            if (intersects.length > 0) {
                const hitObj = intersects[0].object;
                const target = enemies.find(e => {
                    let current = hitObj;
                    while(current) { if (current === e.mesh) return true; current = current.parent; }
                    return false;
                });
                
                if (target) {
                    target.highlight();
                    if (this.gameState === 'BATTLE') {
                        const result = this.combatSystem.tryFaceTarget(target);
                        if (!result.success && result.reason === 'Not enough movement') {
                            this.uiManager.showMessage("Not enough movement!", 1000);
                        }
                    } else {
                        // Roaming: Just face them
                        this.player.faceTarget(target.mesh.position);
                    }
                    return; // Handled enemy click
                }
            }
        }

        // 2. Check Ground (Move)
        if (this.world.ground) {
            const intersects = this.raycaster.intersectObject(this.world.ground);
            if (intersects.length > 0) {
                const pt = intersects[0].point;
                // Update nav target - works for both states now
                // CombatSystem update loop handles the stamina drain for this movement
                this.player.navTarget = pt;
            }
        }
    }

    handleSpellCast(element) {
        if (this.gameState === 'ROAMING') {
            if (this.player.castState.active) return;
            const config = getSpellConfig(element, this.player.spirits[element], this.player.stats.hp, this.player.stats.maxHp);
            
            // Check MP
            if (this.player.stats.mp < config.cost) {
                this.uiManager.showMessage("Not enough MP!", 1000);
                return;
            }

            this.player.startCasting(config, () => {
                this.player.stats.mp -= config.cost;
                this.spawnRoamingProjectile(element, config);
            });
            
        } else if (this.gameState === 'BATTLE') {
            this.combatSystem.playerCast(element);
        }
    }

    spawnRoamingProjectile(element, config) {
        if (config.type === 'heal') {
            // Self heal logic duplication from CombatSystem (simplified)
            this.player.stats.hp = Math.min(this.player.stats.maxHp, this.player.stats.hp + config.power);
            this.audioManager.playSfx('cast');
            return;
        }

        const staffState = this.player.getStaffTipWorldState();
        let sfx = 'wind';
        if (element === 'fire') sfx = 'fire';
        if (element === 'earth') sfx = 'hit';
        this.audioManager.playSfx(sfx);

        // Aim forward based on player facing
        const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(this.player.mesh.quaternion);
        const spawnPos = staffState.position.clone();
        const aimObj = new THREE.Object3D();
        aimObj.position.copy(spawnPos);
        
        // Aim parallel to ground if ground spell, or just straight forward
        const targetPos = spawnPos.clone().add(forward.multiplyScalar(20));
        targetPos.y = spawnPos.y; // Keep level
        aimObj.lookAt(targetPos);

        const proj = new SpellProjectile(
            this.scene,
            spawnPos,
            aimObj.quaternion,
            config,
            this.world,
            null // No specific target
        );
        this.roamingProjectiles.push(proj);
    }

    // removed updateCamera() {} – now handled by CameraController

    // removed updateUI() {} – HUD updates now handled by UIManager.update()

    loop() {
        requestAnimationFrame(() => this.loop());
        
        let dt = Math.min(this.clock.getDelta(), 0.1);

        // Time Dilation if Menu Open
        const spellMenu = document.getElementById('spell-menu');
        if (spellMenu && spellMenu.classList.contains('active')) {
            dt *= 0.1;
        }

        // Inputs: Transform inputs to be relative to camera for Player
        const transformedInputs = { x: 0, y: 0 };
        if (this.inputs.x !== 0 || this.inputs.y !== 0) {
            // Forward vector on XZ plane
            const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion);
            forward.y = 0; forward.normalize();
            const right = new THREE.Vector3(1, 0, 0).applyQuaternion(this.camera.quaternion);
            right.y = 0; right.normalize();

            // input y is forward, x is right
            const moveDir = forward.multiplyScalar(this.inputs.y).add(right.multiplyScalar(this.inputs.x));
            
            // Map back to x/y for player (x=x, y=-z logic in player)
            // Player expects: x, -y. 
            // Player code: moveVec = (x, 0, -y).
            // So we pass x = moveDir.x, y = -moveDir.z
            transformedInputs.x = moveDir.x;
            transformedInputs.y = -moveDir.z;
        }

        // Game State Logic
        if (this.gameState === 'ROAMING') {
            this.player.update(dt, transformedInputs, this.world);
            this.world.update(dt, this.player.mesh.position);
            
            // Update Roaming Projectiles
            for (let i = this.roamingProjectiles.length - 1; i >= 0; i--) {
                const p = this.roamingProjectiles[i];
                const result = p.update(dt, this.world.enemies.filter(e => e.hp > 0));
                
                if (result.result === 'HIT' || result.result === 'HIT_AOE') {
                    this.audioManager.playSfx('hit');
                    
                    let hitEnemies = [];
                    if (result.result === 'HIT') {
                        result.target.takeDamage(result.damage);
                        hitEnemies.push(result.target);
                    } else {
                        result.targets.forEach(t => t.takeDamage(result.damage));
                        hitEnemies = result.targets;
                    }
                    
                    p.dispose();
                    this.roamingProjectiles.splice(i, 1);

                    // Trigger Battle with first hit enemy
                    if (hitEnemies.length > 0 && hitEnemies[0].hp > 0) {
                        this.startBattle(hitEnemies[0]);
                    }
                }
                else if (result.result === 'TIMEOUT') {
                    p.dispose();
                    this.roamingProjectiles.splice(i, 1);
                }
            }

            // Check for contact encounters
            for (let enemy of this.world.enemies) {
                if (enemy.hp <= 0) continue;
                if (enemy.mesh.position.distanceTo(this.player.mesh.position) < 2.0) {
                    this.startBattle(enemy);
                    break;
                }
            }

        } else if (this.gameState === 'BATTLE') {
            // Combat system also needs camera-relative inputs
            const result = this.combatSystem.update(dt, transformedInputs, this.world);
            if (result.status === 'VICTORY') {
                this.handleVictory(result.xp);
                this.endBattle();
            } else if (result.status === 'ESCAPE') {
                this.uiManager.showMessage("ESCAPED!", 2000);
                this.endBattle();
            }
        }

        this.uiManager.update(this.gameState, this.combatSystem);

        if (this.cameraController) {
            this.cameraController.update();
        }

        this.renderer.render(this.scene, this.camera);
    }

    startBattle(enemy) {
        this.gameState = 'BATTLE';
        this.uiManager.showMessage("BATTLE START!", 2000);
        this.combatSystem.initBattle(this.player.mesh.position, enemy, this.world.enemies, this.world);
    }

    endBattle() {
        this.gameState = 'ROAMING';
        this.combatSystem.cleanup();
    }
    
    handleVictory(xp = 20) {
        const leveledUp = this.player.gainXp(xp);
        this.uiManager.showMessage(leveledUp ? "LEVEL UP!" : `VICTORY! +${xp} XP`, 3000);
        
        if (leveledUp) {
            // Delegate level up UI and stat application to UIManager callback
            this.uiManager.showLevelUpMenu((elementKey) => {
                if (!elementKey) return;
                if (this.player.spirits[elementKey] !== undefined) {
                    this.player.spirits[elementKey]++;
                }
                this.player.recalcStats();
                this.player.stats.hp = this.player.stats.maxHp;
                this.player.stats.mp = this.player.stats.maxMp;
            });
        }
    }

    // removed showLevelUpMenu() {} – moved to UIManager
    // removed showMessage() {} – moved to UIManager

    onResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }
}