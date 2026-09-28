// The current v4 demo CSS emits its generic low-specificity Card token after
// the sm token, so even Size=sm resolves to 24px. Preserve that baseline in
// the preview until a separate, coordinated Card-size correction is approved.
function cardSizeBaselineCompat(){
 return {postcssPlugin:'shadcn-card-size-baseline-compat',OnceExit(root){
   let small=[],general=[];
   root.walkRules(rule=>{
     if(rule.selector===':where([data-slot="card"][data-size="sm"])') small.push(rule);
     if(rule.selector===':where([data-slot="card"])') general.push(rule);
   });
   if(small.length!==1||general.length!==1||!small[0].nodes.some(n=>n.prop==='--card-spacing'&&n.value==='calc(var(--spacing) * 4)')||!general[0].nodes.some(n=>n.prop==='--card-spacing'&&n.value==='calc(var(--spacing) * 6)')) throw Error('Unexpected Card size token rules');
   general[0].remove();small[0].after(general[0]);
 }};
}
module.exports={cardSizeBaselineCompat};
