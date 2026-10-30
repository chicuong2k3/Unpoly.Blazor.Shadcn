// One real-engine audit used by Chromium SSR/Unpoly and native MAUI WebView2.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const components = ['ImageCanvas','MaskBrush','DraggableOverlay','MediaTimeline','MediaGrid','MediaLightbox','AssetPicker','ImageCompare','ImageCrop'];
async function auditCreativeMedia(page, navigate, { output, host, css }) {
  fs.mkdirSync(output, { recursive: true });
  page.setDefaultTimeout(10000);
  const checks = [], errors = [], report = { host, css, components, viewports:[], styles:[], checks, errors };
  const prefix = `${host}-${css}`, file = path.join(output, `${prefix}-audit.json`);
  const save = () => fs.writeFileSync(file, JSON.stringify(report, null, 2));
  const onError = error => errors.push(String(error)); page.on('pageerror', onError);
  let mode = 'functionality';
  const check = async (component, name, run) => {
    try { await run(); checks.push({component, mode, name, status:'passed'}); }
    catch (error) {
      await page.evaluate(()=>document.querySelectorAll('dialog[open]').forEach(el=>el.close())).catch(()=>{});
      checks.push({component, mode, name, status:'failed', error:error.stack});
      await page.screenshot({ path:path.join(output, `${prefix}-${checks.length}-failure.png`), fullPage:true }).catch(()=>{});
    }
    save();
  };
  const capture = async (selector, name) => {
    const target = page.locator(selector);
    await target.evaluate(el => scrollTo(0, el.getBoundingClientRect().top + scrollY - 96));
    const chrome = await page.addStyleTag({content:'.doc-header { visibility:hidden !important; }'});
    try { await target.screenshot({path:path.join(output, `${prefix}-${mode}-${name}.png`), animations:'disabled'}); }
    finally { await chrome.evaluate(el=>el.remove()); }
  };
  const close = async () => { await page.evaluate(() => document.querySelectorAll('dialog[open]').forEach(el=>el.close())); };
  const boxInside = async (selector, parent) => page.locator(selector).evaluate((el, parent) => {
    const r=el.getBoundingClientRect(), p=el.closest(parent).getBoundingClientRect();
    return r.width>0 && r.height>0 && r.left>=p.left-2 && r.right<=p.right+2 && r.top>=p.top-2 && r.bottom<=p.bottom+2;
  }, parent);
  const session = await page.context().newCDPSession(page);
  try {
    await navigate(page, '/components/creative-media/audit');
    await page.getByRole('heading',{name:'Creative Media Audit',exact:true}).waitFor();
    await page.waitForFunction(() => customElements.get('img-comparison-slider') && document.querySelectorAll('.cropper-container').length===2 && [...document.querySelectorAll('[data-canvas-plane]')].every(el=>el.style.transform));
    for (const [width,height] of [[320,740],[768,1024],[1280,900],[740,360]]) {
      for (const dark of [false,true]) {
        mode=`${width}x${height}-${dark?'dark':'light'}`; report.viewports.push({width,height,dark});
        await session.send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false});
        await page.waitForFunction(width=>innerWidth===width,width);
        await close(); await page.evaluate(dark=>{document.documentElement.classList.toggle('dark',dark);document.activeElement?.blur()},dark);
        await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
        report.styles.push({mode, values:await page.evaluate(()=>Object.fromEntries(['canvas','editor','timeline','grid','lightbox','picker','compare','crop'].map(name=>{const root=document.querySelector(`[data-audit=${name}]`),c=getComputedStyle(root);return [name,{color:c.color,background:c.backgroundColor,border:c.borderColor,font:c.fontFamily,fontSize:c.fontSize}]})))});

        await check('ImageCanvas','view toolbar and fitted plane stay inside frame',async()=>{
          assert.ok(await boxInside('[data-audit=canvas] [data-canvas-view-controls]','[data-slot=image-canvas]'));
          assert.ok(await boxInside('[data-audit=canvas] [data-canvas-plane]','[data-canvas-viewport]'));
          const fits=await page.locator('[data-audit=canvas] [data-canvas-view-controls]').evaluate(el=>{
            const r=el.getBoundingClientRect();return [...el.querySelectorAll('button')].every(b=>{const c=b.getBoundingClientRect();return c.left>=r.left&&c.right<=r.right&&c.top>=r.top&&c.bottom<=r.bottom});
          });assert.ok(fits,'canvas controls overflow'); await capture('[data-audit=canvas]','canvas');
        });
        await check('MaskBrush','toolbar groups do not overlap or overflow',async()=>{
          const valid=await page.locator('[data-audit=editor] [data-mask-toolbar]').evaluate(el=>{
            const bounds=el.getBoundingClientRect(), children=[...el.children].map(c=>c.getBoundingClientRect());
            return children.every((r,i)=>r.left>=bounds.left-1&&r.right<=bounds.right+1&&children.slice(i+1).every(b=>Math.min(r.right,b.right)-Math.max(r.left,b.left)<=1||Math.min(r.bottom,b.bottom)-Math.max(r.top,b.top)<=1));
          });assert.ok(valid,'mask tool groups overlap or overflow');await capture('[data-audit=editor] [data-slot=image-canvas]','mask-overlay');
        });
        await check('DraggableOverlay','handles retain a 24px hit area after fitting',async()=>{
          for(const selector of ['[data-overlay-move]','[data-overlay-resize]']) {
            const b=await page.locator(`[data-audit=editor] ${selector}`).boundingBox();assert.ok(b.width>=23.5&&b.height>=23.5,`${selector} is scaled below 24px: ${JSON.stringify(b)}`);
          }
        });
        await check('MediaTimeline','trim edges and track positions stay separate',async()=>{
          const valid=await page.locator('[data-audit=timeline]').evaluate(el=>[...el.querySelectorAll('[data-media-clip]')].every(clip=>{
            const r=clip.getBoundingClientRect(),a=clip.querySelector('[data-clip-start]').getBoundingClientRect(),b=clip.querySelector('[data-clip-end]').getBoundingClientRect();
            return Math.abs(a.left-r.left)<=2&&Math.abs(b.right-r.right)<=2&&a.right<=b.left&&a.width>=23.5&&b.width>=23.5;
          }));assert.ok(valid,'timeline grips overlap');await capture('[data-audit=timeline]','timeline');
        });
        await check('MediaGrid','tiles and all loading/error/empty states render',async()=>{
          assert.equal(await page.locator('[data-audit=grid] figure').count(),4);
          assert.equal(await page.locator('[aria-label="Loading gallery"]').getAttribute('aria-busy'),'true');
          assert.ok(await page.locator('[aria-label="Loading gallery"] [role=status]').isVisible());
          assert.ok(await page.locator('[aria-label="Empty gallery"] [role=status]').isVisible());
          assert.ok(await page.locator('[aria-label="Failed gallery"] [role=alert]').isVisible());
          await page.locator('[aria-label="Broken thumbnail"]').scrollIntoViewIfNeeded();
          await page.locator('[aria-label="Broken thumbnail"] [data-media-fallback]').waitFor({state:'visible'});
          const fits=await page.locator('[data-audit=grid]').evaluate(el=>{const p=el.getBoundingClientRect();return [...el.querySelectorAll('figure')].every(c=>{const r=c.getBoundingClientRect();return r.left>=p.left&&r.right<=p.right})});assert.ok(fits);
          await capture('[data-audit=grid]','grid');await capture('[data-audit=grid-states]','grid-states');
        });
        await check('MediaLightbox','portrait and navigation fit the viewport',async()=>{
          await page.locator('[data-audit=lightbox] [data-slot=media-lightbox]').evaluate(el=>el.dispatchEvent(new CustomEvent('media-lightbox:open',{detail:{id:'portrait'}})));
          await page.waitForFunction(()=>document.querySelector('#audit-preview img')?.naturalWidth>0);
          assert.ok(await boxInside('#audit-preview [data-media-stage] img','[data-media-stage]'));
          const fits=await page.locator('#audit-preview [data-slot=dialog-content]').evaluate(el=>{const r=el.getBoundingClientRect();return r.top>=-1&&r.bottom<=innerHeight+1&&r.left>=-1&&r.right<=innerWidth+1});assert.ok(fits,'lightbox exceeds viewport');
          assert.ok(await page.locator('#audit-preview [data-media-next]').isVisible());
          await page.locator('#audit-preview').screenshot({path:path.join(output,`${prefix}-${mode}-lightbox.png`)});await close();
        });
        await check('AssetPicker','scroll region leaves footer visible',async()=>{
          await page.locator('[data-audit=picker] [data-slot=dialog-trigger]').click();
          const fits=await page.locator('#audit-picker [data-assets-footer]').evaluate(el=>{const r=el.getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight&&r.left>=0&&r.right<=innerWidth});assert.ok(fits,'picker footer off screen');
          await page.locator('#audit-picker').screenshot({path:path.join(output,`${prefix}-${mode}-picker.png`)});await close();
        });
        await check('ImageCompare','horizontal and vertical frames keep their layers',async()=>{
          for(const type of ['compare','vertical']) {
            const root=page.locator(`[data-audit=${type}] img-comparison-slider`); const b=await root.boundingBox();assert.ok(b.width>0&&b.height>0);
            assert.equal(await root.getAttribute('aria-orientation'),type==='vertical'?'vertical':'horizontal');
            assert.ok(await root.evaluate(el=>[...el.querySelectorAll('img')].every(img=>Math.abs(img.getBoundingClientRect().height-el.getBoundingClientRect().height)<=2)), `${type} image layer height differs from frame`);
            await capture(`[data-audit=${type}]`,type);
          }
        });
        await check('ImageCrop','stage and every toolbar group stay bounded',async()=>{
          const fits=await page.locator('[data-audit=crop] [data-crop-toolbar]').evaluate(el=>{const p=el.getBoundingClientRect(),a=[...el.children].map(c=>c.getBoundingClientRect());return a.every((r,i)=>r.left>=p.left-1&&r.right<=p.right+1&&a.slice(i+1).every(b=>Math.min(r.right,b.right)-Math.max(r.left,b.left)<=1||Math.min(r.bottom,b.bottom)-Math.max(r.top,b.top)<=1))});assert.ok(fits,'crop toolbar overlap');
          await capture('[data-audit=crop]','crop');await capture('[data-audit=circular]','circular');
        });
      }
    }
    await session.send('Emulation.setDeviceMetricsOverride',{width:1280,height:900,deviceScaleFactor:1,mobile:false});
    await page.evaluate(()=>document.documentElement.classList.remove('dark')); mode='functionality';
    const crop=page.locator('[data-audit=crop]');
    await page.waitForFunction(()=>{const root=document.querySelector('[data-audit=crop]');return Math.abs(root.querySelector('.cropper-container').clientWidth-root.querySelector('[data-crop-stage]').clientWidth)<=2});
    const cropData=async()=>{await page.evaluate(()=>new Promise(r=>requestAnimationFrame(r)));return crop.locator('[data-crop-field]').evaluateAll(els=>Object.fromEntries(els.map(el=>[el.dataset.cropField,Number(el.value)])));};
    const dragEdge=async action=>{
      const handle=crop.locator(`.cropper-point[data-action=${action}]`);await handle.scrollIntoViewIfNeeded();const b=await handle.boundingBox();
      await page.mouse.move(b.x+b.width/2,b.y+b.height/2);await page.mouse.down();await page.mouse.move(b.x+b.width/2+(action==='e'?-24:0),b.y+b.height/2+(action==='s'?-24:0),{steps:6});await page.mouse.up();
    };
    await check('ImageCrop','east drag changes width without changing height in Free',async()=>{const before=await cropData();await dragEdge('e');const after=await cropData();assert.ok(after.width<before.width);assert.ok(Math.abs(after.height-before.height)<=1);});
    await check('ImageCrop','south drag changes height without changing width in Free',async()=>{const before=await cropData();await dragEdge('s');const after=await cropData();assert.ok(after.height<before.height);assert.ok(Math.abs(after.width-before.width)<=1);});
    await check('ImageCrop','ratio control locks 4:3 only when chosen',async()=>{
      await crop.locator('[data-slot=select-trigger]').click();await page.getByRole('option',{name:'4:3',exact:true}).click();await dragEdge('e');const d=await cropData();assert.ok(Math.abs(d.width/d.height-4/3)<.02);
      await crop.locator('[data-slot=select-trigger]').click();await page.getByRole('option',{name:'Free',exact:true}).click();
    });
    await check('ImageCrop','export contains a PNG Blob and source dimensions',async()=>{
      await crop.evaluate(el=>el.addEventListener('image-crop:apply',e=>window.__auditCrop={blob:e.detail.blob instanceof Blob,type:e.detail.blob.type,width:e.detail.width,height:e.detail.height},{once:true}));
      await crop.locator('[data-slot=image-crop-apply]').click();await page.waitForFunction(()=>window.__auditCrop);const d=await page.evaluate(()=>window.__auditCrop);assert.equal(d.blob,true);assert.equal(d.type,'image/png');assert.ok(d.width>0&&d.height>0);
    });
    await check('ImageCrop','circular export has transparent corners',async()=>{
      const circle=page.locator('[data-audit=circular]');await circle.evaluate(el=>el.addEventListener('image-crop:apply',async e=>{const b=await createImageBitmap(e.detail.blob),c=document.createElement('canvas');c.width=b.width;c.height=b.height;const ctx=c.getContext('2d');ctx.drawImage(b,0,0);window.__auditCircle=ctx.getImageData(0,0,1,1).data[3];b.close()},{once:true}));
      await circle.locator('[data-slot=image-crop-apply]').click();await page.waitForFunction(()=>window.__auditCircle!==undefined);assert.equal(await page.evaluate(()=>window.__auditCircle),0);
    });
    await check('ImageCanvas','zoom, keyboard pan and fit update the image transform',async()=>{
      const root=page.locator('[data-audit=canvas]'),plane=root.locator('[data-canvas-plane]');const before=await plane.getAttribute('style');await root.locator('[data-canvas-action=zoom-in]').click();assert.notEqual(await plane.getAttribute('style'),before);
      const zoomed=await plane.getAttribute('style');await root.locator('[data-canvas-viewport]').press('ArrowRight');assert.notEqual(await plane.getAttribute('style'),zoomed);await root.locator('[data-canvas-action=fit]').click();
    });
    await check('MaskBrush','draw, erase, undo and redo change source pixels',async()=>{
      const root=page.locator('[data-audit=editor]'),canvas=root.locator('canvas'),alpha=()=>canvas.evaluate(c=>c.getContext('2d').getImageData(320,240,1,1).data[3]);
      await canvas.press('Space');assert.ok(await alpha()>0);await root.locator('[data-mask-action=erase]').click();await canvas.press('Space');assert.equal(await alpha(),0);await root.locator('[data-mask-action=undo]').click();assert.ok(await alpha()>0);await root.locator('[data-mask-action=redo]').click();assert.equal(await alpha(),0);
    });
    await check('MaskBrush','mask export preserves source width and height',async()=>{
      const root=page.locator('[data-audit=editor]');await root.locator('[data-slot=mask-brush]').evaluate(el=>el.addEventListener('mask-brush:export',e=>window.__auditMask={blob:e.detail.blob instanceof Blob,width:e.detail.width,height:e.detail.height},{once:true}));await root.locator('[data-mask-action=export]').click();await page.waitForFunction(()=>window.__auditMask);assert.deepEqual(await page.evaluate(()=>window.__auditMask),{blob:true,width:640,height:480});
    });
    await check('DraggableOverlay','pointer movement updates normalized coordinates',async()=>{
      const root=page.locator('[data-audit=editor] [data-slot=draggable-overlay]'),handle=root.locator('[data-overlay-move]');await handle.scrollIntoViewIfNeeded();const b=await handle.boundingBox(),before=Number(await root.getAttribute('data-x'));await page.mouse.move(b.x+b.width/2,b.y+b.height/2);await page.mouse.down();await page.mouse.move(b.x+b.width/2+20,b.y+b.height/2+10,{steps:4});await page.mouse.up();assert.ok(Number(await root.getAttribute('data-x'))>before);
    });
    await check('MediaTimeline','keyboard trim preserves end time and track movement is bounded',async()=>{const root=page.locator('[data-audit=timeline] [data-media-clip=intro]');await root.locator('[data-clip-start]').press('ArrowRight');const d=await root.evaluate(el=>({start:Number(el.dataset.start),duration:Number(el.dataset.length)}));assert.ok(Math.abs(d.start+d.duration-8)<1e-8);await root.locator('[data-clip-move]').press('ArrowDown');assert.equal(await root.getAttribute('data-track'),'1');});
    await check('MediaGrid','checkbox selection paints the selected tile',async()=>{const root=page.locator('[data-audit=grid]');await root.locator('input[value=landscape]').check();assert.equal(await root.locator('figure[data-selected]').count(),1);});
    await check('MediaLightbox','error can be retried after its source is corrected',async()=>{
      const root=page.locator('[data-audit=lightbox] [data-slot=media-lightbox]');await root.evaluate(el=>el.dispatchEvent(new CustomEvent('media-lightbox:open',{detail:{id:'error'}})));const retry=page.locator('#audit-preview [data-media-retry]');await retry.waitFor();await root.evaluate(el=>{el.querySelector('[data-media-id=error]').dataset.src=el.querySelector('[data-media-id=landscape]').dataset.src});await retry.click();await page.waitForFunction(()=>document.querySelector('#audit-preview img')?.naturalWidth>0);assert.equal(await retry.isVisible(),false);await close();
    });
    await check('MediaLightbox','Escape returns focus to the gallery preview',async()=>{
      const trigger=page.locator('[data-audit=grid] [data-media-preview=landscape]');await trigger.press('Enter');await page.locator('#audit-preview[open]').waitFor();await page.keyboard.press('Escape');assert.ok(await trigger.evaluate(el=>el===document.activeElement));
    });
    await check('MediaLightbox','native video loads and is removed on close',async()=>{
      await page.locator('[data-audit=lightbox] [data-slot=media-lightbox]').evaluate(el=>el.dispatchEvent(new CustomEvent('media-lightbox:open',{detail:{id:'video'}})));await page.waitForFunction(()=>document.querySelector('#audit-preview video')?.readyState>=2);await close();assert.equal(await page.locator('#audit-preview video').count(),0);
    });
    await check('MediaLightbox','empty preview disables navigation',async()=>{await page.locator('[data-audit=lightbox-empty] [data-slot=dialog-trigger]').click();assert.ok(await page.locator('#audit-empty [data-media-next]').isDisabled());assert.ok(await page.locator('#audit-empty [data-media-previous]').isDisabled());assert.match(await page.locator('#audit-empty [data-media-status]').textContent(),/No media/);await close();});
    await check('AssetPicker','clear resets selection and leaves confirm usable',async()=>{await page.locator('[data-audit=picker] [data-slot=dialog-trigger]').click();await page.locator('#audit-picker input[value=landscape]').check();assert.equal(await page.locator('#audit-picker [data-assets-count]').textContent(),'1');await page.locator('#audit-picker [data-assets-clear]').click();assert.equal(await page.locator('#audit-picker input:checked').count(),0);assert.ok(await page.locator('#audit-picker [data-assets-clear]').isDisabled());await page.locator('#audit-picker [data-assets-confirm]').click();});
    await check('AssetPicker','loading state remains accessible inside the modal',async()=>{await page.locator('[data-audit=picker-loading] [data-slot=dialog-trigger]').click();assert.equal(await page.locator('#audit-picker-loading [data-slot=media-grid]').getAttribute('aria-busy'),'true');assert.ok(await page.locator('#audit-picker-loading [role=status]').first().isVisible());await close();});
    await check('ImageCompare','keyboard controls horizontal and vertical positions',async()=>{for(const type of ['compare','vertical']){const slider=page.locator(`[data-audit=${type}] img-comparison-slider`);await slider.press('Home');assert.equal(await slider.getAttribute('aria-valuenow'),'0');await slider.press('End');assert.equal(await slider.getAttribute('aria-valuenow'),'100');await slider.press('ArrowLeft');assert.equal(await slider.getAttribute('aria-valuenow'),'99');}});
    await check('ImageCompare','pointer drag moves the divider',async()=>{const slider=page.locator('[data-audit=compare] img-comparison-slider');await slider.press('Home');await slider.press('ArrowRight');await slider.scrollIntoViewIfNeeded();const b=await slider.boundingBox();await page.mouse.move(b.x+b.width*.01,b.y+b.height/2);await page.mouse.down();await page.mouse.move(b.x+b.width*.6,b.y+b.height/2,{steps:8});await page.mouse.up();await page.waitForFunction(()=>Number(document.querySelector('[data-audit=compare] img-comparison-slider').getAttribute('aria-valuenow'))>50);});
    await check('ImageCanvas','navigation removes old media listeners',async()=>{
      await page.evaluate(()=>{window.__auditOld=document.querySelector('[data-audit=editor] [data-slot=draggable-overlay]');window.__auditOldCount=0;window.__auditOld.addEventListener('draggable-overlay:change',()=>window.__auditOldCount++)});
      await navigate(page,'/components/button');await page.getByRole('heading',{name:'Button',exact:true}).waitFor();await page.evaluate(()=>new Promise(r=>requestAnimationFrame(r)));await page.evaluate(()=>window.__auditOld.querySelector('[data-overlay-move]').dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true})));assert.equal(await page.evaluate(()=>window.__auditOldCount),0);
    });
    assert.deepEqual(errors,[], 'page errors in audit');
  } catch(error) { report.fatal=error.stack; save(); throw error; }
  finally { await session.send('Emulation.clearDeviceMetricsOverride').catch(()=>{});await session.detach().catch(()=>{});page.off('pageerror',onError);save();writeAuditIndex(output); }
  const failed=checks.filter(c=>c.status==='failed');console.log(`${prefix} audit: ${checks.length-failed.length}/${checks.length} passed`);
  assert.deepEqual(failed.map(c=>({component:c.component,mode:c.mode,name:c.name,error:c.error})),[]);
  return report;
}
function writeAuditIndex(output) {
  const esc=value=>String(value).replace(/[<>&"]/g,c=>({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;'}[c]));
  const reports=fs.readdirSync(output).filter(name=>name.endsWith('-audit.json')).map(name=>JSON.parse(fs.readFileSync(path.join(output,name),'utf8')));
  const pictures=fs.readdirSync(output).filter(name=>name.endsWith('.png')&&!name.endsWith('-failure.png')&&!name.endsWith('-success.png'));
  fs.writeFileSync(path.join(output,'index.html'),`<!doctype html><html lang="en"><meta charset="utf-8"><title>Creative Media Audit</title><style>body{font:14px system-ui;margin:24px;background:#f5f5f5;color:#111}table{border-collapse:collapse;background:white}td,th{border:1px solid #ccc;padding:8px;text-align:left}.shots{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:16px;margin-top:24px}figure{margin:0;background:white;border:1px solid #ddd;padding:12px}img{width:100%;max-height:420px;object-fit:contain}figcaption{overflow-wrap:anywhere}</style><h1>Creative Media Audit</h1><p>Real-engine checks. Open JSON for individual assertions; click an image for full resolution. Screenshot-only hiding of the sticky docs header leaves component layout unchanged.</p><table><tr><th>Host / CSS</th><th>Passed</th><th>Failed</th><th>Report</th></tr>${reports.map(r=>`<tr><td>${esc(r.host)} / ${esc(r.css)}</td><td>${r.checks.filter(c=>c.status==='passed').length}</td><td>${r.checks.filter(c=>c.status==='failed').length}${r.fatal?' + fatal':''}</td><td><a href="${esc(r.host+'-'+r.css+'-audit.json')}">JSON</a></td></tr>`).join('')}</table><div class="shots">${pictures.map(name=>`<figure><a href="${esc(name)}"><img loading="lazy" src="${esc(name)}" alt="${esc(name)}"></a><figcaption>${esc(name)}</figcaption></figure>`).join('')}</div></html>`);
}
module.exports={auditCreativeMedia,writeAuditIndex};
