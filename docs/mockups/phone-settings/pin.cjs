// 위치 정보 아이콘: 지금(속이 빈 고리) → 안에 작은 채운 동그라미 두 크기 — 실제 설정 화면의 아이콘만 바꿔 찍어요
const { open } = require('/home/user/NarrativeArchive/tools/dev/probe.cjs');
const PIN = 'M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11z';
(async () => {
  const out = process.argv[2]; const s = await open('light', { out }); const p = s.p;
  await s.run(async ({ core, ph }) => { ph.financeProfile = { type: 'character', id: 'mara.png', label: 'Mara' }; ph.where = { at: Date.now(), people: [{ name: 'Mara', city: 'Frankfurt', names: ['Frankfurt'], tz: 'Europe/Berlin', lives: 'DE' }] }; ph.lives = 'DE'; await core.saveMeta(); });
  for (const [k, r] of [['now', 0], ['dot2', 2.1], ['dot16', 1.6]]) {
    await s.to('set'); await p.waitForTimeout(300);
    if (r) await p.evaluate(([PIN, r]) => { const svg = document.querySelector('.na_ph_frame [data-go="setplace"] .ax_si svg');
      svg.innerHTML = `<path d="${PIN}"/><circle cx="12" cy="10" r="${r}" fill="#fff" stroke="none"/>`; }, [PIN, r]);
    await p.evaluate(() => { document.querySelector('.na_ph_frame .ax_scroll').scrollTop = 330; }); await p.waitForTimeout(200);
    await s.shot('pin_' + k);
    // the icon itself, big
    const el = await p.$('.na_ph_frame [data-go="setplace"]'); await el.screenshot({ path: `${out}/pin_${k}_row.png` });
  }
  await s.run(async ({ core, ph }) => { delete ph.financeProfile; await core.saveMeta(); });
  console.log(JSON.stringify(s.errors())); await s.close();
})().catch(e => { console.error(String(e).slice(0, 400)); process.exit(1); });
