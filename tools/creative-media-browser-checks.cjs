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
  await check('asset picker keeps selections across interactive pages', async () => {
    await page.evaluate(() => document.querySelector('[data-slot=asset-picker]').addEventListener('asset-picker:confirm', e => window.__nativePages = e.detail.ids, { once: true }));
    await page.locator('[data-slot=dialog-trigger][data-target=creative-assets]').click();
    await page.locator('#creative-assets input[value=reference]').check();
    await page.getByRole('navigation', { name: 'Asset pages' }).getByRole('button', { name: 'Page 2' }).click();
    await page.locator('#creative-assets input[value=sketch]').check();
    await page.getByRole('navigation', { name: 'Asset pages' }).getByRole('button', { name: 'Page 1', exact: true }).click();
    await page.locator('#creative-assets input[value=reference]').waitFor();
    await page.locator('#creative-assets [data-assets-confirm]').click();
    assert.deepEqual(await page.evaluate(() => window.__nativePages), ['reference', 'sketch']);
  });
  await check('asset picker renders only the requested library page', async () => {
    await page.locator('[data-slot=dialog-trigger][data-target=creative-assets]').click();
    assert.equal(await page.locator('#creative-assets [data-media-id]').count(), 10);
    await page.getByRole('navigation', { name: 'Asset pages' }).getByRole('button', { name: 'Page 11', exact: true }).click();
    await page.locator('#creative-assets [data-media-id="asset-100"]').waitFor();
    assert.equal(await page.locator('#creative-assets [data-media-id]').count(), 1);
    await page.getByRole('navigation', { name: 'Asset pages' }).getByRole('button', { name: 'Page 1', exact: true }).click();
    await page.locator('#creative-assets input[value=reference]').waitFor();
    await page.locator('#creative-assets [data-assets-confirm]').click();
  });
  await check('asset picker browsing does not request full media', async () => {
    const requests = [];
    const onRequest = request => { if (request.url().includes('?full=') || request.url().includes('flower.mp4')) requests.push(request.url()); };
    page.on('request', onRequest);
    try {
      await page.locator('[data-slot=dialog-trigger][data-target=creative-assets]').click();
      await page.getByRole('navigation', { name: 'Asset pages' }).getByRole('button', { name: 'Page 2', exact: true }).click();
      await page.locator('#creative-assets [data-media-id="asset-12"]').waitFor();
      await page.waitForLoadState('networkidle');
      assert.deepEqual(requests, []);
      await page.getByRole('navigation', { name: 'Asset pages' }).getByRole('button', { name: 'Page 1', exact: true }).click();
      await page.locator('#creative-assets input[value=reference]').waitFor();
      await page.locator('#creative-assets [data-assets-confirm]').click();
    } finally { page.off('request', onRequest); }
  });
  await check('tiny overlay controls are clickable at minimum zoom', async () => {
    const canvas = page.locator('[data-slot=image-canvas]'), overlay = page.locator('[data-slot=draggable-overlay]');
    const before = await canvas.evaluate(el => {
      const m = new DOMMatrix(el.querySelector('[data-canvas-plane]').style.transform);
      const o = el.querySelector('[data-slot=draggable-overlay]').dataset;
      return { view: { version: 1, scale: m.a, x: m.e, y: m.f }, rect: { version: 1, x: +o.x, y: +o.y, width: +o.width, height: +o.height } };
    });
    try {
      await overlay.evaluate(el => el.dispatchEvent(new CustomEvent('draggable-overlay:set', { detail: { version: 1, x: .45, y: .45, width: .01, height: .01 } })));
      await canvas.evaluate(el => { const v = el.querySelector('[data-canvas-viewport]').getBoundingClientRect(); el.dispatchEvent(new CustomEvent('image-canvas:restore', { detail: { version: 1, scale: .02, x: v.width / 2 - 6.4, y: v.height / 2 - 4.8 } })); });
      for (const selector of ['[data-overlay-move]', '[data-overlay-resize]']) {
        const handle = page.locator(selector), box = await handle.boundingBox();
        assert.ok(box && box.width >= 24 && box.height >= 24, `${selector} target is too small`);
        await handle.click();
      }
    } finally {
      await overlay.evaluate((el, rect) => el.dispatchEvent(new CustomEvent('draggable-overlay:set', { detail: rect })), before.rect);
      await canvas.evaluate((el, view) => el.dispatchEvent(new CustomEvent('image-canvas:restore', { detail: view })), before.view);
    }
  });
  await check('full-width overlay controls remain inside the viewport', async () => {
    const overlay = page.locator('[data-slot=draggable-overlay]');
    const before = await overlay.evaluate(el => { const o = el.dataset; return { version: 1, x: +o.x, y: +o.y, width: +o.width, height: +o.height }; });
    try {
      await overlay.evaluate(el => el.dispatchEvent(new CustomEvent('draggable-overlay:set', { detail: { version: 1, x: 0, y: 0, width: 1, height: 1 } })));
      for (const selector of ['[data-overlay-move]', '[data-overlay-resize]']) {
        const handle = page.locator(selector);
        assert.ok(await handle.evaluate(el => { const r=el.getBoundingClientRect(), v=el.closest('[data-canvas-viewport]').getBoundingClientRect(); return r.left >= v.left && r.right <= v.right && r.top >= v.top && r.bottom <= v.bottom; }), `${selector} clipped`);
        await handle.click();
      }
    } finally { await overlay.evaluate((el, rect) => el.dispatchEvent(new CustomEvent('draggable-overlay:set', { detail: rect })), before); }
  });
  await check('overlay keyboard resize uses normalized size', async () => {
    await page.locator('[data-overlay-resize]').press('ArrowRight');
    const width = await page.locator('[data-slot=draggable-overlay]').evaluate(el => Number(el.dataset.width));
    assert.ok(Math.abs(width - .31) < 1e-9, `overlay width ${width}`);
  });
  await check('timeline trim preserves clip end', async () => {
    await page.locator('[data-media-clip=intro] [data-clip-start]').press('ArrowRight');
    const state = await page.locator('[data-media-clip=intro]').evaluate(el => ({ start: Number(el.dataset.start), duration: Number(el.dataset.length) }));
    assert.ok(Math.abs(state.start - .1) < 1e-9);
    assert.ok(Math.abs(state.start + state.duration - 8) < 1e-9);
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
