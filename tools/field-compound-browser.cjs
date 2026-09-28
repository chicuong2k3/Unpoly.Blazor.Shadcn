#!/usr/bin/env node
// Opt-in browser parity test for ONE missing v3 Field utility. Third case
// forces BOTH @container + :has fallbacks by deleting native rules in Chromium.
// node tools/field-compound-browser.cjs <chromium.exe> <v4.css> <v3-candidate.css>
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const postcss = require('postcss');
const { chromium } = require('playwright-core');
const { fieldCompoundCompat, className, horizontalClassName } = require('./postcss-field-compound-compat.cjs');
const { createContainerFallback } = require('./postcss-container-fallback.cjs');

async function run(executablePath, v4File, v3File) {
  const { default: hasPseudo } = await import('css-has-pseudo');
  const v4 = fs.readFileSync(v4File, 'utf8');
  const v3 = (await postcss([fieldCompoundCompat()]).process(fs.readFileSync(v3File, 'utf8'), { from: v3File })).css;
  const { plugin, manifest } = createContainerFallback({ force: true, removeNative: true });
  const forced = (await postcss([fieldCompoundCompat(), plugin, hasPseudo({ preserve: false })]).process(
    fs.readFileSync(v3File, 'utf8'), { from: v3File })).css;
  const browser = await chromium.launch({ headless: true, executablePath });
  try {
    async function states(css, fallback, responsive) {
      const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
      try {
        await page.setContent(`<html><head><style>${css}</style></head><body>
          <div id="group" class="@container/field-group" style="width:500px">
            <div id="field" class="${responsive ? className : horizontalClassName}"><span id="content" data-slot="field-content"></span>
              <span id="check" role="checkbox"></span><span id="radio" role="radio"></span>
              <span><span id="nested-radio" role="radio"></span></span>
            </div>
          </div></body></html>`);
        if (fallback) {
          await page.addScriptTag({ path: path.join(__dirname, 'container-fallback-runtime.js') });
          await page.addScriptTag({ path: path.join(path.dirname(require.resolve('css-has-pseudo/browser')), 'browser-global.js') });
          await page.evaluate(manifest => {
            window.shadcnContainerFallback.start(manifest, { force: true });
            window.cssHasPseudo(document, { forcePolyfill: true,
              observedAttributes: ['data-slot', ...window.shadcnContainerFallback.observedAttributes] });
          }, manifest);
        }
        const result = [];
        async function snapshot(expected) {
          try { await page.waitForFunction(value => ['check', 'radio', 'nested-radio'].every(id =>
            getComputedStyle(document.getElementById(id)).marginTop === value), expected, { timeout: 6000 }); }
          catch (error) {
            console.error('Field fallback state:', JSON.stringify({ fallback, expected, state: await page.evaluate(() => ({
              fieldAttrs: document.getElementById('field').getAttributeNames(),
              margin: ['check', 'radio', 'nested-radio'].map(id => getComputedStyle(document.getElementById(id)).marginTop),
              attrs: ['check', 'radio', 'nested-radio'].map(id => document.getElementById(id).getAttributeNames()),
            })) }));
            throw error;
          }
          result.push(await page.evaluate(() => ['check', 'radio', 'nested-radio'].map(id =>
            getComputedStyle(document.getElementById(id)).marginTop)));
        }
        await snapshot('1px'); // wide + direct FieldContent
        await page.evaluate(() => { document.getElementById('group').style.width = '400px'; });
        await snapshot(responsive ? '0px' : '1px'); // narrow; horizontal is independent of container
        await page.evaluate(() => { document.getElementById('group').style.width = '500px'; document.getElementById('content').remove(); });
        await snapshot('0px'); // wide without direct content
        await page.evaluate(() => { document.getElementById('field').insertAdjacentHTML('afterbegin', '<span id="content" data-slot="field-content"></span>'); });
        await snapshot('1px'); // DOM mutation
        return result;
      } finally { await page.close(); }
    }
    for (const responsive of [true, false]) {
      const nativeV4 = await states(v4, false, responsive);
      const nativeV3 = await states(v3, false, responsive);
      const forcedV3 = await states(forced, true, responsive);
      assert.deepEqual(nativeV3, nativeV4);
      assert.deepEqual(forcedV3, nativeV4);
    }
    console.log('Field responsive + horizontal compounds: v4 vs patched v3 vs forced BOTH fallbacks; checkbox, direct/nested radio, width and content mutations PASS (Chromium only)');
  } finally { await browser.close(); }
}
if (require.main === module) {
  if (process.argv.length !== 5) {
    console.error('usage: node tools/field-compound-browser.cjs <chromium.exe> <v4.css> <v3-candidate.css>');
    process.exitCode = 2;
  } else run(process.argv[2], process.argv[3], process.argv[4]).catch(error => { console.error(error); process.exitCode = 1; });
}
module.exports = { run };
