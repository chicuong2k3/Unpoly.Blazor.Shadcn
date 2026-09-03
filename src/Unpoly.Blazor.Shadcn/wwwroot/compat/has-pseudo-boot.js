/**
 * Boot the css-has-pseudo runtime (compat/css-has-pseudo.js, @csstools v8.0.1).
 * Runs only where the engine lacks :has() - everywhere else this file exits
 * on the feature check and the modern path is untouched.
 */
(function () {
  'use strict';
  if (typeof window === 'undefined' || typeof window.cssHasPseudo !== 'function') return;
  var nativeHas = false;
  try {
    nativeHas = !!(window.CSS && window.CSS.supports &&
      window.CSS.supports('selector(:has(div))'));
  } catch (e) { /* assume missing -> polyfill below */ }
  if (nativeHas) return;
  window.cssHasPseudo(document);
  // Advertise the polyfilled capability: Unpoly 3.14 refuses to boot when
  // CSS.supports('selector(:has(*))') is false, and its only runtime :has()
  // use (fragment target derivation) flows through the selector engines the
  // polyfill just patched — so on this engine the answer is honestly true.
  // Every other query delegates to the native implementation untouched.
  if (window.CSS && typeof window.CSS.supports === 'function') {
    var nativeSupports = window.CSS.supports.bind(window.CSS);
    window.CSS.supports = function (property, value) {
      var text = typeof property === 'string' && value === undefined ? property :
        (typeof property === 'string' ? property + ': ' + value : '');
      if (/selector\([^)]*:has\(/i.test(text)) return true;
      return nativeSupports.apply(this, arguments);
    };
  }
})();
