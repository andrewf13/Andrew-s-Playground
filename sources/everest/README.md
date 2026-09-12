# Everest 1996 — Into the Storm

An offline, single-file Three.js fly-through for Andrew’s Playground.

## Build

From the repository root, run:

```sh
python3 sources/everest/build.py
```

This bundles `shell.html`, `three.min.js`, `software.js` and `app.js` into `artifacts/everest-1996.html`. No npm packages, API keys, network requests or build service are needed. Open the HTML directly in a WebGL-enabled browser.

Three.js is the MIT-licensed version already bundled in this repository’s Apollo rollout diorama; its original licence header is preserved. The unmodified library is retained locally to make builds reproducible.

## Experience

Fourteen 20-second chapters: the approach, icefall, Western Cwm, Lhotse Face, South Col, midnight departure, Balcony, South Summit, Hillary Step, summit, storm, South Col whiteout, rescue and remembrance. Controls provide play/pause/replay, timeline seeking, chapter selection, playback speed, route overview, pointer orbit, wheel/pinch zoom, fullscreen and opt-in synthesised wind/radio effects.

There are no recorded voices, historical audio clips or simulated personal radio messages. Page visibility pauses timeline advancement; audio can be toggled independently. The scene has no scores or failure objectives.

## Historical scope

Route and landmarks: https://www.pbs.org/wgbh/nova/everest/climb/waytosummitsou.html

Approximate event sequence and underlying references: https://en.wikipedia.org/wiki/Timeline_of_the_1996_Mount_Everest_disaster

Disaster overview: https://en.wikipedia.org/wiki/1996_Mount_Everest_disaster

North-side expedition: https://en.wikipedia.org/wiki/1996_Indo-Tibetan_Border_Police_expedition_to_Mount_Everest

Consulted 12 September 2026. The field-notes dialog includes clickable citations and the names of all eight fatalities. Accounts differ over timing, decisions and responsibility; the experience does not resolve those disputes or assign a single cause.

The earlier approach is clearly distinguished from the summit push around midnight on 9–10 May. The south-side route is animated; the separate north-side fatalities are acknowledged in the notes and final chapter. The summit uses the familiar 1996 figure of 8,848 metres.

## Deliberate simplifications

This is procedural terrain, not a DEM or navigation map. Horizontal distances and relief are compressed; camp elevations are approximate; figures, camps, ice features and the pre-2015 Hillary Step are enlarged. Gold route geometry is an explanatory overlay, not a claim that all sections were continuously fixed with rope. Weather is an illustrative transition and the camera retains visibility during the whiteout for educational legibility. The camera and group symbols are not individual GPS tracks.

## Performance and accessibility

Fixed terrain buffers, instanced seracs, pooled climbers, capped pixel ratio, bounded snow particles and no external assets. Playback starts paused. All controls are native keyboard-accessible elements; the range is labelled; chapter text is exposed to assistive technology. Browsers without WebGL automatically use a lower-detail canvas renderer with the same 3D camera, timeline and controls. On small screens the chapter panel stacks above the controls.
