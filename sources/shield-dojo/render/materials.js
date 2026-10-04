// TSL node materials (SPEC §11.3). One shader source compiles to WGSL on WebGPU and GLSL on WebGL2.
(function (root) {
'use strict';
const D = root.DOJO, T = root.THREE, { Fn, uniform, uniformArray, screenUV, floor, mix, smoothstep, vec3, float, time, sin, normalView, positionViewDirection, dot, max } = T.TSL;

// Sky palettes by time of day (SPEC §7.2): [top, middle, horizon].
const SKIES = [
  ['#2b3463', '#a77ea3', '#f6d39a'],  // dawn: white–yellow
  ['#2f6fb8', '#7fb5e0', '#e7f1f2'],  // morning: orange–green
  ['#2a1d4f', '#b2457a', '#f79b54'],  // sunset: blue–purple
  ['#0e1233', '#2c2a63', '#7d4e74'],  // dusk: brown
  ['#090b12', '#1b2130', '#3a4256'],  // storm night: black–crimson
  ['#03040d', '#0f2a3a', '#1f6b5a']   // aurora: legend
];
D.skyForBelt = b => b <= 1 ? 0 : b <= 3 ? 1 : b <= 5 ? 2 : b === 6 ? 3 : b <= 8 ? 4 : 5;

D.createMaterials = function () {
  const sky = {
    top: uniform(new T.Color(SKIES[0][0])), mid: uniform(new T.Color(SKIES[0][1])), low: uniform(new T.Color(SKIES[0][2])),
    bands: uniform(28), aurora: uniform(0), flash: uniform(0)
  };

  // Copper-bar sky: quantise screen height into horizontal bands, one flat colour per band,
  // with a thin bright lip at the top of each bar the way Amiga copper lists looked.
  const copperSky = Fn(() => {
    const v = screenUV.y.oneMinus();                       // 1 at the top of the screen
    const band = floor(v.mul(sky.bands));
    const q = band.div(sky.bands);
    const lower = mix(sky.low, sky.mid, smoothstep(0.30, 0.62, q));
    const col = mix(lower, sky.top, smoothstep(0.62, 1.0, q)).toVar();
    const lip = smoothstep(0.80, 1.0, v.mul(sky.bands).fract()).mul(0.06);
    col.addAssign(lip);
    // Legend: sine-scrolling aurora bars.
    const wave = sin(q.mul(23.0).add(time.mul(1.7))).mul(0.5).add(0.5);
    col.addAssign(vec3(0.15, 0.85, 0.55).mul(wave.mul(smoothstep(0.45, 0.9, q)).mul(sky.aurora).mul(0.45)));
    return col.add(sky.flash);
  })();

  // Rim light for the karateka: brightens silhouettes so he reads against any sky.
  const rimColor = uniform(new T.Color('#ffd9a8'));
  const rim = Fn(() => float(1).sub(max(dot(normalView, positionViewDirection), 0)).pow(3).mul(0.55))();
  const body = (hex) => {
    const m = new T.MeshStandardNodeMaterial({ color: hex, roughness: 0.75, metalness: 0 });
    m.emissiveNode = rimColor.mul(rim);
    return m;
  };

  const shieldGlow = uniform(0);
  const shield = new T.MeshStandardNodeMaterial({ color: '#7a2a22', roughness: 0.35, metalness: 0.1 });
  shield.emissiveNode = vec3(0.6, 0.95, 1.0).mul(shieldGlow).add(rimColor.mul(rim).mul(0.6));
  const crest = new T.MeshStandardNodeMaterial({ color: '#e9b949', roughness: 0.3, metalness: 0.8 });
  crest.emissiveNode = vec3(1.0, 0.8, 0.3).mul(shieldGlow.mul(0.8));

  const glow = (hex, strength) => {
    const m = new T.MeshStandardNodeMaterial({ color: hex, roughness: 0.4 });
    m.emissiveNode = uniform(new T.Color(hex)).mul(strength);
    return m;
  };
  const balls = {
    leather: new T.MeshStandardNodeMaterial({ color: '#c8925a', roughness: 0.7 }),
    iron: new T.MeshStandardNodeMaterial({ color: '#4a4f5c', roughness: 0.35, metalness: 0.9, flatShading: true }),
    lantern: glow('#ffcf6a', 0.9),
    fire: glow('#ff6a2a', 1.2),
    golden: new T.MeshStandardNodeMaterial({ color: '#ffd24a', roughness: 0.2, metalness: 1.0 }),
    twin: new T.MeshStandardNodeMaterial({ color: '#58d0c8', roughness: 0.6 })
  };
  balls.golden.emissiveNode = vec3(0.6, 0.45, 0.1).mul(sin(time.mul(8)).mul(0.3).add(0.7));

  const shadow = new T.MeshBasicNodeMaterial({ color: '#000000', transparent: true, opacity: 0.3, depthWrite: false });
  const floor_ = new T.MeshStandardNodeMaterial({ color: '#6e4b3a', roughness: 0.55 });
  const timber = new T.MeshStandardNodeMaterial({ color: '#2d2030', roughness: 0.9 });

  function setSky(index, t) {
    const p = SKIES[index];
    sky.top.value.lerp(new T.Color(p[0]), t); sky.mid.value.lerp(new T.Color(p[1]), t); sky.low.value.lerp(new T.Color(p[2]), t);
    sky.aurora.value += ((index === 5 ? 1 : 0) - sky.aurora.value) * t;
  }

  return { copperSky, sky, setSky, body, shield, crest, shieldGlow, balls, shadow, floor: floor_, timber };
};
})(typeof window !== 'undefined' ? window : globalThis);
