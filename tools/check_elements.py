#!/usr/bin/env python3
"""Fails when a component renders a different HTML element than shadcn does.

The class strings are compared already, and the ARIA is pinned by tests. What nothing checked is
the element itself — and a <div> where shadcn writes a <span> changes the layout (block versus
inline), the default role, and what is legal inside it. It is the kind of drift that looks fine
in a screenshot and is wrong in a paragraph.

Only slots whose upstream element is a plain HTML tag are compared. A Radix primitive is a
decision this port makes for itself, and scaffold_components.py already reports those.

    python tools/check_elements.py           # report
    python tools/check_elements.py --check   # CI
"""
import json
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
COMPONENTS = ROOT / 'src' / 'Unpoly.Blazor.Shadcn' / 'Components'
CLASSES = ROOT / 'tests' / 'Unpoly.Blazor.Shadcn.Tests' / 'upstream-classes.json'
DEVIATIONS = ROOT / 'deviations.json'

# The element a slot is written on, taken from the first tag that carries it.
ON_SLOT = re.compile(r'<([a-zA-Z][\w-]*)((?:\s+[^<>]*?)?)\bdata-slot="([\w-]+)"', re.S)


def main() -> int:
    upstream = json.loads(CLASSES.read_text(encoding='utf-8'))
    dev = json.loads(DEVIATIONS.read_text(encoding='utf-8'))
    allowed = {k: v for k, v in dev.get('element', {}).items() if not k.startswith('$')}

    problems = []
    checked = 0
    for path in sorted(COMPONENTS.glob('*.razor')):
        source = path.read_text(encoding='utf-8')
        for m in ON_SLOT.finditer(source):
            ours, slot = m.group(1), m.group(3)
            entry = upstream.get(slot)
            theirs = (entry or {}).get('element')
            # Not a plain tag upstream: a Radix primitive or a component of shadcn's own.
            if not theirs or not theirs[:1].islower():
                continue
            checked += 1
            if ours.lower() == theirs.lower():
                continue
            if allowed.get(slot):
                continue
            problems.append(f'{path.stem}: renders <{ours}> where shadcn writes <{theirs}> '
                            f'(slot {slot})')

    for line in sorted(set(problems)):
        print(line, file=sys.stderr)

    if problems:
        print(f'\n{len(set(problems))} elements differ from shadcn. Change the tag, or record it '
              f'in deviations.json under "element" with the reason.', file=sys.stderr)
        return 1

    print(f'{checked} slots: every element matches shadcn '
          f'({len(allowed)} deliberate differences, each with a reason)')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
