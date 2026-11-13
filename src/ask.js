// Ask the archive.

import { loreBlock } from './lore.js';
import { aiHtml, aiLabel, askAI, withSpinner } from './ai.js';
import { currentChatId } from './chats.js';
import { ctx, getMeta, globalSettings, saveGlobal } from './core.js';
import { archiveLang } from './prompts.js';
import { bm25, estTok, pick, rawItems, recallLine, sectionItems, withGlossary } from './recall.js';
import { openSource } from './source.js';
import { sectionPanel, showArchiveView, showTab } from './panel.js';
import { mdBlock } from './reader.js';
import { findCited, parseSections, splitTail } from './sections.js';
import { countTokens, esc, fmt } from './util.js';

// ---- prompts

export const AI_SYS_ASK = `GOAL
Answer the user's question about their story using ONLY what you are given.

YOU GET
- HEADINGS (sometimes): every section heading of the story archive, in story order. An outline: what happened when.
- SECTIONS: the archive sections found for this question, in full, plus the archive's end (STATE, OPEN) when there is one. Each section starts with a heading line like "## Y2 #48–#63 — The night ridge". The END of the archive is what is true now.
- ORIGINAL LINES (sometimes): passages from the original chat messages found for this question, each starting with its message number, like [#512 Ivo].
- QUESTION: what the user wants to know.
You may not see the whole archive: only the parts that were found for this question.

HOW TO WORK
Step 1. Find everything in what you got that is about the question. Read it fully.
Step 2. If something changed over time, give the latest state and say briefly how it got there.
Step 3. Write the answer.

RULES
- Use only what you were given. If it is not there, say that you could not find it. Never guess or invent.
- After each claim, cite where it came from:
    a section: copy its heading line exactly, inside double brackets.  e.g. 둘은 그날 밤 약속을 했어요 [[## Y2 #48–#63 — The night ridge]]
    an original line: its message number.  e.g. 처음 한 말은 "돌아와"였어요 #512
- Always answer in Korean, whatever language the archive or the question is in.
- Write names the way the archive spells them.
- Be short and direct. No introduction.`;

// When the question and the archive are in different languages (or nothing matched), the AI picks sections from the headings first
export const AI_SYS_ASK_PICK = `GOAL
A user asks a question about their story. Pick the archive sections that can answer it, and give search words for the original chat.

YOU GET
- HEADINGS: numbered section headings of the story archive, in story order.
- QUESTION.

OUTPUT: exactly two lines, nothing else
PICK: up to 6 heading numbers, most useful first, e.g. 12, 3, 40
WORDS: 3 to 8 search words for the original chat: names, places, objects, key nouns, in the archive's language AND in Korean
If no heading fits, write PICK: none`;

// what goes to the model for one question: found sections and original lines, or the whole archive
export async function askContext(m, q, { whole = false } = {}) {
    if (whole) return { prompt: `[SECTIONS]\n${m.text}\n\n[QUESTION]\n${q}`, secs: [], raws: [], picked: false };
    const items = sectionItems(m);
    const [, tail] = splitTail(m.text);
    const qq = withGlossary(m, q);
    let secHits = pick(bm25(items, qq), { k: 6, budget: 9000, minHits: 1 }).map(r => r.item);
    let words = '';
    const hangulQ = /[\uac00-\ud7af]/.test(q), lang = archiveLang(m.text);
    let picked = false;
    if (items.length > 6 && (!secHits.length || (hangulQ && lang === 'en'))) {
        const heads = items.map((x, i) => `${i + 1}. ${x.title}`).join('\n');
        try {
            const out = await askAI(`[HEADINGS]\n${heads}\n\n[QUESTION]\n${q}`, { system: AI_SYS_ASK_PICK, maxTokens: 1024 });
            const line = (out.match(/PICK\s*:\s*(.*)$/im) || [, ''])[1];
            const nums = /^\s*none\b/i.test(line) ? [] : [...new Set((line.match(/\d+/g) || []).map(Number))].filter(n => n >= 1 && n <= items.length);
            words = (out.match(/WORDS\s*:\s*(.*)$/im) || [, ''])[1];
            const chosen = nums.slice(0, 6).map(n => items[n - 1]);
            secHits = [...new Set([...chosen, ...secHits])].slice(0, 7);
            picked = true;
        } catch (e) { console.warn('[narrative-archive] ask pick', e); }
    }
    const rawHits = pick(bm25(rawItems(), `${qq}\n${words}`), { k: 6, budget: 2500, minHits: 1 }).map(r => r);
    const order = new Map(items.map((x, i) => [x, i]));
    secHits.sort((a, b) => order.get(a) - order.get(b));
    const heads = items.length > secHits.length ? items.map(x => `## ${x.title}`).join('\n') : '';
    const lore = await loreBlock(`${q}\n${secHits.map(x => x.text).join('\n')}`);
    const prompt = `${heads ? `[HEADINGS]\n${heads}\n\n` : ''}[SECTIONS]\n${secHits.map(x => x.text.trim()).join('\n\n') || '(none found)'}${tail.trim() ? `\n\n${tail.trim()}` : ''}${rawHits.length ? `\n\n[ORIGINAL LINES]\n${rawHits.sort((a, b) => a.item.i - b.item.i).map(recallLine).join('\n')}` : ''}${lore}\n\n[QUESTION]\n${q}`;
    return { prompt, secs: secHits, raws: rawHits, picked };
}

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
const ASK_SVG_FIND = '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/></svg>';
const ASK_SUGS = ['둘이 처음 만난 곳?', '아직 안 풀린 떡밥?', '최근에 한 약속?'];
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
    let body = $a.html().replace(/\s+([.,!?。、])/g, '$1').replace(/\(\s*\)/g, '').replace(/(\s*<br>\s*)+$/, '');
    // "#512" outside tags: opens that original message
    body = body.split(/(<[^>]+>)/).map(part => (part.startsWith('<') ? part : part.replace(/(^|[^\w&#])#(\d{1,6})\b/g, '$1<button type="button" class="na_cite na_cite_msg" data-msg="$2" title="원문 메시지 #$2 보기">#$2</button>'))).join('');
    return `<div class="na_ask2_ans"><div class="na_ask_a">${body}</div>${chips.length ? `<div class="na_ask2_cites">${chips.join('')}</div>` : ''}</div>`;
}
// the sections an answer leaned on, as rows under it: the number and name, then the section's first line
function askSourceRows(html, secs, text) {
    const $a = $('<div>').html(html);
    $a.find('.na_ask2_cite[data-start]').each(function () {
        const sec = secs.find(x => x.start === Number(this.dataset.start));
        if (!sec) return;
        const [num, ...rest] = sec.title.split(' — ');
        const name = rest.join(' — ').replace(/\s*\([^)]*\)\s*$/, '');
        const first = text.slice(sec.start, sec.end).split('\n').slice(1).map(l => l.replace(/^\s*[-*•]\s*/, '').trim()).find(l => l && !/^[A-Z][A-Z ]*:$/.test(l)) || '';
        $(this).addClass('na_ask3_src').html(`<i></i><span><b>${esc(num)}${name ? ` · ${esc(name)}` : ''}</b>${first ? `<small>${esc(first)}</small>` : ''}</span>`);
    });
    return $a.html();
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
        <div class="na_v2_title"><b>아카이브에 질문</b><small>아카이브와 원문에서 찾은 것만 근거로 답해요</small></div>
        <div class="na_ask_log"></div>
        <div class="na_ask3_empty">
          <div class="na_ask3_hello"><span class="na_ask3_big">${ASK_SVG_FIND}</span><b>무엇이든 물어보세요</b><small>찾은 섹션과 원문 번호를 같이 보여줘요</small></div>
          <div class="na_ask3_sect">이런 걸 물어볼 수 있어요</div>
          <div class="na_v2_card na_ask3_sugs na_ask2_sugg">${ASK_SUGS.map(x => `<button type="button"><span class="na_ask3_si">${ASK_SVG_FIND}</span><span>${x}</span></button>`).join('')}</div>
        </div>
        <div class="na_v2_chips na_ask2_sugg na_ask3_chips">${ASK_SUGS.slice(0, 2).map(x => `<button type="button">${x}</button>`).join('')}</div>
        <div class="na_ask2_input">
          <textarea class="na_ask_q" rows="1" placeholder="질문을 적어 주세요" aria-label="질문"></textarea>
          <button type="button" class="na_ask_go" aria-label="물어보기" title="물어보기 (Ctrl+Enter)">${ASK_SVG_SEND}</button>
        </div>
        <div class="na_ask3_opt"><small class="na_ask_info"></small><span class="na_ask3_seg" role="radiogroup" aria-label="보낼 범위"><button type="button" data-v="sec">맞는 섹션만</button><button type="button" data-v="all">아카이브 전체</button></span></div>
      </div>`);
    const $log = $root.find('.na_ask_log');
    const secs = parseSections(m.text);
    let pending = '';
    const waitHtml = q => `<div class="na_ask_item"><div class="na_ask_qq">${esc(q)}</div><div class="na_ask_a na_ask2_wait"><span class="na_ask2_dots"><i></i><i></i><i></i></span>아카이브를 읽는 중</div></div>`;
    const draw = () => {
        $log.html(log.length || pending
            ? log.map(x => `<div class="na_ask_item"><div class="na_ask_qq">${esc(x.q)}</div>${askSourceRows(askAnswerHtml(x.a, secs), secs, m.text)}</div>`).join('') + (pending ? waitHtml(pending) : '')
            : '');
        $root.toggleClass('na_ask3_new', !log.length && !pending);
        // the window scrolls (the log is not a scroll box of its own): newest answer in view
        const sc = $root.closest('.popup-content')[0];
        if (sc) sc.scrollTop = sc.scrollHeight;
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
    const g = globalSettings();
    const info = async last => {
        const whole = !!g.askWhole;
        const n = whole ? await countTokens(m.text) : last;
        $root.find('.na_ask_info').text(whole ? `질문마다 약 ${fmt(n)} 토큰` : last ? `지난번 약 ${fmt(last)} 토큰` : '').attr('title', `지금 연결: ${aiLabel()}`);
        $root.find('.na_ask3_seg button').removeClass('on').filter(`[data-v="${whole ? 'all' : 'sec'}"]`).addClass('on');
    };
    info(0);
    $root.on('click', '.na_ask3_seg button', function () { g.askWhole = this.dataset.v === 'all'; saveGlobal(); info(0); });
    $log.on('click', '.na_cite_msg', function () { const n = Number(this.dataset.msg); openSource(n, n, `#${n}`); });
    const $q = $root.find('.na_ask_q');
    const go = async () => {
        const q = $q.val().trim();
        if (!q || pending) return;
        pending = q; $q.val(''); draw();
        const a = await withSpinner($root.find('.na_ask_go'), '', async () => {
            const cx = await askContext(m, q, { whole: !!g.askWhole });
            if (!g.askWhole) info(estTok(cx.prompt) + estTok(AI_SYS_ASK));
            return askAI(cx.prompt, { system: AI_SYS_ASK, maxTokens: 5000 });
        });
        pending = '';
        if (a === null) { $q.val(q); draw(); return; }
        log.push({ q, a });
        if (log.length > 20) log.shift();
        $q.val('');
        draw();
    };
    $root.find('.na_ask_go').on('click', go);
    $root.on('click', '.na_ask2_sugg button', function () { $q.val(this.textContent.trim()); go(); });
    $q.on('keydown', e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); go(); } });
    draw();
    await c.callGenericPopup($root, c.POPUP_TYPE.TEXT, '', { wide: true, large: false, allowVerticalScrolling: true, leftAlign: true, okButton: '닫기' });
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
