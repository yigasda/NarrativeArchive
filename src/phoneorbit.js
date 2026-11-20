// Orbit: 실시간 폰(폰 2)의 메신저 화면 (docs/design/orbit.md, 시안 docs/mockups/phone2-messenger · phone2-orbit).
// 목록 · 새 대화는 흰 카드 + 검정 알약(시안 A), 방 안은 그 사람 색 오로라 바탕 + 유리(시안 C).
// 화면만 그려요: 폰 2를 읽는 건 phone.js가 하고, 이 파일은 그 결과(ui.orbit)만 받아요(폰 2 파일을 부르지 않아요).
// 설명 글은 쓰지 않아요(몰입이 깨져요). 화면에 나오는 건 이름 · 말 · 시각 · 상태 낱말뿐이에요.
import { esc } from './util.js';
import { axBar, axInd } from './phoneapps.js';
import { faceOf, stFace } from './people.js';

// 사람마다 고정된 색 오로라(이름 해시): [바탕 세 점, 바탕색]
const AURA = [
    ['#6f8fe6', '#a9c4f7', '#c7b8f2', '#94acee'],   // 파랑 · 라벤더
    ['#e8615a', '#f4ab95', '#f7c9b4', '#ee8b7c'],   // 산호
    ['#59b874', '#f0bf7f', '#cfe08c', '#8dcb8a'],   // 초록 · 살구
    ['#f2a2b4', '#f7c6a6', '#e7b3e0', '#f1b0b4'],   // 장미 · 복숭아
    ['#5fb3c9', '#a9dcd6', '#b9c8f2', '#86c3cf'],   // 물빛
    ['#d9a35a', '#f3cf96', '#e8a7a0', '#e4b47c'],   // 호박
];
const GROUP = ['#8a6fdc', '#d79ad8', '#a7a1ef', '#a688de'];
const hash = s => [...String(s || '')].reduce((h, c) => (h * 31 + c.codePointAt(0)) % 99991, 7);
const auraOf = (name, group) => (group ? GROUP : AURA[hash(String(name).toLowerCase()) % AURA.length]);
const auraBg = ([a, b, c, d]) => `radial-gradient(40% 50% at 25% 35%,${a} 0,transparent 70%),radial-gradient(45% 55% at 75% 70%,${b} 0,transparent 70%),radial-gradient(40% 40% at 70% 20%,${c} 0,transparent 70%),${d}`;
export const orbitBg = (name, group) => auraBg(auraOf(name, group));

// 선 아이콘(24 판)
const I = {
    back: 'M15 5l-7 7 7 7', plus: 'M12 5v14M5 12h14', send: 'M5 12h13M13 6l6 6-6 6', srch: 'M11 5a6 6 0 1 0 0 12 6 6 0 0 0 0-12zM20 20l-4.3-4.3', pen: 'M4 20h4L19 9l-4-4L4 16z', chat: 'M5 5h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-7l-5 4v-4H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z', file: 'M7 3h7l5 5v13H7zM14 3v5h5M12 12v6M9.5 15.5 12 18l2.5-2.5', user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4.5 20a7.5 7.5 0 0 1 15 0', tell: 'M4 15V7a3 3 0 0 1 3-3h10a3 3 0 0 1 3 3v4M8 20H4v-4M4 20l7-7h9M17 10l3 3-3 3',
    clock: 'M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16zM12 8v4l3 2', chk: 'M4 12.5l4.5 4.5L20 6', chev: 'M9 6l6 6-6 6', x: 'M6 6l12 12M18 6L6 18',
    tr: 'M4 6h8M8 4v2c0 4-2 7-5 8M6 10c1.5 2 3.5 3.5 6 4M13 20l4-9 4 9M14.5 17h5', moon: 'M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z',
    sun: 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4',
    set: 'M7 15a5 5 0 0 1 10 0M3 15h2M19 15h2M5.6 9.6l1.4 1.4M18.4 9.6 17 11M12 6v2M4 19h16',
    book: 'M5 4h9a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3zM5 17a3 3 0 0 1 3-3h9', spark: 'M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6',
};
const ic = (k, s = 20, c = 'currentColor', w = 2) => `<svg aria-hidden="true" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"><path d="${I[k]}"/></svg>`;
// 그 사람 현지 시각의 아이콘: 05~17 해 · 17~21 저녁 · 21~05 달 (날씨 하늘과 같은 경계)
export const dayIcon = hhmm => { const h = Number(String(hhmm || '').slice(0, 2)); return h >= 5 && h < 17 ? 'sun' : h >= 17 && h < 21 ? 'set' : 'moon'; };

// 얼굴: 그 사람 색 동그라미 + 첫 글자
// 얼굴: 인물 도감에서 정한 프사(없으면 실리태번 아바타)가 있으면 그 그림, 없으면 색 동그라미 + 첫 글자. 단체방은 늘 보라 동그라미
// (그림이 안 불러와지면 작은 그림 → 글자로 물러나요)
const faceUrl = (name, s) => { try { const big = s * (globalThis.devicePixelRatio || 1) > 96, url = faceOf(name, big); return { url, fb: big && url && !url.startsWith('data:') ? stFace(name) : '' }; } catch { return { url: '', fb: '' }; } };
const face = (name, s = 48, group = false) => { const f = group ? { url: '' } : faceUrl(name, s); return `<span class="ob_face" style="width:${s}px;height:${s}px;font-size:${Math.round(s * 0.38)}px"><span class="ob_blob" style="background:${orbitBg(name, group)}"></span><b>${esc([...String(name || '?')][0] || '?')}</b>${f.url ? `<img src="${esc(f.url)}"${f.fb && f.fb !== f.url ? ` data-fb="${esc(f.fb)}"` : ''} alt="" loading="lazy" decoding="async">` : ''}</span>`; };
if (typeof document !== 'undefined') document.addEventListener('error', e => { const i = e.target; if (i?.tagName !== 'IMG' || !i.parentElement?.classList.contains('ob_face')) return; if (i.dataset.fb) { const fb = i.dataset.fb; delete i.dataset.fb; i.src = fb; } else i.remove(); }, true);

// 홈 아이콘(시안 phone2-orbit 4번 · 82%): 노을 안개 판 + 점 뒤로 옅어지는 빛 꼬리 고리 + 빛나는 점
const ICON = (() => {
    const k = 0.82, r = 16.5 * k, w = (6.2 * k).toFixed(2), a0 = -Math.PI / 4, g = 0.34, N = 40, P = (t) => [32 + r * Math.cos(t), 32 + r * Math.sin(t)].map(v => v.toFixed(2));
    const [dx, dy] = P(a0);
    let tail = '';
    for (let i = 0; i < N; i++) {
        const t0 = a0 + g + (2 * Math.PI - 2 * g) * i / N, t1 = a0 + g + (2 * Math.PI - 2 * g) * (i + 1) / N + 0.01;
        const [x0, y0] = P(t0), [x1, y1] = P(t1);
        tail += `<path d="M${x0} ${y0}A${r.toFixed(2)} ${r.toFixed(2)} 0 0 1 ${x1} ${y1}" stroke="#fff" stroke-opacity="${(0.08 + 0.92 * (i / (N - 1)) ** 1.4).toFixed(3)}" stroke-width="${w}" fill="none"/>`;
    }
    return `<svg aria-hidden="true" viewBox="0 0 64 64" width="SZ" height="SZ"><defs><linearGradient id="obi_bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f3c3a6"/><stop offset=".5" stop-color="#e8a7b8"/><stop offset="1" stop-color="#b5a3dd"/></linearGradient>`
        + `<linearGradient id="obi_hl" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".22"/><stop offset=".5" stop-color="#fff" stop-opacity="0"/></linearGradient>`
        + `<radialGradient id="obi_gl"><stop offset="0" stop-color="#fff" stop-opacity=".85"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>`
        + `<filter id="obi_sh" x="-30%" y="-30%" width="160%" height="160%"><feDropShadow dx="0" dy="1.6" stdDeviation="1.6" flood-color="#7a4a6a" flood-opacity=".28"/></filter>`
        + `<clipPath id="obi_c"><rect width="64" height="64" rx="18.6"/></clipPath></defs><g clip-path="url(#obi_c)"><rect width="64" height="64" fill="url(#obi_bg)"/>`
        + `<g filter="url(#obi_sh)">${tail}<circle cx="${dx}" cy="${dy}" r="${(9 * k).toFixed(2)}" fill="url(#obi_gl)"/><circle cx="${dx}" cy="${dy}" r="${(5 * k).toFixed(2)}" fill="#fff"/></g>`
        + `<rect width="64" height="64" fill="url(#obi_hl)"/></g></svg>`;
})();
const icon = sz => ICON.replace(/"SZ"/g, `"${sz}"`);
// 실시간 폰 홈 1쪽 위 위젯(시안 phone2-home 4차 "줄 간격 고르게 · 말 옅게"): 유리 카드 한 장, 머리줄은 Orbit 아이콘 · 이름 ·
// 안 읽은 수, 최근 방 두 줄(얼굴 · 이름 · 마지막 말 · 시각 · 검정 숫자). 누르면 Orbit, 줄을 누르면 그 방. 방이 없으면 새 대화 한 줄
export const orbitHomeWidget = (rooms, unread = 0) => `<div class="cg_glass ob_w" tabindex="0" data-go="orbit" aria-label="Orbit">
      <div class="ob_wh"><span class="ob_wi">${icon(18)}</span>Orbit${unread ? `<em>안 읽음 ${unread}</em>` : ''}</div>
      ${rooms.length ? rooms.map(r => `<div class="ob_wr" role="button" tabindex="0" data-go="orbitroom" data-i="${esc(r.id)}">${face(r.title, 32, r.group)}<span class="ob_wt"><b>${esc(r.title)}</b><span>${r.last ? `${r.lastWho ? `${esc(r.lastWho)}: ` : ''}${esc(r.last)}` : ''}</span></span><span class="ob_wn"><span class="cg_num">${esc(r.time || '')}</span>${r.unread ? `<span class="ob_wb cg_num">${r.unread}</span>` : ''}</span></div>`).join('')
        : `<div class="ob_wr" role="button" tabindex="0" data-go="orbitnew"><span class="ob_wp">${ic('plus', 16, '#3a3f47', 2.2)}</span><span class="ob_wt"><b>새 대화</b></span></div>`}
    </div>`;

const dots = lit => Array.from({ length: 24 }, (_, h) => `<i class="${h === lit ? 'h' : h < lit ? 'p' : ''}" style="height:${h < lit ? [9, 15, 22, 15][h % 4] : 4}px"></i>`).join('');

// 방 목록 (시안 A): 맨 위 "지금 그 사람" 카드, 1:1 · 단체 고르기, 흰 목록, 아래 새 대화
// o: { tab, back: { n (안 전한 말), busy, sheet: { text, count, more } | null }, acct: { name, ro, sheet, list: [{ name, sub, on }] }, hero: { name, city, local } | null, rooms: [{ id, title, group, last, lastWho, time, unread }] }
// 왼쪽 위 얼굴 = 지금 계정(시안 phone2-account A): 누르면 아래 시트에서 페르소나 ↔ 이 폰 주인. 주인 계정은 읽기만(새 대화 · 안 읽음 없음)
export function orbitList(p, now, o) {
    const tab = o.tab || 'all', rooms = o.rooms.filter(r => tab === 'all' || (tab === 'group') === r.group);
    const bk = o.back, h = o.hero, lit = h ? Number(String(h.local).slice(0, 2)) : -1, a = o.acct || { name: '', list: [] }, many = a.list.length > 1;
    return `${axBar(p, o.clock || now)}
      <div class="ob_top">${many ? `<button type="button" class="ob_me na_ob_acct" aria-label="계정">${face(a.name, 46)}</button>` : `<span class="ob_me">${face(a.name, 46)}</span>`}<b class="ob_h1">메시지</b>${a.ro ? '<span class="ob_cb0"></span>' : `<span class="ob_tr">${bk ? `<button type="button" class="ob_cb ob_bk na_ob_back${bk.n || bk.busy ? '' : ' off'}" aria-label="${bk.busy ? '정리 중' : '롤플에 전하기'}"${bk.busy ? ' disabled' : ''}>${bk.busy ? '<i class="fa-solid fa-spinner fa-spin"></i>' : ic('tell', 20, '#1b1d24', 2.1)}${bk.n && !bk.busy ? `<span class="ob_un cg_num">${bk.n}</span>` : ''}</button>` : ''}<button type="button" class="ob_cb" data-go="orbitnew" aria-label="새 대화">${ic('pen', 19)}</button></span>`}</div>
      <div class="ob_scroll ax_scroll">
        <div class="ob_seg">${[['all', '전체'], ['one', '1:1'], ['group', '단체']].map(([k, t]) => `<button type="button" class="ob_sg na_ob_tab${tab === k ? ' on' : ''}" data-v="${k}">${t}</button>`).join('')}</div>
        ${h ? `<div class="ob_hero"><span class="ob_blob" style="background:${orbitBg(h.name)}"></span><span class="ob_gl"></span><div class="ob_in"><small>${esc(h.name)}${h.city ? ` · ${esc(h.city)}` : ''} 지금</small><div class="ob_big cg_num">${esc(h.local)}</div><div class="ob_dots">${dots(lit)}</div><div class="ob_dl"><span>0시</span><span>12시</span><span>24시</span></div></div></div>` : ''}
        ${rooms.length ? `<div class="ob_list">${rooms.map(r => `<div class="ob_rm" role="button" tabindex="0" data-go="orbitroom" data-i="${esc(r.id)}">${face(r.title, 50, r.group)}<span class="ob_t"><b>${esc(r.title)}</b><span class="ob_p">${r.last ? `${r.lastWho ? `${esc(r.lastWho)}: ` : ''}${esc(r.last)}` : ''}</span></span><span class="ob_r"><span class="cg_num">${esc(r.time || '')}</span>${r.unread ? `<span class="ob_un cg_num">${r.unread}</span>` : '<span class="ob_un0"></span>'}</span></div>`).join('')}</div>` : ''}
        <i class="ob_pad"></i>
      </div>
      ${a.ro ? '' : `<button type="button" class="ob_dock" data-go="orbitnew">${ic('plus', 16, '#fff', 2.4)}새 대화</button>`}
      ${bk?.sheet ? `<div class="ob_shade na_ob_bkno"></div><div class="ob_sheet ob_bks"><i class="ob_grab"></i><div class="ob_bkh"><b>롤플에 넣기</b><span>말 ${bk.sheet.count}개</span></div><div class="ob_bkt na_ob_bktx" contenteditable="true" role="textbox" aria-multiline="true" spellcheck="false" aria-label="넣을 글">${esc(bk.sheet.text)}</div>${bk.sheet.more ? `<div class="ob_bkm">남은 말 ${bk.sheet.more}개는 한 번 더</div>` : ''}<div class="ob_bkb"><button type="button" class="ob_bkno na_ob_bkno">취소</button><button type="button" class="ob_bkok na_ob_bkok"${bk.busy ? ' disabled' : ''}>넣기</button></div></div>` : ''}
      ${a.sheet ? `<div class="ob_shade na_ob_shade"></div><div class="ob_sheet"><i class="ob_grab"></i>${a.list.map(x => `<div class="ob_acc na_ob_who" role="button" tabindex="0" data-n="${esc(x.name)}">${face(x.name, 40)}<span class="ob_t"><b>${esc(x.name)}</b>${x.sub ? `<span class="ob_p">${esc(x.sub)}</span>` : ''}</span><span class="ob_ck${x.on ? ' on' : ''}">${x.on ? ic('chk', 14, '#fff', 3) : ''}</span></div>`).join('')}</div>` : ''}
      ${axInd()}`;
}

// 방 안 (시안 C): 그 사람 색 바탕, 유리 머리줄 · 말풍선 · 입력칸
// o: { id, title, group, sub, chips: [{ icon, text }], asOwner (주인 계정: 읽기만), draft, clock, faceOf (1:1 · 내 계정: 머리줄 얼굴을 누르면 그 사람 프사 바꾸기),
//      msgs: [{ day } | { mine, from, text, ko, time, unread, id, open, held (길게 눌린 말), pick (고르는 중: true | false), wait (번역 중), reply (맨 끝 답장 묶음), dots (그 묶음의 마지막 말) }],
//      swipe: { at, count } | null (맨 끝 답장 넘기기), picking: 고른 수 | null,
//      list: { items: [{ no, now, bubbles: [{ text, ko }] }], picks: [no], busy (답장이 오는 중: 지우기 막힘) } | null (받아 둔 답장 창) }
// 말 고치기 (시안 docs/mockups/phone2-edit M3 · W3): 길게 누르면 그 말 위 검정 알약(재번역 · 선택 · 삭제, 맨 끝 답장이면 빨간 "답장 버리기"도. 빨강은 그것 하나만),
// 선택이면 말마다 동그라미 + 입력칸 자리의 줄, 맨 끝 답장 아래 점(옆으로 밀어서 넘겨요)
export function orbitRoom(p, now, o) {
    const koOf = x => (x.wait ? `<span class="ob_ko ob_wait"><i class="fa-solid fa-spinner fa-spin"></i> 번역 중</span>`
        : x.ko ? (x.open ? `<span class="ob_ko na_ob_ko" role="button" tabindex="0" data-id="${esc(x.id)}">${esc(x.ko)}</span>` : `<span class="ob_kof na_ob_ko" role="button" tabindex="0" data-id="${esc(x.id)}">${ic('tr', 13)}번역 보기</span>`) : '');
    const pill = x => `<div class="ob_pill${x.mine ? ' me' : ''}">${[['na_ob_mtr', '재번역', ''], ['na_ob_mpick', '선택', ''], ['na_ob_mdel', '삭제', ''], ...(x.reply ? [['na_ob_swdel', '답장 버리기', ' red']] : [])].map(([c, l, r]) => `<button type="button" class="${c}${r}" data-id="${esc(x.id)}">${l}</button>`).join('')}</div>`;
    const dots = w => `<div class="ob_swd na_ob_swd" aria-label="답장 ${w.at}/${w.count}">${Array.from({ length: Math.min(w.count, 9) }, (_, i) => `<i class="${i === Math.min(w.at, 9) - 1 ? 'on' : ''}"></i>`).join('')}</div>`;
    const msg = x => { if (x.day) return `<div class="ob_day">${esc(x.day)}</div>`;
        const bb = `<div class="ob_b na_ob_b ${x.mine ? 'me' : 'th ob_glass'}${x.held ? ' held' : ''}${x.reply ? ' na_ob_sw' : ''}" data-id="${esc(x.id)}">${esc(x.text)}${koOf(x)}</div>`;
        return `${o.group && !x.mine && x.from ? `<div class="ob_sn">${esc(x.from)}</div>` : ''}${x.held ? pill(x) : ''}${x.pick === undefined ? bb : `<div class="ob_prow${x.mine ? ' me' : ''}"><span class="ob_pck${x.pick ? ' on' : ''}">${x.pick ? ic('chk', 13, '#fff', 3) : ''}</span>${bb}</div>`}${x.mine && x.time ? `<div class="ob_rd">${x.unread ? `<b>${x.unread}</b> · ` : ''}<span class="cg_num">${esc(x.time)}</span></div>` : ''}${x.dots && o.swipe ? dots(o.swipe) : ''}`; };
    // 받아 둔 답장 창 (시안 docs/mockups/phone2-edit sheetGlass2 "G3 + 말풍선"): 옅은 유리 창, 답장마다 번호 + 유리 말풍선, 지금 것은 번호가 검정이고 말풍선이 더 밝아요. 창 안에서 굴리고 제목 · 버튼은 고정
    const L = o.list, sheet = !L ? '' : `<div class="ob_shade ob_shl na_ob_slx"></div><div class="ob_sheet ob_sl" style="--sla:${orbitBg(o.title, o.group)}"><i class="ob_grab"></i><div class="ob_slh"><b>받아 둔 답장</b><span class="cg_num">${L.items.length}</span></div>
        <div class="ob_sls">${L.items.map(x => `<div class="ob_slr na_ob_slr${x.now ? ' now' : ''}" role="button" tabindex="0" data-n="${x.no}"><span class="ob_sln cg_num">${x.no}</span><div class="ob_slb">${x.bubbles.length ? x.bubbles.map(b => `<div class="ob_sll">${esc(b.text)}${b.ko ? `<small>${esc(b.ko)}</small>` : ''}</div>`).join('') : '<div class="ob_sll"><small>오는 중</small></div>'}</div><span class="ob_pck${L.picks.includes(x.no) ? ' on' : ''}">${L.picks.includes(x.no) ? ic('chk', 13, '#fff', 3) : ''}</span></div>`).join('')}</div>
        <div class="ob_bkb"><button type="button" class="ob_bkno na_ob_slkeep"${L.busy || L.items.length < 2 ? ' disabled' : ''}>지금 것만 남기기</button><button type="button" class="ob_bkok na_ob_sldrop"${L.busy || !L.picks.length ? ' disabled' : ''}>${L.picks.length ? `${L.picks.length}개 ` : ''}버리기</button></div></div>`;
    const holding = o.msgs.some(x => x.held);
    return `<div class="ob_bg"><span class="ob_blob" style="background:${orbitBg(o.title, o.group)}"></span></div>${axBar(p, o.clock || now, '#fff')}
      <div class="ob_ct ob_glass"><button type="button" class="ob_gb" data-go="orbit" aria-label="뒤로">${ic('back', 21, '#1b1d24', 2.2)}</button>${o.faceOf ? `<button type="button" class="ob_fb na_ob_face" data-n="${esc(o.faceOf)}" aria-label="프사 바꾸기">${face(o.title, 40, o.group)}</button>` : face(o.title, 40, o.group)}<span class="ob_nm"><b>${esc(o.title)}</b>${o.sub ? `<span>${esc(o.sub)}</span>` : ''}</span></div>
      ${o.chips.length ? `<div class="ob_chips">${o.chips.map(c => `<span class="ob_chip">${ic(c.icon, 13, '#fff')}${esc(c.text)}</span>`).join('')}</div>` : ''}
      <div class="ob_msgs ax_scroll${o.asOwner ? ' ro' : ''}${holding ? ' hold na_ob_hold' : ''}${o.picking != null ? ' picking' : ''}"><div class="ob_mi">${o.msgs.map(msg).join('')}${o.snapBusy ? '<div class="ob_fail ob_note"><span>이야기 정리 중</span></div>' : o.typing ? '<div class="ob_typ ob_glass" aria-label="입력 중"><i></i><i></i><i></i></div>' : ''}${o.fail ? `<div class="ob_fail"><span>답장을 못 받았어요</span><button type="button" class="ob_retry na_ob_retry" data-id="${esc(o.fail.id)}">다시</button></div>` : ''}</div></div>
      ${o.asOwner ? '' : o.picking != null ? `<div class="ob_inp ob_pbar"><span>${o.picking}개 선택</span><span class="ob_pbtn"><button type="button" class="na_ob_ptr"${o.picking ? '' : ' disabled'}>재번역</button><button type="button" class="na_ob_pdel red"${o.picking ? '' : ' disabled'}>삭제</button><button type="button" class="na_ob_pquit">취소</button></span></div>`
        : `<div class="ob_inp ob_glass"><div class="ob_msgin na_ob_in" contenteditable="true" role="textbox" enterkeyhint="send" spellcheck="false" data-ph="메시지" aria-label="메시지">${esc(o.draft || '')}</div><button type="button" class="ob_send na_ob_send" aria-label="보내기">${ic('send', 18, '#fff', 2.3)}</button></div>`}
      ${sheet}
      ${axInd('#fff')}`;
}

// 새 대화 (시안 A): 사람 고르기, 둘 이상이면 단체방 이름
// o: { people: [{ name, sub }], picked: [name], gname, imp: { messages } (맨 위 채팅 가져오기 줄) }
export function orbitNew(p, now, o) {
    const on = n => o.picked.some(x => x.toLowerCase() === n.toLowerCase()), n = o.picked.length;
    return `${axBar(p, o.clock || now)}
      <div class="ob_top"><button type="button" class="ob_cb" data-go="orbit" aria-label="뒤로">${ic('back', 20)}</button><b class="ob_h1">새 대화</b><span class="ob_cb0"></span></div>
      <div class="ob_scroll ax_scroll">
        ${n ? `<div class="ob_picked">${o.picked.map(x => `<span class="ob_pk na_ob_pick" role="button" tabindex="0" data-n="${esc(x)}">${face(x, 52)}<span class="ob_x">${ic('x', 11, '#fff', 3)}</span>${esc(x)}</span>`).join('')}</div>` : ''}
        ${n > 1 ? `<div class="ob_gname"><span class="ob_blob" style="background:${orbitBg('', true)}"></span><span class="ob_gl"></span><div class="ob_in0"><small>단체방 이름</small><div class="ob_gin na_ob_gname" contenteditable="true" role="textbox" enterkeyhint="done" spellcheck="false" data-ph="${esc(o.picked.join(', '))}">${esc(o.gname || '')}</div></div></div>` : ''}
        ${o.imp ? `<div class="ob_list ob_impl"><div class="ob_rm" role="button" tabindex="0" data-go="liveimport"><span class="ls_ic chat">${ic('chat', 18, '#3d7a4a')}</span><span class="ob_t"><b>채팅 가져오기</b>${o.imp.messages ? `<span class="ob_p">새 메시지 ${o.imp.messages}개</span>` : ''}</span>${ic('chev', 16, '#bfc2c7', 2.2)}</div></div>` : ''}
        <div class="ob_sec">사람</div>
        <div class="ob_list">${o.people.map(x => `<div class="ob_rm na_ob_pick" role="button" tabindex="0" data-n="${esc(x.name)}">${face(x.name, 46)}<span class="ob_t"><b>${esc(x.name)}</b>${x.sub ? `<span class="ob_p">${esc(x.sub)}</span>` : ''}</span><span class="ob_ck${on(x.name) ? ' on' : ''}">${on(x.name) ? ic('chk', 15, '#fff', 3) : ''}</span></div>`).join('')}</div>
        <i class="ob_pad"></i>
      </div>
      ${n ? `<button type="button" class="ob_go na_ob_make">${n > 1 ? `단체방 만들기 <em>· 나 포함 ${n + 1}명</em>` : '대화하기'}</button>` : ''}
      ${axInd()}`;
}

// 실시간 폰 시작 (시안 docs/mockups/phone2-start C): 노을 카드(나 · 지금 시각 · 날짜 · 현실과의 차이), 고르기 줄, 검정 알약.
// 줄(시안 docs/mockups/phone2-import S1): 이야기에서 시작(타임라인 폰이 있을 때만) · 이 채팅에서 가져오기 · 파일에서 가져오기.
// o: { persona, local, date, shift, upto (이야기 줄의 글; null이면 이야기 줄 없음), pick: 'story' | 'chat' | 'file' | '',
//      chat: { messages, bubbles, again }, file: { names, messages, bubbles } | null, back (뒤로 갈 곳), title, busy }
export function liveStart(p, now, o) {
    const row = (k, tint, off, title, sub) => { const on = o.pick === k && !off; return `<div class="ob_rm ls_opt na_ls_pick${on ? ' on' : ''}${off ? ' off' : ''}" role="button" tabindex="0" data-v="${k}"><span class="ls_ic ${k}">${ic({ story: 'book', chat: 'chat', file: 'file' }[k], 18, tint)}</span><span class="ob_t"><b>${esc(title)}</b>${sub ? `<span class="ob_p">${esc(sub)}</span>` : ''}</span><span class="ob_ck${on ? ' on' : ''}">${on ? ic('chk', 14, '#fff', 3) : ''}</span></div>`; };
    const c = o.chat || { messages: 0, bubbles: 0 }, f = o.file, n = x => `메시지 ${x.messages}개 · 말풍선 ${x.bubbles}개`;
    return `${axBar(p, now)}
      <div class="ob_top"><button type="button" class="ob_cb" data-go="${esc(o.back || 'set')}" aria-label="뒤로">${ic('back', 20)}</button><b class="ob_h1">${esc(o.title || '실시간')}</b><span class="ob_cb0"></span></div>
      <div class="ob_scroll ax_scroll">
        <div class="ob_hero ls_hero"><span class="ob_blob ls_bg"></span><span class="ob_gl"></span><div class="ob_in"><small>${esc(o.persona)} 지금</small><div class="ob_big cg_num">${esc(o.local)}<em>${esc(o.date)}</em></div>${o.shift ? `<span class="ls_pill">${esc(o.shift)}</span>` : ''}</div></div>
        <div class="ob_list">${o.upto == null ? '' : row('story', '#2c4a80', false, '이야기에서 시작', o.upto)}${row('chat', '#3d7a4a', !c.messages, '이 채팅에서 가져오기', c.messages ? (c.again ? `새 ${n(c)}` : n(c)) : c.again ? '새 메시지 없음' : '')}${row('file', '#8a6a2a', false, '파일에서 가져오기', f ? `${f.names.length ? `${f.names.join(', ')} · ` : ''}${f.again ? '새 ' : ''}${n(f)}` : '.jsonl')}</div>
        <i class="ob_pad"></i>
      </div>
      <button type="button" class="ob_go na_ob_start"${o.busy || !o.pick ? ' disabled' : ''}>${o.busy ? esc(o.busy) : o.pick === 'story' || !o.pick && o.upto != null ? '시작' : '가져오기'}</button>
      ${axInd()}`;
}

// 폰도 인물도 없는 채팅의 첫 화면 (시안 docs/mockups/phone2-import R3, 타일은 G5 장미 · 복숭아 그라데이션: 번지는 공이 티 나지 않게, 그림 없이): 큰 제목, 밑줄 이름 칸, 검정 알약,
// 그 아래 작은 "메신저 채팅 가져오기". o: { name (적던 이름), tint (타일 색 번호), live (실시간 폰이 이미 있음: 가져오기 대신 그리로) }
// 타일 색 다섯 (시안 sheetTile G1~G5: 산호 · 초록 살구 · 물빛 · 호박 · 장미 복숭아). 폰을 열 때마다 하나를 골라요(o.tint)
const WH_TINT = [['#ee9184', '#f6c0a7'], ['#8ecf98', '#e6d29a'], ['#7fc4d4', '#abdcd4'], ['#e3b278', '#f2d1a3'], ['#f2a6b5', '#f6c2a8']];
export function whoScreen(now, o = {}) {
    const t = Math.abs(Math.trunc(Number(o.tint) || 0)) % WH_TINT.length;
    return `${axBar({}, now)}
      <div class="wh_body"><span class="wh_ic" style="--wa:${WH_TINT[t][0]};--wb:${WH_TINT[t][1]}"></span><b class="wh_h">누구의<br>폰인가요</b>
        <div class="wh_in na_who_in" contenteditable="true" role="textbox" enterkeyhint="done" spellcheck="false" data-ph="인물 이름" aria-label="인물 이름">${esc(o.name || '')}</div></div>
      <button type="button" class="ob_go wh_go na_who_ok">폰 보기</button>
      ${o.live ? `<button type="button" class="wh_imp na_ph_pmode" data-v="live">${ic('chat', 15, '#5b6170')}실시간 폰으로</button>` : `<button type="button" class="wh_imp" data-go="livestart">${ic('chat', 15, '#5b6170')}메신저 채팅 가져오기</button>`}
      ${axInd()}`;
}
