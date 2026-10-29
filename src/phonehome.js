// 캐릭터 휴대폰 · 홈 · 잠금화면: 클리어 글래스, the user's design boards.

import { nameKey } from './people.js';
import { annivToday, APPS } from './phoneapps.js';
import { ago, bigClock, fmtDate, fmtTime, koOn, lastTime, parts, savedName, upcoming } from './phonedata.js';
import { esc } from './util.js';

function lockNotes(p, now) {
    const notes = [];
    const day = String(now).slice(0, 5);
    for (const t of [...p.threads].sort((a, b) => lastTime(b).localeCompare(lastTime(a)))) {
        const x = t.messages[t.messages.length - 1];
        if (x && x.from !== 'me' && notes.length < 2) notes.push({ app: 'msg', title: savedName(p, t.with), text: x.text, ko: x.ko, time: x.time });
    }
    const missed = p.calls.filter(c => c.type === 'missed' && c.time.slice(0, 5) === day);
    if (missed.length) {
        const last = missed[missed.length - 1];
        const n = missed.filter(c => nameKey(c.with) === nameKey(last.with)).length;
        notes.push({ app: 'call', title: '부재중 전화', text: `${savedName(p, last.with)}${n > 1 ? ` · ${n}통` : ''}`, time: last.time });
    }
    const ev = p.events.find(e => upcoming(e, now));
    if (ev && notes.length < 3) notes.push({ app: 'cal', title: '캘린더', text: `${ev.title}${ev.time ? ` · ${fmtTime(p, `${ev.date} ${ev.time}`)}` : ''}`, ko: ev.ko, time: '' });
    return notes.slice(0, 3);
}

// ---- 홈: 클리어 글래스 (the user's design board, drawn at its own 390 × 844 and scaled to the phone).
// Two themes, both the user's boards: 컬러 젤 (Gel.dc.html, the default) and 화이트 그레이 (Main.dc.html, p.theme = 'gray');
// every value below is the boards'
export const CG_W = 390, CG_H = 844;
const CG_ALPHA = 'd9'; // clarity 0.85
const CG_I = {
    msg: 'M4 6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H9l-5 4z',
    call: 'M6 3h3l2 5-2.5 1.5a11 11 0 0 0 6 6L16 13l5 2v3a2 2 0 0 1-2 2A17 17 0 0 1 4 5a2 2 0 0 1 2-2z',
    photo: 'M3 7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zM3 16l5-5 4 4 3-3 6 6M15 9h.01',
    note: 'M6 3h9l4 4v14H6zM15 3v4h4M9 12h7M9 16h5',
    cal: 'M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1zM4 10h16M9 3v4M15 3v4',
    map: 'M9 4L4 6v14l5-2 6 2 5-2V4l-5 2zM9 4v14M15 6v14',
    search: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM20 20l-4-4',
    sns: 'M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.5-7 10-7 10z',
    set: 'M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1',
    cam: 'M4 8h3l2-3h6l2 3h3v11H4zM12 10a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7z',
    mail: 'M3 6h18v12H3zM3 7l9 6 9-6',
    diary: 'M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3zM5 17a3 3 0 0 1 3-3h11',
};
const CG_GEL = { sns: ['#efc4d0', '#d494a7'], mail: ['#bfd3e9', '#8faed1'], diary: ['#d3cae9', '#a699c9'], set: ['#d1d4d9', '#a2a7af'], cam: ['#e2e4e8', '#aeb2b9', '#2a313b'], photo: ['#f0cbb5', '#d89f98'], cal: ['#f6f7f9', '#dcdfe5', '#b0564e'], note: ['#f4e5b5', '#dcc680', '#5a4a1f'], map: ['#c3dcc1', '#93ba97'], call: ['#bbddc0', '#89b892'], msg: ['#bbddc0', '#89b892'], search: ['#bfd3e9', '#8faed1'] };
const cgIcon = (k, mono, badge = 0) => {
    const [c1, c2, g = '#ffffff'] = CG_GEL[k];
    const svg = mono
        ? `<svg aria-hidden="true" width="27" height="27" viewBox="0 0 24 24" fill="none" stroke="#2a313b" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="${CG_I[k]}"/></svg>`
        : `<svg aria-hidden="true" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="${g}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="${CG_I[k]}"/></svg>`;
    return `<button type="button" class="cg_ic" data-go="${k}" aria-label="${APPS[k]}"${mono ? '' : ` style="--c1: ${c1}${CG_ALPHA}; --c2: ${c2}${CG_ALPHA}"`}>${svg}${badge ? `<span class="cg_badge cg_num">${badge}</span>` : ''}</button>`;
};
const cgBar = (p, now) => `
  <div class="cg_sb"><span class="cg_num">${esc(bigClock(p, now) || '')}</span><span class="cg_sbi">
    <svg aria-hidden="true" width="18" height="12" viewBox="0 0 18 12" fill="#161b22"><rect x="0" y="8" width="3" height="4" rx="1"/><rect x="5" y="5.5" width="3" height="6.5" rx="1"/><rect x="10" y="3" width="3" height="9" rx="1"/><rect x="15" y="0" width="3" height="12" rx="1"/></svg>
    <svg aria-hidden="true" width="16" height="12" viewBox="0 0 16 12" fill="none" stroke="#161b22" stroke-width="1.8" stroke-linecap="round"><path d="M1.5 4.2a9.5 9.5 0 0 1 13 0"/><path d="M4 7a6 6 0 0 1 8 0"/><circle cx="8" cy="10" r="1" fill="#161b22" stroke="none"/></svg>
    <svg aria-hidden="true" width="27" height="13" viewBox="0 0 27 13" fill="none"><rect x="0.5" y="0.5" width="23" height="12" rx="3.8" stroke="#161b22" stroke-opacity="0.4"/><rect x="2.5" y="2.5" width="16" height="8" rx="2" fill="#161b22"/><path d="M25.5 4.5v4" stroke="#161b22" stroke-opacity="0.4" stroke-width="1.5" stroke-linecap="round"/></svg>
  </span></div>`;
// a note's lines for the checklist widget: "- a" lines, else its sentences; "[x]" or "✓" at the start reads as done
function noteItems(n) {
    if (!n) return [];
    const lines = String(n.text || '').split('\n').map(l => l.trim()).filter(Boolean);
    const list = (lines.length > 1 ? lines : String(n.text || n.title || '').split(/(?<=[.!?。])\s+/)).map(l => l.replace(/^[-*•]\s*/, '').trim()).filter(Boolean);
    return list.slice(0, 3).map(l => { const done = /^(\[x\]|✓|✔)\s*/i.test(l); return { done, text: l.replace(/^(\[x\]|\[ \]|✓|✔)\s*/i, '') }; });
}
// red badges and blue dots: gone once the user has opened them (a thread keeps the last message it was opened at,
// so a new one from an update shows again)
export const lastSig = t => { const x = t.messages[t.messages.length - 1]; return x ? `${x.time}|${x.text}` : ''; };
export const threadNew = t => t.messages[t.messages.length - 1]?.from !== 'me' && t.seen !== lastSig(t);
export function homeScreen(p, now, m) {
    const mono = p.theme === 'gray';
    const day = String(now).slice(0, 5), x = parts(now);
    const anniv = annivToday(m, now, p.owner);
    const unread = p.threads.filter(threadNew).length;
    const missed = p.calls.filter(c => c.type === 'missed' && !c.seen && c.time.slice(0, 5) === day).length;
    const bars = mono ? ['#2a313b', 'rgba(22, 27, 34, 0.22)'] : ['#d89f98', '#8faed1'];
    const evs = [...(anniv ? [{ title: anniv, when: '기념일', heart: true }] : []),
        ...p.events.filter(e => upcoming(e, now)).map(e => ({ title: e.title, when: `${e.date === day ? '' : `${fmtDate(p, e.date, true)} `}${e.time ? fmtTime(p, `${e.date} ${e.time}`) : e.date === day ? '하루 종일' : ''}`.trim() }))].slice(0, 2);
    const note = p.notes[p.notes.length - 1], items = noteItems(note);
    // SNS: comments from others on today's posts; 메일: unread
    const badges = { sns: (p.posts || []).filter(x => !x.seen && x.time.slice(0, 5) === day).reduce((n, x) => n + x.comments.filter(c => nameKey(c.from) !== nameKey(p.owner)).length, 0), mail: (p.mails || []).filter(x => x.unread).length };
    return `
      <div class="cg_bg1" aria-hidden="true"></div><div class="cg_bg2" aria-hidden="true"></div>
      <svg class="cg_noise" aria-hidden="true" width="390" height="844"><filter id="cgn"><feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" stitchTiles="stitch"/></filter><rect width="100%" height="100%" filter="url(#cgn)"/></svg>
      <div class="cg_col">
        ${cgBar(p, now)}
        <div class="cg_top">
          <div class="cg_widgets">
            <button type="button" class="cg_glass cg_wcal" data-go="cal">
              <span class="cg_cap cg_capcal">${x ? `${x.mo}월` : '캘린더'}</span>
              <span class="cg_num cg_day">${x ? x.d : ''}</span>
              <span class="cg_fill"></span>
              <span class="cg_evs">${evs.length ? evs.map((e, k) => `<span class="cg_ev"><span class="cg_evbar" style="background: ${bars[k]}"></span><span class="cg_evtx"><span class="cg_evt">${e.heart ? '♥ ' : ''}${esc(e.title)}</span><span class="cg_num cg_evw">${esc(e.when)}</span></span></span>`).join('') : '<span class="cg_evw">다가오는 일정 없음</span>'}</span>
            </button>
            <button type="button" class="cg_glass cg_wnote" data-go="note">
              <span class="cg_wh"><span class="cg_cap cg_capnote">메모</span><span class="cg_num cg_evw">${p.notes.length ? esc(fmtDate(p, note.time, true)) : ''}</span></span>
              ${items.length ? items.map(i => `<span class="cg_item ${i.done ? 'done' : ''}"><span class="cg_chk">${i.done ? '<svg aria-hidden="true" width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12l5 5 9-10"/></svg>' : ''}</span><span class="cg_itx">${esc(i.text)}</span></span>`).join('') : '<span class="cg_evw">메모 없음</span>'}
            </button>
          </div>
          <div class="cg_grid">${['photo', 'cal', 'note', 'map', 'sns', 'mail', 'diary', 'set'].map(k => `<div class="cg_cell">${cgIcon(k, mono, badges[k] || 0)}<span class="cg_lbl">${APPS[k]}</span></div>`).join('')}</div>
        </div>
        <div class="cg_fill"></div>
        <div class="cg_dots" aria-hidden="true"><span></span><span class="on"></span></div>
        <div class="cg_dockwrap"><div class="cg_glass cg_dock">${cgIcon('call', mono, missed)}${cgIcon('msg', mono, unread)}${cgIcon('cam', mono)}${cgIcon('search', mono)}</div></div>
        <button type="button" class="cg_ind na_ph_quit" aria-label="폰 닫기"><small>닫기</small><span></span></button>
      </div>`;
}

// 잠금화면 · 클리어 글래스: the home's ground and glass, a thin big clock, the notes as glass cards
const cgMini = (k, mono) => { const [c1, c2, g = '#ffffff'] = CG_GEL[k]; return `<span class="cg_ic cg_mini"${mono ? '' : ` style="--c1: ${c1}${CG_ALPHA}; --c2: ${c2}${CG_ALPHA}"`}><svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="${mono ? '#2a313b' : g}" stroke-width="${mono ? 1.75 : 2}" stroke-linecap="round" stroke-linejoin="round"><path d="${CG_I[k]}"/></svg></span>`; };
export function lockScreen(p, now) {
    const mono = p.theme === 'gray';
    return `
      <div class="cg_bg1" aria-hidden="true"></div><div class="cg_bg2" aria-hidden="true"></div>
      <svg class="cg_noise" aria-hidden="true" width="390" height="844"><filter id="cgl"><feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" stitchTiles="stitch"/></filter><rect width="100%" height="100%" filter="url(#cgl)"/></svg>
      <div class="cg_col cg_lock" data-go="home">
        ${cgBar(p, '')}
        <div class="cg_lk">
          <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#3a4250" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 11h12v9H6zM8.5 11V8a3.5 3.5 0 0 1 7 0v3"/></svg>
          <span class="cg_lkdate">${esc(fmtDate(p, now))}</span>
          <span class="cg_num cg_lkclock">${esc(bigClock(p, now))}</span>
          <span class="cg_fill"></span>
          <span class="cg_lknotes">${lockNotes(p, now).map(n => `
            <button type="button" class="cg_glass cg_nt" data-go="${n.app}">${cgMini(n.app, mono)}<span class="cg_nttx"><b>${esc(n.title)}</b><span>${esc(n.text)}</span>${n.ko && koOn() ? `<small class="cg_ntko">${esc(n.ko)}</small>` : ''}</span>${n.time ? `<span class="cg_ntw">${esc(ago(p, n.time))}</span>` : ''}</button>`).join('')}</span>
          <span class="cg_lkopen">눌러서 열기</span>
        </div>
        <button type="button" class="cg_ind cg_lkind na_ph_quit" aria-label="폰 닫기"><small>닫기</small><span></span></button>
      </div>`;
}
