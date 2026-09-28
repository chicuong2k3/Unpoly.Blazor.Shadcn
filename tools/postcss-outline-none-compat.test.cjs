const test = require('node:test');
const assert = require('node:assert/strict');
const postcss = require('postcss');
const { outlineNoneCompat } = require('./postcss-outline-none-compat.cjs');
test('v3 outline-none becomes v4 no-outline-style without touching other rules', async () => {
  const source = '.outline-none { outline: 2px solid transparent; outline-offset: 2px } .outline-hidden { outline-style: none }';
  const result = await postcss([outlineNoneCompat()]).process(source, { from: undefined });
  assert.match(result.css, /\.outline-none\s*\{\s*outline-style:\s*none/);
  assert.doesNotMatch(result.css, /outline-offset/);
  assert.match(result.css, /\.outline-hidden\s*\{\s*outline-style:\s*none/);
});
test('unknown outline-none shape fails closed', async () => {
  await assert.rejects(postcss([outlineNoneCompat()]).process('.outline-none { outline: 0 }', { from: undefined }), /shape changed/);
  await assert.rejects(postcss([outlineNoneCompat()]).process('.outline-none { outline: 2px solid transparent; outline-offset: 2px } .outline-none { outline: 2px solid transparent; outline-offset: 2px }', { from: undefined }), /shape changed/);
});
