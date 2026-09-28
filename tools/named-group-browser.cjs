#!/usr/bin/env node
// Opt-in v4/v3 named group state parity on Chromium; not Safari 15 evidence.
// node tools/named-group-browser.cjs <chromium.exe> <v4.css> <v3.css>
const fs = require('node:fs');
const assert = require('node:assert/strict');
const { chromium } = require('playwright-core');
const postcss = require('postcss');
const { namedGroupCompat } = require('./postcss-named-group-compat.cjs');
async function run(executablePath, v4File, v3File, forcedHas = false) {
  // The real ghost rule sets zero padding, indistinguishable from the
  // browser default. Pin its real declaration, then use a 7px marker in
  // test-only CSS to prove the named-state selector switches on/off.
  function markGhostRule(css) {
    const root = postcss.parse(css);
    const rules = [];
    root.walkRules(rule => { if (rule.selector.includes('group-has-data-') && rule.selector.includes('ghost') && rule.selector.includes('message')) rules.push(rule); });
    assert.equal(rules.length, 1, 'ghost selector must exist once');
    const declarations = rules[0].nodes.filter(node => node.type === 'decl');
    assert.ok(declarations.length > 0);
    for (const declaration of declarations) {
      assert.ok(['padding-inline', 'padding-left', 'padding-right'].includes(declaration.prop));
      assert.ok(['0px', '0'].includes(declaration.value), 'original value must be zero');
      declaration.value = '7px';
    }
    return root.toString();
  }
  const v4 = markGhostRule(fs.readFileSync(v4File, 'utf8'));
  let v3 = markGhostRule((await postcss([namedGroupCompat()]).process(fs.readFileSync(v3File, 'utf8'), { from: v3File })).css);
  if (forcedHas) {
    const { default: hasPseudo } = await import('css-has-pseudo');
    v3 = (await postcss([hasPseudo({ preserve: false })]).process(v3, { from: v3File })).css;
    assert.ok(v3.includes('csstools-has-'));
    assert.ok(!v3.includes(':has('), 'native :has must not mask a broken fallback');
  }
  const browser = await chromium.launch({ executablePath });
  try {
    const snapshots = [];
    for (const [index, css] of [v4, v3].entries()) {
      const page = await browser.newPage();
      try {
        await page.setContent(`<style>${css}</style>
          <section class="group" id="outer" data-empty><span data-size="lg"></span>
            <div class="group/avatar-group" id="avatar" style="width:11px"><span data-size="sm"></span>
              <div id="avatar-child" class="group-has-data-[size=lg]/avatar-group:size-10 group-has-data-[size=sm]/avatar-group:size-6"></div>
            </div>
            <div class="group/combobox-content" id="combo">
              <div id="combo-child" class="hidden group-data-empty/combobox-content:flex"></div>
            </div>
            <div class="group/message" id="message"><span id="message-marker"></span>
              <div id="message-shift" class="group-has-data-[slot=message-footer]/message:-translate-y-8">Shift</div>
              <span id="message-padding" class="group-has-data-[variant=ghost]/message:px-0">Padding</span>
            </div>
            <div class="group/menu-item" id="menu"><span id="menu-marker"></span>
              <span id="menu-child" class="group-has-data-[sidebar=menu-action]/menu-item:pe-8">Menu</span>
            </div>
            <div class="group/alert-dialog-content" id="alert" data-size="default">
              <div id="alert-child" class="sm:group-data-[size=default]/alert-dialog-content:group-has-data-[slot=alert-dialog-media]/alert-dialog-content:col-start-2">Alert</div>
            </div>
          </section>`);
        if (index === 1 && forcedHas) {
          const path = require('node:path');
          await page.addScriptTag({ path: path.join(path.dirname(require.resolve('css-has-pseudo/browser')), 'browser-global.js') });
          await page.evaluate(() => window.cssHasPseudo(document, {
            forcePolyfill: true,
            observedAttributes: ['class', 'data-size', 'data-empty', 'data-slot', 'data-variant', 'data-sidebar'],
          }));
        }
        async function waitFor(size, display) {
          await page.waitForFunction(([size, display]) => {
            return getComputedStyle(document.getElementById('avatar-child')).width === size &&
              getComputedStyle(document.getElementById('combo-child')).display === display;
          }, [size, display], { timeout: 5000 });
        }
        async function snap() {
          return page.evaluate(() => ({ size: getComputedStyle(document.getElementById('avatar-child')).width,
            display: getComputedStyle(document.getElementById('combo-child')).display }));
        }
        async function waitExtra(svg, menu, grid) {
          await page.waitForFunction(([svg, menu, grid]) =>
            getComputedStyle(document.getElementById('avatar-svg')).width === svg &&
            getComputedStyle(document.getElementById('menu-child')).paddingRight === menu &&
            getComputedStyle(document.getElementById('alert-child')).gridColumnStart === grid,
          [svg, menu, grid], { timeout: 5000 });
        }
        async function extra() {
          return page.evaluate(() => {
            const el = id => document.getElementById(id);
            const style = id => getComputedStyle(el(id));
            const shift = el('message-shift');
            const naturalTop = shift.offsetTop + (shift.offsetParent?.getBoundingClientRect().top ?? 0);
            const avatarSvg = el('avatar-svg');
            return {
              svg: [style('avatar-svg').width, style('avatar-svg').height],
              shift: Math.round(shift.getBoundingClientRect().top - naturalTop),
              pad: [style('message-padding').paddingLeft, style('message-padding').paddingRight],
              menu: [style('menu-child').paddingLeft, style('menu-child').paddingRight],
              grid: style('alert-child').gridColumnStart,
            };
          });
        }
        await waitFor('24px', 'none');
        const innerSmOuterLg = await snap();
        await page.evaluate(() => {
          document.getElementById('outer').removeAttribute('data-empty');
          document.getElementById('outer').querySelector('[data-size=lg]').remove();
          document.getElementById('avatar').querySelector('[data-size=sm]').dataset.size = 'lg';
          document.getElementById('combo').setAttribute('data-empty', '');
        });
        await waitFor('40px', 'flex');
        const innerLgOnly = await snap();
        await page.evaluate(() => {
          document.getElementById('avatar').querySelector('[data-size=lg]').remove();
          document.getElementById('combo').removeAttribute('data-empty');
        });
        await waitFor('11px', 'none');
        const empty = await snap();
        snapshots.push([innerSmOuterLg, innerLgOnly, empty]);
        // A generic outer group deliberately carries all marker attributes.
        // Only the matching inner named group may activate each utility.
        await page.evaluate(() => {
          const outer = document.getElementById('outer');
          for (const [name, value] of Object.entries({ 'data-slot': 'message-footer', 'data-variant': 'ghost', 'data-sidebar': 'menu-action' })) outer.setAttribute(name, value);
          const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
          svg.id = 'avatar-svg'; svg.setAttribute('viewBox', '0 0 10 10');
          svg.setAttribute('width', '17'); svg.setAttribute('height', '17');
          const count = document.createElement('span');
          count.id = 'avatar-count';
          count.className = 'group-has-data-[size=lg]/avatar-group:[&>svg]:size-5 group-has-data-[size=sm]/avatar-group:[&>svg]:size-3';
          count.append(svg); document.getElementById('avatar').append(count);
          const outerMedia = document.createElement('span'); outerMedia.dataset.slot = 'alert-dialog-media'; outer.append(outerMedia);
        });
        const initialExtra = await extra();
        await page.evaluate(() => {
          const avatar = document.getElementById('avatar');
          const size = document.createElement('span'); size.dataset.size = 'sm'; avatar.append(size);
          const message = document.getElementById('message');
          message.querySelector('#message-marker').dataset.slot = 'message-footer';
          message.querySelector('#message-marker').dataset.variant = 'ghost';
          document.getElementById('menu-marker').dataset.sidebar = 'menu-action';
          const media = document.createElement('span'); media.dataset.slot = 'alert-dialog-media'; document.getElementById('alert').append(media);
        });
        await waitExtra('12px', '32px', '2');
        const activeExtra = await extra();
        await page.evaluate(() => {
          document.getElementById('avatar').querySelector('[data-size=sm]').dataset.size = 'lg';
          document.getElementById('menu').setAttribute('dir', 'rtl');
        });
        await waitExtra('20px', '0px', '2');
        const largeRtlExtra = await extra();
        await page.evaluate(() => {
          document.getElementById('avatar').querySelector('[data-size=lg]').remove();
          document.getElementById('message-marker').removeAttribute('data-slot');
          document.getElementById('message-marker').removeAttribute('data-variant');
          document.getElementById('menu-marker').removeAttribute('data-sidebar');
          document.getElementById('alert').dataset.size = 'large';
        });
        await waitExtra('17px', '0px', 'auto');
        const removedExtra = await extra();
        snapshots[index].push([initialExtra, activeExtra, largeRtlExtra, removedExtra]);
      } finally { await page.close(); }
    }
    assert.deepEqual(snapshots[0].slice(0, 3), [
      { size: '24px', display: 'none' },
      { size: '40px', display: 'flex' },
      { size: '11px', display: 'none' },
    ]);
    assert.deepEqual(snapshots[1], snapshots[0]);
    const [off, active, large, removed] = snapshots[0][3];
    assert.deepEqual(off.svg, ['17px', '17px']);
    assert.deepEqual(active.svg, ['12px', '12px']);
    assert.deepEqual(large.svg, ['20px', '20px']);
    assert.deepEqual(removed.svg, ['17px', '17px']);
    assert.equal(off.shift, 0); assert.equal(active.shift, -32); assert.equal(removed.shift, 0);
    assert.deepEqual(off.pad, ['0px', '0px']);
    assert.deepEqual(active.pad, ['7px', '7px']); // test-only marker
    assert.deepEqual(removed.pad, off.pad);
    assert.deepEqual(active.menu, ['0px', '32px']);
    assert.deepEqual(large.menu, ['32px', '0px']);
    assert.equal(active.grid, '2'); assert.notEqual(off.grid, '2'); assert.notEqual(removed.grid, '2');
    console.log(`Nine named-group selectors dynamically match v4 (ghost uses a test-only marker; Chromium ${forcedHas ? 'forced :has fallback' : 'native'} only)`);
  } finally { await browser.close(); }
}
if (require.main === module) {
  if (![5, 6].includes(process.argv.length) || (process.argv[5] && process.argv[5] !== '--forced-has')) {
    console.error('usage: <chromium.exe> <v4.css> <v3.css> [--forced-has]'); process.exitCode = 2;
  } else run(...process.argv.slice(2, 5), process.argv[5] === '--forced-has').catch(error => { console.error(error); process.exitCode = 1; });
}
module.exports = { run };
