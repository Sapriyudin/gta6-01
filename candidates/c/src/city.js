// The night city: a road grid, blocks with buildings, parks, a plaza, the beach and the sea.
// Buildings carry a precomputed grid of lit windows (warm, cyan or pink) and some carry a neon
// roof sign. Street lamps line the roads so the night has pools of light.
import { ROAD_XS, ROAD_YS, ROAD_W, BEACH_Y, WATER_Y, WORLD, PALETTE } from './config.js';
import { rand, randInt, pick } from './random.js';

export function buildCity(rng) {
  const buildings = [];
  const parks = [];
  const plazas = [];
  const lamps = [];
  const signs = [];
  const neonColors = [PALETTE.neonPink, PALETTE.neonCyan, PALETTE.neonAmber];
  const windowColors = ['#ffd166', '#7dd3fc', '#f9a8d4', '#fde68a', '#5eead4'];
  for (let i = 0; i < ROAD_XS.length - 1; i += 1) {
    for (let j = 0; j < ROAD_YS.length - 1; j += 1) {
      const x0 = ROAD_XS[i] + ROAD_W / 2 + 8;
      const z0 = ROAD_YS[j] + ROAD_W / 2 + 8;
      const x1 = ROAD_XS[i + 1] - ROAD_W / 2 - 8;
      const z1 = ROAD_YS[j + 1] - ROAD_W / 2 - 8;
      const roll = rng();
      if (roll < 0.16) {
        parks.push({ x: x0, y: z0, w: x1 - x0, h: z1 - z0 });
        continue;
      }
      if (roll < 0.22) {
        plazas.push({ x: x0, y: z0, w: x1 - x0, h: z1 - z0 });
        continue;
      }
      // One or two buildings per block, with a gap between them.
      const split = rng() < 0.5;
      const bw = split ? (x1 - x0 - 24) / 2 : x1 - x0;
      const bh = z1 - z0;
      for (let k = 0; k < (split ? 2 : 1); k += 1) {
        const bx = x0 + k * (bw + 24);
        const cols = Math.max(2, Math.floor(bw / 34));
        const rows = Math.max(2, Math.floor(bh / 34));
        const windows = [];
        for (let cy = 0; cy < rows; cy += 1) {
          for (let cx = 0; cx < cols; cx += 1) {
            if (rng() < 0.55) windows.push({ cx, cy, color: pick(rng, windowColors) });
          }
        }
        const b = {
          x: bx, y: z0, w: bw, h: bh, cols, rows, windows,
          neon: rng() < 0.4 ? pick(rng, neonColors) : null,
          height: randInt(rng, 1, 3),
        };
        buildings.push(b);
        if (b.neon) signs.push({ x: bx + bw / 2, y: z0 + 4, color: b.neon, text: pick(rng, ['24H', 'BAR', 'HOTEL', 'CLUB', 'NEON', 'TACOS']) });
      }
    }
  }
  // Lamps along every road, every 200 units, alternating sides.
  for (const rx of ROAD_XS) {
    for (let y = 100; y < BEACH_Y; y += 200) lamps.push({ x: rx + ROAD_W / 2 + 6, y });
  }
  for (const ry of ROAD_YS) {
    for (let x = 100; x < WORLD.width; x += 200) lamps.push({ x, y: ry + ROAD_W / 2 + 6 });
  }
  return { buildings, parks, plazas, lamps, signs };
}

export function isOnRoad(x, y) {
  for (const rx of ROAD_XS) if (Math.abs(x - rx) <= ROAD_W / 2 + 6) return true;
  for (const ry of ROAD_YS) if (Math.abs(y - ry) <= ROAD_W / 2 + 6) return true;
  return false;
}

export function randomRoadPoint(rng) {
  if (rng() < 0.5) {
    const rx = ROAD_XS[Math.floor(rng() * ROAD_XS.length)];
    return { x: rx + rand(rng, -8, 8), y: rand(rng, 100, BEACH_Y - 40) };
  }
  const ry = ROAD_YS[Math.floor(rng() * ROAD_YS.length)];
  return { x: rand(rng, 100, WORLD.width - 100), y: ry + rand(rng, -8, 8) };
}

// Push a circle out of every building it overlaps. Standard circle-vs-AABB test: clamp
// the centre to the building's (unexpanded) box, and push out radially when the distance
// is less than the radius, so cars and people slide along walls instead of sticking.
// If the centre is inside a building, push out along the smallest penetration axis.
export function collideBuildings(city, x, y, r) {
  let hit = false;
  for (const b of city.buildings) {
    const cx = Math.max(b.x, Math.min(x, b.x + b.w));
    const cy = Math.max(b.y, Math.min(y, b.y + b.h));
    const dx = x - cx, dy = y - cy;
    const d2 = dx * dx + dy * dy;
    if (d2 >= r * r) continue;
    hit = true;
    if (d2 === 0) {
      const left = x - b.x + r, right = b.x + b.w - x + r;
      const top = y - b.y + r, bottom = b.y + b.h - y + r;
      const m = Math.min(left, right, top, bottom);
      if (m === left) x -= left;
      else if (m === right) x += right;
      else if (m === top) y -= top;
      else y += bottom;
      continue;
    }
    const d = Math.sqrt(d2);
    const push = (r - d) / d;
    x += dx * push;
    y += dy * push;
  }
  return { hit, x, y };
}

export function pointInBuilding(city, x, y) {
  for (const b of city.buildings) {
    if (x > b.x && x < b.x + b.w && y > b.y && y < b.y + b.h) return true;
  }
  return false;
}

export { BEACH_Y, WATER_Y };
