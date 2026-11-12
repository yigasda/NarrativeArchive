// Orbit: 실시간 폰(폰 2)의 메신저 화면 (docs/design/orbit.md, 시안 docs/mockups/phone2-messenger · phone2-orbit).
// 목록 · 새 대화는 흰 카드 + 검정 알약(시안 A), 방 안은 그 사람 색 오로라 바탕 + 유리(시안 C).
// 화면만 그려요: 폰 2를 읽는 건 phone.js가 하고, 이 파일은 그 결과(ui.orbit)만 받아요(폰 2 파일을 부르지 않아요).
// 설명 글은 쓰지 않아요(몰입이 깨져요). 화면에 나오는 건 이름 · 말 · 시각 · 상태 낱말뿐이에요.
import { esc } from './util.js';
import { axBar, axInd } from './phoneapps.js';

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
    back: 'M15 5l-7 7 7 7', plus: 'M12 5v14M5 12h14', send: 'M5 12h13M13 6l6 6-6 6', srch: 'M11 5a6 6 0 1 0 0 12 6 6 0 0 0 0-12zM20 20l-4.3-4.3', pen: 'M4 20h4L19 9l-4-4L4 16z',
    clock: 'M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16zM12 8v4l3 2', chk: 'M4 12.5l4.5 4.5L20 6', x: 'M6 6l12 12M18 6L6 18',
    tr: 'M4 6h8M8 4v2c0 4-2 7-5 8M6 10c1.5 2 3.5 3.5 6 4M13 20l4-9 4 9M14.5 17h5', moon: 'M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z',
    sun: 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4',
    set: 'M7 15a5 5 0 0 1 10 0M3 15h2M19 15h2M5.6 9.6l1.4 1.4M18.4 9.6 17 11M12 6v2M4 19h16',
};
const ic = (k, s = 20, c = 'currentColor', w = 2) => `<svg aria-hidden="true" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"><path d="${I[k]}"/></svg>`;
// 그 사람 현지 시각의 아이콘: 05~17 해 · 17~21 저녁 · 21~05 달 (날씨 하늘과 같은 경계)
export const dayIcon = hhmm => { const h = Number(String(hhmm || '').slice(0, 2)); return h >= 5 && h < 17 ? 'sun' : h >= 17 && h < 21 ? 'set' : 'moon'; };

// 얼굴: 그 사람 색 동그라미 + 첫 글자
const face = (name, s = 48, group = false) => `<span class="ob_face" style="width:${s}px;height:${s}px;font-size:${Math.round(s * 0.38)}px"><span class="ob_blob" style="background:${orbitBg(name, group)}"></span><b>${esc([...String(name || '?')][0] || '?')}</b></span>`;

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
    return `<svg aria-hidden="true" viewBox="0 0 64 64" width="62" height="62"><defs><linearGradient id="obi_bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f3c3a6"/><stop offset=".5" stop-color="#e8a7b8"/><stop offset="1" stop-color="#b5a3dd"/></linearGradient>`
        + `<linearGradient id="obi_hl" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".22"/><stop offset=".5" stop-color="#fff" stop-opacity="0"/></linearGradient>`
        + `<radialGradient id="obi_gl"><stop offset="0" stop-color="#fff" stop-opacity=".85"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>`
        + `<filter id="obi_sh" x="-30%" y="-30%" width="160%" height="160%"><feDropShadow dx="0" dy="1.6" stdDeviation="1.6" flood-color="#7a4a6a" flood-opacity=".28"/></filter>`
        + `<clipPath id="obi_c"><rect width="64" height="64" rx="18.6"/></clipPath></defs><g clip-path="url(#obi_c)"><rect width="64" height="64" fill="url(#obi_bg)"/>`
        + `<g filter="url(#obi_sh)">${tail}<circle cx="${dx}" cy="${dy}" r="${(9 * k).toFixed(2)}" fill="url(#obi_gl)"/><circle cx="${dx}" cy="${dy}" r="${(5 * k).toFixed(2)}" fill="#fff"/></g>`
        + `<rect width="64" height="64" fill="url(#obi_hl)"/></g></svg>`;
})();
// 홈 1쪽의 아홉째 칸(실시간 폰에서만 phone.js가 넘겨요)
export const orbitHomeCell = (unread = 0) => `<div class="cg_cell"><button type="button" class="cg_ic ob_ic" data-go="orbit" aria-label="Orbit">${ICON}${unread ? `<span class="cg_badge cg_num">${unread}</span>` : ''}</button><span class="cg_lbl">Orbit</span></div>`;

const dots = lit => Array.from({ length: 24 }, (_, h) => `<i class="${h === lit ? 'h' : h < lit ? 'p' : ''}" style="height:${h < lit ? [9, 15, 22, 15][h % 4] : 4}px"></i>`).join('');

// 방 목록 (시안 A): 맨 위 "지금 그 사람" 카드, 1:1 · 단체 고르기, 흰 목록, 아래 새 대화
// o: { tab, hero: { name, city, local } | null, rooms: [{ id, title, group, last, lastWho, time, unread, typing }] }
export function orbitList(p, now, o) {
    const tab = o.tab || 'all', rooms = o.rooms.filter(r => tab === 'all' || (tab === 'group') === r.group);
    const h = o.hero, lit = h ? Number(String(h.local).slice(0, 2)) : -1;
    return `${axBar(p, now)}
      <div class="ob_top"><span class="ob_cb" role="button" tabindex="0" data-go="home" aria-label="홈">${ic('back', 20)}</span><b class="ob_h1">메시지</b><span class="ob_cb" role="button" tabindex="0" data-go="orbitnew" aria-label="새 대화">${ic('pen', 19)}</span></div>
      <div class="ob_scroll ax_scroll">
        <div class="ob_seg">${[['all', '전체'], ['one', '1:1'], ['group', '단체']].map(([k, t]) => `<span role="button" tabindex="0" class="ob_sg na_ob_tab${tab === k ? ' on' : ''}" data-v="${k}">${t}</span>`).join('')}</div>
        ${h ? `<div class="ob_hero"><span class="ob_blob" style="background:${orbitBg(h.name)}"></span><span class="ob_gl"></span><div class="ob_in"><small>${esc(h.name)}${h.city ? ` · ${esc(h.city)}` : ''} 지금</small><div class="ob_big cg_num">${esc(h.local)}</div><div class="ob_dots">${dots(lit)}</div><div class="ob_dl"><span>0시</span><span>12시</span><span>24시</span></div></div></div>` : ''}
        ${rooms.length ? `<div class="ob_list">${rooms.map(r => `<div class="ob_rm" role="button" tabindex="0" data-go="orbitroom" data-i="${esc(r.id)}">${face(r.title, 50, r.group)}<span class="ob_t"><b>${esc(r.title)}</b><span class="ob_p">${r.last ? `${r.lastWho ? `${esc(r.lastWho)}: ` : ''}${esc(r.last)}` : ''}</span></span><span class="ob_r"><span class="cg_num">${esc(r.time || '')}</span>${r.unread ? `<span class="ob_un cg_num">${r.unread}</span>` : '<span class="ob_un0"></span>'}</span></div>`).join('')}</div>` : ''}
        <i class="ob_pad"></i>
      </div>
      <span class="ob_dock" role="button" tabindex="0" data-go="orbitnew">${ic('plus', 16, '#fff', 2.4)}새 대화</span>
      ${axInd()}`;
}

// 방 안 (시안 C): 그 사람 색 바탕, 유리 머리줄 · 말풍선 · 입력칸
// o: { id, title, group, sub, chips: [{ icon, text, go? }], asOwner, msgs: [{ day } | { mine, from, text, ko, time, unread, id, open }], draft }
export function orbitRoom(p, now, o) {
    const msg = x => x.day ? `<div class="ob_day">${esc(x.day)}</div>`
        : `${o.group && !x.mine && x.from ? `<div class="ob_sn">${esc(x.from)}</div>` : ''}<div class="ob_b ${x.mine ? 'me' : 'th ob_glass'}">${esc(x.text)}${x.ko ? (x.open ? `<span class="ob_ko na_ob_ko" role="button" tabindex="0" data-id="${esc(x.id)}">${esc(x.ko)}</span>` : `<span class="ob_kof na_ob_ko" role="button" tabindex="0" data-id="${esc(x.id)}">${ic('tr', 13)}번역 보기</span>`) : ''}</div>${x.mine && x.time ? `<div class="ob_rd">${x.unread ? `<b>${x.unread}</b> · ` : ''}<span class="cg_num">${esc(x.time)}</span></div>` : ''}`;
    return `<div class="ob_bg"><span class="ob_blob" style="background:${orbitBg(o.title, o.group)}"></span></div>${axBar(p, now, '#fff')}
      <div class="ob_ct ob_glass"><span class="ob_gb" role="button" tabindex="0" data-go="orbit" aria-label="뒤로">${ic('back', 21, '#1b1d24', 2.2)}</span>${face(o.title, 40, o.group)}<span class="ob_nm"><b>${esc(o.title)}</b>${o.sub ? `<span>${esc(o.sub)}</span>` : ''}</span></div>
      ${o.chips.length ? `<div class="ob_chips">${o.chips.map(c => `<span class="ob_chip${c.go ? ' na_ob_as' : ''}"${c.go ? ' role="button" tabindex="0"' : ''}>${ic(c.icon, 13, '#fff')}${esc(c.text)}</span>`).join('')}</div>` : ''}
      <div class="ob_msgs ax_scroll${o.asOwner ? ' ro' : ''}"><div class="ob_mi">${o.msgs.map(msg).join('')}</div></div>
      ${o.asOwner ? '' : `<div class="ob_inp ob_glass"><input type="text" class="ax_in ob_in na_ob_in" placeholder="메시지" enterkeyhint="send" value="${esc(o.draft || '')}" aria-label="메시지"><span class="ob_send na_ob_send" role="button" tabindex="0" aria-label="보내기">${ic('send', 18, '#fff', 2.3)}</span></div>`}
      ${axInd('#fff')}`;
}

// 새 대화 (시안 A): 사람 고르기, 둘 이상이면 단체방 이름
// o: { people: [{ name, sub }], picked: [name], gname }
export function orbitNew(p, now, o) {
    const on = n => o.picked.some(x => x.toLowerCase() === n.toLowerCase()), n = o.picked.length;
    return `${axBar(p, now)}
      <div class="ob_top"><span class="ob_cb" role="button" tabindex="0" data-go="orbit" aria-label="뒤로">${ic('back', 20)}</span><b class="ob_h1">새 대화</b><span class="ob_cb0"></span></div>
      <div class="ob_scroll ax_scroll">
        ${n ? `<div class="ob_picked">${o.picked.map(x => `<span class="ob_pk na_ob_pick" role="button" tabindex="0" data-n="${esc(x)}">${face(x, 52)}<span class="ob_x">${ic('x', 11, '#fff', 3)}</span>${esc(x)}</span>`).join('')}</div>` : ''}
        ${n > 1 ? `<div class="ob_gname"><span class="ob_blob" style="background:${orbitBg('', true)}"></span><span class="ob_gl"></span><label class="ob_in"><small>단체방 이름</small><input type="text" class="ax_in ob_gin na_ob_gname" value="${esc(o.gname || '')}" placeholder="${esc(o.picked.join(', '))}" enterkeyhint="done"></label></div>` : ''}
        <div class="ob_sec">사람</div>
        <div class="ob_list">${o.people.map(x => `<div class="ob_rm na_ob_pick" role="button" tabindex="0" data-n="${esc(x.name)}">${face(x.name, 46)}<span class="ob_t"><b>${esc(x.name)}</b>${x.sub ? `<span class="ob_p">${esc(x.sub)}</span>` : ''}</span><span class="ob_ck${on(x.name) ? ' on' : ''}">${on(x.name) ? ic('chk', 15, '#fff', 3) : ''}</span></div>`).join('')}</div>
        <i class="ob_pad"></i>
      </div>
      ${n ? `<span class="ob_go na_ob_make" role="button" tabindex="0">${n > 1 ? `단체방 만들기 <em>· 나 포함 ${n + 1}명</em>` : '대화하기'}</span>` : ''}
      ${axInd()}`;
}
