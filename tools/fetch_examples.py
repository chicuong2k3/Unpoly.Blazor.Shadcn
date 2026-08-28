#!/usr/bin/env python3
"""Vendors the source of every example shadcn shows on its component docs pages.

upstream/*.tsx is component source, which says what a component *is*. It says nothing about
what shadcn's own demo of it looks like — and "this doesn't look like shadcn" was a report
nobody could check, because the only reference was a screenshot in somebody's memory. With the
real example source committed, it is a diff.

The examples live in shadcn's repo under apps/v4/examples/base/, which is the set the docs
render (styleName="base-nova"). Which example belongs to which page comes from the page's own
markdown, where each is named by a <ComponentPreview name="...">.

    python tools/fetch_examples.py            # refresh upstream/examples/
    python tools/fetch_examples.py --check    # CI: fail if a named example is not vendored
"""
import json
import pathlib
import re
import sys
import time
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parent.parent
INDEX = ROOT / 'upstream' / 'doc-components.txt'
OUT = ROOT / 'upstream' / 'examples'
NAMES = ROOT / 'upstream' / 'doc-examples.txt'

REPO = 'shadcn-ui/ui'
DIR = 'apps/v4/examples/base'
RAW = f'https://raw.githubusercontent.com/{REPO}/main/{DIR}'

# Next embeds the page's markdown in its flight payload, as a series of string literals. The
# literal must be SCANNED, not matched non-greedily: these payloads contain escaped quotes, and
# ".*?" stops at the first one inside.
PUSH = re.compile(r'self\.__next_f\.push\(\[1,("(?:[^"\\]|\\.)*")\]\)', re.S)
# The lookbehind matters: without it styleName="base-nova" matches too, and every page reports
# one example called base-nova while the real names are lost.
PREVIEW = re.compile(r'<ComponentPreview[^/]*?(?<![A-Za-z])name="([a-z0-9-]+)"', re.S)


def get(url: str) -> bytes:
    request = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    return urllib.request.urlopen(request, timeout=60).read()


def available() -> set[str]:
    """One tree call rather than 500 probes — and it tells us what exists before we ask."""
    tree = json.loads(get(f'https://api.github.com/repos/{REPO}/git/trees/main?recursive=1'))
    if tree.get('truncated'):
        raise SystemExit('the repo tree came back truncated; this needs a narrower request')
    return {p.split('/')[-1][:-4] for x in tree['tree']
            if (p := x['path']).startswith(DIR + '/') and p.endswith('.tsx')}


def named(slug: str) -> list[str]:
    """The examples the page asks for, in order. Read from the flight stream rather than the
    HTML: in the HTML the markdown is still escaped and the angle brackets are \u003c."""
    html = get(f'https://ui.shadcn.com/docs/components/{slug}').decode('utf-8', 'replace')
    stream = ''.join(json.loads(p) for p in PUSH.findall(html))
    seen, order = set(), []
    for name in PREVIEW.findall(stream):
        if name not in seen:
            seen.add(name)
            order.append(name)
    return order


def slugs() -> list[str]:
    return [l.strip() for l in INDEX.read_text(encoding='utf-8').splitlines()
            if l.strip() and not l.startswith('#')]


def check() -> int:
    if not NAMES.exists():
        print('upstream/doc-examples.txt is missing — run this without --check', file=sys.stderr)
        return 1
    missing = []
    for line in NAMES.read_text(encoding='utf-8').splitlines():
        if not line.strip() or line.startswith('#'):
            continue
        slug, rest = line.split(':', 1)
        for name in rest.split():
            if not (OUT / f'{name}.tsx').exists():
                missing.append(f'{slug}/{name}')
    if missing:
        print(f'{len(missing)} named examples are not vendored: ' + ', '.join(missing[:8]),
              file=sys.stderr)
        return 1
    print(f'upstream/examples/ complete ({len(list(OUT.glob("*.tsx")))} example files)')
    return 0


def main() -> int:
    if '--check' in sys.argv:
        return check()

    OUT.mkdir(parents=True, exist_ok=True)
    for old in OUT.glob('*.tsx'):
        old.unlink()

    have = available()
    lines = [
        '# Every example shadcn renders on a component docs page, in page order. The source of',
        f'# each is vendored under examples/, from {REPO}/{DIR}.',
        '#',
        '# One line per page: <slug>: <example> <example> ...',
    ]
    absent = []
    for slug in slugs():
        wanted = named(slug)
        for name in wanted:
            if name in have and not (OUT / f'{name}.tsx').exists():
                (OUT / f'{name}.tsx').write_bytes(get(f'{RAW}/{name}.tsx'))
            elif name not in have:
                absent.append(f'{slug}/{name}')
        lines.append(f'{slug}: ' + ' '.join(n for n in wanted if n in have))
        time.sleep(0.2)

    NAMES.write_text('\n'.join(lines) + '\n', encoding='utf-8')
    if absent:
        print(f'{len(absent)} named examples have no file in the repo: ' + ', '.join(absent[:8]))
    print(f'wrote {len(list(OUT.glob("*.tsx")))} example files to upstream/examples/')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
