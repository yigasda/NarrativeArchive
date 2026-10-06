// Shared world books: setting text kept once in the global settings and switched on per chat.

import { commitText, ctx, getMeta, globalSettings, newId, saveGlobal, saveMeta } from './core.js';
import { applyInjection } from './inject.js';
import { sectionPanel, syncPanel } from './panel.js';
import { faceHtml } from './people.js';
import { parseSections } from './sections.js';
import { confirm, countTokens, esc, fmt } from './util.js';

// World-setting text (places, myths, rules) kept once in the global settings and switched on per chat.
// g.worlds = [{ id, name, text, chars: [avatar] }]; m.worldOn = { id: true|false } — unset means "on if bound to this character"
export const worldBooks = () => { const g = globalSettings(); if (!Array.isArray(g.worlds)) g.worlds = []; return g.worlds; };
export const charKey = () => { const c = ctx(); return c.groupId ? `group:${c.groupId}` : String(c.characters?.[c.characterId]?.avatar || ''); };
export const charName = () => { const c = ctx(); return c.groupId ? ((c.groups || []).find(x => x.id === c.groupId)?.name || '그룹') : (c.characters?.[c.characterId]?.name || ''); };

export function worldIsOn(m, w) {
    const v = m?.worldOn?.[w.id];
    if (v === true || v === false) return v;
    const k = charKey();
    return !!k && Array.isArray(w.chars) && w.chars.includes(k);
}

export function worldText(m) {
    return worldBooks().filter(w => String(w.text || '').trim() && worldIsOn(m, w))
        .map(w => `# WORLD — ${w.name || '세계관'}\n_Shared setting reference: true in every story in this world._\n\n${String(w.text).trim()}`).join('\n\n');
}

export async function openWorlds() {
    const c = ctx();
    const m = getMeta();
    const g = globalSettings();
    const open = new Set();
    let importing = false;
    const $root = $(`
      <div class="na_popup na_v2 na_worlds">
        <div class="na_v2_title"><b>세계관 공유</b><small title="캐릭터에 묶으면 그 캐릭터의 새 채팅에서 저절로 켜져요">여러 채팅이 같이 쓰는 설정 · 고치면 켠 채팅 모두에 반영돼요</small></div>
        <div class="na_v2_row2">
          <button type="button" class="na_v2_btn primary na_wd_new"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M5 12h14"/></svg>새 세계관</button>
          <button type="button" class="na_v2_btn na_wd_imp">아카이브에서 가져오기</button>
        </div>
        <div class="na_wd_sum"><span class="na_wd_on_n"></span><b class="na_wd_tok"></b></div>
        <div class="na_wd_import" hidden></div>
        <div class="na_wd_list"></div>
      </div>`);
    const save = async () => { saveGlobal(); await saveMeta(); applyInjection(); syncPanel(); };
    const draw = () => {
        const books = worldBooks(), ck = charKey(), cn = charName();
        $root.find('.na_wd_list').html(books.length ? books.map(w => {
            const on = worldIsOn(m, w), bound = Array.isArray(w.chars) && w.chars.includes(ck), others = (w.chars || []).length - (bound ? 1 : 0);
            const how = !on ? '꺼짐' : m.worldOn?.[w.id] === true ? '직접 켬' : `${esc(cn)} 채팅에 묶임`;
            return `
            <div class="na_v2_card na_wd ${on ? 'on' : ''} ${open.has(w.id) ? 'open' : ''}" data-id="${esc(w.id)}">
              <div class="na_wd_head">
                <button type="button" class="na_wd_fold" aria-expanded="${open.has(w.id)}">
                  <span class="na_wd_icon"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15 15 0 0 1 0 20M12 2a15 15 0 0 0 0 20"/></svg></span>
                  <span class="na_wd_name"><b>${esc(w.name || '세계관')}</b><small><span class="na_wd_ttok" data-id="${esc(w.id)}"></span> · ${how}</small></span>
                </button>
                <input type="checkbox" class="na_toggle na_wd_on" ${on ? 'checked' : ''} aria-label="이 채팅에 넣기" title="이 채팅에 넣기">
              </div>
              ${open.has(w.id) ? `
              <div class="na_wd_body">
                <input type="text" class="text_pole na_wd_rename" value="${esc(w.name || '')}" placeholder="이름" title="이름 고치기" aria-label="이름">
                <textarea class="text_pole na_wd_text" rows="6" spellcheck="false" placeholder="## 장소 이름&#10;- 설정…">${esc(w.text || '')}</textarea>
                <div class="na_wd_foot">
                  ${ck ? `<label class="na_wd_bindchip ${bound ? 'on' : ''}"><input type="checkbox" class="na_wd_bind" ${bound ? 'checked' : ''}>${faceHtml(cn, 20)}<span>${esc(cn)} 채팅에서 저절로 ${bound ? '켜짐' : '켜기'}</span></label>` : ''}
                  ${others > 0 ? `<small class="na_v2_note">다른 캐릭터 ${others}명에도 묶임</small>` : ''}
                  <span class="na_spacer"></span>
                  <button type="button" class="na_linkbtn na_danger na_wd_del">지우기</button>
                </div>
              </div>` : ''}
            </div>`; }).join('') : '<div class="na_empty">아직 없어요. "새 세계관"을 만들거나 아카이브의 설정 섹션을 가져오세요.</div>');
        Promise.all(books.map(w => countTokens(String(w.text || '')))).then(ts => {
            books.forEach((w, i) => $root.find(`.na_wd_ttok[data-id="${w.id}"]`).text(`${fmt(ts[i])} 토큰`));
            const onB = books.filter(w => worldIsOn(m, w));
            const t = books.reduce((a, w, i) => a + (worldIsOn(m, w) ? ts[i] : 0), 0);
            $root.find('.na_wd_on_n').text(books.length ? `이 채팅에 켜진 세계관 ${onB.length}개` : '');
            $root.find('.na_wd_tok').text(t ? `약 ${fmt(t)} 토큰` : '');
        });
    };
    const book = el => worldBooks().find(w => w.id === String($(el).closest('.na_wd').data('id')));
    $root.on('click', '.na_wd_fold', function () { const w = book(this); open.has(w.id) ? open.delete(w.id) : open.add(w.id); draw(); });
    $root.on('change', '.na_wd_rename', async function () { book(this).name = this.value.trim() || '세계관'; await save(); draw(); });
    $root.on('change', '.na_wd_text', async function () { book(this).text = this.value.replace(/\r\n/g, '\n'); await save(); draw(); });
    $root.on('change', '.na_wd_on', async function () { m.worldOn = { ...(m.worldOn || {}), [book(this).id]: this.checked }; await save(); draw(); });
    $root.on('change', '.na_wd_bind', async function () {
        const w = book(this), k = charKey();
        w.chars = Array.isArray(w.chars) ? w.chars.filter(x => x !== k) : [];
        if (this.checked) w.chars.push(k);
        await save(); draw();
    });
    $root.on('click', '.na_wd_del', async function () {
        const w = book(this);
        if (!await confirm('세계관 지우기', `"${esc(w.name)}"을 지울까요? 이 세계관을 켠 모든 채팅에서 빠져요. 되돌릴 수 없어요.`)) return;
        g.worlds = worldBooks().filter(x => x !== w);
        await save(); draw();
    });
    $root.find('.na_wd_new').on('click', async () => {
        const w = { id: newId(), name: `세계관 ${worldBooks().length + 1}`, text: '', chars: charKey() ? [charKey()] : [] };
        worldBooks().push(w);
        m.worldOn = { ...(m.worldOn || {}), [w.id]: true };
        open.add(w.id);
        await save(); draw();
        $root.find(`.na_wd[data-id="${w.id}"] .na_wd_text`).trigger('focus');
    });
    // copy or move archive sections (e.g. "## Ombos temple", "# WORLD") into a book
    $root.find('.na_wd_imp').on('click', function () {
        importing = !importing;
        $(this).toggleClass('active', importing);
        const $i = $root.find('.na_wd_import').prop('hidden', !importing);
        if (!importing) return;
        const secs = parseSections(m.text).filter(s => s.title !== '(머리말)');
        $i.html(`
          <div class="na_wd_secs">${secs.map((s, i) => `<label class="na_wd_sec ${s.group ? 'grp' : ''}"><input type="checkbox" data-i="${i}"><span>${esc(s.title)}</span><small class="na_dim">${fmt(s.end - s.start)}자</small></label>`).join('')}</div>
          <div class="na_wd_impfoot">
            <select class="text_pole na_wd_target"><option value="">새 세계관으로</option>${worldBooks().map(w => `<option value="${esc(w.id)}">${esc(w.name)}에 붙이기</option>`).join('')}</select>
            <label class="na_strip_item"><input type="checkbox" class="na_toggle na_wd_move"><span>아카이브에서 빼기</span></label>
            <button type="button" class="na_btn na_small na_primary na_wd_go"><i class="fa-solid fa-check"></i> 가져오기</button>
          </div>`);
        $i.find('.na_wd_go').on('click', async () => {
            const picked = $i.find('.na_wd_secs input:checked').map((_, el) => secs[Number(el.dataset.i)]).get();
            if (!picked.length) return toastr.info('섹션을 골라 주세요.');
            // a picked group ("# WORLD" over "## Ombos", "## Thebes") brings the sections under it
            const all = parseSections(m.text);
            const spanEnd = s => !s.group ? s.end : (all.find(x => x.start > s.start && x.level <= s.level)?.start ?? m.text.length);
            const spans = picked.map(s => [s.start, spanEnd(s)]).sort((a, b) => a[0] - b[0])
                .reduce((out, sp) => { const l = out[out.length - 1]; if (l && sp[0] < l[1]) l[1] = Math.max(l[1], sp[1]); else out.push([...sp]); return out; }, []);
            // headings go one level down so the book's own "# WORLD — name" stays the top level
            const text = spans.map(([a, b]) => m.text.slice(a, b).replace(/^(#{1,5}) /gm, '#$1 ').trim()).join('\n\n');
            const tid = String($i.find('.na_wd_target').val() || '');
            let w = worldBooks().find(x => x.id === tid);
            if (!w) { w = { id: newId(), name: picked[0].title.replace(/^#+\s*/, '').slice(0, 30) || '세계관', text: '', chars: charKey() ? [charKey()] : [] }; worldBooks().push(w); }
            w.text = [String(w.text || '').trim(), text].filter(Boolean).join('\n\n');
            m.worldOn = { ...(m.worldOn || {}), [w.id]: true };
            if ($i.find('.na_wd_move').prop('checked')) {
                const inSpan = s => spans.some(([a, b]) => s.start >= a && s.start < b);
                await commitText(all.filter(s => !inSpan(s)).map(s => m.text.slice(s.start, s.end)).join(''), '세계관으로 옮기기 전');
            }
            open.add(w.id);
            importing = false; $root.find('.na_wd_imp').removeClass('active'); $i.prop('hidden', true).empty();
            await save(); draw();
            sectionPanel?.render();
            toastr.success(`섹션 ${picked.length}개를 "${w.name}"에 넣었어요`);
        });
    });
    draw();
    await c.callGenericPopup($root, c.POPUP_TYPE.TEXT, '', { wide: true, large: true, allowVerticalScrolling: true, leftAlign: true, okButton: '닫기' });
}
