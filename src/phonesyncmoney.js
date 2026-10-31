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
import { cash, finance, finite, fx, migrateBank, positions, round } from './finance.js';
import { boxAt, lifeReplay, lifeRevert } from './phonesynclife.js';

const STEP = { ordered: 0, shipped: 1, 'on the way': 2, delivered: 3 };
const ORDER = ['ordered', 'shipped', 'on the way', 'delivered', 'unknown', 'cancelled', 'returning', 'returned', 'refunded'];
const txt = (v, n = 80) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, n);
const list = v => (Array.isArray(v) ? v : []);
const day = s => { const mt = /^(\d{2})-(\d{2})/.exec(String(s || '')); return mt ? Date.UTC(2001, mt[1] - 1, mt[2]) : NaN; };
const near = (a, b, days = 1) => Math.abs(day(a) - day(b)) <= days * 86400000;
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
    };
}

// e: { id, at, date: 'MM-DD', time, summary, money }; opts: { year, marks, legs: what this event did before }
// edited: the message was changed by the user after it was read, so its amounts may be corrected even when stated
export function applyMoney(m, p, e, { year, marks = {}, legs: prior = [], span = null, edited = false } = {}) {
    together = span;
    const out = { effects: [], changes: [], notes: [], legs: [] };
    const mo = e.money;
    if (!mo || typeof mo !== 'object') return out;
    const f = finance(m), guess = mo.amountFrom === 'guess', date = e.date, full = `${year}-${date}`;
    const bankOn = !!p.money && e.at > (marks.money?.index ?? -1), investOn = !!p.investment && e.at > (marks.invest?.index ?? -1);
    if ((list(mo.moves).length || list(mo.trades).length || list(mo.orders).length || list(mo.passes).length) && !/^\d{2}-\d{2}$/.test(date || '')) fail('돈이 움직인 날짜를 확인하지 못했어요');
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

    // money between the owner's own accounts: each pair compared on its own (other spending in the event aside).
    // bank ↔ brokerage always pairs; bank ↔ bank only when the event has just one out and one in. A fee on the out leg
    // ("fee") is what goes missing on the way.
    const own = list(mo.moves).filter(x => x.occurrence !== 'again' && !x.already);
    const cur = x => (/^broker:/i.test(String(x.account || '')) ? String(x.account).slice(7).toUpperCase() : p.money?.bank.accounts.find(a => a.last4 === String(x.account ?? '').replace(/\D/g, '').slice(-4))?.currency);
    // "amount" is what is sent and "fee" comes on top; an amount that already has the fee in it is taken as it is
    const feeOf = x => (finite(Number(x.fee)) && Number(x.fee) > 0 ? Number(x.fee) : 0);
    const sent = x => -Number(x.amount) - (x.withFee ? feeOf(x) : 0);
    const pairOff = (outs, ins) => { for (const y of ins) {
        const i = outs.findIndex(x => cur(x) === cur(y) && (Math.abs(-Number(x.amount) - Number(y.amount)) < 0.01 || feeOf(x) && Math.abs(-Number(x.amount) - feeOf(x) - Number(y.amount)) < 0.01 && (x.withFee = true)));
        if (i >= 0) outs.splice(i, 1); else if (outs.some(x => cur(x) === cur(y))) fail('이체의 보낸 돈과 받은 돈이 달라요');
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
        const amount = Number(x.amount), broker = /^broker:/i.test(String(x.account || ''));
        if (voided.has(k)) { out.legs.push({ key: `void:${k}`, amount, state: 'cancelled' }); return; }
        if (!finite(amount) || amount === 0) fail('금액을 확인하지 못했어요');
        if (broker ? !investOn : !bankOn) { out.legs.push({ key: `before:${x.account}`, amount, state: 'before' }); return; }
        if (broker) {
            const cur = String(x.account).slice(7).toUpperCase(), a = p.investment.accounts.find(y => y.currency === cur), L = a && f.accounts[a.key];
            if (!L) fail('증권 계좌를 찾지 못했어요');
            const key = `broker:${cur}`;
            if (keep(key, amount, rec => { const line = L.entries[rec]; if (!line) return; out.effects.push({ type: 'amendEntry', key: a.key, id: rec, from: line.amount, to: round(amount) }); out.notes.push(`증권 ${cur}: 추정 ${line.amount} → 실제 ${round(amount)}로 고쳤어요`); out.changes.push({ app: '투자', label: `증권 ${cur}`, amount: round(amount - line.amount), currency: cur }); line.amount = round(amount); })) return;
            const twin = Object.entries(L.entries).find(([, v]) => Math.abs(v.amount - amount) < 0.01 && near(String(v.date).slice(5), date, 0) && !fresh(x, v, e.at));
            if (!twin && x.occurrence === 'again') { out.legs.push({ key, amount: round(amount), state: 'again' }); return; }
            if (twin) { out.legs.push({ key, amount: round(amount), state: 'included', rec: twin[0] }); out.notes.push(`증권 ${cur} ${round(amount)}: 이미 있는 거래라 넣지 않았어요`); return; }
            const id = `sync:${e.id}:m${k}`;
            L.entries[id] = { amount: round(amount), date: full, sourceIndex: e.at };
            out.effects.push({ type: 'entry', key: a.key, id, amount: round(amount), date: full, sourceIndex: e.at });
            out.changes.push({ app: '투자', label: `증권 ${cur}`, amount: round(amount), currency: cur });
            out.legs.push({ key, amount: round(amount), state: 'applied', rec: id, from });
            return;
        }
        const acct = p.money.bank.accounts.find(a => a.last4 === String(x.account ?? '').replace(/\D/g, '').slice(-4));
        if (!acct) fail('계좌를 찾지 못했어요');
        if (x.currency && x.currency !== acct.currency) fail('계좌 통화와 금액 통화가 달라요');
        const key = `bank:${acct.id}`, lk = acct.kind === 'credit' ? '' : `${acct.id}:${acct.currency}`, label = `${acct.name || ''} ••••${acct.last4}`.trim();
        const tx = p.money.tx ||= [];
        if (keep(key, amount, rec => { const t = tx.find(r => r.id === rec); if (t) amend(t, amount, lk, label, acct); })) return;
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
        const id = `sync:${e.id}:m${k}`;
        const row = { id, account: acct.last4, who: txt(x.who, 60), ko: txt(x.ko, 60), amount: round(amount), time: `${date}${e.time ? ` ${e.time}` : ''}`,
            kind: acct.kind === 'credit' ? 'card' : ['card', 'transfer', 'deposit'].includes(x.kind) ? x.kind : amount > 0 ? 'deposit' : 'card', memo: txt(x.memo), pending: false, ev: e.id, storyEvent: e.id, sourceIndex: e.at, ...(guess ? { amountFrom: 'guess' } : {}) };
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
        const inv = p.investment, kind = t.kind, symbol = txt(t.symbol, 80), cur = String(t.currency || '').toUpperCase();
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
        const id = `sync:${e.id}:t${k}`;
        const trade = { id, kind, symbol, currency: cur, date: full, time: e.time || '', quantity: kind === 'dividend' ? undefined : quantity, price: kind === 'dividend' ? undefined : price, fee: kind === 'dividend' ? undefined : fee, amount: kind === 'dividend' ? amount : undefined,
            source: guess ? 'guess' : 'story', storyEvent: e.id, sourceIndex: e.at, rateAtTrade: fx(m, cur, inv.base, full) };
        try { positions([...inv.trades, trade]); } catch { fail('가진 것보다 많이 판 거래예요'); }
        inv.trades.push(trade);
        const flow = kind === 'buy' ? -(quantity * price + fee) : kind === 'sell' ? quantity * price - fee : amount;
        L.entries[id] = { amount: round(flow), date: full };
        out.effects.push({ type: 'push', path: 'investment.trades', item: structuredClone(trade) }, { type: 'entry', key: a.key, id, amount: round(flow), date: full });
        if (full > (inv.date || '')) inv.date = full;
        out.changes.push({ app: '투자', label: `${inv.securities.find(x => x.symbol === symbol)?.name || symbol} ${kind === 'buy' ? '매수' : kind === 'sell' ? '매도' : '배당'}${kind === 'dividend' ? '' : ` ${quantity}주`}`, amount: round(flow), currency: cur });
        out.legs.push({ key, amount: size, state: 'applied', rec: id });
    });

    const records = (path, rows, make, same) => rows.forEach((x, k) => {
        if (!bankOn) return;
        const box = p.money[path] ||= [];
        const old = x.already && box.find(o => o.id === x.already) || box.find(o => same(o, x) && !fresh(x, o, e.at));
        if (!old && x.occurrence === 'again') return;
        if (old) {
            if (x.status && ORDER.includes(x.status) && x.status !== old.status && later(old.status, x.status)) {
                const was = old.status;
                old.status = x.status;
                if (path === 'orders' && x.status === 'delivered' && /^\d{2}-\d{2}$/.test(date || '')) old.arrived ||= date;
                out.effects.push({ type: 'status', path: `money.${path}`, id: old.id, status: x.status, prev: was });
                out.changes.push({ app: path === 'orders' ? '쇼핑' : '지갑', label: `${old.item || old.by} 상태`, amount: null });
            }
            return;
        }
        const row = { ...make(x), id: `sync:${e.id}:${path[0]}${k}`, ev: e.id, storyEvent: e.id, sourceIndex: e.at };
        if (path === 'orders' && row.status !== 'cancelled' && row.price && x.paid !== false && !x.gift && !list(mo.moves).some(y => Number(y.amount) < 0)) out.notes.push(`${row.item}: 주문은 넣었지만 결제가 없었어요`);
        box.push(row);
        out.effects.push({ type: 'push', path: `money.${path}`, item: structuredClone(row) });
        out.changes.push({ app: path === 'orders' ? '쇼핑' : '지갑', label: row.item || row.by, amount: null });
    });
    records('orders', list(mo.orders), x => {
        const price = Number(x.price);
        if (!txt(x.item) || !txt(x.shop)) fail('주문의 가게나 물건을 확인하지 못했어요');
        return { shop: txt(x.shop, 60), item: txt(x.item), ko: txt(x.ko), option: txt(x.option, 60), qty: Math.max(1, Math.round(Number(x.qty) || 1)), price: finite(price) ? price : null, time: date, status: ORDER.includes(x.status) ? x.status : 'ordered', eta: txt(x.eta, 5), arrived: '', gift: x.gift === true ? '선물' : txt(x.gift, 40), ...(x.paid === false ? { paid: false } : {}), ...(guess ? { amountFrom: 'guess' } : {}) };
    }, (o, x) => samePlace(o.shop, x.shop) && samePlace(o.item, x.item) && near(o.time, date));
    records('passes', list(mo.passes), x => {
        if (!txt(x.by)) fail('티켓 정보를 확인하지 못했어요');
        return { kind: ['flight', 'train', 'hotel', 'event', 'other'].includes(x.kind) ? x.kind : 'other', by: txt(x.by, 60), from: txt(x.from, 40), to: txt(x.to, 40), date: /^\d{2}-\d{2}$/.test(x.date || '') ? x.date : date, time: txt(x.time, 5), seat: txt(x.seat, 12), gate: txt(x.gate, 12), no: txt(x.no, 24), status: txt(x.status, 30) };
    }, (o, x) => samePlace(o.by, x.by) && o.kind === x.kind && (o.no && o.no === txt(x.no, 24) || o.date === (x.date || date)));
    // 배달: an order in the delivery app. Its payment is a move of the same event (the card or bank row it made, or one
    // already there), tied to it here; with no paying move it was paid in cash at the door
    const dlvOn = !!p.delivery && e.at > (marks.delivery?.index ?? -1);
    list(mo.deliveries).forEach((x, k) => {
        if (!dlvOn) return;
        const box = p.delivery.orders ||= [];
        const items = list(x.items).map(d => ({ name: txt(d?.name, 60), ko: txt(d?.ko, 60), option: txt(d?.option, 60), qty: Math.max(1, Math.round(Number(d?.qty) || 1)), price: finite(Number(d?.price)) ? Number(d.price) : 0 })).filter(d => d.name).slice(0, 10);
        if (!txt(x.shop) || !items.length) fail('배달 주문의 가게나 메뉴를 확인하지 못했어요');
        const money = v => (finite(Number(v)) ? Math.abs(Number(v)) : 0), total = round(items.reduce((n, d) => n + d.qty * d.price, 0) + money(x.fee) + money(x.tip) - money(x.discount));
        const old = x.already && box.find(o => o.id === x.already) || box.find(o => samePlace(o.shop, x.shop) && near(String(o.time).slice(0, 5), date, 0) && Math.abs(dlvTotal(o) - total) < 0.01 && !fresh(x, o, e.at));
        if (!old && x.occurrence === 'again') return;
        const status = ['on the way', 'delivered', 'cancelled', 'refunded'].includes(x.status) ? x.status : 'delivered';
        if (old) {
            if (status !== old.status && later(old.status, status)) {
                out.effects.push({ type: 'status', path: 'delivery.orders', id: old.id, status, prev: old.status });
                old.status = status;
                out.changes.push({ app: '배달', label: `${old.shop} 상태`, amount: null });
            }
            return;
        }
        const time = /^\d{2}-\d{2}/.test(String(x.time || '')) ? txt(x.time, 11) : `${date}${e.time ? ` ${e.time}` : ''}`;
        const row = { shop: txt(x.shop, 60), items, fee: money(x.fee), tip: money(x.tip), discount: money(x.discount), mode: x.mode === 'pickup' ? 'pickup' : 'delivery', time, arrived: txt(x.arrived, 11),
            to: txt(x.to, 40) || 'home', address: txt(x.address, 80), left: txt(x.left, 60), noteShop: txt(x.noteShop, 120), noteShopKo: txt(x.noteShopKo, 200), noteRider: txt(x.noteRider, 120), noteRiderKo: txt(x.noteRiderKo, 200),
            noCutlery: x.noCutlery === true, for: Math.max(1, Math.round(Number(x.for) || 1)), status, gift: txt(x.gift, 40), reviewed: false, account: 'cash',
            id: `sync:${e.id}:d${k}`, ev: e.id, storyEvent: e.id, sourceIndex: e.at, sync: true };
        // the row that paid it: made by this event, or one already in the bank this event pointed at
        const made = out.effects.find(f => f.type === 'push' && f.path === 'money.tx' && Math.abs(f.item.amount + total) < 0.01 && !f.item.delivery);
        const kept = !made && out.legs.find(l => l.state === 'included' && Math.abs(l.amount + total) < 0.01 && p.money?.tx?.some(t => t.id === l.rec && !t.delivery));
        const t = made ? p.money.tx.find(r => r.id === made.item.id) : kept ? p.money.tx.find(r => r.id === kept.rec) : null;
        if (t) { t.delivery = row.id; row.account = t.account; if (made) made.item.delivery = row.id; }
        else if (status !== 'cancelled' && total > 0 && !row.gift && p.money && list(mo.moves).length) out.notes.push(`${row.shop}: 배달은 넣었지만 결제를 찾지 못해서 현금으로 뒀어요`);
        box.push(row);
        out.effects.push({ type: 'push', path: 'delivery.orders', item: structuredClone(row) });
        out.changes.push({ app: '배달', label: row.shop, amount: null });
    });
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
export function payOrders(m, p, year) {
    if (!p.money || !p.delivery) return 0;
    migrateBank(m, p);
    const f = finance(m), tx = p.money.tx ||= [];
    let n = 0;
    const put = (o, a, id, amount, time, memo) => {
        if (tx.some(t => t.id === id)) return;
        tx.push({ id, account: a.last4, who: o.shop, ko: o.ko || '', amount, time, kind: 'card', memo, pending: false, ...(o.ev ? { ev: o.ev } : {}), delivery: o.id });
        if (a.kind !== 'credit') { const L = f.accounts[`${a.id}:${a.currency}`]; if (L) L.entries[id] = { amount, date: `${year}-${time.slice(0, 5)}` }; }
        n++;
    };
    for (const o of p.delivery.orders) {
        if (o.status === 'cancelled' || o.sync) continue;
        const a = payAccount(p, o);
        if (!a) continue;
        const total = dlvTotal(o);
        if (!(total > 0)) continue;
        put(o, a, `${PAY}${o.id}`, -total, o.time, o.mode === 'pickup' ? 'Pickup' : 'Delivery');
        if (o.status === 'refunded') put(o, a, `${PAY}${o.id}-r`, total, o.arrived || o.time, 'Refund');
    }
    tx.sort((a, b) => String(a.time).localeCompare(String(b.time)));
    for (const a of p.money.bank.accounts) if (a.kind !== 'credit') { const L = f.accounts[`${a.id}:${a.currency}`]; if (L) a.balance = round(L.amount + Object.values(L.entries).reduce((s, x) => s + x.amount, 0)); }
    return n;
}

// 복구: put back what a lost save dropped; something already there stays as it is
export function replayEffects(m, p, effects) {
    const f = finance(m);
    for (const x of effects) {
        if (x.type === 'entry') { const L = f.accounts[x.key]; if (L && !L.entries[x.id]) L.entries[x.id] = { amount: x.amount, date: x.date, ...(x.sourceIndex !== undefined ? { sourceIndex: x.sourceIndex } : {}) }; continue; }
        if (x.type === 'amendEntry') { const line = f.accounts[x.key]?.entries[x.id]; if (line && line.amount === x.from) line.amount = x.to; continue; }
        if (lifeReplay(p, x) !== null) continue;
        if (!p[x.path.split('.')[0]]) continue;
        const box = boxAt(p, x.path, true), idKey = x.idKey || 'id';
        if (x.type === 'push' && !box.some(r => r[idKey] === x.item[idKey])) box.push(structuredClone(x.item));
        if (x.type === 'status') { const r = box.find(o => o.id === x.id); if (r && later(r.status, x.status)) r.status = x.status; }
        if (x.type === 'amend') { const r = box.find(o => o.id === x.id); if (r && r.amount === x.from) { r.amount = x.to; delete r.amountFrom; } }
    }
}
const LOOSE = ['sourceIndex', 'delivery', 'account'];
const unchanged = (path, now, was) => (/^(money|investment)\./.test(path) ? ['amount', 'price', 'qty', 'quantity', 'status'].every(k => now[k] === was[k])
    : Object.keys({ ...was, ...now }).filter(k => !LOOSE.includes(k)).every(k => JSON.stringify(now[k] ?? null) === JSON.stringify(was[k] ?? null)));
// 되돌리기 · 빼기: undo money changes, newest first. A record gone already is fine; one changed since is left as it is and
// returned, so the caller can say what stayed
export function revertEffects(m, p, effects) {
    const f = finance(m), left = [];
    for (const x of [...effects].reverse()) {
        if (x.type === 'entry') { const L = f.accounts[x.key]; if (!L?.entries[x.id]) continue; if (L.entries[x.id].amount === x.amount) delete L.entries[x.id]; else left.push(x); continue; }
        if (x.type === 'amendEntry') { const line = f.accounts[x.key]?.entries[x.id]; if (!line) continue; if (line.amount === x.to) line.amount = x.from; else left.push(x); continue; }
        const back = lifeRevert(p, x);
        if (back !== null) { if (!back) left.push(x); continue; }
        const box = boxAt(p, x.path);
        if (!box) continue;
        const idKey = x.idKey || 'id', i = box.findIndex(r => r[idKey] === (x.item?.[idKey] ?? x.id));
        if (i < 0) continue;
        // a record changed since it went in (an amount, a status, a count; for the everyday apps, anything) is the user's now: it stays
        if (x.type === 'push') { if (unchanged(x.path, box[i], x.item)) box.splice(i, 1); else left.push(x); }
        if (x.type === 'status') { if (box[i].status === x.status) box[i].status = x.prev; else left.push(x); }
        if (x.type === 'amend') { if (box[i].amount === x.to) { box[i].amount = x.from; box[i].amountFrom = 'guess'; } else left.push(x); }
    }
    return left;
}
