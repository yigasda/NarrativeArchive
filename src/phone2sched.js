// 폰 2(실시간) 메신저의 스케줄 · 상태 · 먼저 말 걸기 · 늦은 답 (docs/PHONE2-PLAN.md "스케줄 · 먼저 말 걸기").
// 판단과 지시문은 전부 마리나라의 것이에요 (src/marinara/). 이 파일은 그것을 우리 저장 모양에 잇기만 해요.
//   w.presence = {
//     on: 먼저 말 걸기를 켰나 (마리나라의 autonomousMessages),
//     schedules: { 폰 열쇠: 마리나라의 WeekSchedule }, overrides: { 폰 열쇠: 손으로 준 상태 (ConversationStatusOverride) },
//     meta: { autonomousDailyBudget, intentCooldowns, autonomousDailyCapOverride … } (마리나라가 채팅 메타에 두는 것 그대로),
//     user: { status: 'active' | 'idle' | 'dnd' | 'invisible', activity } (내 상태)
//   }
// 마리나라의 "채팅" = 우리 방 하나 (chatId = 세계 id:방 id), "캐릭터 id" = 폰 열쇠(liveKey).
// 저장은 부르는 쪽이 해요. 폰 1 · 아카이브는 읽지도 쓰지도 않아요. 폰 1은 이 파일을 부르지 않아요.

import { liveWorld, liveKey } from './phone2store.js';
import { generateCharacterSchedule, generateCharacterDaySchedule, getEffectiveCurrentStatus, getTodaySchedule, getDirectMessageDelay, getMonday, ScheduleDraftError } from './marinara/schedule.service.js';
import { CONVERSATION_SCHEDULE_DAYS } from './marinara/conversation-presence.js';
import { toZonedWallClockDate } from './marinara/timezone.js';
import { buildConversationCurrentContextBlock } from './marinara/conversation-context-block.js';
import { checkAutonomous, forgetAutonomousSeed } from './marinara/autonomous-check.js';
import { clearChatActivity, clearGenerationInProgress, buildAutonomousDailyBudgetPatch } from './marinara/autonomous.service.js';
import { buildIntentCooldownPatch, isMessageIntent } from './marinara/intent.service.js';

export { ScheduleDraftError, CONVERSATION_SCHEDULE_DAYS };
const obj = v => v && typeof v === 'object' && !Array.isArray(v);
const STATUSES = ['online', 'idle', 'dnd', 'offline'], USER = ['active', 'idle', 'dnd', 'invisible'];

function need(m) { const w = liveWorld(m); if (!w) throw new Error('아직 폰 2가 없어요'); return w; }
export function presenceOf(m) {
    const w = need(m), p = (w.presence = obj(w.presence) ? w.presence : {});
    p.schedules = obj(p.schedules) ? p.schedules : {}; p.overrides = obj(p.overrides) ? p.overrides : {};
    p.meta = obj(p.meta) ? p.meta : {}; p.user = obj(p.user) ? p.user : {};
    return p;
}
const peek = m => { const p = liveWorld(m)?.presence; return obj(p) ? p : {}; };
export const scheduleOf = (m, owner) => peek(m).schedules?.[liveKey(owner)] || null;
export const chatIdOf = (m, roomId) => `${liveWorld(m)?.id}:${roomId}`;

// 스케줄 넣기 (모델이 만든 것 · 손으로 고친 것): 마리나라의 WeekSchedule 모양. null이면 지워요
export function setSchedule(m, owner, schedule, now = new Date()) {
    const p = presenceOf(m), k = liveKey(owner);
    if (!schedule) { delete p.schedules[k]; return null; }
    if (!obj(schedule.days)) throw new Error('스케줄에 요일이 없어요');
    return (p.schedules[k] = { ...schedule, weekStart: schedule.weekStart || getMonday(now).toISOString() });
}
// 손으로 상태 주기 (minutes 뒤에 풀려요; 0 · 없음이면 풀 때까지). status가 없으면 풀어요
export function setStatusOverride(m, owner, { status, activity = '', minutes = 0 } = {}, now = new Date()) {
    const p = presenceOf(m), k = liveKey(owner);
    if (!status) { delete p.overrides[k]; return null; }
    if (!STATUSES.includes(status)) throw new Error('상태는 online · idle · dnd · offline 가운데 하나예요');
    return (p.overrides[k] = { status, activity: String(activity || '').trim().slice(0, 120) || null, createdAt: now.toISOString(), ...(minutes > 0 ? { expiresAt: new Date(now.getTime() + minutes * 60_000).toISOString() } : {}) });
}
// 내 상태 · 먼저 말 걸기 켜기
export function setUserStatus(m, { status = 'active', activity = '' } = {}) {
    if (!USER.includes(status)) throw new Error('내 상태는 active · idle · dnd · invisible 가운데 하나예요');
    return (presenceOf(m).user = { status, activity: String(activity || '').replace(/\s+/g, ' ').trim().slice(0, 120) });
}
export const setAutonomous = (m, on) => (presenceOf(m).on = !!on);

// 지금 상태 → { status, activity, override? } (스케줄도 손으로 준 상태도 없으면 null). tz: 그 사람의 시간대
export function statusNow(m, owner, { now = new Date(), tz = '' } = {}) {
    const p = peek(m), k = liveKey(owner), schedule = p.schedules?.[k] || null, override = p.overrides?.[k] || null;
    if (!schedule && !override) return null;
    return getEffectiveCurrentStatus(schedule, override, now, 'free time', toZonedWallClockDate(now, tz || undefined));
}
// 답장이 늦어지는 시간(ms): 0 바로 · null 지금은 답 안 함(offline). 스케줄이 없는 사람은 0
export function replyDelay(m, owner, opts = {}) {
    const st = statusNow(m, owner, opts);
    if (!st) return 0;
    if (st.status === 'offline') return null;
    return getDirectMessageDelay(st.status, scheduleOf(m, owner) || undefined);
}

// 답장 요청에 넣는 마리나라의 상황 글 (상태 · 내 상태 · 오늘 스케줄 · 지금 시각). 스케줄 · 상태가 아무도 없으면 ''
// tzOf(이름) → 그 사람의 시간대; lastRole: 방의 마지막 말이 'user'(나) | 'assistant'; said: 내가 새로 한 말이 있나
export function contextBlock(m, owner, roomId, { now = new Date(), tzOf = () => '', lastRole = 'user', said = true, intentKey = '' } = {}) {
    const w = liveWorld(m), room = w?.messenger?.rooms?.[roomId], p = peek(m);
    if (!w || !room) return '';
    const info = room.members.filter(n => liveKey(n) !== liveKey(w.persona)).map(n => {
        const st = statusNow(m, n, { now, tz: tzOf(n) }), schedule = scheduleOf(m, n);
        return st ? { charId: liveKey(n), name: n, status: st.status, activity: st.activity, todaySchedule: schedule ? getTodaySchedule(schedule, toZonedWallClockDate(now, tzOf(n) || undefined)) : '' } : null;
    }).filter(Boolean);
    if (!info.some(c => c.charId === liveKey(owner))) return '';
    return buildConversationCurrentContextBlock({
        nowInstant: now, promptTimeZone: tzOf(owner) || undefined, convoCharInfo: info, finalMessages: [{ role: lastRole }], personaName: w.persona,
        userMessage: said ? 'said' : '', userStatus: p.user?.status || 'active', userActivity: p.user?.activity || '',
        autonomousIntentKey: isMessageIntent(intentKey) ? intentKey : undefined, primaryCharacterId: liveKey(owner), wrapFormat: 'none',
    });
}

// 스케줄 만들기 (마리나라의 지시문 그대로). ask(messages, { temperature, maxTokens }) → 모델의 답 글
//   day를 주면 그날만 다시 만들어요. mode: 'rewrite' | 'adjust' | 'vary' | 'repair'  → 넣은 스케줄
export async function makeSchedule(m, owner, { ask, name = owner, description = '', personality = '', guidance = '', mode = 'rewrite', tz = '', day = '', now = new Date() } = {}) {
    const provider = { chatComplete: async (messages, o) => ({ content: await ask(messages, o) }) }, had = scheduleOf(m, owner);
    const opts = { draftMode: mode, timeZone: tz || undefined };
    if (day) {
        if (!had) throw new Error('먼저 한 주 스케줄을 만들어 주세요');
        if (!CONVERSATION_SCHEDULE_DAYS.includes(day)) throw new Error('요일이 맞지 않아요');
        const got = await generateCharacterDaySchedule(provider, '', name, description, personality, day, had, undefined, guidance, opts);
        return setSchedule(m, owner, { ...had, days: { ...had.days, [day]: got.blocks } }, now);
    }
    const got = await generateCharacterSchedule(provider, '', name, description, personality, guidance, undefined, opts);
    // (what the user set by hand on the old one stays: delays, the daily cap, the reasons turned off)
    const keep = had ? Object.fromEntries(['idleResponseDelayMinutes', 'dndResponseDelayMinutes', 'autonomousDailyCapOverride', 'disabledAutonomousIntents'].filter(k => had[k] !== undefined).map(k => [k, had[k]])) : {};
    return setSchedule(m, owner, { ...keep, ...got.schedule, weekStart: getMonday(now).toISOString() }, now);
}

// 지금 이 방에서 누가 먼저 말 걸 때인가 (마리나라의 판단 그대로) → 마리나라의 답 { shouldTrigger, characterIds, reason, autonomousIntent, autonomousIntentKey … }
//   cards: { 폰 열쇠: 카드 데이터 } (스케줄이 없는 사람의 수다 정도); tzOf(이름); owners: 폰이 있는 사람만 말을 걸어요
export function checkProactive(m, roomId, { now = new Date(), tzOf = () => '', cards = {}, maxFollowups, source = 'client' } = {}) {
    const w = need(m), room = w.messenger?.rooms?.[roomId], p = presenceOf(m);
    if (!room) throw new Error('없는 방이에요');
    const P = liveKey(w.persona), ids = room.members.map(liveKey).filter(k => k !== P && w.phones?.[k]), chatId = chatIdOf(m, roomId);
    if (!ids.length) return { shouldTrigger: false, characterIds: [], reason: 'none', inactivityMs: 0 };
    // (the room's talk is the truth: the tracker is read from it again each time, so a deleted or imported message counts)
    clearChatActivity(chatId); forgetAutonomousSeed(chatId);
    const first = ids[0], name = room.members.find(n => liveKey(n) === first);
    return checkAutonomous({
        chatId, meta: { ...p.meta, autonomousMessages: !!p.on }, characterIds: ids,
        schedules: Object.fromEntries(ids.filter(k => p.schedules[k]).map(k => [k, p.schedules[k]])), statusOverrides: p.overrides, cards,
        messages: () => (room.messages || []).filter(x => x.text || x.call).map(x => ({ role: liveKey(x.from) === P ? 'user' : 'assistant', characterId: liveKey(x.from) === P ? null : liveKey(x.from), createdAt: new Date(x.at || 0).toISOString() })),
        userStatus: p.user?.status === 'invisible' ? 'active' : p.user?.status, maxFollowups, source, promptTimeZone: tzOf(name) || undefined, nowInstant: now,
    });
}
// 먼저 말 걸기를 줄 세웠어요: 오늘 센 수 · 그 이유의 쉬는 시간을 적어요 (마리나라가 채팅 메타에 적는 것 그대로)
export function noteProactive(m, roomId, characterId, intentKey, now = new Date()) {
    const p = presenceOf(m);
    Object.assign(p.meta, buildAutonomousDailyBudgetPatch(p.meta, characterId, now));
    if (isMessageIntent(intentKey)) Object.assign(p.meta, buildIntentCooldownPatch(p.meta, characterId, intentKey, now));
    clearGenerationInProgress(chatIdOf(m, roomId));
}
