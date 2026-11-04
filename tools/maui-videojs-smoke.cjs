#!/usr/bin/env node
// Windows MAUI WebView2 check of the Video.js VideoPlayer: does the ES module load in the WebView,
// does the skin upgrade, are the native controls gone, and is the UI Vietnamese?
//   dotnet build demo/Unpoly.Blazor.Shadcn.Maui/Unpoly.Blazor.Shadcn.Maui.csproj -f net10.0-windows10.0.19041.0
//   node tools/maui-videojs-smoke.cjs
// Opens the demo window for a few seconds (the same approach as maui-webview-smoke.cjs: a loopback
// CDP port and a disposable WebView profile, only for the child launched here) and closes it again.
const { spawn, execFileSync } = require('node:child_process')
const net = require('node:net')
const http = require('node:http')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { chromium } = require('playwright-core')

const executable = process.env.MAUI_SMOKE_EXE
  ? path.resolve(process.env.MAUI_SMOKE_EXE)
  : path.resolve(__dirname, '../demo/Unpoly.Blazor.Shadcn.Maui/bin/Debug/net10.0-windows10.0.19041.0/win-x64/Unpoly.Blazor.Shadcn.Maui.exe')

let failures = 0
function check(name, ok, detail = '') {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`)
  if (!ok) failures++
}
const freePort = () => new Promise((resolve, reject) => {
  const server = net.createServer()
  server.listen(0, '127.0.0.1', () => { const { port } = server.address(); server.close(() => resolve(port)) })
  server.on('error', reject)
})
const status = (url) => new Promise((resolve, reject) => {
  http.get(url, (res) => { res.resume(); res.on('end', () => resolve(res.statusCode)) }).on('error', reject)
})
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

;(async () => {
  if (process.platform !== 'win32') throw Error('Windows WebView2 required')
  if (!fs.existsSync(executable)) throw Error(`Build the MAUI demo first: ${executable} not found`)

  const port = await freePort()
  const profile = path.join(os.tmpdir(), `shadcn-maui-videojs-${process.pid}`)
  const child = spawn(executable, [], {
    cwd: path.dirname(executable), detached: true, stdio: 'ignore',
    env: { ...process.env, WEBVIEW2_USER_DATA_FOLDER: profile,
      WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS: `--remote-debugging-port=${port} --remote-debugging-address=127.0.0.1 --autoplay-policy=no-user-gesture-required` },
  })
  let browser
  try {
    const endpoint = `http://127.0.0.1:${port}`
    for (let n = 0; ; n++) {
      if (child.exitCode !== null) throw Error(`MAUI exited ${child.exitCode}`)
      try { if (await status(endpoint + '/json/version') === 200) break } catch { /* not up yet */ }
      if (n > 120) throw Error('No WebView2 CDP endpoint in 60s')
      await sleep(500)
    }
    browser = await chromium.connectOverCDP(endpoint)
    let page
    for (let n = 0; n < 100 && !page; n++) {
      page = browser.contexts().flatMap((c) => c.pages()).find((pg) => /0\.0\.0\.1/.test(pg.url()))
      if (!page) await sleep(500)
    }
    if (!page) throw Error('MAUI page not found')
    const errors = []
    page.on('pageerror', (e) => errors.push(String(e).slice(0, 200)))
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 200)) })

    const link = page.locator('a[data-slot="item"][href="/components/video-player"]').first()
    await link.waitFor({ state: 'visible', timeout: 30000 })
    await link.evaluate((el) => el.scrollIntoView({ block: 'center', behavior: 'instant' }))
    await link.click({ timeout: 15000 })
    await page.waitForFunction(() => location.pathname === '/components/video-player', null, { timeout: 15000 })
    console.log('page:', page.url())

    const ready = await page.waitForFunction(
      () => document.querySelector('[data-slot="video-player"]')?.dataset.videojs === 'ready', null, { timeout: 30000 })
      .then(() => true).catch(() => false)
    check('the Video.js ES module loads in the MAUI WebView and the player is marked ready', ready)
    const state = await page.evaluate(() => {
      const p = document.querySelector('[data-slot="video-player"]')
      const sk = document.querySelector('video-skin')
      return {
        defined: !!customElements.get('video-skin'),
        nativeControls: p?.querySelector('video')?.controls,
        play: sk?.shadowRoot?.querySelector('media-play-button')?.getAttribute('aria-label'),
        state: p?.dataset.videojs,
      }
    })
    check('the skin is registered', state.defined, JSON.stringify(state))
    check('native controls step aside', state.nativeControls === false)
    check('the UI is Vietnamese (play button label)', state.play === 'Phát', String(state.play))
    await page.locator('[data-slot="video-player"]').first().screenshot({ path: path.join(os.tmpdir(), 'maui-videojs.png') })
    check('no console or page errors', errors.length === 0, errors.join(' | '))
    console.log('screenshot:', path.join(os.tmpdir(), 'maui-videojs.png'))
  } catch (error) {
    check('the check ran to completion', false, String(error.message || error))
  } finally {
    try { await browser?.close() } catch { /* the window is going away anyway */ }
    try { execFileSync('taskkill', ['/T', '/F', '/PID', String(child.pid)], { stdio: 'ignore' }) } catch { /* already gone */ }
    try { fs.rmSync(profile, { recursive: true, force: true }) } catch { /* profile still locked: harmless temp */ }
  }
  console.log(failures ? `\n${failures} check(s) FAILED` : '\nall checks passed')
  process.exit(failures ? 1 : 0)
})().catch((error) => { console.error('ERROR', error); process.exit(2) })
