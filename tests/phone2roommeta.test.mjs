// 채팅 설정은 방마다 (마리나라: 방 하나 = 채팅 하나, chat.metadata = room.meta. 소망 2026-11-24).
// 옛 저장 옮기기(phone2sched.js moveRoomMeta) · 방마다 따로 · 방 밖의 규칙(소망 (가): 그 사람이 있는 방 가운데 하나라도 스케줄을 켰으면) ·
// 새 방의 첫 값 · 분기 · 합치기(phone2keep.js: 방 조각)
import test from 'node:test';
import assert from 'node:assert/strict';
import { G, T, TRL } from './phone2reflect.load.mjs';

const at = f => import(new URL(`../src/${f}`, import.meta.url));
const L = await at('phone2store.js'), S = await at('phone2sched.js'), R = await at('phone2room.js'), K = await at('phone2keep.js');
const DAYS = S.CONVERSATION_SCHEDULE_DAYS;
const all = (status, activity = 'x') => ({ days: Object.fromEntries(DAYS.map(d => [d, [{ time: '00:00-00:00', activity, status }]])), talkativeness: 80, inactivityThresholdMinutes: 15 });
const NOW = new Date('2026-11-23T03:00:00Z');

// 2026-11-24 전의 저장: 채팅 설정이 Orbit에 하나 (w.presence.on · meta), 세계에 표시가 없어요. 방은 손으로 넣어요 (ensureRoom은 먼저 옮겨요)
// SAMPLE: ROOM_META_KEYS의 열쇠마다 옛 Orbit의 값 하나 (열쇠를 더하면 여기에도 넣어야 해요: 아래 첫 테스트가 지켜요)
const SAMPLE = {
    autonomousMessages: true, autonomousDailyCapOverride: 4, groupChatMode: 'individual', groupResponseOrder: 'smart', groupTurnPromptEnabled: false, characterExchanges: true,
    conversationSchedulesEnabled: false, characterCommands: false, conversationCommandToggles: { react: false }, imageCaptioningEnabled: true, imageCaptioningConnectionId: 'ai', imageCaptioningPrompt: 'Look.',
    translationProvider: 'google', translationConnectionId: '', translationTargetLang: 'fr', translationInputTargetLang: 'fr', translationOutputTargetLang: 'ko', translationPrompt: 'Old', translationInputPrompt: 'Old', translationOutputPrompt: null,
    autoTranslate: true, translateInput: false, showInputTranslateButton: false, translationDisplayOnly: false,
    autonomousDailyBudget: { date: '2026-11-23', counts: { mara: 2 } }, intentCooldowns: { mara: { check_in: '2026-11-23T01:00:00.000Z' } },
    appliedChatPresetId: 'p1', customSystemPrompt: 'Talk.', inactiveCharacterIds: ['ivo'], crossChatAwareness: false, lorebookTokenBudget: 100, enableMemoryRecall: false,
    semanticSummaryRetrievalEnabled: true, semanticSummaryRecentCount: 1, semanticSummaryOlderCount: 1, semanticSummaryMinSimilarity: 0.5, summaryConnectionId: 'ai', summaryMaxTokens: 100,
    dayRolloverHour: 2, summaryTailMessages: 3, conversationSetupComplete: true, imageGenConnectionId: 'img',
};
const MOVED = Object.fromEntries(S.ROOM_META_KEYS.map(k => [k, SAMPLE[k]]));
const ORBIT_META = () => ({ ...JSON.parse(JSON.stringify(Object.fromEntries(Object.entries(MOVED).filter(([k]) => k !== 'autonomousMessages')))), reasoningEffort: 'high', scheduleConnectionId: 'profile:p1', conversationTimeZone: 'Asia/Seoul' });
function oldWorld() {
    const m = { phones: {} };
    L.startFresh(m, { persona: 'Ren', scope: 'test' });
    const w = L.liveWorld(m);
    delete w[L.ROOM_META_MARK];
    w.phones = { mara: { owner: 'Mara' }, ivo: { owner: 'Ivo' } };
    w.messenger.rooms = {
        r1: { id: 'r1', members: ['Ren', 'Mara'], messages: [] },
        r2: { id: 'r2', members: ['Ren', 'Mara', 'Ivo'], messages: [], chatParameters: { reasoningEffort: 'low' } },
    };
    w.messenger.trash = [{ room: { id: 'r3', members: ['Ren', 'Ivo'], messages: [] }, at: Date.now() }];
    w.presence = { on: true, schedules: {}, overrides: {}, user: { status: 'idle', manual: 'idle' }, meta: ORBIT_META() };
    return { m, w };
}

test('옛 저장 옮기기: Orbit 하나의 값이 모든 방(지운 방까지)에, 한 번만. 화면이 읽는 값은 그대로예요', () => {
    for (const k of S.ROOM_META_KEYS) assert.ok(Object.hasOwn(SAMPLE, k), `SAMPLE에 ${k}가 없어요`);   // (ROOM_META_KEYS의 열쇠를 하나도 빼지 않아요)
    const { m, w } = oldWorld();
    assert.deepEqual(S.roomMeta(m, 'r1'), MOVED);                                     // (읽는 함수가 먼저 옮겨요)
    assert.deepEqual(w.messenger.rooms.r2.meta, MOVED);
    assert.deepEqual(w.messenger.trash[0].room.meta, MOVED);                           // (되살리면 그 설정 그대로)
    assert.notEqual(w.messenger.rooms.r1.meta.conversationCommandToggles, w.messenger.rooms.r2.meta.conversationCommandToggles);   // (방마다 따로인 값)
    // ("Orbit 전체" 추론 레벨: 자기 값이 없는 방에만. 스케줄 생성 연결: 마리나라처럼 저장하지 않아서 방에는 안 가요)
    assert.deepEqual([w.messenger.rooms.r1.chatParameters, w.messenger.rooms.r2.chatParameters, w.messenger.trash[0].room.chatParameters], [{ reasoningEffort: 'high' }, { reasoningEffort: 'low' }, { reasoningEffort: 'high' }]);
    // (Orbit의 옛 값은 그대로 남아요: 아직 새로 고치지 않은 탭 · 옛 일꾼이 옮길 때의 값으로 돌아요. 새 코드는 안 읽어요)
    assert.deepEqual([w.presence.meta, w.presence.user, w.presence.on], [ORBIT_META(), { status: 'idle', manual: 'idle' }, true]);
    assert.equal(w[L.ROOM_META_MARK], 1);
    // 화면이 읽는 값 (옮기기 전에 Orbit 전체로 보이던 것과 같아요)
    assert.deepEqual(S.autonomousOptions(m, 'r2'), { on: true, schedulesEnabled: false, autonomousDailyCapOverride: 4, groupChatMode: 'individual', characterExchanges: true, groupResponseOrder: 'smart', groupTurnPromptEnabled: false });
    assert.deepEqual([G.liveCommands(m, 'r1').enabled, G.liveCaptioning(m, 'r1').enabled, G.liveCaptioning(m, 'r1').connectionId, G.liveCaptioning(m, 'r1').prompt], [false, true, 'ai', 'Look.']);
    const tr = TRL.liveTranslationSettings(m, 'r1');
    assert.deepEqual([tr.autoTranslate, tr.inputTargetLanguage, tr.outputTargetLanguage, tr.inputPrompt], [true, 'fr', 'ko', 'Old']);
    assert.equal(G.liveScheduleConnection(m, 'r1'), '');
    // 한 번만: 다시 해도 아무것도 안 바뀌어요
    const before = JSON.stringify(w);
    assert.equal(S.moveRoomMeta(m), 0);
    assert.equal(JSON.stringify(w), before);
    // 옛 페이지가 그 뒤에 Orbit 값을 다시 써도 되살아나지 않아요 (표시가 있어서 새 코드는 안 읽어요)
    w.presence.on = false;
    w.presence.meta.groupChatMode = 'merged';
    w.presence.meta.translationOutputPrompt = 'stale';
    assert.deepEqual([S.autonomousOptions(m, 'r1').on, S.groupMode(m, 'r1'), S.roomMeta(m, 'r1').translationOutputPrompt], [true, 'individual', null]);
    assert.equal(S.roomMeta(m, 'nope').autonomousMessages, undefined);
});
test('새 세계는 표시를 갖고 태어나요: 옛 탭이 그 Orbit에 채팅 설정을 써도 옮겨지지 않아요 (2026-11-24 검토)', () => {
    const m = { phones: {} };
    L.startFresh(m, { persona: 'Ren', scope: 'test' });
    const w = L.liveWorld(m);
    assert.equal(w[L.ROOM_META_MARK], 1);
    w.phones = { mara: { owner: 'Mara' } };
    w.messenger.rooms = { r1: { id: 'r1', members: ['Ren', 'Mara'], messages: [] } };
    w.presence = { on: true, meta: { groupChatMode: 'individual' } };
    assert.deepEqual([S.roomMeta(m, 'r1'), S.autonomousOptions(m, 'r1').on, S.groupMode(m, 'r1')], [{}, false, 'merged']);
});
// 새 코드는 Orbit 하나의 옛 채팅 설정을 안 읽어요 (옮기기 moveRoomMeta만 읽어요): src/ · plugin/의 코드에서 (주석은 빼고)
test('새 코드는 Orbit의 옛 채팅 설정(w.presence.on · presence.meta의 채팅 열쇠 · reasoningEffort · scheduleConnectionId)을 읽지 않아요', async () => {
    const { readdir, readFile } = await import('node:fs/promises');
    const files = [];
    for (const dir of ['src', 'plugin']) for (const f of await readdir(new URL(`../${dir}/`, import.meta.url))) if (/\.(m?js|cjs)$/.test(f)) files.push(`${dir}/${f}`);
    const keys = [...S.ROOM_META_KEYS, 'reasoningEffort', 'scheduleConnectionId'].join('|');
    const bad = [];
    for (const f of files) {
        let code = (await readFile(new URL(`../${f}`, import.meta.url), 'utf8')).replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`\\])\/\/.*$/gm, '$1');
        // (the migration itself reads them: its body is left out)
        if (f === 'src/phone2sched.js') { const a = code.indexOf('export function moveRoomMeta('), b = code.indexOf('\n}\n', a); code = code.slice(0, a) + code.slice(b + 3); }
        const res = [new RegExp(`presence\\??\\.on\\b`), new RegExp(`(presence|presenceOf\\([^)]*\\)|peek\\([^)]*\\))\\??\\.meta\\??\\.(${keys})\\b`), new RegExp(`(presence|presenceOf\\([^)]*\\)|peek\\([^)]*\\))\\??\\.meta\\??\\[`)];
        // (in phone2sched.js `p` is the presence: p.on · p.meta.<key>)
        if (f === 'src/phone2sched.js') res.push(new RegExp(`\\bp\\??\\.on\\b`), new RegExp(`\\bp\\??\\.meta\\??\\.(${keys})\\b`));
        for (const re of res) { const hit = code.match(re); if (hit) bad.push(`${f}: ${hit[0]}`); }
    }
    assert.deepEqual(bad, []);
});
test('옛 저장 옮기기: 방에 이미 있는 값이 이겨요. Orbit 값이 없는 세계는 방에 아무것도 안 만들어요', () => {
    const a = oldWorld();
    a.w.messenger.rooms.r1.meta = { groupChatMode: 'merged', autoTranslate: false };
    assert.equal(S.moveRoomMeta(a.m), 3);
    assert.deepEqual(a.w.messenger.rooms.r1.meta, { ...MOVED, groupChatMode: 'merged', autoTranslate: false });
    const b = oldWorld();
    b.w.presence = { schedules: {}, overrides: {}, meta: {}, user: {} };
    S.moveRoomMeta(b.m);
    assert.deepEqual([b.w.messenger.rooms.r1.meta, b.w.messenger.rooms.r1.chatParameters, b.w[L.ROOM_META_MARK]], [undefined, undefined, 1]);
});
test('옛 세계에 새 방 · 분기 · 비우기: 먼저 옮기고, 새 방은 Orbit 값을 받지 않아요(마리나라: 새 채팅은 기본값부터). 분기는 그 방의 것을 받아요', () => {
    const a = oldWorld();
    const fresh = L.ensureRoom(a.m, ['Ivo']);
    assert.equal(a.w[L.ROOM_META_MARK], 1);
    // (새 방은 Orbit 값이 아니라 새 채팅의 첫 값: 마법사의 Start. 단체방 방식 · 하루 상한 같은 옛 Orbit 값은 안 받아요)
    assert.deepEqual([a.w.messenger.rooms.r1.meta.autonomousMessages, fresh.meta, fresh.chatParameters], [true, START(false), undefined]);
    const b = oldWorld();
    const br = R.branchRoom(b.m, 'r1');
    assert.deepEqual([br.meta, br.chatParameters], [MOVED, { reasoningEffort: 'high' }]);
    const c = oldWorld();
    assert.equal(L.resetLive(c.m, 'chats'), 'chats');
    const nw = L.liveWorld(c.m);
    assert.deepEqual([nw.messenger.rooms.r1.meta, nw[L.ROOM_META_MARK], nw.presence], [MOVED, 1, undefined]);   // (전에는 비우면 설정이 사라졌어요)
});

// 새 방의 첫 값: 새 채팅(chats.storage.ts create) 위에 설정 마법사를 기본값 그대로 Start한 것 (소망 2026-11-24, phone2sched.js NEW_ROOM_SETUP)
const START = sched => ({ autonomousMessages: true, conversationSchedulesEnabled: sched, characterCommands: false, conversationCommandToggles: {}, conversationSetupComplete: true, customSystemPrompt: null });
// 지금 세계: Mara의 방(a) · Mara와 Ivo의 단체방(g). 방마다 따로인지 보는 테스트라, 방은 정한 적이 없는 것으로 (새 방의 첫 값은 아래 따로)
function world() {
    const m = { phones: {} };
    L.startFresh(m, { persona: 'Ren', scope: 'test' });
    const w = L.liveWorld(m);
    w.phones = { mara: { owner: 'Mara' }, ivo: { owner: 'Ivo' } };
    const a = L.ensureRoom(m, ['Mara']), g = L.ensureRoom(m, ['Mara', 'Ivo']);
    delete a.meta; delete g.meta;
    return { m, w, a, g };
}
test('방마다 따로: 먼저 말 걸기 · 단체방 · 하루 수 · 쉬는 시간 (마리나라: 방 둘에 있는 사람은 하루에 두 배까지 걸 수 있어요)', () => {
    const { m, w, a, g } = world();
    S.setAutonomous(m, a.id, true);
    S.setAutonomousOptions(m, g.id, { groupChatMode: 'individual', autonomousDailyCapOverride: 1 });
    assert.deepEqual([S.autonomousOptions(m, a.id).on, S.autonomousOptions(m, g.id).on, S.groupMode(m, a.id), S.groupMode(m, g.id)], [true, false, 'merged', 'individual']);
    assert.equal(S.autonomousOptions(m, a.id).autonomousDailyCapOverride, null);
    S.noteProactive(m, a.id, 'mara', 'check_in', NOW);
    assert.equal(a.meta.autonomousDailyBudget.counts.mara, 1);
    assert.ok(a.meta.intentCooldowns.mara.check_in);
    assert.deepEqual([g.meta.autonomousDailyBudget, g.meta.intentCooldowns, w.presence?.meta?.autonomousDailyBudget], [undefined, undefined, undefined]);
    assert.equal(S.checkProactive(m, g.id, { now: NOW }).reason, 'disabled');
    // 번역 · 명령 · 그림 설명도 방마다
    a.meta.autoTranslate = true; a.meta.translationOutputTargetLang = 'ko';
    assert.deepEqual([TRL.autoTranslateOn(m, a.id), TRL.autoTranslateOn(m, g.id), TRL.translationConfigOf(m, a.id).outputTargetLanguage, TRL.translationConfigOf(m, g.id).outputTargetLanguage], [true, false, 'ko', 'en']);
    assert.deepEqual([TRL.liveTranslationSettings(m, a.id).autoTranslate, TRL.liveTranslationSettings(m, g.id).autoTranslate, TRL.autoTranslationConnection(m, a.id)], [true, false, '']);
    g.meta.characterCommands = false; g.meta.imageCaptioningEnabled = true;
    assert.deepEqual([G.liveCommands(m, a.id).enabled, G.liveCommands(m, g.id).enabled, G.liveCaptioning(m, a.id).enabled, G.liveCaptioning(m, g.id).enabled], [true, false, false, true]);
    // (모르는 방에는 못 써요)
    assert.throws(() => S.setAutonomous(m, 'nope', true), /채팅방을 찾을 수 없습니다/);
});
test('방 밖에서는 (가): 그 사람이 있는 방 가운데 하나라도 스케줄을 켰으면 따라요. 방 안에서는 그 방의 스위치', () => {
    const { m, w, a, g } = world();
    S.setSchedule(m, 'Mara', all('dnd', 'working'), NOW);
    S.setSchedulesOn(m, a.id, false);
    S.setSchedulesOn(m, g.id, true);
    assert.equal(S.followsSchedule(m, 'Mara'), true);
    assert.equal(G.liveStatus(m, 'Mara')?.status, 'dnd');                             // (연락처 · 프로필: 방 밖)
    assert.equal(G.liveStatus(m, 'Mara', a.id), null);                                // (그 방에서는 꺼져 있어요)
    assert.equal(G.liveStatus(m, 'Mara', g.id)?.status, 'dnd');
    assert.equal(S.replyDelay(m, 'Mara', { now: NOW, room: a.id }), 0);
    assert.ok(S.replyDelay(m, 'Mara', { now: NOW, room: g.id }) > 0);
    assert.match(S.contextBlock(m, 'Mara', a.id, { now: NOW }), /^Your current status: online\./);
    assert.match(S.contextBlock(m, 'Mara', g.id, { now: NOW }), /^Your current status: Mara: busy/);
    // (폰이 스케줄을 따라가요: 방 밖의 규칙)
    assert.equal(G.followSchedule(m, NOW.getTime()), 1);
    assert.match(w.phones.mara.schedState.text, /working/);
    // 둘 다 끄면 안 따라요
    S.setSchedulesOn(m, g.id, false);
    assert.deepEqual([S.followsSchedule(m, 'Mara'), G.liveStatus(m, 'Mara'), S.activeSchedule(m, 'Mara')], [false, null, null]);
    // 방이 하나도 없는 사람: 방의 기본값처럼 스케줄이 있으면 따라요
    w.phones.varo = { owner: 'Varo' };
    S.setSchedule(m, 'Varo', all('idle', 'nap'), NOW);
    assert.equal(S.followsSchedule(m, 'Varo'), true);
    assert.equal(G.liveStatus(m, 'Varo')?.status, 'idle');
});
test('새 방: 새 채팅(create: 카드에 스케줄이 있으면 스케줄 켬) 위에 설정 마법사의 Start 값 (ChatSetupWizard.tsx 1238~1258, 저장한 마법사 기본값 · 프로필 없음)', () => {
    const { m } = world();
    S.setSchedule(m, 'Ivo', all('online', 'free'), NOW);
    const withIvo = L.ensureRoom(m, ['Ivo']);
    assert.deepEqual(withIvo.meta, START(true));
    const none = L.ensureRoom(m, ['Varo']);
    assert.deepEqual(none.meta, START(false));                                          // (스케줄 스위치를 꼭 적어요: false)
    assert.equal(S.schedulesOn(m, none.id), false);
    // (그래서 새 방은 먼저 말 걸기가 켜져 있고, 명령은 꺼져 있어요)
    assert.deepEqual([S.autonomousOptions(m, none.id).on, G.liveCommands(m, none.id).enabled, S.chatSettingsOf(m, none.id).customSystemPrompt], [true, false, null]);
});
test('스케줄 만들기를 그 방에서 하면 그 방의 스케줄을 켜요 (마리나라 /schedule/generate 843~856)', async () => {
    const { m, a, g } = world();
    S.setSchedulesOn(m, a.id, false);
    const day = [{ time: '00:00-00:00', activity: 'reading', status: 'online' }];
    const ask = async () => JSON.stringify({ talkativeness: 30, inactivityThresholdMinutes: 90, days: Object.fromEntries(DAYS.map(d => [d, day])) });
    const out = await S.renewSchedules(m, { ask, owners: ['Mara'], cards: { mara: { name: 'Mara', description: 'a nurse' } }, forceRefresh: true, now: NOW, roomId: a.id });
    assert.equal(out.results.mara.status, 'generated');
    assert.deepEqual([a.meta.conversationSchedulesEnabled, g.meta?.conversationSchedulesEnabled], [true, undefined]);
});
test('분기 (마리나라 chats.routes.ts branch): 연결 · 모델 고르기 · chatParameters · 채팅 메타가 같이 가요 (사본으로)', () => {
    const { m, a } = world();
    Object.assign(a, { connectionId: 'profile:p1', model: { modelOverride: { connectionId: 'profile:p1', model: 'x' }, followsMainModel: false }, chatParameters: { reasoningEffort: 'high' } });
    a.meta = { autonomousMessages: true, autoTranslate: true, autonomousDailyBudget: { date: 'd', counts: { mara: 1 } } };
    a.messages.push({ id: 'm1', n: 1, from: 'Ren', text: 'hi', at: 1 });
    const b = R.branchRoom(m, a.id);
    assert.deepEqual([b.connectionId, b.model, b.chatParameters, b.meta], [a.connectionId, a.model, a.chatParameters, a.meta]);
    b.meta.autoTranslate = false; b.chatParameters.reasoningEffort = 'low'; b.model.followsMainModel = true;
    assert.deepEqual([a.meta.autoTranslate, a.chatParameters.reasoningEffort, a.model.followsMainModel], [true, 'high', false]);
    // (아무것도 고르지 않은 방의 분기에는 아무것도 안 생겨요)
    const plain = L.ensureRoom(m, ['Varo']);
    delete plain.meta;
    const pb = R.branchRoom(m, plain.id);
    assert.deepEqual(['connectionId' in pb, 'model' in pb, 'chatParameters' in pb, 'meta' in pb, 'promptPresetId' in pb], [false, false, false, false, false]);
    // (프롬프트 프리셋도 가요: 마리나라의 분기는 새 채팅에 연결 · 페르소나 · 프리셋을 넣어요. 연결된 채팅은 안 가요)
    S.setChatSettings(m, a.id, { promptPresetId: 'pp', connectedChatId: 'c9', lorebookTokenBudget: 50 });
    const b2 = R.branchRoom(m, a.id);
    assert.deepEqual([b2.promptPresetId, 'connectedChatId' in b2, b2.meta.lorebookTokenBudget], ['pp', false, 50]);
});
test('저장 조각 (phone2keep.js): 방의 설정은 그 방의 조각에. 브라우저와 서버가 다른 방 · 같은 방의 다른 열쇠를 바꿔도 둘 다 남아요', () => {
    const { m, a, g } = world();
    a.meta = { autonomousMessages: true }; g.meta = { groupChatMode: 'individual' };
    const parts = K.splitLive(m.live);
    assert.deepEqual(parts[`room/${a.id}`].room.meta, { autonomousMessages: true });
    assert.ok(!JSON.stringify(parts.live).includes('autonomousMessages'));
    const base = JSON.parse(JSON.stringify(m.live)), server = JSON.parse(JSON.stringify(m.live)), local = JSON.parse(JSON.stringify(m.live));
    server.world.messenger.rooms[a.id].meta.autonomousDailyBudget = { date: 'd', counts: { mara: 1 } };   // (서버가 먼저 건 말을 셌어요)
    local.world.messenger.rooms[a.id].meta.autoTranslate = true;                                         // (브라우저에서 이 방의 번역을 켰어요)
    local.world.messenger.rooms[g.id].meta.groupResponseOrder = 'smart';
    const out = K.merge3(base, server, local);
    assert.deepEqual(out.world.messenger.rooms[a.id].meta, { autonomousMessages: true, autonomousDailyBudget: { date: 'd', counts: { mara: 1 } }, autoTranslate: true });
    assert.deepEqual(out.world.messenger.rooms[g.id].meta, { groupChatMode: 'individual', groupResponseOrder: 'smart' });
});
test('추론 레벨: "Orbit 전체" 줄은 없어요 (마리나라는 chatParameters 하나). 방이 없으면 못 정해요', async () => {
    const { m, a } = world();
    T.metadata = { narrative_archive: m };
    try {
        await assert.rejects(G.liveSetReasoning(m, '', 'high'), /채팅방을 찾을 수 없습니다/);
        await G.liveSetReasoning(m, a.id, 'high');
        const r = G.liveReasoning(m, a.id);
        assert.deepEqual(['all' in r, 'allChoices' in r, a.chatParameters], [false, false, { reasoningEffort: 'high' }]);
        assert.equal(L.liveWorld(m).presence?.meta?.reasoningEffort, undefined);
    } finally { delete T.metadata; }
});
test('화면에만 있던 칸의 값도 방마다 (마리나라의 열쇠 · 기본값 · 저장 규칙 그대로, 저장만): 읽기 · 쓰기 · 합치기', async () => {
    const { m, w, a, g } = world();
    // 마리나라의 기본값
    assert.deepEqual(S.chatSettingsOf(m, a.id), { appliedChatPresetId: null, promptPresetId: null, customSystemPrompt: null, inactiveCharacterIds: [], crossChatAwareness: true, connectedChatId: null,
        lorebookTokenBudget: 8192, enableMemoryRecall: true, semanticSummaryRetrievalEnabled: false, semanticSummaryRecentCount: 2, semanticSummaryOlderCount: 3, semanticSummaryMinSimilarity: 0.15,
        summaryConnectionId: '', summaryMaxTokens: 4096, dayRolloverHour: 4, summaryTailMessages: 10 });
    // 쓰기: 그 방에만
    S.setChatSettings(m, a.id, { appliedChatPresetId: 'p1', customSystemPrompt: 'Talk.', crossChatAwareness: false, lorebookTokenBudget: '12.7', enableMemoryRecall: false, semanticSummaryRetrievalEnabled: true,
        semanticSummaryRecentCount: 4, semanticSummaryMinSimilarity: 0.3, summaryConnectionId: 'ai', summaryMaxTokens: 99999, dayRolloverHour: 2, summaryTailMessages: 0, connectedChatId: 'chat-9' });
    const A = S.chatSettingsOf(m, a.id);
    assert.deepEqual([A.appliedChatPresetId, A.customSystemPrompt, A.crossChatAwareness, A.lorebookTokenBudget, A.enableMemoryRecall, A.semanticSummaryRetrievalEnabled, A.semanticSummaryRecentCount, A.semanticSummaryOlderCount, A.semanticSummaryMinSimilarity, A.summaryConnectionId, A.summaryMaxTokens, A.dayRolloverHour, A.summaryTailMessages, A.connectedChatId],
        ['p1', 'Talk.', false, 12, false, true, 4, 3, 0.3, 'ai', 32768, 2, 0, 'chat-9']);
    assert.equal(a.connectedChatId, 'chat-9');                                          // (채팅 줄의 칸: 방에)
    assert.deepEqual(S.chatSettingsOf(m, g.id).lorebookTokenBudget, 8192);              // (다른 방은 그대로)
    // 프롬프트 프리셋을 바꾸면 이 방의 대화 프롬프트는 지워져요 (ChatSettingsDrawer handleModePromptPresetChange)
    S.setChatSettings(m, a.id, { promptPresetId: 'pp' });
    assert.deepEqual([a.promptPresetId, S.chatSettingsOf(m, a.id).customSystemPrompt, a.meta.customSystemPrompt], ['pp', null, null]);
    S.setChatSettings(m, a.id, { promptPresetId: '' });
    assert.equal('promptPresetId' in a, false);
    // 의미 기반 요약 검색 숫자: 틀리면 오류 (마리나라 400), 저장된 값이 틀리면 셋 다 기본값
    assert.throws(() => S.setChatSettings(m, a.id, { semanticSummaryOlderCount: 21 }), /의미 기반 요약 검색 설정이 올바르지 않습니다/);
    a.meta.semanticSummaryOlderCount = 'x';
    assert.deepEqual([S.chatSettingsOf(m, a.id).semanticSummaryRecentCount, S.chatSettingsOf(m, a.id).semanticSummaryMinSimilarity], [2, 0.15]);
    // 꺼 둔 캐릭터: 이 방의 사람만, 한 번씩. 마지막 한 명은 못 꺼요
    S.setChatSettings(m, g.id, { inactiveCharacterIds: ['Ivo', 'ivo', 'Varo'] });
    assert.deepEqual(g.meta.inactiveCharacterIds, ['ivo']);
    assert.throws(() => S.setChatSettings(m, g.id, { inactiveCharacterIds: ['ivo', 'mara'] }), /캐릭터를 하나 이상 활성 상태로/);
    assert.throws(() => S.setChatSettings(m, g.id, { inactiveCharacterIds: 'ivo' }), /문자열 배열/);
    // 저장된 값이 틀려도 읽을 때 마리나라의 범위로 (요약 길이 1~32768 · 하루가 바뀌는 시각 0~11, 숫자가 아니면 기본값)
    for (const [v, want] of [[0, 4096], [-5, 4096], ['x', 4096], [999999, 32768], [12.9, 12], [null, 4096]]) { g.meta.summaryMaxTokens = v; assert.equal(S.chatSettingsOf(m, g.id).summaryMaxTokens, want, `summaryMaxTokens ${v}`); }
    for (const [v, want] of [['abc', 4], [NaN, 4], [-3, 0], [30, 11], [7.8, 7], [null, 4]]) { g.meta.dayRolloverHour = v; assert.equal(S.chatSettingsOf(m, g.id).dayRolloverHour, want, `dayRolloverHour ${v}`); }
    delete g.meta.summaryMaxTokens; delete g.meta.dayRolloverHour;
    // 화면 함수 (저장까지)
    assert.equal((await G.liveSetChatSettings(m, g.id, { summaryTailMessages: 7 })).summaryTailMessages, 7);
    assert.equal(G.liveChatSettings(m, g.id).summaryTailMessages, 7);
    // 합치기: 방의 조각 안에서 열쇠마다 (브라우저가 프롬프트를, 서버가 하루 수를)
    const base = JSON.parse(JSON.stringify(m.live)), server = JSON.parse(JSON.stringify(m.live)), local = JSON.parse(JSON.stringify(m.live));
    server.world.messenger.rooms[g.id].meta.autonomousDailyBudget = { date: 'd', counts: { mara: 1 } };
    local.world.messenger.rooms[g.id].meta.customSystemPrompt = 'Mine.';
    local.world.messenger.rooms[g.id].promptPresetId = 'pp2';
    const out = K.merge3(base, server, local).world.messenger.rooms[g.id];
    assert.deepEqual([out.meta.customSystemPrompt, out.promptPresetId, out.meta.autonomousDailyBudget.counts.mara, out.meta.summaryTailMessages], ['Mine.', 'pp2', 1, 7]);
    // (Orbit에는 아무것도 안 생겨요)
    assert.equal(JSON.stringify(w.presence || {}).includes('summaryTailMessages'), false);
});
test('일정 생성 선호는 앱 전체 하나 (마리나라 ui.store scheduleGenerationPreferences): 확장 설정에', () => {
    T.st = { extensionSettings: { narrative_archive: {} }, saveSettingsDebounced() { T.prefsSaved = (T.prefsSaved || 0) + 1; } };
    try {
        assert.equal(G.liveScheduleGenerationPreferences(), '');
        G.liveSetScheduleGenerationPreferences('Nobody stays up past midnight.');
        assert.deepEqual([T.st.extensionSettings.narrative_archive.scheduleGenerationPreferences, G.liveScheduleGenerationPreferences(), T.prefsSaved], ['Nobody stays up past midnight.', 'Nobody stays up past midnight.', 1]);
        G.liveSetScheduleGenerationPreferences('');
        assert.equal('scheduleGenerationPreferences' in T.st.extensionSettings.narrative_archive, false);
    } finally { delete T.st; delete T.prefsSaved; }
});
