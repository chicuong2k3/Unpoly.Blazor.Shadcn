const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const postcss = require('postcss');
const selectorParser = require('postcss-selector-parser');
const { namedGroupCompat, selectorInfo, ordinary, combo, nested } = require('./postcss-named-group-compat.cjs');
const sourceClasses = [...ordinary.keys(), combo, nested];

test('nine named group selectors pin actual v4 CSS and retain only v3 declarations', async () => {
  const css = fs.readFileSync(path.join(__dirname, '../demo/Unpoly.Blazor.Shadcn.Demo/wwwroot/app.css'), 'utf8');
  const baseline = postcss.parse(css);
  const found = new Map();
  baseline.walkRules(rule => {
    if (!rule.selector.includes('group-')) return;
    selectorParser(selectors => selectors.walkClasses(node => {
      if (sourceClasses.includes(node.value)) {
        assert.ok(!found.has(node.value), `duplicate v4 rule: ${node.value}`);
        found.set(node.value, { selector: rule.selector, escaped: node.toString() });
      }
    })).processSync(rule.selector);
  });
  assert.equal(found.size, 9);
  for (const className of sourceClasses) {
    const { selector, escaped } = found.get(className);
    const { v3, v4, properties } = selectorInfo(className, escaped);
    assert.equal(v4, selector, className);
    const synthetic = `${v3} { ${properties.map(prop => `${prop}: ${prop === 'display' ? 'flex' : '1px'}`).join('; ')} }`;
    const result = (await postcss([namedGroupCompat()]).process(synthetic, { from: undefined })).css;
    assert.ok(result.startsWith(v4), className);
    assert.equal((await postcss([namedGroupCompat()]).process(result, { from: undefined })).css, result);
    await assert.rejects(postcss([namedGroupCompat()]).process(
      synthetic.replace(`${properties[0]}:`, 'unrelated-property:'), { from: undefined }), /Unexpected declarations/);
    await assert.rejects(postcss([namedGroupCompat()]).process(
      synthetic.replace(v3, `${v3}:hover`), { from: undefined }), /Unexpected named group selector/);
  }
});
