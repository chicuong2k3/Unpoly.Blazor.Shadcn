#!/usr/bin/env python3
"""Fails when ui.css is missing a part of shadcn's globals that is not a token.

Most of shadcn's globals.css is variables, and this port reproduces those carefully. The rest of
it is two rules that are easy to read past and that nothing else compensates for — and both were
missing for months, in ways that looked like taste rather than like bugs:

  @custom-variant dark   Tailwind v4's stock `dark:` compiles to a prefers-color-scheme query.
                         Without redefining it against the class, every `dark:` utility in every
                         component answers to the operating system while the palette answers to
                         the class. On a machine whose OS matches the page, that is invisible.

  border-color on *      Preflight leaves `currentColor`, so `border-b` with no colour class
                         draws a line in the TEXT colour. Every table row, every accordion item
                         and every panel edge was a near-black hairline, which reads as "heavier
                         than shadcn" rather than as a mistake.

Checking the source rather than the built stylesheet, because CI does not run Tailwind — but the
built file is where the proof is, and `grep 'prefers-color-scheme' app.css` should find nothing.

    python tools/check_globals.py           # report
    python tools/check_globals.py --check   # CI
"""
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
UI = ROOT / 'src' / 'Unpoly.Blazor.Shadcn' / 'Styles' / 'ui.css'

REQUIRED = [
    (re.compile(r'@custom-variant\s+dark\s*\('),
     '@custom-variant dark — without it every `dark:` utility follows the OS, not the .dark class'),
    (re.compile(r'@layer\s+base\s*\{[^}]*?border-color:\s*var\(--border\)', re.S),
     'a base layer setting border-color: var(--border) on * — without it an uncoloured '
     'border draws in the text colour'),
    (re.compile(r'outline-color:\s*color-mix\([^)]*--ring', re.S),
     'a base outline-color from --ring, so a focus ring is the theme\'s and not the browser\'s'),
]


def main() -> int:
    css = UI.read_text(encoding='utf-8')
    missing = [why for pattern, why in REQUIRED if not pattern.search(css)]

    for why in missing:
        print(f'ui.css is missing {why}', file=sys.stderr)

    if missing:
        print(f'\n{len(missing)} of shadcn\'s globals are not reproduced. They are not optional: '
              f'each one is silent when wrong.', file=sys.stderr)
        return 1

    print(f'ui.css reproduces all {len(REQUIRED)} non-token rules from shadcn\'s globals')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
