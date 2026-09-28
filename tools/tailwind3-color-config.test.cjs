const test = require('node:test');
const assert = require('node:assert/strict');
const { createColorConfig } = require('./tailwind3-color-config.cjs');
const { channels } = require('./postcss-color-channels.cjs');

test('v3 runtime alpha utilities use Safari 15-valid comma-channel rgba syntax', () => {
  const primary = createColorConfig().primary;
  assert.equal(primary({}), 'var(--primary)');
  assert.equal(primary({ opacityValue: '0.5' }),
    'rgba(var(--primary-rgb), calc(var(--primary-alpha, 1) * 0.5))');
  assert.equal(channels('rgba(255, 255, 255, 0.1)').rgb, '255, 255, 255');
  // Slash-alpha rgb() and comma-separated channels must not be paired.
  assert.ok(!primary({ opacityValue: '0.5' }).includes(' / '));
});
