#!/usr/bin/env node
// Opt-in ~1 minute regeneration and selector-name audit of BOTH demo heads.
// It cannot certify style, interaction, WebView or Safari parity.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const assert = require('node:assert/strict');
const { build } = require('./build-tailwind3-probe.cjs');
const { classes, compare } = require('./audit-css-classes.cjs');
async function main() {
  const root = path.resolve(__dirname, '..');
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'shadcn-v3-audit-'));
  try {
    for (const [head, name, expectedCount] of [
      ['web', 'Unpoly.Blazor.Shadcn.Demo', 1622],
      ['maui', 'Unpoly.Blazor.Shadcn.Maui', 1512],
    ]) {
      const output = path.join(temp, `${head}.css`);
      await build(head, output);
      const v4 = fs.readFileSync(path.join(root, 'demo', name, 'wwwroot/app.css'), 'utf8');
      const result = compare(classes(v4), classes(fs.readFileSync(output, 'utf8')));
      assert.equal(result.baselineCount, expectedCount, `Recheck ${head} v4 baseline`);
      assert.deepEqual(result.missing, [], `${head} missing baseline class names`);
      console.log(`${head}: 0/${expectedCount} missing selector class names (NOT CSS/interaction parity)`);
    }
  } finally { fs.rmSync(temp, { recursive: true, force: true }); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
