// 폰 2 메신저의 오래된 대화 요약 (docs/PHONE2-PLAN.md 단계 9의 요약): 방마다, 요약 안 된 말이 DIGEST.at개 쌓이면 그중
// 오래된 DIGEST.take개를 요약해 방에 둬요. 나머지(가장 새 것 DIGEST.at - DIGEST.take개)는 원문 그대로 남아서, 요약과
// 원문이 겹치지 않아요. 답장 요청은 요약(CHAT SUMMARY) + 요약 안 된 원문(MESSENGER)을 보내요.
// 요약 글을 쓰는 지시문은 아카이브 압축의 짧은 지시문 그대로예요(prompts.js SHORT_PROMPT, 부르는 쪽이 넘겨요). 그 밖의
// 것(언제 · 무엇을 · 어디에)은 전부 폰 2 것: 이야기 아카이브 · 경계선 · 메시지 숨기기는 읽지도 쓰지도 않아요.
// 방의 요약이 길어지면 오래된 절반을 한 장면으로 다시 줄여요(요약의 요약, 아카이브 다이제스트의 지시문 그대로).
// 이 파일은 폰 2 저장 자리와 시계만 불러요. 모델은 부르는 쪽이 불러요. 폰 1은 이 파일을 안 불러요.

import { liveWorld, numberLive } from './phone2store.js';
import { liveWall } from './phone2clock.js';

const one = v => String(v ?? '').replace(/\s+/g, ' ').trim();
// about how many tokens a text is (as the archive's compression counts: a Hangul letter one, the rest 3.6 characters a token)
export const digestTok = t => { const x = String(t ?? ''), h = (x.match(/[\u1100-\u11ff\u3130-\u318f\uac00-\ud7af]/g) || []).length; return Math.ceil(h + (x.length - h) / 3.6); };
// at: unsummarized messages a room holds before it is summarized; take: how many of the oldest go into the summary then
// (the newest at - take stay as they are); fold: tokens of summary a room holds before its older half is made into one
// short section (foldTo: the most tokens that section may take, the archive digest's own default); kept: the most tokens
// a room ever keeps, should folding keep failing (the oldest part goes whole); wait: after a failed try, this many new
// messages or this long before the next
export const DIGEST = { at: 300, take: 260, fold: 5000, foldTo: 1200, kept: 40000, waitNew: 20, waitMs: 60 * 60_000 };
// what a room's summary is told about the state blocks the archive keeps and the messenger doesn't
export const DIGEST_STATE = '(The messenger keeps no STATE or OPEN blocks. Write the sections only: no title line, no `---`, nothing after the last section.)';

// a message that is something said (or a call): one the owner only did things in, with no words, is not talk
const said = x => !!x && (!!x.call || !!one(x.text));
// the room's messages not summarized yet, oldest first
export const undigested = room => (room?.messages || []).filter(x => Number.isInteger(x.n) && x.n > (room.digest?.upto ?? -1) && said(x));
// the stretch to summarize now: the oldest DIGEST.take of them once DIGEST.at wait; null when it isn't time, or a try
// just failed (now: the real moment)
export function digestChunk(room, now = Date.now()) {
    const rest = undigested(room);
    if (rest.length < DIGEST.at) return null;
    const f = room.digest?.failed;
    if (f && rest.length - (f.left || 0) < DIGEST.waitNew && now - (f.at || 0) < DIGEST.waitMs) return null;
    const rows = rest.slice(0, DIGEST.take);
    return { rows, from: rows[0].n, to: rows.at(-1).n };
}
// the stretch as the raw log the instruction reads: one line a message, "[n] Name (MM-DD HH:MM): words", a call as its
// length and what it was about; what a member did on their phone then, under their message. tz: whose clock the times are on
export function digestRaw(w, rows, tz = 'UTC') {
    const out = [];
    for (const x of rows) {
        const t = liveWall(tz, w?.dayShift || 0, x.at).at;
        out.push(`[${x.n}] ${x.from} (${t}): ${x.call ? `(call, ${Math.max(0, Math.round(Number(x.call.min) || 0))} min${one(x.call.summary) ? `: ${one(x.call.summary)}` : ''})` : one(x.text)}`);
        for (const d of Array.isArray(x.does) ? x.does : []) if (one(d?.what)) out.push(`[${x.n}] ${x.from} did on their phone (${one(d.app) || 'phone'}): ${one(d.what)}`);
    }
    return out.join('\n');
}
// the request: the instruction with its four places filled (fill: prompts.js fillPrompt), and the language line when
// the story's archive has one (lang: prompts.js langBlock of the story 폰 2 may read, or '')
export const digestRequest = (tpl, fill, chunk, raw, lang = '') => `${fill(tpl, { from: String(chunk.from), to: String(chunk.to), raw, state: DIGEST_STATE })}${lang || ''}`;

// the answer's sections: what comes before a `---` line (the state part, should the model write one), a title line or a
// code fence off; '' when it holds no section
export function digestText(answer) {
    const body = String(answer ?? '').replace(/^```[a-z]*\n?|\n?```\s*$/g, '').split(/\n-{3,}\s*(?:\n|$)/)[0];
    const at = body.search(/^##\s/m);
    return at < 0 ? '' : body.slice(at).replace(/\s+$/, '');
}
// the answer kept on the room; the stretch counts as summarized. Returns the part kept, or null when the answer holds
// no section (the try is noted as failed: the next one waits for new talk or an hour)
export function takeDigest(room, chunk, answer, now = Date.now()) {
    const text = digestText(answer), d = (room.digest ||= { upto: -1, parts: [] });
    if (!text) { d.failed = { at: now, left: undigested(room).length, why: '요약에 장면이 없어요' }; return null; }
    const part = { from: chunk.from, to: chunk.to, at: now, text };
    d.parts = [...(Array.isArray(d.parts) ? d.parts : []), part];
    // (folding keeps it short, foldChunk below; only should that keep failing does the oldest part go whole)
    while (d.parts.length > 1 && d.parts.reduce((n, p) => n + digestTok(p.text), 0) > DIGEST.kept) d.parts.shift();
    d.upto = chunk.to;
    delete d.failed;
    return part;
}
// a try that threw (the model, the network): noted the same way
export function failDigest(room, why, now = Date.now()) { const d = (room.digest ||= { upto: -1, parts: [] }); d.failed = { at: now, left: undigested(room).length, why: one(why).slice(0, 200) }; }
// 요약의 요약: a room's summary of more than DIGEST.fold tokens has its older half (whole parts, oldest first; the newest part
// never) made into one short section, by the archive's digest instruction (digest.js AI_SYS_DIGEST, the caller's). An
// older fold is folded again with what came after it, so the far past gets shorter and shorter and never drops off.
// foldChunk: what to fold now, or null (not long enough, or a try just failed)
const size = parts => parts.reduce((n, p) => n + digestTok(p.text), 0);
export function foldChunk(room, now = Date.now()) {
    const parts = Array.isArray(room?.digest?.parts) ? room.digest.parts : [], all = size(parts);
    if (parts.length < 2 || all <= DIGEST.fold) return null;
    const f = room.digest.foldFailed;
    if (f && now - (f.at || 0) < DIGEST.waitMs && all - (f.size || 0) < 800) return null;
    const take = [];
    for (const p of parts.slice(0, -1)) { take.push(p); if (size(take) >= all / 2) break; }
    return { parts: take, from: take[0].from, to: take.at(-1).to, src: take.map(p => String(p.text).trim()).join('\n\n') };
}
// the request the digest instruction reads: the sections, the ceiling, the language line
export const foldRequest = (chunk, lang = '') => `SECTIONS:\n${chunk.src}\n\nTARGET: ${DIGEST.foldTo}${lang || ''}`;
// the answer in place of the parts it stands for; null when it holds no section or is no shorter (noted, tried later)
export function takeFold(room, chunk, answer, now = Date.now()) {
    const d = room.digest, text = digestText(answer);
    if (!text || digestTok(text) >= digestTok(chunk.src)) { d.foldFailed = { at: now, size: size(d.parts), why: text ? '줄인 글이 더 길어요' : '줄인 글에 장면이 없어요' }; return null; }
    const part = { from: chunk.from, to: chunk.to, at: now, text, folded: true };
    d.parts = [part, ...d.parts.filter(p => !chunk.parts.includes(p))];
    delete d.foldFailed;
    return part;
}
export function failFold(room, why, now = Date.now()) { if (room?.digest) room.digest.foldFailed = { at: now, size: size(room.digest.parts || []), why: one(why).slice(0, 200) }; }
// the room's summary as the reply reads it (CHAT SUMMARY): its parts, oldest first; '' when it has none
export const digestOf = room => (Array.isArray(room?.digest?.parts) ? room.digest.parts : []).map(p => String(p.text || '').trim()).filter(Boolean).join('\n\n');
// the rooms of this 폰 2 an owner is in that are due, oldest stretch first
export function digestDue(m, owner, now = Date.now()) {
    const w = liveWorld(m), k = String(owner || '').trim().toLowerCase();
    if (!w) return [];
    numberLive(w);
    return Object.values(w.messenger?.rooms || {}).filter(r => r.members.some(n => String(n).trim().toLowerCase() === k)).map(room => ({ room, chunk: digestChunk(room, now) })).filter(x => x.chunk).sort((a, b) => a.chunk.from - b.chunk.from);
}
