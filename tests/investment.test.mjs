import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import * as finance from '../src/finance.js';
const encoded = s => 'data:text/javascript;base64,'+Buffer.from(s).toString('base64');
const core = encoded(`export const saveMeta=async()=>{globalThis.__investTest.saved++}; export const getMeta=()=>globalThis.__investTest.meta;`);
const ai = encoded(`export const askDraft=async(input, options)=>{if(options.system.includes('Set a compact personal financial scale')){(globalThis.__investTest.wealthInputs ||= []).push(input);return JSON.stringify({currency:'EUR',deposits:{min:0,max:1e15},investments:{min:0,max:1e15},basis:'fixture'})}globalThis.__investTest.inputs.push({input,...options}); if(globalThis.__investTest.error)throw Error('network'); return JSON.stringify(globalThis.__investTest.answers?.length ? globalThis.__investTest.answers.shift() : globalThis.__investTest.answer)};`);
const data = encoded(`export const sideRequest=async(m,owner,blocks)=>m.text+'\\n'+blocks.join('\\n'); export const prepareWealth=async()=>({currency:'EUR',deposits:{min:0,max:1e15},investments:{min:0,max:1e15},basis:'fixture'}); export const storyNow=p=>p.now||''; export const fmtDate=(p,v)=>v; export const fmtTime=(p,v)=>v; export const koOn=()=>true; export const listTime=(p,v)=>v;`);
const apps = encoded(`export const AX={}; export const ax=()=>''; export const axBar=()=>'';export const axCb=()=>'';export const axH1=t=>'<h1>'+t+'</h1>';export const axInd=()=>'';export const axTop=()=>'';export const axDay=(p,n,d)=>d;export const axFind=()=>'';export const axKp=()=>'';export const axLetter=()=>'';export const axTint=()=> '#ffffff';export const busyHtml='';`);
const util=encoded(`export const esc=s=>String(s??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');`);
const financeURL=pathToFileURL(new URL('../src/finance.js',import.meta.url).pathname).href;
async function load(file, map) { const src=await readFile(new URL('../src/'+file,import.meta.url),'utf8');return import(encoded(src.replace(/from '([^']+)'/g,(all,k)=>`from '${map[k]||k}'`))); }
const wealthSource=await readFile(new URL('../src/wealth.js',import.meta.url),'utf8');
const wealthURL=encoded(wealthSource.replace("'./ai.js'",JSON.stringify(ai)).replace("'./core.js'",JSON.stringify(core)).replace("'./finance.js'",JSON.stringify(financeURL)));
const dataMod=await load('investdata.js',{'./wealth.js':wealthURL,'./ai.js':ai,'./core.js':core,'./phonedata.js':data,'./finance.js':financeURL});
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
 const detail=ui.investmentScreen(m,p,'10-30','stock','NYSE:X',false);assert.match(detail,/가격 확인 필요/);assert.equal(finance.price(m,'STOCK:NYSE:X','2026-10-30').value,110);
});
test('legacy credit renders without regeneration and stays out of bank deposits',()=>{
 const {m,p}=setup();p.money={currency:'EUR',bank:{name:'Bank',accounts:[{id:'a',kind:'checking',last4:'1234',balance:100},{id:'b',kind:'credit',last4:'5678',balance:70},{id:'c',kind:'savings',last4:'9999',balance:100,currency:'USD'}]},tx:[],orders:[],passes:[],cards:[]};
 const html=moneyUI.bankHome(p,'10-30');assert.match(html,/환산 가능한 소계/);assert.match(html,/이번 달 사용/);assert.equal(p.money.bank.accounts[1].spent,0);assert.ok(!html.includes('€270'));assert.equal(globalThis.__investTest.inputs.length,0);
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

const phonedata=await load('phonedata.js',{'./wealth.js':wealthURL,
 './phoneprofile.js':pathToFileURL(new URL('../src/phoneprofile.js',import.meta.url).pathname).href,
 './ai.js':ai,'./finance.js':financeURL,'./core.js':encoded(`export const ctx=()=>globalThis.__investTest.context||({loadWorldInfo:async()=>null});export const globalSettings=()=>({});export const saveMeta=async()=>{globalThis.__investTest.saved++};`),
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
 const {m,p}=setup();p.money={sentinel:1};p.investment={sentinel:2};p.financeProfile={type:'character',id:'a.png'};m.phones={a:p};globalThis.__investTest.context={characters:[{avatar:'a.png',description:'Selected owner background.'}]};globalThis.__investTest.answer={now:'10-30'};
 const got=await phonedata.makePhone(m,'A');assert.equal(got.money.sentinel,1);assert.equal(got.investment.sentinel,2);assert.deepEqual(got.financeProfile,{type:'character',id:'a.png'});assert.match(globalThis.__investTest.inputs.at(-1).input,/Selected owner background/);
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
 assert.doesNotMatch(ui.investmentScreen(m,p,'10-30','stock','NYSE:X',false),/투자 메모/);
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
 const html=ui.investmentScreen(m,p,'10-30','ivschedule','',false);assert.match(html,/예정/);assert.doesNotMatch(html,/가상|상상/);assert.doesNotMatch(html,/class="ir_evidence"/);
 p.investment.date='2026-11-11';assert.match(ui.investmentScreen(m,p,'11-11','ivschedule','',false),/날짜 지남/);assert.equal(p.investment.schedules[0].status,'scheduled');assert.equal(JSON.stringify(m.finance),before);
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
 assert.match(moneyUI.cardView(p,'10-30','0'),/19,500,000/);
 for(const html of [moneyUI.bankHome(p,'10-30'),moneyUI.bankAcct(p,'10-30','0')]) {
  assert.match(html,/19,500,000/);assert.doesNotMatch(html,/22,500,000/);
 }
 assert.match(moneyUI.bankAcct(p,'10-30','0'),/13,000/);assert.doesNotMatch(moneyUI.bankAcct(p,'10-30','0'),/가상|상상/);
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
test('card detail separates credit usage from cash and links real payment records',()=>{
 const {m,p}=euroWallet();p.money.cards.push({account:'5678',exp:'11/29'});
 p.money.tx=[{id:'debit-tx',account:'1234',kind:'card',who:'Coffee',amount:-6,time:'10-30 09:00'},{id:'credit-tx',account:'5678',kind:'card',who:'Bookshop',amount:-20,time:'10-29 18:00',pending:true}];
 finance.migrateBank(m,p);finance.addPrice(m,'FX:EUR/KRW','2026-10-30',{value:1500});const before=JSON.stringify(m.finance);
 const debit=moneyUI.cardView(p,'10-30','0'),credit=moneyUI.cardView(p,'10-30','1');
 assert.match(debit,/연결 계좌 잔액/);assert.match(debit,/data-i="debit-tx"/);assert.doesNotMatch(debit,/Bookshop/);
 assert.match(credit,/이번 달 이용 금액/);assert.doesNotMatch(credit,/3,000,000/);assert.equal(p.money.bank.accounts[1].spent,0);assert.match(credit,/승인 대기 1/);assert.match(credit,/data-i="credit-tx"/);assert.doesNotMatch(credit,/연결 계좌 잔액|Coffee/);
 assert.doesNotMatch(credit,/<details class="cd_info">|카드 소유자/);assert.match(credit,/<details class="cd_fx">/);assert.equal(JSON.stringify(m.finance),before);
});
test('explicit bank rebuild changes current cash once and preserves linked transfers and credit semantics',async()=>{
 const {m,p}=euroWallet();finance.migrateBank(m,p);
 finance.baseline(m,'broker','EUR',0,'2026-10-01',p.owner);
 const t={id:'move',from:'eur:EUR',to:'broker:EUR',date:'2026-10-30',sent:1000,received:1000,fee:0};finance.transfer(m,t);
 const entries=structuredClone(m.finance.accounts['eur:EUR'].entries);const oldTx=p.money.tx=[{id:'receipt',account:'1234',amount:15000},{id:'spend',account:'1234',amount:-2000}];
 p.investment={sentinel:1};p.money.displayCurrency='KRW';p.money.orders=[{id:'old-order',item:'Old order'}];p.money.passes=[{id:'old-pass',by:'Old airline'}];p.money.cards=[{account:'1234',exp:'01/20'}];m.finance.accounts['eur:EUR'].included.push('receipt','spend');
 globalThis.__investTest.answer={currency:'EUR',basis:'Revised scale',bank:{name:'New bank',accounts:[{id:'eur',last4:'1234',kind:'checking',currency:'EUR',balance:50000},{id:'credit',last4:'5678',kind:'credit',currency:'EUR',balance:300}]},tx:[{account:'1234',who:'New purchase',amount:-1000}],cards:[],passes:[],orders:[]};
 await phonedata.fillMoney(m,p,{regenerateBalances:true});
 assert.equal(p.money.bank.accounts[0].balance,50000);assert.equal(finance.cash(m.finance.accounts['eur:EUR']),50000);assert.equal(m.finance.accounts['eur:EUR'].amount,51000);
 assert.deepEqual(m.finance.accounts['eur:EUR'].entries,entries);assert.deepEqual(m.finance.transfers.move,t);assert.equal(finance.cash(m.finance.accounts['broker:EUR']),1000);assert.notDeepEqual(p.money.tx,oldTx);assert.equal(p.money.tx[0].who,'New purchase');assert.ok(!m.finance.accounts['eur:EUR'].included.includes('receipt'));assert.ok(m.finance.accounts['eur:EUR'].included.includes(p.money.tx[0].id));
 assert.deepEqual(p.money.orders,[]);assert.deepEqual(p.money.passes,[]);assert.deepEqual(p.money.cards,[]);
 assert.equal(p.money.bank.accounts[1].spent,0);assert.equal(p.money.bank.accounts[1].balance,0);assert.equal(p.money.basis,'Revised scale');assert.equal(p.money.displayCurrency,'KRW');assert.equal(p.investment.sentinel,1);
 assert.doesNotMatch(globalThis.__investTest.inputs.at(-1).input,/PRESERVED TRANSACTIONS|receipt|spend/);assert.match(globalThis.__investTest.inputs.at(-1).system,/CURRENT balance/);
 finance.migrateBank(m,p);assert.equal(p.money.bank.accounts[0].balance,50000);
 await phonedata.fillMoney(m,p,{regenerateBalances:true});assert.equal(finance.cash(m.finance.accounts['eur:EUR']),50000);assert.equal(Object.keys(m.finance.transfers).length,1);
});
test('malformed rebuilt balances leave every account and its ledger unchanged',async()=>{
 const {m,p}=euroWallet();finance.migrateBank(m,p);const before=JSON.stringify({money:p.money,finance:m.finance});
 for(const invalid of [null,-1,'1000']) {
 globalThis.__investTest.answer={bank:{accounts:[{id:'eur',last4:'1234',kind:'checking',currency:'EUR',balance:invalid},{id:'credit',last4:'5678',kind:'credit',currency:'EUR',balance:0}]}};
 await assert.rejects(phonedata.fillMoney(m,p,{regenerateBalances:true}),/잔액/);assert.equal(JSON.stringify({money:p.money,finance:m.finance}),before);
 }
 globalThis.__investTest.answer={bank:{accounts:[{id:'eur',last4:'1234',kind:'checking',currency:'KRW',balance:50000},{id:'credit',last4:'5678',kind:'credit',currency:'EUR',balance:300}]}};
 await assert.rejects(phonedata.fillMoney(m,p,{regenerateBalances:true}),/잔액/);assert.equal(JSON.stringify({money:p.money,finance:m.finance}),before);
 globalThis.__investTest.error=true;await assert.rejects(phonedata.fillMoney(m,p,{regenerateBalances:true}),/network/);assert.equal(JSON.stringify({money:p.money,finance:m.finance}),before);
});
test('incomplete money rebuild preserves the old records and ledger',async()=>{
 const {m,p}=euroWallet();finance.migrateBank(m,p);
 const before=JSON.stringify([p.money,m.finance]);
 globalThis.__investTest.answer={currency:'EUR',bank:{name:'Bank',accounts:p.money.bank.accounts},cards:[],tx:[],passes:[]};
 await assert.rejects(phonedata.fillMoney(m,p,{regenerateBalances:true}),/거래 내역/);
 assert.equal(JSON.stringify([p.money,m.finance]),before);
});
test('chart backfill preserves saved anchors, executions and FX and reuses the cached history',async()=>{
 const {m,p}=setup();await dataMod.fillInvestment(m,p,'2026-10-30');
 finance.addPrice(m,'STOCK:NYSE:X','2026-06-25',{value:90,source:'story',ref:'old anchor'});
 const before=structuredClone(m.finance),trades=JSON.stringify(p.investment.trades), dates=dataMod.chartDates(m,p.investment,'NYSE:X','1m');
 assert.ok(dates.length>=20 && dates.length<=24);assert.ok(dates.every(d=>d<='2026-10-30' && d>='2026-09-29'));
 for(const range of ['1w','3m','all'])assert.ok(dataMod.chartDates(m,p.investment,'NYSE:X',range).length<=24);
 const original=ui.investmentScreen(m,p,'10-30','stock','NYSE:X',false);assert.match(original,/선택 기간의 기록 부족/);assert.doesNotMatch(original,/iv_chartfill/);
 globalThis.__investTest.answer={quotes:[...dates.map((date,i)=>({symbol:'NYSE:X',date,value:100+i/2,source:'guess'})),{symbol:'NYSE:X',date:'2026-06-25',value:1,source:'story',evidence:m.text},{symbol:'OTHER',date:dates[0],value:1},{symbol:'NYSE:X',date:'2026-11-02',value:999}],fx:[{from:'USD',to:'EUR',date:'2026-10-30',value:9}]};
 assert.equal(await dataMod.fillChartHistory(m,p,'NYSE:X','1m'),dates.length-1);
 assert.deepEqual(m.finance.prices['STOCK:NYSE:X']['2026-10-30'],before.prices['STOCK:NYSE:X']['2026-10-30']);assert.deepEqual(m.finance.prices['STOCK:NYSE:X']['2026-06-25'],before.prices['STOCK:NYSE:X']['2026-06-25']);
 assert.equal(JSON.stringify(p.investment.trades),trades);assert.deepEqual(m.finance.accounts,before.accounts);assert.deepEqual(m.finance.prices['FX:EUR/USD'],before.prices['FX:EUR/USD']);assert.equal(m.finance.prices['STOCK:OTHER'],undefined);assert.equal(m.finance.prices['STOCK:NYSE:X']['2026-11-02'],undefined);
 assert.match(ui.investmentScreen(m,p,'10-30','stock','NYSE:X',false),/aria-label="일봉 차트"/);
 const calls=globalThis.__investTest.inputs.length;assert.equal(await dataMod.fillChartHistory(m,p,'NYSE:X','1m'),0);assert.equal(globalThis.__investTest.inputs.length,calls);
});
test('failed chart generation leaves the shared price book unchanged',async()=>{
 const {m,p}=setup();await dataMod.fillInvestment(m,p,'2026-10-30');const before=JSON.stringify(m.finance);
 globalThis.__investTest.answer={quotes:[{symbol:'NYSE:X',date:'2026-10-01',value:123,source:'story',evidence:'fabricated evidence'}]};
 await assert.rejects(dataMod.fillChartHistory(m,p,'NYSE:X'),/시세/);assert.equal(JSON.stringify(m.finance),before);
 globalThis.__investTest.error=true;await assert.rejects(dataMod.fillChartHistory(m,p,'NYSE:X'),/network/);assert.equal(JSON.stringify(m.finance),before);
});
test('bank creation and explicit rebuild include the chosen owner profile, not other cards',async()=>{
 const {m,p}=euroWallet();
 globalThis.__investTest.context={characters:[{avatar:'a.png',name:'A',description:'Owner has substantial personal reserves.'},{avatar:'b.png',name:'B',description:'Other private profile.'}],loadWorldInfo:async()=>null};
 p.financeProfile={type:'character',id:'a.png'};
 globalThis.__investTest.answer={currency:'EUR',bank:{name:'Bank',accounts:p.money.bank.accounts},cards:[],tx:[],orders:[],passes:[]};
 await phonedata.fillMoney(m,p,{regenerateBalances:true});const input=globalThis.__investTest.inputs.at(-1).input;assert.match(input,/Owner has substantial personal reserves/);assert.doesNotMatch(input,/Other private profile/);
 assert.doesNotMatch(await phonedata.sideRequest(m,p.owner,[]),/OWNER PROFILE/);
 const binding=p.financeProfile;delete p.money;await phonedata.fillMoney(m,p);assert.match(globalThis.__investTest.inputs.at(-1).input,/OWNER PROFILE/);assert.equal(p.financeProfile,binding);
});
test('investment creation passes its selected profile into the source request',async()=>{
 const {m,p}=setup();p.financeProfile={type:'lore',book:'Family',id:'4'};
 const proxy=encoded(`export const prepareWealth=async()=>({currency:'EUR',deposits:{min:0,max:1e15},investments:{min:0,max:1e15},basis:'fixture'});export const storyNow=p=>p.now;export const sideRequest=async(m,owner,blocks,options)=>{globalThis.__investTest.profileOptions=options;return m.text+'\\n'+blocks.join('\\n')};`);
 const actual=await load('investdata.js',{'./wealth.js':wealthURL,'./ai.js':ai,'./core.js':core,'./phonedata.js':proxy,'./finance.js':financeURL});
 await actual.fillInvestment(m,p,'2026-10-30');assert.deepEqual(globalThis.__investTest.profileOptions,{profile:p.financeProfile});
 await actual.fillInvestment(m,p,'2026-10-30',{regenerate:true});assert.deepEqual(globalThis.__investTest.profileOptions,{profile:p.financeProfile});
 globalThis.__investTest.answer={};
 await assert.rejects(actual.collectInvestmentRecords(m,p,'notes','stock:NYSE:X'),/노트/);
 assert.deepEqual(globalThis.__investTest.profileOptions,{profile:p.financeProfile});
 await actual.collectInvestmentRecords(m,p,'records');assert.equal(globalThis.__investTest.profileOptions?.profile,undefined);
 await actual.refreshMarket(m,p,'2026-10-30',true);assert.equal(globalThis.__investTest.profileOptions?.profile,undefined);
 await assert.rejects(actual.fillChartHistory(m,p,'NYSE:X'),/시세/);assert.equal(globalThis.__investTest.profileOptions?.profile,undefined);

});

test('voice batch generation receives the selected profile',async()=>{
 const {m,p}=setup();p.financeProfile={type:'character',id:'a.png'};
 globalThis.__investTest.context={characters:[{avatar:'a.png',description:'Speaks tersely and loves sailing.'}]};
 globalThis.__investTest.answer={memos:[{title:'Today',text:'A quiet day.',time:'10-30 12:00'}]};
 await phonedata.fillVoice(m,p);assert.match(globalThis.__investTest.inputs.at(-1).input,/Speaks tersely and loves sailing/);
});
test('individual writing includes owner profile while camera and public search do not',async()=>{
 globalThis.__profileData=phonedata;
 const bridge=encoded(Object.keys(phonedata).map(k=>`export const ${k}=globalThis.__profileData.${k};`).join('\n'));
 const mod=await load('phoneai.js',{
 './phoneprofile.js':pathToFileURL(new URL('../src/phoneprofile.js',import.meta.url).pathname).href,
 './ai.js':encoded(`export const askAI=async(input)=>{globalThis.__investTest.inputs.push({input});return JSON.stringify(globalThis.__investTest.answers?.length ? globalThis.__investTest.answers.shift() : globalThis.__investTest.answer)};`),
 './core.js':encoded(`export const ctx=()=>globalThis.__investTest.context;export const globalSettings=()=>({});export const saveMeta=async()=>{};`),
 './phonedata.js':bridge,'./anniv.js':encoded(`export const datedRows=()=>[];`),
 './calendar.js':encoded(`export const calendars=()=>({});`),'./drift.js':encoded(`export const recentForCheck=()=>[];`),
 './people.js':encoded(`export const headingPlaces=()=>[];export const nameKey=s=>s;export const peopleList=()=>[];`)
 });
 const {m,p}=setup();Object.assign(p,{financeProfile:{type:'character',id:'a.png'},notes:[],diary:[],photos:[],threads:[{with:'B',messages:[]}],searches:[{q:'weather'}]});
 globalThis.__investTest.context={characters:[{avatar:'a.png',description:'PRIVATE OWNER PROFILE SENTINEL'}]};
 globalThis.__investTest.answer={title:'Today',text:'Hello',caption:'A room',results:[{title:'Weather',text:'Sunny'}]};
 for(const run of [()=>mod.writeEntry(m,p,'note'),()=>mod.writeEntry(m,p,'diary'),()=>mod.makeDraft(m,p,0),()=>mod.recordVoice(m,p)]){
  await run();assert.match(globalThis.__investTest.inputs.at(-1).input,/PRIVATE OWNER PROFILE SENTINEL/);
 }
 for(const run of [()=>mod.takePhoto(m,p),()=>mod.searchPage(m,p,0),()=>mod.webPage(m,p,0,0)]){
  await run();assert.doesNotMatch(globalThis.__investTest.inputs.at(-1).input,/PRIVATE OWNER PROFILE SENTINEL/);
 }
 await assert.rejects(mod.drawPhoto(m,p,0),/PHOTO/);
 assert.doesNotMatch(globalThis.__investTest.inputs.at(-1).input,/PRIVATE OWNER PROFILE SENTINEL/);

});

test('device generation uses selected profile once and survives whole phone regeneration',async()=>{
 const {m,p}=setup();p.financeProfile={type:'character',id:'a.png'};m.phones={a:p};
 globalThis.__investTest.context={characters:[{avatar:'a.png',description:'Premium equipment and large personal resources.'}]};
 const device={name:'A phone',model:'Example Pro',os:'Example OS 1',storage:'1 TB',serial:'EXAMPLE123'};
 globalThis.__investTest.answer=device;
 const results=await Promise.all([phonedata.fillDevice(m,p),phonedata.fillDevice(m,p)]);
 assert.deepEqual(results,[device,device]);assert.equal(globalThis.__investTest.inputs.length,1);
 assert.match(globalThis.__investTest.inputs[0].input,/Premium equipment/);assert.match(globalThis.__investTest.inputs[0].system,/capacity offered for that specific model/);
 await phonedata.fillDevice(m,p);assert.equal(globalThis.__investTest.inputs.length,1);
 globalThis.__investTest.answer={now:'10-30',device:{...device,storage:'256 GB'}};
 const rebuilt=await phonedata.makePhone(m,'A');assert.deepEqual(rebuilt.device,device);
 assert.doesNotMatch(phonedata.phoneBlock(m),/EXAMPLE123/);
});

test('device parser keeps partial data and original display text',()=>{
 for(const raw of [{model:'Pro'},{os:'OS 1'},{storage:'1 TB (1024 GB)'},{serial:'TEST'}]) {
  const got=phonedata.parseDevice(raw);for(const [key,value] of Object.entries(raw))assert.equal(got[key],value);
 }
 assert.equal(phonedata.parseDevice({model:'Pro'}).serial,'');
 assert.equal(phonedata.parseDevice({storage:1024}).storage,'1024');
 assert.equal(phonedata.parseDevice({}),null);
 const core={model:'Pro',os:'OS 1',storage:'1TB'};
 for(const raw of [core,{device:core},{deviceInfo:core},{model_name:'Pro',software_version:'OS 1',storage:{value:1,unit:'TB'}}]){
  const got=phonedata.readDeviceReply('```json\n'+JSON.stringify(raw)+'\n```');assert.equal(got.storage,'1 TB');assert.equal(got.model,'Pro');
 }
});
test('partial device response saves once without retry or fabricated missing fields',async()=>{
 const {m,p}=setup();globalThis.__investTest.answer={device:{model:'Pro',storage:'1 TB (1024 GB)'}};
 const got=await phonedata.fillDevice(m,p);assert.equal(got.model,'Pro');assert.equal(got.storage,'1 TB (1024 GB)');
 assert.equal(got.os,'');assert.equal(got.serial,'');assert.equal(globalThis.__investTest.inputs.length,1);
 const system=globalThis.__investTest.inputs[0].system;
 for(const heading of ['GOAL','YOU GET','RULES','ANSWER'])assert.ok(system.includes(heading));
 await phonedata.fillDevice(m,p);assert.equal(globalThis.__investTest.inputs.length,1);
});
test('unreadable or empty device response does not save or retry',async()=>{
 const {m,p}=setup();globalThis.__investTest.answer={};
 await assert.rejects(phonedata.fillDevice(m,p),/JSON/);assert.equal(p.device,undefined);assert.equal(globalThis.__investTest.inputs.length,1);
 assert.equal(phonedata.readDeviceReply('not JSON'),null);
});

test('stock details omit retired investment memo and creation button without deleting saved data',async()=>{
 const {m,p}=setup();await dataMod.fillInvestment(m,p,'2026-10-30');
 p.investment.notes=[{target:'stock:NYSE:X',text:'Saved old investment memo',source:'guess'}];
 const html=ui.investmentScreen(m,p,'10-30','stock','NYSE:X',false);
 assert.doesNotMatch(html,/투자 메모|새 메모|iv_notemake|Saved old investment memo/);
 assert.match(html,/거래 내역/);assert.equal(p.investment.notes.length,1);
});

test('explicit investment rebuild replaces trades but regenerates cash while preserving transfers and other owners',async()=>{
 const {m,p}=setup();await dataMod.fillInvestment(m,p,'2026-10-30');
 const key=p.investment.accounts[0].key, oldTrade=p.investment.trades[0].id;
 finance.baseline(m,'bank','USD',1000,'2026-10-01',p.owner);
 finance.baseline(m,'other','USD',333,'2026-10-01','Other');
 const transfer={id:'linked',from:'bank:USD',to:key,sent:200,received:200,fee:0,date:'2026-10-30'};
 finance.transfer(m,transfer);
 const external=structuredClone(m.finance.accounts['other:USD']),bank=structuredClone(m.finance.accounts['bank:USD']),quotes=structuredClone(m.finance.prices);
 globalThis.__investTest.answer.cash[0].amount=999999; // Explicit regeneration replaces opening cash.
 globalThis.__investTest.answer.trades[0].quantity=5;
 globalThis.__investTest.answer.watch[0].note='new watch reason';
 await dataMod.fillInvestment(m,p,'2026-10-30',{regenerate:true});
 assert.equal(p.investment.accounts[0].key,key);assert.equal(m.finance.accounts[key].amount,999999);
 assert.equal(m.finance.accounts[key].entries[oldTrade],undefined);assert.equal(finance.cash(m.finance.accounts[key]),999699);
 assert.equal(m.finance.accounts[key].entries.linked.amount,200);assert.deepEqual(m.finance.transfers.linked,transfer);
 assert.deepEqual(m.finance.accounts['bank:USD'],bank);assert.deepEqual(m.finance.accounts['other:USD'],external);assert.deepEqual(m.finance.prices,quotes);
 assert.equal(p.investment.watch[0].note,'new watch reason');assert.match(globalThis.__investTest.inputs.at(-1).input,/PRESERVED INVESTMENT CASH/);
 await dataMod.fillInvestment(m,p,'2026-10-30',{regenerate:true});assert.equal(finance.cash(m.finance.accounts[key]),999699);
 assert.equal(Object.keys(m.finance.accounts[key].entries).length,2);
});
test('failed investment rebuild leaves entire portfolio and ledger untouched',async()=>{
 const {m,p}=setup();await dataMod.fillInvestment(m,p,'2026-10-30');const before=JSON.stringify([m.finance,p.investment]);
 globalThis.__investTest.answer.trades[0].quantity=1000;
 await assert.rejects(dataMod.fillInvestment(m,p,'2026-10-30',{regenerate:true}),/현금|잔액/);assert.equal(JSON.stringify([m.finance,p.investment]),before);
 globalThis.__investTest.error=true;await assert.rejects(dataMod.fillInvestment(m,p,'2026-10-30',{regenerate:true}),/network/);assert.equal(JSON.stringify([m.finance,p.investment]),before);
});
test('investment rebuild preserves snapshot-included transfers and rejects concurrent changes',async()=>{
 const {m,p}=setup();await dataMod.fillInvestment(m,p,'2026-10-30');const key=p.investment.accounts[0].key;
 finance.baseline(m,'bank','USD',900,'2026-10-01',p.owner);
 const t={id:'included',from:'bank:USD',to:key,sent:100,received:100,fee:0,date:'2026-10-30',includedFrom:true,includedTo:true};finance.transfer(m,t);
 await dataMod.fillInvestment(m,p,'2026-10-30',{regenerate:true});assert.equal(finance.cash(m.finance.accounts[key]),1000);assert.deepEqual(m.finance.accounts[key].included,['included']);
 const inv=p.investment,answer=globalThis.__investTest.answer;
 Object.defineProperty(globalThis.__investTest,'answer',{get(){m.finance.accounts[key].entries.external={amount:10,date:'2026-10-30'};return answer;}});
 await assert.rejects(dataMod.fillInvestment(m,p,'2026-10-30',{regenerate:true}),/변경/);
 assert.equal(p.investment,inv);assert.equal(m.finance.accounts[key].entries.external.amount,10);
});
test('investment generation prompts share existing section format and keep JSON contracts',async()=>{
 const source=await readFile(new URL('../src/investdata.js',import.meta.url),'utf8');
 for(const name of ['INVEST_SYS','MARKET_SYS','INVEST_NOTES_SYS','INVEST_RECORDS_SYS','CHART_SYS']) {
  const start=source.indexOf(`const ${name} = `),end=source.indexOf('`;',start);
  const prompt=source.slice(start,end);for(const heading of ['GOAL','YOU GET','RULES','ANSWER'])assert.ok(prompt.includes(heading),`${name}: ${heading}`);
 }
});

const scalePlan=(deposits,investments,cur='EUR')=>({currency:cur,deposits:{min:deposits,max:deposits},investments:{min:investments,max:investments},basis:'Explicit test scale'});
test('wealth plan is shared and story/profile changes alone do not cause reassessment',async()=>{
 const {m,p}=setup();
 const first=await phonedata.prepareWealth(m,p);
 m.text+=' A new RP message.';p.financeProfile={type:'character',id:'other.png'};globalThis.__investTest.context={characters:[{avatar:'other.png',description:'Updated profile.'}]};
 assert.equal(await phonedata.prepareWealth(m,p),first);
 assert.equal(globalThis.__investTest.wealthInputs.length,1);
 await phonedata.prepareWealth(m,p,true);assert.equal(globalThis.__investTest.wealthInputs.length,2);
});
test('bank scale correction excludes credit spending and retries once without installing rejected records',async()=>{
 const {m,p}=euroWallet();
 const reply=amount=>({currency:'EUR',bank:{name:'Bank',accounts:[{id:'eur',kind:'checking',last4:'1234',currency:'EUR',balance:amount},{id:'credit',kind:'credit',last4:'5678',currency:'EUR',balance:900000}]},cards:[],tx:[],passes:[],orders:[]});
 globalThis.__investTest.answers=[reply(100),reply(500000000)];
 await phonedata.fillMoney(m,p,{regenerateBalances:true,wealthPlan:scalePlan(500000000,0)});
 assert.equal(p.money.bank.accounts[0].balance,500000000);assert.equal(globalThis.__investTest.inputs.length,2);
 assert.match(globalThis.__investTest.inputs[1].input,/SCALE CORRECTION/);
 finance.migrateBank(m,p);const before=JSON.stringify([p.money,m.finance]);
 globalThis.__investTest.answers=[reply(100),reply(200)];
 await assert.rejects(phonedata.fillMoney(m,p,{regenerateBalances:true,wealthPlan:scalePlan(500000000,0)}),/재력 기준/);
 assert.equal(globalThis.__investTest.inputs.length,4);assert.equal(JSON.stringify([p.money,m.finance]),before);
});
test('investment scale uses holdings plus cash, corrects once and keeps shared quotes fixed',async()=>{
 const {m,p}=setup(),small=structuredClone(globalThis.__investTest.answer),large=structuredClone(small);
 large.cash[0].amount=500000000;large.trades[0].quantity=1000000;
 globalThis.__investTest.answers=[small,large];
 await dataMod.fillInvestment(m,p,'2026-10-30',{wealthPlan:scalePlan(0,484500000)});
 assert.equal(globalThis.__investTest.inputs.length,2);assert.equal(p.investment.trades[0].quantity,1000000);
 const before=JSON.stringify([m.finance,p.investment]);
 globalThis.__investTest.answers=[small,small];
 await assert.rejects(dataMod.fillInvestment(m,p,'2026-10-30',{regenerate:true,wealthPlan:scalePlan(0,484500000)}),/재력 기준/);
 assert.equal(globalThis.__investTest.inputs.length,4);assert.equal(JSON.stringify([m.finance,p.investment]),before);
});
test('missing bank FX cannot count as successful range validation',async()=>{
 const {m,p}=euroWallet();finance.migrateBank(m,p);const before=JSON.stringify([p.money,m.finance]);
 globalThis.__investTest.answer={currency:'EUR',bank:{name:'Bank',accounts:p.money.bank.accounts},cards:[],tx:[],passes:[],orders:[]};
 await assert.rejects(phonedata.fillMoney(m,p,{regenerateBalances:true,wealthPlan:scalePlan(13000,0,'USD')}),/재력 기준/);
 assert.equal(globalThis.__investTest.inputs.length,2);assert.match(globalThis.__investTest.inputs[1].input,/FX:EUR\/USD/);
 assert.equal(JSON.stringify([p.money,m.finance]),before);
});
test('bank correction can supply missing FX without changing existing rates',async()=>{
 const {m,p}=euroWallet();
 const candidate={currency:'EUR',bank:{name:'Bank',accounts:p.money.bank.accounts},cards:[],tx:[],passes:[],orders:[]};
 globalThis.__investTest.answers=[candidate,{...candidate,fx:[{from:'EUR',to:'USD',date:'2026-10-30',value:2}]}];
 await phonedata.fillMoney(m,p,{regenerateBalances:true,wealthPlan:scalePlan(26000,0,'USD')});
 assert.equal(globalThis.__investTest.inputs.length,2);assert.equal(finance.fx(m,'EUR','USD','2026-10-30'),2);
});
test('unpriced holdings fail valuation rather than becoming zero',async()=>{
 const {m,p}=setup();globalThis.__investTest.answer.quotes=[];
 await assert.rejects(dataMod.fillInvestment(m,p,'2026-10-30',{wealthPlan:scalePlan(0,950)}),/재력 기준/);
 assert.equal(globalThis.__investTest.inputs.length,2);assert.match(globalThis.__investTest.inputs[1].input,/STOCK:NYSE:X/);assert.equal(p.investment,undefined);
});
test('malformed wealth ranges are rejected before app generation',async()=>{
 const {readWealth}=await import(wealthURL);
 for(const plan of [{currency:'EUR',deposits:{min:100,max:1},investments:{min:0,max:0},basis:'x'},{currency:'EUR',deposits:{min:'1',max:2},investments:{min:0,max:0},basis:'x'}]) assert.throws(()=>readWealth(JSON.stringify(plan)),/재력 기준/);
});
test('first phone generation receives the preselected profile and keeps the binding',async()=>{
 const {m}=setup();const binding={type:'character',id:'a.png',label:'A'};m.phoneProfiles={a:binding,other:{type:'character',id:'b.png'}};
 globalThis.__investTest.context={characters:[{avatar:'a.png',description:'First generation owner background.'},{avatar:'b.png',description:'Other private background.'}]};
 globalThis.__investTest.answer={now:'10-30'};
 const p=await phonedata.makePhone(m,'A');assert.match(globalThis.__investTest.inputs[0].input,/First generation owner background/);assert.doesNotMatch(globalThis.__investTest.inputs[0].input,/Other private background/);
 assert.deepEqual(p.financeProfile,binding);assert.equal(m.phoneProfiles.a,undefined);assert.ok(m.phoneProfiles.other);
});
test('failed first generation retains the pending profile and creates no phone',async()=>{
 const {m}=setup();const binding={type:'character',id:'a.png'};m.phoneProfiles={a:binding};
 globalThis.__investTest.context={characters:[{avatar:'a.png',description:'Owner background.'}]};globalThis.__investTest.error=true;
 await assert.rejects(phonedata.makePhone(m,'A'),/network/);assert.deepEqual(m.phoneProfiles.a,binding);assert.equal(m.phones?.a,undefined);
});

test('saved negative credit total is recalculated from the six actual purchases without regeneration',()=>{
 const {m,p}=euroWallet();const a=p.money.bank.accounts[1];a.balance=-5418.30;a.spent=-5418.30;
 p.money.tx=[490,640,54.85,485,118.45,620].map((amount,i)=>({id:String(i),account:'5678',kind:'card',who:'Shop',amount:-amount,time:'10-25 10:00'}));
 const tx=structuredClone(p.money.tx);finance.migrateBank(m,p);assert.equal(a.spent,2408.30);assert.equal(a.refundCredit,0);assert.deepEqual(p.money.tx,tx);
 assert.match(moneyUI.bankAcct(p,'10-30','1'),/2,408.3/);assert.equal(finance.cash(m.finance.accounts['eur:EUR']),13000);
});
test('credit usage subtracts refunds but ignores repayments, other months and pending transactions',()=>{
 const {m,p}=euroWallet(),a=p.money.bank.accounts[1];
 p.money.tx=[{account:'5678',kind:'card',amount:-100,time:'10-20'},{account:'5678',kind:'card',amount:30,time:'10-21'},{account:'5678',kind:'transfer',amount:200,time:'10-22'},{account:'5678',kind:'card',amount:-900,time:'09-20'},{account:'5678',kind:'card',amount:-500,time:'10-22',pending:true}];
 finance.migrateBank(m,p);assert.equal(a.spent,70);
 p.money.tx.push({account:'5678',kind:'card',amount:100,time:'10-23'});finance.migrateBank(m,p);assert.equal(a.spent,0);assert.equal(a.refundCredit,30);
 const html=moneyUI.bankAcct(p,'10-30','1');assert.match(html,/이번 달 순환급/);assert.equal(finance.creditAmount(a),30);
});
