"""Package the module without local tests, attachments, or platform metadata."""
from pathlib import Path
import json
import zipfile
root = Path(__file__).resolve().parent
module = root / 'echo-knight'
manifest = json.loads((module / 'module.json').read_text())
# V11 reads the bundled newline-delimited compendium database on module load.
features = json.loads((module / 'data/features.json').read_text())
items = []
for f in features:
    system = {
        'description': {'value': f['description'], 'chat': '', 'unidentified': ''},
        'source': 'Echo Knight',
        'type': {'value': 'class', 'subtype': ''},
        'requirements': f['requirements'], 'identifier': f['identifier'],
        'activation': {'type': f['activation'], 'cost': 1, 'condition': ''},
        'range': {'value': 15 if f['action'] == 'manifest' else None, 'long': None,
                  'units': 'ft' if f['action'] == 'manifest' else 'self'},
        'target': {'value': None, 'width': None, 'units': '', 'type': 'self'},
        'duration': {'value': None, 'units': 'inst'},
        'uses': {'value': None, 'max': '', 'per': None, 'recovery': ''},
        'consume': {'type': '', 'target': None, 'amount': None},
        'ability': '', 'actionType': 'other', 'attackBonus': '', 'chatFlavor': '',
        'critical': {'threshold': None, 'damage': ''},
        'damage': {'parts': [], 'versatile': ''}, 'formula': '',
        'save': {'ability': '', 'dc': None, 'scaling': 'spell'},
        'recharge': {'value': None, 'charged': True}
    }
    items.append({'_id': f['id'], 'name': f['name'], 'type': 'feat', 'img': f['img'],
                  'system': system, 'effects': [], 'flags': {'echo-knight': {'action': f['action']}}})
pack = module / 'packs/echo-knight-features.db'
pack.parent.mkdir(exist_ok=True)
pack.write_text(''.join(json.dumps(item, separators=(',', ':')) + '\n' for item in items))
output = root / 'dist' / f"echo-knight-{manifest['version']}-foundry-v11.zip"
output.parent.mkdir(exist_ok=True)
with zipfile.ZipFile(output, 'w', zipfile.ZIP_DEFLATED) as archive:
    for file in sorted(module.rglob('*')):
        if file.is_file() and not file.name.startswith('.'):
            archive.write(file, file.relative_to(root))
with zipfile.ZipFile(output) as archive:
    assert archive.testzip() is None
    assert 'echo-knight/module.json' in archive.namelist()
print(output)
