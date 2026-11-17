// Solmar City — After Dark. Entry point: fixed 60 Hz sim, screens (title / play / paused /
// busted / over / win), procedural audio, save/load, deterministic shot mode.
import { VIEW, STEP } from './config.js';
import { createWorld, stepWorld, resetWorld } from './world.js';
import { createInput } from './input.js';
import { createRenderer } from './render.js';
import { drawHUD } from './hud.js';
import { createAudio } from './audio.js';
import { loadSave, persistSave } from './save.js';
import { startMission } from './missions.js';
import { runShot } from './shots.js';

const params = new URLSearchParams(window.location.search);
const seedParam = Number(params.get('seed'));
const seed = Number.isFinite(seedParam) ? seedParam : 7;
const shot = params.get('shot');

const canvas = document.getElementById('game');
const hudCanvas = document.getElementById('hud');
const status = document.getElementById('status');
canvas.width = VIEW.width;
canvas.height = VIEW.height;
hudCanvas.width = VIEW.width;
hudCanvas.height = VIEW.height;

const saved = loadSave();
const state = createWorld(seed);
if (saved) {
  state.cash = saved.cash || 0;
  state.score = saved.score || 0;
  state.missionIndex = saved.missionIndex || 0;
  state.storyDone = !!saved.storyDone;
  state.unlocks = new Set(saved.unlocks || ['Vela']);
  state.safehouseActive = !!saved.safehouse;
  state.best = saved.best || 0;
}
const input = createInput(canvas);
const renderer = createRenderer(canvas);
const audio = createAudio();
if (saved && saved.muted) audio.setMuted(true);

let screen = 'title';
let accumulator = 0;
let last = performance.now();
let winShown = false;
let muted = !!(saved && saved.muted);

function persist() {
  state.muted = muted;
  persistSave(state);
}

function drainEvents() {
  for (const e of state.events) {
    if (e === 'shot' || e === 'rivalShot' || e === 'copShot') audio.shot();
    else if (e === 'punch') audio.punch();
    else if (e === 'crash' || e === 'wrecked') audio.crash();
    else if (e === 'pickup') audio.pickup();
    else if (e === 'missionDone') audio.jingle();
    else if (e === 'missionFail') audio.fail();
    else if (e === 'busted') audio.busted();
    else if (e === 'unlock') { audio.jingle(); state.banner = { text: 'NEW CAR UNLOCKED — parked by the garage', t: 3.5 }; }
  }
  state.events.length = 0;
}

function frame(now) {
  const elapsed = Math.min(0.1, (now - last) / 1000);
  last = now;
  if (input.wasPressed('mute')) {
    muted = !muted;
    audio.setMuted(muted);
    persist();
  }
  if (screen === 'title') {
    if (input.wasPressed('confirm')) {
      screen = 'play';
      audio.unlock();
      if (!state.mission && state.missionIndex < 5) startMission(state, state.missionIndex);
      audio.jingle();
    }
  } else if (screen === 'paused') {
    if (input.wasPressed('pause') || input.wasPressed('confirm')) screen = 'play';
  } else if (screen === 'over') {
    if (input.wasPressed('confirm')) {
      persist();
      resetWorld(state, Math.floor(Math.random() * 4294967296));
      if (saved) { state.cash = 0; state.missionIndex = 0; state.storyDone = false; }
      winShown = false;
      screen = 'title';
    }
  } else if (screen === 'busted') {
    if (input.wasPressed('confirm')) {
      const fine = Math.min(200, state.cash);
      state.cash -= fine;
      state.wanted.heat = 0;
      state.cops = [];
      state.busted = false;
      state.player.health = 100;
      state.player.x = 1000; state.player.y = 760;
      state.player.inCar = null;
      persist();
      screen = 'play';
    }
  } else if (screen === 'win') {
    if (input.wasPressed('confirm')) { winShown = true; screen = 'play'; }
  } else if (screen === 'play') {
    if (input.wasPressed('pause')) screen = 'paused';
    else {
      if (input.wasPressed('confirm') && !state.mission && state.missionIndex < 5) {
        startMission(state, state.missionIndex);
      }
      accumulator += elapsed;
      while (accumulator >= STEP) {
        stepWorld(state, input, STEP);
        drainEvents();
        accumulator -= STEP;
      }
      const car = state.player.inCar;
      audio.engine(car ? Math.abs(car.speed) / 58 : 0, !!car);
      audio.siren(state.wanted.stars > 0, state.time);
      if (state.gameOver) { screen = 'over'; persist(); }
      else if (state.busted) { screen = 'busted'; }
      else if (state.win && !winShown) { screen = 'win'; persist(); }
      else if (state.storyDone && !state.mission && !winShown) { screen = 'win'; }
    }
  }
  renderer.draw(state, screen);
  const hg = hudCanvas.getContext('2d');
  hg.clearRect(0, 0, VIEW.width, VIEW.height);
  drawHUD(hg, state, screen, state.best || 0);
  status.textContent = `Cash $${state.cash}. Score ${state.score}. ${state.mission ? 'Mission in progress.' : 'No active mission.'} Wanted ${state.wanted.stars} stars.`;
  input.endFrame();
  requestAnimationFrame(frame);
}

if (shot) {
  runShot(shot, seed, canvas, hudCanvas, status);
} else {
  window.__solmar = state;
  requestAnimationFrame(frame);
}
