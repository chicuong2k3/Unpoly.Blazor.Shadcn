#!/usr/bin/env node
// Focus and code-block color audit, intentionally forced away from color-mix
// for v3. Chromium is NOT a Safari 15 verification.
const fs = require('node:fs');
const assert = require('node:assert/strict');
const postcss = require('postcss');
const { chromium } = require('playwright-core');
function withoutMix(css) {
  const root = postcss.parse(css);
  root.walkDecls(decl => { if (decl.value.includes('color-mix(')) decl.remove(); });
  return root.toString();
}
async function run(executablePath, v4File, v3File) {
  const browser = await chromium.launch({ executablePath });
  try {
    const results = [];
    for (const css of [fs.readFileSync(v4File, 'utf8'), withoutMix(fs.readFileSync(v3File, 'utf8'))]) {
      const page = await browser.newPage();
      try {
        await page.setContent(`<style>${css}</style><style>:root { --ring: rgba(30, 80, 160, .8); --ring-rgb: 30, 80, 160; --ring-alpha: .8 }</style>
          <div class="ts-wrapper focus"><div class="ts-control">Focus</div></div>
          <div data-slot="code-block-code"><div class="line highlighted" id="highlight">code</div><div class="line diff add" id="add">add</div><div class="line diff remove" id="remove">remove</div><div class="line warning" id="warning">warning</div></div>`);
        for (const state of [false, true]) {
          if (state) await page.evaluate(() => {
            document.documentElement.classList.add('dark');
            document.documentElement.style.setProperty('--ring', 'rgba(170, 130, 60, .6)');
            document.documentElement.style.setProperty('--ring-rgb', '170, 130, 60');
            document.documentElement.style.setProperty('--ring-alpha', '.6');
          });
          results.push(await page.evaluate(() => ({
            colors: Object.fromEntries(['highlight', 'add', 'remove', 'warning'].map(id => [id, getComputedStyle(document.getElementById(id)).backgroundColor])),
            focus: getComputedStyle(document.querySelector('.ts-control')).boxShadow,
            outline: getComputedStyle(document.querySelector('.ts-control')).outlineColor,
          })));
        }
      } finally { await page.close(); }
    }
    for (let state = 0; state < 2; state++) {
      const expected = results[state], actual = results[state + 2];
      assert.deepEqual(actual.colors, expected.colors, 'code block background colors must match v4');
      for (const name of ['highlight', 'add', 'remove', 'warning']) assert.match(actual.colors[name], /rgba?\(/);
      assert.match(actual.focus, /rgba?\(/, 'Safari branch focus ring must be visible');
      assert.match(actual.outline, /rgba?\(/, 'Safari branch outline must be valid');
      // Chromium serializes modern mixes as oklch but legacy as rgba.
      // Compare actual composited pixels, not serialization or raw alpha.
      const pixels = await browser.newPage();
      try {
        for (const key of ['focus', 'outline']) {
          const source = key === 'focus' ? /^(.*) 0px 0px 0px 3px$/.exec(expected[key])?.[1] : expected[key];
          const target = key === 'focus' ? /^(.*) 0px 0px 0px 3px$/.exec(actual[key])?.[1] : actual[key];
          assert.ok(source && target, `${key} geometry/color missing`);
          const [before, after] = await pixels.evaluate(colors => colors.map(color => {
            const canvas = document.createElement('canvas'); canvas.width = canvas.height = 1;
            const ctx = canvas.getContext('2d'); ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, 1, 1);
            ctx.fillStyle = color; ctx.fillRect(0, 0, 1, 1);
            return Array.from(ctx.getImageData(0, 0, 1, 1).data);
          }), [source, target]);
          for (let i = 0; i < 3; i++) assert.ok(Math.abs(before[i] - after[i]) <= 2, `${key} channel ${i}: ${before} vs ${after}`);
        }
      } finally { await pixels.close(); }
    }
    console.log('Static mixes and light/dark ring match v4 (forced-legacy Chromium only)');
  } finally { await browser.close(); }
}
if (require.main === module) {
  if (process.argv.length !== 5) { console.error('usage: <chromium.exe> <v4.css> <isolated-v3.css>'); process.exitCode = 2; }
  else run(...process.argv.slice(2)).catch(e => { console.error(e); process.exitCode = 1; });
}
module.exports = { run };
