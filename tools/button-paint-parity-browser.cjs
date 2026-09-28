#!/usr/bin/env node
// Opt-in actual pixels, not CSS box-shadow strings. Isolated Button recipe
// fixture only; no app runtime, theme matrix, Safari or MAUI WebView evidence.
// node tools/button-paint-parity-browser.cjs <chromium.exe> <web|maui>
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright-core');
const { base, option } = require('./cascade-parity-browser.cjs');
const root = path.resolve(__dirname, '..');
async function compare(page, images) {
  return page.evaluate(async ([a, b]) => {
    const decode = src => new Promise((resolve, reject) => {
      const img = new Image(); img.onload = () => {
        const canvas = document.createElement('canvas'); canvas.width = img.width; canvas.height = img.height;
        const context = canvas.getContext('2d'); context.drawImage(img, 0, 0);
        resolve(context.getImageData(0, 0, img.width, img.height).data);
      }; img.onerror = reject; img.src = `data:image/png;base64,${src}`;
    });
    const left = await decode(a), right = await decode(b);
    let pixels = 0, peak = 0;
    for (let i = 0; i < left.length; i += 4) {
      const delta = Math.max(...[0, 1, 2, 3].map(c => Math.abs(left[i + c] - right[i + c])));
      if (delta > 2) pixels++;
      peak = Math.max(peak, delta);
    }
    return { pixels, peak };
  }, images);
}
async function run(executablePath, head) {
  if (!['web', 'maui'].includes(head)) throw new Error('head must be web or maui');
  const dir = path.join(root, 'demo', `Unpoly.Blazor.Shadcn.${head === 'web' ? 'Demo' : 'Maui'}`, 'wwwroot');
  const browser = await chromium.launch({ executablePath, headless: true });
  try {
    const pages = [];
    for (const file of ['app.css', 'app.v3.css']) {
      const page = await browser.newPage({ viewport: { width: 240, height: 110 }, deviceScaleFactor: 1 });
      await page.setContent('<button id="probe" type="button">Pay</button>');
      await page.addStyleTag({ content: fs.readFileSync(path.join(dir, file), 'utf8') });
      // Move the same element away from the viewport edges, freeze animations,
      // and use explicit light/dark backdrops to reveal focus-ring differences.
      await page.addStyleTag({ content: '#probe { position: absolute; left: 40px; top: 40px; transition: none !important; animation: none !important } body { background: white } .dark body { background: #171717 }' });
      const cdp = await page.context().newCDPSession(page);
      await cdp.send('DOM.enable'); await cdp.send('CSS.enable');
      const { root: domRoot } = await cdp.send('DOM.getDocument');
      const { nodeId } = await cdp.send('DOM.querySelector', { nodeId: domRoot.nodeId, selector: '#probe' });
      pages.push({ page, cdp, nodeId });
    }
    const failures = [];
    let inspected = 0, worst = { label: '', pixels: 0, peak: 0 };
    for (const variant of ['default', 'destructive', 'outline', 'secondary', 'ghost', 'link']) {
      for (const size of ['default', 'sm', 'lg', 'icon']) {
        for (const dark of [false, true]) {
          for (const state of ['base', 'hover', 'focus', 'disabled', 'invalid']) {
          const images = [];
          for (const { page, cdp, nodeId } of pages) {
            await cdp.send('CSS.forcePseudoState', { nodeId, forcedPseudoClasses: state === 'hover' ? ['hover'] : [] });
            await page.evaluate(({ classes, dark, state }) => {
              document.documentElement.classList.toggle('dark', dark);
              const el = document.getElementById('probe'); el.className = classes;
              el.disabled = state === 'disabled';
              if (state === 'invalid') el.setAttribute('aria-invalid', 'true');
              else el.removeAttribute('aria-invalid');
              el.blur();
            }, { classes: `${base} ${option('ForVariant', variant)} ${option('ForSize', size)}`, dark, state });
            await page.mouse.move(220, 95);
            if (state === 'focus') await page.locator('#probe').focus();
            else await page.locator('#probe').evaluate(el => el.blur());
            if (state === 'focus' && !await page.locator('#probe').evaluate(el => el.matches(':focus-visible'))) throw new Error(`Focus-visible not active: ${variant}`);
            images.push((await page.screenshot()).toString('base64'));
          }
          const result = await compare(pages[0].page, images);
          const label = `${variant}/${size}/${dark ? 'dark' : 'light'}/${state}`;
          if (result.pixels > worst.pixels || (result.pixels === worst.pixels && result.peak > worst.peak)) worst = { label, ...result };
          if (result.pixels) failures.push(`${label}: ${result.pixels} pixels >2/channel, peak ${result.peak}`);
          inspected++;
          }
        }
      }
    }
    const controlBefore = (await pages[1].page.screenshot()).toString('base64');
    await pages[1].page.addStyleTag({ content: '#probe { box-shadow: 0 0 0 12px red !important }' });
    const controlAfter = (await pages[1].page.screenshot()).toString('base64');
    const control = await compare(pages[0].page, [controlBefore, controlAfter]);
    if (control.pixels < 30) throw new Error(`Pixel comparison failed positive shadow control: ${JSON.stringify(control)}`);
    console.log(`${head}: ${inspected} Button screenshot state pairs, 240×110 px each; ${failures.length} differ (>2/channel); worst ${JSON.stringify(worst)}; positive shadow control ${control.pixels} pixels`);
    for (const line of failures.slice(0, 25)) console.log(line);
    if (failures.length) process.exitCode = 1;
  } finally { await browser.close(); }
}
if (require.main === module) {
  if (process.argv.length !== 4) { console.error('usage: <chromium.exe> <web|maui>'); process.exitCode = 2; }
  else run(process.argv[2], process.argv[3]).catch(error => { console.error(error); process.exitCode = 1; });
}
module.exports = { run, compare };
