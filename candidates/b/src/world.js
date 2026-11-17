// The world: one state object and the fixed-step update that moves everything in it — the player
// on foot and in cars, traffic, pedestrians, police, rivals, bullets, pickups, the wanted level
// and the mission chain. Positions live on the XZ plane (y is up); the renderer only reads this
// state, it never changes it.

import {
  WORLD, VIEW, PLAYER, CAR, CAR_MODELS, TRAFFIC_COUNT, PED_COUNT,
  PICKUP_COUNT, WANTED, clamp, angleLerp,
} from './config.js';
import { createRandom, rand, pick } from './random.js';
import { buildCity, collideBuildings, randomRoadPoint } from './city.js';
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
      // Spawn on the x=1000 road, facing north toward the mission car — never inside a block,
      // where a building could cover the spawn point (the old (900,760) spawn sat inside a
      // building at seed 7).
      x: 1000, z: 760, angle: -Math.PI / 2, vx: 0, vz: 0,
      health: PLAYER.health, armor: 0, ammo: PLAYER.pistolAmmo,
      inCar: null, punchCd: 0, shootCd: 0, invuln: 0, moving: false,
    },
    cars: [], peds: [], cops: [], rivals: [], bullets: [], pickups: [],
    particles: [], alert: null, shake: 0,
    wanted: { heat: 0, stars: 0, lastCrime: -99, hiddenTimer: 0 },
    cash: 0, score: 0, missionIndex: 0, mission: null, storyDone: false,
    camera: { x: 1000, z: 760, angle: -Math.PI / 2 },
    banner: null, gameOver: false, busted: false, win: false,
    events: [], copSpawnTimer: 0, trafficTimer: 0,
  };
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
    x: p.x, z: p.z,
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
  if (state.shake > 0) state.shake = Math.max(0, state.shake - dt * 1.8);

  if (p.inCar) stepDriving(state, input, dt);
  else stepOnFoot(state, input, dt);

  stepTraffic(state, dt);
  stepPeds(state, dt);
  stepCops(state, dt);
  stepRivals(state, dt);
  stepBullets(state, dt);
  checkPedCarHits(state);
  stepCarCollisions(state, dt);
  stepPickups(state, dt);
  updateMission(state, dt);
  updateWanted(state, dt);
  maintainPopulation(state, dt);

  // The chase camera eases behind the player's heading.
  const cam = state.camera;
  cam.x += (p.x - cam.x) * Math.min(1, dt * 5);
  cam.z += (p.z - cam.z) * Math.min(1, dt * 5);
  cam.angle = angleLerp(cam.angle, p.angle, Math.min(1, dt * 3.5));
}

function stepOnFoot(state, input, dt) {
  const p = state.player;
  // Tank-style on-foot controls: W/S move along the heading, A/D turn. The chase camera sits
  // behind the heading, so this always feels like moving away from the camera.
  if (input.is('left')) p.angle -= 2.6 * dt;
  if (input.is('right')) p.angle += 2.6 * dt;
  const fwd = (input.is('up') ? 1 : 0) - (input.is('down') ? 0.6 : 0);
  const speed = input.is('run') ? PLAYER.runSpeed : PLAYER.walkSpeed;
  const vx = Math.cos(p.angle) * speed * fwd;
  const vz = Math.sin(p.angle) * speed * fwd;
  p.moving = fwd !== 0;
  p.vx += (vx - p.vx) * Math.min(1, dt * 10);
  p.vz += (vz - p.vz) * Math.min(1, dt * 10);
  const nx = p.x + p.vx * dt;
  const nz = p.z + p.vz * dt;
  const res = collideBuildings(state.city, nx, nz, PLAYER.radius);
  p.x = clamp(res.x, 5, WORLD.width - 5);
  p.z = clamp(res.z, 5, WORLD.height - 15);
  if (p.z > 2320) p.z = 2320;

  if (input.wasPressed('enter')) tryEnterCar(state);
  if (input.wasPressed('punch') && p.punchCd <= 0) {
    p.punchCd = PLAYER.punchCooldown;
    if (punch(state, p, true)) state.events.push('punch');
  }
  if ((input.mouse.clicked || input.mouse.down) && p.shootCd <= 0 && p.ammo > 0) {
    p.shootCd = PLAYER.pistolCooldown;
    p.ammo -= 1;
    fireBullet(state, p.x + Math.cos(p.angle) * 1.6, p.z + Math.sin(p.angle) * 1.6, p.angle, 'player', PLAYER.pistolDamage);
    state.events.push('shot');
    state.alert = { x: p.x, z: p.z, timer: 1.2 };
    addHeat(state, WANTED.shoot);
  }
}

function tryEnterCar(state) {
  const p = state.player;
  let best = null, bestD = 5.5;
  for (const car of state.cars) {
    if (car.wrecked || car.driver === 'player' || car.driver === 'cop') continue;
    const d = Math.hypot(car.x - p.x, car.z - p.z);
    if (d < bestD) { bestD = d; best = car; }
  }
  if (!best) return;
  if (best.driver === 'traffic') {
    const ped = spawnPed(state.rng);
    ped.x = best.x - Math.cos(best.angle) * 2.5;
    ped.z = best.z - Math.sin(best.angle) * 2.5;
    ped.state = 'flee'; ped.fleeTimer = 3;
    state.peds.push(ped);
    addHeat(state, WANTED.steal);
    state.events.push('steal');
  }
  best.driver = 'player';
  best.speed = 0;
  p.inCar = best;
  p.x = best.x; p.z = best.z;
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
  if (down) car.speed -= (car.speed > 2 ? CAR.brake : CAR.reverseAccel) * dt;
  if (!up && !down) car.speed -= Math.sign(car.speed) * 14 * dt;
  if (Math.abs(car.speed) < 0.6 && !up && !down) car.speed = 0;
  car.speed = clamp(car.speed, -CAR.maxReverse, top);
  const grip = handbrake ? CAR.driftGrip : CAR.grip;
  const steerAmount = steer * CAR.steerRate * clamp(Math.abs(car.speed) / 18, 0, 1) * (car.speed < 0 ? -1 : 1);
  car.angle += steerAmount * dt;
  const vx = Math.cos(car.angle) * car.speed;
  const vz = Math.sin(car.angle) * car.speed;
  car.vx = (car.vx ?? vx) + (vx - (car.vx ?? vx)) * Math.min(1, grip * dt);
  car.vz = (car.vz ?? vz) + (vz - (car.vz ?? vz)) * Math.min(1, grip * dt);
  car.x += car.vx * dt;
  car.z += car.vz * dt;
  if (car.crashCd > 0) car.crashCd -= dt;
  const res = collideBuildings(state.city, car.x, car.z, 2);
  if (res.hit) {
    if (Math.abs(car.speed) > 16 && car.crashCd <= 0) {
      car.crashCd = 0.5;
      car.health -= CAR.crashDamage;
      state.events.push('crash');
      state.shake = Math.max(state.shake, 0.4);
      state.alert = { x: car.x, z: car.z, timer: 1 };
      if (car.health <= 0) car.wrecked = true;
    }
    car.x = res.x; car.z = res.z;
    car.speed *= 0.45;
    car.vx *= 0.4; car.vz *= 0.4;
  }
  car.x = clamp(car.x, 3, WORLD.width - 3);
  car.z = clamp(car.z, 3, WORLD.height - 6);
  p.x = car.x; p.z = car.z; p.angle = car.angle;
  if (input.wasPressed('enter')) {
    car.driver = 'parked';
    car.speed = 0; car.vx = 0; car.vz = 0;
    p.inCar = null;
    p.x = car.x - Math.cos(car.angle) * 3;
    p.z = car.z - Math.sin(car.angle) * 3;
    state.events.push('exitCar');
  }
}

function stepCarCollisions(state, dt) {
  const cars = state.cars;
  for (const c of cars) if (c.crashCd > 0) c.crashCd -= dt;
  for (let i = 0; i < cars.length; i += 1) {
    for (let j = i + 1; j < cars.length; j += 1) {
      const a = cars[i], b = cars[j];
      if (a.wrecked || b.wrecked) continue;
      const dx = b.x - a.x, dz = b.z - a.z;
      const d = Math.hypot(dx, dz);
      if (d >= 4 || d < 0.01) continue;
      const push = (4 - d) / 2;
      const nx = dx / d, nz = dz / d;
      a.x -= nx * push; a.z -= nz * push;
      b.x += nx * push; b.z += nz * push;
      const impact = Math.abs((a.speed || 0) - (b.speed || 0));
      if (impact > 24 && (a.crashCd || 0) <= 0 && (b.crashCd || 0) <= 0) {
        a.crashCd = 0.5; b.crashCd = 0.5;
        a.health -= 4; b.health -= 4;
        if (a.driver === 'player' || b.driver === 'player') {
          state.events.push('crash');
          state.shake = Math.max(state.shake, 0.3);
        }
        if (a.health <= 0) a.wrecked = true;
        if (b.health <= 0) b.wrecked = true;
      }
    }
  }
}

function stepRivals(state, dt) {
  const p = state.player;
  for (const r of state.rivals) {
    if (r.health <= 0) continue;
    const d = Math.hypot(p.x - r.x, p.z - r.z);
    r.shootCd -= dt;
    r.punchCd -= dt;
    if (d < 42) {
      const want = Math.atan2(p.z - r.z, p.x - r.x);
      r.angle = angleLerp(r.angle, want, dt * 3);
      if (d > 5) {
        r.x += Math.cos(r.angle) * 12 * dt;
        r.z += Math.sin(r.angle) * 12 * dt;
      } else if (r.punchCd <= 0) {
        r.punchCd = 0.8;
        punch(state, r, false);
        state.events.push('punch');
      }
      if (d > 8 && d < 34 && r.shootCd <= 0) {
        r.shootCd = rand(state.rng, 1.4, 2.4);
        const a = want + (state.rng() - 0.5) * 0.35;
        state.bullets.push({
          x: r.x, z: r.z, y: 1.4, vx: Math.cos(a) * 60, vz: Math.sin(a) * 60,
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
    const d = Math.hypot(p.x - pk.x, p.z - pk.z);
    if (d < 2.6) {
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

function updateWanted(state, dt) {
  const w = state.wanted;
  w.stars = w.heat <= 0 ? 0 : Math.min(5, Math.ceil(w.heat / 20));
  let seen = false;
  for (const cop of state.cops) {
    if (cop.state === 'down') continue;
    if (Math.hypot(cop.x - state.player.x, cop.z - state.player.z) < 42) { seen = true; break; }
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
  state.copSpawnTimer -= dt;
  const want = wantedCopCount(state.wanted.stars);
  const active = state.cops.filter((c) => c.state !== 'down').length;
  if (active < want && state.copSpawnTimer <= 0) {
    state.copSpawnTimer = 1.4;
    spawnCop(state, state.wanted.stars >= 2 || state.rng() < 0.5);
  }
  state.trafficTimer -= dt;
  const traffic = state.cars.filter((c) => c.driver === 'traffic' && !c.wrecked).length;
  if (traffic < TRAFFIC_COUNT && state.trafficTimer <= 0) {
    state.trafficTimer = 0.8;
    const car = spawnTrafficCar(state.rng, pick(state.rng, CAR_MODELS));
    if (Math.hypot(car.x - p.x, car.z - p.z) < 40) {
      car.x = clamp(car.x + 75, 10, WORLD.width - 10);
      car.z = clamp(car.z, 10, 2220 - 10);
    }
    state.cars.push(car);
  }
  state.cars = state.cars.filter((c) => {
    if (c.driver === 'player') return true;
    if (c.wrecked && Math.hypot(c.x - p.x, c.z - p.z) > 75) return false;
    return true;
  });
}

export { startMission };
