import test from 'node:test';
import assert from 'node:assert/strict';
// Only host globals are stubbed; this loads the actual ES module graph, including circular imports.
globalThis.document={documentElement:{},addEventListener(){}};
globalThis.MutationObserver=class{observe(){}};
globalThis.$=()=>({on(){return this}});
test('phone module graph initializes, and backup settings include shared financial records',async()=>{
 const phone=await import('../src/phone.js');const {pickSettings}=await import('../src/chats.js');
 assert.equal(typeof phone.openPhone,'function');const financial={accounts:{a:{amount:100}},prices:{},transfers:{}};
 const copied=pickSettings({finance:financial,phones:{}});assert.deepEqual(copied.finance,financial);assert.notEqual(copied.finance,financial);
});
