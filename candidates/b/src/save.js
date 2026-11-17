// Save / continue through localStorage: cash, how far the story has got, best score.

import { SAVE_KEY, BEST_KEY } from './config.js';

export function loadSave() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (typeof data !== 'object' || data === null) return null;
    return {
      cash: Math.max(0, Number(data.cash) || 0),
      missionIndex: Math.max(0, Math.min(5, Number(data.missionIndex) || 0)),
      storyDone: data.storyDone === true,
      best: Math.max(0, Number(data.best) || 0),
    };
  } catch {
    return null;
  }
}

export function writeSave(data) {
  try { window.localStorage.setItem(SAVE_KEY, JSON.stringify(data)); } catch { /* storage off */ }
}

export function readBest() {
  try { return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0; }
  catch { return 0; }
}

export function writeBest(value) {
  try { window.localStorage.setItem(BEST_KEY, String(value)); } catch { /* ignore */ }
}
