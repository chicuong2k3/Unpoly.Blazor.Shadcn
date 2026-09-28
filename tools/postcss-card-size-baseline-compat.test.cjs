const test=require('node:test');const assert=require('node:assert/strict');const postcss=require('postcss');
const {cardSizeBaselineCompat}=require('./postcss-card-size-baseline-compat.cjs');
const general=':where([data-slot="card"]) { --card-spacing: calc(var(--spacing) * 6); }';
const small=':where([data-slot="card"][data-size="sm"]) { --card-spacing: calc(var(--spacing) * 4); }';
test('matches v4 baseline Card token order, without changing values',async()=>{
 const output=(await postcss([cardSizeBaselineCompat()]).process(general+'\n'+small,{from:undefined})).css;
 assert.ok(output.indexOf(small)<output.indexOf(general));
});
test('fails closed for unexpected token size',async()=>{
 await assert.rejects(postcss([cardSizeBaselineCompat()]).process(general.replace(' * 6',' * 8')+'\n'+small,{from:undefined}),/Unexpected Card/);
});
