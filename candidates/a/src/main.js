// Boot and the one loop: input is read every frame, the world advances in fixed 1/60 s steps
// (several in a slow frame, none in a fast one), and the renderer paints what is there. The game
// moves between six screens: title, play, paused, game over, busted and win.
// ?seed=N fixes the city. ?shot=start|play|drive|mission (with &seed=N) stages that scene
// instead of running the loop, paints it twice and sets window.__shotReady for a screenshot.

import { STEP, WANTED } from './config.js';
import { createRandom } from './random.js';
import { createWorld, stepWorld, resetWorld } from './world.js';
import { createInput } from './input.js';
import { createRenderer, SCREEN_TITLE, SCREEN_PLAY, SCREEN_PAUSED, SCREEN_OVER, SCREEN_BUSTED, SCREEN_WIN } from './render.js';
import { createHud } from './hud.js';
import { createAudio } from './audio.js';
import { stageShot } from './shots.js';
import { startMission } from './missions.js';
import { loadSave, writeSave, readBest, writeBest } from './save.js';
import { addHeat } from './combat.js';

const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const state = createWorld(seed);
// Exposed for debugging and playtests (read-only from the console).
window.__solmar = state;
const renderer = createRenderer(canvas);
const hud = createHud(canvas);
const audio = createAudio();
const saved = loadSave();
if (saved) {
  state.cash = saved.cash;
  state.missionIndex = saved.missionIndex;
  state.storyDone = saved.storyDone;
}
let best = Math.max(readBest(), saved ? saved.best : 0);
let screen = SCREEN_TITLE;
let winShown = false;

function persist() {
  writeSave({ cash: state.cash, missionIndex: state.missionIndex, storyDone: state.storyDone, best });
  if (state.score > best) { best = state.score; writeBest(best); }
}

/** Drain the event queue into sounds and one-off effects. */
function drainEvents() {
  for (const e of state.events) {
    if (e === 'shot') audio.shot();
    else if (e === 'punch') audio.punch();
    else if (e === 'pickup') audio.pickup();
    else if (e === 'coin') audio.coin();
    else if (e === 'jingle') { audio.jingle(); persist(); }
    else if (e === 'fail') audio.fail();
    else if (e === 'bust') audio.bust();
    else if (e === 'crash') audio.crash();
    else if (e === 'hurt') audio.punch();
    else if (e === 'heat:hitPed') addHeat(state, WANTED.hitPed);
    // 'cash:NNN' and 'steal' / 'enterCar' / 'exitCar' need no sound of their own.
  }
  state.events.length = 0;
}

function runShot(name) {
  const scene = stageShot(name, state, seed);
  let painted = 0;
  function paint() {
    renderer.draw(state, scene.screen);
    hud.draw(state, scene.screen, scene.best);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let accumulator = 0;
  let last = performance.now();

  function frame(now) {
    requestAnimationFrame(frame);
    const elapsed = Math.min(MAX_FRAME, (now - last) / 1000);
    last = now;
    audio.unlock();
    if (input.wasPressed('mute')) audio.toggleMute();

    if (screen === SCREEN_TITLE) {
      if (input.wasPressed('confirm')) {
        screen = SCREEN_PLAY;
        if (!state.mission && state.missionIndex < 5) startMission(state, state.missionIndex);
        audio.jingle();
      }
    } else if (screen === SCREEN_PAUSED) {
      if (input.wasPressed('pause') || input.wasPressed('confirm')) screen = SCREEN_PLAY;
    } else if (screen === SCREEN_OVER) {
      if (input.wasPressed('confirm')) {
        persist();
        resetWorld(state, Math.floor(Math.random() * 4294967296));
        if (saved) { state.cash = 0; state.missionIndex = 0; state.storyDone = false; }
        winShown = false;
        screen = SCREEN_TITLE;
      }
    } else if (screen === SCREEN_BUSTED) {
      if (input.wasPressed('confirm')) {
        const fine = Math.min(200, state.cash);
        state.cash -= fine;
        state.wanted.heat = 0;
        state.cops = [];
        state.busted = false;
        state.player.health = 100;
        state.player.x = 600; state.player.y = 600;
        state.player.inCar = null;
        persist();
        screen = SCREEN_PLAY;
      }
    } else if (screen === SCREEN_WIN) {
      if (input.wasPressed('confirm')) { winShown = true; screen = SCREEN_PLAY; }
    } else if (screen === SCREEN_PLAY) {
      if (input.wasPressed('pause')) { screen = SCREEN_PAUSED; }
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
        audio.engine(car ? Math.abs(car.speed) / 560 : 0, !!car);
        audio.siren(state.wanted.stars > 0, elapsed);
        if (state.gameOver) { screen = SCREEN_OVER; persist(); }
        else if (state.busted) { screen = SCREEN_BUSTED; }
        else if (state.win && !winShown) { screen = SCREEN_WIN; persist(); }
      }
    }

    renderer.draw(state, screen);
    hud.draw(state, screen, best);
    status.textContent = `Cash $${state.cash}. Score ${state.score}. ${state.mission ? 'Mission in progress.' : 'No active mission.'} Wanted ${state.wanted.stars} stars.`;
    input.endFrame();
  }
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
