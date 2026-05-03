import { lerp } from '../utils.js';

export class Effect {
    constructor(x, y, color, duration = 100) {
        this.x = x;
        this.y = y;
        this.color = color;
        this.duration = duration;
        this.life = duration;
        this.isAlive = true;
    }

    update() {
        this.life--;
        if (this.life <= 0) {
            this.isAlive = false;
        }
    }

    draw(ctx) {
        if (!this.isAlive) return;

        const alpha = this.life / this.duration;
        const size = 20 + (1 - alpha) * 20; // Expands as it fades

        ctx.save();
        ctx.strokeStyle = this.color;
        ctx.lineWidth = 4;
        ctx.globalAlpha = alpha;
        
        // Draw X
        ctx.beginPath();
        ctx.moveTo(this.x - size, this.y - size);
        ctx.lineTo(this.x + size, this.y + size);
        ctx.moveTo(this.x + size, this.y - size);
        ctx.lineTo(this.x - size, this.y + size);
        ctx.stroke();

        // Optional glow
        ctx.shadowBlur = 15;
        ctx.shadowColor = this.color;
        ctx.stroke();

        ctx.restore();
    }
}
