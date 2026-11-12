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
const store = new URL('../src/phone2store.js', import.meta.url).href;
const S = await import(enc((await src('phone2story.js')).replace(`'./sections.js'`, `'${enc(sec)}'`).replace(`'./phone2store.js'`, `'${store}'`)));
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
    assert.deepEqual(w.story, { ranges: { Y1: [[0, 300]], '': [[0, 130]] }, titles: ['People'], rawFrom: 131 });
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
