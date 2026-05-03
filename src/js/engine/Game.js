import { CONFIG, UPGRADES } from '../config.js';
import { Blob } from '../entities/Blob.js';
import { Food } from '../entities/Food.js';
import { Effect } from '../entities/Effect.js';
import { randomRange, dist, lerp } from '../utils.js';
import { UIHandler } from '../ui/UIHandler.js';
import { ControlPanel } from '../ui/control-panel/ControlPanel.js';
import { SettingsPanel } from '../ui/settings/SettingsPanel.js';
import { StorageManager } from './StorageManager.js';
import { BlobSkinManager } from '../graphics/BlobSkinManager.js';
import { GIRL_BLOB_NAMES, BOY_BLOB_NAMES } from '../data/blobNames.js';
import { DEFAULT_SETTINGS, SETTINGS_THEMES } from '../ui/settings/settingsThemes.js';
import { cleanupDuplicateBlobNames as fixDuplicateBlobNames, clampBlobsToMap, trimBlobsToLimit } from './BlobMaintenance.js';
import { pickBlobForPlayerReplacement, replaceBlobWithPlayer, removeBlobToMakeRoomForPlayerSplit } from './playerMode.js';
import { handleStuckBlobRespawn } from './stuckBlobRespawn.js';

export class Game {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        
        this.blobs = [];
        this.foods = [];
        this.effects = [];
        this.gameSpeed = 1;
        this.seasonStartTime = Date.now();
        this.lastFrameTime = null;
        this.savedBlobStates = null;
        this.nextBlobSpawnOrder = 1;
        this.settings = { ...DEFAULT_SETTINGS };
        this.playerBlobId = null;
        this.playerBlobIds = new Set();
        this.playerInput = {
            up: false,
            down: false,
            left: false,
            right: false,
            splitQueued: false,
            pointerActive: false,
            pointerX: 0,
            pointerY: 0
        };
        this.skinManagers = {
            girls: new BlobSkinManager([
                './src/assets/blob-skins/girl-skins-sheet-01.png',
                './src/assets/blob-skins/girl-skins-sheet-02.png'
            ]),
            boys: new BlobSkinManager([
                './src/assets/blob-skins/boy-skins-sheet-01.png',
                './src/assets/blob-skins/boy-skins-sheet-02.png'
            ]),
            both: new BlobSkinManager([
                './src/assets/blob-skins/girl-skins-sheet-01.png',
                './src/assets/blob-skins/girl-skins-sheet-02.png',
                './src/assets/blob-skins/boy-skins-sheet-01.png',
                './src/assets/blob-skins/boy-skins-sheet-02.png'
            ])
        };
        this.blobSkins = this.skinManagers.girls;
        this.usedBlobNames = new Set();
        this.availableBlobNames = [];
        
        this.camera = { x: 0, y: 0, zoom: 1 };
        
        // Default State
        this.blobsEaten = 0;
        this.upgradeLevels = {
            multi: 0,
            speed: 0,
            food: 0
        };

        // Load Saved State
        this.loadGame();
        this.blobSkins = this.getBlobSkinManager(this.settings.blobGender);

        this.ui = new UIHandler(this);
        this.controlPanel = new ControlPanel(this);
        this.settingsPanel = new SettingsPanel(this);
        this.applyTheme();
        this.applyUiState();
        this.initPlayerControls();

        this.init();
        this.loop();
        
        // Auto-save interval
        setInterval(() => this.saveGame(), 5000);
    }

    async init() {
        this.resize();
        window.addEventListener('resize', () => {
            this.resize();
            this.updateCamera();
        });

        Promise.all(Object.values(this.skinManagers).map((manager) => manager.load())).then(() => {
            this.applyBlobGender();
            for (const blob of this.blobs) {
                blob.applySkinTint();
            }
        });

        // Restore saved blobs first so sizes stay attached to the same blob
        // after a refresh. Fall back to fresh blobs when no save exists.
        if (!this.restoreSavedBlobs()) {
            this.resetAvailableBlobNames();
            for (let i = 0; i < this.getBlobCount(); i++) {
                this.spawnBlob();
            }
        }

        // Spawn initial food
        for (let i = 0; i < CONFIG.INITIAL_FOOD; i++) {
            this.spawnFood();
        }

        this.saveGame();
    }

    initPlayerControls() {
        window.addEventListener('keydown', (event) => {
            if (!this.settings?.blobPlayMode) {
                return;
            }

            if (this.isGameplayInputTarget(event.target)) {
                return;
            }

            const key = event.key.toLowerCase();
            const handled = key === 'w'
                || key === 'a'
                || key === 's'
                || key === 'd'
                || key === 'arrowup'
                || key === 'arrowdown'
                || key === 'arrowleft'
                || key === 'arrowright'
                || event.key === ' ';

            if (handled) {
                event.preventDefault();
            }

            if (key === 'w' || key === 'arrowup') this.playerInput.up = true;
            if (key === 's' || key === 'arrowdown') this.playerInput.down = true;
            if (key === 'a' || key === 'arrowleft') this.playerInput.left = true;
            if (key === 'd' || key === 'arrowright') this.playerInput.right = true;
            if (event.key === ' ') this.playerInput.splitQueued = true;
        });

        window.addEventListener('keyup', (event) => {
            if (!this.settings?.blobPlayMode) {
                return;
            }

            const key = event.key.toLowerCase();
            if (key === 'w' || key === 'arrowup') this.playerInput.up = false;
            if (key === 's' || key === 'arrowdown') this.playerInput.down = false;
            if (key === 'a' || key === 'arrowleft') this.playerInput.left = false;
            if (key === 'd' || key === 'arrowright') this.playerInput.right = false;
        });

        const updatePointer = (event) => {
            if (!this.settings?.blobPlayMode) {
                return;
            }

            if (this.isGameplayInputTarget(event.target)) {
                this.playerInput.pointerActive = false;
                return;
            }

            this.playerInput.pointerActive = true;
            this.playerInput.pointerX = event.clientX;
            this.playerInput.pointerY = event.clientY;
        };

        window.addEventListener('pointerdown', updatePointer);
        window.addEventListener('pointermove', updatePointer);
        window.addEventListener('pointerup', () => {
            this.playerInput.pointerActive = false;
        });
        window.addEventListener('pointercancel', () => {
            this.playerInput.pointerActive = false;
        });
        window.addEventListener('blur', () => {
            this.clearPlayerInput();
        });
    }

    isGameplayInputTarget(target) {
        return Boolean(target instanceof Element && target.closest('#ui-layer'));
    }

    clearPlayerInput() {
        this.playerInput.up = false;
        this.playerInput.down = false;
        this.playerInput.left = false;
        this.playerInput.right = false;
        this.playerInput.splitQueued = false;
        this.playerInput.pointerActive = false;
    }

    resize() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;

        // Massive world scale is driven from config so we can widen the arena
        // without rewriting the simulation loop.
        const aspect = this.canvas.width / this.canvas.height;
        this.mapWidth = CONFIG.MAP_SIZE * this.getMapScale();
        this.mapHeight = this.mapWidth / aspect;
    }

    spawnBlob(savedState = null) {
        const color = CONFIG.COLORS[Math.floor(Math.random() * CONFIG.COLORS.length)];
        const id = savedState?.id ?? (Date.now() + Math.random());
        const mass = typeof savedState?.mass === 'number'
            ? savedState.mass
            : randomRange(CONFIG.MIN_BLOB_SIZE, CONFIG.MIN_BLOB_SIZE * 2);
        const x = typeof savedState?.x === 'number'
            ? savedState.x
            : randomRange(0, this.mapWidth);
        const y = typeof savedState?.y === 'number'
            ? savedState.y
            : randomRange(0, this.mapHeight);
        const blob = new Blob(id, x, y, mass, color, this);
        blob.spawnOrder = typeof savedState?.spawnOrder === 'number' ? savedState.spawnOrder : this.nextBlobSpawnOrder++;
        const savedName = String(savedState?.name || '').trim();
        const preferredName = this.isNameInCurrentPool(savedName) ? savedName : null;
        blob.name = this.allocateBlobName(preferredName);
        this.usedBlobNames.add(blob.name);

        if (savedState) {
            if (typeof savedState.skinIndex === 'number') {
                blob.skinIndex = savedState.skinIndex;
            }
            if (typeof savedState.targetX === 'number') blob.targetX = savedState.targetX;
            if (typeof savedState.targetY === 'number') blob.targetY = savedState.targetY;
            if (savedState.velocity && typeof savedState.velocity.x === 'number' && typeof savedState.velocity.y === 'number') {
                blob.velocity = { x: savedState.velocity.x, y: savedState.velocity.y };
            }
            if (typeof savedState.splitTime === 'number') {
                blob.splitTime = savedState.splitTime;
            }
            blob.visualX = blob.x;
            blob.visualY = blob.y;
            blob.applySkinTint();
        }

        this.blobs.push(blob);
        return blob;
    }

    allocateBlobName(preferredName = null, forceFresh = false) {
        const cleanPreferred = String(preferredName || '').trim();
        const looksAutoGenerated = /^Blob\s+\d+$/i.test(cleanPreferred) || /\s\d+$/.test(cleanPreferred);

        if (!forceFresh && cleanPreferred && !looksAutoGenerated && !this.usedBlobNames.has(cleanPreferred)) {
            return cleanPreferred;
        }

        if (!this.availableBlobNames.length) {
            this.resetAvailableBlobNames();
        }

        while (this.availableBlobNames.length > 0) {
            const nextName = this.availableBlobNames.shift();
            if (!this.usedBlobNames.has(nextName)) {
                return nextName;
            }
        }

        return `Blob ${this.usedBlobNames.size + 1}`;
    }

    rebuildBlobNameRegistry() {
        this.usedBlobNames = new Set(this.blobs.map(blob => String(blob.name || '').trim()).filter(Boolean));
    }

    getNamePool(gender = this.settings.blobGender) {
        if (gender === 'boys') {
            return BOY_BLOB_NAMES;
        }

        if (gender === 'both') {
            return this.shuffleNames([...new Set([...GIRL_BLOB_NAMES, ...BOY_BLOB_NAMES])]);
        }

        return GIRL_BLOB_NAMES;
    }

    isNameInCurrentPool(name) {
        const cleanName = String(name || '').trim();
        if (!cleanName) return false;
        return this.getNamePool().includes(cleanName);
    }

    resetAvailableBlobNames() {
        this.availableBlobNames = this.shuffleNames([...this.getNamePool()]);
    }

    shuffleNames(names) {
        const result = [...names];
        for (let i = result.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [result[i], result[j]] = [result[j], result[i]];
        }
        return result;
    }

    spawnFood() {
        const x = randomRange(0, this.mapWidth);
        const y = randomRange(0, this.mapHeight);
        const color = CONFIG.COLORS[Math.floor(Math.random() * CONFIG.COLORS.length)];
        this.foods.push(new Food(x, y, color));
    }

    update(deltaMs = 16.67) {
        const massMulti = 1 + (this.upgradeLevels.multi * UPGRADES.MULTI.increment);
        const speedBoost = this.upgradeLevels.speed * UPGRADES.SPEED.increment;
        const foodLimit = this.getFoodLimit();
        const gameSpeed = this.gameSpeed;
        const playerBlobs = this.getPlayerBlobs();

        if (playerBlobs.length) {
            this.applyPlayerControl(playerBlobs);
        }

        // Update Blobs
        const newBlobs = [];
        for (const blob of this.blobs) {
            blob.update(this.foods, this.blobs, speedBoost, gameSpeed);

            if (handleStuckBlobRespawn(blob, this)) {
                continue;
            }
            
            // Check for split request
            const totalAfterPendingSplits = this.blobs.length + newBlobs.length;
            const canSpawnSplit = totalAfterPendingSplits < this.getBlobCount();
            if (blob.shouldSplit && (canSpawnSplit || blob.isPlayerControlled)) {
                if (!canSpawnSplit && blob.isPlayerControlled) {
                    removeBlobToMakeRoomForPlayerSplit(this.blobs, blob);
                }
                const splitBlob = blob.split();
                if (blob.isPlayerControlled) {
                    splitBlob.isPlayerControlled = true;
                    this.playerBlobIds.add(splitBlob.id);
                }
                newBlobs.push(splitBlob);
            } else if (blob.shouldSplit) {
                blob.shouldSplit = false;
            }

            // Check food collision
            for (const food of this.foods) {
                if (food.isAlive && dist(blob.x, blob.y, food.x, food.y) < blob.radius) {
                    food.isAlive = false;
                    blob.mass += (food.mass * 0.2) * massMulti;
                }
            }

            // Check blob-blob collision
            for (const other of this.blobs) {
                if (blob === other || !blob.isAlive || !other.isAlive) continue;
                
                const d = dist(blob.x, blob.y, other.x, other.y);
                if (d < blob.radius && blob.mass > other.mass * 1.5) {
                    // Blob eats other
                    blob.mass += other.mass * 0.5 * massMulti;
                    other.isAlive = false;
                    if (!blob.isPlayerControlled) {
                        this.blobsEaten++;
                    }
                    
                    // Trigger death effect
                    this.effects.push(new Effect(other.x, other.y, other.color));
                    
                    // Add log
                    this.ui.addLog(`${blob.name} ate ${other.name}`, blob.color);
                }
            }
        }
        this.blobs.push(...newBlobs);

        // Update Effects
        for (const effect of this.effects) {
            effect.update();
        }
        this.effects = this.effects.filter(e => e.isAlive);

        // Cleanup and Respawn
        this.blobs = this.blobs.filter(b => b.isAlive);
        while (this.blobs.length < this.getBlobCount()) {
            this.spawnBlob();
        }

        this.foods = this.foods.filter(f => f.isAlive);
        while (this.foods.length < foodLimit) {
            this.spawnFood();
        }

        this.updateCamera();
        this.ui.update();
        this.controlPanel?.update();
        this.settingsPanel?.update();

        // Check for Global Reset Threshold.
        const winner = this.blobs.find(b => b.mass >= this.getResetMassLimit());
        if (winner) {
            this.resetSimulation();
        }
    }

    updateCamera() {
        const playerBlob = this.getPlayerBlob();

        if (playerBlob) {
            this.camera.x = lerp(this.camera.x, playerBlob.x, 0.14);
            this.camera.y = lerp(this.camera.y, playerBlob.y, 0.14);
            this.camera.zoom = lerp(this.camera.zoom, this.getPlayerCameraZoom(playerBlob), 0.08);
            return;
        }

        // Fit the massive 10,000 unit world to the screen
        this.camera.zoom = this.canvas.width / this.mapWidth;
        
        // Center the camera
        this.camera.x = this.mapWidth / 2;
        this.camera.y = this.mapHeight / 2;
    }

    saveGame() {
        const data = {
            blobsEaten: this.blobsEaten,
            upgradeLevels: this.upgradeLevels,
            gameSpeed: this.gameSpeed,
            seasonStartTime: this.seasonStartTime,
            settings: this.settings,
            blobs: this.blobs.map(blob => ({
                id: blob.id,
                name: blob.name,
                x: blob.x,
                y: blob.y,
                mass: blob.mass,
                skinIndex: blob.skinIndex,
                targetX: blob.targetX,
                targetY: blob.targetY,
                velocity: blob.velocity,
                splitTime: blob.splitTime,
                spawnOrder: blob.spawnOrder
            }))
        };
        StorageManager.save(data);
    }

    loadGame() {
        const data = StorageManager.load();
        if (data) {
            this.blobsEaten = data.blobsEaten || 0;
            this.upgradeLevels = { ...this.upgradeLevels, ...data.upgradeLevels };
            this.gameSpeed = data.gameSpeed || 1;
            this.savedBlobStates = Array.isArray(data.blobs) ? data.blobs : null;
            this.settings = { ...DEFAULT_SETTINGS, ...(data.settings || {}) };
            if (typeof data.seasonStartTime === 'number') {
                this.seasonStartTime = data.seasonStartTime;
            } else if (typeof data.seasonElapsedMs === 'number') {
                this.seasonStartTime = Date.now() - data.seasonElapsedMs;
            } else {
                this.seasonStartTime = Date.now();
            }

            if (typeof data.seasonStartTime !== 'number' && typeof data.seasonElapsedMs !== 'number') {
                this.saveGame();
            }
        } else {
            this.settings = { ...DEFAULT_SETTINGS };
        }
    }

    restoreSavedBlobs() {
        if (!Array.isArray(this.savedBlobStates) || this.savedBlobStates.length === 0) {
            return false;
        }

        this.blobs = [];
        this.usedBlobNames.clear();
        this.resetAvailableBlobNames();

        for (const saved of this.savedBlobStates.slice(0, this.getBlobCount())) {
            this.spawnBlob(saved);
        }

        while (this.blobs.length < this.getBlobCount()) {
            this.spawnBlob();
        }

        this.rebuildBlobNameRegistry();
        this.nextBlobSpawnOrder = this.blobs.reduce((max, blob) => Math.max(max, Number(blob.spawnOrder) || 0), 0) + 1;

        return true;
    }

    cleanupDuplicateBlobNames() {
        const result = fixDuplicateBlobNames(this.blobs, (preferredName) => this.allocateBlobName(preferredName));
        if (result.renamed > 0) {
            this.rebuildBlobNameRegistry();
            this.ui.addLog(`Fixed ${result.renamed} duplicate blob name${result.renamed === 1 ? '' : 's'}.`, '#ffffff');
            this.saveGame();
        }
        return result;
    }

    repairOutOfBoundsBlobs() {
        const result = clampBlobsToMap(this.blobs, this.mapWidth, this.mapHeight);
        if (result.moved > 0) {
            this.ui.addLog(`Returned ${result.moved} blob${result.moved === 1 ? '' : 's'} to the map.`, '#ffffff');
            this.saveGame();
        }
        return result;
    }

    trimOverLimitBlobs() {
        const targetCount = this.getBlobCount();
        const result = trimBlobsToLimit(this.blobs, targetCount);

        if (result.removed > 0) {
            this.blobs = this.blobs.filter((blob) => blob.isAlive);
            this.rebuildBlobNameRegistry();
            this.ui.addLog(`Removed ${result.removed} extra blob${result.removed === 1 ? '' : 's'}.`, '#ffffff');
            this.saveGame();
        }

        return result;
    }

    getSeasonElapsedMs() {
        return Date.now() - this.seasonStartTime;
    }

    getMapScale() {
        const raw = Number(this.settings.mapScale);
        return Number.isFinite(raw) && raw > 0 ? raw : 1;
    }

    getMapUpgradeScale() {
        return 1 + (this.upgradeLevels.multi * UPGRADES.MULTI.increment);
    }

    getFoodDensity() {
        const raw = Number(this.settings.foodDensity);
        return Number.isFinite(raw) && raw > 0 ? raw : 1;
    }

    getResetMassLimit() {
        const raw = Number(this.settings.resetMassLimit);
        const baseLimit = Number.isFinite(raw) && raw > 0 ? raw : CONFIG.RESET_MASS_LIMIT;
        return Math.max(1, Math.round(baseLimit * this.getMapUpgradeScale()));
    }

    getFoodLimit() {
        const density = this.getFoodDensity();
        const baseFood = CONFIG.INITIAL_FOOD + (this.upgradeLevels.food * UPGRADES.FOOD.increment);
        return Math.max(0, Math.floor(baseFood * density * this.getMapUpgradeScale()));
    }

    getBlobCount() {
        const raw = Number(this.settings.blobCount);
        const baseCount = Number.isFinite(raw) ? Math.round(raw) : CONFIG.BLOB_COUNT;
        return Math.max(1, baseCount);
    }

    applyBlobCount() {
        const targetCount = this.getBlobCount();

        if (this.blobs.length > targetCount) {
            trimBlobsToLimit(this.blobs, targetCount);
            this.blobs = this.blobs.filter((blob) => blob.isAlive);
        }

        while (this.blobs.length < targetCount) {
            this.spawnBlob();
        }

        this.rebuildBlobNameRegistry();
    }

    refreshWorldBounds() {
        this.resize();
        this.repairOutOfBoundsBlobs();
        this.updateCamera();
    }

    getTheme(themeId = this.settings.themeId) {
        return SETTINGS_THEMES.find((theme) => theme.id === themeId) || SETTINGS_THEMES[0];
    }

    getBlobSkinManager(gender = this.settings.blobGender) {
        return this.skinManagers[gender] || this.skinManagers.girls;
    }

    applyBlobPlayMode(enabled) {
        if (!enabled) {
            this.playerBlobId = null;
            this.playerBlobIds.clear();
            this.clearPlayerInput();
            for (const blob of this.blobs) {
                blob.isPlayerControlled = false;
            }
            return;
        }

        const sourceBlob = pickBlobForPlayerReplacement(this.blobs);
        if (sourceBlob) {
            const playerBlob = replaceBlobWithPlayer(sourceBlob, this);
            if (playerBlob) {
                this.playerBlobIds = new Set([playerBlob.id]);
                this.playerBlobId = playerBlob.id;
            }
        }
    }

    getPlayerBlob(forceRefresh = false) {
        const playerBlobs = this.getPlayerBlobs(forceRefresh);
        return playerBlobs[0] || null;
    }

    getPlayerBlobs(forceRefresh = false) {
        if (!this.settings.blobPlayMode) {
            this.playerBlobIds.clear();
            for (const blob of this.blobs) {
                blob.isPlayerControlled = false;
            }
            this.playerBlobId = null;
            return [];
        }

        const alivePlayerBlobs = [...this.playerBlobIds]
            .map((id) => this.blobs.find((candidate) => candidate.id === id && candidate.isAlive))
            .filter(Boolean);

        let playerBlobs = forceRefresh ? [] : alivePlayerBlobs;

        if (!playerBlobs.length) {
            const primaryBlob = [...this.blobs]
                .filter((candidate) => candidate.isAlive)
                .sort((a, b) => {
                    if (b.mass !== a.mass) {
                        return b.mass - a.mass;
                    }
                    return (a.spawnOrder || 0) - (b.spawnOrder || 0);
                })[0] || null;

            playerBlobs = primaryBlob ? [primaryBlob] : [];
            this.playerBlobIds = new Set(playerBlobs.map((blob) => blob.id));
        } else {
            this.playerBlobIds = new Set(playerBlobs.map((blob) => blob.id));
        }

        this.playerBlobId = playerBlobs[0]?.id ?? null;

        for (const candidate of this.blobs) {
            candidate.isPlayerControlled = playerBlobs.some((blob) => blob.id === candidate.id);
        }

        return playerBlobs;
    }

    applyPlayerControl(blobs) {
        if (!Array.isArray(blobs) || blobs.length === 0) {
            return;
        }

        const moveX = (this.playerInput.right ? 1 : 0) - (this.playerInput.left ? 1 : 0);
        const moveY = (this.playerInput.down ? 1 : 0) - (this.playerInput.up ? 1 : 0);
        const target = this.playerInput.pointerActive
            ? this.screenToWorld(this.playerInput.pointerX, this.playerInput.pointerY)
            : null;

        for (const blob of blobs) {
            if (target) {
                blob.targetX = target.x;
                blob.targetY = target.y;
            } else if (moveX || moveY) {
                const length = Math.hypot(moveX, moveY) || 1;
                const travel = Math.max(260, blob.radius * 4);
                const nextTarget = blob.clampTarget(
                    blob.x + (moveX / length) * travel,
                    blob.y + (moveY / length) * travel
                );
                blob.targetX = nextTarget.x;
                blob.targetY = nextTarget.y;
            } else {
                blob.targetX = blob.x;
                blob.targetY = blob.y;
            }
        }

        if (this.playerInput.splitQueued) {
            for (const blob of blobs) {
                blob.shouldSplit = true;
            }
            this.playerInput.splitQueued = false;
        }

        for (const blob of blobs) {
            blob.state = 'PLAYER';
        }
    }

    screenToWorld(screenX, screenY) {
        return {
            x: this.camera.x + ((screenX - (this.canvas.width / 2)) / this.camera.zoom),
            y: this.camera.y + ((screenY - (this.canvas.height / 2)) / this.camera.zoom)
        };
    }

    getPlayerCameraZoom(blob) {
        const shortSide = Math.min(this.canvas.width, this.canvas.height) || 1;
        const target = shortSide / (1200 + (blob.radius * 2.8));
        return Math.max(0.22, Math.min(0.9, target));
    }

    applyBlobGender() {
        this.blobSkins = this.getBlobSkinManager(this.settings.blobGender);
        this.resetAvailableBlobNames();

        const refreshSkins = () => {
            this.usedBlobNames.clear();
            for (const blob of this.blobs) {
                blob.skinIndex = this.blobSkins.getSkinIndex(blob.id);
                blob.applySkinTint();
                blob.name = this.allocateBlobName(null, true);
                this.usedBlobNames.add(blob.name);
            }
            this.rebuildBlobNameRegistry();
        };

        if (this.blobSkins.loaded) {
            refreshSkins();
            return;
        }

        this.blobSkins.load().then(refreshSkins);
    }

    applyTheme() {
        const theme = this.getTheme(this.settings.themeId);
        const colors = theme?.colors || SETTINGS_THEMES[0].colors;
        const root = document.documentElement;

        root.style.setProperty('--theme-bg-1', colors.bg1);
        root.style.setProperty('--theme-bg-2', colors.bg2);
        root.style.setProperty('--theme-bg-3', colors.bg3);
        root.style.setProperty('--theme-accent-primary', colors.accentPrimary);
        root.style.setProperty('--theme-accent-secondary', colors.accentSecondary);
        root.style.setProperty('--theme-accent-tertiary', colors.accentTertiary);
        root.style.setProperty('--theme-glass-bg', `rgba(19, 14, 29, ${this.settings.uiOpacity})`);
        root.style.setProperty('--theme-glow', colors.glow);
        root.style.setProperty('--theme-ui-opacity', String(this.settings.uiOpacity));

        document.body.dataset.theme = theme?.id || 'midnight';

        window.dispatchEvent(new CustomEvent('blob-theme-change', {
            detail: {
                themeId: theme?.id || 'midnight',
                colors,
                settings: { ...this.settings }
            }
        }));
    }

    applyUiState() {
        const body = document.body;
        if (!body) return;

        body.classList.toggle('ui-hidden', this.settings.hideAllUI === true);
        body.classList.toggle('upgrades-disabled', this.settings.enableUpgrades === false);
    }

    updateSetting(key, value) {
        if (!(key in DEFAULT_SETTINGS)) {
            return;
        }

        this.settings = {
            ...this.settings,
            [key]: value
        };

        if (key === 'uiOpacity' || key === 'themeId') {
            this.applyTheme();
        }

        if (key === 'mapScale') {
            this.refreshWorldBounds();
        }

        if (key === 'blobCount') {
            this.applyBlobCount();
        }

        if (key === 'blobGender') {
            this.applyBlobGender();
        }

        if (key === 'blobPlayMode') {
            this.applyBlobPlayMode(value);
        }

        if (key === 'enableUpgrades' || key === 'hideAllUI') {
            this.applyUiState();
        }

        window.dispatchEvent(new CustomEvent('blob-settings-change', {
            detail: { settings: { ...this.settings } }
        }));
        this.saveGame();
    }

    setTheme(themeId) {
        const theme = this.getTheme(themeId);
        this.settings.themeId = theme.id;
        this.applyTheme();
        window.dispatchEvent(new CustomEvent('blob-settings-change', {
            detail: { settings: { ...this.settings } }
        }));
        this.saveGame();
    }

    resetToDefaultSettings() {
        this.settings = { ...DEFAULT_SETTINGS };
        this.applyTheme();
        this.applyUiState();
        this.applyBlobPlayMode(this.settings.blobPlayMode);
        this.refreshWorldBounds();
        window.dispatchEvent(new CustomEvent('blob-settings-change', {
            detail: { settings: { ...this.settings } }
        }));
        this.saveGame();
    }

    resetSimulation() {
        // Log the big event
        this.ui.addLog("MASSIVE RESET: World reached critical mass!", "#ffffff");
        
        // Reset all blobs to initial state
        for (const blob of this.blobs) {
            blob.mass = randomRange(CONFIG.MIN_BLOB_SIZE, CONFIG.MIN_BLOB_SIZE * 2);
            blob.x = randomRange(0, this.mapWidth);
            blob.y = randomRange(0, this.mapHeight);
            blob.visualX = blob.x;
            blob.visualY = blob.y;
            blob.visualRotation = 0;
            blob.visualSquashX = 1;
            blob.visualSquashY = 1;
            blob.velocity = { x: 0, y: 0 };
        }
        
        // Refresh food
        this.foods = [];
        const foodLimit = this.getFoodLimit();
        for (let i = 0; i < foodLimit; i++) {
            this.spawnFood();
        }

        this.seasonStartTime = Date.now();
        this.saveGame();
    }

    resetBlobSizes() {
        this.ui.addLog("Blob sizes reset.", "#ffffff");

        for (const blob of this.blobs) {
            blob.mass = randomRange(CONFIG.MIN_BLOB_SIZE, CONFIG.MIN_BLOB_SIZE * 2);
            blob.velocity = { x: 0, y: 0 };
            blob.visualSquashX = 1;
            blob.visualSquashY = 1;
        }

        this.seasonStartTime = Date.now();
        this.saveGame();
    }

    draw() {
        // Clear canvas entirely to reveal the animated background
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        this.ctx.save();
        
        // Apply camera transformations
        this.ctx.translate(this.canvas.width / 2, this.canvas.height / 2);
        this.ctx.scale(this.camera.zoom, this.camera.zoom);
        this.ctx.translate(-this.camera.x, -this.camera.y);

        // Entities
        for (const food of this.foods) {
            food.draw(this.ctx);
        }

        // Death Effects
        for (const effect of this.effects) {
            effect.draw(this.ctx);
        }

        // Draw smaller blobs first so bigger ones are on top
        const sortedBlobs = [...this.blobs].sort((a, b) => a.mass - b.mass);
        for (const blob of sortedBlobs) {
            blob.draw(this.ctx);
        }

        this.ctx.restore();
    }

    loop(timestamp = performance.now()) {
        if (this.lastFrameTime == null) {
            this.lastFrameTime = timestamp;
        }

        const deltaMs = timestamp - this.lastFrameTime;
        this.lastFrameTime = timestamp;

        this.update(deltaMs);
        this.draw();
        requestAnimationFrame((nextTimestamp) => this.loop(nextTimestamp));
    }
}
