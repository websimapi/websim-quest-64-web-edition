import nipplejs from 'nipplejs';

export class InputManager {
    constructor(game, renderer, cameraController) {
        this.game = game;
        this.renderer = renderer;
        this.cameraController = cameraController;

        this.inputState = {
            down: false,
            startX: 0,
            startY: 0,
            lastX: 0,
            lastY: 0,
            isDragging: false,
            startTime: 0
        };

        this.setupJoystick();
        this.setupKeyboard();
        this.setupPointer();
        this.setupSpellButtons();
    }

    setupJoystick() {
        const zone = document.getElementById('zone-nipple');
        if (!zone) return;

        const manager = nipplejs.create({
            zone,
            mode: 'static',
            position: { left: '50%', top: '50%' },
            color: 'white'
        });

        manager.on('move', (evt, data) => {
            const angle = data.angle.radian;
            const force = Math.min(data.force, 1.0);
            this.game.inputs.x = Math.cos(angle) * force;
            this.game.inputs.y = Math.sin(angle) * force;
        });

        manager.on('end', () => {
            this.game.inputs.x = 0;
            this.game.inputs.y = 0;
        });
    }

    setupKeyboard() {
        window.addEventListener('keydown', (e) => {
            if (e.key === 'w') this.game.inputs.y = 1;
            if (e.key === 's') this.game.inputs.y = -1;
            if (e.key === 'a') this.game.inputs.x = -1;
            if (e.key === 'd') this.game.inputs.x = 1;
        });

        window.addEventListener('keyup', (e) => {
            if (['w','s'].includes(e.key)) this.game.inputs.y = 0;
            if (['a','d'].includes(e.key)) this.game.inputs.x = 0;
        });
    }

    setupSpellButtons() {
        const spellMenu = document.getElementById('spell-menu');
        const actionBtn = document.getElementById('action-btn');
        if (!spellMenu || !actionBtn) return;

        actionBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (this.game.gameState === 'ROAMING' || this.game.gameState === 'BATTLE') {
                spellMenu.classList.toggle('active');
            }
        });

        document.querySelectorAll('.element-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const el = btn.dataset.el;
                if (el) this.game.handleSpellCast(el);
                spellMenu.classList.remove('active');
            });
        });

        // Close menu if clicking outside
        document.addEventListener('click', (e) => {
            if (!e.target.closest('#spell-menu') && !e.target.closest('#action-btn')) {
                spellMenu.classList.remove('active');
            }
        });
    }

    setupPointer() {
        const dom = this.renderer.domElement;
        if (!dom) return;

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

            const dist = Math.sqrt(
                (e.clientX - this.inputState.startX) ** 2 +
                (e.clientY - this.inputState.startY) ** 2
            );
            if (dist > 5) this.inputState.isDragging = true;

            if (this.inputState.isDragging && this.cameraController) {
                this.cameraController.rotate(dx, dy);
            }

            this.inputState.lastX = e.clientX;
            this.inputState.lastY = e.clientY;
        });

        dom.addEventListener('pointerup', (e) => {
            this.inputState.down = false;

            // Tap Detection
            if (!this.inputState.isDragging && (Date.now() - this.inputState.startTime) < 300) {
                this.game.handleTap(e.clientX, e.clientY);
            }
        });
    }
}