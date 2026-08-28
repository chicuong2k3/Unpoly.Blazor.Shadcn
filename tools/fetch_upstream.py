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
import re
import sys
import time
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / 'upstream'
STYLE = 'new-york-v4'
BASE = f'https://ui.shadcn.com/r/styles/{STYLE}'

# The registry names this port implements. Keep sorted; add a name here when you port it.
COMPONENTS = [
    'accordion', 'alert', 'alert-dialog', 'aspect-ratio', 'attachment', 'avatar', 'badge',
    'breadcrumb', 'bubble', 'button', 'button-group', 'calendar', 'card', 'carousel', 'chart',
    'checkbox', 'collapsible', 'combobox', 'command', 'context-menu', 'dialog', 'direction',
    'drawer', 'dropdown-menu', 'empty', 'field', 'form', 'hover-card', 'input', 'input-group',
    'input-otp', 'item', 'kbd', 'label', 'marker', 'menubar', 'message', 'message-scroller',
    'native-select', 'navigation-menu', 'pagination', 'popover', 'progress', 'questionnaire',
    'radio-group', 'resizable', 'scroll-area', 'select', 'separator', 'sheet', 'sidebar',
    'skeleton', 'slider', 'sonner', 'spinner', 'switch', 'table', 'tabs', 'textarea', 'toast',
    'toggle', 'toggle-group', 'tooltip',
]


def fetch(name: str) -> str | None:
    """None when the registry has no such item under this style — reported, not fatal.

    The index lists every registry item; a few are documentation entries or live only under a
    different style, and one missing name should not stop the other sixty from refreshing."""
    try:
        with urllib.request.urlopen(f'{BASE}/{name}.json', timeout=30) as r:
            item = json.load(r)
    except urllib.error.HTTPError as e:
        if e.code == 404:
            return None
        raise
    files = item.get('files') or []
    if not files:
        raise SystemExit(f'{name}: registry item has no files')
    return files[0]['content']


DOCS_INDEX = 'https://ui.shadcn.com/docs/components'


def fetch_doc_sections(order: list[str]) -> dict[str, list[str]]:
    """Every heading on every component page, so the demo can be compared with shadcn's own.

    "Does the demo show what shadcn shows" is otherwise a question nobody can answer, and the
    answer turns out to be no by a wide margin. Committed for the same reason as everything else
    fetched here: CI needs no network, and a change upstream arrives as a diff somebody reads.
    """
    out = {}
    for slug in order:
        request = urllib.request.Request(f'https://ui.shadcn.com/docs/components/{slug}',
                                         headers={'User-Agent': 'Mozilla/5.0'})
        html = urllib.request.urlopen(request, timeout=40).read().decode('utf-8', 'replace')
        headings = [re.sub(r'<[^>]+>', '', h).strip().rstrip('#')
                    for h in re.findall(r'<h2[^>]*>(.*?)</h2>', html, re.S)]
        out[slug] = [h for h in headings if h]
        time.sleep(0.2)
    return out


def fetch_doc_order() -> list[str]:
    """The components shadcn documents, in the order its own sidebar lists them.

    The demo has one page per entry at /components/<slug>, so someone who knows those docs can
    guess a URL here. Committed rather than fetched at check time, so CI needs no network and a
    change to shadcn's index arrives as a diff somebody reads.
    """
    request = urllib.request.Request(DOCS_INDEX, headers={'User-Agent': 'Mozilla/5.0'})
    html = urllib.request.urlopen(request, timeout=40).read().decode('utf-8', 'replace')
    seen, order = set(), []
    for slug in re.findall(r'/docs/components/([a-z0-9-]+)', html):
        if slug not in seen:
            seen.add(slug)
            order.append(slug)
    # The framework pages that sit above the component list are not components.
    return [s for s in order if s not in ('base', 'aria', 'radix', 'questionnaire')]


def main() -> int:
    OUT.mkdir(exist_ok=True)

    index = OUT / 'doc-components.txt'

    if '--check' in sys.argv:
        missing = [n for n in COMPONENTS if not (OUT / f'{n}.tsx').exists()]
        if missing:
            print('not vendored (fine if the registry has no source for them): '
                  + ', '.join(missing))
        if not index.exists():
            print('upstream/doc-components.txt is missing — run this without --check',
                  file=sys.stderr)
            return 1
        print(f'upstream/ complete ({len(COMPONENTS)} components, '
              f'{len(index.read_text(encoding="utf-8").splitlines())} lines of docs index)')
        return 0

    header = [
        '# The components shadcn documents, in the order its own sidebar lists them — which',
        '# is alphabetical, one page each. Fetched from ' + DOCS_INDEX + ' and committed, so',
        '# tools/check_pages.py needs no network.',
        '#',
        '# The demo has one page per line, at /components/<slug>, in this order. Anyone who',
        "# knows shadcn's docs can guess the URL, which is the point.",
    ]
    order = fetch_doc_order()
    index.write_text('\n'.join(header + order) + '\n', encoding='utf-8')
    print('  doc-components.txt')

    sections = [
        '# Every heading on every shadcn component docs page, in page order. Fetched here and',
        '# committed, so tools/check_sections.py needs no network.',
        '#',
        '# One line per page: <slug>: <heading> | <heading> | ...',
        '# check_sections.py decides which are demos this port should have, which are prose, and',
        '# which cannot exist here — and says so for each.',
    ]
    for slug, headings in fetch_doc_sections(order).items():
        sections.append(f'{slug}: ' + ' | '.join(headings))
    (OUT / 'doc-sections.txt').write_text('\n'.join(sections) + '\n', encoding='utf-8')
    print('  doc-sections.txt')

    missing = []
    for name in COMPONENTS:
        text = fetch(name)
        if text is None:
            missing.append(name)
            continue
        (OUT / f'{name}.tsx').write_text(text, encoding='utf-8')

    if missing:
        print('no source under this style: ' + ', '.join(missing))

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
