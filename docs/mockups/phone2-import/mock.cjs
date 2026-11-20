// 채팅을 메신저(Orbit)로 가져오기: 들어가는 길(폰 없음 E1 · E2, 타임라인 폰 있음, 실시간 폰 있음), 가져오기 화면(S1 전체 화면 · S2 아래 시트), 파일 알림 · 고른 뒤.
// 실제 폰 화면에 끼워 찍어요. node docs/mockups/phone2-import/mock.cjs → sheet.jpg
const { open } = require('../../../tools/dev/probe.cjs');
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path'), os = require('os');
const CHAT = path.join(os.homedir(), 'sillytavern/data/default-user/chats/default_Seraphina/na_test.jsonl');
const reset = () => fs.copyFileSync(path.join(__dirname, '../../../tools/dev/na_test.jsonl'), CHAT);
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'impmock'));
const B = '/scripts/extensions/third-party/NarrativeArchive/src/';
const svg = (d, c, w = 18) => `<svg width="${w}" height="${w}" viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="${d}"/></svg>`;
const CHATIC = 'M5 5h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-7l-5 4v-4H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z', FILEIC = 'M7 3h7l5 5v13H7zM14 3v5h5M12 12v6M9.5 15.5 12 18l2.500-2.500';
const CSS = `
.mk_ic.c{background:#e4f0e6}.mk_ic.f{background:#efe9dc}
.mk_link{display:block;margin-top:14px;font-size:13px;color:rgba(255,255,255,.86);text-align:center;text-decoration:underline;text-underline-offset:3px}
.mk_btn2{display:block;margin-top:10px;padding:13px 0;border-radius:14px;background:rgba(255,255,255,.22);color:#fff;font-weight:600;font-size:14.5px;text-align:center;border:1px solid rgba(255,255,255,.35)}
.mk_shade{position:absolute;inset:0;background:rgba(20,22,30,.32);z-index:40}
.mk_sheet{position:absolute;left:8px;right:8px;bottom:8px;z-index:41;background:#fff;border-radius:32px;padding:10px 16px 26px;box-shadow:0 -10px 30px rgba(20,22,30,.18);color:#161b22;text-align:left}
.mk_grab{display:block;width:40px;height:5px;border-radius:3px;background:#d4d7dd;margin:0 auto 12px}
.mk_sh{font-size:17px;font-weight:600;padding:0 4px 8px}
.mk_row{display:flex;align-items:center;gap:12px;padding:12px 4px}.mk_row+.mk_row{border-top:1px solid #eef0f3}
.mk_row .mk_ic{width:38px;height:38px;border-radius:12px;display:flex;align-items:center;justify-content:center;flex:none}
.mk_row b{display:block;font-size:15px;font-weight:600}.mk_row span span{display:block;font-size:12.5px;color:#8a8f99;margin-top:2px}
.mk_toprow{margin:0 16px 14px}
`;
(async () => {
  const s = await open('light', { out: TMP }); const p = s.p;
  try {
    await p.evaluate(css => { const st = document.createElement('style'); st.textContent = css; document.head.append(st); }, CSS);
    const shots = {}, shot = async n => { await p.waitForTimeout(300); shots[n] = await s.shot('imp_' + n); };
    const optRow = (cls, icon, title, sub, on) => `<div class="ob_rm ls_opt${on ? ' on' : ''}"><span class="ls_ic mk_ic ${cls}">${icon}</span><span class="ob_t"><b>${title}</b><span class="ob_p">${sub}</span></span><span class="ob_ck${on ? ' on' : ''}">${on ? svg('M4 12.5l4.5 4.5L20 6', '#fff', 14) : ''}</span></div>`;
    const R = { chat: on => optRow('c', svg(CHATIC, '#3d7a4a'), '이 채팅에서 가져오기', '메시지 12개 · 말풍선 34개', on), file: (on, sub = '.jsonl') => optRow('f', svg(FILEIC, '#8a6a2a'), '파일에서 가져오기', sub, on) };
    // S1: 실시간 시작 화면에 줄 둘 (타임라인 폰이 있을 때 들어가는 길이자 가져오기 화면)
    await s.to('set'); await p.click('.na_ph_pmode[data-v=live]'); await p.waitForTimeout(600);
    await p.evaluate(({ c, f }) => { const l = document.querySelector('.na_ph_frame .ob_list'); l.querySelector('.ls_opt.off').remove(); const st = l.querySelector('.ls_opt'); st.classList.remove('on'); st.querySelector('.ob_ck').className = 'ob_ck'; st.querySelector('.ob_ck').innerHTML = ''; l.insertAdjacentHTML('beforeend', c + f); document.querySelector('.na_ph_frame .na_ob_start').textContent = '가져오기'; }, { c: R.chat(true), f: R.file(false) });
    await shot('S1');
    // F: 파일을 고른 뒤 (같은 화면)
    await p.evaluate(() => { const rows = document.querySelectorAll('.na_ph_frame .ls_opt'); const c = rows[1], f = rows[2]; c.classList.remove('on'); c.querySelector('.ob_ck').className = 'ob_ck'; c.querySelector('.ob_ck').innerHTML = ''; f.classList.add('on'); f.querySelector('.ob_p').textContent = 'Mara · 메시지 48개 · 말풍선 131개'; f.querySelector('.ob_ck').className = 'ob_ck on'; f.querySelector('.ob_ck').innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12.5l4.5 4.5L20 6"/></svg>'; });
    await shot('F');
    // N: 파일 고르기 전 알림 (소망이 정한 글)
    await p.evaluate(() => { const f = document.querySelector('.na_ph_frame .na_ph_scr'); f.insertAdjacentHTML('beforeend', `<div class="pcf" role="dialog"><div class="pcf_box"><div class="pcf_card"><div class="pcf_msg"><b>파일에서 가져오기</b><span>메신저 프롬프트로만 진행한 채팅방 파일을 가져와 주세요.</span></div><div class="pcf_btns"><div class="pcf_no">취소</div><div class="pcf_ok safe">파일 고르기</div></div></div></div></div>`); const rows = document.querySelectorAll('.na_ph_frame .ls_opt'); rows[2].querySelector('.ob_p').textContent = '.jsonl'; });
    await shot('N'); await p.evaluate(() => document.querySelector('.na_ph_frame .pcf')?.remove());
    // L: 실시간 폰이 있을 때 = 새 대화 화면 맨 위 한 줄
    await s.run(async ({ m }) => { const n = SillyTavern.getContext().chat.length - 1; const t = String(m.text), cut = t.search(/\n# STATE/), add = `\n## #26–#${n} — Am Fluss (Oct 25, night, Varo)\n- Sie redeten.\n`; m.text = cut >= 0 ? t.slice(0, cut).replace(/\s*$/, '') + '\n' + add + t.slice(cut) : t + add; m.boundary = n; });
    await s.to('set'); await p.click('.na_ph_pmode[data-v=live]'); await p.waitForTimeout(600); await p.click('.na_ob_start'); await p.waitForTimeout(2000);
    await s.to('orbitnew'); await p.waitForTimeout(400);
    await p.evaluate(row => { const sec = document.querySelector('.na_ph_frame .ob_sec'); sec.insertAdjacentHTML('beforebegin', `<div class="ob_list mk_toprow">${row}</div>`); }, optRow('c', svg(CHATIC, '#3d7a4a'), '채팅 가져오기', '새 메시지 4개', false).replace('<span class="ob_ck"></span>', svg('M9 6l6 6-6 6', '#bfc2c7', 16)));
    await shot('L');
    // E1 · E2 · S2: 폰도 인물도 없는 채팅 (누구의 폰을 볼까요?)
    await p.evaluate(async B => { const core = await import(B + 'core.js'); const m = core.getMeta(); delete m.phones; delete m.live; m.text = ''; delete m.phonePre; delete m.phoneOwner; document.getElementById('na_phl')?.close(); }, B);
    await p.waitForTimeout(300); await p.evaluate(async B => { (await import(B + 'phone.js')).openPhone(); }, B); await p.waitForTimeout(1200);
    const card = await p.$('.na_ph_frame .na_ph_ownercard'); if (!card) throw new Error('no owner card: ' + await p.evaluate(() => document.querySelector('.na_ph_frame')?.innerText.slice(0, 200)));
    await p.evaluate(() => document.querySelector('.na_ph_frame .na_ph_ownercard').insertAdjacentHTML('afterend', '<span class="mk_link mk_e">메신저 채팅 가져오기</span>'));
    await shot('E1'); await p.evaluate(() => document.querySelector('.mk_e').remove());
    await p.evaluate(() => document.querySelector('.na_ph_frame .na_ph_owneradd').insertAdjacentHTML('beforeend', '<span class="mk_btn2 mk_e">메신저 채팅 가져오기</span>'));
    await shot('E2'); await p.evaluate(() => document.querySelector('.mk_e').remove());
    await p.evaluate(({ c, f }) => { const sc = document.querySelector('.na_ph_frame .na_ph_scr'); sc.insertAdjacentHTML('beforeend', `<div class="mk_shade"></div><div class="mk_sheet"><i class="mk_grab"></i><div class="mk_sh">메신저 채팅 가져오기</div><div class="mk_row"><span class="mk_ic c">${c}</span><span><b>이 채팅에서</b><span>메시지 12개 · 말풍선 34개</span></span></div><div class="mk_row"><span class="mk_ic f">${f}</span><span><b>파일에서</b><span>.jsonl</span></span></div></div>`); }, { c: svg(CHATIC, '#3d7a4a'), f: svg(FILEIC, '#8a6a2a') });
    await shot('S2');
    const names = { E1: '들어가는 길 E1. 카드 밑 글자', E2: '들어가는 길 E2. 카드 안 버튼', S1: '가져오기 S1. 실시간 화면의 줄', S2: '가져오기 S2. 아래 시트', N: '파일 고르기 전 알림', F: '파일을 고른 뒤 (S1)', L: '실시간 폰이 있을 때: 새 대화 맨 위' };
    const b = await chromium.launch(), pg = await b.newPage({ deviceScaleFactor: 1 });
    await pg.setContent(`<html><body style="margin:0;padding:24px;background:#d9dbe0;font-family:-apple-system,'Noto Sans KR',sans-serif;width:max-content"><div style="display:flex;gap:16px">${Object.keys(names).map(k => `<div><h2 style="font-size:15px;margin:0 0 10px">${names[k]}</h2><img style="width:280px;display:block;border-radius:22px" src="data:image/png;base64,${fs.readFileSync(shots[k]).toString('base64')}"></div>`).join('')}</div></body></html>`);
    await pg.screenshot({ path: path.join(__dirname, 'sheet.jpg'), fullPage: true, type: 'jpeg', quality: 86 }); await b.close();
    console.log('ok', s.errors().slice(0, 3));
  } finally { await s.close(); reset(); }
})().catch(e => { console.error(e); reset(); process.exit(1); });
