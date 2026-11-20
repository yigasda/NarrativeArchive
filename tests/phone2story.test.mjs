// 폰 2가 읽는 이야기 (단계 5-1): the real archive parser (sections.js) with its UI neighbours stubbed
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const enc = s => 'data:text/javascript;base64,' + Buffer.from(s).toString('base64');
const stub = enc(`export const ctx=()=>({});export const getMeta=()=>({});export const saveMeta=async()=>{};export const applyInjection=()=>{};export const syncPanel=()=>{};
export const routerCandidates=()=>[];export const routerCfg=()=>({});export const routerState=new Map();export const currentChatId=()=>'';
export const countTokens=s=>String(s).length;export const esc=s=>String(s);export const escRe=s=>String(s).replace(/[.*+?^\${}()|[\\]\\\\]/g,'\\\\$&');export const fmt=n=>String(n);`);
const src = async f => readFile(new URL(`../src/${f}`, import.meta.url), 'utf8');
let sec = await src('sections.js');
for (const f of ['./chats.js', './core.js', './inject.js', './panel.js', './router.js', './util.js']) sec = sec.replaceAll(`'${f}'`, `'${stub}'`);
const store = new URL('../src/phone2store.js', import.meta.url).href, clock = new URL('../src/phone2clock.js', import.meta.url).href;
const S = await import(enc((await src('phone2story.js')).replace(`'./sections.js'`, `'${enc(sec)}'`).replace(`'./phone2store.js'`, `'${store}'`).replace(`'./phone2clock.js'`, `'${clock}'`)));
const L = await import(store);

// an archive: a section from an older chat (Y1, its own numbers), this chat's sections, a note with no range, the state
const ARCH = [
    '# ── Y1 ──', '## Y1 #0–#300 — The first year', '- Mara moved to Varo.', '',
    '# ── Y2 ──', '## #0–#60 — Spring', '- Ren met Mara.', '', '## #61–#130 — Summer', '- The flood.', '',
    '## People', '- Ivo runs the garage.', '',
    '# STATE AT #130', '- Mara is at home.', '# OPEN', '- The key.',
].join('\n');
const meta = (text = ARCH, boundary = 130) => ({ text, boundary, phones: { mara: { owner: 'Mara' } } });
const begun = (m, upto = 150) => S.beginFromStory(m, { persona: 'Lio', upto });

const SNAP = { v: 1, at: 5, upto: 150, text: '## #0–#150 — All\n- SNAP the story so far.\n\n---\n# STATE AT #150\n- SNAP state.\n', recent: ['[#149] Mara: last', '[#150 · USER] Ren: words'], made: { from: 131, to: 150, count: 20, parts: 1 } };

test('이야기 글: 요약본의 글만. 요약본이 아직 없는 폰 · 처음부터 시작한 폰은 빈 글이고, 아카이브는 안 읽어요', () => {
    const m = meta(), w = begun(m);
    // (요약본 방식 전에 시작해 둔 폰: 요약본을 받기 전에는 아는 이야기가 없어요. 표시(ranges · titles)도 안 남겨요)
    assert.equal(S.liveStoryText(m, w), '');
    assert.ok(!('story' in w) && w.storyUpto === 150);
    w.snap = structuredClone(SNAP);
    assert.equal(S.liveStoryText(m, w), SNAP.text);
    m.text = '## #0–#999 — Rewritten\n- other.'; assert.equal(S.liveStoryText(m, w), SNAP.text);
    // 모양이 틀린 요약본 · 처음부터 시작한 폰 · 폰 없음
    assert.equal(S.liveStoryText(m, { from: 'story', storyUpto: 3, snap: { text: 'x', recent: 'no', upto: 3 } }), '');
    assert.equal(S.liveStoryText(m, { ...L.startFresh(meta(), { persona: 'Lio' }), snap: SNAP }), '');
    assert.equal(S.liveStoryText(m, null), '');
    assert.throws(() => S.beginFromStory(meta(), { persona: 'Lio', upto: -1 }), /어느 메시지까지/);
});

test('서랍의 text: 요약본의 글 (채팅의 아카이브가 아니에요), 쓰면 서랍에만', () => {
    const m = meta(), w = S.beginFromStory(m, { persona: 'Lio', upto: 150, snap: SNAP });
    const v = L.liveMeta(m);
    assert.equal(v.text, SNAP.text);
    assert.doesNotMatch(v.text, /The flood/);
    m.text += '\n## #131–#150 — Later\n- later';
    assert.equal(v.text, SNAP.text);
    v.text = 'x';
    assert.equal(v.text, 'x');
    assert.match(m.text, /The flood/);
    assert.equal(w.snap.text, SNAP.text);
    assert.equal(L.liveMeta(m).text, SNAP.text);
    assert.ok(Object.keys(v).includes('text'));
    // 요약본이 없으면 빈 글 (아카이브를 대신 주지 않아요)
    const m2 = meta(); begun(m2);
    assert.equal(L.liveMeta(m2).text, '');
    assert.equal(L.liveMeta(m2, { text: () => 'the caller\'s text' }).text, '');
});

// 요약본으로 시작 (phone2snap.js가 만든 것): 이야기 글은 그 요약본. 아카이브를 다시 읽지 않아요
test('요약본으로 시작한 폰 2: 요약본을 복사해 두고, 이야기 글은 그 글 그대로; 아카이브가 바뀌어도 그대로', () => {
    const m = meta(), snap = structuredClone(SNAP);
    const before = JSON.stringify(m.phones), w = S.beginFromStory(m, { persona: 'Lio', upto: 150, snap });
    assert.deepEqual(w.snap, snap); assert.notEqual(w.snap, snap); assert.notEqual(w.snap.recent, snap.recent);
    // (준 요약본을 나중에 고쳐도 폰 2의 것은 그대로)
    snap.text = 'changed'; snap.recent.push('x');
    assert.ok(w.snap.text.startsWith('## #0–#150') && w.snap.recent.length === 2);
    assert.equal(S.liveStoryText(m, w), w.snap.text);
    // 아카이브가 통째로 바뀌어도, 비워져도
    m.text = '## #0–#999 — Rewritten\n- other.'; assert.equal(S.liveStoryText(m, w), w.snap.text);
    m.text = ''; assert.equal(S.liveStoryText(m, w), w.snap.text);
    // 서랍: 이야기 글은 요약본, 요약본을 알려 줘요, 시작한 번호는 그대로
    const d = L.liveMeta(m);
    assert.equal(d.text, w.snap.text); assert.equal(d.phoneSnap, w.snap); assert.equal(d.phoneUpto, 150);
    // 폰 1의 폰은 그대로
    assert.equal(JSON.stringify(m.phones), before);
    // 모양이 틀렸거나 다른 자리의 요약본이면 시작하지 않아요 (폰 2는 안 생겨요)
    for (const bad of [{ ...w.snap, upto: 149 }, { text: 'x', recent: 'not a list', upto: 150 }, { recent: [], upto: 150 }, 'text']) {
        const m2 = meta();
        assert.throws(() => S.beginFromStory(m2, { persona: 'Lio', upto: 150, snap: bad }), /이야기 요약본이 이 시작 자리의 것이 아니에요/);
        assert.equal(L.liveWorld(m2), null);
    }
    // 요약본 없이 시작한 폰 2 (분기한 방에서 저절로 다시 시작한 폰): 요약본 자리가 없고, 처음 움직일 때 받아요
    const m3 = meta(), w3 = begun(m3), d3 = L.liveMeta(m3);
    assert.equal(w3.snap, undefined); assert.equal(d3.phoneSnap, undefined); assert.equal(d3.text, '');
    let asked = null;
    L.setStoryKeeper(real => { asked = real; return 'made'; });
    assert.equal(d3.phoneStoryReady(), 'made'); assert.equal(asked, m3);
    // (요약본이 있는 폰 · 처음부터 시작한 폰은 묻지 않아요)
    asked = null;
    assert.equal(d.phoneStoryReady(), null); assert.equal(L.liveMeta((x => (L.startFresh(x, { persona: 'Lio' }), x))(meta())).phoneStoryReady(), null); assert.equal(asked, null);
    L.setStoryKeeper(null);
    assert.equal(d3.phoneStoryReady(), null);
    // 다시 시작(대화만 남기기 · 분기)도 요약본을 받아요
    const m4 = meta(); S.beginFromStory(m4, { persona: 'Lio', upto: 150 }); L.setLiveMode(m4, 'live');
    const w4 = S.rebeginKeepingChats(m4, { upto: 150, snap: w.snap });
    assert.deepEqual(w4.snap, w.snap);
});

// 7-4: 분기한 방의 폰 2는 폰 1을 먼저 되돌린 뒤 거기서 다시 시작해요
test('분기 가리기: 자기 채팅 · 시작 뒤 분기 · 시작 앞 분기', async () => {
    const S2 = S, L2 = L;
    const m = { text: '', phones: { mara: { owner: 'Mara', notes: [] } } };
    const w = S2.beginFromStory(m, { persona: 'Ren', upto: 120, scope: 's', chat: 'main', fp: 'abc' });
    assert.equal(w.chat, 'main'); assert.equal(w.storyFp, 'abc');
    // its own chat, whatever the words there now (an edit is not a branch)
    assert.equal(S2.liveBranched(w, { chat: 'main', branch: false, fp: 'zzz' }), 'none');
    assert.equal(S2.liveBranched(w, { chat: 'main', branch: true, fp: 'zzz' }), 'none');
    // another mark that is no branch (a renamed copy, a backup): left alone
    assert.equal(S2.liveBranched(w, { chat: 'other', branch: false, fp: null }), 'none');
    // a branch that still has message 120 as it was: after the start
    assert.equal(S2.liveBranched(w, { chat: 'br', branch: true, fp: 'abc' }), 'after');
    // a branch without it, or with other words there: before the start
    assert.equal(S2.liveBranched(w, { chat: 'br', branch: true, fp: null }), 'before');
    assert.equal(S2.liveBranched(w, { chat: 'br', branch: true, fp: 'new words' }), 'before');
    // 'after' is asked once
    S2.adoptChat(w, 'br');
    assert.equal(S2.liveBranched(w, { chat: 'br', branch: true, fp: 'new words' }), 'none');
    // a 폰 2 from before marks: only what 폰 1's phones found
    delete w.chat;
    assert.equal(S2.liveBranched(w, { chat: 'br', branch: true, fp: null }), 'none');
    assert.equal(S2.liveBranched(w, { chat: 'br', branch: true, fp: null, point: 100 }), 'before');
    assert.equal(S2.liveBranched(w, { chat: 'br', branch: true, fp: null, point: 130 }), 'none');
    // begun fresh: never
    const f = { phones: {} }; L2.startFresh(f, { persona: 'Ren' });
    assert.equal(S2.liveBranched(L2.liveWorld(f), { chat: 'br', branch: true, point: 1 }), 'none');
});

test('다시 시작: 되돌린 폰 1에서, 메신저 대화 · 예전 폰 2 기록 없이, 페르소나는 그대로, 보관함에 안 넣어요', async () => {
    const S2 = S, L2 = L;
    const m = { text: '', phones: { mara: { owner: 'Mara', notes: [{ title: '월요일' }, { title: '수요일' }] } } };
    const old = S2.beginFromStory(m, { persona: 'Ren', upto: 120, scope: 's', chat: 'main', fp: 'abc' });
    const room = L2.ensureRoom(m, ['Mara']); L2.sendLive(m, room.id, '수요일에 한 말');
    old.phones.mara.notes.push({ title: '실시간에서 생긴 메모' });
    L2.setLiveMode(m, 'live');
    // (폰 1 rewound to Monday by settleBranch)
    m.phones.mara.notes = [{ title: '월요일' }];
    const w = S2.rebeginFromStory(m, { upto: 100, scope: 's2', dayShift: 3, chat: 'br', fp: 'mon' });
    assert.notEqual(w.id, old.id);
    assert.equal(w.persona, 'Ren');
    assert.equal(w.storyUpto, 100); assert.equal(w.chat, 'br'); assert.equal(w.dayShift, 3);
    assert.deepEqual(w.phones.mara.notes.map(x => x.title), ['월요일']);
    assert.deepEqual(Object.keys(w.messenger.rooms), []);
    assert.equal(L2.archivedWorlds(m).length, 0);
    assert.equal(L2.liveMode(m), 'live');
    // 폰 1 is only read
    assert.deepEqual(m.phones.mara.notes.map(x => x.title), ['월요일']);
    w.phones.mara.notes.push({ title: 'x' }); assert.equal(m.phones.mara.notes.length, 1);
    assert.equal(S2.liveBranched(w, { chat: 'br', branch: true, fp: 'mon' }), 'none');
});

test('다시 시작: 폰 1에 폰이 없으면 폰 2는 내려요. 실패하면 있던 그대로', async () => {
    const S2 = S, L2 = L;
    const m = { text: '', phones: { mara: { owner: 'Mara' } } };
    S2.beginFromStory(m, { persona: 'Ren', upto: 120, scope: 's' }); L2.setLiveMode(m, 'live');
    const keep = L2.liveWorld(m);
    assert.throws(() => S2.rebeginFromStory(m, { upto: -1 }));
    assert.equal(L2.liveWorld(m), keep); assert.equal(L2.liveMode(m), 'live');
    m.phones = {};
    assert.equal(S2.rebeginFromStory(m, { upto: 100 }), null);
    assert.equal(L2.liveWorld(m), null); assert.equal(L2.liveMode(m), 'story');
});

test('실시간 폰 새로 시작 › 대화만 남기기: 메신저 대화는 남고, 폰은 지금의 폰 1에서 다시 채워져요. 남긴 대화는 다시 반영하지 않아요', () => {
    const m = meta();
    m.phones.mara.notes = [{ title: '월요일' }];
    S.beginFromStory(m, { persona: 'Ren', upto: 100, scope: 's' });
    const room = L.ensureRoom(m, ['Mara']);
    L.sendLive(m, room.id, '하나'); L.sendLive(m, room.id, '둘');
    L.liveWorld(m).phones.mara.notes.push({ title: '실시간에서 생긴 메모' });
    room.digest = { upto: 101, parts: [{ text: '## #101–#101 — x\n- y' }] };
    // the story went on meanwhile
    m.phones.mara.notes = [{ title: '월요일' }, { title: '화요일' }];
    // (Ivo's phone has a reading of the story already: the kept talk is a stretch done)
    m.phones.ivo = { owner: 'Ivo', sync: { marks: { base: { index: 3 } }, done: [[4, 120]] } };
    L.setLiveMode(m, 'live');
    const w = S.rebeginKeepingChats(m, { upto: 140, scope: 's' });
    assert.equal(w.persona, 'Ren'); assert.equal(w.storyUpto, 140); assert.equal(L.liveMode(m), 'live');
    assert.deepEqual(w.phones.mara.notes.map(x => x.title), ['월요일', '화요일']);
    const kept = Object.values(w.messenger.rooms)[0];
    assert.deepEqual(kept.messages.map(x => x.text), ['하나', '둘']);
    // (their numbers come after the story's, and the summary that named the old numbers goes)
    assert.deepEqual(kept.messages.map(x => x.n), [141, 142]); assert.equal(kept.digest, undefined);
    // the kept talk is read already for the new phones
    assert.equal(w.phones.mara.sync.marks.base.index, 142);
    assert.deepEqual(w.phones.ivo.sync.done, [[4, 120], [141, 142]]); assert.equal(w.phones.ivo.sync.marks.base.index, 3);
    assert.equal(L.archivedWorlds(m).length, 0);
    // a message sent after it goes on from there
    assert.equal(L.sendLive(m, kept.id, '셋').n, 143);
    // 폰 1 with no phone: nothing to begin from, the 폰 2 stays as it was
    const n = meta(); n.phones = {};
    L.startFresh(n, { persona: 'Ren', scope: 's' });
    const r2 = L.ensureRoom(n, ['Mara']); L.sendLive(n, r2.id, '하나');
    const before = JSON.stringify(n.live);
    assert.equal(S.rebeginKeepingChats(n, { upto: 10 }), null);
    assert.equal(JSON.stringify(n.live), before);
});
