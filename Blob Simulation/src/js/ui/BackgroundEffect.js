import { CONFIG } from '../config.js';
import { randomRange } from '../utils.js';

export class BackgroundEffect {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.blobs = [];
        this.blobCount = 15;
        this.motionScale = 1;
        this.theme = this.readTheme();
        
        this.init();
        this.animate();
    }

    init() {
        this.resize();
        window.addEventListener('resize', () => this.resize());
        window.addEventListener('blob-theme-change', (event) => {
            this.theme = this.readTheme(event?.detail?.colors);
            if (event?.detail?.settings && typeof event.detail.settings.backgroundMotion === 'number') {
                this.motionScale = event.detail.settings.backgroundMotion;
            }
            this.drawStaticLines();
        });
        window.addEventListener('blob-settings-change', (event) => {
            const settings = event?.detail?.settings;
            if (settings && typeof settings.backgroundMotion === 'number') {
                this.motionScale = settings.backgroundMotion;
            }
        });

        for (let i = 0; i < this.blobCount; i++) {
            this.blobs.push({
                x: Math.random() * this.canvas.width,
                y: Math.random() * this.canvas.height,
                radius: randomRange(40, 120),
                vx: randomRange(-0.08, 0.08),
                vy: randomRange(-0.08, 0.08),
                color: CONFIG.COLORS[Math.floor(Math.random() * CONFIG.COLORS.length)],
                pulse: randomRange(0.7, 1.4),
                phase: randomRange(0, Math.PI * 2)
            });
        }
    }

    readTheme(forcedColors = null) {
        if (forcedColors) {
            return forcedColors;
        }

        const style = getComputedStyle(document.documentElement);
        return {
            bg1: style.getPropertyValue('--theme-bg-1').trim() || '#120b1e',
            bg2: style.getPropertyValue('--theme-bg-2').trim() || '#1a122a',
            bg3: style.getPropertyValue('--theme-bg-3').trim() || '#0e1522',
            accentPrimary: style.getPropertyValue('--theme-accent-primary').trim() || '#ff7ab0',
            accentSecondary: style.getPropertyValue('--theme-accent-secondary').trim() || '#8f7cff',
            accentTertiary: style.getPropertyValue('--theme-accent-tertiary').trim() || '#70d8ff',
            glow: style.getPropertyValue('--theme-glow').trim() || 'rgba(255, 122, 176, 0.18)'
        };
    }

    resize() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
        this.drawStaticLines();
    }

    drawStaticLines() {
        const gradient = this.ctx.createLinearGradient(0, 0, this.canvas.width, this.canvas.height);
        gradient.addColorStop(0, this.theme.bg1);
        gradient.addColorStop(0.45, this.theme.bg2);
        gradient.addColorStop(1, this.theme.bg3);
        this.ctx.fillStyle = gradient;
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        const glowSpots = [
            { x: this.canvas.width * 0.18, y: this.canvas.height * 0.22, r: this.canvas.width * 0.28, color: this.theme.glow || 'rgba(255, 119, 168, 0.16)' },
            { x: this.canvas.width * 0.8, y: this.canvas.height * 0.18, r: this.canvas.width * 0.22, color: this.theme.accentTertiary || 'rgba(113, 181, 255, 0.14)' },
            { x: this.canvas.width * 0.6, y: this.canvas.height * 0.72, r: this.canvas.width * 0.3, color: this.theme.accentSecondary || 'rgba(188, 126, 255, 0.12)' }
        ];

        for (const spot of glowSpots) {
            const gradient = this.ctx.createRadialGradient(spot.x, spot.y, 0, spot.x, spot.y, spot.r);
            gradient.addColorStop(0, spot.color);
            gradient.addColorStop(1, 'rgba(0,0,0,0)');
            this.ctx.fillStyle = gradient;
            this.ctx.beginPath();
            this.ctx.arc(spot.x, spot.y, spot.r, 0, Math.PI * 2);
            this.ctx.fill();
        }
    }

    animate() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.drawStaticLines();

        for (const blob of this.blobs) {
            blob.x += blob.vx * this.motionScale;
            blob.y += blob.vy * this.motionScale;
            blob.phase += 0.01;

            if (blob.x < -blob.radius) blob.x = this.canvas.width + blob.radius;
            if (blob.x > this.canvas.width + blob.radius) blob.x = -blob.radius;
            if (blob.y < -blob.radius) blob.y = this.canvas.height + blob.radius;
            if (blob.y > this.canvas.height + blob.radius) blob.y = -blob.radius;

            this.ctx.save();
            this.ctx.globalAlpha = 0.08;
            this.ctx.filter = 'blur(54px)';
            this.ctx.beginPath();
            this.ctx.arc(blob.x, blob.y, blob.radius * blob.pulse * (1 + Math.sin(blob.phase) * 0.05), 0, Math.PI * 2);
            this.ctx.fillStyle = blob.color;
            this.ctx.fill();
            this.ctx.restore();
        }

        requestAnimationFrame(() => this.animate());
    }
}
