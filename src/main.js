import { Game } from './js/engine/Game.js';
import { BackgroundEffect } from './js/ui/BackgroundEffect.js';

window.addEventListener('DOMContentLoaded', () => {
    const bgCanvas = document.getElementById('bgCanvas');
    new BackgroundEffect(bgCanvas);

    const canvas = document.getElementById('gameCanvas');
    const game = new Game(canvas);
    
    console.log('Neon Blob Simulation Initialized');
});
