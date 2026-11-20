// 메신저 대화를 롤플에 전하기: 누를 자리 A~C, 글 받는 동안, 미리 보기. 실제 실시간 폰(Orbit)에 끼워 찍어요.
// node docs/mockups/phone2-back/mock.cjs → sheet.jpg
const { open } = require('../../../tools/dev/probe.cjs');
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path'), os = require('os');
const CHAT = path.join(os.homedir(), 'sillytavern/data/default-user/chats/default_Seraphina/na_test.jsonl');
const reset = () => fs.copyFileSync(path.join(__dirname, '../../../tools/dev/na_test.jsonl'), CHAT);
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'backmock'));
// 롤플로 보내는 그림: 말풍선에서 나가는 꺾인 화살표
const ICON = (c, w = 20) => `<svg width="${w}" height="${w}" viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><path d="M4 15V7a3 3 0 0 1 3-3h10a3 3 0 0 1 3 3v4"/><path d="M8 20l-4 0 0-4"/><path d="M4 20l7-7h9"/><path d="M17 10l3 3-3 3"/></svg>`;
const CSS = `
.mk_cnt{position:absolute;top:-3px;right:-3px;min-width:18px;height:18px;padding:0 5px;border-radius:9px;background:#15161a;color:#fff;font-size:11px;font-weight:700;display:inline-flex;align-items:center;justify-content:center;box-sizing:border-box}
.mk_tr{display:flex;gap:10px;align-items:center}.mk_tr .ob_cb{position:relative}
.mk_docks{position:absolute;left:0;right:0;bottom:34px;display:flex;justify-content:center;gap:8px;z-index:5}
.mk_docks .ob_dock{position:static;transform:none}
.mk_dk2{background:rgba(255,255,255,.92)!important;color:#15161a!important;box-shadow:0 1px 2px rgba(22,27,34,.06),0 8px 22px rgba(22,27,34,.12)!important}
.mk_dk2 em{font-style:normal;margin-left:6px;opacity:.55}
.mk_rb{margin-left:auto;width:38px;height:38px;border-radius:50%;display:flex;align-items:center;justify-content:center;background:rgba(255,255,255,.55);position:relative}
.mk_rb .mk_cnt{top:-4px;right:-4px}
.mk_shade{position:absolute;inset:0;background:rgba(20,22,30,.32);z-index:40}
.mk_sheet{position:absolute;left:8px;right:8px;bottom:8px;z-index:41;background:#f4f5f7;border-radius:30px;padding:8px 0 18px;box-shadow:0 -10px 30px rgba(20,22,30,.18)}
.mk_grab{display:block;width:40px;height:5px;border-radius:3px;background:#d4d7dd;margin:0 auto 6px}
.mk_sh{display:flex;align-items:center;justify-content:space-between;padding:8px 20px 10px}.mk_sh b{font-size:17px;font-weight:600;color:#161b22}.mk_sh span{font-size:13px;color:#8a8f99}
.mk_ta{margin:0 14px;background:#fff;border-radius:18px;padding:14px 16px;font-size:14.5px;line-height:1.55;color:#161b22;min-height:180px;box-shadow:0 1px 2px rgba(22,27,34,.04),0 6px 18px rgba(22,27,34,.05);white-space:pre-wrap}
.mk_ta i{color:#8a8f99}
.mk_more{margin:10px 22px 0;font-size:12.5px;color:#8a8f99}
.mk_btns{display:flex;gap:10px;margin:14px 14px 0}.mk_btns span{flex:1;text-align:center;padding:14px 0;border-radius:16px;font-weight:600;font-size:15px}
.mk_no{background:#e6e8ec;color:#161b22}.mk_ok{background:#15161a;color:#fff}
`;
const TEXT = '<i>*(그동안 메신저에서)*</i>\n\nMara schrieb Ren, ob er morgen um zehn zur Werkstatt kommt. Ren sagte zu und versprach, Kuchen mitzubringen; Mara fragte nach dem Schlüssel für Ivo.';
(async () => {
  const s = await open('light', { out: TMP });
  try {
    await s.run(async ({ m }) => { const n = SillyTavern.getContext().chat.length - 1; const t = String(m.text), cut = t.search(/\n# STATE/), add = `\n## #26–#${n} — Am Fluss (Oct 25, night, Varo)\n- Sie redeten.\n`; m.text = cut >= 0 ? t.slice(0, cut).replace(/\s*$/, '') + '\n' + add + t.slice(cut) : t + add; m.boundary = n; });
    await s.to('set'); await s.p.click('.na_ph_pmode[data-v=live]'); await s.p.waitForTimeout(600); await s.p.click('.na_ob_start'); await s.p.waitForTimeout(2000);
    // 대화 하나 (가짜 모델이 답해요)
    await s.to('orbitnew'); await s.p.waitForTimeout(400); await s.p.locator('.na_ph_frame .na_ob_pick', { hasText: 'Mara' }).first().click(); await s.p.waitForTimeout(300); await s.p.click('.na_ph_frame .na_ob_make'); await s.p.waitForTimeout(500);
    await s.p.evaluate(() => { const f = document.querySelector('.na_ph_frame .na_ob_in'); f.textContent = '내일 열 시에 정비소 올 수 있어?'; f.dispatchEvent(new Event('input', { bubbles: true })); });
    await s.p.click('.na_ph_frame .ob_send'); await s.p.waitForTimeout(4500);
    await s.p.evaluate(css => { const st = document.createElement('style'); st.textContent = css; document.head.append(st); }, CSS);
    const shots = {};
    const list = async (name, fn, arg) => { await s.to('orbit'); await s.p.waitForTimeout(500); await s.p.evaluate(fn, arg); await s.p.waitForTimeout(250); shots[name] = await s.shot('back_' + name); };
    // A: 목록 머리, 연필 왼쪽 둥근 버튼 + 검정 숫자
    await list('A', svg => { const cb = document.querySelector('.na_ph_frame .ob_top .ob_cb'); const w = document.createElement('span'); w.className = 'mk_tr'; cb.replaceWith(w); w.innerHTML = `<button type="button" class="ob_cb">${svg}<span class="mk_cnt">3</span></button>`; w.append(cb); }, ICON('#1b1d24'));
    // B: 아래 "새 대화" 옆 흰 알약
    await list('B', ICON => { const d = document.querySelector('.na_ph_frame .ob_dock'); const w = document.createElement('div'); w.className = 'mk_docks'; d.replaceWith(w); w.innerHTML = `<button type="button" class="ob_dock mk_dk2">롤플에 전하기<em>3</em></button>`; w.prepend(d); }, null);
    // C: 방 머리 오른쪽 (이 방이 아니라 안 전한 말 전체)
    await s.to('orbitroom', await s.run(async ({ m }) => Object.keys(m.live.world.messenger.rooms)[0])); await s.p.waitForTimeout(500);
    await s.p.evaluate(svg => { const h = document.querySelector('.na_ph_frame .ob_ct'); h.insertAdjacentHTML('beforeend', `<span class="mk_rb">${svg}<span class="mk_cnt">3</span></span>`); }, ICON('#1b1d24', 19));
    await s.p.waitForTimeout(250); shots.C = await s.shot('back_C');
    // 글 받는 동안 (B 자리 예): 알약 글자가 "정리 중"
    await list('busy', () => { const d = document.querySelector('.na_ph_frame .ob_dock'); const w = document.createElement('div'); w.className = 'mk_docks'; d.replaceWith(w); w.innerHTML = `<button type="button" class="ob_dock mk_dk2" disabled><i class="fa-solid fa-spinner fa-spin" style="margin-right:6px"></i>정리 중</button>`; w.prepend(d); }, null);
    // 미리 보기: 아래 시트, 고칠 수 있는 칸, 남은 말 한 줄, 취소 · 넣기
    await list('P', T => { const c = document.querySelector('.na_ph_frame .cg_canvas, .na_ph_frame .na_ph_scr'); c.insertAdjacentHTML('beforeend', `<div class="mk_shade"></div><div class="mk_sheet"><i class="mk_grab"></i><div class="mk_sh"><b>롤플에 넣기</b><span>말 3개</span></div><div class="mk_ta">${T}</div><div class="mk_more">남은 말 12개는 한 번 더</div><div class="mk_btns"><span class="mk_no">취소</span><span class="mk_ok">넣기</span></div></div>`); }, TEXT);
    const names = { A: 'A. 목록 머리 둥근 버튼', B: 'B. 새 대화 옆 알약', C: 'C. 방 머리 오른쪽', busy: '글 받는 동안 (B 예)', P: '미리 보기 (고칠 수 있음)' };
    const b = await chromium.launch(), p = await b.newPage({ deviceScaleFactor: 1 });
    await p.setContent(`<html><body style="margin:0;padding:24px;background:#d9dbe0;font-family:-apple-system,'Noto Sans KR',sans-serif;width:max-content"><div style="display:flex;gap:18px">${Object.keys(names).map(k => `<div><h2 style="font-size:17px;margin:0 0 10px">${names[k]}</h2><img style="width:300px;display:block;border-radius:22px" src="data:image/png;base64,${fs.readFileSync(shots[k]).toString('base64')}"></div>`).join('')}</div></body></html>`);
    await p.screenshot({ path: path.join(__dirname, 'sheet.jpg'), fullPage: true, type: 'jpeg', quality: 86 }); await b.close();
    console.log('ok', s.errors().slice(0, 3));
  } finally { await s.close(); reset(); }
})().catch(e => { console.error(e); reset(); process.exit(1); });
