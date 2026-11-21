// 폰 2 메신저의 말 고치기 (src/phone2edit.js): 지우기 · 답장 넘기기(스와이프) · 한국어 다시 받기의 고르기와 요청 글 · 답 넣기만 봐요.
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

test('글 고치기: 원문을 바꾸면 한국어는 지워지고, 한국어만도 고쳐요. 번호 · 시간 · 반응은 그대로; 빈 글 · 말 없는 메시지는 안 돼요', () => {
    const { m, w, a } = world(), [mine, hers, , , act] = a.messages, was = { ...hers };
    hers.reacts = [{ by: 'Ren', e: '❤️', at: 1 }];
    // 원문: 한국어는 지워져요
    assert.equal(E.editMessage(m, a.id, hers.id, { text: '  Hardly.\r\nReally.  ' }, 77), hers);
    assert.deepEqual([hers.text, hers.ko, hers.edited], ['Hardly.\nReally.', undefined, 77]);
    assert.deepEqual([hers.id, hers.n, hers.at, hers.from, hers.reacts.length], [was.id, was.n, was.at, was.from, 1]);
    // 한국어만 · 원문과 한국어를 같이
    assert.equal(E.editMessage(m, a.id, hers.id, { ko: ' 겨우요. ' }, 78).ko, '겨우요.'); assert.equal(hers.text, 'Hardly.\nReally.');
    E.editMessage(m, a.id, hers.id, { text: 'Barely.', ko: '간신히.' }, 79);
    assert.deepEqual([hers.text, hers.ko, hers.edited], ['Barely.', '간신히.', 79]);
    // 한국어를 비우거나 원문과 같게 하면 한국어 칸이 없어져요
    E.editMessage(m, a.id, hers.id, { ko: 'Barely.' }); assert.equal(hers.ko, undefined);
    E.editMessage(m, a.id, hers.id, { ko: '겨우' }); E.editMessage(m, a.id, hers.id, { ko: '' }); assert.equal(hers.ko, undefined);
    // 내 말도 고쳐요; 바뀐 게 없으면 null (고친 때도 안 바뀌어요)
    assert.equal(E.editMessage(m, a.id, mine.id, { text: 'You up?' }, 80).text, 'You up?');
    assert.equal(E.editMessage(m, a.id, mine.id, { text: 'You up?' }, 81), null); assert.equal(E.editMessage(m, a.id, mine.id, {}, 82), null); assert.equal(mine.edited, 80);
    // 못 고칠 때: 아무것도 안 바뀌어요
    const still = JSON.stringify(w.messenger.rooms);
    for (const t of ['', '   ', '\n']) assert.throws(() => E.editMessage(m, a.id, hers.id, { text: t }), /빈 글로는 바꿀 수 없어요/);
    assert.throws(() => E.editMessage(m, a.id, act.id, { text: 'x' }), /고칠 수 없는 말이에요/);
    assert.throws(() => E.editMessage(m, a.id, 'none', { text: 'x' }), /없는 말이에요/);
    assert.throws(() => E.editMessage(m, 'nope', hers.id, { text: 'x' }), /없는 방이에요/);
    assert.equal(JSON.stringify(w.messenger.rooms), still);
    assert.equal(E.editMessage(m, a.id, hers.id, { text: 'x'.repeat(5000) }).text.length, 4000);
});

test('맨 끝 답장: 방의 맨 끝, 내 마지막 말 뒤에 온 말들 (폰으로 한 일만 있는 말도). 내 말이 없는 방 · 맨 끝이 내 말이면 없음', () => {
    const { m, a, g, say } = world();
    assert.deepEqual(E.replyTail(m, a.id).map(x => x.text || '(act)'), ['Did you eat', '(act)', 'Answer me']);
    assert.deepEqual(E.swipeInfo(m, a.id), { at: 1, count: 1, coming: false, prev: false, next: true });
    L.sendLive(m, a.id, 'hello?', 5000);
    assert.deepEqual(E.replyTail(m, a.id), []); assert.equal(E.swipeInfo(m, a.id), null);
    say(g, 'Ivo', 'anyone here', 100);
    assert.deepEqual(E.replyTail(m, g.id), []); assert.equal(E.swipeInfo(m, g.id), null);
    assert.equal(E.swipeInfo(m, 'nope'), null);
    assert.throws(() => E.swipeTo(m, g.id, 1), /넘길 답장이 없어요/);
});

test('넘기기: 맨 뒤에서 넘기면 새 답장 자리, 받아 둔 답장 사이는 바로 오가요. 받아 둔 답장은 버리지 않아요', () => {
    const { m, w, a, say } = world(), first = a.messages.slice(3), head = a.messages.slice(0, 3);
    // 새로 받기: 보이던 답장은 받아 둔 것이 되고 방에서 빠져요
    assert.deepEqual(E.swipeTo(m, a.id, 1), { at: 2, count: 2, fresh: true });
    assert.deepEqual(a.messages, head);
    assert.deepEqual(E.swipeInfo(m, a.id), { at: 2, count: 2, coming: false, prev: false, next: false });
    // (답장이 온 것처럼)
    const second = [say(a, 'Mara', 'Hello?', 6000)];
    assert.deepEqual(E.swipeInfo(m, a.id), { at: 2, count: 2, coming: false, prev: true, next: true });
    // 앞으로 · 뒤로: 그 답장의 말이 그대로(번호 · 시간 · 번역 · 표시까지) 돌아와요
    assert.deepEqual(E.swipeTo(m, a.id, -1), { at: 1, count: 2, fresh: false });
    assert.deepEqual(a.messages, [...head, ...first]);
    assert.throws(() => E.swipeTo(m, a.id, -1), /첫 번째 답장이에요/);
    assert.deepEqual(E.swipeTo(m, a.id, 1), { at: 2, count: 2, fresh: false });
    assert.deepEqual(a.messages, [...head, ...second]);
    assert.deepEqual(E.swipeTo(m, a.id, 1), { at: 3, count: 3, fresh: true });
    const third = [say(a, 'Mara', 'Third', 7000)];
    // 내가 다음 말을 보내도 받아 둔 답장은 남아요 (그 답장 자리에); 새 맨 끝 답장은 따로예요
    const anchor = head[2].id;
    L.sendLive(m, a.id, 'ok', 8000); say(a, 'Mara', 'fine', 9000);
    assert.deepEqual(a.swipes[anchor].list, [first, second, null]);
    assert.deepEqual(E.swipeInfo(m, a.id), { at: 1, count: 1, coming: false, prev: false, next: true });
    // 그 뒤의 말을 지워서 다시 맨 끝이 되면 또 넘길 수 있어요
    E.dropMessages(m, a.id, a.messages.slice(-2).map(x => x.id));
    assert.deepEqual(E.swipeInfo(m, a.id), { at: 3, count: 3, coming: false, prev: true, next: true });
    assert.deepEqual(E.swipeTo(m, a.id, -1), { at: 2, count: 3, fresh: false });
    assert.deepEqual(a.messages, [...head, ...second]);
    assert.deepEqual(a.swipes[anchor].list, [first, null, third]);
    // 내 말을 지우면 그 말에 받아 둔 답장도 같이 가요
    E.dropMessages(m, a.id, [anchor]);
    assert.equal(a.swipes, undefined);
    assert.equal(w.messenger.seq, Math.max(...[...first, ...second, ...third].map(x => x.n), ...a.messages.map(x => x.n)) + 2);
});

test('못 넘길 때: 답장이 오는 중 · 답장할 폰이 없는 방(새로 받기만) · 너무 많이 받아 둠 — 아무것도 안 바꿔요', () => {
    const { m, w, a, g, say } = world();
    const job = L.enqueueReplies(m, a.id)[0], was = JSON.stringify(w.messenger.rooms);
    assert.equal(E.replyComing(m, a.id), true);
    assert.deepEqual(E.swipeInfo(m, a.id), { at: 1, count: 1, coming: true, prev: false, next: false });
    for (const st of ['waiting', 'running']) {
        job.state = st;
        assert.throws(() => E.swipeTo(m, a.id, 1), /답장이 오는 중이에요/); assert.throws(() => E.dropSwipe(m, a.id), /답장이 오는 중이에요/);
    }
    assert.equal(JSON.stringify(w.messenger.rooms), was);
    // (다른 방의 답장 · 끝난 답장은 상관없어요)
    job.state = 'done'; L.enqueueReplies(m, g.id);
    assert.equal(E.replyComing(m, a.id), false);
    // 너무 많이 받아 둠
    const keep = E.SWIPE.max; E.SWIPE.max = 2;
    try {
        E.swipeTo(m, a.id, 1); say(a, 'Mara', 'two', 6000);
        assert.equal(E.swipeInfo(m, a.id).next, false);
        const full = JSON.stringify(a);
        assert.throws(() => E.swipeTo(m, a.id, 1), /받아 둔 답장이 2개예요/);
        assert.equal(JSON.stringify(a), full);
        assert.equal(E.swipeTo(m, a.id, -1).at, 1); assert.equal(E.swipeInfo(m, a.id).next, true);
    } finally { E.SWIPE.max = keep; }
    // 답장할 폰이 없는 방: 받아 둔 답장 사이는 오가도 새로는 못 받아요
    delete w.phones.mara;
    assert.equal(E.swipeTo(m, a.id, 1).at, 2);
    assert.deepEqual(E.swipeInfo(m, a.id), { at: 2, count: 2, coming: false, prev: true, next: false });
    const still = JSON.stringify(a);
    assert.throws(() => E.swipeTo(m, a.id, 1), /답장할 폰이 없어요/);
    assert.equal(JSON.stringify(a), still);
});

test('보이는 답장 지우기 · 새 답장을 못 받았을 때: 앞의 답장(없으면 다음 것)이 다시 보여요. 하나뿐이면 답장이 없어져요', () => {
    const { m, a, say } = world(), first = a.messages.slice(3), head = a.messages.slice(0, 3);
    E.swipeTo(m, a.id, 1); const second = [say(a, 'Mara', 'two', 6000)];
    E.swipeTo(m, a.id, 1); const third = [say(a, 'Mara', 'three', 7000)];
    // 가운데 것을 지우면 앞의 것이 보여요
    E.swipeTo(m, a.id, -1);
    assert.deepEqual(E.dropSwipe(m, a.id), { dropped: 1, at: 1, count: 2 });
    assert.deepEqual(a.messages, [...head, ...first]);
    // 첫 것을 지우면 다음 것이 보여요
    assert.deepEqual(E.dropSwipe(m, a.id), { dropped: 1, at: 1, count: 1 });
    assert.deepEqual(a.messages, [...head, ...third]);
    assert.equal(a.swipes, undefined);
    // 새로 받으려다 못 받았으면(오는 답장이 없는데 자리가 비었으면) 앞의 답장이 다시 보여요
    E.swipeTo(m, a.id, 1);
    assert.deepEqual(a.messages, head);
    assert.equal(E.settleSwipes(m, a.id), true);
    assert.deepEqual(a.messages, [...head, ...third]);
    assert.deepEqual(E.swipeInfo(m, a.id), { at: 1, count: 1, coming: false, prev: false, next: true });
    assert.equal(E.settleSwipes(m, a.id), false);
    // 하나뿐인 답장을 지우면 답장이 없어져요 (받아 둔 기록도)
    assert.deepEqual(E.dropSwipe(m, a.id), { dropped: 1, at: 0, count: 0 });
    assert.deepEqual(a.messages, head); assert.equal(a.swipes, undefined); assert.equal(E.swipeInfo(m, a.id), null);
    assert.throws(() => E.dropSwipe(m, a.id), /지울 답장이 없어요/);
    // 망가진 기록은 버려요
    say(a, 'Mara', 'again', 8000);
    a.swipes = { [head[2].id]: { list: [null, null], at: 0 } };
    assert.deepEqual(E.swipeInfo(m, a.id), { at: 1, count: 1, coming: false, prev: false, next: true });
});

test('받아 둔 답장 목록 · 골라 지우기 · 지금 것만 남기기', () => {
    const { m, w, a, say } = world(), first = a.messages.slice(3), head = a.messages.slice(0, 3);
    // 받아 둔 게 없어도 지금 답장 하나가 목록이에요; 글 없는 말(폰으로 한 일)은 말풍선에 없어요
    assert.deepEqual(E.swipeList(m, a.id), [{ no: 1, now: true, bubbles: [{ text: 'Did you eat', ko: '밥 먹었어' }, { text: 'Answer me', ko: '대답해' }] }]);
    E.swipeTo(m, a.id, 1); const second = [say(a, 'Mara', 'two', 6000)];
    E.swipeTo(m, a.id, 1); const third = [say(a, 'Mara', 'three', 7000, { ko: '셋' })];
    E.swipeTo(m, a.id, 1); const fourth = [say(a, 'Mara', 'four', 8000)];
    E.swipeTo(m, a.id, -1);
    const was = JSON.stringify(a);
    assert.deepEqual(E.swipeList(m, a.id).map(v => [v.no, v.now, v.bubbles.map(b => b.text).join('|'), v.bubbles[0].ko]), [[1, false, 'Did you eat|Answer me', '밥 먹었어'], [2, false, 'two', ''], [3, true, 'three', '셋'], [4, false, 'four', '']]);
    assert.equal(E.swipeList(m, a.id).find(v => v.now).no, E.swipeInfo(m, a.id).at);
    assert.equal(JSON.stringify(a), was);
    // 보이지 않는 것만 골라 지우기: 보이는 답장은 그대로, 번호가 당겨져요. 없는 번호는 건너뛰어요
    assert.deepEqual(E.dropSwipes(m, a.id, [2, 9, 0, 2, 'x']), { dropped: 1, at: 2, count: 3 });
    assert.deepEqual(a.messages, [...head, ...third]);
    assert.deepEqual(a.swipes[head[2].id], { list: [first, null, fourth], at: 1 });
    assert.deepEqual(E.dropSwipes(m, a.id, []), { dropped: 0, at: 2, count: 3 });
    // 보이는 것까지 지우기: 남은 것 중 앞의 것이 보여요 (앞이 없으면 다음 것)
    assert.deepEqual(E.dropSwipes(m, a.id, [2, 3]), { dropped: 2, at: 1, count: 1 });
    assert.deepEqual(a.messages, [...head, ...first]); assert.equal(a.swipes, undefined);
    E.swipeTo(m, a.id, 1); const fifth = [say(a, 'Mara', 'five', 9000)];
    E.swipeTo(m, a.id, -1);
    assert.deepEqual(E.dropSwipes(m, a.id, 1), { dropped: 1, at: 1, count: 1 });
    assert.deepEqual(a.messages, [...head, ...fifth]);
    // (보이는 것을 지우면 바로 앞에 남은 것이 보여요: 첫 것이 아니라)
    E.swipeTo(m, a.id, 1); const p2 = [say(a, 'Mara', 'p2', 9100)];
    E.swipeTo(m, a.id, 1); say(a, 'Mara', 'p3', 9200);
    E.swipeTo(m, a.id, 1); say(a, 'Mara', 'p4', 9300);
    E.swipeTo(m, a.id, -1);
    assert.deepEqual(E.dropSwipes(m, a.id, [3]), { dropped: 1, at: 2, count: 3 });
    assert.deepEqual(a.messages, [...head, ...p2]);
    assert.deepEqual(E.dropSwipes(m, a.id, [1, 3]), { dropped: 2, at: 1, count: 1 });
    // 지금 것만 남기기
    E.swipeTo(m, a.id, 1); say(a, 'Mara', 'six', 10000);
    E.swipeTo(m, a.id, 1); say(a, 'Mara', 'seven', 11000);
    E.swipeTo(m, a.id, -1);
    assert.deepEqual(E.dropOtherSwipes(m, a.id), { dropped: 2, at: 1, count: 1 });
    assert.deepEqual(texts(a).slice(3), ['six']); assert.equal(a.swipes, undefined);
    assert.deepEqual(E.dropOtherSwipes(m, a.id), { dropped: 0, at: 1, count: 1 });
    assert.deepEqual(E.swipeList(m, a.id).map(v => [v.no, v.now]), [[1, true]]);
    // 전부 지우면 답장이 없어져요
    E.swipeTo(m, a.id, 1); say(a, 'Mara', 'eight', 12000);
    assert.deepEqual(E.dropSwipes(m, a.id, [1, 2]), { dropped: 2, at: 0, count: 0 });
    assert.deepEqual(a.messages, head); assert.equal(a.swipes, undefined); assert.deepEqual(E.swipeList(m, a.id), []);
    // 답장이 오는 중 · 답장이 없을 때는 아무것도 안 바꿔요
    assert.throws(() => E.dropSwipes(m, a.id, [1]), /지울 답장이 없어요/); assert.throws(() => E.dropOtherSwipes(m, a.id), /남길 답장이 없어요/);
    say(a, 'Mara', 'nine', 13000); L.enqueueReplies(m, a.id);
    const still = JSON.stringify(w.messenger.rooms);
    assert.throws(() => E.dropSwipes(m, a.id, [1]), /답장이 오는 중이에요/); assert.throws(() => E.dropOtherSwipes(m, a.id), /답장이 오는 중이에요/);
    assert.equal(JSON.stringify(w.messenger.rooms), still);
    assert.deepEqual(E.swipeList(m, 'nope'), []);
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
    // 원문에 없는 마침표 · 쉼표는 번역에서 떼요 (원문에 있으면 그대로)
    E.takeKo(rows, { lines: [{ n: 4, ko: '밥은, 먹었어.' }, { n: 2, ko: '겨우, 일어났어.' }] });
    assert.deepEqual([a.messages[3].ko, a.messages[1].ko], ['밥은 먹었어', '겨우 일어났어.']);
});

test('이 파일은 폰 2 저장 자리만 불러요; 모델 · 저장은 안 불러요; 폰 1 파일은 이 파일을 안 불러요', async () => {
    const src = await readFile(new URL('phone2edit.js', SRC), 'utf8');
    assert.deepEqual([...src.matchAll(/from '([^']+)'/g)].map(x => x[1]), ['./phone2store.js', './phone2react.js', './phone2reply.js']);
    assert.doesNotMatch(src, /saveMeta|ctx\(|askDraft|askTranslator|boundary/);
    for (const f of (await readdir(SRC)).filter(f => f.endsWith('.js') && !/^phone2/.test(f) && f !== 'phone.js')) assert.doesNotMatch(await readFile(new URL(f, SRC), 'utf8'), /phone2edit/, f);
});
