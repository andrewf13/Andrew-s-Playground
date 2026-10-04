// Run from the repository root: node sources/shield-dojo/test/sim.test.js
'use strict';
const assert = require('assert');
require('../spawner.js');
const D = require('../sim.js');

function run(opts, inputFn, maxTicks) {
  const s = D.createSim(opts), spawned = [], log = [];
  for (let i = 0; i < maxTicks && s.mode !== 'over'; i++) {
    s.step(inputFn(s));
    for (const e of s.events) {
      if (e.type === 'spawn') spawned.push(e.ball);
      log.push(e.type);
    }
  }
  return { s, spawned, log };
}

let failures = 0;
function test(name, fn) {
  try { fn(); console.log('ok   ' + name); }
  catch (e) { failures++; console.log('FAIL ' + name + '\n     ' + e.message); }
}

test('fairness contract holds over 10,000 Legend-level spawns (SPEC §5.4)', () => {
  let total = 0, seed = 1;
  while (total < 10000) {
    const { spawned } = run({ seed: seed++, startBlocks: 260 }, s => D.botInput(s, false), 120 * 600);
    const c = spawned.slice().sort((a, b) => a.contactT - b.contactT);
    for (let i = 1; i < c.length; i++) {
      const gap = c[i].contactT - c[i - 1].contactT, need = D.requiredGap(c[i], c[i - 1]);
      assert(gap >= need - 1e-6, `seed ${seed - 1}: gap ${gap.toFixed(3)}s < ${need}s between ${c[i - 1].id} and ${c[i].id}`);
    }
    for (const b of spawned) {
      if (b.path === 'dipper') {
        assert(b.flashT >= b.enterT - 1e-9, 'dipper flash before it is on screen');
        assert(b.contactT - (b.switchT + 0.18) >= 0.30 - 1e-9, 'dipper finishes its move too late');
      }
    }
    // Same side never overtakes.
    for (const side of [-1, 1]) {
      const own = spawned.filter(b => b.side === side);
      for (let i = 1; i < own.length; i++) assert(own[i].contactT >= own[i - 1].contactT, 'same-side overtaking');
    }
    total += spawned.length;
  }
});

test('a perfect-information bot is never hit at Legend speed', () => {
  for (let seed = 100; seed < 120; seed++) {
    const { s } = run({ seed, startBlocks: 260 }, s => D.botInput(s, false), 120 * 300);
    assert.strictEqual(s.hits, 0, `seed ${seed}: bot was hit ${s.hits} times`);
    assert.strictEqual(s.lives, 5);
  }
});

test('speed ramp matches the spec table', () => {
  assert.strictEqual(D.travelTime(0, 0).toFixed(2), '2.20');
  assert(Math.abs(D.travelTime(25, 1) - 1.51) < 0.01);
  assert(Math.abs(D.travelTime(50, 3) - 1.03) < 0.01);
  assert.strictEqual(D.travelTime(100, 4), 0.55);
  assert.strictEqual(D.travelTime(400, 9), 0.52);
  assert.strictEqual(D.travelTime(400, 9, true), 0.80);
});

test('belts unlock at the right block counts and trigger a bow', () => {
  const { s, log } = run({ seed: 7 }, s => D.botInput(s, false), 120 * 120);
  assert(s.belt >= 2, 'bot should pass yellow and orange within two minutes');
  assert(log.includes('belt'));
  assert.strictEqual(D.beltFor(7), 0);
  assert.strictEqual(D.beltFor(8), 1);
  assert.strictEqual(D.beltFor(260), 9);
});

test('Kiai on contact earns Perfect and doubles points', () => {
  const plain = run({ seed: 3 }, s => D.botInput(s, false), 120 * 60).s;
  const kiai = run({ seed: 3 }, s => D.botInput(s, true), 120 * 60).s;
  assert(kiai.perfects > 0, 'no perfects registered');
  assert(kiai.score > plain.score * 1.5, `kiai ${kiai.score} vs plain ${plain.score}`);
});

test('Kiai whiff triggers a cooldown, and a kiai after the window does not count', () => {
  const s = D.createSim({ seed: 9 });
  s.step({ x: 0, y: 0, fire: true });
  for (let i = 0; i < 12; i++) s.step({ x: 0, y: 0, fire: false });
  assert(s.cooldownUntil > s.t, 'cooldown should be active after a whiff');
  const before = s.kiais;
  s.step({ x: 0, y: 0, fire: true });
  assert.strictEqual(s.kiais, before, 'press during cooldown should be ignored');
});

test('an idle player loses five lives and the run ends', () => {
  const { s, log } = run({ seed: 11 }, () => ({ x: 0, y: 0, fire: false }), 120 * 600);
  assert.strictEqual(s.mode, 'over');
  assert.strictEqual(s.lives, 0);
  assert(log.includes('over'));
  assert(typeof D.advice(s) === 'string');
});

test('releasing the stick returns the guard to chūdan', () => {
  const s = D.createSim({ seed: 5 });
  for (let i = 0; i < 10; i++) s.step({ x: -1, y: 1, fire: false });
  assert.strictEqual(s.stance, 0); assert.strictEqual(s.facing, -1);
  for (let i = 0; i < 10; i++) s.step({ x: 0, y: 0, fire: false });
  assert.strictEqual(s.stance, 1, 'stance should drop back to middle');
  assert.strictEqual(s.facing, -1, 'facing persists until the player turns');
});

test('same seed and inputs give an identical run', () => {
  const noisy = s => { const b = D.botInput(s, true); return s.tick % 97 < 9 ? { x: -b.x || 1, y: 0, fire: false } : b; };
  const a = run({ seed: 42 }, noisy, 120 * 180).s, b = run({ seed: 42 }, noisy, 120 * 180).s;
  assert.deepStrictEqual([a.score, a.blocks, a.lives, a.perfects, a.tick], [b.score, b.blocks, b.lives, b.perfects, b.tick]);
});

if (failures) { console.log(`\n${failures} failing`); process.exit(1); }
console.log('\nall passing');
