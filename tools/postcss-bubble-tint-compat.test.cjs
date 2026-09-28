const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const postcss = require('postcss');
const { bubbleTintCompat, variants } = require('./postcss-bubble-tint-compat.cjs');
const rules = [...variants].map(([expression]) => `.bubble-content { background-color: oklch(from var(--primary) ${expression} h) }`).join('\n');
test('pins four v4 Bubble relative colors and calculates exact per-theme Safari channels', async () => {
  const baseline = postcss.parse(fs.readFileSync(path.resolve(__dirname, '../demo/Unpoly.Blazor.Shadcn.Demo/wwwroot/app.css'), 'utf8'));
  for (const expression of variants.keys()) {
    let found = 0;
    baseline.walkDecls('background-color', decl => { if (decl.value === `oklch(from var(--primary) ${expression} h)`) found++; });
    assert.equal(found, 1, expression);
  }
  const source = `:root { --primary: oklch(0.205 0 0) } [data-theme="apple"] { --primary: #0071e3 } ${rules}`;
  const result = (await postcss([bubbleTintCompat()]).process(source, { from: undefined })).root;
  const apple = result.nodes.find(node => node.selector === '[data-theme="apple"]');
  assert.equal(apple.nodes.find(decl => decl.prop === '--bubble-tint-light').value, 'rgb(199, 235, 255)');
  let count = 0;
  result.walkDecls('background-color', decl => { if (!decl.value.includes('oklch(from')) return; count++; assert.match(decl.prev().value, /^var\(--bubble-tint-/); });
  assert.equal(count, 4);
});
test('fails closed on missing variants, dynamic palette and alpha', async () => {
  for (const input of [':root { --primary: #0071e3 }', `:root { --primary: var(--brand) } ${rules}`, `:root { --primary: rgb(0 0 0 / 30%) } ${rules}`]) {
    await assert.rejects(postcss([bubbleTintCompat()]).process(input, { from: undefined }));
  }
});
