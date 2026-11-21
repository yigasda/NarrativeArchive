// 메신저의 말 · 방 다루기 (src/phone2room.js): AI에게 숨기기, 고정, 북마크 · 메모, 휴지통, 방 지우기, 사람 넣고 빼기
import test from 'node:test';
import assert from 'node:assert/strict';
import { R as RF } from './phone2reflect.load.mjs';

const at = f => import(new URL(`../src/${f}`, import.meta.url));
const L = await at('phone2store.js'), E = await at('phone2edit.js'), R = await at('phone2room.js'), FEED = await at('phone2feed.js');
const DG = await at('phone2digest.js'), BK = await at('phone2back.js'), { gatherReply } = await at('phone2live.js'), { liveReads } = RF;

function world() {
    const m = { phones: {} };
    L.startFresh(m, { persona: 'Ren', scope: 'test' });
    const w = L.liveWorld(m);
    w.phones = { mara: { owner: 'Mara' }, ivo: { owner: 'Ivo' } };
    const a = L.ensureRoom(m, ['Mara']), g = L.ensureRoom(m, ['Mara', 'Ivo']);
    const say = (room, from, text, at, extra = {}) => { const x = { id: `x${w.messenger.seq + 1}`, n: L.liveNo(w), from, text, at, ...extra }; room.messages.push(x); return x; };
    const x1 = L.sendLive(m, a.id, 'Are you up?', 1000);
    const x2 = say(a, 'Mara', 'Barely', 2000);
    const x3 = L.sendLive(m, a.id, 'my secret plan', 3000);
    const x4 = say(a, 'Mara', 'Did you eat', 4000);
    return { m, w, a, g, say, x1, x2, x3, x4 };
}
const texts = r => r.messages.map(x => x.text);
const asked = (m, a) => gatherReply(m, 'Mara', a.id, { now: 9000 }).messenger.map(x => x.text);

const PIN = '[Pinned message from earlier in the chat]';
test('AI에게 숨기기: 답장 · 요약 · 반영 · 롤플에 전하기가 그 말을 안 읽어요. 화면의 말은 그대로', () => {
    const { m, w, a, x3 } = world();
    assert.equal(R.markMessages(m, a.id, [x3.id], { hiddenFromAI: true }), 1);
    assert.equal(R.markMessages(m, a.id, [x3.id], { hiddenFromAI: true }), 0);
    assert.deepEqual(x3.extra, { hiddenFromAI: true });
    assert.deepEqual(texts(a), ['Are you up?', 'Barely', 'my secret plan', 'Did you eat']);
    assert.deepEqual(asked(m, a), ['Are you up?', 'Barely', 'Did you eat']);
    assert.deepEqual(FEED.feedRows(m, 'Mara').map(x => x.text), ['Are you up?', 'Barely', 'Did you eat']);
    assert.equal(liveReads(x3, 'Mara'), false);
    assert.equal(FEED.messengerNow(m, 'Mara').includes('secret'), false);
    assert.deepEqual(DG.undigested(a).map(x => x.text), ['Are you up?', 'Barely', 'Did you eat']);
    assert.equal(BK.backLeft(w).rooms.flatMap(r => r.rows).some(x => x.text === 'my secret plan'), false);
    // 다시 보이기: 표시가 다 없어지면 extra도 없어져요
    assert.equal(R.markMessages(m, a.id, x3.id, { hiddenFromAI: false }), 1);
    assert.equal('extra' in x3, false);
    assert.deepEqual(asked(m, a), ['Are you up?', 'Barely', 'my secret plan', 'Did you eat']);
    assert.equal(liveReads(x3, 'Mara'), true);
    assert.throws(() => R.markMessages(m, a.id, x3.id, { hiddenFromAI: 'yes' }), /true 또는 false/);
});
test('한 사람에게만 숨기기: 그 사람의 답장 · 반영만 안 읽어요. 여럿이 같이 읽는 요약 · 전하기에는 안 들어가요', () => {
    const { m, w, g, say } = world();
    const y = say(g, 'Ren', 'not for Mara', 2500);
    say(g, 'Ivo', 'hi all', 2600);
    assert.equal(R.markMessages(m, g.id, y.id, { hiddenFromAICharacterIds: ['Mara', ' mara '] }), 1);
    assert.deepEqual(y.extra, { hiddenFromAICharacterIds: ['mara'] });
    const ask = who => gatherReply(m, who, g.id, { now: 9000 }).messenger.map(x => x.text);
    assert.deepEqual(ask('Mara'), ['hi all']);
    assert.deepEqual(ask('Ivo'), ['not for Mara', 'hi all']);
    assert.deepEqual([liveReads(y, 'Mara'), liveReads(y, 'Ivo')], [false, true]);
    assert.deepEqual(FEED.feedRows(m, 'Ivo').map(x => x.text).includes('not for Mara'), true);
    assert.deepEqual(DG.undigested(g).map(x => x.text), ['hi all']);
    assert.equal(BK.backLeft(w).rooms.flatMap(r => r.rows).some(x => x.text === 'not for Mara'), false);
    assert.equal(R.markMessages(m, g.id, y.id, { hiddenFromAICharacterIds: null }), 1);
    assert.equal('extra' in y, false);
});
test('고정: 요약으로 넘어간 말도 답장 요청에 들어가요 (마리나라의 표시 줄을 달고, 말한 순서대로, 숨긴 것은 빼고)', () => {
    const { m, a, x1, x2 } = world();
    a.digest = { upto: x2.n, parts: [{ text: '## 요약' }] };
    assert.deepEqual(asked(m, a), ['my secret plan', 'Did you eat']);
    R.markMessages(m, a.id, [x1.id], { pinnedToContext: true });
    assert.deepEqual(asked(m, a), [`${PIN}\nAre you up?`, 'my secret plan', 'Did you eat']);
    assert.equal(x1.text, 'Are you up?');                       // (방의 말은 그대로)
    // 끝에 이미 들어가는 말은 두 번 안 들어가고, 표시 줄도 안 붙어요
    R.markMessages(m, a.id, [a.messages[3].id], { pinnedToContext: true });
    assert.deepEqual(asked(m, a), [`${PIN}\nAre you up?`, 'my secret plan', 'Did you eat']);
    R.markMessages(m, a.id, [x1.id], { hiddenFromAI: true });
    assert.deepEqual(asked(m, a), ['my secret plan', 'Did you eat']);
    assert.deepEqual(R.askRows(a, 1, 'Mara').map(x => x.text), ['Did you eat']);
    R.markMessages(m, a.id, [x1.id], { pinnedToContext: false, hiddenFromAI: false });
    assert.equal('extra' in x1, false);
});
test('고정은 방마다 마리나라의 수까지예요', () => {
    const { m, a, say } = world();
    const made = Array.from({ length: 11 }, (_, i) => say(a, 'Mara', `p${i}`, 5000 + i));
    assert.equal(R.markMessages(m, a.id, made.slice(0, 10).map(x => x.id), { pinnedToContext: true }), 10);
    assert.throws(() => R.markMessages(m, a.id, made[10].id, { pinnedToContext: true }), /10개까지/);
    assert.equal(R.markMessages(m, a.id, made[0].id, { pinnedToContext: true }), 0);   // (이미 고정한 말은 그대로 돼요)
    R.markMessages(m, a.id, made[0].id, { pinnedToContext: false });
    assert.equal(R.markMessages(m, a.id, made[10].id, { pinnedToContext: true }), 1);
});
test('북마크 · 메모: 표시만 남고 AI에게는 안 가요. 모아 보기는 말한 순서대로', () => {
    const { m, a, g, say, x2, x4 } = world();
    const y = say(g, 'Ivo', 'group hi', 2500);
    assert.equal(R.markMessages(m, a.id, [x4.id, 'nope'], { bookmark: true }), 1);
    const made = x4.extra.bookmark.createdAt;
    assert.ok(made && x4.extra.bookmark.label === null);
    assert.equal(R.markMessages(m, a.id, x4.id, { bookmark: true }), 0);      // (이미 한 북마크는 만든 때가 그대로)
    assert.equal(R.markMessages(m, a.id, x4.id, { bookmark: { label: '  밥  ' } }), 1);
    assert.equal(x4.extra.bookmark.label, '밥');
    assert.equal(R.markMessages(m, a.id, x2.id, { privateNote: '  기억해 둘 것  ' }), 1);
    assert.equal(x2.extra.privateNote, '기억해 둘 것');
    assert.equal(R.markMessages(m, a.id, x2.id, { privateNote: '기억해 둘 것' }), 0);
    R.markMessages(m, g.id, [y.id], { bookmark: true });
    assert.deepEqual(R.markedMessages(m).map(t => [t.x.text, t.bookmark?.label ?? null, t.note]), [['Barely', null, '기억해 둘 것'], ['group hi', null, null], ['Did you eat', '밥', null]]);
    assert.deepEqual(R.markedMessages(m, a.id).map(t => t.x.text), ['Barely', 'Did you eat']);
    const sent = JSON.stringify(gatherReply(m, 'Mara', a.id, { now: 9000 }));
    assert.equal(sent.includes('기억해 둘 것') || sent.includes('밥'), false);
    assert.equal(R.markMessages(m, a.id, x2.id, { privateNote: null }), 1);
    assert.equal('extra' in x2, false);
    assert.equal(R.markMessages(m, a.id, x4.id, { bookmark: null }), 1);
    assert.equal('extra' in x4, false);
    assert.throws(() => R.markMessages(m, a.id, x2.id, { privateNote: 'x'.repeat(2001) }), /at most 2000/);
});
test('휴지통: 지운 말이 들어가고, 되살리면 제자리로 와요. 받아 둔 답장도 같이', () => {
    const { m, a, x1, x2, x3 } = world();
    a.swipes = { [x3.id]: { list: [null, [{ id: 's1', text: 'other' }]], at: 0 } };
    assert.equal(E.dropMessages(m, a.id, [x2.id, x3.id]), 2);
    assert.deepEqual(texts(a), ['Are you up?', 'Did you eat']);
    assert.equal(a.swipes, undefined);
    assert.deepEqual(R.trashOf(m, a.id).map(t => t.x.text), ['my secret plan', 'Barely']);
    assert.equal(R.trashOf(m, a.id)[0].until - R.trashOf(m, a.id)[0].at, 30 * 24 * 60 * 60 * 1000);
    assert.equal(R.restoreMessages(m, a.id, [x3.id]), 1);
    assert.deepEqual(texts(a), ['Are you up?', 'my secret plan', 'Did you eat']);
    assert.deepEqual(Object.keys(a.swipes), [x3.id]);
    assert.equal(R.restoreMessages(m, a.id, [x3.id, 'nope']), 0);
    assert.equal(R.restoreMessages(m, a.id, [x2.id]), 1);
    assert.deepEqual(texts(a), ['Are you up?', 'Barely', 'my secret plan', 'Did you eat']);
    assert.equal(a.trash, undefined);
    // 맨 앞 · 맨 끝의 말도 제자리로
    E.dropMessages(m, a.id, [x1.id, a.messages[3].id]);
    R.restoreMessages(m, a.id, a.trash.map(t => t.x.id));
    assert.deepEqual(texts(a), ['Are you up?', 'Barely', 'my secret plan', 'Did you eat']);
});
test('휴지통: 방마다 정해진 수만 두고, 골라서 또는 통째로 비워요', () => {
    const { m, a, say } = world();
    const made = Array.from({ length: R.ROOM.trash + 5 }, (_, i) => say(a, 'Mara', `t${i}`, 5000 + i));
    E.dropMessages(m, a.id, made.map(x => x.id));
    assert.equal(a.trash.length, R.ROOM.trash);
    assert.equal(a.trash[0].x.text, 't5');
    assert.equal(R.emptyTrash(m, a.id, [made[5].id, made[6].id]), 2);
    assert.equal(a.trash[0].x.text, 't7');
    assert.equal(R.emptyTrash(m, a.id), R.ROOM.trash - 2);
    assert.equal(a.trash, undefined);
    assert.equal(R.emptyTrash(m, a.id), 0);
});
test('방 지우기: 휴지통으로 가고, 줄 선 답장은 없어져요. 받는 중이면 못 지워요. 되살리면 그대로', () => {
    const { m, w, a, g } = world();
    L.enqueueReplies(m, a.id); L.enqueueReplies(m, g.id);
    const mine = () => w.queue.jobs.filter(j => j.room === a.id).length;
    assert.equal(mine(), 1);
    w.queue.jobs.find(j => j.room === a.id).state = 'running';
    assert.throws(() => R.dropRoom(m, a.id), /받는 중/);
    w.queue.jobs.find(j => j.room === a.id).state = 'waiting';
    assert.equal(R.dropRoom(m, a.id), a);
    assert.equal(w.messenger.rooms[a.id], undefined);
    assert.equal(mine(), 0);
    assert.equal(w.queue.jobs.filter(j => j.room === g.id).length, 2);
    assert.deepEqual(R.roomTrash(m).map(t => t.room.id), [a.id]);
    assert.throws(() => R.dropRoom(m, a.id), /없는 방/);
    assert.equal(R.restoreRoom(m, a.id), a);
    assert.equal(w.messenger.rooms[a.id].messages.length, 4);
    assert.equal(w.messenger.trash, undefined);
    assert.throws(() => R.restoreRoom(m, a.id), /휴지통에 없는/);
    // 그사이 같은 사람들의 방이 생겼으면 되살리지 않아요
    R.dropRoom(m, a.id);
    const fresh = L.ensureRoom(m, ['Mara']);
    assert.notEqual(fresh.id, a.id);
    assert.throws(() => R.restoreRoom(m, a.id), /이미 있어요/);
    assert.equal(R.emptyRoomTrash(m, a.id), 1);
    assert.equal(w.messenger.trash, undefined);
});
test('지운 방은 정해진 수만 둬요', () => {
    const { m, w } = world();
    for (let i = 0; i < R.ROOM.rooms + 2; i++) R.dropRoom(m, L.ensureRoom(m, [`P${i}`]).id);
    assert.equal(w.messenger.trash.length, R.ROOM.rooms);
    assert.equal(w.messenger.trash[0].room.members[1], 'P2');
    assert.equal(R.emptyRoomTrash(m), R.ROOM.rooms);
});
test('사람 넣기: 계정이 생기고, 같은 사람들의 방이 있으면 안 해요', () => {
    const { m, w, a, g } = world();
    assert.throws(() => R.addMember(m, a.id, 'Ivo'), /이미 있어요/);       // (Ren · Mara · Ivo 방이 있어요)
    assert.equal(R.addMember(m, g.id, 'Varo'), g);
    assert.deepEqual(g.members, ['Ren', 'Mara', 'Ivo', 'Varo']);
    assert.ok(w.messenger.accounts.varo);
    assert.equal(R.addMember(m, g.id, 'varo').members.length, 4);
    assert.throws(() => R.addMember(m, g.id, '  '), /이름/);
});
test('사람 빼기: 나는 못 빼고, 둘만 남은 방에서는 못 빼요. 그 사람의 줄 선 답장 · 읽은 자리는 없어져요', () => {
    const { m, w, a, g } = world();
    R.addMember(m, g.id, 'Varo');
    L.enqueueReplies(m, g.id);
    L.readLive(m, g.id, 'Ivo', 5000);
    assert.throws(() => R.removeMember(m, g.id, 'Ren'), /뺄 수 없어요/);
    assert.throws(() => R.removeMember(m, a.id, 'Mara'), /둘만/);
    w.queue.jobs.find(j => j.owner === 'Ivo').state = 'running';
    assert.throws(() => R.removeMember(m, g.id, 'Ivo'), /받는 중/);
    w.queue.jobs.find(j => j.owner === 'Ivo').state = 'waiting';
    assert.equal(R.removeMember(m, g.id, 'ivo'), g);
    assert.deepEqual(g.members, ['Ren', 'Mara', 'Varo']);
    assert.equal(w.queue.jobs.some(j => j.owner === 'Ivo'), false);
    assert.equal(w.queue.jobs.some(j => j.owner === 'Mara' && j.room === g.id), true);
    assert.equal('ivo' in (g.read || {}), false);
    // 빼면 다른 방과 같은 사람들이 되는 때는 안 해요 (Ren · Mara 방이 있어요)
    R.removeMember(m, g.id, 'Nobody');
    assert.throws(() => R.removeMember(m, g.id, 'Varo'), /이미 있어요/);
});
test('이 파일은 폰 2 저장 자리만 불러요; 모델 · 저장은 안 불러요; 폰 1 파일은 이 파일을 안 불러요', async () => {
    const { readFile, readdir } = await import('node:fs/promises'), SRC = new URL('../src/', import.meta.url);
    const src = await readFile(new URL('phone2room.js', SRC), 'utf8');
    assert.deepEqual([...src.matchAll(/from '([^']+)'/g)].map(x => x[1]), ['./phone2store.js', './marinara/message-marks.js', './marinara/message-hidden.js']);
    assert.doesNotMatch(src, /saveMeta|ctx\(|askDraft|askTranslator|boundary/);
    for (const f of (await readdir(SRC)).filter(f => f.endsWith('.js') && !/^phone2/.test(f) && f !== 'phone.js')) assert.doesNotMatch(await readFile(new URL(f, SRC), 'utf8'), /phone2room/, f);
});
test('휴지통은 마리나라처럼 30일 뒤에 비워요', () => {
    const { m, w, a, x1, x2 } = world(), day = 24 * 60 * 60 * 1000;
    R.toTrash(a, [x1], {}, 1000);
    R.toTrash(a, [x2], {}, 1000 + 31 * day);
    assert.deepEqual(a.trash.map(t => t.x.id), [x2.id]);
    assert.deepEqual(R.trashOf(m, a.id, 1000 + 62 * day), []);
    const r1 = L.ensureRoom(m, ['P1']), r2 = L.ensureRoom(m, ['P2']);
    R.dropRoom(m, r1.id, 1000); R.dropRoom(m, r2.id, 1000 + 31 * day);
    assert.deepEqual(w.messenger.trash.map(t => t.room.id), [r2.id]);
    assert.deepEqual(R.roomTrash(m, 1000 + 62 * day), []);
});
test('메모를 한 사람에게 보여 주기(마리나라의 privateNoteRecipientId): 그 사람의 답장 요청에서만, 마리나라의 글로 붙어요', () => {
    const { m, g, say } = world();
    const y = say(g, 'Ren', 'see you at six', 2500);
    say(g, 'Ivo', 'ok', 2600);
    R.markMessages(m, g.id, y.id, { privateNote: 'she hates being late', privateNoteRecipientId: 'Ivo' });
    assert.deepEqual(y.extra, { privateNote: 'she hates being late', privateNoteRecipientId: 'ivo' });
    const ask = who => gatherReply(m, who, g.id, { now: 9000 }).messenger.map(x => x.text);
    assert.deepEqual(ask('Ivo'), ["see you at six\n\n[The user's private note on this message, shown only to you]\nshe hates being late\n[End of private note]", 'ok']);
    assert.deepEqual(ask('Mara'), ['see you at six', 'ok']);
    assert.equal(y.text, 'see you at six');
    assert.throws(() => R.markMessages(m, g.id, y.id, { privateNoteRecipientId: 'Nobody' }), /방에 없는 사람/);
    // 메모를 지우면 받는 사람도 같이 없어져요
    R.markMessages(m, g.id, y.id, { privateNote: null });
    assert.equal('extra' in y, false);
});
test('휴지통에서 되살릴 때 고정이 열 개를 넘으면 막아요(마리나라처럼). 날짜가 지난 휴지통은 타이머가 비워요', () => {
    const { m, w, a, say } = world();
    const made = Array.from({ length: 11 }, (_, i) => say(a, 'Mara', `p${i}`, 5000 + i));
    R.markMessages(m, a.id, made[10].id, { pinnedToContext: true });
    E.dropMessages(m, a.id, made[10].id);
    R.markMessages(m, a.id, made.slice(0, 10).map(x => x.id), { pinnedToContext: true });
    assert.throws(() => R.restoreMessages(m, a.id, made[10].id), /고정이 10개를 넘어요/);
    R.markMessages(m, a.id, made[0].id, { pinnedToContext: false });
    assert.equal(R.restoreMessages(m, a.id, made[10].id), 1);
    // 날짜 지난 것 비우기
    const day = 24 * 60 * 60 * 1000;
    R.toTrash(a, [made[1]], {}, 1000);
    w.messenger.trash = [{ room: { id: 'old', members: ['Ren', 'X'] }, at: 1000 }];
    assert.equal(R.purgeTrash(m, 1000 + 29 * day), 0);
    assert.equal(R.purgeTrash(m, 1000 + 31 * day), 2);
    assert.deepEqual([a.trash, w.messenger.trash], [undefined, undefined]);
});
