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
    './phonedata.js': enc(`export const recentPhoneText=(n,o)=>{const S=globalThis.__snap;S.recentAsk=[n,o];return S.chat.map((x,i)=>({i,x})).filter(r=>!r.x.is_system&&r.i<=o.upto).slice(-n).map(r=>'[#'+r.i+'] '+r.x.name+': '+r.x.mes).join('\\n\\n').slice(-o.maxChars);};`),
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
    assert.deepEqual(snap.recent, ['[#4] Ren: I found the flat on Lindenweg', '[#5] Mara: Then take it', '[#6] Ren: I signed today', '[#7] Mara: See you Friday']);
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

test('요약본 모양 검사(isSnap)', () => {
    assert.equal(S.isSnap({ text: 'x', recent: [], upto: 3 }), true); assert.equal(S.isSnap({ text: '', recent: ['[#1] a'], upto: 0 }), true);
    for (const bad of [null, {}, { text: 'x', recent: [] }, { text: 1, recent: [], upto: 3 }, { text: 'x', recent: 'a', upto: 3 }, { text: 'x', recent: [1], upto: 3 }, { text: 'x', recent: [], upto: -1 }]) assert.equal(S.isSnap(bad), false);
});

test('이 파일은 요약본을 만들기만 해요: 아카이브를 바꾸는 함수 · 저장을 부르지 않아요', async () => {
    const src = await readFile(new URL('phone2snap.js', SRC), 'utf8');
    assert.doesNotMatch(src, /commitText|saveMeta|applyHide|autoAppend|openAppend|\.boundary\s*=[^=]|m\.text\s*=[^=]/);
});
