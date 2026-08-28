---
name: shadcn-unpoly
description: Use when writing markup in a Blazor static SSR app that references Unpoly.Blazor.Shadcn — building any UI with Button, Input, Dialog, Select, Table, Form, DropdownMenu, Tabs, Accordion and the rest; translating a shadcn/ui (React) snippet into Blazor; adding a new component to the library; or debugging why a component renders unstyled, why a dialog does not open, or why an override class is ignored.
---

# shadcn/ui for Unpoly.Blazor

**You already know this library.** It is shadcn/ui — the same tokens, the same class strings, the
same `data-slot` on every root, the same ARIA. Write the shadcn markup you would write in React,
then apply the translation rules below. Do not invent a Blazor-flavoured API; there isn't one.

Two files next to this one, both worth opening before you write markup:

- **`API.md`** — generated from the components, every parameter of all 301. Read it rather than
  guessing a name.
- **`BLOCKS.md`** — 26 ready-made sections (sign in, data table, checkout, chat, board, file
  manager, calendar, feed and the rest) and the trap in each. Building a login form or a list
  screen from primitives when a block exists is slower and gets the Unpoly wiring wrong.

There is a runnable demo at `demo/` — every component with its source, all 26 blocks, a theme
switcher, a live Customizer and a ⌘K search: `dotnet run --project demo/Unpoly.Blazor.Shadcn.Demo`.
It is built entirely from this library, including its own code blocks and command palette, which
is the only honest way to show that the components are enough to build something.

**Its pages are shadcn's pages.** One component each, in shadcn's own order, at the same slug:
`ui.shadcn.com/docs/components/alert-dialog` is `/components/alert-dialog` here. The list is
`upstream/doc-components.txt`, fetched from shadcn's docs index and committed, and
`tools/check_pages.py` fails the build if a page, a name or the sidebar order ever drifts from
it. Four pages are this port's own — Icon, Code Block, Stepper, Tags Input — and they sit in a
separate group called "Beyond shadcn", because pretending they are shadcn is the one thing this
library must not do.

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

## Four things that cannot be translated

These are not gaps to work around. React constructs that static SSR does not have:

1. **`asChild`.** Needs `cloneElement`. Where shadcn uses it to render a link, this has an `Href`
   parameter (`Button`, `Badge`, `DropdownMenuItem`, `PaginationLink`). There is no general form.
2. **Controlled props** — `open` / `onOpenChange`, `value` / `onValueChange`. Nothing re-renders
   on the client. State lives in a native element instead; see the table below.
3. **Render props** — `<FormField render={...}>`. `<FormField>` here takes `Label`,
   `Description` and `Message` as parameters and composes the same four primitives, which are
   also exported separately for when that shape does not fit.
4. **`TooltipProvider`.** No shared delay timer; each tooltip keeps its own.
5. **`TooltipProvider` is the last of them** — there is no fifth. `cn()` used to be one and no
   longer is: this ships [tailwind-merge](https://github.com/dcastil/tailwind-merge) through its
   .NET port, so `Class="h-12"` *removes* the variant's `h-control` exactly as it would in React.
   Layout classes the variant never sets (`w-full`, `mt-4`, `col-span-2`) are appended, as
   before. No `!` needed.

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
| `Slider` | five divs + a roving tab index | `<input type="range">`; the track, fill and thumb are the browser's own three parts |
| `Carousel` | embla | CSS scroll-snap; it still swipes with scripting off, and only the arrows go quiet |
| `Resizable` | react-resizable-panels | a `role="separator"` the arrow keys move, writing flex-grow |
| `ContextMenu` | Radix + a right-click handler | one `contextmenu` listener, which covers the menu key and long-press too |
| `Menubar` | Radix roving focus | `[popover]` + arrow keys along the bar, and hover-to-switch once one is open |
| `NavigationMenu` | one shared animated viewport | each panel its own `[popover]` — no cross-fade, no clipping, no z-index |
| `Drawer` | vaul | `<dialog>` plus a pointer drag: past a third of the panel it closes |
| `Combobox` | its own state | a real `<input type="hidden">`, so the form posts it |
| `Sidebar` | React context + a cookie | the cookie alone; the server reads it and the first paint is right |
| `Calendar` | react-day-picker | a `<table>` of radio inputs; the browser supplies the arrow keys |
| `Chart` | recharts | the `--color-*` declarations only — what draws is yours |
| `MessageScroller` | a scroll observer | `overflow-anchor`, which the browser has had since 2018 |
| `Command` | cmdk, a filtered virtual list | every item is in the DOM as a real link; a compiler hides the ones that do not match |

`Command` filters in the browser because the server already sent the list. When the list is a
catalogue rather than a menu, put `up-autosubmit` and `up-target` on `<CommandInput>` and let the
server answer — `<CommandList>` is the fragment it swaps, and the markup is otherwise identical.
`<CommandDialog Key="mod+k">` binds the shortcut; `mod` is ⌘ on a Mac and Ctrl everywhere else.

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
- **A local called `code` is a Razor directive.** `@code` at the start of an expression opens a
  code block wherever it appears, so `<TableCell>@code</TableCell>` is a compile error with a
  message about the `code` directive rather than about your variable. Same for `@functions`,
  `@using`, `@inherits`. It has cost two afternoons here; call it `number`.
- **A `<button>` inside a `<form>` submits.** Every non-submitting button needs `type="button"` —
  `TabsTrigger`, `DialogClose` and `DropdownMenuItem` already set it.

## Two rules that are not tokens, and are not optional

`ui.css` is this port's `globals.css`, and most of it is variables. Two rules in it are not, and
both are silent when missing — both were, for months:

- **`@custom-variant dark (&:where(.dark, .dark *))`.** Tailwind v4's stock `dark:` compiles to
  a `prefers-color-scheme` query. Without redefining it against the class, the palette follows
  the class (those are plain `.dark { … }` blocks) and every `dark:` *utility* follows the
  operating system. On a machine whose OS matches the page that is invisible.
- **`@layer base { * { border-color: var(--border) } }`.** Preflight leaves `currentColor`, so
  `border-b` with no colour class draws a line in the *text* colour. Every table row, accordion
  item and panel edge was a near-black hairline — which reads as "heavier than shadcn" rather
  than as a bug.

`tools/check_globals.py` fails the build if either goes missing again.

## Theming

A theme is a `[data-theme="name"]` block of custom properties, or `:root` if the app ships one.
`themes/` has six worked examples: `vercel`, `supabase`, `modern-minimal` and `notebook`
(generated from the tweakcn registry by `tools/gen_themes.py`), plus hand-written `cupertino` and
`fluent`. `themes/README.md` states which parts of a foreign design language transfer and which
cannot — colour, shape, elevation, motion and density are tokens and transfer; state layers,
ripples and type scales live in component markup and do not.

A Material 3 theme was written and then deleted. It is the honest outcome of the paragraph above:
M3 without its state layers and ripples is not M3, it is shadcn wearing M3's palette, and shipping
it as a theme would have claimed something the tokens cannot deliver.

**The default is deliberately borderless, and a theme may disagree.** `--surface-border` is the
colour of the line around a card, an alert, a menu panel or a dialog; it is `transparent` by
default and every shipped theme sets it back to `var(--border)`, because each was authored against
shadcn's bordered look. A rule rather than a token would have quietly erased the one thing
Notebook is.

 `--background` is one step off `--card`, so surfaces
separate by tone rather than by a hairline, and `ui.behavior.css` makes the border transparent on
the containers that carry one in upstream shadcn (card, alert, menu and dialog content). Set
`border-color` on those slots in your theme to get the lines back — nothing else changes.

The demo's Customizer is worth knowing about as a tool: it writes tokens straight onto `<html>`
and prints the block to paste. Every token in this library is a runtime custom property, so a
live theme editor needs no rebuild and no CSS-in-JS.

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

## Where a family is deliberately smaller than upstream

Three, all listed with the reason in `tools/scaffold_components.py`:

- **`Slider` has one thumb.** A range with a lower and an upper bound is two inputs with two
  names — which is also what a server wants to read, so the honest shape and the useful one
  agree. Two thumbs would mean rebuilding the control Radix rebuilt.
- **`NavigationMenu` has no viewport or indicator.** Radix animates every panel through one
  shared viewport so they cross-fade into each other; that needs a measured height and a motion
  attribute per panel. Each panel here is its own popover in the top layer instead — no
  cross-fade, and in exchange nothing clips it and there is no z-index to lose.
- **`Chart` draws nothing.** `ChartContainer` upstream declares one custom property per series
  and then carries a wall of `[&_.recharts-*]` selectors. The first half is kept; a real charting
  library, when you need one, renders inside it and reads the same properties. Until then a
  `<table>` with a percentage height per bar reads to a screen reader, prints, and needs nothing
  loaded — the demo's Analytics block is the worked example.

## The two components shadcn does not have

Everything else in this library is upstream shadcn, name for name. These two are not, and are
marked as such in `API.md`:

- **`CodeBlock`** — a `<pre>` with a title bar and a copy button. shadcn's docs draw code with a
  bespoke MDX pipeline and export nothing, so a port whose own documentation is built from itself
  had to have one. `Code` is a **string** parameter, not `ChildContent`: Razor parses markup
  inside `<pre>` as components, so a snippet containing `<Button>` would render a button rather
  than show one. There is no syntax highlighting — that would mean shipping a second copy of a
  language grammar per page.
- **`Kbd` / `KbdGroup`** — upstream has these; listed here only because they are what a `Command`
  trigger pairs with.

## Adding a component

Copy the class strings from ui.shadcn.com verbatim. Change exactly four things: `h-9` →
`h-control` and `text-sm` → `text-control` on controls, `data-slot` on the root, `@attributes`
last so a caller can override, and `@inherits UiComponentBase`. Keep the ARIA identical — that is
the part of shadcn this port reproduces exactly, and there is a test for every component that
says so. Then run `python tools/gen_api.py` so `API.md` matches.
