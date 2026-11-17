// The five-job story chain, told at night. Each mission opens with a short phone call
// (Marisol, the fixer, and Dario, the wheelman) shown as dialogue lines, and closes with one
// more line. Mission 2 is a timed delivery; mission 4 only counts once the cops are lost;
// finishing a mission unlocks a faster car parked by the garage, and finishing mission 4
// opens the safehouse (standing near it heals).
import { MISSION_SPOTS, CAR_MODELS } from './config.js';

// Dialogue lines: { who, line }. Shown one at a time in the HUD dialogue box.
const DIALOGUE = {
  0: {
    open: [
      { who: 'Marisol', line: 'Dario. You owe me, and the night is young. First wheels — take the green Vela on 10th.' },
      { who: 'Dario', line: 'A parked car and a debt. Fine. But after tonight, we are even.' },
    ],
    done: [{ who: 'Marisol', line: 'Clean. The garage is yours now — a Comet is parked there with your name on it.' }],
  },
  1: {
    open: [
      { who: 'Marisol', line: 'A package on the north road. The pier, south-west. Sixty seconds — the buyers do not wait.' },
      { who: 'Dario', line: 'Sixty seconds across town? You always did know how to ask nicely.' },
    ],
    done: [{ who: 'Marisol', line: 'On time. The pier crew sends their regards — and a Toro, parked by the garage.' }],
  },
  2: {
    open: [
      { who: 'Marisol', line: "Rico's crew took our corner. Four of them. Clear them out — then run, the law will come." },
      { who: 'Dario', line: 'Four against one? I like those odds. Tell Rico the corner is closed.' },
    ],
    done: [{ who: 'Marisol', line: 'The corner is ours again. A Falcon is waiting by the garage — fastest thing in Solmar.' }],
  },
  3: {
    open: [
      { who: 'Marisol', line: 'Three stars, Dario. The whole night shift is after you. Lose them, then get to the safehouse.' },
      { who: 'Dario', line: 'Three stars is a compliment. I will be at the safehouse before they finish their coffee.' },
    ],
    done: [{ who: 'Marisol', line: 'You vanished like smoke. The safehouse is open now — rest there, it is yours.' }],
  },
  4: {
    open: [
      { who: 'Marisol', line: 'The big one. Grab the getaway car, hit the bank, and reach the hideout. Four stars if you are sloppy.' },
      { who: 'Dario', line: 'One last job, then Solmar is ours. Start the car — I am already gone.' },
    ],
    done: [{ who: 'Marisol', line: 'The Solmar Heist. They will talk about tonight for years. We did it, Dario.' }],
  },
};

// The unlock a mission grants: a car model parked by the garage.
const UNLOCKS = { 0: 'Comet', 1: 'Toro', 2: 'Falcon', 3: null, 4: null };

function stepsFor(index) {
  switch (index) {
    case 0: return [
      { type: 'steal', x: MISSION_SPOTS.stealCar.x, y: MISSION_SPOTS.stealCar.y, r: 90, text: 'Steal the marked car (walk up and press E)' },
      { type: 'goto', x: MISSION_SPOTS.garage.x, y: MISSION_SPOTS.garage.y, r: 70, text: 'Drive the car to Marisol\u2019s garage' },
    ];
    case 1: return [
      { type: 'pickup', x: MISSION_SPOTS.package.x, y: MISSION_SPOTS.package.y, r: 60, text: 'Pick up the package on the north road' },
      { type: 'deliver', x: MISSION_SPOTS.pier.x, y: MISSION_SPOTS.pier.y, r: 70, text: 'Deliver the package to the pier — timed!', timer: 60 },
    ];
    case 2: return [
      { type: 'fight', x: MISSION_SPOTS.corner.x, y: MISSION_SPOTS.corner.y, r: 120, text: 'Clear Rico\u2019s crew off the corner', count: 4 },
      { type: 'escape', x: MISSION_SPOTS.escape.x, y: MISSION_SPOTS.escape.y, r: 80, text: 'Escape the heat — reach the east road' },
    ];
    case 3: return [
      { type: 'chase', x: MISSION_SPOTS.safehouse.x, y: MISSION_SPOTS.safehouse.y, r: 80, text: 'Lose the cops, then reach the safehouse', needStars: 0 },
    ];
    default: return [
      { type: 'steal', x: MISSION_SPOTS.getawayCar.x, y: MISSION_SPOTS.getawayCar.y, r: 90, text: 'Steal the getaway car by the south road' },
      { type: 'goto', x: MISSION_SPOTS.bank.x, y: MISSION_SPOTS.bank.y, r: 70, text: 'Grab the goods at the bank' },
      { type: 'escape', x: MISSION_SPOTS.hideout.x, y: MISSION_SPOTS.hideout.y, r: 80, text: 'Escape wanted 4 — reach the hideout' },
    ];
  }
}

const REWARDS = [300, 450, 600, 800, 1500];

export function missionTitle(index) {
  return ['1 — First Wheels', '2 — Hot Delivery', '3 — Payback', '4 — The Long Chase', '5 — The Solmar Heist'][index] || 'Free roam';
}

export function startMission(state, index) {
  const steps = stepsFor(index);
  const m = {
    index, steps, step: 0, timer: null, timerMax: null,
    dialogue: [...(DIALOGUE[index]?.open || [])],
    dialogueTimer: 0, dialogueDone: false,
    rivals: [], spawned: false,
  };
  const first = steps[0];
  if (first.timer) { m.timer = first.timer; m.timerMax = first.timer; }
  state.mission = m;
  state.events.push('missionStart');
  return m;
}

// Advance the dialogue queue: show one line at a time, ~3.6s each.
export function updateDialogue(state, dt) {
  const m = state.mission;
  if (!m || m.dialogueDone) return;
  m.dialogueTimer += dt;
  if (m.dialogueTimer >= 3.6) {
    m.dialogueTimer = 0;
    m.dialogue.shift();
    if (m.dialogue.length === 0) m.dialogueDone = true;
  }
}

export function currentDialogue(state) {
  const m = state.mission;
  if (!m || m.dialogueDone || m.dialogue.length === 0) return null;
  return m.dialogue[0];
}

function completeStep(state, m) {
  m.step += 1;
  state.events.push('stepDone');
  const next = m.steps[m.step];
  if (next) {
    if (next.timer) { m.timer = next.timer; m.timerMax = next.timer; }
    if (next.type === 'fight') spawnRivals(state, m, next);
  }
}

function spawnRivals(state, m, step) {
  m.rivals = [];
  for (let i = 0; i < step.count; i += 1) {
    const a = (i / step.count) * Math.PI * 2;
    m.rivals.push({
      x: step.x + Math.cos(a) * 55, y: step.y + Math.sin(a) * 55,
      health: 110, state: 'fight', shootCd: 1 + i * 0.4, angle: 0,
    });
  }
  m.spawned = true;
}

export function updateMission(state, dt) {
  const m = state.mission;
  if (!m) return;
  updateDialogue(state, dt);
  const p = state.player;
  const step = m.steps[m.step];
  if (!step) return;
  // Timed steps: run the clock out and the job fails (restart the same mission).
  if (m.timer !== null) {
    m.timer -= dt;
    if (m.timer <= 0) {
      state.mission = null;
      state.events.push('missionFail');
      return;
    }
  }
  if (step.type === 'fight' && !m.spawned) spawnRivals(state, m, step);
  const px = p.inCar ? p.inCar.x : p.x;
  const py = p.inCar ? p.inCar.y : p.y;
  const d = Math.hypot(px - step.x, py - step.y);
  if (step.type === 'steal') {
    if (p.inCar) completeStep(state, m);
  } else if (step.type === 'pickup') {
    if (d < step.r) completeStep(state, m);
  } else if (step.type === 'goto' || step.type === 'deliver') {
    if (d < step.r && (!step.needStars || state.wanted.stars <= step.needStars)) completeStep(state, m);
  } else if (step.type === 'fight') {
    const alive = m.rivals.filter((r) => r.health > 0).length;
    if (alive === 0) completeStep(state, m);
  } else if (step.type === 'escape' || step.type === 'chase') {
    // Escape steps only count once the wanted level has dropped low enough.
    const need = step.type === 'chase' ? (step.needStars ?? 0) : 2;
    if (d < step.r && state.wanted.stars <= need) completeStep(state, m);
  }
  if (m.step >= m.steps.length) {
    const reward = REWARDS[m.index] || 0;
    state.cash += reward;
    state.score += reward;
    const unlock = UNLOCKS[m.index];
    if (unlock && !state.unlocks.has(unlock)) {
      state.unlocks.add(unlock);
      const model = CAR_MODELS.find((c) => c.name === unlock);
      if (model) {
        // Park the unlocked car by the garage so the player can take it.
        state.cars.push({
          x: 600, y: 1330, angle: Math.PI / 2, speed: 0, health: model.hp,
          model: model.name, color: model.color, top: model.top, accel: model.accel,
          driver: 'parked', wrecked: false, crashCd: 0, ai: null,
        });
      }
      state.events.push('unlock');
    }
    if (m.index === 3) state.safehouseActive = true;
    state.mission = null;
    state.missionIndex = m.index + 1;
    if (state.missionIndex >= 5) state.storyDone = true;
    state.events.push('missionDone');
    state.banner = { text: `Job done — $${reward}  ·  ${missionTitle(m.index)}`, t: 3.5 };
    state.pendingDialogue = [...(DIALOGUE[m.index]?.done || [])];
    state.pendingDialogueTimer = 0;
  }
}

// Dialogue that plays after a mission ends (shown while free-roaming).
export function updatePendingDialogue(state, dt) {
  if (!state.pendingDialogue || state.pendingDialogue.length === 0) return;
  state.pendingDialogueTimer += dt;
  if (state.pendingDialogueTimer >= 3.6) {
    state.pendingDialogueTimer = 0;
    state.pendingDialogue.shift();
  }
}
export function currentPendingDialogue(state) {
  if (!state.pendingDialogue || state.pendingDialogue.length === 0) return null;
  return state.pendingDialogue[0];
}
