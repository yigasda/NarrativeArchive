import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import * as finance from '../src/finance.js';
const encoded = s => 'data:text/javascript;base64,'+Buffer.from(s).toString('base64');
const core = encoded(`export const saveMeta=async()=>{globalThis.__investTest.saved++}; export const getMeta=()=>globalThis.__investTest.meta;`);
const ai = encoded(`export const askDraft=async(input, options)=>{globalThis.__investTest.inputs.push({input,...options}); if(globalThis.__investTest.error)throw Error('network'); return JSON.stringify(globalThis.__investTest.answer)};`);
const data = encoded(`export const sideRequest=async(m,owner,blocks)=>m.text+'\\n'+blocks.join('\\n'); export const storyNow=p=>p.now||''; export const fmtDate=(p,v)=>v; export const fmtTime=(p,v)=>v; export const koOn=()=>true; export const listTime=(p,v)=>v;`);
const apps = encoded(`export const AX={}; export const ax=()=>''; export const axBar=()=>'';export const axCb=()=>'';export const axH1=t=>'<h1>'+t+'</h1>';export const axInd=()=>'';export const axTop=()=>'';export const axDay=(p,n,d)=>d;export const axFind=()=>'';export const axKp=()=>'';export const axLetter=()=>'';export const axTint=()=> '#ffffff';export const busyHtml='';`);
const util=encoded(`export const esc=s=>String(s??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');`);
const financeURL=pathToFileURL(new URL('../src/finance.js',import.meta.url).pathname).href;
async function load(file, map) { const src=await readFile(new URL('../src/'+file,import.meta.url),'utf8');return import(encoded(src.replace(/from '([^']+)'/g,(all,k)=>`from '${map[k]||k}'`))); }
const dataMod=await load('investdata.js',{'./ai.js':ai,'./core.js':core,'./phonedata.js':data,'./finance.js':financeURL});
const dataURL=encoded(`export const investmentDate=(m,p)=>p.investment?.date||'2026-10-30';`);
const fmtIn=encoded(`export const fmtIn=(p,n,c,signed)=>(signed&&n>0?'+':'')+new Intl.NumberFormat('ko-KR',{maximumFractionDigits:2}).format(n)+' '+(c||'');`);
const ui=await load('investui.js',{'./phoneapps.js':apps,'./util.js':util,'./finance.js':financeURL,'./investdata.js':dataURL,'./phonemoney.js':fmtIn});
const moneyUI=await load('phonemoney.js',{'./core.js':core,'./finance.js':financeURL,'./investdata.js':dataURL,'./people.js':encoded(`export const nameKey=s=>s;`),'./phoneai.js':encoded(`export const filling=new Set(),recording=new Set();`),'./phoneapps.js':apps,'./phonedata.js':data,'./util.js':util});
function setup() {
 const m={text:'October 30, 2026. Public company X trades at 110 USD.'},p={owner:'A',now:'10-30',country:'US',searches:[],threads:[],photos:[],events:[]};
 globalThis.__investTest={saved:0,inputs:[],meta:m,answer:{base:'EUR',basis:'fiction',cash:[{currency:'USD',amount:2000}],securities:[{symbol:'NYSE:X',name:'X',currency:'USD'}],trades:[{kind:'buy',symbol:'NYSE:X',currency:'USD',date:'2026-10-29',quantity:10,price:100,fee:0}],watch:[{symbol:'NYSE:X',note:'long hold'}],stakes:[],quotes:[{symbol:'NYSE:X',date:'2026-10-30',value:110,source:'story',evidence:'Public company X trades at 110 USD.'}],fx:[{from:'USD',to:'EUR',date:'2026-10-29',value:0.9},{from:'USD',to:'EUR',date:'2026-10-30',value:0.95}]}};
 return {m,p};
}
test('generation computes cash, freezes acquisition FX, and renders every investment view',async()=>{
 const {m,p}=setup();await dataMod.fillInvestment(m,p,'2026-10-30');assert.equal(finance.cash(m.finance.accounts[p.investment.accounts[0].key]),1000);assert.equal(p.investment.trades[0].rateAtTrade,0.9);
 for(const view of ['invest','stock','ivactivity','ivwatch','ivstakes','ivcash','ivprices']) {const html=ui.investmentScreen(m,p,'10-30',view,view==='stock'?'NYSE:X':'',false);assert.ok(html.length>100);assert.ok(!html.includes('NaN'));}
 const detail=ui.investmentScreen(m,p,'10-30','stock','NYSE:X',false);assert.match(detail,/145 EUR/);assert.match(detail,/95 EUR/);assert.match(detail,/50 EUR/);
 const home=ui.investmentScreen(m,p,'10-30','invest','',false);assert.match(home,/1,995 EUR/);
});
test('failed overselling generation does not install a partial portfolio',async()=>{
 const {m,p}=setup();globalThis.__investTest.answer.trades.push({kind:'sell',symbol:'NYSE:X',currency:'USD',date:'2026-10-30',quantity:20,price:120,fee:0});
 await assert.rejects(dataMod.fillInvestment(m,p,'2026-10-30'));assert.equal(p.investment,undefined);assert.equal(Object.keys(m.finance?.accounts||{}).length,0);
});
test('same-day refresh reuses cache, explicit source correction preserves historical FX',async()=>{
 const {m,p}=setup();await dataMod.fillInvestment(m,p,'2026-10-30');await dataMod.refreshMarket(m,p,'2026-10-30');assert.equal(globalThis.__investTest.inputs.length,1);
 globalThis.__investTest.answer={quotes:[{symbol:'NYSE:X',date:'2026-10-30',value:130,source:'story',evidence:'not in source'}],fx:[]};await dataMod.refreshMarket(m,p,'2026-10-30',true);assert.equal(finance.price(m,'STOCK:NYSE:X','2026-10-30').value,110);assert.equal(p.investment.trades[0].rateAtTrade,0.9);
 await assert.rejects(dataMod.refreshMarket(m,p,'2026-10-28'));
});
test('missing FX produces partial subtotal, and conflict can stay unresolved during navigation',async()=>{
 const {m,p}=setup();await dataMod.fillInvestment(m,p,'2026-10-30');delete m.finance.prices['FX:EUR/USD'];
 finance.addPrice(m,'STOCK:NYSE:X','2026-10-30',{value:120,source:'story',time:'12:00',ref:'another'});
 const home=ui.investmentScreen(m,p,'10-30','invest','',false);assert.match(home,/환산 가능한 소계/);assert.match(home,/환산 대기/);assert.ok(!home.includes('총 투자자산'));
 const detail=ui.investmentScreen(m,p,'10-30','stock','NYSE:X',false);assert.match(detail,/나중에 확인 가능/);assert.equal(finance.price(m,'STOCK:NYSE:X','2026-10-30').value,110);
});
test('legacy credit renders without regeneration and stays out of bank deposits',()=>{
 const {m,p}=setup();p.money={currency:'EUR',bank:{name:'Bank',accounts:[{id:'a',kind:'checking',last4:'1234',balance:100},{id:'b',kind:'credit',last4:'5678',balance:70},{id:'c',kind:'savings',last4:'9999',balance:100,currency:'USD'}]},tx:[],orders:[],passes:[],cards:[]};
 const html=moneyUI.bankHome(p,'10-30');assert.match(html,/환산 가능한 소계/);assert.match(html,/이번 달 사용/);assert.equal(p.money.bank.accounts[1].spent,70);assert.ok(!html.includes('€270'));assert.equal(globalThis.__investTest.inputs.length,0);
});

// Optional local browser inspection fixture. Never a user's saved archive.
if (process.env.INVEST_PREVIEW) {
 const {writeFile}=await import('node:fs/promises'); const {m,p}=setup(); await dataMod.fillInvestment(m,p,'2026-10-30');
 p.investment.stakes=[{id:'family',company:'Varo Group',percent:12,holder:'Ren',voter:'Mara',beneficiary:'Ren',restriction:'설정상 동의 필요',listed:false,value:null,currency:'EUR',evidence:'Ren delegated his voting rights to Mara.'}];
 p.investment.notes=[{id:'note',target:'stock:NYSE:X',date:'2026-10-30',text:'Do not sell just because today was difficult.',ko:'오늘 힘들었다고 팔지는 말 것.',source:'guess'}];
 p.investment.schedules=[{id:'event',target:'stake:family',kind:'delegation',date:'2026-11-10',title:'의결권 위임 만료',status:'scheduled',evidence:'The voting delegation expires on November 10, 2026.',ref:'#120'}];
 p.investment.history=[{id:'history',target:'stake:family',field:'voter',date:'2026-10-20',before:'Ren',after:'Mara',evidence:'Ren delegated his voting rights to Mara.',ref:'#118'}];
 const css=await readFile(new URL('../style.css',import.meta.url),'utf8');
 for(const view of ['ivnotes','ivschedule','ivhistory','invest','stock','ivactivity','ivwatch','ivstakes','ivcash','ivprices']) await writeFile(`${process.env.INVEST_PREVIEW}/${view}.html`,`<!doctype html><html lang="ko"><meta charset="UTF-8"><style>${css}\nbody{margin:0;background:#edf1ee}.cg_canvas{position:relative;transform:none}.na_phone{width:390px;margin:12px auto}.ax_canvas{height:844px}.iv_scroll{overflow:auto}</style><div class="na_phone"><div class="na_ph_scr app ax axb"><div class="cg_canvas ax_canvas">${ui.investmentScreen(m,p,'10-30',view,view==='stock'?'NYSE:X':'',false)}</div></div></div></html>`);
}

const phonedata=await load('phonedata.js',{
 './ai.js':ai,'./finance.js':financeURL,'./core.js':encoded(`export const ctx=()=>({loadWorldInfo:async()=>null});export const globalSettings=()=>({});export const saveMeta=async()=>{globalThis.__investTest.saved++};`),
 './calendar.js':encoded(`export const calendars=()=>({});export const headingDate=()=>({});`),
 './drift.js':encoded(`export const recentForCheck=()=>[];`), './inject.js':encoded(`export const applyInjection=()=>{};`),
 './knowledge.js':encoded(`export const knowledgeRows=()=>[];`),
 './people.js':encoded(`export const nameKey=s=>String(s).toLowerCase();export const nameRe=s=>new RegExp(s,'i');export const headingPlaces=()=>[];`),
 './recall.js':encoded(`export const estTok=s=>s.length/4;`), './scenes.js':encoded(`export const recentTrackers=()=>[];`),
 './sections.js':encoded(`export const parseSections=()=>[];export const RANGE_HEAD=/#(\\d+)–#(\\d+)/;export const sectionKey=()=>'';export const splitTail=s=>[s,''];`),
 './translate.js':encoded(`export const glossaryEntries=()=>[];`), './world.js':encoded(`export const worldText=()=>'';`)
});
test('bank regeneration preserves baseline, actual cash, old transactions and independent investments',async()=>{
 const {m,p}=setup();p.money={currency:'EUR',bank:{name:'Old',accounts:[{id:'bank',kind:'checking',last4:'1234',name:'Cash',balance:1000,currency:'EUR'}]},tx:[{id:'history',account:'1234',amount:-50}],orders:[],passes:[],cards:[],basis:'original',displayCurrency:'KRW',fxDate:'2026-10-30'};
 finance.migrateBank(m,p);finance.baseline(m,'broker','EUR',0,'2026-10-01',p.owner);
 finance.transfer(m,{id:'stable-transfer',from:'bank:EUR',to:'broker:EUR',sent:100,received:100,fee:0,date:'2026-10-30'});
 p.investment={sentinel:true};globalThis.__investTest.answer={currency:'USD',bank:{name:'New',accounts:[{id:'bank',kind:'checking',last4:'1234',name:'Renamed',currency:'USD',balance:999999}]},tx:[{account:'1234',who:'invented',amount:-100}],cards:[],orders:[],passes:[]};
 await phonedata.fillMoney(m,p);assert.equal(p.money.bank.accounts[0].name,'Renamed');assert.equal(p.money.bank.accounts[0].balance,900);assert.equal(p.money.bank.accounts[0].currency,'EUR');assert.equal(p.money.tx[0].id,'history');assert.equal(m.finance.accounts['bank:EUR'].amount,1000);assert.equal(m.finance.transfers['stable-transfer'].sent,100);assert.equal(p.investment.sentinel,true);assert.equal(p.money.displayCurrency,'KRW');assert.equal(p.money.fxDate,'2026-10-30');
});
test('whole phone regeneration retains bank and investment data',async()=>{
 const {m,p}=setup();p.money={sentinel:1};p.investment={sentinel:2};m.phones={a:p};globalThis.__investTest.answer={now:'10-30'};
 const got=await phonedata.makePhone(m,'A');assert.equal(got.money.sentinel,1);assert.equal(got.investment.sentinel,2);
});
test('missing numeric money value is unknown, not zero',()=>{
 const got=phonedata.parseMoney({currency:'EUR',bank:{accounts:[{kind:'checking',last4:'1234',balance:null}]}});assert.equal(got.bank.accounts[0].balance,null);
});

test('companion records require real source excerpts and valid target/date; unknown dates stay unknown',()=>{
 const {m}=setup(),inv={date:'2026-10-30',securities:[{symbol:'NYSE:X',name:'X'}],stakes:[{id:'family',company:'Family'}]};
 const source='A delegated voting rights to B. Dividend payment is scheduled for 2026-11-10.';
 const raw={schedules:[{target:'stock:NYSE:X',kind:'dividend',date:'2026-11-10',title:'Dividend',status:'scheduled',evidence:'Dividend payment is scheduled for 2026-11-10.'},{target:'stock:NYSE:X',kind:'dividend',date:'2026-11-10',title:'Paid',status:'paid',evidence:source},{target:'stock:OTHER',kind:'meeting',date:'2026-11-10',title:'Other',status:'scheduled',evidence:source}],history:[{target:'stake:family',field:'voter',date:'',before:'A',after:'B',evidence:'A delegated voting rights to B.'},{target:'stake:family',field:'holder',date:'2026-11-10',before:'A',after:'B',evidence:source},{target:'stake:family',field:'percent',date:'2026-10-29',before:'0',after:'50',evidence:'a made up ownership transfer'}]};
 const got=dataMod.parseInvestmentRecords(raw,inv,source,'records');assert.equal(got.schedules.length,1);assert.equal(got.history.length,1);assert.equal(got.history[0].date,'');assert.equal(got.history[0].before,'A');
 dataMod.mergeInvestmentRecords(inv,got);const id=inv.schedules[0].id;dataMod.mergeInvestmentRecords(inv,got);assert.equal(inv.schedules.length,1);assert.equal(inv.schedules[0].id,id);assert.equal(inv.history.length,1);assert.equal(inv.stakes[0].voter,undefined);assert.equal(m.finance,undefined);
});
test('imagined notes cannot be promoted to canon and record mode cannot write notes',()=>{
 const inv={date:'2026-10-30',securities:[{symbol:'NYSE:X',name:'X'}],stakes:[]};
 const raw={notes:[{target:'stock:NYSE:X',text:'I will hold.',source:'story',evidence:'Invented note as evidence'},{target:'stock:NYSE:X',text:'I will wait.',source:'guess',evidence:'invented'}]};
 const got=dataMod.parseInvestmentRecords(raw,inv,'Actual story only','notes','stock:NYSE:X');assert.equal(got.notes.length,1);assert.equal(got.notes[0].source,'guess');assert.equal(got.notes[0].evidence,'');assert.equal(dataMod.parseInvestmentRecords(raw,inv,'Actual story only','records').notes.length,0);
});
test('record generation and repeated scan leave ledger and current rights unchanged',async()=>{
 const {m,p}=setup();await dataMod.fillInvestment(m,p,'2026-10-30');p.investment.stakes=[{id:'family',company:'Family',voter:'B'}];
 m.text+=' A delegated voting rights to B. Dividend payment is scheduled for 2026-11-10.';
 const snapshot=JSON.stringify(m.finance);
 globalThis.__investTest.answer={notes:[],schedules:[{target:'stock:NYSE:X',kind:'dividend',date:'2026-11-10',title:'배당 예정',status:'scheduled',evidence:'Dividend payment is scheduled for 2026-11-10.'}],history:[{target:'stake:family',field:'voter',date:'',before:'A',after:'B',evidence:'A delegated voting rights to B.'}]};
 await dataMod.collectInvestmentRecords(m,p);await dataMod.collectInvestmentRecords(m,p);
 assert.equal(JSON.stringify(m.finance),snapshot);assert.equal(p.investment.stakes[0].voter,'B');assert.equal(p.investment.history.length,1);assert.equal(p.investment.schedules.length,1);
 for(const v of ['ivnotes','ivschedule','ivhistory']){const html=ui.investmentScreen(m,p,'10-30',v,'',false);assert.ok(html.length>100);assert.ok(!html.includes('NaN'));}
 assert.match(ui.investmentScreen(m,p,'10-30','stock','NYSE:X',false),/투자 메모/);
 assert.match(ui.investmentScreen(m,p,'10-30','ivstakes','',false),/변경 내역/);
});
test('failed companion request retains existing notes and finance',async()=>{
 const {m,p}=setup();await dataMod.fillInvestment(m,p,'2026-10-30');p.investment.notes=[{id:'existing',text:'keep'}];const before=JSON.stringify({f:m.finance,i:p.investment});globalThis.__investTest.error=true;
 await assert.rejects(dataMod.collectInvestmentRecords(m,p,'notes','stock:NYSE:X'));assert.equal(JSON.stringify({f:m.finance,i:p.investment}),before);
});
test('record provenance cannot cite generated target names as source; notes stay out of phone injection',async()=>{
 const {m,p}=setup();await dataMod.fillInvestment(m,p,'2026-10-30');p.investment.securities[0].name='Fabricated target dividend statement';
 globalThis.__investTest.answer={schedules:[{target:'stock:NYSE:X',kind:'dividend',date:'2026-11-10',title:'bad',status:'scheduled',evidence:p.investment.securities[0].name}]};await dataMod.collectInvestmentRecords(m,p);assert.equal(p.investment.schedules.length,0);
 p.inject=true;p.contacts=[];p.calls=[];p.notes=[];m.phones={a:p};p.investment.notes=[{text:'PRIVATE INVESTMENT NOTE',source:'guess'}];assert.ok(!phonedata.phoneBlock(m).includes('PRIVATE INVESTMENT NOTE'));assert.equal(p.events.length,0);
});
test('note and record requests use separate prompts and retain provenance boundaries',async()=>{
 const {m,p}=setup();await dataMod.fillInvestment(m,p,'2026-10-30');
 globalThis.__investTest.answer={notes:[{target:'stock:NYSE:X',text:'Keep watching.',source:'guess'}]};
 await dataMod.collectInvestmentRecords(m,p,'notes','stock:NYSE:X');
 const note=globalThis.__investTest.inputs.at(-1);
 assert.equal(note.system,dataMod.INVEST_NOTES_SYS);
 assert.doesNotMatch(note.system,/"schedules"|"history"/);
 assert.match(note.input,/APP CONTEXT/);
 assert.match(note.system,/exact excerpt from STORY INPUT/);
 globalThis.__investTest.answer={schedules:[],history:[]};
 await dataMod.collectInvestmentRecords(m,p);
 const records=globalThis.__investTest.inputs.at(-1);
 assert.equal(records.system,dataMod.INVEST_RECORDS_SYS);
 assert.doesNotMatch(records.system,/"notes"/);
 assert.doesNotMatch(records.input,/APP CONTEXT/);
 assert.match(records.system,/exact supporting excerpt from STORY INPUT/);
});
test('fictional dividends stay scheduled, private and idempotent without changing cash',async()=>{
 const {m,p}=setup();await dataMod.fillInvestment(m,p,'2026-10-30');p.investment.stakes=[{id:'family',company:'Family'}];
 const before=JSON.stringify(m.finance);
 const draft={target:'stock:NYSE:X',kind:'dividend',date:'2026-11-10',title:'배당 예정',status:'scheduled',source:'guess',evidence:'invented'};
 globalThis.__investTest.answer={schedules:[draft,{...draft,target:'stake:family'},{...draft,kind:'meeting'},{...draft,status:'paid'},{...draft,status:'cancelled'},{...draft,date:'2026-10-01'}],history:[{target:'stake:family',field:'voter',source:'guess',before:'A',after:'B',evidence:m.text}]};
 await dataMod.collectInvestmentRecords(m,p);
 assert.equal(p.investment.schedules.length,1);assert.equal(p.investment.history.length,0);
 assert.equal(p.investment.schedules[0].source,'guess');assert.equal(p.investment.schedules[0].evidence,'');
 globalThis.__investTest.answer={schedules:[{...draft,date:'2026-11-20'}]};await dataMod.collectInvestmentRecords(m,p);
 assert.equal(p.investment.schedules.length,1);assert.match(globalThis.__investTest.inputs.at(-1).input,/EXISTING SCHEDULES/);
 assert.equal(JSON.stringify(m.finance),before);
 const html=ui.investmentScreen(m,p,'10-30','ivschedule','',false);assert.match(html,/가상 예정/);assert.doesNotMatch(html,/class="ir_evidence"/);
 p.investment.date='2026-11-11';assert.match(ui.investmentScreen(m,p,'11-11','ivschedule','',false),/가상 · 날짜 지남/);assert.equal(p.investment.schedules[0].status,'scheduled');assert.equal(JSON.stringify(m.finance),before);
 p.investment.date='2026-10-30';const id=p.investment.schedules[0].id;
 m.text+=' Dividend payment is scheduled for 2026-11-10.';
 globalThis.__investTest.answer={schedules:[{...draft,source:'story',evidence:'Dividend payment is scheduled for 2026-11-10.'}]};await dataMod.collectInvestmentRecords(m,p);
 assert.equal(p.investment.schedules.length,1);assert.equal(p.investment.schedules[0].id,id);assert.equal(p.investment.schedules[0].source,'story');assert.equal(JSON.stringify(m.finance),before);
});
function euroWallet() {
 const {m,p}=setup();p.country='KR';
 p.money={currency:'EUR',fxDate:'2026-10-30',bank:{name:'Bank',accounts:[{id:'eur',kind:'checking',last4:'1234',currency:'EUR',balance:13000},{id:'credit',kind:'credit',last4:'5678',currency:'EUR',balance:2000}]},cards:[{account:'1234'}],tx:[],passes:[],orders:[]};
 return {m,p};
}
test('bank converts EUR cash to KRW without converting the ledger or counting credit',()=>{
 const {m,p}=euroWallet();finance.migrateBank(m,p);const before=JSON.stringify(m.finance.accounts);
 finance.addPrice(m,'FX:EUR/KRW','2026-10-30',{value:1500,source:'guess'});
 assert.equal(moneyUI.bankDisplayCurrency(p),'KRW');
 assert.doesNotMatch(moneyUI.walletScreen(p,'10-30'),/ax_fx_total|bank_display|bank_fxrefresh/);
 assert.doesNotMatch(moneyUI.cardView(p,'10-30','0'),/ax_fx_cardnote|19,500,000/);
 for(const html of [moneyUI.bankHome(p,'10-30'),moneyUI.bankAcct(p,'10-30','0')]) {
  assert.match(html,/19,500,000/);assert.doesNotMatch(html,/22,500,000/);
 }
 assert.match(moneyUI.bankAcct(p,'10-30','0'),/13,000/);assert.match(moneyUI.bankAcct(p,'10-30','0'),/가상 환율/);
 finance.addPrice(m,'FX:EUR/KRW','2026-10-30',{value:1600,source:'story',ref:'One euro equals 1600 won.'});
 assert.match(moneyUI.bankHome(p,'10-30'),/20,800,000/);assert.equal(JSON.stringify(m.finance.accounts),before);assert.equal(p.money.bank.accounts[0].balance,13000);assert.equal(p.money.currency,'EUR');
 p.money.displayCurrency='EUR';assert.match(moneyUI.bankHome(p,'10-30'),/13,000/);assert.equal(JSON.stringify(m.finance.accounts),before);
});
test('missing or stale display FX never creates a full total or a fake conversion',()=>{
 const {m,p}=euroWallet();finance.addPrice(m,'FX:EUR/KRW','2026-10-29',{value:1500});
 for(const html of [moneyUI.bankHome(p,'10-30')]) {assert.match(html,/환산 미완료/);assert.match(html,/환산 대기/);assert.doesNotMatch(html,/19,500,000/);}
 assert.match(moneyUI.bankAcct(p,'10-30','0'),/KRW 환산 대기/);assert.equal(p.money.bank.accounts[0].balance,13000);
});
test('bank FX refresh works without a portfolio and accepts only requested dates/pairs',async()=>{
 const {m,p}=euroWallet();finance.migrateBank(m,p);const before=JSON.stringify(m.finance.accounts);
 globalThis.__investTest.answer={fx:[{from:'EUR',to:'KRW',date:'2026-10-30',value:1500},{from:'USD',to:'JPY',date:'2026-10-30',value:150},{from:'EUR',to:'KRW',date:'2026-11-01',value:1800}],quotes:[{symbol:'NYSE:X',date:'2026-10-30',value:9}]};
 await dataMod.refreshBankFX(m,p,'2026-10-30','KRW');assert.equal(finance.fx(m,'EUR','KRW','2026-10-30'),1500);assert.equal(finance.fx(m,'USD','JPY','2026-10-30'),null);assert.equal(finance.fx(m,'EUR','KRW','2026-11-01'),null);assert.equal(p.investment,undefined);assert.equal(JSON.stringify(m.finance.accounts),before);
 globalThis.__investTest.answer={fx:[{from:'EUR',to:'KRW',date:'2026-10-30',value:9999}]};await dataMod.refreshBankFX(m,p,'2026-10-30','KRW');assert.equal(finance.fx(m,'EUR','KRW','2026-10-30'),1500);
});
