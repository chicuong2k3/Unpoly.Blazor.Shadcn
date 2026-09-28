const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const boot = fs.readFileSync(path.resolve(__dirname, '../src/Unpoly.Blazor.Shadcn/wwwroot/compat/has-pseudo-boot.js'), 'utf8');

function run(css, containerAttributes, nativeHas = false) {
  const calls = [];
  const document = { getElementById: () => ({ dataset: { demoCss: css } }) };
  const window = {
    CSS: { supports: query => !query.startsWith('selector(:has(') || nativeHas },
    cssHasPseudo: (...args) => calls.push(args),
    shadcnContainerFallback: containerAttributes ? { observedAttributes: containerAttributes } : undefined,
  };
  vm.runInNewContext(boot, { window, document });
  return { calls, window, document };
}

test('v3 boot observes compound child attributes and generated container flags', () => {
  const { calls, document } = run('v3', ['data-cq-md-field-group', 'data-cq-md-card-header']);
  assert.equal(calls.length, 1);
  assert.equal(calls[0][0], document);
  assert.deepEqual(Array.from(calls[0][1].observedAttributes),
    ['data-slot', 'data-align', 'data-state', 'data-empty', 'data-highlighted', 'data-cq-md-field-group', 'data-cq-md-card-header']);
});

test('v3 without a container script still observes child changes; v4 retains original boot', () => {
  assert.deepEqual(Array.from(run('v3').calls[0][1].observedAttributes),
    ['data-slot', 'data-align', 'data-state', 'data-empty', 'data-highlighted']);
  assert.equal(run('v4').calls[0][1], undefined);
  assert.equal(run('v3', null, true).calls.length, 0);
});
