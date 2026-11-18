// Keyboard and mouse, read fresh every frame. WASD or arrows move and
// drive, E interacts or enters a car, the mouse aims and a click shoots,
// Esc/P pauses, M mutes, Enter confirms menus, N starts the next mission.
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

  // One-shot action bits, set by keydown and consumed by takeActions().
  const CONFIRM = 1;
  const PAUSE = 2;
  const INTERACT = 4;
  const MUTE = 8;
  const NEXT_MISSION = 16;

  function normalize(e) {
    return e.key.length === 1 ? e.key.toLowerCase() : e.key;
  }

  window.addEventListener('keydown', (e) => {
    const k = normalize(e);
    if ([' ', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) e.preventDefault();
    if (!e.repeat) {
      if (k === 'enter' || k === ' ') input.actions |= CONFIRM;
      if (k === 'escape' || k === 'p') input.actions |= PAUSE;
      if (k === 'e') input.actions |= INTERACT;
      if (k === 'm') input.actions |= MUTE;
      if (k === 'n') input.actions |= NEXT_MISSION;
    }
    keys.add(k);
  });
  window.addEventListener('keyup', (e) => keys.delete(normalize(e)));
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

  // Take this frame's one-shot actions and click, then clear them.
  input.takeActions = function takeActions() {
    const a = input.actions;
    const c = input.clicked;
    input.actions = 0;
    input.clicked = false;
    return { actions: a, clicked: c };
  };

  // The movement keys as a unit-ish vector (not normalized by the caller).
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

  input.ACTION_CONFIRM = CONFIRM;
  input.ACTION_PAUSE = PAUSE;
  input.ACTION_INTERACT = INTERACT;
  input.ACTION_MUTE = MUTE;
  input.ACTION_NEXT_MISSION = NEXT_MISSION;
  return input;
}
