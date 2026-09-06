# Andrew’s Playground

A static gallery of seven playable HTML projects, ready for GitHub Pages.

## Enable GitHub Pages

The site files are in the public `andrewf13/Andrew-s-Playground` repository.

1. Open repository **Settings → Pages**.
2. Under **Build and deployment**, choose **Deploy from a branch**.
3. Select **main** and **/ (root)**, then click **Save**.
4. Wait for the Pages deployment to succeed. GitHub will show the published address.

Expected address after enabling Pages: `https://andrewf13.github.io/Andrew-s-Playground/`.

No build workflow or dependency installation is required. The GitHub connection used for uploading these files does not expose Pages administration, so enabling Pages is a one-time owner setup step in GitHub.

## Included projects

- Shield Dojo — Bounce Edition v3, fixed 4:3, head/chest/knee arrivals.
- Albion Transport — passenger transport management in the 1950s.
- Eagle: The Final Descent — lunar landing diorama and soundscape.
- Apollo 11: Crawlerway to Sky — rollout, launch and first-stage separation.
- The Anzac Landing — guided 25 April 1915 landing sequence.
- The Fall of Singapore — guided February 1942 diorama.
- Gallipoli: A Living Miniature — fictionalised campaign sandbox.

## Files

- `index.html`, `styles.css`, `home.js`: gallery and category filters.
- `projects.js`: project titles, descriptions, categories and file locations.
- `play.html`, `play.js`: project viewer, home navigation, fullscreen and downloads.
- `artifacts/`: self-contained playable HTML files; each retains its original source notes and bundled third-party licence notices.
- `assets/dojo-preview.html`: one static frame drawn by the actual Shield Dojo renderer. It does not start a game or run a continuous animation loop.
- `.nojekyll`: tells GitHub Pages to serve the static files directly.
- `404.html`: a small not-found page configured for `/Andrew-s-Playground/`.

## Updating the collection

Replace an artifact at its existing path to keep shared links working. Update its entry in `projects.js` when the title or description changes. To add a project, add its HTML under `artifacts/` and append an entry in `projects.js`; update the category counts and no-JavaScript direct links in `index.html` too.

No build step, API keys, external fonts, account system or backend are needed. Project content loads only when visitors open it. A desktop or tablet is recommended for the larger 3D scenes; those projects require WebGL. Sounds follow each project’s original controls.

## Validation

The package was checked for JavaScript syntax, local file references, project identifiers and artifact completeness. Existing HTML projects were preserved byte-for-byte. No browser or physical-device playtest was performed for this gallery build.
