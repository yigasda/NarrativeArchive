import test from 'node:test';
import assert from 'node:assert/strict';
import {appendDraftKey,appendDraftStore} from '../src/appenddraft.js';
const context=chat=>({characterId:0,characters:[{avatar:'a.png'}],getCurrentChatId:()=>chat});
const memory=()=>{const m=new Map();return {getItem:k=>m.get(k)||null,setItem:(k,v)=>m.set(k,v),removeItem:k=>m.delete(k)}};
test('every completed revision is durable and reopening the original prefill restores the latest result',()=>{
 const storage=memory(),c=context('A'),session=appendDraftStore(c,'first',storage);
 session.save({text:'revision one',original:'first',steps:['first'],asked:['fix 1'],end:'20'});
 assert.equal(appendDraftStore(c,'first',storage).saved.text,'revision one');
 session.save({text:'revision two',original:'first',steps:['first','revision one'],asked:['fix 1','fix 2'],end:'20'});
 const recovered=appendDraftStore(c,undefined,storage).saved;assert.equal(recovered.text,'revision two');assert.deepEqual(recovered.steps,['first','revision one']);assert.equal(recovered.end,'20');
});
test('separate chats and incoming drafts never replace each other; successful commit clears only its draft',()=>{
 const storage=memory(),c=context('A'),one=appendDraftStore(c,'one',storage);one.save({text:'one edited'});
 const two=appendDraftStore(c,'two',storage);two.save({text:'two edited'});two.clear();
 assert.equal(appendDraftStore(c,undefined,storage).saved.text,'one edited');assert.equal(appendDraftStore(context('B'),undefined,storage).saved,undefined);
 assert.notEqual(appendDraftKey(c),appendDraftKey({...c,characters:[{avatar:'b.png'}]}));
});
test('quota fallback keeps latest text and metadata even when undo history is too large',()=>{
 const underlying=memory(),storage={...underlying,setItem:(k,v)=>{if(JSON.parse(v).some(r=>r.steps.length))throw Error('quota');underlying.setItem(k,v)}};
 const c=context('A'),s=appendDraftStore(c,'original',storage);s.save({text:'latest',steps:['large old draft'],end:'22'});
 const r=appendDraftStore(c,undefined,storage).saved;assert.equal(r.text,'latest');assert.equal(r.end,'22');assert.deepEqual(r.steps,[]);
});
test('older open windows cannot overwrite or clear a more recent saved revision',()=>{
 const storage=memory(),c=context('A'),first=appendDraftStore(c,'seed',storage);first.save({text:'first'});
 const second=appendDraftStore(c,'seed',storage);second.save({text:'newer'});
 assert.throws(()=>first.save({text:'stale'}),/다른 창/);first.clear();assert.equal(appendDraftStore(c,undefined,storage).saved.text,'newer');
});
test('blocked persistence reports failure rather than claiming a save',()=>{
 const storage={getItem:()=>null,setItem:()=>{throw Error('blocked')},removeItem(){}};
 assert.throws(()=>appendDraftStore(context('A'),'seed',storage).save({text:'latest'}),/blocked/);
});
