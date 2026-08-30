#!/usr/bin/env python3
"""Fails when the demo's component pages do not match shadcn's docs, name for name and in order.

shadcn documents one component per page, alphabetically, at /docs/components/<slug>. This demo
does the same at /components/<slug>, so anyone who knows those docs can guess the URL here — and
that only stays true if something checks it. The list is upstream/doc-components.txt, fetched
from shadcn's own index by tools/fetch_upstream.py and committed, so this needs no network.

Three things are checked: every slug has a page, no page invents a component shadcn does not
document (this port's own additions are listed here by name), and the sidebar lists them in the
same order.

    python tools/check_pages.py           # report
    python tools/check_pages.py --check   # CI
"""
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
LIST = ROOT / 'upstream' / 'doc-components.txt'
DEMO = ROOT / 'demo' / 'Unpoly.Blazor.Shadcn.Demo' / 'Components'
PAGES = DEMO / 'Pages'
NAV = DEMO / 'Layout' / 'DocNav.razor'

# This port's own pages, which shadcn has no component for. Kept in their own group in the nav
# and named here, because pretending they are shadcn is the one thing this library must not do.
OURS = ['icon', 'code-block', 'stepper', 'file-upload', 'echarts', 'qr-code', 'steps', 'timeline', 'sparkline', 'map', 'image-compare']

# Pages that are not a component at all.
NOT_A_COMPONENT = {'/', '/theming', '/blocks'}


def main() -> int:
    wanted = [l.strip() for l in LIST.read_text(encoding='utf-8').splitlines()
              if l.strip() and not l.startswith('#')]

    routes = {}
    for path in PAGES.glob('*.razor'):
        m = re.search(r'@page "([^"]+)"', path.read_text(encoding='utf-8'))
        if m:
            routes[m.group(1)] = path.stem

    problems = []
    for slug in wanted:
        if f'/components/{slug}' not in routes:
            problems.append(f'no page for /components/{slug} — shadcn documents it')

    for route in sorted(routes):
        if route in NOT_A_COMPONENT:
            continue
        slug = route.removeprefix('/components/')
        if slug not in wanted and slug not in OURS:
            problems.append(f'{route} is a component shadcn does not document — either it is '
                            f'ours, and belongs in OURS here, or the route is wrong')

    # The nav lists them in shadcn's order, or the sidebar and the docs disagree about where to
    # look for something, which is the whole reason for doing this.
    nav = NAV.read_text(encoding='utf-8')
    listed = re.findall(r'"/components/([a-z0-9-]+)"', nav)
    in_shadcn = [s for s in listed if s in wanted]
    if in_shadcn != wanted:
        first = next((i for i, (a, b) in enumerate(zip(in_shadcn, wanted)) if a != b), None)
        where = (f'first difference at position {first}: nav says {in_shadcn[first]!r}, '
                 f'shadcn says {wanted[first]!r}') if first is not None else \
                f'nav lists {len(in_shadcn)}, shadcn documents {len(wanted)}'
        problems.append(f'DocNav is not in shadcn\'s order — {where}')

    for line in problems:
        print(line, file=sys.stderr)

    if problems:
        print(f'\n{len(problems)} differences from shadcn\'s docs index '
              f'(upstream/doc-components.txt).', file=sys.stderr)
        return 1

    print(f'{len(wanted)} component pages, named and ordered as shadcn documents them, '
          f'plus {len(OURS)} of this port\'s own')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
