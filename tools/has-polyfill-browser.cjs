#!/usr/bin/env node
// Opt-in synthetic BROWSER test of css-has-pseudo's attribute fallback.
// NOT a Safari 15 test or evidence for the full Shadcn stylesheet.
// Run after npm ci --prefix tools:
// node tools/has-polyfill-browser.cjs <path-to-chromium-or-headless-shell.exe>
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const postcss = require('postcss');
const { chromium } = require('playwright-core');

async function run(executablePath, compiledCss) {
  const { default: hasPseudo } = await import('css-has-pseudo');
  // Remove native :has rules so modern Chromium CANNOT mask a broken fallback.
  const css = (await postcss([hasPseudo({ preserve: false })]).process(`
    .card { border: 3px solid transparent; background: transparent; outline: none }
    .card:has(> .error) { border-color: rgb(255, 0, 0) }
    .card:has(input[aria-invalid="true"]) { background-color: rgb(255, 255, 0) }
    .card:has(input:focus-visible) { outline: 3px solid rgb(0, 128, 0) }
  `, { from: undefined })).css;
  assert.ok(css.includes('csstools-has-'));
  assert.ok(!css.includes(':has('));
  const browser = await chromium.launch({ headless: true, executablePath });
  try {
    const page = await browser.newPage();
    await page.setContent(`<html><head><style>${css}</style></head><body><div class="card" id="card"><input id="input"></div></body></html>`);
    await page.addScriptTag({ path: path.join(path.dirname(require.resolve('css-has-pseudo/browser')), 'browser-global.js') });
    await page.evaluate(() => window.cssHasPseudo(document, {
      forcePolyfill: true,
      observedAttributes: ['aria-invalid', 'class'],
    }));
    const waitFor = async (property, expected) => {
      await page.waitForFunction(([name, value]) =>
        getComputedStyle(document.getElementById('card'))[name] === value,
      [property, expected], { timeout: 5000 });
      const count = await page.locator('#card').evaluate(element =>
        element.getAttributeNames().filter(name => name.startsWith('csstools-has-')).length);
      return count;
    };
    await page.evaluate(() => document.getElementById('card').insertAdjacentHTML('beforeend', '<i class="error">Error</i>'));
    assert.ok(await waitFor('borderTopColor', 'rgb(255, 0, 0)') > 0, 'fallback attribute must be set');
    await page.evaluate(() => document.querySelector('.error').remove());
    assert.equal(await waitFor('borderTopColor', 'rgba(0, 0, 0, 0)'), 0, 'fallback attribute must clear');
    await page.evaluate(() => document.getElementById('input').setAttribute('aria-invalid', 'true'));
    assert.ok(await waitFor('backgroundColor', 'rgb(255, 255, 0)') > 0);
    await page.evaluate(() => document.getElementById('input').setAttribute('aria-invalid', 'false'));
    assert.equal(await waitFor('backgroundColor', 'rgba(0, 0, 0, 0)'), 0);
    await page.keyboard.press('Tab');
    assert.ok(await waitFor('outlineColor', 'rgb(0, 128, 0)') > 0);
    // Simulate a fragment swap. The new element must receive the attribute.
    await page.evaluate(() => { document.getElementById('card').outerHTML = '<div class="card" id="card"><span class="error">Fragment</span></div>'; });
    assert.ok(await waitFor('borderTopColor', 'rgb(255, 0, 0)') > 0);
    console.log('Forced :has fallback: add/remove, aria-invalid, keyboard focus, fragment replacement PASS (Chromium only)');
    if (compiledCss) {
      // Integration probe against a candidate stylesheet, NOT a release test.
      // No native :has selectors may silently make this check pass.
      const candidate = (await postcss([hasPseudo({ preserve: false })]).process(
        fs.readFileSync(compiledCss, 'utf8'), { from: compiledCss })).css;
      const fullPage = await browser.newPage();
      await fullPage.setContent(`<html><head><style>${candidate}</style></head><body><div id="box" class="has-disabled:opacity-50"><input id="disabled-input"></div></body></html>`);
      await fullPage.addScriptTag({ path: path.join(path.dirname(require.resolve('css-has-pseudo/browser')), 'browser-global.js') });
      await fullPage.evaluate(() => window.cssHasPseudo(document, { forcePolyfill: true, observedAttributes: ['disabled'] }));
      await fullPage.evaluate(() => { document.getElementById('disabled-input').disabled = true; });
      await fullPage.waitForFunction(() => getComputedStyle(document.getElementById('box')).opacity === '0.5', null, { timeout: 5000 });
      await fullPage.evaluate(() => { document.getElementById('disabled-input').disabled = false; });
      await fullPage.waitForFunction(() => getComputedStyle(document.getElementById('box')).opacity === '1', null, { timeout: 5000 });
      console.log('Forced :has fallback: disabled toggle in candidate stylesheet PASS (Chromium only)');
    }
  } finally {
    await browser.close();
  }
}

if (require.main === module) {
  if (!process.argv[2]) {
    console.error('usage: node tools/has-polyfill-browser.cjs <path-to-chromium-or-headless-shell.exe> [candidate.css]');
    process.exitCode = 2;
  } else {
    run(process.argv[2], process.argv[3]).catch(error => { console.error(error); process.exitCode = 1; });
  }
}
module.exports = { run };
