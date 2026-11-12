// Orbit 앱 아이콘 시안 2차 A~D: 실제 앱 아이콘처럼 — 또렷한 벡터, 매끈한 그라데이션 판, 크고 굵은 흰 마크(판의 60% 안팎)
// 판 크기 · 둥글기는 홈 아이콘과 같아요(62px · 18px). 모양은 Orbit만의 것(고리 · 궤도 · 말풍선)
const T = 64, R = 18.6;   // 64 판, 둥글기 18/62
const tile = (id, fill, mark, defs = '') => `<svg viewBox="0 0 ${T} ${T}" width="100%" height="100%"><defs>${defs}
  <linearGradient id="${id}_hl" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".22"/><stop offset=".5" stop-color="#fff" stop-opacity="0"/></linearGradient>
  <clipPath id="${id}_c"><rect width="${T}" height="${T}" rx="${R}"/></clipPath></defs>
  <g clip-path="url(#${id}_c)"><rect width="${T}" height="${T}" fill="${fill}"/>${mark}<rect width="${T}" height="${T}" fill="url(#${id}_hl)"/></g></svg>`;
const ORBIT = {
  // A. 고리가 지나가는 말풍선: 흰 말풍선을 기울어진 궤도가 꿰뚫어요(말풍선 안에선 판 색으로 비치고, 밖에선 흰 선)
  A: tile('a', 'url(#a_bg)', `
    <mask id="a_m"><rect width="64" height="64" fill="#fff"/><ellipse cx="32" cy="31" rx="27" ry="8.6" transform="rotate(-22 32 31)" fill="none" stroke="#000" stroke-width="3.4"/></mask>
    <mask id="a_o"><rect width="64" height="64" fill="#fff"/><path d="M32 12.5a18.5 18.5 0 1 1-10.6 33.7l-8 2.3 2.6-7.6A18.5 18.5 0 0 1 32 12.5z" fill="#000"/></mask>
    <path d="M32 12.5a18.5 18.5 0 1 1-10.6 33.7l-8 2.3 2.6-7.6A18.5 18.5 0 0 1 32 12.5z" fill="#fff" mask="url(#a_m)"/>
    <ellipse cx="32" cy="31" rx="27" ry="8.6" transform="rotate(-22 32 31)" fill="none" stroke="#fff" stroke-width="3.4" mask="url(#a_o)"/>`,
    `<linearGradient id="a_bg" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stop-color="#4f6bff"/><stop offset=".55" stop-color="#8a5cff"/><stop offset="1" stop-color="#ff7ac6"/></linearGradient>`),
  // B. 달이 도는 O: 굵은 흰 고리 + 고리 위를 도는 흰 달(달 둘레는 고리가 끊겨요)
  B: tile('b', 'url(#b_bg)', `
    <mask id="b_m"><rect width="64" height="64" fill="#fff"/><circle cx="44.7" cy="19.3" r="9.4" fill="#000"/></mask>
    <circle cx="32" cy="32" r="16.5" fill="none" stroke="#fff" stroke-width="6.6" mask="url(#b_m)"/>
    <circle cx="44.7" cy="19.3" r="5.6" fill="#fff"/>`,
    `<linearGradient id="b_bg" x1="0" y1="0" x2=".35" y2="1"><stop offset="0" stop-color="#ffb35c"/><stop offset=".5" stop-color="#ff5f6d"/><stop offset="1" stop-color="#c2378f"/></linearGradient>`),
  // C. 밤의 궤도: 먹색 판 + 무지갯빛 굵은 고리, 실시간 폰 노치의 초록 점
  C: tile('c', 'url(#c_bg)', `
    <circle cx="32" cy="32" r="22" fill="url(#c_glow)"/>
    <mask id="c_m"><rect width="64" height="64" fill="#fff"/><circle cx="44.7" cy="19.3" r="8.8" fill="#000"/></mask>
    <circle cx="32" cy="32" r="16.5" fill="none" stroke="url(#c_ring)" stroke-width="6.2" mask="url(#c_m)"/>
    <circle cx="44.7" cy="19.3" r="5.2" fill="#3ddc97"/>`,
    `<linearGradient id="c_bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#23264a"/><stop offset="1" stop-color="#0c0d1c"/></linearGradient>
     <radialGradient id="c_glow"><stop offset="0" stop-color="#6d5cff" stop-opacity=".45"/><stop offset="1" stop-color="#6d5cff" stop-opacity="0"/></radialGradient>
     <linearGradient id="c_ring" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stop-color="#5ee7ff"/><stop offset=".5" stop-color="#8f7dff"/><stop offset="1" stop-color="#ff8ad8"/></linearGradient>`),
  // D. 궤도 위의 점 세 개: 흰 말풍선 안에 입력 중 점 셋이 곡선 궤도를 따라 놓여요(판 색 점)
  D: tile('d', 'url(#d_bg)', `
    <path d="M32 13a18.5 18.5 0 1 1-10.6 33.7l-8 2.3 2.6-7.6A18.5 18.5 0 0 1 32 13z" fill="#fff"/>
    <circle cx="23" cy="34.2" r="3.4" fill="url(#d_dot)"/><circle cx="32" cy="30.6" r="3.4" fill="url(#d_dot)"/><circle cx="41" cy="27" r="3.4" fill="url(#d_dot)"/>`,
    `<linearGradient id="d_bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#3be2b0"/><stop offset="1" stop-color="#1b8fe6"/></linearGradient>
     <linearGradient id="d_dot" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#20c79a"/><stop offset="1" stop-color="#1b8fe6"/></linearGradient>`),
};
const CSS = `
.ob_ic{position:relative;width:62px;height:62px;border-radius:18px;flex:none;display:block;box-shadow:0 1px 1px rgba(40,50,70,.1),0 8px 20px rgba(40,50,70,.2)}
.ob_ic svg{display:block;border-radius:inherit}
`;
// (each icon's ids are made unique per use, so several copies on one page don't share masks)
let n = 0;
const orbitIcon = (v, size = 62) => { const k = `u${n++}`; return `<span class="ob_ic" style="width:${size}px;height:${size}px;border-radius:${size * 18 / 62}px">${ORBIT[v].replace(/\b([abcd])_(\w+)/g, `$1${k}_$2`)}</span>`; };
if (typeof module !== 'undefined') module.exports = { ORBIT, CSS, orbitIcon };
