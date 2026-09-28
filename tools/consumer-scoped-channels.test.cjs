const { test } = require('node:test');
const assert = require('node:assert/strict');
const { scopedChannels } = require('./consumer-scoped-channels.cjs');
test('scoped Portal palette retains authored color and adds RGB channels', () => {
  const result = scopedChannels('body.portal-body,.portal-shell{--primary:#1d4ed8;--muted:#f2f3ff}');
  assert.deepEqual(result.overrides, ['primary', 'muted']);
  assert.match(result.css, /--primary:#1d4ed8/);
  assert.match(result.css, /--primary-rgb:29, 78, 216/);
});
test('dynamic and missing scoped colors fail closed', () => {
  assert.throws(() => scopedChannels('body.portal-body,.portal-shell{--primary:var(--brand)}'), /Dynamic scoped token/);
  assert.throws(() => scopedChannels('body.portal-body,.portal-shell{--muted:#fff}'), /Missing Portal primary/);
});
