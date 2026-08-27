#!/usr/bin/env python3
"""Writes each component's class list from the vendored shadcn source.

The class strings are not something to maintain by hand. Retyping them from the docs is how a
port drifts: one release reorders a string, someone copies an older one, and six months later
"it is shadcn" is a claim nobody can check. So they are generated from upstream/ — the same
files the parity tests compare against — with only the substitutions and additions declared in
deviations.json.

Prose, structure and behaviour in each .razor stay untouched. Only the class literal moves.

    python tools/sync_classes.py            # rewrite the components
    python tools/sync_classes.py --check    # CI: fail if any component has drifted
    python tools/sync_classes.py --diff     # show what would change
"""
import json
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
COMPONENTS = ROOT / 'src' / 'Unpoly.Blazor.Shadcn' / 'Components'
CLASSES = ROOT / 'tests' / 'Unpoly.Blazor.Shadcn.Tests' / 'upstream-classes.json'
DEVIATIONS = ROOT / 'deviations.json'

WIDTH = 96
INDENT = ' ' * 8

SLOT = re.compile(r'data-slot="([\w-]+)"')
BASE_CONST = re.compile(r'(    const string Base =\n)((?:\s*"(?:[^"]*)"(?: \+)?\n)+)(?=\s*\n|\s*string|\s*//|\s*/// )',
                        re.M)
BASE_CONST_SIMPLE = re.compile(r'(    const string Base =\n)((?:.*?);\n)', re.S)
# `@Cn("…", Class)` in markup, or `Cn("…", Class)` in an expression-bodied member.
INLINE_CN = re.compile(r'\bCn\("([^"]*)"')


def load():
    classes = json.loads(CLASSES.read_text(encoding='utf-8'))
    dev = json.loads(DEVIATIONS.read_text(encoding='utf-8'))
    tokens = {k: v for k, v in dev['tokens'].items() if not k.startswith('$')}
    added = {k: v['classes'] for k, v in dev['added'].items()}
    dropped = {k: v['classes'] for k, v in dev.get('dropped', {}).items()}
    subject = {k: v for k, v in dev.get('subject', {}).items() if not k.startswith('$')}
    return classes, tokens, added, dropped, subject


# Slots whose variant is chosen at runtime by a C# switch, written by tools/sync_variants.py.
# Everything else renders its default variant as part of its base.
RUNTIME_VARIANTS = {'button', 'badge', 'alert', 'pagination-link'}


def upstream_default(entry, slot):
    """Base plus the default value of each variant group, which is what a bare render produces."""
    out = list(entry['base'])
    if slot in RUNTIME_VARIANTS:
        return out
    for group, keys in entry.get('variants', {}).items():
        key = entry.get('defaults', {}).get(group)
        if key and key in keys:
            out += keys[key]
    return out


def ours(upstream_classes, slot, tokens, added, dropped):
    """Upstream's list, in this port's vocabulary."""
    reverse = {}
    for ours_token, theirs in tokens.items():
        for t in theirs:
            reverse[t] = ours_token

    out, seen = [], set()
    for c in upstream_classes:
        if c in dropped.get(slot, []):
            continue
        c = reverse.get(c, c)
        if c not in seen:
            seen.add(c)
            out.append(c)
    for c in added.get(slot, []):
        if c not in seen:
            seen.add(c)
            out.append(c)
    return out


def wrap_csharp(classes):
    """The class list as adjacent C# string literals, wrapped to something reviewable."""
    lines, current = [], ''
    for c in classes:
        candidate = (current + ' ' + c).strip()
        if current and len(INDENT) + len(candidate) + 4 > WIDTH:
            lines.append(current + ' ')
            current = c
        else:
            current = candidate
    if current:
        lines.append(current)

    body = []
    for i, line in enumerate(lines):
        last = i == len(lines) - 1
        body.append(f'{INDENT}"{line}"' + ('' if last else ' +'))
    return '\n'.join(body) + ';\n'


def rewrite(path: pathlib.Path, classes, tokens, added, dropped, subject):
    text = path.read_text(encoding='utf-8')
    markup = text.split('@code', 1)[0]

    # Usually the first slot in the markup is the one that carries the classes. Where a platform
    # frame wraps the shadcn box — <dialog>, the table's scroll container — deviations.json says
    # which slot to use, and the tests read the same map.
    slot = subject.get(path.stem)
    if slot is None:
        m = SLOT.search(markup)
        if not m:
            return text, None
        slot = m.group(1)
    if slot not in classes:
        return text, slot

    wanted = ours(upstream_default(classes[slot], slot), slot, tokens, added, dropped)
    # Several shadcn roots carry no className at all — Accordion, Breadcrumb, Tooltip. There is
    # nothing to write, and anything the component adds of its own has to be declared in
    # deviations.added, which the parity test enforces.
    if not wanted:
        return text, slot

    if '    const string Base =' in text:
        start = text.index('    const string Base =')
        end = text.index(';\n', start) + 2
        return text[:start] + '    const string Base =\n' + wrap_csharp(wanted) + text[end:], slot

    inline = INLINE_CN.search(text)
    if inline:
        return text[:inline.start(1)] + ' '.join(wanted) + text[inline.end(1):], slot

    return text, slot


def main():
    classes, tokens, added, dropped, subject = load()
    changed, skipped = [], []

    for path in sorted(COMPONENTS.glob('*.razor')):
        original = path.read_text(encoding='utf-8')
        updated, slot = rewrite(path, classes, tokens, added, dropped, subject)
        if slot is None or slot not in classes:
            skipped.append(path.stem)
            continue
        if updated != original:
            changed.append(path.stem)
            if '--check' not in sys.argv and '--diff' not in sys.argv:
                path.write_text(updated, encoding='utf-8')

    if skipped:
        print(f'no upstream component for: {", ".join(sorted(skipped))}')

    if '--check' in sys.argv:
        if changed:
            print('these components have drifted from shadcn — run tools/sync_classes.py:',
                  file=sys.stderr)
            print('  ' + ', '.join(changed), file=sys.stderr)
            return 1
        print('all components match shadcn')
        return 0

    print(f'{"would rewrite" if "--diff" in sys.argv else "rewrote"} {len(changed)}: '
          + ', '.join(changed))
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
