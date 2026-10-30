import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const source=await readFile(new URL('../src/phone.js',import.meta.url),'utf8');
const chunk=source.slice(source.indexOf("    $root.on('click', '.na_ph_setremake'"),source.indexOf("    $root.on('click', '.na_ph_setdel'"));
function harness({busy=false,confirm=async()=>true,fill=async()=>{}}={}) {
 const notices=[],p={owner:'A'},remake=new Set(['money']);let handler,draws=0,calls=0;
 const init=new Function('$root','toastr','confirm','fillMoney','drawPhone','draw','remake','p',`
 let making=false,investing=${busy},owner='A',phoneClosed=false,view='setremake';
 const phone=()=>p,m={},REMAKE={},REMAKE_MORE=['money'],APPS={money:'은행'},investmentDate=()=>'',validDate=()=>true;
 ${chunk}
 return ()=>making;
 `);
 const locked=init({on:(event,selector,fn)=>handler=fn},{info:t=>notices.push(t),error:t=>notices.push(t),success:t=>notices.push(t)},confirm,async()=>{calls++;await fill();},()=>draws++,()=>draws++,remake,p);
 return {click:()=>handler({stopPropagation(){}}),locked,notices,get calls(){return calls},get draws(){return draws}};
}
test('busy investment work reports why regeneration cannot start',async()=>{
 const h=harness({busy:true});await h.click();assert.equal(h.calls,0);assert.match(h.notices[0],/시세·환율/);assert.equal(h.locked(),false);
});
test('confirmation prevents duplicate starts and cancellation releases the lock',async()=>{
 let resolve;const h=harness({confirm:()=>new Promise(r=>resolve=r)});
 const first=h.click();assert.equal(h.locked(),true);await h.click();assert.equal(h.calls,0);
 resolve(false);await first;assert.equal(h.locked(),false);assert.equal(h.calls,0);
});
test('generation errors are visible and retry is available',async()=>{
 let fail=true;const h=harness({fill:async()=>{if(fail)throw Error('model failed')}});
 await h.click();assert.equal(h.locked(),false);assert.match(h.notices.at(-1),/model failed/);
 fail=false;await h.click();assert.equal(h.calls,2);assert.equal(h.locked(),false);assert.match(h.notices.at(-1),/다시 만들었어요/);
});
