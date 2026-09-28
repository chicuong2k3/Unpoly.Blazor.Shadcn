const { test } = require('node:test');
const assert = require('node:assert/strict');
const postcss = require('postcss');
const { primaryHoverMixCompat } = require('./postcss-primary-hover-mix-compat.cjs');
const classes = ['.hover\\:bg-primary\\/90:hover', 'a.\\[a\\&\\]\\:hover\\:bg-primary\\/90:hover'];
const fallback = 'rgba(var(--primary-rgb), calc(var(--primary-alpha, 1) * 0.9))';
const fixture = () => classes.map(name => `${name} { background-color: ${fallback}; }`).join('\n');

test('adds a modern OKLab mix next to each Safari-compatible primary-hover fallback', async () => {
  const output = (await postcss([primaryHoverMixCompat()]).process(fixture(), { from: undefined })).root;
  for (const selector of classes) {
    const fallbackRule = output.nodes.find(n => n.type === 'rule' && n.selector === selector);
    assert.equal(fallbackRule.nodes[0].value, fallback);
    const modern = fallbackRule.next();
    assert.equal(modern.name, 'supports');
    assert.equal(modern.nodes[0].selector, selector);
    assert.equal(modern.nodes[0].nodes[0].value, 'color-mix(in oklab, var(--primary) 90%, transparent)');
  }
});
test('fails closed on missing, duplicate or changed preview rules', async () => {
  const run = text => postcss([primaryHoverMixCompat()]).process(text, { from: undefined });
  await assert.rejects(run(classes[0] + ` { background-color: ${fallback} }`), /Expected one primary hover rule/);
  await assert.rejects(run(fixture() + fixture()), /Expected one primary hover rule/);
  await assert.rejects(run(fixture().replace(fallback, 'red')), /Unexpected primary hover rule/);
});
