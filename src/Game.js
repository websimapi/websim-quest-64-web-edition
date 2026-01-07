import * as THREE from 'three';
import nipplejs from 'nipplejs';
import { World } from './World.js';
import { Player } from './Player.js';
import { CombatSystem } from './CombatSystem.js';
import { AudioManager } from './AudioManager.js';
import { SpellProjectile, getSpellConfig } from './Spells.js';

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

        // Inputs
        this.inputs = { x: 0, y: 0, magic: false };
        this.raycaster = new THREE.Raycaster();
        this.setupInputs();

        // Subsystems
        this.audioManager = new AudioManager(audioCtx);
        this.world = new World(this.scene);
        this.player = new Player(this.scene, this.audioManager);
        this.combatSystem = new CombatSystem(this.scene, this.player, this.audioManager);

        this.clock = new THREE.Clock();
        this.gameState = 'ROAMING'; // ROAMING, BATTLE, MENU
        this.messageTimer = null;
        
        this.roamingProjectiles = [];
        
        this.cameraState = {
            radius: 12,
            theta: Math.PI,
            phi: Math.PI * 0.35,
            target: new THREE.Vector3()
        };
        
        this.inputState = {
            down: false,
            startX: 0,
            startY: 0,
            lastX: 0,
            lastY: 0,
            isDragging: false,
            startTime: 0
        };
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

        this.loop();
    }

    setupInputs() {
        // Touch Joystick
        const manager = nipplejs.create({
            zone: document.getElementById('zone-nipple'),
            mode: 'static',
            position: { left: '50%', top: '50%' },
            color: 'white'
        });

        manager.on('move', (evt, data) => {
            const angle = data.angle.radian;
            const force = Math.min(data.force, 1.0);
            this.inputs.x = Math.cos(angle) * force;
            this.inputs.y = Math.sin(angle) * force;
        });

        manager.on('end', () => {
            this.inputs.x = 0;
            this.inputs.y = 0;
        });

        // Keyboard
        window.addEventListener('keydown', (e) => {
            if (e.key === 'w') this.inputs.y = 1;
            if (e.key === 's') this.inputs.y = -1;
            if (e.key === 'a') this.inputs.x = -1;
            if (e.key === 'd') this.inputs.x = 1;
        });

        window.addEventListener('keyup', (e) => {
            if (['w','s'].includes(e.key)) this.inputs.y = 0;
            if (['a','d'].includes(e.key)) this.inputs.x = 0;
        });

        // UI Buttons
        const spellMenu = document.getElementById('spell-menu');
        const actionBtn = document.getElementById('action-btn');

        actionBtn.addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent affecting other inputs
            if (this.gameState === 'ROAMING' || this.gameState === 'BATTLE') {
                spellMenu.classList.toggle('active');
            }
        });

        document.querySelectorAll('.element-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const el = btn.dataset.el;
                this.handleSpellCast(el);
                spellMenu.classList.remove('active');
            });
        });
        
        // Close menu if clicking outside
        document.addEventListener('click', (e) => {
           if(!e.target.closest('#spell-menu') && !e.target.closest('#action-btn')) {
               spellMenu.classList.remove('active');
           } 
        });

        // Pointer Events for Camera & Interaction
        const dom = this.renderer.domElement;
        
        dom.addEventListener('pointerdown', (e) => {
            this.inputState.down = true;
            this.inputState.startX = e.clientX;
            this.inputState.startY = e.clientY;
            this.inputState.lastX = e.clientX;
            this.inputState.lastY = e.clientY;
            this.inputState.startTime = Date.now();
            this.inputState.isDragging = false;
        });

        dom.addEventListener('pointermove', (e) => {
            if (!this.inputState.down) return;

            const dx = e.clientX - this.inputState.lastX;
            const dy = e.clientY - this.inputState.lastY;
            
            // Check drag threshold
            const dist = Math.sqrt((e.clientX - this.inputState.startX)**2 + (e.clientY - this.inputState.startY)**2);
            if (dist > 5) this.inputState.isDragging = true;

            if (this.inputState.isDragging) {
                // Rotate Camera
                const sensitivity = 0.005;
                this.cameraState.theta -= dx * sensitivity;
                this.cameraState.phi -= dy * sensitivity;
                
                // Clamp elevation
                this.cameraState.phi = Math.max(0.1, Math.min(Math.PI / 2 - 0.1, this.cameraState.phi));
            }

            this.inputState.lastX = e.clientX;
            this.inputState.lastY = e.clientY;
        });

        dom.addEventListener('pointerup', (e) => {
            this.inputState.down = false;
            
            // Tap Detection
            if (!this.inputState.isDragging && (Date.now() - this.inputState.startTime) < 300) {
                this.handleTap(e.clientX, e.clientY);
            }
        });
    }

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
                    if (this.gameState === 'BATTLE') {
                        const result = this.combatSystem.tryFaceTarget(target);
                        if (!result.success && result.reason === 'Not enough movement') {
                            this.showMessage("Not enough movement!", 1000);
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
                this.showMessage("Not enough MP!", 1000);
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

    updateCamera() {
        // Orbit Camera
        const playerPos = this.player.mesh.position;
        const center = new THREE.Vector3(playerPos.x, playerPos.y + 1.5, playerPos.z);
        
        this.cameraState.target.lerp(center, 0.1);

        const r = this.cameraState.radius;
        const theta = this.cameraState.theta;
        const phi = this.cameraState.phi;

        const x = r * Math.sin(phi) * Math.sin(theta);
        const y = r * Math.cos(phi);
        const z = r * Math.sin(phi) * Math.cos(theta);

        this.camera.position.copy(this.cameraState.target).add(new THREE.Vector3(x, y, z));
        this.camera.lookAt(this.cameraState.target);

        // Compass update
        const playerForward = new THREE.Vector3(0,0,-1).applyQuaternion(this.player.mesh.quaternion);
        // Calculate angle relative to North (Negative Z)
        const angle = Math.atan2(playerForward.x, playerForward.z);
        const compassArrow = document.getElementById('compass-arrow');
        compassArrow.style.transform = `translate(-50%, -100%) rotate(${-angle}rad)`;
    }

    updateUI() {
        document.getElementById('hp-bar').innerText = `HP: ${Math.floor(this.player.stats.hp)}/${this.player.stats.maxHp}`;
        document.getElementById('mp-bar').innerText = `MP: ${Math.floor(this.player.stats.mp)}/${this.player.stats.maxMp}`;
        
        const s = this.player.spirits;
        document.getElementById('spirit-stats').innerHTML = 
            `<span style="color:#d32f2f">FIRE: ${s.fire}</span><br>` +
            `<span style="color:#1976d2">WATER: ${s.water}</span><br>` +
            `<span style="color:#388e3c">EARTH: ${s.earth}</span><br>` +
            `<span style="color:#fbc02d">WIND: ${s.wind}</span>`;
        
        // Battle Specific UI
        const turnInd = document.getElementById('turn-indicator');
        const moveBar = document.getElementById('move-bar-container');
        const moveFill = document.getElementById('move-bar-fill');

        if (this.gameState === 'BATTLE') {
            turnInd.style.display = 'block';
            turnInd.innerText = this.combatSystem.turn + " TURN";
            turnInd.style.color = this.combatSystem.turn === 'PLAYER' ? '#00ff00' : '#ff0000';
            
            if (this.combatSystem.turn === 'PLAYER') {
                moveBar.style.display = 'block';
                const pct = Math.max(0, (this.combatSystem.currentMove / this.combatSystem.maxMove) * 100);
                moveFill.style.width = pct + '%';
            } else {
                moveBar.style.display = 'none';
            }
        } else {
            turnInd.style.display = 'none';
            moveBar.style.display = 'none';
        }
    }

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
                this.showMessage("ESCAPED!", 2000);
                this.endBattle();
            }
        }

        this.updateUI();
        this.updateCamera();
        this.renderer.render(this.scene, this.camera);
    }

    startBattle(enemy) {
        this.gameState = 'BATTLE';
        this.showMessage("BATTLE START!", 2000);
        this.combatSystem.initBattle(this.player.mesh.position, enemy, this.world.enemies, this.world);
    }

    endBattle() {
        this.gameState = 'ROAMING';
        this.combatSystem.cleanup();
    }
    
    handleVictory(xp = 20) {
        const leveledUp = this.player.gainXp(xp);
        this.showMessage(leveledUp ? "LEVEL UP!" : `VICTORY! +${xp} XP`, 3000);
        
        if (leveledUp) {
            this.showLevelUpMenu();
        }
    }

    showLevelUpMenu() {
        const overlay = document.getElementById('levelup-overlay');
        overlay.querySelector('p').innerText = "Grant 1 Spirit Point to an element:";
        overlay.style.display = 'flex';
        
        const close = () => {
            overlay.style.display = 'none';
            this.player.recalcStats();
            // Restore HP/MP on level up? Sure
            this.player.stats.hp = this.player.stats.maxHp;
            this.player.stats.mp = this.player.stats.maxMp;
        };

        const handler = (e) => {
            const id = e.target.id;
            if (id.includes('fire')) this.player.spirits.fire++;
            if (id.includes('water')) this.player.spirits.water++;
            if (id.includes('earth')) this.player.spirits.earth++;
            if (id.includes('wind')) this.player.spirits.wind++;
            
            // Remove listeners
            document.querySelectorAll('.element-btn').forEach(b => {
               // This is a bit messy because the main UI also has these classes
               // But the IDs are specific for the modal
            });
            close();
        };

        document.getElementById('lvl-fire').onclick = handler;
        document.getElementById('lvl-water').onclick = handler;
        document.getElementById('lvl-earth').onclick = handler;
        document.getElementById('lvl-wind').onclick = handler;
    }

    showMessage(msg, duration = 0) {
        const box = document.getElementById('message-box');
        box.style.display = msg ? 'block' : 'none';
        box.textContent = msg;
        
        if (this.messageTimer) clearTimeout(this.messageTimer);
        if (duration > 0) {
            this.messageTimer = setTimeout(() => {
                box.style.display = 'none';
                box.textContent = "";
            }, duration);
        }
    }

    onResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }
}