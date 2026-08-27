# Themes

A theme is a `:root` block. Import one after `ui.css`:

```css
@import "tailwindcss";
@import ".../Styles/ui.css";
@import ".../themes/cupertino.css";
```

Or ship several and switch at runtime by scoping each to `[data-theme="…"]` — the demo does
exactly that, and it costs nothing because every token is a runtime custom property.

## Can shadcn become Material Design 3, Cupertino or Fluent?

**Partly, and the boundary is sharp enough to state exactly.** A design language is not a
palette. shadcn tokenises colour and one radius and writes the rest as literal utility classes,
so the parts of another system that live in *tokens* transfer completely, and the parts that
live in *component markup* do not transfer at all.

What this library adds beyond shadcn to widen that boundary — `--elevation-1..4`,
`--radius-control`, `--ease-ui`, `--duration-ui`, `--control-h`, `--control-text` — are all
additive theme keys. They change no class string, so they cost nothing in parity.

| | Material 3 | Cupertino | Fluent 2 |
|---|---|---|---|
| Colour roles | ✅ maps 1:1 | ✅ | ✅ |
| Corner shape | ✅ needs `--radius-control` for pill buttons beside 12dp cards | ✅ | ✅ |
| Elevation | ✅ via `--elevation-*` | ✅ (barely used, which is itself the look) | ✅ |
| Motion | ✅ easing and duration | ✅ | ✅ |
| Density / hit target | ✅ via `--control-h` | ✅ 44pt | ✅ 32px |
| State model | ⚠️ approximated with a `::before` overlay | ✅ nothing to reproduce | ⚠️ focus bar added as a rule |
| Signature interaction | ❌ no ripple | ✅ n/a | ❌ no reveal highlight, no acrylic |
| Type scale | ❌ 15 named roles vs `text-sm`/`text-xs` | ⚠️ tracking only | ❌ 9 ramps |
| Corner curve | — | ❌ no squircle in CSS anywhere yet | — |

**Cupertino is the one that essentially works.** Apple's system is colour, radius, spacing and
type; it has no state-layer model and uses shadow sparingly, so almost nothing of it needs to
live in markup. The two gaps are the continuous "squircle" corner, which no browser can draw,
and the type scale.

**Material 3 gets close enough to read as Material, and is not Material.** Its colour and shape
systems map cleanly. Its *state* system does not: shadcn darkens a control's own colour on hover,
Material puts a translucent layer of the foreground colour over it at 8/10/12%. `md3.css`
reproduces that with a pseudo-element — no class string changes — but the ripple is a rendered
element with a JavaScript-driven origin, and there is no honest way to fake it here.

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
