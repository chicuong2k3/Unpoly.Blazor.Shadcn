// Tailwind 4 emits up-current utility selectors in @layer utilities; Tailwind 3
// emits them unlayered, incorrectly winning over Portal's later unlayered nav CSS.
const postcss = require('postcss');
function consumerCurrentCascadeCompat() {
  return { postcssPlugin: 'consumer-current-cascade', OnceExit(root) {
    const rules = [];
    root.walkRules(rule => { if (rule.selector.includes('up-current')) rules.push(rule); });
    if (rules.length !== 7 || rules.some(rule => rule.parent.type !== 'root'))
      throw root.error(`Expected seven root up-current utilities, found ${rules.length}`);
    const layer = postcss.atRule({ name: 'layer', params: 'utilities' });
    rules[0].before(layer);
    for (const rule of rules) { rule.remove(); layer.append(rule); }
  } };
}
module.exports = { consumerCurrentCascadeCompat };
