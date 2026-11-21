// 채팅 저장 줄 세우기(core.js saveMeta): 겹쳐서 부른 저장이 빠지지 않아요.
// 실리태번은 다른 저장이 도는 중이면 1초 기다리다 저장하지 않고 돌아와요: 폰(저장 한 번에 몇 초)에서 답장이 저장이 안 됐어요.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const src = await readFile(new URL('../src/core.js', import.meta.url), 'utf8');
const from = src.indexOf('let saving = null, savingNext = null;'), to = src.indexOf('\n}\n', src.indexOf('export function saveMeta() {')) + 2;
assert.ok(from > 0 && to > from, 'core.js에서 saveMeta 줄 세우기를 찾아요');
const code = src.slice(from, to).replace('export function saveMeta', 'function saveMeta');
// 가짜 실리태번: 저장은 ms 걸리고, 시작할 때의 상태를 적어요. 겹쳐 부르면(실리태번처럼) 저장하지 않고 조용히 돌아와요
function rig(ms = 30) {
    const o = { state: 0, log: [], dropped: 0, busy: false, fail: false, st: { isChatSaving: false } };
    const ctx = () => ({ saveMetadata: async () => { if (o.busy) { o.dropped++; return; } o.busy = true; const snap = o.state; await new Promise(r => setTimeout(r, ms)); o.busy = false; if (o.fail) { o.fail = false; throw new Error('boom'); } o.log.push(snap); } });
    o.saveMeta = new Function('ctx', 'stScript', `${code}; return saveMeta;`)(ctx, o.st);
    return o;
}

test('겹쳐 부른 저장: 실리태번에 겹쳐 가지 않고, 마지막 상태가 저장돼요', async () => {
    const o = rig();
    o.state = 1; const a = o.saveMeta(); o.state = 2; const b = o.saveMeta(); o.state = 3; const c = o.saveMeta();
    await Promise.all([a, b, c]);
    assert.deepEqual(o.log, [1, 3]);
    assert.equal(o.dropped, 0);
});
test('겹치지 않으면 부른 만큼 저장해요', async () => {
    const o = rig();
    o.state = 1; await o.saveMeta(); o.state = 2; await o.saveMeta();
    assert.deepEqual(o.log, [1, 2]);
});
test('앞 저장이 실패하면 그걸 부른 쪽만 오류를 받고, 뒤 저장은 돼요', async () => {
    const o = rig();
    o.fail = true; o.state = 1; const a = o.saveMeta(); o.state = 2; const b = o.saveMeta();
    await assert.rejects(a, /boom/);
    await b;
    assert.deepEqual(o.log, [2]);
});
test('줄 선 저장이 시작되기 전에 또 부르면 그 저장을 같이 써요', async () => {
    const o = rig();
    o.state = 1; const a = o.saveMeta(); o.state = 2; const b = o.saveMeta(); await a; o.state = 3; const c = o.saveMeta();
    await Promise.all([b, c]);
    assert.deepEqual(o.log, [1, 3]);
});
test('줄 선 저장이 도는 중에 부르면 한 번 더 저장해요', async () => {
    const o = rig();
    o.state = 1; const a = o.saveMeta(); o.state = 2; const b = o.saveMeta(); await a; await new Promise(r => setTimeout(r, 10)); o.state = 3; const c = o.saveMeta();
    await Promise.all([b, c]);
    assert.deepEqual(o.log, [1, 2, 3]);
});
test('실리태번 자기 저장이 도는 중이면 끝난 뒤에 저장해요', async () => {
    const o = rig();
    o.st.isChatSaving = true; o.busy = true; o.state = 1; const a = o.saveMeta();
    setTimeout(() => { o.st.isChatSaving = false; o.busy = false; }, 250);
    await a;
    assert.deepEqual(o.log, [1]);
    assert.equal(o.dropped, 0);
});

// 저장 앞에 끼우는 것(setSaveHook: Orbit 데이터는 서버 플러그인에 따로 저장해요)
function rigHook(hook) {
    const o = { st: 0 }, ctx = () => ({ saveMetadata: async () => { o.st++; } });
    o.saveMeta = new Function('ctx', 'stScript', 'hook', `${code}; saveHook = hook; return saveMeta;`)(ctx, { isChatSaving: false }, hook);
    return o;
}
test('끼운 것이 건너뛰라고 하면 실리 저장을 안 해요', async () => {
    let saved = 0;
    const o = rigHook(async () => ({ skip: true, saved: () => { saved++; } }));
    await o.saveMeta();
    assert.deepEqual([o.st, saved], [0, 0]);
});
test('끼운 것이 건너뛰지 말라고 하면 실리 저장을 하고, 됐다고 알려요', async () => {
    let saved = 0;
    const o = rigHook(async () => ({ skip: false, saved: () => { saved++; } }));
    await o.saveMeta();
    assert.deepEqual([o.st, saved], [1, 1]);
    const p = rigHook(async () => null);
    await p.saveMeta();
    assert.equal(p.st, 1);
});
test('끼운 것의 오류는 실리 저장을 한 뒤에 나와요', async () => {
    const o = rigHook(async () => ({ skip: false, error: new Error('플러그인') }));
    await assert.rejects(o.saveMeta(), /플러그인/);
    assert.equal(o.st, 1);
});
