import test from 'node:test';
import assert from 'node:assert/strict';
import { applyMoney, moneyNow, PASS_OVER, replayEffects, revertEffects } from '../src/phonesyncmoney.js';
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
    // (점검 9: the arrival day is the model's; none given, none: the code makes up nothing)
    assert.equal(p.money.orders[0].eta, '');
    // (점검 7: no rate at all — that payment left out with a note, the event's other money in; a rate of an earlier day — that
    // one, its day in the memo)
    const r = applyMoney(m, p, ev('tokyo', 6, '10-26', { moves: [{ account: '1111', amount: -5000, currency: 'JPY', who: 'Konbini' }, { account: '1111', amount: -10, who: 'Cafe' }] }), opts());
    migrateBank(m, p);
    assert.equal(bank(), 900);
    assert.ok(r.notes.some(x => /JPY.*환율/.test(x)), JSON.stringify(r.notes));
    // (점검 8: a rate of another day is never taken; the one the model gave with the payment is that day's, and goes back with it)
    addPrice(m, 'FX:GBP/EUR', '2026-10-20', { value: 1.2, source: 'guess' });
    const r2 = applyMoney(m, p, ev('ldn', 7, '10-26', { moves: [{ account: '1111', amount: -10, currency: 'GBP', who: 'Pret' }] }), opts());
    migrateBank(m, p);
    assert.equal(bank(), 900);
    assert.ok(r2.notes.some(x => /GBP.*환율/.test(x)));
    const r3 = applyMoney(m, p, ev('ldn2', 8, '10-26', { moves: [{ account: '1111', amount: -10, currency: 'GBP', rate: 1.17, who: 'Pret' }] }), opts());
    migrateBank(m, p);
    assert.equal(bank(), 888.3);
    assert.match(p.money.tx.at(-1).memo, /GBP 10/);
    revertEffects(m, p, r3.effects);
    assert.equal(m.finance.prices['FX:GBP/EUR']?.['2026-10-26'], undefined);
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

test('run36: two orders of the same item in one answer (two scarves, two colours) are two orders; a different option is another order later too', () => {
    const { m, p } = setup();
    p.money.orders = [];
    applyMoney(m, p, ev('scarves', 5, '10-26', { moves: [{ account: '2222', amount: -2850, who: 'Hermès', kind: 'card', occurrence: 'new' }],
        orders: [{ shop: 'Hermès', item: 'Seidentuch', option: 'Bordeaux', qty: 1, price: 950, occurrence: 'new' }, { shop: 'Hermès', item: 'Seidentuch', option: 'Camel', qty: 1, price: 950, occurrence: 'new' }] }), opts());
    assert.deepEqual(p.money.orders.map(o => o.option), ['Bordeaux', 'Camel']);
    // told again from a later message: still the same two, not four
    applyMoney(m, p, ev('scarves-2', 7, '10-26', { orders: [{ shop: 'Hermès', item: 'Seidentuch', option: 'Camel', qty: 1, price: 950, status: 'shipped', occurrence: 'again' }] }), opts());
    assert.equal(p.money.orders.length, 2);
    assert.equal(p.money.orders[1].status, 'shipped');
});

// (점검 8: which record a mention is, the model says by its id from MONEY NOW, "already"; the code never decides by names)
const idOf = (p, path, i = 0) => p.money[path][i].id;

test('점검 8 (돈): an order made before, first told of now, goes in once with no payment; told of again, the one the model points at moves on and gets what it tells (shop, price, option, who for, the real arrival day)', () => {
    const { m, p, bank } = setup();
    const scarf = { shop: '', item: 'Pale grey cashmere scarf', ko: '연회색 캐시미어 스카프', qty: 1, price: null, status: 'ordered', occurrence: 'again' };
    const r = applyMoney(m, p, ev('scarf', 7, '11-07', { orders: [scarf] }), opts());
    assert.deepEqual([p.money.orders.length, p.money.orders[0].shop, p.money.orders[0].price, p.money.orders[0].told, p.money.orders[0].etaGuess], [1, '', null, true, undefined]);
    assert.ok(!r.notes.some(n => /결제가 없었어요/.test(n)));
    assert.equal(bank(), 1000);
    const r2 = applyMoney(m, p, ev('scarf-2', 12, '11-10', { orders: [{ ...scarf, already: idOf(p, 'orders'), shop: 'Lounge Boutique', price: 89, option: 'grey', gift: 'Mara', eta: '11-12', status: 'shipped' }] }), opts());
    assert.equal(p.money.orders.length, 1);
    assert.deepEqual(['shop', 'price', 'option', 'gift', 'eta', 'status', 'etaGuess'].map(k => p.money.orders[0][k]), ['Lounge Boutique', 89, 'grey', 'Mara', '11-12', 'shipped', undefined]);
    // 되돌리기 both rounds: nothing left; replay puts it all again
    revertEffects(m, p, r2.effects);
    assert.deepEqual([p.money.orders[0].shop, p.money.orders[0].price, p.money.orders[0].status], ['', null, 'ordered']);
    revertEffects(m, p, r.effects);
    assert.equal(p.money.orders.length, 0);
    // (점검 9) without the model's id: one the story told of before is the one its names are; one the story first tells of
    // here ("refersBack": false) is its own, whatever its name
    applyMoney(m, p, ev('scarf', 7, '11-07', { orders: [scarf] }), opts());
    applyMoney(m, p, ev('scarf-3', 14, '11-12', { orders: [{ ...scarf, shop: 'Lounge Boutique', status: 'shipped', refersBack: true }] }), opts());
    assert.deepEqual(p.money.orders.map(o => [o.shop, o.status]), [['Lounge Boutique', 'shipped']]);
    applyMoney(m, p, ev('scarf-4', 15, '11-13', { orders: [{ ...scarf, refersBack: false }] }), opts());
    assert.equal(p.money.orders.length, 2);
    // a payment told of again moves nothing, as before
    applyMoney(m, p, ev('rent-told', 13, '11-10', { moves: [{ account: '1111', amount: -500, who: 'Landlord', occurrence: 'again' }] }), opts());
    assert.equal(bank(), 1000);
});

test('점검 8 (돈): a ticket\'s made-up details are shown, never proof of another ticket; the story\'s replace them, a made-up one never replaces the story\'s; a ticket with no seller is kept by its name', () => {
    let { m, p, bank } = setup();
    // booked with a number and a way-back day made up to fit
    applyMoney(m, p, ev('a', 5, '10-20', { passes: [{ kind: 'flight', by: 'Korean Air', from: 'ICN', to: 'NRT', date: '11-09', no: 'KE1234', seat: '32A', made: ['no', 'seat'], occurrence: 'new' },
        { kind: 'flight', by: 'Korean Air', from: 'NRT', to: 'ICN', date: '11-14', no: 'KE1235', made: ['no', 'date'], occurrence: 'new' }] }), opts());
    assert.deepEqual(p.money.passes.map(x => x.made), [['no', 'seat'], ['no', 'date']]);
    // told of again with the story's number and day for the way back: that one, the story's values, no longer made
    const back = idOf(p, 'passes', 1);
    const r = applyMoney(m, p, ev('b', 9, '10-24', { passes: [{ kind: 'flight', by: 'Korean Air', from: 'NRT', to: 'ICN', date: '11-15', no: 'KE706', occurrence: 'again', already: back }] }), opts());
    assert.deepEqual([p.money.passes[1].no, p.money.passes[1].date, p.money.passes[1].made], ['KE706', '11-15', undefined]);
    // a later mention with a number made up again never writes over the story's
    applyMoney(m, p, ev('c', 10, '10-25', { passes: [{ kind: 'flight', by: 'Korean Air', from: 'NRT', to: 'ICN', no: 'KE9999', made: ['no'], status: 'checked in', occurrence: 'again', already: back }] }), opts());
    assert.deepEqual([p.money.passes[1].no, p.money.passes[1].status], ['KE706', 'checked in']);
    // 되돌리기 of the round that gave the story's values: the made-up ones back
    revertEffects(m, p, r.effects);
    assert.deepEqual([p.money.passes[1].no, p.money.passes[1].date, p.money.passes[1].made], ['KE1235', '11-14', ['no', 'date']]);
    // a show ticket with no seller, beside a payment: kept by its name, the payment in
    ({ m, p, bank } = setup());
    applyMoney(m, p, ev('d', 5, '10-26', { moves: [{ account: '1111', amount: -120, who: 'Interpark', occurrence: 'new' }], passes: [{ kind: 'event', by: '', to: 'IU 콘서트', date: '11-30', occurrence: 'new' }] }), opts());
    migrateBank(m, p);
    assert.equal(bank(), 880);
    assert.deepEqual(p.money.passes.map(x => [x.by, x.to]), [['', 'IU 콘서트']]);
    // one with nothing to know it by: the one of its kind still open when there is just one (the show ticket), else a note;
    // the other money stays
    const res = applyMoney(m, p, ev('e', 6, '10-26', { moves: [{ account: '1111', amount: -18, who: 'Cafe', occurrence: 'new' }], passes: [{ kind: 'event', by: '', to: '', status: 'used', occurrence: 'again' }], orders: [{ shop: '', item: '', occurrence: 'again' }] }), opts());
    migrateBank(m, p);
    assert.equal(bank(), 862);
    assert.deepEqual([p.money.passes.length, p.money.passes[0].status, p.money.orders.length], [1, 'used', 0]);
    assert.ok(res.notes.length >= 1);
});

test('점검 8 (돈): a ticket told of again with no day the story gives keeps the day it was told on, marked, and the model is told so; "non-refundable" is no used ticket; MONEY NOW lists every ticket and order still to come', () => {
    const { m, p } = setup();
    applyMoney(m, p, ev('a', 5, '10-20', { passes: [{ kind: 'flight', by: 'Korean Air', from: 'FRA', to: 'ICN', no: '', occurrence: 'again' }] }), opts());
    assert.deepEqual([p.money.passes[0].date, p.money.passes[0].dayUnknown], ['10-20', true]);
    assert.deepEqual(moneyNow(p).passes.map(x => [x.from, x.to, x.dayUnknown]), [['FRA', 'ICN', true]]);
    applyMoney(m, p, ev('b', 9, '10-26', { passes: [{ kind: 'flight', by: 'Korean Air', from: 'FRA', to: 'ICN', date: '11-02', no: 'KE906', occurrence: 'again', already: idOf(p, 'passes') }] }), opts());
    assert.deepEqual(p.money.passes.map(x => [x.date, x.no, x.dayUnknown]), [['11-02', 'KE906', undefined]]);
    for (const s of ['환불 불가', 'non-refundable', '취소 가능', 'free cancellation']) assert.equal(PASS_OVER(s), false, s);
    for (const s of ['used', '취소됨', 'refunded', '사용 완료']) assert.equal(PASS_OVER(s), true, s);
    // twelve used tickets after one still to come: that one is still in MONEY NOW for the model to point at
    for (let i = 0; i < 12; i++) applyMoney(m, p, ev(`u${i}`, 20 + i, '10-27', { passes: [{ kind: 'event', by: 'CGV', to: `Film ${i}`, date: '10-27', status: 'used', occurrence: 'new' }] }), opts());
    assert.ok(moneyNow(p).passes.some(x => x.no === 'KE906'));
});

// (점검 9: the town table's ids, as phonedata cityIds gives them)
const TOWN = { 인천: 'incheon', Incheon: 'incheon', 서울: 'seoul', Seoul: 'seoul', 도쿄: 'tokyo', Tokyo: 'tokyo', 부산: 'busan', Busan: 'busan' };
const placeCity = v => new Set(TOWN[String(v || '').trim()] ? [TOWN[String(v || '').trim()]] : []);

test('점검 9 (기록 맞추기): by its names in any language; two it may be, none changed; the way back is not the way out; an id that doesn\'t fit is passed over; one first told of here is its own', () => {
    const o = () => opts({ placeCity });
    let { m, p } = setup();
    applyMoney(m, p, ev('a', 5, '10-20', { passes: [{ kind: 'flight', names: ['대한항공', 'Korean Air'], from: 'ICN', to: 'NRT', date: '11-09', occurrence: 'new' }, { kind: 'flight', names: ['대한항공', 'Korean Air'], from: 'NRT', to: 'ICN', date: '11-14', made: ['date'], occurrence: 'new' }] }), o());
    // "my flight" with no route: either of the two; nothing changes, a note says why
    let r = applyMoney(m, p, ev('b', 9, '11-09', { passes: [{ kind: 'flight', names: ['Korean Air'], status: 'checked in', occurrence: 'again', refersBack: true }] }), o());
    assert.deepEqual(p.money.passes.map(x => x.status), ['', '']);
    assert.ok(r.notes.some(n => /어느 기록인지/.test(n)));
    // "the flight back from Tokyo": the way back by its route (도쿄 · Seoul by the town table, NRT by its code), never the way out
    applyMoney(m, p, ev('c', 10, '11-14', { passes: [{ kind: 'flight', names: ['Korean Air'], from: '도쿄', to: 'Seoul', status: 'checked in', occurrence: 'again', refersBack: true }] }), o());
    assert.deepEqual(p.money.passes.map(x => x.status), ['', 'checked in']);
    // two scarves, for Mara and for Lio: an id given for Mara's while the mention is Lio's is passed over; the one by its names
    // that fits is Lio's
    ({ m, p } = setup());
    applyMoney(m, p, ev('a', 5, '10-20', { orders: [{ names: ['Scarf', '스카프'], shop: 'Zalando', qty: 1, price: 40, gift: 'Mara', occurrence: 'new' }, { names: ['Scarf', '스카프'], shop: 'Zalando', qty: 1, price: 40, gift: 'Lio', occurrence: 'new' }] }), o());
    applyMoney(m, p, ev('b', 9, '10-24', { orders: [{ names: ['스카프'], gift: 'Lio', status: 'delivered', occurrence: 'again', refersBack: true, already: p.money.orders[0].id }] }), o());
    assert.deepEqual(p.money.orders.map(x => [x.gift, x.status]), [['Mara', 'ordered'], ['Lio', 'delivered']]);
    // "I booked one more place": its own, though a hotel is open
    ({ m, p } = setup());
    applyMoney(m, p, ev('a', 5, '10-20', { passes: [{ kind: 'hotel', names: ['롯데호텔 서울', 'Lotte Hotel Seoul'], to: 'Seoul', date: '11-02', occurrence: 'new' }] }), o());
    applyMoney(m, p, ev('b', 9, '10-24', { passes: [{ kind: 'hotel', names: ['해운대 비즈니스호텔'], made: ['names', 'no'], no: 'H123', to: '', date: '11-05', occurrence: 'again', refersBack: false }] }), o());
    assert.equal(p.money.passes.length, 2);
    // "checked in at the hotel" with no name: two open, none picked; the made-up name is no proof either
    r = applyMoney(m, p, ev('c', 10, '11-02', { passes: [{ kind: 'hotel', names: ['그 호텔'], made: ['names'], status: 'checked in', occurrence: 'again', refersBack: true }] }), o());
    assert.deepEqual(p.money.passes.map(x => x.status), ['', '']);
    // its own names later: that one, its made-up name giving way to the story's
    applyMoney(m, p, ev('d', 11, '11-05', { passes: [{ kind: 'hotel', names: ['해운대 그랜드호텔', 'Haeundae Grand Hotel'], to: 'Busan', status: 'checked in', occurrence: 'again', refersBack: true, already: p.money.passes[1].id }] }), o());
    assert.deepEqual([p.money.passes[1].names, p.money.passes[1].status, p.money.passes[1].made], [['해운대 그랜드호텔', 'Haeundae Grand Hotel'], 'checked in', ['no']]);
});

test('점검 9 (결제 연결): a payment for one already paid is not paid again; one only told of, paid later, is paid once; a debt paid back shrinks to paid; an asset sold; an account blocked holds its money; 되돌리기 takes each back', () => {
    const o = () => opts({ placeCity });
    let { m, p, bank } = setup();
    applyMoney(m, p, ev('a', 5, '10-20', { moves: [{ account: '1111', amount: -40, who: 'Zalando', for: 'Scarf', occurrence: 'new' }], orders: [{ names: ['Scarf'], shop: 'Zalando', qty: 1, price: 40, occurrence: 'new' }] }), o());
    migrateBank(m, p);
    assert.equal(bank(), 960);
    assert.ok(p.money.orders[0].paidBy);
    // told of again, the model writing its payment as new once more: not paid twice
    let r = applyMoney(m, p, ev('b', 9, '10-24', { moves: [{ account: '1111', amount: -40, who: 'Zalando', for: 'Scarf', occurrence: 'new' }], orders: [{ names: ['Scarf'], status: 'shipped', occurrence: 'again', refersBack: true }] }), o());
    migrateBank(m, p);
    assert.deepEqual([bank(), p.money.orders.length, p.money.orders[0].status], [960, 1, 'shipped']);
    assert.ok(r.notes.some(n => /이미 결제된/.test(n)));
    // told of before it was paid ("I booked the concert"), paid later: paid once, no longer only told of
    applyMoney(m, p, ev('c', 10, '10-25', { passes: [{ kind: 'event', names: ['IU 콘서트', 'IU Concert'], date: '11-30', occurrence: 'again', refersBack: false }] }), o());
    applyMoney(m, p, ev('d', 11, '10-26', { moves: [{ account: '1111', amount: -120, who: 'Interpark', for: 'IU Concert', occurrence: 'new' }], passes: [{ kind: 'event', names: ['IU Concert'], occurrence: 'new', refersBack: true }] }), o());
    migrateBank(m, p);
    assert.deepEqual([bank(), p.money.passes.length, p.money.passes[0].told, !!p.money.passes[0].paidBy], [840, 1, undefined, true]);
    // a loan: in, paid back in two parts, paid; 되돌리기 of the last part puts it back
    ({ m, p, bank } = setup());
    applyMoney(m, p, ev('l', 5, '10-01', { moves: [{ account: '1111', amount: 500, who: 'Bank', kind: 'deposit', for: 'Student loan', occurrence: 'new' }], debts: [{ kind: 'loan', names: ['Student loan', '학자금 대출'], lender: 'KfW', amount: 500, amountFrom: 'story', occurrence: 'new' }] }), o());
    applyMoney(m, p, ev('l2', 6, '10-15', { moves: [{ account: '1111', amount: -200, who: 'KfW', kind: 'transfer', for: '학자금 대출', occurrence: 'new' }], debts: [{ names: ['학자금 대출'], occurrence: 'again', refersBack: true }] }), o());
    assert.deepEqual([p.money.debts[0].amount, p.money.debts[0].status], [300, 'open']);
    const last = applyMoney(m, p, ev('l3', 7, '10-30', { moves: [{ account: '1111', amount: -300, who: 'KfW', kind: 'transfer', for: 'Student loan', occurrence: 'new' }], debts: [{ names: ['Student loan'], occurrence: 'again', refersBack: true }] }), o());
    migrateBank(m, p);
    assert.deepEqual([bank(), p.money.debts[0].amount, p.money.debts[0].status], [1000, 0, 'paid']);
    revertEffects(m, p, last.effects);
    migrateBank(m, p);
    assert.deepEqual([bank(), p.money.debts[0].amount, p.money.debts[0].status], [1300, 300, 'open']);
    // a flat inherited, later sold
    ({ m, p, bank } = setup());
    applyMoney(m, p, ev('h', 5, '10-01', { assets: [{ kind: 'property', names: ['할머니 집', "Grandma's flat"], value: 300000, valueFrom: 'guess', whose: 'owner', status: 'held', occurrence: 'again', refersBack: false }] }), o());
    applyMoney(m, p, ev('h2', 6, '10-20', { moves: [{ account: '1111', amount: 310000, who: 'Buyer', kind: 'transfer', for: '할머니 집', occurrence: 'new' }], assets: [{ names: ['할머니 집'], value: 310000, status: 'sold', occurrence: 'new', refersBack: true }] }), o());
    migrateBank(m, p);
    assert.deepEqual([bank(), p.money.assets.length, p.money.assets[0].status, p.money.assets[0].value], [311000, 1, 'sold', 310000]);
    // an account blocked: marked, its money where it was; 되돌리기 frees it
    const b = applyMoney(m, p, ev('x', 7, '10-21', { access: [{ account: '1111', blocked: true, reason: '압류' }] }), o());
    migrateBank(m, p);
    assert.deepEqual([bank(), p.money.bank.accounts[0].blocked?.reason], [311000, '압류']);
    revertEffects(m, p, b.effects);
    assert.equal(p.money.bank.accounts[0].blocked, undefined);
    // MONEY NOW tells the model what is owned and owed, with ids
    assert.deepEqual(moneyNow(p).assets.map(x => [x.names[0], x.status]), [['할머니 집', 'sold']]);
});

test('점검 9-4 (records): the money step\'s one list goes in the lists the money engine reads, names only changed', async () => {
    const { recordsMoney } = await import('../src/phonesyncmoney.js');
    const mo = recordsMoney([
        { type: 'payment', at: 3, account: '1111', amount: -25, who: 'Blumen Koch' },
        { type: 'order', at: 3, names: ['Scarf'], amount: 30, sender: 'Mara' },
        { type: 'order', at: 3, names: ['Lamp'], amount: 40, payer: 'on delivery' },
        { type: 'asset', at: 3, kind: 'deposit', names: ['Trust'], amount: 50000, amountFrom: 'guess', status: 'blocked' },
        { type: 'quote', at: 3, symbol: 'XETRA:SAP', amount: 130, amountFrom: 'guess' },
        { type: 'quote', at: 3, symbol: 'XETRA:SAP', amount: 131, evidence: 'SAP hit 131' },
        { type: 'delivery', at: 3, shop: 'BBQ', items: [{ name: 'Chicken', qty: 1, price: 20 }], people: 2, date: '10-26', time: '19:30' },
        { type: 'card', at: 3, account: '2222', exp: '10/29' },
        { type: 'nothing', at: 3 }, null, 'text',
    ]);
    assert.equal(mo.moves[0].amount, -25);
    assert.deepEqual(mo.orders.map(o => [o.price, o.paid, 'amount' in o]), [[30, false, false], [40, false, false]]);
    assert.deepEqual([mo.assets[0].value, mo.assets[0].valueFrom, 'amount' in mo.assets[0]], [50000, 'guess', false]);
    assert.deepEqual(mo.quotes.map(q => [q.value, q.source]), [[130, 'guess'], [131, 'story']]);
    assert.deepEqual([mo.deliveries[0].for, mo.deliveries[0].time], [2, '10-26 19:30']);
    assert.equal(mo.newCard.exp, '10/29');
    // (a day with its year: one full day; without, the day alone)
    const yr = recordsMoney([{ type: 'asset', names: ['Trust'], date: '06-15', year: 2025 }, { type: 'asset', names: ['Car'], date: '03-02' }, { type: 'debt', names: ['Loan'], date: '01-10', year: '2024' }]);
    assert.deepEqual([yr.assets.map(a => a.since), yr.debts[0].since], [['2025-06-15', '03-02'], '2024-01-10']);
    // (a ticket takes only a ticket's status)
    assert.deepEqual(recordsMoney([{ type: 'ticket', by: 'Inn', status: 'delivered' }, { type: 'ticket', by: 'Inn', status: 'Used' }]).passes.map(x => x.status), ['', 'used']);
});

test('점검 9-4: a debt of the household is theirs; a ticket\'s last day and a membership; a parcel sent to the owner; a value the story says changed is the new one, a mention of it as it was keeps the story\'s', () => {
    const { m, p } = setup();
    applyMoney(m, p, ev('d', 5, '10-26', { debts: [{ kind: 'loan', names: ['Family loan'], lender: 'Bank', amount: 20000, amountFrom: 'story', whose: 'family', occurrence: 'new' }],
        passes: [{ kind: 'membership', by: 'Iron Gym', date: '10-26', until: '10-25', occurrence: 'new' }, { kind: 'hotel', by: 'Varo Inn', date: '10-30', until: '11-02', occurrence: 'new' }],
        orders: [{ names: ['Wool scarf'], shop: 'Varo Knits', price: 30, sender: 'Mara', payer: 'someone else', paid: false, status: 'shipped', occurrence: 'again', refersBack: false }] }), opts());
    const debt = p.money.debts[0];
    assert.deepEqual([debt.whose, debt.amount], ['family', 20000]);
    assert.deepEqual(p.money.passes.map(x => [x.kind, x.until]), [['membership', '10-25'], ['hotel', '11-02']]);
    const o = p.money.orders[0];
    assert.deepEqual([o.sender, o.payer, o.paid, o.told], ['Mara', 'someone else', false, true]);
    const now = moneyNow(p);
    assert.equal(now.debts[0].whose, 'family');
    assert.equal(now.passes[1].until, '11-02');
    assert.equal(now.orders[0].sender, 'Mara');
    // "the debt grew" (no figure): the model's new estimate is the debt now, though the old one was the story's
    applyMoney(m, p, ev('d2', 6, '10-27', { debts: [{ kind: 'loan', names: ['Family loan'], amount: 26000, amountFrom: 'guess', made: ['amount'], occurrence: 'new', refersBack: true, already: debt.id }] }), opts());
    assert.equal(debt.amount, 26000);
    // told of as it is, an estimate never takes the place of the story's
    applyMoney(m, p, ev('d3', 7, '10-28', { debts: [{ kind: 'loan', names: ['Family loan'], amount: 31000, amountFrom: 'guess', made: ['amount'], occurrence: 'again', refersBack: true, already: debt.id }] }), opts());
    assert.equal(debt.amount, 26000);
});

test('점검 9-4: money lent is owed to the owner and shrinks as it comes back, then settled; an asset blocked stays the owner\'s and is still shown', () => {
    const { m, p, bank } = setup();
    applyMoney(m, p, ev('lent', 5, '10-26', { moves: [{ account: '1111', amount: -50, who: 'Ivo', kind: 'transfer', occurrence: 'new', for: 'Loan to Ivo' }],
        assets: [{ kind: 'receivable', names: ['Loan to Ivo'], value: 50, valueFrom: 'story', occurrence: 'new', refersBack: false }, { kind: 'deposit', names: ['Trust fund'], value: 90000, status: 'blocked', whose: 'family', occurrence: 'again', refersBack: false }] }), opts());
    assert.equal(bank(), 950);
    const [loan, trust] = p.money.assets;
    assert.deepEqual([loan.kind, loan.value, trust.status, trust.whose], ['receivable', 50, 'blocked', 'family']);
    applyMoney(m, p, ev('back1', 6, '10-27', { moves: [{ account: '1111', amount: 20, who: 'Ivo', kind: 'deposit', occurrence: 'new', for: 'Loan to Ivo' }], assets: [{ kind: 'receivable', names: ['Loan to Ivo'], occurrence: 'new', refersBack: true, already: loan.id }] }), opts());
    assert.equal(loan.value, 30);
    applyMoney(m, p, ev('back2', 7, '10-28', { moves: [{ account: '1111', amount: 30, who: 'Ivo', kind: 'deposit', occurrence: 'new', for: 'Loan to Ivo' }], assets: [{ kind: 'receivable', names: ['Loan to Ivo'], status: 'held', occurrence: 'new', refersBack: true, already: loan.id }] }), opts());
    assert.deepEqual([loan.value, loan.status, bank()], [0, 'settled', 1000]);
    assert.ok(moneyNow(p).assets.some(x => x.id === trust.id && x.status === 'blocked'));
});

test('점검 9-4: account records: blocked, freed and closed; a card\'s bill day and the account paying it; a balance the story implies is one estimated row after the message\'s own payments; a new one opened; 되돌리기 takes each back', () => {
    const { m, p, bank } = setup();
    const r1 = applyMoney(m, p, ev('a', 5, '10-26', { moves: [{ account: '1111', amount: -30, who: 'Lunch', occurrence: 'new' }],
        accounts: [{ names: ['Giro'], last4: '1111', status: 'blocked', reason: 'fraud check', balance: 400, memo: 'a bad month', occurrence: 'new' },
            { names: ['Karte'], account: '2222', billDay: 15, paidFrom: '1111', occurrence: 'again' },
            { names: ['Nowhere'], occurrence: 'again' },
            { names: ['Tagesgeld'], kind: 'savings', last4: '3333', amount: 200, currency: 'EUR', occurrence: 'new' }] }), opts());
    const [giro, karte] = p.money.bank.accounts;
    assert.deepEqual([giro.blocked?.reason, karte.billDay, karte.paidFrom], ['fraud check', 15, '1111']);
    // 1000 − 30 = 970; the story says 400 now: one row of −570, marked estimated
    assert.equal(bank(), 400);
    const adj = p.money.tx.find(t => t.adjust);
    assert.deepEqual([adj.amount, adj.who, adj.amountFrom], [-570, 'a bad month', 'guess']);
    assert.ok(r1.notes.some(n => n.includes('어느 계좌인지 몰라서')));
    const sav = p.money.bank.accounts.find(a => a.last4 === '3333');
    assert.equal(cash(m.finance.accounts[`${sav.id}:EUR`]), 200);
    assert.deepEqual(moneyNow(p).accounts.slice(0, 2).map(a => [a.status, a.billDay]), [['blocked', undefined], [undefined, 15]]);
    // the same balance told again: nothing more
    applyMoney(m, p, ev('a2', 6, '10-27', { accounts: [{ last4: '1111', balance: 400, occurrence: 'again' }] }), opts());
    assert.equal(p.money.tx.filter(t => t.adjust).length, 1);
    applyMoney(m, p, ev('a3', 7, '10-28', { accounts: [{ last4: '1111', status: 'open', occurrence: 'new' }, { last4: '2222', balance: 5, occurrence: 'again' }] }), opts());
    assert.equal(giro.blocked, undefined);
    revertEffects(m, p, r1.effects);
    assert.deepEqual([karte.billDay, bank(), p.money.tx.some(t => t.adjust)], [undefined, 1000, false]);
});

test('점검 9-5 (정기): a regular income and bill are paid on their days from the message on, never back; a month paid by hand is left; stopped, none; a set-back clock pays nothing twice; 되돌리기 takes them back', async () => {
    const { regularClock } = await import('../src/phonesyncmoney.js');
    const { m, p, bank } = setup();
    const r = applyMoney(m, p, ev('job', 5, '10-26', { regulars: [
        { names: ['Salary', '월급'], amount: 2500, frequency: 'monthly', day: 25, account: '1111', who: 'Varo GmbH', since: '', date: '01-25', occurrence: 'again', refersBack: false, made: ['amount', 'day'] },
        { names: ['Rent', '월세'], amount: -900, frequency: 'monthly', day: 1, account: '1111', who: 'Landlord', occurrence: 'again', refersBack: false },
        { names: ['Gym'], amount: -10, frequency: 'weekly', day: 'Mon', account: '2222', occurrence: 'again', refersBack: false },
        { names: ['Nothing'], amount: 0, frequency: 'monthly', occurrence: 'again' },
    ] }), opts());
    assert.deepEqual(p.money.regulars.map(x => [x.name, x.day, x.paidThrough]), [['Salary', 25, '2026-10-25'], ['Rent', 1, '2026-10-25'], ['Gym', 1, '2026-10-25']]);
    assert.ok(r.notes.some(n => n.includes('금액이나 주기')));
    // the round's day (a Monday: the gym is due): no back pay of January's salary though its first day was then
    regularClock(m, p, '10-26 20:00', '2026');
    assert.deepEqual(p.money.tx.map(t => [t.who, t.day]), [['Gym', '2026-10-26']]);
    // a week on: the rent on 11-01, the gym on Monday 11-02 (on the card)
    const fx = regularClock(m, p, '11-03 09:00', '2026');
    assert.deepEqual(p.money.tx.slice(1).map(t => [t.who, t.day, t.amount, t.kind]), [['Landlord', '2026-11-01', -900, 'transfer'], ['Gym', '2026-11-02', -10, 'card']]);
    assert.equal(bank(), 100);
    // set back a little, then on again: nothing twice
    regularClock(m, p, '11-02 09:00', '2026'); regularClock(m, p, '11-03 09:00', '2026');
    assert.equal(p.money.tx.length, 3);
    // the November salary paid by hand (a payment for it): the clock leaves that month
    applyMoney(m, p, ev('pay', 9, '11-20', { moves: [{ account: '1111', amount: 2500, who: 'Varo GmbH', kind: 'deposit', occurrence: 'new', for: '월급' }] }), opts());
    assert.equal(p.money.tx.at(-1).regular, p.money.regulars[0].id);
    regularClock(m, p, '11-30 09:00', '2026');
    assert.equal(p.money.tx.filter(t => t.who === 'Varo GmbH').length, 1);
    // the gym stopped: no more
    applyMoney(m, p, ev('gym-stop', 10, '11-30', { regulars: [{ names: ['Gym'], status: 'stopped', occurrence: 'new', refersBack: true }] }), opts());
    const before = p.money.tx.length;
    regularClock(m, p, '12-10 09:00', '2026');
    assert.deepEqual(p.money.tx.slice(before).map(t => t.who), ['Landlord']);
    revertEffects(m, p, fx);
    assert.ok(!p.money.tx.some(t => t.day === '2026-11-01'));
});

test('점검 9-5 (카드 대금): on its bill day the month\'s card spending goes from the account paying it, once; paid off by hand, none; first seen, nothing for the months before', async () => {
    const { regularClock } = await import('../src/phonesyncmoney.js');
    const { m, p, bank } = setup();
    const card = p.money.bank.accounts[1];
    applyMoney(m, p, ev('cc', 5, '10-20', { accounts: [{ account: '2222', billDay: 15, paidFrom: '1111', occurrence: 'again' }] }), opts());
    regularClock(m, p, '10-20 09:00', '2026');
    assert.equal(card.billThrough, '2026-10-20');
    applyMoney(m, p, ev('d1', 6, '10-26', { moves: [{ account: '2222', amount: -80, who: 'Trattoria', kind: 'card', occurrence: 'new' }] }), opts());
    applyMoney(m, p, ev('d2', 7, '11-02', { moves: [{ account: '2222', amount: -20, who: 'Kino', kind: 'card', occurrence: 'new' }, { account: '2222', amount: 5, who: 'Kino', kind: 'card', occurrence: 'new' }] }), opts());
    regularClock(m, p, '11-16 09:00', '2026');
    // (10-15, 11-15]: 80 + 20 − 5 = 95, from the giro; the card's side a transfer the month's count leaves out
    const bills = p.money.tx.filter(t => t.cardBill);
    assert.deepEqual(bills.map(t => [t.account, t.amount, t.day]), [['1111', -95, '2026-11-15'], ['2222', 95, '2026-11-15']]);
    assert.equal(bank(), 905);
    regularClock(m, p, '11-17 09:00', '2026');
    assert.equal(p.money.tx.filter(t => t.cardBill).length, 2);
    // December's paid off by hand: nothing more
    applyMoney(m, p, ev('d3', 8, '11-20', { moves: [{ account: '2222', amount: -40, who: 'Shop', kind: 'card', occurrence: 'new' }] }), opts());
    applyMoney(m, p, ev('d4', 9, '12-10', { moves: [{ account: '1111', amount: -40, who: 'Karte', kind: 'transfer', occurrence: 'new' }, { account: '2222', amount: 40, who: 'Giro', kind: 'transfer', occurrence: 'new' }] }), opts());
    regularClock(m, p, '12-16 09:00', '2026');
    assert.equal(p.money.tx.filter(t => t.cardBill).length, 2);
});

test('점검 9-5: a parcel past its arrival day has come, by the clock (되돌리기 takes it back, 빼기 of its talk still takes it); MONEY NOW tells the regular ones and the month so far; INVESTMENTS NOW its day and prices', async () => {
    const { orderClock } = await import('../src/phonesyncmoney.js');
    const { addPrice } = await import('../src/finance.js');
    const { m, p } = setup();
    const r = applyMoney(m, p, ev('o', 5, '10-26', { orders: [{ names: ['Lamp'], shop: 'Lumo', price: 30, eta: '10-28', status: 'shipped', occurrence: 'again', refersBack: false }] }), opts());
    assert.deepEqual(orderClock(p, '10-28 22:00'), []);
    const fx = orderClock(p, '10-29 08:00');
    assert.deepEqual([p.money.orders[0].status, p.money.orders[0].arrived], ['delivered', '10-28']);
    revertEffects(m, p, fx);
    assert.deepEqual([p.money.orders[0].status, p.money.orders[0].arrived], ['shipped', '']);
    orderClock(p, '10-29 08:00');
    // (the clock's delivery is no change by hand: the order goes with its talk)
    assert.deepEqual(revertEffects(m, p, r.effects), []);
    assert.equal(p.money.orders.length, 0);
    p.year = 2026; p.now = '10-26 12:00';
    applyMoney(m, p, ev('x', 6, '10-26', { moves: [{ account: '1111', amount: -30, who: 'A', occurrence: 'new' }, { account: '1111', amount: 100, who: 'B', kind: 'deposit', occurrence: 'new' }, { account: '2222', amount: -12, who: 'C', kind: 'card', occurrence: 'new' }],
        regulars: [{ names: ['Rent'], amount: -900, frequency: 'monthly', day: 1, account: '1111', occurrence: 'again', refersBack: false }] }), opts());
    const now = moneyNow(p);
    assert.deepEqual(now.thisMonth, [{ currency: 'EUR', in: 100, out: 42 }]);
    assert.deepEqual(now.regulars.map(x => [x.names[0], x.amount, x.day]), [['Rent', -900, 1]]);
    addPrice(m, 'STOCK:XETRA:SAP', '2026-10-20', { value: 120, source: 'guess' });
    const { investNow } = await import('../src/phonesyncmoney.js');
    assert.equal(investNow(m, p).date, '2026-10-20');
});

test('run58: what the phone lacks is said only while it lacks it (no regular yet, a card with no bill day); an order keeps the time it was made', async () => {
    const { moneyMissing } = await import('../src/phonesyncmoney.js');
    const { m, p } = setup();
    assert.match(moneyMissing(p), /No regular income yet/);
    assert.match(moneyMissing(p), /No regular bill yet/);
    assert.match(moneyMissing(p), /Cards with no "billDay": 2222\./);
    applyMoney(m, p, ev('o', 5, '11-03', { orders: [{ names: ['Scarf'], price: 45000, time: '20:30', occurrence: 'again', refersBack: false }],
        regulars: [{ names: ['Rent'], amount: -650, frequency: 'monthly', day: 1, account: '1111', occurrence: 'again', refersBack: false }],
        accounts: [{ account: '2222', billDay: 15, paidFrom: '1111', occurrence: 'again' }] }), opts());
    assert.equal(p.money.orders[0].time, '11-03 20:30');
    // (a bill but no income yet: the income is still asked for)
    assert.equal(moneyMissing(p), '- No regular income yet (pay, an allowance or support): write the one the owner\'s life has, whatever the messages are about.');
    applyMoney(m, p, ev('pay', 6, '11-04', { regulars: [{ names: ['Salary'], amount: 2000, frequency: 'monthly', day: 25, account: '1111', occurrence: 'again', refersBack: false }] }), opts());
    assert.equal(moneyMissing(p), '');
});

test('run59: the clock never pays a regular on a day the bank\'s balance already holds (before its as-of day)', async () => {
    const { regularClock } = await import('../src/phonesyncmoney.js');
    const { m, p, bank } = setup();
    applyMoney(m, p, ev('pay', 5, '10-15', { regulars: [{ names: ['Salary'], amount: 2000, frequency: 'monthly', day: 18, account: '1111', occurrence: 'again', refersBack: false }] }), opts());
    regularClock(m, p, '10-26 09:00', '2026');
    // (10-18 is before the balance's day, 10-20: already in it)
    assert.equal(p.money.tx.length, 0);
    assert.equal(bank(), 1000);
    regularClock(m, p, '11-19 09:00', '2026');
    assert.deepEqual(p.money.tx.map(t => t.day), ['2026-11-18']);
});

test('run60: an asset with no day the owner got it keeps none (the message\'s day is not it)', () => {
    const { m, p } = setup();
    applyMoney(m, p, ev('t', 5, '11-03', { assets: [{ kind: 'deposit', names: ['Trust'], value: 5000, status: 'blocked', occurrence: 'again', refersBack: false }, { kind: 'vehicle', names: ['Car'], value: 9000, since: '03-02', occurrence: 'again', refersBack: false }] }), opts());
    assert.deepEqual(p.money.assets.map(a => a.since), ['', '03-02']);
    applyMoney(m, p, ev('t2', 6, '11-03', { assets: [{ kind: 'deposit', names: ['Old trust'], value: 1, since: '2025-05-10', occurrence: 'again', refersBack: false }] }), opts());
    assert.equal(p.money.assets.at(-1).since, '2025-05-10');
});

test('run61: a card bill the model wrote by hand, from the paying account to the card by its name, is that month\'s: the clock pays no second one', async () => {
    const { regularClock } = await import('../src/phonesyncmoney.js');
    const { m, p, bank } = setup();
    applyMoney(m, p, ev('cc', 5, '10-20', { accounts: [{ account: '2222', billDay: 14, paidFrom: '1111', occurrence: 'again' }] }), opts());
    regularClock(m, p, '10-20 09:00', '2026');
    applyMoney(m, p, ev('d', 6, '10-26', { moves: [{ account: '2222', amount: -80, who: 'Trattoria', kind: 'card', occurrence: 'new' }] }), opts());
    applyMoney(m, p, ev('bill', 7, '11-14', { moves: [{ account: '1111', amount: -80, who: 'Karte', kind: 'transfer', memo: '카드 대금', occurrence: 'new' }] }), opts());
    regularClock(m, p, '11-20 09:00', '2026');
    assert.equal(p.money.tx.filter(t => t.cardBill).length, 0);
    assert.equal(bank(), 920);
});

test('the report says what a payment was for: who it went to and its memo, or nothing (the scene then)', () => {
    const { m, p } = setup();
    const a = applyMoney(m, p, ev('d', 6, '10-26', { moves: [{ account: '2222', amount: -80, who: 'Trattoria', memo: 'dinner', kind: 'card', occurrence: 'new' }] }), opts());
    assert.equal(a.changes[0].what, 'Trattoria · dinner');
    const b = applyMoney(m, p, ev('r', 7, '10-26', { moves: [{ account: '1111', amount: -30, kind: 'transfer', occurrence: 'new' }] }), opts());
    assert.ok(!('what' in b.changes[0]));
});

test('run66: a mobile pay payment is a card payment for the counts, marked as one; on the giro its money leaves the balance', () => {
    const { m, p, bank } = setup();
    applyMoney(m, p, ev('pay', 5, '10-26', { moves: [{ account: '2222', amount: -12, who: 'Cafe', kind: 'mobile', occurrence: 'new' }, { account: '1111', amount: -30, who: 'Shop', kind: 'mobile', occurrence: 'new' }] }), opts());
    assert.deepEqual(p.money.tx.map(t => [t.account, t.kind, t.mobile]), [['2222', 'card', true], ['1111', 'card', true]]);
    assert.equal(bank(), 970);
});

test('run67: an asset or debt there before, given this message\'s day as the day it began, keeps none; a regular\'s first day a week ahead is its next day, not last year\'s', () => {
    const { m, p } = setup();
    applyMoney(m, p, ev('x', 5, '11-03', { debts: [{ kind: 'loan', names: ['Family loan'], amount: 1000, since: '2026-11-03', occurrence: 'again', refersBack: false }, { kind: 'loan', names: ['New loan'], amount: 500, since: '11-03', occurrence: 'new', refersBack: false }],
        assets: [{ kind: 'deposit', names: ['Trust'], value: 9, since: '11-03', occurrence: 'again', refersBack: false }],
        regulars: [{ names: ['Phone'], amount: -55, frequency: 'monthly', day: 10, date: '11-10', account: '1111', occurrence: 'again', refersBack: false }, { names: ['Pay'], amount: 2000, frequency: 'monthly', day: 25, date: '01-25', account: '1111', occurrence: 'again', refersBack: false }] }), opts());
    assert.deepEqual(p.money.debts.map(d => d.since ?? ''), ['', '11-03']);
    assert.equal(p.money.assets[0].since, '');
    assert.deepEqual(p.money.regulars.map(r => r.since), ['2026-11-10', '2026-01-25']);
});

test('run68: a stay told twice in one answer (booked, then extended) is one ticket with the new last day; another place is another', () => {
    const { m, p } = setup();
    applyMoney(m, p, ev('stay', 5, '11-07', { passes: [
        { kind: 'hotel', by: 'Airbnb', names: ['Airbnb'], date: '11-07', until: '11-21', status: 'booked', occurrence: 'new', refersBack: false },
        { kind: 'hotel', by: 'Airbnb', names: ['Airbnb'], date: '11-07', until: '12-03', status: 'used', occurrence: 'again' },
        { kind: 'hotel', by: 'Glad Hotel', names: ['Glad Hotel'], date: '11-02', until: '11-07', occurrence: 'again' },
    ] }), opts());
    assert.deepEqual(p.money.passes.map(x => [x.by, x.until, x.status]), [['Airbnb', '12-03', 'used'], ['Glad Hotel', '11-07', '']]);
});
