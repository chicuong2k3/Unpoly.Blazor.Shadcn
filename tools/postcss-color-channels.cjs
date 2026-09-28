// Safari 15-compatible alpha colors for Tailwind v3's runtime theme tokens.
// rgba(var(--primary-rgb), calc(var(--primary-alpha, 1) * 0.5)) tracks :root,
// .dark and [data-theme] without relying on color-mix() or relative colors.
// This must run BEFORE the static oklch->sRGB postprocessor. Unrecognized
// runtime expressions fail loudly instead of silently shipping invisible CSS.
const { parse, converter } = require('culori');
const names = new Set(require('./color-tokens.cjs'));
// CSS's default gamut mapping for computed sRGB clips each converted channel.
// Culori's toGamut('rgb', 'oklch') instead reduces chroma, changing out-of-gamut
// theme colors (e.g. github-light blue) by up to 11 sRGB levels vs v4.
const inRgb = converter('rgb');

function channels(value) {
  const color = parse(value.trim());
  if (!color) throw new Error(`Unsupported theme color: ${value}`);
  const rgb = inRgb(color);
  const decimals = [rgb.r, rgb.g, rgb.b].map(channel =>
    Math.round(Math.min(1, Math.max(0, channel)) * 255)).join(', ');
  const alpha = rgb.alpha === undefined ? 1 : rgb.alpha;
  return { rgb: decimals, alpha: String(alpha) };
}

function colorChannels() {
  return {
    postcssPlugin: 'shadcn-theme-rgb-channels',
    Declaration(decl) {
      const name = decl.prop.startsWith('--') ? decl.prop.slice(2) : '';
      if (!names.has(name)) return;
      // A duplicate pass must not append another pair or shift specificity.
      if (decl.next()?.prop === `--${name}-rgb`) return;
      let result;
      try { result = channels(decl.value); }
      catch (error) { throw decl.error(error.message); }
      decl.after({ prop: `--${name}-rgb`, value: result.rgb });
      decl.next().after({ prop: `--${name}-alpha`, value: result.alpha });
    },
  };
}
colorChannels.postcss = true;
module.exports = { colorChannels, channels };
