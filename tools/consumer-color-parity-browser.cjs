#!/usr/bin/env node
// Diagnostic synthetic fixtures only; no Blazor/Portal/POS runtime or Safari evidence.
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { chromium } = require('playwright-core');
const postcss = require('postcss');
const root = path.resolve(__dirname, '../../..');
const app = process.argv[2];
const executablePath = process.argv[3];
if (!['portal', 'pos'].includes(app) || !executablePath) throw Error('usage: consumer-color-parity-browser.cjs <portal|pos> <chromium.exe>');
const cssPath = app === 'portal' ? 'src/Pos.Portal.Web/wwwroot/app.css' : 'src/Pos.App/wwwroot/app.css';
const candidates = [
  [fs.readFileSync(path.join(root, cssPath), 'utf8'), fs.readFileSync(path.join(root, 'src/Pos.App/wwwroot/brand.css'), 'utf8')],
  [fs.readFileSync(path.join(os.tmpdir(), `shadcn-${app}-tailwind3-probe.css`), 'utf8'), fs.readFileSync(path.join(os.tmpdir(), `shadcn-${app}-brand-v3-probe.css`), 'utf8')],
];
// Only classes present in the consumer Razor sources and compiled v4 baseline.
// Do not safelist synthetic POS waiter-script classes into a Portal comparison.
const utilities = ['bg-primary', 'text-primary', 'bg-primary/10', 'border-positive/20',
  'border-warning/20', 'bg-positive-light', 'text-positive-text', 'bg-card', 'text-foreground'];
for (const [index, [css]] of candidates.entries()) {
  const selectors = new Set();
  postcss.parse(css).walkRules(rule => selectors.add(rule.selector));
  for (const name of utilities) {
    const escaped = `.${name.replace(/[^a-zA-Z0-9_-]/g, char => `\\${char}`)}`;
    if (![...selectors].some(selector => selector.includes(escaped)))
      throw Error(`${index ? 'v3 candidate' : 'v4 baseline'} missing sampled class ${name}`);
  }
}
(async () => {
  const browser = await chromium.launch({ executablePath, headless: true });
  try {
    const results = [];
    for (const [css, brand] of candidates) {
      const page = await browser.newPage();
      await page.setContent('<main id="samples"></main>');
      await page.addStyleTag({ content: css });
      await page.addStyleTag({ content: brand });
      results.push(await page.evaluate(classes => {
        const main = document.querySelector('#samples');
        return classes.map(name => {
          const element = document.createElement('div');
          element.className = name;
          main.append(element);
          const s = getComputedStyle(element);
          return { name, background: s.backgroundColor, color: s.color, border: s.borderColor };
        });
      }, utilities));
      await page.close();
    }
    const mismatches = [];
    for (let i = 0; i < utilities.length; i++) {
      for (const key of ['background', 'color', 'border']) {
        if (results[0][i][key] !== results[1][i][key]) mismatches.push({ class: utilities[i], property: key, v4: results[0][i][key], v3: results[1][i][key] });
      }
    }
    console.log(JSON.stringify({ app, checked: utilities.length, mismatches }, null, 2));
    if (mismatches.length) process.exitCode = 1;
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 2; });
