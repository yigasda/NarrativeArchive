import test from 'node:test';import assert from 'node:assert/strict';
import {sourceRows,captureSource,setBoundary,selectWindow,markRead,BASE_GROUPS,verifyBoundary} from '../src/phoneread.js';
const rows=()=>Array.from({length:51},(_,i)=>`[#${i}] Character: message ${i} `+'x'.repeat(600));
test('50 messages alternate directions and limit changes without gaps or truncation',async()=>{const all=await sourceRows(rows()),p={};setBoundary(p,{scope:'chat',index:0,hash:all[0].hash},BASE_GROUPS,'user');const seen=[];for(const [order,limit]of [['oldest',12],['newest',12],['oldest',20],['newest',12]]){Object.assign(p.readState,{order,limit});const w=selectWindow(p,'chat',all);assert.equal(w.text,w.rows.map(x=>x.text).join('\n\n'));seen.push(...w.rows.map(x=>x.index));markRead(p,w.rows);}assert.equal(new Set(seen).size,50);assert.equal(seen.length,50);assert.equal(selectWindow(p,'chat',all).rows.length,0);});
test('missing boundary requires one-time setup; changed anchor and different chat reject',async()=>{const all=await sourceRows(rows()),p={};assert.throws(()=>selectWindow(p,'a',all),/시작/);setBoundary(p,{scope:'a',index:3,hash:all[3].hash},BASE_GROUPS);assert.equal(verifyBoundary(p.readState,'a',all),true);assert.equal(verifyBoundary(p.readState,'b',all),false);all[3].hash='edited';assert.equal(verifyBoundary(p.readState,'a',all),false);});
test('captured boundary excludes messages arriving during generation',async()=>{const original=rows().slice(0,4);const captured=await captureSource('a',original);const p={};setBoundary(p,captured,BASE_GROUPS);const all=await sourceRows([...original,'[#4] new message']);assert.deepEqual(selectWindow(p,'a',all).rows.map(x=>x.index),[4]);});
test('regenerating one app resets only its own coverage',async()=>{const all=await sourceRows(rows()),p={money:{},investment:{}};setBoundary(p,{scope:'a',index:0,hash:all[0].hash},[...BASE_GROUPS,'money','invest']);markRead(p,all.slice(1,10));const old=structuredClone(p.readState.done.invest);setBoundary(p,{scope:'a',index:20,hash:all[20].hash},['money']);assert.deepEqual(p.readState.done.invest,old);assert.equal(p.readState.groups.invest.index,0);assert.equal(p.readState.groups.money.index,20);});

test('phone source excludes named system messages without changing other callers',async()=>{
 const {readFile}=await import('node:fs/promises');const source=await readFile(new URL('../src/drift.js',import.meta.url),'utf8');const fn=source.slice(source.indexOf('export function recentForCheck'),source.indexOf('// does a warning')).replace('export ','');
 const chat=[{name:'User',mes:'one',is_user:true},{name:'System',mes:'hidden',is_system:true},{name:'Character',mes:'two'}];
 const recent=new Function('ctx','offstageSet','cleanMessage',fn+';return recentForCheck')(()=>({chat}),()=>new Set(),x=>x);
 assert.equal(recent(12,{excludeSystem:true}).length,2);assert.equal(recent(12).length,3);
});
test('reconnecting a source retains the original boundary and processed hashes',async()=>{
 const {reconnectState}=await import('../src/phoneread.js');const p={readState:{scope:'old',groups:{msg:{index:2,hash:'a'}},done:{msg:{3:'b'}},archiveDone:{archive:'hash'},order:'newest',limit:20}};const old=structuredClone(p.readState);
 reconnectState(p,'new');assert.deepEqual(p.readHistory[0].state,old);assert.equal(p.readState.scope,'new');assert.deepEqual(p.readState.done,{});assert.equal(p.readState.limit,20);
});
