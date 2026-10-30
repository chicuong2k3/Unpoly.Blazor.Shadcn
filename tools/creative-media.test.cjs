// DOM interaction and native raster tests. These do not replace WebView/browser QA.
// Build the Web demo, then: DOTNET=/path/to/dotnet node --test tools/creative-media.test.cjs
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { JSDOM, VirtualConsole } = require('jsdom');
const { createCanvas } = require('@napi-rs/canvas');
const repo = path.resolve(__dirname, '..');
// A Windows checkout with core.autocrlf has CRLF endings; the slice markers below are LF.
const ui = fs.readFileSync(path.join(repo, 'src/Unpoly.Blazor.Shadcn/wwwroot/ui.js'), 'utf8').replace(/\r\n/g, '\n');
const source = ui.slice(ui.indexOf('  // Creative media primitives'), ui.indexOf('  // Command\n'));
let html, server;
before(async () => {
  const url = process.env.CREATIVE_MEDIA_URL || 'http://127.0.0.1:5097/components/creative-media';
  if (!process.env.CREATIVE_MEDIA_URL) server = spawn(process.env.DOTNET || 'dotnet', ['run', '--no-build', '--configuration', process.env.CREATIVE_MEDIA_CONFIGURATION || 'Debug', '--project', 'demo/Unpoly.Blazor.Shadcn.Demo', '--urls', 'http://127.0.0.1:5097'], { cwd: repo, env: { ...process.env, ASPNETCORE_ENVIRONMENT: 'Development' }, stdio: 'ignore' });
  server?.on('error', () => {});
  for (let attempt = 0; attempt < 100; attempt++) {
    try { const response = await fetch(url); if (response.ok) { html = await response.text(); break; } } catch {}
    await new Promise(r => setTimeout(r, 100));
  }
  assert.ok(html?.includes('data-slot="image-canvas"'), 'Build and start the Web demo before running this test.');
});
after(() => server?.kill());
function fixture() {
  const errors = [], virtualConsole = new VirtualConsole();
  virtualConsole.on('jsdomError', error => errors.push(error.message));
  const dom = new JSDOM(html, { runScripts: 'outside-only', url: 'http://localhost/', virtualConsole });
  const w = dom.window, compilers = new Map(), rasters = new WeakMap(), observers = [];
  w.structuredClone = structuredClone;
  w.matchMedia = () => ({ matches: true });
  w.ResizeObserver = class { constructor(fn) { this.fn=fn; this.disconnected=false; observers.push(this) } observe() {} disconnect() { this.disconnected=true } };
  w.HTMLCanvasElement.prototype.getContext = function () { let c=rasters.get(this); if(!c || c.width!==this.width || c.height!==this.height) { c=createCanvas(this.width,this.height); rasters.set(this,c) } return c.getContext('2d') };
  w.HTMLCanvasElement.prototype.toDataURL = function () { this.getContext('2d'); return rasters.get(this).toDataURL('image/png') };
  w.HTMLCanvasElement.prototype.toBlob = function (fn) { this.getContext('2d'); const bytes=rasters.get(this).toBuffer('image/png'); queueMicrotask(()=>fn(new w.Blob([bytes],{type:'image/png'}))) };
  w.HTMLMediaElement.prototype.pause = function() {};
  w.HTMLMediaElement.prototype.load = function() {};
  w.HTMLDialogElement.prototype.showModal = function() { this.setAttribute('open','') };
  w.HTMLDialogElement.prototype.close = function() { this.removeAttribute('open'); this.dispatchEvent(new w.Event('close')) };
  w.Element.prototype.setPointerCapture = function(id) { this._capture=id };
  w.Element.prototype.hasPointerCapture = function(id) { return this._capture===id };
  w.Element.prototype.releasePointerCapture = function() { this._capture=null };
  w.shadcnCompiler = (selector, compile) => compilers.set(selector, compile);
  w.loadScript = async () => {};
  w.eval(`(function(){const shadcnCompiler=window.shadcnCompiler, loadScript=(...args)=>window.loadScript(...args);${source}\n})()`);
  const q = selector => w.document.querySelector(selector);
  const compile = slot => { const selector=[...compilers.keys()].find(x=>x.startsWith(`[data-slot="${slot}"]`)); return compilers.get(selector)(q(`[data-slot="${slot}"]`)) };
  const event = (el,name,detail) => el.dispatchEvent(new w.CustomEvent(name,{bubbles:true,detail}));
  const key = (el,key,extra={}) => el.dispatchEvent(new w.KeyboardEvent('keydown',{bubbles:true,cancelable:true,key,...extra}));
  const pointer = (el,type,x,y,id=1) => { const e=new w.Event(type,{bubbles:true,cancelable:true}); Object.assign(e,{clientX:x,clientY:y,pointerId:id,button:0}); el.dispatchEvent(e) };
  const rect = (el,width,height,left=0,top=0) => { el.getBoundingClientRect=()=>({width,height,left,top,x:left,y:top,right:left+width,bottom:top+height}) };
  return {dom,w,q,compile,event,key,pointer,rect,observers,errors};
}
function withFixture(fn) { return async () => {
  const f=fixture();
  try { await fn(f) }
  finally { f.w.document.body.replaceChildren(); await tick(); f.dom.window.close() }
  assert.deepEqual(f.errors, [], 'DOM runtime errors must fail the test');
} }
const tick = () => new Promise(r=>setImmediate(r));

test('gallery preview opens only the requested lightbox image', withFixture(async f=>{
  f.compile('media-grid'); f.compile('media-lightbox'); assert.equal(f.q('[data-media-stage] img'),null);
  f.q('[data-media-preview="reference"]').click(); await tick();
  assert.ok(f.q('#creative-preview').open); assert.equal(f.q('[data-media-stage] img').alt,'Reference image');
}));
test('lightbox keyboard navigation stops at the last asset', withFixture(f=>{
  f.compile('media-lightbox'); f.event(f.q('[data-slot=media-lightbox]'),'media-lightbox:open',{id:'landscape'});
  f.key(f.q('#creative-preview'),'ArrowRight'); f.key(f.q('#creative-preview'),'ArrowRight');
  assert.equal(f.q('[data-media-stage] img').alt,'Reference image'); assert.ok(f.q('[data-media-next]').disabled);
}));
test('lightbox displays an image load failure', withFixture(f=>{
  f.compile('media-lightbox'); f.event(f.q('[data-slot=media-lightbox]'),'media-lightbox:open',{});
  f.q('[data-media-stage] img').dispatchEvent(new f.w.Event('error'));
  assert.equal(f.q('[data-media-status]').textContent,'Unable to load media.');
}));
test('lightbox close removes the active media element', withFixture(f=>{
  f.compile('media-lightbox'); f.event(f.q('[data-slot=media-lightbox]'),'media-lightbox:open',{}); f.q('#creative-preview').close();
  assert.equal(f.q('[data-media-stage]').children.length,0);
}));
test('asset confirmation emits selected IDs', withFixture(f=>{
  f.compile('asset-picker'); const root=f.q('[data-slot=asset-picker]'); let ids;
  root.addEventListener('asset-picker:confirm',e=>ids=e.detail.ids); root.querySelector('input').checked=true; root.querySelector('[data-assets-confirm]').click();
  assert.deepEqual(Array.from(ids),['landscape']);
}));
test('asset confirmation can be canceled by the consumer', withFixture(f=>{
  f.compile('asset-picker'); const root=f.q('[data-slot=asset-picker]'); root.querySelector('dialog').showModal();
  root.addEventListener('asset-picker:confirm',e=>e.preventDefault()); root.querySelector('[data-assets-confirm]').click();
  assert.ok(root.querySelector('dialog').open);
}));
test('overlay keyboard coordinates are normalized and bounded', withFixture(f=>{
  f.compile('draggable-overlay'); const root=f.q('[data-slot=draggable-overlay]');
  for(let i=0;i<100;i++) f.key(root.querySelector('[data-overlay-move]'),'ArrowRight');
  assert.ok(Math.abs(Number(root.dataset.x)-.7)<1e-9); assert.equal(root.style.left,'70%');
}));
test('overlay drag uses the transformed parent rectangle', withFixture(f=>{
  const root=f.q('[data-slot=draggable-overlay]'); f.rect(root.parentElement,500,250); f.compile('draggable-overlay');
  f.pointer(root.querySelector('[data-overlay-move]'),'pointerdown',10,10); f.pointer(root,'pointermove',60,35); f.pointer(root,'pointerup',60,35);
  assert.ok(Math.abs(Number(root.dataset.x)-.2)<1e-9); assert.ok(Math.abs(Number(root.dataset.y)-.2)<1e-9);
}));
test('overlay disposal removes keyboard handlers', withFixture(f=>{
  const dispose=f.compile('draggable-overlay'), root=f.q('[data-slot=draggable-overlay]'); dispose(); f.key(root.querySelector('[data-overlay-move]'),'ArrowRight');
  assert.equal(root.style.left,'10%');
}));
test('timeline trim respects its minimum clip duration', withFixture(f=>{
  f.compile('media-timeline'); const clip=f.q('[data-media-clip=intro]');
  for(let i=0;i<100;i++) f.key(clip.querySelector('[data-clip-start]'),'ArrowRight',{shiftKey:true});
  assert.ok(Math.abs(Number(clip.dataset.length)-.1)<1e-9); assert.ok(Math.abs(Number(clip.dataset.start)-7.9)<1e-9);
}));
test('timeline pointer cancellation restores the pre-drag state', withFixture(f=>{
  const root=f.q('[data-slot=media-timeline]'); f.rect(root,600,200); f.compile('media-timeline');
  const clip=f.q('[data-media-clip=intro]'); f.pointer(clip.querySelector('[data-clip-move]'),'pointerdown',0,0); f.pointer(root,'pointermove',100,80); f.pointer(root,'pointercancel',100,80);
  assert.equal(clip.dataset.start,'0'); assert.equal(clip.dataset.track,'0');
}));
test('timeline restore uses seconds without pixel rounding', withFixture(f=>{
  f.compile('media-timeline'); const root=f.q('[data-slot=media-timeline]');
  f.event(root,'media-timeline:set',{version:1,id:'intro',start:1.2345,duration:5.6789,track:2});
  assert.equal(f.q('[data-media-clip=intro]').dataset.start,'1.2345');
}));
test('canvas zoom keeps its center fixed', withFixture(f=>{
  const root=f.q('[data-slot=image-canvas]'); f.rect(root.querySelector('[data-canvas-viewport]'),640,480); f.compile('image-canvas');
  let state; root.addEventListener('image-canvas:change',e=>state=e.detail); root.querySelector('[data-canvas-action=zoom-in]').click();
  assert.equal(state.scale,1.25); assert.equal(state.x,-80); assert.equal(state.y,-60);
}));
test('canvas disposal disconnects its resize observer', withFixture(f=>{
  const dispose=f.compile('image-canvas'); dispose(); assert.ok(f.observers[0].disconnected);
}));
test('mask keyboard draw produces an opaque source-space pixel', withFixture(f=>{
  f.compile('mask-brush'); const canvas=f.q('[data-slot=mask-brush] canvas'); f.key(canvas,' ');
  assert.ok(canvas.getContext('2d').getImageData(320,240,1,1).data[3]>0);
}));
test('mask undo and redo restore the same raster', withFixture(f=>{
  f.compile('mask-brush'); const canvas=f.q('[data-slot=mask-brush] canvas'); f.key(canvas,' ');
  const alpha=()=>canvas.getContext('2d').getImageData(320,240,1,1).data[3], before=alpha();
  f.q('[data-mask-action=undo]').click(); assert.equal(alpha(),0); f.q('[data-mask-action=redo]').click(); assert.equal(alpha(),before);
}));
test('mask pointer coordinates account for zoomed image bounds', withFixture(f=>{
  f.compile('mask-brush'); const canvas=f.q('[data-slot=mask-brush] canvas'); f.rect(canvas,320,240,50,30);
  f.pointer(canvas,'pointerdown',210,150); f.pointer(canvas,'pointerup',210,150);
  assert.ok(canvas.getContext('2d').getImageData(320,240,1,1).data[3]>0); assert.equal(canvas.getContext('2d').getImageData(160,120,1,1).data[3],0);
}));
test('mask exports a PNG Blob at original dimensions', withFixture(async f=>{
  f.compile('mask-brush'); let detail; f.q('[data-slot=mask-brush]').addEventListener('mask-brush:export',e=>detail=e.detail);
  f.q('[data-mask-action=export]').click(); await tick(); assert.equal(detail.blob.type,'image/png'); assert.ok(detail.blob.size>0); assert.equal(detail.width,640); assert.equal(detail.height,480);
}));
test('mask restore replays versioned strokes', withFixture(f=>{
  f.compile('mask-brush'); f.event(f.q('[data-slot=mask-brush]'),'mask-brush:restore',{version:1,width:640,height:480,strokes:[{mode:'draw',size:20,opacity:1,points:[{x:100,y:100}]}]});
  assert.equal(f.q('[data-slot=mask-brush] canvas').getContext('2d').getImageData(100,100,1,1).data[3],255);
}));
test('mask disposal restores its toolbar to the fragment', withFixture(f=>{
  const dispose=f.compile('mask-brush'); assert.equal(f.q('[data-mask-toolbar]').parentElement.dataset.canvasToolbar,''); dispose();
  assert.equal(f.q('[data-mask-toolbar]').parentElement.dataset.slot,'mask-brush');
}));
test('comparison keyboard updates the ARIA value once per key', withFixture(async f=>{
  f.w.customElements.define('img-comparison-slider',class extends f.w.HTMLElement { enableTransition(){} });
  f.compile('image-compare'); await tick(); const slider=f.q('img-comparison-slider'); f.key(slider,'ArrowRight');
  assert.equal(slider.getAttribute('aria-valuenow'),'31'); f.key(slider,'End'); assert.equal(slider.getAttribute('aria-valuenow'),'100');
}));
test('comparison reflects controlled wrapper changes', withFixture(async f=>{
  f.w.customElements.define('img-comparison-slider',class extends f.w.HTMLElement { enableTransition(){} });
  f.compile('image-compare'); await tick(); f.q('[data-slot=image-compare]').dataset.position='12'; await tick();
  assert.equal(f.q('img-comparison-slider').getAttribute('aria-valuenow'),'12');
}));
test('vendor comparison disconnect releases its resize observer', withFixture(f=>{
  f.w.eval(fs.readFileSync(path.join(repo,'src/Unpoly.Blazor.Shadcn/wwwroot/image-compare/img-comparison-slider.js'),'utf8'));
  const slider=f.q('img-comparison-slider'); assert.equal(f.observers.length,1); slider.remove(); assert.ok(f.observers.every(o=>o.disconnected));
}));

test('asset picker retains IDs selected on another page', withFixture(f=>{
  const root=f.q('[data-slot=asset-picker]'); root.dataset.selectedIds='["off-page"]'; f.compile('asset-picker'); let ids;
  root.addEventListener('asset-picker:confirm',e=>ids=e.detail.ids); root.querySelector('[data-assets-confirm]').click();
  assert.deepEqual(Array.from(ids),['off-page']);
}));
test('mask eraser removes pixels from a drawn stroke', withFixture(f=>{
  f.compile('mask-brush'); const canvas=f.q('[data-slot=mask-brush] canvas');
  f.event(f.q('[data-slot=mask-brush]'),'mask-brush:restore',{version:1,width:640,height:480,strokes:[{mode:'draw',size:40,opacity:1,points:[{x:320,y:240}]}]});
  f.q('[data-mask-action=erase]').click(); const opacity=f.q('[data-mask-opacity]'); opacity.value='100'; opacity.dispatchEvent(new f.w.Event('input',{bubbles:true})); f.key(canvas,' ');
  assert.equal(canvas.getContext('2d').getImageData(320,240,1,1).data[3],0);
}));
function fakeCropper(f) {
  let instance;
  f.w.Cropper=class {
    constructor(image,options) { this.options=options; this.data={x:1,y:2,width:20,height:10}; instance=this; queueMicrotask(()=>options.ready.call(this)) }
    getData() { return this.data }
    getCroppedCanvas() { const c=f.w.document.createElement('canvas'); c.width=20;c.height=10;return c }
    setData(value) { Object.assign(this.data,value) }
    reset() { this.data={x:0,y:0,width:20,height:10} }
    destroy() { this.destroyed=true }
    zoom() {}
  };
  return ()=>instance;
}
test('crop export retains the data URL and includes Blob plus source coordinates', withFixture(async f=>{
  fakeCropper(f); f.compile('image-crop'); await tick(); let detail;
  f.q('[data-slot=image-crop]').addEventListener('image-crop:apply',e=>detail=e.detail);
  f.q('[data-slot=image-crop-apply]').click(); await tick();
  assert.match(detail.dataUrl,/^data:image\/png;base64,/); assert.equal(detail.blob.type,'image/png'); assert.equal(detail.crop.x,1);
}));
test('crop rejects an export above its byte limit', withFixture(async f=>{
  fakeCropper(f); const root=f.q('[data-slot=image-crop]'); root.dataset.maxImageSize='1'; f.compile('image-crop'); await tick(); let reason;
  root.addEventListener('image-crop:error',e=>reason=e.detail.reason); root.querySelector('[data-slot=image-crop-apply]').click(); await tick();
  assert.equal(reason,'size');
}));
test('crop disposal destroys its Cropper instance', withFixture(async f=>{
  const instance=fakeCropper(f); const dispose=f.compile('image-crop'); await tick(); dispose(); assert.ok(instance().destroyed);
}));
test('crop async loading does not initialize after disposal', withFixture(async f=>{
  let resolve; f.w.loadScript=()=>new Promise(r=>resolve=r); const dispose=f.compile('image-crop'); const instance=fakeCropper(f); dispose(); resolve(); await tick();
  assert.equal(instance(),undefined);
}));

test('full no-Unpoly driver compiles media inserted into a WebView-style DOM', withFixture(async f=>{
  const main=f.q('.doc-main');
  loadPlatformDriver(f); await tick();
  assert.equal(f.q('[data-mask-toolbar]').parentElement.hasAttribute('data-canvas-toolbar'),true);
  const overlay=f.q('[data-slot=draggable-overlay]'); f.key(overlay.querySelector('[data-overlay-move]'),'ArrowRight');
  assert.ok(Math.abs(Number(overlay.dataset.x)-.11)<1e-9);
  const observer=f.observers.find(o=>!o.disconnected); main.remove(); await tick();
  assert.ok(observer.disconnected);
}));

function loadPlatformDriver(f) {
  const main=f.q('.doc-main'); assert.ok(main); f.w.document.body.replaceChildren(main);
  f.w.requestAnimationFrame=fn=>f.w.setTimeout(fn,0); f.w.cancelAnimationFrame=id=>f.w.clearTimeout(id);
  f.w.IntersectionObserver=class { observe(){} disconnect(){} unobserve(){} };
  f.w.eval(ui);
}
test('the visible asset picker button opens its dialog', withFixture(async f=>{
  loadPlatformDriver(f); await tick();
  const button=Array.from(f.w.document.querySelectorAll('button')).find(b=>b.textContent.trim()==='Choose assets');
  assert.ok(button); button.click();
  assert.ok(f.q('#creative-assets').open);
}));

test('overlay handles describe initial normalized bounds', withFixture(f=>{
  f.compile('draggable-overlay');
  for (const control of f.q('[data-slot=draggable-overlay]').querySelectorAll('button'))
    assert.equal(control.getAttribute('aria-description'), 'Left 10%, top 10%, width 30%, height 20%.');
}));
test('overlay announces committed keyboard bounds', withFixture(f=>{
  f.compile('draggable-overlay'); const root=f.q('[data-slot=draggable-overlay]');
  f.key(root.querySelector('[data-overlay-resize]'),'ArrowRight');
  assert.equal(root.querySelector('[role=status]').textContent, 'Left 10%, top 10%, width 31%, height 20%.');
}));
test('timeline trim handles describe initial time bounds', withFixture(f=>{
  f.compile('media-timeline'); const clip=f.q('[data-media-clip=intro]');
  for (const control of clip.querySelectorAll('button'))
    assert.equal(control.getAttribute('aria-description'), 'Start 0 seconds, end 8 seconds, duration 8 seconds, track 1.');
}));
test('timeline announces committed trim bounds', withFixture(f=>{
  f.compile('media-timeline'); const clip=f.q('[data-media-clip=intro]');
  f.key(clip.querySelector('[data-clip-start]'),'ArrowRight');
  assert.equal(f.q('[data-slot=media-timeline] [role=status]').textContent, 'Introduction. Start 0.1 seconds, end 8 seconds, duration 7.9 seconds, track 1.');
}));
test('timeline cancellation restores accessible trim bounds', withFixture(f=>{
  const root=f.q('[data-slot=media-timeline]'), clip=f.q('[data-media-clip=intro]');
  f.rect(root,300,160); f.compile('media-timeline');
  f.pointer(clip.querySelector('[data-clip-start]'),'pointerdown',0,0);
  f.pointer(root,'pointermove',10,0); f.pointer(root,'pointercancel',10,0);
  assert.equal(clip.querySelector('[data-clip-start]').getAttribute('aria-description'), 'Start 0 seconds, end 8 seconds, duration 8 seconds, track 1.');
  assert.equal(root.querySelector('[role=status]').textContent, '');
}));
