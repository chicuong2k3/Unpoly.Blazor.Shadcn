const test = require('node:test');
const assert = require('node:assert/strict');
const postcss = require('postcss');
const { spacingFunctionCompat } = require('./postcss-spacing-function-compat.cjs');
test('v4 spacing functions compile in v3 arbitrary values without touching selectors', async () => {
  const source = '.\\[--cell-size\\:--spacing\\(9\\)\\]{--cell-size:var(--spacing(9));height:calc(--spacing(96) - --spacing(9));gap:--spacing(5.5);padding:--spacing(var(--gap))}';
  const css = (await postcss([spacingFunctionCompat()]).process(source, { from: undefined })).css;
  assert.match(css, /^\.\\\[--cell-size/);
  assert.match(css, /--cell-size:calc\(var\(--spacing\) \* 9\)/);
  assert.match(css, /height:calc\(calc\(var\(--spacing\) \* 96\) - calc\(var\(--spacing\) \* 9\)\)/);
  assert.match(css, /gap:calc\(var\(--spacing\) \* 5\.5\)/);
  assert.match(css, /padding:calc\(var\(--spacing\) \* var\(--gap\)\)/);
});
test('unknown spacing argument fails closed instead of shipping invalid CSS', async () => {
  await assert.rejects(postcss([spacingFunctionCompat()]).process('a{width:--spacing(foo)}', {from:undefined}), /Unsupported Tailwind v4 spacing/);
});
