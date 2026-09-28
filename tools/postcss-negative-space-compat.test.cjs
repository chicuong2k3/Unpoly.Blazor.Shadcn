const test=require('node:test');const assert=require('node:assert/strict');const postcss=require('postcss');
const {negativeSpaceCompat}=require('./postcss-negative-space-compat.cjs');
const css='.-space-x-2 > :not([hidden]) ~ :not([hidden]) {margin-left:-0.5rem;margin-right:0px}';
test('uses v4 preceding-child logical spacing',async()=>{
 const result=(await postcss([negativeSpaceCompat()]).process(css,{from:undefined})).css;
 assert.match(result,/:where\(\.\-space-x-2 > :not\(:last-child\)\)/);
 assert.match(result,/margin-inline-end:\s*-0\.5rem/);
 assert.doesNotMatch(result,/margin-left/);
});
test('fails closed if spacing selector changes',async()=>{
 await assert.rejects(postcss([negativeSpaceCompat()]).process(css.replace('~ :not([hidden])','> :not([hidden])'),{from:undefined}),/Unexpected negative spacing/);
});
