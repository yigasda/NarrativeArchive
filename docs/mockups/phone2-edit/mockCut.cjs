// Orbit 방 위쪽에서 말풍선이 딱 잘려 보이는 것: 지금 + T1~T3. 실제 방(말이 많아 굴린 상태)에서 바꿔 찍어요.
// node docs/mockups/phone2-edit/mockCut.cjs → sheetCut.jpg
const { open } = require('../../../tools/dev/probe.cjs');
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path'), os = require('os');
const CHAT = path.join(os.homedir(), 'sillytavern/data/default-user/chats/default_Seraphina/na_test.jsonl');
const reset = () => fs.copyFileSync(path.join(__dirname, '../../../tools/dev/na_test.jsonl'), CHAT);
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'cutmock'));
const B = '/scripts/extensions/third-party/NarrativeArchive/src/';
const V = {
  now: '',
  // T1: 위쪽이 서서히 옅어지며 사라져요 (배치는 그대로)
  T1: `.ax .ob_msgs { -webkit-mask-image: linear-gradient(to bottom, transparent 0, #000 44px) !important; mask-image: linear-gradient(to bottom, transparent 0, #000 44px) !important; }`,
  // T2: 칩을 말 위에 띄워요 (말이 머리줄 바로 밑까지 올라가고 칩 뒤로 지나가요)
  T2: `.ax .ob_chips { position: absolute !important; left: 0; right: 0; top: 120px; z-index: 3 !important; pointer-events: none; }
       .ax .ob_msgs { -webkit-mask-image: linear-gradient(to bottom, transparent 0, #000 22px) !important; mask-image: linear-gradient(to bottom, transparent 0, #000 22px) !important; }`,
  // T3: 칩을 머리줄 안으로 (이름 아래 줄 끝에 "현지 13:27"), 말은 머리줄 바로 밑에서 옅어지며 시작
  T3: `.ax .ob_chips { display: none !important; }
       .ax .ob_msgs { -webkit-mask-image: linear-gradient(to bottom, transparent 0, #000 22px) !important; mask-image: linear-gradient(to bottom, transparent 0, #000 22px) !important; }`,
};
(async () => {
  const s = await open('light', { out: TMP }); const p = s.p;
  try {
    await s.run(async ({ m }) => { const n = SillyTavern.getContext().chat.length - 1; const t = String(m.text), cut = t.search(/\n# STATE/), add = `\n## #26–#${n} — Am Fluss (Oct 25, night, Varo)\n- Sie redeten.\n`; m.text = cut >= 0 ? t.slice(0, cut).replace(/\s*$/, '') + '\n' + add + t.slice(cut) : t + add; m.boundary = n; });
    await s.to('set'); await p.click('.na_ph_pmode[data-v=live]'); await p.waitForTimeout(600); await p.click('.na_ob_start'); await p.waitForTimeout(2000);
    await s.to('orbitnew'); await p.waitForTimeout(400); await p.locator('.na_ph_frame .na_ob_pick', { hasText: 'Mara' }).first().click(); await p.waitForTimeout(300); await p.click('.na_ph_frame .na_ob_make'); await p.waitForTimeout(500);
    // 말을 넉넉히 (가짜 모델 없이 방에 직접 넣어요)
    const rid = await p.evaluate(async B => { const core = await import(B + 'core.js'), st = await import(B + 'phone2store.js'); const m = core.getMeta(), r = st.liveRooms(m)[0], me = st.liveWorld(m).persona; const T = [[me, '내일 열 시에 정비소 올 수 있어?', ''], ['Mara', 'Ja klar, Samstag passt!', '응 좋아, 토요일 괜찮아!'], ['Mara', 'Bring Kuchen mit 😄', '케이크 가져와 😄'], [me, '무슨 케이크', ''], ['Mara', 'Den mit Kirschen', '체리 든 거'], ['Mara', 'Vom Bäcker an der Ecke', '모퉁이 빵집 거'], [me, '거기 일찍 닫잖아', ''], ['Mara', 'Dann geh halt früher', '그럼 좀 일찍 가'], ['Mara', 'Ich zahl auch', '돈은 내가 낼게'], [me, '오 진짜?', ''], ['Mara', 'Nur dieses eine Mal', '이번 한 번만이야'], [me, '알겠어 내일 봐', ''], ['Mara', 'Bis morgen', '내일 봐']]; const t0 = Date.now() - T.length * 60000; r.messages = T.map(([from, text, ko], i) => ({ id: `mk${i}`, from, text, ko, at: t0 + i * 60000, told: true })); for (const n of r.members) (r.read ||= {})[st.liveKey(n)] = Date.now(); return r.id; }, B);
    const st = await p.evaluateHandle(() => { const e = document.createElement('style'); document.head.append(e); return e; });
    const shots = {};
    for (const k of Object.keys(V)) {
      await s.to('orbit'); await s.to('orbitroom', rid); await p.waitForTimeout(400);
      await st.evaluate((e, css) => { e.textContent = css; }, V[k]);
      if (k === 'T3') await p.evaluate(() => { const c = document.querySelector('.na_ph_frame .ob_chip'); const sub = document.querySelector('.na_ph_frame .ob_nm span'); const t = (c?.innerText || '').replace(/^.*현지/, '현지'); if (sub) sub.textContent = `${sub.textContent} · ${t}`; });
      await p.evaluate(() => { const e = document.querySelector('.na_ph_frame .ob_msgs'); e.scrollTop = e.scrollHeight; e.scrollTop -= 118; }); await p.waitForTimeout(300);
      shots[k] = await s.shot('cut_' + k);
    }
    const names = { now: '지금', T1: 'T1. 위쪽이 서서히 사라지게', T2: 'T2. 칩을 말 위에 띄우기', T3: 'T3. 칩을 머리줄 안으로' };
    const b = await chromium.launch(), pg = await b.newPage({ deviceScaleFactor: 1 });
    await pg.setContent(`<html><body style="margin:0;padding:24px;background:#d9dbe0;font-family:-apple-system,'Noto Sans KR',sans-serif;width:max-content"><div style="display:flex;gap:18px">${Object.keys(names).map(k => `<div><h2 style="font-size:16px;margin:0 0 10px">${names[k]}</h2><div style="width:340px;height:400px;overflow:hidden;border-radius:22px"><img style="width:340px;display:block" src="data:image/png;base64,${fs.readFileSync(shots[k]).toString('base64')}"></div></div>`).join('')}</div></body></html>`);
    await pg.screenshot({ path: path.join(__dirname, 'sheetCut.jpg'), fullPage: true, type: 'jpeg', quality: 90 }); await b.close();
    console.log('ok', s.errors().slice(0, 3));
  } finally { await s.close(); reset(); }
})().catch(e => { console.error(e); reset(); process.exit(1); });
