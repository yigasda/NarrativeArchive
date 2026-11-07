// 폰 만들기 준비 여백 시안 A(조금) · B(넉넉) + 메신저 시간대를 설정 화면 그대로 열기 — 실제 폰에 CSS만 얹어 찍어요
const { open } = require('/home/user/NarrativeArchive/tools/dev/probe.cjs');
const B = '/scripts/extensions/third-party/NarrativeArchive/src/';
const CSS = {
  // the gap above a step's title is the same wherever it comes after (a card, a note, the place card)
  A: `.v_prep .ax_sec { margin-top: 20px; } .v_prep .ax_foot + .ax_sec, .v_prep .ax_pl_hero + .ax_sec { margin-top: 8px; }
      .v_prep .ax_prep_lead { margin-bottom: 16px; } .v_prep .ax_card { margin-bottom: 14px; } .v_prep .ax_foot { margin-bottom: 14px; }
      .v_prep .ax_pl_warn { margin-bottom: 14px; } .v_prep .ax_pl_hero { margin-bottom: 14px; }`,
  B: `.v_prep .ax_sec { margin-top: 30px; } .v_prep .ax_foot + .ax_sec, .v_prep .ax_pl_hero + .ax_sec { margin-top: 14px; }
      .v_prep .ax_prep_lead { margin-bottom: 22px; } .v_prep .ax_card { margin-bottom: 16px; } .v_prep .ax_foot { margin-bottom: 18px; }
      .v_prep .ax_pl_warn { margin-bottom: 16px; } .v_prep .ax_pl_hero { margin-bottom: 18px; }`,
};
(async () => {
  const out = process.argv[2]; const s = await open('light', { out, make: false }); const p = s.p;
  const fresh = async () => { await p.evaluate(async B => { const core = await import(B + 'core.js'); delete core.getMeta().phonePre; }, B); await p.click('.na_ph_prepclose'); await p.waitForTimeout(300); await p.click('.na_ph_makebtn'); await p.waitForTimeout(500); };
  await fresh();
  for (const k of ['A', 'B']) {
    await p.evaluate(([k, c]) => { let st = document.getElementById('mock_sp'); if (!st) { st = document.createElement('style'); st.id = 'mock_sp'; document.head.append(st); } st.textContent = c; }, [k, CSS[k]]);
    await fresh(); await s.scroll(0); await s.shot(`sp${k}_1_first`);
    await p.click('.na_ph_preplink'); await p.waitForSelector('.na_ph_prepmake:not([disabled])', { timeout: 30000 });
    await p.evaluate(async B => { const core = await import(B + 'core.js'); const pre = core.getMeta().phonePre.mara;
      pre.where = { at: Date.now(), people: [{ name: 'Mara', city: '', tz: '' }, { name: 'Ren', city: 'Seoul', names: ['Seoul'], tz: 'Asia/Seoul', lives: 'KR' }] }; delete pre.lives; pre.year = 2026; pre.noYear = false; }, B);
    await p.click('.na_ph_prepopen'); await p.waitForTimeout(200); await p.click('.na_ph_prepopen'); await p.waitForTimeout(300);
    await s.scroll(0); await s.shot(`sp${k}_2_linked`); await s.scroll(); await s.shot(`sp${k}_3_bottom`);
  }
  // 메신저 시간대: 설정의 그 화면 그대로 (뒤로는 준비 화면으로)
  await p.evaluate(async B => { const core = await import(B + 'core.js'), apps = await import(B + 'phoneapps.js'); const m = core.getMeta();
    const sc = document.querySelector('.na_ph_frame .cg_canvas'); sc.innerHTML = apps.setScreenHolderView({ owner: 'Mara', country: 'DE' }, '', m); sc.closest('.na_ph_scr').className = sc.closest('.na_ph_scr').className.replace('v_prep', 'v_setscreenholder ax_setscreenholder'); }, B);
  await p.waitForTimeout(300); await s.shot('sp_holder');
  console.log(JSON.stringify(s.errors())); await s.close();
})().catch(e => { console.error(String(e).slice(0, 500)); process.exit(1); });
