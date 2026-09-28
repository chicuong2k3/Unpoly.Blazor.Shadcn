const postcss = require('postcss');
// Tailwind 3 emits the same-specificity >svg size-4 after size-3.5. In v4
// ButtonVariants' base size-4 is overridden by InputGroupButton's compact
// xs rule, giving the eye icon 14px rather than 16px.
function inputGroupIconCompat() {
  return {
    postcssPlugin: 'shadcn-v3-input-group-icon-compat',
    OnceExit(root) {
      const rule = postcss.rule({ selector: '[data-slot="input-group-button"][data-size="xs"] > svg:not([class*="size-"])' });
      rule.append(postcss.decl({ prop: 'width', value: '0.875rem' }));
      rule.append(postcss.decl({ prop: 'height', value: '0.875rem' }));
      root.append(rule);
    },
  };
}
module.exports = { inputGroupIconCompat };
