#!/usr/bin/env node
// Isolated CSS parity diagnostic for the real Input.razor Base classes.
// node tools/input-parity-browser.cjs <chromium.exe> <web|maui>
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright-core');
const { compare } = require('./button-paint-parity-browser.cjs');
const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'src/Unpoly.Blazor.Shadcn/Components/Input.razor'), 'utf8');
const match = source.match(/const string Base\s*=([\s\S]*?);/);
if (!match) throw new Error('Input.razor Base recipe missing');
const classes = [...match[1].matchAll(/"([^"\r\n]+)"/g)].map(x => x[1]).join(' ');
const properties = ['display', 'width', 'height', 'paddingTop', 'paddingRight', 'fontSize', 'fontWeight',
  'color', 'backgroundColor', 'borderColor', 'borderWidth', 'borderRadius', 'boxShadow',
  'outlineStyle', 'outlineWidth', 'opacity', 'pointerEvents', 'cursor'];
async function run(executablePath, head) {
  if (!['web', 'maui'].includes(head)) throw new Error('head must be web or maui');
  const dir = path.join(root, 'demo', `Unpoly.Blazor.Shadcn.${head === 'web' ? 'Demo' : 'Maui'}`, 'wwwroot');
  const browser = await chromium.launch({ executablePath, headless: true });
  try {
    const pages = [];
    for (const file of ['app.css', 'app.v3.css']) {
      const page = await browser.newPage({ viewport: { width: 300, height: 110 }, deviceScaleFactor: 1 });
      await page.setContent('<input id="probe" type="text" data-slot="input" placeholder="Enter a name">');
      await page.addStyleTag({ content: fs.readFileSync(path.join(dir, file), 'utf8') });
      await page.addStyleTag({ content: '#probe { position: absolute; left: 30px; top: 35px; width: 230px; transition: none !important; animation: none !important } body { background: white } .dark body { background: #171717 }' });
      pages.push(page);
    }
    const differences = [];
    let maxPixelDelta = 0, pixelStates = 0;
    for (const dark of [false, true]) for (const value of ['', 'Hello']) for (const state of ['base', 'focus', 'invalid', 'disabled']) {
      const samples = [], images = [];
      for (const page of pages) {
        await page.evaluate(({ dark, value, state, classes }) => {
          document.documentElement.classList.toggle('dark', dark);
          const input = document.getElementById('probe');
          input.className = classes; input.value = value; input.disabled = state === 'disabled';
          if (state === 'invalid') input.setAttribute('aria-invalid', 'true');
          else input.removeAttribute('aria-invalid');
          input.blur();
        }, { dark, value, state, classes });
        if (state === 'focus') {
          await page.keyboard.press('Tab');
          if (!await page.locator('#probe').evaluate(el => el.matches(':focus-visible'))) await page.locator('#probe').focus();
          if (!await page.locator('#probe').evaluate(el => el.matches(':focus-visible'))) throw new Error('Focus-visible inactive');
        }
        const sample = await page.locator('#probe').evaluate((el, props) => {
          const css = getComputedStyle(el), placeholder = getComputedStyle(el, '::placeholder');
          return Object.fromEntries([...props.map(p => [p, css[p]]), ['placeholderColor', placeholder.color]]);
        }, properties);
        samples.push(sample);
        images.push((await page.screenshot()).toString('base64'));
      }
      const label = `${dark ? 'dark' : 'light'}/${value ? 'value' : 'placeholder'}/${state}`;
      for (const prop of [...properties, 'placeholderColor']) if (samples[0][prop] !== samples[1][prop])
        differences.push(`${label} ${prop}: v4=${samples[0][prop]} v3=${samples[1][prop]}`);
      const pixels = await compare(pages[0], images);
      if (pixels.pixels) { pixelStates++; differences.push(`${label} screenshot: ${pixels.pixels} pixels >2/channel, peak ${pixels.peak}`); }
      maxPixelDelta = Math.max(maxPixelDelta, pixels.peak);
    }
    const controlBefore = (await pages[1].screenshot()).toString('base64');
    await pages[1].addStyleTag({ content: '#probe { border: 8px solid red !important }' });
    const controlAfter = (await pages[1].screenshot()).toString('base64');
    const control = await compare(pages[0], [controlBefore, controlAfter]);
    if (control.pixels < 30) throw new Error(`Pixel comparison failed positive border control: ${JSON.stringify(control)}`);
    console.log(`${head}: 16 Input state pairs, 19 computed properties + screenshot; ${differences.length} raw differences, ${pixelStates} pixel states, max pixel channel delta ${maxPixelDelta}; positive border control ${control.pixels} pixels`);
    for (const diff of differences.slice(0, 35)) console.log(diff);
    if (differences.length) process.exitCode = 1;
  } finally { await browser.close(); }
}
if (require.main === module) {
  if (process.argv.length !== 4) { console.error('usage: <chromium.exe> <web|maui>'); process.exitCode = 2; }
  else run(process.argv[2], process.argv[3]).catch(error => { console.error(error); process.exitCode = 1; });
}
module.exports = { run };
