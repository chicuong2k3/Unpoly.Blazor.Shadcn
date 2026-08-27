// The demo's own behaviour. Everything visible on these pages is the library; this is only the
// three things a documentation site needs that a component library should not ship.
//
// All three are up.compilers rather than framework state, so they survive a fragment swap without
// being re-registered — which is the same rule the library holds itself to.

// ---- theme picker ---------------------------------------------------------------------------
// Writes data-theme on <html> and remembers it. Two elements carry [data-theme-picker] — the one
// in the header and the one in the Customizer — so the compiler keeps them in step rather than
// letting the second one lie about which theme is on.

const currentTheme = () => localStorage.getItem('demo-theme') || 'shadcn'

up.compiler('[data-theme-picker]', (select) => {
  select.value = currentTheme()

  const onChange = () => {
    const value = select.value
    localStorage.setItem('demo-theme', value)
    if (value === 'shadcn') delete document.documentElement.dataset.theme
    else document.documentElement.dataset.theme = value

    // The other picker, if it is on the page.
    for (const other of document.querySelectorAll('[data-theme-picker]')) {
      if (other !== select) other.value = value
    }
    // A preset replaces whatever was tuned by hand; keeping both would show a panel that does
    // not describe the page.
    resetCustomizer()
  }

  select.addEventListener('change', onChange)
  return () => select.removeEventListener('change', onChange)
})

// ---- dark mode ------------------------------------------------------------------------------

up.compiler('[data-dark-toggle]', (button) => {
  const sync = () => {
    const on = document.documentElement.classList.contains('dark')
    button.setAttribute('aria-pressed', String(on))
  }

  const onClick = () => {
    const on = document.documentElement.classList.toggle('dark')
    localStorage.setItem('demo-dark', on ? '1' : '0')
    sync()
  }

  sync()
  button.addEventListener('click', onClick)
  return () => button.removeEventListener('click', onClick)
})

// ---- the Customizer -------------------------------------------------------------------------
// Writes custom properties straight onto <html> and prints the block you would paste to keep
// them. That it can be this small IS the argument: every token is a runtime value, so a live
// theme editor needs no rebuild, no CSS-in-JS and no framework.

const overrides = new Map()

function resetCustomizer() {
  for (const token of overrides.keys()) {
    document.documentElement.style.removeProperty(`--${token}`)
  }
  overrides.clear()
  localStorage.removeItem('demo-tokens')
  paintCustomizerOutput()
}

function applyToken(token, value) {
  if (!value) {
    overrides.delete(token)
    document.documentElement.style.removeProperty(`--${token}`)
  } else {
    overrides.set(token, value)
    document.documentElement.style.setProperty(`--${token}`, value)
  }
  localStorage.setItem('demo-tokens', JSON.stringify([...overrides]))
  paintCustomizerOutput()
}

function paintCustomizerOutput() {
  const out = document.querySelector('[data-customizer-output] [data-slot="code-block-code"]')
  if (!out) return

  if (overrides.size === 0) {
    out.textContent = '[data-theme="mine"] {\n  /* change something to see it here */\n}'
    return
  }

  const lines = [...overrides].map(([t, v]) => `  --${t}: ${v};`)
  // --radius-control is derived rather than typed, so it is printed rather than left to be
  // discovered: a pill button beside a 12px card is the thing one number cannot say.
  if (overrides.has('radius') && !overrides.has('radius-control')) {
    lines.push(`  --radius-control: calc(${overrides.get('radius')} - 2px);`)
  }
  out.textContent = `[data-theme="mine"] {\n${lines.join('\n')}\n}`
}

up.compiler('[data-customizer]', (panel) => {
  // Restore what was tuned last time, so the panel and the page agree on first paint.
  try {
    for (const [t, v] of JSON.parse(localStorage.getItem('demo-tokens') || '[]')) {
      overrides.set(t, v)
      document.documentElement.style.setProperty(`--${t}`, v)
    }
  } catch { /* a corrupt entry is not worth a broken panel */ }

  // The colour input and the text beside it are two views of one value.
  const seed = (el) => {
    const token = el.dataset.token || el.dataset.tokenText
    const live = overrides.get(token)
      || getComputedStyle(document.documentElement).getPropertyValue(`--${token}`).trim()
    if (!live) return
    if (el.type === 'color') { if (/^#[0-9a-f]{6}$/i.test(live)) el.value = live }
    else el.value = overrides.get(token) || ''
    el.placeholder = live
  }

  const onInput = (event) => {
    const el = event.target
    const token = el.dataset.token || el.dataset.tokenText
    if (!token) return

    applyToken(token, el.value)

    // Keep the pair in step without echoing back into the element being typed in.
    for (const twin of panel.querySelectorAll(`[data-token="${token}"], [data-token-text="${token}"]`)) {
      if (twin !== el && twin.type !== 'radio' && twin.type !== 'checkbox') twin.value = el.value
    }
  }

  // The radius and height groups are radios, so the change event carries the chosen one.
  const onChange = (event) => {
    const el = event.target
    if (el.type !== 'radio') return
    const holder = el.closest('[data-token]')
    if (holder) applyToken(holder.dataset.token, el.value)
  }

  panel.querySelectorAll('[data-token], [data-token-text]').forEach(seed)
  panel.addEventListener('input', onInput)
  panel.addEventListener('change', onChange)
  paintCustomizerOutput()

  return () => {
    panel.removeEventListener('input', onInput)
    panel.removeEventListener('change', onChange)
  }
})

up.compiler('[data-customizer-reset]', (button) => {
  const onClick = () => {
    resetCustomizer()
    for (const el of document.querySelectorAll('[data-token-text]')) el.value = ''
  }
  button.addEventListener('click', onClick)
  return () => button.removeEventListener('click', onClick)
})

// ---- the search button ------------------------------------------------------------------------
// The palette binds its own shortcut; this is the button beside it for people who do not know
// there is one.

up.compiler('[data-command-open]', (button) => {
  const onClick = () => document.getElementById(button.dataset.commandOpen)?.showModal()
  button.addEventListener('click', onClick)
  return () => button.removeEventListener('click', onClick)
})
