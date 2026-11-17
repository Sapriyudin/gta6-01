// Pedestrians: they stroll the sidewalks toward a target corner, pick a new one on arrival, and
// run away from gunfire, crashes and speeding cars. A downed pedestrian stays down for a while,
// then gets up and walks off — the city does not forget, but it does move on.

import { WORLD, BEACH_Y, clamp } from './config.js';
import { rand, pick } from './random.js';
import { randomSidewalkPoint } from './city.js';

const SHIRTS = ['#e85d5d', '#5d8fe8', '#e8b25d', '#7ad07a', '#c05de8', '#5dd6d6', '#e8e8e8', '#f27ab0'];

export function spawnPed(rng) {
  const p = randomSidewalkPoint(rng);
  return {
    x: p.x, y: p.y, angle: rand(rng, 0, Math.PI * 2),
    speed: rand(rng, 45, 75), state: 'walk', tx: p.x, ty: p.y,
    shirt: pick(rng, SHIRTS), downTimer: 0, fleeTimer: 0, phase: rand(rng, 0, 6),
  };
}

export function stepPeds(state, dt) {
  for (const ped of state.peds) {
    if (ped.state === 'down') {
      ped.downTimer -= dt;
      if (ped.downTimer <= 0) {
        ped.state = 'walk';
        const p = randomSidewalkPoint(state.rng);
        ped.tx = p.x; ped.ty = p.y;
      }
      continue;
    }
    // Flee from the last alert (gunfire or a crash near them).
    const alert = state.alert;
    if (alert && alert.timer > 0) {
      const d = Math.hypot(ped.x - alert.x, ped.y - alert.y);
      if (d < 320) {
        ped.state = 'flee'; ped.fleeTimer = 2.5;
        ped.fleeAngle = Math.atan2(ped.y - alert.y, ped.x - alert.x);
      }
    }
    if (ped.state === 'flee') {
      ped.fleeTimer -= dt;
      const away = ped.fleeAngle ?? 0;
      ped.angle = away;
      ped.x += Math.cos(away) * 210 * dt;
      ped.y += Math.sin(away) * 210 * dt;
      ped.x = clamp(ped.x, 60, WORLD.width - 60);
      ped.y = clamp(ped.y, 60, BEACH_Y - 20);
      if (ped.fleeTimer <= 0) ped.state = 'walk';
      continue;
    }
    // Walk toward the target corner.
    const dx = ped.tx - ped.x, dy = ped.ty - ped.y;
    const d = Math.hypot(dx, dy);
    if (d < 12) {
      const p = randomSidewalkPoint(state.rng);
      ped.tx = p.x; ped.ty = p.y;
      continue;
    }
    ped.angle = Math.atan2(dy, dx);
    ped.x += (dx / d) * ped.speed * dt;
    ped.y += (dy / d) * ped.speed * dt;
  }
}

/** Any pedestrian close to a fast car gets knocked down (a crime — the player pays in heat). */
export function checkPedCarHits(state) {
  for (const car of state.cars) {
    if (car.speed < 120 || car.wrecked) continue;
    for (const ped of state.peds) {
      if (ped.state === 'down') continue;
      const d = Math.hypot(ped.x - car.x, ped.y - car.y);
      if (d < 26) {
        ped.state = 'down'; ped.downTimer = 6;
        if (car.driver === 'player') {
          state.events.push('heat:hitPed');
          state.events.push('crash');
        }
        state.alert = { x: ped.x, y: ped.y, timer: 1.5 };
      }
    }
  }
}
