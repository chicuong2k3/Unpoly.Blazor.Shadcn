#!/usr/bin/env node
// Opt-in real Web demo v4/v3 Snippet tab-state and rendered-size comparison.
// Does not claim clipboard permission, MAUI WebView, or Safari coverage.
const { chromium } = require('playwright-core');
const base = process.env.BEHAVIOUR_URL || 'http://127.0.0.1:5187';
async function run(executable) {
  const browser = await chromium.launch({ executablePath: executable, headless: true });
  const heads = [];
  try {
    for (const css of ['v4', 'v3']) {
      const context = await browser.newContext();
      try {
        const page = await context.newPage();
        const errors=[];
        page.on('pageerror', e => errors.push(e.message));
        await page.goto(`${base}/components/snippet?demo-css=${css}`, {waitUntil:'domcontentloaded',timeout:25000});
        await page.locator('[data-slot="snippet"] [data-slot="tabs-trigger"][data-value="pnpm"][data-state="active"]').waitFor({timeout:20000});
        const snippet = page.locator('[data-slot="snippet"]');
        const before = await snippet.evaluate(el => ({
          css: document.querySelector('#demo-app-css').getAttribute('href'),
          height: Math.round(el.getBoundingClientRect().height),
          gap: getComputedStyle(el.querySelector('[data-slot="tabs"]')).gap,
          font: getComputedStyle(el.querySelector('[data-slot="tabs-trigger"]')).fontSize,
          shown: [...el.querySelectorAll('[data-slot="tabs-content"]:not([hidden])')].map(n => n.getAttribute('data-value')),
        }));
        if (!before.css.includes(css === 'v3' ? 'app.v3.css' : 'app.css') || before.shown.join() !== 'pnpm') throw Error(`${css}: initial Snippet state ${JSON.stringify(before)}`);
        await snippet.locator('[data-slot="tabs-trigger"][data-value="npm"]').click();
        await page.waitForFunction(() => {
          const el = document.querySelector('[data-slot="snippet"]');
          return el?.querySelector('[data-slot="tabs-content"][data-value="npm"]:not([hidden])') &&
            el.querySelector('[data-slot="tabs-trigger"][data-value="npm"]')?.getAttribute('data-state') === 'active';
        },null,{timeout:15000});
        const after = await snippet.evaluate(el => ({
          shown:[...el.querySelectorAll('[data-slot="tabs-content"]:not([hidden])')].map(n => n.getAttribute('data-value')),
          code:el.querySelector('[data-slot="tabs-content"][data-value="npm"] [data-slot="snippet-copy-value"]')?.textContent?.trim(),
          copyHidden:el.querySelector('[data-slot="snippet-copy"]')?.hidden,
        }));
        if (after.shown.join() !== 'npm' || after.code !== 'npm install unpoly-blazor-shadcn' || errors.length) throw Error(`${css}: Snippet tab ${JSON.stringify({after,errors})}`);
        heads.push({css,before,after});
      } finally { await context.close(); }
    }
    for (const field of ['height','gap','font']) if (heads[0].before[field] !== heads[1].before[field])
      throw Error(`Snippet v4/v3 ${field} mismatch: ${JSON.stringify(heads)}`);
    console.log(JSON.stringify({v4:heads[0],v3:heads[1],result:'Snippet tab and geometry parity passed; clipboard not exercised'},null,2));
  } finally { await browser.close(); }
}
if (require.main === module) run(process.argv[2]).catch(error => { console.error(error); process.exitCode=1; });
