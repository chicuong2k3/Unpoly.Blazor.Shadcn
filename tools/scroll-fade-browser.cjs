#!/usr/bin/env node
// Chromium forced static-mask parity; NOT Safari 15 or MAUI evidence.
const fs = require('node:fs');
const assert = require('node:assert/strict');
const postcss = require('postcss');
const { chromium } = require('playwright-core');
const { scrollFadeCompat } = require('./postcss-scroll-fade-compat.cjs');
function legacy(css, flatten) {
  let root = postcss.parse(css);
  if (flatten) root = postcss([scrollFadeCompat()]).process(root, { from: undefined }).root;
  root.walkAtRules('supports', at => {
    const condition = at.params.replace(/\s+/g, '');
    if (condition === '(animation-timeline:scroll())') at.params = '(display: unsupported-value)';
    if (condition === 'not(animation-timeline:scroll())') at.params = '(display: block)';
  });
  root.walkAtRules('property', at => { if (at.params.startsWith('--scroll-fade-')) at.remove(); });
  return root.toString();
}
async function run(executablePath, v4File, v3File) {
  const baseline = legacy(fs.readFileSync(v4File, 'utf8'), false);
  const v3Source = fs.readFileSync(v3File, 'utf8');
  const alreadyFlat = v3Source.includes('.scroll-fade-x:where([dir="rtl"], [dir="rtl"] *)');
  const candidate = legacy(v3Source, !alreadyFlat);
  const browser = await chromium.launch({ executablePath });
  try {
    const snapshots = [];
    for (const css of [baseline, candidate]) {
      const page = await browser.newPage();
      try {
        await page.setContent(`<style>${css}</style>
          <div id="x" class="scroll-fade-x" style="width:120px;overflow:auto;white-space:nowrap"><span style="display:inline-block;width:420px">overflow horizontally</span></div>
          <div id="b" class="scroll-fade-b" style="height:70px;overflow:auto"><div style="height:220px">overflow vertically</div></div>`);
        async function snap() {
          return page.evaluate(() => Object.fromEntries(['x', 'b'].map(id => {
            const el = document.getElementById(id); const style = getComputedStyle(el);
            // MAUI v4 is minified: custom-property text retains .25rem vs
            // Web/v3's 0.25rem, despite the same actual mask geometry.
            const variable = prop => style.getPropertyValue(prop).trim().replace(/(^|[^\d])\.25rem/g, (_, prefix) => prefix + '0.25rem');
            return [id, { mask: style.webkitMaskImage, animation: style.animationName, text: el.innerText,
              start: variable('--scroll-fade-s'), end: variable('--scroll-fade-e'), bottom: variable('--scroll-fade-b') }];
          })));
        }
        const ltr = await snap();

        await page.locator('#x').evaluate(el => el.setAttribute('dir', 'rtl'));
        const rtl = await snap();
        await page.locator('#x').evaluate(el => el.scrollLeft = -100);
        const scrolled = await snap();
        snapshots.push([ltr, rtl, scrolled]);
      } finally { await page.close(); }
    }
    assert.deepEqual(snapshots[1], snapshots[0], 'static mask and text must match v4 at LTR, RTL and scroll');
    const [ltr, rtl, scrolled] = snapshots[0];
    assert.match(ltr.x.mask, /linear-gradient/);
    assert.match(ltr.b.mask, /linear-gradient/);
    assert.notEqual(ltr.x.mask, rtl.x.mask, 'reading-direction mask must reverse');
    assert.equal(rtl.x.mask, scrolled.x.mask, 'without scroll-timeline fade is intentionally static');
    for (const state of [ltr, rtl, scrolled]) {
      assert.equal(state.x.animation, 'none'); assert.equal(state.b.animation, 'none');
      assert.notEqual(state.x.start, ''); assert.notEqual(state.x.end, ''); assert.notEqual(state.b.bottom, '');
    }
    console.log('Scroll-fade static masks LTR/RTL/scroll match v4 (forced-legacy Chromium only)');
  } finally { await browser.close(); }
}
if (require.main === module) {
  if (process.argv.length !== 5) { console.error('usage: <chromium.exe> <v4.css> <isolated-v3.css>'); process.exitCode = 2; }
  else run(...process.argv.slice(2)).catch(e => { console.error(e); process.exitCode = 1; });
}
module.exports = { run };
