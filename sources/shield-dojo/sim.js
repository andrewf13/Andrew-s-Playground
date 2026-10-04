// Deterministic 120 Hz simulation (SPEC §3–6, §11.2). Knows nothing about rendering:
// the same seed and the same per-tick inputs always give the same run.
(function (root) {
'use strict';
const D = root.DOJO = root.DOJO || {};

D.TICK = 1 / 120;
D.LANE_Y = [1.62, 1.15, 0.55];     // jōdan, chūdan, gedan (world metres)
D.LANE_NAMES = ['HIGH', 'MIDDLE', 'LOW'];
D.CONTACT_X = 0.78;               // shield distance from the karateka's centre line
D.SPAWN_X = 6.6;                  // just beyond the 4:3 frame edge
D.BALL_R = 0.16;
D.GRAVITY = 9.8;
const STANCE_DELAY = 0.040, TURN_DELAY = 0.033, KIAI_WINDOW = 0.070, KIAI_COOLDOWN = 0.30;
const HITSTOP = 0.060, BOW = 1.5, IRON_LOCK = 0.040, MAX_LIVES = 5;
const POINTS = { leather: 100, iron: 150, lantern: 50, fire: 200, golden: 500 };

// Analytic ball position at time t (world units). Shared by the sim, renderer and tests.
D.ballPos = function (b, t) {
  const u = Math.min(1, Math.max(0, (t - b.enterT) / b.travel));
  const x = b.side * (D.SPAWN_X + (D.CONTACT_X - D.SPAWN_X) * u);
  const laneY = D.LANE_Y[b.lane], R = D.BALL_R, g = D.GRAVITY;
  let y = laneY;
  if (b.path === 'bouncer') {
    const tb = b.enterT + b.travel * b.bounceU, after = b.contactT - tb;
    const vy0 = (laneY - R + 0.5 * g * after * after) / after;
    const s = Math.min(t, b.contactT) - tb;
    if (s >= 0) y = R + vy0 * s - 0.5 * g * s * s;
    else { const period = 2 * vy0 / g, d = (-s) % period; y = R + vy0 * d - 0.5 * g * d * d; }
  } else if (b.path === 'lob') {
    y = 0.9 + (laneY - 0.9) * u + 4 * 1.4 * u * (1 - u);
  } else if (b.path === 'dipper') {
    const k = Math.min(1, Math.max(0, (t - b.switchT) / 0.18)), e = k * k * (3 - 2 * k);
    y = D.LANE_Y[b.fromLane] + (laneY - D.LANE_Y[b.fromLane]) * e;
  }
  return { x, y: Math.max(R, y), u };
};

D.createSim = function (opts) {
  opts = opts || {};
  const seed = opts.seed >>> 0;
  const spawner = D.createSpawner(seed, opts);
  const s = {
    seed, t: 0, tick: 0, mode: 'playing', balls: [], recent: [], events: [],
    lives: MAX_LIVES, score: 0, streak: 0, bestStreak: 0, blocks: opts.startBlocks || 0, perfects: 0, kiais: 0,
    belt: 0, promoPending: false, bowUntil: 0, freeze: 0, nextSpawnT: 1.0, candidate: null,
    stanceTarget: 1, stance: 1, stanceAt: -1, facingTarget: 1, facing: 1, facingAt: -1, lockUntil: -1,
    fireAt: -9, fireMatched: true, cooldownUntil: -1, misses: {}, hits: 0, assist: !!opts.assist
  };
  s.belt = D.beltFor(s.blocks);

  function emit(type, data) { s.events.push(Object.assign({ type, t: s.t }, data)); }
  function multiplier() { return Math.min(5, 1 + Math.floor(s.streak / 10)); }
  function award(base) {
    s.streak++; s.bestStreak = Math.max(s.bestStreak, s.streak);
    const pts = base * multiplier();
    s.score += pts;
    return pts;
  }
  function countBlock() {
    s.blocks++;
    const nb = D.beltFor(s.blocks);
    if (nb > s.belt && !s.promoPending) s.promoPending = true;
  }

  function applyInput(inp) {
    // Held stance: up → jōdan, down → gedan, released → chūdan. Iron blocks lock it briefly.
    const target = inp.y > 0 ? 0 : inp.y < 0 ? 2 : 1;
    if (s.t >= s.lockUntil && target !== s.stanceTarget) { s.stanceTarget = target; s.stanceAt = s.t; }
    if (inp.x && inp.x !== s.facingTarget) { s.facingTarget = inp.x; s.facingAt = s.t; }
    if (s.stance !== s.stanceTarget && s.t - s.stanceAt >= STANCE_DELAY - 1e-9) s.stance = s.stanceTarget;
    if (s.facing !== s.facingTarget && s.t - s.facingAt >= TURN_DELAY - 1e-9) s.facing = s.facingTarget;
    if (inp.fire && s.mode === 'playing' && s.t >= s.cooldownUntil) {
      s.kiais++;
      s.fireAt = s.t; s.fireMatched = false;
      emit('kiai', {});
      // A press just after a block upgrades it to a Perfect.
      for (const b of s.recent) {
        if (b.resolved === 'block' && s.t - b.contactT <= KIAI_WINDOW + 1e-9) { perfect(b); break; }
      }
    }
    if (!s.fireMatched && s.t - s.fireAt > KIAI_WINDOW + 1e-9) {
      s.fireMatched = true; s.cooldownUntil = s.fireAt + KIAI_COOLDOWN; emit('whiff', {});
    }
  }

  function perfect(b) {
    // A Kiai doubles the block's points: add the base value once more at the current multiplier.
    s.fireMatched = true; s.perfects++;
    const extra = POINTS[b.type] * multiplier();
    s.score += extra; b.points += extra;
    b.resolved = 'perfect';
    s.freeze = Math.max(s.freeze, Math.round(HITSTOP / D.TICK));
    emit('perfect', { ball: b, points: b.points });
    // The hard return can knock out the next incoming ball on that side.
    const next = s.balls.filter(o => !o.resolved && o.side === b.side && o.enterT < s.t && o.contactT < s.t + 0.45)
      .sort((p, q) => p.contactT - q.contactT)[0];
    if (next) {
      next.resolved = 'ko'; next.resolvedT = s.t;
      next.points = award(250); countBlock();
      s.recent.push(next);
      emit('knockout', { ball: next, points: next.points });
    }
  }

  function resolve(b) {
    b.resolvedT = b.contactT;
    s.recent.push(b);
    const blocked = s.facing === b.side && s.stance === b.lane;
    if (blocked) {
      b.resolved = 'block';
      b.points = award(POINTS[b.type]);
      countBlock();
      if (b.type === 'golden') { s.lives = Math.min(MAX_LIVES, s.lives + 1); emit('life', { ball: b }); }
      if (b.type === 'iron') s.lockUntil = s.t + IRON_LOCK;
      emit('block', { ball: b, points: b.points });
      if (!s.fireMatched && s.fireAt >= b.contactT - KIAI_WINDOW - 1e-9) perfect(b);
      return;
    }
    b.resolved = 'hit';
    if (b.type === 'golden') { emit('golden-lost', { ball: b }); return; }
    s.streak = 0;
    if (b.type === 'lantern') { emit('lantern', { ball: b }); return; }
    s.lives--; s.hits++;
    const key = (b.side < 0 ? 'left' : 'right') + ':' + b.lane;
    s.misses[key] = (s.misses[key] || 0) + 1;
    emit('hit', { ball: b, heavy: b.type === 'iron' });
    if (s.lives <= 0) { s.mode = 'over'; emit('over', {}); }
  }

  function step(inp) {
    s.events = [];
    if (s.mode === 'over') return s;
    s.tick++;
    applyInput(inp || { x: 0, y: 0, fire: false });
    if (s.freeze > 0) { s.freeze--; return s; }
    s.t += D.TICK;

    if (s.mode === 'bow') {
      if (s.t >= s.bowUntil) { s.mode = 'playing'; s.nextSpawnT = s.t + 0.5; }
      return s;
    }
    // Spawning, gated by the fairness contract: hold the candidate until it fits.
    if (!s.promoPending && s.t >= s.nextSpawnT) {
      if (!s.candidate) s.candidate = spawner.make(s.blocks, s.belt);
      const scheduled = s.balls.filter(b => !b.resolved).concat(s.recent.filter(b => b.contactT > s.t - 0.5))
        .map(b => ({ side: b.side, lane: b.lane, t: b.contactT }));
      if (spawner.fits(s.candidate, s.t, scheduled)) {
        for (const b of spawner.emit(s.candidate, s.t)) { s.balls.push(b); emit('spawn', { ball: b }); }
        s.candidate = null;
        const iv = D.spawnInterval(s.blocks, s.belt);
        s.nextSpawnT = s.t + iv * (0.85 + 0.3 * ((s.tick * 2654435761 >>> 0) % 1000) / 1000);
      }
    }
    for (const b of s.balls) {
      if (b.path === 'dipper' && !b.flashed && s.t >= b.flashT) { b.flashed = true; emit('dip', { ball: b }); }
    }
    const due = s.balls.filter(b => !b.resolved && b.contactT <= s.t).sort((p, q) => p.contactT - q.contactT);
    for (const b of due) { if (s.mode !== 'over') resolve(b); }
    s.balls = s.balls.filter(b => !b.resolved);
    s.recent = s.recent.filter(b => s.t - b.contactT < 2.5);

    if (s.mode === 'playing' && s.promoPending && s.balls.length === 0 && s.freeze === 0) {
      s.belt = D.beltFor(s.blocks); s.promoPending = false;
      s.mode = 'bow'; s.bowUntil = s.t + BOW;
      emit('belt', { belt: s.belt });
    }
    return s;
  }

  s.step = step;
  s.multiplier = multiplier;
  return s;
};

// One line of dojo advice from the most common miss (SPEC §6).
D.advice = function (s) {
  let worst = null, n = 0;
  for (const k in s.misses) if (s.misses[k] > n) { n = s.misses[k]; worst = k; }
  if (!worst || n < 2) return s.perfects > s.blocks * 0.25 ? 'Your kiai is sharp. Keep the rhythm.' : 'Try a kiai just as the ball meets the shield.';
  const [side, lane] = worst.split(':');
  const where = ['high', 'middle', 'low'][+lane];
  return 'You drop your guard on ' + where + ' balls from the ' + side + '.';
};

// A perfect-information bot for tests and attract mode: always guards the next contact.
D.botInput = function (s, kiai) {
  const next = s.balls.filter(b => !b.resolved).sort((p, q) => p.contactT - q.contactT)[0];
  if (!next) return { x: 0, y: 0, fire: false };
  const fire = !!kiai && next.contactT > s.t && next.contactT <= s.t + D.TICK + 1e-9;
  return { x: next.side, y: next.lane === 0 ? 1 : next.lane === 2 ? -1 : 0, fire };
};

if (typeof module !== 'undefined') module.exports = D;
})(typeof window !== 'undefined' ? window : globalThis);
