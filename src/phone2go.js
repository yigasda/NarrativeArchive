// 폰 2 답장을 실제로 돌리는 곳 (docs/PHONE2-PLAN.md 단계 7-5): 화면은 메시지를 보낸 뒤 liveGo 하나만 불러요.
// 일의 줄(phone2run.js runLive)에 실제 것들을 이어요: 입력 모으기(phone2live.js · phone2ask.js), 답장 지시문
// (phone2reply.js), 모델(초안 모델), 저장, 그리고 답장 뒤의 폰 2 반영(phone2reflect.js).
// 반영은 답장마다 돌리지 않아요(소망 결정, 실제 모델 시험 뒤): 메신저를 나갈 때(홈으로, 폰을 닫을 때) liveReflect로
// 쌓인 대화를 한 번에 읽어요. 잘게 나눠 읽으면 같은 날 일기 · 같은 상황이 여러 번 생기고 호출도 메시지마다 3번이 돼요.
// 폰 1은 이 파일을 안 불러요.

import { ctx, saveMeta, MODULE } from './core.js';
import { applyInjection } from './inject.js';
import { askDraft, phone2Clock, aroundBlock, ownerZone, cardBlocks } from './phonedata.js';
import { askAI, askCompress, stripThink, isBlocked, SECTION_GUARD, aiProfiles, callConn, connSettings, stSourceList, stSourceName, stSourceModels, OWN_MODES, apiFormat } from './ai.js';
import { SCENES_SYS, parseScenes } from './scenes.js';
import { resolvePhoneProfile, ownerProfileBlock, personaBlock } from './phoneprofile.js';
import { parseJson } from './phoneparse.js';
import { nameKey } from './people.js';
import { liveWorld, livePhone, liveMeta, liveKey, liveAtYear, isSnap, setStoryKeeper, startFresh, enqueueReplies, enqueueJob, renamePersona, setDrawerSeed } from './phone2store.js';
import { emojiOf, reactOf, putReact, quickReacts, noteRecent, messageOf } from './phone2react.js';
import { branchRoom, replyDraftOf, purgeTrash, markMessages, markedMessages, trashOf, restoreMessages, emptyTrash, dropRoom, roomTrash, restoreRoom, emptyRoomTrash, addMember, removeMember } from './phone2room.js';
import { dropMessages, editMessage, replyTail, settleSwipes, swipeInfo, swipeTo, swipeList, dropSwipe, dropSwipes, dropOtherSwipes, koRows, koChunks, koInput, takeKo } from './phone2edit.js';
import { AI_SYS_PHONE_KO, voiceRows, who as voiceWho } from './phonetr.js';
import { askTranslator, glossaryEntries, glossaryIn } from './translate.js';
import { importRows, importInto, importFile, importedOf, chatKey } from './phone2import.js';
import { liveChatTail, liveSnapBehind, liveSnapExtend, liveSnapNow } from './phone2snap.js';
import { liveStoryText } from './phone2story.js';
import { BACK, backLeft, backInput, phone2BackSystem, takeBack, backMessage, markTold } from './phone2back.js';
import { liveWall } from './phone2clock.js';
import { gatherReply } from './phone2live.js';
import { presenceOf, scheduleOf, setSchedule, setStatusOverride, setUserStatus, setAutonomous, statusNow, replyDelay, contextBlock, makeSchedule, checkProactive, noteProactive, fillPlaces, stateNow, takeStatus, scheduleZone, setScheduleZone, draftSchedule, summarizeSchedule, repairSchedule, setAutoRenew, autoRenewOf, needsRefresh, renewSchedules, setAutonomousOptions, autonomousOptions, checkExchangeFor, mentionsIn, activeSchedule, schedulesOn, setSchedulesOn, exportSchedule, importSchedule, syncUser, noteAssistant, noteReaction, forgetActivity, setCardStore, setZoneStore, flushCards, clearProgress, groupOrder, groupTurnPrompt, isGroupRoom, groupResponders, groupHandoff, GROUP_MENTION_INVITE_LINE, orderConversationRespondersByDelay, groupMode, mergedDelay, groupCandidates } from './phone2sched.js';
import { buildMergedConversationSystemPrompt, formatConversationGroupOutputFormat, mergedRespondersLine, mergedMentionLine, extractLeadingThinkingBlocks, buildGenerationInfoExtra, chatModelChoiceSchema, readChatModelOverride, readChatRecentModels, applyChatModelPatch, applyChatModelOverride, reorderStars, CHAT_RECENT_MODELS_KEY, MAX_PINNED_MODELS, relevantGenerationParameters, reasoningEffortChoices, resolveProviderReasoningEffort, isClaudeOpus55Model, generationLevelLabel } from './phone2merged.js';
import { replyInput, messengerBlock } from './phone2ask.js';
import { phone2ReplySystem } from './phone2reply.js';
import { runLive, takeMerged } from './phone2run.js';
import { markPersona } from './phone2feed.js';
import { updateLive, undoLive, liveReads } from './phone2reflect.js';
import { SHORT_PROMPT, compressParts, langBlock } from './prompts.js';
import { AI_SYS_DIGEST } from './digest.js';
import { DIGEST_STATE, digestDue, digestRaw, digestSize, digestHalves, scenesSystem, scenesInput, scenesNote, takeDigest, failDigest, foldChunk, foldRequest, takeFold, failFold } from './phone2digest.js';

// rounds of reflection after one reply at most (messages piled up while only talking: 100 a round)
export const LIVE_GO = { rounds: 3, replyTokens: 4000, digests: 2 };
const tzOf = p => ownerZone(p)?.tz || 'UTC';
// the time it is now on a 폰 2 phone: the story's date (the world's dayShift) and the real clock where the owner is.
// Given to liveMeta as `now`, so the phone's screens and app requests go by a clock that runs
// (its .year(p): the year of that same moment — the story's, as the day shift moves it; 0 when there is no 폰 2 or phone)
export const liveNowOf = (real, at = () => Date.now()) => {
    const wall = p => { const w = liveWorld(real); return w && p ? liveWall(tzOf(p), w.dayShift, at()) : null; };
    const now = p => wall(p)?.at || '';
    now.year = p => wall(p)?.year || 0;
    return now;
};
// the owner's card as the reply reads it: the profile the user chose for them, else their character card in this chat
async function cardOf(p) {
    const chosen = p.financeProfile ? await resolvePhoneProfile(ctx(), p.financeProfile).catch(() => null) : null;
    if (chosen?.text) return String(chosen.text).trim();
    const k = nameKey(p.owner), block = cardBlocks().find(b => nameKey(/^\[CHARACTER CARD — ([^\]]*)\]/.exec(b)?.[1] || '') === k);
    return block ? block.replace(/^[^\n]*\n/, '').trim() : '';
}

// runs the waiting replies of this chat's 폰 2, one at a time, each put into its room and saved. onChange(): called
// whenever the screen should draw again (a reply came, a job failed). Returns runLive's { ran, failed, busy }
// whether `real` is still the open chat's (another chat was opened while a request was out: what comes back has
// nowhere to be saved, and nothing more is asked for it)
const open = real => { const md = ctx().chatMetadata; return !md || md[MODULE] === real; };
// whether the 폰 2 a go began with is still there to write to
const here = (real, w) => open(real) && liveWorld(real)?.id === w.id;
// 이야기에서 시작한 폰의 요약본을 챙겨요 (phone2snap.js). 한 번에 하나만 돌아요.
//   요약본이 없는 폰(요약본 방식 전에 시작해 둔 폰 · 분기한 방에서 저절로 다시 시작한 폰): 지금 이야기의 끝까지 요약본을
//     만들어 넣어요. 못 만들면 그 폰은 요청을 보내지 않아요(답장은 실패로, 채우기는 오류로) — 다시 하면 다시 만들어요.
//   요약본이 있는 폰, 답장 전에: 요약본 뒤로 롤플이 끝 메시지들에 다 안 담길 만큼 진행됐으면 요약본을 지금
//     끝까지 늘려요. 실패하면 답장은 가진 요약본으로 가고, 롤플이 더 진행될 때까지 다시 하지 않아요.
const extending = new WeakMap();
// 요약본을 만들거나 늘리는 중인지 (화면의 "이야기 정리 중")
export const liveSnapBusy = real => extending.has(real);
async function keepUpStory(real, tell = () => {}) {
    if (extending.has(real)) return extending.get(real);
    const w = liveWorld(real);
    if (!w || w.from !== 'story' || !open(real)) return null;
    const snapOf = () => (isSnap(w.snap) ? w.snap : null);
    const tail = liveChatTail(), had = snapOf();
    if (had && (w.snapTried === tail.end || !liveSnapBehind(had, tail))) return null;
    // (marked busy before anything is asked, so one asked meanwhile waits for this one)
    let done;
    extending.set(real, new Promise(r => { done = r; })); tell();
    try {
        const next = had ? await liveSnapExtend(real, had) : (await liveSnapNow(real))?.snap;
        if (!isSnap(next)) throw new Error('이야기 요약본을 받지 못했어요');
        // (written only to the 폰 2 it was made for, and only if its snapshot is still the one this began from)
        if (here(real, w) && snapOf() === had) { w.snap = next; delete w.snapTried; await saveMeta(); }
    } catch (err) {
        console.warn('[narrative-archive] live story', err);
        if (had && here(real, w)) w.snapTried = tail.end;
    } finally { extending.delete(real); done(); tell(); }
    return null;
}
// 실리에서 페르소나를 바꿨으면 실시간 폰의 "나"도 그 이름으로 (열어 둔 채팅의 폰만). 바꿨으면 저장하고 true.
// 실시간 서랍이 생길 때마다(폰을 열 때 · 답장을 돌릴 때) 저절로 불려요
export function liveFollowPersona(real) {
    if (!real || !liveWorld(real) || !ctx().chatMetadata || !open(real)) return false;
    if (!renamePersona(real, ctx().name1)) return false;
    Promise.resolve().then(() => saveMeta()).catch(err => console.warn('[narrative-archive] live persona', err));
    return true;
}
setDrawerSeed((d, w, real) => { liveFollowPersona(real); });
// (a 폰 2 app request asks through its drawer, and only while there is no snapshot: made here, lengthened only before a reply)
setStoryKeeper(real => keepUpStory(real));
// the words a request is refused with while a 폰 2 begun from the story has no snapshot
const NO_STORY = '이야기 요약본을 만들지 못했어요. 잠시 뒤 다시 해 주세요';
// 저장을 줄 세워요. 채팅 저장은 느려요(폰에서는 한 번에 몇 초): 일(답장 하나 · 반영 한 라운드)이 끝날 때마다 저장은 그대로
// 하되, 화면과 다음 일이 그 저장을 기다리지 않아요.
//   save(): 저장을 시작하고 바로 돌아와요. 앞의 저장이 아직 돌고 있으면 그것만 기다렸다가 시작해요(한 번에 하나).
//           그래서 저장은 늘 일이 끝난 자리에서 시작해요: 반쯤 바뀐 폰이 저장되는 일이 없어요
//   done(): 마지막 저장이 끝날 때까지 기다려요. 저장이 실패했으면 그 오류를 던져요
export function saveLine(save = saveMeta) {
    let running = null, failed = null;
    return {
        save: async () => { while (running) await running; running = Promise.resolve().then(save).catch(err => { failed ||= err; }).finally(() => { running = null; }); },
        done: async () => { while (running) await running; if (failed) { const e = failed; failed = null; throw e; } },
    };
}
export async function liveGo(real, { onChange = () => {} } = {}) {
    followSchedule(real); await pickResponders(real); holdReplies(real);
    for (const id of Object.keys(liveWorld(real)?.messenger?.rooms || {})) syncUser(real, id);
    const tell = () => { try { onChange(); } catch (err) { console.error('[narrative-archive] live draw', err); } };
    const line = saveLine();
    let asked = null;
    const out = await runLive(real, {
        save: line.save, alive: () => open(real),
        parse: s => parseJson(s, { salvage: true }),
        // (what was sent and what came with the answer, kept for the reply it becomes: Marinara's cachedPrompt · thinking · generationInfo)
        // (the room's own model, when one was picked for it in the quick switcher: else the draft model, as before)
        ask: (input, { system, req }) => { asked = { system, input, meta: {} }; return askRoom(real, req?.room, input, { force: true, system, maxTokens: LIVE_GO.replyTokens, effort: 'low', meta: asked.meta }); },
        gather: async job => { await keepUpStory(real, tell); return gatherJob(real, job); },
        took: (job, got) => { const w = liveWorld(real); if (w && w.id === job.world && got?.said && asked) keepAsked(w, w.messenger?.rooms?.[job.room], job, asked); asked = null; },
        // (an owner with a schedule: the texts carry the schedule's state, not one the model wrote)
        stateFor: job => { if (!activeSchedule(real, job.owner)) return undefined; const p = livePhone(real, job.owner); return stateNow(real, job.owner, { tz: p ? zoneOf(real, p) : '' })?.text || ''; },
        after: async (job, got) => {
            const w = liveWorld(real), p = livePhone(real, job.owner);
            // (a Merged group turn: several spoke at once. No hand-off after it: everyone who could has had the turn)
            if (job.merged) {
                const room = w?.messenger?.rooms?.[job.room];
                if (w && room && w.id === job.world && got?.said) {
                    for (const name of got.speakers || []) { const ph = livePhone(real, name); if (ph) markPersona(ph, w.persona); if (room.away) delete room.away[liveKey(name)]; }
                    if (room.away && !Object.keys(room.away).length) delete room.away;
                    room.turn = { spoke: (got.speakers || []).map(liveKey) };
                    if (!job.regen) noteAssistant(real, job.room, '');
                }
                tell();
                return;
            }
            if (w && p && w.id === job.world) markPersona(p, w.persona);
            // (the owner changed their own status in the answer: a temporary one, and the phone follows it)
            if (w && p && w.id === job.world && got?.status && activeSchedule(real, job.owner) && takeStatus(real, job.owner, got.status, { tz: zoneOf(real, p) })) { followSchedule(real); await flushCards(); await line.save(); }
            if (w && w.id === job.world && got?.said) { const room = w.messenger?.rooms?.[job.room]; if (room?.away) { delete room.away[liveKey(job.owner)]; if (!Object.keys(room.away).length) delete room.away; } }
            // (Marinara records an assistant message when it is saved, not for a regenerated one; the character only when it wrote first)
            if (w && w.id === job.world && got?.said && !job.regen) noteAssistant(real, job.room, job.auto ? job.owner : '');
            // (a message a character wrote first counts toward the day and its reason rests, once it is really there — Marinara's
            // recordSavedAutonomousGeneration; and the room's failure pause ends)
            if (w && w.id === job.world && job.auto && got?.said) { noteProactive(real, job.room, liveKey(job.owner), job.intent || ''); const room = w.messenger?.rooms?.[job.room]; if (room) delete room.autoFail; await line.save(); }
            // (a group room: whoever this reply called with @Name answers next — Marinara's mention routing)
            if (w && w.id === job.world && got?.said && !job.regen && handOff(real, job)) await line.save();
            // (a group room, after a message a character wrote first: another may answer it, as Marinara's loop does)
            if (w && p && w.id === job.world && job.auto && got?.said && exchangeAfter(real, job)) await line.save();
            tell();
        },
    });
    if (out.failed?.job?.auto) {
        const w = liveWorld(real), room = w?.messenger?.rooms?.[out.failed.job.room];
        if (w) w.queue.jobs = w.queue.jobs.filter(j => j.id !== out.failed.job.id);
        if (room) { const attempts = (room.autoFail?.attempts || 0) + 1; room.autoFail = { attempts, nextAllowedAt: Date.now() + Math.min(AUTO_FAIL.max, AUTO_FAIL.base * 2 ** Math.max(0, attempts - 1)), lastError: String(out.failed.error || '').slice(0, 200) }; }
        // (Marinara: on a failed or empty autonomous generation the in-progress flag is cleared, so polling does not get stuck)
        clearProgress(real, out.failed.job.room);
        console.warn('[narrative-archive] live autonomous', out.failed.error);
        out.failed = null;
        try { await line.save(); } catch { /* told below */ }
    }
    tell();
    // (the replies are on the screen already; their last save ends here. One that failed: the talk is still there in
    // memory and the next save takes it; told as saveError)
    try { await line.done(); } catch (err) { console.error('[narrative-archive] live save', err); out.saveError = String(err?.message || err); }
    // (talk that goes on without the messenger being left: a room that has piled up enough is summarized now, so what
    // is not summarized yet never outgrows what a reply request carries. No reflection here: that waits for leaving)
    const w = liveWorld(real);
    if (out.ran && w && open(real)) {
        for (const ph of Object.values(w.phones || {})) {
            if (!ph?.owner || !digestDue(real, ph.owner).length) continue;
            try { await liveDigest(real, ph.owner); } catch (err) { console.error('[narrative-archive] live digest', err); }
        }
        tell();
    }
    return out;
}
// ---- 스케줄 · 상태 · 먼저 말 걸기 · 늦은 답 (phone2sched.js: 판단과 지시문은 마리나라의 것)
// 스케줄 · 손으로 준 상태 · 매주 갱신은 캐릭터 카드에 둬요 (마리나라처럼 모든 채팅에 공통): 실리 카드의 data.extensions.narrative_archive_convo
const CARD_KEY = 'narrative_archive_convo';
const cardIndex = name => { const list = ctx().characters; return Array.isArray(list) ? list.findIndex(x => liveKey(x?.name) === liveKey(name)) : -1; };
setCardStore({
    get: name => { const i = cardIndex(name); if (i < 0 || typeof ctx().writeExtensionField !== 'function') return null; const e = ctx().characters[i]?.data?.extensions?.[CARD_KEY]; return e && typeof e === 'object' ? e : {}; },
    set: async (name, patch) => { const i = cardIndex(name); if (i < 0) return; const was = ctx().characters[i]?.data?.extensions?.[CARD_KEY]; await ctx().writeExtensionField(i, CARD_KEY, { ...(was && typeof was === 'object' ? was : {}), ...patch }); },
});
// 스케줄의 시간대는 확장 설정에 하나 (마리나라처럼 모든 채팅에 공통)
setZoneStore({
    get: () => String(ctx().extensionSettings?.[MODULE]?.conversationTimeZone || ''),
    set: tz => { const es = ctx().extensionSettings; if (!es) return; es[MODULE] = es[MODULE] && typeof es[MODULE] === 'object' ? es[MODULE] : {}; if (tz) es[MODULE].conversationTimeZone = tz; else delete es[MODULE].conversationTimeZone; ctx().saveSettingsDebounced?.(); },
});
// (스케줄의 시간대: 마리나라처럼 스케줄 전체에 하나를 정했으면 그것, 아니면 그 사람 폰의 시간대)
const zoneOf = (real, p) => scheduleZone(real) || tzOf(p);
// 줄 선 답장마다 그 사람의 지금 상태로 때를 정해요: 바쁘면 그만큼 뒤로, 오프라인이면 돌아올 때까지 (1분마다 다시 봐요)
// 단체방에서 내가 말한 뒤: 이번 차례에 누가 답할지 골라요 (마리나라의 Individual 단체방 그대로). 안 고른 사람의 답장은 줄에서 빠져요
//   sequential: 있는 사람 모두 · smart: 모델이 고름 (실패하면 한 사람) · manual: @으로 부른 사람만. @으로 불렀으면 순서와 상관없이 그 사람만
//   room.turn = { spoke: [이번 차례에 말한 사람의 폰 열쇠] } (한 차례에 한 사람은 한 번만: 부르기에서 봐요)
const picking = new Set();
export async function pickResponders(real, now = Date.now()) {
    const w = liveWorld(real);
    if (!w || picking.has(real)) return 0;
    picking.add(real);
    let n = 0;
    try {
        const allOf = room => w.queue.jobs.filter(j => j.kind === 'reply' && j.state === 'waiting' && j.room === room.id && !j.auto && !j.why);
        const mineOf = room => allOf(room).filter(j => !j.regen);
        for (const room of Object.values(w.messenger?.rooms || {})) {
            // (new ones: lined up for words I just sent, or for a new answer I asked for by hand)
            const fresh = isGroupRoom(real, room.id) ? allOf(room).filter(j => !j.picked && (!j.timed || j.regen)) : [];
            if (!fresh.length) continue;
            room.turn = { spoke: [] };
            // (Merged: one request writes for everyone who can answer — Marinara's default group mode)
            if (groupMode(real) === 'merged') { n += mergeTurn(real, room, allOf(room), { regen: fresh.some(j => j.regen), now }); continue; }
            for (const j of allOf(room)) j.picked = true;
            // (a new answer asked for by hand: each one answers again, as they are)
            if (fresh.some(j => j.regen)) continue;
            // (sequential: everyone available, which is what the line holds already; holdReplies takes the offline ones out)
            if (groupOrder(real) === 'sequential' && !mentionsIn(real, room.id).length) continue;
            const ids = await groupResponders(real, room.id, { ask: (messages, o) => askVia(real)(messages, o), now: new Date(now), tzOf: name => { const p = livePhone(real, name); return p ? zoneOf(real, p) : ''; }, cards: cardsOf(room) });
            if (liveWorld(real) !== w) return n;
            // (nobody can answer now — all offline: the line stays, holdReplies takes them out and keeps who was away)
            if (!ids.length && (groupOrder(real) !== 'manual' || mentionsIn(real, room.id).length)) continue;
            const out = new Set(mineOf(room).filter(j => !ids.includes(liveKey(j.owner))));
            if (out.size) { w.queue.jobs = w.queue.jobs.filter(j => !out.has(j)); n += out.size; }
        }
    } finally { picking.delete(real); }
    return n;
}
// 답장 한 번의 요청 { system, input, take? } | null (답할 것이 없으면). liveGo가 보내고, 프롬프트 보기(livePeekPrompt)가 보내지 않고 보여 줘요
async function gatherJob(real, job) {
    const w = liveWorld(real), p = livePhone(real, job.owner);
    if (!w || !p) return null;
    if (w.from === 'story' && !isSnap(w.snap)) throw new Error(NO_STORY);
    const d0 = liveMeta(real, { now: liveNowOf(real) }), card = await cardOf(p);
    if (job.merged) return gatherMerged(real, job, { card, d0 });
    const d = gatherReply(real, job.owner, job.room, { now: Date.now(), tz: tzOf(p), why: job.why || '', deps: {
        // (the reply's own clock block: each place's time now and weekday, as the reply prompt was tuned with)
        // (the weekday is worked out from the phone's year: its saved time's, so the year after once the clock
        // has passed New Year)
        clock: (ph, at) => liveAtYear(ph, at, () => phone2Clock(ph, at, d0)), around: aroundBlock, card: () => card,
        // (who the persona is, as the user wrote them: the same block every phone request carries)
        who: owner => personaBlock(ctx(), owner, card),
        place: ph => { const r = (ph.where?.people || []).find(x => nameKey(x?.name) === nameKey(ph.owner)); return String(r?.place || r?.city || '').trim(); },
        story: () => liveStoryText(real, w),
        // (the role-play's last messages as they stand now: read at this moment, no place kept)
        before: () => (open(real) ? liveChatTail().lines : []),
    } });
    // (Marinara's status · schedule lines: always there, as in Marinara; an owner with no schedule reads "online")
    if (d) { const room = w.messenger.rooms[job.room], last = [...(room?.messages || [])].reverse().find(x => x.text || x.call); d.context = contextBlock(real, job.owner, job.room, { tzOf: n => zoneOf(real, livePhone(real, n) || p), lastRole: last && liveKey(last.from) === liveKey(w.persona) ? 'user' : 'assistant', said: !job.why, intentKey: job.intent || '', mentions: job.auto ? [] : mentionsIn(real, job.room) });
        // (a group room: each responder is told it may hand the turn on with @Name — Marinara's line, as it is)
        if (d.context && isGroupRoom(real, job.room) && groupTurnPrompt(real)) d.context += `\n${GROUP_MENTION_INVITE_LINE}`; }
    return d ? { room: job.room, system: phone2ReplySystem({ owner: d.owner, persona: d.persona, scheduled: !!activeSchedule(real, job.owner) }), input: replyInput(d) } : null;
}
// 답장을 받은 뒤: 그 답의 마지막 말에 마리나라가 남기는 값을 남겨요 (generate.routes.ts "Persist thinking/reasoning and generation info")
//   extra.thinking: 모델의 생각 (제공자가 따로 준 것 + 답 맨 앞의 <think> 같은 블록; 없으면 null)
//   extra.cachedPrompt: 보낸 요청 그대로 [{ role, content }]  ·  extra.generationInfo: 모델 · 온도 · 토큰 · 걸린 시간 …
//   마리나라처럼 cachedPrompt는 방의 마지막 두 답에만 둬요 (저장을 아끼려고)
function keepAsked(w, room, job, asked) {
    if (!room) return;
    const names = new Set((job.merged || [liveKey(job.owner)]).map(k => liveKey(k)));
    const last = [...(room.messages || [])].reverse().find(x => names.has(liveKey(x.from)));
    if (!last) return;
    const meta = asked.meta || {}, inline = extractLeadingThinkingBlocks(String(meta.raw || ''));
    const fullThinking = [String(meta.thinking || '').trim(), inline.thinking].filter(Boolean).join('\n\n');
    const u = meta.usage || null;
    const info = buildGenerationInfoExtra({
        chatMode: 'conversation', gameOutcomeNarrationFailed: false, marketWorldPlace: undefined, gameToolPlan: null, gameToolConnection: null,
        generationProviderOrigin: { model: String(meta.model || ''), provider: String(meta.provider || '') },
        temperature: typeof meta.temperature === 'number' ? meta.temperature : undefined, effectiveMaxTokensForSend: meta.maxTokens ?? undefined, suppressModelParameters: false,
        effectiveMaxContext: null, connectionMaxContext: null, showThoughts: true, resolvedEffort: meta.reasoningEffort || null, reasoningEffort: null, verbosity: null, serviceTier: null,
        assistantPrefill: '', assistantReasoningPrefill: '', customParameters: {},
        usage: u ? { promptTokens: u.promptTokens ?? undefined, completionTokens: u.completionTokens ?? undefined, completionReasoningTokens: u.reasoningTokens ?? undefined, cachedPromptTokens: u.cachedPromptTokens ?? undefined } : undefined,
        tokensContext: null, tokensLastRequestInput: u?.promptTokens ?? null, requestCount: 1, durationMs: meta.durationMs ?? 0, reasoningDurationMs: null,
        finishReason: meta.finishReason || undefined, lastContextFit: null, fullThinking, geminiResponseParts: null, chatCompletionsReasoning: null, encryptedReasoningItems: undefined, contextInjections: [],
    });
    last.extra = { ...(last.extra || {}), thinking: info.thinking, generationInfo: info.generationInfo, cachedPrompt: [...(asked.system ? [{ role: 'system', content: asked.system }] : []), { role: 'user', content: asked.input }] };
    if (last.extra.thinking === null) delete last.extra.thinking;
    // (keep the last two)
    const P = liveKey(w.persona), holders = (room.messages || []).filter(x => liveKey(x.from) !== P && x.extra?.cachedPrompt);
    for (const x of holders.slice(0, -2)) { delete x.extra.cachedPrompt; if (!Object.keys(x.extra).length) delete x.extra; }
}
// Merged 차례의 요청: 지시문은 마리나라의 것 (src/marinara/merged-conversation.js: 기본 Conversation 지시문 + 단체방 줄 + 되풀이 금지),
// 입력은 우리 블록 (MESSENGER · CHAT SUMMARY · CONTEXT · 사람마다 카드 · PERSONA · STORY · LAST MESSAGES) + 맨 끝에 마리나라의 Output Format.
// **우리 답장 지시문(phone2reply.js)으로 바꿔야 해요** (docs/MARINARA-PORT.md "꼭 할 것"): 지금은 번역 · 폰에서 한 일 · 상태 줄 · 반응이 없어요
async function gatherMerged(real, job, { card, d0 }) {
    const w = liveWorld(real), room = w.messenger.rooms[job.room], P = liveKey(w.persona), p = livePhone(real, job.owner);
    const chars = room.members.filter(n => liveKey(n) !== P && w.phones?.[liveKey(n)]), can = job.merged.map(k => chars.find(n => liveKey(n) === k)).filter(Boolean);
    if (!can.length) return null;
    const d = gatherReply(real, job.owner, job.room, { now: Date.now(), tz: tzOf(p), why: '', deps: {
        clock: (ph, at) => liveAtYear(ph, at, () => phone2Clock(ph, at, d0)), around: aroundBlock, card: () => card, who: owner => personaBlock(ctx(), owner, card),
        place: () => '', story: () => liveStoryText(real, w), before: () => (open(real) ? liveChatTail().lines : []),
    } });
    if (!d) return null;
    const last = [...(room.messages || [])].reverse().find(x => x.text || x.call), called = (job.called || []).map(k => chars.find(n => liveKey(n) === k)).filter(Boolean);
    const context = contextBlock(real, job.owner, job.room, { tzOf: n => zoneOf(real, livePhone(real, n) || p), lastRole: last && liveKey(last.from) === P ? 'user' : 'assistant', said: true, mentions: called, merged: true });
    const cards = [];
    for (const n of chars) { const body = String(liveKey(n) === liveKey(job.owner) ? card : await cardOf(livePhone(real, n)) ?? '').trim(); if (body) cards.push(`[${n}'s card]\n${body}`); }
    const input = [
        // (no owner here: nobody's state is written beside their name)
        messengerBlock('', d.messenger),
        String(d.summary || '').trim() ? `[CHAT SUMMARY]\n${String(d.summary).trim()}` : '',
        context ? `[CONTEXT]\n${context}` : '',
        ...cards,
        String(d.who || '').trim(),
        String(d.story || '').trim() ? `[STORY]\n${String(d.story).trim()}` : '',
        String(d.before || '').trim() ? `[LAST MESSAGES]\n${String(d.before).trim()}` : '',
        [can.length < chars.length ? mergedRespondersLine(can) : '', mergedMentionLine(called), formatConversationGroupOutputFormat({ wrapFormat: 'none', characterNames: chars, userName: w.persona })].filter(Boolean).join('\n'),
    ].filter(Boolean).join('\n\n');
    return {
        room: job.room, system: buildMergedConversationSystemPrompt({ convoCharNames: chars, personaName: w.persona }), input,
        take: (answer, { now }) => takeMerged(real, job.room, stripThink(answer), { names: chars, lead: job.owner, now, stateOf: name => (activeSchedule(real, name) ? stateNow(real, name, { tz: zoneOf(real, livePhone(real, name) || p) })?.text || '' : '') }),
    };
}
// Merged 단체방의 한 차례: 방에 줄 서 있던 답장들을 하나로 묶어요 (마리나라: 한 번의 생성이 답할 수 있는 사람 모두의 말을 써요)
//   job.merged = [이번에 말해도 되는 사람의 폰 열쇠], job.called = [내가 @으로 부른 사람의 폰 열쇠]. job.owner는 그 첫 사람 (마리나라: 묶인 말은 첫 캐릭터의 것)
//   아무도 답할 수 없으면(모두 오프라인) 줄에서 빼고, 누가 없었는지 방에 남겨요 → 줄에서 뺀 수
function mergeTurn(real, room, jobs, { regen = false, now = Date.now() } = {}) {
    const w = liveWorld(real), P = liveKey(w.persona), tz = name => { const p = livePhone(real, name); return p ? zoneOf(real, p) : ''; };
    const chars = room.members.filter(n => liveKey(n) !== P && w.phones?.[liveKey(n)]);
    const called = regen ? [] : mentionsIn(real, room.id).map(liveKey);
    // (a new answer asked for by hand: everyone, offline or not, and no waiting — Marinara's regenerate)
    const can = regen ? chars.map(liveKey) : groupCandidates(real, room.id, { now: new Date(now), tzOf: tz }).map(c => c.id).filter(k => !called.length || called.includes(k));
    const gone = new Set(jobs);
    w.queue.jobs = w.queue.jobs.filter(j => !gone.has(j));
    if (!can.length) {
        for (const n of chars) if (!called.length || called.includes(liveKey(n))) (room.away ||= {})[liveKey(n)] = now;
        return gone.size;
    }
    const names = can.map(k => chars.find(n => liveKey(n) === k)), job = enqueueJob(real, { kind: 'reply', owner: names[0], room: room.id, at: now });
    Object.assign(job, { merged: can, timed: true, picked: true, ...(called.length ? { called } : {}), ...(regen ? { regen: true } : {}) });
    const delay = regen ? 0 : mergedDelay(real, names, { mention: called.length > 0, now: new Date(now), tzOf: tz });
    if (delay > 0) job.notBefore = now + delay;
    return gone.size - 1;
}
// 단체방에서 한 사람이 답한 뒤: 그 답이 @이름으로 부른 사람이 다음에 답해요 (이번 차례에 이미 말한 사람은 빼고) → 줄 세우거나 앞당긴 수
function handOff(real, job, now = Date.now()) {
    const w = liveWorld(real), room = w?.messenger?.rooms?.[job.room];
    if (!w || !room || !isGroupRoom(real, room.id)) return 0;
    const me = liveKey(job.owner), turn = (room.turn ||= { spoke: [] });
    if (!turn.spoke.includes(me)) turn.spoke.push(me);
    const said = [];
    for (let i = (room.messages || []).length - 1; i >= 0 && liveKey(room.messages[i].from) === me; i--) if (room.messages[i].text) said.unshift(room.messages[i].text);
    const waiting = w.queue.jobs.filter(j => j.kind === 'reply' && j.state === 'waiting' && j.room === room.id && !j.regen && (!j.why || j.auto));
    const queue = [...turn.spoke.filter(k => k !== me), me, ...waiting.map(j => liveKey(j.owner)).filter(k => !turn.spoke.includes(k))];
    const r = groupHandoff(real, room.id, { queue, index: turn.spoke.length - 1, text: said.join('\n\n'), counted: !!job.auto, now: new Date(now), tzOf: name => { const p = livePhone(real, name); return p ? zoneOf(real, p) : ''; }, cards: cardsOf(room) });
    if (!r.changed) return 0;
    const next = r.queue.slice(turn.spoke.length), jobs = new Map(waiting.map(j => [liveKey(j.owner), j]));
    for (const k of r.mentioned) {
        if (jobs.has(k)) continue;
        const j = enqueueJob(real, { kind: 'reply', owner: room.members.find(x => liveKey(x) === k), room: room.id, at: now, ...(job.auto ? { why: `No new message from ${w.persona} was sent in this request; this is a proactive/autonomous turn. Do not write ${w.persona}'s side of the conversation.` } : {}) });
        j.timed = true; j.picked = true; if (job.auto) j.auto = true;
        if (r.delays[k] > 0) j.notBefore = now + r.delays[k];
        jobs.set(k, j);
    }
    // (the line for this room, in the new order; a queued reply that no longer fits the day's limit leaves it)
    const mine = new Set(jobs.values()), ordered = next.map(k => jobs.get(k)).filter(Boolean), at = w.queue.jobs.findIndex(j => mine.has(j));
    w.queue.jobs = w.queue.jobs.filter(j => !mine.has(j));
    w.queue.jobs.splice(at < 0 ? w.queue.jobs.length : Math.min(at, w.queue.jobs.length), 0, ...ordered);
    return r.mentioned.length;
}
export function holdReplies(real, now = Date.now()) {
    const w = liveWorld(real);
    if (!w) return 0;
    let held = 0;
    const gone = new Set(), timed = new Map();
    for (const j of w.queue.jobs) {
        if (j.kind !== 'reply' || j.state !== 'waiting' || j.timed) continue;
        const p = livePhone(real, j.owner), room = w.messenger?.rooms?.[j.room];
        // (I called someone with @: only they answer, sooner than usual — Marinara's mention scope and delay)
        const called = j.auto ? [] : mentionsIn(real, j.room);
        if (called.length && !called.some(n => liveKey(n) === liveKey(j.owner))) { gone.add(j); continue; }
        const delay = replyDelay(real, j.owner, { now: new Date(now), tz: p ? zoneOf(real, p) : '', kind: j.auto ? 'auto' : called.length ? 'mention' : 'direct' });
        // (offline, as Marinara does: no answer now. The room keeps who was away; they catch up when they are back, if
        // characters may write first)
        if (delay === null) { gone.add(j); if (j.auto) clearProgress(real, j.room); else if (room) (room.away ||= {})[liveKey(j.owner)] = now; continue; }
        j.timed = true;
        if (delay > 0) { j.notBefore = (j.at || now) + delay; if (j.notBefore > now) held++; } else delete j.notBefore;
        if (!j.auto) { if (!timed.has(j.room)) timed.set(j.room, new Map()); timed.get(j.room).set(j.id, { delayMs: delay }); }
    }
    if (gone.size) w.queue.jobs = w.queue.jobs.filter(j => !gone.has(j));
    // (a group room: the one with the shortest delay answers first — Marinara's orderConversationRespondersByDelay)
    for (const delays of timed.values()) {
        if (delays.size < 2) continue;
        const at = w.queue.jobs.map((j, i) => (delays.has(j.id) ? i : -1)).filter(i => i >= 0), byId = new Map(at.map(i => [w.queue.jobs[i].id, w.queue.jobs[i]]));
        orderConversationRespondersByDelay(at.map(i => w.queue.jobs[i].id), delays).forEach((id, n) => { w.queue.jobs[at[n]] = byId.get(id); });
    }
    return held;
}
// 늦게 올 답장: [{ owner, room, until (ms; 오프라인이면 null), away }]
export const liveReplyWait = (real, now = Date.now()) => (liveWorld(real)?.queue.jobs || []).filter(j => j.kind === 'reply' && j.state === 'waiting' && j.notBefore > now).map(j => ({ owner: j.owner, room: j.room, until: j.notBefore, away: false }));
// 오프라인이라 답하지 않은 사람들 (마리나라의 "offline" 알림): [{ owner, at }]. 그 사람이 다시 말하면 없어져요
export const liveAway = (real, roomId) => { const w = liveWorld(real), room = w?.messenger?.rooms?.[roomId]; return Object.entries(room?.away || {}).map(([k, at]) => ({ owner: room.members.find(n => liveKey(n) === k) || k, at })); };
// 지금 상태 { status, activity } | null · 스케줄 (마리나라의 WeekSchedule) | null
export const liveStatus = (real, owner) => { const p = livePhone(real, owner); return statusNow(real, owner, { tz: p ? zoneOf(real, p) : '' }); };
export const liveSchedule = (real, owner) => scheduleOf(real, owner);
export const livePresence = real => (liveWorld(real) ? presenceOf(real) : null);
// 스케줄 만들기 (모델을 불러요). opts: { guidance, mode: 'rewrite'|'adjust'|'vary'|'repair', day: 'Monday'… (그날만) } → 스케줄
export async function liveMakeSchedule(real, owner, opts = {}) {
    const p = livePhone(mine(real), owner);
    if (!p) throw new Error('그 사람의 폰이 없어요');
    const card = await cardOf(p);
    const ask = askVia(real, opts.connectionId);
    const out = await makeSchedule(real, p.owner, { ...opts, ask, name: p.owner, description: String(card || ''), personality: '', tz: zoneOf(real, p) });
    // (where each thing on it happens: asked once here, kept on the blocks. A failure leaves the schedule without places)
    try { await fillPlaces(real, p.owner, { ask, parse: t => parseJson(t, { salvage: true }), card, places: knownPlaces(p) }); } catch (err) { console.warn('[narrative-archive] schedule places', err); }
    delete p.schedAt;
    if (open(real)) { followSchedule(real); await saveMeta(); }
    return out;
}
const ownerRow = p => (p.where?.people || []).find(x => nameKey(x?.name) === nameKey(p.owner)) || null;
const knownPlaces = p => [ownerRow(p)?.place, ownerRow(p)?.city, ...(p.where?.people || []).map(x => x?.place)].filter(Boolean);
// 스케줄 블록이 바뀌었으면 그 사람의 폰이 따라가요 (모델을 안 불러요): 상태(p.schedState: 답장 요청의 NOW가 읽어요)와,
// 블록에 장소가 있으면 위치 정보의 주인 줄 → 바뀐 폰의 수. 저장은 부르는 쪽이 해요
export function followSchedule(real, now = Date.now()) {
    const w = liveWorld(real);
    if (!w) return 0;
    let n = 0;
    for (const p of Object.values(w.phones || {})) {
        if (!p?.owner) continue;
        const at = stateNow(real, p.owner, { now: new Date(now), tz: zoneOf(real, p) });
        if (!at || p.schedAt === at.key) continue;
        p.schedAt = at.key; p.schedState = { text: at.text, at: now };
        const place = at.place;
        if (place) {
            const row = ownerRow(p);
            if (row) row.place = place;
            else p.where = { ...(p.where || { at: now }), people: [...(p.where?.people || []), { name: p.owner, place }] };
        }
        n++;
    }
    return n;
}
// ---- 마리나라의 스케줄 편집 창이 부르던 요청들 (phone2sched.js → src/marinara/schedule-routes.js)
// 생성 연결 (마리나라의 connectionId): 스케줄을 만들 때 쓸 연결을 골라요. 목록은 liveModelConnections와 같아요 (이름은 모델 이름). '' = 기본 연결,
// 'profile:<id>' = 실리 연결 프로필. 고른 것은 w.presence.meta.scheduleConnectionId에 남아요
export const liveConnections = () => liveModelConnections().map(c => ({ ...c, id: c.id === 'dr' ? '' : c.id }));
export const liveScheduleConnection = real => { const id = String(liveWorld(real)?.presence?.meta?.scheduleConnectionId || ''); return liveConnections().some(c => c.id === id) ? id : ''; };
export async function liveSetScheduleConnection(real, id = '') {
    if (!liveConnections().some(c => c.id === id)) throw new Error('없는 연결이에요');
    const meta = presenceOf(mine(real)).meta;
    if (id) meta.scheduleConnectionId = id; else delete meta.scheduleConnectionId;
    await saveMeta();
    return id;
}
// (connectionId: the one asked for with the request, else the one chosen for schedules)
const askVia = (real, connectionId) => async (messages, o) => {
    const id = connectionId === undefined || connectionId === null ? liveScheduleConnection(real) : String(connectionId);
    const system = messages.filter(x => x.role === 'system').map(x => x.content).join('\n\n'), input = messages.filter(x => x.role !== 'system').map(x => x.content).join('\n\n');
    // (what Marinara asks for with each request: its temperature (0.45 repair … 0.9 vary) and, for the routine summary, low reasoning)
    const how = { force: true, system, maxTokens: o?.maxTokens, effort: o?.reasoningEffort || '', signal: o?.signal || null, temperature: typeof o?.temperature === 'number' ? o.temperature : null, topP: typeof o?.topP === 'number' ? o.topP : null };
    if (!id) return askDraft(input, how);
    if (id === 'ai') return askAI(input, { ...how, noFallback: true });
    const p = aiProfiles().find(x => `profile:${x.id}` === id);
    if (!p) throw new Error('고른 연결 프로필을 찾을 수 없어요');
    const r = await ctx().ConnectionManagerRequestService.sendRequest(p.id, [...(system ? [{ role: 'system', content: system }] : []), { role: 'user', content: input }], Math.max(256, Number(o?.maxTokens) || 8192), { stream: false, extractData: true, includePreset: true, includeInstruct: true, ...(o?.signal ? { signal: o.signal } : {}) });
    const out = stripThink(typeof r === 'string' ? r : r?.content);
    if (!out) throw new Error('모델이 빈 답을 돌려줬어요');
    return out;
};
// (Marinara reads the card's description and personality: SillyTavern's own fields when the character is there, else our card text)
const cardData = async p => { const c = ctx().characters?.find(x => liveKey(x?.name) === liveKey(p.owner)), d = c?.data || c || {}; return String(d.description || '').trim() ? { name: p.owner, description: String(d.description).trim(), personality: String(d.personality || '').trim() } : { name: p.owner, description: String(await cardOf(p) || ''), personality: '' }; };
// 스케줄의 시간대 ('' = 사람마다 폰의 시간대) · 바꾸기 (tz '' 이면 풀기) · 그 사람의 스케줄이 쓰는 시간대
export const liveScheduleZone = real => scheduleZone(real);
export const liveSetScheduleZone = async (real, tz) => { const out = setScheduleZone(mine(real), tz); for (const p of Object.values(liveWorld(real).phones || {})) delete p.schedAt; followSchedule(real); await saveMeta(); return out; };
export const liveTimeZone = (real, owner) => { const p = livePhone(real, owner); return p ? zoneOf(real, p) : scheduleZone(real); };
// 초안 만들기: 저장하지 않고 결과만 돌려줘요 (마리나라의 /schedule/draft)
//   opts: { mode: 'week' | 'day', day, schedule (지금 초안), guidance, dayGuidance, draftMode: 'rewrite'|'adjust'|'vary'|'repair', signal }
//   → mode 'week': { schedule } · mode 'day': { day, blocks, weekStart }. 실패한 오류에는 rawResponse(모델의 답 원문)가 있어요
export async function liveDraftSchedule(real, owner, opts = {}) {
    const p = livePhone(mine(real), owner);
    if (!p) throw new Error('그 사람의 폰이 없어요');
    const { connectionId, ...rest } = opts;
    return draftSchedule(real, { ...rest, ask: askVia(real, connectionId), charData: await cardData(p), timeZone: zoneOf(real, p) });
}
// 루틴 요약: 저장하지 않고 결과만 (마리나라의 /schedule/summary) → { summary, generatedAt }
export async function liveScheduleSummary(real, owner, { schedule, guidance = '', signal, connectionId } = {}) {
    const p = livePhone(mine(real), owner);
    if (!p) throw new Error('그 사람의 폰이 없어요');
    return summarizeSchedule(real, { schedule, guidance, signal, ask: askVia(real, connectionId), charData: await cardData(p) });
}
// 실패한 답을 손으로 고친 글 → 고쳐진 초안 (못 읽으면 오류). day를 주면 그날만
export const liveRepairSchedule = (text, current, day = '') => repairSchedule(text, current, day);
// 매주 갱신 켜기 · 끄기, 그 사람의 스케줄 사정 { autoRenew, needsRefresh (이번 주 것이 아님), timeZone }
export const liveSetAutoRenew = async (real, owner, on) => { const out = setAutoRenew(mine(real), owner, on); await flushCards(); await saveMeta(); return out; };
export const liveScheduleInfo = (real, owner) => { const p = livePhone(real, owner), tz = p ? zoneOf(real, p) : ''; return { autoRenew: autoRenewOf(real, owner), needsRefresh: needsRefresh(real, owner, { tz }), timeZone: tz }; };
// 갱신 (마리나라의 /schedule/generate): 지난 스케줄을 이어받아 새 주 것을 만들어 넣어요 (모델을 불러요)
//   opts: { owners (없으면 스케줄이 있는 사람 전부), automatic: 매주 갱신을 켠 사람만 (갱신이 필요할 때), forceRefresh, guidance, signal }
//   → { 이름: 'generated' | 'fresh' | 'renewal_disabled' | 'error: …' }
export async function liveRenewSchedules(real, { owners = null, automatic = false, forceRefresh = false, guidance = '', signal, connectionId } = {}) {
    const askSched = askVia(real, connectionId);
    const w = liveWorld(mine(real)), phones = Object.values(w.phones || {}).filter(p => p?.owner && (owners ? owners.some(n => liveKey(n) === liveKey(p.owner)) : scheduleOf(real, p.owner)));
    // (the weekly renewal: nothing is asked when nobody's week has turned)
    const due = automatic ? phones.filter(p => autoRenewOf(real, p.owner) && needsRefresh(real, p.owner, { tz: zoneOf(real, p) })) : phones;
    if (!due.length) return {};
    const cards = {};
    for (const p of due) cards[liveKey(p.owner)] = await cardData(p);
    const out = await renewSchedules(real, { ask: askSched, owners: due.map(p => p.owner), cards, automatic, forceRefresh, guidance, timeZone: scheduleZone(real) || undefined, signal });
    const done = {};
    for (const p of due) {
        const r = out.results[liveKey(p.owner)];
        done[p.owner] = r?.status || 'not_found';
        if (r?.status !== 'generated') continue;
        try { await fillPlaces(real, p.owner, { ask: askSched, parse: t => parseJson(t, { salvage: true }), card: cards[liveKey(p.owner)].description, places: knownPlaces(p) }); } catch (err) { console.warn('[narrative-archive] schedule places', err); }
        delete p.schedAt;
    }
    await flushCards();
    if (open(real)) { followSchedule(real); await saveMeta(); }
    return done;
}
// 늦게 올 답장을 지금 받기: 그 방(owner를 주면 그 사람만)의 기다리는 답장을 바로 돌릴 수 있게 해요 → 푼 수. 그 뒤 liveGo
export async function liveReplyNow(real, roomId, owner = '') {
    let n = 0;
    for (const j of liveWorld(mine(real)).queue.jobs) {
        if (j.kind !== 'reply' || j.state !== 'waiting' || j.room !== roomId || (owner && liveKey(j.owner) !== liveKey(owner)) || !(j.notBefore > Date.now())) continue;
        delete j.notBefore; delete j.away; j.timed = true; n++;
    }
    if (n) await saveMeta();
    return n;
}
// 스케줄 손으로 넣기 · 지우기(null), 손으로 상태 주기({ status, activity, minutes } · {} 풀기), 내 상태, 먼저 말 걸기 켜기
export async function liveSetSchedule(real, owner, schedule) {
    const out = setSchedule(mine(real), owner, schedule), p = livePhone(real, owner);
    // (things to do that the places were not asked for yet: asked now, once. A failure leaves them without a place)
    const acts = out ? [...new Set(Object.values(out.days).flatMap(d => (Array.isArray(d) ? d : []).map(b => String(b?.activity || '').trim().toLowerCase())).filter(Boolean))].sort().join('|') : '';
    if (out && p && acts && out.placedFor !== acts) {
        try { await fillPlaces(real, p.owner, { ask: askVia(real), parse: t => parseJson(t, { salvage: true }), card: await cardOf(p), places: knownPlaces(p) }); out.placedFor = acts; } catch (err) { console.warn('[narrative-archive] schedule places', err); }
    }
    if (p) delete p.schedAt;
    await flushCards();
    if (open(real)) { followSchedule(real); await saveMeta(); }
    return out;
}
export const liveSetStatus = async (real, owner, o = {}) => { const out = setStatusOverride(mine(real), owner, o); for (const j of liveWorld(real).queue.jobs) if (j.state === 'waiting' && liveKey(j.owner) === liveKey(owner)) { delete j.timed; delete j.notBefore; } await flushCards(); await saveMeta(); return out; };
export const liveSetUserStatus = async (real, o = {}) => { const out = setUserStatus(mine(real), o); await saveMeta(); return out; };
export const liveSetAutonomous = async (real, on) => { const out = setAutonomous(mine(real), on); await saveMeta(); return out; };
// 스케줄 쓰기 켜고 끄기 (마리나라의 conversationSchedulesEnabled): 끄면 스케줄은 남아 있고 상태 · 늦음 · 먼저 말 걸기가 안 읽어요
export const liveSchedulesOn = real => schedulesOn(real);
export const liveSetSchedulesOn = async (real, on) => { const out = setSchedulesOn(mine(real), on); for (const p of Object.values(liveWorld(real).phones || {})) delete p.schedAt; followSchedule(real); await saveMeta(); return out; };
// 스케줄 내보내기 → 파일에 쓸 객체 · 가져오기(파일에서 읽은 값) → { ok: true, schedule } | { ok: false, reason } (저장은 liveSetSchedule로)
export const liveExportSchedule = (real, owner) => exportSchedule(real, owner);
export const liveImportSchedule = value => importSchedule(value);
// 먼저 말 걸기의 방 전체 설정 (마리나라의 열쇠 그대로, 준 것만 바꿔요) → { on, autonomousDailyCapOverride, groupChatMode, characterExchanges }
//   { autonomousDailyCapOverride: 하루 상한 (수 · null), groupChatMode: 'individual' (단체방에서 하루 상한을 같이 써요) · null, characterExchanges: 캐릭터끼리 주고받기 }
export const liveAutonomousOptions = real => autonomousOptions(real);
export const liveSetAutonomousOptions = async (real, o = {}) => { const out = setAutonomousOptions(mine(real), o); await saveMeta(); return out; };
const cardsOf = room => { const cards = {}; for (const name of room.members) { const c = ctx().characters?.find(x => liveKey(x?.name) === liveKey(name)); if (c) cards[liveKey(name)] = c.data || c; } return cards; };
// 단체방에서 한 캐릭터가 답한 뒤: 다른 캐릭터가 거기에 답할 때면(마리나라의 판단) 그 답장을 줄 세워요 → 줄 세운 이름 | ''
function exchangeAfter(real, job) {
    const w = liveWorld(real), room = w?.messenger?.rooms?.[job.room];
    if (!w || !room || !w.presence?.meta?.characterExchanges) return '';
    if (w.queue.jobs.some(j => j.room === room.id && j.kind === 'reply' && j.state === 'waiting')) return '';
    const r = checkExchangeFor(real, room.id, job.owner, { tzOf: name => { const p = livePhone(real, name); return p ? zoneOf(real, p) : ''; }, cards: cardsOf(room) });
    const k = r.shouldTrigger ? r.characterIds?.[0] : null, name = k && room.members.find(x => liveKey(x) === k);
    if (!name) return '';
    const next = enqueueJob(real, { kind: 'reply', owner: name, room: room.id, why: `No new message from ${w.persona} was sent in this request; this is a proactive/autonomous turn. Do not write ${w.persona}'s side of the conversation.` });
    // (Marinara: a short delay to feel natural, then the exchange; no presence delay on it)
    next.auto = true; next.timed = true; next.notBefore = Date.now() + 2000 + Math.random() * 3000;
    return name;
}
// (Marinara's server-autonomous-scheduler: AUTONOMOUS_FAILURE_BASE_BACKOFF_MS · AUTONOMOUS_FAILURE_MAX_BACKOFF_MS)
const AUTO_FAIL = { base: 5 * 60_000, max: 60 * 60_000 };
// 30초마다: 먼저 말 걸 때가 된 방이 있으면 그 답장을 줄 세워요 → 줄 세운 수. 그 뒤 liveGo가 돌려요
export async function liveAutonomous(real, { now = Date.now() } = {}) {
    const w = liveWorld(real);
    if (!w || !open(real)) return 0;
    // (a schedule block that began: the phones follow it, whether or not characters write first)
    if (followSchedule(real, now) + purgeTrash(real, now)) await saveMeta();
    if (!w.presence?.on) return 0;
    let n = 0;
    for (const room of Object.values(w.messenger?.rooms || {})) {
        if (w.queue.jobs.some(j => j.room === room.id && j.kind === 'reply' && (j.state === 'waiting' || j.state === 'running'))) continue;
        if (room.autoFail?.nextAllowedAt > now) continue;
        const cards = cardsOf(room);
        const r = checkProactive(real, room.id, { now: new Date(now), tzOf: name => { const p = livePhone(real, name); return p ? zoneOf(real, p) : ''; }, cards });
        const k = r.shouldTrigger ? r.characterIds?.[0] : null, name = k && room.members.find(x => liveKey(x) === k);
        if (!name) continue;
        const job = enqueueJob(real, { kind: 'reply', owner: name, room: room.id, at: now, why: r.autonomousIntent || 'You have a free moment.' });
        job.auto = true; room.turn = { spoke: [] };
        if (r.autonomousIntentKey) job.intent = r.autonomousIntentKey;
        n++;
    }
    if (n) await saveMeta();
    return n;
}

// 메신저를 나갈 때: what was said on the messenger since the last time goes into the owner's 폰 2 (as many rounds as it
// takes, LIVE_GO.rounds at most). Nothing to read: no model call. A reply still on its way: not now (its talk is read
// whole the next time). A failure leaves the phone as it was and says why on it (p.liveReflectError); the messages stay
// unread for the next time. Returns { rounds, left, waiting, error } (held: true when it waits after 되돌리기)
const reflecting = new WeakSet();
export async function liveReflect(real, owner, o = {}) {
    const out = await reflectTalk(real, owner, o);
    // (then the old talk of the owner's rooms, when it is time: phone2digest.js)
    try { await liveDigest(real, owner); } catch (err) { console.error('[narrative-archive] live digest', err); }
    return out;
}
async function reflectTalk(real, owner, { onChange = () => {}, force = false } = {}) {
    const w = liveWorld(real), p = livePhone(real, owner), none = { rounds: 0, left: 0, waiting: false, error: '' };
    if (!w || !p || reflecting.has(real)) return none;
    if (!liveUnreflected(real, owner)) return none;
    // (after 되돌리기 the messages wait for new talk; force: the user asks for them now)
    if (!force && Number.isInteger(p.liveHeld) && !Object.values(w.messenger?.rooms || {}).some(r => r.members.some(n => liveKey(n) === liveKey(owner)) && (r.messages || []).some(x => x.n > p.liveHeld && liveReads(x, owner)))) return { ...none, left: liveUnreflected(real, owner), held: true };
    if ((w.queue?.jobs || []).some(j => liveKey(j.owner) === liveKey(owner) && (j.state === 'waiting' || j.state === 'running'))) return { ...none, left: liveUnreflected(real, owner), waiting: true };
    const tell = () => { try { onChange(); } catch (err) { console.error('[narrative-archive] live draw', err); } };
    const m = () => liveMeta(real, { now: liveNowOf(real) });
    let rounds = 0, error = '';
    reflecting.add(real);
    try {
        const profile = await ownerProfileBlock(ctx(), p.financeProfile, p.owner, { money: !!(p.money || p.investment) });
        // (each round is saved, but the next round and the screen don't wait for it: saveLine)
        const line = saveLine();
        for (; rounds < LIVE_GO.rounds; rounds++) { if (!here(real, w) || !await updateLive(real, m(), p.owner, { tz: tzOf(p), save: line.save, profile, alive: () => open(real) })) break; tell(); }
        if (p.liveReflectError && here(real, w)) { delete p.liveReflectError; await line.save(); }
        await line.done();
        // (롤플에 넣기 is on for this phone: what the round put in goes into the role-play's prompt)
        if (rounds && p.inject && open(real)) applyInjection();
    } catch (err) {
        console.error('[narrative-archive] live reflect', err);
        error = String(err?.message || err);
        if (here(real, w)) { p.liveReflectError = { at: Date.now(), why: error }; await saveMeta(); }
    } finally { reflecting.delete(real); }
    tell();
    return { rounds, left: here(real, w) ? liveUnreflected(real, owner) : 0, waiting: false, error };
}
// how many of the owner's messenger messages 폰 2 hasn't reflected yet (for a small label, if the screen wants one)
export const liveUnreflected = (real, owner) => { const w = liveWorld(real), p = livePhone(real, owner); if (!w || !p) return 0; const done = p.sync?.done || [], base = p.sync?.marks?.base?.index ?? (Number.isInteger(w.storyUpto) ? w.storyUpto : 0); return Object.values(w.messenger?.rooms || {}).filter(r => r.members.some(n => liveKey(n) === liveKey(owner))).flatMap(r => r.messages || []).filter(x => Number.isInteger(x.n) && x.n > base && liveReads(x, owner) && !done.some(([a, b]) => x.n >= a && x.n <= b)).length; };

// 방금 반영 되돌리기 (폰 2): can the owner's last round be taken back, and doing it. kept: what couldn't go back (said to
// the user as 폰 1 says it). After it the messages wait for new talk; liveReflect(real, owner, { force: true }) reads
// them again now. Throws what 폰 1's 되돌리기 throws (nothing to undo; the bank made again since)
// (only a round 폰 2 made itself: one that came with the copy of 폰 1's phone is not offered)
export const liveCanUndo = (real, owner) => { const p = livePhone(real, owner); return !!p?.syncUndo?.live && !!p.syncLast?.checked && p.sync?.rounds?.at(-1) === p.syncUndo.round; };
export async function liveUndo(real, owner, { onChange = () => {} } = {}) {
    const kept = await undoLive(real, liveMeta(real, { now: liveNowOf(real) }), owner, { save: saveMeta });
    try { onChange(); } catch (err) { console.error('[narrative-archive] live draw', err); }
    return kept;
}

// 오래된 대화 요약: the owner's rooms whose unsummarized talk has piled up get their oldest stretch summarized (the
// archive's short instruction, asked the way the archive's compression is: askCompress), up to LIVE_GO.digests stretches a go. A failure is noted on the room and
// tried again after new talk or an hour; the replies go on without it. A room's summary grown long has its older half
// made short too (the archive's digest instruction). Returns how many stretches were summarized
// one stretch's request, put together as the archive's compression puts its own (prompts.js compressParts: the rules in
// the system message when that setting is on, the closing check last, the language of the story's archive), with the
// messenger's own raw log, state note and size note: { system, prompt }
// size: the note saying how many sections (the scenes the model named, digestScenes; else by the raw log's length)
export const digestAsk = (w, chunk, tz, story = '', size = '') => { const raw = digestRaw(w, chunk.rows, tz); return compressParts(SHORT_PROMPT, { raw, from: String(chunk.from), to: String(chunk.to), state: DIGEST_STATE, archive: '' }, { text: story || '' }, '', size || digestSize(chunk, raw)); };
// 장면 나누기: where the stretch's talk turns, asked as the archive asks it (its own instruction with the messenger's
// numbers, the AI 기능 모델); the note for the summary request, or '' when it can't be had (the summary goes on without)
export async function digestScenes(w, chunk, tz) {
    const sys = scenesSystem(SCENES_SYS);
    if (!sys) return '';
    try { return scenesNote(chunk, parseScenes(await askAI(scenesInput(chunk, digestRaw(w, chunk.rows, tz)), { system: sys, maxTokens: 4000 }), chunk.from, chunk.to)) || ''; }
    catch (err) { console.warn('[narrative-archive] live digest scenes', err); return ''; }
}
const digesting = new WeakSet();
export async function liveDigest(real, owner) {
    const w = liveWorld(real), p = livePhone(real, owner);
    if (!w || !p || digesting.has(real)) return 0;
    let done = 0, failures = 0;
    digesting.add(real);
    try {
        for (; done < LIVE_GO.digests; ) {
            const next = digestDue(real, owner)[0];
            if (!next || !here(real, w)) break;
            const { room, chunk } = next, story = liveStoryText(real, w);
            // (asked as the archive's compression asks: the request put together the same way, the same thinking level,
            // room and refusal check; a stretch refused whole goes again as two halves, as a blocked part does there)
            const ask = async c => { const q = digestAsk(w, c, tzOf(p), story, await digestScenes(w, c, tzOf(p))); return stripThink(await askCompress(q.prompt, { system: q.system, keepSystem: !!q.system, guard: SECTION_GUARD })); };
            let answer;
            try {
                try { answer = await ask(chunk); }
                catch (err) {
                    if (!isBlocked(err) || chunk.rows.length < 4) throw err;
                    const [a, b] = digestHalves(chunk), first = await ask(a);
                    if (!here(real, w)) break;
                    // (an answer with no scene in it: noted on the room by takeDigest; the other rooms still get their turn)
                    if (!takeDigest(room, a, first)) { await saveMeta(); if (++failures >= 3) break; continue; }
                    await saveMeta();
                    answer = await ask(b);
                    if (!here(real, w)) break;
                    const keptB = takeDigest(room, b, answer);
                    await saveMeta();
                    if (!keptB) { if (++failures >= 3) break; continue; }
                    done++;
                    continue;
                }
            } catch (err) {
                // (noted on the room, which then waits; the owner's other rooms and the fold still get their turn)
                console.error('[narrative-archive] live digest', err);
                if (!here(real, w)) break;
                failDigest(room, err?.message || err); await saveMeta();
                if (++failures >= 3) break;
                continue;
            }
            if (!here(real, w)) break;
            const kept = takeDigest(room, chunk, answer);
            await saveMeta();
            if (!kept) { if (++failures >= 3) break; continue; }
            done++;
        }
        // 요약의 요약: one room whose summary has grown long has its older half made short (one a go)
        const long = here(real, w) ? Object.values(w.messenger?.rooms || {}).filter(r => r.members.some(n => liveKey(n) === liveKey(owner))).map(room => ({ room, chunk: foldChunk(room) })).find(x => x.chunk) : null;
        if (long) {
            let answer;
            try {
                const story = liveStoryText(real, w);
                answer = stripThink(await askCompress(foldRequest(long.chunk, story ? langBlock(story, { tail: false, src: '' }) : ''), { system: AI_SYS_DIGEST }));
            } catch (err) { console.error('[narrative-archive] live fold', err); if (here(real, w)) { failFold(long.room, err?.message || err); await saveMeta(); } return done; }
            if (here(real, w)) { takeFold(long.room, long.chunk, answer); await saveMeta(); }
        }
    } finally { digesting.delete(real); }
    return done;
}

// ---- 메신저에서 나눈 이야기를 롤플에 전하기 (phone2back.js). 사람이 버튼을 눌렀을 때만 해요: 받은 글을 보여 주고
// (고칠 수 있어요), "넣기"를 눌러야 롤플 채팅에 들어가요.
// 아직 롤플에 안 전한 말 수 (화면의 버튼)
export const liveBackCount = real => { const left = backLeft(liveWorld(real)); return left.count + left.more; };
// 1) 전할 글 받기 (모델 요청 1번). 아무것도 바꾸지 않아요
//   → { world, left (실은 말들: 넣을 때 표시해요), text (넣을 메시지의 글 전체), count, more (이번에 못 실은 말 수) }
export async function liveBackDraft(real) {
    const w = liveWorld(real);
    if (!w || !open(real)) throw new Error('이 채팅의 실시간 폰이 아니에요');
    const left = backLeft(w);
    if (!left.count) throw new Error('롤플에 전할 새 메신저 대화가 없어요');
    const first = Object.values(w.phones || {}).find(p => p?.owner), tz = first ? tzOf(first) : 'UTC';
    // (the role-play's last messages, whole ones from the end: the note is written in their language)
    const tail = [];
    let room = BACK.tail.chars;
    for (const t of liveChatTail().lines.slice(-BACK.tail.lines).reverse()) { if (t.length > room) break; tail.unshift(t); room -= t.length; }
    const input = backInput(w, left, { wall: ms => liveWall(tz, w.dayShift, ms).at, tail });
    const answer = await askDraft(input, { force: true, system: phone2BackSystem({ persona: w.persona }), maxTokens: BACK.tokens, effort: 'low' });
    return { world: w.id, left, text: backMessage(takeBack(answer, x => parseJson(x, { salvage: true }))), count: left.count, more: left.more };
}
// 2) 넣기: 롤플 채팅 맨 끝에 해설 메시지 하나로 (실리의 /sys가 넣는 것과 같은 모양), 실었던 말에 전했다고 표시.
//    text: 사람이 고친 글 (안 주면 받은 글 그대로). 그사이 다른 채팅이 열렸거나 실시간 폰이 바뀌었으면 아무것도 안 해요
//   → 넣은 메시지의 번호
export async function liveBackPut(real, draft, text = draft?.text) {
    const w = liveWorld(real), c = ctx(), words = String(text ?? '').trim();
    if (!w || !open(real) || w.id !== draft?.world) throw new Error('그사이 채팅이나 실시간 폰이 바뀌었어요. 다시 해 주세요');
    if (!words) throw new Error('넣을 글이 비어 있어요');
    if (!Array.isArray(c.chat) || typeof c.addOneMessage !== 'function' || typeof c.saveChat !== 'function') throw new Error('이 실리에서는 롤플 채팅에 넣을 수 없어요');
    const message = { name: c.chatMetadata?.narrator_name || 'System', is_user: false, is_system: false,
        send_date: typeof c.humanizedDateTime === 'function' ? c.humanizedDateTime() : new Date().toISOString(),
        mes: words, force_avatar: 'img/five.png', extra: { type: 'narrator', gen_id: Date.now(), api: 'manual', model: 'narrative-archive' } };
    c.chat.push(message);
    const at = c.chat.length - 1, emit = async name => { try { if (name && c.eventSource?.emit) await c.eventSource.emit(name, at); } catch (err) { console.warn('[narrative-archive] live back', err); } };
    await emit(c.eventTypes?.MESSAGE_SENT);
    c.addOneMessage(message);
    await emit(c.eventTypes?.USER_MESSAGE_RENDERED);
    // (the talk is marked told once the message stands in the chat; then both are saved)
    markTold(draft.left);
    await c.saveChat();
    await saveMeta();
    return at;
}

// ---- 메신저 모양으로 쓴 채팅을 실시간 폰의 메신저로 통째로 가져오기 (phone2import.js). 사람이 버튼을 눌렀을 때만 해요.
// 두 가지 길이에요. 한 번 가져온 채팅은 그 뒤에 온 메시지만 다시 가져와요 (채팅마다 따로 적어요).
//   열어 둔 채팅에서: 메신저 메시지만 (캐릭터 메시지는 시간 칸이 있는 것). 장면이 섞인 채팅도 괜찮아요
//   내보낸 채팅 파일(.jsonl)에서: 그 파일의 메시지 전부. 파일을 고른 것이 "메신저로만 쓴 채팅"이라는 말이에요
const orderOf = real => (real?.dateOrder === 'dm' ? 'dm' : 'md');
// what would come in from a chat: { rows, key, again (brought in before), any (messages there at all) }
function importFrom(real, chat, key, gate) {
    const had = importedOf(liveWorld(real), key), o = { after: had ? had.upto : -1, shift: had ? Number(had.shift) || 0 : 0, order: orderOf(real) };
    const rows = importRows(chat, { ...o, gate });
    return { rows, key, again: !!had, any: rows.length > 0 || importRows(chat, { ...o, gate: false }).length > 0 };
}
const openChat = real => { const c = ctx(), chat = Array.isArray(c.chat) ? c.chat : []; return importFrom(real, chat, chatKey(c.chatMetadata?.integrity, chat), true); };
const planOf = f => ({ messages: f.rows.length, bubbles: f.rows.reduce((n, r) => n + r.bubbles.length, 0), again: f.again });
// 열어 둔 채팅에서 가져올 수 있는 것: { messages (채팅 메시지 수), bubbles (말풍선 수), again (전에 가져온 적이 있는 채팅인지) }
export function liveImportPlan(real) { return real && open(real) ? planOf(openChat(real)) : { messages: 0, bubbles: 0, again: false }; }
// 고른 파일에서 가져올 수 있는 것 (파일의 글을 받아요): 위와 같은 모양에 names (그 파일에서 말한 캐릭터들)
export function liveImportFilePlan(real, text) {
    const file = importFile(text), f = importFrom(real, file.chat, file.key, false);
    return { ...planOf(f), names: [...new Set(f.rows.filter(r => !r.user && r.name).map(r => r.name))] };
}
// the rows into 폰 2, saved. With no 폰 2 yet, one begun fresh (no story) is made for them; a failure leaves nothing
async function bringIn(real, f, { persona = '', scope = '' } = {}) {
    if (!real || !open(real)) throw new Error('이 채팅이 열려 있지 않아요');
    if (!f.rows.length) throw new Error(f.again ? '새로 가져올 메시지가 없어요' : '가져올 메시지가 없어요');
    const w = liveWorld(real), had = real.live === undefined ? undefined : structuredClone(real.live), name = String(persona || ctx().name1 || '').trim();
    try {
        if (!w) { if (!name) throw new Error('페르소나 이름이 필요해요'); startFresh(real, { persona: name, scope }); }
        const out = importInto(real, f.rows, { chat: f.key });
        await saveMeta();
        return { ...out, started: !w };
    } catch (err) { if (had === undefined) delete real.live; else real.live = had; throw err; }
}
// 열어 둔 채팅에서 가져오기. 실시간 폰이 아직 없으면 이야기 없이 처음부터 시작한 폰을 만들어요(persona: 페르소나 이름,
// scope: 이 채팅). 모델은 부르지 않아요
//   → { room, count (말풍선 수), messages, from, to, started (실시간 폰을 새로 만들었는지) }
export async function liveImportChat(real, opts = {}) {
    if (!real || !open(real)) throw new Error('이 채팅이 열려 있지 않아요');
    const f = openChat(real);
    // (messages there, but none the messenger's: a chat of scenes, not of texts)
    if (!f.rows.length && f.any) throw new Error('메신저 모양으로 쓴 메시지가 없어요 (맨 위에 시간 칸이 있는 캐릭터 메시지를 가져와요)');
    return bringIn(real, f, opts);
}
// 내보낸 채팅 파일(.jsonl)에서 가져오기: 그 파일의 메시지 전부(숨긴 것 · 해설만 빼고)를 지금 열어 둔 채팅의 실시간 폰으로.
// text: 파일의 글 (브라우저에서 읽은 것; 어디로도 안 보내요)
export async function liveImportFile(real, text, opts = {}) {
    if (!real || !open(real)) throw new Error('이 채팅이 열려 있지 않아요');
    const file = importFile(text);
    return bringIn(real, importFrom(real, file.chat, file.key, false), opts);
}

// ---- 메신저의 말 고치기 (phone2edit.js). 사람이 눌렀을 때만 해요.
// 말 지우기 (ids: 말의 id 하나 또는 여럿) → 지운 수. 메신저에서만 지워요: 이미 폰에 반영된 것 · 롤플에 전한 것은 그대로예요
export async function liveDropMessages(real, roomId, ids) {
    if (!real || !open(real)) throw new Error('이 채팅이 열려 있지 않아요');
    const n = dropMessages(real, roomId, ids);
    if (n) forgetActivity(real, roomId);
    // (the answer shown is gone, every bubble of it: another one kept for that message shows)
    if (n) { settleSwipes(real, roomId); await saveMeta(); }
    return n;
}
// ---- 말 · 방 다루기 (phone2room.js). 사람이 눌렀을 때만 해요. 바뀐 것이 있으면 저장까지 해요.
const mine = real => { if (!real || !open(real)) throw new Error('이 채팅이 열려 있지 않아요'); return real; };
const kept = async v => { if (v) { await flushCards(); await saveMeta(); } return v; };
// 말의 표시 (마리나라의 열쇠 그대로, 준 것만 바꿔요) → 바뀐 말의 수
//   { hiddenFromAI: true|false, hiddenFromAICharacterIds: [이름] | null, pinnedToContext: true|false, bookmark: true | { label } | null, privateNote: 글 | null }
export const liveMark = async (real, roomId, ids, patch) => kept(markMessages(mine(real), roomId, ids, patch));
// 북마크 · 메모한 말 모아 보기 (roomId 없으면 모든 방) → [{ room, x, bookmark, note }]
export const liveMarked = (real, roomId = '') => markedMessages(real, roomId);
// 휴지통: 지운 말 보기 [{ x, at }] · 되살리기 · 비우기 (ids 없으면 전부) → 수
export const liveTrash = (real, roomId) => trashOf(real, roomId);
export async function liveRestore(real, roomId, ids) { const n = restoreMessages(mine(real), roomId, ids); if (n) { forgetActivity(real, roomId); settleSwipes(real, roomId); await saveMeta(); } return n; }
export const liveEmptyTrash = async (real, roomId, ids = null) => kept(emptyTrash(mine(real), roomId, ids));
// 방 지우기(휴지통으로) · 지운 방들 [{ room, at }] · 되살리기 · 아주 버리기 (roomId 없으면 전부)
export const liveDropRoom = async (real, roomId) => { forgetActivity(mine(real), roomId); return kept(dropRoom(real, roomId)); };
export const liveRoomTrash = real => roomTrash(real);
export const liveRestoreRoom = async (real, roomId) => kept(restoreRoom(mine(real), roomId));
export const liveEmptyRoomTrash = async (real, roomId = '') => kept(emptyRoomTrash(mine(real), roomId));
// 방에 사람 넣기 · 빼기 → 방
export const liveAddMember = async (real, roomId, name) => kept(addMember(mine(real), roomId, name));
export const liveRemoveMember = async (real, roomId, name) => kept(removeMember(mine(real), roomId, name));

// 말 고치기: 내 말이든 캐릭터 말이든 글을 바꿔요 ({ text } 원문, { ko } 한국어만, 둘 다도 돼요). 원문을 바꾸면 그 말의
// 한국어는 지워져요(다시 받으려면 liveRetranslate). 답장을 다시 받지는 않아요. 저장까지 해요  → 바뀐 그 말 (바뀐 게 없으면 null)
export async function liveEditMessage(real, roomId, msgId, change = {}) {
    if (!real || !open(real)) throw new Error('이 채팅이 열려 있지 않아요');
    const x = editMessage(real, roomId, msgId, change);
    if (x) await saveMeta();
    return x;
}
// 답장 넘기기(스와이프): 맨 끝 답장의 상태. 넘길 답장이 없으면 null
//   → { at (지금 몇 번째, 1부터), count (받아 둔 수), coming (답장이 오는 중), prev · next (그쪽으로 넘길 수 있는지) }
// (새 답장을 못 받았으면 여기서 앞의 답장을 다시 보여 줘요)
export function liveSwipeInfo(real, roomId) {
    if (!real || !open(real)) return null;
    try { settleSwipes(real, roomId); return swipeInfo(real, roomId); } catch { return null; }
}
// 넘기기 (dir: -1 앞 · +1 뒤). 받아 둔 답장이면 바로 바뀌고, 맨 뒤에서 한 번 더 넘기면 새 답장을 줄 세워요(fresh: true).
// 답장은 여기서 안 받아요: fresh면 화면이 말을 보낸 뒤처럼 liveGo를 불러요. 받아 둔 답장은 버리지 않아요.
//   → { at, count, fresh, jobs (줄 세운 답장 수) }
export async function liveSwipe(real, roomId, dir) {
    if (!real || !open(real)) throw new Error('이 채팅이 열려 있지 않아요');
    settleSwipes(real, roomId);
    // (a new answer asked for by hand: no waiting, and an owner who is offline answers too — Marinara's regenerate)
    const out = swipeTo(real, roomId, dir), made = out.fresh ? enqueueReplies(real, roomId) : [], jobs = made.length;
    for (const j of made) { j.timed = true; j.regen = true; }
    await saveMeta();
    return { ...out, jobs };
}
// 받아 둔 답장을 지우는 세 가지. 모두 { dropped (지운 답장 수), at, count (남은 수: 0이면 답장이 없어요) }를 돌려주고 저장해요.
// 보이는 답장을 지우면 남은 것 중 앞의 것(없으면 다음 것)이 보여요. 답장이 오는 중에는 못 지워요
async function swipeDrop(real, roomId, drop) {
    if (!real || !open(real)) throw new Error('이 채팅이 열려 있지 않아요');
    settleSwipes(real, roomId);
    const out = drop();
    if (out.dropped) await saveMeta();
    return out;
}
// 보이는 답장 하나 지우기
export const liveSwipeDrop = (real, roomId) => swipeDrop(real, roomId, () => dropSwipe(real, roomId));
// 고른 답장들 지우기 (nos: liveSwipeList의 번호 하나 또는 여럿)
export const liveSwipeDropMany = (real, roomId, nos) => swipeDrop(real, roomId, () => dropSwipes(real, roomId, nos));
// 지금 보이는 답장만 남기고 받아 둔 다른 답장을 모두 지우기
export const liveSwipeDropOthers = (real, roomId) => swipeDrop(real, roomId, () => dropOtherSwipes(real, roomId));
// 받아 둔 답장 목록: 번호순으로 [{ no (1부터, liveSwipeInfo의 at과 같은 번호), now (지금 보이는 것), bubbles: [{ text, ko }] }].
// 넘길 답장이 없으면 []. liveSwipeInfo와 같은 상태를 봐요 (그릴 때마다 불러도 돼요)
export function liveSwipeList(real, roomId) {
    if (!real || !open(real)) return [];
    try { settleSwipes(real, roomId); return swipeList(real, roomId); } catch { return []; }
}
// 한국어 다시 받기 (ids: 말의 id 하나 또는 여럿): 번역 모델에 다시 물어서 그 말들의 한국어만 바꿔요. 폰 1의 번역 지시문
// 그대로, 그 방 캐릭터의 말투 표 · 주변 인물 · 용어집을 같이 보내요. 실패하면 있던 한국어가 그대로예요.
//   → { count (바뀐 수), left (한 번에 다 못 해서 남은 수) }
export async function liveRetranslate(real, roomId, ids) {
    if (!real || !open(real)) throw new Error('이 채팅이 열려 있지 않아요');
    const w = liveWorld(real), { owner, rows, left } = koRows(real, roomId, ids);
    if (!rows.length) throw new Error('번역할 말이 없어요');
    const p = livePhone(real, owner), voices = p ? voiceRows(p).map(v => ({ who: voiceWho(v), style: v.style })) : [], entries = glossaryEntries(real);
    let count = 0;
    for (const chunk of koChunks(rows)) {
        const input = koInput(chunk.rows, { owner, around: p ? aroundBlock(p) : '', voices, gloss: glossaryIn(entries, chunk.rows.map(r => r.x.text).join('\n')) });
        const out = await askTranslator(input, { system: AI_SYS_PHONE_KO, maxTokens: Math.min(16384, 1500 + chunk.size * 3) });
        // (the 폰 2 a request began with is gone: its answer is not put anywhere)
        if (!here(real, w)) throw new Error('그사이 실시간 폰이 바뀌었어요');
        // (the object is the first { … } of the answer; an answer that can't be read changes nothing)
        let got = null;
        try { got = parseJson(String(out).replace(/^[^{]*/, '').replace(/[^}]*$/, ''), { salvage: true }); } catch { got = null; }
        count += takeKo(chunk.rows, got);
    }
    if (!count) throw new Error('번역을 받지 못했어요');
    await saveMeta();
    return { count, left };
}

// ---- 이모지 반응 (phone2react.js). 사람이 눌렀을 때만 해요.
// 반응 달기 · 바꾸기 · 지우기: by(방에 있는 사람)의 반응을 e로. 같은 걸 다시 달거나 e가 null(또는 '')이면 지워요.
// 이모지는 아무거나 되지만 한 덩어리만 (글자 · 여러 개는 안 돼요). 저장까지 해요  → 바뀐 그 말
// 내가 캐릭터의 최근 말(내 마지막 말 뒤에 온 말)에 달면 그 캐릭터의 답장을 줄 세워요: 화면이 이어서 liveGo를 불러요.
// 캐릭터는 말로 받거나, 이모지로 받거나, 그냥 넘겨요
export async function liveReact(real, roomId, msgId, by, e = null) {
    if (!real || !open(real)) throw new Error('이 채팅이 열려 있지 않아요');
    const { w, room, x } = messageOf(real, roomId, msgId);
    if (!room.members.some(n => liveKey(n) === liveKey(by))) throw new Error('이 방에 없는 사람이에요');
    if (x.act) throw new Error('반응을 달 수 없는 말이에요');
    const want = e === null || e === undefined || e === '' ? '' : emojiOf(e);
    if (!want && e) throw new Error('이모지 하나만 달 수 있어요');
    const had = reactOf(x, by)?.e || '', next = want && want !== had ? want : '';
    if (putReact(x, by, next)) {
        const mine = liveKey(by) === liveKey(w.persona);
        if (next && mine) { noteRecent(w, next); noteReaction(real, roomId); }
        // (the persona put an emoji on what a character just said and wrote nothing: the character gets to see it now
        // and answer it, react back or let it be. Only on the talk since the persona's last text; an emoji on older
        // talk waits for the next reply, where it shows as new. One already waiting for them here sees it too)
        if (next && mine && liveKey(x.from) !== liveKey(w.persona) && w.phones?.[liveKey(x.from)] && replyTail(real, roomId).includes(x)
            && !w.queue.jobs.some(j => j.state === 'waiting' && j.kind === 'reply' && liveKey(j.owner) === liveKey(x.from) && j.room === roomId))
            enqueueJob(real, { kind: 'reply', owner: x.from, room: roomId, why: `${w.persona} put ${next} on your text "${String(x.text || '').replace(/\s+/g, ' ').trim().slice(0, 120)}" just now and wrote nothing.` });
        await saveMeta();
    }
    return x;
}
// 바로 누르는 반응 줄: 페르소나가 최근에 쓴 이모지부터, 모자라면 ❤️ 😂 😮 😢 😡 👍로 채워서 6개
export const liveReactQuick = real => quickReacts(liveWorld(real));

// ---- 말에 답장 달기 (마리나라의 replyTo). 초안은 방마다 하나, 이 창이 열려 있는 동안만 있어요 (마리나라의 replyDrafts)
//   liveReplyTo(real, 방 id, 말 id, 골라 둔 글 '') → 초안 { messageId, name, content } · liveReplyDraft(real, 방 id) → 초안 | null · liveCancelReply
//   보낼 때: sendLive(m, 방 id, 글, undefined, { replyTo: liveReplyDraft(real, 방 id) }) 뒤 liveCancelReply. 보내기가 실패하면 초안을 그대로 둬요
//   보낸 말에는 x.extra.replyTo가 남아요 (화면: 내 말 위에 "Replying to 이름" + 인용 2줄)
const replyDrafts = new Map(), draftKey = (real, roomId) => `${liveWorld(real)?.id || ''}:${roomId}`;
export function liveReplyTo(real, roomId, messageId, selected = '') { const d = replyDraftOf(mine(real), roomId, messageId, selected); replyDrafts.set(draftKey(real, roomId), d); return d; }
export const liveReplyDraft = (real, roomId) => replyDrafts.get(draftKey(real, roomId)) || null;
export const liveCancelReply = (real, roomId) => replyDrafts.delete(draftKey(real, roomId));

// ---- 프롬프트 보기 (마리나라의 POST /chats/:id/peek-prompt 그대로): 저장된 요청이 있으면 그것을, 없으면 지금 보낼 요청을 보내지 않고 조립해서
//   opts.messageId: 그 말의 요청 (저장된 것이 없으면 오류) · opts.current: 저장된 것을 건너뛰고 지금 것을
//   → { messages: [{ role, content }], chatMode, parameters, source: 'cached' | 'live_preview', exact, characterId, generationInfo, agentNote }
export async function livePeekPrompt(real, roomId, { messageId = '', current = false } = {}) {
    const w = liveWorld(mine(real)), room = w.messenger?.rooms?.[roomId];
    if (!room) throw new Error('없는 방이에요');
    const P = liveKey(w.persona), id = !current && typeof messageId === 'string' ? messageId.trim() : '';
    const requested = id ? (room.messages || []).find(x => String(x.id) === id) || null : null;
    if (id && !requested) throw new Error('이 방에 없는 말이에요');
    const latestVisible = [...(room.messages || [])].reverse().find(x => !x.extra?.hiddenFromAI) || null, source = requested ?? latestVisible;
    if (source && liveKey(source.from) !== P && !current) {
        const cached = (Array.isArray(source.extra?.cachedPrompt) ? source.extra.cachedPrompt : []).filter(e => e && typeof e.role === 'string' && typeof e.content === 'string').map(e => ({ role: e.role, content: e.content }));
        if (cached.length) return {
            messages: cached, chatMode: 'conversation', parameters: null, source: 'cached', exact: true, characterId: liveKey(source.from),
            generationInfo: source.extra.generationInfo && typeof source.extra.generationInfo === 'object' ? source.extra.generationInfo : null, gameToolPlanning: null,
            agentNote: requested ? 'This is the exact cached text prompt sent for the selected turn.' : 'This is the cached text prompt saved after provider preparation for the active assistant swipe.',
        };
    }
    if (requested) throw new Error('이 말에는 저장된 요청이 없어요 (No exact saved prompt is available for this turn)');
    // (the live preview: what the next reply here would be sent with. Whoever would answer first; a Merged group as one request)
    const chars = room.members.filter(n => liveKey(n) !== P && w.phones?.[liveKey(n)]);
    if (!chars.length) throw new Error('이 방에는 답할 사람이 없어요');
    const merged = chars.length > 1 && groupMode(real) === 'merged';
    const req = await gatherJob(real, { world: w.id, kind: 'reply', owner: chars[0], room: roomId, ...(merged ? { merged: chars.map(liveKey) } : {}) });
    return {
        messages: req ? [...(req.system ? [{ role: 'system', content: req.system }] : []), { role: 'user', content: req.input }] : [],
        chatMode: 'conversation', parameters: null, source: 'live_preview', exact: false, characterId: liveKey(chars[0]), generationInfo: null,
        ...(current ? {} : { agentNote: 'No saved model request was available, so this is a live best-effort preview assembled without sending.' }),
    };
}

// ---- 여기서 분기 (마리나라의 branch): 그 말까지를 복사한 새 방을 만들어요 → 새 방의 id. 화면은 확인 창 뒤에 부르고 새 방으로 옮겨요
//   messageId를 안 주면 방 전체. 새 방의 room.branch = { name: 'New Branch', parentRoomId, parentMessageId, messageId }
export async function liveBranchRoom(real, roomId, messageId = '') { const room = branchRoom(mine(real), roomId, messageId); await saveMeta(); return room.id; }

// ---- 빠른 전환기 (마리나라의 QuickSwitcherMobile: 이 방이 쓸 모델 · 즐겨찾기 · 페르소나)
// 1) 이 방이 쓸 모델 (PUT /chats/:id/model 그대로). 방에 room.connectionId 와 room.model = { modelOverride, recentModels, followsMainModel } 로 남아요
//    고름(choice) = { connectionId, model?, name?, maxContext?, maxTokensOverride? }
//      connectionId: liveModelConnections()의 id
//      model: 그 연결의 키 · 주소로 다른 모델을 이 방에서만 돌려요 (마리나라의 catalog pick). 커스텀 API · Vertex 연결에서만 돼요
//    liveRoomModel(real, 방 id) → { current: 고름 | null (기본값을 따름), recent: [고름, 고름] (새것 먼저), followsMain }
//    liveSetRoomModel(real, 방 id, 고름 | null) → 위와 같은 값. null: 기본값으로 돌아가요 (마리나라의 "Use default")
// 연결 목록 (마리나라의 연결 줄 모양: { id, name, model, provider }). 키는 새로 받지 않아요: 확장에 넣어 둔 것과 실리의 것을 그대로 써요
//   이름은 모델 이름이에요 (확장 안쪽의 칸 이름은 화면에 내지 않아요 — 소망, 2026-11-21). 실리 연결 프로필은 그 프로필의 이름
//   id: 'dr' · 'ai' (확장에 넣어 둔 두 연결) · 'profile:<id>' (실리 연결 프로필). 안쪽에서만 쓰는 값이에요
const connRow = id => {
    const t = connSettings(id);
    if (t.mode === 'source') return { id, name: String(t.stModel || ''), model: String(t.stModel || ''), provider: stSourceName(t.source) };
    if (t.mode === 'vertex') return { id, name: String(t.vxModel || ''), model: String(t.vxModel || ''), provider: 'google_vertex' };
    if (t.mode === 'custom') return { id, name: String(t.model || ''), model: String(t.model || ''), provider: t.fmt === 'anthropic' ? 'anthropic' : 'custom' };
    // (SillyTavern's own connection: the model it is set to now)
    const c = ctx(), model = String((c.mainApi === 'openai' ? c.getChatCompletionModel?.() : '') || c.onlineStatus || '');
    return id === 'ai' ? { id, name: model, model, provider: String(c.mainApi || 'sillytavern') } : null;
};
export const liveModelConnections = () => [connRow('dr'), connRow('ai'), ...aiProfiles().map(p => ({ id: `profile:${p.id}`, name: String(p.name || p.id), model: String(p.model || ''), provider: String(p.api || '') }))].filter(Boolean);
const roomChat = room => ({ connectionId: room.connectionId || null, metadata: room.model || {} });
export function liveRoomModel(real, roomId) {
    const room = liveWorld(real)?.messenger?.rooms?.[roomId];
    if (!room) throw new Error('없는 방이에요');
    const chat = roomChat(room);
    return { current: chat.connectionId ? (readChatModelOverride(chat) ?? { connectionId: chat.connectionId }) : null, recent: readChatRecentModels(chat), followsMain: !chat.connectionId };
}
// (a connection id 'source:<id>': that SillyTavern source itself, with SillyTavern's key for it; it always carries a model)
const sourceOf = id => (String(id).startsWith('source:') ? String(id).slice(7) : '');
const slotOf = id => (id === 'dr' || id === 'ai' ? connSettings(id) : sourceOf(id) ? { mode: 'source', source: sourceOf(id), stModel: '' } : null);
const modelKey = slot => (slot.mode === 'vertex' ? 'vxModel' : slot.mode === 'source' ? 'stModel' : 'model');
export async function liveSetRoomModel(real, roomId, pick = null) {
    const room = liveWorld(mine(real)).messenger?.rooms?.[roomId];
    if (!room) throw new Error('없는 방이에요');
    let choice = null;
    if (pick && pick.connectionId !== null) {
        const parsed = chatModelChoiceSchema.safeParse(pick);
        if (!parsed.success) throw new Error('모델 고름을 읽지 못했어요');
        choice = parsed.data;
        const src = sourceOf(choice.connectionId);
        if (src ? !stSourceList().some(x => x.id === src) : !liveModelConnections().some(c => c.id === choice.connectionId)) throw new Error('없는 연결이에요 (Model not found)');
        const slot = slotOf(choice.connectionId), own = slot ? String(slot[modelKey(slot)] || '') : '';
        if (src && !choice.model) throw new Error('모델을 골라 주세요');
        // (a model of its own needs a connection we can name a model on: a SillyTavern source, a custom API or Vertex)
        if (choice.model && !(slot && OWN_MODES.includes(slot.mode))) throw new Error('이 연결에서는 모델을 따로 고를 수 없어요 (A chat needs a chat Model to run on.)');
        if (choice.model && own === choice.model) choice = { connectionId: choice.connectionId };
    }
    const chat = roomChat(room), previous = chat.connectionId ? (readChatModelOverride(chat) ?? { connectionId: chat.connectionId }) : null;
    if (choice) room.connectionId = choice.connectionId; else delete room.connectionId;
    room.model = { ...(room.model || {}), ...applyChatModelPatch({ choice, previous, stored: room.model?.[CHAT_RECENT_MODELS_KEY] }) };
    await saveMeta();
    return liveRoomModel(real, roomId);
}
// (a reply in a room with a model of its own goes there; with none, to the draft model as before)
async function askRoom(real, roomId, input, how) {
    const room = liveWorld(real)?.messenger?.rooms?.[roomId], chat = room ? roomChat(room) : null;
    const id = chat?.connectionId && (sourceOf(chat.connectionId) || liveModelConnections().some(c => c.id === chat.connectionId)) ? chat.connectionId : '';
    // (the thinking level set for this room, or for Orbit as a whole; else what the caller asks for)
    const rs = liveReasoning(real, roomId);
    if (rs.effort) how = { ...how, effort: rs.sent };
    if (!id) return askDraft(input, how);
    const slot = slotOf(id), override = readChatModelOverride(chat);
    if (slot && override && OWN_MODES.includes(slot.mode)) {
        // (Marinara's applyChatModelOverride: the override's model on that connection's key and endpoint)
        const conn = applyChatModelOverride({ ...slot, id }, override), t = { ...slot, [modelKey(slot)]: conn.model, ...(conn.maxTokensOverride ? { max: conn.maxTokensOverride } : {}) };
        const out = await callConn(t, how.system || '', input, Math.max(256, Number(how.maxTokens) || Number(t.max) || 16000), how.effort || '', true, false, how.signal || null, how.temperature ?? null, how.topP ?? null, how.meta || null);
        if (!out) throw new Error('모델이 빈 답을 돌려줬어요');
        return out;
    }
    if (id === 'dr') return askDraft(input, how);
    if (id === 'ai') return askAI(input, { ...how, noFallback: true });
    const p = aiProfiles().find(x => `profile:${x.id}` === id);
    if (!p) throw new Error('고른 연결 프로필을 찾을 수 없어요');
    const r = await ctx().ConnectionManagerRequestService.sendRequest(p.id, [...(how.system ? [{ role: 'system', content: how.system }] : []), { role: 'user', content: input }], Math.max(256, Number(how.maxTokens) || 8192), { stream: false, extractData: true, includePreset: true, includeInstruct: true, ...(how.signal ? { signal: how.signal } : {}) });
    const raw = typeof r === 'string' ? r : r?.content, out = stripThink(raw);
    if (how.meta) Object.assign(how.meta, { raw: String(raw ?? ''), model: String(p.model || p.name || ''), provider: String(p.api || 'profile') });
    if (!out) throw new Error('모델이 빈 답을 돌려줬어요');
    return out;
}
// 2) 즐겨찾기 (마리나라의 별: 순서가 있는 목록, 위 · 아래로 옮기기). 채팅과 상관없이 확장 설정에 남아요
//    liveStars() → [고름] · liveToggleStar(고름) → 켜졌나 · liveMoveStar(고름, -1 | 1) → 옮겼나
const starKey = c => `${c.connectionId}\n${c.model ?? ''}`;
const starStore = () => { const s = (ctx().extensionSettings[MODULE] ||= {}); if (!Array.isArray(s.orbitStars)) s.orbitStars = []; return s; };
export const liveStars = () => starStore().orbitStars.map(c => chatModelChoiceSchema.safeParse(c)).filter(r => r.success).map(r => r.data);
export function liveToggleStar(choice) {
    const parsed = chatModelChoiceSchema.safeParse(choice);
    if (!parsed.success) throw new Error('모델 고름을 읽지 못했어요');
    const s = starStore(), all = liveStars(), had = all.some(c => starKey(c) === starKey(parsed.data));
    s.orbitStars = (had ? all.filter(c => starKey(c) !== starKey(parsed.data)) : [...all, parsed.data]).slice(0, MAX_PINNED_MODELS);
    ctx().saveSettingsDebounced?.();
    return !had;
}
export function liveMoveStar(choice, by) {
    const all = liveStars(), next = reorderStars(all.map(starKey), starKey(choice), by < 0 ? -1 : 1);
    if (!next) return false;
    starStore().orbitStars = next.map(k => all.find(c => starKey(c) === k));
    ctx().saveSettingsDebounced?.();
    return true;
}
// 3) 페르소나 바꾸기: 실리의 페르소나를 바꿔요 (people.js stPersonaList()의 id). 실시간 폰의 "나"는 우리 쪽이 이름을 따라 바꿔요
export async function liveSwitchPersona(avatarId) {
    const id = String(avatarId || '');
    if (!id || !Object.hasOwn(ctx().powerUserSettings?.personas || {}, id)) throw new Error('없는 페르소나예요');
    const P = await import('/scripts/personas.js');
    await P.setUserAvatar(id);
    return true;
}

// ---- 연결 종류와 모델 불러오기 (실리가 가진 모든 연결 종류를, 실리에 넣어 둔 키와 설정 그대로)
//   liveSources() → [{ id, name }] (실리의 API 고르기에 있는 것 전부) · liveSourceModels(연결 종류 id) → [{ id, name }] (모델을 불러와요)
//   방의 모델로 고를 때: liveSetRoomModel(real, 방 id, { connectionId: 'source:<연결 종류 id>', model: '<모델 id>', name? })
export const liveSources = () => stSourceList();
export const liveSourceModels = source => stSourceModels(source);
// ---- 추론 레벨 (모델이 생각하는 정도): 방마다 정하거나 Orbit 전체에 정해요. 마리나라의 chatParameters.reasoningEffort 자리
//   고를 수 있는 레벨은 모델마다 달라요 (마리나라의 규칙 그대로: src/marinara/generation-parameter-relevance.js · model-lists.js)
//   값(마리나라가 저장하는 이름): '' (안 정함) · 'none' (끔) · 'low' · 'medium' · 'high' · 'xhigh' · 'maximum'
//   liveReasoning(real, 방 id '') → {
//     effort (실제로 쓰는 값: 방에 정한 것, 없으면 Orbit 전체 것), room, all,
//     choices: [{ value, label, name }] 이 방의 모델이 받는 레벨만 (마리나라 화면 그대로). name이 칩에 쓸 글자예요 (실제로 보내는 레벨의 이름)
//       value는 저장하는 값이라 칩 글자와 다를 수 있어요 (DeepSeek: 글자 '높게', value 'medium'). 글자를 value로 만들지 않아요
//     roomChoices · allChoices: '이 채팅' 줄 · 'Orbit 전체' 줄에 그릴 칩 (그 줄에 저장된 값의 칩에 불이 켜지게 맞춘 것)
//       [] 이면 이 모델은 레벨을 안 받아요 (칩을 그리지 않아요)
//     sent: 지금 값으로 요청에 실제로 보내는 이름 ('' = 안 보냄), provider · model (어느 모델 기준인지) }
//   liveSetReasoning(real, 방 id | '' (Orbit 전체), 값)
export const REASONING_LEVELS = ['none', 'low', 'medium', 'high', 'xhigh', 'maximum'];
// (Marinara's generationLevelLabel, with its level words in Korean: Low · Medium · High · Extra high · Max · Maximum)
const LEVEL_KO = { low: '낮게', medium: '보통', high: '높게', xhigh: '매우 높게', max: '최대', maximum: '최대' };
export const levelName = level => generationLevelLabel(level, k => LEVEL_KO[k.split('.').pop()]);
// (values an earlier version stored, in SillyTavern's words)
const oldLevel = v => ({ auto: '', min: 'none', max: 'maximum' }[v] ?? v);
// the provider, in Marinara's names, and the model a connection runs (for the per-model rules)
const ST_PROVIDER = { makersuite: 'google', vertexai: 'google_vertex', claude: 'anthropic', mistralai: 'mistral', openai: 'openai', openrouter: 'openrouter', cohere: 'cohere', deepseek: 'deepseek', xai: 'xai', nanogpt: 'nanogpt', zai: 'zai', custom: 'custom' };
const kindOf = t => (t.mode === 'source' ? { provider: ST_PROVIDER[t.source] || 'custom', model: String(t.stModel || '') }
    : t.mode === 'vertex' ? { provider: 'google_vertex', model: String(t.vxModel || '') }
        : t.mode === 'custom' ? { provider: apiFormat(t) === 'anthropic' ? 'anthropic' : 'custom', model: String(t.model || '') } : null);
function roomKind(real, roomId) {
    const room = roomId ? liveWorld(real)?.messenger?.rooms?.[roomId] : null, chat = room ? roomChat(room) : null, id = chat?.connectionId || 'dr';
    const slot = slotOf(id), override = chat ? readChatModelOverride(chat) : null;
    if (slot) { const k = kindOf(override ? { ...slot, [modelKey(slot)]: override.model } : slot); if (k) return k; }
    // (SillyTavern's own connection, or one of its profiles)
    const p = aiProfiles().find(x => `profile:${x.id}` === id), c = ctx();
    return p ? { provider: ST_PROVIDER[p.api] || 'custom', model: String(p.model || '') }
        : { provider: ST_PROVIDER[c.chatCompletionSettings?.chat_completion_source] || 'custom', model: String((c.mainApi === 'openai' ? c.getChatCompletionModel?.() : '') || '') };
}
export function liveReasoning(real, roomId = '') {
    const w = liveWorld(real), room = roomId ? w?.messenger?.rooms?.[roomId] : null;
    const ok = v => { const x = oldLevel(String(v || '')); return REASONING_LEVELS.includes(x) ? x : ''; };
    const mine_ = ok(room?.chatParameters?.reasoningEffort), all = ok(w?.presence?.meta?.reasoningEffort), effort = mine_ || all;
    const { provider, model } = roomKind(real, roomId), takes = relevantGenerationParameters({ provider, model }).has('reasoningEffort');
    // (the chips, as Marinara's GenerationParametersEditor draws them: reasoningEffortChoices with the row's own value as
    //  `selected`, and no Off chip for Claude Opus 5.5. A chip's text is its label, the level the model really gets)
    const chips = sel => (!takes ? [] : reasoningEffortChoices({ provider, model, selected: sel && sel !== 'none' ? sel : null })
        .filter(c => c.value !== null || !isClaudeOpus55Model(model ?? ''))
        .map(c => ({ value: c.value === null ? 'none' : c.value, label: c.label, name: c.label !== null ? levelName(c.label) : '끔' })));
    const choices = chips(effort), roomChoices = chips(mine_), allChoices = chips(all);
    // (what goes out for this model: Marinara's resolveProviderReasoningEffort; a model that takes no level gets none)
    const sent = !effort || !takes ? '' : resolveProviderReasoningEffort({ provider, model, reasoningEffort: effort }) ?? (effort === 'none' ? 'none' : '');
    return { effort, room: mine_, all, choices, roomChoices, allChoices, sent, provider, model };
}
export async function liveSetReasoning(real, roomId = '', effort = '') {
    const w = liveWorld(mine(real)), v = oldLevel(String(effort || ''));   // (an older screen's words are taken too)
    if (v && !REASONING_LEVELS.includes(v)) throw new Error('추론 레벨은 none · low · medium · high · xhigh · maximum 가운데 하나예요');
    if (roomId) {
        const room = w.messenger?.rooms?.[roomId];
        if (!room) throw new Error('없는 방이에요');
        if (v) room.chatParameters = { ...(room.chatParameters || {}), reasoningEffort: v };
        else if (room.chatParameters) { delete room.chatParameters.reasoningEffort; if (!Object.keys(room.chatParameters).length) delete room.chatParameters; }
    } else { const meta = presenceOf(real).meta; if (v) meta.reasoningEffort = v; else delete meta.reasoningEffort; }
    await saveMeta();
    return liveReasoning(real, roomId);
}
