// Combat in 3D: bullets fly on the XZ plane at chest height, punches are a short arc in front of
// the attacker. Distances are in world units (a car is ~4.4 long, a person ~1.1 wide).

import { PLAYER, WANTED } from './config.js';
import { insideBuilding } from './city.js';

export function fireBullet(state, x, z, angle, from, damage) {
  const speed = 90;
  state.bullets.push({
    x, z, y: 1.4, vx: Math.cos(angle) * speed, vz: Math.sin(angle) * speed,
    life: 0.7, from, damage,
  });
}

function hitXZ(b, x, z, r) {
  const dx = b.x - x, dz = b.z - z;
  return dx * dx + dz * dz < r * r;
}

export function stepBullets(state, dt) {
  const out = [];
  for (const b of state.bullets) {
    b.x += b.vx * dt;
    b.z += b.vz * dt;
    b.life -= dt;
    let dead = b.life <= 0;
    if (!dead && insideBuilding(state.city, b.x, b.z)) dead = true;
    if (!dead && b.from !== 'player' && hitXZ(b, state.player.x, state.player.z, 1.2)) {
      hurtPlayer(state, b.damage);
      dead = true;
    }
    if (!dead && b.from === 'player') {
      for (const ped of state.peds) {
        if (ped.state !== 'down' && hitXZ(b, ped.x, ped.z, 1.1)) {
          ped.state = 'down'; ped.downTimer = 6;
          addHeat(state, WANTED.killPed);
          state.score += 5;
          dead = true;
          break;
        }
      }
    }
    if (!dead && b.from === 'player') {
      for (const cop of state.cops) {
        if (!cop.inCar && cop.state !== 'down' && hitXZ(b, cop.x, cop.z, 1.2)) {
          cop.health -= b.damage;
          if (cop.health <= 0) {
            cop.state = 'down'; cop.downTimer = 8;
            addHeat(state, WANTED.killCop);
            state.score += 25;
          }
          dead = true;
          break;
        }
      }
    }
    if (!dead && b.from === 'player') {
      for (const r of state.rivals) {
        if (r.health > 0 && hitXZ(b, r.x, r.z, 1.2)) {
          r.health -= b.damage;
          if (r.health <= 0 && state.mission) { state.mission.cleared += 1; state.score += 50; }
          dead = true;
          break;
        }
      }
    }
    if (!dead && b.from === 'player') {
      for (const car of state.cars) {
        if (car.driver === 'player') continue;
        if (hitXZ(b, car.x, car.z, 2.4)) {
          car.health -= b.damage;
          if (car.health <= 0) car.wrecked = true;
          dead = true;
          break;
        }
      }
    }
    if (!dead && b.from !== 'player') {
      const car = state.player.inCar;
      if (car && hitXZ(b, car.x, car.z, 2.4)) {
        car.health -= b.damage;
        if (car.health <= 0) car.wrecked = true;
        dead = true;
      }
    }
    if (!dead) out.push(b);
  }
  state.bullets = out;
}

export function punch(state, attacker, isPlayer) {
  const range = PLAYER.punchRange;
  const arc = 1.1;
  let best = null, bestD = Infinity;
  const consider = (x, z, r, ref) => {
    const d = Math.hypot(x - attacker.x, z - attacker.z);
    if (d > range + r) return;
    let da = Math.atan2(z - attacker.z, x - attacker.x) - attacker.angle;
    while (da > Math.PI) da -= Math.PI * 2;
    while (da < -Math.PI) da += Math.PI * 2;
    if (Math.abs(da) > arc) return;
    if (d < bestD) { bestD = d; best = ref; }
  };
  if (isPlayer) {
    for (const ped of state.peds) if (ped.state !== 'down') consider(ped.x, ped.z, 1, { kind: 'ped', ref: ped });
    for (const cop of state.cops) if (!cop.inCar && cop.state !== 'down') consider(cop.x, cop.z, 1, { kind: 'cop', ref: cop });
    for (const r of state.rivals) if (r.health > 0) consider(r.x, r.z, 1, { kind: 'rival', ref: r });
  } else {
    consider(state.player.x, state.player.z, 1.1, { kind: 'player', ref: state.player });
  }
  if (!best) return false;
  if (best.kind === 'ped') {
    best.ref.state = 'down'; best.ref.downTimer = 6;
    addHeat(state, WANTED.killPed);
  } else if (best.kind === 'cop') {
    best.ref.health -= PLAYER.punchDamage;
    addHeat(state, WANTED.ramCop);
    if (best.ref.health <= 0) { best.ref.state = 'down'; best.ref.downTimer = 8; addHeat(state, WANTED.killCop); }
  } else if (best.kind === 'rival') {
    best.ref.health -= PLAYER.punchDamage;
    if (best.ref.health <= 0 && state.mission) { state.mission.cleared += 1; state.score += 50; }
  } else if (best.kind === 'player') {
    hurtPlayer(state, 12);
  }
  return true;
}

export function hurtPlayer(state, damage) {
  const p = state.player;
  if (p.invuln > 0 || state.gameOver) return;
  let left = damage;
  if (p.armor > 0) {
    const absorbed = Math.min(p.armor, left * 0.6);
    p.armor -= absorbed;
    left -= absorbed;
  }
  p.health -= left;
  p.invuln = 0.35;
  state.events.push('hurt');
  if (p.health <= 0) {
    p.health = 0;
    state.gameOver = true;
    state.events.push('fail');
  }
}

export function addHeat(state, amount) {
  state.wanted.heat = Math.min(100, state.wanted.heat + amount);
  state.wanted.lastCrime = state.time;
}
