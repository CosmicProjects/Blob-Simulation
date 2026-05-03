export const CONFIG = {
    BLOB_COUNT: 35,
    INITIAL_FOOD: 400,
    MAP_SIZE: 20000,
    RESET_MASS_LIMIT: 25000,
    COLORS: [
        '#6366f1', // Indigo
        '#a855f7', // Purple
        '#ec4899', // Pink
        '#3b82f6', // Blue
        '#10b981', // Emerald
        '#f59e0b', // Amber
        '#ef4444'  // Red
    ],
    BASE_SPEED: 1.8,
    MASS_GAIN_MULTI: 1.0,
    MIN_BLOB_SIZE: 50,
    MAX_BLOB_SIZE: 8000,
    FOOD_SIZE: 8,
    ZOOM_SMOOTHING: 0.05
};

export const UPGRADES = {
    MULTI: {
        id: 'multi',
        baseCost: 50,
        costScale: 1.8,
        increment: 0.2
    },
    SPEED: {
        id: 'speed',
        baseCost: 100,
        costScale: 2.0,
        increment: 0.3
    },
    FOOD: {
        id: 'food',
        baseCost: 150,
        costScale: 1.5,
        increment: 50
    }
};
