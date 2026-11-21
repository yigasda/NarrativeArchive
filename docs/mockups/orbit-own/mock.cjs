// Orbit에 새 기능 자리를 Orbit 식으로 새로 짓기 (마리나라 배치를 옮기지 않아요. 기능만).
// 지금 화면(유리 머리줄 · 유리 입력 알약 · B2 말풍선 · 검정 카드 · 흰 시트 · 검정 알약 탭 · 폰 홈의 젤 아이콘)은 그대로 두고 그 말로 새로 그려요.
// 방의 기능을 모으는 곳 세 가지(하나 고르기):
//   O1 연락처 카드: 머리줄 이름을 누르면 그 사람 색 전체 화면 — 큰 얼굴 · 젤 단추 넷 · 유리 카드(소개 · 오늘 일과 · 이 방 · 답장)
//   O2 젤 타일 판: 머리줄 오른쪽 ⋯ → 흰 시트에 기능마다 폰 홈 같은 젤 아이콘
//   O3 머리줄이 펼쳐짐: 머리줄을 누르면 그 자리에서 아래로 커지는 유리 판(일과 막대 + 검정 알약 탭)
// 공통: T 입력 알약 왼쪽 + → 위로 젤 서랍(사진 · 이모지 · 스티커 · GIF · 빠른 전환 · 방향 주기 …), H 길게 누른 검정 카드에 글자 단추 줄 더,
//   L 목록 머리 둥근 단추 줄에 찾기 · ⋯(Orbit 설정: 밝게 · 어둡게, 기본 연결, 페르소나)
const { open } = require('/home/user/NarrativeArchive/tools/dev/probe.cjs');
const fs = require('fs'), path = require('path'), os = require('os');
const CHAT = path.join(os.homedir(), 'sillytavern/data/default-user/chats/default_Seraphina/na_test.jsonl');
const reset = () => fs.copyFileSync('/home/user/NarrativeArchive/tools/dev/na_test.jsonl', CHAT);
const B = '/scripts/extensions/third-party/NarrativeArchive/src/', OUT = '/home/user/NarrativeArchive/docs/mockups/orbit-own/';
const P = {
  srch: 'M11 5a6 6 0 1 0 0 12 6 6 0 0 0 0-12zM20 20l-4.3-4.3', more: 'M5.5 12h.01M12 12h.01M18.5 12h.01', plus: 'M12 5v14M5 12h14', x: 'M6 6l12 12M18 6L6 18', back: 'M15 5l-7 7 7 7', chev: 'M9 6l6 6-6 6',
  mark: 'M7 4h10v16l-5-3.5L7 20z', trash: 'M4.5 7h15M9.5 7V4.5h5V7M6.5 7l1 13h9l1-13', pin: 'M9 4h6l-1 6 3.5 3.5V15h-11v-1.5L10 10zM12 15v5.5', user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4.5 20a7.5 7.5 0 0 1 15 0',
  cal: 'M4.5 6h15v14h-15zM4.5 10.5h15M8.5 4v4M15.5 4v4', bell: 'M6.5 16V11a5.5 5.5 0 0 1 11 0v5l1.5 1.5h-14zM10 20.5a2.2 2.2 0 0 0 4 0', plug: 'M9 3v4M15 3v4M6.5 7h11v3.5a5.5 5.5 0 0 1-11 0zM12 16v5',
  mask: 'M3.5 7c3 0 5.5-1.5 8.5-1.5S17.5 7 20.5 7c0 7-3.8 10.5-8.5 10.5S3.5 14 3.5 7zM8 10.5h2.5M13.5 10.5H16M10 14c1.3.8 2.7.8 4 0', call: 'M7 4h3l1.5 4-2 1.3a10 10 0 0 0 5.2 5.2L16 12.5l4 1.5v3a2 2 0 0 1-2 2C10.6 18.5 5.5 13.4 5 6a2 2 0 0 1 2-2z',
  cam: 'M4 8.5h3.5L9 6h6l1.5 2.5H20V19H4zM12 10a3.3 3.3 0 1 0 0 6.6 3.3 3.3 0 0 0 0-6.6z', music: 'M9 17.5V6l10-2v11.5M6.5 15a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5zM16.5 13a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5z',
  dice: 'M5 5h14v14H5zM9 9h.01M15 9h.01M12 12h.01M9 15h.01M15 15h.01', branch: 'M7 4.5v15M7 7.5a2 2 0 1 0 0-.01M17 9.5a2 2 0 1 0 0-.01M17 11.5c0 3.5-4 3.5-10 5', book: 'M5 4h9a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3zM5 17a3 3 0 0 1 3-3h9',
  tr: 'M4 6h8M8 4v2c0 4-2 7-5 8M6 10c1.5 2 3.5 3.5 6 4M13 20l4-9 4 9M14.5 17h5', photo: 'M4 5h16v14H4zM4 15l4.5-4.5 4 4 2.5-2.5L20 17M15.5 9.5h.01', smile: 'M12 3.5a8.5 8.5 0 1 0 0 17 8.5 8.5 0 0 0 0-17zM8.5 14a4.8 4.8 0 0 0 7 0M9 9.8h.01M15 9.8h.01',
  sticker: 'M5 5h14v8l-6 6H5zM13 19v-6h6', gif: 'M4 6h16v12H4zM9.5 10H8v4h1.5v-1.5M12 10v4M14.5 14v-4H17M14.5 12h2', kao: 'M5 9.5l2 1.5-2 1.5M19 9.5l-2 1.5 2 1.5M9.5 15.5c1.6 1 3.4 1 5 0', steer: 'M5 19 19 5M19 5h-6M19 5v6', write: 'M4 20h4L19 9l-4-4L4 16zM14 20h6',
  sun: 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4', moon: 'M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z', send: 'M5 12h13M13 6l6 6-6 6',
};
// 폰 홈의 젤 아이콘 색(phonehome.js CG_GEL) 그대로
const GEL = { search: ['#bfd3e9', '#8faed1'], note: ['#f4e5b5', '#dcc680', '#5a4a1f'], set: ['#d1d4d9', '#a2a7af'], wallet: ['#f8f0d2', '#e6d48e', '#7a6420'], diary: ['#d3cae9', '#a699c9'], cal: ['#f6f7f9', '#dcdfe5', '#b0564e'], sns: ['#efc4d0', '#d494a7'], mail: ['#bfd3e9', '#8faed1'], shop: ['#ecd3e7', '#c596bc'], call: ['#bbddc0', '#89b892'], cam: ['#e2e4e8', '#aeb2b9', '#2a313b'], voice: ['#f3d9c2', '#dcaa7f'], invest: ['#cbe4d2', '#86bb98'], map: ['#c3dcc1', '#93ba97'], files: ['#cad6f0', '#8ea6db'], weather: ['#cbe5f4', '#8cc3e3'], photo: ['#f0cbb5', '#d89f98'], health: ['#f4cfd3', '#dd9aa3'], bank: ['#d9d2f0', '#a99ad8'], delivery: ['#c2ece8', '#7fcfc5'] };
const CSS = `
.mg { position: relative; display: grid; place-items: center; border-radius: 16px; background: linear-gradient(180deg, var(--c1), var(--c2)); box-shadow: inset 0 1.5px 1px rgba(255,255,255,.8), inset 0 -3px 6px rgba(40,40,60,.14), 0 1px 1px rgba(40,50,70,.08), 0 6px 16px rgba(40,50,70,.14); }
.mg::before { content: ''; position: absolute; inset: 0; border-radius: inherit; padding: 1px; background: linear-gradient(160deg, rgba(255,255,255,.95), rgba(255,255,255,.25) 35%, rgba(255,255,255,.05) 62%, rgba(255,255,255,.55)); -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0); -webkit-mask-composite: xor; mask-composite: exclude; } .mg svg { position: relative; filter: drop-shadow(0 1px 1px rgba(40,40,60,.18)); }
.mgt { display: flex; flex-direction: column; align-items: center; gap: 6px; } .mgt span { font-size: 11.5px; font-weight: 500; color: #1b1d24; white-space: nowrap; }
.mkc { position: relative; flex: none; width: 46px; height: 46px; border-radius: 50%; display: grid; place-items: center; color: #1b1d24; }
.na_ph_frame .ob_ct .mkc { width: 40px; height: 40px; margin-left: auto; background: rgba(255,255,255,.42); box-shadow: inset 0 1px 0 rgba(255,255,255,.75); }
.na_ph_frame .ob_inp .mkp { flex: none; width: 38px; height: 38px; margin-left: -10px; border-radius: 50%; display: grid; place-items: center; color: #1b1d24; background: rgba(255,255,255,.45); box-shadow: inset 0 1px 0 rgba(255,255,255,.8); } .na_ph_frame .ob_inp .mkp.on { background: #15161a; color: #fff; }
`;
const ic = (k, s = 22, w = 2) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"><path d="${P[k]}"/></svg>`;
(async () => { reset(); const s = await open('light', { out: os.tmpdir(), width: 412, height: 915, mobile: true, init: true }); const p = s.p;
 try {
  await p.evaluate(() => document.documentElement.style.setProperty('--na-nb', '48px'));
  await s.run(async ({ m }) => { const n = SillyTavern.getContext().chat.length - 1; m.text = String(m.text).replace(/\n# STATE/, `\n## #26–#${n} — Am Fluss (Oct 25, night, Varo)\n- Sie redeten.\n\n# STATE`); m.boundary = n; });
  await s.to('set'); await p.click('.na_ph_pmode[data-v=live]'); await p.waitForTimeout(600); await p.click('.na_ob_start'); await p.waitForTimeout(2000);
  await s.to('orbitnew'); await p.waitForTimeout(400); await p.locator('.na_ph_frame .na_ob_pick', { hasText: 'Mara' }).first().click(); await p.waitForTimeout(300); await p.click('.na_ph_frame .na_ob_make'); await p.waitForTimeout(500);
  const rid = await p.evaluate(async B => { const core = await import(B + 'core.js'), st = await import(B + 'phone2store.js'); const m = core.getMeta(), r = st.liveRooms(m)[0], me = st.liveWorld(m).persona; const T = [[me, '내일 열 시에 정비소 올 수 있어?', ''], ['Mara', 'Ja klar, Samstag passt!', '응 좋아, 토요일 괜찮아!'], ['Mara', 'Bring Kuchen mit 😄', '케이크 가져와 😄'], [me, '무슨 케이크', ''], ['Mara', 'Den mit Kirschen', '체리 든 거'], ['Mara', 'Vom Bäcker an der Ecke', '모퉁이 빵집 거'], [me, '알겠어 내일 봐', ''], ['Mara', 'Bis morgen', '내일 봐']]; const t0 = Date.now() - T.length * 60000; r.messages = T.map(([from, text, ko], i) => ({ id: `mk${i}`, from, text, ko, at: t0 + i * 60000, told: true, ...(i === 7 ? { state: 'Werkstatt · Feierabend' } : {}) })); r.messages[2].reacts = [{ by: me, e: '❤️', at: Date.now() - 9000 }]; for (const n of r.members) (r.read ||= {})[st.liveKey(n)] = Date.now(); await core.saveMeta(); return r.id; }, B);
  const style = css => p.evaluate(css => { document.getElementById('mk_q')?.remove(); const t = document.createElement('style'); t.id = 'mk_q'; t.textContent = css; document.head.append(t); }, css);
  const shot = async k => { await p.waitForTimeout(350); await p.screenshot({ path: OUT + `${k}.png` }); console.log('shot', k); };
  const room = async (css = '') => { await p.mouse.click(206, 140); await s.to('home'); await p.waitForTimeout(250); await s.to('orbit'); await p.waitForTimeout(250); await s.to('orbitroom', rid); await p.waitForTimeout(600); await style(CSS + css);
    await p.evaluate(() => { const e = document.querySelector('.na_ph_frame .ob_msgs'); e.scrollTop = e.scrollHeight; }); };
  const run = (fn, arg) => p.evaluate(([src, P, GEL, arg]) => { const ic = (k, s = 22, w = 2) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"><path d="${P[k]}"/></svg>`;
    const gel = (g, k, sz = 56, isz = 26) => { const [c1, c2, st = '#ffffff'] = GEL[g]; return `<span class="mg" style="width:${sz}px;height:${sz}px;--c1:${c1}d9;--c2:${c2}d9;color:${st}">${ic(k, isz, 2)}</span>`; };
    const fn = new Function('ic', 'gel', 'arg', src); return fn(ic, gel, arg); }, [fn.toString().replace(/^[^{]*{/, '').replace(/}\s*$/, ''), P, GEL, arg]);
  // ---- O1 연락처 카드
  await room(`.na_ph_frame .ax_orbitroom .ax_sb { position: relative; z-index: 8; } .mkO1 { position: absolute; inset: 0; z-index: 7; overflow: hidden; padding: 54px 14px 0; color: #1b1d24; } .mkO1 .bg { position: absolute; inset: 0; z-index: -1; } .mkO1 .tp { display: flex; justify-content: space-between; margin: 4px -2px 0; }
    .mkO1 .hd { display: flex; flex-direction: column; align-items: center; gap: 3px; margin-top: 2px; text-align: center; } .mkO1 .hd .ob_face { width: 92px !important; height: 92px !important; font-size: 36px !important; } .mkO1 .hd b { margin-top: 10px; font-size: 24px; font-weight: 700; } .mkO1 .hd .s { font-size: 13.5px; color: rgba(27,29,36,.66) !important; }
    .mkO1 .ac { display: flex; justify-content: space-between; margin: 18px 8px 16px; } .mkO1 .cd { margin-bottom: 10px; padding: 12px 14px; border-radius: 22px; } .mkO1 .cd h6 { margin: 0 0 6px; font-size: 12px; font-weight: 600; color: rgba(27,29,36,.55); }
    .mkO1 .cd p { margin: 0; font-size: 15px; line-height: 1.35; } .mkO1 .cd p small { display: block; font-size: 12.5px; color: rgba(27,29,36,.6); }
    .mkO1 .bar { display: flex; gap: 3px; height: 10px; margin: 4px 0 6px; } .mkO1 .bar i { border-radius: 5px; } .mkO1 .bl { display: flex; justify-content: space-between; font-size: 10.5px; color: rgba(27,29,36,.5); } .mkO1 .now { position: relative; } .mkO1 .now::after { content: ''; position: absolute; left: 50%; top: -4px; bottom: -4px; width: 2px; margin-left: -1px; border-radius: 1px; background: #15161a; }
    .mkO1 .rw { display: flex; align-items: center; gap: 12px; height: 46px; font-size: 15px; } .mkO1 .rw + .rw { border-top: 1px solid rgba(255,255,255,.55); } .mkO1 .rw b { flex: 1; font-weight: 500; } .mkO1 .rw em { font-style: normal; font-size: 13.5px; color: rgba(27,29,36,.55); } .mkO1 .rw .ch { color: rgba(27,29,36,.4); display: grid; }`);
  await run(() => { const scr = document.querySelector('.na_ph_frame .ob_msgs').parentElement, bg = document.querySelector('.na_ph_frame .ob_bg').outerHTML, face = document.querySelector('.na_ph_frame .ob_ct .ob_face').outerHTML;
    const R = (i, l, e = '') => `<div class="rw">${ic(i, 20)}<b>${l}</b>${e ? `<em>${e}</em>` : ''}<span class="ch">${ic('chev', 16)}</span></div>`;
    scr.insertAdjacentHTML('beforeend', `<div class="mkO1"><div class="bg">${bg}</div><div class="tp"><span class="mkc ob_glass">${ic('back', 21)}</span><span class="mkc ob_glass">${ic('more', 24, 2.6)}</span></div>
      <div class="hd">${face}<b>Mara</b><div class="s">Werkstatt · Feierabend · Varo ☀ 13:24</div></div>
      <div class="ac"><span class="mgt">${gel('search', 'srch')}<span>찾기</span></span><span class="mgt">${gel('call', 'call')}<span>통화</span></span><span class="mgt">${gel('photo', 'cam')}<span>셀카 부탁</span></span><span class="mgt">${gel('sns', 'bell')}<span>먼저 연락</span></span></div>
      <div class="cd ob_glass"><h6>소개</h6><p>Schrauben, Kuchen, schlechte Witze 🔧<small>나사, 케이크, 썰렁한 농담</small></p></div>
      <div class="cd ob_glass"><h6>오늘 일과</h6><div class="bar"><i style="flex:7;background:rgba(27,29,36,.22)"></i><i style="flex:2;background:#a7c7a2"></i><i style="flex:8;background:#e2b48c"></i><i class="now" style="flex:3;background:#a7c7a2"></i><i style="flex:4;background:#b9b4dd"></i></div><div class="bl"><span>0시</span><span>12시</span><span>24시</span></div></div>
      <div class="cd ob_glass" style="padding:2px 14px">${R('mark', '북마크 · 메모', '3')}${R('pin', '고정한 말', '1')}${R('trash', '휴지통', '2')}</div></div>`); });
  await shot('O1');
  // ---- O2 젤 타일 판
  await room(`.mkT2 .grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px 0; padding: 4px 2px 6px; } .mkT2 .who { display: flex; align-items: center; gap: 10px; margin: 0 4px 14px; } .mkT2 .who b { font-size: 17px; font-weight: 600; } .mkT2 .who .s { font-size: 12.5px; color: #6b707b !important; }`);
  await run(() => { const ct = document.querySelector('.na_ph_frame .ob_ct'); ct.insertAdjacentHTML('beforeend', `<span class="mkc">${ic('more', 24, 2.6)}</span>`); const face = ct.querySelector('.ob_face').outerHTML.replace(/width:\s*\d+px;height:\s*\d+px/, 'width:40px;height:40px');
    const T = [['search', 'srch', '찾기'], ['note', 'mark', '북마크'], ['set', 'trash', '휴지통'], ['wallet', 'pin', '고정한 말'], ['diary', 'user', '프로필'], ['cal', 'cal', '일과'], ['sns', 'bell', '먼저 연락'], ['mail', 'plug', '연결'], ['shop', 'mask', '나'], ['call', 'call', '통화'], ['photo', 'cam', '셀카'], ['voice', 'music', '음악'], ['invest', 'dice', '게임'], ['map', 'branch', '분기'], ['files', 'book', '로어북'], ['weather', 'tr', '번역']];
    document.querySelector('.na_ph_frame .ob_msgs').parentElement.insertAdjacentHTML('beforeend', `<div class="ob_shade"></div><div class="ob_sheet mkT2"><i class="ob_grab"></i><div class="who">${face}<span><b>Mara</b><div class="s">Werkstatt · Feierabend</div></span></div><div class="grid">${T.map(([g, k, l]) => `<span class="mgt">${gel(g, k)}<span>${l}</span></span>`).join('')}</div></div>`); });
  await shot('O2');
  // ---- O3 머리줄이 펼쳐짐
  await room(`.na_ph_frame .ob_ct.mkX { height: auto; flex-direction: column; align-items: stretch; gap: 0; padding: 0; border-radius: 26px; } .mkX .top { display: flex; align-items: center; gap: 10px; height: 62px; padding: 0 10px; } .mkX .bd { padding: 0 14px 14px; } .na_ph_frame .ob_msgs { opacity: .35; }
    .mkX .bar { display: flex; gap: 3px; height: 10px; margin: 2px 0 6px; } .mkX .bar i { border-radius: 5px; } .mkX .bl { display: flex; justify-content: space-between; font-size: 10.5px; color: rgba(27,29,36,.5); margin-bottom: 12px; } .mkX .now { position: relative; } .mkX .now::after { content: ''; position: absolute; left: 50%; top: -4px; bottom: -4px; width: 2px; margin-left: -1px; background: #15161a; border-radius: 1px; }
    .mkX .ob_seg { margin-bottom: 10px; } .mkX .ob_sg { padding: 8px 0; font-size: 13.5px; } .mkX .rw { display: flex; align-items: center; gap: 12px; height: 44px; padding: 0 2px; font-size: 15px; color: #1b1d24; } .mkX .rw + .rw { border-top: 1px solid rgba(255,255,255,.55); } .mkX .rw b { flex: 1; font-weight: 500; } .mkX .rw em { font-style: normal; font-size: 13.5px; color: rgba(27,29,36,.55); }
    .mkX .sw { width: 42px; height: 25px; border-radius: 13px; background: #15161a; position: relative; } .mkX .sw::after { content: ''; position: absolute; top: 3px; right: 3px; width: 19px; height: 19px; border-radius: 50%; background: #fff; }`);
  await run(() => { const ct = document.querySelector('.na_ph_frame .ob_ct'); const inner = ct.innerHTML; ct.classList.add('mkX');
    const R = (i, l, e = '') => `<div class="rw">${ic(i, 20)}<b>${l}</b>${e}</div>`;
    ct.innerHTML = `<div class="top">${inner}<span class="mkc" style="width:40px;height:40px;margin-left:auto">${ic('x', 20)}</span></div><div class="bd"><div class="bar"><i style="flex:7;background:rgba(27,29,36,.22)"></i><i style="flex:2;background:#a7c7a2"></i><i style="flex:8;background:#e2b48c"></i><i class="now" style="flex:3;background:#a7c7a2"></i><i style="flex:4;background:#b9b4dd"></i></div><div class="bl"><span>0시 · 잠</span><span>지금 · Feierabend</span><span>24시</span></div>
      <div class="ob_seg"><button class="ob_sg">프로필</button><button class="ob_sg on">이 방</button><button class="ob_sg">답장</button><button class="ob_sg">더</button></div>
      ${R('srch', '찾기')}${R('mark', '북마크 · 메모', '<em>3</em>')}${R('pin', '고정한 말', '<em>1</em>')}${R('trash', '휴지통', '<em>2</em>')}${R('bell', '먼저 연락', '<span class="sw"></span>')}</div>`; });
  await shot('O3');
  // ---- T 입력 + 서랍
  await room(`.mkTr { background: rgba(255,255,255,.94) !important; box-shadow: 0 10px 30px rgba(20,22,30,.16), inset 0 1px 0 #fff !important; position: absolute; z-index: 6; left: 12px; right: 12px; bottom: calc(96px + var(--nbk, 0px)); padding: 16px 6px 14px; border-radius: 28px; } .mkTr .grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px 0; } .mkTr .mg { width: 52px !important; height: 52px !important; }`);
  await run(() => { const inp = document.querySelector('.na_ph_frame .ob_inp'); inp.insertAdjacentHTML('afterbegin', `<span class="mkp on">${ic('x', 18, 2.3)}</span>`);
    const T = [['photo', 'photo', '사진'], ['cam', 'cam', '카메라'], ['sns', 'smile', '이모지'], ['note', 'sticker', '스티커'], ['weather', 'gif', 'GIF'], ['diary', 'kao', '카오모지'], ['mail', 'plug', '모델'], ['shop', 'mask', '나'], ['invest', 'steer', '방향 주기'], ['voice', 'write', '대신 써 줘'], ['call', 'call', '통화'], ['map', 'dice', '게임']];
    document.querySelector('.na_ph_frame .ob_msgs').style.zIndex = 'auto'; inp.parentElement.insertAdjacentHTML('beforeend', `<div class="mkTr ob_glass"><div class="grid">${T.map(([g, k, l]) => `<span class="mgt">${gel(g, k, 52, 24)}<span>${l}</span></span>`).join('')}</div></div>`); });
  await shot('T');
  // ---- H 길게 누르기: 지금 검정 카드 + 글자 단추 줄 둘 더
  await room('');
  { const bx = await p.locator('.na_ph_frame .ob_b.th').nth(3).boundingBox(); await p.mouse.move(bx.x + 30, bx.y + 15); await p.mouse.down(); await p.waitForTimeout(700); await p.mouse.up(); await p.waitForTimeout(400); }
  await style(CSS + `.na_ph_frame .ob_pill .ob_hb { display: grid !important; grid-template-columns: repeat(4, 1fr); } .na_ph_frame .ob_pill .ob_hb + .ob_hb { border-top: 1px solid rgba(255,255,255,.12); } .na_ph_frame .ob_pill .ob_hb button { padding: 11px 4px !important; text-align: center; font-size: 12.5px !important; --axfs: 12.5px; } .na_ph_frame .ob_pill .ob_hb button + button { border-left: 1px solid rgba(255,255,255,.14); }`);
  await run(() => { const hb = document.querySelector('.na_ph_frame .ob_pill .ob_hb'); hb.insertAdjacentHTML('afterend', `<div class="ob_hb">${['복사', '북마크', '고정', '메모'].map(l => `<button type="button">${l}</button>`).join('')}</div><div class="ob_hb">${['AI에게 숨기기', '프롬프트', '생각', '분기'].map(l => `<button type="button">${l}</button>`).join('')}</div>`); });
  await shot('H');
  // ---- L 목록 머리: 찾기 · ⋯ → Orbit 설정
  await p.mouse.click(206, 140); await s.to('home'); await p.waitForTimeout(250); await s.to('orbit'); await p.waitForTimeout(500);
  await style(CSS + `.mkL .rw { display: flex; align-items: center; gap: 12px; min-height: 52px; padding: 0 4px; font-size: 15px; color: #1b1d24; } .mkL .rw + .rw { border-top: 1px solid #eef0f3; } .mkL .rw b { flex: 1; font-weight: 500; } .mkL .rw em { font-style: normal; font-size: 13.5px; color: #8a8f99; } .mkL h4 { margin: 0 4px 10px; font-size: 17px; } .mkL .ob_seg { box-shadow: none; background: #f1f2f4; } .mkL .ob_sg { padding: 7px 0; font-size: 13px; }`);
  await run(() => { const tr = document.querySelector('.na_ph_frame .ob_tr'); const cb = tr.querySelector('.ob_cb'); const mk = k => { const b = cb.cloneNode(false); b.classList.remove('ob_bk', 'na_ob_back', 'off'); b.removeAttribute('disabled'); b.innerHTML = ic(k, k === 'more' ? 24 : 20, k === 'more' ? 2.6 : 2.1); return b; };
    tr.prepend(mk('srch')); tr.append(mk('more'));
    document.querySelector('.na_ph_frame .ob_scroll').insertAdjacentHTML('afterend', `<div class="ob_shade"></div><div class="ob_sheet mkL"><i class="ob_grab"></i><h4>Orbit</h4><div class="rw">${ic('sun', 20)}<b>화면</b><span class="ob_seg" style="width:170px"><button class="ob_sg on">밝게</button><button class="ob_sg">어둡게</button></span></div><div class="rw">${ic('plug', 20)}<b>기본 연결</b><em>gemini-4-argon</em></div><div class="rw">${ic('mask', 20)}<b>나(페르소나)</b><em>User</em></div><div class="rw">${ic('bell', 20)}<b>먼저 연락 · 하루 최대</b><em>사람당 5번</em></div><div class="rw">${ic('srch', 20)}<b>모든 방에서 찾기</b></div></div>`); });
  await shot('L');
 } finally { await s.close(); reset(); } })().catch(e => { console.error(e); reset(); process.exit(1); });
