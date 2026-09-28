const test = require('node:test');
const assert = require('node:assert/strict');
const postcss = require('postcss');
const {attachmentPaddingCompat} = require('./postcss-attachment-padding-compat.cjs');
const media = n => `.has-data-\\[slot\\=attachment-media\\]\\:p-${n}:has([data-slot=attachment-media]){padding:${n}px}`;
const content = n => `.has-data-\\[slot\\=attachment-content\\]\\:py-${n}:has([data-slot=attachment-content]){padding-top:${n}px}`;
test('restores v4 Attachment padding precedence while preserving three size variants',async()=>{
  const root=(await postcss([attachmentPaddingCompat()]).process(['1','1\\.5','2'].map(media).concat(['1','1\\.5','2'].map(content)).join('\n'),{from:undefined})).root;
  assert.deepEqual(root.nodes.map(x=>x.selector.includes('attachment-media')?'media':'content'),['content','content','content','media','media','media']);
  assert.deepEqual(root.nodes.slice(3).map(x=>x.nodes[0].value),['1px','1\\.5px','2px']);
});
test('unknown Attachment input fails closed', async()=>{
  await assert.rejects(postcss([attachmentPaddingCompat()]).process('.other{padding:1px}',{from:undefined}),/Expected 3 Attachment/);
});
