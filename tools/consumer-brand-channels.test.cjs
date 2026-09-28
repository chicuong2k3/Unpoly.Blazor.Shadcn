const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { brandChannels } = require('./consumer-brand-channels.cjs');
test('brand alias resolves to the terracotta RGB channel and retains original palette', () => {
  const file = path.resolve(__dirname, '../../../src/Pos.App/wwwroot/brand.css');
  const original = fs.readFileSync(file, 'utf8');
  const result = brandChannels(original);
  assert.ok(result.overrides.includes('primary'));
  assert.match(result.css, /--primary-rgb:\s*151, 72, 23/);
  assert.match(result.css, /--primary: var\(--terracotta-700\)/);
  assert.ok(result.overrides.length > 25);
});
test('unknown and cyclic brand aliases fail closed', () => {
  assert.throws(() => brandChannels(':root { --primary: var(--missing); }'), /Unknown brand token/);
  assert.throws(() => brandChannels(':root { --primary: var(--other); --other: var(--primary); }'), /Cyclic brand token/);
});
