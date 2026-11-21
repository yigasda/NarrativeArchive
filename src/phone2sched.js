// 폰 2(실시간) 메신저의 스케줄 · 상태 · 먼저 말 걸기 · 늦은 답 (docs/PHONE2-PLAN.md "스케줄 · 먼저 말 걸기").
// 판단과 지시문은 전부 마리나라의 것이에요 (src/marinara/). 이 파일은 그것을 우리 저장 모양에 잇기만 해요.
//   w.presence = {
//     on: 먼저 말 걸기를 켰나 (마리나라의 autonomousMessages),
//     schedules: { 폰 열쇠: 마리나라의 WeekSchedule }, overrides: { 폰 열쇠: 손으로 준 상태 (ConversationStatusOverride) },
//     meta: { autonomousDailyBudget, intentCooldowns, autonomousDailyCapOverride … } (마리나라가 채팅 메타에 두는 것 그대로),
//     user: { status: 'active' | 'idle' | 'dnd' | 'invisible', manual: 내가 손으로 고른 상태, activity } (내 상태: 마리나라의 userStatus · userStatusManual.
//       손으로 고른 것이 active일 때만 10분 가만히 있으면 status가 idle로 바뀌었다가, 움직이거나 말을 보내면 active로 돌아와요)
//   }
// 마리나라의 "채팅" = 우리 방 하나 (chatId = 세계 id:방 id), "캐릭터 id" = 폰 열쇠(liveKey).
// 저장은 부르는 쪽이 해요. 폰 1 · 아카이브는 읽지도 쓰지도 않아요. 폰 1은 이 파일을 부르지 않아요.

import { liveWorld, liveKey } from './phone2store.js';
import { generateCharacterSchedule, generateCharacterDaySchedule, getEffectiveCurrentStatus, getTodaySchedule, getDirectMessageDelay, getMentionDelay, getBusyDelay, getMonday, scheduleNeedsRefresh, ScheduleDraftError } from './marinara/schedule.service.js';
import { normalizeTextForMatch } from './marinara/text-matching.js';
import { CONVERSATION_SCHEDULE_DAYS, getAdjacentScheduleBlocks, getActiveStatusOverride } from './marinara/conversation-presence.js';
import { toZonedWallClockDate, normalizePromptTimeZone, resolveConversationTimeZone } from './marinara/timezone.js';
import { scheduleDraft, scheduleSummary, scheduleGenerate } from './marinara/schedule-routes.js';
import { parseCharacterScheduleImport, createCharacterScheduleExport } from './marinara/character-schedule-transfer.js';
import { buildConversationCurrentContextBlock } from './marinara/conversation-context-block.js';
import { checkAutonomous, checkExchange, forgetAutonomousSeed } from './marinara/autonomous-check.js';
import { clearChatActivity, clearGenerationInProgress, buildAutonomousDailyBudgetPatch, getActivityState, recordUserActivity, recordAssistantActivity, recordUserReaction } from './marinara/autonomous.service.js';
import { buildIntentCooldownPatch, isMessageIntent } from './marinara/intent.service.js';
import { applyCharacterStatusCommand } from './marinara/schedule-command.js';
import { restoreAvailableAfterUserMessage } from './marinara/idle-detection.js';

export { ScheduleDraftError, CONVERSATION_SCHEDULE_DAYS };
// (Marinara's reasons say "the user": here that is the persona, by name — 소망, 2026-11-21)
const named = (text, persona) => String(text ?? '').replace(/\b([Tt])he user\b/g, String(persona || 'them'));
const obj = v => v && typeof v === 'object' && !Array.isArray(v);
const STATUSES = ['online', 'idle', 'dnd', 'offline'], USER = ['active', 'idle', 'dnd', 'invisible'];

function need(m) { const w = liveWorld(m); if (!w) throw new Error('아직 폰 2가 없어요'); return w; }

// ---- 스케줄의 주인은 캐릭터 카드예요 (마리나라처럼: 그 캐릭터가 나오는 모든 채팅에서 같은 스케줄 · 손으로 준 상태 · 매주 갱신).
// 채팅의 w.presence.schedules · overrides · autoRenew는 카드에서 읽어 온 사본이에요(마리나라의 "the chat's schedule map is only a cache").
// 카드가 없는 사람(실리에 캐릭터로 없는 사람)은 채팅의 것만 써요.
//   cards: { get(이름) → { conversationSchedule, conversationStatusOverride, conversationScheduleAutoRenew } | null (카드 없음), set(이름, patch) → Promise }
//   zones: { get() → 시간대 | '', set(시간대 | '') } 스케줄의 시간대 (마리나라처럼 모든 채팅에 하나)
let cards = null, zones = null, writes = [];
export const setCardStore = s => { cards = s && typeof s.get === 'function' ? s : null; };
export const setZoneStore = s => { zones = s && typeof s.get === 'function' ? s : null; };
// 카드에 쓰는 일이 다 끝났을 때 (저장하기 전에 기다려요)
export async function flushCards() { const w = writes; writes = []; await Promise.all(w); }
function toCard(owner, patch) {
    if (!cards || !cards.get(owner)) return;
    try { writes.push(Promise.resolve(cards.set(owner, patch)).catch(err => console.warn('[narrative-archive] card schedule', err))); } catch (err) { console.warn('[narrative-archive] card schedule', err); }
}
// 카드의 것을 채팅의 사본으로 (마리나라의 resolveConversationPresenceState). 카드에 아직 없고 채팅에만 있던 예전 것은 카드로 올려요
function resolveCards(m) {
    const w = liveWorld(m);
    if (!cards || !w) return;
    for (const ph of Object.values(w.phones || {})) {
        const ext = ph?.owner ? cards.get(ph.owner) : null;
        if (!ext) continue;
        const k = liveKey(ph.owner), has = key => Object.hasOwn(ext, key);
        const p = obj(w.presence) ? w.presence : null, any = has('conversationSchedule') || has('conversationStatusOverride') || has('conversationScheduleAutoRenew');
        if (!p && !any) continue;
        const q = p || (w.presence = {});
        q.schedules = obj(q.schedules) ? q.schedules : {}; q.overrides = obj(q.overrides) ? q.overrides : {}; q.autoRenew = obj(q.autoRenew) ? q.autoRenew : {};
        if (obj(ext.conversationSchedule)) q.schedules[k] = ext.conversationSchedule;
        else if (has('conversationSchedule')) delete q.schedules[k];
        else if (q.schedules[k]) toCard(ph.owner, { conversationSchedule: q.schedules[k] });
        if (obj(ext.conversationStatusOverride)) q.overrides[k] = ext.conversationStatusOverride;
        else if (has('conversationStatusOverride')) delete q.overrides[k];
        else if (q.overrides[k]) toCard(ph.owner, { conversationStatusOverride: q.overrides[k] });
        if (ext.conversationScheduleAutoRenew === true) q.autoRenew[k] = true;
        else if (has('conversationScheduleAutoRenew')) delete q.autoRenew[k];
        else if (q.autoRenew[k]) toCard(ph.owner, { conversationScheduleAutoRenew: true });
    }
}
export function presenceOf(m) {
    resolveCards(m);
    const w = need(m), p = (w.presence = obj(w.presence) ? w.presence : {});
    p.schedules = obj(p.schedules) ? p.schedules : {}; p.overrides = obj(p.overrides) ? p.overrides : {};
    p.meta = obj(p.meta) ? p.meta : {}; p.user = obj(p.user) ? p.user : {};
    return p;
}
const peek = m => { resolveCards(m); const p = liveWorld(m)?.presence; return obj(p) ? p : {}; };
export const scheduleOf = (m, owner) => peek(m).schedules?.[liveKey(owner)] || null;
// 스케줄을 쓰는가 (마리나라의 conversationSchedulesEnabled: 정한 적이 없으면 스케줄이 하나라도 있을 때 켜진 것)
export const schedulesOn = m => { const p = peek(m); return typeof p.meta?.conversationSchedulesEnabled === 'boolean' ? p.meta.conversationSchedulesEnabled : Object.keys(p.schedules || {}).length > 0; };
export const setSchedulesOn = (m, on) => (presenceOf(m).meta.conversationSchedulesEnabled = !!on);
// 지금 쓰이는 스케줄 (꺼져 있으면 없음: 스케줄은 그대로 남아 있고 상태 · 늦음 · 먼저 말 걸기가 안 읽어요)
export const activeSchedule = (m, owner) => (schedulesOn(m) ? scheduleOf(m, owner) : null);
export const chatIdOf = (m, roomId) => `${liveWorld(m)?.id}:${roomId}`;

// 스케줄 넣기 (모델이 만든 것 · 손으로 고친 것): 마리나라의 WeekSchedule 모양. null이면 지워요
export function setSchedule(m, owner, schedule, now = new Date()) {
    const p = presenceOf(m), k = liveKey(owner);
    if (!schedule) { delete p.schedules[k]; toCard(owner, { conversationSchedule: null }); return null; }
    if (!obj(schedule.days)) throw new Error('스케줄에 요일이 없어요');
    // (a block typed as ending 24:00: Marinara's clock reads 00:00-23:59, so it is kept as 00:00)
    for (const d of Object.values(schedule.days)) for (const b of Array.isArray(d) ? d : []) if (typeof b?.time === 'string' && b.time.endsWith('-24:00')) b.time = `${b.time.slice(0, -5)}00:00`;
    p.schedules[k] = { ...schedule, weekStart: schedule.weekStart || getMonday(now).toISOString() };
    toCard(owner, { conversationSchedule: p.schedules[k] });
    return p.schedules[k];
}
// 손으로 상태 주기 (minutes 뒤에 풀려요; 0 · 없음이면 풀 때까지). status가 없으면 풀어요
export function setStatusOverride(m, owner, { status, activity = '', minutes = 0 } = {}, now = new Date()) {
    const p = presenceOf(m), k = liveKey(owner);
    if (!status) { delete p.overrides[k]; toCard(owner, { conversationStatusOverride: null }); return null; }
    if (!STATUSES.includes(status)) throw new Error('상태는 online · idle · dnd · offline 가운데 하나예요');
    p.overrides[k] = { status, activity: String(activity || '').trim().slice(0, 120) || null, createdAt: now.toISOString(), ...(minutes > 0 ? { expiresAt: new Date(now.getTime() + minutes * 60_000).toISOString() } : {}) };
    toCard(owner, { conversationStatusOverride: p.overrides[k] });
    return p.overrides[k];
}
// 내 상태 · 먼저 말 걸기 켜기
export function setUserStatus(m, { status = 'active', activity = '' } = {}) {
    if (!USER.includes(status)) throw new Error('내 상태는 active · idle · dnd · invisible 가운데 하나예요');
    return (presenceOf(m).user = { status, manual: status, activity: String(activity || '').replace(/\s+/g, ' ').trim().slice(0, 120) });
}
// 내 상태를 마리나라의 UI 저장소 모양으로 (idle-detection.js가 읽고 써요): 저절로 바뀌는 것은 status만, 손으로 고른 것(manual)은 그대로
export function userStore(m) {
    return { getState: () => { const u = peek(m).user || {}; return { userStatus: u.status || 'active', userStatusManual: u.manual || u.status || 'active', setUserStatus: s => { if (liveWorld(m) && USER.includes(s)) presenceOf(m).user = { ...presenceOf(m).user, status: s, manual: u.manual || u.status || 'active' }; } }; } };
}
export const setAutonomous = (m, on) => (presenceOf(m).on = !!on);

// 지금 상태 → { status, activity, override? } (스케줄도 손으로 준 상태도 없으면 null). tz: 그 사람의 시간대
export function statusNow(m, owner, { now = new Date(), tz = '' } = {}) {
    const p = peek(m), k = liveKey(owner), schedule = activeSchedule(m, owner), override = p.overrides?.[k] || null;
    if (!schedule && !override) return null;
    return getEffectiveCurrentStatus(schedule, override, now, 'free time', toZonedWallClockDate(now, tz || undefined));
}
// 답장이 늦어지는 시간(ms), 마리나라의 계산 그대로: 0 바로 · null 오프라인(지금은 답 안 함). 스케줄도 상태도 없는 사람은 0
//   kind: 'direct' 내가 보낸 말에 답 (getDirectMessageDelay) · 'mention' 내가 @으로 부름 (getMentionDelay) · 'auto' 먼저 말 걸기 (getBusyDelay)
export function replyDelay(m, owner, { kind = 'direct', ...opts } = {}) {
    const st = statusNow(m, owner, opts);
    if (!st) return 0;
    if (st.status === 'offline') return null;
    const schedule = activeSchedule(m, owner) || undefined;
    return kind === 'mention' ? getMentionDelay(st.status) : kind === 'auto' ? getBusyDelay(st.status, schedule) : getDirectMessageDelay(st.status, schedule);
}
// 내가 마지막에 보낸 말에서 @으로 부른 방의 사람들 (마리나라의 mentionedCharacterNames) → [이름]
export function mentionsIn(m, roomId) {
    const w = liveWorld(m), room = w?.messenger?.rooms?.[roomId];
    if (!w || !room) return [];
    const P = liveKey(w.persona), last = [...(room.messages || [])].reverse().find(x => liveKey(x.from) === P && x.text), text = normalizeTextForMatch(last?.text || '');
    return text.includes('@') ? room.members.filter(n => liveKey(n) !== P && text.includes(`@${normalizeTextForMatch(n)}`)) : [];
}

// 답장 요청에 넣는 마리나라의 상황 글 (상태 · 내 상태 · 오늘 스케줄 · 지금 시각). 마리나라처럼 항상 넣어요: 스케줄이 없는 사람은 "online"
// tzOf(이름) → 그 사람의 시간대; lastRole: 방의 마지막 말이 'user'(나) | 'assistant'; said: 내가 새로 한 말이 있나
export function contextBlock(m, owner, roomId, { now = new Date(), tzOf = () => '', lastRole = 'user', said = true, intentKey = '', mentions = [] } = {}) {
    const w = liveWorld(m), room = w?.messenger?.rooms?.[roomId], p = peek(m);
    if (!w || !room) return '';
    const info = room.members.filter(n => liveKey(n) !== liveKey(w.persona)).map(n => {
        // (no schedule and no status set by hand: "online", as Marinara's resolveConversationPromptCharacters gives)
        const st = statusNow(m, n, { now, tz: tzOf(n) }) || { status: 'online', activity: '' }, schedule = activeSchedule(m, n);
        return { charId: liveKey(n), name: n, status: st.status, activity: st.activity, todaySchedule: schedule ? getTodaySchedule(schedule, toZonedWallClockDate(now, tzOf(n) || undefined)) : '' };
    });
    if (!info.some(c => c.charId === liveKey(owner))) return '';
    return named(buildConversationCurrentContextBlock({
        nowInstant: now, promptTimeZone: tzOf(owner) || undefined, convoCharInfo: info, finalMessages: [{ role: lastRole }], personaName: w.persona,
        userMessage: said ? 'said' : '', userStatus: p.user?.status || 'active', userActivity: p.user?.activity || '',
        mentionedCharacterNames: mentions,
        autonomousIntentKey: isMessageIntent(intentKey) ? intentKey : undefined, primaryCharacterId: liveKey(owner), wrapFormat: 'none',
    }), w.persona);
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
    syncUser(m, roomId);
    const first = ids[0], name = room.members.find(n => liveKey(n) === first);
    const out = checkAutonomous({
        chatId, meta: { ...p.meta, autonomousMessages: !!p.on }, characterIds: ids,
        schedules: schedulesOn(m) ? Object.fromEntries(ids.filter(k => p.schedules[k]).map(k => [k, p.schedules[k]])) : {}, statusOverrides: p.overrides, cards,
        messages: () => (room.messages || []).filter(x => x.text || x.call).map(x => ({ role: liveKey(x.from) === P ? 'user' : 'assistant', characterId: liveKey(x.from) === P ? null : liveKey(x.from), createdAt: new Date(x.at || 0).toISOString() })),
        userStatus: p.user?.status === 'invisible' ? 'active' : p.user?.status, maxFollowups, source, promptTimeZone: tzOf(name) || undefined, nowInstant: now,
    });
    return out.autonomousIntent ? { ...out, autonomousIntent: named(out.autonomousIntent, w.persona), autonomousIntentPrompt: named(out.autonomousIntentPrompt, w.persona) } : out;
}
// 먼저 말 걸기를 줄 세웠어요: 오늘 센 수 · 그 이유의 쉬는 시간을 적어요 (마리나라가 채팅 메타에 적는 것 그대로)
export function noteProactive(m, roomId, characterId, intentKey, now = new Date()) {
    const p = presenceOf(m);
    Object.assign(p.meta, buildAutonomousDailyBudgetPatch(p.meta, characterId, now));
    if (isMessageIntent(intentKey)) Object.assign(p.meta, buildIntentCooldownPatch(p.meta, characterId, intentKey, now));
    clearGenerationInProgress(chatIdOf(m, roomId));
}

// ---- 장소 (마리나라의 스케줄에는 하는 일만 있어요: 어디서인지는 우리가 블록의 place 칸에 따로 둬요. 화면의 스케줄에는 안 나와요)
const one = v => String(v ?? '').replace(/\s+/g, ' ').trim();
// 장소를 묻는 지시문 (우리 것: docs/PROMPT-RULES.md의 형식)
export function placeSystem({ owner = 'the owner' } = {}) {
    const O = owner;
    return `GOAL
${O} has a weekly schedule. For each thing on it, say where ${O} is while doing it.

YOU GET
- ACTIVITIES: every different thing on the schedule, one a line.
- ${O}'s card.
- PLACES (sometimes): places already on ${O}'s phone.

PLACES
- One short place for each line of ACTIVITIES: a name the phone would show ("home", "St. Mary's Hospital", "the gym on 5th").
- A place from PLACES or the card when it fits, in the same words. Else the plainest true one.
- The same place in the same words every time.
- "" when the activity can be anywhere.

JSON (one object, nothing before or after it)
{ "places": { "an activity as written": "where" } }`;
}
const activities = schedule => [...new Set(Object.values(schedule?.days || {}).flatMap(d => (Array.isArray(d) ? d : []).map(b => one(b?.activity))).filter(Boolean))];
export function placeInput(schedule, { owner = '', card = '', places = [] } = {}) {
    const known = [...new Set((Array.isArray(places) ? places : []).map(one).filter(Boolean))];
    return [`[ACTIVITIES]\n${activities(schedule).map(a => `- ${a}`).join('\n')}`, String(card || '').trim() ? `[${one(owner)}'s card]\n${String(card).trim()}` : '', known.length ? `[PLACES]\n${known.map(x => `- ${x}`).join('\n')}` : ''].filter(Boolean).join('\n\n');
}
// 답을 블록에 넣어요: 하는 일이 같은 블록은 같은 장소. 답에 없는 일 · ""는 장소 없이 둬요 → 장소가 생긴 블록 수
export function takePlaces(schedule, answer) {
    const got = obj(answer?.places) ? answer.places : null;
    if (!got) throw new Error('장소 답을 읽을 수 없어요');
    const by = new Map(Object.entries(got).map(([k, v]) => [one(k).toLowerCase(), one(v).slice(0, 80)]));
    let n = 0;
    for (const d of Object.values(schedule.days || {})) for (const b of Array.isArray(d) ? d : []) {
        const place = by.get(one(b?.activity).toLowerCase());
        if (place) { b.place = place; n++; } else delete b.place;
    }
    return n;
}
// 스케줄의 블록마다 장소 채우기 (모델을 한 번 불러요). ask(messages) → 답 글; parse(글) → 객체
export async function fillPlaces(m, owner, { ask, parse = JSON.parse, card = '', places = [] } = {}) {
    const schedule = scheduleOf(m, owner);
    if (!schedule) throw new Error('먼저 스케줄을 만들어 주세요');
    if (!activities(schedule).length) return 0;
    const text = await ask([{ role: 'system', content: placeSystem({ owner }) }, { role: 'user', content: placeInput(schedule, { owner, card, places }) }]);
    return takePlaces(schedule, parse(text));
}
// 지금 스케줄 블록 → { key (요일 · 시간: 블록이 바뀌면 달라져요), block, text ("장소 · 하는 일 · ~끝나는 시각") } | null
// (손으로 준 상태가 살아 있는 동안은 null: 스케줄을 따르는 중이 아니에요)
export function blockNow(m, owner, { now = new Date(), tz = '' } = {}) {
    const p = peek(m), k = liveKey(owner), schedule = activeSchedule(m, owner);
    if (!schedule || getActiveStatusOverride(p.overrides?.[k], now)) return null;
    const wall = toZonedWallClockDate(now, tz || undefined), block = getAdjacentScheduleBlocks(schedule, wall).current;
    if (!block) return null;
    const end = one(block.time).split('-')[1] || '';
    return { key: `${wall.getDay()} ${block.time}`, block, text: [one(block.place), one(block.activity), end ? `~${end}` : ''].filter(Boolean).join(' · ') };
}

// 지금 그 사람의 상태 글과 장소: 살아 있는 임시 상태(손으로 준 것 · 캐릭터가 스스로 바꾼 것)가 있으면 그것, 없으면 지금 스케줄 블록
//   → { key (바뀌면 달라져요), text ("장소 · 하는 일 …"), place } | null
export function stateNow(m, owner, { now = new Date(), tz = '' } = {}) {
    const p = peek(m), k = liveKey(owner), o = getActiveStatusOverride(p.overrides?.[k], now);
    if (o) return { key: `o ${o.createdAt}`, text: [one(o.place), one(o.activity) || o.status].filter(Boolean).join(' · '), place: one(o.place) };
    const at = blockNow(m, owner, { now, tz });
    return at ? { key: at.key, text: at.text, place: one(at.block.place) } : null;
}
// 캐릭터가 답장에서 스스로 상태를 바꿨어요 (마리나라의 schedule_update 명령: 임시 상태로 두고, 시간이 지나면 스케줄로 돌아가요)
//   cmd: { status, activity, duration ("1h"), place (우리 칸: 어디서) } → 새 임시 상태 | null (안 바뀜: 손으로 준 상태가 있거나 빈 명령)
export function takeStatus(m, owner, cmd, { now = new Date(), tz = '' } = {}) {
    if (!obj(cmd)) return null;
    const p = presenceOf(m), k = liveKey(owner), status = STATUSES.includes(String(cmd.status || '').toLowerCase()) ? String(cmd.status).toLowerCase() : undefined;
    const got = applyCharacterStatusCommand({ command: { type: 'schedule_update', status, activity: one(cmd.activity).slice(0, 120) || undefined, duration: one(cmd.duration) || undefined }, current: p.overrides[k], schedule: activeSchedule(m, owner) || undefined, now, scheduleNow: toZonedWallClockDate(now, tz || undefined) });
    if (!got) return null;
    const place = one(cmd.place).slice(0, 80);
    p.overrides[k] = { ...got, ...(place ? { place } : {}) };
    toCard(owner, { conversationStatusOverride: p.overrides[k] });
    return p.overrides[k];
}

// ---- 마리나라의 스케줄 요청들 (src/marinara/schedule-routes.js)을 우리 데이터로 부르기
// 시간대: 마리나라처럼 스케줄 전체에 하나(meta.conversationTimeZone). 안 정했으면 '' (부르는 쪽이 그 사람 폰의 시간대를 써요)
export const scheduleZone = m => normalizePromptTimeZone(zones?.get()) || resolveConversationTimeZone(peek(m).meta || {}) || '';
export function setScheduleZone(m, tz) {
    const p = presenceOf(m);
    if (!tz) { delete p.meta.conversationTimeZone; zones?.set(''); return ''; }
    const z = normalizePromptTimeZone(tz);
    if (!z) throw new Error('시간대가 맞지 않아요');
    // (Marinara's rememberConversationTimeZone: one zone for every conversation)
    zones?.set(z);
    return (p.meta.conversationTimeZone = z);
}
// (the model is asked through ask(messages, opts); a stop asked for while it answers drops the answer)
const providerOf = ask => ({ chatComplete: async (messages, o) => { const content = await ask(messages, o); o?.signal?.throwIfAborted(); return { content }; } });
// 초안 만들기 (POST /schedule/draft 그대로: 저장하지 않아요). args: { mode: 'week' | 'day', day, schedule (지금 초안), guidance, dayGuidance,
//   draftMode, timeZone, signal } → { schedule } | { day, blocks, weekStart }. 실패하면 오류에 rawResponse(모델의 답 원문)가 실려요
export const draftSchedule = (m, { ask, charData, ...args }) => scheduleDraft({ ...args, provider: providerOf(ask), charData, meta: peek(m).meta || {} });
// 루틴 요약 (POST /schedule/summary 그대로) → { summary, generatedAt }
export const summarizeSchedule = (m, { ask, charData, ...args }) => scheduleSummary({ ...args, provider: providerOf(ask), charData });
// 실패한 답을 손으로 고쳐서 넣기 (마리나라 편집 창의 applyRepairedOutput 그대로): text는 JSON 글, day를 주면 그날의 { blocks } → 고쳐진 초안
export function repairSchedule(text, current, day = '') {
    const parsed = JSON.parse(text);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error();
    const value = parsed;
    if (day && !Array.isArray(value.blocks)) throw new Error();
    const candidate = { ...current, days: day ? { ...current.days, [day]: value.blocks } : { ...current.days, ...value.days } };
    if (!day && (!value.days || typeof value.days !== 'object' || Array.isArray(value.days))) throw new Error();
    const result = parseCharacterScheduleImport(candidate, current.weekStart);
    if (!result.ok) throw new Error();
    return { ...current, days: result.schedule.days };
}
// 매주 갱신 (마리나라의 conversationScheduleAutoRenew): 사람마다 켜고 꺼요
export function setAutoRenew(m, owner, on) { const p = presenceOf(m), k = liveKey(owner); p.autoRenew = obj(p.autoRenew) ? p.autoRenew : {}; if (on) p.autoRenew[k] = true; else delete p.autoRenew[k]; toCard(owner, { conversationScheduleAutoRenew: !!on }); return !!on; }
export const autoRenewOf = (m, owner) => peek(m).autoRenew?.[liveKey(owner)] === true;
// 이번 주 것이 아닌 스케줄인가 (마리나라의 scheduleNeedsRefresh)
export const needsRefresh = (m, owner, { now = new Date(), tz = '' } = {}) => { const s = scheduleOf(m, owner); return !!s && scheduleNeedsRefresh(s, toZonedWallClockDate(now, tz || undefined)); };
// 스케줄 만들기 · 갱신 (POST /schedule/generate 그대로): 지난 스케줄을 이어받아 새 주 것을 만들어 넣어요
//   owners: 이름들; cards: { 폰 열쇠: { name, description, personality } }; automatic: 매주 갱신을 켠 사람만; forceRefresh: 이번 주 것이어도
//   → { results: { 폰 열쇠: { status, schedule? } } }
export async function renewSchedules(m, { ask, owners = [], cards = {}, automatic = false, forceRefresh = false, guidance = '', timeZone, signal, now = new Date() } = {}) {
    const p = presenceOf(m), ids = owners.map(liveKey);
    const out = await scheduleGenerate({
        meta: p.meta, characterIds: ids, existingSchedules: p.schedules, forceRefresh, automatic, scheduleGenerationPreferences: guidance, timeZone, provider: providerOf(ask), signal, nowInstant: now,
        cards: Object.fromEntries(ids.map(k => [k, cards[k] ? { ...cards[k], extensions: { ...(cards[k].extensions || {}), conversationScheduleAutoRenew: p.autoRenew?.[k] === true } } : null]).filter(([, v]) => v)),
    });
    for (const [k, r] of Object.entries(out.results)) if (r.status === 'generated' && r.schedule) { p.schedules[k] = r.schedule; const name = owners.find(n => liveKey(n) === k); if (name) toCard(name, { conversationSchedule: r.schedule }); }
    return out;
}

// ---- 먼저 말 걸기의 방 전체 설정 (마리나라가 채팅 메타에 두는 열쇠 그대로, 준 것만 바꿔요)
//   { autonomousDailyCapOverride: 하루 상한 (1 이상의 수 · null 풀기), groupChatMode: 'individual' (단체방에서 하루 상한을 같이 써요) · null,
//     characterExchanges: 캐릭터끼리 주고받기 (true · false) }
export function setAutonomousOptions(m, o = {}) {
    const meta = presenceOf(m).meta;
    if (Object.hasOwn(o, 'autonomousDailyCapOverride')) {
        const v = o.autonomousDailyCapOverride;
        if (v === null || v === '' || v === undefined) delete meta.autonomousDailyCapOverride;
        else if (typeof v === 'number' && Number.isFinite(v) && v >= 1) meta.autonomousDailyCapOverride = Math.floor(v);
        else throw new Error('하루 상한은 1 이상의 수예요');
    }
    if (Object.hasOwn(o, 'groupChatMode')) { if (o.groupChatMode) meta.groupChatMode = String(o.groupChatMode); else delete meta.groupChatMode; }
    if (Object.hasOwn(o, 'characterExchanges')) { if (o.characterExchanges) meta.characterExchanges = true; else delete meta.characterExchanges; }
    return autonomousOptions(m);
}
export const autonomousOptions = m => { const meta = peek(m).meta || {}; return { on: !!peek(m).on, schedulesEnabled: schedulesOn(m), autonomousDailyCapOverride: meta.autonomousDailyCapOverride ?? null, groupChatMode: meta.groupChatMode || null, characterExchanges: !!meta.characterExchanges }; };
// 단체방에서 한 캐릭터가 말한 뒤, 다른 캐릭터가 거기에 답할 때인가 (마리나라의 /autonomous/exchange 그대로) → 마리나라의 답
export function checkExchangeFor(m, roomId, lastSpeaker, { now = new Date(), tzOf = () => '', cards = {} } = {}) {
    const w = need(m), room = w.messenger?.rooms?.[roomId], p = presenceOf(m);
    if (!room) throw new Error('없는 방이에요');
    const P = liveKey(w.persona), ids = room.members.map(liveKey).filter(k => k !== P && w.phones?.[k]), chatId = chatIdOf(m, roomId);
    syncUser(m, roomId);
    const name = room.members.find(n => liveKey(n) === liveKey(lastSpeaker));
    return checkExchange({
        chatId, meta: p.meta, characterIds: ids, lastSpeakerCharId: liveKey(lastSpeaker),
        schedules: schedulesOn(m) ? Object.fromEntries(ids.filter(k => p.schedules[k]).map(k => [k, p.schedules[k]])) : {}, statusOverrides: p.overrides, cards,
        messages: () => (room.messages || []).filter(x => x.text || x.call).map(x => ({ role: liveKey(x.from) === P ? 'user' : 'assistant', characterId: liveKey(x.from) === P ? null : liveKey(x.from), createdAt: new Date(x.at || 0).toISOString() })),
        promptTimeZone: tzOf(name) || undefined, nowInstant: now,
    });
}

// 스케줄 내보내기 · 가져오기 (마리나라의 character-schedule-transfer 그대로)
//   내보내기 → 파일에 쓸 객체; 가져오기(값) → { ok: true, schedule, format } | { ok: false, reason: 'invalid' | 'unsupported-version' }
export const exportSchedule = (m, owner) => { const s = scheduleOf(m, owner); if (!s) throw new Error('스케줄이 없어요'); return createCharacterScheduleExport(s, String(owner || '')); };
export const importSchedule = value => parseCharacterScheduleImport(value);

// ---- 마리나라가 기억해 두는 방의 움직임 (autonomous.service.js의 activityStates: 페이지가 떠 있는 동안만, 마리나라 서버처럼)
// 내가 마지막으로 말한 때 · 캐릭터가 먼저 건 수(몇 번째 따라 묻기인지) · 내가 이모지만 단 때. 마리나라가 적는 때에 똑같이 적어요.
// 내가 방에 새로 말했으면 따라잡아요 (마리나라는 내 말을 저장할 때 recordUserActivity를 불러요): 판단하기 전마다 불러요
export function syncUser(m, roomId) {
    const w = liveWorld(m), room = w?.messenger?.rooms?.[roomId];
    if (!w || !room) return false;
    const P = liveKey(w.persona), last = [...(room.messages || [])].reverse().find(x => liveKey(x.from) === P && (x.text || x.call)), st = getActivityState(chatIdOf(m, roomId));
    // (no state yet: the first check reads the room's messages, as Marinara does after a restart)
    if (!st || !last || !(Number(last.at) > st.lastUserMessageAt)) return false;
    // (I sent a message while shown as idle: back to active, as Marinara's recordUserMessageActivity does)
    restoreAvailableAfterUserMessage(userStore(m));
    recordUserActivity(chatIdOf(m, roomId), { occurredAt: Number(last.at) });
    return true;
}
// 캐릭터의 말이 들어왔어요 (마리나라: 다시 받은 답이 아닐 때. owner는 먼저 건 말일 때만 줘요: 따라 묻기 수가 올라가요)
export const noteAssistant = (m, roomId, owner = '', at = Date.now()) => recordAssistantActivity(chatIdOf(m, roomId), owner ? liveKey(owner) : undefined, at);
// 내가 이모지를 달았어요 (마리나라: 말 없이 반응만 하면 첫 번째 먼저 걸기가 조금 빨라져요)
export const noteReaction = (m, roomId) => recordUserReaction(chatIdOf(m, roomId));
// 방이 없어졌거나 방의 말을 손으로 크게 바꿨어요 (지우기 · 가져오기 · 되살리기): 기억을 지우고 다음 판단 때 방에서 다시 읽어요
export function forgetActivity(m, roomId) { const id = chatIdOf(m, roomId); clearChatActivity(id); forgetAutonomousSeed(id); }
