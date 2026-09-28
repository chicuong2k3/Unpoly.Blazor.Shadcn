#!/usr/bin/env node
// Focused real Web demo interaction and layout comparison; does not replace the
// full Behaviour suite or MAUI WebView tests.
const { chromium } = require('playwright-core');
const assert = require('node:assert/strict');
const base=process.env.BEHAVIOUR_URL||'http://127.0.0.1:5187';
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.argv[2]});
 try{
  for(const css of ['v4','v3']){
   const context=await browser.newContext();const page=await context.newPage(),errors=[];
   page.on('pageerror',e=>errors.push(String(e)));
   try{
    await page.goto(`${base}/components/input-otp?demo-css=${css}`);
    await page.waitForFunction(css=>document.querySelector('#demo-app-css')?.getAttribute('href')?.startsWith(css==='v3'?'app.v3.css':'app.css'),css);
    const root=page.locator('#preview-input-otp-example').locator('xpath=preceding-sibling::div[1]').locator('[data-slot="input-otp"]');
    const boxes=root.locator('[data-slot="input-otp-slot"]'),hidden=root.locator('[data-otp-value]');
    assert.equal(await boxes.count(),6);
    assert.equal(await hidden.inputValue(),'123456');
    const bg=await boxes.first().evaluate(el=>getComputedStyle(el).backgroundColor);
    assert.equal(bg,'rgba(0, 0, 0, 0)',`${css} OTP should inherit transparent background`);
    await boxes.first().fill('9');
    assert.equal(await hidden.inputValue(),'923456');
    assert.equal(await boxes.nth(1).evaluate(el=>el===document.activeElement),true);
    await boxes.first().focus();
    await boxes.first().evaluate(el=>el.dispatchEvent(new ClipboardEvent('paste',{bubbles:true,cancelable:true,clipboardData:new DataTransfer()}))); // empty paste must not erase
    assert.equal(await hidden.inputValue(),'923456');
    await boxes.first().evaluate(el=>{const data=new DataTransfer();data.setData('text','654321');el.dispatchEvent(new ClipboardEvent('paste',{bubbles:true,cancelable:true,clipboardData:data}))});
    assert.equal(await hidden.inputValue(),'654321');
    await boxes.nth(3).fill('');
    await boxes.nth(3).press('Backspace');
    assert.equal(await hidden.inputValue(),'6521');
    assert.equal(await boxes.nth(2).evaluate(el=>el===document.activeElement),true);
    await page.goto(`${base}/components/timeline`);
    const timeline=page.locator('#preview-timeline-alternate').locator('xpath=preceding-sibling::div[1]').locator('[data-slot="timeline"]');
    const positions=await timeline.locator('[data-slot="timeline-item"]').evaluateAll(els=>els.map(el=>({item:el.getBoundingClientRect().x,dot:el.querySelector('[data-slot="timeline-dot"]').getBoundingClientRect().x})));
    assert.equal(positions.length,4);
    assert.equal(positions[0].dot,positions[2].dot);
    assert.equal(positions[1].dot,positions[3].dot);
    assert.ok(positions[1].dot>positions[0].dot+100,`${css} alternate timeline should zigzag: ${JSON.stringify(positions)}`);
    assert.deepEqual(errors,[]);
    console.log(`${css} OTP edit/paste/backspace/hidden value and alternate Timeline: PASS`);
   }finally{await context.close()}
  }
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
