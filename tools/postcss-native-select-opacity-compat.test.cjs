const { test } = require('node:test');
const assert = require('node:assert/strict');
const postcss = require('postcss');
const { nativeSelectOpacityCompat } = require('./postcss-native-select-opacity-compat.cjs');
test('v3 preview corrects only library native disabled select opacity', async () => {
  const result = await postcss([nativeSelectOpacityCompat()]).process('.has-native:has(select:disabled) { opacity:.5 }', { from: undefined });
  assert.match(result.css, /select\[data-slot="native-select"\]:disabled \{\s*opacity:\s*1/);
  assert.doesNotMatch(result.css, /select:disabled\s*\{/);
  await assert.rejects(postcss([nativeSelectOpacityCompat()]).process('.something { display:block }', { from: undefined }), /baseline missing/);
});
