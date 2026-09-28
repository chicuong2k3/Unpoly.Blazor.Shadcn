const postcss = require('postcss');
// Flatten only the two authored utilities. Safari 15 cannot parse CSS nesting,
// including nested @supports; otherwise its static mask fallback disappears.
function scrollFadeCompat() {
  return {
    postcssPlugin: 'shadcn-v3-scroll-fade-prototype',
    OnceExit(root) {
      for (const selector of ['.scroll-fade-b', '.scroll-fade-x']) {
        const matches = root.nodes.filter(node => node.type === 'rule' && node.selector === selector);
        if (matches.length !== 1) throw root.error(`Expected one unlayered ${selector}`);
        const rule = matches[0];
        const supports = rule.nodes.filter(node => node.type === 'atrule');
        const rtl = rule.nodes.filter(node => node.type === 'rule');
        if (supports.length !== 2 || supports[0].name !== 'supports' ||
            supports[0].params !== '(animation-timeline: scroll())' ||
            supports[1].name !== 'supports' ||
            supports[1].params !== 'not (animation-timeline: scroll())' ||
            rtl.length !== (selector === '.scroll-fade-x' ? 1 : 0) ||
            rtl.some(node => node.selector !== '&:where([dir="rtl"], [dir="rtl"] *)') ||
            !rule.nodes.some(node => node.prop === '-webkit-mask-image') ||
            !rule.nodes.some(node => node.prop === 'mask-image') ||
            supports[1].nodes.some(node => node.type !== 'decl') ||
            supports[0].nodes.some(node => node.type !== 'decl') ||
            (selector === '.scroll-fade-x' && (rtl[0].nodes.length !== 1 || rtl[0].nodes[0].prop !== '--scroll-fade-inline'))) {
          throw rule.error(`Unexpected ${selector} nesting; recheck v4 authored baseline`);
        }
        // Flatten siblings at the original utility position. No @layer:
        // Tailwind 3 utilities are unlayered and Safari 15 ignores @layer.
        let after = rule;
        for (const node of rule.nodes.filter(node => node.type !== 'decl' && node.type !== 'comment')) {
          let flat;
          if (node.type === 'rule') {
            flat = node.clone({ selector: `${selector}:where([dir="rtl"], [dir="rtl"] *)` });
          } else {
            flat = postcss.atRule({ name: 'supports', params: node.params });
            const target = postcss.rule({ selector });
            for (const decl of node.nodes) target.append(decl.clone());
            flat.append(target);
          }
          node.remove();
          root.insertAfter(after, flat);
          after = flat;
        }
      }
    },
  };
}
module.exports = { scrollFadeCompat };
