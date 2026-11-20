// (C1을 고른 뒤: 아래 빈 곳에 사진 여러 장 갤러리 Q1~Q3)
// Orbit에서 프사 바꿀 때의 "얼굴 자리 고르기" 창: 지금(확장 창) + C1~C3. 실제 방 화면 위에 그려 찍어요.
// node docs/mockups/phone2-edit/mockCrop.cjs → sheetCrop.jpg
const { open } = require('../../../tools/dev/probe.cjs');
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path'), os = require('os');
const CHAT = path.join(os.homedir(), 'sillytavern/data/default-user/chats/default_Seraphina/na_test.jsonl');
const reset = () => fs.copyFileSync(path.join(__dirname, '../../../tools/dev/na_test.jsonl'), CHAT);
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'cropmock'));
// 예시 사진 (그림으로 그린 인물)
const PHOTO = 'data:image/svg+xml;utf8,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="600" height="800" viewBox="0 0 600 800"><defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#c9d8e8"/><stop offset="1" stop-color="#e9d9c8"/></linearGradient></defs><rect width="600" height="800" fill="url(#g)"/><rect y="560" width="600" height="240" fill="#b7a58f"/><path d="M150 800c0-170 70-250 150-250s150 80 150 250z" fill="#3f5a78"/><circle cx="300" cy="400" r="120" fill="#f0c9a8"/><path d="M175 395c0-95 55-150 125-150s125 55 125 150c-30-60-70-85-125-85s-95 25-125 85z" fill="#4a352b"/><circle cx="260" cy="410" r="9" fill="#2b2b2b"/><circle cx="340" cy="410" r="9" fill="#2b2b2b"/><path d="M270 455q30 22 60 0" stroke="#a5604d" stroke-width="7" fill="none" stroke-linecap="round"/></svg>`);
const CSS = `
.mk_all { position: absolute; inset: 0; z-index: 60; display: flex; flex-direction: column; color: #15171c; font-family: 'Noto Sans KR', -apple-system, sans-serif; }
.mk_top { display: flex; align-items: center; justify-content: space-between; padding: 58px 16px 0; }
.mk_cb { width: 46px; height: 46px; border-radius: 50%; display: flex; align-items: center; justify-content: center; background: rgba(255,255,255,.5); box-shadow: inset 0 1px 0 rgba(255,255,255,.7), 0 6px 16px rgba(40,40,80,.1); }
.mk_h { font-size: 18px; font-weight: 600; }
.mk_stage { position: relative; align-self: center; width: 300px; height: 300px; margin-top: 40px; border-radius: 34px; overflow: hidden; box-shadow: inset 0 0 0 1px rgba(255,255,255,.5), 0 18px 40px rgba(20,22,40,.22); }
.mk_stage img { position: absolute; left: -75px; top: -150px; width: 450px; }
.mk_ring { position: absolute; inset: 0; border-radius: 50%; box-shadow: 0 0 0 999px rgba(20,22,30,.42), inset 0 0 0 2px rgba(255,255,255,.9); }
.mk_zoom { display: flex; align-items: center; gap: 12px; margin: 26px 46px 0; font-size: 12.500px; font-weight: 600; }
.mk_tr { flex: 1; height: 6px; border-radius: 3px; position: relative; } .mk_tr i { position: absolute; left: 30%; top: 50%; width: 24px; height: 24px; margin: -12px 0 0 -12px; border-radius: 50%; background: #fff; box-shadow: 0 2px 8px rgba(20,22,30,.25); }
.mk_go { position: absolute; left: 16px; right: 16px; bottom: 34px; height: 58px; border-radius: 999px; display: flex; align-items: center; justify-content: center; font-size: 15.500px; font-weight: 600; }
/* C1: 그 사람 방 색 전체 화면 + 유리 */
.C1 { background: var(--aura); } .C1 .mk_zoom { color: #fff; } .C1 .mk_tr { background: rgba(255,255,255,.45); } .C1 .mk_go { background: rgba(20,22,30,.78); color: #fff; box-shadow: inset 0 1px 0 rgba(255,255,255,.16), 0 10px 24px rgba(20,22,40,.2); } .C1 .mk_h { color: #fff; text-shadow: 0 1px 2px rgba(0,0,0,.12); }
/* 갤러리 (C1의 빈 곳) */
.mk_strip { display: flex; gap: 10px; margin: 30px 0 0; padding: 0 20px; overflow: hidden; } .mk_strip.in { margin: 0; padding: 0 14px 14px; }
.mk_th, .mk_add { flex: none; width: 64px; height: 64px; border-radius: 18px; overflow: hidden; position: relative; box-shadow: 0 6px 14px rgba(20,22,40,.16); } .mk_th img { position: static !important; width: 100% !important; height: 100%; object-fit: cover; display: block; }
.mk_th.on { box-shadow: 0 0 0 2.500px #fff, 0 6px 14px rgba(20,22,40,.2); } .mk_add { display: flex; align-items: center; justify-content: center; background: rgba(255,255,255,.3); box-shadow: inset 0 1px 0 rgba(255,255,255,.7), inset 0 0 0 1px rgba(255,255,255,.4); }
.mk_th.r, .mk_add.r { border-radius: 50%; width: 70px; height: 70px; }
.mk_grid { display: grid; grid-template-columns: repeat(4, 70px); gap: 14px 16px; justify-content: center; margin-top: 26px; }
.mk_small .mk_stage { width: 230px; height: 230px; margin-top: 22px; } .mk_small .mk_stage img { left: -58px; top: -115px; width: 345px; } .mk_small { display: flex; justify-content: center; }
.mk_tray { margin: 26px 12px 0; border-radius: 26px; background: rgba(255,255,255,.3); box-shadow: inset 0 1px 0 rgba(255,255,255,.8), inset 0 0 0 1px rgba(255,255,255,.45), 0 10px 30px rgba(40,40,80,.14); overflow: hidden; }
.mk_trh { display: flex; justify-content: space-between; padding: 12px 18px 10px; font-size: 14px; font-weight: 600; color: #1b1d24; } .mk_trh span { font-family: 'Inter Tight', sans-serif; opacity: .6; }
/* C2: 방 위에 올라오는 유리 창 (받아 둔 답장 창과 같은 결) */
.mk_shade { position: absolute; inset: 0; z-index: 59; background: rgba(20,22,30,.1); }
.C2 { inset: auto 8px 8px 8px; border-radius: 32px; padding: 10px 0 16px; background: linear-gradient(rgba(255,255,255,.46), rgba(255,255,255,.46)), var(--aura); box-shadow: inset 0 1px 0 rgba(255,255,255,.8), inset 0 0 0 1px rgba(255,255,255,.45), 0 10px 30px rgba(40,40,80,.16); }
.C2 .mk_grab { align-self: center; width: 40px; height: 5px; border-radius: 3px; background: rgba(30,32,40,.22); margin-bottom: 8px; } .C2 .mk_hh { padding: 2px 20px 0; font-size: 17px; font-weight: 600; }
.C2 .mk_stage { width: 260px; height: 260px; margin-top: 16px; } .C2 .mk_stage img { left: -65px; top: -130px; width: 390px; } .C2 .mk_ring { box-shadow: 0 0 0 999px rgba(255,255,255,.5), inset 0 0 0 2px #fff; }
.C2 .mk_zoom { margin: 18px 40px 0; color: rgba(30,32,40,.6); } .C2 .mk_tr { background: rgba(30,32,40,.16); }
.C2 .mk_bt { display: flex; gap: 10px; margin: 18px 14px 0; } .C2 .mk_bt span { flex: 1; text-align: center; padding: 14px 0; border-radius: 16px; font-size: 15px; font-weight: 600; background: rgba(255,255,255,.5); box-shadow: inset 0 1px 0 rgba(255,255,255,.8); } .C2 .mk_bt .ok { background: rgba(20,22,30,.78); color: #fff; box-shadow: inset 0 1px 0 rgba(255,255,255,.16); }
/* C3: 사진 편집기처럼 어두운 전체 화면, 위에 취소 · 완료 */
.C3 { background: #0e0f12; color: #fff; } .C3 .mk_top { font-size: 16px; font-weight: 600; } .C3 .mk_top b { color: #ffd27a; }
.C3 .mk_stage { width: 390px; height: 390px; margin-top: 90px; border-radius: 0; box-shadow: none; } .C3 .mk_stage img { left: -97px; top: -195px; width: 585px; } .C3 .mk_ring { inset: 14px; box-shadow: 0 0 0 999px rgba(14,15,18,.72), inset 0 0 0 2px #fff; }
.C3 .mk_zoom { margin: 34px 46px 0; color: rgba(255,255,255,.6); } .C3 .mk_tr { background: rgba(255,255,255,.2); }
`;
const BACK = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#1b1d24" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg>';
const zoom = '<div class="mk_zoom"><span>작게</span><span class="mk_tr"><i></i></span><span>크게</span></div>';
const stage = `<div class="mk_stage"><img src="${PHOTO}" alt=""><div class="mk_ring"></div></div>`;
// 예시 사진 여러 장 (색만 다른 인물)
const pic = (bg, hair, top) => 'data:image/svg+xml;utf8,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300" viewBox="0 0 300 300"><rect width="300" height="300" fill="${bg}"/><path d="M60 300c0-90 40-130 90-130s90 40 90 130z" fill="${top}"/><circle cx="150" cy="130" r="62" fill="#f0c9a8"/><path d="M85 128c0-50 28-78 65-78s65 28 65 78c-16-32-36-44-65-44s-49 12-65 44z" fill="${hair}"/></svg>`);
const PICS = [pic('#c9d8e8', '#4a352b', '#3f5a78'), pic('#e8d3c9', '#4a352b', '#8a4b3c'), pic('#d3e3cf', '#2f2a26', '#55705a'), pic('#e6dcc4', '#6b4a33', '#b08a4a'), pic('#d9d2e6', '#3a2f3d', '#5c5578'), pic('#cfe0e3', '#4a352b', '#3d6a73'), pic('#ead0d6', '#2f2a26', '#9a5a6a')];
const PLUS = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>';
const top = `<div class="mk_top"><span class="mk_cb">${BACK}</span><span class="mk_h">Mara</span><span style="width:46px"></span></div>`;
const go = '<div class="mk_go">이대로 쓰기</div>';
const H = {
  // Q1: 아래 빈 곳에 가로로 넘기는 사진 줄 (지금 고른 것은 흰 테두리), 맨 앞은 더하기
  Q1: `<div class="mk_all C1">${top}${stage}${zoom}<div class="mk_strip"><span class="mk_add">${PLUS}</span>${PICS.map((u, i) => `<span class="mk_th${i === 0 ? ' on' : ''}"><img src="${u}" alt=""></span>`).join('')}</div>${go}</div>`,
  // Q2: 아래 빈 곳에 네 칸 격자 (둥근 사진), 맨 앞은 더하기
  Q2: `<div class="mk_all C1">${top}<div class="mk_small">${stage}</div>${zoom}<div class="mk_grid"><span class="mk_add r">${PLUS}</span>${PICS.map((u, i) => `<span class="mk_th r${i === 0 ? ' on' : ''}"><img src="${u}" alt=""></span>`).join('')}</div>${go}</div>`,
  // Q3: 아래 빈 곳에 유리 판 한 장, 그 안에 사진 줄 (판 머리에 장수)
  Q3: `<div class="mk_all C1">${top}${stage}${zoom}<div class="mk_tray"><div class="mk_trh"><b>사진</b><span>7</span></div><div class="mk_strip in"><span class="mk_add">${PLUS}</span>${PICS.map((u, i) => `<span class="mk_th${i === 0 ? ' on' : ''}"><img src="${u}" alt=""></span>`).join('')}</div></div>${go}</div>`,
};
(async () => {
  const s = await open('light', { out: TMP }); const p = s.p;
  try {
    await s.run(async ({ m }) => { const n = SillyTavern.getContext().chat.length - 1; const t = String(m.text), cut = t.search(/\n# STATE/), add = `\n## #26–#${n} — Am Fluss (Oct 25, night, Varo)\n- Sie redeten.\n`; m.text = cut >= 0 ? t.slice(0, cut).replace(/\s*$/, '') + '\n' + add + t.slice(cut) : t + add; m.boundary = n; });
    await s.to('set'); await p.click('.na_ph_pmode[data-v=live]'); await p.waitForTimeout(600); await p.click('.na_ob_start'); await p.waitForTimeout(2000);
    await s.to('orbitnew'); await p.waitForTimeout(400); await p.locator('.na_ph_frame .na_ob_pick', { hasText: 'Mara' }).first().click(); await p.waitForTimeout(300); await p.click('.na_ph_frame .na_ob_make'); await p.waitForTimeout(500);
    await p.evaluate(() => { const f = document.querySelector('.na_ph_frame .na_ob_in'); f.textContent = '내일 열 시에 정비소 올 수 있어?'; f.dispatchEvent(new Event('input', { bubbles: true })); }); await p.click('.na_ph_frame .ob_send'); await p.waitForTimeout(4500);
    await p.evaluate(css => { const st = document.createElement('style'); st.textContent = css; document.head.append(st); }, CSS);
    const aura = await p.evaluate(() => document.querySelector('.na_ph_frame .ob_bg .ob_blob').style.background);
    const shots = {};
    for (const k of Object.keys(H)) { await p.evaluate(() => document.querySelectorAll('.na_ph_frame .mk_all, .na_ph_frame .mk_shade').forEach(x => x.remove())); await p.evaluate(([h, a]) => { const c = document.querySelector('.na_ph_frame .cg_canvas'); c.insertAdjacentHTML('beforeend', h); c.querySelector('.mk_all').style.setProperty('--aura', a); }, [H[k], aura]); await p.waitForTimeout(300); shots[k] = await s.shot('crop_' + k); }
    const names = { Q1: 'Q1. 가로로 넘기는 사진 줄', Q2: 'Q2. 둥근 사진 네 칸 격자', Q3: 'Q3. 유리 판 안의 사진 줄' };
    const b = await chromium.launch(), pg = await b.newPage({ deviceScaleFactor: 1 });
    await pg.setContent(`<html><body style="margin:0;padding:24px;background:#d9dbe0;font-family:-apple-system,'Noto Sans KR',sans-serif;width:max-content"><div style="display:flex;gap:18px">${Object.keys(names).map(k => `<div><h2 style="font-size:16px;margin:0 0 10px">${names[k]}</h2><img style="width:330px;display:block;border-radius:22px" src="data:image/png;base64,${fs.readFileSync(shots[k]).toString('base64')}"></div>`).join('')}</div></body></html>`);
    await pg.screenshot({ path: path.join(__dirname, 'sheetCrop2.jpg'), fullPage: true, type: 'jpeg', quality: 88 }); await b.close();
    console.log('ok', s.errors().slice(0, 3));
  } finally { await s.close(); reset(); }
})().catch(e => { console.error(e); reset(); process.exit(1); });
