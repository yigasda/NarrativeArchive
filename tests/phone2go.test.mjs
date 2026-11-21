// 폰 2 답장을 실제로 돌리기 (단계 7-5): 보내기 → 답장, 메신저를 나갈 때 폰 2 반영. 모델은 가짜예요.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { migrateBank, cash } from '../src/finance.js';
import * as L from '../src/phone2store.js';
import { G, T, PD, Y, N, Q, snapFor } from './phone2reflect.load.mjs';
// 롤플에 넣는 글, 창구(P.phoneBlock)가 만드는 대로: 폰 1의 글(폰 1 함수) + 실시간 폰의 글(phone2note.js)
const block = (m, live = null) => PD.phoneBlock(m) + N.liveNote(live);
import { journalRead, journalWrite } from '../src/phonesync.js';

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

test('은행이 없는 실시간 폰: 되돌려도 없던 장부가 생기지 않아요', async () => {
    const c = world();
    delete c.p.money; L.liveWorld(c.real).finance = null;
    send(c, '뭐해');
    T.replies = [{ state: '집', reply: ['메모 중'], does: [{ app: 'notes', what: '장 볼 것 적음' }] }];
    await G.liveGo(c.real);
    T.answers = [{ events: [{ id: 'list', at: 2, quote: '장 볼 것 적음', summary: '장보기 메모', date: '11-11', time: '13:00', phone: { notes: [{ title: '장 볼 것', text: 'x', time: '11-11 13:00' }] } }] }];
    await G.liveReflect(c.real, 'Mara');
    assert.equal(c.p.notes.length, 1);
    await G.liveUndo(c.real, 'Mara');
    assert.equal(c.p.notes.length, 0);
    assert.equal(L.liveWorld(c.real).finance, null);
});

// ---- 점검에서 나온 것: 폰 2가 폰 1을 건드리던 곳
const storyWorld = () => {
    const p1 = { ...phone(), syncLast: { checked: 3, apps: ['메모'] }, syncUndo: { round: 'p1r2', items: [['notes', 'n1']], msgs: [], effects: [], read: [11, 12], moneyAt: undefined, investAt: undefined },
        syncUndos: [{ round: 'p1r1', items: [], msgs: [], effects: [] }], notes: [{ id: 'n1', title: '이야기 메모', text: 'x', time: '11-09 10:00' }] };
    const real = { text: '', phones: { mara: p1 } };
    migrateBank(real, p1);
    p1.sync = { v: 1, scope: 'test', order: 'oldest', limit: 12, marks: { base: { index: 1, user: -1, fp: '', tail: '' } }, done: [[2, 12]], failed: {}, arch: {}, rounds: ['p1r1', 'p1r2'],
        events: { lunch: { at: 4, summary: 'STORY lunch paid 20000', quote: 'paid', effects: [] } }, owed: { money: [{ at: 4, date: '11-09', time: '12:30' }] } };
    return real;
};

test('이야기에서 시작한 실시간 폰은 폰 1의 되돌리기 · 지난 반영 · 밀린 결제를 안 가져와요 (폰 1 것은 그대로)', async () => {
    const real = storyWorld(), p1 = JSON.stringify(real.phones);
    L.startFromStory(real, { persona: 'Ren', upto: 12, scope: 'test' }).snap = snapFor(real, 12);
    const lp = L.livePhone(real, 'Mara');
    assert.equal(lp.syncUndo, undefined); assert.equal(lp.syncUndos, undefined); assert.equal(lp.syncLast, undefined); assert.equal(lp.sync.owed, undefined);
    assert.deepEqual(lp.notes.map(x => x.title), ['이야기 메모']); assert.deepEqual(lp.sync.done, [[2, 12]]);
    assert.equal(JSON.stringify(real.phones), p1);
    assert.equal(G.liveCanUndo(real, 'Mara'), false);
    await assert.rejects(G.liveUndo(real, 'Mara'), /되돌릴 반영이 없어요/);
});

test('전에 시작해 둔 실시간 폰(폰 1의 되돌리기 · 밀린 결제가 복사돼 있음): 되돌리기는 실시간 반영만, 밀린 결제는 안 넣어요', async () => {
    const real = storyWorld();
    L.startFromStory(real, { persona: 'Ren', upto: 12, scope: 'test' }).snap = snapFor(real, 12);
    // (as an older version left it: the copies still on the live phone)
    const lp = L.livePhone(real, 'Mara'), src = real.phones.mara;
    Object.assign(lp, structuredClone({ syncUndo: src.syncUndo, syncUndos: src.syncUndos, syncLast: src.syncLast }));
    lp.sync.owed = structuredClone(src.sync.owed);
    assert.equal(G.liveCanUndo(real, 'Mara'), false);
    await assert.rejects(G.liveUndo(real, 'Mara'), /되돌릴 반영이 없어요/);
    assert.deepEqual(lp.notes.map(x => x.title), ['이야기 메모']);
    // a live round: the story's owed lunch is neither asked nor booked
    const room = L.ensureRoom(real, ['Mara']);
    Object.assign(T, { answers: [], moneyAnswers: [], replies: [], calls: 0, moneyInput: '' });
    L.sendLive(real, room.id, '더치페이 보내라'); L.enqueueReplies(real, room.id);
    T.replies = [{ state: '집', reply: ['보낼게'], does: [{ app: 'bank', what: '더치페이 몫 32,000원 Ren에게 송금' }] }];
    await G.liveGo(real);
    T.answers = [{ events: [{ id: 'split', at: 14, quote: '더치페이 몫 32,000원', summary: 'Ren에게 보냄', date: '11-11', time: '13:11', money: true, phone: {} }] }];
    T.moneyAnswers = [{ records: [{ type: 'payment', at: 14, account: '1111', amount: -32000, who: 'Ren', kind: 'transfer', occurrence: 'new' }, { type: 'payment', at: 4, account: '1111', amount: -20000, who: 'Lunch place', kind: 'card', occurrence: 'new' }] }];
    assert.equal((await G.liveReflect(real, 'Mara')).error, '');
    assert.ok(!T.moneyInput.includes('STORY lunch'));
    assert.equal(cash(L.liveWorld(real).finance.accounts['chk:KRW']), 68000);
    assert.deepEqual(lp.money.tx.map(t => t.who), ['Ren']);
    // 되돌리기: this round, and then no further (폰 1's round under it is not offered)
    assert.equal(G.liveCanUndo(real, 'Mara'), true);
    await G.liveUndo(real, 'Mara');
    assert.equal(cash(L.liveWorld(real).finance.accounts['chk:KRW']), 100000);
    assert.equal(G.liveCanUndo(real, 'Mara'), false);
    assert.deepEqual(lp.notes.map(x => x.title), ['이야기 메모']);
});

test('실시간 폰에서 연도를 바꿔도 폰 1의 복구 기록은 그대로예요 (실시간 폰의 복구 기록만 옮겨요)', () => {
    const real = { text: '', phones: { mara: { ...phone(), year: 2026 } } };
    L.startFromStory(real, { persona: 'Ren', upto: 3, scope: 'test' }).snap = snapFor(real, 3);
    const liveKey = L.liveScope('test', real), round = () => [{ round: 'r1', owner: 'Mara', year: 2026, events: [{ id: 'e', date: '2026-11-10' }], life: [] }];
    journalWrite('test', round()); journalWrite(liveKey, round());
    const before = JSON.stringify(journalRead('test')), d = L.liveMeta(real);
    assert.equal(d.phoneJournal, liveKey);
    Y.liveSetStoryYear(d, d.phones.mara, 2027);
    assert.equal(JSON.stringify(journalRead('test')), before);
    assert.equal(journalRead(liveKey)[0].year, 2027);
    assert.equal(real.phones.mara.year, 2026); assert.equal(d.phones.mara.year, 2027);
    // 폰 1's own year change still moves 폰 1's journal, as before
    PD.setStoryYear(real, real.phones.mara, 2028);
    assert.equal(journalRead('test')[0].year, 2028); assert.equal(journalRead(liveKey)[0].year, 2027);
    journalWrite('test', []); journalWrite(liveKey, []);
});

test('해가 바뀐 뒤의 반영: 되돌리면 연도도 돌아오고, 실패한 반영은 연도를 안 바꿔요', async () => {
    const c = world();
    c.p.now = '12-31 20:00'; c.p.year = 2026;
    c.room.messages.push({ id: 'a', n: L.liveNo(L.liveWorld(c.real)), from: 'Ren', text: '새해 복', at: Date.parse('2027-01-01T00:05:00Z') }, { id: 'b', n: L.liveNo(L.liveWorld(c.real)), from: 'Mara', text: '너도', at: Date.parse('2027-01-01T00:06:00Z') });
    T.answers = ['not json'];
    assert.ok((await G.liveReflect(c.real, 'Mara')).error);
    assert.equal(c.p.year, 2026); assert.equal(c.p.now, '12-31 20:00');
    T.answers = [{ events: [] }];
    assert.equal((await G.liveReflect(c.real, 'Mara', { force: true })).error, '');
    assert.equal(c.p.year, 2027); assert.equal(c.p.now, '01-01 00:06');
    await G.liveUndo(c.real, 'Mara');
    assert.equal(c.p.year, 2026); assert.equal(c.p.now, '12-31 20:00');
});

test('폰 1은 이 파일을 안 불러요', async () => {
    for (const f of (await readdir(new URL('../src/', import.meta.url))).filter(f => f.endsWith('.js') && f !== 'phone2go.js' && f !== 'phone2tick.js' && f !== 'phone.js')) assert.doesNotMatch(await readFile(new URL(`../src/${f}`, import.meta.url), 'utf8'), /phone2go/, f);
});

test('말도 한 일도 없이 상태만 바뀐 답은 반영할 게 아니에요: 반영한 뒤 "안 읽은 대화"가 남지 않아요', async () => {
    const c = world();
    send(c, '자냐');
    T.replies = [{ state: '02:10 · 집 · 침대', reply: [], does: [] }];
    await G.liveGo(c.real);
    assert.equal(c.room.messages.length, 2); assert.ok(c.room.messages[1].act);
    assert.equal(G.liveUnreflected(c.real, 'Mara'), 1);          // the persona's own line only
    T.answers = [{ events: [] }];
    const r = await G.liveReflect(c.real, 'Mara');
    assert.equal(r.left, 0); assert.equal(G.liveUnreflected(c.real, 'Mara'), 0);
});

test('요청이 나가 있는 사이 다른 채팅을 열면 더 묻지 않아요. 답은 못 넣고, 일은 돌아왔을 때 다시 해요', async () => {
    const c = world();
    T.metadata = { narrative_archive: c.real };
    try {
        send(c, '하나'); send(c, '둘');
        let asked = 0;
        // (the first answer comes back after another chat was opened)
        T.ask = async () => { asked++; T.metadata = { narrative_archive: {} }; return JSON.stringify({ state: '집', reply: ['응'], does: [] }); };
        const r = await G.liveGo(c.real);
        assert.equal(asked, 1); assert.equal(r.ran, 0);
        assert.deepEqual(c.room.messages.map(x => x.text), ['하나', '둘']);
        assert.ok(L.liveWorld(c.real).queue.jobs.every(j => j.state === 'waiting'));
        // reflection and summaries: nothing is asked for a chat that isn't open
        asked = 0;
        const out = await G.liveReflect(c.real, 'Mara', { force: true });
        assert.equal(asked, 0); assert.equal(out.rounds, 0);
        // back in the chat: the reply is asked again
        T.metadata = { narrative_archive: c.real };
        T.ask = async () => { asked++; return JSON.stringify({ state: '집', reply: ['응'], does: [] }); };
        await G.liveGo(c.real);
        assert.ok(asked >= 1); assert.ok(c.room.messages.some(x => x.text === '응'));
    } finally { delete T.ask; delete T.metadata; }
});

test('실시간 폰의 앱 요청은 시작 뒤의 롤플 채팅을 안 읽어요. 최근 대화는 메신저 것이에요', async () => {
    const chat0 = T.chat;
    T.chat = ['옛날 이야기 하나', '옛날 이야기 둘', '시작 직전 이야기', '시작 뒤 롤플 하나', '시작 뒤 롤플 둘'].map((mes, i) => ({ name: i % 2 ? 'Mara' : 'Ren', is_user: !(i % 2), mes, extra: {} }));
    // (what 폰 1's reader gives as the chat's newest messages)
    T.recent = ['[#1] Mara: 옛날 이야기 둘', '[#2] Ren: 시작 직전 이야기', '[#3] Mara: 시작 뒤 롤플 하나', '[#4] Ren: 시작 뒤 롤플 둘'];
    try {
        const real = { phones: { mara: phone() }, text: '' };
        L.startFromStory(real, { persona: 'Ren', upto: 2, scope: 'test' }).snap = snapFor(real, 2);
        const room = L.ensureRoom(real, ['Mara']);
        L.sendLive(real, room.id, '메신저로 한 말');
        const d = L.liveMeta(real), p = d.phones.mara;
        p.now = '11-12 21:30';
        // the drawer says where the messenger's numbers begin and gives the messenger's talk; nothing is read of the chat
        assert.equal(d.phoneUpto, 2);
        assert.equal(d.phoneRecent('Mara', 6, { maxChars: 6000 }), 'Ren: 메신저로 한 말');
        assert.deepEqual([Q.liveWindowOf(d, p).upto, Q.liveWindowOf(d, p).n], [-1, 0]);
        // (the newest talk: the story up to where 폰 2 began, then the messenger; never the chat after the start)
        assert.equal(Q.liveRecentText(d, 'Mara', 6, {}), '[#1] Mara: 옛날 이야기 둘\n\n[#2] Ren: 시작 직전 이야기\n\nRen: 메신저로 한 말');
        assert.equal(Q.liveRecentText(d, 'Mara', 1, {}), 'Ren: 메신저로 한 말');
        assert.equal(L.liveNowText(d, p), '11-12 21:30');
        const side = await Q.liveSideRequest(d, 'Mara', ['[TARGET]\nx']);
        assert.ok(side.includes('Ren: 메신저로 한 말'));
        assert.ok(side.includes('시작 직전 이야기'));
        assert.ok(side.indexOf('시작 직전 이야기') < side.indexOf('메신저로 한 말'));
        assert.ok(!side.includes('시작 뒤 롤플'));
        // an app that marks where it read (투자 처음 채우기): only the talk the reflection has read, and its mark is the
        // last message read, a messenger number (so the reflection gives the app what comes after, once)
        const first = room.messages[0].n;
        L.sendLive(real, room.id, '아직 반영 안 된 말');
        p.sync = { scope: 'x', marks: { base: { index: 2, user: -1, fp: '', tail: '' } }, done: [[first, first]] };
        const read = {};
        const fill = await Q.liveSideRequest(d, 'Mara', ['[TARGET]\nx'], { read });
        assert.ok(fill.includes('메신저로 한 말')); assert.ok(!fill.includes('아직 반영 안 된 말')); assert.ok(fill.includes('시작 직전 이야기')); assert.ok(!fill.includes('시작 뒤 롤플'));
        assert.deepEqual(Q.liveReadMark(read.gap), { index: first, user: -1, fp: '', tail: '' });
        assert.equal(PD.nowAt(read.gap), -1);
        delete p.sync;
        // 폰 1 (the chat's own meta): as before, the chat's newest messages
        const side1 = await PD.sideRequest(real, 'Mara', ['[TARGET]\nx']);
        assert.ok(side1.includes('시작 뒤 롤플 둘')); assert.ok(!side1.includes('메신저로 한 말'));
        assert.equal(real.phoneUpto, undefined); assert.equal(real.phoneRecent, undefined);
        // a 폰 2 begun fresh reads none of the chat
        const fresh = { phones: {}, text: '' };
        L.startFresh(fresh, { persona: 'Ren', scope: 'test' });
        assert.equal(L.liveMeta(fresh).phoneUpto, -1);
    } finally { T.chat = chat0; delete T.recent; }
});

test('앱 요청(사진 · 일기 · 초안 · 녹음): 폰 1 파일(phoneai.js)은 예전 줄 그대로, 실시간 것은 phone2act.js에 (시험은 phone2act.test.mjs)', async () => {
    const src = await (await import('node:fs/promises')).readFile(new URL('../src/phoneai.js', import.meta.url), 'utf8');
    assert.ok(!/recentOf\(|nowOn\(/.test(src));
    assert.equal((src.match(/recentPhoneText\(\d+, /g) || []).length, 4); assert.equal((src.match(/storyNow\(p\) \|\| p\.now \|\| ''/g) || []).length, 7);
});

test('반영 요청이 나가 있는 사이 다른 채팅을 열면: 돌아온 답은 안 넣고, 더 묻지도 않아요', async () => {
    const c = world();
    T.metadata = { narrative_archive: c.real };
    try {
        send(c, '택시비 9000원 냈어');
        T.replies = [{ state: '집', reply: ['응'], does: ['9000원을 보냈다'] }];
        await G.liveGo(c.real);
        const left = G.liveUnreflected(c.real, 'Mara'), bank = c.bank();
        let asked = 0;
        T.ask = async () => { asked++; T.metadata = { narrative_archive: {} }; return JSON.stringify({ now: '11-11 10:00', events: [] }); };
        const r = await G.liveReflect(c.real, 'Mara', { force: true });
        assert.equal(asked, 1);
        assert.equal(r.rounds, 0);
        assert.equal(c.p.liveReflectError, undefined);
        assert.deepEqual(c.p.sync?.done || [], []); assert.equal(c.bank(), bank);
        T.metadata = { narrative_archive: c.real };
        assert.equal(G.liveUnreflected(c.real, 'Mara'), left);
    } finally { delete T.ask; delete T.metadata; }
});

test('되돌리기 뒤에 상태만 바뀐 답(말도 한 일도 없음)이 와도 반영이 다시 돌지 않아요', async () => {
    const c = world();
    send(c, '하나');
    T.replies = [{ state: '집', reply: ['응'], does: [] }];
    await G.liveGo(c.real);
    T.answers = [{ events: [] }];
    await G.liveReflect(c.real, 'Mara');
    await G.liveUndo(c.real, 'Mara');
    assert.ok(Number.isInteger(c.p.liveHeld));
    // a reply with only a new state: an act message with nothing to read
    const no = L.liveNo(L.liveWorld(c.real));
    c.room.messages.push({ id: `m${no}`, n: no, from: 'Mara', text: '', act: true, state: '침대', at: Date.now() });
    const calls = T.calls;
    const r = await G.liveReflect(c.real, 'Mara');
    assert.equal(r.held, true); assert.equal(T.calls, calls);
});

test('실시간 폰에서 연도를 직접 고르면 반영이 실제 연도로 덮어쓰지 않아요 (고른 만큼 차이를 지키고, 해가 바뀌면 같이 넘어가요)', async () => {
    const c = world();
    c.p.now = '11-10 22:00'; c.p.year = 2026;
    // (the user picks 2031 in 날짜 및 시간: five years ahead of the real year the phone had)
    Y.liveSetStoryYear(c.m, c.p, 2031);
    assert.equal(c.p.year, 2031); assert.equal(c.p.liveYearShift, 5);
    c.room.messages.push({ id: 'a', n: L.liveNo(L.liveWorld(c.real)), from: 'Ren', text: '안녕', at: Date.parse('2026-11-11T01:00:00Z') });
    T.answers = [{ events: [] }];
    assert.equal((await G.liveReflect(c.real, 'Mara')).error, '');
    assert.equal(c.p.year, 2031);
    c.room.messages.push({ id: 'b', n: L.liveNo(L.liveWorld(c.real)), from: 'Ren', text: '새해 복', at: Date.parse('2027-01-01T00:05:00Z') });
    T.answers = [{ events: [] }];
    assert.equal((await G.liveReflect(c.real, 'Mara')).error, '');
    assert.equal(c.p.year, 2032);
    // back to the real year
    Y.liveSetStoryYear(c.m, c.p, 2027);
    assert.equal(c.p.liveYearShift, undefined); assert.equal(c.p.year, 2027);
});

test('주입: 실시간 폰에서 켜면 그 폰도 롤플에 넣는 글에 들어가요 (따로 적힌 칸으로). 꺼져 있으면 폰 1 글 그대로예요', () => {
    const one = { owner: 'Mara', inject: true, now: '10-26 12:00', contacts: [], calls: [], events: [], notes: [{ title: '폰 1 메모', text: 'x' }], threads: [] };
    const two = { owner: 'Mara', inject: false, now: '11-12 21:30', contacts: [], calls: [], events: [], notes: [{ title: '실시간 메모', text: 'y' }], threads: [] };
    const m = { phones: { mara: one } };
    const before = PD.phoneBlock(m);
    assert.ok(before.includes('폰 1 메모'));
    // off on the live phone: letter for letter what it was
    assert.equal(block(m, [two]), before);
    assert.equal(block(m, []), before); assert.equal(block(m, null), before);
    two.inject = true;
    const both = block(m, [two]);
    assert.ok(both.startsWith(before));
    assert.match(both, /\n\n# PHONES NOW \(messenger\)\n_[^\n]+_\n## Mara's phone \(as of 11-12 21:30\)\n- Notes: 실시간 메모$/);
    // only the live phone on
    one.inject = false;
    const only = block(m, [two]);
    assert.ok(!only.includes('폰 1 메모') && !only.includes('# PHONES\n') && only.includes('# PHONES NOW (messenger)'));
    // 실시간 폰 한 대를 적는 방법은 폰 1과 같아요: 같은 폰을 폰 1 자리에 두면 제목만 달라요
    const rich = { owner: 'Mara', inject: true, now: '11-12 21:30', contacts: [{ name: 'Ivo', saved: '이보' }], calls: [{ with: 'Ivo', type: 'missed', time: '11-12 20:00' }], events: [{ date: '11-13', time: '10:00', title: '병원' }],
        notes: [{ title: '메모', text: 'y' }], threads: [{ with: 'Ivo', messages: [{ from: 'me', time: '11-12 19:00', text: '어디야' }, { from: 'Ivo', time: '11-12 19:01', text: '집' }] }] };
    const asOne = PD.phoneBlock({ phones: { mara: rich } }), asLive = N.liveNote([rich]);
    assert.ok(asOne.includes('Texts with Ivo') && asOne.includes('Missed calls') && asOne.includes('Calendar') && asOne.includes('Contacts saved'));
    assert.equal(asLive.slice(asLive.indexOf('\n## ')), asOne.slice(asOne.indexOf('\n## ')));
    assert.ok(asLive.startsWith(`\n\n${N.LIVE_NOTE_HEAD}\n## Mara's phone`));
    // 실시간 폰이 망가져 있어도 폰 1의 글은 그대로 나가요
    one.inject = true;
    assert.equal(block(m, [{ owner: 'X', inject: true }]), before);
    assert.equal(N.liveNote('x'), ''); assert.equal(N.liveNote(undefined), '');
});

test('폰 1의 롤플에 넣기(phonedata.js phoneBlock)는 폰 2 전 줄 그대로: 받는 건 메타 하나, 실시간 낱말이 없어요', async () => {
    const src = await readFile(new URL('../src/phonedata.js', import.meta.url), 'utf8'), i = src.indexOf('export function phoneBlock('), body = src.slice(i, src.indexOf('\n}\n', i));
    assert.ok(body.startsWith('export function phoneBlock(m) {'));
    assert.doesNotMatch(body, /live|messenger|PHONES NOW/);
    assert.ok(!src.includes('function phoneNote('));
    // 실시간 폰을 둘째 인자로 줘도 폰 1 함수는 안 봐요
    const one = { owner: 'Mara', inject: true, now: '10-26 12:00', contacts: [], calls: [], events: [], notes: [{ title: '폰 1 메모', text: 'x' }], threads: [] };
    assert.equal(PD.phoneBlock({ phones: { mara: one } }, [{ ...one, notes: [{ title: '실시간 메모', text: 'y' }] }]), PD.phoneBlock({ phones: { mara: one } }));
});

test('실시간 폰의 "지금"은 흐르는 시계예요: 이야기 날짜(dayShift) + 현실 시각. 마지막 반영 때에 멈춰 있지 않아요', () => {
    const c = world();
    c.p.now = '11-10 22:00';
    const d = L.liveMeta(c.real, { now: G.liveNowOf(c.real, () => Date.parse('2026-11-12T08:15:00Z')) });
    assert.equal(L.liveNowText(d, c.p), '11-12 08:15');
    L.liveWorld(c.real).dayShift = 3;
    assert.equal(L.liveNowText(d, c.p), '11-15 08:15');
    // a drawer given no clock, or the phone alone: the phone's own time, as before
    assert.equal(L.liveNowText(L.liveMeta(c.real), c.p), '11-10 22:00');
    assert.equal(L.liveNowText(null, L.livePhone(c.real, 'Mara')), '11-10 22:00');
});

test('채우기 · 다시 만들기가 읽는 요약은 반영된 데까지만: 아직 반영 안 된 대화의 요약은 안 들어가요 (같은 일이 두 번 안 들어가게)', () => {
    const c = world();
    const w = L.liveWorld(c.real), no = () => L.liveNo(w);
    for (let i = 0; i < 30; i++) c.room.messages.push({ id: `k${i}`, n: no(), from: i % 2 ? 'Mara' : 'Ren', text: `말 ${i + 1}`, at: 1000 + i });
    const n0 = c.room.messages[0].n;
    // two summaries: the first 10 messages, then the next 15 (the second one ends past what the phone has read)
    c.room.digest = { upto: n0 + 24, parts: [{ from: n0, to: n0 + 9, text: 'SUMMARY ONE (read)' }, { from: n0 + 10, to: n0 + 24, text: 'SUMMARY TWO: Ren paid 500 (not read yet)' }] };
    const seen = n0 + 14;
    const out = L.liveRecent(w, 'Mara', 150, { maxChars: 12000, seen, summary: true });
    assert.ok(out.includes('SUMMARY ONE (read)')); assert.ok(!out.includes('SUMMARY TWO'));
    // the lines after the summary it took, up to what was read: said word for word, none past it
    assert.ok(out.includes(': 말 11') && out.includes(': 말 15')); assert.ok(!out.includes(': 말 16') && !out.includes(': 말 10\n'));
    // (everything read: both summaries, then the lines after them)
    const all = L.liveRecent(w, 'Mara', 150, { maxChars: 12000, seen: n0 + 29, summary: true });
    assert.ok(all.includes('SUMMARY ONE') && all.includes('SUMMARY TWO') && all.includes(': 말 26') && !all.includes(': 말 25\n'));
});

test('이야기에서 시작할 때 폰 1의 "롤플에 넣기"는 안 따라와요: 실시간 폰에서 켠 적 없으면 프롬프트에 폰이 두 번 안 들어가요', () => {
    const real = { phones: { mara: { ...phone(), inject: true } }, text: '' };
    L.startFromStory(real, { persona: 'Ren', upto: 3, scope: 'test' }).snap = snapFor(real, 3);
    assert.equal(L.liveWorld(real).phones.mara.inject, false);
    assert.equal(real.phones.mara.inject, true);
    const before = PD.phoneBlock(real);
    assert.equal(block(real, Object.values(L.liveWorld(real).phones)), before);
});

test('실시간 폰 한 대의 연도를 고르면 다른 실시간 폰도 같은 만큼 옮겨지고, 반영 뒤에도 은행 날짜와 연도가 맞아요', async () => {
    const c = world();
    c.p.now = '11-10 22:00'; c.p.year = 2026;
    const ivo = { ...phone(), owner: 'Ivo', now: '11-10 22:00', year: 2026 };
    ivo.money.tx = [{ id: 't1', account: '1111', amount: -1000, who: '가게', time: '2026-11-09 09:00' }];
    c.m.phones.ivo = ivo;
    Y.liveSetStoryYear(c.m, c.p, 2030);
    const b = c.m.phones.ivo;
    assert.deepEqual([c.p.year, c.p.liveYearShift, b.year, b.liveYearShift, b.yearShift], [2030, 4, 2030, 4, undefined]);
    assert.equal(b.money.tx[0].time, '2030-11-09 09:00');
    // Ivo's next reflection keeps the year the records are in
    const room = L.ensureRoom(c.real, ['Ivo']);
    room.messages.push({ id: 'a', n: L.liveNo(L.liveWorld(c.real)), from: 'Ren', text: '안녕', at: Date.parse('2026-11-11T01:00:00Z') });
    T.answers = [{ events: [] }];
    assert.equal((await G.liveReflect(c.real, 'Ivo')).error, '');
    assert.equal(c.m.phones.ivo.year, 2030);
});

test('실시간 폰의 연도는 롤플 상태창에서 읽지 않아요: 폰만 주든 서랍만 주든 실제 연도 + 고른 차이', () => {
    const c = world(), y = new Date().getFullYear();
    assert.equal(Y.liveStoryYear(c.m, { ...c.p, year: 0 }), String(y));
    assert.equal(Y.liveStoryYear(c.m, { ...c.p, year: 0, liveYearShift: 3 }), String(y + 3));
    assert.equal(Y.liveStoryYear(c.m, { ...c.p, year: 0, noYear: true }), '');
    assert.equal(Y.liveStoryYear(c.m, { ...c.p, year: 2031 }), '2031');
    const q = { owner: 'X' }; assert.equal(Y.liveEnsureYear(c.m, q), true); assert.equal(q.year, y); assert.equal(Y.liveEnsureYear(c.m, q), false);
    const off = { owner: 'X', noYear: true }; assert.equal(Y.liveEnsureYear(c.m, off), false); assert.equal(off.year, undefined);
});

test('폰 1의 연도 바꾸기(phonedata.js setStoryYear)는 폰 2 전 줄 그대로: 실시간 낱말이 없고, 실시간 것은 서랍이 아니면 안 돌아요', async () => {
    const src = await readFile(new URL('../src/phonedata.js', import.meta.url), 'utf8'), i = src.indexOf('export function setStoryYear('), body = src.slice(i, src.indexOf('\n}\n', i));
    assert.doesNotMatch(body, /liveYear|phoneJournal|phoneUpto|isLivePhone/);
    assert.ok(body.includes('const scope = phoneChatScope(ctx()), owners'));
    // 실시간 것: 폰 1의 메타나 서랍 흉내로는 멈춰요 (폰 1의 기록 · 폰을 옮기지 않게)
    const real = { text: '', phones: { mara: { ...phone(), year: 2026 } } }, was = JSON.stringify(real);
    assert.throws(() => Y.liveSetStoryYear(real, real.phones.mara, 2030), /실시간 폰의 서랍이 아니에요/);
    assert.throws(() => Y.liveSetStoryYear({ ...real, phoneUpto: 3, phoneJournal: 'test' }, real.phones.mara, 2030), /실시간 폰의 서랍이 아니에요/);
    assert.equal(JSON.stringify(real), was);
});

// ---- 실시간 폰의 연도는 실시간 시계의 연도 (이야기 날짜로 옮긴 오늘의 연도) + 고른 차이
// 현실 2026-11-12, 이야기는 150일 앞(2027-04-11): 실시간 시계의 연도는 2027
const clockIn2027 = c => { L.liveWorld(c.real).dayShift = 150; return L.liveMeta(c.real, { now: G.liveNowOf(c.real, () => Date.parse('2026-11-12T08:15:00Z')) }); };

test('실시간 시계는 연도도 알려 줘요: 날짜를 옮긴 날의 연도', () => {
    const c = world(), at = () => Date.parse('2026-11-12T08:15:00Z');
    const now = G.liveNowOf(c.real, at);
    assert.equal(now(c.p), '11-12 08:15'); assert.equal(now.year(c.p), 2026);
    L.liveWorld(c.real).dayShift = 150;
    assert.equal(now(c.p), '04-11 08:15'); assert.equal(now.year(c.p), 2027);
    // 폰이 없으면 '' · 0
    assert.equal(now(null), ''); assert.equal(now.year(null), 0);
    // 서랍으로 읽기: 시계가 있는 서랍, 없는 서랍, 서랍 아닌 것, 시계가 터지는 서랍
    const d = L.liveMeta(c.real, { now });
    assert.equal(L.liveNowYear(d, d.phones.mara), 2027);
    assert.equal(L.liveNowYear(L.liveMeta(c.real), c.p), 0);
    assert.equal(L.liveNowYear(c.real, c.p), 0); assert.equal(L.liveNowYear(null, c.p), 0);
    const bad = () => '11-12 08:15'; bad.year = () => { throw new Error('x'); };
    assert.equal(L.liveNowYear(L.liveMeta(c.real, { now: bad }), c.p), 0);
});

test('연도가 없는 실시간 폰 · 연도 표시를 껐다 켤 때: 브라우저의 올해가 아니라 실시간 시계의 연도 (+ 고른 차이)', () => {
    const c = world(), d = clockIn2027(c), p = d.phones.mara;
    // (화면이 연도 표시를 켤 때 부르는 모양: 폰을 복사해서 year 0으로)
    assert.equal(Y.liveStoryYear(d, { ...p, year: 0 }), '2027');
    assert.equal(Y.liveStoryYear(d, { ...p, year: 0, liveYearShift: 3 }), '2030');
    assert.equal(Y.liveStoryYear(d, { ...p, year: 0, noYear: true }), '');
    assert.equal(Y.liveStoryYear(d, { ...p, year: 2031 }), '2031');
    // 연도가 없는 폰에 한 번 정하기
    const q = { owner: 'X' }; assert.equal(Y.liveEnsureYear(d, q), true); assert.equal(q.year, 2027);
    // (저장된 시각이 새해 전이면 그 시각의 연도)
    const q2 = { owner: 'X', now: '12-20 10:00' }; assert.equal(Y.liveEnsureYear(d, q2), true); assert.equal(q2.year, 2026);
    // 연도가 없는 폰에서 연도를 고르면: 차이는 실시간 시계의 연도에서
    delete p.year; delete p.liveYearShift;
    Y.liveSetStoryYear(d, p, 2029);
    // (고른 2029는 화면에 보이는 연도. 폰에 저장된 시각 11-10은 시계가 새해를 넘기기 전이라 폰의 연도는 한 해 전)
    assert.deepEqual([p.year, p.liveYearShift, Y.liveShownYear(d, p)], [2028, 2, 2029]);
    // 시계가 없는 서랍: 전처럼 브라우저의 올해
    const plain = L.liveMeta(c.real), y = new Date().getFullYear();
    assert.equal(Y.liveStoryYear(plain, { owner: 'Mara', year: 0 }), String(y));
});

test('실시간 화면을 열 때 연도 맞추기(liveYearsNow): 폰의 연도는 폰에 저장된 시각의 연도 (시계의 연도 + 고른 차이, 새해를 넘겼으면 한 해 전); 끈 폰은 그대로', () => {
    const c = world(), d = clockIn2027(c), p = d.phones.mara;
    d.phones.ivo = { ...phone(), owner: 'Ivo', year: 2026, liveYearShift: 4 };
    d.phones.off = { ...phone(), owner: 'Off', year: 2026, noYear: true };
    d.phones.none = { ...phone(), owner: 'None' }; delete d.phones.none.year;
    // (시계는 2027-04-11. 저장된 시각이 그 해 것인 폰, 전에 시계의 연도로 올려 둔 폰)
    d.phones.late = { ...phone(), owner: 'Late', now: '04-10 09:00', year: 2026 };
    d.phones.old = { ...phone(), owner: 'Old', year: 2027 };
    p.year = 2026; delete p.liveYearShift;
    const tx = JSON.stringify(p.money);
    assert.equal(Y.liveYearsNow(d), true);
    // 저장된 시각 11-10은 새해 전: 폰의 연도는 2026 그대로 (고른 차이 4면 2030). 화면에는 2027 · 2031
    assert.deepEqual([p.year, d.phones.ivo.year, d.phones.ivo.liveYearShift, d.phones.off.year, d.phones.off.noYear, d.phones.none.year, d.phones.late.year, d.phones.old.year], [2026, 2030, 4, 2026, true, 2026, 2027, 2026]);
    assert.deepEqual(['mara', 'ivo', 'off', 'none', 'late', 'old'].map(k => Y.liveShownYear(d, d.phones[k])), [2027, 2031, 2026, 2027, 2027, 2027]);
    // 기록 날짜는 안 옮겨요 (해가 넘어간 것이지 사용자가 연도를 바꾼 게 아니에요), 폰 1의 폰도 그대로
    assert.equal(JSON.stringify(p.money), tx);
    assert.equal(c.real.phones.mara.year, undefined);
    // 이미 맞으면 아무것도 안 바꿔요
    assert.equal(Y.liveYearsNow(d), false);
    // 화면의 연도는 반영이 쓰는 것과 같은 계산이에요: 시계의 연도 + 고른 차이
    assert.equal(Y.liveShownYear(d, d.phones.ivo), G.liveNowOf(c.real, () => Date.parse('2026-11-12T08:15:00Z')).year(d.phones.ivo) + 4);
    // 시계가 없는 서랍: 아무것도 안 바꿔요. 서랍이 아니면 멈춰요
    p.year = 2020;
    assert.equal(Y.liveYearsNow(L.liveMeta(c.real)), false); assert.equal(p.year, 2020);
    assert.throws(() => Y.liveYearsNow(c.real), /실시간 폰의 서랍이 아니에요/);
});

test('화면에 보이는 연도(liveShownYear): 흐르는 시계의 연도 + 고른 차이; 끈 폰은 폰에 있는 것, 시계 없는 서랍 · 막 가져온 폰은 저장된 시각의 연도에서', () => {
    const c = world(), d = clockIn2027(c), p = d.phones.mara;
    p.year = 2026; delete p.liveYearShift;
    assert.equal(Y.liveShownYear(d, p), 2027);
    p.liveYearShift = 3; assert.equal(Y.liveShownYear(d, p), 2030);
    assert.equal(Y.liveShownYear(d, { ...p, noYear: true }), 2026);
    // (막 가져온 폰: 저장된 시각 11-10의 연도 2026, 시계는 새해를 넘긴 04-11 → 2027. 저장된 시각이 같은 해면 그대로)
    assert.equal(Y.liveShownYear(d, { ...p, liveYearKeep: true }), 2027);
    assert.equal(Y.liveShownYear(d, { ...p, now: '04-10 09:00', liveYearKeep: true }), 2026);
    assert.equal(Y.liveShownYear(L.liveMeta(c.real), p), 2026);
    assert.equal(Y.liveShownYear(d, null), undefined);
    // 읽기만 해요
    assert.deepEqual([p.year, p.liveYearShift], [2026, 3]);
    // 화면을 열 때 맞춘 뒤: 폰의 연도 + (시계가 저장된 시각 뒤로 새해를 넘겼으면 1)
    Y.liveYearsNow(d);
    for (const q of Object.values(d.phones)) assert.equal(Y.liveShownYear(d, q), q.year + L.liveCross(q.now, d.phoneNow(q)));
    assert.deepEqual([p.year, Y.liveShownYear(d, p)], [2029, 2030]);
});

test('새해를 넘긴 뒤 다음 반영 전: 폰의 연도는 저장된 시각의 연도, 화면 · 흐르는 시계 쪽은 그 다음 해 (은행 날짜가 1년 뒤로 찍히던 것)', async () => {
    // liveCross: 저장된 시각 뒤로 시계가 새해를 넘겼나
    assert.equal(L.liveCross('12-30 21:00', '01-02 10:00'), 1);
    assert.equal(L.liveCross('11-10 22:00', '04-11 08:15'), 1);
    assert.equal(L.liveCross('12-30 21:00', '12-31 09:00'), 0);
    assert.equal(L.liveCross('12-30 21:00', '12-30 21:00'), 0);
    assert.equal(L.liveCross('03-01 10:00', '11-01 10:00'), 0);
    // (다른 시간대의 날짜라 저장된 날이 하루 이틀 앞선 것은 새해가 아니에요)
    assert.equal(L.liveCross('06-11 00:10', '06-10 23:00'), 0);
    assert.equal(L.liveCross('01-01 00:30', '12-31 23:50'), 0);
    assert.equal(L.liveCross('', '01-02 10:00'), 0); assert.equal(L.liveCross('12-30 21:00', ''), 0); assert.equal(L.liveCross(null, undefined), 0);
    // 마지막 반영 12-30 (2026), 지금 01-02 (2027)
    const clock = { at: '12-30 22:00', y: 2026 }, now = () => clock.at; now.year = () => clock.y;
    const real = { text: '', phones: { mara: { ...phone(), now: '12-30 21:00', year: 2026 } } };
    L.startFromStory(real, { persona: 'Ren', upto: 2, scope: 'test' }).snap = snapFor(real, 2);
    const d = L.liveMeta(real, { now }), p = d.phones.mara;
    Y.liveYearsNow(d);
    assert.deepEqual([p.year, p.liveYearShift, Y.liveShownYear(d, p)], [2026, undefined, 2026]);
    clock.at = '01-02 10:00'; clock.y = 2027;
    assert.equal(Y.liveYearsNow(d), false);
    assert.deepEqual([p.year, p.now, Y.liveShownYear(d, p)], [2026, '12-30 21:00', 2027]);
    // 폰 1의 은행 날짜 계산(wealth.js wealthDate, 진짜 줄 그대로): 저장된 시각 + 폰의 연도 → 2026-12-30
    const src = await readFile(new URL('../src/wealth.js', import.meta.url), 'utf8'), i = src.indexOf('export function wealthDate('), j = src.indexOf('\n}\n', i);
    assert.ok(i >= 0 && j > i);
    const wealthDate = new Function(`${src.slice(i, j + 2).replace('export function', 'return function')}`)();
    const bare = { ...p, money: { ...p.money } }; delete bare.money.fxDate; delete bare.investment;
    assert.equal(wealthDate({}, bare, bare.now), '2026-12-30');
    // (전에는 화면을 열 때 폰의 연도를 2027로 올려서 2027-12-30이 됐어요)
    assert.equal(wealthDate({}, { ...bare, year: 2027 }, bare.now), '2027-12-30');
    // 전에 올려 둔 폰은 화면을 열 때 저장된 시각의 연도로 돌아와요
    p.year = 2027;
    assert.equal(Y.liveYearsNow(d), true); assert.equal(p.year, 2026);
    // 흐르는 시계와 붙여 쓰는 곳은 그 시각의 연도로: 그 순간만 바꿨다가 바로 되돌려요
    assert.equal(L.liveYearFor(p, '01-02 10:00'), 2027); assert.equal(L.liveYearFor(p, '12-30 21:00'), 2026); assert.equal(L.liveYearFor({ ...p, noYear: true }, '01-02 10:00'), 2026);
    let seen = 0;
    assert.equal(L.liveAtYear(p, '01-02 10:00', () => { seen = p.year; return 'x'; }), 'x');
    assert.deepEqual([seen, p.year], [2027, 2026]);
    assert.throws(() => L.liveAtYear(p, '01-02 10:00', () => { throw new Error('boom'); }), /boom/); assert.equal(p.year, 2026);
    // 답장의 시계 글 · 채우기의 OWNER'S CLOCK: 01-02의 요일은 2027년 것 (토요일), 저장된 시각 12-30은 2026년 것 (수요일)
    assert.match(L.liveAtYear(p, '01-02 10:00', () => PD.phone2Clock(p, '01-02 10:00', d)), /Time now: 01-02 10:00 \(Sat\)/);
    assert.match(L.liveAtYear(p, '12-30 21:00', () => PD.phone2Clock(p, '12-30 21:00', d)), /Time now: 12-30 21:00 \(Wed\)/);
    assert.equal(p.year, 2026);
    // (그 두 곳이 실제로 그렇게 불러요: 답장의 시계 글, 채우기의 OWNER'S CLOCK)
    assert.ok((await readFile(new URL('../src/phone2go.js', import.meta.url), 'utf8')).includes('clock: (ph, at) => liveAtYear(ph, at, () => phone2Clock(ph, at, d0)),'));
    assert.ok((await readFile(new URL('../src/phone2req.js', import.meta.url), 'utf8')).includes('export const liveFillClock = (m, p, at, opts = {}) => liveAtYear(p, at, () => ownerClock(p, at, m, null, [], opts));'));
    // 연도를 고르면 (화면에 보이는 2027 → 2030): 폰의 연도는 저장된 시각 쪽 2029, 차이 3, 기록 날짜는 3년
    const asOf = p.money.asOf;
    assert.equal(Y.liveSetStoryYear(d, p, 2030), 3);
    assert.deepEqual([p.year, p.liveYearShift, Y.liveShownYear(d, p), p.money.asOf], [2029, 3, 2030, `${Number(asOf.slice(0, 4)) + 3}${asOf.slice(4)}`]);
    // 같은 연도를 다시 고르면 아무것도 안 움직여요
    assert.equal(Y.liveSetStoryYear(d, p, 2030), 0); assert.deepEqual([p.year, p.liveYearShift], [2029, 3]);
    // 폰 1의 폰은 그대로
    assert.equal(real.phones.mara.year, 2026);
});

test('이야기의 12-31에 시작해서 실시간 시계가 바로 새해인 폰: 가져온 연도는 그대로, 화면은 새해', () => {
    const now = () => '01-01 09:00'; now.year = () => 2027;
    const real = { text: '', phones: { mara: { ...phone(), now: '12-31 15:00', year: 2026 }, ivo: { ...phone(), owner: 'Ivo', now: '12-31 15:00', year: 2029 } } };
    L.startFromStory(real, { persona: 'Ren', upto: 2, scope: 'test' }).snap = snapFor(real, 2);
    const d = L.liveMeta(real, { now });
    assert.deepEqual([Y.liveShownYear(d, d.phones.mara), Y.liveShownYear(d, d.phones.ivo)], [2027, 2030]);
    Y.liveYearsNow(d);
    assert.deepEqual(['mara', 'ivo'].map(k => [d.phones[k].year, d.phones[k].liveYearShift, Y.liveShownYear(d, d.phones[k])]), [[2026, undefined, 2027], [2029, 3, 2030]]);
});

test('이야기에서 가져온 폰의 연도는 지켜요: 시계의 연도와 다른 폰은 그만큼 떨어진 채로 (화면을 열 때 · 새해 · 연도 고르기)', () => {
    const at = { ms: Date.parse('2026-11-12T08:15:00Z') };
    const start = () => {
        const real = { text: '', phones: { mara: { ...phone(), year: 2026 }, ivo: { ...phone(), owner: 'Ivo', year: 2029, yearSet: true }, off: { ...phone(), owner: 'Off', year: 2029, noYear: true }, none: { ...phone(), owner: 'None', year: undefined } } };
        L.startFromStory(real, { persona: 'Ren', upto: 2, scope: 'test' }).snap = snapFor(real, 2);
        return { real, d: L.liveMeta(real, { now: G.liveNowOf(real, () => at.ms) }) };
    };
    {
        const { real, d } = start(), p1 = JSON.stringify(real.phones), money = JSON.stringify(d.phones.ivo.money);
        // 화면을 열 때: 시계는 2026. 2029에 있던 폰은 2029 그대로 (3년 차이로 남아요), 기록 날짜도 그대로
        Y.liveYearsNow(d);
        assert.deepEqual(['mara', 'ivo', 'off', 'none'].map(k => [d.phones[k].year, d.phones[k].liveYearShift, d.phones[k].liveYearKeep]), [[2026, undefined, undefined], [2029, 3, undefined], [2029, undefined, undefined], [2026, undefined, undefined]]);
        assert.equal(JSON.stringify(d.phones.ivo.money), money);
        // 시계가 새해를 넘기면: 화면은 둘 다 한 해씩, 폰의 연도는 저장된 시각(11-10)의 연도 그대로
        L.liveWorld(real).dayShift = 150;
        assert.equal(Y.liveYearsNow(d), false);
        assert.deepEqual([d.phones.mara.year, d.phones.ivo.year, d.phones.off.year], [2026, 2029, 2029]);
        assert.deepEqual([Y.liveShownYear(d, d.phones.mara), Y.liveShownYear(d, d.phones.ivo)], [2027, 2030]);
        assert.equal(JSON.stringify(real.phones), p1);
    }
    {
        // 반영이 먼저 와도 같아요 (같은 계산: liveYearAt)
        const { d } = start();
        assert.equal(L.liveYearAt(d.phones.ivo, 2026), 2029); assert.equal(d.phones.ivo.liveYearShift, 3);
        assert.equal(L.liveYearAt(d.phones.mara, 2026), 2026); assert.equal(d.phones.mara.liveYearShift, undefined);
        assert.equal(L.liveYearAt(d.phones.ivo, 2027), 2030);
    }
    {
        // 화면을 열기 전에 연도를 고르면: 가져온 연도를 먼저 적어 두고, 다른 폰도 같은 햇수만큼
        const { d } = start();
        Y.liveSetStoryYear(d, d.phones.mara, 2028);
        assert.deepEqual([d.phones.mara.year, d.phones.mara.liveYearShift, d.phones.ivo.year, d.phones.ivo.liveYearShift], [2028, 2, 2031, 5]);
        Y.liveYearsNow(d);
        assert.deepEqual([d.phones.mara.year, d.phones.ivo.year], [2028, 2031]);
    }
    {
        // 전에 시작한 실시간 폰(표시가 없음)은 전처럼 시계의 연도 + 고른 차이
        const { d } = start();
        delete d.phones.ivo.liveYearKeep;
        Y.liveYearsNow(d);
        assert.equal(d.phones.ivo.year, 2026);
    }
});

// ---- 롤플이 더 진행됐을 때 (요약본으로 시작한 폰): 답장 전에 요약본을 지금 끝까지 늘려요
const SNAP0 = { v: 1, at: 1, upto: 3, text: '## #0–#3 — start\n- a\n', recent: ['[#3] Mara: see you'], made: { from: 0, to: 3, count: 4, parts: 1 } };
const SNAP1 = { v: 1, at: 2, upto: 40, text: '## #0–#3 — start\n- a\n\n## #4–#40 — later\n- b\n', recent: ['[#40] Ren: the train is late'], made: { from: 4, to: 40, count: 37, parts: 1 } };
function snapWorld() {
    const c = world(), w = L.liveWorld(c.real);
    w.from = 'story'; w.storyUpto = 3; w.snap = structuredClone(SNAP0);
    Object.assign(T, { tail: { lines: ['[#39] Mara: hurry', '[#40] Ren: the train is late'], first: 39, end: 40 }, extend: structuredClone(SNAP1), extends: 0, story: '' });
    T.metadata = { narrative_archive: c.real };
    return { ...c, w };
}
const said = (c, text) => { send(c, text); T.replies = [{ state: '집', reply: ['응'], does: [] }]; };

test('롤플이 끝 메시지들에 다 안 담길 만큼 진행됐으면: 답장 전에 요약본을 한 번 늘리고 저장, 답장에는 지금의 끝 메시지', async () => {
    const c = snapWorld();
    said(c, '어디야');
    let busySeen = false;
    T.extend = async (m, snap) => { busySeen = G.liveSnapBusy(c.real); assert.equal(m, c.real); assert.deepEqual(snap, SNAP0); return structuredClone(SNAP1); };
    const saves = T.saves;
    await G.liveGo(c.real);
    assert.equal(T.extends, 1);
    assert.ok(busySeen && !G.liveSnapBusy(c.real));
    assert.deepEqual(c.w.snap, SNAP1);
    assert.ok(T.saves > saves);
    assert.ok(T.replyInput.includes('[LAST MESSAGES]\nMara: hurry\n\nRen: the train is late'));
    assert.equal(c.w.storyUpto, 3);   // (the messenger's numbers start where they did)
    // 그 뒤 답장: 더 진행되지 않았으면 다시 안 늘려요
    said(c, '알겠어');
    await G.liveGo(c.real);
    assert.equal(T.extends, 1);
    delete T.metadata;
});

test('끝 메시지들에 다 담기면 · 롤플이 그대로면 · 새로 시작한 폰이면 안 늘려요', async () => {
    for (const set of [c => { T.tail = { lines: ['[#4] Ren: hi', '[#5] Mara: hey'], first: 4, end: 5 }; }, c => { T.tail = { lines: ['[#3] Mara: see you'], first: 3, end: 3 }; }, c => { T.tail = { lines: ['[#1] Ren: x'], first: 1, end: 1 }; },
        c => { c.w.from = 'fresh'; }]) {
        const c = snapWorld(); set(c);
        said(c, '어디야');
        await G.liveGo(c.real);
        assert.equal(T.extends, 0);
        assert.equal(c.room.messages.at(-1).text, '응');
    }
    delete T.metadata;
});

test('늘리기가 실패해도 답장은 가요(가진 요약본 + 지금의 끝 메시지). 롤플이 더 진행될 때까지 다시 하지 않아요', async () => {
    const c = snapWorld();
    T.extend = new Error('모델이 답을 안 줬어요');
    said(c, '어디야');
    await G.liveGo(c.real);
    assert.equal(T.extends, 1);
    assert.deepEqual(c.w.snap, SNAP0);
    assert.equal(c.w.snapTried, 40);
    assert.equal(c.room.messages.at(-1).text, '응');
    assert.ok(T.replyInput.includes('[LAST MESSAGES]\nMara: hurry\n\nRen: the train is late'));
    said(c, '아직?');
    await G.liveGo(c.real);
    assert.equal(T.extends, 1);
    // 롤플이 더 진행됐으면 다시 해요
    T.tail = { lines: ['[#44] Ren: here'], first: 44, end: 44 }; T.extend = { ...structuredClone(SNAP1), upto: 44 };
    said(c, '왔어?');
    await G.liveGo(c.real);
    assert.equal(T.extends, 2);
    assert.equal(c.w.snap.upto, 44);
    assert.ok(!('snapTried' in c.w));
    delete T.metadata;
});

test('늘리는 동안 실시간 폰이 새로 시작됐으면 그 폰에는 안 써요', async () => {
    const c = snapWorld();
    said(c, '어디야');
    T.extend = async () => { c.w.snap = structuredClone({ ...SNAP0, upto: 50 }); return structuredClone(SNAP1); };
    await G.liveGo(c.real);
    assert.equal(c.w.snap.upto, 50);
    delete T.metadata;
});

test('요약본 없이 시작해 둔 폰: 첫 답장 전에 지금 이야기의 끝까지 요약본을 만들어 넣어요. 못 만들면 답장을 안 받고(실패로 남아요), 다시 하면 다시 만들어요', async () => {
    const c = snapWorld(); delete c.w.snap;
    T.starts = 0; T.start = async m => { assert.equal(m, c.real); assert.ok(G.liveSnapBusy(c.real)); return { snap: structuredClone(SNAP1), upto: 40, chat: 'c1', fp: 'x' }; };
    said(c, '어디야');
    const saves = T.saves;
    await G.liveGo(c.real);
    assert.deepEqual([T.starts, T.extends], [1, 0]);
    assert.deepEqual(c.w.snap, SNAP1);
    assert.ok(T.saves > saves && !G.liveSnapBusy(c.real));
    assert.equal(c.w.storyUpto, 3);
    assert.ok(T.replyInput.includes('[LAST MESSAGES]\nMara: hurry\n\nRen: the train is late'));
    said(c, '알겠어');
    await G.liveGo(c.real);
    assert.deepEqual([T.starts, T.extends], [1, 0]);
    // 못 만들면: 모델에게 답장을 묻지 않아요. 일은 실패로 남고, 폰에는 아무것도 안 생겨요
    const d = snapWorld(); delete d.w.snap;
    T.starts = 0; T.start = new Error('모델이 답을 안 줬어요');
    said(d, '어디야');
    const asked = T.replyCalls, r = await G.liveGo(d.real);
    assert.equal(T.starts, 1);
    assert.equal(T.replyCalls, asked);
    assert.ok(!('snap' in d.w) && !('snapTried' in d.w));
    assert.equal(d.room.messages.at(-1).text, '어디야');
    assert.match(r.failed.error, /이야기 요약본을 만들지 못했어요/);
    // 다시 (롤플이 그대로여도): 다시 만들어요
    T.start = { snap: structuredClone(SNAP1) }; T.replies = [{ state: '집', reply: ['응'], does: [] }];
    L.seeFailure(d.real, r.failed.job.id); L.enqueueReplies(d.real, d.room.id);   // (방의 "다시" 버튼이 하는 일)
    await G.liveGo(d.real);
    assert.equal(T.starts, 2);
    assert.equal(d.w.snap.upto, 40);
    assert.equal(d.room.messages.at(-1).text, '응');
    // 처음부터 시작한 폰은 요약본을 안 만들어요
    const f = snapWorld(); delete f.w.snap; f.w.from = 'fresh'; T.starts = 0;
    said(f, '어디야');
    await G.liveGo(f.real);
    assert.equal(T.starts, 0);
    assert.equal(f.room.messages.at(-1).text, '응');
    delete T.metadata; delete T.start;
});

test('앱 요청(채우기 · 다시 만들기)이 서랍으로 요약본을 달라고 하면: 없는 폰은 만들어 주고, 있는 폰은 늘리지 않아요', async () => {
    const c = snapWorld(); delete c.w.snap;
    T.starts = 0; T.start = { snap: structuredClone(SNAP1) };
    const d = L.liveMeta(c.real);
    assert.equal(d.text, '');
    await d.phoneStoryReady();
    assert.deepEqual([T.starts, T.extends], [1, 0]);
    assert.equal(d.text, SNAP1.text);
    // (요약본이 있으면: 롤플이 많이 진행됐어도 여기서는 안 늘려요. 늘리는 건 답장 전이에요)
    T.tail = { lines: ['[#90] Ren: far'], first: 90, end: 90 };
    assert.equal(d.phoneStoryReady(), null);
    await Q.liveStoryReady(d);
    assert.deepEqual([T.starts, T.extends], [1, 0]);
    delete T.metadata; delete T.start;
});

// ---- 메신저에서 나눈 이야기를 롤플에 전하기 (버튼을 눌렀을 때만): 글 받기 → 보여 주기 → 넣기
function backWorld() {
    const c = snapWorld();
    send(c, '금요일에 올 거지?');
    c.room.messages.push({ id: 'b1', from: 'Mara', text: '갈게. 열쇠 챙겨 와.', at: Date.now() + 1, state: '사무실 · 짐 싸는 중' });
    L.numberLive(c.w);
    T.chat = [{ name: 'Ren', is_user: true, mes: 'earlier' }, { name: 'Mara', mes: 'later' }];
    T.tail = { lines: ['[#0 · USER] Ren: earlier', '[#1] Mara: later'], first: 0, end: 1 };
    const st = { shown: [], emits: [], saves: 0 };
    T.st = { addOneMessage: x => st.shown.push(x), saveChat: async () => { st.saves++; }, eventSource: { emit: async (...a) => { st.emits.push(a); } }, eventTypes: { MESSAGE_SENT: 'message_sent', USER_MESSAGE_RENDERED: 'user_message_rendered' }, humanizedDateTime: () => 'STAMP' };
    return { ...c, st };
}
const backDone = () => { delete T.st; delete T.ask; delete T.metadata; T.chat = []; };

test('롤플에 전하기 1) 글 받기: 아직 안 전한 메신저 대화와 롤플의 끝 메시지로 요청 1번, 아무것도 안 바꿔요', async () => {
    try {
        const c = backWorld(), asked = [];
        T.ask = async (input, o) => { asked.push([o.system, input]); return '{ "note": "마라는 금요일에 오기로 했고, 렌에게 열쇠를 챙겨 오라고 했다." }'; };
        assert.equal(G.liveBackCount(c.real), 2);
        const was = JSON.stringify([c.real, T.chat]);
        const d = await G.liveBackDraft(c.real);
        assert.equal(asked.length, 1);
        assert.ok(asked[0][0].startsWith('GOAL\nThe story\'s characters also text each other on a messenger') && asked[0][0].includes('Ren is a person in the story'));
        assert.match(asked[0][1], /^\[MESSENGER\]\n— Ren · Mara —\n\d{2}-\d{2} \d{2}:\d{2} · Ren: 금요일에 올 거지\?\n\d{2}-\d{2} \d{2}:\d{2} · Mara \(사무실 · 짐 싸는 중\): 갈게\. 열쇠 챙겨 와\.\n\n\[LAST MESSAGES\]\nRen: earlier\n\nMara: later$/);
        assert.equal(d.text, '*(그동안 메신저에서)*\n\n마라는 금요일에 오기로 했고, 렌에게 열쇠를 챙겨 오라고 했다.');
        assert.deepEqual([d.count, d.more, d.world], [2, 0, c.w.id]);
        assert.equal(JSON.stringify([c.real, T.chat]), was);
        assert.deepEqual([c.st.shown.length, c.st.saves], [0, 0]);
        // 모델이 글을 안 주면 오류 (아무것도 안 바뀜)
        T.ask = async () => '{}';
        await assert.rejects(() => G.liveBackDraft(c.real), /전할 글을 찾지 못했어요/);
        assert.equal(JSON.stringify([c.real, T.chat]), was);
    } finally { backDone(); }
});

test('롤플에 전하기 2) 넣기: 롤플 채팅 맨 끝에 해설 메시지 하나, 실었던 말에 전했다고 표시, 채팅과 폰을 저장. 같은 말은 다시 안 전해요', async () => {
    try {
        const c = backWorld();
        // (the answer in a code fence, as a real model gave it)
        T.ask = async () => '```json\n{ "note": "Mara agreed to come on Friday." }\n```';
        const d = await G.liveBackDraft(c.real), saves = T.saves, p1 = JSON.stringify(c.real.phones);
        // (그사이 새 말이 왔어요: 이번 글에 없는 말)
        send(c, '그리고 하나 더');
        const at = await G.liveBackPut(c.real, d, '*(그동안 메신저에서)*\n\n고친 글이에요.  ');
        assert.equal(at, 2);
        assert.equal(T.chat.length, 3);
        assert.deepEqual(T.chat[2], { name: 'System', is_user: false, is_system: false, send_date: 'STAMP', mes: '*(그동안 메신저에서)*\n\n고친 글이에요.', force_avatar: 'img/five.png', extra: { ...T.chat[2].extra, type: 'narrator', api: 'manual', model: 'narrative-archive' } });
        assert.deepEqual(c.st.shown, [T.chat[2]]);
        assert.deepEqual(c.st.emits, [['message_sent', 2], ['user_message_rendered', 2]]);
        assert.equal(c.st.saves, 1); assert.ok(T.saves > saves);
        assert.deepEqual(c.room.messages.map(x => !!x.told), [true, true, false]);
        assert.equal(G.liveBackCount(c.real), 1);
        assert.equal(JSON.stringify(c.real.phones), p1);
        // 고치지 않으면 받은 글 그대로; 다 전한 뒤에는 요청도 안 해요
        const d2 = await G.liveBackDraft(c.real);
        await G.liveBackPut(c.real, d2);
        assert.equal(T.chat[3].mes, '*(Meanwhile, on the messenger)*\n\nMara agreed to come on Friday.');
        let asked = 0; T.ask = async () => { asked++; return '{}'; };
        await assert.rejects(() => G.liveBackDraft(c.real), /전할 새 메신저 대화가 없어요/);
        assert.equal(asked, 0);
    } finally { backDone(); }
});

test('롤플에 전하기: 그사이 실시간 폰이 바뀌었거나 · 글이 비었거나 · 넣을 길이 없으면 아무것도 안 넣고 표시도 안 해요', async () => {
    try {
        const c = backWorld();
        T.ask = async () => '{ "note": "Mara agreed to come on Friday." }';
        const d = await G.liveBackDraft(c.real);
        const clean = () => { assert.equal(T.chat.length, 2); assert.ok(c.room.messages.every(x => !x.told)); assert.equal(c.st.saves, 0); };
        await assert.rejects(() => G.liveBackPut(c.real, d, '   '), /넣을 글이 비어 있어요/); clean();
        await assert.rejects(() => G.liveBackPut(c.real, { ...d, world: 'other' }), /채팅이나 실시간 폰이 바뀌었어요/); clean();
        await assert.rejects(() => G.liveBackPut(c.real, null), /채팅이나 실시간 폰이 바뀌었어요/); clean();
        const add = T.st.addOneMessage; delete T.st.addOneMessage;
        await assert.rejects(() => G.liveBackPut(c.real, d), /롤플 채팅에 넣을 수 없어요/); clean();
        T.st.addOneMessage = add;
        // 다른 채팅이 열려 있으면
        T.metadata = { narrative_archive: {} };
        await assert.rejects(() => G.liveBackPut(c.real, d), /채팅이나 실시간 폰이 바뀌었어요/); clean();
        await assert.rejects(() => G.liveBackDraft(c.real), /이 채팅의 실시간 폰이 아니에요/);
        T.metadata = { narrative_archive: c.real };
        // 이벤트를 받는 쪽이 실패해도 메시지는 들어가요
        T.st.eventSource.emit = async () => { throw new Error('listener'); };
        assert.equal(await G.liveBackPut(c.real, d), 2);
        assert.equal(T.chat.length, 3); assert.ok(c.room.messages.every(x => x.told));
    } finally { backDone(); }
});

// ---- 메신저 모양으로 쓴 채팅을 실시간 폰의 메신저로 가져오기 (버튼을 눌렀을 때만, 모델은 안 불러요)
const stampDiv = t => `<div class="chat-timestamp" style="opacity:.5;">${t}</div>`;
function importChat() {
    const real = { phones: {} };
    T.chat = [{ name: 'Ren', is_user: true, send_date: '2026-11-20T07:27:59.000Z', mes: 'Mara\n\n' },
        { name: 'Mara', is_user: false, send_date: '2026-11-20T07:28:07.000Z', mes: `${stampDiv('11.20, 16:28')}\n\nYes?\n\nWhat is it` }];
    T.metadata = { narrative_archive: real, integrity: 'chat-1' };
    T.st = { name1: 'Ren' };
    Object.assign(T, { calls: 0, replyCalls: 0, saves: 0 });
    return real;
}
const importDone = () => { delete T.st; delete T.metadata; delete T.ask; T.chat = []; };

test('채팅 가져오기: 실시간 폰이 없으면 이야기 없이 시작한 폰을 만들고, 열어 둔 채팅을 방에 통째로 넣고 저장해요. 모델은 안 불러요', async () => {
    try {
        const real = importChat();
        let asked = 0; T.ask = async () => { asked++; return '{}'; };
        assert.deepEqual(G.liveImportPlan(real), { messages: 2, bubbles: 3, again: false });
        assert.equal(real.live, undefined);
        const out = await G.liveImportChat(real, { scope: 'test' });
        const w = L.liveWorld(real), room = w.messenger.rooms[out.room];
        assert.deepEqual([out.started, out.count, out.messages, out.from, out.to], [true, 3, 2, 0, 1]);
        assert.deepEqual([w.from, w.persona, w.scope, w.storyUpto, w.snap], ['fresh', 'Ren', 'test', null, undefined]);
        assert.deepEqual(room.messages.map(x => [x.from, x.text]), [['Ren', 'Mara'], ['Mara', 'Yes?'], ['Mara', 'What is it']]);
        assert.ok(room.messages.every(x => x.told));
        assert.deepEqual(Object.keys(w.imports), ['chat-1']); assert.equal(w.imports['chat-1'].upto, 1);
        assert.ok(T.saves >= 1); assert.equal(asked, 0);
        // 롤플에 전할 말로 세지 않고, 이야기 요약본도 안 찾아요
        assert.equal(G.liveBackCount(real), 0);
        const d = L.liveMeta(real);
        await Q.liveStoryReady(d);
        // 나중에 만드는 폰은 가져온 말을 이미 읽은 것으로 시작해요 (요청에는 그 말이 보여요)
        assert.equal(Q.liveWindowOf(d, null).mark, w.importTop);
        assert.equal(Q.liveWindowOf(d, { owner: 'Mara' }).mark, w.importTop);
        assert.ok((await Q.liveSideRequest(d, 'Mara', [], { read: {} })).includes('Mara: What is it'));
    } finally { importDone(); }
});

test('채팅 가져오기: 다시 누르면 그 뒤에 온 메시지만. 새 메시지가 없으면 알려 주고 아무것도 안 바꿔요', async () => {
    try {
        const real = importChat();
        await G.liveImportChat(real);
        assert.deepEqual(G.liveImportPlan(real), { messages: 0, bubbles: 0, again: true });
        const was = JSON.stringify(real);
        await assert.rejects(() => G.liveImportChat(real), /새로 가져올 메시지가 없어요/);
        assert.equal(JSON.stringify(real), was);
        T.chat.push({ name: 'Ren', is_user: true, send_date: '2026-11-20T08:00:00.000Z', mes: 'Lunch?' });
        assert.deepEqual(G.liveImportPlan(real), { messages: 1, bubbles: 1, again: true });
        const out = await G.liveImportChat(real);
        assert.deepEqual([out.started, out.count, out.from, out.to], [false, 1, 2, 2]);
        const room = L.liveWorld(real).messenger.rooms[out.room];
        assert.deepEqual(room.messages.map(x => x.text), ['Mara', 'Yes?', 'What is it', 'Lunch?']);
        assert.equal(L.liveWorld(real).imports['chat-1'].count, 4);
        // 다른 채팅에서는 처음부터 다시 가져와요
        T.metadata.integrity = 'chat-2';
        assert.deepEqual(G.liveImportPlan(real), { messages: 3, bubbles: 4, again: false });
    } finally { importDone(); }
});

test('채팅 가져오기: 가져올 게 없거나 · 메신저 모양 메시지가 없거나 · 페르소나 이름을 모르거나 · 다른 채팅이 열려 있으면 실시간 폰을 안 만들어요', async () => {
    try {
        const real = importChat();
        const none = async (set, re) => { set(); await assert.rejects(() => G.liveImportChat(real), re); assert.equal(real.live, undefined); assert.equal(T.saves, 0); };
        await none(() => { T.chat = [{ name: 'Ren', is_user: true, send_date: '2026-11-20T07:27:59.000Z', mes: 'only me' }]; }, /메신저 모양으로 쓴 메시지가 없어요/);
        // 보통 장면만 있는 채팅 (시간 칸이 없는 캐릭터 메시지): 메신저가 아니에요
        await none(() => { T.chat = [{ name: 'Ren', is_user: true, send_date: '2026-11-20T07:27:59.000Z', mes: 'I walked in.' }, { name: 'Mara', is_user: false, send_date: '2026-11-20T07:28:07.000Z', mes: 'She looked up.\n\n"You are late."' }]; }, /메신저 모양으로 쓴 메시지가 없어요/);
        assert.deepEqual(G.liveImportPlan(real), { messages: 0, bubbles: 0, again: false });
        await none(() => { T.chat = [{ name: 'Mara', is_user: false, is_system: true, mes: 'hidden' }]; }, /가져올 메시지가 없어요/);
        await none(() => { importChat(); Object.assign(real, { phones: {} }); T.metadata.narrative_archive = real; delete T.st.name1; }, /페르소나 이름이 필요해요/);
        await none(() => { T.st.name1 = 'Ren'; T.metadata.narrative_archive = {}; }, /이 채팅이 열려 있지 않아요/);
        assert.deepEqual(G.liveImportPlan(real), { messages: 0, bubbles: 0, again: false });
        // 이미 있는 실시간 폰에 가져오다 실패해도 그 폰은 그대로
        T.metadata.narrative_archive = real;
        await G.liveImportChat(real);
        const was = JSON.stringify(real.live);
        T.chat.push({ name: 'Ren', is_user: true, send_date: '2026-11-20T09:00:00.000Z', mes: 'x' });
        const save = T.saves; T.metadata.integrity = 'chat-9'; T.chat = [{ name: 'Ren', is_user: true, send_date: '2026-11-20T09:00:00.000Z', mes: 'only me again' }];
        await assert.rejects(() => G.liveImportChat(real), /메신저 모양으로 쓴 메시지가 없어요/);
        assert.equal(JSON.stringify(real.live), was); assert.equal(T.saves, save);
    } finally { importDone(); }
});

// 내보낸 채팅 파일(.jsonl): 그 파일의 메시지 전부 (시간 칸이 없어도). 메신저로만 쓴 채팅을 고르는 길이에요
const jsonl = (meta, msgs) => [JSON.stringify({ chat_metadata: meta, user_name: 'unused', character_name: 'unused' }), ...msgs.map(x => JSON.stringify(x)), ''].join('\n');
const FILE = () => jsonl({ integrity: 'file-1' }, [
    { name: 'Ren', is_user: true, send_date: '2026-11-18T10:00:00.000Z', mes: 'You up?' },
    { name: 'Ivo', is_user: false, send_date: '2026-11-18T10:00:30.000Z', mes: 'Barely\n\nWhat do you need' },
    { name: 'System', is_user: false, send_date: '2026-11-18T10:01:00.000Z', mes: 'a note', extra: { type: 'narrator' } },
    { name: 'Ivo', is_user: false, is_system: true, send_date: '2026-11-18T10:02:00.000Z', mes: 'hidden' },
    { name: 'Ren', is_user: true, send_date: '2026-11-18T10:03:00.000Z', mes: 'A lift on Friday' }]);

test('파일에서 가져오기: 시간 칸이 없어도 그 파일의 메시지 전부(숨긴 것 · 해설만 빼고), 시간은 기록된 순간. 지금 열어 둔 채팅의 실시간 폰으로', async () => {
    try {
        const real = importChat();
        let asked = 0; T.ask = async () => { asked++; return '{}'; };
        assert.deepEqual(G.liveImportFilePlan(real, FILE()), { messages: 3, bubbles: 4, again: false, names: ['Ivo'] });
        assert.equal(real.live, undefined);
        const out = await G.liveImportFile(real, FILE(), { scope: 'test' });
        const w = L.liveWorld(real), room = w.messenger.rooms[out.room];
        assert.deepEqual([out.started, out.count, out.messages], [true, 4, 3]);
        assert.deepEqual(room.members, ['Ren', 'Ivo']);
        assert.deepEqual(room.messages.map(x => [x.from, x.text, new Date(x.at).toISOString()]), [['Ren', 'You up?', '2026-11-18T10:00:00.000Z'], ['Ivo', 'Barely', '2026-11-18T10:00:30.000Z'],
            ['Ivo', 'What do you need', '2026-11-18T10:00:30.001Z'], ['Ren', 'A lift on Friday', '2026-11-18T10:03:00.000Z']]);
        assert.equal(asked, 0); assert.ok(T.saves >= 1);
        // 같은 파일을 다시: 새 메시지만. 없으면 알려 줘요
        assert.deepEqual(G.liveImportFilePlan(real, FILE()), { messages: 0, bubbles: 0, again: true, names: [] });
        await assert.rejects(() => G.liveImportFile(real, FILE()), /새로 가져올 메시지가 없어요/);
        const more = FILE() + JSON.stringify({ name: 'Ivo', is_user: false, send_date: '2026-11-18T10:04:00.000Z', mes: 'Fine' }) + '\n';
        assert.equal((await G.liveImportFile(real, more)).count, 1);
        assert.equal(room.messages.at(-1).text, 'Fine');
        // 열어 둔 채팅도 따로 가져올 수 있고(다른 채팅), 그 뒤에도 파일은 어디까지 가져왔는지 기억해요
        const mine = await G.liveImportChat(real);
        assert.notEqual(mine.room, out.room);
        assert.deepEqual(Object.keys(w.imports).sort(), ['chat-1', 'file-1']);
        assert.deepEqual(G.liveImportFilePlan(real, more), { messages: 0, bubbles: 0, again: true, names: [] });
        assert.deepEqual(G.liveImportPlan(real), { messages: 0, bubbles: 0, again: true });
    } finally { importDone(); }
});

test('파일에서 가져오기: 채팅 파일이 아니거나 메시지가 없으면 아무것도 안 바꿔요; 채팅 표시가 없는 파일도 같은 파일인지 알아봐요', async () => {
    try {
        const real = importChat();
        for (const bad of ['', 'not a chat file', '{"chat_metadata":{}}\n', '[1,2,3]\n{broken']) {
            await assert.rejects(() => G.liveImportFile(real, bad), /메시지를 찾지 못했어요/);
            assert.throws(() => G.liveImportFilePlan(real, bad), /메시지를 찾지 못했어요/);
            assert.equal(real.live, undefined);
        }
        await assert.rejects(() => G.liveImportFile(real, jsonl({}, [{ name: 'Ren', is_user: true, send_date: '2026-11-18T10:00:00.000Z', mes: 'only me' }])), /캐릭터가 한 말이 없어서/);
        assert.equal(real.live, undefined);
        // (표시가 없는 옛 파일: 첫 메시지로 가려요)
        const old = jsonl({}, [{ name: 'Ivo', is_user: false, send_date: '2026-11-18T10:00:00.000Z', mes: 'Hi' }]);
        await G.liveImportFile(real, old);
        assert.deepEqual(G.liveImportFilePlan(real, old), { messages: 0, bubbles: 0, again: true, names: [] });
        assert.equal(G.liveImportFilePlan(real, jsonl({}, [{ name: 'Ivo', is_user: false, send_date: '2026-11-19T10:00:00.000Z', mes: 'Other chat' }])).again, false);
        // 깨진 줄이 섞여 있어도 읽을 수 있는 줄은 가져와요
        assert.equal(G.liveImportFilePlan(real, `${jsonl({ integrity: 'f2' }, [{ name: 'Ivo', is_user: false, send_date: '2026-11-18T10:00:00.000Z', mes: 'One' }])}{broken\n${JSON.stringify({ name: 'Ivo', is_user: false, send_date: '2026-11-18T10:01:00.000Z', mes: 'Two' })}`).messages, 2);
    } finally { importDone(); }
});


test('말 지우기: 메신저에서만 지우고 저장해요. 이미 반영된 폰 · 롤플에 전한 표시는 그대로', async () => {
    const c = world();
    send(c, '일어났냐');
    T.replies = [{ state: '집', reply: ['방금', '왜'], ko: ['방금', '왜'], does: [] }];
    await G.liveGo(c.real);
    const [mine, a, b] = c.room.messages, phone = JSON.stringify(c.p), saves = T.saves;
    assert.equal(await G.liveDropMessages(c.real, c.room.id, [a.id, 'none']), 1);
    assert.deepEqual(c.room.messages, [mine, b]);
    assert.equal(T.saves, saves + 1); assert.equal(JSON.stringify(c.p), phone);
    assert.equal(G.liveUnreflected(c.real, 'Mara'), 2);
    // 지울 게 없으면 저장도 안 해요; 다른 채팅이 열려 있으면 아무것도 안 해요
    assert.equal(await G.liveDropMessages(c.real, c.room.id, ['none']), 0); assert.equal(T.saves, saves + 1);
    T.metadata = { narrative_archive: {} };
    try { await assert.rejects(() => G.liveDropMessages(c.real, c.room.id, [b.id]), /이 채팅이 열려 있지 않아요/); } finally { delete T.metadata; }
    assert.deepEqual(c.room.messages, [mine, b]);
});

test('답장 넘기기: 맨 뒤에서 넘기면 새 답장을 줄 세우고(그 뒤 liveGo가 받아요), 받아 둔 답장으로 돌아갈 수 있어요', async () => {
    const c = world();
    send(c, '일어났냐');
    T.replies = [{ state: '집', reply: ['방금'], does: [] }];
    await G.liveGo(c.real);
    send(c, '밥은');
    T.replies = [{ state: '집', reply: ['아직', '너는'], does: [{ app: 'notes', what: '장 볼 것 적음' }] }];
    await G.liveGo(c.real);
    assert.deepEqual(c.room.messages.map(x => x.text), ['일어났냐', '방금', '밥은', '아직', '너는']);
    assert.deepEqual(G.liveSwipeInfo(c.real, c.room.id), { at: 1, count: 1, coming: false, prev: false, next: true });
    const saves = T.saves, calls = T.replyCalls, kept = c.room.messages.slice(0, 3).map(x => ({ ...x })), first = c.room.messages.slice(3);
    assert.deepEqual(await G.liveSwipe(c.real, c.room.id, 1), { at: 2, count: 2, fresh: true, jobs: 1 });
    // (여기서는 모델을 안 불러요: 보이던 답장을 받아 두고, 줄 세우고, 저장만)
    assert.equal(T.replyCalls, calls); assert.equal(T.saves, saves + 1);
    assert.deepEqual(c.room.messages.map(x => ({ ...x })), kept);
    assert.deepEqual(G.liveSwipeInfo(c.real, c.room.id), { at: 2, count: 2, coming: true, prev: false, next: false });
    await assert.rejects(() => G.liveSwipe(c.real, c.room.id, -1), /답장이 오는 중이에요/);
    T.replies = [{ state: '집', reply: ['먹었지'], does: [] }];
    const r = await G.liveGo(c.real);
    assert.equal(r.ran, 1); assert.equal(T.replyCalls, calls + 1);
    assert.deepEqual(c.room.messages.map(x => x.text), ['일어났냐', '방금', '밥은', '먹었지']);
    // (새 답장 요청에는 받아 둔 답장이 없어요)
    assert.ok(T.replyInput.includes('밥은') && !T.replyInput.includes('아직') && !T.replyInput.includes('너는'));
    assert.deepEqual(G.liveSwipeInfo(c.real, c.room.id), { at: 2, count: 2, coming: false, prev: true, next: true });
    // 앞의 답장으로: 모델 없이 바로, 그 말들이 그대로 돌아와요
    assert.deepEqual(await G.liveSwipe(c.real, c.room.id, -1), { at: 1, count: 2, fresh: false, jobs: 0 });
    assert.equal(T.replyCalls, calls + 1);
    assert.deepEqual(c.room.messages.slice(3), first);
    // 폰에는 메신저를 나갈 때 보이던 답장만 들어가요: 받아 둔 답장(먹었지)은 안 읽어요
    assert.equal(G.liveUnreflected(c.real, 'Mara'), 5);
    // 새 답장을 못 받으면 앞의 답장이 다시 보여요
    await G.liveSwipe(c.real, c.room.id, 1); await G.liveSwipe(c.real, c.room.id, 1);
    T.replies = [new Error('모델이 답을 안 줬어요')];
    const bad = await G.liveGo(c.real);
    assert.ok(bad.failed);
    // (목록을 먼저 봐도 · 지우기를 먼저 눌러도 같은 상태에서 시작해요: 못 받은 자리는 없어지고 앞의 답장이 보여요)
    assert.deepEqual(G.liveSwipeList(c.real, c.room.id).map(v => [v.no, v.now, v.bubbles.map(b => b.text).join('|')]), [[1, false, '아직|너는'], [2, true, '먹었지']]);
    assert.deepEqual(G.liveSwipeInfo(c.real, c.room.id), { at: 2, count: 2, coming: false, prev: true, next: true });
    assert.deepEqual(c.room.messages.map(x => x.text), ['일어났냐', '방금', '밥은', '먹었지']);
    for (const j of L.liveWorld(c.real).queue.jobs.filter(x => x.state === 'failed')) L.seeFailure(c.real, j.id);
    await G.liveSwipe(c.real, c.room.id, 1);
    T.replies = [new Error('모델이 답을 안 줬어요')];
    await G.liveGo(c.real);
    assert.deepEqual(c.room.messages.map(x => x.text), ['일어났냐', '방금', '밥은']);
    assert.deepEqual(await G.liveSwipeDropMany(c.real, c.room.id, [9]), { dropped: 0, at: 2, count: 2 });
    assert.deepEqual(c.room.messages.map(x => x.text), ['일어났냐', '방금', '밥은', '먹었지']);
    // 말 지우기로 보이는 답장의 말을 다 지우면: 받아 둔 다른 답장이 바로 보여요
    for (const j of L.liveWorld(c.real).queue.jobs.filter(x => x.state === 'failed')) assert.equal(L.seeFailure(c.real, j.id), true);
    assert.equal(await G.liveDropMessages(c.real, c.room.id, c.room.messages.slice(3).map(x => x.id)), 1);
    assert.deepEqual(c.room.messages.slice(3), first);
    // 받아 둔 답장 목록 · 골라 지우기 · 지금 것만 남기기: 저장까지 (지운 게 없으면 저장 안 해요)
    await G.liveSwipe(c.real, c.room.id, 1);
    T.replies = [{ state: '집', reply: ['벌써'], ko: ['벌써'], does: [] }];
    await G.liveGo(c.real);
    await G.liveSwipe(c.real, c.room.id, 1);
    T.replies = [{ state: '집', reply: ['Later'], ko: ['나중에'], does: [] }];
    await G.liveGo(c.real);
    assert.deepEqual(G.liveSwipeList(c.real, c.room.id), [{ no: 1, now: false, bubbles: [{ text: '아직', ko: '' }, { text: '너는', ko: '' }] }, { no: 2, now: false, bubbles: [{ text: '벌써', ko: '' }] }, { no: 3, now: true, bubbles: [{ text: 'Later', ko: '나중에' }] }]);
    let stored = T.saves;
    assert.deepEqual(await G.liveSwipeDropMany(c.real, c.room.id, [2]), { dropped: 1, at: 2, count: 2 }); assert.equal(T.saves, ++stored);
    assert.deepEqual(await G.liveSwipeDropMany(c.real, c.room.id, [7]), { dropped: 0, at: 2, count: 2 }); assert.equal(T.saves, stored);
    assert.deepEqual(await G.liveSwipeDropOthers(c.real, c.room.id), { dropped: 1, at: 1, count: 1 }); assert.equal(T.saves, ++stored);
    assert.deepEqual(c.room.messages.map(x => x.text), ['일어났냐', '방금', '밥은', 'Later']);
    assert.deepEqual(await G.liveSwipeDropOthers(c.real, c.room.id), { dropped: 0, at: 1, count: 1 }); assert.equal(T.saves, stored);
    // 보이는 답장 지우기: 하나뿐이면 답장이 없어져요
    assert.deepEqual(await G.liveSwipeDrop(c.real, c.room.id), { dropped: 1, at: 0, count: 0 });
    assert.deepEqual(c.room.messages.map(x => x.text), ['일어났냐', '방금', '밥은']);
    assert.deepEqual(G.liveSwipeList(c.real, c.room.id), []);
    assert.equal(G.liveSwipeInfo(c.real, c.room.id), null);
    await assert.rejects(() => G.liveSwipe(c.real, c.room.id, 1), /넘길 답장이 없어요/);
    T.metadata = { narrative_archive: {} };
    try { assert.equal(G.liveSwipeInfo(c.real, c.room.id), null); await assert.rejects(() => G.liveSwipe(c.real, c.room.id, 1), /이 채팅이 열려 있지 않아요/); await assert.rejects(() => G.liveSwipeDrop(c.real, c.room.id), /이 채팅이 열려 있지 않아요/); await assert.rejects(() => G.liveSwipeDropMany(c.real, c.room.id, [1]), /이 채팅이 열려 있지 않아요/); await assert.rejects(() => G.liveSwipeDropOthers(c.real, c.room.id), /이 채팅이 열려 있지 않아요/); assert.deepEqual(G.liveSwipeList(c.real, c.room.id), []); } finally { delete T.metadata; }
});

test('한국어 다시 받기: 번역 모델에 그 말만 다시 물어서 한국어만 바꿔요. 실패하면 그대로', async () => {
    const c = world();
    send(c, 'you up?');
    T.replies = [{ state: 'home', reply: ['Barely.', 'Why'], ko: ['겨우.', '왜'], does: [] }];
    await G.liveGo(c.real);
    c.p.koVoice = [{ who: 'Mara', style: '반말, 짧게' }];
    c.p.around = { people: [{ name: 'Ren', about: '친구' }] };
    const [mine, a, b] = c.room.messages, saves = T.saves, calls = T.replyCalls;
    Object.assign(T, { tr: [{ lines: [{ n: 1, ko: '간신히.' }] }], trCalls: 0, gloss: [{ src: 'barely', ko: '간신히' }, { src: 'unused', ko: 'x' }] });
    try {
        assert.deepEqual(await G.liveRetranslate(c.real, c.room.id, a.id), { count: 1, left: 0 });
        assert.equal(T.trCalls, 1); assert.equal(T.replyCalls, calls); assert.equal(T.saves, saves + 1);
        assert.deepEqual([mine.ko, a.ko, b.ko], [undefined, '간신히.', '왜']);
        assert.ok(T.trSys.startsWith('GOAL\nTranslate what a character\'s phone shows into natural Korean'));
        assert.equal(T.trInput, '[OWNER]\nMara\n\n[PEOPLE AROUND]\n- Ren: 친구\n\n[VOICES]\n- Mara: 반말, 짧게\n\n[GLOSSARY]\n- barely = 간신히\n\n[LINES]\n1: [text · Mara → Ren] "Barely."');
        // 여러 말을 한 번에 (내 말도): 요청 1번
        T.tr = [{ lines: [{ n: 1, ko: '일어났어?' }, { n: 2, ko: '겨우 일어났어.' }, { n: 3, ko: '왜?' }] }];
        assert.deepEqual(await G.liveRetranslate(c.real, c.room.id, [b.id, mine.id, a.id]), { count: 3, left: 0 });
        assert.equal(T.trCalls, 2); assert.deepEqual([mine.ko, a.ko, b.ko], ['일어났어?', '겨우 일어났어.', '왜?']);
        // 실패 · 못 읽는 답 · 번역할 말이 없음: 있던 한국어 그대로, 저장 안 해요
        const kept = T.saves;
        T.tr = [new Error('번역 모델이 빈 답을 돌려줬어요')];
        await assert.rejects(() => G.liveRetranslate(c.real, c.room.id, a.id), /빈 답/);
        T.tr = ['not json'];
        await assert.rejects(() => G.liveRetranslate(c.real, c.room.id, a.id), /번역을 받지 못했어요/);
        await assert.rejects(() => G.liveRetranslate(c.real, c.room.id, ['none']), /번역할 말이 없어요/);
        assert.equal(T.trCalls, 4); assert.equal(T.saves, kept); assert.deepEqual([mine.ko, a.ko, b.ko], ['일어났어?', '겨우 일어났어.', '왜?']);
        // 답을 기다리는 사이 실시간 폰이 새로 시작됐으면 안 넣어요
        T.tr = [{ lines: [{ n: 1, ko: '늦은 답' }] }];
        const going = G.liveRetranslate(c.real, c.room.id, a.id);
        L.resetLive(c.real); L.startFresh(c.real, { persona: 'Ren', scope: 'test' });
        await assert.rejects(() => going, /그사이 실시간 폰이 바뀌었어요/);
        assert.equal(a.ko, '겨우 일어났어.'); assert.equal(T.saves, kept);
    } finally { delete T.tr; delete T.gloss; delete T.trCalls; }
});

test('반응 달기: 달고 · 바꾸고 · 같은 걸 다시 달면 지우고 · null이면 지워요. 저장, 내가 쓴 것은 바로 누르는 줄 맨 앞으로', async () => {
    const c = world();
    send(c, '케이크 사 와');
    T.replies = [{ state: '집', reply: ['Bring Kuchen mit'], ko: ['케이크 가져갈게'], does: [] }];
    await G.liveGo(c.real);
    const [mine, hers] = c.room.messages, saves = T.saves;
    await new Promise(r => setTimeout(r, 20));   // (a reaction counts as new only when it is later than the owner's last text)
    assert.deepEqual(G.liveReactQuick(c.real), ['❤️', '😂', '😮', '😢', '😡', '👍']);
    assert.equal(await G.liveReact(c.real, c.room.id, hers.id, 'Ren', '❤️'), hers);
    assert.deepEqual(hers.reacts.map(r => [r.by, r.e]), [['Ren', '❤️']]); assert.equal(T.saves, saves + 1);
    await G.liveReact(c.real, c.room.id, hers.id, 'Ren', '🥺');
    assert.deepEqual(hers.reacts.map(r => [r.by, r.e]), [['Ren', '🥺']]);
    assert.deepEqual(G.liveReactQuick(c.real), ['🥺', '❤️', '😂', '😮', '😢', '😡']);
    // 다음 답장 요청에 보여요
    send(c, '언제 와');
    T.replies = [{ state: '집', reply: ['곧'], does: [] }];
    await G.liveGo(c.real);
    assert.match(T.replyInput, / · Mara \(집\): Bring Kuchen mit \[Ren 🥺 \(new\)\]\n/);
    // 같은 걸 다시 · null: 지워요. 내 말에도 달 수 있어요
    await G.liveReact(c.real, c.room.id, hers.id, 'Ren', '🥺');
    assert.equal(hers.reacts, undefined);
    await G.liveReact(c.real, c.room.id, mine.id, 'Ren', '😂');
    assert.equal((await G.liveReact(c.real, c.room.id, mine.id, 'Ren', null)).reacts, undefined);
    // 못 달 때: 아무것도 안 바뀌고 저장도 안 해요
    const kept = T.saves, was = JSON.stringify(c.room);
    await assert.rejects(() => G.liveReact(c.real, c.room.id, hers.id, 'Ren', 'lol'), /이모지 하나만 달 수 있어요/);
    await assert.rejects(() => G.liveReact(c.real, c.room.id, hers.id, 'Ren', '😂😂'), /이모지 하나만 달 수 있어요/);
    await assert.rejects(() => G.liveReact(c.real, c.room.id, hers.id, 'Lio', '😂'), /이 방에 없는 사람이에요/);
    await assert.rejects(() => G.liveReact(c.real, c.room.id, 'none', 'Ren', '😂'), /없는 말이에요/);
    await assert.rejects(() => G.liveReact(c.real, 'nope', hers.id, 'Ren', '😂'), /없는 방이에요/);
    c.room.messages.push({ id: 'act', n: 999, from: 'Mara', text: '', at: Date.now(), act: true });
    await assert.rejects(() => G.liveReact(c.real, c.room.id, 'act', 'Ren', '😂'), /반응을 달 수 없는 말이에요/);
    c.room.messages.pop();
    // (지울 게 없으면 저장 안 해요)
    await G.liveReact(c.real, c.room.id, hers.id, 'Ren', null);
    assert.equal(T.saves, kept); assert.equal(JSON.stringify(c.room), was);
    T.metadata = { narrative_archive: {} };
    try { await assert.rejects(() => G.liveReact(c.real, c.room.id, hers.id, 'Ren', '😂'), /이 채팅이 열려 있지 않아요/); } finally { delete T.metadata; }
});

test('캐릭터의 반응: 답장의 "react"가 내 말에 달려요; 반응만 한 답장은 말이 안 생겨요', async () => {
    const c = world();
    const x = send(c, '오늘 고마웠어');
    T.replies = [{ state: '집', reply: [], react: { to: 'Ren', emoji: '🥺' }, does: [] }];
    await G.liveGo(c.real);
    assert.deepEqual(c.room.messages, [x]);
    assert.deepEqual(x.reacts.map(r => [r.by, r.e, r.via]), [['Mara', '🥺', undefined]]);
    assert.equal(G.liveSwipeInfo(c.real, c.room.id), null);
    // 지시문: 반응 칸 하나, 받는 것의 MESSENGER에 반응 설명
    assert.ok(T.replySys.includes('"react": "" or { "to": "Ren", "emoji": "…" },'));
});

test('페르소나 설명: 답장 · 반영 · 채우기 요청에 같은 블록이 한 번씩 들어가요 (없으면 안 들어가요)', async () => {
    const c = world(), text = 'Lives in Gangseo-gu, Seoul. Works at a bakery.';
    const BLOCK = `[PERSONA — Ren]\n${text}\n[PERSONA USE]\nWho Ren is: where they live, their work, looks, people and ways.\n- It gives no events: nothing happened just because it makes it likely.\n- Where the story says otherwise, the story wins.\n- What Ren keeps to themselves, the owner doesn't know.`;
    const count = s => String(s).split('[PERSONA — Ren]').length - 1;
    Object.assign(T, { st: { name1: 'Ren', powerUserSettings: { persona_description: `  ${text}\n` } }, rows: [], chat: [] });
    try {
        // 답장: 카드 바로 뒤에
        send(c, '어디야');
        T.replies = [{ state: '집', reply: ['집'], does: [] }];
        await G.liveGo(c.real);
        assert.ok(T.replyInput.includes(`\n\n${BLOCK}\n\n`) || T.replyInput.endsWith(BLOCK)); assert.equal(count(T.replyInput), 1);
        assert.ok(T.replySys.includes("- Mara's card, PERSONA (who Ren is), VOICES ("));
        // 반영
        T.answers = [{ events: [] }];
        await G.liveReflect(c.real, 'Mara');
        assert.ok(T.input.includes(BLOCK)); assert.equal(count(T.input), 1);
        // 채우기: 실시간 · 타임라인 둘 다. 카드를 블록으로 싣는 요청(말투 읽기)은 그 안에 이미 있어서 또 안 넣어요
        const d = L.liveMeta(c.real);
        const side = await Q.liveSideRequest(d, 'Mara', ['[TARGET]\nx']);
        assert.ok(side.includes(BLOCK)); assert.equal(count(side), 1);
        const cards = await Q.liveSideRequest(d, 'Mara', [`[PERSONA — Ren]\n${text}`, '[WHO]\n- Ren']);
        assert.equal(count(cards), 1); assert.ok(!cards.includes('[PERSONA USE]'));
        const one = await PD.sideRequest(c.real, 'Mara', ['[TARGET]\nx']);
        assert.ok(String(one).includes(BLOCK)); assert.equal(count(one), 1);
        assert.ok(!String(await PD.sideRequest(c.real, 'Mara', [`[PERSONA — Ren]\n${text}`])).includes('[PERSONA USE]'));
        // 페르소나 설명이 비었으면 블록이 없어요
        T.st = { name1: 'Ren', powerUserSettings: { persona_description: '  ' } };
        assert.equal(count(await Q.liveSideRequest(d, 'Mara', [])), 0);
        send(c, '뭐해');
        T.replies = [{ state: '집', reply: ['쉬어'], does: [] }];
        await G.liveGo(c.real);
        assert.equal(count(T.replyInput), 0);
    } finally { delete T.st; delete T.rows; T.chat = []; }
});

test('실리태번에서 페르소나를 바꾸면 실시간 폰의 "나"도 따라와요: 방 · 지난 말 · 읽은 자리 · 반응 · 받아 둔 답장 · 연락처', async () => {
    const c = world();
    send(c, '일어났냐');
    T.replies = [{ state: '집', reply: ['방금'], react: '😂', does: [] }];
    await G.liveGo(c.real);
    await G.liveReact(c.real, c.room.id, c.room.messages[1].id, 'Ren', '❤️');
    // (그 반응에 답할 차례는 이 시험과 상관없어요)
    for (const j of L.liveWorld(c.real).queue.jobs) if (j.state === 'waiting') j.state = 'done';
    await G.liveSwipe(c.real, c.room.id, 1);
    T.replies = [{ state: '집', reply: ['응'], does: [] }];
    await G.liveGo(c.real);
    const w = L.liveWorld(c.real), saves = T.saves;
    c.p.where = { at: 1, people: [{ name: 'Mara', city: 'Seoul' }, { name: 'Ren', city: 'Seoul' }] };
    c.p.around = { people: [{ name: 'Ren', about: '친구' }] };
    c.p.koVoice = [{ who: 'Mara → Ren', style: '반말' }, { who: 'Ren', style: '존댓말' }];
    // 다른 채팅이 열려 있으면 안 바꿔요; 이름이 그대로여도 안 바꿔요
    Object.assign(T, { metadata: { narrative_archive: {} }, st: { name1: 'Somang' } });
    try {
        assert.equal(G.liveFollowPersona(c.real), false); assert.equal(w.persona, 'Ren');
        T.metadata = { narrative_archive: c.real };
        T.st = { name1: 'Ren' };
        L.liveMeta(c.real); assert.equal(w.persona, 'Ren');
        // 실시간 서랍이 생길 때(폰을 열 때 · 답장을 돌릴 때) 저절로 따라와요
        T.st = { name1: ' Somang ' };
        L.liveMeta(c.real);
        await Promise.resolve(); await Promise.resolve();
        assert.equal(w.persona, 'Somang'); assert.equal(T.saves, saves + 1);
        assert.deepEqual(c.room.members, ['Somang', 'Mara']);
        assert.deepEqual(c.room.messages.map(x => x.from), ['Somang', 'Mara']);
        assert.ok(c.room.read.somang > 0 && !('ren' in c.room.read));
        assert.deepEqual(w.messenger.accounts.somang, { name: 'Somang' }); assert.equal(w.messenger.accounts.ren, undefined);
        // (받아 둔 답장과 그 답장이 맡아 둔 반응까지)
        const kept = Object.values(c.room.swipes)[0].list.find(Boolean);
        assert.deepEqual(kept.map(x => x.from), ['Mara']); assert.deepEqual(kept[0].reacts.map(r => r.by), ['Somang']);
        assert.deepEqual(c.p.contacts.filter(x => x.messenger).map(x => x.name), ['Somang']);
        assert.deepEqual([c.p.where.people.map(x => x.name), c.p.around.people.map(x => x.name), c.p.koVoice.map(v => v.who)], [['Mara', 'Somang'], ['Somang'], ['Mara → Somang', 'Somang']]);
        // 그 뒤로는 새 이름으로 보내고 답장도 새 이름을 알아요
        send(c, '나 이름 바꿨어');
        T.replies = [{ state: '집', reply: ['알아'], does: [] }];
        await G.liveGo(c.real);
        assert.match(T.replySys, /^GOAL\nYou are Mara\. Somang is texting you on MESSENGER\./);
        assert.match(T.replyInput, / · Somang: 나 이름 바꿨어/); assert.ok(!T.replyInput.includes('Ren:'));
        // 그 이름이 이미 다른 사람의 것이면 안 바꿔요 (두 사람이 한 사람이 돼요)
        T.st = { name1: 'mara' };
        assert.equal(G.liveFollowPersona(c.real), false); assert.equal(w.persona, 'Somang');
        assert.equal(L.renamePersona(c.real, ''), false); assert.equal(L.renamePersona({ phones: {} }, 'X'), false);
    } finally { delete T.st; delete T.metadata; }
});

test('말 고치기: 글을 바꾸고 저장해요. 다음 답장 요청에는 고친 글이 가요; 답장을 다시 받지는 않아요', async () => {
    const c = world();
    send(c, '케이크 사 와');
    T.replies = [{ state: '집', reply: ['Bring Kuchen mit'], ko: ['케이크 가져갈게'], does: [] }];
    await G.liveGo(c.real);
    const [mine, hers] = c.room.messages, saves = T.saves, calls = T.replyCalls;
    assert.equal(await G.liveEditMessage(c.real, c.room.id, hers.id, { text: 'Bring Torte mit' }), hers);
    assert.deepEqual([hers.text, hers.ko], ['Bring Torte mit', undefined]); assert.equal(T.saves, saves + 1);
    await G.liveEditMessage(c.real, c.room.id, mine.id, { text: '타르트 사 와' });
    assert.equal(T.replyCalls, calls); assert.equal(L.liveWorld(c.real).queue.jobs.filter(j => j.state === 'waiting').length, 0);
    // (바뀐 게 없으면 저장 안 해요)
    const kept = T.saves;
    assert.equal(await G.liveEditMessage(c.real, c.room.id, mine.id, { text: '타르트 사 와' }), null); assert.equal(T.saves, kept);
    await assert.rejects(() => G.liveEditMessage(c.real, c.room.id, mine.id, { text: ' ' }), /빈 글로는 바꿀 수 없어요/); assert.equal(T.saves, kept);
    send(c, '몇 시에 와');
    T.replies = [{ state: '집', reply: ['곧'], does: [] }];
    await G.liveGo(c.real);
    assert.ok(T.replyInput.includes('타르트 사 와') && T.replyInput.includes('Bring Torte mit') && !T.replyInput.includes('케이크 사 와') && !T.replyInput.includes('Kuchen'));
    T.metadata = { narrative_archive: {} };
    try { await assert.rejects(() => G.liveEditMessage(c.real, c.room.id, mine.id, { text: 'x' }), /이 채팅이 열려 있지 않아요/); } finally { delete T.metadata; }
});

test('내가 캐릭터의 최근 말에 이모지만 달아도 캐릭터가 봐요: 답장을 줄 세우고, 왜 지금인지와 새 반응 표시를 같이 보내요', async () => {
    const c = world(), jobs = () => L.liveWorld(c.real).queue.jobs.filter(j => j.state === 'waiting');
    send(c, '늦었네');
    T.replies = [{ state: '집', reply: ['또 늦게 자지 마', '내일 일찍 일어나'], does: [] }];
    await G.liveGo(c.real);
    const [mine, a, b] = c.room.messages, calls = T.replyCalls;
    // (말풍선은 받은 순간부터 1ms씩 뒤로 찍혀요: 반응은 그보다 뒤에 달아요)
    await new Promise(res => setTimeout(res, 20));
    // 최근 말(내 마지막 말 뒤에 온 말)에 달면: 그 캐릭터의 답장이 하나 줄 서요. 모델은 liveGo가 불러요
    await G.liveReact(c.real, c.room.id, b.id, 'Ren', '😡');
    assert.deepEqual(jobs().map(j => [j.kind, j.owner, j.room, j.why]), [['reply', 'Mara', c.room.id, 'Ren put 😡 on your text "내일 일찍 일어나" just now and wrote nothing.']]);
    assert.equal(T.replyCalls, calls);
    // (바꿔 달아도 · 다른 최근 말에 달아도 기다리는 답장은 하나)
    await G.liveReact(c.real, c.room.id, b.id, 'Ren', '🙄'); await G.liveReact(c.real, c.room.id, a.id, 'Ren', '😡');
    assert.equal(jobs().length, 1);
    T.replies = [{ state: '집', reply: ['그런 거 단다고 네가 잘한 게 되진 않아'], does: [] }];
    const r = await G.liveGo(c.real);
    assert.equal(r.ran, 1); assert.equal(T.replyCalls, calls + 1);
    assert.match(T.replyInput, /\[WHY NOW\]\nRen put 😡 on your text "내일 일찍 일어나" just now and wrote nothing\./);
    assert.match(T.replyInput, / · Mara \(집\): 또 늦게 자지 마 \[Ren 😡 \(new\)\]\n.* · Mara \(집\): 내일 일찍 일어나 \[Ren 🙄 \(new\)\]/);
    assert.equal(c.room.messages.at(-1).text, '그런 거 단다고 네가 잘한 게 되진 않아');
    // 캐릭터가 말한 뒤에는 그 반응이 새것이 아니에요; 다음 답장에는 왜 지금인지도 없어요
    send(c, '알았어');
    T.replies = [{ state: '집', reply: ['응'], does: [] }];
    await G.liveGo(c.real);
    assert.ok(T.replyInput.includes('내일 일찍 일어나 [Ren 🙄]') && !T.replyInput.includes('(new)') && !T.replyInput.includes('[WHY NOW]'));
    // 줄 안 세우는 때: 예전 말(내가 그 뒤에 말했음) · 내 말 · 반응 지우기 · 폰 없는 캐릭터의 말
    await G.liveReact(c.real, c.room.id, a.id, 'Ren', '👍'); await G.liveReact(c.real, c.room.id, mine.id, 'Ren', '😂');
    const last = c.room.messages.at(-1);
    await G.liveReact(c.real, c.room.id, last.id, 'Ren', '❤️');
    assert.equal(jobs().length, 1);
    for (const j of jobs()) j.state = 'done';
    await G.liveReact(c.real, c.room.id, last.id, 'Ren', null);
    assert.equal(jobs().length, 0);
    delete L.liveWorld(c.real).phones.mara;
    await G.liveReact(c.real, c.room.id, last.id, 'Ren', '❤️');
    assert.equal(jobs().length, 0);
    // (예전 말에 단 것은 다음 답장 때 새것으로 보여요)
    assert.equal(a.reacts.find(x => x.by === 'Ren').e, '👍');
});

test('저장 줄: 저장을 시작하고 바로 돌아와요. 한 번에 하나만 돌고, 끝은 done이 기다려요; 실패는 done이 던져요', async () => {
    const log = [], gates = [];
    const slow = () => new Promise((res, rej) => { log.push('start'); gates.push({ res: () => { log.push('end'); res(); }, rej }); });
    const line = G.saveLine(slow);
    await line.save();
    await Promise.resolve();
    assert.deepEqual(log, ['start']);
    // 둘째 저장은 첫째가 끝난 뒤에 시작해요 (겹치지 않아요)
    let second = false;
    const s2 = line.save().then(() => { second = true; });
    await new Promise(r => setTimeout(r, 5));
    assert.equal(second, false); assert.deepEqual(log, ['start']);
    gates[0].res(); await s2; await Promise.resolve();
    assert.deepEqual(log, ['start', 'end', 'start']);
    let finished = false;
    const d = line.done().then(() => { finished = true; });
    await new Promise(r => setTimeout(r, 5));
    assert.equal(finished, false);
    gates[1].res(); await d;
    assert.deepEqual(log, ['start', 'end', 'start', 'end']);
    await line.done();
    // 실패: 다음 저장은 그대로 돌고, done이 그 오류를 한 번 던져요
    await line.save(); await Promise.resolve();
    gates[2].rej(new Error('저장 실패'));
    await assert.rejects(() => line.done(), /저장 실패/);
    await line.done();
});

test('답장은 저장을 기다리지 않고 화면에 나와요; liveGo는 마지막 저장이 끝난 뒤에 돌아와요', async () => {
    const c = world();
    send(c, '일어났냐');
    T.replies = [{ state: '집', reply: ['방금'], does: [] }];
    let open = null; T.saveHold = new Promise(res => { open = res; });
    const saves = T.saves, seen = [];
    let done = false;
    const going = G.liveGo(c.real, { onChange: () => seen.push(c.room.messages.length) }).then(r => { done = true; return r; });
    try {
        await new Promise(r => setTimeout(r, 30));
        // 저장이 아직 안 끝났는데 답장은 이미 그려졌어요
        assert.equal(T.saves, saves + 1); assert.ok(seen.includes(2)); assert.equal(done, false);
    } finally { open(); delete T.saveHold; }
    const r = await going;
    assert.equal(r.ran, 1); assert.equal(r.saveError, undefined); assert.equal(T.saves, saves + 1);
    // 저장이 실패하면: 답장은 그대로 남고 saveError로 알려요
    send(c, '밥은');
    T.replies = [{ state: '집', reply: ['아직'], does: [] }];
    T.saveFail = new Error('서버가 저장을 거절했어요');
    const warn = console.error; console.error = () => {};
    try {
        const bad = await G.liveGo(c.real);
        assert.equal(bad.ran, 1); assert.match(bad.saveError, /서버가 저장을 거절했어요/);
        assert.equal(c.room.messages.at(-1).text, '아직');
    } finally { console.error = warn; delete T.saveFail; }
});

test('반영 라운드도 저장을 기다리지 않아요: 라운드마다 저장은 하고, 끝에서 마지막 저장을 기다려요', async () => {
    const c = world();
    send(c, '더치페이 보내라');
    T.replies = [{ state: '집', reply: ['보낼게'], does: [] }];
    await G.liveGo(c.real);
    T.answers = [{ events: [] }];
    let open = null; T.saveHold = new Promise(res => { open = res; });
    const saves = T.saves; let drew = 0, done = false;
    const going = G.liveReflect(c.real, 'Mara', { onChange: () => drew++ }).then(r => { done = true; return r; });
    try {
        await new Promise(r => setTimeout(r, 30));
        assert.equal(T.saves, saves + 1); assert.ok(drew >= 1); assert.equal(done, false);
        assert.equal(G.liveUnreflected(c.real, 'Mara'), 0);
    } finally { open(); delete T.saveHold; }
    const r = await going;
    assert.equal(r.rounds, 1); assert.equal(r.error, '');
    // 저장이 실패하면 폰에 이유를 적어요
    send(c, '보냈어?');
    T.replies = [{ state: '집', reply: ['응'], does: [] }];
    await G.liveGo(c.real);
    T.answers = [{ events: [] }];
    T.saveFail = new Error('서버가 저장을 거절했어요');
    const warn = console.error; console.error = () => {};
    try { const bad = await G.liveReflect(c.real, 'Mara'); assert.match(bad.error, /서버가 저장을 거절했어요/); assert.match(c.p.liveReflectError.why, /서버가 저장을 거절했어요/); }
    finally { console.error = warn; delete T.saveFail; }
});

test('단체방: 답에서 @이름으로 부른 사람이 다음에 답하고, 차례 알림 글이 요청에 들어가요', async () => {
    const c = world(), m = L.liveMeta(c.real);
    m.phones.ivo = { ...phone(), owner: 'Ivo' }; migrateBank(m, m.phones.ivo);
    m.phones.varo = { ...phone(), owner: 'Varo' }; migrateBank(m, m.phones.varo);
    const g = L.ensureRoom(c.real, ['Mara', 'Ivo', 'Varo']);
    await G.liveSetAutonomousOptions(c.real, { groupChatMode: 'individual', groupResponseOrder: 'manual' });
    L.sendLive(c.real, g.id, '@Mara dinner?'); L.enqueueReplies(c.real, g.id);
    const answers = [{ state: '집', reply: ['ask @Varo'], does: [] }, { state: '집', reply: ['sure'], does: [] }], inputs = [];
    T.ask = async input => { inputs.push(input); return JSON.stringify(answers.shift()); };
    let r;
    try { r = await G.liveGo(c.real); } finally { delete T.ask; }
    assert.equal(r.failed, null);
    assert.equal(inputs.length, 2);
    for (const x of inputs) assert.ok(x.includes('You may address another group member with @Name to invite their next reply. Each available character can reply once in this turn.'));
    assert.deepEqual(g.messages.filter(x => x.from !== 'Ren').map(x => [x.from, x.text]), [['Mara', 'ask @Varo'], ['Varo', 'sure']]);
    assert.deepEqual(g.turn.spoke, ['mara', 'varo']);
});

test('Merged 단체방: 한 요청으로 여럿이 답해요. 지시문은 마리나라의 것, 끝에 Output Format', async () => {
    const c = world(), m = L.liveMeta(c.real);
    m.phones.ivo = { ...phone(), owner: 'Ivo' }; migrateBank(m, m.phones.ivo);
    const g = L.ensureRoom(c.real, ['Mara', 'Ivo']);
    L.sendLive(c.real, g.id, 'dinner?'); L.enqueueReplies(c.real, g.id);
    const asked = [];
    T.ask = async (input, o) => { asked.push({ input, system: o.system }); return 'Mara: sure\nIvo: where\nat mine?'; };
    let r;
    try { r = await G.liveGo(c.real); } finally { delete T.ask; }
    assert.equal(r.failed, null);
    assert.equal(asked.length, 1);
    assert.match(asked[0].system, /^You are Mara, Ivo chatting with the user called Ren/);
    assert.match(asked[0].input, /^\[MESSENGER\]\n.*Ren: dinner\?/);
    assert.match(asked[0].input, /\n\nRemember to prefix messages with `Name: message`!\nOnly respond for these characters: Mara, Ivo\. Never respond for Ren or write Ren's messages\.$/);
    assert.deepEqual(g.messages.filter(x => x.from !== 'Ren').map(x => [x.from, x.text]), [['Mara', 'sure'], ['Ivo', 'where'], ['Ivo', 'at mine?']]);
    assert.deepEqual(g.turn.spoke, ['mara', 'ivo']);
    assert.equal(L.liveWorld(c.real).queue.jobs.filter(j => j.state === 'waiting').length, 0);
});

test('답장에 남는 것: 모델 생각 · 보낸 요청 그대로 · 생성 정보 (마리나라의 thinking · cachedPrompt · generationInfo). 프롬프트 보기', async () => {
    const c = world();
    // (아직 답이 없을 때: 지금 보낼 요청을 보내지 않고 보여 줘요)
    send(c, '일어났냐');
    const live = await G.livePeekPrompt(c.real, c.room.id);
    assert.deepEqual([live.source, live.exact, live.messages.map(x => x.role)], ['live_preview', false, ['system', 'user']]);
    assert.match(live.agentNote, /^No saved model request was available/);
    assert.equal(T.replyCalls, 0);
    T.ask = async (input, o) => { Object.assign(o.meta, { raw: '<think>short answer</think>{"reply":["방금"]}', thinking: 'native', model: 'mm', provider: 'pp', temperature: null, maxTokens: 4000, reasoningEffort: 'low', durationMs: 12, finishReason: 'stop', usage: { promptTokens: 100, completionTokens: 9, reasoningTokens: 4, cachedPromptTokens: null } }); return JSON.stringify({ state: '집', reply: ['방금'], does: [] }); };
    try { await G.liveGo(c.real); } finally { delete T.ask; }
    const x = c.room.messages.at(-1);
    assert.equal(x.extra.thinking, 'native\n\nshort answer');
    assert.deepEqual(x.extra.cachedPrompt.map(e => e.role), ['system', 'user']);
    assert.match(x.extra.cachedPrompt[1].content, /일어났냐/);
    assert.deepEqual([x.extra.generationInfo.model, x.extra.generationInfo.provider, x.extra.generationInfo.maxTokens, x.extra.generationInfo.reasoningEffort, x.extra.generationInfo.tokensPrompt, x.extra.generationInfo.tokensReasoning, x.extra.generationInfo.tokensVisibleCompletion, x.extra.generationInfo.finishReason, x.extra.generationInfo.durationMs], ['mm', 'pp', 4000, 'low', 100, 4, 5, 'stop', 12]);
    const peek = await G.livePeekPrompt(c.real, c.room.id);
    assert.deepEqual([peek.source, peek.exact, peek.characterId, peek.generationInfo.model], ['cached', true, 'mara', 'mm']);
    assert.deepEqual(peek.messages, x.extra.cachedPrompt);
    assert.equal((await G.livePeekPrompt(c.real, c.room.id, { messageId: x.id })).agentNote, 'This is the exact cached text prompt sent for the selected turn.');
    assert.equal((await G.livePeekPrompt(c.real, c.room.id, { current: true })).source, 'live_preview');
    await assert.rejects(G.livePeekPrompt(c.real, c.room.id, { messageId: c.room.messages[0].id }), /저장된 요청이 없/);
    // (마지막 두 답에만 남아요)
    for (const t of ['둘', '셋']) { send(c, t); T.replies = [{ state: '집', reply: [`답 ${t}`], does: [] }]; await G.liveGo(c.real); }
    assert.equal(c.room.messages.filter(y => y.extra?.cachedPrompt).length, 2);
    assert.equal(x.extra.cachedPrompt, undefined);
    assert.equal(x.extra.thinking, 'native\n\nshort answer');
});
