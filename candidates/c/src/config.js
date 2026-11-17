// Solmar City — neon night. Shared constants: view, world, player, cars, wanted, palette.
// The city never sleeps: dark streets, neon signs, headlights and lit windows.
export const VIEW = { width: 1280, height: 720 };
export const WORLD = { width: 3200, height: 2400 };
export const STEP = 1 / 60;
export const TAU = Math.PI * 2;

// The road grid and the shoreline. Roads run at 200 + k*400; the beach starts at y=2220.
export const ROAD_XS = [200, 600, 1000, 1400, 1800, 2200, 2600, 3000];
export const ROAD_YS = [200, 600, 1000, 1400, 1800, 2200];
export const ROAD_W = 36;
export const BEACH_Y = 2220;
export const WATER_Y = 2330;

export const PLAYER = {
  radius: 13, walkSpeed: 145, runSpeed: 235, health: 100,
  pistolAmmo: 24, pistolDamage: 34, pistolCooldown: 0.22, punchDamage: 22, punchCooldown: 0.45,
};
export const CAR = {
  accel: 300, brake: 480, reverseAccel: 200, maxSpeed: 46, maxReverse: 18,
  turnRate: 2.5, grip: 8, crashDamage: 12, health: 100,
};
export const CAR_MODELS = [
  { name: 'Vela', color: '#3fae6a', top: 44, accel: 290, hp: 90 },
  { name: 'Comet', color: '#e8632c', top: 52, accel: 340, hp: 80 },
  { name: 'Toro', color: '#c94f5e', top: 40, accel: 260, hp: 150 },
  { name: 'Falcon', color: '#e8c832', top: 58, accel: 380, hp: 85 },
  { name: 'Onda', color: '#3f7fd0', top: 46, accel: 300, hp: 100 },
  { name: 'Lumen', color: '#9a6ee8', top: 48, accel: 310, hp: 95 },
];
export const TRAFFIC_COUNT = 16;
export const PED_COUNT = 26;
export const PICKUP_COUNT = 12;
export const WANTED = {
  steal: 15, shoot: 2, killPed: 25, killCop: 40, hitPed: 20, ramCop: 12,
  decay: 1.1, hideDelay: 6, star: 20,
};
export const MISSION_SPOTS = {
  stealCar: { x: 1000, y: 600 },
  garage: { x: 600, y: 1400 },
  package: { x: 2600, y: 200 },
  pier: { x: 200, y: 1400 },
  corner: { x: 1800, y: 1000 },
  escape: { x: 3000, y: 200 },
  safehouse: { x: 200, y: 200 },
  getawayCar: { x: 1400, y: 1800 },
  bank: { x: 2200, y: 600 },
  hideout: { x: 3000, y: 1400 },
};

// Night palette. The HUD stays dark glass (21st.dev: dark-first, one amber accent); the world
// is lit by neon, headlights and lit windows.
export const PALETTE = {
  bg: '#070a14',
  block: '#0f1524',
  park: '#0c1f16',
  plaza: '#181d2e',
  sand: '#1d1a2e',
  water: '#081826',
  moon: '#274b6b',
  road: '#12161f',
  sidewalk: '#1a2030',
  lane: '#8a6d2f',
  edge: '#1fb6c9',
  crosswalk: '#2a3247',
  wall: '#171e33',
  roof: '#232a42',
  glass: '#f5c542',
  neonPink: '#ff4d9d',
  neonCyan: '#22d3ee',
  neonAmber: '#ffb020',
  player: '#2dd4bf',
  cop: '#2f6df6',
  copLightR: '#ff3b30',
  copLightB: '#3b82f6',
  rival: '#ef4444',
  ped: '#d8c9a3',
  marker: '#ffd21a',
  text: '#f4f6fb',
  dim: '#aab4c8',
  accent: '#ffb020',
  good: '#34d399',
  bad: '#f87171',
  hudBg: 'rgba(8,11,20,0.78)',
  hudLine: 'rgba(255,255,255,0.09)',
};

export function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
export function angleLerp(a, b, t) {
  let d = b - a;
  while (d > Math.PI) d -= TAU;
  while (d < -Math.PI) d += TAU;
  return a + d * t;
}
export function dist(ax, ay, bx, by) { return Math.hypot(ax - bx, ay - by); }
export function angleTo(ax, ay, bx, by) { return Math.atan2(by - ay, bx - ax); }
