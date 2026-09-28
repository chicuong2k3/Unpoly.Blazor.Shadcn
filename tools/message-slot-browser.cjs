#!/usr/bin/env node
// Opt-in Chromium v4/v3 computed state check for MessageContent child selector.
const fs = require('node:fs');
const assert = require('node:assert/strict');
const postcss = require('postcss');
const { chromium } = require('playwright-core');
const { messageSlotCompat } = require('./postcss-message-slot-compat.cjs');
async function run(executablePath, v4File, v3File) {
  const v4 = fs.readFileSync(v4File, 'utf8');
  const v3 = (await postcss([messageSlotCompat()]).process(fs.readFileSync(v3File, 'utf8'), { from: v3File })).css;
  const browser = await chromium.launch({ executablePath });
  try {
    const results = [];
    for (const css of [v4, v3]) {
      const page = await browser.newPage();
      try {
        await page.setContent(`<style>${css}</style><div class="group/message" id="group" data-align="end">
          <div id="wrapper" class="group-data-[align=end]/message:*:data-slot:self-end">
            <div id="with-slot" data-slot="content"></div><div id="without-slot"></div>
          </div></div>`);
        async function snap() {
          return page.evaluate(() => ['with-slot', 'without-slot'].map(id =>
            getComputedStyle(document.getElementById(id)).alignSelf));
        }
        const direct = await snap();
        await page.evaluate(() => document.getElementById('wrapper').setAttribute('data-slot', 'wrong-node'));
        const markedWrapper = await snap();
        await page.evaluate(() => document.getElementById('group').dataset.align = 'start');
        const inactive = await snap();
        await page.evaluate(() => {
          document.getElementById('group').dataset.align = 'end';
          document.getElementById('with-slot').removeAttribute('data-slot');
        });
        const unmarked = await snap();
        results.push([direct, markedWrapper, inactive, unmarked]);
      } finally { await page.close(); }
    }
    assert.deepEqual(results[0], [
      ['flex-end', 'auto'], ['flex-end', 'auto'], ['auto', 'auto'], ['auto', 'auto'],
    ]);
    assert.deepEqual(results[1], results[0]);
    console.log('MessageContent child data-slot direct, wrong-parent, toggle and removal parity PASS (Chromium only)');
  } finally { await browser.close(); }
}
if (require.main === module) {
  if (process.argv.length !== 5) { console.error('usage: <chromium.exe> <v4.css> <v3.css>'); process.exitCode = 2; }
  else run(...process.argv.slice(2)).catch(error => { console.error(error); process.exitCode = 1; });
}
module.exports = { run };
