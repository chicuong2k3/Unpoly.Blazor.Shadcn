const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const postcss = require('postcss');
const { spacingToken } = require('./tailwind3-spacing-token.cjs');
test('restores the single v4 runtime spacing token without hardcoding each consumer utility', async () => {
  for (const name of ['Unpoly.Blazor.Shadcn.Demo', 'Unpoly.Blazor.Shadcn.Maui']) {
    const baseline = postcss.parse(fs.readFileSync(path.join(__dirname, `../demo/${name}/wwwroot/app.css`), 'utf8'));
    const values = [];
    baseline.walkDecls('--spacing', decl => values.push(decl.value));
    assert.equal(values.length, 1, name);
    assert.match(values[0], /^(?:0?\.25)rem$/, name);
  }
  const output = (await postcss([spacingToken()]).process('.scroll-fade-b { width: var(--spacing) }', { from: undefined })).root;
  assert.equal(output.nodes[0].selector, ':root');
  assert.equal(output.nodes[0].nodes[0].value, '0.25rem');
  assert.equal(output.nodes[0].nodes[1].prop, '--font-sans');
  assert.match(output.nodes[0].nodes[1].value, /^-apple-system, BlinkMacSystemFont/);
  assert.equal(output.nodes[0].nodes[2].prop, '--font-mono');
  await assert.rejects(postcss([spacingToken()]).process(':root { --spacing: 2rem }', { from: undefined }), /Unexpected authored --spacing/);
});
