// Keyboard, gamepad and touch → one joystick state {x, y, fire} (SPEC §3.1).
(function (root) {
'use strict';
const D = root.DOJO;

D.createInput = function (surface, laneScreenY, onCommand) {
  const keys = new Set();
  let lastX = 0, lastY = 0, fireQueued = false, touch = null, padFirePrev = false, padStartPrev = false;
  const UP = ['w', 'arrowup'], DOWN = ['s', 'arrowdown'], LEFT = ['a', 'arrowleft'], RIGHT = ['d', 'arrowright'];

  addEventListener('keydown', e => {
    const k = e.key.toLowerCase();
    if ([...UP, ...DOWN, ...LEFT, ...RIGHT, ' ', 'tab'].includes(k)) e.preventDefault();
    if (e.repeat) return;
    keys.add(k);
    if (UP.includes(k)) lastY = 1;
    if (DOWN.includes(k)) lastY = -1;
    if (LEFT.includes(k)) lastX = -1;
    if (RIGHT.includes(k)) lastX = 1;
    if (k === ' ' || k === 'j') { fireQueued = true; onCommand('fire'); }
    if (k === 'p' || k === 'escape') onCommand('pause');
    if (k === 'enter') onCommand('start');
  });
  addEventListener('keyup', e => keys.delete(e.key.toLowerCase()));
  addEventListener('blur', () => keys.clear());

  // Touch: the primary finger *is* the shield — side from which half, height snapped to the nearest lane.
  // Any extra finger is a Kiai. Lifting the primary finger drops the guard back to chūdan.
  function fromPointer(e) {
    const r = surface.getBoundingClientRect(), px = e.clientX - r.left, py = e.clientY - r.top;
    let best = 1, dist = Infinity;
    for (let l = 0; l < 3; l++) { const d = Math.abs(laneScreenY(l, r.height) - py); if (d < dist) { dist = d; best = l; } }
    return { x: px < r.width / 2 ? -1 : 1, lane: best };
  }
  surface.addEventListener('pointerdown', e => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    e.preventDefault();
    onCommand('touch');
    if (touch && touch.id !== e.pointerId) { fireQueued = true; onCommand('fire'); return; }
    surface.setPointerCapture?.(e.pointerId);
    touch = Object.assign({ id: e.pointerId }, fromPointer(e));
  });
  surface.addEventListener('pointermove', e => { if (touch && touch.id === e.pointerId) Object.assign(touch, fromPointer(e)); });
  const end = e => { if (touch && touch.id === e.pointerId) touch = null; };
  surface.addEventListener('pointerup', end); surface.addEventListener('pointercancel', end);

  function pad() {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    for (const p of pads) {
      if (!p) continue;
      const ax = p.axes[0] || 0, ay = p.axes[1] || 0, b = i => !!(p.buttons[i] && p.buttons[i].pressed);
      const x = b(14) || ax < -0.5 ? -1 : b(15) || ax > 0.5 ? 1 : 0;
      const y = b(12) || ay < -0.5 ? 1 : b(13) || ay > 0.5 ? -1 : 0;
      const fire = b(0) || b(1), start = b(9);
      const fireEdge = fire && !padFirePrev, startEdge = start && !padStartPrev;
      padFirePrev = fire; padStartPrev = start;
      if (startEdge) onCommand('pause');
      if (fireEdge) onCommand('fire');
      return { x, y, fire: fireEdge };
    }
    return null;
  }

  // Sampled once per simulation tick. Opposite keys held together: the most recent wins.
  function sample() {
    const up = UP.some(k => keys.has(k)), down = DOWN.some(k => keys.has(k));
    const left = LEFT.some(k => keys.has(k)), right = RIGHT.some(k => keys.has(k));
    let y = up && down ? lastY : up ? 1 : down ? -1 : 0;
    let x = left && right ? lastX : left ? -1 : right ? 1 : 0;
    let fire = fireQueued; fireQueued = false;
    const p = pad();
    if (p) { if (p.x) x = p.x; if (p.y) y = p.y; fire = fire || p.fire; }
    if (touch) { x = touch.x; y = touch.lane === 0 ? 1 : touch.lane === 2 ? -1 : 0; }
    return { x, y, fire };
  }
  return { sample };
};
})(typeof window !== 'undefined' ? window : globalThis);
