const test = require('node:test');
const assert = require('node:assert/strict');
const postcss = require('postcss');
const { preflightSpacingCompat } = require('./postcss-preflight-spacing-compat.cjs');
test('v3 preview resets UA margin/padding like v4 before explicit utilities', async () => {
  const result = await postcss([preflightSpacingCompat()]).process('th.pb-2{padding-bottom:8px}', {from:undefined});
  assert.match(result.css, /^\*, ::before, ::after\s*\{\s*margin:\s*0;\s*padding:\s*0/);
  assert.match(result.css, /::file-selector-button\s*\{\s*margin:\s*0;\s*padding:\s*0/);
  assert.match(result.css, /th\.pb-2\{padding-bottom:8px\}$/);
});
