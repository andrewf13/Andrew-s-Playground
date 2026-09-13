"""Build the self-contained flower-tour HTML. Run from any directory."""
from pathlib import Path
import base64
from urllib.parse import urlencode

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent
lat, lon = -33.83263829972222, 151.2027032
page = (HERE / 'shell.html').read_text()
for key, name in [('PHOTO', 'hazelbank-photo.webp'), ('ILLUSTRATION', 'hazelbank-illustration.webp')]:
    data = base64.b64encode((HERE / 'assets' / name).read_bytes()).decode()
    page = page.replace('@@' + key + '@@', 'data:image/webp;base64,' + data)
for key, name in [('LEAFLET_CSS', 'leaflet.css'), ('LEAFLET_JS', 'leaflet.js')]:
    vendor = (HERE / name).read_text()
    vendor = vendor.replace('//# sourceMappingURL=leaflet.js.map', '')
    page = page.replace('@@' + key + '@@', vendor)
directions = 'https://www.google.com/maps/dir/?' + urlencode({'api': '1', 'destination': f'{lat},{lon}', 'travelmode': 'walking'})
map_link = f'https://www.openstreetmap.org/?mlat={lat}&mlon={lon}#map=17/{lat}/{lon}'
for key, value in [('DIRECTIONS', directions), ('MAPLINK', map_link)]:
    page = page.replace('@@' + key + '@@', value.replace('&', '&amp;'))
assert '@@' not in page
out = ROOT / 'artifacts' / 'wollstonecraft-in-bloom.html'
out.write_text(page)
print(f'Built {out.name}: {out.stat().st_size:,} bytes')
