const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const postcss = require('postcss');
const { messageSlotCompat, v3, v4 } = require('./postcss-message-slot-compat.cjs');

test('MessageContent child data-slot targets the child, pinned to v4 CSS', async () => {
  const baseline = postcss.parse(fs.readFileSync(path.join(__dirname, '../demo/Unpoly.Blazor.Shadcn.Demo/wwwroot/app.css'), 'utf8'));
  const found = [];
  baseline.walkRules(rule => { if (rule.selector === v4) found.push(rule); });
  assert.equal(found.length, 1);
  assert.deepEqual(found[0].nodes.filter(node => node.type === 'decl').map(node => `${node.prop}:${node.value}`), ['align-self:flex-end']);
  const v3Css = `${v3} { align-self: flex-end }`;
  const output = (await postcss([messageSlotCompat()]).process(v3Css, { from: undefined })).css;
  assert.equal(output, `${v4} { align-self: flex-end }`);
  assert.equal((await postcss([messageSlotCompat()]).process(output, { from: undefined })).css, output);
  await assert.rejects(postcss([messageSlotCompat()]).process(`${v3}:hover { align-self: flex-end }`, { from: undefined }), /Unexpected/);
  await assert.rejects(postcss([messageSlotCompat()]).process(`${v3} { align-self: center }`, { from: undefined }), /Unexpected/);
});
