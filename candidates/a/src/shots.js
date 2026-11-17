// The screenshot scenes behind ?shot=start|play|drive|mission (with &seed=N). Each one plays the
// real rules forward from a fresh world for a fixed number of steps, steered by a simple autopilot
// that drives the road grid toward its waypoint and shoots at the nearest rival, so the frame is
// what a short game really looks like and the same seed always gives the same frame.

import { STEP } from './config.js';
import { ROAD_XS, ROAD_YS } from './city.js';
import { SCREEN_TITLE, SCREEN_PLAY } from './render.js';
import { startMission } from './missions.js';
import { stepWorld, createWorld } from './world.js';
import { spawnCop } from './police.js';

const START_SECONDS = 5;
const PLAY_SECONDS = 16;
const DRIVE_SECONDS = 10;
const MISSION_SECONDS = 3;

/** A fake input object that steers like a player would, for the autopilot. */
function fakeInput() {
  const held = new Set();
  return {
    held,
    pressed: new Set(),
    mouse: { x: 640, y: 360, down: false, clicked: false },
    is(a) { return held.has(a); },
    wasPressed(a) { return this.pressed.has(a); },
    aimAngle(x, y, cam) {
      const wx = cam.x + (this.mouse.x / cam.scale - 640);
      const wy = cam.y + (this.mouse.y / cam.scale - 360);
      return Math.atan2(wy - y, wx - x);
    },
    endFrame() { this.pressed.clear(); this.mouse.clicked = false; },
  };
}

/** Manhattan route through the road grid: intersections from near `from` to near `to`. */
function gridRoute(from, to) {
  const ix = nearest(from.x, ROAD_XS);
  const iy = nearest(from.y, ROAD_YS);
  const tx = nearest(to.x, ROAD_XS);
  const ty = nearest(to.y, ROAD_YS);
  const pts = [{ x: ix, y: iy }];
  if (tx !== ix) pts.push({ x: tx, y: iy });
  if (ty !== iy) pts.push({ x: tx, y: ty });
  pts.push({ x: to.x, y: to.y });
  return pts;
}

function nearest(v, roads) {
  let best = roads[0], bd = Infinity;
  for (const r of roads) { const d = Math.abs(v - r); if (d < bd) { bd = d; best = r; } }
  return best;
}

/** Drive the player's car along the route; returns the input held keys for this step. */
function driveAutopilot(state, route) {
  const input = fakeInput();
  const p = state.player;
  const car = p.inCar;
  if (!car) return input;
  const auto = state._auto || (state._auto = { stuck: 0, reversing: 0 });
  const speed = Math.abs(car.speed);
  if (auto.reversing > 0) {
    auto.reversing -= 1;
    input.held.add('down');
    input.held.add(state.rng() < 0.5 ? 'left' : 'right');
    return input;
  }
  if (speed < 40) auto.stuck += 1; else auto.stuck = 0;
  if (auto.stuck > 90) {
    auto.stuck = 0;
    auto.reversing = 45;
    input.held.add('down');
    return input;
  }
  let wp = route[0];
  while (route.length > 1 && Math.hypot(wp.x - p.x, wp.y - p.y) < 90) { route.shift(); wp = route[0]; }
  const wpDist = Math.hypot(wp.x - p.x, wp.y - p.y);
  const want = Math.atan2(wp.y - p.y, wp.x - p.x);
  let diff = want - car.angle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  // Slow down for turns: a fast car cannot make a 400-unit grid corner.
  if (Math.abs(diff) > 1.0) input.held.add('down');
  else if (Math.abs(diff) > 0.45) { if (speed > 200) input.held.add('down'); }
  else if (speed < (wpDist < 220 ? 210 : 430)) input.held.add('up');
  if (diff > 0.25) input.held.add('left');
  else if (diff < -0.25) input.held.add('right');
  return input;
}

/**
 * Set `state` to the named scene and return the screen to draw over it.
 * The world is reset first, so every scene starts from the same seed.
 */
export function stageShot(name, state, seed) {
  const fresh = createWorld(seed);
  for (const key of Object.keys(fresh)) state[key] = fresh[key];
  const p = state.player;

  if (name === 'start') {
    state.camera.x = 1600; state.camera.y = 1100;
    for (let i = 0; i < START_SECONDS / STEP; i += 1) stepWorld(state, fakeInput(), STEP);
    state.camera.x = 1600; state.camera.y = 1100;
    return { screen: SCREEN_TITLE, best: 0 };
  }

  if (name === 'drive') {
    startMission(state, 0);
    const car = state.cars[2];
    // A clean westbound start on the 1400 road, straight toward the garage.
    car.x = 2200; car.y = 1400; car.angle = Math.PI; car.speed = 250;
    p.x = car.x; p.y = car.y; p.inCar = car; car.driver = 'player';
    const route = gridRoute({ x: p.x, y: p.y }, { x: 600, y: 1400 });
    for (let i = 0; i < DRIVE_SECONDS / STEP; i += 1) {
      stepWorld(state, driveAutopilot(state, route), STEP);
      if (state.gameOver) break;
    }
    return { screen: SCREEN_PLAY, best: state.score };
  }

  if (name === 'mission') {
    startMission(state, 2);
    p.x = 1750; p.y = 1060;
    p.ammo = 120;
    const input = fakeInput();
    for (let i = 0; i < MISSION_SECONDS / STEP; i += 1) {
      // Aim at the nearest living rival and fire, but only in range.
      let best = null, bd = Infinity;
      for (const r of state.rivals) {
        if (r.health <= 0) continue;
        const d = Math.hypot(r.x - p.x, r.y - p.y);
        if (d < bd) { bd = d; best = r; }
      }
      if (best && bd < 380) {
        const sx = (best.x - state.camera.x) * 0.95 + 640;
        const sy = (best.y - state.camera.y) * 0.95 + 360;
        input.mouse.x = sx; input.mouse.y = sy;
        input.mouse.clicked = true;
        input.mouse.down = true;
      } else {
        input.mouse.down = false;
      }
      // Strafe toward the corner so the fight reads on screen.
      const dx = 1800 - p.x, dy = 1000 - p.y;
      input.held.clear();
      if (dx > 20) input.held.add('right');
      if (dx < -20) input.held.add('left');
      if (dy > 20) input.held.add('down');
      if (dy < -20) input.held.add('up');
      stepWorld(state, input, STEP);
      input.endFrame();
      if (state.gameOver) break;
    }
    state.banner = null; // the objective bar already says the job; keep the fight visible
    return { screen: SCREEN_PLAY, best: state.score };
  }

  // 'play' (the cover): a police chase at wanted 3 with a mission running.
  startMission(state, 1);
  const car = state.cars[2];
  // A clean eastbound start on the 600 road, so the chase reads at once.
  car.x = 1000; car.y = 600; car.angle = 0; car.speed = 300;
  p.x = car.x; p.y = car.y; p.inCar = car; car.driver = 'player';
  state.wanted.heat = 60;
  state.wanted.lastCrime = 0;
  for (let i = 0; i < 3; i += 1) spawnCop(state, true);
  const route = gridRoute({ x: p.x, y: p.y }, { x: 2600, y: 200 });
  for (let i = 0; i < PLAY_SECONDS / STEP; i += 1) {
    stepWorld(state, driveAutopilot(state, route), STEP);
    if (state.gameOver) break;
  }
  return { screen: SCREEN_PLAY, best: state.score };
}
