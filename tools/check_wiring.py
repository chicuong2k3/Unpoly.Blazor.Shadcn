#!/usr/bin/env python3
"""Fails when a component renders an interactive control that nothing operates.

AlertDialog shipped inert for as long as it has existed. The trigger rendered, the cancel button
rendered, and ui.js bound neither: its compiler selector said [data-slot="dialog-trigger"], and
an attribute selector is exact, so it never matched alert-dialog-trigger. No error, no warning —
you had to click it to find out.

An interactive slot has to be accounted for exactly one way:

  ui.js       its slot name appears in ui.js, so a compiler can select it
  attribute   it carries a behaviour attribute that ui.js selects on (data-dialog-close)
  native      the platform operates it: popovertarget, formmethod="dialog", <summary>, <a href>
  INERT       declared below, with the reason

    python tools/check_wiring.py           # the report
    python tools/check_wiring.py --check   # CI: non-zero when a control is unaccounted for
"""
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
COMPONENTS = ROOT / 'src' / 'Unpoly.Blazor.Shadcn' / 'Components'
UI_JS = ROOT / 'src' / 'Unpoly.Blazor.Shadcn' / 'wwwroot' / 'ui.js'

# What counts as a control. A slot ending in one of these is something a person clicks, and a
# thing a person clicks either does something or is a bug.
INTERACTIVE = ('-trigger', '-close', '-cancel', '-clear', '-remove', '-toggle')

# The platform doing the work. Each of these is a complete mechanism on its own.
NATIVE = (
    ('popovertarget', 'popovertarget opens the panel'),
    ('formmethod="dialog"', 'formmethod="dialog" closes the <dialog> it is in'),
    ('<summary', '<summary> is the native disclosure control'),
    ('commandfor', 'the invoker commands API'),
)

# Slots with no behaviour at all, and why. A control that does nothing on purpose is fine; a
# control that does nothing by accident is the bug this file exists for.
INERT = {
    'attachment-trigger': 'a link laid over the card — the anchor is the behaviour',
}


def js() -> str:
    return UI_JS.read_text(encoding='utf-8')


def hooks(script: str) -> set[str]:
    """Bare data- attributes ui.js selects on, e.g. [data-dialog-close], [data-sidebar-toggle].

    These let a component keep upstream's slot name and still say which behaviour it wants,
    which is the right way round: renaming a component should not change what it does."""
    found = set(re.findall(r'\[(data-[a-z-]+)\](?!=)', script))
    # data-slot is on every component in the library, so counting it as a hook would account for
    # everything and check nothing.
    return found - {'data-slot'}


def accounted(text: str, slot: str, script: str, attributes: set[str]) -> tuple[str, str] | None:
    if slot in INERT:
        return 'INERT', INERT[slot]
    if slot in script:
        return 'ui.js', 'named in ui.js'
    for attribute in sorted(attributes):
        if re.search(rf'\s{re.escape(attribute)}(?=[\s/>=])', text):
            return 'attribute', f'[{attribute}]'
    for marker, why in NATIVE:
        if marker in text:
            return 'native', why
    return None


def main() -> int:
    script = js()
    attributes = hooks(script)
    rows, unaccounted = [], []

    for path in sorted(COMPONENTS.glob('*.razor')):
        text = path.read_text(encoding='utf-8')
        for slot in sorted(set(re.findall(r'data-slot="([a-z0-9-]+)"', text))):
            if not slot.endswith(INTERACTIVE):
                continue
            how = accounted(text, slot, script, attributes)
            if how is None:
                unaccounted.append((slot, path.name))
            else:
                rows.append((slot, *how))

    if '--verbose' in sys.argv:
        for slot, how, why in rows:
            print(f'{slot:28} {how:10} {why}')

    print(f'{len(rows)} interactive slots, all operated by something')
    for slot, name in unaccounted:
        print(f'  UNWIRED  {slot}  ({name}) — nothing in ui.js selects it and nothing native '
              f'operates it', file=sys.stderr)

    if unaccounted:
        print(f'\n{len(unaccounted)} controls do nothing when clicked.', file=sys.stderr)
        return 1 if '--check' in sys.argv else 1
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
