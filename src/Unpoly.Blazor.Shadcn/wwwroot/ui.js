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

  const SELECT_TRIGGER =
    'border-input flex h-control w-full items-center gap-2 rounded-md border bg-transparent px-3 ' +
    'py-2 text-control whitespace-nowrap shadow-xs transition-[color,box-shadow] outline-none ' +
    'hover:border-ring/60 focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] ' +
    'disabled:cursor-not-allowed disabled:opacity-50'

  const SELECT_CONTENT =
    'bg-popover text-popover-foreground z-50 max-h-60 min-w-[8rem] overflow-x-hidden overflow-y-auto ' +
    'rounded-md border p-1 shadow-md'

  const SELECT_ITEM =
    'relative flex w-full cursor-default items-center gap-2 rounded-sm py-1.5 pr-8 pl-2 text-sm ' +
    'outline-hidden select-none hover:bg-accent hover:text-accent-foreground ' +
    'data-[active]:bg-accent data-[active]:text-accent-foreground ' +
    'data-[disabled]:pointer-events-none data-[disabled]:opacity-50'

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

  up.compiler('[data-slot="dialog-trigger"], [data-slot="sheet-trigger"]', (trigger) => {
    const open = (event) => {
      const target = document.getElementById(trigger.dataset.target)
      if (!target) return
      event.preventDefault()
      target.showModal()
    }
    trigger.addEventListener('click', open)
    return () => trigger.removeEventListener('click', open)
  })

  // A close button anywhere inside the dialog, including the corner X.
  up.compiler('[data-slot="dialog-close"], [data-slot="sheet-close"]', (button) => {
    const close = (event) => { event.preventDefault(); button.closest('dialog')?.close() }
    button.addEventListener('click', close)
    return () => button.removeEventListener('click', close)
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
      const step = { ArrowRight: 1, ArrowLeft: -1, Home: -Infinity, End: Infinity }[event.key]
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
  // DropdownMenu / Popover — the popover API does the hard parts
  // =============================================================================================
  // [popover] gives the top layer, light dismiss and Escape. What it does not give portably yet is
  // anchor positioning (`position-area` is not everywhere), so that much is measured here.

  function place(panel, anchor, align = 'start', side = 'bottom', offset = 4) {
    const a = anchor.getBoundingClientRect()
    const p = panel.getBoundingClientRect()

    let top = side === 'top' ? a.top - p.height - offset : a.bottom + offset
    let left = align === 'end' ? a.right - p.width
      : align === 'center' ? a.left + (a.width - p.width) / 2
      : a.left

    // Stay on screen. A menu half off the right edge is a menu with unreachable items.
    left = Math.max(8, Math.min(left, window.innerWidth - p.width - 8))
    if (top + p.height > window.innerHeight - 8) top = Math.max(8, a.top - p.height - offset)

    panel.style.top = `${Math.round(top)}px`
    panel.style.left = `${Math.round(left)}px`
  }

  up.compiler('[data-slot="dropdown-menu-trigger"], [data-slot="popover-trigger"], ' +
              '[data-slot="dropdown-menu-sub-trigger"]', (trigger) => {
    const panel = document.getElementById(trigger.dataset.target)
    if (!panel) return

    // Radix lets a popover be positioned against something other than its trigger. Same idea:
    // the nearest [data-slot=popover-anchor] wins if there is one.
    const anchor = trigger.closest('[data-slot="popover"]')
      ?.querySelector('[data-slot="popover-anchor"]') || trigger

    const onToggle = (event) => {
      if (event.newState !== 'open') { trigger.setAttribute('aria-expanded', 'false'); return }
      trigger.setAttribute('aria-expanded', 'true')
      place(panel, trigger, panel.dataset.align, panel.dataset.side)
      panel.querySelector('[data-slot$="-item"]:not([data-disabled])')?.focus()
    }

    // A dropdown pinned to a trigger that has scrolled away is worse than one that closed.
    const onScroll = () => { if (panel.matches(':popover-open')) panel.hidePopover() }

    panel.addEventListener('toggle', onToggle)
    window.addEventListener('scroll', onScroll, { passive: true, capture: true })
    window.addEventListener('resize', onScroll, { passive: true })

    return () => {
      panel.removeEventListener('toggle', onToggle)
      window.removeEventListener('scroll', onScroll, true)
      window.removeEventListener('resize', onScroll)
    }
  })

  // Keyboard within an open menu. Radix roves focus; so does this.
  up.compiler('[data-slot="dropdown-menu-content"]', (panel) => {
    const onKey = (event) => {
      const items = [...panel.querySelectorAll('[data-slot="dropdown-menu-item"]:not([data-disabled])')]
      if (items.length === 0) return
      const from = items.indexOf(document.activeElement)
      if (event.key === 'ArrowDown') { event.preventDefault(); items[(from + 1) % items.length].focus() }
      else if (event.key === 'ArrowUp') { event.preventDefault(); items[(from - 1 + items.length) % items.length].focus() }
      else if (event.key === 'Home') { event.preventDefault(); items[0].focus() }
      else if (event.key === 'End') { event.preventDefault(); items[items.length - 1].focus() }
    }
    panel.addEventListener('keydown', onKey)
    return () => panel.removeEventListener('keydown', onKey)
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

    const open = () => {
      clearTimeout(timer)
      timer = setTimeout(() => {
        panel.showPopover()
        place(panel, trigger, 'center', panel.dataset.side || 'top', 6)
        panel.dataset.state = 'delayed-open'
      }, Number(trigger.dataset.delay ?? 200))
    }

    const close = () => {
      clearTimeout(timer)
      panel.dataset.state = 'closed'
      if (panel.matches(':popover-open')) panel.hidePopover()
    }

    const onKey = (event) => { if (event.key === 'Escape') close() }

    trigger.addEventListener('pointerenter', open)
    trigger.addEventListener('pointerleave', close)
    trigger.addEventListener('focus', open)
    trigger.addEventListener('blur', close)
    document.addEventListener('keydown', onKey)

    return () => {
      close()
      trigger.removeEventListener('pointerenter', open)
      trigger.removeEventListener('pointerleave', close)
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
      if (next === hidden.value) return
      hidden.value = next
      // Filter forms and [up-autosubmit] watch the hidden input, and a programmatic assignment
      // fires nothing on its own.
      hidden.dispatchEvent(new Event('change', { bubbles: true }))
    }

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
      const typed = box.value.replace(/\D/g, '')
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
      } else if (event.key === 'ArrowLeft' && i > 0) {
        event.preventDefault()
        boxes[i - 1].focus()
      } else if (event.key === 'ArrowRight' && i < boxes.length - 1) {
        event.preventDefault()
        boxes[i + 1].focus()
      }
    }

    const onPaste = (event) => {
      const digits = (event.clipboardData?.getData('text') || '').replace(/\D/g, '')
      if (!digits) return
      event.preventDefault()
      spread(digits)
      sync()
    }

    // Clicking box four while two and three are empty is almost never what was meant.
    const onFocus = (event) => {
      const firstEmpty = boxes.find((b) => !b.value) || boxes[boxes.length - 1]
      if (boxes.indexOf(event.target) > boxes.indexOf(firstEmpty)) firstEmpty.focus()
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
        place(panel, trigger, panel.dataset.align, panel.dataset.side, 8)
      }, Number(trigger.dataset.delay ?? 600))
    }

    // A grace period, not an immediate close: the gap between the trigger and the panel is a
    // few pixels of nothing, and leaving through it must not count as leaving.
    const close = () => {
      clearTimeout(openTimer)
      closeTimer = setTimeout(() => {
        if (panel.matches(':popover-open')) panel.hidePopover()
      }, 150)
    }

    const onKey = (event) => { if (event.key === 'Escape') { clearTimeout(openTimer); panel.hidePopover() } }

    trigger.addEventListener('pointerenter', open)
    trigger.addEventListener('pointerleave', close)
    trigger.addEventListener('focus', open)
    trigger.addEventListener('blur', close)
    panel.addEventListener('pointerenter', () => clearTimeout(closeTimer))
    panel.addEventListener('pointerleave', close)
    document.addEventListener('keydown', onKey)

    return () => {
      clearTimeout(openTimer)
      clearTimeout(closeTimer)
      trigger.removeEventListener('pointerenter', open)
      trigger.removeEventListener('pointerleave', close)
      trigger.removeEventListener('focus', open)
      trigger.removeEventListener('blur', close)
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

  up.compiler('select[data-slot="select"]', (select) => {
    if (select.disabled || select.multiple || select.closest('[data-slot="select-root"]')) return

    const options = [...select.options].map((o) => ({ value: o.value, text: o.text, disabled: o.disabled }))
    if (options.length === 0) return

    // Sizing and layout belong to the visible control, so the caller's own classes move to the
    // wrapper. <Select> hands them over verbatim in data-wrapper-class rather than leaving this to
    // subtract the recipe and guess.
    const wrap = el('span', cn('relative block', select.dataset.wrapperClass))
    wrap.dataset.slot = 'select-root'

    const trigger = el('button', cn(SELECT_TRIGGER, 'justify-between'), { type: 'button' })
    trigger.dataset.slot = 'select-trigger'
    trigger.setAttribute('aria-haspopup', 'listbox')
    trigger.setAttribute('aria-expanded', 'false')

    const label = el('span', 'line-clamp-1 flex items-center gap-2 text-left')
    label.dataset.slot = 'select-value'
    const chevron = el('span', 'size-4 shrink-0 opacity-50')
    chevron.dataset.slot = 'select-chevron'
    trigger.append(label, chevron)

    const panel = el('span', cn(SELECT_CONTENT, 'absolute inset-x-0 top-[calc(100%+4px)] hidden'))
    panel.dataset.slot = 'select-content'
    panel.setAttribute('role', 'listbox')

    const items = options.map((o) => {
      const item = el('button', SELECT_ITEM, { type: 'button', textContent: o.text })
      item.dataset.slot = 'select-item'
      item.setAttribute('role', 'option')
      if (o.disabled) item.dataset.disabled = ''
      item.addEventListener('click', () => { choose(o.value); close(); trigger.focus() })
      panel.append(item)
      return { option: o, item }
    })

    let index = -1

    function sync() {
      const current = options.find((o) => o.value === select.value)
      label.textContent = current ? current.text : ''
      for (const { option, item } of items) {
        const on = option.value === select.value
        item.dataset.selected = String(on)
        item.setAttribute('aria-selected', String(on))
      }
    }

    function active(i) {
      index = Math.max(0, Math.min(i, items.length - 1))
      items.forEach(({ item }, k) => k === index ? item.dataset.active = '' : delete item.dataset.active)
      items[index]?.item.scrollIntoView({ block: 'nearest' })
    }

    function choose(value) {
      if (value !== select.value) {
        select.value = value
        select.dispatchEvent(new Event('change', { bubbles: true }))
      }
      sync()
    }

    function open() {
      panel.classList.remove('hidden')
      trigger.setAttribute('aria-expanded', 'true')
      active(items.findIndex(({ option }) => option.value === select.value))
      document.addEventListener('pointerdown', onDocPointerDown, true)
      document.addEventListener('keydown', onKey, true)
    }

    function close() {
      if (panel.classList.contains('hidden')) return
      panel.classList.add('hidden')
      trigger.setAttribute('aria-expanded', 'false')
      document.removeEventListener('pointerdown', onDocPointerDown, true)
      document.removeEventListener('keydown', onKey, true)
    }

    const isOpen = () => !panel.classList.contains('hidden')

    function onDocPointerDown(e) { if (!wrap.contains(e.target)) close() }

    function onKey(e) {
      if (!isOpen()) {
        if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) { e.preventDefault(); open() }
        return
      }
      if (e.key === 'Escape') { e.preventDefault(); close(); trigger.focus() }
      else if (e.key === 'Tab') close()
      else if (e.key === 'ArrowDown') { e.preventDefault(); active(index + 1) }
      else if (e.key === 'ArrowUp') { e.preventDefault(); active(index - 1) }
      else if (e.key === 'Enter') {
        e.preventDefault()
        const hit = items[index]
        if (hit && !hit.option.disabled) { choose(hit.option.value); close(); trigger.focus() }
      }
    }

    trigger.addEventListener('click', () => (isOpen() ? close() : open()))
    trigger.addEventListener('keydown', (e) => { if (!isOpen()) onKey(e) })

    sync()
    select.before(wrap)
    wrap.append(select, trigger, panel)
    select.classList.add('sr-only')
    select.tabIndex = -1

    return () => {
      close()
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

    const sync = () => {
      const pos = vertical ? scroller.scrollTop : scroller.scrollLeft
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
      scroller.scrollBy(vertical ? { top: by, behavior: 'smooth' } : { left: by, behavior: 'smooth' })
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
      const at = vertical ? (event.clientY - box.top) / box.height
                          : (event.clientX - box.left) / box.width
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
      const nudge = { ArrowLeft: -1, ArrowUp: -1, ArrowRight: 1, ArrowDown: 1 }[event.key]
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
