// Tailwind 3 attaches the nested data modifier to the parent rather than
// the direct child of FieldLabel. Match the Tailwind 4 emitted selector.
function fieldLabelChildCompat() {
  let seen=0;
  return {
    postcssPlugin:'shadcn-field-label-child-compat',
    OnceExit(root) {
      root.walkRules(rule => {
        if (!rule.selector?.includes('data-\\[slot\\=field\\]\\:p-4')) return;
        const before=rule.selector;
        if (!before.endsWith('[data-slot="field"]>*') || !rule.nodes.some(n=>n.prop==='padding'&&n.value==='1rem')) throw Error(`Unexpected FieldLabel child padding selector: ${before}`);
        rule.selector=before.replace('[data-slot="field"]>*', ' > *[data-slot="field"]');
        seen++;
      });
      if (seen!==1) throw Error(`Expected exactly one FieldLabel child padding selector, got ${seen}`);
    },
  };
}
module.exports={fieldLabelChildCompat};
