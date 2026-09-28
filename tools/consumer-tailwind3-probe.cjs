#!/usr/bin/env node
// Diagnostic only: compile consumer entrypoints with Tailwind 3 without replacing app.css.
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const postcss = require('postcss');
const tailwind = require('tailwindcss');
const root = path.resolve(__dirname, '..', '..', '..');
const library = path.resolve(__dirname, '..');
const { configFor } = require('./build-tailwind3-probe.cjs');
const { colorChannels } = require('./postcss-color-channels.cjs');
const { brandChannels } = require('./consumer-brand-channels.cjs');
const { scopedChannels } = require('./consumer-scoped-channels.cjs');
const { consumerCurrentCascadeCompat } = require('./postcss-consumer-current-cascade-compat.cjs');
const { discover, discoverImportant, rename } = require('./tailwind3-var-alias.cjs');
const { namedGroupCompat } = require('./postcss-named-group-compat.cjs');
const { importantCompoundCompat } = require('./postcss-important-compound-compat.cjs');
const { shimmerCompat } = require('./postcss-shimmer-compat.cjs');
const { fieldCompoundCompat } = require('./postcss-field-compound-compat.cjs');
const { spacingToken } = require('./tailwind3-spacing-token.cjs');
const { spacingFunctionCompat } = require('./postcss-spacing-function-compat.cjs');
const { preflightSpacingCompat } = require('./postcss-preflight-spacing-compat.cjs');
const { inputGroupHasCompat } = require('./postcss-input-group-has-compat.cjs');
const { childImgCompoundCompat } = require('./postcss-child-img-compound-compat.cjs');
const { fieldLabelChildCompat } = require('./postcss-field-label-child-compat.cjs');
const { alertDescriptionChildCompat } = require('./postcss-alert-description-child-compat.cjs');
const { formPreflightCompat } = require('./postcss-form-preflight-compat.cjs');
const { negativeSpaceCompat } = require('./postcss-negative-space-compat.cjs');
const { outlineNoneCompat } = require('./postcss-outline-none-compat.cjs');
const { nativeSelectOpacityCompat } = require('./postcss-native-select-opacity-compat.cjs');
const { sliderVerticalCompat } = require('./postcss-slider-vertical-compat.cjs');
const { paletteRoot, paletteAlphaFallback } = require('./tailwind3-palette-compat.cjs');
const { consumerAlphaCompat } = require('./postcss-consumer-alpha-compat.cjs');
const { createContainerFallback } = require('./postcss-container-fallback.cjs');
const entries = {
  portal: path.join(root, 'src/Pos.Portal.Web/Styles/app.tailwind.css'),
  pos: path.join(root, 'src/Pos.App/Styles/app.tailwind.css'),
};
async function main(name) {
  if (!Object.hasOwn(entries, name)) throw Error('Expected portal or pos');
  const entry = entries[name];
  const output = path.join(os.tmpdir(), `shadcn-${name}-tailwind3-probe.css`);
  const { config, aliases, palette } = configFor(path.join(library, 'demo/Unpoly.Blazor.Shadcn.Demo'));
  // The demo palette is NOT the consumer palette. This probe intentionally checks
  // compilation only, not visual parity or a deployable consumer stylesheet.
  config.theme.extend.fontFamily.display = ['var(--font-display)'];
  Object.assign(config.theme.extend.colors, {
    'destructive-light': 'var(--destructive-light)',
    'destructive-text': 'var(--destructive-text)',
    positive: ({ opacityValue } = {}) => opacityValue === undefined ? 'var(--positive)' : `rgba(var(--positive-rgb), calc(var(--positive-alpha, 1) * ${opacityValue}))`, 'positive-light': 'var(--positive-light)',
    'positive-text': 'var(--positive-text)', warning: ({ opacityValue } = {}) => opacityValue === undefined ? 'var(--warning)' : `rgba(var(--warning-rgb), calc(var(--warning-alpha, 1) * ${opacityValue}))`,
    'warning-light': 'var(--warning-light)', 'warning-text': 'var(--warning-text)',
    'primary-hover': 'var(--primary-hover)', 'primary-container': 'var(--primary-container)',
  });
  const consumerSources = [
    ...walk(path.join(root, 'src/Pos.App/Components')),
    ...walk(path.join(root, 'src/Pos.Portal.Web/Components')),
  ];
  const consumerAliases = discover(consumerSources);
  for (const [v3, v4] of discoverImportant(consumerSources)) consumerAliases.set(v3, v4);
  // configFor already safelists library aliases. Add consumer-only spellings.
  // The POS v4 source scanner also sees waiter-order.js; Portal's v4 baseline
  // does not include its two script-only colors. Preserve only POS's inventory.
  config.safelist.push(...consumerAliases.keys(), 'ease-out',
    ...(name === 'pos' ? ['text-destructive-foreground', 'text-emerald-700'] : []));
  for (const [v3, v4] of consumerAliases) aliases.set(v3, v4);
  config.content = [
    path.join(root, 'src/Pos.App/Components/**/*.razor'),
    path.join(root, 'src/Pos.Portal.Web/Components/**/*.razor'),
    path.join(library, 'src/**/*.razor'),
    path.join(library, 'src/**/wwwroot/**/*.js'),
  ];
  const source = fs.readFileSync(entry, 'utf8');
  const combined = name === 'portal'
    ? source.replace('@import "../../Pos.App/Styles/app.tailwind.css";',
        fs.readFileSync(entries.pos, 'utf8'))
    : source;
  const styles = path.join(library, 'src/Unpoly.Blazor.Shadcn/Styles');
  const ui = fs.readFileSync(path.join(styles, 'ui.css'), 'utf8')
    .replace('@import "./ui.behavior.css";', fs.readFileSync(path.join(styles, 'ui.behavior.css'), 'utf8'));
  const themeFonts = [...combined.matchAll(/--font-(sans|display):\s*([^;]+);/g)];
  if (themeFonts.length !== 2) throw Error('Expected both consumer font declarations');
  const css = combined.replace('@import "tailwindcss";',
    '@tailwind base;\n@tailwind components;\n@tailwind utilities;')
    .replace('@import "../../../vendor/Unpoly.Blazor.Shadcn/src/Unpoly.Blazor.Shadcn/Styles/ui.css";', ui);
  if (!css.includes('@tailwind base;') || css.includes('@import "../../../vendor/Unpoly.Blazor.Shadcn/src/Unpoly.Blazor.Shadcn/Styles/ui.css";'))
    throw Error('Consumer import conversion failed');
  // v4's @theme inline creates --color-* variables for authored app CSS as
  // inherited root values. Do NOT rewrite authored var(--color-muted) into
  // var(--muted): Portal's body overrides --muted but not inherited --color-muted.
  const themeMappings = new Map(), libraryDefaults = new Map();
  const libraryRoot = postcss.parse(ui).nodes.find(node => node.type === 'rule' && node.selector === ':root');
  if (!libraryRoot) throw Error('Library root tokens missing');
  libraryRoot.walkDecls(/^--/, decl => libraryDefaults.set(decl.prop, decl.value));
  postcss.parse(css).walkAtRules('theme', at => at.walkDecls(/^--color-/, decl => {
    if (themeMappings.has(decl.prop)) throw decl.error(`Duplicate theme mapping: ${decl.prop}`);
    const alias = /^var\((--[a-z0-9-]+)\)$/.exec(decl.value.trim());
    // v4 computes authored --color-* once in the library's theme layer;
    // later POS brand and Portal body overrides cannot change that inherited
    // computed value. v3 must not point authored CSS at the live palette.
    themeMappings.set(decl.prop, alias && libraryDefaults.has(alias[1])
      ? libraryDefaults.get(alias[1]) : decl.value);
  }));
  if (themeMappings.size < 20) throw Error('Missing library and consumer color mappings');
  const fonts = postcss.rule({ selector: ':root' });
  for (const [, name, value] of themeFonts) fonts.append({ prop: `--font-${name}`, value: value.trim() });
  for (const [prop, value] of themeMappings) fonts.append({ prop, value });
  const directives = {
    postcssPlugin: 'consumer-v4-directive-probe',
    AtRule(at) {
      if (['source', 'custom-variant', 'variant'].includes(at.name)) at.remove();
      if (at.name === 'theme') at.remove();
      if (at.name === 'utility') {
        const rule = postcss.rule({ selector: `.${at.params.trim()}` });
        if (at.nodes) rule.append(...at.nodes);
        at.replaceWith(rule);
      }
    },
  };
  const fallback = createContainerFallback();
  const hasPseudo = (await import('css-has-pseudo')).default;
  const result = await postcss([
    directives, colorChannels(), spacingToken(), tailwind(config), paletteAlphaFallback(palette), paletteRoot(palette), negativeSpaceCompat(),
    rename(aliases), outlineNoneCompat(), fieldCompoundCompat(), inputGroupHasCompat(), childImgCompoundCompat(),
    fieldLabelChildCompat(), alertDescriptionChildCompat(), namedGroupCompat(), importantCompoundCompat(),
    shimmerCompat(), sliderVerticalCompat(), nativeSelectOpacityCompat(), spacingFunctionCompat(),
    preflightSpacingCompat(), formPreflightCompat(), consumerAlphaCompat(), consumerCurrentCascadeCompat(), fallback.plugin,
  ])
    .process(css, { from: entry, to: output });
  if (result.warnings().length) throw Error(result.warnings().join('\n'));
  result.root.prepend(fonts);
  // Perform the :has rewrite only after fail-closed selector bridges have seen
  // the originals; keep native selectors for modern browsers.
  const transformed = await postcss([hasPseudo({ preserve: true })])
    .process(result.root.toString(), { from: entry, to: output });
  if (transformed.warnings().length) throw Error(transformed.warnings().join('\n'));
  const candidate = transformed.css;
  const fallbackOutput = path.join(os.tmpdir(), `shadcn-${name}-container-v3-probe.js`);
  const runtime = fs.readFileSync(path.join(__dirname, 'container-fallback-runtime.js'), 'utf8');
  fs.writeFileSync(fallbackOutput, `${runtime}\nwindow.shadcnContainerFallback.start(${JSON.stringify(fallback.manifest).replace(/</g, '\\u003c')});\n`);
  fs.writeFileSync(output, candidate);
  const brand = brandChannels(fs.readFileSync(path.join(root, 'src/Pos.App/wwwroot/brand.css'), 'utf8'));
  const brandOutput = path.join(os.tmpdir(), `shadcn-${name}-brand-v3-probe.css`);
  fs.writeFileSync(brandOutput, brand.css);
  if (name === 'portal') {
    const site = scopedChannels(fs.readFileSync(path.join(root, 'src/Pos.Portal.Web/wwwroot/portal-site.css'), 'utf8'));
    fs.writeFileSync(path.join(os.tmpdir(), 'shadcn-portal-site-v3-probe.css'), site.css);
  }
  if (process.argv[3] === '--preview') {
    const destination = path.join(root, name === 'portal' ? 'src/Pos.Portal.Web/wwwroot' : 'src/Pos.App/wwwroot');
    if (!fs.statSync(destination).isDirectory() || fs.realpathSync(destination) !== destination)
      throw Error(`${name} wwwroot is redirected`);
    const assets = [
      ['app.v3.css', candidate], ['brand.v3.css', brand.css],
      ['container-fallback.v3.js', fs.readFileSync(fallbackOutput)],
    ];
    if (name === 'portal') assets.push(['portal-site.v3.css', fs.readFileSync(path.join(os.tmpdir(), 'shadcn-portal-site-v3-probe.css'))]);
    if (name === 'pos') {
      const index = fs.readFileSync(path.join(destination, 'index.html'), 'utf8');
      if (index.split('href="app.css"').length !== 2 || index.split('href="brand.css"').length !== 2 || !index.includes('<html lang="vi" data-density="compact">'))
        throw Error('POS host preview template changed');
      const preview = index.replace('<html lang="vi" data-density="compact">', '<html lang="vi" data-density="compact" class="js-has-pseudo">')
        .replace('href="app.css"', 'href="app.v3.css"')
        .replace('href="brand.css"', 'href="brand.v3.css"')
        .replace('</head>', `    <link rel="stylesheet" href="_content/Unpoly.Blazor.Shadcn/ui.safari15.css" />\n    <script src="_content/Unpoly.Blazor.Shadcn/compat/safari15-shim.js"></script>\n    <script src="_content/Unpoly.Blazor.Shadcn/compat/popover.iife.min.js"></script>\n    <script src="_content/Unpoly.Blazor.Shadcn/compat/css-has-pseudo.js"></script>\n    <script src="_content/Unpoly.Blazor.Shadcn/compat/has-pseudo-boot.js"></script>\n    <script>if (!(window.CSS && CSS.supports && CSS.supports('container-type', 'inline-size'))) document.write('<script src="container-fallback.v3.js"><\\/script>');</script>\n</head>`);
      assets.push(['index.v3.html', preview]);
    }
    for (const [file] of assets) {
      const target = path.join(destination, file);
      try {
        if (!fs.lstatSync(target).isFile()) throw Error(`Preview target is not a regular file: ${target}`);
      } catch (error) { if (error.code !== 'ENOENT') throw error; }
    }
    for (const [file, content] of assets) fs.writeFileSync(path.join(destination, file), content);
    console.log(`${name} opt-in preview CSS and fallback written to ${destination}; normal host still loads v4`);
  }
  console.log(`${name} diagnostic compiled ${Buffer.byteLength(candidate)} CSS bytes to ${output}; ${brand.overrides.length} brand channel overrides to ${brandOutput}; container runtime to ${fallbackOutput}; NOT production parity`);
}
function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const file = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(file) : /\.(razor|cs|js)$/.test(entry.name) ? [file] : [];
  });
}
if (process.argv[3] && process.argv[3] !== '--preview') throw Error('Only --preview is supported');
main(process.argv[2]).catch(error => { console.error(error.stack); process.exitCode = 1; });
