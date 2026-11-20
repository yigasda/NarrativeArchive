// (N4: 갤럭시 폰 크기 360 × 735로 한 장씩 깨끗하게 → n4_orbitroom.png · n4_home.png · n4_orbit.png · n4_set.png)
// 좁은 화면(진짜 폰)에서 폰 창: 까만 여백 · 테두리 없애기. 지금 + N1~N3, 방과 홈 두 화면씩. 실제 폰 창에서 크기 규칙만 바꿔 찍어요.
// node docs/mockups/phone-fit/mock.cjs → sheet.jpg   (창 크기 360 × 735: 세로로 긴 폰)
const { open } = require('../../../tools/dev/probe.cjs');
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path'), os = require('os');
const CHAT = path.join(os.homedir(), 'sillytavern/data/default-user/chats/default_Seraphina/na_test.jsonl');
const reset = () => fs.copyFileSync(path.join(__dirname, '../../../tools/dev/na_test.jsonl'), CHAT);
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'fitmock'));
const B = '/scripts/extensions/third-party/NarrativeArchive/src/';
const W = 360, H = 735;
// k: 보드(390)를 얼마로 줄여 그릴지. pad: 테두리 두께
const FILL = `.na_phl .na_ph_wrap { padding: 0 !important; align-items: stretch !important; } .na_phl_root { padding: 0 !important; } .na_phl_top { display: none !important; }
      .na_phl .na_ph_frame { padding: 0 !important; width: 100vw !important; height: 100% !important; border-radius: 0 !important; box-shadow: none !important; background: none !important; }
      .na_phl .na_ph_scr { aspect-ratio: auto !important; height: 100% !important; border-radius: 0 !important; }
      .na_phl .cg_canvas { width: calc(100% / var(--k)) !important; height: calc(100% / var(--k)) !important; }`;
// kv: 보드를 줄여 그리는 값을 직접 정해요 (작을수록 글자 · 아이콘이 작고 한 화면에 더 많이 들어가요)
const V = { N4: { css: FILL, kv: 0.836 } };   // 통째로 채우되 크기는 지금 그대로
(async () => {
  const s = await open('light', { out: TMP, width: W }); const p = s.p;
  try {
    await s.run(async ({ m }) => { const n = SillyTavern.getContext().chat.length - 1; const t = String(m.text), cut = t.search(/\n# STATE/), add = `\n## #26–#${n} — Am Fluss (Oct 25, night, Varo)\n- Sie redeten.\n`; m.text = cut >= 0 ? t.slice(0, cut).replace(/\s*$/, '') + '\n' + add + t.slice(cut) : t + add; m.boundary = n; });
    await s.to('set'); await p.click('.na_ph_pmode[data-v=live]'); await p.waitForTimeout(600); await p.click('.na_ob_start'); await p.waitForTimeout(2000);
    await s.to('orbitnew'); await p.waitForTimeout(400); await p.locator('.na_ph_frame .na_ob_pick', { hasText: 'Mara' }).first().click(); await p.waitForTimeout(300); await p.click('.na_ph_frame .na_ob_make'); await p.waitForTimeout(500);
    const rid = await p.evaluate(async B => { const core = await import(B + 'core.js'), st = await import(B + 'phone2store.js'); const m = core.getMeta(), r = st.liveRooms(m)[0], me = st.liveWorld(m).persona; const T = [[me, '내일 열 시에 정비소 올 수 있어?', ''], ['Mara', 'Ja klar, Samstag passt!', '응 좋아, 토요일 괜찮아!'], ['Mara', 'Bring Kuchen mit 😄', '케이크 가져와 😄'], [me, '무슨 케이크', ''], ['Mara', 'Den mit Kirschen', '체리 든 거'], ['Mara', 'Vom Bäcker an der Ecke', '모퉁이 빵집 거'], [me, '거기 일찍 닫잖아', ''], ['Mara', 'Dann geh halt früher', '그럼 좀 일찍 가'], [me, '알겠어 내일 봐', ''], ['Mara', 'Bis morgen', '내일 봐']]; const t0 = Date.now() - T.length * 60000; r.messages = T.map(([from, text, ko], i) => ({ id: `mk${i}`, from, text, ko, at: t0 + i * 60000, told: true, ...(from === 'Mara' ? { state: '회사 · 점심 먹고 자리' } : {}) })); for (const n of r.members) (r.read ||= {})[st.liveKey(n)] = Date.now(); return r.id; }, B);
    await p.setViewportSize({ width: W, height: H }); await p.waitForTimeout(600);
    const st = await p.evaluateHandle(() => { const e = document.createElement('style'); document.head.append(e); return e; });
    const shots = {};
    for (const k of Object.keys(V)) {
      await st.evaluate((e, css) => { e.textContent = css; }, V[k].css); await p.waitForTimeout(300);
      // (보드 줄이는 값은 폰 틀 너비에서: 테두리 두께가 바뀌면 다시 맞춰요)
      await p.evaluate(kv => { document.querySelector('.na_ph_frame').style.setProperty('--k', String(kv)); }, V[k].kv);
      for (const [v, i] of [['orbitroom', rid], ['home'], ['orbit'], ['set']]) { await s.to(v, i); await p.waitForTimeout(500); await p.evaluate(kv => { document.querySelector('.na_ph_frame').style.setProperty('--k', String(kv)); }, V[k].kv); await p.waitForTimeout(200); const f = path.join(__dirname, `n4_${v}.png`); await p.screenshot({ path: f }); shots[`${k}_${v}`] = f; }
    }
    console.log('ok', s.errors().slice(0, 3));
  } finally { await s.close(); reset(); }
})().catch(e => { console.error(e); reset(); process.exit(1); });
