#!/usr/bin/env node
// Validate server-rendered, JavaScript-disabled first paint for both compiled demo stylesheets.
// Preview currently defaults to v4, so substitute only its stylesheet URL in the response
// for the v3 candidate. This is a diagnostic, not a v3 default-host assertion.
const { chromium } = require('playwright-core');
const { componentRoutes } = require('./demo-route-regression-browser.cjs');
const base = process.env.BEHAVIOUR_URL || 'http://127.0.0.1:5187';
const routes = process.env.DEMO_ROUTE_FILTER
  ? componentRoutes().filter(route => new RegExp(process.env.DEMO_ROUTE_FILTER).test(route))
  : componentRoutes();
async function inspect(browser, route, css) {
  const context = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  try {
    if (css === 'v3') {
      await page.route(`${base}${route}`, async request => {
        const response = await request.fetch();
        const body = (await response.text()).replace(/(id="demo-app-css" rel="stylesheet" href=")app\.css/, '$1app.v3.css');
        if (body === await response.text()) throw Error('Expected exactly one default stylesheet link');
        await request.fulfill({ response, body });
      });
    }
    const response = await page.goto(`${base}${route}`, { waitUntil: 'load', timeout: 30000 });
    if (response.status() !== 200) throw Error(`${route}: HTTP ${response.status()}`);
    const state = await page.evaluate(() => {
      const sheet = document.getElementById('demo-app-css');
      const style = [...document.styleSheets].find(x => x.ownerNode === sheet);
      const previews = [...document.querySelectorAll('[id^="preview-"]')].map(x => x.id);
      const main = document.querySelector('main');
      return { href: new URL(sheet.href).pathname, rules: style?.cssRules.length || 0,
        heading: document.querySelector('h1.doc-h1')?.textContent?.trim(), previews,
        mainWidth: Math.round(main?.getBoundingClientRect().width || 0),
        visible: [...document.querySelectorAll('main [data-slot]')].filter(el => {
          const box = el.getBoundingClientRect();
          return box.width > 0 && box.height > 0;
        }).length };
    });
    // Data Table is an intentional text-only guide linking to /blocks.
    if (route === '/components/data-table' && !await page.locator('main a[href="/blocks"]').count())
      throw Error('Data Table guide link missing');
    if (state.href !== `/app${css === 'v3' ? '.v3' : ''}.css` || state.rules < 500 ||
        !state.heading || state.mainWidth < 300 || (!state.visible && route !== '/components/data-table'))
      throw Error(`${route} ${css} has incomplete first paint: ${JSON.stringify(state)}`);
    return state;
  } finally { await context.close(); }
}
async function run(executable) {
  if (!routes.length) throw Error('No component routes matched the filter');
  const browser = await chromium.launch({ executablePath: executable, headless: true });
  try {
    for (const route of routes) {
      const v4 = await inspect(browser, route, 'v4');
      const v3 = await inspect(browser, route, 'v3');
      if (v4.heading !== v3.heading || JSON.stringify(v4.previews) !== JSON.stringify(v3.previews) ||
          v4.visible !== v3.visible)
        throw Error(`${route}: no-JS rendered roots differ: ${JSON.stringify({v4, v3})}`);
      console.log(`${route}: ${v4.previews.length} previews, ${v4.visible} visible slots under v4/v3 without JS`);
    }
    console.log(`${routes.length}/${routes.length} no-JS server-rendered routes loaded both stylesheets with matching visible slots`);
  } finally { await browser.close(); }
}
if (require.main === module) run(process.argv[2]).catch(error => { console.error(error); process.exitCode = 1; });
module.exports = { inspect };
