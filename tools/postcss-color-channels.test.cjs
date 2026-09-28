const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const postcss = require('postcss');
const { channels, colorChannels } = require('./postcss-color-channels.cjs');
const colors = new Set(require('./color-tokens.cjs'));

test('retains alpha and turns static CSS colors into Safari-compatible RGB channels', async () => {
  assert.deepEqual(channels('rgba(255, 255, 255, 0.10)'), { rgb: '255, 255, 255', alpha: '0.1' });
  assert.deepEqual(channels('oklch(1 0 0 / 15%)'), { rgb: '255, 255, 255', alpha: '0.15' });
  assert.deepEqual(channels('#000'), { rgb: '0, 0, 0', alpha: '1' });
  assert.deepEqual(channels('oklch(0.48 0.16 240)'), { rgb: '0, 100, 173', alpha: '1' },
    'clip out-of-gamut github-light blue as the v4 browser does, do not reduce chroma');
  assert.deepEqual(channels('oklch(0.7 0.18 285)'), { rgb: '149, 138, 255', alpha: '1' },
    'clip out-of-gamut dracula violet');
  const input = ':root { --primary: oklch(1 0 0); --border: rgba(255, 255, 255, 0.1) }';
  const first = (await postcss([colorChannels()]).process(input, { from: undefined })).css;
  const second = (await postcss([colorChannels()]).process(first, { from: undefined })).css;
  assert.equal(second, first, 'the transform must be repeatable');
  assert.match(first, /--primary-rgb: 255, 255, 255; --primary-alpha: 1/);
  assert.match(first, /--border-rgb: 255, 255, 255; --border-alpha: 0.1/);
});

test('generated alpha channels follow both light and dark runtime themes', async () => {
  const sheet = await postcss([colorChannels()]).process(`
    :root { --primary: oklch(0.205 0 0); --border: oklch(0.922 0 0) }
    .dark { --primary: oklch(0.922 0 0); --border: oklch(1 0 0 / 10%) }
    [data-theme="example"] { --primary: #0071e3 }
    [data-theme="example"].dark { --primary: rgba(255, 255, 255, 0.15) }
  `, { from: undefined });
  const tokens = selector => {
    const result = {};
    sheet.root.walkRules(rule => {
      if (rule.selector === selector) rule.walkDecls(decl => { result[decl.prop] = decl.value; });
    });
    return result;
  };
  assert.equal(tokens(':root')['--primary-rgb'], '23, 23, 23');
  assert.equal(tokens('.dark')['--border-alpha'], '0.1');
  assert.equal(tokens('[data-theme="example"]')['--primary-rgb'], '0, 113, 227');
  assert.equal(tokens('[data-theme="example"].dark')['--primary-alpha'], '0.15');
  // The future `/50` utility must multiply, not discard, a theme's built-in opacity.
  assert.equal(Number(tokens('.dark')['--border-alpha']) * 0.5, 0.05);
  assert.equal(Number(tokens('[data-theme="example"].dark')['--primary-alpha']) * 0.5, 0.075);
});

test('does not silently accept dynamic or malformed palette tokens', async () => {
  await assert.rejects(postcss([colorChannels()]).process(':root { --primary: var(--brand) }', { from: undefined }),
    /Unsupported theme color/);
});

test('all authored default and selectable themes have convertible alpha colors', async () => {
  const library = path.resolve(__dirname, '../src/Unpoly.Blazor.Shadcn/Styles/ui.css');
  const themes = path.resolve(__dirname, '../themes');
  const files = [library, ...fs.readdirSync(themes).filter(file => file.endsWith('.css')).map(file => path.join(themes, file))];
  let declarations = 0;
  for (const file of files) {
    const input = fs.readFileSync(file, 'utf8');
    const original = postcss.parse(input, { from: file });
    original.walkDecls(decl => { if (colors.has(decl.prop.slice(2))) declarations++; });
    const result = await postcss([colorChannels()]).process(input, { from: file });
    let count = 0;
    result.root.walkDecls(decl => {
      if (decl.prop.endsWith('-rgb') && colors.has(decl.prop.slice(2, -4))) count++;
    });
    const expected = [];
    original.walkDecls(decl => { if (colors.has(decl.prop.slice(2))) expected.push(decl); });
    assert.equal(count, expected.length, file);
  }
  assert.ok(declarations > 4000, `unexpected token coverage: ${declarations}`);
});
