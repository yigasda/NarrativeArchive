// Drift check: does the recent chat contradict the archive?

import { aiLabel, askAI, withSpinner } from './ai.js';
import { gotoSection, renderAnswer } from './ask.js';
import { currentChatId } from './chats.js';
import { ctx, getMeta, globalSettings, hasChat, saveMeta } from './core.js';
import { cleanMessage } from './extract.js';
import { lastIndex } from './hide.js';
import { extraBlocks } from './inject.js';
import { castNames, knowledgeRows } from './knowledge.js';
import { syncPanel } from './panel.js';
import { findCited, parseSections } from './sections.js';
import { openSource } from './source.js';
import { SVG_B, svgB } from './theme.js';
import { countTokens, esc, fmt, timeLabel } from './util.js';

export const AI_SYS_DRIFT = `GOAL
Find places where the role-play model broke the story's established facts. The ARCHIVE is the record of what already happened; the RECENT CHAT is what was written since.

YOU GET
- ARCHIVE: the story so far. Its END (the latest sections, STATE and OPEN) is what is true right now.
- CURRENT CAST: the characters in the story right now.
- WHO KNOWS WHAT (sometimes): secrets, and who does not know them.
- RECENT CHAT: numbered messages. Messages marked USER are written by the user.

WHO TO CHECK
- Check only messages WITHOUT the USER mark. USER messages are the user's own choices: they may add new facts and are never mistakes.
- Check only characters in the CURRENT CAST or who actually appear in the recent chat. Ignore everyone else.

REPORT ONLY THESE (a clear clash with something the archive actually says)
1. FACT: a name, relationship, injury, object, place, or who-did-what that contradicts the archive.
    e.g. the archive says Ren's left arm is broken; the chat has her lifting a crate with her left arm.
2. SECRET: a character says or uses something they do not know (see WHO KNOWS WHAT, or it is clear from the archive).
    e.g. Mara does not know about Ivo's deal, but in the chat she mentions it.
3. SETTLED: something the archive marks as decided or resolved is undone or reopened with no reason in the chat.
    e.g. STATE says the two have stopped fighting over the house; the chat restarts that fight as if new.
4. TIME/PLACE: time of day or the calendar goes backwards, or one character is in two places at once.
5. CHARACTER: a character clearly acts or talks against what the archive says about them.
    e.g. STATE says Ivo no longer gives Ren orders; in the chat he orders her around with no reason.

DO NOT REPORT
- New events, new places, new feelings: the story moving forward is not a mistake.
- Things the archive simply does not mention.
- Style, pacing, length, or "could be better".
- Anything you are not sure about. If unsure, leave it out.

OUTPUT: Korean, one bullet per problem, exactly like this
- #<message number> <character> [<TYPE>]: <what clashes> — 근거: <the archive fact it clashes with, short> [[<archive section heading, copied exactly>]]
<TYPE> is one of FACT, SECRET, SETTLED, TIME, CHARACTER (the numbered list above; TIME covers place too).
Example:
- #612 Ivo [CHARACTER]: 렌에게 명령조로 말함 — 근거: 더는 렌에게 명령하지 않기로 했음 [[STATE AT #600 (…)]]
If there is no problem, write exactly: 없음`;

export function recentForCheck(n) {
    const chat = ctx().chat || [];
    const out = [];
    for (let i = chat.length - 1; i >= 0 && out.length < n; i--) {
        const x = chat[i];
        if (!x || (x.is_system && !x.is_user && !x.name)) continue;
        out.unshift(`[#${i}${x.is_user ? ' · USER' : ''}] ${x.name || (x.is_user ? 'User' : 'Char')}: ${cleanMessage(String(x.mes || ''), { stripTags: true })}`);
    }
    return out;
}

export async function runDrift(m, n) {
    const recent = recentForCheck(n);
    if (!recent.length) throw new Error('검사할 메시지가 없어요');
    const kr = knowledgeRows(m);
    const cast = castNames(m);
    const prompt = `[ARCHIVE]\n${m.text}${cast.length ? `\n\n[CURRENT CAST]\n${cast.join(', ')}` : ''}${kr.length ? `\n\n[WHO KNOWS WHAT]\n${extraBlocks({ ...m, knowInject: true, voiceInject: false }).trim()}` : ''}\n\n[RECENT CHAT]\n${recent.join('\n\n')}`;
    const out = await askAI(prompt, { system: AI_SYS_DRIFT, maxTokens: 2500 });
    const none = /^\s*(없음|none)\.?\s*$/i.test(out);
    const from = Number((recent[0].match(/^\[#(\d+)/) || [])[1]);
    m.driftLast = { at: Date.now(), n: none ? 0 : out.split('\n').filter(l => /^\s*[-*•]/.test(l)).length || 1, none, text: out, upto: lastIndex(), count: recent.length, ...(Number.isFinite(from) ? { from } : {}) };
    await saveMeta();
    syncPanel();
    return m.driftLast;
}

// "#123" in a drift answer opens that message; [[heading]] shows the section
export function driftHtml(text, m) {
    const secs = parseSections(m.text);
    // mark message numbers outside [[citations]] first, so headings inside citations stay intact
    const marked = String(text).split(/(\[\[.+?\]\](?!\]))/).map((part, i) => i % 2 ? part : part.replace(/(^|[^\w&#])#(\d{1,6})\b/g, '$1\u0001$2\u0001')).join('');
    const { html } = renderAnswer(marked, secs);
    return html.replace(/\u0001(\d+)\u0001/g, (all, n) => `<button type="button" class="na_cite na_cite_msg" data-msg="${n}" title="메시지 #${n} 보기">#${n}</button>`);
}

// kinds the drift prompt reports: [TYPE] → chip label + colour class
export const DRIFT_KINDS = {
    FACT: ['사실 다름', 'bad'], SECRET: ['모르는 걸 앎', 'bad'], SETTLED: ['해결된 떡밥', 'amber'],
    TIME: ['시간·장소', 'purple'], PLACE: ['시간·장소', 'purple'], 'TIME/PLACE': ['시간·장소', 'purple'], CHARACTER: ['성격 어긋남', 'bad'],
};
export const driftKind = raw => {
    const k = String(raw || '').trim().toUpperCase().replace(/\s+/g, '');
    if (DRIFT_KINDS[k]) return DRIFT_KINDS[k];
    const ko = Object.values(DRIFT_KINDS).find(([label]) => label === String(raw || '').trim());
    return ko || null;
};
// "Y2 #48–#63 — The night ridge (Mekhir 18)" → "#48–#63 · The night ridge"
export function driftSecLabel(title) {
    const t = String(title).replace(/^#+\s+/, '');
    const range = (t.match(/#\d+\s*[–—~-]\s*#?\d+/) || [])[0];
    const name = t.split(/\s[—–-]\s/).slice(1).join(' — ').replace(/\s*\([^)]*\)\s*$/, '').trim();
    if (range) return name ? `${range} · ${name}` : range;
    return t.replace(/\s*\([^)]*\)\s*$/, '').trim() || t;
}
// parses one "- #57 Set [SECRET]: … — 근거: fact [[…]]" line (older answers have no [TYPE] / fact)
export const DRIFT_LINE = /^[-*•]\s*#(\d+)\s+([^:：[\]]{1,40}?)\s*(?:\[([^\]]{1,20})\])?\s*[:：]\s*(.+?)(?:\s*[—–-]\s*근거\s*[:：]?\s*(.*?)\s*((?:\[\[[^\]]+\]\][\s,]*)+))?\s*$/;
// one card per drift line; anything else falls back to the plain rendering
export function driftCards(text, m) {
    const secs = parseSections(m.text);
    const lines = String(text).split('\n').map(l => l.trim()).filter(l => /^[-*•]/.test(l));
    if (!lines.length) return `<div class="na_v2_card">${driftHtml(text, m)}</div>`;
    return lines.map(l => {
        const mt = l.match(DRIFT_LINE);
        if (!mt) return `<div class="na_v2_card na_dr2_item">${driftHtml(l, m)}</div>`;
        const kind = driftKind(mt[3]);
        const fact = (mt[5] || '').trim();
        const links = mt[6] ? [...mt[6].matchAll(/\[\[(.+?)\]\](?!\])/g)].map(x => {
            const s = findCited(secs, x[1]);
            return s ? `<button type="button" class="na_cite na_dr2_sec" data-start="${s.start}" title="${esc(s.title)}">${esc(driftSecLabel(s.title))}</button>`
                : `<span class="na_dr2_sec na_dr2_miss" title="아카이브에서 못 찾은 제목">${esc(x[1])}</span>`;
        }).join('') : '';
        return `
          <div class="na_v2_card na_dr2_item">
            <div class="na_dr2_head"><button type="button" class="na_cite na_cite_msg na_dr2_msg" data-msg="${mt[1]}" title="메시지 #${mt[1]} 보기">#${mt[1]}</button><b>${esc(mt[2].trim())}</b>${kind ? `<span class="na_dr2_kind ${kind[1]}">${esc(kind[0])}</span>` : ''}</div>
            <div class="na_dr2_text">${esc(mt[4])}</div>
            ${fact || links ? `<div class="na_dr2_ev">${svgB(SVG_B.bookmark, 14)}<span>${fact ? `<span class="na_dr2_fact">${esc(fact)}</span>` : ''}${links}</span></div>` : ''}
          </div>`;
    }).join('');
}

export async function openDrift() {
    const c = ctx();
    const m = getMeta();
    const $root = $(`
      <div class="na_popup na_v2 na_dr2">
        <div class="na_v2_title"><b>이탈 감지</b><small title="참고용이고 아무것도 바꾸지 않아요">RP 모델이 정해진 사실과 어긋나게 쓴 곳 · 참고용</small></div>
        <div class="na_v2_card na_dr2_ctl">
          <div class="na_dr2_row"><span>최근 메시지</span><span class="na_fd_step"><button type="button" class="na_fd_btn na_dr2_dec" aria-label="줄이기">−</button><input type="number" class="text_pole na_dr_n" min="2" max="60" value="12"><button type="button" class="na_fd_btn na_dr2_inc" aria-label="늘리기">+</button></span><span>개</span></div>
          <button type="button" class="na_v2_btn primary wide na_dr_go">검사하기</button>
          <small class="na_v2_note na_dr_info"></small>
        </div>
        <div class="na_dr_out na_dr2_out"></div>
      </div>`);
    const show = d => {
        if (!d) return;
        const lines = d.none ? [] : String(d.text).split('\n').filter(l => /^\s*[-*•]/.test(l));
        const n = lines.length;
        const from = Number.isFinite(d.from) ? d.from : d.upto - d.count + 1;
        const meta = `${esc(timeLabel(d.at))} · ${from < d.upto ? `#${from}–#${d.upto}` : `#${d.upto}`} · ${d.count}개 검사`;
        const flagged = new Set(lines.map(l => (l.trim().match(DRIFT_LINE) || [])[1]).filter(Boolean)).size;
        const rest = d.count - flagged;
        const okBar = text => `<div class="na_dr2_ok">${svgB(SVG_B.check, 15, 2.6)}<span>${text}</span></div>`;
        $root.find('.na_dr_out').html(d.none
            ? `<div class="na_v2_label"><span>검사 결과</span><small>${meta}</small></div>${okBar(`검사한 ${d.count}개 메시지 모두 아카이브와 맞아요`)}`
            : `<div class="na_v2_label"><span>어긋난 곳${n ? ` ${n}개` : ''}</span><small>${meta}</small></div>${driftCards(d.text, m)}${flagged && rest > 0 ? okBar(`나머지 ${rest}개 메시지는 아카이브와 맞아요`) : ''}`);
    };
    $root.find('.na_dr2_dec, .na_dr2_inc').on('click', function () { const $n = $root.find('.na_dr_n'); $n.val(Math.min(60, Math.max(2, (parseInt($n.val(), 10) || 12) + ($(this).hasClass('na_dr2_inc') ? 2 : -2)))); });
    countTokens(m.text).then(t => {
        const auto = Number(globalSettings().driftAuto) || 0;
        $root.find('.na_dr_info').text(`아카이브 약 ${fmt(t)} 토큰 + 최근 대화를 ${aiLabel()}에 보내요 · ${auto ? `답 ${auto}개마다 자동 감지` : '자동 감지 꺼짐'}`);
    });

    show(m.driftLast);
    $root.find('.na_dr_go').on('click', async function () {
        const n = Math.min(60, Math.max(2, parseInt($root.find('.na_dr_n').val(), 10) || 12));
        const d = await withSpinner($(this), '검사하는 중…', () => runDrift(m, n));
        if (d) show(d);
    });
    $root.on('click', '.na_cite_msg', function () { const n = Number(this.dataset.msg); openSource(n, n, `#${n}`); });
    $root.on('click', '.na_cite[data-start]', function () {
        const start = Number(this.dataset.start);
        $root.closest('dialog').find('.popup-button-ok').trigger('click');
        gotoSection(start);
    });
    await c.callGenericPopup($root, c.POPUP_TYPE.TEXT, '', { wide: true, large: true, allowVerticalScrolling: true, leftAlign: true, okButton: '닫기' });
}

// every N AI replies, check quietly; only speak up when something is off
export const driftCount = new Map();
export let driftBusy = false;
export async function driftTick() {
    const every = Number(globalSettings().driftAuto) || 0;
    if (!every || !hasChat() || driftBusy) return;
    const m = getMeta();
    if (!m.text.trim()) return;
    const id = currentChatId();
    const k = (driftCount.get(id) || 0) + 1;
    driftCount.set(id, k);
    if (k < every) return;
    driftCount.set(id, 0);
    driftBusy = true;
    try {
        const d = await runDrift(m, Math.min(60, every + 2));
        if (!d.none) toastr.warning(`최근 대화에서 아카이브와 어긋난 곳 ${d.n}개 · 눌러서 보기`, '이탈 감지', { timeOut: 12000, onclick: () => openDrift() });
    } catch (e) { console.warn('[narrative-archive] auto drift', e); }
    finally { driftBusy = false; }
}
