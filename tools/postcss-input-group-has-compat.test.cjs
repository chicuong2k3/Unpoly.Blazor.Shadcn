const test = require('node:test');
const assert = require('node:assert/strict');
const postcss = require('postcss');
const { inputGroupHasCompat } = require('./postcss-input-group-has-compat.cjs');
const rule = align => `.has-\\[\\>\\[data-align\\=${align}\\]\\]\\:\\[\\&\\>input\\]\\:p-2>input:has(>[data-align=${align}]) { padding-left: 0.5rem; }`;
test('rewrites four input-group sibling-addon conditions onto the parent before :has fallback', async () => {
  const names=['inline-start','inline-end','block-start','block-end'];
  const result=(await postcss([inputGroupHasCompat()]).process(names.map(rule).join('\n'),{from:undefined})).css;
  for (const align of names) assert.match(result, new RegExp(`:has\\(>\\[data-align=${align}\\]\\)>input`));
  assert.doesNotMatch(result, />input:has/);
});
test('missing compound selectors fail the preview build', async () => {
  await assert.rejects(postcss([inputGroupHasCompat()]).process('.other{width:1px}',{from:undefined}),/Expected 4 input-group/);
});
