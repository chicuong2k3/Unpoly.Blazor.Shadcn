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
| `LoginBlock` | sign in | Card, FormField, Input, Checkbox, Button |
| `SignUpBlock` | account creation | Card, FormField, Progress, Checkbox |
| `ResetPasswordBlock` | password recovery | Card, FormField, Button |
| `OtpVerifyBlock` | a code sent by SMS or email | InputOtp, Card, Button |
| `PageHeaderBlock` | the top of any detail screen | Breadcrumb, Badge, Button, DropdownMenu |
| `StatsBlock` | figures across the top of a dashboard | Card, Badge, Progress, Icon |
| `DataTableBlock` | any list screen with filters | Input, Select, Table, Checkbox, DropdownMenu, Pagination |
| `FiltersBlock` | more filters than fit in a toolbar | Popover, Field, Select, DatePicker, Badge |
| `SettingsBlock` | a settings screen with sections | Card, FormField, Switch, Separator, AlertDialog |
| `NavbarBlock` | logo, links, search and account on one bar | Button, Input, DropdownMenu, Avatar, Icon |
| `AppShellBlock` | collapsible sidebar plus content well | Sidebar, Breadcrumb, Separator |
| `OnboardingBlock` | multi-step signup, one URL per step | Card, Progress, Input, Checkbox, Button |
| `ProfileBlock` | a public profile with stats and activity | Card, Avatar, Item, Button |
| `FormWizardBlock` | a multi-step form | Progress, FieldSet, Field, Button |
| `MasterDetailBlock` | mail, chat, any inbox | Item, ScrollArea, InputGroup, ButtonGroup |
| `NotificationsBlock` | a notification centre | Card, Item, Icon |
| `CheckoutBlock` | e-commerce checkout | FieldSet, RadioGroup, Item, Separator, AspectRatio |
| `PricingBlock` | a pricing page | Card, ToggleGroup, Badge, Icon |
| `HeroBlock` | a marketing landing area | Badge, Button, AvatarGroup |
| `EmptyStateBlock` | a list with nothing in it | Card, Icon, Button |
| `AnalyticsBlock` | a chart on a dashboard | Card, Badge, Select, Icon |
| `TimelineBlock` | releases and incidents on a vertical line | Badge, Select |
| `BillingBlock` | plan, usage, invoices and card | Card, Progress, Table, Badge, AlertDialog |
| `ChangelogBlock` | versions with typed change rows | Badge, Separator |
| `IntegrationsBlock` | connector directory plus API strip | Input, CodeBlock |
| `NewsletterBlock` | one-field email capture | Input, Button |
| `NotFoundBlock` | 404 with recovery links | Button |
| `CalendarBlock` | a month view of what is on | Card, ButtonGroup, Button |
| `ChatBlock` | a conversation | ScrollArea, Textarea, Avatar, DropdownMenu |
| `FileManagerBlock` | files and folders | Breadcrumb, Table, Checkbox, ToggleGroup, DropdownMenu |
| `KanbanBlock` | a board of cards in columns | Card, Badge, Avatar, Select |
| `TaskTrackerBlock` | a task list you tick through | Card, Item, Checkbox, Badge |
| `ProductGridBlock` | a catalogue | Card, AspectRatio, Badge, Select |
| `SocialFeedBlock` | a feed of posts | Avatar, Button, DropdownMenu |
| `MediaPlayerBlock` | audio with a queue | Card, AspectRatio, Item, ButtonGroup |
| `MobileShellBlock` | a phone layout with a tab bar | ScrollArea, Item, Badge, DropdownMenu |

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

**FormWizardBlock — each step is a URL, not an index.**
A client-side step counter breaks the back button, makes a refresh lose everything, and cannot be
resumed from a link in an email. Steps are routes; Back is a link, never a button, so it cannot
resubmit.

**MasterDetailBlock — only the detail pane is swapped.**
`up-target="[data-detail]"` on each row, so the list keeps its scroll position and `[up-nav]`
marks the current one with no state. On a phone the same markup is a full navigation, because
nothing in it depends on both columns being visible.

**FiltersBlock — the URL is the state.**
No client-side filter object to get out of sync. The view is shareable and the back button works.
Applied filters are visible chips: a filter you cannot see is a filter you will blame the data for.

**OtpVerifyBlock — `autocomplete="one-time-code"` on the first box only.**
It is what lets a phone offer the code it has just received. On every box they compete.

**SignUpBlock — `autocomplete="new-password"`, not `off`.**
A password manager offers to generate one, and knows not to fill the confirmation with the old
password. `off` gets you neither.

**ResetPasswordBlock — the same answer either way.**
Saying "no such account" turns the form into a way of asking whether someone has one.

**CheckoutBlock — the summary is never below the form.**
Beside it on a desktop, above it on a phone. The total is what someone checks before committing,
and the submit says the amount rather than "Place order".

**AnalyticsBlock — the chart is a `<table>`.**
Bars are table cells with a percentage height, so the numbers are in the DOM as numbers: readable
by a screen reader, selectable, printable, and still correct with CSS off. A charting library
ships hundreds of kilobytes to draw eleven rectangles into a `<canvas>` nothing else can read.
Reach for one when you need axes, tooltips, zoom, or a line through irregular time — not before.

**CalendarBlock — also a table, and `aria-current="date"` is what says "today".**
Seven columns of days under seven column headers is a table, and every screen reader already
knows how to read one; a grid of divs has to reimplement that and usually reimplements half.
Marking today with a colour and nothing else leaves half the people using it unable to orient.
For *picking* a date this is the wrong block — that is `DatePicker`, wrapping `<input type=date>`.

**ChatBlock — the composer appends, it does not replace.**
`up-target=".chat-thread:after"`. Replace the thread and you re-render the whole conversation and
throw away the scroll position on every message sent. The thread polls with `[up-etag]`, so a
poll that finds nothing costs an empty 304 instead of a render.

**FileManagerBlock — selection is checkboxes, and the bulk bar reads them.**
One `name` shared by every row means the bulk form posts a list of ids with no script. The bar
appears through `:has(:checked)` — CSS reading the boxes, so there is no second copy of the
selection to drift from them. The view toggle is a GET form, not a class swap, so a bookmark of
the grid view opens as the grid view.

**KanbanBlock — no drag-and-drop, deliberately.**
Dragging is a pointer gesture with no keyboard equivalent unless you build one, and the
accessible fallback everyone eventually bolts on is exactly this: a control on the card naming
the column it should be in. So the fallback is the interface. Add dragging on top later if you
must; the form stays as the keyboard path.

**TaskTrackerBlock — tick swaps `:origin`, one row.**
`up-target=":origin"` on the row's form, so two hundred tasks cost one row per tick and nothing
below the pointer moves. The struck-through state comes from `has-[:checked]`, so the row cannot
disagree with its own checkbox.

**ProductGridBlock — add-to-cart swaps the badge, so the badge must be declared.**
`up-target=".cart-badge"` and the badge lives in the layout, which means
`<UpChrome Provides=".cart-badge">`. Without it the chrome is stripped from the response, the
selector is absent, and the swap silently does nothing — no error anywhere. Prices are formatted
by the server; formatting money in the browser is how a shop shows two different totals on two
different screens.

**SocialFeedBlock — each post is an `<article>` with a real permalink.**
A feed of divs is a feed nobody can link into. Optimistic counters are left out on purpose: the
round trip is the truth here, and a number that goes up and then back down is worse than one that
waits eighty milliseconds.

**MediaPlayerBlock — `<audio controls>`, not a hand-rolled scrubber.**
One attribute buys seeking, volume, keyboard support, media keys and a lock-screen control on a
phone. Rebuilding that from divs and a range input is where audio players lose their
accessibility, every time.

**MobileShellBlock — `100dvh`, the safe-area inset, and links rather than buttons.**
Three things, and all three are what separate an app from a page. `vh` on a phone is frozen at
its largest, so a `100vh` layout puts its bottom bar under the address bar until you scroll —
`100dvh` follows the chrome. Without `env(safe-area-inset-bottom)` the last tab sits under the
home indicator and cannot be tapped. And the tab bar is a `<nav>` of real links with `[up-nav]`,
not buttons and a state variable: a tab is a URL, so it can be shared and Back works.

**ProfileBlock — follow swaps `:origin`, message is a route.**
The follow form targets itself so only the button swaps. Message goes to a conversation route,
because a conversation is a URL worth sharing — not a dialog. Profile tabs (posts/media/likes)
are links to filtered views, never a client-side index.

**TimelineBlock — `<article>` plus `<time>`, filtered by GET.**
Each entry carries a real `datetime` so readers and machines agree on when it happened; the dot
is decoration and means nothing alone. The kind filter is a GET form, so a filtered timeline is
a shareable URL.

**BillingBlock — the server formats money, destruction needs a dialog.**
One total everywhere means the total is computed once, on the server — formatting money in the
browser is how a shop shows two totals on two screens. Cancel and remove-card sit behind an
`AlertDialog`, never beside Save. Invoices are table rows with download links, because finance
prints them.

**NavbarBlock — the phone menu is a `<details>`, the search is a GET.**
A menu driven by state needs script to open and can desync from it; `<details>` opens with
scripting off and never disagrees with itself. Search posts nowhere — it GETs a results URL,
so a search is shareable. The account menu stays a `DropdownMenu`, which is what closes on
outside click and escape for free.

**AppShellBlock — collapse is a cookie, navigation is links.**
`Sidebar` reads its collapsed state from a cookie on the server, so the first paint already has
the right width — collapsing in the browser first paints wrong, then jumps. The menu rows are
`Item` links with `[up-nav]`, so the current page highlights itself from the address bar and
every screen inside the shell is a URL. Content placeholders are `bg-muted/50` divs: replace
them with `StatsBlock`, `AnalyticsBlock`, or `DataTableBlock`, not with new markup.

**OnboardingBlock — steps are routes, each form posts forward.**
A step counter in state breaks Back, loses everything on refresh, and cannot resume from a link
— so `/onboarding/profile`, `/team`, `/billing` are three routes and the progress bar renders
from the step number. Each form posts to the next step's URL with `up-target="body"`; a failure
re-renders the same step with the entered values, because the values were posted, not typed
into a state that just reset.

**ChangelogBlock — one anchor per version, typed chips per row.**
A release note nobody can link to is a blog post. Each version carries an `id` and a real
`<time>`; rows start with an Added/Fixed/Changed chip so the eye scans without reading.

**IntegrationsBlock — cards link out, search GETs, logos are tiles.**
Each connector card is a link to its setup route. Search filters over GET so `?q=slack` is
shareable. Brand marks are flat color tiles with a letter: Lucide has no brand glyphs, and a
hotlinked logo 404s exactly when the page matters.

**NewsletterBlock — the form swaps itself.**
`up-target=":origin"` replaces the form with the confirmation, so there is no thank-you page
to break Back and no client-side success flag to drift. The frequency promise in the copy is
load-bearing: lists that hide it earn spam complaints instead of subscribers.

**NotFoundBlock — two ways back, three likely doors.**
Home for the lost; Back as a *link*, never a button, because Back must not resubmit. Below,
cards to the three pages analytics always shows absorbing mistyped URLs. No search box: a site
search that returns nothing twice is worse than links.

## Building a new one

Compose from the library; do not restyle it. If a block needs a class the components do not
provide, that is layout (`grid`, `gap`, `md:grid-cols-…`) and belongs on a wrapper. A `Class`
override does now win — tailwind-merge resolves it — but a block that has to override a variant
to look right is usually a block that wanted a different variant.

Ask in this order for anything interactive: does a native element already do it, does an Unpoly
attribute already do it, and only then write a compiler.
