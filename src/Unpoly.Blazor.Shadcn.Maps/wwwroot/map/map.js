// Unpoly.Blazor.Shadcn.Maps — MapLibre GL compiler, lazy-loaded per map
// IIFE load-bearing, like ui.js. Lazy-loads maplibre-gl.js/css only when [data-map] is on the page.
;(function () {
  var maplibreLoading = null
  function loadMapLibre() {
    if (typeof maplibregl !== 'undefined') return Promise.resolve()
    if (maplibreLoading) return maplibreLoading
    var cdn = (window.lumeoCdn && window.lumeoCdn.mapLibreJs) || '_content/Unpoly.Blazor.Shadcn.Maps/map/maplibre-gl.js'
    var css = (window.lumeoCdn && window.lumeoCdn.mapLibreCss) || '_content/Unpoly.Blazor.Shadcn.Maps/map/maplibre-gl.css'
    // CSS
    if (!document.querySelector('link[href="' + css + '"]')) {
      var l = document.createElement('link'); l.rel = 'stylesheet'; l.href = css; document.head.appendChild(l)
    }
    maplibreLoading = new Promise(function (res, rej) {
      var s = document.createElement('script'); s.src = cdn; s.defer = true;
      s.onload = res; s.onerror = function(){ console.warn('[map] failed to load '+cdn); rej() };
      document.head.appendChild(s)
    })
    return maplibreLoading
  }

  function styleUrl(raw) {
    if (!raw || raw === 'Auto') {
      var isDark = document.documentElement.classList.contains('dark') || document.documentElement.dataset.theme === 'dark'
      return isDark
        ? 'https://demotiles.maplibre.org/style.json' // demo dark fallback; replace via window.lumeoCdn or Style prop
        : 'https://demotiles.maplibre.org/style.json'
    }
    return raw
  }

  up.compiler('[data-slot="map"][data-map]', function (el) {
    var container = el.querySelector('[data-map-container]')
    if (!container) return

    var lat = parseFloat(el.dataset.centerLat || '10.8231')
    var lng = parseFloat(el.dataset.centerLng || '106.6297')
    var zoom = parseFloat(el.dataset.zoom || '12')
    var interactive = el.dataset.interactive !== 'false'
    var map = null

    function build() {
      if (typeof maplibregl === 'undefined' || !container) return
      if (map) { try { map.remove() } catch (_) {} }
      map = new maplibregl.Map({
        container: container,
        style: styleUrl(el.dataset.style),
        center: [lng, lat],
        zoom: zoom,
        interactive: interactive
      })
      // Markers
      var markers = el.querySelectorAll('[data-slot="map-marker"][data-marker]')
      markers.forEach(function (m) {
        var mLat = parseFloat(m.dataset.lat), mLng = parseFloat(m.dataset.lng)
        if (!isFinite(mLat) || !isFinite(mLng)) return
        var marker = new maplibregl.Marker({ draggable: m.dataset.draggable === 'true' })
          .setLngLat([mLng, mLat])
          .addTo(map)

        // One popup per marker, attached to the marker so it opens and closes with it. Rich
        // ChildContent wins over the plain Popup string; the two were both added before, which
        // left a second, orphaned popup sitting open on the map.
        if (m.innerHTML.trim()) {
          marker.setPopup(new maplibregl.Popup({ offset: 25 }).setHTML(m.innerHTML))
        } else if (m.dataset.popup) {
          marker.setPopup(new maplibregl.Popup({ offset: 25 }).setText(m.dataset.popup))
        }
      })
    }

    if (typeof maplibregl === 'undefined') {
      loadMapLibre().then(build).catch(function(){})
    } else build()

    var mo = new MutationObserver(function (muts) {
      for (var i=0;i<muts.length;i++) if (['data-center-lat','data-center-lng','data-zoom','data-style'].indexOf(muts[i].attributeName) >=0) { build(); break }
    })
    mo.observe(el, { attributes: true, attributeFilter: ['data-center-lat','data-center-lng','data-zoom','data-style'] })

    return function () {
      mo.disconnect()
      if (map) try { map.remove(); } catch (_) {}
      map = null
    }
  })
})();
