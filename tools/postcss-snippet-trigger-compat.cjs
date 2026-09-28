// v4's TabsTrigger text-control utility wins over the lower-priority
// Snippet behaviour rule (font-size: .75rem). v3's unlayered rule would win
// instead. Keep the runtime control token for light/dark/density themes.
function snippetTriggerCompat() {
  return {
    postcssPlugin: 'shadcn-v3-snippet-trigger-compat',
    Once(root) {
      let count = 0, tabsCount = 0;
      root.walkRules('[data-slot="snippet"] > [data-slot="tabs"]', rule => {
        if (rule.selector !== '[data-slot="snippet"] > [data-slot="tabs"]') throw rule.error('Unexpected Snippet tabs selector');
        let gaps = 0;
        rule.walkDecls('gap', decl => {
          if (decl.value !== '0') throw decl.error('Unexpected Snippet tabs gap');
          decl.value = 'calc(var(--spacing) * 2)'; // v4 Tabs gap-2 utility wins.
          gaps++;
        });
        if (gaps !== 1) throw rule.error('Expected exactly one Snippet tabs gap');
        tabsCount++;
      });
      root.walkRules('[data-slot="snippet"] [data-slot="tabs-trigger"]', rule => {
        if (rule.selector !== '[data-slot="snippet"] [data-slot="tabs-trigger"]') throw rule.error('Unexpected Snippet trigger selector');
        let sizes = 0;
        rule.walkDecls('font-size', decl => {
          if (decl.value !== '0.75rem') throw decl.error('Unexpected Snippet trigger size');
          decl.value = 'var(--control-text)';
          sizes++;
        });
        if (sizes !== 1) throw rule.error('Expected exactly one Snippet trigger size');
        count++;
      });
      if (count !== 1 || tabsCount !== 1) throw root.error(`Expected one Snippet tabs and trigger rule, found ${tabsCount}/${count}`);
    },
  };
}
module.exports = { snippetTriggerCompat };
