// Opt-in Windows MAUI WebView2 smoke; requires an opt-in Tailwind3Preview build.
// Only the child launched here receives a loopback CDP port and disposable WebView profile.
// --baseline checks the same flows on v4; default checks v3. --review-only --keep-open
// leaves the chosen demo open without claiming interaction coverage.
const { spawn, execFileSync } = require('node:child_process');
const net = require('node:net');
const http = require('node:http');
const path = require('node:path');
const os = require('node:os');
const { chromium } = require('playwright-core');
const { checkInventory } = require('./demo-inventory-check.cjs');
const { componentRoutes, standalone, pageHeadings } = require('./demo-route-regression-browser.cjs');
const fs = require('node:fs');
// Point at a separately published Windows demo for opt-in publish validation.
const executable = process.env.MAUI_SMOKE_EXE
  ? path.resolve(process.env.MAUI_SMOKE_EXE)
  : path.resolve(__dirname, '../demo/Unpoly.Blazor.Shadcn.Maui/bin/Debug/net10.0-windows10.0.19041.0/win-x64/Unpoly.Blazor.Shadcn.Maui.exe');
if (path.basename(executable).toLowerCase() !== 'unpoly.blazor.shadcn.maui.exe' || !fs.statSync(executable).isFile()) throw Error('Expected a built Shadcn MAUI demo executable');
function freePort() { return new Promise((resolve, reject) => { const server = net.createServer(); server.listen(0, '127.0.0.1', () => { const port = server.address().port; server.close(() => resolve(port)); }); server.on('error', reject); }); }
function get(url) { return new Promise((resolve, reject) => { const req = http.get(url, res => { res.resume(); res.on('end', () => resolve(res.statusCode)); }); req.on('error', reject); req.setTimeout(1500, () => req.destroy()); }); }
async function navigate(page, href) {
  const link = page.locator(`a[data-slot="item"][href="${href}"]`).first();
  await link.waitFor({state:'visible',timeout:30000});
  await link.evaluate(el=>el.scrollIntoView({block:'center',behavior:'instant'}));
  try { await link.click({timeout:15000}); }
  catch (error) { console.error('DocNav click:',href,page.url(),await link.evaluate(el=>({rect:el.getBoundingClientRect().toJSON(),visible:getComputedStyle(el).visibility,body:document.body?.innerText.slice(0,300)}))); throw error; }
  await page.waitForFunction(href=>location.pathname===href,href,{timeout:15000});
}
(async () => {
  if (process.platform !== 'win32') throw Error('Windows WebView2 required');
  const port = await freePort();
  const child = spawn(executable, [], { cwd:path.dirname(executable), windowsHide:false, detached:true, stdio:'ignore', env:{...process.env,WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS:`--remote-debugging-port=${port} --remote-debugging-address=127.0.0.1`,WEBVIEW2_USER_DATA_FOLDER:path.join(os.tmpdir(),`shadcn-maui-smoke-${process.pid}`)} });
  let browser;
  let success = false;
  const css = process.argv.includes('--baseline') ? 'v4' : 'v3';
  const sheet = css === 'v3' ? 'app.v3.css' : 'app.css';
  try {
    const endpoint = `http://127.0.0.1:${port}`;
    for (let n=0;n<120;n++) { if (child.exitCode !== null) throw Error(`MAUI exited ${child.exitCode}`); try { if (await get(endpoint+'/json/version')===200) break; } catch {} if (n===119) throw Error('No WebView2 CDP endpoint in 60s'); await new Promise(r=>setTimeout(r,500)); }
    browser = await chromium.connectOverCDP(endpoint);
    let page;
    for (let n=0;n<100;n++) { page=browser.contexts().flatMap(c=>c.pages()).find(pg=>/0\.0\.0\.1/.test(pg.url())); if (page) break; await new Promise(r=>setTimeout(r,500)); }
    if (!page) throw Error('MAUI page not found');
    const errors=[]; page.on('pageerror',e=>errors.push(String(e)));
    await page.locator('link[data-demo-css="v3"]').waitFor({state:'attached',timeout:30000});
    console.log('v3 host:',page.url(),await page.locator('link[data-demo-css]').getAttribute('href'));
    await page.evaluate(css=>sessionStorage.setItem('demo-css',css),css);
    await page.reload({waitUntil:'domcontentloaded'});
    await page.locator(`link[data-demo-css="${css}"]`).waitFor({state:'attached',timeout:30000});
    await page.waitForFunction(sheet=>[...document.styleSheets].some(s=>s.href?.endsWith('/'+sheet) && (()=>{try{return s.cssRules.length>100}catch{return false}})()),sheet,{timeout:30000});
    const result=await page.evaluate(sheet=>({css:[...document.styleSheets].filter(s=>s.href?.endsWith('/'+sheet)).map(s=>({href:s.href,rules:s.cssRules.length})), title:document.title,up:typeof window.up}),sheet);
    console.log(`${css} WebView2 loaded:`,JSON.stringify(result));
    if (result.up !== 'object' && result.up !== 'function') throw Error('Unpoly did not initialize');
    if (process.argv.includes('--themes-only')) {
      await page.evaluate(() => localStorage.setItem('demo-theme', 'supabase'));
      await page.reload({waitUntil:'domcontentloaded'});
      await page.locator('select[data-theme-picker]').waitFor({state:'attached',timeout:30000});
      await page.waitForFunction(() => document.querySelector('select[data-theme-picker]')?.value === 'shadcn');
      const initial = await page.evaluate(() => ({
        theme:document.documentElement.dataset.theme || '', saved:localStorage.getItem('demo-theme'),
        choices:[...document.querySelector('select[data-theme-picker]').options].map(x=>x.value)
      }));
      if (JSON.stringify(initial) !== JSON.stringify({theme:'',saved:null,choices:['shadcn','apple','dracula']}))
        throw Error(`${css} legacy theme reset failed: ${JSON.stringify(initial)}`);
      for (const name of ['apple','dracula','shadcn']) {
        await page.locator('select[data-theme-picker]').selectOption(name);
        await page.waitForFunction(name => (document.documentElement.dataset.theme || '') === (name === 'shadcn' ? '' : name),name);
        if (await page.evaluate(() => localStorage.getItem('demo-theme')) !== name) throw Error(`${css} theme ${name} was not saved`);
      }
      await page.reload({waitUntil:'domcontentloaded'});
      await page.waitForFunction(() => document.querySelector('select[data-theme-picker]')?.value === 'shadcn');
      if (errors.length) throw Error(`${css} page errors: ${JSON.stringify(errors)}`);
      console.log(`${css} MAUI theme picker: 3 choices, legacy reset, switching and reload passed`);
      success = true;
      return;
    }
    if (process.argv.includes('--routes-only')) {
      const allRoutes = componentRoutes();
      const from = process.env.MAUI_ROUTE_START ? allRoutes.indexOf(`/components/${process.env.MAUI_ROUTE_START}`) : 0;
      if (from < 0) throw Error('Unknown MAUI_ROUTE_START');
      const routes = allRoutes.slice(from).filter(route => !process.env.MAUI_ROUTE_FILTER || new RegExp(process.env.MAUI_ROUTE_FILTER).test(route));
      if (!routes.length) throw Error('No MAUI routes matched filter');
      const results = {};
      const headings = pageHeadings(path.resolve(__dirname, '../demo/Unpoly.Blazor.Shadcn.Maui/Components/Pages'));
      for (const href of routes) {
        const started = Date.now();
        await navigate(page, href);
        if (href === '/components/calendar') console.log(`${css} Calendar navigation resolved in ${Date.now()-started}ms`);
        // MAUI route URL can update before Blazor swaps the prior page's DOM.
        let ready = false;
        let observed;
        for (let attempt=0; attempt<100; attempt++) {
          try { observed = await page.locator('h1.doc-h1').first().textContent({timeout:1000}); } catch {}
          if (observed?.trim() === headings[href]) { ready=true; break; }
          await new Promise(resolve=>setTimeout(resolve,150));
        }
        if (!ready) throw Error(`MAUI ${css} route did not render ${href} in ${Date.now()-started}ms: expected ${headings[href]}, last heading ${JSON.stringify(observed)}, page errors ${JSON.stringify(errors)}`);
        if (href === '/components/calendar') console.log(`${css} Calendar heading observed in ${Date.now()-started}ms`);
        const result = await page.evaluate(slot => {
          const previews = [...document.querySelectorAll('[id^="preview-"]')].map(el => ({id:el.id, box:el.previousElementSibling?.getBoundingClientRect().toJSON()}));
          if (slot) {
            const root = document.querySelector(`main [data-slot="${slot}"]`);
            previews.push({id:`standalone-${slot}`,box:root?.getBoundingClientRect().toJSON()});
          }
          return {heading:document.querySelector('h1.doc-h1')?.textContent.trim(), previews:previews.map(p=>({id:p.id,width:Math.round(p.box?.width||0),height:Math.round(p.box?.height||0)})), guide:!!document.querySelector('p.doc-lede a[href="/blocks"]')};
        }, standalone[href]);
        if (href === '/components/data-table' ? !result.guide || result.previews.length : !result.previews.length || result.previews.some(p=>!p.width||!p.height)) throw Error(`${href} ${css} failed render: ${JSON.stringify(result)}`);
        if (href === '/components/calendar') {
          const basic = page.locator('#preview-calendar-basic').locator('xpath=preceding-sibling::div[1]');
          const day = basic.locator('input[name="day"][value="2026-03-12"]');
          await day.locator('xpath=..').click({timeout:15000});
          if (!await day.isChecked()) throw Error(`${css} Calendar basic radio did not select March 12`);
          const picker = page.locator('#preview-calendar-date-picker-example').locator('xpath=preceding-sibling::div[1]');
          await picker.locator('#cal-dp').evaluate(el => el.scrollIntoView({block:'center',behavior:'instant'}));
          await picker.locator('#cal-dp').click({timeout:15000});
          await page.locator('#cal-dp-panel:popover-open').waitFor({state:'visible',timeout:15000});
          await picker.locator('input[name="delivery"][value="2026-03-12"]').locator('xpath=..').click({timeout:15000});
          await page.locator('#cal-dp-panel:popover-open').waitFor({state:'hidden',timeout:15000});
          console.log(`${css} MAUI Calendar: radio selection and date-picker popover close`);
        }
        if (href === '/components/context-menu') {
          const trigger = page.locator('#preview-context-menu-basic').locator('xpath=preceding-sibling::div[1]').locator('[data-slot="context-menu-trigger"]');
          await trigger.click({button:'right',timeout:15000});
          await page.locator('#cm-basic:popover-open').waitFor({state:'visible',timeout:10000});
          await page.keyboard.press('Escape');
          await page.locator('#cm-basic:popover-open').waitFor({state:'hidden',timeout:10000});
        }
        if (errors.length) throw Error(`${href} ${css} page errors: ${JSON.stringify(errors)}`);
        results[href] = {heading:result.heading,ids:result.previews.map(p=>p.id)};
        console.log(`${css} MAUI ${href}: ${result.previews.length} rendered examples (${Date.now()-started}ms)`);
      }
      if (process.env.MAUI_ROUTE_BASELINE) {
        const baseline = JSON.parse(fs.readFileSync(process.env.MAUI_ROUTE_BASELINE, 'utf8'));
        for (const href of routes) if (JSON.stringify(baseline[href]) !== JSON.stringify(results[href])) throw Error(`${href} MAUI v4/v3 rendered examples differ: ${JSON.stringify({v4:baseline[href],v3:results[href]})}`);
      }
      if (process.env.MAUI_ROUTE_REPORT) fs.writeFileSync(process.env.MAUI_ROUTE_REPORT, JSON.stringify(results,null,2));
      console.log(`${css} MAUI route crawl passed ${routes.length}/${routes.length}${process.env.MAUI_ROUTE_BASELINE?' against v4 baseline':''}`);
      success = true;
      return;
    }
    if (process.argv.includes('--dracula-button-visual')) {
      const output = process.env.MAUI_DRACULA_BUTTON_DIR;
      if (!output || !fs.statSync(output).isDirectory()) throw Error('MAUI_DRACULA_BUTTON_DIR must be an existing directory');
      await page.evaluate(() => {localStorage.setItem('demo-theme', 'dracula');localStorage.setItem('demo-dark', '1');});
      await page.reload({waitUntil:'domcontentloaded'});
      await page.waitForFunction(() => document.documentElement.dataset.theme === 'dracula' && document.documentElement.classList.contains('dark'));
      await navigate(page, '/components/button');
      const preview = page.locator('#preview-button-rounded').locator('xpath=preceding-sibling::div[1]');
      await preview.waitFor({state:'visible',timeout:15000});
      await preview.evaluate(el=>el.scrollIntoView({block:'center',behavior:'instant'}));
      const state = await preview.evaluate(el => ({
        width:Math.round(el.getBoundingClientRect().width), height:Math.round(el.getBoundingClientRect().height),
        buttons:[...el.querySelectorAll('button')].map(n=>({background:getComputedStyle(n).backgroundColor,box:[n.getBoundingClientRect().width,n.getBoundingClientRect().height]})),
        theme:document.documentElement.dataset.theme,dark:document.documentElement.classList.contains('dark'),
      }));
      if (!state.width || !state.height || !state.buttons.length || state.theme !== 'dracula' || !state.dark || errors.length) throw Error(`${css} MAUI Dracula button: ${JSON.stringify({state,errors})}`);
      const file=path.join(output,`preview-button-rounded-${css}.png`);
      await preview.screenshot({path:file,animations:'disabled',timeout:15000});
      console.log(`${css} MAUI Dracula rounded button: ${JSON.stringify({state,file})}`);
      success=true;
      return;
    }
    if (process.argv.includes('--select-visual')) {
      const output = process.env.MAUI_SELECT_VISUAL_DIR;
      if (!output || !fs.statSync(output).isDirectory()) throw Error('MAUI_SELECT_VISUAL_DIR must be an existing directory');
      await navigate(page, '/components/select');
      for (const id of ['preview-select-basic','preview-select-disabled','preview-select-invalid']) {
        const preview = page.locator(`#${id}`).locator('xpath=preceding-sibling::div[1]');
        await preview.waitFor({state:'visible',timeout:15000});
        await preview.evaluate(el=>el.scrollIntoView({block:'center',behavior:'instant'}));
        await preview.locator('[data-slot="select-trigger"]').first().waitFor({state:'visible',timeout:15000});
        const state = await preview.evaluate(el => ({
          width:Math.round(el.getBoundingClientRect().width),height:Math.round(el.getBoundingClientRect().height),
          triggers:[...el.querySelectorAll('[data-slot="select-trigger"]')].map(n=>({
            text:n.textContent.trim(),background:getComputedStyle(n).backgroundColor,
            opacity:getComputedStyle(n).opacity,disabled:n.getAttribute('aria-disabled'),
          })),
        }));
        if (!state.width || !state.height || !state.triggers.length || errors.length) throw Error(`${css} ${id}: ${JSON.stringify({state,errors})}`);
        const file=path.join(output,`${id}-${css}.png`);
        await preview.screenshot({path:file,animations:'disabled',timeout:15000});
        console.log(`${css} ${id}: ${JSON.stringify({state,file})}`);
      }
      success = true;
      return;
    }
    if (process.argv.includes('--component-visual-paired') || process.argv.includes('--component-visual')) {
      const paired=process.argv.includes('--component-visual-paired');
      if (paired && css !== 'v4') throw Error('Paired capture must start with --baseline (v4)');
      const output=process.env.MAUI_COMPONENT_VISUAL_DIR;
      if (!output || !fs.statSync(output).isDirectory()) throw Error('MAUI_COMPONENT_VISUAL_DIR must be an existing directory');
      if (process.env.MAUI_COMPONENT_VISUAL_DRACULA === '1') {
        await page.evaluate(() => {localStorage.setItem('demo-theme','dracula');localStorage.setItem('demo-dark','1');});
        await page.reload({waitUntil:'domcontentloaded'});
        await page.waitForFunction(() => document.documentElement.dataset.theme === 'dracula' && document.documentElement.classList.contains('dark'));
      }
      const cases = process.argv.includes('--component-visual-expanded') ? [
        ['badge',['preview-badge-custom-colors']],
        ['button',['preview-button-rounded']],
        ['checkbox',['preview-checkbox-basic']],
        ['native-select',['preview-native-select-wrapper-example']],
        ['radio-group',['preview-radio-group-example']],
        ['slider',['preview-slider-vertical','preview-slider-disabled']],
        ['switch',['preview-switch-row']],
        ['tabs',['preview-tabs-example']],
      ] : [
        ['card',['preview-card-basic','preview-card-spacing']],
        ['field',['preview-field-input','preview-field-checkbox']],
        ['input-group',['preview-input-group-example','preview-input-group-button-example']],
      ];
      for (const [route,ids] of cases) {
        await navigate(page,`/components/${route}`);
        for (const id of ids) {
          const preview=page.locator(`#${id}`).locator('xpath=preceding-sibling::div[1]');
          await preview.waitFor({state:'visible',timeout:15000});
          await preview.evaluate(el=>el.scrollIntoView({block:'center',behavior:'instant'}));
          const box=await preview.boundingBox();
          if (!box || box.width<1 || box.height<1 || errors.length) throw Error(`${css} MAUI ${id}: ${JSON.stringify({box,errors})}`);
          const capture=async version=>{
            if (id === 'preview-slider-vertical') {
              const geometry=await preview.evaluate(el=>[...el.querySelectorAll('input[data-slot="slider"]')].map(input=>{
                const s=getComputedStyle(input),r=input.getBoundingClientRect();
                const p=input.parentElement,ps=getComputedStyle(p),pr=p.getBoundingClientRect();
                return {rect:{x:r.x,y:r.y,width:r.width,height:r.height},value:input.value,styles:{height:s.height,minHeight:s.minHeight,blockSize:s.blockSize,writingMode:s.writingMode,margin:s.margin,alignSelf:s.alignSelf,cssHeight:s.getPropertyValue('height')},parent:{rect:{y:pr.y,height:pr.height},height:ps.height,minHeight:ps.minHeight,display:ps.display,alignItems:ps.alignItems}};
              }));
              console.log(`${version} MAUI vertical Slider geometry: ${JSON.stringify(geometry)}`);
            }
            const file=path.join(output,`${id}-${version}.png`);
            const current=await preview.boundingBox();
            if (!current || Math.abs(current.width-box.width)>.02 || Math.abs(current.height-box.height)>.02) throw Error(`${version} MAUI ${id}: changed geometry ${JSON.stringify({box,current})}`);
            await preview.screenshot({path:file,animations:'disabled',timeout:15000});
            console.log(`${version} MAUI ${id}: ${JSON.stringify({width:current.width,height:current.height,y:current.y,file})}`);
          };
          await capture(css);
          if (paired) {
            // Change only the linked CSS on this already-rendered route. Keeping
            // DOM and scroll fixed distinguishes style differences from distinct
            // WebView process initialization/scroll-position screenshot noise.
            await page.evaluate(() => new Promise((resolve,reject)=>{
              const link=document.querySelector('link[data-demo-css="v4"]');
              if (!link) return reject(Error('v4 stylesheet link missing'));
              link.addEventListener('load',resolve,{once:true});
              link.addEventListener('error',()=>reject(Error('v3 stylesheet load failed')),{once:true});
              link.href='app.v3.css';
            }));
            await page.waitForFunction(()=>[...document.styleSheets].some(s=>s.href?.endsWith('/app.v3.css') && (()=>{try{return s.cssRules.length>100}catch{return false}})()),null,{timeout:15000});
            await capture('v3');
            await page.evaluate(() => new Promise((resolve,reject)=>{
              const link=document.querySelector('link[data-demo-css="v4"]');
              link.addEventListener('load',resolve,{once:true});
              link.addEventListener('error',()=>reject(Error('v4 stylesheet reload failed')),{once:true});
              link.href='app.css';
            }));
          }
        }
      }
      if (errors.length) throw Error(`${css} MAUI component visual page errors: ${JSON.stringify(errors)}`);
      success=true;
      return;
    }
    if (process.argv.includes('--palette-visual')) {
      const output=process.env.MAUI_PALETTE_DIR;
      if (!output || !fs.statSync(output).isDirectory()) throw Error('MAUI_PALETTE_DIR must be an existing directory');
      if (process.env.MAUI_PALETTE_DRACULA === '1') {
        await page.evaluate(() => {localStorage.setItem('demo-theme','dracula');localStorage.setItem('demo-dark','1');});
        await page.reload({waitUntil:'domcontentloaded'});
        await page.waitForFunction(() => document.documentElement.dataset.theme === 'dracula' && document.documentElement.classList.contains('dark'));
      }
      for (const [route,id] of [['alert','preview-alert-custom-colors'],['badge','preview-badge-custom-colors']]) {
        await navigate(page,`/components/${route}`);
        const preview=page.locator(`#${id}`).locator('xpath=preceding-sibling::div[1]');
        await preview.waitFor({state:'visible',timeout:15000});
        await preview.evaluate(el=>el.scrollIntoView({block:'center',behavior:'instant'}));
        const values=await preview.evaluate(el=>[...el.querySelectorAll('[data-slot="alert"],[data-slot="badge"]')].map(n=>({background:getComputedStyle(n).backgroundColor,color:getComputedStyle(n).color,box:[n.getBoundingClientRect().width,n.getBoundingClientRect().height]})));
        if (!values.length || errors.length) throw Error(`${css} MAUI palette ${id}: ${JSON.stringify({values,errors})}`);
        const file=path.join(output,`${id}-${css}.png`);
        await preview.screenshot({path:file,animations:'disabled',timeout:15000});
        console.log(`${css} MAUI palette ${id}: ${JSON.stringify({values,file})}`);
      }
      success=true;
      return;
    }
    if (process.argv.includes('--otp-timeline-only')) {
      await navigate(page, '/components/input-otp');
      const preview = page.locator('#preview-input-otp-example').locator('xpath=preceding-sibling::div[1]');
      const otp = preview.locator('[data-slot="input-otp"]');
      const boxes = otp.locator('[data-slot="input-otp-slot"]');
      const hidden = otp.locator('[data-otp-value]');
      await boxes.first().waitFor({state:'visible',timeout:15000});
      if (await boxes.count() !== 6 || await hidden.inputValue() !== '') throw Error(`${css} MAUI OTP initial state`);
      await boxes.first().fill('9');
      if (await hidden.inputValue() !== '9' || !await boxes.nth(1).evaluate(el=>el===document.activeElement)) throw Error(`${css} MAUI OTP input/advance`);
      await boxes.first().evaluate(el=>{const data=new DataTransfer();data.setData('text','654321');el.dispatchEvent(new ClipboardEvent('paste',{bubbles:true,cancelable:true,clipboardData:data}))});
      if (await hidden.inputValue() !== '654321') throw Error(`${css} MAUI OTP paste`);
      await boxes.nth(3).fill('');
      await boxes.nth(3).press('Backspace');
      if (await hidden.inputValue() !== '6521' || !await boxes.nth(2).evaluate(el=>el===document.activeElement)) throw Error(`${css} MAUI OTP backspace`);
      await navigate(page, '/components/timeline');
      const alternate = page.locator('#preview-timeline-alternate').locator('xpath=preceding-sibling::div[1]');
      await alternate.waitFor({state:'visible',timeout:15000});
      const positions = await alternate.locator('[data-slot="timeline-item"]').evaluateAll(els=>els.map(el=>el.querySelector('[data-slot="timeline-dot"]').getBoundingClientRect().x));
      if (positions.length !== 4 || positions[0] !== positions[2] || positions[1] !== positions[3] || positions[1] < positions[0]+100) throw Error(`${css} MAUI alternate Timeline: ${JSON.stringify(positions)}`);
      if (errors.length) throw Error(`${css} MAUI page errors: ${JSON.stringify(errors)}`);
      console.log(`${css} MAUI OTP edit/paste/backspace/hidden value and alternate Timeline: PASS`);
      success=true;
      return;
    }
    if (process.argv.includes('--snippet-only')) {
      await navigate(page, '/components/snippet');
      const snippet = page.locator('[data-slot="snippet"]').first();
      await snippet.waitFor({state:'visible',timeout:15000});
      const initial = await snippet.evaluate(el => ({
        width:Math.round(el.getBoundingClientRect().width),height:Math.round(el.getBoundingClientRect().height),
        gap:getComputedStyle(el.querySelector('[data-slot="tabs"]')).gap,
        font:getComputedStyle(el.querySelector('[data-slot="tabs-trigger"]')).fontSize,
        shown:[...el.querySelectorAll('[data-slot="tabs-content"]:not([hidden])')].map(n=>n.getAttribute('data-value')),
      }));
      if (initial.shown.join() !== 'pnpm') throw Error(`${css} MAUI initial Snippet ${JSON.stringify(initial)}`);
      await snippet.locator('[data-slot="tabs-trigger"][data-value="npm"]').click({timeout:15000});
      await page.waitForFunction(()=>document.querySelector('[data-slot="snippet"] [data-slot="tabs-content"][data-value="npm"]:not([hidden])'),null,{timeout:15000});
      const code = await snippet.locator('[data-slot="tabs-content"][data-value="npm"] [data-slot="snippet-copy-value"]').textContent();
      if (code?.trim() !== 'npm install unpoly-blazor-shadcn' || errors.length) throw Error(`${css} MAUI Snippet click ${JSON.stringify({code,errors})}`);
      console.log(`${css} MAUI Snippet initial geometry and tab: ${JSON.stringify(initial)}; npm command selected`);
      success=true;
      return;
    }
    if (process.argv.includes('--inventory-only')) {
      await checkInventory(page, href => navigate(page, href), css);
      if (errors.length) throw Error(`Page errors: ${JSON.stringify(errors)}`);
      success = true;
      return;
    }
    if (process.argv.includes('--review-only')) {
      success = true;
      console.log(`Review MAUI ${css} in the open app window (PID ${child.pid}); close the window after review.`);
      return;
    }
    await navigate(page, '/components/popover');
    await page.locator('#preview-popover-basic').waitFor({state:'attached',timeout:30000});
    const box = page.locator('#preview-popover-basic').locator('xpath=preceding-sibling::div[1]');
    await box.evaluate(el => el.scrollIntoView({block:'center',behavior:'instant'}));
    await box.locator('[popovertarget="pop-basic"]').click();
    await page.waitForFunction(()=>document.getElementById('pop-basic')?.matches(':popover-open'),null,{timeout:10000});
    // Native popover-open may become true before the asynchronous placement pass runs.
    // Poll the actual coordinates, not only the open state; fail if placement never settles.
    await page.waitForFunction(() => {
      const el=document.getElementById('pop-basic'),t=document.querySelector('[popovertarget="pop-basic"]');
      if (!el?.matches(':popover-open') || !t || !el.style.top) return false;
      const panel=el.getBoundingClientRect(),trigger=t.getBoundingClientRect();
      return Math.abs(panel.left+panel.width/2-trigger.left-trigger.width/2)<8 && panel.top>=-1 && panel.right<=innerWidth+1;
    },null,{timeout:10000});
    const placement=await page.evaluate(()=>{const el=document.getElementById('pop-basic'),t=document.querySelector('[popovertarget="pop-basic"]'),panel=el.getBoundingClientRect(),trigger=t.getBoundingClientRect();return {dx:Math.round(panel.left+panel.width/2-trigger.left-trigger.width/2),panelX:Math.round(panel.left),triggerX:Math.round(trigger.left),left:el.style.left,right:el.style.right,top:el.style.top,align:el.dataset.align,side:el.dataset.side,placed:el.dataset.placedSide,visible:panel.top>=-1 && panel.right<=innerWidth+1}});
    console.log(`${css} WebView2 popover:`,JSON.stringify(placement));
    if (Math.abs(placement.dx)>=8 || !placement.visible) throw Error('Popover placement regression in WebView2');
    await page.keyboard.press('Escape');
    await page.waitForFunction(()=>!document.getElementById('pop-basic')?.matches(':popover-open'),null,{timeout:10000});
    await navigate(page, '/components/select');
    const select = page.locator('#preview-select-basic').locator('xpath=preceding-sibling::div[1]');
    await select.locator('[data-slot="select-trigger"]').waitFor({state:'visible',timeout:30000});
    await select.evaluate(el=>el.scrollIntoView({block:'center',behavior:'instant'}));
    await select.locator('[data-slot="select-trigger"]').click({timeout:15000});
    await page.locator('[data-slot="select-content"]:popover-open [data-slot="select-item"]').nth(2).click({timeout:15000});
    await page.waitForFunction(()=>document.querySelector('#kind')?.value==='shoes' && document.querySelector('#kind')?.parentElement?.querySelector('[data-slot="select-value"]')?.textContent.trim()==='Shoes',null,{timeout:15000});
    console.log(`${css} WebView2 Select: chosen row posts shoes and displays Shoes`);
    await navigate(page, '/components/combobox');
    const search = page.locator('#preview-combobox-search-input').locator('xpath=preceding-sibling::div[1]');
    await search.locator('#cb-search-example-input').waitFor({ state: 'visible', timeout: 30000 });
    await search.evaluate(el => el.scrollIntoView({ block: 'center', behavior: 'instant' }));
    await search.locator('#cb-search-example-input').fill('astro', { timeout: 15000 });
    await search.locator('[data-slot="combobox-item"][data-value="astro"]').click({ timeout: 15000 });
    await page.waitForFunction(() => {
      const scope = document.querySelector('#preview-combobox-search-input')?.previousElementSibling;
      return scope?.querySelector('input[name="search-framework"]')?.value === 'astro' &&
        scope?.querySelector('#cb-search-example-input')?.value === 'Astro';
    }, null, { timeout: 15000 });
    console.log(`${css} WebView2 ComboboxInput: filtered Astro posts its value and shows its label`);
    await navigate(page, '/components/switch');
    const switches = page.locator('#preview-switch-row').locator('xpath=preceding-sibling::div[1]');
    await switches.locator('input[data-slot="switch"]').first().waitFor({state:'visible',timeout:30000});
    const initial = await switches.locator('input[data-slot="switch"]').evaluateAll(items=>items.map(el=>({checked:el.checked,role:el.getAttribute('role'),width:Math.round(el.getBoundingClientRect().width)})));
    if (JSON.stringify(initial)!==JSON.stringify([{checked:true,role:'switch',width:32},{checked:false,role:'switch',width:24}])) throw Error(`Switch initial/geometry mismatch: ${JSON.stringify(initial)}`);
    await switches.locator('label').first().click({timeout:15000});
    await switches.locator('label').nth(1).click({timeout:15000});
    await page.waitForFunction(()=>{const inputs=[...document.querySelector('#preview-switch-row')?.previousElementSibling?.querySelectorAll('[data-slot="switch"]')||[]];return inputs.length===2 && !inputs[0].checked && inputs[1].checked},null,{timeout:15000});
    console.log(`${css} WebView2 Switch: labeled toggles, accessible role and both rendered sizes`);
    await navigate(page, '/components/checkbox');
    const checkbox = page.locator('#preview-checkbox-checked-state').locator('xpath=preceding-sibling::div[1]');
    await checkbox.locator('#c-mixed').waitFor({state:'visible',timeout:30000});
    await page.waitForFunction(()=>document.querySelector('#c-mixed')?.indeterminate===true,null,{timeout:15000});
    const checkboxInitial = await checkbox.locator('input[data-slot="checkbox"]').evaluateAll(items=>items.map(el=>({checked:el.checked,mixed:el.indeterminate})));
    if (JSON.stringify(checkboxInitial)!==JSON.stringify([{checked:false,mixed:true},{checked:true,mixed:false},{checked:false,mixed:false}])) throw Error(`Checkbox initial states mismatch: ${JSON.stringify(checkboxInitial)}`);
    await checkbox.locator('label[for="c-off"]').click({timeout:15000});
    await page.waitForFunction(()=>document.querySelector('#c-off')?.checked===true && document.querySelector('#c-mixed')?.checked===true && !document.querySelector('#c-mixed')?.indeterminate,null,{timeout:15000});
    await checkbox.locator('label[for="c-mixed"]').click({timeout:15000});
    await page.waitForFunction(()=>['c-on','c-off','c-mixed'].every(id=>!document.getElementById(id)?.checked),null,{timeout:15000});
    console.log(`${css} WebView2 Checkbox: mixed initial state, child sync, and select-all toggle`);
    await navigate(page, '/components/radio-group');
    const radio = page.locator('#preview-radio-group-example').locator('xpath=preceding-sibling::div[1]');
    await radio.locator('input[name="plan-basic"]').first().waitFor({state:'visible',timeout:30000});
    const radioInitial = await radio.locator('input[name="plan-basic"]').evaluateAll(items=>items.map(el=>({value:el.value,checked:el.checked,disabled:el.disabled})));
    if (JSON.stringify(radioInitial)!==JSON.stringify([{value:'free',checked:true,disabled:false},{value:'pro',checked:false,disabled:false},{value:'team',checked:false,disabled:true}])) throw Error(`RadioGroup initial states mismatch: ${JSON.stringify(radioInitial)}`);
    await radio.locator('label').nth(1).click({timeout:15000});
    await page.waitForFunction(()=>{const items=[...document.querySelector('#preview-radio-group-example')?.previousElementSibling?.querySelectorAll('input[name="plan-basic"]')||[]];return items.length===3 && !items[0].checked && items[1].checked && !items[2].checked},null,{timeout:15000});
    console.log(`${css} WebView2 RadioGroup: exclusive labeled selection and disabled option`);
    await navigate(page, '/components/slider');
    const vertical = page.locator('#preview-slider-vertical').locator('xpath=preceding-sibling::div[1]');
    await vertical.locator('[data-slot="slider"][data-orientation="vertical"]').first().waitFor({state:'visible',timeout:30000});
    const shape = await vertical.locator('[data-slot="slider"][data-orientation="vertical"]').first().evaluate(el=>({width:Math.round(el.getBoundingClientRect().width),height:Math.round(el.getBoundingClientRect().height)}));
    if (shape.width!==16 || shape.height<=100) throw Error(`Slider vertical geometry mismatch: ${JSON.stringify(shape)}`);
    const temperature=page.locator('#slider-temperature');
    await temperature.focus({timeout:15000});
    const before=await page.locator('output[for="slider-temperature"]').innerText();
    await page.keyboard.press('ArrowRight');
    await page.waitForFunction(before=>document.querySelector('output[for="slider-temperature"]')?.textContent.trim()!==before,before,{timeout:15000});
    const after=await page.locator('output[for="slider-temperature"]').innerText();
    if (Number(after)<=Number(before) || await temperature.inputValue()!==after.trim()) throw Error(`Slider output did not follow input: ${before} -> ${after}`);
    console.log(`${css} WebView2 Slider: 16px vertical width and keyboard-updated output ${before} -> ${after}`);
    await navigate(page, '/components/field');
    const range = page.locator('#preview-field-price-range').locator('xpath=preceding-sibling::div[1]');
    await range.getByText('Price range').waitFor({ state: 'visible', timeout: 30000 });
    const low = range.locator('#fsl-maui-price-0');
    await low.focus({ timeout: 15000 });
    await page.keyboard.press('ArrowRight');
    await page.waitForFunction(() => document.querySelector('output[for="fsl-maui-price-0"]')?.textContent?.trim() === '210', null, { timeout: 15000 });
    if (await range.locator('#fsl-maui-price-1').inputValue() !== '800') throw Error('Price range second thumb moved unexpectedly');
    console.log(`${css} WebView2 FieldTitle/range: labeled thumbs, output follows first thumb without moving second`);
    await navigate(page, '/components/typography');
    const toc = page.locator('#preview-table-of-contents-example').locator('xpath=preceding-sibling::div[1]');
    await toc.getByRole('navigation', { name: 'Example sections' }).waitFor({ state: 'visible', timeout: 30000 });
    await toc.getByRole('link', { name: 'Details' }).click({ timeout: 15000 });
    await page.waitForFunction(() => location.hash === '#toc-details' &&
      document.querySelector('#toc-details')?.textContent?.trim() === 'Details', null, { timeout: 15000 });
    console.log(`${css} WebView2 TableOfContents: heading navigation resolves within the example`);
    await navigate(page, '/components/message-scroller');
    const conversation=page.locator('#preview-conversation-example').locator('xpath=preceding-sibling::div[1]');
    try { await conversation.locator('[data-slot="message-scroller-viewport"]').waitFor({state:'attached',timeout:30000}); }
    catch (error) { console.error('MessageScroller navigation:',page.url(),await page.evaluate(()=>({title:document.title,body:document.body?.innerText.slice(0,700),html:document.body?.innerHTML.length,preview:document.getElementById('preview-conversation-example')?.outerHTML.slice(0,250)})),errors); throw error; }
    await conversation.evaluate(el => el.scrollIntoView({block:'center',behavior:'instant'}));
    await conversation.locator('[data-slot="message-scroller-viewport"]').evaluate(v=>{
      // A reader gesture interrupts an in-flight follow/chase before leaving the end.
      v.dispatchEvent(new WheelEvent('wheel', { deltaY: -100, bubbles: true }));
      v.scrollTop = 0;
    });
    try { await conversation.locator('[data-slot="message-scroller-button"][data-direction="end"]').waitFor({ state: 'visible', timeout: 15000 }); }
    catch (error) { console.error('MessageScroller did not leave end:', await conversation.evaluate(el => {
      const r=el.querySelector('[data-slot="message-scroller"]'),v=r?.querySelector('[data-slot="message-scroller-viewport"]');
      return {top:v?.scrollTop,height:v?.scrollHeight,client:v?.clientHeight,following:r?.dataset.following,autoscrolling:v?.dataset.autoscrolling};
    })); throw error; }
    await conversation.locator('[data-slot="message-scroller-button"][data-direction="end"]').click();
    await page.waitForFunction(()=>{const r=document.getElementById('preview-conversation-example')?.previousElementSibling?.querySelector('[data-slot="message-scroller"]');const v=r?.querySelector('[data-slot="message-scroller-viewport"]');return v && Math.round(v.scrollTop)>=Math.round(v.scrollHeight-v.clientHeight)-2 && r.dataset.following==='true'},null,{timeout:15000});
    console.log(`${css} WebView2 MessageScroller jump: at end and following`);
    if (errors.length) throw Error(`Page errors: ${JSON.stringify(errors)}`);
    if (process.argv.includes('--keep-open')) {
      await page.locator('a[href="/"]').first().click({timeout:15000});
      await page.locator(`link[data-demo-css="${css}"]`).waitFor({state:'attached',timeout:15000});
      console.log(`Review MAUI ${css} in the open app window (PID ${child.pid}); close the window after review.`);
    }
    success = true;
  } finally {
    // A failed smoke must not leave a debug-enabled WebView running.
    const keep = process.argv.includes('--keep-open') && success;
    try { await browser?.close() } catch {}
    if (keep) child.unref();
    else try {execFileSync('taskkill',['/T','/F','/PID',String(child.pid)],{stdio:'ignore'})}catch{}
  }
})().catch(e=>{console.error(e);process.exitCode=1});
