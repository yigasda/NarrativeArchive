// 선택 줄 · 받아 둔 답장 창이 "갑자기 하양 단색"이라 촌스러워요 → Orbit 머리줄 같은 유리로. 지금 + G1~G3, 두 화면씩.
// 실제 방 화면에 색 · 재질만 바꿔 찍어요. node docs/mockups/phone2-edit/mockGlass.cjs → sheetGlass.jpg
const { open } = require('../../../tools/dev/probe.cjs');
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path'), os = require('os');
const CHAT = path.join(os.homedir(), 'sillytavern/data/default-user/chats/default_Seraphina/na_test.jsonl');
const reset = () => fs.copyFileSync(path.join(__dirname, '../../../tools/dev/na_test.jsonl'), CHAT);
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'glassmock'));
const B = '/scripts/extensions/third-party/NarrativeArchive/src/';
const GL = 'backdrop-filter: blur(22px) saturate(1.35) !important; -webkit-backdrop-filter: blur(22px) saturate(1.35) !important;';
const V = {
  now: '',
  // G1: 머리줄과 같은 밝은 유리 (방 색이 비쳐요). 버튼도 유리 알약, 버리기만 진한 유리
  G1: `.ax .ob_pbar, .ax .ob_sl { background: rgba(255,255,255,.5) !important; ${GL} box-shadow: inset 0 1px 0 rgba(255,255,255,.7), inset 0 0 0 1px rgba(255,255,255,.35), 0 10px 30px rgba(40,40,80,.16) !important; }
    .ax .ob_shade { background: rgba(20,22,30,.12) !important; }
    .ax .ob_pbtn button, .ax .ob_sl .ob_bkno { --axbg: rgba(255,255,255,.55) !important; background: rgba(255,255,255,.55) !important; box-shadow: inset 0 1px 0 rgba(255,255,255,.8) !important; color: #1b1d24 !important; }
    .ax .ob_pbtn .red { --axbg: rgba(255,255,255,.55) !important; color: #b8402f !important; --axfg: #b8402f !important; }
    .ax .ob_sl .ob_bkok { --axbg: rgba(20,22,30,.78) !important; background: rgba(20,22,30,.78) !important; box-shadow: inset 0 1px 0 rgba(255,255,255,.16) !important; }
    .ax .ob_slb { border-left-color: rgba(30,32,40,.16) !important; } .ax .ob_slr.now .ob_slb { border-left-color: #15161a !important; }
    .ax .ob_sln, .ax .ob_sll small, .ax .ob_slh span { color: rgba(30,32,40,.55) !important; } .ax .ob_slr.now .ob_sln { color: #15161a !important; }
    .ax .ob_sl .ob_pck { border-color: rgba(30,32,40,.3) !important; } .ax .ob_sl .ob_pck.on { border-color: #15161a !important; } .ax .ob_sl .ob_grab { background: rgba(30,32,40,.22) !important; }`,
  // G2: 내 말풍선과 같은 어두운 유리. 글자는 흰색
  G2: `.ax .ob_pbar, .ax .ob_sl { background: rgba(20,22,30,.72) !important; ${GL} box-shadow: inset 0 1px 0 rgba(255,255,255,.16), 0 12px 30px rgba(20,22,40,.28) !important; color: #fff !important; --axfg: #fff !important; }
    .ax .ob_shade { background: rgba(20,22,30,.12) !important; }
    .ax .ob_pbtn button, .ax .ob_sl .ob_bkno { --axbg: rgba(255,255,255,.14) !important; background: rgba(255,255,255,.14) !important; color: #fff !important; --axfg: #fff !important; box-shadow: inset 0 1px 0 rgba(255,255,255,.14) !important; }
    .ax .ob_pbtn .red { color: #ff9c8d !important; --axfg: #ff9c8d !important; }
    .ax .ob_sl .ob_bkok { --axbg: rgba(255,255,255,.92) !important; background: rgba(255,255,255,.92) !important; color: #15161a !important; --axfg: #15161a !important; }
    .ax .ob_slb { border-left-color: rgba(255,255,255,.18) !important; } .ax .ob_slr.now .ob_slb { border-left-color: #fff !important; }
    .ax .ob_sln, .ax .ob_sll small, .ax .ob_slh span { color: rgba(255,255,255,.55) !important; } .ax .ob_slr.now .ob_sln { color: #fff !important; }
    .ax .ob_sl .ob_pck { border-color: rgba(255,255,255,.45) !important; } .ax .ob_sl .ob_pck.on { background: #fff !important; border-color: #fff !important; } .ax .ob_sl .ob_pck.on svg { stroke: #15161a !important; } .ax .ob_sl .ob_grab { background: rgba(255,255,255,.3) !important; }`,
  // G3: 더 옅은 유리 (테두리 빛만 또렷하게). 답장 줄은 유리 말풍선으로, 버튼은 글자만
  G3: `.ax .ob_pbar, .ax .ob_sl { background: rgba(255,255,255,.3) !important; ${GL} box-shadow: inset 0 1px 0 rgba(255,255,255,.8), inset 0 0 0 1px rgba(255,255,255,.45), 0 10px 30px rgba(40,40,80,.16) !important; }
    .ax .ob_shade { background: rgba(20,22,30,.06) !important; }
    .ax .ob_pbtn button { --axbg: transparent !important; background: none !important; padding: 9px 9px !important; color: #1b1d24 !important; } .ax .ob_pbtn .red { color: #b8402f !important; --axfg: #b8402f !important; }
    .ax .ob_sl .ob_bkno { --axbg: rgba(255,255,255,.5) !important; background: rgba(255,255,255,.5) !important; box-shadow: inset 0 1px 0 rgba(255,255,255,.8) !important; }
    .ax .ob_sl .ob_bkok { --axbg: rgba(20,22,30,.78) !important; background: rgba(20,22,30,.78) !important; box-shadow: inset 0 1px 0 rgba(255,255,255,.16) !important; }
    .ax .ob_slb { border-left: 0 !important; padding-left: 0 !important; display: flex; flex-direction: column; align-items: flex-start; gap: 5px; }
    .ax .ob_sll { margin: 0 !important; padding: 8px 12px; border-radius: 18px; border-bottom-left-radius: 6px; background: rgba(255,255,255,.55); box-shadow: inset 0 1px 0 rgba(255,255,255,.7); }
    .ax .ob_slr.now .ob_sll { background: rgba(255,255,255,.85); }
    .ax .ob_sln, .ax .ob_sll small, .ax .ob_slh span { color: rgba(30,32,40,.6) !important; } .ax .ob_slr.now .ob_sln { color: #15161a !important; }
    .ax .ob_sl .ob_pck { border-color: rgba(30,32,40,.3) !important; } .ax .ob_sl .ob_pck.on { border-color: #15161a !important; } .ax .ob_sl .ob_grab { background: rgba(30,32,40,.22) !important; }`,
};
(async () => {
  const s = await open('light', { out: TMP }); const p = s.p;
  try {
    await s.run(async ({ m }) => { const n = SillyTavern.getContext().chat.length - 1; const t = String(m.text), cut = t.search(/\n# STATE/), add = `\n## #26–#${n} — Am Fluss (Oct 25, night, Varo)\n- Sie redeten.\n`; m.text = cut >= 0 ? t.slice(0, cut).replace(/\s*$/, '') + '\n' + add + t.slice(cut) : t + add; m.boundary = n; });
    await s.to('set'); await p.click('.na_ph_pmode[data-v=live]'); await p.waitForTimeout(600); await p.click('.na_ob_start'); await p.waitForTimeout(2000);
    await s.to('orbitnew'); await p.waitForTimeout(400); await p.locator('.na_ph_frame .na_ob_pick', { hasText: 'Mara' }).first().click(); await p.waitForTimeout(300); await p.click('.na_ph_frame .na_ob_make'); await p.waitForTimeout(500);
    const send = async t => { await p.evaluate(t => { const f = document.querySelector('.na_ph_frame .na_ob_in'); f.textContent = t; f.dispatchEvent(new Event('input', { bubbles: true })); }, t); await p.click('.na_ph_frame .ob_send'); await p.waitForTimeout(4500); };
    await send('내일 열 시에 정비소 올 수 있어?');
    const rid = await s.run(async ({ m }) => Object.keys(m.live.world.messenger.rooms)[0]);
    const mark = () => p.evaluate(() => { for (const c of ['th', 'me']) { const a = [...document.querySelectorAll(`.na_ph_frame .ob_b.${c}`)]; a.forEach(x => x.removeAttribute('data-t')); a.at(-1)?.setAttribute('data-t', c); } });
    const drag = async dx => { await mark(); const b = await (await p.$('.na_ph_frame .ob_b[data-t=th]')).boundingBox(); const x = b.x + b.width / 2, y = b.y + b.height / 2; await p.mouse.move(x, y); await p.mouse.down(); await p.mouse.move(x + dx / 2, y, { steps: 3 }); await p.mouse.move(x + dx, y, { steps: 3 }); await p.mouse.up(); await p.waitForTimeout(500); };
    // 받아 둔 답장 넷 (가짜 모델은 같은 답을 줘서 글을 바꿔 둬요)
    const TXT = [[['Kann ich machen', '할 수 있어'], ['Zehn ist aber früh', '근데 열 시는 이르다']], [['Samstag? Da hab ich Schicht', '토요일? 나 근무야'], ['Geht auch Sonntag', '일요일도 돼?']], [['Ja klar, Samstag passt!', '응 좋아, 토요일 괜찮아!'], ['Bring Kuchen mit 😄', '케이크 가져와 😄']], [['Nur wenn du pünktlich bist', '네가 제시간에 오면']]];
    const retag = k => p.evaluate(async ([B, t]) => { const core = await import(B + 'core.js'), st = await import(B + 'phone2store.js'); const m = core.getMeta(), r = st.liveRooms(m)[0], me = st.liveWorld(m).persona; const idx = r.messages.map(x => x.from === me).lastIndexOf(true); r.messages.slice(idx + 1).forEach((x, i) => { if (t[i]) { x.text = t[i][0]; x.ko = t[i][1]; } }); }, [B, TXT[k]]);
    await s.to('orbit'); await s.to('orbitroom', rid); await p.waitForTimeout(400); await retag(0);
    for (const k of [1, 2, 3]) { await s.to('orbit'); await s.to('orbitroom', rid); await p.waitForTimeout(400); await drag(-90); await p.waitForTimeout(4500); await retag(k); }
    await s.to('orbit'); await s.to('orbitroom', rid); await p.waitForTimeout(400); await drag(90);
    const st = await p.evaluateHandle(() => { const e = document.createElement('style'); document.head.append(e); return e; });
    const shots = {}, shot = async n => { await p.waitForTimeout(350); shots[n] = await s.shot('glass_' + n); };
    const hold = async t => { await mark(); const b = await (await p.$(`.na_ph_frame .ob_b[data-t=${t}]`)).boundingBox(); await p.mouse.move(b.x + b.width / 2, b.y + b.height / 2); await p.mouse.down(); await p.waitForTimeout(650); await p.mouse.up(); await p.waitForTimeout(400); };
    // 화면 1: 여러 개 고르기 줄
    await s.to('orbit'); await s.to('orbitroom', rid); await p.waitForTimeout(400); await hold('me'); await p.click('.na_ph_frame .na_ob_mpick'); await p.waitForTimeout(300); await mark(); await p.click('.na_ph_frame .ob_b[data-t=th]'); await p.waitForTimeout(300);
    for (const k of Object.keys(V)) { await st.evaluate((e, css) => { e.textContent = css; }, V[k]); await shot(k + '_bar'); }
    await p.click('.na_ph_frame .na_ob_pquit'); await p.waitForTimeout(300);
    // 화면 2: 받아 둔 답장 창
    await st.evaluate(e => { e.textContent = ''; }); await p.click('.na_ph_frame .na_ob_swd'); await p.waitForTimeout(400); await p.click('.na_ph_frame .na_ob_slr[data-n="1"]'); await p.waitForTimeout(300);
    for (const k of Object.keys(V)) { await st.evaluate((e, css) => { e.textContent = css; }, V[k]); await shot(k + '_list'); }
    const names = { now: '지금 (하양 단색)', G1: 'G1. 머리줄과 같은 밝은 유리', G2: 'G2. 내 말풍선 같은 어두운 유리', G3: 'G3. 더 옅은 유리 + 답장은 유리 말풍선' };
    const b = await chromium.launch(), pg = await b.newPage({ deviceScaleFactor: 1 });
    await pg.setContent(`<html><body style="margin:0;padding:24px;background:#d9dbe0;font-family:-apple-system,'Noto Sans KR',sans-serif;width:max-content"><div style="display:flex;gap:26px">${Object.keys(names).map(k => `<div><h2 style="font-size:16px;margin:0 0 10px">${names[k]}</h2><div style="display:flex;gap:8px">${['bar', 'list'].map(v => `<img style="width:270px;display:block;border-radius:20px" src="data:image/png;base64,${fs.readFileSync(shots[k + '_' + v]).toString('base64')}">`).join('')}</div></div>`).join('')}</div></body></html>`);
    await pg.screenshot({ path: path.join(__dirname, 'sheetGlass.jpg'), fullPage: true, type: 'jpeg', quality: 88 }); await b.close();
    console.log('ok', s.errors().slice(0, 3));
  } finally { await s.close(); reset(); }
})().catch(e => { console.error(e); reset(); process.exit(1); });
