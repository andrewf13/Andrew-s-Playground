"""Build The Long Fall into a single offline HTML file. Python standard library only."""
from pathlib import Path
root = Path(__file__).resolve().parent
shell = (root / 'shell.html').read_text()
for marker, name in (('<!-- SIM -->', 'sim.js'), ('<!-- AUDIO -->', 'audio.js'), ('<!-- APP -->', 'app.js')):
    shell = shell.replace(marker, '<script>\n' + (root / name).read_text() + '\n</script>')
target = root.parent.parent / 'artifacts' / 'the-long-fall.html'
target.write_text(shell)
print(f'Built {target.name}: {target.stat().st_size:,} bytes')
