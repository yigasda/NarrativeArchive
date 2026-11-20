// 아이폰 비율(390:844)로 되돌리고 테두리 · 큰 여백만 없애기: 세로를 꽉 채우고 가로는 비율만큼(양옆에 가는 띠). 소망 폰 크기 360 × 735.
// 실제 폰 창에서 크기 규칙만 바꿔 한 장씩 찍어요. node docs/mockups/phone-fit/mock6.cjs → r1_home.png · r1_home2.png · r1_set.png · r1_orbitroom.png · r1_orbit.png
const { open, SAMPLE_MONEY } = require('../../../tools/dev/probe.cjs');
const fs = require('fs'), path = require('path'), os = require('os');
const CHAT = path.join(os.homedir(), 'sillytavern/data/default-user/chats/default_Seraphina/na_test.jsonl');
const reset = () => fs.copyFileSync(path.join(__dirname, '../../../tools/dev/na_test.jsonl'), CHAT);
const B = '/scripts/extensions/third-party/NarrativeArchive/src/';
const CSS = `.na_phl .na_ph_wrap { padding: 0 !important; align-items: center !important; }
  .na_phl .na_ph_frame { width: min(100vw, calc(var(--na-phh, 100dvh) * 390 / 844)) !important; height: auto !important; padding: 0 !important; border-radius: calc(44px * var(--k)) !important; box-shadow: none !important; background: none !important; }
  .na_phl .na_ph_scr { aspect-ratio: 390 / 844 !important; height: auto !important; border-radius: calc(44px * var(--k)) !important; }
  .na_phl .cg_canvas { height: 844px !important; }`;
(async () => {
  const s = await open('light', { out: os.tmpdir(), width: 360, height: 735, mobile: true }); const p = s.p;
  try {
    await s.run(SAMPLE_MONEY);
    await p.addStyleTag({ content: CSS }); await p.waitForTimeout(500);
    const shot = async n => { await p.waitForTimeout(450); await p.screenshot({ path: path.join(__dirname, `r1_${n}.png`) }); };
    console.log(JSON.stringify(await p.evaluate(() => { const f = document.querySelector('.na_ph_frame'), r = f.getBoundingClientRect(); return { win: [innerWidth, innerHeight], frame: [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)], k: f.style.getPropertyValue('--k') }; })));
    await s.to('home'); await shot('home'); await s.to('home2'); await shot('home2'); await s.to('set'); await shot('set');
    await s.run(async ({ m }) => { const n = SillyTavern.getContext().chat.length - 1; const t = String(m.text), cut = t.search(/\n# STATE/), add = `\n## #26–#${n} — Am Fluss (Oct 25, night, Varo)\n- Sie redeten.\n`; m.text = cut >= 0 ? t.slice(0, cut).replace(/\s*$/, '') + '\n' + add + t.slice(cut) : t + add; m.boundary = n; });
    await s.to('set'); await p.click('.na_ph_pmode[data-v=live]'); await p.waitForTimeout(600); await p.click('.na_ob_start'); await p.waitForTimeout(2000);
    await s.to('orbitnew'); await p.waitForTimeout(400); await p.locator('.na_ph_frame .na_ob_pick', { hasText: 'Mara' }).first().click(); await p.waitForTimeout(300); await p.click('.na_ph_frame .na_ob_make'); await p.waitForTimeout(500);
    const rid = await p.evaluate(async B => { const core = await import(B + 'core.js'), st = await import(B + 'phone2store.js'); const m = core.getMeta(), r = st.liveRooms(m)[0], me = st.liveWorld(m).persona; const T = [[me, '내일 열 시에 정비소 올 수 있어?', ''], ['Mara', 'Ja klar, Samstag passt!', '응 좋아, 토요일 괜찮아!'], ['Mara', 'Bring Kuchen mit 😄', '케이크 가져와 😄'], [me, '무슨 케이크', ''], ['Mara', 'Den mit Kirschen', '체리 든 거'], ['Mara', 'Vom Bäcker an der Ecke', '모퉁이 빵집 거'], [me, '거기 일찍 닫잖아', ''], ['Mara', 'Dann geh halt früher', '그럼 좀 일찍 가'], [me, '알겠어 내일 봐', ''], ['Mara', 'Bis morgen', '내일 봐']]; const t0 = Date.now() - T.length * 60000; r.messages = T.map(([from, text, ko], i) => ({ id: `mk${i}`, from, text, ko, at: t0 + i * 60000, told: true, ...(from === 'Mara' ? { state: '회사 · 점심 먹고 자리' } : {}) })); for (const n of r.members) (r.read ||= {})[st.liveKey(n)] = Date.now(); return r.id; }, B);
    await s.to('orbit'); await shot('orbit'); await s.to('orbitroom', rid); await shot('orbitroom');
    console.log('ok', s.errors().slice(0, 3));
  } finally { await s.close(); reset(); }
})().catch(e => { console.error(e); reset(); process.exit(1); });
