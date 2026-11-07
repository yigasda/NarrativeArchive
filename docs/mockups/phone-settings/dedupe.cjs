// 설정 › 일반 중복 줄이기 + 위치 정보 · 외모 아이콘 색 세 가지 — 실제 폰 설정 화면에 글자 · 색만 바꿔 찍어요
const { open } = require('/home/user/NarrativeArchive/tools/dev/probe.cjs');
const ICONS = { now: ['#7fa69c', '#d89f98'], c1: ['#89b892', '#d494a7'], c2: ['#e0a77c', '#d494a7'], c3: ['#79b5ee', '#e0a77c'] };
(async () => {
  const out = process.argv[2]; const s = await open('light', { out }); const p = s.p;
  await s.run(async ({ core, ph }) => { ph.financeProfile = { type: 'character', id: 'mara.png', label: 'Mara' }; ph.where = { at: Date.now(), people: [{ name: 'Mara', city: 'Frankfurt', names: ['Frankfurt'], tz: 'Europe/Berlin', lives: 'DE' }] }; ph.lives = 'DE'; await core.saveMeta(); });
  await s.to('set'); await p.waitForTimeout(400); await s.shot('st_now_top'); await s.scroll(330); await s.shot('st_now');
  for (const [k, [pin, user]] of Object.entries(ICONS).slice(1)) {
    await s.to('set'); await p.waitForTimeout(300);
    await p.evaluate(([pin, user]) => {
      const f = document.querySelector('.na_ph_frame');
      const me = f.querySelector('.ax_me .ax_p'); if (me) me.textContent = me.textContent.split(' · ')[0];          // 맨 위: 핸들만
      const row = go => f.querySelector(`[data-go="${go}"]`);
      row('setplace').querySelector('.ax_v').textContent = row('setplace').querySelector('.ax_v').textContent.split(' · ').pop();  // 위치: 도시만
      row('setprofile').querySelector('.ax_v').textContent = '캐릭터 카드';                                         // 이 폰에 대해: 출처
      row('setplace').querySelector('.ax_si').style.background = pin;
      f.querySelector('.na_ph_looksbtn2 .ax_si').style.background = user;
    }, [pin, user]);
    if (k === 'c1') await s.shot('st_dedupe_top');
    await s.scroll(330); await s.shot('st_' + k);
  }
  await s.run(async ({ core, ph }) => { delete ph.financeProfile; await core.saveMeta(); });
  console.log(JSON.stringify(s.errors())); await s.close();
})().catch(e => { console.error(String(e).slice(0, 400)); process.exit(1); });
