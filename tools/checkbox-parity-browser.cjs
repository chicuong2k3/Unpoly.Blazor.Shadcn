#!/usr/bin/env node
// Isolated CSS fixture for the real Checkbox.razor recipe + ui.behavior.css.
// Not Blazor events, Safari 15, or MAUI WebView evidence.
// node tools/checkbox-parity-browser.cjs <chromium.exe> <web|maui>
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright-core');
const { compare } = require('./button-paint-parity-browser.cjs');
const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'src/Unpoly.Blazor.Shadcn/Components/Checkbox.razor'), 'utf8');
const match = source.match(/const string Base\s*=([\s\S]*?);/);
if (!match) throw new Error('Checkbox Base recipe missing');
const classes = [...match[1].matchAll(/"([^"\r\n]+)"/g)].map(x => x[1]).join(' ');
async function run(executablePath, head) {
  if (!['web', 'maui'].includes(head)) throw new Error('head must be web or maui');
  const dir = path.join(root, 'demo', `Unpoly.Blazor.Shadcn.${head === 'web' ? 'Demo' : 'Maui'}`, 'wwwroot');
  const browser = await chromium.launch({ executablePath, headless: true });
  try {
    const pages = [];
    for (const file of ['app.css', 'app.v3.css']) {
      const page = await browser.newPage({ viewport: { width: 130, height: 90 }, deviceScaleFactor: 1 });
      await page.setContent(`<input id="probe" type="checkbox" data-slot="checkbox" aria-label="Example">`);
      await page.addStyleTag({ content: fs.readFileSync(path.join(dir, file), 'utf8') });
      await page.addStyleTag({ content: '#probe { position: absolute; left: 48px; top: 33px; transition: none !important; animation: none !important } #probe::after { transition: none !important } body { background: white } .dark body { background: #171717 }' });
      pages.push(page);
    }
    const failures = [];
    let inspected = 0, peak = 0;
    for (const dark of [false, true]) for (const check of ['empty', 'checked', 'indeterminate'])
      for (const state of ['base', 'focus', 'invalid', 'disabled']) {
        const images = [];
        for (const page of pages) {
          await page.evaluate(({ dark, check, state, classes }) => {
            document.documentElement.classList.toggle('dark', dark);
            const el = document.getElementById('probe');
            el.className = classes;
            el.indeterminate = check === 'indeterminate';
            el.checked = check === 'checked';
            el.disabled = state === 'disabled';
            if (state === 'invalid') el.setAttribute('aria-invalid', 'true');
            else el.removeAttribute('aria-invalid');
            el.blur();
          }, { dark, check, state, classes });
          if (state === 'focus') {
            await page.keyboard.press('Tab');
            if (!await page.locator('#probe').evaluate(el => el.matches(':focus-visible'))) await page.locator('#probe').focus();
            if (!await page.locator('#probe').evaluate(el => el.matches(':focus-visible'))) throw new Error('Checkbox focus-visible not active');
          }
          const sample = await page.locator('#probe').evaluate(el => {
            const css = getComputedStyle(el), after = getComputedStyle(el, '::after');
            return { appearance: css.appearance, display: css.display, width: css.width, height: css.height,
              background: css.backgroundColor, border: css.borderColor, opacity: css.opacity,
              outline: css.outlineStyle, shadow: css.boxShadow, after: after.content,
              scale: after.scale, mask: after.maskImage, fill: after.backgroundColor };
          });
          if (sample.appearance !== 'none' || sample.after !== '""' || sample.mask === 'none' ||
              sample.scale !== (check === 'empty' ? '0' : '1'))
            throw new Error(`Checkbox rule/indicator absent for ${file}: ${JSON.stringify(sample)}`);
          images.push((await page.screenshot()).toString('base64'));
        }
        const result = await compare(pages[0], images);
        peak = Math.max(peak, result.peak);
        const label = `${dark ? 'dark' : 'light'}/${check}/${state}`;
        if (result.pixels) failures.push(`${label}: ${result.pixels} pixels >2/channel, peak ${result.peak}`);
        inspected++;
      }
    // A screenshot diff must be able to detect an intentionally broken border.
    const controlBefore = (await pages[1].screenshot()).toString('base64');
    await pages[1].addStyleTag({ content: '#probe { border: 6px solid red !important }' });
    const controlAfter = (await pages[1].screenshot()).toString('base64');
    const control = await compare(pages[0], [controlBefore, controlAfter]);
    if (control.pixels < 20) throw new Error(`Pixel comparator failed checkbox border control: ${JSON.stringify(control)}`);
    console.log(`${head}: ${inspected} Checkbox screenshot pairs, ${failures.length} differing states (>2/channel), peak ${peak}; positive border control ${control.pixels} pixels`);
    for (const line of failures.slice(0, 24)) console.log(line);
    if (failures.length) process.exitCode = 1;
  } finally { await browser.close(); }
}
if (require.main === module) {
  if (process.argv.length !== 4) { console.error('usage: <chromium.exe> <web|maui>'); process.exitCode = 2; }
  else run(process.argv[2], process.argv[3]).catch(error => { console.error(error); process.exitCode = 1; });
}
module.exports = { run };
