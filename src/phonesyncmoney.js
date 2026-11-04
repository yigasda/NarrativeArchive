// 새로 일어난 일 반영 · 돈: one story event's payments, transfers, trades, orders and tickets, applied to the bank, the card,
// the brokerage, the shop and the wallet. The model reads the story; the numbers are worked out here.
// - an app made after the event's message already holds it; nothing moves
// - a record the model points at ("already") already holds it
// - "again" means the message only talks about money moved before: it moves nothing. Without "new", a record with the
//   same account, same day and amount (and the same place when both name one; for a guessed amount, the same place) is that one.
// - "new" means it happens in this message: it goes in even beside a same-day twin, as long as the twin came from another
//   message (the same payment twice in one message is one). Another day, another place or another price is another payment.
// - an event seen before keeps the amounts it was given then; only a guessed amount the story later states is corrected,
//   on the same record (no second payment), once
// - balances may go below zero; no money is made up to cover a payment
// Every change is listed in `effects` (a copy of each record as it went in), so 복구 can add back what a save lost, and
// 되돌리기 can tell a record the user changed since, without touching anything else.
import { addPrice, baseline, cash, currency, finance, finite, fx, migrateBank, positions, round, uid } from './finance.js';
import { boxAt, dayGap, lifeReplay, lifeRevert } from './phonesynclife.js';
import { dishPic } from './phonefood.js';
import { byStory, giftOf, hhmm, num, when } from './phoneparse.js';

const STEP = { ordered: 0, shipped: 1, 'on the way': 2, delivered: 3 };
const ORDER = ['ordered', 'shipped', 'on the way', 'delivered', 'unknown', 'cancelled', 'returning', 'returned', 'refunded'];
const txt = (v, n = 80) => (v !== null && typeof v === 'object' ? '' : String(v ?? '')).replace(/\s+/g, ' ').trim().slice(0, n);
// a model's list of records: a null or a bare word in it is no record
const list = v => (Array.isArray(v) ? v.filter(x => x && typeof x === 'object' && !Array.isArray(x)) : []);
const day = s => { const mt = /^(\d{2})-(\d{2})/.exec(String(s || '')); return mt ? Date.UTC(2001, mt[1] - 1, mt[2]) : NaN; };
// days apart, across New Year too (12-31 and 01-01 are one day apart)
const near = (a, b, days = 1) => { const d = Math.abs(day(a) - day(b)); return Math.min(d, 365 * 86400000 - d) <= days * 86400000; };
// a twin only stands for this one if the model didn't say it happens here, or both come from the same message, or (on a
// retry) from a message read together with this one before
let together = null;
const fresh = (x, twin, at) => x.occurrence === 'new' && twin.sourceIndex !== at
    && !(together && twin.sourceIndex >= together[0] && twin.sourceIndex <= together[1]);
const plain = s => String(s || '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');
const samePlace = (a, b) => !!plain(a) && plain(a) === plain(b);
const fail = why => { throw new Error(why); };
// a later state only: delivered never goes back to shipped; a cancellation or return can come at any point
const later = (was, now) => !(was in STEP && now in STEP && STEP[now] < STEP[was]) && !(['cancelled', 'returned', 'refunded'].includes(was) && now in STEP);

// the bank account a move names: its last 4 digits; else its name ("신한카드", "Giro"); else, for a card payment, the one
// credit card, or for anything else the one current account
function accountOf(p, x) {
    const as = p.money?.bank?.accounts || [], raw = String(x.account ?? '').trim(), d4 = raw.replace(/\D/g, '').slice(-4);
    const byNo = d4.length === 4 && as.find(a => a.last4 === d4);
    if (byNo) return byNo;
    const w = plain(raw);
    const byName = w && as.find(a => plain(a.name) && (w.includes(plain(a.name)) || plain(a.name).includes(w)));
    if (byName) return byName;
    const pick1 = xs => (xs.length === 1 ? xs[0] : null);
    if (x.kind === 'card' || /card|karte|카드|credit/i.test(raw)) return pick1(as.filter(a => a.kind === 'credit'));
    return pick1(as.filter(a => a.kind === 'checking')) || pick1(as);
}
// a story day n days on ("MM-DD", a leap February assumed)
const plusDays = (day, n) => { const mt = /^(\d{2})-(\d{2})$/.exec(day || ''); if (!mt) return ''; const d = new Date(Date.UTC(2000, mt[1] - 1, Number(mt[2]) + n)); return `${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`; };
const fullDay = (year, anchor, date) => {
    const a = /^(\d{4})-(\d{2})-(\d{2})$/.exec(anchor || '');
    if (!a || !/^\d{2}-\d{2}$/.test(date || '')) return `${year}-${date}`;
    const d = new Date(Date.UTC(Number(a[1]), a[2] - 1, Number(a[3]) + dayGap(`${a[2]}-${a[3]}`, date)));
    return `${d.getUTCFullYear()}-${date}`;
};
// what the model sees of the money apps
export function moneyNow(p) {
    const mo = p.money;
    if (!mo) return null;
    return {
        accounts: mo.bank.accounts.map(a => ({ account: a.last4, kind: a.kind, name: a.name, currency: a.currency, ...(a.kind === 'credit' ? {} : { balance: a.balance }) })),
        tx: (mo.tx || []).slice(-15).map(t => ({ id: t.id, account: t.account, time: t.time, who: t.who, amount: t.amount })),
        orders: (mo.orders || []).slice(-8).map(o => ({ id: o.id, shop: o.shop, item: o.item, price: o.price, status: o.status, time: o.time })),
        passes: (mo.passes || []).slice(-6).map(x => ({ id: x.id, kind: x.kind, by: x.by, date: x.date, status: x.status })),
    };
}
export function investNow(m, p) {
    const inv = p.investment;
    if (!inv) return null;
    const f = finance(m);
    return {
        accounts: inv.accounts.map(a => ({ account: `broker:${a.currency}`, currency: a.currency, cash: f.accounts[a.key] ? cash(f.accounts[a.key]) : null })),
        holdings: positions(inv.trades || []).filter(h => h.quantity > 0).map(h => ({ symbol: h.symbol, name: inv.securities.find(s => s.symbol === h.symbol)?.name || '', quantity: h.quantity, currency: h.currency })),
        trades: (inv.trades || []).slice(-10).map(t => ({ id: t.id, date: t.date, kind: t.kind, symbol: t.symbol, quantity: t.quantity, price: t.price })),
        watch: (inv.watch || []).map(w => ({ symbol: w.symbol, name: inv.securities.find(s => s.symbol === w.symbol)?.name || '' })),
    };
}

// e: { id, at, date: 'MM-DD', time, summary, money }; opts: { year, marks, legs: what this event did before }
// edited: the message was changed by the user after it was read, so its amounts may be corrected even when stated
// anchor: the day ("YYYY-MM-DD") the year was read from; an event's day is taken as the one nearest it, so a story going
// past New Year books January in the next year
export function applyMoney(m, p, e, { year, anchor = '', marks = {}, legs: prior = [], span = null, edited = false } = {}) {
    together = span;
    const out = { effects: [], changes: [], notes: [], legs: [] };
    const mo = e.money;
    if (!mo || typeof mo !== 'object') return out;
    // a record's id: the event's, unique on the phone and in the ledgers (the same event told again in a later round adds
    // its own records, never one with an id already taken)
    const taken = new Set([...['tx', 'orders', 'passes'].flatMap(k => (p.money?.[k] || []).map(x => x.id)), ...(p.investment?.trades || []).map(x => x.id),
        ...(p.delivery?.orders || []).map(x => x.id), ...(p.delivery?.shops || []).map(x => x.id), ...Object.values(finance(m).accounts || {}).flatMap(a => Object.keys(a.entries || {}))]);
    const sid = base => { let id = base, n = 2; while (taken.has(id)) id = `${base}~${n++}`; taken.add(id); return id; };
    // numbers as the model may write them ("-32,000", "₩4,000", "12,50"): read once, before anything uses them
    const nums = (o, keys) => { for (const k of keys) if (typeof o[k] === 'string') { const v = num(o[k]); o[k] = v === null ? o[k] : v; } };
    for (const x of list(mo.moves)) nums(x, ['amount', 'fee']);
    for (const x of list(mo.trades)) nums(x, ['quantity', 'price', 'fee', 'amount']);
    for (const x of list(mo.orders)) nums(x, ['price', 'qty']);
    for (const x of list(mo.deliveries)) { nums(x, ['fee', 'tip', 'discount', 'for']); for (const d of list(x.items)) nums(d, ['price', 'qty']); if (x.newShop && typeof x.newShop === 'object') { nums(x.newShop, ['rating', 'reviews', 'fee', 'minOrder']); for (const d of list(x.newShop.menu)) nums(d, ['price']); } }
    const f = finance(m), guess = mo.amountFrom === 'guess', date = e.date, full = fullDay(year, anchor, date);
    const bankOn = !!p.money && e.at > (marks.money?.index ?? -1), investOn = !!p.investment && e.at > (marks.invest?.index ?? -1);
    if ((list(mo.moves).length || list(mo.trades).length || list(mo.orders).length || list(mo.passes).length || list(mo.deliveries).length) && !/^\d{2}-\d{2}$/.test(date || '')) fail('돈이 움직인 날짜를 확인하지 못했어요');
    const seen = key => prior.find(l => l.key === key);
    // a guessed amount the story now states: the record and its ledger line change by the difference
    const amend = (t, amount, lk, label, acct) => {
        const was = t.amount;
        t.amount = round(amount); delete t.amountFrom;
        out.effects.push({ type: 'amend', path: 'money.tx', id: t.id, from: was, to: t.amount });
        const line = lk && f.accounts[lk]?.entries[t.id];
        if (line) { out.effects.push({ type: 'amendEntry', key: lk, id: t.id, from: line.amount, to: t.amount }); line.amount = t.amount; }
        out.notes.push(edited ? `${t.who || label}: 고친 대화에 맞춰 ${was} → ${t.amount}로 고쳤어요` : `${t.who || label}: 추정 ${was} → 실제 ${t.amount}로 고쳤어요`);
        out.changes.push({ app: acct.kind === 'credit' ? '카드' : '은행', label, amount: round(t.amount - was), currency: acct.currency });
    };
    const keep = (key, amount, fix) => {
        const old = seen(key);
        if (!old) return false;
        if (finite(amount) && finite(old.amount) && Math.abs(old.amount - amount) > 0.01) {
            if (fix && old.state === 'applied' && (edited || old.from === 'guess' && !guess)) { fix(old.rec, amount); out.legs.push({ ...old, amount: round(amount), from: 'story' }); return true; }
            out.notes.push(`${txt(e.summary, 40)}: 처음 정한 금액(${old.amount})을 그대로 뒀어요`);
        }
        out.legs.push(old);
        return true;
    };
    const from = guess ? 'guess' : 'story';

    // an account the owner opens comes first, so a move into it in the same event lands there (not on the one current
    // account), and its opening deposit is only what those moves don't already bring in
    if (bankOn && mo.newAccount && typeof mo.newAccount === 'object') {
        const a = mo.newAccount, accts = p.money.bank.accounts, kind = ['checking', 'savings', 'credit'].includes(a.kind) ? a.kind : 'checking', last4 = String(a.last4 || '').replace(/\D/g, '').slice(-4), cur = String(a.currency || p.money.currency || '').toUpperCase();
        const bal = kind === 'credit' ? 0 : (finite(Number(a.balance)) ? Number(a.balance) : 0);
        if (!/^\d{4}$/.test(last4) || !currency(cur)) fail('새 계좌의 끝 4자리나 통화를 확인하지 못했어요');
        if (!accts.some(x => x.last4 === last4)) {
            const acct = { id: uid(), kind, name: txt(a.name, 60) || (kind === 'savings' ? '적금' : kind === 'credit' ? '카드' : '입출금'), last4, currency: cur, balance: bal, ev: e.id, sourceIndex: e.at };
            // the ledger opens empty on the event's day; what it holds is its first row (an opening deposit the owner can see)
            if (kind !== 'credit') { const L = baseline(m, acct.id, cur, 0, full, p.owner); const into = list(mo.moves).filter(x => x.occurrence !== 'again' && !x.already && Number(x.amount) > 0 && String(x.account ?? '').replace(/\D/g, '').slice(-4) === last4).reduce((n, x) => n + Number(x.amount), 0), open = round(bal - into);
                if (open > 0.01) { const id = sid(`sync:${e.id}:open`), row = { id, account: last4, who: txt(a.name, 60) || acct.name, ko: '', amount: open, time: `${date}${e.time ? ` ${e.time}` : ''}`, day: full, kind: 'deposit', memo: '개설 입금', pending: false, ev: e.id, storyEvent: e.id, sourceIndex: e.at }; (p.money.tx ||= []).push(row); L.entries[id] = { amount: open, date: full, sourceIndex: e.at }; out.effects.push({ type: 'push', path: 'money.tx', item: structuredClone(row) }, { type: 'entry', key: `${acct.id}:${cur}`, id, amount: open, date: full, sourceIndex: e.at }); } }
            accts.push(acct);
            out.effects.push({ type: 'push', path: 'money.bank.accounts', item: structuredClone(acct) });
            out.changes.push({ app: '은행', label: `${acct.name} 계좌 개설`, amount: null });
        }
    }
    // money between the owner's own accounts: each pair compared on its own (other spending in the event aside).
    // bank ↔ brokerage always pairs; bank ↔ bank only when the event has just one out and one in. A fee on the out leg
    // ("fee") is what goes missing on the way.
    const own = list(mo.moves).filter(x => x.occurrence !== 'again' && !x.already);
    const cur = x => (/^broker:/i.test(String(x.account || '')) ? String(x.account).slice(7).toUpperCase() : accountOf(p, x)?.currency);
    // "amount" is what is sent and "fee" comes on top; an amount that already has the fee in it is taken as it is
    const feeOf = x => (finite(Number(x.fee)) && Number(x.fee) > 0 ? Number(x.fee) : 0);
    const sent = x => -Number(x.amount) - (x.withFee ? feeOf(x) : 0);
    const pairOff = (outs, ins) => { for (const y of ins) {
        const i = outs.findIndex(x => cur(x) === cur(y) && (Math.abs(-Number(x.amount) - Number(y.amount)) < 0.01 || feeOf(x) && Math.abs(-Number(x.amount) - feeOf(x) - Number(y.amount)) < 0.01 && (x.withFee = true)));
        if (i >= 0) outs.splice(i, 1); else if (outs.length === 1 && ins.length === 1 && cur(outs[0]) === cur(y)) fail('이체의 보낸 돈과 받은 돈이 달라요');
    } };
    const brokers = own.filter(x => /^broker:/i.test(String(x.account || ''))), bankT = own.filter(x => !/^broker:/i.test(String(x.account || '')) && x.kind === 'transfer');
    pairOff(bankT.filter(x => Number(x.amount) < 0), brokers.filter(x => Number(x.amount) > 0));
    pairOff(brokers.filter(x => Number(x.amount) < 0), bankT.filter(x => Number(x.amount) > 0));
    const bankOut = bankT.filter(x => Number(x.amount) < 0), bankIn = bankT.filter(x => Number(x.amount) > 0);
    if (!brokers.length && bankOut.length === 1 && bankIn.length === 1 && cur(bankOut[0]) === cur(bankIn[0])) pairOff([...bankOut], bankIn);
    // the fee leaves the account with the money
    for (const x of list(mo.moves)) if (Number(x.amount) < 0 && feeOf(x) && !x.withFee) { x.amount = Number(x.amount) - feeOf(x); x.withFee = true; }
    // an order that comes in already cancelled was never paid: its charge stays out, unless the same event also refunds it
    // and a refund of it in the same event goes too: the order came and went before any money moved
    const voided = new Set();
    for (const o of list(mo.orders).filter(o => o.status === 'cancelled' && !o.already && o.occurrence !== 'again')) {
        const c = round((Number(o.price) || 0) * Math.max(1, Math.round(Number(o.qty) || 1)));
        const pay = list(mo.moves).findIndex((x, k) => !voided.has(k) && Math.abs(Number(x.amount) + c) < 0.01);
        if (c <= 0 || pay < 0) continue;
        voided.add(pay);
        const back = list(mo.moves).findIndex((x, k) => !voided.has(k) && Math.abs(Number(x.amount) - c) < 0.01);
        if (back >= 0) voided.add(back);
        out.notes.push(`${txt(o.item, 40)}: 취소된 주문이라 결제${back >= 0 ? '·환불' : ''}을 넣지 않았어요`);
    }
    list(mo.moves).forEach((x, k) => {
        let amount = Number(x.amount);
        const broker = /^broker:/i.test(String(x.account || ''));
        if (voided.has(k)) { out.legs.push({ key: `void:${k}`, amount, state: 'cancelled' }); return; }
        if (amount === 0) { out.legs.push({ key: `zero:${k}`, amount: 0, state: 'zero' }); return; }
        if (!finite(amount)) fail('금액을 확인하지 못했어요');
        if (broker ? !investOn : !bankOn) { out.legs.push({ key: `before:${x.account}`, amount, state: 'before' }); return; }
        if (broker) {
            const cur = String(x.account).slice(7).toUpperCase(), a = p.investment.accounts.find(y => y.currency === cur), L = a && f.accounts[a.key];
            if (!L) fail('증권 계좌를 찾지 못했어요');
            const key = `broker:${cur}:${amount < 0 ? '-' : '+'}`;
            if (keep(key, amount, rec => { const line = L.entries[rec]; if (!line) return; out.effects.push({ type: 'amendEntry', key: a.key, id: rec, from: line.amount, to: round(amount) }); out.notes.push(`증권 ${cur}: 추정 ${line.amount} → 실제 ${round(amount)}로 고쳤어요`); out.changes.push({ app: '투자', label: `증권 ${cur}`, amount: round(amount - line.amount), currency: cur }); line.amount = round(amount); })) return;
            const twin = Object.entries(L.entries).find(([, v]) => Math.abs(v.amount - amount) < 0.01 && near(String(v.date).slice(5), date, 0) && !fresh(x, v, e.at));
            if (!twin && x.occurrence === 'again') { out.legs.push({ key, amount: round(amount), state: 'again' }); return; }
            if (twin) { out.legs.push({ key, amount: round(amount), state: 'included', rec: twin[0] }); out.notes.push(`증권 ${cur} ${round(amount)}: 이미 있는 거래라 넣지 않았어요`); return; }
            const id = sid(`sync:${e.id}:m${k}`);
            L.entries[id] = { amount: round(amount), date: full, sourceIndex: e.at };
            out.effects.push({ type: 'entry', key: a.key, id, amount: round(amount), date: full, sourceIndex: e.at });
            out.changes.push({ app: '투자', label: `증권 ${cur}`, amount: round(amount), currency: cur });
            out.legs.push({ key, amount: round(amount), state: 'applied', rec: id, from });
            return;
        }
        const acct = accountOf(p, x);
        if (!acct) fail('계좌를 찾지 못했어요');
        // an amount in another currency (€20 on a KRW card abroad) is booked in the account's, at the day's rate; the memo keeps the original
        const xc = String(x.currency || '').trim().toUpperCase();
        if (/^[A-Z]{3}$/.test(xc) && xc !== acct.currency) {
            const rate = fx(m, xc, acct.currency, full);
            if (rate === null) fail(`${xc}→${acct.currency} 환율이 없어서 ${xc} 결제를 적지 못했어요`);
            const orig = amount; amount = round(amount * rate);
            x.memo = [txt(x.memo), `${xc} ${Math.abs(orig)}`].filter(Boolean).join(' · ');
        }
        // one leg per account, direction and payee: the same event told again may carry another payment on the same account
        // (its refund, a second shop), which is not the first one with another amount
        const key = `bank:${acct.id}:${amount < 0 ? '-' : '+'}:${plain(x.who)}`, lk = acct.kind === 'credit' ? '' : `${acct.id}:${acct.currency}`, label = `${acct.name || ''} ••••${acct.last4}`.trim();
        const tx = p.money.tx ||= [];
        // (a payment the model calls new, on another day than the one this event paid before: the model gave a new event an
        // old event's name, "taxi" for the next day's taxi; it is paid)
        const leg0 = seen(key), day0 = leg0 && String(tx.find(r => r.id === leg0.rec)?.time || '').slice(0, 5), otherDay = x.occurrence === 'new' && /^\d{2}-\d{2}$/.test(day0 || '') && /^\d{2}-\d{2}/.test(String(date || '')) && day0 !== String(date).slice(0, 5);
        if (!otherDay && keep(key, amount, rec => { const t = tx.find(r => r.id === rec); if (t) amend(t, amount, lk, label, acct); })) return;
        const pointed = x.already && tx.find(t => t.id === x.already);
        const match = t => t.account === acct.last4 && near(t.time, date, 0) && Math.sign(t.amount) === Math.sign(amount)
            && (Math.abs(t.amount - amount) < 0.01 && (!plain(t.who) || !plain(x.who) || samePlace(t.who, x.who)) || (guess || t.amountFrom === 'guess') && samePlace(t.who, x.who));
        const twin = !pointed && tx.find(t => match(t) && !fresh(x, t, e.at));
        if (!pointed && !twin && tx.some(match)) out.notes.push(`${txt(x.who, 40) || acct.name} ${round(amount)}: 같은 날 같은 결제가 하나 더 있어요 (새 결제라고 해서 따로 넣었어요)`);
        if (!pointed && !twin && x.occurrence === 'again') { out.legs.push({ key, amount: round(amount), state: 'again' }); out.notes.push(`${txt(x.who, 40) || acct.name} ${round(amount)}: 전에 있었던 결제라 넣지 않았어요`); return; }
        if (pointed && pointed.amountFrom === 'guess' && !guess && Math.sign(pointed.amount) === Math.sign(amount) && Math.abs(pointed.amount - amount) > 0.01) { amend(pointed, amount, lk, label, acct); out.legs.push({ key, amount: round(amount), state: 'included', rec: pointed.id }); return; }
        if (twin && twin.amountFrom === 'guess' && !guess && Math.abs(twin.amount - amount) > 0.01) { amend(twin, amount, lk, label, acct); out.legs.push({ key, amount: round(amount), state: 'included', rec: twin.id }); return; }
        if (pointed || twin) {
            const r = pointed || twin;
            if (r.sourceIndex === null) r.sourceIndex = e.at;
            out.legs.push({ key, amount: round(amount), state: 'included', rec: r.id });
            if (twin) out.notes.push(`${twin.who || acct.name} ${twin.amount}: 이미 있는 거래라 넣지 않았어요`);
            return;
        }
        const id = sid(`sync:${e.id}:m${k}`);
        const row = { id, account: acct.last4, who: txt(x.who, 60), ko: txt(x.ko, 60), amount: round(amount), time: `${date}${e.time ? ` ${e.time}` : ''}`, day: full,
            // on the card everything is a card row (a refund is plus), except paying the card off: a transfer, which the month's count leaves out
            kind: acct.kind === 'credit' ? (x.kind === 'transfer' ? 'transfer' : 'card') : ['card', 'transfer', 'deposit', 'cash'].includes(x.kind) ? x.kind : amount > 0 ? 'deposit' : 'card', memo: txt(x.memo), pending: false, ev: e.id, storyEvent: e.id, sourceIndex: e.at, ...(guess ? { amountFrom: 'guess' } : {}) };
        // a card payment just made waits for approval through its day (the clock settles it the next)
        const nowDay = String(p.now || '').slice(0, 5);
        row.pending = row.kind === 'card' && row.amount < 0 && !(/^\d{2}-\d{2}$/.test(nowDay) && /^\d{2}-\d{2}$/.test(date) && dayGap(date, nowDay) > 0);
        tx.push(row);
        out.effects.push({ type: 'push', path: 'money.tx', item: structuredClone(row) });
        if (acct.kind !== 'credit') {
            const lk = `${acct.id}:${acct.currency}`, L = f.accounts[lk];
            if (!L) fail('계좌 장부를 찾지 못했어요');
            L.entries[id] = { amount: round(amount), date: full, sourceIndex: e.at };
            out.effects.push({ type: 'entry', key: lk, id, amount: round(amount), date: full, sourceIndex: e.at });
        }
        out.changes.push({ app: acct.kind === 'credit' ? '카드' : '은행', label, amount: round(amount), currency: acct.currency });
        out.legs.push({ key, amount: round(amount), state: 'applied', rec: id, from });
    });

    list(mo.trades).forEach((t, k) => {
        if (!investOn) { out.legs.push({ key: `before:trade:${k}`, state: 'before' }); return; }
        const inv = p.investment, kind = t.kind, symbol = txt(t.symbol, 80), cur = (c => (/^[A-Z]{3}$/.test(c) ? c : inv.securities.find(s => s.symbol === symbol)?.currency || (inv.accounts.length === 1 ? inv.accounts[0].currency : c)))(String(t.currency || '').trim().toUpperCase());
        if (!['buy', 'sell', 'dividend'].includes(kind) || !symbol) fail('투자 거래 종류나 종목을 확인하지 못했어요');
        const key = `trade:${kind}:${symbol}`, size = kind === 'dividend' ? Number(t.amount) : Number(t.quantity);
        if (keep(key, size)) return;
        const pointed = t.already && inv.trades.find(x => x.id === t.already);
        const twin = !pointed && inv.trades.find(x => x.symbol === symbol && x.kind === kind && near(String(x.date).slice(5), date, 0)
            && (kind === 'dividend' ? Math.abs(x.amount - size) < 0.01 : x.quantity === size && Math.abs(x.price - Number(t.price)) <= Math.abs(x.price) * 0.01) && !fresh(t, x, e.at));
        if (!pointed && !twin && t.occurrence === 'again') { out.legs.push({ key, amount: size, state: 'again' }); return; }
        if (pointed || twin) {
            out.legs.push({ key, amount: size, state: 'included', rec: (pointed || twin).id });
            if (twin) out.notes.push(`${symbol} ${kind === 'sell' ? '매도' : kind === 'buy' ? '매수' : '배당'}: 이미 있는 거래라 넣지 않았어요`);
            return;
        }
        const a = inv.accounts.find(y => y.currency === cur), L = a && f.accounts[a.key];
        if (!L) fail('그 통화의 증권 계좌가 없어요');
        if (!inv.securities.some(s => s.symbol === symbol)) {
            if (!txt(t.name)) fail('새 종목의 이름이 필요해요');
            const sec = { symbol, name: txt(t.name, 100), ko: txt(t.ko, 100), currency: cur };
            inv.securities.push(sec);
            out.effects.push({ type: 'push', path: 'investment.securities', item: structuredClone(sec), idKey: 'symbol' });
        }
        const quantity = Number(t.quantity), price = Number(t.price), fee = finite(Number(t.fee)) ? Number(t.fee) : 0, amount = Number(t.amount);
        if (kind === 'dividend' ? !finite(amount) || amount <= 0 : !finite(quantity) || quantity <= 0 || !finite(price) || price < 0) fail('매매 수량이나 가격을 확인하지 못했어요');
        const id = sid(`sync:${e.id}:t${k}`);
        const trade = { id, kind, symbol, currency: cur, date: full, time: e.time || '', quantity: kind === 'dividend' ? undefined : quantity, price: kind === 'dividend' ? undefined : price, fee: kind === 'dividend' ? undefined : fee, amount: kind === 'dividend' ? amount : undefined,
            source: guess ? 'guess' : 'story', storyEvent: e.id, sourceIndex: e.at, rateAtTrade: fx(m, cur, inv.base, full) };
        try { positions([...inv.trades, trade]); } catch { fail('가진 것보다 많이 판 거래예요'); }
        inv.trades.push(trade);
        const flow = kind === 'buy' ? -(quantity * price + fee) : kind === 'sell' ? quantity * price - fee : amount;
        L.entries[id] = { amount: round(flow), date: full };
        out.effects.push({ type: 'push', path: 'investment.trades', item: structuredClone(trade) }, { type: 'entry', key: a.key, id, amount: round(flow), date: full });
        if (full > (inv.date || '')) { out.effects.push({ type: 'field', path: 'investment', field: 'date', from: inv.date ?? null, to: full }); inv.date = full; }
        out.changes.push({ app: '투자', label: `${inv.securities.find(x => x.symbol === symbol)?.name || symbol} ${kind === 'buy' ? '매수' : kind === 'sell' ? '매도' : '배당'}${kind === 'dividend' ? '' : ` ${quantity}주`}`, amount: round(flow), currency: cur });
        out.legs.push({ key, amount: size, state: 'applied', rec: id });
    });

    // two orders or tickets in one answer are two (two scarves, two seats), never the second taken for the first
    const madeNow = new Set();
    const records = (path, rows, make, same) => rows.forEach((x, k) => {
        if (!bankOn) return;
        const box = p.money[path] ||= [];
        // the same event's own record told again (its message rewritten and read anew) is that one, not a second
        const old = x.already && box.find(o => o.id === x.already) || box.find(o => !madeNow.has(o) && same(o, x) && (!fresh(x, o, e.at) || o.ev === e.id));
        if (!old && x.occurrence === 'again') return;
        if (old && old.sourceIndex == null) old.sourceIndex = e.at;
        if (old) {
            // an order's status only moves forward; a pass's is free text ("used", "checked in", "cancelled"): whatever it says now
            const next = path === 'passes' ? txt(x.status, 30) : x.status;
            if (next && next !== old.status && (path === 'passes' || ORDER.includes(next) && later(old.status, next))) {
                const was = old.status, arrivedFrom = old.arrived ?? null;
                old.status = next;
                if (path === 'orders' && x.status === 'delivered' && /^\d{2}-\d{2}$/.test(date || '')) old.arrived ||= date;
                // (its arrival day goes back with it)
                out.effects.push({ type: 'status', path: `money.${path}`, id: old.id, status: next, prev: was, ...((old.arrived ?? null) !== arrivedFrom ? { arrivedFrom, arrived: old.arrived } : {}) });
                out.changes.push({ app: path === 'orders' ? '쇼핑' : '지갑', label: `${old.item || old.by} 상태`, amount: null });
            }
            // told again by another event as it was: that event knows it too (빼기 of the first leaves it while this talk stays)
            else if (old.ev !== e.id) out.effects.push({ type: 'seen', path: `money.${path}`, id: old.id });
            return;
        }
        const row = { ...make(x), id: sid(`sync:${e.id}:${path[0]}${k}`), ev: e.id, storyEvent: e.id, sourceIndex: e.at };
        if (path === 'orders' && row.status !== 'cancelled' && row.price && x.paid !== false && !x.gift && !list(mo.moves).some(y => Number(y.amount) < 0)) out.notes.push(`${row.item}: 주문은 넣었지만 결제가 없었어요`);
        box.push(row); madeNow.add(row);
        out.effects.push({ type: 'push', path: `money.${path}`, item: structuredClone(row) });
        out.changes.push({ app: path === 'orders' ? '쇼핑' : '지갑', label: row.item || row.by, amount: null });
    });
    records('orders', list(mo.orders), x => {
        const price = Number(x.price);
        if (!txt(x.item) || !txt(x.shop)) fail('주문의 가게나 물건을 확인하지 못했어요');
        return { shop: txt(x.shop, 60), item: txt(x.item), ko: txt(x.ko), option: txt(x.option, 60), qty: Math.max(1, Math.round(Number(x.qty) || 1)), price: finite(price) ? price : null, time: date, status: ORDER.includes(x.status) ? x.status : 'ordered', eta: when(x.eta).slice(0, 5) || (['ordered', 'shipped', 'on the way'].includes(x.status) || !ORDER.includes(x.status) ? plusDays(date, 2 + [...txt(x.shop)].reduce((n, c) => (n + c.charCodeAt(0)) % 3, 0)) : ''), arrived: '', gift: giftOf(x.gift), ...(x.paid === false ? { paid: false } : {}), ...(guess ? { amountFrom: 'guess' } : {}) };
    }, (o, x) => samePlace(o.shop, x.shop) && samePlace(o.item, x.item) && near(o.time, date) && !(o.option && txt(x.option, 60) && !samePlace(o.option, txt(x.option, 60))));
    records('passes', list(mo.passes), x => {
        if (!txt(x.by)) fail('티켓 정보를 확인하지 못했어요');
        return { kind: ['flight', 'train', 'hotel', 'event', 'other'].includes(x.kind) ? x.kind : 'other', by: txt(x.by, 60), from: txt(x.from, 40), to: txt(x.to, 40), date: when(x.date).slice(0, 5) || date, time: hhmm(x.time), seat: txt(x.seat, 12), gate: txt(x.gate, 12), no: txt(x.no, 24), status: txt(x.status, 30) };
    }, (o, x) => samePlace(o.by, x.by) && o.kind === x.kind && (o.no && o.no === txt(x.no, 24) || o.date === (when(x.date).slice(0, 5) || date)));
    // 배달: an order in the delivery app. Its payment is a move of the same event (the card or bank row it made, or one
    // already there), tied to it here; with no paying move it was paid in cash at the door
    const dlvOn = !!p.delivery && e.at > (marks.delivery?.index ?? -1);
    list(mo.deliveries).forEach((x, k) => {
        if (!dlvOn) return;
        const box = p.delivery.orders ||= [];
        const items = list(x.items).map(d => { const optionKo = txt(d?.optionKo, 60), pic = dishPic(d?.pic, { name: txt(d?.name, 60), ko: txt(d?.ko, 60), option: txt(d?.option, 60), optionKo }); return { name: txt(d?.name, 60), ko: txt(d?.ko, 60), option: txt(d?.option, 60), ...(optionKo ? { optionKo } : {}), qty: Math.max(1, Math.round(Number(d?.qty) || 1)), price: finite(Number(d?.price)) ? Number(d.price) : 0, ...(pic ? { pic } : {}) }; }).filter(d => d.name).slice(0, 10);
        if (!txt(x.shop) || !items.length) fail('배달 주문의 가게나 메뉴를 확인하지 못했어요');
        const money = v => (finite(Number(v)) ? Math.abs(Number(v)) : 0), total = round(items.reduce((n, d) => n + d.qty * d.price, 0) + money(x.fee) + money(x.tip) - money(x.discount));
        // (told again without its prices, "the chicken came": the order of that shop that day still on its way is that one)
        const noPrice = items.every(d => !d.price), named = o => (o.items || []).some(a => items.some(b => samePlace(a.name, b.name)));
        const old = x.already && box.find(o => o.id === x.already) || box.find(o => samePlace(o.shop, x.shop) && near(String(o.time).slice(0, 5), date, 0) && Math.abs(dlvTotal(o) - total) < 0.01 && (!fresh(x, o, e.at) || o.ev === e.id))
            || noPrice && box.find(o => samePlace(o.shop, x.shop) && near(String(o.time).slice(0, 5), date, 0) && named(o) && o.status !== x.status && (x.status ? later(o.status, x.status) : o.status === 'on the way'));
        if (!old && x.occurrence === 'again') return;
        const status = ['on the way', 'delivered', 'cancelled', 'refunded'].includes(x.status) ? x.status : 'delivered';
        // one whose message is gone is tied to the message that tells it now
        if (old && old.sourceIndex == null) old.sourceIndex = e.at;
        if (old) {
            if (status !== old.status && later(old.status, status)) {
                out.effects.push({ type: 'status', path: 'delivery.orders', id: old.id, status, prev: old.status });
                old.status = status;
                delete old.byClock;
                out.changes.push({ app: '배달', label: `${old.shop} 상태`, amount: null });
            } else if (old.ev !== e.id) out.effects.push({ type: 'seen', path: 'delivery.orders', id: old.id });
            return;
        }
        const time = when(x.time) || `${date}${hhmm(x.time) || e.time ? ` ${hhmm(x.time) || e.time}` : ''}`;
        const row = { shop: txt(x.shop, 60), items, fee: money(x.fee), tip: money(x.tip), discount: money(x.discount), mode: x.mode === 'pickup' ? 'pickup' : 'delivery', time, arrived: when(x.arrived) || hhmm(x.arrived),
            to: txt(x.to, 40) || 'home', address: txt(x.address, 80), left: txt(x.left, 60), noteShop: txt(x.noteShop, 120), noteShopKo: txt(x.noteShopKo, 200), noteRider: txt(x.noteRider, 120), noteRiderKo: txt(x.noteRiderKo, 200),
            noCutlery: x.noCutlery === true, for: Math.max(1, Math.round(Number(x.for) || 1)), status, gift: giftOf(x.gift), reviewed: false, account: 'cash',
            id: sid(`sync:${e.id}:d${k}`), ev: e.id, storyEvent: e.id, sourceIndex: e.at, sync: true };
        // the same place always has the same address: home or work (or a person's) as the earlier orders wrote it
        const before = [...box].reverse().find(o => o.to === row.to && o.address);
        if (before) row.address = before.address;
        // the row that paid it: made by this event, or one already in the bank this event pointed at
        // (the same amount, else a payment to the same shop in this event: a tip left out or a rounding is still this order's)
        const paidHere = f => f.type === 'push' && f.path === 'money.tx' && !f.item.delivery && f.item.amount < 0;
        const made = out.effects.find(f => paidHere(f) && Math.abs(f.item.amount + total) < 0.01) || out.effects.find(f => paidHere(f) && samePlace(f.item.who, row.shop));
        const kept = !made && out.legs.find(l => l.state === 'included' && Math.abs(l.amount + total) < 0.01 && p.money?.tx?.some(t => t.id === l.rec && !t.delivery));
        const t = made ? p.money.tx.find(r => r.id === made.item.id) : kept ? p.money.tx.find(r => r.id === kept.rec) : null;
        if (t) { t.delivery = row.id; row.account = t.account; if (made) made.item.delivery = row.id; }
        else if (status !== 'cancelled' && total > 0 && !row.gift && p.money && list(mo.moves).length) out.notes.push(`${row.shop}: 배달은 넣었지만 결제를 찾지 못해서 현금으로 뒀어요`);
        box.push(row);
        out.effects.push({ type: 'push', path: 'delivery.orders', item: structuredClone(row) });
        out.changes.push({ app: '배달', label: row.shop, amount: null });
        // a shop the app doesn't have yet joins its list, with the model's dishes (or, without them, the ones ordered)
        const shops = p.delivery.shops ||= [];
        if (!shops.some(s => samePlace(s.name, row.shop))) {
            const ns = x.newShop && typeof x.newShop === 'object' ? x.newShop : {};
            const dish = (d, k) => { const pic = dishPic(d?.pic, { name: txt(d?.name, 60), ko: txt(d?.ko, 60) }); return { name: txt(d?.name, 60), ko: txt(d?.ko, 60), desc: txt(d?.desc, 100), price: finite(Number(d?.price)) ? Number(d.price) : 0, top: d?.top === true || (!list(ns.menu).some(y => y?.top === true) && k === 0), ...(pic ? { pic } : {}) }; };
            let menu = list(ns.menu).map(dish).filter(d => d.name).slice(0, 4);
            if (!menu.length) menu = items.slice(0, 4).map((d, k) => ({ name: d.name, ko: d.ko, desc: '', price: d.price, top: k === 0, ...(d.pic ? { pic: d.pic } : {}) }));
            const won = (p.money?.currency || p.money?.bank?.accounts?.[0]?.currency) === 'KRW', num = (v, lo, hi) => { const n = Number(v); return finite(n) && n >= lo && n <= hi ? n : null; };
            const st = shopStats(row.shop, won);
            const shop = { name: row.shop, ko: txt(ns.ko, 60), cuisine: txt(ns.cuisine, 30), rating: st.rating, reviews: st.reviews, fee: finite(Number(ns.fee)) ? Math.abs(Number(ns.fee)) : row.fee,
                minOrder: num(ns.minOrder, 0, 1e7) ?? st.minOrder, eta: txt(ns.eta, 12) || st.eta, fav: false, menu,
                id: sid(`sync:${e.id}:s${k}`), ev: e.id, sourceIndex: e.at };
            shops.push(shop);
            out.effects.push({ type: 'push', path: 'delivery.shops', item: structuredClone(shop) });
            // the list stays at ten: the oldest shop not kept as a favourite makes room
            if (shops.length > 10) { const old = shops.find(s => !s.fav && s !== shop); if (old) { shops.splice(shops.indexOf(old), 1); out.effects.push({ type: 'drop', path: 'delivery.shops', item: structuredClone(old) }); } }
        }
    });
    // 장바구니: dishes put in the basket and not ordered (null empties it); an order from that shop empties it too
    const setCart = (to, label) => { const was = p.delivery.cart ?? null; if (JSON.stringify(was) === JSON.stringify(to)) return; out.effects.push({ type: 'set', path: 'delivery.cart', from: structuredClone(was), to: structuredClone(to) }); p.delivery.cart = to; out.changes.push({ app: '배달', label, amount: null }); };
    if (dlvOn && mo.cart !== undefined && (mo.cart === null || typeof mo.cart === 'object')) {
        // a dish on the shop's menu costs what the menu says (the basket carries no story amount)
        const c = mo.cart, menu = c ? (p.delivery.shops || []).find(sh => samePlace(sh.name, c.shop))?.menu || [] : [];
        const items = c ? list(c.items).map(d => { const optionKo = txt(d?.optionKo, 60), name = txt(d?.name, 60), mi = menu.find(x => samePlace(x.name, name) || x.ko && samePlace(x.ko, name)), pic = dishPic(d?.pic || mi?.pic, { name, ko: txt(d?.ko, 60) || mi?.ko || '', option: txt(d?.option, 60), optionKo }); return { name, ko: txt(d?.ko, 60) || mi?.ko || '', option: txt(d?.option, 60), ...(optionKo ? { optionKo } : {}), qty: Math.max(1, Math.round(Number(d?.qty) || 1)), price: mi && finite(Number(mi.price)) ? Number(mi.price) : finite(Number(d?.price)) ? Number(d.price) : 0, ...(pic ? { pic } : {}) }; }).filter(d => d.name).slice(0, 8) : [];
        if (!c || !txt(c.shop) || !items.length) setCart(null, '장바구니 비움');
        else setCart({ shop: txt(c.shop, 60), items, noteShop: txt(c.noteShop, 120), noteShopKo: txt(c.noteShopKo, 120), noteRider: txt(c.noteRider, 120), noteRiderKo: txt(c.noteRiderKo, 120) }, `${txt(c.shop, 60)} 장바구니`);
    }
    if (dlvOn && p.delivery.cart && list(mo.deliveries).some(x => samePlace(x.shop, p.delivery.cart.shop) && x.occurrence !== 'again')) setCart(null, '장바구니 비움');
    // a new account or card (opened in these messages): the bank's list grows, its ledger starts at the event's day
    if (bankOn && mo.newCard && typeof mo.newCard === 'object') {
        const c = mo.newCard, last4 = String(c.account || '').replace(/\D/g, '').slice(-4), cards = p.money.cards ||= [];
        if (p.money.bank.accounts.some(x => x.last4 === last4) && !cards.some(x => x.account === last4)) {
            const card = { id: uid(), account: last4, exp: /^\d{2}\/\d{2}$/.test(String(c.exp || '')) ? String(c.exp) : '', ev: e.id, sourceIndex: e.at };
            cards.push(card);
            out.effects.push({ type: 'push', path: 'money.cards', item: structuredClone(card) });
            out.changes.push({ app: '지갑', label: '새 카드', amount: null });
        }
    }
    // 투자: a share they start watching, a price the story gives, a stake the story says they hold
    if (investOn) {
        const inv = p.investment;
        for (const w of list(mo.watch)) {
            const symbol = txt(w.symbol, 80), cur = String(w.currency || '').toUpperCase();
            if (!symbol || inv.watch.some(x => x.symbol === symbol)) continue;
            if (!inv.securities.some(x => x.symbol === symbol)) { if (!txt(w.name) || !currency(cur)) continue; const sec = { symbol, name: txt(w.name, 100), ko: txt(w.ko, 100), currency: cur }; inv.securities.push(sec); out.effects.push({ type: 'push', path: 'investment.securities', item: structuredClone(sec), idKey: 'symbol' }); }
            const row = { symbol, note: txt(w.note, 160), ko: txt(w.ko, 160), query: '', source: 'story', ev: e.id, sourceIndex: e.at };
            inv.watch.push(row);
            out.effects.push({ type: 'push', path: 'investment.watch', item: structuredClone(row), idKey: 'symbol' });
            out.changes.push({ app: '투자', label: `${inv.securities.find(x => x.symbol === symbol)?.name || symbol} 관심 종목`, amount: null });
        }
        for (const q of list(mo.quotes)) {
            const symbol = txt(q.symbol, 80), value = Number(q.value), d = /^\d{4}-\d{2}-\d{2}$/.test(String(q.date || '')) ? String(q.date) : fullDay(year, anchor, when(q.date).slice(0, 5) || date);
            if (!inv.securities.some(x => x.symbol === symbol) || !finite(value) || value <= 0 || !/^\d{4}-\d{2}-\d{2}$/.test(d || '')) continue;
            try {
                const before = finance(m).prices[`STOCK:${symbol}`]?.[d], had = new Set((before?.rows || []).map(r => r.id)), prev = before ? { selected: before.selected, conflict: before.conflict } : null;
                const slot = addPrice(m, `STOCK:${symbol}`, d, { value, source: 'story', ref: txt(q.evidence, 200) }), row = slot.rows.find(r => !had.has(r.id));
                if (row) out.effects.push({ type: 'price', key: `STOCK:${symbol}`, date: d, id: row.id, row: structuredClone(row), prev });
                if (d > (inv.date || '')) { out.effects.push({ type: 'field', path: 'investment', field: 'date', from: inv.date ?? null, to: d }); inv.date = d; }
                out.changes.push({ app: '투자', label: `${inv.securities.find(x => x.symbol === symbol)?.name || symbol} 시세`, amount: null }); } catch { /* a price the ledger refuses */ }
        }
        for (const st of list(mo.stakes)) {
            const company = txt(st.company, 100), evidence = txt(st.evidence, 300);
            if (!company || !evidence || (inv.stakes ||= []).some(x => samePlace(x.company, company))) continue;
            const n = (v, lo, hi) => { const x = Number(v); return finite(x) && x >= lo && x <= hi ? x : null; };
            const row = { id: uid(), company, listed: typeof st.listed === 'boolean' ? st.listed : null, percent: n(st.percent, 0, 100), holder: txt(st.holder), voter: txt(st.voter), beneficiary: txt(st.beneficiary), restriction: txt(st.restriction, 200), value: n(st.value, 0, 1e15), currency: currency(String(st.currency || '').toUpperCase()) ? String(st.currency).toUpperCase() : inv.base, evidence, source: 'story', ev: e.id, sourceIndex: e.at };
            inv.stakes.push(row);
            out.effects.push({ type: 'push', path: 'investment.stakes', item: structuredClone(row) });
            out.changes.push({ app: '투자', label: `${company} 지분`, amount: null });
        }
    }
    return out;
}
// what a delivery order came to (the model never writes it)
export const dlvTotal = o => round((o.items || []).reduce((n, x) => n + x.qty * x.price, 0) + (o.fee || 0) + (o.tip || 0) - (o.discount || 0));

// 배달 app payments (its first fill, or a bank made after it): one bank row per paid order (and a plus row for a refund), tied by the order's id and its "ev".
// An order on a debit account also gets its ledger line, so the balance moves. "card" without a bank waits for one.
const PAY = 'dlv-';
const payAccount = (p, o) => {
    const as = p.money?.bank?.accounts || [];
    if (o.account === 'cash') return null;
    return as.find(a => a.last4 === o.account) || (o.account === 'card' ? as.find(a => a.kind === 'credit') || as.find(a => a.kind === 'checking') || as[0] : null) || null;
};
export function unpayOrders(m, p) {
    const tx = p.money?.tx;
    if (!tx) return;
    const f = finance(m), gone = tx.filter(t => String(t.id || '').startsWith(PAY));
    for (const t of gone) for (const L of Object.values(f.accounts)) delete L.entries[t.id];
    p.money.tx = tx.filter(t => !gone.includes(t));
}
// when an order came: "21:30" alone is on the order's day
// the delivery app a phone pays through, by the look its delivery app has (else by where the owner lives)
export const dlvApp = p => ((p.delivery?.look || (String(p.lives || p.country || '').toUpperCase() === 'KR' ? 'baemin' : '')) === 'baemin' ? '배달의민족' : 'Uber Eats');
// a shop's numbers the model doesn't write, made up from its name (the same each time): reviews and a rating as the app's
// lists really run (most shops tens to a thousand or so, one in five a big name with thousands; a small shop may still
// hold a 5.0, a big one sits at 4.5–4.9: never the model's 9.6 or 4544), a minimum order, a fee and a time
export function shopStats(name, won) {
    let h = 7; for (const c of String(name || '')) h = (h * 31 + c.charCodeAt(0)) >>> 0;
    const h3 = (h >>> 3), h7 = (h >>> 7), reviews = h % 5 === 0 ? 2000 + h3 % 6001 : 30 + h3 % 1470;
    const rating = Math.round((reviews < 100 ? 4.4 + h7 % 7 / 10 : reviews < 2000 ? 4.3 + h7 % 7 / 10 : 4.5 + h7 % 5 / 10) * 10) / 10;
    return { rating, reviews, minOrder: won ? 10000 + (h % 3) * 2500 : 10 + (h % 3) * 2.5, fee: won ? [0, 1500, 2500, 3000, 3500][h % 5] : [0, 0.99, 1.49, 1.99, 2.49][h % 5], eta: `${20 + (h % 3) * 5}–${30 + (h % 3) * 5}` };
}
const arrivedAt = o => { const a = String(o.arrived || ''); return /^\d{2}-\d{2}/.test(a) ? a : /^\d{2}:\d{2}$/.test(a) ? `${String(o.time || '').slice(0, 5)} ${a}` : o.time; };
export function payOrders(m, p, year) {
    if (!p.money || !p.delivery) return 0;
    migrateBank(m, p);
    const f = finance(m), tx = p.money.tx ||= [];
    // year is the one the phone's now is in: an order from last December goes in the year before
    const now5 = String(p.now || '').slice(0, 5), ny = p.year && !p.noYear ? String(p.year) : year, anchor = /^\d{2}-\d{2}$/.test(now5) ? `${ny}-${now5}` : '';
    let n = 0;
    // the memo names the app it was paid through (the phone's delivery app: 배달의민족 in Korea, Uber Eats elsewhere)
    const app = dlvApp(p);
    const put = (o, a, id, amount, time, memo) => {
        if (tx.some(t => t.id === id)) return;
        tx.push({ id, account: a.last4, who: o.shop, ko: o.ko || '', amount, time, day: fullDay(ny, anchor, String(time).slice(0, 5)), kind: 'card', memo, pending: false, ...(o.ev ? { ev: o.ev } : {}), delivery: o.id });
        if (a.kind !== 'credit') { const L = f.accounts[`${a.id}:${a.currency}`]; if (L) L.entries[id] = { amount, date: fullDay(ny, anchor, time.slice(0, 5)) }; }
        n++;
    };
    // a bank row tied to an order no longer there is the bank's own again
    for (const t of tx) if (t.delivery && !p.delivery.orders.some(o => o.id === t.delivery)) delete t.delivery;
    for (const o of p.delivery.orders) {
        if (o.status === 'cancelled' || o.sync) continue;
        // its payment is already in the bank (the bank was filled first): tie it, add none
        const paid = o.paidBy && tx.find(t => t.id === o.paidBy);
        if (paid) { paid.delivery = o.id; if (o.ev) paid.ev ||= o.ev; if (o.status === 'refunded') { const a = payAccount(p, o); if (a) put(o, a, `${PAY}${o.id}-r`, dlvTotal(o), arrivedAt(o), `${app} 환불`); } continue; }
        const a = payAccount(p, o);
        if (!a) continue;
        const total = dlvTotal(o);
        if (!(total > 0)) continue;
        put(o, a, `${PAY}${o.id}`, -total, o.time, o.mode === 'pickup' ? `${app} ${app === '배달의민족' ? '포장' : '픽업'}` : app);
        if (o.status === 'refunded') put(o, a, `${PAY}${o.id}-r`, total, arrivedAt(o), `${app} 환불`);
    }
    tx.sort(byStory(p.now));
    for (const a of p.money.bank.accounts) if (a.kind !== 'credit') { const L = f.accounts[`${a.id}:${a.currency}`]; if (L) a.balance = round(L.amount + Object.values(L.entries).reduce((s, x) => s + x.amount, 0)); }
    // the card's month counted again with the rows just added
    if (n) migrateBank(m, p);
    return n;
}

// 복구: put back what a lost save dropped; something already there stays as it is
export function replayEffects(m, p, effects) {
    const f = finance(m);
    for (const x of effects) {
        if (x.type === 'entry') { const L = f.accounts[x.key]; if (L && !L.entries[x.id]) L.entries[x.id] = { amount: x.amount, date: x.date, ...(x.sourceIndex !== undefined ? { sourceIndex: x.sourceIndex } : {}) }; continue; }
        if (x.type === 'amendEntry') { const line = f.accounts[x.key]?.entries[x.id]; if (line && line.amount === x.from) line.amount = x.to; continue; }
        if (x.type === 'price') { const slot = (f.prices[x.key] ||= {})[x.date] ||= { rows: [], selected: null, conflict: false }; if (!slot.rows.some(r => r.id === x.id)) { slot.rows.push(structuredClone(x.row)); slot.selected ??= x.id; } continue; }
        if (x.type === 'field') { const o = boxAt(p, x.path); if (o && (o[x.field] ?? null) === x.from) o[x.field] = x.to; continue; }
        if (lifeReplay(p, x) !== null) continue;
        if (!p[x.path.split('.')[0]]) continue;
        const box = boxAt(p, x.path, true), idKey = x.idKey || 'id';
        if (x.type === 'push' && !box.some(r => r[idKey] === x.item[idKey])) box.push(structuredClone(x.item));
        if (x.type === 'status') { const r = box.find(o => o.id === x.id); if (r && later(r.status, x.status)) { r.status = x.status; if (x.arrived) r.arrived ||= x.arrived; } }
        if (x.type === 'amend') { const r = box.find(o => o.id === x.id); if (r && r.amount === x.from) { r.amount = x.to; delete r.amountFrom; } }
    }
}
const LOOSE = ['sourceIndex', 'delivery', 'account'];
const unchanged = (path, now, was) => (/^(money|investment)\./.test(path) ? ['amount', 'price', 'qty', 'quantity', 'status'].every(k => now[k] === was[k])
    // (a delivery the clock alone moved on, "on the way" to "delivered", is no change by hand)
    : Object.keys({ ...was, ...now }).filter(k => !LOOSE.includes(k) && k !== 'byClock' && !(k === 'status' && now.byClock)).every(k => JSON.stringify(now[k] ?? null) === JSON.stringify(was[k] ?? null)));
// 되돌리기 · 빼기: undo money changes, newest first. A record gone already is fine; one changed since is left as it is and
// returned, so the caller can say what stayed
export function revertEffects(m, p, effects) {
    const f = finance(m), left = [];
    // a delivery order that stays (changed since: delivered, reviewed) keeps its payment with it
    const dlvKept = new Set(effects.filter(x => x.type === 'push' && x.path === 'delivery.orders').map(x => (p.delivery?.orders || []).find(o => o.id === x.item?.id) && !unchanged(x.path, p.delivery.orders.find(o => o.id === x.item.id), x.item) ? x.item.id : null).filter(Boolean));
    const paidFor = new Set(dlvKept.size ? [...effects.filter(x => x.type === 'push' && x.path === 'money.tx' && dlvKept.has(x.item?.delivery)).map(x => x.item.id), ...(p.money?.tx || []).filter(t => dlvKept.has(t.delivery)).map(t => t.id)] : []);
    for (const x of [...effects].reverse()) {
        if (paidFor.size && (x.type === 'entry' || x.type === 'push' && x.path === 'money.tx') && paidFor.has(x.type === 'entry' ? x.id : x.item?.id)) { left.push(x); continue; }
        if (x.type === 'entry') { const L = f.accounts[x.key]; if (!L?.entries[x.id]) continue; if (L.entries[x.id].amount === x.amount) delete L.entries[x.id]; else left.push(x); continue; }
        if (x.type === 'amendEntry') { const line = f.accounts[x.key]?.entries[x.id]; if (!line) continue; if (line.amount === x.to) line.amount = x.from; else left.push(x); continue; }
        // a price the story gave: its row goes, the day's choice as it was
        if (x.type === 'price') { const slot = f.prices[x.key]?.[x.date]; if (!slot) continue; slot.rows = slot.rows.filter(r => r.id !== x.id); if (!slot.rows.length) { delete f.prices[x.key][x.date]; if (!Object.keys(f.prices[x.key]).length) delete f.prices[x.key]; } else if (x.prev) Object.assign(slot, x.prev); continue; }
        // a field set on a record (the brokerage's valuation day): back, unless changed since
        if (x.type === 'field') { const o = boxAt(p, x.path); if (o && (o[x.field] ?? null) === x.to) { if (x.from === null) delete o[x.field]; else o[x.field] = x.from; } else if (o) left.push(x); continue; }
        const back = lifeRevert(p, x);
        if (back !== null) { if (!back) left.push(x); continue; }
        const box = boxAt(p, x.path);
        if (!box) continue;
        const idKey = x.idKey || 'id', i = box.findIndex(r => r[idKey] === (x.item?.[idKey] ?? x.id));
        if (i < 0) continue;
        // a record changed since it went in (an amount, a status, a count; for the everyday apps, anything) is the user's now: it stays
        if (x.type === 'push') { if (unchanged(x.path, box[i], x.item)) box.splice(i, 1); else left.push(x); }
        if (x.type === 'status') { if (box[i].status === x.status) { box[i].status = x.prev; delete box[i].byClock; if ('arrivedFrom' in x && box[i].arrived === x.arrived) { if (x.arrivedFrom === null) delete box[i].arrived; else box[i].arrived = x.arrivedFrom; } } else left.push(x); }
        if (x.type === 'amend') { if (box[i].amount === x.to) { box[i].amount = x.from; box[i].amountFrom = 'guess'; } else left.push(x); }
    }
    return left;
}
