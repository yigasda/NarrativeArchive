// 투자 (kurs.): a broker app of its own — a light page, the portfolio's line on top, holdings with sparklines,
// a stock page with a big chart. The figures all come from finance.js; nothing here is guessed.
import { AX, ax, axBar, axInd, axTint } from './phoneapps.js';
import { fmtIn } from './phonemoney.js';
import { esc } from './util.js';
import { baseCosts, cash, finance, finite, fx, positions, price, total } from './finance.js';
import { investmentDate } from './investdata.js';

Object.assign(AX, { chart: 'M3 20h18M5 16l5-6 4 3 6-9M15 4h5v5' });

// up and down the way the owner's phone shows them: red up, blue down in Korea, Japan, China, Taiwan; green up, red down elsewhere
const UPRED = new Set(['KR', 'JP', 'CN', 'TW']);
const tone = (p, n) => (!finite(n) || Math.abs(n) < 1e-9 ? 'iv_flat' : n > 0 ? 'iv_up' : 'iv_dn');
const money = (p, n, c, signed = false) => (finite(n) ? esc(fmtIn(p, n, c, signed)) : '—');
const pct = n => (finite(n) ? `${n > 0 ? '+' : ''}${n.toFixed(2)}%` : '—');
const arrow = n => (finite(n) && Math.abs(n) > 1e-9 ? (n > 0 ? '▲' : '▼') : '');
const KIND = { buy: '매수', sell: '매도', dividend: '배당' };
const RANGES = [['1w', '1주', 7], ['1m', '1개월', 31], ['3m', '3개월', 92], ['all', '전체', 1e5]];
const dayMs = 864e5;
const daysBack = (date, n) => new Date(Date.parse(date) - n * dayMs).toISOString().slice(0, 10);
const shortDay = d => `${Number(d.slice(8))}.${Number(d.slice(5, 7))}.`;
// a ticker's tile: two letters on a colour of its own
const logo = (s, z = 40) => { const code = String((s?.symbol || '').split(':').pop() || s?.name || '?').replace(/[^A-Za-z0-9가-힣]/g, '').slice(0, 4).toUpperCase() || '?'; return `<span class="iv_logo" style="width: ${z}px; height: ${z}px; background: ${axTint(code)}; font-size: ${Math.round(z * (code.length > 3 ? 0.24 : code.length > 2 ? 0.28 : 0.34))}px">${esc(code)}</span>`; };

// ---- charts
function line(vals, w, h, pad = 4) {
    if (vals.length < 2) return null;
    const min = Math.min(...vals), max = Math.max(...vals), span = max - min || Math.abs(max) || 1;
    const pts = vals.map((v, i) => [pad + i * (w - pad * 2) / (vals.length - 1), pad + (1 - (v - min) / span) * (h - pad * 2)]);
    return { pts, min, max, d: pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ') };
}
// 종목 차트: a candle a day like a real broker's — open is the day before's close, the wick spans every price saved
// that day (one price a day leaves no wick: nothing is made up); the 20-day average; the scale on the right
function candles(m, p, sym, date, from, cur) {
    const book = finance(m).prices[`STOCK:${sym}`] || {}, all = Object.keys(book).filter(d => d <= date).sort();
    const close = d => price(m, `STOCK:${sym}`, d)?.value;
    const rows = all.map((d, i) => { const c = close(d), o = i ? close(all[i - 1]) : c, vs = [o, c, ...(book[d].rows || []).map(r => r.value)].filter(finite); return { d, o, c, h: Math.max(...vs), l: Math.min(...vs), i }; }).filter(x => finite(x.c));
    const ma = (n, i) => (i + 1 >= n ? rows.slice(i + 1 - n, i + 1).reduce((a, x) => a + x.c, 0) / n : null);
    const show = rows.filter(x => x.d >= from);
    if (show.length < 2) return `<div class="iv_chart iv_nochart">${show.length ? '가격 기록이 하루뿐이라 차트를 그릴 수 없어요' : '가격 기록이 아직 없어요'}</div>`;
    const W = 358, H = 236, R = 50, T = 26, B = 22, pw = W - R - 8, ph = H - T - B;
    const hi = Math.max(...show.map(x => x.h)), lo = Math.min(...show.map(x => x.l)), padv = (hi - lo || hi * 0.02 || 1) * 0.12;
    const top = hi + padv, bot = lo - padv, y = v => T + (top - v) / (top - bot) * ph;
    const step = pw / show.length, cw = Math.max(2, Math.min(12, step * 0.62)), x = k => 8 + step * (k + 0.5);
    const up = UPRED.has(p.country) ? '#e5484d' : '#12a26b', dn = UPRED.has(p.country) ? '#3b6fe0' : '#e5484d';
    const nice = v => (Math.abs(v) >= 1000 ? v.toLocaleString('en-US', { maximumFractionDigits: 0 }) : v.toFixed(2));
    const grid = Array.from({ length: 5 }, (_, k) => bot + (top - bot) * k / 4).map(v => `<line x1="8" x2="${8 + pw}" y1="${y(v).toFixed(1)}" y2="${y(v).toFixed(1)}" class="iv_gl"/><text x="${W - 4}" y="${(y(v) + 3.5).toFixed(1)}" class="iv_yl" text-anchor="end">${nice(v)}</text>`).join('');
    const bars = show.map((r, k) => { const col = r.c >= r.o ? up : dn, yo = y(r.o), yc = y(r.c), bt = Math.min(yo, yc), bh = Math.max(1.2, Math.abs(yc - yo)); return `<line x1="${x(k).toFixed(1)}" x2="${x(k).toFixed(1)}" y1="${y(r.h).toFixed(1)}" y2="${y(r.l).toFixed(1)}" stroke="${col}" stroke-width="1"/><rect x="${(x(k) - cw / 2).toFixed(1)}" y="${bt.toFixed(1)}" width="${cw.toFixed(1)}" height="${bh.toFixed(1)}" fill="${col}" rx="${cw > 6 ? 1.2 : 0.6}"/>`; }).join('');
    const maLine = (n, col) => { const pts = show.map((r, k) => [x(k), ma(n, r.i)]).filter(([, v]) => v !== null); return pts.length > 1 ? `<path d="${pts.map(([px, v], j) => `${j ? 'L' : 'M'}${px.toFixed(1)} ${y(v).toFixed(1)}`).join(' ')}" fill="none" stroke="${col}" stroke-width="1.3" stroke-linejoin="round"/>` : ''; };
    const last = show[show.length - 1], ih = show.reduce((a, r, k) => (r.h > show[a].h ? k : a), 0), il = show.reduce((a, r, k) => (r.l < show[a].l ? k : a), 0);
    const mark = (k, v, below) => { const right = x(k) < pw * 0.55, tx = right ? x(k) + 8 : x(k) - 8, ty = below ? y(v) + 13 : y(v) - 6, chg = (last.c / v - 1) * 100; return `<text x="${tx.toFixed(1)}" y="${ty.toFixed(1)}" class="iv_mk ${below ? 'lo' : 'hi'}" text-anchor="${right ? 'start' : 'end'}">${right ? '← ' : ''}${nice(v)} (${chg > 0 ? '+' : ''}${chg.toFixed(2)}%, ${shortDay(show[k].d)})${right ? '' : ' →'}</text>`; };
    const ly = y(last.c), tagCol = last.c >= last.o ? up : dn;
    const dates = [0, Math.floor((show.length - 1) / 2), show.length - 1].filter((v, i, a) => a.indexOf(v) === i).map(k => `<text x="${x(k).toFixed(1)}" y="${H - 6}" class="iv_xl" text-anchor="${k === 0 ? 'start' : k === show.length - 1 ? 'end' : 'middle'}">${shortDay(show[k].d)}</text>`).join('');
    return `<div class="iv_cd"><div class="iv_leg"><i style="background: #d1453b"></i>20일 평균<span>${esc(cur)} · 하루 한 봉</span></div>
      <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="일봉 차트">${grid}${bars}${maLine(20, '#d1453b')}
        <line x1="8" x2="${8 + pw}" y1="${ly.toFixed(1)}" y2="${ly.toFixed(1)}" stroke="${tagCol}" stroke-width="0.8" stroke-dasharray="2 3"/>
        <rect x="${W - R + 2}" y="${(ly - 9).toFixed(1)}" width="${R - 4}" height="18" rx="4" fill="${tagCol}"/><text x="${W - 4}" y="${(ly + 3.8).toFixed(1)}" class="iv_tag" text-anchor="end">${nice(last.c)}</text>
        ${mark(ih, show[ih].h, false)}${il !== ih ? mark(il, show[il].l, true) : ''}${dates}</svg></div>`;
}
const spark = (vals, cls) => { const L = line(vals, 64, 26, 2); return L ? `<svg class="iv_spark ${cls}" viewBox="0 0 64 26" aria-hidden="true"><path d="${L.d}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round"/></svg>` : '<span class="iv_spark"></span>'; };
const chips = (go, key, on) => `<div class="iv_seg">${RANGES.map(([k, l]) => `<button type="button" class="${k === on ? 'on' : ''}" data-go="${go}" data-i="${esc(key ? `${key}~${k}` : k)}">${l}</button>`).join('')}</div>`;

// a security's saved closes up to the evaluation date
const closes = (m, sym, date, from = '') => Object.keys(finance(m).prices[`STOCK:${sym}`] || {}).filter(d => d <= date && d >= from).sort().map(d => ({ d, v: price(m, `STOCK:${sym}`, d)?.value })).filter(x => finite(x.v));
// ---- the frame: the app's own top bar and bottom tabs
const TABS = [['invest', '홈', 'homeS'], ['ivwatch', '관심', 'star'], ['ivactivity', '거래', 'receipt'], ['ivcash', '자산', 'card']];
const tabs = on => `<div class="iv_tab">${TABS.map(([go, l, ic]) => `<button type="button" class="${go === on ? 'on' : ''}" data-go="${go}">${ax(ic, 23, 'currentColor')}${l}</button>`).join('')}</div>`;
const top = (back, title = '', right = '') => `<div class="iv_top"><button type="button" class="iv_ib" data-go="${back}" aria-label="뒤로">${ax('back', 20, 'currentColor', 2.3)}</button>${title ? `<b class="iv_tt">${title}</b>` : '<b class="iv_brand">kurs<i>.</i></b>'}<span class="iv_topr">${right}</span></div>`;
function frame(p, now, { back = 'invest', title = '', right = '', tab = '', body }) {
    return `<div class="iv_app${UPRED.has(p.country) ? ' iv_east' : ''}">${axBar(p, now)}${top(back, title, right)}<div class="ax_scroll iv_scroll">${body}<i class="ax_pad"></i></div>${tab ? tabs(tab) : ''}</div>${axInd()}`;
}
// the evaluation day and the market calls, kept small: a real app has no such row, but the story's date is ours to set
const tools = (m, p, busy) => p.investment
    ? `<div class="iv_card iv_tools sm"><span class="iv_toolsl">시세 날짜</span><input type="date" class="iv_date" value="${esc(investmentDate(m, p))}"><button type="button" class="iv_refresh iv_link" ${busy ? 'disabled' : ''}>${busy ? '불러오는 중…' : '시세 갱신'}</button><button type="button" class="iv_sync iv_link">원문 확인</button></div>`
    : `<div class="iv_card iv_tools"><label><small>평가 날짜</small><input type="date" class="iv_date" value="${esc(investmentDate(m, p))}"></label><button type="button" class="iv_refresh iv_btn" ${busy ? 'disabled' : ''}>${busy ? '불러오는 중…' : '투자 앱 채우기'}</button></div>`;
const kv = (label, value, cls = '') => `<div class="iv_kv"><small>${label}</small><b class="cg_num ${cls}">${value}</b></div>`;
const row = (label, value) => `<div class="iv_row"><span>${label}</span><b class="cg_num">${value}</b></div>`;
const card = (s, cls = '') => `<div class="iv_card ${cls}">${s}</div>`;
const hd = (t, right = '') => `<div class="iv_hd"><b>${t}</b>${right}</div>`;

export function investmentScreen(m, p, now, view, key, busy) {
    const inv = p.investment;
    if (!inv) {
        return frame(p, now, { back: 'home2', body: `<div class="iv_empty"><span class="iv_emptyic">${ax('chart', 30, 'currentColor', 2)}</span><b>아직 투자 계좌가 없어요</b></div>${tools(m, p, busy)}` });
    }
    const date = inv.date, f = finance(m), trades = inv.trades.filter(t => t.date <= inv.date), holdings = positions(trades), costs = baseCosts(trades, inv.base);
    const lookup = s => inv.securities.find(x => x.symbol === s), held = holdings.filter(h => h.quantity > 0);
    const prevOf = sym => { const d = Object.keys(f.prices[`STOCK:${sym}`] || {}).filter(x => x < date).sort().pop(); return d ? price(m, `STOCK:${sym}`, d) : null; };
    const dayChange = sym => { const q = price(m, `STOCK:${sym}`, date), b = prevOf(sym); return q && !q.stale && b ? (q.value / b.value - 1) * 100 : null; };

    const targets = [...inv.securities.map(s => ({ key: `stock:${s.symbol}`, name: s.ko || s.name })), ...inv.stakes.map(s => ({ key: `stake:${s.id}`, name: s.company }))];
    const targetName = k => targets.find(t => t.key === k)?.name || k;
    const evidence = x => `<details class="ir_evidence"><summary>${ax('doc',14)}<span>원문 근거${x.ref ? ` · ${esc(x.ref)}` : ''}</span>${ax('chev',13)}</summary><p>${esc(x.evidence)}</p></details>`;
    const filters = v => `<div class="ir_filters" aria-label="대상 선택"><button type="button" class="${key ? '' : 'on'}" data-go="${v}" data-i="">전체</button>${targets.filter(t=>v !== 'ivhistory' || t.key.startsWith('stake:')).map(t=>`<button type="button" class="${key === t.key ? 'on' : ''}" data-go="${v}" data-i="${esc(t.key)}">${esc(t.name)}</button>`).join('')}</div>`;
    const reload = `<button type="button" class="iv_ib iv_records" ${busy ? 'disabled' : ''} aria-label="일정 채우기 · 원문 변경 확인" title="일정 채우기 · 원문 변경 확인">${busy ? '<i class="fa-solid fa-spinner fa-spin"></i>' : ax('redo',18)}</button>`;
    const emptyRecord = (icon,title,desc) => `<div class="ir_empty">${ax(icon,30)}<b>${title}</b><p>${desc}</p></div>`;
    // Old saved routes lead to the containing detail, not a separate journal.
    if (view === 'ivnotes') return investmentScreen(m,p,now,key?.startsWith('stock:') ? 'stock' : key?.startsWith('stake:') ? 'ivstakes' : 'invest',key?.startsWith('stock:') ? key.slice(6) : '',busy);
    if (view === 'ivhistory') return investmentScreen(m,p,now,'ivstakes','',busy);
    const noteBlock = target => {
        const notes = (inv.notes || []).filter(n => n.target === target).slice().reverse();
        const content = n => `<p>${esc(n.text)}</p>${n.ko ? `<p class="iv_memo_translation">${esc(n.ko)}</p>` : ''}${n.source === 'story' ? evidence(n) : ''}`;
        return `<section class="iv_card iv_memo"><header>${ax('pen',15)} 투자 메모 <small>${esc(notes[0]?.date || '')}</small></header>${notes.length ? content(notes[0]) : '<p class="iv_muted">아직 남긴 메모가 없어요.</p>'}<footer><span>${notes[0] ? notes[0].source === 'story' ? '원문 기반' : '상상한 메모' : '이 종목을 보유하거나 지켜보는 이유'}</span><button type="button" class="iv_link iv_notemake" data-target="${esc(target)}" ${busy ? 'disabled' : ''}>${ax('redo',13)} ${busy ? '불러오는 중…' : '새 메모'}</button></footer>${notes.length > 1 ? `<details class="iv_memo_older"><summary>이전 메모 ${notes.length - 1}개</summary>${notes.slice(1).map(n=>`<div><small>${esc(n.date)} · ${n.source === 'story' ? '원문 기반' : '상상'}</small>${content(n)}</div>`).join('')}</details>` : ''}</section>`;
    };
    const historyBlock = target => {
        const fields = {percent:'지분율',holder:'직접 보유자',voter:'의결권 행사자',beneficiary:'배당 수익자',restriction:'매도 제한·조건'};
        const xs = (inv.history || []).filter(x => x.target === target).slice().sort((a,b)=>(b.date || '').localeCompare(a.date || ''));
        return `<details class="iv_history"><summary>변경 내역<span>${xs.length}건</span>${ax('chev',14)}</summary>${xs.map(x=>`<div class="iv_history_change"><small>${esc(x.date || '날짜 미상')} · ${fields[x.field] || esc(x.field)}</small><p>${esc(x.before) || '미상'} → <em>${esc(x.after) || '미상'}</em></p>${evidence(x)}</div>`).join('') || '<p class="iv_muted">확인된 변경 기록이 없어요.</p>'}<button type="button" class="iv_records iv_link" ${busy ? 'disabled' : ''}>${ax('redo',13)} ${busy ? '확인 중…' : '원문에서 변경 확인'}</button></details>`;
    };
    if (view === 'ivschedule') {
        const kinds = {dividend:'배당',meeting:'주주총회',release:'매도 제한 해제',delegation:'위임 만료'};
        const xs = (inv.schedules || []).filter(x=>!key || x.target === key).slice().sort((a,b)=>a.date.localeCompare(b.date));
        const upcoming = xs.filter(x=>x.status === 'scheduled' && x.date >= date), next=upcoming[0];
        const months=[...new Set(xs.map(x=>x.date.slice(0,7)))];
        const status=x=>x.source === 'guess' ? (x.date < date ? '가상 · 날짜 지남' : '가상 예정') : x.status === 'paid' ? '지급 확인' : x.status === 'cancelled' ? '취소' : x.date < date ? '이행 확인 필요' : x.date === date ? '오늘' : '예정';
        const diff=next ? Math.round((Date.parse(next.date)-Date.parse(date))/dayMs) : null;
        return frame(p,now,{title:'배당 · 권리 일정',tab:'ivcash',right:reload,body:`
          <div class="iv_hero ir_agenda"><div class="ir_hero_label"><small>NEXT UP</small><span>${upcoming.length}개 예정</span></div><div class="ir_due">${next ? diff === 0 ? 'TODAY' : `D−${diff}` : '—'}</div><h2>${next ? esc(next.title) : '다가오는 일정 없음'}</h2><p>${next ? `${esc(targetName(next.target))} · ${esc(next.date)}${next.source === 'guess' ? ' · 가상 예정' : ''}` : '확인된 일정이 생기면 여기에 모여요'}</p></div>
          ${filters('ivschedule')}
          ${months.map(mo=>`${hd(`${Number(mo.slice(0,4))}년 ${Number(mo.slice(5))}월`)}<div class="iv_card ir_agenda_list">${xs.filter(x=>x.date.startsWith(mo)).map(x=>`<div class="ir_event"><div class="ir_date"><small>${Number(x.date.slice(5,7))}월</small><b>${Number(x.date.slice(8))}</b></div><div class="ir_event_body"><div class="ir_event_type">${kinds[x.kind]}<span class="ir_status ${x.status}">${status(x)}</span></div><h3>${esc(x.title)}</h3><small>${esc(targetName(x.target))}</small>${x.source === 'guess' ? '' : evidence(x)}</div></div>`).join('')}</div>`).join('') || emptyRecord('cal','확인된 일정이 없어요','오른쪽 위 새로고침으로 배당 예정을 채우고 원문 일정을 확인해 보세요.')}
          <button type="button" class="ir_calendar" data-go="cal">${ax('cal',18)}<span>휴대폰 캘린더에서 보기</span>${ax('chev',16)}</button>`});
    }
    if (view === 'stock') {
        const [sym, rg = '1m'] = String(key).split('~'), s = lookup(sym);
        if (!s) return investmentScreen(m, p, now, 'invest', '', busy);
        const h = holdings.find(x => x.symbol === sym), q = price(m, `STOCK:${sym}`, date), prev = prevOf(sym), change = dayChange(sym);
        const days = RANGES.find(r => r[0] === rg)?.[2] || 31;
        const value = q && h ? h.quantity * q.value : null, gain = finite(value) && h ? value - h.cost : null;
        const baseCost = costs[sym]?.cost, rate = fx(m, s.currency, inv.base, date);
        const baseGain = finite(value) && finite(baseCost) && rate !== null ? value * rate - baseCost : null;
        const mine = h && h.quantity > 0 ? `${hd('내 투자')}<div class="iv_card iv_grid">
            ${kv('보유 수량', `${h.quantity}주`)}${kv('평균 매수가', money(p, h.average, s.currency))}
            ${kv('평가액', money(p, value, s.currency))}${kv('평가손익', money(p, gain, s.currency, true), tone(p, gain))}
            ${kv('수익률', finite(gain) && h.cost > 0 ? pct(gain / h.cost * 100) : '—', tone(p, gain))}${kv('배당 받은 돈', money(p, h.dividends, s.currency))}
          </div>
          ${s.currency === inv.base ? '' : `<details class="iv_card iv_more"><summary>${inv.base} 기준으로 보기<span>${money(p, baseGain, inv.base, true)}</span></summary>
            ${row(`${inv.base} 기준 평가손익`, money(p, baseGain, inv.base, true))}
            ${row('주가 변화 몫', money(p, finite(gain) && rate !== null && finite(baseGain) ? gain * rate : null, inv.base, true))}
            ${row('환율 변화 몫', money(p, finite(baseGain) && finite(gain) && rate !== null ? baseGain - gain * rate : null, inv.base, true))}
            <small>주가 몫 · 현재 환율 기준 / 환율 몫 · 매수일 대비</small></details>`}
          ${h.realized ? card(row('실현손익', money(p, h.realized, s.currency, true)), 'iv_one') : ''}<small class="iv_note">평균 매수가 · 수수료 포함</small>`
            : `${hd('내 투자')}${card(`<p class="iv_muted">가진 주식이 없어요${inv.watch.some(w => w.symbol === sym) ? ' · 관심 종목이에요' : ''}${h?.realized ? ` · 실현손익 ${money(p, h.realized, s.currency, true)}` : ''}</p>`)}`;
        const tl = inv.trades.filter(t => t.symbol === sym).slice().reverse();
        const watch = inv.watch.find(w => w.symbol === sym);
        return frame(p, now, {
            back: 'invest', title: ' ', right: `<button type="button" class="iv_ib iv_news" data-symbol="${esc(sym)}" aria-label="관련 뉴스">${ax('search', 18, 'currentColor', 2.3)}</button>`,
            body: `<div class="iv_quote">${logo(s, 46)}<span class="iv_qn"><b>${esc(s.ko || s.name)}</b><small>${esc(s.name)} · ${esc(s.symbol)}</small></span></div>
              <div class="iv_big cg_num">${money(p, q?.value, s.currency)}</div>
              <div class="iv_chg ${tone(p, change)}">${finite(change) && prev ? `${arrow(change)} ${money(p, q.value - prev.value, s.currency, true)} (${pct(change)}) <small>${esc(shortDay(prev.date))} 대비</small>` : `<small>${q ? (q.stale ? `${esc(shortDay(q.date))} 마지막 시세` : '이전 시세가 없어요') : '아직 평가 전이에요'}</small>`}</div>
              <div class="iv_src">${q ? `${esc(shortDay(q.date))} ${esc(q.time || '시각 모름')} · ${q.source === 'story' ? '원문 가격' : '가상 시세'}${q.stale ? ' · 이전 시세' : ''}` : ''}${q?.conflict ? ` · <button type="button" class="iv_link" data-go="ivprices" data-i="${esc(`STOCK:${sym}`)}">가격 확인 필요</button>` : ''}</div>
              ${candles(m, p, sym, date, daysBack(date, days), s.currency)}${chips('stock', sym, rg)}
              ${mine}
              ${noteBlock(`stock:${sym}`)}
              ${watch ? `${hd('관심 메모')}${card(`<p>${esc(watch.note)}</p>${watch.ko ? `<p class="iv_ko">${esc(watch.ko)}</p>` : ''}<small>상상</small>`)}` : ''}
              ${hd('거래 내역', `<button type="button" class="iv_link" data-go="ivprices" data-i="${esc(`STOCK:${sym}`)}">가격 기록과 출처</button>`)}
              ${card(tl.map(t => trow(p, t, s)).join('') || '<p class="iv_muted">거래가 없어요</p>', 'iv_list')}
              <button type="button" class="iv_btn wide iv_news" data-symbol="${esc(sym)}">${ax('search', 16, 'currentColor', 2.3)} 관련 뉴스 검색</button>`,
        });
    }
    if (view === 'ivwatch') {
        return frame(p, now, { title: '관심 종목', tab: 'ivwatch', body: `${inv.watch.length ? `<div class="iv_card iv_list">${inv.watch.map(w => { const s = lookup(w.symbol), q = price(m, `STOCK:${w.symbol}`, date), c = dayChange(w.symbol), ser = closes(m, w.symbol, date, daysBack(date, 31)).map(x => x.v);
            return `<button type="button" class="iv_hold" data-go="stock" data-i="${esc(w.symbol)}">${logo(s)}<span class="iv_hn"><b>${esc(s?.ko || s?.name || w.symbol)}</b><small>${esc(w.note)}</small></span>${spark(ser, tone(p, ser.length > 1 ? ser[ser.length - 1] - ser[0] : 0))}<span class="iv_hv"><b class="cg_num">${money(p, q?.value, s?.currency)}</b><small class="${tone(p, c)}">${pct(c)}</small></span></button>`; }).join('')}</div>` : card('<p class="iv_muted">관심 종목이 없어요</p>')}` });
    }
    if (view === 'ivstakes') {
        return frame(p, now, { title: '소유 지분', body: `${inv.stakes.map(s => card(`<div class="iv_sh">${logo({ symbol: s.company }, 36)}<b>${esc(s.company)}</b><span class="iv_pill">${s.listed === null ? '상장 여부 모름' : s.listed ? '상장' : '비상장'}</span></div>
            <div class="iv_stake cg_num">${s.percent === null ? '—' : `${s.percent}%`}<small>지분율</small></div>
            ${row('직접 보유자', esc(s.holder) || '—')}${row('의결권 행사자', esc(s.voter) || '—')}${row('배당 수익자', esc(s.beneficiary) || '—')}${row('매도 제한 · 조건', esc(s.restriction) || '—')}${row('설정상 평가액', money(p, s.value, s.currency))}
            <details><summary>설정 근거</summary><p>${esc(s.evidence)}</p></details>${historyBlock(`stake:${s.id}`)}`)).join('') || card('<p class="iv_muted">확인된 소유 지분 정보가 없어요</p>')}` });
    }
    if (view === 'ivprices') {
        const keys = key ? [key] : Object.keys(f.prices).filter(k => k.startsWith('FX:') || inv.securities.some(s => k === `STOCK:${s.symbol}`));
        const name = k => { const s = k.startsWith('STOCK:') ? lookup(k.slice(6)) : null; return s ? esc(s.ko || s.name) : esc(k.replace(/^FX:/, '환율 ')); };
        return frame(p, now, { back: key?.startsWith('STOCK:') ? `stock:${encodeURIComponent(key.slice(6))}` : 'invest', title: '가격 · 환율', body: keys.map(k => `${hd(name(k), `<small>${esc(k.replace(/^(STOCK|FX):/, ''))}</small>`)}${card(Object.entries(f.prices[k] || {}).filter(([d]) => d <= date).sort(([a], [b]) => b.localeCompare(a)).map(([d, slot]) => `<div class="iv_qd"><b class="cg_num">${esc(d)}${slot.conflict ? ' <span class="iv_pill warn">가격 확인 필요</span>' : ''}</b>${slot.rows.map(q => `<div class="iv_qr ${slot.selected === q.id ? 'on' : ''}"><span class="cg_num">${q.value}</span><small>${esc(q.time || '시각 모름')} · ${q.source === 'story' ? '원문' : '가상'}</small>${slot.selected === q.id ? '<em>평가에 쓰는 중</em>' : `<button type="button" class="iv_select iv_btn ghost sm" data-key="${esc(k)}" data-date="${d}" data-id="${q.id}">이 가격 쓰기</button>`}${q.ref ? `<details><summary>근거</summary>${esc(q.ref)}</details>` : ''}</div>`).join('')}</div>`).join('') || '<p class="iv_muted">기록이 없어요</p>', 'iv_list')}`).join('') || card('<p class="iv_muted">가격 기록이 없어요</p>') });
    }
    if (view === 'ivactivity') {
        const transfers = Object.values(f.transfers).filter(t => f.accounts[t.from]?.owner === p.owner || f.accounts[t.to]?.owner === p.owner);
        const all = inv.trades.slice().sort((a, b) => b.date.localeCompare(a.date));
        const months = [...new Set(all.map(t => t.date.slice(0, 7)))];
        return frame(p, now, { title: '거래 내역', tab: 'ivactivity', body: `${months.map(mo => `${hd(`${Number(mo.slice(0, 4))}년 ${Number(mo.slice(5))}월`)}${card(all.filter(t => t.date.startsWith(mo)).map(t => trow(p, t, lookup(t.symbol), true)).join(''), 'iv_list')}`).join('') || card('<p class="iv_muted">매매 내역이 없어요</p>')}
          ${transfers.length ? `${hd('연결된 이체')}${transfers.map(t => card(`<div class="iv_sh"><b>${esc(t.date)} · 이체</b></div>${row('보내는 원금', money(p, t.sent, f.accounts[t.from].currency))}${row('받는 원금', money(p, t.received, f.accounts[t.to].currency))}${row('수수료', money(p, t.fee, t.feeCurrency || f.accounts[t.from].currency))}${f.accounts[t.from].currency !== f.accounts[t.to].currency ? row('적용 환율', String(t.rate)) : ''}<small>${t.feeSide === 'receiver' ? '받는 돈에서 수수료를 뺐어요' : '보내는 돈에 수수료를 따로 냈어요'} · ${esc(t.id)}</small>`)).join('')}` : ''}` });
    }
    if (view === 'ivcash') {
        const accounts = Object.entries(f.accounts).filter(([, a]) => a.owner === p.owner);
        const isBroker = k => inv.accounts.some(x => x.key === k), opt = ([k, a]) => `<option value="${esc(k)}">${isBroker(k) ? '증권' : '은행'} · ${a.currency} · ${esc(a.id.slice(-6))}</option>`;
        return frame(p, now, { title: '자산', tab: 'ivcash', body: `${hd('현금')}${accounts.map(([k, a]) => card(`<div class="iv_sh"><span class="iv_cur">${esc(a.currency)}</span><b>${isBroker(k) ? '증권 현금' : '은행'} · ${esc(a.currency)}</b></div><div class="iv_stake cg_num">${money(p, cash(a), a.currency)}<small>지금 잔액</small></div>${row('기준 잔액', money(p, a.amount, a.currency))}<small>${esc(a.asOf)} 기준 · 그 뒤 거래 ${a.included.length}건 포함</small>
            <details><summary>기준 잔액 고치기</summary><input type="number" class="iv_balance" value="${a.amount}" step="any"><input class="iv_reason" placeholder="고치는 이유"><button type="button" class="iv_baseline iv_btn" data-key="${esc(k)}">기준점 고치기</button></details>`)).join('')}
          <div class="iv_menu"><button type="button" data-go="ivstakes">${ax('grid4', 20, 'currentColor')}<b>소유 지분</b></button><button type="button" data-go="ivprices">${ax('swap', 20, 'currentColor')}<b>가격 · 환율</b></button></div>
          ${hd('실제로 있었던 이체 연결')}<div class="iv_card iv_form">
            <label><small>거래 ID</small><input class="iv_tid" placeholder="같은 거래는 같은 ID"></label>
            <label><small>나가는 계좌</small><select class="iv_from">${accounts.map(opt).join('')}</select></label><label><small>들어오는 계좌</small><select class="iv_to">${accounts.map(opt).join('')}</select></label>
            <div class="iv_two"><label><small>보내는 원금</small><input type="number" class="iv_sent" step="any"></label><label><small>받는 원금</small><input type="number" class="iv_received" step="any"></label></div>
            <div class="iv_two"><label><small>수수료</small><input type="number" class="iv_fee" step="any" placeholder="모르면 비워 두기"></label><label><small>수수료 빼는 쪽</small><select class="iv_feeSide"><option value="sender">보내는 쪽에 따로</option><option value="receiver">받는 쪽에서 빼기</option></select></label></div>
            <div class="iv_two"><label><small>적용 환율 · 통화가 다를 때</small><input type="number" class="iv_rate" step="any"></label><label><small>거래 날짜</small><input type="date" class="iv_tdate" value="${date}"></label></div>
            <label class="iv_ck"><input type="checkbox" class="iv_incfrom"> 나간 돈은 기준 잔액에 이미 들어가 있어요</label><label class="iv_ck"><input type="checkbox" class="iv_incto"> 들어온 돈은 기준 잔액에 이미 들어가 있어요</label>
            <button type="button" class="iv_transfer iv_btn wide">이체 연결</button></div>` });
    }

    // ---- 홈
    const amounts = inv.accounts.map(a => ({ amount: cash(f.accounts[a.key]), currency: a.currency, label: '현금' }));
    for (const h of held) { const q = price(m, `STOCK:${h.symbol}`, date); amounts.push({ amount: q && !q.stale ? h.quantity * q.value : null, currency: h.currency, label: lookup(h.symbol)?.name || h.symbol }); }
    const sum = total(m, amounts, inv.base, date);
    // today against each holding's last trading day before it (weekends have no prices)
    let prior = 0, today = 0, dayComplete = held.length > 0;
    for (const h of held) {
        const before = prevOf(h.symbol), after = price(m, `STOCK:${h.symbol}`, date);
        const r0 = before ? fx(m, h.currency, inv.base, before.date) : null, r1 = fx(m, h.currency, inv.base, date);
        if (!before || !after || after.stale || r0 === null || r1 === null) dayComplete = false;
        else { prior += h.quantity * before.value * r0; today += h.quantity * after.value * r1; }
    }
    let unrealized = 0, basis = 0, gainComplete = held.length > 0;
    for (const h of held) {
        const q = price(m, `STOCK:${h.symbol}`, date), r = fx(m, h.currency, inv.base, date), c = costs[h.symbol]?.cost;
        if (!q || q.stale || r === null || !finite(c)) gainComplete = false;
        else { unrealized += h.quantity * q.value * r - c; basis += c; }
    }
    const dayD = dayComplete && prior > 0 ? today - prior : null;
    // how the money is spread: each holding's worth in the base currency, cash last
    const parts = [...held.map(h => { const q = price(m, `STOCK:${h.symbol}`, date), r = fx(m, h.currency, inv.base, date); return { s: lookup(h.symbol), v: q && !q.stale && r !== null ? h.quantity * q.value * r : null }; }),
        ...inv.accounts.map(a => { const r = fx(m, a.currency, inv.base, date); return { cash: a.currency, v: r !== null ? cash(f.accounts[a.key]) * r : null }; })].filter(x => finite(x.v) && x.v > 0);
    const whole = parts.reduce((n, x) => n + x.v, 0);
    const mix = whole > 0 ? `<div class="iv_mix">${parts.map(x => `<i style="flex: ${x.v / whole}; background: ${x.cash ? 'rgba(255, 255, 255, 0.35)' : axTint((x.s?.symbol || '').split(':').pop())}"></i>`).join('')}</div>
        <div class="iv_mixl">${parts.slice(0, 6).map(x => `<span><i style="background: ${x.cash ? 'rgba(255, 255, 255, 0.35)' : axTint((x.s?.symbol || '').split(':').pop())}"></i>${esc(x.cash ? `현금 ${x.cash}` : x.s?.ko || x.s?.name || '')} ${Math.round(x.v / whole * 100)}%</span>`).join('')}</div>` : '';
    const holdHtml = held.map(h => {
        const s = lookup(h.symbol), q = price(m, `STOCK:${h.symbol}`, date), val = q && !q.stale ? h.quantity * q.value : null, gain = finite(val) ? val - h.cost : null;
        const ser = closes(m, h.symbol, date, daysBack(date, 31)).map(x => x.v);
        return `<button type="button" class="iv_hold iv_holding" data-go="stock" data-i="${esc(h.symbol)}">${logo(s)}<span class="iv_hn"><b>${esc(s?.ko || s?.name || h.symbol)}</b><small class="cg_num">${h.quantity}주 · ${esc(h.symbol.split(':').pop())}</small></span>${spark(ser, tone(p, ser.length > 1 ? ser[ser.length - 1] - ser[0] : 0))}<span class="iv_hv"><b class="cg_num">${money(p, val, h.currency)}</b><small class="cg_num ${tone(p, gain)}">${q?.stale ? '이전 시세' : finite(gain) && h.cost > 0 ? `${money(p, gain, h.currency, true)} (${pct(gain / h.cost * 100)})` : '시세 없음'}</small></span></button>`;
    }).join('');
    const cashRows = amounts.filter(a => a.label === '현금');
    return frame(p, now, {
        back: 'home2', tab: 'invest', right: `<button type="button" class="iv_ib iv_refresh" ${busy ? 'disabled' : ''} aria-label="시세 갱신">${busy ? '<i class="fa-solid fa-spinner fa-spin"></i>' : ax('redo', 18, 'currentColor', 2.3)}</button>`,
        body: `<div class="iv_hero"><small>${sum.complete ? '총 투자자산' : '환산 가능한 소계 · 평가 미완료'}</small>
            <div class="iv_big cg_num">${money(p, sum.value, inv.base)}</div>
            <div class="iv_chg ${tone(p, dayD)}">${finite(dayD) ? `${arrow(dayD)} ${money(p, dayD, inv.base, true)} (${pct((today / prior - 1) * 100)}) <small>오늘 · 주식</small>` : '<small>오늘 변동 · 아직 다 계산되지 않았어요</small>'}</div>
            <div class="iv_src">${esc(shortDay(date))} 기준 · ${esc(inv.base)}로 환산</div>
            ${sum.missing.map(x => `<div class="iv_miss">${esc(x.label)} · ${finite(x.amount) ? `${money(p, x.amount, x.currency)} 환산 대기` : '가격 확인 필요'}</div>`).join('')}
            <div class="iv_herog">${kv('평가손익', gainComplete ? money(p, unrealized, inv.base, true) : '미완료', gainComplete ? tone(p, unrealized) : '')}${kv('수익률', gainComplete && basis > 0 ? pct(unrealized / basis * 100) : '—', gainComplete ? tone(p, unrealized) : '')}</div>
            ${mix}</div>
          ${hd(`보유 종목 <span>${held.length}</span>`)}${card(holdHtml || '<p class="iv_muted">가진 종목이 없어요</p>', 'iv_list')}
          ${cashRows.length ? `${hd('주문 가능 현금')}${card(cashRows.map(a => `<div class="iv_cash"><span class="iv_cur">${esc(a.currency)}</span><b>${esc(a.currency)} 예수금</b><b class="cg_num">${money(p, a.amount, a.currency)}</b></div>`).join(''), 'iv_list')}` : ''}
          <button type="button" class="ir_calendar" data-go="ivschedule">${ax('cal',18)}<span>배당 · 권리 일정</span>${ax('chev',16)}</button>
          ${tools(m, p, busy)}
          <details class="iv_card iv_more"><summary>계좌 구성 근거</summary><p>${esc(inv.basis)}</p></details>`,
    });
}
// one trade as a row: what, how many, at what
function trow(p, t, s, named = false) {
    const amt = t.kind === 'dividend' ? t.amount : t.kind === 'buy' ? -(t.quantity * t.price + (t.fee || 0)) : t.quantity * t.price - (t.fee || 0);
    return `<div class="iv_tr"><span class="iv_kind ${t.kind}">${KIND[t.kind] || esc(t.kind)}</span><span class="iv_hn"><b>${named ? esc(s?.ko || s?.name || t.symbol) : esc(shortDay(t.date))}</b><small class="cg_num">${named ? `${esc(shortDay(t.date))} · ` : ''}${t.kind === 'dividend' ? '배당금' : `${t.quantity}주 × ${money(p, t.price, t.currency)}`}</small></span><b class="cg_num ${amt > 0 ? 'iv_in' : ''}">${money(p, amt, t.currency, true)}</b></div>`;
}
