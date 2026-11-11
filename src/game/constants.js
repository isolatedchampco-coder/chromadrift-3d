export const FREQUENCIES = ['cyan', 'magenta', 'gold'];

export const FREQUENCY_META = {
  cyan: {
    id: 'cyan',
    index: 0,
    label: 'CYAN',
    glyph: '◆',
    keys: 'Q / 1',
    noteFreq: 523.25, // C5
  },
  magenta: {
    id: 'magenta',
    index: 1,
    label: 'MAGENTA',
    glyph: '▲',
    keys: 'E / 2',
    noteFreq: 659.25, // E5
  },
  gold: {
    id: 'gold',
    index: 2,
    label: 'GOLD',
    glyph: '◉',
    keys: 'R / 3',
    noteFreq: 783.99, // G5
  },
};

export const PALETTE_THEMES = {
  prism: {
    name: 'Prismatic Neon',
    cyan: 0x00f0ff,
    cyanCss: '#00f0ff',
    magenta: 0xff2096,
    magentaCss: '#ff2096',
    gold: 0xffbe0b,
    goldCss: '#ffbe0b',
  },
  aurora: {
    name: 'Aurora Borealis',
    cyan: 0x34f5c5,
    cyanCss: '#34f5c5',
    magenta: 0xb86bff,
    magentaCss: '#b86bff',
    gold: 0xff7a59,
    goldCss: '#ff7a59',
  },
  synth: {
    name: 'Solar Synthwave',
    cyan: 0x3b82ff,
    cyanCss: '#3b82ff',
    magenta: 0xff2a6d,
    magentaCss: '#ff2a6d',
    gold: 0xffd166,
    goldCss: '#ffd166',
  },
  contrast: {
    name: 'High-Contrast Vivid',
    cyan: 0x38d9ff,
    cyanCss: '#38d9ff',
    magenta: 0xff55b8,
    magentaCss: '#ff55b8',
    gold: 0xd9ff3b,
    goldCss: '#d9ff3b',
  },
};

export const BIOMES = [
  {
    name: 'ZONE 1 · PRISM BAY',
    skyTop: 0x050819,
    skyHorizon: 0x101c48,
    auroraA: 0x00f0ff,
    auroraB: 0x9b4dff,
    crystalTint: 0x1e4dff,
    trackAccent: 0x00d9ff,
    fogColor: 0x0b1230,
  },
  {
    name: 'ZONE 2 · SOLAR MIRAGE',
    skyTop: 0x14061f,
    skyHorizon: 0x45124c,
    auroraA: 0xff2a92,
    auroraB: 0xffaa2b,
    crystalTint: 0xff4b7d,
    trackAccent: 0xff7a45,
    fogColor: 0x260c32,
  },
  {
    name: 'ZONE 3 · BIOLUME ABYSS',
    skyTop: 0x03131b,
    skyHorizon: 0x0a3b45,
    auroraA: 0x2cffbe,
    auroraB: 0x00a8ff,
    crystalTint: 0x14d99b,
    trackAccent: 0x2bffc6,
    fogColor: 0x072630,
  },
  {
    name: 'ZONE 4 · HYPERNOVA CORE',
    skyTop: 0x18051a,
    skyHorizon: 0x521238,
    auroraA: 0xffbe0b,
    auroraB: 0x00f0ff,
    crystalTint: 0xbd4aff,
    trackAccent: 0xff3df0,
    fogColor: 0x2c0a2a,
  },
];

export const CAMERA_MODES = [
  {
    name: 'CHASE',
    offset: [0, 3.6, 8.6],
    lookAhead: [0, 1.4, -18],
    fovBase: 64,
  },
  {
    name: 'HYPER',
    offset: [0, 2.2, 6.1],
    lookAhead: [0, 1.1, -22],
    fovBase: 74,
  },
  {
    name: 'COCKPIT',
    offset: [0, 1.18, -0.35],
    lookAhead: [0, 1.0, -28],
    fovBase: 78,
  },
  {
    name: 'DRONE',
    offset: [0, 6.2, 13.5],
    lookAhead: [0, 1.0, -22],
    fovBase: 58,
  },
];

export const TRACK_HALF_WIDTH = 9.2;
export const LANE_WIDTH = 5.4;
export const PLAYER_BASE_Y = 0.95;

export const GAME_CONFIG = {
  baseSpeed: 46,
  maxBaseSpeed: 84,
  boostMult: 1.44,
  brakeMult: 0.62,
  strafeSpeed: 22,
  jumpVelocity: 17.5,
  doubleJumpVelocity: 15.5,
  gravity: 44,
  hoverGravityScale: 0.28,
  diveVelocity: -36,
  dashDistanceSpeed: 38,
  dashDuration: 0.24,
  dashCooldown: 0.65,
  fireCooldown: 0.14,
  novaDuration: 5.5,
  maxShields: 4,
};
