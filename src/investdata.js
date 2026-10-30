// Investment generation: private portfolios, shared public quotes. All invented records stay out of RP injection.
import { askDraft } from './ai.js';
import { saveMeta } from './core.js';
import { sideRequest, storyNow } from './phonedata.js';
import { baseline, cash, currency, finance, finite, uid, positions, addPrice, migrateBank, fx, quoteKey } from './finance.js';

export const INVEST_SYS = `GOAL
Fill one character's investment app from the supplied story. The app computes holdings and returns; write inputs, not calculated totals.
YOU GET
ARCHIVE, WORLD, selected LOREBOOK, RECENT CHAT, OWNER, OWNER DOESN'T KNOW, NAMES, DATE, and BANK when present.
STORY OR INVENTED
Explicit amounts, dates, ownership and restrictions win. Infer a plausible personal investment scale from business reach, current personal ownership/access, lifestyle and spending. Do not credit company or family assets to personal cash.
Unspecified ordinary investments, watch notes, opening cash and historical prices may be imagined as app-only fiction. Make investment behaviour fit the character: concentrated long holding, conservative diversification, or mostly watching can all be right. Do not force active trading.
Family stakes, listing status, trusts, percentages, voting authority, beneficiaries, sale restrictions and their counterparties require explicit supplied evidence. Missing fields stay null or empty. Never infer ownership merely from being an heir. Put the exact supporting excerpt in each stake's evidence. Do not fabricate trust structures or a family valuation.
Privacy: only this owner's portfolio. Other characters' possessions are not theirs. Unknown or suspected facts never become known.
ACCOUNTING
Opening cash is a baseline BEFORE the listed trades, per currency. Trades are chronological; no short selling, leverage, derivatives or automatic conversion. Buy costs include fees; sell proceeds subtract fees; dividends specify currency and amount. Provide enough opening cash for purchases; do not invent bank transfers to fund it. Bank balances are separate and locked. Transfer history is managed by the app, not this request.
Every security has a stable exchange:symbol key and one trading currency. No returns, averages or total values in your answer. All numbers are JSON numbers without separators. Fees explicitly zero when none in invented trades.
DATES
Full YYYY-MM-DD, never later than DATE. Use story dates, not today's real date. Do not turn an execution price into a market quote. A story market quote needs an exact evidence excerpt and its actual time if known; unknown time is empty. Other quotes are guess. Public quotes contain no owner information.
VOICE
Names and short notes in the owner's language with natural Korean in ko fields. Use their behaviour, not a generic personality label. News search terms must concern public business news, never private family events.
OUTPUT — JSON only
{"base":"EUR","basis":"short evidence and invented-scale explanation",
"cash":[{"currency":"EUR","amount":10000}],
"securities":[{"symbol":"EXCHANGE:CODE","name":"Company","currency":"EUR","ko":"한국어 이름"}],
"trades":[{"kind":"buy|sell|dividend","symbol":"EXCHANGE:CODE","currency":"EUR","date":"YYYY-MM-DD","quantity":1,"price":100,"fee":0,"amount":0}],
"watch":[{"symbol":"EXCHANGE:CODE","note":"why watching","ko":"번역","query":"public news search"}],
"stakes":[{"company":"name","listed":null,"percent":null,"holder":"","voter":"","beneficiary":"","restriction":"","value":null,"currency":"EUR","evidence":"exact supplied excerpt"}],
"quotes":[{"symbol":"EXCHANGE:CODE","date":"YYYY-MM-DD","time":"","value":100,"source":"guess|story","evidence":""}],
"fx":[{"from":"USD","to":"EUR","date":"YYYY-MM-DD","time":"","value":0.9,"source":"guess|story","evidence":""}]}
At most 10 securities, 30 trades, 8 watches, 8 stakes. Include FX at trade dates when foreign executions need a cost basis, as well as evaluation-date FX. A few dated quotes per held security form a small chart; at most 60 quotes total. Fewer and empty lists are fine. Cash can remain uninvested. Family stakes never enter ordinary portfolio totals.`;
const MARKET_SYS = `GOAL
Supply public market quotes and FX for DATE in this fictional story. Only the supplied securities and currency pairs. Never include portfolios, private ownership or private news.
Existing quotes are fixed. Do not generate guess quotes for keys already present on DATE. Explicit story market prices may correct invented values; preserve exact evidence and actual time, leaving unknown time empty. Execution prices are not market quotes. Do not invent an exchange listing. Unsupported quotes are app-only guess values.
Use the existing series as a coherent starting point, not unrelated random numbers. Do not create dates after DATE. No model-calculated returns.
OUTPUT JSON only: {"quotes":[{"symbol":"exchange:symbol","date":"YYYY-MM-DD","time":"","value":100,"source":"guess|story","evidence":"exact supplied excerpt for story"}],"fx":[{"from":"USD","to":"EUR","date":"YYYY-MM-DD","time":"","value":0.9,"source":"guess|story","evidence":""}]}. At most one new guess per missing key on DATE. Empty lists are fine.`;
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
export async function fillInvestment(m, p, date) {
    if (p.investment) throw new Error('기존 투자 기록은 보존돼요. 시세 갱신을 사용해 주세요');
    if (!validDate(date)) throw new Error('이야기 날짜를 YYYY-MM-DD로 입력해 주세요');
    migrateBank(m, p);
    const input = await sideRequest(m, p.owner, [`[DATE]\n${date}`, `[BANK — separate locked balances]\n${JSON.stringify(p.money?.bank || {})}`]);
    const raw = json(await askDraft(input, { system: INVEST_SYS, maxTokens: 12000 }));
    if (!currency(raw.base)) throw new Error('기준 통화를 확인하지 못했어요');
    const securities = list(raw.securities).slice(0, 10).map(s => ({ symbol: text(s.symbol, 80), name: text(s.name, 100), ko: text(s.ko, 100), currency: currency(s.currency) })).filter(s => s.symbol && s.name && s.currency);
    if (new Set(securities.map(s => s.symbol)).size !== securities.length) throw new Error('중복 종목이 있어요');
    const trades = list(raw.trades).slice(0, 30).map(t => ({ id: uid(), kind: t.kind, symbol: text(t.symbol, 80), currency: t.currency, date: t.date, quantity: t.quantity, price: t.price, fee: t.fee, amount: t.amount, source: 'guess' })).sort((a, b) => String(a.date).localeCompare(String(b.date)));
    for (const t of trades) if (!validDate(t.date) || t.date > date || !securities.some(s => s.symbol === t.symbol && s.currency === t.currency)) throw new Error('거래 날짜나 종목 통화가 맞지 않아요');
    positions(trades); // rejects overselling before any mutation
    const starting = list(raw.cash).slice(0, 8);
    if (!starting.length || starting.some(x => !currency(x.currency) || !finite(x.amount) || x.amount < 0) || new Set(starting.map(x => x.currency)).size !== starting.length) throw new Error('통화별 시작 잔액이 필요해요');
    const scratch = { finance: structuredClone(finance(m)) }, accountId = uid();
    const accounts = starting.map(x => {
        const a = baseline(scratch, accountId, x.currency, x.amount, trades[0]?.date || date, p.owner);
        return { key: `${a.id}:${a.currency}`, currency: a.currency };
    });
    for (const t of trades) {
        const a = scratch.finance.accounts[`${accountId}:${t.currency}`];
        if (!a) throw new Error('거래 통화의 현금 계좌가 없어요');
        const amount = t.kind === 'buy' ? -(t.quantity * t.price + t.fee) : t.kind === 'sell' ? t.quantity * t.price - t.fee : t.amount;
        a.entries[t.id] = { amount, date: t.date };
        if (cash(a) < -0.01) throw new Error('생성된 거래에 필요한 현금이 부족해요. 다시 채워 주세요');
    }
    const stakes = list(raw.stakes).slice(0, 8).filter(s => s.evidence && input.includes(String(s.evidence))).map(s => ({ id: uid(), company: text(s.company, 100), listed: typeof s.listed === 'boolean' ? s.listed : null, percent: finite(s.percent) && s.percent >= 0 && s.percent <= 100 ? s.percent : null, holder: text(s.holder), voter: text(s.voter), beneficiary: text(s.beneficiary), restriction: text(s.restriction), value: finite(s.value) && s.value >= 0 ? s.value : null, currency: currency(s.currency), evidence: text(s.evidence, 2000), source: 'story' }));
    ingestQuotes(scratch, raw, input, date, securities);
    for (const t of trades) t.rateAtTrade = fx(scratch, t.currency, raw.base, t.date);
    m.finance = scratch.finance;
    p.investment = { version: 1, base: raw.base, date, basis: text(raw.basis, 2000), securities, accounts, trades, stakes, watch: list(raw.watch).slice(0, 8).filter(w => securities.some(s => s.symbol === w.symbol)).map(w => ({ symbol: w.symbol, note: text(w.note), ko: text(w.ko), query: text(w.query, 120), source: 'guess' })), generatedDates: [date] };
    await saveMeta();
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
Write one short private investment note for the requested TARGET: why this owner bought, keeps or watches it. Use their voice, not investment advice or a generic personality label. This note cannot create trades, cash movements or ownership, and is never injected into RP.
YOU GET
STORY INPUT: archive, selected lore, recent chat and the owner's knowledge limits. AS OF is the story date, not the real date.
TARGETS identify the requested security or family stake; they are not evidence. APP CONTEXT contains app-only trades and watch notes, which may inform imagination but never prove story claims.
RULES
- Use the requested target key only. Never expose information the owner does not know; suspicions stay suspicions. Do not invent family secrets, rights or relationships.
- An imagined reason is source guess, never canon. Source story requires an exact excerpt from STORY INPUT explicitly supporting that reason, not merely naming the company. Never cite TARGETS or earlier generated app text as evidence. Put source message/section numbers in ref when available.
- Keep original names. Write in the owner's language and include natural Korean in ko when needed. Return at most one short note; no other records or keys.
OUTPUT JSON only
{"notes":[{"target":"provided key","text":"short note","ko":"translation","source":"guess|story","evidence":"exact supporting excerpt for story, otherwise empty","ref":""}]}`;

export const INVEST_RECORDS_SYS = `GOAL
Build investment schedules and extract historical changes to one character's family stakes. This is a read-only companion to the financial ledger. Never create trades, cash movements or new ownership.
YOU GET
STORY INPUT: archive, selected lore, recent chat and the owner's knowledge limits.
TARGETS: existing securities and family stakes, with stable keys. They identify the screen, not independent evidence.
AS OF is the story date, not the real date. EXISTING SCHEDULES are saved app records, not story evidence; preserve them.
RULES
- Use only TARGETS keys. Never expose information the owner does not know; suspicions stay suspicions.
- Return schedules and history only, never notes. Empty lists are valid; do not fill the screen for decoration.
- Ordinary stock dividend schedules may be imagined even without investment scenes: source guess, status scheduled, date on or after AS OF, no amount or evidence. At most one upcoming guess per stock target. Do not invent a new date when that target already has an upcoming schedule in EXISTING SCHEDULES. These are app-only fiction, not canon or a promise of payment. Do not assume every company pays dividends.
- All other schedules, including every family-stake schedule, require an explicitly established date AND event: dividend payment, shareholder meeting, sale restriction release or voting delegation expiry. Future dates are allowed only when already announced in the story by AS OF. No inferred annual recurrence. A due date passing does not establish payment or release. paid/cancelled require explicit evidence; otherwise scheduled.
- History is an actual change already shown by AS OF, not a current snapshot rewritten as an event. Only family stake targets. Fields: percent, holder, voter, beneficiary, restriction. Preserve the direction: who used to hold or exercise the right, and who does now. A change in feelings alone never changes legal rights. Unknown before/after or date stays empty. Unknown is not none or zero. Do not invent a transfer from the present ownership alone.
- Every source story schedule and every history entry includes an exact supporting excerpt from STORY INPUT, never from TARGETS or earlier generated records. The excerpt must support the date, condition and parties, not merely name the company. Put source message/section numbers in ref when available. A historical date may be empty if unspecified; a schedule without a date is omitted.
- No currency amounts or credited dividends: this request cannot alter balances or the current rights card. History records explain events, not instructions to change the portfolio.
OUTPUT JSON only
{"schedules":[{"target":"provided key","kind":"dividend|meeting|release|delegation","date":"YYYY-MM-DD","title":"short title","status":"scheduled|paid|cancelled","source":"guess|story","evidence":"exact excerpt for story; empty for guess","ref":""}],
"history":[{"target":"stake key","field":"percent|holder|voter|beneficiary|restriction","date":"YYYY-MM-DD or empty","before":"","after":"","evidence":"exact excerpt","ref":""}]}
At most 16 schedules and 16 changes. Keep the original names and full years. Output no other keys.`;
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
    const source = await sideRequest(m,p.owner,[]);
    const targets = investmentTargets(inv).filter(t => mode !== 'notes' || t.key === target);
    const appContext = mode === 'notes' && target.startsWith('stock:') ? { trades: inv.trades.filter(t => `stock:${t.symbol}` === target).slice(-8), watch: inv.watch.filter(w => `stock:${w.symbol}` === target) } : null;
    const input = `${source}\n\n[AS OF]\n${inv.date}\n[MODE]\n${mode}\n[TARGETS — identification only]\n${JSON.stringify(targets)}${mode === 'records' ? `\n[EXISTING SCHEDULES — app data, not evidence]\n${JSON.stringify(inv.schedules || [])}` : ''}${appContext ? `\n[APP CONTEXT — imagination, not evidence]\n${JSON.stringify(appContext)}` : ''}`;
    const raw = json(await askDraft(input,{system:mode === 'notes' ? INVEST_NOTES_SYS : INVEST_RECORDS_SYS,maxTokens:mode === 'notes' ? 2000 : 6500}));
    const got = parseInvestmentRecords(raw,inv,source,mode,target);
    if (mode === 'notes' && !got.notes.length) throw new Error('사용할 수 있는 투자 노트를 받지 못했어요');
    mergeInvestmentRecords(inv,got);
    if (mode === 'records') inv.recordsChecked = inv.date;
    await saveMeta();
    return got;
}
