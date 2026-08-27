#!/usr/bin/env python3
"""Turns the vendored shadcn .tsx files into the class sets the parity tests compare against.

shadcn's source is prettier-formatted and extremely regular, which is what makes this tractable:
every component is `data-slot="name"` plus a `className={cn(...)}`, and variants come from a
`cva(base, { variants: {...}, defaultVariants: {...} })` bound to a named const.

Output: tests/Unpoly.Blazor.Shadcn.Tests/upstream-classes.json

    { "input": { "base": ["h-9", "w-full", ...], "variants": { "variant": { "default": [...] } } } }

Run tools/fetch_upstream.py first. Both are committed, so the test suite never needs the network.
"""
import json
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
UPSTREAM = ROOT / 'upstream'
OUT = ROOT / 'tests' / 'Unpoly.Blazor.Shadcn.Tests' / 'upstream-classes.json'

# "a" or 'a' or `a`, non-greedy, no escapes to worry about — shadcn writes plain class strings.
STRING = re.compile(r'"([^"]*)"|\'([^\']*)\'|`([^`]*)`')


def strings(text: str) -> list[str]:
    return [next(g for g in m.groups() if g is not None) for m in STRING.finditer(text)]


def classes(text: str) -> list[str]:
    """Every class named by the string literals in a chunk of source, in order, deduped."""
    seen, out = set(), []
    for s in strings(text):
        for c in s.split():
            if c and c not in seen:
                seen.add(c)
                out.append(c)
    return out


def balanced(text: str, start: int, open_ch='(', close_ch=')') -> str:
    """The substring from `start` to the bracket that closes the one it opens with."""
    depth, i = 0, start
    while i < len(text):
        if text[i] == open_ch:
            depth += 1
        elif text[i] == close_ch:
            depth -= 1
            if depth == 0:
                return text[start:i + 1]
        i += 1
    raise ValueError('unbalanced')


CVA_DECL = re.compile(r'const\s+(\w+)\s*=\s*cva\s*\(')
SLOT = re.compile(r'data-slot="([\w-]+)"')
CN_CALL = re.compile(r'className=\{cn\s*\(')


def parse_cva(text: str) -> dict[str, dict]:
    """Every `const xVariants = cva(...)` in the file, as base + variants + defaults."""
    out = {}
    for m in CVA_DECL.finditer(text):
        name = m.group(1)
        body = balanced(text, m.end() - 1)

        # The base is everything before the first `{` that starts the config object.
        cut = body.find('{')
        out[name] = {
            'base': classes(body[:cut] if cut > 0 else body),
            'variants': {},
            'defaults': {},
        }

        vm = re.search(r'variants:\s*\{', body)
        if vm:
            variants_block = balanced(body, vm.end() - 1, '{', '}')
            # One group per `variant: { … }` / `size: { … }`.
            for gm in re.finditer(r'(\w+):\s*\{', variants_block):
                if gm.start() == 0:
                    continue
                group = gm.group(1)
                block = balanced(variants_block, gm.end() - 1, '{', '}')
                keys = {}
                for km in re.finditer(r'([\w-]+):\s*(?=["\'`])', block):
                    value_src = block[km.end():]
                    # A variant value is one or more adjacent string literals.
                    end = 0
                    while True:
                        sm = STRING.match(value_src, end)
                        if not sm:
                            break
                        end = sm.end()
                        while end < len(value_src) and value_src[end] in ' \n\r\t':
                            end += 1
                    keys[km.group(1)] = classes(value_src[:end])
                if keys:
                    out[name]['variants'][group] = keys

        dm = re.search(r'defaultVariants:\s*\{', body)
        if dm:
            block = balanced(body, dm.end() - 1, '{', '}')
            out[name]['defaults'] = dict(re.findall(r'(\w+):\s*"([\w-]+)"', block))

    return out


def parse_slots(text: str, cvas: dict) -> dict[str, dict]:
    """Each data-slot in the file with the classes the component gives it by default."""
    out = {}
    marks = [(m.group(1), m.start(), m.end()) for m in SLOT.finditer(text)]

    for i, (slot, start, end) in enumerate(marks):
        entry = {'base': [], 'variants': {}, 'defaults': {}}

        # Only look as far as the next data-slot. Several shadcn components render a wrapper with
        # a slot and no className directly above a child that has one; searching past the
        # boundary hands the parent its child's classes, and every comparison after that is
        # against the wrong element.
        stop = marks[i + 1][1] if i + 1 < len(marks) else len(text)
        window = text[end:stop]

        cn = CN_CALL.search(window)
        if cn:
            args = balanced(window, cn.end() - 1)

            # A cn() that calls a cva helper inherits its whole recipe — and the call's own
            # arguments are variant KEYS ("outline", "ghost"), not classes, so they come out
            # before any string in the rest of the call is read as one.
            used = re.search(r'(\w+Variants)\s*\(', args)
            if used and used.group(1) in cvas:
                recipe = cvas[used.group(1)]
                entry['base'] = list(recipe['base'])
                entry['variants'] = recipe['variants']
                entry['defaults'] = recipe['defaults']
                call = balanced(args, used.end() - 1)
                args = args.replace(call, '')

            entry['base'] += [c for c in classes(args) if c not in entry['base']]

        out[slot] = entry
    return out


def main() -> int:
    files = sorted(UPSTREAM.glob('*.tsx'))
    if not files:
        print('upstream/ is empty — run tools/fetch_upstream.py first', file=sys.stderr)
        return 1

    # cva recipes are shared across files — pagination.tsx imports buttonVariants from button.tsx
    # — so every file's recipes are collected before any file's slots are read. Parsed per file,
    # the import would look like an unknown helper and its variant keys would be read as classes.
    sources = {path: path.read_text(encoding='utf-8') for path in files}
    cvas = {}
    for text in sources.values():
        cvas.update(parse_cva(text))

    result = {}
    for text in sources.values():
        for slot, entry in parse_slots(text, cvas).items():
            result[slot] = entry

    text = json.dumps(dict(sorted(result.items())), indent=2) + '\n'

    if '--check' in sys.argv:
        current = OUT.read_text(encoding='utf-8') if OUT.exists() else ''
        if current != text:
            print('upstream-classes.json is stale — run: python tools/extract_upstream.py',
                  file=sys.stderr)
            return 1
        print(f'upstream-classes.json up to date ({len(result)} slots)')
        return 0

    OUT.write_text(text, encoding='utf-8')
    print(f'wrote {OUT.relative_to(ROOT)} ({len(result)} slots)')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
