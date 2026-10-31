import test from 'node:test';import assert from 'node:assert/strict';
import {archiveWindow,decisionEvidence} from '../src/phoneevidence.js';
test('archive fully inside selection is evidence; earlier is background; overlapping/future excluded',()=>{
 const all=Array.from({length:20},(_,index)=>({index})),s=[{id:'old',first:0,last:2},{id:'yes',first:3,last:5},{id:'over',first:4,last:8},{id:'future',first:10,last:12}];
 const w=archiveWindow(s,all.slice(3,6),all);assert.deepEqual(w.background.map(x=>x.id),['old']);assert.deepEqual(w.evidence.map(x=>x.id),['yes']);assert.equal(archiveWindow(s,[all[3],all[5]],all).evidence.length,0);
});
test('archive quote can substantiate event absent from exact raw wording',()=>{
 const context={rows:[{index:3,text:'The transfer was completed.',hash:'raw'}],archive:[{id:'s',first:3,last:3,text:'Oscar transferred EUR 100.',hash:'archive'}]};
 assert.equal(decisionEvidence({sourceType:'archive',sourceId:'s',sourceIndex:3,refs:['Oscar transferred EUR 100.']},context,[3]).hash,'archive');
 assert.throws(()=>decisionEvidence({sourceIndex:3,refs:['Oscar transferred EUR 100.']},context,[3]));
});
test('long section is deferred until all constituent messages have been covered',()=>{
 const rows=Array.from({length:20},(_,i)=>({index:i+1})),sections=[{id:'s',first:1,last:20,hash:'h'}];
 assert.equal(archiveWindow(sections,rows.slice(0,12),rows).evidence.length,0);
 const ready=archiveWindow(sections,rows.slice(12),rows,{covered:rows.slice(0,12).map(x=>x.index)});assert.equal(ready.evidence.length,1);
 assert.equal(archiveWindow(sections,[],rows,{covered:rows.map(x=>x.index),done:{s:'h'}}).evidence.length,0);
 assert.equal(archiveWindow(sections,rows.slice(12),rows).evidence.length,0);
 assert.equal(archiveWindow(sections,[],rows).background.length,0);
});
test('boundary-spanning archive waits for eligible suffix and excludes pre-boundary event indices',()=>{
 const rows=Array.from({length:10},(_,index)=>({index})),section={id:'span',first:1,last:9,text:'old payment; new purchase',hash:'x'};
 assert.equal(archiveWindow([section],rows.slice(6,8),rows,{after:5}).evidence.length,0);
 const evidence=archiveWindow([section],rows.slice(8),rows,{after:5,covered:[6,7]}).evidence;
 assert.deepEqual(evidence[0].eligibleIndices,[6,7,8,9]);
 const context={archive:evidence};
 assert.throws(()=>decisionEvidence({sourceType:'archive',sourceId:'span',sourceIndex:3,refs:['old payment']},context,[3,6,7,8,9]));
 assert.equal(decisionEvidence({sourceType:'archive',sourceId:'span',sourceIndex:8,refs:['new purchase']},context,[6,7,8,9]).hash,'x');
});
import {inputLimitError} from '../src/phoneevidence.js';
test('context length failures get actionable short guidance, network errors do not',()=>{
 for(const s of ['maximum context length exceeded','context_length_exceeded','input is too long','too many input tokens'])assert.equal(inputLimitError(Error(s)).code,'PHONE_INPUT_LIMIT');
 const network=Error('503 network unavailable');assert.equal(inputLimitError(network),network);
});
test('archive may end at a system message without counting it or accepting a future range',()=>{const rows=[{index:1},{index:2}],s=[{id:'now',first:1,last:3,hash:'a'},{id:'future',first:1,last:4,hash:'b'}];const w=archiveWindow(s,rows,rows,{lastChatIndex:3});assert.deepEqual(w.evidence.map(x=>x.id),['now']);assert.deepEqual(w.evidence[0].eligibleIndices,[1,2]);});
