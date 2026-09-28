// Tailwind 3 ships an older named palette than the pinned Tailwind 4 demo.
// Resolve the pinned v4 palette through its runtime CSS variables so opaque
// colors and alpha shades match v4 without altering the default v4 build.
const fs = require('node:fs');
const path = require('node:path');
const postcss = require('postcss');
const { channels } = require('./postcss-color-channels.cjs');
function paletteFromTheme(demo) {
  const file = path.join(demo, 'node_modules/tailwindcss/theme.css');
  const source = fs.readFileSync(file, 'utf8');
  const palette = new Map();
  for (const [,name,value] of source.matchAll(/--color-([a-z]+-\d{2,3}):\s*(oklch\([^;]+\));/g)) {
    if (palette.has(name)) throw Error(`Duplicate v4 palette token: ${name}`);
    palette.set(name,{value,rgb:channels(value).rgb});
  }
  if (palette.size < 200 || !palette.has('amber-500') || !palette.has('emerald-500')) throw Error('Pinned Tailwind 4 palette not found');
  const colors = {};
  for (const [name] of palette) {
    const [family, shade] = name.split('-');
    (colors[family] ||= {})[shade] = ({opacityValue} = {}) => {
      if (opacityValue === undefined || /^var\(--tw-(?:bg|text|border|ring|fill|stroke|placeholder|divide|gradient-from|gradient-to|gradient-via)-opacity(?:, 1)?\)$/.test(opacityValue)) return `var(--color-${name})`;
      if (!/^(?:0(?:\.\d+)?|1(?:\.0+)?)$/.test(opacityValue)) throw Error(`Unexpected v4 palette opacity: ${opacityValue}`);
      return `color-mix(in oklab, var(--color-${name}) ${Number(opacityValue)*100}%, transparent)`;
    };
  }
  return {palette,colors};
}
function paletteRoot(palette) {
  return {postcssPlugin:'shadcn-v4-named-palette',OnceExit(root) {
    // v4 emits these as CSS variables; Tailwind 3's @theme removal must not
    // erase them. Keep the sRGB branch for Safari 15, modern OKLCH for v4 parity.
    for (const name of palette.keys()) {
      let count=0;
      root.walkDecls(`--color-${name}`,()=>count++);
      if (count) throw root.error(`Palette token already declared: ${name}`);
    }
    const fallback=postcss.rule({selector:':root'});
    const modern=postcss.rule({selector:':root'});
    for (const [name,{value,rgb}] of palette) {
      fallback.append(postcss.decl({prop:`--color-${name}`,value:`rgb(${rgb})`}));
      modern.append(postcss.decl({prop:`--color-${name}`,value}));
    }
    root.prepend(postcss.atRule({name:'supports',params:'(color: oklch(0 0 0))',nodes:[modern]}));
    root.prepend(fallback);
  }};
}
function paletteAlphaFallback(palette) {
  return {
    postcssPlugin:'shadcn-v4-palette-alpha-fallback',
    Declaration(decl) {
      const match = /^color-mix\(in oklab, var\(--color-([a-z]+-\d{2,3})\) (\d+(?:\.\d+)?)%, transparent\)$/.exec(decl.value);
      if (!match) return;
      const entry = palette.get(match[1]);
      if (!entry) throw decl.error(`Unknown palette alpha token: ${match[1]}`);
      const alpha = Number(match[2])/100;
      if (alpha < 0 || alpha > 1) throw decl.error('Invalid palette alpha');
      // Safari 15 lacks color-mix; the following modern declaration wins where
      // supported. v4 palette variables retain theme overrides in modern engines.
      decl.before({prop:decl.prop,value:`rgba(${entry.rgb}, ${alpha})`});
    },
  };
}
module.exports = {paletteFromTheme,paletteRoot,paletteAlphaFallback};
