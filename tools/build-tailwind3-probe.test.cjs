const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { build, configFor } = require('./build-tailwind3-probe.cjs');
const root = path.resolve(__dirname, '..');

test('probe refuses to overwrite either demo, and includes the MAUI host HTML', async () => {
  await assert.rejects(build('web', path.join(root, 'demo/Unpoly.Blazor.Shadcn.Demo/wwwroot/app.css')), /outside the submodule/);
  await assert.rejects(build('other', path.join(os.tmpdir(), 'probe.css')), /web or maui/);
  await assert.rejects(build('web', path.resolve(root, '../../docs/probe.css')), /temporary directory/);
  for (const name of ['Unpoly.Blazor.Shadcn.Demo', 'Unpoly.Blazor.Shadcn.Maui']) {
    const demo = path.join(root, 'demo', name);
    const host = path.join(demo, 'wwwroot/index.html');
    assert.equal(configFor(demo).config.content.includes(host), fs.existsSync(host));
  }
});
