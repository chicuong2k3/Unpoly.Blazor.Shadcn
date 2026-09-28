// Unwired Tailwind 3 prototype: v3 emits the authored shimmer as a plain
// rule, not a variant-generating utility, and leaves nested CSS that Safari 15
// cannot parse. Do not treat this as real-device or full cascade parity.
const postcss = require('postcss');
const base = '.shimmer';
const states = ['processing', 'uploading'];
const variants = states.map(state => String.raw`.group-data-\[state\=${state}\]\/attachment\:shimmer:is(:where(.group\/attachment)[data-state="${state}"] *)`);
const darkHighlight = 'var(--shimmer-color, oklch(from currentColor max(0.8, calc(l + 0.4)) c h / calc(alpha + 0.4)))';
const legacy = '(color: color-mix(in srgb, red, blue))';
function shimmerCompat() {
  return {
    postcssPlugin: 'shadcn-v3-shimmer-prototype',
    OnceExit(root) {
      const originals = [];
      root.walkRules(rule => { if (rule.selector === base) originals.push(rule); });
      if (originals.length !== 1) throw root.error(`Expected exactly one ${base} v3 utility`);
      const rule = originals[0];
      if (rule.parent !== root) throw rule.error('Shimmer is not in the expected v3 unlayered output');
      const props = rule.nodes.filter(node => node.type === 'decl');
      const property = name => props.find(node => node.prop === name);
      const rtl = rule.nodes.filter(node => node.type === 'rule');
      const media = rule.nodes.filter(node => node.type === 'atrule');
      if (!property('background-image')?.value.includes('color-mix(in oklch') ||
          !property('animation')?.value.includes('tw-shimmer') ||
          property('--_highlight')?.value !== 'var(--shimmer-color, oklch(from currentColor l c h / calc(alpha * 0.2)))' ||
          !property('-webkit-text-fill-color') ||
          rtl.length !== 1 || rtl[0].selector !== '&:where([dir="rtl"], [dir="rtl"] *)' ||
          rtl[0].nodes.length !== 1 || rtl[0].nodes[0].prop !== 'animation-direction' || rtl[0].nodes[0].value !== 'reverse' ||
          media.length !== 1 || media[0].name !== 'media' || media[0].params !== '(prefers-reduced-motion: reduce)' ||
          media[0].nodes.filter(n => n.type === 'decl').length !== 2 ||
          media[0].nodes.find(n => n.prop === 'animation')?.value !== 'none' ||
          media[0].nodes.find(n => n.prop === '-webkit-text-fill-color')?.value !== 'currentColor') {
        throw rule.error('Unexpected shimmer source/RTL/reduced-motion; revisit the v4 baseline');
      }
      const selectors = [base, ...variants];
      const originalIndex = root.index(rule);
      const active = rule.clone();
      active.removeAll();
      for (const decl of props) active.append(decl.clone());
      active.selector = selectors.join(', ');
      // Preserve v3 utility position relative to all other v3 utilities.
      rule.replaceWith(active);
      const insert = node => { root.insertAfter(root.nodes[originalIndex], node); };
      const dark = postcss.rule({ selector: selectors.map(s => `${s}:where(.dark, .dark *)`).join(', ') });
      dark.append(postcss.decl({ prop: '--_highlight', value: darkHighlight }));
      insert(dark);
      const direction = postcss.rule({ selector: selectors.map(s => `${s}:where([dir="rtl"], [dir="rtl"] *)`).join(', ') });
      direction.append(postcss.decl({ prop: 'animation-direction', value: 'reverse' }));
      insert(direction);
      const reduced = postcss.atRule({ name: 'media', params: '(prefers-reduced-motion: reduce)' });
      const reduceRule = postcss.rule({ selector: selectors.join(', ') });
      for (const decl of media[0].nodes.filter(n => n.type === 'decl')) reduceRule.append(decl.clone());
      reduced.append(reduceRule);
      insert(reduced);
      // Safari 15 has neither color-mix nor relative OKLCH nor registered
      // property initial values. An explicit angle, opaque currentColor base
      // and a theme-aware highlight keep the text legible and sweeping.
      const fallback = postcss.atRule({ name: 'supports', params: `not ${legacy}` });
      const plain = postcss.rule({ selector: selectors.join(', ') });
      plain.append(postcss.decl({ prop: '--_shimmer-legacy-highlight', value: 'var(--shimmer-color, rgba(160, 160, 160, 0.85))' }));
      plain.append(postcss.decl({ prop: 'background-image', value: 'var(--shimmer-image, linear-gradient(110deg, var(--_base) 0%, var(--_base) 35%, var(--_shimmer-legacy-highlight) 50%, var(--_base) 65%, var(--_base) 100%))' }));
      plain.append(postcss.decl({ prop: 'background-size', value: '200% 100%' }));
      fallback.append(plain);
      const darkFallback = postcss.rule({ selector: selectors.map(s => `${s}:where(.dark, .dark *)`).join(', ') });
      darkFallback.append(postcss.decl({ prop: '--_shimmer-legacy-highlight', value: 'var(--shimmer-color, rgba(255, 255, 255, 0.85))' }));
      fallback.append(darkFallback);
      insert(fallback);
    },
  };
}
module.exports = { shimmerCompat, variants, legacy };
