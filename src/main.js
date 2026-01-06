import { Game } from './Game.js';

const startBtn = document.getElementById('start-btn');
const overlay = document.getElementById('start-overlay');

let game;

startBtn.addEventListener('click', async () => {
    overlay.style.display = 'none';
    
    // Initialize Audio Context (must be user triggered)
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    
    game = new Game(audioCtx);
    game.start();
});

// Handle resize
window.addEventListener('resize', () => {
    if(game) game.onResize();
});