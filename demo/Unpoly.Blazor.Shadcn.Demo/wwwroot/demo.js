// The demo's own two behaviours. Everything else on these pages is the library.
//
// Both write to <html> and to localStorage, and both are plain compilers rather than framework
// state, so they survive an Unpoly fragment swap without being re-registered.

up.compiler('[data-theme-picker]', (select) => {
  select.value = localStorage.getItem('demo-theme') || 'shadcn'

  const onChange = () => {
    const value = select.value
    localStorage.setItem('demo-theme', value)
    if (value === 'shadcn') delete document.documentElement.dataset.theme
    else document.documentElement.dataset.theme = value
  }

  select.addEventListener('change', onChange)
  return () => select.removeEventListener('change', onChange)
})

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
