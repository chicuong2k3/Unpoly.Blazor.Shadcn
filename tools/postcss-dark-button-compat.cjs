// Prototype only: v4 dark:bg-destructive/60 uses zero-specificity :where;
// Tailwind 3 class mode emits :is(.dark *) which beats hover:bg-destructive/90.
// Do not rewrite unrelated/compound dark selectors without their own parity tests.
const cases = [
  { candidate: '.dark\\:bg-destructive\\/60:is(.dark *)', baseline: '.dark\\:bg-destructive\\/60:where(.dark, .dark *)',
    declarations: [['background-color', 'rgba(var(--destructive-rgb), calc(var(--destructive-alpha, 1) * 0.6))']] },
  { candidate: '.dark\\:border-input:is(.dark *)', baseline: '.dark\\:border-input:where(.dark, .dark *)',
    declarations: [['--tw-border-opacity', '1'], ['border-color', 'rgba(var(--input-rgb), calc(var(--input-alpha, 1) * var(--tw-border-opacity, 1)))']] },
];
function darkButtonCompat() {
  return {
    postcssPlugin: 'shadcn-v3-dark-button-prototype',
    OnceExit(root) {
      for (const { candidate, baseline, declarations } of cases) {
        const rules = [];
        root.walkRules(rule => { if (rule.selector === candidate) rules.push(rule); });
        if (rules.length !== 1 || rules[0].nodes.length !== declarations.length ||
            declarations.some(([prop, value], i) => rules[0].nodes[i].prop !== prop || rules[0].nodes[i].value !== value)) {
          throw root.error(`Unexpected ${candidate} rule; review v4/v3 cascade before rewriting`);
        }
        rules[0].selector = baseline;
      }
    },
  };
}
module.exports = { darkButtonCompat };
