// 스크린타임 (설정 › 스크린타임): the approved board A — daily average and the change, seven days of stacked bars (a colour
// per kind, the average dashed), the three biggest kinds, the late night, how often they picked the phone up, and the
// apps they used most. A bar (or its date) picks that day in place; picking it again goes back to the week.
// Reads screenView() only (phonescreen.js); the data side is the reflection session's.
import { AX, ax, axBar, axCb, axH1, axInd, axTop, busyHtml } from './phoneapps.js';
import { filling } from './phoneai.js';
import { clockNum, clockOf, fmtDate } from './phonedata.js';
import { appIcon } from './phoneicons.js';
import { nameKey } from './people.js';
import { KIND_KO, appOf, screenView } from './phonescreen.js';
import { esc } from './util.js';

Object.assign(AX, {
    sandglass: 'M6 3h12M6 21h12M7.5 3v2.5a4.5 4.5 0 0 0 9 0V3M7.5 21v-2.5a4.5 4.5 0 0 1 9 0V21M12 10v4',   // rounded glass, a thread of sand (picked over the twisted one)
    scphone: 'M8 2.5h8a1.5 1.5 0 0 1 1.5 1.5v16a1.5 1.5 0 0 1-1.5 1.5H8A1.5 1.5 0 0 1 6.5 20V4A1.5 1.5 0 0 1 8 2.5zM11 18.5h2',
    scmoon: 'M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z',
});

// the week's three biggest kinds, first to third: sky · pink · tangerine, everything else one grey. Every bar wears
// them pale; the picked day wears them full. Text a shade darker for white cards; the average is a sky dashed line.
const ORDER = ['chat', 'social', 'video', 'game', 'music', 'work', 'reading', 'shopping', 'other'];
const RANK = ['#6cb4f5', '#f4a3bd', '#ffad5c'], RANK_PALE = ['#d3e8fc', '#fcdce7', '#ffe5c6'], RANK_T = ['#3f8fd8', '#d9708f', '#e08a2a'];
const REST = '#e6e8ec', REST_PALE = '#eef0f3', ACC = '#3f8fd8', AVG = '#3f8fd8';

export const durKo = n => { n = Math.max(0, Math.round(n || 0)); const h = Math.floor(n / 60); return h && !(n % 60) ? `${h}시간` : `${h ? `${h}시간 ` : ''}${n % 60}분`; };
const durBig = n => { n = Math.max(0, Math.round(n || 0)); const h = Math.floor(n / 60); return `${h ? `<span class="cg_num">${h}</span><u>시간</u>` : ''}${h && !(n % 60) ? '' : `<span class="cg_num">${n % 60}</span><u>분</u>`}`; };
// 하루 몇 번: the sentence the code picks for it
const feel = n => (n >= 100 ? '거의 손에서 안 놔요' : n >= 70 ? '자주 손이 가요' : n >= 40 ? '틈틈이 꺼내 봐요' : '가끔 꺼내 봐요');
const level = n => (n >= 100 ? 4 : n >= 70 ? 3 : n >= 40 ? 2 : 1);
const lateMin = t => { const mt = /(\d{1,2}):(\d{2})/.exec(t || ''); return mt ? Number(mt[1]) * 60 + Number(mt[2]) : null; };
const iconOf = (name, kind) => appIcon(appOf(name)?.id || '', name, kind);

// seven columns, a stacked bar each: a clipped stack so only the top corners round
function chart(days, avg, sel, top3) {
    const W = 326, H = 150, AXW = 30, gap = 20, n = days.length, bw = (W - AXW - gap * 6) / 7;
    const max = Math.max(60, ...days.map(d => d.total), avg || 0), top = Math.ceil(max / 120) * 120, sc = H / top;
    let s = '';
    // an hour mark too close to the average's label gives way to it
    const ay = avg ? H - avg * sc : null;
    for (let t = 0; t <= top; t += 120) { const y = H - t * sc; s += `<line x1="0" x2="${W - AXW + 4}" y1="${y}" y2="${y}" stroke="${t ? '#eef0f3' : '#e3e6ea'}"/>${ay !== null && Math.abs(y - ay) < 11 ? '' : `<text x="${W - AXW + 10}" y="${y + 3.5}" class="sc_axl">${t / 60}h</text>`}`; }
    days.forEach((d, i) => {
        const x = i * (bw + gap), th = d.total * sc, r = Math.min(5, th, bw / 2), full = sel === i;
        let y = H, segs = '';
        // first to third from the bottom, then the rest as one grey block
        const rest = ORDER.filter(k => !top3.includes(k)).reduce((n, k) => n + (d.byKind[k] || 0), 0);
        for (const [v, c] of [...top3.map((k, j) => [d.byKind[k] || 0, (full ? RANK : RANK_PALE)[j]]), [rest, full ? REST : REST_PALE]]) { if (!v) continue; const hh = v * sc; y -= hh; segs += `<rect x="${x}" y="${y}" width="${bw}" height="${hh + 0.5}" fill="${c}"/>`; }
        const clip = `M${x},${H}V${H - th + r}Q${x},${H - th} ${x + r},${H - th}H${x + bw - r}Q${x + bw},${H - th} ${x + bw},${H - th + r}V${H}Z`;
        if (th > 0) s += `<clipPath id="sc_c${i}"><path d="${clip}"/></clipPath><g clip-path="url(#sc_c${i})">${segs}${d.today ? `<rect x="${x}" y="${H - th}" width="${bw}" height="${th}" fill="url(#sc_hatch)"/>` : ''}</g>`;
        const on = sel === i, cx = x + bw / 2;
        if (on) s += `<rect x="${cx - 15}" y="${H + 6}" width="30" height="19" rx="9.5" fill="${ACC}"/><line x1="${cx - 8}" x2="${cx + 8}" y1="${H + 6.6}" y2="${H + 6.6}" stroke="rgba(255,255,255,.3)"/>`;
        s += `<text x="${cx}" y="${H + 19.5}" text-anchor="middle" class="sc_xl${on ? ' on' : d.today ? ' td' : ''}">${d.today ? '오늘' : Number(d.date.slice(3))}</text>`;
    });
    if (avg) { const y = H - avg * sc; s += `<line x1="0" x2="${W - AXW + 4}" y1="${y}" y2="${y}" stroke="${AVG}" stroke-width="1.3" stroke-dasharray="3 3"/><text x="${W - AXW + 10}" y="${y + 3.5}" class="sc_axl sc_avg">평균</text>`; }
    // a tap target over each column (a real button, so the host theme's button rules are kept off by --axbg)
    const hits = days.map((d, i) => `<button type="button" class="sc_hit" style="left: ${(i * (bw + gap) - gap / 2) / W * 100}%; width: ${(bw + gap) / W * 100}%" data-go="stime" data-i="${sel === i ? '' : d.date}" aria-label="${esc(d.today ? '오늘' : d.date)}"></button>`).join('');
    return `<div class="sc_chart"><svg viewBox="0 0 ${W} ${H + 28}" width="100%" aria-hidden="true"><defs><pattern id="sc_hatch" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="2.2" height="5" fill="rgba(255,255,255,.45)"/></pattern></defs>${s}</svg>${hits}</div>`;
}

export function screenTimeScreen(p, now, i = '') {
    const v = screenView(p, now);
    const wrap = body => `${axBar(p, now)}${axTop(axCb('set'))}<div class="ax_scroll">${axH1('스크린타임')}${body}<i class="ax_pad"></i></div>${axInd()}`;
    if (!v || !v.days.length) {
        // a phone filled before the screen time was there: fill just it (the health app's own fill when there's no health yet)
        if (!p.life?.health) return wrap(`<div class="ax_card sc_empty">아직 스크린타임이 없어요. 건강 앱을 채우면 여기 모여요.</div>`);
        const busy = filling.has(`${nameKey(p.owner)}:screen`);
        return wrap(`<div class="ax_card ax_fillc lf_fill"><button type="button" class="ax_fillb na_ph_fill" data-k="screen" ${busy ? 'disabled' : ''}>${busy ? `${busyHtml} 채우는 중` : '채우기'}</button></div>`);
    }
    const days = v.days.slice(-7), d = i ? days.find(x => x.date === i) : null, sel = d ? days.indexOf(d) : -1;
    const total = d ? d.total : v.avg;
    const label = d ? (d.today ? '오늘 사용 시간' : `${fmtDate(p, d.date)} 사용 시간`) : '일평균 · 최근 7일';
    // the week's three biggest kinds keep their colours on every day; the legend gives the week's average or that day's
    const full = days.filter(x => !x.today), wk = ORDER.reduce((o, k) => ({ ...o, [k]: Math.round(full.reduce((n, x) => n + (x.byKind[k] || 0), 0) / Math.max(1, full.length)) }), {});
    const top3 = Object.entries(full.length ? wk : days.at(-1).byKind).filter(x => x[1] > 0).sort((a, b) => b[1] - a[1]).slice(0, 3).map(x => x[0]);
    const legend = top3.length ? `<div class="sc_lgd">${top3.map((k, j) => `<div><span style="color: ${RANK_T[j]}">${KIND_KO[k]}</span><b class="cg_num">${durKo(d ? d.byKind[k] || 0 : wk[k])}</b></div>`).join('')}</div>` : '';
    // the late night: yesterday's when it ran past midnight, or the picked day's last look
    const done = v.days.filter(x => !x.today), y = done.at(-1), yl = lateMin(y?.late);
    const night = d ? (d.late ? `마지막으로 본 시각 <b class="cg_num">${esc(clockOf(p, d.late))}</b>` : '')
        : (y?.late && yl !== null && yl < 5 * 60 ? `어제 새벽 <b class="cg_num">${esc(clockNum(p, y.late))}</b>까지 폰을 봤어요` : '');
    const note = night ? `<div class="sc_note">${ax('scmoon', 15, '#6e7480', 2)}<span>${night}</span></div>` : '';
    const head = `<div class="ax_card sc_head">
        <div class="sc_top"><div><div class="sc_lbl">${esc(label)}</div><div class="sc_big">${total !== null ? durBig(total) : '<span class="cg_num">–</span>'}</div></div></div>
        ${chart(days, v.avg, sel, top3)}${legend}${note}</div>`;
    // how often they picked it up: a number, the code's sentence, four steps
    const pk = d ? d.pickups : v.pickupsAvg;
    const pick = pk !== null && pk !== undefined ? `<div class="ax_card sc_pick"><span class="sc_pki">${ax('scphone', 20, ACC, 1.9)}</span><div class="sc_pkt"><div class="sc_lbl">${d ? (d.today ? '오늘 지금까지' : fmtDate(p, d.date)) : '하루 평균'} 집어든 횟수</div><b>${feel(pk)}</b></div><div class="sc_pkn"><div class="cg_num">${pk}<u>번</u></div><span class="sc_lvl">${[1, 2, 3, 4].map(n => `<i class="${n <= level(pk) ? 'on' : ''}"></i>`).join('')}</span></div></div>` : '';
    // the apps: the week's daily average, or what that day held
    const rows = d ? d.apps.slice(0, 8).map(([name, m]) => { const kind = appOf(name)?.kind || v.top.find(t => t.app === name)?.kind || 'other'; return { name, kind, m }; })
        : v.top.slice(0, 8).map(t => ({ name: t.app, kind: t.kind, m: t.avg }));
    const mx = Math.max(1, ...rows.map(r => r.m));
    const list = rows.length ? `<div class="ax_sec">${d ? (d.today ? '오늘 쓴 앱' : '이날 쓴 앱') : '많이 쓴 앱 · 하루 평균'}</div><div class="ax_card sc_apps">${rows.map(r => `<div class="ax_rw sc_rw">${iconOf(r.name, r.kind)}<span class="ax_tx"><span class="ax_n">${esc(appOf(r.name)?.name || r.name)}</span>${d ? `<span class="ax_p">${KIND_KO[r.kind] || ''}</span>` : `<span class="sc_bar"><i style="width: ${(r.m / mx * 100).toFixed(1)}%"></i></span>`}</span><span class="sc_m cg_num">${durKo(r.m)}</span></div>`).join('')}</div>` : '';
    return wrap(head + pick + list);
}
