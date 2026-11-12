// 폰 2 답장을 실제로 돌리는 곳 (docs/PHONE2-PLAN.md 단계 7-5): 화면은 메시지를 보낸 뒤 liveGo 하나만 불러요.
// 일의 줄(phone2run.js runLive)에 실제 것들을 이어요: 입력 모으기(phone2live.js · phone2ask.js), 답장 지시문
// (phone2reply.js), 모델(초안 모델), 저장, 그리고 답장 뒤의 폰 2 반영(phone2reflect.js).
// 반영은 주인이 폰으로 뭔가 했을 때만 돌려요(답에 does가 있을 때). 말만 오간 메시지는 쌓여 있다가 그때 같이 읽혀요.
// 폰 1은 이 파일을 안 불러요.

import { ctx, saveMeta } from './core.js';
import { askDraft, phone2Clock, aroundBlock, ownerZone, cardBlocks } from './phonedata.js';
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
import { updateLive } from './phone2reflect.js';

// rounds of reflection after one reply at most (messages piled up while only talking: 100 a round)
export const LIVE_GO = { rounds: 3, replyTokens: 4000 };
const tzOf = p => ownerZone(p)?.tz || 'UTC';
// the owner's card as the reply reads it: the profile the user chose for them, else their character card in this chat
async function cardOf(p) {
    const chosen = p.financeProfile ? await resolvePhoneProfile(ctx(), p.financeProfile).catch(() => null) : null;
    if (chosen?.text) return String(chosen.text).trim();
    const k = nameKey(p.owner), block = cardBlocks().find(b => nameKey(/^\[CHARACTER CARD — ([^\]]*)\]/.exec(b)?.[1] || '') === k);
    return block ? block.replace(/^[^\n]*\n/, '').trim() : '';
}

// runs the waiting replies of this chat's 폰 2, one at a time, each put into its room and saved; a reply in which the
// owner did something on the phone is followed by 폰 2's reflection. onChange(): called whenever the screen should draw
// again (a reply came, the phone changed, a job failed). Returns runLive's { ran, failed, busy }
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
        after: async (job, got) => {
            tell();
            const w = liveWorld(real), p = livePhone(real, job.owner);
            if (!w || !p || w.id !== job.world) return;
            markPersona(p, w.persona);
            if (!got?.does) return;
            // (a reflection that fails leaves the reply as it is; the messages stay unread for the next one)
            try {
                const profile = await ownerProfileBlock(ctx(), p.financeProfile, p.owner, { money: !!(p.money || p.investment) });
                for (let k = 0; k < LIVE_GO.rounds; k++) { if (liveWorld(real)?.id !== w.id || !await updateLive(real, m(), p.owner, { tz: tzOf(p), save: saveMeta, profile })) break; tell(); }
                if (p.liveReflectError) { delete p.liveReflectError; await saveMeta(); }
            } catch (err) { console.error('[narrative-archive] live reflect', err); p.liveReflectError = { at: Date.now(), why: String(err?.message || err) }; await saveMeta(); }
            tell();
        },
    });
    tell();
    return out;
}
// how many of the owner's messenger messages 폰 2 hasn't reflected yet (for a small label, if the screen wants one)
export const liveUnreflected = (real, owner) => { const w = liveWorld(real), p = livePhone(real, owner); if (!w || !p) return 0; const done = p.sync?.done || [], base = p.sync?.marks?.base?.index ?? (Number.isInteger(w.storyUpto) ? w.storyUpto : 0); return Object.values(w.messenger?.rooms || {}).filter(r => r.members.some(n => liveKey(n) === liveKey(owner))).flatMap(r => r.messages || []).filter(x => Number.isInteger(x.n) && x.n > base && !done.some(([a, b]) => x.n >= a && x.n <= b)).length; };
