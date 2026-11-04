const { open } = require('/home/user/NarrativeArchive/tools/dev/probe.cjs');
const T = '상태창 날짜를 어떻게 쓰세요?', S = '나중에 설정에서 바꿀 수 있어요.';
const head = `<div class="pcf_msg"><b>${T}</b><span>${S}</span></div>`;
const wrap = card => `<div class="pcf" style="position:absolute"><div class="pcf_box"><div class="pcf_card">${head}${card}</div><div class="pcf_no">나중에</div></div></div>`;
const g = 'color:#8a919c;font-weight:400';
const V = {
  A: wrap(`<div class="pcf_ok safe" style="font-size:18px;gap:8px">월.일<span style="font-size:13px;${g}">11.03 = 11월 3일</span></div><div class="pcf_ok safe" style="font-size:18px;gap:8px">일.월<span style="font-size:13px;${g}">03.11. = 11월 3일</span></div>`),
  B: wrap(`<div class="pcf_ok safe" style="height:52px;justify-content:space-between;padding:0 22px;font-size:17px">월.일<span style="font-size:14px;${g}">11.03 → 11월 3일</span></div><div class="pcf_ok safe" style="height:52px;justify-content:space-between;padding:0 22px;font-size:17px">일.월<span style="font-size:14px;${g}">03.11. → 11월 3일</span></div>`),
  C: wrap(`<div style="display:flex;border-top:.5px solid rgba(60,60,67,.16)"><div class="pcf_ok safe" style="flex:1;border:0;height:60px;flex-direction:column;gap:1px;font-size:17px">월.일<span style="font-size:11.5px;${g}">11.03 = 11월 3일</span></div><div style="width:.5px;background:rgba(60,60,67,.16)"></div><div class="pcf_ok safe" style="flex:1;border:0;height:60px;flex-direction:column;gap:1px;font-size:17px">일.월<span style="font-size:11.5px;${g}">03.11. = 11월 3일</span></div></div>`),
  D: wrap(`<div class="pcf_ok safe" style="font-size:20px">11.03 은 11월 3일</div><div class="pcf_ok safe" style="font-size:20px">03.11. 은 11월 3일</div>`),
};
const L = { A: 'A. 원래 줄 높이, 예시는 옆에 작게', B: 'B. 낮은 줄, 왼쪽 이름 · 오른쪽 예시', C: 'C. 가로 두 칸', D: 'D. 예시 문장만 (원래 글자 크기)' };
(async () => {
  const out = process.argv[2]; const s = await open('light', { out });
  for (const k of Object.keys(V)) {
    await s.to('set'); await s.scroll(); await s.p.evaluate(([h, l]) => { const cv = document.querySelector('.na_ph_frame .cg_canvas') || document.querySelector('.na_ph_frame .na_ph_scr'); cv.insertAdjacentHTML('beforeend', h);
      const sc = document.querySelector('.na_ph_frame .na_ph_scr'); const tag = document.createElement('div'); tag.textContent = l; tag.style.cssText = 'position:absolute;left:0;right:0;top:58px;text-align:center;font:700 15px sans-serif;color:#d0306a;z-index:99'; sc.append(tag); }, [V[k], L[k]]);
    await s.p.waitForTimeout(400); await s.shot('v_' + k);
  }
  console.log(s.errors()); await s.close();
})();
