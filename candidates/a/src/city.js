// Solmar City itself: a road grid, the blocks between the roads, the buildings, parks and the
// beachfront that fill them, plus the queries the rest of the game asks the city — is this point
// on a road, is this rectangle blocked by a building, where is the nearest road point.

import { WORLD, ROAD_W, GRID, BEACH_Y, WATER_Y, PALETTE } from './config.js';
import { rand, randInt, pick } from './random.js';

export const ROAD_XS = [];
export const ROAD_YS = [];
for (let x = 200; x < WORLD.width; x += GRID) ROAD_XS.push(x);
for (let y = 200; y < BEACH_Y - 100; y += GRID) ROAD_YS.push(y);

export function buildCity(rng) {
  const buildings = [];
  const parks = [];
  const plazas = [];
  // Two park blocks and one plaza, picked from the block grid.
  const parkBlocks = new Set(['3,2', '5,3']);
  const plazaBlocks = new Set(['4,1']);
  for (let bx = 0; bx < ROAD_XS.length - 1; bx += 1) {
    for (let by = 0; by < ROAD_YS.length - 1; by += 1) {
      const x0 = ROAD_XS[bx] + ROAD_W / 2 + 14;
      const y0 = ROAD_YS[by] + ROAD_W / 2 + 14;
      const x1 = ROAD_XS[bx + 1] - ROAD_W / 2 - 14;
      const y1 = ROAD_YS[by + 1] - ROAD_W / 2 - 14;
      const key = `${bx},${by}`;
      if (parkBlocks.has(key)) { parks.push({ x: x0, y: y0, w: x1 - x0, h: y1 - y0 }); continue; }
      if (plazaBlocks.has(key)) { plazas.push({ x: x0, y: y0, w: x1 - x0, h: y1 - y0 }); continue; }
      // 1-4 buildings per block, each with its own roof colour and height (for the shadow).
      const n = randInt(rng, 1, 4);
      if (n === 1) {
        buildings.push(makeBuilding(rng, x0 + 20, y0 + 20, x1 - x0 - 40, y1 - y0 - 40));
      } else if (n === 2) {
        const vertical = rng() < 0.5;
        if (vertical) {
          const mid = (x0 + x1) / 2;
          buildings.push(makeBuilding(rng, x0 + 8, y0 + 8, mid - x0 - 20, y1 - y0 - 16));
          buildings.push(makeBuilding(rng, mid + 12, y0 + 8, x1 - mid - 20, y1 - y0 - 16));
        } else {
          const mid = (y0 + y1) / 2;
          buildings.push(makeBuilding(rng, x0 + 8, y0 + 8, x1 - x0 - 16, mid - y0 - 20));
          buildings.push(makeBuilding(rng, x0 + 8, mid + 12, x1 - x0 - 16, y1 - mid - 20));
        }
      } else {
        const mx = (x0 + x1) / 2, my = (y0 + y1) / 2;
        buildings.push(makeBuilding(rng, x0 + 8, y0 + 8, mx - x0 - 20, my - y0 - 20));
        buildings.push(makeBuilding(rng, mx + 12, y0 + 8, x1 - mx - 20, my - y0 - 20));
        buildings.push(makeBuilding(rng, x0 + 8, my + 12, mx - x0 - 20, y1 - my - 20));
        if (n === 4) buildings.push(makeBuilding(rng, mx + 12, my + 12, x1 - mx - 20, y1 - my - 20));
      }
    }
  }
  return { buildings, parks, plazas };
}

function makeBuilding(rng, x, y, w, h) {
  return {
    x, y, w, h,
    roof: pick(rng, PALETTE.roof),
    height: randInt(rng, 6, 26),
    windows: randInt(rng, 2, 6),
    seed: rng(),
  };
}

export function isOnRoad(x, y) {
  if (y >= BEACH_Y) return false;
  for (const rx of ROAD_XS) if (Math.abs(x - rx) <= ROAD_W / 2) return true;
  for (const ry of ROAD_YS) if (Math.abs(y - ry) <= ROAD_W / 2) return true;
  return false;
}

export function nearestRoadPoint(x, y) {
  let bx = ROAD_XS[0], bd = Infinity;
  for (const rx of ROAD_XS) { const d = Math.abs(x - rx); if (d < bd) { bd = d; bx = rx; } }
  let by = ROAD_YS[0], bd2 = Infinity;
  for (const ry of ROAD_YS) { const d = Math.abs(y - ry); if (d < bd2) { bd2 = d; by = ry; } }
  // Return the closer axis' road point, keeping the other coordinate.
  return bd <= bd2 ? { x: bx, y } : { x, y: by };
}

/** Push a circle out of every building it overlaps; returns true if it hit anything. */
export function collideBuildings(city, x, y, r) {
  let hit = false;
  for (const b of city.buildings) {
    const cx = Math.max(b.x, Math.min(x, b.x + b.w));
    const cy = Math.max(b.y, Math.min(y, b.y + b.h));
    const dx = x - cx, dy = y - cy;
    const d2 = dx * dx + dy * dy;
    if (d2 < r * r) {
      hit = true;
      const d = Math.sqrt(d2) || 0.001;
      const push = r - d;
      x += (dx / d) * push; y += (dy / d) * push;
    }
  }
  return { hit, x, y };
}

/** True when the point is inside a building rectangle. */
export function insideBuilding(city, x, y) {
  for (const b of city.buildings) {
    if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) return true;
  }
  return false;
}

/** A random point on a road (for spawning traffic, peds and pickups). */
export function randomRoadPoint(rng) {
  if (rng() < 0.55) {
    return { x: pick(rng, ROAD_XS) + rand(rng, -28, 28), y: rand(rng, 120, BEACH_Y - 120) };
  }
  return { x: rand(rng, 120, WORLD.width - 120), y: pick(rng, ROAD_YS) + rand(rng, -28, 28) };
}

/** A random sidewalk point beside a road (for pedestrians). */
export function randomSidewalkPoint(rng) {
  const p = randomRoadPoint(rng);
  const side = rng() < 0.5 ? -1 : 1;
  return { x: p.x + side * (ROAD_W / 2 + 14), y: p.y + side * (ROAD_W / 2 + 14) };
}

export { WATER_Y };
