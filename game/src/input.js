// Keyboard and mouse state. One job: tell the game what the player is doing
// right now, in game terms (move direction, aim, actions) rather than raw keys.
export const input = {
  up: false,
  down: false,
  left: false,
  right: false,
  run: false,
  handbrake: false,
  mouseX: 0,
  mouseY: 0,
  mouseDown: false,
  clicked: false, // set for one frame when the mouse button goes down
  pressedKeys: new Set(), // keys pressed this frame (for one-shot actions)
};

const KEY_MAP = {
  KeyW: 'up', ArrowUp: 'up',
  KeyS: 'down', ArrowDown: 'down',
  KeyA: 'left', ArrowLeft: 'left',
  KeyD: 'right', ArrowRight: 'right',
  ShiftLeft: 'run', ShiftRight: 'run',
  Space: 'handbrake',
};

export function attachInput(canvas) {
  window.addEventListener('keydown', (event) => {
    const action = KEY_MAP[event.code];
    if (action) {
      input[action] = true;
      event.preventDefault();
    }
    input.pressedKeys.add(event.code);
  });
  window.addEventListener('keyup', (event) => {
    const action = KEY_MAP[event.code];
    if (action) input[action] = false;
  });
  canvas.addEventListener('mousemove', (event) => {
    const rect = canvas.getBoundingClientRect();
    input.mouseX = (event.clientX - rect.left) * (canvas.width / rect.width);
    input.mouseY = (event.clientY - rect.top) * (canvas.height / rect.height);
  });
  canvas.addEventListener('mousedown', (event) => {
    if (event.button === 0) {
      input.mouseDown = true;
      input.clicked = true;
    }
  });
  window.addEventListener('mouseup', (event) => {
    if (event.button === 0) input.mouseDown = false;
  });
  canvas.addEventListener('contextmenu', (event) => event.preventDefault());
}

// Call once per frame after the game has read the inputs.
export function endFrame() {
  input.clicked = false;
  input.pressedKeys.clear();
}

export function wasPressed(code) {
  return input.pressedKeys.has(code);
}

// Normalised movement vector from the held keys (0,0 when none held).
export function moveVector() {
  const x = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  const y = (input.down ? 1 : 0) - (input.up ? 1 : 0);
  if (x === 0 && y === 0) return { x: 0, y: 0 };
  const length = Math.hypot(x, y);
  return { x: x / length, y: y / length };
}

// The mouse position as WebGL clip coordinates (-1..1, y up) on a canvas of
// the given size. The 3D renderer unprojects this into a ground point so
// aiming on foot points at the cursor.
export function mouseNdc(canvasWidth, canvasHeight) {
  return {
    x: (input.mouseX / canvasWidth) * 2 - 1,
    y: -(input.mouseY / canvasHeight) * 2 + 1,
  };
}
