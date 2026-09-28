// Unwired v3 prototype: Tailwind 3 composes *:data-[slot=bubble-content]
// on the PARENT; v4 applies the slot condition to each direct CHILD.
const child = /^:is\((\.[^\s]+)\[data-slot="bubble-content"\] > \*\)(:is\(\.dark \*\))?$/;
function bubbleSlotCompat() {
  return {
    postcssPlugin: 'shadcn-bubble-child-slot-prototype',
    OnceExit(root) {
      let repaired = 0;
      root.walkRules(rule => {
        if (!rule.selector.includes('data-\\[slot\\=bubble-content\\]')) return;
        if (!rule.selector.includes(' > *)')) return; // hover rules already target children.
        const match = child.exec(rule.selector);
        if (!match) throw rule.error(`Unexpected Bubble slot variant: ${rule.selector}`);
        const [, cls, dark] = match;
        rule.selector = `:is(${cls}${dark ? ':where(.dark, .dark *)' : ''} > *)[data-slot="bubble-content"]`;
        repaired++;
      });
      if (repaired !== 16) throw root.error(`Expected 16 Bubble child slot selectors, found ${repaired}`);
    },
  };
}
module.exports = { bubbleSlotCompat };
