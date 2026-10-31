import test from 'node:test';
import assert from 'node:assert/strict';
import { busy, exclusive, joinComments, realign, noteRead, newSync, makeMark, findMark, settleMarks, pickRound, addDone, settleRound, isDone, unreadCount, archiveRound, reachesEnd, quoted, journalAdd, journalRead, journalWrite } from '../src/phonesync.js';

// a chat of n messages, user and character in turn
const chat = n => Array.from({ length: n }, (_, i) => ({ is_user: i % 2 === 0, is_system: false, name: i % 2 ? 'Ren' : 'Mara', mes: `message ${i}` }));
const rows = c => c.map((x, i) => ({ index: i, text: `[#${i}] ${x.name}: ${x.mes}` })).filter((_, i) => !c[i].is_system);
const sync = (c, at) => { const s = newSync('chat'); s.marks.base = makeMark(c, at); return s; };
const read = (s, r) => { addDone(s, r.rows.map(x => x.index)); for (const i of r.retry) delete s.failed[i]; };

test('50 messages in rounds: switching order and size leaves no gap and no repeat', () => {
    const c = chat(51), s = sync(c, 0), seen = [];
    for (const [order, limit] of [['oldest', 12], ['newest', 12], ['oldest', 20], ['newest', 12]]) {
        Object.assign(s, { order, limit });
        const r = pickRound(s, rows(c));
        seen.push(...r.rows.map(x => x.index));
        read(s, r);
    }
    assert.equal(seen.length, 50);
    assert.equal(new Set(seen).size, 50);
    assert.equal(pickRound(s, rows(c)).rows.length, 0);
});

test('newest first leaves the older part unread', () => {
    const c = chat(151), s = sync(c, 100);
    Object.assign(s, { order: 'newest', limit: 12 });
    const r = pickRound(s, rows(c));
    assert.deepEqual(r.rows.map(x => x.index), [139, 140, 141, 142, 143, 144, 145, 146, 147, 148, 149, 150]);
    read(s, r);
    assert.equal(unreadCount(s, rows(c)), 38);
    s.order = 'oldest';
    assert.equal(pickRound(s, rows(c)).rows[0].index, 101);
});

test('a swipe changes the last reply only: the start holds', () => {
    const c = chat(8), s = sync(c, 7);
    c[7].mes = 'another swipe';
    assert.deepEqual(settleMarks(s, c), ['money', 'invest']);
    assert.equal(s.marks.base.index, 7);
});

test('a message deleted before the start moves the start and what was read', () => {
    const c = chat(30), s = sync(c, 9);
    addDone(s, [10, 11, 12]);
    c.splice(3, 1);
    assert.equal(findMark(c, s.marks.base).state, 'moved');
    settleMarks(s, c, ['base']);
    assert.equal(s.marks.base.index, 8);
    assert.ok(isDone(s, 9) && isDone(s, 11) && !isDone(s, 12));
});

test('a start that matches twice or not at all is asked again', () => {
    const c = chat(10), s = sync(c, 5);
    c[4].mes = 'edited by the user';
    assert.deepEqual(settleMarks(s, c, ['base']), ['base']);
    const d = chat(10), t = sync(d, 5);
    d[4].mes = 'same words'; d[0].mes = 'same words'; d[2].mes = 'same words';
    t.marks.base = makeMark(d, 5); d.splice(1, 1);
    assert.equal(findMark(d, t.marks.base).state, 'lost');
});

test('a branch with the same messages up to the start keeps it', () => {
    const c = chat(20), s = sync(c, 9), branch = c.slice(0, 13);
    assert.deepEqual(settleMarks(s, branch, ['base']), []);
});

test('a failed message is read, retried once, then skipped; the rest go on', () => {
    const c = chat(30), s = sync(c, 0); s.limit = 5;
    let r = pickRound(s, rows(c));
    read(s, r); s.failed[3] = { tries: 1, why: 'x' };
    r = pickRound(s, rows(c));
    assert.deepEqual(r.retry, [3]);
    assert.deepEqual(r.rows.map(x => x.index), [3, 6, 7, 8, 9, 10]);
    addDone(s, r.rows.map(x => x.index)); s.failed[3].tries = 2;
    r = pickRound(s, rows(c));
    assert.deepEqual(r.retry, []);
    assert.equal(r.rows[0].index, 11);
});

test('archive: evidence only when it starts after the start and covers nothing unread outside the round', () => {
    const c = chat(60), s = sync(c, 20); s.order = 'newest'; s.limit = 10;
    const secs = [
        { key: 'a', first: 0, last: 15, text: 'A' }, { key: 'b', first: 16, last: 30, text: 'B' },
        { key: 'c', first: 31, last: 49, text: 'C' }, { key: 'd', first: 50, last: 59, text: 'D' },
    ];
    const r = pickRound(s, rows(c));
    const { evidence, background } = archiveRound(s, secs, rows(c), r.rows);
    assert.deepEqual(evidence.map(x => x.key), ['d']);
    assert.deepEqual(background.map(x => x.key), ['a']);
    assert.equal(reachesEnd(s, rows(c), r.rows), true);
    read(s, r); s.arch.d = 1; s.order = 'oldest';
    const r2 = pickRound(s, rows(c)), a2 = archiveRound(s, secs, rows(c), r2.rows);
    assert.deepEqual(a2.evidence.map(x => x.key), []);
    assert.equal(reachesEnd(s, rows(c), r2.rows), false); // an older round never sees the story's current state
});

test('quotes ignore spacing and case only', () => {
    assert.ok(quoted('ich bringe  BLUMEN', 'Ja. Ich bringe Blumen mit.'));
    assert.ok(!quoted('Rosen', 'Ja. Ich bringe Blumen mit.'));
    assert.ok(!quoted('', 'anything'));
});

test('journal keeps rounds per chat and survives broken storage', () => {
    const map = new Map(), st = { getItem: k => map.get(k) ?? null, setItem: (k, v) => map.set(k, v), removeItem: k => map.delete(k) };
    journalAdd('a', { round: 'r1' }, st); journalAdd('a', { round: 'r2' }, st); journalAdd('b', { round: 'x' }, st);
    assert.deepEqual(journalRead('a', st).map(r => r.round), ['r1', 'r2']);
    journalWrite('a', [], st);
    assert.deepEqual(journalRead('a', st), []);
    assert.doesNotThrow(() => journalAdd('a', { round: 'r3' }, { getItem() { throw Error('no'); }, setItem() { throw Error('quota'); } }));
});

test('a quote may drop quote marks and spacing, but rewording never counts', () => {
    assert.ok(quoted('제주도 11월 항공권 최저가를', '"제주도 11월 항공권 최저가"를 검색했다'));
    assert.ok(quoted('ich bringe Blumen mit', 'Ja, ich bringe Blumen mit!'));
    assert.ok(!quoted('내가 빌렸다', '내가 빌려줬다'));
    assert.ok(!quoted('빌린 3만 원', '도현한테 빌려줬던 3만 원 받았어'));
    assert.ok(!quoted('I borrowed 30', 'I lent him 30'));
    assert.ok(!quoted('Rosen kaufen', 'Ja. Ich bringe Blumen mit.'));
});

test('a failed round reads the failed and the empty messages once more; what went in is not read again; no endless retries', () => {
    const c = chat(20), s = sync(c, 0); s.limit = 4;
    let r = pickRound(s, rows(c));
    assert.deepEqual(r.rows.map(x => x.index), [1, 2, 3, 4]);
    settleRound(s, r.rows, { 2: '근거 없음' }, new Set([1]));
    r = pickRound(s, rows(c));
    assert.deepEqual(r.retry, [2, 3, 4]);
    assert.ok(!r.rows.some(x => x.index === 1));
    settleRound(s, r.rows, { 2: '근거 없음' }, new Set([5, 6]));
    assert.equal(s.failed[2].tries, 2);
    assert.equal(s.failed[3].tries, 2);
    r = pickRound(s, rows(c));
    assert.deepEqual(r.retry, [7, 8]);
    settleRound(s, r.rows, {}, new Set());
    assert.equal(pickRound(s, rows(c)).retry.length, 0);
    assert.deepEqual(Object.keys(s.failed).sort(), ['2', '3', '4']);
});

test('a retried message remembers which messages it was read with', () => {
    const c = chat(20), s = sync(c, 0); s.limit = 4;
    const r = pickRound(s, rows(c));
    settleRound(s, r.rows, { 2: 'x' }, new Set([1]));
    assert.deepEqual(s.failed[2].span, [1, 4]);
    assert.deepEqual(s.failed[3].span, [1, 4]);
});

test('a comment on a post already there joins it; the same comment twice stays one', () => {
    const posts = [{ text: 'Sonnenuntergang', photo: 'sunset', time: '10-28 18:00', comments: [{ from: 'Mara', text: 'schön!' }] }];
    const n = joinComments(posts, [{ text: 'Sonnenuntergang', photo: 'sunset', time: '10-28 18:05', comments: [{ from: 'Mara', text: 'schön!' }, { from: 'Ivo', text: 'wo ist das?' }] }]);
    assert.equal(n, 1);
    assert.deepEqual(posts[0].comments.map(c => c.from), ['Mara', 'Ivo']);
});

test('a deleted message moves the bank and investment starts too', () => {
    const c = chat(30), s = sync(c, 9);
    s.marks.money = makeMark(c, 13); s.marks.invest = makeMark(c, 17);
    c.splice(3, 1);
    assert.deepEqual(settleMarks(s, c), []);
    assert.deepEqual([s.marks.base.index, s.marks.money.index, s.marks.invest.index], [8, 12, 16]);
});

const readAll = (s, c, upto) => { const r = rows(c).filter(x => x.index > s.marks.base.index && x.index <= upto); for (const x of r) addDone(s, [x.index]); noteRead(s, r); };

test('a read message edited or swiped is unread again; the others stay read', () => {
    const c = chat(12), s = sync(c, 0);
    readAll(s, c, 11);
    c[5].mes = 'edited'; c[11].mes = 'another swipe';
    const r = realign(s, rows(c));
    assert.deepEqual(r.changed, [{ old: 5, at: 5 }, { old: 11, at: 11 }]);
    assert.equal(r.gone.length, 2);
    assert.deepEqual(pickRound(s, rows(c)).rows.map(x => x.index), [5, 11]);
});

test('a read message deleted: what was read stays read, and the next new message is not swallowed', () => {
    const c = chat(12), s = sync(c, 0);
    readAll(s, c, 11);
    c.splice(6, 1);
    c.push({ is_user: true, is_system: false, name: 'Mara', mes: 'new one' }, { is_user: false, is_system: false, name: 'Ren', mes: 'and another' });
    realign(s, rows(c));
    assert.deepEqual(pickRound(s, rows(c)).rows.map(x => x.index), [11, 12]);
});

test('the same words said twice: only as many count as read as were read', () => {
    const c = chat(6), s = sync(c, 0);
    c[3].mes = 'ok'; readAll(s, c, 5);
    c.push({ is_user: true, is_system: false, name: c[3].name, mes: 'ok' });
    realign(s, rows(c));
    assert.deepEqual(pickRound(s, rows(c)).rows.map(x => x.index), [6]);
});

test('a phone from before fingerprints: its read ranges are taken as they are', () => {
    const c = chat(12), s = sync(c, 0);
    addDone(s, [1, 2, 3, 4, 5]);
    realign(s, rows(c));
    assert.deepEqual(pickRound(s, rows(c)).rows[0].index, 6);
    assert.equal(Object.keys(s.seen).length, 5);
});

test('a delete: read messages, failures and an edited one get their new numbers', () => {
    const c = chat(14), s = sync(c, 0);
    readAll(s, c, 13);
    s.failed[10] = { tries: 1, why: 'x', fp: undefined };
    settleRound(s, rows(c).filter(x => x.index === 10), { 10: 'x' }, new Set());
    c.splice(4, 1); c[8].mes = 'edited after the delete';
    const r = realign(s, rows(c));
    assert.equal(r.moved[13], 12);
    assert.equal(r.moved[3], 3);
    assert.deepEqual(r.changed, [{ old: 9, at: 8 }]);
    assert.ok(s.failed[9]);
});

test('one job at a time, and the lock opens again after an error', async () => {
    let inside;
    const slow = exclusive('sync', () => new Promise(res => { inside = res; }));
    await assert.rejects(exclusive('fill', async () => 1), /반영하는 중/);
    inside(); await slow;
    await assert.rejects(exclusive('fill', async () => { throw Error('boom'); }), /boom/);
    assert.equal(busy.fill, 0);
    assert.equal(await exclusive('sync', async () => 7), 7);
});
