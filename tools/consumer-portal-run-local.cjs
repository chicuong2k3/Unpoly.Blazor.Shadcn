#!/usr/bin/env node
// Run the read-only CSS substitution probe against a disposable Portal host.
// No operator data, payment provider or POS database is used.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const net = require('node:net');
const { spawn } = require('node:child_process');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '../../..');
const portal = path.join(root, 'src/Pos.Portal.Web');
const dll = path.join(portal, 'bin/Debug/net10.0/Pos.Portal.Web.dll');
const chromium = process.argv[2];
const mode = process.argv[3];
if (mode && !['--no-js', '--host-preview', '--host-preview-no-js'].includes(mode)) throw Error('Unsupported Portal probe mode');
if (!chromium || !fs.existsSync(chromium) || !fs.existsSync(dll))
  throw Error('usage: consumer-portal-run-local.cjs <chromium.exe> [--no-js|--host-preview|--host-preview-no-js]; build Portal Debug first');
(async () => {
  const server = net.createServer();
  await new Promise((resolve, reject) => server.once('error', reject).listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  await new Promise(resolve => server.close(resolve));
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'portal-v3-css-probe-'));
  const host = spawn('dotnet', [dll], { cwd: portal, env: {
    ...process.env, ASPNETCORE_ENVIRONMENT: 'Development', ASPNETCORE_URLS: `http://127.0.0.1:${port}`,
    POS_PORTAL_DATA_DIR: dataDir,
  }, stdio: ['ignore', 'pipe', 'pipe'] });
  const stop = signal => {
    host.kill();
    process.exitCode = signal === 'SIGINT' ? 130 : 143;
  };
  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);
  let logs = '';
  for (const stream of [host.stdout, host.stderr]) stream.on('data', chunk => { logs = (logs + chunk.toString()).slice(-6000); });
  try {
    let ready = false;
    for (let i = 0; i < 100; i++) {
      assert.equal(host.exitCode, null, `Portal exited during startup: ${logs}`);
      try { const result = await fetch(`http://127.0.0.1:${port}/`); if (result.ok) { ready = true; break; } } catch { /* starting */ }
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    assert.ok(ready, `Isolated Portal failed to start: ${logs}`);
    const probe = spawn(process.execPath, [path.join(__dirname, 'consumer-portal-pages-browser.cjs'), `http://127.0.0.1:${port}/`, chromium, ...(mode ? [mode] : [])], { stdio: 'inherit' });
    const status = await new Promise((resolve, reject) => { probe.once('error', reject); probe.once('exit', (code, signal) => resolve({ code, signal })); });
    assert.deepEqual(status, { code: 0, signal: null }, 'Portal CSS browser probe failed');
  } finally {
    host.kill();
    if (host.exitCode === null && host.signalCode === null) await Promise.race([
      new Promise(resolve => host.once('exit', resolve)),
      new Promise(resolve => setTimeout(resolve, 5000)),
    ]);
    process.removeListener('SIGINT', stop);
    process.removeListener('SIGTERM', stop);
    if (host.exitCode === null && host.signalCode === null) throw Error(`Portal did not exit; isolated data retained: ${dataDir}`);
    fs.rmSync(dataDir, { recursive: true, force: true });
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
