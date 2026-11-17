// Deterministic shot mode: ?shot=<scene>&seed=N stages a fixed scene and sets
// window.__shotReady once it has rendered. Scenes: play (police chase, wanted 3),
// start (title), drive (city driving with traffic + peds), mission (a fight in progress
// with the dialogue box showing).
import { createWorld, stepWorld, resetWorld } from './world.js';
import { createRenderer } from './render.js';
import { drawHUD } from './hud.js';
import { startMission } from './missions.js';
import { spawnCop } from './police.js';
import { STEP, VIEW } from './config.js';

const PLAY_SECONDS = 6;
const DRIVE_SECONDS = 8;
const MISSION_SECONDS = 3;

function fakeInput() {
  const held = new Set();
  return {
    held,
    mouse: { x: 640, y: 360, down: false, clicked: false },
    is(a) { return held.has(a); },
    wasPressed() { return false; },
    consume() {},
    endFrame() {},
  };
}

function driveToward(state, input, tx, ty) {
  const car = state.player.inCar;
  if (!car) return;
  const want = Math.atan2(ty - car.y, tx - car.x);
  let diff = want - car.angle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  const near = Math.hypot(tx - car.x, ty - car.y) < 120;
  input.held.clear();
  if (Math.abs(diff) < 1.1 || Math.abs(car.speed) < 6) input.held.add('up');
  if (Math.abs(diff) > 0.5 && near) input.held.delete('up');
  if (diff < -0.08) input.held.add('left');
  if (diff > 0.08) input.held.add('right');
}

function runSim(state, input, seconds, steer) {
  const steps = Math.round(seconds / STEP);
  for (let i = 0; i < steps; i += 1) {
    if (steer) steer(state, input, i);
    stepWorld(state, input, STEP);
    input.endFrame();
  }
}

export function runShot(shot, seed, canvas, hudCanvas, status) {
  const state = createWorld(seed);
  const renderer = createRenderer(canvas);
  const input = fakeInput();
  const p = state.player;
  let screen = 'play';
  if (shot === 'start') {
    screen = 'title';
  } else if (shot === 'play') {
    startMission(state, 1);
    const car = state.cars[0];
    car.x = 1000; car.y = 600; car.angle = 0; car.speed = 24;
    p.x = car.x; p.y = car.y; p.inCar = car; car.driver = 'player';
    state.wanted.heat = 60;
    state.wanted.lastCrime = 9999; // no heat decay during the shot: the chase stays 3 stars.
    const trail = [[-45, -5], [-70, 3], [-95, 8]];
    for (let i = 0; i < 3; i += 1) {
      const cop = spawnCop(state, true);
      cop.x = 1000 + trail[i][0]; cop.y = 600 + trail[i][1]; cop.angle = 0;
      cop.car.x = cop.x; cop.car.y = cop.y; cop.car.angle = 0; cop.car.speed = 30;
    }
    const wps = [[1400, 600], [1800, 600], [2200, 600], [2600, 600], [3000, 600]];
    let wi = 0;
    runSim(state, input, PLAY_SECONDS, (s, inp) => {
      const car2 = s.player.inCar;
      if (!car2) return;
      const wp = wps[Math.min(wi, wps.length - 1)];
      if (Math.hypot(wp[0] - car2.x, wp[1] - car2.y) < 120 && wi < wps.length - 1) wi += 1;
      driveToward(s, inp, wp[0], wp[1]);
    });
  } else if (shot === 'drive') {
    startMission(state, 0);
    const car = state.cars[0];
    car.x = 1000; car.y = 600; car.angle = 0; car.speed = 20;
    p.x = car.x; p.y = car.y; p.inCar = car; car.driver = 'player';
    const wps = [[1400, 600], [1800, 600], [2200, 600], [2600, 600]];
    let wi = 0;
    runSim(state, input, DRIVE_SECONDS, (s, inp) => {
      const car2 = s.player.inCar;
      if (!car2) return;
      const wp = wps[Math.min(wi, wps.length - 1)];
      if (Math.hypot(wp[0] - car2.x, wp[1] - car2.y) < 120 && wi < wps.length - 1) wi += 1;
      driveToward(s, inp, wp[0], wp[1]);
    });
  } else if (shot === 'mission') {
    startMission(state, 2);
    p.x = 1800; p.y = 1120; p.angle = -Math.PI / 2;
    p.ammo = 120;
    runSim(state, input, MISSION_SECONDS, null);
    // Fire a few shots at the rivals so the frame shows combat (tracers + muzzle light).
    input.mouse.x = 640; input.mouse.y = 200;
    input.mouse.down = true;
    runSim(state, input, 0.6, null);
    input.mouse.down = false;
  }
  state.banner = null;
  state.camera.x = p.x;
  state.camera.y = p.y;
  renderer.draw(state, screen);
  const hg = hudCanvas.getContext('2d');
  hg.clearRect(0, 0, VIEW.width, VIEW.height);
  drawHUD(hg, state, screen, 0);
  if (status) status.textContent = `Shot ${shot} ready.`;
  window.__solmar = state;
  window.__shotReady = true;
}
