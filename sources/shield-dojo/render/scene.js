// Greybox scene (SPEC §13 M1): capsule karateka, shield, balls, telegraphs and a minimal dojo frame.
// Reads simulation state; never changes it.
(function (root) {
'use strict';
const D = root.DOJO, T = root.THREE;
const SHIELD_X = 0.58, ARM_SHOULDER = new T.Vector3(0, 1.38, 0.05);

D.createScene = function (mats, opts) {
  const scene = new T.Scene();
  scene.backgroundNode = mats.copperSky;
  const camera = new T.PerspectiveCamera(30, 4 / 3, 0.1, 100);
  const camHome = new T.Vector3(0, 1.6, 14.5), lookAt = new T.Vector3(0, 1.25, 0);
  camera.position.copy(camHome); camera.lookAt(lookAt);

  scene.add(new T.HemisphereLight('#ffe9d0', '#3a2a3a', 1.6));
  const sun = new T.DirectionalLight('#fff3e0', 2.2); sun.position.set(-4, 7, 9); scene.add(sun);

  // Dojo frame: floor, pillars, lintel and a distant peak. Placeholder for the M4 backdrop.
  const floorMesh = new T.Mesh(new T.PlaneGeometry(40, 32), mats.floor);
  floorMesh.rotation.x = -Math.PI / 2; floorMesh.position.z = 5; scene.add(floorMesh);
  for (const sx of [-1, 1]) {
    const p = new T.Mesh(new T.BoxGeometry(0.42, 6, 0.42), mats.timber); p.position.set(sx * 4.75, 3, -1.2); scene.add(p);
  }
  const lintel = new T.Mesh(new T.BoxGeometry(11, 0.36, 0.5), mats.timber); lintel.position.set(0, 4.55, -1.2); scene.add(lintel);
  const peak = new T.Mesh(new T.ConeGeometry(9, 6, 4, 1), new T.MeshStandardNodeMaterial({ color: '#4a4862', roughness: 1 }));
  peak.position.set(3, 1.2, -30); peak.rotation.y = Math.PI / 4; scene.add(peak);
  const snow = new T.Mesh(new T.ConeGeometry(2.3, 1.55, 4, 1), new T.MeshStandardNodeMaterial({ color: '#eef0f6', roughness: 1 }));
  snow.position.set(3, 3.45, -29.9); snow.rotation.y = Math.PI / 4; scene.add(snow);

  // Karateka: capsules and spheres on a two-part rig (body + shield arm).
  const karateka = new T.Group(); scene.add(karateka);
  const body = new T.Group(); karateka.add(body);
  const gi = mats.body('#f2efe6'), skin = mats.body('#d9a37a'), hair = mats.body('#1d1b26');
  const add = (geo, mat, x, y, z, parent) => { const m = new T.Mesh(geo, mat); m.position.set(x, y, z); (parent || body).add(m); return m; };
  const legL = add(new T.CapsuleGeometry(0.12, 0.62, 4, 10), gi, -0.2, 0.42, 0);
  const legR = add(new T.CapsuleGeometry(0.12, 0.62, 4, 10), gi, 0.2, 0.42, 0);
  legL.rotation.z = -0.12; legR.rotation.z = 0.12;
  add(new T.CapsuleGeometry(0.25, 0.48, 4, 12), gi, 0, 1.15, 0);
  const beltMat = new T.MeshStandardNodeMaterial({ color: D.BELTS[0][1], roughness: 0.8 });
  const belt = add(new T.TorusGeometry(0.255, 0.05, 6, 20), beltMat, 0, 0.95, 0); belt.rotation.x = Math.PI / 2;
  add(new T.SphereGeometry(0.17, 16, 12), skin, 0, 1.7, 0);
  add(new T.SphereGeometry(0.175, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), hair, 0, 1.72, 0);
  const band = add(new T.TorusGeometry(0.172, 0.025, 6, 20), mats.body('#d8343f'), 0, 1.78, 0); band.rotation.x = Math.PI / 2;
  const backArm = add(new T.CapsuleGeometry(0.075, 0.42, 4, 8), gi, 0, 1.18, -0.12);

  const arm = new T.Mesh(new T.CapsuleGeometry(0.075, 1, 4, 8), gi); karateka.add(arm);
  const shield = new T.Group(); karateka.add(shield);
  const disc = new T.Mesh(new T.CylinderGeometry(0.3, 0.3, 0.07, 28), mats.shield); disc.rotation.z = Math.PI / 2; shield.add(disc);
  const mon = new T.Mesh(new T.CylinderGeometry(0.11, 0.11, 0.08, 20), mats.crest); mon.rotation.z = Math.PI / 2; shield.add(mon);
  const rimRing = new T.Mesh(new T.TorusGeometry(0.3, 0.025, 6, 28), mats.crest); rimRing.rotation.y = Math.PI / 2; shield.add(rimRing);

  // Lane telegraph markers at both screen edges (SPEC §4.1).
  const markers = {};
  for (const side of [-1, 1]) for (let lane = 0; lane < 3; lane++) {
    const m = new T.Mesh(new T.PlaneGeometry(0.34, 0.12), new T.MeshBasicNodeMaterial({ color: '#ffe28a', transparent: true, opacity: 0.12, depthWrite: false }));
    m.position.set(side * 4.85, D.LANE_Y[lane], 0.3); scene.add(m); markers[side + ':' + lane] = m;
  }

  // Balls (live and resolved) and their blob shadows.
  const geos = {
    leather: new T.SphereGeometry(D.BALL_R, 20, 14), iron: new T.IcosahedronGeometry(D.BALL_R * 1.05, 0),
    lantern: new T.CapsuleGeometry(D.BALL_R * 0.8, D.BALL_R * 0.7, 4, 12), fire: new T.SphereGeometry(D.BALL_R, 16, 12),
    golden: new T.OctahedronGeometry(D.BALL_R * 1.15, 0), shadow: new T.CircleGeometry(D.BALL_R * 1.1, 16)
  };
  const visuals = new Map();
  function visualFor(b) {
    let v = visuals.get(b.id);
    if (v) return v;
    const mat = b.twin ? mats.balls.twin : mats.balls[b.type];
    v = { ball: b, mesh: new T.Mesh(geos[b.type], mat), shadow: new T.Mesh(geos.shadow, mats.shadow.clone()), outcome: null };
    v.shadow.rotation.x = -Math.PI / 2;
    if (b.type === 'fire') { const tail = new T.Mesh(new T.ConeGeometry(D.BALL_R * 0.8, 0.5, 10), mats.balls.fire); tail.rotation.z = b.side * Math.PI / 2; tail.position.x = b.side * 0.32; v.mesh.add(tail); }
    if (b.type === 'iron') { const r = new T.Mesh(new T.TorusGeometry(D.BALL_R * 1.02, 0.02, 4, 16), mats.crest); v.mesh.add(r); }
    scene.add(v.mesh); scene.add(v.shadow); visuals.set(b.id, v);
    return v;
  }
  function drop(v) { scene.remove(v.mesh); scene.remove(v.shadow); v.shadow.material.dispose(); visuals.delete(v.ball.id); }

  // Spark particles: one instanced mesh, CPU-updated (GPU compute arrives with the modern era, M5).
  const SPARKS = 240, sparkMesh = new T.InstancedMesh(new T.BoxGeometry(0.05, 0.05, 0.05), new T.MeshBasicNodeMaterial({ color: '#ffe7a8' }), SPARKS);
  sparkMesh.frustumCulled = false; scene.add(sparkMesh);
  const sparks = []; for (let i = 0; i < SPARKS; i++) sparks.push({ life: 0, p: new T.Vector3(), v: new T.Vector3() });
  let sparkCursor = 0;
  const tmpM = new T.Matrix4(), tmpQ = new T.Quaternion(), tmpS = new T.Vector3();
  function burst(x, y, n, speed) {
    for (let i = 0; i < n; i++) {
      const s = sparks[sparkCursor++ % SPARKS], a = Math.random() * Math.PI * 2, k = speed * (0.4 + Math.random());
      s.life = 0.35 + Math.random() * 0.3; s.p.set(x, y, 0.2); s.v.set(Math.cos(a) * k, Math.sin(a) * k + 1.5, (Math.random() - 0.5) * 2);
    }
  }

  // View state, eased toward the simulation.
  const view = { shieldY: D.LANE_Y[1], shieldX: SHIELD_X, glow: 0, shake: 0, hurt: 0, bow: 0, skyFrom: 0 };
  function onEvent(e) {
    const b = e.ball;
    if (e.type === 'block' || e.type === 'perfect' || e.type === 'knockout' || e.type === 'hit' || e.type === 'lantern' || e.type === 'golden-lost') {
      const v = visualFor(b), p = D.ballPos(b, b.contactT);
      const strong = e.type === 'perfect' || e.type === 'knockout';
      v.outcome = e.type; v.t0 = e.t; v.x0 = p.x; v.y0 = p.y;
      v.vx = e.type === 'hit' ? -b.side * 1.2 : e.type === 'golden-lost' ? -b.side * 5 : b.side * (strong ? 13 : 5.5);
      v.vy = e.type === 'hit' ? 1.2 : strong ? 4 : 2.6;
      if (e.type === 'golden-lost') v.vy = 0;
    }
    if (e.type === 'block') { burst(b.side * D.CONTACT_X, D.LANE_Y[b.lane], 10, 2.5); view.shake = Math.max(view.shake, b.type === 'iron' ? 0.05 : 0.02); }
    if (e.type === 'perfect') { view.glow = 1; burst(b.side * D.CONTACT_X, D.LANE_Y[b.lane], 26, 5); view.shake = 0.08; }
    if (e.type === 'knockout') { const p = D.ballPos(b, e.t); burst(p.x, p.y, 20, 4); }
    if (e.type === 'lantern') burst(b.side * D.CONTACT_X, D.LANE_Y[b.lane], 18, 2);
    if (e.type === 'hit') { view.hurt = e.heavy ? 0.45 : 0.3; view.shake = e.heavy ? 0.16 : 0.11; }
    if (e.type === 'kiai') view.glow = Math.max(view.glow, 0.35);
    if (e.type === 'belt') { beltMat.color.set(D.BELTS[e.belt][1]); view.bow = 1.5; view.skyFrom = D.skyForBelt(e.belt); burst(0, 1.2, 40, 3); }
  }

  const armDir = new T.Vector3(), up = new T.Vector3(0, 1, 0);
  function update(s, rt, dt, reduced) {
    // Shield follows the effective stance with an ~80 ms ease; facing swings through the front.
    const k = 1 - Math.exp(-dt / 0.022);
    view.shieldY += (D.LANE_Y[s.stanceTarget] - view.shieldY) * k;
    view.shieldX += (s.facingTarget * SHIELD_X - view.shieldX) * (1 - Math.exp(-dt / 0.018));
    const swing = 1 - Math.abs(view.shieldX) / SHIELD_X;
    shield.position.set(view.shieldX, view.shieldY, 0.12 + swing * 0.35);
    // Three-quarter turn toward the camera so the shield face reads; fully frontal mid-swing.
    shield.rotation.y = -Math.sign(view.shieldX || 1) * (0.6 + swing * (Math.PI / 2 - 0.6));
    view.glow = Math.max(0, view.glow - dt * 3);
    mats.shieldGlow.value = view.glow;
    // Arm from shoulder to shield.
    const hand = shield.position.clone().add(new T.Vector3(-Math.sign(view.shieldX || 1) * 0.06, 0, -0.04));
    armDir.subVectors(hand, ARM_SHOULDER); const len = armDir.length();
    arm.position.copy(ARM_SHOULDER).addScaledVector(armDir, 0.5); arm.scale.set(1, Math.max(0.2, len - 0.15) / 1, 1);
    arm.quaternion.setFromUnitVectors(up, armDir.normalize());
    // Body: breathing bob, turn toward the guarded side, recoil on hits, bow on promotion.
    const bob = reduced ? 0 : Math.sin(rt * 4.5) * 0.015;
    view.hurt = Math.max(0, view.hurt - dt); view.bow = Math.max(0, view.bow - dt);
    body.rotation.y += (s.facingTarget * 0.45 - body.rotation.y) * (1 - Math.exp(-dt / 0.03));
    body.position.y = bob - (view.hurt > 0 ? 0.06 : 0);
    const bowAmt = view.bow > 0 ? Math.sin(Math.min(1, (1.5 - view.bow) / 1.5) * Math.PI) * 0.5 : 0;
    body.rotation.x = bowAmt; body.rotation.z = view.hurt > 0 ? -s.facingTarget * 0.12 * Math.sin(view.hurt * 30) : 0;
    backArm.rotation.z = -s.facingTarget * 0.4;
    karateka.visible = !(view.hurt > 0 && Math.floor(view.hurt * 20) % 2);

    // Sky eases toward the current belt's time of day.
    mats.setSky(D.skyForBelt(s.belt), 1 - Math.exp(-dt / 0.5));

    // Telegraphs: markers glow from announce until shortly after entry.
    const lit = {};
    for (const b of s.balls) if (rt >= b.announceT && rt <= b.enterT + 0.25) lit[b.side + ':' + (b.path === 'dipper' ? b.fromLane : b.lane)] = 1;
    for (const key in markers) {
      const m = markers[key], target = lit[key] ? 0.95 : 0.12;
      m.material.opacity += (target - m.material.opacity) * (1 - Math.exp(-dt / 0.04));
      m.scale.x = lit[key] ? 1.3 + Math.sin(rt * 40) * 0.15 : 1;
    }

    // Live balls.
    for (const b of s.balls) {
      const v = visualFor(b), p = D.ballPos(b, rt);
      v.mesh.visible = rt >= b.enterT - 0.05;
      v.mesh.position.set(p.x, p.y, 0);
      v.mesh.rotation.z += dt * 8 * b.side;
      const pulse = b.path === 'dipper' && rt >= b.flashT && rt < b.switchT + 0.18 ? 1 + Math.sin(rt * 50) * 0.22 : 1;
      v.mesh.scale.setScalar(pulse);
      placeShadow(v, p.x, p.y);
    }
    // Resolved balls fly off with simple arcade physics, then disappear.
    for (const v of visuals.values()) {
      if (!v.outcome) { if (!s.balls.includes(v.ball)) drop(v); continue; }
      const a = rt - v.t0;
      if (a > 1.4) { drop(v); continue; }
      let x = v.x0 + v.vx * a, y = v.y0 + v.vy * a - 0.5 * 9.8 * a * a;
      if (y < D.BALL_R) { // one damped floor bounce
        const tb = (v.vy + Math.sqrt(v.vy * v.vy + 2 * 9.8 * (v.y0 - D.BALL_R))) / 9.8, s2 = a - tb, vb = (9.8 * tb - v.vy) * 0.55;
        y = Math.max(D.BALL_R, D.BALL_R + vb * s2 - 0.5 * 9.8 * s2 * s2);
      }
      if (v.outcome === 'golden-lost') y = v.y0;
      v.mesh.visible = v.outcome !== 'lantern' && v.outcome !== 'knockout';
      v.mesh.position.set(x, y, 0); v.mesh.rotation.z += dt * 14;
      placeShadow(v, x, y);
      v.shadow.visible = v.mesh.visible;
    }

    // Sparks.
    let i = 0;
    for (const sp of sparks) {
      if (sp.life > 0) { sp.life -= dt; sp.v.y -= 9.8 * dt; sp.p.addScaledVector(sp.v, dt); }
      tmpS.setScalar(sp.life > 0 ? Math.min(1, sp.life * 4) : 0);
      tmpM.compose(sp.p, tmpQ, tmpS); sparkMesh.setMatrixAt(i++, tmpM);
    }
    sparkMesh.instanceMatrix.needsUpdate = true;

    // Camera shake.
    view.shake = Math.max(0, view.shake - dt * 0.6);
    const sh = reduced ? 0 : view.shake;
    camera.position.set(camHome.x + (Math.random() - 0.5) * sh, camHome.y + (Math.random() - 0.5) * sh, camHome.z);
  }
  function placeShadow(v, x, y) {
    const h = Math.max(0, y - D.BALL_R);
    v.shadow.position.set(x, 0.005, 0);
    v.shadow.scale.setScalar(Math.max(0.4, 1 - h * 0.18));
    v.shadow.material.opacity = 0.35 / (1 + h * 0.8);
  }
  function reset() {
    for (const v of [...visuals.values()]) drop(v);
    beltMat.color.set(D.BELTS[0][1]);
    for (const sp of sparks) sp.life = 0;
    Object.assign(view, { shieldY: D.LANE_Y[1], glow: 0, shake: 0, hurt: 0, bow: 0 });
  }
  function laneScreenY(lane, height) {
    const p = new T.Vector3(0, D.LANE_Y[lane], 0).project(camera);
    return (1 - p.y) / 2 * height;
  }
  function toScreen(x, y, w, h) { const p = new T.Vector3(x, y, 0).project(camera); return [(p.x + 1) / 2 * w, (1 - p.y) / 2 * h]; }

  return { scene, camera, update, onEvent, reset, laneScreenY, toScreen };
};
})(typeof window !== 'undefined' ? window : globalThis);
