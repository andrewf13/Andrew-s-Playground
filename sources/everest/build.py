"""Build an offline, single-file Everest diorama. Python standard library only."""
from pathlib import Path
root = Path(__file__).resolve().parent
shell = (root / 'shell.html').read_text()
three = (root / 'three.min.js').read_text()
app = (root / 'app.js').read_text()
software = (root / 'software.js').read_text()
result = shell.replace('<!-- THREE -->', '<script>\n' + three + '\n</script>').replace('<!-- SOFTWARE -->', '<script>\n' + software + '\n</script>').replace('<!-- APP -->', '<script>\n' + app + '\n</script>')
target = root.parent.parent / 'artifacts' / 'everest-1996.html'
target.parent.mkdir(exist_ok=True)
target.write_text(result)
print(f'Built {target.name}: {target.stat().st_size:,} bytes')
