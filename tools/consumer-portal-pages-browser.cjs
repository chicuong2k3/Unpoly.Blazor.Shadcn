#!/usr/bin/env node
// Diagnostic only. Compare real PUBLIC Portal pages while intercepting CSS into
// the browser; never change the Portal build, live assets, database or payment.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { chromium } = require('playwright-core');
const sharp = require('sharp');
const root = path.resolve(__dirname, '../../..');
const url = process.argv[2], executablePath = process.argv[3];
const noJs = process.argv[4] === '--no-js' || process.argv[4] === '--host-preview-no-js';
const hostPreview = process.argv[4] === '--host-preview' || process.argv[4] === '--host-preview-no-js';
if (process.argv[4] && !['--no-js', '--host-preview', '--host-preview-no-js'].includes(process.argv[4]))
  throw Error('Unsupported Portal probe mode');
if (!/^http:\/\/127\.0\.0\.1:\d+\/?$/.test(url || '') || !executablePath)
  throw Error('usage: consumer-portal-pages-browser.cjs http://127.0.0.1:PORT/ <chromium.exe>');
const v3 = fs.readFileSync(path.join(os.tmpdir(), 'shadcn-portal-tailwind3-probe.css'), 'utf8');
const brand = fs.readFileSync(path.join(os.tmpdir(), 'shadcn-portal-brand-v3-probe.css'), 'utf8');
const site = fs.readFileSync(path.join(os.tmpdir(), 'shadcn-portal-site-v3-probe.css'), 'utf8');
const routes = ['/', '/pricing', '/pricing?period=yearly', '/download', '/contact', '/guides/install', '/account?plan=lite'];
(async () => {
  const browser = await chromium.launch({ executablePath, headless: true });
  try {
    for (const width of [390, 1280]) for (const route of routes) {
      const output = [];
      for (const candidate of [false, true]) {
        const context = await browser.newContext({ viewport: { width, height: 900 }, deviceScaleFactor: 1, javaScriptEnabled: !noJs });
        if (hostPreview && noJs && !candidate) {
          // Keep real v4 CSS URLs: replacing only the CSS response body under a
          // v3 URL changes v4's layer/custom-property cascade and is NOT parity.
          await context.route('**/*', async req => {
            if (!req.request().isNavigationRequest() || req.request().resourceType() !== 'document') return req.continue();
            const response = await req.fetch();
            let html = await response.text();
            for (const name of ['app', 'brand', 'portal-site']) {
              const before = `href="${name}.v3.css"`;
              assert.ok(html.includes(before), `SSR ${name} preview link`);
              html = html.replace(before, `href="${name}.css"`);
            }
            await req.fulfill({ response, body: html });
          });
        }
        if (candidate && !hostPreview) {
          await context.route(/\/app\.css(?:\?.*)?$/, req => req.fulfill({ contentType: 'text/css', body: v3 }));
          await context.route(/\/brand\.css(?:\?.*)?$/, req => req.fulfill({ contentType: 'text/css', body: brand }));
          await context.route(/\/portal-site\.css(?:\?.*)?$/, req => req.fulfill({ contentType: 'text/css', body: site }));
        }
        const page = await context.newPage(), errors = [];
        page.on('pageerror', error => errors.push(error.message));
        try {
          const target = new URL(route, url);
          if (hostPreview && !noJs) target.searchParams.set('portal-css', candidate ? 'v3' : 'v4');
          const response = await page.goto(target.href, { waitUntil: 'domcontentloaded', timeout: 30000 });
          if (hostPreview) {
            try {
              const ready = async () => page.evaluate(expected => {
                const links = ['portal-app-css', 'portal-brand-css', 'portal-site-css'].map(id => document.getElementById(id));
                return links.every(link => !!link?.sheet) && links[0].sheet.cssRules.length > 100 &&
                  links[2].sheet.cssRules.length > 10 && links[0].getAttribute('href') === expected;
              }, candidate ? 'app.v3.css' : 'app.css');
              if (noJs) {
                let loaded = false;
                for (let attempt = 0; attempt < 80 && !(loaded = await ready()); attempt++) await page.waitForTimeout(150);
                assert.ok(loaded, 'Portal SSR preview styles loaded');
              } else {
                await page.waitForFunction(expected => {
                  const links = ['portal-app-css', 'portal-brand-css', 'portal-site-css'].map(id => document.getElementById(id));
                  return links.every(link => !!link?.sheet) && links[0].sheet.cssRules.length > 100 &&
                    links[2].sheet.cssRules.length > 10 && links[0].getAttribute('href') === expected;
                }, candidate ? 'app.v3.css' : 'app.css', { timeout: 12000 });
              }
            } catch (error) {
              console.error('Portal host CSS links:', await page.evaluate(() =>
                ['portal-app-css', 'portal-brand-css', 'portal-site-css'].map(id => {
                  const link = document.getElementById(id);
                  return [id, link?.getAttribute('href'), link?.sheet?.cssRules?.length];
                })), 'page errors:', errors);
              throw error;
            }
            for (const asset of (candidate ? ['app.v3.css', 'brand.v3.css', 'portal-site.v3.css'] : ['app.css', 'brand.css', 'portal-site.css'])) {
              assert.equal((await page.request.get(new URL(asset, url).href)).status(), 200, `${asset} served`);
            }
          }
          assert.equal(response?.status(), 200, `${route} HTTP status`);
          if (!hostPreview) assert.equal(await page.locator('script[src="portal-v3-preview.js"]').count(), 0, 'default host cannot opt into preview CSS');
          await page.locator('h1').first().waitFor({ state: 'visible', timeout: 15000 });
          await page.evaluate(() => document.fonts.ready);
          if (route === '/account?plan=lite') {
            await page.getByRole('status', { name: '' }).filter({ hasText: 'Gói đã chọn: ORKOI Lite' }).first().waitFor({ state: 'visible' });
            assert.equal(await page.locator('form[action="/account/subscribe"]').count(), 0, 'pilot-disabled guest cannot create checkout');
          }
          if (route === '/pricing?period=yearly') {
            const monthly = page.getByRole('link', { name: 'Theo tháng', exact: true });
            const yearly = page.getByRole('link', { name: 'Theo năm', exact: true });
            assert.equal(await yearly.getAttribute('aria-current'), 'page', 'direct yearly navigation');
            const prices = page.locator('.portal-plans .portal-plan-price');
            await prices.first().waitFor({ state: 'visible' });
            const initialYearlyPrices = await prices.allTextContents();
            assert.ok(initialYearlyPrices.length > 0 && initialYearlyPrices.every(price => price.includes('/ năm')), `yearly plan values rendered: ${JSON.stringify(initialYearlyPrices)}`);
            await monthly.click();
            await page.waitForURL(/\/pricing\?period=monthly$/);
            assert.equal(await monthly.getAttribute('aria-current'), 'page', 'monthly selection');
            if (hostPreview) assert.equal(await page.locator('#portal-app-css').getAttribute('href'), candidate ? 'app.v3.css' : 'app.css', 'preview selection survives navigation');
            const monthlyPrices = await prices.allTextContents();
            assert.equal(monthlyPrices.length, initialYearlyPrices.length, 'same plan inventory');
            assert.ok(monthlyPrices.every(price => price.includes('/ tháng')), 'monthly plan values rendered');
            assert.notDeepEqual(monthlyPrices, initialYearlyPrices, 'period changes downstream prices');
            await yearly.click();
            await page.waitForURL(/\/pricing\?period=yearly$/);
            assert.equal(await yearly.getAttribute('aria-current'), 'page', 'yearly selection restored');
            if (hostPreview) assert.equal(await page.locator('#portal-app-css').getAttribute('href'), candidate ? 'app.v3.css' : 'app.css', 'preview selection survives repeat navigation');
            assert.deepEqual(await prices.allTextContents(), initialYearlyPrices, 'yearly prices restored');
            await page.evaluate(() => document.fonts.ready);
          }
          assert.equal(await page.locator('#blazor-error-ui:visible').count(), 0, `${route} Blazor error`);
          assert.deepEqual(errors, [], `${route} page errors`);
          const layout = await page.evaluate(() => {
            const rect = node => { const r = node.getBoundingClientRect(); return [r.x, r.y, r.width, r.height].map(v => Math.round(v * 10) / 10); };
            return ['header', 'h1', 'main', 'footer'].map(selector => {
              const node = document.querySelector(selector); return node ? [selector, rect(node)] : null;
            });
          });
          const image = await page.screenshot({ fullPage: false, animations: 'disabled' });
          const sections = await page.evaluate(() => [...document.querySelectorAll('main section, .portal-landing-copy, .portal-terminal, .portal-landing-points, .portal-landing-actions, .portal-landing-points *, [data-slot="card"] *')].map(node => {
            const r = node.getBoundingClientRect(), s = getComputedStyle(node);
            return [node.className || node.tagName, Math.round(r.y * 10) / 10, Math.round(r.height * 10) / 10, s.fontSize, s.lineHeight, s.padding, s.gap];
          }));
          const navigation = await page.evaluate(() => [...document.querySelectorAll('.portal-navigation a')].map(node => {
            const s = getComputedStyle(node); return [node.textContent.trim(), node.className, s.color, s.backgroundColor, s.fontWeight];
          }));
          const controls = await page.evaluate(() => [...document.querySelectorAll('[data-slot="button"]:disabled')].map(node => {
            const s = getComputedStyle(node), body = getComputedStyle(document.body);
            return [s.backgroundColor, s.color, body.getPropertyValue('--color-muted'), body.getPropertyValue('--muted')];
          }));
          output.push({ layout, sections, controls, navigation, image });
        } finally { await context.close(); }
      }
      if (JSON.stringify(output[1].layout) !== JSON.stringify(output[0].layout)) {
        console.error('Layout v4', output[0].layout, output[0].sections);
        console.error('Layout v3', output[1].layout, output[1].sections);
        throw Error(`${route} ${width}px layout mismatch`);
      }
      const a = await sharp(output[0].image).removeAlpha().raw().toBuffer({ resolveWithObject: true });
      const b = await sharp(output[1].image).removeAlpha().raw().toBuffer({ resolveWithObject: true });
      assert.deepEqual(b.info, a.info, `${route} ${width}px image geometry`);
      let pixels = 0, peak = 0;
      for (let i = 0; i < a.data.length; i += 3) {
        const delta = Math.max(...[0, 1, 2].map(k => Math.abs(a.data[i+k] - b.data[i+k])));
        if (delta > 2) pixels++;
        peak = Math.max(peak, delta);
      }
      const percent = pixels * 100 / (a.info.width * a.info.height);
      console.log(`${hostPreview ? noJs ? 'host-preview no-JS ' : 'host-preview ' : noJs ? 'no-JS ' : ''}${route} ${width}px: ${percent.toFixed(2)}% pixels differ >2/channel, peak ${peak}`);
      if (percent > 0.5) {
        console.error('Disabled controls v4/v3', output[0].controls, output[1].controls);
        console.error('Navigation v4/v3', output[0].navigation, output[1].navigation);
        const label = route === '/' ? 'home' : route.slice(1).replaceAll(/[/?=]/g, '-');
        for (let i = 0; i < 2; i++) fs.writeFileSync(path.join(os.tmpdir(), `portal-${label}-${width}-${i ? 'v3' : 'v4'}.png`), output[i].image);
        throw Error(`${route} ${width}px visual parity exceeds 0.5%`);
      }
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
