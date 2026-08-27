#!/usr/bin/env python3
"""Answers two questions with data instead of memory: which shadcn components are missing, and
which of the ones we have differ in their API.

    python tools/audit_api.py            # report against the vendored upstream/
    python tools/audit_api.py --online   # also fetch shadcn's registry index for the full list

Component coverage compares upstream/ (what we claim) with the registry index (everything shadcn
publishes). API coverage compares, per component, the sub-components and props shadcn exports
with the .razor files and [Parameter]s we ship — after the five React constructs that static SSR
cannot express, which are listed in UNPORTABLE and reported separately rather than as gaps.
"""
import json
import pathlib
import re
import sys
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parent.parent
UPSTREAM = ROOT / 'upstream'
COMPONENTS = ROOT / 'src' / 'Unpoly.Blazor.Shadcn' / 'Components'
INDEX_URL = 'https://ui.shadcn.com/r/index.json'

# React constructs with no static-SSR equivalent. Reported as "not portable", never as missing.
UNPORTABLE = {
    'asChild': 'needs cloneElement',
    'onOpenChange': 'controlled prop; nothing re-renders on the client',
    'defaultOpen': 'controlled prop',
    'onValueChange': 'controlled prop',
    'onCheckedChange': 'controlled prop',
    'onSelect': 'event handler; a form post or a link does this instead',
    'render': 'render prop',
    'delayDuration': 'TooltipProvider has no equivalent',
    'children': None,        # ChildContent, on every component via UiComponentBase
    'className': None,       # Class, checked by the contract tests
    'ref': None,
}

# Props that exist only because Radix positions a floating panel in React. Our Select is a real
# <select>, so the OS positions its popup and there is nothing for these to control.
UNPORTABLE_ON = {
    'SelectContent': {'align': 'Radix panel placement; the OS positions a native select popup',
                      'position': 'Radix panel placement'},
}

# Our name for a shadcn export, where the port deliberately renames or merges.
ALIASES = {
    'SelectTrigger': 'Select', 'SelectValue': 'Select', 'SelectContent': 'Select',
    'SelectGroup': 'Select', 'SelectLabel': 'Select', 'SelectScrollUpButton': 'Select',
    'SelectScrollDownButton': 'Select', 'SelectSeparator': 'Select',
    'DialogPortal': 'Dialog', 'DialogOverlay': 'Dialog', 'DialogContent': 'Dialog',
    'AlertDialogPortal': 'AlertDialog', 'AlertDialogOverlay': 'AlertDialog',
    'AlertDialogContent': 'AlertDialog', 'AlertDialogAction': 'Button',
    'AlertDialogCancel': 'Button', 'AlertDialogTrigger': 'DialogTrigger',
    'TooltipProvider': 'Tooltip',
    'DropdownMenuPortal': 'DropdownMenuContent',
    'AccordionHeader': 'AccordionTrigger',
    'FormControl': 'FormItem', 'FormField': 'FormField', 'useFormField': None,
    # react-hook-form's FormProvider. There is no client form state to provide: a static SSR form
    # posts, and the server decides what comes back.
    'Form': None,
    'TableContainer': 'Table',
}

EXPORTS = re.compile(r'^export\s*\{([^}]*)\}', re.M)
FUNC = re.compile(r'^function\s+(\w+)\s*\(\s*\{', re.M)
PARAM = re.compile(r'\[Parameter(?:,\s*EditorRequired)?\]\s*public\s+[\w<>?\[\]]+\s+(\w+)')


def upstream_components():
    """Exported component names per registry file, with the props each destructures."""
    out = {}
    for path in sorted(UPSTREAM.glob('*.tsx')):
        text = path.read_text(encoding='utf-8')
        exported = set()
        for m in EXPORTS.finditer(text):
            for name in m.group(1).split(','):
                name = name.strip()
                if name and name[0].isupper():
                    exported.add(name)
        props = {}
        for m in FUNC.finditer(text):
            # Balanced, not [^}]*: shadcn destructures across lines and several of these contain
            # a nested object. A greedy-to-first-brace read attributes one component's props to
            # the next one down the file, which reads as a gap that is not there.
            depth, i = 0, m.end() - 1
            while i < len(text):
                if text[i] == '{':
                    depth += 1
                elif text[i] == '}':
                    depth -= 1
                    if depth == 0:
                        break
                i += 1
            body = text[m.end():i]
            names = [p.strip().split(':')[0].split('=')[0].strip() for p in body.split(',')]
            props[m.group(1)] = {n for n in names if n and not n.startswith('...')}
        out[path.stem] = {'exports': sorted(exported), 'props': props}
    return out


def ours():
    """Our components and the parameters each declares."""
    out = {}
    for path in sorted(COMPONENTS.glob('*.razor')):
        text = path.read_text(encoding='utf-8')
        out[path.stem] = set(PARAM.findall(text))
    return out


def registry_index():
    with urllib.request.urlopen(INDEX_URL, timeout=30) as r:
        data = json.load(r)
    items = data if isinstance(data, list) else data.get('items', [])
    return sorted({i['name'] for i in items if i.get('type') == 'registry:ui'})


def main():
    up = upstream_components()
    mine = ours()
    print('=' * 78)
    print('COMPONENT COVERAGE')
    print('=' * 78)

    if '--online' in sys.argv:
        try:
            everything = registry_index()
            ported = set(up)
            missing = [n for n in everything if n not in ported]
            print(f'shadcn publishes {len(everything)} ui components; this port has {len(ported)}.')
            if missing:
                print('not ported yet:')
                for i in range(0, len(missing), 6):
                    print('  ' + '  '.join(f'{n:<22}' for n in missing[i:i + 6]))
        except Exception as e:                                   # noqa: BLE001
            print(f'(registry index unavailable: {e})')

    print()
    print('=' * 78)
    print('API COVERAGE, per ported component')
    print('=' * 78)

    gaps, unportable_hits = [], []
    for file, data in up.items():
        for export in data['exports']:
            target = ALIASES.get(export, export)
            if target is None:
                continue
            if target not in mine:
                gaps.append(f'{file}: <{export}> has no Blazor component')

        for comp, props in data['props'].items():
            target = ALIASES.get(comp, comp)
            if target is None or target not in mine:
                continue
            have = {p.lower() for p in mine[target]}
            for prop in sorted(props):
                if prop in UNPORTABLE_ON.get(comp, {}):
                    unportable_hits.append(f'{comp}.{prop} — {UNPORTABLE_ON[comp][prop]}')
                elif prop in UNPORTABLE:
                    # A None reason means "every component has it already", not "cannot be done".
                    if UNPORTABLE[prop]:
                        unportable_hits.append(f'{comp}.{prop} — {UNPORTABLE[prop]}')
                elif prop.lower() not in have:
                    gaps.append(f'{comp}.{prop} is not a parameter on <{target}>')

    if gaps:
        print(f'{len(gaps)} gap(s):')
        for g in gaps:
            print('  ' + g)
    else:
        print('no gaps.')

    print()
    print(f'{len(set(unportable_hits))} prop(s) intentionally not portable:')
    for u in sorted(set(unportable_hits)):
        print('  ' + u)

    return 0


if __name__ == '__main__':
    raise SystemExit(main())
