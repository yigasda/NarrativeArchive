// 폰 2 메신저의 말 고치기 (src/phone2edit.js): 지우기 · 답장 다시 받기 · 한국어 다시 받기의 고르기와 요청 글 · 답 넣기만 봐요.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import * as L from '../src/phone2store.js';
import * as E from '../src/phone2edit.js';

const SRC = new URL('../src/', import.meta.url);
function world() {
    const m = { phones: {} };
    L.startFresh(m, { persona: 'Ren', scope: 'test' });
    const w = L.liveWorld(m);
    w.phones = { mara: { owner: 'Mara' } };
    const a = L.ensureRoom(m, ['Mara']), g = L.ensureRoom(m, ['Mara', 'Ivo']);
    const say = (room, from, text, at, extra = {}) => { const x = { id: `x${room.messages.length}${room.id}`, n: L.liveNo(w), from, text, at, ...extra }; room.messages.push(x); return x; };
    L.sendLive(m, a.id, 'Are you up?', 1000);
    say(a, 'Mara', 'Barely.', 2000, { ko: '겨우.' });
    L.sendLive(m, a.id, 'Dinner?', 3000);
    say(a, 'Mara', 'Did you eat', 4000, { ko: '밥 먹었어', state: 'office' });
    say(a, 'Mara', '', 4001, { act: true, does: [{ app: 'notes', what: 'writes a list' }] });
    say(a, 'Mara', 'Answer me', 4002, { ko: '대답해', told: 9 });
    return { m, w, a, g, say };
}
const texts = r => r.messages.map(x => x.text || (x.act ? '(act)' : ''));

test('지우기: 고른 말만 지우고 나머지는 번호 · 순서 · 표시 그대로; 없는 id는 건너뛰어요', () => {
    const { m, w, a } = world(), was = a.messages.map(x => ({ ...x })), seq = w.messenger.seq;
    assert.equal(E.dropMessages(m, a.id, a.messages[1].id), 1);
    assert.deepEqual(texts(a), ['Are you up?', 'Dinner?', 'Did you eat', '(act)', 'Answer me']);
    assert.equal(E.dropMessages(m, a.id, [a.messages[0].id, a.messages[4].id, 'no such id', a.messages[0].id]), 2);
    assert.deepEqual(a.messages.map(x => ({ ...x })), [was[2], was[3], was[4]]);
    // (번호는 다시 쓰지 않아요: 새 말은 지운 말의 번호 뒤로 이어져요)
    assert.equal(w.messenger.seq, seq);
    assert.equal(L.sendLive(m, a.id, 'next', 9000).n, seq + 1);
    assert.equal(E.dropMessages(m, a.id, []), 0); assert.equal(E.dropMessages(m, a.id, null), 0);
    assert.throws(() => E.dropMessages(m, 'nope', ['x']), /없는 방이에요/);
    assert.throws(() => E.dropMessages({ phones: {} }, a.id, ['x']), /아직 폰 2가 없어요/);
});

test('다시 받을 답장: 방의 맨 끝, 내 마지막 말 뒤에 온 말들 (폰으로 한 일만 있는 말도)', () => {
    const { m, a, g, say } = world();
    assert.deepEqual(E.replyTail(m, a.id).map(x => x.text || '(act)'), ['Did you eat', '(act)', 'Answer me']);
    assert.equal(E.redoCount(m, a.id), 3);
    // 맨 끝이 내 말이면 없음; 내 말이 하나도 없는 방(가져온 말뿐 · 캐릭터가 먼저 건 말)도 없음
    L.sendLive(m, a.id, 'hello?', 5000);
    assert.deepEqual(E.replyTail(m, a.id), []); assert.equal(E.redoCount(m, a.id), 0);
    say(g, 'Ivo', 'anyone here', 100);
    assert.deepEqual(E.replyTail(m, g.id), []); assert.equal(E.redoCount(m, g.id), 0);
    assert.equal(E.redoCount(m, 'nope'), 0);
});

test('맨 끝 답장 지우기: 그 말들만 지워요. 답장이 오는 중 · 답장할 폰이 없는 방 · 다시 받을 게 없으면 아무것도 안 바꿔요', () => {
    const { m, w, a, g, say } = world();
    // 답장이 오는 중 (기다리는 중 · 받는 중)
    const job = L.enqueueReplies(m, a.id)[0];
    assert.equal(E.replyComing(m, a.id), true); assert.equal(E.redoCount(m, a.id), 0);
    const was = JSON.stringify(w.messenger.rooms);
    assert.throws(() => E.dropReplyTail(m, a.id), /답장이 오는 중이에요/);
    job.state = 'running';
    assert.throws(() => E.dropReplyTail(m, a.id), /답장이 오는 중이에요/);
    assert.equal(JSON.stringify(w.messenger.rooms), was);
    // (다른 방의 답장 · 끝난 답장은 상관없어요)
    job.state = 'done'; L.enqueueReplies(m, g.id);
    assert.equal(E.replyComing(m, a.id), false);
    assert.equal(E.dropReplyTail(m, a.id), 3);
    assert.deepEqual(texts(a), ['Are you up?', 'Barely.', 'Dinner?']);
    assert.throws(() => E.dropReplyTail(m, a.id), /다시 받을 답장이 없어요/);
    // 답장할 폰이 없는 방
    for (const j of w.queue.jobs) j.state = 'done';
    delete w.phones.mara;
    L.sendLive(m, g.id, 'hi', 200); say(g, 'Ivo', 'yo', 300);
    assert.equal(E.redoCount(m, g.id), 0);
    assert.throws(() => E.dropReplyTail(m, g.id), /답장할 폰이 없어요/);
    assert.deepEqual(texts(g), ['hi', 'yo']);
});

test('한국어를 다시 받을 말: 고른 것 중 글이 있는 말만, 방의 순서대로; 누구의 말투 표를 쓸지', () => {
    const { m, w, a, g, say } = world(), ids = a.messages.map(x => x.id).reverse();
    a.messages.push({ id: 'call', n: L.liveNo(w), from: 'Mara', at: 5000, call: { min: 3 } });
    const got = E.koRows(m, a.id, [...ids, 'call', 'none']);
    assert.equal(got.owner, 'Mara'); assert.equal(got.left, 0);
    assert.deepEqual(got.rows.map(r => [r.who, r.to, r.x.text]), [['Ren', 'Mara', 'Are you up?'], ['Mara', 'Ren', 'Barely.'], ['Ren', 'Mara', 'Dinner?'], ['Mara', 'Ren', 'Did you eat'], ['Mara', 'Ren', 'Answer me']]);
    assert.equal(got.rows[1].x, a.messages[1]);
    // 단체방: 받는 사람은 나머지 모두. 폰 있는 캐릭터가 없으면 첫 캐릭터
    const x = say(g, 'Ivo', 'hey all', 100);
    assert.deepEqual(E.koRows(m, g.id, x.id).rows.map(r => [r.who, r.to]), [['Ivo', 'Ren, Mara']]);
    assert.equal(E.koRows(m, g.id, x.id).owner, 'Mara');
    delete w.phones.mara;
    assert.equal(E.koRows(m, g.id, x.id).owner, 'Mara'); assert.equal(E.koRows(m, a.id, []).rows.length, 0);
    // 한 번에 정한 수까지만: 남은 수를 알려 줘요
    const keep = E.EDIT.max; E.EDIT.max = 2;
    try { const part = E.koRows(m, a.id, ids); assert.deepEqual([part.rows.length, part.left], [2, 3]); } finally { E.EDIT.max = keep; }
});

test('번역 요청 글: 번역 지시문이 받는 칸 이름 그대로; 요청 하나에 정한 만큼씩 나눠요', async () => {
    const { m, a } = world(), { rows } = E.koRows(m, a.id, a.messages.map(x => x.id));
    const input = E.koInput(rows.slice(1, 3), { owner: 'Mara', around: '[PEOPLE AROUND]\n- Ren: a friend', voices: [{ who: 'Mara', style: '반말, 짧게' }], gloss: [{ src: 'Dinner', ko: '저녁' }] });
    assert.equal(input, `[OWNER]
Mara

[PEOPLE AROUND]
- Ren: a friend

[VOICES]
- Mara: 반말, 짧게

[GLOSSARY]
- Dinner = 저녁

[LINES]
1: [text · Mara → Ren] "Barely."
2: [text · Ren → Mara] "Dinner?"`);
    assert.equal(E.koInput(rows.slice(0, 1)), '[OWNER]\nme\n\n[LINES]\n1: [text · Ren → Mara] "Are you up?"');
    // (보내는 칸은 모두 폰 1 번역 지시문의 YOU GET에 있어요)
    const tr = await readFile(new URL('phonetr.js', SRC), 'utf8'), sys = tr.slice(tr.indexOf('export const AI_SYS_PHONE_KO'), tr.indexOf('export const AI_SYS_PHONE_VOICE')), get = sys.slice(sys.indexOf('YOU GET'), sys.indexOf('\nVOICE\n'));
    for (const b of [...input.matchAll(/^\[([A-Z' ]+)\]$/gm)].map(x => x[1])) assert.ok(get.includes(`- ${b}`), b);
    assert.ok(sys.includes('"[app · who → to]"') && sys.includes('{ "lines": [{ "n": its number, "ko": the Korean }] }'));
    const keep = { ...E.EDIT }; Object.assign(E.EDIT, { lines: 2, chars: 9000 });
    try { assert.deepEqual(E.koChunks(rows).map(c => [c.rows.length, c.size]), [[2, 18], [2, 18], [1, 9]]); } finally { Object.assign(E.EDIT, keep); }
    Object.assign(E.EDIT, { lines: 60, chars: 12 });
    try { assert.deepEqual(E.koChunks(rows).map(c => c.rows.map(r => r.x.text)), [['Are you up?'], ['Barely.'], ['Dinner?'], ['Did you eat'], ['Answer me']]); } finally { Object.assign(E.EDIT, keep); }
    assert.deepEqual(E.koChunks([]), []);
});

test('답 넣기: 번호대로 그 말의 한국어만 바꿔요. 답에 없는 줄 · 빈 답은 그대로, 원문과 같으면 한국어 칸을 비워요', () => {
    const { m, a } = world(), { rows } = E.koRows(m, a.id, a.messages.map(x => x.id)), was = a.messages.map(x => ({ ...x }));
    const n = E.takeKo(rows, { lines: [{ n: 2, ko: ' 간신히. ' }, { n: 4, ko: '' }, { n: 5, ko: 'Answer me' }, { n: 9, ko: '없는 줄' }, { n: 2, ko: '두 번째 답' }, { n: 1, ko: '일어났어?' }] });
    assert.equal(n, 3);
    assert.deepEqual(a.messages.map(x => x.ko), ['일어났어?', '간신히.', undefined, '밥 먹었어', undefined, undefined]);
    // (한국어 말고는 아무것도 안 바뀌어요)
    assert.deepEqual(a.messages.map(({ ko, ...x }) => x), was.map(({ ko, ...x }) => x));
    for (const bad of [null, {}, { lines: 'x' }, { lines: [null, { n: 'a', ko: 'x' }] }]) assert.equal(E.takeKo(rows, bad), 0);
});

test('이 파일은 폰 2 저장 자리만 불러요; 모델 · 저장은 안 불러요; 폰 1 파일은 이 파일을 안 불러요', async () => {
    const src = await readFile(new URL('phone2edit.js', SRC), 'utf8');
    assert.deepEqual([...src.matchAll(/from '([^']+)'/g)].map(x => x[1]), ['./phone2store.js']);
    assert.doesNotMatch(src, /saveMeta|ctx\(|askDraft|askTranslator|boundary/);
    for (const f of (await readdir(SRC)).filter(f => f.endsWith('.js') && !/^phone2/.test(f) && f !== 'phone.js')) assert.doesNotMatch(await readFile(new URL(f, SRC), 'utf8'), /phone2edit/, f);
});
