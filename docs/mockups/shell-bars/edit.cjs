// 말 고치기 시안 (반영 쪽 liveEditMessage). 길게 누른 카드 아랫줄 맨 앞에 "수정".
// E1 인스타식: 입력칸 위 "말 고치기 ✕" 띠 + 입력칸에 그 글 + 보내기 자리 "완료" · E2 아이메시지식: 그 말풍선 자리에서 바로 고치고 옆에 ✓ ✕
// E3 아래 시트: 원문 · 한국어 칸 두 개를 같이(캐릭터 말). 끝에 고친 뒤 모습("수정됨")
const { open } = require('../../../tools/dev/probe.cjs');
const fs = require('fs'), path = require('path'), os = require('os');
const CHAT = path.join(os.homedir(), 'sillytavern/data/default-user/chats/default_Seraphina/na_test.jsonl');
const reset = () => fs.copyFileSync(path.join(__dirname, '../../../tools/dev/na_test.jsonl'), CHAT);
const B = '/scripts/extensions/third-party/NarrativeArchive/src/', OUT = __dirname + '/';
const CHK = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
const X = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>';
const PEN = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20h4L19 9l-4-4L4 16z"/></svg>';
const BASE = `.na_ph_frame .ob_msgs.hold .ob_mi > :is(.mk_keep) { opacity: 1 !important; } .mk_dim .ob_mi > :not(.mk_keep) { opacity: .28; }`;
const CSS = {
  E1: `.mk_eb { position: absolute; left: 12px; right: 12px; bottom: calc(var(--mkib) + 62px); z-index: 6; display: flex; align-items: center; gap: 9px; padding: 9px 10px 9px 14px; border-radius: 18px; background: rgba(255,255,255,.55); box-shadow: inset 0 1px 0 rgba(255,255,255,.7), 0 6px 18px rgba(40,40,80,.08); color: #2a2e36; }
    .mk_eb .t { flex: 1; min-width: 0; } .mk_eb small { display: block; font-size: 11px; font-weight: 600; color: rgba(30,32,40,.55); } .mk_eb span.o { display: block; font-size: 13px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .mk_eb .seg { display: flex; padding: 2px; border-radius: 999px; background: rgba(20,22,30,.08); font-size: 11.5px; font-weight: 600; } .mk_eb .seg b { padding: 4px 9px; border-radius: 999px; color: rgba(30,32,40,.55); } .mk_eb .seg b.on { background: #fff; color: #1b1d24; box-shadow: 0 1px 3px rgba(20,22,30,.12); }
    .mk_eb .x { width: 26px; height: 26px; display: grid; place-items: center; border-radius: 50%; background: rgba(20,22,30,.08); color: #444; }
    .na_ph_frame .ob_msgin.mk_fill { color: #1b1d24 !important; } .mk_done { width: auto !important; padding: 0 16px !important; font-size: 14px; font-weight: 700; color: #fff; }`,
  E2: `.mk_ib { outline: 2px solid rgba(255,255,255,.9); outline-offset: 2px; } .mk_ib .ob_tin { display: none; } .mk_caret { display: inline-block; width: 2px; height: 1.1em; vertical-align: -0.15em; background: #fff; margin-left: 1px; }
    .mk_ib.th .mk_caret { background: #1b1d24; } .mk_ibk { color: rgba(30,32,40,.7); } .mk_ibar { display: flex; gap: 8px; margin: 6px 0 2px; } .mk_ibar.me { align-self: flex-end; } .mk_ibar.th { align-self: flex-start; margin-left: 44px; }
    .mk_ibar i { width: 34px; height: 34px; display: grid; place-items: center; border-radius: 50%; font-style: normal; } .mk_ibar .ok { background: #15161a; color: #fff; } .mk_ibar .no { background: rgba(255,255,255,.7); color: #333; }`,
  E3: `.mk_sh { position: absolute; left: 0; right: 0; bottom: 0; z-index: 9; padding: 10px 16px calc(var(--mkib) + 18px); border-radius: 26px 26px 0 0; background: var(--mksla); box-shadow: 0 -10px 30px rgba(30,40,60,.16); }
    .mk_sh::before { content: ''; position: absolute; inset: 0; border-radius: inherit; background: rgba(255,255,255,.5); } .mk_sh > * { position: relative; }
    .mk_sh .g { width: 38px; height: 5px; border-radius: 3px; background: rgba(30,32,40,.18); margin: 0 auto 12px; } .mk_sh h4 { margin: 0 0 12px; font-size: 16px; font-weight: 700; color: #1b1d24; }
    .mk_sh label { display: block; margin: 10px 4px 5px; font-size: 11.5px; font-weight: 600; color: rgba(30,32,40,.55); } .mk_sh .f { padding: 11px 14px; border-radius: 16px; background: rgba(255,255,255,.75); box-shadow: inset 0 1px 0 #fff; font-size: 15px; color: #1b1d24; }
    .mk_sh .f.ko { font-size: 14px; color: #3a3f48; } .mk_sh .f.on { box-shadow: inset 0 0 0 2px #15161a; } .mk_sh .bt { display: flex; gap: 10px; margin-top: 16px; } .mk_sh .bt b { flex: 1; text-align: center; padding: 13px; border-radius: 999px; font-size: 14.5px; }
    .mk_sh .bt .n { background: rgba(255,255,255,.7); color: #333; } .mk_sh .bt .y { background: #15161a; color: #fff; } .mk_shade { position: absolute; inset: 0; z-index: 8; background: rgba(20,22,30,.18); }`,
};
(async () => { reset(); const s = await open('light', { out: os.tmpdir(), width: 412, height: 915, mobile: true, init: true }); const p = s.p;
 try {
  await p.evaluate(() => document.documentElement.style.setProperty('--na-nb', '48px'));
  await s.run(async ({ m }) => { const n = SillyTavern.getContext().chat.length - 1; m.text = String(m.text).replace(/\n# STATE/, `\n## #26–#${n} — Am Fluss (Oct 25, night, Varo)\n- Sie redeten.\n\n# STATE`); m.boundary = n; });
  await s.to('set'); await p.click('.na_ph_pmode[data-v=live]'); await p.waitForTimeout(600); await p.click('.na_ob_start'); await p.waitForTimeout(2000);
  await s.to('orbitnew'); await p.waitForTimeout(400); await p.locator('.na_ph_frame .na_ob_pick', { hasText: 'Mara' }).first().click(); await p.waitForTimeout(300); await p.click('.na_ph_frame .na_ob_make'); await p.waitForTimeout(500);
  const rid = await p.evaluate(async B => { const core = await import(B + 'core.js'), st = await import(B + 'phone2store.js'); const m = core.getMeta(), r = st.liveRooms(m)[0], me = st.liveWorld(m).persona; const T = [[me, '내일 열 시에 정비소 올 수 있어?', ''], ['Mara', 'Ja klar, Samstag passt!', '응 좋아, 토요일 괜찮아!'], ['Mara', 'Bring Kuchen mit 😄', '케이크 가져와 😄'], [me, '무슨 케이크', ''], ['Mara', 'Den mit Kirschen', '체리 든 거'], ['Mara', 'Vom Bäcker an der Ecke', '모퉁이 빵집 거'], [me, '거기 일찍 닫잖아', ''], ['Mara', 'Dann geh halt früher', '그럼 좀 일찍 가'], [me, '알겠어 내일 봐', ''], ['Mara', 'Bis morgen', '내일 봐']]; const t0 = Date.now() - T.length * 60000; r.messages = T.map(([from, text, ko], i) => ({ id: `mk${i}`, from, text, ko, at: t0 + i * 60000, told: true })); for (const n of r.members) (r.read ||= {})[st.liveKey(n)] = Date.now(); return r.id; }, B);
  await s.to('orbit'); await s.to('orbitroom', rid); await p.waitForTimeout(500);
  const style = async css => p.evaluate(css => { document.getElementById('mk_e')?.remove(); const t = document.createElement('style'); t.id = 'mk_e'; t.textContent = css; document.head.append(t); }, css);
  const hold = async sel => { const bx = await p.locator(sel).boundingBox(); await p.mouse.move(bx.x + 30, bx.y + 15); await p.mouse.down(); await p.waitForTimeout(700); await p.mouse.up(); await p.waitForTimeout(350); };
  // 0) 카드에 "수정"
  await hold('.na_ph_frame .ob_b[data-id="mk7"]');
  await p.evaluate(PEN => { const hb = document.querySelector('.na_ph_frame .ob_hb'); const b = document.createElement('button'); b.type = 'button'; b.textContent = '수정'; hb.prepend(b); }, PEN);
  await p.waitForTimeout(200); await p.screenshot({ path: OUT + 'E0_menu.png' });
  await p.mouse.click(380, 600); await p.waitForTimeout(300);
  const ib = async () => p.evaluate(() => { const fr = document.querySelector('.na_ph_frame'); const nb = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--na-nb')) || 0; fr.style.setProperty('--mkib', (nb / (parseFloat(getComputedStyle(fr).getPropertyValue('--k')) || 1)) + 'px'); });
  for (const k of ['E1', 'E2', 'E3']) {
    await s.to('orbitroom', rid); await p.waitForTimeout(300); await style(BASE + CSS[k]); await ib();
    await p.evaluate(([k, CHK, X, PEN]) => { const fr = document.querySelector('.na_ph_frame'), mi = fr.querySelector('.ob_mi'), b = fr.querySelector('.ob_b[data-id="mk7"]'), ko = b.querySelector('.ob_ko');
      if (k === 'E1') { mi.parentElement.classList.add('mk_dim'); b.classList.add('mk_keep'); const av = b.previousElementSibling; const inp = fr.querySelector('.ob_inp'); const box = inp.querySelector('.ob_msgin'); box.textContent = 'Dann geh halt früher'; box.classList.add('mk_fill'); const sb = inp.querySelector('.ob_send'); sb.innerHTML = '완료'; sb.classList.add('mk_done');
        inp.insertAdjacentHTML('beforebegin', `<div class="mk_eb"><span style="color:#5a5f69">${PEN}</span><span class="t"><small>말 고치기</small><span class="o">Dann geh halt früher · 그럼 좀 일찍 가</span></span><span class="seg"><b class="on">원문</b><b>한국어</b></span><span class="x">${X}</span></div>`); }
      if (k === 'E2') { mi.parentElement.classList.add('mk_dim'); b.classList.add('mk_keep', 'mk_ib'); b.firstChild.textContent = 'Dann geh halt früher'; b.insertAdjacentHTML('afterbegin', ''); b.childNodes[0].after(Object.assign(document.createElement('span'), { className: 'mk_caret' })); if (ko) ko.classList.add('mk_ibk');
        b.insertAdjacentHTML('afterend', `<div class="mk_ibar th mk_keep"><i class="no">${X}</i><i class="ok">${CHK}</i></div>`); }
      if (k === 'E3') { const sla = fr.querySelector('.ob_bg .ob_blob').style.background; fr.style.setProperty('--mksla', sla); const scr = fr.querySelector('.na_ph_scr .cg_canvas');
        scr.insertAdjacentHTML('beforeend', `<div class="mk_shade"></div><div class="mk_sh"><div class="g"></div><h4>말 고치기</h4><label>원문</label><div class="f on">Dann geh halt früher<span class="mk_caret" style="background:#1b1d24"></span></div><label>한국어</label><div class="f ko">그럼 좀 일찍 가</div><div class="bt"><b class="n">취소</b><b class="y">완료</b></div></div>`); } }, [k, CHK, X, PEN]);
    await p.waitForTimeout(250); await p.screenshot({ path: OUT + `${k}_edit.png` });
  }
  // 고친 뒤: 수정됨 (내 말은 시간 앞, 캐릭터 말은 한국어 줄 끝)
  await s.to('orbitroom', rid); await p.waitForTimeout(300); await style(`.mk_ed { font-size: 10.5px; opacity: .6; margin-right: 4px; } .ob_b.th .mk_edk { display: inline; font-size: 10.5px; color: rgba(30,32,40,.45); margin-left: 6px; }`);
  await p.evaluate(() => { const fr = document.querySelector('.na_ph_frame'); const m = fr.querySelector('.ob_b[data-id="mk6"] .ob_tin'); m.insertAdjacentHTML('afterbegin', '<span class="mk_ed">수정됨</span>'); const t = fr.querySelector('.ob_b[data-id="mk7"]'); t.firstChild.textContent = 'Dann geh halt früher hin'; t.querySelector('.ob_ko').insertAdjacentHTML('beforeend', '<span class="mk_edk">수정됨</span>'); });
  await p.waitForTimeout(200); await p.screenshot({ path: OUT + 'E9_after.png' });
 } finally { await s.close(); reset(); } })();
