// shadcn/ui for Unpoly.Blazor — the behaviour layer.
// =============================================================================================
// Radix builds its components in React and keeps their state in React. Nothing here can: the
// server renders once and Unpoly swaps fragments in and out underneath. So each interactive
// component is either
//
//   (a) a native element that already owns the state — <dialog>, <details>, [popover],
//       <select> — dressed in shadcn's classes, or
//   (b) an `up.compiler`, which runs on every DOM insertion (first load AND every fragment
//       swap) and MUST return a destructor. A compiler that leaves residue behind does not
//       break this swap; it breaks the next one, which is why every one below tears down.
//
// Tailwind only emits classes it can see in a scanned file, so this file must be listed in the
// head's `@source` — otherwise everything built here renders unstyled. That line is in each
// head's app.css next to the component globs.

// Everything below runs inside an IIFE, and that is load-bearing rather than tidy.
// A <script src> without type=module shares one global scope with every other script on the
// page — so `const el` here and `function el` in a head's own app.js are a redeclaration, and
// the browser throws a SyntaxError that kills THIS ENTIRE FILE before a single compiler is
// registered. Nothing logs at the call site, nothing fails on the server, and every dialog,
// toast and dropdown is simply absent on the one head that happened to pick the same name.
// The two exports at the bottom are the only things this file puts on window, deliberately.
;(function () {
  // ---- config --------------------------------------------------------------------------------
  // The only strings this library produces from JavaScript rather than from a Razor parameter.
  // Read lazily at call time, not captured at load, so a head can set window.shadcnUi from a
  // script that happens to load after this one.
  //
  //   window.shadcnUi = {
  //     confirmText: 'Đồng ý',
  //     cancelText: 'Huỷ',
  //     datePickerLocale: { days: [...], months: [...], today: 'Hôm nay', clear: 'Xoá', ... },
  //   }
  const config = () => window.shadcnUi || {}

  // ---- cn ------------------------------------------------------------------------------------
  const cn = (...parts) => parts.filter(Boolean).join(' ')

  const el = (tag, className, props = {}) =>
    Object.assign(document.createElement(tag), { className, ...props })

  // ---- shared class strings ------------------------------------------------------------------
  // Only the JS-built components need these; the Razor components carry their own inline, exactly
  // as shadcn does. They sit at the top rather than beside their use because a `const` read before
  // its declaration is a temporal-dead-zone error, and a compiler callback is easy to reorder.

  let selectSeq = 0

  // The page must not scroll behind anything that has taken over the pointer — a modal, a drawer,
  // an open list. The platform makes a modal's background inert to clicks and to the keyboard,
  // but the wheel still reaches it, so the panel sits pinned while the page slides past behind it.
  //
  // Counted rather than toggled, and ONE counter for all of them: drawers nest, a select opens
  // inside a dialog, and the first thing to close must not unlock the page while another is still
  // holding it.
  let locks = 0
  const lockScroll = (on) => {
    locks = Math.max(0, locks + (on ? 1 : -1))
    document.documentElement.style.overflow = locks > 0 ? 'hidden' : ''
  }

  const SELECT_TRIGGER =
    'border-input flex h-control w-full items-center justify-between gap-2 rounded-md border ' +
    'bg-transparent px-3 py-2 text-control whitespace-nowrap shadow-xs ' +
    'transition-[color,box-shadow] outline-none focus-visible:border-ring ' +
    'focus-visible:ring-ring/50 focus-visible:ring-[3px] disabled:cursor-not-allowed ' +
    'disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 ' +
    'data-[placeholder]:text-muted-foreground data-[size=sm]:h-8 dark:bg-input/30 ' +
    'dark:hover:bg-input/50 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none ' +
    "[&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 " +
    "[&_svg:not([class*='text-'])]:text-muted-foreground"

  const SELECT_CONTENT =
    'bg-popover text-popover-foreground z-50 max-h-60 min-w-[8rem] overflow-x-hidden ' +
    'overflow-y-auto rounded-md border p-1 shadow-md'

  const SELECT_ITEM =
    'relative flex w-full cursor-default items-center gap-2 rounded-sm py-1.5 pr-8 pl-2 text-sm ' +
    'outline-hidden select-none hover:bg-accent hover:text-accent-foreground ' +
    'data-[active]:bg-accent data-[active]:text-accent-foreground ' +
    'data-[disabled]:pointer-events-none data-[disabled]:opacity-50 ' +
    "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 " +
    "[&_svg:not([class*='text-'])]:text-muted-foreground"

  const SELECT_LABEL = 'px-2 py-1.5 text-xs text-muted-foreground'
  const SELECT_SEPARATOR = 'pointer-events-none -mx-1 my-1 h-px bg-border'
  const SELECT_INDICATOR = 'absolute right-2 flex size-3.5 items-center justify-center rtl:right-auto rtl:left-2'
  const SELECT_SCROLL_BUTTON = 'flex cursor-default items-center justify-center py-1'

  // The two icons the drawn select needs. Everywhere else an <Icon> is rendered by Razor from the
  // committed sheet; here the whole control is built in script, so these are the only two markup
  // strings in this file that draw a picture.
  const svg = (paths) =>
    `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" ` +
    `fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" ` +
    `stroke-linejoin="round" aria-hidden="true">${paths}</svg>`
  const CHEVRON_DOWN = svg('<path d="m6 9 6 6 6-6"/>')
  const CHEVRON_UP = svg('<path d="m18 15-6-6-6 6"/>')
  const CHECK = svg('<path d="M20 6 9 17l-5-5"/>')

  const BUTTON_BASE =
    'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-control ' +
    'font-medium transition-all disabled:pointer-events-none disabled:opacity-50 shrink-0 ' +
    'outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] ' +
    'h-control px-4 py-2'

  const BUTTON = {
    default: cn(BUTTON_BASE, 'bg-primary text-primary-foreground shadow-xs hover:bg-primary/90'),
    destructive: cn(BUTTON_BASE, 'bg-destructive text-white shadow-xs hover:bg-destructive/90'),
    outline: cn(BUTTON_BASE, 'border bg-background shadow-xs hover:bg-accent hover:text-accent-foreground'),
    ghost: cn(BUTTON_BASE, 'hover:bg-accent hover:text-accent-foreground'),
  }

  // =============================================================================================
  // Sonner — toast()
  // =============================================================================================
  // Toastify-js underneath (vendored under /toastify, MIT). It owns the stack, the slide, the
  // timer and the dismissal; we supply the wording and the slot the CSS dresses.
  //
  // The server already knows what happened and says so with `Ctx.UpEmit("sonner:toast", …)`.

  function toast(text, options = {}) {
    if (!text) return
    if (typeof Toastify !== 'function') { console.warn('[ui] Toastify not loaded:', text); return }

    const type = options.type || 'success'
    Toastify({
      text,
      duration: options.duration ?? 4000,
      close: true,
      gravity: 'bottom',
      position: 'right',
      // Theme comes from CSS, not inline style, so every token stays in one place.
      className: 'sonner-toast',
      style: { background: '' },
      stopOnFocus: true,
      escapeMarkup: true,
      callback: undefined,
      onClick: options.onClick,
    }).showToast()

    // Toastify has no hook for arbitrary attributes, and [data-slot] is what ui.css styles.
    const node = document.querySelector('.toastify:not([data-slot])')
    if (node) { node.dataset.slot = 'sonner-toast'; node.dataset.type = type }
  }

  toast.success = (text, o) => toast(text, { ...o, type: 'success' })
  toast.error = (text, o) => toast(text, { ...o, type: 'error' })

  up.on('sonner:toast', (event) => toast(event.text, { type: event.flavor || event.type || 'success' }))
  // The cart event carries its own wording and predates the toast channel.
  up.on('cart:changed', (event) => toast(event.text))

  // =============================================================================================
  // AlertDialog — a destructive confirmation
  // =============================================================================================
  // [up-confirm] calls window.confirm, and Unpoly's hook for it (up.browser.assertConfirmed) is
  // called synchronously and never awaited, so a promise returned from an override is ignored — a
  // modal cannot be substituted there. Hence a separate attribute Unpoly does not know about:
  // the click is caught in the capture phase before Unpoly sees it, and re-issued once answered.
  //
  // [data-confirm] is NOT a free name — Unpoly reads it as an alias of [up-confirm].

  const ALERT_DIALOG_PANEL =
    'bg-background rounded-lg border p-6 shadow-lg w-[min(28rem,calc(100vw-2rem))] ' +
    'flex flex-col gap-4'

  function alertDialog(message, options = {}) {
    const confirmText = options.confirmText ?? config().confirmText ?? 'OK'
    const cancelText = options.cancelText ?? config().cancelText ?? 'Cancel'
    return new Promise((resolve) => {
      const dialog = el('dialog', '', { })
      dialog.dataset.slot = 'alert-dialog'

      // The <dialog> is the frame; this is the box shadcn calls AlertDialogContent. Same split
      // as the Razor <Dialog>, so one CSS rule dresses both.
      const panel = el('div', ALERT_DIALOG_PANEL)
      panel.dataset.slot = 'alert-dialog-content'
      const header = el('div', 'flex flex-col gap-2 text-center sm:text-left')
      header.dataset.slot = 'alert-dialog-header'
      const title = el('p', 'text-muted-foreground text-sm', { textContent: message })
      title.dataset.slot = 'alert-dialog-description'
      header.append(title)

      const footer = el('div', 'flex flex-col-reverse gap-2 sm:flex-row sm:justify-end')
      footer.dataset.slot = 'alert-dialog-footer'

      // data-ask-yes / data-ask-no name the two answers. Both buttons carry data-slot="button"
      // and differ only by variant, so without these a test — or a keyboard shortcut — would have
      // to tell them apart by their Vietnamese labels.
      const cancel = el('button', BUTTON.outline, { type: 'button', textContent: cancelText })
      cancel.dataset.slot = 'button'
      cancel.dataset.variant = 'outline'
      cancel.dataset.askNo = ''
      const confirm = el('button', BUTTON.destructive, { type: 'button', textContent: confirmText })
      confirm.dataset.slot = 'button'
      confirm.dataset.variant = 'destructive'
      confirm.dataset.askYes = ''
      footer.append(cancel, confirm)

      panel.append(header, footer)
      dialog.append(panel)
      document.body.append(dialog)

      const answer = (ok) => { dialog.close(); dialog.remove(); resolve(ok) }
      confirm.addEventListener('click', () => answer(true))
      cancel.addEventListener('click', () => answer(false))
      // Escape and the backdrop both mean no. <dialog> fires `cancel` for Escape by itself.
      dialog.addEventListener('cancel', (e) => { e.preventDefault(); answer(false) })
      dialog.addEventListener('click', (e) => { if (e.target === dialog) answer(false) })

      dialog.showModal()          // native: focus trap, inert background, top layer
      cancel.focus()              // the safe answer, not the destructive one
    })
  }

  up.compiler('[data-ask]', (element) => {
    const onClick = async (event) => {
      // A second click — the one this handler issues itself after a yes.
      if (element.dataset.asked) return

      event.preventDefault()
      event.stopImmediatePropagation()      // Unpoly's own click handler must not run yet

      const message = element.dataset.ask
      if (!message || await alertDialog(message)) {
        element.dataset.asked = '1'
        element.click()                     // now it means: follow the link, submit the form
        delete element.dataset.asked
      }
    }

    element.addEventListener('click', onClick, true)
    return () => element.removeEventListener('click', onClick, true)
  })

  // =============================================================================================
  // Dialog / Sheet — <dialog> does the hard parts
  // =============================================================================================
  // showModal() gives the focus trap, the inert background, Escape and the top layer. None of
  // that is worth reimplementing, and all of it is what Radix spends most of its bytes on.

  // alert-dialog-trigger belongs here too. It was missing, and an attribute selector is exact:
  // [data-slot="dialog-trigger"] does not match alert-dialog-trigger, so every AlertDialog in
  // the library was inert — the button rendered, nothing bound to it, and no error said so.
  up.compiler('[data-slot="dialog-trigger"], [data-slot="sheet-trigger"], '
            + '[data-slot="alert-dialog-trigger"], '
            + '[data-slot="attachment-trigger"][data-target]', (trigger) => {
    const open = (event) => {
      const target = document.getElementById(trigger.dataset.target)
      if (!target) return
      event.preventDefault()
      target.showModal()
    }
    trigger.addEventListener('click', open)
    return () => trigger.removeEventListener('click', open)
  })

  // A close button anywhere inside the dialog, including the corner X. [data-dialog-close] is
  // the attribute a component sets when it wants this behaviour under a different slot name —
  // AlertDialogCancel does, and its own comment said so while nothing bound it.
  // drawer-close is on this list because it was not, and nothing else bound it: the button
  // relied on formmethod="dialog", which only acts on a submit button that HAS a form owner, and
  // no drawer in the demo is inside a form. So every Close and Cancel in a drawer did nothing.
  up.compiler('[data-slot="dialog-close"], [data-slot="sheet-close"], ' +
              '[data-slot="drawer-close"], [data-dialog-close]',
              (button) => {
    const close = (event) => { event.preventDefault(); button.closest('dialog')?.close() }
    button.addEventListener('click', close)
    return () => button.removeEventListener('click', close)
  })

  // The page must not scroll behind a modal. The platform makes the background inert to CLICKS
  // and to the keyboard, but the wheel still scrolls it — so the dialog sat pinned while the
  // page slid past behind it, which nothing built on Radix does because Radix locks the scroll.
  // Counted rather than toggled: drawers nest, and the first one to close must not unlock the
  // page while another is still open.
  up.compiler('dialog[data-slot="dialog"], dialog[data-slot="alert-dialog"], ' +
              'dialog[data-slot="command-dialog"], dialog[data-slot="sheet"], ' +
              'dialog[data-slot="drawer"]', (dialog) => {
    const onToggle = () => {
      // A non-modal drawer does not lock anything: staying usable is the whole point of it.
      if (dialog.dataset.modal === 'false') return
      lockScroll(dialog.open)
    }

    const watch = new MutationObserver(onToggle)
    watch.observe(dialog, { attributes: true, attributeFilter: ['open'] })
    if (dialog.open) onToggle()

    return () => {
      watch.disconnect()
      if (dialog.open && dialog.dataset.modal !== 'false') lockScroll(false)
    }
  })

  // Clicking the backdrop dismisses. The <dialog> element IS the backdrop area, so a click whose
  // target is the dialog itself — rather than the panel inside it — landed outside.
  up.compiler('dialog[data-dismissable]', (dialog) => {
    const onClick = (event) => { if (event.target === dialog) dialog.close() }
    dialog.addEventListener('click', onClick)
    return () => dialog.removeEventListener('click', onClick)
  })

  // =============================================================================================
  // Tabs
  // =============================================================================================
  // No request, no history: this is a local view switch. A tab that should be linkable is a link
  // with [up-target] instead, and needs none of this.

  // Which physical edge "start" and "end" mean. Everything below places by reading order, not by
  // screen order — a dropdown aligned to the start of its trigger hangs off the RIGHT edge in
  // Arabic, and aligning it left there is the same bug as writing ml-auto in a stylesheet.
  const rtl = (element) => getComputedStyle(element).direction === 'rtl'

  // A [popover] gets `inset: 0; margin: auto` from the UA stylesheet, so setting only `left`
  // leaves it over-constrained — and which of the two the browser then ignores depends on the
  // writing direction. In LTR it drops `right` and the panel lands where you asked; in RTL it
  // drops LEFT, and every menu in the library sat against the far edge of the window instead of
  // against its trigger. Releasing the other three insets is what makes the number mean
  // something. This was invisible in English, which is why it survived.
  function put(panel, edge, top) {
    panel.style.insetInline = 'auto'
    panel.style.insetBlock = 'auto'
    if (edge.left !== undefined) panel.style.left = `${Math.round(edge.left)}px`
    if (edge.right !== undefined) panel.style.right = `${Math.round(edge.right)}px`
    panel.style.top = `${Math.round(top)}px`
  }

  up.compiler('[data-slot="tabs"]', (root) => {
    const triggers = [...root.querySelectorAll('[data-slot="tabs-trigger"]')]
    const panels = [...root.querySelectorAll('[data-slot="tabs-content"]')]
    if (triggers.length === 0) return

    const show = (value) => {
      for (const t of triggers) t.dataset.state = t.dataset.value === value ? 'active' : 'inactive'
      for (const t of triggers) t.setAttribute('aria-selected', String(t.dataset.value === value))
      for (const t of triggers) t.tabIndex = t.dataset.value === value ? 0 : -1
      for (const p of panels) p.hidden = p.dataset.value !== value
    }

    const onClick = (event) => {
      const trigger = event.target.closest('[data-slot="tabs-trigger"]')
      if (trigger && root.contains(trigger)) show(trigger.dataset.value)
    }

    // Arrow keys move between tabs, which is the part of the APG pattern people actually notice.
    const onKey = (event) => {
      const forward = rtl(root) ? 'ArrowLeft' : 'ArrowRight'
      const back = rtl(root) ? 'ArrowRight' : 'ArrowLeft'
      const step = { [back]: -1, [forward]: 1, Home: -Infinity, End: Infinity }[event.key]
      if (step === undefined || !event.target.matches('[data-slot="tabs-trigger"]')) return
      event.preventDefault()
      const from = triggers.indexOf(event.target)
      const to = Math.max(0, Math.min(triggers.length - 1, step === Infinity ? triggers.length - 1
        : step === -Infinity ? 0 : from + step))
      triggers[to].focus()
      show(triggers[to].dataset.value)
    }

    root.addEventListener('click', onClick)
    root.addEventListener('keydown', onKey)
    show(root.dataset.value || triggers[0].dataset.value)

    return () => {
      root.removeEventListener('click', onClick)
      root.removeEventListener('keydown', onKey)
    }
  })

  // =============================================================================================
  // data-state on a [popover]
  // =============================================================================================
  // The same problem as <dialog>, and the same fix. shadcn animates every menu and popover with
  // data-[state=open] and data-[state=closed], which Radix sets as it mounts. A [popover] has an
  // open state but no attribute for it, so those classes matched nothing and panels appeared and
  // vanished with no transition at all.
  //
  // The trigger gets it too, because a chevron that turns when its menu opens is written
  // `group-data-[state=open]:rotate-180` — the group is the trigger, not the panel.

  up.compiler('[popover][data-slot]', (panel) => {
    const trigger = document.querySelector(`[popovertarget="${panel.id}"]`)

    const onToggle = (event) => {
      const open = event.newState === 'open'
      panel.dataset.state = open ? 'open' : 'closed'
      if (trigger) trigger.dataset.state = open ? 'open' : 'closed'
    }

    if (panel.matches(':popover-open')) panel.dataset.state = 'open'
    panel.addEventListener('toggle', onToggle)
    return () => panel.removeEventListener('toggle', onToggle)
  })

  // =============================================================================================
  // DropdownMenu / Popover — the popover API does the hard parts
  // =============================================================================================
  // [popover] gives the top layer, light dismiss and Escape. What it does not give portably yet is
  // anchor positioning (`position-area` is not everywhere), so that much is measured here.

  function place(panel, anchor, align = 'start', side = 'bottom', offset = 4) {
    const a = anchor.getBoundingClientRect()

    // What the panel's own class string is written against, and it has to be set BEFORE the
    // panel is measured or the placement below works from a width that is about to change.
    // shadcn sizes a combobox list with `w-(--anchor-width)` and caps menus with
    // `max-h-(--available-height)`; Base UI's positioner supplies those, and nothing here did —
    // so the class resolved to nothing, the list kept whatever width it happened to have, and it
    // stood out past the side of the box it belongs to.
    panel.style.setProperty('--anchor-width', `${Math.round(a.width)}px`)
    panel.style.setProperty('--available-width', `${document.documentElement.clientWidth - 16}px`)
    panel.style.setProperty('--available-height',
      `${Math.max(120, Math.round(Math.max(a.top, window.innerHeight - a.bottom) - offset - 8))}px`)

    const p = panel.getBoundingClientRect()
    const flip = rtl(anchor)
    const room = document.documentElement.clientWidth

    // inline-start and inline-end are sides too. They fell through to the bottom branch in
    // silence, which is what the RTL samples ask for and what they were not getting.
    if (side === 'inline-start') side = flip ? 'right' : 'left'
    else if (side === 'inline-end') side = flip ? 'left' : 'right'

    // Beside, rather than above or below. Only top and bottom were handled, so a panel asking
    // for left or right silently got bottom -- the side was in the markup, in the docs and in
    // the data attribute, and nothing anywhere did it.
    if (side === 'left' || side === 'right') {
      const wantsLeft = side === 'left'
      let top = Math.max(8, Math.min(a.top + (a.height - p.height) / 2,
                                     window.innerHeight - p.height - 8))
      // Flip to the other side when the chosen one has no room, as every popover library does.
      const fitsLeft = a.left - p.width - offset >= 8
      const fitsRight = a.right + p.width + offset <= room - 8
      const left = (wantsLeft && fitsLeft) || (!wantsLeft && !fitsRight)
      panel.dataset.placedSide = left ? 'left' : 'right'
      // Pin the edge that meets the trigger, never `left minus my own width`: the width is
      // measured before the panel has settled at its final size, and the gap comes out wrong by
      // the difference -- four pixels here, every time, on the left side only.
      put(panel, left ? { right: room - (a.left - offset) } : { left: a.right + offset }, top)
      return
    }

    let top = side === 'top' ? a.top - p.height - offset : a.bottom + offset
    // Where it ENDED UP, which is not always where it asked to be. data-side stays the request,
    // because every caller reads it back on the next open; the arrow needs the outcome.
    panel.dataset.placedSide = side === 'top' ? 'top' : 'bottom'
    if (top + p.height > window.innerHeight - 8) {
      top = Math.max(8, a.top - p.height - offset)
      panel.dataset.placedSide = 'top'
    }
    // And the other edge. Only the bottom was checked, so a panel asking for the top near the
    // top of the window was given a negative offset and drawn off the screen entirely.
    if (top < 8) {
      top = Math.min(a.bottom + offset, window.innerHeight - p.height - 8)
      panel.dataset.placedSide = 'bottom'
    }

    // Pin the edge that has to line up, rather than deriving it by subtracting the panel's own
    // width from the other edge. That subtraction was wrong by however much the measured width
    // differed from the final one — twelve pixels in RTL, every time, because the panel's width
    // comes from --anchor-width and is not settled when this runs. An edge needs no measurement.
    if (align === 'center') {
      const left = Math.max(8, Math.min(a.left + (a.width - p.width) / 2, room - p.width - 8))
      put(panel, { left }, top)
      return
    }

    const toStart = flip ? { right: room - a.right } : { left: a.left }
    const toEnd = flip ? { left: a.left } : { right: room - a.right }
    const edge = align === 'end' ? toEnd : toStart

    // Stay on screen. A menu half off an edge is a menu with unreachable items.
    if (edge.left !== undefined) edge.left = Math.max(8, Math.min(edge.left, room - p.width - 8))
    else edge.right = Math.max(8, Math.min(edge.right, room - p.width - 8))

    put(panel, edge, top)
  }

  // Every trigger that opens a panel anchored to itself: a dropdown, a popover, a submenu row,
  // and a menubar's own buttons. They differ in where the panel goes, not in how it opens.
  up.compiler('[data-slot="dropdown-menu-trigger"], [data-slot="popover-trigger"], ' +
              '[data-slot="dropdown-menu-sub-trigger"], [data-slot="menubar-trigger"], ' +
              '[data-slot="menubar-sub-trigger"], [data-slot="context-menu-sub-trigger"], ' +
              // The navigation menu was missing from this list, and nothing else placed it: its
              // panel fell back to the popover's own idea of where to be, which was full width
              // and two hundred pixels below the bar it belongs to.
              '[data-slot="navigation-menu-trigger"]',
              (trigger) => {
    const panel = document.getElementById(trigger.dataset.target)
    if (!panel) return

    // Radix lets a popover be positioned against something other than its trigger. Same idea:
    // the nearest [data-slot=popover-anchor] wins if there is one.
    const anchor = trigger.closest('[data-slot="popover"]')
      ?.querySelector('[data-slot="popover-anchor"]') || trigger

    const onToggle = (event) => {
      if (event.newState !== 'open') { trigger.setAttribute('aria-expanded', 'false'); return }
      trigger.setAttribute('aria-expanded', 'true')
      // A submenu opens BESIDE its row, not below it — otherwise it lands on top of the parent
      // menu and the row you came from disappears underneath it.
      const settle = () => {
        if (trigger.getAttribute('data-slot').endsWith('sub-trigger')) placeBeside(panel, trigger)
        else place(panel, anchor, panel.dataset.align, panel.dataset.side,
                   Number(panel.dataset.sideOffset || 4))
      }

      settle()
      // Again next frame. A panel whose width answers a media query — the navigation menu is
      // w-full below md and w-auto above it — is still full width when the first measurement is
      // taken, so the clamp that keeps it on screen slid it to the left edge of the window.
      // Placing twice costs one layout read and needs no guess about which panels do that.
      requestAnimationFrame(settle)
      panel.focus({ preventScroll: true })
    }

    // A dropdown pinned to a trigger that has scrolled away is worse than one that closed — but
    // only a scroll that MOVED the trigger counts. The listener is on the window with capture,
    // so it hears every element's scroll, and a chat transcript scrolling in the corner of the
    // page was closing menus that had nothing to do with it.
    const onScroll = (event) => {
      if (!panel.matches(':popover-open')) return
      const scroller = event?.target
      const moved = !scroller || scroller === document || scroller === window
        || (scroller.contains?.(trigger) && scroller !== panel && !panel.contains(scroller))
      if (moved) panel.hidePopover()
    }

    panel.addEventListener('toggle', onToggle)
    window.addEventListener('scroll', onScroll, { passive: true, capture: true })
    window.addEventListener('resize', onScroll, { passive: true })

    return () => {
      panel.removeEventListener('toggle', onToggle)
      window.removeEventListener('scroll', onScroll, true)
      window.removeEventListener('resize', onScroll)
    }
  })

  // A site header opens on hover. Clicking one is the behaviour of a menu you are choosing FROM;
  // a navigation bar is one you are reading ACROSS, and requiring a click there costs a second
  // click to get out of it again. shadcn opens on hover and this did not, which made every panel
  // on the bar two interactions away instead of none.
  //
  // The panel is rendered inside its <li>, so it is a DOM descendant of the bar even while it is
  // painted in the top layer — which is what lets one pair of listeners on the bar cover both the
  // trigger and the panel, and what makes moving from one into the other not a leave at all.
  up.compiler('[data-slot="navigation-menu"]', (root) => {
    const triggers = () => [...root.querySelectorAll('[data-slot="navigation-menu-trigger"]')]
    const panelOf = (trigger) => document.getElementById(trigger.dataset.target)
    const openPanels = () => triggers().map(panelOf).filter((p) => p?.matches(':popover-open'))
    let opening, closing

    const over = (event) => {
      clearTimeout(closing)
      const trigger = event.target.closest('[data-slot="navigation-menu-trigger"]')
      if (!trigger) {
        // Something in the bar with no panel of its own — a plain link, the gap between two
        // items. Arriving there is leaving whatever is open, and it used to leave it open with
        // the pointer nowhere near it. Not while inside a panel: that is where the pointer goes
        // to use the thing it just opened.
        if (!event.target.closest('[data-slot="navigation-menu-content"]')) {
          clearTimeout(opening)
          openPanels().forEach((panel) => panel.hidePopover())
        }
        return
      }
      clearTimeout(opening)
      const panel = panelOf(trigger)
      if (!panel || panel.matches(':popover-open')) return
      // Instant while a panel is already open, delayed while none is. Crossing the bar on the way
      // to somewhere else should not flash five panels; moving ALONG it should not stutter.
      opening = setTimeout(() => panel.showPopover(), openPanels().length ? 0 : 150)
    }

    // Leaving for something outside the bar closes it, after long enough to cross the gap between
    // a trigger and the panel under it — a menu that shuts in that gap is a menu you cannot use.
    //
    // :hover rather than relatedTarget alone. Crossing from a trigger into its panel is a move
    // into the top layer, and a browser may report that with no relatedTarget at all — which read
    // as "left the bar" and closed the panel the pointer had just entered. The panel is a DOM
    // child of the bar however it is painted, so asking the bar whether it is still hovered is
    // the question that has the same answer in every browser.
    const out = (event) => {
      if (event.relatedTarget && root.contains(event.relatedTarget)) return
      clearTimeout(opening)
      clearTimeout(closing)
      closing = setTimeout(() => {
        if (root.matches(':hover')) return
        openPanels().forEach((p) => p.hidePopover())
      }, 200)
    }

    root.addEventListener('pointerover', over)
    root.addEventListener('pointerout', out)

    return () => {
      clearTimeout(opening)
      clearTimeout(closing)
      root.removeEventListener('pointerover', over)
      root.removeEventListener('pointerout', out)
    }
  })

  // A submenu opens away from the parent along the reading direction, and falls back to the
  // other side when there is no room. Both halves flip under RTL: opening to the right in
  // Arabic puts the submenu on top of the menu it came from.
  function placeBeside(panel, row) {
    const a = row.getBoundingClientRect()
    const p = panel.getBoundingClientRect()
    const flip = rtl(row)
    let left = flip ? a.left - p.width + 4 : a.right - 4
    if (flip) {
      if (left < 8) left = Math.min(a.right - 4, window.innerWidth - p.width - 8)
    } else if (left + p.width > window.innerWidth - 8) {
      left = Math.max(8, a.left - p.width + 4)
    }
    put(panel, { left }, Math.min(a.top - 4, window.innerHeight - p.height - 8))
  }

  // Keyboard within an open menu, for all three families. Radix roves focus; so does this.
  // The key that opens a submenu is the one pointing along the reading direction — Right in
  // English, Left in Arabic — and the other one closes it. The APG says so, and hard-coding
  // Right leaves an RTL user opening a submenu with the key that visually points back at the
  // menu they came from.
  up.compiler('[data-slot="dropdown-menu-content"], [data-slot="context-menu-content"], ' +
              '[data-slot="menubar-content"], [data-slot="dropdown-menu-sub-content"], ' +
              '[data-slot="context-menu-sub-content"], [data-slot="menubar-sub-content"]',
              (panel) => {
    const onKey = (event) => {
      const forward = rtl(panel) ? 'ArrowLeft' : 'ArrowRight'
      const back = rtl(panel) ? 'ArrowRight' : 'ArrowLeft'
      if (event.key === forward && document.activeElement?.matches('[aria-haspopup=menu]')) {
        event.preventDefault()
        document.activeElement.click()
        return
      }
      if (event.key === back && panel.getAttribute('data-slot').includes('sub-content')) {
        event.preventDefault()
        panel.hidePopover()
        return
      }
      const items = [...panel.querySelectorAll('[data-slot$="-item"]:not([data-disabled]), ' +
                                               '[data-slot$="-sub-trigger"]')]
      if (items.length === 0) return
      const from = items.indexOf(document.activeElement)
      if (event.key === 'ArrowDown') { event.preventDefault(); items[(from + 1) % items.length].focus() }
      else if (event.key === 'ArrowUp') { event.preventDefault(); items[(from - 1 + items.length) % items.length].focus() }
      else if (event.key === 'Home') { event.preventDefault(); items[0].focus() }
      else if (event.key === 'End') { event.preventDefault(); items[items.length - 1].focus() }
    }
    // Hovering a sub-trigger opens its submenu, as Radix does — a menu is a pointer surface,
    // and needing a CLICK to open a submenu reads as broken. Hovering a plain item closes any
    // submenu hanging off this panel, so moving down the list retracts what you passed.
    let hoverTimer
    // Where the pointer actually is when the retract timer fires. Crossing the parent's other
    // rows on the way to an open submenu is the ordinary diagonal path, and it was enough to
    // retract the submenu out from under the pointer just before it arrived — the report was
    // "moving into the submenu loses the menu", and it is this.
    let at = { x: 0, y: 0 }
    const owned = () => [...panel.querySelectorAll('[data-slot$="-sub-trigger"]')]
      .map((trigger) => document.getElementById(trigger.dataset.target))
      .filter((child) => child && child.matches(':popover-open'))
    const pointerInSubmenu = () => {
      const under = document.elementFromPoint(at.x, at.y)
      return !!under && owned().some((child) => child.contains(under))
    }

    const onOver = (event) => {
      at = { x: event.clientX, y: event.clientY }
      const sub = event.target.closest('[data-slot$="-sub-trigger"]')
      clearTimeout(hoverTimer)
      if (sub && panel.contains(sub)) {
        hoverTimer = setTimeout(() => {
          const child = document.getElementById(sub.dataset.target)
          if (child && !child.matches(':popover-open')) sub.click()
        }, 100)
        return
      }
      const item = event.target.closest('[data-slot$="-item"]')
      // Focus follows the pointer, as Radix's data-highlighted does: the row lights up under
      // the mouse, and the arrow keys continue from wherever the pointer left off. Without
      // this only Tab and the arrows highlighted anything, and the menu read as inert.
      if (item && panel.contains(item) && !item.hasAttribute('data-disabled')) item.focus()
      if (item && item.parentElement?.closest('[data-slot]') !== null) {
        hoverTimer = setTimeout(() => {
          // Not if the pointer has already reached the submenu. It is a sibling in the top
          // layer rather than a descendant of this panel, so no containment check on the event
          // can see it — where the pointer IS can.
          if (pointerInSubmenu()) return
          for (const child of owned()) child.hidePopover()
        }, 150)
      }
    }

    // Leaving the menu unlights the row, as Radix does. Highlighting here IS focus, so the row
    // keeps it until something else takes it -- which left a menu you had merely passed through
    // showing a lit row with the pointer nowhere near it. Focus goes back to the panel, so the
    // arrow keys still start from the top and nothing traps it outside the menu.
    const onLeave = (event) => {
      if (event.relatedTarget && panel.contains(event.relatedTarget)) return
      // Leaving INTO this panel's own submenu is not leaving the menu: the row that opened it
      // has to stay lit, or the trail back to where you came from goes out behind you.
      if (event.relatedTarget && owned().some((child) => child.contains(event.relatedTarget))) return
      const item = panel.contains(document.activeElement) ? document.activeElement : null
      if (item && item !== panel) panel.focus({ preventScroll: true })
    }

    // Somewhere for focus to go when the pointer leaves. A [popover] is not focusable on its
    // own, and focus with nowhere to land falls to <body> -- which closes the menu, because
    // light dismiss treats that as focus leaving.
    panel.tabIndex = -1

    panel.addEventListener('keydown', onKey)
    panel.addEventListener('pointerover', onOver)
    panel.addEventListener('pointerleave', onLeave)
    return () => {
      panel.removeEventListener('keydown', onKey)
      panel.removeEventListener('pointerover', onOver)
      panel.removeEventListener('pointerleave', onLeave)
      clearTimeout(hoverTimer)
    }
  })

  // Choosing an item closes the menu it is in, and any menu that opened it. Nothing did this:
  // the panel stayed open after a click, so picking "CSV" left the menu sitting there and read
  // as "the dropdown will not let me choose". Radix closes on select and so does every other
  // menu; a sub-trigger is the exception, because its whole job is to open the next panel.
  up.compiler('[data-slot="dropdown-menu-content"], [data-slot="context-menu-content"], ' +
              '[data-slot="menubar-content"], [data-slot="dropdown-menu-sub-content"], ' +
              '[data-slot="context-menu-sub-content"], [data-slot="menubar-sub-content"]',
              (panel) => {
    const onClick = (event) => {
      const item = event.target.closest('[data-slot$="-item"]')
      if (!item || item.closest('[data-slot$="-sub-trigger"]') || item.hasAttribute('data-disabled')) return
      // A row that carries STATE is not a row that performs an action: ticking one is meant to
      // be repeatable, and closing the menu after each tick made "select several" mean "open the
      // menu three times". Base UI's CheckboxItem and RadioItem default to closeOnClick: false
      // for the same reason.
      if (item.matches('[data-slot$="-checkbox-item"], [data-slot$="-radio-item"]')) return
      // The chain, not just this panel: an item in a submenu closes the menu it hangs off too.
      // Every family listed by NAME — the first version said [data-slot$="menu-content"], and
      // "menubar-content" does not end in "menu-content", so a menubar item never closed its
      // menu. An ends-with shortcut that reads as covering a family is worse than a list.
      for (const open of document.querySelectorAll(
             '[data-slot="dropdown-menu-content"]:popover-open, '
             + '[data-slot="context-menu-content"]:popover-open, '
             + '[data-slot="menubar-content"]:popover-open, '
             + '[data-slot$="sub-content"]:popover-open')) {
        open.hidePopover()
      }
    }
    panel.addEventListener('click', onClick)
    return () => panel.removeEventListener('click', onClick)
  })

  // =============================================================================================
  // Calendar range — two ticks, and everything between them
  // =============================================================================================
  // With scripting off a range calendar is a grid of checkboxes: tick the first day and the last,
  // and the server takes the min and the max. That already works, and this only makes it behave
  // the way a range picker should — a third click starts a new range, and the band between the
  // two ends fills in as you go. The boxes stay the state; nothing here remembers anything.

  up.compiler('[data-slot="calendar"][data-mode="range"]', (calendar) => {
    const boxes = () => [...calendar.querySelectorAll('input[type=checkbox]')]
    const ticked = () => boxes().filter((b) => b.checked)
    const day = (box) => box.value

    const paint = () => {
      const on = ticked().map(day).sort()
      const [from, to] = [on[0], on[on.length - 1]]
      for (const box of boxes()) {
        const cell = box.closest('td')
        const inside = from && to && from !== to && day(box) > from && day(box) < to
        const end = from && to && from !== to && (day(box) === from || day(box) === to)
        cell.classList.toggle('bg-accent', Boolean(inside || end))
        cell.classList.toggle('rounded-s-md', day(box) === from && from !== to)
        cell.classList.toggle('rounded-e-md', day(box) === to && from !== to)
        // The days between are shown, not selected: only the two ends post.
        cell.toggleAttribute('data-in-range', Boolean(inside))
      }
    }

    const onChange = (event) => {
      const box = event.target
      if (!box.matches('input[type=checkbox]')) return
      const on = ticked()
      // A third tick starts again from the day just clicked, which is what every range picker
      // does and what a bare checkbox grid would not.
      if (box.checked && on.length > 2) {
        for (const other of on) if (other !== box) other.checked = false
      }
      paint()
    }

    calendar.addEventListener('change', onChange)
    paint()

    return () => calendar.removeEventListener('change', onChange)
  })

  // =============================================================================================
  // Select all — one box that owns a column of boxes
  // =============================================================================================
  // React keeps a Set in state and derives both directions from it. Here the boxes ARE the
  // state: the header box writes them, and reads itself back from them, so nothing can drift.
  // Indeterminate is a property rather than an attribute, which is why it is set here and not
  // in the markup — the "some but not all" state has no HTML spelling.

  up.compiler('[data-select-all]', (master) => {
    const scope = master.closest('form, table, [data-select-scope]') || document
    const boxes = () => [...scope.querySelectorAll(
      `input[type=checkbox][name="${master.dataset.selectAll}"]`)].filter((b) => !b.disabled)

    const sync = () => {
      const all = boxes()
      const on = all.filter((b) => b.checked).length
      master.checked = on > 0 && on === all.length
      master.indeterminate = on > 0 && on < all.length
    }

    const onMaster = () => {
      for (const box of boxes()) box.checked = master.checked
      master.indeterminate = false
    }

    const onOne = (event) => { if (event.target.name === master.dataset.selectAll) sync() }

    master.addEventListener('change', onMaster)
    scope.addEventListener('change', onOne)
    sync()

    return () => {
      master.removeEventListener('change', onMaster)
      scope.removeEventListener('change', onOne)
    }
  })

  // =============================================================================================
  // Chart tooltip — the card Recharts draws on a canvas, drawn as an element instead
  // =============================================================================================
  // The chart is a table, so every number is already in the DOM. This adds the pointer view: one
  // card per chart, filled from the data attributes of whatever the pointer is over. Nothing is
  // measured and no series data lives in JavaScript — the markup carries it.

  up.compiler('[data-slot="chart"]:has([data-slot="chart-tooltip"])', (chart) => {
    const card = chart.querySelector('[data-slot="chart-tooltip"]')

    const rows = (point) => {
      const series = (point.dataset.chartSeries || '').split(',').map((s) => s.trim())
      const values = (point.dataset.chartValue || '').split(',').map((s) => s.trim())
      const labels = (point.dataset.chartName || '').split(',').map((s) => s.trim())
      const indicator = card.dataset.indicator || 'dot'

      return series.map((key, i) => {
        // The swatch reads the same --color-KEY the bar is painted with, so a theme change moves
        // both at once and neither can be told the wrong colour.
        const shape = indicator === 'dot' ? 'h-2.5 w-2.5'
          : indicator === 'line' ? 'w-1'
          : 'w-0 border-[1.5px] border-dashed bg-transparent'
        const swatch = `<div data-chart-tooltip-indicator class="shrink-0 rounded-[2px] `
          + `${shape}" style="background:var(--color-${key});border-color:var(--color-${key})"></div>`
        const value = Number(values[i])
        const shown = Number.isFinite(value) ? value.toLocaleString() : (values[i] ?? '')
        return `<div class="flex w-full flex-wrap items-center gap-2">${swatch}`
          + `<div class="flex flex-1 items-center justify-between leading-none">`
          + `<span class="text-muted-foreground">${labels[i] || key}</span>`
          + `<span class="font-mono font-medium text-foreground tabular-nums">${shown}</span>`
          + `</div></div>`
      }).join('')
    }

    // Follows the POINTER, not the bar. Anchoring it to the middle of the column meant the card
    // sat a long way from the cursor on a wide bar and did not move as you swept across — which
    // reads as a tooltip belonging to something else. Recharts follows the cursor and so does
    // this; it flips to the other side near an edge so it never leaves the window.
    const show = (point, x, y) => {
      card.innerHTML = `<div data-chart-tooltip-label class="font-medium">`
        + `${point.dataset.chartLabel ?? ''}</div>`
        + `<div class="grid gap-1.5">${rows(point)}</div>`
      card.hidden = false
      const own = card.getBoundingClientRect()
      const gap = 12
      const left = x + gap + own.width > window.innerWidth - 8 ? x - gap - own.width : x + gap
      const top = y - own.height - gap < 8 ? y + gap : y - own.height - gap
      card.style.left = `${Math.round(Math.max(8, left))}px`
      card.style.top = `${Math.round(Math.max(8, top))}px`
    }

    const onOver = (event) => {
      const point = event.target.closest('[data-chart-point]')
      if (point && chart.contains(point)) show(point, event.clientX, event.clientY)
      else card.hidden = true
    }
    const onLeave = () => { card.hidden = true }

    chart.addEventListener('pointermove', onOver)
    chart.addEventListener('pointerleave', onLeave)

    return () => {
      chart.removeEventListener('pointermove', onOver)
      chart.removeEventListener('pointerleave', onLeave)
    }
  })

  // =============================================================================================
  // ContextMenu — the right button, and the two other ways to ask for the same thing
  // =============================================================================================
  // One `contextmenu` listener covers the right button, the context-menu key and a long press on
  // touch, because the platform fires the same event for all three. A right-click handler bolted
  // onto a div gets only the first, which is how context menus end up unreachable by keyboard.

  up.compiler('[data-slot="context-menu"]', (root) => {
    const panel = document.getElementById(root.dataset.target)
    const trigger = root.querySelector('[data-slot="context-menu-trigger"]')
    if (!panel || !trigger) return

    const onContextMenu = (event) => {
      event.preventDefault()
      if (panel.matches(':popover-open')) panel.hidePopover()
      panel.showPopover()

      // The keyboard route carries no pointer position, and 0,0 from a key press would put the
      // menu in the corner of the screen rather than on the thing it belongs to.
      const box = panel.getBoundingClientRect()
      const side = panel.dataset.side

      if (side) {
        // side chooses which side of the CURSOR the menu opens on — it still belongs to the
        // click, exactly where the pointer is, and only the direction it grows in changes.
        // The first version anchored it to the trigger box, which put the menu nowhere near
        // the mouse: a context menu that opens away from the click reads as someone else's.
        const px = event.clientX || trigger.getBoundingClientRect().left
        const py = event.clientY || trigger.getBoundingClientRect().bottom
        // Two pixels put the pointer ON the first row, which opened the menu with that row
        // already highlighted and one flick away from being chosen. The gap is the panel's own
        // padding, so the pointer lands on the frame and the list starts unhighlighted.
        const gap = 6
        // Flip to the opposite side when the chosen one has no room. Clamping instead slid the
        // panel back UNDER the cursor, which is the one place it must not be: the row beneath
        // the pointer lights up the moment the menu appears, and a menu that opens with a row
        // already chosen is a menu one twitch away from choosing it.
        let at = side
        if (at === 'left' && px - box.width - gap < 8) at = 'right'
        else if (at === 'right' && px + box.width + gap > window.innerWidth - 8) at = 'left'
        else if (at === 'top' && py - box.height - gap < 8) at = 'bottom'
        else if (at === 'bottom' && py + box.height + gap > window.innerHeight - 8) at = 'top'

        // Opening to the LEFT pins the panel's right edge rather than subtracting its own width
        // from the cursor: the width is measured before the panel has settled, and the gap came
        // out as zero — the panel touching the pointer, which is the whole thing being avoided.
        const across = at === 'left' || at === 'right'
        const top = across ? Math.max(8, Math.min(py - box.height / 2, window.innerHeight - box.height - 8))
          : at === 'top' ? py - box.height - gap : py + gap
        const edge = at === 'left' ? { right: window.innerWidth - (px - gap) }
          : at === 'right' ? { left: px + gap }
          : { left: Math.max(8, Math.min(px - box.width / 2, window.innerWidth - box.width - 8)) }
        put(panel, edge, top)
        panel.dataset.placedSide = at
        trigger.setAttribute('aria-expanded', 'true')
        panel.focus({ preventScroll: true })
        return
      }

      const fromKeyboard = event.clientX === 0 && event.clientY === 0
      const at = fromKeyboard ? trigger.getBoundingClientRect() : null
      const x = at ? at.left : event.clientX
      const y = at ? at.bottom : event.clientY

      const left = rtl(trigger) ? x - box.width - 2 : x + 2
      put(panel, { left: Math.max(8, Math.min(left, window.innerWidth - box.width - 8)) },
          Math.min(y + 2, window.innerHeight - box.height - 8))
      trigger.setAttribute('aria-expanded', 'true')
      panel.focus({ preventScroll: true })
    }

    const onToggle = (event) => {
      // The page must not scroll under an open context menu — the panel is fixed, so scrolling
      // detaches it from the thing it belongs to. Radix locks the page; so does this.
      document.documentElement.style.overflow = event.newState === 'open' ? 'hidden' : ''
      if (event.newState !== 'open') trigger.setAttribute('aria-expanded', 'false')
    }

    trigger.addEventListener('contextmenu', onContextMenu)
    panel.addEventListener('toggle', onToggle)

    return () => {
      trigger.removeEventListener('contextmenu', onContextMenu)
      panel.removeEventListener('toggle', onToggle)
      panel.removeEventListener('pointerover', onHighlight)
    }
  })

  // =============================================================================================
  // Menubar — what makes a bar of dropdowns a menubar
  // =============================================================================================
  // Two behaviours, and they are the whole difference. Left and Right move along the bar rather
  // than into the page. And once ANY menu is open, hovering another opens that one instead of
  // doing nothing — the thing that makes a menubar feel like one, and the only part of it that
  // is not free.

  up.compiler('[data-slot="menubar"]', (bar) => {
    const triggers = () => [...bar.querySelectorAll('[data-slot="menubar-trigger"]')]
    const panelFor = (trigger) => document.getElementById(trigger.dataset.target)

    const openMenuFor = (trigger) => {
      const panel = panelFor(trigger)
      if (!panel || panel.matches(':popover-open')) return
      for (const other of triggers()) {
        if (other !== trigger) panelFor(other)?.hidePopover()
      }
      panel.showPopover()
    }

    const anyOpen = () => triggers().some((t) => panelFor(t)?.matches(':popover-open'))

    const onOver = (event) => {
      const trigger = event.target.closest?.('[data-slot="menubar-trigger"]')
      if (trigger && anyOpen()) openMenuFor(trigger)
    }

    const onKey = (event) => {
      const all = triggers()
      const at = all.indexOf(event.target.closest('[data-slot="menubar-trigger"]'))
      if (at < 0) return
      const forward = rtl(bar) ? 'ArrowLeft' : 'ArrowRight'
      const back = rtl(bar) ? 'ArrowRight' : 'ArrowLeft'
      if (event.key === forward) { event.preventDefault(); all[(at + 1) % all.length].focus() }
      else if (event.key === back) { event.preventDefault(); all[(at - 1 + all.length) % all.length].focus() }
      else if (event.key === 'ArrowDown') { event.preventDefault(); openMenuFor(all[at]) }
    }

    bar.addEventListener('pointerover', onOver)
    bar.addEventListener('keydown', onKey)

    return () => {
      bar.removeEventListener('pointerover', onOver)
      bar.removeEventListener('keydown', onKey)
    }
  })

  // =============================================================================================
  // Drawer — the one thing a sheet cannot do
  // =============================================================================================
  // Everything else about a drawer is <Sheet>: a native <dialog> for the top layer, the focus
  // trap, Escape and ::backdrop. What vaul adds, and the only reason it exists, is that you can
  // drag it shut — which on a phone is the gesture people reach for before they look for a close
  // button. Past a third of the panel it closes; short of that it springs back.
  //
  // Pointer events, not touch events: the same code then works for a mouse drag and a stylus,
  // and setPointerCapture means letting go outside the panel still ends the drag.

  up.compiler('[data-slot="drawer-trigger"]', (trigger) => {
    const onClick = () => {
      const dialog = document.getElementById(trigger.dataset.open)
      if (!dialog) return
      // show(), not showModal(), when the drawer says it is not modal: no backdrop, no focus
      // trap, and the page behind stays usable. That is the whole of upstream's modal={false},
      // and it was written off as impossible because "showModal is modal by definition" — which
      // is true, and is why this calls the other method.
      if (dialog.dataset.modal === 'false') dialog.show()
      else dialog.showModal()
    }
    trigger.addEventListener('click', onClick)
    return () => trigger.removeEventListener('click', onClick)
  })

  up.compiler('dialog[data-slot="drawer"]', (dialog) => {
    const panel = dialog.querySelector('[data-slot="drawer-content"]')
    if (!panel) return

    const vertical = dialog.dataset.direction !== 'left' && dialog.dataset.direction !== 'right'
    const towards = dialog.dataset.direction === 'top' || dialog.dataset.direction === 'left' ? -1 : 1
    let from = null

    // Snap points, in pixels, smallest first. A bare number is a fraction of the viewport along
    // the axis the drawer travels — upstream's ["31rem", 1] is "a peek, then nearly all of it".
    // Resolved by asking the browser what the length means rather than parsing units here.
    const axis = () => (vertical ? window.innerHeight : window.innerWidth)
    const points = (dialog.dataset.snapPoints || '').split(/\s+/).filter(Boolean)

    // Measured on demand, against the BODY. Inside the dialog the probe measured zero, because a
    // closed <dialog> is display:none and nothing in it has a layout — so the panel opened one
    // pixel tall. And on demand rather than once, so a resized window still snaps to the right
    // fractions.
    const snaps = () => points.map((point) => {
      const asNumber = Number(point)
      if (!Number.isNaN(asNumber)) return asNumber * axis()
      const probe = document.createElement('div')
      probe.style.cssText =
        `position:absolute;visibility:hidden;pointer-events:none;${vertical ? 'height' : 'width'}:${point}`
      document.body.append(probe)
      const px = vertical ? probe.offsetHeight : probe.offsetWidth
      probe.remove()
      return px
    }).sort((a, b) => a - b)

    // The panel opens at the first snap point, and every later rest is written to the same
    // property — so the size is one number the drag moves, not a transform to unwind afterwards.
    const restAt = (px) => {
      panel.style[vertical ? 'height' : 'width'] = `${Math.round(px)}px`
      panel.style[vertical ? 'maxHeight' : 'maxWidth'] = 'none'
    }
    const onOpen = () => { if (points.length) restAt(snaps()[0]) }
    if (points.length) {
      dialog.addEventListener('close', () => { panel.style.height = panel.style.width = '' })
    }

    // Escape belongs to a MODAL dialog; a non-modal one is left to the page, so a drawer opened
    // with show() ignored it. The key is the same key either way to whoever is pressing it.
    const onEscape = (event) => {
      if (event.key === 'Escape' && dialog.open && dialog.dataset.modal === 'false') dialog.close()
    }
    if (dialog.dataset.modal === 'false') document.addEventListener('keydown', onEscape)

    const offset = (event) => (vertical ? event.clientY : event.clientX)

    const onDown = (event) => {
      // Not on a control: dragging must not steal a press meant for a button or a text field.
      if (event.target.closest('button, a, input, select, textarea, [contenteditable]')) return
      from = offset(event)
      grabbed = vertical ? panel.offsetHeight : panel.offsetWidth
      panel.setPointerCapture(event.pointerId)
      panel.style.transition = 'none'
    }

    let grabbed = 0

    const onMove = (event) => {
      if (from === null) return
      const moved = (offset(event) - from) * towards
      // With snap points the drag RESIZES the panel — both ways, because pulling it further open
      // is half the point of having them. Without them it can only be pushed shut.
      if (points.length) {
        const stops = snaps()
        restAt(Math.max(24, Math.min(grabbed - moved, stops[stops.length - 1])))
        return
      }
      if (moved <= 0) return                       // dragging further in does nothing
      panel.style.transform = vertical ? `translateY(${moved * towards}px)`
                                       : `translateX(${moved * towards}px)`
    }

    const onUp = (event) => {
      if (from === null) return
      const moved = (offset(event) - from) * towards
      const span = vertical ? panel.offsetHeight : panel.offsetWidth
      from = null
      panel.style.transition = ''

      if (points.length) {
        const stops = snaps()
        const now = vertical ? panel.offsetHeight : panel.offsetWidth
        // Below half the smallest rest, the gesture was "put it away" rather than "make it
        // smaller" — every drawer with snap points still has to be closeable by dragging.
        if (now < stops[0] / 2) { dialog.close(); return }
        restAt(stops.reduce((best, point) =>
          Math.abs(point - now) < Math.abs(best - now) ? point : best, stops[0]))
        return
      }

      panel.style.transform = ''
      if (moved > span / 3) dialog.close()
    }

    // The first snap point is where it opens, so the panel is never full height for a frame
    // before shrinking to its rest.
    const watch = new MutationObserver(() => { if (dialog.open) onOpen() })
    watch.observe(dialog, { attributes: true, attributeFilter: ['open'] })
    if (dialog.open) onOpen()

    panel.addEventListener('pointerdown', onDown)
    panel.addEventListener('pointermove', onMove)
    panel.addEventListener('pointerup', onUp)
    panel.addEventListener('pointercancel', onUp)

    return () => {
      watch.disconnect()
      document.removeEventListener('keydown', onEscape)
      panel.removeEventListener('pointerdown', onDown)
      panel.removeEventListener('pointermove', onMove)
      panel.removeEventListener('pointerup', onUp)
      panel.removeEventListener('pointercancel', onUp)
    }
  })

  // =============================================================================================
  // Combobox — filter, choose, and post what was chosen
  // =============================================================================================
  // The value lives in a real <input type="hidden">, so the form posts it, a fragment swap cannot
  // lose it, and the server reads it with no JSON anywhere. Everything below is presentation over
  // that one fact.

  up.compiler('[data-slot="combobox"]', (root) => {
    const panel = document.getElementById(root.dataset.target)
    if (!panel) return

    const multiple = root.dataset.multiple === 'true'
    const input = root.querySelector('[data-slot="combobox-chip-input"], input[type="text"]')
    const trigger = root.querySelector('[data-slot="combobox-trigger"]')
    const value = root.querySelector('[data-slot="combobox-value"]')
    const clear = root.querySelector('[data-slot="combobox-clear"]')
    const hidden = root.querySelector('input[type="hidden"][data-combobox-value]')
    // Captured now, because the multiple branch REMOVES unchosen inputs -- once the last one is
    // gone there is nowhere left to read the field's name from.
    const listName = hidden?.name || ''
    const empty = panel.querySelector('[data-slot="combobox-empty"]')
    const items = () => [...panel.querySelectorAll('[data-slot="combobox-item"]')]

    const shown = () => items().filter((i) => !i.hidden)

    // Set while a choice is closing the list, so the focus that closing returns to the input
    // cannot open it again. See onFocus.
    let justChose = false

    // data-label when the row carries one, because textContent on a row with an avatar and a
    // description returns all three run together — and that string is what the trigger shows.
    const label = (item) => item.dataset.label || item.textContent.replace(/\s+/g, ' ').trim()

    // Read the state rather than remember it. The button was unhidden only by choose(), so a
    // value the SERVER rendered — the ordinary case after a fragment swap, or after a form comes
    // back with errors — left a chosen combobox with no way to clear it, and the multiple branch
    // never unhid it at all.
    const syncClear = () => {
      if (!clear) return
      clear.hidden = !([...root.querySelectorAll('input[type="hidden"][data-combobox-value]')].some((p) => p.value)
        || root.querySelector('[data-slot="combobox-chip"]'))
    }

    const filter = () => {
      const q = fold((input?.value || '').trim())
      let count = 0
      for (const item of items()) {
        const hay = fold(item.textContent + ' ' + (item.dataset.keywords || ''))
        item.hidden = q ? !hay.includes(q) : false
        if (!item.hidden) count++
      }
      for (const group of panel.querySelectorAll('[data-slot="combobox-group"]')) {
        group.hidden = !group.querySelector('[data-slot="combobox-item"]:not([hidden])')
      }
      if (empty) empty.hidden = count > 0
    }

    const choose = (item) => {
      if (!multiple) {
        for (const other of items()) {
          const on = other === item
          other.dataset.selected = on ? 'true' : ''
          if (!on) delete other.dataset.selected
          other.setAttribute('aria-selected', String(on))
        }
        if (hidden) hidden.value = item.dataset.value
        if (value) value.textContent = label(item)
        if (input && !input.matches('[data-slot="combobox-chip-input"]')) {
          // A search box inside the panel resets; with no ComboboxValue the text box IS the
          // display and takes the label. Either way the filter must not survive the choice --
          // a list opened tomorrow filtered by yesterday's label reads as items having
          // vanished. (The popup pattern has BOTH: the trigger shows the value, the panel
          // holds the search, and each gets its own line above.)
          input.value = panel.contains(input) ? '' : (value ? input.value : label(item))
          for (const other of items()) other.hidden = false
          for (const group of panel.querySelectorAll('[data-slot="combobox-group"]')) group.hidden = false
          if (empty) empty.hidden = true
        }
        syncClear()
        justChose = true
        panel.hidePopover()
        trigger?.focus()
        // Cleared once that focus has been and gone. Clicking the box later is a new gesture and
        // opens the list as usual.
        setTimeout(() => { justChose = false }, 0)
        return
      }

      // Multiple: one hidden input per chosen value, all under the same name, which is what the
      // server reads as a list. Choosing an already-chosen row removes it.
      const chips = root.querySelector('[data-slot="combobox-chips"]')
      if (!chips) {
        // Multiple without chips: the trigger keeps a count and the list keeps the ticks. The
        // hidden inputs still toggle one per value -- this branch used to return without doing
        // anything, which read as "multiple select is broken", because it was.
        const posts = () => [...root.querySelectorAll('input[type="hidden"][data-combobox-value]')]
        const existing = posts().find((p) => p.value === item.dataset.value)
        if (existing) {
          existing.remove()
          delete item.dataset.selected
          item.setAttribute('aria-selected', 'false')
        } else {
          const post = document.createElement('input')
          post.type = 'hidden'
          post.name = listName
          post.value = item.dataset.value
          post.dataset.comboboxValue = ''
          root.prepend(post)
          item.dataset.selected = 'true'
          item.setAttribute('aria-selected', 'true')
        }
        const count = posts().length
        if (value) {
          value.textContent = count
            ? (value.dataset.countLabel || '{n} selected').replace('{n}', count)
            : (value.dataset.placeholder || '')
        }
        syncClear()
        return
      }
      const existing = chips.querySelector(`[data-slot="combobox-chip"][data-value="${item.dataset.value}"]`)
      if (existing) { existing.remove(); delete item.dataset.selected; syncClear(); return }
      item.dataset.selected = 'true'

      // Cloned from the template the component renders, not built here. Built here it wore
      // whatever class name the call site remembered to pass — usually none — so a chip added
      // by clicking was bare text next to a server-rendered one that was a proper badge with a
      // remove button. The template has all of it, including the button and its label.
      const template = chips.querySelector('[data-combobox-chip-template]')
      const chip = template?.content.firstElementChild?.cloneNode(true)
      if (!chip) return
      chip.dataset.value = item.dataset.value
      const post = chip.querySelector('input[type="hidden"]')
      if (post) post.value = item.dataset.value
      const remove = chip.querySelector('[data-slot="combobox-chip-remove"]')
      if (remove) remove.setAttribute('aria-label', `Remove ${label(item)}`)
      chip.insertBefore(document.createTextNode(label(item)), chip.firstChild)
      chips.insertBefore(chip, input)
      if (input) input.value = ''
      syncClear()
      filter()
    }

    const onClick = (event) => {
      // Wired to the panel AND the root, because the panel may be rendered outside the root --
      // but in the usual markup it is inside, so one click reaches both listeners. For a toggle
      // that is add-then-remove in the same gesture, which looked exactly like "nothing
      // happened". One handling per event.
      if (event.comboboxHandled) return
      event.comboboxHandled = true
      const remove = event.target.closest('[data-slot="combobox-chip-remove"]')
      if (remove) {
        const chip = remove.closest('[data-slot="combobox-chip"]')
        const item = items().find((i) => i.dataset.value === chip?.dataset.value)
        if (item) delete item.dataset.selected
        chip?.remove()
        syncClear()
        return
      }
      const item = event.target.closest('[data-slot="combobox-item"]')
      if (item && !item.disabled) choose(item)
    }

    const onKey = (event) => {
      const list = shown()
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault()
        if (!panel.matches(':popover-open')) panel.showPopover()
        const at = list.indexOf(document.activeElement)
        const next = event.key === 'ArrowDown' ? at + 1 : at - 1
        list[(next + list.length) % list.length]?.focus()
      } else if (event.key === 'Escape' && panel.matches(':popover-open')) {
        panel.hidePopover()
      }
    }

    const onInput = () => {
      if (!panel.matches(':popover-open')) panel.showPopover()
      filter()
    }

    // The recipe styles data-highlighted and nothing set it: the list never responded to the
    // mouse. One attribute follows the pointer; focus stays in the input, as Radix keeps it.
    const onHighlight = (event) => {
      const item = event.target.closest('[data-slot="combobox-item"]')
      if (!item || item.disabled) return
      for (const other of items()) delete other.dataset.highlighted
      item.dataset.highlighted = 'true'
    }

    // Focusing the box opens the list. Only typing did, so a chips combobox showed nothing at
    // all until you had already typed a character — and the two examples built on it looked
    // completely inert. Every combobox opens on focus; this one had a trigger for the button
    // form and nothing for the input form.
    const onFocus = () => {
      // Not straight after choosing: closing the list hands focus back to the input, and that
      // focus would open it again. Chrome sent it to the body and hid the loop; Opera sends it
      // to the input, and the list reopened the instant it closed — which reads as "choosing
      // does nothing at all".
      if (justChose) return
      // A click on the input fires focus and click, and the trigger button inside the same
      // frame may open the panel between them -- showPopover() during another show throws
      // "Invalid to show a popover during another show operation", which killed the rest of the
      // handler. Ask the browser, and let the one that got there first win.
      if (!panel.matches(':popover-open')) { try { panel.showPopover() } catch { /* already opening */ } }
      if (input && !panel.contains(input) && input.value) input.select()
    }

    const onClear = () => {
      for (const item of items()) { delete item.dataset.selected; item.setAttribute('aria-selected', 'false') }
      for (const chip of root.querySelectorAll('[data-slot="combobox-chip"]')) chip.remove()
      if (multiple) for (const post of root.querySelectorAll('input[type="hidden"][data-combobox-value]')) post.remove()
      else if (hidden) hidden.value = ''
      if (input) input.value = ''
      if (value) value.textContent = value.dataset.placeholder || ''
      syncClear()
      filter()
    }

    const onToggle = (event) => {
      const open = event.newState === 'open'
      trigger?.setAttribute('aria-expanded', String(open))
      input?.setAttribute('aria-expanded', String(open))
      // The FRAME is the anchor, not the box inside it: an input-group's chevron and icon are
      // part of the control the reader sees, and a chips field is the whole bordered area. Left
      // to the inner input the list started at the text and stood out past the frame's edge.
      if (open) {
        const frame = (trigger || input)?.closest(
          '[data-slot="input-group"], [data-slot="combobox-chips"]') || trigger || root
        place(panel, frame, 'start', 'bottom', 4)
      }
      // The popup pattern: the panel opened from a button and the search box lives inside it.
      // Focus goes straight there, which is what makes it a search box rather than an ornament.
      if (open && input && panel.contains(input)) input.focus()
    }

    panel.addEventListener('click', onClick)
    root.addEventListener('click', onClick)
    root.addEventListener('keydown', onKey)
    panel.addEventListener('keydown', onKey)
    input?.addEventListener('input', onInput)
    input?.addEventListener('focus', onFocus)
    // click, not pointerdown: opening on pointerdown puts the panel in the top layer before the
    // click completes, and the browser's own light-dismiss then sees a click outside it and
    // closes it again in the same gesture. The list flashed and vanished.
    input?.addEventListener('click', onFocus)
    clear?.addEventListener('click', onClear)
    panel.addEventListener('toggle', onToggle)
    panel.addEventListener('pointerover', onHighlight)
    // A display input showing the chosen label must not pre-filter the list to that one label --
    // reopening would show a list of one. The filter belongs to typing, not to arriving.
    if (input && !panel.contains(input) && input.value && hidden?.value) {
      if (empty) empty.hidden = true
    } else {
      filter()
    }
    syncClear()

    return () => {
      panel.removeEventListener('click', onClick)
      root.removeEventListener('click', onClick)
      root.removeEventListener('keydown', onKey)
      panel.removeEventListener('keydown', onKey)
      input?.removeEventListener('input', onInput)
      input?.removeEventListener('focus', onFocus)
      input?.removeEventListener('click', onFocus)
      clear?.removeEventListener('click', onClear)
      panel.removeEventListener('toggle', onToggle)
    }
  })

  // =============================================================================================
  // Sidebar — the open state, and where it is kept
  // =============================================================================================
  // In a `sidebar_state` cookie, which is also where shadcn keeps it. That is the whole design:
  // the server reads the cookie, renders the right state on the first paint, and there is no
  // flash of a sidebar opening itself. This only has to keep the two in step afterwards.
  //
  // The trigger and the rail ship hidden and are revealed here. With no JavaScript there is
  // nothing to toggle, and a control that does nothing is worse than one that is absent — the
  // sidebar stays open and every link in it is still reachable.

  up.compiler('[data-sidebar-toggle]', (control) => {
    const wrapper = control.closest('[data-slot="sidebar-wrapper"]') || document.body

    const sidebars = () => [...wrapper.querySelectorAll('[data-slot="sidebar"]')]

    const onClick = () => {
      const open = wrapper.dataset.state !== 'expanded'
      wrapper.dataset.state = open ? 'expanded' : 'collapsed'

      for (const sidebar of sidebars()) {
        sidebar.dataset.state = open ? 'expanded' : 'collapsed'
        // data-collapsible carries the MODE only while collapsed, which is what upstream does
        // and what every group-data-[collapsible=icon] selector expects.
        sidebar.dataset.collapsible = open ? '' : (sidebar.dataset.mode || 'offcanvas')
      }

      // A year, path-wide, and SameSite=Lax so it survives an ordinary navigation from elsewhere
      // without being sent on a cross-site request.
      document.cookie = `sidebar_state=${open}; path=/; max-age=31536000; samesite=lax`
      control.setAttribute('aria-expanded', String(open))
    }

    // Remember the mode before the first collapse clears the attribute.
    for (const sidebar of sidebars()) {
      if (sidebar.dataset.collapsible) sidebar.dataset.mode = sidebar.dataset.collapsible
    }

    control.hidden = false
    control.setAttribute('aria-expanded', String(wrapper.dataset.state === 'expanded'))
    control.addEventListener('click', onClick)
    return () => control.removeEventListener('click', onClick)
  })

  // =============================================================================================
  // MessageScroller — stay at the newest message, unless the reader is reading
  // =============================================================================================
  // Every chat needs this and most get it wrong in one direction or the other: either it yanks
  // you to the bottom while you are reading something from ten minutes ago, or it silently stops
  // following and you miss the reply.
  //
  // The rule is simple once stated. Follow the newest message while the viewport is already at
  // the bottom; stop the moment it is not; and show a button that says so. `overflow-anchor: auto`
  // in the CSS does the first half without any script at all — the browser holds the scroll
  // position against content inserted above the anchor — and this adds the button.

  up.compiler('[data-slot="message-scroller"]', (root) => {
    const viewport = root.querySelector('[data-slot="message-scroller-viewport"]')
    if (!viewport) return

    const buttons = () => [...root.querySelectorAll('[data-slot="message-scroller-button"]')]
    const margin = () => Number(root.dataset.scrollMargin || 24)
    const follows = () => root.dataset.autoScroll !== 'false'
    const anchors = () => [...viewport.querySelectorAll('[data-scroll-anchor="true"]')]

    // Not === 0: a fractional scroll height never reaches the exact bottom, and a scroller that
    // is one pixel off is a scroller that never follows anything again.
    const atEnd = () => viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight < 8
    const atStart = () => viewport.scrollTop < 8

    // Where the thread can still go, published as state so a footer can say "you are at the
    // top" in CSS. This is upstream's useMessageScrollerScrollable, which is two booleans
    // wearing a hook's clothes.
    const sync = () => {
      const end = atEnd()
      root.dataset.following = end ? 'true' : 'false'
      root.dataset.canScrollStart = viewport.scrollTop > 8 ? 'true' : 'false'
      root.dataset.canScrollEnd = end ? 'false' : 'true'
      for (const button of buttons()) {
        const done = button.dataset.direction === 'start' ? atStart() : end
        button.hidden = done
        if (done) delete button.dataset.active
        else button.dataset.active = 'true'
      }
    }

    // A programmatic scroll hides the scrollbar while it runs, which is what the viewport's own
    // data-autoscrolling:scrollbar-none class has always been written against and what nothing
    // was setting.
    let settle
    const glide = (top, behavior = 'smooth') => {
      viewport.dataset.autoscrolling = 'true'
      viewport.scrollTo({ top, behavior })
      clearTimeout(settle)
      settle = setTimeout(() => { delete viewport.dataset.autoscrolling; sync() }, 400)
    }

    // An anchored turn sits at the TOP of the viewport with a peek of what came before it,
    // rather than the thread scrolling to its own bottom. That is the whole point of the
    // component: when a long answer arrives you are left looking at the question that caused it.
    const toAnchor = (behavior = 'smooth') => {
      const last = anchors().pop()
      if (!last) return false
      glide(last.offsetTop - margin(), behavior)
      return true
    }

    const toEnd = (behavior = 'smooth') => glide(viewport.scrollHeight, behavior)
    const toStart = (behavior = 'smooth') => glide(0, behavior)

    const onButton = (event) => {
      const button = event.target.closest('[data-slot="message-scroller-button"]')
      if (button) (button.dataset.direction === 'start' ? toStart : toEnd)()
    }

    // Anything on the page can ask for a turn by name — a jump menu, an outline, a link. It is
    // the markup half of upstream's scrollToMessage, and it needs no state to work.
    const onJump = (event) => {
      const jump = event.target.closest('[data-scroll-to-message]')
      if (!jump) return
      const item = viewport.querySelector(
        '[data-message-id="' + CSS.escape(jump.dataset.scrollToMessage) + '"]')
      if (!item) return
      event.preventDefault()
      glide(item.offsetTop - margin())
    }

    // New content follows only when the reader is at the bottom AND the thread was told to
    // follow. Content that arrives ABOVE them is different: prepending older messages grows the
    // scroll height above the reader, and following that is how "load older" throws away the
    // place they were reading. Then the scroll position moves by exactly what was added, so the
    // page under their eyes does not move at all.
    let height = viewport.scrollHeight
    let top = viewport.scrollTop
    const watch = new MutationObserver(() => {
      const grew = viewport.scrollHeight - height
      const prepended = grew > 0 && viewport.scrollTop === top && top > 0
      height = viewport.scrollHeight
      if (prepended) {
        viewport.scrollTop = top + grew
      } else if (follows() && root.dataset.following !== 'false') {
        if (!toAnchor('auto')) viewport.scrollTop = viewport.scrollHeight
      }
      top = viewport.scrollTop
      sync()
    })
    watch.observe(viewport, { childList: true, subtree: true })

    const onScroll = () => { top = viewport.scrollTop; sync() }
    viewport.addEventListener('scroll', onScroll, { passive: true })
    root.addEventListener('click', onButton)
    document.addEventListener('click', onJump)

    // Where it opens: the end, the start, or the last anchored turn — which is where a reader
    // coming back to a long thread left off.
    const openAt = root.dataset.openAt || 'end'
    if (openAt === 'start') viewport.scrollTop = 0
    else if (openAt !== 'anchor' || !toAnchor('auto')) viewport.scrollTop = viewport.scrollHeight
    height = viewport.scrollHeight
    top = viewport.scrollTop
    sync()

    return () => {
      watch.disconnect()
      clearTimeout(settle)
      viewport.removeEventListener('scroll', onScroll)
      root.removeEventListener('click', onButton)
      document.removeEventListener('click', onJump)
    }
  })

  // =============================================================================================
  // Tooltip
  // =============================================================================================
  // Hover AND focus, because a tooltip only reachable by mouse is a tooltip half the users never
  // see. Escape closes it, which the APG asks for and most implementations forget.

  up.compiler('[data-slot="tooltip-trigger"]', (trigger) => {
    const panel = document.getElementById(trigger.dataset.target)
    if (!panel) return
    let timer

    // Clicking dismisses the tip, and it stays dismissed until the pointer leaves and comes
    // back. Without this the click's own focus event reopened it a millisecond later, so the
    // dismissal was real and invisible.
    let dismissed = false

    const open = () => {
      if (dismissed) return
      clearTimeout(timer)
      timer = setTimeout(() => {
        panel.showPopover()
        place(panel, trigger, 'center', panel.dataset.side || 'top',
              Number(panel.dataset.sideOffset || 6))
        panel.dataset.state = 'delayed-open'
      }, Number(trigger.dataset.delay ?? 0))
    }

    const close = () => {
      clearTimeout(timer)
      panel.dataset.state = 'closed'
      if (panel.matches(':popover-open')) panel.hidePopover()
    }

    const onKey = (event) => { if (event.key === 'Escape') close() }

    // The pointer may travel INTO the tip. Radix calls this hoverable content and leaves it on
    // by default; without it a tip holding a <Kbd> or a link cannot be reached at all, because
    // leaving the trigger closed it before the pointer arrived. The hover card three hundred
    // lines down already did this.
    const leave = (event) => {
      const to = event.relatedTarget
      if (to && (panel.contains(to) || trigger.contains(to))) return
      dismissed = false
      close()
    }
    const stay = () => clearTimeout(timer)

    const onEnter = (event) => { at = { x: event.clientX, y: event.clientY }; open() }

    trigger.addEventListener('pointerenter', onEnter)
    trigger.addEventListener('pointerleave', leave)
    panel.addEventListener('pointerenter', stay)
    panel.addEventListener('pointerleave', leave)
    // Clicking the thing dismisses its label: whatever the click does next, the tip is now
    // sitting on top of the result.
    const dismiss = () => { dismissed = true; close() }
    trigger.addEventListener('pointerdown', dismiss)
    trigger.addEventListener('focus', open)
    trigger.addEventListener('blur', close)
    document.addEventListener('keydown', onKey)

    return () => {
      close()
      panel.removeEventListener('pointerenter', stay)
      panel.removeEventListener('pointerleave', leave)
      trigger.removeEventListener('pointerdown', dismiss)
      trigger.removeEventListener('pointerenter', onEnter)
      trigger.removeEventListener('pointerleave', leave)
      trigger.removeEventListener('focus', open)
      trigger.removeEventListener('blur', close)
      document.removeEventListener('keydown', onKey)
    }
  })

  // =============================================================================================
  // CodeBlock — copy
  // =============================================================================================
  // The button ships hidden and this reveals it. A copy button that silently does nothing because
  // the page is not on a secure origin is worse than no button at all, so it stays absent unless
  // the clipboard is actually there.

  up.compiler('[data-slot="code-block-copy"]', (button) => {
    if (!navigator.clipboard?.writeText) return
    button.hidden = false

    const code = button.closest('[data-slot="code-block"]')?.querySelector('[data-slot="code-block-code"]')
    if (!code) return

    let revert
    const onClick = async () => {
      try {
        await navigator.clipboard.writeText(code.textContent ?? '')
      } catch {
        // Denied, or no permission. Say nothing rather than claiming success.
        return
      }
      // Confirmed on the button itself: a toast for something this small is a toast people
      // learn to ignore.
      button.dataset.copied = ''
      clearTimeout(revert)
      revert = setTimeout(() => delete button.dataset.copied, 1500)
    }

    button.addEventListener('click', onClick)
    return () => {
      clearTimeout(revert)
      button.removeEventListener('click', onClick)
    }
  })

  // =============================================================================================
  // Command
  // =============================================================================================
  // Upstream is cmdk, which keeps the filtered list in React state. Here every item is already in
  // the DOM — as a link, usually — and this hides the ones that do not match. For a list the
  // server can render that is the same thing, and the palette still works with scripting off.
  //
  // Matching is on the visible text plus [data-keywords], so "billing" can find "Invoices".
  // Accents are stripped on both sides: someone typing "don" should find "Đơn hàng".

  const fold = (s) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()

  up.compiler('[data-slot="command"], [data-slot="command-dialog"]', (root) => {
    const input = root.querySelector('[data-slot="command-input"]')
    const list = root.querySelector('[data-slot="command-list"]')
    if (!input || !list) return

    const items = () => [...list.querySelectorAll('[data-slot="command-item"]:not([hidden])')]
    const empty = root.querySelector('[data-slot="command-empty"]')

    // Every item needs an id for aria-activedescendant to point at one.
    let seq = 0
    for (const item of list.querySelectorAll('[data-slot="command-item"]')) {
      if (!item.id) item.id = `cmd-${++seq}-${Math.abs(fold(item.textContent).length)}`
    }
    input.setAttribute('role', 'combobox')
    input.setAttribute('aria-expanded', 'true')
    input.setAttribute('aria-controls', list.id || (list.id = 'cmd-list-' + seq))

    const highlight = (item) => {
      for (const other of list.querySelectorAll('[data-slot="command-item"]')) {
        delete other.dataset.selected
      }
      if (!item) { input.removeAttribute('aria-activedescendant'); return }
      item.dataset.selected = 'true'
      input.setAttribute('aria-activedescendant', item.id)
      item.scrollIntoView({ block: 'nearest' })
    }

    const filter = () => {
      const q = fold(input.value.trim())
      let shown = 0

      for (const item of list.querySelectorAll('[data-slot="command-item"]')) {
        const hay = fold(item.textContent + ' ' + (item.dataset.keywords || ''))
        const match = !q || hay.includes(q)
        item.hidden = !match
        if (match) shown++
      }

      // A heading over nothing is worse than no heading.
      for (const group of list.querySelectorAll('[data-slot="command-group"]')) {
        group.hidden = !group.querySelector('[data-slot="command-item"]:not([hidden])')
      }
      if (empty) empty.hidden = shown > 0

      highlight(items()[0])
    }

    const onKey = (event) => {
      const shown = items()
      if (shown.length === 0) return
      const at = shown.findIndex((i) => i.dataset.selected === 'true')

      if (event.key === 'ArrowDown') {
        event.preventDefault()
        highlight(shown[(at + 1) % shown.length])
      } else if (event.key === 'ArrowUp') {
        event.preventDefault()
        highlight(shown[(at - 1 + shown.length) % shown.length])
      } else if (event.key === 'Home') {
        event.preventDefault(); highlight(shown[0])
      } else if (event.key === 'End') {
        event.preventDefault(); highlight(shown[shown.length - 1])
      } else if (event.key === 'Enter' && at >= 0) {
        // Let the item BE the click, so a link navigates and Unpoly follows it as usual.
        event.preventDefault()
        shown[at].click()
      }
    }

    input.addEventListener('input', filter)
    input.addEventListener('keydown', onKey)
    list.addEventListener('pointermove', (e) => {
      const item = e.target.closest('[data-slot="command-item"]')
      if (item && !item.hidden) highlight(item)
    })
    filter()

    return () => {
      input.removeEventListener('input', filter)
      input.removeEventListener('keydown', onKey)
    }
  })

  // The shortcut that opens a palette. `mod` is ⌘ on a Mac and Ctrl everywhere else, which is the
  // distinction every implementation gets wrong in one direction or the other.
  up.compiler('[data-command-key]', (dialog) => {
    const combo = (dialog.dataset.commandKey || 'mod+k').toLowerCase().split('+')
    const key = combo[combo.length - 1]
    const wantsMod = combo.includes('mod') || combo.includes('ctrl') || combo.includes('cmd')
    const wantsShift = combo.includes('shift')

    const onKey = (event) => {
      const mod = event.metaKey || event.ctrlKey
      if (event.key.toLowerCase() !== key) return
      if (wantsMod !== mod || wantsShift !== event.shiftKey) return
      event.preventDefault()
      if (dialog.open) dialog.close()
      else dialog.showModal()
    }

    // Focus the field, not the dialog: a palette that needs a second click to type into is a
    // palette nobody uses twice. Clear it too — the last search is not this one.
    const onOpen = () => {
      const input = dialog.querySelector('[data-slot="command-input"]')
      if (!input) return
      input.value = ''
      input.dispatchEvent(new Event('input', { bubbles: true }))
      input.focus()
    }

    document.addEventListener('keydown', onKey)
    dialog.addEventListener('toggle', (e) => { if (e.newState === 'open') onOpen() })
    return () => document.removeEventListener('keydown', onKey)
  })

  // =============================================================================================
  // InputOTP
  // =============================================================================================
  // Six real inputs rather than one hidden input with painted boxes. What that costs is this
  // compiler; what it buys is a field that posts, autofills, and survives a fragment swap with no
  // state of its own.
  //
  // The hidden input is the one the server sees. Keeping it in step here rather than joining the
  // boxes in every handler is the difference between one place to get it right and one per form.

  up.compiler('[data-slot="input-otp"]', (root) => {
    const boxes = [...root.querySelectorAll('[data-slot="input-otp-slot"]')]
    const hidden = root.querySelector('[data-otp-value]')
    if (boxes.length === 0 || !hidden) return

    const sync = () => {
      const next = boxes.map((b) => b.value).join('')
      // An empty set of boxes never overwrites a value the SERVER rendered: the compiler ran
      // once on boot and erased it, so a code that came back with the form was gone before
      // anyone saw it.
      if (!next && hidden.value) return
      if (next === hidden.value) return
      hidden.value = next
      // Filter forms and [up-autosubmit] watch the hidden input, and a programmatic assignment
      // fires nothing on its own.
      hidden.dispatchEvent(new Event('input', { bubbles: true }))
      hidden.dispatchEvent(new Event('change', { bubbles: true }))
    }

    // What counts as a character for THIS field. The filter was a hardcoded non-digit class,
    // so the alphanumeric example -- which advertises letters in its own pattern attribute --
    // blanked every letter typed into it and never advanced. Upstream takes the pattern as a
    // prop for the same reason; here the box already carries one.
    const allowed = (() => {
      const pattern = boxes[0].getAttribute('pattern')
      if (!pattern) return /[^0-9]/g
      try { return new RegExp('[^' + pattern.replace(/^\[|\]$/g, '') + ']', 'g') }
      catch { return /[^0-9]/g }
    })()
    const keep = (text) => text.replace(allowed, '')

    // Pasting the whole code is how most people enter one — from a message, not by typing.
    const spread = (digits, from = 0) => {
      for (let k = 0; k < digits.length && from + k < boxes.length; k++) {
        boxes[from + k].value = digits[k]
      }
      boxes[Math.min(from + digits.length, boxes.length - 1)].focus()
    }

    const onInput = (event) => {
      const box = event.target
      const i = boxes.indexOf(box)
      if (i < 0) return
      // A phone keyboard can deliver more than one character at a time.
      const typed = keep(box.value)
      box.value = typed.slice(0, 1)
      if (typed.length > 1) spread(typed, i)
      else if (box.value && i < boxes.length - 1) boxes[i + 1].focus()
      sync()
    }

    const onKeyDown = (event) => {
      const i = boxes.indexOf(event.target)
      if (i < 0) return
      if (event.key === 'Backspace' && !event.target.value && i > 0) {
        // Retreat AND clear, which is what a code field is expected to do: one backspace per
        // digit, not one to move and another to erase.
        event.preventDefault()
        boxes[i - 1].value = ''
        boxes[i - 1].focus()
        sync()
      } else if (event.key === (rtl(root) ? 'ArrowRight' : 'ArrowLeft') && i > 0) {
        event.preventDefault()
        boxes[i - 1].focus()
      } else if (event.key === (rtl(root) ? 'ArrowLeft' : 'ArrowRight')
                 && i < boxes.length - 1) {
        event.preventDefault()
        boxes[i + 1].focus()
      }
    }

    const onPaste = (event) => {
      const digits = keep(event.clipboardData?.getData('text') || '')
      if (!digits) return
      event.preventDefault()
      spread(digits)
      sync()
    }

    // Clicking box four while two and three are empty is almost never what was meant.
    const onFocus = (event) => {
      const firstEmpty = boxes.find((b) => !b.value && !b.disabled) || boxes[boxes.length - 1]
      if (boxes.indexOf(event.target) > boxes.indexOf(firstEmpty)) { firstEmpty.focus(); return }
      // Select what is there, so typing replaces it. maxlength="1" on a full box otherwise
      // swallows the keystroke silently and the caret never moves on.
      event.target.select?.()
    }

    root.addEventListener('input', onInput)
    root.addEventListener('keydown', onKeyDown)
    root.addEventListener('paste', onPaste)
    root.addEventListener('focusin', onFocus)
    sync()

    return () => {
      root.removeEventListener('input', onInput)
      root.removeEventListener('keydown', onKeyDown)
      root.removeEventListener('paste', onPaste)
      root.removeEventListener('focusin', onFocus)
    }
  })

  // =============================================================================================
  // HoverCard
  // =============================================================================================
  // A popover that opens on hover. It is decoration by definition — anything only reachable by
  // pointing at it is unreachable to a keyboard and to a touch screen — so the trigger stays a
  // real link or button and this only adds the preview. Focus opens it too, and Escape closes
  // it, because a keyboard user should be able to reach the same content the mouse gets.
  //
  // The pointer is allowed to travel from the trigger into the panel without it closing, which
  // is the one thing that makes a hover card usable and the one thing implementations forget.

  up.compiler('[data-slot="hover-card-trigger"]', (trigger) => {
    const panel = document.getElementById(trigger.dataset.target)
    if (!panel) return
    let openTimer, closeTimer

    const open = () => {
      clearTimeout(closeTimer)
      openTimer = setTimeout(() => {
        panel.showPopover()
        place(panel, trigger, panel.dataset.align, panel.dataset.side,
              Number(panel.dataset.sideOffset || 4))
      }, Number(trigger.dataset.openDelay ?? 600))
    }

    // A grace period, not an immediate close: the gap between the trigger and the panel is a
    // few pixels of nothing, and leaving through it must not count as leaving.
    const close = () => {
      clearTimeout(openTimer)
      closeTimer = setTimeout(() => {
        if (panel.matches(':popover-open')) panel.hidePopover()
      }, Number(trigger.dataset.closeDelay ?? 300))
    }

    const onKey = (event) => { if (event.key === 'Escape') { clearTimeout(openTimer); panel.hidePopover() } }

    // The safety net. pointerleave is the ordinary way this closes, and it is enough right up
    // until it is not: a card that opens over its own trigger, a pointer that leaves the window,
    // an element swapped out from under the cursor. Then no leave event ever arrives and the
    // card sits there with the pointer nowhere near it — which is exactly what gets reported.
    // So ask the document directly: pointer over neither, focus in neither, start closing.
    let at = null
    const elsewhere = () => {
      if (!panel.matches(':popover-open')) return false
      // Keyboard focus is exempt, mouse focus is not. A CLICK focuses the trigger too, and a
      // card that opens over its own trigger then produces no leave event either — so the two
      // exemptions met and the card stayed open with the pointer long gone. :focus-visible is
      // the browser's own answer to "did this focus come from the keyboard", which is the same
      // question that decides whether focus opens it at all.
      const held = trigger.contains(document.activeElement) || panel.contains(document.activeElement)
      if (held && (trigger.matches(':focus-visible') || panel.matches(':focus-within'))) return false

      // :hover first, and no coordinates involved. The browser maintains the hover chain itself
      // and keeps it right through a top-layer boundary, a swapped element and a pointer that
      // has stopped reporting — all three of which broke the coordinate bookkeeping this used to
      // depend on, and each of which leaves a card open with the pointer nowhere near it.
      if (trigger.matches(':hover') || panel.matches(':hover')) return false
      if (!at) return true

      const over = document.elementFromPoint(at.x, at.y)
      return !over || !(trigger.contains(over) || panel.contains(over))
    }

    const onMove = (event) => {
      at = { x: event.clientX, y: event.clientY }
      if (elsewhere()) close()
    }

    // A heartbeat, because the check above needs an event to run and a pointer can stop
    // producing them: parked outside the window, resting over browser chrome, moved by a gesture
    // the page never sees. Once a second, from wherever the pointer was last known to be.
    const beat = setInterval(() => { if (elsewhere()) close() }, 400)

    // And leaving the window is leaving the card.
    const onOut = (event) => { if (!event.relatedTarget) close() }

    document.addEventListener('pointermove', onMove, { passive: true })
    document.addEventListener('pointerout', onOut, { passive: true })
    window.addEventListener('blur', close)
    // Focus opens it for the KEYBOARD, not for the mouse. A click focuses the trigger too, and
    // then the card stayed open with the pointer long gone — the safety net leaves anything
    // holding focus alone, on purpose, so a card reached by Tab does not vanish while it is
    // being read. :focus-visible is the browser's own answer to "did this focus come from the
    // keyboard", which is exactly the question.
    const onFocus = () => { if (trigger.matches(':focus-visible')) open() }

    trigger.addEventListener('pointerenter', open)
    trigger.addEventListener('pointerleave', close)
    trigger.addEventListener('focus', onFocus)
    trigger.addEventListener('blur', close)
    panel.addEventListener('pointerenter', () => clearTimeout(closeTimer))
    panel.addEventListener('pointerleave', close)
    document.addEventListener('keydown', onKey)

    return () => {
      clearTimeout(openTimer)
      clearTimeout(closeTimer)
      trigger.removeEventListener('pointerenter', open)
      trigger.removeEventListener('pointerleave', close)
      trigger.removeEventListener('focus', onFocus)
      trigger.removeEventListener('blur', close)
      clearInterval(beat)
      document.removeEventListener('pointermove', onMove)
      document.removeEventListener('pointerout', onOut)
      window.removeEventListener('blur', close)
      document.removeEventListener('keydown', onKey)
    }
  })

  // =============================================================================================
  // Select
  // =============================================================================================
  // Radix Select is a listbox built from divs and a hidden input. On static SSR the real <select>
  // has to stay in the form — it is what posts, and it is what still works with scripting off. So
  // the native control is kept and hidden, and a shadcn-shaped panel is drawn beside it. Choosing
  // an item writes through to the <select> and dispatches a bubbling change event, so
  // [up-autosubmit] and filter forms behave exactly as they do without this enhancement.

  // <output for="…"> shows what a control currently holds. The element is built for exactly this
  // and the platform still makes you write the assignment, so this writes it once for every
  // output on the page rather than once per demo. It is the whole of shadcn's "controlled"
  // slider: there, the value lives in a state variable and is printed beside the label; here it
  // lives in the input, which is the thing that posts, and the output reads it.
  up.compiler('output[for]', (output) => {
    const source = document.getElementById(output.getAttribute('for'))
    if (!source) return

    const show = () => { output.textContent = source.value }
    source.addEventListener('input', show)
    show()
    return () => source.removeEventListener('input', show)
  })

  up.compiler('input[type="checkbox"][data-toggles]', (box) => {
    const target = document.getElementById(box.dataset.toggles)
    const name = box.dataset.togglesAttribute
    if (!target || !name) return

    const write = () => target.setAttribute(name,
      box.checked ? (box.dataset.togglesOn ?? 'true') : (box.dataset.togglesOff ?? 'false'))

    box.addEventListener('change', write)
    write()
    return () => box.removeEventListener('change', write)
  })

  up.compiler('select[data-slot="select"]', (select) => {
    if (select.multiple || select.closest('[data-slot="select-root"]')) return
    if (select.options.length === 0) return
    // A disabled select is still drawn. Bailing out left the native control on screen wearing no
    // recipe at all, so the one example whose whole subject is the disabled state was the one
    // place the component did not look like shadcn.
    const locked = select.disabled

    // Sizing and layout belong to the visible control, so the caller's own classes move to the
    // wrapper. <Select> hands them over verbatim in data-wrapper-class rather than leaving this to
    // subtract the recipe and guess.
    const wrap = el('span', cn('relative block', select.dataset.wrapperClass))
    wrap.dataset.slot = 'select-root'

    const trigger = el('button', SELECT_TRIGGER, { type: 'button' })
    trigger.dataset.slot = 'select-trigger'
    trigger.dataset.size = select.dataset.size || 'default'
    trigger.setAttribute('aria-haspopup', 'listbox')
    trigger.setAttribute('aria-expanded', 'false')
    if (select.getAttribute('aria-invalid')) trigger.setAttribute('aria-invalid', 'true')
    if (locked) trigger.disabled = true

    const label = el('span', 'line-clamp-1 flex items-center gap-2 text-left')
    label.dataset.slot = 'select-value'
    // A real chevron. This was an empty span with a size and an opacity on it, so the trigger had
    // a gap where shadcn has an arrow — the one part of a select everybody recognises.
    const chevron = el('span', 'flex size-4 shrink-0 items-center justify-center opacity-50',
                       { innerHTML: CHEVRON_DOWN })
    chevron.dataset.slot = 'select-chevron'
    trigger.append(label, chevron)

    // In the top layer, not absolutely positioned inside the wrapper: a select inside a card with
    // overflow-hidden had its list clipped, and a select near the bottom of the window had it cut
    // off. place() is the same anchoring every other panel in this library uses.
    const panel = el('div', cn(SELECT_CONTENT, 'fixed'))
    panel.dataset.slot = 'select-content'
    panel.setAttribute('role', 'listbox')
    panel.setAttribute('popover', 'auto')
    panel.id = (select.id || 'select') + '-content-' + (++selectSeq)

    // The list scrolls, so it gets the two buttons Radix draws for the same reason: at the ends of
    // a long list there is nothing else to say the list continues.
    const scrollUp = el('div', cn(SELECT_SCROLL_BUTTON, 'hidden'), { innerHTML: CHEVRON_UP })
    scrollUp.dataset.slot = 'select-scroll-up-button'
    const scrollDown = el('div', cn(SELECT_SCROLL_BUTTON, 'hidden'), { innerHTML: CHEVRON_DOWN })
    scrollDown.dataset.slot = 'select-scroll-down-button'
    const list = el('div', 'flex flex-col')
    panel.append(scrollUp, list, scrollDown)

    // Walk the select's own children rather than its flat option list, because <optgroup> and <hr>
    // ARE the grouping and the separator — the element has had both all along, and the drawn panel
    // threw them away and rendered one undifferentiated column.
    const items = []

    const drawOption = (option, into) => {
      const item = el('div', SELECT_ITEM, { role: 'option' })
      item.dataset.slot = 'select-item'
      item.tabIndex = -1
      item.append(el('span', 'flex-1 truncate', { textContent: option.text }))
      const indicator = el('span', SELECT_INDICATOR)
      indicator.dataset.slot = 'select-item-indicator'
      item.append(indicator)
      if (option.disabled) item.dataset.disabled = ''
      item.addEventListener('click', () => {
        if (option.disabled) return
        choose(option.value)
        close()
        trigger.focus()
      })
      into.append(item)
      items.push({ option, item, indicator })
    }

    for (const child of select.children) {
      if (child.tagName === 'OPTGROUP') {
        const group = el('div', '', { role: 'group' })
        group.dataset.slot = 'select-group'
        const heading = el('div', SELECT_LABEL, { textContent: child.label })
        heading.dataset.slot = 'select-label'
        group.append(heading)
        for (const option of child.children) drawOption(option, group)
        list.append(group)
      } else if (child.tagName === 'HR') {
        const rule = el('div', SELECT_SEPARATOR)
        rule.dataset.slot = 'select-separator'
        list.append(rule)
      } else if (child.tagName === 'OPTION') {
        drawOption(child, list)
      }
    }

    let index = -1

    function sync() {
      const current = [...select.options].find((o) => o.value === select.value)
      label.textContent = current ? current.text : (select.dataset.placeholder || '')
      if (current) delete trigger.dataset.placeholder
      else trigger.dataset.placeholder = ''
      for (const entry of items) {
        const on = entry.option.value === select.value
        entry.item.dataset.selected = String(on)
        entry.item.setAttribute('aria-selected', String(on))
        // The tick. Radix marks the chosen row and this drew nothing at all, so an open list gave
        // no sign of which row you were already on.
        entry.indicator.innerHTML = on ? CHECK : ''
      }
    }

    function active(i) {
      index = Math.max(0, Math.min(i, items.length - 1))
      items.forEach((entry, k) => k === index ? entry.item.dataset.active = '' : delete entry.item.dataset.active)
      if (items[index]) items[index].item.scrollIntoView({ block: 'nearest' })
      edges()
    }

    // Which end of the list is out of view. Radix hides each button at its own end; so does this.
    function edges() {
      const more = panel.scrollHeight - panel.clientHeight > 1
      scrollUp.classList.toggle('hidden', !more || panel.scrollTop < 4)
      scrollDown.classList.toggle('hidden',
        !more || panel.scrollTop + panel.clientHeight >= panel.scrollHeight - 4)
    }

    function choose(value) {
      if (value !== select.value) {
        select.value = value
        select.dispatchEvent(new Event('change', { bubbles: true }))
      }
      sync()
    }

    function open() {
      if (locked) return
      panel.showPopover()
      trigger.setAttribute('aria-expanded', 'true')
      // At least as wide as the control it belongs to, which is what makes it read as the same
      // object opening rather than a menu appearing near one.
      panel.style.minWidth = Math.round(trigger.getBoundingClientRect().width) + 'px'
      place(panel, trigger, 'start', 'bottom', 4)
      active(items.findIndex((entry) => entry.option.value === select.value))
      alignItem()
      lockScroll(true)
      document.addEventListener('keydown', onKey, true)
    }

    // alignItemWithTrigger, which is on by default upstream: the list opens with the CHOSEN row
    // sitting over the trigger, so the value you already have does not move under the pointer.
    // Off, the list hangs below the control like a menu. place() has already put it below, so
    // this only has to lift it — and only as far as the window allows, because a list taller than
    // the viewport cannot honour the request and must not be dragged off the top to try.
    function alignItem() {
      if (select.dataset.alignItemWithTrigger === 'false') return
      const chosen = items[Math.max(0, index)]
      if (!chosen) return
      const box = trigger.getBoundingClientRect()
      const row = chosen.item.getBoundingClientRect()
      const panelBox = panel.getBoundingClientRect()
      const lift = row.top - box.top
      const top = Math.min(
        Math.max(8, panelBox.top - lift),
        Math.max(8, window.innerHeight - panelBox.height - 8))
      panel.style.top = Math.round(top) + 'px'
      panel.style.bottom = 'auto'
    }

    function close() {
      if (!isOpen()) return
      panel.hidePopover()
      // hidePopover fires toggle synchronously, and that is where the lock is released — doing
      // it here as well would release it twice for one opening.
    }

    const isOpen = () => panel.matches(':popover-open')

    function onKey(e) {
      if (!isOpen()) {
        if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) { e.preventDefault(); open() }
        return
      }
      if (e.key === 'Escape') { e.preventDefault(); close(); trigger.focus() }
      else if (e.key === 'Tab') close()
      else if (e.key === 'ArrowDown') { e.preventDefault(); active(index + 1) }
      else if (e.key === 'ArrowUp') { e.preventDefault(); active(index - 1) }
      else if (e.key === 'Home') { e.preventDefault(); active(0) }
      else if (e.key === 'End') { e.preventDefault(); active(items.length - 1) }
      else if (e.key === 'Enter') {
        e.preventDefault()
        const hit = items[index]
        if (hit && !hit.option.disabled) { choose(hit.option.value); close(); trigger.focus() }
      }
    }

    // Light dismiss closes the popover without telling the trigger, and an aria-expanded that
    // says "true" over a closed list is a lie a screen reader has no way to check.
    // Every close comes through here — the button, Escape, a choice, and light dismiss, which
    // closes the popover without telling anyone. An aria-expanded reading "true" over a closed
    // list is a lie a screen reader cannot check, and a scroll lock nobody released is a page
    // that never scrolls again.
    const onToggle = (event) => {
      if (event.newState !== 'closed') return
      trigger.setAttribute('aria-expanded', 'false')
      lockScroll(false)
      document.removeEventListener('keydown', onKey, true)
    }

    trigger.addEventListener('click', () => (isOpen() ? close() : open()))
    trigger.addEventListener('keydown', (e) => { if (!isOpen()) onKey(e) })
    panel.addEventListener('scroll', edges, { passive: true })
    panel.addEventListener('toggle', onToggle)
    // The native select is still the value. A reset, a fragment swap or another script can move
    // it, and the drawn face has to follow rather than claim a value the form does not have.
    select.addEventListener('change', sync)

    sync()
    select.before(wrap)
    wrap.append(select, trigger, panel)
    select.classList.add('sr-only')
    select.tabIndex = -1

    return () => {
      if (isOpen()) lockScroll(false)
      panel.remove()
      select.removeEventListener('change', sync)
      select.classList.remove('sr-only')
      select.tabIndex = 0
      wrap.replaceWith(select)
    }
  })

  // =============================================================================================
  // DatePicker
  // =============================================================================================
  // Air Datepicker (vendored under /airdatepicker, MIT), not flatpickr: flatpickr renders the year
  // as a number input whose ± arrows are 14px wide and opacity:0 until hovered, so in practice the
  // year could not be changed, only stepped, by someone who found the arrows. Air Datepicker's
  // header title is a button — months -> years -> decades — so any year is two or three clicks,
  // and the same navigation works from the keyboard.
  //
  // Air Datepicker ships one locale file per language and none of them are bundled here, so the
  // month and day names are configuration. Unset means its own English default.
  // 📖 https://air-datepicker.com/docs — the shape is theirs, not ours.
  const DEFAULT_DATE_LOCALE = { dateFormat: 'dd/MM/yyyy', timeFormat: 'HH:mm', firstDay: 1 }

  const isoDate = (d) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

  up.compiler('[data-slot="date-picker"]', (input) => {
    if (typeof window.AirDatepicker !== 'function') return

    // What the form posts stays ISO (yyyy-MM-dd), matching the domain's DateOnly parsing, while
    // the field on screen reads d/m/Y. Air Datepicker has no altInput, so the name moves to a
    // hidden twin and the visible field becomes display-only.
    const name = input.getAttribute('name')
    const hidden = el('input', '', { type: 'hidden', name, value: input.value })
    input.removeAttribute('name')
    input.after(hidden)

    const seeded = input.value ? new Date(`${input.value}T00:00:00`) : null
    const valid = seeded && !Number.isNaN(seeded.getTime()) ? seeded : null

    const dp = new window.AirDatepicker(input, {
      locale: { ...DEFAULT_DATE_LOCALE, ...(config().datePickerLocale || {}) },
      dateFormat: config().datePickerLocale?.dateFormat || DEFAULT_DATE_LOCALE.dateFormat,
      selectedDates: valid ? [valid] : [],
      autoClose: true,
      isMobile: false,
      buttons: ['today', 'clear'],
      // Rendered on <body>, not beside the field. Inside an Unpoly overlay the field lives in
      // up-modal-content, which scrolls — and a popup inside a scrollport is clipped by it, so the
      // calendar came up buried under the modal. A global container also puts it above up-modal's
      // z-index:2000 (see --adp-z-index in ui.behavior.css).
      container: document.body,
      onSelect: ({ date }) => {
        const picked = Array.isArray(date) ? date[0] : date
        hidden.value = picked ? isoDate(picked) : ''
        // The hidden input is what filter / up-autosubmit forms watch, and a programmatic value
        // assignment fires nothing on its own.
        hidden.dispatchEvent(new Event('change', { bubbles: true }))
      },
    })

    // readOnly, not disabled: the field still focuses, still tabs, still opens the calendar, but
    // there is no free-typing a date the parser then has to guess at.
    input.readOnly = true

    // The overlay's own scrollport is not the window, so Air Datepicker's window-scroll listener
    // never fires and the calendar would hang where the field used to be. Follow it, or close.
    const scroller = input.closest('up-modal-content, [data-overlay-scroll]')
    const follow = () => { if (dp.visible) dp.hide() }
    scroller?.addEventListener('scroll', follow, { passive: true })

    return () => {
      scroller?.removeEventListener('scroll', follow)
      dp.destroy()
      hidden.remove()
      if (name !== null) input.setAttribute('name', name)
      input.readOnly = false
    }
  })

  // =============================================================================================
  // TagsInput — the multi-select shadcn does not ship
  // =============================================================================================
  // Tom Select (vendored under /tomselect, Apache-2.0). A shop with forty collections should not
  // make an operator scroll a wall of checkboxes to tick two. It enhances a real <select multiple>,
  // so the form posts exactly as it did and still works with scripting off.

  up.compiler('select[data-slot="tags-input"]', (select) => {
    if (typeof TomSelect !== 'function') { console.warn('[ui] TomSelect not loaded'); return }

    const control = new TomSelect(select, {
      plugins: ['remove_button'],
      placeholder: select.dataset.placeholder || 'Search…',
      maxOptions: null,
      hideSelected: true,
      searchField: ['text'],
    })

    return () => control.destroy()
  })

  // =============================================================================================
  // data-state on a native <dialog>
  // =============================================================================================
  // shadcn animates its overlays with data-[state=open] and data-[state=closed], which Radix
  // sets as it mounts and unmounts. A <dialog> has no such attribute — it has an `open` property
  // and nothing else — so every one of those classes matched nothing and the panels appeared and
  // vanished with no transition at all.
  //
  // The close half has to outlive the close: `closed` is set, the animation is allowed to run,
  // and only then is the attribute cleared. Reading the duration from the element rather than
  // hardcoding one means a theme that slows the animation down does not get it cut short.

  up.compiler('dialog[data-slot]', (dialog) => {
    const panel = dialog.firstElementChild || dialog

    const opened = () => { panel.dataset.state = 'open' }

    const closing = () => {
      panel.dataset.state = 'closed'
      const ms = parseFloat(getComputedStyle(panel).animationDuration) * 1000 || 0
      setTimeout(() => { if (!dialog.open) delete panel.dataset.state }, ms)
    }

    // showModal() fires no event of its own, so the open state is watched rather than hooked.
    const watch = new MutationObserver(() => (dialog.open ? opened() : closing()))
    watch.observe(dialog, { attributes: true, attributeFilter: ['open'] })
    if (dialog.open) opened()

    return () => watch.disconnect()
  })

  // =============================================================================================
  // Slider — the filled part of the track
  // =============================================================================================
  // The input draws its own track and thumb; what it has no element for is the filled portion to
  // the left of the thumb. That is one gradient stop, so this keeps a percentage in a custom
  // property and CSS does the rest. Without it the slider still works — it is the fill that is
  // missing, not the control, which is why this is a compiler and not a requirement.

  up.compiler('input[type="range"][data-slot="slider"]', (input) => {
    const paint = () => {
      const min = Number(input.min || 0)
      const max = Number(input.max || 100)
      const span = max - min
      input.style.setProperty('--slider-fill', span ? `${((input.value - min) / span) * 100}%` : '0%')
    }

    input.addEventListener('input', paint)
    paint()

    return () => input.removeEventListener('input', paint)
  })

  // Several thumbs: the inputs are stacked, so the only rules that need script are the ones
  // BETWEEN them — a thumb never crosses its neighbour, and the band spans the outermost two.
  // The band's percentages arrive inline from the server; this keeps them true while dragging,
  // and mirrors each value into any <output for="..."> pointed at the input, which is the
  // element HTML already has for "the live result of a control".
  up.compiler('[data-slot="slider"][data-range]', (root) => {
    const inputs = [...root.querySelectorAll('input[type="range"]')]
    const min = Number(inputs[0]?.min || 0)
    const span = Number(inputs[0]?.max || 100) - min

    const sync = () => {
      const values = inputs.map((i) => Number(i.value))
      if (span > 0) {
        root.style.setProperty('--slider-from', `${((Math.min(...values) - min) / span) * 100}%`)
        root.style.setProperty('--slider-to', `${((Math.max(...values) - min) / span) * 100}%`)
      }
      for (const input of inputs) {
        const output = input.id && document.querySelector(`output[for="${CSS.escape(input.id)}"]`)
        if (output) output.textContent = input.value
      }
    }

    const order = (event) => {
      const at = inputs.indexOf(event.target)
      const before = inputs[at - 1], after = inputs[at + 1]
      if (before && Number(event.target.value) < Number(before.value)) event.target.value = before.value
      if (after && Number(event.target.value) > Number(after.value)) event.target.value = after.value
      sync()
    }

    root.addEventListener('input', order)
    sync()

    return () => root.removeEventListener('input', order)
  })

  // A calendar inside a [popover] is a date picker, and a date picker closes when you pick.
  // Without this the day was chosen — the radio really was checked, and it really would post —
  // but the panel stayed open over the page and the button still said the old date, so the
  // choice looked like it had not registered at all.
  up.compiler('[popover] [data-slot="calendar"]', (calendar) => {
    const panel = calendar.closest('[popover]')
    if (!panel?.id) return
    const trigger = document.querySelector(`[popovertarget="${panel.id}"]`)
    const range = calendar.dataset.mode === 'range'

    const written = (value) => {
      const [year, month, date] = value.split('-').map(Number)
      return new Date(year, month - 1, date).toLocaleDateString(
        document.documentElement.lang || undefined,
        { day: 'numeric', month: 'short', year: 'numeric' })
    }

    const onChange = (event) => {
      if (!event.target.matches('input[type="radio"], input[type="checkbox"]')) return

      // The label is a span the caller marks, not the button's own text: the button also holds
      // an icon, and writing over its textContent would take that with it. In two of upstream's
      // pickers the date is not on the button at all — it is the value of a text box the button
      // sits inside — so the mark is looked up in the surrounding field as well, and an input
      // takes it as its value rather than its text.
      const label = trigger?.querySelector('[data-date-label]')
        || trigger?.closest('[data-slot="field"], [data-date-field]')
             ?.querySelector('[data-date-label]')
      const on = [...calendar.querySelectorAll('input:checked')].map((i) => i.value).sort()
      if (label && on.length) {
        const text = range && on.length > 1
          ? `${written(on[0])} – ${written(on[on.length - 1])}`
          : written(on[0])
        if (label.tagName === 'INPUT') label.value = text
        else label.textContent = text
        label.removeAttribute('data-empty')
      }

      // A range needs two dates, so picking one is not finishing. A single date is.
      if (range) return
      panel.hidePopover()
      trigger?.focus()
    }

    calendar.addEventListener('change', onChange)
    return () => calendar.removeEventListener('change', onChange)
  })

  // A slider that drives a progress bar. shadcn holds both in one state variable; here the
  // slider is the input that posts and the bar is what it reports, so the link between them is
  // one attribute naming the other — and with scripting off you still get a working slider and a
  // bar showing whatever the server rendered.
  up.compiler('input[type="range"][data-controls]', (slider) => {
    const bar = document.getElementById(slider.dataset.controls)
    const indicator = bar?.querySelector('[data-slot="progress-indicator"]')
    if (!indicator) return

    const paint = () => {
      const min = Number(slider.min || 0)
      const span = Number(slider.max || 100) - min
      const share = span > 0 ? ((Number(slider.value) - min) / span) * 100 : 0
      indicator.style.transform = `translateX(-${100 - share}%)`
      bar.setAttribute('aria-valuenow', String(Math.round(Number(slider.value))))
    }

    slider.addEventListener('input', paint)
    paint()

    return () => slider.removeEventListener('input', paint)
  })

  // =============================================================================================
  // Carousel — the two arrows, and only the two arrows
  // =============================================================================================
  // Scroll-snap is the carousel. These buttons scroll it by one slide and disable themselves at
  // each end, which is what upstream's canScrollPrev/canScrollNext do. They ship hidden and are
  // revealed here, because an arrow that cannot scroll is worse than no arrow.

  up.compiler('[data-slot="carousel"]', (root) => {
    const scroller = root.querySelector('[data-slot="carousel-content"]')
    if (!scroller) return

    const buttons = [...root.querySelectorAll('[data-carousel-scroll]')]
    const vertical = root.dataset.orientation === 'vertical'

    const step = () => {
      const item = scroller.querySelector('[data-slot="carousel-item"]')
      // One slide, or one viewport when the slides are narrower than it.
      return item ? (vertical ? item.offsetHeight : item.offsetWidth)
                  : (vertical ? scroller.clientHeight : scroller.clientWidth)
    }

    const sign = () => (!vertical && rtl(scroller) ? -1 : 1)

    const sync = () => {
      const pos = vertical ? scroller.scrollTop : scroller.scrollLeft * sign()
      const max = (vertical ? scroller.scrollHeight - scroller.clientHeight
                            : scroller.scrollWidth - scroller.clientWidth)
      for (const button of buttons) {
        const back = button.dataset.carouselScroll === '-1'
        // A fractional scroll position never reaches the exact maximum, so round.
        button.disabled = back ? pos <= 1 : pos >= max - 1
      }
    }

    const onClick = (event) => {
      const button = event.currentTarget
      const by = Number(button.dataset.carouselScroll) * step()
      scroller.scrollBy(vertical ? { top: by, behavior: 'smooth' }
                                 : { left: by * sign(), behavior: 'smooth' })
    }

    for (const button of buttons) {
      button.hidden = false
      button.addEventListener('click', onClick)
    }
    scroller.addEventListener('scroll', sync, { passive: true })
    sync()

    return () => {
      for (const button of buttons) button.removeEventListener('click', onClick)
      scroller.removeEventListener('scroll', sync)
    }
  })

  // =============================================================================================
  // Resizable — dragging the divider, and moving it from the keyboard
  // =============================================================================================
  // The handle rewrites flex-grow on the panel either side of it. Nothing else changes, so a drag
  // costs one style recalculation per pointer move rather than a render.
  //
  // Arrow keys move it too. A divider only a pointer can move is a divider that half the people
  // using it cannot move at all, and role=separator promises otherwise.

  up.compiler('[data-slot="resizable-handle"]', (handle) => {
    const group = handle.closest('[data-slot="resizable-panel-group"]')
    const before = handle.previousElementSibling
    const after = handle.nextElementSibling
    if (!group || !before || !after) return

    const vertical = group.dataset.orientation === 'vertical'
    const min = (el) => Number(el.dataset.minSize || 0.1)

    // The pair's total grow is preserved, so the rest of the group never moves.
    const total = () => Number(getComputedStyle(before).flexGrow) + Number(getComputedStyle(after).flexGrow)

    const apply = (share) => {
      const sum = total()
      const clamped = Math.min(Math.max(share, min(before)), sum - min(after))
      before.style.flexGrow = String(clamped)
      after.style.flexGrow = String(sum - clamped)
      handle.setAttribute('aria-valuenow', String(Math.round((clamped / sum) * 100)))
    }

    const fromPointer = (event) => {
      const box = group.getBoundingClientRect()
      const across = rtl(group) ? (box.right - event.clientX) / box.width
                                : (event.clientX - box.left) / box.width
      const at = vertical ? (event.clientY - box.top) / box.height : across
      apply(at * total())
    }

    const onMove = (event) => { event.preventDefault(); fromPointer(event) }

    const stop = () => {
      delete handle.dataset.dragging
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', stop)
    }

    const onDown = (event) => {
      event.preventDefault()
      handle.dataset.dragging = ''
      handle.focus()
      window.addEventListener('pointermove', onMove)
      window.addEventListener('pointerup', stop)
    }

    const onKey = (event) => {
      const nudge = rtl(group)
        ? { ArrowRight: -1, ArrowUp: -1, ArrowLeft: 1, ArrowDown: 1 }[event.key]
        : { ArrowLeft: -1, ArrowUp: -1, ArrowRight: 1, ArrowDown: 1 }[event.key]
      if (nudge === undefined && event.key !== 'Home' && event.key !== 'End') return
      event.preventDefault()

      const sum = total()
      const now = Number(getComputedStyle(before).flexGrow)
      if (event.key === 'Home') apply(min(before))
      else if (event.key === 'End') apply(sum - min(after))
      else apply(now + nudge * sum * (event.shiftKey ? 0.1 : 0.02))
    }

    handle.setAttribute('aria-valuemin', '0')
    handle.setAttribute('aria-valuemax', '100')
    apply(Number(getComputedStyle(before).flexGrow))

    handle.addEventListener('pointerdown', onDown)
    handle.addEventListener('keydown', onKey)

    return () => {
      stop()
      handle.removeEventListener('pointerdown', onDown)
      handle.removeEventListener('keydown', onKey)
    }
  })

  // Anything outside Unpoly's world — a head's own app.js, a page script — reaches these.
  // `toast` is global on purpose: that is sonner's API, and the call sites read the same.
  window.toast = toast
  window.alertDialog = alertDialog
})()
