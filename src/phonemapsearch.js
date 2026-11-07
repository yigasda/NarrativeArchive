// 캐릭터 휴대폰 · 다녀간 곳 › 도시 찾기 (mq_, the approved flow docs/mockups/phone-map/search): the search sheet over the
// map (recent towns, the towns visited), the results while typing (towns · neighbourhoods · kinds of map), a town (its map,
// its names, the maps that suit it, its neighbourhoods, day ↔ night) and a neighbourhood (its map, full screen).
// The field is an editable div, not an input: SillyTavern themes paint every input (with !important), never a div.
// Routes: mapq (the sheet; mapq:@kind lists the towns a kind of map suits), mapc:place~hood~kind~night.
import { AX, ax, axBar, axCb, axChev, axInd, axTop, mapNight, mapTowns } from './phoneapps.js';
import { pinSpots, pinSvg, stripSvg, townCandidates, townPlace, townSvg } from './phonemapart.js';
import { findTowns, hoodTown, kindTowns, placeNames, placeView } from './phonemapfind.js';
import { HINT, PLACE } from './phonemapcity.js';
import { TOWN_KO } from './phonemaptowns.js';
import { flagSvg, FLAG_NAME } from './phoneflags.js';
import { nameKey } from './people.js';
import { esc } from './util.js';
import { countryOf, parts, placeInfo } from './phonedata.js';

// a folded map (a kind of map) and two arrows (another map)
// (added on first use: this file can load while phoneapps.js is still loading)
const icon = (...a) => { if (!AX.mqmap) Object.assign(AX, { mqmap: 'M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2zM9 4v14M15 6v14', mqswap: 'M4 9h13l-3-3M20 15H7l3 3' }); return ax(...a); };
const W = 390;
const findBtn = () => `<button type="button" class="ax_cb" data-go="mapq" aria-label="도시 찾기">${ax('search', 18, 'currentColor', 2.3)}</button>`;
const kindName = k => TOWN_KO[k] || '';
// a town's map as drawn: a visited town keeps the map and the look 다녀간 곳 gives it
function look(p, m, i, hood, kind, night) {
    const { groups, kinds } = mapTowns(p, m), g = groups.find(x => x.city && townPlace(x.city) === i), v = placeView(i, hood);
    const own = g && hood < 0 ? kinds.get(g.k) : '';
    const k = kind && TOWN_KO[kind] ? kind : own || v.maps[0];
    const dark = night === '1' ? true : night === '0' ? false : g ? mapNight(g, p.now) : false;
    const seed = v.hood ? `${v.ko}|${v.hood.label}` : g ? g.k : nameKey(v.ko);
    // the same hint 다녀간 곳 gives a visited town (its places), else the town's names (an Egypt sheet picks itself by them)
    const hint = v.hood ? HINT[hood][1].join(' ') : g ? g.rows.map(r => r.place).join(' ') : v.names.all.join(' ');
    return { g, v, k, dark, seed, hint, maps: own && !v.maps.includes(own) ? [own, ...v.maps] : own ? [own, ...v.maps.filter(x => x !== own)] : v.maps };
}
const at = (i, hood = -1, kind = '', night = '') => `${i}~${hood >= 0 ? hood : ''}~${kind}~${night}`;
const hl = (name, q) => { const n = name.toLowerCase(), k = n.indexOf(q); return k < 0 || !q ? esc(name) : `${esc(name.slice(0, k))}<b class="mq_hl">${esc(name.slice(k, k + q.length))}</b>${esc(name.slice(k + q.length))}`; };
const flagTile = cc => `<span class="ax_si mq_fl">${flagSvg(cc, 22) || ax('pindot', 17, 'var(--axd)', 2.2)}</span>`;
const townRow = (i, q, sub) => { const n = placeNames(i), other = [n.lat, n.cjk].filter(Boolean)[0];
    return `<button type="button" class="ax_rw mq_rw" data-go="mapc" data-i="${at(i)}">${flagTile(PLACE[i][3])}<span class="ax_tx"><span class="ax_n">${hl(n.ko, q)}${other ? ` · ${hl(other, q)}` : ''}</span><span class="ax_p1">${esc(sub)}</span></span>${axChev}</button>`; };
const sub = i => [...new Set([FLAG_NAME[PLACE[i][3]], kindName(placeView(i).maps[0])].filter(Boolean))].join(' · ');

// the sheet's content: nothing typed (the recent towns, the towns visited), the results, or the towns of a kind of map
export function mapResults(p, m, query = '', kind = '') {
    const q = String(query).normalize('NFC').toLowerCase().trim();
    if (kind) {
        const ts = kindTowns(kind);
        return `<div class="ax_sec">${esc(kindName(kind))} 지도가 어울리는 곳</div><div class="ax_card">${ts.map(i => townRow(i, '', sub(i))).join('')}</div><i class="ax_pad"></i>`;
    }
    if (!q) {
        const recent = (p.mapSeen || []).map(townPlace).filter(i => i >= 0).slice(0, 5);
        const { groups } = mapTowns(p, m), been = groups.filter(g => g.city).slice(0, 8);
        const chip = g => { const i = townPlace(g.city); return i >= 0 ? `<button type="button" class="mq_chip" data-go="mapc" data-i="${at(i)}">${flagSvg(PLACE[i][3], 18)}${esc(g.city)}</button>` : `<button type="button" class="mq_chip" data-go="map" data-i="${esc(g.k)}">${ax('pindot', 14, 'var(--axd)', 2.2)}${esc(g.city)}</button>`; };
        return `${recent.length ? `<div class="ax_sec">최근 본 도시</div><div class="ax_card">${recent.map(i => townRow(i, '', sub(i))).join('')}</div>` : ''}
          ${been.length ? `<div class="ax_sec">다녀간 도시</div><div class="mq_chips">${been.map(chip).join('')}</div>` : ''}
          ${!recent.length && !been.length ? '<div class="mq_tip">서울 · 東京 · Berlin · 홍대처럼<br>도시나 동네 이름으로 찾아요</div>' : ''}<i class="ax_pad"></i>`;
    }
    const { towns, hoods, kinds } = findTowns(q);
    if (!towns.length && !hoods.length && !kinds.length) return '<div class="mq_tip">찾는 곳이 표에 없어요</div>';
    const hoodRow = k => { const t = hoodTown(k), words = HINT[k][1].filter(w => w.includes(q)), shown = words.length && !HINT[k][3].toLowerCase().includes(q) ? `${HINT[k][3]} · ${words[0]}` : HINT[k][3];
        return `<button type="button" class="ax_rw mq_rw" data-go="mapc" data-i="${at(t, k)}">${flagTile(PLACE[t][3])}<span class="ax_tx"><span class="ax_n">${hl(shown, q)}</span><span class="ax_p1">${esc(PLACE[t][0])}의 동네 · ${esc(kindName(HINT[k][2][0]))}</span></span>${axChev}</button>`; };
    return `${towns.length ? `<div class="ax_sec">도시</div><div class="ax_card">${towns.map(i => townRow(i, q, sub(i))).join('')}</div>` : ''}
      ${hoods.length ? `<div class="ax_sec">동네</div><div class="ax_card">${hoods.map(hoodRow).join('')}</div>` : ''}
      ${kinds.length ? `<div class="ax_sec">지도 종류</div><div class="mq_chips">${kinds.map(k => `<button type="button" class="mq_chip" data-go="mapq" data-i="@${k}">${icon('mqmap', 14, 'var(--axd)', 2.2)}${esc(kindName(k))}</button>`).join('')}</div>` : ''}<i class="ax_pad"></i>`;
}

// ① ② the search sheet over the map they were last in
export function mapSearchScreen(p, now, m, i = '', query = '') {
    const { groups, kinds } = mapTowns(p, m), g = groups[0], kind = i.startsWith('@') ? i.slice(1) : '';
    const dark = g ? mapNight(g, p.now) : false, k = g ? kinds.get(g.k || `~${p.owner}`) : 'bigRiver';
    const art = `<svg class="mp_art" viewBox="0 0 ${W} 430" width="100%" aria-hidden="true">${townSvg(k, W, 430, g ? g.k || p.owner : p.owner, dark, g ? g.rows.map(r => r.place).join(' ') : '')}</svg>`;
    const full = kind || String(query).trim();
    return `<div class="mp_wx mq_wx${dark ? ' mp_dark' : ''}"><div class="mp_bg">${art}</div>${axBar(p, now, dark && !full ? '#fff' : '#111')}${axTop(axCb(kind ? 'mapq' : 'map'))}
      <div class="mq_sheet${full ? ' mq_full' : ''}"><i class="mp_grab"></i>
        ${kind ? `<div class="mq_kh">${icon('mqmap', 16, 'var(--axd)', 2.2)}<b>${esc(kindName(kind))}</b></div>` : `<div class="mq_field">${ax('search', 17, '#8a929d', 2.2)}<div class="mq_in" contenteditable="true" role="searchbox" enterkeyhint="search" spellcheck="false" aria-label="도시 찾기" data-ph="도시 · 동네 찾기 (東京, Berlin, 홍대 …)">${esc(query)}</div><button type="button" class="mq_x${query ? ' on' : ''}" aria-label="지우기">${ax('x', 12, '#fff', 3)}</button></div>`}
        <div class="ax_scroll mq_res">${mapResults(p, m, query, kind)}</div>
      </div>${axInd(dark && !full ? '#fff' : '#111')}</div>`;
}

// ③ a town, ④ a neighbourhood
export function mapCityScreen(p, now, m, i = '') {
    const [pi, hs, kind, night] = String(i).split('~'), place = Number(pi), hood = hs === '' || hs === undefined ? -1 : Number(hs);
    if (!PLACE[place]) return mapSearchScreen(p, now, m);
    const L = look(p, m, place, hood, kind, night), { g, v, k, dark } = L;
    const H = v.hood ? 844 : 470;
    const pins = g ? (() => { const shown = g.rows.slice(0, 6); return pinSpots(shown.map(r => r.place), W, v.hood ? 220 : 150, v.hood ? 560 : 340).map(([x, y], n) => pinSvg(x, y, shown[n].place, dark)).join(''); })() : '';
    const art = `<svg class="mp_art" viewBox="0 0 ${W} ${H}" width="100%" aria-hidden="true">${townSvg(k, W, H, L.seed, dark, L.hint)}${pins}</svg>`;
    const names = [v.names.lat, v.names.cjk, ...v.names.all.slice(1).filter(n => n !== v.names.lat.toLowerCase() && n !== v.names.cjk && !/^[a-z]/.test(n))].filter(Boolean);
    const nameLine = [...new Set(names)].slice(0, 4).join(' · ');
    const flip = at(place, hood, k, dark ? '0' : '1');
    const country = `<span class="mq_ct">${flagSvg(v.cc, 22)}<span>${esc(v.country)}${v.hood ? ` · ${esc(v.ko)}` : ''}</span></span>`;
    const seen = g ? `다녀간 곳 ${g.rows.length}` : '';
    const hoodChips = v.hoods.length ? v.hoods.map(h => `<button type="button" class="mq_chip${v.hood?.k === h ? ' on' : ''}" data-go="mapc" data-i="${v.hood?.k === h ? at(place) : at(place, h)}">${esc(HINT[h][3])}</button>`).join('') : '';
    if (v.hood) {
        const next = L.maps[(L.maps.indexOf(k) + 1) % L.maps.length];
        return `<div class="mp_wx mq_wx mq_one${dark ? ' mp_dark' : ''}"><div class="mp_bg mq_bgfull">${art}</div>${axBar(p, now, dark ? '#fff' : '#111')}${axTop(axCb('mapc', 'back').replace('data-go="mapc"', `data-go="mapc" data-i="${at(place)}"`), findBtn())}
          <div class="mq_hc">${hoodChips}</div>
          <div class="mq_fc">${country}
            <div class="mq_tl"><b>${esc(v.hood.label)}</b>${dark ? '<span class="mq_pill">밤 지도</span>' : ''}</div>
            <span class="mq_nm">${esc(kindName(k))}${seen ? ` · ${seen}` : ''}</span>
            <div class="mq_btns"><button type="button" class="mq_b2" data-go="mapc" data-i="${flip}">${dark ? '☀ 낮으로' : '☾ 밤으로'}</button><button type="button" class="mq_b1" data-go="mapc" data-i="${at(place, hood, next, night || '')}">${icon('mqswap', 15, '#fff', 2.2)} 다른 지도</button></div>
          </div>${axInd(dark ? '#fff' : '#111')}</div>`;
    }
    const thumbs = L.maps.slice(0, 8).map(x => `<button type="button" class="mq_th${x === k ? ' on' : ''}" data-go="mapc" data-i="${at(place, -1, x, night || '')}" aria-label="${esc(kindName(x))}"><svg viewBox="0 0 ${W} 430" width="96" height="78" preserveAspectRatio="xMidYMid slice" aria-hidden="true">${townSvg(x, W, 430, L.seed, dark, L.hint)}</svg><span>${esc(kindName(x))}</span></button>`).join('');
    return `<div class="mp_wx mq_wx${dark ? ' mp_dark' : ''}"><div class="mp_bg mq_bgcity">${art}</div>${axBar(p, now, dark ? '#fff' : '#111')}${axTop(axCb('mapq'), findBtn())}
      <div class="ax_scroll"><i class="mp_gap mq_gap"></i><div class="mp_sheet"><i class="mp_grab"></i>
        <div class="mq_hd">${country}
          <div class="mq_tl"><b>${esc(v.ko)}</b><button type="button" class="mq_dn" data-go="mapc" data-i="${flip}">${dark ? '☾ 밤 · ☀ 낮으로' : '☀ 낮 · ☾ 밤으로'}</button></div>
          ${nameLine ? `<span class="mq_nm">${esc(nameLine)}</span>` : ''}
          <span class="mq_nm">${esc(kindName(k))} 지도</span></div>
        ${g ? `<div class="ax_card"><button type="button" class="ax_rw ax_place" data-go="map" data-i="${esc(g.k)}"><span class="ax_si" style="background: var(--axc)">${ax('pindot', 17, 'var(--axd)', 2.2)}</span><span class="ax_tx"><span class="ax_n">${seen}</span><span class="ax_p1">${esc(g.rows.slice(0, 3).map(r => r.place).join(' · '))}</span></span>${axChev}</button></div>` : ''}
        <div class="ax_sec">어울리는 지도 · ${L.maps.length}</div>
        <div class="mq_ths">${thumbs}</div>
        ${hoodChips ? `<div class="ax_sec">동네</div><div class="mq_chips">${hoodChips}</div>` : ''}
        <i class="ax_pad"></i></div></div>
      ${axInd()}</div>`;
}

// 다녀간 곳 with nothing visited yet (시안 docs/mockups/phone-map/empty): the month strip still on top, empty (what will
// fill it), then one small line for where they live, the search field and the town's neighbourhoods (small)
export function mapEmptyScreen(p, now, m) {
    const own = placeInfo(p).owner, cc = String(own.lives || '').toLowerCase(), i = townPlace(own.city), v = i >= 0 ? placeView(i) : null;
    const k = v ? townCandidates(v.ko)[0] : 'gridLake', dark = false;
    const art = `<svg class="mp_art" viewBox="0 0 ${W} 430" width="100%" aria-hidden="true">${townSvg(k, W, 430, v ? nameKey(v.ko) : p.owner, dark, v ? v.names.all.join(' ') : '')}</svg>`;
    const nowP = parts(now), mo = nowP?.mo || 1, days = new Date(Date.UTC(Number(p.year) || 2001, mo, 0)).getUTCDate();
    const st = stripSvg({ days, today: nowP?.d || 0, blocks: [] }), c = st.cell;
    const ghost = [[3, 5], [11, 12], [18, 21]].map(([a, b]) => `<rect x="${(a - 1) * c + 1}" y="${st.top + 2}" width="${(b - a + 1) * c - 2}" height="14" rx="5" fill="none" stroke="#c9cfd8" stroke-width="1.2" stroke-dasharray="3 3"/>`).join('');
    const strip = `<div class="ax_card mp_month"><div class="mp_mh"><span class="mp_lbl">${mo}월에 다닌 곳</span><span class="mp_big"><b class="cg_num">0</b><u>곳</u><span>이야기에서 어딘가 가면 여기 쌓여요</span></span></div><div class="mp_st">${st.svg.replace('</svg>', `${ghost}</svg>`)}</div></div>`;
    // where they live (a city, never the country written as one): one small line under the strip (the strip is the screen's one big thing)
    const where = v ? `${esc(v.ko)}에 살아요` : own.city && !countryOf(own.city) ? `${esc(own.city)}에 살아요` : '사는 도시를 정하면 그 도시 지도가 나와요';
    const head = `<div class="mq_lv">${cc ? flagSvg(cc, 20) : ''}<span>${cc && FLAG_NAME[cc] ? `${esc(FLAG_NAME[cc])} · ` : ''}${where}</span></div>`;
    const field = `<button type="button" class="mq_field mq_go" data-go="mapq">${ax('search', 17, '#8a929d', 2.2)}<span class="mq_ph">도시 · 동네 찾기 (東京, Berlin, 홍대 …)</span></button>`;
    const hoods = v && v.hoods.length ? `<div class="mq_chips mq_sm">${v.hoods.map(h => `<button type="button" class="mq_chip" data-go="mapc" data-i="${at(i, h)}">${esc(HINT[h][3])}</button>`).join('')}</div>` : '';
    return `<div class="mp_wx"><div class="mp_bg">${art}</div>${axBar(p, now)}${axTop(axCb('home'))}
      <div class="ax_scroll"><i class="mp_gap"></i><div class="mp_sheet"><i class="mp_grab"></i>
        ${strip}${head}${field}${hoods}<i class="ax_pad"></i></div></div>
      ${axInd()}</div>`;
}
