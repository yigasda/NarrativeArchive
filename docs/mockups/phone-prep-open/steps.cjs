// 폰 만들기 준비: 맨 위 초안 모델, 용어집 "(선택)" 빼기, 용어집 아래 말투 — 실제 준비 화면 위에 그려 찍어요
// 1 초안 모델이 없을 때(아래 단계 흐림, 다음 버튼 막힘) · 2 정한 뒤(말투 3명)
const { open } = require('/home/user/NarrativeArchive/tools/dev/probe.cjs');
(async () => {
  const out = process.argv[2]; const s = await open('light', { out, make: false }); const p = s.p;
  await p.waitForTimeout(800);
  for (const [k, set] of [['unset', false], ['set', true]]) {
    await s.to('prep'); await p.waitForTimeout(400);
    await p.evaluate(async set => {
      const { ax } = await import('/scripts/extensions/third-party/NarrativeArchive/src/phoneapps.js');
      const chev = ax('chev', 15, '#b7bdc6', 2.4), sc = document.querySelector('.na_ph_frame .ax_scroll');
      const secs = [...sc.querySelectorAll('.ax_sec')];
      const num = (el, n, t) => { el.textContent = `${n} · ${t}`; };
      // renumber: 1 초안 모델 (new) · 2 인물 정보 · 3 참고 로어북 (선택) · 4 용어집 · 5 말투 (new) · 6 날짜 · 7 위치 · 8 이야기 연도
      const map = { '1 · 인물 정보': [2, '인물 정보'], '2 · 참고 로어북 (선택)': [3, '참고 로어북 (선택)'], '3 · 용어집 (선택)': [4, '용어집'], '4 · 날짜': [6, '날짜'], '5 · 위치': [7, '위치'], '6 · 이야기 연도': [8, '이야기 연도'] };
      for (const e of secs) { const m = map[e.textContent.trim()]; if (m) num(e, ...m); }
      const first = secs[0];
      first.insertAdjacentHTML('beforebegin', `<div class="ax_sec">1 · 초안 모델</div><div class="ax_card"><button type="button" class="ax_rw ax_rwn"><span class="ax_tx"><span class="ax_n">초안 모델</span></span><span class="ax_v"${set ? '' : ' style="color:#2f6bff"'}>${set ? 'gemini-2.5-flash' : '정하기'}</span>${chev}</button></div><div class="ax_foot">폰을 채우고 반영하는 모델이에요. 확장 설정 › AI 모델과 같아요.</div>`);
      const gloss = secs.find(e => e.textContent.includes('용어집'));
      const gfoot = gloss.nextElementSibling.nextElementSibling; // its card, then its foot
      gfoot.insertAdjacentHTML('afterend', `<div class="ax_sec">5 · 말투</div><div class="ax_card"><button type="button" class="ax_rw ax_rwn"><span class="ax_tx"><span class="ax_n">말투표</span></span><span class="ax_v">${set ? '3명' : '없음'}</span>${chev}</button></div><div class="ax_foot">문자 · 댓글을 옮길 때 사람마다 이 말투를 따라요.</div>`);
      if (!set) {
        // everything under 초안 모델 waits for it
        let on = false;
        for (const e of [...sc.children]) { if (e.classList.contains('ax_sec') && e.textContent.startsWith('2 ·')) on = true; if (on && !e.matches('.ax_pad')) e.style.opacity = '0.45'; }
        const nx = sc.querySelector('.na_ph_preplink .ax_n'); if (nx) nx.textContent = '초안 모델을 먼저 정해 주세요';
      }
      sc.scrollTop = 0;
    }, set);
    await p.waitForTimeout(300); await s.shot('st_' + k); await s.scroll(560); await s.shot('st_' + k + '2');
  }
  console.log(JSON.stringify(s.errors())); await s.close();
})().catch(e => { console.error(String(e).slice(0, 400)); process.exit(1); });
