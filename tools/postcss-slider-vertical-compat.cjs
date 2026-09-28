// Preview-only cascade bridge: v4 utilities layer overrides the vertical
// slider's ui.behavior.css block-size:auto; v3 unlayered rules do not.
const postcss = require('postcss');
const baseSelector = 'input[type="range"][data-slot="slider"][data-orientation="vertical"]';
const utilitySelector = '.data-\\[orientation\\=vertical\\]\\:w-4[data-orientation="vertical"]';
const heightSelector = '.data-\\[orientation\\=vertical\\]\\:h-full[data-orientation="vertical"]';
function sliderVerticalCompat() {
  return {
    postcssPlugin: 'slider-vertical-compat',
    OnceExit(root) {
      const base = [], utility = [], height = [];
      root.walkRules(rule => {
        if (rule.selector === baseSelector && rule.nodes.some(n => n.type === 'decl' && n.prop === 'block-size')) base.push(rule);
        if (rule.selector === utilitySelector) utility.push(rule);
        if (rule.selector === heightSelector) height.push(rule);
      });
      if (base.length !== 1 || base[0].nodes.filter(n => n.type === 'decl' && n.prop === 'block-size' && n.value === 'auto').length !== 1 ||
          utility.length !== 1 || utility[0].nodes.filter(n => n.type === 'decl' && n.prop === 'width' && n.value === '1rem').length !== 1 ||
          base[0].nodes.filter(n => n.type === 'decl' && n.prop === 'inline-size' && n.value === 'auto').length !== 1 ||
          height.length !== 1 || height[0].nodes.filter(n => n.type === 'decl' && n.prop === 'height' && n.value === '100%').length !== 1)
        throw root.error('Unexpected vertical Slider behavior/width utility; cannot apply scoped cascade fix');
      root.append(postcss.rule({ selector: baseSelector + utilitySelector, nodes: [postcss.decl({ prop: 'block-size', value: '1rem' })] }));
      // In vertical writing mode height is inline-size. The unlayered behavior
      // rule also beats h-full, leaving only the 11rem min-height in v3.
      root.append(postcss.rule({ selector: baseSelector + heightSelector, nodes: [postcss.decl({ prop: 'inline-size', value: '100%' })] }));
    },
  };
}
sliderVerticalCompat.postcss = true;
module.exports = { sliderVerticalCompat, baseSelector, utilitySelector };
