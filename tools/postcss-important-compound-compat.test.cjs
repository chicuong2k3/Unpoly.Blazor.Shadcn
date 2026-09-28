const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const postcss = require('postcss');
const { importantCompoundCompat, rules } = require('./postcss-important-compound-compat.cjs');

test('two generated compound-importance selectors are pinned to their v4 baseline', async () => {
  const css = fs.readFileSync(path.join(__dirname, '../demo/Unpoly.Blazor.Shadcn.Demo/wwwroot/app.css'), 'utf8');
  const baseline = postcss.parse(css);
  for (const target of rules) {
    const matches = [];
    baseline.walkRules(rule => { if (rule.selector === target.v4) matches.push(rule); });
    assert.equal(matches.length, 1, target.className);
    assert.deepEqual(matches[0].nodes.filter(node => node.type === 'decl').map(node => node.prop),
      target.className.includes('text-destructive') ? ['color'] : ['width', 'height']);
    const synthetic = `${target.v3} { ${target.properties.map(prop => `${prop}: ${prop === 'color' ? 'red' : '24px'} !important`).join('; ')} }`;
    const transformed = (await postcss([importantCompoundCompat()]).process(synthetic, { from: undefined })).css;
    assert.ok(transformed.startsWith(target.v4), target.className);
    assert.equal((await postcss([importantCompoundCompat()]).process(transformed, { from: undefined })).css,
      transformed, 'repeatable transform');
    await assert.rejects(postcss([importantCompoundCompat()]).process(
      synthetic.replace('!important', ''), { from: undefined }), /Unexpected declarations/);
    await assert.rejects(postcss([importantCompoundCompat()]).process(
      synthetic.replace(target.v3, `${target.v3}:hover`), { from: undefined }), /Unexpected selector/);
  }
});
