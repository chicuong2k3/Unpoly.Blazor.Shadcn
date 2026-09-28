#!/usr/bin/env node
// Opt-in computed-style parity for selected v4/v3 utility values & cascade.
// node tools/scale-parity-browser.cjs <chromium.exe> <v4-web.css> <v3-web.css>
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { chromium } = require('playwright-core');
async function run(executablePath, baselineFile, candidateFile) {
  const browser = await chromium.launch({ executablePath, headless: true });
  try {
    async function snapshot(file) {
      const page = await browser.newPage();
      try {
        await page.setContent(`<style>${fs.readFileSync(file, 'utf8')}</style>
          <div id="br" class="brightness-60"></div>
          <div id="dur" data-active="false" class="data-[active=false]:duration-400"></div>
          <div id="pr" class="has-data-[slot=alert-action]:pr-18"><span data-slot="alert-action"></span></div>
          <div id="w" class="has-data-[slot=attachment-content]:w-30"><span data-slot="attachment-content"></span></div>
          <div id="pb" class="border-b [.border-b]:pb-3 [.border-b]:pb-(--card-spacing)" style="--card-spacing:1.25rem"></div>
          <div id="pt" class="border-t [.border-t]:pt-3 [.border-t]:pt-(--card-spacing)" style="--card-spacing:1.25rem"></div>`);
        const state = () => page.evaluate(() => {
          const css = id => getComputedStyle(document.getElementById(id));
          return [css('br').filter, css('dur').transitionDuration, css('pr').paddingRight,
            css('w').width, css('pb').paddingBottom, css('pt').paddingTop];
        });
        const initial = await state();
        await page.evaluate(() => {
          document.getElementById('dur').dataset.active = 'true';
          document.querySelector('#pr [data-slot]').remove();
          document.querySelector('#w [data-slot]').remove();
          document.getElementById('pb').classList.remove('border-b');
          document.getElementById('pt').classList.remove('border-t');
        });
        return [initial, await state()];
      } finally { await page.close(); }
    }
    const baseline = await snapshot(baselineFile);
    assert.deepEqual(baseline[0], ['brightness(0.6)', '0.4s', '72px', '120px', '12px', '12px']);
    assert.deepEqual(baseline[1].slice(1), ['0s', '0px', '1280px', '0px', '0px']);
    assert.deepEqual(await snapshot(candidateFile), baseline);
    console.log('Value + state + border-spacing cascade parity PASS (Chromium only)');
  } finally { await browser.close(); }
}
if (require.main === module) {
  if (process.argv.length !== 5) {
    console.error('usage: node tools/scale-parity-browser.cjs <chromium.exe> <v4-web.css> <v3-web.css>');
    process.exitCode = 2;
  } else run(...process.argv.slice(2)).catch(error => { console.error(error); process.exitCode = 1; });
}
module.exports = { run };
