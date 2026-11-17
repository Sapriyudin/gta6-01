// Save to localStorage: cash, mission progress, unlocks, best score, mute.
const KEY = 'solmar-night-save-v1';
export function loadSave() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const s = JSON.parse(raw);
    if (typeof s !== 'object' || !s) return null;
    return s;
  } catch {
    return null;
  }
}
export function persistSave(state) {
  try {
    localStorage.setItem(KEY, JSON.stringify({
      cash: state.cash,
      score: state.score,
      missionIndex: state.missionIndex,
      storyDone: state.storyDone,
      unlocks: [...state.unlocks],
      safehouse: state.safehouseActive,
      best: Math.max(state.score, state.best || 0),
      muted: state.muted,
    }));
  } catch {
    // Storage may be unavailable (private mode); the game plays on regardless.
  }
}
