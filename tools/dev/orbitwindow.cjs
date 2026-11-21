// Orbit 방이 최근 말만 그리는지, 위로 굴리면 옛 말이 더 그려지는지, 그때 보고 있던 말이 제자리에 있는지 봐요.  node tools/dev/orbitwindow.cjs
// (손가락 화면 · 껍데기 앱 흉내. N=말 수, 기본 300)
const { open } = require('./probe.cjs');
const fs = require('fs'), path = require('path'), os = require('os');
const CHAT = path.join(os.homedir(), 'sillytavern/data/default-user/chats/default_Seraphina/na_test.jsonl');
const reset = () => fs.copyFileSync(path.join(__dirname, 'na_test.jsonl'), CHAT);
const B = '/scripts/extensions/third-party/NarrativeArchive/src/', N = Number(process.env.N || 300);
let bad = 0; const ok = (name, pass, info = '') => { if (!pass) bad++; console.log(`${pass ? 'ok  ' : 'FAIL'} ${name}${info !== '' ? ` · ${typeof info === 'string' ? info : JSON.stringify(info)}` : ''}`); };
(async () => { reset(); const s = await open('light', { out: os.tmpdir(), width: 412, height: 915, mobile: true, init: true }); const p = s.p;
 try {
  await p.evaluate(() => { document.documentElement.style.setProperty('--na-nb', '48px'); window.NA_MORPH_CHECK = true; });
  await s.run(async ({ m }) => { const n = SillyTavern.getContext().chat.length - 1; m.text = String(m.text).replace(/\n# STATE/, `\n## #26–#${n} — Am Fluss (Oct 25, night, Varo)\n- Sie redeten.\n\n# STATE`); m.boundary = n; });
  await s.to('set'); await p.click('.na_ph_pmode[data-v=live]'); await p.waitForTimeout(600); await p.click('.na_ob_start'); await p.waitForTimeout(2000);
  await s.to('orbitnew'); await p.waitForTimeout(400); await p.locator('.na_ph_frame .na_ob_pick', { hasText: 'Mara' }).first().click(); await p.waitForTimeout(300); await p.click('.na_ph_frame .na_ob_make'); await p.waitForTimeout(500);
  // 말 N개. 옛 말 몇 개엔 반응도 달아 둬요(위로 굴려 그릴 때 새 반응처럼 튀면 안 돼요). 날짜가 여러 날에 걸치게 20분 간격
  const seed = n => p.evaluate(async ([B, N]) => { const core = await import(B + 'core.js'), st = await import(B + 'phone2store.js'); const m = core.getMeta(), r = st.liveRooms(m)[0], me = st.liveWorld(m).persona; const T = []; for (let i = 0; i < N; i++) T.push(i % 3 ? ['Mara', `Nachricht Nummer ${i} 😄${i % 7 ? '' : ' und noch ein bisschen mehr Text, damit die Zeile umbricht und höher wird'}`, `메시지 ${i}번 😄`] : [me, `내 말 ${i}`, '']); const t0 = Date.now() - T.length * 1200000; r.messages = T.map(([from, text, ko], i) => ({ id: `mk${i}`, from, text, ko, at: t0 + i * 1200000, told: true, ...(i % 40 === 5 ? { reacts: [{ by: me, e: '❤️', at: t0 }] } : {}) })); for (const k of r.members) (r.read ||= {})[st.liveKey(k)] = Date.now(); await core.saveMeta(); }, [B, n]);
  await seed(N);
  const cdp = await p.context().newCDPSession(p);
  const tap = async sel => { const b = await p.locator(sel).first().boundingBox(); await p.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2); };
  const hold = async sel => { const b = await p.locator(sel).first().boundingBox(), x = b.x + Math.min(40, b.width / 2), y = b.y + b.height / 2; await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] }); await p.waitForTimeout(650); await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); };
  const st = () => p.evaluate(() => { const e = document.querySelector('.na_ph_frame .ob_msgs'), bs = [...e.querySelectorAll('.ob_b[data-id]')]; return { n: bs.length, first: bs[0]?.dataset.id, last: bs.at(-1)?.dataset.id, top: Math.round(e.scrollTop), gap: Math.round(e.scrollHeight - e.scrollTop - e.clientHeight), newRe: e.querySelectorAll('.ob_re.new').length, re: e.querySelectorAll('.ob_re').length, days: e.querySelectorAll('.ob_day').length }; });
  const yOf = id => p.evaluate(id => { const b = [...document.querySelectorAll('.na_ph_frame .ob_b[data-id]')].find(e => e.dataset.id === id); return b ? Math.round(b.getBoundingClientRect().top * 10) / 10 : null; }, id);
  await s.to('orbit'); await p.waitForTimeout(400); await tap('.na_ph_frame .ob_rm'); await p.waitForTimeout(700);
  let a = await st();
  ok('방을 열면 마지막 60개만 그려요', a.n === Math.min(60, N) && a.last === `mk${N - 1}` && a.first === `mk${Math.max(0, N - 60)}`, a);
  ok('맨 아래에서 시작해요', a.gap < 4, a.gap);
  // 위로 굴리기: 끝 가까이 가면 60개 더. 그 순간 보고 있던 말의 자리가 그대로인지(1px 안)
  let loads = 0, worst = 0;
  for (let i = 0; i < 400 && loads < 12; i++) {
    const before = await st(); if (before.n >= N) break;
    // (굴린 바로 뒤 — 아직 더 그리기 전 — 의 자리와, 더 그린 뒤의 자리를 견줘요)
    const r = await p.evaluate(async () => { const e = document.querySelector('.na_ph_frame .ob_msgs'), f = e.querySelector('.ob_b[data-id]'), id = f.dataset.id, n0 = e.querySelectorAll('.ob_b[data-id]').length; e.scrollTop = Math.max(0, e.scrollTop - 500); const yA = f.getBoundingClientRect().top; await new Promise(z => setTimeout(z, 150)); const g = [...e.querySelectorAll('.ob_b[data-id]')].find(x => x.dataset.id === id); return { grew: e.querySelectorAll('.ob_b[data-id]').length > n0, d: Math.abs(g.getBoundingClientRect().top - yA) }; });
    if (r.grew) { loads++; worst = Math.max(worst, r.d); }
  }
  a = await st();
  ok(`위로 굴리면 옛 말이 다 그려져요 (${loads}번 더 그림)`, a.n === N && a.first === 'mk0', a);
  ok('더 그릴 때 보고 있던 말이 제자리(1px 안)', worst <= 1, `가장 많이 어긋난 값 ${worst}px`);
  ok('옛 말의 반응이 새 반응처럼 튀지 않아요', a.newRe === 0 && a.re > 0, { 배지: a.re, 새것: a.newRe });
  ok('다 그린 뒤엔 더 안 그려요', await p.evaluate(async () => { const e = document.querySelector('.na_ph_frame .ob_msgs'); e.scrollTop = 0; await new Promise(r => setTimeout(r, 300)); return e.querySelectorAll('.ob_b[data-id]').length; }) === N);
  // 옛 말에서도 길게 누르기 · 수정이 돼요
  await p.evaluate(() => { const e = document.querySelector('.na_ph_frame .ob_msgs'); e.scrollTop = 0; }); await p.waitForTimeout(300);
  await hold('.na_ph_frame .ob_b.th[data-id="mk4"]'); await p.waitForTimeout(400);
  ok('옛 말 길게 누르기 → 카드', await p.evaluate(() => !!document.querySelector('.na_ph_frame .ob_pill')));
  await tap('.na_ph_frame .ob_hr .na_ob_re'); await p.waitForTimeout(500);
  ok('옛 말에 반응 달기', await p.evaluate(() => !!document.querySelector('.na_ph_frame .ob_b[data-id="mk4"] .ob_re')));
  // 나갔다 다시 들어오면 다시 60개
  await tap('.na_ph_frame .ob_gb'); await p.waitForTimeout(500); await tap('.na_ph_frame .ob_rm'); await p.waitForTimeout(700);
  a = await st(); ok('나갔다 들어오면 다시 마지막 60개 · 맨 아래', a.n === Math.min(60, N) && a.gap < 4, a);
  // 손가락으로 끌어 굴리기(진짜 터치 굴림): 굴리는 도중에 더 그려져도 화면이 튀지 않아요. 프레임마다 한 말의 자리를 적어서, 한 프레임에 200px 넘게 움직이면 튄 거예요
  await p.evaluate(() => { const e = document.querySelector('.na_ph_frame .ob_msgs'), id = e.querySelector('.ob_b[data-id]').dataset.id; window.__tr = []; window.__trOn = true; const f = () => { if (!window.__trOn) return; const g = [...e.querySelectorAll('.ob_b[data-id]')].find(x => x.dataset.id === id); window.__tr.push([g.getBoundingClientRect().top, e.querySelectorAll('.ob_b[data-id]').length]); requestAnimationFrame(f); }; requestAnimationFrame(f); });
  for (let i = 0; i < 9; i++) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 206, y: 300 }] }); for (let y = 320; y <= 780; y += 20) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 206, y }] }); await p.waitForTimeout(8); } await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await p.waitForTimeout(60); }
  await p.waitForTimeout(600);
  const tr = await p.evaluate(() => { window.__trOn = false; return window.__tr; });
  const jump = tr.slice(1).reduce((mx, [y], i) => Math.max(mx, Math.abs(y - tr[i][0])), 0), grewN = tr.at(-1)[1] - tr[0][1];
  ok('손가락으로 끌어 굴리는 도중에 더 그려지고 튀지 않아요', grewN >= 60 && jump < 200, { 프레임: tr.length, 더그린말: grewN, 한프레임최대이동: Math.round(jump) });
  await p.evaluate(() => { const e = document.querySelector('.na_ph_frame .ob_msgs'); e.scrollTop = e.scrollHeight; }); await p.waitForTimeout(300);
  await tap('.na_ph_frame .ob_gb'); await p.waitForTimeout(500); await tap('.na_ph_frame .ob_rm'); await p.waitForTimeout(700);
  // 위를 보고 있을 때 새 말이 와도 자리가 그대로
  await p.evaluate(() => { const e = document.querySelector('.na_ph_frame .ob_msgs'); e.scrollTop = e.scrollTop - 900; }); await p.waitForTimeout(300);
  const b0 = await st(), id0 = await p.evaluate(() => [...document.querySelectorAll('.na_ph_frame .ob_b[data-id]')].find(e => e.getBoundingClientRect().top > 250).dataset.id), y0 = await yOf(id0);   // (보이는 맨 위 말: 아래에서 길게 눌러 뜨는 카드에 안 밀려요)
  await p.evaluate(async B => { const core = await import(B + 'core.js'), st = await import(B + 'phone2store.js'); const r = st.liveRooms(core.getMeta())[0]; r.messages.push({ id: 'late1', from: 'Mara', text: 'Später', ko: '나중에', at: Date.now(), told: true }); const x = document.createElement('button'); x.dataset.go = `orbitroom:${r.id}`; x.style.display = 'none'; }, B);
  const vis = await p.evaluate(() => { const b = [...document.querySelectorAll('.na_ph_frame .ob_b.th[data-id]')].find(e => { const r = e.getBoundingClientRect(); return r.top > 520 && r.top < 720; }); const r = b.getBoundingClientRect(); return { x: r.left + 30, y: r.top + r.height / 2 }; });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [vis] }); await p.waitForTimeout(650); await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await p.waitForTimeout(400); // (보이는 말을 길게 눌러 다시 그리기를 일으켜요)
  const b1 = await st(), y1 = await yOf(id0);
  ok('위를 보는 중에 새 말이 와도 자리 그대로', Math.abs(y1 - y0) <= 1 && b1.n === b0.n + 1, { 전: y0, 뒤: y1, 말: [b0.n, b1.n] });
  await p.touchscreen.tap(200, 120); await p.waitForTimeout(400);
  // 보이는 말을 거의 다 지우면(화면이 안 차면) 저절로 옛 말을 더 그려요
  await p.evaluate(async B => { const core = await import(B + 'core.js'), st = await import(B + 'phone2store.js'); const r = st.liveRooms(core.getMeta())[0]; r.messages.splice(r.messages.length - 58, 58); }, B);
  await hold('.na_ph_frame .ob_b >> nth=0'); await p.waitForTimeout(900); await p.touchscreen.tap(200, 120); await p.waitForTimeout(600);
  a = await st(); ok('말이 화면을 못 채우면 저절로 더 그려요', a.n > 30, a);
  // 말이 적은 방은 다 그려요
  await seed(12); await tap('.na_ph_frame .ob_gb'); await p.waitForTimeout(500); await tap('.na_ph_frame .ob_rm'); await p.waitForTimeout(700);
  a = await st(); ok('말이 12개인 방은 12개 다', a.n === 12 && a.first === 'mk0', a);
  const errs = s.errors(); ok('오류 없음(바뀐 부분만 그리기가 통째 그리기와 같음 포함)', !errs.length, errs.slice(0, 3));
  console.log('바뀐 부분만 고쳐 그린 횟수:', await p.evaluate(() => window.NA_MORPH_N || 0));
 } finally { await s.close(); reset(); }
 console.log(bad ? `\n${bad}개 실패` : '\n전부 통과'); process.exit(bad ? 1 : 0);
})().catch(e => { console.error(e); reset(); process.exit(1); });
