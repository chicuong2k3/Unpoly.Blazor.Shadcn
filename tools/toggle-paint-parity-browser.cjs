#!/usr/bin/env node
// CSS-only RadioGroupItem/Switch fixture (actual Razor Base classes and
// ui.behavior.css pseudo-elements). Not a Blazor binding/Safari/WebView test.
// node tools/toggle-paint-parity-browser.cjs <chromium.exe> <web|maui>
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright-core');
const { compare } = require('./button-paint-parity-browser.cjs');
const root = path.resolve(__dirname, '..');
function recipe(component) {
  const source = fs.readFileSync(path.join(root, `src/Unpoly.Blazor.Shadcn/Components/${component}.razor`), 'utf8');
  const match = source.match(/const string Base\s*=([\s\S]*?);/);
  if (!match) throw new Error(`${component} Base recipe missing`);
  return [...match[1].matchAll(/"([^"\r\n]+)"/g)].map(x => x[1]).join(' ');
}
async function run(executablePath, head) {
  if (!['web', 'maui'].includes(head)) throw new Error('head must be web or maui');
  const dir = path.join(root, 'demo', `Unpoly.Blazor.Shadcn.${head === 'web' ? 'Demo' : 'Maui'}`, 'wwwroot');
  const browser = await chromium.launch({ executablePath, headless: true });
  try {
    const pages = [];
    for (const file of ['app.css', 'app.v3.css']) {
      const page = await browser.newPage({ viewport: { width: 130, height: 90 }, deviceScaleFactor: 1 });
      await page.setContent('<input id="probe" aria-label="Example">');
      await page.addStyleTag({ content: fs.readFileSync(path.join(dir, file), 'utf8') });
      await page.addStyleTag({ content: '#probe { position: absolute; left: 48px; top: 33px; transition: none !important; animation: none !important } #probe::after { transition: none !important } body { background: white } .dark body { background: #171717 }' });
      pages.push(page);
    }
    const failures = [];
    let count = 0, peak = 0;
    const visualControls = new Map();
    for (const component of ['RadioGroupItem', 'Switch']) for (const size of component === 'Switch' ? ['default', 'sm'] : ['default'])
      for (const direction of ['ltr', 'rtl']) for (const dark of [false, true])
        for (const checked of [false, true]) for (const state of ['base', 'focus', 'disabled', ...(component === 'RadioGroupItem' ? ['invalid'] : [])]) {
          const images = [], indicators = [];
          for (const page of pages) {
            const indicator = await page.evaluate(({ component, size, direction, dark, checked, state, classes }) => {
              const el = document.getElementById('probe');
              document.documentElement.dir = direction;
              document.documentElement.classList.toggle('dark', dark);
              el.type = component === 'Switch' ? 'checkbox' : 'radio';
              el.dataset.slot = component === 'Switch' ? 'switch' : 'radio-group-item';
              if (component === 'Switch') { el.dataset.size = size; el.setAttribute('role', 'switch'); }
              else { delete el.dataset.size; el.removeAttribute('role'); }
              el.className = classes; el.checked = checked; el.disabled = state === 'disabled';
              if (state === 'invalid') el.setAttribute('aria-invalid', 'true');
              else el.removeAttribute('aria-invalid');
              el.blur();
              const css = getComputedStyle(el), after = getComputedStyle(el, '::after');
              return { appearance: css.appearance, content: after.content, scale: after.scale,
                translate: after.translate, fill: after.backgroundColor, width: css.width };
            }, { component, size, direction, dark, checked, state, classes: recipe(component) });
            if (state === 'focus') {
              await page.keyboard.press('Tab');
              if (!await page.locator('#probe').evaluate(el => el.matches(':focus-visible'))) await page.locator('#probe').focus();
              if (!await page.locator('#probe').evaluate(el => el.matches(':focus-visible'))) throw new Error(`Focus-visible inactive: ${component}`);
            }
            if (indicator.appearance !== 'none' || indicator.content !== '""' ||
                (component === 'RadioGroupItem' && indicator.scale !== (checked ? '1' : '0')))
              throw new Error(`Pseudo-indicator missing: ${component} ${JSON.stringify(indicator)}`);
            indicators.push(indicator);
            images.push((await page.screenshot()).toString('base64'));
          }
          if (component === 'Switch' && checked && state === 'base') {
            const expected = `${direction === 'rtl' ? '-' : ''}${size === 'sm' ? '8px' : '12px'}`;
            if (indicators.some(x => x.translate !== expected))
              throw new Error(`Switch thumb travel ${direction}/${size}: ${JSON.stringify(indicators.map(x => x.translate))} != ${expected}`);
          }
          if (state === 'base' && !dark && size === 'default')
            visualControls.set(`${component}/${direction}/${checked}`, images[0]);
          const result = await compare(pages[0], images);
          peak = Math.max(peak, result.peak);
          if (result.pixels) failures.push(`${component}/${size}/${direction}/${dark ? 'dark' : 'light'}/${checked ? 'on' : 'off'}/${state}: ${result.pixels} pixels, peak ${result.peak}`);
          count++;
        }
    for (const component of ['RadioGroupItem', 'Switch']) {
      const stateChange = await compare(pages[0], [visualControls.get(`${component}/ltr/false`), visualControls.get(`${component}/ltr/true`)]);
      if (stateChange.pixels < 4) throw new Error(`${component} on/off indicator not visibly changing: ${JSON.stringify(stateChange)}`);
    }
    const rtlChange = await compare(pages[0], [visualControls.get('Switch/ltr/true'), visualControls.get('Switch/rtl/true')]);
    if (rtlChange.pixels < 4) throw new Error(`Switch RTL thumb not visibly changing: ${JSON.stringify(rtlChange)}`);
    const before = (await pages[1].screenshot()).toString('base64');
    await pages[1].addStyleTag({ content: '#probe { border: 8px solid red !important }' });
    const after = (await pages[1].screenshot()).toString('base64');
    const control = await compare(pages[0], [before, after]);
    if (control.pixels < 30) throw new Error(`Border mutation not detected: ${JSON.stringify(control)}`);
    console.log(`${head}: ${count} RadioGroupItem/Switch screenshot pairs; ${failures.length} states differ (>2/channel), peak ${peak}; border control ${control.pixels} pixels`);
    for (const failure of failures.slice(0, 24)) console.log(failure);
    if (failures.length) process.exitCode = 1;
  } finally { await browser.close(); }
}
if (require.main === module) {
  if (process.argv.length !== 4) { console.error('usage: <chromium.exe> <web|maui>'); process.exitCode = 2; }
  else run(process.argv[2], process.argv[3]).catch(error => { console.error(error); process.exitCode = 1; });
}
module.exports = { run };
