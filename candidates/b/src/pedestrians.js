// Pedestrians for the 3D city: they stroll the sidewalks toward a target corner, pick a new one
// on arrival, and run away from gunfire, crashes and speeding cars. A downed pedestrian stays
// down for a while, then gets up and walks off.

import { WORLD, BEACH_Z, clamp } from './config.js';
import { rand, pick } from './random.js';
import { randomSidewalkPoint } from './city.js';

const SHIRTS = [0xe85d5d, 0x5d8fe8, 0xe8b25d, 0x7ad07a, 0xc05de8, 0x5dd6d6, 0xe8e8e8, 0xf27ab0];

export function spawnPed(rng) {
  const p = randomSidewalkPoint(rng);
  return {
    x: p.x, z: p.z, angle: rand(rng, 0, Math.PI * 2),
    speed: rand(rng, 3.5, 5.5), state: 'walk', tx: p.x, tz: p.z,
    shirt: pick(rng, SHIRTS), downTimer: 0, fleeTimer: 0, fleeAngle: 0, phase: rand(rng, 0, 6),
  };
}

export function stepPeds(state, dt) {
  for (const ped of state.peds) {
    if (ped.state === 'down') {
      ped.downTimer -= dt;
      if (ped.downTimer <= 0) {
        ped.state = 'walk';
        const p = randomSidewalkPoint(state.rng);
        ped.tx = p.x; ped.tz = p.z;
      }
      continue;
    }
    const alert = state.alert;
    if (alert && alert.timer > 0) {
      const d = Math.hypot(ped.x - alert.x, ped.z - alert.z);
      if (d < 26) {
        ped.state = 'flee'; ped.fleeTimer = 2.5;
        ped.fleeAngle = Math.atan2(ped.z - alert.z, ped.x - alert.x);
      }
    }
    if (ped.state === 'flee') {
      ped.fleeTimer -= dt;
      ped.angle = ped.fleeAngle;
      ped.x += Math.cos(ped.fleeAngle) * 16 * dt;
      ped.z += Math.sin(ped.fleeAngle) * 16 * dt;
      ped.x = clamp(ped.x, 5, WORLD.width - 5);
      ped.z = clamp(ped.z, 5, BEACH_Z - 2);
      if (ped.fleeTimer <= 0) ped.state = 'walk';
      continue;
    }
    const dx = ped.tx - ped.x, dz = ped.tz - ped.z;
    const d = Math.hypot(dx, dz);
    if (d < 1) {
      const p = randomSidewalkPoint(state.rng);
      ped.tx = p.x; ped.tz = p.z;
      continue;
    }
    ped.angle = Math.atan2(dz, dx);
    ped.x += (dx / d) * ped.speed * dt;
    ped.z += (dz / d) * ped.speed * dt;
  }
}

/** Any pedestrian close to a fast car gets knocked down (a crime — the player pays in heat). */
export function checkPedCarHits(state) {
  for (const car of state.cars) {
    if (car.speed < 10 || car.wrecked) continue;
    for (const ped of state.peds) {
      if (ped.state === 'down') continue;
      const d = Math.hypot(ped.x - car.x, ped.z - car.z);
      if (d < 2.2) {
        ped.state = 'down'; ped.downTimer = 6;
        if (car.driver === 'player') {
          state.events.push('heat:hitPed');
          state.events.push('crash');
        }
        state.alert = { x: ped.x, z: ped.z, timer: 1.5 };
      }
    }
  }
}
