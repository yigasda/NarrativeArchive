// 폰 2 답장을 실제로 돌리는 곳 (docs/PHONE2-PLAN.md 단계 7-5): 화면은 메시지를 보낸 뒤 liveGo 하나만 불러요.
// 일의 줄(phone2run.js runLive)에 실제 것들을 이어요: 입력 모으기(phone2live.js · phone2ask.js), 답장 지시문
// (phone2reply.js), 모델(초안 모델), 저장, 그리고 답장 뒤의 폰 2 반영(phone2reflect.js).
// 반영은 답장마다 돌리지 않아요(소망 결정, 실제 모델 시험 뒤): 메신저를 나갈 때(홈으로, 폰을 닫을 때) liveReflect로
// 쌓인 대화를 한 번에 읽어요. 잘게 나눠 읽으면 같은 날 일기 · 같은 상황이 여러 번 생기고 호출도 메시지마다 3번이 돼요.
// 폰 1은 이 파일을 안 불러요.

import { ctx, saveMeta, MODULE } from './core.js';
import { applyInjection } from './inject.js';
import { askDraft, phone2Clock, aroundBlock, ownerZone, cardBlocks } from './phonedata.js';
import { askAI, askCompress, stripThink, isBlocked, SECTION_GUARD } from './ai.js';
import { SCENES_SYS, parseScenes } from './scenes.js';
import { resolvePhoneProfile, ownerProfileBlock, personaBlock } from './phoneprofile.js';
import { parseJson } from './phoneparse.js';
import { nameKey } from './people.js';
import { liveWorld, livePhone, liveMeta, liveKey, liveAtYear, isSnap, setStoryKeeper, startFresh, enqueueReplies, enqueueJob, renamePersona, setDrawerSeed } from './phone2store.js';
import { emojiOf, reactOf, putReact, quickReacts, noteRecent, messageOf } from './phone2react.js';
import { markMessages, markedMessages, trashOf, restoreMessages, emptyTrash, dropRoom, roomTrash, restoreRoom, emptyRoomTrash, addMember, removeMember } from './phone2room.js';
import { dropMessages, editMessage, replyTail, settleSwipes, swipeInfo, swipeTo, swipeList, dropSwipe, dropSwipes, dropOtherSwipes, koRows, koChunks, koInput, takeKo } from './phone2edit.js';
import { AI_SYS_PHONE_KO, voiceRows, who as voiceWho } from './phonetr.js';
import { askTranslator, glossaryEntries, glossaryIn } from './translate.js';
import { importRows, importInto, importFile, importedOf, chatKey } from './phone2import.js';
import { liveChatTail, liveSnapBehind, liveSnapExtend, liveSnapNow } from './phone2snap.js';
import { liveStoryText } from './phone2story.js';
import { BACK, backLeft, backInput, phone2BackSystem, takeBack, backMessage, markTold } from './phone2back.js';
import { liveWall } from './phone2clock.js';
import { gatherReply } from './phone2live.js';
import { replyInput } from './phone2ask.js';
import { phone2ReplySystem } from './phone2reply.js';
import { runLive } from './phone2run.js';
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
// 실리태번에서 페르소나를 바꿨으면 실시간 폰의 "나"도 그 이름으로 (열어 둔 채팅의 폰만). 바꿨으면 저장하고 true.
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
    const m = () => liveMeta(real, { now: liveNowOf(real) });
    const tell = () => { try { onChange(); } catch (err) { console.error('[narrative-archive] live draw', err); } };
    const line = saveLine();
    const out = await runLive(real, {
        save: line.save, alive: () => open(real),
        parse: s => parseJson(s, { salvage: true }),
        ask: (input, { system }) => askDraft(input, { force: true, system, maxTokens: LIVE_GO.replyTokens, effort: 'low' }),
        gather: async job => {
            await keepUpStory(real, tell);
            const w = liveWorld(real), p = livePhone(real, job.owner);
            if (!w || !p) return null;
            if (w.from === 'story' && !isSnap(w.snap)) throw new Error(NO_STORY);
            const d0 = m(), card = await cardOf(p);
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
            return d ? { system: phone2ReplySystem({ owner: d.owner, persona: d.persona }), input: replyInput(d) } : null;
        },
        after: async job => {
            const w = liveWorld(real), p = livePhone(real, job.owner);
            if (w && p && w.id === job.world) markPersona(p, w.persona);
            tell();
        },
    });
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
// 2) 넣기: 롤플 채팅 맨 끝에 해설 메시지 하나로 (실리태번의 /sys가 넣는 것과 같은 모양), 실었던 말에 전했다고 표시.
//    text: 사람이 고친 글 (안 주면 받은 글 그대로). 그사이 다른 채팅이 열렸거나 실시간 폰이 바뀌었으면 아무것도 안 해요
//   → 넣은 메시지의 번호
export async function liveBackPut(real, draft, text = draft?.text) {
    const w = liveWorld(real), c = ctx(), words = String(text ?? '').trim();
    if (!w || !open(real) || w.id !== draft?.world) throw new Error('그사이 채팅이나 실시간 폰이 바뀌었어요. 다시 해 주세요');
    if (!words) throw new Error('넣을 글이 비어 있어요');
    if (!Array.isArray(c.chat) || typeof c.addOneMessage !== 'function' || typeof c.saveChat !== 'function') throw new Error('이 실리태번에서는 롤플 채팅에 넣을 수 없어요');
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
    // (the answer shown is gone, every bubble of it: another one kept for that message shows)
    if (n) { settleSwipes(real, roomId); await saveMeta(); }
    return n;
}
// ---- 말 · 방 다루기 (phone2room.js). 사람이 눌렀을 때만 해요. 바뀐 것이 있으면 저장까지 해요.
const mine = real => { if (!real || !open(real)) throw new Error('이 채팅이 열려 있지 않아요'); return real; };
const kept = async v => { if (v) await saveMeta(); return v; };
// 말의 표시 (마리나라의 열쇠 그대로, 준 것만 바꿔요) → 바뀐 말의 수
//   { hiddenFromAI: true|false, hiddenFromAICharacterIds: [이름] | null, pinnedToContext: true|false, bookmark: true | { label } | null, privateNote: 글 | null }
export const liveMark = async (real, roomId, ids, patch) => kept(markMessages(mine(real), roomId, ids, patch));
// 북마크 · 메모한 말 모아 보기 (roomId 없으면 모든 방) → [{ room, x, bookmark, note }]
export const liveMarked = (real, roomId = '') => markedMessages(real, roomId);
// 휴지통: 지운 말 보기 [{ x, at }] · 되살리기 · 비우기 (ids 없으면 전부) → 수
export const liveTrash = (real, roomId) => trashOf(real, roomId);
export async function liveRestore(real, roomId, ids) { const n = restoreMessages(mine(real), roomId, ids); if (n) { settleSwipes(real, roomId); await saveMeta(); } return n; }
export const liveEmptyTrash = async (real, roomId, ids = null) => kept(emptyTrash(mine(real), roomId, ids));
// 방 지우기(휴지통으로) · 지운 방들 [{ room, at }] · 되살리기 · 아주 버리기 (roomId 없으면 전부)
export const liveDropRoom = async (real, roomId) => kept(dropRoom(mine(real), roomId));
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
    const out = swipeTo(real, roomId, dir), jobs = out.fresh ? enqueueReplies(real, roomId).length : 0;
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
        if (next && mine) noteRecent(w, next);
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
