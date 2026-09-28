const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const sharp=require('sharp');
const {compare}=require('./maui-component-visual-diff.cjs');
test('WebView2 comparator accepts only equal dimensions and bounded pixel differences',async()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'maui-visual-test-'));
  const name='preview-test';
  const image=(width,r,g,b)=>sharp({create:{width,height:20,channels:3,background:{r,g,b}}}).png().toFile(path.join(dir,`${name}-${width===10?'v4':'v3'}.png`));
  try {
    await Promise.all([image(10,200,200,200),image(11,200,200,200)]);
    await assert.rejects(compare(dir,[name]),/differing screenshot dimensions/);
    await sharp({create:{width:10,height:20,channels:3,background:{r:200,g:200,b:200}}}).png().toFile(path.join(dir,`${name}-v3.png`));
    assert.equal(await compare(dir,[name]),1);
    await sharp({create:{width:10,height:20,channels:3,background:{r:255,g:0,b:0}}}).png().toFile(path.join(dir,`${name}-v3.png`));
    await assert.rejects(compare(dir,[name]),/differs by more than 0.5%/);
  } finally {fs.rmSync(dir,{recursive:true,force:true});}
});
