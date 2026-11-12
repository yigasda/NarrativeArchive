// Orbit 계정 바꾸기(인스타식) 시안 A~D: 실제 폰의 Orbit 화면 위에 바꾸기 자리만 끼워 찍어요(코드는 안 바꿔요).
// 유나 계정 = 유나가 쓰는 1:1 · 단체방, Mara 계정 = 이 폰 주인 Mara가 주고받는 방(읽기만).
// Mara 계정 화면은 시험 데이터의 페르소나를 잠깐 Mara로 바꿔 그려요. node mock.cjs → sheet.jpg
const { open } = require('../../../tools/dev/probe.cjs');
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path'), os = require('os');
const CHAT = path.join(os.homedir(), 'sillytavern/data/default-user/chats/default_Seraphina/na_test.jsonl');
const reset = () => fs.copyFileSync(path.join(__dirname, '../../../tools/dev/na_test.jsonl'), CHAT);
const B = '/scripts/extensions/third-party/NarrativeArchive/src/';
const TMP = fs.mkdtempSync('/tmp/claude-0/ph2acct');

const CSS = `
.mk_face{position:relative;overflow:hidden;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;color:#fff;font-weight:700;flex:none;box-shadow:inset 0 1px 0 rgba(255,255,255,.35),0 2px 6px rgba(22,27,34,.14)}
.mk_face i{position:absolute;inset:-30%;filter:blur(7px)}.mk_face b{position:relative}
.mk_y i{background:radial-gradient(40% 50% at 30% 35%,#f2a2b4 0,transparent 70%),radial-gradient(45% 50% at 72% 70%,#f7c6a6 0,transparent 70%),#f1b0b4}
.mk_m i{background:radial-gradient(45% 50% at 30% 70%,#59b874 0,transparent 70%),radial-gradient(40% 45% at 70% 25%,#f0bf7f 0,transparent 70%),#8dcb8a}
/* A: 바텀 시트 */
.mk_shade{position:absolute;inset:0;background:rgba(20,22,30,.28);z-index:40}
.mk_sheet{position:absolute;left:8px;right:8px;bottom:8px;z-index:41;background:#fff;border-radius:32px;padding:10px 16px 26px;box-shadow:0 -10px 30px rgba(20,22,30,.18)}
.mk_grab{width:40px;height:5px;border-radius:3px;background:#d4d7dd;margin:0 auto 14px}
.mk_row{display:flex;align-items:center;gap:12px;padding:10px 4px}
.mk_row+.mk_row{border-top:1px solid #eef0f3}
.mk_row .t{flex:1}.mk_row b{display:block;font-size:16px;font-weight:600;color:#15171c}.mk_row span{font-size:12.5px;color:#8a8f99}
.mk_ck{width:24px;height:24px;border-radius:50%;background:#15161a;display:flex;align-items:center;justify-content:center}
.mk_ck0{width:24px;height:24px;border-radius:50%;border:2px solid #d4d7dd;box-sizing:border-box}
/* B: 제목 = 계정 이름 ▾ */
.mk_title{display:flex;align-items:center;gap:7px;font-size:20px;font-weight:600;color:#15171c}
.mk_menu{position:absolute;left:50%;top:116px;transform:translateX(-50%);z-index:41;width:250px;background:rgba(255,255,255,.92);backdrop-filter:blur(20px);border-radius:22px;padding:6px;box-shadow:0 1px 2px rgba(22,27,34,.06),0 16px 40px rgba(22,27,34,.2)}
.mk_menu .mk_row{padding:9px 10px;border-radius:16px}.mk_menu .mk_row.on{background:#f1f2f5}.mk_menu .mk_row+.mk_row{border-top:0}
/* C: 아래 알약 + 내 얼굴 */
.mk_dock{position:absolute;left:50%;bottom:34px;transform:translateX(-50%);z-index:5;display:flex;gap:8px;align-items:center;background:#fff;border-radius:999px;padding:6px;box-shadow:0 1px 2px rgba(22,27,34,.05),0 12px 30px rgba(22,27,34,.16)}
.mk_dock .new{display:flex;gap:6px;align-items:center;background:#15161a;color:#fff;border-radius:999px;padding:11px 18px;font-size:14px;font-weight:600;box-shadow:inset 0 1px 0 rgba(255,255,255,.16)}
.mk_pop{position:absolute;right:56px;bottom:100px;z-index:41;display:flex;flex-direction:column;gap:10px;align-items:center;background:#fff;border-radius:999px;padding:10px 8px;box-shadow:0 16px 40px rgba(22,27,34,.22)}
.mk_pop .on{box-shadow:0 0 0 3px #fff,0 0 0 5px #15161a}
/* D: 왼쪽 위 겹친 두 얼굴 */
.mk_pair{position:relative;display:inline-block;width:52px;height:46px}
.mk_pair .f1{position:absolute;left:0;top:0;z-index:2;box-shadow:0 0 0 3px #f2f2f4,0 4px 12px rgba(22,27,34,.16)}
.mk_pair .f2{position:absolute;right:0;bottom:0;z-index:1;opacity:.95}
.mk_swap{position:absolute;left:44px;top:96px;z-index:41;font-size:12px;font-weight:600;color:#fff;background:#15161a;border-radius:999px;padding:6px 11px;box-shadow:0 8px 20px rgba(22,27,34,.2)}
.mk_hide{display:none!important}
`;
const face = (who, s) => `<span class="mk_face ${who === 'Yuna' ? 'mk_y' : 'mk_m'}" style="width:${s}px;height:${s}px;font-size:${Math.round(s * .4)}px"><i></i><b>${who === 'Yuna' ? '유' : 'M'}</b></span>`;
const chk = '<span class="mk_ck"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12.5l4.5 4.5L20 6"/></svg></span>';
const chev = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#15171c" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>';
const plus = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>';
const rows = cur => ['Yuna', 'Mara'].map(n => `<div class="mk_row${cur === n ? ' on' : ''}">${face(n, 40)}<span class="t"><b>${n === 'Yuna' ? '유나' : 'Mara'}</b><span>${n === 'Yuna' ? 'yuna' : 'mara.varo'}</span></span>${cur === n ? chk : '<span class="mk_ck0"></span>'}</div>`).join('');

// 화면마다 끼울 것: (who: 지금 계정, step: 'list' | 'open' | 'room')
const PATCH = {
  A: (who, step) => ({ left: face(who, 46), title: null, sheet: step === 'open' ? `<div class="mk_shade"></div><div class="mk_sheet"><div class="mk_grab"></div>${rows(who)}</div>` : '' }),
  B: (who, step) => ({ left: null, title: `${face(who, 26)}${who === 'Yuna' ? '유나' : 'Mara'}${chev}`, sheet: step === 'open' ? `<div class="mk_shade" style="background:rgba(20,22,30,.12)"></div><div class="mk_menu">${rows(who)}</div>` : '' }),
  C: (who, step) => ({ left: null, title: null, dock: `<div class="mk_dock"><span class="new">${plus}새 대화</span>${face(who, 42)}</div>`, sheet: step === 'open' ? `<div class="mk_shade" style="background:rgba(20,22,30,.12)"></div><div class="mk_pop">${['Yuna', 'Mara'].map(n => `<span class="${n === who ? 'on' : ''}" style="border-radius:50%;display:inline-flex">${face(n, 44)}</span>`).join('')}</div>` : '' }),
  D: (who, step) => { const o = who === 'Yuna' ? 'Mara' : 'Yuna'; return { left: `<span class="mk_pair"><span class="f1">${face(who, 40)}</span><span class="f2">${face(o, 26)}</span></span>`, title: null, sheet: step === 'open' ? `<div class="mk_swap">Mara</div>` : '' }; },
};
const NAME = { A: 'A. 왼쪽 위 내 얼굴 → 아래 시트', B: 'B. 제목이 계정 이름 ▾ → 위 메뉴', C: 'C. 아래 알약 옆 내 얼굴 → 얼굴 둘', D: 'D. 왼쪽 위 겹친 두 얼굴 → 누르면 앞뒤 바뀜' };

(async () => {
  const s = await open('light', { out: TMP });
  try {
    await s.run(async ({ m, arg }) => {
      const st = await import(arg + 'phone2store.js'); const now = Date.now(), Mn = 6e4, H = 36e5;
      st.startFresh(m, { persona: 'Yuna' }); st.putLivePhone(m, structuredClone(m.phones.mara));
      const put = (r, from, text, at, ko) => r.messages.push({ id: 't' + Math.random().toString(36).slice(2, 8), from, text, at, ...(ko ? { ko } : {}) });
      const a = st.ensureRoom(m, ['Mara']), g = st.ensureRoom(m, ['Mara', 'Ivo']), r = st.ensureRoom(m, ['Ren']); st.nameRoom(m, g.id, 'Varo Werkstatt');
      put(a, 'Mara', 'Hast du heute Abend Zeit?', now - 18 * Mn, '오늘 저녁에 시간 있어?'); st.sendLive(m, a.id, '응 9시 이후엔 괜찮아', now - 17 * Mn); put(a, 'Mara', "Ich erzähl's dir gleich", now - 8 * Mn, '바로 말해 줄게');
      put(g, 'Ivo', 'Schlüssel liegt unter der Matte', now - 30 * Mn, '열쇠 매트 밑에 있어'); st.sendLive(m, r.id, '잘 자 내일 봐', now - 26 * H);
      // Mara만의 방(유나 없음): 지금 저장 규칙엔 없는 방이라 손으로 넣어요(시안용)
      const w = m.live.world, mk = (id, members) => (w.messenger.rooms[id] = { id, members, messages: [] });
      const mi = mk('rMI', ['Mara', 'Ivo']), ml = mk('rML', ['Mara', 'Lena']);
      put(mi, 'Ivo', 'Hast du meinen Schlüssel noch?', now - 3 * H, '내 열쇠 아직 갖고 있어?'); put(mi, 'Mara', 'Ja, sorry. Samstag bringe ich ihn vorbei', now - 3 * H + 4 * Mn, '응 미안. 토요일에 갖다줄게'); put(mi, 'Ivo', 'Du sagst das seit zwei Wochen 🙄', now - 2 * H, '너 2주째 그 말 하잖아');
      put(ml, 'Lena', 'Kino morgen?', now - 5 * H, '내일 영화?'); put(ml, 'Mara', 'Klar! 20 Uhr?', now - 5 * H + 2 * Mn, '좋아! 8시?');
      w._hold = {};
    }, B);
    await s.to('set'); await s.p.click('.na_ph_pmode[data-v=live]'); await s.p.waitForTimeout(500);
    // 계정: 유나면 Mara만의 방을 빼 두고, Mara면 페르소나를 Mara로 · 유나만의 방(Ren)을 빼 둬요
    const as = who => s.run(async ({ m, arg }) => {
      const w = m.live.world, R = w.messenger.rooms, H = w._hold;
      for (const [k, v] of Object.entries(H)) R[k] = v; for (const k of Object.keys(H)) delete H[k];
      w.persona = arg;
      for (const [k, r] of Object.entries(R)) if (!r.members.some(n => n.toLowerCase() === arg.toLowerCase())) { H[k] = r; delete R[k]; }
    }, who);
    const patch = (v, who, step) => s.p.evaluate(([CSS, P]) => {
      if (!document.getElementById('mk_css')) { const st = document.createElement('style'); st.id = 'mk_css'; st.textContent = CSS; document.head.append(st); }
      const scr = document.querySelector('.na_ph_frame .ax_canvas');
      scr.querySelectorAll('.mk_shade,.mk_sheet,.mk_menu,.mk_pop,.mk_swap,.mk_dock').forEach(e => e.remove());
      const top = scr.querySelector('.ob_top');
      if (top) {
        if (P.left) top.firstElementChild.outerHTML = `<span class="ob_cb0" style="width:auto">${P.left}</span>`;
        if (P.title) top.querySelector('.ob_h1').innerHTML = `<span class="mk_title">${P.title}</span>`;
      }
      // Mara 계정(읽기만): 새 대화 · 안 읽음 숫자 · 새 대화 연필 없음
      if (P.ro2) { scr.querySelector('.ob_dock')?.classList.add('mk_hide'); scr.querySelectorAll('.ob_un').forEach(e => e.classList.add('mk_hide')); const pen = scr.querySelector('.ob_top [data-go=orbitnew]'); if (pen) pen.style.visibility = 'hidden'; }
      if (P.dock && P.step !== 'room') { scr.querySelector('.ob_dock')?.classList.add('mk_hide'); scr.insertAdjacentHTML('beforeend', P.ro2 ? P.dock.replace(/<span class="new">.*?<\/span>/, '') : P.dock); }
      // 읽기만: 방 안 입력칸 없음
      if (P.ro) { scr.querySelector('.ob_inp')?.classList.add('mk_hide'); scr.querySelector('.ob_chips')?.classList.add('mk_hide'); }
      if (P.sheet) scr.insertAdjacentHTML('beforeend', P.sheet);
    }, [CSS, P_(v, who, step)]);
    const P_ = (v, who, step) => ({ ...PATCH[v](who, step), step, ro: step === 'room' && who !== 'Yuna', ro2: who !== 'Yuna' });
    const shots = {};
    for (const v of Object.keys(PATCH)) {
      shots[v] = [];
      await as('Yuna'); await s.to('orbit'); await patch(v, 'Yuna', 'list'); shots[v].push(await s.shot(`${v}_1`));
      await patch(v, 'Yuna', 'open'); shots[v].push(await s.shot(`${v}_2`));
      await as('Mara'); await s.to('orbit'); await patch(v, 'Mara', 'list'); shots[v].push(await s.shot(`${v}_3`));
      await s.to('orbitroom', 'rMI'); await patch(v, 'Mara', 'room'); await s.p.evaluate(() => { const e = document.querySelector('.ob_msgs'); if (e) e.scrollTop = 1e6; }); shots[v].push(await s.shot(`${v}_4`));
    }
    await as('Yuna');
    const cap = ['유나 계정 목록', '바꾸기 열기', 'Mara 계정 목록', 'Mara 방(Mara ↔ Ivo) · 읽기만'];
    const b = await chromium.launch(), p = await b.newPage({ deviceScaleFactor: 1 });
    await p.setContent(`<html><body style="margin:0;padding:24px;background:#d9dbe0;font-family:-apple-system,'Noto Sans KR',sans-serif;width:max-content">${Object.keys(PATCH).map(v => `<h2 style="font-size:22px;margin:6px 0 12px">${NAME[v]}</h2><div style="display:flex;gap:20px;margin-bottom:26px">${shots[v].map((f, i) => `<div><img style="width:330px;display:block;border-radius:22px" src="data:image/png;base64,${fs.readFileSync(f).toString('base64')}"><div style="text-align:center;font-size:13px;color:#5b606c;margin-top:6px">${cap[i]}</div></div>`).join('')}</div>`).join('')}</body></html>`);
    await p.screenshot({ path: path.join(__dirname, 'sheet.jpg'), fullPage: true, type: 'jpeg', quality: 86 }); await b.close();
    console.log('ok', s.errors().slice(0, 3));
  } finally { await s.close(); reset(); }
})().catch(e => { console.error(e); reset(); process.exit(1); });
