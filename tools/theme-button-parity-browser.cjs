#!/usr/bin/env node
// Diagnostic only: real authored theme selectors + Button recipes, not a Blazor
// component or Safari/MAUI WebView test. Usage: <chromium.exe> <web|maui>.
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright-core');
const { base, option } = require('./cascade-parity-browser.cjs');
const root = path.resolve(__dirname, '..');
const keys = ['color', 'backgroundColor', 'borderColor', 'outlineColor'];
function themes(css) { return [...new Set([...css.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/\[data-theme=["']?([a-z0-9-]+)["']?\]/g)].map(m => m[1]))].sort(); }
async function run(executablePath, head) {
  if (!['web', 'maui'].includes(head)) throw new Error('head must be web or maui');
  const dir = path.join(root, 'demo', `Unpoly.Blazor.Shadcn.${head === 'web' ? 'Demo' : 'Maui'}`, 'wwwroot');
  const css = ['app.css', 'app.v3.css'].map(file => fs.readFileSync(path.join(dir, file), 'utf8'));
  const themeNames = themes(css[0]);
  if (themeNames.join() !== 'apple,dracula' || themeNames.join() !== themes(css[1]).join()) throw new Error('Expected the same two optional demo theme selectors on both stylesheets');
  const browser = await chromium.launch({ executablePath, headless: true });
  try {
    const captures = [];
    for (const stylesheet of css) {
      const page = await browser.newPage();
      try {
        await page.setContent('<button id="probe" type="button">Pay</button>');
        await page.addStyleTag({ content: stylesheet });
        await page.addStyleTag({ content: '#probe { transition: none !important; animation: none !important }' });
        const cdp = await page.context().newCDPSession(page);
        await cdp.send('DOM.enable'); await cdp.send('CSS.enable');
        const { root: domRoot } = await cdp.send('DOM.getDocument');
        const { nodeId } = await cdp.send('DOM.querySelector', { nodeId: domRoot.nodeId, selector: '#probe' });
        const samples = [];
        for (const theme of themeNames) for (const dark of [false, true]) {
          for (const variant of ['default', 'destructive', 'outline', 'secondary', 'ghost', 'link']) {
            for (const state of ['base', 'hover', 'focus']) {
              await page.evaluate(({ theme, dark, classes }) => {
                document.documentElement.dataset.theme = theme;
                document.documentElement.classList.toggle('dark', dark);
                document.querySelector('#probe').className = classes;
              }, { theme, dark, classes: `${base} ${option('ForVariant', variant)} ${option('ForSize', 'default')}` });
              await cdp.send('CSS.forcePseudoState', { nodeId, forcedPseudoClasses: state === 'hover' ? ['hover'] : [] });
              await page.mouse.move(700, 500);
              if (state === 'focus') await page.locator('#probe').focus();
              else await page.locator('#probe').evaluate(el => el.blur());
              samples.push(await page.locator('#probe').evaluate((el, keys) => {
                const style = getComputedStyle(el);
                const canvas = document.createElement('canvas'); canvas.width = canvas.height = 1;
                const ctx = canvas.getContext('2d');
                const paint = (color, backdrop) => {
                  ctx.clearRect(0, 0, 1, 1);
                  ctx.fillStyle = backdrop; ctx.fillRect(0, 0, 1, 1);
                  ctx.fillStyle = color; ctx.fillRect(0, 0, 1, 1);
                  return Array.from(ctx.getImageData(0, 0, 1, 1).data).slice(0, 3);
                };
                return Object.fromEntries(keys.flatMap(key => [
                  [key + '/white', paint(style[key], '#fff')],
                  [key + '/black', paint(style[key], '#000')],
                ]));
              }, keys));
            }
          }
        }
        captures.push(samples);
      } finally { await page.close(); }
    }
    // Prevent a vacuous pass if the data-theme selectors stop applying.
    // Each theme occupies 2 modes × 6 variants × 3 states; the first is
    // the light default Button base background.
    const distinct = new Set(themeNames.map((_, index) => captures[0][index * 36]['backgroundColor/white'].join(',')));
    if (distinct.size !== themeNames.length) throw new Error(`Theme selectors did not apply: only ${distinct.size} distinct primary backgrounds`);
    const mismatches = [];
    let count = 0, peak = 0;
    for (const theme of themeNames) for (const dark of [false, true])
      for (const variant of ['default', 'destructive', 'outline', 'secondary', 'ghost', 'link'])
        for (const state of ['base', 'hover', 'focus']) {
          const a = captures[0][count], b = captures[1][count];
          for (const key of Object.keys(a)) {
            const delta = Math.max(...a[key].map((n, i) => Math.abs(n - b[key][i])));
            peak = Math.max(peak, delta);
            if (delta > 2) mismatches.push({ theme, dark, variant, state, key, v4: a[key], v3: b[key], delta });
          }
          count++;
        }
    console.log(`${head}: ${themeNames.length} themes, ${count} Button state pairs × ${keys.length * 2} composited color channels; ${mismatches.length} differences >2/channel; peak ${peak}`);
    for (const mismatch of mismatches.slice(0, 30)) console.log(JSON.stringify(mismatch));
    if (mismatches.length) process.exitCode = 1;
  } finally { await browser.close(); }
}
if (require.main === module) {
  if (process.argv.length !== 4) { console.error('usage: <chromium.exe> <web|maui>'); process.exitCode = 2; }
  else run(process.argv[2], process.argv[3]).catch(error => { console.error(error); process.exitCode = 1; });
}
module.exports = { themes, run };
