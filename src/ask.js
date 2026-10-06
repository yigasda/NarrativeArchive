// Ask the archive.

import { aiHtml, aiLabel, askAI, withSpinner } from './ai.js';
import { currentChatId } from './chats.js';
import { ctx, getMeta } from './core.js';
import { sectionPanel, showArchiveView, showTab } from './panel.js';
import { mdBlock } from './reader.js';
import { findCited, parseSections } from './sections.js';
import { countTokens, esc, fmt } from './util.js';

// ---- prompts

export const AI_SYS_ASK = `GOAL
Answer the user's question about their story using ONLY the ARCHIVE.

YOU GET
- ARCHIVE: the story so far, in sections. Each section starts with a heading line like "## Y2 #48–#63 — The night ridge". The END of the archive (latest sections, STATE, OPEN) is what is true now.
- QUESTION: what the user wants to know.

HOW TO WORK
Step 1. Find every section that is about the question. Read them fully.
Step 2. If something changed over time, give the latest state and say briefly how it got there.
Step 3. Write the answer.

RULES
- Use only what the ARCHIVE says. If it does not say, answer that it is not in the archive. Never guess or invent.
- After each claim, cite the section you used: copy its heading line exactly, inside double brackets.
    e.g. 둘은 그날 밤 약속을 했어요 [[## Y2 #48–#63 — The night ridge]]
- Always answer in Korean, whatever language the archive or the question is in.
- Write names the way the archive spells them.
- Be short and direct. No introduction.`;

export const askLog = new Map(); // chat id → [{ q, a }], this session only

// Answer HTML: the model's text, with [[heading]] citations turned into chips that open that section's text
export function renderAnswer(text, secs) {
    const cited = [];
    const html = aiHtml(text).replace(/\[\[(.+?)\]\](?!\])/g, (all, raw) => {
        const plain = $('<i>').html(raw).text();
        const s = findCited(secs, plain);
        if (!s) return `<span class="na_cite na_cite_miss" title="아카이브에서 못 찾은 제목">${raw}</span>`;
        if (!cited.includes(s)) cited.push(s);
        const short = (s.title.match(/^(?:\S+\s+)?#\d+\s*[–—~-]\s*#?\d+/) || [s.title.slice(0, 30)])[0];
        return `<button type="button" class="na_cite" data-start="${s.start}" title="${esc(s.title)}"><i class="fa-solid fa-bookmark"></i> ${esc(short)}</button>`;
    });
    return { html, cited };
}

export const ASK_SVG_BOOKMARK = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>';
export const ASK_SVG_SEND = '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4z"/></svg>';

// Ask's answer: the text without the [[...]] markers, plus a row of bookmark chips under the bubble
export function askAnswerHtml(text, secs) {
    const $a = $('<div>').html(renderAnswer(text, secs).html);
    const seen = new Set();
    const chips = [];
    $a.find('.na_cite').each(function () {
        const $c = $(this);
        const key = $c.attr('data-start') ?? ('miss:' + $c.text());
        $c.find('i').remove();
        const label = $c.text().trim();
        if (!seen.has(key)) {
            seen.add(key);
            chips.push($c.is('[data-start]')
                ? `<button type="button" class="na_cite na_ask2_cite" data-start="${$c.attr('data-start')}" title="${esc(($c.attr('title') || '') + ' — 누르면 근거가 펼쳐져요')}">${ASK_SVG_BOOKMARK}${esc(label)}</button>`
                : `<span class="na_cite na_ask2_cite na_cite_miss" title="아카이브에서 못 찾은 제목">${ASK_SVG_BOOKMARK}${esc(label)}</span>`);
        }
        $c.remove();
    });
    $a.find('p, li').filter(function () { return !$(this).text().trim() && !$(this).children().length; }).remove();
    const body = $a.html().replace(/\s+([.,!?。、])/g, '$1').replace(/\(\s*\)/g, '').replace(/(\s*<br>\s*)+$/, '');
    return `<div class="na_ask2_ans"><div class="na_ask_a">${body}</div>${chips.length ? `<div class="na_ask2_cites">${chips.join('')}</div>` : ''}</div>`;
}

export async function openAsk() {
    const c = ctx();
    const m = getMeta();
    if (!m.text.trim()) return toastr.info('아카이브가 비어 있어요.');
    const chatId = currentChatId();
    if (!askLog.has(chatId)) askLog.set(chatId, []);
    const log = askLog.get(chatId);
    const $root = $(`
      <div class="na_popup na_v2 na_ask na_ask2">
        <div class="na_v2_title"><b>아카이브에 질문</b><small>아카이브에 적힌 것만 근거로 답해요</small></div>
        <div class="na_ask_log"></div>
        <div class="na_v2_chips na_ask2_sugg">
          <button type="button">둘이 처음 만난 곳?</button>
          <button type="button">아직 안 풀린 떡밥?</button>
        </div>
        <div class="na_ask2_input">
          <textarea class="na_ask_q" rows="1" placeholder="질문을 적어 주세요" aria-label="질문"></textarea>
          <button type="button" class="na_ask_go" aria-label="물어보기" title="물어보기 (Ctrl+Enter)">${ASK_SVG_SEND}</button>
        </div>
        <small class="na_v2_foot na_ask_info"></small>
      </div>`);
    const $log = $root.find('.na_ask_log');
    const secs = parseSections(m.text);
    let pending = '';
    const waitHtml = q => `<div class="na_ask_item"><div class="na_ask_qq">${esc(q)}</div><div class="na_ask_a na_ask2_wait"><span class="na_ask2_dots"><i></i><i></i><i></i></span>아카이브를 읽는 중</div></div>`;
    const draw = () => {
        $log.html(log.length || pending
            ? log.map(x => `<div class="na_ask_item"><div class="na_ask_qq">${esc(x.q)}</div>${askAnswerHtml(x.a, secs)}</div>`).join('') + (pending ? waitHtml(pending) : '')
            : '<div class="na_empty">물어본 게 아직 없어요.</div>');
        $log.scrollTop($log[0].scrollHeight);
    };
    $log.on('click', '.na_cite[data-start]', function () {
        const start = Number($(this).data('start'));
        const $ans = $(this).closest('.na_ask2_ans');
        const $open = $ans.find('.na_ask_src');
        $ans.find('.na_cite').removeClass('on');
        if ($open.length && $open.data('start') === start) return $open.remove();
        $open.remove();
        const sec = secs.find(x => x.start === start);
        if (!sec) return;
        const body = m.text.slice(sec.start, sec.end).replace(/^[^\n]*\n?/, '');
        const plain = body.replace(/^\s*[A-Z][A-Z ]*:\s*$/gm, '').replace(/^\s*[-*]\s+/gm, '').replace(/[*_`]/g, '').replace(/\s*\n\s*/g, ' ').trim();
        const $src = $(`<div class="na_ask_src"><div class="na_ask2_ex" title="눌러서 전부 보기"></div><div class="na_ask_src_body"></div><div class="na_ask2_srcfoot"><button type="button" class="na_linkbtn na_ask2_more">전부 보기</button><button type="button" class="na_linkbtn na_ask2_goto">섹션 카드에서 보기</button></div></div>`).data('start', start);
        $src.find('.na_ask2_ex').text(plain);
        $src.find('.na_ask_src_body').html(mdBlock(body));
        const toggle = () => { $src.toggleClass('open'); $src.find('.na_ask2_more').text($src.hasClass('open') ? '접기' : '전부 보기'); };
        $src.find('.na_ask2_ex, .na_ask2_more').on('click', toggle);
        $src.find('.na_ask2_goto').on('click', () => {
            $root.closest('dialog').find('.popup-button-ok').trigger('click');
            gotoSection(start);
        });
        $(this).addClass('on');
        $ans.append($src);
    });
    countTokens(m.text).then(n => $root.find('.na_ask_info').text(`질문마다 아카이브 전체(약 ${fmt(n)} 토큰)를 AI 기능 모델에 보내요`).attr('title', `지금 연결: ${aiLabel()}`));
    const $q = $root.find('.na_ask_q');
    const go = async () => {
        const q = $q.val().trim();
        if (!q || pending) return;
        pending = q; $q.val(''); draw();
        const a = await withSpinner($root.find('.na_ask_go'), '', () => askAI(`[ARCHIVE]\n${m.text}\n\n[QUESTION]\n${q}`, { system: AI_SYS_ASK, maxTokens: 1500 }));
        pending = '';
        if (a === null) { $q.val(q); draw(); return; }
        log.push({ q, a });
        if (log.length > 20) log.shift();
        $q.val('');
        draw();
    };
    $root.find('.na_ask_go').on('click', go);
    $root.on('click', '.na_ask2_sugg button', function () { $q.val(this.textContent); go(); });
    $q.on('keydown', e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); go(); } });
    draw();
    await c.callGenericPopup($root, c.POPUP_TYPE.TEXT, '', { wide: true, large: true, allowVerticalScrolling: true, leftAlign: true, okButton: '닫기' });
}

// Open the sections tab on one section
export function gotoSection(start) {
    const $p = $('#na_settings');
    const $drawer = $p.find('.inline-drawer-content');
    if ($drawer.length && !$drawer.is(':visible')) $p.find('.inline-drawer-toggle').trigger('click');
    showTab('archive');
    showArchiveView('cards');
    setTimeout(() => sectionPanel?.focus(start), 50);
}
