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
  // 노치 다시 (실제 코드 위에): N1 폭 140 · N2 124 · N3 124 낮고 납작 · N4 108 작게
  N1: N2(140, 30, 18), N2: N2(124, 30, 18), N3: N2(124, 26, 12), N4: N2(108, 27, 15),
  G: NOTCH(209),
  H: NOTCH(162),
};
const NOSB = { E: 1, F: 1, G: 2, H: 2, R: 2, N1: 2, N2: 2, N3: 2, N4: 2 };
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
const INK = { home: '#1b1d22', bank: '#fff', orbitroom: '#fff' };
(async () => {
  reset();
  const s = await open('light', { out: os.tmpdir(), width: W, height: H, mobile: true, init: true }); const p = s.p;
  try {
    await s.run(SAMPLE_MONEY);
    await s.run(async ({ m }) => { const n = SillyTavern.getContext().chat.length - 1; const t = String(m.text), cut = t.search(/\n# STATE/), add = `\n## #26–#${n} — Am Fluss (Oct 25, night, Varo)\n- Sie redeten.\n`; m.text = cut >= 0 ? t.slice(0, cut).replace(/\s*$/, '') + '\n' + add + t.slice(cut) : t + add; m.boundary = n; });
    await s.to('set'); await p.click('.na_ph_pmode[data-v=live]'); await p.waitForTimeout(600); await p.click('.na_ob_start'); await p.waitForTimeout(2000);
    await s.to('orbitnew'); await p.waitForTimeout(400); await p.locator('.na_ph_frame .na_ob_pick', { hasText: 'Mara' }).first().click(); await p.waitForTimeout(300); await p.click('.na_ph_frame .na_ob_make'); await p.waitForTimeout(500);
    const rid = await p.evaluate(async B => { const core = await import(B + 'core.js'), st = await import(B + 'phone2store.js'); const m = core.getMeta(), r = st.liveRooms(m)[0], me = st.liveWorld(m).persona; const T = [[me, '내일 열 시에 정비소 올 수 있어?', ''], ['Mara', 'Ja klar, Samstag passt!', '응 좋아, 토요일 괜찮아!'], ['Mara', 'Bring Kuchen mit 😄', '케이크 가져와 😄'], [me, '무슨 케이크', ''], ['Mara', 'Den mit Kirschen', '체리 든 거'], ['Mara', 'Vom Bäcker an der Ecke', '모퉁이 빵집 거'], [me, '거기 일찍 닫잖아', ''], ['Mara', 'Dann geh halt früher', '그럼 좀 일찍 가'], [me, '알겠어 내일 봐', ''], ['Mara', 'Bis morgen', '내일 봐']]; const t0 = Date.now() - T.length * 60000; r.messages = T.map(([from, text, ko], i) => ({ id: `mk${i}`, from, text, ko, at: t0 + i * 60000, told: true, ...(from === 'Mara' ? { state: '회사 · 점심 먹고 자리' } : {}) })); for (const n of r.members) (r.read ||= {})[st.liveKey(n)] = Date.now(); return r.id; }, B);
    const only = process.argv[2] ? process.argv[2].split(',') : Object.keys(OPT);
    for (const o of only) {
      await p.evaluate(([nb, on]) => document.documentElement.style.setProperty('--na-nb', on ? `${nb}px` : '0px'), [NB, o === 'R' || o[0] === 'N']);
      await p.evaluate(css => { document.getElementById('mk_opt')?.remove(); const t = document.createElement('style'); t.id = 'mk_opt'; t.textContent = css; document.head.append(t); }, OPT[o]);
      for (const [v, i] of [['home'], ['bank'], ['orbitroom', rid]]) {
        if (v === 'orbitroom') await s.to('orbit');
        await s.to(v, i); await p.waitForTimeout(500);
        await p.evaluate(({ html }) => { document.getElementById('mk_dev')?.remove(); const d = document.getElementById('na_phl'); d.insertAdjacentHTML('beforeend', html); const t = d.querySelector('.ax_sb .cg_num, .cg_sb .cg_num'); d.style.setProperty('--ct', JSON.stringify(t ? t.textContent : '')); }, { html: DEV(INK[v], NOSB[o]) });
        await p.waitForTimeout(300);
        await p.screenshot({ path: path.join(__dirname, `${o}_${v}.png`) });
      }
    }
    console.log('errors', s.errors ? s.errors() : s.errs);
  } finally { await s.close(); reset(); }
})().catch(e => { console.error(e); reset(); process.exit(1); });
