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

// 2026-11-24 전의 저장: 채팅 설정이 Orbit에 하나 (w.presence.on · meta). 방은 손으로 넣어요 (ensureRoom은 먼저 옮겨요)
function oldWorld() {
    const m = { phones: {} };
    L.startFresh(m, { persona: 'Ren', scope: 'test' });
    const w = L.liveWorld(m);
    w.phones = { mara: { owner: 'Mara' }, ivo: { owner: 'Ivo' } };
    w.messenger.rooms = {
        r1: { id: 'r1', members: ['Ren', 'Mara'], messages: [] },
        r2: { id: 'r2', members: ['Ren', 'Mara', 'Ivo'], messages: [], chatParameters: { reasoningEffort: 'low' } },
    };
    w.messenger.trash = [{ room: { id: 'r3', members: ['Ren', 'Ivo'], messages: [] }, at: Date.now() }];
    w.presence = { on: true, schedules: {}, overrides: {}, user: { status: 'idle', manual: 'idle' }, meta: {
        autonomousDailyCapOverride: 4, groupChatMode: 'individual', groupResponseOrder: 'smart', groupTurnPromptEnabled: false, characterExchanges: true,
        conversationSchedulesEnabled: false, characterCommands: false, conversationCommandToggles: { react: false },
        imageCaptioningEnabled: true, imageCaptioningConnectionId: 'ai', imageCaptioningPrompt: 'Look.',
        autoTranslate: true, translationOutputTargetLang: 'ko', translationTargetLang: 'fr', translationPrompt: 'Old',
        autonomousDailyBudget: { date: '2026-11-23', counts: { mara: 2 } }, intentCooldowns: { mara: { check_in: '2026-11-23T01:00:00.000Z' } },
        reasoningEffort: 'high', scheduleConnectionId: 'profile:p1', conversationTimeZone: 'Asia/Seoul',
    } };
    return { m, w };
}
const MOVED = { autonomousMessages: true, autonomousDailyCapOverride: 4, groupChatMode: 'individual', groupResponseOrder: 'smart', groupTurnPromptEnabled: false, characterExchanges: true,
    conversationSchedulesEnabled: false, characterCommands: false, conversationCommandToggles: { react: false }, imageCaptioningEnabled: true, imageCaptioningConnectionId: 'ai', imageCaptioningPrompt: 'Look.',
    translationTargetLang: 'fr', translationOutputTargetLang: 'ko', translationPrompt: 'Old', autoTranslate: true,
    autonomousDailyBudget: { date: '2026-11-23', counts: { mara: 2 } }, intentCooldowns: { mara: { check_in: '2026-11-23T01:00:00.000Z' } } };

test('옛 저장 옮기기: Orbit 하나의 값이 모든 방(지운 방까지)에, 한 번만. 화면이 읽는 값은 그대로예요', () => {
    const { m, w } = oldWorld();
    assert.deepEqual(S.roomMeta(m, 'r1'), MOVED);                                     // (읽는 함수가 먼저 옮겨요)
    assert.deepEqual(w.messenger.rooms.r2.meta, MOVED);
    assert.deepEqual(w.messenger.trash[0].room.meta, MOVED);                           // (되살리면 그 설정 그대로)
    assert.notEqual(w.messenger.rooms.r1.meta.conversationCommandToggles, w.messenger.rooms.r2.meta.conversationCommandToggles);   // (방마다 따로인 값)
    // ("Orbit 전체" 추론 레벨: 자기 값이 없는 방에만. 스케줄 생성 연결: 마리나라처럼 저장하지 않아서 버려요)
    assert.deepEqual([w.messenger.rooms.r1.chatParameters, w.messenger.rooms.r2.chatParameters, w.messenger.trash[0].room.chatParameters], [{ reasoningEffort: 'high' }, { reasoningEffort: 'low' }, { reasoningEffort: 'high' }]);
    // (Orbit에 남는 것: 시간대 · 내 상태 · 스케줄. 옮긴 열쇠는 지워요)
    assert.deepEqual([w.presence.meta, w.presence.user, 'on' in w.presence], [{ conversationTimeZone: 'Asia/Seoul' }, { status: 'idle', manual: 'idle' }, false]);
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
    // 옛 페이지가 그 뒤에 Orbit 값을 다시 써도 되살아나지 않아요 (표시가 있어서 아무도 안 읽어요)
    w.presence.on = false;
    w.presence.meta.groupChatMode = 'merged';
    w.presence.meta.translationInputPrompt = 'stale';
    assert.deepEqual([S.autonomousOptions(m, 'r1').on, S.groupMode(m, 'r1'), S.roomMeta(m, 'r1').translationInputPrompt], [true, 'individual', undefined]);
    assert.equal(S.roomMeta(m, 'nope').autonomousMessages, undefined);
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
    assert.deepEqual([a.w.messenger.rooms.r1.meta.autonomousMessages, fresh.meta?.autonomousMessages, fresh.chatParameters], [true, undefined, undefined]);
    const b = oldWorld();
    const br = R.branchRoom(b.m, 'r1');
    assert.deepEqual([br.meta, br.chatParameters], [MOVED, { reasoningEffort: 'high' }]);
    const c = oldWorld();
    assert.equal(L.resetLive(c.m, 'chats'), 'chats');
    const nw = L.liveWorld(c.m);
    assert.deepEqual([nw.messenger.rooms.r1.meta, nw[L.ROOM_META_MARK], nw.presence], [MOVED, 1, undefined]);   // (전에는 비우면 설정이 사라졌어요)
});

// 지금 세계: Mara의 방(a) · Mara와 Ivo의 단체방(g)
function world() {
    const m = { phones: {} };
    L.startFresh(m, { persona: 'Ren', scope: 'test' });
    const w = L.liveWorld(m);
    w.phones = { mara: { owner: 'Mara' }, ivo: { owner: 'Ivo' } };
    const a = L.ensureRoom(m, ['Mara']), g = L.ensureRoom(m, ['Mara', 'Ivo']);
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
test('새 방 (마리나라 chats.storage.ts create): 카드에 스케줄이 있는 사람이 있으면 스케줄을 켜요. 없으면 정하지 않아요', () => {
    const { m } = world();
    S.setSchedule(m, 'Ivo', all('online', 'free'), NOW);
    const withIvo = L.ensureRoom(m, ['Ivo']);
    assert.equal(withIvo.meta.conversationSchedulesEnabled, true);
    const none = L.ensureRoom(m, ['Varo']);
    assert.equal(none.meta?.conversationSchedulesEnabled, undefined);
    assert.equal(S.schedulesOn(m, none.id), false);
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
    const pb = R.branchRoom(m, plain.id);
    assert.deepEqual(['connectionId' in pb, 'model' in pb, 'chatParameters' in pb, 'meta' in pb], [false, false, false, false]);
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
