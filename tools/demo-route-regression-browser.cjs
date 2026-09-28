#!/usr/bin/env node
// Structural Web demo regression across every @page component route, not a
// per-component interaction/paint parity assertion. Requires an opt-in Web build.
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright-core');
const pages = path.resolve(__dirname, '../demo/Unpoly.Blazor.Shadcn.Demo/Components/Pages');
const base = process.env.BEHAVIOUR_URL || 'http://127.0.0.1:5187';
const standalone = { '/components/image-crop': 'image-crop', '/components/snippet': 'snippet', '/components/video-player': 'video-player' };
function pageHeadings(pagesDir = pages) {
  const headings = {};
  for (const file of fs.readdirSync(pagesDir).filter(f => f.endsWith('.razor'))) {
    const text = fs.readFileSync(path.join(pagesDir, file), 'utf8');
    const route = text.match(/^@page "(\/components\/[^"]+)"/m)?.[1];
    if (!route) continue;
    const heading = text.match(/<h1 class="doc-h1">([^<]+)<\/h1>/)?.[1];
    if (!heading || headings[route]) throw Error(`Missing or duplicate static component heading: ${file}`);
    headings[route] = heading.trim();
  }
  return headings;
}
function componentRoutes() {
  const routes = fs.readdirSync(pages).filter(f => f.endsWith('.razor'))
    .flatMap(f => [...fs.readFileSync(path.join(pages, f), 'utf8').matchAll(/^@page "(\/components\/[^"]+)"/gm)].map(m => m[1]));
  if (routes.length < 70 || routes.length !== new Set(routes).size) throw Error('Component route manifest missing or duplicated');
  return routes.sort();
}
async function inspect(browser, route, css) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  try {
    const response = await page.goto(`${base}${route}?demo-css=${css}`, { waitUntil: 'domcontentloaded', timeout: 20000 });
    if (response.status() !== 200) throw Error(`HTTP ${response.status()}`);
    await page.locator(`link[data-demo-css="${css}"]`).waitFor({ state: 'attached', timeout: 10000 });
    const sheet = `app${css === 'v3' ? '.v3' : ''}.css`;
    await page.waitForFunction(sheet => [...document.styleSheets].some(s => s.href && new URL(s.href).pathname.endsWith('/' + sheet) && (() => { try { return s.cssRules.length > 100; } catch { return false; } })()), sheet, { timeout: 12000 });
    // Wait for interactive Blazor rendering before checking examples.
    await page.locator('h1.doc-h1').waitFor({ state: 'visible', timeout: 12000 });
    const state = await page.evaluate(() => {
      const previews = [...document.querySelectorAll('[id^="preview-"]')];
      return { heading: document.querySelector('h1.doc-h1')?.textContent.trim(),
        previews: previews.map(el => ({ id: el.id, width: Math.round(el.previousElementSibling?.getBoundingClientRect().width ?? 0),
          height: Math.round(el.previousElementSibling?.getBoundingClientRect().height ?? 0) })) };
    });
    // Data Table is explicitly a guide to the /blocks example, not an Example host.
    if (route === '/components/data-table') {
      if (state.previews.length || await page.locator('p.doc-lede a[href="/blocks"]').count() !== 1)
        throw Error(`Data Table guide changed: ${JSON.stringify(state)}`);
    } else if (standalone[route]) {
      if (state.previews.length) throw Error(`Unexpected Example wrapper on ${route}`);
      const root = page.locator(`main [data-slot="${standalone[route]}"]`);
      if (await root.count() !== 1) throw Error(`Standalone ${standalone[route]} not mounted once`);
      const size = await root.evaluate(el => ({ width: Math.round(el.getBoundingClientRect().width), height: Math.round(el.getBoundingClientRect().height) }));
      if (!size.width || !size.height) throw Error(`Standalone ${standalone[route]} not rendered: ${JSON.stringify(size)}`);
      state.previews = [{ id: `standalone-${standalone[route]}`, ...size }];
    } else if (!state.previews.length || state.previews.some(p => !p.width || !p.height))
      throw Error(`No visible preview: ${JSON.stringify(state)}`);
    if (errors.length) throw Error(`JS: ${errors.join('; ')}`);
    return state;
  } finally { await page.close(); }
}
async function run(executable) {
  const browser = await chromium.launch({ executablePath: executable, headless: true });
  const routes = process.env.DEMO_ROUTE_FILTER ? componentRoutes().filter(route => new RegExp(process.env.DEMO_ROUTE_FILTER).test(route)) : componentRoutes();
  if (!routes.length) throw Error('No component routes matched the requested filter');
  const issues = [];
  try {
    for (const route of routes) {
      const states = {};
      for (const css of ['v4', 'v3']) {
        try { states[css] = await inspect(browser, route, css); }
        catch (error) { issues.push(`${route} ${css}: ${error.message}`); if (issues.length <= 4) console.error(issues.at(-1)); }
      }
      if (states.v4 && states.v3) {
        const a = states.v4, b = states.v3;
        if (a.heading !== b.heading || JSON.stringify(a.previews.map(x => x.id)) !== JSON.stringify(b.previews.map(x => x.id)))
          issues.push(`${route}: heading/example IDs differ: ${JSON.stringify({ v4: a, v3: b })}`);
      }
      console.log(`${route}: ${states.v4?.previews.length ?? 'FAIL'}/${states.v3?.previews.length ?? 'FAIL'} v4/v3 examples`);
    }
  } finally { await browser.close(); }
  if (issues.length) throw Error(`${issues.length} route failures:\n${issues.join('\n')}`);
  console.log(`${routes.length}/${routes.length} component routes loaded v4/v3 with same rendered examples and no page errors`);
}
if (require.main === module) run(process.argv[2]).catch(error => { console.error(error); process.exitCode = 1; });
module.exports = { componentRoutes, standalone, pageHeadings };
