// Tailwind 3's outline-none is a transparent 2px solid outline; v4 removes
// the outline style. A class-name audit cannot catch the focus/keyboard change.
const postcss = require('postcss');
function outlineNoneCompat() {
  return {
    postcssPlugin: 'shadcn-v3-outline-none-compat',
    Once(root) {
      const rules = [];
      root.walkRules('.outline-none', rule => { if (rule.selector === '.outline-none') rules.push(rule); });
      if (rules.length !== 1 || rules[0].nodes.filter(x => x.type === 'decl').length !== 2 ||
          rules[0].nodes[0].prop !== 'outline' || rules[0].nodes[0].value !== '2px solid transparent' ||
          rules[0].nodes[1].prop !== 'outline-offset' || rules[0].nodes[1].value !== '2px') {
        throw new Error('Tailwind 3 .outline-none shape changed; review against v4 before changing it');
      }
      rules[0].removeAll();
      rules[0].append(postcss.decl({ prop: 'outline-style', value: 'none' }));
    },
  };
}
module.exports = { outlineNoneCompat };
