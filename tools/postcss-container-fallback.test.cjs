const test = require('node:test');
const assert = require('node:assert/strict');
const postcss = require('postcss');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createContainerFallback } = require('./postcss-container-fallback.cjs');

test('clones supported named 28rem query into a Safari-only, zero-specificity target fallback', async () => {
  const source = '@container field-group (min-width: 28rem) { .\\@md\\/field-group\\:flex-row { flex-direction: row } }';
  const { plugin, manifest } = createContainerFallback();
  const result = (await postcss([plugin]).process(source, { from: undefined })).css;
  assert.deepEqual(manifest, { 'card-header': [], 'field-group': ['@md/field-group:flex-row'] });
  assert.match(result, /@container field-group \(min-width: 28rem\)/);
  assert.match(result, /@supports not \(container-type: inline-size\)/);
  assert.match(result, /:where\(\[data-cq-md-field-group\]\)\.\\@md\\\/field-group\\:flex-row/);
});

test('runtime exports the attributes required by the combined :has observer', () => {
  const context = { window: {} };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, 'container-fallback-runtime.js'), 'utf8'), context);
  assert.deepEqual(Array.from(context.window.shadcnContainerFallback.observedAttributes),
    ['data-cq-md-card-header', 'data-cq-md-field-group']);
});

test('does not allow a release build to remove native container rules', () => {
  assert.throws(() => createContainerFallback({ removeNative: true }), /only allowed in forced browser tests/);
});

test('fails closed for other query thresholds and unknown names', async () => {
  for (const params of ['field-group (min-width: 30rem)', 'other (min-width: 28rem)']) {
    const { plugin } = createContainerFallback();
    await assert.rejects(postcss([plugin]).process(`@container ${params} { .x { display: flex } }`, { from: undefined }), /Unsupported Safari container query/);
  }
});
