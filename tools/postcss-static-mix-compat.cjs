// Unwired Tailwind 3 probe: preserve modern color-mix(), but prepend equivalent
// Safari 15-safe declarations for the six authored static/focus-ring cases.
// Do not rewrite shimmer or Bubble colors here: those need separate fallbacks.
const pinned = new Map([
  ['color-mix(in srgb, #3b82f6 12%, transparent)', 'rgba(59, 130, 246, 0.12)'],
  ['color-mix(in srgb, #10b981 14%, transparent)', 'rgba(16, 185, 129, 0.14)'],
  ['color-mix(in srgb, #f43f5e 14%, transparent)', 'rgba(244, 63, 94, 0.14)'],
  ['color-mix(in srgb, #f59e0b 14%, transparent)', 'rgba(245, 158, 11, 0.14)'],
  ['0 0 0 3px color-mix(in oklch, var(--ring) 50%, transparent)',
    '0 0 0 3px rgba(var(--ring-rgb), calc(var(--ring-alpha, 1) * 0.5))'],
  ['color-mix(in oklab, var(--ring) 50%, transparent)',
    'rgba(var(--ring-rgb), calc(var(--ring-alpha, 1) * 0.5))'],
]);
function staticMixCompat() {
  return {
    postcssPlugin: 'shadcn-static-mix-prototype',
    OnceExit(root) {
      const found = new Map();
      root.walkDecls(decl => {
        if (!pinned.has(decl.value)) return;
        const key = decl.value;
        found.set(key, (found.get(key) || 0) + 1);
        const prop = key.startsWith('0 0 0 3px') ? 'box-shadow' : key.startsWith('color-mix(in oklab') ? 'outline-color' : 'background';
        if (decl.prop !== prop) throw decl.error(`Unexpected static mix property: ${decl.prop}`);
        if (decl.prev()?.prop === prop && decl.prev().value === pinned.get(key)) throw decl.error('Duplicate static mix fallback');
        decl.before({ prop, value: pinned.get(key) });
      });
      for (const key of pinned.keys()) {
        if (found.get(key) !== 1) throw root.error(`Static mix baseline changed (${found.get(key) || 0} occurrences): ${key}`);
      }
    },
  };
}
module.exports = { staticMixCompat, pinned };
