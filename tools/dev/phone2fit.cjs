// 좁은 폰 폭에서 화면 판이 제자리인지: 화면마다 판(캔버스)의 위 · 아래가 화면 틀과 맞는지 재요(밀리면 숫자가 0이 아니에요).
// node tools/dev/phone2fit.cjs [폭=360] [사진 폴더]
const { open } = require('./probe.cjs');
const fs = require('fs'), path = require('path'), os = require('os');
const CHAT = path.join(os.homedir(), 'sillytavern/data/default-user/chats/default_Seraphina/na_test.jsonl'), reset = () => fs.copyFileSync(path.join(__dirname, 'na_test.jsonl'), CHAT);
const B = '/scripts/extensions/third-party/NarrativeArchive/src/';
(async () => { const width = Number(process.argv[2]) || 360, o = process.argv[3] || ''; if (o) fs.mkdirSync(o, { recursive: true });
  const s = await open('light', { width, out: o || os.tmpdir() }); const p = s.p;
  const fit = async n => { const r = await p.evaluate(() => { const scr = document.querySelector('.na_ph_frame .na_ph_scr'), cv = scr?.querySelector('.cg_canvas'); if (!scr || !cv) return null; const a = scr.getBoundingClientRect(), b = cv.getBoundingClientRect(); return { top: Math.round(b.top - a.top), bottom: Math.round(a.bottom - b.bottom) }; }); if (o) await (await p.$('.na_ph_frame')).screenshot({ path: path.join(o, `fit_${n}.png`) }); return `${n} ${JSON.stringify(r)}`; };
  const out = [];
  try {
    for (const v of ['home', 'set', 'msg']) { await s.to(v); out.push(await fit('p1_' + v)); }
    await s.to('set'); await p.click('.na_ph_pmode[data-v=live]'); await p.waitForTimeout(300); out.push(await fit('livestart'));
    await p.click('.na_ob_start'); await p.waitForTimeout(800); out.push(await fit('live_home'));
    await s.to('orbit'); out.push(await fit('orbit'));
    await s.to('orbitnew'); out.push(await fit('orbitnew'));
    await p.locator('.ob_rm.na_ob_pick').first().click(); await p.waitForTimeout(250); await p.click('.na_ob_make'); await p.waitForTimeout(500); out.push(await fit('orbitroom'));
    await s.to('set'); out.push(await fit('live_set'));
    console.log(out.join('\n'), s.errors().slice(0, 3));
  } finally { await s.close(); reset(); }
})().catch(e => { console.error(e); reset(); process.exit(1); });
