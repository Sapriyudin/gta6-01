// Solmar City in 3D: the same road grid as the top-down game, but every block now carries
// buildings with real heights, parks with trees, and a beachfront. All gameplay queries (is this
// point on a road, is this circle inside a building) work on the XZ plane; the renderer turns
// this data into meshes.

import { WORLD, ROAD_W, GRID, BEACH_Z, PALETTE } from './config.js';
import { rand, randInt, pick } from './random.js';

export const ROAD_XS = [];
export const ROAD_ZS = [];
for (let x = 200; x < WORLD.width; x += GRID) ROAD_XS.push(x);
for (let z = 200; z < BEACH_Z - 100; z += GRID) ROAD_ZS.push(z);

export function buildCity(rng) {
  const buildings = [];
  const parks = [];
  const plazas = [];
  const parkBlocks = new Set(['3,2', '5,3']);
  const plazaBlocks = new Set(['4,1']);
  for (let bx = 0; bx < ROAD_XS.length - 1; bx += 1) {
    for (let bz = 0; bz < ROAD_ZS.length - 1; bz += 1) {
      const x0 = ROAD_XS[bx] + ROAD_W / 2 + 14;
      const z0 = ROAD_ZS[bz] + ROAD_W / 2 + 14;
      const x1 = ROAD_XS[bx + 1] - ROAD_W / 2 - 14;
      const z1 = ROAD_ZS[bz + 1] - ROAD_W / 2 - 14;
      const key = `${bx},${bz}`;
      if (parkBlocks.has(key)) { parks.push({ x: x0, z: z0, w: x1 - x0, h: z1 - z0 }); continue; }
      if (plazaBlocks.has(key)) { plazas.push({ x: x0, z: z0, w: x1 - x0, h: z1 - z0 }); continue; }
      const n = randInt(rng, 1, 4);
      const quads = n === 1
        ? [[x0 + 20, z0 + 20, x1 - x0 - 40, z1 - z0 - 40]]
        : n === 2
          ? [[x0 + 8, z0 + 8, (x1 - x0) / 2 - 12, z1 - z0 - 16], [(x0 + x1) / 2 + 4, z0 + 8, (x1 - x0) / 2 - 12, z1 - z0 - 16]]
          : [[x0 + 8, z0 + 8, (x1 - x0) / 2 - 12, (z1 - z0) / 2 - 12],
             [(x0 + x1) / 2 + 4, z0 + 8, (x1 - x0) / 2 - 12, (z1 - z0) / 2 - 12],
             [x0 + 8, (z0 + z1) / 2 + 4, (x1 - x0) / 2 - 12, (z1 - z0) / 2 - 12],
             [(x0 + x1) / 2 + 4, (z0 + z1) / 2 + 4, (x1 - x0) / 2 - 12, (z1 - z0) / 2 - 12]].slice(0, n);
      for (const [x, z, w, h] of quads) {
        buildings.push({
          x, z, w, h,
          height: randInt(rng, 8, 42),
          roof: pick(rng, PALETTE.roof),
          seed: rng(),
        });
      }
    }
  }
  return { buildings, parks, plazas };
}

export function isOnRoad(x, z) {
  if (z >= BEACH_Z) return false;
  for (const rx of ROAD_XS) if (Math.abs(x - rx) <= ROAD_W / 2) return true;
  for (const rz of ROAD_ZS) if (Math.abs(z - rz) <= ROAD_W / 2) return true;
  return false;
}

/** Push a circle (on the XZ plane) out of every building it overlaps. */
export function collideBuildings(city, x, z, r) {
  let hit = false;
  for (const b of city.buildings) {
    const cx = Math.max(b.x, Math.min(x, b.x + b.w));
    const cz = Math.max(b.z, Math.min(z, b.z + b.h));
    const dx = x - cx, dz = z - cz;
    const d2 = dx * dx + dz * dz;
    if (d2 < r * r) {
      hit = true;
      const d = Math.sqrt(d2) || 0.001;
      const push = r - d;
      x += (dx / d) * push; z += (dz / d) * push;
    }
  }
  return { hit, x, z };
}

export function insideBuilding(city, x, z) {
  for (const b of city.buildings) {
    if (x >= b.x && x <= b.x + b.w && z >= b.z && z <= b.z + b.h) return true;
  }
  return false;
}

export function randomRoadPoint(rng) {
  if (rng() < 0.55) {
    return { x: pick(rng, ROAD_XS) + rand(rng, -28, 28), z: rand(rng, 120, BEACH_Z - 120) };
  }
  return { x: rand(rng, 120, WORLD.width - 120), z: pick(rng, ROAD_ZS) + rand(rng, -28, 28) };
}

export function randomSidewalkPoint(rng) {
  const p = randomRoadPoint(rng);
  const side = rng() < 0.5 ? -1 : 1;
  return { x: p.x + side * (ROAD_W / 2 + 14), z: p.z + side * (ROAD_W / 2 + 14) };
}
