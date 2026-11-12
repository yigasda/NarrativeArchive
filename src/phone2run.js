// 폰 2 답장: 모델의 답을 메신저에 넣기(7-2)와 일의 줄 돌리기(7-3). docs/PHONE2-PLAN.md 단계 7. 모델을 부르는 함수 ·
// 입력 모으기 · 저장은 부르는 쪽이 넘겨요(여기선 폰 2 저장 자리만 다뤄요). 폰 1은 이 파일을 안 불러요.

import { liveKey, liveWorld, liveNo, readLive, nextJob, finishJob, reviveJobs } from './phone2store.js';
import { PHONE2_APPS, phone2Ko } from './phone2reply.js';

const one = v => String(v ?? '').replace(/\s+/g, ' ').trim();
const same = (a, b) => !!liveKey(a) && liveKey(a) === liveKey(b);
export const REPLY_MAX = { bubbles: 8, chars: 2000, does: 6, what: 300, state: 200 };

// the answer as an object: one already parsed, or its text (the first { … } in it; parse: the app's own JSON reader)
function objectOf(answer, parse) {
    if (answer && typeof answer === 'object' && !Array.isArray(answer)) return answer;
    const t = String(answer ?? ''), a = t.indexOf('{'), b = t.lastIndexOf('}');
    if (a < 0 || b <= a) throw new Error('답장을 읽지 못했어요 (JSON이 아니에요)');
    try { const o = (parse || JSON.parse)(t.slice(a, b + 1)); if (!o || typeof o !== 'object' || Array.isArray(o)) throw new Error('not an object'); return o; }
    catch { throw new Error('답장을 읽지 못했어요 (JSON이 깨졌어요)'); }
}
// "14:05 · office · desk · ~15:00" without its clock (the request carries the real time): "office · desk · ~15:00"
export const stateRest = s => one(s).replace(/^\d{1,2}:\d{2}\s*[·•|,-]\s*/, '').slice(0, REPLY_MAX.state);
// the app a "does" line names, as the prompt lists it (the list's own spelling); another name is kept as written
const appOf = a => PHONE2_APPS.find(x => x.toLowerCase() === one(a).toLowerCase()) || PHONE2_APPS.find(x => x.toLowerCase().split(/[,&]/).map(y => y.trim()).includes(one(a).toLowerCase())) || one(a).slice(0, 30);

// 7-2. the model's answer into the room: each bubble a message of the owner's (its number, the real moment, its Korean,
// the owner's state), what they did on the phone on the last one. No bubble but something done or a new state: one
// message with no words (act: true; the messenger doesn't draw it, the reflection reads its lines). A bubble the owner
// already said among their newest ones is not said again. The owner has read the room. Returns { said, does, state }.
// Throws when the answer can't be read (nothing is put in).
export function takeReply(m, owner, roomId, answer, { now = Date.now(), parse = null } = {}) {
    const w = liveWorld(m), room = w?.messenger?.rooms?.[roomId];
    if (!w || !room || !room.members.some(n => same(n, owner))) throw new Error('답장을 넣을 방이 없어요');
    const o = objectOf(answer, parse);
    if (o.reply !== undefined && !Array.isArray(o.reply)) throw new Error('답장을 읽지 못했어요 (reply가 목록이 아니에요)');
    const name = room.members.find(n => same(n, owner));
    const had = new Set((room.messages || []).filter(x => same(x.from, name)).slice(-12).map(x => one(x.text)));
    const raw = (o.reply || []).map(x => (typeof x === 'string' ? x.trim() : '')).slice(0, REPLY_MAX.bubbles), ko = phone2Ko(raw, o.ko);
    const bubbles = raw.map((text, i) => ({ text: text.slice(0, REPLY_MAX.chars), ko: one(ko[i]) === one(text) ? '' : String(ko[i] ?? '').trim().slice(0, REPLY_MAX.chars) })).filter(b => one(b.text) && !had.has(one(b.text)));
    const does = (Array.isArray(o.does) ? o.does : []).map(d => ({ app: appOf(d?.app), what: one(d?.what).slice(0, REPLY_MAX.what) })).filter(d => d.app && d.what).slice(0, REPLY_MAX.does);
    const state = stateRest(o.state);
    const out = [], msg = (text, extra, k) => ({ id: `t${now.toString(36)}${k}${Math.random().toString(36).slice(2, 6)}`, n: liveNo(w), from: name, text, at: now + k, ...(state ? { state } : {}), ...extra });
    bubbles.forEach((b, k) => out.push(msg(b.text, b.ko ? { ko: b.ko } : {}, k)));
    if (!out.length && (does.length || state)) out.push(msg('', { act: true }, 0));
    if (does.length && out.length) out[out.length - 1].does = does;
    room.messages.push(...out);
    readLive(m, roomId, name, now + out.length);
    return { said: bubbles.length, does: does.length, state };
}

// 7-3. the line: one job at a time, in order, until none waits. A reply job: gather the request (gather(job) → { system,
// input }, or null when there is nothing to answer any more), ask the model (ask(input, { system }) → its answer),
// put the answer in (only if this 폰 2 is still the one the job was for), save. A failure stops the line (the job says
// why; the user sees it and lets the line go on). Returns { ran, failed }. One runner a chat at a time: a second call
// while one runs does nothing ({ ran: 0, busy: true }).
const running = new WeakSet();
export async function runLive(m, { gather, ask, save = async () => {}, now = () => Date.now(), parse = null, after = null } = {}) {
    if (!m || running.has(m)) return { ran: 0, failed: null, busy: true };
    running.add(m);
    let ran = 0, failed = null;
    try {
        // (a job a closed page left running: nothing runs it, it waits again)
        reviveJobs(m);
        for (let job = nextJob(m); job; job = nextJob(m)) {
            try {
                if (job.kind !== 'reply') throw new Error(`아직 할 수 없는 일이에요: ${job.kind}`);
                const req = await gather(job);
                let got = null;
                if (req) {
                    const answer = await ask(req.input, { system: req.system });
                    // (the 폰 2 this was for is gone or another: the answer is dropped, nothing is put in)
                    if (liveWorld(m)?.id !== job.world) { finishJob(m, job); continue; }
                    got = takeReply(m, job.owner, job.room, answer, { now: now(), parse });
                }
                finishJob(m, job);
                ran++;
                await save();
                if (after) await after(job, got);
            } catch (err) {
                failed = { job, error: String(err?.message || err) };
                finishJob(m, job, { error: failed.error });
                try { await save(); } catch { /* the failure is on the job either way */ }
                break;
            }
        }
    } finally { running.delete(m); }
    return { ran, failed };
}
