#!/usr/bin/env python3
"""Fails when a component styles a side by the screen instead of by the reading direction.

AccordionTrigger said `text-left`. Under dir="rtl" that left-aligns Arabic inside a
right-to-left row, and nothing caught it because the class is upstream's own — parity passed,
the demo rendered, and it looked like a font problem. It was one of forty.

A class that names a physical side is fine only when the SIDE ITSELF is the thing being named:
Sheet side="left", Sidebar data-side, Drawer direction. Everywhere else the reader's start and
end are what is meant, and Tailwind spells those ps/pe, ms/me, start/end, border-s/border-e,
rounded-s/rounded-e, text-start/text-end.

    python tools/check_rtl.py           # the report
    python tools/check_rtl.py --check   # CI: non-zero when something is unaccounted for
"""
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
COMPONENTS = ROOT / 'src' / 'Unpoly.Blazor.Shadcn' / 'Components'

TOKEN = re.compile(r'[^\s"]+')
SIZE = r'(?:-[\w./\[\]%()*+-]+)?'
PHYSICAL = re.compile(
    r'^-?(?:'
    r'ml' + SIZE + r'|mr' + SIZE + r'|pl' + SIZE + r'|pr' + SIZE + r'|'
    r'left' + SIZE + r'|right' + SIZE + r'|'
    r'scroll-ml' + SIZE + r'|scroll-mr' + SIZE + r'|'
    r'scroll-pl' + SIZE + r'|scroll-pr' + SIZE + r'|'
    r'border-l(?:-[\w./\[\]%()-]+)?|border-r(?:-[\w./\[\]%()-]+)?|'
    r'rounded-l(?:-[\w./\[\]%()-]+)?|rounded-r(?:-[\w./\[\]%()-]+)?|'
    r'rounded-tl(?:-[\w./\[\]%()-]+)?|rounded-tr(?:-[\w./\[\]%()-]+)?|'
    r'rounded-bl(?:-[\w./\[\]%()-]+)?|rounded-br(?:-[\w./\[\]%()-]+)?|'
    r'text-left|text-right|origin-left|origin-right'
    r')$')

# Words that only look physical: a radius size, a ring colour.
LOOKALIKE = re.compile(r'^-?(?:rounded-lg|border-ring)$')

# Components whose API names the side, so a physical class is the correct one. The reason is
# the point: without it this list is a way of hiding the bug rather than deciding about it.
NAMED_SIDE = {
    'Sheet.razor': 'Side is "left" | "right" | "top" | "bottom" — the caller names the edge',
    'Sidebar.razor': 'data-side, same as Sheet; a left sidebar stays left in Arabic too',
    'SidebarRail.razor': 'positions itself against whichever side the sidebar is on',
    'Drawer.razor': "vaul's direction, which is a physical edge by definition",
}

# Individual classes that are correct as they stand, with the reason. Same rule as everywhere
# else here: a class allowed through is a decision somebody made, not a gap.
INTENTIONAL = {
    ('ResizableHandle.razor', 'aria-[orientation=horizontal]:after:left-0'):
        'paired with after:w-full — the hit strip spans both edges, so there is no side to flip',
}

# Individual classes that are symmetric — they centre something, or span both edges — so there
# is no logical form and nothing to flip.
SYMMETRIC = re.compile(
    r'^(?:'
    r'(?:[\w:\-\[\]&>*.,=^$~/#()\'"+%]*:)?'
    r'(?:left-1/2|right-1/2|-left-1/2|-right-1/2|inset-x-[\w./\[\]%()-]+)'
    r')$')


def utility(token: str) -> str:
    """Strip the variants: split on ':' outside brackets and take the last piece."""
    depth, last = 0, 0
    for i, ch in enumerate(token):
        if ch == '[':
            depth += 1
        elif ch == ']':
            depth -= 1
        elif ch == ':' and depth == 0:
            last = i + 1
    return token[last:]


def main() -> int:
    problems, checked = [], 0

    for path in sorted(COMPONENTS.glob('*.razor')):
        if path.name in NAMED_SIDE:
            continue
        text = path.read_text(encoding='utf-8')
        for quoted in re.findall(r'"([^"]*)"', text):
            # A whole string that is one bare side word is an attribute value — data-side="right"
            # — not a class list. Its only effect is which way the panel slides in.
            if quoted in ('left', 'right', 'top', 'bottom'):
                continue
            for token in TOKEN.findall(quoted):
                checked += 1
                if SYMMETRIC.match(token) or (path.name, token) in INTENTIONAL:
                    continue
                u = utility(token)
                if PHYSICAL.match(u) and not LOOKALIKE.match(u):
                    problems.append((path.name, token))

    for name, token in sorted(set(problems)):
        print(f'  {name}: {token} — say it in reading order (ps/pe, ms/me, start/end, '
              f'border-s/border-e, rounded-s/rounded-e, text-start)', file=sys.stderr)

    if problems:
        print(f'\n{len(set(problems))} classes name a side by the screen rather than by the '
              f'reading direction.', file=sys.stderr)
        return 1

    print(f'{checked} classes checked; every side is named in reading order '
          f'({len(NAMED_SIDE)} components name a physical side on purpose and '
          f'{len(INTENTIONAL)} single classes are allowed through, each with a reason)')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
