/**
 * Safari 15 simulation stub for Playwright behaviour suite.
 *
 * Loaded via AddInitScript when SAFARI15_SIM=1 is set.  This runs before any
 * page script, deleting or patching APIs that Safari 15 (and some 15.x
 * point releases) does not support, so the existing test suite exercises the
 * same code paths a real Safari 15 would.
 *
 * APIs removed / patched:
 *   Array.prototype.toReversed   – Safari < 16
 *   Array.prototype.at           – Safari < 15.4
 *   Array.prototype.findLast     – Safari < 16
 *   window.structuredClone       – Safari < 15.4
 *   HTMLElement.prototype.showPopover / hidePopover / togglePopover
 *                                – Safari < 17
 *   HTMLElement.prototype.popover (content attribute reflection)
 *                                – Safari < 17
 *
 * CSS gaps this simulation CANNOT cover:
 *   • Real :has() matching – Chromium supports it; Safari 15 does not.
 *     The stub patches Element.matches for :has(…) selectors used from JS,
 *     but real CSS rule matching is unaffected.
 *   • Real :popover-open matching – Chromium supports it; Safari 15/16 do not.
 *     The stub patches Element.matches so JS that asks gets the same answer
 *     it would on a real Safari 15 engine.  Real CSS @rules with :popover-open
 *     still match in Chromium, which this stub cannot change.
 *   • Real color-mix() rendering – Chromium supports it; Safari 15/16 do not.
 *     The CI script (tools/safari15_check.py) checks the built CSS for bare
 *     color-mix() outside @supports; the runtime simulation cannot intercept
 *     CSS colour computation.
 *   • Nested @supports parse behaviour – Safari 15 flattens or ignores nested
 *     @supports differently from modern engines.  This stub does not alter
 *     the CSS parser.
 */
(function () {
  'use strict';

  /* ---- Array methods ------------------------------------------------------- */
  delete Array.prototype.toReversed;   // Safari < 16
  delete Array.prototype.at;           // Safari < 15.4
  delete Array.prototype.findLast;     // Safari < 16

  /* ---- structuredClone ----------------------------------------------------- */
  if (typeof window !== 'undefined') {
    window.structuredClone = undefined;
    try { delete window.structuredClone; } catch (_e) { /* sealed */ }
  }

  /* ---- reportError -----------------------------------------------------------
     Unpoly 3.14 refuses to boot without window.reportError (Safari < 16):
     deleting it forces the boot path through the library shim. ------------ */
  if (typeof window !== 'undefined' && 'reportError' in window) {
    try { delete window.reportError; } catch (_e) { window.reportError = undefined; }
  }

  /* ---- Popover API --------------------------------------------------------- */
  delete HTMLElement.prototype.showPopover;
  delete HTMLElement.prototype.hidePopover;
  delete HTMLElement.prototype.togglePopover;

  var popoverDesc = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'popover');
  if (popoverDesc) {
    delete HTMLElement.prototype.popover;
  }

  /* ---- :popover-open in JS ---------------------------------------------------
     Intentionally NOT stubbed. The library shim (compat/safari15-shim.js)
     translates bare :popover-open to the polyfill's class check on engines
     without the API, so this path is covered by the code under test. ------ */

  /* ---- Force :has() mismatch in JS -----------------------------------------
     Real Safari 15.0-15.3 cannot match :has() from JS either; the library
     boot (has-pseudo-boot.js) wraps this engine later, which is exactly the
     production chain under test. ------------------------------------------ */
  var origMatches2 = Element.prototype.matches;
  Element.prototype.matches = function (selector) {
    if (typeof selector === 'string' && selector.indexOf(':has(') !== -1) {
      return false;
    }
    return origMatches2.call(this, selector);
  };

  /* ---- CSS.supports lies :has() is missing ---------------------------------
     Unpoly 3.14 refuses to boot when CSS.supports('selector(:has(*))') is
     false; the library boot corrects it after installing the runtime, the
     same chain a real Safari 15 runs. -------------------------------------- */
  if (window.CSS && typeof window.CSS.supports === 'function') {
    var nativeSupports = window.CSS.supports.bind(window.CSS);
    window.CSS.supports = function (property, value) {
      var text = typeof property === 'string' && value === undefined ? property :
        (typeof property === 'string' ? property + ': ' + value : '');
      if (/:has\(/i.test(text)) return false;
      return nativeSupports.apply(this, arguments);
    };
  }

  /* ---- Hide [popover] panels by default ------------------------------------
     Without the popover API, [popover] elements are not moved to the top
     layer and are not auto-hidden.  We inject a stylesheet that hides them
     so a panel only appears if the polyfill explicitly shows it.  The oddbird
     polyfill marks open panels with the literal class ":popover-open"
     (".\:popover-open" as a selector); ui.js additionally sets
     data-state="open" on toggle.  Exempt exactly those two signals — nothing
     else may unhide a panel, or the simulation would pass code that stays
     invisible on a real Safari 15. ---------------------------------------- */
  var style = document.createElement('style');
  style.textContent = [
    '[popover] { display: none !important; }',
    '[popover][data-state="open"],',
    '[popover][open],',
    '[popover].\\:popover-open { display: block !important; }'
  ].join(' ');

  if (document.head) {
    document.head.appendChild(style);
  } else {
    document.addEventListener('DOMContentLoaded', function () {
      if (document.head) document.head.appendChild(style);
    });
  }
})();
