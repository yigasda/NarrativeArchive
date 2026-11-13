// 폰 2 답장을 실제로 돌리기 (단계 7-5): 보내기 → 답장, 메신저를 나갈 때 폰 2 반영. 모델은 가짜예요.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { migrateBank, cash } from '../src/finance.js';
import * as L from '../src/phone2store.js';
import { G, T, PD } from './phone2reflect.load.mjs';
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
    L.startFromStory(real, { persona: 'Ren', upto: 12, scope: 'test', story: { ranges: {}, titles: [], rawFrom: 0, own: [''] } });
    const lp = L.livePhone(real, 'Mara');
    assert.equal(lp.syncUndo, undefined); assert.equal(lp.syncUndos, undefined); assert.equal(lp.syncLast, undefined); assert.equal(lp.sync.owed, undefined);
    assert.deepEqual(lp.notes.map(x => x.title), ['이야기 메모']); assert.deepEqual(lp.sync.done, [[2, 12]]);
    assert.equal(JSON.stringify(real.phones), p1);
    assert.equal(G.liveCanUndo(real, 'Mara'), false);
    await assert.rejects(G.liveUndo(real, 'Mara'), /되돌릴 반영이 없어요/);
});

test('전에 시작해 둔 실시간 폰(폰 1의 되돌리기 · 밀린 결제가 복사돼 있음): 되돌리기는 실시간 반영만, 밀린 결제는 안 넣어요', async () => {
    const real = storyWorld();
    L.startFromStory(real, { persona: 'Ren', upto: 12, scope: 'test', story: { ranges: {}, titles: [], rawFrom: 0, own: [''] } });
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
    L.startFromStory(real, { persona: 'Ren', upto: 3, scope: 'test', story: { ranges: {}, titles: [], rawFrom: 0, own: [''] } });
    const liveKey = L.liveScope('test', real), round = () => [{ round: 'r1', owner: 'Mara', year: 2026, events: [{ id: 'e', date: '2026-11-10' }], life: [] }];
    journalWrite('test', round()); journalWrite(liveKey, round());
    const before = JSON.stringify(journalRead('test')), d = L.liveMeta(real);
    assert.equal(d.phoneJournal, liveKey);
    PD.setStoryYear(d, d.phones.mara, 2027);
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
    for (const f of (await readdir(new URL('../src/', import.meta.url))).filter(f => f.endsWith('.js') && f !== 'phone2go.js' && f !== 'phone.js')) assert.doesNotMatch(await readFile(new URL(`../src/${f}`, import.meta.url), 'utf8'), /phone2go/, f);
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

test('실시간 폰에서 폰 1의 앱 요청을 불러도 시작 뒤의 롤플 채팅은 안 읽어요. 최근 대화는 메신저 것이에요', async () => {
    const chat0 = T.chat;
    T.chat = ['옛날 이야기 하나', '옛날 이야기 둘', '시작 직전 이야기', '시작 뒤 롤플 하나', '시작 뒤 롤플 둘'].map((mes, i) => ({ name: i % 2 ? 'Mara' : 'Ren', is_user: !(i % 2), mes, extra: {} }));
    // (what 폰 1's reader gives as the chat's newest messages)
    T.recent = ['#3 Mara: 시작 뒤 롤플 하나', '#4 Ren: 시작 뒤 롤플 둘'];
    try {
        const real = { phones: { mara: phone() }, text: '' };
        L.startFromStory(real, { persona: 'Ren', upto: 2, scope: 'test', story: { ranges: {}, titles: [], rawFrom: 0, own: [''] } });
        const room = L.ensureRoom(real, ['Mara']);
        L.sendLive(real, room.id, '메신저로 한 말');
        const d = L.liveMeta(real), p = d.phones.mara;
        p.now = '11-12 21:30';
        // the drawer says how far the chat may be read and gives the messenger's talk
        assert.equal(d.phoneUpto, 2);
        assert.equal(d.phoneRecent('Mara', 6, { maxChars: 6000 }), 'Ren: 메신저로 한 말');
        assert.equal(PD.readUpto(d, p), 2);
        assert.deepEqual([PD.windowOf(d, p).upto, PD.windowOf(d, p).n], [2, 0]);
        assert.equal(PD.recentOf(d, 'Mara', 6, {}), 'Ren: 메신저로 한 말');
        assert.equal(PD.storyNow(p, null, d), '11-12 21:30');
        const side = await PD.sideRequest(d, 'Mara', ['[TARGET]\nx']);
        assert.ok(side.includes('Ren: 메신저로 한 말'));
        assert.ok(!side.includes('시작 뒤 롤플'));
        // an app that marks where it read (투자 처음 채우기): only the talk the reflection has read, and its mark is the
        // last message read, a messenger number (so the reflection gives the app what comes after, once)
        const first = room.messages[0].n;
        L.sendLive(real, room.id, '아직 반영 안 된 말');
        p.sync = { scope: 'x', marks: { base: { index: 2, user: -1, fp: '', tail: '' } }, done: [[first, first]] };
        const read = {};
        const fill = await PD.sideRequest(d, 'Mara', ['[TARGET]\nx'], { read });
        assert.ok(fill.includes('메신저로 한 말')); assert.ok(!fill.includes('아직 반영 안 된 말')); assert.ok(!fill.includes('시작 뒤 롤플'));
        assert.deepEqual(PD.readMark(read.gap), { index: first, user: -1, fp: '', tail: '' });
        assert.equal(PD.nowAt(read.gap), 2);
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

test('앱 요청(사진 · 일기 · 초안 · 녹음)은 최근 대화와 지금 시각을 받은 메타에 물어요', async () => {
    const src = await (await import('node:fs/promises')).readFile(new URL('../src/phoneai.js', import.meta.url), 'utf8');
    assert.ok(!/recentPhoneText\(/.test(src)); assert.ok(!/storyNow\(p\)/.test(src));
    assert.equal((src.match(/recentOf\(m, p\.owner, /g) || []).length, 4);
});
