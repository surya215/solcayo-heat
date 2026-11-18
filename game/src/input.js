// Keyboard and mouse, read fresh every frame. The game uses WASD/arrows to
// move and drive, E to interact or enter a car, mouse to aim and click to
// shoot, Esc/P to pause, M to mute, Enter to confirm menus.
export function createInput(canvas) {
  const keys = new Set();
  const input = {
    keys,
    mouseX: 0,
    mouseY: 0,
    mouseDown: false,
    clicked: false,
    actions: 0,
  };
  const ACTION_CONFIRM = 1;
  const ACTION_PAUSE = 2;
  const ACTION_INTERACT = 4;
  const ACTION_MUTE = 8;
  const ACTION_NEXT_MISSION = 16;

  function key(e) {
    return e.key.length === 1 ? e.key.toLowerCase() : e.key;
  }

  window.addEventListener('keydown', (e) => {
    const k = key(e);
    if ([' ', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) e.preventDefault();
    if (!e.repeat) {
      if (k === 'enter' || k === ' ') input.actions |= ACTION_CONFIRM;
      if (k === 'escape' || k === 'p') input.actions |= ACTION_PAUSE;
      if (k === 'e') input.actions |= ACTION_INTERACT;
      if (k === 'm') input.actions |= ACTION_MUTE;
      if (k === 'n') input.actions |= ACTION_NEXT_MISSION;
    }
    keys.add(k);
  });
  window.addEventListener('keyup', (e) => keys.delete(key(e)));
  window.addEventListener('blur', () => keys.clear());
  canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    input.mouseX = (e.clientX - rect.left) * (canvas.width / rect.width);
    input.mouseY = (e.clientY - rect.top) * (canvas.height / rect.height);
  });
  canvas.addEventListener('mousedown', (e) => {
    if (e.button === 0) {
      input.mouseDown = true;
      input.clicked = true;
    }
  });
  window.addEventListener('mouseup', (e) => {
    if (e.button === 0) input.mouseDown = false;
  });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());

  input.takeActions = function takeActions() {
    const a = input.actions;
    input.actions = 0;
    const c = input.clicked;
    input.clicked = false;
    return { actions: a, clicked: c };
  };
  input.direction = function direction() {
    let x = 0;
    let y = 0;
    if (keys.has('a') || keys.has('arrowleft')) x -= 1;
    if (keys.has('d') || keys.has('arrowright')) x += 1;
    if (keys.has('w') || keys.has('arrowup')) y -= 1;
    if (keys.has('s') || keys.has('arrowdown')) y += 1;
    return { x, y };
  };
  input.running = function running() {
    return keys.has('shift');
  };
  input.ACTION_CONFIRM = ACTION_CONFIRM;
  input.ACTION_PAUSE = ACTION_PAUSE;
  input.ACTION_INTERACT = ACTION_INTERACT;
  input.ACTION_MUTE = ACTION_MUTE;
  input.ACTION_NEXT_MISSION = ACTION_NEXT_MISSION;
  return input;
}
