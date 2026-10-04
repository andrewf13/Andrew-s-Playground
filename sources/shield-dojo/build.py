"""Build the offline, single-file Shield Dojo: Remastered. Python standard library only."""
from pathlib import Path

root = Path(__file__).resolve().parent
shell = (root / 'shell.html').read_text()
three = (root / 'vendor' / 'three-tsl.js').read_text()
parts = ['spawner.js', 'sim.js', 'input.js', 'render/materials.js', 'render/scene.js', 'main.js']
app = '\n'.join((root / p).read_text() for p in parts)
result = (shell.replace('<!-- THREE -->', '<script>\n' + three + '\n</script>')
               .replace('<!-- APP -->', '<script>\n' + app + '\n</script>'))
target = root.parent.parent / 'artifacts' / 'shield-dojo-remastered.html'
target.parent.mkdir(exist_ok=True)
target.write_text(result)
print(f'Built {target.name}: {target.stat().st_size:,} bytes')
