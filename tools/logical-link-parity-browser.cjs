#!/usr/bin/env node
// Opt-in Web v4 vs isolated v3 computed-style probe (not Safari evidence).
// node tools/logical-link-parity-browser.cjs <chromium.exe> <v4.css> <v3.css>
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { chromium } = require('playwright-core');
async function run(executablePath, v4File, v3File) {
  const browser = await chromium.launch({ executablePath, headless: true });
  try {
    async function capture(file, dir) {
      const page = await browser.newPage();
      try {
        await page.setContent(`<style>${fs.readFileSync(file, 'utf8')}</style>
          <section id="box" dir="${dir}" style="position:relative;width:200px;height:40px">
            <span id="logical" class="absolute inset-s-1/2" style="width:10px;height:10px"></span>
          </section>
          <a id="direct" class="[a]:underline-offset-3" href="#test">Link</a>
          <span id="not-link" class="[a]:underline-offset-3">Text</span>
          <div class="*:[a]:underline-offset-3"><a id="child" href="#test">Child link</a><span id="not-child">Text</span></div>`);
        return await page.evaluate(() => {
          const computed = id => getComputedStyle(document.getElementById(id));
          const box = document.getElementById('box').getBoundingClientRect();
          const child = document.getElementById('logical').getBoundingClientRect();
          return {
            inlineStart: computed('logical').insetInlineStart,
            left: child.left - box.left,
            right: box.right - child.right,
            offsets: ['direct', 'not-link', 'child', 'not-child'].map(id => computed(id).textUnderlineOffset),
          };
        });
      } finally { await page.close(); }
    }
    for (const dir of ['ltr', 'rtl']) {
      const expected = await capture(v4File, dir);
      assert.equal(expected.inlineStart, '100px');
      assert.equal(dir === 'ltr' ? expected.left : expected.right, 100);
      assert.deepEqual(expected.offsets, ['3px', 'auto', '3px', 'auto']);
      assert.deepEqual(await capture(v3File, dir), expected);
    }
    console.log('Logical inset + link underline parity LTR/RTL PASS (Chromium only)');
  } finally { await browser.close(); }
}
if (require.main === module) {
  if (process.argv.length !== 5) {
    console.error('usage: node tools/logical-link-parity-browser.cjs <chromium.exe> <v4.css> <v3.css>');
    process.exitCode = 2;
  } else run(...process.argv.slice(2)).catch(error => { console.error(error); process.exitCode = 1; });
}
module.exports = { run };
