export class ControlPanel {
    constructor(game) {
        this.game = game;
        this.root = document.getElementById('control-panel');
        this.toggleBtn = document.getElementById('control-panel-toggle');
        this.tabBtns = document.querySelectorAll('[data-control-tab]');
        this.tabPanels = document.querySelectorAll('[data-control-tab-panel]');
        this.fixDuplicatesBtn = document.getElementById('fix-duplicate-names-btn');
        this.repairBoundsBtn = document.getElementById('repair-bounds-btn');
        this.trimLimitBtn = document.getElementById('trim-over-limit-btn');
        this.resetSizeBtn = document.getElementById('control-reset-size-btn');
        this.duplicateCount = document.getElementById('duplicate-name-count');
        this.outOfBoundsCount = document.getElementById('out-of-bounds-count');
        this.overLimitCount = document.getElementById('over-limit-count');
        this.statusText = document.getElementById('control-status-text');

        this.isOpen = false;
        this.activeTab = 'names';

        this.init();
        this.update();
    }

    init() {
        if (this.toggleBtn) {
            this.toggleBtn.addEventListener('click', () => this.toggle());
        }

        this.tabBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const tab = btn.dataset.controlTab;
                this.setTab(tab);
            });
        });

        if (this.fixDuplicatesBtn) {
            this.fixDuplicatesBtn.addEventListener('click', () => {
                const result = this.game.cleanupDuplicateBlobNames();
                this.setStatus(result.renamed > 0
                    ? `Fixed ${result.renamed} duplicate name${result.renamed === 1 ? '' : 's'}.`
                    : 'No duplicate names found.');
                this.update();
            });
        }

        if (this.repairBoundsBtn) {
            this.repairBoundsBtn.addEventListener('click', () => {
                const result = this.game.repairOutOfBoundsBlobs();
                this.setStatus(result.moved > 0
                    ? `Returned ${result.moved} blob${result.moved === 1 ? '' : 's'} to the map.`
                    : 'All blobs are inside the map.');
                this.update();
            });
        }

        if (this.trimLimitBtn) {
            this.trimLimitBtn.addEventListener('click', () => {
                const result = this.game.trimOverLimitBlobs();
                this.setStatus(result.removed > 0
                    ? `Removed ${result.removed} extra blob${result.removed === 1 ? '' : 's'}.`
                    : 'Blob count is already at the limit.');
                this.update();
            });
        }

        if (this.resetSizeBtn) {
            this.resetSizeBtn.addEventListener('click', () => {
                this.game.resetBlobSizes();
                this.setStatus('Blob sizes reset and timer restarted.');
                this.update();
            });
        }
    }

    toggle() {
        this.isOpen = !this.isOpen;
        this.root?.classList.toggle('open', this.isOpen);
        if (this.toggleBtn) {
            this.toggleBtn.setAttribute('aria-expanded', String(this.isOpen));
        }
    }

    setTab(tab) {
        this.activeTab = tab;
        this.tabBtns.forEach(btn => {
            btn.classList.toggle('active', btn.dataset.controlTab === tab);
        });
        this.tabPanels.forEach(panel => {
            panel.classList.toggle('active', panel.dataset.controlTabPanel === tab);
        });
    }

    setStatus(message) {
        if (this.statusText) {
            this.statusText.textContent = message;
        }
    }

    countDuplicateNames() {
        const seen = new Set();
        let duplicates = 0;

        for (const blob of this.game.blobs) {
            const name = String(blob.name || '').trim();
            if (!name) continue;
            if (seen.has(name)) {
                duplicates++;
            } else {
                seen.add(name);
            }
        }

        return duplicates;
    }

    countOutOfBoundsBlobs() {
        let out = 0;
        for (const blob of this.game.blobs) {
            if (blob.x < 0 || blob.y < 0 || blob.x > this.game.mapWidth || blob.y > this.game.mapHeight) {
                out++;
            }
        }
        return out;
    }

    countOverLimitBlobs() {
        return Math.max(0, this.game.blobs.length - this.game.getBlobCount());
    }

    update() {
        if (this.duplicateCount) {
            this.duplicateCount.textContent = String(this.countDuplicateNames());
        }

        if (this.outOfBoundsCount) {
            this.outOfBoundsCount.textContent = String(this.countOutOfBoundsBlobs());
        }

        if (this.overLimitCount) {
            this.overLimitCount.textContent = String(this.countOverLimitBlobs());
        }

        this.setTab(this.activeTab);
    }
}
