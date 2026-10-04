// Seeded ball spawner: lane bag, belt-gated variety and the fairness contract (SPEC §4, §5).
// Pure JavaScript with no rendering imports, so it runs unchanged in Node for tests.
(function (root) {
'use strict';
const D = root.DOJO = root.DOJO || {};

D.mulberry32 = function (seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

// [name, colour, blocks needed]
D.BELTS = [
  ['WHITE', '#f4efe2', 0], ['YELLOW', '#f1cc4e', 8], ['ORANGE', '#f89548', 20],
  ['GREEN', '#64c59a', 36], ['BLUE', '#6baff6', 56], ['PURPLE', '#bf8fe1', 82],
  ['BROWN', '#b67a53', 114], ['BLACK', '#25242f', 150], ['CRIMSON', '#e95067', 200],
  ['LEGEND', '#ffd36b', 260]
];
D.beltFor = function (blocks) {
  let b = 0;
  while (b + 1 < D.BELTS.length && blocks >= D.BELTS[b + 1][2]) b++;
  return b;
};

D.ANNOUNCE = 0.35; // telegraph lead before a ball enters the screen
D.GAPS = { opposite: 0.26, lane: 0.20, both: 0.30, same: 0.12, twin: 0.22 };

D.travelTime = function (blocks, belt, assist) {
  const cap = assist ? 0.80 : belt >= 8 ? 0.52 : 0.55;
  return Math.max(cap, 2.20 * Math.pow(0.985, blocks));
};
D.spawnInterval = function (blocks, belt) {
  return Math.max(0.34, 1.40 * Math.pow(0.988, blocks)) * (belt >= 7 ? 0.9 : 1);
};

// Minimum time between two contact moments (SPEC §5.4 rules 1–3).
D.requiredGap = function (a, b) {
  if (a.side !== b.side) return a.lane !== b.lane ? D.GAPS.both : D.GAPS.opposite;
  return a.lane !== b.lane ? D.GAPS.lane : D.GAPS.same;
};

const PATHS = [['straight', 0, 3], ['bouncer', 1, 3], ['lob', 2, 2], ['dipper', 4, 2], ['skimmer', 5, 1.5]];
const TYPES = [['leather', 0, 6], ['iron', 3, 2], ['lantern', 3, 1], ['twin', 4, 1.2], ['fire', 6, 1.5]];

D.createSpawner = function (seed, opts) {
  opts = opts || {};
  const rng = D.mulberry32(seed);
  let bag = [], forced = null, nextId = 1, legendCount = 0, lastSide = 1;

  function pick(list, belt) {
    const open = list.filter(e => belt >= e[1]);
    let total = 0;
    for (const e of open) total += e[2];
    let r = rng() * total;
    for (const e of open) { r -= e[2]; if (r <= 0) return e[0]; }
    return open[open.length - 1][0];
  }
  function lane(belt) {
    if (forced !== null) { const l = forced; forced = null; return l; }
    if (!bag.length) {
      bag = [0, 1, 2];
      for (let i = 2; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [bag[i], bag[j]] = [bag[j], bag[i]]; }
    }
    const l = bag.shift();
    // Blue belt onward: deliberate high↔low split pairs force a fast cross through chūdan.
    if (belt >= 4 && l !== 1 && rng() < 0.25) forced = 2 - l;
    return l;
  }
  function side(belt) {
    // Legend "mirror waves": mostly alternate sides.
    if (belt >= 9 && (legendCount++ % 16) < 8) return (lastSide = -lastSide);
    return (lastSide = rng() < 0.5 ? -1 : 1);
  }

  // Build a candidate group (one ball, or two for a twin). Times are relative to the spawn moment.
  function make(blocks, belt) {
    const base = D.travelTime(blocks, belt, opts.assist);
    const s = side(belt);
    let path = pick(PATHS, belt);
    let type = rng() < 1 / 60 ? 'golden' : pick(TYPES, belt);
    let l = lane(belt), from = l, travel = base;
    if (type === 'golden') { path = rng() < 0.5 ? 'straight' : 'bouncer'; travel = base * 1.35; }
    if (type === 'twin' && path !== 'straight') path = 'bouncer';
    if (type === 'lantern' && (path === 'dipper' || path === 'skimmer')) path = 'lob';
    if (path === 'skimmer') { l = from = 2; travel = Math.max(0.45, base / 1.15); }
    if (path === 'dipper') {
      // Flash ≥0.30s before the move, finish the move ≥0.30s before contact (rule 5).
      travel = Math.max(travel, 0.85);
      from = l === 1 ? (rng() < 0.5 ? 0 : 2) : 1;
    }
    const balls = [{ side: s, lane: l, fromLane: from, path, type: type === 'twin' ? 'leather' : type, twin: type === 'twin', travel, offset: 0, bounceU: 0.40 + rng() * 0.15 }];
    if (type === 'twin') balls.push(Object.assign({}, balls[0], { offset: D.GAPS.twin, bounceU: 0.40 + rng() * 0.15 }));
    return balls;
  }

  // Does this group fit around every contact already scheduled? `scheduled` = [{side,lane,t}].
  function fits(group, now, scheduled) {
    for (const g of group) {
      const c = now + D.ANNOUNCE + g.travel + g.offset;
      for (const e of scheduled) {
        if (Math.abs(c - e.t) < D.requiredGap(g, e) - 1e-9) return false;
        if (e.side === g.side && e.t > c) return false; // no overtaking on the same side (rule 4)
      }
    }
    return true;
  }

  function emit(group, now) {
    return group.map(g => {
      const enterT = now + D.ANNOUNCE + g.offset;
      const b = {
        id: nextId++, side: g.side, lane: g.lane, fromLane: g.fromLane, path: g.path, type: g.type, twin: g.twin,
        announceT: now + g.offset, enterT, contactT: enterT + g.travel, travel: g.travel, bounceU: g.bounceU,
        resolved: null, resolvedT: 0
      };
      if (b.path === 'dipper') { b.switchT = b.contactT - 0.48; b.flashT = b.switchT - 0.30; }
      return b;
    });
  }

  return { make, fits, emit };
};

if (typeof module !== 'undefined') module.exports = D;
})(typeof window !== 'undefined' ? window : globalThis);
