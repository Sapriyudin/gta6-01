// Combat: bullets, punches and the damage they do. Everything here works on the plain world
// state (player, cars, peds, cops, rivals) and posts 'heat' events for crimes the player commits.
// A bullet is a fast point with a short life; a punch is a short arc in front of the attacker.

import { PLAYER, WANTED, dist2 } from './config.js';
import { insideBuilding } from './city.js';

export function fireBullet(state, x, y, angle, from, damage) {
  const speed = 900;
  state.bullets.push({
    x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
    life: 0.6, from, damage,
  });
}

function hitCircle(x, y, cx, cy, r) {
  const dx = x - cx, dy = y - cy;
  return dx * dx + dy * dy < r * r;
}

export function stepBullets(state, dt) {
  const out = [];
  for (const b of state.bullets) {
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.life -= dt;
    let dead = b.life <= 0;
    if (!dead && insideBuilding(state.city, b.x, b.y)) {
      dead = true;
      state.particles.push({ x: b.x, y: b.y, vx: 0, vy: 0, life: 0.25, max: 0.25, color: '#ffd76a', size: 4 });
    }
    if (!dead) {
      // Hit the player (only enemy bullets do).
      if (b.from !== 'player' && hitCircle(b.x, b.y, state.player.x, state.player.y, 14)) {
        hurtPlayer(state, b.damage);
        dead = true;
      }
    }
    if (!dead && b.from === 'player') {
      // Pedestrians.
      for (const ped of state.peds) {
        if (ped.state !== 'down' && hitCircle(b.x, b.y, ped.x, ped.y, 13)) {
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
        if (!cop.inCar && hitCircle(b.x, b.y, cop.x, cop.y, 14)) {
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
        if (r.health > 0 && hitCircle(b.x, b.y, r.x, r.y, 14)) {
          r.health -= b.damage;
          if (r.health <= 0 && state.mission) {
            state.mission.cleared += 1;
            state.score += 50;
          }
          dead = true;
          break;
        }
      }
    }
    if (!dead && b.from === 'player') {
      // Cars (traffic and police cars).
      for (const car of state.cars) {
        if (car.driver === 'player') continue;
        if (hitCircle(b.x, b.y, car.x, car.y, 28)) {
          car.health -= b.damage;
          if (car.health <= 0) car.wrecked = true;
          dead = true;
          break;
        }
      }
    }
    if (!dead && b.from !== 'player') {
      // Enemy bullets can hit the player's car.
      const car = state.player.inCar;
      if (car && hitCircle(b.x, b.y, car.x, car.y, 28)) {
        car.health -= b.damage;
        if (car.health <= 0) car.wrecked = true;
        dead = true;
      }
    }
    if (!dead) out.push(b);
  }
  state.bullets = out;
}

/** A melee swing: hits the nearest valid target inside range and a 100-degree arc. */
export function punch(state, attacker, isPlayer) {
  const range = PLAYER.punchRange;
  const arc = 1.1;
  let best = null;
  let bestD = Infinity;
  const consider = (x, y, r, ref) => {
    const d = Math.hypot(x - attacker.x, y - attacker.y);
    if (d > range + r) return;
    let da = Math.atan2(y - attacker.y, x - attacker.x) - attacker.angle;
    while (da > Math.PI) da -= Math.PI * 2;
    while (da < -Math.PI) da += Math.PI * 2;
    if (Math.abs(da) > arc) return;
    if (d < bestD) { bestD = d; best = ref; }
  };
  if (isPlayer) {
    for (const ped of state.peds) if (ped.state !== 'down') consider(ped.x, ped.y, 12, { kind: 'ped', ref: ped });
    for (const cop of state.cops) if (!cop.inCar && cop.state !== 'down') consider(cop.x, cop.y, 12, { kind: 'cop', ref: cop });
    for (const r of state.rivals) if (r.health > 0) consider(r.x, r.y, 12, { kind: 'rival', ref: r });
  } else {
    consider(state.player.x, state.player.y, 13, { kind: 'player', ref: state.player });
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
