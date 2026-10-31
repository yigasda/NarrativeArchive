import {decisionEvidence,evidenceUnchanged} from './phoneevidence.js';
import {afterBoundary,fieldGroup} from './phoneread.js';
// Incremental updates: source window, event ledger, staged financial effects and local recovery.
import {finance, migrateBank, cash, finite, round, positions, fx} from './finance.js';
export const digest = async value => [...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(typeof value==='string'?value:JSON.stringify(value))))].map(x=>x.toString(16).padStart(2,'0')).join('');
export async function updateWindow(rows, previous, after = -1) {
    const hashes=await Promise.all(rows.map(digest));
    let start=Math.max(0,rows.length-12);
    if(previous) for(let i=0;i<rows.length;i++) if(previous[i]!==hashes[i]) {start=Math.min(start,i);break;}
    if(!previous&&after>=0){const i=rows.findIndex(r=>Number(/^\[#(\d+)/.exec(r)?.[1])>after);if(i>=0)start=Math.min(start,i);}
    return {text:rows.slice(start).join('\n\n'),hashes};
}
export const updateLocks=new WeakSet();
export const bundle=m=>structuredClone({phones:m.phones||{},finance:m.finance||null});
export function restoreBundle(m,b){m.phones=structuredClone(b.phones);if(b.finance)m.finance=structuredClone(b.finance);else delete m.finance;}
export async function recoverUpdate(m,scope,storage=localStorage,sourceContext=null){
    if(!scope)return;
    const key='narrativearchive:update:'+scope, raw=storage.getItem(key);if(!raw)return;
    const j=JSON.parse(raw), current=bundle(m);
    if(current.finance?.lastPhoneUpdate===j.id)return;
    const currentHash=await digest(current);
    if(!(j.checkpoints||[j.before]).includes(currentHash))throw new Error('미완료 폰 반영 기록과 현재 데이터가 달라요. 복구 기록을 보존했어요');
    if(sourceContext){
        const proofs=j.proofs||[];let start=proofs.findIndex(x=>x.before===currentHash);
        if(start<0){const at=proofs.findIndex(x=>x.after===currentHash);if(at>=0)start=at+1;}
        const valid=start>=0&&proofs.slice(start).every(x=>x.source&&x.source.archive===sourceContext.archive&&x.source.rows.every(([i,h])=>sourceContext.rows.some(([n,v])=>n===i&&h===v)));
        if(!valid){
            // Preserve the stale attempt for diagnosis, then re-read changed source from the persisted phone.
            storage.setItem(key+':superseded:'+j.id,raw);storage.removeItem(key);
            return {reprocess:true};
        }
    }
    restoreBundle(m,j.after);
}
export async function commitUpdate(m,next,scope,save,storage=localStorage,guard=()=>true,sourceContext=null){
    if(!scope)throw new Error('반영할 채팅을 확인하지 못했어요');
    const id=crypto.randomUUID();finance(next).lastPhoneUpdate=id;
    const after=bundle(next),before=await digest(bundle(m));
    const key='narrativearchive:update:'+scope,raw=storage.getItem?.(key),previous=raw?JSON.parse(raw):null;
    // The host can swallow HTTP errors. Keep every recoverable persisted state until a save can be verified.
    const checkpoints=new Set([before]),proofs=structuredClone(previous?.proofs||[]);
    if(previous){
        if(m.finance?.lastPhoneUpdate!==previous.id&&before!==await digest(previous.after))throw new Error('미완료 반영을 먼저 복구해 주세요');
        for(const hash of previous.checkpoints||[previous.before])checkpoints.add(hash);
        checkpoints.add(await digest(previous.after));
    }
    if(!guard())throw new Error('저장 전 채팅이나 데이터가 바뀌었어요');
    // Synchronous, before any live mutation. Quota errors leave the old phone intact.
    proofs.push({before,after:await digest(after),source:sourceContext});
    if(!guard())throw new Error('저장 전 채팅이나 데이터가 바뀌었어요');
    storage.setItem(key,JSON.stringify({version:3,id,before,checkpoints:[...checkpoints],proofs,after}));
    restoreBundle(m,after);
    await save(); // Keep journal: the host may swallow a failed HTTP save.
}
const dateOK=d=>/^\d{4}-\d{2}-\d{2}$/.test(d||'')&&!isNaN(Date.parse(d))&&new Date(d).toISOString().slice(0,10)===d;
const fail=s=>{throw new Error(s);};
const list=(x,name)=>x===undefined?[]:Array.isArray(x)?x:fail(`${name} 형식이 잘못됐어요`);
const text=x=>typeof x==='string'?x:'';
const legKey=(kind,x)=>kind==='cash'?kind+':'+x.account:kind==='trades'?kind+':'+x.account+':'+x.symbol+':'+x.kind+(x.fillIndex?':fill:'+x.fillIndex:''):kind+':'+(x.effectId||x.id||[x.shop,x.item,x.by,x.no].join('|'));
const sameLeg=(kind,a,b)=>kind==='cash'?a.amount===b.amount&&a.currency===b.currency:kind==='trades'?['quantity','price','fee','amount','currency'].every(k=>a[k]===b[k]):['price','qty','status'].every(k=>a[k]===b[k]);

// Stored hashes are scoped to owner + app + individual normalized item, not an entire event's app field.
const stableItem=value=>Array.isArray(value)?value.map(stableItem):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().filter(k=>!['id','ev','src','storyEvent','seen','img','via'].includes(k)).map(k=>[k,stableItem(value[k])])):value;
async function phoneItems(p,add,known,id,owner){
    const records=structuredClone(known?.phoneItems||{}),mine=records[owner]||={};
    for(const [field,rows]of Object.entries(add)){
        if(!fieldGroup[field])continue;
        const seen=new Set(mine[field]||[]);
        const take=async value=>{const key=await digest(stableItem(value));if(seen.has(key))return false;seen.add(key);return true;};
        if(field==='threads'){
            for(const t of p.threads||[])for(const msg of t.messages||[])if(msg.ev===id||t.ev===id)seen.add(await digest(stableItem({with:t.with,message:msg})));
            const threads=[];
            for(const t of rows||[]){const messages=[];for(const msg of t.messages||[])if(await take({with:t.with,message:msg}))messages.push({...msg,ev:id});if(messages.length)threads.push({...t,messages});}
            add[field]=threads;
        }else if(Array.isArray(rows)){
            for(const row of p[field]||[])if(row.ev===id)seen.add(await digest(stableItem(row)));
            const kept=[];for(const row of rows)if(await take(row))kept.push(row);add[field]=kept;
        }else if(rows&&typeof rows==='object'&&!await take(rows))add[field]=null;
        mine[field]=[...seen];
    }
    return records;
}
async function identifyItems(kind,rows,known,owner){
    const prior=known?.effects?.[kind]||[],used=new Set(),counts=new Map();
    for(const x of rows){
        delete x.effectId;x.owner=owner;
        if(x.id){const match=prior.find(y=>y.recordId===x.id&&y.owner===owner&&sameLeg(kind,y,x));if(match)x.effectId=match.effectId;continue;}
        const identity=kind==='orders'?[owner,x.shop,x.item,x.option||'',x.time||'']:[owner,x.kind,x.by,x.no,x.from,x.to,x.date,x.time,x.seat];
        const key=await digest(identity),n=counts.get(key)||0;counts.set(key,n+1);
        const match=prior.find((y,i)=>!used.has(i)&&(!y.owner||y.owner===owner)&&!y.id&&JSON.stringify(kind==='orders'?[y.shop,y.item,y.option||'',y.time||'']:[y.kind,y.by,y.no,y.from,y.to,y.date,y.time,y.seat])===JSON.stringify(identity.slice(1))&&sameLeg(kind,y,x));
        if(match){used.add(prior.indexOf(match));x.effectId=match.effectId||('legacy:'+prior.indexOf(match));match.effectId=x.effectId;}
        else x.effectId='item:'+key+':'+n;
        x.owner=owner;
    }
}

export function financialContext(m,owner){
    const p=Object.values(m.phones||{}).find(p=>p.owner===owner);
    return {money:p?.money||null,investment:p?.investment||null,accounts:Object.values(finance(m).accounts).filter(a=>a.owner===owner).map(a=>({key:`${a.id}:${a.currency}`,owner:a.owner,currency:a.currency,amount:a.owner===owner?cash(a):undefined})),bankAccountDirectory:Object.values(m.phones||{}).flatMap(p=>(p.money?.bank?.accounts||[]).filter(a=>a.kind!=='credit'||p.owner===owner).map(a=>({kind:a.kind,owner:p.owner,key:`${a.id}:${a.currency}`,currency:a.currency}))),wealthPlan:p?.wealthPlan||null,boundaries:Object.fromEntries(Object.values(m.phones||{}).map(p=>[p.owner,p.readState?.groups||{}])),events:Object.entries(finance(m).storyEvents||{}).filter(([,e])=>e.owners.includes(owner)).map(([id,e])=>({id,summary:e.summary,refs:e.refs,fingerprint:e.fingerprint,decision:e.decision,effects:e.effects,applications:e.applications,phoneItems:e.phoneItems}))};
}
export function prepareUpdate(m){const next=structuredClone(m);for(const p of Object.values(next.phones||{})){migrateBank(next,p);if(p.readState?.groups?.msg&&!p.readState.groups.voice){p.readState.groups.voice=structuredClone(p.readState.groups.msg);p.readState.done.voice=structuredClone(p.readState.done.msg||{});}}return next;}
// Model proposes effects, never totals. All mutations below happen on an isolated snapshot.
function numberEvents(events){
 const ordinals=new Map();
 for(const e of events){if(!e||typeof e!=='object')continue;const signature=JSON.stringify([e.sourceIndex,e.kind,e.refs]),ordinal=ordinals.get(signature)||0;ordinals.set(signature,ordinal+1);e.sourceEventIndex=ordinal;}
}
export async function applyEvents(next,owner,raw,source,parse,merge){
    if(!raw||!Array.isArray(raw.events))fail('사건별 반영 결과를 받지 못했어요');
    if(raw.events.length>1)numberEvents(raw.events);
    if(raw.unresolved?.length)fail('계좌·금액·사건 근거가 불명확해 반영하지 못했어요: '+raw.unresolved.map(x=>typeof x==='string'?x:x.reason).join(' / '));
    const p=Object.values(next.phones||{}).find(x=>x.owner===owner);if(!p)fail('폰을 찾지 못했어요');
    const f=finance(next);f.storyEvents||={};const changed=new Set();let count=0;
    for(const e of raw.events){
        if(!Array.isArray(e.refs)||!e.refs.length||e.refs.some(r=>typeof r!=='string'||!r.trim().length||!source.includes(r)))fail('사건의 원문 근거를 확인하지 못했어요');
        const effects={cash:list(e.cash,'현금'),trades:list(e.trades,'투자'),orders:list(e.orders,'주문'),passes:list(e.passes,'지갑')};
        const fingerprint=await digest({date:e.date,kind:e.kind,rate:e.rate,fee:e.fee,feeSide:e.feeSide,cash:effects.cash.map(x=>[x.account,x.amount,x.currency]).sort(),trades:effects.trades.map(x=>[x.symbol,x.kind,x.quantity,x.price,x.fee,x.amount,x.account]),orders:effects.orders.map(x=>[x.id,x.shop,x.item,x.status,x.price]),passes:effects.passes.map(x=>[x.id,x.by,x.no,x.status])});
        const fillCounts=new Map();
        effects.trades=effects.trades.map(t=>{const key=[t.account,t.symbol,t.kind].join('|'),fillIndex=fillCounts.get(key)||0;fillCounts.set(key,fillIndex+1);return {...t,fillIndex};});
        const financial=Object.values(effects).some(x=>x.length);
        const known=e.id&&f.storyEvents[e.id];
        for(const kind of ['orders','passes'])await identifyItems(kind,effects[kind],known,owner);
        if(known){
            if(!known.owners.includes(owner))fail('다른 인물의 사건 기록이에요');
            if(e.occurrence==='recalled'&&e.match==='existing')(known.mentions||=[]).push({refs:structuredClone(e.refs),sourceIndex:e.sourceIndex,reason:e.reason});
            if(!financial&&!Object.keys(e.phone||{}).length)continue;
            if(e.date!==known.date)fail('기존 사건의 날짜가 달라요');
            if(financial&&known.decision&&(e.kind!==known.kind||(e.fee||0)!==(known.decision.fee||0)||(e.rate||1)!==(known.decision.rate||1)||(e.feeSide||'')!==(known.decision.feeSide||'')))fail('기존 사건의 환율이나 수수료를 변경할 수 없어요');
            for(const [kind,rows]of Object.entries(effects))for(const x of rows){const old=(known.effects?.[kind]||[]).find(y=>legKey(kind,x)===legKey(kind,y));if(old&&!sameLeg(kind,old,x))fail('이미 반영한 사건의 금액이나 내용이 달라요');}
        }
        const recorded=(kind,x)=>!!known?.effects?.[kind]?.some(y=>legKey(kind,x)===legKey(kind,y));
        // Exact source reuse is deterministic; differently worded replays must explicitly reuse the stored id.
        const same=Object.entries(f.storyEvents).find(([,old])=>old.owners.includes(owner)&&old.fingerprint===fingerprint&&financial&&old.decision?.sourceIndex===e.sourceIndex&&(old.decision?.sourceEventIndex||0)===(e.sourceEventIndex||0));
        if(!known&&same&&e.refs.some(r=>same[1].refs.includes(r)))continue;
        const movements=[...effects.cash.map(x=>JSON.stringify(['cash',e.date,x.account,x.currency,x.amount])),...effects.trades.map(x=>JSON.stringify(['trade',e.date,x.account,x.symbol,x.kind,x.quantity,x.price,x.fee,x.amount]))];
        // Semantic identity is judged by the model; equal date/amount alone is not proof of duplication.
        const id=known?e.id:'story:'+await digest({owner,refs:[...e.refs].sort(),kind:e.kind,sourceIndex:e.sourceIndex,...(e.sourceEventIndex?{sourceEventIndex:e.sourceEventIndex}:{})});
        if(!known&&f.storyEvents[id]){if(financial&&f.storyEvents[id].fingerprint!==fingerprint)fail('같은 근거의 기존 사건과 금액이 달라요');continue;}
        if(!dateOK(e.date)||e.time&&!/^([01]\d|2[0-3]):[0-5]\d$/.test(e.time))fail('사건 날짜와 시각을 확인해 주세요');
        const owners=new Set(known?.owners||[owner]),applications=structuredClone(known?.applications||[]);
        if(!known&&e.occurrence==='recalled' && e.match==='existing'){f.storyEvents[id]={summary:text(e.summary),refs:e.refs,date:e.date,kind:e.kind,fingerprint,movements,owners:[owner],decision:structuredClone(e),effects,applications:[{mode:'existing',reason:e.reason}]};continue;}
        const cashRows=known&&e.kind==='transfer'?[...(known.effects?.cash||[]),...effects.cash.filter(x=>!recorded('cash',x))]:effects.cash;
        if(e.kind==='transfer'&&(cashRows.length<1||cashRows.length>2))fail('이체 계좌 연결을 확인하지 못했어요');
        if(cashRows.some(x=>!finite(x.amount)||x.amount===0))fail('거래 금액을 확인해 주세요');
        if(new Set(cashRows.map(x=>x.account)).size!==cashRows.length)fail('같은 사건에 계좌 효과가 중복됐어요');
        const targets=cashRows.map(x=>{
            const a=f.accounts[x.account],who=Object.values(next.phones).find(p=>p.owner===x.owner);
            const bank=who?.money?.bank?.accounts.find(b=>`${b.id}:${b.currency}`===x.account);
            const broker=who?.investment?.accounts.find(b=>b.key===x.account);
            if(!who||(!bank&&!broker)||bank?.currency!==undefined&&bank.currency!==x.currency||bank?.kind!=='credit'&&(!a||a.owner!==x.owner||a.currency!==x.currency))fail('계좌와 통화를 확인해 주세요');
            return {a,who,bank,broker};
        });
        if(targets.some(x=>x.who.owner!==owner)){
            if(e.kind!=='transfer'||cashRows.length!==2||!targets.some(x=>x.who.owner===owner)||targets.some(x=>!x.bank||x.bank.kind==='credit'))fail('다른 인물의 계좌는 연결된 이체만 반영할 수 있어요');
        }
        if(e.kind==='transfer'&&cashRows.some((x,i)=>targets[i].bank?.kind==='credit'))fail('신용카드는 이체 계좌로 사용할 수 없어요');
        if(e.kind==='transfer'&&cashRows.length===2){
            const from=cashRows.find(x=>x.amount<0),to=cashRows.find(x=>x.amount>0);
            if(!from||!to)fail('이체 양쪽 금액을 확인해 주세요');
            const fee=e.fee??0;if(!finite(fee)||fee<0||fee>0&&!['sender','receiver'].includes(e.feeSide))fail('이체 수수료 정보가 잘못됐어요');
            const sent=-from.amount-(e.feeSide==='sender'?fee:0),received=to.amount+(e.feeSide==='receiver'?fee:0);if(sent<=0||received<=0)fail('이체 원금이 잘못됐어요');
            if(from.currency===to.currency&&round(sent)!==round(received))fail('같은 통화의 이체 금액이 달라요');
            if(from.currency!==to.currency&&(!finite(e.rate)||e.rate<=0||Math.abs(round(sent*e.rate)-received)>.01))fail('환전 이체의 실제 환율과 금액이 필요해요');
        }
        for(let i=0;i<cashRows.length;i++){
            const x=cashRows[i],{a,who,bank,broker}=targets[i];owners.add(who.owner);if(recorded('cash',x))continue;
            const group=broker?'invest':'money', included=x.inclusion==='existing';
            if(included){applications.push({account:x.account,amount:x.amount,mode:'included',reason:x.reason||e.reason});continue;}
            applications.push({account:x.account,amount:x.amount,mode:'applied'});
            if(broker){if(e.kind!=='transfer')fail('증권 현금 변경은 이체나 투자 거래로 기록해 주세요');a.entries[id+':cash:'+x.account]={amount:round(x.amount),date:e.date};if(cash(a)<-.01)fail('증권 현금이 부족해요');changed.add('투자');continue;}
            who.money.tx||=[];
            // Existing snapshots already include legacy transactions. Ambiguous matches must not replay cash.

            if(bank.kind!=='credit'){a.entries[id+':cash:'+x.account]={amount:round(x.amount),date:e.date};if(cash(a)<-.01)fail('거래 후 잔액이 부족해요');}
            who.money.tx.push({id:id+':cash:'+x.account,storyEvent:id,ev:id,account:bank.last4,currency:x.currency,amount:round(x.amount),date:e.date,time:e.date.slice(5)+(e.time?' '+e.time:''),kind:bank.kind==='credit'?'card':e.kind==='transfer'?'transfer':x.amount>0?'deposit':'card',who:text(x.who),ko:text(x.ko),memo:text(x.memo),pending:false});
            changed.add('은행');if(bank.kind==='credit')changed.add('지갑');
        }
        if(e.kind==='transfer'&&cashRows.length===2&&cashRows.some(x=>!recorded('cash',x))){const from=cashRows.find(x=>x.amount<0),to=cashRows.find(x=>x.amount>0);f.transfers[id]={id,date:e.date,from:from.account,to:to.account,sent:-from.amount-(e.feeSide==='sender'?(e.fee||0):0),received:to.amount+(e.feeSide==='receiver'?(e.fee||0):0),fee:e.fee||0,feeSide:e.feeSide,feeCurrency:e.feeSide==='receiver'?to.currency:from.currency,rate:e.rate||1,storyEvent:id};}
        for(let i=0;i<effects.trades.length;i++){
            const t=effects.trades[i];if(recorded('trades',t))continue;
            if(t.inclusion==='existing'){applications.push({symbol:t.symbol,mode:'included',reason:t.reason||e.reason});continue;}
            const inv=p.investment;if(!inv)fail('투자 계좌가 아직 없어요');
            if(!['buy','sell','dividend'].includes(t.kind)||!text(t.symbol))fail('투자 거래 종류나 종목이 잘못됐어요');
            const a=f.accounts[t.account];if(!inv.accounts.some(x=>x.key===t.account)||!a||a.owner!==owner||a.currency!==t.currency)fail('투자 거래 통화와 계좌가 맞지 않아요');
            if(!inv.securities.some(s=>s.symbol===t.symbol&&s.currency===t.currency)){
                if(!t.name)fail('새 종목의 이름과 거래소 코드가 필요해요');
                inv.securities.push({symbol:t.symbol,name:t.name,ko:text(t.ko),currency:t.currency});
            }
            const trade={...t,id:id+':'+legKey('trades',t),date:e.date,time:e.time||'',sourceIndex:e.sourceIndex,source:e.amountSource==='generated'?'guess':'story',storyEvent:id,rateAtTrade:fx(next,t.currency,inv.base,e.date)};
            positions([...inv.trades,trade]);
            const amount=t.kind==='buy'?-(t.quantity*t.price+t.fee):t.kind==='sell'?t.quantity*t.price-t.fee:t.amount;
            if(!finite(amount))fail('투자 거래 금액이 잘못됐어요');
            a.entries[trade.id]={amount:round(amount),date:e.date};if(cash(a)<-.01)fail('투자 거래에 필요한 현금이 부족해요');
            inv.trades.push(trade);applications.push({trade:trade.id,mode:'applied',amount});inv.date=inv.date>e.date?inv.date:e.date;changed.add('투자');
        }
        const newPaidOrders=effects.orders.filter(x=>x.inclusion!=='existing'&&!x.id&&x.paid!==false&&!recorded('orders',x));
        if(newPaidOrders.length){
            const allCash=[...(known?.effects?.cash||[]),...effects.cash.filter(x=>!recorded('cash',x))];
            const payment=round(allCash.filter(c=>c.owner===owner&&c.currency===p.money?.currency&&c.amount<0).reduce((sum,c)=>sum-c.amount,0));
            const priorOrders=(known?.effects?.orders||[]).filter(x=>x.inclusion!=='existing'&&!x.id&&x.paid!==false);
            const allOrders=[...priorOrders,...newPaidOrders];
            if(allOrders.some(x=>!Number.isInteger(x.qty)||x.qty<=0||!finite(x.price)||x.price<0)||round(allOrders.reduce((sum,x)=>sum+x.qty*x.price,0))!==payment)fail('주문 합계와 연결된 결제 금액이 맞지 않아요');
        }
        for(const kind of ['orders','passes'])for(const x of effects[kind]){
            if(recorded(kind,x))continue;
            if(x.inclusion==='existing'){const matches=(p.money?.[kind]||[]).filter(row=>x.id?row.id===x.id:kind==='orders'?row.shop===x.shop&&row.item===x.item&&(row.option||'')===(x.option||'')&&row.qty===x.qty&&row.price===x.price:row.by===x.by&&row.kind===x.kind&&row.no===x.no);if(matches.length!==1)fail('이미 포함된 주문·티켓을 현재 내역에서 다시 대조해야 해요');x.recordId=matches[0].id;applications.push({record:x.recordId,mode:'included'});continue;}
            if(!p.money)fail('은행·지갑·쇼핑 데이터가 아직 없어요');
            p.money[kind]||=[];const old=x.id&&p.money[kind].find(y=>y.id===x.id);
            if(x.id&&!old)fail('변경할 주문·티켓을 찾지 못했어요');
            if(kind==='orders'&&x.status&&!['ordered','shipped','on the way','delivered','unknown','cancelled','returned','refunded','returning'].includes(x.status))fail('주문 상태가 잘못됐어요');
            const allowed=kind==='orders'?['shop','item','ko','option','qty','price','time','status','eta','arrived','gift','paid']:['kind','by','from','to','date','time','seat','gate','no','status'];
            const record=Object.fromEntries(allowed.filter(k=>x[k]!==undefined).map(k=>[k,x[k]]));
            if(!old&&kind==='orders'&&(!x.shop||!x.item||!finite(x.price)||x.price<0))fail('새 주문의 상점·품목·금액이 필요해요');
            if(!old&&kind==='passes'&&(!x.by||!x.kind))fail('새 티켓 정보가 부족해요');
            const stateOrder=e.date+' '+(e.time||'')+' '+String(e.sourceIndex??0).padStart(12,'0');
            if(old?._stateOrder && old._stateOrder>stateOrder)continue;
            if(old&&!old._stateOrder){
                const sequence=['ordered','shipped','on the way','delivered'];
                if(sequence.includes(old.status)&&sequence.includes(x.status)&&sequence.indexOf(x.status)<sequence.indexOf(old.status))continue;
                if(['cancelled','returned','refunded'].includes(old.status)&&sequence.includes(x.status))continue;
            }
            record._stateOrder=stateOrder;
            if(old){Object.assign(old,record);x.recordId=old.id;}else {x.recordId=id+':'+kind+':'+x.effectId;p.money[kind].push({...record,id:x.recordId,ev:id,storyEvent:id});}
            changed.add(kind==='orders'?'쇼핑':'지갑');
        }
        let itemRecords=structuredClone(known?.phoneItems||{});
        if(e.phone){
            const eligible=Object.fromEntries(Object.entries(e.phone).filter(([k])=>afterBoundary(p,fieldGroup[k],e.sourceIndex)));
            const add=parse(JSON.stringify(eligible));
            itemRecords=await phoneItems(p,add,known,id,owner);
            const names={threads:'문자',calls:'통화',photos:'사진',notes:'메모',searches:'검색',events:'캘린더',posts:'SNS',mails:'메일',diary:'일기',voice:'음성 메모',contacts:'연락처',profile:'SNS'};
            const before=Object.fromEntries(Object.keys(names).map(k=>[k,JSON.stringify(p[k])]));
            for(const k of Object.keys(names))if(Array.isArray(add[k]))for(const row of add[k]){row.ev=id;if(e.amountSource==='generated'||known?.decision?.amountSource==='generated'){row.src='guess';for(const msg of row.messages||[])msg.src='guess';}}
            delete add.now;merge(p,add,{preserveHistory:true});
            for(const [k,label]of Object.entries(names))if(JSON.stringify(p[k])!==before[k])changed.add(label);
        }
        const combined=Object.fromEntries(Object.entries(effects).map(([kind,rows])=>[kind,[...(known?.effects?.[kind]||[]),...rows.filter(x=>!recorded(kind,x))]]));
        f.storyEvents[id]={summary:text(e.summary),refs:[...new Set([...(known?.refs||[]),...e.refs])],date:e.date,kind:e.kind,fingerprint:known?.fingerprint||fingerprint,movements:[...new Set([...(known?.movements||[]),...movements])],owners:[...owners],decision:structuredClone(known?.decision||e),mentions:known?.mentions||[],phoneItems:itemRecords,decisions:[...(known?.decisions|| (known?[known.decision]:[])),structuredClone(e)],effects:combined,applications,phoneFields:[...new Set([...(known?.phoneFields||[]),...Object.keys(e.phone||{}).filter(k=>afterBoundary(p,fieldGroup[k],e.sourceIndex))])]};count++;
    }
    if(raw.now!==undefined&&raw.now!==''&&!/^\d{2}-\d{2} ([01]\d|2[0-3]):[0-5]\d$/.test(raw.now))fail('현재 이야기 시각 형식이 잘못됐어요');
    if(raw.now&&(!p.now||raw.now>p.now))p.now=raw.now;
    for(const who of Object.values(next.phones))migrateBank(next,who);
    return {count,apps:[...changed]};
}
export const UPDATE_EVENTS = `GOAL
Reflect newly supplied story events in one character's existing phone. Return changes, not new balances. The app does the arithmetic.

YOU GET
- RECENT CHAT: selected messages, numbered by sourceIndex.
- ARCHIVE EVIDENCE IN SELECTED RANGE: eligible sections, each with sourceId and eligibleIndices. Other archive text is background.
- PHONE NOW, financial apps and saved events: what is already represented, possibly including later events.
- OWNER, background and sometimes a wealth plan. Background explains the person; it does not make an event happen. Only what the owner knows may appear on their phone.

ONE EVENT, ONCE
- Use selected chat or eligible archive evidence. A completed archive section can repeat earlier events; compare before adding. Use its eligibleIndices, even if already read. Never move an older event past an app's creation boundary to make it eligible.
- Separate actual events from plans, guesses and recollections. Compare dates, people, purpose and existing records, not the phone clock or amount alone.
- Reuse a saved event id for the same event. Keep its financial effects unchanged; return only missing app items for this owner. A recollection is not another payment, call or message.
- Separate distinct events even within one sentence, in source order. Quote the source exactly in refs. Chat uses sourceType:"chat" and a selected message's sourceIndex; archive uses sourceType:"archive", sourceId and an eligible sourceIndex.
- Give each event a date (YYYY-MM-DD), kind, summary, occurrence (new|recalled), match (new|existing) and short reason. An unchanged event has no effects.

AMOUNTS
- Keep stated amounts, currencies and execution prices. For an actual transaction with missing figures, choose plausible values from the scene and saved wealth plan. Mark amountSource:"generated" and list inferred paths in generatedFields; otherwise use "explicit". Do not invent the event.
- Use one consistent amount across its payment, order and other app records. Nationality does not decide an account's currency.
- Each financial leg has inclusion:"existing" if already represented in that app, or "new" otherwise, with a reason and existing record id when available. Compare records and app boundaries separately for each leg; a boundary alone proves no inclusion.
- A later correction to a saved amount is not another payment. Keep the saved event and report the correction in unresolved.

CASH AND TRADES
- cash: {owner,account,currency,amount,who,ko,memo,inclusion,reason}. Use an existing account's exact ledger key and signed amount. Purchases are negative, refunds positive. Credit purchases do not debit bank cash; authorizations are not completed payments. Card repayment is not a refund.
- Transfers between supplied accounts have both legs in one event. An external counterparty has only the known leg. Other owners' accounts are allowed only for a bank transfer involving OWNER; routing data is not the owner's knowledge.
- Transfer amounts include fees. Supply fee and feeSide (sender|receiver) when applicable; rate is received principal / sent principal before fees. Missing amounts or rates may be inferred together and marked generated.
- trades: {account,kind,symbol,currency,quantity,price,fee,amount,name,ko,inclusion,reason}. Use the brokerage key; kind is buy|sell|dividend. Buy/sell uses quantity, price and fee; dividend uses amount. Executions belong here, not in cash. Do not generate public market quotes.

ORDERS AND PASSES
- Use the existing record schema. Reuse recordId as id for an existing item; omit id for a new one. Keep distinct options and times.
- A new order has integer qty, unit price in money.currency and paid:true|false. A paid new order includes its cash/card effect in the same event. Mark inferred conversion values generated.
- Delivery has no new charge. Cancellation alone is not a refund. Do not move a later order state backwards when reading an earlier event.

RETRY
- REVIEW STORED DECISIONS contains failed attempts. Return reviews:[{key,events:[event]}], not duplicates in events. Recheck current records after regeneration; account links and inclusion may change, but saved amounts, currencies, quantities, fees, refs and sourceIndex stay fixed.
- A review without a prior decision can resolve its stored source and infer missing figures once. If no event occurred, return {key,resolution:"not_event",reason}. Leave an unresolved review out; it stays saved.
- Do not create missing apps, cash or holdings to force a calculation. Do not change baselines, the wealth plan or another owner's investments. Report missing accounts or required corrections in unresolved.

ANSWER — one JSON object, nothing else:
{"now":"MM-DD HH:MM","events":[{"id":"saved id; omit for new","date":"YYYY-MM-DD","kind":"transfer|payment|refund|trade|order|pass|story","sourceType":"chat|archive","sourceId":"archive id when used","sourceIndex":123,"occurrence":"new|recalled","match":"new|existing","reason":"short explanation","amountSource":"explicit|generated","generatedFields":["cash[0].amount"],"summary":"short description","refs":["exact excerpt"],"phone":{},"cash":[],"trades":[],"orders":[],"passes":[]}],"unresolved":[],"reviews":[]}`;

// Stage each event independently. Connected legs stay atomic; valid unrelated events can commit.
export const generationBasis=m=>JSON.stringify({phones:Object.values(m.phones||{}).map(p=>[p.owner,p.money?.at,p.investment?.at,p.readState?.groups?.money,p.readState?.groups?.invest]),accounts:Object.entries(finance(m).accounts).map(([k,a])=>[k,a.amount,a.asOf])});
const fixedMoney=e=>JSON.stringify({cash:(e.cash||[]).map(x=>[x.amount,x.currency]).sort(),trades:(e.trades||[]).map(x=>[x.kind,x.symbol,x.currency,x.quantity,x.price,x.fee,x.amount]).sort(),orders:(e.orders||[]).map(x=>[x.price,x.qty]).sort(),rate:e.rate,fee:e.fee,feeSide:e.feeSide});
function numbers(m,owner){
 const p=Object.values(m.phones||{}).find(x=>x.owner===owner),out={};
 for(const [key,a]of Object.entries(finance(m).accounts))if(a.owner===owner)out['cash:'+key]={kind:'cash',key,currency:a.currency,value:cash(a)};
 for(const a of p.money?.bank?.accounts||[])if(a.kind==='credit')out['card:'+a.id]={kind:'card',key:a.id,currency:a.currency,value:a.spent||0};
 for(const h of positions(p.investment?.trades||[]))out['holding:'+h.symbol]={kind:'holding',key:h.symbol,currency:h.currency,value:h.quantity,average:h.average,realized:h.realized};
 return out;
}
export async function applyBatch(next,owner,raw,source,parse,merge,indices,context){
 if(!raw||!Array.isArray(raw.events))throw Error('사건별 응답을 받지 못했어요');
 numberEvents(raw.events);
 const f=finance(next);f.updatePending||={};
 const basis=generationBasis(next),failures=[],changes=[],apps=new Set();let count=0;
 const jobs=Object.entries(f.updatePending).filter(([,x])=>x.owner===owner).map(([key,x])=>({key,...x}));
 // Reviews may relink accounts/inclusion, but cannot resample a previously determined amount.
 for(const review of raw.reviews||[]){
  try {
  const job=jobs.find(x=>x.key===review.key);if(!job)throw Error('재검토할 사건을 찾지 못했어요');
  if(context&&!evidenceUnchanged(job,context)){failures.push({summary:'사건 재검토',error:'원문이나 채팅이 바뀌었어요'});continue;}
  if(review.resolution==='not_event'&&job.reviewOnly&&text(review.reason)){
   (f.reviewDecisions||={})[job.key]={...job,resolution:review.resolution,reason:review.reason};delete f.updatePending[job.key];jobs.splice(jobs.indexOf(job),1);continue;
  }
  const events=review.events;if(!Array.isArray(events)||!events.length)continue;
  if(!job.reviewOnly&&(events.length!==1||fixedMoney(job.e)!==fixedMoney(events[0])||job.e.sourceIndex!==events[0].sourceIndex||JSON.stringify(job.e.refs)!==JSON.stringify(events[0].refs))){failures.push({summary:'사건 재검토',error:'저장한 금액이나 사건 근거를 변경할 수 없어요'});continue;}
  const allowed=job.reviewOnly?job.indices:[job.e.sourceIndex];
  const replacements=[];
  if(job.reviewOnly)numberEvents(events);
  for(const e of events){
   if(!allowed.includes(e.sourceIndex)||!text(e.reason)||!['explicit','generated'].includes(e.amountSource))throw Error('재검토 결과의 사건 근거가 부족해요');
   const reviewContext=context?{...context,selectedChatIndices:undefined,archive:context.archive?.filter(s=>(job.archiveIds||[job.evidence?.id]).includes(s.id))}:undefined;
   const evidence=context?decisionEvidence(e,reviewContext,allowed):undefined;
   if(!job.reviewOnly&&job.evidence&&(evidence?.type!==job.evidence.type||evidence?.id!==job.evidence.id))throw Error('저장한 사건 출처를 변경할 수 없어요');
   if(!job.reviewOnly){e.sourceEventIndex=job.e.sourceEventIndex||0;e.amountSource=job.e.amountSource;e.generatedFields=structuredClone(job.e.generatedFields||[]);}
   replacements.push({key:job.reviewOnly?await digest({owner,refs:e.refs,kind:e.kind,sourceIndex:e.sourceIndex,...(e.sourceEventIndex?{sourceEventIndex:e.sourceEventIndex}:{})}):job.key,owner,e,source:job.source,scope:job.scope,evidence,sourceHash:context?.rows.find(x=>x.index===e.sourceIndex)?.hash,basis,reviewed:true,previousDecision:job.e||job.issue});
  }
  (f.reviewDecisions||={})[job.key]={...job,resolution:'relinked',decisions:events};delete f.updatePending[job.key];jobs.splice(jobs.indexOf(job),1,...replacements);
  } catch(error) {failures.push({summary:'사건 재검토',error:error.message});}
 }
 for(const e of raw.events){
  try {
  if(!Number.isInteger(e.sourceIndex)||!indices.includes(e.sourceIndex))throw Error('선택한 본문 밖의 사건이에요');
  if(!['explicit','generated'].includes(e.amountSource)||!text(e.reason))throw Error('금액 출처와 사건 판단 근거가 필요해요');
  const evidence=context?decisionEvidence(e,{...context,archive:context.selectedArchive||context.archive},indices):undefined;
  const key=await digest({owner,refs:e.refs,kind:e.kind,sourceIndex:e.sourceIndex,...(e.sourceEventIndex?{sourceEventIndex:e.sourceEventIndex}:{})});
  if(!jobs.some(x=>x.key===key))jobs.push({key,owner,e,source,scope:context?.scope,evidence,sourceHash:context?.rows.find(x=>x.index===e.sourceIndex)?.hash,basis});
  } catch(error) {(raw.unresolved||=[]).push({reason:error.message,response:e});}
 }
 for(const issue of raw.unresolved||[]){
  if(!indices.length){failures.push({summary:'사건 재검토',error:typeof issue==='string'?issue:issue.reason||'아직 해결되지 않았어요'});continue;}
  const key=await digest({owner,issue,indices});
  if(!jobs.some(x=>x.key===key))jobs.push({key,owner,issue,reviewOnly:true,source,indices,scope:context?.scope,archiveIds:context?.selectedArchive?.map(x=>x.id),archiveHashes:context?.selectedArchive?.map(x=>[x.id,x.hash]),sourceHashes:context?.rows.filter(x=>indices.includes(x.index)).map(x=>[x.index,x.hash]),basis});
 }
 jobs.sort((a,b)=>String(a.e?.date||'').localeCompare(String(b.e?.date||''))||(a.e?.time||'').localeCompare(b.e?.time||'')||(a.e?.sourceIndex||0)-(b.e?.sourceIndex||0));
 for(const job of jobs){
  const staged=structuredClone(next);
  try{
   if(context&&!evidenceUnchanged(job,context))throw Error('저장된 사건의 채팅이나 본문이 바뀌어 재적용하지 않았어요');
   if(job.reviewOnly)throw Error(typeof job.issue==='string'?job.issue:job.issue.reason||'사건을 다시 대조해야 해요');
   if(job.basis&&job.basis!==basis)throw Error('앱이 다시 생성되어 현재 내역과 재대조해야 해요');
   const before=numbers(staged,owner),r=await applyEvents(staged,owner,{events:[job.e]},job.source,parse,merge),after=numbers(staged,owner);
   delete finance(staged).updatePending[job.key];restoreBundle(next,bundle(staged));
   r.apps.forEach(a=>apps.add(a));count+=r.count;
   for(const key of new Set([...Object.keys(before),...Object.keys(after)])){
    const a=before[key],b=after[key],amount=round((b?.value||0)-(a?.value||0));
    if(amount||a?.average!==b?.average||a?.realized!==b?.realized)changes.push({...b||a,summary:job.e.summary||job.e.kind,amount,before:a?.value||0,after:b?.value||0,averageBefore:a?.average,averageAfter:b?.average,realizedBefore:a?.realized,realizedAfter:b?.realized});
   }
  }catch(err){const {key,...saved}=job;finance(next).updatePending[key]={...saved,error:err.message};failures.push({summary:job.e?.summary||job.e?.kind||'확인하지 못한 사건',error:err.message});}
 }
 const p=Object.values(next.phones).find(p=>p.owner===owner);
 if(raw.now&&/^\d{2}-\d{2} ([01]\d|2[0-3]):[0-5]\d$/.test(raw.now)&&raw.now>(p.now||''))p.now=raw.now;
 return {count,apps:[...apps],failures,changes};
}
