// 폰 2 (5-2): another chat's archive replacing this one's (chats.js importArchive) leaves 폰 2 its messenger only;
// 폰 1's part of the import is the same with or without a 폰 2
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const enc = s => 'data:text/javascript;base64,' + Buffer.from(s).toString('base64');
const T = () => globalThis.__importTest;
const stub = enc(`const T=()=>globalThis.__importTest;
export const PHONE_STORY_KEYS=['phones','phoneProfiles','phoneScreenHolder','finance','lastPhoneOwner','phoneLore','phoneLoreOff','phonePre','phoneStoryScope'];
export const phoneChatScope=()=>'scope';export const choosePhoneStory=async()=>T().choice;
export const resetPhoneStory=(m,scope)=>{m.phones={};delete m.finance;m.phoneStoryScope=scope;};export const adoptPhoneStory=(m,scope)=>{m.phoneStoryScope=scope;};export const clearPhoneSelection=()=>{};
export const MODULE='na';export const SETTING_KEYS=['glossary','logLinks','phones','finance'];
export const commitText=async(text,reason,{boundary}={})=>{const m=T().meta;if(text===m.text)return false;m.text=text;if(boundary!==undefined)m.boundary=boundary;return true;};
export const ctx=()=>({});export const getMeta=()=>T().meta;export const hasChat=()=>true;export const saveMeta=async()=>{};
export const applyInjection=()=>{};export const setEditorDirty=()=>{};export const syncPanel=()=>{};
export const headingRanges=()=>[];export const parseSections=()=>[];export const RANGE_HEAD=/x/;export const ICO_A={};export const svgA=()=>'';
export const confirm=async()=>T().confirm;export const countTokens=()=>0;export const esc=s=>String(s);export const fmt=n=>String(n);`);
const store = new URL('../src/phone2store.js', import.meta.url).href;
let src = await readFile(new URL('../src/chats.js', import.meta.url), 'utf8');
for (const f of ['./phonestory.js', './core.js', './inject.js', './panel.js', './sections.js', './theme.js', './util.js']) src = src.replaceAll(`'${f}'`, `'${stub}'`);
globalThis.toastr = { success() {}, info() {}, error() {} };
const C = await import(enc(src.replace(`'./phone2store.js'`, `'${store}'`)));
const L = await import(store);

const base = () => ({ text: '## #0–#10 — Old\n- old', boundary: 10, phones: { mara: { owner: 'Mara' } }, finance: { accounts: {} }, glossary: 'a' });
const other = { text: '## #0–#10 — Another story\n- other', settings: { glossary: 'b', phones: { ren: { owner: 'Ren' } } } };
const liveIn = m => { L.startFromStory(m, { persona: 'Lio', upto: 12, story: { ranges: { '': [[0, 10]] }, titles: [], rawFrom: 11 } }); L.ensureRoom(m, ['Ren']).messages.push({ from: 'Ren', text: 'hi' }); L.setLiveMode(m, 'live'); };
const run = async (m, choice, srcArch = other) => { globalThis.__importTest = { meta: m, choice, confirm: true }; return C.importArchive(structuredClone(srcArch), 'x'); };
const rest = m => JSON.stringify({ ...m, live: undefined });

for (const choice of ['keep', 'fresh']) test(`다른 채팅의 아카이브 가져오기 (${choice}): 폰 2는 대화만 남고, 폰 1 쪽 결과는 폰 2가 있든 없든 같아요`, async () => {
    const a = base(), b = base();
    liveIn(b);
    assert.equal(await run(a, choice), true);
    assert.equal(await run(b, choice), true);
    assert.equal(rest(b), rest(a));
    assert.equal(Object.hasOwn(a, 'live'), false);
    const w = L.liveWorld(b);
    assert.deepEqual([w.from, w.storyUpto, w.story, w.phones], ['fresh', null, null, {}]);
    assert.deepEqual(L.liveRooms(b).map(r => r.messages.map(x => x.text)), [['hi']]);
    assert.equal(L.liveMode(b), 'story');
});
test('가져오기를 취소하거나, 같은 글을 다시 가져오면 폰 2는 그대로예요', async () => {
    const m = base();
    liveIn(m);
    const was = JSON.stringify(m.live);
    globalThis.__importTest = { meta: m, choice: null, confirm: true };
    assert.equal(await C.importArchive(structuredClone(other), 'x'), false);
    assert.equal(JSON.stringify(m.live), was);
    globalThis.__importTest = { meta: m, choice: 'keep', confirm: false };
    assert.equal(await C.importArchive(structuredClone(other), 'x'), false);
    assert.equal(JSON.stringify(m.live), was);
    assert.equal(await run(m, 'keep', { text: m.text, settings: {} }), true);
    assert.equal(JSON.stringify(m.live), was);
});
test('못 읽는 m.live가 있어도 가져오기는 돼요 (그 칸은 그대로)', async () => {
    const m = { ...base(), live: { v: 9, x: 1 } };
    assert.equal(await run(m, 'keep'), true);
    assert.deepEqual(m.live, { v: 9, x: 1 });
    assert.match(m.text, /Another story/);
});
