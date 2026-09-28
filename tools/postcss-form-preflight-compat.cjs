const postcss=require('postcss');
// Tailwind 3 preflight hard-codes gray placeholders and omits the spacing
// before a native file chooser label. Tailwind 4 uses currentcolor/50 and 4px.
function formPreflightCompat() {
 return {postcssPlugin:'shadcn-form-preflight-compat',OnceExit(root){
   let placeholder=0,file=0;
   root.walkRules(rule=>{
     if(rule.selector==='input::placeholder,\ntextarea::placeholder' && rule.nodes.some(n=>n.prop==='color'&&['#9ca3af','var(--color-gray-400)'].includes(n.value))) placeholder++;
     if(rule.selector==='::file-selector-button' && rule.nodes.some(n=>n.prop==='margin'&&n.value==='0')) file++;
   });
   if(placeholder!==1 || file!==1) throw Error(`Unexpected Tailwind 3 form preflight: placeholder ${placeholder}, file ${file}`);
   root.append(postcss.rule({selector:'input::placeholder, textarea::placeholder',nodes:[postcss.decl({prop:'color',value:'currentColor'}),postcss.decl({prop:'opacity',value:'0.5'})]}));
   root.append(postcss.atRule({name:'supports',params:'(color: color-mix(in oklab, red, transparent))',nodes:[postcss.rule({selector:'input::placeholder, textarea::placeholder',nodes:[postcss.decl({prop:'color',value:'color-mix(in oklab, currentcolor 50%, transparent)'}),postcss.decl({prop:'opacity',value:'1'})]})]}));
   root.append(postcss.rule({selector:'::file-selector-button',nodes:[postcss.decl({prop:'margin-inline-end',value:'4px'})]}));
 }};
}
module.exports={formPreflightCompat};
