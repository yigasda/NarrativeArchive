// 캐릭터 휴대폰 · 시계 · 건강 · 파일 · 날씨 · 배달 (v3.142): our app look (round glass buttons, white cards), the clock on
// charcoal, the weather sky moving with its weather, the delivery app as the one used where the owner lives (배달의민족 in
// Korea, Uber Eats elsewhere). Everything that follows from the numbers is worked out here, never asked of the model:
// the next alarm and time left, sleep stages and charts, the usual-vs-recent lines, the weather tiles' sentences, a saved
// city's local time and hours, an order's total, its map and receipt, a ticket file's first page.

import { AX, ax, axBar, axCb, axH1, axInd, axKp, axTint, axTop, busyHtml } from './phoneapps.js';
import { filling } from './phoneai.js';
import { byStory, clockNum, clockOf, fmtDate, halfOf, hourOf, koOn, pad, storyNow } from './phonedata.js';
import { shiftDay, weatherNow } from './phonelife.js';
import { apart, cityAt as cityOfPlace, mirrorHome, overlayNow } from './phonesynclife.js';
import { decimalOf, fmtMoney, localeOf } from './phonemoney.js';
import { nameKey } from './people.js';
import { getMeta } from './core.js';
import { esc } from './util.js';
import { DOT_C, DOT_R, DOTS, MAP_BOT, MAP_H, MAP_TOP, MAP_W, TZ_AT } from './worldmap.js';
import { CAT, dishSvg, guessPic } from './phonefood.js';

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
    bagS: 'M5 8h14l-1.2 11a1 1 0 0 1-1 .9H7.2a1 1 0 0 1-1-.9zM9 8V6a3 3 0 0 1 6 0v2', cardS: 'M5.5 5.5h13A2.5 2.5 0 0 1 21 8v8a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 16V8a2.5 2.5 0 0 1 2.5-2.5zM3 10h18', check: 'M5 12l5 5 9-10', pause: 'M9 5v14M15 5v14', arrR: 'M5 12h14M13 6l6 6-6 6', plusS: 'M12 5v14M5 12h14', eyeoff: 'M3 3l18 18M10.6 6.1A10 10 0 0 1 12 6c6 0 9.5 6 9.5 6a17 17 0 0 1-3 3.6M6.1 7.6A17 17 0 0 0 2.5 12S6 18 12 18a9 9 0 0 0 4-.9',
});

// ---- shared bits
// the everyday apps' data, with every list and box it may lack (an older save, a thin answer) put in place once
// whose phone a life view is (L's answer), so the here weather can look at the other phones in the same city
const OWNER = new WeakMap();
const L = p => {
    const l = p.life; if (!l) return null;
    const c = l.clock ||= {}; c.alarms ||= []; c.timers ||= []; c.running ||= null; for (const a of c.alarms) { a.days ||= []; a.then ||= []; }
    const h = l.health ||= {}; h.days ||= []; h.usual ||= {};
    // today's steps so far: the row holds none until the day is over; the screen counts from waking to now
    const today = now5(p).slice(0, 5), nowMin = toMin(now5(p).slice(6));
    const soFar = d => {
        if (d.date !== today || (d.steps !== null && d.steps !== undefined) || !Number.isFinite(h.usual.steps) || nowMin === null) return d;
        const wake = toMin(d.wake) ?? toMin(h.usual.wake) ?? 7 * 60, f = Math.max(0, Math.min(1, (nowMin - wake) / Math.max(60, 22 * 60 - wake)));
        const r = seeded(`${d.date}:sofar`)(), steps = Math.round(h.usual.steps * f * (0.85 + r * 0.3));
        return { ...d, steps, km: Math.round(steps * 0.00072 * 10) / 10, partial: true, until: Math.floor(nowMin / 60) };
    };
    const f = l.files ||= {}; f.folders ||= []; f.items ||= []; f.cloud ||= { used: null, total: null };
    const w = l.weather ||= {}; w.cities ||= []; const h0 = w.here ||= { place: '', date: '', time: '', from: 'guess', cond: '', temp: null, hi: null, lo: null, line: '', ko: '' }; h0.hours ||= []; h0.days ||= []; h0.tiles ||= {};
    // a number left out reads as none (the screens test for null, not undefined)
    for (const x of h0.hours) { x.temp ??= null; x.rain ??= 0; }
    for (const x of h0.days) { x.lo ??= null; x.hi ??= null; x.rain ??= 0; }
    for (const k of ['rain24', 'rainNext', 'feels', 'wind', 'gust', 'humidity', 'dew', 'visibility']) h0.tiles[k] ??= null;
    for (const k of ['temp', 'hi', 'lo']) h0[k] ??= null;
    for (const x of w.cities) { x.hours ||= []; for (const k of ['temp', 'hi', 'lo', 'feels', 'humidity', 'dew', 'rainNext', 'wind', 'gust']) x[k] ??= null; }
    // the screens read a view: today's row counted up, nothing written back to the save
    // (and it carries the minute now, so what the day still holds, water and coffee later on, isn't counted yet)
    const view = h.days.some(d => d && d.date === today) ? { ...l, health: { ...h, days: h.days.map(d => (d && d.date === today ? { ...soFar(d), ...(nowMin === null ? {} : { upTo: nowMin }) } : d)) } } : l;
    OWNER.set(view, p);
    return view;
};
const k1 = (k, cls = 'lf_k') => (k && koOn() ? `<span class="${cls}">${esc(k)}</span>` : '');
const now5 = p => String(storyNow(p) || p.now || '');
const toMin = t => { const mt = String(t || '').match(/(\d{1,2}):(\d{2})/); return mt ? Number(mt[1]) * 60 + Number(mt[2]) : null; };
// an order's arrival clock: "MM-DD HH:MM", or "HH:MM" alone (on the order's day)
const arrHm = o => { const a = String(o.arrived || ''); return /^\d{2}:\d{2}$/.test(a) ? a : a.slice(6); };
const hm = n => `${pad(Math.floor(((n % 1440) + 1440) % 1440 / 60))}:${pad(((n % 60) + 60) % 60)}`;
const dur = min => (min >= 60 ? `${Math.floor(min / 60)}시간 ${min % 60}분` : `${min}분`);
const durBig = min => `${Math.floor(min / 60)}<span>시간</span> ${min % 60}<span>분</span>`;
// numbers as the phone's country writes them: 6,000 · 2.0 in Korea, the US, Japan…; 6.000 · 2,0 in Germany and most of Europe
// (no country known: the dot, as the money app's fallback writes it)
let STORY = { year: new Date().getFullYear(), now: '', dot: false };
// the phone being drawn: its year (carried over New Year by the reflection), its now and its number style
export function setStory(p) {
    const y = Number(p?.year) || Number(String(p?.money?.asOf || p?.investment?.date || '').slice(0, 4)) || new Date().getFullYear();
    // known: the story dates itself (else weekdays aren't shown: a fantasy calendar or an undated story has none to show)
    STORY = { year: y, known: !p?.noYear && !!(Number(p?.year) || /^\d{4}-/.test(String(p?.money?.asOf || p?.money?.fxDate || p?.investment?.date || ''))), now: String(storyNow(p) || p?.now || '').slice(0, 5), dot: decimalOf(p) === '.', loc: localeOf(p), p };
}
const n0 = v => (v === null || v === undefined ? '—' : Number(v).toLocaleString(STORY.loc || 'en-US'));
const md = s => { const mt = String(s || '').match(/^(\d{2})-(\d{2})/); return mt ? { mo: Number(mt[1]), d: Number(mt[2]) } : null; };
// a story day as a real date: the story's year, and a day across New Year from its now in the year before or after
const dayGap = (a, b) => { const A = md(a), B = md(b); if (!A || !B) return 0; let g = (Date.UTC(2001, B.mo - 1, B.d) - Date.UTC(2001, A.mo - 1, A.d)) / 864e5; if (g < -180) g += 365; if (g > 180) g -= 365; return g; };
const realDate = (day, h = 0) => { const x = md(day), n = md(STORY.now); if (!x) return null; if (!n) return new Date(Date.UTC(STORY.year, x.mo - 1, x.d, h)); return new Date(Date.UTC(STORY.year, n.mo - 1, n.d + dayGap(STORY.now, day), h)); };
const weekday = day => realDate(day)?.getUTCDay() ?? 0;
// a day's weekday to show, or alt when the story's year is unknown
const wdk = (day, alt = '') => (STORY.known ? WDK[WD[weekday(day)]] : alt);
const WD = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'], WDK = { mon: '월', tue: '화', wed: '수', thu: '목', fri: '금', sat: '토', sun: '일' };
const daysLine = days => { const s = days.join(','); return s === 'mon,tue,wed,thu,fri' ? '평일' : s === 'sat,sun' ? '주말' : days.length === 7 ? '매일' : days.map(d => WDK[d]).join(' '); };
// an alarm's time as the phone writes it: the number, and 오전/오후 · AM/PM beside it ('' on a 24-hour phone)
const ampm = (p, t) => { const m = toMin(t); return m === null ? ['', ''] : [clockNum(p, m), halfOf(p, m)]; };
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
    const [t, ap] = ampm(p, a.time);
    return `<button type="button" class="lf_al ${a.on ? '' : 'off'}" data-go="alarm" data-i="${a.id}"><span class="lf_alt"><b>${t}<small>${ap}</small></b><span>${esc(a.label || '알람')}${a.ko && koOn() ? ` <em>${esc(a.ko)}</em>` : ''} <em>· ${a.days.length ? daysLine(a.days) : a.date ? `${esc(fmtDate(p, a.date, true))} 한 번` : '한 번'}</em></span></span><span class="lf_tg ${a.on ? 'on' : ''}"></span></button>
      ${a.then.length ? `<div class="lf_snz">${a.then.map(x => `<span class="${a.on ? '' : 'o'}">${esc(ampm(p, x)[0])}</span>`).join('')}</div>` : ''}`;
};
export function clockScreen(p, now) {
    const lf = L(p);
    if (!lf) return lifeEmpty(p, now, '시계', 'life', 'home2', true);
    const as = lf.clock.alarms, n = now5(p), next = as.map(a => ({ a, r: nextRing(a, n) })).filter(x => x.r).sort((x, y) => x.r.min - y.r.min)[0];
    const wake = as.filter(a => a.wake), other = as.filter(a => !a.wake), on = as.filter(a => a.on).length;
    return `${axBar(p, now, '#f2f2f4')}
      ${axTop(axCb('home2'), axKp(p))}
      <div class="ax_scroll">${axH1('알람', `켜짐 ${on} · 꺼짐 ${as.length - on}`)}
        ${next ? `<div class="lf_next"><span>${ax('bell', 20, '#f5a524', 2.1)}</span><div><b>${next.r.min < 1440 && next.r.day === n.slice(0, 5) ? '오늘' : next.r.min < 2880 ? '내일' : (wdk(next.r.day) ? `${wdk(next.r.day)}요일` : `${Number(next.r.day.slice(3))}일`)} ${esc(clockOf(p, next.a.time))}</b><small>${esc(next.a.label || '알람')} · ${dur(next.r.min)} 뒤</small></div></div>` : ''}
        ${wake.length ? `<div class="lf_ch">수면 · 기상</div><div class="lf_dcard">${wake.map(a => alarmRow(p, a)).join('')}</div>` : ''}
        ${other.length ? `<div class="lf_ch">기타</div><div class="lf_dcard">${other.map(a => alarmRow(p, a)).join('')}</div>` : ''}
        ${as.length ? '' : '<div class="lf_none">알람이 없어요</div>'}
        <i class="lf_pad"></i></div>
      ${clockDock('clock')}${axInd('#f2f2f4')}`;
}
export function alarmScreen(p, now, id) {
    const lf = L(p), a = lf?.clock.alarms.find(x => x.id === id);
    if (!a) return clockScreen(p, now);
    const m = toMin(a.time), h = Math.floor(m / 60), mi = m % 60, h12 = (h % 12) || 12, half = halfOf(p, m);
    // when it was last switched off: the morning they woke, from health (a wake-up alarm on that day only)
    const today = (lf.health.days || []).find(d => d.date === now5(p).slice(0, 5));
    const off = a.wake && a.on && today?.wake ? `오늘 ${clockOf(p, today.wake)}` : '';
    return `${axBar(p, now, '#f2f2f4')}
      <div class="lf_sheet"><div class="lf_shh"><button type="button" data-go="clock">닫기</button><b>알람</b><span></span></div>
        <div class="lf_wheel">${half ? `<div>${(h12 + 10) % 12 + 1}<b>${h12}</b>${h12 % 12 + 1}</div>` : `<div>${pad((h + 23) % 24)}<b>${pad(h)}</b>${pad((h + 1) % 24)}</div>`}<div>${pad((mi + 59) % 60)}<b>${pad(mi)}</b>${pad((mi + 1) % 60)}</div><div>&nbsp;<b>${half || '&nbsp;'}</b>${half ? (h < 12 ? halfOf(p, 720) : '&nbsp;') : '&nbsp;'}</div></div>
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
    let left = r ? (Number(r.left) || 0) : 0;
    // (a timer from another story day has long run out)
    const at = r?.at || lf.at;
    if (r && at && now5(p)) left = at.slice(0, 5) === now5(p).slice(0, 5) ? left - ((toMin(now5(p).slice(6)) ?? 0) - (toMin(at.slice(6)) ?? 0)) * 60 : dayGap(at.slice(0, 5), now5(p).slice(0, 5)) > 0 ? 0 : left;
    left = Math.max(0, left);
    const C = 2 * Math.PI * 115, frac = r && r.sec > 0 ? Math.min(1, left / r.sec) : 0, ring = r ? `${(toMin(now5(p).slice(6)) ?? 0) + Math.ceil(left / 60)}` : '';
    return `${axBar(p, now, '#f2f2f4')}
      ${axTop(axCb('home2'))}
      <div class="ax_scroll">${axH1('타이머')}
        ${r ? `<div class="lf_ring"><svg viewBox="0 0 250 250">${ticks(frac)}<circle cx="125" cy="125" r="115" fill="none" stroke="#2b2c31" stroke-width="6"/><circle cx="125" cy="125" r="115" fill="none" stroke="#f5a524" stroke-width="6" stroke-linecap="round" stroke-dasharray="${C.toFixed(1)}" stroke-dashoffset="${(C * (1 - frac)).toFixed(1)}" transform="rotate(-90 125 125)"/>${frac > 0 ? `<circle cx="${(125 + 115 * Math.sin(frac * 2 * Math.PI)).toFixed(1)}" cy="${(125 - 115 * Math.cos(frac * 2 * Math.PI)).toFixed(1)}" r="8" fill="#f5a524" stroke="#17181b" stroke-width="3"/>` : ''}</svg>
          <div>${left ? `<b class="cg_num lf_dig"><span>${pad(Math.floor(left / 60))}</span><i>:</i><em>${pad(left % 60)}</em></b>` : '<b class="lf_dig">끝</b>'}<span>${esc(r.label || '타이머')} · ${Math.round((r.sec || 0) / 60)}분</span></div></div>
          ${left ? `<div class="lf_tend">끝나는 시각 <b class="cg_num">${esc(clockOf(p, Number(ring)))}</b></div>` : ''}
          <div class="lf_tbtn2"><span>${ax('x', 15, 'currentColor', 2.6)}취소</span><span class="a">${left ? `${ax('pause', 15, 'currentColor', 2.6)}일시정지` : `${ax('play', 15, 'currentColor', 2, 'currentColor')}다시`}</span></div>` : ''}
        <div class="lf_ch">저장된 타이머</div>
        ${ts.length ? `<div class="lf_dcard lf_svl">${ts.map(t => `<div class="lf_sv"><b class="cg_num">${Math.floor((t.sec || 0) / 60)}:${pad((t.sec || 0) % 60)}</b><span class="lf_mq"><span>${esc(t.label)}${t.ko && koOn() ? ` <em>${esc(t.ko)}</em>` : ''}</span></span><small>${t.last ? esc(fmtDate(p, t.last, true)) : ''}</small><i>${ax('play', 13, '#f5a524', 2, '#f5a524')}</i></div>`).join('')}</div>` : '<div class="lf_none">저장된 타이머가 없어요</div>'}
        <i class="lf_pad"></i></div>
      ${clockDock('timer')}${axInd('#f2f2f4')}`;
}
// a city's offset from the place the story is in, from their time zones (Intl knows the rules; the year is a guess)
const zoneMin = (tz, at) => { try { const f = new Intl.DateTimeFormat('en-US', { timeZone: tz, hour12: false, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).formatToParts(at); const g = k => Number(f.find(x => x.type === k)?.value); return Math.round((Date.UTC(g('year'), g('month') - 1, g('day'), g('hour') % 24, g('minute')) - at.getTime()) / 6e4); } catch { return null; } };
const COUNTRY_TZ = { KR: 'Asia/Seoul', JP: 'Asia/Tokyo', CN: 'Asia/Shanghai', TW: 'Asia/Taipei', HK: 'Asia/Hong_Kong', SG: 'Asia/Singapore', TH: 'Asia/Bangkok', VN: 'Asia/Ho_Chi_Minh', ID: 'Asia/Jakarta', PH: 'Asia/Manila', MY: 'Asia/Singapore', IN: 'Asia/Kolkata', AE: 'Asia/Dubai', IL: 'Asia/Jerusalem', TR: 'Europe/Istanbul', RU: 'Europe/Moscow',
    GB: 'Europe/London', IE: 'Europe/Dublin', PT: 'Europe/Lisbon', ES: 'Europe/Madrid', FR: 'Europe/Paris', BE: 'Europe/Brussels', NL: 'Europe/Amsterdam', DE: 'Europe/Berlin', CH: 'Europe/Zurich', AT: 'Europe/Vienna', IT: 'Europe/Rome', CZ: 'Europe/Prague', PL: 'Europe/Warsaw', DK: 'Europe/Copenhagen', SE: 'Europe/Stockholm', NO: 'Europe/Oslo', FI: 'Europe/Helsinki', GR: 'Europe/Athens', UA: 'Europe/Kyiv', IS: 'Atlantic/Reykjavik',
    EG: 'Africa/Cairo', NG: 'Africa/Lagos', KE: 'Africa/Nairobi', ZA: 'Africa/Johannesburg', MA: 'Africa/Casablanca', US: 'America/New_York', CA: 'America/Toronto', MX: 'America/Mexico_City', CO: 'America/Bogota', PE: 'America/Lima', BR: 'America/Sao_Paulo', AR: 'America/Buenos_Aires', CL: 'America/Santiago', AU: 'Australia/Sydney', NZ: 'Pacific/Auckland' };
// the time zone the story is in: a saved city its place names, else the owner's country (home), else the first saved city
const hereZone = (lf, p = null, place = hereNow(lf).place) => { const pl = String(place || '').toLowerCase(); return lf.weather.cities.find(c => c.tz && pl && (pl.includes(c.name.toLowerCase()) || c.name.toLowerCase().includes(pl.split(/[ ,]/)[0])))?.tz || COUNTRY_TZ[String(p?.lives || p?.country || '').toUpperCase()] || lf.weather.cities.find(c => c.tz)?.tz || ''; };
// sunrise and sunset for a day at a time zone's city (NOAA's equations on the zone's latitude and longitude), local "HH:MM"
function sunOf(date, tz) {
    const at = TZ_AT[tz], d = realDate(date, 12);
    if (!at || !d) return null;
    const [lat, lon] = at, rad = Math.PI / 180, N = Math.floor((d - Date.UTC(d.getUTCFullYear(), 0, 1)) / 864e5), g = 2 * Math.PI / 365 * N;
    const eq = 229.18 * (0.000075 + 0.001868 * Math.cos(g) - 0.032077 * Math.sin(g) - 0.014615 * Math.cos(2 * g) - 0.040849 * Math.sin(2 * g));
    const dec = 0.006918 - 0.399912 * Math.cos(g) + 0.070257 * Math.sin(g) - 0.006758 * Math.cos(2 * g) + 0.000907 * Math.sin(2 * g) - 0.002697 * Math.cos(3 * g) + 0.00148 * Math.sin(3 * g);
    const cosHa = Math.cos(90.833 * rad) / (Math.cos(lat * rad) * Math.cos(dec)) - Math.tan(lat * rad) * Math.tan(dec);
    if (!(cosHa > -1 && cosHa < 1)) return null;
    const ha = Math.acos(cosHa) / rad, off = zoneMin(tz, d) ?? 0;
    return [hm(Math.round(720 - 4 * (lon + ha) - eq + off)), hm(Math.round(720 - 4 * (lon - ha) - eq + off))];
}
function cityTime(p, lf, c) {
    const n = now5(p), at = realDate(n, 12) || new Date();
    const here = hereZone(lf, p), a = c.tz ? zoneMin(c.tz, at) : null, b = here ? zoneMin(here, at) : a;
    const off = a !== null && b !== null ? Math.round((a - b) / 60) : 0, t = toMin(n.slice(6)) ?? toMin(lf.weather.here.time) ?? 12 * 60;
    const sun = c.sunrise && c.sunset ? [c.sunrise, c.sunset] : sunOf(n.slice(0, 5), c.tz) || [];
    const local = t + off * 60, night = (() => { const ss = toMin(sun[1]) ?? 18 * 60, sr = toMin(sun[0]) ?? 6 * 60 + 30; const l = ((local % 1440) + 1440) % 1440; return l >= ss || l < sr; })();
    return { off, time: hm(local), night, date: n.slice(0, 5), dayShift: local >= 1440 ? '내일' : local < 0 ? '어제' : '오늘' };
}
// the world map card: grid paper, the land, tonight's shadow (from the story's date and time), a pin per saved city
const geo = (lat, lon) => [((lon + 180) / 360 * MAP_W), ((MAP_TOP - lat) / (MAP_TOP - MAP_BOT) * MAP_H)];
const cityAt = (c, hereTz, off) => { const at = TZ_AT[c.tz] || TZ_AT[hereTz]; return at ? [at[0], at[1] + (TZ_AT[c.tz] ? 0 : off * 15)] : [45, Math.max(-170, Math.min(170, off * 15))]; };
function worldMap(p, lf, rows) {
    const here = hereZone(lf, p), cw = MAP_W / DOT_C, ch = MAP_H / DOT_R;
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
    // the saved city the owner is in is the 현재 위치 row (its note, like 우리 집, goes with it), not a second row
    const hn = hereNow(lf), same = cityOfPlace(hn.place, lf.weather.cities), here = { name: hn.place || '현재 위치', tz: hereZone(lf, p, hn.place), sunset: hn.tiles?.sunset || '', note: same?.note || '' };
    const rows = [here, ...lf.weather.cities.filter(c => c !== same && c.name !== here.name)].map(c => ({ c, t: cityTime(p, lf, c) }));
    return `${axBar(p, now, '#f2f2f4')}
      ${axTop(axCb('home2'))}
      <div class="ax_scroll">${axH1('세계 시계')}
        ${worldMap(p, lf, rows)}
        <div class="lf_dcard">${rows.map(({ c, t }, k) => `<div class="lf_wc">${face(toMin(t.time), t.night)}<span class="lf_wct"><small>${k ? `${t.dayShift}, ${t.off >= 0 ? '+' : '−'}${Math.abs(t.off)}시간` : '현재 위치'}${c.note ? ` · ${esc(c.note)}` : ''}</small><b>${esc(c.name)}</b></span><b class="cg_num">${esc(clockNum(p, t.time))}</b></div>`).join('')}</div>
        <i class="lf_pad"></i></div>
      ${clockDock('wclock')}${axInd('#f2f2f4')}`;
}

// ================= 건강 =================
// one palette for the whole app (peach · mint · lavender blue); everything below the model's numbers is worked out here:
// the rings, the day's hours of steps and heart rate, the calories, water and coffee, the weight line, a workout's map
const HC = { steps: '#f29e8e', run: '#6cbfa8', sleep: '#8f9fe6', hr: '#ec8597', kcal: '#f3a77c', water: '#7fb0e8', caf: '#b8927a', w: '#a99be0' };
const HB = { steps: '#fde4de', run: '#d8f1e9', sleep: '#e2e7fb', hr: '#fbe3e8', kcal: '#fdebdf', water: '#e2eefb', caf: '#f1e7df', w: '#ece8fa' };
Object.assign(AX, {
    flame: 'M12 21c-4 0-6-3-5-6.5C8 11 10 11 10 7c3 2 4.5 4.5 4.5 6 1-1 1.2-2.3 1-3.5C18 11.5 18 14 18 15.5 18 18.5 15.5 21 12 21z',
    cupH: 'M5 8h11v6a5 5 0 0 1-5 5h-1a5 5 0 0 1-5-5zM16 9h1.5a2.5 2.5 0 0 1 0 5H16M8 3v2M11 3v2', scaleH: 'M5 4h14a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1zM8.5 9a4 3 0 0 1 7 0M12 9l1.2-2',
});
const lastDays = (lf, n = 7, until = '') => { const ds = lf.health.days.filter(d => !until || dayGap(d.date, until) >= 0); return ds.slice(-n); };
const sleepMin = d => { const a = toMin(d.sleep), b = toMin(d.wake); return a === null || b === null ? null : ((b - a) + 1440) % 1440; };
const avg = xs => { const v = xs.filter(x => x !== null && x !== undefined && Number.isFinite(x)); return v.length ? v.reduce((s, x) => s + x, 0) / v.length : null; };
// bedtimes past midnight count as late (00:30 is later than 23:30)
const lateMin = t => { const m = toMin(t); return m === null ? null : m < 12 * 60 ? m + 1440 : m; };
// the same numbers each time a day is drawn: a little random seeded by the date (and what it is for)
const seeded = (key) => { let s = [...String(key)].reduce((n, ch) => (n * 31 + ch.charCodeAt(0)) % 233280, 7); return () => { s = (s * 9301 + 49297) % 233280; return s / 233280; }; };
const usualSleep = u => (u.sleep && u.wake ? ((toMin(u.wake) - toMin(u.sleep)) + 1440) % 1440 : null);
const comma = v => (STORY.dot ? String(v) : String(v).replace('.', ','));
// a day's choice among 일 · 주 · 월, carried in data-i as "MM-DD|w"
const pickOf = (i = '') => { const [day, mode] = String(i || '').split('|'); return { day: day || '', mode: mode || '' }; };
const seg = (go, day, on, modes) => `<div class="lf_seg">${modes.map(([k, n]) => `<button type="button" data-go="${go}" data-i="${day}|${k}" class="${k === on ? 'on' : ''}">${n}</button>`).join('')}</div>`;
const hdays = (lf, pick) => `<div class="lf_hdays">${lf.health.days.slice(-7).map(d => `<button type="button" data-go="health" data-i="${d.date}" class="${d.date === pick ? 'on' : ''}">${wdk(d.date)}<b>${Number(d.date.slice(3))}</b></button>`).join('')}</div>`;
const ring = (r, f, c, bg) => { const C = 2 * Math.PI * r; return `<circle cx="62" cy="62" r="${r}" fill="none" stroke="${bg}" stroke-width="12"/>${f > 0 ? `<circle cx="62" cy="62" r="${r}" fill="none" stroke="${c}" stroke-width="12" stroke-linecap="round" stroke-dasharray="${(C * Math.min(Math.max(f, 0), 1)).toFixed(1)} ${C.toFixed(1)}" transform="rotate(-90 62 62)"/>` : ''}`; };
const minis = (vals, col, hi) => { const m = Math.max(1, ...vals.map(v => v || 0)), w = 54 / vals.length; return `<svg width="54" height="26" class="lf_hsp">${vals.map((v, k) => { const h = Math.max(3, (v || 0) / m * 26); return `<rect x="${(k * w + 1).toFixed(1)}" y="${(26 - h).toFixed(1)}" width="${(w - 3).toFixed(1)}" height="${h.toFixed(1)}" rx="2" fill="${k === hi ? col : '#eceef2'}"/>`; }).join('')}</svg>`; };
const hbar = (f, c, bg, h = 6) => `<i class="lf_hbar" style="background: ${bg}; height: ${h}px"><i style="width: ${Math.round(Math.min(Math.max(f, 0), 1) * 100)}%; background: ${c}"></i></i>`;

// ---- what the numbers make
const RUNS = /run|lauf|jog|달리|러닝|조깅/i, RIDES = /cycl|bike|rad|자전거|사이클/i, CALM = /yoga|pilates|stretch|요가|필라테스|스트레칭/i, SWIM = /swim|schwimm|수영/i;
// a workout as the (Korean) health app names it; a kind it doesn't know shows as written
const WORK_KO = [[/^(outdoor |indoor )?(run|running|jog|jogging|laufen|lauf|joggen|course|correr)$/i, '달리기'], [/^(walk|walking|spaziergang|gehen|marche)$/i, '걷기'], [/^(hike|hiking|wandern)$/i, '하이킹'],
    [/^(cycl|cycling|bike|biking|ride|radfahren|rad)$/i, '사이클'], [/^(swim|swimming|schwimmen)$/i, '수영'], [/^yoga$/i, '요가'], [/^pilates$/i, '필라테스'],
    [/^(strength|weights|gym|weight training|krafttraining|workout)$/i, '근력 운동'], [/^(hiit|crossfit)$/i, '고강도 운동'], [/^(stretch|stretching|dehnen)$/i, '스트레칭'], [/^(tennis)$/i, '테니스'], [/^(soccer|football|fußball)$/i, '축구']];
const workName = k => { const v = String(k || '').trim(); return (WORK_KO.find(([re]) => re.test(v)) || [])[1] || v; };
const kcalOf = d => Math.round((d.steps || 0) * 0.04 + (d.workout?.min || 0) * (d.workout ? (RUNS.test(d.workout.kind) ? 10 : RIDES.test(d.workout.kind) ? 8 : SWIM.test(d.workout.kind) ? 9 : CALM.test(d.workout.kind) ? 3.5 : 6) : 0));
const workKcal = w => Math.round((w?.min || 0) * (RUNS.test(w?.kind) ? 10 : RIDES.test(w?.kind) ? 8 : SWIM.test(w?.kind) ? 9 : CALM.test(w?.kind) ? 3.5 : 6));
// a day's steps over its hours: none asleep, a little on waking, more around noon and the evening, the workout's hour full
function hourSteps(d) {
    const out = Array(24).fill(0), total = d.steps || 0;
    if (!total) return out;
    // a day still going: its steps lie in the hours up to now
    const r = seeded(`${d.date}:steps`), wake = Math.floor((toMin(d.wake) ?? 420) / 60), sleep = toMin(d.sleep), end = d.partial && Number.isFinite(d.until) ? Math.max(wake, d.until) : 23;
    const wt = d.workout ? Math.floor((toMin(d.workout.time) ?? -60) / 60) : -1, wSteps = wt >= 0 && /walk|run|lauf|hike|걷|달리|러닝|산책|등산|조깅/i.test(d.workout.kind) ? Math.min(total * 0.6, (d.workout.km || d.workout.min / 10) * 1300) : 0;
    const w = out.map((_, h) => (h < wake || h > end ? 0 : h === wt ? 0 : (h === wake ? 0.5 : 1) * (0.4 + r() * 0.9) * ([8, 12, 13, 18, 19].includes(h) ? 2.2 : h >= 22 ? 0.3 : 1)));
    const sw = w.reduce((s, x) => s + x, 0) || 1;
    w.forEach((x, h) => { out[h] = Math.round((total - wSteps) * x / sw); });
    if (wt >= 0) out[wt] += Math.round(wSteps);
    void sleep;
    return out;
}
// the day's heart rate every 20 minutes: low asleep (until they woke), the workout's window high, between them resting
function hrDay(d, next) {
    const lo = d.hr?.[0] || 60, hi = d.hr?.[1] || lo + 50, r = seeded(`${d.date}:hr`), wake = toMin(d.wake) ?? 420, bed = next ? toMin(next.sleep) : null;
    const ws = d.workout ? toMin(d.workout.time) : null, we = ws === null ? null : ws + (d.workout.min || 30);
    const pts = [];
    for (let m = 0; m <= 1440; m += 20) {
        let v;
        if (m < wake || (bed !== null && bed > 720 && m >= bed)) v = lo + r() * 5;
        else if (ws !== null && m >= ws && m <= we) v = hi - 6 - r() * 14 + (m - ws < 10 ? -20 : 0);
        else if (ws !== null && m > we && m < we + 40) v = lo + 30 + r() * 10;
        else v = lo + 14 + r() * 18 + ([480, 760, 1100].some(t => Math.abs(m - t) < 40) ? 12 : 0);
        pts.push([m, Math.min(hi, Math.max(lo, Math.round(v)))]);
    }
    if (ws === null) { const k = pts.reduce((b, p, i) => (p[1] > pts[b][1] ? i : b), 0); pts[k][1] = hi; }
    // today: the line stops at now
    return Number.isFinite(d.upTo) ? pts.filter(q => q[0] <= d.upTo) : pts;
}
// water: their usual liters a day, a little more or less, drunk from soon after waking to the evening
function waterDay(d, u) {
    if (!u.water && !d.water) return null;
    // the day's own litres when the model gave them, else their usual a little more or less
    const r = seeded(`${d.date}:water`), cups = Math.max(1, Math.round(d.water ? d.water * 4 : u.water * 4 * (0.7 + r() * 0.55))), wake = toMin(d.wake) ?? 450, span = Math.max(240, 1290 - wake - 60);
    const all = Array.from({ length: cups }, (_, k) => ({ t: hm(wake + 45 + Math.round(span * (k + r() * 0.6) / cups)), ml: [200, 250, 250, 300][Math.floor(r() * 4)] }));
    // the day's own litres add up exactly: the glasses are scaled to them, the last one takes the rounding
    if (d.water) { const sum = all.reduce((n, x) => n + x.ml, 0), want = Math.round(d.water * 1000); all.forEach(x => { x.ml = Math.round(x.ml * want / sum / 10) * 10; }); all.at(-1).ml += want - all.reduce((n, x) => n + x.ml, 0); }
    // today: only the glasses drunk by now
    const log = Number.isFinite(d.upTo) ? all.filter(x => toMin(x.t) <= d.upTo) : all;
    return { ml: log.reduce((s, x) => s + x.ml, 0), log };
}
// coffee: their usual cups (the first soon after waking) and the coffee ordered for delivery that day, each its own row
const COFFEE = /coffee|kaffee|latte|americano|espresso|cappuccino|flat white|커피|아메리카노|라떼|카푸치노|에스프레소|콜드브루|cold brew/i;
const DECAF = /디카페인|decaf|koffeinfrei|entkoffeiniert|カフェインレス|デカフェ|无咖啡因|低咖啡因/i;
const CAFE = /caf[eé]|coffee|kaffee|espresso|starbucks|스타벅스|카페|커피|이디야|투썸|메가 ?커피|빽다방|컴포즈|할리스|폴 ?바셋|블루보틀|blue bottle|costa|tim hortons|dunkin|tchibo|doutor|ドトール|スタバ|tully|peet/i;
function coffeeDay(p, d, u) {
    const r = seeded(`${d.date}:coffee`), wake = toMin(d.wake) ?? 450, out = [];
    // a coffee paid for at a café that day (the bank's own row, not a delivery's) stands in for one of the usual cups
    const cafe = (p.money?.tx || []).filter(t => String(t.time).slice(0, 5) === d.date && t.amount < 0 && !t.delivery && CAFE.test(`${t.who || ''} ${t.ko || ''} ${t.memo || ''}`))
        .map(t => { const decaf = DECAF.test(`${t.who || ''} ${t.ko || ''} ${t.memo || ''}`); return { t: String(t.time).slice(6, 11) || hm(wake + 30), what: [t.ko || t.who, decaf ? '디카페인' : ''].filter(Boolean).join(' · '), mg: decaf ? 5 : 150, from: '' }; });
    // the day's own cups and drink when the model gave them, else their usual a little more or less
    const own = Number.isFinite(d.coffee), cups = own ? Math.max(0, d.coffee - cafe.length) : u.coffee ? Math.max(0, Math.round(u.coffee + (r() - 0.45) * 1.4) - cafe.length) : 0;
    out.push(...cafe);
    const what = d.coffeeKind || u.coffeeKo || u.coffeeKind || '커피', decaf = DECAF.test(what);
    // spread over the waking day: the first soon after waking, the rest through the afternoon and, for many, the evening
    for (let k = 0; k < cups; k++) out.push({ t: hm(k ? Math.min(1380, 660 + Math.round(r() * 120) + k * Math.round(560 / Math.max(1, cups))) : wake + 20 + Math.round(r() * 40)), what, mg: decaf ? 5 : 120, from: '' });
    for (const o of p.delivery?.orders || []) {
        if (String(o.time).slice(0, 5) !== d.date || o.status === 'cancelled') continue;
        for (const x of o.items || []) if (['coffee', 'iced-americano'].includes(x.pic?.base) || COFFEE.test(`${x.name} ${x.ko || ''}`)) for (let q = 0; q < (x.qty || 1); q++) out.push({ t: String(o.time).slice(6, 11), what: x.ko || x.name, mg: DECAF.test(`${x.name} ${x.ko || ''} ${x.option || ''} ${x.optionKo || ''}`) ? 5 : 150, from: o.shop });
    }
    // today: only the cups had by now
    return out.filter(x => !Number.isFinite(d.upTo) || (toMin(x.t) ?? 0) <= d.upTo).sort((a, b) => toMin(a.t) - toMin(b.t));
}
// weight: their usual, drifting a few hundred grams a day around it (seeded), the last 30 days
function weightLine(lf, u, until) {
    if (!u.weight && !lf.health.days.some(d => Number.isFinite(d.weight))) return [];
    const ds = lf.health.days.filter(d => dayGap(d.date, until) >= 0).slice(-30);
    // a day they weighed stands as written; the days between drift from the last one weighed toward their usual
    const base = u.weight || ds.find(d => Number.isFinite(d.weight))?.weight;
    let v = ds[0]?.weight ?? base + (seeded(`${ds[0]?.date}:w0`)() - 0.5) * 0.8, anchor = null;
    return ds.map(d => { if (Number.isFinite(d.weight)) { v = d.weight; anchor = d.weight; return { date: d.date, kg: d.weight }; } const r = seeded(`${d.date}:w`), target = anchor ?? base; v += (r() - 0.5) * 0.5 + (target - v) * 0.15; return { date: d.date, kg: Math.round(v * 10) / 10 }; });
}
// one sentence for the day: the biggest thing the numbers say against the day before or the usual
// steps up to a minute of the day, from the day's hours
const stepsBy = (d, min) => { const hs = hourSteps(d), h = Math.floor(min / 60); return Math.round(hs.slice(0, h).reduce((s, x) => s + x, 0) + (hs[h] || 0) * (min % 60) / 60); };
// yday: yesterday's own line, shown when today has nothing to say yet (only against their usual, said as "어제")
function highlight(lf, d, u, yday = false) {
    const p = STORY.p, ds = lf.health.days, prev = ds[ds.indexOf(d) - 1], sm = sleepMin(d), us = usualSleep(u), Y = yday ? '어제 ' : '';
    if (d.workout && (yday || !prev?.workout)) return ['run', `${Y}${esc(workName(d.workout.kind))} ${d.workout.min || ''}분을 했어요`, d.workout.km ? `${comma(d.workout.km)} km · ${clockOf(p, d.workout.time)}` : clockOf(p, d.workout.time)];
    // a day still going is set against yesterday by this same time, not a whole day ("어제 이맘때보다")
    const going = Number.isFinite(d.upTo);
    if (going && prev?.steps && d.steps !== null && d.steps !== undefined) { const was = stepsBy(prev, d.upTo); if (Math.abs(d.steps - was) >= 1500) return ['walk', `어제 이맘때보다 ${n0(Math.abs(d.steps - was))}걸음 ${d.steps > was ? '더' : '덜'} 걸었어요`, `${n0(was)} → ${n0(d.steps)}`]; }
    if (!yday && !going && prev?.steps && d.steps && Math.abs(d.steps - prev.steps) >= 1500) return ['walk', `전날보다 ${n0(Math.abs(d.steps - prev.steps))}걸음 ${d.steps > prev.steps ? '더' : '덜'} 걸었어요`, `${n0(prev.steps)} → ${n0(d.steps)}`];
    if (sm !== null && us && Math.abs(sm - us) >= 60) return ['moon', `${Y}평소보다 ${dur(Math.abs(sm - us))} ${sm > us ? '더' : '덜'} 잤어요`, `${clockOf(p, d.sleep)} – ${clockOf(p, d.wake)}`];
    if (!going && u.steps && d.steps && Math.abs(d.steps - u.steps) >= 1500) return ['walk', `${Y}평소보다 ${n0(Math.abs(d.steps - u.steps))}걸음 ${d.steps > u.steps ? '더' : '덜'} 걸었어요`, `평소 ${n0(u.steps)}`];
    return null;
}
const htile = (go, i, c, ic, name, body) => `<button type="button" class="lf_hc lf_ht" ${go ? `data-go="${go}" data-i="${i}"` : ''}><span class="lf_hl" style="color: ${c}">${ax(ic, 14, c, 2.2, ic === 'heartF' || ic === 'flame' || ic === 'drop' ? c : 'none')}${name}</span>${body}</button>`;
export function healthScreen(p, now, pick = '') {
    const lf = L(p);
    if (!lf) return lifeEmpty(p, now, '건강', 'life');
    const ds = lf.health.days, d = ds.find(x => x.date === pick) || ds.at(-1), u = lf.health.usual || {};
    if (!d) return `${axBar(p, now)}${axTop(axCb('home2'))}<div class="ax_scroll">${axH1('건강')}<div class="lf_none">기록이 없어요</div></div>${axInd()}`;
    const wk = lastDays(lf, 7, d.date), i = wk.indexOf(d), sm = sleepMin(d), us = usualSleep(u), lastRun = [...ds].reverse().find(x => x.workout && dayGap(x.date, d.date) >= 0);
    const goalSteps = u.steps || 8000, goalWork = 30, wmin = d.workout?.min || 0, water = waterDay(d, u), cof = coffeeDay(p, d, u), wl = weightLine(lf, u, d.date);
    // a day still going with nothing to say yet: yesterday's line, and yesterday's water and coffee under today's empty ones
    const yd = Number.isFinite(d.upTo) ? lf.health.days[lf.health.days.indexOf(d) - 1] : null, hl = highlight(lf, d, u) || (yd ? highlight(lf, yd, u, true) : null);
    const ywater = yd && water && !water.ml ? waterDay(yd, u) : null, ycof = yd && !cof.length ? coffeeDay(p, yd, u) : [];
    const rl = (c, n, v, s) => `<div class="lf_rl"><small style="color: ${c}">${n}</small><b class="cg_num">${v}</b><span>${s}</span></div>`;
    return `${axBar(p, now)}
      ${axTop(axCb('home2'), '<button type="button" class="lf_pill hl" data-go="hcmp">평소와 비교</button>')}
      <div class="ax_scroll">${axH1('요약', `${fmtDate(p, d.date)}`)}
        ${hdays(lf, d.date)}
        <div class="lf_hring"><svg width="124" height="124">${ring(55, (d.steps || 0) / goalSteps, HC.steps, HB.steps)}${ring(41, wmin / goalWork, HC.run, HB.run)}${ring(27, us && sm !== null ? sm / us : 0, HC.sleep, HB.sleep)}</svg>
          <div>${rl(HC.steps, '걸음', n0(d.steps), `/ ${u.steps ? `평소 ${n0(u.steps)}` : n0(goalSteps)}`)}${rl(HC.run, '운동', wmin, `/ ${goalWork}분`)}${rl(HC.sleep, '수면', sm === null ? '—' : `${Math.floor(sm / 60)}:${pad(sm % 60)}`, us ? `/ ${Math.floor(us / 60)}:${pad(us % 60)}` : '')}</div></div>
        ${hl ? `<div class="lf_hc lf_hhi"><span style="background: ${HB[hl[0] === 'run' ? 'run' : hl[0] === 'moon' ? 'sleep' : 'steps']}">${ax(hl[0], 16, HC[hl[0] === 'run' ? 'run' : hl[0] === 'moon' ? 'sleep' : 'steps'], 2.2)}</span><div><b>${hl[1]}</b><small>${hl[2]}</small></div></div>` : ''}
        <div class="lf_hgrid">
          ${htile('hsteps', d.date, HC.steps, 'walk', '걸음', `<span class="lf_hv"><span><b class="cg_num">${n0(d.steps)}</b></span>${minis(wk.map(x => x.steps), HC.steps, i)}</span>`)}
          ${htile('hsleep', d.date, HC.sleep, 'moon', '수면', `<span class="lf_hv"><span>${sm === null ? '<b class="cg_num">—</b>' : `<b class="cg_num">${Math.floor(sm / 60)}</b>시간 <b class="cg_num">${sm % 60}</b>분`}<small>${d.sleep && d.wake ? `${clockOf(p, d.sleep)} – ${clockOf(p, d.wake)}` : ''}</small></span></span>`)}
          ${htile(d.workout ? 'hwork' : '', d.date, HC.run, 'run', '운동', `<span class="lf_hv"><span><b class="cg_num">${wmin}</b>분${d.workout ? ` · ${esc(workName(d.workout.kind))}` : ''}<small>${d.workout ? `${d.workout.km ? `${comma(d.workout.km)} km · ` : ''}${clockOf(p, d.workout.time)}` : lastRun ? `마지막 ${esc(fmtDate(p, lastRun.date, true))}` : ''}</small></span></span>`)}
          ${htile(d.hr?.length === 2 ? 'hheart' : '', d.date, HC.hr, 'heartF', '심박수', `<span class="lf_hv"><span>${d.hr?.length === 2 ? `<b class="cg_num">${d.hr[0]}–${d.hr[1]}</b>BPM` : '<b class="cg_num">—</b>'}<small>${u.rest ? `안정 시 평소 ${u.rest}` : ''}</small></span></span>`)}
          ${htile('', '', HC.kcal, 'flame', '활동 칼로리', `<span class="lf_hv"><span><b class="cg_num">${n0(kcalOf(d))}</b>kcal${hbar(kcalOf(d) / 500, HC.kcal, HB.kcal)}</span></span>`)}
          ${water ? htile('hwater', d.date, HC.water, 'drop', '물', `<span class="lf_hv"><span><b class="cg_num">${comma((water.ml / 1000).toFixed(1))}</b>/ ${comma(u.water)} L<i class="lf_hcups">${Array.from({ length: 8 }, (_, k) => `<i style="background: ${k < Math.round(water.ml / 1000 / u.water * 8) ? HC.water : HB.water}"></i>`).join('')}</i>${ywater?.ml ? `<small>어제 ${comma((ywater.ml / 1000).toFixed(1))} L</small>` : ''}</span></span>`) : ''}
          ${u.coffee !== undefined && u.coffee !== null || cof.length ? htile('hwater', d.date, HC.caf, 'cupH', '카페인', `<span class="lf_hv"><span><b class="cg_num">${cof.length}</b>잔 · ${cof.reduce((s, x) => s + x.mg, 0)} mg<small>${cof.length ? `마지막 ${esc(clockOf(p, cof.at(-1).t))} ${esc(cof.at(-1).what)}` : ycof.length ? `어제 ${ycof.length}잔 · 마지막 ${esc(clockOf(p, ycof.at(-1).t))} ${esc(ycof.at(-1).what)}` : '오늘은 안 마셨어요'}</small></span></span>`) : ''}
          ${wl.length ? htile('hweight', d.date, HC.w, 'scaleH', '체중', `<span class="lf_hv"><span><b class="cg_num">${comma(wl.at(-1).kg.toFixed(1))}</b>kg<small>${wl.length > 1 ? `${wl.at(-1).kg <= wl[0].kg ? '▼' : '▲'} ${comma(Math.abs(wl.at(-1).kg - wl[0].kg).toFixed(1))} · ${wl.length}일` : ''}</small></span></span>`) : ''}
        </div>
        <i class="lf_pad"></i></div>
      ${axInd()}`;
}
// a chart card: bars over a time axis, with gridlines and an optional usual line
const hhead = (small, big, em) => `<div class="lf_big"><small>${small}</small><b class="cg_num">${big}</b><em>${em}</em></div>`;
export function stepsScreen(p, now, i) {
    const lf = L(p); if (!lf) return healthScreen(p, now);
    const { day, mode } = pickOf(i), m = mode || 'd', u = lf.health.usual || {};
    const all = lf.health.days, d = all.find(x => x.date === day) || all.at(-1);
    if (!d) return healthScreen(p, now);
    let chart, head, rows = '';
    if (m === 'd') {
        const hs = hourSteps(d), max = Math.max(1, ...hs), top = hs.indexOf(max);
        head = hhead('합계', `${n0(d.steps)} <span>걸음</span>`, esc(fmtDate(p, d.date)));
        chart = `<div class="lf_hc"><svg class="lf_hsvg" viewBox="0 0 300 124">${[0.5, 1].map(f => `<line x1="0" x2="300" y1="${120 - f * 110}" y2="${120 - f * 110}" class="g"/>`).join('')}<line x1="0" x2="300" y1="120" y2="120" class="g"/>${hs.map((v, h) => `<rect x="${(h * 12.4 + 2).toFixed(1)}" y="${(120 - v / max * 110).toFixed(1)}" width="8" height="${Math.max(1.5, v / max * 110).toFixed(1)}" rx="2.5" fill="${HC.steps}"/>`).join('')}</svg>
          <div class="lf_xl"><span>0시</span><span>6시</span><span>12시</span><span>18시</span><span>24시</span></div>${max ? `<div class="lf_hnote">가장 많이 걸은 때 · <b>${top}시 ${n0(max)}걸음</b></div>` : ''}</div>`;
        rows = `<div><span>거리</span><b class="cg_num">${d.km ? `${comma(d.km)} km` : '—'}</b></div><div><span>오른 층수</span><b class="cg_num">${d.floors ?? '—'}층</b></div>${u.steps && d.steps ? `<div><span>평소보다</span><b class="cg_num" style="color: ${HC.steps}">${d.steps >= u.steps ? '+' : '−'}${n0(Math.abs(d.steps - u.steps))}</b></div>` : ''}`;
    } else {
        const wk = lastDays(lf, m === 'w' ? 7 : 30, d.date), max = Math.max(10000, ...wk.map(x => x.steps || 0), u.steps || 0), top = Math.ceil(max / 5000) * 5000, a = avg(wk.map(x => x.steps)), bw = 300 / wk.length;
        head = hhead('평균', `${n0(a === null ? null : Math.round(a))} <span>걸음</span>`, wk.length ? `${esc(fmtDate(p, wk[0].date, true))} – ${esc(fmtDate(p, wk.at(-1).date, true))}` : '');
        const y = v => 120 - v / top * 110;
        chart = `<div class="lf_hc"><svg class="lf_hsvg" viewBox="0 0 300 124">${[0.5, 1].map(f => `<line x1="0" x2="300" y1="${y(top * f)}" y2="${y(top * f)}" class="g"/><text x="298" y="${y(top * f) - 3}" text-anchor="end">${n0(top * f)}</text>`).join('')}
          ${u.steps ? `<line x1="0" x2="300" y1="${y(u.steps)}" y2="${y(u.steps)}" class="av" stroke="${HC.steps}"/>` : ''}
          ${wk.map((x, k) => `<rect x="${(k * bw + bw * 0.18).toFixed(1)}" y="${y(x.steps || 0).toFixed(1)}" width="${(bw * 0.64).toFixed(1)}" height="${Math.max(2, 120 - y(x.steps || 0)).toFixed(1)}" rx="${Math.min(6, bw * 0.2).toFixed(1)}" fill="${x === d ? HC.steps : HB.steps}"/>`).join('')}</svg>
          <div class="lf_xl">${m === 'w' ? wk.map(x => `<span class="${x === d ? 'on' : ''}">${wdk(x.date, String(Number(x.date.slice(3))))}</span>`).join('') : [wk[0], wk[Math.floor(wk.length / 2)], wk.at(-1)].filter(Boolean).map(x => `<span>${esc(fmtDate(p, x.date, true))}</span>`).join('')}</div>${u.steps ? `<div class="lf_hnote"><i style="border-color: ${HC.steps}"></i>평소 ${n0(u.steps)}걸음</div>` : ''}</div>`;
        rows = `<div><span>가장 많이 걸은 날</span><b>${(() => { const b = wk.reduce((x, y2) => ((y2.steps || 0) > (x.steps || 0) ? y2 : x), wk[0]); return b ? `${esc(fmtDate(p, b.date, true))} · ${n0(b.steps)}` : '—'; })()}</b></div><div><span>합계</span><b class="cg_num">${n0(wk.reduce((s, x) => s + (x.steps || 0), 0))}걸음</b></div>`;
    }
    return `${axBar(p, now)}${axTop(axCb(`health:${d.date}`))}
      <div class="ax_scroll">${axH1('걸음')}${seg('hsteps', d.date, m, [['d', '일'], ['w', '주'], ['m', '월']])}${head}${chart}
        <div class="lf_hc lf_rows">${rows}</div><i class="lf_pad"></i></div>${axInd()}`;
}
// sleep stages: drawn from when they fell asleep and woke and how often they woke (seeded by the date, so it stays put)
function stages(d) {
    const s = toMin(d.sleep), total = sleepMin(d);
    if (s === null || !total) return [];
    const rnd = seeded(d.date);
    const out = [], wakes = new Set(Array.from({ length: d.woke || 0 }, (_, k) => Math.floor((k + 1) * total / ((d.woke || 0) + 1))));
    let t = 0;
    while (t < total) {
        const cyc = t / total, lvl = rnd() < (cyc < 0.4 ? 0.35 : 0.12) ? 'deep' : rnd() < (cyc > 0.5 ? 0.45 : 0.2) ? 'rem' : 'core';
        const len = Math.min(total - t, Math.round(12 + rnd() * 30));
        const w = [...wakes].find(x => x >= t && x < t + len);
        if (w !== undefined) { if (w > t) out.push({ lvl, a: t, b: w }); out.push({ lvl: 'awake', a: w, b: Math.min(total, w + 5) }); wakes.delete(w); t = Math.min(total, w + 5); continue; }
        out.push({ lvl, a: t, b: t + len }); t += len;
    }
    // neighbours of one stage join into one block
    return out.reduce((a, x) => { const l = a.at(-1); if (l && l.lvl === x.lvl) l.b = x.b; else a.push({ ...x }); return a; }, []).map(x => ({ ...x, s }));
}
const ST = { awake: ['깸', '#f3b38a', 0], rem: ['렘', '#9fd3ef', 1], core: ['코어', HC.sleep, 2], deep: ['깊은', '#5f6fc9', 3] };
export function sleepScreen(p, now, i) {
    const lf = L(p); if (!lf) return healthScreen(p, now);
    const { day, mode } = pickOf(i), m = mode || 'd', u = lf.health.usual || {};
    const d = lf.health.days.find(x => x.date === day) || lf.health.days.at(-1);
    if (!d) return healthScreen(p, now);
    let body;
    if (m === 'd') {
        const total = sleepMin(d), st = stages(d), sum = k => st.filter(x => x.lvl === k).reduce((n, x) => n + x.b - x.a, 0), X0 = 34, W = 300, H = 34;
        const x = t => X0 + (W - X0) * t / (total || 1), y = l => 8 + ST[l][2] * H;
        const hyp = st.map((s, k) => `${k ? `<line x1="${x(s.a).toFixed(1)}" x2="${x(s.a).toFixed(1)}" y1="${Math.min(y(s.lvl), y(st[k - 1].lvl)) + 8}" y2="${Math.max(y(s.lvl), y(st[k - 1].lvl)) + 8}" class="cn"/>` : ''}<rect x="${x(s.a).toFixed(1)}" y="${y(s.lvl)}" width="${Math.max(2, x(s.b) - x(s.a)).toFixed(1)}" height="16" rx="6" fill="${ST[s.lvl][1]}"/>`).join('');
        body = `${hhead('수면 시간', total === null ? '—' : durBig(total), `${esc(fmtDate(p, d.date))} · ${clockOf(p, d.sleep)} – ${clockOf(p, d.wake)}`)}
          ${total ? `<div class="lf_hc"><svg class="lf_hsvg" viewBox="0 0 300 146">${Object.values(ST).map(([n, , l]) => `<line x1="${X0}" x2="${W}" y1="${16 + l * H}" y2="${16 + l * H}" class="g" stroke-dasharray="2 3"/><text x="0" y="${20 + l * H}">${n}</text>`).join('')}${hyp}</svg>
            <div class="lf_xl" style="padding-left: 34px">${[0, 1, 2, 3].map(k => `<span>${clockNum(p, (toMin(d.sleep) ?? 0) + Math.round(total * k / 3))}</span>`).join('')}</div></div>
          <div class="lf_hc lf_hst">${Object.entries(ST).map(([k, [n, c]]) => `<div><span>${n}</span>${hbar(sum(k) / total, c, '#f0f1f3', 8)}<b class="cg_num">${k === 'awake' ? `${d.woke || 0}번 · ` : ''}${dur(sum(k))}</b></div>`).join('')}</div>` : ''}
          <div class="lf_hc lf_rows"><div><span>침대에 누운 시간</span><b class="cg_num">${clockOf(p, d.bed) || '—'}</b></div>${d.bed && d.sleep ? `<div><span>잠들기까지</span><b class="cg_num">${dur(((toMin(d.sleep) - toMin(d.bed)) + 1440) % 1440)}</b></div>` : ''}${u.sleep ? `<div><span>평소 잠든 시각</span><b class="cg_num">${clockOf(p, u.sleep)}</b></div>` : ''}</div>`;
    } else {
        const wk = lastDays(lf, m === 'w' ? 7 : 30, d.date).filter(x => x.sleep && x.wake), base = 20 * 60;
        const off = t => { const v = toMin(t); return v === null ? 0 : ((v - base) + 1440) % 1440; }, lo = Math.min(...wk.map(x => off(x.sleep)), 120), hi = Math.max(...wk.map(x => off(x.wake)), lo + 420);
        const top = Math.floor(lo / 60) * 60, bot = Math.ceil(hi / 60) * 60, Y = v => 8 + (v - top) / (bot - top || 1) * 170, bw = 270 / Math.max(1, wk.length);
        const ticks = []; for (let t = top; t <= bot; t += Math.max(60, Math.round((bot - top) / 4 / 60) * 60)) ticks.push(t);
        const a = avg(wk.map(sleepMin));
        body = `${hhead('평균 수면', a === null ? '—' : durBig(Math.round(a)), wk.length ? `${esc(fmtDate(p, wk[0].date, true))} – ${esc(fmtDate(p, wk.at(-1).date, true))}` : '')}
          <div class="lf_hc"><svg class="lf_hsvg" viewBox="0 0 300 186">${ticks.map(t => `<line x1="30" x2="300" y1="${Y(t).toFixed(1)}" y2="${Y(t).toFixed(1)}" class="g"/><text x="0" y="${(Y(t) + 4).toFixed(1)}">${clockNum(p, t + base)}</text>`).join('')}
            ${u.sleep ? `<line x1="30" x2="300" y1="${Y(off(u.sleep)).toFixed(1)}" y2="${Y(off(u.sleep)).toFixed(1)}" class="av" stroke="${HC.sleep}"/>` : ''}
            ${wk.map((x, k) => `<rect x="${(30 + k * bw + bw * 0.2).toFixed(1)}" y="${Y(off(x.sleep)).toFixed(1)}" width="${(bw * 0.6).toFixed(1)}" height="${Math.max(4, Y(off(x.wake)) - Y(off(x.sleep))).toFixed(1)}" rx="${Math.min(7, bw * 0.25).toFixed(1)}" fill="${x === d ? HC.sleep : HB.sleep}"/>`).join('')}</svg>
            <div class="lf_xl" style="padding-left: 30px">${m === 'w' ? wk.map(x => `<span class="${x === d ? 'on' : ''}">${wdk(x.date, String(Number(x.date.slice(3))))}</span>`).join('') : [wk[0], wk.at(-1)].filter(Boolean).map(x => `<span>${esc(fmtDate(p, x.date, true))}</span>`).join('')}</div>${u.sleep ? `<div class="lf_hnote"><i style="border-color: ${HC.sleep}"></i>평소 잠드는 시각 ${clockOf(p, u.sleep)}</div>` : ''}</div>
          <div class="lf_hc lf_rows"><div><span>평균 잠든 시각</span><b class="cg_num">${wk.length ? clockOf(p, Math.round(avg(wk.map(x => off(x.sleep)))) + base) : '—'}</b></div><div><span>평균 깬 시각</span><b class="cg_num">${wk.length ? clockOf(p, Math.round(avg(wk.map(x => off(x.wake)))) + base) : '—'}</b></div>${wk.length ? (() => { const l = wk.reduce((x, y2) => (off(y2.sleep) > off(x.sleep) ? y2 : x)); return `<div><span>가장 늦게 잔 날</span><b>${wdk(l.date, String(Number(l.date.slice(3))))} · ${clockOf(p, l.sleep)}</b></div>`; })() : ''}</div>`;
    }
    return `${axBar(p, now)}${axTop(axCb(`health:${d.date}`))}
      <div class="ax_scroll">${axH1('수면')}${seg('hsleep', d.date, m, [['d', '일'], ['w', '주'], ['m', '월']])}${body}<i class="lf_pad"></i></div>${axInd()}`;
}
// a workout: its kind, a loop on a little map when it went somewhere, the numbers and heart-rate zones
export function workScreen(p, now, day) {
    const lf = L(p); if (!lf) return healthScreen(p, now);
    const d = lf.health.days.find(x => x.date === day && x.workout) || [...lf.health.days].reverse().find(x => x.workout);
    if (!d) return healthScreen(p, now);
    const w = d.workout, r = seeded(`${d.date}:route`), moved = !!w.km, ic = RUNS.test(w.kind) ? 'run' : 'walk';
    const end = toMin(w.time) === null ? '' : hm(toMin(w.time) + (w.min || 0)), avgHr = d.hr?.length === 2 ? Math.round(d.hr[1] - 8 - r() * 10) : null;
    const pace = w.km && w.min ? w.min / w.km : null;
    const pts = Array.from({ length: 7 }, (_, k) => { const a = k / 7 * Math.PI * 2, rr = 46 + r() * 22; return [166 + Math.cos(a) * rr * 1.5, 76 + Math.sin(a) * rr * 0.75]; });
    const path = `M${pts[0][0].toFixed(0)} ${pts[0][1].toFixed(0)} ${pts.map((q, k) => { const n = pts[(k + 1) % 7]; return `Q${q[0].toFixed(0)} ${q[1].toFixed(0)} ${((q[0] + n[0]) / 2).toFixed(0)} ${((q[1] + n[1]) / 2).toFixed(0)}`; }).join(' ')} Z`;
    const zones = [0.1 + r() * 0.15, 0.3 + r() * 0.2, 0.2 + r() * 0.15, r() * 0.1], zs = zones.reduce((s, x) => s + x, 0);
    const stat = (n, v, u2, c) => `<div><small>${n}</small><b class="cg_num" style="color: ${c}">${v}</b><span>${u2}</span></div>`;
    return `${axBar(p, now)}${axTop(axCb(`health:${d.date}`))}
      <div class="ax_scroll"><div class="lf_hwh"><span style="background: ${HB.run}">${ax(ic, 26, HC.run, 2.2)}</span><div><b>${esc(workName(w.kind))}</b><small>${esc(fmtDate(p, d.date))}${w.time ? ` · ${clockOf(p, w.time)}${end ? ` – ${clockOf(p, end)}` : ''}` : ''}</small></div></div>
        ${moved ? `<div class="lf_hc lf_hmap"><svg viewBox="0 0 332 150"><rect width="332" height="150" fill="#eaf1ec"/><path d="M0 38H332M0 112H332M92 0V150M236 0V150" stroke="#f7faf6" stroke-width="10"/><path d="M0 70Q160 56 332 92" stroke="#d6e6f4" stroke-width="14" fill="none"/><path d="${path}" stroke="${HC.run}" stroke-width="5" fill="none" stroke-linejoin="round"/><circle cx="${pts[0][0].toFixed(0)}" cy="${pts[0][1].toFixed(0)}" r="6" fill="#fff" stroke="${HC.run}" stroke-width="3"/></svg></div>` : ''}
        <div class="lf_hc lf_hstat">${stat('운동 시간', w.min ? `${w.min}:00` : '—', '', HC.run)}${stat('거리', w.km ? comma(w.km) : '—', w.km ? 'km' : '', HC.water)}${pace ? stat('평균 페이스', `${Math.floor(pace)}′${pad(Math.round((pace % 1) * 60))}″`, '/km', '#161b22') : ''}${stat('활동 칼로리', workKcal(w), 'kcal', HC.kcal)}${avgHr ? stat('평균 심박수', avgHr, 'BPM', HC.hr) : ''}${d.hr?.[1] ? stat('최고 심박수', d.hr[1], 'BPM', HC.hr) : ''}</div>
        ${avgHr && w.min ? `<div class="lf_hc lf_hst"><span class="lf_hl" style="color: ${HC.hr}">${ax('heartF', 14, HC.hr, 2.2, HC.hr)}심박수 구간</span>${zones.map((z, k) => { const mn = Math.round(w.min * z / zs); return `<div><span>구간 ${k + 2}</span>${hbar(z / zs, ['#9fd3ef', '#9fd8b8', '#f6c98a', HC.hr][k], '#f0f1f3', 8)}<b class="cg_num">${mn}분</b></div>`; }).join('')}</div>` : ''}
        <i class="lf_pad"></i></div>${axInd()}`;
}
export function heartScreen(p, now, day) {
    const lf = L(p); if (!lf) return healthScreen(p, now);
    const ds = lf.health.days, d = ds.find(x => x.date === day) || ds.at(-1), u = lf.health.usual || {};
    if (!d || d.hr?.length !== 2) return healthScreen(p, now);
    const pts = hrDay(d, ds[ds.indexOf(d) + 1]), lo = Math.min(40, d.hr[0] - 10), hi = Math.max(180, d.hr[1] + 10), X = m => m / 1440 * 300, Y = v => 132 - (v - lo) / (hi - lo) * 124;
    const wake = toMin(d.wake), ws = d.workout ? toMin(d.workout.time) : null;
    const rest = Math.round(avg(pts.filter(q => wake === null || q[0] < wake).map(q => q[1])) || d.hr[0]), walking = Math.round(avg(pts.filter(q => wake !== null && q[0] >= wake && (ws === null || q[0] < ws || q[0] > ws + (d.workout.min || 0) + 40)).map(q => q[1])) || 0);
    return `${axBar(p, now)}${axTop(axCb(`health:${d.date}`))}
      <div class="ax_scroll">${axH1('심박수')}${hhead('범위', `${d.hr[0]}–${d.hr[1]} <span>BPM</span>`, esc(fmtDate(p, d.date)))}
        <div class="lf_hc"><svg class="lf_hsvg" viewBox="0 0 300 136">${wake !== null ? `<rect x="0" y="0" width="${X(wake).toFixed(1)}" height="134" fill="${HB.sleep}"/><text x="4" y="10" fill="${HC.sleep}">수면</text>` : ''}${ws !== null ? `<rect x="${X(ws).toFixed(1)}" y="0" width="${Math.max(3, X(d.workout.min || 30)).toFixed(1)}" height="134" fill="${HB.run}"/><text x="${(X(ws) + 3).toFixed(1)}" y="10" fill="${HC.run}">${esc(workName(d.workout.kind))}</text>` : ''}
          ${[60, 100, 140, 180].filter(b => b > lo && b < hi).map(b => `<line x1="0" x2="300" y1="${Y(b).toFixed(1)}" y2="${Y(b).toFixed(1)}" class="g"/><text x="298" y="${(Y(b) - 3).toFixed(1)}" text-anchor="end">${b}</text>`).join('')}
          <polyline points="${pts.map(q => `${X(q[0]).toFixed(1)},${Y(q[1]).toFixed(1)}`).join(' ')}" fill="none" stroke="${HC.hr}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/></svg>
          <div class="lf_xl"><span>0시</span><span>6시</span><span>12시</span><span>18시</span><span>24시</span></div></div>
        <div class="lf_hc lf_rows"><div><span>안정 시 심박수</span><b class="cg_num">${rest} BPM</b></div>${walking ? `<div><span>깨어 있을 때 평균</span><b class="cg_num">${walking} BPM</b></div>` : ''}${u.rest ? `<div><span>평소 안정 시</span><b class="cg_num">${u.rest} BPM</b></div>` : ''}</div>
        <i class="lf_pad"></i></div>${axInd()}`;
}
export function waterScreen(p, now, day) {
    const lf = L(p); if (!lf) return healthScreen(p, now);
    const ds = lf.health.days, d = ds.find(x => x.date === day) || ds.at(-1), u = lf.health.usual || {};
    if (!d) return healthScreen(p, now);
    const wt = waterDay(d, u), cof = coffeeDay(p, d, u), mg = cof.reduce((s, x) => s + x.mg, 0);
    const cup = f => `<svg width="22" height="28" viewBox="0 0 22 28"><path d="M3 4h16l-2 21H5z" fill="${HB.water}"/>${f ? `<path d="M3.6 9h14.8l-1.6 16H5.2z" fill="${HC.water}"/>` : ''}<path d="M3 4h16l-2 21H5z" fill="none" stroke="#c9d6e0" stroke-width="1.2"/></svg>`;
    return `${axBar(p, now)}${axTop(axCb(`health:${d.date}`))}
      <div class="ax_scroll">${axH1('물 · 카페인', esc(fmtDate(p, d.date)))}
        ${wt ? `<div class="lf_hc"><span class="lf_hl" style="color: ${HC.water}">${ax('drop', 14, HC.water, 2.2, HC.water)}물<small>평소 ${comma(u.water)} L</small></span>
          <div class="lf_hbig"><b class="cg_num">${comma((wt.ml / 1000).toFixed(1))}</b>L · ${wt.log.length}잔</div>
          <div class="lf_hcupr">${Array.from({ length: Math.max(8, wt.log.length) }, (_, k) => cup(k < wt.log.length)).join('')}</div>
          <div class="lf_rows">${wt.log.map(x => `<div><span class="cg_num">${esc(clockOf(p, x.t))}</span><b class="cg_num">${x.ml} ml</b></div>`).join('')}</div></div>` : ''}
        <div class="lf_hc"><span class="lf_hl" style="color: ${HC.caf}">${ax('cupH', 14, HC.caf, 2.2)}카페인<small>하루 400 mg까지</small></span>
          <div class="lf_hbig"><b class="cg_num">${mg}</b>mg · ${cof.length}잔</div>${hbar(mg / 400, HC.caf, HB.caf, 8)}
          ${cof.length ? `<div class="lf_rows">${cof.map(x => `<div><span><span class="cg_num">${esc(clockOf(p, x.t))}</span> · ${esc(x.what)}${x.from ? `<small>배달 · ${esc(x.from)}</small>` : ''}</span><b class="cg_num">${x.mg} mg</b></div>`).join('')}</div>` : '<div class="lf_hnote">오늘은 안 마셨어요</div>'}
          ${u.coffee ? `<div class="lf_hnote">평소 하루 ${u.coffee}잔${cof.length > u.coffee ? ` · 오늘은 ${cof.length - u.coffee}잔 더` : ''}</div>` : ''}</div>
        <i class="lf_pad"></i></div>${axInd()}`;
}
export function weightScreen(p, now, day) {
    const lf = L(p); if (!lf) return healthScreen(p, now);
    const u = lf.health.usual || {}, ds = lf.health.days, d = ds.find(x => x.date === day) || ds.at(-1), wl = d ? weightLine(lf, u, d.date) : [];
    if (!wl.length) return healthScreen(p, now);
    const lo = Math.min(...wl.map(x => x.kg)) - 0.3, hi = Math.max(...wl.map(x => x.kg)) + 0.3, X = k => 10 + k * 280 / Math.max(1, wl.length - 1), Y = v => 14 + (hi - v) / (hi - lo) * 126;
    const last = wl.at(-1), bmi = u.height ? last.kg / ((u.height / 100) ** 2) : null, diff = last.kg - wl[0].kg;
    const grid = [hi - 0.3, (hi + lo) / 2, lo + 0.3].map(v => Math.round(v * 2) / 2);
    return `${axBar(p, now)}${axTop(axCb(`health:${d.date}`))}
      <div class="ax_scroll">${axH1('체중')}${hhead('최근', `${comma(last.kg.toFixed(1))} <span>kg</span>`, `${esc(fmtDate(p, last.date))}${wl.length > 1 ? ` · ${wl.length}일 전보다 ${comma(Math.abs(diff).toFixed(1))} kg ${diff <= 0 ? '적어요' : '많아요'}` : ''}`)}
        <div class="lf_hc"><svg class="lf_hsvg" viewBox="0 0 300 150">${[...new Set(grid)].map(v => `<line x1="0" x2="300" y1="${Y(v).toFixed(1)}" y2="${Y(v).toFixed(1)}" class="g"/><text x="298" y="${(Y(v) - 3).toFixed(1)}" text-anchor="end">${comma(v.toFixed(1))}</text>`).join('')}
          <polyline points="${wl.map((x, k) => `${X(k).toFixed(1)},${Y(x.kg).toFixed(1)}`).join(' ')}" fill="none" stroke="${HC.w}" stroke-width="2.2" stroke-linejoin="round"/>${wl.map((x, k) => `<circle cx="${X(k).toFixed(1)}" cy="${Y(x.kg).toFixed(1)}" r="${k === wl.length - 1 ? 4.5 : 2.4}" fill="${k === wl.length - 1 ? '#fff' : HC.w}" stroke="${HC.w}" stroke-width="${k === wl.length - 1 ? 2.4 : 0}"/>`).join('')}</svg>
          <div class="lf_xl"><span>${esc(fmtDate(p, wl[0].date, true))}</span><span>${esc(fmtDate(p, last.date, true))}</span></div></div>
        <div class="lf_hc lf_rows">${u.height ? `<div><span>키</span><b class="cg_num">${u.height} cm</b></div><div><span>BMI</span><b class="cg_num">${comma(bmi.toFixed(1))}</b></div>` : ''}<div><span>평소 체중</span><b class="cg_num">${comma(u.weight)} kg</b></div></div>
        <i class="lf_pad"></i></div>${axInd()}`;
}
// usual vs the last 7 days: a sentence only for what the numbers say (more, less, later, stopped, about the same)
export function compareScreen(p, now) {
    const lf = L(p); if (!lf) return healthScreen(p, now);
    const u = lf.health.usual || {}, wk = lastDays(lf, 7), rows = [];
    // the day still going stays out of the step and coffee averages (it isn't over)
    const done = wk.filter(x => !Number.isFinite(x.upTo));
    const st = avg(done.map(x => x.steps)), sl = avg(wk.map(sleepMin)), bed = avg(wk.map(x => lateMin(x.sleep))), runs = wk.filter(x => x.workout).length, last = [...lf.health.days].reverse().find(x => x.workout);
    const us = usualSleep(u), grey = ['#8a929d', '#f1f2f4'];
    const row = (dir, [color, bg], title, sub) => rows.push(`<div class="lf_hc lf_tr"><span style="background: ${bg}">${ax(dir, 18, color, 2.4)}</span><div><b>${title}</b><small>${sub}</small></div></div>`);
    if (st !== null && u.steps) { const r = st / u.steps; row(r > 1.15 ? 'up' : r < 0.85 ? 'down' : 'eq', r > 1.15 || r < 0.85 ? [HC.steps, HB.steps] : grey, r > 1.15 ? '걸음이 평소보다 많아요' : r < 0.85 ? '걸음이 평소보다 적어요' : '걸음은 평소와 비슷해요', `${n0(Math.round(st))} · 평소 ${n0(u.steps)}`); }
    if (sl !== null && us) { const df = sl - us; row(df > 30 ? 'up' : df < -30 ? 'down' : 'eq', Math.abs(df) > 30 ? [HC.sleep, HB.sleep] : grey, df > 30 ? '수면이 평소보다 길어요' : df < -30 ? '수면이 평소보다 짧아요' : '수면은 평소와 비슷해요', `${dur(Math.round(sl))} · 평소 ${dur(us)}`); }
    if (bed !== null && u.sleep) { const df = bed - lateMin(u.sleep); if (Math.abs(df) > 40) row(df > 0 ? 'down' : 'up', [HC.sleep, HB.sleep], df > 0 ? '잠드는 시각이 늦어요' : '잠드는 시각이 빨라요', `${clockOf(p, Math.round(bed))} · 평소 ${clockOf(p, u.sleep)}`); }
    if (u.workouts) row(runs ? 'eq' : 'down', runs ? grey : [HC.run, HB.run], runs ? `운동은 이번 주 ${runs}회예요` : '운동이 끊겼어요', `이번 주 ${runs}회 · 평소 주 ${u.workouts}회${last ? ` · 마지막 ${esc(fmtDate(p, last.date, true))}` : ''}`);
    const rest = avg(wk.map(x => x.hr?.[0]));
    if (rest !== null && u.rest) row(Math.abs(rest - u.rest) > 6 ? (rest > u.rest ? 'up' : 'down') : 'eq', Math.abs(rest - u.rest) > 6 ? [HC.hr, HB.hr] : grey, Math.abs(rest - u.rest) > 6 ? (rest > u.rest ? '안정 시 심박이 평소보다 높아요' : '안정 시 심박이 평소보다 낮아요') : '심박수는 평소와 비슷해요', `${Math.round(rest)} · 평소 ${u.rest}`);
    if (u.coffee) { const c = avg(done.map(x => coffeeDay(p, x, u).length)); if (c !== null) row(c > u.coffee + 0.7 ? 'up' : c < u.coffee - 0.7 ? 'down' : 'eq', Math.abs(c - u.coffee) > 0.7 ? [HC.caf, HB.caf] : grey, c > u.coffee + 0.7 ? '커피를 평소보다 많이 마셔요' : c < u.coffee - 0.7 ? '커피를 평소보다 덜 마셔요' : '커피는 평소와 비슷해요', `하루 ${comma(c.toFixed(1))}잔 · 평소 ${u.coffee}잔`); }
    return `${axBar(p, now)}${axTop(axCb('health'))}
      <div class="ax_scroll">${axH1('평소와 비교')}<div class="lf_sub">최근 7일 평균 · 평소</div>
        ${rows.join('') || '<div class="lf_none">비교할 기록이 없어요</div>'}<i class="lf_pad"></i></div>${axInd()}`;
}

// ================= 파일 =================
const FK = { pdf: ['PDF', '#d64545'], image: ['JPG', '#c98a2e'], video: ['MP4', '#3a3f4a'], audio: ['M4A', '#8a5a2e'], zip: ['ZIP', '#7b8290'], doc: ['DOCX', '#2f6fbf'], sheet: ['XLSX', '#2b7a4b'], slides: ['PPTX', '#c2562b'], other: ['FILE', '#8a929d'] };
const ext = f => (String(f.name).match(/\.([a-z0-9]{2,4})$/i)?.[1] || FK[f.kind][0]).toUpperCase();
const fico = (f, s = '') => `<span class="lf_fico ${s}" style="background: ${FK[f.kind][1]}">${esc(ext(f))}</span>`;
const size = kb => comma(kb === null || kb === undefined ? '' : kb >= 1024 * 1024 ? `${(kb / 1048576).toFixed(1)} GB` : kb >= 1024 ? `${(kb / 1024).toFixed(1)} MB` : `${Math.round(kb)} KB`);
const live = lf => lf.files.items.filter(f => !f.trashed);
// what a file shows: the model's "look", else a guess from its name, folder and preview (older phones have no look)
const LOOK_IMG = ['sea', 'city', 'night', 'food', 'hills', 'pet', 'sunset', 'mountain', 'snow', 'flower', 'interior', 'concert', 'paper', 'screenshot', 'map'];
const LOOK_DOC = ['ticket', 'receipt', 'invoice', 'cv', 'letter', 'certificate', 'sheet', 'slides', 'recipe', 'medical', 'menu', 'contract', 'notes'];
const GUESS_IMG = [['screenshot', /screenshot|bildschirmfoto|capture|스크린샷|캡처/i], ['map', /\bmap\b|karte|route|standort|location|지도/i], ['paper', /scan|zettel|whiteboard|tafel|문서|종이|paper|page/i],
    ['concert', /concert|konzert|festival|gig|\blive\b|stage|bühne|공연|콘서트/i], ['pet', /\bcat\b|\bdog\b|katze|hund|kitty|puppy|\bpet\b|고양이|강아지|멍멍|냥/i], ['sunset', /sunset|sonnenuntergang|dusk|golden hour|abendrot|노을|석양/i],
    ['snow', /snow|schnee|\bski|winter|눈사람|눈 ?온|설경/i], ['mountain', /mountain|berg|alpen|alps|hike|wander|gipfel|peak|등산|산행/i], ['flower', /flower|blume|blüte|garden|garten|bloom|꽃|정원/i],
    ['interior', /room|zimmer|wohnung|apartment|\bbed\b|kitchen|küche|living|interior|방|거실|부엌|집들이/i], ['night', /night|nacht|nuit|noche|party|\bbar\b|club|야경|밤/i],
    ['sea', /sea|beach|strand|meer|plage|praia|ocean|lake|\bsee\b|fluss|river|바다|해변|강|호수|lisboa|lisbon|porto|island|insel/i],
    ['food', /food|essen|lunch|dinner|brunch|cafe|café|kaffee|coffee|cake|kuchen|pizza|pasta|ramen|음식|밥|카페|커피|케이크|맛집/i],
    ['city', /city|stadt|street|straße|strasse|tram|bus|bahn|station|bridge|brücke|building|dach|roof|garage|werkstatt|도시|거리|건물|역|다리|지붕/i]];
const GUESS_DOC = [['ticket', /boarding|bordkarte|e-?ticket|ticket|fahrkarte|flugschein|flight|flug|bahn|zugticket|탑승권|항공권|기차표|승차권|e티켓/i], ['receipt', /receipt|beleg|quittung|kassenbon|kassenzettel|영수증|\bbon\b/i], ['invoice', /rechnung|invoice|\bbill\b|facture|fattura|factura|청구서|인보이스|명세서/i],
    ['cv', /lebenslauf|\bcv\b|resume|résumé|이력서/i], ['medical', /arzt|befund|attest|krankmeldung|krankschreibung|prescription|diagnos|praxis|klinik|hospital|처방|진단|병원|소견서/i],
    ['recipe', /recipe|kochrezept|backrezept|레시피|요리법/i], ['certificate', /zertifikat|certificate|zeugnis|diploma|urkunde|bescheinigung|증명서|수료증|성적표|자격증/i],
    ['menu', /menu|speisekarte|메뉴/i], ['contract', /vertrag|contract|lease|agreement|vereinbarung|계약/i], ['letter', /brief|letter|lettre|anschreiben|bewerbung|편지|자기소개서/i],
    ['notes', /notiz|notes|protokoll|meeting|memo|todo|liste|회의록|메모|할 ?일/i]];
const lookOf = f => {
    const lk = f.look || '', words = `${f.name} ${f.folder} ${f.preview || ''} ${f.ko || ''}`;
    if (f.kind === 'image' || f.kind === 'video') {
        if (LOOK_IMG.includes(lk)) return lk;
        const g = GUESS_IMG.find(([, re]) => re.test(words));
        if (g) return g[0];
        const h = Number(String(f.time || '').slice(6, 8));
        return h >= 20 || h < 5 ? 'night' : 'hills';
    }
    if (f.kind === 'audio') return lk === 'music' || lk === 'voice' ? lk : /\.(mp3|flac|wav|aac)$|song|track|musik|music|playlist|노래|음악/i.test(words) ? 'music' : 'voice';
    if (f.kind === 'other') return ['event', 'contact', 'book'].includes(lk) ? lk : /\.ics$|invite|einladung|termin|일정|초대/i.test(f.name) ? 'event' : /\.vcf$|kontakt|contact|연락처/i.test(f.name) ? 'contact' : /\.(epub|mobi)$/i.test(f.name) ? 'book' : '';
    if (f.kind === 'sheet') return 'sheet';
    if (f.kind === 'slides') return 'slides';
    if (f.kind === 'pdf' || f.kind === 'doc') return LOOK_DOC.includes(lk) ? lk : (GUESS_DOC.find(([, re]) => re.test(words)) || [])[0] || 'plain';
    return '';
};
const seedOf = s => [...String(s)].reduce((n, ch) => (n * 31 + ch.charCodeAt(0)) % 997, 7);
// ---- a picture: a flat little scene
function photoScene(f) {
    const k = lookOf(f), r = seedOf(f.name) % 5, sky = c => `<rect width="100" height="100" fill="${c}"/>`;
    const S = {
        sea: `${sky('#bfe0f2')}<circle cx="${70 + r * 3}" cy="26" r="9" fill="#fff6d6"/><rect y="52" width="100" height="22" fill="#5aa6d6"/><path d="M0 58h100M0 64h100" stroke="#8fc6e8" stroke-width="1.6" stroke-dasharray="8 6"/><path d="M0 74q50 -8 100 0v26H0z" fill="#efd9ad"/>`,
        city: `${sky('#cfe1ee')}<circle cx="${20 + r * 8}" cy="22" r="8" fill="#fff4d0"/>${[[4, 46, 18], [22, 34, 16], [38, 52, 20], [58, 28, 18], [76, 44, 22]].map(([x, y, w]) => `<rect x="${x}" y="${y}" width="${w}" height="${100 - y}" fill="#7d93a8"/>${[0, 1, 2, 3].map(j => `<rect x="${x + 4}" y="${y + 6 + j * 11}" width="4" height="5" fill="#b9cad8"/><rect x="${x + w - 8}" y="${y + 6 + j * 11}" width="4" height="5" fill="#b9cad8"/>`).join('')}`).join('')}<rect y="88" width="100" height="12" fill="#5d6f80"/>`,
        night: `${sky('#26304f')}<circle cx="${72 - r * 4}" cy="24" r="8" fill="#f4ecc8"/><circle cx="${69 - r * 4}" cy="22" r="7" fill="#26304f"/>${[[14, 18], [34, 10], [52, 30], [86, 14], [24, 36]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="1.2" fill="#fff"/>`).join('')}${[[0, 56, 22], [20, 44, 18], [40, 60, 24], [62, 40, 18], [80, 54, 20]].map(([x, y, w]) => `<rect x="${x}" y="${y}" width="${w}" height="${100 - y}" fill="#18203a"/>${[0, 1, 2].map(j => `<rect x="${x + 4 + (j % 2) * 8}" y="${y + 6 + j * 10}" width="4" height="5" fill="#f6d27a"/>`).join('')}`).join('')}`,
        food: `${sky('#e9d2b4')}<path d="M0 70h100" stroke="#dcbf9c" stroke-width="2"/><circle cx="50" cy="52" r="32" fill="#fff"/><circle cx="50" cy="52" r="24" fill="#f6efe2"/><circle cx="${44 + r}" cy="48" r="9" fill="#e0904a"/><circle cx="58" cy="56" r="7" fill="#7fbf5a"/><circle cx="46" cy="60" r="6" fill="#e8463a"/><rect x="86" y="24" width="4" height="56" rx="2" fill="#c9ced4"/>`,
        hills: `${sky(['#cfe5d0', '#f3dcc0', '#d6e2f2', '#efd6dc', '#e2e8c8'][r])}<circle cx="72" cy="28" r="10" fill="#fffaf0"/><path d="M-10 78q30 -34 62 -6q22 -22 58 2V100H-10z" fill="${['#8cc28f', '#d8a46e', '#93add8', '#d79aa8', '#a9b96a'][r]}"/><path d="M-10 90q40 -20 120 -4V100H-10z" fill="${['#6aa66e', '#c08850', '#7592c4', '#c07a8a', '#8c9c4e'][r]}"/>`,
        pet: `${sky('#f1e6d6')}<path d="M0 74h100v26H0z" fill="#d8c3a4"/><g transform="translate(50 62)"><ellipse cy="12" rx="26" ry="16" fill="${['#e0a25a', '#8a8f98', '#3a3330', '#f2efe8', '#c98a5a'][r]}"/><circle cy="-10" r="17" fill="${['#e8b06a', '#9aa0a8', '#4a423e', '#fbf8f2', '#d89a6a'][r]}"/>${r % 2 ? '<path d="M-17 -16q-8 6 -6 18q6 -2 8 -10z M17 -16q8 6 6 18q-6 -2 -8 -10z" fill="#6a4a2a"/>' : `<path d="M-15 -20l-4 -14l12 8z M15 -20l4 -14l-12 8z" fill="${['#e0a25a', '#8a8f98', '#3a3330', '#f2efe8', '#c98a5a'][r]}"/>`}<circle cx="-6" cy="-12" r="2.2" fill="${r === 2 ? '#f6d24a' : '#2b2422'}"/><circle cx="6" cy="-12" r="2.2" fill="${r === 2 ? '#f6d24a' : '#2b2422'}"/><path d="M-3 -5q3 3 6 0" stroke="#2b2422" stroke-width="1.6" fill="none"/></g>`,
        sunset: `${sky('#f6b08a')}<rect width="100" height="40" fill="#e98a7a"/><rect y="40" width="100" height="16" fill="#f8c28a"/><circle cx="${42 + r * 4}" cy="64" r="16" fill="#fde2a0"/><rect y="64" width="100" height="36" fill="#6a5a8a"/><path d="M20 72h22M58 78h26M30 86h30" stroke="#f8c28a" stroke-width="2" stroke-linecap="round"/>`,
        mountain: `${sky('#cfe3f0')}<path d="M-5 80L30 30L50 58L68 36L105 80z" fill="#7f95a8"/><path d="M30 30L22 42L30 40L36 44z M68 36L62 44L68 43L74 46z" fill="#fff"/><path d="M-5 100V78q30 -12 60 -2q30 -10 50 2V100z" fill="#6fa36f"/>`,
        snow: `${sky('#dfe7ef')}${[[12, 14], [30, 26], [48, 10], [66, 22], [84, 12], [20, 40], [56, 36], [78, 44], [40, 52]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="1.6" fill="#fff"/>`).join('')}<path d="M-5 100V70q40 -14 110 0V100z" fill="#fbfdff"/><path d="M${54 + r * 4} 70v-26l-12 26z M${54 + r * 4} 44l12 26z" fill="#5a8a6a"/>`,
        flower: `${sky('#e8f0dc')}${[[30, 40, '#f29eb0'], [66, 34, '#f6c0cc'], [48, 62, '#e87a96']].map(([x, y, c]) => `<path d="M${x} ${y + 6}v40" stroke="#6aa66e" stroke-width="2.4"/><g transform="translate(${x} ${y})">${[0, 72, 144, 216, 288].map(a => `<circle cx="${(6 * Math.cos(a / 57.3)).toFixed(1)}" cy="${(6 * Math.sin(a / 57.3)).toFixed(1)}" r="5" fill="${c}"/>`).join('')}<circle r="3.4" fill="#f6d24a"/></g>`).join('')}`,
        interior: `${sky('#efe4d6')}<rect x="56" y="14" width="30" height="34" fill="#cfe3f0" stroke="#fff" stroke-width="3"/><path d="M71 14v34M56 31h30" stroke="#fff" stroke-width="2"/><rect y="78" width="100" height="22" fill="#c9a888"/><rect x="10" y="56" width="44" height="22" rx="6" fill="${['#8aa2c8', '#c88a8a', '#8ab8a2', '#c8b48a', '#a28ac8'][r]}"/><rect x="14" y="48" width="14" height="12" rx="3" fill="#f2c4a8"/><path d="M76 78v-16h-8l4 -10h8l4 10h-8" fill="#e8b46a"/>`,
        concert: `${sky('#1d1630')}<path d="M20 0L36 70H4z" fill="#f6d27a" opacity=".35"/><path d="M80 0L96 70H64z" fill="#f29eb0" opacity=".35"/><path d="M50 0L64 70H36z" fill="#9fd3ef" opacity=".3"/><rect y="66" width="100" height="6" fill="#3a2f52"/>${[[10, 84], [28, 80], [46, 86], [64, 80], [84, 84]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="7" fill="#0f0b1c"/><rect x="${x - 8}" y="${y + 5}" width="16" height="30" rx="6" fill="#0f0b1c"/>`).join('')}<path d="M28 74l-4 -12M64 74l5 -14" stroke="#0f0b1c" stroke-width="4" stroke-linecap="round"/>`,
        paper: `${sky('#b8a48a')}<path d="M18 10L84 14L80 92L14 88z" fill="#fbf8f0"/>${[24, 32, 40, 48, 56, 64, 72].map(y => `<path d="M24 ${y}L${74 - (y % 7)} ${y + 2}" stroke="#c8c2b4" stroke-width="2.4"/>`).join('')}<path d="M24 20L52 21" stroke="#5a5a62" stroke-width="3.6"/>`,
        screenshot: `${sky('#f4f5f7')}<rect width="100" height="14" fill="#fff"/><circle cx="12" cy="7" r="4" fill="#c9ced4"/><rect x="20" y="5" width="26" height="4" rx="2" fill="#c9ced4"/><rect x="8" y="22" width="52" height="12" rx="6" fill="#e6e8ec"/><rect x="40" y="40" width="52" height="12" rx="6" fill="#2f6bff"/><rect x="8" y="58" width="40" height="12" rx="6" fill="#e6e8ec"/><rect x="34" y="76" width="58" height="12" rx="6" fill="#2f6bff"/>`,
        map: `${sky('#eef0e6')}<path d="M0 30H100M0 70H100M30 0V100M74 0V100" stroke="#fff" stroke-width="6"/><path d="M0 52Q50 40 100 60" stroke="#cfe0f2" stroke-width="10" fill="none"/><rect x="40" y="10" width="24" height="14" fill="#d8e8cf"/><path d="M50 62c0 -10 -8 -12 -8 -20a8 8 0 0 1 16 0c0 8 -8 10 -8 20z" fill="#e8463a"/><circle cx="50" cy="42" r="3" fill="#fff"/>`,
    };
    return `<svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice">${S[k] || S.hills}</svg>`;
}
// ---- a document's first page (120 × 160): drawn by its look, with its own words where a real one has them
function docSvg(f) {
    const k = lookOf(f), r = seedOf(f.name), [t0, ...rest] = String(f.preview || f.name.replace(/\.[a-z0-9]{2,4}$/i, '').replace(/[_-]+/g, ' ')).split(' · ');
    const t = esc(t0.slice(0, 34)), sub = esc(rest.join(' · ').slice(0, 44)), L = (x, y, w, c = '#e3e6eb', h = 3) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="1.5" fill="${c}"/>`;
    const lines = (y0, y1, step, x = 10, w = 100) => { let o = ''; for (let y = y0, j = 0; y < y1; y += step, j++) o += L(x, y, w - ((r + j * 13) % 18)); return o; };
    const sig = '<path d="M70 140q6 -8 12 0q6 8 12 -2" stroke="#2c4a80" stroke-width="1.4" fill="none"/>', T = (x, y, s, w, c, a = 'start') => `<text x="${x}" y="${y}" font-size="${s}" font-weight="${w}" fill="${c}" text-anchor="${a}">${t}</text>`;
    const P = {
        receipt: `<rect width="120" height="160" fill="#f4f1ea"/><rect x="28" y="6" width="64" height="146" fill="#fff"/><path d="M28 152l4 5l4 -5l4 5l4 -5l4 5l4 -5l4 5l4 -5l4 5l4 -5l4 5l4 -5l4 5l4 -5l4 5l4 -5z" fill="#fff"/>${T(60, 20, 6.5, 800, '#161b22', 'middle')}${[0, 1, 2, 3, 4].map(j => L(34, 32 + j * 9, 28 + (r + j) % 8) + L(76, 32 + j * 9, 10)).join('')}<path d="M34 80h52" stroke="#bbb" stroke-dasharray="2 2"/><text x="34" y="92" font-size="6.5" font-weight="800">TOTAL</text>${L(68, 87, 18, '#161b22', 4)}${Array.from({ length: 20 }, (_, j) => `<rect x="${37 + j * 2.3}" y="108" width="${1 + (r + j) % 2}" height="16" fill="#222"/>`).join('')}`,
        invoice: `${L(10, 10, 40, '#2c4a80', 6)}${T(10, 28, 6.5, 800, '#161b22')}${L(10, 34, 36)}${L(10, 40, 30)}<rect x="10" y="48" width="100" height="10" fill="#eef2f8"/>${[0, 1, 2, 3, 4].map(j => L(14, 64 + j * 10, 44 + (r + j * 5) % 12) + L(90, 64 + j * 10, 16)).join('')}<path d="M60 120h50" stroke="#161b22"/>${L(84, 126, 26, '#161b22', 5)}`,
        cv: `<rect x="10" y="10" width="26" height="32" rx="2" fill="#dfe5ee"/><circle cx="23" cy="22" r="6" fill="#b8c4d6"/><path d="M14 40q9 -10 18 0" fill="#b8c4d6"/>${T(44, 20, 7, 800, '#161b22')}${L(44, 28, 36)}${L(44, 34, 40)}${[54, 88, 122].map(y => L(10, y, 22, '#2f9a8a', 4) + L(10, y + 8, 100) + L(10, y + 14, 88) + L(10, y + 20, 70)).join('')}`,
        letter: `${L(10, 12, 30, '#c8566e', 5)}${L(80, 12, 30)}${L(10, 34, 24)}${T(10, 50, 6.5, 700, '#161b22')}${lines(58, 128, 8)}${sig}`,
        certificate: `<rect x="6" y="6" width="108" height="148" fill="none" stroke="#c8a24a" stroke-width="2"/><rect x="10" y="10" width="100" height="140" fill="none" stroke="#c8a24a" stroke-width=".8"/>${T(60, 34, 7.5, 800, '#7a5a1a', 'middle')}${L(30, 48, 60)}${L(24, 58, 72)}${L(36, 68, 48)}<circle cx="60" cy="112" r="14" fill="#e8463a" opacity=".85"/><circle cx="60" cy="112" r="10" fill="none" stroke="#fff" stroke-width="1.2"/>${L(18, 138, 30, '#8a929d', 1)}${L(72, 138, 30, '#8a929d', 1)}`,
        sheet: `<rect x="6" y="10" width="108" height="10" fill="#2b7a4b"/>${Array.from({ length: 12 }, (_, row) => [0, 1, 2, 3].map(c => `<rect x="${6 + c * 27}" y="${20 + row * 10}" width="27" height="10" fill="${row % 2 ? '#eef6f0' : '#fff'}" stroke="#d8e2dc" stroke-width=".6"/>${L(9 + c * 27, 24 + row * 10, 10 + (r + row * c) % 12, '#b8c4bc', 2)}`).join('')).join('')}`,
        slides: `<rect width="120" height="160" fill="#f4f5f7"/><rect x="4" y="40" width="112" height="72" fill="#fff" stroke="#e3e6eb"/><rect x="4" y="40" width="112" height="12" fill="#c2562b"/>${T(10, 66, 6.5, 800, '#161b22')}${[16, 26, 20, 36].map((h, j) => `<rect x="${66 + j * 11}" y="${104 - h}" width="8" height="${h}" fill="#c2562b" opacity="${(0.4 + j * 0.15).toFixed(2)}"/>`).join('')}${L(10, 76, 40)}${L(10, 84, 36)}${L(10, 92, 44)}`,
        recipe: `${T(10, 17, 7, 800, '#161b22')}<rect x="10" y="24" width="100" height="40" rx="3" fill="#f3dcc0"/><circle cx="60" cy="44" r="14" fill="#fff"/><circle cx="56" cy="42" r="5" fill="#e0904a"/><circle cx="64" cy="47" r="4" fill="#7fbf5a"/>${[0, 1, 2, 3].map(j => `<circle cx="13" cy="${75 + j * 8}" r="1.6" fill="#c2562b"/>${L(18, 74 + j * 8, 34 + (r + j * 7) % 16)}`).join('')}${[0, 1, 2].map(j => `<text x="10" y="${118 + j * 12}" font-size="6" fill="#c2562b" font-weight="700">${j + 1}</text>${L(18, 114 + j * 12, 88)}`).join('')}`,
        medical: `<rect x="10" y="10" width="12" height="12" fill="#2f9a8a"/><path d="M16 12v8M12 16h8" stroke="#fff" stroke-width="2.4"/>${T(28, 18, 6.5, 800, '#161b22')}${L(28, 22, 34)}<rect x="10" y="34" width="100" height="22" fill="#eef6f4"/>${L(14, 40, 40)}${L(14, 47, 60)}${[0, 1, 2, 3].map(j => L(14, 66 + j * 12, 62 + (r + j) % 12) + L(92, 66 + j * 12, 14, '#2f9a8a')).join('')}${sig}`,
        menu: `<rect width="120" height="160" fill="#2b2622"/>${T(60, 22, 8, 800, '#f3dcc0', 'middle')}${[40, 52, 64, 76, 88, 100, 112, 124, 136].map((y, j) => L(16, y, 46 + (r + j * 9) % 16, '#8a7a6a') + L(92, y, 12, '#f3dcc0')).join('')}`,
        contract: `${T(60, 18, 7, 800, '#161b22', 'middle')}${sub ? `<text x="60" y="27" font-size="5" fill="#6b7380" text-anchor="middle">${sub}</text>` : ''}${lines(38, 124, 7)}${L(10, 140, 36, '#8a929d', 1)}${L(74, 140, 36, '#8a929d', 1)}<path d="M14 136q6 -8 12 0q6 8 12 -2" stroke="#2c4a80" stroke-width="1.4" fill="none"/>`,
        notes: `<rect width="120" height="160" fill="#fdf6d8"/>${Array.from({ length: 14 }, (_, j) => `<path d="M0 ${20 + j * 10}h120" stroke="#ecdca0" stroke-width=".8"/>`).join('')}${T(10, 16, 7, 800, '#7f6a22')}${[32, 42, 52, 62, 72, 82].map(y => `<rect x="10" y="${y - 4}" width="5" height="5" rx="1" fill="none" stroke="#7f6a22"/>${L(19, y - 3, 50 + (r + y) % 36, '#c8b46a')}`).join('')}`,
        ticket: (() => {
            const all = `${f.name} ${f.preview || ''}`, train = /bahn|zug|train|\bice\b|\bic\b|ktx|srt|tgv|rail|eurostar|기차|열차|fahrkarte/i.test(all);
            const m = String(f.preview || '').match(/([\p{L} .'-]{2,24}?)\s*(?:→|->|–|—|-|\bnach\b|\bto\b|→)\s*([\p{L} .'-]{2,24})/u), from = m ? m[1].trim() : '', to = m ? m[2].trim().split(/\s·|,/)[0] : '';
            const code = x => esc(String(x).replace(/[^\p{L}]/gu, '').slice(0, 3).toUpperCase() || '—'), cc = train ? '#b8323a' : '#2c4a80';
            const qr = Array.from({ length: 49 }, (_, j) => ((r >> (j % 9)) + j * 7) % 3 ? `<rect x="${78 + (j % 7) * 4}" y="${112 + Math.floor(j / 7) * 4}" width="4" height="4" fill="#161b22"/>` : '').join('');
            const bars = Array.from({ length: 26 }, (_, j) => `<rect x="${12 + j * 3.6}" y="128" width="${1 + (r + j) % 2}" height="18" fill="#161b22"/>`).join('');
            return `<rect width="120" height="160" fill="#f4f5f7"/><rect x="6" y="8" width="108" height="144" rx="6" fill="#fff" stroke="#dfe3e8"/><rect x="6" y="8" width="108" height="22" rx="6" fill="${cc}"/><rect x="6" y="24" width="108" height="6" fill="${cc}"/>${T(12, 22, 6.5, 800, '#fff')}<text x="108" y="22" font-size="4.6" fill="#fff" text-anchor="end" opacity=".85">${/[가-힣]/.test(all) ? (train ? '승차권' : '탑승권') : train ? 'TICKET' : 'BOARDING PASS'}</text>`
                + (train ? `<text x="12" y="48" font-size="9" font-weight="800" fill="#161b22">${esc(from.slice(0, 14)) || '—'}</text><path d="M12 54v10" stroke="${cc}" stroke-width="1.4"/><circle cx="12" cy="52" r="1.8" fill="${cc}"/><circle cx="12" cy="66" r="1.8" fill="${cc}"/><text x="12" y="76" font-size="9" font-weight="800" fill="#161b22">${esc(to.slice(0, 14)) || '—'}</text>`
                    : `<text x="12" y="58" font-size="17" font-weight="800" fill="#161b22">${code(from)}</text><text x="108" y="58" font-size="17" font-weight="800" fill="#161b22" text-anchor="end">${code(to)}</text><path d="M55 52h10M62 49l3 3l-3 3" stroke="#8a929d" stroke-width="1.4" fill="none"/><text x="12" y="66" font-size="4.6" fill="#6b7380">${esc(from.slice(0, 16))}</text><text x="108" y="66" font-size="4.6" fill="#6b7380" text-anchor="end">${esc(to.slice(0, 16))}</text>`)
                + `<path d="M6 84h108" stroke="#dfe3e8" stroke-dasharray="3 2"/>${(/[가-힣]/.test(all) ? (train ? ['날짜', '시간', '호차', '좌석'] : ['날짜', '시간', '탑승구', '좌석']) : /[äöüß]|bahn|zug|fahrkarte|bordkarte|flug/i.test(all) ? (train ? ['DATUM', 'ZEIT', 'WAGEN', 'PLATZ'] : ['DATUM', 'ZEIT', 'GATE', 'SITZ']) : (train ? ['DATE', 'TIME', 'CAR', 'SEAT'] : ['DATE', 'TIME', 'GATE', 'SEAT'])).map((h, j) => `<text x="${12 + j * 26}" y="94" font-size="4.2" fill="#8a929d">${h}</text>${L(12 + j * 26, 98, 16, '#161b22', 4)}`).join('')}`
                + (train ? `${L(12, 114, 50)}${L(12, 120, 40)}${qr}` : bars);
        })(),
        plain: `${L(10, 10, 40, FK[f.kind]?.[1] || '#2c4a80', 5)}${T(10, 28, 7, 800, '#161b22')}${sub ? `<text x="10" y="37" font-size="5" fill="#6b7380">${sub}</text>` : ''}${lines(46, 80, 7)}${lines(90, 130, 7)}`,
    };
    return `<svg viewBox="0 0 120 160">${P[k] || P.plain}</svg>`;
}
// ---- the other kinds: what's inside a zip, an invite, a contact card, a song, a book
function otherCard(p, f, big = false) {
    const k = f.kind === 'zip' ? 'zip' : lookOf(f), [t0, ...rest] = String(f.preview || f.name.replace(/\.[a-z0-9]{2,5}$/i, '').replace(/[_-]+/g, ' ')).split(' · '), sub = rest.join(' · ');
    if (k === 'zip') {
        const inside = (f.preview ? f.preview.split(/\s*[,·]\s*/) : ['IMG_0001.jpg', 'IMG_0002.jpg', 'notes.txt', 'scan.pdf']).filter(Boolean).slice(0, big ? 8 : 4);
        const col = n => (/\.(jpe?g|png|heic)$/i.test(n) ? '#c98a2e' : /\.pdf$/i.test(n) ? '#d64545' : /\.(mp4|mov)$/i.test(n) ? '#3a3f4a' : /\.docx?$/i.test(n) ? '#2f6fbf' : '#8a929d');
        return `<span class="lf_oc">${ax('folder', big ? 30 : 20, '#7b8290', 2, '#e6e8ec')}${inside.map(n => `<span class="r"><i style="background: ${col(n)}"></i>${esc(n)}</span>`).join('')}</span>`;
    }
    if (k === 'event') {
        const t = (p.money?.passes || []).find(x => f.ev && x.ev === f.ev), d = md(t?.date || f.time);
        return `<span class="lf_oc c"><span class="lf_ics"><b>${d ? `${d.mo}월` : ''}</b><span class="cg_num">${d ? d.d : ''}</span></span><span class="r b">${esc(t0)}</span>${sub || t ? `<span class="r">${esc(sub || [t?.time, t?.by].filter(Boolean).join(' · '))}</span>` : ''}</span>`;
    }
    if (k === 'contact') return `<span class="lf_oc c"><span class="lf_vcf" style="background: ${axTint(t0)}">${esc([...t0][0] || '?')}</span><span class="r b">${esc(t0)}</span>${sub ? `<span class="r">${esc(sub)}</span>` : ''}</span>`;
    if (k === 'book') return `<span class="lf_oc c"><span class="lf_book" style="background: ${['#2c4a80', '#8a3a4a', '#2f6a5a', '#5a3a8a', '#a8642a'][seedOf(t0) % 5]}"><b>${esc(t0)}</b>${sub ? `<small>${esc(sub)}</small>` : ''}</span></span>`;
    if (k === 'music') { const h = seedOf(f.name); return `<span class="lf_oc c"><span class="lf_alb" style="background: linear-gradient(135deg, ${axTint(f.name)}, ${['#26304f', '#8a6ac8', '#c8566e', '#2f9a8a'][h % 4]})"></span><span class="r b">${esc(t0)}</span>${f.length ? `<span class="r cg_num">${esc(f.length)}</span>` : ''}</span>`; }
    return '';
}
const thumb = (p, f) => f.private ? `<span class="lf_th lf_thp">${ax('eyeoff', 26, '#9aa0a8', 2)}</span>`
    : f.kind === 'image' ? `<span class="lf_th lf_thi">${photoScene(f)}</span>`
    : f.kind === 'video' ? `<span class="lf_th lf_thi">${photoScene(f)}<span class="lf_play">${ax('play', 20, '#fff', 2, '#fff')}</span>${f.length ? `<em class="lf_du cg_num">${esc(f.length)}</em>` : ''}</span>`
    : ['pdf', 'doc', 'sheet', 'slides'].includes(f.kind) ? `<span class="lf_th"><span class="lf_docs">${docSvg(f)}</span></span>`
    : f.kind === 'zip' || (f.kind === 'audio' && lookOf(f) === 'music') || (f.kind === 'other' && lookOf(f)) ? `<span class="lf_th lf_tho">${otherCard(p, f)}</span>` : `<span class="lf_th">${fico(f)}</span>`;
const fileRow = (p, f) => `<button type="button" class="lf_fr" data-go="file" data-i="${f.id}">${fico(f, 's')}<span class="lf_tx"><b>${esc(f.name)}</b><small>${esc(fmtDate(p, f.time, true))}${size(f.size) ? ` · ${size(f.size)}` : ''}${f.trashed ? ' · 휴지통' : ''}</small></span>${f.tag ? `<i class="lf_tagd" style="background: ${f.tag === 'red' ? '#d64545' : '#e8a317'}"></i>` : ''}</button>`;
export function filesScreen(p, now) {
    const lf = L(p);
    if (!lf) return lifeEmpty(p, now, '파일', 'life');
    const fs = live(lf), recent = [...fs].filter(f => f.opened).sort(byStory(p.now, f => f.opened)).reverse().slice(0, 6), dl = fs.filter(f => f.folder === 'Downloads').length, trash = lf.files.items.filter(f => f.trashed).length, cl = lf.files.cloud || {};
    // the folders as the files now stand: a file a reflection moved in counts there, and a folder only a file names is shown too
    const inF = name => fs.filter(f => f.folder === name).length;
    const folders = [...lf.files.folders.map(x => ({ ...x, count: Math.max(x.count || 0, inF(x.name)) })),
        ...[...new Set(fs.map(f => f.folder))].filter(n => n && n !== 'Downloads' && !lf.files.folders.some(x => x.name === n)).map(name => ({ name, count: inF(name) }))];
    const favs = folders.filter(x => x.fav), others = folders.filter(x => !x.fav);
    const FOLD_C = [['#2f6fbf', '#dfeaf8'], ['#2f9a8a', '#d9f1ec'], ['#d0812f', '#fbe9d6'], ['#7a62c8', '#e9e3f8'], ['#c8566e', '#f8e0e6']];
    const fold = x => { const [c, bg] = x.fav ? FOLD_C[[...x.name].reduce((n, ch) => (n * 31 + ch.charCodeAt(0)) % 97, 3) % FOLD_C.length] : FOLD_C[0]; return `<button type="button" class="lf_rw" data-go="folder" data-i="${encodeURIComponent(x.name)}">${ax('folder', 22, c, 2, bg)}<span class="lf_tx"><b>${esc(x.name)}</b>${x.ko && koOn() ? `<small>${esc(x.ko)}</small>` : ''}</span><small>${x.count}</small>${ax('chev', 14, '#b7bdc6', 2.4)}</button>`; };
    return `${axBar(p, now)}${axTop(axCb('home2'), axKp(p))}
      <div class="ax_scroll">${axH1('파일')}
        ${recent.length ? `<div class="lf_sec">최근</div><div class="lf_rec">${recent.map(f => `<button type="button" data-go="file" data-i="${f.id}">${thumb(p, f)}<b>${esc(f.name)}</b><small>${esc(fmtDate(p, f.opened, true))} · ${esc(f.folder === 'Downloads' ? '다운로드' : f.folder)}</small></button>`).join('')}</div>` : ''}
        <div class="lf_sec">위치</div>
        <div class="lf_card">
          <button type="button" class="lf_rw" data-go="folder" data-i="">${ax('phoneS', 22, '#2f6fbf')}<span class="lf_tx"><b>내 폰</b></span><small>${fs.length}</small>${ax('chev', 14, '#b7bdc6', 2.4)}</button>
          ${cl.total ? `<div class="lf_rw">${ax('cloudF', 22, '#2f6fbf')}<span class="lf_tx"><b>클라우드</b><small>${comma(String(cl.used ?? '?'))} GB / ${comma(String(cl.total))} GB</small></span></div>` : ''}
          <button type="button" class="lf_rw" data-go="folder" data-i="Downloads">${ax('dl', 22, '#2f6fbf')}<span class="lf_tx"><b>다운로드</b></span><small>${dl}</small>${ax('chev', 14, '#b7bdc6', 2.4)}</button>
          <button type="button" class="lf_rw" data-go="folder" data-i="~trash">${ax('trash', 21, '#2f6fbf')}<span class="lf_tx"><b>최근 삭제</b></span><small>${trash}</small>${ax('chev', 14, '#b7bdc6', 2.4)}</button></div>
        ${favs.length ? `<div class="lf_sec">즐겨찾기</div><div class="lf_card">${favs.map(fold).join('')}</div>` : ''}
        ${others.length ? `<div class="lf_sec">폴더</div><div class="lf_card">${others.map(fold).join('')}</div>` : ''}
        <i class="lf_pad"></i></div>${axInd()}`;
}
export function folderScreen(p, now, key) {
    const lf = L(p); if (!lf) return filesScreen(p, now);
    const name = decodeURIComponent(key || ''), trash = name === '~trash';
    const fs = (trash ? lf.files.items.filter(f => f.trashed) : live(lf).filter(f => !name || f.folder === name)).sort(byStory(p.now)).reverse();
    const title = trash ? '최근 삭제' : !name ? '내 폰' : name === 'Downloads' ? '다운로드' : name, fo = lf.files.folders.find(x => x.name === name);
    const grid = fs.some(f => f.kind === 'image' || f.kind === 'video') && !trash && name !== 'Downloads';
    return `${axBar(p, now)}${axTop(axCb('files'))}
      <div class="ax_scroll">${axH1(title, `${Math.max(fs.length, fo?.count || 0)}개`)}
        ${trash ? '<div class="lf_sub">30일이 지나면 완전히 지워져요</div>' : ''}
        ${fs.length ? grid ? `<div class="lf_grid">${fs.map(f => `<button type="button" data-go="file" data-i="${f.id}">${thumb(p, f)}<b>${esc(f.name.replace(/\.[a-z0-9]{2,4}$/i, ''))}</b><small>${esc([f.length, size(f.size)].filter(Boolean).join(' · '))}</small></button>`).join('')}</div>`
            : `<div class="lf_card">${fs.map(f => fileRow(p, f)).join('')}</div>` : '<div class="lf_none">파일이 없어요</div>'}
        ${fo && fo.count > fs.length ? (() => { const n = fo.count - fs.length, shown = Math.min(n, grid ? 12 : 8);
            return `${grid ? `<div class="lf_grid lf_ghost">${Array.from({ length: shown }, (_, k) => `<span><span class="lf_th"></span><i style="width: ${50 + (k * 17) % 40}%"></i></span>`).join('')}</div>` : `<div class="lf_card lf_ghost">${Array.from({ length: shown }, (_, k) => `<span class="lf_fr"><span class="lf_fico s"></span><span class="lf_tx"><i style="width: ${45 + (k * 23) % 40}%"></i><i style="width: 30%"></i></span></span>`).join('')}</div>`}<div class="lf_sub" style="text-align: center">이야기에 나오지 않은 파일 ${n}개</div>`; })() : ''}
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
        : page || (f.kind === 'image' || f.kind === 'video' ? `<div class="lf_pvimg">${thumb(p, f)}</div>`
        : f.kind === 'audio' && lookOf(f) !== 'music' ? `<div class="lf_pvaud"><div class="lf_aud"><span class="pl">${ax('play', 22, '#fff', 2, '#fff')}</span><div class="lf_wave">${Array.from({ length: 34 }, (_, k) => `<i style="height: ${Math.round(22 + 60 * Math.abs(Math.sin((k + f.name.length) * 0.55)) * (0.55 + 0.45 * Math.abs(Math.sin(k * 0.21))))}%"></i>`).join('')}</div></div><div class="lf_audt cg_num"><span>0:00</span><span>${esc(f.length ? `−${f.length}` : '')}</span></div></div>`
        : ['pdf', 'doc', 'sheet', 'slides'].includes(f.kind) ? `<div class="lf_pv lf_pvs">${docSvg(f)}</div>${f.ko && koOn() ? `<div class="lf_sub" style="text-align: center">${esc(f.ko)}</div>` : ''}`
        : otherCard(p, f, true) ? `<div class="lf_pvo">${otherCard(p, f, true)}</div>` : `<div class="lf_pvo"><span class="lf_oc c">${fico(f)}</span></div>`);
    return `${axBar(p, now)}
      <div class="ax_top">${axCb(f.trashed ? 'folder:~trash' : `folder:${encodeURIComponent(f.folder)}`)}<span class="lf_ttl">${esc(f.name)}</span><span class="ax_topr">${axKp(p)}</span></div>
      <div class="ax_scroll">${body}
        <div class="lf_sub" style="text-align: center">${esc([f.pages ? `${f.pages}쪽` : '', FK[f.kind][0], size(f.size)].filter(Boolean).join(' · '))}</div>
        <div class="lf_card lf_rows"><div><span>위치</span><b>${esc(f.trashed ? '최근 삭제' : f.folder === 'Downloads' ? '다운로드' : f.folder)}</b></div>${f.from ? `<div><span>받은 곳</span><b>${esc(f.from)}</b></div>` : ''}<div><span>만든 날</span><b class="cg_num">${esc(fmtDate(p, f.time))} ${esc(clockOf(p, String(f.time).slice(6)))}</b></div>${f.opened ? `<div><span>마지막으로 연 날</span><b class="cg_num">${esc(fmtDate(p, f.opened, true))}</b></div>` : ''}</div>
        <i class="lf_pad"></i></div>${axInd()}`;
}

// ================= 날씨 =================
// what each sky is called; the colours come from pal() below
const WX = { clear: '맑음', partly: '구름 조금', cloudy: '흐림', drizzle: '이슬비', rain: '비', sleet: '진눈깨비', snow: '눈', fog: '안개', storm: '뇌우', wind: '강풍' };
// the part of the day a sky is drawn for: dawn and evening are the hour around sunrise and sunset
function phaseOf(time, sunrise, sunset) {
    let t = toMin(time), ss = toMin(sunset) ?? 18 * 60;
    const sr = toMin(sunrise) ?? 6 * 60 + 30;
    if (t === null) return 'day';
    // a sunset past midnight (a far northern summer): the day runs on past the clock's wrap
    if (ss < sr) { ss += 1440; if (t < sr - 45) t += 1440; }
    if (t >= sr - 45 && t <= sr + 45) return 'dawn';
    if (t >= ss - 50 && t <= ss + 30) return 'eve';
    return t > ss + 30 || t < sr - 45 ? 'night' : 'day';
}
const WET = { drizzle: 1, rain: 1, sleet: 1 };
// one palette per sky and part of the day: flat layers only (sky, bands, three hills, clouds), no gradients
// a sky the app doesn't know (an older save, a blank) is drawn as cloudy
const condOk = c => (Object.hasOwn(WX, c) ? c : 'cloudy');
function pal(cond, phase) {
    cond = condOk(cond);
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
// a cloud drifts slowly to the right, off the edge and in again from the left; it starts where it is drawn (v: pixels a second)
const puffSvg = (x, y, w, col, v, op = 1) => { const a = -(x + w + 10), b = 400 - x, d = (b - a) / v; return `<svg class="cl" style="left: ${x}px; top: ${y}px; width: ${w}px; height: ${w / 2}px; --a: ${a}px; --b: ${b}px; --d: ${d.toFixed(1)}s; --dl: -${(-a / v).toFixed(1)}s${op < 1 ? `; opacity: ${op}` : ''}" viewBox="0 0 200 100"><g fill="${col}"><circle cx="60" cy="58" r="34"/><circle cx="104" cy="42" r="42"/><circle cx="148" cy="62" r="30"/><rect x="26" y="58" width="152" height="40" rx="20"/></g></svg>`; };
// the whole sky behind a weather screen: it moves (clouds drift, rain and snow fall, lightning, stars, the sun at dawn and dusk), and stands still with reduced motion
function scene(cond, phase) {
    cond = condOk(cond);
    const q = pal(cond, phase), r = rnd(cond.length * 31 + phase.length * 7), out = [];
    for (const [y, c] of q.bands || []) out.push(`<i class="bd" style="top: ${y}px; background: ${c}"></i>`);
    if (q.stars) out.push(Array.from({ length: q.stars }, () => `<i class="st${phase === 'dawn' ? ' fd' : ''}" style="left: ${Math.round(10 + r() * 370)}px; top: ${Math.round(60 + r() * 360)}px; --d: ${(2 + r() * 3).toFixed(1)}s; --dl: -${(r() * 4).toFixed(1)}s"></i>`).join(''));
    const sun = (x, y, rad, core, halo, cls = '') => `<span class="sun ${cls}" style="left: ${x - rad * 2.4}px; top: ${y - rad * 2.4}px; width: ${rad * 4.8}px; height: ${rad * 4.8}px"><b style="background: ${halo}"></b><b class="h2" style="background: ${halo}"></b><i style="background: ${core}; width: ${rad * 2}px; height: ${rad * 2}px"></i></span>`;
    if (q.sun === 'day') out.push(cond === 'partly' ? sun(320, 190, 42, '#f6c94a', 'rgba(255, 255, 255, 0.14)') : sun(330, 210, 46, '#f6c94a', 'rgba(255, 255, 255, 0.14)'));
    if (q.sun === 'rise') out.push(sun(312, 262, 40, '#fbe6a6', 'rgba(246, 211, 154, 0.45)', 'rise'));
    if (q.sun === 'sink') out.push(sun(312, 250, 46, '#fbe08f', 'rgba(247, 200, 115, 0.4)', 'sink'));
    if (q.moon) out.push(`<span class="mn" style="left: ${cond === 'clear' || cond === 'wind' ? 292 : 300}px; top: ${cond === 'clear' || cond === 'wind' ? 150 : 170}px"><i></i><b style="background: ${q.sky}"></b></span>`);
    if (q.puff) out.push(puffSvg(-40, phase === 'eve' ? 90 : 200, phase === 'eve' ? 200 : 170, q.puff, 2.78));
    if (cond === 'partly' && q.front) out.push(puffSvg(-60, 90, 200, q.cloud, 2.78) + puffSvg(258, 196, 130, q.front, 3.9));
    else if (q.cloud && cond === 'wind') out.push(puffSvg(-60, 90, 240, q.cloud, 40) + puffSvg(200, 160, 200, q.cloud, 32));
    else if (q.cloud) out.push(puffSvg(-80, 70, 300, q.cloud, 2.78) + puffSvg(180, 40, 260, q.cloud, 2.24) + puffSvg(60, 200, 220, q.cloud, 3.32, 0.8) + (q.cloud2 ? puffSvg(-40, 300, 260, q.cloud2, 3.9) : ''));
    const drops = (n, cls, h0, hv, d0, dv) => Array.from({ length: n }, () => `<i class="${cls}" style="left: ${Math.round(-30 + r() * 450)}px; height: ${Math.round(h0 + r() * hv)}px; --d: ${(d0 + r() * dv).toFixed(2)}s; --dl: -${(r() * 3).toFixed(2)}s"></i>`).join('');
    const flakes = (n, big) => Array.from({ length: n }, () => { const z = ((big ? 5 : 3) + r() * 3).toFixed(1); return `<i class="sn" style="left: ${Math.round(-10 + r() * 410)}px; width: ${z}px; height: ${z}px; --d: ${(6 + r() * 5).toFixed(1)}s; --dl: -${(r() * 10).toFixed(1)}s; --s: ${Math.round(-30 + r() * 60)}px"></i>`; }).join('');
    if (q.fall === 'rain') out.push(drops(70, 'rn', 14, 16, 1.2, 0.7));
    if (q.fall === 'drizzle') out.push(drops(90, 'rn dz', 6, 6, 1.8, 0.8));
    if (q.fall === 'heavy') out.push(drops(90, 'rn hv', 20, 18, 0.8, 0.4));
    if (q.fall === 'sleet') out.push(drops(40, 'rn', 14, 16, 1.2, 0.7) + flakes(30, false));
    if (q.fall === 'snow') out.push(flakes(60, true));
    // fog: thin, faint wisps up high (to the right, clear of the place and the temperature), thicker banks lower down; fog stands still
    if (q.fog) out.push([[88, 235, 190, 20, 0.55], [146, 100, 315, 26, 0.75], [236, 215, 260, 30, 0.9], [320, -60, 330], [390, 90, 360], [460, -20, 300], [530, 120, 320], [600, -40, 380]].map(([t, l, w, h, o]) => `<i class="fg" style="top: ${t}px; left: ${l}px; width: ${w}px; background: ${q.fog}${h ? `; height: ${h}px; border-radius: ${h / 2}px; opacity: ${o}` : ''}"></i>`).join(''));
    if (q.bolt) out.push('<svg class="bolt" viewBox="0 0 60 120"><path d="M34 0 L8 64 L28 64 L14 120 L56 46 L34 46 L46 0Z" fill="#f6d34a"/></svg><i class="fl"></i>');
    if (q.wind) out.push([[190, 120, 2.6, 0], [260, 90, 3.1, 1.2], [330, 150, 2.4, 0.6], [410, 110, 2.9, 2], [480, 130, 2.7, 1.5]].map(([t, w, d, dl]) => `<i class="wl" style="top: ${t}px; width: ${w}px; --d: ${d}s; --dl: -${dl}s"></i>`).join('')
        + (phase === 'night' ? '' : Array.from({ length: 10 }, () => `<i class="lv" style="top: ${Math.round(160 + r() * 400)}px; --d: ${(3 + r() * 2).toFixed(1)}s; --dl: -${(r() * 4).toFixed(1)}s"></i>`).join('') + '<svg class="tree" viewBox="0 0 60 110"><rect x="27" y="50" width="6" height="60" fill="#2c4a37"/><ellipse cx="30" cy="40" rx="24" ry="36" fill="#335c42"/></svg>'));
    const [h1, h2, h3] = q.hills;
    out.push(`<svg class="land" viewBox="0 0 390 260" preserveAspectRatio="none"><path d="M0 70 Q90 20 190 60 T390 40 V260 H0Z" fill="${h1}"/><path d="M0 110 Q120 70 230 105 T390 90 V260 H0Z" fill="${h2}"/><path d="M0 160 Q140 130 260 160 T390 150 V260 H0Z" fill="${h3}"/></svg>`);
    return `<div class="lf_sc">${out.join('')}</div>`;
}
// the same sky, small, for a card in the city list (358 by 118, drawn to fit any width)
function cardSky(cond, phase) {
    cond = condOk(cond);
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
// the home widget's sky: the same palette as the cards, the picture kept to the middle so the place, the temperature and the
// line under them stay clear (340 × 150)
function widgetSky(cond, phase) {
    cond = condOk(cond);
    const q = pal(cond, phase), W = 340, H = 150, k = H / 118, out = [`<rect width="${W}" height="${H}" fill="${q.sky}"/>`];
    for (const [y, c] of q.cb || []) out.push(`<rect y="${(y * k).toFixed(1)}" width="${W}" height="${H}" fill="${c}"/>`);
    if (q.stars) out.push(`<g fill="#fff"${phase === 'dawn' ? ' opacity=".7"' : ''}>${[[132, 22], [214, 16], [250, 44], [118, 58], [196, 70], [150, 36], [236, 80]].map(([x, y], j) => `<circle cx="${x}" cy="${y}" r="${j % 2 ? 1 : 1.4}"/>`).join('')}</g>`);
    const C = 180;
    if (q.sun === 'day') out.push(`<circle cx="${cond === 'partly' ? C - 14 : C}" cy="50" r="40" fill="#fff" opacity=".14"/><circle cx="${cond === 'partly' ? C - 14 : C}" cy="50" r="24" fill="#f6c94a"/>`);
    if (q.sun === 'rise') out.push(`<circle cx="${C}" cy="116" r="30" fill="#f6d39a" opacity=".6"/><circle cx="${C}" cy="116" r="18" fill="#fbe6a6"/>`);
    if (q.sun === 'sink') out.push(`<circle cx="${C}" cy="112" r="38" fill="#f7c873" opacity=".5"/><circle cx="${C}" cy="112" r="22" fill="#fbe08f"/>`);
    if (q.moon && !q.cloud) out.push(`<circle cx="${C}" cy="46" r="17" fill="#f1ead2"/><circle cx="${C + 8}" cy="40" r="15" fill="${q.sky}"/>`);
    if (q.moon && q.cloud) out.push(`<circle cx="${C - 26}" cy="40" r="13" fill="#f1ead2"/><circle cx="${C - 20}" cy="35" r="12" fill="${q.sky}"/>`);
    const cloud = (x, y, s, col) => `<g fill="${col}" transform="translate(${x} ${y}) scale(${s})"><circle cx="-22" cy="4" r="16"/><circle cx="0" cy="-6" r="22"/><circle cx="24" cy="4" r="15"/><rect x="-38" y="4" width="78" height="18" rx="9"/></g>`;
    if (cond === 'partly' && q.front) out.push(cloud(C + 16, 62, 0.9, '#e9f0f8'));
    else if (q.cloud && cond !== 'wind') out.push((q.cloud2 ? cloud(C - 46, 70, 0.6, q.cloud2) : '') + cloud(C + 6, 52, 1.05, q.cloud));
    const r = rnd(cond.length * 13 + phase.length);
    const lines = (col, w, n, ln, sl) => `<g stroke="${col}" stroke-width="${w}" stroke-linecap="round">${Array.from({ length: n }, () => { const x = Math.round(118 + r() * 132), y = Math.round(70 + r() * 42); return `<line x1="${x}" y1="${y}" x2="${x - sl}" y2="${y + ln}"/>`; }).join('')}</g>`;
    const flakes = (n, rad) => `<g fill="#fff">${Array.from({ length: n }, (_, j) => `<circle cx="${Math.round(112 + r() * 140)}" cy="${Math.round(38 + r() * 80)}" r="${j % 3 ? rad : rad * 0.7}"/>`).join('')}</g>`;
    if (q.fall === 'rain') out.push(lines('rgba(255,255,255,.45)', 1.6, 12, 14, 4));
    if (q.fall === 'drizzle') out.push(lines('rgba(255,255,255,.5)', 1.1, 20, 6, 1));
    if (q.fall === 'heavy') out.push(lines('rgba(255,255,255,.5)', 2, 16, 18, 6));
    if (q.fall === 'sleet') out.push(lines('rgba(255,255,255,.45)', 1.4, 8, 12, 4) + flakes(9, 2));
    if (q.fall === 'snow') out.push(flakes(22, 2.3));
    if (q.fog) out.push(`<g fill="rgba(255,255,255,.22)"><rect x="96" y="58" width="170" height="10" rx="5"/><rect x="118" y="80" width="150" height="10" rx="5"/><rect x="104" y="102" width="164" height="10" rx="5"/></g>`);
    if (q.bolt) out.push(`<path d="M${C} 62 L${C - 16} 94 L${C - 4} 94 L${C - 14} 124 L${C + 14} 86 L${C} 86 L${C + 10} 62Z" fill="#f6c94a"/>`);
    if (q.wind || cond === 'wind') out.push(`<g fill="none" stroke="rgba(255,255,255,.5)" stroke-width="2" stroke-linecap="round"><path d="M116 60 H196 Q210 60 210 50"/><path d="M134 80 H244"/><path d="M110 98 H180 Q194 98 194 108"/></g>${phase === 'night' ? '' : `<g fill="#2f5f3e"><rect x="${C + 18}" y="84" width="4" height="26" transform="rotate(12 ${C + 20} 110)"/><ellipse cx="${C + 30}" cy="80" rx="12" ry="16" transform="rotate(24 ${C + 30} 80)"/></g>`}`);
    const [h1, h2] = q.hills;
    out.push(cond === 'snow' ? `<path d="M0 136 Q90 128 180 134 T340 130 V150 H0Z" fill="${h1}"/><path d="M0 142 Q110 136 210 140 T340 138 V150 H0Z" fill="${h2}"/>`
        : `<path d="M0 120 Q90 104 180 114 T340 108 V150 H0Z" fill="${h1}"/><path d="M0 134 Q110 122 210 130 T340 126 V150 H0Z" fill="${h2}"/>`);
    return `<svg class="bg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice">${out.join('')}</svg>`;
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
// the status line's words as the sky's name: its temperature is dropped (the big number already says it)
const saidOf = h => String(h.said || '').replace(/[\p{Extended_Pictographic}\uFE0F\u200D]/gu, '').replace(/(영하\s*)?[-−]?\d{1,3}(?:[.,]\d)?\s*(?:°\s*[CF]?|℃|℉|도(?![가-힣]))/gi, '').replace(/\s*[/|·,~-]+\s*$|^\s*[/|·,~-]+\s*/g, '').trim() || WX[h.cond] || '';
// the here weather with every tile filled (sunrise and sunset from the story's zone), for the sky and the tiles alike
// a status line newer than the saved weather (a day on, or later the same day) shows over it until the next reflection
// the here weather the screens show: the phone's own, unless another phone in the same city, on the same day, was told it
// later (the newest reflection is the city's weather for every phone there; nothing is written, each keeps its own)
function hereNow(lf) {
    const h = hereOwn(lf), p = OWNER.get(lf);
    if (!p || !h.place || !h.date) return h;
    let others = [];
    try { others = Object.values(getMeta()?.phones || {}).filter(o => o && o !== p && o.owner !== p.owner && o.life?.weather); } catch { others = []; }
    const at = x => `${x.date || ''} ${x.time || ''}`, same = (a, b) => !!cityOfPlace(a, [{ name: b }]);
    const best = others.map(o => hereOwn(L(o))).filter(x => x.place && x.date === h.date && same(h.place, x.place) && at(x) > at(h)).sort((a, b) => at(b).localeCompare(at(a)))[0];
    return best ? { ...best, place: h.place } : h;
}
function hereOwn(lf) {
    const h = lf.weather.here;
    let t = null;
    try { t = weatherNow(); } catch { t = null; }
    if (!t || !/^\d{2}-\d{2}$/.test(t.date || '') || !h.date || apart(h.place, t.place, lf.weather.cities)) return h;
    const gap = dayGap(h.date, t.date);
    if (gap < 0 || gap === 0 && !(t.time && (!h.time || t.time > h.time))) return h;
    const out = overlayNow(h, t);
    if (gap > 0) { out.hours = []; out.line = ''; out.ko = ''; out.tiles = { ...(out.tiles || {}), rain24: null, rainNext: null }; }
    return out;
}
// a saved city as the screens draw it: the one the owner is in carries the "here" weather (a newer status line included)
function cityView(p, lf, c) {
    const h = hereNow(lf);
    if (cityOfPlace(h.place, lf.weather.cities) !== c) return shared(p, lf, c);
    const w = mirrorHome({ here: h, cities: [structuredClone(c)] });
    return w.cities[0];
}
// the same city on another phone in this chat: one weather for it, not two guesses.
// Another phone whose owner is in the city (its 현재 위치 names it) lends its whole weather (hours, days, tiles), when that
// weather is the city's today; else the phone whose weather was told last lends its saved city's numbers. Nothing is
// written: each phone keeps its own, and the next reflection of either one shows at once
const stamp = l => `${l.weather.here.date || ''} ${l.weather.here.time || ''}`;
function shared(p, lf, c) {
    let others = [];
    try { others = Object.values(getMeta()?.phones || {}).filter(o => o && o !== p && o.owner !== p.owner && o.life?.weather); } catch { others = []; }
    if (!others.length) return c;
    const t = cityTime(p, lf, c), day = t.dayShift === '내일' ? shiftDay(t.date, 1) : t.dayShift === '어제' ? shiftDay(t.date, -1) : t.date;
    const there = others.map(o => ({ o, l: L(o) })).map(x => ({ ...x, h: hereOwn(x.l) })).filter(x => x.h.place && cityOfPlace(x.h.place, [c]) && x.h.date === day).sort((a, b) => stamp(b.l).localeCompare(stamp(a.l)))[0];
    if (there) { const w = mirrorHome({ here: there.h, cities: [structuredClone(c)] }); return { ...w.cities[0], src: { p: there.o, h: there.h, l: there.l } }; }
    const mine = stamp(lf), saved = others.map(o => ({ l: L(o) })).map(x => ({ ...x, c2: x.l.weather.cities.find(y => cityOfPlace(y.name, [c]) || cityOfPlace(c.name, [y])) })).filter(x => x.c2 && stamp(x.l) > mine).sort((a, b) => stamp(b.l).localeCompare(stamp(a.l)))[0];
    if (!saved) return c;
    const out = structuredClone(c);
    for (const k of ['cond', 'temp', 'hi', 'lo', 'feels', 'humidity', 'dew', 'rainNext', 'wind', 'gust', 'dir', 'sunrise', 'sunset', 'visibility']) if (saved.c2[k] !== null && saved.c2[k] !== undefined && saved.c2[k] !== '') out[k] = saved.c2[k];
    return out;
}
const hereFull = (p, lf) => { const h = hereNow(lf); return { ...h, tiles: fillTiles(h, `${h.date}:${h.place}`, h.date || now5(p), hereZone(lf, p, h.place)) }; };
// what the tiles say, from their numbers
const tileLines = (h) => ({
    rain: h.tiles.rainNext ? `내일까지 ${mm(h.tiles.rainNext)} mm 더 와요` : '내일까지 비 소식 없어요',
    feels: h.tiles.feels === null || h.temp === null ? '' : h.tiles.feels < h.temp - 1 ? (h.tiles.wind > 15 ? '바람 탓에 더 추워요.' : '실제보다 춥게 느껴져요.') : h.tiles.feels > h.temp + 1 ? (h.tiles.humidity > 70 ? '습해서 더 더워요.' : '실제보다 덥게 느껴져요.') : '실제와 거의 같아요.',
    humidity: h.tiles.dew === null ? '' : `이슬점 ${h.tiles.dew}°`,
    vis: h.tiles.visibility === null ? '' : h.tiles.visibility < 8 ? (h.cond === 'fog' ? '안개 때문에 멀리 안 보여요.' : WET[h.cond] || h.cond === 'storm' ? '빗속이라 평소보다 짧아요.' : '평소보다 짧아요.') : '멀리까지 잘 보여요.',
});
const DIRS = { N: 0, NNE: 22.5, NE: 45, ENE: 67.5, E: 90, ESE: 112.5, SE: 135, SSE: 157.5, S: 180, SSW: 202.5, SW: 225, WSW: 247.5, W: 270, WNW: 292.5, NW: 315, NNW: 337.5,
    북: 0, 북북동: 22.5, 북동: 45, 동북동: 67.5, 동: 90, 동남동: 112.5, 남동: 135, 남남동: 157.5, 남: 180, 남남서: 202.5, 남서: 225, 서남서: 247.5, 서: 270, 서북서: 292.5, 북서: 315, 북북서: 337.5 };
const DIR_KO = { N: '북풍', NNE: '북북동풍', NE: '북동풍', ENE: '동북동풍', E: '동풍', ESE: '동남동풍', SE: '남동풍', SSE: '남남동풍', S: '남풍', SSW: '남남서풍', SW: '남서풍', WSW: '서남서풍', W: '서풍', WNW: '서북서풍', NW: '북서풍', NNW: '북북서풍' };
const TICKS = Array.from({ length: 36 }, (_, k) => { const a = k * 10 * Math.PI / 180, r1 = k % 9 ? 31 : 28; return `<line x1="${(41 + r1 * Math.sin(a)).toFixed(1)}" y1="${(41 - r1 * Math.cos(a)).toFixed(1)}" x2="${(41 + 35 * Math.sin(a)).toFixed(1)}" y2="${(41 - 35 * Math.cos(a)).toFixed(1)}" stroke="rgba(255,255,255,${k % 9 ? 0.4 : 0.9})" stroke-width="${k % 9 ? 1 : 1.6}"/>`; }).join('');
// one tile: a label, a big number, a flat picture, a line
const tile = (label, big, pic, line) => `<div class="lf_tile"><div class="hd">${label}</div><b>${big}</b>${pic}${line ? `<p>${line}</p>` : ''}</div>`;
const mm = v => String(v).replace('.', STORY.dot ? '.' : ',');
function sunsetTile(sunset, sunrise, now, tileCol) {
    const lm = toMin(now), ss = toMin(sunset), past = lm !== null && ss !== null && (lm >= ss || lm < (toMin(sunrise) ?? 6 * 60 + 30));
    const a = shade(tileCol, 0.92), b = shade(tileCol, 0.85);
    return tile('일몰', clockOf(STORY.p, sunset), `<svg class="pic sunset" viewBox="0 0 160 62" preserveAspectRatio="none"><circle cx="80" cy="46" r="34" fill="#f6c94a" opacity=".14"/><circle cx="80" cy="46" r="22" fill="#f6c94a" opacity=".26"/><circle cx="80" cy="46" r="13" fill="#f6c94a"/><rect x="0" y="46" width="160" height="16" fill="${a}"/><path d="M0 46 Q40 40 80 46 T160 44 V62 H0Z" fill="${b}"/><line x1="0" y1="46" x2="160" y2="46" stroke="rgba(255,255,255,.5)" stroke-width="1"/></svg>`,
        past ? (sunrise ? `일출 ${clockOf(STORY.p, sunrise)}` : '해가 졌어요.') : lm !== null && ss !== null ? `${dur(ss - lm)} 뒤` : '');
}
// every tile is always drawn: what the model didn't give is read off the sky, the temperature and the month, seeded by
// place and day so it holds between redraws. Fog: a few km and damp air; rain: wet, windier, short sight; a clear day: far
const SUN = [['07:45', '17:35'], ['07:25', '18:05'], ['06:50', '18:35'], ['06:05', '19:00'], ['05:30', '19:25'], ['05:15', '19:50'], ['05:25', '19:50'], ['05:50', '19:25'], ['06:15', '18:45'], ['06:40', '18:05'], ['07:10', '17:30'], ['07:35', '17:20']];
function fillTiles(h, seed, date, tz = '') {
    const T = { ...h.tiles }, c = h.cond, r = seeded(`${seed}:tiles`), pick = (a, b) => a + (b - a) * r(), temp = h.temp ?? ((h.lo ?? 10) + (h.hi ?? 10)) / 2;
    const wet = WET[c] || c === 'storm' || c === 'snow';
    if (!T.sunset || !T.sunrise) { const m = Number(String(date || '').slice(0, 2)), s = sunOf(String(date || '').slice(0, 5), tz) || SUN[m - 1] || SUN[5]; T.sunrise ||= s[0]; T.sunset ||= s[1]; }
    if (T.rain24 === null && T.rainNext === null) T.rainNext = Math.round(pick(...({ storm: [8, 15], rain: [3, 8], sleet: [2, 5], snow: [1, 4], drizzle: [0.5, 2] }[c] || [0, 0])) * 2) / 2;
    if (T.wind === null) T.wind = Math.round(pick(...(c === 'wind' ? [30, 50] : c === 'storm' ? [25, 45] : WET[c] ? [12, 25] : c === 'clear' ? [5, 15] : [8, 20])));
    if (T.gust === null) T.gust = Math.round(T.wind * pick(1.3, 1.7));
    if (!T.dir) T.dir = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'][Math.floor(r() * 8)];
    if (T.humidity === null) T.humidity = Math.round(pick(...(c === 'fog' ? [92, 98] : WET[c] ? [85, 95] : c === 'snow' || c === 'sleet' ? [80, 90] : c === 'clear' ? [40, 60] : [60, 75])));
    if (T.dew === null) T.dew = Math.round(temp - (100 - T.humidity) / 5);
    if (T.feels === null) T.feels = Math.round(temp - (T.wind > 15 && temp < 15 ? T.wind / 10 : 0) + (T.humidity > 70 && temp > 24 ? 2 : 0));
    if (T.visibility === null) { let v = pick(...(c === 'fog' ? [1.5, 4] : wet ? [5, 10] : [15, 25])); if (T.humidity >= 85 && c !== 'fog') v *= 0.7; T.visibility = Math.max(1, Math.round(v)); }
    return T;
}
function weatherTiles(h, tileCol, lead = '') {
    const T = h.tiles, t = tileLines(h), out = [lead];
    if (!lead && T.sunset) out.push(sunsetTile(T.sunset, T.sunrise, h.time, tileCol));
    if (T.rain24 !== null || T.rainNext !== null) {
        const v = T.rain24 ?? T.rainNext, f = Math.min(1, v / 4), hs = [30, 38, 26, 16, 8, 4, 2];
        const bars = v ? hs.map((x, k) => `<rect x="${2 + k * 20}" y="${42 - Math.max(2, Math.round(x * f))}" width="14" height="${Math.max(2, Math.round(x * f))}" rx="3" opacity="${[1, 1, 1, 0.6, 0.45, 0.35, 0.3][k]}"/>`).join('') : hs.map((_, k) => `<rect x="${2 + k * 20}" y="38" width="14" height="4" rx="2" opacity=".35"/>`).join('');
        out.push(tile('강수량', `${mm(v)} <small>mm</small>`, `<svg class="pic bars" viewBox="0 0 140 42"><g fill="#a9dcff">${bars}</g></svg>`, t.rain));
    }
    if (T.wind !== null) out.push(tile('바람', `${T.wind} <small>km/h</small>`, `<svg class="pic cmp" viewBox="0 0 82 82"><circle cx="41" cy="41" r="36" fill="none" stroke="rgba(255,255,255,.35)" stroke-width="1.5"/>${TICKS}<text x="41" y="13" text-anchor="middle" font-size="8" fill="#fff" font-weight="700">N</text><g transform="rotate(${DIRS[String(T.dir || '').toUpperCase().replace(/풍$/, '')] ?? 225} 41 41)"><path d="M41 12 L46 41 L41 36 L36 41Z" fill="#fff"/><path d="M41 70 L45 41 L37 41Z" fill="rgba(255,255,255,.45)"/></g><circle cx="41" cy="41" r="3" fill="#fff"/></svg>`,
        [T.gust ? `돌풍 ${T.gust} km/h` : '', DIR_KO[String(T.dir || '').toUpperCase()] || (/^[가-힣]+$/.test(T.dir || '') && !/풍$/.test(T.dir) ? `${T.dir}풍` : T.dir)].filter(Boolean).join(' · ')));
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
// the forecast from the phone's day: days already past drop off, only the phone's own day reads "오늘" (and carries the
// dot for the temperature now), the next one "내일" when the week isn't known, the rest by weekday
// when the saved forecast starts after the phone's day, today's row is drawn from the header (its sky, high and low)
function dayRows(days, today, h = {}) {
    if (!/^\d{2}-\d{2}$/.test(today || '')) return days.map((d, k) => ({ d, name: k ? wdk(d.day, `${Number(d.day.slice(3))}일`) : '오늘', now: !k }));
    const dated = d => /^\d{2}-\d{2}$/.test(d.day || '');
    if (days.length && h.date === today && !days.some(d => dated(d) && dayGap(today, d.day) === 0)) days = [{ day: today, cond: h.cond, lo: h.lo ?? null, hi: h.hi ?? null, rain: 0 }, ...days];
    return days.filter(d => !/^\d{2}-\d{2}$/.test(d.day || '') || dayGap(today, d.day) >= 0).map(d => {
        const g = /^\d{2}-\d{2}$/.test(d.day || '') ? dayGap(today, d.day) : null;
        return { d, name: g === 0 ? '오늘' : g === 1 && !STORY.known ? '내일' : wdk(d.day, `${Number(String(d.day).slice(3))}일`), now: g === 0 };
    });
}
function weatherBody(p, h, name, night, sub, source, tileCol, lead = '') {
    const rows = dayRows(h.days, h.today, h);
    h = { ...h, days: rows.map(x => x.d) };
    const lo =Math.min(...h.days.map(d => d.lo ?? 99), h.lo ?? 99), hi = Math.max(...h.days.map(d => d.hi ?? -99), h.hi ?? -99);
    return `<div class="lf_wtop">${sub ? `<small>${sub}</small>` : ''}<h2>${esc(name)}</h2><div class="t">${h.temp ?? '—'}°</div><div class="c">${esc(saidOf(h))}</div><div class="hl">최고:${h.hi ?? '—'}° 최저:${h.lo ?? '—'}°</div>${source}</div>
      ${h.hours.length ? `<div class="lf_wcard">${h.line ? `<div class="ln1">${esc(h.line)}${k1(h.ko, 'lf_wk')}</div>` : ''}<div class="lf_hrs">${h.hours.map((x, k) => `<div>${k ? esc(hourOf(p, x.time)) : '지금'}<em>${x.rain >= 20 ? `${x.rain}%` : ''}</em>${wxIc(x.cond, 26, phaseOf(x.time, h.tiles.sunrise || h.sr, h.tiles.sunset || h.ss) === 'night')}<b class="cg_num">${x.temp ?? '—'}°</b></div>`).join('')}</div>${hourLine(h.hours)}</div>` : ''}
      ${h.days.length ? `<div class="lf_wcard"><div class="hd">${h.days.length}일간의 일기예보</div>${rows.map(({ d, name: dn, now: isNow }) => `<div class="lf_d10"><span>${dn}</span><span class="ic">${wxIc(d.cond, 22)}${d.rain >= 30 ? `<em>${d.rain}%</em>` : ''}</span><span class="lo cg_num">${d.lo ?? '—'}°</span>${tempBar(d, lo, hi, isNow ? h.temp : null)}<span class="hi cg_num">${d.hi ?? '—'}°</span></div>`).join('')}</div>` : ''}
      ${weatherTiles(h, tileCol, lead)}`;
}
// the screen's colours: the sky, and the one flat colour its cards and tiles sit in
const wxVars = q => `background: ${q.sky}; --wcard: ${shade(q.sky, 0.9)}; --wtile: ${shade(q.sky, q.phase === 'day' && q.sky === '#4f8fd8' ? 0.62 : 0.8)}`;
// the hourly row at the story's clock: "now" is the sky in the header, then the next five whole hours; an hour the
// model saved is shown as saved, the others are carried on along the day's temperature curve
function hereHours(h, time) {
    const n = toMin(time), saved = h.hours || [];
    if (n === null) return saved;
    const at = m => saved.find(x => { const s = toMin(x.time); return s !== null && Math.min((s - m + 1440) % 1440, (m - s + 1440) % 1440) <= 10; });
    const first = Math.floor(n / 60) * 60 + 60, slots = [0, 1, 2, 3, 4].map(k => (first + k * 60) % 1440);
    const today = h.today || h.date, next = /^\d{2}-\d{2}$/.test(today || '') ? (h.days || []).find(d => /^\d{2}-\d{2}$/.test(d.day || '') && dayGap(today, d.day) === 1) : null;
    return walkHours({ time: hm(n), cond: h.cond, temp: h.temp, rain: at(first)?.rain ?? 0 }, h, `${h.date}:${h.place}:hrs`, slots.map(at), next);
}
export function weatherScreen(p, now) {
    const lf = L(p);
    if (!lf) return lifeEmpty(p, now, '날씨', 'life');
    // the phone's own clock (the weather's time is when it was last told, often hours before)
    const h = hereFull(p, lf), time = now5(p).slice(6) || h.time, phase = phaseOf(time, h.tiles.sunrise, h.tiles.sunset), q = pal(h.cond, phase);
    return `<div class="lf_wx" style="${wxVars(q)}">${scene(h.cond, phase)}
      ${axBar(p, now, '#fff')}
      <div class="ax_top lf_wbar">${axCb('home2')}<button type="button" class="lf_pill wx" data-go="wlist">도시 ${lf.weather.cities.filter(c => c !== cityOfPlace(h.place, lf.weather.cities)).length}</button></div>
      <div class="ax_scroll">${weatherBody(p, { ...h, time, today: now5(p).slice(0, 5), hours: hereHours({ ...h, today: now5(p).slice(0, 5) }, time) }, h.place || '현재 위치', phase === 'night', '현재 위치', '<div class="lf_wgap"></div>', shade(q.sky, 0.8))}<i class="lf_pad"></i></div>
      ${axInd('#fff')}</div>`;
}
// a saved city: only its temperature, highs and lows and sky are the model's; its hours are drawn between them
// the hours ahead for a city: from its clock, along the day's curve, the same way the current place's row is carried on
function cityHours(c, t) {
    const base = toMin(t.time) ?? 12 * 60;
    return walkHours({ time: hm(base), cond: c.cond, temp: c.temp, rain: c.cond === 'rain' ? 60 : c.cond === 'storm' ? 70 : c.cond === 'drizzle' || c.cond === 'sleet' ? 40 : 0 }, c, `${c.name}:${t.date}:hrs`);
}
// one rule for every hourly row: from the first entry on, each hour follows the day's temperature curve (coldest
// before dawn at the day's low, warmest mid-afternoon at its high), never past the low or the high. It only climbs
// from dawn to mid-afternoon and only falls after; a small wobble seeded by place and day sets how much, the way real
// readings move. A saved hour (fixed[k]) is shown as is and the walk goes on from it
function walkHours(first, c, seed, fixed = [], next = null) {
    const range = d => { const lo = Math.min(d.lo ?? (c.temp ?? 10) - 4, d.hi ?? Infinity); return [lo, Math.max(d.hi ?? (c.temp ?? 10) + 4, lo)]; };
    let [lo, hi] = range(c), v = first.temp ?? (lo + hi) / 2;
    const r = seeded(seed), out = [first], curve = mins => lo + (hi - lo) * (Math.cos(((mins / 60 - 15) / 24) * 2 * Math.PI) + 1) / 2;
    // how far the reading sits off the curve; it fades hour by hour, so a cold evening keeps falling from where it is
    let off = v - curve(toMin(first.time) ?? 720);
    for (let k = 0; out.length < 6; k++) {
        const last = out[out.length - 1], m = (Math.floor(toMin(last.time) / 60) * 60 + 60) % 1440, x = fixed[k];
        // past midnight the hours are the next day's, with its own low and high when the forecast has them
        if (m === 0 && next) [lo, hi] = range(next);
        if (x) { out.push(x); if (x.temp !== null && x.temp !== undefined) { v = x.temp; off = v - curve(m); } continue; }
        const hr = m / 60, up = hr >= 5 && hr <= 15;
        off *= 0.8;
        // climbing: along the curve; falling: most of the drop early in the evening, levelling off toward dawn's low
        let d = up ? (curve(m) + off - v) * 0.7 + r() * 0.6 : (lo - v) * 0.12 - r() * 0.3;
        d = up ? Math.max(0, d) : Math.min(0, d);
        // a "now" already outside the day's range isn't pulled back in one jump
        v = Math.max(Math.min(lo, v), Math.min(Math.max(hi, v), v + d));
        out.push({ time: hm(m), cond: last.cond, temp: Math.round(v), rain: last.rain });
    }
    return out;
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
    const lf = L(p), c0 = lf?.weather.cities.find(x => x.id === id), c = c0 && cityView(p, lf, c0);
    if (!c) return weatherScreen(p, now);
    const t = cityTime(p, lf, c), src = c.src, today = src ? now5(src.p).slice(0, 5) : '';
    const h = src ? { ...src.h, temp: c.temp, hi: c.hi, lo: c.lo, cond: c.cond, time: t.time, today, hours: hereHours({ ...src.h, today }, t.time) } : { temp: c.temp, hi: c.hi, lo: c.lo, cond: c.cond, time: t.time, line: '', ko: '', hours: cityHours(c, t), days: [] };
    h.tiles = fillTiles({ ...h, tiles: { sunset: c.sunset || '', sunrise: c.sunrise || '', rain24: null, rainNext: c.rainNext ?? null, feels: c.feels ?? null, wind: c.wind ?? null, gust: c.gust ?? null, humidity: c.humidity ?? null, dew: c.dew ?? null, visibility: c.visibility ?? null, dir: c.dir || '' } }, `${c.name}:${now5(p).slice(0, 5)}`, now5(p), c.tz);
    // a city shows no visibility tile: its detail already carries today's temperatures, and seven tiles leave one alone
    h.tiles.visibility = null;
    const phase = phaseOf(t.time, h.tiles.sunrise, h.tiles.sunset), q = pal(c.cond, phase), tileCol = shade(q.sky, q.phase === 'day' && q.sky === '#4f8fd8' ? 0.62 : 0.8);
    const lm = toMin(t.time), warm = (c.hi ?? 0) >= 15 ? '#f3c66b' : '#9fd6ec';
    // the city's own tiles first: its sunset and today's temperatures; no clock, the status bar and the list already tell the time
    const lead = `${sunsetTile(h.tiles.sunset, h.tiles.sunrise, t.time, tileCol)}${tile('오늘 기온', `${c.temp ?? '—'}°`, dayCurve(c, lm, warm), `최저 ${c.lo ?? '—'}° · 최고 ${c.hi ?? '—'}°`)}`;
    return `<div class="lf_wx" style="${wxVars(q)}">${scene(c.cond, phase)}
      ${axBar(p, now, '#fff')}
      <div class="ax_top lf_wbar">${axCb('wlist')}<span></span></div>
      <div class="ax_scroll">${weatherBody(p, h, c.name, phase === 'night', '', c.note ? `<div class="lf_wsrc">${esc(c.note)}${c.noteKo && koOn() ? ` · ${esc(c.noteKo)}` : ''}</div>` : '<div class="lf_wgap"></div>', tileCol, lead)}<i class="lf_pad"></i></div>
      ${axInd('#fff')}</div>`;
}
// the home's second page: where the owner is now, drawn like the weather app's city card (until the weather is filled, a plain glass card that says so)
export function hereWidget(p, now) {
    const h = L(p)?.weather?.here;
    if (!h || (h.temp === null || h.temp === undefined) && !h.cond) return `<button type="button" class="cg_glass cg_wcal cg_wwal cg_wxe" data-go="weather">
      <span class="cg_wh"><span class="cg_cap">날씨</span><span class="cg_evw">현재 위치</span></span>
      <span class="cg_wxeb"><svg aria-hidden="true" width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#8a929d" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M7 17a4 4 0 0 1 .5-8A5.5 5.5 0 0 1 18 11a3 3 0 0 1-.5 6zM15 4.5a3 3 0 0 1 3.5 2.5"/></svg><b>아직 날씨가 없어요</b><small>눌러서 채우기</small></span>
    </button>`;
    // the same weather the app shows: a newer status line already over the saved one
    const f = hereFull(p, L(p)), ph = phaseOf(now5(p).slice(6) || f.time, f.tiles.sunrise, f.tiles.sunset);
    return `<button type="button" class="lf_city cg_wx" data-go="weather" style="--axbg: ${pal(f.cond, ph).sky}">${widgetSky(f.cond, ph)}
      <span class="l"><b>${esc(f.place || '현재 위치')}</b><small><svg width="11" height="11" viewBox="0 0 24 24"><path d="M3 11l18-8-8 18-2-8z" fill="#fff"/></svg> 현재 위치</small><span>${esc(saidOf(f))}</span></span><span class="r"><b>${f.temp ?? '—'}°</b><span>최고 ${f.hi ?? '—'}° 최저 ${f.lo ?? '—'}°</span></span></button>`;
}
export function cityList(p, now) {
    const lf = L(p); if (!lf) return weatherScreen(p, now);
    // the saved city the owner is in is the 현재 위치 card (its note goes with it), not a second card
    const h = hereFull(p, lf), ht = now5(p).slice(6) || h.time, same = cityOfPlace(h.place, lf.weather.cities);
    const nav = '<svg width="11" height="11" viewBox="0 0 24 24"><path d="M3 11l18-8-8 18-2-8z" fill="#fff"/></svg>';
    const card = (go, i, name, sub, cond, phase, temp, hi, lo, foot) => `<button type="button" class="lf_city" data-go="${go}"${i ? ` data-i="${i}"` : ''} style="--axbg: ${pal(cond, phase).sky}">${cardSky(cond, phase)}
      <span class="l"><b>${esc(name)}</b><small>${sub}</small><span>${esc(foot)}</span></span><span class="r"><b>${temp ?? '—'}°</b><span>최고 ${hi ?? '—'}° 최저 ${lo ?? '—'}°</span></span></button>`;
    return `${axBar(p, now)}${axTop(axCb('weather'), axKp(p))}
      <div class="ax_scroll">${axH1('날씨')}
        <div class="lf_q">${ax('search', 16, '#8a929d', 2.4)}도시 또는 공항 검색</div>
        ${card('weather', '', h.place || '현재 위치', `${nav} 현재 위치`, h.cond, phaseOf(ht, h.tiles.sunrise, h.tiles.sunset), h.temp, h.hi, h.lo, [saidOf(h), same?.note].filter(Boolean).join(' · '))}
        ${lf.weather.cities.filter(c0 => c0 !== same).map(c0 => { const c = cityView(p, lf, c0), t = cityTime(p, lf, c), sun = c.sunrise && c.sunset ? [c.sunrise, c.sunset] : sunOf(now5(p).slice(0, 5), c.tz) || []; return card('wcity', c.id, c.name, t.off ? `${clockOf(p, t.time)} · ${t.off > 0 ? '+' : '−'}${Math.abs(t.off)}시간` : '', c.cond, phaseOf(t.time, sun[0], sun[1]), c.temp, c.hi, c.lo, [WX[c.cond], c.note].filter(Boolean).join(' · ')); }).join('')}
        <i class="lf_pad"></i></div>${axInd()}`;
}

// ================= 배달 =================
// two looks: 배달의민족 where the owner lives in Korea, Uber Eats elsewhere. Every dish is drawn (phonefood.js): the model names
// a base, toppings, a size and sides; older records are guessed from their words. Nothing here is the model's prose but names and notes.
const D = p => { const d = p.delivery; if (!d) return null; d.shops ||= []; d.orders ||= []; if (!d.cart || !Array.isArray(d.cart.items)) d.cart = null; return d; };
const CUR = { KR: 'KRW', US: 'USD', GB: 'GBP', JP: 'JPY', CH: 'CHF', CA: 'CAD', AU: 'AUD', CN: 'CNY', TW: 'TWD', BR: 'BRL', RU: 'RUB' };
const money = (p, n) => fmtMoney({ ...p, money: { currency: p.money?.currency || CUR[p.lives || p.country] || 'EUR' } }, n);
const shopOf = (d, name) => d.shops.find(s => s.name === name);
// a dish's picture: its own, else the same dish on the shop's menu, else guessed from its words
const picFor = (d, shopName, x) => x?.pic || shopOf(d, shopName)?.menu.find(m => m.name === x?.name)?.pic || guessPic(`${x?.name || ''} ${x?.desc || ''} ${shopOf(d, shopName)?.cuisine || ''}`);
const shopPic = s => s.menu.find(m => m.top)?.pic || s.menu[0]?.pic || guessPic(`${s.menu[0]?.name || ''} ${s.cuisine} ${s.name}`);
const pic = (p, cls = '', mode = 'thumb', big = '') => `<span class="dv_pic ${cls}">${dishSvg(p, mode, big)}</span>`;
const ST_KO = { 'on the way': '배달 중', delivered: '배달완료', cancelled: '주문 취소', refunded: '환불 완료' }, ST_DE = { 'on the way': 'Unterwegs', delivered: 'Zugestellt', cancelled: 'Storniert', refunded: 'Erstattet' };
const cartCount = d => (d.cart?.items || []).reduce((n, x) => n + x.qty, 0), cartSum = d => (d.cart?.items || []).reduce((n, x) => n + x.qty * x.price, 0);
const orderSum = o => o.items.reduce((n, x) => n + x.qty * x.price, 0) + o.fee + o.tip - o.discount;
const toLine = (o, bm) => (o.gift ? (bm ? `${o.gift} 집으로` : `an ${o.gift}`) : o.to === 'home' ? (bm ? '우리집' : 'Zuhause') : o.to === 'work' ? (bm ? '회사' : 'Arbeit') : o.to);
const SV = (d, w = 22, extra = '') => `<svg width="${w}" height="${w}" viewBox="0 0 24 24" aria-hidden="true"${extra}>${d}</svg>`;
const I = {
    back: SV('<path d="M20 12H5M11 5l-7 7 7 7" stroke="currentColor" stroke-width="2.2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>'),
    x: SV('<path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>', 20),
    cart: SV('<path d="M3 4h2.4l2 11h10.8l2-8H6.6" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/><circle cx="9" cy="19.5" r="1.4" fill="currentColor"/><circle cx="17" cy="19.5" r="1.4" fill="currentColor"/>', 24),
    bell: SV('<path d="M6 17V11a6 6 0 0 1 12 0v6l1.5 2h-15z M10 21h4" stroke="currentColor" stroke-width="2" fill="none" stroke-linejoin="round"/>', 24),
    search: SV('<circle cx="11" cy="11" r="6.5" stroke="currentColor" stroke-width="2.2" fill="none"/><path d="M16 16l4.5 4.5" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>'),
    share: SV('<path d="M14 4h6v6M20 4l-9 9M18 14v5H5V6h5" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>'),
    heart: SV('<path d="M12 20s-7.5-4.6-8.6-9.6C2.6 6.8 6.4 4.4 9 6.2c1.3.9 2.2 2.2 3 3.2.8-1 1.7-2.3 3-3.2 2.6-1.8 6.4.6 5.6 4.2C19.5 15.4 12 20 12 20z" stroke="currentColor" stroke-width="2" fill="none"/>', 24),
    heartF: SV('<path d="M12 20s-7.5-4.6-8.6-9.6C2.6 6.8 6.4 4.4 9 6.2c1.3.9 2.2 2.2 3 3.2.8-1 1.7-2.3 3-3.2 2.6-1.8 6.4.6 5.6 4.2C19.5 15.4 12 20 12 20z" fill="#f04452"/>', 24),
    home: SV('<path d="M4 11l8-7 8 7v9h-5v-6h-6v6H4z" fill="currentColor"/>', 24),
    list: SV('<rect x="5" y="3" width="14" height="18" rx="2" stroke="currentColor" stroke-width="2" fill="none"/><path d="M9 9h6M9 13h6" stroke="currentColor" stroke-width="2"/>', 24),
    my: SV('<circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="2" fill="none"/><path d="M8 13q4 5 8 0" stroke="currentColor" stroke-width="2" fill="none"/>', 24),
    pin: SV('<path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z" stroke="currentColor" stroke-width="2" fill="none"/><circle cx="12" cy="9.5" r="2.5" stroke="currentColor" stroke-width="2" fill="none"/>', 18),
    chev: SV('<path d="M9 5l7 7-7 7" stroke="currentColor" stroke-width="2.2" fill="none" stroke-linecap="round"/>', 16),
    down: SV('<path d="M5 9l7 7 7-7" stroke="currentColor" stroke-width="2.2" fill="none" stroke-linecap="round"/>', 16),
    star: SV('<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z" fill="#ffc531"/>', 15),
    starK: SV('<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z" fill="#000"/>', 15),
    clock: SV('<circle cx="12" cy="12" r="8.5" stroke="currentColor" stroke-width="2" fill="none"/><path d="M12 7.5V12l3 2" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/>', 17),
    phone: SV('<path d="M6 3h3l2 5-2.5 1.5a11 11 0 0 0 6 6L16 13l5 2v3a2 2 0 0 1-2 2A17 17 0 0 1 4 5a2 2 0 0 1 2-2z" stroke="currentColor" stroke-width="2" fill="none" stroke-linejoin="round"/>', 19),
};
const round = (go, icon, i = '') => `<${go ? `button type="button" data-go="${go}"${i ? ` data-i="${esc(i)}"` : ''}` : 'span'} class="dv_rb">${icon}</${go ? 'button' : 'span'}>`;
const bmTab = on => `<div class="dv_tab">${[['dlv', I.home, '홈'], ['', I.heart, '찜'], ['dorders', I.list, '주문내역'], ['', I.my, 'my배민']].map(([go, ic, t]) => `<${go ? `button type="button" data-go="${go}"` : 'span'} class="${go && go === on ? 'on' : ''}"><i>${ic}</i>${t}</${go ? 'button' : 'span'}>`).join('')}</div>`;
const ueTab = on => `<div class="dv_tab">${[['dlv', I.home, 'Startseite'], ['', I.search, 'Suchen'], ['dorders', I.list, 'Bestellungen'], ['', I.my, 'Konto']].map(([go, ic, t]) => `<${go ? `button type="button" data-go="${go}"` : 'span'} class="${go && go === on ? 'on' : ''}"><i>${ic}</i>${t}</${go ? 'button' : 'span'}>`).join('')}</div>`;
const kk = x => (x?.ko && koOn() ? `<span class="lf_k">${esc(x.ko)}</span>` : '');
// the 한국어 toggle, only when something in the app has a Korean line to show
const dvKo = d => [...d.shops, ...d.shops.flatMap(s => s.menu || []), ...d.orders, ...d.orders.flatMap(o => o.items || []), ...(d.cart?.items || [])].some(x => x?.ko || x?.optionKo || x?.noteShopKo || x?.noteRiderKo);
const dvKp = (d, cls) => (dvKo(d) ? `<button type="button" class="na_ph_kochip ${cls} ${koOn() ? 'on' : ''}">${cls === 'dv_kpu' ? '<i></i>한국어' : '가 한국어'}</button>` : '');
const BM_CATS = [['rice', '한그릇'], ['chinese', '중식'], ['sushi', '돈까스·회'], ['pizza', '피자'], ['burger', '패스트푸드'], ['stew', '찜·탕'], ['jokbal', '족발·보쌈'], ['snack', '분식'], ['cafe', '카페'], ['chicken', '치킨']];
const UE_CATS = [['pizza', 'Pizza'], ['sushi', 'Sushi'], ['burger', 'Burger'], ['asian', 'Asiatisch'], ['salad', 'Gesund']];
const shopsByUse = d => [...d.shops].sort((a, b) => d.orders.filter(o => o.shop === b.name).length - d.orders.filter(o => o.shop === a.name).length);
const rate = r => String(r).replace(',', '.');
export function dlvScreen(p, now) {
    const d = D(p);
    if (!d) return lifeEmpty(p, now, '배달', 'delivery');
    const shops = shopsByUse(d), recent = [...d.orders].reverse(), bm = d.look === 'baemin';
    const used = shops.filter(s => d.orders.some(o => o.shop === s.name)), rest = shops.filter(s => !used.includes(s));
    if (bm) {
        const addr = recent[0]?.to === 'home' || !recent[0] ? '우리집' : recent[0].to === 'work' ? '회사' : recent[0].to;
        const card = s => `<button type="button" class="dv_fav" data-go="dshop" data-i="${s.id}"><span class="ph">${pic(shopPic(s))}${s.eta ? `<em>${esc(s.eta.replace('–', '~'))}분</em>` : ''}</span><b>${esc(s.name)}</b>${kk(s)}<small>${s.rating ? `${I.star}<strong>${comma(rate(s.rating))}</strong>` : ''}${s.reviews ? `<span>(${n0(s.reviews)})</span>` : ''}</small><small class="m">배달팁 ${esc(money(p, s.fee))}</small></button>`;
        const row = s => `<button type="button" class="dv_near" data-go="dshop" data-i="${s.id}">${pic(shopPic(s))}<span><b>${esc(s.name)}</b><small>${s.rating ? `${I.star}<strong>${comma(rate(s.rating))}</strong>` : ''}${s.reviews ? ` (${n0(s.reviews)})` : ''}${s.eta ? ` · ${esc(s.eta.replace('–', '~'))}분` : ''}</small><span class="tags">${s.minOrder ? `<i>최소주문 ${esc(money(p, s.minOrder))}</i>` : ''}<i>배달팁 ${esc(money(p, s.fee))}</i></span></span></button>`;
        return `<div class="dv bm"><div class="dv_bmh">${axBar(p, now)}
            <div class="dv_bmtop">${axCb('home2')}<b>${esc(addr)} ${I.down}</b><span class="r">${I.bell}${d.cart ? `<button type="button" data-go="dcart" class="dv_cartb">${I.cart}<em>${cartCount(d)}</em></button>` : `<span class="dv_cartb">${I.cart}</span>`}</span></div>
            <div class="dv_q">${I.search}야식 뭐 먹지?</div></div>
          <div class="ax_scroll dv_sc"><div class="dv_sheet"><div class="dv_tabs"><span class="on">음식배달</span><span>픽업</span>${dvKp(d, 'dv_kpb')}</div>
              <div class="dv_cats">${BM_CATS.map(([k, t]) => `<span><i>${CAT[k]}</i>${t}</span>`).join('')}</div>
              <div class="dv_all">음식배달 전체 보기 ${I.chev}</div></div>
            ${used.length ? `<div class="dv_sec"><b>자주 시킨 가게</b><span>전체보기 ${I.chev}</span></div><div class="dv_favs">${used.map(card).join('')}</div>` : ''}
            ${rest.length ? `<div class="dv_sec"><b>우리 동네 인기 가게</b><span>전체보기 ${I.chev}</span></div>${rest.map(row).join('')}` : ''}
            <i class="lf_pad"></i></div>${bmTab('dlv')}</div>`;
    }
    const big = (rest[0] || shops[0]);
    return `<div class="dv ue">${axBar(p, now)}
        <div class="dv_uetop">${axCb('home2')}<span class="a"><small>Jetzt liefern</small><b>${esc(recent[0]?.address || 'Zuhause')} ${I.down}</b></span><span class="r">${dvKp(d, 'dv_kpu')}${I.bell}${d.cart ? `<button type="button" data-go="dcart" class="dv_cartb">${I.cart}<em>${cartCount(d)}</em></button>` : `<span class="dv_cartb">${I.cart}</span>`}</span></div>
        <div class="dv_q">${I.search}Essen, Geschäfte, Getränke</div>
        <div class="ax_scroll dv_sc"><div class="dv_cats ue">${UE_CATS.map(([k, t]) => `<span><i>${CAT[k]}</i>${t}</span>`).join('')}</div>
          <div class="dv_chips"><span>Abholung</span><span>Angebote</span><span class="on">Liefergebühr unter 2 € ${I.down}</span></div>
          ${used.length ? `<div class="dv_h">Erneut bestellen</div><div class="dv_again">${used.slice(0, 4).map(s => `<button type="button" data-go="dshop" data-i="${s.id}">${pic(shopPic(s))}<b>${esc(s.name)}</b><small>${esc(s.eta || '')} Min.</small></button>`).join('')}</div>` : ''}
          ${big ? `<div class="dv_h">Beliebt in deiner Nähe</div><button type="button" class="dv_big" data-go="dshop" data-i="${big.id}">${pic(shopPic(big), 'wide', 'hero')}<span class="r"><span><b>${esc(big.name)}</b><small>${esc(money(p, big.fee))} Liefergebühr${big.eta ? ` · ${esc(big.eta)} Min.` : ''}</small></span>${big.rating ? `<em>${comma(rate(big.rating))}</em>` : ''}</span></button>` : ''}
          <i class="lf_pad"></i></div>${ueTab('dlv')}</div>`;
}
export function shopScreen2(p, now, id) {
    const d = D(p), s = d?.shops.find(x => x.id === id);
    if (!s) return dlvScreen(p, now);
    const bm = d.look === 'baemin', inCart = d.cart?.shop === s.name, sp = shopPic(s);
    const dish = (x, k) => `<button type="button" class="dv_dish" data-go="ditem" data-i="${s.id}~${k}"><span class="t"><b>${x.top && bm ? '<em class="rep">대표</em>' : ''}${esc(x.name)}</b>${kk(x)}${x.desc ? `<small>${esc(x.desc)}</small>` : ''}<strong>${esc(money(p, x.price))}</strong>${x.top && !bm ? '<em class="pop">#1 Beliebt</em>' : ''}</span><span class="pw">${pic(picFor(d, s.name, x))}${bm ? '' : '<i>+</i>'}</span></button>`;
    const head = `<div class="dv_hero">${pic(sp, 'hero', 'hero')}${axBar(p, now)}<div class="dv_herobar">${round('dlv', I.back)}<span>${bm ? round('', I.share) : round('', s.fav ? I.heartF : I.heart)}${round('', I.search)}${bm ? round(d.cart ? 'dcart' : '', I.cart) : ''}</span></div>${bm ? `<span class="dv_logo">${pic(sp)}</span>` : ''}</div>`;
    const cta = inCart ? (bm ? `<div class="dv_bot"><span class="sum"><b>${esc(money(p, cartSum(d)))}</b><small>바로 주문할 수 있어요</small></span><button type="button" class="dv_btn" data-go="dcart"><em>${cartCount(d)}</em>장바구니 보기</button></div>`
        : `<div class="dv_bot"><button type="button" class="dv_btn" data-go="dcart"><em>${cartCount(d)}</em>Warenkorb ansehen · ${esc(money(p, cartSum(d)))}</button></div>`) : '';
    if (bm) return `<div class="dv bm white">${head}<div class="ax_scroll dv_sc top">
        <div class="dv_shead"><div class="n"><h2>${esc(s.name)}</h2>${s.fav ? I.heartF : I.heart}</div>${kk(s)}<div class="r"><span>${s.rating ? `${I.star}<b>${comma(rate(s.rating))}</b>` : ''}${s.reviews ? ` (${n0(s.reviews)})` : ''} ${I.chev}</span><em>가게정보·원산지</em></div></div>
        <div class="dv_info"><div class="sw"><span class="on">배달</span><span>픽업${s.eta ? ` 약 ${esc(s.eta.split(/[–-]/)[0])}분` : ''}</span></div><div class="kv"><span>최소주문</span><b>${s.minOrder ? esc(money(p, s.minOrder)) : '없음'}</b><span>배달시간</span><b>${esc((s.eta || '').replace('–', '~'))}분</b><span>배달팁</span><b>${esc(money(p, s.fee))}</b></div></div>
        <div class="dv_mh">대표 메뉴</div>${s.menu.map(dish).join('')}<i class="lf_pad"></i></div>${cta}</div>`;
    return `<div class="dv ue">${head}<div class="ax_scroll dv_sc top">
        <div class="dv_shead ue"><h2>${esc(s.name)}</h2>${kk(s)}<div class="r">${s.rating ? `${I.starK}<b>${comma(rate(s.rating))}</b>` : ''}${s.reviews ? `<span>(${n0(s.reviews)})</span>` : ''}${s.cuisine ? `<span>· ${esc(s.cuisine)}</span>` : ''}</div></div>
        <div class="dv_uebox"><span><b>${esc(money(p, s.fee))}</b><small>Liefergebühr</small></span><span><b>${esc(s.eta || '—')}</b><small>Min.</small></span></div>
        <div class="dv_mtabs"><span class="on">Beliebt</span><span>Speisekarte</span><span>Info</span></div>${s.menu.map(dish).join('')}<i class="lf_pad"></i></div>${cta}</div>`;
}
// one dish, big: its picture, words, the size choice and the add button (nothing is ordered from here)
export function itemScreen(p, now, ref) {
    const d = D(p), [sid, k] = String(ref || '').split('~'), s = d?.shops.find(x => x.id === sid), x = s?.menu[Number(k)];
    if (!x) return s ? shopScreen2(p, now, sid) : dlvScreen(p, now);
    const bm = d.look === 'baemin', pc = picFor(d, s.name, x), large = pc.size === 'large';
    const up = v => (v >= 100 ? Math.round(v / 500) * 500 : Math.round(v * 2) / 2), sizes = bm ? (large ? [['보통', up(x.price / 1.3)], ['특대', x.price]] : [['보통', x.price], ['특대', up(x.price * 1.3)]]) : [['Normal', null], ['Groß', null]];
    return `<div class="dv ${bm ? 'bm white' : 'ue'}"><div class="dv_hero item">${pic(pc, 'hero', 'item')}${axBar(p, now)}<div class="dv_herobar">${round(`dshop`, bm ? I.back : I.x, s.id)}${bm ? `<span>${round('', I.share)}${round('', I.search)}${round(d.cart ? 'dcart' : '', I.cart)}</span>` : ''}</div></div>
      <div class="ax_scroll dv_sc top"><div class="dv_item">${bm && x.top ? '<div class="tg"><em>인기 1위</em><em>사장님 추천</em></div>' : ''}<h2>${esc(x.name)}</h2>${kk(x)}${bm ? '' : `<div class="pr">${esc(money(p, x.price))}</div>`}${x.desc ? `<p>${esc(x.desc)}</p>` : ''}
        ${bm ? `<div class="rv">메뉴 리뷰 ${I.chev}</div><div class="row"><b>수량</b><span class="stp"><i>−</i>1<i>+</i></span></div>` : ''}
        <div class="row h"><span><b>${bm ? '가격' : 'Größe'}</b>${bm ? '' : '<small>1 auswählen</small>'}</span><em>${bm ? '필수' : 'Erforderlich'}</em></div>
        ${sizes.map(([t, v], j) => `<div class="opt"><i class="${(j === 1) === large ? 'on' : ''}"></i><span>${t}</span>${v !== null ? `<b>${esc(money(p, v))}</b>` : j ? '<small>+</small>' : ''}</div>`).join('')}</div><i class="lf_pad"></i></div>
      <div class="dv_bot">${bm ? `<span class="sum"><small>배달 최소주문금액</small><b>${s.minOrder ? esc(money(p, s.minOrder)) : '없음'}</b></span><span class="dv_btn">${esc(money(p, x.price))} 담기</span>` : `<span class="stp ue"><i>−</i>1<i>+</i></span><span class="dv_btn">1 hinzufügen · ${esc(money(p, x.price))}</span>`}</div></div>`;
}
export function cartScreen(p, now) {
    const d = D(p); if (!d) return dlvScreen(p, now);
    const c = d.cart, bm = d.look === 'baemin', s = c && shopOf(d, c.shop), sum = cartSum(d), fee = s?.fee || 0;
    const top = `${axBar(p, now)}<div class="dv_bar">${axCb('dlv')}<b>${bm ? '장바구니' : 'Warenkorb'}</b><span></span></div>`;
    if (!c) return `<div class="dv ${bm ? 'bm' : 'ue'}">${top}<div class="ax_scroll dv_sc"><div class="lf_none">${bm ? '장바구니가 비어 있어요' : 'Dein Warenkorb ist leer'}</div></div></div>`;
    const more = (s?.menu || []).filter(m => !c.items.some(x => x.name === m.name)).slice(0, 2);
    const note = (t, v, k) => (v ? `<div class="nt"><small>${t}</small>${esc(v)}${k && koOn() ? `<span class="lf_k">${esc(k)}</span>` : ''}</div>` : '');
    if (bm) return `<div class="dv bm">${top}<div class="ax_scroll dv_sc">
        <button type="button" class="dv_cshop" ${s ? `data-go="dshop" data-i="${s.id}"` : ''}>${s ? pic(shopPic(s)) : ''}${esc(c.shop)} ${I.chev}</button>
        <div class="dv_card list">${c.items.map(x => `<div class="dv_ci"><span class="t"><b>${esc(x.name)}</b>${kk(x)}${x.option ? `<small>${esc(x.option)}</small>` : ''}<strong>${esc(money(p, x.qty * x.price))}</strong></span>${pic(picFor(d, c.shop, x))}<span class="ctl"><span class="ob">옵션 변경</span><span class="stp"><i>−</i>${x.qty}<i>+</i></span></span></div>`).join('')}<div class="dv_add">+ 메뉴 추가</div></div>
        ${note('가게 요청사항', c.noteShop, c.noteShopKo) || note('배달 요청사항', c.noteRider, c.noteRiderKo) ? `<div class="dv_card">${note('가게 요청사항', c.noteShop, c.noteShopKo)}${note('라이더 요청사항', c.noteRider, c.noteRiderKo)}</div>` : ''}
        ${more.length ? `<div class="dv_ct">함께 먹으면 좋아요</div><div class="dv_card list">${more.map((m, k) => `<button type="button" class="dv_more" data-go="ditem" data-i="${s.id}~${s.menu.indexOf(m)}">${pic(picFor(d, s.name, m))}<span><em>주문수 ${k + 2}위</em><b>${esc(m.name)}</b><small>${esc(money(p, m.price))}~</small></span><i>+</i></button>`).join('')}</div>` : ''}
        ${(() => { const [e1, e2] = String(s?.eta || '25–35').split(/[–~-]/).map(Number), half = Math.round(fee / 2 / 100) * 100 || fee / 2; return `<div class="dv_card dv_how"><div class="rd"><i class="on"></i><b>배달</b></div>
          <div class="op"><span class="on"><b>한집배달</b><small>${e1 || 25}~${e2 || 35}분</small><strong>${esc(money(p, fee))}</strong></span><span><b>알뜰배달</b><small>${(e1 || 25) + 5}~${(e2 || 35) + 10}분</small><strong>${esc(money(p, half))}</strong></span></div>
          <div class="rd"><i></i><b>픽업</b><small>${Math.max(5, (e1 || 25) - 10)}~${(e2 || 35) - 5}분 후 픽업</small></div></div>
        <div class="dv_ct">결제금액을 확인해주세요</div><div class="dv_card"><div class="dv_kv in"><div><span>메뉴 금액</span><span>${esc(money(p, sum))}</span></div><div><span>배달팁</span><span>${esc(money(p, fee))}</span></div><div class="t"><span>결제예정금액</span><span>${esc(money(p, sum + fee))}</span></div></div></div>`; })()}
        <i class="lf_pad"></i></div><div class="dv_bot"><span class="sum"><b>${esc(money(p, sum + fee))}</b><small>${s?.minOrder && sum < s.minOrder ? `${esc(money(p, s.minOrder - sum))} 더 담으면 주문 가능` : '주문 가능'}</small></span><button type="button" class="dv_btn" data-go="dpay">배달 주문하기</button></div></div>`;
    return `<div class="dv ue">${top}<div class="ax_scroll dv_sc">
        <div class="dv_ueh">Bestellübersicht</div><button type="button" class="dv_cshop ue" ${s ? `data-go="dshop" data-i="${s.id}"` : ''}>${s ? pic(shopPic(s)) : ''}<span><b>${esc(c.shop)}</b><small>${cartCount(d)} Artikel</small></span>${I.chev}</button>
        ${c.items.map(x => `<div class="dv_uei"><span class="q">${x.qty}</span><span class="t"><b>${esc(x.name)}</b>${kk(x)}${x.option ? `<small>${esc(x.option)}</small>` : ''}</span><span class="pr">${esc(money(p, x.qty * x.price))}</span>${pic(picFor(d, c.shop, x))}</div>`).join('')}
        ${c.noteShop || c.noteRider ? `<div class="dv_ueh">Hinweise</div><div class="dv_uenotes">${note('Für das Restaurant', c.noteShop, c.noteShopKo)}${note('Für den Kurier', c.noteRider, c.noteRiderKo)}</div>` : ''}
        <div class="dv_kv"><div><span>Zwischensumme</span><span>${esc(money(p, sum))}</span></div><div><span>Liefergebühr</span><span>${esc(money(p, fee))}</span></div><div class="t"><span>Gesamt</span><span>${esc(money(p, sum + fee))}</span></div></div>
        <i class="lf_pad"></i></div><div class="dv_bot"><button type="button" class="dv_btn" data-go="dpay">Zur Kasse · ${esc(money(p, sum + fee))}</button></div></div>`;
}
export function ordersScreen(p, now) {
    const d = D(p); if (!d) return dlvScreen(p, now);
    const bm = d.look === 'baemin', os = [...d.orders].reverse();
    const what = o => `${o.items[0].name}${o.items.length > 1 ? (bm ? ` 외 ${o.items.length - 1}개` : ` +${o.items.length - 1}`) : bm ? ` ${o.items[0].qty}개` : ''}`;
    const sp = o => { const s = shopOf(d, o.shop); return s ? shopPic(s) : picFor(d, o.shop, o.items[0]); };
    if (bm) return `<div class="dv bm">${axBar(p, now)}<div class="dv_bar l"><b>주문내역</b><span>${I.cart}</span></div>
      <div class="dv_chips bm"><span>${I.search.replace('width="22" height="22"', 'width="15" height="15"')}검색</span><span>주소 ${I.down}</span><span>조회 기간 ${I.down}</span><span>주문 상태</span></div>
      <div class="ax_scroll dv_sc">${os.map(o => `<div class="dv_card ord"><button type="button" class="hd" data-go="dorder" data-i="${o.id}">${pic(sp(o))}<span><b>${esc(o.shop)}</b><small>${esc(fmtDate(p, o.time, true))}${o.status === 'delivered' ? (o.reviewed ? ` · ${I.star.replace('#ffc531', '#b0b4ba')} 내 리뷰 5점` : ' · <strong>리뷰 쓰기</strong>') : ` · <strong class="${o.status === 'on the way' ? 'go' : 'no'}">${ST_KO[o.status]}</strong>`}${o.gift ? ' · 선물' : ''}</small></span><em>주문상세</em></button>
          <div class="it">${esc(what(o))}</div><div class="pay"><b>결제금액</b><b>${esc(money(p, orderSum(o)))}</b></div><div class="bt"><span class="l">같은 메뉴 담기</span><span class="m">바로 주문</span></div></div>`).join('') || '<div class="lf_none">주문 내역이 없어요</div>'}
        <i class="lf_pad"></i></div>${bmTab('dorders')}</div>`;
    return `<div class="dv ue">${axBar(p, now)}<div class="dv_bar l"><b>Bestellungen</b><span></span></div><div class="dv_mtabs ot"><span class="on">Vergangene</span><span>Laufende</span></div>
      <div class="ax_scroll dv_sc">${os.map(o => `<button type="button" class="dv_uo" data-go="dorder" data-i="${o.id}">${pic(sp(o))}<span class="t"><b>${esc(o.shop)}</b><small class="k">${o.items.reduce((n, x) => n + x.qty, 0)} Artikel · ${esc(money(p, orderSum(o)))}</small><small>${esc(fmtDate(p, o.time, true))} · ${o.status === 'cancelled' || o.status === 'refunded' ? `<i class="no">${ST_DE[o.status]}</i>` : ST_DE[o.status]}${o.gift ? ` · an ${esc(o.gift)}` : ''}</small><u>Beleg ansehen</u></span><em>Erneut</em></button>`).join('') || '<div class="lf_none">Noch keine Bestellungen</div>'}
        <i class="lf_pad"></i></div>${ueTab('dorders')}</div>`;
}
// a flat city map: blocks with buildings, parks, a river, the main roads; the route is one turn from shop to door,
// and the rider sits partway along it while the order is on its way. Seeded by the order, so it stays put.
function cityMap(o, accent, bike) {
    let sd = [...o.id].reduce((n, ch) => (n * 31 + ch.charCodeAt(0)) % 233280, 7);
    const r = () => { sd = (sd * 9301 + 49297) % 233280; return sd / 233280; };
    const xs = [-20, 52, 128, 206, 284, 360, 430], ys = [-20, 70, 150, 226, 300, 384, 470, 580], parks = new Set(['1,1', '4,4', '0,5']), out = [];
    for (let i = 0; i < xs.length - 1; i++) for (let j = 0; j < ys.length - 1; j++) {
        const x0 = xs[i] + 7, x1 = xs[i + 1] - 7, y0 = ys[j] + 7, y1 = ys[j + 1] - 7, pk = parks.has(`${i},${j}`);
        out.push(`<rect x="${x0}" y="${y0}" width="${x1 - x0}" height="${y1 - y0}" rx="6" fill="${pk ? '#d7ebcf' : '#ebe8e2'}"/>`);
        if (pk) for (let k = 0; k < 6; k++) out.push(`<circle cx="${Math.round(x0 + 8 + r() * (x1 - x0 - 16))}" cy="${Math.round(y0 + 8 + r() * (y1 - y0 - 16))}" r="${(4 + r() * 3).toFixed(1)}" fill="#bfdcb3"/>`);
        else { const n = 1 + Math.floor(r() * 3), bw = (x1 - x0 - 6) / n; for (let k = 0; k < n; k++) out.push(`<rect x="${Math.round(x0 + 3 + k * bw)}" y="${y0 + 3}" width="${Math.round(bw - 3)}" height="${Math.round((y1 - y0) * (0.35 + r() * 0.15))}" rx="2" fill="#e4e0d8"/><rect x="${Math.round(x0 + 3 + k * bw)}" y="${Math.round(y1 - 3 - (y1 - y0) * (0.25 + r() * 0.15))}" width="${Math.round(bw - 3)}" height="${Math.round((y1 - y0) * 0.25)}" rx="2" fill="#e4e0d8"/>`); }
    }
    out.push('<path d="M-10 528 C80 500 170 548 260 520 S380 500 400 510 V580 H-10Z" fill="#c6dcf0"/>');
    out.push(`<g fill="none" stroke-linecap="round">${[[`M-20 ${ys[3]} H410`, 12], [`M${xs[3]} -20 V600`, 12], ['M-20 40 L410 -10', 9]].map(([dd, w]) => `<path d="${dd}" stroke="#dcd8cf" stroke-width="${w + 3}"/><path d="${dd}" stroke="#fff" stroke-width="${w}"/>`).join('')}</g><path d="M-20 40 L410 -10" stroke="#f6d78a" stroke-width="3" fill="none"/>`);
    const [sx, sy] = [128, 420], [hx, hy] = [300, 226], path = `M${sx} ${sy} V${hy} H${hx}`, going = o.status === 'on the way';
    out.push(`<path d="${path}" stroke="#fff" stroke-width="9" fill="none" stroke-linejoin="round"/><path d="${path}" stroke="${accent}" stroke-width="5" fill="none" stroke-linejoin="round" stroke-linecap="round"/>`);
    out.push(`<g transform="translate(${sx} ${sy})"><circle r="16" fill="#16181c" stroke="#fff" stroke-width="3"/><path d="M-5 -7 v7 a3 3 0 0 0 6 0 v-7 M-2 -7 v14 M5 -7 c-3 4 -2 8 0 9 v5" stroke="#fff" stroke-width="2" fill="none" stroke-linecap="round"/></g><g transform="translate(${hx} ${hy})"><circle r="16" fill="#16181c" stroke="#fff" stroke-width="3"/><path d="M-7 1 l7 -7 7 7 v7 h-14z" fill="#fff"/></g>`);
    if (going) out.push(`<g transform="translate(${sx} 300)"><circle r="22" fill="${accent}" opacity=".18"/><circle r="15" fill="#fff" stroke="${accent}" stroke-width="2.5"/>${bike}</g>`);
    return `<svg class="dv_map" viewBox="0 0 390 560" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><rect width="390" height="560" fill="#f0eee9"/>${out.join('')}</svg>`;
}
const SCOOT = '<g transform="translate(-11 -9) scale(.55)"><rect x="2" y="6" width="12" height="11" rx="2" fill="#3fd4c1"/><circle cx="9" cy="27" r="5" fill="#2b2b2b"/><circle cx="31" cy="27" r="5" fill="#2b2b2b"/><path d="M6 22 h22 l4 -8 h3 v4 l-4 4 v4 h-25z" fill="#3fd4c1"/><circle cx="22" cy="5" r="4.4" fill="#3fd4c1"/><path d="M18 9 h7 l2 9 h-9z" fill="#3a3a3a"/></g>';
const BIKE = '<g transform="translate(-10 -7)" fill="none" stroke="#16181c" stroke-width="2"><circle cx="4" cy="11" r="3.6"/><circle cx="16" cy="11" r="3.6"/><path d="M4 11 L8 4 h5 L16 11 M8 4 L11 11 L13 4" stroke-linejoin="round"/></g>';
const minsLeft = (p, o) => { const n = String(storyNow(p) || p.now || ''), a = o.time.slice(6), b = n.slice(6); if (!/^\d\d:\d\d/.test(a) || !/^\d\d:\d\d/.test(b) || n.slice(0, 5) !== o.time.slice(0, 5)) return 20; const m = (s => Number(s.slice(0, 2)) * 60 + Number(s.slice(3, 5))); return Math.max(3, m(a) + 35 - m(b)); };
export function orderScreen(p, now, id) {
    const d = D(p), o = d?.orders.find(x => x.id === id);
    if (!o) return ordersScreen(p, now);
    const bm = d.look === 'baemin', tx = (p.money?.tx || []).find(t => t.delivery === o.id && !String(t.id).endsWith('-r')), acct = tx && p.money.bank.accounts.find(a => a.last4 === tx.account);
    const sub = o.items.reduce((n, x) => n + x.qty * x.price, 0), total = orderSum(o), s = shopOf(d, o.shop);
    const payBy = acct ? `${esc(acct.name || '')} •••• ${esc(acct.last4)}` : o.account === 'cash' ? (bm ? '만나서 현금결제' : 'Bar bei Lieferung') : (bm ? '카드' : 'Karte');
    const bank = tx ? `<button type="button" class="dv_bank" data-go="tx" data-i="${esc(tx.id)}">${bm ? '은행 앱에서 보기' : 'In der Bank-App'} ${I.chev}</button>` : '';
    const note = (t, v, k) => (v ? `<div class="nt"><small>${t}</small>${esc(v)}${k && koOn() ? `<span class="lf_k">${esc(k)}</span>` : ''}</div>` : '');
    if (o.status === 'on the way' && o.mode === 'delivery') {
        const left = minsLeft(p, o);
        return `<div class="dv ${bm ? 'bm' : 'ue'} map">${cityMap(o, bm ? '#3fd4c1' : '#16181c', bm ? SCOOT : BIKE)}${axBar(p, now)}<div class="dv_herobar">${round('dorders', bm ? I.back : I.x)}${bm ? '' : '<span class="dv_help">Hilfe</span>'}</div>
          <div class="dv_track"><i class="grab"></i>${bm ? `<div class="hd"><span><small>${esc(o.shop)}</small><b>${left}분 남음</b><span>주문하신 주소로 가고 있어요.</span></span>${SCOOT.replace('<g transform="translate(-11 -9) scale(.55)">', '<svg width="46" height="39" viewBox="0 0 40 34"><g>').replace(/<\/g>$/, '</g></svg>')}</div>
            <div class="steps">${['주문확인', '조리완료', '배달중', '배달완료'].map((t, k) => `<span class="${k < 3 ? 'on' : ''} ${k === 2 ? 'now' : ''}"><i></i>${t}</span>`).join('')}</div>`
            : `<div class="hd c"><b>Dein Kurier ist unterwegs</b><span>Noch etwa ${left} Min.</span></div><div class="bars">${[1, 1, 1, 0.5, 0].map(v => `<i class="${v === 1 ? 'on' : v ? 'half' : ''}"></i>`).join('')}</div><p>Deine Bestellung von ${esc(o.shop)} ist auf dem Weg.</p>`}
            <div class="ad">${I.home}<span><b>${esc(toLine(o, bm))}</b>${o.address ? `<small>${esc(o.address)}</small>` : ''}</span></div>${note(bm ? '라이더 요청사항' : 'Hinweis für den Kurier', o.noteRider, o.noteRiderKo)}${bank}</div></div>`;
    }
    const lines = o.items.map(x => `<div class="dv_li">${bm ? '' : `<span class="q">${x.qty}</span>`}<span class="t"><b>${esc(x.name)}</b>${kk(x)}${x.option ? `<small>${bm ? '• ' : ''}${esc(x.option)}</small>` : ''}</span><span class="pr">${esc(money(p, x.qty * x.price))}${bm && x.qty > 1 ? `<small>${x.qty}개</small>` : ''}</span>${bm ? pic(picFor(d, o.shop, x)) : ''}</div>`).join('');
    const kv = `<div class="dv_kv">${bm ? '' : `<div class="b"><span>Zwischensumme</span><span>${esc(money(p, sub))}</span></div>`}${bm ? `<div><span>메뉴금액</span><span>${esc(money(p, sub))}</span></div>` : ''}<div><span>${bm ? '배달팁' : 'Liefergebühr'}</span><span>${esc(money(p, o.fee))}</span></div>${o.tip ? `<div><span>${bm ? '팁' : 'Trinkgeld'}</span><span>${esc(money(p, o.tip))}</span></div>` : ''}${o.discount ? `<div><span>${bm ? '할인' : 'Rabatt'}</span><span class="dc">−${esc(money(p, o.discount))}</span></div>` : ''}${bm ? `<div class="t"><span>결제금액</span><span>${esc(money(p, total))}</span></div>` : ''}<div class="py"><span>${bm ? '결제방법' : 'Zahlung'}</span><span>${payBy}</span></div></div>`;
    const meta = [toLine(o, bm), o.address, o.left, o.for > 1 ? (bm ? `${o.for}인분` : `Für ${o.for}`) : '', o.noCutlery ? (bm ? '수저·포크 안 받음' : 'Ohne Besteck') : ''].filter(Boolean).map(esc).join(' · ');
    const stLine = o.status === 'cancelled' || o.status === 'refunded';
    if (bm) return `<div class="dv bm white">${axBar(p, now)}<div class="dv_bar">${axCb('dorders')}<b>주문상세</b><span>${I.cart}</span></div><div class="ax_scroll dv_sc">
        <div class="dv_box"><div class="st"><b class="${stLine ? 'no' : ''}">${o.status === 'delivered' ? '배달이 완료됐어요' : ST_KO[o.status]}</b><small>주문일시 ${esc(fmtDate(p, o.time, true))} ${esc(clockOf(p, o.time.slice(6)))}${o.arrived ? `<br>도착 ${esc(clockOf(p, arrHm(o)))}` : ''}</small></div>
          <button type="button" class="sh" ${s ? `data-go="dshop" data-i="${s.id}"` : ''}>${s ? pic(shopPic(s)) : ''}<b>${esc(o.shop)}</b>${I.chev}<i>${s?.fav ? I.heartF : I.heart}</i></button></div>
        <div class="dv_mh">주문 메뉴</div><div class="dv_box p">${lines}<div class="bt"><span class="l">같은 메뉴 담기</span><span class="m">바로 주문</span></div></div>
        <div class="dv_mh">결제 정보</div><div class="dv_box p">${kv}${bank}</div>
        <div class="dv_mh">배달 정보</div><div class="dv_box p"><div class="dv_meta">${meta}</div>${note('가게 요청사항', o.noteShop, o.noteShopKo)}${note('라이더 요청사항', o.noteRider, o.noteRiderKo)}</div>
        <i class="lf_pad"></i></div></div>`;
    return `<div class="dv ue">${axBar(p, now)}<div class="dv_bar">${axCb('dorders')}<b>Beleg</b><span></span></div><div class="ax_scroll dv_sc">
        <div class="dv_rcpt"><div class="a"><b>Uber Eats</b><small><strong>Gesamt ${esc(money(p, total))}</strong><br>${esc(fmtDate(p, o.time, true))}</small></div><h2>${stLine ? `${ST_DE[o.status]}` : `Danke für deine Bestellung, ${esc(String(p.owner || '').split(/\s/)[0])}`}</h2><p>${stLine ? `Bestellung bei ${esc(o.shop)}` : `Hier ist dein Beleg von ${esc(o.shop)}.`}</p>
          ${stLine ? '' : `<svg class="bill" viewBox="0 0 120 80" aria-hidden="true"><rect x="10" y="26" width="90" height="46" rx="4" fill="#1fa463"/><rect x="18" y="34" width="74" height="30" rx="3" fill="#2fbf74"/><circle cx="76" cy="50" r="20" fill="#0b7a45"/><path d="M66 50 l7 7 13 -14" stroke="#fff" stroke-width="5" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>`}</div>
        <div class="dv_rb2"><div class="tt"><span>Gesamt</span><span>${esc(money(p, total))}</span></div>${lines}${kv}${bank}<div class="dv_meta">${meta}</div>${note('Hinweis für das Restaurant', o.noteShop, o.noteShopKo)}${note('Hinweis für den Kurier', o.noteRider, o.noteRiderKo)}${o.status === 'delivered' ? `<button type="button" class="dv_bank" data-go="drate" data-i="${o.id}">${o.reviewed ? 'Deine Bewertung' : 'Bestellung bewerten'} ${I.chev}</button>` : ''}</div>
        <i class="lf_pad"></i></div></div>`;
}

// the account the owner orders with most: the checkout shows it chosen
function usualPay(p, d) {
    const n = {}; for (const o of d.orders) if (o.account) n[o.account] = (n[o.account] || 0) + 1;
    const top = Object.entries(n).sort((a, b) => b[1] - a[1])[0]?.[0];
    const a = top && top !== 'cash' && top !== 'card' ? p.money?.bank?.accounts.find(x => x.last4 === top) : null;
    return a ? `${a.name || ''} •••• ${a.last4}` : top === 'cash' ? null : '';
}
// checkout: where the basket goes, the notes, how it's paid (nothing is sent from here)
export function payScreen(p, now) {
    const d = D(p), c = d?.cart; if (!c) return cartScreen(p, now);
    const bm = d.look === 'baemin', s = shopOf(d, c.shop), sum = cartSum(d), fee = s?.fee || 0, last = [...d.orders].reverse()[0], pay = usualPay(p, d);
    const first = c.items[0], more = c.items.length - 1;
    const note = (t, v, k, ph) => `<div class="nt"><small>${t}</small>${v ? esc(v) : `<span class="ph">${ph}</span>`}${v && k && koOn() ? `<span class="lf_k">${esc(k)}</span>` : ''}</div>`;
    if (bm) return `<div class="dv bm">${axBar(p, now)}<div class="dv_bar">${axCb('dcart')}<b>주문하기</b><span></span></div><div class="ax_scroll dv_sc">
        <div class="dv_pt"><b>배달로 받을게요</b><span>${I.clock}${esc((s?.eta || '30~40').replace('–', '~'))}분 후 도착</span></div>
        <div class="dv_card"><div class="dv_cth">담은 메뉴</div><div class="dv_pm">${pic(picFor(d, c.shop, first))}<span><b>${esc(first.name)}${more > 0 ? ` 외 ${more}개` : ''}</b><small>${esc(money(p, sum))}</small></span></div></div>
        <div class="dv_card"><div class="dv_cth">배달주소</div><div class="dv_ad">${I.pin}<b>${esc(last ? toLine(last, true) : '우리집')}</b></div>${last?.address ? `<div class="dv_ads">${esc(last.address)}</div>` : ''}<div class="dv_hr"></div>${note('라이더 요청사항', c.noteRider, c.noteRiderKo, '문 앞에 두고 벨 눌러주세요')}</div>
        <div class="dv_card">${note('가게 요청사항', c.noteShop, c.noteShopKo, '요청사항 없음')}<div class="dv_chk">${last?.noCutlery ? '<i class="on">✓</i>' : '<i></i>'}수저·포크 안 받기</div></div>
        <div class="dv_card"><div class="dv_cth">결제수단</div><div class="dv_rad"><i class="on"></i>${pay === null ? '만나서 현금결제' : '신용·체크카드'}</div>${pay ? `<div class="dv_cardsel">${esc(pay)}<span>✓</span></div>` : ''}</div>
        <div class="dv_card"><div class="dv_kv"><div><span>메뉴금액</span><span>${esc(money(p, sum))}</span></div><div><span>배달팁</span><span>${esc(money(p, fee))}</span></div><div class="t"><span>결제금액</span><span>${esc(money(p, sum + fee))}</span></div></div></div>
        <i class="lf_pad"></i></div><div class="dv_bot"><span class="dv_btn">${esc(money(p, sum + fee))} 결제하기</span></div></div>`;
    const eta = s?.eta || '25–35';
    return `<div class="dv ue">${axBar(p, now)}<div class="dv_bar">${axCb('dcart')}<b>Kasse</b><span></span></div><div class="ax_scroll dv_sc">
        <div class="dv_pt ue"><span>${I.clock}Voraussichtliche Lieferung</span><b>${esc(eta)} Min.</b></div>
        <div class="dv_opts">${[['Standard', `${eta} Min.`, ''], ['Priorität ⚡', 'schneller', '+1,49 €'], ['Planen', 'Zeit wählen', '']].map(([a, b2, x], k) => `<span class="${k ? '' : 'on'}"><b>${a}</b><small>${b2}</small>${x ? `<em>${x}</em>` : ''}</span>`).join('')}</div>
        <div class="dv_gap"></div><div class="dv_ueh">Lieferadresse</div><div class="dv_ln">${I.pin}<span><b>${esc(last?.address || 'Zuhause')}</b>${c.noteRider ? `<small>${esc(c.noteRider)}</small>` : ''}</span>${I.chev}</div>
        <div class="dv_ln"><span class="dv_chk ue">${last?.noCutlery ? '<i class="on">✓</i>' : '<i></i>'}Kein Besteck</span></div>
        <div class="dv_ueh">Bestellübersicht</div><div class="dv_ln">${s ? pic(shopPic(s), 'rnd') : ''}<span><b>${esc(c.shop)}</b><small>${cartCount(d)} Artikel</small></span>${I.down}</div>
        <div class="dv_ueh">Zahlung</div><div class="dv_ln"><span class="visa">${pay === null ? '€' : 'VISA'}</span><span><b>${pay === null ? 'Bar bei Lieferung' : esc(pay || 'Karte')}</b></span>${I.chev}</div>
        <div class="dv_kv"><div><span>Zwischensumme</span><span>${esc(money(p, sum))}</span></div><div><span>Liefergebühr</span><span>${esc(money(p, fee))}</span></div><div class="t"><span>Gesamt</span><span>${esc(money(p, sum + fee))}</span></div></div>
        <i class="lf_pad"></i></div><div class="dv_bot"><span class="dv_btn">Bestellen</span></div></div>`;
}
// Uber Eats: a delivered order's courier rating and tip, filled in when the owner reviewed it (nothing is posted from here)
export function rateScreen(p, now, id) {
    const d = D(p), o = d?.orders.find(x => x.id === id); if (!o || d.look === 'baemin') return o ? orderScreen(p, now, id) : ordersScreen(p, now);
    const done = o.reviewed;
    const tip = o.tip, total = orderSum(o) - tip, pct = [5, 10, 15, 20].map(k => [k, Math.round(total * k) / 100]);
    const hit = tip ? pct.reduce((b, x) => (Math.abs(x[1] - tip) < Math.abs(b[1] - tip) ? x : b))[0] : 0;
    const up = c => `<svg width="22" height="22" viewBox="0 0 24 24"><path d="M7 10v10H4V10zM9 20h8.5a2 2 0 0 0 2-1.6l1.3-6A2 2 0 0 0 18.8 10H14l1-4.5A1.8 1.8 0 0 0 11.8 4L9 10z" fill="${c}"/></svg>`;
    return `<div class="dv ue">${axBar(p, now)}<div class="dv_bar">${axCb('dorders', 'x')}<span></span><span class="dv_help">Hilfe</span></div><div class="ax_scroll dv_sc">
        <div class="dv_ur"><div class="hd"><span><h2>Bestellung bewerten</h2><small>${esc(o.shop)} · ${esc(fmtDate(p, o.time, true))} ${esc(clockOf(p, o.arrived ? arrHm(o) : String(o.time).slice(6)))}</small></span><i>${I.my}</i></div>
          <b class="t">Kurier bewerten</b><small>Wie war deine Lieferung?</small>
          <div class="th"><span class="dn">${up('#16181c')}</span><span class="${done ? 'on' : ''}">${up(done ? '#fff' : '#16181c')}</span></div>
          <div class="chips">${['Freundlich', 'Gute Kommunikation', 'Pünktlich', 'Sorgfältig'].map((t, k) => `<span class="${done && k < 2 ? 'on' : ''}">${t}</span>`).join('')}</div>
          <b class="t">Trinkgeld für den Kurier</b><small>Bestellsumme: ${esc(money(p, total))}</small>
          <div class="tips">${pct.map(([k, v]) => `<span class="${k === hit ? 'on' : ''}"><b>${k}%</b>${esc(money(p, v))}</span>`).join('')}</div></div>
        <i class="lf_pad"></i></div><div class="dv_bot"><span class="dv_btn${done ? ' off' : ''}">${done ? 'Bewertet' : 'Absenden'}</span></div></div>`;
}
