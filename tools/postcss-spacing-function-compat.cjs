// Tailwind v4's --spacing(n) is a compile-time CSS function, not a browser
// custom property. Tailwind 3 preserves it literally in arbitrary values;
// var(--spacing(9)) is invalid, collapsing Calendar's --cell-size to auto.
// Convert values only, leaving escaped utility selectors unchanged.
const postcss = require('postcss');
const argument = String.raw`(var\(--[\w-]+\)|\d+(?:\.\d+)?)`;
const wrapped = new RegExp(String.raw`var\(--spacing\(${argument}\)\)`, 'g');
const bare = new RegExp(String.raw`--spacing\(${argument}\)`, 'g');
function spacingFunctionCompat() {
  return {
    postcssPlugin: 'shadcn-v3-spacing-function-compat',
    Declaration(decl) {
      if (!decl.value.includes('--spacing(')) return;
      decl.value = decl.value.replace(wrapped, (_, amount) => `calc(var(--spacing) * ${amount})`)
        .replace(bare, (_, amount) => `calc(var(--spacing) * ${amount})`);
      if (decl.value.includes('--spacing(')) throw decl.error(`Unsupported Tailwind v4 spacing() expression: ${decl.value}`);
    },
  };
}
module.exports = { spacingFunctionCompat };
