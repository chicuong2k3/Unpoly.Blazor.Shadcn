const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const postcss = require('postcss');
const { bubbleSlotCompat } = require('./postcss-bubble-slot-compat.cjs');
test('fixes all 16 child Bubble data-slot selectors to match tracked v4 Web CSS', async () => {
  const css = postcss.parse(fs.readFileSync(path.resolve(__dirname, '../demo/Unpoly.Blazor.Shadcn.Demo/wwwroot/app.css'), 'utf8'));
  const wanted = [];
  css.walkRules(rule => {
    if (rule.selector.includes('bubble-content') && rule.selector.includes(' > *)[data-slot="bubble-content"]')) wanted.push(rule.selector);
  });
  assert.equal(wanted.length, 16);
  const wrong = wanted.map(selector => {
    const match = /^:is\((\.[^\s]+?)(:where\(\.dark, \.dark \*\))? > \*\)\[data-slot="bubble-content"\]$/.exec(selector);
    assert.ok(match, selector);
    return `:is(${match[1]}[data-slot="bubble-content"] > *)${match[2] ? ':is(.dark *)' : ''} { color: red }`;
  });
  const result = (await postcss([bubbleSlotCompat()]).process(wrong.join('\n'), { from: undefined })).root;
  assert.deepEqual(result.nodes.map(rule => rule.selector), wanted);
  await assert.rejects(postcss([bubbleSlotCompat()]).process('div { color: red }', { from: undefined }), /Expected 16/);
});
