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
Explicit amounts, dates, ownership and restrictions win. Infer a plausible personal investment scale from business reach, current personal ownership/access, lifestyle and spending; neither flatten a wealthy heir into a salary earner nor credit company or family assets to personal cash.
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
