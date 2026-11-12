// 폰 2 화면을 거친 SillyTavern 테마 아래에서 다 찍어요(버튼 · 입력칸 · span 글자를 !important로 칠하는 테마).
// node tools/dev/phone2theme.cjs <사진 폴더> [theme|plain]  → 폴더/p2t_*.png, 그리고 화면이 위로 밀렸는지 숫자
const { open } = require('./probe.cjs');
const fs = require('fs'), path = require('path'), os = require('os');
const CHAT = path.join(os.homedir(), 'sillytavern/data/default-user/chats/default_Seraphina/na_test.jsonl'), reset = () => fs.copyFileSync(path.join(__dirname, 'na_test.jsonl'), CHAT);
const B = '/scripts/extensions/third-party/NarrativeArchive/src/';
const THEME = `
[role=button] { border-radius: 4px !important; }
button, label, input, select, textarea, .menu_button { border-radius: 4px !important; border: 2px solid #c33 !important; background: #2b2b33 !important; color: #ff0 !important; font-family: 'Comic Sans MS', 'Noto Sans KR', cursive !important; box-shadow: 0 0 0 2px #0a0 !important; padding: 3px 6px; }
body span, body #chat span, html body div span { font-size: 19px !important; line-height: 2 !important; letter-spacing: 1px !important; }
*:focus, *:focus-visible { outline: 3px solid #f0f !important; }
body, div { font-family: 'Comic Sans MS', cursive; line-height: 1.8; }
small { opacity: .5 !important; font-size: 9px !important; }
`;
(async () => { const o = process.argv[2] || 'shots', mode = process.argv[3] || 'theme'; fs.mkdirSync(o, { recursive: true });
  const s = await open('light', { out: o }); const p = s.p;
  try {
    if (mode === 'theme') await p.addStyleTag({ content: THEME });
    const shot = async n => { await p.waitForTimeout(350); await (await p.$('.na_ph_frame')).screenshot({ path: path.join(o, `p2t_${n}.png`) }); };
    const scrolled = () => p.evaluate(async () => { const f = document.querySelector('.na_ph_frame'), r = f.getBoundingClientRect(); let e = f, sc = []; while (e) { if (e.scrollTop) sc.push(`${e.className || e.tagName}:${e.scrollTop}`); e = e.parentElement; } for (const x of f.querySelectorAll('.na_ph_scr, .cg_canvas, .ax_canvas')) if (x.scrollTop) sc.push(`in ${x.className.split(' ')[0]}:${x.scrollTop}`);
      // (and a push from outside, as a keyboard would: it must come back)
      f.scrollTop = 60; const c = f.querySelector('.ax_canvas, .cg_canvas'); if (c) c.scrollTop = 60; await new Promise(r => setTimeout(r, 50)); return { top: Math.round(r.top), win: window.scrollY, sc, pushedBack: f.scrollTop === 0 && (!c || c.scrollTop === 0) }; });
    // 시작 화면 · 시작
    await s.to('set'); await p.click('.na_ph_pmode[data-v=live]'); await shot('01_start');
    await p.click('.na_ob_start'); await p.waitForTimeout(800);
    // 방 만들기: 1:1(Mara) + 단체(Mara, Ivo는 계정만)
    await s.run(async ({ m, arg }) => { const st = await import(arg + 'phone2store.js'); st.ensureAccount(m, 'Ivo'); const g = st.ensureRoom(m, ['Mara', 'Ivo']); st.nameRoom(m, g.id, 'Varo Werkstatt'); g.messages.push({ id: 'g1', from: 'Ivo', text: 'Schlüssel liegt unter der Matte', ko: '열쇠 매트 밑에 있어', at: Date.now() - 6e5 }); }, B);
    await s.to('orbitnew'); await shot('02_new0');
    await p.locator('.ob_rm.na_ob_pick').first().click(); await p.waitForTimeout(250); await p.locator('.ob_rm.na_ob_pick').nth(1).click(); await shot('03_new2');
    await p.locator('.ob_rm.na_ob_pick').nth(1).click(); await p.waitForTimeout(250); await p.click('.na_ob_make'); await p.waitForTimeout(500);
    // 1:1: 보내기 → 입력 중 → 답
    await p.click('.na_ob_in'); await p.keyboard.type('토요일에 볼래?'); await shot('04_typingbox'); console.log('focus:', JSON.stringify(await scrolled()));
    await p.keyboard.press('Enter'); await p.waitForTimeout(300); await shot('05_waiting'); console.log('after send:', JSON.stringify(await scrolled()));
    await p.waitForTimeout(3200); await shot('06_reply');
    await p.click('.na_ob_in'); await p.keyboard.type('실패해'); await p.keyboard.press('Enter'); await p.waitForTimeout(3500); await shot('07_fail');
    // 목록 · 계정 시트 · 단체방
    await s.to('orbit'); await shot('08_list');
    if (await p.$('.na_ob_acct')) { await p.click('.na_ob_acct'); await shot('09_sheet'); await p.click('.na_ob_shade'); }
    await p.locator('.ob_rm').filter({ hasText: 'Werkstatt' }).first().click(); await p.waitForTimeout(400); await shot('10_group');
    // 홈 위젯 · 설정 · 새로 시작
    await s.to('home'); await shot('11_home');
    await s.to('set'); await shot('12_set');
    await s.scroll(); await shot('13_set_bottom');
    await p.click('.na_ph_livereset'); await shot('14_reset'); await p.keyboard.press('Escape'); await p.click('.pcf_no').catch(() => {});
    console.log('end:', JSON.stringify(await scrolled()), s.errors().slice(0, 4));
  } finally { await s.close(); reset(); }
})().catch(e => { console.error(e); reset(); process.exit(1); });
