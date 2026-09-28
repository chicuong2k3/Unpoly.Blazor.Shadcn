// Tailwind 4 text-sm and base leading are unitless. Tailwind 3 emits a fixed
// 1.25rem for text-sm, making nested 0.85em <code> enlarge a doc-note line box.
// Scope the correction to demo documentation, without changing library controls.
function docInlineLeadingCompat() {
  return {
    postcssPlugin: 'shadcn-v3-doc-inline-leading-compat',
    Once(root) {
      let notes=0, ledes=0;
      root.walkRules(rule=>{
        if (rule.selector === '.doc-note') {
          const decls=rule.nodes.filter(n=>n.type==='decl' && n.prop==='line-height');
          if (decls.length!==1 || decls[0].value!=='1.25rem') throw rule.error('Unexpected doc-note line-height');
          decls[0].value='calc(1.25 / 0.875)';
          notes++;
        }
        if (rule.selector === '.doc-lede') {
          if (rule.nodes.some(n=>n.type==='decl' && n.prop==='line-height')) throw rule.error('Unexpected doc-lede line-height');
          rule.append({prop:'line-height',value:'1.5'});
          ledes++;
        }
      });
      if (notes!==1 || ledes!==1) throw root.error(`Expected one doc-note and doc-lede rule, found ${notes}/${ledes}`);
    },
  };
}
module.exports={docInlineLeadingCompat};
