// 모든 화면을 돌면서 "바뀐 부분만 고쳐 그리기"(src/morph.js)가 통째로 그린 화면과 같은지 견줘요.
// 화면마다 같은 화면을 두 번 더 그리고(바뀐 부분만 고치는 길), 그 안의 누를 수 있는 것도 몇 개 눌러 봐요.  node tools/dev/morphtour.cjs [light]
const { open, SAMPLE_MONEY } = require('./probe.cjs');
const fs = require('fs'), path = require('path'), os = require('os');
const CHAT = path.join(os.homedir(), 'sillytavern/data/default-user/chats/default_Seraphina/na_test.jsonl');
const reset = () => fs.copyFileSync(path.join(__dirname, 'na_test.jsonl'), CHAT);
const src = fs.readFileSync(path.join(__dirname, '../../src/phone.js'), 'utf8');
const routes = [...new Set([...src.matchAll(/v === '([a-z0-9]+)'/g)].map(m => m[1]).concat([...src.matchAll(/\b([a-z0-9]+): \(\) => [a-zA-Z]+Screen\(/g)].map(m => m[1])))].filter(r => !['who', 'prep', 'livestart', 'liveimport', 'lock'].includes(r));
(async () => { reset(); const s = await open('light', { out: os.tmpdir(), width: 412, height: 915, mobile: true, init: true }); const p = s.p; const bad = [];
 try {
  await s.run(SAMPLE_MONEY);
  await p.evaluate(() => { window.NA_MORPH_CHECK = true; });
  const errs = () => (s.errors ? s.errors() : s.errs);
  let seen = 0;
  const check = where => { const e = errs(); if (e.length > seen) { for (const x of e.slice(seen)) if (/MORPH|TypeError|ReferenceError|RangeError|phone morph|phone screen/.test(String(x))) bad.push(`${where}: ${String(x).slice(0, 400)}`); seen = e.length; } };
  for (const r of routes) {
    await s.to('home'); await s.to(r); await p.waitForTimeout(120);
    const at = await p.evaluate(() => (document.querySelector('.na_ph_frame .na_ph_scr')?.className.match(/v_\w+/) || ['?'])[0]);
    await s.to(r); await s.to(r); check(r);
    // 그 화면 안에서 누를 수 있는 것 (다른 화면으로 가는 건 빼고) 몇 개
    const n = await p.evaluate(() => [...document.querySelectorAll('.na_ph_frame button:not([data-go]):not([disabled]), .na_ph_frame [role=button]:not([data-go])')].filter(b => b.offsetParent && !/quit|reset|remake|del|drop|send|make|undo|sync|upd|draw|voice|start|snap|import|file|pick/i.test(b.className)).length);
    for (let i = 0; i < (/^set/.test(r) ? 0 : Math.min(n, 4)); i++) { // (설정 화면은 누르지 않아요: 모델 연결 같은 걸 바꿔 버려요)
      await p.evaluate(i => { const bs = [...document.querySelectorAll('.na_ph_frame button:not([data-go]):not([disabled]), .na_ph_frame [role=button]:not([data-go])')].filter(b => b.offsetParent && !/quit|reset|remake|del|drop|send|make|undo|sync|upd|draw|voice|start|snap|import|file|pick/i.test(b.className)); bs[i]?.click(); }, i).catch(() => {});
      await p.waitForTimeout(90); await p.evaluate(() => document.querySelector('.na_ph_frame .pcf_no, .na_ph_frame .pcf [data-v]')?.click()).catch(() => {}); check(`${r} click ${i}`);
    }
    console.log(r.padEnd(18), at.padEnd(18), 'buttons', n);
  }
  console.log('morphs', await p.evaluate(() => window.NA_MORPH_N || 0), 'routes', routes.length, 'problems', bad.length);
  for (const b of bad) console.log('  !!', b);
 } finally { await s.close(); reset(); } })().catch(e => { console.error(e); reset(); process.exit(1); });
