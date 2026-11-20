// 폰 2 메신저의 이모지 반응 (src/phone2react.js): 이모지 확인 · 달기 · 답장의 반응 · 넘기기와 같이 움직이기.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import * as L from '../src/phone2store.js';
import * as X from '../src/phone2react.js';
import * as E from '../src/phone2edit.js';
import * as R from '../src/phone2run.js';
import { messengerBlock } from '../src/phone2ask.js';

const SRC = new URL('../src/', import.meta.url);
function world() {
    const m = { phones: {} };
    L.startFresh(m, { persona: 'Ren', scope: 'test' });
    const w = L.liveWorld(m);
    w.phones = { mara: { owner: 'Mara' }, ivo: { owner: 'Ivo' } };
    const a = L.ensureRoom(m, ['Mara']), g = L.ensureRoom(m, ['Mara', 'Ivo']);
    return { m, w, a, g };
}
const reacts = x => (x.reacts || []).map(r => `${r.by} ${r.e}${r.via ? ` via ${r.via.length}` : ''}`);

test('이모지 한 덩어리만: 피부색 · 합친 이모지 · 국기 · 숫자 키캡도 하나. 글자 · 여러 개 · 빈 것은 버려요', () => {
    for (const e of ['❤️', '❤', '😂', '🥺', '😎', '👍🏽', '👨‍👩‍👧', '🏳️‍🌈', '❤️‍🔥', '🧑🏽‍💻', '🇰🇷', '1️⃣', '#️⃣', '🏴󠁧󠁢󠁥󠁮󠁧󠁿', '©️']) assert.equal(X.emojiOf(` ${e} `), e, e);
    for (const bad of ['', '  ', null, undefined, 'lol', 'ㅋㅋ', '😂😂', '❤️ 😂', 'a😂', '😂a', '1', '🇰', '👍🏽👍', ':heart:', '<3', 42]) assert.equal(X.emojiOf(bad), '', String(bad));
});

test('달기: 한 사람은 한 말에 하나 (다시 달면 바뀌고, 비우면 지워져요); MESSENGER 줄 끝에 누가 무엇을', () => {
    const x = { id: 'x', from: 'Mara', text: 'Bring Kuchen mit' };
    assert.equal(X.putReact(x, 'Ren', '❤️', { at: 5 }), true);
    assert.equal(X.putReact(x, 'ivo', '😂', { at: 6, via: ['t1'] }), true);
    assert.deepEqual(x.reacts, [{ by: 'Ren', e: '❤️', at: 5 }, { by: 'ivo', e: '😂', at: 6, via: ['t1'] }]);
    assert.equal(X.putReact(x, 'REN', '🥺', { at: 7 }), true);
    assert.equal(X.putReact(x, 'Ren', '🥺', { at: 8 }), false);
    assert.deepEqual(reacts(x), ['ivo 😂 via 1', 'Ren 🥺']);
    assert.equal(X.reactOf(x, 'ren').e, '🥺'); assert.equal(X.reactOf(x, 'Mara'), null);
    assert.equal(X.reactLine(x), 'ivo 😂, Ren 🥺');
    assert.equal(X.putReact(x, 'ivo', ''), true); assert.equal(X.putReact(x, 'Ren', ''), true);
    assert.equal(x.reacts, undefined); assert.equal(X.reactLine(x), ''); assert.equal(X.reactLine(null), '');
    // (답장 요청의 MESSENGER 줄: 말 뒤에 [ ])
    assert.equal(messengerBlock('Mara', [{ at: '11-20 16:28', from: 'Mara', text: 'Bring Kuchen mit', state: 'home', reacts: 'Ren ❤️' }, { at: '11-20 16:29', from: 'Ren', text: 'ok', reacts: '' }]),
        '[MESSENGER]\n11-20 16:28 · Mara (home): Bring Kuchen mit [Ren ❤️]\n11-20 16:29 · Ren: ok');
});

test('바로 누르는 줄: 처음엔 ❤️ 😂 😮 😢 😡 👍, 내가 쓴 것이 맨 앞으로 와요 (6개)', () => {
    const { w } = world();
    assert.deepEqual(X.quickReacts(w), ['❤️', '😂', '😮', '😢', '😡', '👍']);
    X.noteRecent(w, '🥺'); X.noteRecent(w, '😎'); X.noteRecent(w, '🥺'); X.noteRecent(w, '😂'); X.noteRecent(w, 'lol');
    assert.deepEqual(w.messenger.reactRecent, ['😂', '🥺', '😎']);
    assert.deepEqual(X.quickReacts(w), ['😂', '🥺', '😎', '❤️', '😮', '😢']);
    for (const e of ['🍰', '☕', '🎉', '🔥', '🌙', '🐱', '🍀']) X.noteRecent(w, e);
    assert.deepEqual(X.quickReacts(w), ['🍀', '🐱', '🌙', '🔥', '🎉', '☕']);
    for (const e of ['😀', '😁', '😆', '😅', '🤣', '😇', '🙂', '🙃', '😉', '😌', '😍', '🥰', '😘', '😗', '😙', '😚', '😋', '😛', '😝', '😜', '🤪', '🤨', '🧐', '🤓', '🥸']) X.noteRecent(w, e);
    assert.equal(w.messenger.reactRecent.length, X.REACT.kept);
    assert.deepEqual(X.quickReacts(null), X.REACT.quick);
});

test('답장의 반응: 기본은 내 마지막 말에, "to"면 그 사람의 마지막 말에. 자기 말 · 없는 사람 · 이모지가 아닌 것은 버려요', () => {
    const { m, w, g } = world();
    const say = (from, text, extra = {}) => { const x = { id: `x${g.messages.length}`, n: L.liveNo(w), from, text, at: g.messages.length, ...extra }; g.messages.push(x); return x; };
    const r1 = say('Ren', 'cake?'), i1 = say('Ivo', 'yes'), r2 = say('Ren', 'Bring Kuchen mit'); say('Ren', '', { act: true }); say('Mara', 'hm');
    const o = { owner: 'Mara', persona: 'Ren', members: g.members, messages: g.messages };
    assert.deepEqual(X.replyReact('😂', o), { on: r2, e: '😂' });
    assert.deepEqual(X.replyReact({ to: 'Ren', emoji: '🥺' }, o), { on: r2, e: '🥺' });
    assert.deepEqual(X.replyReact({ to: 'ivo', emoji: '👍🏽' }, o), { on: i1, e: '👍🏽' });
    assert.deepEqual(X.replyReact({ emoji: '❤️' }, o), { on: r2, e: '❤️' });
    for (const bad of [{ to: 'Mara', emoji: '😂' }, { to: 'Lio', emoji: '😂' }, { to: 'Ren', emoji: 'lol' }, { to: 'Ren', emoji: '😂😂' }, 'haha', '', null, [], { to: 'Ren' }]) assert.equal(X.replyReact(bad, o), null, JSON.stringify(bad));
    // (말이 없는 사람에게는 못 달아요)
    assert.equal(X.replyReact('😂', { ...o, messages: [] }), null);
    assert.ok(r1);
});

test('답장 넣기: 말과 같이 단 반응은 그 답장에 묶이고, 반응만 했으면 말이 안 생겨요(넘기기 · 버리기 대상 아님)', () => {
    const { m, a } = world();
    const anchor = L.sendLive(m, a.id, 'Bring Kuchen mit', 1000);
    // 말과 같이
    assert.deepEqual(R.takeReply(m, 'Mara', a.id, { state: '10:00 · home', reply: ['ok', 'which one'], react: { to: 'Ren', emoji: '❤️' }, does: [] }, { now: 2000 }), { said: 2, does: 0, state: 'home', react: '❤️' });
    assert.deepEqual(anchor.reacts, [{ by: 'Mara', e: '❤️', at: 2000, via: a.messages.slice(1).map(x => x.id) }]);
    // 반응만 (상태는 있어도): 말이 안 생겨요
    const next = L.sendLive(m, a.id, 'cheesecake', 3000), n = a.messages.length;
    assert.deepEqual(R.takeReply(m, 'Mara', a.id, { state: '10:05 · home', reply: [], react: '😎', does: [] }, { now: 4000 }), { said: 0, does: 0, state: 'home', react: '😎' });
    assert.equal(a.messages.length, n); assert.deepEqual(next.reacts, [{ by: 'Mara', e: '😎', at: 4000 }]);
    assert.equal(E.swipeInfo(m, a.id), null);
    // 반응 + 폰으로 한 일: 말 없는 메시지(act)에 묶여요
    const third = L.sendLive(m, a.id, 'buy it', 5000);
    R.takeReply(m, 'Mara', a.id, { state: 'shop', reply: [], react: '👍', does: [{ app: 'Notes', what: 'writes cheesecake on the list' }] }, { now: 6000 });
    assert.ok(a.messages.at(-1).act); assert.deepEqual(third.reacts[0].via, [a.messages.at(-1).id]);
    // 이모지가 아니거나 비었으면 반응 없음 (나머지는 그대로)
    L.sendLive(m, a.id, 'bye', 7000);
    assert.equal(R.takeReply(m, 'Mara', a.id, { state: 'shop', reply: ['bye'], react: 'lol' }, { now: 8000 }).react, '');
    assert.equal(R.takeReply(m, 'Mara', a.id, { state: 'shop', reply: ['bye bye'], react: '' }, { now: 8100 }).react, '');
    assert.ok(a.messages.every(x => !x.reacts || x.from === 'Ren'));
});

test('넘기기: 답장이 단 반응은 그 답장과 같이 빠졌다 돌아와요. 내가 단 반응 · 반응만 한 답장은 그대로', () => {
    const { m, a } = world();
    const anchor = L.sendLive(m, a.id, 'Bring Kuchen mit', 1000);
    R.takeReply(m, 'Mara', a.id, { state: 'home', reply: ['ok'], react: '❤️' }, { now: 2000 });
    X.putReact(anchor, 'Ren', '🍰');
    const first = a.messages.slice(1);
    // 새 답장 자리: ❤️가 빠지고 그 답장에 맡겨져요
    E.swipeTo(m, a.id, 1);
    assert.deepEqual(reacts(anchor), ['Ren 🍰']);
    assert.deepEqual(first[0].reactsOut.map(r => [r.on, r.by, r.e]), [[anchor.id, 'Mara', '❤️']]);
    R.takeReply(m, 'Mara', a.id, { state: 'home', reply: ['which kind'], react: '😂' }, { now: 3000 });
    assert.deepEqual(reacts(anchor), ['Ren 🍰', 'Mara 😂 via 1']);
    // 앞으로: 😂가 빠지고 ❤️가 돌아와요
    E.swipeTo(m, a.id, -1);
    assert.deepEqual(reacts(anchor), ['Ren 🍰', 'Mara ❤️ via 1']);
    assert.equal(first[0].reactsOut, undefined);
    // 반응 없는 답장으로 넘기면 캐릭터 반응이 없어요
    E.swipeTo(m, a.id, 1); E.swipeTo(m, a.id, 1);
    R.takeReply(m, 'Mara', a.id, { state: 'home', reply: ['hm'] }, { now: 4000 });
    assert.deepEqual(reacts(anchor), ['Ren 🍰']);
    // 보이는 답장을 버리면 그 답장의 반응도 같이 가고, 앞의 답장의 것이 돌아와요
    assert.deepEqual(E.dropSwipes(m, a.id, [3]), { dropped: 1, at: 2, count: 2 });
    assert.deepEqual(reacts(anchor), ['Ren 🍰', 'Mara 😂 via 1']);
    // 지금 것만 남기기: 버린 답장의 반응은 다시 안 나와요
    assert.deepEqual(E.dropOtherSwipes(m, a.id), { dropped: 1, at: 1, count: 1 });
    assert.deepEqual(reacts(anchor), ['Ren 🍰', 'Mara 😂 via 1']);
    E.dropSwipes(m, a.id, [1]);
    assert.deepEqual(reacts(anchor), ['Ren 🍰']);
});

test('이 파일은 폰 2 저장 자리만 불러요; 모델 · 저장은 안 불러요; 폰 1 파일은 이 파일을 안 불러요', async () => {
    const src = await readFile(new URL('phone2react.js', SRC), 'utf8');
    assert.deepEqual([...src.matchAll(/from '([^']+)'/g)].map(x => x[1]), ['./phone2store.js']);
    assert.doesNotMatch(src, /saveMeta|ctx\(|askDraft|askTranslator|boundary/);
    for (const f of (await readdir(SRC)).filter(f => f.endsWith('.js') && !/^phone2/.test(f) && f !== 'phone.js')) assert.doesNotMatch(await readFile(new URL(f, SRC), 'utf8'), /phone2react/, f);
});
