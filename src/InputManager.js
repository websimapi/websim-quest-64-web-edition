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
        // Delegate for dynamic spell buttons
        const container = document.getElementById('spell-controls');
        if (!container) return;

        container.addEventListener('click', (e) => {
            const btn = e.target.closest('.spell-btn');
            if (btn && btn.dataset.el) {
                e.stopPropagation();
                this.game.handleSpellCast(btn.dataset.el);
            }
        });
        
        // Allow touch interaction specifically
        container.addEventListener('touchstart', (e) => {
             const btn = e.target.closest('.spell-btn');
             if (btn && btn.dataset.el) {
                 e.stopPropagation();
                 // Prevent default click emulation to speed up reaction
                 e.preventDefault(); 
                 this.game.handleSpellCast(btn.dataset.el);
             }
        }, { passive: false });
    }

    setupPointer() {
        const dom = this.renderer.domElement;
        if (!dom) return;

        dom.addEventListener('pointerdown', (e) => {
            try { dom.setPointerCapture(e.pointerId); } catch(e) {}
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
            try { dom.releasePointerCapture(e.pointerId); } catch(e) {}
            this.inputState.down = false;

            // Tap Detection
            if (!this.inputState.isDragging && (Date.now() - this.inputState.startTime) < 300) {
                this.game.handleTap(e.clientX, e.clientY);
            }
        });

        dom.addEventListener('pointercancel', (e) => {
            try { dom.releasePointerCapture(e.pointerId); } catch(e) {}
            this.inputState.down = false;
        });
    }
}