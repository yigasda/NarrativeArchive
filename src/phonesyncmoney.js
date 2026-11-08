// 새로 일어난 일 반영 · 돈: one story event's payments, transfers, trades, orders and tickets, applied to the bank, the card,
// the brokerage, the shop and the wallet. The model reads the story; the numbers are worked out here.
// - an app made after the event's message already holds it; nothing moves
// - a record the model points at ("already") already holds it
// - "again" means the message only talks about money moved before: it moves nothing. An order or a ticket told of that
//   the phone doesn't hold yet ("I already ordered you a scarf") is put in as a record all the same, with no payment: the
//   owner's shopping app or wallet has it. Without "new", a record with the
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
// an order that is over (cancelled, returned, refunded), a ticket that is (used, cancelled, refunded, checked out, expired;
// never "미사용", "사용 전", "unused": not used yet)
const ORDER_OVER = s => ['cancelled', 'returned', 'refunded'].includes(s);
// ("환불 불가", "non-refundable", "취소 가능", "free cancellation" say what may be done with it, never that it was)
// a ticket's details the model made up to fit (phonedata MADE_FIELDS): shown, never proof that two tickets are two
const MADE_FIELDS = ['no', 'seat', 'gate', 'date', 'time', 'from', 'to', 'names', 'shop', 'option', 'eta', 'value', 'amount', 'lender', 'due', 'since', 'conditions'];
// (a field's value as saved: a list compared by what it holds)
const sameValue = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
const madeOf = x => [...new Set((Array.isArray(x?.made) ? x.made : []).map(v => String(v || '').trim()).filter(v => MADE_FIELDS.includes(v)))];
// the airports a ticket's route is often written by, by their city (the town table's names): "ICN" is Incheon and Seoul
// (data the code looks a place up in: whether two places a model wrote are surely two)
const AIRPORTS = { ICN: ['Incheon', 'Seoul'], GMP: ['Seoul'], PUS: ['Busan'], CJU: ['Jeju'], NRT: ['Tokyo'], HND: ['Tokyo'], KIX: ['Osaka'], ITM: ['Osaka'], FUK: ['Fukuoka'], CTS: ['Sapporo'], OKA: ['Okinawa', 'Naha'],
    PEK: ['Beijing'], PVG: ['Shanghai'], SHA: ['Shanghai'], CAN: ['Guangzhou'], HKG: ['Hong Kong'], TPE: ['Taipei'], SIN: ['Singapore'], BKK: ['Bangkok'], SGN: ['Ho Chi Minh City'], HAN: ['Hanoi'], DAD: ['Da Nang'],
    MNL: ['Manila'], CEB: ['Cebu'], DPS: ['Bali', 'Denpasar'], KUL: ['Kuala Lumpur'], DXB: ['Dubai'], DEL: ['Delhi', 'New Delhi'], BOM: ['Mumbai'], IST: ['Istanbul'],
    FRA: ['Frankfurt'], MUC: ['Munich'], BER: ['Berlin'], TXL: ['Berlin'], HAM: ['Hamburg'], DUS: ['Düsseldorf', 'Dusseldorf'], CGN: ['Cologne', 'Köln'], STR: ['Stuttgart'],
    LHR: ['London'], LGW: ['London'], STN: ['London'], MAN: ['Manchester'], EDI: ['Edinburgh'], DUB: ['Dublin'], CDG: ['Paris'], ORY: ['Paris'], NCE: ['Nice'],
    AMS: ['Amsterdam'], BRU: ['Brussels'], ZRH: ['Zurich'], GVA: ['Geneva'], VIE: ['Vienna'], PRG: ['Prague'], BUD: ['Budapest'], WAW: ['Warsaw'], CPH: ['Copenhagen'], ARN: ['Stockholm'],
    OSL: ['Oslo'], HEL: ['Helsinki'], FCO: ['Rome'], MXP: ['Milan'], VCE: ['Venice'], MAD: ['Madrid'], BCN: ['Barcelona'], LIS: ['Lisbon'], ATH: ['Athens'],
    JFK: ['New York'], EWR: ['New York', 'Newark'], LGA: ['New York'], BOS: ['Boston'], IAD: ['Washington'], MIA: ['Miami'], ATL: ['Atlanta'], ORD: ['Chicago'], DFW: ['Dallas'], IAH: ['Houston'],
    DEN: ['Denver'], PHX: ['Phoenix'], LAX: ['Los Angeles'], SFO: ['San Francisco'], SEA: ['Seattle'], LAS: ['Las Vegas'], HNL: ['Honolulu'], YYZ: ['Toronto'], YUL: ['Montreal'], YVR: ['Vancouver'],
    MEX: ['Mexico City'], GRU: ['São Paulo', 'Sao Paulo'], SYD: ['Sydney'], MEL: ['Melbourne'], BNE: ['Brisbane'], PER: ['Perth'], AKL: ['Auckland'] };
// a record's names as the model wrote them (its "names", and for older answers the item, the seller, a show's name), and the
// story's own of them (none when the model made them up)
const NAME = s => String(s || '').normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');
const allNames = (path, x) => [...new Set([...(Array.isArray(x?.names) ? x.names : []), ...(path === 'orders' ? [x?.item, x?.ko] : path === 'passes' ? [x?.by, x?.kind === 'event' ? x?.to : ''] : [x?.name])].map(v => txt(v, 80)).filter(Boolean))].slice(0, 8);
const storyNames = (path, x) => (madeOf(x).includes('names') ? [] : allNames(path, x));
// (the same name: equal, or one holding the other when the shorter has 3 letters or more; "IU 콘서트" in "IU 콘서트 티켓")
const nameHit = (a, b) => a.some(u => b.some(v => { const x = NAME(u), y = NAME(v); if (!x || !y) return false; if (x === y) return true; const [s, l] = x.length < y.length ? [x, y] : [y, x]; return s.length >= 3 && l.includes(s); }));
const OPEN = { orders: o => !ORDER_OVER(o.status) && o.status !== 'delivered', passes: o => !PASS_OVER(o.status), assets: o => ['held', 'expected'].includes(o.status || 'held'), debts: o => ['open', 'overdue'].includes(o.status || 'open') };
export const PASS_OVER = v => { const s = String(v || '').toLowerCase().trim().replace(/(?:환불|취소)\s*(?:불가|가능|안\s*됨)|non-?refundable|free\s+cancel\w*|cancel\w*\s+(?:allowed|possible)|refundable/g, ' '); return !/미사용|사용\s*전|사용\s*예정|unused|not\s+(?:yet\s+)?used/.test(s) && /\bused\b|cancel|refund|checked out|expired|사용\s*(?:완료|됨|함)|취소|환불|만료/.test(s); };
const samePlace = (a, b) => !!plain(a) && plain(a) === plain(b);
// (an order's shop: the same, or one or both not named)
const shopOf = (a, b) => !plain(a) || !plain(b) || samePlace(a, b);
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
const plusDays = (day, n) => { const mt = /^(\d{2})-(\d{2})$/.exec(day || ''); if (!mt) return ''; const d = new Date(Date.UTC(day === '02-29' ? 2000 : 2001, mt[1] - 1, Number(mt[2]) + n)); return `${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`; };
const fullDay = (year, anchor, date) => {
    const a = /^(\d{4})-(\d{2})-(\d{2})$/.exec(anchor || '');
    if (!a || !/^\d{2}-\d{2}$/.test(date || '')) return `${year}-${date}`;
    const d = new Date(Date.UTC(Number(a[1]), a[2] - 1, Number(a[3]) + dayGap(`${a[2]}-${a[3]}`, date)));
    return `${d.getUTCFullYear()}-${date}`;
};
// what the model sees of the money apps
const newestAndOpen = (xs, n, open) => { const all = xs || [], last = all.slice(-n); return [...all.slice(0, -n || all.length).filter(open).slice(-12), ...last]; };
export function moneyNow(p) {
    const mo = p.money;
    if (!mo) return null;
    return {
        accounts: mo.bank.accounts.map(a => ({ account: a.last4, kind: a.kind, name: a.name, currency: a.currency, ...(a.kind === 'credit' ? {} : { balance: a.balance }), ...(a.blocked ? { blocked: true } : {}) })),
        tx: (mo.tx || []).slice(-15).map(t => ({ id: t.id, account: t.account, time: t.time, who: t.who, amount: t.amount })),
        // (the newest, and every one still open however old: the model points at the one a message tells of again)
        orders: newestAndOpen(mo.orders, 8, o => !ORDER_OVER(o.status) && o.status !== 'delivered').map(o => ({ id: o.id, shop: o.shop, item: o.item, ...(o.option ? { option: o.option } : {}), ...(o.gift ? { gift: o.gift } : {}), price: o.price, status: o.status, time: o.time })),
        // (a ticket told of before its day was known says so: its date is only the day it was told on)
        passes: newestAndOpen(mo.passes, 6, x => !PASS_OVER(x.status)).map(x => ({ id: x.id, kind: x.kind, by: x.by, from: x.from || undefined, to: x.to || undefined, no: x.no || undefined, date: x.date, ...(x.dayUnknown ? { dayUnknown: true } : {}), status: x.status })),
        // (what the owner owns and owes beyond the accounts: every one still held or owed, and the newest)
        ...((mo.assets || []).length ? { assets: newestAndOpen(mo.assets, 6, OPEN.assets).map(x => ({ id: x.id, kind: x.kind, names: x.names, value: x.value, currency: x.currency, whose: x.whose, status: x.status })) } : {}),
        ...((mo.debts || []).length ? { debts: newestAndOpen(mo.debts, 6, OPEN.debts).map(x => ({ id: x.id, kind: x.kind, names: x.names, lender: x.lender, amount: x.amount, currency: x.currency, due: x.due || undefined, status: x.status })) } : {}),
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

// 돈 단계 답 (3.176~): one list of records, each with its "type", put in the lists applyMoney reads. Only the names of
// the fields change here; what each record means is the model's, what goes on the phone is applyMoney's
// ("amount" is a payment's money, an order's one-item price, an asset's whole value, a debt's what is owed, a quote's
// one-share price, a stake's value, a new account's opening money; a ticket and a delivery have none)
const TYPES = ['payment', 'regular', 'order', 'ticket', 'asset', 'debt', 'account', 'card', 'trade', 'quote', 'watch', 'stake', 'delivery', 'cart'];
export function recordsMoney(recs) {
    const mo = {}, add = (k, x) => (mo[k] ||= []).push(x);
    for (const r of list(recs)) {
        const type = String(r.type ?? '').toLowerCase().trim(), x = { ...r };
        if (!TYPES.includes(type)) continue;
        if (type === 'payment') add('moves', x);
        else if (type === 'regular') add('regulars', x);
        // (who pays: the owner, someone else, or the courier at the door; a parcel sent to the owner is never theirs to pay)
        else if (type === 'order') { const { amount, ...o } = x; add('orders', { ...o, price: amount ?? o.price ?? null, ...(o.sender || ['someone else', 'on delivery'].includes(String(o.payer || '').toLowerCase()) ? { paid: false } : {}) }); }
        else if (type === 'ticket') add('passes', x);
        else if (type === 'asset') { const { amount, amountFrom, ...o } = x; add('assets', { ...o, value: amount ?? o.value ?? null, ...(amountFrom ? { valueFrom: amountFrom } : {}) }); }
        else if (type === 'debt') add('debts', x);
        else if (type === 'account') add('accounts', x);
        else if (type === 'card') mo.newCard ||= x;
        else if (type === 'trade') add('trades', x);
        else if (type === 'quote') { const { amount, amountFrom, ...o } = x; add('quotes', { ...o, value: amount ?? o.value, source: amountFrom === 'guess' || !txt(o.evidence) ? 'guess' : 'story' }); }
        else if (type === 'watch') add('watch', x);
        else if (type === 'stake') { const { amount, ...o } = x; add('stakes', { ...o, value: amount ?? o.value }); }
        // (a delivery's people are "people"; its order time is its date and time)
        else if (type === 'delivery') { const { people, date, time, ...o } = x; add('deliveries', { ...o, for: people ?? o.for, time: when(date) && hhmm(time) ? `${when(date).slice(0, 5)} ${hhmm(time)}` : time ?? '' }); }
        else if (type === 'cart') mo.cart = x;
    }
    return mo;
}

// e: { id, at, date: 'MM-DD', time, summary, money }; opts: { year, marks, legs: what this event did before }
// edited: the message was changed by the user after it was read, so its amounts may be corrected even when stated
// anchor: the day ("YYYY-MM-DD") the year was read from; an event's day is taken as the one nearest it, so a story going
// past New Year books January in the next year
// placeCity: the town table's ids of a city by any of its names (phonedata cityIds), to tell two places surely apart
export function applyMoney(m, p, e, { year, anchor = '', marks = {}, legs: prior = [], span = null, edited = false, placeCity = null } = {}) {
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
    for (const x of list(mo.assets)) nums(x, ['value']);
    for (const x of list(mo.debts)) nums(x, ['amount']);
    for (const x of list(mo.deliveries)) { nums(x, ['fee', 'tip', 'discount', 'for']); for (const d of list(x.items)) nums(d, ['price', 'qty']); if (x.newShop && typeof x.newShop === 'object') { nums(x.newShop, ['rating', 'reviews', 'fee', 'minOrder']); for (const d of list(x.newShop.menu)) nums(d, ['price']); } }
    const f = finance(m), guess = mo.amountFrom === 'guess', date = e.date, full = fullDay(year, anchor, date);
    // (a record's own "amountFrom" when it has one (the money step's records), else the event's)
    const gOf = x => (x?.amountFrom === 'guess' || x?.amountFrom === 'story' ? x.amountFrom === 'guess' : guess);
    const bankOn = !!p.money && e.at > (marks.money?.index ?? -1), investOn = !!p.investment && e.at > (marks.invest?.index ?? -1);
    if ((list(mo.moves).length || list(mo.trades).length || list(mo.orders).length || list(mo.passes).length || list(mo.assets).length || list(mo.debts).length || list(mo.deliveries).length) && !/^\d{2}-\d{2}$/.test(date || '')) fail('돈이 움직인 날짜를 확인하지 못했어요');
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
    const keep = (key, amount, fix, g = guess) => {
        const old = seen(key);
        if (!old) return false;
        if (finite(amount) && finite(old.amount) && Math.abs(old.amount - amount) > 0.01) {
            if (fix && old.state === 'applied' && (edited || old.from === 'guess' && !g)) { fix(old.rec, amount); out.legs.push({ ...old, amount: round(amount), from: 'story' }); return true; }
            out.notes.push(`${txt(e.summary, 40)}: 처음 정한 금액(${old.amount})을 그대로 뒀어요`);
        }
        out.legs.push(old);
        return true;
    };

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
    // ---- which record each order, ticket, asset and debt is (the model wrote what the story says; this decides, before any
    // money moves, so a payment for one already paid is not paid again)
    const placeIds = v => { const c = new Set(); for (const n of [...(AIRPORTS[String(v || '').trim().toUpperCase()] || []), v]) for (const k of placeCity ? placeCity(n) : []) c.add(k); return c; };
    // (two places surely two: both in the tables, no city in common; one the tables don't know is never proof)
    const apart = (a, b) => { if (!plain(a) || !plain(b) || plain(a) === plain(b)) return false; const A = placeIds(a), B = placeIds(b); return A.size > 0 && B.size > 0 && ![...A].some(k => B.has(k)); };
    const sameAt = (a, b) => !!plain(a) && !!plain(b) && (plain(a) === plain(b) || (A => [...placeIds(b)].some(k => A.has(k)))(placeIds(a)));
    // (what the model wrote that the record surely isn't: another kind, another place either end or the way back, another size
    // or person; made-up values are no proof of anything)
    const conflict = (path, o, x) => {
        const om = madeOf(o), xm = madeOf(x), given = (r, rm, f) => (rm.includes(f) ? '' : txt(r[f], 60));
        if (path !== 'orders' && x.kind && o.kind && x.kind !== o.kind) return true;
        if (path === 'passes') {
            const of = given(o, om, 'from'), ot = given(o, om, 'to'), xf = given(x, xm, 'from'), xt = given(x, xm, 'to');
            if (apart(of, xf) || apart(ot, xt)) return true;
            if (of && ot && xf && xt && sameAt(of, xt) && sameAt(ot, xf) && !sameAt(of, ot)) return true;
        }
        if (path === 'orders') { const oo = given(o, om, 'option'), xo = given(x, xm, 'option'), og = giftOf(o.gift), xg = giftOf(x.gift); if (oo && xo && !nameHit([oo], [xo]) || og && xg && !nameHit([og], [xg])) return true; }
        return false;
    };
    const boxOf = path => (path === 'orders' || path === 'passes' || path === 'assets' || path === 'debts') && p.money ? (p.money[path] || []) : [];
    const resolved = new Map();
    for (const path of ['orders', 'passes', 'assets', 'debts']) for (const x of list(mo[path])) {
        const box = boxOf(path), ok = o => !conflict(path, o, x), sn = storyNames(path, x);
        // the id the model gives, when it fits; the same message's own record (its message read again); then, for one the story
        // told of before, the one its story names are, else the one of its kind still open; none for one first told of here
        const pointed = x.already && box.find(o => o.id === x.already && ok(o));
        const own = !pointed && box.find(o => (o.ev === e.id || o.sourceIndex === e.at) && nameHit(allNames(path, o), allNames(path, x)) && ok(o));
        let res = pointed || own ? { rec: pointed || own } : x.refersBack === false ? { rec: null } : null;
        if (!res) {
            const pick = rs => (rs.length === 1 ? { rec: rs[0] } : rs.length > 1 ? { ambiguous: true } : { rec: null });
            res = sn.length ? pick(box.filter(o => nameHit(storyNames(path, o), sn) && ok(o)))
                : pick(box.filter(o => OPEN[path](o) && (path === 'orders' || o.kind === x.kind) && ok(o)));
        }
        resolved.set(x, res);
    }
    // (a payment's "for": the order, ticket or asset of this event it pays, by one of its names)
    const forOf = v => { if (!txt(v)) return null; for (const path of ['orders', 'passes', 'assets', 'debts']) for (const x of list(mo[path])) if (nameHit(allNames(path, x), [txt(v, 80)])) return { path, x, res: resolved.get(x) }; return null; };
    const paidAlready = r => !!r.paidBy || !r.told && !!r.ev && r.ev !== e.id;
    list(mo.moves).forEach((x, k) => {
        let amount = Number(x.amount);
        const broker = /^broker:/i.test(String(x.account || '')), g = gOf(x), from = g ? 'guess' : 'story';
        if (voided.has(k)) { out.legs.push({ key: `void:${k}`, amount, state: 'cancelled' }); return; }
        // (a payment for an order, ticket or asset the phone already holds as paid: told of again, never paid twice)
        x._for = forOf(x.for);
        if (x._for?.res?.rec && x._for.path !== 'debts' && amount < 0 && x.occurrence !== 'again' && paidAlready(x._for.res.rec)) { out.legs.push({ key: `paid:${k}`, amount, state: 'paid' }); out.notes.push(`${txt(x.who, 40) || txt(x.for, 40)} ${round(amount)}: 이미 결제된 것이라 다시 빼지 않았어요`); return; }
        if (amount === 0) { out.legs.push({ key: `zero:${k}`, amount: 0, state: 'zero' }); return; }
        if (!finite(amount)) fail('금액을 확인하지 못했어요');
        if (broker ? !investOn : !bankOn) { out.legs.push({ key: `before:${x.account}`, amount, state: 'before' }); return; }
        if (broker) {
            const cur = String(x.account).slice(7).toUpperCase(), a = p.investment.accounts.find(y => y.currency === cur), L = a && f.accounts[a.key];
            if (!L) fail('증권 계좌를 찾지 못했어요');
            const key = `broker:${cur}:${amount < 0 ? '-' : '+'}`;
            if (keep(key, amount, rec => { const line = L.entries[rec]; if (!line) return; out.effects.push({ type: 'amendEntry', key: a.key, id: rec, from: line.amount, to: round(amount) }); out.notes.push(`증권 ${cur}: 추정 ${line.amount} → 실제 ${round(amount)}로 고쳤어요`); out.changes.push({ app: '투자', label: `증권 ${cur}`, amount: round(amount - line.amount), currency: cur }); line.amount = round(amount); }, g)) return;
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
            // (no rate saved for that day: the one the model gave with the payment, kept as that day's; none given: this payment is
            // left out with a note, the event's other money goes in, and the code never takes another day's)
            let rate = fx(m, xc, acct.currency, full);
            if (rate === null && finite(Number(x.rate)) && Number(x.rate) > 0) {
                const key = `FX:${xc}/${acct.currency}`, before = finance(m).prices[key]?.[full], had = new Set((before?.rows || []).map(r => r.id)), prev = before ? { selected: before.selected, conflict: before.conflict } : null;
                const row = addPrice(m, key, full, { value: Number(x.rate), source: 'guess' }).rows.find(r => !had.has(r.id));
                // (되돌리기 takes the rate back with the payment)
                if (row) out.effects.push({ type: 'price', key, date: full, id: row.id, row: structuredClone(row), prev });
                rate = fx(m, xc, acct.currency, full);
            }
            if (rate === null) { out.notes.push(`${xc}→${acct.currency} 환율이 없어서 ${xc} ${Math.abs(amount)} 결제는 넣지 않았어요`); return; }
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
        if (!otherDay && keep(key, amount, rec => { const t = tx.find(r => r.id === rec); if (t) amend(t, amount, lk, label, acct); }, g)) return;
        const pointed = x.already && tx.find(t => t.id === x.already);
        const match = t => t.account === acct.last4 && near(t.time, date, 0) && Math.sign(t.amount) === Math.sign(amount)
            && (Math.abs(t.amount - amount) < 0.01 && (!plain(t.who) || !plain(x.who) || samePlace(t.who, x.who)) || (g || t.amountFrom === 'guess') && samePlace(t.who, x.who));
        const twin = !pointed && tx.find(t => match(t) && !fresh(x, t, e.at));
        if (!pointed && !twin && tx.some(match)) out.notes.push(`${txt(x.who, 40) || acct.name} ${round(amount)}: 같은 날 같은 결제가 하나 더 있어요 (새 결제라고 해서 따로 넣었어요)`);
        if (!pointed && !twin && x.occurrence === 'again') { out.legs.push({ key, amount: round(amount), state: 'again' }); out.notes.push(`${txt(x.who, 40) || acct.name} ${round(amount)}: 전에 있었던 결제라 넣지 않았어요`); return; }
        if (pointed && pointed.amountFrom === 'guess' && !g && Math.sign(pointed.amount) === Math.sign(amount) && Math.abs(pointed.amount - amount) > 0.01) { amend(pointed, amount, lk, label, acct); out.legs.push({ key, amount: round(amount), state: 'included', rec: pointed.id }); return; }
        if (twin && twin.amountFrom === 'guess' && !g && Math.abs(twin.amount - amount) > 0.01) { amend(twin, amount, lk, label, acct); out.legs.push({ key, amount: round(amount), state: 'included', rec: twin.id }); return; }
        if (pointed || twin) {
            const r = pointed || twin;
            x._tx = r.id;
            if (r.sourceIndex === null) r.sourceIndex = e.at;
            out.legs.push({ key, amount: round(amount), state: 'included', rec: r.id });
            if (twin) out.notes.push(`${twin.who || acct.name} ${twin.amount}: 이미 있는 거래라 넣지 않았어요`);
            return;
        }
        const id = sid(`sync:${e.id}:m${k}`);
        const row = { id, account: acct.last4, who: txt(x.who, 60), ko: txt(x.ko, 60), amount: round(amount), time: `${date}${(hhmm(x.time) || e.time) ? ` ${hhmm(x.time) || e.time}` : ''}`, day: full,
            // on the card everything is a card row (a refund is plus), except paying the card off: a transfer, which the month's count leaves out
            kind: acct.kind === 'credit' ? (x.kind === 'transfer' ? 'transfer' : 'card') : ['card', 'transfer', 'deposit', 'cash'].includes(x.kind) ? x.kind : amount > 0 ? 'deposit' : 'card', memo: txt(x.memo), pending: false, ev: e.id, storyEvent: e.id, sourceIndex: e.at, ...(g ? { amountFrom: 'guess' } : {}) };
        // a card payment just made waits for approval through its day (the clock settles it the next)
        const nowDay = String(p.now || '').slice(0, 5);
        row.pending = row.kind === 'card' && row.amount < 0 && !(/^\d{2}-\d{2}$/.test(nowDay) && /^\d{2}-\d{2}$/.test(date) && dayGap(date, nowDay) > 0);
        tx.push(row);
        x._tx = id; x._new = true;
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
            source: gOf(t) ? 'guess' : 'story', storyEvent: e.id, sourceIndex: e.at, rateAtTrade: fx(m, cur, inv.base, full) };
        try { positions([...inv.trades, trade]); } catch { fail('가진 것보다 많이 판 거래예요'); }
        inv.trades.push(trade);
        const flow = kind === 'buy' ? -(quantity * price + fee) : kind === 'sell' ? quantity * price - fee : amount;
        L.entries[id] = { amount: round(flow), date: full };
        out.effects.push({ type: 'push', path: 'investment.trades', item: structuredClone(trade) }, { type: 'entry', key: a.key, id, amount: round(flow), date: full });
        if (full > (inv.date || '')) { out.effects.push({ type: 'field', path: 'investment', field: 'date', from: inv.date ?? null, to: full }); inv.date = full; }
        out.changes.push({ app: '투자', label: `${inv.securities.find(x => x.symbol === symbol)?.name || symbol} ${kind === 'buy' ? '매수' : kind === 'sell' ? '매도' : '배당'}${kind === 'dividend' ? '' : ` ${quantity}주`}`, amount: round(flow), currency: cur });
        out.legs.push({ key, amount: size, state: 'applied', rec: id });
    });

    // ---- orders, tickets, assets and debts: the record each mention was found to be (above) takes what it adds; one none was
    // found for goes in as new
    const KINDS = { passes: ['flight', 'train', 'hotel', 'event', 'other'], assets: ['property', 'vehicle', 'business', 'valuable', 'deposit', 'other'], debts: ['loan', 'mortgage', 'personal', 'tax', 'other'] };
    const STATES = { assets: ['held', 'expected', 'sold', 'lost'], debts: ['open', 'paid', 'overdue', 'forgiven'] };
    const hangul = v => /\p{Script=Hangul}/u.test(v || '');
    const make = {
        // (a price the story doesn't give, null or "", is none, never 0; the arrival day is the model's, made up when the story
        // gives none)
        orders: x => { const names = allNames('orders', x), item = txt(x.item) || names[0] || '', price = x.price === null || x.price === undefined || x.price === '' ? NaN : Number(x.price);
            if (!item) return null;
            return { shop: txt(x.shop, 60), item, ko: txt(x.ko) || (hangul(item) ? '' : names.find(n => hangul(n)) || ''), names, option: txt(x.option, 60), qty: Math.max(1, Math.round(Number(x.qty) || 1)), price: finite(price) ? price : null, time: date, status: ORDER.includes(x.status) ? x.status : 'ordered', eta: when(x.eta).slice(0, 5), arrived: '', gift: giftOf(x.gift), ...(x.paid === false ? { paid: false } : {}), ...(gOf(x) ? { amountFrom: 'guess' } : {}) }; },
        passes: x => { const names = allNames('passes', x), by = txt(x.by, 60) || (Array.isArray(x.names) ? txt(x.names[0], 60) : '');
            if (!by && !txt(x.to)) return null;
            return { kind: KINDS.passes.includes(x.kind) ? x.kind : 'other', by, names, from: txt(x.from, 40), to: txt(x.to, 40), date: when(x.date).slice(0, 5) || date, time: hhmm(x.time), seat: txt(x.seat, 12), gate: txt(x.gate, 12), no: txt(x.no, 24), status: txt(x.status, 30) }; },
        assets: x => { const names = allNames('assets', x);
            if (!names.length) return null;
            return { kind: KINDS.assets.includes(x.kind) ? x.kind : 'other', name: names[0], names, value: finite(Number(x.value)) ? round(Number(x.value)) : null, currency: currency(String(x.currency || '').toUpperCase()) ? String(x.currency).toUpperCase() : p.money.currency, valueFrom: x.valueFrom === 'story' ? 'story' : 'guess', whose: ['owner', 'shared', 'family', 'company'].includes(x.whose) ? x.whose : 'owner', status: STATES.assets.includes(x.status) ? x.status : 'held', since: when(x.since).slice(0, 5) || date, conditions: txt(x.conditions, 200) }; },
        debts: x => { const names = allNames('debts', x);
            if (!names.length && !txt(x.lender)) return null;
            return { kind: KINDS.debts.includes(x.kind) ? x.kind : 'other', name: names[0] || txt(x.lender, 60), names, lender: txt(x.lender, 60), amount: finite(Number(x.amount)) ? round(Math.abs(Number(x.amount))) : null, currency: currency(String(x.currency || '').toUpperCase()) ? String(x.currency).toUpperCase() : p.money.currency, amountFrom: x.amountFrom === 'story' ? 'story' : 'guess', due: when(x.due).slice(0, 5), status: STATES.debts.includes(x.status) ? x.status : 'open', conditions: txt(x.conditions, 200) }; },
    };
    // what a mention gives, field by field: { field: [value, made] }
    const VALUES = {
        orders: x => ({ shop: txt(x.shop, 60), option: txt(x.option, 60), gift: giftOf(x.gift), eta: when(x.eta).slice(0, 5), price: x.price === null || x.price === undefined || x.price === '' || !finite(Number(x.price)) ? '' : Number(x.price) }),
        passes: x => ({ no: txt(x.no, 24), from: txt(x.from, 40), to: txt(x.to, 40), seat: txt(x.seat, 12), gate: txt(x.gate, 12), date: when(x.date).slice(0, 5), time: hhmm(x.time) }),
        assets: x => ({ value: finite(Number(x.value)) ? round(Number(x.value)) : '', whose: ['owner', 'shared', 'family', 'company'].includes(x.whose) ? x.whose : '', since: when(x.since).slice(0, 5), conditions: txt(x.conditions, 200) }),
        debts: x => ({ lender: txt(x.lender, 60), amount: finite(Number(x.amount)) ? round(Math.abs(Number(x.amount))) : '', due: when(x.due).slice(0, 5), conditions: txt(x.conditions, 200) }),
    };
    const APP = { orders: '쇼핑', passes: '지갑', assets: '자산', debts: '빚' };
    const label = (path, r) => r.item || r.name || r.by || r.to;
    // (the moves this event linked to a mention by its "for", in this event, newly paid)
    const linked = x => list(mo.moves).filter(y => y._for?.x === x && y._tx);
    const records = path => list(mo[path]).forEach((x, k) => {
        if (!bankOn) return;
        const box = p.money[path] ||= [], res = resolved.get(x) || { rec: null };
        // (more than one it may be: the code doesn't pick one; nothing changes, a note says why)
        if (res.ambiguous) { out.notes.push(`${allNames(path, x)[0] || x.kind || APP[path]}: 어느 기록인지 몰라서 넣지 않았어요`); return; }
        const old = res.rec;
        if (!old && x.occurrence === 'again' && !allNames(path, x).length && !txt(x.to) && !txt(x.lender)) { out.notes.push(`${APP[path]}: 무엇인지 모르는 이야기는 넣지 않았어요`); return; }
        if (old) {
            if (old.sourceIndex == null) old.sourceIndex = e.at;
            // (what it adds: an empty field, or one made up to fit, takes what this mention gives; one the story gave takes what
            // the story now gives; a made-up value never takes the place of the story's. 되돌리기 takes it all back)
            const fill = (field, to) => { out.effects.push({ type: 'field', path: `money.${path}`, id: old.id, field, from: structuredClone(old[field] ?? null), ...(Object.hasOwn(old, field) ? { had: true } : {}), to: structuredClone(to) }); if (to === null) delete old[field]; else old[field] = to; };
            const xm = madeOf(x), om = madeOf(old), val = VALUES[path](x);
            let made = [...om];
            for (const [f, v] of Object.entries(val)) {
                if (v === '' || v === null || v === undefined || sameValue(v, old[f])) continue;
                const was = old[f], oldMade = om.includes(f) || f === 'date' && old.dayUnknown || f === 'eta' && old.etaGuess, newMade = xm.includes(f);
                if (was === null || was === undefined || was === '' || oldMade || !newMade) { fill(f, v); made = newMade ? [...new Set([...made, f])] : made.filter(y => y !== f); }
            }
            // (its names: the story's join the ones there; made-up ones there give way to the story's)
            const sn = storyNames(path, x);
            if (sn.length) { const next = om.includes('names') ? sn : [...new Set([...allNames(path, old), ...sn])].slice(0, 8); if (!sameValue(next, old.names)) fill('names', next); made = made.filter(y => y !== 'names'); }
            if (old.dayUnknown && !made.includes('date') && val.date && old.date === val.date) fill('dayUnknown', null);
            if (old.etaGuess && val.eta && !xm.includes('eta')) fill('etaGuess', null);
            if (made.join() !== om.join()) fill('made', made.length ? made : null);
            // paid now: no longer only told of
            const pay = linked(x).find(y => y._new);
            if (pay && path !== 'debts') { if (!old.paidBy) fill('paidBy', pay._tx); if (old.told) fill('told', null); }
            // (a debt paid back: what is left, by the money that went out for it in its own currency; nothing left, paid)
            if (path === 'debts') {
                const back = linked(x).filter(y => y._new && Number(y.amount) < 0 && String(y.currency || p.money.currency).toUpperCase() === (old.currency || p.money.currency)).reduce((n, y) => n + Math.abs(Number(y.amount)), 0);
                if (back > 0 && finite(old.amount)) { const left = round(Math.max(0, old.amount - back)); fill('amount', left); if (left === 0 && old.status !== 'paid') fill('status', 'paid'); }
                else if (back > 0) out.notes.push(`${label(path, old)}: 갚은 돈은 넣었지만 남은 빚을 몰라서 줄이지 않았어요`);
            }
            // a status: an order's only moves forward; the others' as the story now tells it
            const next = path === 'passes' ? txt(x.status, 30) : path === 'orders' ? x.status : STATES[path].includes(x.status) ? x.status : '';
            if (next && next !== old.status && (path !== 'orders' || ORDER.includes(next) && later(old.status, next))) {
                const was = old.status, arrivedFrom = old.arrived ?? null;
                old.status = next;
                if (path === 'orders' && next === 'delivered' && /^\d{2}-\d{2}$/.test(date || '')) old.arrived ||= date;
                out.effects.push({ type: 'status', path: `money.${path}`, id: old.id, status: next, prev: was, ...((old.arrived ?? null) !== arrivedFrom ? { arrivedFrom, arrived: old.arrived } : {}) });
                out.changes.push({ app: APP[path], label: `${label(path, old)} 상태`, amount: null });
            }
            // told again by another event as it was: that event knows it too (빼기 of the first leaves it while this talk stays)
            else if (old.ev !== e.id) out.effects.push({ type: 'seen', path: `money.${path}`, id: old.id });
            return;
        }
        const made = make[path](x);
        if (!made) { out.notes.push(`${APP[path]}: 이름 없는 기록은 넣지 않았어요`); return; }
        const xm = madeOf(x), row = { ...made, ...(xm.length ? { made: xm } : {}), id: sid(`sync:${e.id}:${path[0]}${k}`), ev: e.id, storyEvent: e.id, sourceIndex: e.at };
        const pay = linked(x).find(y => y._new);
        if (pay && path !== 'debts') row.paidBy = pay._tx;
        // (one done before these messages, told of now: its payment was before, not here)
        if (x.occurrence === 'again' && (path === 'orders' || path === 'passes')) { row.told = true; if (path === 'passes' && !when(x.date) && !xm.includes('date')) row.dayUnknown = true; }
        else if (path === 'orders' && row.status !== 'cancelled' && row.price && x.paid !== false && !x.gift && !pay && !list(mo.moves).some(y => Number(y.amount) < 0)) out.notes.push(`${row.item}: 주문은 넣었지만 결제가 없었어요`);
        box.push(row);
        out.effects.push({ type: 'push', path: `money.${path}`, item: structuredClone(row) });
        out.changes.push({ app: APP[path], label: label(path, row), amount: null });
    });
    for (const path of ['orders', 'passes', 'assets', 'debts']) records(path);
    // an account the story says is blocked or freed: marked, its money where it was (blocked is no withdrawal)
    for (const x of list(mo.access)) {
        if (!bankOn) break;
        const acct = accountOf(p, x);
        if (!acct) { out.notes.push('막힌 계좌를 찾지 못했어요'); continue; }
        const to = x.blocked === false ? null : { since: date, reason: txt(x.reason, 120) };
        if (sameValue(acct.blocked ? true : null, to ? true : null)) continue;
        out.effects.push({ type: 'field', path: 'money.bank.accounts', id: acct.id, field: 'blocked', from: structuredClone(acct.blocked ?? null), ...(Object.hasOwn(acct, 'blocked') ? { had: true } : {}), to: structuredClone(to) });
        if (to) acct.blocked = to; else delete acct.blocked;
        out.changes.push({ app: '은행', label: `${acct.name || ''} ••••${acct.last4} ${to ? '막힘' : '풀림'}`.trim(), amount: null });
    }
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
                // (a price the story gives, by its words; one estimated to show a change the story implies, a guess)
                const story = q.source !== 'guess' && !!txt(q.evidence);
                const slot = addPrice(m, `STOCK:${symbol}`, d, { value, source: story ? 'story' : 'guess', ...(story ? { ref: txt(q.evidence, 200) } : {}) }), row = slot.rows.find(r => !had.has(r.id));
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
// the object a "field" effect set: the one at its path, or (with an id) that record in the list there
const fieldAt = (p, x) => { const at = boxAt(p, x.path); return x.id ? (Array.isArray(at) ? at.find(r => r?.id === x.id) : null) : at; };
export function replayEffects(m, p, effects) {
    const f = finance(m);
    for (const x of effects) {
        if (x.type === 'entry') { const L = f.accounts[x.key]; if (L && !L.entries[x.id]) L.entries[x.id] = { amount: x.amount, date: x.date, ...(x.sourceIndex !== undefined ? { sourceIndex: x.sourceIndex } : {}) }; continue; }
        if (x.type === 'amendEntry') { const line = f.accounts[x.key]?.entries[x.id]; if (line && line.amount === x.from) line.amount = x.to; continue; }
        if (x.type === 'price') { const slot = (f.prices[x.key] ||= {})[x.date] ||= { rows: [], selected: null, conflict: false }; if (!slot.rows.some(r => r.id === x.id)) { slot.rows.push(structuredClone(x.row)); slot.selected ??= x.id; } continue; }
        if (x.type === 'field') { const o = fieldAt(p, x); if (o && sameValue(o[x.field], x.from)) { if (x.to === null) delete o[x.field]; else o[x.field] = structuredClone(x.to); } continue; }
        if (lifeReplay(p, x) !== null) continue;
        if (!p[x.path.split('.')[0]]) continue;
        const box = boxAt(p, x.path, true), idKey = x.idKey || 'id';
        if (x.type === 'push' && !box.some(r => r[idKey] === x.item[idKey])) box.push(structuredClone(x.item));
        if (x.type === 'status') { const r = box.find(o => o.id === x.id); if (r && later(r.status, x.status)) { r.status = x.status; if (x.arrived) r.arrived ||= x.arrived; } }
        if (x.type === 'amend') { const r = box.find(o => o.id === x.id); if (r && r.amount === x.from) { r.amount = x.to; delete r.amountFrom; } }
    }
}
const LOOSE = ['sourceIndex', 'delivery', 'account'];
// (a field put back as none, a price filled in and taken back, is the none it was: never "changed by hand")
const unchanged = (path, now, was) => (/^(money|investment)\./.test(path) ? ['amount', 'price', 'qty', 'quantity', 'value', 'status'].every(k => (now[k] ?? null) === (was[k] ?? null))
    // (a delivery the clock alone moved on, "on the way" to "delivered", is no change by hand)
    : Object.keys({ ...was, ...now }).filter(k => !LOOSE.includes(k) && k !== 'byClock' && !(k === 'status' && now.byClock)).every(k => JSON.stringify(now[k] ?? null) === JSON.stringify(was[k] ?? null)));
// 되돌리기 · 빼기: undo money changes, newest first. A record gone already is fine; one changed since is left as it is and
// returned, so the caller can say what stayed
export function revertEffects(m, p, effects) {
    const f = finance(m), left = [];
    // a delivery order that stays (changed since: delivered, reviewed) keeps its payment with it
    // (compared as it will be once this list's own status changes are taken back: the same event's "delivered" is no hand)
    const asAfter = o => { const c = structuredClone(o); for (const x of [...effects].reverse()) if (x.type === 'status' && x.path === 'delivery.orders' && x.id === c.id && c.status === x.status) { c.status = x.prev; delete c.byClock; if ('arrivedFrom' in x && c.arrived === x.arrived) { if (x.arrivedFrom === null) delete c.arrived; else c.arrived = x.arrivedFrom; } } return c; };
    const dlvKept = new Set(effects.filter(x => x.type === 'push' && x.path === 'delivery.orders').map(x => { const o = (p.delivery?.orders || []).find(y => y.id === x.item?.id); return o && !unchanged(x.path, asAfter(o), x.item) ? x.item.id : null; }).filter(Boolean));
    const paidFor = new Set(dlvKept.size ? [...effects.filter(x => x.type === 'push' && x.path === 'money.tx' && dlvKept.has(x.item?.delivery)).map(x => x.item.id), ...(p.money?.tx || []).filter(t => dlvKept.has(t.delivery)).map(t => t.id)] : []);
    for (const x of [...effects].reverse()) {
        if (paidFor.size && (x.type === 'entry' || x.type === 'push' && x.path === 'money.tx') && paidFor.has(x.type === 'entry' ? x.id : x.item?.id)) { left.push(x); continue; }
        if (x.type === 'entry') { const L = f.accounts[x.key]; if (!L?.entries[x.id]) continue; if (L.entries[x.id].amount === x.amount) delete L.entries[x.id]; else left.push(x); continue; }
        if (x.type === 'amendEntry') { const line = f.accounts[x.key]?.entries[x.id]; if (!line) continue; if (line.amount === x.to) line.amount = x.from; else left.push(x); continue; }
        // a price the story gave: its row goes, the day's choice as it was
        if (x.type === 'price') { const slot = f.prices[x.key]?.[x.date]; if (!slot) continue; slot.rows = slot.rows.filter(r => r.id !== x.id); if (!slot.rows.length) { delete f.prices[x.key][x.date]; if (!Object.keys(f.prices[x.key]).length) delete f.prices[x.key]; } else if (x.prev) Object.assign(slot, x.prev); continue; }
        // a field set on a record (the brokerage's valuation day): back, unless changed since
        // (put back as it was: a field it had, null too, or none)
        if (x.type === 'field') { const o = fieldAt(p, x); if (o && sameValue(o[x.field], x.to)) { if (x.from === null && !x.had) delete o[x.field]; else o[x.field] = structuredClone(x.from); } else if (o) left.push(x); continue; }
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
