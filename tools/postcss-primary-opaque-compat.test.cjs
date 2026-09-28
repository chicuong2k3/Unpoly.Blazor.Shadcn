const { test } = require('node:test');
const assert = require('node:assert/strict');
const postcss = require('postcss');
const { primaryOpaqueCompat } = require('./postcss-primary-opaque-compat.cjs');
const fallback = 'rgba(var(--primary-rgb), calc(var(--primary-alpha, 1) * var(--tw-bg-opacity, 1)))';
const source = `.bg-primary { --tw-bg-opacity: 1; background-color: ${fallback}; } .text-primary { --tw-text-opacity: 1; color: rgba(var(--primary-rgb), calc(var(--primary-alpha, 1) * var(--tw-text-opacity, 1))); } .border-primary\\/40 { border-color: rgba(var(--primary-rgb), calc(var(--primary-alpha, 1) * 0.4)); }`;

test('preserves opaque primary fallback and appends guarded authored color', async () => {
  const css = (await postcss([primaryOpaqueCompat()]).process(source, { from:undefined })).css;
  assert.match(css, /\.bg-primary \{ --tw-bg-opacity: 1; background-color: rgba\(/);
  assert.match(css, /@supports \(color: oklch\(50% 0\.1 180\)\) \{\s*\.bg-primary \{\s*background-color: var\(--primary\)/);
  assert.match(css, /\.text-primary \{\s*color: var\(--primary\)/);
  assert.match(css, /\.border-primary\\\/40 \{\s*border-color: color-mix\(in oklab, var\(--primary\) 40%, transparent\)/);
});

test('rejects missing, duplicate and changed rules', async () => {
  for (const input of ['', source + source, source.replace(fallback, 'red'), source.replace('0.4));', '0.3));'), source.replace('--tw-text-opacity: 1;', '--tw-text-opacity: 0.5;')])
    await assert.rejects(postcss([primaryOpaqueCompat()]).process(input, { from:undefined }));
});
