import { CONFIG, UPGRADES } from '../config.js';
import { NumberFormatter } from '../utils/NumberFormatter.js';

export class UIHandler {
    constructor(game) {
        this.game = game;
        this.eatenDisplay = document.getElementById('blobs-eaten-count');
        this.liveCountDisplay = document.getElementById('blobs-live-count');
        this.seasonTimeDisplay = document.getElementById('season-time-value');
        this.leaderboardList = document.getElementById('leaderboard-list');
        this.logList = document.getElementById('log-list');
        this.resetSizeBtn = document.getElementById('reset-size-btn');
        this.upgradeBtns = document.querySelectorAll('.upgrade-btn');
        this.speedBtns = document.querySelectorAll('.speed-btn');
        this.speedValue = document.getElementById('speed-value');
        this.leaderboardContainer = document.getElementById('leaderboard-container');
        this.logContainer = document.getElementById('log-container');
        
        this.init();
    }

    addLog(message, color) {
        const entry = document.createElement('div');
        entry.className = 'log-entry';
        entry.style.borderLeftColor = color;
        entry.textContent = message;
        
        this.logList.prepend(entry);
        
        // Keep only last 20 logs
        if (this.logList.children.length > 20) {
            this.logList.lastElementChild.remove();
        }
    }

    init() {
        this.upgradeBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const type = btn.dataset.type;
                this.handleUpgrade(type);
            });
        });

        this.speedBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const speed = Number(btn.dataset.speed);
                this.setGameSpeed(speed);
            });
        });

        if (this.resetSizeBtn) {
            this.resetSizeBtn.addEventListener('click', () => {
                this.game.resetBlobSizes();
            });
        }
    }

    update() {
        // Update Stats
        this.eatenDisplay.textContent = NumberFormatter.format(this.game.blobsEaten);
        this.liveCountDisplay.textContent = NumberFormatter.format(this.game.blobs.length);
        this.seasonTimeDisplay.textContent = this.formatSeasonTime(this.game.getSeasonElapsedMs());
        this.speedValue.textContent = `${this.game.gameSpeed.toFixed(1)}x`;
        this.leaderboardContainer?.classList.toggle('is-hidden', this.game.settings?.showLeaderboard === false);
        this.logContainer?.classList.toggle('is-hidden', this.game.settings?.showEventFeed === false);
        this.renderLeaderboard();

        // Update Button States
        this.upgradeBtns.forEach(btn => {
            const type = btn.dataset.type;
            const cost = this.getUpgradeCost(type);
            const costDisplay = btn.querySelector('.cost-value');
            costDisplay.textContent = NumberFormatter.format(cost);

            if (this.game.blobsEaten >= cost) {
                btn.classList.remove('disabled');
            } else {
                btn.classList.add('disabled');
            }
        });

        this.speedBtns.forEach(btn => {
            const speed = Number(btn.dataset.speed);
            btn.classList.toggle('active', speed === this.game.gameSpeed);
        });
    }

    getUpgradeCost(type) {
        const u = UPGRADES[type.toUpperCase()];
        const level = this.game.upgradeLevels[type];
        return u.baseCost * Math.pow(u.costScale, level);
    }

    handleUpgrade(type) {
        const cost = this.getUpgradeCost(type);
        if (this.game.blobsEaten >= cost) {
            this.game.blobsEaten -= cost;
            this.game.upgradeLevels[type]++;
            
            // Visual feedback
            this.triggerFeedback();
            
            // Persistence
            this.game.saveGame();
        }
    }

    triggerFeedback() {
        this.eatenDisplay.style.transform = 'scale(1.2)';
        this.eatenDisplay.style.color = '#a855f7';
        setTimeout(() => {
            this.eatenDisplay.style.transform = 'scale(1)';
            this.eatenDisplay.style.color = '#fff';
        }, 200);
    }

    setGameSpeed(speed) {
        this.game.gameSpeed = speed;
        this.game.saveGame();
        this.update();
    }

    renderLeaderboard() {
        if (!this.leaderboardList) {
            return;
        }

        const topBlobs = [...this.game.blobs]
            .sort((a, b) => b.mass - a.mass)
            .slice(0, 5);

        this.leaderboardList.innerHTML = '';

        topBlobs.forEach((blob, index) => {
            const row = document.createElement('div');
            row.className = 'leaderboard-entry';

            const rank = document.createElement('span');
            rank.className = 'leaderboard-rank';
            rank.textContent = `#${index + 1}`;

            const name = document.createElement('span');
            name.className = 'leaderboard-name';
            name.textContent = blob.name;

            const mass = document.createElement('span');
            mass.className = 'leaderboard-mass';
            mass.textContent = NumberFormatter.format(blob.mass);

            row.append(rank, name, mass);
            this.leaderboardList.appendChild(row);
        });
    }

    formatSeasonTime(ms) {
        const totalSeconds = Math.max(0, Math.floor(ms / 1000));
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;

        return `${hours}h ${String(minutes).padStart(2, '0')}m ${String(seconds).padStart(2, '0')}s`;
    }
}
