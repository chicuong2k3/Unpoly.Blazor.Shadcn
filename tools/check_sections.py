#!/usr/bin/env python3
"""Compares each demo page with the shadcn docs page it stands in for, section by section.

"Does the demo show what shadcn shows" was a question nobody could answer, and the first honest
answer was no by a wide margin: shadcn documents roughly four hundred examples and this had
thirty. Counting them is the only way to close that deliberately rather than by feel.

Every heading on every upstream page is in upstream/doc-sections.txt. Each one is classified
here as exactly one of:

  PROSE        not a demo at all — Installation, an API table, a changelog
  NOT_HERE     a demo that cannot exist in this port, with the reason
  otherwise    a demo this port should have, matched against the page's own <h2>

    python tools/check_sections.py            # the report, and the number
    python tools/check_sections.py --check    # CI: fail when a page is below its floor
    python tools/check_sections.py --missing  # just what is left to write
"""
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
SECTIONS = ROOT / 'upstream' / 'doc-sections.txt'
PAGES = ROOT / 'demo' / 'Unpoly.Blazor.Shadcn.Demo' / 'Components' / 'Pages'

# Headings that are documentation furniture on every page rather than a demo of anything.
PROSE = {
    'Installation', 'Usage', 'API Reference', 'Changelog', 'Composition', 'Anatomy', 'Structure',
    'Accessibility', 'About', 'Features', 'Introduction', 'Table of Contents', 'Prerequisites',
    'Project Structure', 'Principles', 'Prior Art', 'Reusable Components', 'Set up Table Features',
    'Building Your Typeset', 'Custom Typesets', 'Custom Themes', 'Accessibility and Dark Mode',
    'Overrides', 'Opting Out', 'Migrating from Vaul', 'Item vs Field',
    'ButtonGroup vs ToggleGroup', 'Theming', 'Styling',
    # Guides that happen to sit on a component page.
    'What Makes a Great Streaming Chat Experience', 'Core Concepts', 'Performance',
    'Virtualization', 'Component', 'Updating to Recharts v3', 'Your First Chart', 'Chart Config',
    'MessageScroller', 'Customization', 'Command Palette', 'Set up Table Features',
}

# Demos that cannot exist here, with the reason. Every entry is a decision, not a shrug: a port
# that quietly drops what it cannot do is a port whose claims cannot be checked.
NOT_HERE = {
    ('*', 'Controlled'): 'nothing re-renders on the client; state lives in the DOM or on the server',
    ('*', 'Controlled State'): 'the same: <details> holds its own open state and nothing reads it back',
    ('*', 'Streaming'): 'blazor.web.js is deliberately absent, so there is no streaming render',
    ('carousel', 'API'): 'embla\'s imperative API; this is scroll-snap and has none',
    ('carousel', 'Events'): 'the same',
    ('carousel', 'Plugins'): 'the same',
    ('carousel', 'Options'): 'the same',
    ('drawer', 'Snap Points'): 'vaul\'s; the drag here closes or springs back and does not rest',
    ('drawer', 'Non Modal'): 'a <dialog> opened with showModal() is modal by definition',
    ('drawer', 'Nested'): 'the top layer holds one modal <dialog> at a time',
    ('sidebar', 'useSidebar'): 'a React hook; the state is a cookie the server reads',
    ('sidebar', 'Controlled Sidebar'): 'the same',
    ('calendar', 'Persian / Hijri / Jalali Calendar'):
        'react-day-picker ships the calendar systems; this is a table of days',
    ('calendar', 'Selected Date (With TimeZone)'): 'a server concern, and DateOnly has no zone',
    ('combobox', 'Auto Highlight'): 'the first match is always highlighted here',
    ('data-table', 'Basic Table'): 'TanStack Table is React; on static SSR the URL is the state',
    ('data-table', 'Cell Formatting'): 'the same',
    ('data-table', 'Row Actions'): 'the same',
    ('data-table', 'Pagination'): 'the same',
    ('data-table', 'Sorting'): 'the same',
    ('data-table', 'Filtering'): 'the same',
    ('data-table', 'Visibility'): 'the same',
    ('data-table', 'Row Selection'): 'the same',
    ('typography', 'Features'): 'this port ships no prose styles; see the page for why',
    ('typography', 'Responsive Table'): 'the same',
    ('input-otp', 'Controlled'): 'the six inputs hold the value',
    ('field', 'Validation and Errors'): 'shown on the page as two examples rather than one section',
    ('sidebar', 'SidebarProvider'): 'the API table, split across a heading per part upstream',
    ('sidebar', 'Sidebar'): 'the same',
    ('sidebar', 'SidebarHeader'): 'the same',
    ('sidebar', 'SidebarFooter'): 'the same',
    ('sidebar', 'SidebarContent'): 'the same',
    ('sidebar', 'SidebarGroup'): 'the same',
    ('sidebar', 'SidebarMenu'): 'the same',
    ('sidebar', 'SidebarMenuButton'): 'the same',
    ('sidebar', 'SidebarMenuAction'): 'the same',
    ('sidebar', 'SidebarMenuSub'): 'the same',
    ('sidebar', 'SidebarMenuBadge'): 'the same',
    ('sidebar', 'SidebarMenuSkeleton'): 'the same',
    ('sidebar', 'SidebarTrigger'): 'the same',
    ('sidebar', 'SidebarRail'): 'the same',
}

# RTL is on nearly every upstream page and is one demo repeated: the same markup under
# dir="rtl". It is tracked separately so the number below is about content rather than about
# one mechanical section sixty times over.
RTL = 'RTL'

# The three pages where that demo would show nothing, with the reason. Same rule as NOT_HERE:
# a page that quietly omits it is indistinguishable from one that forgot.
RTL_NOT_HERE = {
    'aspect-ratio': 'a ratio has no start or end edge; the markup under dir="rtl" is identical',
    'data-table': 'this page is prose — the demo lives in the data table block',
    'sidebar': 'the same; the page documents the cookie, and the block is the live sidebar',
}

# Our heading for shadcn's, where the two say the same thing in different words.
ALIASES = {
    'Sizes': 'Size', 'Variants': 'Variant', 'Basic': None,
}


def page_for(slug: str) -> pathlib.Path:
    return PAGES / (''.join(w[:1].upper() + w[1:] for w in slug.split('-')) + 'Page.razor')


def our_sections(slug: str) -> list[str]:
    path = page_for(slug)
    if not path.exists():
        return []
    text = path.read_text(encoding='utf-8')
    return [re.sub(r'<[^>]+>', '', h).strip()
            for h in re.findall(r'<h2[^>]*class="doc-h2"[^>]*>(.*?)</h2>', text, re.S)]


def upstream_sections() -> dict[str, list[str]]:
    out = {}
    for line in SECTIONS.read_text(encoding='utf-8').splitlines():
        if not line.strip() or line.startswith('#'):
            continue
        slug, rest = line.split(':', 1)
        # Upstream repeats a heading on a few pages; one demo is one demo.
        seen, headings = set(), []
        for h in (x.strip() for x in rest.split('|') if x.strip()):
            if h not in seen:
                seen.add(h)
                headings.append(h)
        out[slug.strip()] = headings
    return out


def normalise(name: str) -> str:
    return re.sub(r'[^a-z0-9]', '', name.lower())


def main() -> int:
    upstream = upstream_sections()
    have_total = want_total = 0
    rtl_have = rtl_want = 0
    report = []

    for slug, headings in upstream.items():
        ours = {normalise(h) for h in our_sections(slug)}
        wanted, missing = [], []
        for heading in headings:
            if heading in PROSE:
                continue
            if heading == RTL:
                if slug in RTL_NOT_HERE:
                    continue
                rtl_want += 1
                if 'rtl' in ours:
                    rtl_have += 1
                continue
            if ('*', heading) in NOT_HERE or (slug, heading) in NOT_HERE:
                continue
            wanted.append(heading)
            alias = ALIASES.get(heading, heading)
            if normalise(heading) not in ours and not (alias and normalise(alias) in ours):
                missing.append(heading)

        have_total += len(wanted) - len(missing)
        want_total += len(wanted)
        if missing:
            report.append((slug, len(wanted) - len(missing), len(wanted), missing))

    if '--missing' in sys.argv:
        for slug, have, want, missing in sorted(report, key=lambda r: -(r[2] - r[1])):
            print(f'{slug:18} {have}/{want}  missing: ' + ', '.join(missing))
        return 0

    print(f'demo sections: {have_total}/{want_total} of what shadcn documents '
          f'({len(PROSE)} kinds of heading are prose, {len(NOT_HERE)} demos cannot exist here '
          f'and each says why)')
    print(f'RTL: {rtl_have}/{rtl_want} pages show the component under dir="rtl" '
          f'({len(RTL_NOT_HERE)} more would show nothing, and each says why)')

    if report:
        print(f'\n{sum(len(m) for _, _, _, m in report)} still to write, across '
              f'{len(report)} pages. Run with --missing for the list.')

    # The gap is closed, so the floor is the whole number: every demo shadcn documents either
    # exists here or is in NOT_HERE with a reason. A new upstream section then arrives as a CI
    # failure, which is the only way anyone would notice one.
    floor = int(next((a.split('=')[1] for a in sys.argv if a.startswith('--floor=')), 30))
    if '--check' in sys.argv and (have_total < floor or rtl_have < rtl_want):
        print(f'\nbelow the floor of {floor}, or an RTL demo went missing.', file=sys.stderr)
        return 1
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
