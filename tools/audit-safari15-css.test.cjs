const { test } = require('node:test');
const assert = require('node:assert/strict');
const { inspect } = require('./audit-safari15-css.cjs');

test('reports unsupported Safari 15.0 CSS syntax without mistaking comments for declarations', () => {
  const css = `/* :has(), @container, color-mix() */
    @layer base { .base { color: red } }
    @property --progress { syntax: '<number>'; inherits: false; initial-value: 0 }
    @container card (min-width: 28rem) { .card:has(> .action) { color: color-mix(in srgb, red, blue) } }
    .x:has(.y) { color: oklch(from currentColor l c h / .2) }
    @starting-style { .x { opacity: 0 } }
    @scope (.x) { .y { color: red } }`;
  const result = inspect(css);
  assert.deepEqual(result.counts, {
    cascadeLayers: 1,
    registeredProperties: 1,
    containerQueries: 1,
    startingStyle: 1,
    scope: 1,
    hasSelectors: 2,
    colorMixDeclarations: 1,
    relativeColorDeclarations: 1,
  });
  assert.equal(result.samples.containerQueries[0].line, 4);
});

test('detects selectors/declarations under @supports without claiming fallback coverage', () => {
  const report = inspect('@supports selector(:has(*)) { .card:has(.icon) { color: color-mix(in srgb, red, blue) } }');
  assert.equal(report.counts.hasSelectors, 1);
  assert.equal(report.counts.colorMixDeclarations, 1);
});
