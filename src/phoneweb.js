// 캐릭터 휴대폰 · 브라우저 (v3.134): the app is ours (round glass buttons, white cards, a glass dock at the bottom),
// the pages in it are the web's — each drawn like its kind of site (news, transit, forum, wiki, shop, blog, official), in the site's own colour.
// A search's results are made the first time it is opened, a page the first time a result is opened (the AI 기능 모델); both are kept.

import { fmtMoney } from './phonemoney.js';
import { AX, ax, axBar, axCb, axDay, axH1, axInd, axKp, axTint, axTop, busyHtml } from './phoneapps.js';
import { fmtDate, fmtTime, koOn, listTime } from './phonedata.js';
import { esc } from './util.js';

Object.assign(AX, {
    warn: 'M12 3l10 18H2zM12 10v5M12 18v.5', up: 'M12 4l7 8h-4v8H9v-8H5z', down: 'M12 20l7-8h-4V4H9v8H5z', cart: 'M3 4h2l2.4 11.2a1 1 0 0 0 1 .8h9.2a1 1 0 0 0 1-.8L20 8H6M9 20h.01M17 20h.01',
    bus: 'M5 17V6a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v11M5 12h14M8 17v2M16 17v2', heart2: 'M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.5-7 10-7 10z', pin: 'M12 21s-6-5.5-6-11a6 6 0 0 1 12 0c0 5.5-6 11-6 11zM12 8v4',
    phone: 'M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2',
});

// ---- the browser's data: tabs are searches still open; bookmarks are the model's "mark" and the user's "marks"
export const tabsOpen = p => p.searches.map((x, i) => [x, i]).filter(([x]) => x.tab && !x.closed);
export const markedPage = (x, r) => (r < 0 ? (x.mark && !x.unmark) || (x.marks || []).includes(-1) : (x.marks || []).includes(r));
export function bookmarks(p) {
    const out = [];
    p.searches.forEach((x, i) => { if (markedPage(x, -1)) out.push({ x, i, r: -1 }); for (const r of x.marks || []) if (r >= 0 && x.results?.[r]) out.push({ x, i, r }); });
    return out;
}
const newest = xs => xs.map((x, k) => [x, k]).sort((a, b) => String(b[0].time).localeCompare(String(a[0].time)));
const host = r => String(r?.url || r?.site || '').replace(/^https?:\/\//, '').split('/')[0];
// a site's colour (the model's, else one from its name) and the ink that reads on it
const colorOf = r => r?.color || axTint(r?.site || r?.url || '?');
const inkOn = hex => { const n = parseInt(String(hex).slice(1), 16); if (!Number.isFinite(n)) return '#fff'; const L = (0.299 * (n >> 16 & 255) + 0.587 * (n >> 8 & 255) + 0.114 * (n & 255)) / 255; return L > 0.62 ? '#161b22' : '#fff'; };
const letter = t => esc([...String(t || '?').trim()][0]?.toUpperCase() || '?');
const fav = (r, z = 28, rad = 9) => `<span class="wb_fv" style="width: ${z}px; height: ${z}px; border-radius: ${rad}px; background: ${colorOf(r)}; color: ${inkOn(colorOf(r))}">${letter(r?.site || r?.url)}</span>`;
const k1 = (k, cls = 'wb_k') => (k && koOn() ? `<span class="${cls}">${esc(k)}</span>` : '');
// a photo on a page: flat layered shapes in one of a few muted sets, picked by what it shows
const ART = [['#8a9ba3', '#6f828b', '#5c6d74', '#c5ced2'], ['#a8bcae', '#8ea594', '#76907e', '#d5ddd6'], ['#c9b49a', '#b39b7f', '#8f7a62', '#e9dccb'], ['#b9a3a8', '#a08890', '#86707a', '#e6d8dc']];
const art = (seed, h, extra = '') => {
    const c = ART[[...String(seed || '')].reduce((n, ch) => (n * 31 + ch.codePointAt(0)) % 9973, 7) % ART.length];
    return `<div class="wb_art ${extra}" style="height: ${h}px; background: ${c[0]}"><i style="width: 145%; height: ${h * 1.3}px; left: -22%; top: 52%; background: ${c[1]}"></i><i style="width: 110%; height: ${h * 0.95}px; left: 18%; top: 66%; background: ${c[2]}"></i><i class="o" style="width: ${h * 0.32}px; height: ${h * 0.32}px; right: 12%; top: 13%; background: ${c[3]}"></i></div>`;
};

// ---- the dock: back · forward · address (with its bookmark star) · 가 · tabs; on the start screens: 홈 · 북마크 · 기록
function dock(p, { back, addr, mark = null, ko = true }) {
    const n = tabsOpen(p).length;
    return `<div class="wb_dock">
      <button type="button" class="wb_db" data-go="${back}" aria-label="뒤로">${ax('back', 21, 'currentColor', 2.3)}</button>
      <span class="wb_db off">${ax('chev', 21, 'currentColor', 2.3)}</span>
      <span class="wb_ad">${addr}${mark ? `<button type="button" class="na_ph_bmark wb_star ${mark.on ? 'on' : ''}" data-i="${mark.i}" data-r="${mark.r}" aria-label="북마크">${ax('star', 15, 'currentColor', 2, mark.on ? 'currentColor' : 'none')}</button>` : ''}</span>
      ${ko ? `<button type="button" class="na_ph_kochip wb_ko ${koOn() ? 'on' : ''}" aria-label="한국어">가</button>` : ''}
      <button type="button" class="wb_db" data-go="tabs" aria-label="탭"><span class="wb_tn cg_num">${n}</span></button>
    </div>`;
}
const homeDock = on => `<div class="wb_dock wb_lab">${[['search', 'home', '홈'], ['marks', 'save', '북마크'], ['history', 'clock', '기록']].map(([go, icon, t]) => `<button type="button" class="${go === on ? 'on' : ''}" data-go="${go}">${ax(icon, 17, 'currentColor', 2.1)}${t}</button>`).join('')}</div>`;

// ---- 검색 홈
const WORD = { DE: 'suche', AT: 'suche', CH: 'suche', FR: 'recherche', ES: 'buscar', IT: 'cerca', KR: '검색', JP: '検索', CN: '搜索', TW: '搜尋', RU: 'поиск', BR: 'busca' };
const wordmark = p => { const w = [...(WORD[p.country] || 'search')]; return `${esc(w.slice(0, -1).join(''))}<span>${esc(w.at(-1))}</span>`; };
// 최근 검색 · 방문 기록's ×: that search goes, with its pages
const rqX = k => `<button type="button" class="na_ph_rm wb_rqx" data-kind="search" data-i="${k}" aria-label="검색 기록 지우기">${ax('x', 15, 'currentColor', 2.4)}</button>`;
export function searchScreen(p, now) {
    const ss = newest(p.searches).slice(0, 6), ts = tabsOpen(p), bm = bookmarks(p).slice(0, 6);
    return `${axBar(p, now)}
      ${axTop(axCb('home'), axKp(p))}
      <div class="ax_scroll">
        <div class="wb_logo">${wordmark(p)}</div>
        <div class="wb_bigq">${ax('search', 19, '#2a313b', 2.3)}<span>검색어 또는 주소</span>${ax('mic', 18, '#8a929d', 2.1)}</div>
        ${ss.length ? `<div class="wb_sec"><span>최근 검색</span><button type="button" data-go="history">모두 보기</button></div><div class="wb_card">${ss.map(([x, k]) => `
          <div class="wb_rqw"><button type="button" class="wb_rq" data-go="searchone" data-i="${k}"><span class="wb_ci">${ax('clock', 15, 'currentColor', 2.3)}</span><span class="wb_tx"><b>${esc(x.q)}${x.tab && !x.closed ? '<em>열림</em>' : ''}</b>${k1(x.ko)}</span><small class="cg_num">${esc(listTime(p, x.time))}</small></button>${rqX(k)}</div>`).join('')}</div>`
            : '<div class="wb_none">검색 기록이 없어요</div>'}
        ${ts.length ? `<div class="wb_sec"><span>열린 탭 ${ts.length}</span><button type="button" data-go="tabs">모두 보기</button></div>
          <div class="wb_strip">${ts.map(([x, i]) => `<div class="wb_tmini" role="button" tabindex="0" ${tabGo(x, i)}><div class="wb_th">${thumb(p, x, i)}</div><span class="wb_tt">${tabFav(x)}${esc(tabTitle(x))}</span></div>`).join('')}</div>` : ''}
        ${bm.length ? `<div class="wb_sec"><span>북마크</span></div><div class="wb_chips">${bm.map(b => { const r = b.r >= 0 ? b.x.results[b.r] : b.x.results?.[0]; return `<button type="button" class="wb_chip" data-go="${b.r >= 0 ? 'page' : 'searchone'}" data-i="${b.r >= 0 ? `${b.i}.${b.r}` : b.i}">${b.r >= 0 ? fav(r, 22, 7) : `<span class="wb_ci s">${ax('search', 12, 'currentColor', 2.6)}</span>`}${esc(b.r >= 0 ? r.site || host(r) : b.x.q)}</button>`; }).join('')}</div>` : ''}
        <i class="wb_pad"></i>
      </div>
      ${homeDock('search')}
      ${axInd()}`;
}

// ---- 검색 결과
const bolded = (t, words) => {
    let s = esc(t);
    for (const w of words || []) if (w.length > 1) s = s.replace(new RegExp(esc(w).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), m => `<em>${m}</em>`);
    return s;
};
function resultsBody(p, x, k, busy) {
    const an = x.answer;
    return `<div class="wb_qbar">${ax('search', 18, '#2a313b', 2.3)}<span>${esc(x.q)}</span><button type="button" data-go="search" aria-label="지우기">${ax('x', 17, '#8a929d', 2.4)}</button></div>
        <div class="wb_stabs"><span class="on">전체</span><span>뉴스</span><span>이미지</span><span>지도</span></div>
        <div class="wb_meta"><span class="cg_num">${esc(fmtDate(p, x.time, true))} ${esc(fmtTime(p, x.time))}</span>에 검색함${x.ko && koOn() ? ` · ${esc(x.ko)}` : ''}</div>
        ${x.results?.length ? `
        ${an ? `<div class="wb_ans"><div class="wb_al">${ax('search', 13, 'currentColor', 2.6)}${esc(an.label)}</div><div class="wb_big">${esc(an.text)}${k1(an.ko)}</div>
          ${an.steps?.length ? `<div class="wb_tl">${an.steps.map(t => `<div class="${t.off ? 'x' : ''}"><b class="cg_num">${esc(t.time || '—')}</b>${esc(t.place)}</div>`).join('')}</div>` : ''}
          ${an.site ? `<div class="wb_src">${fav({ site: an.site, color: x.results.find(r => r.site === an.site)?.color }, 18, 5)}${esc(an.site)}</div>` : ''}</div>` : ''}
        ${x.results.map((r, j) => `
        <button type="button" class="wb_res" data-go="page" data-i="${k}.${j}">
          <span class="wb_site">${fav(r, 28, 14)}<span><b>${esc(r.site || host(r))}</b><small>${esc(r.path || r.url || '')}</small></span></span>
          <span class="wb_rt">${esc(r.title)}</span>${k1(r.kt)}
          ${r.text ? `<span class="wb_rp">${r.date ? `<span class="wb_dt">${esc(fmtDate(p, r.date, true))} — </span>` : ''}${bolded(r.text, r.bold)}</span>` : ''}${k1(r.ko)}
          ${r.links?.length ? `<span class="wb_sl">${r.links.map(l => `<span>${esc(l)}</span>`).join('')}</span>` : ''}
        </button>`).join('')}
        ${x.news?.length ? `<div class="wb_sec"><span>주요 뉴스</span></div><div class="wb_news">${x.news.map(n => `<div class="wb_nc">${art(n.title, 96)}<span class="wb_nt"><span class="wb_ns"><i style="background: ${colorOf(n)}"></i>${esc(n.site)}</span><b>${esc(n.title)}</b>${k1(n.kt)}<small>${esc(n.ago)}</small></span></div>`).join('')}</div>` : ''}
        ${x.questions?.length ? `<div class="wb_sec"><span>함께 찾은 질문</span></div><div class="wb_card">${x.questions.map(q => `<div class="wb_qq">${esc(q.q)}${k1(q.ko)}</div>`).join('')}</div>` : ''}
        ${x.related?.length ? `<div class="wb_sec"><span>관련 검색어</span></div><div class="wb_rel">${x.related.map(w => `<span>${ax('search', 13, 'currentColor', 2.6)}${esc(w)}</span>`).join('')}</div>` : ''}`
        : busy ? `<div class="wb_wait">${busyHtml} 검색 결과 불러오는 중</div>` : '<div class="wb_wait"><button type="button" class="wb_go na_ph_sgo">결과 불러오기</button></div>'}`;
}
export function searchOne(p, now, k, busy) {
    const x = p.searches[k];
    if (!x) return searchScreen(p, now);
    return `${axBar(p, now)}
      ${axTop(axCb('search'), axKp(p))}
      <div class="ax_scroll">${resultsBody(p, x, k, busy)}<i class="wb_pad"></i></div>
      ${dock(p, { back: 'search', addr: `${ax('search', 14, '#6b7380', 2.6)}<span>${esc(x.q)}</span>`, mark: { i: k, r: -1, on: markedPage(x, -1) }, ko: false })}
      ${axInd()}`;
}

// ---- a page, drawn like its kind of site
const para = (b, i, cls = '') => `<p class="${cls}${i === 0 ? ' first' : ''}">${esc(b.text)}${k1(b.ko)}</p>`;
const navRow = (pg, cls) => (pg.nav?.length ? `<div class="${cls}">${pg.nav.map((n, i) => `<span class="${i ? '' : 'on'}">${esc(n)}</span>`).join('')}</div>` : '');
const KIND_DRAW = {
    news(p, r, pg, c) {
        const o = pg.news || {}, name = String(r.site || host(r)).trim().split(/\s+/), last = name.pop();
        return `<div class="wb_nwtop">${ax('menu', 22, '#141414', 2)}<b class="wb_nwlogo">${esc(name.join(' '))} <span style="color: ${c}">${esc(last)}</span></b><span class="wb_abo" style="background: ${c}; color: ${inkOn(c)}">Abo</span></div>
          ${navRow(pg, 'wb_nwnav')}
          ${o.ticker ? `<div class="wb_tick"><b style="background: ${c}">LIVE</b><span>${esc(o.ticker)}</span></div>` : ''}
          <div class="wb_nwb">
            <div class="wb_crumb"><b style="color: ${c}">${esc(o.section || pg.nav?.[0] || '')}</b>${o.minutes ? `<span>· ${esc(o.minutes)} Min.</span>` : ''}</div>
            <h1>${esc(pg.title)}${k1(pg.kt)}</h1>
            ${pg.lede ? `<p class="wb_lede">${esc(pg.lede.text)}${k1(pg.lede.ko)}</p>` : ''}
            ${o.author || o.date ? `<div class="wb_by"><i></i><span><b>${esc(o.author)}</b>${o.date ? `<span class="cg_num">${esc(fmtDate(p, o.date))} ${esc(String(o.date).slice(6))}</span>` : ''}</span><span class="wb_bysh">${ax('share', 15, '#555', 2)}</span></div>` : ''}
            ${o.photo ? `${art(o.photo, 220, 'wb_bleed')}<div class="wb_cap">${esc(o.photo)}${o.credit ? ` · ${esc(o.credit)}` : ''}</div>` : ''}
            ${pg.body.map((b, i) => `${para(b, i, 'wb_t')}${i === 0 && o.quote ? `<div class="wb_pq" style="border-color: ${c}">„${esc(o.quote.text)}“${k1(o.quote.ko)}<small>— ${esc(o.quote.who)}</small></div>` : ''}`).join('')}
          </div>`;
    },
    transit(p, r, pg, c) {
        const o = pg.transit || {}, ink = inkOn(c);
        return `<div class="wb_trtop" style="background: ${c}; color: ${ink}"><div class="wb_trrow"><b><i style="color: ${c}">${letter(r.site)}</i>${esc(r.site || host(r))}</b>${ax('menu', 22, ink, 2)}</div>${navRow(pg, 'wb_trtabs')}</div>
          ${o.alert ? `<div class="wb_alert"><b>${ax('warn', 16, '#b07a00', 2.4)}${esc(o.alert.title)}</b>${esc(o.alert.text)}${k1(o.alert.ko)}</div>` : ''}
          <div class="wb_trh"><h1>${esc(pg.title)}${k1(pg.kt)}</h1></div>
          ${o.departures?.length ? `<div class="wb_trsec"><span>${esc(o.stop || '')}</span></div><div class="wb_dep">${o.departures.map(d => `<div class="wb_dr ${d.off ? 'x' : ''}"><span class="wb_ln cg_num" style="background: ${c}; color: ${ink}">${esc(d.line)}</span><span class="wb_to"><b>${esc(d.to)}</b><small>${esc(d.note)}</small></span><span class="wb_tm cg_num">${esc(d.time)}${d.off ? '' : d.delay ? `<small>+${d.delay}</small>` : '<small class="ok">✓</small>'}</span></div>`).join('')}</div>` : ''}
          ${o.route?.length ? `<div class="wb_route">${o.route.map(s => `<div class="wb_stop ${s.off ? 'x' : ''}" style="--c: ${c}"><i></i><span>${esc(s.stop)}</span><small class="cg_num">${esc(s.time)}</small></div>`).join('')}</div>` : ''}
          <div class="wb_plain">${pg.body.map((b, i) => para(b, i)).join('')}</div>`;
    },
    forum(p, r, pg, c) {
        const o = pg.forum || {};
        return `<div class="wb_fohd"><div class="wb_fotop"><b style="color: ${c}"><i style="background: ${c}; color: ${inkOn(c)}">${letter(r.site)}</i>${esc(r.site || host(r))}</b>${ax('search', 20, '#1a1a1b', 2)}</div>
            <div class="wb_band" style="background: ${c}"><i></i><i></i></div>
            <div class="wb_board"><span class="wb_bic" style="background: ${c}; color: ${inkOn(c)}">${letter(o.board || r.site)}</span><span><b>${esc(o.board || r.site)}</b>${o.members ? `<small class="cg_num">${esc(o.members)}${o.online ? ` · ${esc(o.online)} online` : ''}</small>` : ''}</span><em>Join</em></div></div>
          <div class="wb_post"><div class="wb_pm"><i style="background: ${axTint(o.author)}"></i><b>${esc(o.author)}</b>${o.ago ? `· ${esc(o.ago)}` : ''}</div>
            <h1>${esc(pg.title)}${k1(pg.kt)}</h1>${o.flair ? `<span class="wb_flair" style="color: ${c}">${esc(o.flair)}</span>` : ''}
            ${pg.body.map((b, i) => para(b, i)).join('')}
            <div class="wb_acts"><span class="up" style="color: ${c}">${ax('up', 14, 'currentColor', 2.4)}${esc(o.votes || '')}${ax('down', 14, '#787c7e', 2.4)}</span><span>${ax('cmt', 14, 'currentColor', 2.2)}${o.comments?.length || 0}</span><span>${ax('share', 14, 'currentColor', 2.2)}</span></div></div>
          ${o.comments?.length ? `<div class="wb_cmts">${o.comments.map(m => `<div class="wb_cm ${m.reply ? 'r' : ''}"><div class="wb_pm"><i style="background: ${axTint(m.who)}"></i><b>${esc(m.who)}</b>${m.op ? `<span class="wb_op" style="color: ${c}">OP</span>` : ''}${m.ago ? `· ${esc(m.ago)}` : ''}</div><p>${esc(m.text)}${k1(m.ko)}</p><div class="wb_cma">▲ ${esc(m.votes || '')} ▼</div></div>`).join('')}</div>` : ''}`;
    },
    wiki(p, r, pg) {
        const o = pg.wiki || {};
        return `<div class="wb_wktop">${ax('menu', 22, '#202122', 2)}<span class="wb_wkg">W</span><b>${esc(String(r.site || 'Wiki').toUpperCase())}</b>${ax('search', 20, '#202122', 2)}</div>
          <div class="wb_wkb"><h1>${esc(pg.title)}</h1>${k1(pg.kt)}
            <div class="wb_wkbar"><span class="on">${esc(pg.nav?.[0] || 'Artikel')}</span><span>${esc(pg.nav?.[1] || 'Diskussion')}</span>${o.langs ? `<span class="wb_lang">文A ${o.langs}</span>` : ''}</div>
            ${o.note ? `<div class="wb_hat">${esc(o.note)}</div>` : ''}
            ${o.facts?.length || o.photo ? `<div class="wb_ibox"><div class="wb_ih">${esc(pg.title)}</div>${o.photo ? `${art(o.photo, 120)}<div class="wb_ic">${esc(o.photo)}</div>` : ''}${o.facts?.length ? `<table>${o.facts.map(f => `<tr><td>${esc(f.k)}</td><td>${esc(f.v)}</td></tr>`).join('')}</table>` : ''}</div>` : ''}
            ${pg.body.map((b, i) => para(b, i)).join('')}
            ${(o.sections || []).map(v => `<h2>${esc(v.h)}</h2><p>${esc(v.text)}${k1(v.ko)}</p>`).join('')}
          </div>`;
    },
    shop(p, r, pg, c) {
        const o = pg.shop || {}, ink = inkOn(c), cur = o.currency || p.money?.currency || 'EUR', money = n => fmtMoney({ ...p, money: { currency: cur } }, n);
        const off = o.old && o.price && o.old > o.price ? Math.round((1 - o.price / o.old) * 100) : 0;
        return `<div class="wb_sptop" style="background: ${c}; color: ${ink}"><b>${esc(r.site || host(r))}</b><span class="wb_spq">${ax('search', 13, '#8a929d', 2.6)}</span>${ax('cart', 21, ink, 2)}</div>
          ${o.crumbs?.length ? `<div class="wb_spcr">${o.crumbs.map(esc).join(' › ')}</div>` : ''}
          ${art(pg.title, 240, 'wb_spimg')}<div class="wb_dots"><i class="on" style="background: ${c}"></i><i></i><i></i><i></i></div>
          <div class="wb_spb">${o.brand ? `<div class="wb_brand" style="color: ${c}">${esc(o.brand)}</div>` : ''}<h1>${esc(pg.title)}${k1(pg.kt)}</h1>
            ${o.rating ? `<div class="wb_stars"><b>${'★'.repeat(Math.round(o.rating))}${'☆'.repeat(5 - Math.round(o.rating))}</b><span class="cg_num">${String(o.rating).replace('.', ',')}${o.reviews ? ` · ${esc(o.reviews)}` : ''}</span></div>` : ''}
            ${o.price !== null && o.price !== undefined ? `<div class="wb_price"><b class="cg_num">${esc(money(o.price))}</b>${off ? `<s class="cg_num">${esc(money(o.old))}</s><em>−${off}%</em>` : ''}</div>` : ''}
            ${o.colors?.length ? `<div class="wb_opt">${o.colors.map((h, i) => `<span class="${i ? '' : 'on'}" style="--c: ${c}"><i style="background: ${h}"></i></span>`).join('')}</div>` : ''}
            ${o.ship ? `<div class="wb_ship">${esc(o.ship)}</div>` : ''}
            <div class="wb_cta"><span style="color: ${c}">♡</span><span class="a" style="background: ${c}; color: ${ink}">${ax('cart', 20, ink, 2.2)}</span></div>
            ${pg.body.map((b, i) => para(b, i)).join('')}</div>`;
    },
    blog(p, r, pg, c) {
        const o = pg.blog || {};
        return `<div class="wb_bltop"><b>${esc(o.blog || r.site || host(r))}</b>${ax('menu', 22, '#2b2622', 2)}</div>
          ${o.photo ? art(o.photo, 200, 'wb_blimg') : ''}
          <div class="wb_blb">${o.category ? `<div class="wb_blcat" style="color: ${c}">${esc(o.category)}</div>` : ''}<h1>${esc(pg.title)}${k1(pg.kt)}</h1>
            ${o.author ? `<div class="wb_blby"><i style="background: ${axTint(o.author)}"></i><span><b>${esc(o.author)}</b>${esc([o.date, o.minutes ? `${o.minutes} Min.` : ''].filter(Boolean).join(' · '))}</span></div>` : ''}
            ${pg.body.map((b, i) => para(b, i)).join('')}
            ${o.tags?.length ? `<div class="wb_tags">${o.tags.map(t => `<span style="color: ${c}">#${esc(String(t).replace(/^#/, ''))}</span>`).join('')}</div>` : ''}</div>`;
    },
    official(p, r, pg, c) {
        const o = pg.official || {}, ink = inkOn(c);
        return `<div class="wb_oftop" style="background: ${c}; color: ${ink}"><b><i style="color: ${c}">${letter(r.site)}</i>${esc(r.site || host(r))}</b>${ax('menu', 22, ink, 2)}</div>${navRow(pg, 'wb_ofnav')}
          <div class="wb_plain"><h1>${esc(pg.title)}${k1(pg.kt)}</h1>${pg.lede ? `<p class="wb_lede">${esc(pg.lede.text)}${k1(pg.lede.ko)}</p>` : ''}
            ${o.hours?.length || o.address || o.phone ? `<div class="wb_ofc">${o.hours?.length ? `<div class="wb_ofh">${ax('clock', 16, c, 2.2)}<table>${o.hours.map(h => `<tr><td>${esc(h.day)}</td><td class="cg_num">${esc(h.time)}</td></tr>`).join('')}</table></div>` : ''}${o.address ? `<div class="wb_ofl">${ax('pin', 16, c, 2.2)}${esc(o.address)}</div>` : ''}${o.phone ? `<div class="wb_ofl">${ax('phone', 16, c, 2.2)}<span class="cg_num">${esc(o.phone)}</span></div>` : ''}</div>` : ''}
            ${pg.body.map((b, i) => para(b, i)).join('')}</div>`;
    },
    other(p, r, pg, c) {
        return `<div class="wb_ottop" style="border-color: ${c}"><b style="color: ${c}">${esc(r.site || host(r))}</b>${ax('menu', 22, '#2a313b', 2)}</div>${navRow(pg, 'wb_ofnav')}
          <div class="wb_plain"><h1>${esc(pg.title)}${k1(pg.kt)}</h1>${pg.lede ? `<p class="wb_lede">${esc(pg.lede.text)}${k1(pg.lede.ko)}</p>` : ''}${pg.body.map((b, i) => para(b, i)).join('')}</div>`;
    },
};
const KIND_BAR = { transit: 1, shop: 1, official: 1 }; // pages whose header is the site's colour run it up under the clock
function pageBody(p, x, k, r, busy) {
    const res = x.results[r], kind = KIND_DRAW[res.kind] ? res.kind : 'other', c = colorOf(res);
    if (res.page) return `<div class="wb_web wbk_${kind}">${KIND_DRAW[kind](p, res, res.page, c)}</div>`;
    // not written yet: the site's header, and the snippet until the page comes
    const pg = { nav: [], title: res.title, kt: res.kt, lede: null, body: res.text ? [{ text: res.text, ko: res.ko }] : [] };
    return `<div class="wb_web wbk_${kind}">${KIND_DRAW[kind](p, res, pg, c)}
      <div class="wb_wait">${busy ? `${busyHtml} 페이지 여는 중` : '<button type="button" class="wb_go na_ph_pgo">페이지 열기</button>'}</div></div>`;
}
export function pageView(p, now, key, busy) {
    const [k, r] = String(key).split('.').map(Number), x = p.searches[k], res = x?.results?.[r];
    if (!res) return searchOne(p, now, k, false);
    const c = colorOf(res), colored = !!KIND_BAR[res.kind];
    return `<div class="wb_sbar" style="${colored ? `background: ${c}` : ''}">${axBar(p, now, colored ? inkOn(c) : '#111')}</div>
      <div class="ax_scroll wb_pg">${pageBody(p, x, k, r, busy)}<i class="wb_pad"></i></div>
      ${dock(p, { back: `searchone:${k}`, addr: `${ax('lock', 12, '#2a313b', 2.4)}<span>${esc(host(res))}</span>`, mark: { i: k, r, on: markedPage(x, r) } })}
      ${axInd()}`;
}

// ---- 탭: each open search, as its page in miniature (the page last read in it, else its results)
const tabTitle = x => (x.at >= 0 && x.results?.[x.at] ? x.results[x.at].title : x.q);
const tabFav = x => (x.at >= 0 && x.results?.[x.at] ? fav(x.results[x.at], 15, 4) : `<span class="wb_ci s">${ax('search', 9, 'currentColor', 3)}</span>`);
const tabGo = (x, i) => (x.at >= 0 && x.results?.[x.at] ? `data-go="page" data-i="${i}.${x.at}"` : `data-go="searchone" data-i="${i}"`);
function thumb(p, x, i) {
    const body = x.at >= 0 && x.results?.[x.at] ? pageBody(p, x, i, x.at, false) : `<div class="wb_thr">${resultsBody(p, x, i, false)}</div>`;
    return `<div class="wb_mini" inert>${body}</div>`;
}
export function tabsScreen(p, now) {
    const ts = tabsOpen(p);
    return `${axBar(p, now)}
      ${axTop(axCb('search'), '<button type="button" class="wb_new" data-go="search">새 탭</button>')}
      <div class="ax_scroll">
        ${axH1('탭', ts.length ? `${ts.length}개` : '')}
        ${ts.length ? `<div class="wb_tg">${ts.map(([x, i]) => `
          <div class="wb_tc"><button type="button" class="na_ph_tabx wb_tx2" data-i="${i}" aria-label="탭 닫기">${ax('x', 11, '#2a313b', 3)}</button>
            <div class="wb_tcb" role="button" tabindex="0" ${tabGo(x, i)}><div class="wb_th">${thumb(p, x, i)}</div><span class="wb_tt">${tabFav(x)}${esc(tabTitle(x))}</span></div></div>`).join('')}</div>`
            : '<div class="wb_none">열린 탭이 없어요</div>'}
        <i class="wb_pad"></i>
      </div>
      ${axInd()}`;
}

// ---- 북마크 · 방문 기록 (the history: each search, and the pages opened from it)
export function marksScreen(p, now, hist) {
    const bm = bookmarks(p), ss = newest(p.searches);
    const days = [...new Set(ss.map(([x]) => String(x.time).slice(0, 5)))];
    const row = (go, i, icon, title, sub, time = '') => `<button type="button" class="wb_rw" data-go="${go}" data-i="${i}">${icon}<span class="wb_tx"><b>${esc(title)}</b><small>${esc(sub)}</small></span>${time ? `<small class="cg_num">${esc(time)}</small>` : ax('chev', 15, '#b7bdc6', 2.4)}</button>`;
    const sIc = `<span class="wb_ci">${ax('search', 14, 'currentColor', 2.5)}</span>`;
    return `${axBar(p, now)}
      ${axTop(axCb('search'), axKp(p))}
      <div class="ax_scroll">
        ${axH1(hist ? '방문 기록' : '북마크')}
        <div class="wb_seg"><button type="button" class="${hist ? '' : 'on'}" data-go="marks">북마크</button><button type="button" class="${hist ? 'on' : ''}" data-go="history">방문 기록</button></div>
        ${hist ? (days.length ? days.map(d => `<div class="wb_sec"><span>${esc(axDay(p, now, d))}</span></div><div class="wb_card">${ss.filter(([x]) => String(x.time).slice(0, 5) === d).map(([x, i]) => [
            ...(x.seen || []).filter(r => x.results?.[r]).reverse().map(r => row('page', `${i}.${r}`, fav(x.results[r], 30, 9), x.results[r].title, host(x.results[r]))),
            `<div class="wb_rqw">${row('searchone', i, sIc, x.q, '검색', fmtTime(p, x.time))}${rqX(i)}</div>`].join('')).join('')}</div>`).join('') : '<div class="wb_none">방문 기록이 없어요</div>')
            : (bm.length ? `<div class="wb_card">${bm.map(b => b.r >= 0 ? row('page', `${b.i}.${b.r}`, fav(b.x.results[b.r], 30, 9), b.x.results[b.r].title, host(b.x.results[b.r])) : row('searchone', b.i, sIc, b.x.q, '검색 결과')).join('')}</div>` : '<div class="wb_none">북마크가 없어요<br><small>페이지에서 주소 옆 별을 누르면 여기 모여요</small></div>')}
        <i class="wb_pad"></i>
      </div>
      ${homeDock(hist ? 'history' : 'marks')}
      ${axInd()}`;
}
