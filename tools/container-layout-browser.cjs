#!/usr/bin/env node
// Opt-in NATIVE container-query parity probe. Chromium supports @container;
// this DOES NOT establish Safari 15 behavior or complete component parity.
// node tools/container-layout-browser.cjs <chromium.exe> <v4-web.css> <v3-candidate.css>
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { chromium } = require('playwright-core');

async function run(executablePath, baseline, candidate) {
  const browser = await chromium.launch({ headless: true, executablePath });
  try {
    async function check(file) {
      const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
      try {
        const css = fs.readFileSync(file, 'utf8');
        await page.setContent(`<html><head><style>${css}</style></head><body>
          <div id="outer" class="@container/field-group" style="width:400px">
            <div id="outer-field" class="flex flex-col @md/field-group:flex-row @md/field-group:items-center">Outer</div>
            <div id="inner" class="@container/field-group" style="width:500px">
              <div id="inner-field" class="flex flex-col @md/field-group:flex-row @md/field-group:items-center">Inner</div>
            </div>
          </div>
          <div id="card" class="@container/card-header" style="width:447px"><div id="card-child" class="@md/card-header:flex">Card</div></div>
        </body></html>`);
        const snapshot = () => page.evaluate(() => {
          const style = id => getComputedStyle(document.getElementById(id));
          return [style('outer-field').flexDirection, style('outer-field').alignItems,
            style('inner-field').flexDirection, style('inner-field').alignItems,
            style('card-child').display];
        });
        const states = [await snapshot()];
        // Reverse the nested sizes: closest named container must win.
        await page.evaluate(() => {
          document.getElementById('outer').style.width = '500px';
          document.getElementById('inner').style.width = '400px';
          document.getElementById('card').style.width = '448px';
        });
        states.push(await snapshot());
        // The same component must update on resize, without navigation.
        await page.evaluate(() => {
          document.getElementById('inner').style.width = '448px';
          document.getElementById('card').style.width = '447px';
        });
        states.push(await snapshot());
        return states;
      } finally { await page.close(); }
    }
    const expected = [
      ['column', 'normal', 'row', 'center', 'block'],
      ['row', 'center', 'column', 'normal', 'flex'],
      ['row', 'center', 'row', 'center', 'block'],
    ];
    const v4 = await check(baseline);
    const v3 = await check(candidate);
    assert.deepEqual(v4, expected, 'v4 baseline differs from expected nearest-container behavior');
    assert.deepEqual(v3, v4, 'v3 candidate differs from v4 baseline');
    console.log('Native @container: field/card widths, nested nearest container and resize PASS in Chromium (not Safari 15)');
  } finally { await browser.close(); }
}

if (require.main === module) {
  if (process.argv.length !== 5) {
    console.error('usage: node tools/container-layout-browser.cjs <chromium.exe> <v4-web.css> <v3-candidate.css>');
    process.exitCode = 2;
  } else {
    run(process.argv[2], process.argv[3], process.argv[4]).catch(error => { console.error(error); process.exitCode = 1; });
  }
}
module.exports = { run };
