const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const postcss = require('postcss');
const { slotRules } = require('./audit-component-css.cjs');

const root = path.resolve(__dirname, '..');
const dir = path.join(root, 'demo/Unpoly.Blazor.Shadcn.Maui');

test('MAUI v4 CSS pipeline preserves layered focus ring and behavior slots', () => {
  const script = require(path.join(dir, 'package.json')).scripts.css;
  assert.doesNotMatch(script, /--minify\b/, 'Tailwind 4 minifier hoists ring fallback outside utilities layer');
  const css = postcss.parse(fs.readFileSync(path.join(dir, 'wwwroot/app.css'), 'utf8'));
  const ring = [];
  css.walkDecls('--tw-ring-color', decl => {
    let rule = decl.parent;
    while (rule && rule.type !== 'rule') rule = rule.parent;
    const selector = rule?.selector || '';
    if (selector.startsWith('.focus-visible') && selector.includes('ring-ring') && selector.includes('/50')) {
      let ancestor = rule;
      while (ancestor && !(ancestor.type === 'atrule' && ancestor.name === 'layer')) ancestor = ancestor.parent;
      ring.push({ value: decl.value, layer: ancestor?.params });
    }
  });
  assert.ok(ring.some(x => x.value === 'var(--ring)' && x.layer === 'utilities'), 'layered fallback missing');
  assert.ok(ring.some(x => x.value.includes('color-mix(') && x.layer === 'utilities'), 'layered 50% ring missing');
  assert.ok(ring.every(x => x.layer === 'utilities'), 'unlayered fallback overrides the 50% focus ring');
  for (const slot of ['resizable-panel', 'select-item', 'snippet'])
    assert.ok(slotRules(css, slot).length, `missing v4 behavior slot: ${slot}`);
});
