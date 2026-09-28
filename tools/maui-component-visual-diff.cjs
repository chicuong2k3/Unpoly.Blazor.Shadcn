#!/usr/bin/env node
// Diagnostic WebView2 screenshots from --component-visual, not a component-wide certificate.
const sharp = require('sharp');
const path = require('node:path');
const fs = require('node:fs');
const names = [
  'preview-card-basic','preview-card-spacing',
  'preview-field-input','preview-field-checkbox',
  'preview-input-group-example','preview-input-group-button-example',
];
const expandedNames = [
  'preview-badge-custom-colors','preview-button-rounded','preview-checkbox-basic',
  'preview-native-select-wrapper-example','preview-radio-group-example',
  'preview-slider-vertical','preview-slider-disabled','preview-switch-row','preview-tabs-example',
];
async function compare(directory, ids=names) {
  if (!directory || !fs.existsSync(directory) || !fs.statSync(directory).isDirectory()) throw Error('Existing screenshot directory required');
  if (!ids.length) throw Error('At least one preview required');
  let failed=false;
  for (const id of ids) {
    const images = await Promise.all(['v4','v3'].map(css => sharp(path.join(directory, `${id}-${css}.png`)).removeAlpha().raw().toBuffer({resolveWithObject:true})));
    const [a,b] = images;
    if (a.info.width !== b.info.width || a.info.height !== b.info.height) throw Error(`${id}: differing screenshot dimensions`);
    let changed=0,peak=0;
    for (let i=0;i<a.data.length;i+=3) {
      const d=Math.max(Math.abs(a.data[i]-b.data[i]),Math.abs(a.data[i+1]-b.data[i+1]),Math.abs(a.data[i+2]-b.data[i+2]));
      if (d>2) changed++;
      peak=Math.max(peak,d);
    }
    const fraction=changed/(a.data.length/3);
    console.log(`MAUI ${id}: ${a.info.width}x${a.info.height}, ${(fraction*100).toFixed(2)}% pixels >2/channel, peak ${peak}`);
    if (fraction>.005) failed=true;
  }
  if (failed) throw Error('MAUI component screenshot differs by more than 0.5%');
  return ids.length;
}
if (require.main===module) compare(process.argv[2], process.argv.includes('--expanded') ? expandedNames : names).catch(error=>{console.error(error);process.exitCode=1});
module.exports={compare,names,expandedNames};
