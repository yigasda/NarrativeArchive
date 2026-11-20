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
const V = {
  now: { css: '', k: null },
  // N1: 여백 없이, 얇은 테두리(3px)만. 비율은 그대로라 남는 쪽은 까맣게
  N1: { css: `.na_phl .na_ph_wrap { padding: 0 !important; } .na_phl_root { padding: 0 !important; } .na_phl_top { display: none !important; }
      .na_phl .na_ph_frame { padding: 3px !important; width: min(100vw, calc(var(--na-phh, 100dvh) * 390 / 844 + 6px)) !important; border-radius: calc(40px * var(--k)) !important; box-shadow: none !important; }
      .na_phl .na_ph_scr { border-radius: calc(37px * var(--k)) !important; }`, pad: 6 },
  // N2: 여백도 테두리도 없이. 비율은 그대로, 모서리는 둥글게
  N2: { css: `.na_phl .na_ph_wrap { padding: 0 !important; } .na_phl_root { padding: 0 !important; } .na_phl_top { display: none !important; }
      .na_phl .na_ph_frame { padding: 0 !important; width: min(100vw, calc(var(--na-phh, 100dvh) * 390 / 844)) !important; border-radius: calc(34px * var(--k)) !important; box-shadow: none !important; background: none !important; }
      .na_phl .na_ph_scr { border-radius: calc(34px * var(--k)) !important; }`, pad: 0 },
  // N3: 화면을 통째로 채워요. 가로를 꽉 채우고 세로는 폰 높이에 맞춰 줄이거나 늘려요(모서리는 기기 모양 그대로)
  N3: { css: `.na_phl .na_ph_wrap { padding: 0 !important; align-items: stretch !important; } .na_phl_root { padding: 0 !important; } .na_phl_top { display: none !important; }
      .na_phl .na_ph_frame { padding: 0 !important; width: 100vw !important; height: 100% !important; border-radius: 0 !important; box-shadow: none !important; background: none !important; }
      .na_phl .na_ph_scr { aspect-ratio: auto !important; height: 100% !important; border-radius: 0 !important; }
      .na_phl .cg_canvas { height: calc(100% / var(--k)) !important; }`, pad: 0 },
};
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
      if (V[k].pad != null) await p.evaluate(pad => { const f = document.querySelector('.na_ph_frame'); f.style.setProperty('--k', String((f.clientWidth - pad) / 390)); }, V[k].pad);
      for (const [v, i] of [['orbitroom', rid], ['home']]) { await s.to(v, i); await p.waitForTimeout(500); if (V[k].pad != null) await p.evaluate(pad => { const f = document.querySelector('.na_ph_frame'); f.style.setProperty('--k', String((f.clientWidth - pad) / 390)); }, V[k].pad); await p.waitForTimeout(200); const f = path.join(TMP, `fit_${k}_${v}.png`); await p.screenshot({ path: f }); shots[`${k}_${v}`] = f; }
    }
    const names = { now: '지금', N1: 'N1. 여백 없이, 얇은 테두리만', N2: 'N2. 여백 · 테두리 없이 (비율 그대로)', N3: 'N3. 화면을 통째로 채우기' };
    const b = await chromium.launch(), pg = await b.newPage({ deviceScaleFactor: 1 });
    await pg.setContent(`<html><body style="margin:0;padding:24px;background:#d9dbe0;font-family:-apple-system,'Noto Sans KR',sans-serif;width:max-content"><div style="display:flex;gap:26px">${Object.keys(names).map(k => `<div><h2 style="font-size:16px;margin:0 0 10px">${names[k]}</h2><div style="display:flex;gap:8px">${['orbitroom', 'home'].map(v => `<img style="width:250px;display:block;border-radius:6px;outline:1px solid #b9bcc4" src="data:image/png;base64,${fs.readFileSync(shots[k + '_' + v]).toString('base64')}">`).join('')}</div></div>`).join('')}</div></body></html>`);
    await pg.screenshot({ path: path.join(__dirname, 'sheet.jpg'), fullPage: true, type: 'jpeg', quality: 88 }); await b.close();
    console.log('ok', s.errors().slice(0, 3));
  } finally { await s.close(); reset(); }
})().catch(e => { console.error(e); reset(); process.exit(1); });
