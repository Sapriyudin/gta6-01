// Keyboard + mouse input. Keys are tracked as held / pressed-this-frame; the main loop calls
// endFrame() after each step so a press is never seen twice. Mouse position is in canvas pixels
// (the renderer converts it to world space for aiming).

export const ACTION = {
  UP: 'up', DOWN: 'down', LEFT: 'left', RIGHT: 'right',
  RUN: 'run', PUNCH: 'punch', ENTER: 'enter', PAUSE: 'pause',
  CONFIRM: 'confirm', MUTE: 'mute', HANDBRAKE: 'handbrake',
};

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
    /** Aim direction from a world point toward the mouse, given the camera transform. */
    aimAngle(fromX, fromY, cam) {
      const wx = cam.x + (mouse.x / cam.scale - 640);
      const wy = cam.y + (mouse.y / cam.scale - 360);
      return Math.atan2(wy - fromY, wx - fromX);
    },
    endFrame() { pressed.clear(); mouse.clicked = false; },
  };
}
