// Unwired v3 probe: premix the two Bubble hover palette colors per complete
// authored theme; Safari 15 cannot evaluate color-mix(in oklch, ...).
const { parse, interpolate, converter } = require('culori');
const rgb = converter('rgb');
const variants = new Map([
  ['--muted', '--bubble-muted-hover'],
  ['--secondary', '--bubble-secondary-hover'],
]);
function bubbleHoverCompat() {
  return {
    postcssPlugin: 'shadcn-bubble-hover-prototype',
    OnceExit(root) {
      let palettes = 0;
      root.walkRules(rule => {
        const colors = new Map(rule.nodes.filter(node => node.type === 'decl' &&
          ['--muted', '--secondary', '--foreground'].includes(node.prop)).map(node => [node.prop, node]));
        if (!colors.size) return;
        if (colors.size !== 3) throw rule.error(`Partial Bubble palette in ${rule.selector}; cannot precompute hover mix`);
        const foreground = parse(colors.get('--foreground').value.trim());
        if (!foreground || foreground.alpha !== undefined && foreground.alpha !== 1) throw rule.error('Unsupported foreground');
        for (const [name, output] of variants) {
          const base = parse(colors.get(name).value.trim());
          if (!base || base.alpha !== undefined && base.alpha !== 1) throw rule.error(`Unsupported ${name}`);
          const color = rgb(interpolate([base, foreground], 'oklch')(0.05));
          rule.append({ prop: output, value: `rgb(${[color.r, color.g, color.b].map(n => Math.round(Math.min(1, Math.max(0, n)) * 255)).join(', ')})` });
        }
        palettes++;
      });
      if (!palettes) throw root.error('Missing Bubble hover palettes');
      const found = new Set();
      root.walkDecls('background-color', decl => {
        if (!decl.value.startsWith('color-mix(in oklch,var(--')) return;
        const match = /^color-mix\(in oklch,var\((--muted|--secondary)\),var\(--foreground\) 5%\)$/.exec(decl.value);
        if (!match || found.has(match[1]) || !decl.parent.selector.includes('bubble-content')) throw decl.error(`Unexpected Bubble hover mix: ${decl.value}`);
        found.add(match[1]);
        decl.before({ prop: 'background-color', value: `var(${variants.get(match[1])})` });
      });
      if (found.size !== variants.size) throw root.error(`Expected 2 Bubble hover mixes, found ${found.size}`);
    },
  };
}
module.exports = { bubbleHoverCompat };
