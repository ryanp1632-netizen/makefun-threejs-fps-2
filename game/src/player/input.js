// Raw input: held keys, key presses since the last step, mouse buttons and accumulated mouse
// motion while the pointer is locked. Nothing here knows the game's rules.

// Where pointer lock is refused (some embedded frames), the game falls back to free mouse look:
// motion over the canvas steers the view and clicks still fire.
export function createInput(canvas, onLockChange) {
  const held = new Set();
  const pressed = new Set();
  // leftPressed latches a click until the next step, so a tap shorter than a frame still fires.
  const mouse = { dx: 0, dy: 0, left: false, leftPressed: false, right: false, rightPressed: false };
  let locked = false;
  let fallback = false;

  window.addEventListener('keydown', (e) => {
    if (e.code === 'Tab' || (e.code.startsWith('Digit') && locked) || e.code === 'Space') e.preventDefault();
    if (!held.has(e.code)) pressed.add(e.code);
    held.add(e.code);
  });
  window.addEventListener('keyup', (e) => held.delete(e.code));
  window.addEventListener('blur', () => { held.clear(); mouse.left = mouse.right = false; });
  document.addEventListener('mousemove', (e) => {
    if (!locked && !fallback) return;
    mouse.dx += e.movementX;
    mouse.dy += e.movementY;
  });
  canvas.addEventListener('mousedown', (e) => {
    if (!locked && !fallback) return;
    if (e.button === 0) { mouse.left = true; mouse.leftPressed = true; }
    if (e.button === 2) { mouse.right = true; mouse.rightPressed = true; }
  });
  window.addEventListener('mouseup', (e) => {
    if (e.button === 0) mouse.left = false;
    if (e.button === 2) mouse.right = false;
  });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  function useFallback() {
    fallback = true;
    onLockChange(true);
  }
  document.addEventListener('pointerlockerror', useFallback);
  document.addEventListener('pointerlockchange', () => {
    locked = document.pointerLockElement === canvas;
    if (!locked) { mouse.left = mouse.right = false; }
    onLockChange(locked);
  });

  return {
    held, pressed, mouse,
    get locked() { return locked || fallback; },
    requestLock() {
      try {
        const request = canvas.requestPointerLock?.();
        if (request?.catch) request.catch(useFallback);
      } catch {
        useFallback();
      }
    },
    releaseLock() {
      fallback = false;
      if (locked) document.exitPointerLock();
    },
    /** Takes this frame's mouse motion (and clears it). */
    takeLook(out) { out.dx = mouse.dx; out.dy = mouse.dy; mouse.dx = 0; mouse.dy = 0; return out; },
    endStep() { pressed.clear(); mouse.leftPressed = false; mouse.rightPressed = false; },
  };
}
