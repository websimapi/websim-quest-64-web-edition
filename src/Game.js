import * as THREE from 'three';
import nipplejs from 'nipplejs';
import { World } from './World.js';
import { Player } from './Player.js';
import { CombatSystem } from './CombatSystem.js';
import { AudioManager } from './AudioManager.js';

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
        this.setupInputs();

        // Subsystems
        this.audioManager = new AudioManager(audioCtx);
        this.world = new World(this.scene);
        this.player = new Player(this.scene, this.audioManager);
        this.combatSystem = new CombatSystem(this.scene, this.player, this.audioManager);

        this.clock = new THREE.Clock();
        this.gameState = 'ROAMING'; // ROAMING, BATTLE, MENU
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
    }

    handleSpellCast(element) {
        if (this.gameState === 'ROAMING') {
            // Cannot cast in roaming for this MVP unless we add platforming spells, 
            // but let's allow "dry casting" for fun
            this.player.castSpell(element, null); 
        } else if (this.gameState === 'BATTLE') {
            this.combatSystem.playerCast(element);
        }
    }

    updateCamera() {
        // Classic 3rd person follow
        const targetPos = this.player.mesh.position.clone();
        targetPos.y += 2;
        
        const offset = new THREE.Vector3(0, 5, 8);
        
        // Simple smoothing
        const idealPos = targetPos.clone().add(offset);
        this.camera.position.lerp(idealPos, 0.1);
        this.camera.lookAt(targetPos);

        // Compass update
        const playerForward = new THREE.Vector3(0,0,-1).applyQuaternion(this.player.mesh.quaternion);
        // Calculate angle relative to North (Negative Z)
        const angle = Math.atan2(playerForward.x, playerForward.z);
        const compassArrow = document.getElementById('compass-arrow');
        compassArrow.style.transform = `translate(-50%, -100%) rotate(${-angle}rad)`;
    }

    loop() {
        requestAnimationFrame(() => this.loop());
        
        const dt = Math.min(this.clock.getDelta(), 0.1);

        // Game State Logic
        if (this.gameState === 'ROAMING') {
            this.player.update(dt, this.inputs, this.world);
            
            // Check for random encounters
            if (this.player.isMoving) {
                if (Math.random() < 0.002) { // Low chance per frame
                    this.startBattle();
                }
            }

        } else if (this.gameState === 'BATTLE') {
            const battleResult = this.combatSystem.update(dt, this.inputs);
            if (battleResult === 'VICTORY' || battleResult === 'ESCAPE') {
                this.endBattle();
            }
        }

        this.updateCamera();
        this.renderer.render(this.scene, this.camera);
    }

    startBattle() {
        this.gameState = 'BATTLE';
        this.showMessage("Enemy encounter!");
        this.combatSystem.initBattle(this.player.mesh.position);
    }

    endBattle() {
        this.gameState = 'ROAMING';
        this.showMessage("");
        this.combatSystem.cleanup();
    }

    showMessage(msg) {
        const box = document.getElementById('message-box');
        box.style.display = msg ? 'block' : 'none';
        box.textContent = msg;
    }

    onResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }
}