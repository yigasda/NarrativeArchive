import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const source=await readFile(new URL('../src/phone.js',import.meta.url),'utf8');
const chunk=source.slice(source.indexOf("    $root.on('click', '.na_ph_setremake'"),source.indexOf("    $root.on('click', '.na_ph_setdel'"));
function harness({busy=false,confirm=async()=>true,fill=async()=>{},both=false}={}) {
 const notices=[],p={owner:'A'},remake=new Set(both?['money','invest']:['money']);let handler,draws=0,calls=0,plans=0;const received=[];
 const init=new Function('$root','toastr','confirm','fillMoney','drawPhone','draw','remake','p','prepareWealth','fillInvestment',`
 let making=false,investing=${busy},owner='A',phoneClosed=false,view='setremake';
 const phone=()=>p,m={},REMAKE={},REMAKE_MORE=['money','invest'],APPS={money:'은행'},investmentDate=()=>'',validDate=()=>true;
 ${chunk}
 return ()=>making;
 `);
 const locked=init({find:()=>({val:()=> '2026-10-30'}),on:(event,selector,fn)=>handler=fn},{info:t=>notices.push(t),error:t=>notices.push(t),success:t=>notices.push(t)},confirm,async(m,p,options)=>{calls++;received.push(options.wealthPlan);await fill();},()=>draws++,()=>draws++,remake,p,async()=>{plans++;return {token:'shared'}},async(m,p,date,options)=>received.push(options.wealthPlan));
 return {click:()=>handler({stopPropagation(){}}),locked,notices,get calls(){return calls},get draws(){return draws},get plans(){return plans},received};
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

test('bank and investment rebuild share exactly one refreshed wealth plan',async()=>{
 const h=harness({both:true});await h.click();assert.equal(h.plans,1);assert.equal(h.received.length,2);assert.equal(h.received[0],h.received[1]);
});
