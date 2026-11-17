// The Solmar City Police Department, in 3D: patrol cars cruise the grid while the heat is off;
// when the wanted level rises they chase, ram the player's car, and on foot they close in to make
// a bust. Cops spawn at the edge of the player's view in proportion to the wanted level and give
// up (and drive off) once the heat is gone.

import { WORLD, BEACH_Z, clamp, angleLerp, WANTED } from './config.js';
import { rand } from './random.js';
import { collideBuildings } from './city.js';

const COP_COLOR = 0x1d4ed8;
const COP_TOP = 48;

export function wantedCopCount(stars) {
  return [0, 1, 2, 3, 4, 5][stars] ?? 0;
}

export function spawnCop(state, inCar) {
  const p = state.player;
  const angle = state.rng() * Math.PI * 2;
  const x = clamp(p.x + Math.cos(angle) * 60, 10, WORLD.width - 10);
  const z = clamp(p.z + Math.sin(angle) * 55, 10, BEACH_Z - 10);
  const cop = {
    x, z, angle: Math.atan2(p.z - z, p.x - x), speed: 0,
    health: 100, state: 'chase', inCar, car: null, slot: state.cops.length % 3,
    bustTimer: 0, downTimer: 0, ramCd: 0, shootCd: rand(state.rng, 1, 2),
  };
  if (inCar) {
    const car = {
      x, z, angle: cop.angle, speed: 0, axis: 'h', sign: 1,
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
      const away = Math.atan2(cop.z - p.z, cop.x - p.x);
      if (cop.inCar && cop.car && !cop.car.wrecked) {
        cop.car.angle = angleLerp(cop.car.angle, away, dt * 1.2);
        cop.car.speed = Math.min(cop.car.speed + 16 * dt, 24);
        cop.car.x += Math.cos(cop.car.angle) * cop.car.speed * dt;
        cop.car.z += Math.sin(cop.car.angle) * cop.car.speed * dt;
        cop.x = cop.car.x; cop.z = cop.car.z; cop.angle = cop.car.angle;
      }
      continue;
    }
    cop.state = 'chase';
    const d = Math.hypot(p.x - cop.x, p.z - cop.z);
    if (cop.inCar && cop.car && !cop.car.wrecked) {
      const car = cop.car;
      // Each cop aims at a slightly different point beside the player, so the chase fans out
      // instead of piling every car onto the same spot. The offsets are asymmetric on purpose:
      // no cop sits exactly on the chase line, so the player's car stays visible.
      const want = Math.atan2(p.z - car.z, p.x - car.x);
      const off = [-8, 3, 8][cop.slot] ?? 0;
      const tx = p.x + Math.cos(want + Math.PI / 2) * off;
      const tz = p.z + Math.sin(want + Math.PI / 2) * off;
      const aim = Math.atan2(tz - car.z, tx - car.x);
      car.angle = angleLerp(car.angle, aim, dt * 2.2);
      const target = d > 8 ? COP_TOP * 0.85 : COP_TOP * 0.5;
      car.speed += clamp(target - car.speed, -32 * dt, 26 * dt);
      car.x += Math.cos(car.angle) * car.speed * dt;
      car.z += Math.sin(car.angle) * car.speed * dt;
      const hit = collideBuildings(state.city, car.x, car.z, 2);
      if (hit.hit) { car.x = hit.x; car.z = hit.z; car.speed *= 0.5; }
      cop.x = car.x; cop.z = car.z; cop.angle = car.angle;
      if (cop.ramCd > 0) cop.ramCd -= dt;
      if (p.inCar && d < 4 && cop.ramCd <= 0) {
        cop.ramCd = 0.9;
        p.inCar.health -= 9;
        car.health -= 3;
        if (p.inCar.health <= 0) p.inCar.wrecked = true;
        if (car.health <= 0) car.wrecked = true;
        state.events.push('crash');
        state.shake = Math.max(state.shake, 0.5);
      }
      if (!p.inCar && d < 11) {
        cop.inCar = false;
        state.cars = state.cars.filter((c) => c !== car);
      }
    } else {
      const want = Math.atan2(p.z - cop.z, p.x - cop.x);
      cop.angle = angleLerp(cop.angle, want, dt * 4);
      const speed = d > 16 ? 24 : 21;
      cop.x += Math.cos(cop.angle) * speed * dt;
      cop.z += Math.sin(cop.angle) * speed * dt;
      if (!p.inCar && d > 10 && d < 34) {
        cop.shootCd -= dt;
        if (cop.shootCd <= 0) {
          cop.shootCd = rand(state.rng, 1.2, 2.2);
          const a = Math.atan2(p.z - cop.z, p.x - cop.x) + (state.rng() - 0.5) * 0.3;
          state.bullets.push({
            x: cop.x, z: cop.z, y: 1.4, vx: Math.cos(a) * 60, vz: Math.sin(a) * 60,
            life: 0.7, from: 'cop', damage: 8,
          });
          state.events.push('shot');
        }
      }
      if (!p.inCar && d < 2.8) {
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
  if (stars === 0) {
    state.cops = state.cops.filter((cop) => {
      const d = Math.hypot(cop.x - p.x, cop.z - p.z);
      if (d > 90) {
        if (cop.car) state.cars = state.cars.filter((c) => c !== cop.car);
        return false;
      }
      return true;
    });
  }
}
