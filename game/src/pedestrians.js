// Pedestrians: walk the sidewalks, cross at corners, and flee from gunfire, crashes and
// the player's car. The dead stay where they fell (until the world resets).
import { WORLD, ROAD_XS, ROAD_YS } from './config.js';
import { rand, pick } from './random.js';
import { randomRoadPoint, pointInBuilding } from './city.js';

const SHIRTS = ['#d8c9a3', '#e8a0b4', '#8fb8d8', '#c9d68f', '#d8a05e', '#b39ddb'];

export function spawnPed(rng) {
  const p = randomRoadPoint(rng);
  return {
    x: p.x + rand(rng, -14, 14), y: p.y + rand(rng, -14, 14),
    angle: rand(rng, 0, Math.PI * 2), speed: rand(rng, 18, 30),
    health: 100, state: 'walk', fleeTimer: 0, fleeAngle: 0,
    shirt: pick(rng, SHIRTS), bob: rand(rng, 0, 6),
  };
}

export function stepPeds(state, dt) {
  for (const ped of state.peds) {
    if (ped.state === 'dead') continue;
    ped.bob += dt * 6;
    if (ped.state === 'flee') {
      ped.fleeTimer -= dt;
      ped.x += Math.cos(ped.fleeAngle) * 95 * dt;
      ped.y += Math.sin(ped.fleeAngle) * 95 * dt;
      if (ped.fleeTimer <= 0) ped.state = 'walk';
    } else {
      ped.x += Math.cos(ped.angle) * ped.speed * dt;
      ped.y += Math.sin(ped.angle) * ped.speed * dt;
      // Turn at intersections and at the map edge; avoid walking through buildings.
      const nearRoad = ROAD_XS.some((rx) => Math.abs(ped.x - rx) < 20) || ROAD_YS.some((ry) => Math.abs(ped.y - ry) < 20);
      if (state.rng() < 0.01 && nearRoad) ped.angle += (state.rng() < 0.5 ? 1 : -1) * Math.PI / 2;
      if (pointInBuilding(state.city, ped.x, ped.y)) ped.angle += Math.PI;
      if (ped.x < 30 || ped.x > WORLD.width - 30 || ped.y < 30 || ped.y > 2300) ped.angle += Math.PI;
    }
    ped.x = Math.max(20, Math.min(WORLD.width - 20, ped.x));
    ped.y = Math.max(20, Math.min(2310, ped.y));
  }
  // A gunshot nearby sends everyone running.
  if (state.alert && state.alert.timer > 0) {
    for (const ped of state.peds) {
      if (ped.state === 'dead' || ped.state === 'flee') continue;
      const d = Math.hypot(ped.x - state.alert.x, ped.y - state.alert.y);
      if (d < 260) {
        ped.state = 'flee';
        ped.fleeTimer = 2.5;
        ped.fleeAngle = Math.atan2(ped.y - state.alert.y, ped.x - state.alert.x);
      }
    }
  }
}
