// Orbit 방에서 말 고치기 (지우기 · 다시 받기 · 재번역): 여는 모양 M1~M3, 여러 개 고르기, 지우기 전 묻기, 번역 중. 실제 실시간 방에 끼워 찍어요.
// node docs/mockups/phone2-edit/mock.cjs → sheet.jpg
const { open } = require('../../../tools/dev/probe.cjs');
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path'), os = require('os');
const CHAT = path.join(os.homedir(), 'sillytavern/data/default-user/chats/default_Seraphina/na_test.jsonl');
const reset = () => fs.copyFileSync(path.join(__dirname, '../../../tools/dev/na_test.jsonl'), CHAT);
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'editmock'));
const svg = (d, c = 'currentColor', w = 19) => `<svg width="${w}" height="${w}" viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="${d}"/></svg>`;
const I = { tr: 'M4 6h8M8 4v2c0 4-2 7-5 8M6 10c1.500 2 3.500 3.500 6 4M13 20l4-9 4 9M14.500 17h5', redo: 'M20 11a8 8 0 1 0-2.300 5.700M20 5v6h-6', pick: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM8 12.500l2.800 2.800L16 9.500', bin: 'M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13M10 11v5M14 11v5', chk: 'M4 12.500l4.500 4.500L20 6' };
const ACTS = [['tr', '재번역', ''], ['redo', '다시 받기', ''], ['pick', '선택', ''], ['bin', '삭제', 'red']];
const CSS = `
.mk_dim .ob_mi > *:not(.mk_held):not(.mk_bar):not(.mk_pill) { opacity: .28; filter: saturate(.6); }
.mk_held { position: relative; z-index: 3; box-shadow: 0 10px 26px rgba(20,22,30,.22) !important; }
.mk_bar { align-self: flex-start; display: flex; gap: 2px; margin: 8px 0 4px; padding: 6px; border-radius: 20px; background: rgba(255,255,255,.94); box-shadow: inset 0 1px 0 rgba(255,255,255,.7), 0 10px 26px rgba(20,22,30,.2); position: relative; z-index: 3; }
.mk_bar span { display: flex; flex-direction: column; align-items: center; gap: 4px; min-width: 58px; padding: 8px 6px 6px; border-radius: 14px; color: #1b1d24; font-size: 11px; font-weight: 600; }
.mk_bar .red, .mk_pill .red, .mk_sheet .red { color: #c0392b; }
.mk_pill { align-self: flex-start; display: flex; margin: 0 0 8px; border-radius: 14px; background: #15161a; color: #fff; font-size: 13px; font-weight: 600; box-shadow: inset 0 1px 0 rgba(255,255,255,.16), 0 10px 24px rgba(20,22,30,.3); position: relative; z-index: 3; overflow: hidden; }
.mk_pill span { padding: 11px 13px; } .mk_pill span + span { border-left: 1px solid rgba(255,255,255,.14); } .mk_pill .red { color: #ff8a7a; }
.mk_shade { position: absolute; inset: 0; background: rgba(20,22,30,.3); z-index: 40; }
.mk_sheet { position: absolute; left: 8px; right: 8px; bottom: 8px; z-index: 41; background: #fff; border-radius: 30px; padding: 10px 16px 22px; box-shadow: 0 -10px 30px rgba(20,22,30,.18); color: #161b22; }
.mk_grab { display: block; width: 40px; height: 5px; border-radius: 3px; background: #d4d7dd; margin: 0 auto 8px; }
.mk_q { margin: 0 4px 6px; padding: 10px 14px; border-radius: 16px; background: #f1f2f5; font-size: 13.500px; color: #3a3f47; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.mk_row { display: flex; align-items: center; gap: 14px; padding: 13px 6px; font-size: 15px; font-weight: 600; } .mk_row + .mk_row { border-top: 1px solid #eef0f3; }
.mk_ck { flex: none; width: 22px; height: 22px; border-radius: 50%; border: 2px solid rgba(255,255,255,.85); margin-right: 8px; display: inline-flex; align-items: center; justify-content: center; box-sizing: border-box; }
.mk_ck.on { background: #15161a; border-color: #15161a; }
.mk_prow { display: flex; align-items: center; } .mk_prow.me { justify-content: flex-end; }
.mk_pbar { position: absolute; left: 12px; right: 12px; bottom: 30px; z-index: 6; display: flex; align-items: center; justify-content: space-between; padding: 8px 10px 8px 18px; border-radius: 999px; background: rgba(255,255,255,.92); box-shadow: inset 0 1px 0 rgba(255,255,255,.7), 0 10px 26px rgba(20,22,30,.18); color: #1b1d24; font-size: 14px; font-weight: 600; }
.mk_pbar i { font-style: normal; display: flex; gap: 6px; } .mk_pbar span { display: flex; align-items: center; gap: 6px; padding: 9px 13px; border-radius: 999px; background: #eef0f3; font-size: 13.500px; } .mk_pbar .red { background: #fbe9e6; color: #c0392b; }
.mk_wait { display: inline-flex; align-items: center; gap: 6px; opacity: .7; }
`;
(async () => {
  const s = await open('light', { out: TMP }); const p = s.p;
  try {
    await s.run(async ({ m }) => { const n = SillyTavern.getContext().chat.length - 1; const t = String(m.text), cut = t.search(/\n# STATE/), add = `\n## #26–#${n} — Am Fluss (Oct 25, night, Varo)\n- Sie redeten.\n`; m.text = cut >= 0 ? t.slice(0, cut).replace(/\s*$/, '') + '\n' + add + t.slice(cut) : t + add; m.boundary = n; });
    await s.to('set'); await p.click('.na_ph_pmode[data-v=live]'); await p.waitForTimeout(600); await p.click('.na_ob_start'); await p.waitForTimeout(2000);
    await s.to('orbitnew'); await p.waitForTimeout(400); await p.locator('.na_ph_frame .na_ob_pick', { hasText: 'Mara' }).first().click(); await p.waitForTimeout(300); await p.click('.na_ph_frame .na_ob_make'); await p.waitForTimeout(500);
    for (const t of ['내일 열 시에 정비소 올 수 있어?', '케이크도 가져갈게']) { await p.evaluate(t => { const f = document.querySelector('.na_ph_frame .na_ob_in'); f.textContent = t; f.dispatchEvent(new Event('input', { bubbles: true })); }, t); await p.click('.na_ph_frame .ob_send'); await p.waitForTimeout(4500); }
    await p.evaluate(css => { const st = document.createElement('style'); st.textContent = css; document.head.append(st); }, CSS);
    const rid = await s.run(async ({ m }) => Object.keys(m.live.world.messenger.rooms)[0]);
    const shots = {}, room = async (name, fn, arg) => { await s.to('orbit'); await p.waitForTimeout(200); await s.to('orbitroom', rid); await p.waitForTimeout(500); await p.evaluate(fn, arg); await p.waitForTimeout(250); shots[name] = await s.shot('edit_' + name); };
    const acts = ACTS.map(([k, l, r]) => ({ l, r, svg: svg(I[k]) }));
    // M1: 메시지 앱과 같은 방식 — 누른 말풍선이 떠오르고 바로 아래 아이콘 줄
    await room('M1', acts => { const mi = document.querySelector('.na_ph_frame .ob_mi'); document.querySelector('.na_ph_frame .ob_msgs').classList.add('mk_dim'); const b = [...mi.querySelectorAll('.ob_b.th')].at(-1); b.classList.add('mk_held'); b.insertAdjacentHTML('afterend', `<div class="mk_bar">${acts.map(a => `<span class="${a.r}">${a.svg}${a.l}</span>`).join('')}</div>`); b.scrollIntoView({ block: 'center' }); }, acts);
    // M2: 아래 시트 — 누른 말이 위에 작게, 줄로 고르기
    await room('M2', acts => { const b = [...document.querySelectorAll('.na_ph_frame .ob_b.th')].at(-1); const c = document.querySelector('.na_ph_frame .cg_canvas'); c.insertAdjacentHTML('beforeend', `<div class="mk_shade"></div><div class="mk_sheet"><i class="mk_grab"></i><div class="mk_q">${b.firstChild.textContent}</div>${acts.map(a => `<div class="mk_row ${a.r}">${a.svg}${a.l}</div>`).join('')}</div>`); }, acts);
    // M3: 말풍선 위 검정 알약 — 글자만
    await room('M3', acts => { const mi = document.querySelector('.na_ph_frame .ob_mi'); document.querySelector('.na_ph_frame .ob_msgs').classList.add('mk_dim'); const b = [...mi.querySelectorAll('.ob_b.th')].at(-1); b.classList.add('mk_held'); b.insertAdjacentHTML('beforebegin', `<div class="mk_pill">${acts.map(a => `<span class="${a.r}">${a.l}</span>`).join('')}</div>`); b.scrollIntoView({ block: 'center' }); }, acts);
    // 여러 개 고르기: 말마다 동그라미, 입력칸 자리에 "2개 · 재번역 · 삭제"
    await room('pick', ({ chk, tr, bin }) => { const mi = document.querySelector('.na_ph_frame .ob_mi'); const bs = [...mi.querySelectorAll('.ob_b')]; bs.forEach((b, i) => { const on = i >= bs.length - 2; const w = document.createElement('div'); w.className = 'mk_prow' + (b.classList.contains('me') ? ' me' : ''); b.replaceWith(w); w.innerHTML = `<span class="mk_ck${on ? ' on' : ''}">${on ? chk : ''}</span>`; w.append(b); }); const inp = document.querySelector('.na_ph_frame .ob_inp'); inp.style.display = 'none'; document.querySelector('.na_ph_frame .cg_canvas').insertAdjacentHTML('beforeend', `<div class="mk_pbar">2개 선택<i><span>${tr}재번역</span><span class="red">${bin}삭제</span><span>취소</span></i></div>`); mi.parentElement.scrollTop = 1e6; }, { chk: svg(I.chk, '#fff', 13), tr: svg(I.tr, 'currentColor', 15), bin: svg(I.bin, 'currentColor', 15) });
    // 지우기 전에 묻기
    await room('ask', () => { document.querySelector('.na_ph_frame .na_ph_scr').insertAdjacentHTML('beforeend', `<div class="pcf" role="dialog"><div class="pcf_box"><div class="pcf_card"><div class="pcf_msg"><b>말 2개를 지울까요?</b></div><div class="pcf_btns"><div class="pcf_no">취소</div><div class="pcf_ok pcf_bad">지우기</div></div></div></div></div>`); });
    // 번역 중: 그 말풍선의 한국어 자리에 도는 표시
    await room('wait', () => { const b = [...document.querySelectorAll('.na_ph_frame .ob_b.th')].at(-1); const k = b.querySelector('.ob_ko, .ob_kof'); const h = '<span class="mk_wait"><i class="fa-solid fa-spinner fa-spin"></i>번역 중</span>'; if (k) k.innerHTML = h; else b.insertAdjacentHTML('beforeend', `<span class="ob_ko">${h}</span>`); b.scrollIntoView({ block: 'center' }); });
    const names = { M1: 'M1. 말풍선 아래 아이콘 줄 (메시지 앱과 같은 방식)', M2: 'M2. 아래 시트', M3: 'M3. 말풍선 위 검정 알약', pick: '여러 개 고르기', ask: '지우기 전에 묻기', wait: '번역 중' };
    const b = await chromium.launch(), pg = await b.newPage({ deviceScaleFactor: 1 });
    await pg.setContent(`<html><body style="margin:0;padding:24px;background:#d9dbe0;font-family:-apple-system,'Noto Sans KR',sans-serif;width:max-content"><div style="display:flex;gap:16px">${Object.keys(names).map(k => `<div><h2 style="font-size:15px;margin:0 0 10px;max-width:290px">${names[k]}</h2><img style="width:290px;display:block;border-radius:22px" src="data:image/png;base64,${fs.readFileSync(shots[k]).toString('base64')}"></div>`).join('')}</div></body></html>`);
    await pg.screenshot({ path: path.join(__dirname, 'sheet.jpg'), fullPage: true, type: 'jpeg', quality: 86 }); await b.close();
    console.log('ok', s.errors().slice(0, 3));
  } finally { await s.close(); reset(); }
})().catch(e => { console.error(e); reset(); process.exit(1); });
