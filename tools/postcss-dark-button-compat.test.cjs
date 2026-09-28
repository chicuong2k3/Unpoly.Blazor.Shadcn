const test = require('node:test');
const assert = require('node:assert/strict');
const postcss = require('postcss');
const { darkButtonCompat } = require('./postcss-dark-button-compat.cjs');
const selector = '.dark\\:bg-destructive\\/60:is(.dark *)';
const rule = `${selector} { background-color: rgba(var(--destructive-rgb), calc(var(--destructive-alpha, 1) * 0.6)) }`;
const border = '.dark\\:border-input:is(.dark *) { --tw-border-opacity: 1; border-color: rgba(var(--input-rgb), calc(var(--input-alpha, 1) * var(--tw-border-opacity, 1))) }';
test('dark destructive base no longer outranks hover while preserving its declaration', async () => {
  const result = await postcss([darkButtonCompat()]).process(rule + border + '.hover\\:bg-destructive\\/90:hover { color: red }', { from: undefined });
  assert.match(result.css, /:where\(\.dark, \.dark \*\)/);
  assert.match(result.css, /--destructive-alpha, 1\) \* 0\.6/);
  assert.match(result.css, /\.hover\\:bg-destructive/);
  assert.match(result.css, /\.dark\\:border-input:where\(\.dark, \.dark \*\)/);
});
test('unexpected selector, missing or duplicate rules fail closed', async () => {
  for (const css of ['', rule + border + rule, rule.replace('0.6', '0.5') + border,
    rule.replace(':is(.dark *)', ':where(.dark, .dark *)') + border, rule + border.replace('--tw-border-opacity: 1', '--tw-border-opacity: 0.5')])
    await assert.rejects(postcss([darkButtonCompat()]).process(css, { from: undefined }), /review v4\/v3 cascade before rewriting/);
});
