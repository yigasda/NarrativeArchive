// Orbit "말 · 방 다루기" 묶음 시안 (실제 폰 화면 위에 얹어 찍어요).  node docs/mockups/orbit-marks/mock.cjs
// 길게 누른 카드: L1 마리나라식(흰 카드 · 아이콘만 두 줄 · 이모지는 웃는 얼굴 뒤) · L1b 그 웃는 얼굴을 눌렀을 때 · L2 지금 검정 카드에 아이콘 줄 · L3 세로 목록(글자 + 아이콘, 이모지 알약은 위)
// 표시: M1 (북마크 · 고정 · 메모 · AI에게 숨김이 말풍선에 붙은 모양)   시트: S1 방 메뉴 · S2 북마크 · 메모 · S3 휴지통
const { open } = require('/home/user/NarrativeArchive/tools/dev/probe.cjs');
const fs = require('fs'), path = require('path'), os = require('os');
const CHAT = path.join(os.homedir(), 'sillytavern/data/default-user/chats/default_Seraphina/na_test.jsonl');
const reset = () => fs.copyFileSync('/home/user/NarrativeArchive/tools/dev/na_test.jsonl', CHAT);
const B = '/scripts/extensions/third-party/NarrativeArchive/src/', OUT = '/home/user/NarrativeArchive/docs/mockups/orbit-marks/';
const I = (d, s = 22, w = 1.8) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
const IC = {
  re: '<circle cx="12" cy="12" r="9"/><path d="M8.5 14.3a4.6 4.6 0 0 0 7 0M9 9.6h.01M15 9.6h.01"/>',
  copy: '<rect x="9" y="9" width="11" height="11" rx="2.2"/><path d="M5 15V6.2A2.2 2.2 0 0 1 7.2 4H15"/>',
  edit: '<path d="M4 20l1.1-4.2L16.6 4.3a2 2 0 0 1 2.9 2.9L8 18.8 4 20z"/><path d="M14.5 6.5l3 3"/>',
  tr: '<path d="M3.5 6.5h9M8 4.5v2M10.8 6.5C10 10 7.600 12.600 4 14.200M6 9.800c1 1.900 2.700 3.300 4.800 4"/><path d="M12.800 20l3.700-8.500 3.700 8.500M14.100 17h4.800"/>',
  pick: '<path d="M4 7l1.800 1.800L9 5.500M4 15.500l1.800 1.800L9 14M13 7.500h7M13 16h7"/>',
  mark: '<path d="M7.200 4h9.600A1.200 1.200 0 0 1 18 5.200V20l-6-4.200L6 20V5.200A1.200 1.200 0 0 1 7.200 4z"/>',
  pin: '<path d="M9 4h6l-.8 6 3.300 3.200V15h-11v-1.800L9.800 10 9 4zM12 15v5.500"/>',
  note: '<path d="M5 4.500h14V15l-5 5H5zM14 20v-5h5M8.500 9h7M8.500 12.500h4"/>',
  hide: '<path d="M3.500 3.500l17 17M10.300 6.200c.6-.1 1.100-.2 1.700-.2 5 0 8.300 4.100 9.300 6-.5 1-1.500 2.400-3 3.600M6.400 7.900C4.600 9.100 3.300 10.800 2.700 12c1 1.900 4.300 6 9.300 6 1.400 0 2.700-.3 3.900-.9M9.900 9.900a3 3 0 0 0 4.200 4.200"/>',
  del: '<path d="M4 7h16M9.500 7V4.500h5V7M6.500 7l.8 12.500h9.400L17.500 7M10 11v5M14 11v5"/>',
  plus: '<path d="M12 5v14M5 12h14"/>', more: '<circle cx="5.500" cy="12" r="1.300" fill="currentColor"/><circle cx="12" cy="12" r="1.300" fill="currentColor"/><circle cx="18.500" cy="12" r="1.300" fill="currentColor"/>',
  back: '<path d="M9 14l-5-5 5-5M4 9h9a6 6 0 0 1 0 12h-2"/>', name: '<path d="M4 7V5h16v2M12 5v14M9 19h6"/>', ppl: '<circle cx="9" cy="8.500" r="3.200"/><path d="M3 19.500c.5-3.200 2.900-5 6-5s5.500 1.800 6 5M17 5.700a3 3 0 0 1 0 5.600M18.500 14.800c1.500.7 2.400 2.300 2.600 4.700"/>',
};
const ACTS = [['re', '반응'], ['copy', '복사'], ['edit', '수정'], ['tr', '재번역'], ['pick', '선택'], ['mark', '북마크'], ['pin', '고정'], ['note', '메모'], ['hide', 'AI에게 숨기기'], ['del', '삭제']];
const EM = ['❤️', '😂', '😮', '😢', '😡', '👍'];
const KEEP = ` .na_ph_frame .ob_msgs.hold .ob_mi > :is(.mk_card, .mk_qr, .mk_list) { opacity: 1 !important; } .na_ph_frame .ob_pill { display: none !important; }`;
const CSS = {
  L1: `.mk_card { align-self: flex-start; margin: 0 0 6px 44px; padding: 5px 6px; border-radius: 16px; background: rgba(255,255,255,.96); box-shadow: 0 12px 28px rgba(30,24,50,.2), 0 1px 2px rgba(30,24,50,.1); position: relative; z-index: 3; display: grid; grid-template-columns: repeat(5, 40px); gap: 1px; color: #4a4d57; }
    .mk_card i { height: 38px; display: grid; place-items: center; border-radius: 11px; } .mk_card i.red { color: #c4553f; }`,
  L1b: `.mk_qr { align-self: flex-start; display: flex; align-items: center; gap: 1px; padding: 5px 7px; margin: 0 0 6px 44px; border-radius: 999px; background: rgba(255,255,255,.96); box-shadow: 0 12px 28px rgba(30,24,50,.2), 0 1px 2px rgba(30,24,50,.1); position: relative; z-index: 3; color: #4a4d57; }
    .mk_qr i { width: 35px; height: 35px; display: grid; place-items: center; font-style: normal; font-size: 21px; border-radius: 50%; } .mk_qr i.on { background: rgba(20,22,30,.08); } .mk_qr .p { background: rgba(20,22,30,.06); width: 30px; height: 30px; margin-left: 3px; } .mk_qr .b { width: 30px; height: 30px; margin-right: 2px; color: #7a7e88; }`,
  L2: `.mk_card { align-self: flex-start; margin: 0 0 6px 44px; border-radius: 18px; overflow: hidden; background: #15161a; box-shadow: inset 0 1px 0 rgba(255,255,255,.16), 0 10px 24px rgba(20,22,30,.3); position: relative; z-index: 3; color: #fff; }
    .mk_card .r { display: flex; align-items: center; gap: 1px; padding: 6px 8px; border-bottom: 1px solid rgba(255,255,255,.12); } .mk_card .r i { width: 33px; height: 33px; display: grid; place-items: center; font-style: normal; font-size: 20px; border-radius: 50%; } .mk_card .r i.on { background: rgba(255,255,255,.14); } .mk_card .r .p { background: rgba(255,255,255,.12); width: 29px; height: 29px; margin-left: 3px; }
    .mk_card .g { display: grid; grid-template-columns: repeat(9, 1fr); padding: 4px 6px; } .mk_card .g i { height: 36px; display: grid; place-items: center; color: rgba(255,255,255,.92); } .mk_card .g i.red { color: #ff8a7a; }`,
  L3: `.mk_qr { align-self: flex-start; display: flex; align-items: center; gap: 1px; padding: 5px 7px; margin: 0 0 6px 44px; border-radius: 999px; background: rgba(255,255,255,.96); box-shadow: 0 12px 28px rgba(30,24,50,.2), 0 1px 2px rgba(30,24,50,.1); position: relative; z-index: 3; color: #4a4d57; }
    .mk_qr i { width: 35px; height: 35px; display: grid; place-items: center; font-style: normal; font-size: 21px; border-radius: 50%; } .mk_qr i.on { background: rgba(20,22,30,.08); } .mk_qr .p { background: rgba(20,22,30,.06); width: 30px; height: 30px; margin-left: 3px; }
    .mk_list { align-self: flex-start; width: 212px; margin: 6px 0 0 44px; border-radius: 16px; overflow: hidden; background: rgba(255,255,255,.96); box-shadow: 0 12px 28px rgba(30,24,50,.2), 0 1px 2px rgba(30,24,50,.1); position: relative; z-index: 3; color: #23252c; }
    .mk_list div { display: flex; align-items: center; justify-content: space-between; height: 38px; padding: 0 14px; font-size: 14px; } .mk_list div + div { border-top: 1px solid rgba(20,22,30,.07); } .mk_list div.sep { border-top: 6px solid rgba(20,22,30,.06); } .mk_list svg { color: #5a5e68; } .mk_list .red, .mk_list .red svg { color: #c4553f; }`,
};
const SHEET = `.mk_more { margin-left: auto; width: 36px; height: 36px; display: grid; place-items: center; color: #1b1d24; } .mk_shade { position: absolute; inset: 0; z-index: 29; background: rgba(20,16,36,.28); } .mk_sheet { position: absolute; left: 0; right: 0; bottom: 0; z-index: 30; padding: 10px 14px calc(18px + var(--nbk, 0px)); border-radius: 24px 24px 0 0; background: #f7f6fa; box-shadow: 0 -10px 30px rgba(30,24,50,.18); color: #1b1d24; }
  .mk_sheet .grab { display: block; width: 38px; height: 4px; margin: 0 auto 12px; border-radius: 4px; background: rgba(20,22,30,.16); } .mk_sheet h4 { display: flex; align-items: baseline; gap: 6px; margin: 0 4px 10px; font-size: 16px; font-weight: 700; } .mk_sheet h4 small { font-size: 12.5px; font-weight: 500; color: #8a8e98; }
  .mk_rows { border-radius: 16px; background: #fff; box-shadow: 0 1px 2px rgba(30,24,50,.05), 0 8px 22px rgba(30,24,50,.06); overflow: hidden; } .mk_rows + .mk_rows { margin-top: 10px; } .mk_row { display: flex; align-items: center; gap: 12px; min-height: 50px; padding: 0 14px; font-size: 15px; } .mk_row + .mk_row { border-top: 1px solid #eef0f3; } .mk_row svg { flex: none; color: #5a5e68; } .mk_row b { flex: 1; font-weight: 500; } .mk_row em { font-style: normal; font-size: 13px; color: #8a8e98; } .mk_row.red, .mk_row.red svg { color: #c4553f; }
  .mk_tabs { display: flex; gap: 6px; margin: 0 2px 10px; } .mk_tabs span { padding: 7px 13px; border-radius: 999px; font-size: 13px; font-weight: 600; color: #5a5e68; background: rgba(20,22,30,.06); } .mk_tabs .on { color: #fff; background: #15161a; }
  .mk_it { padding: 11px 14px; } .mk_it + .mk_it { border-top: 1px solid #eef0f3; } .mk_it .h { display: flex; align-items: center; gap: 6px; font-size: 12px; color: #8a8e98; } .mk_it .h b { color: #4a4d57; font-weight: 600; } .mk_it .h svg { color: #8a8e98; } .mk_it .h i { margin-left: auto; font-style: normal; } .mk_it p { margin: 3px 0 0; font-size: 14.5px; line-height: 1.35; color: #1b1d24; } .mk_it p small { display: block; font-size: 12px; color: #8a8e98; } .mk_it .n { margin-top: 6px; padding: 6px 9px; border-radius: 9px; background: #f6f3ea; font-size: 12.5px; color: #6b5d3a; }
  .mk_it .a { display: flex; gap: 6px; margin-top: 8px; } .mk_it .a span { padding: 6px 11px; border-radius: 999px; font-size: 12.5px; font-weight: 600; background: rgba(20,22,30,.06); color: #23252c; } .mk_it .a .k { background: #15161a; color: #fff; }
  .mk_foot { display: flex; justify-content: space-between; align-items: center; margin: 12px 4px 0; font-size: 12.5px; color: #8a8e98; } .mk_foot b { color: #c4553f; font-weight: 600; }`;
const MARK = `.mk_more { margin-left: auto; width: 36px; height: 36px; display: grid; place-items: center; color: #1b1d24; } .na_ph_frame .ob_msgs { padding-top: 46px !important; } .mk_tag { position: absolute; right: -22px; bottom: 2px; display: flex; flex-direction: column; gap: 3px; color: rgba(255,255,255,.9); } .ob_b.me .mk_tag { right: auto; left: -22px; } .mk_tag svg { filter: drop-shadow(0 1px 2px rgba(30,24,50,.25)); }
  .na_ph_frame .ob_b.mk_hid { opacity: .46; } .mk_hidl { align-self: flex-start; margin: 1px 0 2px 48px; display: flex; align-items: center; gap: 4px; font-size: 10.5px; color: rgba(255,255,255,.82); } .mk_pinbar { position: absolute; left: 12px; right: 12px; top: 126px; z-index: 4; display: flex; align-items: center; gap: 8px; padding: 8px 12px; border-radius: 14px; background: rgba(255,255,255,.62); backdrop-filter: blur(14px); box-shadow: inset 0 1px 0 rgba(255,255,255,.7), 0 6px 18px rgba(40,40,80,.1); font-size: 12.5px; color: #1b1d24; } .mk_pinbar svg { flex: none; color: #5a5e68; } .mk_pinbar b { flex: 1; font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; } .mk_pinbar em { font-style: normal; color: #8a8e98; }
  .mk_note { align-self: flex-start; max-width: 230px; margin: 2px 0 2px 44px; padding: 6px 10px; border-radius: 4px 12px 12px 12px; background: rgba(255,247,220,.92); box-shadow: 0 1px 2px rgba(60,50,20,.1); font-size: 12px; line-height: 1.35; color: #6b5d3a; }`;
(async () => { reset(); const s = await open('light', { out: os.tmpdir(), width: 412, height: 915, mobile: true, init: true }); const p = s.p;
 try {
  await p.evaluate(() => document.documentElement.style.setProperty('--na-nb', '48px'));
  await s.run(async ({ m }) => { const n = SillyTavern.getContext().chat.length - 1; m.text = String(m.text).replace(/\n# STATE/, `\n## #26–#${n} — Am Fluss (Oct 25, night, Varo)\n- Sie redeten.\n\n# STATE`); m.boundary = n; });
  await s.to('set'); await p.click('.na_ph_pmode[data-v=live]'); await p.waitForTimeout(600); await p.click('.na_ob_start'); await p.waitForTimeout(2000);
  await s.to('orbitnew'); await p.waitForTimeout(400); await p.locator('.na_ph_frame .na_ob_pick', { hasText: 'Mara' }).first().click(); await p.waitForTimeout(300); await p.click('.na_ph_frame .na_ob_make'); await p.waitForTimeout(500);
  const rid = await p.evaluate(async B => { const core = await import(B + 'core.js'), st = await import(B + 'phone2store.js'); const m = core.getMeta(), r = st.liveRooms(m)[0], me = st.liveWorld(m).persona; const T = [[me, '내일 열 시에 정비소 올 수 있어?', ''], ['Mara', 'Ja klar, Samstag passt!', '응 좋아, 토요일 괜찮아!'], ['Mara', 'Bring Kuchen mit 😄', '케이크 가져와 😄'], [me, '무슨 케이크', ''], ['Mara', 'Den mit Kirschen', '체리 든 거'], ['Mara', 'Vom Bäcker an der Ecke', '모퉁이 빵집 거'], [me, '알겠어 내일 봐', ''], ['Mara', 'Bis morgen', '내일 봐']]; const t0 = Date.now() - T.length * 60000; r.messages = T.map(([from, text, ko], i) => ({ id: `mk${i}`, from, text, ko, at: t0 + i * 60000, told: true })); r.messages[2].reacts = [{ by: me, e: '❤️', at: Date.now() - 5000 }]; for (const n of r.members) (r.read ||= {})[st.liveKey(n)] = Date.now(); await core.saveMeta(); return r.id; }, B);
  await s.to('orbit'); await s.to('orbitroom', rid); await p.waitForTimeout(900);
  const style = css => p.evaluate(css => { document.getElementById('mk_q')?.remove(); const t = document.createElement('style'); t.id = 'mk_q'; t.textContent = css; document.head.append(t); }, css);
  const shot = async k => { await p.waitForTimeout(300); await p.screenshot({ path: OUT + `${k}.png` }); };
  // 길게 누른 카드
  for (const k of ['L1', 'L1b', 'L2', 'L3']) {
    await s.to('orbitroom', rid); await p.waitForTimeout(400);
    const bx = await p.locator('.na_ph_frame .ob_b.th').nth(k === 'L3' ? 0 : 3).boundingBox(); await p.mouse.move(bx.x + 30, bx.y + 15); await p.mouse.down(); await p.waitForTimeout(700); await p.mouse.up(); await p.waitForTimeout(350);
    await style(CSS[k] + KEEP);
    await p.evaluate(([k, ACTS, IC, EM]) => { const I = (d, s = 22, w = 1.8) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
      const pill = document.querySelector('.na_ph_frame .ob_pill'), el = (c, h) => { const d = document.createElement('div'); d.className = c; d.innerHTML = h; return d; };
      const emo = EM.map((e, i) => `<i class="${i === 0 ? 'on' : ''}">${e}</i>`).join('') + `<i class="p">${I(IC.plus, 17, 2.2)}</i>`;
      if (k === 'L1') pill.before(el('mk_card', ACTS.map(([a]) => `<i class="${a === 'del' ? 'red' : ''}">${I(IC[a])}</i>`).join('')));
      if (k === 'L1b') pill.before(el('mk_qr', `<i class="b">${I(IC.back, 18, 2)}</i>` + emo));
      if (k === 'L2') pill.before(el('mk_card', `<div class="r">${emo}</div><div class="g">${ACTS.slice(1).map(([a]) => `<i class="${a === 'del' ? 'red' : ''}">${I(IC[a], 20)}</i>`).join('')}</div>`));
      if (k === 'L3') { pill.before(el('mk_qr', emo)); pill.nextElementSibling.after(el('mk_list', ACTS.slice(1).map(([a, l]) => `<div class="${a === 'del' ? 'red sep' : a === 'mark' ? 'sep' : ''}">${l}${I(IC[a], 19)}</div>`).join(''))); }
    }, [k, ACTS, IC, EM]);
    await shot(k);
    await p.mouse.click(380, 200); await p.waitForTimeout(300);
  }
  // 말풍선에 붙는 표시
  await s.to('orbitroom', rid); await p.waitForTimeout(400); await style(MARK);
  await p.evaluate(IC => { const I = (d, s = 14, w = 2.1) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
    const bs = [...document.querySelectorAll('.na_ph_frame .ob_b[data-id]')], by = id => bs.find(b => b.dataset.id === id), tag = (b, ...ks) => b.insertAdjacentHTML('beforeend', `<span class="mk_tag">${ks.map(k => I(IC[k])).join('')}</span>`);
    tag(by('mk1'), 'mark'); tag(by('mk5'), 'pin', 'mark'); tag(by('mk3'), 'mark');
    by('mk4').classList.add('mk_hid'); by('mk4').insertAdjacentHTML('afterend', `<div class="mk_hidl">${I(IC.hide, 11)}AI에게 숨김</div>`);
    by('mk2').insertAdjacentHTML('afterend', `<div class="mk_note">케이크는 모퉁이 빵집에서 금요일 저녁에 미리 사 두기</div>`); tag(by('mk2'), 'note');
    document.querySelector('.na_ph_frame .ob_ct').insertAdjacentHTML('beforeend', `<span class="mk_more"><svg width="22" height="22" viewBox="0 0 24 24"><circle cx="5.5" cy="12" r="1.6" fill="currentColor"/><circle cx="12" cy="12" r="1.6" fill="currentColor"/><circle cx="18.5" cy="12" r="1.6" fill="currentColor"/></svg></span>`);
    document.querySelector('.na_ph_frame .cg_canvas, .na_ph_frame .ax_canvas, .na_ph_frame .na_ph_scr').insertAdjacentHTML('beforeend', `<div class="mk_pinbar">${I(IC.pin, 15, 1.9)}<b>Vom Bäcker an der Ecke</b><em>고정 1</em></div>`);
  }, IC);
  await shot('M1');
  // 시트 셋
  const sheet = async (k, html) => { await s.to('orbitroom', rid); await p.waitForTimeout(400); await style(SHEET);
    await p.evaluate(html => { document.querySelector('.na_ph_frame .ob_ct').insertAdjacentHTML('beforeend', `<span class="mk_more"><svg width="22" height="22" viewBox="0 0 24 24"><circle cx="5.5" cy="12" r="1.6" fill="currentColor"/><circle cx="12" cy="12" r="1.6" fill="currentColor"/><circle cx="18.5" cy="12" r="1.6" fill="currentColor"/></svg></span>`); const host = document.querySelector('.na_ph_frame .ob_msgs').parentElement; host.insertAdjacentHTML('beforeend', `<div class="mk_shade"></div><div class="mk_sheet"><i class="grab"></i>${html}</div>`); }, html); await shot(k); };
  const row = (ic, l, e = '', c = '') => `<div class="mk_row ${c}">${I(IC[ic], 20)}<b>${l}</b>${e ? `<em>${e}</em>` : ''}</div>`;
  await sheet('S1', `<h4>Mara</h4><div class="mk_rows">${row('mark', '북마크 · 메모', '3')}${row('pin', '고정한 말', '1')}${row('del', '휴지통', '2')}</div><div class="mk_rows">${row('name', '방 이름')}${row('ppl', '사람 넣고 빼기', '2명')}</div><div class="mk_rows">${row('del', '방 지우기', '', 'red')}</div>`);
  const it = (who, when, t, ko, extra = '') => `<div class="mk_it"><div class="h"><b>${who}</b>${when}${extra.includes('n') ? '' : ''}<i>${I(IC.mark, 13, 2)}</i></div><p>${t}${ko ? `<small>${ko}</small>` : ''}</p>${extra}</div>`;
  await sheet('S2', `<h4>북마크 · 메모 <small>3</small></h4><div class="mk_tabs"><span class="on">이 방</span><span>모든 방</span></div><div class="mk_rows">${it('Mara', '오늘 14:02', 'Ja klar, Samstag passt!', '응 좋아, 토요일 괜찮아!')}${it('Mara', '오늘 14:03', 'Bring Kuchen mit 😄', '케이크 가져와 😄', '<div class="n">케이크는 모퉁이 빵집에서 금요일 저녁에 미리 사 두기</div>')}${it('나', '오늘 14:04', '무슨 케이크', '')}</div>`);
  const tr = (who, when, t, ko, left) => `<div class="mk_it"><div class="h"><b>${who}</b>${when}<i>${left}</i></div><p>${t}${ko ? `<small>${ko}</small>` : ''}</p><div class="a"><span class="k">되살리기</span><span>아주 지우기</span></div></div>`;
  await sheet('S3', `<h4>휴지통 <small>2</small></h4><div class="mk_rows">${tr('Mara', '오늘 14:06', 'Vom Bäcker an der Ecke', '모퉁이 빵집 거', '30일 남음')}${tr('나', '어제 22:41', '아 그리고 열쇠 얘긴 하지 마', '', '29일 남음')}</div><div class="mk_foot"><span>지운 말은 30일 동안 남아요</span><b>전부 비우기</b></div>`);
 } finally { await s.close(); reset(); } })().catch(e => { console.error(e); reset(); process.exit(1); });
