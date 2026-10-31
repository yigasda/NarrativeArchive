// Investment generation: private portfolios, shared public quotes. All invented records stay out of RP injection.
import { wealthBlock, wealthCheck, investmentWealthRows } from './wealth.js';
import { askDraft } from './ai.js';
import { ctx, saveMeta } from './core.js';
import { sideRequest, storyNow, prepareWealth } from './phonedata.js';
import { syncOf, makeMark } from './phonesync.js';
import { phoneChatScope } from './phonestory.js';
import { baseline, reviseBaseline, cash, currency, finance, finite, uid, positions, addPrice, migrateBank, fx, quoteKey } from './finance.js';

export const INVEST_SYS = `GOAL
Fill one character's investment app in a long role-play: their brokerage cash, the shares they hold and how they came to hold them, the ones they watch, and any stake in a family company. The user opens it to peek at the character's life.
The app works out holdings, totals and returns from your records; you write only the records.

YOU GET
- ARCHIVE, RECENT CHAT, OWNER, and sometimes WORLD, LOREBOOK, OWNER PROFILE and OWNER DOESN'T KNOW.
- DATE: the story's day the app shows.
- BANK: the owner's bank accounts. They are separate and stay as they are.
- FINANCIAL SCALE: how much the investments, brokerage cash included, come to, worked out beforehand.
- EXISTING PUBLIC PRICES: prices the app already uses on DATE. They stay.

STORY OR INVENTED
- Amounts, dates, holdings and conditions the story gives stay as they are.
- Everything else may be invented for the app: the opening cash, the shares, the trades, the watch list, past prices. Invented records are never new facts in the role-play.
- Invest the way this owner would: holding a few for years, spreading carefully, or mostly watching. Trading often only if that is them.
- Only the owner's own money. Company money, family money and other people's things are not theirs. Nothing the owner doesn't know shows as known.

FAMILY STAKES
- A stake goes in only when the story says the owner holds it; being an heir is not holding.
- Each of its fields (listed, percent, holder, voter, beneficiary, restriction, value) only from the story; otherwise null or "".
- "evidence": the exact words from the story that show it. Stakes stay out of the portfolio totals.

CASH AND TRADES
- "cash": what the account held before the first trade, per currency; enough for every buy. Don't fund it with bank transfers.
- Trades oldest first: buy, sell or dividend. No selling what isn't held, no borrowing, no derivatives, no currency exchange.
- A buy's cost includes its fee; a sale's proceeds have the fee taken off; "fee": 0 when there is none. A dividend gives its "amount".

PRICES
- Each share has one key, "EXCHANGE:CODE", and one trading currency.
- "quotes": market prices, several across the last month for each share held, DATE included.
- A price the story gives is "source": "story", with the exact words as "evidence" and its time if given. Every other price is "guess". The price someone paid is not a market quote.
- "fx": the rate on DATE from each other currency to "base", and on each trade date in a foreign currency.

DATES AND LANGUAGE
- Full "YYYY-MM-DD", in story time, never after DATE.
- Names and notes in the owner's language, the Korean in "ko". "query": a search for public business news about the company, never private family matters.

ANSWER — one JSON object, nothing else:
{"base":"EUR","basis":"what the story gave and what you invented",
"cash":[{"currency":"EUR","amount":10000}],
"securities":[{"symbol":"EXCHANGE:CODE","name":"Company","currency":"EUR","ko":"한국어 이름"}],
"trades":[{"kind":"buy|sell|dividend","symbol":"EXCHANGE:CODE","currency":"EUR","date":"YYYY-MM-DD","quantity":1,"price":100,"fee":0,"amount":0}],
"watch":[{"symbol":"EXCHANGE:CODE","note":"why they watch it","ko":"번역","query":"public news search"}],
"stakes":[{"company":"name","listed":null,"percent":null,"holder":"","voter":"","beneficiary":"","restriction":"","value":null,"currency":"EUR","evidence":"exact words from the story"}],
"quotes":[{"symbol":"EXCHANGE:CODE","date":"YYYY-MM-DD","time":"","value":100,"source":"guess|story","evidence":""}],
"fx":[{"from":"USD","to":"EUR","date":"YYYY-MM-DD","time":"","value":0.9,"source":"guess|story","evidence":""}]}
At most 10 shares, 30 trades, 8 watched, 8 stakes and 60 quotes. Fewer is fine; cash may stay uninvested. Plain JSON numbers, without separators.`;
// 투자 새로 만들기: the same account currencies, everything else made again
const INVEST_REBUILD = `

REBUILD
REBUILD means the user asked for the investment app to be made again.
- New shares, trades, watch list and opening cash, from the story as it is now. The old amounts are not targets.
- "cash" covers every currency in REBUILD; new currencies are fine.
- MONEY ALREADY MOVED is money the app already recorded going in or out of the account. Leave it out of "trades"; the entries marked included are already in the opening cash. Trades after them must be affordable.`;
const MARKET_SYS = `GOAL
Give the public market prices and exchange rates for DATE in a long role-play's world, for one phone's investment app.

YOU GET
- ARCHIVE, RECENT CHAT, and sometimes WORLD and LOREBOOK.
- DATE, PUBLIC SECURITIES, EXISTING QUOTES and FX PAIRS.

RULES
- Only the shares in PUBLIC SECURITIES and the pairs in FX PAIRS, one price each on DATE.
- EXISTING QUOTES stay. A key that already has a price on DATE gets none, unless the story gives a different one.
- A price the story gives is "source": "story", with the exact words as "evidence" and its time if given. Every other price is "guess", carrying on from EXISTING QUOTES. The price someone paid is not a market quote.
- Nothing about anyone's holdings or private news.

ANSWER — one JSON object, nothing else:
{"quotes":[{"symbol":"exchange:symbol","date":"YYYY-MM-DD","time":"","value":100,"source":"guess|story","evidence":"exact words from the story, for story"}],"fx":[{"from":"USD","to":"EUR","date":"YYYY-MM-DD","time":"","value":0.9,"source":"guess|story","evidence":""}]}
Empty lists are fine.`;
const list = x => Array.isArray(x) ? x : [];
const text = (s, n = 500) => String(s ?? '').trim().slice(0, n);
const json = out => { const s = String(out).replace(/```(?:json)?/gi, ''); return JSON.parse(s.slice(s.indexOf('{'), s.lastIndexOf('}') + 1)); };
export const validDate = d => /^\d{4}-\d{2}-\d{2}$/.test(d || '') && !Number.isNaN(Date.parse(d)) && new Date(d).toISOString().slice(0, 10) === d;
export function investmentDate(m, p) {
    if (validDate(p.investment?.date)) return p.investment.date;
    const day = storyNow(p).slice(0, 5), dates = [...String(m.text || '').matchAll(/\b(\d{4})[-/]\d{2}[-/]\d{2}\b/g)];
    const years = [...String(m.text || '').matchAll(/\b(20\d{2}|19\d{2})\b/g)];
    const year = dates.at(-1)?.[1] || years.at(-1)?.[1];
    const date = year && day ? `${year}-${day}` : '';
    return validDate(date) ? date : '';
}
function ingestQuotes(m, raw, input, date, securities) {
    const allowed = new Set(securities.map(s => s.symbol));
    const push = (key, x) => {
        if (!validDate(x.date) || x.date > date || !finite(x.value) || x.value <= 0) return;
        const evidence = text(x.evidence, 2000), story = x.source === 'story';
        if (story && (!evidence || !input.includes(evidence))) return;
        const existing = finance(m).prices[quoteKey(key)]?.[x.date];
        if (!story && existing?.rows.length) return;
        addPrice(m, key, x.date, { value: x.value, time: /^([01]\d|2[0-3]):[0-5]\d$/.test(x.time || '') ? x.time : '', source: story ? 'story' : 'guess', ref: evidence });
    };
    for (const x of list(raw.quotes).slice(0, 60)) if (allowed.has(x.symbol)) push(`STOCK:${x.symbol}`, x);
    for (const x of list(raw.fx).slice(0, 30)) if (currency(x.from) && currency(x.to) && x.from !== x.to) push(`FX:${x.from}/${x.to}`, x);
}
export async function fillInvestment(m, p, date, {regenerate = false, wealthPlan = null} = {}) {
    const chat = ctx()?.chat || [], mark = makeMark(chat, chat.length - 1);
    const old = p.investment;
    if (old && !regenerate) throw new Error('기존 투자 기록은 보존돼요. 시세 갱신을 사용해 주세요');
    if (!validDate(date)) throw new Error('이야기 날짜를 YYYY-MM-DD로 입력해 주세요');
    const plan = wealthPlan || await prepareWealth(m,p,regenerate);
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
    const input = await sideRequest(m, p.owner, [`[DATE]\n${date}`, `[BANK — separate locked balances]\n${JSON.stringify(p.money?.bank || {})}`, rebuild,wealthBlock(plan,'investments'),`[EXISTING PUBLIC PRICES]\n${JSON.stringify(Object.fromEntries(Object.entries(finance(m).prices).map(([k,book])=>[k,book[date]])))}`], {profile:p.financeProfile,money:true});
    let correction='';
    for(let attempt=0;attempt<2;attempt++) {
        const raw = json(await askDraft(input+'\n'+correction, { system: INVEST_SYS + (old ? INVEST_REBUILD : ''), maxTokens: 12000 }));
        if (p.investment!==old || snapshot()!==before || m.phones && !Object.values(m.phones).includes(p)) throw new Error('생성 중 금융 정보가 변경됐어요. 다시 시도해 주세요');
        if (!currency(raw.base)) throw new Error('기준 통화를 확인하지 못했어요');
        const securities = list(raw.securities).slice(0, 10).map(s => ({ symbol: text(s.symbol, 80), name: text(s.name, 100), ko: text(s.ko, 100), currency: currency(s.currency) })).filter(s => s.symbol && s.name && s.currency);
        if (new Set(securities.map(s => s.symbol)).size !== securities.length) throw new Error('중복 종목이 있어요');
        const trades = list(raw.trades).slice(0, 30).map(t => ({ id: uid(), kind: t.kind, symbol: text(t.symbol, 80), currency: t.currency, date: t.date, quantity: t.quantity, price: t.price, fee: t.fee, amount: t.amount, source: 'guess' })).sort((a, b) => String(a.date).localeCompare(String(b.date)));
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
            const amount = t.kind === 'buy' ? -(t.quantity * t.price + t.fee) : t.kind === 'sell' ? t.quantity * t.price - t.fee : t.amount;
            a.entries[t.id] = { amount, date: t.date };
            if (cash(a) < -0.01) throw new Error('생성된 거래에 필요한 현금이 부족해요. 다시 채워 주세요');
        }
        if(accounts.some(a=>cash(scratch.finance.accounts[a.key]) < -0.01)) throw new Error('기존 이체를 유지할 투자 잔액이 부족해요');
        const stakes = list(raw.stakes).slice(0, 8).filter(s => s.evidence && input.includes(String(s.evidence))).map(s => ({ id: uid(), company: text(s.company, 100), listed: typeof s.listed === 'boolean' ? s.listed : null, percent: finite(s.percent) && s.percent >= 0 && s.percent <= 100 ? s.percent : null, holder: text(s.holder), voter: text(s.voter), beneficiary: text(s.beneficiary), restriction: text(s.restriction), value: finite(s.value) && s.value >= 0 ? s.value : null, currency: currency(s.currency), evidence: text(s.evidence, 2000), source: 'story' }));
        ingestQuotes(scratch, raw, input, date, securities);
        for (const t of trades) t.rateAtTrade = fx(scratch, t.currency, raw.base, t.date);
        correction=wealthCheck(scratch,plan,'investments',investmentWealthRows(scratch,accounts,trades,securities,date),date);
        if(correction) {if(attempt===0) {correction += '\n[PREVIOUS CANDIDATE]\n'+JSON.stringify(raw);continue;}throw new Error('투자 규모를 재력 기준에 맞추지 못했어요. 기존 금융 데이터는 유지돼요');}
        m.finance = scratch.finance;
        p.investment = { at: Date.now(), version: 1, base: raw.base, date, basis: text(raw.basis, 2000), securities, accounts, trades, stakes, watch: list(raw.watch).slice(0, 8).filter(w => securities.some(s => s.symbol === w.symbol)).map(w => ({ symbol: w.symbol, note: text(w.note), ko: text(w.ko), query: text(w.query, 120), source: 'guess' })), generatedDates: [date] };
        syncOf(p, phoneChatScope(ctx())).marks.invest = mark;
        await saveMeta();
        return;
    }
}
export async function refreshMarket(m, p, date, checkStory = false) {
    if (!validDate(date)) throw new Error('이야기 날짜를 확인해 주세요');
    const inv = p.investment;
    if (!inv) return fillInvestment(m, p, date);
    if (date < inv.date) throw new Error('현재 잔액보다 과거 날짜로 평가할 수 없어요. 과거 가격은 가격 기록에서 볼 수 있어요');
    if (!checkStory && inv.generatedDates.includes(date)) { inv.date = date; await saveMeta(); return; }
    const keys = inv.securities.map(s => `STOCK:${s.symbol}`);
    const currencies = [...new Set([...inv.accounts.map(a => a.currency), ...inv.securities.map(s => s.currency)])];
    keys.push(...currencies.filter(c => c !== inv.base).map(c => `FX:${c}/${inv.base}`));
    const quotes = Object.fromEntries(keys.map(quoteKey).map(k => [k, finance(m).prices[k] || {}]));
    const input = await sideRequest(m, p.owner, [`[DATE]\n${date}`, `[PUBLIC SECURITIES]\n${JSON.stringify(inv.securities)}`, `[EXISTING QUOTES]\n${JSON.stringify(quotes)}`, `[FX PAIRS]\n${currencies.filter(c => c !== inv.base).map(c => `${c}/${inv.base}`).join(', ')}`]);
    const raw = json(await askDraft(input, { system: MARKET_SYS, maxTokens: 6000 }));
    ingestQuotes(m, raw, input, date, inv.securities);
    inv.date = date; inv.generatedDates = [...new Set([...inv.generatedDates, date])];
    await saveMeta();
}

export const INVEST_NOTES_SYS = `GOAL
Write one short note for TARGET in a character's investment app, in a long role-play: why they bought it, keep it or watch it, in their own words. It is not advice, and it adds no trade, money or ownership.

YOU GET
- ARCHIVE, RECENT CHAT, OWNER, and sometimes WORLD, LOREBOOK, OWNER PROFILE and OWNER DOESN'T KNOW.
- AS OF: the story's day. TARGETS: the share or stake to write about; it proves nothing.
- APP CONTEXT (sometimes): the app's own trades and watch notes for it. Ideas only, never evidence.

RULES
- An invented reason is "source": "guess". "story" only when the story itself gives the reason: the exact words from the story as "evidence", more than the company's name, and the message or section numbers as "ref".
- No family secrets, rights or relationships the story doesn't have. Nothing the owner doesn't know shows as known.
- Names as they are, in the owner's language, the Korean in "ko".

ANSWER — one JSON object, nothing else:
{"notes":[{"target":"the TARGETS key","text":"short note","ko":"번역","source":"guess|story","evidence":"exact words from the story, for story; otherwise empty","ref":""}]}
One note only.`;

export const INVEST_RECORDS_SYS = `GOAL
Find the dates ahead and the past changes for one character's investments in a long role-play: dividend days, shareholder meetings, when a sale restriction or a voting delegation ends, and how a family stake changed hands. The app shows them; they change no balance and no holding.

YOU GET
- ARCHIVE, RECENT CHAT, OWNER, and sometimes WORLD, LOREBOOK and OWNER DOESN'T KNOW.
- AS OF: the story's day.
- TARGETS: the shares and stakes, with their keys. They name the screen; they prove nothing.
- EXISTING SCHEDULES: what the app already has. They stay; they are not evidence.

SCHEDULES
- A share's next dividend may be guessed: "source": "guess", "status": "scheduled", on or after AS OF, at most one, and none when EXISTING SCHEDULES already has one ahead. Not every company pays dividends.
- Every other schedule, and every one for a family stake, needs the story to give both the date and the event: "source": "story". A date ahead only if announced by AS OF. No yearly repeats.
- "paid" or "cancelled" only when the story says so; a date passing is not a payment.

HISTORY
- Only family stakes, and only a change the story shows happened by AS OF: percent, holder, voter, beneficiary or restriction.
- "before" is who held it, "after" who holds it now. A change of heart changes no right. What isn't known stays "".

EVIDENCE
- Each "story" item has "evidence": the exact words from the story that give its date, condition and people, not just the company's name. Never TARGETS or the app's own records. "ref": the message or section numbers, if any.
- No amounts of money. Nothing the owner doesn't know shows as known.

ANSWER — one JSON object, nothing else:
{"schedules":[{"target":"a TARGETS key","kind":"dividend|meeting|release|delegation","date":"YYYY-MM-DD","title":"short title","status":"scheduled|paid|cancelled","source":"guess|story","evidence":"exact words from the story; empty for guess","ref":""}],
"history":[{"target":"a stake key","field":"percent|holder|voter|beneficiary|restriction","date":"YYYY-MM-DD or empty","before":"","after":"","evidence":"exact words from the story","ref":""}]}
At most 16 schedules and 16 changes. Names as they are, full years, no other keys.`;
export function investmentTargets(inv) {
    return [...inv.securities.map(s => ({ key: `stock:${s.symbol}`, name: s.name })), ...inv.stakes.map(s => ({ key: `stake:${s.id}`, name: s.company }))];
}
// This checks provenance text and structure, not whether an excerpt semantically entails every claim.
export function parseInvestmentRecords(raw, inv, source, mode, target = '') {
    const allowed = new Set(investmentTargets(inv).map(t => t.key));
    const proof = x => typeof x.evidence === 'string' && x.evidence.trim().length >= 8 && source.includes(x.evidence.trim());
    const common = x => ({ target: x.target, evidence: text(x.evidence, 2000), ref: text(x.ref, 120), source: 'story' });
    const out = { notes: [], schedules: [], history: [] };
    if (mode === 'notes') {
        out.notes = list(raw.notes).filter(x => x.target === target && allowed.has(x.target) && text(x.text) && (x.source === 'guess' || x.source === 'story' && proof(x))).slice(0, 1).map(x => ({ ...common(x), date: inv.date, text: text(x.text, 1200), ko: text(x.ko, 1200), source: x.source, ...(x.source === 'guess' ? { evidence: '', ref: '' } : {}) }));
        return out;
    }
    out.schedules = list(raw.schedules).filter(x => allowed.has(x.target) && ['dividend', 'meeting', 'release', 'delegation'].includes(x.kind) && validDate(x.date) && text(x.title) && (x.source === 'guess' ? x.target.startsWith('stock:') && x.kind === 'dividend' && x.status === 'scheduled' && x.date >= inv.date : (x.source == null || x.source === 'story') && proof(x)) && ['scheduled', 'paid', 'cancelled'].includes(x.status) && !(x.date > inv.date && x.status === 'paid')).slice(0,16).map(x => ({ ...common(x), kind:x.kind, date:x.date, title:text(x.title,120), status:x.status, ...(x.source === 'guess' ? {source:'guess',evidence:'',ref:''} : {}) }));
    out.history = list(raw.history).filter(x => x.source !== 'guess' && allowed.has(x.target) && x.target.startsWith('stake:') && ['percent','holder','voter','beneficiary','restriction'].includes(x.field) && (!x.date || validDate(x.date) && x.date <= inv.date) && proof(x) && (text(x.before) || text(x.after)) && text(x.before) !== text(x.after)).slice(0,16).map(x => ({ ...common(x), field:x.field, date:x.date || '', before:text(x.before), after:text(x.after) }));
    return out;
}
export function mergeInvestmentRecords(inv, got) {
    // Identity is independent of generated prose and status. New evidence stays as a separate sourced record.
    const signature = (kind,x) => JSON.stringify(kind === 'notes' ? [x.target,x.date,x.text] : kind === 'schedules' ? [x.target,x.kind,x.date,x.evidence] : [x.target,x.field,x.date,x.evidence]);
    for (const kind of ['notes','schedules','history']) {
        const xs = inv[kind] ||= [];
        for (const x of got[kind]) {
            if (kind === 'schedules' && x.source === 'guess' && xs.some(y => y.target === x.target && y.kind === 'dividend' && y.date >= inv.date && y.status !== 'cancelled')) continue;
            if (kind === 'schedules' && x.source === 'story') {
                // A confirmed event replaces a fictional placeholder for that same date.
                const placeholder = xs.findIndex(y => y.source === 'guess' && y.target === x.target && y.kind === x.kind && y.date === x.date);
                if (placeholder >= 0) { xs[placeholder] = {...x,id:xs[placeholder].id}; continue; }
            }
            const old = xs.find(y => signature(kind,y) === signature(kind,x));
            if (!old) xs.push({ ...x, id:uid() });
            // Don't erase the former status or a conflicting interpretation of the same evidence.
        }
    }
}
export async function collectInvestmentRecords(m, p, mode = 'records', target = '') {
    const inv = p.investment;
    if (!inv || !['notes','records'].includes(mode)) throw new Error('투자 계좌를 먼저 만들어 주세요');
    if (mode === 'notes' && !investmentTargets(inv).some(t => t.key === target)) throw new Error('노트를 쓸 종목이나 지분을 찾지 못했어요');
    // Capture sources BEFORE appending generated targets. Prior app text cannot serve as evidence for itself.
    const source = await sideRequest(m,p.owner,[], {profile:mode === 'notes' ? p.financeProfile : undefined});
    const targets = investmentTargets(inv).filter(t => mode !== 'notes' || t.key === target);
    const appContext = mode === 'notes' && target.startsWith('stock:') ? { trades: inv.trades.filter(t => `stock:${t.symbol}` === target).slice(-8), watch: inv.watch.filter(w => `stock:${w.symbol}` === target) } : null;
    const input = `${source}\n\n[AS OF]\n${inv.date}\n[TARGETS — identification only]\n${JSON.stringify(targets)}${mode === 'records' ? `\n[EXISTING SCHEDULES — app data, not evidence]\n${JSON.stringify(inv.schedules || [])}` : ''}${appContext ? `\n[APP CONTEXT — imagination, not evidence]\n${JSON.stringify(appContext)}` : ''}`;
    const raw = json(await askDraft(input,{system:mode === 'notes' ? INVEST_NOTES_SYS : INVEST_RECORDS_SYS,maxTokens:mode === 'notes' ? 2000 : 6500}));
    const got = parseInvestmentRecords(raw,inv,source,mode,target);
    if (mode === 'notes' && !got.notes.length) throw new Error('사용할 수 있는 투자 노트를 받지 못했어요');
    mergeInvestmentRecords(inv,got);
    inv.at=Date.now();
    if (mode === 'records') inv.recordsChecked = inv.date;
    await saveMeta();
    return got;
}

// Bank display FX works even when no investment portfolio has been generated.
export async function refreshBankFX(m,p,date,base) {
    if (!p.money || !validDate(date) || !currency(base)) throw new Error('환산 날짜와 표시 통화를 확인해 주세요');
    const currencies = [...new Set(p.money.bank.accounts.map(a=>a.currency || p.money.currency))].filter(c=>currency(c) && c !== base);
    const keys = currencies.map(c=>quoteKey(`FX:${c}/${base}`));
    if (!keys.length) return;
    const quotes = Object.fromEntries(keys.map(k=>[k,finance(m).prices[k] || {}]));
    const input = await sideRequest(m,p.owner,[`[DATE]\n${date}`, '[PUBLIC SECURITIES]\n[]',`[EXISTING QUOTES]\n${JSON.stringify(quotes)}`,`[FX PAIRS]\n${currencies.map(c=>`${c}/${base}`).join(', ')}`]);
    const raw = json(await askDraft(input,{system:MARKET_SYS,maxTokens:3000}));
    // Only requested FX pairs on the selected day can be updated by this request.
    const allowed = new Set(keys);
    const rows = list(raw.fx).filter(x=>x.date === date && allowed.has(quoteKey(`FX:${x.from}/${x.to}`)));
    ingestQuotes(m,{fx:rows},input,date,[]);
    await saveMeta();
}

const CHART_SYS = `GOAL
Fill the missing days of one share's price chart in a long role-play's world.

YOU GET
- ARCHIVE, RECENT CHAT, and sometimes WORLD and LOREBOOK.
- SECURITY, REQUESTED DATES, and EXISTING QUOTES: the prices already saved. They stay.

RULES
- One positive price for each of REQUESTED DATES, for SECURITY only.
- The series runs smoothly through EXISTING QUOTES; not random numbers.
- A price the story gives is "source": "story", with the exact words from the story as "evidence". Every other price is "guess" with empty "evidence". The price someone paid is not a market quote.

ANSWER — one JSON object, nothing else:
{"quotes":[{"symbol":"SECURITY's symbol","date":"a REQUESTED DATE","value":100,"source":"guess|story","time":"","evidence":""}]}`;
export function chartDates(m, inv, symbol, range = '1m') {
    if (!validDate(inv?.date) || !inv.securities.some(s=>s.symbol === symbol)) throw new Error('종목과 시세 날짜를 확인해 주세요');
    const end = Date.parse(inv.date), day = 864e5;
    const oldest = Object.keys(finance(m).prices[`STOCK:${symbol}`] || {}).filter(d=>validDate(d) && d <= inv.date).sort()[0];
    const span = range === '1w' ? 7 : range === '3m' ? 92 : range === 'all' ? Math.min(366,Math.max(31,oldest ? (end-Date.parse(oldest))/day : 31)) : 31;
    const dates = [];
    for(let t=end-span*day;t<=end;t+=day) { const d=new Date(t); if(d.getUTCDay()!==0 && d.getUTCDay()!==6) dates.push(d.toISOString().slice(0,10)); }
    // Sample longer periods to keep the request bounded. Saved quotes between samples remain visible.
    return dates.length <= 24 ? dates : [...new Set(Array.from({length:24},(_,i)=>dates[Math.round(i*(dates.length-1)/23)]))];
}
export async function fillChartHistory(m,p,symbol,range='1m') {
    const inv=p.investment, dates=chartDates(m,inv,symbol,range), key=`STOCK:${symbol}`, date=inv.date;
    const book=finance(m).prices[key] || {}, missing=dates.filter(d=>!book[d]?.rows?.length);
    if (!missing.length) return 0;
    const source=await sideRequest(m,p.owner,[]);
    const input=`${source}\n[SECURITY]\n${JSON.stringify(inv.securities.find(s=>s.symbol === symbol))}\n[REQUESTED DATES]\n${JSON.stringify(missing)}\n[EXISTING QUOTES — fixed anchors]\n${JSON.stringify(book)}`;
    const raw=json(await askDraft(input,{system:CHART_SYS,maxTokens:5000}));
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
