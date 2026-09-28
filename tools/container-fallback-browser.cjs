#!/usr/bin/env node
// Opt-in FORCED fallback probe in Chromium: removes all native @container
// rules from candidate CSS. NOT a Safari 15 certification or demo integration.
// node tools/container-fallback-browser.cjs <chromium.exe> <v3-candidate.css>
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const postcss = require('postcss');
const { chromium } = require('playwright-core');
const { createContainerFallback } = require('./postcss-container-fallback.cjs');

async function run(executablePath, candidateFile) {
  const { plugin, manifest } = createContainerFallback({ force: true, removeNative: true });
  const css = (await postcss([plugin]).process(fs.readFileSync(candidateFile, 'utf8'), { from: candidateFile })).css;
  assert.ok(!css.includes('@container field-group (min-width: 28rem)'));
  assert.ok(manifest['field-group'].includes('@md/field-group:flex-row'));
  assert.ok(manifest['card-header'].includes('@md/card-header:flex'));
  const browser = await chromium.launch({ headless: true, executablePath });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    await page.setContent(`<html><head><style>${css}</style></head><body>
      <div id="outer" class="@container/field-group" style="width:400px">
        <div id="outer-field" class="flex flex-col @md/field-group:flex-row @md/field-group:items-center">Outer</div>
        <div id="inner" class="@container/field-group" style="width:500px">
          <div id="inner-field" class="flex flex-col @md/field-group:flex-row @md/field-group:items-center">Inner</div>
        </div>
      </div>
      <div id="card" class="@container/card-header" style="width:447px"><div id="card-child" class="@md/card-header:flex">Card</div></div>
    </body></html>`);
    await page.addScriptTag({ path: path.join(__dirname, 'container-fallback-runtime.js') });
    await page.evaluate(manifest => { window.stopContainerFallback = window.shadcnContainerFallback.start(manifest, { force: true }); }, manifest);
    async function expectState(expected) {
      await page.waitForFunction(value => {
        const style = id => getComputedStyle(document.getElementById(id));
        return JSON.stringify([style('outer-field').flexDirection, style('outer-field').alignItems,
          style('inner-field').flexDirection, style('inner-field').alignItems,
          style('card-child').display]) === JSON.stringify(value);
      }, expected, { timeout: 5000 });
      const attrs = await page.evaluate(() => ['outer-field', 'inner-field', 'card-child'].map(id =>
        document.getElementById(id).getAttributeNames().filter(attr => attr.startsWith('data-cq-md-'))));
      assert.deepEqual(attrs.map(a => a.length), expected[0] === 'row' ?
        [1, expected[2] === 'row' ? 1 : 0, expected[4] === 'flex' ? 1 : 0] :
        [0, 1, expected[4] === 'flex' ? 1 : 0]);
    }
    await expectState(['column', 'normal', 'row', 'center', 'block']);
    await page.evaluate(() => { document.getElementById('outer').style.width = '500px'; document.getElementById('inner').style.width = '400px'; document.getElementById('card').style.width = '448px'; });
    await expectState(['row', 'center', 'column', 'normal', 'flex']);
    await page.evaluate(() => { document.getElementById('inner').style.width = '448px'; document.getElementById('card').style.width = '447px'; });
    await expectState(['row', 'center', 'row', 'center', 'block']);
    await page.evaluate(() => { document.getElementById('inner').outerHTML = '<div id="inner" class="@container/field-group" style="width:400px"><div id="inner-field" class="flex flex-col @md/field-group:flex-row @md/field-group:items-center">Fragment</div></div>'; });
    await expectState(['row', 'center', 'column', 'normal', 'block']);
    await page.evaluate(() => { document.getElementById('card').style.width = '460px'; document.documentElement.style.fontSize = '17px'; });
    await expectState(['row', 'center', 'column', 'normal', 'block']);
    await page.evaluate(() => { document.documentElement.style.fontSize = '16px'; });
    await expectState(['row', 'center', 'column', 'normal', 'flex']);
    await page.evaluate(() => { window.stopContainerFallback(); });
    console.log('Forced @container fallback: nested nearest container, 28rem boundary, resize, fragment replacement, root font change PASS (Chromium only)');
  } finally { await browser.close(); }
}
if (require.main === module) {
  if (process.argv.length !== 4) {
    console.error('usage: node tools/container-fallback-browser.cjs <chromium.exe> <v3-candidate.css>');
    process.exitCode = 2;
  } else {
    run(process.argv[2], process.argv[3]).catch(error => { console.error(error); process.exitCode = 1; });
  }
}
module.exports = { run };
