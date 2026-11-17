// Traffic: cars that drive the road grid, stop for each other, and can be stolen.
// Parked cars wait by the road until the player takes them.
import { ROAD_XS, ROAD_YS, WORLD, CAR_MODELS, clamp } from './config.js';
import { rand, pick } from './random.js';
import { randomRoadPoint } from './city.js';

export function spawnParkedCar(rng, model, x, y) {
  return {
    x, y, angle: Math.PI / 2, speed: 0, health: model.hp,
    model: model.name, color: model.color, top: model.top, accel: model.accel,
    driver: 'parked', wrecked: false, crashCd: 0, ai: null,
  };
}

export function spawnTrafficCar(rng, model) {
  const p = randomRoadPoint(rng);
  const horizontal = rng() < 0.5;
  const angle = horizontal ? (rng() < 0.5 ? 0 : Math.PI) : (rng() < 0.5 ? Math.PI / 2 : -Math.PI / 2);
  return {
    x: p.x, y: p.y, angle, speed: rand(rng, 14, 22), health: model.hp,
    model: model.name, color: model.color, top: model.top, accel: model.accel,
    driver: 'traffic', wrecked: false, crashCd: 0,
    ai: { targetSpeed: rand(rng, 16, 24), turnAt: null },
  };
}

function nearestAhead(state, car, dist) {
  let best = null, bd = dist;
  for (const other of state.cars) {
    if (other === car || other.wrecked) continue;
    const dx = other.x - car.x, dy = other.y - car.y;
    const along = dx * Math.cos(car.angle) + dy * Math.sin(car.angle);
    const side = Math.abs(-dx * Math.sin(car.angle) + dy * Math.cos(car.angle));
    if (along > 0 && along < bd && side < 8) { bd = along; best = other; }
  }
  return best;
}

export function stepTraffic(state, dt) {
  for (const car of state.cars) {
    if (car.driver !== 'traffic' || car.wrecked) continue;
    const ai = car.ai;
    // Slow down for the car ahead; stop at intersections when another car is close.
    const ahead = nearestAhead(state, car, 46);
    const target = ahead ? 0 : ai.targetSpeed;
    car.speed += clamp(target - car.speed, -260 * dt, 200 * dt);
    car.x += Math.cos(car.angle) * car.speed * dt;
    car.y += Math.sin(car.angle) * car.speed * dt;
    // Turn at the next intersection with a small random chance, staying on the grid.
    const onX = ROAD_XS.some((rx) => Math.abs(car.x - rx) < 3);
    const onY = ROAD_YS.some((ry) => Math.abs(car.y - ry) < 3);
    if ((onX || onY) && state.rng() < 0.012) {
      const turns = [0, Math.PI / 2, -Math.PI / 2, Math.PI];
      car.angle += turns[Math.floor(state.rng() * turns.length)];
    }
    if (car.x < 20 || car.x > WORLD.width - 20 || car.y < 20 || car.y > 2320) {
      car.angle += Math.PI;
      car.x = clamp(car.x, 30, WORLD.width - 30);
      car.y = clamp(car.y, 30, 2310);
    }
  }
  // Gentle separation so traffic cars never overlap.
  const cars = state.cars;
  for (let i = 0; i < cars.length; i += 1) {
    for (let j = i + 1; j < cars.length; j += 1) {
      const a = cars[i], b = cars[j];
      if (a.wrecked || b.wrecked) continue;
      const dx = b.x - a.x, dy = b.y - a.y;
      const d = Math.hypot(dx, dy);
      if (d > 0 && d < 12) {
        const push = (12 - d) / 2 / d;
        a.x -= dx * push; a.y -= dy * push;
        b.x += dx * push; b.y += dy * push;
      }
    }
  }
}
