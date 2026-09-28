// Tailwind 3 attaches *:data-[slot=alert-description] to the Alert itself;
// v4 targets only matching children. Fail closed if the generated rule drifts.
function alertDescriptionChildCompat(){
 return {postcssPlugin:'shadcn-alert-description-child-compat',OnceExit(root){
   let count=0;
   root.walkRules(rule=>{
     if(!rule.selector?.includes('data-\\[slot\\=alert-description\\]\\:text-destructive\\/90'))return;
     const before=rule.selector;
     if(!before.includes('[data-slot="alert-description"] > *')||!rule.nodes.some(n=>n.prop==='color'))throw Error('Unexpected AlertDescription selector');
     rule.selector=before.replace('[data-slot="alert-description"] > *',' > *[data-slot="alert-description"]');count++;
   });
   if(count!==1)throw Error(`Expected one AlertDescription child rule, got ${count}`);
 }};
}
module.exports={alertDescriptionChildCompat};
