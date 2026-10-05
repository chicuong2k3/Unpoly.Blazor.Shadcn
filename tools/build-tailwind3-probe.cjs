#!/usr/bin/env node
// Reproducible Tailwind 3 candidate for both v4 demo heads.
// Default probe writes ONLY to OS temp; explicit preview writes app.v3.css,
// never overwrites either demo's v4 app.css.
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const postcss = require('postcss');
const postcssImport = require('postcss-import');
const tailwind = require('tailwindcss');
const autoprefixer = require('autoprefixer');
const root = path.resolve(__dirname, '..');
const { colorChannels } = require('./postcss-color-channels.cjs');
const { primaryHoverMixCompat } = require('./postcss-primary-hover-mix-compat.cjs');
const { primaryOpaqueCompat } = require('./postcss-primary-opaque-compat.cjs');
const { sliderVerticalCompat } = require('./postcss-slider-vertical-compat.cjs');
const { nativeSelectOpacityCompat } = require('./postcss-native-select-opacity-compat.cjs');
const { selectBackgroundCompat } = require('./postcss-select-background-compat.cjs');
const { createColorConfig } = require('./tailwind3-color-config.cjs');
const { paletteFromTheme, paletteRoot, paletteAlphaFallback } = require('./tailwind3-palette-compat.cjs');
const { discover, discoverImportant, rename } = require('./tailwind3-var-alias.cjs');
const scale = require('./tailwind3-scale-compat.cjs');
const { fieldCompoundCompat } = require('./postcss-field-compound-compat.cjs');
const { namedGroupCompat } = require('./postcss-named-group-compat.cjs');
const { importantCompoundCompat } = require('./postcss-important-compound-compat.cjs');
const { messageSlotCompat } = require('./postcss-message-slot-compat.cjs');
const { shimmerCompat } = require('./postcss-shimmer-compat.cjs');
const { scrollFadeCompat } = require('./postcss-scroll-fade-compat.cjs');
const { spacingToken } = require('./tailwind3-spacing-token.cjs');
const { spacingFunctionCompat } = require('./postcss-spacing-function-compat.cjs');
const { preflightSpacingCompat } = require('./postcss-preflight-spacing-compat.cjs');
const { inputGroupIconCompat } = require('./postcss-input-group-icon-compat.cjs');
const { inputGroupHasCompat } = require('./postcss-input-group-has-compat.cjs');
const { attachmentPaddingCompat } = require('./postcss-attachment-padding-compat.cjs');
const { childImgCompoundCompat } = require('./postcss-child-img-compound-compat.cjs');
const { fieldLabelChildCompat } = require('./postcss-field-label-child-compat.cjs');
const { formPreflightCompat } = require('./postcss-form-preflight-compat.cjs');
const { cardSizeBaselineCompat } = require('./postcss-card-size-baseline-compat.cjs');
const { comboboxChipInputCompat } = require('./postcss-combobox-chip-input-compat.cjs');
const { alertDescriptionChildCompat } = require('./postcss-alert-description-child-compat.cjs');
const { negativeSpaceCompat } = require('./postcss-negative-space-compat.cjs');
const { timelineAlternateCompat } = require('./postcss-timeline-alternate-compat.cjs');
const { stackedVariantCompat } = require('./postcss-stacked-variant-compat.cjs');
const { snippetTriggerCompat } = require('./postcss-snippet-trigger-compat.cjs');
const { docInlineLeadingCompat } = require('./postcss-doc-inline-leading-compat.cjs');
const { outlineNoneCompat } = require('./postcss-outline-none-compat.cjs');
const { darkButtonCompat } = require('./postcss-dark-button-compat.cjs');
const { staticMixCompat } = require('./postcss-static-mix-compat.cjs');
const { bubbleSlotCompat } = require('./postcss-bubble-slot-compat.cjs');
const { bubbleTintCompat } = require('./postcss-bubble-tint-compat.cjs');
const { bubbleHoverCompat } = require('./postcss-bubble-hover-compat.cjs');
const { createContainerFallback } = require('./postcss-container-fallback.cjs');
function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) return ['node_modules', 'obj', 'bin'].includes(entry.name) ? [] : walk(file);
    return /\.(razor|cs|js)$/.test(entry.name) ? [file] : [];
  });
}
function directiveConverter() {
  return {
    postcssPlugin: 'shadcn-v3-probe-directives',
    AtRule(at) {
      if (at.name === 'source' || at.name === 'custom-variant' || at.name === 'variant') { at.remove(); return; }
      if (at.name === 'theme') {
        for (const keyframes of at.nodes?.filter(node => node.type === 'atrule' && node.name === 'keyframes') || []) at.before(keyframes);
        at.remove(); return;
      }
      if (at.name === 'utility') {
        const rule = postcss.rule({ selector: `.${at.params.trim()}` });
        if (at.nodes) rule.append(...at.nodes);
        at.replaceWith(rule);
      }
    },
  };
}
function configFor(demo) {
  const sources = [...walk(path.join(root, 'src')), ...walk(path.join(demo, 'Components'))];
  const aliases = discover(sources);
  for (const [v3, v4] of discoverImportant(sources)) aliases.set(v3, v4);
  const html = path.join(demo, 'wwwroot/index.html');
  const content = [path.join(demo, 'Components/**/*.razor'), path.join(root, 'src/**/*.razor'),
    path.join(root, 'src/**/*.cs'), path.join(root, 'src/**/wwwroot/**/*.js')];
  if (fs.existsSync(html)) content.push(html); // MAUI host includes non-Razor status classes.
  const {palette,colors:paletteColors} = paletteFromTheme(demo);
  const config = {
    darkMode: 'class', safelist: [...aliases.keys()], content,
    theme: { extend: {
      colors: { ...paletteColors, ...createColorConfig() }, ...scale.theme, height: { control: 'var(--control-h)' },
      // v4 text-xs uses a unitless leading (1 / .75). v3's 1rem leading
      // is inherited as 16px by a 10px Chart label instead of scaling to
      // 13.33px, shifting every bar by three pixels.
      fontSize: { control: 'var(--control-text)', xs: ['0.75rem', { lineHeight: 'calc(1 / 0.75)' }] },
      // v3 Preflight otherwise hardcodes ui-sans-serif on html while v4 uses
      // the runtime theme's --font-sans; unlabeled InputGroup text diverges.
      fontFamily: { sans: ['var(--font-sans)'], mono: ['var(--font-mono)'] },
      borderRadius: { sm: 'calc(var(--radius) - 4px)', md: 'var(--radius-control)', lg: 'var(--radius)', xl: 'calc(var(--radius) + 4px)' },
      boxShadow: { xs: 'var(--elevation-1)', sm: 'var(--elevation-2)', md: 'var(--elevation-3)', lg: 'var(--elevation-4)' },
      transitionTimingFunction: { out: 'var(--ease-ui)' },
    } },
    plugins: [require('@tailwindcss/container-queries'), function ({ addUtilities, addVariant, matchVariant }) {
      addUtilities({
        '.size-control': { width: 'var(--control-h)', height: 'var(--control-h)' },
        '.ring-3': { '--tw-ring-offset-shadow': 'var(--tw-ring-inset) 0 0 0 var(--tw-ring-offset-width) var(--tw-ring-offset-color)', '--tw-ring-shadow': 'var(--tw-ring-inset) 0 0 0 calc(3px + var(--tw-ring-offset-width)) var(--tw-ring-color)', 'box-shadow': 'var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow, 0 0 #0000)' },
        '.outline-hidden': { 'outline-style': 'none' },
        '.wrap-break-word': { 'overflow-wrap': 'break-word' },
        '.scrollbar-gutter-stable': { 'scrollbar-gutter': 'stable' },
        '.scrollbar-none': { 'scrollbar-width': 'none', '&::-webkit-scrollbar': { display: 'none' } },
        '.scrollbar-thin': { 'scrollbar-width': 'thin' },
        '.field-sizing-content': { 'field-sizing': 'content' },
        '.bg-linear-to-b': { 'background-image': 'linear-gradient(to bottom, var(--tw-gradient-stops))' },
        '.size-6\\.5': { width: '1.625rem', height: '1.625rem' },
        '.h-140': { height: '35rem' },
        '.rounded-xs': { 'border-radius': '0.125rem' },
      });
      addVariant('*', ':is(& > *)'); addVariant('**', '& *');
      addVariant('aria-invalid', '&[aria-invalid="true"]');
      for (const name of ['highlighted', 'autoscrolling', 'empty', 'slot']) addVariant(`data-${name}`, `&[data-${name}]`);
      addVariant('not-checked', '&:not(:checked)');
      addVariant('has-aria-invalid', '&:has([aria-invalid="true"])');
      addVariant('has-aria-expanded', '&:has([aria-expanded="true"])');
      addVariant('group-data-empty', ':merge(.group)[data-empty] &');
      matchVariant('has-data', value => `&:has([data-${value}])`);
      matchVariant('group-has-data', value => `:merge(.group):has([data-${value}]) &`);
      scale.addVariants({ addVariant }); scale.addLogicalUtilities({ addUtilities });
      for (const selector of ['a', 'button,a', 'button', 'img', "svg:not([class*='size-'])", 'svg']) addVariant(`[${selector}]`, `&:is(${selector})`);
      addVariant('has-disabled', '&:has(:disabled)'); addVariant('not-first', '&:not(:first-child)');
      addVariant('nth-last-2', '&:nth-last-child(2)'); addVariant('pointer-coarse', '@media (pointer: coarse)');
      matchVariant('in-data', value => `:is([data-${value}] &)`, { values: {} });
    }],
  };
  return { config, aliases, palette };
}
function demoFor(head) {
  if (!['web', 'maui'].includes(head)) throw new Error('head must be web or maui');
  return path.join(root, 'demo', head === 'web' ? 'Unpoly.Blazor.Shadcn.Demo' : 'Unpoly.Blazor.Shadcn.Maui');
}
async function compile(head, resolved, { containerFallback = false } = {}) {
  const demo = demoFor(head);
  const entry = path.join(demo, 'Styles/app.css');
  const original = fs.readFileSync(entry, 'utf8');
  const anchor = /\/\* The CLI does not (?:pick up|scan)/;
  if (!original.includes('@import "tailwindcss";') || !anchor.test(original)) throw new Error('Unexpected demo CSS entry');
  const css = original.replace('@import "tailwindcss";', '').replace(anchor,
    '@tailwind base;\n@tailwind components;\n@tailwind utilities;\n/* The CLI does not scan');
  const { config, aliases, palette } = configFor(demo);
  const fallback = containerFallback ? createContainerFallback() : null;
  // The v3 preview alone needs Safari 15 :has selectors. Import ESM from CJS;
  // preserve native selectors so modern browser cascade stays unchanged.
  const hasPseudo = containerFallback ? (await import('css-has-pseudo')).default : null;
  const result = await postcss([
    postcssImport(), directiveConverter(), colorChannels(), spacingToken(), tailwind(config), paletteAlphaFallback(palette), paletteRoot(palette), cardSizeBaselineCompat(), negativeSpaceCompat(), rename(aliases), outlineNoneCompat(),
    scale.fixChildLinkSelector(), fieldCompoundCompat(), inputGroupHasCompat(), childImgCompoundCompat(), fieldLabelChildCompat(), alertDescriptionChildCompat(), timelineAlternateCompat(), stackedVariantCompat(), namedGroupCompat(),
    importantCompoundCompat(), attachmentPaddingCompat(), snippetTriggerCompat(), docInlineLeadingCompat(), messageSlotCompat(), bubbleSlotCompat(), bubbleTintCompat(), bubbleHoverCompat(), shimmerCompat(), scrollFadeCompat(), staticMixCompat(), darkButtonCompat(), primaryHoverMixCompat(), primaryOpaqueCompat(), sliderVerticalCompat(), nativeSelectOpacityCompat(), selectBackgroundCompat(), comboboxChipInputCompat(), spacingFunctionCompat(), preflightSpacingCompat(), formPreflightCompat(), ...(fallback ? [fallback.plugin] : []), autoprefixer(), inputGroupIconCompat(),
  ]).process(css, { from: entry, to: resolved });
  if (result.warnings().length) throw new Error(result.warnings().map(w => w.toString()).join('\n'));
  // Use a second pass: fail-closed named-group/field selector bridges above
  // must validate their original selectors, not the :has fallback clones.
  const transformed = hasPseudo ? await postcss([hasPseudo({ preserve: true })]).process(result.css, { from: entry, to: resolved }) : result;
  if (transformed.warnings().length) throw new Error(transformed.warnings().map(w => w.toString()).join('\n'));
  return { css: transformed.css, manifest: fallback?.manifest };
}
async function build(head, output) {
  demoFor(head);
  const resolved = path.resolve(output);
  const insideRepo = path.relative(root, resolved);
  if (!insideRepo.startsWith('..' + path.sep) && insideRepo !== '..') throw new Error('Prototype output MUST be outside the submodule');
  const tempRelative = path.relative(path.resolve(os.tmpdir()), resolved);
  if (!tempRelative || tempRelative.startsWith('..' + path.sep) || tempRelative === '..' || path.isAbsolute(tempRelative) || path.extname(resolved) !== '.css') {
    throw new Error('Prototype output MUST be a .css file inside the OS temporary directory');
  }
  if (fs.existsSync(resolved) && fs.statSync(resolved).isDirectory()) throw new Error('Output must be a CSS file');
  const { css } = await compile(head, resolved);
  fs.mkdirSync(path.dirname(resolved), { recursive: true });
  fs.writeFileSync(resolved, css);
  console.log(`${head} isolated CSS: ${css.length} bytes, zero warnings -> ${resolved} (NOT a demo build)`);
}
async function preview(head) {
  const demo = demoFor(head);
  const resolved = path.join(demo, 'wwwroot/app.v3.css');
  if (fs.realpathSync(path.dirname(resolved)) !== path.dirname(resolved)) throw new Error('Preview directory must not be redirected');
  try {
    const target = fs.lstatSync(resolved);
    if (target.isSymbolicLink() || !target.isFile()) throw new Error('Preview path must be a regular file, not a symlink');
  } catch (error) { if (error.code !== 'ENOENT') throw error; }
  const script = path.join(demo, 'wwwroot/container-fallback.v3.js');
  try {
    const target = fs.lstatSync(script);
    if (target.isSymbolicLink() || !target.isFile()) throw new Error('Preview script path must be a regular file, not a symlink');
  } catch (error) { if (error.code !== 'ENOENT') throw error; }
  const { css, manifest } = await compile(head, resolved, { containerFallback: true });
  const runtime = fs.readFileSync(path.join(__dirname, 'container-fallback-runtime.js'), 'utf8');
  // Escape JSON so no build-supplied class can terminate the script element.
  const payload = JSON.stringify(manifest).replace(/</g, '\\u003c');
  fs.writeFileSync(resolved, css);
  fs.writeFileSync(script, `${runtime}\nwindow.shadcnContainerFallback.start(${payload});\n`);
  console.log(`${head} OPT-IN preview assets: ${css.length} CSS bytes + named-container fallback -> ${resolved} (v4 app.css untouched)`);
}
if (require.main === module) {
  const args = process.argv.slice(2);
  if (args.length === 2 && args[0] === '--preview') preview(args[1]).catch(error => { console.error(error.stack); process.exitCode = 1; });
  else if (args.length === 2 && !args[0].startsWith('--')) build(args[0], args[1]).catch(error => { console.error(error.stack); process.exitCode = 1; });
  else { console.error('usage: node tools/build-tailwind3-probe.cjs <web|maui> <OS-TEMP.css> | --preview <web|maui>'); process.exitCode = 2; }
}
module.exports = { build, preview, configFor };
