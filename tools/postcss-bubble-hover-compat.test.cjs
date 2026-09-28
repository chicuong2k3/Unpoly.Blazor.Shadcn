const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const postcss = require('postcss');
const { bubbleHoverCompat } = require('./postcss-bubble-hover-compat.cjs');
const palette = ':root { --foreground: #1d1d1f; --muted: #f5f5f7; --secondary: #e8e8ed }';
const rules = ['muted', 'secondary'].map(name => `.bubble-content { background-color: color-mix(in oklch,var(--${name}),var(--foreground) 5%) }`).join('\n');
test('pins both authored v4 Bubble hover mixes and derives Safari colors per complete palette', async () => {
  const baseline = postcss.parse(fs.readFileSync(path.resolve(__dirname, '../demo/Unpoly.Blazor.Shadcn.Demo/wwwroot/app.css'), 'utf8'));
  for (const name of ['muted', 'secondary']) {
    let found = 0;
    baseline.walkDecls('background-color', decl => { if (decl.value === `color-mix(in oklch,var(--${name}),var(--foreground) 5%)`) found++; });
    assert.equal(found, 1, name);
  }
  const result = (await postcss([bubbleHoverCompat()]).process(palette + rules, { from: undefined })).root;
  assert.match(result.nodes[0].toString(), /--bubble-muted-hover: rgb\(/);
  assert.match(result.nodes[0].toString(), /--bubble-secondary-hover: rgb\(/);
  for (const rule of result.nodes.slice(1)) assert.match(rule.nodes[0].value, /^var\(--bubble-(muted|secondary)-hover\)$/);
});
test('rejects partial palette, malformed or missing hover mix', async () => {
  for (const input of [palette, ':root { --muted: #eee }' + rules, palette.replace('#f5f5f7', 'var(--brand)') + rules]) {
    await assert.rejects(postcss([bubbleHoverCompat()]).process(input, { from: undefined }));
  }
});
