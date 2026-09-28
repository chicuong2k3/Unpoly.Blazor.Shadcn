const postcss=require('postcss');
// Tailwind 4 preflight resets input backgrounds; Tailwind 3 leaves the native
// white background inside a translucent ComboboxChips frame or OTP slots.
// Limit the preview bridge to these library inputs, not consumer text inputs.
function comboboxChipInputCompat(){
 return {postcssPlugin:'shadcn-combobox-chip-input-compat',OnceExit(root){
   let min=0,flex=0;
   root.walkRules(rule=>{
     if(rule.selector==='.min-w-16'&&rule.nodes.some(n=>n.prop==='min-width'&&n.value==='4rem')) min++;
     if(rule.selector==='.flex-1'&&rule.nodes.some(n=>n.prop==='flex'&&n.value==='1 1 0%')) flex++;
   });
   if(min!==1||flex!==1)throw Error('Unexpected chip input utility rules');
   root.append(postcss.rule({selector:'input[data-slot="combobox-chip-input"], input[data-slot="input-otp-slot"]',nodes:[postcss.decl({prop:'background-color',value:'transparent'})]}));
 }};
}
module.exports={comboboxChipInputCompat};
