// (칩 줄을 없애고 현지 시각을 머리줄 안에: 4 · 5 · 6. 상태 글이 길 때)
// Orbit 방 위쪽에서 말풍선이 딱 잘려 보이는 것: 지금 + T1~T3. 실제 방(말이 많아 굴린 상태)에서 바꿔 찍어요.
// node docs/mockups/phone2-edit/mockCut.cjs → sheetCut.jpg
const { open } = require('../../../tools/dev/probe.cjs');
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path'), os = require('os');
const CHAT = path.join(os.homedir(), 'sillytavern/data/default-user/chats/default_Seraphina/na_test.jsonl');
const reset = () => fs.copyFileSync(path.join(__dirname, '../../../tools/dev/na_test.jsonl'), CHAT);
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'cutmock'));
const B = '/scripts/extensions/third-party/NarrativeArchive/src/';
const MOON = c => `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/></svg>`;
const BASE = `.ax .ob_chips { display: none !important; } .ax .ob_chips + .ob_msgs .ob_mi { padding-top: 12px !important; }
  .mk_t { display: inline-flex; align-items: center; gap: 4px; font: 600 12.500px 'Inter Tight', sans-serif; white-space: nowrap; }`;
const V = {
  // T4: 머리줄 오른쪽 끝에 작은 유리 알약 (달 + 시각)
  T4: `${BASE} .mk_t4 { flex: none; margin-left: auto; padding: 6px 10px; border-radius: 999px; background: rgba(20,22,30,.26); color: #fff; box-shadow: inset 0 1px 0 rgba(255,255,255,.2); }`,
  // T5: 이름 아랫줄 맨 앞에 달 + 시각, 그 뒤에 상태 (길면 상태가 줄어들어요)
  T5: `${BASE} .ax .ob_nm > span { display: flex !important; align-items: center; gap: 6px; min-width: 0; } .mk_t5 { flex: none; color: #2b2f37; } .mk_st { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }`,
  // T6: 이름 바로 옆에 달 + 시각 (아랫줄은 상태만)
  T6: `${BASE} .ax .ob_nm > b { display: flex !important; align-items: center; gap: 8px; } .mk_t6 { color: rgba(30,32,40,.6); font-weight: 600; }`,
};
(async () => {
  const s = await open('light', { out: TMP }); const p = s.p;
  try {
    await s.run(async ({ m }) => { const n = SillyTavern.getContext().chat.length - 1; const t = String(m.text), cut = t.search(/\n# STATE/), add = `\n## #26–#${n} — Am Fluss (Oct 25, night, Varo)\n- Sie redeten.\n`; m.text = cut >= 0 ? t.slice(0, cut).replace(/\s*$/, '') + '\n' + add + t.slice(cut) : t + add; m.boundary = n; });
    await s.to('set'); await p.click('.na_ph_pmode[data-v=live]'); await p.waitForTimeout(600); await p.click('.na_ob_start'); await p.waitForTimeout(2000);
    await s.to('orbitnew'); await p.waitForTimeout(400); await p.locator('.na_ph_frame .na_ob_pick', { hasText: 'Mara' }).first().click(); await p.waitForTimeout(300); await p.click('.na_ph_frame .na_ob_make'); await p.waitForTimeout(500);
    // 말을 넉넉히 (가짜 모델 없이 방에 직접 넣어요)
    const rid = await p.evaluate(async B => { const core = await import(B + 'core.js'), st = await import(B + 'phone2store.js'); const m = core.getMeta(), r = st.liveRooms(m)[0], me = st.liveWorld(m).persona; const T = [[me, '내일 열 시에 정비소 올 수 있어?', ''], ['Mara', 'Ja klar, Samstag passt!', '응 좋아, 토요일 괜찮아!'], ['Mara', 'Bring Kuchen mit 😄', '케이크 가져와 😄'], [me, '무슨 케이크', ''], ['Mara', 'Den mit Kirschen', '체리 든 거'], ['Mara', 'Vom Bäcker an der Ecke', '모퉁이 빵집 거'], [me, '거기 일찍 닫잖아', ''], ['Mara', 'Dann geh halt früher', '그럼 좀 일찍 가'], ['Mara', 'Ich zahl auch', '돈은 내가 낼게'], [me, '오 진짜?', ''], ['Mara', 'Nur dieses eine Mal', '이번 한 번만이야'], [me, '알겠어 내일 봐', ''], ['Mara', 'Bis morgen', '내일 봐']]; const t0 = Date.now() - T.length * 60000; r.messages = T.map(([from, text, ko], i) => ({ id: `mk${i}`, from, text, ko, at: t0 + i * 60000, told: true, ...(from === 'Mara' ? { state: '회사 · 점심 먹고 자리에서 서류 정리하는 중' } : {}) })); for (const n of r.members) (r.read ||= {})[st.liveKey(n)] = Date.now(); return r.id; }, B);
    const st = await p.evaluateHandle(() => { const e = document.createElement('style'); document.head.append(e); return e; });
    const shots = {};
    for (const k of Object.keys(V)) {
      await s.to('orbit'); await s.to('orbitroom', rid); await p.waitForTimeout(400);
      await st.evaluate((e, css) => { e.textContent = css; }, V[k]);
      await p.evaluate(([k, moonW, moonD, moonG]) => { const ct = document.querySelector('.na_ph_frame .ob_ct'), nm = ct.querySelector('.ob_nm'), sub = nm.querySelector('span'), name = nm.querySelector('b');
        if (k === 'T4') ct.insertAdjacentHTML('beforeend', `<span class="mk_t mk_t4">${moonW}23:36</span>`);
        if (k === 'T5' && sub) sub.innerHTML = `<span class="mk_t mk_t5">${moonD}23:36</span><span class="mk_st">${sub.textContent}</span>`;
        if (k === 'T6') name.insertAdjacentHTML('beforeend', `<span class="mk_t mk_t6">${moonG}23:36</span>`); }, [k, MOON('#fff'), MOON('#2b2f37'), MOON('rgba(30,32,40,.6)')]);
      await p.evaluate(() => { const e = document.querySelector('.na_ph_frame .ob_msgs'); e.scrollTop = e.scrollHeight; e.scrollTop -= 118; }); await p.waitForTimeout(300);
      shots[k] = await s.shot('cut_' + k);
    }
    const names = { T4: '4. 머리줄 오른쪽 끝 알약', T5: '5. 아랫줄 맨 앞에 (상태가 줄어듦)', T6: '6. 이름 바로 옆에' };
    const b = await chromium.launch(), pg = await b.newPage({ deviceScaleFactor: 1 });
    await pg.setContent(`<html><body style="margin:0;padding:24px;background:#d9dbe0;font-family:-apple-system,'Noto Sans KR',sans-serif;width:max-content"><div style="display:flex;gap:18px">${Object.keys(names).map(k => `<div><h2 style="font-size:16px;margin:0 0 10px">${names[k]}</h2><div style="width:420px;height:330px;overflow:hidden;border-radius:22px"><img style="width:420px;display:block" src="data:image/png;base64,${fs.readFileSync(shots[k]).toString('base64')}"></div></div>`).join('')}</div></body></html>`);
    await pg.screenshot({ path: path.join(__dirname, 'sheetCut2.jpg'), fullPage: true, type: 'jpeg', quality: 90 }); await b.close();
    console.log('ok', s.errors().slice(0, 3));
  } finally { await s.close(); reset(); }
})().catch(e => { console.error(e); reset(); process.exit(1); });
