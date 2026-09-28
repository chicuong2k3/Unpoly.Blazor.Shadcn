const test=require('node:test');
const assert=require('node:assert/strict');
const postcss=require('postcss');
const {fieldLabelChildCompat}=require('./postcss-field-label-child-compat.cjs');
const selector='.\\[\\&\\>\\*\\]\\:data-\\[slot\\=field\\]\\:p-4[data-slot="field"]>*';
test('moves nested FieldLabel padding modifier onto its direct child',async()=>{
 const css=await postcss([fieldLabelChildCompat()]).process(`${selector} { padding: 1rem; }`,{from:undefined});
 assert.match(css.css,/ > \*\[data-slot="field"\] \{ padding: 1rem/);
 assert.doesNotMatch(css.css,/\[data-slot="field"\]>\*/);
});
test('fails closed on missing or unexpected selector',async()=>{
 await assert.rejects(postcss([fieldLabelChildCompat()]).process('.other { padding:1rem; }',{from:undefined}),/exactly one/);
 await assert.rejects(postcss([fieldLabelChildCompat()]).process(`${selector} { padding: 2rem; }`,{from:undefined}),/Unexpected FieldLabel/);
});
