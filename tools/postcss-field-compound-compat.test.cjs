const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const postcss = require('postcss');
const selectorParser = require('postcss-selector-parser');
const { fieldCompoundCompat, className, selector, branches, matchingRules,
  horizontalClassName, horizontalSelector, horizontalBranches } = require('./postcss-field-compound-compat.cjs');

const baselineFile = path.join(__dirname, '../demo/Unpoly.Blazor.Shadcn.Demo/wwwroot/app.css');
test('bridge exactly preserves the v4 selector, both branches, and margin declaration', () => {
  const baseline = postcss.parse(fs.readFileSync(baselineFile, 'utf8'));
  const [v4] = matchingRules(baseline);
  assert.ok(v4, 'v4 baseline class missing');
  assert.equal(v4.selector, selector);
  assert.equal(v4.nodes.length, 1);
  assert.equal(v4.nodes[0].prop, 'margin-top');
  assert.equal(v4.nodes[0].value, '1px');
  const result = postcss([fieldCompoundCompat()]).process('.unrelated { display: block }', { from: undefined });
  const rules = matchingRules(result.root);
  assert.equal(rules.length, 2);
  assert.equal(rules[0].parent.params, 'field-group (min-width: 28rem)');
  assert.equal(rules.map(rule => rule.selector).join(', '), v4.selector);
  assert.deepEqual(rules.map(rule => rule.selector), branches);
  for (const rule of rules) {
    selectorParser(selectors => selectors.walkClasses(node => assert.equal(node.value, className))).processSync(rule.selector);
  }
  assert.match(branches[0], /> \[role=checkbox\]$/);
  assert.match(branches[1], /\[role=radio\]$/);
  assert.ok(!branches[1].endsWith('> [role=radio]'), 'v4 radio rule uses a descendant');
  const [horizontalV4] = matchingRules(baseline, horizontalClassName);
  assert.ok(horizontalV4, 'v4 horizontal class missing');
  assert.equal(horizontalV4.selector, horizontalSelector);
  assert.equal(horizontalV4.nodes.length, 1);
  assert.equal(horizontalV4.nodes[0].prop, 'margin-top');
  assert.equal(horizontalV4.nodes[0].value, '1px');
  const horizontalRules = matchingRules(result.root, horizontalClassName);
  assert.equal(horizontalRules.length, 2);
  assert.ok(horizontalRules.every(rule => rule.parent.type === 'root'));
  assert.deepEqual(horizontalRules.map(rule => rule.selector), horizontalBranches);
  assert.equal(horizontalRules.map(rule => rule.selector).join(', '), horizontalV4.selector);
});

test('does not duplicate or silently override an existing rule', async () => {
  const initial = (await postcss([fieldCompoundCompat()]).process('', { from: undefined })).css;
  const second = (await postcss([fieldCompoundCompat()]).process(initial, { from: undefined })).root;
  assert.equal(matchingRules(second).length, 2);
  assert.equal(matchingRules(second, horizontalClassName).length, 2);
  const wrong = initial.replace('margin-top: 1px', 'margin-top: 2px');
  await assert.rejects(postcss([fieldCompoundCompat()]).process(wrong, { from: undefined }), /Unexpected existing/);
  const changed = postcss.parse(initial);
  matchingRules(changed, horizontalClassName)[0].nodes[0].value = '2px';
  await assert.rejects(postcss([fieldCompoundCompat()]).process(changed.toString(), { from: undefined }), /Unexpected existing/);
});
