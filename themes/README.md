# Themes

A theme is a `:root` block. Import one after `ui.css`:

```css
@import "tailwindcss";
@import ".../Styles/ui.css";
@import ".../themes/cupertino.css";
```

Or ship several and switch at runtime by scoping each to `[data-theme="…"]` — the demo does
exactly that, and it costs nothing because every token is a runtime custom property.

## What is here

Four generated from [tweakcn](https://tweakcn.com) — `vercel`, `supabase`,
`modern-minimal`, `notebook` — and two written by hand as ports of another design
language: `cupertino` and `fluent`. The generated four are the ones to start from; they
were built for shadcn and sit on its shapes without argument.

`md3` used to be here and was removed. Material fights shadcn rather than dressing it:
pill buttons beside 12dp cards, a state-layer model shadcn does not have, and a ripple
that cannot be faked. What it produced read as neither one thing nor the other.

## Can shadcn become Cupertino or Fluent?

**Partly, and the boundary is sharp enough to state exactly.** A design language is not a
palette. shadcn tokenises colour and one radius and writes the rest as literal utility classes,
so the parts of another system that live in *tokens* transfer completely, and the parts that
live in *component markup* do not transfer at all.

What this library adds beyond shadcn to widen that boundary — `--elevation-1..4`,
`--radius-control`, `--ease-ui`, `--duration-ui`, `--control-h`, `--control-text` — are all
additive theme keys. They change no class string, so they cost nothing in parity.

| | Cupertino | Fluent 2 |
|---|---|---|
| Colour roles | ✅ | ✅ |
| Corner shape | ✅ | ✅ |
| Elevation | ✅ (barely used, which is itself the look) | ✅ |
| Motion | ✅ | ✅ |
| Density / hit target | ✅ 44pt | ✅ 32px |
| State model | ✅ nothing to reproduce | ⚠️ focus bar added as a rule |
| Signature interaction | ✅ n/a | ❌ no reveal highlight, no acrylic |
| Type scale | ⚠️ tracking only | ❌ 9 ramps |
| Corner curve | ❌ no squircle in CSS anywhere yet | — |

**Cupertino is the one that essentially works.** Apple's system is colour, radius, spacing and
type; it has no state-layer model and uses shadow sparingly, so almost nothing of it needs to
live in markup. The two gaps are the continuous "squircle" corner, which no browser can draw,
and the type scale.

**Fluent 2 is mostly colour and its very small radii**, which change the character more than you
would expect. The reveal highlight and acrylic material are out of reach; the focused-input
bottom bar is small enough to add as a rule, and `fluent.css` does.

## Writing your own

Copy `cupertino.css` and replace the values. Six things decide most of how a theme reads, in
roughly this order of impact:

1. `--radius` and `--radius-control` — nothing changes character faster.
2. `--control-h` and `--control-text` — density is half of what people mean by "feels like X".
3. `--background` vs `--card` — whether cards sit *on* the ground or level with it.
4. `--elevation-*` — how much anything floats.
5. `--primary` and `--accent` — the second is the hover ground and is easy to forget.
6. `--border` — a hairline reads very differently from a 1px line at full contrast.

Then check both themes of every component in the demo, not just the ones you changed:
`--accent` is used by ghost buttons, dropdown rows, table row hover and the select panel, and it
is the token most often set to something that looks right on one of those and wrong on the rest.

## What a theme carries

Colour is the least of it. Everything below is generated from the preset and every one of them
was being thrown away until it was noticed that four themes looked like the same theme:

| | |
|---|---|
| palette | the shadcn variables, light and dark |
| `--radius` | and `--radius-control`, derived from it |
| `--elevation-1..4` | the preset's own shadow scale, which is most of what distinguishes one from another |
| `--font-sans`, `--font-mono`, `--font-serif` | applied on the theme element, so the page reads in them and not only the utilities |
| `--tracking-normal` | ditto |
| `--surface-border` | back to `var(--border)`: these were authored against shadcn's bordered default, not this library's borderless one |

**A theme names its typefaces; loading them is the application's job.** The generated files say
which at the top. Unloaded, the family falls back and the theme is the same palette in the wrong
voice — which is exactly how these looked before. The demo loads them from Google Fonts; an app
that ships one theme should self-host the one face it needs.

`cupertino` and `fluent` name system faces on purpose. SF Pro and Segoe UI Variable ship with
their platforms and cannot be downloaded, and a Cupertino theme on Windows should read as Windows
laying out an Apple design rather than as a poor copy of one.
