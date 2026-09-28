const test=require('node:test');
const assert=require('node:assert/strict');
const postcss=require('postcss');
const {docInlineLeadingCompat}=require('./postcss-doc-inline-leading-compat.cjs');
const source='.doc-lede { color: red } .doc-note { font-size: .875rem; line-height: 1.25rem } .text-sm {line-height:1.25rem}';
test('scopes proportional inline leading to demo documentation and retains library utilities',async()=>{
  const {css}=await postcss([docInlineLeadingCompat()]).process(source,{from:undefined});
  assert.match(css,/\.doc-lede \{ color: red; line-height: 1\.5 \}/);
  assert.match(css,/\.doc-note \{ font-size: \.875rem; line-height: calc\(1\.25 \/ 0\.875\) \}/);
  assert.match(css,/\.text-sm \{line-height:1\.25rem\}/);
});
test('fails closed if doc rules change or are absent',async()=>{
  for(const css of ['.doc-note {line-height:1.25rem}', '.doc-lede {} .doc-note {line-height:20px}', '.doc-lede {line-height:2} .doc-note {line-height:1.25rem}'])
    await assert.rejects(postcss([docInlineLeadingCompat()]).process(css,{from:undefined}),/Expected one|Unexpected/);
});
