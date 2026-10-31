import test from 'node:test';
import assert from 'node:assert/strict';
import { applyMoney, replayEffects, revertEffects } from '../src/phonesyncmoney.js';
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
    const r2 = applyMoney(m, p, ev('to-mara-again', 8, '10-25', { moves: [{ account: '1111', amount: -100, who: 'Mara', kind: 'transfer', separate: true }] }), opts());
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
    migrateBank(m, p);
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
    applyMoney(m, p, ev('c3', 12, '10-27', { moves: [{ account: '1111', amount: -4.5, who: 'Café Blau', separate: true }] }), opts());
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
