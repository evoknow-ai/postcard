"""Check a candidate ZIP against the exact runtime files in this checkout; never extract it."""
import sys
import zipfile
from pathlib import Path

root = Path(__file__).resolve().parent.parent
excluded = {'.git', '.github', '.qa', 'node_modules', 'tests', 'scripts', 'docs'}
expected = {
    p.relative_to(root).as_posix(): p
    for p in root.rglob('*')
    if p.is_file()
    and not set(p.relative_to(root).parts).intersection(excluded)
    and p.name not in {'.gitignore', 'AGENTS.md', 'README.md'}
}
errors = []
try:
    with zipfile.ZipFile(sys.argv[1]) as archive:
        names = [i.filename for i in archive.infolist() if not i.is_dir()]
        if len(names) != len(set(names)):
            errors.append('ZIP contains duplicate entries.')
        for name, local in expected.items():
            if name not in names:
                errors.append('Missing runtime file: ' + name)
            elif archive.read(name) != local.read_bytes():
                errors.append('Runtime file differs from source: ' + name)
        for name in names:
            if name not in expected and Path(name).suffix.lower() in {'.js', '.mjs', '.cjs', '.wasm', '.html', '.css', '.tflite'} and not name.startswith(('tests/', 'scripts/')):
                errors.append('Unexpected runtime file: ' + name)
except (OSError, zipfile.BadZipFile, KeyError) as error:
    errors.append(str(error))
for error in errors:
    print(error)
sys.exit(1 if errors else 0)
