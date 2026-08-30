// Unpoly.Blazor.Shadcn.ECharts — ECharts compiler for static SSR + Unpoly
// ============================================================================
// The server renders <div data-echarts data-options='{"xAxis":...}'> once.
// Unpoly swaps fragments underneath. This compiler runs on every insertion
// (first load AND every fragment swap) and MUST return a destructor —
// one that leaves residue does not break this swap, it breaks the next one.
//
// Wrapped in an IIFE (load-bearing, not tidy): a classic <script src>
// shares one global scope with every other script on the page. `const el`
// here against `function el` there is a redeclaration, SyntaxError, and
// the whole file never runs — no server error, nothing at the call site,
// every chart simply absent on the one app that picked the same name.
// See src/Unpoly.Blazor.Shadcn/wwwroot/ui.js for the full story.
;(function () {
  function cssVar(name, fallback) {
    var v = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
    return v || fallback
  }

  function shadcnColors() {
    // --chart-1..5 are set by ui.css and every theme. Fall back to the
    // palette echarts examples use so an unthemed page still has colour.
    var vars = ['--chart-1', '--chart-2', '--chart-3', '--chart-4', '--chart-5']
    var out = []
    for (var i = 0; i < vars.length; i++) {
      var v = cssVar(vars[i], '')
      out.push(v || ['#2ec4b6', '#e71d36', '#ff9f1c', '#011627', '#5b5f97'][i])
    }
    return out
  }

  function shadcnTextColor() {
    return cssVar('--foreground', cssVar('--muted-foreground', '#334155'))
  }

  function shadcnBorderColor() {
    return cssVar('--border', 'rgba(0,0,0,0.08)')
  }

  // ECharts wants real colours, not `var(--chart-1)`. Those vars resolve to
  // hsl() strings already, so reading with getComputedStyle gives the value
  // rather than the var() expression in most browsers. Where it still comes
  // back as `var(--chart-1)`, the canvas still paints — it just ignores the
  // fallback — so resolving here is best-effort, not required.
  function resolveVars(arr) {
    return arr.map(function (c) {
      if (typeof c === 'string' && c.indexOf('var(') === 0) {
        var name = c.slice(4, -1).trim()
        return cssVar(name, c)
      }
      return c
    })
  }

  var echartsLoading = null
  function loadEcharts() {
    if (typeof echarts !== 'undefined') return Promise.resolve()
    if (echartsLoading) return echartsLoading
    echartsLoading = new Promise(function (resolve, reject) {
      var s = document.createElement('script')
      s.src = '_content/Unpoly.Blazor.Shadcn.ECharts/echarts/echarts.min.js'
      s.defer = true
      s.onload = resolve
      s.onerror = function () { console.warn('[echarts] failed to load echarts.min.js'); reject() }
      document.head.appendChild(s)
    })
    return echartsLoading
  }

  up.compiler('[data-echarts]', function (el) {
    var theme = el.dataset.theme && el.dataset.theme !== 'default' ? el.dataset.theme : null
    var autoResize = el.dataset.autoResize !== '0'
    var chart = null
    var pending = true

    function ensureChart() {
      if (chart || typeof echarts === 'undefined') return
      pending = false
      chart = echarts.init(el, theme, { renderer: 'canvas', useDirtyRect: false })
      apply()
    }

    if (typeof echarts === 'undefined') {
      loadEcharts().then(ensureChart).catch(function(){})
    } else {
      chart = echarts.init(el, theme, { renderer: 'canvas', useDirtyRect: false })
    }

    function apply() {
      if (!chart) return
      var raw = el.getAttribute('data-options')
      if (!raw) return
      try {
        var opts = JSON.parse(raw)

        // shadcn defaults — only when the caller did not set them. A caller
        // that sets `color` explicitly keeps it; a caller that does not gets
        // the theme palette so a chart without configuration still looks right.
        if (!opts.color) opts.color = resolveVars(shadcnColors())
        if (!opts.backgroundColor) opts.backgroundColor = 'transparent'
        if (!opts.textStyle) opts.textStyle = { color: shadcnTextColor(), fontFamily: 'var(--font-sans, ui-sans-serif)' }

        // Make axis and grid border subtle on shadcn backgrounds
        // (only if the caller left them default)
        if (opts.xAxis && !opts.xAxis.axisLine) {
          // leave alone — caller opted in
        }
        if (opts.yAxis && !opts.yAxis.splitLine) {
          // leave alone
        }

        chart.setOption(opts, { notMerge: true, lazyUpdate: false })
      } catch (e) {
        console.error('[echarts] failed to parse data-options', e, raw && raw.slice(0, 500))
      }
    }

    apply()

    // When the host does an Unpoly fragment swap that replaces data-options,
    // the mutation observer re-applies without tearing down the instance.
    var mo = new MutationObserver(function (muts) {
      for (var i = 0; i < muts.length; i++) {
        if (muts[i].attributeName === 'data-options') { apply(); break }
      }
    })
    mo.observe(el, { attributes: true, attributeFilter: ['data-options'] })

    // Theme changes: the demo toggles .dark and data-theme on <html> via
    // localStorage. Re-apply so colours re-resolve against the new vars.
    var themeMo = new MutationObserver(apply)
    themeMo.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'data-theme', 'style'] })

    var ro = null
    var onResize = function () { if (!chart) return; try { chart.resize() } catch (_) {} }
    if (autoResize && typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(onResize)
      ro.observe(el)
    } else if (autoResize) {
      window.addEventListener('resize', onResize, { passive: true })
    }

    var onVis = function () {
      if (document.visibilityState === 'visible') onResize()
    }
    document.addEventListener('visibilitychange', onVis)

    // Unpoly may hide and re-show layers; a chart in a hidden tab reports
    // 0 width at init. When it becomes visible, resize again.
    var onUpLayer = function () { setTimeout(onResize, 50) }
    if (typeof up !== 'undefined' && up.on) {
      up.on('up:fragment:inserted', onUpLayer)
      up.on('up:layer:opened', onUpLayer)
    }

    return function () {
      mo.disconnect()
      themeMo.disconnect()
      if (ro) ro.disconnect()
      else window.removeEventListener('resize', onResize)
      document.removeEventListener('visibilitychange', onVis)
      if (typeof up !== 'undefined' && up.off) {
        // up.off with exact handler reference is safe; if unavailable, the handler stays but the element is gone
        try { up.off('up:fragment:inserted', onUpLayer); up.off('up:layer:opened', onUpLayer) } catch (_) {}
      }
      try { chart.dispose() } catch (_) {}
    }
  })
})();
