#!/usr/bin/env python3
"""Vendors the shadcn/ui source this port claims parity with.

Parity asserted against a class string someone typed from memory is not parity — it is the same
memory twice. So the upstream .tsx files are downloaded from shadcn's own registry and committed
under upstream/, and the parity tests read those. Reviewing a version bump is then a diff of real
source, and the test suite never needs the network.

    python tools/fetch_upstream.py            # refresh upstream/
    python tools/fetch_upstream.py --check    # CI: fail if upstream/ is missing anything
"""
import json
import pathlib
import sys
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / 'upstream'
STYLE = 'new-york-v4'
BASE = f'https://ui.shadcn.com/r/styles/{STYLE}'

# The registry names this port implements. Keep sorted; add a name here when you port it.
COMPONENTS = [
    'accordion', 'alert', 'alert-dialog', 'avatar', 'badge', 'breadcrumb', 'button', 'card',
    'checkbox', 'dialog', 'dropdown-menu', 'form', 'input', 'label', 'pagination', 'progress',
    'radio-group', 'select', 'separator', 'skeleton', 'switch', 'table', 'tabs', 'textarea',
    'tooltip',
]


def fetch(name: str) -> str:
    with urllib.request.urlopen(f'{BASE}/{name}.json', timeout=30) as r:
        item = json.load(r)
    files = item.get('files') or []
    if not files:
        raise SystemExit(f'{name}: registry item has no files')
    return files[0]['content']


def main() -> int:
    OUT.mkdir(exist_ok=True)

    if '--check' in sys.argv:
        missing = [n for n in COMPONENTS if not (OUT / f'{n}.tsx').exists()]
        if missing:
            print('upstream/ is missing: ' + ', '.join(missing), file=sys.stderr)
            return 1
        print(f'upstream/ complete ({len(COMPONENTS)} components)')
        return 0

    for name in COMPONENTS:
        text = fetch(name)
        (OUT / f'{name}.tsx').write_text(text, encoding='utf-8')
        print(f'  {name}.tsx  ({len(text)} bytes)')

    (OUT / 'README.md').write_text(
        '# Vendored shadcn/ui source\n\n'
        f'Style `{STYLE}`, downloaded from {BASE} by `tools/fetch_upstream.py`.\n\n'
        'These files are **not compiled and not shipped**. They exist so the parity tests compare\n'
        'against real upstream source rather than against a class string someone retyped, and so a\n'
        'version bump is reviewable as a diff. MIT, © shadcn.\n',
        encoding='utf-8')

    print(f'wrote {len(COMPONENTS)} files to upstream/')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
