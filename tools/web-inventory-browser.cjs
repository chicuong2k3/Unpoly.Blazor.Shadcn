#!/usr/bin/env node
// Focused real Web-host v4/v3 comparison, not the full Behaviour suite.
// Start Development Web demo with Tailwind3Preview=true first.
const { chromium } = require('playwright-core');
const { checkInventory } = require('./demo-inventory-check.cjs');
const base = process.env.BEHAVIOUR_URL || 'http://127.0.0.1:5187';
(async () => {
  const browser = await chromium.launch({ executablePath: process.argv[2], headless: true });
  try {
    for (const css of ['v4', 'v3']) {
      const page = await browser.newPage();
      const errors = []; page.on('pageerror', e => errors.push(String(e)));
      async function navigate(route) {
        await page.goto(`${base}${route}?demo-css=${css}`);
        await page.locator(`link[data-demo-css="${css}"]`).waitFor({ state: 'attached' });
        await page.waitForFunction(css => [...document.styleSheets].some(s => new URL(s.href || location.href).pathname.endsWith(`/app${css === 'v3' ? '.v3' : ''}.css`) && (() => { try { return s.cssRules.length > 100; } catch { return false; } })()), css);
      }
      await navigate('/components/native-select');
      await checkInventory(page, navigate, css);
      if (errors.length) throw Error(`${css} page errors: ${errors.join('; ')}`);
      await page.close();
    }
    // Compare real demo example pixels, including disabled opacity and the visible
    // indicator, across narrow/wide layouts and both palette modes.
    for (const route of ['native-select', 'select']) {
      const id = route === 'select' ? 'select-item-indicator-example' : 'native-select-wrapper-example';
      for (const width of [390, 1280]) for (const dark of [false, true]) {
        const images = [];
        for (const css of ['v4', 'v3']) {
          const page = await browser.newPage({ viewport: { width, height: 900 }, deviceScaleFactor: 1 });
          await page.goto(`${base}/components/${route}?demo-css=${css}`);
          await page.locator(`link[data-demo-css="${css}"]`).waitFor({ state: 'attached' });
          if (dark) await page.evaluate(() => document.documentElement.classList.add('dark'));
          const box = page.locator(`#preview-${id}`).locator('xpath=preceding-sibling::div[1]');
          images.push((await box.screenshot()).toString('base64'));
          await page.close();
        }
        const page = await browser.newPage();
        const difference = await page.evaluate(async data => {
          const decode = async src => { const image = new Image(); image.src = `data:image/png;base64,${src}`; await image.decode();
            const canvas = document.createElement('canvas'); canvas.width = image.width; canvas.height = image.height;
            const context = canvas.getContext('2d'); context.drawImage(image, 0, 0);
            return { width: image.width, height: image.height, pixels: context.getImageData(0, 0, image.width, image.height).data }; };
          const [a, b] = await Promise.all(data.map(decode));
          if (a.width !== b.width || a.height !== b.height) return { sizes: [a.width, a.height, b.width, b.height] };
          let pixels = 0, peak = 0;
          for (let i = 0; i < a.pixels.length; i += 4) {
            const delta = Math.max(...[0, 1, 2, 3].map(c => Math.abs(a.pixels[i + c] - b.pixels[i + c])));
            if (delta > 2) pixels++;
            peak = Math.max(peak, delta);
          }
          return { pixels, peak };
        }, images);
        await page.close();
        if (difference.pixels !== 0) throw Error(`${route}/${width}/${dark ? 'dark' : 'light'} v4/v3 screenshot mismatch: ${JSON.stringify(difference)}`);
        console.log(`${route}/${width}/${dark ? 'dark' : 'light'}: v4/v3 pixels within 2/channel (peak ${difference.peak})`);
      }
    }
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
