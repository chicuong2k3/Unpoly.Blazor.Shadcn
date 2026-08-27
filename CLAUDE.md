# Unpoly.Blazor.Shadcn — working rules

## The class strings are generated. Do not type them.

Every component's class list comes from `upstream/`, the real shadcn/ui source, via
`tools/sync_classes.py` and `tools/sync_variants.py`. Editing a class literal by hand is a change
the next sync silently reverts, and CI fails on before that.

```bash
python tools/fetch_upstream.py     # refresh upstream/ from ui.shadcn.com
python tools/extract_upstream.py   # upstream/*.tsx  -> upstream-classes.json
python tools/sync_classes.py       # write the components
python tools/sync_variants.py      # write Button / Badge / Alert recipes
python tools/gen_api.py            # regenerate the skill's API index
python tools/gen_icons.py          # regenerate the Lucide glyphs
```

Every one of them takes `--check`, and CI runs all six. A component that has drifted, an API
index that is stale, an icon that was added without regenerating — each fails the build.

**Changing a class means changing `deviations.json`.** That file is the complete list of places
this port differs from shadcn, each with a written reason. Both the generator and the parity
tests read it, so they cannot disagree about what counts as a deviation. If the reason does not
fit in a sentence, the component is wrong, not the list.

## What parity means here, exactly

Radix keeps component state in React. Static SSR has none, so five things cannot be reproduced
and are not attempted: `asChild`, controlled props, render props, `TooltipProvider`, and
tailwind-merge's conflict resolution. Everything else is held to:

> DOM, class strings, `data-slot`, and **all** ARIA identical to shadcn. The C# API identical
> wherever the API is not a React construct.

`ClassParityTests` checks the first half against shadcn's own source. `AccessibilityTests` checks
the second half by hand, with the reason each attribute exists — because ARIA is invisible, it
degrades silently, and nothing in a screenshot says the switch is announcing itself as a
checkbox.

## Tests: one behaviour per test, always asserted

A test exists to prove one thing and must assert it. Two failure modes, both rejected:

- **No assertions.** Calling a component and passing because nothing threw proves only that it
  did not throw.
- **Many behaviours in one test.** If the name needs an "and", split it.

Several assertions are fine when they verify one behaviour — several fields of one rendered
output, or one rule against several inputs. Where the same rule is checked against a table of
inputs, use `[Theory]` with `[InlineData]` so each case is named and reported on its own.

The contract tests are theories over *every* component, found by reflection rather than by a
list. A list is something someone forgets to add to; reflection cannot forget. A component with
an `[EditorRequired]` parameter needs a seed in `ComponentCatalog`, and one added without a seed
fails loudly rather than quietly opting out.

## Adding a component

1. `python tools/fetch_upstream.py` with the registry name added to its `COMPONENTS` list.
2. Write the `.razor`: `@inherits UiComponentBase`, `data-slot` on the root, `@attributes` last.
   Leave the class literal empty — the generator fills it.
3. `python tools/extract_upstream.py && python tools/sync_classes.py`.
4. Run the tests. Anything that fails is either a real difference or a deviation to declare.
5. `python tools/gen_api.py`, and add the component to the skill if it has a trap worth naming.

Ask in this order before writing any JavaScript: does a native element already do it
(`<dialog>`, `<details>`, `[popover]`, `<select>`), does an Unpoly attribute already do it
(`up-target`, `up-poll`, `up-validate`, `up-confirm`), and only then a compiler. **A compiler
must return a destructor** — one that leaves residue does not break this swap, it breaks the
next one, and nothing tells you which.

## Two things that will cost you an afternoon

- **`ui.js` is wrapped in an IIFE and must stay that way.** A classic `<script src>` shares one
  global scope with the consuming app's own scripts. A `const el` here against a `function el`
  there is a redeclaration, and the browser throws a SyntaxError that kills the whole file before
  one compiler registers — no server error, nothing at the call site, every dialog and dropdown
  simply absent on the one app that picked the same name.
- **Tailwind only emits classes it can see.** `ui.js` builds the Select panel, the dropdown and
  the confirm dialog out of class strings, so consuming apps must list it in `@source`. Without
  that those three render unstyled, silently, in production only.
