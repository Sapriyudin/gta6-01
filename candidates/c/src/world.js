// The world: one state object and the fixed-step update that moves everything — the player
// on foot and in cars, traffic, pedestrians, police, rivals, bullets, pickups, the wanted
// level and the mission chain. Positions live on the XY plane; the renderer only reads this
// state, it never changes it.
import {
  WORLD, VIEW, PLAYER, CAR, CAR_MODELS, TRAFFIC_COUNT, PED_COUNT,
  PICKUP_COUNT, WANTED, clamp, angleLerp,
} from './config.js';
import { createRandom, rand, pick } from './random.js';
import { buildCity, collideBuildings, randomRoadPoint } from './city.js';
import { spawnTrafficCar, spawnParkedCar, stepTraffic } from './traffic.js';
import { spawnPed, stepPeds } from './pedestrians.js';
import { spawnCop, stepCops, updateWanted } from './police.js';
import { updateMission, startMission, updatePendingDialogue } from './missions.js';
import { stepBullets, punch, hurtPlayer, addHeat, fireBullet, checkPedCarHits } from './combat.js';

export function createWorld(seed) {
  const rng = createRandom(seed);
  const city = buildCity(rng);
  const state = {
    seed, rng, city, time: 0,
    player: {
      // Spawn on the x=1000 road, facing north toward the mission car — never inside a block.
      x: 1000, y: 760, angle: -Math.PI / 2, vx: 0, vy: 0,
      health: PLAYER.health, armor: 0, ammo: PLAYER.pistolAmmo,
      inCar: null, punchCd: 0, shootCd: 0, invuln: 0, moving: false,
    },
    cars: [], peds: [], cops: [], rivals: [], bullets: [], pickups: [],
    particles: [], alert: null, shake: 0, flash: 0,
    wanted: { heat: 0, stars: 0, lastCrime: -99, hiddenTimer: 0 },
    cash: 0, score: 0, missionIndex: 0, mission: null, storyDone: false,
    unlocks: new Set(['Vela']), safehouseActive: false,
    camera: { x: 1000, y: 760, scale: 1 },
    banner: null, pendingDialogue: null, pendingDialogueTimer: 0,
    gameOver: false, busted: false, win: false,
    events: [], copSpawnTimer: 0, trafficTimer: 0,
  };
  state.cars.push(spawnParkedCar(rng, CAR_MODELS[0], 1000, 600));
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
  p.invuln = Math.max(0, p.invuln - dt);
  p.punchCd = Math.max(0, p.punchCd - dt);
  p.shootCd = Math.max(0, p.shootCd - dt);
  state.shake = Math.max(0, state.shake - dt * 2);
  state.flash = Math.max(0, state.flash - dt * 4);
  if (state.alert) {
    state.alert.timer -= dt;
    if (state.alert.timer <= 0) state.alert = null;
  }
  if (state.banner) {
    state.banner.t -= dt;
    if (state.banner.t <= 0) state.banner = null;
  }
  updatePendingDialogue(state, dt);
  if (p.inCar) stepDriving(state, input, dt);
  else stepOnFoot(state, input, dt);
  stepTraffic(state, dt);
  stepPeds(state, dt);
  stepCops(state, dt);
  stepBullets(state, dt);
  checkPedCarHits(state);
  updateWanted(state, dt);
  updateMission(state, dt);
  stepRivals(state, dt);
  stepPickups(state, dt);
  stepSafehouse(state, dt);
  maintainPopulation(state, dt);
  // The camera follows the player, clamped so the view never shows the void.
  const cam = state.camera;
  cam.x = clamp(p.x, VIEW.width / 2 / 0.95, WORLD.width - VIEW.width / 2 / 0.95);
  cam.y = clamp(p.y, VIEW.height / 2 / 0.95, WORLD.height - VIEW.height / 2 / 0.95);
}

function stepOnFoot(state, input, dt) {
  const p = state.player;
  const fwd = (input.is('up') ? 1 : 0) - (input.is('down') ? 0.6 : 0);
  const strafe = (input.is('right') ? 1 : 0) - (input.is('left') ? 1 : 0);
  const speed = input.is('run') ? PLAYER.runSpeed : PLAYER.walkSpeed;
  const vx = (Math.cos(p.angle) * fwd - Math.sin(p.angle) * strafe) * speed;
  const vy = (Math.sin(p.angle) * fwd + Math.cos(p.angle) * strafe) * speed;
  p.moving = fwd !== 0 || strafe !== 0;
  p.vx += (vx - p.vx) * Math.min(1, dt * 10);
  p.vy += (vy - p.vy) * Math.min(1, dt * 10);
  // The player faces the mouse on foot.
  p.angle = Math.atan2(input.mouse.y - 360 + (p.y - state.camera.y), input.mouse.x - 640 + (p.x - state.camera.x));
  const nx = p.x + p.vx * dt;
  const ny = p.y + p.vy * dt;
  const res = collideBuildings(state.city, nx, ny, PLAYER.radius);
  p.x = clamp(res.x, 5, WORLD.width - 5);
  p.y = clamp(res.y, 5, WORLD.height - 15);
  if (p.y > 2320) p.y = 2320;

  if (input.wasPressed('enter')) tryEnterCar(state);
  if (input.wasPressed('punch') && p.punchCd <= 0) {
    p.punchCd = PLAYER.punchCooldown;
    if (punch(state, p, true)) state.events.push('punch');
  }
  if ((input.mouse.clicked || input.mouse.down) && p.shootCd <= 0 && p.ammo > 0) {
    p.shootCd = PLAYER.pistolCooldown;
    p.ammo -= 1;
    fireBullet(state, p.x + Math.cos(p.angle) * 20, p.y + Math.sin(p.angle) * 20, p.angle, 'player', PLAYER.pistolDamage);
    state.events.push('shot');
    state.flash = 1;
    state.alert = { x: p.x, y: p.y, timer: 1.2 };
    addHeat(state, WANTED.shoot);
  }
  input.mouse.clicked = false;
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
  const up = input.is('up') ? 1 : 0;
  const down = input.is('down') ? 1 : 0;
  const steer = (input.is('left') ? -1 : 0) + (input.is('right') ? 1 : 0);
  const braking = input.is('brake');
  if (up) car.speed += car.accel * dt;
  if (down) car.speed -= (car.speed > 0 ? CAR.brake : CAR.reverseAccel) * dt;
  if (braking) car.speed -= Math.sign(car.speed) * CAR.brake * 1.4 * dt;
  if (!up && !down && !braking) car.speed -= car.speed * 1.2 * dt;
  car.speed = clamp(car.speed, -CAR.maxReverse, car.top);
  const steerAmount = steer * CAR.turnRate * clamp(Math.abs(car.speed) / 20, 0, 1) * (car.speed >= 0 ? 1 : -1);
  car.angle += steerAmount * dt;
  // Drift: the velocity lags the heading a little at speed.
  const vx = Math.cos(car.angle) * car.speed;
  const vy = Math.sin(car.angle) * car.speed;
  car.vx = car.vx === undefined ? vx : car.vx + (vx - car.vx) * Math.min(1, dt * CAR.grip);
  car.vy = car.vy === undefined ? vy : car.vy + (vy - car.vy) * Math.min(1, dt * CAR.grip);
  const nx = car.x + car.vx * dt;
  const ny = car.y + car.vy * dt;
  const res = collideBuildings(state.city, nx, ny, 16);
  const hitWall = res.hit;
  car.x = clamp(res.x, 10, WORLD.width - 10);
  car.y = clamp(res.y, 10, WORLD.height - 15);
  if (hitWall && Math.abs(car.speed) > 12 && car.crashCd <= 0) {
    car.crashCd = 0.5;
    car.health -= CAR.crashDamage;
    car.speed *= 0.4;
    state.shake = Math.max(state.shake, 0.4);
    state.events.push('crash');
    if (car.health <= 0) {
      car.wrecked = true;
      car.driver = 'parked';
      p.inCar = null;
      state.events.push('wrecked');
    }
  }
  car.crashCd = Math.max(0, car.crashCd - dt);
  p.x = car.x; p.y = car.y;
  p.angle = car.angle;
  if (input.wasPressed('enter')) {
    car.driver = 'parked';
    car.speed = 0;
    p.inCar = null;
    p.x = car.x - Math.cos(car.angle) * 26;
    p.y = car.y - Math.sin(car.angle) * 26;
    state.events.push('exitCar');
  }
  // Car-vs-car impacts.
  for (const other of state.cars) {
    if (other === car || other.wrecked) continue;
    const d = Math.hypot(other.x - car.x, other.y - car.y);
    if (d < 34 && d > 0) {
      const impact = Math.abs(car.speed - (other.speed || 0));
      const push = (34 - d) / 2;
      const nx2 = (other.x - car.x) / d, ny2 = (other.y - car.y) / d;
      car.x -= nx2 * push; car.y -= ny2 * push;
      other.x += nx2 * push; other.y += ny2 * push;
      if (impact > 30 && car.crashCd <= 0) {
        car.crashCd = 0.5;
        car.health -= 4;
        state.shake = Math.max(state.shake, 0.25);
        state.events.push('crash');
      }
    }
  }
}

function stepRivals(state, dt) {
  const m = state.mission;
  if (!m || !m.rivals) return;
  const p = state.player;
  for (const r of m.rivals) {
    if (r.health <= 0) continue;
    const d = Math.hypot(p.x - r.x, p.y - r.y);
    r.angle = Math.atan2(p.y - r.y, p.x - r.x);
    r.shootCd -= dt;
    if (d > 60) {
      r.x += Math.cos(r.angle) * 90 * dt;
      r.y += Math.sin(r.angle) * 90 * dt;
    } else if (r.shootCd <= 0 && d < 320) {
      r.shootCd = 1.6 + state.rng() * 0.8;
      fireBullet(state, r.x, r.y, r.angle, 'rival', 8);
      state.events.push('rivalShot');
    }
    if (d < 26 && p.invuln <= 0) hurtPlayer(state, 8);
  }
  state.rivals = m.rivals;
}

function stepPickups(state, dt) {
  const p = state.player;
  for (const pk of state.pickups) {
    pk.bob += dt * 3;
    const d = Math.hypot(pk.x - p.x, pk.y - p.y);
    if (d < 26) {
      if (pk.kind === 'health') p.health = Math.min(PLAYER.health, p.health + 30);
      else if (pk.kind === 'armor') p.armor = Math.min(50, p.armor + 25);
      else if (pk.kind === 'ammo') p.ammo += 12;
      else { state.cash += 50; state.score += 50; }
      pk.taken = true;
      state.events.push('pickup');
    }
  }
  state.pickups = state.pickups.filter((pk) => !pk.taken);
  if (state.pickups.length < PICKUP_COUNT && state.rng() < 0.01) {
    state.pickups.push(spawnPickup(state.rng));
  }
}

// The safehouse (unlocked after mission 4) slowly heals the player nearby.
function stepSafehouse(state, dt) {
  if (!state.safehouseActive) return;
  const p = state.player;
  const d = Math.hypot(p.x - 200, p.y - 200);
  if (d < 90 && !p.inCar) p.health = Math.min(PLAYER.health, p.health + 6 * dt);
}

function maintainPopulation(state, dt) {
  state.trafficTimer -= dt;
  if (state.trafficTimer <= 0) {
    state.trafficTimer = 4;
    const traffic = state.cars.filter((c) => c.driver === 'traffic' && !c.wrecked).length;
    if (traffic < TRAFFIC_COUNT) state.cars.push(spawnTrafficCar(state.rng, pick(state.rng, CAR_MODELS)));
  }
}
