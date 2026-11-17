// The Solmar City Police Department: patrol cars cruise the grid while the heat is off; when the
// wanted level rises they chase, ram the player's car, and on foot they close in to make a bust.
// Cops spawn at the edge of the player's view in proportion to the wanted level and give up (and
// drive off) once the heat is gone.

import { WORLD, BEACH_Y, CAR_MODELS, clamp, angleLerp } from './config.js';
import { rand, pick } from './random.js';
import { addHeat } from './combat.js';
import { collideBuildings } from './city.js';
import { WANTED } from './config.js';

const COP_COLOR = '#1d4ed8';
const COP_TOP = 600;

export function wantedCopCount(stars) {
  return [0, 1, 2, 3, 4, 5][stars] ?? 0;
}

export function spawnCop(state, inCar) {
  const p = state.player;
  // Appear just off-screen, on a road near the player.
  const angle = state.rng() * Math.PI * 2;
  const x = clamp(p.x + Math.cos(angle) * 750, 120, WORLD.width - 120);
  const y = clamp(p.y + Math.sin(angle) * 650, 120, BEACH_Y - 120);
  const cop = {
    x, y, angle: Math.atan2(p.y - y, p.x - x), speed: 0,
    health: 100, state: 'chase', inCar, car: null,
    bustTimer: 0, downTimer: 0, ramCd: 0, shootCd: rand(state.rng, 1, 2),
  };
  if (inCar) {
    const car = {
      x, y, angle: cop.angle, speed: 0, axis: 'h', sign: 1,
      model: 'Interceptor', color: COP_COLOR, top: COP_TOP, accel: 1.15,
      health: 120, driver: 'cop', wrecked: false, parked: false, cop,
    };
    cop.car = car;
    state.cars.push(car);
  }
  state.cops.push(cop);
  return cop;
}

export function stepCops(state, dt) {
  const p = state.player;
  const stars = state.wanted.stars;
  for (const cop of state.cops) {
    if (cop.state === 'down') {
      cop.downTimer -= dt;
      if (cop.downTimer <= 0) { cop.state = stars > 0 ? 'chase' : 'patrol'; cop.health = 60; }
      continue;
    }
    if (stars === 0) {
      cop.state = 'patrol';
      cop.bustTimer = 0;
      // Give up and drive off: drift away from the player.
      const away = Math.atan2(cop.y - p.y, cop.x - p.x);
      if (cop.inCar && cop.car && !cop.car.wrecked) {
        cop.car.angle = angleLerp(cop.car.angle, away, dt * 1.2);
        cop.car.speed = Math.min(cop.car.speed + 200 * dt, 300);
        cop.car.x += Math.cos(cop.car.angle) * cop.car.speed * dt;
        cop.car.y += Math.sin(cop.car.angle) * cop.car.speed * dt;
        cop.x = cop.car.x; cop.y = cop.car.y; cop.angle = cop.car.angle;
      }
      continue;
    }
    cop.state = 'chase';
    const d = Math.hypot(p.x - cop.x, p.y - cop.y);
    if (cop.inCar && cop.car && !cop.car.wrecked) {
      const car = cop.car;
      const want = Math.atan2(p.y - car.y, p.x - car.x);
      car.angle = angleLerp(car.angle, want, dt * 2.2);
      const target = d > 90 ? COP_TOP * 0.85 : COP_TOP * 0.5;
      car.speed += clamp(target - car.speed, -400 * dt, 320 * dt);
      car.x += Math.cos(car.angle) * car.speed * dt;
      car.y += Math.sin(car.angle) * car.speed * dt;
      // Cop cars cannot drive through buildings: slide along them instead.
      const hit = collideBuildings(state.city, car.x, car.y, 24);
      if (hit.hit) {
        car.x = hit.x; car.y = hit.y;
        car.speed *= 0.5;
      }
      cop.x = car.x; cop.y = car.y; cop.angle = car.angle;
      // Ram: hitting the player's car damages it and shakes the camera.
      if (cop.ramCd > 0) cop.ramCd -= dt;
      if (p.inCar && d < 46 && cop.ramCd <= 0) {
        cop.ramCd = 0.9;
        p.inCar.health -= 9;
        car.health -= 3;
        if (p.inCar.health <= 0) p.inCar.wrecked = true;
        if (car.health <= 0) car.wrecked = true;
        state.events.push('crash');
        state.shake = Math.max(state.shake, 6);
      }
      // Close enough and the player is on foot: the cop gets out and chases on foot.
      if (!p.inCar && d < 130) {
        cop.inCar = false;
        state.cars = state.cars.filter((c) => c !== car);
      }
    } else {
      // On foot: run at the player, shoot from range, bust up close.
      const want = Math.atan2(p.y - cop.y, p.x - cop.x);
      cop.angle = angleLerp(cop.angle, want, dt * 4);
      const speed = d > 200 ? 300 : 265;
      cop.x += Math.cos(cop.angle) * speed * dt;
      cop.y += Math.sin(cop.angle) * speed * dt;
      if (!p.inCar && d > 120 && d < 420) {
        cop.shootCd -= dt;
        if (cop.shootCd <= 0) {
          cop.shootCd = rand(state.rng, 1.2, 2.2);
          const a = Math.atan2(p.y - cop.y, p.x - cop.x) + (state.rng() - 0.5) * 0.3;
          state.bullets.push({
            x: cop.x, y: cop.y, vx: Math.cos(a) * 700, vy: Math.sin(a) * 700,
            life: 0.7, from: 'cop', damage: 8,
          });
          state.events.push('shot');
        }
      }
      if (!p.inCar && d < 34) {
        cop.bustTimer += dt;
        if (cop.bustTimer >= WANTED.bustSeconds) {
          state.busted = true;
          state.events.push('bust');
        }
      } else {
        cop.bustTimer = Math.max(0, cop.bustTimer - dt * 2);
      }
    }
  }
  // Despawn cops that are far away once the heat is gone.
  if (stars === 0) {
    state.cops = state.cops.filter((cop) => {
      const d = Math.hypot(cop.x - p.x, cop.y - p.y);
      if (d > 1100) {
        if (cop.car) state.cars = state.cars.filter((c) => c !== cop.car);
        return false;
      }
      return true;
    });
  }
}
