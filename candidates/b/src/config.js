// Tuning and colours for Solmar City 3D (variant B). The world is the same 3200x2400 coastal
// city as the top-down game, laid out on the XZ plane (y is up). The view is a fixed 1280x720
// logical area; the 3D camera renders into it and a 2D canvas draws the HUD on top.

export const VIEW = { width: 1280, height: 720 };
export const WORLD = { width: 3200, height: 2400 };
export const STEP = 1 / 60;
export const ROAD_W = 96;
export const GRID = 400;
export const BEACH_Z = 2220;
export const WATER_Z = 2330;

export const PALETTE = {
  grass: 0x79a85b, sand: 0xe9d6a4, water: 0x2b8fb0, road: 0x43464f,
  sidewalk: 0xb7b0a0, lane: 0xf2d06b, park: 0x5d9448, plaza: 0x9d968a,
  roof: [0xc96f4a, 0xd8a24a, 0x7fa3b8, 0xb8576a, 0x8a7fb8, 0x5f9e7a, 0xc9823f, 0xa8b8c8],
  wall: 0xe8e2d4, glass: 0x9fc4d8,
  hudBg: 'rgba(10,14,24,0.82)', hudLine: 'rgba(255,255,255,0.16)',
  accent: '#ffb02e', danger: '#ff4d4d', text: '#f4f6fb', dim: '#aab4c8',
};

export const PLAYER = {
  radius: 1.1, walkSpeed: 13, runSpeed: 23, accel: 90,
  health: 100, armor: 0, punchDamage: 18, punchRange: 2.6, punchCooldown: 0.38,
  pistolDamage: 26, pistolRange: 60, pistolCooldown: 0.22, pistolAmmo: 24, maxAmmo: 120,
};

export const CAR = {
  length: 4.4, width: 2.2, accel: 34, brake: 55, reverseAccel: 20,
  maxSpeed: 46, maxReverse: 13, steerRate: 2.4, grip: 7.5, driftGrip: 2.2,
  health: 100, crashDamage: 8,
};

export const CAR_MODELS = [
  { name: 'Corto', color: 0xd84a3a, top: 42, accel: 1.0 },
  { name: 'Vela', color: 0x3a7bd8, top: 45, accel: 1.05 },
  { name: 'Brisa', color: 0xe8c832, top: 40, accel: 0.95 },
  { name: 'Onda', color: 0x37b878, top: 43, accel: 1.0 },
  { name: 'Faro', color: 0x8a5fd0, top: 47, accel: 1.1 },
  { name: 'Toro', color: 0x22262e, top: 49, accel: 1.15 },
  { name: 'Palma', color: 0xe8e8e8, top: 39, accel: 0.9 },
  { name: 'Coral', color: 0xe87a3a, top: 42, accel: 1.0 },
];

export const TRAFFIC_COUNT = 14;
export const PED_COUNT = 24;
export const PICKUP_COUNT = 10;

export const WANTED = {
  steal: 15, shoot: 2, killPed: 25, killCop: 40, hitPed: 20, ramCop: 12,
  decayPerSec: 1.6, hideDecayPerSec: 5, hideSeconds: 6, bustSeconds: 2.2,
};

export const SAVE_KEY = 'solmar-city-3d-save-v1';
export const BEST_KEY = 'solmar-city-3d-best-v1';

export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const angleLerp = (a, b, t) => {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
};
