const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const postcss = require('postcss');
const { staticMixCompat, pinned } = require('./postcss-static-mix-compat.cjs');
const styles = path.resolve(__dirname, '../src/Unpoly.Blazor.Shadcn/Styles');
test('pins six authored dynamic/static focus and code-block mixes and retains modern branch', async () => {
  const source = ['ui.css', 'ui.behavior.css'].map(name => fs.readFileSync(path.join(styles, name), 'utf8')).join('\n');
  const result = (await postcss([staticMixCompat()]).process(source, { from: undefined })).root;
  for (const [modern, legacy] of pinned) {
    let seen = 0;
    result.walkDecls(decl => {
      if (decl.value !== modern) return;
      seen++;
      assert.equal(decl.prev().value, legacy);
      assert.equal(decl.prev().prop, decl.prop);
    });
    assert.equal(seen, 1, modern);
  }
  const compiled = postcss.parse(fs.readFileSync(path.resolve(__dirname, '../demo/Unpoly.Blazor.Shadcn.Demo/wwwroot/app.css'), 'utf8'));
  for (const [key, fallback] of pinned) {
    // The v4 PostCSS step already resolves four constant sRGB mixes to rgba;
    // dynamic ring mixes remain color-mix().
    const expected = key.includes('in srgb,') ? fallback : key;
    let count = 0;
    compiled.walkDecls(decl => { if (decl.value.replace(/\s+/g, ' ') === expected.replace(/\s+/g, ' ')) count++; });
    assert.ok(count >= 1, `v4 baseline lost ${expected}`);
  }
});
test('rejects missing or duplicate known mixes rather than silently losing fallback', async () => {
  await assert.rejects(postcss([staticMixCompat()]).process(':root { color: red }', { from: undefined }), /Static mix baseline changed/);
  const source = ['ui.css', 'ui.behavior.css'].map(name => fs.readFileSync(path.join(styles, name), 'utf8')).join('\n');
  await assert.rejects(postcss([staticMixCompat()]).process(source + '\n.ts-wrapper.focus .ts-control { box-shadow: 0 0 0 3px color-mix(in oklch, var(--ring) 50%, transparent) }', { from: undefined }), /Static mix baseline changed/);
});
