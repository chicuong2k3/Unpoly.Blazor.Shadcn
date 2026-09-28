// Tailwind v4 preflight resets the library's no-JS <Select> background to
// transparent and native disabled opacity to 1. Tailwind 3 leaves the white
// background and the browser's dimming intact. Scope the preview fix to this
// select, not all consumer form controls or options.
const postcss = require('postcss');
function selectBackgroundCompat() {
  return {
    postcssPlugin: 'shadcn-v3-select-background-compat',
    OnceExit(root) {
      // A changed baseline should not silently produce an unmatched selector.
      if (!root.toString().includes('[data-slot="select"]')) throw root.error('Expected library Select slot in preview CSS');
      root.append(postcss.rule({selector:'select[data-slot="select"]',nodes:[
        postcss.decl({prop:'background-color',value:'transparent'}),
      ]}));
      root.append(postcss.rule({selector:'select[data-slot="select"]:disabled',nodes:[
        postcss.decl({prop:'opacity',value:'1'}),
      ]}));
    },
  };
}
selectBackgroundCompat.postcss = true;
module.exports = {selectBackgroundCompat};
