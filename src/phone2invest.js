// 폰 2(실시간)의 투자 앱: 투자 채우기 · 다시 만들기, 시세 업데이트, 기록 · 노트 모으기, 차트 시세, 은행 환율, 평가 날짜.
// investdata.js의 같은 함수를 줄 그대로 옮긴 것이고, 다른 곳은 이것뿐이에요.
//   요청 뼈대 · 읽은 자리 · 두 번째 차례: 실시간 것 (phone2req.js). 롤플은 시작한 곳까지만, 읽은 자리는 메신저 번호
//   폰의 지금: 채우기는 폰에 저장된 시각, 평가 날짜(화면)는 서랍의 흐르는 시계
//   자산 준비: 실시간 것 (phone2fill.js)
// 폰 1 파일은 여기서 읽기만 해요.
import { wealthBlock, wealthCheck, investmentWealthRows } from './wealth.js';
import { ctx, saveMeta } from './core.js';
import { syncOf, makeMark, exclusive } from './phonesync.js';
import { phoneChatScope } from './phonestory.js';
import { baseline, reviseBaseline, cash, currency, finance, finite, uid, positions, migrateBank, fx, price, quoteKey } from './finance.js';
import { askDraft, readNote, turnsNote, soFarHead } from './phonedata.js';
import { json, list, text, CHART_SYS, MARKET_SYS, INVEST_SYS, INVEST_REBUILD, INVEST_NOTES_SYS, INVEST_RECORDS_SYS, securityOf, tradeOf, moved, stakesOf, watchOf, investmentTargets, parseInvestmentRecords, mergeInvestmentRecords, chartDates, ingestQuotes, validDate } from './investdata.js';
import { liveSideRequest, liveReadMark, liveSecondTurn, liveTold, liveSavedNow, needLive } from './phone2req.js';
import { livePrepareWealth } from './phone2fill.js';
import { liveNowText } from './phone2store.js';

export function liveInvestmentDate(m, p) {
    needLive(m);
    if (validDate(p.investment?.date)) return p.investment.date;
    // the phone's year (never a guess from the dates the archive writes), on the story's day where an investment fill would
    // stop reading (now, when it reads to the end)
    const day = String(liveNowText(m, p) || '').slice(0, 5), year = p.noYear ? '' : p.year ? String(p.year) : '';
    // (a story with no year of its own: valued at the prices of the day it was first valued, that day kept on the brokerage)
    const date = p.noYear ? new Date().toISOString().slice(0, 10) : year && day ? `${year}-${day}` : '';
    if (p.noYear && p.investment && validDate(date)) p.investment.date = date;
    return validDate(date) ? date : '';
}
function liveLaterDate(p, gap, date) {
    const d = String(liveSavedNow(p) || '').slice(0, 5);
    if (!/^\d{2}-\d{2}$/.test(d)) return date;
    const y = Number(date.slice(0, 4));
    let c = `${y}-${d}`;
    if (c < date && d.startsWith('01') && date.slice(5, 7) === '12') c = `${y + 1}-${d}`;
    return validDate(c) && c > date ? c : date;
}
async function liveInvestMore(m, p, raw1, two, plan) {
    needLive(m);
    const inv = p.investment, date = liveLaterDate(p, two.cover, inv.date);
    const soFar = { base: raw1.base, securities: raw1.securities, trades: raw1.trades, watch: raw1.watch, stakes: raw1.stakes };
    const only = 'The opening cash and "base" stay as they are: leave "cash" and "base" out. A share first bought in RECENT CHAT' + (two.short ? ' or TOLD SHORT' : '') + ' goes in "securities". "quotes" for every share held on DATE and "fx" on DATE are needed again, as DATE is new';
    const input = await liveSideRequest(m, p.owner, [`[DATE]\n${date}`, `[BANK — separate locked balances]\n${JSON.stringify(p.money?.bank || {})}`,
        `[EXISTING PUBLIC PRICES]\n${JSON.stringify(Object.fromEntries(Object.entries(finance(m).prices).map(([k, book]) => [k, book[date]])))}`,
        `${soFarHead('INVESTMENTS', two.short, only)}\n${JSON.stringify(soFar)}`, two.short?.text || ''], { profile: p.financeProfile, money: true, read: { gap: two.cover } });
    const before = JSON.stringify([m.finance, p.investment]);
    const raw = json(await askDraft(input, { force: true, system: INVEST_SYS, maxTokens: 12000 }));
    if (JSON.stringify([m.finance, p.investment]) !== before) throw new Error('생성 중 금융 정보가 변경됐어요');
    const securities = [...inv.securities];
    for (const x of list(raw.securities).map(securityOf)) if (x.symbol && x.name && x.currency && securities.length < 10 && !securities.some(y => y.symbol === x.symbol)) securities.push(x);
    // a trade told again (the same kind, share, day and quantity) is the one there
    const same = (a, b) => a.kind === b.kind && a.symbol === b.symbol && a.date === b.date && a.quantity === b.quantity;
    const fresh = list(raw.trades).slice(0, 30).map(tradeOf).filter(t => !inv.trades.some(o => same(o, t)));
    for (const t of fresh) if (!validDate(t.date) || t.date > date || !securities.some(s => s.symbol === t.symbol && s.currency === t.currency)) throw new Error('거래 날짜나 종목 통화가 맞지 않아요');
    const trades = [...inv.trades, ...fresh].sort((a, b) => String(a.date).localeCompare(String(b.date)));
    positions(trades); // rejects overselling before any mutation
    const scratch = { finance: structuredClone(finance(m)) };
    for (const t of fresh) {
        const acc = inv.accounts.find(a => a.currency === t.currency), a = acc && scratch.finance.accounts[acc.key];
        if (!a) throw new Error('거래 통화의 현금 계좌가 없어요');
        a.entries[t.id] = { amount: moved(t), date: t.date };
    }
    if (inv.accounts.some(a => cash(scratch.finance.accounts[a.key]) < -0.01)) throw new Error('더한 거래에 필요한 현금이 부족해요');
    ingestQuotes(scratch, raw, input, date, securities);
    for (const t of fresh) t.rateAtTrade = fx(scratch, t.currency, inv.base, t.date);
    // the app shows the holdings at DATE's prices: a new DATE needs a price for every share held and a rate for every
    // other currency on it, and a new foreign trade its rate (its cost is kept at that rate for good); else only turn 1 stays
    const held = positions(trades).filter(h => h.quantity > 1e-9);
    if (date !== inv.date && (held.some(h => { const q = price(scratch, `STOCK:${h.symbol}`, date); return !q || q.stale; })
        || [...new Set([...inv.accounts.map(a => a.currency), ...held.map(h => h.currency)])].some(c => c !== inv.base && fx(scratch, c, inv.base, date) == null))) throw new Error('새 날짜의 시세 · 환율이 없어요');
    if (fresh.some(t => t.currency !== inv.base && !finite(t.rateAtTrade))) throw new Error('새 거래의 환율이 없어요');
    const stakes = [...inv.stakes, ...stakesOf(raw, input).filter(x => !inv.stakes.some(y => y.company.toLowerCase() === x.company.toLowerCase()))].slice(0, 8);
    const watch = [...inv.watch, ...watchOf(raw, securities).filter(x => !inv.watch.some(y => y.symbol === x.symbol))].slice(0, 8);
    m.finance = scratch.finance;
    p.investment = { ...inv, securities, trades, stakes, watch, date, generatedDates: [...new Set([...inv.generatedDates, date])] };
    return raw;
}
export const liveFillInvestment = (m, p, date, opts = {}) => exclusive('fill', () => liveMakeInvestment(m, p, date, opts));
async function liveMakeInvestment(m, p, date, {regenerate = false, wealthPlan = null} = {}) {
    needLive(m);
    const chat = ctx()?.chat || [], read = {}, mark0 = makeMark(chat, chat.length - 1);
    let mark = mark0;
    const old = p.investment;
    if (old && !regenerate) throw new Error('기존 투자 기록은 보존돼요. 시세 갱신을 사용해 주세요');
    if (!validDate(date)) throw new Error('이야기 날짜를 YYYY-MM-DD로 입력해 주세요');
    const plan = wealthPlan || await livePrepareWealth(m,p,regenerate);
    if (!old) migrateBank(m, p);
    const oldKeys = new Set((old?.accounts || []).map(a=>a.key));
    const oldTradeIds = new Set((old?.trades || []).map(t=>t.id));
    const preserved = [...oldKeys].map(key=>{
        const a=finance(m).accounts[key];
        if(!a || a.owner!==p.owner) throw new Error('기존 투자 계좌를 확인하지 못했어요');
        if(Object.values(m.phones || {}).some(other=>other!==p && other.investment?.accounts?.some(x=>x.key===key))) throw new Error('다른 폰과 연결된 투자 계좌를 확인해 주세요');
        const entries=Object.fromEntries(Object.entries(a.entries).filter(([id])=>!oldTradeIds.has(id) || finance(m).transfers[id]));
        return {...a,entries};
    });
    finance(m);
    const snapshot = () => JSON.stringify([m.finance,p.investment,p.money,p.financeProfile]);
    const before = snapshot();
    const rebuild = old ? `[REBUILD]\n${JSON.stringify([...new Set(preserved.map(a=>a.currency))])}\n[MONEY ALREADY MOVED]\n${JSON.stringify(preserved)}` : '';
    const input = await liveSideRequest(m, p.owner, [`[DATE]\n${date}`, `[BANK — separate locked balances]\n${JSON.stringify(p.money?.bank || {})}`, rebuild,wealthBlock(plan,'investments'),`[EXISTING PUBLIC PRICES]\n${JSON.stringify(Object.fromEntries(Object.entries(finance(m).prices).map(([k,book])=>[k,book[date]])))}`], {profile:p.financeProfile,money:true,read});
    mark = liveReadMark(read.gap) || mark;
    let correction='';
    for(let attempt=0;attempt<2;attempt++) {
        const raw = json(await askDraft(input+'\n'+correction, { force: true, system: INVEST_SYS + (old ? INVEST_REBUILD : ''), maxTokens: 12000 }));
        if (p.investment!==old || snapshot()!==before || m.phones && !Object.values(m.phones).includes(p)) throw new Error('생성 중 금융 정보가 변경됐어요. 다시 시도해 주세요');
        if (!currency(raw.base)) throw new Error('기준 통화를 확인하지 못했어요');
        const securities = list(raw.securities).slice(0, 10).map(securityOf).filter(s => s.symbol && s.name && s.currency);
        if (new Set(securities.map(s => s.symbol)).size !== securities.length) throw new Error('중복 종목이 있어요');
        const trades = list(raw.trades).slice(0, 30).map(tradeOf).sort((a, b) => String(a.date).localeCompare(String(b.date)));
        for (const t of trades) if (!validDate(t.date) || t.date > date || !securities.some(s => s.symbol === t.symbol && s.currency === t.currency)) throw new Error('거래 날짜나 종목 통화가 맞지 않아요');
        positions(trades); // rejects overselling before any mutation
        const starting = list(raw.cash).slice(0, 8);
        if (!starting.length || starting.some(x => !currency(x.currency) || !finite(x.amount) || x.amount < 0) || new Set(starting.map(x => x.currency)).size !== starting.length) throw new Error('통화별 시작 잔액이 필요해요');
        const scratch = { finance: structuredClone(finance(m)) }, accountId = preserved[0]?.id || uid();
        // Reuse account identities and external records; explicitly revise opening cash on rebuild.
        for(const a of preserved) scratch.finance.accounts[`${a.id}:${a.currency}`]=structuredClone(a);
        const currencies=new Set(preserved.map(a=>a.currency));
        if(currencies.size!==preserved.length) throw new Error('통화별 투자 계좌를 확인해 주세요');
        const accounts=preserved.map(a=>({key:`${a.id}:${a.currency}`,currency:a.currency}));
        for(const a of preserved) {
            const opening=starting.find(x=>x.currency===a.currency);
            if(!opening) throw new Error('기존 계좌 통화의 시작 잔액이 필요해요');
            reviseBaseline(scratch,`${a.id}:${a.currency}`,opening.amount,'투자 다시 만들기');
        }
        for(const x of starting) if(!currencies.has(x.currency)) {
            const a=baseline(scratch,accountId,x.currency,x.amount,trades[0]?.date || date,p.owner);
            accounts.push({key:`${a.id}:${a.currency}`,currency:a.currency});currencies.add(x.currency);
        }
        for (const t of trades) {
            const a = scratch.finance.accounts[accounts.find(a=>a.currency===t.currency)?.key];
            if (!a) throw new Error('거래 통화의 현금 계좌가 없어요');
            a.entries[t.id] = { amount: moved(t), date: t.date };
            if (cash(a) < -0.01) throw new Error('생성된 거래에 필요한 현금이 부족해요. 다시 채워 주세요');
        }
        if(accounts.some(a=>cash(scratch.finance.accounts[a.key]) < -0.01)) throw new Error('기존 이체를 유지할 투자 잔액이 부족해요');
        const stakes = stakesOf(raw, input);
        ingestQuotes(scratch, raw, input, date, securities);
        for (const t of trades) t.rateAtTrade = fx(scratch, t.currency, raw.base, t.date);
        correction=wealthCheck(scratch,plan,'investments',investmentWealthRows(scratch,accounts,trades,securities,date),date);
        if(correction) {if(attempt===0) {correction += '\n[PREVIOUS CANDIDATE]\n'+JSON.stringify(raw);continue;}throw new Error('투자 규모를 재력 기준에 맞추지 못했어요. 기존 금융 데이터는 유지돼요');}
        m.finance = scratch.finance;
        p.investment = { at: Date.now(), version: 1, base: raw.base, date, basis: text(raw.basis, 2000), securities, accounts, trades, stakes, watch: watchOf(raw, securities), generatedDates: [date] };
        // stopped short of the phone's clock: a second turn adds the rest (one that fails keeps the first)
        const two0 = liveSecondTurn(m, p, read.gap);
        let last = read.gap, short = null, told = raw;
        // (실시간 폰: 시작한 곳까지 다 읽을 때까지 이어서 읽어요. 남은 이야기를 읽어 줄 반영이 없어요)
        for (let two = two0; two; two = liveSecondTurn(m, p, last)) {
            try { told = liveTold(told, await liveInvestMore(m, p, told, two, plan), ['securities', 'trades', 'watch', 'stakes']); last = two.cover; short = two.short; }
            catch (err) { console.warn('[narrative-archive] investments, second turn', err); break; }
        }
        mark = liveReadMark(last) || mark0;
        syncOf(p, phoneChatScope(ctx())).marks.invest = mark;
        await saveMeta();
        if (two0) turnsNote(last, '투자', short); else readNote(read.gap);
        return;
    }
}
export async function liveRefreshMarket(m, p, date, checkStory = false) {
    needLive(m);
    if (!validDate(date)) throw new Error('이야기 날짜를 확인해 주세요');
    const inv = p.investment;
    if (!inv) return liveFillInvestment(m, p, date);
    if (date < inv.date) throw new Error('현재 잔액보다 과거 날짜로 평가할 수 없어요. 과거 가격은 가격 기록에서 볼 수 있어요');
    if (!checkStory && inv.generatedDates.includes(date)) { inv.date = date; await saveMeta(); return; }
    const keys = inv.securities.map(s => `STOCK:${s.symbol}`);
    const currencies = [...new Set([...inv.accounts.map(a => a.currency), ...inv.securities.map(s => s.currency)])];
    keys.push(...currencies.filter(c => c !== inv.base).map(c => `FX:${c}/${inv.base}`));
    const quotes = Object.fromEntries(keys.map(quoteKey).map(k => [k, finance(m).prices[k] || {}]));
    const input = await liveSideRequest(m, p.owner, [`[DATE]\n${date}`, `[PUBLIC SECURITIES]\n${JSON.stringify(inv.securities)}`, `[EXISTING QUOTES]\n${JSON.stringify(quotes)}`, `[FX PAIRS]\n${currencies.filter(c => c !== inv.base).map(c => `${c}/${inv.base}`).join(', ')}`]);
    const raw = json(await askDraft(input, { force: true, system: MARKET_SYS, maxTokens: 6000 }));
    ingestQuotes(m, raw, input, date, inv.securities);
    inv.date = date; inv.generatedDates = [...new Set([...inv.generatedDates, date])];
    await saveMeta();
}
export async function liveCollectInvestmentRecords(m, p, mode = 'records', target = '') {
    needLive(m);
    const inv = p.investment;
    if (!inv || !['notes','records'].includes(mode)) throw new Error('투자 계좌를 먼저 만들어 주세요');
    if (mode === 'notes' && !investmentTargets(inv).some(t => t.key === target)) throw new Error('노트를 쓸 종목이나 지분을 찾지 못했어요');
    // Capture sources BEFORE appending generated targets. Prior app text cannot serve as evidence for itself.
    const source = await liveSideRequest(m,p.owner,[], {profile:mode === 'notes' ? p.financeProfile : undefined});
    const targets = investmentTargets(inv).filter(t => mode !== 'notes' || t.key === target);
    const appContext = mode === 'notes' && target.startsWith('stock:') ? { trades: inv.trades.filter(t => `stock:${t.symbol}` === target).slice(-8), watch: inv.watch.filter(w => `stock:${w.symbol}` === target) } : null;
    const input = `${source}\n\n[AS OF]\n${inv.date}\n[TARGETS — identification only]\n${JSON.stringify(targets)}${mode === 'records' ? `\n[EXISTING SCHEDULES — app data, not evidence]\n${JSON.stringify(inv.schedules || [])}` : ''}${appContext ? `\n[APP CONTEXT — imagination, not evidence]\n${JSON.stringify(appContext)}` : ''}`;
    const raw = json(await askDraft(input,{force:true,system:mode === 'notes' ? INVEST_NOTES_SYS : INVEST_RECORDS_SYS,maxTokens:mode === 'notes' ? 2000 : 6500}));
    const got = parseInvestmentRecords(raw,inv,source,mode,target);
    if (mode === 'notes' && !got.notes.length) throw new Error('사용할 수 있는 투자 노트를 받지 못했어요');
    mergeInvestmentRecords(inv,got);
    inv.at=Date.now();
    if (mode === 'records') inv.recordsChecked = inv.date;
    await saveMeta();
    return got;
}
export async function liveFillChartHistory(m,p,symbol,range='1m') {
    needLive(m);
    const inv=p.investment, dates=chartDates(m,inv,symbol,range), key=`STOCK:${symbol}`, date=inv.date;
    const book=finance(m).prices[key] || {}, missing=dates.filter(d=>!book[d]?.rows?.length);
    if (!missing.length) return 0;
    const source=await liveSideRequest(m,p.owner,[]);
    const input=`${source}\n[SECURITY]\n${JSON.stringify(inv.securities.find(s=>s.symbol === symbol))}\n[REQUESTED DATES]\n${JSON.stringify(missing)}\n[EXISTING QUOTES — fixed anchors]\n${JSON.stringify(book)}`;
    const raw=json(await askDraft(input,{force:true,system:CHART_SYS,maxTokens:5000}));
    if(p.investment !== inv || inv.date !== date) throw new Error('시세 날짜가 변경됐어요. 다시 시도해 주세요');
    const wanted=new Set(missing);
    const rows=list(raw.quotes).filter(x=>x.symbol === symbol && wanted.has(x.date) && !finance(m).prices[key]?.[x.date]?.rows?.length);
    const staged={finance:structuredClone(finance(m))};
    // Evidence is checked against the source alone; generated anchors cannot cite themselves.
    ingestQuotes(staged,{quotes:rows},source,date,inv.securities);
    const added=missing.filter(d=>!finance(m).prices[key]?.[d]?.rows?.length && staged.finance.prices[key]?.[d]?.rows?.length).length;
    if(!added) throw new Error('추가할 시세를 받지 못했어요. 다시 시도해 주세요');
    m.finance=staged.finance;await saveMeta();return added;
}
export async function liveRefreshBankFX(m,p,date,base) {
    needLive(m);
    if (!p.money || !validDate(date) || !currency(base)) throw new Error('환산 날짜와 표시 통화를 확인해 주세요');
    const currencies = [...new Set(p.money.bank.accounts.map(a=>a.currency || p.money.currency))].filter(c=>currency(c) && c !== base);
    const keys = currencies.map(c=>quoteKey(`FX:${c}/${base}`));
    if (!keys.length) return;
    const quotes = Object.fromEntries(keys.map(k=>[k,finance(m).prices[k] || {}]));
    const input = await liveSideRequest(m,p.owner,[`[DATE]\n${date}`, '[PUBLIC SECURITIES]\n[]',`[EXISTING QUOTES]\n${JSON.stringify(quotes)}`,`[FX PAIRS]\n${currencies.map(c=>`${c}/${base}`).join(', ')}`]);
    const raw = json(await askDraft(input,{force:true,system:MARKET_SYS,maxTokens:3000}));
    // Only requested FX pairs on the selected day can be updated by this request.
    const allowed = new Set(keys);
    const rows = list(raw.fx).filter(x=>x.date === date && allowed.has(quoteKey(`FX:${x.from}/${x.to}`)));
    ingestQuotes(m,{fx:rows},input,date,[]);
    await saveMeta();
}
