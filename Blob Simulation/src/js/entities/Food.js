import { CONFIG } from '../config.js';

export class Food {
    constructor(x, y, color) {
        this.x = x;
        this.y = y;
        this.color = color;
        this.radius = CONFIG.FOOD_SIZE;
        this.isAlive = true;
        this.mass = 1;
    }

    draw(ctx) {
        if (!this.isAlive) return;

        const screenX = this.x;
        const screenY = this.y;

        // Simple but clean food
        ctx.beginPath();
        ctx.arc(screenX, screenY, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = this.color;
        ctx.fill();
    }
}
