// Orbit 방의 이모지 판 시안(입력칸의 웃는 얼굴을 누르면): 입력칸 바로 위 흰 카드. 탭(이모지 · 카오모지 · GIF · 스티커 · 도구) · 검색칸 · 분류 줄 · 격자.
//   node docs/mockups/orbit-emoji/mock.cjs   (실제 방 화면 위에 판만 얹어서 찍어요)
const { open } = require('/home/user/NarrativeArchive/tools/dev/probe.cjs');
const fs = require('fs'), path = require('path'), os = require('os');
const CHAT = path.join(os.homedir(), 'sillytavern/data/default-user/chats/default_Seraphina/na_test.jsonl');
const reset = () => fs.copyFileSync('/home/user/NarrativeArchive/tools/dev/na_test.jsonl', CHAT);
const B = '/scripts/extensions/third-party/NarrativeArchive/src/', OUT = '/home/user/NarrativeArchive/docs/mockups/orbit-emoji/';
const LU = process.env.LUCIDE || '/tmp/claude-0/-home-user-NarrativeArchive/357c6c89-df99-5c7b-a84f-806ab745fd2b/scratchpad/lucide/package/icons';
const L = {}; for (const n of ['search', 'keyboard']) L[n] = fs.readFileSync(path.join(LU, n + '.svg'), 'utf8').replace(/<!--[\s\S]*?-->/, '').replace(/<svg[\s\S]*?>/, '').replace('</svg>', '').replace(/\s+/g, ' ').trim();

(async () => { reset(); const s = await open('light', { out: os.tmpdir(), width: 412, height: 915, mobile: true, init: true }); const p = s.p;
 try {
  await p.evaluate(() => document.documentElement.style.setProperty('--na-nb', '48px'));
  await s.run(async ({ m }) => { const n = SillyTavern.getContext().chat.length - 1; m.text = String(m.text).replace(/\n# STATE/, `\n## #26–#${n} — Am Fluss (Oct 25, night, Varo)\n- Sie redeten.\n\n# STATE`); m.boundary = n; });
  await s.to('set'); await p.click('.na_ph_pmode[data-v=live]'); await p.waitForTimeout(600); await p.click('.na_ob_start'); await p.waitForTimeout(2000);
  await s.to('orbitnew'); await p.waitForTimeout(400); await p.locator('.na_ph_frame .na_ob_pick', { hasText: 'Mara' }).first().click(); await p.waitForTimeout(300); await p.click('.na_ph_frame .na_ob_make'); await p.waitForTimeout(500);
  const rid = await p.evaluate(async B => { const core = await import(B + 'core.js'), st = await import(B + 'phone2store.js'); const m = core.getMeta(), r = st.liveRooms(m)[0], me = st.liveWorld(m).persona; const T = [[me, '내일 열 시에 정비소 올 수 있어?', ''], ['Mara', 'Ja klar, Samstag passt!', '응 좋아, 토요일 괜찮아!'], ['Mara', 'Bring Kuchen mit 😄', '케이크 가져와 😄'], [me, '무슨 케이크', ''], ['Mara', 'Den mit Kirschen', '체리 든 거'], ['Mara', 'Vom Bäcker an der Ecke. Der hat freitags immer die besten', '모퉁이 빵집 거. 거기 금요일엔 늘 제일 맛있어'], [me, '알겠어 내일 봐', ''], ['Mara', 'Bis morgen', '내일 봐']]; const t0 = Date.now() - T.length * 60000; r.messages = T.map(([from, text, ko], i) => ({ id: `mk${i}`, from, text, ko, at: t0 + i * 60000, told: true, ...(i === 7 ? { state: 'Werkstatt · Feierabend' } : {}) })); r.messages[2].reacts = [{ by: me, e: '❤️', at: Date.now() - 9000 }]; for (const n of r.members) (r.read ||= {})[st.liveKey(n)] = Date.now(); await core.saveMeta(); return r.id; }, B);
  await s.to('orbit'); await s.to('orbitroom', rid); await p.waitForTimeout(900);

  const OUT2 = process.env.OUT || OUT; const shot = async n => { await p.waitForTimeout(350); await p.screenshot({ path: OUT2 + n + '.png' }); console.log(n); };

  const hold = async t => { const b = p.locator('.na_ph_frame .ob_b', { hasText: t }).first(), r = await b.boundingBox(); const c = await p.context().newCDPSession(p); const pt = { x: r.x + r.width / 2, y: r.y + r.height / 2 }; await c.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [pt] }); await p.waitForTimeout(700); await c.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await p.waitForTimeout(300); };
  const F = '.na_ph_frame ';
  if (await p.locator(F + '.ob_bg.dk').count()) { await p.click(F + '.na_ob_more'); await p.click(F + '.na_ob_dark'); await p.waitForTimeout(300); }
  const CSS = `
.ep { position: absolute; z-index: 7; left: 10px; right: 10px; height: 404px; display: flex; flex-direction: column; overflow: hidden; border-radius: 22px; background: #fff; box-shadow: 0 1px 1.5px rgba(30,24,50,.05), 0 14px 36px rgba(30,24,50,.13); color: #3a3d45; }
.ep div { --axfs: inherit; }
.ep .sg { flex: none; display: flex; gap: 2px; margin: 10px 10px 0; padding: 4px; border-radius: 999px; background: rgba(27,29,36,.06); } .ep .sg div { flex: 1; height: 30px; display: grid; place-items: center; border-radius: 999px; font-size: 12.5px; font-weight: 600; color: #6c717b; } .ep .sg .on { background: rgba(20,22,30,.82); box-shadow: inset 0 1px 0 rgba(255,255,255,.16); color: #fff; }
.ep .q { flex: none; display: flex; align-items: center; gap: 8px; height: 38px; margin: 10px 10px 0; padding: 0 12px; border-radius: 12px; background: rgba(27,29,36,.06); color: #8a8f99; } .ep .q div { font-size: 14px; color: #9a9ea8; }
.ep .cat { flex: none; display: flex; align-items: center; gap: 2px; margin: 8px 8px 0; padding-bottom: 8px; border-bottom: 1px solid rgba(27,29,36,.06); } .ep .cat div { flex: 1; height: 34px; display: grid; place-items: center; border-radius: 10px; font-family: NADeviceEmoji, sans-serif; font-size: 19px; filter: grayscale(.2); opacity: .75; } .ep .cat .on { background: rgba(27,29,36,.07); filter: none; opacity: 1; }
.ep .cap { flex: none; margin: 10px 16px 4px; font-size: 11.5px; font-weight: 600; color: #8a8f99; }
.ep .gr { display: grid; grid-template-columns: repeat(8, 1fr); padding: 0 8px; } .ep .gr div { height: 44px; display: grid; place-items: center; font-family: NADeviceEmoji, sans-serif; font-size: 26px; line-height: 1; }
.na_ph_frame .ob_inp .ob_ci.kb { background: rgba(27,29,36,.07); }
.ep.dk { background: #24262b; box-shadow: inset 0 1px 0 rgba(255,255,255,.07), 0 14px 36px rgba(0,0,0,.4); color: rgba(255,255,255,.82); } .ep.dk .sg, .ep.dk .q { background: rgba(255,255,255,.07); } .ep.dk .sg div { color: rgba(255,255,255,.6); } .ep.dk .sg .on { background: #e9e9ec; box-shadow: none; color: #15161a; } .ep.dk .q, .ep.dk .q div, .ep.dk .cap { color: rgba(255,255,255,.5); } .ep.dk .cat { border-color: rgba(255,255,255,.07); } .ep.dk .cat .on { background: rgba(255,255,255,.1); }
.na_ph_frame .ob_bg.dk ~ .ob_inp .ob_ci.kb { background: rgba(255,255,255,.1); }
`;
  const draw = async name => {
    await p.evaluate(({ CSS, L }) => { const ic = (n, s = 18, w = 2) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round">${L[n]}</svg>`;
      document.getElementById('mk_q')?.remove(); document.querySelectorAll('.mk_n').forEach(e => e.remove());
      const t = document.createElement('style'); t.id = 'mk_q'; t.textContent = CSS; document.head.append(t);
      const q = s => document.querySelector('.na_ph_frame ' + s), inp = q('.ob_inp'), host = inp.parentElement, k = host.getBoundingClientRect().width / host.offsetWidth, dk = !!q('.ob_bg.dk');
      const smile = [...inp.querySelectorAll('.ob_ci')].pop(); smile.classList.add('kb'); smile.innerHTML = ic('keyboard', 21);
      const E = '😀 😃 😄 😁 😆 😅 🤣 😂 🙂 😊 😇 🥰 😍 🤩 😘 😗 😚 😙 🥲 😋 😛 😜 🤪 😝 🤑 🤗 🤭 🫢 🤫 🤔 🫡 🤐 🤨 😐 😑 😶 🫥 😏 😒 🙄 😬 😮‍💨 🤥 😌 😔 😪 🤤 😴'.split(' ');
      const C = ['😀', '👋', '🐾', '🍕', '🚗', '⚽', '💡', '💯', '🏁', '⭐'];
      const bottom = (host.getBoundingClientRect().bottom - inp.getBoundingClientRect().top) / k + 8;
      host.insertAdjacentHTML('beforeend', `<div class="ep mk_n${dk ? ' dk' : ''}" style="bottom:${bottom}px"><div class="sg">${['이모지', '카오모지', 'GIF', '스티커', '도구'].map((t, i) => `<div class="${i ? '' : 'on'}">${t}</div>`).join('')}</div>
        <div class="q">${ic('search', 16)}<div>이모지 검색</div></div><div class="cat">${C.map((e, i) => `<div class="${i ? '' : 'on'}">${e}</div>`).join('')}</div><div class="cap">스마일리 · 감정</div><div class="gr">${E.map(e => `<div>${e}</div>`).join('')}</div></div>`); }, { CSS, L });
    await p.waitForTimeout(350); await p.screenshot({ path: OUT + name + '.png' }); console.log(name); };
  await draw('E_light');
  await p.evaluate(() => { document.querySelectorAll('.mk_n').forEach(e => e.remove()); }); await p.click(F + '.na_ob_more'); await p.click(F + '.na_ob_dark'); await p.waitForTimeout(300);
  await draw('E_dark');
  await p.evaluate(() => { document.querySelectorAll('.mk_n').forEach(e => e.remove()); }); await p.click(F + '.na_ob_more'); await p.click(F + '.na_ob_dark'); await p.waitForTimeout(300);
  console.log(JSON.stringify(s.errors()));
 } catch (e) { await p.screenshot({ path: OUT + 'fail.png' }); console.log('ERR', JSON.stringify(s.errors()).slice(0, 1500)); throw e; } finally { await s.close(); reset(); } })().catch(e => { console.error(String(e).slice(0, 300)); reset(); process.exit(1); });
