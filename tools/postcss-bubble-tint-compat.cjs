// Unwired demo CSS prototype. The four tinted Bubble relative OKLCH colors
// have no Safari 15 syntax equivalent. Resolve each authored static --primary
// theme token at build time, preserving all four L/C/H adjustments. Consumers
// overriding --primary must run this same transform on their palette CSS.
const { parse, converter } = require('culori');
const oklch = converter('oklch');
// CSS paints relative OKLCH by clipping individual sRGB channels at output,
// not by gamut-mapping chroma (which shifts Apple blue by ~9 levels).
const rgb = converter('rgb');
const variants = new Map([
  ['0.93 calc(c * 0.4)', ['--bubble-tint-light', 0.93, 0.4]],
  ['0.3 calc(c * 0.4)', ['--bubble-tint-dark', 0.3, 0.4]],
  ['0.88 calc(c * 0.5)', ['--bubble-tint-hover-light', 0.88, 0.5]],
  ['0.35 calc(c * 0.5)', ['--bubble-tint-hover-dark', 0.35, 0.5]],
]);
function bubbleTintCompat() {
  return {
    postcssPlugin: 'shadcn-bubble-tint-prototype',
    OnceExit(root) {
      let palettes = 0;
      root.walkDecls('--primary', decl => {
        const parsed = parse(decl.value.trim());
        if (!parsed) throw decl.error(`Unresolved primary color: ${decl.value}`);
        const base = oklch(parsed);
        if (!Number.isFinite(base.c) || (!Number.isFinite(base.h) && base.c !== 0) || (base.alpha !== undefined && base.alpha !== 1)) {
          throw decl.error(`Unexpected primary color/alpha: ${decl.value}`);
        }
        for (const [name, lightness, factor] of variants.values()) {
          const next = rgb({ mode: 'oklch', l: lightness, c: base.c * factor, h: base.h ?? 0 });
          const value = `rgb(${[next.r, next.g, next.b].map(n => Math.round(Math.min(1, Math.max(0, n)) * 255)).join(', ')})`;
          decl.after({ prop: name, value });
        }
        palettes++;
      });
      if (!palettes) throw root.error('No primary palette found for Bubble tint fallback');
      const found = new Set();
      root.walkDecls('background-color', decl => {
        const match = /^oklch\(from var\(--primary\) (.+) h\)$/.exec(decl.value);
        if (!match) return;
        const variant = variants.get(match[1]);
        if (!variant || found.has(match[1]) || !decl.parent.selector.includes('bubble-content')) {
          throw decl.error(`Unexpected Bubble relative color: ${decl.value}`);
        }
        found.add(match[1]);
        decl.before({ prop: 'background-color', value: `var(${variant[0]})` });
      });
      if (found.size !== variants.size) throw root.error(`Expected ${variants.size} Bubble tint variants, found ${found.size}`);
    },
  };
}
module.exports = { bubbleTintCompat, variants };
