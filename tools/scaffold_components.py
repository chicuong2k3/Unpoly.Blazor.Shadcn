#!/usr/bin/env python3
"""Creates a .razor for every upstream slot that renders a plain HTML element and has no
component here yet.

Only the mechanical half. A slot whose element is a Radix primitive — Root, Trigger, Content,
Portal — is a decision about which platform feature replaces it, and this refuses to guess: it
lists them instead. Classes are left empty for tools/sync_classes.py, which is the only thing
allowed to write them.

    python tools/scaffold_components.py            # create the missing wrappers
    python tools/scaffold_components.py --list     # show what is left to hand-write
"""
import json
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
COMPONENTS = ROOT / 'src' / 'Unpoly.Blazor.Shadcn' / 'Components'
CLASSES = ROOT / 'tests' / 'Unpoly.Blazor.Shadcn.Tests' / 'upstream-classes.json'

# Elements that carry no children of their own.
VOID = {'input', 'img', 'br', 'hr'}

# The families this port has completed. Scaffolding a wrapper from a family whose behavioural
# parts are not written yet produces a component that renders and does nothing — worse than an
# absent one, because it looks finished. Add a family here when you are ready to finish it.
FAMILIES = {
    # done earlier
    'accordion', 'alert', 'alert-dialog', 'avatar', 'badge', 'breadcrumb', 'button', 'card',
    'checkbox', 'dialog', 'dropdown-menu', 'form', 'input', 'label', 'pagination', 'progress',
    'radio-group', 'select', 'separator', 'skeleton', 'switch', 'table', 'tabs', 'textarea',
    'tooltip',
    # this batch
    'aspect-ratio', 'button-group', 'collapsible', 'empty', 'field', 'hover-card', 'input-group',
    'input-otp', 'item', 'kbd', 'native-select', 'popover', 'scroll-area', 'sheet', 'spinner', 'toggle',
    'toggle-group',
    # command and the code block, hand-written
    'command',
    # this batch: the platform answers each one
    'slider', 'resizable', 'carousel', 'context-menu', 'menubar', 'navigation-menu',
    'drawer', 'combobox',
}

# Slots that will never have a component here, with the reason. Reported separately from "not
# written yet", because the two are different promises.
NOT_PORTED = {
    'select-trigger': 'the native <select> is the trigger',
    'select-value': 'the native <select> shows its own value',
    'select-content': 'the OS draws the option panel; ui.js redraws it beside the control',
    'select-group': 'an <optgroup> is the grouping',
    'select-label': 'an <optgroup label> is the label',
    'select-separator': 'a native option list has no separators',
    'select-scroll-up-button': 'the OS scrolls its own panel',
    'select-scroll-down-button': 'the OS scrolls its own panel',
    'tooltip-provider': 'no shared delay timer; each tooltip keeps its own',
    'switch-thumb': 'the thumb is ::after on the input, which cannot have children',
    'radio-group-indicator': 'the dot is ::after on the input',
    'checkbox-indicator': 'the tick is ::after on the input',
    'form-control': 'Slot.Root is asChild; the control is written into FormField directly',
    # <input type=range> draws its own three parts, and a pseudo-element cannot be a component.
    # ui.behavior.css styles them with upstream's colours.
    'slider-track': '::-webkit-slider-runnable-track on the input',
    'slider-range': 'the filled part is a gradient on the track; no element exists',
    'slider-thumb': '::-webkit-slider-thumb on the input',
}

# React needs a portal to escape overflow and stacking context, and an overlay element to dim
# what is behind. The platform has both: showModal() puts a <dialog> in the top layer and gives
# it ::backdrop, and [popover] does the same for menus. So every *-portal and *-overlay in
# shadcn has no counterpart here, and that is a feature rather than a gap.
NOT_PORTED.update({s: 'the native top layer is the portal'
                   for s in ('dialog-portal', 'alert-dialog-portal', 'sheet-portal',
                             'dropdown-menu-portal', 'hover-card-portal', 'popover-portal',
                             'context-menu-portal', 'menubar-portal', 'select-portal',
                             'drawer-portal')})
NOT_PORTED.update({
    # Radix animates every navigation panel through one shared viewport so they cross-fade into
    # each other. That needs a measured height and a per-panel motion attribute, i.e. React. Each
    # panel here is its own [popover] in the top layer instead: no cross-fade, and in exchange no
    # overflow clipping and no z-index to lose.
    'navigation-menu-viewport': 'each panel is its own popover; there is no shared viewport',
    'navigation-menu-indicator': 'the arrow belongs to the shared viewport that is not here',
    'drawer-handle': "this port's own; vaul draws the grab bar without a slot",
    'combobox-collection': 'a React helper for rendering a list, not an element',
    'scroll-area-scrollbar': 'the platform draws the scrollbar; ui.behavior.css colours it',
    'scroll-area-thumb': 'part of the platform scrollbar',
})
NOT_PORTED.update({s: '::backdrop is the overlay'
                   for s in ('dialog-overlay', 'alert-dialog-overlay', 'sheet-overlay',
                             'drawer-overlay')})


def in_family(slot: str) -> bool:
    return any(slot == f or slot.startswith(f + '-') for f in FAMILIES)


# Slots whose element is plain HTML but whose behaviour is not — they need a compiler, a native
# element with state, or a decision about which. Listed so they are hand-written deliberately.
BEHAVIOURAL = {
    'native-select', 'sidebar-trigger', 'sidebar-rail',
    'carousel-previous', 'carousel-next', 'command-input', 'combobox-input',
}

TEMPLATE = '''@inherits UiComponentBase

<{tag} data-slot="{slot}" class="@Cn("", Class)" @attributes="AdditionalAttributes">@ChildContent</{tag}>
'''

VOID_TEMPLATE = '''@inherits UiComponentBase

<{tag} data-slot="{slot}" class="@Cn("", Class)" @attributes="AdditionalAttributes" />
'''


def pascal(slot: str) -> str:
    return ''.join(p[:1].upper() + p[1:] for p in slot.split('-'))


def main() -> int:
    data = json.loads(CLASSES.read_text(encoding='utf-8'))
    existing = {p.stem for p in COMPONENTS.glob('*.razor')}
    # A slot may already be served by a component under another name.
    served = set()
    for p in COMPONENTS.glob('*.razor'):
        served |= set(re.findall(r'data-slot="([\w-]+)"', p.read_text(encoding='utf-8')))

    made, manual = [], []
    for slot, entry in sorted(data.items()):
        if slot in served or not in_family(slot) or slot in NOT_PORTED:
            continue
        element = entry.get('element') or ''
        name = pascal(slot)
        if not element[:1].islower() or slot in BEHAVIOURAL:
            manual.append(f'{name:28} <{element or "?"}>  (slot {slot})')
            continue
        if name in existing:
            continue

        template = VOID_TEMPLATE if element in VOID else TEMPLATE
        made.append(name)
        if '--list' not in sys.argv:
            (COMPONENTS / f'{name}.razor').write_text(
                template.format(tag=element, slot=slot), encoding='utf-8')

    if '--list' in sys.argv:
        print(f'{len(made)} would be scaffolded')
        print(f'{len(NOT_PORTED)} slots deliberately never ported (see NOT_PORTED)')
        print(f'{len(manual)} need hand-writing:')
        for m in manual:
            print('  ' + m)
        return 0

    print(f'scaffolded {len(made)}: ' + ', '.join(made[:12]) + (' …' if len(made) > 12 else ''))
    print(f'{len(manual)} still need hand-writing — run with --list to see them')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
