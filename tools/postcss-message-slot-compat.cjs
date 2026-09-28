// Experimental v3-only selector correction for MessageContent's child data-slot.
// Tailwind 3 composes `*:data-slot` as [data-slot] on the wrapper, not child.
const selectorParser = require('postcss-selector-parser');
const className = 'group-data-[align=end]/message:*:data-slot:self-end';
const v3 = String.raw`.group\/message[data-align="end"] :is(.group-data-\[align\=end\]\/message\:\*\:data-slot\:self-end[data-slot] > *)`;
const v4 = String.raw`:is(.group-data-\[align\=end\]\/message\:\*\:data-slot\:self-end:is(:where(.group\/message)[data-align="end"] *) > *)[data-slot]`;
function messageSlotCompat() {
  return {
    postcssPlugin: 'shadcn-v3-message-slot-prototype',
    OnceExit(root) {
      let found = 0;
      root.walkRules(rule => {
        if (!rule.selector.includes('self-end')) return;
        let target = false;
        selectorParser(selectors => selectors.walkClasses(node => {
          if (node.value === className) target = true;
        })).processSync(rule.selector);
        if (!target) return;
        found++;
        if (found > 1 || (rule.selector !== v3 && rule.selector !== v4) ||
            rule.nodes.length !== 1 || rule.nodes[0].prop !== 'align-self' ||
            rule.nodes[0].value !== 'flex-end') {
          throw rule.error(`Unexpected ${className} selector or declaration`);
        }
        if (rule.selector === v3) rule.selector = v4;
      });
    },
  };
}
module.exports = { messageSlotCompat, className, v3, v4 };
