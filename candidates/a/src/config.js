// Every tuning number and colour for Solmar City (variant A: sun-soaked day) in one place.
// The view is a fixed 1280x720 logical area; the renderer scales it to the window, so no rule
// below depends on the screen size. The world is a 3200x2400 coastal city on a 400-unit road grid.

export const VIEW = { width: 1280, height: 720 };
export const WORLD = { width: 3200, height: 2400 };
export const STEP = 1 / 60;
export const ROAD_W = 96;
export const GRID = 400;
export const BEACH_Y = 2220; // sand starts here; water below WATER_Y
export const WATER_Y = 2330;

export const PALETTE = {
  grass: '#79a85b', grassDark: '#6b9a4e', sand: '#e9d6a4', water: '#39a7c9', waterDeep: '#2b8fb0',
  road: '#43464f', roadEdge: '#5a5e68', sidewalk: '#b7b0a0', lane: '#f2d06b',
  park: '#5d9448', parkPath: '#cbb98d', plaza: '#9d968a',
  roof: ['#c96f4a', '#d8a24a', '#7fa3b8', '#b8576a', '#8a7fb8', '#5f9e7a', '#c9823f', '#a8b8c8'],
  wall: '#e8e2d4', glass: '#9fc4d8',
  hudBg: 'rgba(10,14,24,0.82)', hudLine: 'rgba(255,255,255,0.16)',
  accent: '#ffb02e', accent2: '#37d67a', danger: '#ff4d4d', text: '#f4f6fb', dim: '#aab4c8',
};

export const PLAYER = {
  radius: 13, walkSpeed: 175, runSpeed: 305, accel: 1400,
  health: 100, armor: 0, punchDamage: 18, punchRange: 34, punchCooldown: 0.38,
  pistolDamage: 26, pistolRange: 460, pistolCooldown: 0.22, pistolAmmo: 24, maxAmmo: 120,
};

export const CAR = {
  length: 52, width: 26, accel: 430, brake: 700, reverseAccel: 260,
  maxSpeed: 560, maxReverse: 170, steerRate: 2.6, grip: 7.5, driftGrip: 2.2,
  health: 100, crashDamage: 8,
};

export const CAR_MODELS = [
  { name: 'Corto', color: '#d84a3a', top: 520, accel: 1.0 },
  { name: 'Vela', color: '#3a7bd8', top: 560, accel: 1.05 },
  { name: 'Brisa', color: '#e8c832', top: 500, accel: 0.95 },
  { name: 'Onda', color: '#37b878', top: 540, accel: 1.0 },
  { name: 'Faro', color: '#8a5fd0', top: 580, accel: 1.1 },
  { name: 'Toro', color: '#22262e', top: 610, accel: 1.15 },
  { name: 'Palma', color: '#e8e8e8', top: 490, accel: 0.9 },
  { name: 'Coral', color: '#e87a3a', top: 530, accel: 1.0 },
];

export const TRAFFIC_COUNT = 14;
export const PED_COUNT = 26;
export const PICKUP_COUNT = 10;

export const WANTED = {
  steal: 15, shoot: 2, killPed: 25, killCop: 40, hitPed: 20, ramCop: 12,
  decayPerSec: 1.6, hideDecayPerSec: 5, hideSeconds: 6, bustSeconds: 2.2,
};

export const SAVE_KEY = 'solmar-city-save-v1';
export const BEST_KEY = 'solmar-city-best-v1';

export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const dist2 = (ax, ay, bx, by) => { const dx = ax - bx, dy = ay - by; return dx * dx + dy * dy; };
export const angleLerp = (a, b, t) => {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
};
