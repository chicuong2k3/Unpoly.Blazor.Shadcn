// Tailwind 3 composes *:[img] as parent:is(img) > * instead of
// parent > *:is(img). AttachmentMedia relies on this for square thumbnails.
function childImgCompoundCompat() {
  return {
    postcssPlugin: 'shadcn-v3-child-img-compound-compat',
    Once(root) {
      const utilities = new Set();
      root.walkRules(rule => {
        if (!rule.selector.startsWith(':is(.\\*\\:\\[img\\]\\:')) return;
        if (!rule.selector.endsWith(':is(img) > *)')) throw rule.error(`Unexpected child-img variant: ${rule.selector}`);
        const utility = rule.selector.slice(':is(.\\*\\:\\[img\\]\\:'.length, -':is(img) > *)'.length);
        if (!['aspect-square', 'w-full', 'object-cover'].includes(utility) || utilities.has(utility)) throw rule.error(`Unexpected child-img utility: ${utility}`);
        rule.selector = rule.selector.replace(':is(img) > *)', ' > *):is(img)');
        utilities.add(utility);
      });
      if (utilities.size !== 3) throw root.error(`Expected 3 child-img variant selectors, found ${utilities.size}`);
    },
  };
}
module.exports = { childImgCompoundCompat };
