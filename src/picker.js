// Section picker used by the AI tools that read the archive in parts.

import { groupLabel, parseSections, sectionKey, trimEnd } from './sections.js';
import { esc, fmt } from './util.js';

// A checklist of the archive's sections (groups with tri-state boxes, quick picks, ✓ for ones already read)
// that sends the chosen ones to onGo a few thousand tokens at a time, so the model reads every part.

export const PICK_CHUNK_TOK = 6000;
export const estTok = t => Math.ceil(String(t).length / 3.6);

export function mountSectionPicker($host, { m, title, doneKeys, doneLabel = '읽음', goLabel, extraFoot = '', onGo }) {
    const $p = $(`
      <div class="na_sp" hidden>
        <div class="na_sp_head">
          <b>${esc(title)}</b>
          <span class="na_sp_quick">
            <button type="button" class="na_pchip" data-sel="new">안 읽은 것</button>
            <button type="button" class="na_pchip" data-sel="all">전체</button>
            <button type="button" class="na_pchip" data-sel="none">비우기</button>
          </span>
        </div>
        <div class="na_sp_secs"></div>
        ${extraFoot}
        <div class="na_sp_foot">
          <small class="na_dim na_sp_info"></small>
          <button type="button" class="na_btn na_small na_primary na_sp_go"><i class="fa-solid fa-wand-magic-sparkles"></i> ${esc(goLabel)}</button>
        </div>
      </div>`);
    $host.append($p);
    const allSecs = () => parseSections(m.text).filter(x => !x.group && x.title !== '(머리말)');
    let chosen = null;
    const chunk = secs => {
        const out = [];
        let cur = [], tok = 0;
        for (const x of secs) {
            const t = estTok(m.text.slice(x.start, x.end));
            if (cur.length && tok + t > PICK_CHUNK_TOK) { out.push(cur); cur = []; tok = 0; }
            cur.push(x); tok += t;
        }
        if (cur.length) out.push(cur);
        return out;
    };
    const selected = () => allSecs().filter(x => chosen.has(sectionKey(x)));
    const info = () => {
        const secs = selected();
        const tok = secs.reduce((a, x) => a + estTok(m.text.slice(x.start, x.end)), 0);
        const parts = chunk(secs).length;
        $p.find('.na_sp_info').text(secs.length ? `섹션 ${secs.length}개 · 약 ${fmt(tok)} 토큰${parts > 1 ? ` · ${parts}번에 나눠 읽어요` : ''}` : '섹션을 골라 주세요');
        $p.find('.na_sp_go').prop('disabled', !secs.length || busy);
        $p.find('.na_sp_g input').each(function () {
            const keys = String($(this).data('keys')).split('\u0002');
            const n = keys.filter(k => chosen.has(k)).length;
            this.checked = n === keys.length; this.indeterminate = n > 0 && n < keys.length;
        });
    };
    const draw = () => {
        const done = doneKeys();
        // "# ── Y1 ──" groups with their cards; top-level cards (title, STATE, OPEN) go in unlabeled runs
        const rows = [];
        let grp = { label: '', items: [] };
        const flush = () => { if (grp.items.length) rows.push(grp); };
        for (const x of parseSections(m.text)) {
            if (x.title === '(머리말)') continue;
            if (x.group) { flush(); grp = { label: groupLabel(x.title), items: [] }; continue; }
            if (x.level === 1 && grp.label) { flush(); grp = { label: '', items: [] }; }
            grp.items.push(x);
        }
        flush();
        $p.find('.na_sp_secs').html(rows.map(g => `
          <div class="na_sp_sg">
            ${g.label ? `<label class="na_sp_g"><input type="checkbox" data-keys="${esc(g.items.map(sectionKey).join('\u0002'))}"><b>${esc(g.label)}</b><small class="na_dim">${g.items.length}개</small></label>` : ''}
            ${g.items.map(x => `<label class="na_sp_s ${g.label ? '' : 'na_sp_s_top'}"><input type="checkbox" data-k="${esc(sectionKey(x))}" ${chosen.has(sectionKey(x)) ? 'checked' : ''}>
              <span>${esc(x.title)}</span>${done.has(sectionKey(x)) ? `<small class="na_sp_done"><i class="fa-solid fa-check"></i> ${esc(doneLabel)}</small>` : ''}</label>`).join('')}
          </div>`).join(''));
        info();
    };
    const select = how => {
        const done = doneKeys();
        chosen = new Set(allSecs().map(sectionKey).filter(k => how === 'all' || (how === 'new' && !done.has(k))));
        draw();
    };
    $p.on('click', '.na_sp_quick .na_pchip', function () { select($(this).data('sel')); });
    $p.on('change', '.na_sp_s input', function () { const k = String($(this).data('k')); this.checked ? chosen.add(k) : chosen.delete(k); info(); });
    $p.on('change', '.na_sp_g input', function () {
        String($(this).data('keys')).split('\u0002').forEach(k => this.checked ? chosen.add(k) : chosen.delete(k));
        $(this).closest('.na_sp_sg').find('.na_sp_s input').prop('checked', this.checked);
        info();
    });
    let busy = false;
    $p.find('.na_sp_go').on('click', async function () {
        const secs = selected();
        if (!secs.length || busy) return;
        const parts = chunk(secs);
        const $b = $(this), html = $b.html();
        busy = true; $b.prop('disabled', true);
        let done = 0;
        try {
            await onGo(parts, async (part, i, label) => { $b.html(`<i class="fa-solid fa-spinner fa-spin"></i> ${esc(label || `읽는 중… ${i + 1}/${parts.length}`)}`); }, () => { done++; draw(); });
        } catch (e) {
            console.error('[NarrativeArchive] AI', e);
            toastr.error(`${done}/${parts.length}까지 하고 멈췄어요: ${String(e?.message || e)}`, 'AI 요청 실패');
        } finally { busy = false; $b.html(html); info(); }
    });
    return {
        $el: $p,
        toggle(open = $p.prop('hidden')) {
            $p.prop('hidden', !open);
            if (open) { if (!chosen) select(doneKeys().size ? 'new' : 'all'); else draw(); }
            return open;
        },
        text: part => part.map(x => trimEnd(m.text.slice(x.start, x.end))).join('\n\n'),
    };
}
