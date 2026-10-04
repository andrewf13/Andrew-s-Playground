// App shell: renderer bootstrap, fixed-timestep loop, HUD and overlays.
(async function () {
'use strict';
const D = window.DOJO, T = window.THREE, $ = id => document.getElementById(id);
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const params = new URLSearchParams(location.search);
const BEST_KEY = 'shield-dojo-remastered-best';
let best = 0;
try { best = Number(localStorage.getItem(BEST_KEY)) || 0; } catch (e) {}

function unsupported(detail) {
  $('overline').textContent = 'THE DOJO IS CLOSED ON THIS BROWSER.';
  $('heading').innerHTML = 'NO 3D<br>GRAPHICS';
  $('message').innerHTML = 'Shield Dojo: Remastered needs WebGPU or WebGL2. ' +
    '<a href="shield-dojo.html" style="color:var(--gold)">Play Shield Dojo Classic</a> instead. It runs in any browser.' +
    (detail ? '<br><small style="color:var(--muted)">' + detail + '</small>' : '');
  $('start').hidden = true;
}

// three.js sets `swizzle: 'rgba'` (a no-op default) on every texture view. Some Chromium builds with
// experimental WebGPU features expect an older dictionary form and throw, so drop the default.
if (window.GPUTexture && GPUTexture.prototype.createView) {
  const createView = GPUTexture.prototype.createView;
  GPUTexture.prototype.createView = function (desc) {
    if (desc && desc.swizzle === 'rgba') { desc = Object.assign({}, desc); delete desc.swizzle; }
    return createView.call(this, desc);
  };
}

const canvas = $('game');
let renderer;
try {
  renderer = new T.WebGPURenderer({ canvas, antialias: true, forceWebGL: params.has('webgl') });
  await renderer.init();
} catch (e) { unsupported(String(e && e.message || e)); return; }
const backend = renderer.backend && renderer.backend.isWebGPUBackend ? 'WEBGPU' : 'WEBGL2';
$('tag').textContent = backend + ' · TSL';

const mats = D.createMaterials();
const view = D.createScene(mats);
function resize() {
  const r = canvas.getBoundingClientRect();
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  renderer.setSize(Math.max(1, r.width), Math.max(1, r.height), false);
}
new ResizeObserver(resize).observe(canvas); resize();

let sim = null, mode = 'ready', acc = 0, last = 0;
const input = D.createInput($('arena'), (lane, h) => view.laneScreenY(lane, h), cmd => {
  if (cmd === 'pause') togglePause();
  if (cmd === 'start' && mode !== 'playing') start();
});
$('start').onclick = () => mode === 'paused' ? togglePause() : start();
$('pause').onclick = togglePause;
addEventListener('blur', () => { if (mode === 'playing') togglePause(); });
document.addEventListener('visibilitychange', () => { if (document.hidden && mode === 'playing') togglePause(); });

function start() {
  const seed = params.has('seed') ? Number(params.get('seed')) : (Date.now() ^ (Math.random() * 1e9)) >>> 0;
  sim = D.createSim({ seed, startBlocks: Number(params.get('blocks')) || 0 });
  view.reset(); acc = 0; mode = 'playing';
  $('overlay').hidden = true; $('banner').hidden = true;
  $('floaters').textContent = '';
  hud();
}
function togglePause() {
  if (mode === 'playing') {
    mode = 'paused';
    $('overline').textContent = 'TAKE A BREATH.'; $('heading').innerHTML = 'STILL YOUR<br>MIND.';
    $('message').textContent = 'The dojo waits for you.'; $('results').hidden = true;
    $('start').textContent = 'RESUME'; $('overlay').hidden = false;
  } else if (mode === 'paused') { mode = 'playing'; $('overlay').hidden = true; last = performance.now(); }
}
function gameOver() {
  mode = 'over';
  const isBest = sim.score > best;
  best = Math.max(best, sim.score);
  try { localStorage.setItem(BEST_KEY, best); } catch (e) {}
  const acc_ = sim.kiais ? Math.round(sim.perfects / sim.kiais * 100) : 0;
  $('overline').textContent = isBest ? 'NEW DOJO RECORD.' : 'EVERY MISS IS A LESSON.';
  $('heading').innerHTML = D.BELTS[sim.belt][0] + '<br>BELT';
  $('message').textContent = D.advice(sim);
  const cells = [['SCORE', sim.score], ['BEST', best], ['BLOCKS', sim.blocks], ['PERFECTS', sim.perfects], ['KIAI HIT', acc_ + '%'], ['STREAK', sim.bestStreak]];
  $('results').innerHTML = cells.map(c => '<div><b>' + c[1] + '</b><span>' + c[0] + '</span></div>').join('') +
    '<div style="grid-column:1/-1"><span>SEED ' + sim.seed + '</span></div>';
  $('results').hidden = false; $('start').textContent = 'AGAIN'; $('overlay').hidden = false;
  $('status').textContent = 'Run over. Score ' + sim.score + '. ' + D.BELTS[sim.belt][0] + ' belt.';
  hud();
}

let lastHud = '';
function hud() {
  const s = sim || { score: 0, streak: 0, belt: 0, lives: 5, multiplier: () => 1 };
  const key = [s.score, s.streak, s.belt, s.lives, best].join();
  if (key === lastHud) return; lastHud = key;
  $('score').textContent = String(s.score).padStart(6, '0');
  $('streak').textContent = s.streak; $('mult').textContent = '×' + s.multiplier();
  $('belt').textContent = D.BELTS[s.belt][0]; $('beltchip').style.background = D.BELTS[s.belt][1];
  $('lives').innerHTML = '✦'.repeat(s.lives) + '<i>' + '✦'.repeat(5 - s.lives) + '</i>';
  $('best').textContent = String(Math.max(best, s.score)).padStart(6, '0');
}

const COLORS = { block: '#fff0ce', perfect: '#8bf5ef', knockout: '#ffd36b', hit: '#ff7a84', lantern: '#ffcf6a', life: '#ffd24a', 'golden-lost': '#a5a6b6' };
function floater(text, x, y, color) {
  const r = canvas.getBoundingClientRect(), [px, py] = view.toScreen(x, y, r.width, r.height), el = document.createElement('div');
  el.className = 'floater'; el.textContent = text; el.style.left = px + 'px'; el.style.top = py + 'px'; el.style.color = color;
  $('floaters').appendChild(el); setTimeout(() => el.remove(), 950);
}
function banner(text, ms) {
  $('banner').textContent = text; $('banner').hidden = false;
  clearTimeout(banner.t); banner.t = setTimeout(() => { $('banner').hidden = true; }, ms);
}
function handle(e) {
  view.onEvent(e);
  const b = e.ball, x = b ? b.side * (D.CONTACT_X + 0.5) : 0, y = b ? D.LANE_Y[b.lane] + 0.35 : 2;
  if (e.type === 'block') floater('+' + e.points, x, y, COLORS.block);
  if (e.type === 'perfect') floater('PERFECT +' + e.points, x, y + 0.25, COLORS.perfect);
  if (e.type === 'knockout') floater('KNOCKOUT +' + e.points, b.side * 2.4, y + 0.4, COLORS.knockout);
  if (e.type === 'hit') floater('HIT', b.side * 0.4, y, COLORS.hit);
  if (e.type === 'lantern') floater('STREAK LOST', x, y, COLORS.lantern);
  if (e.type === 'life') floater('+1 LIFE', 0, 2.3, COLORS.life);
  if (e.type === 'belt') { banner(D.BELTS[e.belt][0] + ' BELT', 1500); $('status').textContent = 'Promoted to ' + D.BELTS[e.belt][0] + ' belt.'; }
  if (e.type === 'over') gameOver();
}

function frame(ts) {
  const dt = Math.min((ts - last) / 1000 || 0, 0.1); last = ts;
  if (mode === 'playing') {
    acc += dt;
    let n = 0;
    while (acc >= D.TICK && n++ < 12 && mode === 'playing') {
      acc -= D.TICK;
      sim.step(input.sample());
      for (const e of sim.events) handle(e);
    }
    if (n >= 12) acc = 0;
    hud();
  } else input.sample();
  const rt = sim ? (sim.freeze > 0 ? sim.t : sim.t + Math.min(acc, D.TICK)) : ts / 1000;
  view.update(sim || idle, rt, mode === 'paused' ? 0 : dt, reduced);
  renderer.render(view.scene, view.camera);
}
const idle = { balls: [], belt: 0, stanceTarget: 1, facingTarget: 1 };
hud();
renderer.setAnimationLoop(frame);
if (params.has('autostart')) start();
window.__dojo = { get sim() { return sim; }, get mode() { return mode; }, backend };
})();
