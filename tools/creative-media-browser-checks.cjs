// Shared real-engine checks for the MAUI WebView2 harness. No mock DOM or canvas.
const assert = require('node:assert/strict');
async function checkCreativeMedia(page, navigate) {
  const checks = [];
  const check = async (name, run) => {
    try { await run(); checks.push({ name, status: 'passed' }); console.log(`Creative media: ${name} passed`); }
    catch (error) { checks.push({ name, status: 'failed', error: error.message }); error.mediaChecks = checks; throw error; }
  };
  const ready = async () => {
    await page.getByRole('heading', { name: 'Creative Media', exact: true }).waitFor();
    await page.waitForFunction(() => document.querySelector('[data-canvas-plane]')?.style.transform && document.querySelector('[data-mask-toolbar]')?.parentElement.hasAttribute('data-canvas-toolbar'));
  };
  await navigate(page, '/components/creative-media'); await ready();
  const initialViewport = page.viewportSize() || await page.evaluate(() => ({ width: innerWidth, height: innerHeight }));
  try {
    for (const [width, height] of [[1280, 900], [390, 844]]) {
      await page.setViewportSize({ width, height });
      await check(`editor controls fit ${width}px viewport`, async () => {
        const problems = await page.evaluate(() => {
          const problems = [], canvas = document.querySelector('[data-slot=image-canvas]');
          const bounds = canvas.getBoundingClientRect();
          const groups = [...document.querySelector('[data-mask-toolbar]').children].map(el => el.getBoundingClientRect());
          groups.forEach((r, i) => {
            if (r.left < bounds.left - 1 || r.right > bounds.right + 1) problems.push(`toolbar group ${i} overflows`);
            groups.slice(i + 1).forEach(other => {
              if (Math.min(r.right, other.right) - Math.max(r.left, other.left) > 1 && Math.min(r.bottom, other.bottom) - Math.max(r.top, other.top) > 1) problems.push(`toolbar group ${i} overlaps`);
            });
          });
          for (const clip of document.querySelectorAll('[data-media-clip]')) {
            const r = clip.getBoundingClientRect(), start = clip.querySelector('[data-clip-start]').getBoundingClientRect(), end = clip.querySelector('[data-clip-end]').getBoundingClientRect();
            if (Math.abs(start.left - r.left) > 2 || Math.abs(end.right - r.right) > 2 || start.right > end.left) problems.push('trim handles misplaced');
          }
          if (document.querySelector('[data-crop-details]').open) problems.push('advanced crop fields exposed by default');
          const crop = document.querySelector('[data-crop-stage]').getBoundingClientRect();
          if (crop.height < 100 || crop.height > 385) problems.push('crop frame unbounded');
          for (const el of document.querySelectorAll('[data-creative-section]')) {
            const r = el.getBoundingClientRect(); if (r.left < -1 || r.right > innerWidth + 1) problems.push('section overflows viewport');
          }
          return problems;
        });
        assert.deepEqual(problems, []);
        if (process.env.MAUI_MEDIA_REPORT_DIR) {
          const path = require('node:path');
          const css = await page.evaluate(() => [...document.styleSheets].some(s => s.href?.includes('app.v3.css')) ? 'v3' : 'v4');
          await page.locator('[data-slot=image-canvas]').screenshot({ path: path.join(process.env.MAUI_MEDIA_REPORT_DIR, `${css}-${width}-canvas.png`) });
          await page.locator('[data-creative-image-tools]').screenshot({ path: path.join(process.env.MAUI_MEDIA_REPORT_DIR, `${css}-${width}-image-tools.png`) });
        }
      });
    }
  } finally { await page.setViewportSize(initialViewport); }
  await check('gallery selects requested image', async () => {
    await page.locator('[data-slot=media-grid][data-lightbox-target=creative-preview] [data-media-preview=reference]').click();
    await page.locator('#creative-preview[open]').waitFor();
    assert.equal(await page.locator('[data-media-stage] img').getAttribute('alt'), 'Reference image');
    await page.keyboard.press('Escape');
    await page.locator('#creative-preview').waitFor({ state: 'hidden' });
  });
  await check('asset picker confirms selection', async () => {
    await page.evaluate(() => document.querySelector('[data-slot=asset-picker]').addEventListener('asset-picker:confirm', e => window.__nativeAssets = e.detail.ids, { once: true }));
    await page.locator('[data-slot=dialog-trigger][data-target=creative-assets]').click();
    await page.locator('#creative-assets input[value=reference]').check();
    await page.locator('#creative-assets [data-assets-confirm]').click();
    await page.locator('#creative-assets').waitFor({ state: 'hidden' });
    assert.deepEqual(await page.evaluate(() => window.__nativeAssets), ['reference']);
  });
  await check('overlay keyboard resize uses normalized size', async () => {
    await page.locator('[data-overlay-resize]').press('ArrowRight');
    const width = await page.locator('[data-slot=draggable-overlay]').evaluate(el => Number(el.dataset.width));
    assert.ok(Math.abs(width - .31) < 1e-9, `overlay width ${width}`);
    assert.equal(await page.locator('[data-overlay-resize]').getAttribute('aria-description'), 'Left 10%, top 10%, width 31%, height 20%.');
    assert.equal(await page.locator('[data-slot=draggable-overlay] [role=status]').textContent(), 'Left 10%, top 10%, width 31%, height 20%.');
  });
  await check('timeline trim preserves clip end', async () => {
    await page.locator('[data-media-clip=intro] [data-clip-start]').press('ArrowRight');
    const state = await page.locator('[data-media-clip=intro]').evaluate(el => ({ start: Number(el.dataset.start), duration: Number(el.dataset.length) }));
    assert.ok(Math.abs(state.start - .1) < 1e-9);
    assert.ok(Math.abs(state.start + state.duration - 8) < 1e-9);
    assert.equal(await page.locator('[data-media-clip=intro] [data-clip-start]').getAttribute('aria-description'), 'Start 0.1 seconds, end 8 seconds, duration 7.9 seconds, track 1.');
    assert.equal(await page.locator('[data-slot=media-timeline] [role=status]').textContent(), 'Introduction. Start 0.1 seconds, end 8 seconds, duration 7.9 seconds, track 1.');
  });
  await check('mask undo restores source raster', async () => {
    const canvas = page.locator('[data-slot=mask-brush] canvas');
    await canvas.press('Space');
    const alpha = () => canvas.evaluate(c => c.getContext('2d').getImageData(320, 240, 1, 1).data[3]);
    assert.ok(await alpha() > 0);
    await page.locator('[data-mask-action=undo]').click(); assert.equal(await alpha(), 0);
    await page.locator('[data-mask-action=redo]').click(); assert.ok(await alpha() > 0);
  });
  await check('pen input maps to source pixels', async () => {
    const canvas = page.locator('[data-slot=mask-brush] canvas');
    await canvas.scrollIntoViewIfNeeded(); const box = await canvas.boundingBox(); assert.ok(box);
    const session = await page.context().newCDPSession(page);
    const point = { x: box.x + box.width * .75, y: box.y + box.height * .75, pointerType: 'pen' };
    try {
      await session.send('Input.dispatchMouseEvent', { ...point, type: 'mouseMoved' });
      await session.send('Input.dispatchMouseEvent', { ...point, type: 'mousePressed', button: 'left', buttons: 1, clickCount: 1 });
      await session.send('Input.dispatchMouseEvent', { ...point, type: 'mouseReleased', button: 'left', buttons: 0, clickCount: 1 });
      assert.ok(await canvas.evaluate(c => c.getContext('2d').getImageData(480, 360, 1, 1).data[3] > 0));
    } finally { await session.detach(); }
  });
  await check('touch at DPR 2 retains original mask dimensions', async () => {
    const session = await page.context().newCDPSession(page);
    try {
      await session.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: false });
      await session.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 1 });
      await page.waitForFunction(() => window.innerWidth === 390 && window.devicePixelRatio === 2);
      const canvas = page.locator('[data-slot=mask-brush] canvas'); await canvas.scrollIntoViewIfNeeded();
      // Restore empty strokes so an earlier pen stroke cannot make this assertion pass.
      await canvas.evaluate(c => c.parentElement.dispatchEvent(new CustomEvent('mask-brush:restore', { detail: { version: 1, width: 640, height: 480, strokes: [] } })));
      const box = await canvas.boundingBox(); assert.ok(box);
      const point = { x: box.x + box.width * .75, y: box.y + box.height * .75 };
      await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [point] });
      await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      assert.ok(await canvas.evaluate(c => c.width === 640 && c.height === 480 && c.getContext('2d').getImageData(480, 360, 1, 1).data[3] > 0));
      const viewport = await page.locator('[data-canvas-viewport]').boundingBox(); assert.ok(viewport.width <= 390);
    } finally {
      await session.send('Emulation.setTouchEmulationEnabled', { enabled: false });
      await session.send('Emulation.clearDeviceMetricsOverride');
      await session.detach();
    }
  });
  await check('crop exports Blob and original coordinates', async () => {
    await page.waitForFunction(() => Number(document.querySelector('[data-crop-field=width]')?.value) > 0);
    await page.evaluate(() => document.querySelector('[data-slot=image-crop]').addEventListener('image-crop:apply', e => {
      window.__nativeCrop = { blob: e.detail.blob instanceof Blob, type: e.detail.blob.type, crop: e.detail.crop, width: e.detail.width, height: e.detail.height };
    }, { once: true }));
    await page.locator('[data-slot=image-crop-apply]').click(); await page.waitForFunction(() => window.__nativeCrop);
    const result = await page.evaluate(() => window.__nativeCrop);
    assert.equal(result.blob, true); assert.equal(result.type, 'image/png');
    assert.ok(result.width > 0 && result.height > 0 && result.crop.x >= 0 && result.crop.y >= 0);
  });
  await check('comparison follows controlled value and reduced motion', async () => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.locator('[data-slot=image-compare]').evaluate(el => {
      window.__nativeCompareChanges = 0;
      el.addEventListener('image-compare:change', () => window.__nativeCompareChanges++);
      el.dataset.position = '27';
    });
    await page.waitForFunction(() => document.querySelector('img-comparison-slider')?.getAttribute('aria-valuenow') === '27');
    await page.locator('img-comparison-slider').press('ArrowRight');
    assert.equal(await page.locator('img-comparison-slider').getAttribute('aria-valuenow'), '28');
    assert.equal(await page.evaluate(() => window.__nativeCompareChanges), 1);
    assert.equal(await page.locator('img-comparison-slider').evaluate(el => getComputedStyle(el).getPropertyValue('--default-transition-time').trim()), '0ms');
    const shadows = await page.locator('img-comparison-slider').evaluate(el => ['--divider-shadow', '--default-handle-shadow'].map(name => getComputedStyle(el).getPropertyValue(name).trim()));
    assert.ok(shadows.every(value => value && value !== 'none'), `comparison shadows: ${shadows}`);
  });
  await check('Blazor navigation disposes old media handlers', async () => {
    await page.evaluate(() => {
      window.__nativeDocumentToken = 'same-webview';
      window.__oldOverlay = document.querySelector('[data-slot=draggable-overlay]');
      window.__oldOverlayChanges = 0;
      window.__oldOverlay.addEventListener('draggable-overlay:change', () => window.__oldOverlayChanges++);
    });
    await navigate(page, '/components/button');
    await page.getByRole('heading', { name: 'Button', exact: true }).waitFor();
    await page.waitForFunction(() => !document.querySelector('[data-mask-toolbar]'));
    // Allow the actual WebView mutation observer's teardown to run before probing the stale node.
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(resolve)));
    assert.equal(await page.evaluate(() => {
      window.__oldOverlay.querySelector('[data-overlay-move]').dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
      return window.__oldOverlayChanges;
    }), 0);
    await navigate(page, '/components/creative-media'); await ready();
    assert.equal(await page.locator('[data-mask-toolbar]').count(), 1);
    await page.locator('[data-overlay-move]').press('ArrowRight');
    assert.ok(Math.abs(await page.locator('[data-slot=draggable-overlay]').evaluate(el => Number(el.dataset.x)) - .11) < 1e-9);
    assert.equal(await page.evaluate(() => window.__nativeDocumentToken), 'same-webview');
  });
  return checks;
}
module.exports = { checkCreativeMedia };
