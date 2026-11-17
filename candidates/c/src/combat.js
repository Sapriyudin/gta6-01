// Combat: pistol bullets, punches, car-vs-ped and car-vs-cop damage, heat, and the muzzle
// flash the renderer turns into a burst of light.
import { PLAYER, WANTED } from './config.js';

export function fireBullet(state, x, y, angle, owner, damage) {
  state.bullets.push({ x, y, angle, owner, damage, life: 1.1, speed: 620 });
}

export function stepBullets(state, dt) {
  for (const b of state.bullets) {
    b.x += Math.cos(b.angle) * b.speed * dt;
    b.y += Math.sin(b.angle) * b.speed * dt;
    b.life -= dt;
  }
  state.bullets = state.bullets.filter((b) => b.life > 0 && b.x > 0 && b.x < 3200 && b.y > 0 && b.y < 2400);
  // Bullets vs peds, rivals and cops.
  for (const b of state.bullets) {
    if (b.life <= 0) continue;
    const targets = [];
    for (const ped of state.peds) targets.push({ ref: ped, kind: 'ped', r: 14 });
    if (state.mission) for (const r of state.mission.rivals) targets.push({ ref: r, kind: 'rival', r: 15 });
    for (const cop of state.cops) if (cop.state !== 'down') targets.push({ ref: cop, kind: 'cop', r: 15 });
    for (const t of targets) {
      if (Math.hypot(t.ref.x - b.x, t.ref.y - b.y) < t.r) {
        b.life = 0;
        t.ref.health -= b.damage;
        state.events.push('hit');
        if (t.kind === 'ped' && t.ref.health <= 0) {
          t.ref.state = 'dead';
          addHeat(state, WANTED.killPed);
        }
        if (t.kind === 'rival' && t.ref.health <= 0) {
          t.ref.state = 'dead';
          addHeat(state, WANTED.shoot);
        }
        if (t.kind === 'cop' && t.ref.health <= 0) {
          t.ref.state = 'down'; t.ref.downTimer = 8;
          addHeat(state, WANTED.killCop);
          state.events.push('copDown');
        }
        break;
      }
    }
  }
  state.bullets = state.bullets.filter((b) => b.life > 0);
}

// A punch hits the nearest ped / rival / cop in front of the player.
export function punch(state, p, isPlayer) {
  const range = 34;
  const targets = [];
  for (const ped of state.peds) targets.push({ ref: ped, kind: 'ped' });
  if (state.mission) for (const r of state.mission.rivals) targets.push({ ref: r, kind: 'rival' });
  for (const cop of state.cops) if (cop.state !== 'down') targets.push({ ref: cop, kind: 'cop' });
  let best = null, bd = range;
  for (const t of targets) {
    const d = Math.hypot(t.ref.x - p.x, t.ref.y - p.y);
    if (d < bd) { bd = d; best = t; }
  }
  if (!best) return false;
  best.ref.health -= PLAYER.punchDamage;
  if (best.kind === 'ped' && best.ref.health <= 0) { best.ref.state = 'dead'; addHeat(state, WANTED.killPed); }
  if (best.kind === 'rival' && best.ref.health <= 0) best.ref.state = 'dead';
  if (best.kind === 'cop' && best.ref.health <= 0) { best.ref.state = 'down'; best.ref.downTimer = 8; addHeat(state, WANTED.killCop); }
  return true;
}

export function hurtPlayer(state, amount) {
  const p = state.player;
  if (p.invuln > 0 || state.gameOver) return;
  if (p.armor > 0) {
    const absorbed = Math.min(p.armor, amount);
    p.armor -= absorbed;
    amount -= absorbed;
  }
  p.health -= amount;
  p.invuln = 0.5;
  state.events.push('hurt');
  if (p.health <= 0) {
    p.health = 0;
    state.gameOver = true;
    state.events.push('gameOver');
  }
}

export function addHeat(state, amount) {
  state.wanted.heat = Math.min(100, state.wanted.heat + amount);
  state.wanted.lastCrime = state.time;
}

// A car hitting a pedestrian: the ped is hurt and may die; the driver gains heat.
export function checkPedCarHits(state) {
  for (const car of state.cars) {
    if (car.wrecked || Math.abs(car.speed) < 8) continue;
    for (const ped of state.peds) {
      if (ped.state === 'dead') continue;
      if (Math.hypot(ped.x - car.x, ped.y - car.y) < 20) {
        ped.health -= 60;
        ped.state = ped.health <= 0 ? 'dead' : 'flee';
        ped.fleeTimer = 3;
        ped.fleeAngle = Math.atan2(ped.y - car.y, ped.x - car.x);
        if (car.driver === 'player') addHeat(state, ped.state === 'dead' ? WANTED.killPed : WANTED.hitPed);
      }
    }
  }
}
