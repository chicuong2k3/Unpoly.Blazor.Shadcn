---
name: shadcn-unpoly
description: Use when writing markup in a Blazor static SSR app that references Unpoly.Blazor.Shadcn — building any UI with Button, Input, Dialog, Select, Table, Form, DropdownMenu, Tabs, Accordion and the rest; translating a shadcn/ui (React) snippet into Blazor; adding a new component to the library; or debugging why a component renders unstyled, why a dialog does not open, or why an override class is ignored.
---

# shadcn/ui for Unpoly.Blazor

**You already know this library.** It is shadcn/ui — the same tokens, the same class strings, the
same `data-slot` on every root, the same ARIA. Write the shadcn markup you would write in React,
then apply the translation rules below. Do not invent a Blazor-flavoured API; there isn't one.

Two files next to this one, both worth opening before you write markup:

- **`API.md`** — generated from the components, every parameter of all 102. Read it rather than
  guessing a name.
- **`BLOCKS.md`** — six ready-made sections (login, page header, stats, data table, settings,
  empty state) and the trap in each. Building a login form or a list screen from primitives when
  a block exists is slower and gets the Unpoly wiring wrong.

There is a runnable demo at `demo/`: every component with its source, the blocks, and a theme
switcher. `dotnet run --project demo/Unpoly.Blazor.Shadcn.Demo`.

## The translation rules

React → Razor, in the order you will hit them:

| React | Razor |
|---|---|
| `<Button variant="destructive" size="sm">` | `<Button Variant="destructive" Size="sm">` |
| `className="w-full"` | `Class="w-full"` |
| `{children}` | `ChildContent` — just nest the markup |
| `onClick`, `onChange`, … | there are none. This is static SSR: a form posts, a link navigates |
| `<Button asChild><Link href="/x">` | `<Button Href="/x">` |
| `<Input name="email" value={v} />` | `<Input name="email" value="@v" />` — lowercase, splatted |
| any other prop | write it as a plain HTML attribute; everything unmatched is splatted onto the root |

**Parameters are PascalCase, HTML attributes stay lowercase.** `Variant`, `Size`, `Class`, `Href`
are C# parameters. `name`, `value`, `placeholder`, `required`, `id`, `aria-*`, `data-*` and every
`up-*` attribute are written exactly as HTML and reach the element untouched. That splat is the
only reason no component here knows Unpoly exists.

## Five things that cannot be translated

These are not gaps to work around. React constructs that static SSR does not have:

1. **`asChild`.** Needs `cloneElement`. Where shadcn uses it to render a link, this has an `Href`
   parameter (`Button`, `Badge`, `DropdownMenuItem`, `PaginationLink`). There is no general form.
2. **Controlled props** — `open` / `onOpenChange`, `value` / `onValueChange`. Nothing re-renders
   on the client. State lives in a native element instead; see the table below.
3. **Render props** — `<FormField render={...}>`. `<FormField>` here takes `Label`,
   `Description` and `Message` as parameters and composes the same four primitives, which are
   also exported separately for when that shape does not fit.
4. **`TooltipProvider`.** No shared delay timer; each tooltip keeps its own.
5. **`cn()` conflict resolution.** There is no tailwind-merge. `Class="h-12"` does **not** beat
   the variant's `h-control` — equal specificity, and stylesheet order is not yours. Use the
   important modifier: `Class="h-12!"`. Layout classes the variant never sets (`w-full`, `mt-4`,
   `col-span-2`) need nothing.

## Where the state lives

| Component | shadcn / Radix | Here |
|---|---|---|
| `Dialog`, `AlertDialog` | portal + overlay + focus trap in JS | native `<dialog>`; `<DialogTrigger Target="id">` opens it |
| `Accordion` | reducer + `data-state` | `<details>`; same `Name` on each `<AccordionItem>` = `type="single"` |
| `DropdownMenu` | Popper + portal | `[popover]`; `<DropdownMenuTrigger Target="id">` |
| `Tooltip` | Popper | `[popover]`, opens on hover **and** focus |
| `Select` | listbox of divs + hidden input | a real `<select>`; options are `<SelectItem>` |
| `Checkbox`, `Switch`, `RadioGroupItem` | `<button role=…>` + hidden input | the real `<input>`, styled |
| `Tabs` | React state | a compiler; inactive panels use `hidden`, so their fields still post |
| `Sonner` | its own renderer | Toastify; call `toast(...)`, `toast.error(...)` — same shape |

`Select` has **no** `<SelectTrigger>` / `<SelectValue>` / `<SelectContent>`: the native element is
all three. Write `<Select name="kind"><SelectItem Value="a">A</SelectItem></Select>`.

## Reach for the platform before the component

Ask in this order, and stop at the first yes:

1. **Does a native element already do it?** `<dialog>`, `<details>`, `[popover]`, `<select>`,
   `type="email"`, `required`. The platform's focus trap and validation are better than yours.
2. **Does an Unpoly attribute already do it?** `up-target`, `up-follow`, `up-poll`, `up-validate`,
   `up-confirm`, `up-disable`, `up-hungry`, `up-keep`, `[up-placeholder]`. Most of Unpoly needs no
   C# and no JavaScript at all — write the attribute on the component and the splat carries it.
3. **Only then a compiler**, in `ui.js`. It must return a destructor.

Two consequences worth knowing before you reach for a component:

- **An Unpoly overlay beats `<Dialog>` when the content comes from the server.** `up-layer="new"`
  renders a real, bookmarkable route into a modal. `<Dialog>` is for content the page already has.
- **A `<Skeleton>` the server renders is never seen.** Static SSR finishes `OnInitializedAsync`
  before a byte exists. The skeleton a user sees comes from `[up-placeholder]`, so skeletons live
  in `<template>` in the layout, not in the page they stand in for.

## Traps, each of which has already cost someone an afternoon

- **`ui.js` must stay wrapped in its IIFE.** A classic `<script src>` shares one global scope. A
  `const el` here against a `function el` in the app's own script is a redeclaration, and the
  browser throws a SyntaxError that kills the entire file before one compiler registers — no
  server error, nothing at the call site, every dialog and dropdown simply absent.
- **`@source ".../ui.js"` must be in the consuming app's CSS.** Tailwind emits only classes it can
  see, and the Select panel, the dropdown and the confirm dialog are built in JavaScript. Without
  it those three render unstyled, silently, in production only.
- **Component attributes cannot mix C# and markup.** `id="row-@item.Id"` is fine on a plain
  `<input>` and a compile error on `<Input>`. Write `id="@($"row-{item.Id}")"`.
- **A `bool` attribute renders valueless.** `data-active="@IsActive"` gives `data-active` with no
  value, which CSS cannot match. Write `data-active="@(IsActive ? "true" : null)"`.
- **`[SupplyParameterFromForm]` cannot be passed as a bUnit parameter.** Assign
  `page.Instance.Form` after rendering, then submit.
- **A `<button>` inside a `<form>` submits.** Every non-submitting button needs `type="button"` —
  `TabsTrigger`, `DialogClose` and `DropdownMenuItem` already set it.

## Theming

A theme is a `[data-theme="name"]` block of custom properties, or `:root` if the app ships one.
`themes/` has three worked examples — Material 3, Cupertino and Fluent 2 — and `themes/README.md`
states exactly which parts of each transfer and which cannot. The short version: colour, shape,
elevation, motion and density are tokens and transfer; state layers, ripples and type scales live
in component markup and do not.

Six tokens exist beyond shadcn's so that another design language has somewhere to land:
`--control-h`, `--control-text`, `--radius-control`, `--elevation-1..4`, `--ease-ui`,
`--duration-ui`. All are additive theme keys — they change no class string, so they cost nothing
in parity.

A consuming app sets shadcn's own variables in `:root` — `--background`, `--foreground`,
`--primary`, `--muted`, `--accent`, `--destructive`, `--border`, `--input`, `--ring`, `--radius`,
the `--chart-*` and `--sidebar-*` families. Do not edit `@theme` in the library; that direction
belongs to `ui.css`.

Two variables are **not** shadcn's: `--control-h` and `--control-text`, surfaced as the utilities
`h-control` and `text-control`. shadcn writes `h-9 text-sm` literally, which pins every consumer
to one control size. When porting a component from ui.shadcn.com, substitute those two and leave
every other class exactly as it is.

## Adding a component

Copy the class strings from ui.shadcn.com verbatim. Change exactly four things: `h-9` →
`h-control` and `text-sm` → `text-control` on controls, `data-slot` on the root, `@attributes`
last so a caller can override, and `@inherits UiComponentBase`. Keep the ARIA identical — that is
the part of shadcn this port reproduces exactly, and there is a test for every component that
says so. Then run `python tools/gen_api.py` so `API.md` matches.
