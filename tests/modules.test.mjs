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
test('phone reopening remembers the last character per chat and explicit selection wins',async()=>{
 const {selectedPhoneOwner}=await import('../src/phone.js');
 const names=['Oscar','Somang'], m={phones:{oscar:{},somang:{}},lastPhoneOwner:'Somang'};
 assert.equal(selectedPhoneOwner(m,names),'Somang');
 assert.equal(selectedPhoneOwner(m,[...names].reverse()),'Somang');
 assert.equal(selectedPhoneOwner(m,names,'Oscar'),'Oscar');
 assert.equal(selectedPhoneOwner(m,names,'missing'),'Somang');
 assert.equal(selectedPhoneOwner({...m,lastPhoneOwner:'removed'},names),'Oscar');
 assert.equal(selectedPhoneOwner({phones:{somang:{}}},names),'Somang');
 assert.equal(selectedPhoneOwner({phones:{}},names),'Oscar');
 assert.equal(selectedPhoneOwner(m,[]),null);
 assert.equal(selectedPhoneOwner({phones:{},lastPhoneOwner:'Somang'},names),'Somang');
});
test('phone selection survives reload with stale metadata, stays scoped, and is backed up',async()=>{
 const {selectedPhoneOwner,phoneSelectionKey,readPhoneSelection,rememberPhoneSelection}=await import('../src/phone.js');
 const {pickSettings}=await import('../src/chats.js');
 const store=new Map(), storage={getItem:k=>store.get(k) ?? null,setItem:(k,v)=>store.set(k,v)};
 const c={characterId:0,characters:[{avatar:'oscar.png'}],getCurrentChatId:()=> 'chat-a'};
 const key=phoneSelectionKey(c),m={phones:{oscar:{},somang:{}},lastPhoneOwner:'Somang'};
 rememberPhoneSelection(m,'Oscar',key,storage);
 // The server copy was not flushed before refresh. Only browser storage survives.
 const reloaded={phones:{oscar:{},somang:{}},lastPhoneOwner:'Somang'};
 assert.equal(selectedPhoneOwner(reloaded,['Somang','Oscar'],null,readPhoneSelection(phoneSelectionKey(c),storage)),'Oscar');
 assert.equal(selectedPhoneOwner(reloaded,['Somang','Oscar'],'Somang',readPhoneSelection(key,storage)),'Somang');
 assert.equal(readPhoneSelection(phoneSelectionKey({...c,getCurrentChatId:()=> 'chat-b'}),storage),null);
 assert.equal(readPhoneSelection(phoneSelectionKey({...c,characters:[{avatar:'other.png'}]}),storage),null);
 assert.equal(readPhoneSelection(phoneSelectionKey({...c,groupId:'group'}),storage),null);
 assert.equal(pickSettings(m).lastPhoneOwner,'Oscar');
 const blocked={getItem(){throw Error('blocked')},setItem(){throw Error('blocked')}};
 rememberPhoneSelection(m,'Somang',key,blocked);assert.equal(m.lastPhoneOwner,'Somang');assert.equal(readPhoneSelection(key,blocked),null);
});
