#!/usr/bin/env node
// Opt-in Chromium simulation against ACTUAL Web/MAUI opt-in preview CSS/JS and
// the shipped has-pseudo boot. Native container and :has rules are removed to
// ensure their implementations cannot hide missing fallback behavior.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const postcss = require('postcss');
const { chromium } = require('playwright-core');
const { className: compoundClass } = require('./postcss-field-compound-compat.cjs');
const root = path.resolve(__dirname, '..');
async function run(executablePath, head) {
  assert.ok(['web', 'maui', 'portal', 'pos'].includes(head));
  const consumer = head === 'portal' || head === 'pos';
  const demo = consumer ? os.tmpdir() : path.join(root, 'demo', `Unpoly.Blazor.Shadcn.${head === 'web' ? 'Demo' : 'Maui'}`, 'wwwroot');
  const cssFile = consumer ? `shadcn-${head}-tailwind3-probe.css` : 'app.v3.css';
  const scriptFile = consumer ? `shadcn-${head}-container-v3-probe.js` : 'container-fallback.v3.js';
  const css = postcss.parse(fs.readFileSync(path.join(demo, cssFile), 'utf8'));
  let containers = 0, has = 0, fallbacks = 0;
  css.walkAtRules('container', rule => { containers++; rule.remove(); });
  css.walkAtRules('supports', rule => {
    if (rule.params === 'not (container-type: inline-size)') {
      fallbacks++;
      rule.replaceWith(...rule.nodes.map(node => node.clone()));
    }
  });
  css.walkRules(rule => { if (rule.selector.includes(':has(')) { has++; rule.remove(); } });
  assert.ok(containers >= 4 && fallbacks >= 4 && has > 80, `Preview missing native/fallback inventory: ${containers}/${fallbacks}/${has}`);
  const field = `flex flex-col @md/field-group:flex-row @md/field-group:items-center @md/field-group:has-[>[data-slot=field-content]]:items-start ${compoundClass}`;
  const browser = await chromium.launch({ executablePath, headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.setContent(`<html class="js-has-pseudo"><head><link id="demo-app-css" data-demo-css="v3"><style>${css.toString()}</style></head><body>
      <div id="outer" class="@container/field-group" style="width:500px"><div id="outer-field" class="${field}">
        <span id="outer-content" data-slot="field-content">Content</span><span id="check" role="checkbox"></span><span id="radio" role="radio"></span><span><span id="nested-radio" role="radio"></span></span></div>
        <div id="inner" class="@container/field-group" style="width:400px">
          <div id="inner-field" class="${field}"><span id="inner-content" data-slot="field-content">Content</span></div>
        </div></div><div id="native-wrapper" class="group/native-select relative w-fit has-[select:disabled]:opacity-50"><select id="native-choice"><option>Example</option></select></div>
      <div id="input-group" class="has-[>[data-align=inline-start]]:[&>input]:pl-2 has-[>[data-align=inline-end]]:[&>input]:pr-2 has-[>[data-align=block-start]]:[&>input]:pb-3 has-[>[data-align=block-end]]:[&>input]:pt-3"><div id="input-addon" data-align="inline-start"></div><input id="group-input" class="px-3 py-1"></div></body></html>`);
    await page.evaluate(() => {
      const native = CSS.supports.bind(CSS);
      CSS.supports = (query, value) => query === 'container-type' ||
        (typeof query === 'string' && query.startsWith('selector(:has(')) ? false : native(query, value);
    });
    await page.addScriptTag({ path: path.join(demo, scriptFile) });
    await page.addScriptTag({ path: path.join(root, 'src/Unpoly.Blazor.Shadcn/wwwroot/compat/css-has-pseudo.js') });
    await page.addScriptTag({ path: path.join(root, 'src/Unpoly.Blazor.Shadcn/wwwroot/compat/has-pseudo-boot.js') });
    async function expect(outer, inner) {
      try {
        await page.waitForFunction(values => {
          function state(id) {
            const el = document.getElementById(id), s = getComputedStyle(el);
            return [s.flexDirection, s.alignItems, el.hasAttribute('data-cq-md-field-group'),
              el.getAttributeNames().some(n => n.startsWith('csstools-has-'))];
          }
          return JSON.stringify([state('outer-field'), state('inner-field')]) === JSON.stringify(values);
        }, [outer, inner], { timeout: 10000 });
      } catch (error) {
        console.error('combined preview states', await page.evaluate(() => ['outer-field', 'inner-field'].map(id => {
          const e = document.getElementById(id), s = getComputedStyle(e);
          return [id, s.flexDirection, s.alignItems, e.getAttributeNames()];
        })));
        throw error;
      }
    }
    async function margins(value) {
      await page.waitForFunction(value => ['check', 'radio', 'nested-radio'].every(id =>
        getComputedStyle(document.getElementById(id)).marginTop === value), value, { timeout: 8000 });
    }
    async function wrapperOpacity(value) {
      await page.waitForFunction(value => getComputedStyle(document.getElementById('native-wrapper')).opacity === value, value, { timeout: 8000 });
    }
    await wrapperOpacity('1');
    await page.evaluate(() => document.getElementById('native-choice').disabled = true);
    await wrapperOpacity('0.5');
    await page.evaluate(() => document.getElementById('native-choice').disabled = false);
    await wrapperOpacity('1');
    async function inputPadding(property, value) {
      try {
        await page.waitForFunction(({property,value}) => getComputedStyle(document.getElementById('group-input'))[property] === value,
          {property,value}, {timeout:8000});
      } catch (error) {
        console.error('InputGroup fallback', property, value, await page.evaluate(() => ['input-group','input-addon','group-input'].map(id => {
          const node=document.getElementById(id);return [id,node?.getAttributeNames(),node?.getAttribute('data-align'),node && getComputedStyle(node).padding];
        })));
        throw error;
      }
    }
    await inputPadding('paddingLeft', '8px');
    await page.evaluate(() => document.getElementById('input-addon').setAttribute('data-align', 'inline-end'));
    await inputPadding('paddingLeft', '12px');
    await inputPadding('paddingRight', '8px');
    await page.evaluate(() => document.getElementById('input-addon').remove());
    await inputPadding('paddingRight', '12px');
    await expect(['row', 'flex-start', true, true], ['column', 'normal', false, false]);
    await margins('1px');
    await page.evaluate(() => document.getElementById('outer-content').removeAttribute('data-slot'));
    await margins('0px');
    await expect(['row', 'center', true, false], ['column', 'normal', false, false]);
    await page.evaluate(() => {
      document.getElementById('outer').style.width = '400px';
      document.getElementById('inner').style.width = '500px';
    });
    await expect(['column', 'normal', false, false], ['row', 'flex-start', true, true]);
    await page.evaluate(() => document.getElementById('outer-content').setAttribute('data-slot', 'field-content'));
    await margins('0px');
    await page.evaluate(() => {
      document.getElementById('inner').outerHTML = `<div id="inner" class="@container/field-group" style="width:500px"><div id="inner-field" class="flex flex-col @md/field-group:flex-row @md/field-group:items-center @md/field-group:has-[>[data-slot=field-content]]:items-start"><span id="inner-content">No content</span></div></div>`;
    });
    await expect(['column', 'normal', false, false], ['row', 'center', true, false]);
    await page.evaluate(() => document.getElementById('inner-content').setAttribute('data-slot', 'field-content'));
    await expect(['column', 'normal', false, false], ['row', 'flex-start', true, true]);
    await page.evaluate(() => document.getElementById('outer').style.width = '500px');
    await margins('1px');
    assert.deepEqual(errors, []);
    console.log(`${head} actual preview combined fallback: ${containers} native containers, ${fallbacks} scoped fallbacks, ${has} native-has rules stripped; child/removal/resize/fragment/data-slot/disabled NativeSelectWrapper and InputGroup addon alignment PASS (Chromium only)`);
  } finally { await browser.close(); }
}
if (require.main === module) {
  if (process.argv.length !== 4) { console.error('usage: node tools/preview-combined-fallback-browser.cjs <chromium.exe> <web|maui|portal|pos>'); process.exitCode = 2; }
  else run(process.argv[2], process.argv[3]).catch(error => { console.error(error); process.exitCode = 1; });
}
module.exports = { run };
