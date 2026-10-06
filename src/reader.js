// Reading mode: a rendered view of the archive.

import { ctx, getMeta, globalSettings, saveGlobal } from './core.js';
import { groupLabel, linkWaiting, mutedSet, parseSections, sectionKey } from './sections.js';
import { srcButton } from './source.js';
import { openGlossary, translateLines } from './translate.js';
import { confirm, esc } from './util.js';

// Small markdown renderer for the archive's own format (headings, bullets, rules, emphasis). Escapes first.
export function mdInline(t) {
    return esc(t)
        .replace(/`([^`]+)`/g, '<code>$1</code>')
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/(^|[^\w*])\*(?!\s)(.+?)\*(?!\w)/g, '$1<em>$2</em>')
        .replace(/(^|[^\w])_(?!\s)(.+?)_(?!\w)/g, '$1<em>$2</em>');
}

export function mdBlock(text) {
    const out = [];
    let list = null, para = [];
    const flushPara = () => { if (para.length) out.push(`<p>${para.map(mdInline).join('<br>')}</p>`); para = []; };
    const flushList = () => { if (list) out.push(`<ul>${list.map(x => `<li>${mdInline(x)}</li>`).join('')}</ul>`); list = null; };
    for (const line of text.split('\n')) {
        const t = line.trimEnd();
        let mt;
        if (!t.trim()) { flushPara(); flushList(); continue; }
        if ((mt = t.match(/^(#{1,3}) (.*)$/))) {
            flushPara(); flushList();
            const lv = mt[1].length;
            out.push(`<h${lv + 1} class="na_rd_h${lv}">${mdInline(lv === 1 ? groupLabel(mt[2]) : mt[2])}</h${lv + 1}>`);
        } else if (/^-{3,}$/.test(t.trim())) { flushPara(); flushList(); out.push('<hr>'); }
        else if ((mt = t.match(/^\s*[-*] (.*)$/))) { flushPara(); (list ||= []).push(mt[1]); }
        else if (list && /^\s{2,}\S/.test(t)) list[list.length - 1] += ` ${t.trim()}`;
        else { flushList(); para.push(t); }
    }
    flushPara(); flushList();
    return out.join('');
}

export function renderReading(m, { show } = {}) {
    const muted = mutedSet(m);
    const waiting = linkWaiting(m);
    const trimmed = new Set();
    const secs = parseSections(m.text);
    const toc = [];
    let skipLevel = 0;
    const html = secs.map((s, i) => {
        if (skipLevel && s.level <= skipLevel) skipLevel = 0;
        const off = muted.has(sectionKey(s));
        if (off && s.group) skipLevel = s.level;
        const dim = off || skipLevel > 0;
        const wait = !dim && waiting.has(sectionKey(s));
        const cut = !dim && !wait && trimmed.has(sectionKey(s));
        const id = `na_rd_${i}`;
        if (s.title !== '(머리말)' && s.title !== '(제목 없음)') toc.push({ id, level: s.level, title: s.group ? groupLabel(s.title) : s.title });
        const tag = dim ? '<span class="na_rd_tag">주입 안 함</span>' : wait ? '<span class="na_rd_tag">키워드 대기</span>' : cut ? '<span class="na_rd_tag na_rd_tag_cut">상한으로 빠짐</span>' : '';
        const src = !s.group ? srcButton(m, s.title, 'chip') : '';
        const raw = m.text.slice(s.start, s.end);
        return `<section id="${id}" class="na_rd_sec ${dim || wait ? 'na_rd_off' : ''} ${cut ? 'na_rd_cut' : ''}">${tag}${src ? `<div class="na_rd_src">${src}</div>` : ''}${mdBlock(show ? show(raw) : raw)}</section>`;
    }).join('');
    return { html, toc };
}

export async function openReader() {
    const c = ctx();
    const $root = $(`
      <div class="na_popup">
        <div class="na_rd_bar">
          <select class="text_pole na_rd_toc"></select>
          <button type="button" class="na_icon na_rd_smaller" title="글자 작게"><i class="fa-solid fa-minus"></i></button>
          <button type="button" class="na_icon na_rd_bigger" title="글자 크게"><i class="fa-solid fa-plus"></i></button>
        </div>
        <div class="na_rd_trbar">
          <button type="button" class="na_btn na_small na_rd_tr"><i class="fa-solid fa-language"></i> 한국어로 읽기</button>
          <button type="button" class="na_linkbtn na_rd_gloss"><i class="fa-solid fa-spell-check"></i> 용어집</button>
          <small class="na_dim na_rd_trinfo"></small>
        </div>
        <article class="na_reader"></article>
      </div>`);
    const g = globalSettings();
    const applyFont = () => $root.find('.na_reader').css('font-size', `${g.readSize || 1}em`);
    const { html, toc } = renderReading(getMeta());
    $root.find('.na_reader').html(html || '<div class="na_empty">아카이브가 비어 있어요.</div>');
    $root.find('.na_rd_toc').html('<option value="">목차로 이동…</option>' + toc.map(t =>
        `<option value="${t.id}">${'\u00a0\u00a0'.repeat(Math.max(0, t.level - 1))}${esc(t.title)}</option>`).join(''));
    applyFont();
    $root.find('.na_rd_toc').on('change', function () {
        const el = this.value && $root.find(`#${this.value}`)[0];
        if (el) el.scrollIntoView({ block: 'start', behavior: 'smooth' });
        this.value = '';
    });
    // ---- whole-archive Korean: line by line, kept in the chat's translation memory
    const m = getMeta();
    const lineOk = l => /[\p{L}]{2,}/u.test(l) && !/^\s*-{3,}\s*$/.test(l);
    let korean = false, busy = false;
    const lineMap = new Map();
    const show = raw => raw.split('\n').map(l => {
        if (!lineOk(l)) return l;
        const t = lineMap.get(l.trim());
        if (!t) return l;
        // keep the line's markdown lead ("## ", "- ") if the model dropped it
        const lead = l.match(/^\s*(#{1,3} |[-*] )/)?.[1] || '';
        return lead ? `${lead}${t.replace(/^\s*(?:#{1,3}|[-*])\s+/, '')}` : t;
    }).join('\n');
    const rerender = () => {
        const top = $root.closest('.popup-content, dialog').scrollTop?.() ?? 0;
        $root.find('.na_reader').html(renderReading(m, korean ? { show } : {}).html);
        $root.closest('.popup-content, dialog').scrollTop?.(top);
    };
    const runTr = async (fresh = false) => {
        if (busy) return;
        busy = true;
        const $b = $root.find('.na_rd_tr').prop('disabled', true);
        const secs = parseSections(m.text);
        const all = [...new Set(m.text.split('\n').filter(lineOk).map(l => l.trim()))];
        // sections in groups of ~10k characters so the reader fills in as it goes
        const groups = [];
        let cur = [], size = 0;
        for (const s of secs) {
            const ls = m.text.slice(s.start, s.end).split('\n').filter(lineOk).map(l => l.trim());
            cur.push(...ls); size += ls.join('').length;
            if (size > 10_000) { groups.push(cur); cur = []; size = 0; }
        }
        if (cur.length) groups.push(cur);
        let failed = 0;
        try {
            for (let i = 0; i < groups.length; i++) {
                if (!$root.closest('body').length) return; // popup closed
                $b.html(`<i class="fa-solid fa-spinner fa-spin"></i> 번역하는 중… ${i + 1}/${groups.length}`);
                const uniq = [...new Set(groups[i])];
                const tr = await translateLines(uniq, { fresh });
                uniq.forEach((l, k) => tr[k] ? lineMap.set(l, tr[k]) : failed++);
                korean = true;
                rerender();
            }
        } catch (e) {
            toastr.error(String(e?.message || e), '번역 실패');
        } finally {
            busy = false;
            $b.prop('disabled', false).html(korean ? '<i class="fa-solid fa-language"></i> 원문으로 보기' : '<i class="fa-solid fa-language"></i> 한국어로 읽기');
            const done = all.filter(l => lineMap.has(l)).length;
            $root.find('.na_rd_trinfo').html(korean ? `${done}/${all.length}줄 번역됨 · <button type="button" class="na_linkbtn na_rd_retr">다시 번역</button>` : '');
            if (failed) toastr.info(`${failed}줄은 번역이 안 왔어요. 다시 누르면 그 줄만 보내요.`);
        }
    };
    $root.find('.na_rd_tr').on('click', () => {
        if (korean && !busy) { korean = false; rerender(); $root.find('.na_rd_tr').html('<i class="fa-solid fa-language"></i> 한국어로 읽기'); $root.find('.na_rd_trinfo').empty(); return; }
        runTr(false);
    });
    $root.on('click', '.na_rd_retr', async () => {
        if (!await confirm('다시 번역', '저장된 번역을 쓰지 않고 아카이브 전체를 새로 번역할까요? 토큰이 들어가요.')) return;
        runTr(true);
    });
    $root.find('.na_rd_gloss').on('click', async () => { await openGlossary(); if (korean) runTr(false); });
    $root.find('.na_rd_smaller, .na_rd_bigger').on('click', function () {
        const d = $(this).hasClass('na_rd_bigger') ? 0.1 : -0.1;
        g.readSize = Math.min(1.6, Math.max(0.8, Math.round(((g.readSize || 1) + d) * 10) / 10));
        saveGlobal(); applyFont();
    });
    await c.callGenericPopup($root, c.POPUP_TYPE.TEXT, '', { wide: true, large: true, allowVerticalScrolling: true, leftAlign: true, okButton: '닫기' });
}
