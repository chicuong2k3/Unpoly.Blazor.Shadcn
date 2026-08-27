# Blocks

Whole sections, composed from the library. Copy one and edit it — that is faster and safer than
assembling the same thing from primitives, because each block already carries the Unpoly wiring
that makes it behave, and that wiring is the part that is easy to leave out and impossible to
notice missing.

Source: `demo/Unpoly.Blazor.Shadcn.Demo/Components/Blocks/`. Rendered: run the demo and open
`/blocks`.

## Choosing one

| Block | Use it for | Composes |
|---|---|---|
| `LoginBlock` | sign in, sign up, password reset | Card, FormField, Input, Checkbox, Button |
| `PageHeaderBlock` | the top of any detail screen | Breadcrumb, Badge, Button, DropdownMenu |
| `StatsBlock` | figures across the top of a dashboard | Card, Badge, Progress, Icon |
| `DataTableBlock` | any list screen with filters | Input, Select, Table, Checkbox, DropdownMenu, Pagination |
| `SettingsBlock` | a settings screen with sections | Card, FormField, Switch, Separator, AlertDialog |
| `EmptyStateBlock` | a list with nothing in it | Card, Icon, Button |

## The trap in each

These are the parts that are wrong in most hand-assembled versions. If you take nothing else from
this file, take these.

**LoginBlock — `up-target="body"`, and `up-fail-target` on the `<form>`.**
Signing in crosses the auth boundary, so the whole shell has to be replaced; target a fragment
and the next page arrives wearing the signed-out chrome. And `[up-disable]` disables *every*
field while the request is out, including Blazor's `_handler` and the antiforgery token — so if
the failure render does not replace the form itself, those two stay disabled, are not serialized,
and the second submit is a 400 that reads as "does not specify which form is being submitted".

**DataTableBlock — the URL is the state.**
The toolbar is a GET form with `[up-autosubmit]`; there is no client-side filter state to get out
of sync, the result is bookmarkable, and Back works. `[up-watch-delay]` debounces the search box
so typing does not fire a request per keystroke. Target `[data-list]` — a data attribute, not a
class the design system owns, so a restyle cannot silently break the swap.

**SettingsBlock — one form per section.**
A single form across the screen makes "Save" mean "save everything, including the sections I did
not look at". Toggles that take effect immediately use `[up-autosubmit]` on the switch.

**StatsBlock — the grid collapses, it does not scroll.**
Four columns on a desktop, one on a phone. A stat row that scrolls sideways hides the figures
after the second one.

**EmptyStateBlock — say why it is empty.**
Three things it needs and usually lacks: the reason, one obvious action, and a way out if the
list is empty because of a filter rather than because there is nothing.

**PageHeaderBlock — the destructive action is behind a menu.**
Not beside Save. `data-ask` on it, which builds an AlertDialog on the fly with no markup in the
page.

## Building a new one

Compose from the library; do not restyle it. If a block needs a class the components do not
provide, that is layout (`grid`, `gap`, `md:grid-cols-…`) and belongs on a wrapper. A `Class`
override does now win — tailwind-merge resolves it — but a block that has to override a variant
to look right is usually a block that wanted a different variant.

Ask in this order for anything interactive: does a native element already do it, does an Unpoly
attribute already do it, and only then write a compiler.
