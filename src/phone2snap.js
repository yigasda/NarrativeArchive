// 실시간 폰이 들고 가는 이야기 요약본 (docs/PHONE2-PLAN.md "요약본으로 시작").
// 실시간을 시작하는 순간의 이야기를 한 번 적어서 실시간 폰에 넣어 둬요. 그 뒤로 실시간 폰은 롤플 채팅도 아카이브도
// 다시 읽지 않아요: 롤플에서 메시지를 고치든 지우든 분기하든 실시간 폰이 아는 이야기는 그대로예요.
//
// 요약본에 드는 것 (snap):
//   text    지금까지의 이야기. 아카이브 글 + 아직 아카이브 안 된 구간의 요약 + 그때의 STATE · OPEN.
//           아카이브의 "한 번에 압축"이 받는 초안을 그대로 받아서(같은 지시문 · 같은 모델 · 같은 나누기), 그 초안을
//           아카이브에 넣었을 때의 글을 만들어요. 진짜 아카이브에는 넣지 않아요: 롤플은 아무것도 안 바뀌어요.
//   recent  시작 직전의 메시지 몇 개, 글자 그대로 (말투 · 직전 분위기). 메시지마다 한 칸인 목록이에요.
//   upto    어느 메시지까지의 이야기인지 (그때의 마지막 메시지 번호). 기록용이에요: 이 번호로 채팅을 다시 읽지 않아요.
// 이 파일은 요약본을 "만들기만" 해요. 저장은 시작할 때(phone2story.js) 해요. 폰 1은 이 파일을 부르지 않아요.

import { ctx, globalSettings } from './core.js';
import { estTok } from './recall.js';
import { activePrompt, auFix } from './prompts.js';
import { lastRangeEnd, splitTail, stripCites, trimEnd } from './sections.js';
import { hasChanges, resolveChanges } from './statechg.js';
import { placeAppend } from './appendtext.js';
import { chunkItems, draftCompress, rangeRaw } from './wizard.js';
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

// 시작 전에 보여 줄 숫자 (요청을 보내기 전에): 요약할 구간 · 메시지 수 · 요청 수 · 보낼 양(어림)
//   { from, to, count, parts, tokens } — count 0이면 요약할 게 없어요 (요청 0번, 아카이브 글 그대로)
export function liveSnapPlan(m, upto) {
    if (!Number.isInteger(upto) || upto < 0) throw new Error('이야기의 어느 메시지까지인지 필요해요');
    const u = unarchived(m, upto);
    if (!u.items.length) return { from: u.from, to: u.to, count: 0, parts: 0, tokens: 0 };
    const g = globalSettings(), p = promptOf(g), parts = chunkItems(u.items).length;
    // (as the archive's own estimate: the raw log once, and with each request the archive and the instruction)
    const tokens = Math.round(estTok(u.raw) + parts * (estTok(String(m?.text || '')) + estTok(p?.text || '')));
    return { from: u.from, to: u.to, count: u.items.length, parts, tokens };
}

// 요약본 만들기. 요청은 아카이브 안 된 구간이 있을 때만 보내요 (길면 여러 번, onStep(k, total, from, to)으로 알려요).
// 실패하면 아무것도 남기지 않고 오류를 던져요: 반쪽짜리 요약본으로는 시작하지 않아요.
//   → { v: 1, at, upto, text, recent, made: { from, to, count, parts } }
export async function liveSnapDraft(m, { upto, onStep = () => {}, now = Date.now() } = {}) {
    if (!Number.isInteger(upto) || upto < 0) throw new Error('이야기의 어느 메시지까지인지 필요해요');
    const archive = String(m?.text || ''), u = unarchived(m, upto);
    let text = archive, parts = 0;
    if (u.items.length) {
        const g = globalSettings(), p = promptOf(g);
        if (!p?.text) throw new Error('압축 지시문이 없어요. 압축 설정을 확인해 주세요');
        const r = await draftCompress({ m, g, p, items: u.items, onStep });
        if (r.error) throw new Error(`이야기 요약을 끝까지 받지 못했어요${Number.isInteger(r.doneTo) ? ` (#${r.doneTo}까지 받음)` : ''}: ${String(r.error?.message || r.error)}`);
        // the draft as the archive's own 바로 넣기 would place it: the change lists turned into the full STATE · OPEN, the
        // source marks taken off, the sections put after the archive's
        let add = auFix(String(r.text || '').replace(/\r\n/g, '\n').trim(), m);
        if (!add) throw new Error('이야기 요약이 비어 있어요. 다시 해 주세요');
        if (hasChanges(add)) add = resolveChanges(archive, add).text;
        text = placeAppend(archive, stripCites(add), { renumber: true, rewrites: 'skip' }).text;
        if (!String(text || '').trim() || trimEnd(text) === trimEnd(archive)) throw new Error('이야기 요약에 새로 들어온 장면이 없어요. 다시 해 주세요');
        parts = r.parts || 1;
    }
    text = String(text || '').replace(/\r\n/g, '\n');
    // (one entry a message: the reader joins them with a blank line; a message's own text may hold blank lines, so the
    // split is at the next message's "[#n]" head)
    const recent = String(recentPhoneText(SNAP_RECENT.lines, { upto, maxChars: SNAP_RECENT.chars }) || '').split(/\n\n(?=\[#\d+\])/).filter(x => x.trim());
    return { v: 1, at: now, upto, text: text.trim() ? `${trimEnd(text)}\n` : '', recent, made: { from: u.from, to: u.to, count: u.items.length, parts } };
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
