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

  // ECharts wants real colours, not `var(--chart-1)`. Reading a custom
  // property with getComputedStyle returns its raw value — in the shipped
  // themes that is `oklch(...)` — so resolving here gives the colour, not
  // the var() expression.
  function resolveVars(arr) {
    return arr.map(function (c) {
      if (typeof c === 'string' && c.indexOf('var(') === 0) {
        var name = c.slice(4, -1).trim()
        return cssVar(name, c)
      }
      return c
    })
  }

  // ECharts 5.x's own colour parser only understands legacy CSS syntax
  // (hex, rgb, hsl, named). The theme palette is modern — oklch() in the
  // shipped themes — and the browser's canvas accepts that on the first
  // paint, but ECharts re-parses the colour on the hover/emphasis pass,
  // fails, and the series drops its stroke and fill: the chart vanishes
  // under the pointer. So every colour that reaches setOption is run
  // through the browser once and comes back as the concrete sRGB form
  // ECharts can read. The 1x1 canvas round-trip covers oklch, oklab, lch,
  // hwb and color() alike; a colour the browser itself rejects (bad
  // syntax, unresolved var()) is left unchanged.
  var colorProbe = null
  function normalizeColor(c) {
    if (typeof c !== 'string' || c === '') return c
    if (/^#([0-9a-fA-F]{3,8})$/.test(c) || /^rgba?\(/i.test(c) || /^hsla?\(/i.test(c)) return c
    if (!colorProbe) {
      colorProbe = document.createElement('canvas')
      colorProbe.width = 1
      colorProbe.height = 1
    }
    var ctx = colorProbe.getContext('2d')
    var sentinel = 'rgba(1, 2, 3)'
    ctx.fillStyle = sentinel
    ctx.fillStyle = c
    if (ctx.fillStyle === sentinel) return c
    ctx.clearRect(0, 0, 1, 1)
    ctx.fillRect(0, 0, 1, 1)
    var d = ctx.getImageData(0, 0, 1, 1).data
    if (d[0] === 1 && d[1] === 2 && d[2] === 3 && d[3] === 0) return c
    var a = Math.round((d[3] / 255) * 1000) / 1000
    return 'rgba(' + d[0] + ', ' + d[1] + ', ' + d[2] + (a < 1 ? ', ' + a : '') + ')'
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

  // Series types this package ships as vendor plugins under wwwroot/echarts/.
  // UMD builds that require('echarts') and register their series type on the
  // global — loaded AFTER echarts.min.js, only when a chart actually uses the
  // type, so a page with plain bar charts pays nothing for them.
  var PLUGIN_SOURCES = {
    liquidFill: '_content/Unpoly.Blazor.Shadcn.ECharts/echarts/echarts-liquidfill.min.js',
    wordCloud: '_content/Unpoly.Blazor.Shadcn.ECharts/echarts/echarts-wordcloud.min.js'
  }
  var pluginLoaded = {}
  function loadScript(src) {
    if (pluginLoaded[src]) return pluginLoaded[src]
    pluginLoaded[src] = new Promise(function (resolve, reject) {
      var s = document.createElement('script')
      s.src = src
      s.defer = true
      s.onload = resolve
      s.onerror = function () { console.warn('[echarts] failed to load plugin', src); reject() }
      document.head.appendChild(s)
    })
    return pluginLoaded[src]
  }

  function optsSeries(opts) {
    if (!opts) return []
    if (Array.isArray(opts.series)) return opts.series
    if (opts.series && Array.isArray(opts.series.data)) return opts.series.data
    return []
  }

  function detectPlugins(opts) {
    var need = []
    var series = optsSeries(opts)
    for (var i = 0; i < series.length; i++) {
      var t = series[i] && series[i].type
      if (PLUGIN_SOURCES[t] && need.indexOf(t) < 0) need.push(t)
    }
    return need
  }

  function ensurePlugins(opts) {
    var needed = detectPlugins(opts)
    var pending = needed.map(function (t) { return PLUGIN_SOURCES[t] }).filter(function (src, idx, arr) { return arr.indexOf(src) === idx && !pluginLoaded[src] })
    return pending.reduce(function (chain, src) { return chain.then(function () { return loadScript(src) }) }, Promise.resolve())
  }

  // The package bundles a world outline; register it for map/geo charts that
  // ask for "world". Any other unregistered map is an app-level concern — the
  // compiler warns instead of failing silently on a blank canvas.
  var worldMap = null
  function ensureMap(opts) {
    var names = []
    var series = optsSeries(opts)
    for (var i = 0; i < series.length; i++) {
      var s = series[i]
      if (s && s.type === 'map' && s.map) names.push(s.map)
    }
    if (opts && opts.geo && typeof opts.geo === 'object' && !Array.isArray(opts.geo)) {
      if (typeof opts.geo.map === 'string') names.push(opts.geo.map)
      else if (Array.isArray(opts.geo.map)) for (var j = 0; j < opts.geo.map.length; j++) names.push(opts.geo.map[j])
    } else if (opts && opts.geo && typeof opts.geo === 'string') {
      names.push(opts.geo)
    }
    for (var k = 0; k < names.length; k++) {
      var name = names[k]
      if (typeof echarts === 'undefined' || !echarts.getMap) continue
      if (name !== 'world' || echarts.getMap('world')) continue
      if (!worldMap) {
        worldMap = new Promise(function (resolve) {
          fetch('_content/Unpoly.Blazor.Shadcn.ECharts/geo/world.geo.json')
            .then(function (r) { return r.ok ? r.json() : Promise.reject(new Error('HTTP ' + r.status)) })
            .then(function (geo) { echarts.registerMap('world', geo); resolve(geo) })
            .catch(function (e) { console.warn('[echarts] could not load the bundled world map', e); resolve(null) })
        })
      }
      worldMap.then(function () {
        if (!echarts.getMap('world')) console.warn('[echarts] no map registered for "world" — the chart will be empty')
      })
      return worldMap
    }
    return Promise.resolve()
  }

  function parsedOptions(el) {
    var raw = el.getAttribute('data-options')
    if (!raw) return null
    try { return JSON.parse(raw) }
    catch (e) {
      console.error('[echarts] failed to parse data-options', e, raw.slice(0, 500))
      return null
    }
  }

  up.compiler('[data-echarts]', function (el) {
    var theme = el.dataset.theme && el.dataset.theme !== 'default' ? el.dataset.theme : null
    var autoResize = el.dataset.autoResize !== '0'
    var chart = null

    function ensureChart() {
      if (chart || typeof echarts === 'undefined') return
      chart = echarts.init(el, theme, { renderer: 'canvas', useDirtyRect: false })
      apply()
    }

    if (typeof echarts === 'undefined') {
      // init must wait for the vendor plugins (series types) and any map the
      // options reference to be registered — a setOption against an unknown
      // type or unregistered map throws before the first frame.
      loadEcharts()
        .then(function () { return ensurePlugins(parsedOptions(el)) })
        .then(function () { return ensureMap(parsedOptions(el)) })
        .then(ensureChart)
        .catch(function(){})
    } else {
      ensurePlugins(parsedOptions(el))
        .then(function () { return ensureMap(parsedOptions(el)) })
        .then(ensureChart)
        .catch(function(){})
    }

    function apply() {
      if (!chart) return
      var opts = parsedOptions(el)
      if (!opts) return
      // shadcn defaults — only when the caller did not set them. A caller
      // that sets `color` explicitly keeps it; a caller that does not gets
      // the theme palette so a chart without configuration still looks right.
      if (!opts.color) opts.color = resolveVars(shadcnColors())
      if (!opts.backgroundColor) opts.backgroundColor = 'transparent'
      if (!opts.textStyle) opts.textStyle = { color: shadcnTextColor(), fontFamily: 'var(--font-sans, ui-sans-serif)' }
      // Normalise the palette and text colour to concrete sRGB — see
      // normalizeColor. ECharts parses these on every hover, and its
      // parser cannot read the theme's modern CSS colour syntax.
      if (Array.isArray(opts.color)) opts.color = opts.color.map(normalizeColor)
      else if (typeof opts.color === 'string') opts.color = normalizeColor(opts.color)
      if (opts.textStyle && typeof opts.textStyle.color === 'string') opts.textStyle.color = normalizeColor(opts.textStyle.color)
      try {
        chart.setOption(opts, { notMerge: true, lazyUpdate: false })
      } catch (e) {
        console.error('[echarts] setOption failed', e)
      }
    }

    // When the host does an Unpoly fragment swap that replaces data-options,
    // the mutation observer re-applies without tearing down the instance.
    var mo = new MutationObserver(function (muts) {
      for (var i = 0; i < muts.length; i++) {
        if (muts[i].attributeName === 'data-options') {
          // a swap may change the series type; make sure any needed plugin is
          // loaded before setOption, else the type is unknown and it throws.
          var mopts = parsedOptions(el)
          var missing = detectPlugins(mopts).map(function (t) { return PLUGIN_SOURCES[t] }).filter(function (src) { return !pluginLoaded[src] })
          if (missing.length) {
            missing.reduce(function (chain, src) { return chain.then(function () { return loadScript(src) }) }, Promise.resolve()).then(apply)
          } else {
            apply()
          }
          break
        }
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
