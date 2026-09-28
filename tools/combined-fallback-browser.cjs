#!/usr/bin/env node
// Opt-in Chromium-only integration probe. Deletes native @container and :has
// rules so neither built-in browser implementation can mask a broken fallback.
// node tools/combined-fallback-browser.cjs <chromium.exe> <v3-candidate.css>
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const postcss = require('postcss');
const { chromium } = require('playwright-core');
const { createContainerFallback } = require('./postcss-container-fallback.cjs');

async function run(executablePath, candidateFile) {
  const { default: hasPseudo } = await import('css-has-pseudo');
  const { plugin, manifest } = createContainerFallback({ force: true, removeNative: true });
  // Container transform must precede :has transformation so compound selectors
  // receive BOTH independent fallback attributes on the target Field.
  const css = (await postcss([plugin, hasPseudo({ preserve: false })]).process(
    fs.readFileSync(candidateFile, 'utf8'), { from: candidateFile })).css;
  assert.ok(manifest['field-group'].includes('@md/field-group:has-[>[data-slot=field-content]]:items-start'));
  const ast = postcss.parse(css);
  ast.walkAtRules('container', () => assert.fail('native @container rule survived forced transform'));
  const browser = await chromium.launch({ headless: true, executablePath });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    const fieldClass = 'flex flex-col @md/field-group:flex-row @md/field-group:items-center @md/field-group:has-[>[data-slot=field-content]]:items-start';
    await page.setContent(`<html><head><style>${css}</style></head><body>
      <div id="outer" class="@container/field-group" style="width:500px">
        <div id="outer-field" class="${fieldClass}"><span data-slot="field-content">Content</span></div>
        <div id="inner" class="@container/field-group" style="width:400px">
          <div id="inner-field" class="${fieldClass}"><span data-slot="field-content">Content</span></div>
        </div>
      </div>
    </body></html>`);
    await page.addScriptTag({ path: path.join(__dirname, 'container-fallback-runtime.js') });
    await page.addScriptTag({ path: path.join(path.dirname(require.resolve('css-has-pseudo/browser')), 'browser-global.js') });
    await page.evaluate(manifest => {
      window.stopContainerFallback = window.shadcnContainerFallback.start(manifest, { force: true });
      window.cssHasPseudo(document, { forcePolyfill: true,
        observedAttributes: ['data-slot', ...window.shadcnContainerFallback.observedAttributes] });
    }, manifest);
    async function expect(outer, inner) {
      try { await page.waitForFunction(values => {
        const state = id => {
          const element = document.getElementById(id), style = getComputedStyle(element);
          return [style.flexDirection, style.alignItems,
            element.hasAttribute('data-cq-md-field-group'),
            element.getAttributeNames().some(name => name.startsWith('csstools-has-'))];
        };
        return JSON.stringify([state('outer-field'), state('inner-field')]) === JSON.stringify(values);
      }, [outer, inner], { timeout: 8000 }); }
      catch (error) {
        console.error('Actual combined fallback state:', await page.evaluate(() =>
          ['outer-field', 'inner-field'].map(id => {
            const el = document.getElementById(id), style = getComputedStyle(el);
            return { id, direction: style.flexDirection, align: style.alignItems, attrs: el.getAttributeNames() };
          })));
        throw error;
      }
    }
    await expect(['row', 'flex-start', true, true], ['column', 'normal', false, false]);
    await page.evaluate(() => document.querySelector('#outer-field > [data-slot]').remove());
    await expect(['row', 'center', true, false], ['column', 'normal', false, false]);
    await page.evaluate(() => {
      document.getElementById('outer').style.width = '400px';
      document.getElementById('inner').style.width = '500px';
    });
    await expect(['column', 'normal', false, false], ['row', 'flex-start', true, true]);
    await page.evaluate(() => {
      document.getElementById('inner').outerHTML = `<div id="inner" class="@container/field-group" style="width:500px">
        <div id="inner-field" class="flex flex-col @md/field-group:flex-row @md/field-group:items-center @md/field-group:has-[>[data-slot=field-content]]:items-start"><span>Not content yet</span></div></div>`;
    });
    await expect(['column', 'normal', false, false], ['row', 'center', true, false]);
    await page.evaluate(() => document.querySelector('#inner-field > span').setAttribute('data-slot', 'field-content'));
    await expect(['column', 'normal', false, false], ['row', 'flex-start', true, true]);
    console.log('Combined forced @container + :has fallback: nested widths, child remove, resize, fragment swap, data-slot mutation PASS (Chromium only)');
  } finally { await browser.close(); }
}
if (require.main === module) {
  if (process.argv.length !== 4) {
    console.error('usage: node tools/combined-fallback-browser.cjs <chromium.exe> <v3-candidate.css>');
    process.exitCode = 2;
  } else {
    run(process.argv[2], process.argv[3]).catch(error => { console.error(error); process.exitCode = 1; });
  }
}
module.exports = { run };
