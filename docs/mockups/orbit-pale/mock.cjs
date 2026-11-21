// Orbit 방 — 소망이 짚은 셋: 분위기는 연하게(orbit-mari RB) · 아래 바는 캡처대로(orbit-tools B의 유리 알약: 클립 · ^ · 메시지 · 웃는 얼굴 · 검정 보내기) · 머리(이름 · 상태)는 작게.
// "알약만 띡" 말고 마리나라 캡처를 확대해서 본 마감을 넣어요(1080 × 2408 캡처에서 잰 값, 411px 화면 기준):
//   머리 알약 41px · 얼굴 28.5px + 옅은 테 2px · 상태 점 10px + 흰 테 1.5px(얼굴 오른쪽 아래로 살짝 나옴) · 이름 13px 굵게 #2f2f2f · 상태 12px #8a8a8a 한 줄 …
//   알약은 테두리 · 그림자 없이 면 하나, 설정 단추는 거의 안 보이는 36px 동그라미에 14px 아이콘. 아이콘은 18px 안팎, 선 1.5px로 가늘고 작아요(우리 시안은 22~24px · 2px라 투박했어요).
// 아이콘은 Lucide(ISC)에서 가져와요: LUCIDE=<lucide-static/icons 폴더>   node docs/mockups/orbit-pale/mock.cjs
const { open } = require('/home/user/NarrativeArchive/tools/dev/probe.cjs');
const fs = require('fs'), path = require('path'), os = require('os');
const CHAT = path.join(os.homedir(), 'sillytavern/data/default-user/chats/default_Seraphina/na_test.jsonl');
const reset = () => fs.copyFileSync('/home/user/NarrativeArchive/tools/dev/na_test.jsonl', CHAT);
const B = '/scripts/extensions/third-party/NarrativeArchive/src/', OUT = '/home/user/NarrativeArchive/docs/mockups/orbit-pale/';
const LU = process.env.LUCIDE || '/tmp/claude-0/-home-user-NarrativeArchive/357c6c89-df99-5c7b-a84f-806ab745fd2b/scratchpad/lucide/package/icons';
const L = {}; for (const n of ['house', 'message-square', 'search', 'venetian-mask', 'moon', 'menu', 'sliders-horizontal', 'paperclip', 'chevron-up', 'smile', 'arrow-right', 'chevron-left', 'sun']) L[n] = fs.readFileSync(path.join(LU, n + '.svg'), 'utf8').replace(/<!--[\s\S]*?-->/, '').replace(/<svg[\s\S]*?>/, '').replace('</svg>', '').replace(/\s+/g, ' ').trim();
const CSS = `
.na_ph_frame .ob_ct, .na_ph_frame .ob_inp, .na_ph_frame .ob_chips { display: none !important; }
/* 연한 분위기: 거의 흰 바탕에 그 사람 색만 아주 옅게 */
.na_ph_frame .ob_bg { background: #f5f2f3; } .na_ph_frame .ob_bg .ob_blob { opacity: .15; }
.na_ph_frame .ax_orbitroom .ax_sb { color: #1e2026 !important; } .na_ph_frame .ax_orbitroom .ax_sb svg { filter: invert(1) brightness(.14); } .na_ph_frame .ax_orbitroom .ax_sb .cg_num { color: #1e2026 !important; }
.na_ph_frame .ob_b.th, .na_ph_frame .ob_b.th.ob_glass { background: #fff; box-shadow: 0 1px 1.5px rgba(30,24,50,.05), 0 4px 14px rgba(30,24,50,.04); color: #1e2026; -webkit-backdrop-filter: none; backdrop-filter: none; }
.na_ph_frame .ob_b.me { background: #ecebed; color: #1e2026; box-shadow: none; } .na_ph_frame .ob_b .ob_ko { color: #8a8f99; } .na_ph_frame .ob_b.me .ob_tin { color: #9a9ea8; } .na_ph_frame .ob_day, .na_ph_frame .ob_rd { color: #9a9ea8; } .na_ph_frame .ob_re { border-color: #f5f2f3; }
.na_ph_frame .ob_msgs { -webkit-mask-image: linear-gradient(transparent 0, #000 16px, #000 calc(100% - 96px), transparent calc(100% - 70px)) !important; mask-image: linear-gradient(transparent 0, #000 16px, #000 calc(100% - 96px), transparent calc(100% - 70px)) !important; } .na_ph_frame .ob_mi { padding-bottom: calc(92px + var(--nbk, 0px)) !important; }
/* 위 아이콘: 바탕 위에 바로, 가늘고 작게(18px · 선 1.5px) */
.mkT { position: relative; z-index: 3; flex: none; display: flex; align-items: center; height: 40px; margin: 0 6px; color: #23252c; } .mkT i { width: 38px; height: 38px; display: grid; place-items: center; } .mkT .sp { flex: 1; }
/* 머리: 작게. 면 하나(테두리 없음) + 위쪽 빛 한 줄, 얼굴에 옅은 테, 상태 점은 흰 테를 두르고 얼굴 밖으로 살짝 */
.mkH { position: relative; z-index: 3; flex: none; display: flex; align-items: center; gap: 8px; margin: 2px 10px 0 14px; }
.mkH .pill { flex: 1; min-width: 0; display: flex; align-items: center; gap: 10px; height: 42px; padding: 0 16px 0 7px; border-radius: 21px; background: rgba(255,255,255,.72); box-shadow: inset 0 1px 0 rgba(255,255,255,.9), 0 1px 2px rgba(30,24,50,.03); }
.mkH .av { position: relative; flex: none; width: 28px; height: 28px; border-radius: 50%; box-shadow: 0 0 0 1.5px rgba(255,255,255,.95), 0 0 0 2.5px rgba(30,24,50,.05); } .mkH .av .ob_face { width: 28px !important; height: 28px !important; font-size: 11px !important; }
.mkH .dot { position: absolute; right: -3px; bottom: -3px; width: 9px; height: 9px; border-radius: 50%; background: #8fb59b; box-shadow: 0 0 0 1.75px #fbfafb; }
.mkH .tx { min-width: 0; display: flex; flex-direction: column; justify-content: center; gap: 1.5px; } .mkH .nm { display: flex; align-items: baseline; gap: 6px; font-size: 13.5px; font-weight: 700; line-height: 1.1; letter-spacing: -.01em; color: #26282e; } .mkH .lt { display: inline-flex; align-items: center; gap: 3px; font-size: 11px !important; --axfs: 11px; font-weight: 500; letter-spacing: 0; color: #9a9ea8; } .mkH .lt svg { position: relative; top: 1px; }
.mkH .sb { font-size: 11.5px; line-height: 1.15; color: #8a8f99 !important; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.mkH .set { flex: none; width: 38px; height: 38px; border-radius: 50%; display: grid; place-items: center; color: #3a3d45; background: rgba(255,255,255,.38); }
/* 아래 바: 캡처대로(유리 알약 · 클립 · ^ · 메시지 · 웃는 얼굴 · 검정 보내기) */
.mkC { position: absolute; z-index: 5; left: 12px; right: 12px; bottom: calc(10px + var(--nbk, 0px)); height: 56px; padding: 0 6px 0 8px; display: flex; align-items: center; border-radius: 999px; background: rgba(255,255,255,.74); box-shadow: inset 0 1px 0 rgba(255,255,255,.95), inset 0 0 0 1px rgba(255,255,255,.5), 0 8px 24px rgba(40,40,80,.08), 0 1px 2px rgba(40,40,80,.04); color: #1b1d24; }
.mkC i { width: 38px; height: 42px; display: grid; place-items: center; } .mkC .in { flex: 1; padding: 0 6px; font-size: 15px; color: rgba(27,29,36,.45); } .mkC .ob_send { margin-left: 4px; }
`;
(async () => { reset(); const s = await open('light', { out: os.tmpdir(), width: 412, height: 915, mobile: true, init: true }); const p = s.p;
 try {
  await p.evaluate(() => document.documentElement.style.setProperty('--na-nb', '48px'));
  await s.run(async ({ m }) => { const n = SillyTavern.getContext().chat.length - 1; m.text = String(m.text).replace(/\n# STATE/, `\n## #26–#${n} — Am Fluss (Oct 25, night, Varo)\n- Sie redeten.\n\n# STATE`); m.boundary = n; });
  await s.to('set'); await p.click('.na_ph_pmode[data-v=live]'); await p.waitForTimeout(600); await p.click('.na_ob_start'); await p.waitForTimeout(2000);
  await s.to('orbitnew'); await p.waitForTimeout(400); await p.locator('.na_ph_frame .na_ob_pick', { hasText: 'Mara' }).first().click(); await p.waitForTimeout(300); await p.click('.na_ph_frame .na_ob_make'); await p.waitForTimeout(500);
  const rid = await p.evaluate(async B => { const core = await import(B + 'core.js'), st = await import(B + 'phone2store.js'); const m = core.getMeta(), r = st.liveRooms(m)[0], me = st.liveWorld(m).persona; const T = [[me, '내일 열 시에 정비소 올 수 있어?', ''], ['Mara', 'Ja klar, Samstag passt!', '응 좋아, 토요일 괜찮아!'], ['Mara', 'Bring Kuchen mit 😄', '케이크 가져와 😄'], [me, '무슨 케이크', ''], ['Mara', 'Den mit Kirschen', '체리 든 거'], ['Mara', 'Vom Bäcker an der Ecke. Der hat freitags immer die besten', '모퉁이 빵집 거. 거기 금요일엔 늘 제일 맛있어'], [me, '알겠어 내일 봐', ''], ['Mara', 'Bis morgen', '내일 봐']]; const t0 = Date.now() - T.length * 60000; r.messages = T.map(([from, text, ko], i) => ({ id: `mk${i}`, from, text, ko, at: t0 + i * 60000, told: true, ...(i === 7 ? { state: 'Werkstatt · Feierabend' } : {}) })); r.messages[2].reacts = [{ by: me, e: '❤️', at: Date.now() - 9000 }]; for (const n of r.members) (r.read ||= {})[st.liveKey(n)] = Date.now(); await core.saveMeta(); return r.id; }, B);
  await s.to('orbit'); await s.to('orbitroom', rid); await p.waitForTimeout(900);
  await p.evaluate(css => { const t = document.createElement('style'); t.id = 'mk_q'; t.textContent = css; document.head.append(t); }, CSS);
  await p.evaluate(L => { const ic = (n, s = 18, w = 2) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round">${L[n]}</svg>`;
    const ct = document.querySelector('.na_ph_frame .ob_ct'), face = ct.querySelector('.ob_face').outerHTML;
    ct.insertAdjacentHTML('beforebegin', `<div class="mkT"><i>${ic('house', 19)}</i><i>${ic('message-square', 19)}</i><span class="sp"></span><i>${ic('search', 19)}</i><i>${ic('venetian-mask', 19)}</i><i>${ic('moon', 19)}</i><i>${ic('menu', 19)}</i></div>
      <div class="mkH"><div class="pill"><span class="av">${face}<i class="dot"></i></span><span class="tx"><span class="nm">Mara<span class="lt">${ic('sun', 11, 2.2)}13:24</span></span><div class="sb">Werkstatt · Feierabend</div></span></div><span class="set">${ic('sliders-horizontal', 17)}</span></div>`);
    document.querySelector('.na_ph_frame .ob_msgs').parentElement.insertAdjacentHTML('beforeend', `<div class="mkC"><i>${ic('paperclip', 21)}</i><i>${ic('chevron-up', 22, 2.2)}</i><span class="in">메시지</span><i>${ic('smile', 22)}</i><button type="button" class="ob_send">${ic('arrow-right', 19, 2.4).replace('stroke="currentColor"', 'stroke="#fff"')}</button></div>`);
    const e = document.querySelector('.na_ph_frame .ob_msgs'); e.scrollTop = e.scrollHeight; }, L);
  await p.waitForTimeout(400); await p.screenshot({ path: OUT + 'R.png' });
  // 확대(머리 · 아래 바): 마감을 눈으로 견줘 보려고
  const clip = async (sel, name, pad = 10) => { const b = await p.locator(sel).first().boundingBox(); await p.screenshot({ path: OUT + name, clip: { x: 0, y: Math.max(0, b.y - pad), width: 412, height: b.height + pad * 2 } }); };
  await clip('.na_ph_frame .mkH', 'R_head.png', 46); await clip('.na_ph_frame .mkC', 'R_bar.png', 12);
  console.log('ok');
 } finally { await s.close(); reset(); } })().catch(e => { console.error(e); reset(); process.exit(1); });
