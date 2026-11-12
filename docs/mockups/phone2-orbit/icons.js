// Orbit 앱 아이콘 시안 A~D: 홈 아이콘과 같은 62px 둥근 네모(18px), 안은 Orbit만의 그라데이션 + 흰 마크
const GRAIN = `<svg class="ob_gr" width="100%" height="100%"><filter id="obn"><feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" stitchTiles="stitch"/><feColorMatrix values="0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 .5 0"/></filter><rect width="100%" height="100%" filter="url(#obn)"/></svg>`;
const ORBIT = {
  // A. 오로라: 파랑 · 라벤더 · 분홍이 번진 바탕 + 흰 행성과 기울어진 고리
  A: { bg: 'radial-gradient(60% 60% at 25% 25%,#7f9cf0 0,transparent 70%),radial-gradient(60% 60% at 80% 75%,#f0a5c8 0,transparent 70%),radial-gradient(55% 55% at 80% 20%,#b9a6f3 0,transparent 70%),#a7a4ee',
       mark: `<svg viewBox="0 0 64 64" width="100%" height="100%"><defs><mask id="oa"><rect width="64" height="64" fill="#fff"/><path d="M5 32A27 10 0 0 0 59 32" transform="rotate(-24 32 32)" fill="none" stroke="#000" stroke-width="6.5"/></mask></defs><g transform="rotate(-24 32 32)"><path d="M5 32A27 10 0 0 1 59 32" fill="none" stroke="#fff" stroke-width="3.6" stroke-linecap="round"/></g><circle cx="32" cy="31" r="14" fill="#fff" mask="url(#oa)"/><g transform="rotate(-24 32 32)"><path d="M5 32A27 10 0 0 0 59 32" fill="none" stroke="#fff" stroke-width="3.6" stroke-linecap="round"/></g></svg>` },
  // B. 산호 노을: 산호 · 복숭아 · 자두 바탕 + 둥근 말풍선 O, 그 둘레를 도는 작은 점
  B: { bg: 'radial-gradient(60% 60% at 25% 70%,#ee6f63 0,transparent 70%),radial-gradient(60% 60% at 75% 25%,#f8b98f 0,transparent 70%),radial-gradient(55% 55% at 85% 85%,#c77bbf 0,transparent 70%),#ef8e7e',
       mark: `<svg viewBox="0 0 64 64" width="100%" height="100%"><path d="M32 15a17 17 0 1 1-9.8 30.9L14.5 48l2.3-7.3A17 17 0 0 1 32 15z" fill="none" stroke="#fff" stroke-width="5" stroke-linejoin="round"/><circle cx="48.5" cy="15.5" r="4.6" fill="#fff"/></svg>` },
  // C. 밤 유리: 먹색 바탕에 보라 · 파랑 빛이 번짐 + 빛나는 고리와 점(실시간 폰 노치와 같은 초록 점)
  C: { bg: 'radial-gradient(55% 55% at 30% 75%,#5b4fd6 0,transparent 70%),radial-gradient(50% 50% at 78% 22%,#3f86d8 0,transparent 70%),#17182a',
       mark: `<svg viewBox="0 0 64 64" width="100%" height="100%"><defs><linearGradient id="oc" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#bfe3ff"/><stop offset=".5" stop-color="#ffffff"/><stop offset="1" stop-color="#e5c8ff"/></linearGradient><filter id="ocg" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="2.2"/></filter></defs><ellipse cx="32" cy="32" rx="21" ry="21" fill="none" stroke="url(#oc)" stroke-width="5.5" filter="url(#ocg)" opacity=".7"/><ellipse cx="32" cy="32" rx="21" ry="21" fill="none" stroke="url(#oc)" stroke-width="4.2"/><circle cx="46.8" cy="17.2" r="5.4" fill="#3ddc97" stroke="#17182a" stroke-width="2.4"/></svg>` },
  // D. 초록 햇살: 초록 · 연두 · 살구 바탕 + 둘이 겹친 흰 원(두 사람)과 그 둘을 감싼 궤도
  D: { bg: 'radial-gradient(60% 60% at 25% 75%,#4fb57a 0,transparent 70%),radial-gradient(60% 60% at 80% 25%,#f3c07c 0,transparent 70%),radial-gradient(50% 50% at 85% 80%,#d3e48a 0,transparent 70%),#86c98c',
       mark: `<svg viewBox="0 0 64 64" width="100%" height="100%"><ellipse cx="32" cy="32" rx="26" ry="12" transform="rotate(-18 32 32)" fill="none" stroke="#fff" stroke-width="2.6" opacity=".85"/><circle cx="26" cy="33" r="9" fill="#fff"/><circle cx="39" cy="30" r="9" fill="#fff" fill-opacity=".72"/></svg>` },
};
const CSS = `
.ob_ic{position:relative;overflow:hidden;width:62px;height:62px;border-radius:18px;flex:none;display:block;box-shadow:inset 0 1.5px 1px rgba(255,255,255,.55),inset 0 -3px 6px rgba(20,20,40,.18),0 1px 1px rgba(40,50,70,.08),0 8px 20px rgba(40,50,70,.18)}
.ob_ic .ob_bg{position:absolute;inset:-25%;filter:blur(7px)}
.ob_ic .ob_gr{position:absolute;inset:0;opacity:.18;mix-blend-mode:overlay}
.ob_ic .ob_sh{position:absolute;inset:0;background:linear-gradient(180deg,rgba(255,255,255,.28),rgba(255,255,255,0) 45%)}
.ob_ic .ob_mk{position:absolute;inset:8px;filter:drop-shadow(0 1px 1.5px rgba(30,30,60,.22))}
`;
const orbitIcon = (v, size = 62) => `<span class="ob_ic" style="width:${size}px;height:${size}px;border-radius:${size * 18 / 62}px"><span class="ob_bg" style="background:${ORBIT[v].bg}"></span>${GRAIN}<span class="ob_sh"></span><span class="ob_mk" style="inset:${size * 8 / 62}px">${ORBIT[v].mark}</span></span>`;
if (typeof module !== 'undefined') module.exports = { ORBIT, CSS, orbitIcon };
