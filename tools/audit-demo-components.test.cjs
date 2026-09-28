const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { tags, audit } = require('./audit-demo-components.cjs');

test('counts only complete component opening tags, not prefixes or comments', () => {
  assert.deepEqual([...tags(`@* <Missing /> *@ <!-- <Absent/> --> <SelectItemIndicator /> <SelectItem\nClass="x" /> <Field/>`)].sort(),
    ['Field', 'SelectItem', 'SelectItemIndicator']);
});

test('reports both demo heads independently and does not mistake library composition for demo coverage', () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'shadcn-demo-inventory-'));
  try {
    for (const d of ['library', 'web', 'maui']) fs.mkdirSync(path.join(temp, d));
    fs.writeFileSync(path.join(temp, 'library', 'Outer.razor'), '<Inner/>');
    fs.writeFileSync(path.join(temp, 'library', 'Inner.razor'), '<div/>');
    fs.writeFileSync(path.join(temp, 'web', 'Example.razor'), '<Outer/>');
    fs.writeFileSync(path.join(temp, 'maui', 'Example.razor'), '<Inner/>');
    const result = audit(path.join(temp, 'library'), {
      web: path.join(temp, 'web'), maui: path.join(temp, 'maui'),
    });
    assert.deepEqual(result.web.missingDirect, ['Inner']);
    assert.deepEqual(result.web.composedOnly, [{ component: 'Inner', via: 'Outer' }]);
    assert.deepEqual(result.web.uncovered, []);
    assert.deepEqual(result.maui.uncovered, ['Outer']);
    assert.deepEqual(result.web.examples.Outer, ['Example.razor']);
  } finally { fs.rmSync(temp, { recursive: true, force: true }); }
});
