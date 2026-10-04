# Shield Dojo: Remastered

An Amiga-inspired karate reflex arcade built with three.js `WebGPURenderer` and TSL. The product spec is in [SPEC.md](SPEC.md).

**Current build: M0 + M1 greybox.** Capsule karateka, all three guard stances on both sides, every ball path and type, Kiai, belts, the fairness contract and a TSL copper-bar sky whose time of day follows your belt. Not yet built: the 1989/1993/Today Era Dial, audio, the full dojo backdrop and the rigged character model (milestones M3–M6).

## Build

From the repository root:

```sh
python3 sources/shield-dojo/build.py
```

This inlines `vendor/three-tsl.js` and the game scripts into `artifacts/shield-dojo-remastered.html`. Open that file directly in a browser. It works offline.

## Test

```sh
node sources/shield-dojo/test/sim.test.js
```

The simulation (`spawner.js`, `sim.js`) has no rendering imports, so it runs in Node. The tests check:

- the fairness contract over 10,000 Legend-level spawns
- that a perfect-information bot is never hit
- the speed ramp, belts and Kiai scoring
- the held-stance model
- seed determinism

## Debug URL parameters

| Parameter | Effect |
| --- | --- |
| `?autostart` | Start a run immediately |
| `?seed=N` | Fixed run seed |
| `?blocks=N` | Start as if N balls were already blocked (jump to a belt) |
| `?webgl` | Force the WebGL2 backend instead of WebGPU |

## Files

| File | Role |
| --- | --- |
| `spawner.js` | Seeded RNG, lane bag, belt-gated ball variety, fairness contract |
| `sim.js` | Deterministic 120 Hz simulation, scoring, Kiai, belts, test bot |
| `input.js` | Keyboard, gamepad and touch mapped to one joystick state |
| `render/materials.js` | TSL node materials: copper sky, rim light, shield glow |
| `render/scene.js` | Greybox scene; reads sim state, never writes it |
| `main.js` | Renderer bootstrap, fixed-timestep loop, HUD, overlays |
| `vendor/three-tsl.js` | three.js 0.186.1 (`three/webgpu` + `three/tsl`), bundled as one global |

## Regenerating the three.js bundle

The vendored file is an unmodified esbuild bundle of three.js r186 (MIT; its licence headers are preserved inline):

```sh
npm i three@0.186.1 esbuild
echo "export * from 'three/webgpu'; import * as TSL from 'three/tsl'; export { TSL };" > entry.js
npx esbuild entry.js --bundle --minify --format=iife --global-name=THREE --legal-comments=inline --outfile=three-tsl.js
```

`main.js` strips three.js's default `swizzle: 'rgba'` from texture views. Without this, some Chromium builds with experimental WebGPU features reject the descriptor and render nothing.
