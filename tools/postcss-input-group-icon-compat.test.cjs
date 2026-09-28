const test = require('node:test');
const assert = require('node:assert/strict');
const postcss = require('postcss');
const { inputGroupIconCompat } = require('./postcss-input-group-icon-compat.cjs');
test('v3 compact input group icon overrides the shared Button icon without changing other sizes', async () => {
  const root = (await postcss([inputGroupIconCompat()]).process('.size-4{width:1rem;height:1rem}', {from:undefined})).root;
  const last = root.nodes.at(-1);
  assert.equal(last.selector, '[data-slot="input-group-button"][data-size="xs"] > svg:not([class*="size-"])');
  assert.deepEqual(last.nodes.map(x => [x.prop,x.value]), [['width','0.875rem'],['height','0.875rem']]);
});
