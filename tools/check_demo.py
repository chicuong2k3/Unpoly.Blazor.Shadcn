#!/usr/bin/env python3
"""Fails when a component has nowhere in the demo that shows it.

A component nobody can look at is a component nobody reviews. This library shipped sixteen
families whose demo pages were never written, and nothing said so — the tests were green, the
audit read "no gaps", and the only way to notice was to go looking. This is that check, so the
next sixteen cannot slip through the same way.

    python tools/check_demo.py            # report
    python tools/check_demo.py --check    # CI: non-zero when something is unshown
"""
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
COMPONENTS = ROOT / 'src' / 'Unpoly.Blazor.Shadcn' / 'Components'
DEMO = ROOT / 'demo' / 'Unpoly.Blazor.Shadcn.Demo' / 'Components'

# Components that exist to be composed by another and are never written by hand. Showing them on
# their own would be showing an implementation detail; each is visible through its parent.
INTERNAL = {
    'NativeSelectWrapper',      # <NativeSelect> renders it
    'SelectItemIndicator',      # ui.js draws it
    'InputOtpSeparator',        # <InputOtp> renders it
    'AlertDialogMedia',         # optional, shown when a block uses one
    'ComboboxTriggerIcon',      # <ComboboxTrigger> renders it
    'ComboboxItemIndicator',    # <ComboboxItem> renders it
    'ComboboxChipRemove',       # <ComboboxChip> renders it
}


def used_in_demo() -> set[str]:
    used = set()
    for path in DEMO.rglob('*.razor'):
        used |= set(re.findall(r'<([A-Z]\w+)', path.read_text(encoding='utf-8')))
    return used


def main() -> int:
    components = {p.stem for p in COMPONENTS.glob('*.razor')}
    unshown = sorted(components - used_in_demo() - INTERNAL)

    shown = len(components) - len(unshown) - len(INTERNAL & components)
    print(f'{len(components)} components, {shown} shown in the demo, '
          f'{len(unshown)} unshown, {len(INTERNAL & components)} internal')

    if unshown:
        print('not shown anywhere in the demo:')
        for i in range(0, len(unshown), 4):
            print('  ' + '  '.join(f'{n:<26}' for n in unshown[i:i + 4]))

    if '--check' in sys.argv and unshown:
        print('\nAdd an example under demo/…/Components/Examples and reference it from a page,'
              '\nor add it to INTERNAL here with the reason it is never written by hand.',
              file=sys.stderr)
        return 1
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
