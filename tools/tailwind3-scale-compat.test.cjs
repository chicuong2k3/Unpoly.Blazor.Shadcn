const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const postcss = require('postcss');
const { theme, addVariants, addLogicalUtilities, fixChildLinkSelector, v4ChildLink } = require('./tailwind3-scale-compat.cjs');

test('Tailwind 3 probe has pinned v4 numeric values and border-state variants', () => {
  assert.deepEqual(theme, {
    spacing: { 18: '4.5rem', 30: '7.5rem' },
    brightness: { 60: '0.6' },
    transitionDuration: { 400: '400ms' },
    textUnderlineOffset: { 3: '3px' },
  });
  const variants = [];
  addVariants({ addVariant: (...args) => variants.push(args) });
  assert.deepEqual(variants, [
    ['[.border-b]', '&:is(.border-b)'],
    ['[.border-t]', '&:is(.border-t)'],
  ]);
  const utilities = [];
  addLogicalUtilities({ addUtilities: value => utilities.push(value) });
  assert.deepEqual(utilities, [{ '.inset-s-1\\/2': { 'inset-inline-start': '50%' } }]);
});

test('corrects child-link variant ordering while preserving the tracked v4 selector', async () => {
  const baseline = fs.readFileSync(path.join(__dirname, '../demo/Unpoly.Blazor.Shadcn.Demo/wwwroot/app.css'), 'utf8');
  assert.ok(baseline.includes(`${v4ChildLink} {`), 'v4 baseline selector changed');
  const broken = String.raw`:is(.\*\:\[a\]\:underline-offset-3:is(a) > *) { text-underline-offset: 3px }`;
  const fixed = (await postcss([fixChildLinkSelector()]).process(broken, { from: undefined })).css;
  assert.equal(postcss.parse(fixed).first.selector, v4ChildLink);
  assert.equal((await postcss([fixChildLinkSelector()]).process(fixed, { from: undefined })).css, fixed);
  await assert.rejects(postcss([fixChildLinkSelector()]).process(
    broken.replace('3px', '4px'), { from: undefined }), /Unexpected .*underline-offset-3 shape/);
});
