#!/usr/bin/env node
// Run maui-webview-smoke.cjs --baseline --select-visual and --select-visual
// sequentially against the SAME opt-in build and MAUI_SELECT_VISUAL_DIR first.
// This compares only basic/disabled/invalid Select previews in WebView2.
const sharp = require('sharp');
const path = require('node:path');
const fs = require('node:fs');
async function run(directory) {
  if (!directory || !fs.statSync(directory).isDirectory()) throw Error('Existing screenshot directory required');
  for (const name of ['basic','disabled','invalid']) {
    const buffers = await Promise.all(['v4','v3'].map(css => sharp(path.join(directory, `preview-select-${name}-${css}.png`)).removeAlpha().raw().toBuffer({resolveWithObject:true})));
    const [a,b] = buffers;
    if (a.info.width !== b.info.width || a.info.height !== b.info.height) throw Error(`${name}: differing screenshot dimensions`);
    let changed=0,peak=0;
    for (let i=0;i<a.data.length;i+=3) {
      const d=Math.max(Math.abs(a.data[i]-b.data[i]),Math.abs(a.data[i+1]-b.data[i+1]),Math.abs(a.data[i+2]-b.data[i+2]));
      if (d>2) changed++;
      peak=Math.max(peak,d);
    }
    const fraction=changed/(a.data.length/3);
    console.log(`MAUI Select ${name}: ${a.info.width}x${a.info.height}, ${(fraction*100).toFixed(2)}% pixels >2/channel, peak ${peak}`);
    if (fraction>.005) throw Error(`${name}: MAUI Select screenshot differs by more than 0.5%`);
  }
}
if (require.main===module) run(process.argv[2]).catch(error=>{console.error(error);process.exitCode=1});
module.exports={run};
