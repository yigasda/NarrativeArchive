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

test('시작할 때 적는 것: 장면 범위(앞말마다 합침) · 범위 없는 장면 제목 · 원래 메시지 첫 번호, 글은 안 적어요', () => {
    const m = meta(), before = JSON.stringify(m), w = begun(m);
    assert.deepEqual(w.story, { ranges: { Y1: [[0, 300]], '': [[0, 130]] }, titles: ['People'], rawFrom: 131, own: [''] });
    assert.doesNotMatch(JSON.stringify(w.story), /Mara moved|flood|Mara is at home/);
    const { live, ...rest } = m;
    assert.equal(JSON.stringify(rest), before);
    assert.deepEqual(S.liveRawRange(w), { from: 131, to: 150 });
});

test('읽는 것: 시작 때의 장면만, 지금 상태 칸 없이', () => {
    const m = meta(), w = begun(m), t = S.liveStoryText(m, w);
    assert.match(t, /Y1 #0–#300/);
    assert.match(t, /#0–#60 — Spring/);
    assert.match(t, /#61–#130 — Summer/);
    assert.match(t, /## People/);
    assert.doesNotMatch(t, /STATE AT|Mara is at home|# OPEN|The key/);
    assert.doesNotMatch(t, /── Y/);
});

test('폰 1 이야기가 이어져도 폰 2는 시작 뒤를 몰라요 (새 장면 · 걸친 장면 · 새 상태)', () => {
    const m = meta(), w = begun(m, 150);
    m.text = ARCH.replace('# STATE AT #130', '## #131–#160 — The storm\n- Ren left for Lyon.\n\n## #161–#200 — Autumn\n- A letter came.\n\n# STATE AT #200').replace('- Mara is at home.', '- Mara is alone.');
    m.boundary = 200;
    const t = S.liveStoryText(m, w);
    assert.doesNotMatch(t, /storm|Ren left|Autumn|A letter|Mara is alone/);
    assert.match(t, /The flood/);
    // (131–150 come as they are, from the chat: the range stays where it began)
    assert.deepEqual(S.liveRawRange(w), { from: 131, to: 150 });
});

test('다시 압축하거나 이름을 바꿔도 시작 때 범위 안이면 그대로 읽어요 (합침 · 나눔 · 제목 · 내용 고침)', () => {
    const m = meta(), w = begun(m);
    m.text = ARCH.replace('## #0–#60 — Spring\n- Ren met Mara.\n\n## #61–#130 — Summer\n- The flood.', '## #0–#130 — Spring and summer\n- Ren met Mara. The flood.')
        .replace('## Y1 #0–#300 — The first year\n- Mara moved to Varo.', '## Y1 #0–#150 — Year one, early\n- Mara moved.\n\n## Y1 #151–#300 — Year one, late\n- Mara settled.');
    const t = S.liveStoryText(m, w);
    assert.match(t, /Spring and summer/);
    assert.match(t, /Year one, early/);
    assert.match(t, /Year one, late/);
    // (a range reaching past where it began is not read: #120–#140 holds what came after)
    m.text = ARCH.replace('## #61–#130 — Summer', '## #61–#140 — Summer, longer');
    assert.doesNotMatch(S.liveStoryText(m, w), /Summer, longer/);
    // (a section with no range made after the start is not read)
    m.text = ARCH.replace('## People', '## Secrets\n- Mara lied.\n\n## People');
    assert.doesNotMatch(S.liveStoryText(m, w), /Secrets|Mara lied/);
});

test('경계선이 없거나 시작 번호보다 뒤면: 원래 메시지는 0번부터 / 없음', () => {
    const w0 = begun(meta(ARCH, -1), 150);
    assert.deepEqual(S.liveRawRange(w0), { from: 0, to: 150 });
    const w1 = begun(meta(ARCH, 400), 150);
    assert.equal(S.liveRawRange(w1), null);
});

test('처음부터 시작한 폰 2 · 표시 없는 폰 2는 이야기를 하나도 안 읽어요', () => {
    const m = meta();
    const w = L.startFresh(m, { persona: 'Lio' });
    assert.equal(S.liveStoryText(m, w), '');
    assert.equal(S.liveRawRange(w), null);
    assert.equal(S.liveStoryText(m, { from: 'story', storyUpto: 3 }), '');
    assert.throws(() => S.storyMark(m, -1), /어느 메시지까지/);
});

test('서랍의 text: 폰 2가 아는 이야기만, 쓰면 서랍에만', () => {
    const m = meta(), w = begun(m);
    const v = L.liveMeta(m, { text: () => S.liveStoryText(m, L.liveWorld(m)) });
    assert.match(v.text, /The flood/);
    assert.doesNotMatch(v.text, /STATE AT/);
    m.text += '\n## #131–#150 — Later\n- later';
    assert.doesNotMatch(v.text, /Later/);
    v.text = 'x';
    assert.equal(v.text, 'x');
    assert.match(m.text, /The flood/);
    assert.equal(L.liveMeta(m).text, '');
    assert.ok(Object.keys(v).includes('text'));
    assert.equal(w, L.liveWorld(m));
});

test('분기한 채팅에 폰 2가 시작한 번호가 있는지 (알려 주기만 해요, 지우지 않아요)', () => {
    const m = meta(), w = begun(m, 150), was = JSON.stringify(m.live);
    assert.equal(S.liveFitsChat(w, 150), true);
    assert.equal(S.liveFitsChat(w, 300), true);
    assert.equal(S.liveFitsChat(w, 100), false);
    assert.equal(S.liveFitsChat(w, undefined), false);
    assert.equal(S.liveFitsChat(null, 3), true);
    assert.equal(S.liveFitsChat(L.startFresh(meta(), { persona: 'Lio' }), 0), true);
    assert.equal(JSON.stringify(m.live), was);
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
