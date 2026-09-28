const postcss = require('postcss');
// v4 Preflight zeroes margin and padding on every element; v3 Preflight only
// zeroes selected elements. E.g. Chromium gives th 1px padding, growing a
// Calendar header and moving its day grid when running the v3 preview.
function preflightSpacingCompat() {
  return {
    postcssPlugin: 'shadcn-v3-preflight-spacing-compat',
    Once(root) {
      // Keep newer pseudo-elements separate: an unsupported selector must not
      // invalidate the universal reset on an older WebKit engine.
      for (const selector of ['::file-selector-button', '::backdrop', '*, ::before, ::after']) {
        const reset = postcss.rule({ selector });
        reset.append(postcss.decl({ prop: 'margin', value: '0' }));
        reset.append(postcss.decl({ prop: 'padding', value: '0' }));
        root.prepend(reset);
      }
    },
  };
}
module.exports = { preflightSpacingCompat };
