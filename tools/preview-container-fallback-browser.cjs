#!/usr/bin/env node
// Test the actual opt-in preview CSS and generated runtime, with native container
// queries removed. Chromium simulation is NOT real Safari 15 evidence.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const postcss = require('postcss');
const { chromium } = require('playwright-core');
const demoFor = head => path.resolve(__dirname, `../demo/Unpoly.Blazor.Shadcn.${head === 'web' ? 'Demo' : 'Maui'}/wwwroot`);
async function run(executablePath, head) {
  assert.ok(['web', 'maui'].includes(head), 'head must be web or maui');
  const demo = demoFor(head);
  const root = postcss.parse(fs.readFileSync(path.join(demo, 'app.v3.css'), 'utf8'));
  let native = 0, fallback = 0;
  root.walkAtRules('container', rule => { native++; rule.remove(); });
  root.walkAtRules('supports', rule => {
    if (rule.params === 'not (container-type: inline-size)') {
      fallback++;
      rule.replaceWith(...rule.nodes.map(node => node.clone()));
    }
  });
  assert.ok(native >= 4 && fallback >= 4, `Preview missing native/fallback container rules: ${native}/${fallback}`);
  const script = path.join(demo, 'container-fallback.v3.js');
  const browser = await chromium.launch({ executablePath, headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    await page.setContent(`<html><head><style>${root.toString()}</style></head><body>
      <div id="outer" class="@container/field-group" style="width:500px">
        <div id="wide" class="flex flex-col @md/field-group:flex-row @md/field-group:items-center">
          <span>Wide</span></div>
        <div id="inner" class="@container/field-group" style="width:400px">
          <div id="narrow" class="flex flex-col @md/field-group:flex-row @md/field-group:items-center">
            <span>Narrow</span></div></div></div>
      <div id="card" class="@container/card-header" style="width:500px">
        <div id="card-title" class="flex @md/card-header:flex"><span>Card</span></div></div>
    </body></html>`);
    // The real Safari branch runs when native container-type is unavailable.
    await page.evaluate(() => {
      const supports = CSS.supports.bind(CSS);
      CSS.supports = (name, value) => name === 'container-type' ? false : supports(name, value);
    });
    await page.addScriptTag({ path: script });
    async function expect(wide, narrow) {
      await page.waitForFunction(expected => {
        const attrs = id => document.getElementById(id).hasAttribute('data-cq-md-field-group');
        return attrs('wide') === expected[0] && attrs('narrow') === expected[1] &&
          getComputedStyle(document.getElementById('wide')).flexDirection === (expected[0] ? 'row' : 'column') &&
          getComputedStyle(document.getElementById('narrow')).flexDirection === (expected[1] ? 'row' : 'column');
      }, [wide, narrow], { timeout: 8000 });
    }
    await expect(true, false);
    assert.equal(await page.locator('#card-title').getAttribute('data-cq-md-card-header'), '');
    await page.evaluate(() => { document.getElementById('outer').style.width = '400px'; document.getElementById('inner').style.width = '500px'; });
    await expect(false, true);
    await page.evaluate(() => { document.getElementById('inner').remove(); document.getElementById('outer').style.width = '500px'; });
    await page.waitForFunction(() => document.querySelector('#wide[data-cq-md-field-group]') !== null);
    console.log(`${head} preview forced no-container: ${native} native + ${fallback} fallback rules, nested/resize/removal/card-header PASS (Chromium only)`);
  } finally { await browser.close(); }
}
if (require.main === module) {
  if (process.argv.length !== 4) { console.error('usage: node tools/preview-container-fallback-browser.cjs <chromium.exe> <web|maui>'); process.exitCode = 2; }
  else run(process.argv[2], process.argv[3]).catch(error => { console.error(error); process.exitCode = 1; });
}
module.exports = { run };
