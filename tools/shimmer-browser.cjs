#!/usr/bin/env node
// Opt-in Chromium semantic comparison; forced legacy is a simulation, NOT Safari 15.
const fs = require('node:fs');
const assert = require('node:assert/strict');
const postcss = require('postcss');
const { chromium } = require('playwright-core');
const { shimmerCompat, legacy, variants } = require('./postcss-shimmer-compat.cjs');
async function run(executablePath, v4File, v3File) {
  const v4 = fs.readFileSync(v4File, 'utf8');
  const input = fs.readFileSync(v3File, 'utf8');
  const parsed = postcss.parse(input, { from: v3File });
  const bridged = parsed.nodes.filter(node => node.type === 'rule' && node.selector?.startsWith('.shimmer, ') && variants.every(selector => node.selector.includes(selector)));
  if (bridged.length > 1) throw new Error('Duplicate shimmer bridge');
  const v3 = bridged.length ? input : (await postcss([shimmerCompat()]).process(input, { from: v3File })).css;
  if (!v3.includes('not (color: color-mix(in srgb, red, blue))')) throw new Error('Missing legacy shimmer branch');
  // Test-only: force the fallback declaration to win without native color-mix
  // and discard registered property initial values (Safari 15 lacks @property).
  const forced = postcss.parse(v3);
  forced.walkAtRules('supports', rule => { if (rule.params === `not ${legacy}`) rule.params = '(display: block)'; });
  forced.walkAtRules('property', rule => { if (rule.params === '--shimmer-angle') rule.remove(); });
  const browser = await chromium.launch({ executablePath });
  try {
    for (const [label, css] of [['v4', v4], ['v3', v3], ['forced legacy', forced.toString()]]) {
      const page = await browser.newPage({ reducedMotion: 'no-preference' });
      try {
        await page.setContent(`<style>${css}</style><div class="group" data-state="uploading">
          <div id="attachment" class="group/attachment" data-state="off">
            <span id="title" style="color: rgb(24, 24, 24)" class="group-data-[state=processing]/attachment:shimmer group-data-[state=uploading]/attachment:shimmer">Uploading</span>
          </div><span id="plain" style="color:rgb(24, 24, 24)" class="shimmer">Loading</span></div>`);
        const snapshot = () => page.locator('#title').evaluate(el => {
          const style = getComputedStyle(el);
          return { name: style.animationName, direction: style.animationDirection,
            image: style.backgroundImage, fill: style.webkitTextFillColor,
            highlight: style.getPropertyValue('--_highlight').trim(),
            legacyHighlight: style.getPropertyValue('--_shimmer-legacy-highlight').trim() };
        });
        function active(style) {
          assert.equal(style.name, 'tw-shimmer', label);
          assert.match(style.image, /linear-gradient/, label);
          assert.equal(style.fill, 'rgba(0, 0, 0, 0)', label);
        }
        const inactive = await snapshot();
        assert.equal(inactive.name, 'none', label);
        assert.equal(inactive.image, 'none', label);
        assert.equal(inactive.fill, 'rgb(24, 24, 24)', label);
        await page.locator('#attachment').evaluate(el => el.dataset.state = 'processing');
        const processing = await snapshot(); active(processing);
        const positions = await page.locator('#title').evaluate(el => {
          const animation = el.getAnimations().find(item => item.animationName === 'tw-shimmer');
          if (!animation) return [];
          animation.pause();
          animation.currentTime = 0;
          const first = getComputedStyle(el).backgroundPosition;
          animation.currentTime = 1000;
          const middle = getComputedStyle(el).backgroundPosition;
          animation.cancel();
          return [first, middle];
        });
        assert.equal(positions.length, 2, label);
        assert.notEqual(positions[0], positions[1], `shimmer sweep must move (${label})`);
        await page.locator('#attachment').evaluate(el => el.dataset.state = 'uploading');
        active(await snapshot());
        await page.locator('#attachment').evaluate(el => el.dataset.state = 'done');
        assert.equal((await snapshot()).image, 'none', label);
        await page.locator('#attachment').evaluate(el => { el.dataset.state = 'processing'; el.setAttribute('dir', 'rtl'); });
        assert.equal((await snapshot()).direction, 'reverse', label);
        await page.locator('#attachment').evaluate(el => { el.removeAttribute('dir'); el.classList.add('dark'); });
        const dark = await snapshot(); active(dark);
        if (label === 'forced legacy') {
          assert.match(dark.legacyHighlight, /255, 255, 255/);
          assert.match(dark.image, /110deg/);
          assert.notEqual(dark.legacyHighlight, processing.legacyHighlight);
        } else {
          assert.notEqual(dark.highlight, processing.highlight, label);
        }
        const plain = await page.locator('#plain').evaluate(el => getComputedStyle(el).animationName);
        assert.equal(plain, 'tw-shimmer', label);
        await page.emulateMedia({ reducedMotion: 'reduce' });
        const reduced = await snapshot();
        assert.equal(reduced.name, 'none', label);
        assert.equal(reduced.fill, 'rgb(24, 24, 24)', label);
      } finally { await page.close(); }
    }
    console.log('Shimmer state, legibility, dark/RTL and reduced-motion checks PASS (Chromium + forced legacy only)');
  } finally { await browser.close(); }
}
if (require.main === module) {
  if (process.argv.length !== 5) { console.error('usage: <chromium.exe> <v4.css> <v3.css>'); process.exitCode = 2; }
  else run(...process.argv.slice(2)).catch(error => { console.error(error); process.exitCode = 1; });
}
module.exports = { run };
