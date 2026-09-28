const test=require('node:test');
const assert=require('node:assert/strict');
const postcss=require('postcss');
const {formPreflightCompat}=require('./postcss-form-preflight-compat.cjs');
const base='::file-selector-button { margin: 0; padding:0 }\ninput::placeholder,\ntextarea::placeholder { opacity:1; color:#9ca3af }';
test('restores Tailwind 4 file gap and translucent currentcolor placeholders',async()=>{
 const s=(await postcss([formPreflightCompat()]).process(base,{from:undefined})).css;
 assert.match(s,/margin-inline-end: 4px/);
 assert.match(s,/color-mix\(in oklab, currentcolor 50%, transparent\)/);
 assert.match(s,/opacity: 0.5/);
});
test('accepts pinned v4 named gray placeholder after palette mapping',async()=>{
 const s=(await postcss([formPreflightCompat()]).process(base.replace('#9ca3af','var(--color-gray-400)'),{from:undefined})).css;
 assert.match(s,/color: currentColor; opacity: 0.5/);
});
test('rejects changed upstream preflight',async()=>{
 await assert.rejects(postcss([formPreflightCompat()]).process(base.replace('#9ca3af','red'),{from:undefined}),/Unexpected Tailwind 3/);
});
