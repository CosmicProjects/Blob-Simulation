export class StorageManager {
    static SAVE_KEY = 'NEON_BLOB_SIM_DATA';

    static save(data) {
        try {
            const serializedData = JSON.stringify(data);
            localStorage.setItem(this.SAVE_KEY, serializedData);
        } catch (e) {
            console.error('Failed to save game data:', e);
        }
    }

    static load() {
        try {
            const data = localStorage.getItem(this.SAVE_KEY);
            return data ? JSON.parse(data) : null;
        } catch (e) {
            console.error('Failed to load game data:', e);
            return null;
        }
    }

    static clear() {
        localStorage.removeItem(this.SAVE_KEY);
    }
}
