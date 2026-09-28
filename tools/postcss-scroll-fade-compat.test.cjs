const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const postcss = require('postcss');
const { scrollFadeCompat } = require('./postcss-scroll-fade-compat.cjs');
const source = path.join(__dirname, '../src/Unpoly.Blazor.Shadcn/Styles/ui.css');

test('flattens only the two pinned scroll-fade fallback branches without losing declarations', () => {
  const css = postcss.parse(fs.readFileSync(source, 'utf8'));
  const input = postcss.root();
  for (const suffix of ['b', 'x']) {
    const utility = css.nodes.find(node => node.type === 'atrule' && node.name === 'utility' && node.params === `scroll-fade-${suffix}`);
    assert.ok(utility);
    const rule = postcss.rule({ selector: `.scroll-fade-${suffix}` });
    for (const node of utility.nodes) rule.append(node.clone());
    input.append(rule);
  }
  const result = postcss([scrollFadeCompat()]).process(input, { from: undefined }).root;
  for (const suffix of ['b', 'x']) {
    const selector = `.scroll-fade-${suffix}`;
    const rule = result.nodes.find(node => node.type === 'rule' && node.selector === selector);
    assert.ok(rule.nodes.every(node => node.type === 'decl'), `flat ${selector}`);
    const fallback = result.nodes.find(node => node.name === 'supports' && node.params === 'not (animation-timeline: scroll())' && node.nodes[0].selector === selector);
    assert.ok(fallback);
    assert.deepEqual(fallback.nodes[0].nodes.map(node => node.prop), suffix === 'b' ? ['--scroll-fade-b'] : ['--scroll-fade-s', '--scroll-fade-e']);
  }
  const rtl = result.nodes.find(node => node.type === 'rule' && node.selector === '.scroll-fade-x:where([dir="rtl"], [dir="rtl"] *)');
  assert.equal(rtl.nodes[0].prop, '--scroll-fade-inline');
});

test('rejects changed fallback structure instead of silently shipping nonfunctional Safari CSS', async () => {
  await assert.rejects(postcss([scrollFadeCompat()]).process('.scroll-fade-b { mask-image: none } .scroll-fade-x { mask-image: none }', { from: undefined }), /Unexpected/);
});
