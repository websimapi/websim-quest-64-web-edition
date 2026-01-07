import nipplejs from 'nipplejs';

export class InputManager {
    constructor() {
        this.inputs = { x: 0, y: 0 };
        this.setupJoystick();
        this.setupKeyboard();
    }

    setupJoystick() {
        const manager = nipplejs.create({
            zone: document.getElementById('zone-nipple'),
            mode: 'static',
            position: { left: '5