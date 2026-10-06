// A section shown in place, under whatever was tapped: its text, a Korean toggle that reuses the reader's
// translations (lines already translated show at once, only the rest go to the translation model), and a way to the card.

import { getMeta } from './core.js';
import { mdBlock } from './reader.js';
import { trCachedLines, trLineOk, translateLines, withLineTr } from './translate.js';
import { esc } from './util.js';

const TR_ICON = '<i class="fa-solid fa-language"></i>';

// s: a section from parseSections; onGoto(start): open it in the section cards
export function sectionPeek(s, { onGoto } = {}) {
    const m = getMeta();
    const body = m.text.slice(s.start, s.end).replace(/^[^\n]*\n?/, '').trim();
    const lines = [...new Set(body.split('\n').filter(trLineOk).map(l => l.trim()))];
    const map = new Map();
    const fill = () => { trCachedLines(lines).forEach((t, i) => { if (t) map.set(lines[i], t); }); return map.size; };
    let korean = false, busy = false;
    const $p = $(`
      <div class="na_peek" data-start="${s.start}">
        <div class="na_peek_head"><b>${esc(s.title)}</b><button type="button" class="na_peek_x" aria-label="닫기" title="닫기">✕</button></div>
        <div class="na_peek_body"></div>
        <div class="na_peek_foot">
          <button type="button" class="na_linkbtn na_peek_tr">${TR_ICON} 한국어로</button>
          <small class="na_peek_info"></small>
          ${onGoto ? '<button type="button" class="na_linkbtn na_peek_go">섹션 카드에서 보기</button>' : ''}
        </div>
      </div>`);
    const render = () => {
        $p.find('.na_peek_body').html(mdBlock(korean ? withLineTr(body, map) : body));
        $p.find('.na_peek_tr').html(korean ? `${TR_ICON} 원문으로` : `${TR_ICON} 한국어로`);
        const n = fill();
        $p.find('.na_peek_info').text(korean ? (n < lines.length ? `${n}/${lines.length}줄 번역됨` : '') : n ? `번역 ${n === lines.length ? '있음' : `${n}/${lines.length}줄 있음`}` : '');
    };
    $p.on('click', '.na_peek_x', () => $p.remove());
    $p.on('click', '.na_peek_go', () => onGoto?.(s.start));
    $p.on('click', '.na_peek_tr', async function () {
        if (busy) return;
        if (korean) { korean = false; return render(); }
        fill();
        const missing = lines.filter(l => !map.has(l));
        if (missing.length) {
            busy = true;
            $(this).prop('disabled', true).html('<i class="fa-solid fa-spinner fa-spin"></i> 번역하는 중…');
            try {
                const tr = await translateLines(missing);
                missing.forEach((l, i) => { if (tr[i]) map.set(l, tr[i]); });
            } catch (e) { toastr.error(String(e?.message || e), '번역 실패'); }
            busy = false;
            $(this).prop('disabled', false);
            if (!map.size) return render();
        }
        korean = true;
        render();
    });
    fill();
    render();
    return $p;
}
