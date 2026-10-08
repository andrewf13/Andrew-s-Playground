# The Long Fall — Milky Way meets Andromeda

A five-minute single-file film of the Milky Way–Andromeda collision, computed live in the browser, with a generative score.

## Build

```sh
python3 sources/milky-way-andromeda/build.py
```

This bundles `shell.html`, `sim.js`, `audio.js` and `app.js` into `artifacts/the-long-fall.html`. No libraries, npm packages, network requests or assets are needed.

## How it works

- **Physics (`sim.js`)**: a restricted three-body model after Toomre & Toomre (1972). Two Hernquist halo + bulge potentials (1.5 and 1.9 × 10¹² M☉) follow a two-body orbit with a dynamical-friction drag, tuned so the first pericentre is at 4.0 Gyr (24 kpc) and the cores collide on the second plunge at 4.5 Gyr. Up to 45,000 massless star, gas and dust particles are integrated with leapfrog (0.5 Myr steps) in a Web Worker, which posts checkpoints every 100 Myr so the timeline can be scrubbed. Before 3.5 Gyr the disks rotate rigidly. The Sun is particle 0, at 8.2 kpc, with its orbital phase chosen so it is flung to the outskirts (as Cox & Loeb 2008 found likely). The same file runs in Node for testing.
- **Rendering (`app.js`)**: WebGL2/WebGL1 point sprites into a half-float buffer, multiplicative dust, a two-level bloom and ACES tone mapping. Browsers without WebGL get a Canvas 2D renderer.
- **Film**: eight chapters and about 30 captions on a 4:50 timeline. Film time maps to story time with a monotone cubic curve. Camera shots blend into each other, and the viewer can drag, zoom or switch on a free camera.
- **Score (`audio.js`)**: Web Audio synthesis tied to film time. It has string pads, a sub drone, a formant choir, bells, a heartbeat that speeds up into the collision, a riser and impacts on both close passes. The chords move from D minor to D major for Milkomeda.

## Sources (consulted 8 October 2026)

- NASA/STScI 2012 Hubble release (van der Marel et al.): https://science.nasa.gov/missions/hubble/nasas-hubble-shows-milky-way-is-destined-for-head-on-collision-with-andromeda-galaxy
- ESA/Hubble future night-sky sequence: https://esahubble.org/images/opo1220b/
- Sawala et al. 2025, Nature Astronomy (~50% merger odds in 10 Gyr): https://www.dur.ac.uk/news-events/latest-news/2025/06/new-study-casts-doubt-on-the-likelihood-of-milky-way-collision-with-andromeda/
- Wu et al. 2026, ApJ Letters (~90% in fiducial model, median ~6.5 Gyr): https://iopscience.iop.org/article/10.3847/2041-8213/ae5799

The in-film Notes dialog lists the simplifications: no self-gravity or gas physics, no M33 or Magellanic Clouds, artistic brightness, and an illustrative horizon.
