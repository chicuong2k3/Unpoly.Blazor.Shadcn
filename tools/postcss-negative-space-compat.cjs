const postcss=require('postcss');
// Tailwind 4 applies negative space to preceding children; Tailwind 3
// applies a physical margin to later visible siblings (which can be hidden).
function negativeSpaceCompat(){
 return {postcssPlugin:'shadcn-negative-space-compat',OnceExit(root){let seen=0;
  root.walkRules(rule=>{
   if(!rule.selector?.startsWith('.-space-x-2 >'))return;
   if(rule.selector!=='.-space-x-2 > :not([hidden]) ~ :not([hidden])'||!rule.nodes.some(n=>n.prop==='margin-left'))throw Error(`Unexpected negative spacing: ${rule.selector}`);
   rule.selector=':where(.-space-x-2 > :not(:last-child))';rule.removeAll();rule.append(postcss.decl({prop:'margin-inline-end',value:'-0.5rem'}));seen++;
  });
  if(seen!==1)throw Error(`Expected one negative-space rule, got ${seen}`);
 }};
}
module.exports={negativeSpaceCompat};
