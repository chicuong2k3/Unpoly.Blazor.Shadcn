// Experimental Tailwind 3 mappings for values used by v4 shadcn components.
// Import this from a future v3 build config; neither demo uses it yet.
const theme = {
  spacing: { 18: '4.5rem', 30: '7.5rem' },
  brightness: { 60: '0.6' },
  transitionDuration: { 400: '400ms' },
  textUnderlineOffset: { 3: '3px' },
};
function addLogicalUtilities({ addUtilities }) {
  // Tailwind 3 has start-1/2, but not v4's inset-s-1/2 spelling.
  // A logical property preserves the v4 left/right swap under dir=rtl.
  addUtilities({ '.inset-s-1\\/2': { 'inset-inline-start': '50%' } });
}
// v3 composes *:[a] in the wrong order: parent:is(a) > *, instead
// of v4's parent > *:is(a). Class-name audits cannot detect this.
const childLinkClass = String.raw`.\*\:\[a\]\:underline-offset-3`;
const v3ChildLink = `:is(${childLinkClass}:is(a) > *)`;
const v4ChildLink = `:is(${childLinkClass} > *):is(a)`;
function fixChildLinkSelector() {
  return {
    postcssPlugin: 'shadcn-v3-child-link-prototype',
    OnceExit(root) {
      root.walkRules(rule => {
        if (!rule.selector.includes('underline-offset-3') || !rule.selector.includes('\\*')) return;
        if (rule.selector === v4ChildLink) return;
        if (rule.selector !== v3ChildLink || rule.nodes.length !== 1 ||
            rule.nodes[0].prop !== 'text-underline-offset' || rule.nodes[0].value !== '3px') {
          throw rule.error(`Unexpected *:[a]:underline-offset-3 shape: ${rule.selector} ${JSON.stringify(rule.nodes.map(node => [node.prop, node.value]))}`);
        }
        rule.selector = v4ChildLink;
      });
    },
  };
}
function addVariants({ addVariant }) {
  addVariant('[.border-b]', '&:is(.border-b)');
  addVariant('[.border-t]', '&:is(.border-t)');
}
module.exports = { theme, addVariants, addLogicalUtilities, fixChildLinkSelector, v4ChildLink };
