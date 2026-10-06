// Translation of changed lines, the glossary, and the "한국어로 보기" button.

import { askAI, callConn, trSettings, withSpinner } from './ai.js';
import { ctx, getMeta, hasChat, saveMeta } from './core.js';
import { diffPairs, markedPair } from './diff.js';
import { capWords } from './keywords.js';
import { esc } from './util.js';

// ---- "한국어로 보기" for any diff box: translates only the changed (+/−) lines, shown under each line

export const AI_SYS_TRANSLATE = `GOAL
Translate numbered lines of a story archive into natural Korean.

YOU GET
Numbered lines, like "1: …", "2: …". They may be headings, list items, or half sentences.
Some lines are marked (OLD) and the next one (NEW): two versions of the same line.

RULES
1. One output line for each input line. Same numbers, same order. Never skip a number, never merge two lines.
2. Translate every line in full. Do not shorten or summarise.
3. Keep these exactly as they are: markdown marks (#, -, **, _), "#number" references like #512, quotation marks.
4. Names of people and places: write them in Korean script (Glossary spellings win if given).
   Words the archive leaves untranslated on purpose (made-up words, titles in another language): keep as they are.
5. (OLD) and (NEW): translate both. In NEW, copy OLD's Korean word for word wherever the English is the same, and change only the parts whose English changed. Do not write the (OLD)/(NEW) marks in your answer.
6. Each translation stays on ONE line.

OUTPUT: nothing else, exactly like this
1: <Korean>
2: <Korean>`;

export async function askTranslator(prompt, { system = '', maxTokens = 0 } = {}) {
    const t = trSettings();
    const max = Math.max(64, Number(maxTokens) || 4096);
    if (t.mode === 'same') return askAI(prompt, { system, maxTokens: max });
    const out = await callConn(t, system, prompt, max);
    if (!out) throw new Error('번역 모델이 빈 답을 돌려줬어요');
    return out;
}

export const trCache = new Map();

// ---- glossary: Korean spellings the translator must keep ("Horus = 호루스", one per line, kept per chat)

export function glossaryEntries(m) {
    return String(m?.glossary || '').split('\n')
        .map(l => l.match(/^\s*([^=→]+?)\s*(?:=|→)\s*(.+?)\s*$/)).filter(Boolean)
        .map(x => ({ src: x[1], ko: x[2] }));
}
export const glossaryIn = (entries, text) => { const low = String(text).toLowerCase(); return entries.filter(e => low.includes(e.src.toLowerCase())); };
export const shortHash = s => { let h = 5381; for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0; return (h >>> 0).toString(36); };

// translations survive a reload in the chat's metadata; oldest go first past the cap
export const TR_MEM_MAX = 4000;
export function trMem() {
    const m = hasChat() ? getMeta() : null;
    if (!m) return null;
    if (!m.trMem || typeof m.trMem !== 'object' || Array.isArray(m.trMem)) m.trMem = {};
    return m.trMem;
}
export let trMemTimer;
export function trMemSave() {
    const mem = trMem();
    if (!mem) return;
    const keys = Object.keys(mem);
    for (let i = 0; i < keys.length - TR_MEM_MAX; i++) delete mem[keys[i]];
    clearTimeout(trMemTimer);
    trMemTimer = setTimeout(() => saveMeta(), 800);
}
export const trGet = k => trCache.get(k) ?? trMem()?.[k];

// items: { text, mark?: 'OLD'|'NEW', key? } — an OLD/NEW pair goes out together so the wording stays the same.
// The glossary entries a line mentions are part of its cache key, so a changed spelling gets a new translation.
export async function translateLines(items, { fresh = false } = {}) {
    const gloss = hasChat() ? glossaryEntries(getMeta()) : [];
    items = items.map(x => typeof x === 'string' ? { text: x } : x);
    const keyOf = x => {
        const g = glossaryIn(gloss, x.mark ? (x.key ?? x.text) : x.text);
        return `${g.length ? `${shortHash(g.map(e => `${e.src}=${e.ko}`).join('|'))}\u0002` : ''}${x.key ?? x.text}`;
    };
    const seen = new Set();
    const need = items.filter(x => (fresh || trGet(keyOf(x)) === undefined) && !seen.has(keyOf(x)) && seen.add(keyOf(x)));
    for (let i = 0; i < need.length;) {
        // ~80 lines or ~12k characters a request, never splitting an OLD/NEW pair
        let j = i, size = 0;
        while (j < need.length && (j === i || (j - i < 80 && size + need[j].text.length < 12_000) || need[j].mark === 'NEW')) size += need[j++].text.length;
        const chunk = need.slice(i, j);
        i = j;
        const g = glossaryIn(gloss, chunk.map(x => x.text).join('\n'));
        const system = g.length ? `${AI_SYS_TRANSLATE}\n\nGlossary: always write these names and terms exactly this way:\n${g.map(e => `${e.src} = ${e.ko}`).join('\n')}` : AI_SYS_TRANSLATE;
        const out = await askTranslator(chunk.map((x, k) => `${k + 1}: ${x.mark ? `(${x.mark}) ` : ''}${x.text}`).join('\n'),
            { system, maxTokens: Math.min(16384, 1000 + size * 3) });
        const got = new Map();
        let cur = null;
        for (const row of out.split('\n')) {
            const mt = row.match(/^\s*(\d+)\s*[:.)]\s?(.*)$/);
            if (mt && chunk[Number(mt[1]) - 1] !== undefined) { cur = Number(mt[1]) - 1; got.set(cur, mt[2]); }
            else if (cur !== null && row.trim()) got.set(cur, `${got.get(cur)} ${row.trim()}`); // a translation the model broke onto two lines
        }
        for (const [k, v] of got) {
            const t = v.replace(/^\s*\((?:OLD|NEW)\)\s*/i, '').trim();
            if (t) { trCache.set(keyOf(chunk[k]), t); const mem = trMem(); if (mem) { delete mem[keyOf(chunk[k])]; mem[keyOf(chunk[k])] = t; } }
        }
        trMemSave();
    }
    return items.map(x => trGet(keyOf(x)) ?? null);
}

// ---- glossary editor

export const AI_SYS_GLOSSARY = `GOAL
Decide one fixed Korean spelling for each name or term, so every translation of the story writes it the same way.

YOU GET
One English name or term per line, each with a short piece of context showing how it is used.

RULES
1. Real names with a usual Korean spelling (mythology, history, real places): use that spelling.
2. Other names: transliterate naturally, the way a Korean reader would say it.
3. Titles and ordinary nouns (e.g. "the Queen", "the well"): translate into natural Korean.
4. Made-up words: transliterate, do not translate.
5. Look at the context to tell a name from an ordinary word.

OUTPUT: one line per input, same order, nothing else, exactly like this
Avalon = 아발론
Lighthouse = 등대`;

export async function openGlossary() {
    const c = ctx();
    const m = getMeta();
    const $root = $(`
      <div class="na_popup">
        <div class="na_block_head"><div>
          <h4>번역 용어집</h4>
          <p>한 줄에 하나씩 <code>영어 = 한국어</code>로 적어요. 번역할 때 그 줄에 나오는 이름만 골라 모델에 같이 보내요. 이 채팅에만 저장되고, 다른 채팅에서 가져오기를 하면 같이 따라가요.</p>
        </div></div>
        <textarea class="text_pole na_gl_ta" rows="12" spellcheck="false" placeholder="Avalon = 아발론&#10;Lighthouse Keeper = 등대지기"></textarea>
        <div class="na_row_btns na_gl_btns">
          <button type="button" class="na_btn na_small na_gl_find"><i class="fa-solid fa-magnifying-glass"></i> 아카이브에서 이름 찾기</button>
          <button type="button" class="na_btn na_small na_gl_ai"><i class="fa-solid fa-wand-magic-sparkles"></i> AI로 한국어 채우기</button>
        </div>
        <small class="na_dim na_gl_info"></small>
      </div>`);
    const $ta = $root.find('.na_gl_ta').val(m.glossary || '');
    const info = () => {
        const lines = $ta.val().split('\n').filter(l => l.trim());
        const empty = lines.filter(l => !/(=|→)\s*\S/.test(l)).length;
        $root.find('.na_gl_info').text(`${lines.length - empty}개${empty ? ` · 한국어가 빈 줄 ${empty}개` : ''}`);
    };
    $ta.on('input', info);
    info();
    $root.find('.na_gl_find').on('click', () => {
        const have = new Set(glossaryEntries({ glossary: $ta.val() }).map(e => e.src.toLowerCase())
            .concat($ta.val().split('\n').map(l => l.split(/=|→/)[0].trim().toLowerCase())));
        const counts = new Map();
        capWords(m.text).forEach(w => counts.set(w, (counts.get(w) || 0) + 1));
        const found = [...counts].filter(([w, n]) => n >= 3 && !have.has(w.toLowerCase())).sort((a, b) => b[1] - a[1]).slice(0, 40).map(([w]) => w);
        if (!found.length) return toastr.info('새로 넣을 이름이 없어요.');
        $ta.val(`${$ta.val().replace(/\s+$/, '')}${$ta.val().trim() ? '\n' : ''}${found.map(w => `${w} = `).join('\n')}`);
        info();
        toastr.success(`${found.length}개 넣었어요. 한국어는 직접 적거나 AI로 채우세요.`);
    });
    $root.find('.na_gl_ai').on('click', async function () {
        const lines = $ta.val().split('\n');
        const todo = lines.map((l, i) => ({ i, src: l.split(/=|→/)[0].trim(), empty: !/(=|→)\s*\S/.test(l) })).filter(x => x.src && x.empty);
        if (!todo.length) return toastr.info('한국어가 빈 줄이 없어요. "이름 = "처럼 적어 두면 채워요.');
        const ctxOf = w => { const i = m.text.indexOf(w); return i < 0 ? '' : m.text.slice(Math.max(0, i - 60), i + w.length + 60).replace(/\s+/g, ' '); };
        const prompt = todo.map(x => `${x.src} — context: ${ctxOf(x.src)}`).join('\n');
        const out = await withSpinner($(this), '채우는 중…', () => askTranslator(prompt, { system: AI_SYS_GLOSSARY, maxTokens: Math.min(8000, 400 + todo.length * 60) }));
        if (out === null) return;
        const got = new Map(out.split('\n').map(l => l.match(/^\s*(?:[-*]\s*)?([^=→]+?)\s*(?:=|→)\s*(.+?)\s*$/)).filter(Boolean).map(x => [x[1].toLowerCase(), x[2]]));
        let n = 0;
        for (const x of todo) { const ko = got.get(x.src.toLowerCase()); if (ko) { lines[x.i] = `${x.src} = ${ko}`; n++; } }
        $ta.val(lines.join('\n'));
        info();
        toastr.success(`${n}개 채웠어요. 틀린 건 고쳐 주세요.`);
    });
    const r = await c.callGenericPopup($root, c.POPUP_TYPE.CONFIRM, '', { wide: true, allowVerticalScrolling: true, okButton: '저장', cancelButton: '취소' });
    if (r !== c.POPUP_RESULT.AFFIRMATIVE && r !== true) return;
    m.glossary = $ta.val().split('\n').map(l => l.trimEnd()).filter(l => l.trim()).join('\n');
    await saveMeta();
    toastr.success(`용어집 저장 · ${glossaryEntries(m).length}개`);
}

export const TR_LABEL = '<i class="fa-solid fa-language"></i> 한국어로 보기';
export const TR_HIDE = '<i class="fa-solid fa-language"></i> 번역 숨기기';

// button that toggles Korean under the changed lines of $diff (any element holding renderDiff output)
export function translateButton($diff) {
    const $btn = $(`<button type="button" class="na_btn na_small na_tr_btn">${TR_LABEL}</button>`);
    $btn.on('click', async () => {
        if ($diff.find('.na_diff_tr').length) { $diff.find('.na_diff_tr').remove(); $btn.html(TR_LABEL); return; }
        // $diff is one diff box, or (section diffs) a host holding one .na_diff box per card: a blank
        // spacer between boxes keeps a − run at the end of one card from pairing with the next card's + run
        const boxes = $diff.is('.na_diff') || !$diff.find('.na_diff').length ? [$diff[0]] : $diff.find('.na_diff').toArray();
        const all = boxes.flatMap((box, i) => [...(i ? [document.createElement('div')] : []), ...box.children]);
        const lineOf = el => { const dl = el.querySelector('.na_dl'); return dl ? dl.textContent.trim() : el.textContent.replace(/^[+−-]/, '').trim(); };
        const rows = all.filter(el => el.classList.contains('na_diff_add') || el.classList.contains('na_diff_del'))
            .map(el => ({ el, text: lineOf(el) }))
            .filter(r => /[\p{L}]{2,}/u.test(r.text));
        if (!rows.length) return toastr.info('번역할 바뀐 줄이 없어요.');
        // the same pairing renderDiff used: each '-' run against the '+' run right after it
        const shape = all.map(el => ({ t: el.classList.contains('na_diff_del') ? '-' : el.classList.contains('na_diff_add') ? '+' : ' ' }));
        const partner = new Map();
        for (const [d, a] of diffPairs(shape)) { partner.set(all[d], all[a]); partner.set(all[a], all[d]); }
        const items = rows.map(r => {
            const p = partner.get(r.el);
            if (!p || !/[\p{L}]{2,}/u.test(lineOf(p))) return { text: r.text };
            const del = r.el.classList.contains('na_diff_del');
            const [o, n] = del ? [r.text, lineOf(p)] : [lineOf(p), r.text];
            return { text: r.text, mark: del ? 'OLD' : 'NEW', key: `${del ? 'O' : 'N'}\u0000${o}\u0000${n}`, pairKey: `${o}\u0000${n}` };
        });
        // a pair must sit next to each other, OLD first
        const order = [];
        const placed = new Set();
        items.forEach((x, i) => {
            if (placed.has(i)) return;
            if (x.mark) {
                const j = items.findIndex((y, k) => k !== i && y.pairKey === x.pairKey && y.mark !== x.mark);
                if (j >= 0) { const [o, n] = x.mark === 'OLD' ? [i, j] : [j, i]; order.push(o, n); placed.add(o).add(n); return; }
                items[i] = { text: x.text };
            }
            order.push(i); placed.add(i);
        });
        const tr = await withSpinner($btn, `번역하는 중… (${rows.length}줄)`, () => translateLines(order.map(i => items[i])));
        if (!tr) { $btn.html(TR_LABEL); return; }
        const trOf = new Map(order.map((idx, k) => [rows[idx].el, tr[k]]));
        rows.forEach(r => {
            const t = trOf.get(r.el);
            if (!t) return;
            const del = r.el.classList.contains('na_diff_del');
            const p = partner.get(r.el), pt = p && trOf.get(p);
            const mk = pt ? markedPair(del ? t : pt, del ? pt : t) : null;
            const kind = del ? 'na_diff_tr_del' : 'na_diff_tr_add';
            $(r.el).after(`<div class="na_diff_tr ${kind}"><span></span><div class="na_dl">${mk ? (del ? mk.old : mk.new) : esc(t)}</div></div>`);
        });
        $btn.html(TR_HIDE);
        const miss = rows.filter(r => !trOf.get(r.el)).length;
        if (miss) toastr.info(`${miss}줄은 번역이 안 왔어요. 다시 누르면 그 줄만 다시 보내요.`);
    });
    // a re-render replaces the rows, so the button goes back to "show"
    $btn.reset = () => $btn.html(TR_LABEL);
    return $btn;
}
