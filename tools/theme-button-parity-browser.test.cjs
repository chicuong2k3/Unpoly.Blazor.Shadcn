const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { themes } = require('./theme-button-parity-browser.cjs');

test('theme diagnostic scans both compiled v4 heads, not a handpicked theme list', () => {
  assert.deepEqual(themes('[data-theme="b"] {} [data-theme=a] {} [data-theme="b"].dark {} /* [data-theme="removed"] */'), ['a', 'b']);
  const root = path.resolve(__dirname, '..', 'demo');
  const names = ['Demo', 'Maui'].map(head => themes(fs.readFileSync(path.join(root,
    `Unpoly.Blazor.Shadcn.${head}`, 'wwwroot', 'app.css'), 'utf8')));
  assert.deepEqual(names[0], ['apple', 'dracula']);
  assert.deepEqual(names[0], names[1]);
});
