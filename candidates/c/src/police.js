// Police: wanted stars drive how many cops hunt the player. Cops patrol on foot at 0 stars,
// chase in cars (or on foot) once wanted, ram the player's car, and bust the player on foot
// if they get close while the player is unarmed and slow. Each cop chases a slightly
// different point beside the player so the pursuit fans out instead of piling up.
import { WORLD, WANTED, CAR_MODELS, angleLerp, clamp } from './config.js';
import { rand, pick } from './random.js';
import { collideBuildings } from './city.js';
import { hurtPlayer, addHeat } from './combat.js';

export function wantedCopCount(stars) {
  return [0, 1, 2, 3, 4, 5][Math.max(0, Math.min(5, stars))] || 0;
}

export function updateWanted(state, dt) {
  const w = state.wanted;
  const stars = Math.min(5, Math.floor(w.heat / WANTED.star));
  w.stars = stars;
  if (state.time - w.lastCrime > WANTED.hideDelay) {
    w.heat = Math.max(0, w.heat - WANTED.decay * dt);
  }
  // Cops give up slowly once the player is out of sight and the heat is low.
  if (w.stars === 0 && state.cops.length > 0) {
    for (const cop of state.cops) cop.giveUp = (cop.giveUp || 0) + dt;
    state.cops = state.cops.filter((c) => (c.giveUp || 0) < 4);
  }
}

export function spawnCop(state, inCar) {
  const p = state.player;
  const a = state.rng() * Math.PI * 2;
  const d = 60 + state.rng() * 40;
  let x = p.x + Math.cos(a) * d;
  let z = p.y + Math.sin(a) * d;
  x = clamp(x, 40, WORLD.width - 40);
  z = clamp(z, 40, 2300);
  const cop = {
    x, y: z, angle: Math.atan2(p.y - z, p.x - x), speed: 0,
    health: 100, state: 'chase', inCar, car: null, slot: state.cops.length % 3,
    bustTimer: 0, downTimer: 0, ramCd: 0, shootCd: rand(state.rng, 1, 2), giveUp: 0,
  };
  if (inCar) {
    const model = CAR_MODELS[4];
    const car = {
      x, y: z, angle: cop.angle, speed: 0, health: 90,
      model: 'Patrol', color: '#2f6df6', top: 48, accel: 330,
      driver: 'cop', wrecked: false, crashCd: 0, ai: null,
    };
    cop.car = car;
    state.cars.push(car);
  }
  state.cops.push(cop);
  return cop;
}

export function stepCops(state, dt) {
  const p = state.player;
  const want = wantedCopCount(state.wanted.stars);
  while (state.cops.filter((c) => c.state !== 'down').length < want) spawnCop(state, state.wanted.stars >= 2 || state.rng() < 0.5);
  for (const cop of state.cops) {
    if (cop.state === 'down') {
      cop.downTimer -= dt;
      if (cop.downTimer <= 0) { cop.state = 'chase'; cop.health = 60; }
      continue;
    }
    cop.ramCd = Math.max(0, cop.ramCd - dt);
    cop.shootCd -= dt;
    if (cop.inCar && cop.car && !cop.car.wrecked) {
      const car = cop.car;
      // Chase a point beside the player: slots spread the pursuit across the road.
      const wantA = Math.atan2(p.y - car.y, p.x - car.x);
      const off = [-8, 3, 8][cop.slot] ?? 0;
      const tx = p.x + Math.cos(wantA + Math.PI / 2) * off;
      const ty = p.y + Math.sin(wantA + Math.PI / 2) * off;
      const aim = Math.atan2(ty - car.y, tx - car.x);
      car.angle = angleLerp(car.angle, aim, dt * 2.2);
      const distP = Math.hypot(p.x - car.x, p.y - car.y);
      const top = car.top * (distP < 8 ? 0.55 : 0.9);
      car.speed += clamp(top - car.speed, -320 * dt, 300 * dt);
      car.x += Math.cos(car.angle) * car.speed * dt;
      car.y += Math.sin(car.angle) * car.speed * dt;
      const res = collideBuildings(state.city, car.x, car.y, 2);
      car.x = res.x; car.y = res.y;
      cop.x = car.x; cop.y = car.y; cop.angle = car.angle;
      // Ram: a hard hit when the patrol car reaches the player's car. Rams share the
      // player's crash cooldown, so three cops together cannot melt the car in seconds —
      // a chase stays dangerous without ending the moment they catch up.
      if (distP < 7 && cop.ramCd <= 0 && p.inCar && p.inCar.crashCd <= 0) {
        cop.ramCd = 0.9;
        p.inCar.crashCd = 1.2;
        p.inCar.health -= 9;
        state.shake = Math.max(state.shake, 0.35);
        state.events.push('crash');
        if (p.inCar.health <= 0) { p.inCar.wrecked = true; p.inCar.driver = 'parked'; p.inCar = null; }
      }
      // Cops on the player's tail shoot at the car.
      if (cop.shootCd <= 0 && distP < 260 && distP > 12) {
        cop.shootCd = rand(state.rng, 1.4, 2.4);
        if (p.inCar) {
          p.inCar.health -= 2;
          state.events.push('copShot');
        }
      }
    } else {
      // On foot: run at the player, and bust them if close and the player is slow.
      const d = Math.hypot(p.x - cop.x, p.y - cop.y);
      const aim = Math.atan2(p.y - cop.y, p.x - cop.x);
      cop.angle = angleLerp(cop.angle, aim, dt * 4);
      const speed = 150;
      cop.x += Math.cos(cop.angle) * speed * dt;
      cop.y += Math.sin(cop.angle) * speed * dt;
      const res = collideBuildings(state.city, cop.x, cop.y, 2);
      cop.x = res.x; cop.y = res.y;
      if (d < 16 && !p.inCar) {
        cop.bustTimer += dt;
        if (cop.bustTimer > 1.2) {
          state.busted = true;
          state.events.push('busted');
        }
      } else cop.bustTimer = 0;
      // A cop on foot shoots when the player shoots back.
      if (cop.shootCd <= 0 && d < 220 && state.wanted.stars >= 2) {
        cop.shootCd = rand(state.rng, 1.6, 2.6);
        hurtPlayer(state, 6);
        state.events.push('copShot');
      }
    }
  }
  // Remove cops that fell far behind and are no longer wanted.
  if (state.wanted.stars === 0) {
    state.cops = state.cops.filter((c) => Math.hypot(c.x - p.x, c.y - p.y) < 500);
  }
}
