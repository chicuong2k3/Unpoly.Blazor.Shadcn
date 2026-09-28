const { test } = require('node:test');
const assert = require('node:assert/strict');
const postcss = require('postcss');
const { consumerAlphaCompat } = require('./postcss-consumer-alpha-compat.cjs');
const targets = [
  ['bg-primary/10', 'background-color', 'primary', '0.1'],
  ['border-positive/20', 'border-color', 'positive', '0.2'],
  ['border-positive/25', 'border-color', 'positive', '0.25'],
  ['border-positive/30', 'border-color', 'positive', '0.3'],
  ['border-warning/20', 'border-color', 'warning', '0.2'],
  ['border-warning/30', 'border-color', 'warning', '0.3'],
];
const input = targets.map(([name, prop, token, alpha]) =>
  `.${name.replace('/', '\\/')} { ${prop}: rgba(var(--${token}-rgb), calc(var(--${token}-alpha, 1) * ${alpha})); }`).join('\n');
test('consumer alpha bridge retains sRGB fallback and adds guarded OKLab rule', async () => {
  const result = await postcss([consumerAlphaCompat()]).process(input, { from: undefined });
  assert.equal((result.css.match(/@supports/g) || []).length, 6);
  assert.match(result.css, /color-mix\(in oklab, var\(--positive\) 25%, transparent\)/);
  assert.match(result.css, /rgba\(var\(--warning-rgb\), calc\(var\(--warning-alpha, 1\) \* 0\.3\)\)/);
});
test('unexpected alpha declaration fails closed', async () => {
  await assert.rejects(postcss([consumerAlphaCompat()]).process(input.replace(' * 0.25', ' * 0.5'), { from: undefined }), /Unexpected fallback/);
});
