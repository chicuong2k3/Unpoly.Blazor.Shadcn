const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { componentRoutes, standalone, pageHeadings } = require('./demo-route-regression-browser.cjs');
test('Web and MAUI share the complete component-route manifest', () => {
  const routes = componentRoutes();
  const pages = path.resolve(__dirname, '../demo/Unpoly.Blazor.Shadcn.Maui/Components/Pages');
  const maui = fs.readdirSync(pages).filter(f => f.endsWith('.razor')).flatMap(f =>
    [...fs.readFileSync(path.join(pages, f), 'utf8').matchAll(/^@page "(\/components\/[^"]+)"/gm)].map(m => m[1])).sort();
  assert.equal(routes.length, 77);
  assert.deepEqual(maui, routes);
  const headings = pageHeadings(pages);
  assert.deepEqual(Object.keys(headings).sort(), routes);
  assert.equal(new Set(Object.values(headings)).size, routes.length, 'headings distinguish completed MAUI navigations');
  for (const [route, slot] of Object.entries(standalone)) {
    const source = fs.readdirSync(pages).filter(f => f.endsWith('Page.razor')).map(f => fs.readFileSync(path.join(pages, f), 'utf8')).find(text => text.includes(`@page "${route}"`));
    assert.ok(source?.includes(`<${slot.split('-').map(x => x[0].toUpperCase() + x.slice(1)).join('')} `), `${route} must mount ${slot}`);
  }
});
