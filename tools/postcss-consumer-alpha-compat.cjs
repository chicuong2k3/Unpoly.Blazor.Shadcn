// Consumer diagnostic: keep rgba fallbacks for older engines and restore
// Tailwind 4's OKLab mixing in modern browsers for actual POS brand shades.
const postcss = require('postcss');
const targets = [
  ['.bg-primary\\/10', 'background-color', 'primary', 10],
  ['.border-positive\\/20', 'border-color', 'positive', 20],
  ['.border-positive\\/25', 'border-color', 'positive', 25],
  ['.border-positive\\/30', 'border-color', 'positive', 30],
  ['.border-warning\\/20', 'border-color', 'warning', 20],
  ['.border-warning\\/30', 'border-color', 'warning', 30],
];
function consumerAlphaCompat() {
  return { postcssPlugin: 'consumer-alpha-v4-modern', OnceExit(root) {
    for (const [selector, prop, token, percent] of targets) {
      const rules = [];
      root.walkRules(rule => { if (rule.selector === selector) rules.push(rule); });
      if (rules.length !== 1 || rules[0].parent.type !== 'root') throw root.error(`Expected one root ${selector}`);
      const fallback = `rgba(var(--${token}-rgb), calc(var(--${token}-alpha, 1) * ${percent / 100}))`;
      if (!rules[0].nodes.some(node => node.prop === prop && node.value === fallback))
        throw rules[0].error(`Unexpected fallback for ${selector}`);
      const modern = postcss.atRule({ name: 'supports', params: '(color: color-mix(in oklab, red, transparent))' });
      modern.append(postcss.rule({ selector }).append(postcss.decl({ prop, value: `color-mix(in oklab, var(--${token}) ${percent}%, transparent)` })));
      rules[0].after(modern);
    }
  } };
}
module.exports = { consumerAlphaCompat };
