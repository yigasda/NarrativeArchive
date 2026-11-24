// 폰 2(실시간) 메신저의 스케줄 · 상태 · 먼저 말 걸기 · 늦은 답 (docs/PHONE2-PLAN.md "스케줄 · 먼저 말 걸기").
// 판단과 지시문은 전부 마리나라의 것이에요 (src/marinara/). 이 파일은 그것을 우리 저장 모양에 잇기만 해요.
//   room.meta = 마리나라의 chat.metadata (방 하나 = 마리나라의 채팅 하나, 2026-11-24 소망: 채팅 설정은 방마다):
//     { autonomousMessages (먼저 말 걸기), autonomousDailyCapOverride, groupChatMode, groupResponseOrder, groupTurnPromptEnabled,
//       characterExchanges, conversationSchedulesEnabled, characterCommands, conversationCommandToggles,
//       imageCaptioningEnabled · ConnectionId · Prompt, 번역 열쇠 12개 (phone2translate.js), autonomousDailyBudget · intentCooldowns (돌면서 생기는 값) }
//     열쇠 이름은 마리나라의 것 그대로. 하루 수 · 쉬는 시간도 방마다예요 (마리나라처럼: 방 둘에 있는 사람은 하루에 두 배까지 말을 걸 수 있어요)
//   w.presence = {
//     schedules: { 폰 열쇠: 마리나라의 WeekSchedule }, overrides: { 폰 열쇠: 손으로 준 상태 (ConversationStatusOverride) },
//     meta: { conversationTimeZone } (마리나라도 모든 채팅에 하나: rememberConversationTimeZone),
//     user: { status: 'active' | 'idle' | 'dnd' | 'invisible', manual: 내가 손으로 고른 상태, activity } (내 상태: 마리나라의 userStatus · userStatusManual.
//       손으로 고른 것이 active일 때만 10분 가만히 있으면 status가 idle로 바뀌었다가, 움직이거나 말을 보내면 active로 돌아와요)
//   }
//   옛 저장 (2026-11-24 전): Orbit에 하나였던 w.presence.on · meta의 채팅 열쇠 · meta.reasoningEffort("Orbit 전체")를 moveRoomMeta가 모든 방
//   (지운 방까지)에 한 번 복사하고 세계에 표시(ROOM_META_MARK)를 남겨요. 표시가 있으면 새 코드는 Orbit의 옛 값을 안 읽어요(옛 탭이 다시 써도).
//   Orbit의 옛 값은 지우지 않아요: 아직 새로 고치지 않은 탭 · 옛 일꾼은 그 값을 읽어서, 옮길 때의 설정 그대로 돌아요. 새 세계는 표시를 갖고 태어나요
//   방 밖에서 쓰는 것 (연락처 · 프로필의 상태, 폰이 스케줄을 따라가기, 답장 NOW의 폰 상태, 매주 갱신): 그 사람이 있는 방 가운데 하나라도
//   스케줄을 켰으면 스케줄을 따라요 (소망 (가), followsSchedule). 방이 하나도 없는 사람은 방의 기본값처럼 스케줄이 있으면 따라요.
// 마리나라의 "채팅" = 우리 방 하나 (chatId = 세계 id:방 id), "캐릭터 id" = 폰 열쇠(liveKey).
// 저장은 부르는 쪽이 해요. 폰 1 · 아카이브는 읽지도 쓰지도 않아요. 폰 1은 이 파일을 부르지 않아요.

import { liveWorld, liveKey, setWorldPrep, setRoomSeed, ROOM_META_MARK } from './phone2store.js';
import { repliedTo } from './phone2room.js';
import { TRANSLATOR_SETTINGS_KEYS } from './marinara/translator-defaults.js';
import { generateCharacterSchedule, generateCharacterDaySchedule, getEffectiveCurrentStatus, getTodaySchedule, getDirectMessageDelay, getMentionDelay, getBusyDelay, getMonday, scheduleNeedsRefresh, ScheduleDraftError } from './marinara/schedule.service.js';
import { normalizeTextForMatch } from './marinara/text-matching.js';
import { CONVERSATION_SCHEDULE_DAYS, getAdjacentScheduleBlocks, getActiveStatusOverride } from './marinara/conversation-presence.js';
import { toZonedWallClockDate, normalizePromptTimeZone, resolveConversationTimeZone } from './marinara/timezone.js';
import { scheduleDraft, scheduleSummary, scheduleGenerate } from './marinara/schedule-routes.js';
import { parseCharacterScheduleImport, createCharacterScheduleExport } from './marinara/character-schedule-transfer.js';
import { buildConversationCurrentContextBlock } from './marinara/conversation-context-block.js';
import { checkAutonomous, checkExchange, forgetAutonomousSeed } from './marinara/autonomous-check.js';
import { initializeActivityFromMessages, recordAutonomousClientPresence, markGenerationInProgress, clearChatActivity, clearGenerationInProgress, buildAutonomousDailyBudgetPatch, sharesAutonomousDailyBudget, isAutonomousDailyBudgetExhausted, getAutonomousDailyBudget, dailyCapForCharacter, getActivityState, recordUserActivity, recordAssistantActivity, recordUserReaction } from './marinara/autonomous.service.js';
import { buildIntentCooldownPatch, isMessageIntent, getIntentHint } from './marinara/intent.service.js';
import { applyCharacterStatusCommand, applyRoomScheduleCommand } from './marinara/schedule-command.js';
import { restoreAvailableAfterUserMessage } from './marinara/idle-detection.js';
import { isMessageHiddenFromAI } from './marinara/message-hidden.js';
import { formatSmartGroupCandidates, parseSmartGroupSelectionIds, selectFallbackSmartGroupResponder, buildSmartGroupRecentTranscript, buildSmartGroupSelectionPrompt, getExplicitlyMentionedCharacterIds, resolveRespondingCharacterIds, routeMentionsAfterReply, orderConversationRespondersByDelay, normalizeGroupChatMode, SMART_GROUP_SELECTOR_DEFAULTS, GROUP_MENTION_INVITE_LINE } from './marinara/group-responders.js';

export { ScheduleDraftError, CONVERSATION_SCHEDULE_DAYS };
// (Marinara's reasons say "the user": here that is the persona, by name — 소망, 2026-11-21)
const named = (text, persona) => String(text ?? '').replace(/\b([Tt])he user\b/g, String(persona || 'them'));
const obj = v => v && typeof v === 'object' && !Array.isArray(v);
const STATUSES = ['online', 'idle', 'dnd', 'offline'], USER = ['active', 'idle', 'dnd', 'invisible'];

function need(m) { const w = liveWorld(m); if (!w) throw new Error('폰 2가 없습니다.'); return w; }

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
// 그 사람 카드의 우리 칸 | null (카드 없음)
const cardExt = owner => (cards ? cards.get(owner) : null);
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
    moveRoomMeta(m);
    resolveCards(m);
    const w = need(m), p = (w.presence = obj(w.presence) ? w.presence : {});
    p.schedules = obj(p.schedules) ? p.schedules : {}; p.overrides = obj(p.overrides) ? p.overrides : {};
    p.meta = obj(p.meta) ? p.meta : {}; p.user = obj(p.user) ? p.user : {};
    return p;
}
const peek = m => { resolveCards(m); const p = liveWorld(m)?.presence; return obj(p) ? p : {}; };
export const scheduleOf = (m, owner) => peek(m).schedules?.[liveKey(owner)] || null;

// ---- 채팅 설정은 방마다 (마리나라의 채팅 하나 = 우리 방 하나: chat.metadata = room.meta)
// 방으로 옮긴 열쇠 (마리나라의 채팅 메타 이름 그대로). 앱 · 폰 전체에 남는 것: 알림 · 번역 기본값 · 시간대 · 연결 · 카드의 스케줄 · 내 상태 · 페르소나
export const ROOM_META_KEYS = ['autonomousMessages', 'autonomousDailyCapOverride', 'groupChatMode', 'groupResponseOrder', 'groupTurnPromptEnabled', 'characterExchanges', 'conversationSchedulesEnabled', 'characterCommands', 'conversationCommandToggles', 'imageCaptioningEnabled', 'imageCaptioningConnectionId', 'imageCaptioningPrompt', ...TRANSLATOR_SETTINGS_KEYS, 'autonomousDailyBudget', 'intentCooldowns'];
const copyOf = v => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)));
// 옛 저장 옮기기 (2026-11-24 전: 채팅 설정이 Orbit에 하나): Orbit의 값을 모든 방(지운 방 w.messenger.trash까지)에 복사해요.
//   Orbit의 값은 지우지 않아요 (옛 탭 · 옛 일꾼이 읽는 자리: 지우면 그쪽은 먼저 말 걸기 · 번역이 꺼지고 단체방 방식이 바뀌어요. 2026-11-24 검토).
//   w.presence.on → room.meta.autonomousMessages, w.presence.meta의 열쇠 → room.meta (방에 이미 있는 값이 이겨요),
//   meta.reasoningEffort ("Orbit 전체": 마리나라에 없어요) → 자기 값이 없는 방의 room.chatParameters.reasoningEffort,
//   meta.scheduleConnectionId → 버려요 (마리나라는 스케줄 생성 연결을 저장하지 않아요: 편집 창의 상태, 기본은 그 방의 연결).
//   한 번만 해요: 세계에 표시(ROOM_META_MARK)를 남겨요. 그 뒤로 옛 페이지가 Orbit 값을 다시 써도 새 코드는 안 읽어요.
//   브라우저와 서버 일꾼이 같은 코드로 (읽는 함수가 먼저 불러요: roomMeta · roomMetaW) → 옮긴 방의 수
export function moveRoomMeta(m) {
    const w = liveWorld(m);
    if (!w || w[ROOM_META_MARK]) return 0;
    const p = obj(w.presence) ? w.presence : null, meta = p && obj(p.meta) ? p.meta : {};
    const from = {};
    if (p && Object.hasOwn(p, 'on')) from.autonomousMessages = !!p.on;
    for (const k of ROOM_META_KEYS) if (k !== 'autonomousMessages' && Object.hasOwn(meta, k) && meta[k] !== undefined) from[k] = meta[k];
    const effort = typeof meta.reasoningEffort === 'string' ? meta.reasoningEffort : '';
    const rooms = [...Object.values(w.messenger?.rooms || {}), ...(Array.isArray(w.messenger?.trash) ? w.messenger.trash.map(t => t?.room) : [])].filter(obj);
    let n = 0;
    for (const room of rooms) {
        const had = obj(room.meta) ? room.meta : {}, next = { ...copyOf(from), ...had };
        if (Object.keys(next).length) room.meta = next;
        if (effort && !(obj(room.chatParameters) && room.chatParameters.reasoningEffort)) room.chatParameters = { ...(obj(room.chatParameters) ? room.chatParameters : {}), reasoningEffort: effort };
        n++;
    }
    w[ROOM_META_MARK] = 1;
    return n;
}
setWorldPrep(m => moveRoomMeta(m));
// 저장 조각을 합치기 전에 (phone2keep.js makeKeep의 prep): 옮기기 전의 m.live면 사본을 옮겨서 돌려줘요 (받은 것은 안 고쳐요). 옮긴 것이면 그대로
export function moveRoomMetaCopy(live) {
    const w = live && typeof live === 'object' ? live.world : null;
    if (!obj(w) || w[ROOM_META_MARK]) return live;
    const copy = JSON.parse(JSON.stringify(live));
    moveRoomMeta({ live: copy });
    return copy;
}
const roomOf = (m, roomId) => { const r = roomId ? liveWorld(m)?.messenger?.rooms?.[roomId] : null; return obj(r) ? r : null; };
// 방의 채팅 메타 (읽기: 없으면 {}) · 쓰기 (없으면 만들어요; 방이 없으면 오류)
export function roomMeta(m, roomId) { moveRoomMeta(m); const r = roomOf(m, roomId); return r && obj(r.meta) ? r.meta : {}; }
export function roomMetaW(m, roomId) {
    moveRoomMeta(m);
    const r = roomOf(m, roomId);
    if (!r) throw new Error('채팅방을 찾을 수 없습니다.');
    if (!obj(r.meta)) r.meta = {};
    return r.meta;
}
// 그 방의 캐릭터들(나 빼고) 가운데 스케줄이 있는 사람이 있나 (마리나라: 그 채팅의 characterSchedules가 비어 있지 않음)
const roomHasSchedules = (m, room) => { const P = liveKey(liveWorld(m)?.persona), s = peek(m).schedules || {}; return !!room && (room.members || []).some(n => liveKey(n) !== P && s[liveKey(n)]); };
// 새 방 (마리나라 chats.storage.ts create): 카드에 스케줄이 있는 사람이 있으면 conversationSchedulesEnabled: true. 번역 기본값은 phone2translate.js
setRoomSeed((room, w, m) => { if (roomHasSchedules(m, room)) room.meta = { ...(obj(room.meta) ? room.meta : {}), conversationSchedulesEnabled: true }; });
// 이 방에서 스케줄을 쓰는가 (마리나라의 conversationSchedulesEnabled: 정한 적이 없으면 그 방의 캐릭터에게 스케줄이 있을 때 켜진 것)
export const schedulesOn = (m, roomId) => { const meta = roomMeta(m, roomId); return typeof meta.conversationSchedulesEnabled === 'boolean' ? meta.conversationSchedulesEnabled : roomHasSchedules(m, roomOf(m, roomId)); };
export const setSchedulesOn = (m, roomId, on) => (roomMetaW(m, roomId).conversationSchedulesEnabled = !!on);
// 방 밖에서 (연락처 · 프로필의 상태, 폰이 스케줄을 따라가기, 답장의 NOW, 매주 갱신): 그 사람이 있는 방 가운데 하나라도 스케줄을 켰으면 따라요
// (소망 (가)). 방이 하나도 없으면 방의 기본값처럼: 스케줄이 있으면 따라요
export function followsSchedule(m, owner) {
    const k = liveKey(owner), rooms = Object.values(liveWorld(m)?.messenger?.rooms || {}).filter(r => obj(r) && (r.members || []).some(n => liveKey(n) === k));
    return rooms.length ? rooms.some(r => schedulesOn(m, r.id)) : !!scheduleOf(m, owner);
}
// 지금 쓰이는 스케줄 (꺼져 있으면 없음: 스케줄은 그대로 남아 있고 상태 · 늦음 · 먼저 말 걸기가 안 읽어요). roomId: 그 방의 스위치, 없으면 방 밖의 규칙
export const activeSchedule = (m, owner, roomId = '') => ((roomId ? schedulesOn(m, roomId) : followsSchedule(m, owner)) ? scheduleOf(m, owner) : null);
export const chatIdOf = (m, roomId) => `${liveWorld(m)?.id}:${roomId}`;
// 마리나라의 함수가 읽는 채팅 메타: 방의 것 + 시간대 (시간대는 모든 채팅에 하나: scheduleZone)
export const chatMetaOf = (m, roomId) => { const z = scheduleZone(m); return { ...roomMeta(m, roomId), ...(z ? { conversationTimeZone: z } : {}) }; };

// 스케줄 넣기 (모델이 만든 것 · 손으로 고친 것): 마리나라의 WeekSchedule 모양. null이면 지워요
export function setSchedule(m, owner, schedule, now = new Date()) {
    const p = presenceOf(m), k = liveKey(owner);
    if (!schedule) { delete p.schedules[k]; toCard(owner, { conversationSchedule: null }); return null; }
    if (!obj(schedule.days)) throw new Error('스케줄에 요일이 없습니다.');
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
    if (!STATUSES.includes(status)) throw new Error('상태는 online, idle, dnd, offline 중 하나여야 합니다.');
    // (expiresAt: null and place: null are written out, as Marinara's card does: SillyTavern's server merges a card's
    //  extension field key by key, so a key left out would keep the end time or place of the status before this one)
    p.overrides[k] = { status, activity: String(activity || '').trim().slice(0, 120) || null, createdAt: now.toISOString(), expiresAt: minutes > 0 ? new Date(now.getTime() + minutes * 60_000).toISOString() : null, place: null };
    toCard(owner, { conversationStatusOverride: p.overrides[k] });
    return p.overrides[k];
}
// 내 상태 · 먼저 말 걸기 켜기
export function setUserStatus(m, { status = 'active', activity = '' } = {}) {
    if (!USER.includes(status)) throw new Error('내 상태는 active, idle, dnd, invisible 중 하나여야 합니다.');
    return (presenceOf(m).user = { status, manual: status, activity: String(activity || '').replace(/\s+/g, ' ').trim().slice(0, 120) });
}
// 내 상태를 마리나라의 UI 저장소 모양으로 (idle-detection.js가 읽고 써요): 저절로 바뀌는 것은 status만, 손으로 고른 것(manual)은 그대로
export function userStore(m) {
    return { getState: () => { const u = peek(m).user || {}; return { userStatus: u.status || 'active', userStatusManual: u.manual || u.status || 'active', setUserStatus: s => { if (liveWorld(m) && USER.includes(s)) presenceOf(m).user = { ...presenceOf(m).user, status: s, manual: u.manual || u.status || 'active' }; } }; } };
}
// 먼저 말 걸기 켜기 (이 방: 마리나라의 autonomousMessages)
export const setAutonomous = (m, roomId, on) => (roomMetaW(m, roomId).autonomousMessages = !!on);

// 지금 상태 → { status, activity, override? } (스케줄도 손으로 준 상태도 없으면 null). tz: 그 사람의 시간대
//   room: 그 방에서의 상태 (그 방의 스케줄 스위치). 없으면 방 밖의 규칙 (followsSchedule)
export function statusNow(m, owner, { now = new Date(), tz = '', room = '' } = {}) {
    const p = peek(m), k = liveKey(owner), schedule = activeSchedule(m, owner, room), override = p.overrides?.[k] || null;
    if (!schedule && !override) return null;
    return getEffectiveCurrentStatus(schedule, override, now, 'free time', toZonedWallClockDate(now, tz || undefined));
}
// 답장이 늦어지는 시간(ms), 마리나라의 계산 그대로: 0 바로 · null 오프라인(지금은 답 안 함). 스케줄도 상태도 없는 사람은 0
//   kind: 'direct' 내가 보낸 말에 답 (getDirectMessageDelay) · 'mention' 내가 @으로 부름 (getMentionDelay) · 'auto' 먼저 말 걸기 (getBusyDelay)
export function replyDelay(m, owner, { kind = 'direct', ...opts } = {}) {
    const st = statusNow(m, owner, opts);
    if (!st) return 0;
    if (st.status === 'offline') return null;
    const schedule = activeSchedule(m, owner, opts.room) || undefined;
    return kind === 'mention' ? getMentionDelay(st.status) : kind === 'auto' ? getBusyDelay(st.status, schedule) : getDirectMessageDelay(st.status, schedule);
}
// 내가 마지막에 보낸 말에서 @으로 부른 방의 사람들 (마리나라의 mentionedCharacterNames) → [이름]
export function mentionsIn(m, roomId) {
    const w = liveWorld(m), room = w?.messenger?.rooms?.[roomId];
    if (!w || !room) return [];
    const P = liveKey(w.persona), last = [...(room.messages || [])].reverse().find(x => liveKey(x.from) === P && x.text), text = normalizeTextForMatch(last?.text || '');
    // (replying to a character's message addresses that character, like an @mention — Marinara)
    const replied = repliedTo(m, roomId);
    return room.members.filter(n => liveKey(n) !== P && ((replied && liveKey(n) === liveKey(replied)) || (text.includes('@') && text.includes(`@${normalizeTextForMatch(n)}`))));
}

// 답장 요청에 넣는 마리나라의 상황 글 (상태 · 내 상태 · 오늘 스케줄 · 지금 시각). 마리나라처럼 항상 넣어요: 스케줄이 없는 사람은 "online"
// tzOf(이름) → 그 사람의 시간대; lastRole: 방의 마지막 말이 'user'(나) | 'assistant'; said: 내가 새로 한 말이 있나
//   user: { status, activity } 이 요청에서만 쓸 내 상태 (서버가 실리를 닫은 동안 만드는 답장: 마리나라의 서버는 'idle' · 'away or offline'로 보내요). 없으면 폰에 적힌 내 상태
export function contextBlock(m, owner, roomId, { now = new Date(), tzOf = () => '', lastRole = 'user', said = true, intentKey = '', mentions = [], merged = false, user = null } = {}) {
    const w = liveWorld(m), room = w?.messenger?.rooms?.[roomId], p = peek(m);
    if (!w || !room) return '';
    const info = room.members.filter(n => liveKey(n) !== liveKey(w.persona)).map(n => {
        // (no schedule and no status set by hand: "online", as Marinara's resolveConversationPromptCharacters gives)
        const st = statusNow(m, n, { now, tz: tzOf(n), room: roomId }) || { status: 'online', activity: '' }, schedule = activeSchedule(m, n, roomId);
        return { charId: liveKey(n), name: n, status: st.status, activity: st.activity, todaySchedule: schedule ? getTodaySchedule(schedule, toZonedWallClockDate(now, tzOf(n) || undefined)) : '' };
    });
    if (!info.some(c => c.charId === liveKey(owner))) return '';
    return named(buildConversationCurrentContextBlock({
        nowInstant: now, promptTimeZone: tzOf(owner) || undefined, convoCharInfo: info, finalMessages: [{ role: lastRole }], personaName: w.persona,
        userMessage: said ? 'said' : '', userStatus: (user || p.user)?.status || 'active', userActivity: (user || p.user)?.activity || '',
        mentionedCharacterNames: mentions,
        autonomousIntentKey: isMessageIntent(intentKey) ? intentKey : undefined, primaryCharacterId: merged ? undefined : liveKey(owner), wrapFormat: 'none',
    }), w.persona);
}

// 스케줄 만들기 (마리나라의 지시문 그대로). ask(messages, { temperature, maxTokens }) → 모델의 답 글
//   day를 주면 그날만 다시 만들어요. mode: 'rewrite' | 'adjust' | 'vary' | 'repair'  → 넣은 스케줄
export async function makeSchedule(m, owner, { ask, name = owner, description = '', personality = '', guidance = '', mode = 'rewrite', tz = '', day = '', now = new Date() } = {}) {
    const provider = { chatComplete: async (messages, o) => ({ content: await ask(messages, o) }) }, had = scheduleOf(m, owner);
    const opts = { draftMode: mode, timeZone: tz || undefined };
    if (day) {
        if (!had) throw new Error('먼저 주간 스케줄을 만드세요.');
        if (!CONVERSATION_SCHEDULE_DAYS.includes(day)) throw new Error('요일이 올바르지 않습니다.');
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
//   userStatus: 서버가 물을 때만 줘요 (마리나라의 서버는 창이 없으니 내 상태를 모르고 'idle'로 물어요). 안 주면 폰에 적힌 내 상태
export function checkProactive(m, roomId, { now = new Date(), tzOf = () => '', cards = {}, maxFollowups, source = 'client', userStatus } = {}) {
    const w = need(m), room = w.messenger?.rooms?.[roomId], p = presenceOf(m);
    if (!room) throw new Error('채팅방을 찾을 수 없습니다.');
    const P = liveKey(w.persona), ids = room.members.map(liveKey).filter(k => k !== P && w.phones?.[k]), chatId = chatIdOf(m, roomId), meta = roomMeta(m, roomId);
    if (!ids.length) return { shouldTrigger: false, characterIds: [], reason: 'none', inactivityMs: 0 };
    restoreFollowups(m, roomId);
    syncUser(m, roomId);
    const first = ids[0], name = room.members.find(n => liveKey(n) === first);
    const out = checkAutonomous({
        chatId, meta: { ...meta }, characterIds: ids,
        schedules: schedulesOn(m, roomId) ? Object.fromEntries(ids.filter(k => p.schedules[k]).map(k => [k, p.schedules[k]])) : {}, statusOverrides: p.overrides, cards,
        messages: () => activityRows(w, room),
        userStatus: userStatus ?? (p.user?.status === 'invisible' ? 'active' : p.user?.status), maxFollowups, source, promptTimeZone: tzOf(name) || undefined, nowInstant: now,
        // (Marinara keeps each character's status on the card as the check sees it: the card here is ours, narrative_archive_convo)
        cardStatus: { get: k => { const n = room.members.find(x => liveKey(x) === k); return n ? cardExt(n) : null; }, set: (k, status) => { const n = room.members.find(x => liveKey(x) === k); if (n) toCard(n, { conversationStatus: status }); } },
    });
    return out.autonomousIntent ? { ...out, autonomousIntent: named(out.autonomousIntent, w.persona), autonomousIntentPrompt: named(out.autonomousIntentPrompt, w.persona) } : out;
}
// 먼저 거는 이유의 문장 (마리나라의 것, "the user"는 페르소나 이름으로): 판단의 답(autonomousIntent)과 같은 글이에요. 모르는 이유면 ''
export const intentWhy = (m, intentKey) => (isMessageIntent(intentKey) ? named(getIntentHint(intentKey), liveWorld(m)?.persona) : '');
// 먼저 말 걸기를 줄 세웠어요: 오늘 센 수 · 그 이유의 쉬는 시간을 적어요 (마리나라가 채팅 메타에 적는 것 그대로)
//   (그 방의 메타에: 마리나라처럼 하루 수 · 쉬는 시간은 채팅마다예요)
export function noteProactive(m, roomId, characterId, intentKey, now = new Date()) {
    const meta = roomMetaW(m, roomId);
    Object.assign(meta, buildAutonomousDailyBudgetPatch(meta, characterId, now));
    if (isMessageIntent(intentKey)) Object.assign(meta, buildIntentCooldownPatch(meta, characterId, intentKey, now));
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
    if (!got) throw new Error('장소 응답을 읽을 수 없습니다.');
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
    if (!schedule) throw new Error('먼저 스케줄을 만드세요.');
    if (!activities(schedule).length) return 0;
    const text = await ask([{ role: 'system', content: placeSystem({ owner }) }, { role: 'user', content: placeInput(schedule, { owner, card, places }) }]);
    return takePlaces(schedule, parse(text));
}
// 지금 스케줄 블록 → { key (요일 · 시간: 블록이 바뀌면 달라져요), block, text ("장소 · 하는 일 · ~끝나는 시각") } | null
// (손으로 준 상태가 살아 있는 동안은 null: 스케줄을 따르는 중이 아니에요)
export function blockNow(m, owner, { now = new Date(), tz = '', room = '' } = {}) {
    const p = peek(m), k = liveKey(owner), schedule = activeSchedule(m, owner, room);
    if (!schedule || getActiveStatusOverride(p.overrides?.[k], now)) return null;
    const wall = toZonedWallClockDate(now, tz || undefined), block = getAdjacentScheduleBlocks(schedule, wall).current;
    if (!block) return null;
    const end = one(block.time).split('-')[1] || '';
    return { key: `${wall.getDay()} ${block.time}`, block, text: [one(block.place), one(block.activity), end ? `~${end}` : ''].filter(Boolean).join(' · ') };
}

// 지금 그 사람의 상태 글과 장소: 살아 있는 임시 상태(손으로 준 것 · 캐릭터가 스스로 바꾼 것)가 있으면 그것, 없으면 지금 스케줄 블록
//   → { key (바뀌면 달라져요), text ("장소 · 하는 일 …"), place } | null
export function stateNow(m, owner, { now = new Date(), tz = '', room = '' } = {}) {
    const p = peek(m), k = liveKey(owner), o = getActiveStatusOverride(p.overrides?.[k], now);
    if (o) return { key: `o ${o.createdAt}`, text: [one(o.place), one(o.activity) || o.status].filter(Boolean).join(' · '), place: one(o.place) };
    const at = blockNow(m, owner, { now, tz, room });
    return at ? { key: at.key, text: at.text, place: one(at.block.place) } : null;
}
// 캐릭터가 답장에서 스스로 상태를 바꿨어요 (마리나라의 schedule_update 명령)
//   cmd: { status, activity, duration ("1h"), place (우리 칸: 어디서) }
//   → 바뀐 것 | null (안 바뀜: 손으로 준 상태가 있거나, 빈 명령이거나, 지금 상태와 같은 말)
//   1) 스케줄 표에서 지금 시간에 걸린 칸을 고쳐요 (소망, 2026-11-22: 마리나라가 공유 방에서 하는 것을 캐릭터 방에서도).
//      하는 일 · 상태가 그 칸에 적히고, 시간을 줬고 그게 칸이 끝나기 전이면 칸을 둘로 쪼개요 (뒤는 free time · online).
//      표에 남아요: 그 사람이 나오는 모든 채팅에서, 다음 주에도 (매주 갱신을 켜 두면 새 표로 바뀌어요). → { block: true, … }
//   2) 지금 시간에 걸린 칸이 없으면 (스케줄이 없거나, 칸이 자정을 넘어가는 칸이거나) 마리나라의 캐릭터 방 그대로:
//      임시 상태로 두고, 시간이 지나면 스케줄로 돌아가요. → 임시 상태
//   room: 그 답장의 방 (그 방의 스케줄 스위치로 읽어요)
export function takeStatus(m, owner, cmd, { now = new Date(), tz = '', room = '' } = {}) {
    if (!obj(cmd)) return null;
    const p = presenceOf(m), k = liveKey(owner), status = STATUSES.includes(String(cmd.status || '').toLowerCase()) ? String(cmd.status).toLowerCase() : undefined;
    const activity = one(cmd.activity).slice(0, 120), place = one(cmd.place).slice(0, 80);
    // 우리 것: 방금 들은 자기 상태를 그대로 되돌려 쓴 것은 "바꾼 것"이 아니에요.
    //   마리나라에서 이 명령은 캐릭터가 바꿀 때만 붙이는 꼬리표예요. 우리는 답장 JSON의 칸이라, 모델이 답장마다 요청의
    //   CONTEXT에서 읽은 지금 상태("Your current status: …")를 그대로 채워 넣는 일이 잦아요. 그걸 새 명령으로 받으면
    //   임시 상태가 답장마다 다시 걸려서 끝나지 않고, 스케줄이 영영 안 보여요 (밤에 쓴 "into the night"가 다음 날 낮에도 남음).
    //   - 지금 상태와 하는 일 · 상태가 같으면: 아무것도 안 바꿔요
    //   - 하는 일은 그대로인데 상태만 다르면: 상태만 바꾸고, 끝나는 때는 그대로 둬요 (늘리지 않아요)
    const cur = getActiveStatusOverride(p.overrides[k], now), eff = statusNow(m, owner, { now, tz, room }), same = (x, y) => one(x).toLowerCase() === one(y).toLowerCase();
    if (eff && (!activity || same(activity, eff.activity))) {
        if (!status || status === eff.status) return null;
        if (cur?.expiresAt) { p.overrides[k] = { ...cur, status, ...(place ? { place } : {}) }; toCard(owner, { conversationStatusOverride: p.overrides[k] }); return p.overrides[k]; }
    }
    const command = { type: 'schedule_update', status, activity: activity || undefined, duration: one(cmd.duration) || undefined };
    if (!command.status && !command.activity) return null;
    // (a status the user set by hand has no end time, and it stays in charge: Marinara's rule, for the block edit too)
    if (getActiveStatusOverride(p.overrides[k], now) && !p.overrides[k]?.expiresAt) return null;
    const scheduleNow = toZonedWallClockDate(now, tz || undefined), week = activeSchedule(m, owner, room);
    if (week) {
        const next = JSON.parse(JSON.stringify(week));
        if (applyRoomScheduleCommand({ command, schedule: next, nowDate: scheduleNow })) {
            // (our own field: where the new activity puts them, on the block that now holds this minute)
            const at = getAdjacentScheduleBlocks(next, scheduleNow).current;
            if (at) { if (place) at.place = place; else delete at.place; }
            p.schedules[k] = next;
            toCard(owner, { conversationSchedule: next });
            // (a temporary status from before would hide the block just written)
            if (p.overrides[k]) { delete p.overrides[k]; toCard(owner, { conversationStatusOverride: null }); }
            return { block: true, status: at?.status || status, activity: at?.activity || activity, time: at?.time || '', ...(place ? { place } : {}) };
        }
    }
    const got = applyCharacterStatusCommand({ command, current: p.overrides[k], schedule: week || undefined, now, scheduleNow });
    if (!got) return null;
    p.overrides[k] = { ...got, place: place || null };
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
    if (!z) throw new Error('시간대가 올바르지 않습니다.');
    // (Marinara's rememberConversationTimeZone: one zone for every conversation)
    zones?.set(z);
    return (p.meta.conversationTimeZone = z);
}
// (the model is asked through ask(messages, opts); a stop asked for while it answers drops the answer)
const providerOf = ask => ({ chatComplete: async (messages, o) => { const content = await ask(messages, o); o?.signal?.throwIfAborted(); return { content }; } });
// 초안 만들기 (POST /schedule/draft 그대로: 저장하지 않아요). args: { mode: 'week' | 'day', day, schedule (지금 초안), guidance, dayGuidance,
//   draftMode, timeZone, signal, roomId (그 방의 채팅 메타: 마리나라는 그 채팅의 요약을 읽어요) } → { schedule } | { day, blocks, weekStart }.
//   실패하면 오류에 rawResponse(모델의 답 원문)가 실려요
export const draftSchedule = (m, { ask, charData, roomId = '', ...args }) => scheduleDraft({ ...args, provider: providerOf(ask), charData, meta: chatMetaOf(m, roomId) });
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
//   roomId: 그 방에서 만들면 (마리나라 /schedule/generate의 chatId) 그 방의 메타를 읽고, 만든 것이 있으면 그 방의 스케줄을 켜요
//   (conversation.routes.ts 843~856: conversationSchedulesEnabled: true)
//   → { results: { 폰 열쇠: { status, schedule? } } }
export async function renewSchedules(m, { ask, owners = [], cards = {}, automatic = false, forceRefresh = false, guidance = '', timeZone, signal, now = new Date(), roomId = '' } = {}) {
    const p = presenceOf(m), ids = owners.map(liveKey);
    const out = await scheduleGenerate({
        meta: chatMetaOf(m, roomId), characterIds: ids, existingSchedules: p.schedules, forceRefresh, automatic, scheduleGenerationPreferences: guidance, timeZone, provider: providerOf(ask), signal, nowInstant: now,
        cards: Object.fromEntries(ids.map(k => [k, cards[k] ? { ...cards[k], extensions: { ...(cards[k].extensions || {}), conversationScheduleAutoRenew: p.autoRenew?.[k] === true } } : null]).filter(([, v]) => v)),
    });
    for (const [k, r] of Object.entries(out.results)) if (r.status === 'generated' && r.schedule) { p.schedules[k] = r.schedule; const name = owners.find(n => liveKey(n) === k); if (name) toCard(name, { conversationSchedule: r.schedule }); }
    if (roomId && roomOf(m, roomId) && !out.aborted && Object.values(out.results).some(r => r.status === 'generated')) roomMetaW(m, roomId).conversationSchedulesEnabled = true;
    return out;
}

// ---- 먼저 말 걸기의 방 설정 (마리나라가 채팅 메타에 두는 열쇠 그대로, 그 방의 room.meta에, 준 것만 바꿔요)
//   { autonomousDailyCapOverride: 하루 상한 (1 이상의 수 · null 풀기),
//     groupChatMode: 'individual' (단체방에서 사람마다 따로 답해요: 우리 답장 지시문) · 'merged' · null (한 요청이 여럿을 한꺼번에: 마리나라의 지시문. 마리나라의 기본값),
//     characterExchanges: 캐릭터끼리 주고받기 (true · false),
//     groupResponseOrder: 단체방에서 누가 답하나 ('sequential' 있는 사람 모두 차례로 · 'smart' 모델이 고름 · 'manual' @으로 부른 사람만),
//     groupTurnPromptEnabled: 단체방에서 "@이름으로 다음 사람을 부를 수 있다"고 알려 주기 (true · false, 기본 true) }
export function setAutonomousOptions(m, roomId, o = {}) {
    const meta = roomMetaW(m, roomId);
    if (Object.hasOwn(o, 'autonomousDailyCapOverride')) {
        const v = o.autonomousDailyCapOverride;
        if (v === null || v === '' || v === undefined) delete meta.autonomousDailyCapOverride;
        else if (typeof v === 'number' && Number.isFinite(v) && v >= 1) meta.autonomousDailyCapOverride = Math.floor(v);
        else throw new Error('하루 상한은 1 이상이어야 합니다.');
    }
    if (Object.hasOwn(o, 'groupChatMode')) { if (o.groupChatMode) meta.groupChatMode = String(o.groupChatMode); else delete meta.groupChatMode; }
    if (Object.hasOwn(o, 'characterExchanges')) { if (o.characterExchanges) meta.characterExchanges = true; else delete meta.characterExchanges; }
    if (Object.hasOwn(o, 'groupResponseOrder')) {
        if (!GROUP_ORDERS.includes(o.groupResponseOrder)) throw new Error('응답 순서는 sequential, smart, manual 중 하나여야 합니다.');
        meta.groupResponseOrder = o.groupResponseOrder;
    }
    if (Object.hasOwn(o, 'groupTurnPromptEnabled')) meta.groupTurnPromptEnabled = !!o.groupTurnPromptEnabled;
    return autonomousOptions(m, roomId);
}
export const autonomousOptions = (m, roomId) => { const meta = roomMeta(m, roomId); return { on: meta.autonomousMessages === true, schedulesEnabled: schedulesOn(m, roomId), autonomousDailyCapOverride: meta.autonomousDailyCapOverride ?? null, groupChatMode: meta.groupChatMode || null, characterExchanges: !!meta.characterExchanges, groupResponseOrder: groupOrder(m, roomId), groupTurnPromptEnabled: groupTurnPrompt(m, roomId) }; };
// 단체방에서 한 캐릭터가 말한 뒤, 다른 캐릭터가 거기에 답할 때인가 (마리나라의 /autonomous/exchange 그대로) → 마리나라의 답
export function checkExchangeFor(m, roomId, lastSpeaker, { now = new Date(), tzOf = () => '', cards = {} } = {}) {
    const w = need(m), room = w.messenger?.rooms?.[roomId], p = presenceOf(m);
    if (!room) throw new Error('채팅방을 찾을 수 없습니다.');
    const P = liveKey(w.persona), ids = room.members.map(liveKey).filter(k => k !== P && w.phones?.[k]), chatId = chatIdOf(m, roomId);
    syncUser(m, roomId);
    const name = room.members.find(n => liveKey(n) === liveKey(lastSpeaker));
    return checkExchange({
        chatId, meta: roomMeta(m, roomId), characterIds: ids, lastSpeakerCharId: liveKey(lastSpeaker),
        schedules: schedulesOn(m, roomId) ? Object.fromEntries(ids.filter(k => p.schedules[k]).map(k => [k, p.schedules[k]])) : {}, statusOverrides: p.overrides, cards,
        messages: () => activityRows(w, room),
        promptTimeZone: tzOf(name) || undefined, nowInstant: now,
    });
}

// 스케줄 내보내기 · 가져오기 (마리나라의 character-schedule-transfer 그대로)
//   내보내기 → 파일에 쓸 객체; 가져오기(값) → { ok: true, schedule, format } | { ok: false, reason: 'invalid' | 'unsupported-version' }
export const exportSchedule = (m, owner) => { const s = scheduleOf(m, owner); if (!s) throw new Error('스케줄이 없습니다.'); return createCharacterScheduleExport(s, String(owner || '')); };
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
export function forgetActivity(m, roomId) { const id = chatIdOf(m, roomId); clearChatActivity(id); forgetAutonomousSeed(id); restored.delete(id); }
// 방의 말을 마리나라가 읽는 모양으로 (글이나 통화가 있는 말만)
function activityRows(w, room) {
    const P = liveKey(w.persona);
    return (room.messages || []).filter(x => x.text || x.call).map(x => ({ role: liveKey(x.from) === P ? 'user' : 'assistant', characterId: liveKey(x.from) === P ? null : liveKey(x.from), createdAt: new Date(x.at || 0).toISOString() }));
}
// 먼저 건 말의 수를 방의 말에서 되살려요 (우리 것). 마리나라는 서버 한 곳이 방의 움직임을 기억해요. 우리는 브라우저와 서버 플러그인이
// 따로 기억해서, 한쪽이 건 말을 다른 쪽이 모르면 "아직 한 번도 안 걸었다"고 보고 곧바로 또 걸어요(실리를 다시 열자마자 한 번 더).
// 그래서 먼저 건 말에는 표시(extra.autonomous: 답장을 돌리는 파일이 남겨요)가 있고, 방을 처음 판단할 때 · 다른 쪽이 방을 바꾼 뒤에
// 그 표시로 "내 마지막 말 뒤에 누가 몇 번 걸었고 마지막이 언제인지"를 채워요. 이미 더 많이 세고 있으면 그대로 둬요
const restored = new Set();
function restoreFollowups(m, roomId) {
    const chatId = chatIdOf(m, roomId), w = liveWorld(m), room = w?.messenger?.rooms?.[roomId];
    if (!room || restored.has(chatId)) return;
    restored.add(chatId);
    // (Marinara's own first read of the room; a state that already has its times is left as it is)
    initializeActivityFromMessages(chatId, activityRows(w, room));
    const st = getActivityState(chatId);
    if (!st) return;
    const P = liveKey(w.persona), list = room.messages || [];
    let from = 0;
    for (let i = list.length - 1; i >= 0; i--) if (liveKey(list[i]?.from) === P && (list[i].text || list[i].call)) { from = i + 1; break; }
    const sent = new Map();
    for (const x of list.slice(from)) {
        if (x?.extra?.autonomous !== true || liveKey(x.from) === P) continue;
        const k = liveKey(x.from);
        sent.set(k, { count: (sent.get(k)?.count || 0) + 1, lastSentAt: Number(x.at) || 0 });
    }
    for (const [k, v] of sent) if (!((st.autonomousMessages.get(k)?.count || 0) >= v.count)) st.autonomousMessages.set(k, v);
}
// 다른 쪽(브라우저 ↔ 서버 플러그인)이 방을 바꿨어요: 방의 말에서 다시 읽게 해요. "브라우저가 보고 있음" · "걸고 있는 중"은 그대로 둬요
export function reseedActivity(m, roomId) {
    const id = chatIdOf(m, roomId), st = getActivityState(id), presence = st?.clientPresence || null, busy = st?.generationInProgressSince || null;
    clearChatActivity(id); forgetAutonomousSeed(id); restored.delete(id);
    if (presence) { recordAutonomousClientPresence(id, presence.status); getActivityState(id).clientPresence.updatedAt = presence.updatedAt; }
    if (busy) { markGenerationInProgress(id); getActivityState(id).generationInProgressSince = busy; }
}
// 먼저 걸려던 말이 안 나왔어요 (실패 · 오프라인으로 뺌): "걸고 있는 중" 표시를 풀어요 (마리나라의 /autonomous/clear-in-progress)
export const clearProgress = (m, roomId) => clearGenerationInProgress(chatIdOf(m, roomId));

// ---- 단체방에서 누가 답하나 (마리나라의 Individual 단체방: generate.routes.ts의 고르기를 그대로, src/marinara/group-responders.js)
//   Merged(한 요청이 여럿을 한꺼번에 씀)는 답장 돌리는 파일의 mergeTurn · gatherMerged가 해요: 그때는 마리나라의 지시문을 써요
const GROUP_ORDERS = ['sequential', 'smart', 'manual'];
export const groupOrder = (m, roomId) => { const v = roomMeta(m, roomId).groupResponseOrder; return GROUP_ORDERS.includes(v) ? v : 'sequential'; };
export const groupTurnPrompt = (m, roomId) => roomMeta(m, roomId).groupTurnPromptEnabled !== false;
// 단체방 방식 (마리나라의 읽기 그대로: 'individual'이 아니면 전부 'merged' — 한 요청이 여럿의 말을 한꺼번에 써요)
export const groupMode = (m, roomId) => normalizeGroupChatMode(roomMeta(m, roomId).groupChatMode);
// Merged 차례의 늦음 (마리나라의 계산): @으로 불렀으면 가장 바쁜 사람의 부름 늦음, 아니면 가장 늦는 사람의 늦음 → ms
//   room: 그 방 (그 방의 스케줄 스위치)
export function mergedDelay(m, names, { mention = false, now = new Date(), tzOf = () => '', room = '' } = {}) {
    const rank = { online: 0, idle: 1, dnd: 2, offline: 3 };
    const sts = names.map(n => ({ n, st: statusNow(m, n, { now, tz: tzOf(n), room })?.status || 'online' }));
    if (mention) return getMentionDelay(sts.reduce((worst, c) => ((rank[c.st] ?? 0) > (rank[worst] ?? 0) ? c.st : worst), 'online'));
    return sts.reduce((max, c) => Math.max(max, getDirectMessageDelay(c.st, activeSchedule(m, c.n, room) || undefined)), 0);
}
export { GROUP_MENTION_INVITE_LINE, orderConversationRespondersByDelay };
// 방의 캐릭터들 (나 빼고, 폰이 있는 사람) → [폰 열쇠]
const charKeys = (w, room) => { const P = liveKey(w.persona); return room.members.map(liveKey).filter(k => k !== P && w.phones?.[k]); };
export const isGroupRoom = (m, roomId) => { const w = liveWorld(m), room = w?.messenger?.rooms?.[roomId]; return !!room && charKeys(w, room).length > 1; };
// 지금 답할 수 있는 사람들 (오프라인이 아닌 사람: 마리나라의 availableGroupCharacters) → [{ id, name, talkativeness, status, activity, personality, description }]
//   counted: 먼저 건 말의 차례면 하루 상한이 남은 사람만
export function groupCandidates(m, roomId, { now = new Date(), tzOf = () => '', cards = {}, counted = false } = {}) {
    const w = need(m), room = w.messenger?.rooms?.[roomId], meta = roomMeta(m, roomId);
    if (!room) return [];
    const budget = getAutonomousDailyBudget(meta, now);
    return charKeys(w, room).map(k => {
        const name = room.members.find(n => liveKey(n) === k), schedule = activeSchedule(m, name, roomId), card = cards[k] || {};
        const st = statusNow(m, name, { now, tz: tzOf(name), room: roomId }) || { status: 'online', activity: '' };
        return { id: k, name, talkativeness: schedule ? schedule.talkativeness : 50, status: st.status, activity: st.activity, personality: String(card.personality || '').slice(0, 500), description: String(card.description || '').slice(0, 500), schedule };
    }).filter(c => c.status !== 'offline' && (!counted || (budget.counts[c.id] ?? 0) < dailyCapForCharacter(c.schedule, meta)));
}
const roomTurns = (w, room) => { const P = liveKey(w.persona); return (room.messages || []).filter(x => (x.text || x.call) && !isMessageHiddenFromAI(x)).map(x => ({ role: liveKey(x.from) === P ? 'user' : 'assistant', characterId: liveKey(x.from) === P ? null : liveKey(x.from), name: x.from, content: String(x.text || '') })); };
// 이번 차례에 답할 사람들 → [폰 열쇠] (마리나라의 순서대로: @으로 부른 사람 → 저장된 순서)
//   ask(messages, { temperature, topP }) → 모델의 답 글 (smart일 때만 불러요). 고르기가 실패하거나 아무도 못 고르면 마리나라처럼 한 사람(방금 말한 사람이 아닌 첫 사람)
export async function groupResponders(m, roomId, { ask, now = new Date(), tzOf = () => '', cards = {} } = {}) {
    const w = need(m), room = w.messenger?.rooms?.[roomId];
    if (!room) throw new Error('채팅방을 찾을 수 없습니다.');
    const available = groupCandidates(m, roomId, { now, tzOf, cards }), order = groupOrder(m, roomId), turns = roomTurns(w, room);
    const explicit = mentionsIn(m, roomId).map(liveKey).filter(k => available.some(c => c.id === k));
    let smartQueue = null;
    if (!explicit.length && order === 'smart' && available.length) {
        try {
            const candidates = formatSmartGroupCandidates(available.map(c => ({ id: c.id, name: c.name, talkativeness: c.talkativeness, status: c.status, activity: c.activity, personality: c.personality, description: c.description })), true);
            const prompt = buildSmartGroupSelectionPrompt({ chatMode: 'conversation', personaName: w.persona, candidates, recentTranscript: buildSmartGroupRecentTranscript(turns, t => (t.role === 'user' ? w.persona : t.name || 'Character')) });
            smartQueue = parseSmartGroupSelectionIds(String(await ask(prompt, { ...SMART_GROUP_SELECTOR_DEFAULTS }) ?? ''), available);
        } catch (err) { console.warn('[narrative-archive] group-smart: selector failed; using fallback', err); smartQueue = []; }
        if (!smartQueue.length) smartQueue = selectFallbackSmartGroupResponder(available, turns);
    }
    return resolveRespondingCharacterIds({ explicitlyMentionedIds: explicit, order, availableIds: available.map(c => c.id), smartQueue });
}
// 단체방에서 한 사람이 답한 뒤: 그 답이 @이름으로 부른 사람이 다음 차례 (마리나라의 routeCharacterMentions)
//   queue: 이번 차례의 사람들 [폰 열쇠] (이미 말한 사람 … 방금 말한 사람 … 기다리는 사람), index: 방금 말한 사람의 자리, text: 방금 한 말
//   counted: 먼저 건 말의 차례 (부른 사람도 하루 상한에 들어가야 해요)
//   → { queue, mentioned: [폰 열쇠], delays: { 폰 열쇠: ms }, changed }
export function groupHandoff(m, roomId, { queue, index, text, counted = false, now = new Date(), tzOf = () => '', cards = {} } = {}) {
    const p = presenceOf(m), candidates = groupCandidates(m, roomId, { now, tzOf, cards, counted });
    const mentioned = getExplicitlyMentionedCharacterIds({ text, candidates });
    let projectedMeta = roomMeta(m, roomId);
    const reserve = id => {
        // Like /autonomous/check, a character without a schedule uses its card talkativeness.
        const capSchedule = (schedulesOn(m, roomId) && p.schedules[id]) || { talkativeness: Math.round((cards[id]?.talkativeness ?? 0.5) * 100) };
        const next = { ...projectedMeta, ...buildAutonomousDailyBudgetPatch(projectedMeta, id, now) };
        // Like /autonomous/exchange, a handoff never takes a shared limit's last check-in.
        const capMeta = sharesAutonomousDailyBudget(projectedMeta) ? next : projectedMeta;
        if (isAutonomousDailyBudgetExhausted(id, capSchedule, capMeta, now)) return false;
        projectedMeta = next;
        return true;
    };
    const out = routeMentionsAfterReply({ queue, index, mentioned, reserve: counted ? reserve : undefined });
    // (a first reply to someone may invite another: their delay is the mention delay; none on a counted turn, as the scheduler skips it)
    return { ...out, delays: Object.fromEntries(out.mentioned.map(id => [id, counted ? 0 : getMentionDelay(candidates.find(c => c.id === id).status)])) };
}
