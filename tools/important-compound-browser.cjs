#!/usr/bin/env node
// Opt-in Chromium v4/v3 computed-state parity; not a real Safari 15 test.
// node tools/important-compound-browser.cjs <chromium.exe> <v4.css> <v3.css>
const fs = require('node:fs');
const assert = require('node:assert/strict');
const postcss = require('postcss');
const { chromium } = require('playwright-core');
const { importantCompoundCompat } = require('./postcss-important-compound-compat.cjs');
async function run(executablePath, v4File, v3File) {
  const v4 = fs.readFileSync(v4File, 'utf8');
  const v3 = (await postcss([importantCompoundCompat()]).process(fs.readFileSync(v3File, 'utf8'), { from: v3File })).css;
  const browser = await chromium.launch({ executablePath, headless: true });
  try {
    async function states(css) {
      const page = await browser.newPage();
      try {
        await page.setContent(`<style>${css}</style>
          <div class="group/attachment" id="group" data-orientation="vertical">
            <div id="holder" class="group-data-[orientation=vertical]/attachment:*:data-[slot=spinner]:size-6!" style="width:100px">
              <span id="spinner" data-slot="spinner" style="display:block"></span>
            </div>
          </div>
          <div id="destructive" data-variant="destructive" class="data-[variant=destructive]:*:[svg]:text-destructive!"
            style="color:blue;--destructive:rgb(220,38,38);--destructive-rgb:220,38,38;--destructive-alpha:1">
            <svg id="svg" width="20" height="20"></svg><span id="not-svg">Other</span>
          </div>
          <div id="alpha" class="bg-primary/20" style="--primary:rgba(255,255,255,.1);--primary-rgb:255,255,255;--primary-alpha:.1"></div>`);
        async function snapshot() {
          return page.evaluate(() => {
            const css = id => getComputedStyle(document.getElementById(id));
            return {
              holder: [css('holder').width, css('holder').height],
              spinner: [css('spinner').width, css('spinner').height],
              svg: css('svg').color,
              other: css('not-svg').color,
              alpha: (() => {
                const canvas = document.createElement('canvas'); canvas.width = canvas.height = 1;
                const context = canvas.getContext('2d');
                context.fillStyle = css('alpha').backgroundColor;
                context.fillRect(0, 0, 1, 1);
                return [...context.getImageData(0, 0, 1, 1).data];
              })(),
            };
          });
        }
        const active = await snapshot();
        await page.evaluate(() => {
          document.getElementById('group').dataset.orientation = 'horizontal';
          document.getElementById('destructive').dataset.variant = 'default';
        });
        const inactive = await snapshot();
        return [active, inactive];
      } finally { await page.close(); }
    }
    const baseline = await states(v4);
    const candidate = await states(v3);
    assert.deepEqual(baseline[0].spinner, ['24px', '24px']);
    assert.equal(baseline[0].svg, 'rgb(220, 38, 38)');
    assert.equal(baseline[0].other, 'rgb(0, 0, 255)');
    // v4 serializes oklab(), v3 rgba(); compare actual painted sRGB pixels.
    assert.ok(candidate[0].alpha[3] > 0, 'alpha utility must not silently disappear');
    assert.deepEqual(candidate, baseline);
    console.log('Important spinner/color and alpha theme + off states PASS (Chromium only)');
  } finally { await browser.close(); }
}
if (require.main === module) {
  if (process.argv.length !== 5) {
    console.error('usage: node tools/important-compound-browser.cjs <chromium.exe> <v4.css> <v3.css>');
    process.exitCode = 2;
  } else run(...process.argv.slice(2)).catch(error => { console.error(error); process.exitCode = 1; });
}
module.exports = { run };
