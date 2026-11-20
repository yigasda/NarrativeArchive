// 첫 화면 아이콘 타일을 그라데이션으로 (보라 아님): G1~G5. 실제 첫 화면에서 타일만 바꿔 찍어요.
// node docs/mockups/phone2-import/mockTile.cjs → sheetTile.jpg  (시험 채팅 na_msg: 폰도 인물도 없는 채팅이 있어야 해요)
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path'), os = require('os');
const B = '/scripts/extensions/third-party/NarrativeArchive/src/', ST = 'http://127.0.0.1:8000';
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'tilemock'));
// Orbit 얼굴 색(오로라)과 같은 방식: 세 점이 번지는 바탕
const bg = ([a, b, c, d]) => `radial-gradient(40% 50% at 25% 35%,${a} 0,transparent 70%),radial-gradient(45% 55% at 75% 70%,${b} 0,transparent 70%),radial-gradient(40% 40% at 70% 20%,${c} 0,transparent 70%),${d}`;
const V = {
  G1: ['산호 · 복숭아', bg(['#e8615a', '#f4ab95', '#f7c9b4', '#ee8b7c'])],
  G2: ['초록 · 살구', bg(['#59b874', '#f0bf7f', '#cfe08c', '#8dcb8a'])],
  G3: ['물빛', bg(['#5fb3c9', '#a9dcd6', '#9fc7ee', '#86c3cf'])],
  G4: ['호박', bg(['#d9a35a', '#f3cf96', '#e8a7a0', '#e4b47c'])],
  G5: ['장미 · 복숭아', bg(['#f2a2b4', '#f7c6a6', '#f6b7a0', '#f1b0b4'])],
};
(async () => {
  const b = await chromium.launch(), ctx = await b.newContext({ viewport: { width: 412, height: 1100 }, deviceScaleFactor: 2 }), p = await ctx.newPage();
  await p.goto(ST, { waitUntil: 'domcontentloaded' }); await p.waitForFunction(() => window.SillyTavern?.getContext?.().characters?.length > 0, null, { timeout: 60000 }); await p.waitForTimeout(2000);
  await p.evaluate(async () => { await SillyTavern.getContext().selectCharacterById(0); }); await p.waitForTimeout(1500);
  await p.evaluate(async () => { await SillyTavern.getContext().openCharacterChat('na_msg'); }); await p.waitForTimeout(2000);
  await p.evaluate(async B => { (await import(B + 'phone.js')).openPhone(); }, B); await p.waitForTimeout(1200);
  const shots = {}, shot = async n => { await p.waitForTimeout(250); const f = path.join(TMP, n + '.png'); await (await p.$('.na_ph_frame')).screenshot({ path: f }); shots[n] = f; };
  await shot('now');
  for (const k of Object.keys(V)) {
    await p.evaluate(g => { const t = document.querySelector('.na_ph_frame .wh_ic'); t.style.background = g; t.style.boxShadow = 'inset 0 1px 0 rgba(255,255,255,.35), 0 8px 18px rgba(22,27,34,.12)'; t.querySelector('svg').setAttribute('stroke', '#fff'); }, V[k][1]);
    await shot(k);
  }
  const names = { now: '지금', ...Object.fromEntries(Object.entries(V).map(([k, v]) => [k, `${k}. ${v[0]}`])) };
  const pg = await b.newPage({ deviceScaleFactor: 1 });
  await pg.setContent(`<html><body style="margin:0;padding:24px;background:#d9dbe0;font-family:-apple-system,'Noto Sans KR',sans-serif;width:max-content"><div style="display:flex;gap:16px">${Object.keys(names).map(k => `<div><h2 style="font-size:16px;margin:0 0 10px">${names[k]}</h2><div style="width:300px;height:330px;overflow:hidden;border-radius:22px"><img style="width:300px;display:block" src="data:image/png;base64,${fs.readFileSync(shots[k]).toString('base64')}"></div></div>`).join('')}</div></body></html>`);
  await pg.screenshot({ path: path.join(__dirname, 'sheetTile.jpg'), fullPage: true, type: 'jpeg', quality: 90 });
  await ctx.close(); await b.close(); console.log('ok');
})().catch(e => { console.error(e); process.exit(1); });
