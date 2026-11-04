// 블러 없는 유리 확인 창: 그라데이션 · 반사광 · 빛 테두리 · 아래 안 그림자 세기 3단계 (실제 창 위에 스타일만 바꿔 찍어요)
const { open } = require('/home/user/NarrativeArchive/tools/dev/probe.cjs');
const SH = '0 1px 1px rgba(10,16,28,.08),0 10px 24px rgba(10,16,28,.18),0 30px 70px rgba(10,16,28,.34)';
const L = {
  1: { bg: 'linear-gradient(180deg,#ffffff 0%,#f2f5f9 55%,#e6ebf2 100%)', sheen: '.6', sheenH: '48%', ring: ['.95', '.3', '.12', '.75'], inner: 'inset 0 -8px 16px -10px rgba(40,60,90,.12)' },
  2: { bg: 'linear-gradient(180deg,#ffffff 0%,#eef2f8 45%,#dde4ee 100%)', sheen: '.75', sheenH: '50%', ring: ['1', '.4', '.15', '.85'], inner: 'inset 0 -12px 22px -12px rgba(40,60,90,.2)' },
  3: { bg: 'linear-gradient(180deg,#ffffff 0%,#e9eef6 40%,#d3dbe8 100%)', sheen: '.9', sheenH: '52%', ring: ['1', '.5', '.2', '1'], inner: 'inset 0 -16px 26px -12px rgba(40,60,90,.28), inset 0 1px 0 #fff' },
};
const css = v => `.na_ph_frame .pcf .pcf_card{background:${v.bg} !important;box-shadow:${v.inner},${SH} !important}
.na_ph_frame .pcf .pcf_card::before{background:linear-gradient(180deg,rgba(255,255,255,${v.sheen}),rgba(255,255,255,0)) !important;height:${v.sheenH} !important}
.na_ph_frame .pcf .pcf_card::after{background:linear-gradient(160deg,rgba(255,255,255,${v.ring[0]}),rgba(255,255,255,${v.ring[1]}) 35%,rgba(255,255,255,${v.ring[2]}) 65%,rgba(255,255,255,${v.ring[3]})) !important}`;
(async () => {
  const out = process.argv[2]; const s = await open('light', { out });
  for (const w of ['kill', 'date']) {
    await s.to('set'); await s.scroll();
    if (w === 'kill') await s.p.click('.na_ph_storyreset'); else { await s.run(async ({ core }) => { delete core.getMeta().dateOrder; }); await s.p.click('.na_ph_setupd'); }
    await s.p.waitForSelector('.pcf'); await s.p.waitForTimeout(600);
    for (const k of [0, 1, 2, 3]) {
      await s.p.evaluate(([c, l]) => { document.getElementById('gl_mock')?.remove(); const st = document.createElement('style'); st.id = 'gl_mock'; st.textContent = c; document.head.append(st);
        document.getElementById('gl_tag')?.remove(); const t = document.createElement('div'); t.id = 'gl_tag'; t.textContent = l; t.style.cssText = 'position:absolute;left:0;right:0;top:58px;text-align:center;font:700 15px sans-serif;color:#d0306a;z-index:99'; document.querySelector('.na_ph_frame .na_ph_scr').append(t); },
        [k ? css(L[k]) : '', k ? ['', '1. 약하게', '2. 중간', '3. 세게'][k] : '0. 지금']);
      await s.p.waitForTimeout(200); await s.shot(`glass_${w}_${k}`);
    }
    await s.p.click('.pcf_no'); await s.p.waitForTimeout(300);
  }
  console.log(s.errors()); await s.close();
})();
