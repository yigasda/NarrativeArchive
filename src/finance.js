// Shared prices and immutable cash baselines. No host dependencies: calculations are testable outside SillyTavern.
export const finite = v => typeof v === 'number' && Number.isFinite(v);
export const currency = v => /^[A-Z]{3}$/.test(v || '') ? v : null;
export const uid = () => globalThis.crypto.randomUUID();
export const round = n => Math.round((n + Number.EPSILON) * 100) / 100;
export function finance(m) {
    return m.finance ||= { version: 1, accounts: {}, transfers: {}, prices: {}, revisions: [] };
}
export function baseline(m, id, cur, amount, asOf, owner) {
    if (!currency(cur) || !finite(amount)) throw new Error('잔액과 통화를 확인해 주세요');
    const f = finance(m), key = `${id}:${cur}`;
    if (!f.accounts[key]) f.accounts[key] = { id, currency: cur, amount, asOf, owner, entries: {}, included: [] };
    return f.accounts[key];
}
export const cash = a => round(a.amount + Object.values(a.entries).reduce((n, x) => n + x.amount, 0));
export function reviseBaseline(m, key, amount, reason) {
    const a = finance(m).accounts[key];
    if (!a || !finite(amount) || !reason?.trim()) throw new Error('수정 금액과 이유가 필요해요');
    finance(m).revisions.push({ key, before: a.amount, after: amount, reason, at: Date.now() });
    a.amount = amount;
}
export function transfer(m, t) {
    const f = finance(m);
    if (!t.id || !t.date) throw new Error('이체 ID와 날짜가 필요해요');
    if (f.transfers[t.id]) {
        const old = f.transfers[t.id];
        if (JSON.stringify(old) !== JSON.stringify(t)) throw new Error('같은 이체 ID의 내용이 달라요');
        return old;
    }
    const from = f.accounts[t.from], to = f.accounts[t.to];
    if (!from || !to || from.owner !== to.owner || from.id === to.id && from.currency === to.currency) throw new Error('이체 계좌를 확인해 주세요');
    if (![t.sent, t.received, t.fee].every(finite) || t.sent <= 0 || t.received <= 0 || t.fee < 0) throw new Error('이체 금액과 수수료가 필요해요');
    if (t.fee && (!['sender', 'receiver'].includes(t.feeSide) || t.feeCurrency !== (t.feeSide === 'sender' ? from.currency : to.currency))) throw new Error('수수료 통화와 차감 위치가 필요해요');
    // sent/received exclude fee. The fee is charged on the explicitly named side.
    if (from.currency !== to.currency && (!finite(t.rate) || t.rate <= 0 || Math.abs(round(t.sent * t.rate) - t.received) > 0.01)) throw new Error('환전 금액과 적용 환율이 맞지 않아요');
    if (from.currency === to.currency && t.sent !== t.received) throw new Error('같은 통화의 이체 원금이 달라요');
    const debit = t.sent + (t.feeSide === 'sender' ? t.fee : 0), credit = t.received - (t.feeSide === 'receiver' ? t.fee : 0);
    if (credit < 0 || (!t.includedFrom && cash(from) < debit)) throw new Error('이체 가능한 잔액이 부족해요');
    f.transfers[t.id] = structuredClone(t);
    if (t.includedFrom) from.included.push(t.id); else from.entries[t.id] = { amount: -debit, date: t.date };
    if (t.includedTo) to.included.push(t.id); else to.entries[t.id] = { amount: credit, date: t.date };
    return t;
}
export function quoteKey(key) {
    const match = /^FX:([A-Z]{3})\/([A-Z]{3})$/.exec(key);
    return match && match[1] > match[2] ? `FX:${match[2]}/${match[1]}` : key;
}
// Source prices with unknown ordering remain candidates. Existing selection stays usable without blocking navigation.
export function addPrice(m, key, date, row) {
    const canonical = quoteKey(key);
    if (canonical !== key) { key = canonical; row = { ...row, value: 1 / row.value }; }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !finite(row.value) || row.value <= 0) throw new Error('시세 날짜와 값을 확인해 주세요');
    const book = finance(m).prices[key] ||= {}, slot = book[date] ||= { rows: [], selected: null, conflict: false };
    if (slot.rows.some(x => x.value === row.value && x.time === (row.time || '') && x.source === row.source && x.ref === (row.ref || ''))) return slot;
    const next = { id: uid(), value: row.value, time: row.time || '', source: row.source === 'story' ? 'story' : 'guess', ref: row.ref || '' };
    const old = slot.rows.find(x => x.id === slot.selected);
    slot.rows.push(next);
    if (old && slot.chosen && old.value !== next.value) { slot.conflict = true; return slot; }
    if (!old || old.source === 'guess' && next.source === 'story') slot.selected = next.id;
    else if (old.source === next.source && old.value !== next.value) {
        if (old.time && next.time && old.time !== next.time) { if (next.time > old.time) slot.selected = next.id; }
        else slot.conflict = true;
    }
    return slot;
}
export function selectPrice(m, key, date, id) {
    key = quoteKey(key);
    const s = finance(m).prices[key]?.[date];
    if (!s?.rows.some(x => x.id === id)) throw new Error('시세 후보를 찾지 못했어요');
    s.selected = id; s.conflict = false; s.chosen = true;
}
export function price(m, key, date) {
    const canonical = quoteKey(key), inverse = canonical !== key;
    const book = finance(m).prices[canonical] || {}, day = Object.keys(book).filter(d => d <= date).sort().pop();
    const s = book[day], row = s?.rows.find(x => x.id === s.selected);
    return row ? { ...row, value: inverse ? Number((1 / row.value).toPrecision(15)) : row.value, date: day, stale: day !== date, conflict: s.conflict } : null;
}
export function fx(m, from, to, date) {
    if (from === to) return 1;
    const a = price(m, `FX:${from}/${to}`, date), b = price(m, `FX:${to}/${from}`, date);
    // Do not silently use yesterday's FX for today's total.
    return a && !a.stale ? a.value : b && !b.stale ? 1 / b.value : null;
}
export function total(m, amounts, base, date) {
    let value = 0; const missing = [];
    for (const x of amounts) {
        const rate = fx(m, x.currency, base, date);
        if (!finite(x.amount) || rate === null) missing.push(x);
        else value += x.amount * rate;
    }
    return { value: round(value), complete: missing.length === 0, missing };
}
// Existing bank balances are snapshots, including the old transactions. Never replay those transactions.
// Credit summaries are derived from the displayed ledger, not a separately invented balance.
export function creditUsage(p,a) {
    const dateParts=value=> /^(?:(\d{4})-)?(\d{2})-(\d{2})/.exec(String(value || '').trim());
    const now=dateParts(p.now) || dateParts(p.money?.asOf) || dateParts(p.money?.fxDate);
    if(!Array.isArray(p.money?.tx) || !a.last4 || !now) return {spent:finite(a.spent)&&a.spent>=0?a.spent:finite(a.balance)&&a.balance>=0?a.balance:null,refund:0};
    let net=0;
    for(const t of p.money.tx) {
        if(t.account!==a.last4 || t.kind!=='card' || t.pending) continue;
        const d=dateParts(t.time);
        if(!d) return {spent:null,refund:0};
        if(d[2]!==now[2] || d[1]&&now[1]&&d[1]!==now[1] || Number(d[3])>Number(now[3])) continue;
        if(!finite(t.amount)) return {spent:null,refund:0};
        net=round(net-t.amount);
    }
    return {spent:Math.max(0,net),refund:Math.max(0,-net)};
}
export const creditAmount = a => a.refundCredit>0 ? a.refundCredit : a.spent ?? null;
export const creditLabel = (a,label='이번 달 사용') => a.refundCredit>0 ? '이번 달 순환급' : label;
export function migrateBank(m, p) {
    if (!p.money) return;
    const f = finance(m);
    for (const a of p.money.bank.accounts) {
        a.id ||= uid(); a.currency ||= p.money.currency;
        if (a.kind === 'credit') { const usage=creditUsage(p,a);a.spent=usage.spent;a.refundCredit=usage.refund;continue; }
        if (!currency(a.currency) || !finite(a.balance)) continue;
        const b = baseline(m, a.id, a.currency, a.balance, p.money.asOf || p.now || '', p.owner);
        if (!b.legacyImported) { b.included.push(...(p.money.tx || []).filter(t => t.account === a.last4).map(t => t.id).filter(Boolean)); b.legacyImported = true; }
        a.balance = cash(b);
    }
    return f;
}
export function positions(trades, opening = []) {
    const map = new Map(opening.map(x => [x.symbol, { ...x, quantity: x.quantity, cost: x.quantity * x.average, realized: 0, dividends: 0 }]));
    for (const t of [...trades].sort((a, b) => a.date.localeCompare(b.date) || (a.time||'').localeCompare(b.time||'') || (a.sourceIndex??-1)-(b.sourceIndex??-1))) {
        const h = map.get(t.symbol) || { symbol: t.symbol, currency: t.currency, quantity: 0, cost: 0, realized: 0, dividends: 0 };
        if (h.currency !== t.currency) throw new Error('동일 종목의 거래 통화가 달라요');
        if (t.kind === 'dividend') { if (!finite(t.amount) || t.amount < 0) throw new Error('배당금을 확인해 주세요'); h.dividends += t.amount; }
        else {
            if (![t.quantity, t.price, t.fee].every(finite) || t.quantity <= 0 || t.price < 0 || t.fee < 0) throw new Error('매매 수량·가격·수수료를 확인해 주세요');
            if (t.kind === 'buy') { h.quantity += t.quantity; h.cost += t.quantity * t.price + t.fee; }
            else if (t.kind === 'sell') {
                if (t.quantity > h.quantity + 1e-9) throw new Error('보유량보다 많이 매도할 수 없어요');
                const cost = h.cost * t.quantity / h.quantity;
                h.quantity -= t.quantity; h.cost -= cost; h.realized += t.quantity * t.price - t.fee - cost;
            } else throw new Error('지원하지 않는 거래 종류예요');
        }
        h.average = h.quantity ? h.cost / h.quantity : null; map.set(t.symbol, h);
    }
    return [...map.values()];
}

// Historic FX is frozen on each execution. Later quote corrections change valuation, never acquisition cost.
export function baseCosts(trades, base) {
    const out = {};
    for (const t of [...trades].sort((a,b)=>a.date.localeCompare(b.date) || (a.time||'').localeCompare(b.time||'') || (a.sourceIndex??-1)-(b.sourceIndex??-1))) {
        const h = out[t.symbol] ||= { quantity: 0, cost: 0 };
        if (t.kind === 'dividend') continue;
        if (t.kind === 'buy') {
            const rate = t.currency === base ? 1 : t.rateAtTrade;
            h.cost = h.cost === null || !finite(rate) ? null : h.cost + (t.quantity * t.price + t.fee) * rate;
            h.quantity += t.quantity;
        } else {
            h.cost = h.cost === null ? null : h.cost * (1 - t.quantity / h.quantity);
            h.quantity -= t.quantity;
            if (Math.abs(h.quantity) < 1e-9) { h.quantity = 0; h.cost = 0; }
        }
    }
    return out;
}
