const test=require('node:test');const assert=require('node:assert/strict');const postcss=require('postcss');
const {comboboxChipInputCompat}=require('./postcss-combobox-chip-input-compat.cjs');
const base='.min-w-16 {min-width:4rem}.flex-1 {flex:1 1 0%}';
test('resets only the library Combobox chip input background',async()=>{
 const s=(await postcss([comboboxChipInputCompat()]).process(base,{from:undefined})).css;
 assert.match(s,/input\[data-slot="combobox-chip-input"\], input\[data-slot="input-otp-slot"\]\s*\{\s*background-color:\s*transparent/);
 assert.doesNotMatch(s,/input:not/);
});
test('fails closed if utility contract changes',async()=>{
 await assert.rejects(postcss([comboboxChipInputCompat()]).process(base.replace('4rem','5rem'),{from:undefined}),/Unexpected chip/);
});
