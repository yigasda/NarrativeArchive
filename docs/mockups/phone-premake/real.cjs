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
    <div class="ax_sec">2 · 참고 로어북 (선택)</div><div class="ax_card">${rw('참고 로어북', val('없음'))}</div>
    <div class="ax_foot">안 고르면 아카이브만 읽어요.</div>
    <div class="ax_sec">3 · 용어집 (선택)</div><div class="ax_card">${rw('번역 용어집', val('3개'))}</div>
    <div class="ax_sec">4 · 날짜</div><div class="ax_card">${rw('날짜 읽는 법', seg)}${rw('메신저 시간대', val('Mara'))}</div>
    <div class="ax_foot">위치는 1~4를 읽어서 정해요.</div>
    ${blue('다음 · 위치 연동')}
    <div class="ax_sec">5 · 위치</div>${wait('위치', '위 단계를 마치면 열려요 · 연동한 뒤 직접 고칠 수 있어요')}
    <div class="ax_sec">6 · 이야기 연도</div>${wait('연도', '위치 다음에 정해요')}
    <div style="height:14px"></div>${blue('이대로 폰 만들기', true)}<i class="ax_pad"></i>`;
  const A2 = `${head}
    <div class="ax_card">${rw('1~4 단계', val('다시 보기'))}</div>
    <div class="ax_foot">캐릭터 카드 · 로어북 없음 · 용어 3개 · 월.일 · Mara<br>바꾸면 위치를 다시 연동해요.</div>
    <div class="ax_sec">5 · 위치</div>
    <div class="ax_pl_hero"><span class="ax_pl_k">Oscar · 지금 있는 곳</span><div class="ax_pl_city"><b>Frankfurt am Main</b></div>
      <div class="ax_pl_chips"><div class="ax_pl_chip"><span>사는 나라</span><b>독일</b></div><div class="ax_pl_chip"><span>시간대</span><b>Europe/Berlin</b></div></div></div>
    <div class="ax_sec">다른 사람</div><div class="ax_card ax_pl_list">
      <div class="ax_rw ax_pl_row"><span class="ax_pl_l"><b>Seoul</b><small>Ren</small></span><span class="ax_pl_r"><b class="cg_num">+8시간</b></span></div>
      <div class="ax_rw ax_pl_row"><span class="ax_pl_l"><b>Paris</b><small>Ivo</small></span><span class="ax_pl_r"><b class="cg_num">같음</b></span></div></div>
    <div class="ax_foot">눌러서 도시를 바꾸고, 왼쪽으로 밀어서 뺄 수 있어요.</div>
    <div class="ax_sec">6 · 이야기 연도</div><div class="ax_card">${rw('연도 표시', '<span class="ax_sw on"></span>')}${rw('연도', ys)}</div>
    <div style="height:14px"></div>${blue('이대로 폰 만들기')}<i class="ax_pad"></i>`;
  const A3 = `${head}
    <div class="ax_card">${rw('1~4 단계', val('다시 보기'))}</div>
    <div class="ax_foot">캐릭터 카드 · 로어북 없음 · 용어 3개 · 월.일 · Mara</div>
    <div class="ax_sec">5 · 위치</div>
    <div class="ax_pl_warn"><span>이야기에서 불러오지 못했어요. 폰 주인의 위치를 적어 주세요.</span></div>
    <div class="ax_pl_hero"><span class="ax_pl_k">Oscar · 지금 있는 곳</span><div class="ax_pl_city"><b style="color:#8a919c">도시 정하기</b></div>
      <div class="ax_pl_chips"><div class="ax_pl_chip"><span>사는 나라</span><b>독일</b></div><div class="ax_pl_chip"><span>시간대</span><b>—</b></div></div></div>
    <div style="height:12px"></div>${blue('다시 연동')}
    <div class="ax_sec">6 · 이야기 연도</div><div class="ax_card">${rw('연도', ys)}</div>
    <div style="height:14px"></div>${blue('이대로 폰 만들기')}<i class="ax_pad"></i>`;
  const A4 = A2.replace('<div class="ax_foot">바꾸면 위치를 다시 연동해요.</div>', '<div class="ax_foot">바꾸면 위치를 다시 연동해요.</div>').replace('<div class="ax_sec">5 · 위치</div>', '<div class="ax_sec">5 · 위치</div><div class="ax_pl_warn"><span>참고 로어북이 바뀌었어요. 위치를 다시 연동해 주세요.</span></div>');
  for (const [k, h] of [['1_first', A1], ['2_linked', A2], ['3_empty', A3], ['4_changed', A4]]) {
    await s.to('set'); await s.p.waitForTimeout(250);
    await s.p.evaluate(h => { const sc = document.querySelector('.na_ph_frame .ax_scroll'); sc.innerHTML = h; sc.scrollTop = 0; }, h);
    await s.p.waitForTimeout(300); await s.shot('prep_' + k);
  }
  // pressing 이대로 폰 만들기 with the owner's place empty: the phone's own alert asks once
  await s.to('set'); await s.p.waitForTimeout(250);
  await s.p.evaluate(h => { const sc = document.querySelector('.na_ph_frame .ax_scroll'); sc.innerHTML = h; sc.scrollTop = 0;
    const host = document.querySelector('.na_ph_frame .cg_canvas') || document.querySelector('.na_ph_frame .na_ph_scr');
    host.insertAdjacentHTML('beforeend', '<div class="pcf" role="dialog"><div class="pcf_box"><div class="pcf_card"><div class="pcf_msg"><b>폰 주인 위치 없이 만들까요?</b><span>시차 없이 만들어져요.</span></div><div class="pcf_btns"><div role="button" class="pcf_no" style="font-weight:600;color:#2c4a80">위치 적기</div><div role="button" class="pcf_ok safe" style="font-weight:600;color:#6b7380">이대로 만들기</div></div></div></div></div>'); }, A3);
  await s.p.waitForTimeout(500); await s.shot('prep_5_ask');
  console.log(s.errors()); await s.close();
})();
