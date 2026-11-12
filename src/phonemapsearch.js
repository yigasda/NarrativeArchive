// 캐릭터 휴대폰 · 다녀간 곳 › 도시 찾기 (mq_, the approved flow docs/mockups/phone-map/search): the search sheet over the
// map (recent towns, the towns visited), the results while typing (towns · neighbourhoods · kinds of map), a town (its map,
// its names, the maps that suit it, its neighbourhoods, day ↔ night) and a neighbourhood (its map, full screen).
// The field is an editable div, not an input: SillyTavern themes paint every input (with !important), never a div.
// Routes: mapq (the sheet; mapq:@kind lists the towns a kind of map suits), mapc:place~hood~kind~night.
import { AX, ax, axBar, axCb, axChev, axInd, axTop, mapFindBtn, mapFindRow, mapTowns, tileAt, TILE_CREDIT } from './phoneapps.js';
import { pinLayer, pinSpots, pinSvg, stripSvg, townCandidates, townPlace, townSvg } from './phonemapart.js';
import { countryHoods, countryTowns, findCountries, findTowns, hoodTown, kindTowns, placeNames, placeView } from './phonemapfind.js';
import { HINT, PLACE } from './phonemapcity.js';
import { TOWN_KO } from './phonemaptowns.js';
import { flagSvg, FLAG_NAME } from './phoneflags.js';
import { nameKey } from './people.js';
import { esc } from './util.js';
import { SPOTS } from './phonemapspots.js';
import { spotIn } from './phonetilemap.js';
import { countryOf, parts, placeInfo } from './phonedata.js';

// a folded map (a kind of map) and two arrows (another map)
// (added on first use: this file can load while phoneapps.js is still loading)
const icon = (...a) => { if (!AX.mqmap) Object.assign(AX, { mqmap: 'M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2zM9 4v14M15 6v14', mqswap: 'M4 9h13l-3-3M20 15H7l3 3' }); return ax(...a); };
const W = 390;
const kindName = k => TOWN_KO[k] || '';
// a town's map as drawn: a visited town keeps the map and the look 다녀간 곳 gives it
function look(p, m, i, hood, kind, night) {
    const { groups, kinds } = mapTowns(p, m), g = groups.find(x => x.city && townPlace(x.city) === i), v = placeView(i, hood);
    const own = g && hood < 0 ? kinds.get(g.k) : '';
    const k = kind && TOWN_KO[kind] ? kind : own || v.maps[0];
    const dark = false;   // 밤 지도는 뺐어요(11-12)
    const seed = v.hood ? `${v.ko}|${v.hood.label}` : g ? g.k : nameKey(v.ko);
    // the same hint 다녀간 곳 gives a visited town (its places), else the town's names (an Egypt sheet picks itself by them)
    const hint = v.hood ? HINT[hood][1].join(' ') : g ? g.rows.map(r => r.place).join(' ') : v.names.all.join(' ');
    return { g, v, k, dark, seed, hint, maps: own && !v.maps.includes(own) ? [own, ...v.maps] : own ? [own, ...v.maps.filter(x => x !== own)] : v.maps };
}
const at = (i, hood = -1, kind = '', night = '') => `${i}~${hood >= 0 ? hood : ''}~${kind}~${night}`;
const hl = (name, q) => { const n = name.toLowerCase(), k = n.indexOf(q); return k < 0 || !q ? esc(name) : `${esc(name.slice(0, k))}<b class="mq_hl">${esc(name.slice(k, k + q.length))}</b>${esc(name.slice(k + q.length))}`; };
const flagTile = cc => `<span class="ax_si mq_fl">${flagSvg(cc, 22) || ax('pindot', 17, 'var(--axd)', 2.2)}</span>`;
const townRow = (i, q, sub) => { const n = placeNames(i), other = [n.lat, n.cjk].filter(Boolean)[0];
    return `<button type="button" class="ax_rw mq_rw" data-go="mapc" data-i="${at(i)}">${flagTile(PLACE[i][3])}<span class="ax_tx"><span class="ax_n">${hl(n.ko, q)}${other ? ` · ${hl(other, q)}` : ''}</span>${sub ? `<span class="ax_p1">${esc(sub)}</span>` : ''}</span>${axChev}</button>`; };
const hoodLine = (k, q) => { const t = hoodTown(k), words = q ? HINT[k][1].filter(w => w.includes(q)) : [], shown = words.length && !HINT[k][3].toLowerCase().includes(q) ? `${HINT[k][3]} · ${words[0]}` : HINT[k][3];
    return `<button type="button" class="ax_rw mq_rw" data-go="mapc" data-i="${at(t, k)}">${flagTile(PLACE[t][3])}<span class="ax_tx"><span class="ax_n">${hl(shown, q)}</span><span class="ax_p1">${esc(PLACE[t][0])}의 동네</span></span>${axChev}</button>`; };
// a country (시안 docs/mockups/phone-map/country-list B): its big towns (many neighbourhoods) as little map cards to swipe,
// the rest folded by what kind of place they are (a row opens its list in place); names only, no description
const GROUPS = [['도시', ['도심', '교외', '일터', '공항']], ['바닷가 · 섬', ['바다', '섬']], ['산 · 호수', ['산', '호수', '숲', '온천']], ['마을 · 옛 시내', ['옛마을', '시골', '강골짜기']]];
const groupOf = i => { const sp = spotIn(SPOTS, PLACE[i][0], []), k = sp ? sp[2].split('·')[0] : '도심'; const g = GROUPS.findIndex(([, ks]) => ks.includes(k)); return g < 0 ? 0 : g; };
// each fold's mark (시안 country-list B: a coloured square with what kind of place it is)
const GMARK = [['#e2e9f5', '#2c4a80', 'M4 21V9l5-3v15M9 21V4l6 3v14M15 21v-9l5 2v7M3 21h18'], ['#dff1f4', '#1f7f8c', 'M3 17c2-1.5 3 1.5 5 0s3 1.5 5 0 3 1.5 5 0 3 1.5 3 0M6 13c1-4 4-6 8-6'],
    ['#dcefdf', '#3f7d50', 'M2 20l7-12 4 6 3-4 6 10z'], ['#f4ead9', '#8a6a3a', 'M4 21V11l4-3 4 3v10M12 21V8l4-4 4 4v13M3 21h18'], ['#f1e6f1', '#7d4a7d', 'M12 21s-6-5.4-6-10.5a6 6 0 0 1 12 0C18 15.6 12 21 12 21zM12 12.5a2 2 0 1 0 0-4 2 2 0 0 0 0 4z']];
const gMark = g => { const [bg, fg, d] = GMARK[g]; return `<span class="ax_si mq_gi" style="--axbg: ${bg}; background: ${bg}"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="${fg}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${d}"/></svg></span>`; };
const bigCard = i => `<button type="button" class="mq_tc mq_hth" data-tw="128" data-th="84" data-go="mapc" data-i="${at(i)}" aria-label="${esc(PLACE[i][0])}" data-tt="${esc(JSON.stringify({ city: PLACE[i][0], words: [], big: 1 }))}"><i class="mq_tph" aria-hidden="true"></i><b>${esc(PLACE[i][0])}</b></button>`;
const countryView = (cc, open = -1) => { const ts = countryTowns(cc), hs = countryHoods(cc);
    const big = ts.filter(i => placeView(i).hoods.length >= 3), rest = ts.filter(i => !big.includes(i));
    const groups = GROUPS.map(([name], g) => [name, rest.filter(i => groupOf(i) === g), g]).filter(([, l]) => l.length);
    const fold = groups.map(([name, l, g]) => { const on = g === open;
        return `<button type="button" class="ax_rw mq_rw mq_fold${on ? ' on' : ''}" data-go="mapq" data-i="#${cc}${on ? '' : `~${g}`}">${gMark(g)}<span class="ax_tx"><span class="ax_n">${esc(name)}</span><span class="ax_p1">${esc(l.slice(0, 3).map(i => PLACE[i][0]).join(' · '))}${l.length > 3 ? ' …' : ''}</span></span><span class="mq_cnt cg_num">${l.length}</span>${axChev}</button>${on ? l.map(i => townRow(i, '', '')).join('') : ''}`; }).join('');
    const hoodFold = hs.length ? `<button type="button" class="ax_rw mq_rw mq_fold${open === 9 ? ' on' : ''}" data-go="mapq" data-i="#${cc}${open === 9 ? '' : '~9'}">${gMark(4)}<span class="ax_tx"><span class="ax_n">동네</span><span class="ax_p1">${esc(hs.slice(0, 3).map(k => HINT[k][3]).join(' · '))}${hs.length > 3 ? ' …' : ''}</span></span><span class="mq_cnt cg_num">${hs.length}</span>${axChev}</button>${open === 9 ? hs.map(k => hoodLine(k, '')).join('') : ''}` : '';
    const head = `<div class="mq_kh mq_land">${flagSvg(cc, 28)}<b>${esc(FLAG_NAME[cc] || '')}</b><small>${ts.length}곳</small></div>`;
    return `${head}${big.length ? `<div class="ax_sec">큰 도시 · ${big.length}</div><div class="mq_bigs">${big.map(bigCard).join('')}</div>` : ''}
      ${fold || hoodFold ? `<div class="ax_sec">${big.length ? `그 밖의 곳 · ${rest.length}` : `도시 · ${ts.length}`}</div><div class="ax_card">${fold}${hoodFold}</div>` : ''}`; };
const countryRow = cc => `<button type="button" class="ax_rw mq_rw" data-go="mapq" data-i="#${cc}">${flagTile(cc)}<span class="ax_tx"><span class="ax_n">${esc(FLAG_NAME[cc])}</span><span class="ax_p1">도시 ${countryTowns(cc).length}곳${countryHoods(cc).length ? ` · 동네 ${countryHoods(cc).length}곳` : ''}</span></span>${axChev}</button>`;
const sub = i => FLAG_NAME[PLACE[i][3]] || '';

// the sheet's content: nothing typed (the recent towns, the towns visited), the results, or the towns of a kind of map
export function mapResults(p, m, query = '', kind = '') {
    const q = String(query).normalize('NFC').toLowerCase().trim();
    if (kind[0] === '#') { const [cc, g] = kind.slice(1).split('~'); return `${countryView(cc, g === undefined ? -1 : Number(g))}<i class="ax_pad"></i>`; }
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
    const found = findTowns(q), lands = findCountries(q), named = lands.find(c => c.exact);
    // a country named in full: its towns and neighbourhoods first; the rest of what the words find after
    const mine = new Set(named ? countryTowns(named.cc).map(i => PLACE[i][2]) : []), hoodsOf = new Set(named ? countryHoods(named.cc) : []);
    const towns = found.towns.filter(i => !mine.has(PLACE[i][2])), hoods = found.hoods.filter(k => !hoodsOf.has(k)), kinds = found.kinds;
    const others = lands.filter(c => c !== named);
    if (!named && !others.length && !towns.length && !hoods.length) return '<div class="mq_tip">찾는 곳이 표에 없어요</div>';
    const land = named ? countryView(named.cc) : '';
    const landRows = others.length ? `<div class="ax_sec">나라</div><div class="ax_card">${others.map(c => countryRow(c.cc)).join('')}</div>` : '';
    const hoodRow = k => hoodLine(k, q);
    return `${land}${towns.length ? `<div class="ax_sec">${named ? '다른 도시' : '도시'}</div><div class="ax_card">${towns.map(i => townRow(i, q, sub(i))).join('')}</div>` : ''}
      ${landRows}${hoods.length ? `<div class="ax_sec">${named ? '다른 동네' : '동네'}</div><div class="ax_card">${hoods.map(hoodRow).join('')}</div>` : ''}
      <i class="ax_pad"></i>`;
}

// ① ② the search sheet over the map they were last in
export function mapSearchScreen(p, now, m, i = '', query = '') {
    const { groups, kinds } = mapTowns(p, m), g = groups[0], kind = i.startsWith('@') ? i.slice(1) : i.startsWith('#') ? i : '';
    const dark = false, k = g ? kinds.get(g.k || `~${p.owner}`) : 'bigRiver';
    const art = '';   // 그림 지도는 안 써요(11-12): 지도 칸은 타일 지도만
    const full = kind || String(query).trim();
    // no visit yet: the town they live in (a country written as one: its capital), else the last town they looked at
    const own = placeInfo(p).owner, home = own.city, cc = countryOf(home) || String(own.lives || ''), seenI = (p.mapSeen || []).map(townPlace).find(i => i >= 0);
    const land = kind[0] === '#' ? kind.slice(1).split('~')[0] : '';
    if (land) query = FLAG_NAME[land] || '';
    const where = land ? tileAt('', [], [], land) : g ? tileAt(g.city, g.rows.map(r => r.place), g.rows.slice(0, 7).map(r => r.place)) : home || cc ? tileAt(countryOf(home) ? '' : home, [], [], cc) : seenI >= 0 ? tileAt(PLACE[seenI][0]) : '';
    return `<div class="mp_wx mq_wx${dark ? ' mp_dark' : ''}"><div class="mp_bg"${where}>${art}</div>${axBar(p, now, dark && !full ? '#fff' : '#111')}${axTop(axCb(kind ? 'mapq' : 'map'))}
      <div class="mq_sheet${land ? ' mq_cty' : full ? ' mq_full' : ''}"><i class="mp_grab"></i>${TILE_CREDIT}
        ${kind && !land ? `<div class="mq_kh">${icon('mqmap', 16, 'var(--axd)', 2.2)}<b>${esc(kindName(kind))}</b></div>` : `<div class="mq_field">${ax('search', 17, '#8a929d', 2.2)}<div class="mq_in" contenteditable="true" role="searchbox" enterkeyhint="search" spellcheck="false" aria-label="도시 찾기" data-ph="도시 · 동네 찾기 (東京, Berlin, 홍대 …)">${esc(query)}</div><button type="button" class="mq_x${query ? ' on' : ''}" aria-label="지우기">${ax('x', 12, '#fff', 3)}</button></div>`}
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
    const art = '';   // 그림 지도는 안 써요(11-12): 지도 칸은 타일 지도만
    const names = [v.names.lat, v.names.cjk, ...v.names.all.slice(1).filter(n => n !== v.names.lat.toLowerCase() && n !== v.names.cjk && !/^[a-z]/.test(n))].filter(Boolean);
    const nameLine = [...new Set(names)].slice(0, 4).join(' · ');
    const country = `<span class="mq_ct">${flagSvg(v.cc, 22)}<span>${esc(v.country)}${v.hood ? ` · ${esc(v.ko)}` : ''}</span></span>`;
    const seen = g ? `다녀간 곳 ${g.rows.length}` : '';
    const hoodChips = v.hoods.length ? v.hoods.map(h => `<button type="button" class="mq_chip${v.hood?.k === h ? ' on' : ''}" data-go="mapc" data-i="${v.hood?.k === h ? at(place) : at(place, h)}">${esc(HINT[h][3])}</button>`).join('') : '';
    if (v.hood) {
        return `<div class="mp_wx mq_wx mq_one${dark ? ' mp_dark' : ''}"><div class="mp_bg mq_bgfull"${tileAt(PLACE[place][0], [v.hood.label, ...(HINT[v.hood.k]?.[1] || [])], g ? g.rows.slice(0, 6).map(r => r.place) : [])}>${art}</div>${axBar(p, now, dark ? '#fff' : '#111')}${axTop(axCb('mapc', 'back').replace('data-go="mapc"', `data-go="mapc" data-i="${at(place)}"`), mapFindBtn())}
          <div class="mq_hc">${hoodChips}</div>
          <div class="mq_fc">${TILE_CREDIT}${country}
            <div class="mq_tl"><b>${esc(v.hood.label)}</b></div>
            ${seen ? `<span class="mq_nm">${seen}</span>` : ''}
          </div>${axInd(dark ? '#fff' : '#111')}</div>`;
    }
    // the town's neighbourhoods, each its own little map (the tile map draws it; till then, and offline, its drawn map)
    const thumbs = v.hoods.slice(0, 8).map(h => `<button type="button" class="mq_th mq_hth" data-go="mapc" data-i="${at(place, h)}" aria-label="${esc(HINT[h][3])}" data-tt="${esc(JSON.stringify({ city: PLACE[place][0], words: [HINT[h][3], ...HINT[h][1]].slice(0, 10), dark }))}"><i class="mq_tph" aria-hidden="true"></i><span>${esc(HINT[h][3])}</span></button>`).join('');
    return `<div class="mp_wx mq_wx${dark ? ' mp_dark' : ''}"><div class="mp_bg mq_bgcity"${tileAt(PLACE[place][0], g ? g.rows.map(r => r.place) : [], g ? g.rows.slice(0, 6).map(r => r.place) : [])}>${art}</div>${axBar(p, now, dark ? '#fff' : '#111')}${axTop(axCb('mapq'), mapFindBtn())}
      <div class="ax_scroll"><i class="mp_gap mq_gap"></i><div class="mp_sheet"><i class="mp_grab"></i>${TILE_CREDIT}
        <div class="mq_hd">${country}
          <div class="mq_tl"><b>${esc(v.ko)}</b></div>
          ${nameLine ? `<span class="mq_nm">${esc(nameLine)}</span>` : ''}
</div>
        ${g ? `<div class="ax_card"><button type="button" class="ax_rw ax_place" data-go="map" data-i="${esc(g.k)}"><span class="ax_si" style="background: var(--axc)">${ax('pindot', 17, 'var(--axd)', 2.2)}</span><span class="ax_tx"><span class="ax_n">${seen}</span><span class="ax_p1">${esc(g.rows.slice(0, 3).map(r => r.place).join(' · '))}</span></span>${axChev}</button></div>` : ''}
        ${thumbs ? `<div class="ax_sec">주변 동네 · ${Math.min(8, v.hoods.length)}</div><div class="mq_ths">${thumbs}</div>` : ''}
        <i class="ax_pad"></i></div></div>
      ${axInd()}</div>`;
}

// 다녀간 곳 with nothing visited yet (시안 docs/mockups/phone-map/empty): the month strip still on top, empty (what will
// fill it), then one small line for where they live, the search field and the town's neighbourhoods (small)
export function mapEmptyScreen(p, now, m) {
    const own = placeInfo(p).owner, cc = String(own.lives || '').toLowerCase(), i = townPlace(own.city), v = i >= 0 ? placeView(i) : null;
    const k = v ? townCandidates(v.ko)[0] : 'gridLake', dark = false;
    const art = '';   // 그림 지도는 안 써요(11-12): 지도 칸은 타일 지도만
    const nowP = parts(now), mo = nowP?.mo || 1, days = new Date(Date.UTC(Number(p.year) || 2001, mo, 0)).getUTCDate();
    const st = stripSvg({ days, today: nowP?.d || 0, blocks: [] }), c = st.cell;
    const ghost = [[3, 5], [11, 12], [18, 21]].map(([a, b]) => `<rect x="${(a - 1) * c + 1}" y="${st.top + 2}" width="${(b - a + 1) * c - 2}" height="14" rx="5" fill="none" stroke="#c9cfd8" stroke-width="1.2" stroke-dasharray="3 3"/>`).join('');
    const strip = `<div class="ax_card mp_month"><div class="mp_mh"><span class="mp_lbl">${mo}월에 다닌 곳</span><span class="mp_big"><b class="cg_num">0</b><u>곳</u><span>이야기에서 어딘가 가면 여기 쌓여요</span></span></div><div class="mp_st">${st.svg.replace('</svg>', `${ghost}</svg>`)}</div></div>`;
    // then the same town heading as a visited town's: the flag and the town they live in (a city, never the country written as one)
    const name = v ? v.ko : own.city && !countryOf(own.city) ? own.city : '', flag = cc || (i >= 0 ? PLACE[i][3] : '');
    const head = name || flag ? `<div class="mp_th mq_eh">${flag ? flagSvg(flag, 22) : ''}<b>${esc(name || FLAG_NAME[flag] || '')}</b>${name ? '<span>사는 곳</span>' : ''}</div>` : '';
    // then the same list card as a visited town's: two of its neighbourhoods, and last, finding another town (always in sight)
    const hood = h => `<button type="button" class="ax_rw ax_place" data-go="mapc" data-i="${at(i, h)}"><span class="ax_si" style="background: var(--axc)">${ax('pindot', 17, 'var(--axd)', 2.2)}</span><span class="ax_tx"><span class="ax_n">${esc(HINT[h][3])}</span><span class="ax_p1">동네 지도 보기</span></span>${axChev}</button>`;
    const find = mapFindRow();
    const list = `<div class="ax_card">${(v ? v.hoods.slice(0, 2) : []).map(hood).join('')}${find}</div>`;
    return `<div class="mp_wx"><div class="mp_bg"${v ? tileAt(v.ko) : tileAt(countryOf(own.city) ? '' : own.city, [], [], countryOf(own.city) || cc)}>${art}</div>${axBar(p, now)}${axTop(axCb('home'), mapFindBtn())}
      <div class="ax_scroll"><i class="mp_gap"></i><div class="mp_sheet"><i class="mp_grab"></i>${TILE_CREDIT}
        ${strip}${head}${list}<i class="ax_pad"></i></div></div>
      ${axInd()}</div>`;
}
