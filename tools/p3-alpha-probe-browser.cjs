#!/usr/bin/env node
// Unwired feasibility probe, NOT Safari evidence. Tests whether raw OKLCH ->
// display-p3 channels with alpha can reproduce modern OKLab mixing when a
// theme token is outside sRGB; NEVER replace the shipped rgba fallback with
// this on the strength of Chromium alone.
// node tools/p3-alpha-probe-browser.cjs <chromium.exe> <web|maui>
const fs = require('node:fs');
const path = require('node:path');
const { parse, converter } = require('culori');
const { chromium } = require('playwright-core');
const { themes } = require('./theme-button-parity-browser.cjs');
const p3 = converter('p3');
const root = path.resolve(__dirname, '..');

async function run(executablePath, head) {
  if (!['web', 'maui'].includes(head)) throw new Error('head must be web or maui');
  const sheet = fs.readFileSync(path.join(root, 'demo', `Unpoly.Blazor.Shadcn.${head === 'web' ? 'Demo' : 'Maui'}`, 'wwwroot/app.css'), 'utf8');
  const names = themes(sheet);
  if (names.join() !== 'apple,dracula') throw new Error(`Expected Apple and Dracula in demo CSS, found ${names.join()}`);
  const browser = await chromium.launch({ executablePath, headless: true });
  try {
    const page = await browser.newPage();
    await page.setContent('<div id="probe"></div>');
    await page.addStyleTag({ content: sheet });
    let states = 0, peak = 0;
    const failed = [];
    for (const name of names) for (const dark of [false, true]) {
      const token = await page.evaluate(({ name, dark }) => {
        document.documentElement.dataset.theme = name;
        document.documentElement.classList.toggle('dark', dark);
        return getComputedStyle(document.documentElement).getPropertyValue('--primary').trim();
      }, { name, dark });
      const color = p3(parse(token));
      if (!color || [color.r, color.g, color.b].some(n => !Number.isFinite(n))) throw new Error(`Invalid theme primary: ${name}/${dark}: ${token}`);
      const candidate = `color(display-p3 ${color.r} ${color.g} ${color.b} / 0.9)`;
      const actual = await page.evaluate(({ candidate, token }) => {
        const canvas = document.createElement('canvas'); canvas.width = canvas.height = 1;
        const ctx = canvas.getContext('2d');
        const painted = (value, backdrop) => {
          ctx.clearRect(0, 0, 1, 1);
          ctx.fillStyle = backdrop; ctx.fillRect(0, 0, 1, 1);
          ctx.fillStyle = value; ctx.fillRect(0, 0, 1, 1);
          return [...ctx.getImageData(0, 0, 1, 1).data].slice(0, 3);
        };
        const reference = `color-mix(in oklab, ${token} 90%, transparent)`;
        return ['#000', '#fff'].map(backdrop => ({ backdrop,
          expected: painted(reference, backdrop), candidate: painted(candidate, backdrop) }));
      }, { candidate, token });
      for (const { backdrop, expected, candidate: got } of actual) {
        if (name === 'dracula' && !dark && backdrop === '#000' && (expected[2] !== 238 || got[2] !== 238))
          throw new Error(`Out-of-gamut positive control did not render: ${JSON.stringify({ expected, got })}`);
        const delta = Math.max(...expected.map((n, i) => Math.abs(n - got[i])));
        peak = Math.max(peak, delta);
        if (delta > 2) failed.push({ name, dark, backdrop, token, expected, got, delta });
        states++;
      }
    }
    console.log(`${head}: ${names.length} themes × light/dark × black/white = ${states} samples; ${failed.length} P3 candidate deviations >2/channel, peak ${peak}`);
    for (const failure of failed.slice(0, 16)) console.log(JSON.stringify(failure));
    if (failed.length) process.exitCode = 1;
  } finally { await browser.close(); }
}
if (require.main === module) {
  if (process.argv.length !== 4) { console.error('usage: <chromium.exe> <web|maui>'); process.exitCode = 2; }
  else run(process.argv[2], process.argv[3]).catch(error => { console.error(error); process.exitCode = 1; });
}
module.exports = { run };
