// 폰 2 답장을 실제로 돌리기 (단계 7-5): 보내기 → 답장, 메신저를 나갈 때 폰 2 반영. 모델은 가짜예요.
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

test('답장: 방에 들어가고 저장돼요. 반영은 안 돌아요', async () => {
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
    // (the clock block is the reply's: the time now with its weekday, not the reflection's "Saved phone time")
    assert.match(T.replyInput, /\[OWNER'S CLOCK\]\nPhone owner: Mara\n[\s\S]*Time now: \d{2}-\d{2} \d{2}:\d{2} \((Sun|Mon|Tue|Wed|Thu|Fri|Sat)\)/);
    assert.ok(!T.replyInput.includes('Saved phone time'));
    assert.ok(c.p.contacts.some(x => x.name === 'Ren' && x.messenger));
    assert.equal(G.liveUnreflected(c.real, 'Mara'), 2);
    assert.equal(JSON.stringify(c.real.phones), p1);
});

test('답장에 폰으로 한 일이 있어도 반영은 안 돌아요. 메신저를 나갈 때 쌓인 대화를 한 번에 읽어요', async () => {
    const c = world();
    send(c, '일어났냐');
    T.replies = [{ state: '집', reply: ['방금'], does: [] }];
    await G.liveGo(c.real);
    send(c, '더치페이 보내라');
    T.replies = [{ state: '집', reply: ['지금 보낼게'], does: [{ app: 'bank', what: '더치페이 몫 32,000원 Ren에게 송금' }] }];
    const r = await G.liveGo(c.real);
    assert.equal(r.ran, 1);
    assert.equal(T.calls, 0);
    assert.equal(c.bank(), 100000);
    assert.equal(G.liveUnreflected(c.real, 'Mara'), 4);
    // leaving the messenger
    T.answers = [{ events: [{ id: 'split', at: 4, quote: '더치페이 몫 32,000원', summary: 'Ren에게 보냄', date: '11-11', time: '13:11', money: true, phone: {} }] }];
    T.moneyAnswers = [{ records: [{ type: 'payment', at: 4, account: '1111', amount: -32000, who: 'Ren', kind: 'transfer', occurrence: 'new' }] }];
    let drew = 0;
    const got = await G.liveReflect(c.real, 'Mara', { onChange: () => drew++ });
    assert.deepEqual(got, { rounds: 1, left: 0, waiting: false, error: '' });
    assert.equal(T.calls, 1);
    assert.match(T.input, /\[#1\] Ren: 일어났냐[\s\S]*\[#4\] Mara \[Bank, cards & wallet\]: 더치페이 몫 32,000원/);
    assert.equal(c.bank(), 68000);
    assert.ok(drew >= 1);
    // nothing new: leaving again calls no model
    assert.deepEqual(await G.liveReflect(c.real, 'Mara'), { rounds: 0, left: 0, waiting: false, error: '' });
    assert.equal(T.calls, 1);
});

test('답장이 아직 오는 중이면 나갈 때 반영하지 않아요 (다음에 한 번에)', async () => {
    const c = world();
    send(c, '뭐해');
    const got = await G.liveReflect(c.real, 'Mara');
    assert.deepEqual(got, { rounds: 0, left: 1, waiting: true, error: '' });
    assert.equal(T.calls, 0);
});

test('답장이 실패하면 줄이 멈추고 이유가 일에 남아요. 반영이 실패하면 폰은 그대로고 이유를 적어요', async () => {
    const c = world();
    send(c, '뭐해');
    T.replies = [new Error('모델이 막았어요')];
    const r = await G.liveGo(c.real);
    assert.equal(r.ran, 0); assert.match(r.failed.error, /모델이 막았어요/);
    assert.ok(L.queueStopped(c.real));
    assert.equal(c.room.messages.length, 1);
    for (const j of L.liveWorld(c.real).queue.jobs) L.seeFailure(c.real, j.id);
    L.enqueueReplies(c.real, c.room.id);
    T.replies = [{ state: '집', reply: ['검색 중'], does: [{ app: 'search', what: '리옹 날씨' }] }];
    const r2 = await G.liveGo(c.real);
    assert.equal(r2.ran, 1); assert.equal(r2.failed, null);
    assert.equal(c.room.messages.at(-1).text, '검색 중');
    T.answers = ['not json'];
    const before = JSON.stringify(c.p.searches);
    const got = await G.liveReflect(c.real, 'Mara');
    assert.equal(got.rounds, 0); assert.ok(got.error); assert.equal(got.left, 2);
    assert.ok(c.p.liveReflectError?.why);
    assert.equal(JSON.stringify(c.p.searches), before);
    // the next time it works: the note of the failure goes
    T.answers = [{ events: [] }];
    const again = await G.liveReflect(c.real, 'Mara');
    assert.equal(again.error, ''); assert.equal(again.left, 0);
    assert.equal(c.p.liveReflectError, undefined);
});

test('방금 반영 되돌리기: 기록 · 돈 · 상황 · 읽은 자리가 반영 전으로, 메시지는 새 대화가 올 때까지 기다려요', async () => {
    const c = world(), p1 = JSON.stringify(c.real.phones);
    send(c, '더치페이 보내라');
    T.replies = [{ state: '집', reply: ['지금 보낼게'], does: [{ app: 'bank', what: '더치페이 몫 32,000원 Ren에게 송금' }] }];
    await G.liveGo(c.real);
    assert.equal(G.liveCanUndo(c.real, 'Mara'), false);
    const core = () => ({ events: [{ id: 'split', at: 2, quote: '더치페이 몫 32,000원', summary: 'Ren에게 보냄', date: '11-11', time: '13:11', money: true, phone: { notes: [{ title: '보냄', text: 'x', time: '11-11 13:11' }] } }], situations: [{ id: 'split', what: '더치페이', state: 'done' }] });
    const money = () => [{ records: [{ type: 'payment', at: 2, account: '1111', amount: -32000, who: 'Ren', kind: 'transfer', occurrence: 'new' }] }];
    const before = { now: c.p.now, notes: c.p.notes.length };
    T.answers = [core()]; T.moneyAnswers = money();
    await G.liveReflect(c.real, 'Mara');
    assert.equal(c.bank(), 68000); assert.equal(c.p.notes.length, 1); assert.equal(c.p.situations.length, 1);
    assert.equal(G.liveCanUndo(c.real, 'Mara'), true);
    // 되돌리기
    let drew = 0;
    const kept = await G.liveUndo(c.real, 'Mara', { onChange: () => drew++ });
    assert.deepEqual(kept, []);
    assert.equal(c.bank(), 100000);
    assert.equal(c.p.notes.length, before.notes); assert.equal(c.p.now, before.now);
    assert.equal(c.p.situations, undefined);
    assert.equal(c.p.money.tx.length, 0);
    assert.equal(G.liveUnreflected(c.real, 'Mara'), 2);
    assert.equal(G.liveCanUndo(c.real, 'Mara'), false);
    assert.equal(drew, 1);
    // 폰 1 is untouched; nothing more to undo
    assert.equal(JSON.stringify(c.real.phones), p1);
    await assert.rejects(G.liveUndo(c.real, 'Mara'), /되돌릴 반영이 없어요/);
    // leaving the messenger again does not read them straight back
    T.calls = 0;
    assert.deepEqual(await G.liveReflect(c.real, 'Mara'), { rounds: 0, left: 2, waiting: false, error: '', held: true });
    assert.equal(T.calls, 0);
    // asked for: read again now
    T.answers = [core()]; T.moneyAnswers = money();
    const again = await G.liveReflect(c.real, 'Mara', { force: true });
    assert.equal(again.rounds, 1); assert.equal(c.bank(), 68000); assert.equal(c.p.liveHeld, undefined);
});

test('되돌린 뒤 새 대화가 오면 기다리던 메시지도 같이 읽어요. 두 번 반영했으면 한 번씩 거슬러 되돌려요', async () => {
    const c = world();
    const talk = async (text, reply) => { send(c, text); T.replies = [{ state: '집', reply: [reply], does: [] }]; await G.liveGo(c.real); };
    const note = (at, quote, title) => ({ events: [{ id: title, at, quote, summary: title, date: '11-11', time: '13:00', phone: { notes: [{ title, text: 'x', time: '11-11 13:00' }] } }] });
    await talk('첫 얘기', '응 첫 답');
    T.answers = [note(2, '응 첫 답', '첫째')]; await G.liveReflect(c.real, 'Mara');
    await talk('둘째 얘기', '응 둘째 답');
    T.answers = [note(4, '응 둘째 답', '둘째')]; await G.liveReflect(c.real, 'Mara');
    assert.deepEqual(c.p.notes.map(x => x.title), ['첫째', '둘째']);
    await G.liveUndo(c.real, 'Mara');
    assert.deepEqual(c.p.notes.map(x => x.title), ['첫째']);
    assert.equal(G.liveCanUndo(c.real, 'Mara'), true);
    await G.liveUndo(c.real, 'Mara');
    assert.deepEqual(c.p.notes.map(x => x.title), []);
    assert.equal(G.liveUnreflected(c.real, 'Mara'), 4);
    // new talk: all of it is read together
    await talk('셋째 얘기', '응 셋째 답');
    T.answers = [{ events: [] }]; T.calls = 0;
    const got = await G.liveReflect(c.real, 'Mara');
    assert.equal(got.rounds, 1); assert.equal(got.left, 0);
    assert.match(T.input, /첫 얘기[\s\S]*둘째 얘기[\s\S]*셋째 얘기/);
});

test('폰 1은 이 파일을 안 불러요', async () => {
    for (const f of (await readdir(new URL('../src/', import.meta.url))).filter(f => f.endsWith('.js') && f !== 'phone2go.js' && f !== 'phone.js')) assert.doesNotMatch(await readFile(new URL(`../src/${f}`, import.meta.url), 'utf8'), /phone2go/, f);
});
