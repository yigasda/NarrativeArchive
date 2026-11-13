// 폰 2 답장을 실제로 돌리는 곳 (docs/PHONE2-PLAN.md 단계 7-5): 화면은 메시지를 보낸 뒤 liveGo 하나만 불러요.
// 일의 줄(phone2run.js runLive)에 실제 것들을 이어요: 입력 모으기(phone2live.js · phone2ask.js), 답장 지시문
// (phone2reply.js), 모델(초안 모델), 저장, 그리고 답장 뒤의 폰 2 반영(phone2reflect.js).
// 반영은 답장마다 돌리지 않아요(소망 결정, 실제 모델 시험 뒤): 메신저를 나갈 때(홈으로, 폰을 닫을 때) liveReflect로
// 쌓인 대화를 한 번에 읽어요. 잘게 나눠 읽으면 같은 날 일기 · 같은 상황이 여러 번 생기고 호출도 메시지마다 3번이 돼요.
// 폰 1은 이 파일을 안 불러요.

import { ctx, saveMeta } from './core.js';
import { askDraft, phone2Clock, aroundBlock, ownerZone, cardBlocks } from './phonedata.js';
import { askAI, askCompress, stripThink, isBlocked, SECTION_GUARD } from './ai.js';
import { SCENES_SYS, parseScenes } from './scenes.js';
import { resolvePhoneProfile, ownerProfileBlock } from './phoneprofile.js';
import { parseJson } from './phoneparse.js';
import { nameKey } from './people.js';
import { liveWorld, livePhone, liveMeta, liveKey } from './phone2store.js';
import { liveStoryText } from './phone2story.js';
import { gatherReply } from './phone2live.js';
import { replyInput } from './phone2ask.js';
import { phone2ReplySystem } from './phone2reply.js';
import { runLive } from './phone2run.js';
import { markPersona } from './phone2feed.js';
import { updateLive, undoLive } from './phone2reflect.js';
import { SHORT_PROMPT, compressParts, langBlock } from './prompts.js';
import { AI_SYS_DIGEST } from './digest.js';
import { DIGEST_STATE, digestDue, digestRaw, digestSize, digestHalves, scenesSystem, scenesInput, scenesNote, takeDigest, failDigest, foldChunk, foldRequest, takeFold, failFold } from './phone2digest.js';

// rounds of reflection after one reply at most (messages piled up while only talking: 100 a round)
export const LIVE_GO = { rounds: 3, replyTokens: 4000, digests: 2 };
const tzOf = p => ownerZone(p)?.tz || 'UTC';
// the owner's card as the reply reads it: the profile the user chose for them, else their character card in this chat
async function cardOf(p) {
    const chosen = p.financeProfile ? await resolvePhoneProfile(ctx(), p.financeProfile).catch(() => null) : null;
    if (chosen?.text) return String(chosen.text).trim();
    const k = nameKey(p.owner), block = cardBlocks().find(b => nameKey(/^\[CHARACTER CARD — ([^\]]*)\]/.exec(b)?.[1] || '') === k);
    return block ? block.replace(/^[^\n]*\n/, '').trim() : '';
}

// runs the waiting replies of this chat's 폰 2, one at a time, each put into its room and saved. onChange(): called
// whenever the screen should draw again (a reply came, a job failed). Returns runLive's { ran, failed, busy }
export async function liveGo(real, { onChange = () => {} } = {}) {
    const m = () => liveMeta(real, { text: () => liveStoryText(real, liveWorld(real)) });
    const tell = () => { try { onChange(); } catch (err) { console.error('[narrative-archive] live draw', err); } };
    const out = await runLive(real, {
        save: saveMeta,
        parse: s => parseJson(s, { salvage: true }),
        ask: (input, { system }) => askDraft(input, { force: true, system, maxTokens: LIVE_GO.replyTokens, effort: 'low' }),
        gather: async job => {
            const w = liveWorld(real), p = livePhone(real, job.owner);
            if (!w || !p) return null;
            const d0 = m(), card = await cardOf(p);
            const d = gatherReply(real, job.owner, job.room, { now: Date.now(), tz: tzOf(p), deps: {
                // (the reply's own clock block: each place's time now and weekday, as the reply prompt was tuned with)
                clock: (ph, at) => phone2Clock(ph, at, d0), around: aroundBlock, card: () => card,
                place: ph => { const r = (ph.where?.people || []).find(x => nameKey(x?.name) === nameKey(ph.owner)); return String(r?.place || r?.city || '').trim(); },
                story: () => liveStoryText(real, w),
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
    if (!force && Number.isInteger(p.liveHeld) && !Object.values(w.messenger?.rooms || {}).some(r => r.members.some(n => liveKey(n) === liveKey(owner)) && (r.messages || []).some(x => x.n > p.liveHeld))) return { ...none, left: liveUnreflected(real, owner), held: true };
    if ((w.queue?.jobs || []).some(j => liveKey(j.owner) === liveKey(owner) && (j.state === 'waiting' || j.state === 'running'))) return { ...none, left: liveUnreflected(real, owner), waiting: true };
    const tell = () => { try { onChange(); } catch (err) { console.error('[narrative-archive] live draw', err); } };
    const m = () => liveMeta(real, { text: () => liveStoryText(real, liveWorld(real)) });
    let rounds = 0, error = '';
    reflecting.add(real);
    try {
        const profile = await ownerProfileBlock(ctx(), p.financeProfile, p.owner, { money: !!(p.money || p.investment) });
        for (; rounds < LIVE_GO.rounds; rounds++) { if (liveWorld(real)?.id !== w.id || !await updateLive(real, m(), p.owner, { tz: tzOf(p), save: saveMeta, profile })) break; tell(); }
        if (p.liveReflectError) { delete p.liveReflectError; await saveMeta(); }
    } catch (err) {
        console.error('[narrative-archive] live reflect', err);
        error = String(err?.message || err);
        if (liveWorld(real)?.id === w.id) { p.liveReflectError = { at: Date.now(), why: error }; await saveMeta(); }
    } finally { reflecting.delete(real); }
    tell();
    return { rounds, left: liveWorld(real)?.id === w.id ? liveUnreflected(real, owner) : 0, waiting: false, error };
}
// how many of the owner's messenger messages 폰 2 hasn't reflected yet (for a small label, if the screen wants one)
export const liveUnreflected = (real, owner) => { const w = liveWorld(real), p = livePhone(real, owner); if (!w || !p) return 0; const done = p.sync?.done || [], base = p.sync?.marks?.base?.index ?? (Number.isInteger(w.storyUpto) ? w.storyUpto : 0); return Object.values(w.messenger?.rooms || {}).filter(r => r.members.some(n => liveKey(n) === liveKey(owner))).flatMap(r => r.messages || []).filter(x => Number.isInteger(x.n) && x.n > base && !done.some(([a, b]) => x.n >= a && x.n <= b)).length; };

// 방금 반영 되돌리기 (폰 2): can the owner's last round be taken back, and doing it. kept: what couldn't go back (said to
// the user as 폰 1 says it). After it the messages wait for new talk; liveReflect(real, owner, { force: true }) reads
// them again now. Throws what 폰 1's 되돌리기 throws (nothing to undo; the bank made again since)
export const liveCanUndo = (real, owner) => { const p = livePhone(real, owner); return !!p?.syncUndo && !!p.syncLast?.checked && p.sync?.rounds?.at(-1) === p.syncUndo.round; };
export async function liveUndo(real, owner, { onChange = () => {} } = {}) {
    const kept = await undoLive(real, liveMeta(real, { text: () => liveStoryText(real, liveWorld(real)) }), owner, { save: saveMeta });
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
    let done = 0;
    digesting.add(real);
    try {
        for (; done < LIVE_GO.digests; ) {
            const next = digestDue(real, owner)[0];
            if (!next || liveWorld(real)?.id !== w.id) break;
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
                    if (liveWorld(real)?.id !== w.id) break;
                    if (!takeDigest(room, a, first)) { await saveMeta(); break; }
                    await saveMeta();
                    answer = await ask(b);
                    if (liveWorld(real)?.id !== w.id) break;
                    const keptB = takeDigest(room, b, answer);
                    await saveMeta();
                    if (!keptB) break;
                    done++;
                    continue;
                }
            } catch (err) { if (liveWorld(real)?.id === w.id) { failDigest(room, err?.message || err); await saveMeta(); } throw err; }
            if (liveWorld(real)?.id !== w.id) break;
            const kept = takeDigest(room, chunk, answer);
            await saveMeta();
            if (!kept) break;
            done++;
        }
        // 요약의 요약: one room whose summary has grown long has its older half made short (one a go)
        const long = liveWorld(real)?.id === w.id ? Object.values(w.messenger?.rooms || {}).filter(r => r.members.some(n => liveKey(n) === liveKey(owner))).map(room => ({ room, chunk: foldChunk(room) })).find(x => x.chunk) : null;
        if (long) {
            let answer;
            try {
                const story = liveStoryText(real, w);
                answer = stripThink(await askCompress(foldRequest(long.chunk, story ? langBlock(story, { tail: false, src: '' }) : ''), { system: AI_SYS_DIGEST }));
            } catch (err) { if (liveWorld(real)?.id === w.id) { failFold(long.room, err?.message || err); await saveMeta(); } throw err; }
            if (liveWorld(real)?.id === w.id) { takeFold(long.room, long.chunk, answer); await saveMeta(); }
        }
    } finally { digesting.delete(real); }
    return done;
}
