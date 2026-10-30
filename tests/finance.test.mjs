import test from 'node:test';
import assert from 'node:assert/strict';
import { baseline, cash, transfer, addPrice, price, selectPrice, total, migrateBank, positions, reviseBaseline } from '../src/finance.js';
const make = () => { const m={}; baseline(m,'bank','EUR',1000,'2026-10-01','A'); baseline(m,'broker','EUR',100,'2026-10-01','A'); baseline(m,'broker','USD',500,'2026-10-01','A'); return m; };
test('legacy bank snapshot excludes credit and does not replay historical debits',()=>{
 const m={},p={owner:'A',now:'10-01',money:{currency:'EUR',bank:{accounts:[{id:'a',kind:'checking',last4:'1234',balance:1000},{id:'b',kind:'credit',balance:80}]},tx:[{id:'old',account:'1234',amount:-20}]}};
 migrateBank(m,p); migrateBank(m,p);
 assert.equal(cash(m.finance.accounts['a:EUR']),1000); assert.equal(p.money.bank.accounts[1].spent,80); assert.equal(Object.keys(m.finance.accounts).length,1);
 p.money.bank.accounts[0].balance=999999; migrateBank(m,p); assert.equal(p.money.bank.accounts[0].balance,1000);
});
test('independent currency baselines and idempotent cross currency transfer',()=>{
 const m=make(),t={id:'t1',from:'bank:EUR',to:'broker:USD',sent:100,received:110,fee:2,feeSide:'sender',feeCurrency:'EUR',rate:1.1,date:'2026-10-02'};
 transfer(m,t); transfer(m,t); assert.equal(cash(m.finance.accounts['bank:EUR']),898); assert.equal(cash(m.finance.accounts['broker:USD']),610); assert.equal(cash(m.finance.accounts['broker:EUR']),100);
 assert.throws(()=>transfer(m,{...t,sent:90})); assert.equal(cash(m.finance.accounts['bank:EUR']),898);
});
test('historical transfer already in snapshots is linked without double counting',()=>{
 const m=make(); transfer(m,{id:'old',from:'bank:EUR',to:'broker:EUR',sent:100,received:100,fee:0,date:'2026-10-01',includedFrom:true,includedTo:true}); assert.equal(cash(m.finance.accounts['bank:EUR']),1000); assert.equal(cash(m.finance.accounts['broker:EUR']),100);
});
test('baseline edit is explicit and preserves later entries',()=>{
 const m=make(); transfer(m,{id:'t',from:'bank:EUR',to:'broker:EUR',sent:100,received:100,fee:0,date:'2026-10-02'}); reviseBaseline(m,'bank:EUR',1200,'correct source'); assert.equal(cash(m.finance.accounts['bank:EUR']),1100); assert.equal(m.finance.revisions.length,1);
});
test('missing FX and unpriced assets are incomplete, never zero-valued assets',()=>{
 const m={}; const xs=[{currency:'EUR',amount:100},{currency:'USD',amount:100},{currency:'EUR',amount:null}];
 assert.deepEqual(total(m,xs,'EUR','2026-10-02'),{value:100,complete:false,missing:xs.slice(1)});
 addPrice(m,'FX:USD/EUR','2026-10-02',{value:0.9,source:'guess'}); assert.equal(total(m,xs,'EUR','2026-10-02').value,190); assert.equal(total(m,xs,'EUR','2026-10-03').value,100);
});
test('unordered story prices preserve selection and do not block valuation',()=>{
 const m={}; addPrice(m,'S','2026-10-02',{value:100,source:'guess'}); addPrice(m,'S','2026-10-02',{value:110,source:'story',ref:'a'}); const slot=addPrice(m,'S','2026-10-02',{value:120,time:'12:00',source:'story',ref:'b'});
 assert.equal(price(m,'S','2026-10-02').value,110); assert.equal(slot.conflict,true); selectPrice(m,'S','2026-10-02',slot.rows.at(-1).id); assert.equal(price(m,'S','2026-10-02').value,120); assert.equal(slot.conflict,false);
});
test('time-ordered quotes update, later arrival of older quote cannot replace latest',()=>{
 const m={}; for(const [time,value] of [['15:00',120],['09:00',100],['16:00',130]])addPrice(m,'S','2026-10-02',{time,value,source:'story'});
 assert.equal(price(m,'S','2026-10-02').value,130);
});
test('weighted average, partial sale, fees, dividends; reject oversell',()=>{
 const trades=[{kind:'buy',symbol:'S',currency:'USD',date:'2026-01-01',quantity:10,price:100,fee:10},{kind:'sell',symbol:'S',currency:'USD',date:'2026-01-02',quantity:4,price:120,fee:2},{kind:'dividend',symbol:'S',currency:'USD',date:'2026-01-03',amount:12}];
 const h=positions(trades)[0]; assert.equal(h.quantity,6);assert.equal(h.average,101);assert.equal(h.realized,74);assert.equal(h.dividends,12);
 assert.throws(()=>positions([...trades,{...trades[1],date:'2026-01-04',quantity:7}]));
});
test('invalid transfer makes no partial debit',()=>{
 const m=make(); assert.throws(()=>transfer(m,{id:'bad',from:'bank:EUR',to:'broker:USD',sent:2000,received:2200,rate:1.1,fee:0,date:'2026-10-02'}));assert.equal(cash(m.finance.accounts['bank:EUR']),1000);assert.equal(Object.keys(m.finance.transfers).length,0);
});
test('explicitly selected quote stays selected when another conflicting quote arrives',()=>{
 const m={}; const s=addPrice(m,'S','2026-10-30',{value:100,source:'story'});selectPrice(m,'S','2026-10-30',s.rows[0].id);addPrice(m,'S','2026-10-30',{value:120,time:'16:00',source:'story'});assert.equal(price(m,'S','2026-10-30').value,100);assert.equal(price(m,'S','2026-10-30').conflict,true);
});
test('FX uses a single shared pair, including inverse requests',()=>{
 const m={};addPrice(m,'FX:USD/EUR','2026-10-30',{value:0.8,source:'guess'});assert.equal(Object.keys(m.finance.prices)[0],'FX:EUR/USD');assert.equal(price(m,'FX:USD/EUR','2026-10-30').value,0.8);assert.equal(price(m,'FX:EUR/USD','2026-10-30').value,1.25);
});
