const {test}=require('node:test');
const assert=require('node:assert/strict');
const postcss=require('postcss');
const {selectBackgroundCompat}=require('./postcss-select-background-compat.cjs');
test('preview resets library no-JS Select background and disabled opacity, not native selects or options',async()=>{
  const css='[data-slot="select"]{color:inherit} option{background:white}';
  const result=(await postcss([selectBackgroundCompat()]).process(css,{from:undefined})).css;
  assert.match(result,/select\[data-slot="select"\]\s*\{\s*background-color:\s*transparent/);
  assert.match(result,/option\{background:white\}/);
  assert.equal((result.match(/background-color:\s*transparent/g)||[]).length,1);
  assert.match(result,/select\[data-slot="select"\]:disabled\s*\{\s*opacity:\s*1/);
  assert.equal((result.match(/opacity:\s*1/g)||[]).length,1);
});
test('preview fails when Select slot is absent',async()=>{
  await assert.rejects(postcss([selectBackgroundCompat()]).process('select{color:inherit}',{from:undefined}),/Expected library Select slot/);
});
