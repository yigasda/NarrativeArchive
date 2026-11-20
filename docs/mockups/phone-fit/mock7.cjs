// 크롬(주소창 때문에 세로가 짧음)에서 폰 창: 지금 · 1번(세로가 짧으면 폰 화면 세로를 조금 줄이고 가로를 지키기, 한도 보드 780).
// 크롬 360 × 682 · 앱 360 × 735 두 크기로, 홈 · 설정 · 방 한 장씩. node docs/mockups/phone-fit/mock7.cjs → c_<크기>_<안>_<화면>.png
const { open, SAMPLE_MONEY } = require('../../../tools/dev/probe.cjs');
const fs = require('fs'), path = require('path'), os = require('os');
const CHAT = path.join(os.homedir(), 'sillytavern/data/default-user/chats/default_Seraphina/na_test.jsonl');
const reset = () => fs.copyFileSync(path.join(__dirname, '../../../tools/dev/na_test.jsonl'), CHAT);
const B = '/scripts/extensions/third-party/NarrativeArchive/src/';
// 1번: 폭은 (보이는 세로 × 390/780)까지, 양옆은 적어도 10px. 보드 세로는 폰 화면 높이 / k (780~844 사이로 늘고 줄어요)
const OPT = `@media (max-width: 600px) and (pointer: coarse) {
  .na_phl .na_ph_frame { width: min(calc(100vw - 20px), calc((var(--na-phh, 100dvh) - 16px) * 390 / 780)) !important; height: calc(var(--na-phh, 100dvh) - 16px) !important; }
  .na_phl .na_ph_scr { aspect-ratio: auto !important; height: 100% !important; }
  .na_phl .cg_canvas { height: calc(100% / var(--k)) !important; } }`;
const SIZES = { chrome: 682, app: 735 };
(async () => {
  for (const [sz, H] of Object.entries(SIZES)) for (const opt of ['now', 'opt1']) {
    fs.copyFileSync(path.join(__dirname, '../../../tools/dev/na_test.jsonl'), CHAT);
    const s = await open('light', { out: os.tmpdir(), width: 360, height: H, mobile: true }); const p = s.p;
    try {
      await s.run(SAMPLE_MONEY);
      if (opt === 'opt1') { await p.addStyleTag({ content: OPT }); await p.waitForTimeout(500); }
      const shot = async n => { await p.waitForTimeout(450); await p.screenshot({ path: path.join(__dirname, `c_${sz}_${opt}_${n}.png`) }); };
      await s.to('home'); await shot('home'); await s.to('set'); await shot('set');
      console.log(sz, opt, JSON.stringify(await p.evaluate(() => { const f = document.querySelector('.na_ph_frame'), r = f.getBoundingClientRect(), c = f.querySelector('.cg_canvas'); return { frame: [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)], board: [c.offsetWidth, c.offsetHeight] }; })));
      await s.run(async ({ m }) => { const n = SillyTavern.getContext().chat.length - 1; const t = String(m.text), cut = t.search(/\n# STATE/), add = `\n## #26–#${n} — Am Fluss (Oct 25, night, Varo)\n- Sie redeten.\n`; m.text = cut >= 0 ? t.slice(0, cut).replace(/\s*$/, '') + '\n' + add + t.slice(cut) : t + add; m.boundary = n; });
      await s.to('set'); await p.click('.na_ph_pmode[data-v=live]'); await p.waitForTimeout(600); await p.click('.na_ob_start'); await p.waitForTimeout(2000);
      await s.to('orbitnew'); await p.waitForTimeout(400); await p.locator('.na_ph_frame .na_ob_pick', { hasText: 'Mara' }).first().click(); await p.waitForTimeout(300); await p.click('.na_ph_frame .na_ob_make'); await p.waitForTimeout(500);
      const rid = await p.evaluate(async B => { const core = await import(B + 'core.js'), st = await import(B + 'phone2store.js'); const m = core.getMeta(), r = st.liveRooms(m)[0], me = st.liveWorld(m).persona; const T = [[me, '내일 열 시에 정비소 올 수 있어?', ''], ['Mara', 'Ja klar, Samstag passt!', '응 좋아, 토요일 괜찮아!'], ['Mara', 'Bring Kuchen mit 😄', '케이크 가져와 😄'], [me, '무슨 케이크', ''], ['Mara', 'Den mit Kirschen', '체리 든 거'], ['Mara', 'Vom Bäcker an der Ecke', '모퉁이 빵집 거'], [me, '거기 일찍 닫잖아', ''], ['Mara', 'Dann geh halt früher', '그럼 좀 일찍 가'], [me, '알겠어 내일 봐', ''], ['Mara', 'Bis morgen', '내일 봐']]; const t0 = Date.now() - T.length * 60000; r.messages = T.map(([from, text, ko], i) => ({ id: `mk${i}`, from, text, ko, at: t0 + i * 60000, told: true, ...(from === 'Mara' ? { state: '회사 · 점심 먹고 자리' } : {}) })); for (const n of r.members) (r.read ||= {})[st.liveKey(n)] = Date.now(); return r.id; }, B);
      await s.to('orbit'); await s.to('orbitroom', rid); await shot('room');
    } finally { await s.close(); }
  }
  reset(); console.log('ok');
})().catch(e => { console.error(e); reset(); process.exit(1); });
