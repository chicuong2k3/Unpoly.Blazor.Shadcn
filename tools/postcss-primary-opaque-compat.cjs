// Preview-only: keep the Safari-compatible sRGB opaque fallback, but use the
// authored runtime OKLCH primary on modern browsers. Clipping the RGB channels
// before rounded-edge compositing differs from v4 for out-of-gamut Dracula.
const postcss = require('postcss');
const selector = '.bg-primary';
const fallback = 'rgba(var(--primary-rgb), calc(var(--primary-alpha, 1) * var(--tw-bg-opacity, 1)))';
function primaryOpaqueCompat() {
  return {
    postcssPlugin: 'primary-opaque-compat',
    OnceExit(root) {
      const matches = [];
      root.walkRules(selector, rule => {
        if (rule.selector === selector) matches.push(rule);
      });
      if (matches.length !== 1) throw root.error(`Expected one ${selector} rule, got ${matches.length}`);
      const rule = matches[0];
      if (rule.parent.type !== 'root' || rule.nodes.length !== 2 ||
          rule.nodes[0].prop !== '--tw-bg-opacity' || rule.nodes[0].value !== '1' ||
          rule.nodes[1].prop !== 'background-color' || rule.nodes[1].value !== fallback)
        throw rule.error('Unexpected opaque primary rule');
      const modern = postcss.atRule({ name: 'supports', params: '(color: oklch(50% 0.1 180))' });
      modern.append(postcss.rule({ selector }).append(postcss.decl({ prop: 'background-color', value: 'var(--primary)' })));
      rule.after(modern);
      // Match v4's authored OKLCH primary in modern engines, without removing
      // the Safari-15-compatible sRGB fallbacks. Scan once before mutating.
      const targets = new Map([
        ['.text-primary', { prop: 'color', fallback: 'rgba(var(--primary-rgb), calc(var(--primary-alpha, 1) * var(--tw-text-opacity, 1)))', value: 'var(--primary)', opacity: true }],
        ['.border-primary\\/40', { prop: 'border-color', fallback: 'rgba(var(--primary-rgb), calc(var(--primary-alpha, 1) * 0.4))', value: 'color-mix(in oklab, var(--primary) 40%, transparent)' }],
      ]);
      const found = new Map();
      root.walkRules(candidate => {
        if (targets.has(candidate.selector)) {
          if (found.has(candidate.selector)) throw candidate.error(`Duplicate ${candidate.selector}`);
          found.set(candidate.selector, candidate);
        }
      });
      for (const [name, spec] of targets) {
        const target = found.get(name);
        if (!target || target.parent.type !== 'root' || target.nodes.length !== (spec.opacity ? 2 : 1) ||
            (spec.opacity && (target.nodes[0].prop !== '--tw-text-opacity' || target.nodes[0].value !== '1')) ||
            target.nodes.at(-1).prop !== spec.prop || target.nodes.at(-1).value !== spec.fallback)
          throw root.error(`Unexpected or missing ${name} fallback`);
        const guard = postcss.atRule({name:'supports',params:'(color: oklch(50% 0.1 180))'});
        guard.append(postcss.rule({selector:name}).append(postcss.decl({prop:spec.prop,value:spec.value})));
        target.after(guard);
      }
    },
  };
}
primaryOpaqueCompat.postcss = true;
module.exports = { primaryOpaqueCompat };
