export const SETTINGS_THEMES = [
    {
        id: 'midnight',
        name: 'Midnight Bloom',
        colors: {
            bg1: '#120b1e',
            bg2: '#1a122a',
            bg3: '#0e1522',
            accentPrimary: '#ff7ab0',
            accentSecondary: '#8f7cff',
            accentTertiary: '#70d8ff',
            glass: 'rgba(19, 14, 29, 0.16)',
            glow: 'rgba(255, 122, 176, 0.18)'
        }
    },
    {
        id: 'ocean',
        name: 'Ocean Candy',
        colors: {
            bg1: '#071622',
            bg2: '#0c2232',
            bg3: '#0a1328',
            accentPrimary: '#46d1ff',
            accentSecondary: '#7fffd4',
            accentTertiary: '#a58bff',
            glass: 'rgba(8, 23, 34, 0.18)',
            glow: 'rgba(70, 209, 255, 0.16)'
        }
    },
    {
        id: 'sunset',
        name: 'Sunset Pop',
        colors: {
            bg1: '#241008',
            bg2: '#381523',
            bg3: '#132035',
            accentPrimary: '#ff9f5a',
            accentSecondary: '#ff6e9a',
            accentTertiary: '#7ce2ff',
            glass: 'rgba(36, 16, 8, 0.18)',
            glow: 'rgba(255, 159, 90, 0.16)'
        }
    }
];

export const DEFAULT_SETTINGS = {
    themeId: 'midnight',
    mapScale: 1,
    foodDensity: 1,
    blobCount: 35,
    resetMassLimit: 25000,
    blobGender: 'girls',
    blobPlayMode: false,
    enableUpgrades: true,
    hideAllUI: false,
    showNames: true,
    showMass: true,
    showLeaderboard: true,
    showEventFeed: true,
    skinOpacity: 0.96,
    blobGlow: 1,
    backgroundMotion: 1,
    outlineStrength: 1,
    uiOpacity: 0.16
};
