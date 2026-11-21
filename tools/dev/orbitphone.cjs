// Orbit을 폰 조건으로 돌려 봐요: 손가락(터치) · 저장이 4초 걸리는 폰 · 키보드가 올라온 높이.
// 동작마다 "누른 뒤 화면이 바뀔 때까지" 걸린 시간(ms)을 재요. 300ms를 넘으면 느린 거예요.  node tools/dev/orbitphone.cjs
const { open } = require('./probe.cjs');
const fs = require('fs'), path = require('path'), os = require('os');
const CHAT = path.join(os.homedir(), 'sillytavern/data/default-user/chats/default_Seraphina/na_test.jsonl');
const reset = () => fs.copyFileSync(path.join(__dirname, 'na_test.jsonl'), CHAT);
const B = '/scripts/extensions/third-party/NarrativeArchive/src/', SLOW = Number(process.env.SAVE_MS || 4000), MSGS = Number(process.env.N || 30);   // (N=300: 말이 많은 방 — 최근 60개만 그리는 조건)
(async () => { reset(); const s = await open('light', { out: os.tmpdir(), width: 412, height: 915, mobile: true, init: true }); const p = s.p; const out = [];
 try {
  await p.evaluate(() => document.documentElement.style.setProperty('--na-nb', '48px'));
  await p.evaluate(() => { window.NA_MORPH_CHECK = true; }); // (바뀐 부분만 고친 화면이 통째로 그린 화면과 같은지 매번 견줘요)
  await s.run(async ({ m }) => { const n = SillyTavern.getContext().chat.length - 1; m.text = String(m.text).replace(/\n# STATE/, `\n## #26–#${n} — Am Fluss (Oct 25, night, Varo)\n- Sie redeten.\n\n# STATE`); m.boundary = n; });
  await s.to('set'); await p.click('.na_ph_pmode[data-v=live]'); await p.waitForTimeout(600); await p.click('.na_ob_start'); await p.waitForTimeout(2000);
  await s.to('orbitnew'); await p.waitForTimeout(400); await p.locator('.na_ph_frame .na_ob_pick', { hasText: 'Mara' }).first().click(); await p.waitForTimeout(300); await p.click('.na_ph_frame .na_ob_make'); await p.waitForTimeout(500);
  const rid = await p.evaluate(async ([B, N]) => { const core = await import(B + 'core.js'), st = await import(B + 'phone2store.js'); const m = core.getMeta(), r = st.liveRooms(m)[0], me = st.liveWorld(m).persona; const T = []; for (let i = 0; i < N; i++) T.push(i % 3 ? ['Mara', `Nachricht Nummer ${i} 😄`, `메시지 ${i}번 😄`] : [me, `내 말 ${i}`, '']); const t0 = Date.now() - T.length * 60000; r.messages = T.map(([from, text, ko], i) => ({ id: `mk${i}`, from, text, ko, at: t0 + i * 60000, told: true })); for (const n of r.members) (r.read ||= {})[st.liveKey(n)] = Date.now(); await core.saveMeta(); return r.id; }, [B, MSGS]);
  // 저장을 느리게 (폰에서 4초쯤)
  await p.route(/\/api\/chats\/(save|group\/save)|savemetadata/i, async r => { await new Promise(z => setTimeout(z, SLOW)); await r.continue(); });
  // 누른 뒤 cond가 참이 될 때까지 걸린 시간
  const timed = async (name, act, cond, limit = 9000) => { const t0 = Date.now(); await act(); let ok = false; while (Date.now() - t0 < limit) { if (await p.evaluate(cond).catch(() => false)) { ok = true; break; } await p.waitForTimeout(16); } const ms = Date.now() - t0; out.push([name, ok ? ms : 'TIMEOUT']); console.log(String(ok ? ms : 'TIMEOUT').padStart(8), 'ms ', name); };
  const tap = async sel => { const b = await p.locator(sel).first().boundingBox(); await p.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2); };
  const cdp = await p.context().newCDPSession(p);
  const hold = async sel => { const b = await p.locator(sel).first().boundingBox(), x = b.x + Math.min(40, b.width / 2), y = b.y + b.height / 2; await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] }); await p.waitForTimeout(650); await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); };
  await s.to('orbit'); await p.waitForTimeout(400);
  await timed('목록 → 방 열기', () => tap('.na_ph_frame .ob_rm'), () => !!document.querySelector('.na_ph_frame .ob_msgs'));
  await p.waitForTimeout(500);
  await timed('길게 누르기 → 카드', () => hold('.na_ph_frame .ob_b.th >> nth=-2'), () => !!document.querySelector('.na_ph_frame .ob_pill'));
  await timed('이모지 누르기 → 배지', async () => { await tap('.na_ph_frame .na_ob_mre'); await p.waitForTimeout(200); await tap('.na_ph_frame .ob_hr .na_ob_re'); }, () => !!document.querySelector('.na_ph_frame .ob_re') && !document.querySelector('.na_ph_frame .ob_pill'));
  await p.waitForTimeout(300);
  await timed('길게 누르기(내 말) → 카드', () => hold('.na_ph_frame .ob_b.me >> nth=-1'), () => !!document.querySelector('.na_ph_frame .ob_pill'));
  await timed('수정 → 고치는 칸', () => tap('.na_ph_frame .na_ob_medit'), () => document.activeElement?.classList.contains('na_ob_ft'));
  await p.setViewportSize({ width: 412, height: 560 }); await p.waitForTimeout(500); // (키보드가 올라옴)
  console.log('         키보드 올라온 뒤 고치는 말풍선이 보이는지:', await p.evaluate(() => { const b = document.querySelector('.na_ph_frame .ob_fix').getBoundingClientRect(), bar = document.querySelector('.na_ph_frame .ob_fbar').getBoundingClientRect(); return b.top > 100 && bar.bottom < visualViewport.height - 60; }));
  await p.keyboard.type('!');
  await timed('✓ 한 번 → 칸 닫힘', async () => { const b = await p.locator('.na_ph_frame .na_ob_fok').boundingBox(); await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: b.x + 17, y: b.y + 17 }] }); await p.setViewportSize({ width: 412, height: 915 }); await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); }, () => !document.querySelector('.na_ph_frame .ob_fix'));
  await p.waitForTimeout(400);
  await timed('길게 누르기 → 선택 → 선택 모드', async () => { await hold('.na_ph_frame .ob_b.th >> nth=-2'); await p.waitForTimeout(200); await tap('.na_ph_frame .na_ob_mpick'); }, () => !!document.querySelector('.na_ph_frame .ob_pbar'));
  await timed('선택 모드: 다른 말 고르기', () => tap('.na_ph_frame .na_ob_prow >> nth=-4'), () => document.querySelectorAll('.na_ph_frame .ob_pck.on').length === 2);
  await timed('삭제 → 물음 창', () => tap('.na_ph_frame .na_ob_pdel'), () => !!document.querySelector('.na_ph_frame .pcf'));
  await timed('지우기 → 말이 사라짐', () => tap('.na_ph_frame .pcf_ok'), () => !document.querySelector('.na_ph_frame .pcf') && !document.querySelector('.na_ph_frame .ob_pbar'));
  await p.waitForTimeout(400);
  await timed('보내기 → 내 말이 보임', async () => { await tap('.na_ph_frame .na_ob_in'); await p.keyboard.type('시험'); await tap('.na_ph_frame .na_ob_send'); }, () => [...document.querySelectorAll('.na_ph_frame .ob_b.me')].some(b => b.textContent.includes('시험')));
  await p.keyboard.type('abc'); // (답장이 오는 동안에도 치던 글 · 커서가 그대로인지)
  await timed('보내기 → 입력 중 점', async () => {}, () => !!document.querySelector('.na_ph_frame .ob_typ'), 12000);
  await timed('보내기 → 답장 도착', async () => {}, () => { const b = document.querySelectorAll('.na_ph_frame .ob_b'); return b.length && b[b.length - 1].classList.contains('th') && !document.querySelector('.na_ph_frame .ob_typ'); }, 20000);
  await p.keyboard.type('def');
  console.log('         답장이 오는 동안 치던 글:', JSON.stringify(await p.evaluate(() => { const e = document.querySelector('.na_ph_frame .na_ob_in'); return { text: e.textContent, focused: document.activeElement === e }; })), '(abcdef · true여야 해요)');
  await p.waitForTimeout(600);
  await timed('답장 밀어서 넘기기', async () => { const b = await p.locator('.na_ph_frame .na_ob_sw').last().boundingBox(), y = b.y + b.height / 2; await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: b.x + 120, y }] }); for (let i = 1; i <= 6; i++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: b.x + 120 - i * 15, y }] }); await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); }, () => !!document.querySelector('.na_ph_frame .ob_typ') || document.querySelectorAll('.na_ph_frame .ob_swd i').length > 1, 12000);
  await p.waitForTimeout(Number(process.env.GAP || 800)); // (밀기 직후 0.2초 안의 톡은 브라우저가 클릭으로 안 쳐요: 시험에서는 조금 기다려요)
  await p.evaluate(() => { window.__ev = []; for (const t of ['pointerdown', 'pointerup', 'pointercancel', 'click']) window.addEventListener(t, e => window.__ev.push(t + ':' + (e.target.className || e.target.tagName).toString().slice(0, 24)), true); });
  await timed('뒤로 → 목록', () => tap('.na_ph_frame .ob_gb'), () => !!document.querySelector('.na_ph_frame .ob_dock'));
  console.log('         바뀐 부분만 고쳐 그린 횟수:', await p.evaluate(() => window.NA_MORPH_N || 0));
  console.log('errors', JSON.stringify(s.errors ? s.errors() : s.errs));
 } finally { await s.close(); reset(); } })().catch(e => { console.error(e); reset(); process.exit(1); });
