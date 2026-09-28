#!/usr/bin/env node
// Compare real Bubble variant classes from the source in both compiled heads.
// Chromium selector/state parity only; does not certify Safari 15 colors.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { chromium } = require('playwright-core');
const postcss = require('postcss');
const source = fs.readFileSync(path.resolve(__dirname, '../src/Unpoly.Blazor.Shadcn/Components/Bubble.razor'), 'utf8');
const variants = Object.fromEntries([...source.matchAll(/"(destructive|ghost|muted|outline|secondary|tinted)" => "([^"]+)"/g)].map(([, name, classes]) => [name, classes]));
assert.equal(Object.keys(variants).length, 6);
async function run(executablePath, v4File, v3File, forcedRelative = false) {
  const browser = await chromium.launch({ executablePath });
  try {
    const states = [];
    let candidate = fs.readFileSync(v3File, 'utf8');
    if (forcedRelative) {
      const root = postcss.parse(candidate);
      root.walkDecls('background-color', decl => {
        if (decl.parent.selector.includes('bubble-content') && /^(?:oklch\(from var\(--primary\)|color-mix\(in oklch,var\(--)/.test(decl.value)) decl.remove();
      });
      candidate = root.toString();
    }
    for (const css of [fs.readFileSync(v4File, 'utf8'), candidate]) {
      const page = await browser.newPage();
      try {
        await page.setContent(`<style>${css}</style><div id="outer"><button data-slot="bubble-content" id="content">Content</button><span data-slot="bubble-content" id="nested">Nested</span></div>`);
        for (const [name, classes] of Object.entries(variants)) {
          await page.locator('#outer').evaluate((el, value) => { el.className = value; el.removeAttribute('data-slot'); }, classes);
          for (const theme of forcedRelative ? ['', 'apple', 'elevenlabs'] : ['']) {
            await page.evaluate(value => value ? document.documentElement.setAttribute('data-theme', value) : document.documentElement.removeAttribute('data-theme'), theme);
            for (const dark of [false, true]) {
            await page.evaluate(value => document.documentElement.classList.toggle('dark', value), dark);
            for (const parentSlot of [false, true]) {
              await page.locator('#outer').evaluate((el, value) => value ? el.setAttribute('data-slot', 'bubble-content') : el.removeAttribute('data-slot'), parentSlot);
              for (const hover of [false, true]) {
                if (hover) await page.locator('#content').hover();
                else await page.mouse.move(1000, 650);
                states.push({ name, theme, dark, parentSlot, hover, ...await page.evaluate(() => {
                const painted = color => { const canvas = document.createElement('canvas'); canvas.width = canvas.height = 1; const ctx = canvas.getContext('2d'); ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, 1, 1); ctx.fillStyle = color; ctx.fillRect(0, 0, 1, 1); return Array.from(ctx.getImageData(0, 0, 1, 1).data); };
                const read = id => { const css = getComputedStyle(document.getElementById(id)); return { background: painted(css.backgroundColor), color: painted(css.color), border: painted(css.borderColor), rawBackground: css.backgroundColor }; };
                return { content: read('content'), parent: read('outer'), primary: getComputedStyle(document.documentElement).getPropertyValue('--primary').trim(), tint: getComputedStyle(document.documentElement).getPropertyValue('--bubble-tint-light').trim() };
                }) });
              }
            }
          }
          }
        }
      } finally { await page.close(); }
    }
    const half = states.length / 2;
    for (let i = 0; i < half; i++) {
      const expected = states[i], actual = states[i + half];
      assert.deepEqual({name: actual.name, theme: actual.theme, dark: actual.dark, parentSlot: actual.parentSlot, hover: actual.hover}, {name: expected.name, theme: expected.theme, dark: expected.dark, parentSlot: expected.parentSlot, hover: expected.hover});
      for (const id of ['content', 'parent']) for (const property of ['background', 'color', 'border']) {
        for (let channel = 0; channel < 4; channel++) assert.ok(Math.abs(actual[id][property][channel] - expected[id][property][channel]) <= (forcedRelative && ['muted', 'secondary'].includes(expected.name) && expected.hover ? 8 : forcedRelative ? 2 : 2),
          `Bubble ${expected.name} theme=${expected.theme} dark=${expected.dark} hover=${expected.hover} parentSlot=${expected.parentSlot} ${id}.${property}: ${expected[id][property]} vs ${actual[id][property]} primary=${expected.primary}/${actual.primary} fallback=${actual.tint} modern=${expected.content.rawBackground} candidate=${actual.content.rawBackground}`);
      }
    }
    for (let i = 0; i < half; i++) {
      const s = states[i];
      if (s.name === 'tinted') assert.notEqual(s.content.rawBackground, 'rgba(0, 0, 0, 0)', 'tinted Bubble must not be transparent');
    }
    console.log(forcedRelative ? 'Bubble six variants including relative/mix fallbacks match v4 across default/Apple/ElevenLabs, light/dark/hover (forced-legacy Chromium only)' : 'Six Bubble child-slot variants match v4 light/dark and parent state (Chromium only)');
  } finally { await browser.close(); }
}
if (require.main === module) {
  if (![5, 6].includes(process.argv.length) || (process.argv.length === 6 && process.argv[5] !== '--forced-relative')) { console.error('usage: <chromium.exe> <v4.css> <isolated-v3.css> [--forced-relative]'); process.exitCode = 2; }
  else run(...process.argv.slice(2, 5), process.argv[5] === '--forced-relative').catch(e => { console.error(e); process.exitCode = 1; });
}
module.exports = { run };
