// 캐릭터 휴대폰 · 시계 · 건강 · 파일 · 날씨 · 배달 (v3.142): our app look (round glass buttons, white cards), the clock on
// charcoal, the weather sky moving with its weather, the delivery app as the one used where the owner lives (배달의민족 in
// Korea, Uber Eats elsewhere). Everything that follows from the numbers is worked out here, never asked of the model:
// the next alarm and time left, sleep stages and charts, the usual-vs-recent lines, the weather tiles' sentences, a saved
// city's local time and hours, an order's total, its map and receipt, a ticket file's first page.

import { AX, ax, axBar, axCb, axH1, axInd, axKp, axTint, axTop, busyHtml } from './phoneapps.js';
import { filling } from './phoneai.js';
import { fmtDate, koOn, pad, storyNow } from './phonedata.js';
import { orderTotal, shiftDay } from './phonelife.js';
import { fmtMoney } from './phonemoney.js';
import { nameKey } from './people.js';
import { esc } from './util.js';
import { DOT_C, DOT_R, DOTS, MAP_BOT, MAP_H, MAP_TOP, MAP_W, TZ_AT } from './worldmap.js';

Object.assign(AX, {
    alarm: 'M12 6a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM12 9v4l2 2M5 3L2 6M19 3l3 3', hourglass: 'M12 7a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM12 10v4M10 3h4', globe: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18',
    bell: 'M6 8a6 6 0 1 1 12 0c0 7 3 8 3 8H3s3-1 3-8M10 20a2 2 0 0 0 4 0', play: 'M8 5v14l11-7z', walk: 'M13 4a1.5 1.5 0 1 0 0 .1M10 21l2-6 3 3v3M9 12l2-4 4 1 2 3M12 15l-2-3', moon: 'M20 14A8 8 0 1 1 10 4a6 6 0 0 0 10 10z',
    run: 'M14 4a1.5 1.5 0 1 0 0 .1M6 20l4-5 3 2 1 4M8 11l3-3 4 1 2 4h3M11 8l-2 6', heartF: 'M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.5-7 10-7 10z', up: 'M12 19V5M6 11l6-6 6 6', down: 'M12 5v14M6 13l6 6 6-6', eq: 'M5 10h14M5 14h14',
    cloudF: 'M7 17a4 4 0 0 1 .5-8A5.5 5.5 0 0 1 18 11a3 3 0 0 1-.5 6z', dl: 'M12 4v11M7 10l5 5 5-5M5 20h14', trash: 'M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13', folder: 'M3 6h7l2 2h9v11H3z', phoneS: 'M7 2h10v20H7zM11 18h2',
    rain: 'M7 15a4 4 0 0 1 .5-8A5.5 5.5 0 0 1 18 9a3.5 3.5 0 0 1-.5 6M9 18l-1 2M13 18l-1 2M17 18l-1 2', sun: 'M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10zM12 2v2M12 20v2M4 12H2M22 12h-2M5 5l1.4 1.4M17.6 17.6L19 19M5 19l1.4-1.4M17.6 6.4L19 5',
    snow: 'M12 3v18M4.2 7.5l15.6 9M4.2 16.5l15.6-9', fog: 'M4 9h16M3 13h18M6 17h12', storm: 'M7 15a4 4 0 0 1 .5-8A5.5 5.5 0 0 1 18 9a3.5 3.5 0 0 1-.5 6M12 13l-2 4h4l-2 4', drop: 'M12 3s6 7 6 11a6 6 0 0 1-12 0c0-4 6-11 6-11z',
    therm: 'M10 14V5a2 2 0 0 1 4 0v9a4 4 0 1 1-4 0z', wind: 'M3 8h11a3 3 0 1 0-3-3M3 12h16a3 3 0 1 1-3 3M3 16h8', eye: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z',
    nav: 'M12 2l7 19-7-4-7 4z', calS: 'M4 6h16v14H4zM4 10h16M8 3v4M16 3v4', trk: 'M4 6h16v12H4zM8 10h8M8 14h5', cart: 'M3 4h2l2.4 11.2a1 1 0 0 0 1 .8h9.2a1 1 0 0 0 1-.8L20 8H6M9 20h.01M17 20h.01',
    store: 'M4 9l1.5-5h13L20 9M4 9v11h16V9M4 9h16', rcp: 'M6 3h12v18l-3-2-3 2-3-2-3 2zM9 8h6M9 12h6', user: 'M12 4a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM4 21a8 8 0 0 1 16 0', homeS: 'M3 10.5L12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z',
    bagS: 'M5 8h14l-1.2 11a1 1 0 0 1-1 .9H7.2a1 1 0 0 1-1-.9zM9 8V6a3 3 0 0 1 6 0v2', cardS: 'M3 6h18v12H3zM3 10h18', check: 'M5 12l5 5 9-10', pause: 'M9 5v14M15 5v14', arrR: 'M5 12h14M13 6l6 6-6 6', plusS: 'M12 5v14M5 12h14', eyeoff: 'M3 3l18 18M10.6 6.1A10 10 0 0 1 12 6c6 0 9.5 6 9.5 6a17 17 0 0 1-3 3.6M6.1 7.6A17 17 0 0 0 2.5 12S6 18 12 18a9 9 0 0 0 4-.9',
});

// ---- shared bits
const L = p => p.life || null;
const k1 = (k, cls = 'lf_k') => (k && koOn() ? `<span class="${cls}">${esc(k)}</span>` : '');
const now5 = p => String(storyNow(p) || p.now || '');
const toMin = t => { const mt = String(t || '').match(/(\d{1,2}):(\d{2})/); return mt ? Number(mt[1]) * 60 + Number(mt[2]) : null; };
const hm = n => `${pad(Math.floor(((n % 1440) + 1440) % 1440 / 60))}:${pad(((n % 60) + 60) % 60)}`;
const dur = min => (min >= 60 ? `${Math.floor(min / 60)}시간 ${min % 60}분` : `${min}분`);
const durBig = min => `${Math.floor(min / 60)}<span>시간</span> ${min % 60}<span>분</span>`;
const n0 = v => (v === null || v === undefined ? '—' : Number(v).toLocaleString('de-DE'));
const md = s => { const mt = String(s || '').match(/^(\d{2})-(\d{2})/); return mt ? { mo: Number(mt[1]), d: Number(mt[2]) } : null; };
const YEAR = 2025; // weekdays need a year; the story's dates carry none
const weekday = day => { const x = md(day); return x ? new Date(Date.UTC(YEAR, x.mo - 1, x.d)).getUTCDay() : 0; };
const WD = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'], WDK = { mon: '월', tue: '화', wed: '수', thu: '목', fri: '금', sat: '토', sun: '일' };
const daysLine = days => { const s = days.join(','); return s === 'mon,tue,wed,thu,fri' ? '평일' : s === 'sat,sun' ? '주말' : days.length === 7 ? '매일' : days.map(d => WDK[d]).join(' '); };
const ampm = t => { const m = toMin(t); return m === null ? ['', ''] : [`${(Math.floor(m / 60) % 12) || 12}:${pad(m % 60)}`, m < 720 ? 'AM' : 'PM']; };
export const lifeEmpty = (p, now, title, kind, back = 'home2', dark = false) => {
    const busy = filling.has(`${nameKey(p.owner)}:${kind}`);
    return `${axBar(p, now, dark ? '#f2f2f4' : '#111')}
      ${axTop(axCb(back))}
      <div class="ax_scroll">${axH1(title)}
        <div class="ax_card ax_fillc lf_fill"><button type="button" class="ax_fillb na_ph_fill" data-k="${kind}" ${busy ? 'disabled' : ''}>${busy ? `${busyHtml} 채우는 중` : '채우기'}</button></div>
        <i class="ax_pad"></i></div>
      ${axInd()}`;
};

// ================= 시계 (charcoal) =================
const clockDock = on => `<div class="lf_dock lf_dark">${[['clock', 'alarm', '알람'], ['timer', 'hourglass', '타이머'], ['wclock', 'globe', '세계 시계']].map(([go, ic, t]) => `<button type="button" class="${go === on ? 'on' : ''}" data-go="${go}">${ax(ic, 17, 'currentColor', 2.1)}${t}</button>`).join('')}</div>`;
// the next time an alarm rings after the story's now (one-time alarms on their date; repeats on their weekdays)
function nextRing(a, now) {
    const day = now.slice(0, 5), t = toMin(now.slice(6)) ?? 0, at = toMin(a.time);
    if (!a.on || at === null || !md(day)) return null;
    for (let k = 0; k < 8; k++) {
        const d = shiftDay(day, k);
        if (k === 0 && at <= t) continue;
        if (a.days.length ? a.days.includes(WD[weekday(d)]) : (a.date ? a.date === d : true)) return { day: d, min: k * 1440 + at - t };
        if (!a.days.length && !a.date) return null;
    }
    return null;
}
const alarmRow = (p, a) => {
    const [t, ap] = ampm(a.time);
    return `<button type="button" class="lf_al ${a.on ? '' : 'off'}" data-go="alarm" data-i="${a.id}"><span class="lf_alt"><b>${t}<small>${ap}</small></b><span>${esc(a.label || '알람')}${a.ko && koOn() ? ` <em>${esc(a.ko)}</em>` : ''} <em>· ${a.days.length ? daysLine(a.days) : a.date ? `${esc(fmtDate(p, a.date, true))} 한 번` : '한 번'}</em></span></span><span class="lf_tg ${a.on ? 'on' : ''}"></span></button>
      ${a.then.length ? `<div class="lf_snz">${a.then.map(x => `<span class="${a.on ? '' : 'o'}">${esc(ampm(x)[0])}</span>`).join('')}</div>` : ''}`;
};
export function clockScreen(p, now) {
    const lf = L(p);
    if (!lf) return lifeEmpty(p, now, '시계', 'life', 'home2', true);
    const as = lf.clock.alarms, n = now5(p), next = as.map(a => ({ a, r: nextRing(a, n) })).filter(x => x.r).sort((x, y) => x.r.min - y.r.min)[0];
    const wake = as.filter(a => a.wake), other = as.filter(a => !a.wake), on = as.filter(a => a.on).length;
    return `${axBar(p, now, '#f2f2f4')}
      ${axTop(axCb('home2'), axKp(p))}
      <div class="ax_scroll">${axH1('알람', `켜짐 ${on} · 꺼짐 ${as.length - on}`)}
        ${next ? `<div class="lf_next"><span>${ax('bell', 20, '#f5a524', 2.1)}</span><div><b>${next.r.min < 1440 && next.r.day === n.slice(0, 5) ? '오늘' : next.r.min < 2880 ? '내일' : `${WDK[WD[weekday(next.r.day)]]}요일`} ${ampm(next.a.time)[1] === 'AM' ? '오전' : '오후'} ${esc(ampm(next.a.time)[0])}</b><small>${esc(next.a.label || '알람')} · ${dur(next.r.min)} 뒤</small></div></div>` : ''}
        ${wake.length ? `<div class="lf_ch">수면 · 기상</div><div class="lf_dcard">${wake.map(a => alarmRow(p, a)).join('')}</div>` : ''}
        ${other.length ? `<div class="lf_ch">기타</div><div class="lf_dcard">${other.map(a => alarmRow(p, a)).join('')}</div>` : ''}
        ${as.length ? '' : '<div class="lf_none">알람이 없어요</div>'}
        <i class="lf_pad"></i></div>
      ${clockDock('clock')}${axInd('#f2f2f4')}`;
}
export function alarmScreen(p, now, id) {
    const lf = L(p), a = lf?.clock.alarms.find(x => x.id === id);
    if (!a) return clockScreen(p, now);
    const m = toMin(a.time), h = Math.floor(m / 60), mi = m % 60, h12 = (h % 12) || 12;
    // when it was last switched off: the morning they woke, from health (a wake-up alarm on that day only)
    const today = (lf.health.days || []).find(d => d.date === now5(p).slice(0, 5));
    const off = a.wake && a.on && today?.wake ? `오늘 ${today.wake}` : '';
    return `${axBar(p, now, '#f2f2f4')}
      <div class="lf_sheet"><div class="lf_shh"><button type="button" data-go="clock">닫기</button><b>알람</b><span></span></div>
        <div class="lf_wheel"><div>${(h12 + 10) % 12 + 1}<b>${h12}</b>${h12 % 12 + 1}</div><div>${pad((mi + 59) % 60)}<b>${pad(mi)}</b>${pad((mi + 1) % 60)}</div><div>&nbsp;<b>${h < 12 ? 'AM' : 'PM'}</b>${h < 12 ? 'PM' : '&nbsp;'}</div></div>
        <div class="lf_days7">${['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'].map(d => `<span class="${a.days.includes(d) ? 'on' : ''}">${WDK[d]}</span>`).join('')}</div>
        <div class="lf_dcard lf_opts"><div><span>레이블</span><small>${esc(a.label || '알람')}</small></div><div><span>사운드</span><small>${esc(a.sound || '기본')} ›</small></div><div><span>다시 알림</span><small>${a.snooze ? `${a.snooze}분${a.snoozeCount ? ` · ${a.snoozeCount}번` : ''}` : '끔'}</small></div></div>
        ${a.ko && koOn() ? `<div class="lf_mini">${esc(a.ko)}</div>` : ''}
        <div class="lf_mini">${[a.made ? `만든 날 ${esc(fmtDate(p, a.made))}` : '', off ? `마지막으로 끈 시각 ${off}` : '', a.on ? '' : '꺼 둔 알람'].filter(Boolean).join(' · ')}</div></div>
      ${axInd('#f2f2f4')}`;
}
// the dial's minute ticks: the ones still to run bright, the ones gone dim
const ticks = frac => Array.from({ length: 60 }, (_, k) => { const a = k / 60 * 2 * Math.PI, r1 = k % 5 ? 99 : 95, x = v => (125 + v * Math.sin(a)).toFixed(1), y = v => (125 - v * Math.cos(a)).toFixed(1); return `<line x1="${x(r1)}" y1="${y(r1)}" x2="${x(104)}" y2="${y(104)}" stroke="${k / 60 < frac ? '#8b8f98' : '#34353b'}" stroke-width="${k % 5 ? 1.5 : 2.5}" stroke-linecap="round"/>`; }).join('');
export function timerScreen(p, now) {
    const lf = L(p);
    if (!lf) return lifeEmpty(p, now, '시계', 'life', 'home2', true);
    const r = lf.clock.running, ts = lf.clock.timers;
    // time left: what was left when the phone was filled, less the story time since
    let left = r ? r.left : 0;
    if (r && lf.at && now5(p) && lf.at.slice(0, 5) === now5(p).slice(0, 5)) left -= ((toMin(now5(p).slice(6)) ?? 0) - (toMin(lf.at.slice(6)) ?? 0)) * 60;
    left = Math.max(0, left);
    const C = 2 * Math.PI * 115, frac = r ? left / r.sec : 0, ring = r ? `${(toMin(now5(p).slice(6)) ?? 0) + Math.ceil(left / 60)}` : '';
    return `${axBar(p, now, '#f2f2f4')}
      ${axTop(axCb('home2'))}
      <div class="ax_scroll">${axH1('타이머')}
        ${r ? `<div class="lf_ring"><svg viewBox="0 0 250 250">${ticks(frac)}<circle cx="125" cy="125" r="115" fill="none" stroke="#2b2c31" stroke-width="6"/><circle cx="125" cy="125" r="115" fill="none" stroke="#f5a524" stroke-width="6" stroke-linecap="round" stroke-dasharray="${C.toFixed(1)}" stroke-dashoffset="${(C * (1 - frac)).toFixed(1)}" transform="rotate(-90 125 125)"/>${frac > 0 ? `<circle cx="${(125 + 115 * Math.sin(frac * 2 * Math.PI)).toFixed(1)}" cy="${(125 - 115 * Math.cos(frac * 2 * Math.PI)).toFixed(1)}" r="8" fill="#f5a524" stroke="#17181b" stroke-width="3"/>` : ''}</svg>
          <div>${left ? `<b class="cg_num lf_dig"><span>${pad(Math.floor(left / 60))}</span><i>:</i><em>${pad(left % 60)}</em></b>` : '<b class="lf_dig">끝</b>'}<span>${esc(r.label || '타이머')} · ${Math.round(r.sec / 60)}분</span></div></div>
          ${left ? `<div class="lf_tend">끝나는 시각 <b class="cg_num">${hm(Number(ring))}</b></div>` : ''}
          <div class="lf_tbtn2"><span>${ax('x', 15, 'currentColor', 2.6)}취소</span><span class="a">${left ? `${ax('pause', 15, 'currentColor', 2.6)}일시정지` : `${ax('play', 15, 'currentColor', 2, 'currentColor')}다시`}</span></div>` : ''}
        <div class="lf_ch">저장된 타이머</div>
        ${ts.length ? `<div class="lf_dcard lf_svl">${ts.map(t => `<div class="lf_sv"><b class="cg_num">${Math.floor(t.sec / 60)}:${pad(t.sec % 60)}</b><span class="lf_mq"><span>${esc(t.label)}${t.ko && koOn() ? ` <em>${esc(t.ko)}</em>` : ''}</span></span><small>${t.last ? esc(fmtDate(p, t.last, true)) : ''}</small><i>${ax('play', 13, '#f5a524', 2, '#f5a524')}</i></div>`).join('')}</div>` : '<div class="lf_none">저장된 타이머가 없어요</div>'}
        <i class="lf_pad"></i></div>
      ${clockDock('timer')}${axInd('#f2f2f4')}`;
}
// a city's offset from the place the story is in, from their time zones (Intl knows the rules; the year is a guess)
const zoneMin = (tz, at) => { try { const f = new Intl.DateTimeFormat('en-US', { timeZone: tz, hour12: false, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).formatToParts(at); const g = k => Number(f.find(x => x.type === k)?.value); return Math.round((Date.UTC(g('year'), g('month') - 1, g('day'), g('hour') % 24, g('minute')) - at.getTime()) / 6e4); } catch { return null; } };
const hereZone = lf => { const pl = String(lf.weather.here.place || '').toLowerCase(); return (lf.weather.cities.find(c => c.tz && pl && (pl.includes(c.name.toLowerCase()) || c.name.toLowerCase().includes(pl.split(/[ ,]/)[0]))) || lf.weather.cities.find(c => c.tz))?.tz || ''; };
function cityTime(p, lf, c) {
    const n = now5(p), x = md(n), at = x ? new Date(Date.UTC(YEAR, x.mo - 1, x.d, 12)) : new Date();
    const here = hereZone(lf), a = c.tz ? zoneMin(c.tz, at) : null, b = here ? zoneMin(here, at) : a;
    const off = a !== null && b !== null ? Math.round((a - b) / 60) : 0, t = toMin(n.slice(6)) ?? toMin(lf.weather.here.time) ?? 12 * 60;
    const local = t + off * 60, night = (() => { const ss = toMin(c.sunset) ?? 18 * 60, sr = toMin(c.sunrise) ?? 6 * 60 + 30; const l = ((local % 1440) + 1440) % 1440; return l >= ss || l < sr; })();
    return { off, time: hm(local), night, dayShift: local >= 1440 ? '내일' : local < 0 ? '어제' : '오늘' };
}
// the world map card: grid paper, the land, tonight's shadow (from the story's date and time), a pin per saved city
const geo = (lat, lon) => [((lon + 180) / 360 * MAP_W), ((MAP_TOP - lat) / (MAP_TOP - MAP_BOT) * MAP_H)];
const cityAt = (c, hereTz, off) => { const at = TZ_AT[c.tz] || TZ_AT[hereTz]; return at ? [at[0], at[1] + (TZ_AT[c.tz] ? 0 : off * 15)] : [45, Math.max(-170, Math.min(170, off * 15))]; };
function worldMap(p, lf, rows) {
    const here = hereZone(lf), cw = MAP_W / DOT_C, ch = MAP_H / DOT_R;
    // each saved city lights the dot it falls in (the place the story is in, amber)
    const lit = new Map();
    rows.forEach(({ c, t }, k) => { const [la, lo] = cityAt(c, here, t.off), [px, py] = geo(la, lo), key = `${Math.min(DOT_C - 1, Math.max(0, Math.floor(px / cw)))}:${Math.min(DOT_R - 1, Math.max(0, Math.floor(py / ch)))}`; if (!lit.has(key) || !k) lit.set(key, k ? 'c' : 'h'); });
    const dots = DOTS.flatMap((row, r) => [...row].map((v, c) => { const on = lit.get(`${c}:${r}`), x = ((c + 0.5) * cw).toFixed(2), y = ((r + 0.5) * ch).toFixed(2); return on ? `<circle cx="${x}" cy="${y}" r="2.3" class="${on}"/>${on === 'h' ? `<circle cx="${x}" cy="${y}" r="2.3" class="pulse"/>` : ''}` : v === '1' ? `<circle cx="${x}" cy="${y}" r="1.55"/>` : ''; })).join('');
    return `<div class="lf_wmap"><svg viewBox="0 0 ${MAP_W} ${MAP_H}" preserveAspectRatio="xMidYMid meet">
      <defs><pattern id="lfgrid" width="${cw}" height="${ch}" patternUnits="userSpaceOnUse"><path d="M${cw} 0V${ch}H0" fill="none" stroke="#26272c" stroke-width="0.5"/></pattern></defs>
      <rect width="${MAP_W}" height="${MAP_H}" fill="url(#lfgrid)"/><g class="lf_dots">${dots}</g></svg></div>`;
}
// a small analog clock: twelve ticks, hour and minute hands, a light face by day and a dark one at night. Once open it runs:
// the second hand goes round in a minute, the minute and hour hands creep at their real pace from the story's time
const face = (min, night) => { const h = (min % 720) / 720 * 360, m = (min % 60) * 6; return `<svg class="lf_dial ${night ? 'n' : 'd'}" viewBox="0 0 48 48"><circle cx="24" cy="24" r="23"/>${Array.from({ length: 12 }, (_, k) => { const a = k * 30 * Math.PI / 180, r1 = k % 3 ? 19.5 : 18; return `<line x1="${(24 + r1 * Math.sin(a)).toFixed(1)}" y1="${(24 - r1 * Math.cos(a)).toFixed(1)}" x2="${(24 + 21 * Math.sin(a)).toFixed(1)}" y2="${(24 - 21 * Math.cos(a)).toFixed(1)}" class="t${k % 3 ? '' : ' b'}"/>`; }).join('')}<g transform="rotate(${h.toFixed(1)} 24 24)"><line x1="24" y1="24" x2="24" y2="12.5" class="h run12"/></g><g transform="rotate(${m} 24 24)"><line x1="24" y1="24" x2="24" y2="7.5" class="m run60"/></g><line x1="24" y1="27" x2="24" y2="6" class="s"/><circle cx="24" cy="24" r="2.6" class="c"/></svg>`; };
export function worldScreen(p, now) {
    const lf = L(p);
    if (!lf) return lifeEmpty(p, now, '시계', 'life', 'home2', true);
    const here = { name: lf.weather.here.place || '현재 위치', tz: hereZone(lf), sunset: lf.weather.here.tiles?.sunset || '', note: '' };
    const rows = [here, ...lf.weather.cities.filter(c => c.name !== here.name)].map(c => ({ c, t: cityTime(p, lf, c) }));
    return `${axBar(p, now, '#f2f2f4')}
      ${axTop(axCb('home2'))}
      <div class="ax_scroll">${axH1('세계 시계')}
        ${worldMap(p, lf, rows)}
        <div class="lf_dcard">${rows.map(({ c, t }, k) => `<div class="lf_wc">${face(toMin(t.time), t.night)}<span class="lf_wct"><small>${k ? `${t.dayShift}, ${t.off >= 0 ? '+' : '−'}${Math.abs(t.off)}시간` : '현재 위치'}${c.note ? ` · ${esc(c.note)}` : ''}</small><b>${esc(c.name)}</b></span><b class="cg_num">${t.time}</b></div>`).join('')}</div>
        <i class="lf_pad"></i></div>
      ${clockDock('wclock')}${axInd('#f2f2f4')}`;
}

// ================= 건강 =================
const lastDays = (lf, n = 7, until = '') => { const ds = lf.health.days.filter(d => !until || d.date <= until); return ds.slice(-n); };
const sleepMin = d => { const a = toMin(d.sleep), b = toMin(d.wake); return a === null || b === null ? null : ((b - a) + 1440) % 1440; };
const avg = xs => { const v = xs.filter(x => x !== null && x !== undefined && Number.isFinite(x)); return v.length ? v.reduce((s, x) => s + x, 0) / v.length : null; };
// bedtimes past midnight count as late (00:30 is later than 23:30)
const lateMin = t => { const m = toMin(t); return m === null ? null : m < 12 * 60 ? m + 1440 : m; };
const bars = (vals, max, hi, color) => `<div class="lf_mini2">${vals.map((v, k) => `<i style="height: ${Math.max(6, Math.round((v || 0) / (max || 1) * 100))}%; background: ${k === hi ? color : '#eceef2'}"></i>`).join('')}</div>`;
const hdays = (lf, pick) => `<div class="lf_hdays">${lf.health.days.slice(-7).map(d => `<button type="button" data-go="health" data-i="${d.date}" class="${d.date === pick ? 'on' : ''}">${WDK[WD[weekday(d.date)]]}<b>${Number(d.date.slice(3))}</b></button>`).join('')}</div>`;
export function healthScreen(p, now, pick = '') {
    const lf = L(p);
    if (!lf) return lifeEmpty(p, now, '건강', 'life');
    const ds = lf.health.days, d = ds.find(x => x.date === pick) || ds.at(-1), u = lf.health.usual || {};
    if (!d) return `${axBar(p, now)}${axTop(axCb('home2'))}<div class="ax_scroll">${axH1('건강')}<div class="lf_none">기록이 없어요</div></div>${axInd()}`;
    const wk = lastDays(lf, 7, d.date), i = wk.indexOf(d), sm = sleepMin(d), lastRun = [...ds].reverse().find(x => x.workout && x.date <= d.date);
    return `${axBar(p, now)}
      ${axTop(axCb('home2'), '<button type="button" class="lf_pill hl" data-go="hcmp">평소와 비교</button>')}
      <div class="ax_scroll">${axH1('요약', `${fmtDate(p, d.date)}`)}
        ${hdays(lf, d.date)}
        <button type="button" class="lf_hc" data-go="hsteps" data-i="${d.date}"><span class="lf_hl" style="color: #f08a3c">${ax('walk', 15, '#f08a3c', 2.2)}걸음<small>${u.steps ? `평소 ${n0(u.steps)}` : ''}</small></span>
          <span class="lf_hr"><span><b class="cg_num">${n0(d.steps)}</b>걸음${d.km ? ` · ${String(d.km).replace('.', ',')} km` : ''}</span>${bars(wk.map(x => x.steps), Math.max(...wk.map(x => x.steps || 0)), i, '#f08a3c')}</span></button>
        <button type="button" class="lf_hc" data-go="hsleep" data-i="${d.date}"><span class="lf_hl" style="color: #6c63d9">${ax('moon', 15, '#6c63d9', 2.2)}수면<small>${d.wake ? `${d.wake} 깸` : ''}</small></span>
          <span class="lf_hr"><span>${sm === null ? '—' : `<b class="cg_num">${Math.floor(sm / 60)}</b>시간 <b class="cg_num">${sm % 60}</b>분`}</span>${bars(wk.map(sleepMin), Math.max(...wk.map(x => sleepMin(x) || 0)), i, '#6c63d9')}</span></button>
        <div class="lf_hc"><span class="lf_hl" style="color: #2fa36b">${ax('run', 15, '#2fa36b', 2.2)}운동<small>${lastRun && lastRun !== d ? `마지막 ${esc(fmtDate(p, lastRun.date, true))}` : ''}</small></span>
          <span class="lf_hr"><span>${d.workout ? `<b class="cg_num">${d.workout.min ?? '—'}</b>분 · ${esc(d.workout.kind)}${d.workout.km ? ` ${String(d.workout.km).replace('.', ',')} km` : ''}${d.workout.time ? ` · ${d.workout.time}` : ''}` : '<b class="cg_num">0</b>분'}</span></span></div>
        ${d.hr?.length === 2 ? `<div class="lf_hc"><span class="lf_hl" style="color: #e0405f">${ax('heartF', 15, '#e0405f', 2.2, '#e0405f')}심박수<small>${u.rest ? `안정 시 평소 ${u.rest}` : ''}</small></span>
          <span class="lf_hr"><span><b class="cg_num">${d.hr[0]}–${d.hr[1]}</b>BPM</span>${hrLine()}</span></div>` : ''}
        <i class="lf_pad"></i></div>
      ${axInd()}`;
}
// a heart-rate line drawn from the day's low and high (a rough day curve: low at night, the high where it moved most)
const hrLine = () => { const pts = [0.2, 0.15, 0.25, 0.6, 0.4, 1, 0.5, 0.35, 0.3].map((f, k) => `${4 + k * 13},${32 - f * 26}`); return `<svg width="112" height="36"><polyline points="${pts.join(' ')}" fill="none" stroke="#e0405f" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`; };
export function stepsScreen(p, now, day) {
    const lf = L(p); if (!lf) return healthScreen(p, now);
    const wk = lastDays(lf, 7, day || ''), d = wk.find(x => x.date === day) || wk.at(-1), u = lf.health.usual || {};
    const max = Math.max(10000, ...wk.map(x => x.steps || 0), u.steps || 0), top = Math.ceil(max / 5000) * 5000, a = avg(wk.map(x => x.steps));
    return `${axBar(p, now)}${axTop(axCb(`health:${d?.date || ''}`))}
      <div class="ax_scroll">${axH1('걸음')}
        <div class="lf_seg"><span>일</span><span class="on">주</span><span>월</span><span>6개월</span></div>
        <div class="lf_big"><small>평균</small><b class="cg_num">${n0(a === null ? null : Math.round(a))} <span>걸음</span></b><em>${wk.length ? `${esc(fmtDate(p, wk[0].date, true))} – ${esc(fmtDate(p, wk.at(-1).date, true))}` : ''}</em></div>
        <div class="lf_hc lf_chart" style="--k: #f08a3c"><div class="lf_ch2">${[1, 0.5].map(f => `<span class="g" style="bottom: ${f * 100}%"></span><span class="ax2" style="bottom: ${f * 100}%">${n0(top * f)}</span>`).join('')}
          ${u.steps ? `<span class="av" style="bottom: ${u.steps / top * 100}%"><span>평소 ${n0(u.steps)}</span></span>` : ''}
          ${wk.map(x => `<i class="${x === d ? 'on' : ''}" style="height: ${Math.max(2, (x.steps || 0) / top * 100)}%"></i>`).join('')}</div>
          <div class="lf_xl">${wk.map(x => `<span class="${x === d ? 'on' : ''}">${WDK[WD[weekday(x.date)]]}</span>`).join('')}</div></div>
        ${d ? `<div class="lf_hc lf_rows"><div><span>${esc(fmtDate(p, d.date, true))}</span><b class="cg_num">${n0(d.steps)}걸음</b></div><div><span>거리</span><b class="cg_num">${d.km ? `${String(d.km).replace('.', ',')} km` : '—'}</b></div><div><span>오른 층수</span><b class="cg_num">${d.floors ?? '—'}층</b></div></div>` : ''}
        <i class="lf_pad"></i></div>${axInd()}`;
}
// sleep stages: drawn from when they fell asleep and woke and how often they woke (seeded by the date, so it stays put)
function stages(d) {
    const s = toMin(d.sleep), total = sleepMin(d);
    if (s === null || !total) return [];
    let seed = [...d.date].reduce((n, ch) => n * 31 + ch.charCodeAt(0), 7);
    const rnd = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
    const out = [], wakes = new Set(Array.from({ length: d.woke || 0 }, (_, k) => Math.floor((k + 1) * total / ((d.woke || 0) + 1))));
    let t = 0;
    while (t < total) {
        const cyc = t / total, lvl = rnd() < (cyc < 0.4 ? 0.35 : 0.12) ? 'deep' : rnd() < (cyc > 0.5 ? 0.45 : 0.2) ? 'rem' : 'core';
        const len = Math.min(total - t, Math.round(12 + rnd() * 30));
        const w = [...wakes].find(x => x >= t && x < t + len);
        if (w !== undefined) { if (w > t) out.push({ lvl, a: t, b: w }); out.push({ lvl: 'awake', a: w, b: Math.min(total, w + 5) }); wakes.delete(w); t = Math.min(total, w + 5); continue; }
        out.push({ lvl, a: t, b: t + len }); t += len;
    }
    return out.map(x => ({ ...x, s }));
}
const ST = { awake: ['깸', '#f2994a', 0], rem: ['렘', '#58c8f0', 1], core: ['코어', '#5a8ff0', 2], deep: ['깊은', '#3a3fb0', 3] };
export function sleepScreen(p, now, day) {
    const lf = L(p); if (!lf) return healthScreen(p, now);
    const d = lf.health.days.find(x => x.date === day) || lf.health.days.at(-1), u = lf.health.usual || {};
    if (!d) return healthScreen(p, now);
    const total = sleepMin(d), st = stages(d), sum = k => st.filter(x => x.lvl === k).reduce((n, x) => n + x.b - x.a, 0);
    return `${axBar(p, now)}${axTop(axCb(`health:${d.date}`))}
      <div class="ax_scroll">${axH1('수면')}
        <div class="lf_seg"><span class="on">일</span><span>주</span><span>월</span><span>6개월</span></div>
        <div class="lf_big"><small>수면 시간</small><b class="cg_num">${total === null ? '—' : durBig(total)}</b><em>${esc(fmtDate(p, d.date))} ${d.sleep || ''} – ${d.wake || ''}</em></div>
        <div class="lf_hc"><div class="lf_hyp">${Object.values(ST).map(([n, , y]) => `<span class="lv" style="top: ${4 + y * 36}px">${n}</span>`).join('')}
          ${st.map(x => `<span class="bk" style="left: calc(40px + (100% - 40px) * ${(x.a / total).toFixed(3)}); width: calc((100% - 40px) * ${((x.b - x.a) / total).toFixed(3)}); top: ${2 + ST[x.lvl][2] * 36}px; background: ${ST[x.lvl][1]}"></span>`).join('')}</div>
          <div class="lf_xl" style="padding-left: 40px">${[0, 1, 2, 3].map(k => `<span>${hm((toMin(d.sleep) ?? 0) + Math.round((total || 0) * k / 3))}</span>`).join('')}</div>
          <div class="lf_leg">${Object.entries(ST).map(([k, [n, c]]) => `<span><i style="background: ${c}"></i>${n} ${k === 'awake' ? `${d.woke || 0}번 · ` : ''}${dur(sum(k))}</span>`).join('')}</div></div>
        <div class="lf_hc lf_rows"><div><span>침대에 누운 시간</span><b class="cg_num">${d.bed || '—'}</b></div>${u.sleep ? `<div><span>평소 잠든 시각</span><b class="cg_num">${u.sleep}</b></div>` : ''}</div>
        <i class="lf_pad"></i></div>${axInd()}`;
}
// usual vs the last 7 days: a sentence only for what the numbers say (more, less, later, stopped, about the same)
export function compareScreen(p, now) {
    const lf = L(p); if (!lf) return healthScreen(p, now);
    const u = lf.health.usual || {}, wk = lastDays(lf, 7), rows = [];
    const st = avg(wk.map(x => x.steps)), sl = avg(wk.map(sleepMin)), bed = avg(wk.map(x => lateMin(x.sleep))), runs = wk.filter(x => x.workout).length, last = [...lf.health.days].reverse().find(x => x.workout);
    const usualSleep = u.sleep && u.wake ? ((toMin(u.wake) - toMin(u.sleep)) + 1440) % 1440 : null;
    const row = (dir, color, bg, title, sub) => rows.push(`<div class="lf_hc lf_tr"><span style="background: ${bg}">${ax(dir, 18, color, 2.4)}</span><div><b>${title}</b><small>${sub}</small></div></div>`);
    if (st !== null && u.steps) { const r = st / u.steps; row(r > 1.15 ? 'up' : r < 0.85 ? 'down' : 'eq', r > 1.15 || r < 0.85 ? '#f08a3c' : '#8a929d', r > 1.15 || r < 0.85 ? '#fdebdc' : '#f1f2f4', r > 1.15 ? '걸음이 평소보다 많아요' : r < 0.85 ? '걸음이 평소보다 적어요' : '걸음은 평소와 비슷해요', `${n0(Math.round(st))} · 평소 ${n0(u.steps)}`); }
    if (sl !== null && usualSleep) { const df = sl - usualSleep; row(df > 30 ? 'up' : df < -30 ? 'down' : 'eq', Math.abs(df) > 30 ? '#6c63d9' : '#8a929d', Math.abs(df) > 30 ? '#e6e4fb' : '#f1f2f4', df > 30 ? '수면이 평소보다 길어요' : df < -30 ? '수면이 평소보다 짧아요' : '수면은 평소와 비슷해요', `${dur(Math.round(sl))} · 평소 ${dur(usualSleep)}`); }
    if (bed !== null && u.sleep) { const df = bed - lateMin(u.sleep); if (Math.abs(df) > 40) row(df > 0 ? 'down' : 'up', '#6c63d9', '#e6e4fb', df > 0 ? '잠드는 시각이 늦어요' : '잠드는 시각이 빨라요', `${hm(Math.round(bed))} · 평소 ${u.sleep}`); }
    if (u.workouts) row(runs ? 'eq' : 'down', runs ? '#8a929d' : '#2fa36b', runs ? '#f1f2f4' : '#dff3e8', runs ? `운동은 이번 주 ${runs}회예요` : '운동이 끊겼어요', `이번 주 ${runs}회 · 평소 주 ${u.workouts}회${last ? ` · 마지막 ${esc(fmtDate(p, last.date, true))}` : ''}`);
    const rest = avg(wk.map(x => x.hr?.[0]));
    if (rest !== null && u.rest) row(Math.abs(rest - u.rest) > 6 ? (rest > u.rest ? 'up' : 'down') : 'eq', '#e0405f', Math.abs(rest - u.rest) > 6 ? '#fbe3e8' : '#f1f2f4', Math.abs(rest - u.rest) > 6 ? (rest > u.rest ? '안정 시 심박이 평소보다 높아요' : '안정 시 심박이 평소보다 낮아요') : '심박수는 평소와 비슷해요', `${Math.round(rest)} · 평소 ${u.rest}`);
    return `${axBar(p, now)}${axTop(axCb('health'))}
      <div class="ax_scroll">${axH1('평소와 비교')}<div class="lf_sub">최근 7일 평균 · 평소</div>
        ${rows.join('') || '<div class="lf_none">비교할 기록이 없어요</div>'}<i class="lf_pad"></i></div>${axInd()}`;
}

// ================= 파일 =================
const FK = { pdf: ['PDF', '#d64545'], image: ['JPG', '#c98a2e'], video: ['MP4', '#3a3f4a'], audio: ['M4A', '#8a5a2e'], zip: ['ZIP', '#7b8290'], doc: ['DOCX', '#2f6fbf'], sheet: ['XLSX', '#2b7a4b'], slides: ['PPTX', '#c2562b'], other: ['FILE', '#8a929d'] };
const ext = f => (String(f.name).match(/\.([a-z0-9]{2,4})$/i)?.[1] || FK[f.kind][0]).toUpperCase();
const fico = (f, s = '') => `<span class="lf_fico ${s}" style="background: ${FK[f.kind][1]}">${esc(ext(f))}</span>`;
const size = kb => (kb === null || kb === undefined ? '' : kb >= 1024 * 1024 ? `${(kb / 1048576).toFixed(1)} GB` : kb >= 1024 ? `${(kb / 1024).toFixed(1)} MB` : `${Math.round(kb)} KB`).replace('.', ',');
const live = lf => lf.files.items.filter(f => !f.trashed);
const thumb = (p, f) => f.private ? `<span class="lf_th lf_thp">${ax('eyeoff', 26, '#9aa0a8', 2)}</span>`
    : f.kind === 'image' ? `<span class="lf_th" style="background: ${axTint(f.name)}"><i class="lf_hill"></i><i class="lf_sunb"></i></span>`
    : f.kind === 'pdf' || f.kind === 'doc' ? `<span class="lf_th"><span class="lf_doc"><i class="h"></i><i></i><i></i><i style="width: 70%"></i><em style="background: ${FK[f.kind][1]}">${esc(ext(f))}</em></span></span>`
    : f.kind === 'video' ? `<span class="lf_th" style="background: #3a3f4a">${ax('play', 26, '#fff', 2, '#fff')}</span>` : `<span class="lf_th">${fico(f)}</span>`;
const fileRow = (p, f) => `<button type="button" class="lf_fr" data-go="file" data-i="${f.id}">${fico(f, 's')}<span class="lf_tx"><b>${esc(f.name)}</b><small>${esc(fmtDate(p, f.time, true))}${size(f.size) ? ` · ${size(f.size)}` : ''}${f.trashed ? ' · 휴지통' : ''}</small></span>${f.tag ? `<i class="lf_tagd" style="background: ${f.tag === 'red' ? '#d64545' : '#e8a317'}"></i>` : ''}</button>`;
export function filesScreen(p, now) {
    const lf = L(p);
    if (!lf) return lifeEmpty(p, now, '파일', 'life');
    const fs = live(lf), recent = [...fs].filter(f => f.opened).sort((a, b) => b.opened.localeCompare(a.opened)).slice(0, 6), dl = fs.filter(f => f.folder === 'Downloads').length, trash = lf.files.items.filter(f => f.trashed).length, cl = lf.files.cloud || {};
    const favs = lf.files.folders.filter(x => x.fav), others = lf.files.folders.filter(x => !x.fav);
    const fold = x => `<button type="button" class="lf_rw" data-go="folder" data-i="${encodeURIComponent(x.name)}">${ax('folder', 22, '#2f6fbf', 2, '#dfeaf8')}<span class="lf_tx"><b>${esc(x.name)}</b>${x.ko && koOn() ? `<small>${esc(x.ko)}</small>` : ''}</span><small>${x.count}</small>${ax('chev', 14, '#b7bdc6', 2.4)}</button>`;
    return `${axBar(p, now)}${axTop(axCb('home2'), axKp(p))}
      <div class="ax_scroll">${axH1('파일')}
        ${recent.length ? `<div class="lf_sec">최근</div><div class="lf_rec">${recent.map(f => `<button type="button" data-go="file" data-i="${f.id}">${thumb(p, f)}<b>${esc(f.name)}</b><small>${esc(fmtDate(p, f.opened, true))} · ${esc(f.folder === 'Downloads' ? '다운로드' : f.folder)}</small></button>`).join('')}</div>` : ''}
        <div class="lf_sec">위치</div>
        <div class="lf_card">
          <button type="button" class="lf_rw" data-go="folder" data-i="">${ax('phoneS', 22, '#2f6fbf')}<span class="lf_tx"><b>내 폰</b></span><small>${fs.length}</small>${ax('chev', 14, '#b7bdc6', 2.4)}</button>
          ${cl.total ? `<div class="lf_rw">${ax('cloudF', 22, '#2f6fbf')}<span class="lf_tx"><b>클라우드</b><small>${String(cl.used ?? '?').replace('.', ',')} GB / ${String(cl.total).replace('.', ',')} GB</small></span></div>` : ''}
          <button type="button" class="lf_rw" data-go="folder" data-i="Downloads">${ax('dl', 22, '#2f6fbf')}<span class="lf_tx"><b>다운로드</b></span><small>${dl}</small>${ax('chev', 14, '#b7bdc6', 2.4)}</button>
          <button type="button" class="lf_rw" data-go="folder" data-i="~trash">${ax('trash', 21, '#2f6fbf')}<span class="lf_tx"><b>최근 삭제</b></span><small>${trash}</small>${ax('chev', 14, '#b7bdc6', 2.4)}</button></div>
        ${favs.length ? `<div class="lf_sec">즐겨찾기</div><div class="lf_card">${favs.map(fold).join('')}</div>` : ''}
        ${others.length ? `<div class="lf_sec">폴더</div><div class="lf_card">${others.map(fold).join('')}</div>` : ''}
        <i class="lf_pad"></i></div>${axInd()}`;
}
export function folderScreen(p, now, key) {
    const lf = L(p); if (!lf) return filesScreen(p, now);
    const name = decodeURIComponent(key || ''), trash = name === '~trash';
    const fs = (trash ? lf.files.items.filter(f => f.trashed) : live(lf).filter(f => !name || f.folder === name)).sort((a, b) => String(b.time).localeCompare(String(a.time)));
    const title = trash ? '최근 삭제' : !name ? '내 폰' : name === 'Downloads' ? '다운로드' : name, fo = lf.files.folders.find(x => x.name === name);
    const grid = fs.some(f => f.kind === 'image' || f.kind === 'video') && !trash && name !== 'Downloads';
    return `${axBar(p, now)}${axTop(axCb('files'))}
      <div class="ax_scroll">${axH1(title, `${Math.max(fs.length, fo?.count || 0)}개`)}
        ${trash ? '<div class="lf_sub">30일이 지나면 완전히 지워져요</div>' : ''}
        ${fs.length ? grid ? `<div class="lf_grid">${fs.map(f => `<button type="button" data-go="file" data-i="${f.id}">${thumb(p, f)}<b>${esc(f.name.replace(/\.[a-z0-9]{2,4}$/i, ''))}</b><small>${esc([f.length, size(f.size)].filter(Boolean).join(' · '))}</small></button>`).join('')}</div>`
            : `<div class="lf_card">${fs.map(f => fileRow(p, f)).join('')}</div>` : '<div class="lf_none">파일이 없어요</div>'}
        ${fo && fo.count > fs.length ? `<div class="lf_sub">그 밖에 ${fo.count - fs.length}개</div>` : ''}
        <i class="lf_pad"></i></div>${axInd()}`;
}
// a ticket or booking file: its first page drawn from the record with the same story event (no text from the model)
function ticketPage(p, f) {
    const t = (p.money?.passes || []).find(x => f.ev && x.ev === f.ev);
    if (!t) return '';
    const code = s => esc(String(s || '').slice(0, 3).toUpperCase()), bc = [...String(t.no || t.by || f.name)].map((c, k) => `<rect x="${k * 9}" y="0" width="${1 + c.charCodeAt(0) % 3}" height="40"/><rect x="${k * 9 + 4}" y="0" width="${1 + (c.charCodeAt(0) >> 2) % 3}" height="40"/>`).join('');
    return `<div class="lf_pv"><div class="lf_bph"><b>${esc(String(t.by || '').toUpperCase())}</b><span>${t.kind === 'hotel' ? 'BOOKING' : 'BOARDING PASS'}</span></div>
      <div class="lf_bp"><div class="h"><span>${esc(String(p.owner).toUpperCase())}</span><span>${esc(t.no || '')}</span></div>
        <div class="r"><div><small>${esc(t.from || '')}</small><b>${code(t.from)}</b></div><span>${ax(t.kind === 'train' ? 'arrR' : 'nav', 18, '#8a929d', 2)}</span><div style="text-align: right"><small>${esc(t.to || '')}</small><b>${code(t.to)}</b></div></div>
        <div class="g"><div>DATE<b>${esc(fmtDate(p, t.date, true))}</b></div><div>TIME<b>${esc(t.time || '—')}</b></div><div>GATE<b>${esc(t.gate || '—')}</b></div><div>SEAT<b>${esc(t.seat || '—')}</b></div></div>
        <svg class="bc" viewBox="0 0 ${String(t.no || t.by || f.name).length * 9} 40" preserveAspectRatio="none">${bc}</svg></div>
      <div class="lf_lines"><i style="width: 92%"></i><i style="width: 74%"></i><i style="width: 84%"></i></div></div>`;
}
export function fileScreen(p, now, id) {
    const lf = L(p), f = lf?.files.items.find(x => x.id === id);
    if (!f) return filesScreen(p, now);
    const page = f.private ? '' : ticketPage(p, f);
    const body = f.private ? `<div class="lf_lock">${ax('eyeoff', 30, '#8a929d', 2)}<span>미리보기 없음</span><small>${esc([FK[f.kind][0], f.length].filter(Boolean).join(' · '))}</small></div>`
        : page || (f.kind === 'image' ? `<div class="lf_pvimg">${thumb(p, f)}</div>` : f.kind === 'audio' ? `<div class="lf_pvaud"><div class="lf_aud"><span class="pl">${ax('play', 22, '#fff', 2, '#fff')}</span><div class="lf_wave">${Array.from({ length: 34 }, (_, k) => `<i style="height: ${Math.round(22 + 60 * Math.abs(Math.sin((k + f.name.length) * 0.55)) * (0.55 + 0.45 * Math.abs(Math.sin(k * 0.21))))}%"></i>`).join('')}</div></div><div class="lf_audt cg_num"><span>0:00</span><span>${esc(f.length ? `−${f.length}` : '')}</span></div></div>`
        : `<div class="lf_pv"><div class="lf_doc2"><i class="h" style="background: ${FK[f.kind][1]}"></i>${f.preview ? `<p>${esc(f.preview)}${k1(f.ko)}</p>` : ''}<div class="lf_lines"><i style="width: 92%"></i><i style="width: 80%"></i><i style="width: 86%"></i><i style="width: 60%"></i></div></div></div>`);
    return `${axBar(p, now)}
      <div class="ax_top">${axCb(f.trashed ? 'folder:~trash' : `folder:${encodeURIComponent(f.folder)}`)}<span class="lf_ttl">${esc(f.name)}</span><span class="ax_topr">${axKp(p)}</span></div>
      <div class="ax_scroll">${body}
        <div class="lf_sub" style="text-align: center">${esc([f.pages ? `${f.pages}쪽` : '', FK[f.kind][0], size(f.size)].filter(Boolean).join(' · '))}</div>
        <div class="lf_card lf_rows"><div><span>위치</span><b>${esc(f.trashed ? '최근 삭제' : f.folder === 'Downloads' ? '다운로드' : f.folder)}</b></div>${f.from ? `<div><span>받은 곳</span><b>${esc(f.from)}</b></div>` : ''}<div><span>만든 날</span><b class="cg_num">${esc(fmtDate(p, f.time))} ${esc(String(f.time).slice(6))}</b></div>${f.opened ? `<div><span>마지막으로 연 날</span><b class="cg_num">${esc(fmtDate(p, f.opened, true))}</b></div>` : ''}</div>
        <i class="lf_pad"></i></div>${axInd()}`;
}

// ================= 날씨 =================
// what each sky is called; the colours come from pal() below
const WX = { clear: '맑음', partly: '구름 조금', cloudy: '흐림', drizzle: '이슬비', rain: '비', sleet: '진눈깨비', snow: '눈', fog: '안개', storm: '뇌우', wind: '강풍' };
// the part of the day a sky is drawn for: dawn and evening are the hour around sunrise and sunset
function phaseOf(time, sunrise, sunset) {
    const t = toMin(time), sr = toMin(sunrise) ?? 6 * 60 + 30, ss = toMin(sunset) ?? 18 * 60;
    if (t === null) return 'day';
    if (t >= sr - 45 && t <= sr + 45) return 'dawn';
    if (t >= ss - 50 && t <= ss + 30) return 'eve';
    return t > ss + 30 || t < sr - 45 ? 'night' : 'day';
}
const WET = { drizzle: 1, rain: 1, sleet: 1 };
// one palette per sky and part of the day: flat layers only (sky, bands, three hills, clouds), no gradients
function pal(cond, phase) {
    const D = {
        clear: { sky: '#4f8fd8', hills: ['#3f78bd', '#3569a6', '#2d5b92'], sun: 'day', puff: '#6ca1de' },
        partly: { sky: '#5b93cf', hills: ['#4a80bb', '#3f72a9', '#356496'], sun: 'day', front: '#e9f0f8', cloud: '#84aedb' },
        cloudy: { sky: '#6b7f9c', hills: ['#62758f', '#566881', '#4b5c73'], cloud: '#7b8ea9', cloud2: '#8a9cb5' },
        drizzle: { sky: '#6f7f92', hills: ['#62717f', '#566472', '#4b5866'], cloud: '#7b8b9d', fall: 'drizzle' },
        rain: { sky: '#5f7186', hills: ['#56687c', '#4a5b6e', '#3f4f61'], cloud: '#6b7d92', fall: 'rain' },
        sleet: { sky: '#7889a0', hills: ['#6a7a8f', '#5e6d81', '#536174'], cloud: '#8596ab', fall: 'sleet' },
        snow: { sky: '#8aa0b8', hills: ['#e6edf4', '#d5dfea', '#c3cfdd'], cloud: '#97abc1', fall: 'snow' },
        fog: { sky: '#8b929a', hills: ['#7f878f', '#757d86', '#6b737c'], fog: 'rgba(255, 255, 255, 0.22)' },
        storm: { sky: '#3e4656', hills: ['#343b49', '#2b313d', '#232833'], cloud: '#4b5466', fall: 'heavy', bolt: true },
        wind: { sky: '#6b8bb0', hills: ['#58799f', '#4b6a8f', '#3f5c7f'], cloud: '#899fc0', wind: true },
    };
    const NIGHT = ['#222b40', '#1c2436', '#161d2c'];
    if (cond === 'storm') return { ...D.storm, phase: 'day' };
    if (phase === 'night') {
        if (cond === 'clear' || cond === 'wind') return { sky: '#28324a', hills: NIGHT, moon: true, stars: 34, wind: cond === 'wind', phase };
        if (cond === 'partly' || cond === 'cloudy') return { sky: '#28324a', hills: NIGHT, moon: true, stars: 16, cloud: '#333d55', phase };
        if (WET[cond]) return { sky: '#2c3446', hills: ['#232a3a', '#1d2331', '#171c28'], cloud: '#363f53', fall: D[cond].fall, phase };
        if (cond === 'snow') return { sky: '#2f3a52', hills: ['#c5cfdc', '#aab6c6', '#919fb2'], cloud: '#3a4660', fall: 'snow', phase };
        return { sky: '#3b414b', hills: ['#343a43', '#2e333b', '#282c33'], fog: 'rgba(255, 255, 255, 0.12)', phase };
    }
    // snow at dawn and dusk: the low sun tints the snow on the hills
    if (phase === 'dawn' && cond === 'snow') return { sky: '#8f97b8', bands: [[175, '#a6a6c4'], [225, '#c4b2c4']], cb: [[56, '#a6a6c4'], [76, '#c4b2c4']], hills: ['#efe6ee', '#ddd2e0', '#cbbfd2'], cloud: '#9ca3c2', fall: 'snow', phase };
    if (phase === 'eve' && cond === 'snow') return { sky: '#b07a74', bands: [[165, '#c08a7e'], [220, '#d39f8c']], cb: [[50, '#c08a7e'], [74, '#d39f8c']], hills: ['#f3e3dc', '#e2cfc8', '#cfbab4'], cloud: '#a8726f', fall: 'snow', phase };
    if (phase === 'dawn' && cond !== 'fog') {
        if (cond === 'clear' || cond === 'partly' || cond === 'wind') return { sky: '#7484b3', bands: [[150, '#9a99c2'], [195, '#c9a9c0'], [235, '#eebda6']], cb: [[52, '#9a99c2'], [68, '#c9a9c0'], [80, '#eebda6']], hills: ['#8d7fa6', '#6f6390', '#5a5079'], sun: 'rise', stars: 12, cloud: cond === 'partly' ? '#9aa2c6' : '', phase };
        return { sky: '#7c86a8', bands: [[175, '#9796b4'], [225, '#b59fb4']], cb: [[56, '#9796b4'], [76, '#b59fb4']], hills: cond === 'snow' ? D.snow.hills : ['#7c7298', '#665c84', '#554b72'], cloud: '#8a92b2', fall: D[cond].fall, phase };
    }
    if (phase === 'eve' && cond !== 'fog') {
        if (cond === 'clear' || cond === 'partly' || cond === 'wind') return { sky: '#c8664f', bands: [[120, '#dc7c52'], [180, '#ec9a5c'], [230, '#f5bd6e']], cb: [[40, '#dc7c52'], [62, '#ec9a5c'], [78, '#f5bd6e']], hills: ['#7a4a5e', '#5d3a50', '#4a2e42'], sun: 'sink', puff: '#d98b78', cloud: cond === 'partly' ? '#d98b78' : '', phase };
        return { sky: '#a8605a', bands: [[165, '#b9715f'], [220, '#c98466']], cb: [[50, '#b9715f'], [74, '#c98466']], hills: cond === 'snow' ? D.snow.hills : ['#6a4152', '#523446', '#43293a'], cloud: '#9a5d5e', fall: D[cond].fall, phase };
    }
    return { ...D[cond] || D.cloudy, phase: 'day' };
}
// cards and tiles sit on the sky in one flat colour: a shade darker, or a shade lighter on a night sky
const shade = (hex, f) => { const n = parseInt(hex.slice(1), 16), c = [n >> 16, (n >> 8) & 255, n & 255]; const lum = (c[0] * 0.3 + c[1] * 0.59 + c[2] * 0.11) / 255; return `#${c.map(v => Math.round(lum < 0.25 ? v + (255 - v) * (1 - f) * 0.5 : v * f).toString(16).padStart(2, '0')).join('')}`; };
// a fixed scatter per sky, so it doesn't jump between renders
const rnd = seed => { let s = seed; return () => (s = (s * 9301 + 49297) % 233280) / 233280; };
const puffSvg = (x, y, w, col, dx, d, op = 1) => `<svg class="cl" style="left: ${x}px; top: ${y}px; width: ${w}px; height: ${w / 2}px; --x: ${dx}px; --d: ${d}s${op < 1 ? `; opacity: ${op}` : ''}" viewBox="0 0 200 100"><g fill="${col}"><circle cx="60" cy="58" r="34"/><circle cx="104" cy="42" r="42"/><circle cx="148" cy="62" r="30"/><rect x="26" y="58" width="152" height="40" rx="20"/></g></svg>`;
// the whole sky behind a weather screen: it moves (clouds drift, rain and snow fall, lightning, stars, the sun at dawn and dusk), and stands still with reduced motion
function scene(cond, phase) {
    const q = pal(cond, phase), r = rnd(cond.length * 31 + phase.length * 7), out = [];
    for (const [y, c] of q.bands || []) out.push(`<i class="bd" style="top: ${y}px; background: ${c}"></i>`);
    if (q.stars) out.push(Array.from({ length: q.stars }, () => `<i class="st${phase === 'dawn' ? ' fd' : ''}" style="left: ${Math.round(10 + r() * 370)}px; top: ${Math.round(60 + r() * 360)}px; --d: ${(2 + r() * 3).toFixed(1)}s; --dl: -${(r() * 4).toFixed(1)}s"></i>`).join(''));
    const sun = (x, y, rad, core, halo, cls = '') => `<span class="sun ${cls}" style="left: ${x - rad * 2.4}px; top: ${y - rad * 2.4}px; width: ${rad * 4.8}px; height: ${rad * 4.8}px"><b style="background: ${halo}"></b><b class="h2" style="background: ${halo}"></b><i style="background: ${core}; width: ${rad * 2}px; height: ${rad * 2}px"></i></span>`;
    if (q.sun === 'day') out.push(cond === 'partly' ? sun(320, 190, 42, '#f6c94a', 'rgba(255, 255, 255, 0.14)') : sun(330, 210, 46, '#f6c94a', 'rgba(255, 255, 255, 0.14)'));
    if (q.sun === 'rise') out.push(sun(312, 262, 40, '#fbe6a6', 'rgba(246, 211, 154, 0.45)', 'rise'));
    if (q.sun === 'sink') out.push(sun(312, 250, 46, '#fbe08f', 'rgba(247, 200, 115, 0.4)', 'sink'));
    if (q.moon) out.push(`<span class="mn" style="left: ${cond === 'clear' || cond === 'wind' ? 292 : 300}px; top: ${cond === 'clear' || cond === 'wind' ? 150 : 170}px"><i></i><b style="background: ${q.sky}"></b></span>`);
    if (q.puff) out.push(puffSvg(-40, phase === 'eve' ? 90 : 200, phase === 'eve' ? 200 : 170, q.puff, phase === 'eve' ? 50 : 70, 26));
    if (cond === 'partly' && q.front) out.push(puffSvg(-60, 90, 200, q.cloud, 50, 24) + puffSvg(258, 196, 130, q.front, 24, 14));
    else if (q.cloud && cond === 'wind') out.push(puffSvg(-60, 90, 240, q.cloud, 160, 9) + puffSvg(200, 160, 200, q.cloud, 160, 11));
    else if (q.cloud) out.push(puffSvg(-80, 70, 300, q.cloud, 40, 22) + puffSvg(180, 40, 260, q.cloud, -50, 28) + puffSvg(60, 200, 220, q.cloud, 60, 30, 0.8) + (q.cloud2 ? puffSvg(-40, 300, 260, q.cloud2, 50, 20) : ''));
    const drops = (n, cls, h0, hv, d0, dv) => Array.from({ length: n }, () => `<i class="${cls}" style="left: ${Math.round(-30 + r() * 450)}px; height: ${Math.round(h0 + r() * hv)}px; --d: ${(d0 + r() * dv).toFixed(2)}s; --dl: -${(r() * 3).toFixed(2)}s"></i>`).join('');
    const flakes = (n, big) => Array.from({ length: n }, () => { const z = ((big ? 5 : 3) + r() * 3).toFixed(1); return `<i class="sn" style="left: ${Math.round(-10 + r() * 410)}px; width: ${z}px; height: ${z}px; --d: ${(6 + r() * 5).toFixed(1)}s; --dl: -${(r() * 10).toFixed(1)}s; --s: ${Math.round(-30 + r() * 60)}px"></i>`; }).join('');
    if (q.fall === 'rain') out.push(drops(70, 'rn', 14, 16, 1.2, 0.7));
    if (q.fall === 'drizzle') out.push(drops(90, 'rn dz', 6, 6, 1.8, 0.8));
    if (q.fall === 'heavy') out.push(drops(90, 'rn hv', 20, 18, 0.8, 0.4));
    if (q.fall === 'sleet') out.push(drops(40, 'rn', 14, 16, 1.2, 0.7) + flakes(30, false));
    if (q.fall === 'snow') out.push(flakes(60, true));
    if (q.fog) out.push([[320, -60, 330, 18], [390, 90, 360, 24], [460, -20, 300, 20], [530, 120, 320, 26], [600, -40, 380, 22]].map(([t, l, w, d]) => `<i class="fg" style="top: ${t}px; left: ${l}px; width: ${w}px; background: ${q.fog}; --d: ${d}s"></i>`).join(''));
    if (q.bolt) out.push('<svg class="bolt" viewBox="0 0 60 120"><path d="M34 0 L8 64 L28 64 L14 120 L56 46 L34 46 L46 0Z" fill="#f6d34a"/></svg><i class="fl"></i>');
    if (q.wind) out.push([[190, 120, 2.6, 0], [260, 90, 3.1, 1.2], [330, 150, 2.4, 0.6], [410, 110, 2.9, 2], [480, 130, 2.7, 1.5]].map(([t, w, d, dl]) => `<i class="wl" style="top: ${t}px; width: ${w}px; --d: ${d}s; --dl: -${dl}s"></i>`).join('')
        + (phase === 'night' ? '' : Array.from({ length: 10 }, () => `<i class="lv" style="top: ${Math.round(160 + r() * 400)}px; --d: ${(3 + r() * 2).toFixed(1)}s; --dl: -${(r() * 4).toFixed(1)}s"></i>`).join('') + '<svg class="tree" viewBox="0 0 60 110"><rect x="27" y="50" width="6" height="60" fill="#2c4a37"/><ellipse cx="30" cy="40" rx="24" ry="36" fill="#335c42"/></svg>'));
    const [h1, h2, h3] = q.hills;
    out.push(`<svg class="land" viewBox="0 0 390 260" preserveAspectRatio="none"><path d="M0 70 Q90 20 190 60 T390 40 V260 H0Z" fill="${h1}"/><path d="M0 110 Q120 70 230 105 T390 90 V260 H0Z" fill="${h2}"/><path d="M0 160 Q140 130 260 160 T390 150 V260 H0Z" fill="${h3}"/></svg>`);
    return `<div class="lf_sc">${out.join('')}</div>`;
}
// the same sky, small, for a card in the city list (358 by 118, drawn to fit any width)
function cardSky(cond, phase) {
    const q = pal(cond, phase), W = 358, out = [`<rect width="${W}" height="118" fill="${q.sky}"/>`];
    for (const [y, c] of q.cb || []) out.push(`<rect y="${y}" width="${W}" height="118" fill="${c}"/>`);
    if (q.stars) out.push(`<g fill="#fff"${phase === 'dawn' ? ' opacity=".7"' : ''}><circle cx="140" cy="18" r="1.2"/><circle cx="190" cy="44" r="1"/><circle cx="258" cy="62" r="1.4"/><circle cx="120" cy="56" r="1"/><circle cx="168" cy="72" r="1.1"/><circle cx="270" cy="12" r="1"/></g>`);
    if (q.sun === 'day') out.push(cond === 'partly' ? '<circle cx="300" cy="34" r="50" fill="#69a0d8"/><circle cx="300" cy="34" r="26" fill="#f6c94a"/>' : '<circle cx="330" cy="30" r="62" fill="#5f9ade"/><circle cx="330" cy="30" r="44" fill="#74a8e2"/><circle cx="330" cy="30" r="26" fill="#f6c94a"/>');
    if (q.sun === 'rise') out.push('<circle cx="226" cy="88" r="26" fill="#f6d39a"/><circle cx="226" cy="88" r="15" fill="#fbe6a6"/>');
    if (q.sun === 'sink') out.push('<circle cx="226" cy="86" r="34" fill="#f7c873" opacity=".55"/><circle cx="226" cy="86" r="20" fill="#fbe08f"/>');
    if (q.moon) out.push(`<circle cx="${q.cloud ? 150 : 222}" cy="28" r="16" fill="#f1ead2"/><circle cx="${q.cloud ? 158 : 230}" cy="22" r="14" fill="${q.sky}"/>`);
    if (cond === 'partly' && q.front) out.push('<g fill="#e9f0f8"><circle cx="246" cy="58" r="20"/><circle cx="274" cy="48" r="26"/><circle cx="304" cy="60" r="18"/><rect x="226" y="58" width="96" height="20" rx="10"/></g>');
    else if (q.cloud && cond !== 'wind') out.push(`<g fill="${q.cloud}"><circle cx="230" cy="34" r="26"/><circle cx="268" cy="22" r="34"/><circle cx="308" cy="36" r="24"/><rect x="206" y="34" width="124" height="28" rx="14"/></g>${q.cloud2 ? `<g fill="${q.cloud2}"><circle cx="320" cy="62" r="18"/><circle cx="346" cy="54" r="24"/><rect x="302" y="62" width="70" height="20" rx="10"/></g>` : ''}`);
    const lines = (col, w, n, ln, sl, seed) => { const r = rnd(seed); return `<g stroke="${col}" stroke-width="${w}" stroke-linecap="round">${Array.from({ length: n }, () => { const x = Math.round(110 + r() * 240), y = Math.round(14 + r() * 60); return `<line x1="${x}" y1="${y}" x2="${x - sl}" y2="${y + ln}"/>`; }).join('')}</g>`; };
    const dots = (n, rad, seed) => { const r = rnd(seed); return `<g fill="#fff">${Array.from({ length: n }, (_, k) => `<circle cx="${Math.round(100 + r() * 250)}" cy="${Math.round(10 + r() * 72)}" r="${k % 3 ? rad : rad * 0.7}"/>`).join('')}</g>`; };
    if (q.fall === 'rain') out.push(lines('rgba(255,255,255,.3)', 1.5, 12, 14, 4, 3));
    if (q.fall === 'drizzle') out.push(lines('rgba(255,255,255,.4)', 1, 22, 6, 1, 5));
    if (q.fall === 'heavy') out.push(lines('rgba(255,255,255,.4)', 2, 16, 18, 6, 7));
    if (q.fall === 'sleet') out.push(lines('rgba(255,255,255,.35)', 1.4, 9, 12, 4, 2) + dots(10, 2, 17));
    if (q.fall === 'snow') out.push(dots(22, 2.2, 11));
    if (q.fog) out.push('<g fill="rgba(255,255,255,.2)"><rect x="150" y="22" width="230" height="9" rx="4.5"/><rect x="110" y="44" width="200" height="9" rx="4.5"/><rect x="170" y="66" width="210" height="9" rx="4.5"/></g>');
    if (q.bolt) out.push('<path d="M232 30 L216 62 L228 62 L218 92 L246 54 L232 54 L242 30Z" fill="#f6c94a"/>');
    if (q.wind) out.push(`<g fill="none" stroke="rgba(255,255,255,.45)" stroke-width="2" stroke-linecap="round"><path d="M110 40 H190 Q204 40 204 30"/><path d="M140 58 H230"/><path d="M100 74 H170 Q184 74 184 84"/></g>${phase === 'night' ? '' : '<g fill="#2f5f3e"><rect x="184" y="62" width="4" height="26" transform="rotate(12 186 88)"/><ellipse cx="196" cy="58" rx="12" ry="16" transform="rotate(24 196 74)"/></g>'}`);
    const [h1, h2] = q.hills, low = cond === 'snow';
    out.push(low ? `<path d="M0 106 Q90 98 180 104 T358 100 V118 H0Z" fill="${h1}"/><path d="M0 112 Q110 106 210 110 T358 108 V118 H0Z" fill="${h2}"/>`
        : `<path d="M0 92 Q90 78 180 88 T358 82 V118 H0Z" fill="${h1}"/><path d="M0 104 Q110 94 210 102 T358 98 V118 H0Z" fill="${h2}"/>`);
    return `<svg class="bg" viewBox="0 0 ${W} 118" preserveAspectRatio="xMidYMid slice">${out.join('')}</svg>`;
}
// small filled icons for the hourly row and the ten days
const IC_CLOUD = '<path d="M7 19a4.5 4.5 0 0 1-.6-9A6 6 0 0 1 18 10.5a4.3 4.3 0 0 1 0 8.5z" fill="#d7dfe8"/><path d="M7 17a4 4 0 0 1-.4-8A5.5 5.5 0 0 1 17.5 9a3.8 3.8 0 0 1 0 8z" fill="#fff"/>';
const IC_TOP = '<path d="M7 14.5a4 4 0 0 1-.4-8A5.5 5.5 0 0 1 17.5 6.5a3.8 3.8 0 0 1 0 8z" fill="#fff"/>';
const IC_SUN = '<g stroke="#f6c94a" stroke-width="2.2" stroke-linecap="round"><path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M4.9 19.1l1.8-1.8M17.3 6.7l1.8-1.8"/></g><circle cx="12" cy="12" r="5" fill="#f6c94a"/>';
const IC_MOON = '<path d="M19 14.5A7.5 7.5 0 1 1 10 4.6a6 6 0 0 0 9 9.9z" fill="#f1ead2"/>';
const drop = x => `<path d="M${x} 17l1.2 2.4a1.3 1.3 0 1 1-2.4 0z"/>`;
function wxIc(c, z = 24, night = false) {
    const g = {
        clear: night ? IC_MOON : IC_SUN,
        partly: `${night ? '<path d="M15 9.5A5 5 0 1 1 9 3a4 4 0 0 0 6 6.5z" fill="#f1ead2"/>' : '<g stroke="#f6c94a" stroke-width="1.8" stroke-linecap="round"><path d="M9 1.5v1.8M2.5 8h1.8M4.2 3.2l1.3 1.3M13.8 3.2l-1.3 1.3"/></g><circle cx="9" cy="8" r="3.8" fill="#f6c94a"/>'}<path d="M9 20a3.6 3.6 0 0 1-.4-7.2A4.6 4.6 0 0 1 17.6 13a3.5 3.5 0 0 1 .2 7z" fill="#fff"/>`,
        cloudy: IC_CLOUD,
        drizzle: `${IC_TOP}<g fill="#9fd6ff"><circle cx="8" cy="18" r="1"/><circle cx="12" cy="20" r="1"/><circle cx="16" cy="18" r="1"/><circle cx="10" cy="22" r="1"/><circle cx="14" cy="22.5" r="1"/></g>`,
        rain: `${IC_TOP}<g fill="#7fc4f5">${drop(8)}${drop(12.5)}${drop(17)}</g>`,
        sleet: `${IC_TOP}<g fill="#7fc4f5">${drop(8)}${drop(15.5)}</g><circle cx="12" cy="19.5" r="1.6" fill="#fff"/>`,
        snow: `${IC_TOP}<g fill="#fff"><circle cx="8" cy="18.5" r="1.6"/><circle cx="12.5" cy="20.5" r="1.6"/><circle cx="17" cy="18.5" r="1.6"/></g>`,
        fog: '<g fill="#fff"><rect x="3" y="7" width="18" height="2.4" rx="1.2"/><rect x="5" y="11.5" width="16" height="2.4" rx="1.2" opacity=".8"/><rect x="3" y="16" width="14" height="2.4" rx="1.2" opacity=".6"/></g>',
        storm: `${IC_TOP}<path d="M12.5 13 L9 19 H12 L10.5 23.5 L16 16.5 H13 L14.5 13Z" fill="#f6d34a"/>`,
        wind: '<g fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round"><path d="M3 9h11a3 3 0 1 0-3-3"/><path d="M3 14h15a3 3 0 1 1-3 3"/><path d="M3 19h7"/></g>',
    }[c] || IC_CLOUD;
    return `<svg width="${z}" height="${z}" viewBox="0 0 24 24">${g}</svg>`;
}
// what the tiles say, from their numbers
const tileLines = (h) => ({
    rain: h.tiles.rainNext ? `내일까지 ${String(h.tiles.rainNext).replace('.', ',')} mm 더 와요` : '내일까지 비 소식 없어요',
    feels: h.tiles.feels === null || h.temp === null ? '' : h.tiles.feels < h.temp - 1 ? (h.tiles.wind > 15 ? '바람 탓에 더 추워요.' : '실제보다 춥게 느껴져요.') : h.tiles.feels > h.temp + 1 ? (h.tiles.humidity > 70 ? '습해서 더 더워요.' : '실제보다 덥게 느껴져요.') : '실제와 거의 같아요.',
    humidity: h.tiles.dew === null ? '' : `이슬점 ${h.tiles.dew}°`,
    vis: h.tiles.visibility === null ? '' : h.tiles.visibility < 8 ? (h.cond === 'fog' ? '안개 때문에 멀리 안 보여요.' : WET[h.cond] || h.cond === 'storm' ? '빗속이라 평소보다 짧아요.' : '평소보다 짧아요.') : '멀리까지 잘 보여요.',
});
const DIRS = { N: 0, NE: 45, E: 90, SE: 135, S: 180, SW: 225, W: 270, NW: 315, 북: 0, 북동: 45, 동: 90, 남동: 135, 남: 180, 남서: 225, 서: 270, 북서: 315 };
const DIR_KO = { N: '북풍', NE: '북동풍', E: '동풍', SE: '남동풍', S: '남풍', SW: '남서풍', W: '서풍', NW: '북서풍' };
const TICKS = Array.from({ length: 36 }, (_, k) => { const a = k * 10 * Math.PI / 180, r1 = k % 9 ? 31 : 28; return `<line x1="${(41 + r1 * Math.sin(a)).toFixed(1)}" y1="${(41 - r1 * Math.cos(a)).toFixed(1)}" x2="${(41 + 35 * Math.sin(a)).toFixed(1)}" y2="${(41 - 35 * Math.cos(a)).toFixed(1)}" stroke="rgba(255,255,255,${k % 9 ? 0.4 : 0.9})" stroke-width="${k % 9 ? 1 : 1.6}"/>`; }).join('');
// one tile: a label, a big number, a flat picture, a line
const tile = (label, big, pic, line) => `<div class="lf_tile"><div class="hd">${label}</div><b>${big}</b>${pic}${line ? `<p>${line}</p>` : ''}</div>`;
const mm = v => String(v).replace('.', ',');
function sunsetTile(sunset, sunrise, now, tileCol) {
    const lm = toMin(now), ss = toMin(sunset), past = lm !== null && ss !== null && (lm >= ss || lm < (toMin(sunrise) ?? 6 * 60 + 30));
    const a = shade(tileCol, 0.92), b = shade(tileCol, 0.85);
    return tile('일몰', sunset, `<svg class="pic sunset" viewBox="0 0 160 62" preserveAspectRatio="none"><circle cx="80" cy="46" r="34" fill="#f6c94a" opacity=".14"/><circle cx="80" cy="46" r="22" fill="#f6c94a" opacity=".26"/><circle cx="80" cy="46" r="13" fill="#f6c94a"/><rect x="0" y="46" width="160" height="16" fill="${a}"/><path d="M0 46 Q40 40 80 46 T160 44 V62 H0Z" fill="${b}"/><line x1="0" y1="46" x2="160" y2="46" stroke="rgba(255,255,255,.5)" stroke-width="1"/></svg>`,
        past ? (sunrise ? `일출 ${sunrise}` : '해가 졌어요.') : lm !== null && ss !== null ? `${dur(ss - lm)} 뒤` : '');
}
function weatherTiles(h, tileCol, lead = '') {
    const T = h.tiles, t = tileLines(h), out = [lead];
    if (!lead && T.sunset) out.push(sunsetTile(T.sunset, T.sunrise, h.time, tileCol));
    if (T.rain24 !== null || T.rainNext !== null) {
        const v = T.rain24 ?? T.rainNext, f = Math.min(1, v / 4), hs = [30, 38, 26, 16, 8, 4, 2];
        const bars = v ? hs.map((x, k) => `<rect x="${2 + k * 20}" y="${42 - Math.max(2, Math.round(x * f))}" width="14" height="${Math.max(2, Math.round(x * f))}" rx="3" opacity="${[1, 1, 1, 0.6, 0.45, 0.35, 0.3][k]}"/>`).join('') : hs.map((_, k) => `<rect x="${2 + k * 20}" y="38" width="14" height="4" rx="2" opacity=".35"/>`).join('');
        out.push(tile('강수량', `${mm(v)} <small>mm</small>`, `<svg class="pic bars" viewBox="0 0 140 42"><g fill="#a9dcff">${bars}</g></svg>`, t.rain));
    }
    if (T.wind !== null) out.push(tile('바람', `${T.wind} <small>km/h</small>`, `<svg class="pic cmp" viewBox="0 0 82 82"><circle cx="41" cy="41" r="36" fill="none" stroke="rgba(255,255,255,.35)" stroke-width="1.5"/>${TICKS}<text x="41" y="13" text-anchor="middle" font-size="8" fill="#fff" font-weight="700">N</text><g transform="rotate(${DIRS[T.dir] ?? 225} 41 41)"><path d="M41 12 L46 41 L41 36 L36 41Z" fill="#fff"/><path d="M41 70 L45 41 L37 41Z" fill="rgba(255,255,255,.45)"/></g><circle cx="41" cy="41" r="3" fill="#fff"/></svg>`,
        [T.gust ? `돌풍 ${T.gust} km/h` : '', DIR_KO[T.dir] || T.dir].filter(Boolean).join(' · ')));
    if (T.feels !== null) {
        const real = h.temp ?? T.feels, lo = Math.min(real, T.feels) - 10, span = Math.max(real, T.feels) + 10 - lo, x = v => ((v - lo) / span * 140).toFixed(1);
        const a = Math.min(x(real), x(T.feels)), b = Math.max(x(real), x(T.feels));
        out.push(tile('체감 온도', `${T.feels}°`, `<svg class="pic feels" viewBox="0 0 140 28"><rect x="0" y="10" width="140" height="6" rx="3" fill="rgba(0,0,0,.18)"/><rect x="${a}" y="10" width="${(b - a).toFixed(1)}" height="6" rx="3" fill="${T.feels < real ? '#9fd6ec' : '#f3c66b'}"/><circle cx="${x(T.feels)}" cy="13" r="6" fill="#fff"/><line x1="${x(real)}" y1="4" x2="${x(real)}" y2="22" stroke="#fff" stroke-width="2" stroke-dasharray="2 2"/></svg>`, t.feels));
    }
    if (T.humidity !== null) { const y = Math.round(1 + 94 * (1 - T.humidity / 100)); out.push(tile('습도', `${T.humidity}%`, `<svg class="pic hum" viewBox="0 0 30 96"><rect x="1" y="1" width="28" height="94" rx="14" fill="rgba(0,0,0,.18)"/><rect x="1" y="${Math.min(y, 80)}" width="28" height="${95 - Math.min(y, 80)}" rx="14" fill="#a9dcff"/><path d="M1 ${Math.min(y, 80) + 14} Q8 ${Math.min(y, 80) + 10} 15 ${Math.min(y, 80) + 14} T29 ${Math.min(y, 80) + 14} V${Math.min(y, 80) + 22} H1Z" fill="#c4e7ff"/></svg>`, t.humidity)); }
    if (T.visibility !== null) {
        const lit = Math.max(1, Math.min(6, Math.ceil(T.visibility / 4))), hs = [26, 34, 22, 30, 24, 28];
        out.push(tile('가시거리', `${mm(T.visibility)} <small>km</small>`, `<svg class="pic vis" viewBox="0 0 140 40" preserveAspectRatio="none">${hs.map((v, k) => `<rect x="${(k * 24.2).toFixed(1)}" y="${40 - v}" width="19" height="${v}" rx="3" fill="#fff" opacity="${k < lit ? (1 - k * 0.14).toFixed(2) : 0.12}"/>`).join('')}</svg>`, t.vis));
    }
    return out.filter(Boolean).length ? `<div class="lf_tiles">${out.join('')}</div>` : '';
}
const tempBar = (d, lo, hi, cur) => { const span = Math.max(1, hi - lo), a = ((d.lo ?? lo) - lo) / span * 100, b = (hi - (d.hi ?? hi)) / span * 100, warm = (d.hi ?? 0) >= 15; return `<span class="bar"><i style="left: ${a}%; right: ${b}%; background: ${warm ? '#f3c66b' : '#8fd0e6'}"></i>${cur !== null && cur !== undefined ? `<b style="left: ${Math.max(0, Math.min(100, (cur - lo) / span * 100))}%"></b>` : ''}</span>`; };
// the hourly temperatures as a line under the row
function hourLine(hours) {
    const ts = hours.map(x => x.temp).filter(v => v !== null);
    if (ts.length < 2) return '';
    const lo = Math.min(...ts), span = Math.max(1, Math.max(...ts) - lo), step = 330 / hours.length;
    const pts = hours.map((x, k) => x.temp === null ? null : [(step / 2 + k * step).toFixed(1), (6 + (1 - (x.temp - lo) / span) * 28).toFixed(1)]).filter(Boolean);
    return `<svg class="lf_tl" viewBox="0 0 330 40" preserveAspectRatio="none"><polyline points="${pts.map(p => p.join(',')).join(' ')}" fill="none" stroke="#fff" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round" opacity=".6"/>${pts.map((p, k) => `<circle cx="${p[0]}" cy="${p[1]}" r="${k ? 2.4 : 3}" fill="#fff"/>`).join('')}</svg>`;
}
function weatherBody(p, h, name, night, sub, source, tileCol, lead = '') {
    const lo = Math.min(...h.days.map(d => d.lo ?? 99), h.lo ?? 99), hi = Math.max(...h.days.map(d => d.hi ?? -99), h.hi ?? -99);
    return `<div class="lf_wtop">${sub ? `<small>${sub}</small>` : ''}<h2>${esc(name)}</h2><div class="t">${h.temp ?? '—'}°</div><div class="c">${esc(h.said || WX[h.cond] || '')}</div><div class="hl">최고:${h.hi ?? '—'}° 최저:${h.lo ?? '—'}°</div>${source}</div>
      ${h.hours.length ? `<div class="lf_wcard">${h.line ? `<div class="ln1">${esc(h.line)}${k1(h.ko, 'lf_wk')}</div>` : ''}<div class="lf_hrs">${h.hours.map((x, k) => `<div>${k ? esc(x.time.slice(0, 2)) + '시' : '지금'}<em>${x.rain >= 20 ? `${x.rain}%` : ''}</em>${wxIc(x.cond, 26, phaseOf(x.time, h.tiles.sunrise || h.sr, h.tiles.sunset || h.ss) === 'night')}<b class="cg_num">${x.temp ?? '—'}°</b></div>`).join('')}</div>${hourLine(h.hours)}</div>` : ''}
      ${h.days.length ? `<div class="lf_wcard"><div class="hd">${h.days.length}일간의 일기예보</div>${h.days.map((d, k) => `<div class="lf_d10"><span>${k ? WDK[WD[weekday(d.day)]] : '오늘'}</span><span class="ic">${wxIc(d.cond, 22)}${d.rain >= 30 ? `<em>${d.rain}%</em>` : ''}</span><span class="lo cg_num">${d.lo ?? '—'}°</span>${tempBar(d, lo, hi, k ? null : h.temp)}<span class="hi cg_num">${d.hi ?? '—'}°</span></div>`).join('')}</div>` : ''}
      ${weatherTiles(h, tileCol, lead)}`;
}
const isNight = (h, time) => phaseOf(time, h.tiles?.sunrise, h.tiles?.sunset) === 'night';
// the screen's colours: the sky, and the one flat colour its cards and tiles sit in
const wxVars = q => `background: ${q.sky}; --wcard: ${shade(q.sky, 0.9)}; --wtile: ${shade(q.sky, q.phase === 'day' && q.sky === '#4f8fd8' ? 0.62 : 0.8)}`;
export function weatherScreen(p, now) {
    const lf = L(p);
    if (!lf) return lifeEmpty(p, now, '날씨', 'life');
    const h = lf.weather.here, time = h.time || now5(p).slice(6), phase = phaseOf(time, h.tiles?.sunrise, h.tiles?.sunset), q = pal(h.cond, phase);
    return `<div class="lf_wx" style="${wxVars(q)}">${scene(h.cond, phase)}
      ${axBar(p, now, '#fff')}
      <div class="ax_top lf_wbar">${axCb('home2')}<button type="button" class="lf_pill wx" data-go="wlist">도시 ${lf.weather.cities.length}</button></div>
      <div class="ax_scroll">${weatherBody(p, { ...h, time }, h.place || '현재 위치', phase === 'night', '현재 위치', '<div class="lf_wgap"></div>', shade(q.sky, 0.8))}<i class="lf_pad"></i></div>
      ${axInd('#fff')}</div>`;
}
// a saved city: only its temperature, highs and lows and sky are the model's; its hours are drawn between them
function cityHours(c, t) {
    const base = toMin(t.time) ?? 12 * 60, lo = c.lo ?? (c.temp ?? 10) - 4, hi = c.hi ?? (c.temp ?? 10) + 4;
    return Array.from({ length: 6 }, (_, k) => { const m = base + k * 60, f = Math.cos(((m / 60 - 15) / 24) * 2 * Math.PI); return { time: hm(m), cond: c.cond, temp: k ? Math.round(lo + (hi - lo) * (f + 1) / 2) : c.temp, rain: c.cond === 'rain' ? 60 : c.cond === 'storm' ? 70 : c.cond === 'drizzle' || c.cond === 'sleet' ? 40 : 0 }; });
}
// today's temperatures as a curve (coldest before dawn, warmest mid-afternoon), with a dot at the city's hour
function dayCurve(c, lm, col) {
    const lo = c.lo ?? (c.temp ?? 10) - 4, hi = c.hi ?? (c.temp ?? 10) + 4, span = Math.max(1, hi - lo);
    const y = h => (8 + (1 - (lo + (hi - lo) * (Math.cos(((h - 15) / 24) * 2 * Math.PI) + 1) / 2 - lo) / span) * 40).toFixed(1);
    const pts = Array.from({ length: 25 }, (_, k) => `${(k / 24 * 140).toFixed(1)},${y(k)}`);
    const nowH = (lm ?? 12 * 60) / 60;
    return `<svg class="pic curve" viewBox="0 0 140 58" preserveAspectRatio="none"><polyline points="${pts.join(' ')} 140,58 0,58" fill="${col}" opacity=".16" stroke="none"/><polyline points="${pts.join(' ')}" fill="none" stroke="${col}" stroke-width="2.4" stroke-linecap="round"/><circle cx="${(nowH / 24 * 140).toFixed(1)}" cy="${y(nowH)}" r="5" fill="#fff" stroke="${col}" stroke-width="2.5"/></svg>`;
}
export function cityScreen(p, now, id) {
    const lf = L(p), c = lf?.weather.cities.find(x => x.id === id);
    if (!c) return weatherScreen(p, now);
    const t = cityTime(p, lf, c), phase = phaseOf(t.time, c.sunrise, c.sunset), q = pal(c.cond, phase), tileCol = shade(q.sky, q.phase === 'day' && q.sky === '#4f8fd8' ? 0.62 : 0.8);
    const h = { temp: c.temp, hi: c.hi, lo: c.lo, cond: c.cond, time: t.time, sr: c.sunrise, ss: c.sunset, line: '', ko: '', hours: cityHours(c, t), days: [],
        tiles: { sunset: '', sunrise: '', rain24: null, rainNext: c.rainNext ?? null, feels: c.feels ?? null, wind: c.wind ?? null, gust: c.gust ?? null, humidity: c.humidity ?? null, dew: c.dew ?? null, visibility: null, dir: c.dir || '' } };
    const lm = toMin(t.time), warm = (c.hi ?? 0) >= 15 ? '#f3c66b' : '#9fd6ec';
    // the city's own tiles first: its sunset and today's temperatures; no clock, the status bar and the list already tell the time
    const lead = `${c.sunset ? sunsetTile(c.sunset, c.sunrise, t.time, tileCol) : ''}${tile('오늘 기온', `${c.temp ?? '—'}°`, dayCurve(c, lm, warm), `최저 ${c.lo ?? '—'}° · 최고 ${c.hi ?? '—'}°`)}`;
    return `<div class="lf_wx" style="${wxVars(q)}">${scene(c.cond, phase)}
      ${axBar(p, now, '#fff')}
      <div class="ax_top lf_wbar">${axCb('wlist')}<span></span></div>
      <div class="ax_scroll">${weatherBody(p, h, c.name, phase === 'night', '', c.note ? `<div class="lf_wsrc">${esc(c.note)}${c.noteKo && koOn() ? ` · ${esc(c.noteKo)}` : ''}</div>` : '<div class="lf_wgap"></div>', tileCol, lead)}<i class="lf_pad"></i></div>
      ${axInd('#fff')}</div>`;
}
export function cityList(p, now) {
    const lf = L(p); if (!lf) return weatherScreen(p, now);
    const h = lf.weather.here, ht = h.time || now5(p).slice(6);
    const nav = '<svg width="11" height="11" viewBox="0 0 24 24"><path d="M3 11l18-8-8 18-2-8z" fill="#fff"/></svg>';
    const card = (go, i, name, sub, cond, phase, temp, hi, lo, foot) => `<button type="button" class="lf_city" data-go="${go}"${i ? ` data-i="${i}"` : ''} style="--axbg: ${pal(cond, phase).sky}">${cardSky(cond, phase)}
      <span class="l"><b>${esc(name)}</b><small>${sub}</small><span>${esc(foot)}</span></span><span class="r"><b>${temp ?? '—'}°</b><span>최고 ${hi ?? '—'}° 최저 ${lo ?? '—'}°</span></span></button>`;
    return `${axBar(p, now)}${axTop(axCb('weather'), axKp(p))}
      <div class="ax_scroll">${axH1('날씨')}
        <div class="lf_q">${ax('search', 16, '#8a929d', 2.4)}도시 또는 공항 검색</div>
        ${card('weather', '', h.place || '현재 위치', `${nav} 현재 위치`, h.cond, phaseOf(ht, h.tiles?.sunrise, h.tiles?.sunset), h.temp, h.hi, h.lo, h.said || WX[h.cond])}
        ${lf.weather.cities.map(c => { const t = cityTime(p, lf, c); return card('wcity', c.id, c.name, t.off ? `${t.time} · ${t.off > 0 ? '+' : '−'}${Math.abs(t.off)}시간` : '', c.cond, phaseOf(t.time, c.sunrise, c.sunset), c.temp, c.hi, c.lo, [WX[c.cond], c.note].filter(Boolean).join(' · ')); }).join('')}
        <i class="lf_pad"></i></div>${axInd()}`;
}

// ================= 배달 =================
const D = p => p.delivery || null;
const CUR = { KR: 'KRW', US: 'USD', GB: 'GBP', JP: 'JPY', CH: 'CHF', CA: 'CAD', AU: 'AUD', CN: 'CNY', TW: 'TWD', BR: 'BRL', RU: 'RUB' };
const money = (p, n) => fmtMoney({ ...p, money: { currency: p.money?.currency || CUR[p.lives || p.country] || 'EUR' } }, n);
// a flat picture of a dish, picked from its words
const FOOD = [[/죽|porridge|congee|juk/i, 'juk'], [/마라|mala|탕|soup|suppe|국|stew|eintopf|ramen|라멘|pho/i, 'soup'], [/pasta|tagliatelle|penne|spaghetti|파스타|lasagn/i, 'pasta'], [/pizza|피자/i, 'pizza'], [/sushi|초밥|스시|maki/i, 'sushi'], [/chicken|치킨|닭|hähnchen/i, 'chicken'], [/burger|버거/i, 'burger'], [/salad|salat|샐러드|bowl/i, 'salad']];
const FA = {
    juk: ['#f3e7d3', '<circle cx="50" cy="56" r="40" fill="#fff"/><circle cx="50" cy="56" r="33" fill="#ead8b6"/><circle cx="40" cy="50" r="4" fill="#5d7f3a"/><circle cx="58" cy="60" r="3.5" fill="#5d7f3a"/><circle cx="52" cy="46" r="5" fill="#3b3a36"/>'],
    soup: ['#f6dfd6', '<circle cx="50" cy="56" r="40" fill="#fff"/><circle cx="50" cy="56" r="33" fill="#d9573c"/><rect x="34" y="44" width="14" height="5" rx="2" fill="#f2d6a2"/><rect x="52" y="58" width="16" height="5" rx="2" fill="#f2d6a2"/><circle cx="44" cy="64" r="4" fill="#6b9a3e"/>'],
    pasta: ['#f2e3d0', '<circle cx="50" cy="56" r="40" fill="#fff"/><circle cx="50" cy="56" r="28" fill="#e9b75c"/><path d="M30 56c6-10 14 10 20 0s14 10 20 0M32 64c6-8 12 8 18 0s12 8 18 0" stroke="#d99a3a" stroke-width="3" fill="none"/><circle cx="50" cy="52" r="11" fill="#a8432f"/><circle cx="56" cy="47" r="3" fill="#6b9a3e"/>'],
    pizza: ['#f0d9b5', '<circle cx="50" cy="54" r="40" fill="#e4a64c"/><circle cx="50" cy="54" r="33" fill="#f1d27a"/><circle cx="38" cy="44" r="6" fill="#b5352a"/><circle cx="60" cy="48" r="6" fill="#b5352a"/><circle cx="48" cy="66" r="6" fill="#b5352a"/><circle cx="66" cy="64" r="3" fill="#5d7f3a"/>'],
    sushi: ['#e3e9ef', '<rect x="14" y="40" width="72" height="34" rx="6" fill="#2b2b2b"/><circle cx="32" cy="57" r="11" fill="#f4f1ea"/><circle cx="32" cy="57" r="5" fill="#f08a5d"/><circle cx="56" cy="57" r="11" fill="#f4f1ea"/><circle cx="56" cy="57" r="5" fill="#6b9a3e"/><circle cx="78" cy="57" r="8" fill="#f4f1ea"/>'],
    chicken: ['#f7ecd9', '<ellipse cx="50" cy="60" rx="42" ry="30" fill="#fff"/><ellipse cx="38" cy="56" rx="14" ry="10" fill="#c9852f"/><ellipse cx="60" cy="54" rx="15" ry="10" fill="#b8742a"/><ellipse cx="50" cy="68" rx="14" ry="9" fill="#d29440"/>'],
    burger: ['#f5e6cf', '<ellipse cx="50" cy="40" rx="30" ry="16" fill="#e0a456"/><rect x="20" y="48" width="60" height="7" rx="3" fill="#6b9a3e"/><rect x="18" y="55" width="64" height="10" rx="4" fill="#7a4a2a"/><ellipse cx="50" cy="72" rx="30" ry="8" fill="#e0a456"/>'],
    salad: ['#e6efe0', '<circle cx="50" cy="56" r="40" fill="#fff"/><circle cx="50" cy="56" r="32" fill="#9fc27f"/><circle cx="40" cy="50" r="6" fill="#d9573c"/><circle cx="60" cy="60" r="6" fill="#f2c94c"/><circle cx="54" cy="44" r="5" fill="#6b9a3e"/>'],
    bowl: ['#efe7da', '<circle cx="50" cy="56" r="40" fill="#fff"/><circle cx="50" cy="56" r="32" fill="#d8c3a1"/><circle cx="42" cy="50" r="5" fill="#a8432f"/><circle cx="58" cy="60" r="5" fill="#6b9a3e"/>'],
};
const food = (txt, cls = '') => { const k = FOOD.find(([re]) => re.test(txt))?.[1] || 'bowl', [bg, svg] = FA[k]; return `<span class="lf_food ${cls}" style="background: ${bg}"><svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice">${svg}</svg></span>`; };
const shopOf = (d, name) => d.shops.find(s => s.name === name);
const shopFood = (d, name) => { const s = shopOf(d, name); return `${s?.cuisine || ''} ${s?.menu?.[0]?.name || ''} ${name}`; };
const ST_KO = { 'on the way': '배달 중', delivered: '배달완료', cancelled: '주문 취소', refunded: '환불 완료' }, ST_DE = { 'on the way': 'Unterwegs', delivered: 'Zugestellt', cancelled: 'Storniert', refunded: 'Erstattet' };
const bmTab = on => `<div class="lf_bmtab">${[['dlv', 'homeS', '홈'], ['', 'search', '검색'], ['', 'heartF', '찜'], ['dorders', 'rcp', '주문내역'], ['', 'user', 'my배민']].map(([go, ic, t]) => `<${go ? `button type="button" data-go="${go}"` : 'span'} class="${go === on ? 'on' : ''}">${ax(ic, 22, 'currentColor', 2)}${t}</${go ? 'button' : 'span'}>`).join('')}</div>`;
const ueTab = on => `<div class="lf_uetab">${[['dlv', 'homeS', 'Startseite'], ['', 'bagS', 'Lebensmittel'], ['', 'search', 'Suchen'], ['dorders', 'rcp', 'Bestellungen'], ['', 'user', 'Konto']].map(([go, ic, t]) => `<${go ? `button type="button" data-go="${go}"` : 'span'} class="${go === on ? 'on' : ''}">${ax(ic, 22, 'currentColor', 2)}${t}</${go ? 'button' : 'span'}>`).join('')}</div>`;
const cartCount = d => (d.cart?.items || []).reduce((n, x) => n + x.qty, 0), cartSum = d => (d.cart?.items || []).reduce((n, x) => n + x.qty * x.price, 0);
export function dlvScreen(p, now) {
    const d = D(p);
    if (!d) return lifeEmpty(p, now, '배달', 'delivery');
    const shops = [...d.shops].sort((a, b) => d.orders.filter(o => o.shop === b.name).length - d.orders.filter(o => o.shop === a.name).length), recent = [...d.orders].reverse();
    if (d.look === 'baemin') {
        const addr = recent[0]?.to === 'home' || !recent[0] ? '우리집' : recent[0].to === 'work' ? '회사' : recent[0].to;
        return `<div class="lf_bm"><div class="lf_bmh">${axBar(p, now, '#fff')}<div class="r1">${axCb('home2')}<b>${esc(addr)} ${ax('chev', 14, '#fff', 2.8)}</b><span class="lf_bmic"><span class="lf_cartb">${ax('bell', 22, '#fff', 2)}</span><button type="button" data-go="dcart" class="lf_cartb">${ax('cart', 22, '#fff', 2)}${cartCount(d) ? `<i>${cartCount(d)}</i>` : ''}</button></span></div>
          <div class="q">${ax('search', 16, '#9aa0a6', 2.4)}찾는 메뉴가 뭐예요?</div></div>
        <div class="ax_scroll lf_bmsc"><div class="lf_bmtabs"><span class="on">배달</span><span>픽업</span><span>장보기·쇼핑</span><span>선물하기</span></div>
          <div class="lf_cat">${[['🍚', '한식', '#fff3e3'], ['🍢', '분식', '#ffeceb'], ['☕', '카페·디저트', '#f3efe9'], ['🍗', '치킨', '#fff0e0'], ['🍕', '피자', '#fff7dc'], ['🥟', '중식', '#ffeceb'], ['🥗', '샐러드', '#f2f7ec'], ['🍲', '죽', '#e9f3fb'], ['🌙', '야식', '#f4eefa'], ['⋯', '전체', '#f1f2f4']].map(([e, t, c]) => `<div><span style="background: ${c}">${e}</span>${t}</div>`).join('')}</div>
          <div class="lf_bmsec">자주 시킨 가게</div>
          <div class="lf_shops">${shops.map(s => `<button type="button" data-go="dshop" data-i="${s.id}">${food(`${s.cuisine} ${s.menu[0]?.name || ''} ${s.name}`, 'big')}<b>${esc(s.name)}</b><span>${s.rating ? `<em>★ ${String(s.rating).replace(',', '.')}</em>${s.reviews ? ` (${n0(s.reviews)})` : ''} · ` : ''}${esc(s.eta || '')}분</span></button>`).join('')}</div>
          <i class="lf_pad"></i></div>
        ${d.cart ? `<button type="button" class="lf_bmcta" data-go="dcart"><em>${cartCount(d)}</em>장바구니 · ${esc(d.cart.shop)}<span>${esc(money(p, cartSum(d)))}</span></button>` : ''}${bmTab('dlv')}</div>`;
    }
    return `<div class="lf_ue">${axBar(p, now)}<div class="lf_uetop"><div class="dn">${axCb('home2')}<div><small>Jetzt liefern</small><b>${esc(recent[0]?.address || 'Zuhause')} ${ax('chev', 13, '#000', 2.8)}</b></div><button type="button" data-go="dcart" class="lf_cartb">${ax('cart', 20, '#000', 2.1)}${cartCount(d) ? `<i>${cartCount(d)}</i>` : ''}</button></div>
        <div class="q">${ax('search', 16, '#5e5e5e', 2.4)}Essen, Geschäfte, Getränke</div></div>
      <div class="ax_scroll lf_uesc">
        <div class="lf_uecat">${[['🍕', 'Pizza'], ['🍣', 'Sushi'], ['🍔', 'Burger'], ['🍜', 'Asiatisch'], ['🥗', 'Gesund']].map(([e, t]) => `<div><span>${e}</span>${t}</div>`).join('')}</div>
        ${recent.length ? `<div class="lf_ueh">Erneut bestellen</div><div class="lf_again">${[...new Set(recent.map(o => o.shop))].slice(0, 4).map(n => { const s = shopOf(d, n); return `<button type="button" data-go="dshop" data-i="${s?.id || ''}">${food(shopFood(d, n))}<b>${esc(n)}</b><small>${esc(s?.eta || '')} Min.</small></button>`; }).join('')}</div>` : ''}
        <div class="lf_ueh">Beliebt in deiner Nähe</div>
        ${shops.slice(0, 3).map(s => `<button type="button" class="lf_sc" data-go="dshop" data-i="${s.id}">${food(`${s.cuisine} ${s.menu[0]?.name || ''} ${s.name}`, 'wide')}<span class="r"><span><b>${esc(s.name)}</b><small>${esc(money(p, s.fee))} Liefergebühr · ${esc(s.eta || '')} Min.</small></span>${s.rating ? `<i>${String(s.rating).replace(',', '.')}</i>` : ''}</span></button>`).join('')}
        <i class="lf_pad"></i></div>${ueTab('dlv')}</div>`;
}
export function shopScreen2(p, now, id) {
    const d = D(p), s = d?.shops.find(x => x.id === id);
    if (!s) return dlvScreen(p, now);
    const bm = d.look === 'baemin', inCart = d.cart?.shop === s.name;
    return `<div class="${bm ? 'lf_bm' : 'lf_ue'} lf_store">${food(`${s.cuisine} ${s.menu[0]?.name || ''} ${s.name}`, 'hero')}${axBar(p, now)}<div class="lf_herob">${axCb('dlv')}</div>
      <div class="ax_scroll lf_storesc"><div class="lf_sinfo ${bm ? '' : 'ue'}"><h2>${esc(s.name)}</h2>${s.ko && koOn() ? `<span class="lf_k">${esc(s.ko)}</span>` : ''}
          <div class="rt">${s.rating ? `<em>${'★'.repeat(Math.round(s.rating))}</em> ${String(s.rating).replace(',', '.')}` : ''}${s.reviews ? ` · ${bm ? '리뷰' : ''} ${n0(s.reviews)}${bm ? '' : '+ Bewertungen'}` : ''}${s.cuisine ? ` · ${esc(s.cuisine)}` : ''}</div>
          <div class="meta">${bm ? `<span>최소주문</span><span>${s.minOrder ? esc(money(p, s.minOrder)) : '없음'}</span><span>배달팁</span><span>${esc(money(p, s.fee))}</span><span>배달시간</span><span>${esc(s.eta || '')}분 소요</span>` : `<span>Liefergebühr</span><span>${esc(money(p, s.fee))}</span><span>Lieferzeit</span><span>${esc(s.eta || '')} Min.</span>`}</div></div>
        <div class="lf_mtabs"><span class="on">${bm ? '메뉴' : 'Beliebt'}</span><span>${bm ? '정보' : 'Info'}</span><span>${bm ? `리뷰 ${n0(s.reviews || 0)}` : 'Bewertungen'}</span></div>
        ${s.menu.map(x => `<div class="lf_mi"><span class="lf_tx"><b>${x.top ? `<span class="rep">${bm ? '대표' : '#1'}</span>` : ''}${esc(x.name)}</b>${x.ko && koOn() ? `<span class="lf_k">${esc(x.ko)}</span>` : ''}${x.desc ? `<p>${esc(x.desc)}</p>` : ''}<strong>${esc(money(p, x.price))}</strong></span>${food(`${x.name} ${x.desc} ${s.cuisine}`)}</div>`).join('')}
        <i class="lf_pad"></i></div>
      ${inCart ? `<button type="button" class="${bm ? 'lf_bmcta' : 'lf_uecta'}" data-go="dcart"><em>${cartCount(d)}</em>${bm ? `${esc(money(p, cartSum(d)))} 장바구니 보기` : 'Warenkorb ansehen'}${bm ? '' : `<span>${esc(money(p, cartSum(d)))}</span>`}</button>` : ''}</div>`;
}
export function cartScreen(p, now) {
    const d = D(p); if (!d) return dlvScreen(p, now);
    const c = d.cart, bm = d.look === 'baemin', s = c && shopOf(d, c.shop), sum = cartSum(d), fee = s?.fee || 0;
    const note = (label, t, k) => (t ? `<div class="lf_bx"><small>${label}</small>${esc(t)}${k && koOn() ? `<span class="lf_k">${esc(k)}</span>` : ''}</div>` : '');
    return `<div class="${bm ? 'lf_bm' : 'lf_ue'} lf_cartv">${axBar(p, now)}<div class="lf_ctop">${axCb('dlv')}<b>${bm ? '장바구니' : 'Warenkorb'}</b><span></span></div>
      <div class="ax_scroll">${c ? `<div class="lf_cart"><div class="sh">${ax('store', 18, '#222', 2.1)}${esc(c.shop)}</div>
          ${c.items.map(x => `<div class="lf_ci">${food(`${x.name} ${s?.cuisine || ''}`)}<span class="lf_tx"><b>${esc(x.name)}</b>${x.ko && koOn() ? `<span class="lf_k">${esc(x.ko)}</span>` : ''}${x.option ? `<small>${esc(x.option)}</small>` : ''}<span class="q"><strong>${esc(money(p, x.price * x.qty))}</strong><span class="lf_step"><span>−</span><b>${x.qty}</b><span>+</span></span></span></span></div>`).join('')}</div>
        ${c.noteShop || c.noteRider ? `<div class="lf_req"><h4>${bm ? '요청사항' : 'Hinweise'}</h4>${note(bm ? '가게 사장님께' : 'Für das Restaurant', c.noteShop, c.noteShopKo)}${note(bm ? '배달 기사님께' : 'Für den Kurier', c.noteRider, c.noteRiderKo)}</div>` : ''}
        <div class="lf_sum"><div><span>${bm ? '주문금액' : 'Zwischensumme'}</span><span>${esc(money(p, sum))}</span></div><div><span>${bm ? '배달팁' : 'Liefergebühr'}</span><span>${esc(money(p, fee))}</span></div><div class="t"><span>${bm ? '결제예정금액' : 'Gesamt'}</span><span>${esc(money(p, sum + fee))}</span></div></div>
`
        : `<div class="lf_none">장바구니가 비어 있어요</div>`}<i class="lf_pad"></i></div>
      ${c ? `<span class="${bm ? 'lf_bmcta' : 'lf_uecta'} off">${bm ? `${esc(money(p, sum + fee))} 배달 주문하기` : `Bestellen · ${esc(money(p, sum + fee))}`}</span>` : ''}</div>`;
}
const toLine = (o, bm) => (o.gift ? (bm ? `${o.gift} 집으로` : `an ${o.gift}`) : o.to === 'home' ? (bm ? '우리집' : 'Zuhause') : o.to === 'work' ? (bm ? '회사' : 'Arbeit') : o.to);
export function ordersScreen(p, now) {
    const d = D(p); if (!d) return dlvScreen(p, now);
    const bm = d.look === 'baemin', os = [...d.orders].reverse();
    if (bm) return `<div class="lf_bm">${axBar(p, now)}<div class="lf_ctop">${axCb('dlv')}<b>주문내역</b><span>${ax('search', 20, '#222', 2)}</span></div>
      <div class="ax_scroll">${os.map(o => `<div class="lf_oc"><div class="hd"><span><b>${ST_KO[o.status]}</b> · ${esc(fmtDate(p, o.time, true))} ${esc(o.time.slice(6))}${o.gift ? '<span class="gift">선물</span>' : ''}</span><button type="button" data-go="dorder" data-i="${o.id}">주문상세 ›</button></div>
          <button type="button" class="bd" data-go="dorder" data-i="${o.id}">${food(shopFood(d, o.shop))}<span><b>${esc(o.shop)} ›</b><small>${esc(o.items[0].name)}${o.items.length > 1 ? ` 외 ${o.items.length - 1}개` : ` ${o.items[0].qty}개`}${o.for > 1 ? ` · ${o.for}인분` : ''}</small><small>${esc(money(p, orderTotal(o)))} · ${esc(toLine(o, true))}</small></span></button>
          ${o.status === 'delivered' ? `<div class="bt"><span>${o.reviewed ? '리뷰 작성 완료' : '리뷰 쓰기'}</span><span class="m">같은 메뉴 담기</span></div>` : ''}</div>`).join('') || '<div class="lf_none">주문 내역이 없어요</div>'}
        <i class="lf_pad"></i></div>${bmTab('dorders')}</div>`;
    return `<div class="lf_ue">${axBar(p, now)}<div class="lf_ctop">${axCb('dlv')}<b>Bestellungen</b><span></span></div>
      <div class="lf_otab"><span class="on">Vergangene</span><span>Laufende</span></div>
      <div class="ax_scroll">${os.map(o => `<button type="button" class="lf_or" data-go="dorder" data-i="${o.id}">${food(shopFood(d, o.shop))}<span class="lf_tx"><b>${esc(o.shop)}</b><small>${o.items.reduce((n, x) => n + x.qty, 0)} Artikel · ${esc(money(p, orderTotal(o)))} · ${esc(fmtDate(p, o.time, true))}</small><small class="${o.status === 'cancelled' || o.status === 'refunded' ? 'x' : ''}">${ST_DE[o.status]} · ${esc(toLine(o, false))}</small><u>Beleg ansehen</u></span>${o.status === 'delivered' ? '<em>Erneut</em>' : ''}</button>`).join('') || '<div class="lf_none">Noch keine Bestellungen</div>'}
        <i class="lf_pad"></i></div>${ueTab('dorders')}</div>`;
}
// the route on a flat map: shop to door, drawn from the order's id so it stays put
function routeMap(o) {
    let s = [...o.id].reduce((n, ch) => n * 31 + ch.charCodeAt(0), 9);
    const r = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
    const x1 = 40 + r() * 60, y1 = 190 + r() * 40, x2 = 270 + r() * 70, y2 = 50 + r() * 40, mx = 140 + r() * 80;
    return `<div class="lf_map"><span class="blk" style="left: 20px; top: 20px; width: 120px; height: 80px"></span><span class="blk" style="left: 170px; top: 120px; width: 90px; height: 70px"></span><span class="pk" style="left: 230px; top: 140px; width: 150px; height: 90px"></span>
      <span class="rd" style="left: 0; right: 0; top: ${y1 - 7}px; height: 14px"></span><span class="rd" style="left: ${mx - 7}px; top: 0; bottom: 0; width: 14px"></span><span class="rd" style="left: 0; right: 0; top: ${y2 - 7}px; height: 12px"></span>
      <svg viewBox="0 0 390 250"><path d="M${x1} ${y1} L${mx} ${y1} L${mx} ${y2} L${x2} ${y2}" fill="none" stroke="#000" stroke-width="4" stroke-linejoin="round"/></svg>
      <span class="pin" style="left: ${x1 - 15}px; top: ${y1 - 15}px; background: #000">${ax('store', 15, '#fff', 2.2)}</span><span class="pin" style="left: ${x2 - 15}px; top: ${y2 - 15}px">${ax('homeS', 15, '#fff', 2.2)}</span></div>`;
}
export function orderScreen(p, now, id) {
    const d = D(p), o = d?.orders.find(x => x.id === id);
    if (!o) return ordersScreen(p, now);
    const bm = d.look === 'baemin', tx = (p.money?.tx || []).find(t => t.delivery === o.id && !String(t.id).endsWith('-r')), acct = tx && p.money.bank.accounts.find(a => a.last4 === tx.account);
    const sub = o.items.reduce((n, x) => n + x.qty * x.price, 0);
    const lines = [...o.items.map(x => `<div class="ln"><span><em>${x.qty}</em>${esc(x.name)}${x.option ? `<small>${esc(x.option)}</small>` : ''}${x.ko && koOn() ? `<span class="lf_k">${esc(x.ko)}</span>` : ''}</span><span>${esc(money(p, x.qty * x.price))}</span></div>`),
        `<div class="ln g"><span>${bm ? '배달팁' : 'Liefergebühr'}</span><span>${esc(money(p, o.fee))}</span></div>`, o.tip ? `<div class="ln g"><span>${bm ? '팁' : 'Trinkgeld'}</span><span>${esc(money(p, o.tip))}</span></div>` : '',
        o.discount ? `<div class="ln g"><span>${bm ? '할인' : 'Rabatt'}</span><span class="dc">−${esc(money(p, o.discount))}</span></div>` : '', `<div class="ln t"><span>${bm ? '결제금액' : 'Gesamt'}</span><span>${esc(money(p, sub + o.fee + o.tip - o.discount))}</span></div>`].join('');
    const note = (label, t, k) => (t ? `<div class="note"><small>${label}</small>${esc(t)}${k && koOn() ? `<span class="lf_k">${esc(k)}</span>` : ''}</div>` : '');
    const done = o.status === 'delivered', icon = done ? ax('check', 20, '#fff', 3) : o.status === 'on the way' ? ax('bagS', 20, '#fff', 2.2) : ax('x', 20, '#fff', 3);
    return `<div class="${bm ? 'lf_bm' : 'lf_ue'} lf_od">${o.mode === 'delivery' && o.status !== 'cancelled' ? routeMap(o) : '<div style="height: 110px"></div>'}${axBar(p, now)}<div class="lf_herob">${axCb(`dorders`)}</div>
      <div class="ax_scroll lf_odsc"><div class="lf_odb">
        <div class="st"><i style="background: ${o.status === 'cancelled' || o.status === 'refunded' ? '#c0392b' : bm ? 'var(--m)' : '#06c167'}">${icon}</i><div><b>${bm ? ST_KO[o.status] : ST_DE[o.status]}${o.arrived ? ` · ${esc(o.arrived.slice(6))}` : ''}</b><span>${esc(o.shop)} · ${esc(fmtDate(p, o.time, true))} ${esc(o.time.slice(6))}${o.left ? ` · ${esc(o.left)}` : ''}</span></div></div>
        ${lines}
        ${note(bm ? '가게 사장님께' : 'Hinweis für das Restaurant', o.noteShop, o.noteShopKo)}${note(bm ? '배달 기사님께' : 'Hinweis für den Kurier', o.noteRider, o.noteRiderKo)}
        <div class="meta2">${[toLine(o, bm), o.address, o.for > 1 ? (bm ? `${o.for}인분` : `Für ${o.for}`) : '', o.noCutlery ? (bm ? '수저 안 받음' : 'Ohne Besteck') : ''].filter(Boolean).map(esc).join(' · ')}</div>
        <div class="pay">${ax('cardS', 20, '#000', 2)}${acct ? `${esc(acct.name || '')} •••• ${esc(acct.last4)}` : o.account === 'cash' ? (bm ? '만나서 현금결제' : 'Bar bei Lieferung') : (bm ? '카드' : 'Karte')}${tx ? `<button type="button" data-go="tx" data-i="${tx.id}">은행에서 보기 ›</button>` : ''}</div>
      </div><i class="lf_pad"></i></div></div>`;
}
