"""Package the module without local tests, attachments, or platform metadata."""
from pathlib import Path
import json
import zipfile
root = Path(__file__).resolve().parent
module = root / 'echo-knight'
manifest = json.loads((module / 'module.json').read_text())
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
