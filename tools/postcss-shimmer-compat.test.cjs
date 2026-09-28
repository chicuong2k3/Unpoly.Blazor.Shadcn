const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const postcss = require('postcss');
const { shimmerCompat, variants } = require('./postcss-shimmer-compat.cjs');
const v4 = path.join(__dirname, '../demo/Unpoly.Blazor.Shadcn.Demo/wwwroot/app.css');
const ui = path.join(__dirname, '../src/Unpoly.Blazor.Shadcn/Styles/ui.css');
function v3Fixture() {
  const source = postcss.parse(fs.readFileSync(ui, 'utf8'));
  const [utility] = source.nodes.filter(node => node.type === 'atrule' && node.name === 'utility' && node.params === 'shimmer');
  assert.ok(utility);
  const rule = postcss.rule({ selector: '.shimmer' });
  for (const node of utility.nodes) {
    if (node.type !== 'atrule' || node.name !== 'variant') rule.append(node.clone());
  }
  return `${rule.toString()}\n.flex { display: flex }`;
}

test('shimmer pins two v4 named-state selectors and Safari-compatible branch structure', () => {
  const baseline = postcss.parse(fs.readFileSync(v4, 'utf8'));
  for (const selector of variants) {
    const rules = [];
    baseline.walkRules(rule => { if (rule.selector === selector) rules.push(rule); });
    assert.equal(rules.length, 1, selector);
    assert.equal(rules[0].nodes.find(node => node.prop === 'animation').value.split(' ')[0], 'tw-shimmer');
  }
  // Reproduce the v3 directive converter from the tracked source; the
  // opt-in browser test also applies the bridge to the actual temp CSS.
  const result = postcss([shimmerCompat()]).process(v3Fixture(), { from: undefined }).root;
  const base = result.nodes.find(node => node.type === 'rule' && node.selector?.startsWith('.shimmer, '));
  assert.ok(base);
  assert.equal(base.nodes.filter(node => node.type !== 'decl').length, 0, 'no nested CSS for Safari 15');
  assert.ok(result.index(base) < result.nodes.findIndex(node => node.type === 'rule' && node.selector === '.flex'));
  assert.ok(result.nodes.some(node => node.type === 'atrule' && node.name === 'supports' && node.params.includes('not (color: color-mix')));
  assert.ok(result.nodes.some(node => node.type === 'atrule' && node.name === 'media' && node.params === '(prefers-reduced-motion: reduce)' && node.nodes.some(rule => rule.selector?.includes(variants[0]))));
  for (const selector of variants) assert.ok(base.selector.includes(selector));
});

test('rejects unexpected shimmer declarations rather than reporting false parity', async () => {
  const css = v3Fixture();
  await assert.rejects(postcss([shimmerCompat()]).process(css.replace('animation: tw-shimmer var(--shimmer-duration, 2s)', 'animation: none'), { from: undefined }), /Unexpected shimmer/);
});
