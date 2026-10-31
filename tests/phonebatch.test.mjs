import test from 'node:test';import assert from 'node:assert/strict';
import {prepareUpdate,applyBatch} from '../src/phoneupdate.js';import {setBoundary,BASE_GROUPS} from '../src/phoneread.js';import {baseline,cash,positions} from '../src/finance.js';
const parse=JSON.parse,merge=(p,x)=>{p.notes.push(...x.notes||[])};
function setup(){let m={phones:{a:{owner:'A',notes:[],voice:[{text:'KEEP'}],money:{currency:'EUR',bank:{accounts:[{id:'bank',last4:'1111',currency:'EUR',kind:'checking',balance:1000}]},tx:[],orders:[],passes:[]}}}};m=prepareUpdate(m);baseline(m,'broker','EUR',1000,'2026-10-30','A');m.phones.a.investment={base:'EUR',date:'2026-10-30',accounts:[{key:'broker:EUR',currency:'EUR'}],trades:[],securities:[],watch:[],stakes:[]};setBoundary(m.phones.a,{scope:'a',index:0,hash:'x'},[...BASE_GROUPS,'money','invest','voice'],'user');return m;}
const event=(index,other={})=>({sourceIndex:index,date:'2026-10-30',kind:'payment',amountSource:'generated',generatedFields:['cash[0].amount'],reason:'Confirmed payment, estimated from scene',refs:['A paid for dinner without a stated price.'],cash:[{owner:'A',account:'bank:EUR',currency:'EUR',amount:-50}],...other});
const apply=(m,events,source=events.flatMap(e=>e.refs).join('\n'))=>applyBatch(m,'A',{events},source,parse,merge,events.map(e=>e.sourceIndex));
test('generated amount and provenance persist; recalled known id does not recharge',async()=>{const m=setup(),e=event(1);await apply(m,[e]);const [id,record]=Object.entries(m.finance.storyEvents)[0];assert.equal(record.decision.amountSource,'generated');assert.equal(record.effects.cash[0].amount,-50);await apply(m,[event(2,{id,cash:[],refs:['A recalled paying for that same dinner.']})]);assert.equal(cash(m.finance.accounts['bank:EUR']),950);assert.equal(m.phones.a.voice[0].text,'KEEP');});
test('boundary #120 bank / #130 investment: #125 transfer only debits bank',async()=>{const m=setup();setBoundary(m.phones.a,{scope:'a',index:120,hash:'a'},['money']);setBoundary(m.phones.a,{scope:'a',index:130,hash:'b'},['invest']);const e=event(125,{kind:'transfer',cash:[{owner:'A',account:'bank:EUR',currency:'EUR',amount:-100},{owner:'A',account:'broker:EUR',currency:'EUR',amount:100,inclusion:'existing',reason:'Existing brokerage opening record represents this deposit'}],refs:['A moved EUR 100 to the brokerage account.']});await apply(m,[e]);assert.equal(cash(m.finance.accounts['bank:EUR']),900);assert.equal(cash(m.finance.accounts['broker:EUR']),1000);assert.deepEqual(Object.values(m.finance.storyEvents)[0].applications.map(x=>x.mode),['applied','included']);});
test('invalid event leaves all its effects untouched, independent event applies',async()=>{const m=setup();const bad=event(1,{kind:'transfer',cash:[{owner:'A',account:'bank:EUR',currency:'EUR',amount:-200},{owner:'A',account:'missing:EUR',currency:'EUR',amount:200}]});const good=event(2,{refs:['A separately paid for dinner yesterday.']});const r=await apply(m,[bad,good]);assert.equal(r.count,1);assert.equal(r.failures.length,1);assert.equal(cash(m.finance.accounts['bank:EUR']),950);assert.equal(m.phones.a.money.tx.length,1);assert.equal(Object.values(m.finance.updatePending)[0].e.cash[0].amount,-200);});
test('latest sell pending then earlier buy reconciles chronologically with fixed amounts',async()=>{const m=setup();const sell=event(3,{kind:'trade',cash:[],refs:['A sold one LAB share for EUR 20.'],trades:[{account:'broker:EUR',kind:'sell',symbol:'X:LAB',currency:'EUR',name:'LAB',quantity:1,price:20,fee:0}]});let r=await apply(m,[sell]);assert.equal(r.failures.length,1);assert.equal(cash(m.finance.accounts['broker:EUR']),1000);const buy=event(2,{kind:'trade',cash:[],refs:['A bought two LAB shares for EUR 10 each.'],trades:[{account:'broker:EUR',kind:'buy',symbol:'X:LAB',currency:'EUR',name:'LAB',quantity:2,price:10,fee:0}]});r=await apply(m,[buy]);assert.equal(r.failures.length,0);assert.equal(positions(m.phones.a.investment.trades)[0].quantity,1);assert.equal(positions(m.phones.a.investment.trades)[0].realized,10);assert.equal(cash(m.finance.accounts['broker:EUR']),1000);});
test('older order event cannot revert delivered state',async()=>{const m=setup();m.phones.a.money.orders=[{id:'order',shop:'LAB',item:'Shoes',price:50,qty:1,status:'ordered'}];await apply(m,[event(9,{kind:'order',cash:[],refs:['The shoes were delivered to A today.'],orders:[{id:'order',status:'delivered'}]})]);await apply(m,[event(3,{kind:'order',cash:[],refs:['The shoes had been ordered earlier today.'],orders:[{id:'order',status:'ordered'}]})]);assert.equal(m.phones.a.money.orders[0].status,'delivered');});

test('boundary alone never proves a financial event included',async()=>{const m=setup();setBoundary(m.phones.a,{scope:'a',index:130,hash:'a'},['money']);await apply(m,[event(125,{cash:[{owner:'A',account:'bank:EUR',currency:'EUR',amount:-50,inclusion:'new',reason:'Existing records omit this payment'}]})]);assert.equal(cash(m.finance.accounts['bank:EUR']),950);assert.equal(Object.values(m.finance.storyEvents)[0].applications[0].mode,'applied');});

test('failed decisions keep their source hash and cannot replay after edits or chat changes',async()=>{
 const m=setup(),e=event(1,{cash:[{owner:'A',account:'bank:EUR',currency:'EUR',amount:-2000}]});
 const context={scope:'chat-a',rows:[{index:1,hash:'original'}]};
 let r=await applyBatch(m,'A',{events:[e]},e.refs[0],parse,merge,[1],context);
 assert.equal(r.failures.length,1);assert.equal(Object.values(m.finance.updatePending)[0].sourceHash,'original');

 for(const next of [{scope:'chat-b',rows:context.rows},{scope:'chat-a',rows:[{index:1,hash:'edited'}]}]){
  r=await applyBatch(m,'A',{events:[]},'',parse,merge,[],next);
  assert.match(r.failures[0].error,/본문/);assert.equal(m.phones.a.money.tx.length,0);
 }
});
test('separate same-day purchases with identical words both apply',async()=>{const m=setup();await apply(m,[event(1)]);await apply(m,[event(2)]);assert.equal(cash(m.finance.accounts['bank:EUR']),900);});
test('legacy delivered order cannot regress to ordered',async()=>{const m=setup();m.phones.a.money.orders=[{id:'legacy',status:'delivered',shop:'Shop',item:'Shoes',qty:1,price:50}];await apply(m,[event(1,{kind:'order',cash:[],orders:[{id:'legacy',status:'ordered'}]})]);assert.equal(m.phones.a.money.orders[0].status,'delivered');});
test('unpaid flag survives storage and return status is supported',async()=>{const m=setup();await apply(m,[event(1,{kind:'order',cash:[],orders:[{shop:'Shop',item:'Shoes',qty:1,price:50,paid:false,status:'ordered'}]})]);const order=m.phones.a.money.orders[0];assert.equal(order.paid,false);const r=await apply(m,[event(2,{kind:'order',cash:[],orders:[{id:order.id,status:'returned'}],refs:['A returned the shoes without a refund yet.']})]);assert.equal(r.failures.length,0);assert.equal(m.phones.a.money.orders[0].status,'returned');assert.equal(cash(m.finance.accounts['bank:EUR']),1000);});
test('model unresolved is retained for later automatic review',async()=>{const m=setup();const r=await applyBatch(m,'A',{events:[],unresolved:['Account uncertain for confirmed payment']},'A paid for dinner.',parse,merge,[1]);assert.equal(r.failures.length,1);assert.equal(Object.keys(m.finance.updatePending).length,1);});
test('known event can complete an unrecorded account leg without repeating applied debit',async()=>{
 const m=setup();await apply(m,[event(1,{kind:'transfer',cash:[{owner:'A',account:'bank:EUR',currency:'EUR',amount:-100}]})]);
 const id=Object.keys(m.finance.storyEvents)[0];const e=event(2,{id,kind:'transfer',cash:[{owner:'A',account:'bank:EUR',currency:'EUR',amount:-100},{owner:'A',account:'broker:EUR',currency:'EUR',amount:100}]});
 const r=await apply(m,[e]);assert.equal(r.failures.length,0);assert.equal(cash(m.finance.accounts['bank:EUR']),900);assert.equal(cash(m.finance.accounts['broker:EUR']),1100);
 await apply(m,[e]);assert.equal(cash(m.finance.accounts['broker:EUR']),1100);
});
test('regenerated baseline requires review and review preserves original amount',async()=>{
 const m=setup(),e=event(1,{cash:[{owner:'A',account:'missing:EUR',currency:'EUR',amount:-50}]});
 const context={scope:'a',rows:[{index:1,hash:'a',text:e.refs[0]}]};await applyBatch(m,'A',{events:[e]},e.refs[0],parse,merge,[1],context);
 const key=Object.keys(m.finance.updatePending)[0];m.phones.a.money.at=123;
 let r=await applyBatch(m,'A',{events:[]},'',parse,merge,[],context);assert.match(r.failures[0].error,/다시 생성/);
 let reviewed={...e,cash:[{owner:'A',account:'bank:EUR',currency:'EUR',amount:-70,inclusion:'new'}]};
 r=await applyBatch(m,'A',{events:[],reviews:[{key,events:[reviewed]}]},'',parse,merge,[],context);assert.equal(cash(m.finance.accounts['bank:EUR']),1000);
 reviewed.cash[0].amount=-50;r=await applyBatch(m,'A',{events:[],reviews:[{key,events:[reviewed]}]},'',parse,merge,[],context);
 assert.equal(r.failures.length,0);assert.equal(cash(m.finance.accounts['bank:EUR']),950);assert.equal(Object.keys(m.finance.updatePending).length,0);
});
test('unresolved review resolves with fixed source and records original issue',async()=>{
 const m=setup(),e=event(1),context={scope:'a',rows:[{index:1,hash:'a',text:e.refs[0]}]};
 await applyBatch(m,'A',{events:[],unresolved:['which account?']},e.refs[0],parse,merge,[1],context);const key=Object.keys(m.finance.updatePending)[0];
 const r=await applyBatch(m,'A',{events:[],reviews:[{key,events:[e]}]},'',parse,merge,[],context);
 assert.equal(r.failures.length,0);assert.equal(cash(m.finance.accounts['bank:EUR']),950);assert.equal(m.finance.reviewDecisions[key].issue,'which account?');
});
test('newest-first mixed trades on existing holdings match chronological cost, profit and cash',async()=>{
 const make=()=>{const m=setup();m.phones.a.investment.securities=[{symbol:'X:LAB',name:'LAB',currency:'EUR'}];m.phones.a.investment.trades=[{id:'opening',date:'2026-10-01',kind:'buy',symbol:'X:LAB',currency:'EUR',quantity:10,price:10,fee:0}];return m;};
 const trade=(i,time,t)=>event(i,{kind:'trade',time,cash:[],refs:['A executed transaction number '+i+'.'],trades:[{account:'broker:EUR',symbol:'X:LAB',currency:'EUR',fee:0,...t}]});
 const events=[trade(2,'10:00',{kind:'buy',quantity:4,price:20}),trade(3,'11:00',{kind:'sell',quantity:6,price:30}),trade(4,'12:00',{kind:'dividend',amount:12}),event(5,{kind:'transfer',time:'13:00',refs:['A transferred EUR 100 to the broker.'],cash:[{owner:'A',account:'bank:EUR',currency:'EUR',amount:-100},{owner:'A',account:'broker:EUR',currency:'EUR',amount:100}]})];
 const oldest=make(),newest=make();await apply(oldest,events);for(const e of [...events].reverse()){const r=await apply(newest,[e]);assert.equal(r.failures.length,0);}
 assert.deepEqual(positions(newest.phones.a.investment.trades),positions(oldest.phones.a.investment.trades));assert.equal(cash(newest.finance.accounts['broker:EUR']),1212);assert.equal(cash(newest.finance.accounts['bank:EUR']),900);
});
test('result includes investment cash and quantity plus card usage deltas',async()=>{
 const m=setup(),e=event(1,{kind:'trade',cash:[],trades:[{account:'broker:EUR',symbol:'X:LAB',name:'LAB',currency:'EUR',kind:'buy',quantity:2,price:10,fee:0}]});
 const r=await apply(m,[e]);assert.ok(r.changes.some(x=>x.kind==='cash'&&x.amount===-20));assert.ok(r.changes.some(x=>x.kind==='holding'&&x.before===0&&x.after===2));
});
test('mixed newest-first portfolio also respects different bank and investment creation states',async()=>{
 const m=setup();setBoundary(m.phones.a,{scope:'a',index:0,hash:'bank'},['money']);setBoundary(m.phones.a,{scope:'a',index:3,hash:'invest'},['invest']);
 m.phones.a.investment.securities=[{symbol:'X:LAB',name:'LAB',currency:'EUR'}];m.phones.a.investment.trades=[{date:'2026-10-01',kind:'buy',symbol:'X:LAB',currency:'EUR',quantity:10,price:10,fee:0}];
 const sell=event(5,{kind:'trade',cash:[],refs:['Sold six existing shares for EUR 30 each.'],trades:[{account:'broker:EUR',symbol:'X:LAB',currency:'EUR',kind:'sell',quantity:6,price:30,fee:0}]});
 const buy=event(4,{kind:'trade',cash:[],refs:['Bought four shares for EUR 20 each.'],trades:[{account:'broker:EUR',symbol:'X:LAB',currency:'EUR',kind:'buy',quantity:4,price:20,fee:0}]});
 const transfer=event(2,{kind:'transfer',refs:['Moved EUR 100, already included in brokerage opening cash.'],cash:[{owner:'A',account:'bank:EUR',currency:'EUR',amount:-100,inclusion:'new'},{owner:'A',account:'broker:EUR',currency:'EUR',amount:100,inclusion:'existing',reason:'Opening cash evidence'}]});
 for(const e of [sell,buy,transfer])assert.equal((await apply(m,[e])).failures.length,0);
 const h=positions(m.phones.a.investment.trades)[0];assert.equal(h.quantity,8);assert.ok(Math.abs(h.average-180/14)<1e-9);assert.ok(Math.abs(h.realized-(180-6*180/14))<1e-9);assert.equal(cash(m.finance.accounts['broker:EUR']),1100);assert.equal(cash(m.finance.accounts['bank:EUR']),900);
});

test('completing only the missing transfer leg still validates against the saved debit',async()=>{
 const m=setup();await apply(m,[event(1,{kind:'transfer',cash:[{owner:'A',account:'bank:EUR',currency:'EUR',amount:-100}]})]);const id=Object.keys(m.finance.storyEvents)[0];
 const r=await apply(m,[event(2,{id,kind:'transfer',cash:[{owner:'A',account:'broker:EUR',currency:'EUR',amount:200}]})]);assert.equal(r.failures.length,1);assert.equal(cash(m.finance.accounts['broker:EUR']),1000);
});
test('two fills of the same symbol retain distinct cash effects and replay safely',async()=>{const m=setup(),t={account:'broker:EUR',symbol:'X:LAB',currency:'EUR',name:'LAB',kind:'buy',quantity:1,price:10,fee:0},e=event(1,{kind:'trade',cash:[],trades:[t,{...t,price:20}]});await apply(m,[e]);assert.equal(cash(m.finance.accounts['broker:EUR']),970);assert.equal(positions(m.phones.a.investment.trades)[0].quantity,2);assert.equal(new Set(m.phones.a.investment.trades.map(t=>t.id)).size,2);const id=Object.keys(m.finance.storyEvents)[0];await apply(m,[{...e,id}]);assert.equal(cash(m.finance.accounts['broker:EUR']),970);});
test('recall with an empty phone object cannot erase recorded financial effects',async()=>{const m=setup(),e=event(1);await apply(m,[e]);const id=Object.keys(m.finance.storyEvents)[0],old=structuredClone(m.finance.storyEvents[id]);await apply(m,[event(2,{id,occurrence:'recalled',match:'existing',cash:[],phone:{}})]);assert.deepEqual(m.finance.storyEvents[id].effects,old.effects);assert.deepEqual(m.finance.storyEvents[id].applications,old.applications);});
test('orders consume a payment once and a basket can share a payment',async()=>{const m=setup();const order=price=>({shop:'Shop',item:'Item '+price,qty:1,price,paid:true,status:'ordered'});let r=await apply(m,[event(1,{cash:[{owner:'A',account:'bank:EUR',currency:'EUR',amount:-100}],orders:[order(100),order(100)]})]);assert.equal(r.failures.length,1);assert.equal(cash(m.finance.accounts['bank:EUR']),1000);const n=setup();r=await apply(n,[event(1,{cash:[{owner:'A',account:'bank:EUR',currency:'EUR',amount:-100}],orders:[order(40),order(60)]})]);assert.equal(r.failures.length,0);assert.equal(n.phones.a.money.orders.length,2);assert.equal(cash(n.finance.accounts['bank:EUR']),900);});
test('invalid review does not block an independent valid event',async()=>{const m=setup();await applyBatch(m,'A',{events:[],unresolved:['Uncertain']},'source',parse,merge,[1]);const key=Object.keys(m.finance.updatePending)[0],e=event(2);const r=await applyBatch(m,'A',{events:[e],reviews:[{key,events:[{sourceIndex:1}]}]},e.refs[0],parse,merge,[2]);assert.equal(cash(m.finance.accounts['bank:EUR']),950);assert.ok(r.failures.length);assert.ok(m.finance.updatePending[key]);});
