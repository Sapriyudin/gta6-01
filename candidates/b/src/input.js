// Keyboard + mouse input for the 3D game. The mouse aims the pistol: on foot the player turns
// toward the crosshair (screen centre), and a click fires. Keys are held / pressed-this-frame;
// the main loop calls endFrame() after each step so a press is never seen twice.

const KEYMAP = {
  KeyW: 'up', ArrowUp: 'up', KeyS: 'down', ArrowDown: 'down',
  KeyA: 'left', ArrowLeft: 'left', KeyD: 'right', ArrowRight: 'right',
  ShiftLeft: 'run', ShiftRight: 'run', KeyF: 'punch',
  KeyE: 'enter', KeyP: 'pause', Escape: 'pause',
  Enter: 'confirm', Space: 'handbrake', KeyM: 'mute',
};

export function createInput(canvas) {
  const held = new Set();
  const pressed = new Set();
  const mouse = { x: 0, y: 0, down: false, clicked: false };

  function onKeyDown(e) {
    const action = KEYMAP[e.code];
    if (!action) return;
    if (e.code === 'Space' || e.code.startsWith('Arrow')) e.preventDefault();
    if (!held.has(action)) pressed.add(action);
    held.add(action);
  }
  function onKeyUp(e) {
    const action = KEYMAP[e.code];
    if (action) held.delete(action);
  }
  function onMouseMove(e) {
    const r = canvas.getBoundingClientRect();
    mouse.x = e.clientX - r.left; mouse.y = e.clientY - r.top;
  }
  function onMouseDown(e) {
    onMouseMove(e);
    mouse.down = true;
    mouse.clicked = true;
  }
  function onMouseUp() { mouse.down = false; }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  canvas.addEventListener('mousemove', onMouseMove);
  canvas.addEventListener('mousedown', onMouseDown);
  window.addEventListener('mouseup', onMouseUp);

  return {
    held, pressed, mouse,
    is(action) { return held.has(action); },
    wasPressed(action) { return pressed.has(action); },
    endFrame() { pressed.clear(); mouse.clicked = false; },
  };
}
