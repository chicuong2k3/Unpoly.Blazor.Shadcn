const test=require('node:test'),assert=require('node:assert/strict'),postcss=require('postcss');
const {timelineAlternateCompat}=require('./postcss-timeline-alternate-compat.cjs');
const selector='.data-\\[alternate\\=true\\]\\:\\[\\&\\>\\[data-slot\\=timeline-item\\]\\:nth-child\\(even\\)\\]\\:flex-row-reverse>[data-slot=timeline-item]:nth-child(even)[data-alternate="true"]';
test('binds alternate attribute to timeline parent',async()=>{
 const s=(await postcss([timelineAlternateCompat()]).process(`${selector} {flex-direction:row-reverse}`,{from:undefined})).css;
 assert.match(s,/\[data-alternate="true"\] > \[data-slot=timeline-item\]:nth-child\(even\)/);
 assert.doesNotMatch(s,/nth-child\(even\)\[data-alternate/);
});
test('fails closed on absent selector',async()=>{
 await assert.rejects(postcss([timelineAlternateCompat()]).process('.other {display:flex}',{from:undefined}),/Expected one/);
});
