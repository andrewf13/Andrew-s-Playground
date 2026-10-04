# Shield Dojo: Remastered — Product Spec

**Status:** v0.2, approved (open questions resolved 4 Oct 2026) · **Owner:** Andrew · **Date:** 4 October 2026
**Target:** a playable entry in Andrew's Playground (`artifacts/shield-dojo-remastered.html`), built with three.js `WebGPURenderer` and TSL (Three Shading Language).
**Predecessor:** `artifacts/shield-dojo.html` (Bounce Edition v3, Canvas 2D). Its belt ladder, five-hit run and offline single-file delivery carry over. Its controls do not: v3 guards left/right and picks the height for you. In Remastered, **you choose the height**.

---

## 1. Pitch

> *It's 1989. You're sitting in front of an Amiga 500 with a one-button joystick. On screen, a karateka stands alone in a mountain dojo, shield raised. Balls come in from both sides at head, chest and knee height, faster every time. Hold the line.*

The game is a single-screen reflex arcade with one idea: **read the ball, match its height, face its side**. Shield Dojo: Remastered recreates how a late-'80s Amiga title looked, sounded and felt to play. It then lets the player turn an **Era Dial** to bring the same game, frame for frame, into a modern real-time 3D rendering. That dial is the hero feature, and it is why we're using three.js + TSL rather than Canvas.

### Design pillars

1. **Readable in one glance.** Every ball shows its side, height and threat before it can hurt you. A loss should always feel like your mistake.
2. **Joystick-honest.** The game must be fully playable on a one-button, 8-direction digital stick. Every richer input (touch, gamepad, mouse) maps back to that.
3. **Faster, never cheaper.** Difficulty comes from speed, density and variety, never from unfair overlaps. The rules in §5.4 guarantee this.
4. **Two eras, one game.** Retro mode and modern mode share the same simulation, camera, timings and hitboxes. Only the rendering pipeline changes.
5. **One file, works offline.** It ships as a single self-contained HTML file like every other Playground project.

### Inspirations (tone, not assets)

*International Karate +* (stage presence, the dojo calm), *Shadow of the Beast* (parallax depth, copper-bar skies), *Pang* / *Arkanoid* (pure single-screen arcade loop), and the Amiga demoscene (raster bars, palette cycling, tracker music). We don't copy any assets, sprites or music.

---

## 2. Core loop

```
Ball telegraphed at screen edge  →  ball travels toward centre
      ↓                                     ↓
Player reads side + height       →  moves stance UP / DOWN, faces LEFT / RIGHT
      ↓                                     ↓
Contact moment:  correct stance? ── yes → BLOCK (+ optional KIAI for PERFECT)
                                  └─ no → HIT (lose 1 of 5 lives, streak resets)
      ↓
Every N blocks → speed and intensity step up; every belt → backdrop advances
```

A run lasts until five hits. A strong white-belt run should take 60–90 seconds. A Legend-level run can last 8–12 minutes.

---

## 3. The karateka and the shield

- **Position:** fixed at horizontal centre, standing on the dojo floor at ~70% of screen height (same composition as v3). He never walks.
- **Outfit:** white gi, belt colour = current belt rank, red hachimaki headband. The gi weathers visibly as he takes hits (tears, a dirty knee) and resets each run.
- **Shield:** a round lacquered wooden *tate* with a single gold *mon* crest. In modern mode the crest emits light and the rim glows when a kiai is ready.
- **Three guard stances.** These are proper karate levels, and they make the height mechanic readable:

| Stance | Karate name | Shield covers | Input |
| --- | --- | --- | --- |
| High | *Jōdan* | head band | Up |
| Middle | *Chūdan* | chest band (default rest stance) | none / centre |
| Low | *Gedan* | knee band | Down |

- **Facing:** Left / Right turns the shield to that side. The body pivots with a two-frame turn (~66 ms). Stance and facing are independent, so Up-Left on the stick means "high guard, facing left".
- **Stance change time:** 80 ms (an animation tween; the hitbox switches at 50%). Turning: 66 ms. These figures are the anchors for the fairness rules in §5.4.
- **Animation set:** idle breathing bob · 3 stances × 2 facings · turn · kiai thrust · block recoil (light / heavy) · hit stagger · knock-down (run over) · bow (start of run and belt promotion).

### 3.1 Controls

| Action | Amiga joystick | Keyboard | Gamepad | Touch |
| --- | --- | --- | --- | --- |
| Raise / lower stance | Up / Down (held = stance; release = back to chūdan) | W / S or ↑ / ↓ | D-pad / left stick Y | Vertical position of your thumb |
| Face left / right | Left / Right | A / D or ← / → | D-pad / left stick X | Which half of the screen your thumb is on |
| **Kiai** (timed parry) | Fire | Space / J | A / Cross | Second finger tap anywhere |
| Pause | — | P / Esc | Start | Pause button |
| Era Dial | — | Tab | Select / Back | Toggle in HUD |

**Release returns to chūdan** (decided, Q1). This is the "held stance" model: it suits a real joystick, puts tension in every ball and fits the karate fiction. A sticky stance, which stays until you change it, is available only as an assist (§10). **The player always chooses facing** (decided, Q2); the shield never turns on its own.

Touch is the one input that is fully analog: your finger's position *is* the shield, snapped to the nearest of the three bands.

---

## 4. Balls

### 4.1 Anatomy of a throw

Each ball is defined by **side** (L/R), **lane** (high / mid / low), **travel time** (spawn to contact), **path type** and **ball type**. The contact point is fixed at the shield's distance from the karateka on that side.

- **Telegraph:** 350 ms before a ball enters, a glint and a lane marker flash at the screen edge on its side and lane. A spatial audio cue plays panned to that side, with pitch by lane: high = high note, low = low note. This lets players with sound on play partly by ear (see §10).
- **Shadow:** every ball casts a floor shadow. For bouncing balls, the shadow is how you read the arrival height.

### 4.2 Path types

| Path | Behaviour | Unlocks |
| --- | --- | --- |
| **Straight** | Flat line at lane height | White belt |
| **Bouncer** | One floor bounce, then rises/settles into its lane (v3's signature) | Yellow |
| **Lob** | High arc that drops into its lane late | Orange |
| **Dipper** | Changes lane once mid-flight. The change is telegraphed: the ball flashes at least 300 ms before it moves | Blue |
| **Skimmer** | Very fast, low lane only, ignores the speed cap by +15% | Purple |

### 4.3 Ball types ("intensity")

Intensity = *what happens when it arrives*, signalled by both colour **and** shape/pattern (colour-blind safe).

| Type | Look | On block | On hit | Unlocks |
| --- | --- | --- | --- | --- |
| **Leather** | Tan, stitched | +100 | −1 life | Start |
| **Iron** | Dark, riveted, heavier thud | +150; pushes shield (40 ms stance lock) | −1 life + longer stagger | Green |
| **Paper lantern** | Glows, wobbles | +50; bursts into sparks | No damage, breaks streak | Green |
| **Twin** | Two linked balls, same lane, 220 ms apart | +100 each | −1 per ball | Blue |
| **Fire** | Trailing flame, fast | +200 | −1 life | Brown |
| **Golden** | Rare, sparkles, slow | +500 and +1 life (max 5) | Lost for good | Any belt, ~1 in 60 balls |

### 4.4 Block, Perfect and Kiai

- **Block:** the shield is on the ball's side and in its lane at the contact moment. The ball deflects back with arcade physics and bounces off the floor.
- **Kiai Perfect:** pressing Fire within **±70 ms** of contact *while already blocking correctly* triggers a Kiai. You get 2× points, a 60 ms hit-stop freeze, a shout, a screen flash and a hard return: the ball rockets off-screen and can knock out the next incoming ball on that side (bonus +250).
- **Kiai whiff:** Fire outside a window has a 300 ms cooldown and no other penalty. Spamming it gets you nothing; timing it gets you a lot.

---

## 5. Difficulty and pacing

### 5.1 Speed ramp ("the balls get faster as they go")

Speed is driven by **blocks landed** (`n`), not wall-clock time, so the pace follows the player's skill:

```
travelTime(n)   = max(0.55 s, 2.20 s × 0.985^n)        // spawn → contact
spawnInterval(n)= max(0.34 s, 1.40 s × 0.988^n) × rand(0.85, 1.15)
```

| Blocks | Travel time | Feel |
| --- | --- | --- |
| 0 | 2.20 s | Warm-up; you can watch it come |
| 25 | 1.51 s | Comfortable |
| 50 | 1.03 s | Focused |
| 100 | 0.55 s (cap) | Pure reflex; the variety in §4 now provides the challenge |

### 5.2 Height distribution

The game uses a shuffled "bag" of lanes (as in v3), so each lane comes up regularly and never more than 3 times in a row. From Blue belt onward the bag also includes deliberate high↔low "split" pairs, which make the player cross chūdan quickly.

### 5.3 Belts (progression within a run)

Carried over from v3 for continuity. Each belt changes the ball pool (§4) **and** moves the backdrop on (§7).

| Belt | Blocks to reach | New this belt |
| --- | --- | --- |
| White | 0 | Straight, Leather |
| Yellow | 8 | Bouncer |
| Orange | 20 | Lob |
| Green | 36 | Iron, Lantern |
| Blue | 56 | Dipper, Twin, split pairs |
| Purple | 82 | Skimmer |
| Brown | 114 | Fire |
| Black | 150 | Everything, max density |
| Crimson | 200 | Speed cap −5% (0.52 s) |
| **Legend** | 260 | Endless; "Mirror" waves (both sides alternate every ball) |

A belt promotion triggers a 1.5 s *bow* beat. Balls pause, the belt ties on, a jingle plays and the backdrop transitions. This is the only break in play.

### 5.4 Fairness contract (non-negotiable)

The spawner rejects any schedule that breaks these rules:

1. **Opposite-side arrivals** are ≥ 260 ms apart (66 ms turn + ≥ 190 ms human reaction margin).
2. **Lane changes on the same side** are ≥ 200 ms apart (80 ms stance + margin).
3. **Turn + lane change together** are ≥ 300 ms apart.
4. No ball is ever hidden behind another ball, the HUD or the karateka at the moment you need to read it.
5. Dipper lane changes are telegraphed ≥ 300 ms before contact.

The run seed is shown on the results screen. A **Daily Dojo** mode uses the date as the seed, so everyone plays the same run that day (local best only; no server).

---

## 6. Scoring, lives and HUD

- **Score:** base points × streak multiplier (×1 → ×5, +1 every 10 consecutive blocks), × 2 for a Kiai.
- **Lives:** 5 (shown as five *hachimaki* knots). A golden ball restores one.
- **HUD:** shown in the style of the era, chunky Topaz-like bitmap font, top bar: `SCORE 000000 · STREAK ×3 · BELT ▮▮▮ · HI 000000`. The HUD always renders crisp and is never palette-crushed, even in retro mode.
- **Results screen:** score, best, belt reached, blocks, Kiai %, longest streak, seed, plus one line of dojo advice based on your most common miss ("You drop your guard on low balls from the left.").
- **Persistence:** `localStorage` for best score, per-belt bests, settings and era choice. Every read and write is wrapped in try/catch, the same as v3.

---

## 7. Backdrop: "The Dojo at the Edge of the Mountains"

One location, seen from **inside an open-sided mountain dojo**. The camera looks out through the open shōji walls across a valley to a distant snow peak. **The time of day follows your belt**, so the backdrop itself shows how far you've come.

### 7.1 Layers (front to back, all parallax-ready)

1. **Dojo floor:** polished hinoki boards with a reflection of the karateka and balls (planar in modern mode; dithered mirror in retro mode).
2. **Frame:** dark timber pillars, open shōji panels, two hanging paper lanterns, a calligraphy scroll (守, "protect", matching v3's logo mark).
3. **Courtyard:** stone lanterns, raked gravel, a cherry tree shedding petals.
4. **Valley:** pagoda and torii silhouettes on a ridge, mist bands.
5. **Peak:** a snow-capped mountain (fictional, not Fuji).
6. **Sky:** a **copper-bar gradient**, the signature Amiga effect of changing the background colour on every scanline, recreated as a banded TSL gradient.

### 7.2 Time of day by belt

| Belts | Time | Sky / mood | Signature effect |
| --- | --- | --- | --- |
| White–Yellow | Dawn | Pale gold to lilac copper bars | Mist lifting off the valley |
| Orange–Green | Morning | Clear blue, crisp | Cherry petals drifting |
| Blue–Purple | Sunset | Orange, magenta, purple bars | Long god-rays through the shōji |
| Brown | Dusk | Indigo; lanterns light up | Palette-cycled lantern flicker |
| Black–Crimson | Storm night | Charcoal, rain | Lightning flashes reveal the peak |
| Legend | Aurora | Starfield and aurora raster bars | Full demoscene send-off: sine-scrolling bars behind the peak |

Transitions run during the promotion bow: a 1.5 s copper-bar sweep wipes the old sky away top to bottom.

### 7.3 Readability rules for the backdrop

- Ball lanes (head/chest/knee bands) always sit over a **low-contrast, low-detail** part of the backdrop. Busy detail goes above the head band or below the floor line.
- Petals, rain and other ambient particles never share a hue with any ball type and are always ≤ 40% luminance contrast against the sky.
- Reduced-motion setting: no petals, rain, lightning flash or parallax drift; copper bars stay static.

---

## 8. The Era Dial (retro ⇄ modern)

The dial is a three-position switch in the HUD and on Tab. **Gameplay is identical in all three modes.** Only rendering changes, and you can switch mid-run.

| Setting | What you see |
| --- | --- |
| **1989** *(default on first launch; the dial pulses once to invite a switch)* | Internal render at **320 × 256 (PAL lowres)**, nearest-neighbour upscale to 4:3. Output is quantised to a **32-colour palette drawn from the Amiga's 12-bit (4,096-colour) space** with ordered Bayer dithering. Copper bars, palette-cycling lanterns, 4-channel audio. Optional CRT (scanlines, slight barrel, phosphor bloom). |
| **1993** | The "AGA" middle step: 640 × 512, 256 colours, softer dithering, light bloom. A nod to the A1200. |
| **Today** | Full-resolution three.js scene: toon-lit karateka with rim light, lacquer and metal shield material, volumetric god-rays, real-time floor reflections, GPU-particle petals/rain/sparks, bloom, filmic grade. Same camera and framing as 1989. |

The switch itself is a showpiece: a 600 ms copper-bar wipe in which the new era fills in scanline by scanline from the top of the screen.

---

## 9. Audio

- **Retro:** a procedural 4-voice "Paula" synth using WebAudio. Four channels, 8-bit-style sample playback, hard left/right panning like the real Amiga (channels 0/3 left, 1/2 right). The music is an original tracker-style tune in a pentatonic scale with a taiko pulse, and its tempo rises with belt.
- **Modern:** the same composition rearranged with fuller instrumentation and reverb; the SFX get more layers.
- **SFX:** spawn whoosh (panned, pitched by lane), floor bounce, block thud (per ball type), Kiai shout, hit grunt, belt jingle, run-over gong.
- **Default:** sound off until the first user interaction (browser autoplay rules). The mute setting persists. All audio is generated procedurally, so the file needs no audio assets.

---

## 10. Accessibility and comfort

- **Readable by more than colour:** every ball type differs by shape/pattern as well as colour; lanes have on-screen markers.
- **Playable by ear:** stereo pan = side and pitch = lane. With practice, a player could clear early belts from audio alone.
- **Assist options:** Slower Dojo (speed cap 0.80 s instead of 0.55 s), Sticky Stance (see Q1), Longer Kiai window (±110 ms). Using an assist marks the score with a small ◇ glyph and does not block anything.
- **Reduced motion:** honours `prefers-reduced-motion`; also a manual toggle. No screen shake, flashes capped at 3 Hz.
- **Pause on blur / tab hide** (same as v3).
- **Remappable keys.** Full gamepad support via the Gamepad API.

---

## 11. Technical approach

### 11.1 Stack

- **three.js** — pinned recent release that ships the `three/webgpu` and `three/tsl` entry points (r171 or later; pin the exact version in M0).
- **Renderer:** `WebGPURenderer`. On browsers without WebGPU it automatically falls back to its WebGL2 backend. **All materials and post-processing are written in TSL**, so one shader source compiles to WGSL (WebGPU) or GLSL (WebGL2). There is no hand-written GLSL/WGSL.
- **No framework, no bundler at runtime.** As in `sources/everest` and `sources/singapore`, a `build.py` inlines the three.js module, the game code and the shell into one HTML file in `artifacts/`.
- **Last resort:** with neither WebGPU nor WebGL2, show a friendly message and a link to the classic v3 Canvas edition, which runs everywhere.

### 11.2 Architecture

```
sources/shield-dojo/
  SPEC.md            ← this document
  shell.html         ← page chrome, HUD, overlays (DOM)
  sim.js             ← deterministic simulation (no three.js imports)
  spawner.js         ← seeded RNG, lane bag, fairness contract
  input.js           ← keyboard / gamepad / touch → joystick state
  render/
    scene.js         ← karateka, shield, balls, backdrop layers
    materials.js     ← TSL node materials
    eras.js          ← 1989 / 1993 / Today post-processing chains
  audio.js           ← Paula-style 4-voice synth + modern layer
  build.py           ← inlines everything → artifacts/shield-dojo-remastered.html
```

- **Fixed-timestep simulation at 120 Hz** with rendering interpolated between ticks. Contact moments are resolved from the analytic ball path, not from per-frame collisions, so outcomes don't depend on frame rate.
- **The simulation knows nothing about rendering.** That separation is what keeps the Era Dial honest: three render chains, one `sim.js`.
- **Seeded RNG** (e.g. mulberry32) for Daily Dojo and reproducible bug reports.

### 11.3 TSL work list

| Effect | TSL technique |
| --- | --- |
| Copper-bar sky | Screen-space Y → `floor()` banding into N bars, palette lookup per bar, `time`-driven offset for Legend sine scrolls |
| 1989 palette quantise + dither | Post pass: 4×4 Bayer matrix as a `uniformArray`, nearest-match against 32-entry palette uniform, quantise to 4 bits/channel |
| Pixel-perfect lowres | Render to a 320×256 `RenderTarget`, nearest sampling to canvas |
| Palette cycling (lanterns, water) | Index texture + time-rotated palette lookup in the fragment node |
| CRT | Scanline mask, slight barrel distortion, chromatic offset, phosphor bloom; all optional |
| Toon karateka | `MeshToonNodeMaterial`-style stepped lighting + rim term from `normalView`/`positionViewDirection` |
| Shield block shockwave | Ring-distortion post node centred on the contact point, 180 ms |
| Ball trails | Instanced quads with fading history; fire type adds noise-driven flame in TSL |
| Petals / rain / sparks | GPU particles updated by TSL `compute()` on WebGPU; CPU-updated instanced fallback on the WebGL2 backend |
| Floor reflection | TSL `reflector()` node (Today); dithered vertical flip (1989) |
| God-rays | Radial blur from the sun's screen position (Sunset belts) |

### 11.4 Assets

- **Karateka:** a low-poly rigged model (≈3–5k tris) built for this project, with the animations in §3 baked in. In 1989 mode it is rendered at 320×256 with the palette crush and comes out looking like a pre-rendered Amiga sprite, so there is **one rig for all eras**. Included as an embedded GLB (base64) or built procedurally in code; to be decided in M0 by file-size budget.
- **Backdrop:** mostly procedural geometry and TSL shading. Only the calligraphy scroll and mon crest need small embedded textures.
- **Font:** a free bitmap font in the Topaz style, embedded (licence to be checked).

### 11.5 Budgets

| Metric | Target |
| --- | --- |
| Frame rate | 60 fps on a 2020-era integrated GPU (Today); 1989 mode on almost anything |
| Input-to-shield latency | ≤ 1 frame after the sim tick that reads the input |
| Single HTML file size | ≤ 3 MB (three.js webgpu build is the largest part) |
| Time to first frame | < 2 s on broadband, < 1 s from local file |
| Memory | < 300 MB GPU+JS on Today |

---

## 12. Playground integration

- New file `artifacts/shield-dojo-remastered.html` plus a new entry in `projects.js` (Games, "Reflex arcade", edition "Remastered", year `1989`, controls "Keyboard, gamepad + touch").
- The README table gets a row. The v3 edition stays listed as **Shield Dojo Classic**, serving both as a fallback and as a "then vs now" pair.
- The **HTML ↓** download works offline, like every other project.

---

## 13. Milestones

| # | Milestone | Done when |
| --- | --- | --- |
| M0 | **Tech spike** | `WebGPURenderer` + one TSL material + build.py inlining produce one HTML file that runs offline in Chrome, Safari and Firefox; WebGL2 fallback confirmed |
| M1 | **Greybox gameplay** | Capsule karateka, sphere balls, all 3 stances × 2 sides, speed ramp, fairness contract, lives, score. *Fun with no art at all.* |
| M2 | **Ball variety** | All path and ball types, Kiai, belts, Daily Dojo seed |
| M3 | **1989 pipeline** | Lowres target, palette + dither, copper sky, Paula audio, HUD |
| M4 | **Backdrop and karateka** | Full dojo with time of day by belt, rigged model and animation set |
| M5 | **Today and 1993 eras** | Modern render chain, Era Dial with copper wipe |
| M6 | **Polish and ship** | Accessibility options, touch tuning, performance budgets met, Playground entry, README |

M1 is the gate: if greybox isn't fun, we tune numbers before making any art.

---

## 14. Acceptance criteria (ship checklist)

- [ ] A white-belt player can survive ≥ 30 s on first try with no instructions beyond the start screen.
- [ ] No reproducible fairness violation over 10,000 simulated Legend-level spawns (automated test against §5.4).
- [ ] The same seed + same inputs give an identical score in all three eras.
- [ ] Holds 60 fps (Today) on the reference integrated-GPU laptop, and 1989 mode on a 2019 mid-range phone.
- [ ] Fully playable via keyboard only, gamepad only and touch only.
- [ ] Runs from the downloaded HTML with networking disabled.
- [ ] Reduced-motion mode removes shake, flashes > 3 Hz, parallax and weather.

---

## 15. Out of scope (v1)

Online leaderboards, multiplayer / versus, a story mode, character customisation, unlockable costumes, and any backend. Possible v2 items: a two-player "shared dojo" where each player defends one side, and a level editor that exports seeds.

---

## 16. Decisions log

| # | Question | Decision |
| --- | --- | --- |
| Q1 | Held stance or sticky stance? | **Held**: releasing returns to chūdan. Sticky is an assist only |
| Q2 | Player-chosen facing or auto-face? | **Player chooses** facing |
| Q3 | Karateka as embedded GLB or procedural geometry? | *Open*: decide in M0 on file-size budget |
| Q4 | Default era on first launch? | **1989**, with the dial pulsing once to invite the switch |
| Q5 | Name? | **Shield Dojo: Remastered**; v3 stays listed as **Shield Dojo Classic** |
