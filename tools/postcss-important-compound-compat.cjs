// Experimental v3-only correction for two variant chains whose v3 selector
// tests state on the wrong DOM node. Does not copy v4 color declarations:
// the v3 runtime RGB-channel transform must remain in effect.
const selectorParser = require('postcss-selector-parser');
const rules = [
  {
    className: 'data-[variant=destructive]:*:[svg]:text-destructive!',
    v3: String.raw`:is(.data-\[variant\=destructive\]\:\*\:\[svg\]\:text-destructive\!:is(svg) > *)[data-variant="destructive"]`,
    v4: String.raw`:is(.data-\[variant\=destructive\]\:\*\:\[svg\]\:text-destructive\![data-variant="destructive"] > *):is(svg)`,
    properties: ['--tw-text-opacity', 'color'],
  },
  {
    className: 'group-data-[orientation=vertical]/attachment:*:data-[slot=spinner]:size-6!',
    v3: String.raw`.group\/attachment[data-orientation="vertical"] :is(.group-data-\[orientation\=vertical\]\/attachment\:\*\:data-\[slot\=spinner\]\:size-6\![data-slot="spinner"] > *)`,
    v4: String.raw`:is(.group-data-\[orientation\=vertical\]\/attachment\:\*\:data-\[slot\=spinner\]\:size-6\!:is(:where(.group\/attachment)[data-orientation="vertical"] *) > *)[data-slot="spinner"]`,
    properties: ['width', 'height'],
  },
];
function importantCompoundCompat() {
  return {
    postcssPlugin: 'shadcn-v3-important-compound-prototype',
    OnceExit(root) {
      for (const target of rules) {
        const matches = [];
        root.walkRules(rule => {
          if (!rule.selector.includes('\\!')) return;
          let found = false;
          selectorParser(selectors => selectors.walkClasses(node => {
            if (node.value === target.className) found = true;
          })).processSync(rule.selector);
          if (found) matches.push(rule);
        });
        if (matches.length > 1) throw root.error(`Duplicate ${target.className}`);
        if (!matches.length) continue;
        const [rule] = matches;
        if (rule.selector !== target.v3 && rule.selector !== target.v4) {
          throw rule.error(`Unexpected selector for ${target.className}: ${rule.selector}`);
        }
        const declarations = rule.nodes.filter(node => node.type === 'decl');
        if (declarations.length !== target.properties.length ||
            declarations.some((node, index) => node.prop !== target.properties[index] || !node.important)) {
          throw rule.error(`Unexpected declarations for ${target.className}`);
        }
        if (rule.selector === target.v3) rule.selector = target.v4;
      }
    },
  };
}
module.exports = { importantCompoundCompat, rules };
