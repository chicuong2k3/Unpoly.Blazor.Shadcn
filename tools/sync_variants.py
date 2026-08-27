#!/usr/bin/env python3
"""Writes the cva recipes — Button, Badge, Alert — from the vendored shadcn source.

Same reason as sync_classes.py, but these carry variant tables rather than one string, so they
need their own shape: a C# switch whose arms are shadcn's variant values, with the upstream
default as the fallback arm (which is what cva does with an unmatched key).

    python tools/sync_variants.py            # rewrite
    python tools/sync_variants.py --check    # CI
"""
import json
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
SRC = ROOT / 'src' / 'Unpoly.Blazor.Shadcn'
CLASSES = ROOT / 'tests' / 'Unpoly.Blazor.Shadcn.Tests' / 'upstream-classes.json'
DEVIATIONS = ROOT / 'deviations.json'

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from sync_classes import ours, wrap_csharp  # noqa: E402


def load():
    classes = json.loads(CLASSES.read_text(encoding='utf-8'))
    dev = json.loads(DEVIATIONS.read_text(encoding='utf-8'))
    tokens = {k: v for k, v in dev['tokens'].items() if not k.startswith('$')}
    added = {k: v['classes'] for k, v in dev['added'].items()}
    dropped = {k: v['classes'] for k, v in dev.get('dropped', {}).items()}
    return classes, tokens, added, dropped


def arms(slot, group, entry, tokens, added, dropped, indent, default_key):
    """One switch arm per variant value; the default value becomes the discard arm."""
    keys = entry['variants'].get(group, {})
    if not keys:
        raise SystemExit(f'{slot}: upstream has no variant group "{group}" — '
                         f'available: {", ".join(entry["variants"]) or "none"}')
    lines = []
    for key in sorted(keys, key=lambda k: (k == default_key, k)):
        value = ' '.join(ours(keys[key], slot, tokens, {}, dropped))
        pattern = '_' if key == default_key else f'"{key}"'
        lines.append(f'{indent}{pattern} => "{value}",')
    return '\n'.join(lines) + '\n'


def replace_between(text, start_marker, end_marker, body):
    i = text.index(start_marker) + len(start_marker)
    j = text.index(end_marker, i)
    return text[:i] + body + text[j:]


def sync_button(classes, tokens, added, dropped):
    entry = classes['button']
    path = SRC / 'ButtonVariants.cs'
    text = path.read_text(encoding='utf-8')

    text = replace_between(
        text, '    public const string Base =\n', '\n\n    /// <summary>default | destructive',
        wrap_csharp(ours(entry['base'], 'button', tokens, added, dropped)).rstrip('\n'))

    text = replace_between(
        text, '    public static string ForVariant(string variant) => variant switch\n    {\n',
        '    };\n', arms('button', 'variant', entry, tokens, added, dropped, ' ' * 8,
                         entry['defaults'].get('variant', 'default')))

    text = replace_between(
        text, '    public static string ForSize(string size) => size switch\n    {\n',
        '    };\n', arms('button', 'size', entry, tokens, added, dropped, ' ' * 8,
                         entry['defaults'].get('size', 'default')))

    return path, text


def sync_razor(name, slot, cs_property, upstream_group, classes, tokens, added, dropped,
               base_slot=None):
    """`cs_property` is the C# parameter (PascalCase); `upstream_group` is cva's key (lowercase).

    They are not the same word, and conflating them writes an empty switch — which compiles, and
    then throws SwitchExpressionException on the first render.
    """
    entry = classes[slot]
    # A recipe read by cva name still writes its deviations under the slot it lands on.
    slot = base_slot or slot
    path = SRC / 'Components' / f'{name}.razor'
    text = path.read_text(encoding='utf-8')
    text = replace_between(
        text, f'    string VariantClass => {cs_property} switch\n    {{\n', '    };\n',
        arms(slot, upstream_group, entry, tokens, added, dropped, ' ' * 8,
             entry['defaults'].get(upstream_group, 'default')))
    return path, text


def main():
    classes, tokens, added, dropped = load()
    writes = [
        sync_button(classes, tokens, added, dropped),
        sync_razor('Badge', 'badge', 'Variant', 'variant', classes, tokens, added, dropped),
        sync_razor('Alert', 'alert', 'Variant', 'variant', classes, tokens, added, dropped),
        # Not every shadcn variant goes through cva. These four are written inline as
        # `side === "right" && "…"`, which is the same thing said differently — and reading them
        # as base is how SheetContent came to carry all four edges at once.
        sync_razor('Sheet', 'sheet-content', 'Side', 'side', classes, tokens, added, dropped),
        sync_razor('CarouselContent', 'carousel-content', 'Orientation', 'orientation',
                   classes, tokens, added, dropped),
        sync_razor('CarouselItem', 'carousel-item', 'Orientation', 'orientation',
                   classes, tokens, added, dropped),
        sync_razor('CarouselPrevious', 'carousel-previous', 'Orientation', 'orientation',
                   classes, tokens, added, dropped),
        sync_razor('CarouselNext', 'carousel-next', 'Orientation', 'orientation',
                   classes, tokens, added, dropped),
        sync_razor('Field', 'field', 'Orientation', 'orientation', classes, tokens, added, dropped),
        sync_razor('InputGroupAddon', 'input-group-addon', 'Align', 'align',
                   classes, tokens, added, dropped),
        # By cva name, not by slot: this one renders a <Button>, so the element in the DOM says
        # data-slot="button" and its own size table belongs to no slot at all.
        sync_razor('InputGroupButton', '$cva:inputGroupButtonVariants', 'Size', 'size',
                   classes, tokens, added, dropped, base_slot='input-group-button'),
    ]

    stale = [p.name for p, t in writes if p.read_text(encoding='utf-8') != t]

    if '--check' in sys.argv:
        if stale:
            print('variant recipes have drifted — run tools/sync_variants.py: '
                  + ', '.join(stale), file=sys.stderr)
            return 1
        print('variant recipes match shadcn')
        return 0

    for path, text in writes:
        path.write_text(text, encoding='utf-8')
    print('rewrote: ' + ', '.join(p.name for p, _ in writes))
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
