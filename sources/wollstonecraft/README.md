# Wollstonecraft in bloom

First-pass flower walking tour with one real stop, a Leaflet 1.9.4 raster map with OpenStreetMap tiles, Google walking directions, accessible photo/illustration tabs and a full-image dialog. Audio is phase 2 and is deliberately not included.

Build with `python sources/wollstonecraft/build.py`. No package installation required. The HTML embeds both optimised images so the guide remains viewable in a downloaded copy; maps and directions require an internet connection. The original uploads are not included in the repository.

## First stop

- Label: Pink blossom on Hazelbank
- Original photo: `20260902_162447.heic`, supplied by Andrew inside a ZIP.
- GPS: -33.83263829972222, 151.2027032.
- Observed: 2026-09-02T16:24:47+10:00.
- Nearby address: 17 Hazelbank Road, from the supplied Samsung Gallery screenshot; no reverse-geocoding claim.
- Identification: ornamental flowering Prunus, possibly P. × blireana. Provisional. Related flowering peaches and apricots remain alternatives.
- Illustration: supplied by Andrew; AI-assisted and not a botanical verification source.

The uploaded HEIC outside the ZIP had GPS fields zeroed. The version inside the ZIP retained coordinates. Optimised display assets contain no EXIF; intentional stop coordinates and observation date are in the guide.

## Next batch

Use original photos in ZIPs. Take an overall tree/shrub view, flower close-up, and leaf/attachment detail per stop. Extract coordinates and timestamps, group photos of each plant, confirm public-footpath viewing points, check identifications and only then connect stops into a pedestrian route. Do not draw straight lines through property or invent stops, walking distances, access conditions or flowering dates. Revisit the data structure when the multi-stop collection arrives.

## References

- https://www.rhs.org.uk/plants/62796/prunus-%C3%97-blireana-d/details
- https://landscapeplants.oregonstate.edu/plants/prunus-blireiana

These support candidate plant characteristics, not definitive identification of the photographed specimen. Map attribution remains visible inside the Leaflet map.

Leaflet 1.9.4 JS/CSS are vendored from unpkg.com, with the upstream BSD-2-Clause licence. Tiles load on demand only; no prefetch, bulk download or offline tile cache. The map uses a numbered HTML marker and needs no WebGL.
