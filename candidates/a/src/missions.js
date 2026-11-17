// The story: five missions for Dario Cole, a wheelman new to Solmar City, and his fixer Marisol
// Vega. Each mission is a chain of steps (go somewhere, steal a car, pick up and deliver, clear a
// corner, escape a pursuit, grab the goods). The module owns the mission state machine: starting
// a mission, advancing its steps, paying out, and failing one. It writes into the world state and
// posts events (banner / jingle / fail / heat) for the main loop to act on.

export const MISSIONS = [
  {
    id: 'first-wheels', name: '1 — First Wheels', reward: 300,
    brief: 'Marisol: "You need wheels, Dario. Take that Vela by the marina road and bring it to my garage."',
    steps: [
      { type: 'steal', x: 1000, y: 600, r: 90, text: 'Steal the marked car (walk up and press E)' },
      { type: 'goto', x: 600, y: 1400, r: 80, text: 'Drive the car to Marisol\'s garage', needCar: true },
    ],
  },
  {
    id: 'hot-delivery', name: '2 — Hot Delivery', reward: 500,
    brief: 'Marisol: "A package is waiting on the north road. Deliver it to the old pier — and keep your nose clean."',
    steps: [
      { type: 'goto', x: 2600, y: 200, r: 70, text: 'Pick up the package on the north road' },
      { type: 'goto', x: 200, y: 1400, r: 80, text: 'Deliver the package to the old pier' },
    ],
  },
  {
    id: 'payback', name: '3 — Payback', reward: 800,
    brief: 'Marisol: "Rico\'s crew took my corner on Marlin Street. Clear them out — fists or fire, your call."',
    steps: [
      { type: 'clear', x: 1800, y: 1000, r: 120, count: 4, text: 'Clear Rico\'s crew off the corner (0/4)' },
      { type: 'escape', x: 3000, y: 200, r: 90, text: 'Lose the heat — get to the north-east rooftop' },
    ],
  },
  {
    id: 'the-long-chase', name: '4 — The Long Chase', reward: 1200,
    brief: 'Marisol: "The whole Solmar force is on you. Lose them and get to the safehouse on Coral Row."',
    steps: [
      { type: 'escape', x: 200, y: 200, r: 90, wanted: 3, text: 'Escape the pursuit — reach the Coral Row safehouse' },
    ],
  },
  {
    id: 'the-solmar-heist', name: '5 — The Solmar Heist', reward: 2500,
    brief: 'Marisol: "The big one. Grab the getaway car, lift the goods from the bank, and vanish to the hideout."',
    steps: [
      { type: 'steal', x: 1400, y: 1800, r: 90, text: 'Steal the getaway car by the south road' },
      { type: 'goto', x: 2200, y: 600, r: 80, text: 'Reach the bank on Marina Row' },
      { type: 'grab', x: 2200, y: 600, r: 70, text: 'Grab the goods (stand on the marker)' },
      { type: 'escape', x: 3000, y: 1400, r: 90, wanted: 4, text: 'Escape to the hideout — lose the heat or get there hot' },
    ],
  },
];

export function missionObjective(state) {
  const m = state.mission;
  if (!m || m.index >= MISSIONS.length) return state.storyDone ? 'Free roam — Solmar City is yours' : 'Press Enter to start the next job';
  const def = MISSIONS[m.index];
  const step = def.steps[m.step];
  if (!step) return def.name;
  if (step.type === 'clear') return `Clear Rico's crew off the corner (${m.cleared}/${step.count})`;
  return step.text;
}

export function startMission(state, index) {
  const def = MISSIONS[index];
  if (!def) return;
  state.mission = { index, step: 0, timer: 0, cleared: 0, rivalsSpawned: false, grabbed: false };
  state.banner = { title: def.name, sub: def.brief, timer: 5 };
  state.events.push('jingle');
  // The chase missions open with the heat already on.
  const step = def.steps[0];
  if (step.type === 'escape' && step.wanted) state.wanted.heat = Math.max(state.wanted.heat, step.wanted * 20);
  if (def.id === 'payback') spawnRivals(state, 1800, 1000, 4);
}

export function spawnRivals(state, x, y, count) {
  state.rivals = [];
  for (let i = 0; i < count; i += 1) {
    const a = (i / count) * Math.PI * 2;
    state.rivals.push({
      x: x + Math.cos(a) * 60, y: y + Math.sin(a) * 60,
      angle: a, health: 110, state: 'fight', shootCd: 1 + i * 0.4, punchCd: 0,
    });
  }
  state.mission.rivalsSpawned = true;
}

/** Advance the active mission one step. Returns true when the mission chain just finished. */
export function updateMission(state, dt) {
  const m = state.mission;
  if (!m || m.index >= MISSIONS.length) return false;
  const def = MISSIONS[m.index];
  const step = def.steps[m.step];
  if (!step) return false;
  m.timer += dt;
  const p = state.player;
  const d = Math.hypot(p.x - step.x, p.y - step.y);

  if (step.type === 'goto' || step.type === 'grab') {
    if (d < step.r) {
      if (step.type === 'grab' && !m.grabbed) {
        m.grabbed = true;
        state.events.push('coin');
        state.banner = { title: 'Goods secured', sub: 'Now get out of here.', timer: 2.5 };
        advance(state);
        return false;
      }
      if (step.type === 'goto') { advance(state); return false; }
    }
  } else if (step.type === 'steal') {
    if (p.inCar) { advance(state); return false; }
  } else if (step.type === 'clear') {
    if (m.cleared >= step.count) { advance(state); return false; }
  } else if (step.type === 'escape') {
    const heatGone = state.wanted.stars === 0;
    if (d < step.r || heatGone) {
      // Reaching the marker hot still counts, but only after a short chase.
      if (d < step.r || m.timer > 8) { advance(state); return false; }
    }
  }
  return false;
}

function advance(state) {
  const m = state.mission;
  const def = MISSIONS[m.index];
  m.step += 1;
  m.timer = 0;
  m.grabbed = false;
  if (m.step >= def.steps.length) {
    state.cash += def.reward;
    state.score += def.reward;
    state.events.push('jingle');
    state.events.push(`cash:${def.reward}`);
    state.banner = { title: `${def.name} — done`, sub: `+$${def.reward}. Marisol is pleased.`, timer: 4 };
    state.missionIndex = m.index + 1;
    state.mission = null;
    if (state.missionIndex >= MISSIONS.length) {
      state.storyDone = true;
      state.win = true;
      state.banner = { title: 'THE SOLMAR HEIST — COMPLETE', sub: 'Dario Cole owns this city now. Free roam continues.', timer: 6 };
    }
  } else {
    const next = def.steps[m.step];
    state.banner = { title: def.name, sub: next.text, timer: 3 };
    state.events.push('coin');
    if (next.type === 'escape' && next.wanted) {
      state.wanted.heat = Math.max(state.wanted.heat, next.wanted * 20);
    }
  }
}

/** The current mission marker (or null when between missions). */
export function missionMarker(state) {
  const m = state.mission;
  if (!m || m.index >= MISSIONS.length) return null;
  const step = MISSIONS[m.index].steps[m.step];
  if (!step || step.type === 'steal' && state.player.inCar) return null;
  return { x: step.x, y: step.y, kind: step.type };
}
