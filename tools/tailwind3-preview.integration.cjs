const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { preview } = require('./build-tailwind3-probe.cjs');
const { classes, compare } = require('./audit-css-classes.cjs');
const root = path.resolve(__dirname, '..');
const hash = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');

test('opt-in preview produces separate Web/MAUI CSS with every baseline class without touching v4', async () => {
  for (const [head, name] of [['web', 'Unpoly.Blazor.Shadcn.Demo'], ['maui', 'Unpoly.Blazor.Shadcn.Maui']]) {
    const base = path.join(root, 'demo', name, 'wwwroot');
    const v4 = path.join(base, 'app.css');
    const v3 = path.join(base, 'app.v3.css');
    const before = hash(v4);
    await preview(head);
    assert.equal(hash(v4), before, `${head} v4 must remain unchanged`);
    const result = compare(classes(fs.readFileSync(v4, 'utf8')), classes(fs.readFileSync(v3, 'utf8')));
    assert.deepEqual(result.missing, [], `${head}: ${result.missing.join(', ')}`);
    assert.notEqual(hash(v3), before, `${head} preview must not silently reuse v4`);
  }
  await assert.rejects(preview('unknown'), /head must be web or maui/);
});
