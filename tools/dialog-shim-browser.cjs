#!/usr/bin/env node
// Opt-in BROWSER test of compat/dialog-shim.js, the <dialog> shim for Safari 15.0-15.3.
// NOT Safari evidence: Chromium keeps its <dialog> element, user-agent stylesheet and top layer.
// What this does is run the REAL code under the same simulation SAFARI15_SIM=1 uses — the
// behaviour suite's safari15-stub.js strips the script API off HTMLDialogElement — so that
// `typeof dialog.showModal` is 'undefined' at the moment compat/dialog-shim.js and ui.js load,
// exactly as on 15.0-15.3.
//
// Run after npm ci --prefix tools:
//   node tools/dialog-shim-browser.cjs [path-to-chromium]
// One behaviour per check; exits nonzero on the first run with any failure.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { chromium } = require('playwright-core');

const root = path.resolve(__dirname, '..');
const lib = path.join(root, 'src/Unpoly.Blazor.Shadcn');
const file = (...parts) => path.join(lib, ...parts);
const url = (p) => 'file://' + p;
const stub = path.join(root, 'tests/Unpoly.Blazor.Shadcn.Behaviour/safari15-stub.js');

// The behaviour sheet wraps itself in @layer components; the Tailwind 3 build Safari 15 gets
// has no layers, so unwrap it — otherwise this unlayered ui.safari15.css would win every
// conflict and the specificity claims below would be untested.
const behaviour = fs.readFileSync(file('Styles/ui.behavior.css'), 'utf8')
  .replace(/@layer components \{/g, '@media all {');
const safari15 = fs.readFileSync(file('wwwroot/ui.safari15.css'), 'utf8');

const MARKUP = `
  <button id="trigger" data-command-open="palette">Open palette</button>
  <a id="ask" href="#asked" data-ask="Are you sure?">Delete</a>

  <dialog id="palette" data-slot="command-dialog" data-command-key="mod+k" data-dismissable="true">
    <div data-slot="command">
      <div data-slot="command-input-wrapper">
        <input data-slot="command-input" type="search" aria-label="Search">
      </div>
      <div data-slot="command-list" role="listbox">
        <div data-slot="command-empty" hidden>No results</div>
        <div data-slot="command-group" role="group">
          <a data-slot="command-item" role="option" href="#alpha">Alpha</a>
          <a data-slot="command-item" role="option" href="#beta">Beta</a>
        </div>
      </div>
    </div>
  </dialog>

  <button id="before">before</button>
  <dialog id="plain">
    <button id="first">first</button>
    <button id="middle">middle</button>
    <button id="last">last</button>
  </dialog>
  <dialog id="bare"><p>nothing focusable</p></dialog>
  <dialog id="formed">
    <form method="dialog">
      <button id="save" value="saved">Save</button>
      <button id="skip" formmethod="dialog" value="skipped" formnovalidate>Skip</button>
    </form>
  </dialog>
  <div id="cap" class="" style="position:fixed;left:0;top:0;width:1px;height:1px"></div>
`;

// `shim` loads compat/dialog-shim.js, `ui` loads ui.js, `simulate` strips the dialog API first.
function page({ simulate = true, shim = true, ui = false }) {
  const scripts = [
    url(file('wwwroot/compat/safari15-shim.js')),
    ...(shim ? [url(file('wwwroot/compat/dialog-shim.js'))] : []),
  ].map((src) => `<script src="${src}"></script>`).join('\n');
  const html = `<!doctype html><html><head><meta charset="utf-8">
    <style>@keyframes sh-fade-in{from{opacity:0}to{opacity:1}}</style>
    <style>${behaviour}</style><style>${safari15}</style>
    ${scripts}</head><body>${MARKUP}
    ${ui ? `<script src="${url(file('wwwroot/ui.js'))}"></script>` : ''}</body></html>`;
  const target = path.join(os.tmpdir(), `dialog-shim-${process.pid}-${Math.random().toString(36).slice(2)}.html`);
  fs.writeFileSync(target, html);
  return { target, simulate };
}

const checks = [];
const check = (name, options, body) => checks.push({ name, options, body });

const q = (selector) => `document.querySelector(${JSON.stringify(selector)})`;

// ---- the simulation itself ------------------------------------------------------------------
check('the stub removes showModal, so the shim has something to install', { shim: false }, async (p) => {
  assert.equal(await p.evaluate(() => typeof document.createElement('dialog').showModal), 'undefined');
});

check('where showModal exists the shim installs nothing', { simulate: false }, async (p) => {
  const native = await p.evaluate(() => Function.prototype.toString.call(HTMLDialogElement.prototype.showModal));
  assert.match(native, /\[native code\]/);
});

check('the shim restores showModal as a function', {}, async (p) => {
  assert.equal(await p.evaluate(() => typeof document.getElementById('plain').showModal), 'function');
});

// ---- open / close ----------------------------------------------------------------------------
check('a closed dialog is not displayed', {}, async (p) => {
  assert.equal(await p.evaluate(() => getComputedStyle(document.getElementById('plain')).display), 'none');
});

// Chromium's own user-agent sheet hides a closed <dialog>, which would pass the check above even
// with ui.safari15.css deleted. An element NAMED dialog in the SVG namespace matches the type
// selector but not the user-agent rule (that is scoped to HTML), which is the position a
// <dialog> is in on an engine that does not know it.
check('ui.safari15.css hides a closed dialog the user agent does not know', {}, async (p) => {
  const display = await p.evaluate(() => {
    const unknown = document.createElementNS('http://www.w3.org/2000/svg', 'dialog');
    document.body.append(unknown);
    return getComputedStyle(unknown).display;
  });
  assert.equal(display, 'none');
});

check('ui.safari15.css leaves an open dialog the user agent does not know displayed', {}, async (p) => {
  const display = await p.evaluate(() => {
    const unknown = document.createElementNS('http://www.w3.org/2000/svg', 'dialog');
    unknown.setAttribute('open', '');
    document.body.append(unknown);
    return getComputedStyle(unknown).display;
  });
  assert.notEqual(display, 'none');
});

check('showModal() sets the open attribute', {}, async (p) => {
  await p.evaluate(() => document.getElementById('plain').showModal());
  assert.equal(await p.evaluate(() => document.getElementById('plain').hasAttribute('open')), true);
});

check('.open reads true while a dialog is open', {}, async (p) => {
  await p.evaluate(() => document.getElementById('plain').showModal());
  assert.equal(await p.evaluate(() => document.getElementById('plain').open), true);
});

check('an open modal is position:fixed', {}, async (p) => {
  await p.evaluate(() => document.getElementById('plain').showModal());
  assert.equal(await p.evaluate(() => getComputedStyle(document.getElementById('plain')).position), 'fixed');
});

check('show() opens a dialog that is not fixed', {}, async (p) => {
  await p.evaluate(() => document.getElementById('plain').show());
  assert.equal(await p.evaluate(() => getComputedStyle(document.getElementById('plain')).position), 'absolute');
});

check('close() removes the open attribute', {}, async (p) => {
  await p.evaluate(() => { const d = document.getElementById('plain'); d.showModal(); d.close(); });
  assert.equal(await p.evaluate(() => document.getElementById('plain').hasAttribute('open')), false);
});

check('close() sets returnValue', {}, async (p) => {
  await p.evaluate(() => { const d = document.getElementById('plain'); d.showModal(); d.close('done'); });
  assert.equal(await p.evaluate(() => document.getElementById('plain').returnValue), 'done');
});

check('a close event fires once after close()', {}, async (p) => {
  const count = await p.evaluate(async () => {
    const d = document.getElementById('plain');
    let n = 0;
    d.addEventListener('close', () => { n++; });
    d.showModal(); d.close();
    await new Promise((r) => setTimeout(r, 50));
    return n;
  });
  assert.equal(count, 1);
});

check('a toggle event carries newState "open" on opening', {}, async (p) => {
  const state = await p.evaluate(async () => {
    const d = document.getElementById('plain');
    const seen = new Promise((r) => d.addEventListener('toggle', (e) => r(e.newState), { once: true }));
    d.showModal();
    return seen;
  });
  assert.equal(state, 'open');
});

check('showModal() on an already-open modal does nothing', {}, async (p) => {
  const threw = await p.evaluate(() => {
    const d = document.getElementById('plain');
    d.showModal();
    try { d.showModal(); return false; } catch { return true; }
  });
  assert.equal(threw, false);
});

check('showModal() on an open non-modal dialog throws InvalidStateError', {}, async (p) => {
  const name = await p.evaluate(() => {
    const d = document.getElementById('plain');
    d.show();
    try { d.showModal(); return null; } catch (e) { return e.name; }
  });
  assert.equal(name, 'InvalidStateError');
});

check('showModal() on a dialog outside the document throws InvalidStateError', {}, async (p) => {
  const name = await p.evaluate(() => {
    try { document.createElement('dialog').showModal(); return null; } catch (e) { return e.name; }
  });
  assert.equal(name, 'InvalidStateError');
});

// ---- focus -----------------------------------------------------------------------------------
check('opening moves focus to the first focusable element', {}, async (p) => {
  await p.evaluate(() => document.getElementById('plain').showModal());
  assert.equal(await p.evaluate(() => document.activeElement.id), 'first');
});

check('closing returns focus to the element that had it', {}, async (p) => {
  await p.focus('#before');
  await p.evaluate(() => document.getElementById('plain').showModal());
  await p.evaluate(() => document.getElementById('plain').close());
  assert.equal(await p.evaluate(() => document.activeElement.id), 'before');
});

check('a dialog with nothing focusable takes focus itself', {}, async (p) => {
  await p.evaluate(() => document.getElementById('bare').showModal());
  assert.equal(await p.evaluate(() => document.activeElement.id), 'bare');
});

check('Tab from the last control wraps to the first', {}, async (p) => {
  await p.evaluate(() => document.getElementById('plain').showModal());
  await p.focus('#last');
  await p.keyboard.press('Tab');
  assert.equal(await p.evaluate(() => document.activeElement.id), 'first');
});

check('Shift+Tab from the first control wraps to the last', {}, async (p) => {
  await p.evaluate(() => document.getElementById('plain').showModal());
  await p.focus('#first');
  await p.keyboard.press('Shift+Tab');
  assert.equal(await p.evaluate(() => document.activeElement.id), 'last');
});

check('Tab from outside the dialog is pulled back inside', {}, async (p) => {
  await p.evaluate(() => document.getElementById('plain').showModal());
  await p.focus('#before');
  await p.keyboard.press('Tab');
  assert.equal(await p.evaluate(() => document.getElementById('plain').contains(document.activeElement)), true);
});

// ---- Escape ----------------------------------------------------------------------------------
check('Escape closes the topmost modal', {}, async (p) => {
  await p.evaluate(() => document.getElementById('plain').showModal());
  await p.keyboard.press('Escape');
  assert.equal(await p.evaluate(() => document.getElementById('plain').open), false);
});

check('Escape fires a cancelable cancel event first', {}, async (p) => {
  const cancelable = await p.evaluate(async () => {
    const d = document.getElementById('plain');
    const seen = new Promise((r) => d.addEventListener('cancel', (e) => r(e.cancelable), { once: true }));
    d.showModal();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    return seen;
  });
  assert.equal(cancelable, true);
});

check('preventing cancel keeps the dialog open', {}, async (p) => {
  await p.evaluate(() => {
    const d = document.getElementById('plain');
    d.addEventListener('cancel', (e) => e.preventDefault());
    d.showModal();
  });
  await p.keyboard.press('Escape');
  assert.equal(await p.evaluate(() => document.getElementById('plain').open), true);
});

check('Escape belongs to an open popover before the dialog', {}, async (p) => {
  await p.evaluate(() => {
    document.getElementById('plain').showModal();
    document.getElementById('cap').classList.add(':popover-open');
  });
  await p.keyboard.press('Escape');
  assert.equal(await p.evaluate(() => document.getElementById('plain').open), true);
});

// ---- the page behind -------------------------------------------------------------------------
// Attribute reads as page expressions; `plain` and `bare` are siblings of #before in <body>.
const attr = (id, name) => `document.getElementById(${JSON.stringify(id)}).getAttribute(${JSON.stringify(name)})`;
// A dialog two levels down, so the path to <body> has an ancestor with a sibling of its own.
const NEST = () => {
  const wrap = document.createElement('div');
  wrap.id = 'wrap';
  wrap.innerHTML = '<button id="aunt">aunt</button><div id="parent"><button id="sibling">sibling</button>' +
    '<dialog id="nested"><button id="ok">ok</button></dialog></div>';
  document.body.append(wrap);
};

check('a modal carries aria-modal="true"', {}, async (p) => {
  await p.evaluate(() => document.getElementById('plain').showModal());
  assert.equal(await p.evaluate(attr('plain', 'aria-modal')), 'true');
});

check('a modal hides the rest of the page from assistive technology', {}, async (p) => {
  await p.evaluate(() => document.getElementById('plain').showModal());
  assert.equal(await p.evaluate(attr('before', 'aria-hidden')), 'true');
});

check('a modal does not hide itself', {}, async (p) => {
  await p.evaluate(() => document.getElementById('plain').showModal());
  assert.equal(await p.evaluate(attr('plain', 'aria-hidden')), null);
});

check('a modal hides a sibling of its own parent', {}, async (p) => {
  await p.evaluate(NEST);
  await p.evaluate(() => document.getElementById('nested').showModal());
  assert.equal(await p.evaluate(attr('sibling', 'aria-hidden')), 'true');
});

check('a modal hides a sibling of its ancestor', {}, async (p) => {
  await p.evaluate(NEST);
  await p.evaluate(() => document.getElementById('nested').showModal());
  assert.equal(await p.evaluate(attr('aunt', 'aria-hidden')), 'true');
});

check('a modal leaves its own ancestors exposed', {}, async (p) => {
  await p.evaluate(NEST);
  await p.evaluate(() => document.getElementById('nested').showModal());
  const hidden = await p.evaluate(() => ['parent', 'wrap'].map((id) => document.getElementById(id).getAttribute('aria-hidden')));
  assert.deepEqual(hidden, [null, null]);
});

check('close() exposes the page again', {}, async (p) => {
  await p.evaluate(() => { const d = document.getElementById('plain'); d.showModal(); d.close(); });
  assert.equal(await p.evaluate(attr('before', 'aria-hidden')), null);
});

check('close() leaves an element that was already aria-hidden hidden', {}, async (p) => {
  await p.evaluate(() => {
    document.getElementById('cap').setAttribute('aria-hidden', 'true');
    const d = document.getElementById('plain'); d.showModal(); d.close();
  });
  assert.equal(await p.evaluate(attr('cap', 'aria-hidden')), 'true');
});

check('a non-modal show() leaves the page exposed', {}, async (p) => {
  await p.evaluate(() => document.getElementById('plain').show());
  assert.equal(await p.evaluate(attr('before', 'aria-hidden')), null);
});

// An alert dialog opened over a dialog is a sibling of it — "the rest of the page" to the first
// modal — and must still be reachable by a screen reader.
check('a modal opened over another modal is exposed', {}, async (p) => {
  await p.evaluate(() => { document.getElementById('plain').showModal(); document.getElementById('bare').showModal(); });
  assert.equal(await p.evaluate(attr('bare', 'aria-hidden')), null);
});

check('a modal opened over another hides the one beneath it', {}, async (p) => {
  await p.evaluate(() => { document.getElementById('plain').showModal(); document.getElementById('bare').showModal(); });
  assert.equal(await p.evaluate(attr('plain', 'aria-hidden')), 'true');
});

check('closing the top modal exposes the one beneath it again', {}, async (p) => {
  await p.evaluate(() => {
    document.getElementById('plain').showModal();
    document.getElementById('bare').showModal();
    document.getElementById('bare').close();
  });
  assert.equal(await p.evaluate(attr('plain', 'aria-hidden')), null);
});

check('closing the top modal hides the page from the one beneath it again', {}, async (p) => {
  await p.evaluate(() => {
    document.getElementById('plain').showModal();
    document.getElementById('bare').showModal();
    document.getElementById('bare').close();
  });
  assert.equal(await p.evaluate(attr('before', 'aria-hidden')), 'true');
});

// ---- backdrop --------------------------------------------------------------------------------
check('the backdrop is painted over the viewport', {}, async (p) => {
  await p.evaluate(() => document.getElementById('plain').showModal());
  const style = await p.evaluate(() => {
    const s = getComputedStyle(document.getElementById('plain'), '::before');
    return [s.position, s.backgroundColor, s.content];
  });
  assert.deepEqual(style, ['fixed', 'rgba(0, 0, 0, 0.5)', '""']);
});

check('there is no backdrop once the dialog is closed', {}, async (p) => {
  await p.evaluate(() => { const d = document.getElementById('plain'); d.showModal(); d.close(); });
  const content = await p.evaluate(() => getComputedStyle(document.getElementById('plain'), '::before').content);
  assert.notEqual(content, '""');
});

check('a click on the backdrop targets the dialog itself', {}, async (p) => {
  await p.evaluate(() => {
    const d = document.getElementById('plain');
    window.__target = null;
    d.addEventListener('click', (e) => { window.__target = e.target.id; });
    d.showModal();
  });
  await p.mouse.click(4, 400);
  assert.equal(await p.evaluate(() => window.__target), 'plain');
});

// ---- form method=dialog ----------------------------------------------------------------------
check('a method=dialog form closes its dialog', {}, async (p) => {
  await p.evaluate(() => document.getElementById('formed').showModal());
  await p.click('#save');
  assert.equal(await p.evaluate(() => document.getElementById('formed').open), false);
});

check('the pressed button supplies the returnValue', {}, async (p) => {
  await p.evaluate(() => document.getElementById('formed').showModal());
  await p.click('#save');
  assert.equal(await p.evaluate(() => document.getElementById('formed').returnValue), 'saved');
});

check('formmethod="dialog" on a button closes the dialog too', {}, async (p) => {
  await p.evaluate(() => document.getElementById('formed').showModal());
  await p.click('#skip');
  assert.equal(await p.evaluate(() => document.getElementById('formed').returnValue), 'skipped');
});

// ---- ui.js on top of the shim ----------------------------------------------------------------
const ui = { ui: true };

check('ui.js: the trigger opens the command palette', ui, async (p) => {
  await p.click('#trigger');
  assert.equal(await p.evaluate(() => document.getElementById('palette').open), true);
});

check('ui.js: the palette input has focus when it opens', ui, async (p) => {
  await p.click('#trigger');
  await p.waitForFunction(() => document.activeElement?.dataset.slot === 'command-input');
});

check('ui.js: typing filters the items', ui, async (p) => {
  await p.click('#trigger');
  await p.keyboard.type('bet');
  const shown = await p.evaluate(() => [...document.querySelectorAll('#palette [data-slot="command-item"]')]
    .filter((i) => !i.hidden).map((i) => i.textContent));
  assert.deepEqual(shown, ['Beta']);
});

check('ui.js: Ctrl+K opens the palette', ui, async (p) => {
  await p.keyboard.press('Control+k');
  assert.equal(await p.evaluate(() => document.getElementById('palette').open), true);
});

check('ui.js: Ctrl+K closes an open palette', ui, async (p) => {
  await p.keyboard.press('Control+k');
  await p.keyboard.press('Control+k');
  assert.equal(await p.evaluate(() => document.getElementById('palette').open), false);
});

check('ui.js: choosing an item closes the palette', ui, async (p) => {
  await p.click('#trigger');
  await p.evaluate(() => document.getElementById('palette').addEventListener('click', (e) => e.preventDefault(), { once: true }));
  await p.keyboard.press('Enter');
  assert.equal(await p.evaluate(() => document.getElementById('palette').open), false);
});

check('ui.js: Escape closes the palette', ui, async (p) => {
  await p.click('#trigger');
  await p.keyboard.press('Escape');
  assert.equal(await p.evaluate(() => document.getElementById('palette').open), false);
});

check('ui.js: a click outside the box dismisses the palette', ui, async (p) => {
  await p.click('#trigger');
  await p.mouse.click(4, 400);
  assert.equal(await p.evaluate(() => document.getElementById('palette').open), false);
});

check('ui.js: an alert dialog opens from a [data-ask] link', ui, async (p) => {
  await p.click('#ask');
  await p.waitForSelector('dialog[data-slot="alert-dialog"][open]');
});

check('ui.js: answering an alert dialog removes it', ui, async (p) => {
  await p.click('#ask');
  await p.click('[data-ask-no]');
  assert.equal(await p.evaluate(() => document.querySelector('dialog[data-slot="alert-dialog"]')), null);
});

// ---- ui.js with NO shim: the fallback is loud, not silent -------------------------------------
const bare = { ui: true, shim: false };

check('without the shim, the trigger still opens the palette (as the open attribute)', bare, async (p) => {
  await p.click('#trigger');
  assert.equal(await p.evaluate(() => document.getElementById('palette').hasAttribute('open')), true);
});

check('without the shim, the trigger closes it again', bare, async (p) => {
  await p.click('#trigger');
  await p.evaluate(() => { document.getElementById('trigger').click(); });
  assert.equal(await p.evaluate(() => document.getElementById('palette').hasAttribute('open')), false);
});

check('without the shim, the missing dialog is named in the console exactly once', bare, async (p, log) => {
  await p.click('#trigger');
  await p.evaluate(() => { document.getElementById('trigger').click(); document.getElementById('trigger').click(); });
  assert.equal(log.warnings.filter((w) => w.includes('dialog-shim.js')).length, 1);
});

check('without the shim, nothing throws', bare, async (p, log) => {
  await p.click('#trigger');
  await p.keyboard.press('Control+k');
  assert.deepEqual(log.errors, []);
});

(async () => {
  const executablePath = process.argv[2] || process.env.CHROMIUM
    || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
  const browser = await chromium.launch({ headless: true, executablePath });
  let failed = 0;
  try {
    for (const { name, options, body } of checks) {
      const { target, simulate } = page(options);
      const context = await browser.newContext({ viewport: { width: 1000, height: 700 } });
      if (simulate) await context.addInitScript({ path: stub });
      const p = await context.newPage();
      const log = { errors: [], warnings: [] };
      p.on('pageerror', (e) => log.errors.push(String(e)));
      p.on('console', (m) => { if (m.type() === 'warning') log.warnings.push(m.text()); });
      try {
        await p.goto(url(target));
        await body(p, log);
        console.log('PASS ' + name);
      } catch (error) {
        failed++;
        console.log('FAIL ' + name + '\n     ' + String(error.message).split('\n').join('\n     '));
      } finally {
        await context.close();
        fs.rmSync(target, { force: true });
      }
    }
  } finally {
    await browser.close();
  }
  console.log(`\n${checks.length - failed}/${checks.length} passed`);
  process.exitCode = failed ? 1 : 0;
})().catch((error) => { console.error(error); process.exitCode = 2; });
