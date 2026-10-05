const test = require('node:test'), assert = require('node:assert/strict'), postcss = require('postcss');
const { stackedVariantCompat } = require('./postcss-stacked-variant-compat.cjs');
const run = async css => (await postcss([stackedVariantCompat()]).process(css, { from: undefined })).css;

test('binds the attribute to the element the class is on, not to the descendant', async () => {
  const s = await run('.data-\\[direction\\=start\\]\\:\\[\\&_svg\\]\\:rotate-180 svg[data-direction="start"] { --tw-rotate: 180deg }');
  assert.match(s, /rotate-180\[data-direction="start"\] svg \{/);
});

test('keeps a child combinator that has no surrounding space', async () => {
  const s = await run('.data-\\[orientation\\=vertical\\]\\:\\[\\&\\>img-comparison-slider\\]\\:h-\\[400px\\]>img-comparison-slider[data-orientation="vertical"] { height: 400px }');
  assert.match(s, /h-\\\[400px\\\]\[data-orientation="vertical"\]>img-comparison-slider \{/);
});

test('leaves a leading variant suffix such as rtl in place', async () => {
  const s = await run('.rtl\\:data-\\[orientation\\=horizontal\\]\\:\\[\\&_svg\\]\\:rotate-180 svg[data-orientation="horizontal"]:where([dir="rtl"], [dir="rtl"] *) { --tw-rotate: 180deg }');
  assert.match(s, /rotate-180\[data-orientation="horizontal"\] svg:where\(\[dir="rtl"\], \[dir="rtl"\] \*\) \{/);
});

test('does not touch a selector that is already bound', async () => {
  const css = '.data-\\[alternate\\=true\\]\\:\\[\\&\\>\\[data-slot\\=timeline-item\\]\\:nth-child\\(even\\)\\]\\:flex-row-reverse[data-alternate="true"] > [data-slot=timeline-item]:nth-child(even) { flex-direction: row-reverse }';
  assert.equal(await run(css), css);
});

test('does not touch an arbitrary variant with no attribute variant before it', async () => {
  const css = '.\\[\\&_svg\\]\\:size-4 svg { width: 1rem }';
  assert.equal(await run(css), css);
});

test('fails closed when the attribute is nowhere in the selector', async () => {
  await assert.rejects(run('.data-\\[side\\=top\\]\\:\\[\\&_svg\\]\\:rotate-180 svg { --tw-rotate: 180deg }'), /missing/);
});
