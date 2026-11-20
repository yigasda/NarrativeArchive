// 껍데기 앱 안의 폰: 기기 바를 투명하게 두고 폰 화면을 그 밑까지 깔 때, 캐릭터 시간(가짜 상단바)을 어떻게 할지 시안.
// 412 × 915(갤럭시) 화면, 상단바 28 · 하단 버튼 줄 48. 기기 바는 그림으로 얹어요.
// A 숨김 · B 얇은 시간 줄 · C 섬 시계 · D 지금 가짜 바 그대로(진짜 바 아래로). node docs/mockups/shell-bars/mock.cjs → <안>_<화면>.png
const { open, SAMPLE_MONEY } = require('../../../tools/dev/probe.cjs');
const fs = require('fs'), path = require('path'), os = require('os');
const CHAT = path.join(os.homedir(), 'sillytavern/data/default-user/chats/default_Seraphina/na_test.jsonl');
const reset = () => fs.copyFileSync(path.join(__dirname, '../../../tools/dev/na_test.jsonl'), CHAT);
const B = '/scripts/extensions/third-party/NarrativeArchive/src/';
const W = 412, H = 915, SB = 28, NB = 48, K = W / 390, sb = (SB / K).toFixed(1), nb = (NB / K).toFixed(1);
const BASE = `.na_phl :is(.na_ph_frame, .na_ph_scr) { border-radius: 0 !important; --axr: 0 !important; }
  .na_phl .na_ph_scr.cg > .cg_canvas { padding-bottom: ${nb}px !important; box-sizing: border-box !important; }
  .na_phl .ax_btab { height: ${(84 + +nb).toFixed(1)}px !important; padding-bottom: ${nb}px !important; }
  .na_phl .ax_ind span, .na_phl .cg_ind span { visibility: hidden !important; }
  .na_phl .ob_top, .na_phl .ob_hd { margin-top: 6px; } .na_phl .ax_orbitroom .ax_canvas { padding-bottom: ${nb}px !important; box-sizing: border-box !important; }`;
const BAR = ':is(.ax_sb, .cg_sb)';
function NOTCH(w) { return `${BASE} .na_phl ${BAR} { height: 47px !important; padding: 2px 30px 0 34px !important; }
  .na_phl .na_ph_notch { top: 0 !important; width: ${w}px !important; height: 31px !important; border-radius: 0 0 21px 21px !important; padding-right: 22px !important; overflow: visible !important; }
  .na_phl .na_ph_notch i { width: 5px !important; height: 5px !important; }
  .na_phl .na_ph_notch::before, .na_phl .na_ph_notch::after { content: ''; position: absolute; top: 0; width: 8px; height: 8px; }
  .na_phl .na_ph_notch::before { left: -8px; background: radial-gradient(circle at 0 100%, transparent 7.5px, #000 8px); }
  .na_phl .na_ph_notch::after { right: -8px; background: radial-gradient(circle at 100% 100%, transparent 7.5px, #000 8px); }`; }
// 노치를 SVG 한 장으로: 위 양옆은 안으로 휜 어깨(r1), 아래 모서리는 매끄러운 곡선(r2). W 폭 · H 높이(보드 px)
function NSVG(W, H, r2, r1 = 6) { const X = r1, k = 0.45;
  const d = `M0 0H${W + 2 * X}C${W + X + r1 * k} 0 ${W + X} ${r1 * (1 - k)} ${W + X} ${r1}V${H - r2}C${W + X} ${H - r2 * k} ${W + X - r2 * k} ${H} ${W + X - r2} ${H}H${X + r2}C${X + r2 * k} ${H} ${X} ${H - r2 * k} ${X} ${H - r2}V${r1}C${X} ${r1 * (1 - k)} ${X - r1 * k} 0 0 0Z`;
  return `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' width='${W + 2 * X}' height='${H}' viewBox='0 0 ${W + 2 * X} ${H}'><path d='${d}' fill='#000'/></svg>`)}")`; }
function N2(W, H, r2) { return `.na_phl .na_ph_notch { width: ${W + 12}px !important; height: ${H}px !important; border-radius: 0 !important; background: ${NSVG(W, H, r2)} no-repeat !important; padding-right: ${Math.round(W * 0.12) + 6}px !important; }
  .na_phl .na_ph_notch::before, .na_phl .na_ph_notch::after { display: none !important; }`; }
// 하단바 자리에 뿌연 유리 띠 (텔레그램처럼). top: 띠 위로 더 올릴 높이(px), pill: 막대를 띠 맨 위에 그리기
function GL(extra, pill) { const h = `calc(var(--na-nb, 0px) + ${extra}px)`;
  const PILL = `url("data:image/svg+xml,${encodeURIComponent("<svg xmlns='http://www.w3.org/2000/svg' width='142' height='5'><rect width='142' height='5' rx='2.5' fill='rgba(20,22,28,0.8)'/></svg>")}")`;
  // (실리태번 '빠른 UI'가 흐림을 꺼서 흐림 없이도 뿌옇게 보이게: 반투명 흰 막)
  return `.na_phl .na_ph_scr::after { content: ''; position: absolute; left: 0; right: 0; bottom: 0; height: ${h}; z-index: 40; pointer-events: none;
    background: ${pill ? `${PILL} center ${pill}px / 142px 5px no-repeat, ` : ''}linear-gradient(rgba(255,255,255,.5), rgba(255,255,255,.66));
    -webkit-backdrop-filter: blur(18px) saturate(1.6); backdrop-filter: blur(18px) saturate(1.6); box-shadow: inset 0 0.5px 0 rgba(255,255,255,.7), 0 -0.5px 0 rgba(0,0,0,.06); border-radius: 0 !important; }
  ${extra ? `.na_phl .na_ph_scr { --nbk: calc((var(--na-nb, 0px) + ${extra - 8}px) / var(--k, 1)) !important; }` : ''}
  ${pill !== null ? `.na_phl .ax .ax_ind span, .na_phl .cg_ind span { visibility: hidden !important; }` : ''}`; }
// 하단 안개 (텔레그램): 경계선 없이 위는 투명 → 아래로 갈수록 뿌옇게. 띠가 아니라 그라데이션 하나. a: 맨 아래 진하기, up: 버튼 줄 위로 번지는 높이(px)
function MIST(a, up) { return `.na_phl .na_ph_scr > .cg_canvas::after { content: ''; position: absolute; left: 0; right: 0; bottom: 0; height: calc((var(--na-nb, 0px) + ${up}px) / var(--k, 1)); z-index: 3; pointer-events: none;
    background: linear-gradient(rgba(255,255,255,0), rgba(255,255,255,${(a * 0.6).toFixed(2)}) 45%, rgba(255,255,255,${a})); }
  .na_phl .na_ph_scr > .cg_canvas { position: relative; } .na_phl .ax .ob_inp { z-index: 4; }`; }
// Orbit 말풍선 밀도 (텔레그램과 비교): B1 여백 · 간격만 · B2 + 번역 줄 붙이고 시간 말풍선 안 · B3 + 꼬리 · 둥글기 작게 · B4 + 말풍선 덜 비치게
const BUB1 = `.na_phl .ax .ob_mi { gap: 3px !important; } .na_phl .ax .ob_b { padding: 7px 12px !important; border-radius: 18px !important; --axr: 18px !important; }
  .na_phl .ax .ob_b.th { border-bottom-left-radius: 6px !important; } .na_phl .ax .ob_b.me { border-bottom-right-radius: 6px !important; }
  .na_phl .ax :is(.ob_b.th + .ob_b.me, .ob_rd + .ob_b.th, .ob_b.me + .ob_b.th) { margin-top: 7px !important; } .na_phl .ax .ob_rd { margin: 0 6px 0 !important; }`;
const BUB2 = BUB1 + ` .na_phl .ax .ob_ko { margin-top: 2px !important; padding-top: 0 !important; border-top: 0 !important; font-size: 12px !important; }
  .na_phl .ax .ob_b.me { padding-right: 52px !important; } .na_phl .ax .ob_rd { position: relative; z-index: 4; margin: -21px 14px 3px 0 !important; font-size: 10px !important; opacity: .62 !important; }`;
const BUB3 = BUB2 + ` .na_phl .ax .ob_b { position: relative; overflow: visible !important; border-radius: 16px !important; }
  .na_phl .ax .ob_b.th:not(:has(+ .ob_b.th)) { border-bottom-left-radius: 0 !important; } .na_phl .ax .ob_b.me:not(:has(+ .ob_rd + .ob_b.me)) { border-bottom-right-radius: 0 !important; }
  .na_phl .ax .ob_b.th:not(:has(+ .ob_b.th))::after { content: ''; position: absolute; left: -8px; bottom: 0; width: 9px; height: 16px; background: inherit; -webkit-mask: radial-gradient(ellipse 8px 16px at 0 0, transparent 97%, #000 100%); mask: radial-gradient(ellipse 8px 16px at 0 0, transparent 97%, #000 100%); }
  .na_phl .ax .ob_b.me:not(:has(+ .ob_rd + .ob_b.me))::after { content: ''; position: absolute; right: -8px; bottom: 0; width: 9px; height: 16px; background: inherit; -webkit-mask: radial-gradient(ellipse 8px 16px at 100% 0, transparent 97%, #000 100%); mask: radial-gradient(ellipse 8px 16px at 100% 0, transparent 97%, #000 100%); }`;
const BUB4 = BUB3 + ` .na_phl .ax .ob_b.th { background: rgba(255, 255, 255, 0.8) !important; } .na_phl .ax .ob_b.me { background: rgba(20, 22, 30, 0.9) !important; }`;
// B2 바탕 구조 시안: U1 인스타식 묶음 · U2 왓츠앱식 · U3 B2 정리판 (구조는 화면을 그린 뒤 JS로 흉내)
const PILL = ` .na_phl .ax .ob_day { background: rgba(255, 255, 255, 0.62); color: #3a3f48 !important; padding: 3px 11px; border-radius: 999px; text-shadow: none !important; opacity: 1 !important; font-weight: 600; box-shadow: inset 0 1px 0 rgba(255,255,255,.7), 0 2px 8px rgba(40,40,80,.08); margin: 4px 0 8px !important; }`;
const EMO = ` .na_phl .ax .ob_inp { padding-left: 8px !important; } .na_phl .ax .mk_emo { width: 38px; height: 38px; flex: none; display: grid; place-items: center; color: rgba(30,32,40,.55); }`;
const REACT = ` .na_phl .ax .ob_b.mk_hasre { margin-bottom: 13px; position: relative; } .na_phl .ax .mk_re { position: absolute; bottom: -14px; display: inline-flex; gap: 2px; align-items: center; padding: 2px 6px; border-radius: 999px; font-size: 13px; line-height: 18px; background: rgba(255,255,255,.88); box-shadow: 0 2px 8px rgba(40,40,80,.14); color: #333; }
  .na_phl .ax .ob_b.th .mk_re { left: 10px; } .na_phl .ax .ob_b.me .mk_re { right: 10px; } .na_phl .ax .ob_b.me.mk_hasre + .ob_rd { margin-top: -34px !important; margin-bottom: 16px !important; }`;
const U1 = BUB2 + REACT + ` .na_phl .ax .ob_b.th { margin-left: 34px !important; position: relative; }
  .na_phl .ax .ob_b.th:has(+ .ob_b.th) { border-bottom-left-radius: 6px !important; } .na_phl .ax .ob_b.th + .ob_b.th { border-top-left-radius: 6px !important; } .na_phl .ax .ob_b.th:not(:has(+ .ob_b.th)) { border-bottom-left-radius: 18px !important; }
  .na_phl .ax .ob_b.me { padding-right: 12px !important; border-bottom-right-radius: 18px !important; } .na_phl .ax .ob_rd { display: none !important; } .na_phl .ax .ob_rd.mk_last { display: block !important; position: static !important; margin: 3px 6px 0 !important; font-size: 10.5px !important; opacity: .8 !important; }
  .na_phl .ax .mk_av { position: absolute; left: -32px; bottom: 0; width: 26px; height: 26px; border-radius: 50%; overflow: hidden; display: grid; place-items: center; }
  .na_phl .ax .mk_av { color: #fff; font: 700 11px/26px -apple-system, 'Noto Sans KR', sans-serif !important; --axfs: 11px; text-align: center; background: linear-gradient(140deg, #6cc477, #b9cf7c 60%, #e3c37e) !important; box-shadow: 0 2px 6px rgba(40,60,40,.18); }
  .na_phl .ax .mk_sep { align-self: center; font-size: 11px; color: #fff; opacity: .9; margin: 8px 0 4px; text-shadow: 0 1px 6px rgba(40,40,90,.2); }`;
const IGRE = ` .na_phl .ax .ob_b.mk_hasre { margin-bottom: 12px !important; position: relative; } .na_phl .ax .mk_re { position: absolute; bottom: -13px; left: 10px !important; right: auto !important; display: inline-grid; place-items: center; min-width: 26px; height: 22px; padding: 0 5px; box-sizing: border-box; border-radius: 999px; font-size: 12px !important; --axfs: 12px; line-height: 1 !important; background: rgba(244, 245, 247, 0.92); box-shadow: 0 0 0 2.5px rgba(255, 255, 255, 0.85); }`;
const U1B = U1.replace(REACT, '') + IGRE + ` .na_phl .ax .ob_b.th { margin-left: 44px !important; } .na_phl .ax .mk_av { left: -42px !important; width: 34px !important; height: 34px !important; font-size: 14px !important; --axfs: 14px; line-height: 34px !important; }`;
const U2 = BUB2 + PILL + EMO + REACT + ` .na_phl .ax .ob_b.th { position: relative; padding-right: 50px !important; } .na_phl .ax .mk_t { position: absolute; right: 12px; bottom: 7px; font-size: 10px !important; --axfs: 10px; line-height: 1 !important; opacity: .5; }
  .na_phl .ax .ob_b { overflow: visible !important; }
  .na_phl .ax .ob_b.th:not(.ob_b.th + .ob_b.th) { border-top-left-radius: 0 !important; border-bottom-left-radius: 18px !important; } .na_phl .ax .ob_b.th + .ob_b.th { border-bottom-left-radius: 18px !important; }
  .na_phl .ax .ob_b.me:not(.ob_rd + .ob_b.me) { border-top-right-radius: 0 !important; } .na_phl .ax .ob_b.me { border-bottom-right-radius: 18px !important; position: relative; }
  .na_phl .ax .ob_b.th:not(.ob_b.th + .ob_b.th)::before { content: ''; position: absolute; left: -8px; top: 0; width: 9px; height: 12px; background: inherit; clip-path: polygon(0 0, 100% 0, 100% 100%); }
  .na_phl .ax .ob_b.me:not(.ob_rd + .ob_b.me)::before { content: ''; position: absolute; right: -8px; top: 0; width: 9px; height: 12px; background: inherit; clip-path: polygon(0 0, 100% 0, 0 100%); }`;
const U3 = BUB2 + PILL + EMO + REACT;
const SMILE = `<span class="mk_emo"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M8.5 14.5c.9 1.2 2.1 1.8 3.5 1.8s2.6-.6 3.5-1.8"/><circle cx="9" cy="10" r=".6" fill="currentColor"/><circle cx="15" cy="10" r=".6" fill="currentColor"/></svg></span>`;
const JSX = {
  U1: ({ SMILE }) => { const mi = document.querySelector('.na_ph_frame .ob_mi'); const face = document.querySelector('.na_ph_frame .ob_fb');
    mi.querySelectorAll('.ob_b.th').forEach(b => { const n = b.nextElementSibling; if (!(n && n.matches('.ob_b.th')) && face) { const src = [face, ...face.querySelectorAll('*')].find(x => { const c = getComputedStyle(x); return c.backgroundImage !== 'none' || (c.backgroundColor && !/rgba\(0, 0, 0, 0\)|transparent/.test(c.backgroundColor)); }); const a = document.createElement('span'); a.className = 'mk_av'; if (src) { const c = getComputedStyle(src); a.style.background = c.backgroundImage !== 'none' ? c.backgroundImage : c.backgroundColor; } a.textContent = (face.textContent || 'M').trim().slice(0, 1) || 'M'; b.append(a); } });
    const rds = mi.querySelectorAll('.ob_rd'); const last = rds[rds.length - 1]; if (last) { last.classList.add('mk_last'); last.textContent = '읽음'; }
    const t = rds[0]?.querySelector('.cg_num')?.textContent || ''; const d = mi.querySelector('.ob_day'); if (d) d.textContent = `오늘 ${t}`;
    const rb = [...mi.querySelectorAll('.ob_b.th')].find(b => /Kuchen/.test(b.textContent)); if (rb) { rb.classList.add('mk_hasre'); rb.insertAdjacentHTML('beforeend', '<span class="mk_re">❤️</span>'); } },
  U1B: ({ SMILE }) => { const mi = document.querySelector('.na_ph_frame .ob_mi'); const face = document.querySelector('.na_ph_frame .ob_fb');
    mi.querySelectorAll('.ob_b.th').forEach(b => { const n = b.nextElementSibling; if (!(n && n.matches('.ob_b.th'))) { const a = document.createElement('span'); a.className = 'mk_av'; a.textContent = 'M'; b.append(a); } });
    const rds = mi.querySelectorAll('.ob_rd'); const last = rds[rds.length - 1]; if (last) { last.classList.add('mk_last'); last.textContent = '읽음'; }
    const t = rds[0]?.querySelector('.cg_num')?.textContent || ''; const d = mi.querySelector('.ob_day'); if (d) d.textContent = `오늘 ${t}`;
    const ra = [...mi.querySelectorAll('.ob_b.th')].find(b => /Kuchen/.test(b.textContent)); if (ra) { ra.classList.add('mk_hasre'); ra.insertAdjacentHTML('beforeend', '<span class="mk_re">❤️</span>'); }
    const rb = [...mi.querySelectorAll('.ob_b.me')].find(b => /케이크/.test(b.textContent)); if (rb) { rb.classList.add('mk_hasre'); rb.insertAdjacentHTML('beforeend', '<span class="mk_re">😂</span>'); } },
  U2: ({ SMILE }) => { const mi = document.querySelector('.na_ph_frame .ob_mi'); let last = '';
    [...mi.children].forEach(e => { if (e.matches('.ob_rd')) last = e.querySelector('.cg_num')?.textContent || last; if (e.matches('.ob_b.th')) { const [h, m] = (last || '16:30').split(':').map(Number); const mm = (m + 1) % 60; e.insertAdjacentHTML('beforeend', `<span class="mk_t">${String(h + (m + 1 >= 60 ? 1 : 0)).padStart(2, '0')}:${String(mm).padStart(2, '0')}</span>`); } });
    const inp = document.querySelector('.na_ph_frame .ob_inp'); inp.insertAdjacentHTML('afterbegin', SMILE);
    const rb = [...mi.querySelectorAll('.ob_b.me')].find(b => /케이크/.test(b.textContent)); if (rb) { rb.classList.add('mk_hasre'); rb.insertAdjacentHTML('beforeend', '<span class="mk_re">😂</span>'); } },
  U3: ({ SMILE }) => { const mi = document.querySelector('.na_ph_frame .ob_mi');
    document.querySelector('.na_ph_frame .ob_inp').insertAdjacentHTML('afterbegin', SMILE);
    const a = [...mi.querySelectorAll('.ob_b.th')].find(b => /Kuchen/.test(b.textContent)); if (a) { a.classList.add('mk_hasre'); a.insertAdjacentHTML('beforeend', '<span class="mk_re">❤️</span>'); }
    const b = [...mi.querySelectorAll('.ob_b.me')].find(b => /케이크/.test(b.textContent)); if (b) { b.classList.add('mk_hasre'); b.insertAdjacentHTML('beforeend', '<span class="mk_re">😂 <b style="font-size:11px">2</b></span>'); } },
};
const OPT = {
  A: `${BASE} .na_phl ${BAR} { height: ${sb}px !important; padding: 0 !important; visibility: hidden; } .na_phl .na_ph_notch { display: none !important; }`,
  B: `${BASE} .na_phl ${BAR} { height: ${(+sb + 20).toFixed(1)}px !important; padding: ${sb}px 0 0 !important; justify-content: center !important; align-items: center !important; }
      .na_phl ${BAR} > :is(.ax_sbi, .cg_sbi) { display: none !important; } .na_phl ${BAR} > .cg_num { font-size: 12px !important; font-weight: 600 !important; opacity: .55; letter-spacing: .02em !important; }
      .na_phl .na_ph_notch { display: none !important; }`,
  C: `${BASE} .na_phl ${BAR} { height: ${(+sb + 40).toFixed(1)}px !important; padding: 0 !important; } .na_phl ${BAR} > * { visibility: hidden; }
      .na_phl .na_ph_notch { top: ${(+sb + 6).toFixed(1)}px !important; width: 96px !important; height: 30px !important; border-radius: 15px !important; justify-content: center !important; padding: 0 !important; gap: 7px; }
      .na_phl .na_ph_notch::before { content: var(--ct); color: #fff; font: 600 13px 'Inter Tight', sans-serif; letter-spacing: .01em; }`,
  D: `${BASE} .na_phl ${BAR} { height: ${(+sb + 54).toFixed(1)}px !important; padding-top: ${sb}px !important; } .na_phl .na_ph_notch { top: ${(+sb + 11).toFixed(1)}px !important; }`,
  // 기기 상단바를 숨기고 가짜 바가 맨 위 (E: 지금 자리 그대로 · F: 섬을 카메라 구멍에 맞춰 올리고 바를 낮게)
  E: `${BASE}`,
  F: `${BASE} .na_phl ${BAR} { height: 42px !important; padding-top: 0 !important; } .na_phl .na_ph_notch { top: 4px !important; height: 29px !important; border-radius: 15px !important; width: 112px !important; }`,
  // 예전 아이폰 노치: 화면 맨 위에 붙은 검은 홈, 아래 모서리 둥글고 위쪽 양옆은 안으로 휜 귀. G 넓은 노치(X~12) · H 좁은 노치(13~14)
  // R: 시안이 아니라 실제 코드(css/59-phone-shell.css) — 앱이 알려 주는 하단 버튼 줄 높이만 흉내 내요
  R: '',
  B1: BUB1, B2: BUB2, B3: BUB3, B4: BUB4, U1, U2, U3, U1B,
  M1: MIST(0.55, 28), M2: MIST(0.75, 40), M3: MIST(0.9, 56),
  // 뿌연 하단 띠: S1 막대를 띠 맨 위 · S2 띠를 막대만큼 더 올려 그 안에 막대 · S3 띠만(앱은 막대 없음, 홈은 그대로)
  S1: GL(0, 7), S2: GL(22, 9), S3: GL(0, 0) + ' .na_phl .ax .ax_ind span { visibility: hidden !important; }',
  // 노치 다시 (실제 코드 위에): N1 폭 140 · N2 124 · N3 124 낮고 납작 · N4 108 작게
  N1: N2(140, 30, 18), N2: N2(124, 30, 18), N3: N2(124, 26, 12), N4: N2(108, 27, 15),
  G: NOTCH(209),
  H: NOTCH(162),
};
const NOSB = { U1B: 2, U1: 2, U2: 2, U3: 2, B1: 2, B2: 2, B3: 2, B4: 2, M1: 2, M2: 2, M3: 2, E: 1, F: 1, G: 2, H: 2, R: 2, S1: 2, S2: 2, S3: 2, N1: 2, N2: 2, N3: 2, N4: 2 };
// 기기 바 그림 (소망 폰: 왼쪽 KT 시간, 오른쪽 아이콘 · 아래 파란 버튼 셋 + 분홍 하트)
const DEV = (ink, nosb) => `<div id="mk_dev" style="position:fixed;inset:0;pointer-events:none;z-index:99999;font-family:Roboto,'Noto Sans KR',sans-serif">
  ${nosb ? `<i style="position:absolute;left:50%;top:${HOLE}px;width:11px;height:11px;margin:-5.5px 0 0 -5.5px;border-radius:50%;background:#050505;${nosb === 2 ? "" : "box-shadow:0 0 0 1.5px rgba(40,40,40,.6)"}"></i>` : ''}<div style="${nosb ? 'visibility:hidden;' : ''}position:absolute;left:0;right:0;top:0;height:${SB}px;display:flex;align-items:center;justify-content:space-between;padding:0 16px 0 22px;color:${ink};font-size:14px;font-weight:500">
    <span>KT 12:09 &nbsp;•</span><span style="display:flex;gap:6px;align-items:center">
    <svg width="15" height="12" viewBox="0 0 15 12" fill="none" stroke="${ink}" stroke-width="1.6"><path d="M1 4a9 9 0 0 1 13 0M3.5 6.8a5.5 5.5 0 0 1 8 0"/><circle cx="7.5" cy="10" r="1.2" fill="${ink}" stroke="none"/></svg>
    <svg width="14" height="12" viewBox="0 0 14 12" fill="${ink}"><rect x="0" y="8" width="2.4" height="4" rx=".6"/><rect x="3.8" y="5.5" width="2.4" height="6.5" rx=".6"/><rect x="7.6" y="3" width="2.4" height="9" rx=".6"/><rect x="11.4" y="0" width="2.4" height="12" rx=".6"/></svg>
    <span style="display:inline-grid;place-items:center;min-width:24px;height:15px;border-radius:8px;background:${ink};color:${ink === '#fff' ? '#333' : '#fff'};font-size:10.5px;font-weight:700">46</span></span></div>
  <div style="position:absolute;left:0;right:0;bottom:0;height:${NB}px;display:flex;align-items:center;justify-content:space-around;padding:0 40px">
    <svg width="20" height="18" viewBox="0 0 20 18" stroke="#7b93dd" stroke-width="2.2" stroke-linecap="round"><path d="M4 2v14M10 2v14M16 2v14"/></svg>
    <svg width="28" height="24" viewBox="0 0 24 22" fill="none" stroke="#f29bb0" stroke-width="2.6"><path d="M12 20s-8-5-8-11a4.5 4.5 0 0 1 8-2.8A4.5 4.5 0 0 1 20 9c0 6-8 11-8 11z"/></svg>
    <svg width="14" height="20" viewBox="0 0 14 20" fill="none" stroke="#7b93dd" stroke-width="2.4" stroke-linecap="round"><path d="M11 2 3 10l8 8"/></svg></div></div>`;
const HOLE = 16; // 갤럭시 카메라 구멍 가운데 (위에서 dp, 기종마다 조금 달라요)
const INKX = 0;
const INK = { home: '#1b1d22', bank: '#fff', orbitroom: '#fff', diary: '#1b1d22' };
(async () => {
  reset();
  const s = await open('light', { out: os.tmpdir(), width: W, height: H, mobile: true, init: true }); const p = s.p;
  try {
    await s.run(SAMPLE_MONEY);
    await s.run(async ({ ph }) => { ph.diary = [['11-13', 'Akzeptabel', '알겠다', 'Ich habe Albrecht den Umstrukturierungsplan übergeben. Vierzig Seiten Risikominderung. Er las die Zusammenfassung schweigend und klappte die Ledermappe zu.'], ['11-15', 'Videoanruf', '영상통화', 'Sie hatte die Haare locker hochgesteckt. Im Hintergrund redeten Leute auf Koreanisch, irgendein Café in Seoul.'], ['11-17', 'Seoul', '서울 지사', 'Ich habe mir die Organigramme des Seouler Büros noch einmal angesehen. Ich könnte mich versetzen lassen.'], ['11-18', 'Das Foto', '사진', 'Bevor ich die Wohnung verließ, rückte ich den Silberrahmen auf der Konsole im Flur zurecht.'], ['11-20', '08:00', '오전 8시', 'Eckbüro im 34. Stock. Die Sonne steigt durch den Dunst über dem Bankenviertel. Mein Bildschirm leuchtet mit ihrer Nachricht auf.']].map(([date, title, kt, text]) => ({ date, title, kt, text })); });
    await s.run(async ({ m }) => { const n = SillyTavern.getContext().chat.length - 1; const t = String(m.text), cut = t.search(/\n# STATE/), add = `\n## #26–#${n} — Am Fluss (Oct 25, night, Varo)\n- Sie redeten.\n`; m.text = cut >= 0 ? t.slice(0, cut).replace(/\s*$/, '') + '\n' + add + t.slice(cut) : t + add; m.boundary = n; });
    await s.to('set'); await p.click('.na_ph_pmode[data-v=live]'); await p.waitForTimeout(600); await p.click('.na_ob_start'); await p.waitForTimeout(2000);
    await s.to('orbitnew'); await p.waitForTimeout(400); await p.locator('.na_ph_frame .na_ob_pick', { hasText: 'Mara' }).first().click(); await p.waitForTimeout(300); await p.click('.na_ph_frame .na_ob_make'); await p.waitForTimeout(500);
    const rid = await p.evaluate(async B => { const core = await import(B + 'core.js'), st = await import(B + 'phone2store.js'); const m = core.getMeta(), r = st.liveRooms(m)[0], me = st.liveWorld(m).persona; const T = [[me, '내일 열 시에 정비소 올 수 있어?', ''], ['Mara', 'Ja klar, Samstag passt!', '응 좋아, 토요일 괜찮아!'], ['Mara', 'Bring Kuchen mit 😄', '케이크 가져와 😄'], [me, '무슨 케이크', ''], ['Mara', 'Den mit Kirschen', '체리 든 거'], ['Mara', 'Vom Bäcker an der Ecke', '모퉁이 빵집 거'], [me, '거기 일찍 닫잖아', ''], ['Mara', 'Dann geh halt früher', '그럼 좀 일찍 가'], [me, '알겠어 내일 봐', ''], ['Mara', 'Bis morgen', '내일 봐']]; const t0 = Date.now() - T.length * 60000; r.messages = T.map(([from, text, ko], i) => ({ id: `mk${i}`, from, text, ko, at: t0 + i * 60000, told: true, ...(from === 'Mara' ? { state: '회사 · 점심 먹고 자리' } : {}) })); for (const n of r.members) (r.read ||= {})[st.liveKey(n)] = Date.now(); return r.id; }, B);
    const only = process.argv[2] ? process.argv[2].split(',') : Object.keys(OPT);
    for (const o of only) {
      await p.evaluate(([nb, on]) => document.documentElement.style.setProperty('--na-nb', on ? `${nb}px` : '0px'), [NB, o === 'R' || o[0] === 'N' || o[0] === 'S' || o[0] === 'M' || o[0] === 'B' || o[0] === 'U']);
      await p.evaluate(css => { document.getElementById('mk_opt')?.remove(); const t = document.createElement('style'); t.id = 'mk_opt'; t.textContent = css; document.head.append(t); }, OPT[o]);
      for (const [v, i] of 'BU'.includes(o[0]) ? [['orbitroom', rid]] : 'SMR'.includes(o[0]) ? [['home'], ['diary'], ['orbitroom', rid], ['bank']] : [['home'], ['bank'], ['orbitroom', rid]]) {
        if (v === 'orbitroom') await s.to('orbit');
        await s.to(v, i); await p.waitForTimeout(500);
        if (JSX[o] && v === 'orbitroom') { await p.evaluate(`(${JSX[o]})(${JSON.stringify({ SMILE })})`); await p.evaluate(() => { const m = document.querySelector('.na_ph_frame .ob_msgs'); m.scrollTop = m.scrollHeight; }); await p.waitForTimeout(250); }
        await p.evaluate(({ html }) => { document.getElementById('mk_dev')?.remove(); const d = document.getElementById('na_phl'); d.insertAdjacentHTML('beforeend', html); const t = d.querySelector('.ax_sb .cg_num, .cg_sb .cg_num'); d.style.setProperty('--ct', JSON.stringify(t ? t.textContent : '')); }, { html: DEV(INK[v], NOSB[o]) });
        await p.waitForTimeout(300);
        await p.screenshot({ path: path.join(__dirname, `${o}_${v}.png`) });
        if (o === 'R' && v === 'orbitroom') { await p.evaluate(() => { const m = document.querySelector('.na_ph_frame .ob_msgs'); m.scrollTop = m.scrollTop - 170; }); await p.waitForTimeout(250); await p.screenshot({ path: path.join(__dirname, `${o}_${v}_up.png`) }); }
      }
    }
    console.log('errors', s.errors ? s.errors() : s.errs);
  } finally { await s.close(); reset(); }
})().catch(e => { console.error(e); reset(); process.exit(1); });
