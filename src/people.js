// People: places in headings, the roster, faces, the relationship map and temperature.

import { aiLabel, askAI, withSpinner } from './ai.js';
import { gotoSection } from './ask.js';
import { TIME_WORDS, headingDate } from './calendar.js';
import { ctx, getMeta, globalSettings, saveGlobal, saveMeta, textHash } from './core.js';
import { castNames } from './knowledge.js';
import { PICK_CHUNK_TOK, estTok } from './picker.js';
import { RANGE_HEAD, parseSections, sectionKey, splitTail, tailBlocks } from './sections.js';
import { confirm, esc, escRe } from './util.js';

// Places from heading parentheses ("(Phamenoth 9, Thebes palace, after midnight)", "(Ombos → Thebes)"), shown by the calendar.

export const PLACE_SKIP = /^(?:the\s+)?(?:same|next|following|later|that|this|one|a|an|some|several|\d+)\b.*\b(?:day|days|night|week|weeks|month|months|year|years|later|on|in)\b|season\b|^(?:dawn|morning|noon|midday|afternoon|dusk|sunset|evening|night|midnight|before dawn|pre-?dawn|daybreak|into the night|later that day)$/i;

export function headingPlaces(title, cals) {
    const paren = (title.match(/\(([^()]*)\)\s*(?:\[[^\]]*\])?\s*$/) || [, ''])[1];
    const d = headingDate(title, cals);
    let text = paren;
    if (d.date) text = text.replace(d.date.label, '');
    const parts = text.split(/,|;/).map(x => x.trim()).filter(Boolean)
        .filter(x => !PLACE_SKIP.test(x) && !TIME_WORDS.some(([re]) => re.test(x) && x.split(/\s+/).length <= 3))
        .filter(x => !/^(?:month of|after|before|until|during|into)\b/i.test(x));
    // "A → B" is a move inside one section
    return parts.flatMap(x => x.split(/\s*(?:→|->|⇒)\s*/)).map(x => x.replace(/^(?:the|a|an)\s+/i, '').trim()).filter(Boolean);
}

// The roster is the STATE character headings plus names added by hand (m.people). Faces are kept in the global settings by name,
// so they follow the story into the next chat: an uploaded picture shrunk to 96px, or the SillyTavern character/persona avatar.
// stored faces are drawn up to 96px; three times that stays sharp on phone screens
export const FACE_PX = 288;
export const nameKey = n => String(n || '').trim().toLowerCase();
// case-sensitive on purpose: "Set" the god, not "set" the verb
export const nameRe = n => new RegExp(`(?<![\\p{L}\\p{N}])${escRe(n)}(?![\\p{L}\\p{N}])`, 'u');

export function peopleList(m) {
    const out = [], seen = new Set();
    for (const n of [...castNames(m), ...(Array.isArray(m.people) ? m.people : [])]) {
        const k = nameKey(n);
        if (k && !seen.has(k)) { seen.add(k); out.push(String(n).trim()); }
    }
    return out;
}

// SillyTavern's avatar: the small thumbnail, or (big) the full picture so a large face isn't blown up from a thumbnail
export function stFace(name, big = false) {
    const c = ctx(), k = nameKey(name);
    const ch = (c.characters || []).find(x => nameKey(x?.name) === k);
    if (ch?.avatar && ch.avatar !== 'none') return big ? `/characters/${encodeURIComponent(ch.avatar)}` : `/thumbnail?type=avatar&file=${encodeURIComponent(ch.avatar)}`;
    const per = c.powerUserSettings?.personas || {};
    const f = Object.keys(per).find(f => nameKey(per[f]) === k);
    return f ? (big ? `/User%20Avatars/${encodeURIComponent(f)}` : `/thumbnail?type=persona&file=${encodeURIComponent(f)}`) : '';
}

// stored: a data URL, or 'none' for "letter only"; nothing stored means "the SillyTavern avatar if there is one"
export function faceOf(name, big = false) {
    const f = globalSettings().faces?.[nameKey(name)];
    return f === 'none' ? '' : f || stFace(name, big);
}

export function faceHtml(name, size = 40) {
    // SillyTavern's thumbnails are about 96px wide: past that on screen (phones draw 2–3 device pixels per px) use the full picture
    const big = size * (window.devicePixelRatio || 1) > 96;
    const url = faceOf(name, big);
    // a large SillyTavern avatar uses the full picture, with the thumbnail as the fallback
    const fb = big && url && !url.startsWith('data:') ? stFace(name) : '';
    let h = 0; for (const ch of nameKey(name)) h = (h * 31 + ch.codePointAt(0)) % 360;
    return `<span class="na_face" style="--s:${size}px;--h:${h}" title="${esc(name)}">${url ? `<img src="${esc(url)}"${fb && fb !== url ? ` data-fb="${esc(fb)}"` : ''} alt="" loading="lazy" decoding="async">` : esc([...String(name).trim()][0] || '?')}</span>`;
}

// an avatar that fails to load (renamed card, deleted persona) tries its thumbnail, then falls back to the letter
document.addEventListener('error', e => {
    const img = e.target;
    if (img?.tagName !== 'IMG' || !img.parentElement?.classList.contains('na_face')) return;
    if (img.dataset.fb) { const fb = img.dataset.fb; delete img.dataset.fb; img.src = fb; return; }
    img.replaceWith(img.parentElement.title.trim()[0] || '?');
}, true);

export async function shrinkFace(file) {
    const bmp = await createImageBitmap(file);
    const s = Math.min(bmp.width, bmp.height);
    // portraits keep the face in the upper part, so a tall picture is cropped nearer the top
    let src = bmp, sx = (bmp.width - s) / 2, sy = (bmp.height - s) * 0.25, ss = s;
    // a big photo is halved step by step first: one big jump to 288px drops detail and looks smeared
    while (ss > FACE_PX * 2) {
        const half = Math.round(ss / 2);
        const step = document.createElement('canvas');
        step.width = step.height = half;
        const sg = step.getContext('2d');
        sg.imageSmoothingQuality = 'high';
        sg.drawImage(src, sx, sy, ss, ss, 0, 0, half, half);
        src = step; sx = sy = 0; ss = half;
    }
    const cv = document.createElement('canvas');
    cv.width = cv.height = FACE_PX;
    const g = cv.getContext('2d');
    g.imageSmoothingQuality = 'high';
    g.drawImage(src, sx, sy, ss, ss, 0, 0, FACE_PX, FACE_PX);
    bmp.close?.();
    const webp = cv.toDataURL('image/webp', 0.9);
    return webp.startsWith('data:image/webp') ? webp : cv.toDataURL('image/jpeg', 0.9);
}

// STATE blocks: "## Name" bullets for each person, and the bullets of the other STATE headings (Relationships, household…)
export function stateParts(m) {
    const state = tailBlocks(splitTail(String(m.text || ''))[1]).filter(b => b.key === 'STATE').map(b => b.text).join('\n');
    const per = new Map(), shared = [];
    for (const part of state.split(/^(?=## )/m)) {
        const head = part.match(/^## (.+)$/m)?.[1]?.trim();
        const lines = part.split('\n').slice(head ? 1 : 0).map(l => l.trim()).filter(l => /^[-*]\s/.test(l)).map(l => l.replace(/^[-*]\s+/, ''));
        if (head && castNames({ text: `# STATE\n## ${head}\n` }).length) per.set(nameKey(head), lines);
        else shared.push(...lines);
    }
    return { per, shared };
}

export function peopleData(m) {
    const names = peopleList(m);
    const res = names.map(n => ({ n, re: nameRe(n), first: n.split(/\s+/)[0] }));
    const text = String(m.text || '');
    const secs = parseSections(text).filter(s => !s.group && RANGE_HEAD.test(s.title));
    const { per, shared } = stateParts(m);
    const people = new Map(names.map(n => [n, { name: n, secs: [], state: per.get(nameKey(n)) || [], rels: [], quotes: (m.quotes || []).filter(q => nameKey(q.who) === nameKey(n)) }]));
    const pairs = new Map();
    const pairKey = (a, b) => [a, b].sort().join('\u0001');
    for (const s of secs) {
        const body = text.slice(s.start, s.end);
        const here = res.filter(r => r.re.test(body)).map(r => r.n);
        for (const n of here) people.get(n).secs.push(s);
        for (let i = 0; i < here.length; i++) for (let j = i + 1; j < here.length; j++) {
            const k = pairKey(here[i], here[j]);
            if (!pairs.has(k)) pairs.set(k, { a: here[i], b: here[j], secs: [], lines: [], many: [] });
            pairs.get(k).secs.push(s);
        }
    }
    // relationship lines: shared STATE bullets, and a person's own bullets that name someone else
    const lines = [...shared.map(l => ({ l })), ...[...per].flatMap(([k, ls]) => ls.map(l => ({ l, owner: names.find(n => nameKey(n) === k) })))];
    for (const { l, owner } of lines) {
        const who = res.filter(r => r.re.test(l)).map(r => r.n);
        if (owner && !who.includes(owner)) who.push(owner);
        if (!owner) for (const n of who) people.get(n).rels.push(l);
        for (let i = 0; i < who.length; i++) for (let j = i + 1; j < who.length; j++) {
            const k = pairKey(who[i], who[j]);
            if (!pairs.has(k)) pairs.set(k, { a: who[i], b: who[j], secs: [], lines: [], many: [] });
            // a line about just these two describes them; one naming three or more is kept apart
            pairs.get(k)[who.length === 2 ? 'lines' : 'many'].push(l);
        }
    }
    return { names, people, pairs: [...pairs.values()], pairKey };
}

// ---- relationship temperature: the AI rates each section two people share from -5 (cold) to +5 (warm)
// m.temps = { "A\u0001B": { sectionKey: { s, why, h } } }; h is the section text's hash, so an edited section is rated again
export const AI_SYS_TEMP = `GOAL
Rate how WARM or COLD the relationship between two people is in each section of a story archive.

YOU GET
- PAIR: the two names.
- SECTIONS: S1, S2, S3 … in story order. Each one is a summary of a part of the story.

SCALE (one whole number from -5 to 5)
 5  devoted, tender, complete trust
 3  warm, close, affectionate
 1  friendly but careful
 0  neutral, or they barely deal with each other
-1  tense, uneasy, cold politeness
-3  open quarrel, bitterness, betrayal
-5  hatred, violence, total break

STEPS
1. Take one section.
2. Look ONLY at how the two people in the PAIR treat and feel about each other in that section. Ignore everyone else.
3. If both are there but do not really deal with each other, the score is 0.
4. If the mood changes inside the section, the END of the section counts more than the start.
5. Pick the number from the SCALE.
6. Write the reason in Korean, 12 words or fewer.
7. Go to the next section. Do every section. Do not skip, do not merge.

EXAMPLE
PAIR: Ren & Mara
S1: Ren pulls Mara out of the river. She thanks him and they talk until dawn.
S2: Mara finds out Ren lied about the letter. She slaps him and leaves.
S3: Ivo and Mara go to the market. Ren is mentioned once.
S4: Ren apologizes. Mara does not forgive him yet but lets him walk her home.
Answer:
S1 | 4 | 렌이 마라를 구하고 밤새 이야기함
S2 | -3 | 편지 거짓말이 드러나 마라가 떠남
S3 | 0 | 둘이 거의 엮이지 않음
S4 | 1 | 사과를 받고 조심스레 곁을 허락함

OUTPUT
One line per section, in order, exactly like this:
S<number> | <score> | <reason>
Nothing else. No title, no notes, no summary.`;

export async function rateTemps(m, pair, secs, onStep) {
    const k = [pair.a, pair.b].sort().join('\u0001');
    m.temps = m.temps && typeof m.temps === 'object' ? m.temps : {};
    const store = m.temps[k] ||= {};
    const parts = [];
    let cur = [], tok = 0;
    for (const s of secs) {
        const t = estTok(m.text.slice(s.start, s.end));
        if (cur.length && tok + t > PICK_CHUNK_TOK) { parts.push(cur); cur = []; tok = 0; }
        cur.push(s); tok += t;
    }
    if (cur.length) parts.push(cur);
    let got = 0;
    for (const [pi, part] of parts.entries()) {
        onStep?.(pi + 1, parts.length);
        const body = part.map((s, i) => `S${i + 1}: ${s.title}\n${m.text.slice(s.start, s.end).replace(/^[^\n]*\n?/, '').trim()}`).join('\n\n');
        const out = await askAI(`PAIR: ${pair.a} & ${pair.b}\n\nSECTIONS\n${body}`, { system: AI_SYS_TEMP, maxTokens: 3000 });
        for (const mt of out.matchAll(/^\s*\**S(\d+)\**\s*[|:]\s*([+\-−–]?\s*\d+)\s*[|:]\s*(.+)$/gm)) {
            const s = part[Number(mt[1]) - 1];
            if (!s) continue;
            const v = Math.max(-5, Math.min(5, parseInt(mt[2].replace(/[−–]/, '-').replace(/\s/g, ''), 10) || 0));
            store[sectionKey(s)] = { s: v, why: mt[3].trim().slice(0, 80), h: textHash(m.text.slice(s.start, s.end)) };
            got++;
        }
        await saveMeta();
    }
    return got;
}

export function tempPoints(m, pair) {
    const store = m.temps?.[[pair.a, pair.b].sort().join('\u0001')] || {};
    return pair.secs.map(s => { const t = store[sectionKey(s)]; return { s, t: t || null, stale: !!t && t.h !== textHash(m.text.slice(s.start, s.end)) }; });
}

// smooth line graph, fixed 320×150 box scaled to the width: x = shared sections in story order, y = −5…5
export const TEMP_W = 320, TEMP_H = 150, TEMP_Z = 75, TEMP_K = 13;
export function tempChart(pts) {
    const on = pts.map((p, i) => ({ p, i })).filter(x => x.p.t);
    if (!on.length) return '';
    const n = pts.length;
    const X = i => n === 1 ? TEMP_W / 2 : 6 + i * (TEMP_W - 12) / (n - 1);
    const P = on.map(({ p, i }) => [X(i), TEMP_Z - p.t.s * TEMP_K]);
    let d = `M${P[0][0].toFixed(1)},${P[0][1].toFixed(1)}`;
    for (let i = 0; i < P.length - 1; i++) {
        const p0 = P[i - 1] || P[i], p1 = P[i], p2 = P[i + 1], p3 = P[i + 2] || p2;
        d += ` C${(p1[0] + (p2[0] - p0[0]) / 6).toFixed(1)},${(p1[1] + (p2[1] - p0[1]) / 6).toFixed(1)} ${(p2[0] - (p3[0] - p1[0]) / 6).toFixed(1)},${(p2[1] - (p3[1] - p1[1]) / 6).toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`;
    }
    const last = P[P.length - 1];
    const area = `${d} L${last[0].toFixed(1)},${TEMP_Z} L${P[0][0].toFixed(1)},${TEMP_Z} Z`;
    // log bands (Y1 / Y2 …): alternate ones get a faint background
    const logOf = s => (s.title.match(RANGE_HEAD)?.[1] || '').trim();
    const bands = [];
    pts.forEach((p, i) => { const l = logOf(p.s); if (!bands.length || bands[bands.length - 1].l !== l) bands.push({ l, a: i, b: i }); else bands[bands.length - 1].b = i; });
    const edge = i => i <= 0 ? 0 : i >= n ? TEMP_W : (X(i - 1) + X(i)) / 2;
    const minI = on.reduce((a, x) => x.p.t.s < a.p.t.s ? x : a, on[0]);
    const uid = `t${Math.random().toString(36).slice(2, 7)}`;
    return {
        svg: `<svg class="na_temp_svg" viewBox="0 0 ${TEMP_W} ${TEMP_H}" role="img" aria-label="관계 온도 그래프">
          <defs><clipPath id="${uid}w"><rect x="-6" y="-12" width="${TEMP_W + 12}" height="${TEMP_Z + 12}"/></clipPath><clipPath id="${uid}c"><rect x="-6" y="${TEMP_Z}" width="${TEMP_W + 12}" height="${TEMP_H}"/></clipPath></defs>
          ${bands.map((b, k) => k % 2 ? `<rect class="band" x="${edge(b.a)}" y="0" width="${edge(b.b + 1) - edge(b.a)}" height="${TEMP_H}"/>` : '').join('')}
          <line class="zero" x1="0" x2="${TEMP_W}" y1="${TEMP_Z}" y2="${TEMP_Z}"/>
          <path class="area warm" d="${area}" clip-path="url(#${uid}w)"/><path class="area cold" d="${area}" clip-path="url(#${uid}c)"/>
          <path class="line warm" d="${d}" clip-path="url(#${uid}w)"/><path class="line cold" d="${d}" clip-path="url(#${uid}c)"/>
          ${minI.p.t.s < 0 ? `<circle class="pt cold" cx="${X(minI.i)}" cy="${TEMP_Z - minI.p.t.s * TEMP_K}" r="4"/>` : ''}
          <circle class="halo" cx="${last[0]}" cy="${last[1]}" r="9"/><circle class="pt now" cx="${last[0]}" cy="${last[1]}" r="4.5"/>
        </svg>`,
        bands: `<div class="na_temp_bands">${bands.map(b => `<span style="flex:${b.b - b.a + 1}">${esc(b.l || (bands.length > 1 ? `#${pts[b.a].s.title.match(RANGE_HEAD)[2]}–` : ''))}</span>`).join('')}</div>`,
    };
}

export const tempWord = v => v >= 3 ? '따뜻함' : v >= 1 ? '조금 따뜻함' : v === 0 ? '보통' : v >= -2 ? '조금 차가움' : '차가움';
// the line under a person's name in 도감: the one set for this chat ('' = none), else their first quote in the bank
export function personLine(m, name) {
    const set = m.personLines?.[nameKey(name)];
    if (typeof set === 'string') return set;
    return (m.quotes || []).find(q => nameKey(q.who) === nameKey(name))?.text || '';
}
// cover colours offered in 도감, picked to sit with both palettes
export const COVERS = ['#7E3B3B', '#B8541F', '#A0694B', '#C9A27E', '#6F7A4A', '#5E7D6E', '#4F6178', '#6E4A6B', '#4A3D35'];

export const tempCls = v => v > 0 ? 'warm' : v < 0 ? 'cold' : 'mid';
export const tempSign = v => v > 0 ? `+${v}` : v < 0 ? `−${-v}` : '0';

export async function openPeople() {
    const c = ctx();
    const m = getMeta();
    const g = globalSettings();
    g.faces = g.faces && typeof g.faces === 'object' ? g.faces : {};
    const short = s => (s.title.match(/^(?:\S{1,12}\s)?#\d+\s*[–—~-]\s*#?\d+/) || [s.title.slice(0, 20)])[0];
    const label = s => s.title.replace(/\s*\([^()]*\)\s*(\[[^\]]*\])?\s*$/, '').replace(RANGE_HEAD, (all, p, a, d, b, rest) => rest.replace(/^\s*[—–-]\s*/, '')) || s.title;
    const chip = s => `<button type="button" class="na_ref_chip" data-start="${s.start}" title="${esc(s.title)}">${esc(short(s))}</button>`;
    const hue = n => { let h = 0; for (const ch of nameKey(n)) h = (h * 31 + ch.codePointAt(0)) % 360; return h; };
    let view = 'book', sel = null, tab = 'state', center = null, other = null, tpair = null, busy = false, adding = false, showAll = false, coverOpen = false, lineEdit = false, data = peopleData(m);
    g.covers = g.covers && typeof g.covers === 'object' ? g.covers : {};
    const $root = $(`
      <div class="na_popup na_v2 na_people">
        <div class="na_v2_tabs na_people_tabs" role="tablist">
          <button type="button" data-v="book">도감</button><button type="button" data-v="map">관계도</button><button type="button" data-v="temp">온도</button>
        </div>
        <div class="na_people_body"></div>
        <input type="file" accept="image/*" class="na_face_file" hidden>
      </div>`);
    const pairOf = (a, b) => data.pairs.find(p => (p.a === a && p.b === b) || (p.a === b && p.b === a));
    const lastTemp = p => { if (!p) return null; const q = [...tempPoints(m, p)].reverse().find(x => x.t); return q ? q.t.s : null; };

    // ---- 도감: a strip of faces, the chosen one's profile
    const book = () => {
        const names = data.names;
        sel = names.includes(sel) ? sel : names[0] || null;
        const strip = `
          <div class="na_pb_strip">
            ${names.map(n => `<button type="button" class="na_pb_pick ${n === sel ? 'on' : ''}" data-n="${esc(n)}">${faceHtml(n, 52)}<span>${esc(n)}</span></button>`).join('')}
            <button type="button" class="na_pb_addbtn" aria-label="인물 넣기" title="인물 넣기"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg></button>
          </div>
          <div class="na_people_add" ${adding ? '' : 'hidden'}><input type="text" class="text_pole na_people_name" placeholder="인물 이름 (예: Nephthys)" enterkeyhint="done"><button type="button" class="na_btn na_small na_people_addbtn">추가</button></div>`;
        if (!sel) return `${strip}<div class="na_empty">STATE에 "## 이름" 인물이 없어요. + 로 인물을 넣어 주세요.</div>`;
        const p = data.people.get(sel);
        const extra = (m.people || []).some(x => nameKey(x) === nameKey(sel)) && !castNames(m).some(x => nameKey(x) === nameKey(sel));
        const st = g.faces[nameKey(sel)];
        const cover = g.covers[nameKey(sel)] || '';
        const line = personLine(m, sel);
        const bank = [...new Set(p.quotes.map(q => q.text))];
        // the partner they share the most sections with, for the third tile
        const best = data.pairs.filter(q => (q.a === sel || q.b === sel) && q.secs.length).sort((x, y) => y.secs.length - x.secs.length)[0];
        const bestT = lastTemp(best), bestName = best ? (best.a === sel ? best.b : best.a) : '';
        const partners = data.pairs.filter(q => (q.a === sel || q.b === sel) && (q.secs.length || q.lines.length)).sort((x, y) => y.secs.length - x.secs.length);
        const body = tab === 'state'
            ? (p.state.length ? `<ol class="na_pb_list">${p.state.map(l => `<li>${esc(l)}</li>`).join('')}</ol>` : '<div class="na_empty">STATE에 이 인물의 상태가 없어요.</div>')
            : tab === 'rel'
                ? (partners.length ? partners.map(q => { const o = q.a === sel ? q.b : q.a, t = lastTemp(q); return `
                    <div class="na_v2_card na_pb_rel">
                      <div class="na_pb_relhead">${faceHtml(o, 30)}<b>${esc(o)}</b><small>함께 ${q.secs.length}섹션</small>${t !== null ? `<span class="na_temp_pill ${tempCls(t)}">${tempSign(t)}</span>` : ''}</div>
                      ${q.lines.length ? `<ul>${q.lines.map(l => `<li>${esc(l)}</li>`).join('')}</ul>` : ''}
                      ${q.many.length ? `<details class="na_v2_more"><summary>다른 인물과 같이 나오는 줄 ${q.many.length}</summary><ul>${q.many.map(l => `<li>${esc(l)}</li>`).join('')}</ul></details>` : ''}
                    </div>`; }).join('') : '<div class="na_empty">다른 인물과 이어진 곳이 없어요.</div>')
                : (p.secs.length ? `<div class="na_pb_secs">${(showAll ? p.secs : p.secs.slice(-12)).slice().reverse().map(chip).join('')}</div>${p.secs.length > 12 && !showAll ? `<button type="button" class="na_linkbtn na_pb_more">${p.secs.length - 12}개 더 보기</button>` : ''}` : '<div class="na_empty">아카이브 섹션에 이름이 안 나와요.</div>');
        return `${strip}
          <div class="na_pb_card" data-n="${esc(sel)}">
            <div class="na_pb_cover" style="--h:${hue(sel)}${cover ? `;--cover:${esc(cover)}` : ''}">
              <button type="button" class="na_pb_coverbtn ${coverOpen ? 'on' : ''}" aria-label="배경색 바꾸기" title="배경색 바꾸기"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 22a10 10 0 1 1 10-10c0 2.8-2.2 4-4 4h-2.2a1.8 1.8 0 0 0-1.3 3.1A1.7 1.7 0 0 1 12 22z"/><circle cx="7.5" cy="10.5" r="1.2"/><circle cx="12" cy="7" r="1.2"/><circle cx="16.5" cy="10.5" r="1.2"/></svg></button>
            </div>
            <div class="na_pb_id">
              <button type="button" class="na_face_btn" aria-label="얼굴 바꾸기" title="그림 올리기">${faceHtml(sel, 96)}<span class="na_face_cam"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg></span></button>
              <b class="na_pb_name">${esc(sel)}</b>
              ${lineEdit ? `
              <div class="na_pb_lineedit">
                <input type="text" class="text_pole na_pb_linein" value="${esc(line)}" placeholder="한 줄 대사" enterkeyhint="done">
                ${bank.length ? `<small>대사 은행에서 고르기</small><div class="na_pb_linepick">${bank.map((t, i) => `<button type="button" data-i="${i}" class="${t === line ? 'on' : ''}">“${esc(t)}”</button>`).join('')}</div>` : '<small>대사 은행에 이 인물 대사가 아직 없어요</small>'}
                <div class="na_pb_linebtns"><button type="button" class="na_v2_pillbtn na_pb_lineok">저장</button>${Object.hasOwn(m.personLines || {}, nameKey(sel)) ? '<button type="button" class="na_v2_pillbtn na_pb_lineauto">처음 대사로 되돌리기</button>' : ''}<button type="button" class="na_v2_pillbtn na_pb_linecancel">취소</button></div>
              </div>`
                : line ? `<button type="button" class="na_pb_quote" title="한 줄 대사 바꾸기">“${esc(line)}”</button>`
                : '<button type="button" class="na_linkbtn na_pb_quote_add">+ 한 줄 대사</button>'}
              <span class="na_pb_faceacts">
                ${stFace(sel) && st ? '<button type="button" class="na_linkbtn na_face_st">실리태번 아바타로</button>' : ''}
                ${st !== 'none' && faceOf(sel) ? '<button type="button" class="na_linkbtn na_face_none">얼굴 빼기</button>' : ''}
                ${extra ? '<button type="button" class="na_linkbtn na_person_del">목록에서 빼기</button>' : ''}
              </span>
              ${coverOpen ? `
              <div class="na_pb_covers" role="group" aria-label="배경색">
                ${COVERS.map(c => `<button type="button" class="na_pb_sw ${c === cover ? 'on' : ''}" data-c="${c}" style="--c:${c}" aria-label="${c}"></button>`).join('')}
                <label class="na_pb_sw na_pb_swpick ${cover && !COVERS.includes(cover) ? 'on' : ''}" title="직접 고르기" style="--c:${esc(cover || '#B8541F')}"><input type="color" class="na_pb_color" value="${esc(/^#[0-9a-f]{6}$/i.test(cover) ? cover : '#b8541f')}"></label>
                ${cover ? '<button type="button" class="na_linkbtn na_pb_coverauto">원래 색</button>' : ''}
              </div>` : ''}
              <div class="na_pb_stats">
                <div><b>${p.secs.length}</b><span>섹션</span></div>
                <div><b>${p.quotes.length}</b><span>대사</span></div>
                <div>${bestT !== null ? `<b class="${tempCls(bestT)}">${tempSign(bestT)}</b><span>${esc(bestName)}과</span>` : `<b>${partners.length}</b><span>이어진 사람</span>`}</div>
              </div>
            </div>
          </div>
          <div class="na_v2_under" role="tablist">
            <button type="button" data-t="state" class="${tab === 'state' ? 'on' : ''}">지금 상태</button>
            <button type="button" data-t="rel" class="${tab === 'rel' ? 'on' : ''}">관계 ${partners.length}</button>
            <button type="button" data-t="secs" class="${tab === 'secs' ? 'on' : ''}">나온 섹션</button>
          </div>
          <div class="na_pb_body">${body}</div>
          ${p.secs.length ? `<div class="na_v2_row2"><button type="button" class="na_v2_btn" data-start="${p.secs[0].start}">처음 ${esc(short(p.secs[0]))}</button><button type="button" class="na_v2_btn" data-start="${p.secs[p.secs.length - 1].start}">최근 ${esc(short(p.secs[p.secs.length - 1]))}</button></div>` : ''}`;
    };

    // ---- 관계도: one person in the middle, the others closer the warmer they are
    const map = () => {
        const names = data.names;
        if (!names.length) return '<div class="na_empty">인물이 없어요. 도감에서 인물을 넣어 주세요.</div>';
        center = names.includes(center) ? center : (names.includes(sel) ? sel : names[0]);
        const rows = names.filter(n => n !== center).map(n => { const q = pairOf(center, n); return { n, q, t: lastTemp(q), k: q ? q.secs.length : 0 }; })
            .filter(r => r.q && (r.k || r.q.lines.length || r.q.many.length));
        const away = names.filter(n => n !== center && !rows.some(r => r.n === n));
        const max = Math.max(1, ...rows.map(r => r.k));
        rows.sort((a, b) => (b.t ?? -9) - (a.t ?? -9) || b.k - a.k);
        other = rows.some(r => r.n === other) ? other : rows[0]?.n || null;
        const placed = rows.map((r, i) => {
            const rad = r.t === null ? 0.36 : 0.2 + (5 - r.t) / 10 * 0.27;
            const a = -Math.PI / 2 + Math.PI / 5 + i * 2 * Math.PI / Math.max(rows.length, 3);
            return { ...r, x: 50 + rad * 100 * Math.cos(a), y: 50 + rad * 100 * Math.sin(a), size: 2 * Math.round(15 + 10 * r.k / max) };
        });
        const o = rows.find(r => r.n === other);
        return `
          <div class="na_v2_title"><b>${esc(center)}의 거리</b><small>가까울수록 최근 온도가 따뜻해요 · 크기 = 함께 나온 섹션</small></div>
          <div class="na_ego">
            <svg viewBox="0 0 100 100" aria-hidden="true">
              <circle class="ring warm" cx="50" cy="50" r="20"/><circle class="ring" cx="50" cy="50" r="34"/><circle class="ring cold" cx="50" cy="50" r="48"/>
              ${placed.map(r => `<line class="${r.t === null ? 'mid' : tempCls(r.t)}${r.t !== null && Math.abs(r.t) >= 3 ? ' hot' : ''} ${r.n === other ? 'on' : ''}" x1="50" y1="50" x2="${r.x.toFixed(1)}" y2="${r.y.toFixed(1)}"/>`).join('')}
            </svg>
            <span class="na_ego_lbl warm" style="top:${50 - 20}%">따뜻</span><span class="na_ego_lbl" style="top:${50 - 34}%">보통</span><span class="na_ego_lbl cold" style="top:${50 - 48}%">차가움</span>
            <span class="na_ego_me" style="left:50%;top:50%">${faceHtml(center, 72)}</span>
            ${placed.map(r => `<button type="button" class="na_ego_node ${r.n === other ? 'on' : ''}" data-n="${esc(r.n)}" style="left:${r.x.toFixed(1)}%;top:${r.y.toFixed(1)}%">${faceHtml(r.n, r.size)}<span>${esc(r.n)}${r.t !== null ? ` <b class="${tempCls(r.t)}">${tempSign(r.t)}</b>` : ''}</span></button>`).join('')}
          </div>
          ${away.length ? `<small class="na_v2_note">같이 나온 적 없음: ${away.map(esc).join(', ')}</small>` : ''}
          <div class="na_ego_pick">
            <span class="na_ego_picklbl">가운데 사람 바꾸기</span>
            <div class="na_v2_chips">${names.map(n => `<button type="button" class="na_ego_center ${n === center ? 'on' : ''}" data-n="${esc(n)}">${esc(n)}</button>`).join('')}</div>
          </div>
          ${o ? `
          <div class="na_v2_card na_ego_detail">
            <div class="na_pb_relhead">${faceHtml(o.n, 32)}<b>${esc(o.n)}</b><small>함께 ${o.k}섹션</small></div>
            ${o.q.lines.length ? `<ul>${o.q.lines.map(l => `<li>${esc(l)}</li>`).join('')}</ul>` : '<small class="na_v2_note">STATE에 둘만 나오는 관계 줄이 없어요.</small>'}
            ${o.q.many.length ? `<details class="na_v2_more"><summary>다른 인물과 같이 나오는 줄 ${o.q.many.length}</summary><ul>${o.q.many.map(l => `<li>${esc(l)}</li>`).join('')}</ul></details>` : ''}
            <div class="na_v2_row2">
              ${o.k ? `<button type="button" class="na_v2_btn primary na_temp_go" data-k="${esc(data.pairKey(center, o.n))}">온도 그래프</button>` : ''}
              ${o.k ? `<button type="button" class="na_v2_btn na_ego_secs">함께 나온 섹션</button>` : ''}
            </div>
            <div class="na_pb_secs na_ego_seclist" hidden>${o.q.secs.slice().reverse().map(chip).join('')}</div>
          </div>` : '<div class="na_empty">다른 인물과 같이 나온 섹션이 없어요.</div>'}`;
    };

    // ---- 온도: current temperature, the curve, the extremes, the big turns
    const temp = () => {
        const pairs = data.pairs.filter(p => p.secs.length).sort((x, y) => y.secs.length - x.secs.length);
        if (!pairs.length) return '<div class="na_empty">같은 섹션에 함께 나온 두 인물이 없어요.</div>';
        const pair = pairs.find(p => data.pairKey(p.a, p.b) === tpair) || pairs.find(p => p.a === sel || p.b === sel) || pairs[0];
        tpair = data.pairKey(pair.a, pair.b);
        const pts = tempPoints(m, pair);
        const todo = pts.filter(p => !p.t || p.stale).length, scored = pts.filter(p => p.t);
        const picker = `
          <label class="na_tp_pick">
            <span class="na_tp_faces">${faceHtml(pair.a, 38)}${faceHtml(pair.b, 38)}</span>
            <span class="na_tp_pickname"><b>${esc(pair.a)} · ${esc(pair.b)}</b><small>함께 나온 섹션 ${pts.length}개</small></span>
            <svg class="na_tp_chev" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>
            <select class="na_temp_sel" aria-label="짝 고르기">${pairs.map(p => `<option value="${esc(data.pairKey(p.a, p.b))}" ${p === pair ? 'selected' : ''}>${esc(p.a)} · ${esc(p.b)} (${p.secs.length})</option>`).join('')}</select>
          </label>`;
        const runBtns = `
          <div class="na_v2_row2">
            ${scored.length ? `<button type="button" class="na_v2_btn na_tp_listbtn">섹션별 점수 ${pts.length}개</button>` : ''}
            ${todo ? `<button type="button" class="na_v2_btn primary na_temp_run" data-all="0">${scored.length ? `안 잰 섹션 ${todo}개 재기` : `섹션 ${todo}개 재기`}</button>` : `<button type="button" class="na_v2_btn na_temp_run" data-all="1">전부 다시 재기</button>`}
          </div>
          <small class="na_v2_foot">AI 기능 모델(${esc(aiLabel())})이 섹션마다 −5(차가움) ~ +5(따뜻함)으로 매겨요</small>`;
        if (!scored.length) return `${picker}<div class="na_v2_card na_tp_empty"><i class="fa-solid fa-temperature-half"></i><b>아직 안 쟀어요</b><small>두 사람이 함께 나온 섹션 ${pts.length}개를 AI가 읽고 온도를 매겨요</small></div>${runBtns}`;
        const now = [...scored].pop().t.s;
        const vals = scored.map(p => p.t.s);
        const avg = Math.round(vals.reduce((a, b) => a + b, 0) / vals.length * 10) / 10;
        const hi = scored.reduce((a, p) => p.t.s > a.t.s ? p : a, scored[0]), lo = scored.reduce((a, p) => p.t.s < a.t.s ? p : a, scored[0]);
        const ch = tempChart(pts);
        // the biggest jumps between one scored section and the next
        const turns = scored.slice(1).map((p, i) => ({ p, from: scored[i].t.s, d: p.t.s - scored[i].t.s })).filter(x => Math.abs(x.d) >= 3)
            .sort((a, b) => Math.abs(b.d) - Math.abs(a.d)).slice(0, 3);
        const tile = (p, kind, word) => `
          <button type="button" class="na_tp_tile ${kind}" data-start="${p.s.start}">
            <span class="na_tp_tlabel"><i></i>${word}</span>
            <b>${esc(short(p.s))}</b>
            <span class="na_tp_tval">${tempSign(p.t.s)} · ${esc(p.t.why)}</span>
          </button>`;
        return `${picker}
          <div class="na_v2_card na_tp_card">
            <div class="na_tp_head">
              <span class="na_tp_icon ${tempCls(now)}"><svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 14.8V4a2 2 0 0 0-4 0v10.8a4 4 0 1 0 4 0z"/><path d="M12 ${now >= 3 ? 9 : now > 0 ? 11 : now === 0 ? 13 : 15}v${now >= 3 ? 7 : now > 0 ? 5 : now === 0 ? 3 : 1}"/></svg></span>
              <span class="na_tp_now" title="지금 온도 · ${esc(short(scored[scored.length - 1].s))}"><small>지금 온도</small><span class="${tempCls(now)}"><b>${tempSign(now)}</b>${tempWord(now)}</span></span>
              <span class="na_tp_stats">
                <span><small>평균</small><b>${avg > 0 ? '+' : avg < 0 ? '−' : ''}${Math.abs(avg)}</b></span>
                <span><small>최고</small><b class="warm">${tempSign(hi.t.s)}</b></span>
                <span><small>최저</small><b class="cold">${tempSign(lo.t.s)}</b></span>
              </span>
            </div>
            <div class="na_tp_chart">${ch.svg}${ch.bands}</div>
            ${todo ? `<small class="na_v2_note">안 잰 섹션 ${todo}개는 빼고 그렸어요</small>` : ''}
          </div>
          <div class="na_tp_tiles">${tile(hi, 'warm', '가장 따뜻했던 때')}${tile(lo, 'cold', '가장 차가웠던 때')}</div>
          ${turns.length ? `<div class="na_v2_label">크게 바뀐 순간</div>
          ${turns.map(x => `
            <button type="button" class="na_tp_turn" data-start="${x.p.s.start}">
              <span class="na_tp_jump ${x.d > 0 ? 'warm' : 'cold'}">${tempSign(x.from)} → ${tempSign(x.p.t.s)}</span>
              <span class="na_tp_turntxt"><b>${esc(x.p.t.why)}</b><small>${esc(short(x.p.s))} · ${esc(label(x.p.s))}</small></span>
            </button>`).join('')}` : ''}
          ${runBtns}
          <div class="na_tp_list" hidden>${pts.map(p => `
            <button type="button" class="na_tp_row" data-start="${p.s.start}">
              <b class="na_temp_pill ${p.t ? tempCls(p.t.s) : 'none'}">${p.t ? tempSign(p.t.s) : '–'}</b>
              <span class="na_tp_turntxt"><span>${p.t ? esc(p.t.why) : '안 잼'}${p.stale ? ' <small class="na_warn_txt">섹션이 바뀜</small>' : ''}</span><small>${esc(short(p.s))} · ${esc(label(p.s))}</small></span>
            </button>`).join('')}</div>`;
    };

    const draw = () => {
        data = peopleData(m);
        $root.find('.na_people_tabs button').each(function () { $(this).toggleClass('on', this.dataset.v === view).attr('aria-selected', this.dataset.v === view); });
        $root.find('.na_people_body').attr('data-view', view).html(view === 'book' ? book() : view === 'map' ? map() : temp());
    };
    const go = st => { $root.closest('dialog').find('.popup-button-ok').trigger('click'); gotoSection(st); };
    $root.on('click', '.na_people_tabs button', function () { view = this.dataset.v; draw(); });
    // 도감
    $root.on('click', '.na_pb_pick', function () { sel = String($(this).data('n')); lineEdit = false; draw(); });
    $root.on('click', '.na_v2_under button', function () { tab = this.dataset.t; draw(); });
    $root.on('click', '.na_pb_more', () => { showAll = true; draw(); });
    $root.on('click', '.na_pb_addbtn', () => { adding = !adding; draw(); if (adding) $root.find('.na_people_name').trigger('focus'); });
    // 관계도
    $root.on('click', '.na_ego_node', function () { other = String($(this).data('n')); draw(); });
    $root.on('click', '.na_ego_center', function () { center = String($(this).data('n')); other = null; draw(); });
    $root.on('click', '.na_ego_secs', () => $root.find('.na_ego_seclist').prop('hidden', (i, h) => !h));
    // 온도
    $root.on('change', '.na_temp_sel', function () { tpair = this.value; draw(); });
    $root.on('click', '.na_temp_go', function () { tpair = String($(this).data('k')); view = 'temp'; draw(); });
    $root.on('click', '.na_tp_listbtn', () => $root.find('.na_tp_list').prop('hidden', (i, h) => !h));
    $root.on('click', '.na_tp_tile, .na_tp_turn, .na_tp_row, .na_v2_btn[data-start], .na_ref_chip', function () { go(Number(this.dataset.start)); });
    $root.on('click', '.na_temp_run', async function () {
        if (busy) return;
        const pair = data.pairs.find(p => data.pairKey(p.a, p.b) === tpair);
        if (!pair) return;
        const all = this.dataset.all === '1';
        const secs = tempPoints(m, pair).filter(p => all || !p.t || p.stale).map(p => p.s);
        if (all && !await confirm('전부 다시', `${esc(pair.a)} · ${esc(pair.b)}이 함께 나온 섹션 ${secs.length}개를 모두 다시 잴까요?`)) return;
        busy = true;
        const $b = $(this);
        const got = await withSpinner($b, '재는 중…', () => rateTemps(m, pair, secs, (i, n) => n > 1 && $b.html(`<i class="fa-solid fa-spinner fa-spin"></i> ${i}/${n}번째 읽는 중…`)));
        busy = false;
        if (got !== null) { if (got < secs.length) toastr.warning(`${secs.length}개 중 ${got}개만 점수가 왔어요. 남은 건 다시 눌러 주세요.`); draw(); }
    });
    // faces and the roster
    const save = async () => { saveGlobal(); draw(); };
    let target = null;
    $root.on('click', '.na_face_btn', function () { target = String($(this).closest('.na_pb_card').data('n')); $root.find('.na_face_file').val('').trigger('click'); });
    $root.find('.na_face_file').on('change', async function () {
        const f = this.files?.[0];
        if (!f || !target) return;
        try { g.faces[nameKey(target)] = await shrinkFace(f); await save(); }
        catch (e) { toastr.error(`그림을 못 읽었어요: ${e.message || e}`); }
    });
    $root.on('click', '.na_face_st', async () => { delete g.faces[nameKey(sel)]; await save(); });
    $root.on('click', '.na_face_none', async () => { g.faces[nameKey(sel)] = 'none'; await save(); });
    // the cover colour (kept with the faces, for every chat)
    const setCover = c => { if (c) g.covers[nameKey(sel)] = c; else delete g.covers[nameKey(sel)]; save(); };
    $root.on('click', '.na_pb_coverbtn', () => { coverOpen = !coverOpen; draw(); });
    $root.on('click', '.na_pb_sw[data-c]', function () { setCover(this.dataset.c); });
    $root.on('input', '.na_pb_color', function () { $root.find('.na_pb_cover').css('--cover', this.value); });
    $root.on('change', '.na_pb_color', function () { setCover(this.value); });
    $root.on('click', '.na_pb_coverauto', () => setCover(''));
    // the one-line quote under the name (this chat): typed, or picked from the quote bank
    const setLine = async v => {
        m.personLines = m.personLines && typeof m.personLines === 'object' ? m.personLines : {};
        if (v === null) delete m.personLines[nameKey(sel)]; else m.personLines[nameKey(sel)] = v;
        lineEdit = false;
        await saveMeta(); draw();
    };
    $root.on('click', '.na_pb_quote, .na_pb_quote_add', () => { lineEdit = true; draw(); $root.find('.na_pb_linein').trigger('focus'); });
    $root.on('click', '.na_pb_linepick button', function () { setLine([...new Set(data.people.get(sel).quotes.map(q => q.text))][+this.dataset.i]); });
    $root.on('click', '.na_pb_lineok', () => setLine(String($root.find('.na_pb_linein').val() || '').trim()));
    $root.on('click', '.na_pb_lineauto', () => setLine(null));
    $root.on('click', '.na_pb_linecancel', () => { lineEdit = false; draw(); });
    $root.on('keydown', '.na_pb_linein', e => {
        if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); lineEdit = false; draw(); }
        else if (e.key === 'Enter' && !e.originalEvent?.isComposing && e.keyCode !== 229) { e.preventDefault(); setLine(String(e.target.value || '').trim()); }
    });
    $root.on('click', '.na_person_del', async () => {
        const k = nameKey(sel);
        m.people = (m.people || []).filter(x => nameKey(x) !== k);
        sel = null;
        await saveMeta(); draw();
    });
    const add = async () => {
        const v = String($root.find('.na_people_name').val() || '').trim();
        if (!v) return;
        if (data.names.some(n => nameKey(n) === nameKey(v))) return toastr.info('이미 있는 인물이에요.');
        m.people = [...(Array.isArray(m.people) ? m.people : []), v];
        sel = v; adding = false;
        await saveMeta(); draw();
    };
    $root.on('click', '.na_people_addbtn', add);
    $root.on('keydown', '.na_people_name', e => { if (e.key === 'Enter' && !e.originalEvent?.isComposing && e.keyCode !== 229) { e.preventDefault(); add(); } });
    draw();
    await c.callGenericPopup($root, c.POPUP_TYPE.TEXT, '', { wide: true, large: true, allowVerticalScrolling: true, leftAlign: true, okButton: '닫기' });
}
