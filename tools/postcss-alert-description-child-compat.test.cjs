const test=require('node:test');const assert=require('node:assert/strict');const postcss=require('postcss');
const {alertDescriptionChildCompat}=require('./postcss-alert-description-child-compat.cjs');
const selector=':is(.\\*\\:data-\\[slot\\=alert-description\\]\\:text-destructive\\/90[data-slot="alert-description"] > *)';
test('targets the description child rather than the Alert parent',async()=>{
 const s=(await postcss([alertDescriptionChildCompat()]).process(`${selector} { color: red; }`,{from:undefined})).css;
 assert.match(s,/ > \*\[data-slot="alert-description"\]/);
 assert.doesNotMatch(s,/\[data-slot="alert-description"\] > \*/);
});
test('rejects missing generated selector',async()=>{
 await assert.rejects(postcss([alertDescriptionChildCompat()]).process('.other{color:red}',{from:undefined}),/Expected one/);
});
