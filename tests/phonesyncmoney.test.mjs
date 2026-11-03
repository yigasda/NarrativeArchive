import test from 'node:test';
import assert from 'node:assert/strict';
import { applyMoney, replayEffects, revertEffects } from '../src/phonesyncmoney.js';
import { cardClock } from '../src/phonesynclife.js';
import { baseline, cash, migrateBank, positions } from '../src/finance.js';

function setup({ tx = [], trades = [] } = {}) {
    const m = {}, p = {
        owner: 'Ren', now: '10-26 12:00',
        money: { currency: 'EUR', asOf: '2026-10-20', bank: { accounts: [
            { id: 'chk', kind: 'checking', name: 'Giro', last4: '1111', currency: 'EUR', balance: 1000 },
            { id: 'cc', kind: 'credit', name: 'Karte', last4: '2222', currency: 'EUR', balance: 0 }] }, tx, orders: [], passes: [] },
        investment: { base: 'EUR', date: '2026-10-20', accounts: [{ key: 'brk:EUR', currency: 'EUR' }], securities: [{ symbol: 'XETRA:SAP', name: 'SAP', currency: 'EUR' }], trades },
    };
    migrateBank(m, p);
    baseline(m, 'brk', 'EUR', 1000, '2026-10-01', 'Ren');
    return { m, p, bank: () => cash(m.finance.accounts['chk:EUR']), broker: () => cash(m.finance.accounts['brk:EUR']) };
}
const ev = (id, at, date, money) => ({ id, at, date, summary: id, money });
const opts = (extra = {}) => ({ year: '2026', marks: { base: { index: 0 }, money: { index: 0 }, invest: { index: 0 } }, ...extra });

test('a debit payment lowers the balance; a card purchase only goes on the card', () => {
    const { m, p, bank } = setup();
    applyMoney(m, p, ev('flowers', 5, '10-26', { moves: [{ account: '1111', amount: -25, who: 'Blumen Koch' }] }), opts());
    applyMoney(m, p, ev('dinner', 6, '10-26', { moves: [{ account: '2222', amount: -80, who: 'Trattoria' }] }), opts());
    migrateBank(m, p);
    assert.equal(bank(), 975);
    // the card payment waits through its day ("승인 대기"), then counts in the card's month
    assert.equal(p.money.tx.at(-1).pending, true);
    assert.equal(p.money.bank.accounts[1].spent, 0);
    cardClock(p, '10-27 09:00'); migrateBank(m, p);
    assert.equal(p.money.tx.at(-1).pending, false);
    assert.equal(p.money.bank.accounts[1].spent, 80);
    assert.equal(p.money.tx.length, 2);
});

test('the balance may go below zero; nothing is made up to cover it', () => {
    const { m, p, bank } = setup();
    applyMoney(m, p, ev('rent', 5, '10-26', { moves: [{ account: '1111', amount: -1500 }] }), opts());
    assert.equal(bank(), -500);
});

test('already in the bank (900 after a 100 transfer): the same transfer read again is not taken twice', () => {
    const { m, p, bank } = setup({ tx: [{ id: 'old1', account: '1111', who: 'Mara', amount: -100, time: '10-25 18:00', kind: 'transfer' }] });
    m.finance.accounts['chk:EUR'].amount = 900;
    const r = applyMoney(m, p, ev('to-mara', 7, '10-25', { moves: [{ account: '1111', amount: -100, who: 'Mara', kind: 'transfer' }] }), opts());
    assert.equal(bank(), 900);
    assert.equal(r.legs[0].state, 'included');
    const r2 = applyMoney(m, p, ev('to-mara-again', 8, '10-25', { moves: [{ account: '1111', amount: -100, who: 'Mara', kind: 'transfer', occurrence: 'new' }] }), opts());
    assert.equal(bank(), 800);
    assert.equal(r2.legs[0].state, 'applied');
});

test('the model pointing at a record means it is already there', () => {
    const { m, p, bank } = setup({ tx: [{ id: 'old2', account: '1111', who: 'Café', amount: -4, time: '10-10 09:00', kind: 'card' }] });
    applyMoney(m, p, ev('coffee', 5, '10-26', { moves: [{ account: '1111', amount: -4.5, already: 'old2' }] }), opts());
    assert.equal(bank(), 1000);
});

test('an event seen before keeps its first amount, unless a guess meets the real one', () => {
    const { m, p, bank } = setup();
    const first = applyMoney(m, p, ev('gift', 5, '10-26', { amountFrom: 'story', moves: [{ account: '1111', amount: -100 }] }), opts());
    const again = applyMoney(m, p, ev('gift', 9, '10-26', { amountFrom: 'story', moves: [{ account: '1111', amount: -120 }] }), opts({ legs: first.legs }));
    assert.equal(bank(), 900);
    assert.equal(again.notes.length, 1);
});

test('a guessed €100 later stated as €120: the same record is corrected by the difference, once', () => {
    const { m, p, bank } = setup();
    const first = applyMoney(m, p, ev('gift', 5, '10-26', { amountFrom: 'guess', moves: [{ account: '1111', amount: -100, who: 'Juwelier' }] }), opts());
    const fixd = applyMoney(m, p, ev('gift', 9, '10-26', { amountFrom: 'story', moves: [{ account: '1111', amount: -120, who: 'Juwelier' }] }), opts({ legs: first.legs }));
    assert.equal(bank(), 880);
    assert.equal(p.money.tx.length, 1);
    assert.equal(p.money.tx[0].amountFrom, undefined);
    applyMoney(m, p, ev('gift', 12, '10-26', { amountFrom: 'story', moves: [{ account: '1111', amount: -120, who: 'Juwelier' }] }), opts({ legs: fixd.legs }));
    assert.equal(bank(), 880);
});

test('the real amount found under another event id still corrects the guess, not a second payment', () => {
    const { m, p } = setup();
    applyMoney(m, p, ev('dinner-30', 30, '10-26', { amountFrom: 'guess', moves: [{ account: '2222', amount: -86.5, who: 'Trattoria da Ivo' }] }), opts());
    applyMoney(m, p, ev('the-bill', 41, '10-26', { amountFrom: 'story', moves: [{ account: '2222', amount: -112, who: 'Trattoria da Ivo' }] }), opts());
    cardClock(p, '10-27 09:00'); migrateBank(m, p);
    assert.equal(p.money.tx.length, 1);
    assert.equal(p.money.bank.accounts[1].spent, 112);
});

test('되돌리기 takes one round out and leaves later edits alone', () => {
    const { m, p, bank, broker } = setup();
    const r = applyMoney(m, p, ev('depot', 31, '10-26', { moves: [{ account: '1111', amount: -200, kind: 'transfer' }, { account: 'broker:EUR', amount: 200 }],
        trades: [{ kind: 'buy', symbol: 'XETRA:SAP', currency: 'EUR', quantity: 1, price: 180, fee: 1 }], orders: [{ shop: 'Hugendubel', item: 'Atlas', qty: 1, price: 30, status: 'ordered' }] }), opts());
    p.money.tx.push({ id: 'mine', account: '1111', who: 'Bäcker', amount: -3, time: '10-27 08:00', kind: 'card' });
    revertEffects(m, p, r.effects);
    assert.equal(bank(), 1000);
    assert.equal(broker(), 1000);
    assert.equal(p.investment.trades.length, 0);
    assert.equal(p.money.orders.length, 0);
    assert.deepEqual(p.money.tx.map(t => t.id), ['mine']);
});

test('an app made after the event already holds it', () => {
    const { m, p, bank } = setup();
    const r = applyMoney(m, p, ev('old', 5, '10-26', { moves: [{ account: '1111', amount: -50 }] }), opts({ marks: { money: { index: 10 }, invest: { index: 0 } } }));
    assert.equal(bank(), 1000);
    assert.equal(r.legs[0].state, 'before');
});

test('bank made at #120, brokerage at #130: a #125 transfer moves only the bank', () => {
    const { m, p, bank, broker } = setup();
    applyMoney(m, p, ev('to-broker', 125, '10-26', { moves: [{ account: '1111', amount: -100, kind: 'transfer' }, { account: 'broker:EUR', amount: 100 }] }), opts({ marks: { money: { index: 120 }, invest: { index: 130 } } }));
    assert.equal(bank(), 900);
    assert.equal(broker(), 1000);
});

test('a buy uses brokerage cash; selling more than held is refused', () => {
    const { m, p, broker } = setup();
    applyMoney(m, p, ev('buy-sap', 5, '10-21', { trades: [{ kind: 'buy', symbol: 'XETRA:SAP', currency: 'EUR', quantity: 2, price: 200, fee: 1 }] }), opts());
    assert.equal(broker(), 599);
    assert.throws(() => applyMoney(m, p, ev('sell-sap', 6, '10-22', { trades: [{ kind: 'sell', symbol: 'XETRA:SAP', currency: 'EUR', quantity: 5, price: 210, fee: 0 }] }), opts()), /많이 판/);
});

test('newest first, then an older buy: holdings and gains follow the story dates', () => {
    const { m, p } = setup({ trades: [{ id: 't0', kind: 'buy', symbol: 'XETRA:SAP', currency: 'EUR', date: '2026-10-01', quantity: 10, price: 100, fee: 0 }] });
    applyMoney(m, p, ev('sell', 40, '10-28', { trades: [{ kind: 'sell', symbol: 'XETRA:SAP', currency: 'EUR', quantity: 5, price: 150, fee: 0 }] }), opts());
    applyMoney(m, p, ev('buy', 20, '10-20', { trades: [{ kind: 'buy', symbol: 'XETRA:SAP', currency: 'EUR', quantity: 10, price: 130, fee: 0 }] }), opts());
    const h = positions(p.investment.trades)[0];
    assert.equal(h.quantity, 15);
    assert.equal(Math.round(h.realized * 100) / 100, 175); // average 115 at the sale: 5 × (150 − 115)
});

test('orders only move forward; a cancellation can come at any point', () => {
    const { m, p } = setup();
    applyMoney(m, p, ev('book', 5, '10-20', { orders: [{ shop: 'Hugendubel', item: 'Atlas', qty: 1, price: 30, status: 'delivered' }] }), opts());
    const id = p.money.orders[0].id;
    applyMoney(m, p, ev('book2', 6, '10-19', { orders: [{ already: id, status: 'shipped' }] }), opts());
    assert.equal(p.money.orders[0].status, 'delivered');
    applyMoney(m, p, ev('book3', 7, '10-22', { orders: [{ already: id, status: 'returned' }] }), opts());
    assert.equal(p.money.orders[0].status, 'returned');
});

test('복구 puts back only what is missing, once', () => {
    const { m, p, bank } = setup();
    const before = structuredClone({ money: p.money, finance: m.finance });
    const r = applyMoney(m, p, ev('flowers', 5, '10-26', { moves: [{ account: '1111', amount: -25 }] }), opts());
    p.money = before.money; m.finance = before.finance;
    replayEffects(m, p, r.effects); replayEffects(m, p, r.effects);
    assert.equal(bank(), 975);
    assert.equal(p.money.tx.length, 1);
});

test('read again without "already": a payment added by an earlier round is not taken twice', () => {
    const { m, p, bank } = setup();
    applyMoney(m, p, ev('depot-31', 31, '10-26', { moves: [{ account: '1111', amount: -200, who: 'Depot', kind: 'transfer' }, { account: 'broker:EUR', amount: 200 }] }), opts());
    const r = applyMoney(m, p, ev('depot-35', 35, '10-26', { moves: [{ account: '1111', amount: -200, who: 'Depot', kind: 'transfer' }, { account: 'broker:EUR', amount: 200 }] }), opts());
    assert.equal(bank(), 800);
    assert.equal(cash(m.finance.accounts['brk:EUR']), 1200);
    assert.deepEqual(r.legs.map(l => l.state), ['included', 'included']);
    assert.equal(r.notes.length, 2);
});

test('a guessed amount guessed differently the second time is still the same dinner', () => {
    const { m, p } = setup();
    applyMoney(m, p, ev('dinner-30', 30, '10-26', { amountFrom: 'guess', moves: [{ account: '2222', amount: -86.5, who: 'Trattoria da Ivo' }] }), opts());
    applyMoney(m, p, ev('dinner-34', 34, '10-26', { amountFrom: 'guess', moves: [{ account: '2222', amount: -92, who: 'Trattoria da Ivo' }] }), opts());
    assert.equal(p.money.tx.length, 1);
});

test('the same order and trade read again stay one', () => {
    const { m, p } = setup();
    const buy = { trades: [{ kind: 'buy', symbol: 'XETRA:SAP', currency: 'EUR', quantity: 1, price: 180, fee: 1 }], orders: [{ shop: 'Hugendubel', item: 'Reiseführer Lissabon', qty: 1, price: 24, status: 'ordered' }] };
    applyMoney(m, p, ev('a', 31, '10-26', buy), opts());
    applyMoney(m, p, ev('b', 35, '10-26', structuredClone(buy)), opts());
    assert.equal(p.investment.trades.length, 1);
    assert.equal(p.money.orders.length, 1);
});

test('really separate: the same 30,000 two days running, and the same stock bought twice at another price', () => {
    const { m, p, bank } = setup();
    applyMoney(m, p, ev('d1', 9, '10-27', { moves: [{ account: '1111', amount: -30, who: 'Dohyeon', kind: 'transfer' }] }), opts());
    applyMoney(m, p, ev('d2', 15, '10-28', { moves: [{ account: '1111', amount: -30, who: 'Dohyeon', kind: 'transfer' }] }), opts());
    assert.equal(bank(), 940);
    applyMoney(m, p, ev('b1', 20, '10-28', { trades: [{ kind: 'buy', symbol: 'XETRA:SAP', currency: 'EUR', quantity: 1, price: 180, fee: 0 }] }), opts());
    applyMoney(m, p, ev('b2', 21, '10-28', { trades: [{ kind: 'buy', symbol: 'XETRA:SAP', currency: 'EUR', quantity: 1, price: 186, fee: 0 }] }), opts());
    assert.equal(positions(p.investment.trades)[0].quantity, 2);
});

test('same day, same amount, different place: two payments', () => {
    const { m, p, bank } = setup();
    applyMoney(m, p, ev('c1', 9, '10-27', { moves: [{ account: '1111', amount: -4.5, who: 'Café Blau' }] }), opts());
    applyMoney(m, p, ev('c2', 11, '10-27', { moves: [{ account: '1111', amount: -4.5, who: 'Bäckerei Ott' }] }), opts());
    assert.equal(bank(), 991);
});

test('same day, same café, same amount: one, unless the model says it is a second coffee', () => {
    const { m, p, bank } = setup();
    applyMoney(m, p, ev('c1', 9, '10-27', { moves: [{ account: '1111', amount: -4.5, who: 'Café Blau' }] }), opts());
    applyMoney(m, p, ev('c2', 11, '10-27', { moves: [{ account: '1111', amount: -4.5, who: 'Café Blau' }] }), opts());
    assert.equal(bank(), 995.5);
    applyMoney(m, p, ev('c3', 12, '10-27', { moves: [{ account: '1111', amount: -4.5, who: 'Café Blau', occurrence: 'new' }] }), opts());
    assert.equal(bank(), 991);
});

test('"new" from another message goes in beside a same-day twin; "again" or nothing does not', () => {
    const { m, p, bank } = setup();
    applyMoney(m, p, ev('c1', 9, '10-27', { moves: [{ account: '1111', amount: -4.5, who: 'Café Blau', occurrence: 'new' }] }), opts());
    applyMoney(m, p, ev('c2', 11, '10-27', { moves: [{ account: '1111', amount: -4.5, who: 'Café Blau', occurrence: 'new' }] }), opts());
    assert.equal(bank(), 991);
    applyMoney(m, p, ev('c3', 14, '10-27', { moves: [{ account: '1111', amount: -4.5, who: 'Café Blau', occurrence: 'again' }] }), opts());
    applyMoney(m, p, ev('c4', 15, '10-27', { moves: [{ account: '1111', amount: -4.5, who: 'Café Blau' }] }), opts());
    assert.equal(bank(), 991);
});

test('the same payment twice in one message is one, even marked "new"', () => {
    const { m, p, bank } = setup();
    applyMoney(m, p, ev('c1', 9, '10-27', { moves: [{ account: '1111', amount: -4.5, who: 'Café Blau', occurrence: 'new' }] }), opts());
    applyMoney(m, p, ev('c1b', 9, '10-27', { moves: [{ account: '1111', amount: -4.5, who: 'Café Blau', occurrence: 'new' }] }), opts());
    assert.equal(bank(), 995.5);
});

test('"again" with nothing on record moves nothing (money from before the phone)', () => {
    const { m, p, bank } = setup();
    const r = applyMoney(m, p, ev('old', 9, '10-20', { moves: [{ account: '1111', amount: -60, who: 'Mara', occurrence: 'again' }] }), opts());
    assert.equal(bank(), 1000);
    assert.equal(r.legs[0].state, 'again');
});

test('a missing word on a payment with no twin still goes in', () => {
    const { m, p, bank } = setup();
    applyMoney(m, p, ev('rent', 9, '10-27', { moves: [{ account: '1111', amount: -700, who: 'Vermieter' }] }), opts());
    assert.equal(bank(), 300);
});

// when the model's word is wrong or missing: what happens, as it stands
test('mislabels: a real second coffee called "again" or left blank is missed; a mention called "again" is not paid', () => {
    const real = (word) => { const { m, p, bank } = setup();
        applyMoney(m, p, ev('c1', 9, '10-27', { moves: [{ account: '1111', amount: -4.5, who: 'Café Blau', occurrence: 'new' }] }), opts());
        applyMoney(m, p, ev('c2', 12, '10-27', { moves: [{ account: '1111', amount: -4.5, who: 'Café Blau', ...(word ? { occurrence: word } : {}) }] }), opts());
        return bank(); };
    assert.equal(real('new'), 991);
    assert.equal(real('again'), 995.5); // missed: the model's word decides
    assert.equal(real(''), 995.5);      // missed: blank is taken as the same payment
    const { m, p, bank } = setup();
    applyMoney(m, p, ev('c1', 9, '10-27', { moves: [{ account: '1111', amount: -4.5, who: 'Café Blau', occurrence: 'new' }] }), opts());
    applyMoney(m, p, ev('recall', 16, '10-27', { moves: [{ account: '1111', amount: -4.5, who: 'Café Blau', occurrence: 'again' }] }), opts());
    assert.equal(bank(), 995.5);
});

test('mislabel: a mention called "new" from another message is paid twice, and the result says so', () => {
    const { m, p, bank } = setup();
    applyMoney(m, p, ev('c1', 9, '10-27', { moves: [{ account: '1111', amount: -4.5, who: 'Café Blau', occurrence: 'new' }] }), opts());
    const r = applyMoney(m, p, ev('recall', 16, '10-27', { moves: [{ account: '1111', amount: -4.5, who: 'Café Blau', occurrence: 'new' }] }), opts());
    assert.equal(bank(), 991);
    assert.ok(r.notes.some(n => n.includes('하나 더')));
});

test('a retry re-reading the neighbours of a payment that already went in does not pay it again, even marked "new"', () => {
    const { m, p, bank } = setup();
    applyMoney(m, p, ev('coffee', 1, '10-27', { moves: [{ account: '1111', amount: -4.5, who: 'Café Blau', occurrence: 'new' }] }), opts());
    applyMoney(m, p, ev('coffee-again', 2, '10-27', { moves: [{ account: '1111', amount: -4.5, who: 'Café Blau', occurrence: 'new' }] }), opts({ span: [1, 4] }));
    assert.equal(bank(), 995.5);
});

test('the model pointing at a guessed record with the real amount corrects it', () => {
    const { m, p, bank } = setup();
    applyMoney(m, p, ev('hair', 51, '10-30', { amountFrom: 'guess', moves: [{ account: '1111', amount: -25, who: 'Friseur', occurrence: 'new' }] }), opts());
    const rec = p.money.tx[0].id;
    applyMoney(m, p, ev('hair-bill', 52, '10-30', { amountFrom: 'story', moves: [{ account: '1111', amount: -38, who: 'Friseur', occurrence: 'again', already: rec }] }), opts());
    assert.equal(bank(), 962);
    assert.equal(p.money.tx.length, 1);
    assert.equal(p.money.tx[0].amountFrom, undefined);
});

test('an order cancelled right away is not charged; a charge and its refund in the same event both stay out', () => {
    const { m, p } = setup();
    applyMoney(m, p, ev('tumbler', 31, '10-29', { moves: [{ account: '2222', amount: -18, who: 'Shop', occurrence: 'new' }], orders: [{ shop: 'Shop', item: 'Tumbler', qty: 1, price: 18, status: 'cancelled', occurrence: 'new' }] }), opts());
    migrateBank(m, p);
    assert.equal(p.money.tx.length, 0);
    assert.equal(p.money.orders[0].status, 'cancelled');
    applyMoney(m, p, ev('mug', 33, '10-29', { moves: [{ account: '2222', amount: -12, who: 'Shop', occurrence: 'new' }, { account: '2222', amount: 12, who: 'Shop', occurrence: 'new' }], orders: [{ shop: 'Shop', item: 'Mug', qty: 1, price: 12, status: 'cancelled', occurrence: 'new' }] }), opts());
    assert.equal(p.money.tx.length, 0);
});

test('own accounts: what leaves must be what arrives (−100 / +80 is refused); a single transfer out is fine', () => {
    const { m, p, bank } = setup();
    assert.throws(() => applyMoney(m, p, ev('odd', 9, '10-27', { moves: [{ account: '1111', amount: -100, kind: 'transfer' }, { account: 'broker:EUR', amount: 80 }] }), opts()), /달라요/);
    applyMoney(m, p, ev('rent', 10, '10-27', { moves: [{ account: '1111', amount: -100, kind: 'transfer', who: 'Vermieter' }] }), opts());
    assert.equal(bank(), 900);
});

test('a new order with no payment goes in, and says so', () => {
    const { m, p, bank } = setup();
    const r = applyMoney(m, p, ev('book', 9, '10-27', { orders: [{ shop: 'Thalia', item: 'Roman', qty: 1, price: 100, status: 'ordered', occurrence: 'new' }] }), opts());
    assert.equal(p.money.orders.length, 1);
    assert.equal(bank(), 1000);
    assert.ok(r.notes.some(n => n.includes('결제가 없었어요')));
});

test('a transfer pair is checked on its own: other spending in the event and a stated fee are fine', () => {
    const { m, p, bank, broker } = setup();
    applyMoney(m, p, ev('mix', 9, '10-27', { moves: [{ account: '1111', amount: -100, kind: 'transfer' }, { account: 'broker:EUR', amount: 100 }, { account: '1111', amount: -30, kind: 'transfer', who: 'Dohyeon' }] }), opts());
    assert.equal(bank(), 870); assert.equal(broker(), 1100);
    applyMoney(m, p, ev('fee', 10, '10-28', { moves: [{ account: '1111', amount: -101, kind: 'transfer', fee: 1 }, { account: 'broker:EUR', amount: 100 }] }), opts());
    assert.equal(bank(), 769); assert.equal(broker(), 1200);
});

test('a gift or cash-on-delivery order is not reported as a missing payment', () => {
    const { m, p } = setup();
    const r = applyMoney(m, p, ev('gift', 9, '10-27', { orders: [{ shop: 'Thalia', item: 'Atlas', qty: 1, price: 40, status: 'ordered', gift: 'Mara', occurrence: 'new' }, { shop: 'Otto', item: 'Lampe', qty: 1, price: 60, status: 'ordered', paid: false, occurrence: 'new' }] }), opts());
    assert.equal(p.money.orders.length, 2);
    assert.ok(!r.notes.some(n => n.includes('결제가 없었어요')));
});

test('a transfer fee: amount is what is sent, the fee comes on top (an amount with the fee already in it also works)', () => {
    const a = setup();
    applyMoney(a.m, a.p, ev('fee1', 23, '10-29', { moves: [{ account: '1111', amount: -300, fee: 5, kind: 'transfer' }, { account: 'broker:EUR', amount: 300 }] }), opts());
    assert.equal(a.bank(), 695); assert.equal(a.broker(), 1300);
    const b = setup();
    applyMoney(b.m, b.p, ev('fee2', 23, '10-29', { moves: [{ account: '1111', amount: -305, fee: 5, kind: 'transfer' }, { account: 'broker:EUR', amount: 300 }] }), opts());
    assert.equal(b.bank(), 695);
    const c = setup();
    applyMoney(c.m, c.p, ev('fee3', 24, '10-29', { moves: [{ account: '1111', amount: -30, fee: 1, kind: 'transfer', who: 'Dohyeon' }] }), opts());
    assert.equal(c.bank(), 969);
});

test('a message the user edited: its stated amount is corrected on the same record', () => {
    const { m, p, bank } = setup();
    const first = applyMoney(m, p, ev('coffee', 19, '10-28', { amountFrom: 'story', moves: [{ account: '1111', amount: -3, who: 'Café', occurrence: 'new' }] }), opts());
    const r = applyMoney(m, p, ev('coffee', 19, '10-28', { amountFrom: 'story', moves: [{ account: '1111', amount: -4.5, who: 'Café', occurrence: 'new' }] }), opts({ legs: first.legs, edited: true }));
    assert.equal(bank(), 995.5);
    assert.equal(p.money.tx.length, 1);
    assert.ok(r.notes.some(n => n.includes('고친 대화')));
});

test('a gift order with no name is kept as a gift', () => {
    const { m, p } = setup();
    applyMoney(m, p, ev('present', 9, '10-27', { orders: [{ shop: 'Kakao', item: 'Kuchen', qty: 1, price: 20, status: 'ordered', gift: true, paid: false, occurrence: 'new' }] }), opts());
    assert.equal(p.money.orders[0].gift, '선물');
});

test('되돌리기 leaves what changed since and says so; what is already gone is fine', () => {
    const { m, p, bank } = setup();
    const r = applyMoney(m, p, ev('two', 9, '10-27', { moves: [{ account: '1111', amount: -10, who: 'A' }, { account: '1111', amount: -20, who: 'B' }], orders: [{ shop: 'S', item: 'Lamp', qty: 1, price: 5, status: 'ordered' }] }), opts());
    p.money.tx = p.money.tx.filter(t => t.who !== 'A');                       // the user deleted one by hand
    m.finance.accounts['chk:EUR'].entries[r.legs[1].rec].amount = -25;        // and another changed since
    const left = revertEffects(m, p, r.effects);
    assert.equal(left.length, 1);
    assert.equal(p.money.orders.length, 0);
    assert.equal(bank(), 975);
});

test('되돌리기 keeps a card purchase whose amount the user changed (no ledger line to tell it by)', () => {
    const { m, p } = setup();
    const r = applyMoney(m, p, ev('flowers', 9, '10-27', { moves: [{ account: '2222', amount: -30, who: 'Blumen' }, { account: '2222', amount: -6, who: 'Apotheke' }] }), opts());
    p.money.tx = p.money.tx.filter(t => t.who !== 'Apotheke');
    p.money.tx[0].amount = -35;
    const left = revertEffects(m, p, r.effects);
    assert.equal(left.length, 1);
    assert.deepEqual(p.money.tx.map(t => t.amount), [-35]);
});

test('a payment from a deleted message, taken up again by a new one, now names the new message', () => {
    const { m, p } = setup();
    applyMoney(m, p, ev('book', 23, '10-28', { moves: [{ account: '1111', amount: -15, who: 'Kyobo', occurrence: 'new' }] }), opts());
    p.money.tx[0].sourceIndex = null;
    applyMoney(m, p, ev('book', 24, '10-28', { moves: [{ account: '1111', amount: -15, who: 'Kyobo', occurrence: 'again', already: p.money.tx[0].id }] }), opts());
    assert.equal(p.money.tx.length, 1);
    assert.equal(p.money.tx[0].sourceIndex, 24);
});

test('line by line: amounts in words with commas, an account by its name, a currency in words, a zero move, a trade without currency, a pass date with its month name', async () => {
    const { m, p, bank, broker } = setup();
    p.money.passes = [];
    applyMoney(m, p, ev('dinner', 5, '10-26', { moves: [{ account: 'Giro', amount: '-1,250.50', currency: '원', who: 'Trattoria' }, { account: 'Karte', amount: '−80', kind: 'card', who: 'Bar' }, { account: '1111', amount: 0, who: 'free' }],
        trades: [{ kind: 'buy', symbol: 'XETRA:SAP', quantity: '2', price: '180,00', occurrence: 'new' }], passes: [{ kind: 'hotel', by: 'Haus am See', date: 'Oct 30', time: '15:00' }] }), opts());
    migrateBank(m, p);
    assert.equal(bank(), 1000 - 1250.5);
    assert.equal(p.money.tx.find(t => t.who === 'Bar').account, '2222');
    assert.equal(p.money.tx.find(t => t.who === 'Bar').amount, -80);
    assert.ok(!p.money.tx.some(t => t.who === 'free'));
    assert.equal(p.investment.trades.at(-1).currency, 'EUR');
    assert.equal(broker(), 1000 - 360);
    assert.equal(p.money.passes[0].date, '10-30');
    const { when } = await import('../src/phoneparse.js');
    assert.deepEqual(['1월 20일 15:00', 'January 20, 2027', '20. Januar', 'the 3 cats'].map(when), ['01-20 15:00', '01-20', '01-20', '']);
});

test('the card\'s month leaves out the same month a year ago', () => {
    const { m, p } = setup();
    p.now = '10-26 12:00'; p.year = 2027;
    p.money.tx.push({ id: 'old', account: '2222', who: 'Old', amount: -50, time: '10-05 10:00', day: '2026-10-05', kind: 'card' }, { id: 'new', account: '2222', who: 'New', amount: -20, time: '10-06 10:00', day: '2027-10-06', kind: 'card' });
    migrateBank(m, p);
    assert.equal(p.money.bank.accounts[1].spent, 20);
});

test('paying the card off through a reflection is a transfer onto the card, not a refund: the month\'s spending stays', () => {
    const { m, p, bank } = setup();
    applyMoney(m, p, ev('dinner', 5, '10-20', { moves: [{ account: '2222', amount: -80, who: 'Trattoria', kind: 'card' }] }), opts());
    applyMoney(m, p, ev('payoff', 6, '10-25', { moves: [{ account: '1111', amount: -80, who: 'Karte', kind: 'transfer' }, { account: '2222', amount: 80, who: 'Giro', kind: 'transfer' }] }), opts());
    migrateBank(m, p);
    assert.equal(bank(), 920);
    assert.equal(p.money.tx.find(t => t.account === '2222' && t.amount > 0).kind, 'transfer');
    assert.equal(p.money.bank.accounts[1].spent, 80);
    // a refund stays a card row and does lower it
    applyMoney(m, p, ev('refund', 7, '10-26', { moves: [{ account: '2222', amount: 30, who: 'Trattoria', kind: 'card' }] }), opts());
    migrateBank(m, p);
    assert.equal(p.money.bank.accounts[1].spent, 50);
});

test('a pass told again with its status ("used", "checked in") takes it; the same words again change nothing', () => {
    const { m, p } = setup();
    const pass = status => ({ kind: 'flight', by: 'Lufthansa', from: 'FRA', to: 'BER', date: '12-28', time: '08:00', no: 'LH123', ...(status ? { status } : {}) });
    applyMoney(m, p, ev('flight', 5, '12-22', { passes: [pass()] }), opts());
    assert.equal(p.money.passes.length, 1);
    const r = applyMoney(m, p, ev('flight', 7, '12-28', { passes: [pass('used')] }), opts());
    assert.equal(p.money.passes[0].status, 'used');
    assert.equal(r.effects.filter(x => x.type === 'status').length, 1);
    const r2 = applyMoney(m, p, ev('flight', 8, '12-28', { passes: [pass('used')] }), opts());
    assert.equal(r2.effects.length, 0);
    revertEffects(m, p, r.effects);
    assert.equal(p.money.passes[0].status, '');
});

test('an event told again with another payment on the same account (a refund, a second shop) gets it; a retold payment to the same payee still keeps its first amount', () => {
    const { m, p } = setup();
    const r1 = applyMoney(m, p, ev('night', 5, '10-26', { moves: [{ account: '2222', amount: -80, who: 'Trattoria', occurrence: 'new' }] }), opts());
    const r2 = applyMoney(m, p, ev('night', 7, '10-27', { moves: [{ account: '2222', amount: 30, who: 'Trattoria', occurrence: 'new' }, { account: '2222', amount: -12, who: 'Taxi', occurrence: 'new' }] }), opts({ legs: r1.legs }));
    assert.deepEqual(p.money.tx.map(t => t.amount), [-80, 30, -12]);
    const r3 = applyMoney(m, p, ev('night', 8, '10-27', { moves: [{ account: '2222', amount: -85, who: 'Trattoria', occurrence: 'again' }] }), opts({ legs: [...r1.legs, ...r2.legs] }));
    assert.equal(p.money.tx.length, 3);
    assert.ok(r3.notes.some(n => n.includes('그대로')));
});

test('a reflection opens an account and a card, fills and empties the basket, and gives the investment app a watched share, a story price and a stake', () => {
    const { m, p } = setup();
    p.investment.watch = []; p.investment.stakes = []; p.money.cards = []; p.delivery = { shops: [], orders: [], cart: null, look: 'baemin' };
    const o = opts({ marks: { base: { index: 0 }, money: { index: 0 }, invest: { index: 0 }, delivery: { index: 0 } } });
    const r1 = applyMoney(m, p, ev('savings', 5, '10-26', { newAccount: { kind: 'savings', name: 'Sparen', last4: '3333', currency: 'EUR', balance: 500 }, newCard: { account: '3333', exp: '09/29' },
        cart: { shop: 'Pasta Nostra', items: [{ name: 'Ragù', qty: 2, price: 12 }] },
        watch: [{ symbol: 'XETRA:BMW', name: 'BMW', currency: 'EUR', note: 'Ivo가 추천' }], quotes: [{ symbol: 'XETRA:SAP', date: '2026-10-26', value: 150, evidence: 'SAP fell to 150' }],
        stakes: [{ company: 'Varo Holding', percent: 10, holder: 'Ren', currency: 'EUR', evidence: 'the ten percent are yours now' }] }), o);
    migrateBank(m, p);
    assert.equal(p.money.bank.accounts.length, 3); assert.equal(p.money.bank.accounts[2].last4, '3333'); assert.equal(cash(m.finance.accounts[`${p.money.bank.accounts[2].id}:EUR`]), 500);
    assert.equal(p.money.cards.length, 1); assert.equal(p.delivery.cart.items[0].qty, 2);
    assert.equal(p.investment.watch[0].symbol, 'XETRA:BMW'); assert.equal(p.investment.securities.length, 2);
    assert.equal(m.finance.prices['STOCK:XETRA:SAP']['2026-10-26'].rows[0].source, 'story');
    assert.equal(p.investment.stakes[0].company, 'Varo Holding');
    // the order from that shop empties the basket
    applyMoney(m, p, ev('pasta', 6, '10-26', { deliveries: [{ shop: 'Pasta Nostra', items: [{ name: 'Ragù', qty: 2, price: 12 }], fee: 2, status: 'delivered', occurrence: 'new' }] }), o);
    assert.equal(p.delivery.cart, null);
    // 되돌리기 of the first round takes the account, card, watch and stake back out
    revertEffects(m, p, r1.effects);
    assert.equal(p.money.bank.accounts.length, 2); assert.equal(p.money.cards.length, 0); assert.equal(p.investment.watch.length, 0); assert.equal(p.investment.stakes.length, 0);
});

test('a payment in another currency is booked in the account\'s at the day\'s rate, its memo keeping the original; an order without an eta gets one', async () => {
    const { addPrice } = await import('../src/finance.js');
    const { m, p, bank } = setup();
    addPrice(m, 'FX:USD/EUR', '2026-10-26', { value: 0.9, source: 'guess' });
    applyMoney(m, p, ev('nyc', 5, '10-26', { moves: [{ account: '1111', amount: -100, currency: 'USD', who: 'Deli' }], orders: [{ shop: 'Amazon', item: 'Kabel', qty: 1, price: 12 }] }), opts());
    migrateBank(m, p);
    assert.equal(bank(), 910);
    assert.equal(p.money.tx[0].amount, -90); assert.match(p.money.tx[0].memo, /USD 100/);
    assert.match(p.money.orders[0].eta, /^10-(28|29|30)$/);
    assert.throws(() => applyMoney(m, p, ev('tokyo', 6, '10-26', { moves: [{ account: '1111', amount: -5000, currency: 'JPY', who: 'Konbini' }] }), opts()), /환율/);
});

test('run34B: an account opened with money moved into it in the same event: the move lands on it, no second opening deposit', () => {
    const { m, p, bank } = setup();
    applyMoney(m, p, ev('savings', 5, '10-26', { moves: [{ account: '1111', amount: -300, who: 'Sparplan', kind: 'transfer', occurrence: 'new' }, { account: '4455', amount: 300, who: 'Giro', kind: 'transfer', occurrence: 'new' }],
        newAccount: { kind: 'savings', name: 'Sparplan', last4: '4455', currency: 'EUR', balance: 300 } }), opts());
    migrateBank(m, p);
    assert.equal(bank(), 700);
    assert.equal(cash(m.finance.accounts[`${p.money.bank.accounts.find(a => a.last4 === '4455').id}:EUR`]), 300);
    assert.equal(p.money.tx.filter(t => t.account === '1111' && t.amount > 0).length, 0);
    assert.equal(p.money.tx.filter(t => t.memo === '개설 입금').length, 0);
    // opened with money and no move: the opening deposit is the whole balance
    const b = setup();
    applyMoney(b.m, b.p, ev('open', 5, '10-26', { newAccount: { kind: 'savings', name: 'Tagesgeld', last4: '7788', currency: 'EUR', balance: 500 } }), opts());
    migrateBank(b.m, b.p);
    assert.equal(b.p.money.tx.find(t => t.memo === '개설 입금').amount, 500);
    assert.equal(b.bank(), 1000);
});
