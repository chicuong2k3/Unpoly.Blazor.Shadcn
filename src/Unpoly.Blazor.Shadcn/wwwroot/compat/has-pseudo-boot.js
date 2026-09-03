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
})();
