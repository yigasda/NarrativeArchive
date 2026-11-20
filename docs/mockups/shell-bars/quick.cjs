// 길게 눌렀을 때 빠른 반응 줄 시안: Q1 인스타식(흰 알약 줄은 말 위, 검정 알약은 말 아래) · Q2 한 장(검정 카드 윗줄 이모지 · 아랫줄 글자) · Q3 둘 다 검정(이모지 줄 위, 글자 알약 그 아래)
const { open } = require('/home/user/NarrativeArchive/tools/dev/probe.cjs');
const fs = require('fs'), path = require('path'), os = require('os');
const CHAT = path.join(os.homedir(), 'sillytavern/data/default-user/chats/default_Seraphina/na_test.jsonl');
const reset = () => fs.copyFileSync('/home/user/NarrativeArchive/tools/dev/na_test.jsonl', CHAT);
const B = '/scripts/extensions/third-party/NarrativeArchive/src/', OUT = '/home/user/NarrativeArchive/docs/mockups/shell-bars/';
const EM = ['❤️', '😂', '😮', '😢', '😡', '👍'];
const PLUS = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>';
const KEEP = ` .na_ph_frame .ob_msgs.hold .ob_mi > :is(.mk_qr, .mk_card) { opacity: 1 !important; }`;
const CSS = {
  Q1: `.mk_qr { align-self: flex-start; display: flex; align-items: center; gap: 2px; padding: 5px 6px; margin: 0 0 6px 44px; border-radius: 999px; background: rgba(255,255,255,.92); box-shadow: 0 10px 26px rgba(20,24,40,.18), 0 1px 2px rgba(20,24,40,.08); position: relative; z-index: 3; }
    .mk_qr i { width: 34px; height: 34px; display: grid; place-items: center; font-style: normal; font-size: 21px; border-radius: 50%; } .mk_qr i.on { background: rgba(20,22,30,.08); }
    .mk_qr .p { color: #5a5f69; background: rgba(20,22,30,.06); width: 30px; height: 30px; margin-left: 2px; }
    .na_ph_frame .ob_pill.mk_down { order: 9; }`,
  Q2: `.mk_card { align-self: flex-start; margin: 0 0 6px 44px; border-radius: 18px; overflow: hidden; background: #15161a; box-shadow: inset 0 1px 0 rgba(255,255,255,.16), 0 10px 24px rgba(20,22,30,.3); position: relative; z-index: 3; }
    .mk_card .r { display: flex; align-items: center; gap: 1px; padding: 6px 8px; border-bottom: 1px solid rgba(255,255,255,.12); } .mk_card .r i { width: 33px; height: 33px; display: grid; place-items: center; font-style: normal; font-size: 20px; border-radius: 50%; } .mk_card .r i.on { background: rgba(255,255,255,.14); }
    .mk_card .r .p { color: #fff; background: rgba(255,255,255,.12); width: 29px; height: 29px; margin-left: 3px; } .mk_card .ob_pill { margin: 0 !important; box-shadow: none !important; border-radius: 0 !important; background: none !important; }`,
  Q3: `.mk_qr { align-self: flex-start; display: flex; align-items: center; gap: 1px; padding: 5px 7px; margin: 0 0 6px 44px; border-radius: 999px; background: #15161a; box-shadow: inset 0 1px 0 rgba(255,255,255,.16), 0 10px 24px rgba(20,22,30,.3); position: relative; z-index: 3; }
    .mk_qr i { width: 34px; height: 34px; display: grid; place-items: center; font-style: normal; font-size: 21px; border-radius: 50%; } .mk_qr i.on { background: rgba(255,255,255,.14); }
    .mk_qr .p { color: #fff; background: rgba(255,255,255,.12); width: 30px; height: 30px; margin-left: 3px; }`,
};
(async () => { reset(); const s = await open('light', { out: os.tmpdir(), width: 412, height: 915, mobile: true, init: true }); const p = s.p;
 try {
  await s.run(async ({ m }) => { const n = SillyTavern.getContext().chat.length - 1; m.text = String(m.text).replace(/\n# STATE/, `\n## #26–#${n} — Am Fluss (Oct 25, night, Varo)\n- Sie redeten.\n\n# STATE`); m.boundary = n; });
  await s.to('set'); await p.click('.na_ph_pmode[data-v=live]'); await p.waitForTimeout(600); await p.click('.na_ob_start'); await p.waitForTimeout(2000);
  await s.to('orbitnew'); await p.waitForTimeout(400); await p.locator('.na_ph_frame .na_ob_pick', { hasText: 'Mara' }).first().click(); await p.waitForTimeout(300); await p.click('.na_ph_frame .na_ob_make'); await p.waitForTimeout(500);
  const rid = await p.evaluate(async B => { const core = await import(B + 'core.js'), st = await import(B + 'phone2store.js'); const m = core.getMeta(), r = st.liveRooms(m)[0], me = st.liveWorld(m).persona; const T = [[me, '내일 열 시에 정비소 올 수 있어?', ''], ['Mara', 'Ja klar, Samstag passt!', '응 좋아, 토요일 괜찮아!'], ['Mara', 'Bring Kuchen mit 😄', '케이크 가져와 😄'], [me, '무슨 케이크', ''], ['Mara', 'Den mit Kirschen', '체리 든 거'], ['Mara', 'Vom Bäcker an der Ecke', '모퉁이 빵집 거'], [me, '알겠어 내일 봐', ''], ['Mara', 'Bis morgen', '내일 봐']]; const t0 = Date.now() - T.length * 60000; r.messages = T.map(([from, text, ko], i) => ({ id: `mk${i}`, from, text, ko, at: t0 + i * 60000, told: true })); r.messages[2].reacts = [{ by: me, e: '❤️', at: Date.now() }]; for (const n of r.members) (r.read ||= {})[st.liveKey(n)] = Date.now(); return r.id; }, B);
  await s.to('orbit'); await s.to('orbitroom', rid); await p.waitForTimeout(500);
  for (const [k, css] of Object.entries(CSS)) {
    await s.to('orbitroom', rid); await p.waitForTimeout(300);
    const bx = await p.locator('.na_ph_frame .ob_b.th').nth(1).boundingBox(); await p.mouse.move(bx.x + 30, bx.y + 15); await p.mouse.down(); await p.waitForTimeout(700); await p.mouse.up(); await p.waitForTimeout(350);
    await p.evaluate(([k, css, EM, PLUS]) => { document.getElementById('mk_q')?.remove(); const t = document.createElement('style'); t.id = 'mk_q'; t.textContent = css; document.head.append(t);
      const pill = document.querySelector('.na_ph_frame .ob_pill'), b = pill.nextElementSibling; const row = EM.map((e, i) => `<i class="${i === 0 ? 'on' : ''}">${e}</i>`).join('') + `<i class="p">${PLUS}</i>`;
      if (k === 'Q2') { const c = document.createElement('div'); c.className = 'mk_card'; c.innerHTML = `<div class="r">${row}</div>`; pill.before(c); c.append(pill); }
      else if (k === 'Q1') { const q = document.createElement('div'); q.className = 'mk_qr'; q.innerHTML = row; pill.before(q); b.after(pill); pill.style.margin = '6px 0 0 44px'; }
      else { const q = document.createElement('div'); q.className = 'mk_qr'; q.innerHTML = row; pill.before(q); } }, [k, css + KEEP, EM, PLUS]);
    await p.waitForTimeout(250); await p.screenshot({ path: OUT + `${k}_quick.png` });
    await p.mouse.click(380, 880); await p.waitForTimeout(300);
  }
 } finally { await s.close(); reset(); } })();
