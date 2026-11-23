// 이 채팅의 페르소나를 적어 두기 (src/phone2keepon.js keepPersona)와 Orbit 열기 (src/phone2keep.js): 실리가 채팅을 여는 중에
// 페르소나를 바꾸면(실리의 CHAT_CHANGED 안에서 PERSONA_CHANGED가 우리 CHAT_CHANGED보다 먼저) 그때는 안 적어요. 적으면 그 저장이
// Orbit을 한 번 더 열어, 분기 채팅에서는 복사가 둘 생겼어요(남은 하나에도 서버가 말을 걸어요). 예시 캐릭터만 써요.
process.env.NA_SCREEN_ANYWHERE = '1';
import test from 'node:test';
import assert from 'node:assert/strict';
const { setContext } = await import('../plugin/screen.mjs');
globalThis.document = { hidden: false, addEventListener() {}, dispatchEvent() { return true; }, querySelectorAll: () => [] };
const { startFresh } = await import('../src/phone2store.js');
const { splitLive } = await import('../src/phone2keep.js');
const KO = await import('../src/phone2keepon.js');
const core = await import('../src/core.js');

test('분기 채팅을 여는 중에 실리가 페르소나를 바꿔도: Orbit 복사는 하나. 다 열린 뒤에 바꾼 페르소나는 그 채팅에 적어요', async () => {
    // (the plugin's store, as plugin/index.mjs answers: the parent chat's Orbit under X)
    const store = new Map(); let forks = 0;
    const parent = {}; startFresh(parent, { persona: 'Ren', now: Date.now() });
    store.set('X', { rev: 1, chat: 'A', parts: splitLive(parent.live) });
    globalThis.fetch = async (url, init = {}) => {
        const p = url.slice('/api/plugins/narrative-archive'.length), b = init.body ? JSON.parse(init.body) : {};
        let out;
        if (p === '/ping') out = { ok: true };
        else if (p === '/store/load') { const g = store.get(b.id); if (!g) return { ok: false, status: 404, json: async () => ({}) }; out = structuredClone(g); }
        else if (p === '/store/rev') out = { rev: store.get(b.id)?.rev ?? null };
        else if (p === '/store/fork') { store.set(b.to, { ...structuredClone(store.get(b.from)), rev: 1, chat: b.chat }); out = { rev: 1 }; forks++; }
        else if (p === '/store/save') { const g = store.get(b.id) || { rev: 0, parts: {} }; for (const [k, v] of Object.entries(b.parts || {})) { if (v === null) delete g.parts[k]; else g.parts[k] = v; } g.rev++; g.chat = b.chat; store.set(b.id, g); out = { rev: g.rev }; }
        else out = { ok: true, on: false };
        return { ok: true, status: 200, json: async () => out };
    };
    const handlers = {};
    const base = { saveMetadata: async () => {}, getRequestHeaders: () => ({}), eventSource: { on(e, f) { (handlers[e] ||= []).push(f); } }, eventTypes: { CHAT_CHANGED: 'chat', PERSONA_CHANGED: 'persona' } };
    const mA = { liveRef: { id: 'X' } };
    setContext({ ...base, chatId: 'A', chatMetadata: { integrity: 'A', narrative_archive: mA } });
    KO.keepStart();
    await KO.liveReady();
    assert.equal(KO.keepKept(), true);
    // (the branch B carries its parent's liveRef. SillyTavern's own CHAT_CHANGED handler switches the persona first)
    const mB = { liveRef: { id: 'X' } };
    setContext({ ...base, chatId: 'B', chatMetadata: { integrity: 'B', narrative_archive: mB } });
    for (const f of handlers.persona) f('varo.png');
    for (const f of handlers.chat) f();
    await KO.liveReady();
    await new Promise(r => setTimeout(r, 100));
    await KO.keepBeat();
    await core.saveMeta();
    assert.equal(forks, 1);
    assert.notEqual(mB.liveRef.id, 'X');
    assert.deepEqual([...store.keys()].sort(), ['X', mB.liveRef.id].sort());
    assert.equal(mB.stPersona, undefined);
    // (open now: a persona switched by hand is written to this chat, once)
    for (const f of handlers.persona) await f('varo.png');
    await new Promise(r => setTimeout(r, 50));
    assert.equal(mB.stPersona, 'varo.png');
    assert.equal(mA.stPersona, undefined);
    assert.equal(forks, 1);
});
