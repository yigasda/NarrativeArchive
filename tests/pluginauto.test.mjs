// 서버 플러그인의 먼저 말 걸기 스케줄러 (plugin/marinara/server-autonomous-scheduler.service.js: 마리나라 것 그대로).
// 가짜 app(inject · chats)을 주고, 시계는 가짜 타이머로 돌려요. 예시 캐릭터만 써요.
process.env.TZ = 'UTC';
import test from 'node:test';
import assert from 'node:assert/strict';
import { startServerAutonomousScheduler, shouldSkipAutonomousSweep, concludeAutonomousSweep } from '../plugin/marinara/server-autonomous-scheduler.service.js';
import { hasRoleplayDmThreadMarkers, isBackgroundAutonomousCandidate } from '../plugin/marinara/autonomous-candidates.js';
import { recordAutonomousClientPresence, recordUserActivity, recordAssistantActivity, markGenerationInProgress, getActivityState, clearChatActivity } from '../src/marinara/autonomous.service.js';

const SSE_SAVED = 'data: {"type":"message_saved","data":{"role":"assistant"}}\n\ndata: {"type":"done"}\n\n';
const SSE_NONE = 'data: {"type":"generation_discarded"}\n\ndata: {"type":"done"}\n\n';
const flush = async (n = 30) => { for (let i = 0; i < n; i++) await Promise.resolve(); };
// Wednesday 2026-11-18 09:00 UTC
const T0 = Date.UTC(2026, 10, 18, 9, 0, 0);
const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const week = blocks => ({ weekStart: new Date(Date.UTC(2026, 10, 16)).toISOString(), days: Object.fromEntries(DAYS.map(d => [d, blocks.map(b => ({ ...b }))])), inactivityThresholdMinutes: 60, talkativeness: 50 });
const FREE = [{ time: '00:00-23:59', activity: 'free time', status: 'online' }];

function world(t, { chats = {}, check = () => ({ shouldTrigger: false, characterIds: [] }), generate = () => ({ statusCode: 200, payload: SSE_SAVED }) } = {}) {
    t.mock.timers.enable({ apis: ['setTimeout', 'Date'], now: T0 });
    const calls = { check: [], generate: [], unread: [], hooks: [] };
    const rows = () => Object.entries(chats).map(([id, c]) => ({ id, mode: c.mode ?? 'conversation', metadata: c.meta ?? { autonomousMessages: true } }));
    const app = {
        chats: {
            list: async () => rows(),
            getById: async id => rows().find(c => c.id === id) || null,
            resolveConversationPresenceState: async id => ({ schedules: chats[id]?.schedules || {}, statusOverrides: chats[id]?.overrides || {} }),
            markAutonomousUnread: async (id, input) => { calls.unread.push([id, input]); },
        },
        activeGenerations: new Map(),
        db: {},
        addHook: (name, fn) => calls.hooks.push([name, fn]),
        inject: async ({ method, url, payload }) => {
            assert.equal(method, 'POST');
            if (url === '/api/conversation/autonomous/check') { calls.check.push(payload); const r = await check(payload); return r?.statusCode ? r : { statusCode: 200, payload: JSON.stringify(r) }; }
            if (url === '/api/generate') { calls.generate.push(payload); return generate(payload); }
            throw new Error(`unexpected ${url}`);
        },
    };
    const sched = startServerAutonomousScheduler(app);
    const tick = async ms => { t.mock.timers.tick(ms); await flush(); };
    t.after(() => { sched.stop(); for (const id of Object.keys(chats)) clearChatActivity(id); });
    return { app, calls, sched, tick };
}

test('처음은 20초 뒤, 그 뒤 60초마다. 켜 둔 대화방만 물어보고, 서버는 idle · 후속 2번까지 · source server로 물어요', async t => {
    const { calls, tick } = world(t, { chats: { a: {}, off: { meta: { autonomousMessages: false } }, rp: { mode: 'roleplay' }, mari: { meta: { autonomousMessages: true, internalAssistant: 'professor-mari' } }, scene: { meta: { autonomousMessages: true, sceneStatus: 'active' } } } });
    await tick(19_999);
    assert.equal(calls.check.length, 0);
    await tick(1);
    assert.deepEqual(calls.check, [{ chatId: 'a', userStatus: 'idle', maxFollowups: 2, source: 'server' }]);
    await tick(59_999);
    assert.equal(calls.check.length, 1);
    await tick(1);
    assert.equal(calls.check.length, 2);
    assert.equal(calls.generate.length, 0);
});

test('때가 된 방: 답장을 만들고(자리에 없음 · 늦음 없이 · 이유 같이), 나온 뒤에 안 읽음 표시를 해요', async t => {
    const { calls, tick } = world(t, {
        chats: { a: { meta: { autonomousMessages: true, conversationTimeZone: 'Asia/Seoul' } } },
        check: () => ({ shouldTrigger: true, characterIds: ['mara'], generationStartedAt: 5, autonomousIntentKey: 'long_absence_check_in' }),
    });
    await tick(20_000);
    assert.deepEqual(calls.generate, [{ chatId: 'a', connectionId: null, forCharacterId: 'mara', streaming: false, userStatus: 'idle', userActivity: 'away or offline', autonomous: true, skipPresenceDelay: true, autonomousIntentKey: 'long_absence_check_in', userTimeZone: 'Asia/Seoul' }]);
    assert.deepEqual(calls.unread, [['a', { characterId: 'mara' }]]);
});

test('창이 75초 안에 살아 있던 방은 서버가 건드리지 않아요', async t => {
    const { calls, tick } = world(t, { chats: { a: {}, b: {} }, check: () => ({ shouldTrigger: true, characterIds: ['mara'] }) });
    recordAutonomousClientPresence('a', 'active');
    await tick(20_000);
    assert.deepEqual(calls.check.map(c => c.chatId), ['b']);
    // 75초가 지나면 그 방도 봐요
    await tick(60_000);
    assert.deepEqual(calls.check.map(c => c.chatId), ['b', 'a', 'b']);
});

test('이미 답장을 만들고 있는 방은 건너뛰어요', async t => {
    const { app, calls, tick } = world(t, { chats: { a: {} } });
    app.activeGenerations.set('a', {});
    await tick(20_000);
    assert.equal(calls.check.length, 0);
});

test('한 번에 2방까지. 다음에는 덜 본 방부터 돌아가며 봐요', async t => {
    let hold; const gate = new Promise(r => { hold = r; });
    const { calls, tick } = world(t, { chats: { a: {}, b: {}, c: {}, d: {} }, check: async () => { await gate; return { shouldTrigger: false, characterIds: [] }; } });
    await tick(20_000);
    assert.deepEqual(calls.check.map(c => c.chatId), ['a', 'b']);
    hold(); await flush();
    await tick(60_000);
    assert.deepEqual(calls.check.map(c => c.chatId), ['a', 'b', 'c', 'd']);
    await tick(60_000);
    assert.deepEqual(calls.check.map(c => c.chatId).slice(4), ['a', 'b']);
});

test('오프라인이면 안 보내고 표시를 풀어요. 바쁘면 그 늦음만큼 뒤에 보내요', async t => {
    const busy = week([{ time: '00:00-23:59', activity: 'work', status: 'dnd' }]), off = week([{ time: '00:00-23:59', activity: 'sleep', status: 'offline' }]);
    const { calls, tick } = world(t, {
        chats: { a: { schedules: { mara: off } }, b: { schedules: { ivo: { ...busy, dndResponseDelayMinutes: 10 } } } },
        check: p => { const startedAt = markGenerationInProgress(p.chatId); return { shouldTrigger: true, characterIds: [p.chatId === 'a' ? 'mara' : 'ivo'], generationStartedAt: startedAt }; },
    });
    await tick(20_000);
    assert.equal(calls.generate.length, 0);
    assert.equal(getActivityState('a').generationInProgressSince, null);
    assert.notEqual(getActivityState('b').generationInProgressSince, null);
    // 그 방은 늦음이 끝날 때까지 자리를 잡고 있어요: 다음 폴링이 다시 묻지 않아요
    await tick(60_000);
    assert.deepEqual(calls.check.map(c => c.chatId), ['a', 'b', 'a']);
    await tick(10 * 60_000);
    assert.deepEqual(calls.generate.map(g => [g.chatId, g.forCharacterId]), [['b', 'ivo']]);
});

test('늦음이 끝났을 때 창이 살아 있으면 안 보내고 표시를 풀어요', async t => {
    const busy = { ...week([{ time: '00:00-23:59', activity: 'work', status: 'dnd' }]), dndResponseDelayMinutes: 5 };
    const { calls, tick } = world(t, { chats: { b: { schedules: { ivo: busy } } }, check: p => ({ shouldTrigger: true, characterIds: ['ivo'], generationStartedAt: markGenerationInProgress(p.chatId) }) });
    await tick(20_000);
    await tick(4 * 60_000);
    recordAutonomousClientPresence('b', 'active');
    await tick(60_000);
    assert.equal(calls.generate.length, 0);
    assert.equal(getActivityState('b').generationInProgressSince, null);
});

test('꺼 둔 이유(disabledAutonomousIntents)면 안 보내요. check_in은 끌 수 없어요', async t => {
    // 09:00: 방금 오프라인에서 깼어요 → good_morning
    const morning = week([{ time: '00:00-08:00', activity: 'sleep', status: 'offline' }, { time: '08:00-23:59', activity: 'free time', status: 'online' }]);
    const { calls, tick } = world(t, {
        chats: { a: { schedules: { mara: { ...morning, disabledAutonomousIntents: ['good_morning'] } } }, b: { schedules: { ren: morning } }, c: { schedules: { ivo: { ...week(FREE), disabledAutonomousIntents: ['check_in'] } } } },
        check: p => { recordUserActivity(p.chatId, { occurredAt: T0 - 3 * 3600_000 }); recordAssistantActivity(p.chatId); return { shouldTrigger: true, characterIds: [{ a: 'mara', b: 'ren', c: 'ivo' }[p.chatId]], generationStartedAt: markGenerationInProgress(p.chatId) }; },
    });
    await tick(20_000);
    await tick(60_000);
    assert.deepEqual(calls.generate.map(g => [g.chatId, g.autonomousIntentKey]).sort(), [['b', 'good_morning'], ['c', 'check_in']]);
    assert.equal(getActivityState('a').generationInProgressSince, null);
});

test('이유가 쉬는 시간이면 안 보내요', async t => {
    const morning = week([{ time: '00:00-08:00', activity: 'sleep', status: 'offline' }, { time: '08:00-23:59', activity: 'free time', status: 'online' }]);
    const { calls, tick } = world(t, {
        chats: { a: { meta: { autonomousMessages: true, intentCooldowns: { mara: { good_morning: new Date(T0 - 3600_000).toISOString() } } }, schedules: { mara: morning } } },
        check: p => { recordUserActivity(p.chatId, { occurredAt: T0 - 3 * 3600_000 }); recordAssistantActivity(p.chatId); return { shouldTrigger: true, characterIds: ['mara'], generationStartedAt: markGenerationInProgress(p.chatId) }; },
    });
    await tick(20_000);
    assert.equal(calls.generate.length, 0);
});

test('실패: 5분부터 두 배로(1시간까지) 쉬어요. 4xx는 30분씩. 409는 쉬지 않아요', async t => {
    let answer = { statusCode: 500, payload: 'boom' };
    const { calls, tick } = world(t, { chats: { a: {} }, check: () => ({ shouldTrigger: true, characterIds: ['mara'] }), generate: () => answer });
    t.mock.method(console, 'warn', () => {});
    await tick(20_000);
    assert.equal(calls.generate.length, 1);
    await tick(4 * 60_000);
    assert.equal(calls.check.length, 1);
    await tick(60_000);
    assert.equal(calls.generate.length, 2);
    // 두 번째 실패: 10분
    await tick(9 * 60_000);
    assert.equal(calls.generate.length, 2);
    await tick(60_000);
    assert.equal(calls.generate.length, 3);
    // 4xx: 30분 × 횟수 (네 번째 실패 → 1시간까지)
    answer = { statusCode: 401, payload: 'no key' };
    await tick(20 * 60_000);
    assert.equal(calls.generate.length, 4);
    await tick(59 * 60_000);
    assert.equal(calls.generate.length, 4);
    await tick(60_000);
    assert.equal(calls.generate.length, 5);
    assert.equal(calls.unread.length, 0);
});

test('409(이미 만드는 중) · 아무것도 안 나옴: 쉬지 않고 다음 폴링에 다시 봐요. 나온 것이 없으면 안 읽음 표시도 없어요', async t => {
    const answers = [{ statusCode: 409, payload: '' }, { statusCode: 200, payload: SSE_NONE }, { statusCode: 200, payload: 'data: {"type":"error","data":"model said no"}\n\n' }, { statusCode: 200, payload: SSE_SAVED }];
    const { calls, tick } = world(t, { chats: { a: {} }, check: () => ({ shouldTrigger: true, characterIds: ['mara'] }), generate: () => answers.shift() });
    t.mock.method(console, 'warn', () => {});
    await tick(20_000); await tick(60_000); await tick(60_000);
    assert.equal(calls.generate.length, 3);
    assert.equal(calls.unread.length, 0);
    // (오류 답은 쉬어요: 5분)
    await tick(4 * 60_000);
    assert.equal(calls.generate.length, 3);
    await tick(60_000);
    assert.equal(calls.generate.length, 4);
    assert.equal(calls.unread.length, 1);
});

test('멈추면 더 돌지 않아요', async t => {
    const { calls, sched, tick } = world(t, { chats: { a: {} } });
    assert.equal(calls.hooks[0][0], 'onClose');
    sched.stop();
    await tick(10 * 60_000);
    assert.equal(calls.check.length, 0);
});

test('둘러보기 건너뛰기 판단 · 후보 거르기 (마리나라 것 그대로)', () => {
    assert.equal(shouldSkipAutonomousSweep(3, 3), true);
    assert.equal(shouldSkipAutonomousSweep(3, 4), false);
    assert.equal(shouldSkipAutonomousSweep(null, 3), false);
    assert.equal(shouldSkipAutonomousSweep(3, null), false);
    assert.equal(concludeAutonomousSweep({ inconclusive: false, sawEligible: false, generation: 7 }), 7);
    assert.equal(concludeAutonomousSweep({ inconclusive: true, sawEligible: false, generation: 7 }), null);
    assert.equal(concludeAutonomousSweep({ inconclusive: false, sawEligible: true, generation: 7 }), null);
    assert.equal(isBackgroundAutonomousCandidate({ mode: 'conversation', metadata: { autonomousMessages: true } }), true);
    assert.equal(isBackgroundAutonomousCandidate({ mode: 'conversation', metadata: '{"autonomousMessages":true}' }), true);
    assert.equal(isBackgroundAutonomousCandidate({ mode: 'conversation', metadata: '{bad' }), false);
    assert.equal(isBackgroundAutonomousCandidate({ mode: 'conversation', metadata: { autonomousMessages: true, internalAssistant: 'professor-mari' } }), false);
    assert.equal(isBackgroundAutonomousCandidate({ mode: 'roleplay', metadata: { autonomousMessages: true } }), false);
    assert.equal(isBackgroundAutonomousCandidate({ mode: 'conversation', metadata: null }), false);
    assert.equal(hasRoleplayDmThreadMarkers({ roleplayDmThread: true }), true);
    assert.equal(hasRoleplayDmThreadMarkers({ dmOriginChatId: 'x' }), true);
    assert.equal(hasRoleplayDmThreadMarkers({}), false);
});
