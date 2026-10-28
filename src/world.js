// Shared world books: setting text kept once in the global settings and switched on per chat.

import { askAI, withSpinner } from './ai.js';
import { commitText, ctx, getMeta, globalSettings, newId, saveGlobal, saveMeta } from './core.js';
import { applyInjection } from './inject.js';
import { sectionPanel, syncPanel } from './panel.js';
import { faceHtml } from './people.js';
import { LANG_NAME, archiveLang } from './prompts.js';
import { parseSections } from './sections.js';
import { trCachedLines, translateLines } from './translate.js';
import { ICO_A, svgA } from './theme.js';
import { confirm, countTokens, esc, fmt } from './util.js';

// World-setting text (places, myths, rules) kept once in the global settings and switched on per chat.
// g.worlds = [{ id, name, intro, slots: { places: [{ name, desc }], … }, text, chars: [avatar] }]; m.worldOn = { id: true|false } — unset means "on if bound to this character"
export const worldBooks = () => { const g = globalSettings(); if (!Array.isArray(g.worlds)) g.worlds = []; return g.worlds; };
export const charKey = () => { const c = ctx(); return c.groupId ? `group:${c.groupId}` : String(c.characters?.[c.characterId]?.avatar || ''); };
export const charName = () => { const c = ctx(); return c.groupId ? ((c.groups || []).find(x => x.id === c.groupId)?.name || '그룹') : (c.characters?.[c.characterId]?.name || ''); };

export function worldIsOn(m, w) {
    const v = m?.worldOn?.[w.id];
    if (v === true || v === false) return v;
    const k = charKey();
    return !!k && Array.isArray(w.chars) && w.chars.includes(k);
}

// the parts of a book, the same for every genre; text holds what was written before the parts (and imported sections)
export const WORLD_SLOTS = [
    { k: 'places', label: '장소', hint: '집, 동네, 자주 가는 곳', en: 'Places', ico: '<path d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11z"/><circle cx="12" cy="10" r="2.5"/>' },
    { k: 'groups', label: '소속', hint: '가족, 회사 · 학교, 단체 · 세력', en: 'Affiliations', ico: ICO_A.users },
    { k: 'rules', label: '사정 · 규칙', hint: '이 세계에서 알아둘 것', en: 'Circumstances and rules', ico: '<path d="M12 3l8 4v5c0 5-3.5 8-8 9-4.5-1-8-4-8-9V7z"/>' },
    { k: 'past', label: '이전 이야기', hint: '이야기 시작 전 과거', en: 'Before the story', ico: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>' },
    { k: 'terms', label: '용어', hint: '호칭, 별명, 고유한 말', en: 'Terms', ico: ICO_A.book },
];
const INTRO_ICO = ICO_A.globe;
export const slotsOf = w => { const s = w.slots && typeof w.slots === 'object' ? w.slots : {}; return Object.fromEntries(WORLD_SLOTS.map(x => [x.k, Array.isArray(s[x.k]) ? s[x.k] : []])); };
const filled = e => String(e?.name || '').trim() || String(e?.desc || '').trim();
// what a book puts in the prompt: the one-line intro, each part as a list, then the free text
export function worldBody(w) {
    const parts = [], sl = slotsOf(w);
    if (String(w.intro || '').trim()) parts.push(String(w.intro).trim());
    for (const x of WORLD_SLOTS) {
        const rows = sl[x.k].filter(filled).map(e => { const n = String(e.name || '').trim(), d = String(e.desc || '').trim(); return `- ${n ? `**${n}**${d ? `: ${d}` : ''}` : d}`; });
        if (rows.length) parts.push(`## ${x.en}\n${rows.join('\n')}`);
    }
    if (String(w.text || '').trim()) parts.push(String(w.text).trim());
    return parts.join('\n\n');
}

export function worldText(m) {
    return worldBooks().filter(w => worldBody(w).trim() && worldIsOn(m, w))
        .map(w => `# WORLD — ${w.name || '세계관'}\n_Shared setting reference: true in every story in this world._\n\n${worldBody(w)}`).join('\n\n');
}

// 아카이브에서 채우기: the AI 기능 모델 reads the archive and writes the parts; nothing goes in before the user ticks it
const AI_SYS_WORLD = lang => `GOAL
Fill a world reference for a long role-play from its story archive. The role-play model reads it before every reply, so the world stays consistent.

YOU GET
- ARCHIVE: the story so far, in sections, with the current state at the end.
- CURRENT WORLD: what the reference holds now (may be empty).
- FILL: which parts to write.
- NOTE (sometimes): what the user wants.

PARTS
- INTRO: one line: when and where the story is set, and what kind of story it is.
- PLACES: places where someone lives, lived or works, and places tied to a past, secret or promise that still matters. Leave out places only passed through, and small date or outing spots (a café, restaurant, shop, street, sight) unless something that still matters started there.
- AFFILIATIONS: families, workplaces, schools, groups the characters belong to, and how they stand to each other.
- RULES: what holds in this world and shapes what people can do: laws, money, work, customs, how things work (magic or technology only if the story has them).
- BACKGROUND: what happened before the story began and still shapes the present. Leave out anything that happens during the story: that is in the archive.
- TERMS: names, titles, nicknames and words with a meaning special to this story.

RULES
- Use only what the archive shows. Never invent, and add no general knowledge about real places, groups or things. A part with nothing in the archive is left out.
- The main characters themselves are not entries; their homes, families and jobs are.
- One sentence per entry, two at most. Facts, not mood.
- Say what a thing is and whose it is, not what happened there or with it: the scenes are already in the archive.
- At most 12 entries per part, the ones that matter most.
- An entry already in CURRENT WORLD: write it again only if the archive adds or changes something, under the same name.
- Write in ${lang}. Spell names as the archive does.

OUTPUT: only these blocks, nothing else
INTRO: one line
[PLACES]
- Name: description
[AFFILIATIONS]
- Name: description
[RULES]
- Name: description
[BACKGROUND]
- Name: description
[TERMS]
- Name: description`;
const OUT_KEYS = { PLACES: 'places', AFFILIATIONS: 'groups', RULES: 'rules', BACKGROUND: 'past', TERMS: 'terms' };
export function parseWorld(out) {
    const got = { intro: '', items: [] };
    let cur = null;
    for (const raw of String(out || '').split('\n')) {
        const l = raw.trim();
        const h = l.match(/^[#*\s]*\[?\s*(INTRO|PLACES|AFFILIATIONS|RULES|BACKGROUND|TERMS)\s*\]?[*\s]*:?\s*(.*)$/i);
        if (h) {
            const key = h[1].toUpperCase();
            if (key === 'INTRO') { cur = null; if (h[2].trim()) got.intro = h[2].trim(); else cur = 'intro'; } else cur = OUT_KEYS[key];
            continue;
        }
        if (cur === 'intro' && l) { got.intro = l; cur = null; continue; }
        const it = cur && l.match(/^[-*•]\s+(.+)$/);
        if (!it) continue;
        const nd = it[1].match(/^\*{0,2}([^:：*]{1,60}?)\*{0,2}\s*[:：]\s*(.+)$/);
        got.items.push({ k: cur, name: nd ? nd[1].trim() : '', desc: (nd ? nd[2] : it[1]).replace(/\*\*/g, '').trim() });
    }
    return got;
}

export async function openWorlds() {
    const c = ctx();
    const m = getMeta();
    const g = globalSettings();
    const open = new Set();
    const review = new Map(); // book id → what 아카이브에서 채우기 brought back, waiting to be ticked
    // 한국어로 보기: each line's Korean under it (the book itself stays as written); the translations live in the shared cache
    const trOn = new Set();
    const entryLine = e => { const n = String(e.name || '').trim(), d = String(e.desc || '').trim(); return n && d ? `${n}: ${d}` : n || d; };
    const trLines = w => {
        const rv = review.get(w.id);
        return [w.intro, ...Object.values(slotsOf(w)).flat().map(entryLine), ...(rv ? [rv.intro, ...rv.items.map(entryLine)] : [])].map(x => String(x || '').trim()).filter(Boolean);
    };
    let koOf = () => '';
    const ko = (w, line) => { const t = trOn.has(w.id) && String(line || '').trim() ? koOf(String(line).trim()) : ''; return trOn.has(w.id) ? `<small class="na_wd_ko">${esc(t || '')}</small>` : ''; };
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
        const cache = new Map();
        for (const w of books.filter(x => trOn.has(x.id))) { const ls = trLines(w); trCachedLines(ls).forEach((t, i) => { if (t) cache.set(ls[i], t); }); }
        koOf = line => cache.get(line) || '';
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
                <div class="na_wd_namerow">
                  <input type="text" class="text_pole na_wd_rename" value="${esc(w.name || '')}" placeholder="이름" title="이름 고치기" aria-label="이름">
                  <button type="button" class="na_v2_btn na_wd_tr ${trOn.has(w.id) ? 'active' : ''}">${trOn.has(w.id) ? '원문만' : '한국어로 보기'}</button>
                </div>
                ${partsHtml(w)}
                <div class="na_wd_fillbar">
                  <select class="text_pole na_wd_fillk" aria-label="채울 칸"><option value="">모든 칸</option>${WORLD_SLOTS.map(x => `<option value="${x.k}">${x.label}만</option>`).join('')}<option value="intro">한 줄 소개만</option></select>
                  <input type="text" class="text_pole na_wd_note" placeholder="바라는 것 (없어도 돼요)" aria-label="채울 때 바라는 것">
                  <button type="button" class="na_v2_btn primary na_wd_fill">${svgA(ICO_A.wand, 15)}아카이브에서 채우기</button>
                </div>
                ${review.has(w.id) ? reviewHtml(w, review.get(w.id)) : ''}
                <div class="na_wd_foot">
                  ${ck ? `<label class="na_wd_bindchip ${bound ? 'on' : ''}"><input type="checkbox" class="na_wd_bind" ${bound ? 'checked' : ''}>${faceHtml(cn, 20)}<span>${esc(cn)} 채팅에서 저절로 ${bound ? '켜짐' : '켜기'}</span></label>` : ''}
                  ${others > 0 ? `<small class="na_v2_note">다른 캐릭터 ${others}명에도 묶임</small>` : ''}
                  <span class="na_spacer"></span>
                  <button type="button" class="na_linkbtn na_danger na_wd_del">지우기</button>
                </div>
              </div>` : ''}
            </div>`; }).join('') : '<div class="na_empty">아직 없어요. "새 세계관"을 만들거나 아카이브의 설정 섹션을 가져오세요.</div>');
        counts();
    };
    const counts = () => {
        const books = worldBooks();
        Promise.all(books.map(w => countTokens(worldBody(w)))).then(ts => {
            books.forEach((w, i) => $root.find(`.na_wd_ttok[data-id="${w.id}"]`).text(`${fmt(ts[i])} 토큰`));
            const onB = books.filter(w => worldIsOn(m, w));
            const t = books.reduce((a, w, i) => a + (worldIsOn(m, w) ? ts[i] : 0), 0);
            $root.find('.na_wd_on_n').text(books.length ? `이 채팅에 켜진 세계관 ${onB.length}개` : '');
            $root.find('.na_wd_tok').text(t ? `약 ${fmt(t)} 토큰` : '');
        });
    };
    // the parts: a one-line intro, then each part as name + description rows; the old free text only when there is some
    const partsHtml = w => {
        const sl = slotsOf(w);
        // the hint is a tooltip only: written out next to every part it was too long
        const head = (ico, label, hint, extra = '') => `<div class="na_wd_slot_head" title="${hint}"><span class="na_wd_slot_ico">${svgA(ico, 15)}</span><b>${label}</b>${extra}</div>`;
        return `
          <div class="na_wd_slot na_wd_intro">
            ${head(INTRO_ICO, '한 줄 소개', '언제, 어디, 어떤 이야기인지')}
            <textarea class="text_pole na_wd_introtx" rows="1" spellcheck="false" placeholder="예: 2020년대 서울, 같은 회사에 다니는 두 사람">${esc(w.intro || '')}</textarea>
            ${ko(w, w.intro)}
          </div>
          ${WORLD_SLOTS.map(x => `
          <div class="na_wd_slot" data-k="${x.k}">
            ${head(x.ico, x.label, x.hint, `<span class="na_spacer"></span>${sl[x.k].length ? `<span class="na_wd_slot_n">${sl[x.k].length}</span>` : ''}<button type="button" class="na_wd_add" title="${x.label} 추가" aria-label="${x.label} 추가">${svgA(ICO_A.plus, 15, 2.2)}</button>`)}
            ${sl[x.k].length ? `<div class="na_wd_rows">${sl[x.k].map((e, n) => `
              <div class="na_wd_row" data-n="${n}">
                <input type="text" class="text_pole na_wd_en" value="${esc(e.name || '')}" placeholder="이름" aria-label="이름">
                <textarea class="text_pole na_wd_ed" rows="1" spellcheck="false" placeholder="설명" aria-label="설명">${esc(e.desc || '')}</textarea>
                <button type="button" class="na_wd_rx" title="빼기" aria-label="빼기">${svgA('M6 6l12 12M18 6L6 18', 14, 2.2)}</button>
                ${ko(w, entryLine(e))}
              </div>`).join('')}</div>` : ''}
          </div>`).join('')}
          ${String(w.text || '').trim() ? `
          <div class="na_wd_slot">
            ${head(ICO_A.list, '그 밖에', '가져온 섹션 · 예전에 적은 내용')}
            <textarea class="text_pole na_wd_text" rows="6" spellcheck="false">${esc(w.text || '')}</textarea>
          </div>` : ''}`;
    };
    // what the model brought back: new entries ticked, changed ones show the old description, the rest are left out
    const reviewHtml = (w, rv) => {
        const by = k => rv.items.map((it, i) => ({ ...it, i })).filter(it => it.k === k);
        const row = it => `<label class="na_wd_rv_row"><input type="checkbox" data-i="${it.i}" ${it.on ? 'checked' : ''}><span><b>${esc(it.name || '')}</b>${it.name ? ' ' : ''}${esc(it.desc)}${ko(w, entryLine(it))}${it.old !== undefined ? `<small class="na_wd_rv_old">지금: ${esc(it.old || '(설명 없음)')}</small>` : ''}</span><em class="${it.old !== undefined ? 'chg' : 'new'}">${it.old !== undefined ? '바뀜' : '새로'}</em></label>`;
        const groups = [
            ...(rv.intro !== undefined ? [`<div class="na_wd_rv_grp"><b>한 줄 소개</b><label class="na_wd_rv_row"><input type="checkbox" data-i="intro" ${rv.introOn ? 'checked' : ''}><span>${esc(rv.intro)}${ko(w, rv.intro)}${String(w.intro || '').trim() ? `<small class="na_wd_rv_old">지금: ${esc(w.intro)}</small>` : ''}</span><em class="${String(w.intro || '').trim() ? 'chg' : 'new'}">${String(w.intro || '').trim() ? '바뀜' : '새로'}</em></label></div>`] : []),
            ...WORLD_SLOTS.filter(x => by(x.k).length).map(x => `<div class="na_wd_rv_grp"><b>${x.label}</b>${by(x.k).map(row).join('')}</div>`),
        ];
        return `<div class="na_wd_review">
          <div class="na_wd_rv_title"><b>아카이브에서 찾은 것</b><small>${groups.length ? '고른 것만 넣어요' : '새로 넣을 게 없어요'}</small></div>
          ${groups.join('')}
          <div class="na_wd_rv_foot"><button type="button" class="na_v2_btn na_wd_rv_no">그만두기</button>${groups.length ? '<button type="button" class="na_v2_btn primary na_wd_rv_go">고른 것 넣기</button>' : ''}</div>
        </div>`;
    };
    const book = el => worldBooks().find(w => w.id === String($(el).closest('.na_wd').data('id')));
    $root.on('click', '.na_wd_fold', function () { const w = book(this); open.has(w.id) ? open.delete(w.id) : open.add(w.id); draw(); });
    $root.on('change', '.na_wd_rename', async function () { book(this).name = this.value.trim() || '세계관'; await save(); draw(); });
    $root.on('change', '.na_wd_text', async function () { book(this).text = this.value.replace(/\r\n/g, '\n'); await save(); counts(); });
    // the parts: typing saves without drawing again, so the cursor stays where it is
    const slotList = (w, el) => { const k = String($(el).closest('.na_wd_slot').data('k')); w.slots = slotsOf(w); return w.slots[k]; };
    // with 한국어로 보기 on, an edited line gets its Korean again without drawing the list again
    const retr = ($at, line) => { if (!line || !$at.length) return; translateLines([line]).then(([t]) => $at.text(t || '')).catch(() => {}); };
    $root.on('change', '.na_wd_introtx', async function () {
        const w = book(this);
        w.intro = this.value.replace(/\s*\n\s*/g, ' ').trim();
        await save(); counts();
        if (trOn.has(w.id)) retr($(this).siblings('.na_wd_ko'), w.intro);
    });
    $root.on('change', '.na_wd_en, .na_wd_ed', async function () {
        const w = book(this), list = slotList(w, this), e = list[Number($(this).closest('.na_wd_row').data('n'))];
        if (!e) return;
        e[$(this).hasClass('na_wd_en') ? 'name' : 'desc'] = this.value.replace(/\s*\n\s*/g, ' ').trim();
        await save(); counts();
        if (trOn.has(w.id)) retr($(this).siblings('.na_wd_ko'), entryLine(e));
    });
    $root.on('click', '.na_wd_add', async function () {
        const w = book(this), list = slotList(w, this), k = String($(this).closest('.na_wd_slot').data('k'));
        list.push({ name: '', desc: '' });
        await save(); draw();
        $root.find(`.na_wd[data-id="${w.id}"] .na_wd_slot[data-k="${k}"] .na_wd_row:last .na_wd_en`).trigger('focus');
    });
    $root.on('click', '.na_wd_rx', async function () {
        const w = book(this), list = slotList(w, this);
        list.splice(Number($(this).closest('.na_wd_row').data('n')), 1);
        await save(); draw();
    });
    // 아카이브에서 채우기: all parts or one, with the user's wish; the answer waits in a list to be ticked
    $root.on('click', '.na_wd_fill', async function () {
        const w = book(this), $card = $(this).closest('.na_wd');
        if (!m.text.trim()) return toastr.info('아카이브가 비어 있어요. 먼저 압축해 주세요.');
        const only = String($card.find('.na_wd_fillk').val() || ''), note = String($card.find('.na_wd_note').val() || '').trim();
        const label = only === 'intro' ? 'INTRO' : only ? Object.keys(OUT_KEYS).find(k => OUT_KEYS[k] === only) : '';
        const prompt = `[ARCHIVE]\n${m.text}\n\n[CURRENT WORLD]\n${worldBody({ ...w, text: '' }) || '(empty)'}\n\n[FILL]\n${label ? `Only ${label}. Leave out every other block.` : 'All parts.'}${note ? `\n\n[NOTE]\n${note}` : ''}`;
        const out = await withSpinner($(this), '아카이브 읽는 중…', () => askAI(prompt, { system: AI_SYS_WORLD(LANG_NAME[archiveLang(m.text)] || 'English'), maxTokens: 6000 }));
        if (!out) return;
        const got = parseWorld(out), sl = slotsOf(w);
        const same = (a, b) => String(a || '').trim().toLowerCase() === String(b || '').trim().toLowerCase();
        const items = [];
        for (const it of got.items) {
            if (only && only !== 'intro' && it.k !== only) continue;
            if (items.some(x => x.k === it.k && same(x.name, it.name) && same(x.desc, it.desc))) continue;
            const had = it.name ? sl[it.k].find(e => same(e.name, it.name)) : sl[it.k].find(e => same(e.desc, it.desc));
            if (had && same(had.desc, it.desc)) continue;
            items.push({ ...it, on: true, ...(had ? { old: had.desc || '' } : {}) });
        }
        const intro = (!only || only === 'intro') && got.intro && !same(got.intro, w.intro) ? got.intro : undefined;
        if (!items.length && intro === undefined && !got.items.length && !got.intro) return toastr.warning('모델의 답에서 칸을 못 찾았어요. 다시 해 보세요.');
        review.set(w.id, { items, intro, introOn: true });
        if (trOn.has(w.id)) await withSpinner($(this), '번역하는 중…', () => translateLines(trLines(w)));
        draw();
    });
    $root.on('change', '.na_wd_review input[type=checkbox]', function () {
        const rv = review.get(book(this).id), i = this.dataset.i;
        if (i === 'intro') rv.introOn = this.checked; else rv.items[Number(i)].on = this.checked;
    });
    $root.on('click', '.na_wd_tr', async function () {
        const w = book(this);
        if (trOn.has(w.id)) { trOn.delete(w.id); return draw(); }
        const lines = trLines(w);
        if (!lines.length) return toastr.info('번역할 내용이 없어요.');
        const out = await withSpinner($(this), '번역하는 중…', () => translateLines(lines));
        if (!out) return;
        trOn.add(w.id); draw();
    });
    $root.on('click', '.na_wd_rv_no', function () { review.delete(book(this).id); draw(); });
    $root.on('click', '.na_wd_rv_go', async function () {
        const w = book(this), rv = review.get(w.id);
        w.slots = slotsOf(w);
        const same = (a, b) => String(a || '').trim().toLowerCase() === String(b || '').trim().toLowerCase();
        let n = 0;
        for (const it of rv.items.filter(x => x.on)) {
            const list = w.slots[it.k], had = it.old !== undefined ? list.find(e => (it.name ? same(e.name, it.name) : same(e.desc, it.old))) : null;
            if (had) had.desc = it.desc; else list.push({ name: it.name, desc: it.desc });
            n++;
        }
        if (rv.intro !== undefined && rv.introOn) { w.intro = rv.intro; n++; }
        review.delete(w.id);
        await save(); draw();
        toastr.success(n ? `${n}개를 넣었어요` : '넣은 게 없어요', '세계관');
    });
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
        $root.find(`.na_wd[data-id="${w.id}"] .na_wd_introtx`).trigger('focus');
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
