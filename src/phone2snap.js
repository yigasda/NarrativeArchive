// 실시간 폰이 들고 가는 이야기 요약본 (docs/PHONE2-PLAN.md "요약본으로 시작").
// 이야기에서 시작한 실시간 폰은 이야기를 요약본 한 장으로 알아요. 롤플 채팅과 아카이브를 메시지 번호로 따라가지 않아서,
// 롤플에서 메시지를 고치든 지우든 분기하든 읽은 자리가 어긋날 일이 없어요.
//   시작할 때: 그때 이야기의 끝까지 요약본을 만들어요 (liveSnapNow).
//   롤플이 더 진행됐을 때: 답장마다 그 순간 롤플의 끝 메시지들을 읽고(liveChatTail), 그것으로 다 안 담길 만큼
//     진행됐으면 요약본 뒤로 진행된 구간만 요약해 붙여요 (liveSnapExtend).
//
// 요약본에 드는 것 (snap):
//   text    지금까지의 이야기. 아카이브 글 + 아직 아카이브 안 된 구간의 요약 + 그때의 STATE · OPEN.
//           아카이브의 "한 번에 압축"이 받는 초안을 그대로 받아서(같은 지시문 · 같은 모델 · 같은 나누기), 그 초안을
//           아카이브에 넣었을 때의 글을 만들어요. 진짜 아카이브에는 넣지 않아요: 롤플은 아무것도 안 바뀌어요.
//   recent  그때 이야기의 마지막 메시지 몇 개, 글자 그대로 (말투 · 직전 분위기). 메시지마다 한 칸인 목록이에요.
//   upto    어느 메시지까지의 이야기인지 (그때의 마지막 메시지 번호). 요약본을 늘릴 때 "그 뒤"를 정하는 데만 써요.
// 이 파일은 요약본을 "만들기만" 해요. 저장은 부르는 쪽이 해요 (시작: phone2story.js, 늘리기: 답장을 돌리는 파일).
// 폰 1은 이 파일을 부르지 않아요.

import { ctx, globalSettings } from './core.js';
import { activePrompt, auFix } from './prompts.js';
import { lastRangeEnd, splitTail, stripCites, trimEnd } from './sections.js';
import { hasChanges, resolveChanges } from './statechg.js';
import { placeAppend } from './appendtext.js';
import { draftCompress, rangeRaw } from './wizard.js';
import { chatStamp, recentPhoneText } from './phonedata.js';
import { isSnap } from './phone2store.js';

export { isSnap };

// 시작 직전 메시지: 몇 개까지, 몇 글자까지
export const SNAP_RECENT = { lines: 10, chars: 6000 };

// the stretch the archive doesn't hold yet, up to message `upto`: { from, to, items, raw } (items empty: nothing to
// summarize). As the archive's own 한 번에 압축 reads it: after the boundary, or from where its sections stop when they
// stop short of the boundary (the hidden messages of that gap go in too)
function unarchived(m, upto) {
    const c = ctx(), g = globalSettings();
    const boundary = Number.isInteger(m?.boundary) && m.boundary >= 0 ? m.boundary : -1, covered = lastRangeEnd(String(m?.text || ''));
    const gap = covered !== null && covered < boundary;
    const from = (gap ? covered : boundary) + 1, to = upto;
    if (!(to >= from)) return { from, to, items: [], raw: '' };
    return { from, to, ...rangeRaw(c, g, from, to, gap ? boundary : -1) };
}
// the instruction the archive's 한 번에 압축 uses
const promptOf = g => (g.prompts || []).find(x => x.id === g.wizPrompt) || activePrompt(g);

// 글 `base` 뒤에 구간 `u`의 요약을 붙인 글 → { text, parts }. 아카이브의 "한 번에 압축"이 받는 초안을 그대로 받아서
// (같은 지시문 · 같은 모델 · 같은 나누기), "바로 넣기"가 넣었을 때의 글을 만들어요. 구간이 비었으면 요청 없이 base 그대로.
// 실패하면 오류를 던져요.
async function summarizedOnto(m, base, u, onStep) {
    if (!u.items.length) return { text: base, parts: 0 };
    const g = globalSettings(), p = promptOf(g);
    if (!p?.text) throw new Error('압축 지시문이 없어요. 압축 설정을 확인해 주세요');
    // (the archive itself when the summary goes onto it; onto a snapshot: the chat's settings with that text as the archive)
    const r = await draftCompress({ m: base === String(m?.text || '') ? m : { ...m, text: base }, g, p, items: u.items, onStep });
    if (r.error) throw new Error(`이야기 요약을 끝까지 받지 못했어요${Number.isInteger(r.doneTo) ? ` (#${r.doneTo}까지 받음)` : ''}: ${String(r.error?.message || r.error)}`);
    // the draft as the archive's own 바로 넣기 would place it: the change lists turned into the full STATE · OPEN, the
    // source marks taken off, the sections put after the ones already there
    let add = auFix(String(r.text || '').replace(/\r\n/g, '\n').trim(), m);
    if (!add) throw new Error('이야기 요약이 비어 있어요. 다시 해 주세요');
    if (hasChanges(add)) add = resolveChanges(base, add).text;
    const text = placeAppend(base, stripCites(add), { renumber: true, rewrites: 'skip' }).text;
    if (!String(text || '').trim() || trimEnd(text) === trimEnd(base)) throw new Error('이야기 요약에 새로 들어온 장면이 없어요. 다시 해 주세요');
    return { text, parts: r.parts || 1 };
}
// a message's head in the chat's lines: "[#12] Mara: …", the user's own "[#12 · USER] Ren: …" (drift.js)
const HEAD = /^\[#(\d+)[^\]\n]*\] /;
// the messages just before `upto`, as they were said: one entry a message (the reader joins them with a blank line; a
// message's own text may hold blank lines, so the split is at the next message's "[#n]" head). upto null: the chat's end now
const lastSaid = upto => String(recentPhoneText(SNAP_RECENT.lines, { ...(upto == null ? {} : { upto }), maxChars: SNAP_RECENT.chars }) || '').split(/\n\n(?=\[#\d+[^\]\n]*\] )/).filter(x => x.trim());
const finished = (text, upto, u, parts, now) => { const t = String(text || '').replace(/\r\n/g, '\n'); return { v: 1, at: now, upto, text: t.trim() ? `${trimEnd(t)}\n` : '', recent: lastSaid(upto), made: { from: u.from, to: u.to, count: u.items.length, parts } }; };

// 요약본 만들기. 요청은 아카이브 안 된 구간이 있을 때만 보내요 (길면 여러 번, onStep(k, total, from, to)으로 알려요).
// 실패하면 아무것도 남기지 않고 오류를 던져요: 반쪽짜리 요약본으로는 시작하지 않아요.
//   → { v: 1, at, upto, text, recent, made: { from, to, count, parts } }
export async function liveSnapDraft(m, { upto, onStep = () => {}, now = Date.now() } = {}) {
    if (!Number.isInteger(upto) || upto < 0) throw new Error('이야기의 어느 메시지까지인지 필요해요');
    const u = unarchived(m, upto), { text, parts } = await summarizedOnto(m, String(m?.text || ''), u, onStep);
    return finished(text, upto, u, parts, now);
}

// ---- 롤플이 더 진행됐을 때 (답장마다 지금의 롤플 끝을 같이 봐요)
// 지금 롤플의 끝 메시지들: 끝에서부터 통째로, SNAP_RECENT까지 → { lines: ["[#n] 이름: 말", …], first: 맨 앞 메시지 번호 |
// null(없음), end: 채팅의 마지막 메시지 번호 }. 읽은 자리를 기억하지 않아요: 그 순간 채팅에 있는 것을 그대로 읽어요.
export function liveChatTail() {
    const said = lastSaid(null), lines = said.length > 1 && !HEAD.test(said[0]) ? said.slice(1) : said;   // (a first one cut in the middle: left out)
    const n = HEAD.exec(lines[0] || '')?.[1];
    return { lines, first: n == null ? null : Number(n), end: Math.max(0, (ctx().chat?.length || 1) - 1) };
}
// 요약본과 끝 메시지들 사이에 빈 구간이 있나: 요약본 뒤로 롤플이 끝 메시지들에 다 안 담길 만큼 진행됐을 때만 true
export function liveSnapBehind(snap, tail = liveChatTail()) {
    if (!isSnap(snap) || !(tail.end > snap.upto)) return false;
    return tail.first === null || tail.first > snap.upto + 1;
}
// 요약본을 지금의 끝까지 늘려요: 요약본 뒤로 진행된 구간만 요약해서 요약본 뒤에 붙이고, 시작 직전 메시지를 지금 끝의
// 것으로 바꿔요. 그 구간이 그사이 아카이브돼 숨겨졌어도 넣어요(경계선까지의 숨긴 메시지). 진짜 아카이브는 안 건드려요.
// 정리하는 동안 채팅이 달라졌으면(다른 채팅 · 끝 메시지가 사라지거나 고쳐짐) 버리고 오류예요.
//   → 늘린 요약본 (저장은 부르는 쪽이 해요)
export async function liveSnapExtend(m, snap, { onStep = () => {}, now = Date.now() } = {}) {
    if (!isSnap(snap)) throw new Error('늘릴 이야기 요약본이 없어요');
    const upto = Math.max(0, (ctx().chat?.length || 1) - 1), from = snap.upto + 1, was = chatStamp(upto);
    if (!(upto >= from)) return snap;
    const bnd = Number.isInteger(m?.boundary) && m.boundary >= 0 ? m.boundary : -1;
    const u = { from, to: upto, ...rangeRaw(ctx(), globalSettings(), from, upto, bnd) };
    const { text, parts } = await summarizedOnto(m, snap.text, u, onStep);
    const is = chatStamp(upto);
    if (is.chat !== was.chat || is.fp !== was.fp) throw new Error('이야기를 정리하는 동안 채팅이 바뀌었어요');
    return finished(text, upto, u, parts, now);
}

// 버튼 한 번으로 시작할 때: 지금 이야기의 끝(마지막 메시지)까지 요약본을 만들어서, 시작에 넘길 것을 돌려줘요.
// 만드는 동안 채팅이 달라졌으면(다른 채팅으로 갔거나, 메시지가 늘거나 줄었거나, 끝 메시지가 고쳐졌으면) 그 요약본은
// 버리고 오류를 던져요: 요약본은 "시작한 그 순간"의 이야기여야 해요.
//   → { snap, upto, chat, fp } — beginFromStory · rebeginKeepingChats에 그대로 넘겨요 (phone2story.js)
export async function liveSnapNow(m, { onStep = () => {}, now = Date.now() } = {}) {
    const last = () => Math.max(0, (ctx().chat?.length || 1) - 1);
    const upto = last(), was = chatStamp(upto);
    const snap = await liveSnapDraft(m, { upto, onStep, now });
    const is = chatStamp(upto);
    if (last() !== upto || is.chat !== was.chat || is.fp !== was.fp) throw new Error('이야기를 정리하는 동안 채팅이 바뀌었어요. 다시 시작해 주세요');
    return { snap, upto, chat: was.chat, fp: was.fp };
}

// 요약본의 두 부분: 장면들(body)과 끝의 STATE · OPEN(state)
export const snapParts = s => { const [body, state] = splitTail(String(s?.text || '')); return { body: trimEnd(body), state: String(state || '').trim() }; };
