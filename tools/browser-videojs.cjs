#!/usr/bin/env node
// Real-browser check of the Video.js 10 VideoPlayer on the demo page. Needs the Web demo running:
//   dotnet run --project demo/Unpoly.Blazor.Shadcn.Demo --urls http://127.0.0.1:5187
//   node tools/browser-videojs.cjs                   # BEHAVIOUR_URL overrides the base URL
// Uses Edge (channel msedge) through playwright-core. The page's video URL is served from a local clip
// made with ffmpeg, so the run does not depend on the network; screenshots go to the OS temp folder.
// Prints PASS/FAIL per check and exits non-zero on any FAIL.
const { chromium } = require('playwright-core')
const { execFileSync } = require('node:child_process')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')

const base = process.env.BEHAVIOUR_URL || 'http://127.0.0.1:5187'
const pageUrl = `${base}/components/video-player`
const work = path.join(os.tmpdir(), 'ivg-vjs')
const shots = path.join(work, 'shots')
fs.mkdirSync(shots, { recursive: true })

let failures = 0
function check(name, ok, detail = '') {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`)
  if (!ok) failures++
}

function makeClip(file, size) {
  if (fs.existsSync(file)) return
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'lavfi', '-i', `testsrc=size=${size}:rate=15:duration=8`,
    '-pix_fmt', 'yuv420p', '-movflags', '+faststart', file])
}

// Serves the clip with Range support: seeking and some browsers' media stack need 206 responses.
async function serveClip(page, file) {
  const body = fs.readFileSync(file)
  await page.route('**/flower.mp4', (route) => {
    const range = route.request().headers().range
    const common = { 'accept-ranges': 'bytes', 'access-control-allow-origin': '*' }
    if (!range) return route.fulfill({ status: 200, contentType: 'video/mp4', headers: common, body })
    const m = /bytes=(\d+)-(\d*)/.exec(range)
    const start = Number(m[1])
    const end = m[2] ? Number(m[2]) : body.length - 1
    return route.fulfill({
      status: 206, contentType: 'video/mp4',
      headers: { ...common, 'content-range': `bytes ${start}-${end}/${body.length}` },
      body: body.subarray(start, end + 1),
    })
  })
}

function watch(page, sink) {
  page.on('console', (m) => { if (m.type() === 'error') sink.push(`console.error: ${m.text()}`.slice(0, 200)) })
  page.on('pageerror', (e) => sink.push(`pageerror: ${e.message}`.slice(0, 200)))
}

async function upgraded(page, timeout = 15000) {
  await page.waitForFunction(() => !!customElements.get('video-skin'), null, { timeout })
  await page.waitForFunction(() => document.querySelector('[data-slot="video-player"]')?.dataset.videojs === 'ready', null, { timeout })
}

;(async () => {
  makeClip(path.join(work, 'landscape.mp4'), '320x180')
  const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--autoplay-policy=no-user-gesture-required'] })

  // ---- 1. the module loads, the skin upgrades, native controls step aside -----------------------
  {
    const errors = []
    const page = await browser.newPage({ viewport: { width: 1100, height: 1400 } })
    watch(page, errors)
    await serveClip(page, path.join(work, 'landscape.mp4'))
    await page.goto(pageUrl, { waitUntil: 'load' })
    await upgraded(page)
    await page.waitForTimeout(800)

    const state = await page.evaluate(() => {
      const players = [...document.querySelectorAll('[data-slot="video-player"]')]
      return players.map((p) => ({
        state: p.dataset.videojs,
        nativeControls: p.querySelector('video').controls,
        title: p.querySelector('video-player').getAttribute('content-title'),
        tracks: p.querySelector('video').textTracks.length,
        ratio: (() => { const r = p.querySelector('video-skin').getBoundingClientRect(); return r.height / r.width })(),
      }))
    })
    check('every player upgrades to ready', state.length >= 6 && state.every((p) => p.state === 'ready'), `${state.length} players`)
    check('native controls are removed once the skin owns the player (no double control bar)',
      state.every((p) => p.nativeControls === false), JSON.stringify(state.map((p) => p.nativeControls)))
    const portrait = state.find((p) => p.ratio > 1.2)
    check('a 9/16 player is taller than wide', !!portrait, portrait ? `h/w ${portrait.ratio.toFixed(2)}` : 'none found')
    check('captions example exposes its <track> to the video', state.some((p) => p.tracks >= 1))
    check('title reaches the player', state.some((p) => p.title === 'Bông hoa'))

    const first = page.locator('[data-slot="video-player"]').first()
    await first.screenshot({ path: path.join(shots, '1-idle.png') })
    const titled = page.locator('[data-slot="video-player"]').nth(1)
    await titled.scrollIntoViewIfNeeded()
    await titled.hover()
    await page.waitForTimeout(500)
    await titled.screenshot({ path: path.join(shots, '1b-poster-title.png') })
    await first.scrollIntoViewIfNeeded()

    // playing
    await first.locator('video').evaluate((v) => v.play())
    await page.waitForTimeout(900)
    check('play() starts playback and time advances', await first.locator('video').evaluate((v) => !v.paused && v.currentTime > 0.3))
    await first.hover()
    await page.waitForTimeout(300)
    await first.screenshot({ path: path.join(shots, '2-playing.png') })

    // settings menu
    await first.locator('.media-settings-menu-trigger').click()
    await page.waitForTimeout(500)
    await first.screenshot({ path: path.join(shots, '3-settings-menu.png') })
    const menuText = await first.locator('media-menu-content').first().innerText().catch(() => '')
    check('settings menu offers Speed', /speed|tốc độ/i.test(menuText), JSON.stringify(menuText.slice(0, 80)))
    check('labels follow lang="vi" (the Vietnamese locale is registered before the skin renders)', /tốc độ/i.test(menuText) && !/speed/i.test(menuText), JSON.stringify(menuText.slice(0, 80)))
    await page.keyboard.press('Escape')

    // Captions appear in the menu only when the video carries a <track>: the captions example has one.
    const withTrack = page.locator('[data-slot="video-player"]').filter({ has: page.locator('track') }).first()
    await withTrack.scrollIntoViewIfNeeded()
    await withTrack.locator('.media-settings-menu-trigger').click()
    await page.waitForTimeout(500)
    const trackMenu = await withTrack.locator('media-menu-content').first().innerText().catch(() => '')
    check('settings menu offers Captions when the video has a track', /caption|phụ đề/i.test(trackMenu), JSON.stringify(trackMenu.slice(0, 80)))
    await withTrack.screenshot({ path: path.join(shots, '3b-captions-menu.png') })
    await page.keyboard.press('Escape')

    // hovering the time slider
    // The controls auto-hide while playing: wake them by moving inside the player, then hover the slider.
    const player = await first.boundingBox()
    await page.mouse.move(player.x + player.width / 2, player.y + player.height / 2)
    await page.mouse.move(player.x + player.width / 2 + 5, player.y + player.height / 2 + 5, { steps: 3 })
    await page.waitForTimeout(500)
    const slider = first.locator('media-time-slider')
    let reachable = true
    await slider.hover({ position: { x: 150, y: 6 }, timeout: 5000 }).catch(() => { reachable = false })
    check('the time slider can be hovered while the controls are awake', reachable)
    await page.waitForTimeout(500)
    await first.screenshot({ path: path.join(shots, '4-time-hover.png') })

    check('no console errors or page errors', errors.length === 0, errors.join(' | '))
    await page.close()
  }

  // ---- 2. two players keep separate state and hotkeys -------------------------------------------
  {
    const page = await browser.newPage({ viewport: { width: 1100, height: 1400 } })
    await serveClip(page, path.join(work, 'landscape.mp4'))
    await page.goto(pageUrl, { waitUntil: 'load' })
    await upgraded(page)
    const players = page.locator('[data-slot="video-player"]')
    const count = await players.count()
    const a = players.nth(count - 2)
    const b = players.nth(count - 1)
    await a.scrollIntoViewIfNeeded()
    const mutedOf = (p) => p.locator('video').evaluate((v) => v.muted)
    const beforeA = await mutedOf(a)
    const beforeB = await mutedOf(b)
    await a.locator('media-mute-button').first().focus()
    await page.keyboard.press('m')
    await page.waitForTimeout(250)
    check('hotkey m acts on the focused player only', (await mutedOf(a)) !== beforeA && (await mutedOf(b)) === beforeB,
      `A ${beforeA}->${await mutedOf(a)}, B ${beforeB}->${await mutedOf(b)}`)
    await b.scrollIntoViewIfNeeded()
    await b.screenshot({ path: path.join(shots, '5-second-player.png') })
    await page.close()
  }

  // ---- 3. a player inside an Unpoly-swapped fragment upgrades and plays --------------------------
  {
    const page = await browser.newPage({ viewport: { width: 900, height: 900 } })
    await serveClip(page, path.join(work, 'landscape.mp4'))
    await page.goto(pageUrl, { waitUntil: 'load' })
    await upgraded(page)
    await page.evaluate(async () => {
      const host = document.createElement('div')
      host.id = 'swap-host'
      host.innerHTML = '<p>old</p>'
      document.body.prepend(host)
      const fragment = '<div id="swap-host"><video-player data-slot="video-player" style="display:block"><video-skin style="display:block;width:100%;aspect-ratio:16/9">' +
        '<video id="swapped" src="https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4" controls playsinline></video></video-skin></video-player></div>'
      await up.render({ target: '#swap-host', fragment, history: false }).finished
    })
    await page.waitForFunction(() => document.querySelector('#swap-host [data-slot="video-player"]')?.dataset.videojs === 'ready', null, { timeout: 10000 })
      .then(() => check('a player added by an Unpoly swap upgrades to ready', true))
      .catch(() => check('a player added by an Unpoly swap upgrades to ready', false, 'data-videojs never became ready'))
    check('the swapped-in player also loses its native controls', await page.evaluate(() => document.querySelector('#swapped').controls === false))
    await page.close()
  }

  // ---- 4. the module cannot load: the native controls must remain --------------------------------
  {
    const page = await browser.newPage({ viewport: { width: 900, height: 900 } })
    await serveClip(page, path.join(work, 'landscape.mp4'))
    await page.route('**/videojs/video.js', (route) => route.abort())
    await page.goto(pageUrl, { waitUntil: 'load' })
    await page.waitForFunction(() => document.querySelector('[data-slot="video-player"]')?.dataset.videojs === 'failed', null, { timeout: 15000 })
      .then(() => check('a failed module load marks the player failed', true))
      .catch(() => check('a failed module load marks the player failed', false, 'never marked failed'))
    const left = await page.evaluate(() => ({
      controls: document.querySelector('[data-slot="video-player"] video').controls,
      defined: !!customElements.get('video-skin'),
    }))
    check('after a failed load the native controls stay usable', left.controls === true && left.defined === false, JSON.stringify(left))
    await page.locator('[data-slot="video-player"]').first().screenshot({ path: path.join(shots, '6-fallback.png') })
    await page.close()
  }

  await browser.close()
  console.log(`\nscreenshots: ${shots}`)
  console.log(failures ? `\n${failures} check(s) FAILED` : '\nall checks passed')
  process.exit(failures ? 1 : 0)
})().catch((error) => { console.error('ERROR', error); process.exit(2) })
