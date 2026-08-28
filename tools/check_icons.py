#!/usr/bin/env python3
"""Fails when shadcn draws an icon inside a component and this port does not.

Several components are mostly an icon: the chevron on a select, the dash between two groups of
one-time-code boxes, the tick beside a chosen row, the X on a dialog. Nothing checked for them —
class parity compares the class list of an element that renders nothing, and passes — so
InputOTPSeparator shipped as an empty div and the gap where a dash should be looked deliberate.

Read from the upstream function bodies: a lucide component is `<SomethingIcon` or one of the
handful shadcn imports under a bare name, and the slot is whatever data-slot that function
renders. Ours has to answer with an <Icon>, an inline <svg>, or a CSS mask named in MASKED.

    python tools/check_icons.py           # report
    python tools/check_icons.py --check   # CI
"""
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
UPSTREAM = ROOT / 'upstream'
COMPONENTS = ROOT / 'src' / 'Unpoly.Blazor.Shadcn' / 'Components'

FUNCTION = re.compile(r'\nfunction\s+(\w+)\s*\(')
SLOT = re.compile(r'data-slot="([\w-]+)"')
# lucide-react exports every icon with an Icon suffix in the version shadcn pins.
LUCIDE = re.compile(r'<([A-Z]\w*Icon)\b')

# Slots whose glyph is drawn by CSS rather than by an element, with what draws it. A mask on a
# pseudo-element is how a checkbox tick scales with its box and inherits its colour, which a
# child <svg> cannot do.
MASKED = {
    'checkbox': '--sh-check / --sh-minus on ::after, in ui.behavior.css',
    'checkbox-indicator': 'the same, and the indicator has no element here',
    'radio-group-item': 'a dot on ::after',
    'radio-group-indicator': 'the same',
    'select': 'the native control draws its own arrow; ui.behavior.css replaces it with --sh-chevron-down',
    'select-trigger': 'the native <select> is the trigger',
    'select-scroll-up-button': 'the OS scrolls its own panel',
    'select-scroll-down-button': 'the OS scrolls its own panel',
    'sidebar-menu-skeleton': 'the icon is a <Skeleton>, not a glyph',
    'input-otp-slot': 'the caret is the browser\'s; upstream paints its own',
    'command-input': 'the search icon is on the wrapper, which is where upstream puts it too',
    'select-item': 'an <option> cannot hold an element; the native control draws its own tick',
    # The three menu families all put a real input in the row and let it draw its own glyph,
    # which is what makes the row post with the form it is in.
    'dropdown-menu-checkbox-item': 'a real <Checkbox>, whose tick is a mask on ::after',
    'dropdown-menu-radio-item': 'a real <RadioGroupItem>, whose dot is ::after',
    'context-menu-checkbox-item': 'the same',
    'context-menu-radio-item': 'the same',
    'menubar-checkbox-item': 'the same',
    'menubar-radio-item': 'the same',
}


# A component may draw its icon through one of ours rather than directly — <ComboboxTrigger>
# renders <ComboboxTriggerIcon>, which is where the chevron is. Follow one level of that, which is
# as deep as shadcn ever nests it.
OURS_TAG = re.compile(r'<([A-Z]\w+)[\s/>]')


def draws_an_icon(source: str, by_slot: dict, depth: int = 1) -> bool:
    if '<Icon ' in source or '<svg' in source:
        return True
    if depth == 0:
        return False
    names = {name for entries in by_slot.values() for name, _ in entries}
    for tag in set(OURS_TAG.findall(source)) & names:
        for name, src in [e for entries in by_slot.values() for e in entries]:
            if name == tag and draws_an_icon(src, by_slot, depth - 1):
                return True
    return False


def main() -> int:
    ours = {}
    for path in COMPONENTS.glob('*.razor'):
        source = path.read_text(encoding='utf-8')
        for slot in set(SLOT.findall(source)):
            ours.setdefault(slot, []).append((path.stem, source))

    problems = []
    checked = 0
    for path in sorted(UPSTREAM.glob('*.tsx')):
        text = path.read_text(encoding='utf-8')
        bounds = [(m.group(1), m.start()) for m in FUNCTION.finditer(text)] + [('', len(text))]
        for i in range(len(bounds) - 1):
            body = text[bounds[i][1]:bounds[i + 1][1]]
            icons = set(LUCIDE.findall(body))
            slots = SLOT.findall(body)
            if not icons or not slots:
                continue
            slot = slots[0]
            if slot in MASKED or slot not in ours:
                continue
            checked += 1
            drawn = any(draws_an_icon(src, ours) for _, src in ours[slot])
            if not drawn:
                names = ', '.join(sorted(icons))
                who = ', '.join(name for name, _ in ours[slot])
                problems.append(f'{who}: shadcn draws {names} inside [data-slot={slot}] '
                                f'and this renders none')

    for line in sorted(set(problems)):
        print(line, file=sys.stderr)

    if problems:
        print(f'\n{len(set(problems))} components are missing an icon shadcn draws. Render it, or '
              f'add the slot to MASKED with what draws it instead.', file=sys.stderr)
        return 1

    print(f'{checked} components that draw an icon upstream draw one here '
          f'({len(MASKED)} drawn by CSS instead, each named)')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
