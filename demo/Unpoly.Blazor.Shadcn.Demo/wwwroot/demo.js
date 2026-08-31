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

// The swatch presets are attributes, not inline tokens: [data-cz-base] / [data-cz-primary]
// flip whole ramps from themes/customizer.css, which is why a swatch recolors sixty variables
// with one gesture. They are saved separately from the fine-tune tokens, so Reset returns to
// the last preset rather than to nothing.
const presetState = { base: 'zinc', primary: 'default', radius: '0.625' }

function applyPresetState() {
  const root = document.documentElement
  if (presetState.base && presetState.base !== 'zinc') root.dataset.czBase = presetState.base
  else delete root.dataset.czBase
  if (presetState.primary && presetState.primary !== 'default') root.dataset.czPrimary = presetState.primary
  else delete root.dataset.czPrimary
  if (presetState.radius) root.style.setProperty('--radius', presetState.radius + 'rem')
  localStorage.setItem('demo-presets', JSON.stringify(presetState))
  paintCustomizerOutput()
}

function restorePresetState() {
  try {
    const saved = JSON.parse(localStorage.getItem('demo-presets') || 'null')
    if (saved) Object.assign(presetState, saved)
  } catch { /* a corrupt entry is not worth a broken panel */ }
  applyPresetState()
}

function resetCustomizer() {
  for (const token of overrides.keys()) {
    document.documentElement.style.removeProperty(`--${token}`)
  }
  overrides.clear()
  localStorage.removeItem('demo-tokens')
  presetState.base = 'zinc'
  presetState.primary = 'default'
  presetState.radius = '0.625'
  applyPresetState()
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

  const lines = []
  // A preset is an attribute, not a token list: the printed block mirrors what an app needs
  // to write, and what an app writes for a gray ramp is the attribute too (customizer.css is
  // copy-in source, like the components).
  if (presetState.base !== 'zinc') lines.push(`  /* base: [data-cz-base="${presetState.base}"] */`)
  if (presetState.primary !== 'default') lines.push(`  /* primary: [data-cz-primary="${presetState.primary}"] */`)

  for (const [t, v] of overrides) lines.push(`  --${t}: ${v};`)
  // --radius-control is derived rather than typed, so it is printed rather than left to be
  // discovered: a pill button beside a 12px card is the thing one number cannot say.
  if (presetState.radius && presetState.radius !== '0.625' && !overrides.has('radius')) {
    lines.push(`  --radius: ${presetState.radius}rem;`)
    lines.push(`  --radius-control: calc(${presetState.radius}rem - 2px);`)
  }
  if (overrides.has('radius') && !overrides.has('radius-control')) {
    lines.push(`  --radius-control: calc(${overrides.get('radius')} - 2px);`)
  }
  if (lines.length === 0) {
    out.textContent = '[data-theme="mine"] {\n  /* change something to see it here */\n}'
    return
  }
  out.textContent = `[data-theme="mine"] {\n${lines.join('\n')}\n}`
}

up.compiler('[data-customizer]', (panel) => {
  // Restore what was tuned last time, so the panel and the page agree on first paint. The
  // presets are attributes on <html>; the fine-tune tokens are inline properties.
  restorePresetState()
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

  // The swatch groups are plain buttons — a click flips a whole attribute and re-presses the
  // group. The mode buttons mirror the header's dark toggle so neither can say two things.
  const onClick = (event) => {
    const radius = event.target.closest('[data-cz-radius]')
    if (radius) {
      setRadius(radius.dataset.czRadius)
      return
    }
    const base = event.target.closest('[data-cz-preset]')
    if (base && base.closest('[data-cz-group="base"]')) {
      presetState.base = base.dataset.czPreset
      syncPressed()
      applyPresetState()
      return
    }
    const primary = event.target.closest('[data-cz-preset]')
    if (primary && primary.closest('[data-cz-group="primary"]')) {
      presetState.primary = primary.dataset.czPreset
      syncPressed()
      applyPresetState()
      return
    }
    const mode = event.target.closest('[data-cz-mode]')
    if (mode) {
      const dark = mode.dataset.czMode === 'dark'
      document.documentElement.classList.toggle('dark', dark)
      localStorage.setItem('demo-dark', dark ? '1' : '0')
      syncPressed()
    }
  }

  // The slider and the buttons are two views of one number. The buttons snap; the slider sweeps.
  const setRadius = (rem) => {
    presetState.radius = String(rem)
    const slider = panel.querySelector('[data-cz-radius-slider]')
    if (slider) slider.value = String(rem)
    const readout = panel.querySelector('[data-cz-radius-value]')
    if (readout) readout.textContent = rem
    syncPressed()
    applyPresetState()
  }

  const onRadiusInput = (event) => {
    const el = event.target
    if (!el.matches('[data-cz-radius-slider]')) return
    setRadius(el.value)
  }

  const syncPressed = () => {
    for (const b of panel.querySelectorAll('[data-cz-preset]')) {
      const inBase = !!b.closest('[data-cz-group="base"]')
      const value = inBase ? presetState.base : presetState.primary
      b.setAttribute('aria-pressed', String(b.dataset.czPreset === value))
    }
    for (const b of panel.querySelectorAll('[data-cz-radius]')) {
      b.setAttribute('aria-pressed', String(b.dataset.czRadius === presetState.radius))
    }
    // The slider and its readout follow whatever set the radius — buttons included.
    const slider = panel.querySelector('[data-cz-radius-slider]')
    if (slider) slider.value = presetState.radius
    const readout = panel.querySelector('[data-cz-radius-value]')
    if (readout) readout.textContent = presetState.radius
    const dark = document.documentElement.classList.contains('dark')
    for (const b of panel.querySelectorAll('[data-cz-mode]')) {
      b.setAttribute('aria-pressed', String((b.dataset.czMode === 'dark') === dark))
    }
  }

  const slider = panel.querySelector('[data-cz-radius-slider]')
  if (slider) slider.value = presetState.radius
  const readout = panel.querySelector('[data-cz-radius-value]')
  if (readout) readout.textContent = presetState.radius

  panel.querySelectorAll('[data-token], [data-token-text]').forEach(seed)
  panel.addEventListener('input', onInput)
  panel.addEventListener('input', onRadiusInput)
  panel.addEventListener('change', onChange)
  panel.addEventListener('click', onClick)
  syncPressed()
  paintCustomizerOutput()
  panel.addEventListener('cz-sync', syncPressed)

  return () => {
    panel.removeEventListener('input', onInput)
    panel.removeEventListener('input', onRadiusInput)
    panel.removeEventListener('change', onChange)
    panel.removeEventListener('click', onClick)
    panel.removeEventListener('cz-sync', syncPressed)
  }
})


up.compiler('[data-customizer-reset]', (button) => {
  const onClick = () => {
    resetCustomizer()
    for (const el of document.querySelectorAll('[data-token-text]')) el.value = ''
    // ResetCustomizer re-applied the presets; syncPressed lives in the panel compiler, and a
    // plain event is the one thing both compilers can agree on without reaching into state.
    document.querySelector('[data-customizer]')?.dispatchEvent(new CustomEvent('cz-sync'))
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
