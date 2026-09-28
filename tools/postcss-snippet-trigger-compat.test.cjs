const test = require('node:test');
const assert = require('node:assert/strict');
const postcss = require('postcss');
const {snippetTriggerCompat}=require('./postcss-snippet-trigger-compat.cjs');
test('Snippet trigger follows the same runtime control-text utility as v4',async()=>{
  const css='[data-slot="snippet"] > [data-slot="tabs"] { gap: 0 } [data-slot="snippet"] [data-slot="tabs-trigger"] { flex: none; font-size: 0.75rem; gap: 0.375rem }';
  const result=(await postcss([snippetTriggerCompat()]).process(css,{from:undefined})).css;
  assert.match(result,/font-size: var\(--control-text\)/);
  assert.match(result,/gap: calc\(var\(--spacing\) \* 2\)/);
  assert.match(result,/gap: 0.375rem/);
});
test('missing or changed Snippet trigger fails closed',async()=>{
  for(const css of ['.other{color:red}','[data-slot="snippet"] > [data-slot="tabs"]{gap:0}[data-slot="snippet"] [data-slot="tabs-trigger"]{font-size: 1rem}'])
    await assert.rejects(postcss([snippetTriggerCompat()]).process(css,{from:undefined}),/Expected one Snippet|Unexpected Snippet/);
});
