// The screenshot scenes behind ?shot=start|play|drive|mission (with &seed=N). Each one plays the
// real rules forward from a fresh world for a fixed number of steps, steered by a simple autopilot
// that drives the road grid toward its waypoint and shoots at the nearest rival, so the frame is
// what a short game really looks like and the same seed always gives the same frame.

import { STEP } from './config.js';
import { ROAD_XS, ROAD_ZS } from './city.js';
import { SCREEN_TITLE, SCREEN_PLAY } from './render3d.js';
import { startMission } from './missions.js';
import { stepWorld, createWorld } from './world.js';
import { spawnCop } from './police.js';

const START_SECONDS = 5;
const PLAY_SECONDS = 5;
const DRIVE_SECONDS = 9;
const MISSION_SECONDS = 3;

function fakeInput() {
  return {
    held: new Set(),
    pressed: new Set(),
    mouse: { x: 640, y: 360, down: false, clicked: false },
    is(a) { return this.held.has(a); },
    wasPressed() { return false; },
    endFrame() { this.pressed.clear(); this.mouse.clicked = false; },
  };
}

function nearest(v, roads) {
  let best = roads[0], bd = Infinity;
  for (const r of roads) { const d = Math.abs(v - r); if (d < bd) { bd = d; best = r; } }
  return best;
}

/** Manhattan route through the road grid: intersections from near `from` to near `to`. */
function gridRoute(from, to) {
  const ix = nearest(from.x, ROAD_XS);
  const iz = nearest(from.z, ROAD_ZS);
  const tx = nearest(to.x, ROAD_XS);
  const tz = nearest(to.z, ROAD_ZS);
  const pts = [{ x: ix, z: iz }];
  if (tx !== ix) pts.push({ x: tx, z: iz });
  if (tz !== iz) pts.push({ x: tx, z: tz });
  pts.push({ x: to.x, z: to.z });
  return pts;
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
  if (speed < 3) auto.stuck += 1; else auto.stuck = 0;
  if (auto.stuck > 90) {
    auto.stuck = 0;
    auto.reversing = 45;
    input.held.add('down');
    return input;
  }
  let wp = route[0];
  while (route.length > 1 && Math.hypot(wp.x - p.x, wp.z - p.z) < 7) { route.shift(); wp = route[0]; }
  const wpDist = Math.hypot(wp.x - p.x, wp.z - p.z);
  const want = Math.atan2(wp.z - p.z, wp.x - p.x);
  let diff = want - car.angle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  if (Math.abs(diff) > 1.0) input.held.add('down');
  else if (Math.abs(diff) > 0.45) { if (speed > 16) input.held.add('down'); }
  else if (speed < (wpDist < 18 ? 17 : 35)) input.held.add('up');
  if (diff > 0.2) input.held.add('left');
  else if (diff < -0.2) input.held.add('right');
  return input;
}

export function stageShot(name, state, seed) {
  const fresh = createWorld(seed);
  for (const key of Object.keys(fresh)) state[key] = fresh[key];
  const p = state.player;

  if (name === 'start') {
    state.camera.x = 1600; state.camera.z = 1100; state.camera.angle = 0;
    for (let i = 0; i < START_SECONDS / STEP; i += 1) stepWorld(state, fakeInput(), STEP);
    return { screen: SCREEN_TITLE, best: 0 };
  }

  if (name === 'drive') {
    startMission(state, 0);
    const car = state.cars[2];
    car.x = 2200; car.z = 1400; car.angle = Math.PI; car.speed = 20;
    p.x = car.x; p.z = car.z; p.inCar = car; car.driver = 'player';
    const route = gridRoute({ x: p.x, z: p.z }, { x: 600, z: 1400 });
    for (let i = 0; i < DRIVE_SECONDS / STEP; i += 1) {
      stepWorld(state, driveAutopilot(state, route), STEP);
      if (state.gameOver) break;
    }
    return { screen: SCREEN_PLAY, best: state.score };
  }

  if (name === 'mission') {
    startMission(state, 2);
    p.x = 1750; p.z = 1060;
    p.ammo = 120;
    const input = fakeInput();
    for (let i = 0; i < MISSION_SECONDS / STEP; i += 1) {
      let best = null, bd = Infinity;
      for (const r of state.rivals) {
        if (r.health <= 0) continue;
        const d = Math.hypot(r.x - p.x, r.z - p.z);
        if (d < bd) { bd = d; best = r; }
      }
      input.held.clear();
      if (best && bd < 32) {
        const want = Math.atan2(best.z - p.z, best.x - p.x);
        let diff = want - p.angle;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        if (diff > 0.1) input.held.add('right');
        else if (diff < -0.1) input.held.add('left');
        if (Math.abs(diff) < 0.35) {
          input.mouse.clicked = true;
          input.mouse.down = true;
        } else {
          input.mouse.down = false;
        }
      }
      stepWorld(state, input, STEP);
      input.endFrame();
      if (state.gameOver) break;
    }
    state.banner = null;
    return { screen: SCREEN_PLAY, best: state.score };
  }

  // 'play' (the cover): a police chase at wanted 3 with a mission running.
  startMission(state, 1);
  const car = state.cars[2];
  car.x = 1000; car.z = 600; car.angle = 0; car.speed = 24;
  p.x = car.x; p.z = car.z; p.inCar = car; car.driver = 'player';
  state.wanted.heat = 60;
  state.wanted.lastCrime = 0;
  // The three pursuit cars start in a line behind the player on the same road, so the shot
  // reads as a chase: the player's car ahead, the black-and-whites trailing behind it.
  const trail = [[-45, -5], [-70, 3], [-95, 8]];
  for (let i = 0; i < 3; i += 1) {
    const cop = spawnCop(state, true);
    cop.x = 1000 + trail[i][0]; cop.z = 600 + trail[i][1]; cop.angle = 0;
    cop.car.x = cop.x; cop.car.z = cop.z; cop.car.angle = 0; cop.car.speed = 30;
  }
  const route = gridRoute({ x: p.x, z: p.z }, { x: 2600, z: 200 });
  for (let i = 0; i < PLAY_SECONDS / STEP; i += 1) {
    stepWorld(state, driveAutopilot(state, route), STEP);
    if (state.gameOver) break;
  }
  return { screen: SCREEN_PLAY, best: state.score };
}
