// Traffic AI for the 3D city: cars drive the road grid on the XZ plane, keep to their lane,
// slow for the car ahead and turn at intersections. A car moves along one axis until a crossing
// road, where it may turn onto it.

import { WORLD, ROAD_W, BEACH_Z, clamp } from './config.js';
import { ROAD_XS, ROAD_ZS } from './city.js';
import { rand, pick, chance } from './random.js';

export function spawnTrafficCar(rng, model) {
  const vertical = rng() < 0.5;
  const lane = (rng() < 0.5 ? -1 : 1) * 1.6;
  let x, z, axis, sign;
  if (vertical) {
    x = pick(rng, ROAD_XS) + lane;
    z = rand(rng, 150, BEACH_Z - 150);
    axis = 'v'; sign = lane > 0 ? 1 : -1;
  } else {
    x = rand(rng, 150, WORLD.width - 150);
    z = pick(rng, ROAD_ZS) + lane;
    axis = 'h'; sign = lane > 0 ? -1 : 1;
  }
  return {
    x, z, axis, sign, speed: 0,
    angle: axis === 'h' ? (sign > 0 ? 0 : Math.PI) : (sign > 0 ? Math.PI / 2 : -Math.PI / 2),
    model: model.name, color: model.color, top: model.top, accel: model.accel,
    health: 100, driver: 'traffic', wrecked: false, parked: false,
  };
}

export function spawnParkedCar(rng, model, x, z) {
  return {
    x, z, axis: 'h', sign: 1, speed: 0,
    angle: (rng() < 0.5 ? 0 : Math.PI) + (rng() - 0.5) * 0.2,
    model: model.name, color: model.color, top: model.top, accel: model.accel,
    health: 100, driver: 'parked', wrecked: false, parked: true,
  };
}

function carAhead(state, car, look) {
  let best = Infinity;
  for (const other of state.cars) {
    if (other === car || other.wrecked) continue;
    const dx = other.x - car.x, dz = other.z - car.z;
    const d = Math.hypot(dx, dz);
    if (d > look || d < 1) continue;
    const fx = Math.cos(car.angle), fz = Math.sin(car.angle);
    if ((dx * fx + dz * fz) / d > 0.75 && d < best) best = d;
  }
  return best;
}

export function stepTraffic(state, dt) {
  for (const car of state.cars) {
    if (car.driver !== 'traffic' || car.wrecked) continue;
    const ahead = carAhead(state, car, 8);
    let target = car.top * 0.42;
    if (ahead < 4.5) target = 0;
    else if (ahead < 8) target = car.top * 0.18;
    car.speed += clamp(target - car.speed, -22 * dt * 3, 13 * dt * 3);
    if (car.speed < 0) car.speed = 0;
    const step = car.speed * dt;
    if (car.axis === 'h') car.x += car.sign * step;
    else car.z += car.sign * step;
    const nearX = nearestRoad(car.x, ROAD_XS);
    const nearZ = nearestRoad(car.z, ROAD_ZS);
    if (car.axis === 'h' && nearZ !== null && Math.abs(car.z - nearZ) < 1.2 && car.speed > 3) {
      if (chance(state.rng, 0.22)) turnCar(state, car, 'v', nearZ);
    } else if (car.axis === 'v' && nearX !== null && Math.abs(car.x - nearX) < 1.2 && car.speed > 3) {
      if (chance(state.rng, 0.22)) turnCar(state, car, 'h', nearX);
    }
    if (car.axis === 'h' && (car.x < 12 || car.x > WORLD.width - 12)) {
      car.sign *= -1; car.x = clamp(car.x, 12, WORLD.width - 12);
    }
    if (car.axis === 'v' && (car.z < 12 || car.z > BEACH_Z - 12)) {
      car.sign *= -1; car.z = clamp(car.z, 12, BEACH_Z - 12);
    }
    car.angle = car.axis === 'h'
      ? (car.sign > 0 ? 0 : Math.PI)
      : (car.sign > 0 ? Math.PI / 2 : -Math.PI / 2);
  }
}

function nearestRoad(v, roads) {
  let best = null, bd = Infinity;
  for (const r of roads) { const d = Math.abs(v - r); if (d < bd) { bd = d; best = r; } }
  return bd < 2.5 ? best : null;
}

function turnCar(state, car, newAxis, roadCoord) {
  const lane = (state.rng() < 0.5 ? -1 : 1) * 1.6;
  if (newAxis === 'v') {
    car.axis = 'v';
    car.x = roadCoord + lane;
    car.sign = lane > 0 ? 1 : -1;
    car.z = clamp(car.z, 12, BEACH_Z - 12);
  } else {
    car.axis = 'h';
    car.z = roadCoord + lane;
    car.sign = lane > 0 ? -1 : 1;
    car.x = clamp(car.x, 12, WORLD.width - 12);
  }
}
