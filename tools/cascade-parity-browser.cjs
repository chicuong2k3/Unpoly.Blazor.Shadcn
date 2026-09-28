#!/usr/bin/env node
// Opt-in diagnostic, NOT a release gate. Compare real ButtonVariants recipes
// across light/dark, hover, focus-visible, disabled and invalid states.
// node tools/cascade-parity-browser.cjs <chromium.exe> <web|maui>
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright-core');
const root = path.resolve(__dirname, '..');
const recipe = fs.readFileSync(path.join(root, 'src/Unpoly.Blazor.Shadcn/ButtonVariants.cs'), 'utf8');
function strings(text) { return [...text.matchAll(/"([^"\r\n]+)"/g)].map(x => x[1]).join(' '); }
const base = strings(recipe.match(/public const string Base\s*=([\s\S]*?);/)[1]);
function option(section, key) {
  const block = recipe.match(new RegExp(`public static string ${section}\\([^)]*\\)[\\s\\S]*?\\{([\\s\\S]*?)\\n    \\};`))[1];
  const clause = key === 'default' ? block.match(/_ => ("[^"]+")/) : block.match(new RegExp(`"${key}" => ("[^"]+")`));
  if (!clause) throw new Error(`Missing ${section}: ${key}`);
  return strings(clause[1]);
}
const properties = ['display', 'width', 'height', 'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft',
  'gap', 'fontSize', 'fontWeight', 'lineHeight', 'color', 'backgroundColor', 'borderColor', 'borderWidth',
  'borderRadius', 'boxShadow', 'outlineColor', 'outlineStyle', 'outlineWidth', 'opacity',
  'pointerEvents', 'transitionDuration'];
async function run(executablePath, head) {
  if (!['web', 'maui'].includes(head)) throw new Error('head must be web or maui');
  const dir = path.join(root, 'demo', `Unpoly.Blazor.Shadcn.${head === 'web' ? 'Demo' : 'Maui'}`, 'wwwroot');
  const browser = await chromium.launch({ executablePath, headless: true });
  try {
    const captures = [];
    for (const file of ['app.css', 'app.v3.css']) {
      const page = await browser.newPage({ viewport: { width: 800, height: 640 } });
      try {
        await page.setContent('<button id="probe" type="button">Pay</button>');
        await page.addStyleTag({ content: fs.readFileSync(path.join(dir, file), 'utf8') });
        // Transition-all interpolates during DOM mutations; sample settled targets.
        await page.addStyleTag({ content: '#probe { transition: none !important; animation: none !important }' });
        const cdp = await page.context().newCDPSession(page);
        await cdp.send('DOM.enable'); await cdp.send('CSS.enable');
        const { root: domRoot } = await cdp.send('DOM.getDocument');
        const { nodeId } = await cdp.send('DOM.querySelector', { nodeId: domRoot.nodeId, selector: '#probe' });
        const rows = [];
        for (const variant of ['default', 'destructive', 'outline', 'secondary', 'ghost', 'link']) {
          for (const size of ['default', 'sm', 'lg', 'icon']) {
            for (const dark of [false, true]) {
              for (const state of ['base', 'hover', 'focus', 'disabled', 'invalid']) {
                await page.evaluate(({ value, dark, state }) => {
                  const button = document.querySelector('#probe');
                  document.documentElement.classList.toggle('dark', dark);
                  button.className = value;
                  button.disabled = state === 'disabled';
                  if (state === 'invalid') button.setAttribute('aria-invalid', 'true');
                  else button.removeAttribute('aria-invalid');
                }, { value: `${base} ${option('ForVariant', variant)} ${option('ForSize', size)}`, dark, state });
                await cdp.send('CSS.forcePseudoState', { nodeId, forcedPseudoClasses: state === 'hover' ? ['hover'] : [] });
                await page.mouse.move(780, 600);
                if (state === 'focus') await page.locator('#probe').focus();
                else await page.locator('#probe').evaluate(el => el.blur());
                // Re-read after the pseudo-class has actually changed.
                const snapshot = await page.locator('#probe').evaluate((el, props) => {
                  const css = getComputedStyle(el);
                  const painted = color => {
                    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 1;
                    const ctx = canvas.getContext('2d'); ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, 1, 1);
                    ctx.fillStyle = color; ctx.fillRect(0, 0, 1, 1);
                    return Array.from(ctx.getImageData(0, 0, 1, 1).data).join(',');
                  };
                  return Object.fromEntries(props.map(prop => [prop,
                    ['color', 'backgroundColor', 'borderColor', 'outlineColor'].includes(prop) ? painted(css[prop]) : css[prop]]));
                }, properties);
                rows.push({ variant, size, dark, state, snapshot });
              }
            }
          }
        }
        captures.push(rows);
      } finally { await page.close(); }
    }
    const differences = [];
    for (let i = 0; i < captures[0].length; i++) {
      const before = captures[0][i], after = captures[1][i];
      for (const prop of properties) if (before.snapshot[prop] !== after.snapshot[prop])
        differences.push(`${before.variant}/${before.size}/${before.dark ? 'dark' : 'light'}/${before.state} ${prop}: v4=${before.snapshot[prop]} v3=${after.snapshot[prop]}`);
    }
    console.log(`${head}: ${captures[0].length} Button recipe states × ${properties.length} computed properties; ${differences.length} differences`);
    const counts = Object.fromEntries(properties.map(prop => [prop, 0]));
    for (let i = 0; i < captures[0].length; i++) for (const prop of properties)
      if (captures[0][i].snapshot[prop] !== captures[1][i].snapshot[prop]) counts[prop]++;
    console.log('Mismatched states by property:', Object.fromEntries(Object.entries(counts).filter(([, n]) => n)));
    for (const prop of ['backgroundColor', 'borderColor', 'boxShadow']) {
      const sample = differences.filter(diff => diff.includes(` ${prop}:`));
      for (const diff of sample.slice(0, prop === 'backgroundColor' ? 24 : 8)) console.log(diff);
      if (sample.length > 8) console.log(`... ${sample.length - 8} more ${prop} differences`);
    }
    if (differences.length) process.exitCode = 1;
  } finally { await browser.close(); }
}
if (require.main === module) {
  if (process.argv.length !== 4) { console.error('usage: <chromium.exe> <web|maui>'); process.exitCode = 2; }
  else run(process.argv[2], process.argv[3]).catch(error => { console.error(error); process.exitCode = 1; });
}
module.exports = { run, base, option };
