const { test } = require('node:test');
const assert = require('node:assert/strict');
const postcss = require('postcss');
const { sliderVerticalCompat, baseSelector, utilitySelector } = require('./postcss-slider-vertical-compat.cjs');
const heightSelector = '.data-\\[orientation\\=vertical\\]\\:h-full[data-orientation="vertical"]';
const source = `${baseSelector} { block-size: auto; inline-size: auto } ${utilitySelector} { width: 1rem } ${heightSelector} { height: 100% }`;
test('vertical slider bridge scopes block-size to the real input utility', async () => {
  const result = await postcss([sliderVerticalCompat()]).process(source, { from: undefined });
  assert.match(result.css, /block-size: 1rem/);
  assert.ok(result.css.includes(baseSelector + utilitySelector));
  assert.equal((result.css.match(/block-size: 1rem/g) || []).length, 1);
  assert.ok(result.css.includes(baseSelector + heightSelector));
  assert.equal((result.css.match(/inline-size: 100%/g) || []).length, 1);
});
test('vertical slider bridge fails closed on a missing/changed source rule', async () => {
  await assert.rejects(postcss([sliderVerticalCompat()]).process(`${baseSelector} { block-size: 2rem } ${utilitySelector} { width: 1rem }`, { from: undefined }), /Unexpected vertical Slider/);
  await assert.rejects(postcss([sliderVerticalCompat()]).process(source + source, { from: undefined }), /Unexpected vertical Slider/);
  await assert.rejects(postcss([sliderVerticalCompat()]).process(source.replace('height: 100%', 'height: auto'), { from: undefined }), /Unexpected vertical Slider/);
});
