// Build Release first. Runs the exact same audit as native WebView2, in a real SSR host.
const {spawn}=require('node:child_process');
const path=require('node:path');
const {chromium}=require('playwright-core');
const {auditCreativeMedia}=require('./creative-media-audit.cjs');
(async()=>{
  const root=path.resolve(__dirname,'..'), url='http://127.0.0.1:5099', output=process.env.CREATIVE_MEDIA_AUDIT_DIR||path.join(root,'artifacts','creative-media-audit');
  const server=spawn(process.env.DOTNET||'dotnet',['run','--no-build','--configuration','Release','--project','demo/Unpoly.Blazor.Shadcn.Demo','--urls',url],{cwd:root,env:{...process.env,ASPNETCORE_ENVIRONMENT:'Development'},stdio:['ignore','ignore','inherit']});
  let browser;
  try {
    let ready=false;
    for(let i=0;i<150;i++){try{ready=(await fetch(url)).ok;if(ready)break}catch{}await new Promise(r=>setTimeout(r,100))}
    if(!ready)throw Error('Web audit host did not start');
    browser=await chromium.launch({headless:true});
    for(const css of ['v3','v4']){
      const context=await browser.newContext({viewport:{width:1280,height:900},reducedMotion:'reduce'}),page=await context.newPage();
      await page.goto(`${url}/components/creative-media?demo-css=${css}`,{waitUntil:'networkidle'});
      const navigate=async(page,route)=>{
        const link=page.locator(`.doc-nav a[href="${route}"]`).first();
        await link.click();await page.waitForFunction(route=>location.pathname===route,route);
      };
      try{await auditCreativeMedia(page,navigate,{output,host:'web',css})}finally{await context.close()}
    }
  }finally{await browser?.close();server.kill()}
})().catch(error=>{console.error(error);process.exitCode=1});
