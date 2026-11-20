// 실시간 폰의 이야기 요약본 만들기 (src/phone2snap.js). 모델 · 아카이브의 "한 번에 압축"은 가짜, 글을 붙이는 쪽
// (appendtext.js · statechg.js · sections.js)은 진짜예요.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const SRC = new URL('../src/', import.meta.url);
const enc = t => 'data:text/javascript;base64,' + Buffer.from(t).toString('base64');
const T = globalThis.__snap = { chat: [], g: { prompts: [{ id: 'short', text: 'PROMPT' }], activePrompt: 'short' }, calls: [], draft: null, ranges: [] };
const stub = {
    './core.js': enc(`export const ctx=()=>({chat:globalThis.__snap.chat});export const globalSettings=()=>globalThis.__snap.g;export const sectionChanges=()=>[];export const getMeta=()=>({});export const saveMeta=async()=>{};`),
    './chats.js': enc(`export const currentChatId=()=>'test';`), './inject.js': enc(`export const applyInjection=()=>{};`), './panel.js': enc(`export const syncPanel=()=>{};`),
    './router.js': enc(`export const routerCandidates=()=>[];export const routerCfg=()=>({});export const routerState=()=>({});`),
    './recall.js': enc(`export const estTok=t=>Math.ceil(String(t).length/4);export const offstageSet=()=>new Set();`),
    './prompts.js': enc(`export const activePrompt=g=>g.prompts.find(p=>p.id===g.activePrompt)||g.prompts[0];export const auFix=t=>t;`),
    './diff.js': enc(`export const lineDiff=()=>[];export const renderDiff=()=>'';`),
    './translate.js': enc(`export const translateButton=()=>'';`),
    './util.js': enc(`export const esc=x=>String(x);export const escRe=s=>String(s).replace(/[.*+?^\${}()|[\\]\\\\]/g,'\\\\$&');export const fmt=x=>String(x);export const countTokens=async t=>Math.ceil(String(t).length/4);`),
    // (the archive's reader and its 한 번에 압축: what they were asked, and the answer the test set)
    './wizard.js': enc(`const S=globalThis.__snap;
        export const rangeRaw=(c,g,from,to,keep)=>{S.ranges.push([from,to,keep]);const items=c.chat.map((x,i)=>({i,text:x.mes,hidden:!!x.is_system})).filter(x=>x.i>=from&&x.i<=to&&!(x.hidden&&x.i>keep));return{items,raw:items.map(x=>'#'+x.i+' '+x.text).join('\\n')};};
        export const chunkItems=items=>{const out=[];for(let i=0;i<items.length;i+=S.per||1000)out.push(items.slice(i,i+(S.per||1000)));return out;};
        export const draftCompress=async a=>{S.calls.push({from:a.items[0].i,to:a.items.at(-1).i,n:a.items.length,prompt:a.p.text,text:a.m.text});a.onStep?.(0,1,a.items[0].i,a.items.at(-1).i);return typeof S.draft==='function'?S.draft(a):S.draft;};`),
    './phonedata.js': enc(`export const recentPhoneText=(n,o)=>{const S=globalThis.__snap;S.recentAsk=[n,o];return S.chat.map((x,i)=>({i,x})).filter(r=>!r.x.is_system&&(o.upto==null||r.i<=o.upto)).slice(-n).map(r=>'[#'+r.i+(r.x.is_user?' · USER':'')+'] '+r.x.name+': '+r.x.mes).join('\\n\\n').slice(-o.maxChars);};
        export const chatStamp=i=>{const S=globalThis.__snap,x=S.chat[i];return{chat:S.mark||'c1',branch:false,fp:x?x.mes:null};};`),
};
// (the archive's own text code, as it is: its neighbours that need the page are the stubs above)
const real = {};
const rewritten = async f => enc((await readFile(new URL(f, SRC), 'utf8')).replace(/from '([^']+)'/g, (all, k) => `from '${stub[k] || real[k] || k}'`));
for (const f of ['sections.js', 'statechg.js', 'appendtext.js']) real[`./${f}`] = await rewritten(f);
real['./phone2store.js'] = new URL('phone2store.js', SRC).href;
const S = await import(await rewritten('phone2snap.js'));

const ARCHIVE = `## #0–#3 — Arrival (Oct 24, Varo)
- Ren came home to Varo and met Mara at the station (#1).

---
# STATE AT #3
## People
- Ren: back in Varo, staying with Ivo.

# OPEN AT #3
- Whether Mara will forgive Ren.
`;
const say = (name, mes, hidden = false) => ({ name, mes, is_user: name === 'Ren', is_system: hidden });
function chat() {
    T.chat = [say('Ren', 'm0', true), say('Mara', 'm1', true), say('Ren', 'm2', true), say('Mara', 'm3', true),
        say('Ren', 'I found the flat on Lindenweg'), say('Mara', 'Then take it'), say('Ren', 'I signed today'), say('Mara', 'See you Friday')];
    T.calls = []; T.ranges = []; T.per = 0; T.draft = null;
    return { text: ARCHIVE, boundary: 3 };
}
const DRAFT = `## #4–#7 — The flat (Oct 26, Varo)
- Ren found a flat on Lindenweg and signed for it; Mara told him to take it (#6).

---
# STATE CHANGES
EDIT ## People :: - Ren: back in Varo, staying with Ivo. ==> - Ren: in Varo, has signed for a flat on Lindenweg.

# OPEN CHANGES
ADD :: - What happens on Friday.
`;

test('아카이브 안 된 구간이 없으면: 요청 없이 아카이브 글 그대로, 시작 직전 메시지는 글자 그대로', async () => {
    const m = chat(); m.boundary = 7;
    for (let i = 4; i < 8; i++) T.chat[i].is_system = true;
    m.text = ARCHIVE.replace('#0–#3', '#0–#7').replace(/AT #3/g, 'AT #7');
    assert.deepEqual(S.liveSnapPlan(m, 7), { from: 8, to: 7, count: 0, parts: 0, tokens: 0 });
    const snap = await S.liveSnapDraft(m, { upto: 7, now: 111 });
    assert.equal(T.calls.length, 0);
    assert.equal(snap.text, m.text);
    assert.deepEqual([snap.v, snap.at, snap.upto, snap.made], [1, 111, 7, { from: 8, to: 7, count: 0, parts: 0 }]);
    assert.ok(S.isSnap(snap));
});

test('아카이브 안 된 구간: 아카이브의 "한 번에 압축"으로 요약을 받아, 넣었을 때의 글을 만들어요. 진짜 아카이브는 그대로', async () => {
    const m = chat(), before = m.text;
    T.draft = { text: DRAFT, parts: 1, doneTo: 7, error: null };
    const steps = [];
    assert.deepEqual(S.liveSnapPlan(m, 7), { from: 4, to: 7, count: 4, parts: 1, tokens: Math.round(Math.ceil('#4 I found the flat on Lindenweg\n#5 Then take it\n#6 I signed today\n#7 See you Friday'.length / 4) + Math.ceil(before.length / 4) + Math.ceil('PROMPT'.length / 4)) });
    const snap = await S.liveSnapDraft(m, { upto: 7, now: 222, onStep: (...a) => steps.push(a) });
    // 요청: 경계선 뒤 #4–#7, 압축 지시문, 지금의 아카이브
    assert.deepEqual(T.calls, [{ from: 4, to: 7, n: 4, prompt: 'PROMPT', text: before }]);
    assert.deepEqual(T.ranges.at(-1), [4, 7, -1]);
    assert.deepEqual(steps, [[0, 1, 4, 7]]);
    // 요약본: 옛 장면 + 새 장면 + 바뀐 STATE · OPEN (바뀌는 목록이 아니라 다 쓴 칸으로)
    const { body, state } = S.snapParts(snap);
    assert.ok(body.includes('## #0–#3 — Arrival') && body.includes('## #4–#7 — The flat') && body.indexOf('#0–#3') < body.indexOf('#4–#7'));
    assert.ok(state.includes('# STATE AT #7') && state.includes('- Ren: in Varo, has signed for a flat on Lindenweg.') && !state.includes('staying with Ivo'));
    assert.ok(state.includes('# OPEN AT #7') && state.includes('- Whether Mara will forgive Ren.') && state.includes('- What happens on Friday.'));
    assert.ok(!snap.text.includes('CHANGES') && !snap.text.includes('==>'));
    // 시작 직전 메시지: 보이는 것만, 글자 그대로
    assert.deepEqual(snap.recent, ['[#4 · USER] Ren: I found the flat on Lindenweg', '[#5] Mara: Then take it', '[#6 · USER] Ren: I signed today', '[#7] Mara: See you Friday']);
    assert.deepEqual(T.recentAsk, [S.SNAP_RECENT.lines, { upto: 7, maxChars: S.SNAP_RECENT.chars }]);
    assert.deepEqual(snap.made, { from: 4, to: 7, count: 4, parts: 1 });
    // 진짜 아카이브 · 경계선은 안 바뀌어요
    assert.equal(m.text, before); assert.equal(m.boundary, 3);
});

test('시작한 메시지까지만: 그 뒤 메시지는 요약에도 시작 직전 메시지에도 안 들어가요', async () => {
    const m = chat();
    T.draft = a => ({ text: DRAFT.replace('#4–#7', `#4–#${a.items.at(-1).i}`), parts: 1, doneTo: a.items.at(-1).i, error: null });
    const snap = await S.liveSnapDraft(m, { upto: 5 });
    assert.deepEqual([T.calls[0].from, T.calls[0].to], [4, 5]);
    assert.ok(snap.text.includes('## #4–#5') && !snap.recent.join('\n').includes('I signed today') && snap.recent.at(-1) === '[#5] Mara: Then take it');
    assert.equal(snap.upto, 5);
});

test('아카이브 섹션이 경계선보다 앞에서 끝나면: 빠진 구간부터 (숨긴 메시지도 그 구간은 넣어요)', async () => {
    const m = chat(); m.boundary = 5; T.chat[4].is_system = true; T.chat[5].is_system = true;
    T.draft = { text: DRAFT, parts: 1, doneTo: 7, error: null };
    await S.liveSnapDraft(m, { upto: 7 });
    assert.deepEqual(T.ranges.at(-1), [4, 7, 5]);
    assert.deepEqual([T.calls[0].from, T.calls[0].to, T.calls[0].n], [4, 7, 4]);
});

test('아카이브가 없는 채팅: 처음부터 요약해요', async () => {
    const m = { text: '', boundary: -1 }; chat(); for (const x of T.chat) x.is_system = false;
    T.draft = { text: '## #0–#7 — All of it (Oct 24–26, Varo)\n- Ren came home and signed for a flat (#6).\n\n---\n# STATE AT #7\n## People\n- Ren: in Varo.\n\n# OPEN AT #7\n- Friday.\n', parts: 1, doneTo: 7, error: null };
    const snap = await S.liveSnapDraft(m, { upto: 7 });
    assert.deepEqual([T.calls[0].from, T.calls[0].to], [0, 7]);
    assert.ok(snap.text.includes('## #0–#7 — All of it') && snap.text.includes('# STATE AT #7') && snap.text.includes('- Friday.'));
    assert.equal(m.text, '');
});

test('요약이 실패 · 비어 있음 · 새 장면 없음: 아무것도 안 남기고 오류', async () => {
    const m = chat(), before = m.text;
    T.draft = { text: '', parts: 2, done: 1, doneTo: 5, error: new Error('429') };
    await assert.rejects(() => S.liveSnapDraft(m, { upto: 7 }), /이야기 요약을 끝까지 받지 못했어요 \(#5까지 받음\): 429/);
    T.draft = { text: '   ', parts: 1, doneTo: 7, error: null };
    await assert.rejects(() => S.liveSnapDraft(m, { upto: 7 }), /이야기 요약이 비어 있어요/);
    T.g.prompts = []; T.g.activePrompt = '';
    await assert.rejects(() => S.liveSnapDraft(m, { upto: 7 }), /압축 지시문이 없어요/);
    T.g.prompts = [{ id: 'short', text: 'PROMPT' }]; T.g.activePrompt = 'short';
    assert.throws(() => S.liveSnapPlan(m, -1), /어느 메시지까지/);
    await assert.rejects(() => S.liveSnapDraft(m, {}), /어느 메시지까지/);
    assert.equal(m.text, before);
});

test('긴 구간: 나눠 보내는 수가 미리 보이고, 압축 설정의 지시문(wizPrompt)을 써요', async () => {
    const m = chat(); T.per = 2;
    T.g.prompts = [{ id: 'short', text: 'PROMPT' }, { id: 'mine', text: 'MY PROMPT' }]; T.g.wizPrompt = 'mine';
    try {
        assert.equal(S.liveSnapPlan(m, 7).parts, 2);
        T.draft = { text: DRAFT, parts: 2, doneTo: 7, error: null };
        const snap = await S.liveSnapDraft(m, { upto: 7 });
        assert.equal(T.calls[0].prompt, 'MY PROMPT');
        assert.equal(snap.made.parts, 2);
    } finally { T.g.prompts = [{ id: 'short', text: 'PROMPT' }]; delete T.g.wizPrompt; }
});

test('버튼 한 번(liveSnapNow): 마지막 메시지까지의 요약본과, 시작에 넘길 자리 · 채팅 표시 · 끝 메시지 표시', async () => {
    const m = chat();
    T.draft = { text: DRAFT, parts: 1, doneTo: 7, error: null };
    const steps = [], got = await S.liveSnapNow(m, { now: 333, onStep: (...a) => steps.push(a) });
    assert.deepEqual([got.upto, got.chat, got.fp, got.snap.upto, got.snap.at], [7, 'c1', 'See you Friday', 7, 333]);
    assert.ok(S.isSnap(got.snap) && got.snap.text.includes('## #4–#7 — The flat'));
    assert.deepEqual(steps, [[0, 1, 4, 7]]);
    // 빈 채팅: 요청 없이, 빈 요약본으로
    T.chat = []; T.calls = [];
    const none = await S.liveSnapNow({ text: '', boundary: -1 });
    assert.deepEqual([none.upto, none.fp, none.snap.text, none.snap.recent, T.calls.length], [0, null, '', [], 0]);
});

test('버튼 한 번: 정리하는 동안 채팅이 달라졌으면 요약본을 버리고 오류 (메시지가 늘었음 · 줄었음 · 끝 메시지가 고쳐짐 · 다른 채팅)', async () => {
    const during = [
        () => T.chat.push(say('Ren', 'one more')),
        () => T.chat.pop(),
        () => { T.chat[7] = say('Mara', 'See you Saturday'); },
        () => { T.mark = 'c2'; },
    ];
    for (const change of during) {
        const m = chat(); T.mark = 'c1';
        T.draft = () => { change(); return { text: DRAFT, parts: 1, doneTo: 7, error: null }; };
        await assert.rejects(() => S.liveSnapNow(m), /정리하는 동안 채팅이 바뀌었어요/);
    }
    // 그대로였으면 돼요 (앞쪽 메시지가 고쳐진 건 시작 자리를 안 바꿔요)
    const m = chat(); T.mark = 'c1';
    T.draft = () => { T.chat[4] = say('Ren', 'I found the flat on Birkenweg'); return { text: DRAFT, parts: 1, doneTo: 7, error: null }; };
    assert.equal((await S.liveSnapNow(m)).upto, 7);
    T.mark = '';
});

// ---- 롤플이 더 진행됐을 때
const DRAFT2 = `## #8–#12 — Friday (Oct 30, Varo)
- Mara came on Friday and they carried the boxes up together (#11).

---
# STATE CHANGES
EDIT ## People :: - Ren: in Varo, has signed for a flat on Lindenweg. ==> - Ren: living in the flat on Lindenweg.

# OPEN CHANGES
DROP :: - What happens on Friday.
`;
async function started() {
    const m = chat();
    T.draft = { text: DRAFT, parts: 1, doneTo: 7, error: null };
    const snap = await S.liveSnapDraft(m, { upto: 7, now: 1 });
    T.calls = []; T.ranges = [];
    return { m, snap };
}
const more = () => T.chat.push(say('Ren', 'Friday came'), say('Mara', 'I brought tape'), say('Ren', 'Third floor'), say('Mara', 'Last box'), say('Ren', 'Stay for tea'));

test('지금 롤플의 끝 메시지들: 끝에서부터 통째로, 중간에 잘린 맨 앞 것은 빼고, 맨 앞 번호와 채팅의 끝', async () => {
    const { snap } = await started();
    assert.deepEqual(S.liveChatTail(), { lines: ['[#4 · USER] Ren: I found the flat on Lindenweg', '[#5] Mara: Then take it', '[#6 · USER] Ren: I signed today', '[#7] Mara: See you Friday'], first: 4, end: 7 });
    assert.deepEqual(T.recentAsk, [S.SNAP_RECENT.lines, { maxChars: S.SNAP_RECENT.chars }]);
    assert.equal(S.liveSnapBehind(snap), false);
    // (롤플이 조금 진행: 끝 메시지들에 다 담겨요 → 요약본은 그대로)
    more();
    assert.equal(S.liveChatTail().end, 12);
    assert.equal(S.liveSnapBehind(snap), false);
    // (많이 진행: 요약본 뒤 첫 메시지가 끝 메시지들에 안 담겨요)
    for (let i = 0; i < 8; i++) T.chat.push(say('Mara', `later ${i}`));
    const tail = S.liveChatTail();
    assert.deepEqual([tail.lines.length, tail.first, tail.end], [10, 11, 20]);
    assert.equal(S.liveSnapBehind(snap, tail), true);
    // (글자 한도에 걸려 맨 앞 메시지가 중간에서 잘리면 그 메시지는 빼요)
    const keep = S.SNAP_RECENT.chars; S.SNAP_RECENT.chars = 45;
    assert.deepEqual(S.liveChatTail().lines, ['[#19] Mara: later 6', '[#20] Mara: later 7']);
    S.SNAP_RECENT.chars = keep;
    // (채팅이 요약본보다 짧아졌거나 보이는 메시지가 없으면)
    T.chat.length = 5;
    assert.equal(S.liveSnapBehind(snap), false);
    assert.equal(S.liveSnapBehind(snap, { lines: [], first: null, end: 30 }), true);
    assert.equal(S.liveSnapBehind(null, { lines: [], first: null, end: 30 }), false);
    // (경계: 요약본 바로 다음 메시지부터 담겼으면 빈 구간이 없어요; 하나라도 건너뛰면 있어요)
    assert.equal(S.liveSnapBehind(snap, { lines: ['x'], first: 8, end: 20 }), false);
    assert.equal(S.liveSnapBehind(snap, { lines: ['x'], first: 9, end: 20 }), true);
    // (채팅이 요약본의 자리보다 짧으면 늘릴 게 없어요)
    assert.equal(S.liveSnapBehind(snap, { lines: [], first: null, end: 5 }), false);
    assert.equal(S.liveSnapBehind(snap, { lines: [], first: null, end: 7 }), false);
});

test('요약본 늘리기: 요약본 뒤로 진행된 구간만 요약해 요약본 뒤에 붙이고, 끝 메시지를 지금 것으로. 그사이 아카이브돼 숨겨진 메시지도 넣어요. 진짜 아카이브는 그대로', async () => {
    const { m, snap } = await started(), archive = m.text;
    more();
    // (그사이 진짜 아카이브가 #10까지 압축돼 숨겨졌어요)
    for (let i = 4; i <= 10; i++) T.chat[i].is_system = true;
    m.boundary = 10; m.text = `${archive}\n(the archive went on by itself)`;
    const after = m.text;
    T.draft = { text: DRAFT2, parts: 1, doneTo: 12, error: null };
    const next = await S.liveSnapExtend(m, snap, { now: 9 });
    // 요청: 요약본 뒤 #8–#12 (경계선까지의 숨긴 메시지 포함), 요약본의 글을 아카이브 자리에
    assert.deepEqual(T.ranges.at(-1), [8, 12, 10]);
    assert.deepEqual(T.calls, [{ from: 8, to: 12, n: 5, prompt: 'PROMPT', text: snap.text }]);
    const { body, state } = S.snapParts(next);
    const scenes = t => t.replace(/\n-{3,}\s*$/, '').trim();   // (without the rule that ends the sections)
    assert.ok(scenes(body).startsWith(scenes(S.snapParts(snap).body)) && body.includes('## #8–#12 — Friday') && body.indexOf('#4–#7') < body.indexOf('#8–#12'));
    assert.ok(state.includes('# STATE AT #12') && state.includes('- Ren: living in the flat on Lindenweg.') && !state.includes('has signed for'));
    assert.ok(state.includes('- Whether Mara will forgive Ren.') && !state.includes('What happens on Friday'));
    assert.ok(!next.text.includes('went on by itself') && !next.text.includes('CHANGES'));
    assert.deepEqual([next.upto, next.at, next.made], [12, 9, { from: 8, to: 12, count: 5, parts: 1 }]);
    assert.deepEqual(next.recent, ['[#11] Mara: Last box', '[#12 · USER] Ren: Stay for tea']);
    assert.ok(S.isSnap(next));
    // 진짜 아카이브 · 경계선 · 먼저 있던 요약본은 안 바뀌어요
    assert.equal(m.text, after); assert.equal(m.boundary, 10);
    assert.equal(snap.upto, 7);
});

test('요약본 늘리기: 진행된 게 없으면 그대로 · 실패하면 오류 · 정리하는 동안 끝 메시지가 사라지거나 고쳐지거나 다른 채팅이면 버려요 (메시지가 더 온 건 괜찮아요)', async () => {
    const { m, snap } = await started();
    assert.equal(await S.liveSnapExtend(m, snap), snap);
    T.chat.length = 5;
    assert.equal(await S.liveSnapExtend(m, snap), snap);
    assert.equal(T.calls.length, 0);
    await assert.rejects(() => S.liveSnapExtend(m, null), /요약본이 없어요/);
    const again = async during => { const x = await started(); more(); T.mark = 'c1'; T.draft = () => { during(); return { text: DRAFT2, parts: 1, doneTo: 12, error: null }; }; return x; };
    for (const during of [() => T.chat.pop(), () => { T.chat[12] = say('Ren', 'Go home'); }, () => { T.mark = 'c2'; }]) {
        const x = await again(during);
        await assert.rejects(() => S.liveSnapExtend(x.m, x.snap), /정리하는 동안 채팅이 바뀌었어요/);
    }
    const y = await again(() => T.chat.push(say('Mara', 'Yes')));
    assert.equal((await S.liveSnapExtend(y.m, y.snap)).upto, 12);
    const z = await again(() => {}); T.draft = { text: '', parts: 0, doneTo: 9, error: new Error('모델 오류') };
    await assert.rejects(() => S.liveSnapExtend(z.m, z.snap), /끝까지 받지 못했어요 \(#9까지 받음\): 모델 오류/);
    T.mark = '';
});

test('요약본 모양 검사(isSnap)', () => {
    assert.equal(S.isSnap({ text: 'x', recent: [], upto: 3 }), true); assert.equal(S.isSnap({ text: '', recent: ['[#1] a'], upto: 0 }), true);
    for (const bad of [null, {}, { text: 'x', recent: [] }, { text: 1, recent: [], upto: 3 }, { text: 'x', recent: 'a', upto: 3 }, { text: 'x', recent: [1], upto: 3 }, { text: 'x', recent: [], upto: -1 }]) assert.equal(S.isSnap(bad), false);
});

test('이 파일은 요약본을 만들기만 해요: 아카이브를 바꾸는 함수 · 저장을 부르지 않아요', async () => {
    const src = await readFile(new URL('phone2snap.js', SRC), 'utf8');
    assert.doesNotMatch(src, /commitText|saveMeta|applyHide|autoAppend|openAppend|\.boundary\s*=[^=]|m\.text\s*=[^=]/);
});
