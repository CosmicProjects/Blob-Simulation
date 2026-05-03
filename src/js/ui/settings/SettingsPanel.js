import { DEFAULT_SETTINGS, SETTINGS_THEMES } from './settingsThemes.js';

export class SettingsPanel {
    constructor(game) {
        this.game = game;
        this.root = document.getElementById('settings-panel');
        this.toggleBtn = document.getElementById('settings-toggle');
        this.tabBtns = document.querySelectorAll('[data-settings-tab]');
        this.tabPanels = document.querySelectorAll('[data-settings-tab-panel]');
        this.themeBtns = document.querySelectorAll('[data-theme-id]');
        this.genderBtns = document.querySelectorAll('[data-blob-gender]');
        this.settingsInputs = document.querySelectorAll('[data-setting-key]');
        this.playToggleBtn = document.getElementById('blob-play-toggle-btn');
        this.playNameText = document.getElementById('blob-play-name');
        this.playStatusText = document.getElementById('blob-play-status');
        this.playStatusCopy = document.getElementById('blob-play-status-copy');
        this.statusText = document.getElementById('settings-status-text');
        this.resetBtn = document.getElementById('settings-reset-btn');
        this.closeBtn = document.getElementById('settings-close-btn');

        this.isOpen = false;
        this.activeTab = 'themes';

        this.init();
        this.syncUI();
    }

    init() {
        if (this.toggleBtn) {
            this.toggleBtn.addEventListener('click', () => this.toggle());
        }

        if (this.closeBtn) {
            this.closeBtn.addEventListener('click', () => this.close());
        }

        document.addEventListener('click', (event) => {
            if (this.root?.contains(event.target)) {
                return;
            }

            if (!this.isOpen && this.game.settings?.hideAllUI) {
                this.open();
            }
        });

        window.addEventListener('keydown', (event) => {
            if (event.key === 'Escape' && this.isOpen) {
                this.close();
            }
        });

        this.tabBtns.forEach(btn => {
            btn.addEventListener('click', () => this.setTab(btn.dataset.settingsTab));
        });

        this.themeBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                this.game.setTheme(btn.dataset.themeId);
                this.setStatus(`Theme set to ${btn.dataset.themeName || btn.dataset.themeId}.`);
                this.syncUI();
            });
        });

        this.genderBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                this.game.updateSetting('blobGender', btn.dataset.blobGender);
                this.setStatus(`Blob skins set to ${btn.textContent.toLowerCase()}.`);
                this.syncUI();
            });
        });

        if (this.playToggleBtn) {
            this.playToggleBtn.addEventListener('click', () => {
                const nextValue = !this.game.settings?.blobPlayMode;
                this.game.updateSetting('blobPlayMode', nextValue);
                this.setStatus(nextValue ? 'Blob mode enabled.' : 'Blob mode disabled.');
                this.syncUI();
            });
        }

        this.settingsInputs.forEach(input => {
            const key = input.dataset.settingKey;
            const type = input.dataset.settingType;

            const handler = () => {
                let value;
                if (type === 'boolean') {
                    value = input.checked;
                } else if (type === 'range') {
                    value = Number(input.value);
                } else {
                    value = input.value;
                }

                this.game.updateSetting(key, value);
                this.syncUI();
            };

            input.addEventListener('input', handler);
            input.addEventListener('change', handler);
        });

        if (this.resetBtn) {
            this.resetBtn.addEventListener('click', () => {
                this.game.resetToDefaultSettings();
                this.setStatus('Settings restored to defaults.');
                this.syncUI();
            });
        }
    }

    open() {
        this.isOpen = true;
        this.root?.classList.add('open');
        this.toggleBtn?.setAttribute('aria-expanded', 'true');
        document.body?.classList.add('settings-open');
    }

    close() {
        this.isOpen = false;
        this.root?.classList.remove('open');
        this.toggleBtn?.setAttribute('aria-expanded', 'false');
        document.body?.classList.remove('settings-open');
    }

    toggle() {
        if (this.isOpen) {
            this.close();
        } else {
            this.open();
        }
    }

    setTab(tab) {
        this.activeTab = tab;
        this.tabBtns.forEach(btn => {
            btn.classList.toggle('active', btn.dataset.settingsTab === tab);
        });
        this.tabPanels.forEach(panel => {
            panel.classList.toggle('active', panel.dataset.settingsTabPanel === tab);
        });
    }

    setStatus(message) {
        if (this.statusText) {
            this.statusText.textContent = message;
        }
    }

    syncUI() {
        const settings = this.game.settings || DEFAULT_SETTINGS;

        this.themeBtns.forEach(btn => {
            btn.classList.toggle('active', btn.dataset.themeId === settings.themeId);
        });

        this.genderBtns.forEach(btn => {
            btn.classList.toggle('active', btn.dataset.blobGender === settings.blobGender);
        });

        const activeBlob = this.game.getPlayerBlob?.();
        if (this.playToggleBtn) {
            this.playToggleBtn.textContent = settings.blobPlayMode ? 'EXIT BLOB MODE' : 'ENTER BLOB MODE';
        }

        if (this.playNameText) {
            this.playNameText.textContent = activeBlob?.name || 'None';
        }

        if (this.playStatusCopy) {
            this.playStatusCopy.textContent = settings.blobPlayMode
                ? (activeBlob ? 'You are controlling this blob right now.' : 'Waiting for a live blob to control.')
                : 'Blob mode is off.';
        }

        if (this.playStatusText) {
            this.playStatusText.textContent = settings.blobPlayMode
                ? 'Move with WASD or drag on empty space, and press Space to split the selected blob.'
                : 'Turn this on to follow and control a live blob.';
        }

        this.settingsInputs.forEach(input => {
            const key = input.dataset.settingKey;
            const type = input.dataset.settingType;
            const value = settings[key];

            if (type === 'boolean') {
                input.checked = Boolean(value);
            } else {
                input.value = String(value);
                const valueLabel = input.parentElement?.querySelector('[data-setting-value]');
                if (valueLabel) {
                    valueLabel.textContent = this.formatSettingValue(key, value);
                }
            }
        });

        this.setTab(this.activeTab);
    }

    update() {
        this.syncUI();
    }

    formatSettingValue(key, value) {
        if (key === 'mapScale' || key === 'foodDensity') {
            return `${Number(value).toFixed(2)}x`;
        }

        if (key === 'blobCount') {
            return `${Math.round(Number(value))}`;
        }

        if (key === 'resetMassLimit') {
            return `${Math.round(Number(value))}`;
        }

        if (typeof value === 'number') {
            return Number(value).toFixed(2);
        }

        return String(value);
    }

    static getDefaultSettings() {
        return { ...DEFAULT_SETTINGS };
    }

    static getThemes() {
        return SETTINGS_THEMES;
    }
}
