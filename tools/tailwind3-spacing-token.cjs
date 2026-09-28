const postcss = require('postcss');
// Tailwind v4 emits its default 0.25rem --spacing into the theme layer.
// Tailwind 3 uses an internal spacing table and emits NO runtime token;
// authored CSS (scroll fade, layout, themes) still needs the actual variable.
function spacingToken() {
  return {
    postcssPlugin: 'shadcn-v3-runtime-spacing-prototype',
    Once(root) {
      let existing = false;
      root.walkDecls('--spacing', () => { existing = true; });
      if (existing) throw root.error('Unexpected authored --spacing; recheck cascade before adding v3 fallback');
      const rule = postcss.rule({ selector: ':root' });
      rule.append(postcss.decl({ prop: '--spacing', value: '0.25rem' }));
      // v4 @theme supplies defaults at :root even when no named theme is
      // selected. The v3 directive conversion removes @theme, so html with
      // font-family:var(--font-sans) falls back to Times New Roman otherwise.
      rule.append(postcss.decl({ prop: '--font-sans', value: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", "Noto Sans", Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji"' }));
      rule.append(postcss.decl({ prop: '--font-mono', value: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace' }));
      root.prepend(rule);
    },
  };
}
module.exports = { spacingToken };
