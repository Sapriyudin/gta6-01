// Keyboard + mouse input, polled once per frame. Keys are mapped to actions so the rest of
// the game never touches key codes.
const KEYMAP = {
  KeyW: 'up', ArrowUp: 'up', KeyS: 'down', ArrowDown: 'down',
  KeyA: 'left', ArrowLeft: 'left', KeyD: 'right', ArrowRight: 'right',
  ShiftLeft: 'run', ShiftRight: 'run', Space: 'brake',
  KeyE: 'enter', KeyF: 'punch', KeyP: 'pause', KeyM: 'mute',
  Enter: 'confirm', Escape: 'pause',
};
export function createInput(canvas) {
  const down = new Set();
  const pressed = new Set();
  const mouse = { x: 0, y: 0, down: false, clicked: false };
  function onKey(e, isDown) {
    const action = KEYMAP[e.code];
    if (!action) return;
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
    if (isDown) {
      if (!down.has(action)) pressed.add(action);
      down.add(action);
    } else down.delete(action);
  }
  window.addEventListener('keydown', (e) => onKey(e, true));
  window.addEventListener('keyup', (e) => onKey(e, false));
  canvas.addEventListener('mousemove', (e) => {
    const r = canvas.getBoundingClientRect();
    mouse.x = ((e.clientX - r.left) / r.width) * canvas.width;
    mouse.y = ((e.clientY - r.top) / r.height) * canvas.height;
  });
  canvas.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return;
    mouse.down = true; mouse.clicked = true;
    const r = canvas.getBoundingClientRect();
    mouse.x = ((e.clientX - r.left) / r.width) * canvas.width;
    mouse.y = ((e.clientY - r.top) / r.height) * canvas.height;
  });
  window.addEventListener('mouseup', () => { mouse.down = false; });
  return {
    mouse,
    is(action) { return down.has(action); },
    wasPressed(action) { return pressed.has(action); },
    // endFrame clears the per-frame key presses, but NOT mouse.clicked: a click is a
    // one-shot event that the world consumes when it fires (clearing it here would drop
    // clicks that land between the world's input check and this call).
    endFrame() { pressed.clear(); },
  };
}
