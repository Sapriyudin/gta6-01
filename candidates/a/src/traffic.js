// Traffic AI: cars that drive the road grid, keep to their lane, slow for the car ahead and turn
// at intersections. A traffic car moves along one axis (horizontal or vertical road) until an
// intersection, where it may turn onto the crossing road. It never leaves the roads.

import { WORLD, ROAD_W, BEACH_Y, clamp } from './config.js';
import { ROAD_XS, ROAD_YS } from './city.js';
import { rand, pick, chance } from './random.js';

export function spawnTrafficCar(rng, model) {
  const vertical = rng() < 0.5;
  const lane = (rng() < 0.5 ? -1 : 1) * 20;
  let x, y, axis, sign;
  if (vertical) {
    x = pick(rng, ROAD_XS) + lane;
    y = rand(rng, 150, BEACH_Y - 150);
    axis = 'v'; sign = lane > 0 ? 1 : -1;
  } else {
    x = rand(rng, 150, WORLD.width - 150);
    y = pick(rng, ROAD_YS) + lane;
    axis = 'h'; sign = lane > 0 ? -1 : 1;
  }
  return {
    x, y, axis, sign, speed: 0,
    angle: axis === 'h' ? (sign > 0 ? 0 : Math.PI) : (sign > 0 ? Math.PI / 2 : -Math.PI / 2),
    model: model.name, color: model.color, top: model.top, accel: model.accel,
    health: 100, driver: 'traffic', wrecked: false, parked: false,
  };
}

export function spawnParkedCar(rng, model, x, y) {
  return {
    x, y, axis: 'h', sign: 1, speed: 0,
    angle: (rng() < 0.5 ? 0 : Math.PI) + (rng() - 0.5) * 0.3,
    model: model.name, color: model.color, top: model.top, accel: model.accel,
    health: 100, driver: 'parked', wrecked: false, parked: true,
  };
}

function carAhead(state, car, look) {
  let best = Infinity;
  for (const other of state.cars) {
    if (other === car || other.wrecked) continue;
    const dx = other.x - car.x, dy = other.y - car.y;
    const d = Math.hypot(dx, dy);
    if (d > look || d < 1) continue;
    // Is the other car in front of this one (within a forward cone)?
    const fx = Math.cos(car.angle), fy = Math.sin(car.angle);
    const along = (dx * fx + dy * fy) / d;
    if (along > 0.75 && d < best) best = d;
  }
  return best;
}

export function stepTraffic(state, dt) {
  for (const car of state.cars) {
    if (car.driver !== 'traffic' || car.wrecked) continue;
    const ahead = carAhead(state, car, 90);
    let target = car.top * 0.42;
    if (ahead < 55) target = 0;
    else if (ahead < 90) target = car.top * 0.18;
    car.speed += clamp(target - car.speed, -260 * dt * 3, 150 * dt * 3);
    if (car.speed < 0) car.speed = 0;

    const step = car.speed * dt;
    if (car.axis === 'h') car.x += car.sign * step;
    else car.y += car.sign * step;

    // At an intersection, sometimes turn onto the crossing road.
    const nearX = nearestRoad(car.x, ROAD_XS);
    const nearY = nearestRoad(car.y, ROAD_YS);
    if (car.axis === 'h' && nearY !== null && Math.abs(car.y - nearY) < 14 && car.speed > 40) {
      if (chance(state.rng, 0.22)) turnCar(state, car, 'v', nearY);
    } else if (car.axis === 'v' && nearX !== null && Math.abs(car.x - nearX) < 14 && car.speed > 40) {
      if (chance(state.rng, 0.22)) turnCar(state, car, 'h', nearX);
    }
    // End of the road: turn around.
    if (car.axis === 'h' && (car.x < 130 || car.x > WORLD.width - 130)) {
      car.sign *= -1; car.angle = car.sign > 0 ? 0 : Math.PI;
      car.x = clamp(car.x, 130, WORLD.width - 130);
    }
    if (car.axis === 'v' && (car.y < 130 || car.y > BEACH_Y - 130)) {
      car.sign *= -1; car.angle = car.sign > 0 ? Math.PI / 2 : -Math.PI / 2;
      car.y = clamp(car.y, 130, BEACH_Y - 130);
    }
    car.angle = car.axis === 'h'
      ? (car.sign > 0 ? 0 : Math.PI)
      : (car.sign > 0 ? Math.PI / 2 : -Math.PI / 2);
  }
}

function nearestRoad(v, roads) {
  let best = null, bd = Infinity;
  for (const r of roads) { const d = Math.abs(v - r); if (d < bd) { bd = d; best = r; } }
  return bd < 30 ? best : null;
}

function turnCar(state, car, newAxis, roadCoord) {
  const lane = (state.rng() < 0.5 ? -1 : 1) * 20;
  if (newAxis === 'v') {
    car.axis = 'v';
    car.x = roadCoord + lane;
    car.sign = lane > 0 ? 1 : -1;
    car.y = clamp(car.y, 130, BEACH_Y - 130);
  } else {
    car.axis = 'h';
    car.y = roadCoord + lane;
    car.sign = lane > 0 ? -1 : 1;
    car.x = clamp(car.x, 130, WORLD.width - 130);
  }
}
