// Story calendar: dates from section headings.

import { gotoSection } from './ask.js';
import { ctx, getMeta, globalSettings, saveGlobal } from './core.js';
import { WARN_SVG } from './fade.js';
import { headingPlaces } from './people.js';
import { RANGE_HEAD, parseSections } from './sections.js';
import { esc, escRe } from './util.js';

// Reads the date in each numbered heading ("(Mekhir 18, night, Ombos)", "(Phaophi 18 – Hathyr 4)", "(the next day)")
// and lays the sections out on a time line, per log (Y1, Y2…). No AI.

export const CAL_DEFAULT = [
    'Thoth, Phaophi/Paophi, Hathyr/Athyr, Choiak/Khoiak/Koiak, Tybi/Tobi, Mekhir/Mechir/Meshir, Phamenoth/Paremhat, Pharmouthi/Paremoude, Pachons/Pashons, Payni/Paoni, Epiphi/Epip/Epep, Mesore',
    'January/Jan, February/Feb, March/Mar, April/Apr, May, June/Jun, July/Jul, August/Aug, September/Sep/Sept, October/Oct, November/Nov, December/Dec',
    '1월, 2월, 3월, 4월, 5월, 6월, 7월, 8월, 9월, 10월, 11월, 12월',
].join('\n');

export function calendars() {
    const src = String(globalSettings().calendars || CAL_DEFAULT);
    return src.split('\n').map(l => l.split(',').map(x => x.split('/').map(a => a.trim()).filter(Boolean)).filter(x => x.length)).filter(c => c.length >= 2);
}

export const TIME_WORDS = [
    [/before dawn|pre-?dawn/i, '동트기 전'], [/\bdawn\b|daybreak/i, '새벽'], [/\bmorning\b/i, '아침'], [/\bnoon\b|midday/i, '낮'],
    [/afternoon/i, '오후'], [/\bdusk\b|sunset/i, '해질녘'], [/\bevening\b/i, '저녁'], [/midnight/i, '자정'], [/\bnight\b/i, '밤'],
];
export const NUM_WORDS = { a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, several: 3, some: 0 };
export const UNIT_KO = { day: '일', week: '주', month: '개월', year: '년' };

// date bits from one heading
export function headingDate(title, cals = calendars()) {
    const paren = (title.match(/\(([^()]*)\)\s*(?:\[[^\]]*\])?\s*$/) || [, ''])[1];
    const text = paren || title;
    let date = null;
    for (const [ci, months] of cals.entries()) {
        const alt = months.map((names, mi) => names.map(n => [n, mi])).flat().sort((a, b) => b[0].length - a[0].length);
        const pat = alt.map(([n]) => escRe(n)).join('|');
        const korean = /월$/.test(months[0][0]);
        const re = korean
            ? new RegExp(`(${pat})\\s*(\\d{1,2})일?(?:\\s*[–—~-]\\s*(?:(${pat})\\s*)?(\\d{1,2})일?)?`)
            : new RegExp(`\\b(${pat})\\s+(\\d{1,2})(?:\\s*[–—~-]\\s*(?:(${pat})\\s+)?(\\d{1,2}))?`, 'i');
        const mt = text.match(re);
        if (!mt) continue;
        const idx = n => alt.find(([a]) => a.toLowerCase() === String(n).toLowerCase())?.[1];
        const m1 = idx(mt[1]), d1 = Number(mt[2]);
        const m2 = mt[3] ? idx(mt[3]) : m1, d2 = mt[4] ? Number(mt[4]) : d1;
        date = { cal: ci, m: m1, d: d1, m2, d2, label: mt[0].replace(/\s+/g, ' ') };
        break;
    }
    if (!date) {
        // a month alone: "(month of Tybi)"
        for (const [ci, months] of cals.entries()) {
            const mi = months.findIndex(names => names.some(n => new RegExp(`(?<![\\p{L}\\p{N}])${escRe(n)}(?![\\p{L}\\p{N}])`, 'iu').test(text)));
            if (mi >= 0) { date = { cal: ci, m: mi, d: 0, m2: mi, d2: 0, label: months[mi][0] }; break; }
        }
    }
    // time and "later" words only from the parenthesis, never from the title itself ("The night ridge")
    const time = paren ? (TIME_WORDS.find(([re]) => re.test(paren)) || [])[1] || '' : '';
    let rel = '', gap = null;
    const later = paren.match(/\b(a|an|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|several|some|\d+)\s+(day|week|month|year)s?\s+(?:later|on)\b/i);
    if (later) {
        const n = NUM_WORDS[later[1].toLowerCase()] ?? Number(later[1]);
        gap = { n, unit: later[2].toLowerCase() };
        rel = n === 1 ? { day: '하루', week: '일주일', month: '한 달', year: '1년' }[gap.unit] + ' 뒤' : `${n || '얼마'}${UNIT_KO[gap.unit]} 뒤`;
    } else if (/\b(the )?same (day|night)\b|later that day|that (night|evening)/i.test(paren)) rel = '같은 날';
    else if (/\b(the )?next (day|morning)\b|following day/i.test(paren)) rel = '다음 날';
    else if (/next (two|three|few) days/i.test(paren)) rel = '며칠에 걸쳐';
    return { date, time, rel, gap };
}

export function storyTimeline(m) {
    const cals = calendars();
    const secs = parseSections(m.text).filter(s => !s.group && RANGE_HEAD.test(s.title));
    const logs = new Map();
    for (const s of secs) {
        const prefix = (s.title.match(RANGE_HEAD)[1] || '').trim() || '—';
        if (!logs.has(prefix)) logs.set(prefix, []);
        logs.get(prefix).push({ s, ...headingDate(s.title, cals) });
    }
    const out = [];
    for (const [prefix, rows] of logs) {
        let year = 1, prev = null, warnings = 0;
        for (const r of rows) {
            r.year = year; r.note = ''; r.warn = '';
            if (r.date) {
                if (prev && r.date.cal === prev.cal) {
                    const pm = prev.m2, pd = prev.d2;
                    if (r.date.m < pm) { year++; r.year = year; r.note = '해가 바뀐 걸로 봤어요'; }
                    else if (r.date.m === pm && r.date.d && pd && r.date.d < pd) {
                        if (r.gap?.unit === 'year') { year++; r.year = year; }
                        else { r.warn = `날짜가 거꾸로예요 (${prev.label} 다음에 ${r.date.label})`; warnings++; }
                    }
                }
                // months skipped since the previous dated section
                if (prev && r.date.cal === prev.cal && !r.warn) {
                    const months = cals[r.date.cal].length;
                    const diff = (r.year - (prev.year || r.year)) * months + (r.date.m - prev.m2);
                    if (diff >= 2) r.skip = `${diff}개월`;
                }
                prev = { ...r.date, year: r.year };
            }
            if (r.gap && !r.skip) r.skip = r.rel;
        }
        out.push({ prefix, rows, warnings });
    }
    return out;
}

export async function openCalendar() {
    const c = ctx();
    const m = getMeta();
    let logSel = null;
    const $root = $(`
      <div class="na_popup na_v2 na_cal">
        <div class="na_v2_titlebar"><div class="na_v2_title"><b>이야기 달력</b><small class="na_cal_sum"></small></div><div class="na_v2_seg na_cal_logs"></div></div>
        <div class="na_cal_body"></div>
        <details class="na_v2_card na_v2_more na_cal_cfg">
          <summary><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg> 달 이름 바꾸기</summary>
          <small class="na_v2_note">한 줄에 달력 하나, 달은 순서대로 쉼표로, 다른 표기는 / 로 (예: Mekhir/Mechir). 비우면 기본값(이집트·영어·한국어 달).</small>
          <textarea class="text_pole na_cal_ta" rows="4" spellcheck="false"></textarea>
        </details>
      </div>`);
    const g = globalSettings();
    $root.find('.na_cal_ta').val(g.calendars || CAL_DEFAULT).on('change', function () {
        const v = this.value.trim();
        g.calendars = v && v !== CAL_DEFAULT ? v : '';
        saveGlobal(); draw();
    });
    const strip = t => t.replace(/\s*\([^()]*\)\s*(\[[^\]]*\])?\s*$/, '').replace(RANGE_HEAD, (all, p, a, dash, b, rest) => rest.replace(/^\s*[—–-]\s*/, '')) || t;
    const draw = () => {
        const tl = storyTimeline(m);
        const cals = calendars();
        if (!tl.length) { $root.find('.na_cal_body').html('<div class="na_empty">"## #시작–#끝 — 제목 (날짜…)" 형식의 섹션이 없어요.</div>'); return; }
        const l = tl.find(x => x.prefix === logSel) || tl[tl.length - 1];
        logSel = l.prefix;
        const name = p => p === '—' ? '로그' : p;
        $root.find('.na_cal_logs').html(tl.length > 1 ? tl.map(x => `<button type="button" data-p="${esc(x.prefix)}" class="${x === l ? 'on' : ''}">${esc(name(x.prefix))}</button>`).join('') : '');
        const dated = l.rows.filter(r => r.date).length;
        $root.find('.na_cal_sum').text(`${tl.length > 1 ? `${name(l.prefix)} · ` : ''}섹션 ${l.rows.length}개 · 날짜 ${dated}개`);
        // month groups: a dated row opens a new group when its month changes; undated rows stay in the current one
        const groups = [];
        for (const r of l.rows) {
            const key = r.date ? `${r.date.cal}:${r.date.m}:${r.year}` : null;
            const cur = groups[groups.length - 1];
            if (!cur || (key && key !== cur.key)) groups.push({ key, name: r.date ? cals[r.date.cal][r.date.m][0] : '날짜 없음', year: r.year, gap: r.skip || '', rows: [r] });
            else cur.rows.push(r);
            if (!cur && !key) groups[0].key = null;
        }
        const day = r => r.date?.d ? (r.date.m2 !== r.date.m ? `${r.date.d}–` : r.date.d2 && r.date.d2 !== r.date.d ? `${r.date.d}–${r.date.d2}` : `${r.date.d}`) : (r.date ? '·' : '?');
        const sub = r => r.date?.d && r.date.m2 !== r.date.m ? `~${cals[r.date.cal][r.date.m2][0]} ${r.date.d2 || ''}`.trim() : (r.time || (r.date ? '' : r.rel || ''));
        const place = r => headingPlaces(r.s.title, cals).join(' → ');
        $root.find('.na_cal_body').html(`
          ${dated ? '' : '<div class="na_v2_card na_v2_note">제목에서 날짜를 못 찾았어요. 아래 "달 이름 바꾸기"에 이야기 속 달력을 적어 주세요.</div>'}
          ${l.warnings ? `<div class="na_xr_warn slim">${WARN_SVG}<div class="na_cal_warntxt">날짜가 거꾸로 가는 곳 ${l.warnings}개</div><button type="button" class="na_linkbtn na_cal_jump">보기</button></div>` : ''}
          ${groups.map(gr => `
            ${gr.gap ? `<div class="na_cal_gap2"><span>${esc(/개월$/.test(gr.gap) ? `${gr.gap} 지남` : gr.gap)}</span></div>` : ''}
            <div class="na_cal_month"><b>${esc(gr.name)}</b><small>섹션 ${gr.rows.length}${gr.year > 1 ? ` · ${gr.year}년째` : ''}</small></div>
            <div class="na_v2_card na_v2_list">${gr.rows.map(r => `
              <button type="button" class="na_cal_item ${r.warn ? 'warn' : ''}" data-start="${r.s.start}">
                <span class="na_cal_day"><b>${esc(day(r))}</b><small>${esc(sub(r))}</small></span>
                <span class="na_cal_txt"><span>${esc(strip(r.s.title))}</span><small>${esc(r.warn || [(r.s.title.match(/^(?:\S{1,12}\s)?#\d+\s*[–—~-]\s*#?\d+/) || [''])[0], place(r), r.note].filter(Boolean).join(' · '))}</small></span>
              </button>`).join('')}
            </div>`).join('')}`);
    };
    $root.on('click', '.na_cal_logs button', function () { logSel = String($(this).data('p')); draw(); });
    $root.on('click', '.na_cal_jump', () => $root.find('.na_cal_item.warn')[0]?.scrollIntoView({ block: 'center', behavior: 'smooth' }));
    $root.on('click', '.na_cal_item', function () { const st = Number(this.dataset.start); $root.closest('dialog').find('.popup-button-ok').trigger('click'); gotoSection(st); });
    draw();
    await c.callGenericPopup($root, c.POPUP_TYPE.TEXT, '', { wide: true, large: true, allowVerticalScrolling: true, leftAlign: true, okButton: '닫기' });
}
