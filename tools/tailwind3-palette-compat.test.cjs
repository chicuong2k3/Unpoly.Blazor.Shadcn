const {test}=require('node:test');
const assert=require('node:assert/strict');
const path=require('node:path');
const postcss=require('postcss');
const {paletteFromTheme,paletteRoot,paletteAlphaFallback}=require('./tailwind3-palette-compat.cjs');
const demo=path.resolve(__dirname,'../demo/Unpoly.Blazor.Shadcn.Demo');
test('maps pinned v4 named palette to runtime variables and alpha mixes',()=>{
 const {palette,colors}=paletteFromTheme(demo);
 assert.ok(palette.size>200);
 assert.equal(colors.amber[500]({}),'var(--color-amber-500)');
 assert.equal(colors.amber[500]({opacityValue:'var(--tw-bg-opacity, 1)'}),'var(--color-amber-500)');
 assert.equal(colors.amber[950]({opacityValue:'0.4'}),'color-mix(in oklab, var(--color-amber-950) 40%, transparent)');
 assert.equal(colors.emerald[500]({}),'var(--color-emerald-500)');
 assert.throws(()=>colors.amber[500]({opacityValue:'evil'}),/Unexpected/);
});
test('emits Safari sRGB variables before guarded modern OKLCH without duplicate tokens',async()=>{
 const {palette}=paletteFromTheme(demo);
 const css=(await postcss([paletteRoot(palette)]).process('.x{color:red}',{from:undefined})).css;
 const root=postcss.parse(css);
 const fallback=root.nodes.find(n=>n.type==='rule'&&n.selector===':root');
 const guarded=root.nodes.find(n=>n.type==='atrule'&&n.name==='supports');
 assert.equal(fallback.nodes.find(n=>n.prop==='--color-amber-500').value,'rgb(254, 154, 0)');
 assert.equal(guarded.params,'(color: oklch(0 0 0))');
 assert.equal(guarded.first.nodes.find(n=>n.prop==='--color-amber-500').value,'oklch(76.9% 0.188 70.08)');
 await assert.rejects(()=>postcss([paletteRoot(palette)]).process(':root{--color-amber-500:red}',{from:undefined}),/already declared/);
});
test('inserts Safari alpha fallback before the modern palette mix',async()=>{
 const {palette}=paletteFromTheme(demo);
 const result=await postcss([paletteAlphaFallback(palette)]).process('.x{background-color:color-mix(in oklab, var(--color-amber-950) 40%, transparent)}',{from:undefined});
 assert.match(result.css,/background-color:rgba\(70, 25, 1, 0\.4\);background-color:color-mix/);
 assert.rejects(()=>postcss([paletteAlphaFallback(palette)]).process('.x{color:color-mix(in oklab, var(--color-nope-500) 40%, transparent)}',{from:undefined}),/Unknown palette/);
});
