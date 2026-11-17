// The world: one state object and the fixed-step update that moves everything in it — the player
// on foot and in cars, traffic, pedestrians, police, rivals, bullets, pickups, the wanted level
// and the mission chain. The renderer only reads this state; it never changes it.

import {
  WORLD, VIEW, STEP, PLAYER, CAR, CAR_MODELS, TRAFFIC_COUNT, PED_COUNT,
  PICKUP_COUNT, WANTED, clamp, angleLerp,
} from './config.js';
import { createRandom, rand, randInt, pick } from './random.js';
import { buildCity, collideBuildings, isOnRoad, randomRoadPoint } from './city.js';
import { spawnTrafficCar, spawnParkedCar, stepTraffic } from './traffic.js';
import { spawnPed, stepPeds, checkPedCarHits } from './pedestrians.js';
import { spawnCop, stepCops, wantedCopCount } from './police.js';
import { updateMission, startMission } from './missions.js';
import { stepBullets, punch, hurtPlayer, addHeat, fireBullet } from './combat.js';

export function createWorld(seed) {
  const rng = createRandom(seed);
  const city = buildCity(rng);
  const state = {
    seed, rng, city, time: 0,
    player: {
      x: 900, y: 760, angle: 0, vx: 0, vy: 0,
      health: PLAYER.health, armor: 0, ammo: PLAYER.pistolAmmo,
      inCar: null, punchCd: 0, shootCd: 0, invuln: 0, moving: false,
    },
    cars: [], peds: [], cops: [], rivals: [], bullets: [], pickups: [],
    particles: [], alert: null, shake: 0,
    wanted: { heat: 0, stars: 0, lastCrime: -99, hiddenTimer: 0 },
    cash: 0, score: 0, missionIndex: 0, mission: null, storyDone: false,
    camera: { x: 900, y: 760, scale: 1 },
    banner: null, gameOver: false, busted: false, win: false,
    events: [], copSpawnTimer: 0, trafficTimer: 0,
  };
  // The two mission cars, parked where the story needs them.
  state.cars.push(spawnParkedCar(rng, CAR_MODELS[1], 1000, 600));
  state.cars.push(spawnParkedCar(rng, CAR_MODELS[5], 1400, 1800));
  for (let i = 0; i < TRAFFIC_COUNT; i += 1) state.cars.push(spawnTrafficCar(rng, pick(rng, CAR_MODELS)));
  for (let i = 0; i < PED_COUNT; i += 1) state.peds.push(spawnPed(rng));
  for (let i = 0; i < PICKUP_COUNT; i += 1) state.pickups.push(spawnPickup(rng));
  return state;
}

function spawnPickup(rng) {
  const p = randomRoadPoint(rng);
  const roll = rng();
  return {
    x: p.x, y: p.y,
    kind: roll < 0.3 ? 'health' : roll < 0.55 ? 'armor' : roll < 0.8 ? 'ammo' : 'cash',
    bob: rand(rng, 0, 6),
  };
}

export function resetWorld(state, seed) {
  const fresh = createWorld(seed);
  for (const key of Object.keys(fresh)) state[key] = fresh[key];
}

export function stepWorld(state, input, dt) {
  state.time += dt;
  const p = state.player;
  if (p.invuln > 0) p.invuln -= dt;
  if (p.punchCd > 0) p.punchCd -= dt;
  if (p.shootCd > 0) p.shootCd -= dt;
  if (state.banner) { state.banner.timer -= dt; if (state.banner.timer <= 0) state.banner = null; }
  if (state.alert) { state.alert.timer -= dt; if (state.alert.timer <= 0) state.alert = null; }
  if (state.shake > 0) state.shake = Math.max(0, state.shake - dt * 22);

  // ---- player ----
  if (p.inCar) stepDriving(state, input, dt);
  else stepOnFoot(state, input, dt);

  // ---- the city lives ----
  stepTraffic(state, dt);
  stepPeds(state, dt);
  stepCops(state, dt);
  stepRivals(state, dt);
  stepBullets(state, dt);
  checkPedCarHits(state);
  stepCarCollisions(state, dt);
  stepPickups(state, dt);
  stepParticles(state, dt);
  updateMission(state, dt);
  updateWanted(state, dt);
  maintainPopulation(state, dt);

  // ---- camera follows the player ----
  const cam = state.camera;
  cam.x += (p.x - cam.x) * Math.min(1, dt * 5);
  cam.y += (p.y - cam.y) * Math.min(1, dt * 5);
  cam.x = clamp(cam.x, VIEW.width / 2 / 0.95, WORLD.width - VIEW.width / 2 / 0.95);
  cam.y = clamp(cam.y, VIEW.height / 2 / 0.95, WORLD.height - VIEW.height / 2 / 0.95);
}

function stepOnFoot(state, input, dt) {
  const p = state.player;
  const ix = (input.is('right') ? 1 : 0) - (input.is('left') ? 1 : 0);
  const iy = (input.is('down') ? 1 : 0) - (input.is('up') ? 1 : 0);
  const mag = Math.hypot(ix, iy) || 1;
  const speed = input.is('run') ? PLAYER.runSpeed : PLAYER.walkSpeed;
  p.vx = (ix / mag) * speed * (ix || iy ? 1 : 0);
  p.vy = (iy / mag) * speed * (ix || iy ? 1 : 0);
  p.moving = ix !== 0 || iy !== 0;
  if (p.moving) p.angle = Math.atan2(p.vy, p.vx);
  // Aim with the mouse when it has moved; otherwise face the way we walk.
  if (Math.abs(input.mouse.x - 640) > 4 || Math.abs(input.mouse.y - 360) > 4) {
    p.angle = input.aimAngle(p.x, p.y, state.camera);
  }
  const nx = p.x + p.vx * dt;
  const ny = p.y + p.vy * dt;
  const res = collideBuildings(state.city, nx, ny, PLAYER.radius);
  p.x = clamp(res.x, 20, WORLD.width - 20);
  p.y = clamp(res.y, 20, WORLD.height - 60);
  // The sea is not walkable.
  if (p.y > 2320) p.y = 2320;

  if (input.wasPressed('enter')) tryEnterCar(state);
  if (input.wasPressed('punch') && p.punchCd <= 0) {
    p.punchCd = PLAYER.punchCooldown;
    if (punch(state, p, true)) state.events.push('punch');
  }
  if ((input.mouse.clicked || input.mouse.down) && p.shootCd <= 0 && p.ammo > 0) {
    p.shootCd = PLAYER.pistolCooldown;
    p.ammo -= 1;
    const a = input.aimAngle(p.x, p.y, state.camera);
    fireBullet(state, p.x + Math.cos(a) * 18, p.y + Math.sin(a) * 18, a, 'player', PLAYER.pistolDamage);
    state.events.push('shot');
    state.alert = { x: p.x, y: p.y, timer: 1.2 };
    addHeat(state, WANTED.shoot);
  }
}

function tryEnterCar(state) {
  const p = state.player;
  let best = null, bestD = 70;
  for (const car of state.cars) {
    if (car.wrecked || car.driver === 'player' || car.driver === 'cop') continue;
    const d = Math.hypot(car.x - p.x, car.y - p.y);
    if (d < bestD) { bestD = d; best = car; }
  }
  if (!best) return;
  if (best.driver === 'traffic') {
    // The driver bails out and runs.
    const ped = spawnPed(state.rng);
    ped.x = best.x - Math.cos(best.angle) * 30;
    ped.y = best.y - Math.sin(best.angle) * 30;
    ped.state = 'flee'; ped.fleeTimer = 3;
    state.peds.push(ped);
    addHeat(state, WANTED.steal);
    state.events.push('steal');
  }
  best.driver = 'player';
  best.speed = 0;
  p.inCar = best;
  p.x = best.x; p.y = best.y;
  state.events.push('enterCar');
}

function stepDriving(state, input, dt) {
  const p = state.player;
  const car = p.inCar;
  if (!car || car.wrecked) {
    if (car) { car.driver = 'parked'; car.speed = 0; }
    p.inCar = null;
    return;
  }
  const up = input.is('up'), down = input.is('down');
  const steer = (input.is('left') ? -1 : 0) + (input.is('right') ? 1 : 0);
  const handbrake = input.is('handbrake');
  const top = car.top * car.accel;
  if (up) car.speed += CAR.accel * car.accel * dt;
  if (down) car.speed -= (car.speed > 20 ? CAR.brake : CAR.reverseAccel) * dt;
  if (!up && !down) car.speed -= Math.sign(car.speed) * 160 * dt;
  if (Math.abs(car.speed) < 8 && !up && !down) car.speed = 0;
  car.speed = clamp(car.speed, -CAR.maxReverse, top);
  const grip = handbrake ? CAR.driftGrip : CAR.grip;
  const steerAmount = steer * CAR.steerRate * clamp(Math.abs(car.speed) / 220, 0, 1) * (car.speed < 0 ? -1 : 1);
  car.angle += steerAmount * dt;
  // Velocity chases the heading; the handbrake lets it slide.
  const vx = Math.cos(car.angle) * car.speed;
  const vy = Math.sin(car.angle) * car.speed;
  car.vx = (car.vx ?? vx) + (vx - (car.vx ?? vx)) * Math.min(1, grip * dt);
  car.vy = (car.vy ?? vy) + (vy - (car.vy ?? vy)) * Math.min(1, grip * dt);
  car.x += car.vx * dt;
  car.y += car.vy * dt;
  const res = collideBuildings(state.city, car.x, car.y, 24);
  if (car.crashCd > 0) car.crashCd -= dt;
  if (res.hit) {
    if (Math.abs(car.speed) > 200 && car.crashCd <= 0) {
      car.crashCd = 0.5;
      car.health -= CAR.crashDamage;
      state.events.push('crash');
      state.shake = Math.max(state.shake, 5);
      state.alert = { x: car.x, y: car.y, timer: 1 };
      if (car.health <= 0) car.wrecked = true;
    }
    car.x = res.x; car.y = res.y;
    car.speed *= 0.45;
    car.vx *= 0.4; car.vy *= 0.4;
  }
  car.x = clamp(car.x, 30, WORLD.width - 30);
  car.y = clamp(car.y, 30, WORLD.height - 70);
  p.x = car.x; p.y = car.y; p.angle = car.angle;
  if (input.wasPressed('enter')) {
    car.driver = 'parked';
    car.speed = 0; car.vx = 0; car.vy = 0;
    p.inCar = null;
    p.x = car.x - Math.cos(car.angle) * 34;
    p.y = car.y - Math.sin(car.angle) * 34;
    state.events.push('exitCar');
  }
  if (input.wasPressed('punch')) { /* no punching from a car */ }
}

function stepCarCollisions(state, dt) {
  const cars = state.cars;
  for (const c of cars) if (c.crashCd > 0) c.crashCd -= dt;
  for (let i = 0; i < cars.length; i += 1) {
    for (let j = i + 1; j < cars.length; j += 1) {
      const a = cars[i], b = cars[j];
      if (a.wrecked || b.wrecked) continue;
      const dx = b.x - a.x, dy = b.y - a.y;
      const d = Math.hypot(dx, dy);
      if (d >= 48 || d < 0.01) continue;
      const push = (48 - d) / 2;
      const nx = dx / d, ny = dy / d;
      a.x -= nx * push; a.y -= ny * push;
      b.x += nx * push; b.y += ny * push;
      const impact = Math.abs((a.speed || 0) - (b.speed || 0));
      if (impact > 300 && (a.crashCd || 0) <= 0 && (b.crashCd || 0) <= 0) {
        a.crashCd = 0.5; b.crashCd = 0.5;
        a.health -= 4; b.health -= 4;
        if (a.driver === 'player' || b.driver === 'player') {
          state.events.push('crash');
          state.shake = Math.max(state.shake, 4);
        }
        if (a.health <= 0) a.wrecked = true;
        if (b.health <= 0) b.wrecked = true;
      }
    }
  }
  // Wrecked player car: smoke.
  for (const car of cars) {
    if (car.wrecked && state.rng() < 0.2) {
      state.particles.push({
        x: car.x + (state.rng() - 0.5) * 20, y: car.y - 10,
        vx: 0, vy: -30, life: 0.8, max: 0.8, color: '#666', size: 7,
      });
    }
  }
}

function stepRivals(state, dt) {
  const p = state.player;
  for (const r of state.rivals) {
    if (r.health <= 0) continue;
    const d = Math.hypot(p.x - r.x, p.y - r.y);
    r.shootCd -= dt;
    r.punchCd -= dt;
    if (d < 520) {
      const want = Math.atan2(p.y - r.y, p.x - r.x);
      r.angle = angleLerp(r.angle, want, dt * 3);
      if (d > 60) {
        r.x += Math.cos(r.angle) * 150 * dt;
        r.y += Math.sin(r.angle) * 150 * dt;
      } else if (r.punchCd <= 0) {
        r.punchCd = 0.8;
        punch(state, r, false);
        state.events.push('punch');
      }
      if (d > 90 && d < 420 && r.shootCd <= 0) {
        r.shootCd = rand(state.rng, 1.4, 2.4);
        const a = want + (state.rng() - 0.5) * 0.35;
        state.bullets.push({
          x: r.x, y: r.y, vx: Math.cos(a) * 700, vy: Math.sin(a) * 700,
          life: 0.7, from: 'rival', damage: 7,
        });
        state.events.push('shot');
      }
    }
  }
  state.rivals = state.rivals.filter((r) => r.health > 0 || state.mission);
}

function stepPickups(state, dt) {
  const p = state.player;
  for (let i = state.pickups.length - 1; i >= 0; i -= 1) {
    const pk = state.pickups[i];
    pk.bob += dt;
    const d = Math.hypot(p.x - pk.x, p.y - pk.y);
    if (d < 30) {
      if (pk.kind === 'health') p.health = Math.min(PLAYER.health, p.health + 30);
      else if (pk.kind === 'armor') p.armor = Math.min(100, p.armor + 50);
      else if (pk.kind === 'ammo') p.ammo = Math.min(PLAYER.maxAmmo, p.ammo + 24);
      else if (pk.kind === 'cash') { state.cash += 50; state.score += 50; }
      state.events.push('pickup');
      state.pickups.splice(i, 1);
      state.pickups.push(spawnPickup(state.rng));
    }
  }
}

function stepParticles(state, dt) {
  for (const pt of state.particles) {
    pt.x += pt.vx * dt;
    pt.y += pt.vy * dt;
    pt.life -= dt;
  }
  state.particles = state.particles.filter((pt) => pt.life > 0);
}

function updateWanted(state, dt) {
  const w = state.wanted;
  w.stars = w.heat <= 0 ? 0 : Math.min(5, Math.ceil(w.heat / 20));
  // Does any cop see the player?
  let seen = false;
  for (const cop of state.cops) {
    if (cop.state === 'down') continue;
    if (Math.hypot(cop.x - state.player.x, cop.y - state.player.y) < 520) { seen = true; break; }
  }
  if (seen) w.hiddenTimer = 0;
  else w.hiddenTimer += dt;
  if (w.heat > 0 && state.time - w.lastCrime > 4) {
    const rate = w.hiddenTimer > WANTED.hideSeconds ? WANTED.hideDecayPerSec : WANTED.decayPerSec;
    w.heat = Math.max(0, w.heat - rate * dt);
  }
}

function maintainPopulation(state, dt) {
  const p = state.player;
  // Police: spawn toward the wanted count, one at a time.
  state.copSpawnTimer -= dt;
  const want = wantedCopCount(state.wanted.stars);
  const active = state.cops.filter((c) => c.state !== 'down').length;
  if (active < want && state.copSpawnTimer <= 0) {
    state.copSpawnTimer = 1.4;
    spawnCop(state, state.wanted.stars >= 2 || state.rng() < 0.5);
  }
  // Traffic: keep the streets busy, respawning far from the player.
  state.trafficTimer -= dt;
  const traffic = state.cars.filter((c) => c.driver === 'traffic' && !c.wrecked).length;
  if (traffic < TRAFFIC_COUNT && state.trafficTimer <= 0) {
    state.trafficTimer = 0.8;
    const car = spawnTrafficCar(state.rng, pick(state.rng, CAR_MODELS));
    // Push it away from the player so it does not pop in on screen.
    if (Math.hypot(car.x - p.x, car.y - p.y) < 500) {
      car.x = clamp(car.x + 900, 120, WORLD.width - 120);
      car.y = clamp(car.y, 120, 2220 - 120);
    }
    state.cars.push(car);
  }
  // Wrecked cars and downed peds far away are towed off.
  state.cars = state.cars.filter((c) => {
    if (c.driver === 'player') return true;
    if (c.wrecked && Math.hypot(c.x - p.x, c.y - p.y) > 900) return false;
    return true;
  });
}

export { startMission };
