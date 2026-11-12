// 폰 2 답장을 실제로 돌리기 (단계 7-5): 보내기 → 답장 → (폰으로 한 일이 있으면) 폰 2 반영. 모델은 가짜예요.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { migrateBank, cash } from '../src/finance.js';
import * as L from '../src/phone2store.js';
import { G, T } from './phone2reflect.load.mjs';

const phone = () => ({ owner: 'Mara', now: '11-10 22:00', year: 2026, contacts: [{ name: 'Ivo' }], threads: [], calls: [], photos: [], notes: [], searches: [], events: [], posts: [], mails: [], diary: [], voice: [],
    money: { currency: 'KRW', asOf: '2026-11-01', bank: { accounts: [{ id: 'chk', kind: 'checking', name: '입출금', last4: '1111', currency: 'KRW', balance: 100000 }] }, tx: [], orders: [], passes: [] } });
function world() {
    const real = { phones: { mara: { owner: 'Mara', notes: [{ title: '폰 1' }] } } };
    L.startFresh(real, { persona: 'Ren', scope: 'test' });
    const m = L.liveMeta(real); m.phones = { mara: phone() }; migrateBank(m, m.phones.mara);
    const room = L.ensureRoom(real, ['Mara']);
    Object.assign(T, { answers: [], moneyAnswers: [], replies: [], calls: 0, replyCalls: 0, saves: 0 });
    return { real, m, room, p: m.phones.mara, bank: () => cash(m.finance.accounts['chk:KRW']) };
}
const send = (c, text) => { const x = L.sendLive(c.real, c.room.id, text); L.enqueueReplies(c.real, c.room.id); return x; };

test('말만 오간 답장: 방에 들어가고 저장돼요. 반영은 안 돌아요', async () => {
    const c = world(), p1 = JSON.stringify(c.real.phones);
    send(c, '일어났냐');
    T.replies = [{ state: '08:10 · 집 · 침대', reply: ['방금…'], ko: ['방금…'], does: [] }];
    let drew = 0;
    const r = await G.liveGo(c.real, { onChange: () => drew++ });
    assert.equal(r.ran, 1); assert.equal(r.failed, null);
    assert.deepEqual(c.room.messages.map(x => [x.from, x.text]), [['Ren', '일어났냐'], ['Mara', '방금…']]);
    assert.equal(c.room.messages[1].state, '집 · 침대');
    assert.equal(T.replyCalls, 1); assert.equal(T.calls, 0);
    assert.ok(T.saves >= 1 && drew >= 1);
    // the request is the reply prompt with the messenger in it; the persona is marked as reached on the messenger
    assert.match(T.replyInput, /\[MESSENGER\]\n.* · Ren: 일어났냐/);
    assert.ok(c.p.contacts.some(x => x.name === 'Ren' && x.messenger));
    assert.equal(G.liveUnreflected(c.real, 'Mara'), 2);
    assert.equal(JSON.stringify(c.real.phones), p1);
});

test('폰으로 한 일이 있는 답장: 바로 반영하고, 쌓여 있던 말도 같이 읽어요', async () => {
    const c = world();
    send(c, '일어났냐');
    T.replies = [{ state: '집', reply: ['방금'], does: [] }];
    await G.liveGo(c.real);
    send(c, '더치페이 보내라');
    T.replies = [{ state: '집', reply: ['지금 보낼게'], does: [{ app: 'bank', what: '더치페이 몫 32,000원 Ren에게 송금' }] }];
    T.answers = [{ events: [{ id: 'split', at: 4, quote: '더치페이 몫 32,000원', summary: 'Ren에게 보냄', date: '11-11', time: '13:11', money: true, phone: {} }] }];
    T.moneyAnswers = [{ records: [{ type: 'payment', at: 4, account: '1111', amount: -32000, who: 'Ren', kind: 'transfer', occurrence: 'new' }] }];
    const r = await G.liveGo(c.real);
    assert.equal(r.ran, 1);
    assert.equal(T.calls, 1);
    assert.match(T.input, /\[#1\] Ren: 일어났냐[\s\S]*\[#4\] Mara \[Bank, cards & wallet\]: 더치페이 몫 32,000원/);
    assert.equal(c.bank(), 68000);
    assert.equal(G.liveUnreflected(c.real, 'Mara'), 0);
});

test('답장이 실패하면 줄이 멈추고 이유가 일에 남아요. 반영이 실패해도 답장은 남아요', async () => {
    const c = world();
    send(c, '뭐해');
    T.replies = [new Error('모델이 막았어요')];
    const r = await G.liveGo(c.real);
    assert.equal(r.ran, 0); assert.match(r.failed.error, /모델이 막았어요/);
    assert.ok(L.queueStopped(c.real));
    assert.equal(c.room.messages.length, 1);
    // seen, sent again: the reply comes, its reflection fails (an answer that can't be read)
    for (const j of L.liveWorld(c.real).queue.jobs) L.seeFailure(c.real, j.id);
    L.enqueueReplies(c.real, c.room.id);
    T.replies = [{ state: '집', reply: ['검색 중'], does: [{ app: 'search', what: '리옹 날씨' }] }];
    T.answers = ['not json'];
    const r2 = await G.liveGo(c.real);
    assert.equal(r2.ran, 1); assert.equal(r2.failed, null);
    assert.equal(c.room.messages.at(-1).text, '검색 중');
    assert.ok(c.p.liveReflectError?.why);
    assert.equal(G.liveUnreflected(c.real, 'Mara'), 2);
});

test('폰 1은 이 파일을 안 불러요', async () => {
    for (const f of (await readdir(new URL('../src/', import.meta.url))).filter(f => f.endsWith('.js') && f !== 'phone2go.js' && f !== 'phone.js')) assert.doesNotMatch(await readFile(new URL(`../src/${f}`, import.meta.url), 'utf8'), /phone2go/, f);
});
