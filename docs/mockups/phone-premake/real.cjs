// 폰 만들기 준비 A+ — 실제 폰 설정 화면 CSS 위에 그려 찍어요 (설정의 카드 · 줄 · 회색 제목 · 파란 글자만)
const { open } = require('/home/user/NarrativeArchive/tools/dev/probe.cjs');
(async () => {
  const out = process.argv[2]; const s = await open('light', { out });
  await s.to('set'); await s.p.waitForTimeout(300);
  const chev = await s.p.evaluate(() => document.querySelector('.na_ph_frame [data-go="setdate"]')?.lastElementChild?.outerHTML || '›');
  const rw = (n, v = '', c = '') => `<div class="ax_rw ax_rwn"${c ? ` style="${c}"` : ''}><span class="ax_tx"><span class="ax_n">${n}</span></span>${v}</div>`;
  const val = (t, ch = true) => `<span class="ax_v">${t}</span>${ch ? chev : ''}`;
  const seg = '<span class="ax_dseg"><span class="na_ph_dord on">월.일</span><span class="na_ph_dord">일.월</span></span>';
  const ys = '<span class="ax_ys"><span class="ax_ystep">−</span><b class="cg_num">2026</b><span class="ax_ystep">+</span></span>';
  const blue = (t, dim = false) => `<div class="ax_card"><div class="ax_rw ax_rwn"><span class="ax_tx"><span class="ax_n ${dim ? '' : 'ax_blue'}" ${dim ? 'style="color:#b4bac3"' : ''}>${t}</span></span></div></div>`;
  const wait = (n, sub) => `<div class="ax_card"><div class="ax_rw ax_rwn"><span class="ax_tx"><span class="ax_n" style="color:#a8aeb7">${n}</span><span class="ax_p" style="color:#b4bac3">${sub}</span></span></div></div>`;
  const head = '<div class="ax_h1"><b>폰 만들기 준비</b></div><div class="ax_foot" style="margin:-6px 28px 6px">Oscar의 폰을 위에서부터 채우고 만들어요.</div>';
  const A1 = `${head}
    <div class="ax_sec">1 · 인물 정보</div><div class="ax_card">${rw('프로필 연동', val('캐릭터 카드'))}</div>
    <div class="ax_sec">2 · 용어집 (선택)</div><div class="ax_card">${rw('번역 용어집', val('3개'))}</div>
    <div class="ax_sec">3 · 날짜</div><div class="ax_card">${rw('상태창 날짜 순서', seg)}${rw('메신저 시간', val('Mara의 화면'))}</div>
    <div class="ax_foot">위치는 1~3을 읽어서 정해요.</div>
    ${blue('다음 · 위치 연동')}
    <div class="ax_sec">4 · 위치</div>${wait('위치', '위 단계를 마치면 열려요')}
    <div class="ax_sec">5 · 이야기 연도</div>${wait('연도', '위치 다음에 정해요')}
    <div style="height:14px"></div>${blue('이대로 폰 만들기', true)}<i class="ax_pad"></i>`;
  const A2 = `${head}
    <div class="ax_card">${rw('인물 정보 · 용어집 · 날짜', val('캐릭터 카드 · 3개 · 월.일'))}</div>
    <div class="ax_foot">바꾸면 위치를 다시 연동해요.</div>
    <div class="ax_sec">4 · 위치</div>
    <div class="ax_pl_hero"><span class="ax_pl_k">Oscar · 지금 있는 곳</span><div class="ax_pl_city"><b>Frankfurt am Main</b></div>
      <div class="ax_pl_chips"><div class="ax_pl_chip"><span>사는 나라</span><b>독일</b></div><div class="ax_pl_chip"><span>시간대</span><b>Europe/Berlin</b></div></div></div>
    <div class="ax_sec">다른 사람</div><div class="ax_card ax_pl_list">
      <div class="ax_rw ax_pl_row"><span class="ax_pl_l"><b>Seoul</b><small>Ren</small></span><span class="ax_pl_r"><b class="cg_num">+8시간</b></span></div>
      <div class="ax_rw ax_pl_row"><span class="ax_pl_l"><b>Paris</b><small>Ivo</small></span><span class="ax_pl_r"><b class="cg_num">같음</b></span></div></div>
    <div class="ax_sec">5 · 이야기 연도</div><div class="ax_card">${rw('연도 표시', '<span class="ax_sw on"></span>')}${rw('연도', ys)}</div>
    <div style="height:14px"></div>${blue('이대로 폰 만들기')}<i class="ax_pad"></i>`;
  const A3 = `${head}
    <div class="ax_card">${rw('인물 정보 · 용어집 · 날짜', val('캐릭터 카드 · 3개 · 월.일'))}</div>
    <div class="ax_sec">4 · 위치</div>
    <div class="ax_pl_warn"><span>폰 주인이 어디 있는지 정해 주세요. 비워 두면 시차 없이 만들어져요.</span></div>
    <div class="ax_pl_hero"><span class="ax_pl_k">Oscar · 지금 있는 곳</span><div class="ax_pl_city"><b style="color:#8a919c">도시 정하기</b></div>
      <div class="ax_pl_chips"><div class="ax_pl_chip"><span>사는 나라</span><b>독일</b></div><div class="ax_pl_chip"><span>시간대</span><b>—</b></div></div></div>
    <div style="height:12px"></div>${blue('다시 연동')}
    <div class="ax_sec">5 · 이야기 연도</div><div class="ax_card">${rw('연도', ys)}</div>
    <div style="height:14px"></div>${blue('이대로 폰 만들기')}<i class="ax_pad"></i>`;
  for (const [k, h] of [['1_first', A1], ['2_linked', A2], ['3_empty', A3]]) {
    await s.to('set'); await s.p.waitForTimeout(250);
    await s.p.evaluate(h => { const sc = document.querySelector('.na_ph_frame .ax_scroll'); sc.innerHTML = h; sc.scrollTop = 0; }, h);
    await s.p.waitForTimeout(300); await s.shot('prep_' + k);
  }
  console.log(s.errors()); await s.close();
})();
