const test = require('node:test');
const assert = require('node:assert/strict');
const postcss = require('postcss');
const {childImgCompoundCompat}=require('./postcss-child-img-compound-compat.cjs');
test('moves [img] modifier onto the generated child for Attachment thumbnails',async()=>{
  const input=['aspect-square','w-full','object-cover'].map(x=>`:is(.\\*\\:\\[img\\]\\:${x}:is(img) > *){width:100%}`).join('\n');
  const out=(await postcss([childImgCompoundCompat()]).process(input,{from:undefined})).css;
  for(const x of ['aspect-square','w-full','object-cover']) assert.ok(out.includes(`:is(.\\*\\:\\[img\\]\\:${x} > *):is(img)`));
  assert.doesNotMatch(out, /:is\(img\) > \*/);
});
test('unknown child image variants fail closed',async()=>{
  await assert.rejects(postcss([childImgCompoundCompat()]).process('.foo{width:100%}',{from:undefined}),/Expected 3 child-img/);
});
