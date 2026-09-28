// Opt-in preview bridge. Preserve Safari 15's rgba() fallback while modern
// browsers use the v4 OKLab mix before gamut clipping. Do not claim that the
// fallback is color-exact for out-of-sRGB theme tokens (e.g. dracula).
const suffix = 'rgba(var(--primary-rgb), calc(var(--primary-alpha, 1) * 0.9))';
const selectors = [
  '.hover\\:bg-primary\\/90:hover',
  'a.\\[a\\&\\]\\:hover\\:bg-primary\\/90:hover',
];
function primaryHoverMixCompat() {
  return {
    postcssPlugin: 'primary-hover-mix-compat',
    OnceExit(root) {
      const found = new Map(selectors.map(selector => [selector, []]));
      root.walkRules(rule => {
        if (!found.has(rule.selector)) return;
        const matches = rule.nodes.filter(node => node.type === 'decl' && node.prop === 'background-color');
        if (matches.length !== 1 || matches[0].value !== suffix) throw rule.error(`Unexpected primary hover rule: ${rule.selector}`);
        found.get(rule.selector).push(rule);
      });
      for (const [selector, rules] of found) if (rules.length !== 1)
        throw root.error(`Expected one primary hover rule: ${selector}; got ${rules.length}`);
      for (const rule of [...found.values()].flat()) {
        const modern = rule.clone();
        modern.walkDecls('background-color', decl => { decl.value = 'color-mix(in oklab, var(--primary) 90%, transparent)'; });
        if (rule.parent.type !== 'root') throw rule.error('Unexpected nested primary hover rule');
        // Insert immediately after each fallback; no nested at-rules are required
        // for Safari 15 to parse the fallback itself.
        const wrapper = require('postcss').atRule({ name: 'supports', params: '(color: color-mix(in lab, red, red))' });
        wrapper.append(modern);
        rule.after(wrapper);
      }
    },
  };
}
primaryHoverMixCompat.postcss = true;
module.exports = { primaryHoverMixCompat };
