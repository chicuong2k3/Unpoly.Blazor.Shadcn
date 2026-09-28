#!/usr/bin/env node
// Diagnostic only: same SSR component preview in two no-JS stylesheets. Not a
// behavioural or per-state parity certificate; reports differences for review.
const { chromium } = require('playwright-core');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const sharp = require('sharp');
const { componentRoutes } = require('./demo-route-regression-browser.cjs');
const base = process.env.BEHAVIOUR_URL || 'http://127.0.0.1:5187';
const matched = process.env.DEMO_ROUTE_FILTER
  ? componentRoutes().filter(x => new RegExp(process.env.DEMO_ROUTE_FILTER).test(x)) : componentRoutes();
const routes = process.env.DEMO_ROUTE_START ? matched.slice(matched.findIndex(x => x.endsWith('/' + process.env.DEMO_ROUTE_START))) : matched;
const width = Number(process.env.DEMO_VISUAL_WIDTH || 1280);
if (!Number.isInteger(width) || width < 320 || width > 2560) throw Error('DEMO_VISUAL_WIDTH must be an integer 320..2560');
const theme = process.env.DEMO_VISUAL_THEME || '';
if (theme && !/^[a-z0-9-]{1,40}$/.test(theme)) throw Error('Invalid DEMO_VISUAL_THEME');
const dark = process.env.DEMO_VISUAL_DARK === '1';
const previewId = process.env.DEMO_VISUAL_PREVIEW_ID || '';
if (previewId && !/^preview-[a-z0-9-]+$/.test(previewId)) throw Error('Invalid DEMO_VISUAL_PREVIEW_ID');
const allPreviews = process.env.DEMO_VISUAL_ALL_PREVIEWS === '1';
if (allPreviews && previewId) throw Error('DEMO_VISUAL_ALL_PREVIEWS cannot be combined with DEMO_VISUAL_PREVIEW_ID');
async function capture(browser, route, css) {
  console.log(`capture ${route} ${css}`);
  const context = await browser.newContext({ javaScriptEnabled: false, viewport: { width, height: 900 }, reducedMotion: 'reduce' });
  try {
    const page = await context.newPage();
    // External fonts are not part of compiled Tailwind parity and may stall screenshots
    // indefinitely on disconnected CI; both heads use the same fallback face.
    await page.route('https://fonts.googleapis.com/**', request => request.abort());
    await page.route('https://fonts.gstatic.com/**', request => request.abort());
    // Remote photo delivery races the v4/v3 screenshots and can block the
    // stylesheet wait on disconnected hosts. A fixed pixel keeps the image
    // component's layout without conflating CDN timing with CSS parity.
    const pixel = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/8wAAAABJRU5ErkJggg==', 'base64');
    await page.route('https://images.unsplash.com/**', request => request.fulfill({status:200,contentType:'image/png',body:pixel}));
    await page.route('https://picsum.photos/**', request => request.fulfill({status:200,contentType:'image/png',body:pixel}));
    // A remote video can be on a different frame (or still buffering) between
    // serial captures. Reject media for this CSS-only first-paint comparison.
    if (route === '/components/video-player') await page.route('https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4', request => request.abort());
    // Attachment thumbnails also use a remote placeholder service. Serve one
    // stable SVG at the authored 160x120 dimensions to compare CSS, not CDN
    // response races or lazy-image decode timing across separate page loads.
    if (route === '/components/attachment') await page.route('https://placehold.co/**', request => request.fulfill({
      status:200,contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="160" height="120"><rect width="160" height="120" fill="#e4e4e7"/></svg>'
    }));
    if (css === 'v3' || dark || theme) await page.route(`${base}${route}`, async request => {
      const response = await request.fetch();
      let body = await response.text();
      if (css === 'v3') {
        if (!body.includes('id="demo-app-css" rel="stylesheet" href="app.css')) throw Error('Expected static v4 demo CSS link');
        body = body.replace(/(id="demo-app-css" rel="stylesheet" href=")app\.css/, '$1app.v3.css');
      }
      if (dark || theme) {
        if (!body.includes('class="js-has-pseudo"')) throw Error('Expected SSR html theme root');
        body = body.replace('class="js-has-pseudo"', `class="js-has-pseudo${dark?' dark':''}"${theme?` data-theme="${theme}"`:''}`);
      }
      await request.fulfill({ response, body });
    });
    await page.goto(`${base}${route}`, {waitUntil:'domcontentloaded',timeout:15000});
    if (dark || theme) {
      const actual = await page.locator('html').evaluate(el => ({dark:el.classList.contains('dark'),theme:el.dataset.theme || ''}));
      if (actual.dark !== dark || actual.theme !== theme) throw Error(`${route} ${css}: SSR theme not applied: ${JSON.stringify(actual)}`);
    }
    await page.waitForFunction(() => {
      const link = document.getElementById('demo-app-css');
      return [...document.styleSheets].some(s => s.ownerNode === link && s.cssRules.length > 100);
    }, null, {timeout:30000});
    console.log(`loaded CSS ${route} ${css}`);
    const standalone = ({
      '/components/image-crop': 'image-crop',
      '/components/snippet': 'snippet',
      '/components/video-player': 'video-player',
    })[route];
    const ids = previewId ? [previewId] : allPreviews
      ? await page.locator('[id^="preview-"]').evaluateAll(els => els.map(el=>el.id).filter(id=>/^preview-[a-z0-9-]+$/.test(id)))
      : [await page.locator('[id^="preview-"]').first().getAttribute('id')].filter(Boolean);
    // Compare the rendered root rather than Example's code/source wrapper on
    // standalone routes. In all-previews mode include both when present.
    if (standalone && !previewId) {
      if (!allPreviews) ids.length=0;
      ids.push(`standalone-${standalone}`);
    }
    if (!ids.length) {
      if (previewId) throw Error(`${route} ${css}: requested ${previewId} not present`);
      return null;
    }
    const result = {};
    for (const id of ids) {
      const target = id.startsWith('standalone-') ? page.locator(`[data-slot="${standalone}"]`).first()
        : page.locator(`#${id}`).locator('xpath=preceding-sibling::div[1]');
      if (!await target.count()) throw Error(`${route} ${css}: requested ${id} not present`);
      const box = await target.boundingBox();
      if (!box || box.width < 1 || box.height < 1) throw Error(`${route} ${css}: invisible ${id}`);
      console.log(`box ${css} ${id} ${box.width}x${box.height}`);
      const nodes = await target.evaluate(el => [el, ...el.querySelectorAll('[data-slot], table, tbody, tr, th, td, button, img')].slice(0,26).map(x => ({tag:x.tagName,slot:x.getAttribute('data-slot'),class:x.className?.baseVal || x.className,box:[Math.round(x.getBoundingClientRect().width),Math.round(x.getBoundingClientRect().height)],display:getComputedStyle(x).display,font:getComputedStyle(x).fontSize,line:getComputedStyle(x).lineHeight,pad:getComputedStyle(x).padding,gap:getComputedStyle(x).gap,margin:getComputedStyle(x).margin,border:getComputedStyle(x).border,vertical:getComputedStyle(x).verticalAlign,grid:getComputedStyle(x).gridTemplateColumns})));
      result[id] = {width:Math.round(box.width),height:Math.round(box.height),nodes,png:await target.screenshot({animations:'disabled',timeout:15000})};
    }
    return result;
  } finally { await context.close(); }
}
async function captureWithRetry(browser, route, css) {
  // A freshly loaded 900 KiB stylesheet occasionally misses the 30s
  // Chromium/localhost readiness deadline under host load. A new context is
  // essential here: a timed-out context must never count as a comparison.
  try { return await capture(browser, route, css); }
  catch (error) {
    if (error.name !== 'TimeoutError') throw error;
    console.warn(`retry CSS/preview timeout once: ${route} ${css}: ${error.message.split('\n')[0]}`);
    return await capture(browser, route, css);
  }
}
async function run(executable) {
  if (!routes.length) throw Error('No routes matched');
  const browser = await chromium.launch({executablePath:executable,headless:true});
  const differences=[], skipped=[];
  let compared=0;
  try {
    for (const route of routes) {
      const a=await captureWithRetry(browser,route,'v4'), b=await captureWithRetry(browser,route,'v3');
      if (!a || !b) {
        if (a !== b) throw Error(`${route}: missing first preview on only one stylesheet`);
        skipped.push(route); // e.g. Data Table is a guide without a component preview.
        continue;
      }
      const ids = Object.keys(a), otherIds = Object.keys(b);
      if (JSON.stringify(ids)!==JSON.stringify(otherIds)) throw Error(`${route}: preview IDs differ: ${JSON.stringify({v4:ids,v3:otherIds})}`);
      for (const id of ids) {
        const first=a[id], second=b[id];
        compared++;
        const label=`${route} ${id}`;
        const save = () => {
          const name=`${route.split('/').at(-1)}-${id}`;
          fs.writeFileSync(path.join(os.tmpdir(),`shadcn-${name}-v4.png`),first.png);
          fs.writeFileSync(path.join(os.tmpdir(),`shadcn-${name}-v3.png`),second.png);
        };
        if (first.width!==second.width || first.height!==second.height) {
          differences.push({route,id,reason:`geometry ${first.width}x${first.height} vs ${second.width}x${second.height}`,v4:first.nodes,v3:second.nodes});
          save();
          continue;
        }
        const x=await sharp(first.png).removeAlpha().raw().toBuffer(), y=await sharp(second.png).removeAlpha().raw().toBuffer();
        if(x.length!==y.length)throw Error(`${label}: pixel buffer mismatch`);
        let changed=0,peak=0;
        for(let i=0;i<x.length;i+=3){const d=Math.max(Math.abs(x[i]-y[i]),Math.abs(x[i+1]-y[i+1]),Math.abs(x[i+2]-y[i+2]));if(d>2)changed++;peak=Math.max(peak,d)}
        const fraction=changed/(x.length/3);
        if(fraction>.005){
          differences.push({route,id,reason:`${(fraction*100).toFixed(2)}% differing pixels, peak ${peak}`});
          console.log('differing nodes', JSON.stringify({v4:first.nodes,v3:second.nodes}));
          save();
        }
        console.log(`${label}: ${(fraction*100).toFixed(2)}% >2/channel`);
      }
    }
    console.log(JSON.stringify({routes:routes.length,compared,skipped,differences},null,2));
    if(differences.length)process.exitCode=1;
  } finally {await browser.close();}
}
if(require.main===module)run(process.argv[2]).catch(e=>{console.error(e);process.exitCode=1});
