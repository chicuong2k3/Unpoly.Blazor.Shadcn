const { test } = require('node:test');
const assert = require('node:assert/strict');
const postcss = require('postcss');
const { consumerCurrentCascadeCompat } = require('./postcss-consumer-current-cascade-compat.cjs');
const input = Array.from({ length: 7 }, (_, i) => `.c${i}.up-current{color:red}`).join('\n');
test('moves current utilities into lower-precedence layer, leaving later site CSS unlayered', async () => {
  const result = await postcss([consumerCurrentCascadeCompat()]).process(`${input}\n.portal-navigation a{color:blue}`, { from: undefined });
  assert.match(result.css, /@layer utilities/);
  assert.equal((result.css.match(/\.up-current/g) || []).length, 7);
  assert.match(result.css, /}\s*\.portal-navigation a\{color:blue\}/);
});
test('changed selector inventory fails closed', async () => {
  await assert.rejects(postcss([consumerCurrentCascadeCompat()]).process(input.replace('.c0.up-current', '.c0'), { from: undefined }), /Expected seven/);
});
