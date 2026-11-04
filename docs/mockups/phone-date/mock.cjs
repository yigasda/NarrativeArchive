// 설정 › 날짜 및 시간 시안: 연도 칸을 상자 없이 (실제 화면의 카드 · 줄 모양 그대로, .ax_scroll 안만 바꿔 찍어요)
const { open } = require('/home/user/NarrativeArchive/tools/dev/probe.cjs');
const chev = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#c4c8cf" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6"/></svg>';
const sw = on => `<span class="ax_sw ${on ? 'on' : ''}"></span>`;
const seg = `<span class="ax_dseg"><span class="on">월.일</span><span>일.월</span></span>`;
const rw = (n, v, extra = '') => `<div class="ax_rw ax_rwn"><span class="ax_tx"><span class="ax_n">${n}</span></span>${v}${extra}</div>`;
const val = t => `<span class="ax_v cg_num">${t}</span>`;
const foot = t => `<div class="ax_foot">${t}</div>`;
const tail = `<div class="ax_sec">날짜 읽는 법</div><div class="ax_card">${rw('순서', seg)}</div>${foot('03.11. → 3월 11일')}`;
const V = {
  // A. 지금 그대로, 연도만 값처럼: 오른쪽 회색 숫자 + ›, 누르면 고치기
  A: `<div class="ax_h1"><b>날짜 및 시간</b></div><div class="ax_card">${rw('연도', val('2026'), chev)}${rw('날짜', val('04.11. (수)'))}${rw('시간', val('06:30'))}</div>
      <div class="ax_card">${rw('연도 표시', sw(true))}</div>${foot('연도를 알아야 요일이 맞게 나와요. 연도 없는 이야기만 꺼 주세요.')}${tail}`,
  // B. 위에 큰 날짜 한 장 (오늘이 어떻게 보이는지), 아래는 고치는 줄만
  B: `<div class="ax_h1"><b>날짜 및 시간</b></div>
      <div class="ax_card" style="padding:18px 18px 16px"><div style="font-size:12.5px;color:#8a919c">지금 이 폰</div><div style="margin-top:4px;font:600 30px 'Inter Tight',sans-serif;letter-spacing:-.02em;color:#000">06:30</div><div style="margin-top:2px;font-size:15px;color:#3d4550">2026년 11월 4일 수요일</div></div>
      <div class="ax_sec">연도</div><div class="ax_card">${rw('연도 표시', sw(true))}${rw('연도', val('2026'), chev)}</div>${foot('연도를 알아야 요일이 맞게 나와요. 연도 없는 이야기만 꺼 주세요.')}${tail}`,
  // C. 연도를 - 2026 + 로: 눌러서 한 해씩, 숫자는 상자 없이
  C: `<div class="ax_h1"><b>날짜 및 시간</b></div><div class="ax_card">${rw('날짜', val('2026. 11. 04. (수)'))}${rw('시간', val('06:30'))}</div>
      <div class="ax_card">${rw('연도 표시', sw(true))}${rw('연도', `<span style="display:inline-flex;align-items:center;gap:14px"><span style="width:30px;height:30px;border-radius:999px;background:#f1f3f6;display:flex;align-items:center;justify-content:center;color:#2c4a80;font-size:20px">−</span><b class="cg_num" style="font:600 17px 'Inter Tight',sans-serif;color:#000">2026</b><span style="width:30px;height:30px;border-radius:999px;background:#f1f3f6;display:flex;align-items:center;justify-content:center;color:#2c4a80;font-size:20px">+</span></span>`)}</div>
      ${foot('연도를 알아야 요일이 맞게 나와요. 연도 없는 이야기만 꺼 주세요.')}${tail}`,
};
const L = { A: 'A. 연도도 값처럼 (상자 없이)', B: 'B. 위에 큰 날짜 + 고치는 줄', C: 'C. 연도 − 2026 +' };
(async () => {
  const out = process.argv[2]; const s = await open('light', { out });
  for (const k of Object.keys(V)) {
    await s.to('setdate'); await s.p.waitForTimeout(300);
    await s.p.evaluate(([h, l]) => { const sc = document.querySelector('.na_ph_frame .ax_scroll'); const hd = sc.querySelector('.ax_h1, h1'); const cls = hd ? hd.className : 'ax_h1'; sc.innerHTML = h.replace('class="ax_h1"', `class="${cls}"`) + '<i class="ax_pad"></i>';
      const t = document.createElement('div'); t.textContent = l; t.style.cssText = 'position:absolute;left:0;right:0;top:58px;text-align:center;font:700 15px sans-serif;color:#d0306a;z-index:99'; document.querySelector('.na_ph_frame .na_ph_scr').append(t); }, [V[k], L[k]]);
    await s.p.waitForTimeout(300); await s.shot('date_' + k);
  }
  console.log(s.errors()); await s.close();
})();
