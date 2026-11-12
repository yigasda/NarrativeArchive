// Orbit 앱 아이콘 시안 2차 A~D: 실제 앱 아이콘처럼 — 또렷한 벡터, 매끈한 그라데이션 판, 크고 굵은 흰 마크(판의 60% 안팎)
// 판 크기 · 둥글기는 홈 아이콘과 같아요(62px · 18px). 모양은 Orbit만의 것(고리 · 궤도 · 말풍선)
const T = 64, R = 18.6;   // 64 판, 둥글기 18/62
const tile = (id, fill, mark, defs = '') => `<svg viewBox="0 0 ${T} ${T}" width="100%" height="100%"><defs>${defs}
  <linearGradient id="${id}_hl" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".22"/><stop offset=".5" stop-color="#fff" stop-opacity="0"/></linearGradient>
  <clipPath id="${id}_c"><rect width="${T}" height="${T}" rx="${R}"/></clipPath></defs>
  <g clip-path="url(#${id}_c)"><rect width="${T}" height="${T}" fill="${fill}"/>${mark}<rect width="${T}" height="${T}" fill="url(#${id}_hl)"/></g></svg>`;
const ORBIT = {
  // C1. 진주: 흰 진주빛 판 + 먼지 낀 파랑 · 라벤더 · 장미 고리, 차분한 초록 점
  A: tile('a', 'url(#a_bg)', `
    <circle cx="32" cy="32" r="22" fill="url(#a_glow)"/>
    <mask id="a_m"><rect width="64" height="64" fill="#fff"/><circle cx="44.7" cy="19.3" r="8.8" fill="#000"/></mask>
    <circle cx="32" cy="32" r="16.5" fill="none" stroke="url(#a_ring)" stroke-width="6.2" mask="url(#a_m)"/>
    <circle cx="44.7" cy="19.3" r="5.2" fill="#58c79c"/>`,
    `<linearGradient id="a_bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fbfbfd"/><stop offset="1" stop-color="#e6e8f0"/></linearGradient><radialGradient id="a_glow"><stop offset="0" stop-color="#a9b4ea" stop-opacity=".35"/><stop offset="1" stop-color="#a9b4ea" stop-opacity="0"/></radialGradient>
     <linearGradient id="a_ring" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stop-color="#7f9be0"/><stop offset=".55" stop-color="#a596dc"/><stop offset="1" stop-color="#df9fbf"/></linearGradient>`),
  // C2. 라벤더 블루: 먼지 낀 파랑 → 라벤더 판 + 흰 고리, 민트 점
  B: tile('b', 'url(#b_bg)', `
    <circle cx="32" cy="32" r="22" fill="url(#b_glow)"/>
    <mask id="b_m"><rect width="64" height="64" fill="#fff"/><circle cx="44.7" cy="19.3" r="8.8" fill="#000"/></mask>
    <circle cx="32" cy="32" r="16.5" fill="none" stroke="#fff" stroke-width="6.2" mask="url(#b_m)"/>
    <circle cx="44.7" cy="19.3" r="5.2" fill="#8fe0bf"/>`,
    `<linearGradient id="b_bg" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stop-color="#8da2df"/><stop offset=".6" stop-color="#ab9fdc"/><stop offset="1" stop-color="#d3a9cf"/></linearGradient><radialGradient id="b_glow"><stop offset="0" stop-color="#ffffff" stop-opacity=".18"/><stop offset="1" stop-color="#ffffff" stop-opacity="0"/></radialGradient>`),
  // C3. 안개 파랑: 아주 옅은 하늘빛 판 + 짙은 남보라 고리(앱 파랑 계열), 초록 점
  C: tile('c', 'url(#c_bg)', `
    <circle cx="32" cy="32" r="22" fill="url(#c_glow)"/>
    <mask id="c_m"><rect width="64" height="64" fill="#fff"/><circle cx="44.7" cy="19.3" r="8.8" fill="#000"/></mask>
    <circle cx="32" cy="32" r="16.5" fill="none" stroke="url(#c_ring)" stroke-width="6.2" mask="url(#c_m)"/>
    <circle cx="44.7" cy="19.3" r="5.2" fill="#4fbf92"/>`,
    `<linearGradient id="c_bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#eef2fb"/><stop offset="1" stop-color="#d5ddf2"/></linearGradient><radialGradient id="c_glow"><stop offset="0" stop-color="#8ea3e6" stop-opacity=".3"/><stop offset="1" stop-color="#8ea3e6" stop-opacity="0"/></radialGradient>
     <linearGradient id="c_ring" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stop-color="#3f5fb0"/><stop offset=".6" stop-color="#6b68c4"/><stop offset="1" stop-color="#a07ac8"/></linearGradient>`),
  // C4. 노을 안개: 복숭아 → 장미 → 라벤더 옅은 판 + 흰 고리, 흰 테두리 초록 점
  D: tile('d', 'url(#d_bg)', `
    <circle cx="32" cy="32" r="22" fill="url(#d_glow)"/>
    <mask id="d_m"><rect width="64" height="64" fill="#fff"/><circle cx="44.7" cy="19.3" r="8.8" fill="#000"/></mask>
    <circle cx="32" cy="32" r="16.5" fill="none" stroke="#fff" stroke-width="6.2" mask="url(#d_m)"/>
    <circle cx="44.7" cy="19.3" r="5.2" fill="#5fcf9f"/>`,
    `<linearGradient id="d_bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f3c3a6"/><stop offset=".5" stop-color="#e8a7b8"/><stop offset="1" stop-color="#b5a3dd"/></linearGradient><radialGradient id="d_glow"><stop offset="0" stop-color="#ffffff" stop-opacity=".2"/><stop offset="1" stop-color="#ffffff" stop-opacity="0"/></radialGradient>`),
};
const CSS = `
.ob_ic{position:relative;width:62px;height:62px;border-radius:18px;flex:none;display:block;box-shadow:0 1px 1px rgba(40,50,70,.1),0 8px 20px rgba(40,50,70,.2)}
.ob_ic svg{display:block;border-radius:inherit}
`;
// (each icon's ids are made unique per use, so several copies on one page don't share masks)
let n = 0;
const orbitIcon = (v, size = 62) => { const k = `u${n++}`; return `<span class="ob_ic" style="width:${size}px;height:${size}px;border-radius:${size * 18 / 62}px">${ORBIT[v].replace(/\b([abcd])_(\w+)/g, `$1${k}_$2`)}</span>`; };
if (typeof module !== 'undefined') module.exports = { ORBIT, CSS, orbitIcon };
