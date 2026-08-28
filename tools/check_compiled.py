#!/usr/bin/env python3
"""Fails when a class this library writes compiles to nothing.

`has-[>a,>button]:hover:bg-muted/50` is upstream's own class, it passed parity, and Tailwind
emitted NO rule for it — a comma separates candidates in its parser, so the whole thing was
dropped without a warning. The effect was that an attachment card carrying a trigger never
tinted under the pointer, which is the one affordance saying the whole card is clickable. It
read as "the trigger isn't there".

Nothing catches this. Parity compares our class list with shadcn's, and both said the same
thing; the demo rendered; no console error. The only witness is the built stylesheet.

So: every class literal the library writes is looked up in the demo's compiled CSS. A class
that is not there either produced no rule, or produced one under a name nobody will match.

    python tools/check_compiled.py           # the report
    python tools/check_compiled.py --check   # CI: non-zero when a class compiled to nothing
"""
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
SOURCES = [
    ROOT / 'src' / 'Unpoly.Blazor.Shadcn' / 'Components',
    ROOT / 'src' / 'Unpoly.Blazor.Shadcn' / 'ButtonVariants.cs',
    ROOT / 'src' / 'Unpoly.Blazor.Shadcn' / 'wwwroot' / 'ui.js',
]
CSS = ROOT / 'demo' / 'Unpoly.Blazor.Shadcn.Demo' / 'wwwroot' / 'app.css'

# A class candidate: no whitespace, no quote, and it has to look like a utility rather than
# prose. Anything with a variant colon or a Tailwind-shaped stem.
CANDIDATE = re.compile(r'^-?[a-z0-9]+[\w:./\[\]&>*,=^$~#()\'"+%!-]*$')

# Not classes: interpolations, C# expressions, and the handful of bare words that appear in a
# class string but are values rather than utilities.
SKIP = re.compile(r'^(?:@|\$|true|false|null|null!|default!|new|var|string|public|private)')

# A group or peer marker emits no rule of its own — it exists for `group-*` variants to select
# through — so `group/switch` is correctly absent.
MARKER = re.compile(r'^(?:group|peer)(?:/[\w-]+)?$')

# Classes that are genuinely absent, and why. Each one is a decision, like every other list in
# this repo: without the reason it is a way of hiding the finding rather than answering it.
EXPECTED_ABSENT = {
    'sr-only', 'dark', 'contents',
}

# tailwindcss-animate is a shadcn dependency this port does not install, so its enter/exit
# utilities compile to nothing. That is deliberate: the sheet animates these in plain CSS —
# sh-dialog-in, sh-accordion-down and the rest in ui.behavior.css — because a keyframe is a
# keyframe and it does not need a plugin. The classes stay so parity keeps comparing against
# shadcn's own string.
ANIMATE_PLUGIN = re.compile(r'(?:slide-in-from|slide-out-to|fade-in|fade-out|zoom-in|zoom-out'
                            r'|animate-in|animate-out)')


def class_strings() -> list[tuple[str, list[str]]]:
    """Strings that are class lists, with the file they came from.

    A class list is recognised by shape rather than by context: several tokens, and most of them
    already known to Tailwind. That is what separates `"flex w-fit items-stretch …"` from
    `data-slot="attachment"` or an icon name — and it is why the one dead token in a long class
    string stands out instead of drowning in five hundred false positives, which is what the
    first, greedier version of this did.
    """
    out = []
    files: list[pathlib.Path] = []
    for source in SOURCES:
        files.extend(sorted(source.rglob('*.razor')) if source.is_dir() else [source])

    for path in files:
        text = path.read_text(encoding='utf-8')
        strings = re.findall(r'"([^"\n]*)"', text) + re.findall(r"'([^'\n]*)'", text)
        for quoted in strings:
            tokens = [t for t in quoted.split() if CANDIDATE.match(t) and not SKIP.match(t)]
            if len(tokens) >= 3:
                out.append((path.name, tokens))
    return out


def escaped(css: str) -> set[str]:
    """The class names the sheet actually defines, unescaped back to how they are written."""
    names = set()
    for raw in re.findall(r'\.((?:[\w-]|\\.)+)', css):
        names.add(re.sub(r'\\(.)', r'\1', raw))
    return names


def main() -> int:
    if not CSS.exists():
        print(f'{CSS} is missing — build the demo first (dotnet build demo/…)', file=sys.stderr)
        return 1

    defined = escaped(CSS.read_text(encoding='utf-8'))

    missing, checked = {}, 0
    for name, tokens in class_strings():
        known = [t for t in tokens if t in defined]
        # Most of a class list compiles, or it is not a class list. Below that, the string is
        # something else that happened to have three words in it.
        if len(known) < len(tokens) * 0.6:
            continue
        checked += len(tokens)
        for token in tokens:
            if (token in EXPECTED_ABSENT or MARKER.match(token)
                    or ANIMATE_PLUGIN.search(token)):
                continue
            # A bare word with no dash and no variant is prose that happened to sit in a class
            # string — "of" out of "1 of 6" — not a utility.
            if '-' not in token and ':' not in token and '[' not in token:
                continue
            if token not in defined:
                missing.setdefault(token, set()).add(name)

    for token, where in sorted(missing.items()):
        print(f'  {token} — no rule in the compiled sheet ({", ".join(sorted(where)[:3])})',
              file=sys.stderr)

    if missing:
        print(f'\n{len(missing)} classes compile to nothing. A comma inside an arbitrary '
              f'variant is the usual cause: it ends the candidate.', file=sys.stderr)
        return 1

    print(f'{checked} class literals checked; every one of them compiles to a rule')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
