import test from 'node:test';
import assert from 'node:assert/strict';
import { newSync, makeMark, findMark, settleMarks, pickRound, addDone, isDone, unreadCount, archiveRound, reachesEnd, quoted, journalAdd, journalRead, journalWrite } from '../src/phonesync.js';

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
    assert.equal(reachesEnd(s, rows(c), r2.rows), true);
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
