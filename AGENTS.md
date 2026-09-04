# Unpoly.Blazor.Shadcn — agent working rules

This library ships identical Razor components to **two hosts**, both in this repo:

| Head | Project | How it renders |
|---|---|---|
| Web | `demo/Unpoly.Blazor.Shadcn.Demo` | Blazor static SSR + Unpoly navigation |
| MAUI | `demo/Unpoly.Blazor.Shadcn.Maui` | Blazor interactive in a WebView, no server |

Both live in the solution `Unpoly.Blazor.Shadcn.slnx`. A feature is incomplete until it works
in **both** heads.

## Every component change updates BOTH demos

Changing a library component is not done until the change is reflected in **both** `demo/`
projects. A `data-slot`, `@attribute`, parameter, behaviour or CSS class that changed in
`src/` must be exercised and verified in the Web head AND the MAUI head.

- If the change is a **component's markup/behaviour**, update the matching example (or add one)
  in `demo/Unpoly.Blazor.Shadcn.Demo/Components/` **and** `demo/Unpoly.Blazor.Shadcn.Maui/Components/`.
- If a component is **added or removed**, do it in both demos.
- If a **lazy asset or `_content/...` script** is added/removed, update both `wwwroot/index.html` files.
- If the **tokens/CSS theme** changes, both heads must compile and render it.

The two demos are intentionally *different* (static SSR vs interactive WebView), so a change is
not a copy-paste: the Web example may need its Unpoly attributes, the MAUI example its Blazor
interactions. **Do not** introduce a component reference in one demo that the other lacks — every
`src/` component the demo exercises should be present in both.

Verification for a component change runs both heads:

```bash
dotnet build demo/Unpoly.Blazor.Shadcn.Demo/Unpoly.Blazor.Shadcn.Demo.csproj
dotnet build demo/Unpoly.Blazor.Shadcn.Maui/Unpoly.Blazor.Shadcn.Maui.csproj
```

MAUI builds on Windows only (`net10.0-windows...`) and needs the MAUI workload —
`dotnet workload install maui-windows` if absent. The Web head builds anywhere.

## The class strings are generated. Do not type them.

Every component's class list comes from `upstream/`, the real shadcn/ui source, via
the `sync-classes` and `sync-variants` .NET commands. Editing a class literal by hand is a change
the next sync silently reverts, and CI fails on before that.

```bash
dotnet run --project tools/Unpoly.Blazor.Shadcn.Tools -- fetch-upstream
dotnet run --project tools/Unpoly.Blazor.Shadcn.Tools -- extract-upstream
dotnet run --project tools/Unpoly.Blazor.Shadcn.Tools -- sync-classes
dotnet run --project tools/Unpoly.Blazor.Shadcn.Tools -- sync-variants
dotnet run --project tools/Unpoly.Blazor.Shadcn.Tools -- gen-api
dotnet run --project tools/Unpoly.Blazor.Shadcn.Tools -- gen-icons
```

Every one of them takes `--check`, and CI runs all six. A component that has drifted, an API
index that is stale, an icon that was added without regenerating — each fails the build.

**Changing a class means changing `deviations.json`.** That file is the complete list of places
this port differs from shadcn, each with a written reason. Both the generator and the parity
tests read it, so they cannot disagree about what counts as a deviation. If the reason does not
fit in a sentence, the component is wrong, not the list.

## What parity means here, exactly

Radix keeps component state in React. Static SSR has none, so four things cannot be reproduced
and are not attempted: `asChild`, controlled props, render props and `TooltipProvider`. Class
conflict resolution is not among them — `ClassMerge` is tailwind-merge through its .NET port, so
a caller's class replaces the recipe's rather than losing to stylesheet order. Everything else is
held to:

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

1. Run the `fetch-upstream` .NET command with the registry name added to its component list.
2. Write the `.razor`: `@inherits UiComponentBase`, `data-slot` on the root, `@attributes` last.
   Leave the class literal empty — the generator fills it.
3. Run the `extract-upstream` and `sync-classes` .NET commands.
4. Run the tests. Anything that fails is either a real difference or a deviation to declare.
5. Run the `gen-api` .NET command, and add the component to the skill if it has a trap worth naming.
6. **Add the demo example to both heads** — Web and MAUI — see the rule at the top.

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

## The platform driver: `shadcnCompiler` / `shadcnOn`

`ui.js` runs on both hosts through a single driver. `shadcnCompiler`/`shadcnOn` are the ONLY
names the compilers may call:

- Web head (`usingUnpoly` = true): they pass through to `up.compiler` / `up.on`.
- MAUI head (`usingUnpoly` = false, when Unpoly is not loaded): a `MutationObserver` drives the
  same compilers against the same selectors and runs teardowns on removal.

The MAUI head may load Unpoly **just** for `up.compiler` (via `up.hello`/`up.destroy` from a
`MutationObserver` in `wwwroot/index.html`). Either way, a compiler that returns no teardown is
re-run on a later mutation, so a lazy-asset bail is retried rather than lost. Do not add
`window.up`-specific calls inside a compiler — use the driver.
