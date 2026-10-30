// 캐릭터 휴대폰 · 앱 화면: every app, drawn at 390 × 844 like the home.

import { annivsOf, datedRows } from './anniv.js';
import { ctx } from './core.js';
import { faceHtml, nameKey, nameRe, peopleData, peopleList, personLine } from './people.js';
import { autopic, autopicPeople, drafting, drawing, looksOf, writing } from './phoneai.js';
import { bigClock, COUNTRIES, fmtDate, fmtTime, hasKo, koOn, lastTime, listTime, loreOff, MOODS, pad, parts, phoneLore, placesOf, REMAKE, rowDay, savedName } from './phonedata.js';
import { threadNew } from './phonehome.js';
import { recentTrackers } from './scenes.js';
import { sectionKey } from './sections.js';
import { glossaryEntries } from './translate.js';
import { esc } from './util.js';

// ---- drawing
const ICO = {
    msg: '<path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.4A8 8 0 1 1 21 12z"/>',
    call: '<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2"/>',
    photo: '<rect x="3" y="4" width="18" height="16" rx="3"/><circle cx="9" cy="10" r="2"/><path d="M21 16l-5-5-9 9"/>',
    note: '<path d="M5 3h10l4 4v14H5z"/><path d="M9 11h6M9 15h6"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/>',
    cal: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
    map: '<path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>',
    back: '<path d="M15 5l-7 7 7 7"/>',
    sig: '<path d="M4 18h2v-3H4zM9 18h2v-6H9zM14 18h2V9h-2zM19 18h2V6h-2z" fill="currentColor" stroke="none"/>',
    bat: '<rect x="2" y="7" width="18" height="10" rx="2.5"/><rect x="4" y="9" width="11" height="6" rx="1" fill="currentColor" stroke="none"/><path d="M22 10v4"/>',
    out: '<path d="M7 17L17 7M9 7h8v8"/>', in: '<path d="M17 7L7 17M15 17H7V9"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    heart: '<path d="M12 20.5s-7.8-4.7-9.7-9.5C1 7.6 3.2 4.5 6.6 4.5c2.2 0 3.8 1.2 5.4 3.1 1.6-1.9 3.2-3.1 5.4-3.1 3.4 0 5.6 3.1 4.3 6.5-1.9 4.8-9.7 9.5-9.7 9.5z"/>',
    lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
    full: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>', x: '<path d="M6 6l12 12M18 6L6 18"/>',
    right: '<path d="M9 6l6 6-6 6"/>', down: '<path d="M6 9l6 6 6-6"/>', plus: '<path d="M12 5v14M5 12h14"/>',
    redo: '<path d="M21 4v6h-6"/><path d="M20.5 10A8.5 8.5 0 1 0 19 16.5"/>',
};
export const ic = (k, s = 18, w = 2) => `<svg class="na_ph_i" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICO[k]}</svg>`;
export const APPS = { msg: '메시지', call: '전화', photo: '사진', note: '메모', search: '검색', cal: '캘린더', map: '지도', sns: 'SNS', mail: '메일', diary: '일기', set: '설정', cam: '카메라', bank: '은행', wallet: '지갑', shop: '쇼핑', voice: '음성 메모', money: '은행 · 지갑 · 쇼핑' };
export function statusBar(p, now) {
    return `<div class="na_ph_sb"><span>${esc(fmtTime(p, now) || '')}</span><i>${ic('sig', 15)}${ic('bat', 20, 1.6)}</i></div>`;
}

const empty = t => `<div class="na_ph_empty">${esc(t)}</div>`;

export const busyHtml = '<i class="fa-solid fa-spinner fa-spin"></i>';
const drawBtn = (p, k, cls = '') => { const busy = drawing.has(`${nameKey(p.owner)}:${k}`); return `<button type="button" class="na_ph_draw ${cls}" data-k="${k}" ${busy ? 'disabled' : ''}>${busy ? `${busyHtml} 그리는 중` : p.photos[k].img ? '다시 그리기' : '그리기'}</button>`; };
// 외모: a sheet over the album with everyone's looks for drawing (every chat). AutoPic's registered looks come first
export function looksSheet(m) {
    const looks = looksOf(), ap = autopic() ? autopicPeople() : [];
    const rows = peopleList(m).map(n => {
        const reg = ap.find(x => nameKey(x.name) === nameKey(n));
        return `
          <div class="na_ph_lrow">${faceHtml(n, 40)}<div>
            <b>${esc(n)}</b>${reg ? '<span class="na_ph_apbadge">오토픽 외모 사용</span>' : ''}
            ${reg ? `<div class="na_ph_lta off">${esc(reg.prompt || '(오토픽에 외모 없음)')}</div><small>오토픽에 등록된 외모가 먼저 들어가요</small>`
                : `<textarea class="na_ph_lta" data-n="${esc(n)}" rows="2" spellcheck="false" placeholder="외모 태그 (머리 · 눈 · 피부 · 체형 · 키)">${esc(looks[nameKey(n)] || '')}</textarea>`}
          </div></div>`;
    }).join('');
    return `
      <div class="na_ph_shade na_ph_lclose"></div>
      <div class="na_ph_sheet">
        <div class="na_ph_grab"></div>
        <div class="na_ph_sheethead"><b>인물 외모<small>사진 그릴 때 들어가요 · 모든 채팅</small></b><button type="button" class="na_ph_lclose na_ph_done">완료</button></div>
        <div class="na_ph_lrows">${rows || empty('인물이 없어요')}</div>
      </div>`;
}

// an anniversary is on a phone only if its owner is in the section it comes from (the chat keeps one list for everyone)
const annivMine = (m, r, owner) => !owner || nameRe(owner).test(m.text.slice(r.s.start, r.s.end));
export function annivToday(m, now, owner) {
    const day = String(now).slice(0, 5);
    const rows = datedRows(m);
    for (const a of annivsOf(m)) {
        const r = rows.find(x => sectionKey(x.s) === a.key);
        if (r && rowDay(r) === day && annivMine(m, r, owner)) return a.name;
    }
    return '';
}
// ---- SNS · 메일 · 일기 · 설정 · 카메라: drawn like the real apps (the approved boards), at 390 × 844 and scaled like the home
export const AX = {
    back: 'M15 5l-7 7 7 7', heart: 'M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.5-7 10-7 10z', cmt: 'M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.4A8 8 0 1 1 21 12z',
    send: 'M22 3L11 13M22 3l-7 18-4-8-8-4z', save: 'M6 3h12v18l-6-4-6 4z', grid: 'M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z', tag: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0',
    plus: 'M12 5v14M5 12h14', menu: 'M4 7h16M4 12h16M4 17h16', home: 'M3 10.5L12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z', search: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM20 20l-4-4',
    reels: 'M4 4h16v16H4zM4 9h16M9 4l3 5M15 4l3 5', photo: 'M3 7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zM3 16l5-5 4 4 3-3 6 6M15 9h.01',
    compose: 'M4 20h4L19 9l-4-4L4 16zM14 6l4 4', filter: 'M4 6h16M7 12h10M10 18h4', trash: 'M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3', folder: 'M3 6h6l2 2h10v11H3z',
    reply: 'M9 14L4 9l5-5M4 9h10a6 6 0 0 1 6 6v3', more: 'M5 12h.01M12 12h.01M19 12h.01', chev: 'M9 6l6 6-6 6', cal: 'M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1zM4 10h16M9 3v4M15 3v4',
    pen: 'M4 20h4L19 9l-4-4L4 16zM14 6l4 4', globe: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18',
    palette: 'M12 3a9 9 0 0 0 0 18c1 0 1.5-.6 1.5-1.4 0-.9-.7-1.3-.7-2.1 0-.8.6-1.5 1.5-1.5H17a4 4 0 0 0 4-4c0-5-4-9-9-9zM7.5 11h.01M10 7h.01M14.5 7h.01',
    lang: 'M4 6h9M8.5 4v2M6 6c0 4 3 7 6 8M11 6c0 3-3 7-7 8M14 20l4-9 4 9M15.5 17h5', user: 'M12 4a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM4 21a8 8 0 0 1 16 0',
    info: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 11v5M12 8h.01', tabs: 'M4 7h12v13H4zM8 3h12v13', dl: 'M12 4v11M7 10l5 5 5-5M5 20h14', again: 'M21 4v6h-6M20.5 10A8.5 8.5 0 1 0 19 16.5', in: 'M17 7L7 17M15 17H7V9', out: 'M7 17L17 7M9 7h8v8', missed: 'M4 7l6 6 4-4 6 6', x: 'M6 6l12 12M18 6L6 18',
    star: 'M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z', clock: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 7v5l3 2',
    keypad: 'M4 4h4v4H4zM10 4h4v4h-4zM16 4h4v4h-4zM4 10h4v4H4zM10 10h4v4h-4zM16 10h4v4h-4zM4 16h4v4H4zM10 16h4v4h-4zM16 16h4v4h-4z', voice: 'M5 10v4M9 7v10M13 4v16M17 8v8M21 11v2',
    call: 'M6 3h3l2 5-2.5 1.5a11 11 0 0 0 6 6L16 13l5 2v3a2 2 0 0 1-2 2A17 17 0 0 1 4 5a2 2 0 0 1 2-2z', video: 'M3 7h12v10H3zM15 10l6-3v10l-6-3', mail: 'M3 6h18v12H3zM3 7l9 6 9-6',
    lock: 'M6 11h12v9H6zM8.5 11V8a3.5 3.5 0 0 1 7 0v3', mic: 'M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3zM5 11a7 7 0 0 0 14 0M12 18v3', check: 'M5 12.5l4.5 4.5L19 7.5', pin: 'M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11zM12 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z', book: 'M5 4.5A1.5 1.5 0 0 1 6.5 3H19v15H6.5A1.5 1.5 0 0 0 5 19.5zM5 19.5A1.5 1.5 0 0 0 6.5 21H19v-3M9 7h6', redo: 'M20 12a8 8 0 1 1-2.3-5.7L20 8.5M20 3.5v5h-5', share: 'M12 3v12M7 8l5-5 5 5M5 14v6h14v-6', bolt: 'M13 2L4 14h7l-1 8 9-12h-7z', flip: 'M20 12a8 8 0 0 1-14 5M4 12a8 8 0 0 1 14-5M18 3v4h-4M6 21v-4h4', down: 'M6 9l6 6 6-6',
};
export const ax = (k, z = 22, c = 'currentColor', w = 2, f = 'none') => `<svg aria-hidden="true" width="${z}" height="${z}" viewBox="0 0 24 24" fill="${f}" stroke="${c}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"><path d="${AX[k]}"/></svg>`;
export const axBar = (p, now, c = '#111') => `
  <div class="ax_sb" style="color: ${c}"><span class="cg_num">${esc(bigClock(p, now) || '')}</span><span class="ax_sbi">
    <svg aria-hidden="true" width="18" height="12" viewBox="0 0 18 12" fill="${c}"><rect x="0" y="8" width="3" height="4" rx="1"/><rect x="5" y="5.5" width="3" height="6.5" rx="1"/><rect x="10" y="3" width="3" height="9" rx="1"/><rect x="15" y="0" width="3" height="12" rx="1"/></svg>
    <svg aria-hidden="true" width="16" height="12" viewBox="0 0 16 12" fill="none" stroke="${c}" stroke-width="1.8" stroke-linecap="round"><path d="M1.5 4.2a9.5 9.5 0 0 1 13 0"/><path d="M4 7a6 6 0 0 1 8 0"/><circle cx="8" cy="10" r="1" fill="${c}" stroke="none"/></svg>
    <svg aria-hidden="true" width="27" height="13" viewBox="0 0 27 13" fill="none"><rect x="0.5" y="0.5" width="23" height="12" rx="3.8" stroke="${c}" stroke-opacity="0.4"/><rect x="2.5" y="2.5" width="16" height="8" rx="2" fill="${c}"/></svg>
  </span></div>`;
export const axInd = (c = '#111') => `<button type="button" class="ax_ind" data-go="home" aria-label="홈"><span style="background: ${c}"></span></button>`;
export const axKo = (t, k) => `${esc(t)}${k && koOn() ? `<span class="ax_ko">${esc(k)}</span>` : ''}`;
// a photo's colours, from its mood (or, for a post, from its words)
const AX_MOOD = { warm: '#f0b38a, #c66a6f', cool: '#9fbadb, #5f7fa8', green: '#b9d4b0, #6f9a76', pink: '#f2bfcd, #cf7f98', dark: '#6d6478, #2f2a38', bright: '#f6dd8f, #e5a85a' };
const moodOf = s => MOODS[[...String(s)].reduce((h, ch) => (h * 31 + ch.codePointAt(0)) % 9973, 7) % MOODS.length];
const axFace = (n, z) => `<span class="ax_face" style="width: ${z}px; height: ${z}px">${faceHtml(n, z)}</span>`;

export function snsScreen(p, now) {
    const pr = p.profile || {}, posts = (p.posts || []).map((x, k) => [x, k]).reverse();
    const n = v => (Number(v) || 0).toLocaleString();
    return `${axBar(p, now)}
      <div class="ax_igtop"><button type="button" class="ax_back ax_igback" data-go="home" aria-label="홈으로">${ax('back', 26, '#111', 2.2)}</button><b>${esc(pr.handle || p.owner)} ${ax('down', 18, '#111', 2.4)}</b><span class="ax_sp"></span><span>${ax('plus', 24, '#111')}${ax('menu', 24, '#111')}</span></div>
      <div class="ax_scroll">
        <div class="ax_igprof"><span class="ax_ring">${axFace(p.owner, 82)}</span><span class="ax_stats"><span><b>${posts.length}</b>게시물</span><span><b>${n(pr.followers)}</b>팔로워</span><span><b>${n(pr.following)}</b>팔로잉</span></span></div>
        <div class="ax_igname"><b>${esc(p.owner)}</b>${pr.bio ? `<br>${axKo(pr.bio, pr.ko)}` : ''}</div>
        <div class="ax_igbtns"><span>프로필 편집</span><span>프로필 공유</span></div>
        <div class="ax_igtabs"><span class="on">${ax('grid', 22)}</span><span>${ax('tag', 22)}</span></div>
        <div class="ax_grid3">${posts.length ? posts.map(([x, k]) => x.photo
            ? x.img ? `<button type="button" class="ax_tile ax_tileimg" data-go="snspost" data-i="${k}"><img src="${esc(x.img)}" alt="" loading="lazy"></button>`
                : `<button type="button" class="ax_tile" data-go="snspost" data-i="${k}" style="--axbg: linear-gradient(160deg, ${AX_MOOD[moodOf(x.photo)]})">${ax('photo', 26, '#fff', 1.6)}<span class="ax_tcap">${esc(x.photo)}</span></button>`
            : `<button type="button" class="ax_tile ax_ttext" data-go="snspost" data-i="${k}">${axKo(x.text, x.ko)}</button>`).join('') : ''}</div>
        ${posts.length ? '' : '<div class="ax_empty">게시물이 없어요</div>'}
      </div>
      <div class="ax_ignav">${ax('home', 26, '#111')}${ax('search', 26, '#111')}${ax('plus', 26, '#111')}${ax('reels', 26, '#111', 1.8)}<span class="ax_navme">${axFace(p.owner, 28)}</span></div>
      ${axInd()}`;
}
// a post's photo: before it is drawn, its words and 그리기; after, only the picture (a long press shows the tags)
function postPic(p, x, k) {
    const busy = drawing.has(`${nameKey(p.owner)}:post${k}`);
    if (x.img) return `<div class="ax_postpic has na_ph_press" data-src="post" data-k="${k}"><img src="${esc(x.img)}" alt="" draggable="false">${busy ? `<span class="ax_postbusy">${busyHtml} 그리는 중</span>` : ''}</div>`;
    return `<div class="ax_postpic" style="background: linear-gradient(160deg, ${AX_MOOD[moodOf(x.photo)]})">${ax('photo', 56, '#fff', 1.3)}<div class="ax_alt">${axKo(x.photo, x.pko)}</div><button type="button" class="na_ph_postdraw ax_postdraw" data-k="${k}" ${busy ? 'disabled' : ''}>${busy ? `${busyHtml} 그리는 중` : '그리기'}</button></div>`;
}
export function snsPost(p, now, k) {
    const x = (p.posts || [])[k], pr = p.profile || {};
    if (!x) return snsScreen(p, now);
    return `${axBar(p, now)}
      <div class="ax_igtop ax_center"><button type="button" class="ax_back" data-go="sns" aria-label="뒤로">${ax('back', 26, '#111', 2.2)}</button><b>게시물</b><span class="ax_sp"></span></div>
      <div class="ax_scroll">
        <div class="ax_posth"><span class="ax_ring ax_ring_s">${axFace(p.owner, 30)}</span><div><b>${esc(pr.handle || p.owner)}</b></div>${x.img ? `<button type="button" class="ax_postmore" data-k="${k}" aria-label="더 보기">${ax('more', 22, '#111', 3)}</button>` : ax('more', 22, '#111', 3)}</div>
        ${x.photo ? postPic(p, x, k) : ''}
        <div class="ax_postact">${ax('heart', 26, '#ed4956', 2, '#ed4956')}${ax('cmt', 25, '#111', 1.9)}${ax('send', 24, '#111', 1.9)}<span class="ax_sp"></span>${x.img ? `<button type="button" class="ax_presssave ax_postsave" data-src="post" data-k="${k}" aria-label="사진 저장">${ax('save', 24, '#111', 1.9)}</button>` : ax('save', 24, '#111', 1.9)}</div>
        <div class="ax_postbody"><b>좋아요 ${x.likes.toLocaleString()}개</b></div>
        ${x.text ? `<div class="ax_postbody"><b>${esc(pr.handle || p.owner)}</b> ${axKo(x.text, x.ko)}</div>` : ''}
        ${x.comments.map(c => `<div class="ax_cmt"><b>${esc(savedName(p, c.from))}</b> ${axKo(c.text, c.ko)}</div>`).join('')}
        <div class="ax_postt">${esc(fmtDate(p, x.time))}</div>
      </div>
      ${axInd()}`;
}
// a day tapped in the strip shows only that day; the same day again shows them all
// the filled circle sits on the day picked, else on today
const dayBtn = (go, d, pick, cls, label) => `<button type="button" class="ax_dpick" data-go="${go}"${d === pick ? '' : ` data-i="${d}"`} aria-pressed="${d === pick}"><b class="${cls}">${label}</b></button>`;
export function diaryScreen(p, now, pick = '') {
    const all = (p.diary || []).map((x, k) => [x, k]).reverse(), x0 = parts(now);
    const ds = pick ? all.filter(([y]) => y.date === pick) : all;
    const have = new Set((p.diary || []).map(d => d.date));
    // the week up to the story's today (no weekday names: the story's dates carry no year)
    const days = [];
    if (x0) for (let n = 6; n >= 0; n--) { const d = new Date(2001, x0.mo - 1, x0.d - n); days.push(`${pad(d.getMonth() + 1)}-${pad(d.getDate())}`); }
    return `${axBar(p, now, '#3d3127')}
      <div class="ax_dytop"><button type="button" class="ax_back" data-go="home">${ax('back', 22, '#8a6d4a', 2.4)}</button>${ax('search', 22, '#8a6d4a')}</div>
      <div class="ax_scroll">
        <div class="ax_dymonth"><b>${x0 ? `${x0.mo}월` : '일기'}</b><span>${pick ? `${esc(fmtDate(p, pick))} · ${ds.length}편` : `${all.length}편`}</span></div>
        ${days.length ? `<div class="ax_strip">${days.map(d => dayBtn('diary', d, pick, `${d === (pick || String(now).slice(0, 5)) ? 'on' : ''} ${have.has(d) ? 'd' : ''}`, Number(d.slice(3)))).join('')}</div>` : ''}
        ${pick && !ds.length ? '<div class="ax_empty">이날 쓴 일기가 없어요</div>' : ds.length ? ds.map(([y, k]) => `
          <button type="button" class="ax_dcard" data-go="diaryone" data-i="${k}"><span class="ax_dd"><b class="cg_num">${esc(String(parts(y.date)?.d || ''))}</b>${esc(`${parts(y.date)?.mo || ''}월`)}</span><span class="ax_dtx"><span class="ax_dh">${esc(y.title || '')}${y.kt && koOn() ? `<small>${esc(y.kt)}</small>` : ''}</span><span class="ax_dp">${esc(y.text.replace(/\s+/g, ' '))}</span></span></button>`).join('') : '<div class="ax_empty">일기가 없어요</div>'}
      </div>
      ${(busy => `<button type="button" class="ax_fab na_ph_write" data-k="diary" aria-label="오늘 일기 쓰기" ${busy ? 'disabled' : ''}>${busy ? `<span class="ax_fabbusy">${busyHtml}</span>` : ax('pen', 24, '#fbf8f2')}</button>`)(writing.has(`${nameKey(p.owner)}:diary`))}
      ${axInd()}`;
}
export function diaryOne(p, now, k) {
    const x = (p.diary || [])[k];
    if (!x) return diaryScreen(p, now);
    return `${axBar(p, now, '#3d3127')}
      <div class="ax_dytop"><button type="button" class="ax_back" data-go="diary">${ax('back', 22, '#8a6d4a', 2.4)}${esc(`${parts(x.date)?.mo || ''}월`)}</button>${x.ko ? `<button type="button" class="na_ph_kochip ax_kobtn ${koOn() ? 'on' : ''}">한국어</button>` : ''}</div>
      <div class="ax_scroll ax_paper">
        <div class="ax_pdt">${esc(fmtDate(p, x.date))}</div>
        <h3>${esc(x.title || '')}</h3>${x.kt && koOn() ? `<div class="ax_pkt">${esc(x.kt)}</div>` : ''}
        <p>${esc(x.text)}</p>
        ${x.ko && koOn() ? `<div class="ax_pko">${esc(x.ko)}</div>` : ''}
      </div>
      ${axInd()}`;
}
// ---- 메시지 · 전화 · 사진 · 메모 · 검색 · 캘린더 · 메일 · 설정 · 카메라 (v3.118): the boards' layout in the home's flat look —
// each app one colour (메시지 · 전화 blue, the rest their home icon's), round glass buttons, white cards, no gradients
export const AXB = { msg: 'blue', thread: 'blue', call: 'blue', callmiss: 'blue', callwho: 'blue', contacts: 'blue', contact: 'blue', draft: 'blue', page: 'sky', tabs: 'sky', marks: 'sky', history: 'sky', bank: 'bank', acct: 'bank', tx: 'bank', wallet: 'wallet', card: 'wallet', pass: 'wallet', shop: 'shop', order: 'shop', voice: 'voice', voiceone: 'voice', photo: 'apri', photoone: 'apri', note: 'butter', noteone: 'butter', search: 'sky', searchone: 'sky', cal: 'brick', calone: 'brick', mail: 'sky', mailone: 'sky', set: 'slate', settheme: 'slate', setlore: 'slate', setwho: 'slate', setremake: 'slate', cam: 'apri', map: 'blue' };
export const AXB_C = { blue: ['#2f6bff', '#e1e9ff'], apri: ['#a65a4e', '#f7e3d7'], butter: ['#7f6a22', '#f6edcf'], sky: ['#3f6a9e', '#dde8f4'], brick: ['#a14a42', '#f3dcd9'], slate: ['#454d5a', '#e6e8ec'], bank: ['#2c4a80', '#e2e9f5'], wallet: ['#3d4a66', '#e3e7ef'], shop: ['#2f7d74', '#d9efec'], voice: ['#8a5a2e', '#f2e7d6'] };
// people outside the archive get a letter on one of the home icons' colours
const AX_AV = ['#8faed1', '#a699c9', '#d89f98', '#89b892', '#d494a7', '#a2a7af', '#dcc680'];
export const axTint = n => AX_AV[[...String(n)].reduce((h, ch) => (h * 31 + ch.codePointAt(0)) % 9973, 7) % AX_AV.length];
export const axLetter = (n, z) => `<span class="ax_avc" style="width: ${z}px; height: ${z}px; font-size: ${Math.round(z * 0.4)}px; background: ${axTint(n)}">${esc([...String(n).trim()][0] || '?')}</span>`;
const axAv = (n, z, roster) => (roster.has(nameKey(n)) ? axFace(n, z) : axLetter(n, z));
export const axFlat = mood => (AX_MOOD[mood] || AX_MOOD.warm).split(', ')[1];
export const axCb = (go, k = 'back') => `<button type="button" class="ax_cb" data-go="${go}" aria-label="${k === 'x' ? '닫기' : '뒤로'}">${ax(k, 18, 'currentColor', 2.3)}</button>`;
export const axKp = p => (hasKo(p) ? `<button type="button" class="na_ph_kochip ax_kp ${koOn() ? 'on' : ''}">가 한국어</button>` : '');
export const axTop = (left, right = '') => `<div class="ax_top">${left}<span class="ax_topr">${right}</span></div>`;
export const axH1 = (t, sub = '') => `<div class="ax_h1"><b>${esc(t)}</b>${sub ? `<span>${esc(sub)}</span>` : ''}</div>`;
export const axFind = (t = '검색') => `<div class="ax_find">${ax('search', 16, 'currentColor', 2.2)}${t}</div>`;
export const axChev = ax('chev', 15, '#b7bdc6', 2.4);
const axNewest = xs => xs.map((x, k) => [x, k]).sort((a, b) => String(b[0].time).localeCompare(String(a[0].time)));
export const axDay = (p, now, v) => (String(v).slice(0, 5) === String(now).slice(0, 5) ? '오늘' : fmtDate(p, v));
// days from b to a (both MM-DD), in one year; -1 when a is before b
const axDays = (a, b) => { const x = parts(a), y = parts(b); return x && y ? Math.round((new Date(2000, x.mo - 1, x.d) - new Date(2000, y.mo - 1, y.d)) / 864e5) : -1; };

export function msgList(p, now, roster) {
    const ts = [...p.threads].sort((a, b) => lastTime(b).localeCompare(lastTime(a)));
    return `${axBar(p, now)}
      ${axTop(axCb('home'), axKp(p))}
      <div class="ax_scroll">
        ${axH1('메시지', ts.length ? `${ts.length}개 대화` : '')}
        ${axFind()}
        ${ts.length ? `<div class="ax_card">${ts.map(t => { const x = t.messages[t.messages.length - 1]; return `
          <button type="button" class="ax_rw" data-go="thread" data-i="${p.threads.indexOf(t)}">${threadNew(t) ? '<i class="ax_dot"></i>' : ''}${axAv(t.with, 48, roster)}<span class="ax_tx">
            <span class="ax_h"><b>${esc(savedName(p, t.with))}</b><small class="cg_num">${esc(listTime(p, x.time))}</small></span>
            <span class="ax_p">${t.draft ? `<span class="ax_draftw">초안</span>${esc(t.draft.text)}` : `${esc(x.text)}${x.ko && koOn() ? `<span class="ax_ko">${esc(x.ko)}</span>` : ''}`}</span></span></button>`; }).join('')}</div>` : '<div class="ax_empty">메시지가 없어요</div>'}
        <i class="ax_pad"></i>
      </div>
      ${axInd()}`;
}
// 미발송 초안: an unsent text stays in the input field, the way a real phone keeps it. Without one, 떠올리기 imagines it
function draftBar(p, t, i) {
    const d = t.draft, busy = drafting.has(`${nameKey(p.owner)}:${t.id || i}`);
    if (d) return `<button type="button" class="ax_ibar ax_draftbar" data-go="draft" data-i="${i}"><span class="ax_dtx"><span class="ax_dlb">보내지 않음${d.time ? ` · <span class="cg_num">${esc(fmtTime(p, d.time))}</span>` : ''}</span><span class="ax_dtext">${esc(d.text)}</span></span><span class="ax_mi">${ax('chev', 16, 'currentColor', 2.4)}</span></button>`;
    return `<div class="ax_ibar ax_draftbar"><span class="ax_dtx"><span class="ax_dlb">${ax('lock', 12, 'currentColor')} 보기 전용</span><span class="ax_dtext ax_dnone">못 보낸 말이 있었을까?</span></span><button type="button" class="ax_dmake na_ph_draftmake" data-i="${i}" ${busy ? 'disabled' : ''}>${busy ? `${busyHtml} 떠올리는 중` : `${ax('pen', 14, 'currentColor')} 떠올리기`}</button></div>`;
}
export function draftView(p, now, i, roster) {
    const t = p.threads[i];
    if (!t?.draft) return threadScreen(p, now, i, roster);
    const d = t.draft;
    return `${axBar(p, now)}
      ${axTop(axCb(`thread:${i}`), axKp(p))}
      <div class="ax_scroll ax_msgs ax_dview">
        <div class="ax_tm"><b>보내지 않은 메시지</b> · ${esc(savedName(p, t.with))}에게</div>
        <div class="ax_bdraft">${esc(d.text)}${d.ko && koOn() ? `<span class="ax_k">${esc(d.ko)}</span>` : ''}</div>
        <div class="ax_dmeta">${d.time ? `<span class="cg_num">${esc(fmtTime(p, d.time))}</span>에 ` : ''}쓰다 멈춤</div>
        <i class="ax_pad"></i>
      </div>
      ${axInd()}`;
}
export function threadScreen(p, now, i, roster) {
    const t = p.threads[i];
    if (!t) return msgList(p, now, roster);
    const ms = t.messages, group = new Set(ms.filter(x => x.from !== 'me').map(x => nameKey(x.from))).size > 1, saved = savedName(p, t.with);
    let day = '';
    const rows = ms.map((x, n) => {
        let out = '';
        const d = x.time.slice(0, 5), me = x.from === 'me', prev = ms[n - 1], next = ms[n + 1];
        if (d && d !== day) { day = d; out += `<div class="ax_tm"><b>${esc(axDay(p, now, x.time))}</b> ${esc(fmtTime(p, x.time))}</div>`; }
        else if (prev && prev.from !== x.from) out += '<i class="ax_gap"></i>';
        if (!me && group && (!prev || prev.from !== x.from || d !== prev.time.slice(0, 5))) out += `<div class="ax_who">${esc(savedName(p, x.from))}</div>`;
        const tail = !next || next.from !== x.from || next.time.slice(0, 5) !== d;
        out += `<div class="ax_bb ${me ? 'ax_bm' : 'ax_bt'} ${tail ? 'tail' : ''}">${esc(x.text)}${x.ko && koOn() ? `<span class="ax_k">${esc(x.ko)}</span>` : ''}</div>`;
        if (me && !next && x.time.length > 5) out += `<div class="ax_read">읽음 ${esc(fmtTime(p, x.time))}</div>`;
        return out;
    }).join('');
    return `${axBar(p, now)}
      ${axTop(`${axCb('msg')}<button type="button" class="ax_who2" data-go="contact" data-i="${encodeURIComponent(nameKey(t.with))}">${axAv(t.with, 38, roster)}<span><b>${esc(saved)}</b><small>연락처 보기 ›</small></span></button>`, axKp(p))}
      <div class="ax_scroll ax_msgs">${rows}<i class="ax_pad big"></i></div>
      ${draftBar(p, t, i)}
      ${axInd()}`;
}

// 전화: one row per run of the same person and kind on one day, newest first
function callRuns(p, onlyMissed) {
    const runs = [];
    for (let k = p.calls.length - 1; k >= 0; k--) {
        const c = p.calls[k], last = runs[runs.length - 1];
        if (onlyMissed && c.type !== 'missed') continue;
        if (last && nameKey(last.c.with) === nameKey(c.with) && last.c.type === c.type && last.c.time.slice(0, 5) === c.time.slice(0, 5)) last.n++;
        else runs.push({ c, k, n: 1 });
    }
    return runs;
}
const callKind = c => (c.type === 'missed' ? '부재중' : `${c.type === 'out' ? '발신' : '수신'}${c.min ? ` · ${c.min}분` : ''}`);
export function callScreen(p, now, roster, onlyMissed) {
    const runs = callRuns(p, onlyMissed), day = String(now).slice(0, 5);
    const row = ({ c, k, n }) => `<button type="button" class="ax_rw" data-go="callwho" data-i="${k}"><span class="ax_ci ${c.type}">${ax(c.type, 17, 'currentColor', 2.2)}</span><span class="ax_tx"><b class="${c.type === 'missed' ? 'm' : ''}">${esc(savedName(p, c.with))}${n > 1 ? ` (${n})` : ''}</b><span class="ax_p">${callKind(c)}</span></span><small class="cg_num">${esc(listTime(p, c.time))}</small></button>`;
    const today = runs.filter(r => r.c.time.slice(0, 5) === day), before = runs.filter(r => r.c.time.slice(0, 5) !== day);
    return `${axBar(p, now)}
      ${axTop(axCb('home'))}
      <div class="ax_scroll">
        ${axH1('최근 기록', runs.length ? `${runs.reduce((s, r) => s + r.n, 0)}통` : '')}
        ${today.length ? `<div class="ax_sec">오늘</div><div class="ax_card">${today.map(row).join('')}</div>` : ''}
        ${before.length ? `<div class="ax_sec">${today.length ? '이전' : '최근'}</div><div class="ax_card">${before.map(row).join('')}</div>` : ''}
        ${runs.length ? '' : `<div class="ax_empty">${onlyMissed ? '부재중 전화가 없어요' : '통화 기록이 없어요'}</div>`}
        <i class="ax_pad big"></i>
      </div>
      <div class="ax_dock"><button type="button" class="${onlyMissed ? '' : 'on'}" data-go="call">전체</button><button type="button" class="${onlyMissed ? 'on' : ''}" data-go="callmiss">부재중</button><button type="button" data-go="contacts">연락처</button></div>
      ${axInd()}`;
}
// 연락처: everyone the phone knows (saved contacts, then anyone in its texts and calls), by the name it shows
export function contactList(p) {
    const seen = new Map();
    const add = n => { const k = nameKey(n); if (k && k !== 'me' && k !== nameKey(p.owner) && !seen.has(k)) seen.set(k, n); };
    p.contacts.forEach(c => add(c.name)); p.threads.forEach(t => add(t.with)); p.calls.forEach(c => add(c.with));
    return [...seen.values()].sort((a, b) => savedName(p, a).localeCompare(savedName(p, b)));
}
export function contactsScreen(p, now, roster) {
    const ns = contactList(p);
    const groups = [];
    for (const n of ns) { const l = [...savedName(p, n).trim()][0]?.toUpperCase() || '#', g = groups[groups.length - 1]; if (g && g.l === l) g.ns.push(n); else groups.push({ l, ns: [n] }); }
    return `${axBar(p, now)}
      ${axTop(axCb('home'))}
      <div class="ax_scroll">
        ${axH1('연락처', ns.length ? `${ns.length}명` : '')}
        <div class="ax_card"><div class="ax_rw">${axAv(p.owner, 48, roster)}<span class="ax_tx"><b>나 · ${esc(p.owner)}</b><span class="ax_p">내 카드</span></span></div></div>
        ${groups.map(g => `<div class="ax_sec">${esc(g.l)}</div><div class="ax_card">${g.ns.map(n => `
          <button type="button" class="ax_rw" data-go="contact" data-i="${encodeURIComponent(nameKey(n))}">${axAv(n, 40, roster)}<span class="ax_tx"><b>${esc(savedName(p, n))}</b>${savedName(p, n) !== n ? `<span class="ax_p">${esc(n)}</span>` : ''}</span>${axChev}</button>`).join('')}</div>`).join('')}
        ${ns.length ? '' : '<div class="ax_empty">연락처가 없어요</div>'}
        <i class="ax_pad big"></i>
      </div>
      <div class="ax_dock"><button type="button" data-go="call">전체</button><button type="button" data-go="callmiss">부재중</button><button type="button" class="on" data-go="contacts">연락처</button></div>
      ${axInd()}`;
}
// one person: the phone's own records, and what 인물 도감 already holds about them (no AI)
export function contactOne(p, now, key, roster, m, back) {
    const who = contactList(p).find(n => nameKey(n) === key) || p.contacts.find(c => nameKey(c.name) === key)?.name;
    if (!who) return contactsScreen(p, now, roster);
    const saved = savedName(p, who), ti = p.threads.findIndex(t => nameKey(t.with) === key);
    const ks = p.calls.map((c, k) => [c, k]).filter(([c]) => nameKey(c.with) === key);
    const lastCall = ks[ks.length - 1];
    let book = null;
    if (roster.has(key)) {
        const pd = peopleData(m), me = pd.names.find(n => nameKey(n) === key), mine = pd.names.find(n => nameKey(n) === nameKey(p.owner));
        const pair = mine && me ? pd.pairs.find(x => [x.a, x.b].sort().join('\u0001') === [mine, me].sort().join('\u0001')) : null;
        book = { line: personLine(m, me || who), rel: (pair?.lines || []).slice(0, 3), state: (pd.people.get(me)?.state || []).slice(0, 3) };
        if (!book.line && !book.rel.length && !book.state.length) book = null;
    }
    const act = (k2, label, go) => (go ? `<button type="button" ${go}>${ax(k2, 21, 'currentColor')}${label}</button>` : `<span>${ax(k2, 21, 'currentColor')}${label}</span>`);
    return `${axBar(p, now)}
      ${axTop(axCb(back || 'contacts'))}
      <div class="ax_scroll">
        <div class="ax_ptop"><span class="ax_ring2" style="background: ${axTint(who)}">${axAv(who, 88, roster)}</span><h2>${esc(saved)}</h2><p>${saved !== who ? `이름 · ${esc(who)}` : '휴대전화'}</p></div>
        <div class="ax_acts">${act('cmt', '메시지', ti >= 0 ? `data-go="thread" data-i="${ti}"` : '')}${act('call', '전화', lastCall ? `data-go="callwho" data-i="${lastCall[1]}"` : '')}${act('video', '영상')}${act('mail', '메일')}</div>
        ${book ? `<div class="ax_card ax_book"><div class="ax_hd">인물 도감</div>${book.line ? `<p class="ax_bookline">${esc(book.line)}</p>` : ''}${[...book.rel, ...book.state].map(l => `<p>${esc(l)}</p>`).join('')}</div>` : ''}
        ${lastCall ? `<div class="ax_card"><div class="ax_hd">최근 통화</div><div class="ax_lr"><span class="${lastCall[0].type === 'missed' ? 'm' : ''}">${lastCall[0].type === 'missed' ? '부재중 전화' : `${lastCall[0].type === 'out' ? '발신' : '수신'} 전화${lastCall[0].min ? ` · ${lastCall[0].min}분` : ''}`}</span><span class="cg_num">${esc(listTime(p, lastCall[0].time))}</span></div>
          <button type="button" class="ax_more" data-go="callwho" data-i="${lastCall[1]}">통화 기록 전체 ${ax('chev', 14, 'currentColor', 2.4)}</button></div>` : ''}
        <i class="ax_pad"></i>
      </div>
      ${axInd()}`;
}
export function callWho(p, now, k, roster) {
    const c0 = p.calls[k];
    if (!c0) return callScreen(p, now, roster, false);
    const who = c0.with, saved = savedName(p, who), ti = p.threads.findIndex(t => nameKey(t.with) === nameKey(who));
    const cs = p.calls.filter(c => nameKey(c.with) === nameKey(who)).reverse();
    const days = [...new Set(cs.map(c => c.time.slice(0, 5)))];
    const act = (k2, label, go) => (go ? `<button type="button" ${go}>${ax(k2, 21, 'currentColor')}${label}</button>` : `<span>${ax(k2, 21, 'currentColor')}${label}</span>`);
    return `${axBar(p, now)}
      ${axTop(axCb('call'))}
      <div class="ax_scroll">
        <div class="ax_ptop"><span class="ax_ring2" style="background: ${axTint(who)}">${axAv(who, 88, roster)}</span><h2>${esc(saved)}</h2><p>${saved !== who ? `저장된 이름 · ${esc(who)}` : '휴대전화'}</p><button type="button" class="ax_tocon" data-go="contact" data-i="${encodeURIComponent(nameKey(who))}">연락처 보기 ›</button></div>
        <div class="ax_acts">${act('cmt', '메시지', ti >= 0 ? `data-go="thread" data-i="${ti}"` : '')}${act('call', '전화')}${act('video', '영상')}${act('mail', '메일')}</div>
        ${days.map(d => `<div class="ax_card"><div class="ax_hd">${esc(axDay(p, now, d))}</div>${cs.filter(c => c.time.slice(0, 5) === d).map(c => `<div class="ax_lr"><span class="${c.type === 'missed' ? 'm' : ''}">${c.type === 'missed' ? '부재중 전화' : `${c.type === 'out' ? '발신' : '수신'} 전화${c.min ? ` · ${c.min}분` : ''}`}</span><span class="cg_num">${esc(fmtTime(p, c.time))}</span></div>`).join('')}</div>`).join('')}
        <i class="ax_pad"></i>
      </div>
      ${axInd()}`;
}

// 사진: the album by day; a photo with no picture yet has a 그리기 pill
const axPic = (x, z) => (x.img ? `<img src="${esc(x.img)}" alt="" loading="lazy">` : ax('photo', z, '#fff', z > 40 ? 1.2 : 1.6));
export function photoScreen(p, now) {
    const ps = axNewest(p.photos);
    const days = [...new Set(ps.map(([x]) => x.time.slice(0, 5)))];
    return `${axBar(p, now)}
      ${axTop(axCb('home'), `<button type="button" class="ax_kp on na_ph_looksbtn">${ax('user', 14, 'currentColor', 2.2)} 외모</button>${axKp(p)}`)}
      <div class="ax_scroll">
        ${axH1('사진', ps.length ? `${ps.length}장` : '')}
        ${ps.length ? days.map(d => { const xs = ps.filter(([x]) => x.time.slice(0, 5) === d); return `
          <div class="ax_pday">${esc(axDay(p, now, d))}<small>${xs.length}장</small></div>
          <div class="ax_pg">${xs.map(([x, k]) => `<div class="ax_pq" data-go="photoone" data-i="${k}" role="button" tabindex="0" aria-label="크게 보기" style="background: ${axFlat(x.mood)}">${axPic(x, 24)}${x.img ? '' : drawBtn(p, k, 'ax_dr')}</div>`).join('')}</div>`; }).join('') : '<div class="ax_empty">사진이 없어요</div>'}
        <i class="ax_pad"></i>
      </div>
      ${axInd()}`;
}
// a drawn photo's tools, where the phone's photo app keeps them: 저장 · 정보 (the tags) · 다시 그리기
function pvTools(p, x, k) {
    const busy = drawing.has(`${nameKey(p.owner)}:${k}`);
    return `<div class="ax_pvtools">
          <button type="button" class="ax_presssave" data-src="photo" data-k="${k}">${ax('dl', 22, '#fff', 2)}<span>저장</span></button>
          <button type="button" class="ax_pvinfo" aria-expanded="false">${ax('info', 22, '#fff', 2)}<span>정보</span></button>
          <button type="button" class="na_ph_postdraw" data-src="photo" data-k="${k}" ${busy ? 'disabled' : ''}>${busy ? busyHtml : ax('again', 22, '#fff', 2)}<span>${busy ? '그리는 중' : '다시 그리기'}</span></button>
        </div>
        <div class="ax_pvtags" hidden><small>그린 태그${x.via === 'autopic' ? ' · 오토픽' : ''}</small><code>${esc(x.tags || '')}</code></div>`;
}
export function photoView(p, now, k) {
    const x = p.photos[k];
    if (!x) return photoScreen(p, now);
    return `${axBar(p, now, '#fff')}
      <div class="ax_top">${axCb('photo')}<span class="ax_ttl">${esc(axDay(p, now, x.time))}<small class="cg_num">${esc(fmtTime(p, x.time))}</small></span><span class="ax_topr">${axKp(p) || '<i class="ax_cbsp"></i>'}</span></div>
      ${x.img ? `<div class="ax_pvimg has na_ph_press" data-src="photo" data-k="${k}">${axPic(x, 60)}${drawing.has(`${nameKey(p.owner)}:${k}`) ? `<span class="ax_postbusy">${busyHtml} 그리는 중</span>` : ''}</div>`
        : `<div class="ax_pvimg" style="background: ${axFlat(x.mood)}">${axPic(x, 60)}</div>`}
      <div class="ax_scroll">
        <div class="ax_pvcap"><p>${esc(x.caption)}${x.ko && koOn() ? `<span class="ax_k">${esc(x.ko)}</span>` : ''}</p></div>
        ${x.img ? pvTools(p, x, k) : `<div class="ax_pvbtns">${drawBtn(p, k, 'ax_pvdraw')}</div>`}
      </div>
      ${axInd('#fff')}`;
}

// 메모: grouped like the real app (오늘 · 이전 7일 · 이전 30일 · by month)
const NOTE_MARK = /^(\[x\]|✓|✔|\[ \]|[-*•])\s*/i;
const writeBtn = (p, kind) => { const busy = writing.has(`${nameKey(p.owner)}:${kind}`); return `<button type="button" class="ax_write na_ph_write" data-k="${kind}" ${busy ? 'disabled' : ''}>${busy ? busyHtml : ax('compose', 15, 'currentColor', 2.2)}<span>${busy ? '쓰는 중' : kind === 'diary' ? '오늘 일기' : '새 메모'}</span></button>`; };
export function noteScreen(p, now) {
    const ns = axNewest(p.notes);
    const label = t => { const n = axDays(now, t); return n === 0 ? '오늘' : n > 0 && n <= 7 ? '이전 7일' : n > 0 && n <= 30 ? '이전 30일' : `${parts(t)?.mo || ''}월`; };
    const groups = [];
    for (const [x, k] of ns) { const l = label(x.time), g = groups[groups.length - 1]; if (g && g.l === l) g.xs.push([x, k]); else groups.push({ l, xs: [[x, k]] }); }
    return `${axBar(p, now)}
      ${axTop(axCb('home'), `${axKp(p)}${writeBtn(p, 'note')}`)}
      <div class="ax_scroll">
        ${axH1('메모', ns.length ? `${ns.length}개` : '')}
        ${axFind()}
        ${groups.length ? groups.map(g => `<div class="ax_sec">${esc(g.l)}</div><div class="ax_card">${g.xs.map(([x, k]) => `
          <button type="button" class="ax_rw ax_rwn" data-go="noteone" data-i="${k}"><span class="ax_tx"><b>${axKo(x.title || x.text.slice(0, 30), x.kt)}</b><span class="ax_p1"><span class="cg_num">${esc(listTime(p, x.time))}</span>${esc(x.text.split('\n').map(l => l.trim().replace(NOTE_MARK, '')).filter(Boolean).join(' · '))}</span></span></button>`).join('')}</div>`).join('') : '<div class="ax_empty">메모가 없어요</div>'}
        <i class="ax_pad"></i>
      </div>
      ${axInd()}`;
}
// a note's lines: "- a", "[ ] a", "[x] a", "✓ a" read as a checklist, the rest as plain lines
export function noteOne(p, now, k) {
    const n = p.notes[k];
    if (!n) return noteScreen(p, now);
    const body = String(n.text || '').split('\n').map(l => {
        const t = l.trim(), mt = t.match(NOTE_MARK);
        if (!mt) return t ? `<div class="ax_nline">${esc(t)}</div>` : '<div class="ax_nline"><br></div>';
        const done = /^(\[x\]|✓|✔)/i.test(mt[1]);
        return `<div class="ax_chk ${done ? 'd' : ''}"><i>${done ? ax('check', 13, '#5a4a1f', 3.2) : ''}</i><span>${esc(t.slice(mt[0].length))}</span></div>`;
    }).join('');
    return `${axBar(p, now)}
      ${axTop(axCb('note'), axKp(p))}
      <div class="ax_scroll ax_nd">
        <div class="ax_ndt cg_num">${esc(fmtDate(p, n.time))} ${esc(fmtTime(p, n.time))}</div>
        <h2>${esc(n.title || '')}</h2>${n.kt && koOn() ? `<div class="ax_nkt">${esc(n.kt)}</div>` : ''}
        ${body ? `<div class="ax_card ax_ncard">${body}</div>` : ''}
        ${n.ko && koOn() ? `<div class="ax_nko">${esc(n.ko)}</div>` : ''}
        <i class="ax_pad"></i>
      </div>
      ${axInd()}`;
}

// 캘린더: the story's month (no weekdays: its dates carry no year), then the days that have something
const AX_EVC = ['#b0564e', '#8faed1', '#89b892', '#dcc680', '#a699c9'];
function annivList(m, owner) {
    const rows = datedRows(m);
    return annivsOf(m).map(a => { const r = rows.find(x => sectionKey(x.s) === a.key); return r && rowDay(r) && annivMine(m, r, owner) ? { name: a.name, date: rowDay(r) } : null; }).filter(Boolean);
}
export function calScreen(p, now, m, pick = '') {
    const day = String(now).slice(0, 5), x0 = parts(now) || parts(p.events[0]?.date) || { mo: 1, d: 1 };
    const an = annivList(m, p.owner);
    const evs = p.events.map((e, k) => ({ e, k }));
    const marked = new Set([...p.events.map(e => e.date), ...an.map(a => a.date)]);
    const len = new Date(2000, x0.mo, 0).getDate();
    const grid = Array.from({ length: len }, (_, n) => { const d = `${pad(x0.mo)}-${pad(n + 1)}`; return dayBtn('cal', d, pick, `${d === (pick || day) ? 't' : ''} ${marked.has(d) ? 'e' : ''}`, n + 1); }).join('');
    const row = ({ e, k }, when = '') => `<button type="button" class="ax_ev" data-go="calone" data-i="${k}"><i style="background: ${AX_EVC[k % AX_EVC.length]}"></i><span class="ax_tx"><b>${esc(e.title)}</b>${e.ko && koOn() ? `<span class="ax_p">${esc(e.ko)}</span>` : ''}</span><small class="cg_num">${e.time ? esc(fmtTime(p, `${e.date} ${e.time}`)) : '하루 종일'}${when ? `<br>${esc(when)}` : ''}</small></button>`;
    const anRow = a => `<div class="ax_ev"><i style="background: #d494a7"></i><span class="ax_tx"><b>♥ ${esc(a.name)}</b><span class="ax_p">기념일 · 매년 ${esc(fmtDate(p, a.date))}</span></span></div>`;
    const soon = [...new Set(evs.filter(x => x.e.date >= day).map(x => x.e.date))].sort();
    if (an.some(a => a.date === day) && !soon.includes(day)) soon.unshift(day);
    const past = evs.filter(x => x.e.date < day).reverse();
    return `${axBar(p, now)}
      ${axTop(axCb('home'), axKp(p))}
      <div class="ax_scroll">
        ${axH1(`${x0.mo}월`, p.events.length ? `일정 ${p.events.length}` : '')}
        <div class="ax_card"><div class="ax_cal7">${grid}</div></div>
        ${pick ? `<div class="ax_sec">${esc(fmtDate(p, pick))}${pick === day ? ' · 오늘' : ''}</div>${(list => (list ? `<div class="ax_card">${list}</div>` : '<div class="ax_empty">이날 일정이 없어요</div>'))(`${an.filter(a => a.date === pick).map(anRow).join('')}${evs.filter(x => x.e.date === pick).map(x => row(x)).join('')}`)}` : `${soon.map(d => `<div class="ax_sec">${esc(fmtDate(p, d))}${d === day ? ' · 오늘' : ''}</div><div class="ax_card">${d === day ? an.filter(a => a.date === d).map(anRow).join('') : ''}${evs.filter(x => x.e.date === d).map(x => row(x)).join('')}</div>`).join('')}
        ${soon.length ? '' : '<div class="ax_sec">다가오는 일정 없음</div>'}
        ${an.length ? `<div class="ax_sec">기념일</div><div class="ax_card">${an.map(anRow).join('')}</div>` : ''}
        ${past.length ? `<div class="ax_sec">지난 일정</div><div class="ax_card">${past.map(x => row(x, fmtDate(p, x.e.date, true))).join('')}</div>` : ''}`}
        <i class="ax_pad"></i>
      </div>
      ${axInd()}`;
}
export function calOne(p, now, k, m) {
    const e = p.events[k];
    if (!e) return calScreen(p, now, m);
    return `${axBar(p, now)}
      ${axTop(axCb('cal'), axKp(p))}
      <div class="ax_scroll">
        <div class="ax_card ax_edh"><h2>${esc(e.title)}</h2>${e.ko && koOn() ? `<div class="ax_k">${esc(e.ko)}</div>` : ''}<p class="cg_num">${esc(fmtDate(p, e.date))}<br>${e.time ? esc(fmtTime(p, `${e.date} ${e.time}`)) : '하루 종일'}</p></div>
        <div class="ax_card"><div class="ax_lr"><span>캘린더</span><span class="ax_v"><i class="ax_cdot" style="background: ${AX_EVC[k % AX_EVC.length]}"></i>${esc(p.owner)}</span></div></div>
      </div>
      ${axInd()}`;
}

// 메일
export function mailScreen(p, now) {
    const ms = (p.mails || []).map((x, k) => [x, k]).reverse(), unread = ms.filter(([x]) => x.unread).length;
    return `${axBar(p, now)}
      ${axTop(axCb('home'), axKp(p))}
      <div class="ax_scroll">
        ${axH1('받은편지함', unread ? `안 읽음 ${unread}` : '')}
        ${axFind()}
        ${ms.length ? `<div class="ax_card">${ms.map(([x, k]) => `
          <button type="button" class="ax_rw ax_rwm" data-go="mailone" data-i="${k}">${x.unread ? '<i class="ax_dot"></i>' : ''}${axLetter(x.from, 42)}<span class="ax_tx">
            <span class="ax_h"><b>${esc(x.from)}</b><small class="cg_num">${esc(listTime(p, x.time))}</small></span>
            <span class="ax_s ${x.unread ? 'u' : ''}">${esc(x.subject)}</span><span class="ax_p">${axKo(x.text.replace(/\s+/g, ' '), x.ko ? x.ko.replace(/\s+/g, ' ') : '')}</span></span></button>`).join('')}</div>` : '<div class="ax_empty">메일이 없어요</div>'}
        <i class="ax_pad"></i>
      </div>
      ${axInd()}`;
}
export function mailOne(p, now, k) {
    const x = (p.mails || [])[k];
    if (!x) return mailScreen(p, now);
    return `${axBar(p, now)}
      ${axTop(axCb('mail'), axKp(p))}
      <div class="ax_scroll">
        <div class="ax_card ax_rw ax_mfrom">${axLetter(x.from, 44)}<span class="ax_tx"><b>${esc(x.from)}</b><span class="ax_p">받는 사람: ${esc(p.owner)}</span></span><small class="cg_num">${esc(fmtDate(p, x.time, true))} ${esc(fmtTime(p, x.time))}</small></div>
        <div class="ax_msub">${axKo(x.subject, x.ks)}</div>
        <div class="ax_mbody">${esc(x.text)}</div>
        ${x.ko && koOn() ? `<div class="ax_mko">${esc(x.ko)}</div>` : ''}
        <i class="ax_pad"></i>
      </div>
      ${axInd()}`;
}

// 설정
export function setScreen(p, now, m, ui) {
    const looks = looksOf(), nLooks = peopleList(m).filter(n => looks[nameKey(n)]).length;
    const si = (c, k) => `<span class="ax_si" style="background: ${c}">${ax(k, 17, '#fff')}</span>`;
    return `${axBar(p, now)}
      ${axTop(axCb('home'))}
      <div class="ax_scroll">
        ${axH1('설정')}
        <div class="ax_card"><button type="button" class="ax_rw ax_me" data-go="setwho">${axFace(p.owner, 56)}<span class="ax_tx"><b>${esc(p.owner)}</b><span class="ax_p">${esc([p.profile?.handle, COUNTRIES[p.country] || p.country].filter(Boolean).join(' · '))}</span></span><span class="ax_v">인물 바꾸기</span>${axChev}</button></div>
        <div class="ax_sec">화면</div>
        <div class="ax_card">
          <button type="button" class="ax_rw" data-go="settheme">${si('#a699c9', 'palette')}<span class="ax_tx"><span class="ax_n">테마</span></span><span class="ax_v">${p.theme === 'gray' ? '화이트 그레이' : '컬러 젤'}</span>${axChev}</button>
          <button type="button" class="ax_rw na_ph_kochip ax_koline">${si('#89b892', 'lang')}<span class="ax_tx"><span class="ax_n">한국어 보기</span></span><span class="ax_sw ${koOn() ? 'on' : ''}"></span></button>
          <button type="button" class="ax_rw na_ph_gloss">${si('#dcc680', 'pen')}<span class="ax_tx"><span class="ax_n">번역 용어집</span></span><span class="ax_v">${(n => (n ? `${n}개` : ''))(glossaryEntries(m).length)}</span>${axChev}</button>
        </div>
        <div class="ax_foot">외국어로 된 문자 · 메모 · 글 밑에 한국어를 붙여요. 용어집의 이름 표기 · 풀네임은 다음에 만들 때부터 써요.</div>
        <div class="ax_sec">일반</div>
        <div class="ax_card">
          <label class="ax_rw">${si('#8faed1', 'globe')}<span class="ax_tx"><span class="ax_n">국적</span></span><span class="ax_v">${esc(COUNTRIES[p.country] || p.country || '')}</span>${axChev}<select class="na_ph_country ax_sel" aria-label="국적">${Object.entries(COUNTRIES).map(([k, v]) => `<option value="${k}" ${k === p.country ? 'selected' : ''}>${v}</option>`).join('')}${COUNTRIES[p.country] ? '' : `<option value="${esc(p.country)}" selected>${esc(p.country)}</option>`}</select></label>
          <button type="button" class="ax_rw na_ph_looksbtn2">${si('#d89f98', 'user')}<span class="ax_tx"><span class="ax_n">외모</span></span><span class="ax_v">${nLooks ? `${nLooks}명` : ''}</span>${axChev}</button>
          <div class="ax_rw">${si('#a2a7af', 'info')}<span class="ax_tx"><span class="ax_n">이 폰에 대해</span></span><span class="ax_v cg_num">${p.upto >= 0 ? `#${p.upto}까지` : ''}</span></div>
        </div>
        <div class="ax_sec">아카이브</div>
        <div class="ax_card">
          <button type="button" class="ax_rw" data-go="setlore">${si('#dcc680', 'book')}<span class="ax_tx"><span class="ax_n">참고 로어북</span></span><span class="ax_v">${(n => (n ? `${n}권` : '없음'))(phoneLore(m).length)}</span>${axChev}</button>
          <button type="button" class="ax_rw na_ph_setinj">${si('#d494a7', 'in')}<span class="ax_tx"><span class="ax_n">롤플에 넣기</span></span><span class="ax_sw ${p.inject ? 'on' : ''}"></span></button>
          <button type="button" class="ax_rw na_ph_setupd">${si('#8faed1', 'redo')}<span class="ax_tx"><span class="ax_n">새로 일어난 일 반영</span></span><span class="ax_v">${ui.newN ? `새 섹션 ${ui.newN}` : ''}</span></button>
        </div>
        <div class="ax_foot">롤플에 넣기를 켜면 이 폰의 최근 문자 · 일정이 주입돼요.</div>
        <div class="ax_card">
          <button type="button" class="ax_rw ax_rwn" data-go="setremake"><span class="ax_tx"><span class="ax_n ax_blue">다시 만들기</span></span>${axChev}</button>
          <button type="button" class="ax_rw ax_rwn na_ph_setdel"><span class="ax_tx"><span class="ax_n ax_red">이 폰 지우기</span></span></button>
        </div>
        <i class="ax_pad"></i>
      </div>
      ${axInd()}`;
}
export function setTheme(p, now) {
    const mini = gray => `<span class="ax_mini"><i class="b1" ${gray ? 'style="opacity: 0.75"' : ''}></i><i class="b2" ${gray ? 'style="opacity: 0.75"' : ''}></i><i class="w" style="left: 8px"></i><i class="w" style="left: 58px"></i><span class="g">${(gray ? Array(8).fill('rgba(255, 255, 255, 0.5)') : ['#e8b8a8', '#eceef2', '#ead69c', '#acc9ad', '#e2b3c3', '#a8c1df', '#bdb1db', '#bcc0c6']).map(c => `<i style="background: ${c}"></i>`).join('')}</span><i class="d"></i></span>`;
    const opt = (v, label) => { const on = (p.theme === 'gray') === (v === 'gray'); return `<button type="button" class="ax_tp na_ph_theme" data-v="${v}">${mini(v === 'gray')}<span>${label}</span><span class="ax_radio ${on ? 'on' : ''}">${on ? ax('check', 14, '#fff', 3.4) : ''}</span></button>`; };
    return `${axBar(p, now)}
      ${axTop(axCb('set'))}
      <div class="ax_scroll">${axH1('테마')}<div class="ax_card ax_themes">${opt('gel', '컬러 젤')}${opt('gray', '화이트 그레이')}</div><div class="ax_foot">홈 화면과 잠금화면에 쓰여요.</div></div>
      ${axInd()}`;
}
// 다시 만들기: the apps ticked are made again from the whole story; the rest stay
// apps made by their own request (채우기), offered alongside
export const REMAKE_MORE = ['money', 'voice'];
const REMAKE_IC = { money: ['#6f86b3', 'card'], voice: ['#c9a581', 'mic'], msg: ['#89b892', 'cmt'], call: ['#89b892', 'call'], photo: ['#d89f98', 'photo'], note: ['#dcc680', 'pen'], search: ['#8faed1', 'search'], cal: ['#d494a7', 'cal'], sns: ['#d494a7', 'heart'], mail: ['#8faed1', 'mail'], diary: ['#a699c9', 'compose'] };
export function setRemake(p, now, ui) {
    const all = [...Object.keys(REMAKE), ...REMAKE_MORE], n = ui.remake.size;
    return `${axBar(p, now)}
      ${axTop(axCb('set'))}
      <div class="ax_scroll">
        ${axH1('다시 만들기', n ? `${n}개 고름` : '')}
        <div class="ax_card">
          <button type="button" class="ax_rw ax_rwn ax_rmall"><span class="ax_tx"><span class="ax_n ax_blue">${n === all.length ? '모두 풀기' : '모두 고르기'}</span></span></button>
        </div>
        <div class="ax_card">${all.map(k => { const on = ui.remake.has(k); return `
          <button type="button" class="ax_rw ax_rmpick" data-k="${k}"><span class="ax_si" style="background: ${REMAKE_IC[k][0]}">${ax(REMAKE_IC[k][1], 17, '#fff')}</span><span class="ax_tx"><span class="ax_n">${APPS[k]}</span></span><span class="ax_radio ${on ? 'on' : ''}">${on ? ax('check', 14, '#fff', 3.4) : ''}</span></button>`; }).join('')}</div>
        <div class="ax_foot">고른 앱만 아카이브 전체를 다시 읽고 새로 채워요. 나머지는 그대로예요.</div>
        <div class="ax_card"><button type="button" class="ax_rw ax_rwn na_ph_setremake" ${n ? '' : 'disabled'}><span class="ax_tx"><span class="ax_n ${n ? 'ax_red' : 'ax_off'}">${n ? `${n}개 다시 만들기` : '앱을 골라 주세요'}</span></span></button></div>
        <i class="ax_pad"></i>
      </div>
      ${axInd()}`;
}
// 인물: whose phone this is; a person only the lorebook knows goes in at the bottom
export function setWho(p, now, m) {
    const names = peopleList(m);
    return `${axBar(p, now)}
      ${axTop(axCb('set'))}
      <div class="ax_scroll">
        ${axH1('인물', `${names.length}명`)}
        <div class="ax_card">${names.map(n => { const on = nameKey(n) === nameKey(p.owner); return `
          <button type="button" class="ax_rw ax_whopick" data-n="${esc(n)}">${axFace(n, 40)}<span class="ax_tx"><span class="ax_n">${esc(n)}</span><span class="ax_p1">${m.phones?.[nameKey(n)] ? '폰 있음' : '아직 폰 없음'}</span></span>${on ? `<span class="ax_radio on">${ax('check', 14, '#fff', 3.4)}</span>` : ''}</button>`; }).join('')}</div>
        <div class="ax_sec">로어북에만 있는 인물</div>
        <div class="ax_card"><div class="ax_rw ax_rwn ax_add na_ph_addbox"><input type="text" class="ax_in na_ph_addname" placeholder="이름" enterkeyhint="done"><button type="button" class="ax_addok na_ph_addok">넣기</button></div></div>
        <i class="ax_pad"></i>
      </div>
      ${axInd()}`;
}
// 참고 로어북: each book with its switch; › opens its entries, each with its own tick
export function setLore(p, now, m, ui) {
    const on = phoneLore(m), all = ctx().getWorldInfoNames?.() || [];
    const book = b => {
        const picked = on.includes(b), off = loreOff(m, b), ents = ui.loreEnts.get(b), open = ui.loreExp.has(b);
        const part = picked && off.size, onN = ents ? ents.filter(e => !off.has(e.uid)).length : 0;
        return `
          <div class="ax_rw ax_rwn ax_lb">
            <button type="button" class="ax_lbx ${open ? 'on' : ''}" data-b="${esc(b)}" aria-label="${open ? '항목 닫기' : '항목 보기'}" aria-expanded="${open}">${ax('chev', 15, '#9aa1ab', 2.4)}</button>
            <span class="ax_tx"><span class="ax_n">${esc(b)}</span>${part ? `<span class="ax_p1">${ents ? `${onN}/${ents.length}개` : '일부'} 읽어요</span>` : ''}</span>
            <button type="button" class="ax_sw ax_lbon ${picked ? 'on' : ''} ${part ? 'part' : ''}" data-b="${esc(b)}" aria-label="${esc(b)} ${picked ? '끄기' : '켜기'}"></button>
          </div>
          ${open ? (!ents ? `<div class="ax_rw ax_rwn ax_le"><span class="ax_tx"><span class="ax_p1">${busyHtml} 항목 읽는 중</span></span></div>` : ents.length ? ents.map(e => { const y = picked && !off.has(e.uid); return `
          <button type="button" class="ax_rw ax_rwn ax_le" data-b="${esc(b)}" data-u="${esc(e.uid)}"><span class="ax_radio ${y ? 'on' : ''}">${y ? ax('check', 14, '#fff', 3.4) : ''}</span><span class="ax_tx"><span class="ax_n">${esc(e.title)}</span></span>${e.always ? '<span class="ax_v">항상</span>' : ''}</button>`; }).join('') : '<div class="ax_rw ax_rwn ax_le"><span class="ax_tx"><span class="ax_p1">쓸 수 있는 항목이 없어요</span></span></div>') : ''}`;
    };
    return `${axBar(p, now)}
      ${axTop(axCb('set'))}
      <div class="ax_scroll">
        ${axH1('참고 로어북', on.length ? `${on.length}권 켜짐` : '')}
        ${all.length ? `<div class="ax_card ax_lbs">${all.map(book).join('')}</div>` : '<div class="ax_empty">로어북이 없어요</div>'}
        <div class="ax_foot">이 채팅의 모든 폰이 같이 읽어요 · 2만 토큰까지 통째로</div>
        <i class="ax_pad"></i>
      </div>
      ${axInd()}`;
}
export function camScreen(p, now, k, busy) {
    const shot = k >= 0 ? p.photos[k] : null, last = p.photos[p.photos.length - 1], th = shot || last;
    const t = recentTrackers(1)[0];
    const modes = '<div class="ax_modes"><span>동영상</span><span class="on">사진</span><span>인물</span></div>';
    const bar = `<div class="ax_cbar"><button type="button" class="ax_cthumb" data-go="photo" aria-label="사진" style="--axbg: ${axFlat(th?.mood || 'green')}">${th?.img ? `<img src="${esc(th.img)}" alt="">` : ''}</button><button type="button" class="ax_shut na_ph_shutter" aria-label="찍기" ${busy ? 'disabled' : ''}><span>${busy ? busyHtml : ''}</span></button><span class="ax_flip" aria-hidden="true">${ax('flip', 22, '#fff')}</span></div>`;
    const top = pill => `<div class="ax_camtop">${ax('bolt', 22, '#fff')}<span class="ax_pill">${pill}</span><button type="button" class="ax_back" data-go="home" aria-label="닫기">${ax('x', 22, '#fff', 2.4)}</button></div>`;
    if (shot) return `${axBar(p, now, '#fff')}
      ${top('사진에 넣었어요')}
      <div class="ax_shot" style="background: ${axFlat(shot.mood)}">${shot.img ? `<img src="${esc(shot.img)}" alt="">` : ax('photo', 64, 'rgba(255, 255, 255, 0.7)', 1.2)}
        <div class="ax_sheet"><small>방금 찍은 사진</small><p>${esc(shot.caption)}</p>${shot.ko && koOn() ? `<div class="ax_k">${esc(shot.ko)}</div>` : ''}
          <div class="ax_btns">${drawBtn(p, k, 'ax_camdraw')}<button type="button" data-go="photoone" data-i="${k}">사진</button><button type="button" data-go="cam">다시 찍기</button></div></div></div>
      ${modes}${bar}${axInd('#fff')}`;
    return `${axBar(p, now, '#fff')}
      ${top(busy ? '찍는 중…' : `지금 장면 · ${esc(fmtDate(p, now, true))} ${esc(fmtTime(p, now))}`)}
      <div class="ax_vf"><i class="ax_scene" style="background: radial-gradient(60% 50% at 30% 35%, #f2c08f 0, transparent 60%), radial-gradient(50% 45% at 75% 60%, #8a5a7a 0, transparent 65%), linear-gradient(170deg, ${AX_MOOD[last?.mood || 'warm']})"></i>
        <i class="ax_gl" style="left: 33.3%; top: 0; bottom: 0; width: 1px"></i><i class="ax_gl" style="left: 66.6%; top: 0; bottom: 0; width: 1px"></i><i class="ax_gl" style="top: 33.3%; left: 0; right: 0; height: 1px"></i><i class="ax_gl" style="top: 66.6%; left: 0; right: 0; height: 1px"></i>
        <i class="ax_focus"></i>${t?.place ? `<span class="ax_hint">${esc(t.place)}</span>` : ''}<span class="ax_zoom"><span>.5</span><span class="on">1×</span><span>2</span></span></div>
      ${modes}${bar}${axInd('#fff')}`;
}

// 지도: the places in the archive's headings where the owner was, newest first (no AI)
export function mapScreen(p, now, m) {
    const pl = placesOf(m, p.owner);
    const pin = ax('pin', 22, 'var(--axd)', 2.2, 'var(--axc)');
    return `${axBar(p, now)}
      ${axTop(axCb('home'))}
      <div class="ax_scroll">
        ${axH1('다녀간 곳', pl.length ? `${pl.length}곳` : '')}
        ${pl.length ? `<div class="ax_card ax_mapart" aria-hidden="true">${pl.slice(0, 5).map((_, k) => `<i style="left: ${[18, 62, 38, 80, 28][k]}%; top: ${[34, 26, 58, 64, 80][k]}%">${pin}</i>`).join('')}</div>
        <div class="ax_card">${pl.map(x => `
          <div class="ax_rw ax_place"><span class="ax_si" style="background: var(--axc)">${ax('pin', 17, 'var(--axd)', 2.2)}</span><span class="ax_tx"><span class="ax_n">${esc(x.place)}</span><span class="ax_p1">${x.n > 1 ? `${x.n}번 · 마지막 ` : ''}${esc(x.scene)}</span></span><small>${esc(x.day ? fmtDate(p, x.day, true) : x.date)}${x.time ? `<br>${esc(x.time)}` : ''}</small></div>`).join('')}</div>` : '<div class="ax_empty">아카이브 제목에 이 인물이 간 장소가 아직 없어요</div>'}
        <i class="ax_pad"></i>
      </div>
      ${axInd()}`;
}
