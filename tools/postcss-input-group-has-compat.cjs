// Tailwind 3 composes has-[>addon]:[&>input] in the wrong order:
// .group > input:has(>addon). The addon is a sibling of the input, so that
// can never match. Tailwind 4 emits .group:has(>addon) > input.
function inputGroupHasCompat() {
  return {
    postcssPlugin: 'shadcn-v3-input-group-has-compat',
    Once(root) {
      let fixed = 0;
      root.walkRules(rule => {
        const found = rule.selector.match(/^(\.has-.*)>input:has\(>\[data-align=(inline-start|inline-end|block-start|block-end)\]\)$/);
        if (!found) return;
        if (!rule.selector.includes('\\[\\&\\>input\\]')) throw rule.error('Unexpected has compound selector');
        rule.selector = `${found[1]}:has(>[data-align=${found[2]}])>input`;
        fixed++;
      });
      if (fixed !== 4) throw root.error(`Expected 4 input-group has compounds, found ${fixed}`);
    },
  };
}
module.exports = { inputGroupHasCompat };
