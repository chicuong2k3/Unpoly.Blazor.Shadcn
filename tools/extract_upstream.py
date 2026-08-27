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


# `orientation === "horizontal" ? … : …` — the operand of a comparison is a prop value being
# tested, not a class. Reading it as one put the literal class "horizontal" on the carousel, and
# a class that does not exist in the stylesheet is invisible until someone diffs the two lists.
COMPARISON = re.compile(r'[=!]==?\s*(?:"[^"]*"|\'[^\']*\'|`[^`]*`)')


def entries(block: str):
    """Each `key:` at the top level of an object literal, as (key, index just past the colon).

    A regex cannot do this. A key may be quoted — cva needs that for `"inline-start"` — which
    makes it look exactly like a value; and Tailwind writes colons inside class names, so
    `@md/field-group:[&>*]:w-full` reads as a key to anything scanning the raw text. Both
    mistakes were made, and both produced a variant that silently did nothing. So: walk it, track
    the nesting, and know when you are inside a string.
    """
    i, depth = 0, 0
    while i < len(block):
        c = block[i]

        if c in '"\'`':
            m = STRING.match(block, i)
            if not m:
                i += 1
                continue
            after = m.end()
            while after < len(block) and block[after] in ' \n\r\t':
                after += 1
            if depth == 1 and block[after:after + 1] == ':':
                yield strings(m.group(0))[0], after + 1
                i = after + 1
            else:
                i = m.end()
            continue

        if c in '{[':
            depth += 1
        elif c in '}]':
            depth -= 1
        elif depth == 1 and (c.isalnum() or c == '_'):
            m = re.match(r'([\w-]+)\s*:', block[i:])
            if m:
                yield m.group(1), i + m.end()
                i += m.end()
                continue
        i += 1


def blank_strings(text: str) -> str:
    """The same text with every string literal replaced by spaces, so structure can be searched
    without the contents of a class name being mistaken for it. Lengths are preserved, which is
    what lets an offset found in the copy be used against the original."""
    # The quotes stay: they are structure, and a search for `key: "…"` needs to still see one.
    return STRING.sub(lambda m: m.group(0)[0] + ' ' * (m.end() - m.start() - 2) + m.group(0)[-1],
                      text)


def classes(text: str) -> list[str]:
    """Every class named by the string literals in a chunk of source, in order, deduped."""
    text = COMPARISON.sub('', text)
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
# The JSX element the slot sits on, read backwards from the attribute. A plain HTML tag can be
# scaffolded; a Radix primitive is a decision someone has to make, and is reported as such.
ELEMENT = re.compile(r'<([A-Za-z][\w.]*)\b[^>]*?$', re.S)
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
                for key, at in entries(block):
                    value_src = block[at:].lstrip()
                    if value_src[:1] == '[':
                        keys[key] = classes(balanced(value_src, 0, '[', ']'))
                        continue
                    end = 0
                    while True:
                        sm = STRING.match(value_src, end)
                        if not sm:
                            break
                        end = sm.end()
                        while end < len(value_src) and value_src[end] in ' \n\r\t':
                            end += 1
                    keys[key] = classes(value_src[:end])
                if keys:
                    out[name]['variants'][group] = keys

        dm = re.search(r'defaultVariants:\s*\{', body)
        if dm:
            block = balanced(body, dm.end() - 1, '{', '}')
            out[name]['defaults'] = dict(re.findall(r'(\w+):\s*"([\w-]+)"', block))

        # A default naming a group we parsed no classes for means this parser stopped
        # understanding the cva syntax — not that the component has no variants. Staying quiet
        # about that is what shipped a Field with none of its layout. Fail instead.
        for group, key in out[name]['defaults'].items():
            if group not in out[name]['variants']:
                raise SystemExit(
                    f"{name}: defaultVariants names '{group}' but no classes were parsed for it "
                    "— the cva syntax has changed and the variants are being dropped.")
            if key not in out[name]['variants'][group]:
                raise SystemExit(f"{name}: default {group}={key} is not among the parsed keys "
                                 f"{sorted(out[name]['variants'][group])}")

    return out


def parse_slots(text: str, cvas: dict) -> dict[str, dict]:
    """Each data-slot in the file with the classes the component gives it by default."""
    out = {}
    marks = [(m.group(1), m.start(), m.end()) for m in SLOT.finditer(text)]

    for i, (slot, start, end) in enumerate(marks):
        before = ELEMENT.search(text[:start])
        entry = {'base': [], 'variants': {}, 'defaults': {},
                 'element': before.group(1) if before else None}

        # Only look as far as the next data-slot. Several shadcn components render a wrapper with
        # a slot and no className directly above a child that has one; searching past the
        # boundary hands the parent its child's classes, and every comparison after that is
        # against the wrong element.
        stop = marks[i + 1][1] if i + 1 < len(marks) else len(text)

        # Start at the element's own `<`, not at the data-slot: shadcn writes attributes in no
        # fixed order, and a className BEFORE the slot was invisible to a window that began after
        # it. Carousel is the one that gave it away — it lost `relative`, so both its arrows
        # positioned themselves against the page instead of the carousel.
        open_tag = text.rfind('<', 0, start)
        window = text[open_tag if open_tag >= 0 else end:stop]

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

            args = take_conditionals(args, text, entry)
            entry['base'] += [c for c in classes(args) if c not in entry['base']]

        out[slot] = entry
    return out


# `side === "right" && "…"` and `orientation === "horizontal" ? "…" : "…"`. Not every variant in
# shadcn goes through cva: about a third are written inline like this, and reading them as part of
# the base is how SheetContent ended up carrying right-0, left-0, top-0 and bottom-0 at once —
# every side at the same time, with the winner decided by nothing but source order.
CONDITIONAL = re.compile(r'(\w+)\s*===\s*"([^"]+)"\s*(&&|\?)\s*')


def prop_values(text: str, prop: str) -> list[str]:
    """The values a prop is declared to take, from its TypeScript union."""
    m = re.search(rf'{prop}\??\s*:\s*((?:"[^"]+"\s*\|\s*)+"[^"]+")', text)
    return re.findall(r'"([^"]+)"', m.group(1)) if m else []


def take_conditionals(args: str, file_text: str, entry: dict) -> str:
    """Moves every inline conditional out of `args` and into entry['variants']."""
    while True:
        m = CONDITIONAL.search(args)
        if not m:
            return args

        prop, key, form = m.group(1), m.group(2), m.group(3)
        rest = args[m.end():]

        def literals(src: str) -> tuple[list[str], int]:
            end = 0
            while True:
                sm = STRING.match(src, end)
                if not sm:
                    break
                end = sm.end()
                while end < len(src) and src[end] in ' \n\r\t':
                    end += 1
            return classes(src[:end]), end

        taken, consumed = literals(rest)
        entry['variants'].setdefault(prop, {})[key] = taken

        if form == '?':
            gap = len(rest[consumed:]) - len(rest[consumed:].lstrip())
            at = consumed + gap
            if rest[at:at + 1] == ':':
                at += 1
                at += len(rest[at:]) - len(rest[at:].lstrip())
                other, used = literals(rest[at:])
                # The branch not taken belongs to the prop's other value. Two-valued props are
                # the only shape shadcn writes this way, so the union names it; if it somehow
                # does not, say so in the key rather than inventing a name.
                values = [v for v in prop_values(file_text, prop) if v != key]
                entry['variants'][prop][values[0] if len(values) == 1 else f'not-{key}'] = other
                consumed = at + used

        # Whatever the form, the default is the value the component's own signature gives it.
        default = re.search(rf'\b{prop}\s*=\s*"([^"]+)"', file_text)
        if default:
            entry['defaults'][prop] = default.group(1)

        args = args[:m.start()] + rest[consumed:]


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
    for path, text in sources.items():
        for slot, entry in parse_slots(text, cvas).items():
            entry['file'] = path.stem
            result[slot] = entry

    # Not every recipe reaches the DOM under a slot of its own. InputGroupButton renders a
    # <Button>, so the element's data-slot is "button" and its own size table — the one that
    # makes it small enough to sit inside a 36px control — belongs to no slot at all. Keyed by
    # cva name, they are still reachable by anything that knows what it is looking for; without
    # this the component was left with no classes whatsoever.
    for name, recipe in sorted(cvas.items()):
        result['$cva:' + name] = dict(recipe, element=None, file=None)

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
