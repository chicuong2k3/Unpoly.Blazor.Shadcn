const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { classes, compare } = require('./audit-css-classes.cjs');

test('decodes escaped utility, arbitrary, named group and descendant classes', () => {
  const result = classes(String.raw`@layer utilities {
    .group-has-data-\[size\=lg\]\/avatar-group\:size-10:is(.group\/avatar-group:has([data-size="lg"]) *) { width: 2.5rem; }
    :is(.\*\:data-\[slot\=attachment\]\:flex-none > *)[data-slot="attachment"] { flex: none; }
    .bg-primary\/90 { background: red; }
  }`);
  assert.deepEqual([...result].sort(), [
    '*:data-[slot=attachment]:flex-none', 'bg-primary/90',
    'group-has-data-[size=lg]/avatar-group:size-10', 'group/avatar-group',
  ].sort());
});

test('MAUI baseline includes static WebView host classes outside Razor content', () => {
  const root = path.join(__dirname, '../demo/Unpoly.Blazor.Shadcn.Maui/wwwroot');
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const baseline = classes(fs.readFileSync(path.join(root, 'app.css'), 'utf8'));
  for (const utility of ['left-0', 'text-destructive-foreground']) {
    assert.ok(html.includes(utility), utility);
    assert.ok(baseline.has(utility), `MAUI v4 baseline lacks ${utility}`);
  }
});

test('reports missing classes independently of changed selector structure', () => {
  const result = compare(classes('.dark .bg-primary { color: red } .removed { color: red }'),
    classes('.bg-primary:is(.dark *) { color: red } .added { color: red }'));
  assert.deepEqual(result.missing, ['removed']);
  assert.deepEqual(result.added, ['added']);
});
