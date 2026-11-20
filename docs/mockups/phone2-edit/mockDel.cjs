// 맨 끝 답장의 알약: "삭제 · 답장 삭제"가 삭제삭제로 안 보이게 (둘 다 남겨요). N1~N4. 실제 방에서 길게 누른 화면을 바꿔 찍어요.
// node docs/mockups/phone2-edit/mockDel.cjs → sheetDel.jpg
const { open } = require('../../../tools/dev/probe.cjs');
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path'), os = require('os');
const CHAT = path.join(os.homedir(), 'sillytavern/data/default-user/chats/default_Seraphina/na_test.jsonl');
const reset = () => fs.copyFileSync(path.join(__dirname, '../../../tools/dev/na_test.jsonl'), CHAT);
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'delmock'));
const BIN = c => `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><path d="M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13M10 11v5M14 11v5"/></svg>`;
const CSS = `
.mk_p2 { align-self: flex-start; display: inline-flex; align-items: center; gap: 6px; margin: 4px 0 2px; padding: 9px 13px; border-radius: 14px; background: #15161a; color: #ff8a7a; font-size: 13px; font-weight: 600; box-shadow: inset 0 1px 0 rgba(255,255,255,.16), 0 10px 24px rgba(20,22,30,.3); position: relative; z-index: 3; opacity: 1 !important; }
.mk_dr { display: flex !important; align-items: center; gap: 10px; opacity: 1 !important; position: relative; z-index: 3; }
.mk_tb { display: inline-flex; align-items: center; justify-content: center; width: 28px; height: 28px; border-radius: 50%; background: rgba(255,255,255,.92); box-shadow: 0 4px 12px rgba(20,22,30,.18); }
.mk_ic { display: inline-flex; align-items: center; gap: 5px; }
`;
(async () => {
  const s = await open('light', { out: TMP }); const p = s.p;
  try {
    await s.run(async ({ m }) => { const n = SillyTavern.getContext().chat.length - 1; const t = String(m.text), cut = t.search(/\n# STATE/), add = `\n## #26–#${n} — Am Fluss (Oct 25, night, Varo)\n- Sie redeten.\n`; m.text = cut >= 0 ? t.slice(0, cut).replace(/\s*$/, '') + '\n' + add + t.slice(cut) : t + add; m.boundary = n; });
    await s.to('set'); await p.click('.na_ph_pmode[data-v=live]'); await p.waitForTimeout(600); await p.click('.na_ob_start'); await p.waitForTimeout(2000);
    await s.to('orbitnew'); await p.waitForTimeout(400); await p.locator('.na_ph_frame .na_ob_pick', { hasText: 'Mara' }).first().click(); await p.waitForTimeout(300); await p.click('.na_ph_frame .na_ob_make'); await p.waitForTimeout(500);
    await p.evaluate(() => { const f = document.querySelector('.na_ph_frame .na_ob_in'); f.textContent = '내일 열 시에 정비소 올 수 있어?'; f.dispatchEvent(new Event('input', { bubbles: true })); }); await p.click('.na_ph_frame .ob_send'); await p.waitForTimeout(4500);
    await p.evaluate(css => { const st = document.createElement('style'); st.textContent = css; document.head.append(st); }, CSS);
    const hold = async () => { await p.evaluate(() => { const a = [...document.querySelectorAll('.na_ph_frame .ob_b.th')]; a.forEach(x => x.removeAttribute('data-t')); a.at(-1).setAttribute('data-t', 'last'); }); const b = await (await p.$('.na_ph_frame .ob_b[data-t=last]')).boundingBox(); await p.mouse.move(b.x + b.width / 2, b.y + b.height / 2); await p.mouse.down(); await p.waitForTimeout(650); await p.mouse.up(); await p.waitForTimeout(400); };
    await hold();
    const shots = {}, shot = async n => { await p.waitForTimeout(250); shots[n] = await s.shot('del_' + n); };
    await shot('now');
    const html0 = await p.evaluate(() => document.querySelector('.na_ph_frame .ob_mi').innerHTML);
    const vary = async (n, fn, arg) => { await p.evaluate(h => { document.querySelector('.na_ph_frame .ob_mi').innerHTML = h; }, html0); await p.evaluate(fn, arg); await shot(n); };
    // N1: 낱말만 바꾸기 — "삭제 · 답장 버리기"
    await vary('N1', () => { document.querySelector('.na_ph_frame .ob_pill .na_ob_swdel').textContent = '답장 버리기'; });
    // N2: 답장 쪽은 점 옆 휴지통으로 — 알약에는 삭제 하나
    await vary('N2', bin => { document.querySelector('.na_ph_frame .ob_pill .na_ob_swdel').remove(); const d = document.querySelector('.na_ph_frame .ob_swd'); const w = document.createElement('div'); w.className = 'mk_dr'; d.replaceWith(w); w.append(d); w.insertAdjacentHTML('beforeend', `<span class="mk_tb">${bin}</span>`); }, BIN('#c0392b'));
    // N3: 알약 둘 — 위는 이 말(재번역 · 선택 · 삭제), 아래 작은 알약은 답장 전체
    await vary('N3', bin => { document.querySelector('.na_ph_frame .ob_pill .na_ob_swdel').remove(); const b = document.querySelector('.na_ph_frame .ob_b.held'); b.insertAdjacentHTML('afterend', `<div class="mk_p2">${bin}답장 전체</div>`); }, BIN('#ff8a7a'));
    // N4: 같은 알약, 답장 쪽은 휴지통 그림 + "전체"
    await vary('N4', bin => { document.querySelector('.na_ph_frame .ob_pill .na_ob_swdel').innerHTML = `<span class="mk_ic">${bin}전체</span>`; }, BIN('#ff8a7a'));
    const names = { now: '지금 (삭제 · 답장 삭제)', N1: 'N1. 낱말 바꾸기: 삭제 · 답장 버리기', N2: 'N2. 답장은 점 옆 휴지통', N3: 'N3. 알약 둘: 위는 이 말, 아래는 답장 전체', N4: 'N4. 삭제 · (휴지통) 전체' };
    const b = await chromium.launch(), pg = await b.newPage({ deviceScaleFactor: 1 });
    await pg.setContent(`<html><body style="margin:0;padding:24px;background:#d9dbe0;font-family:-apple-system,'Noto Sans KR',sans-serif;width:max-content"><div style="display:flex;gap:16px">${Object.keys(names).map(k => `<div><h2 style="font-size:15px;margin:0 0 10px;max-width:330px">${names[k]}</h2><div style="width:330px;height:360px;overflow:hidden;border-radius:22px;position:relative"><img style="width:330px;display:block;position:absolute;bottom:0" src="data:image/png;base64,${fs.readFileSync(shots[k]).toString('base64')}"></div></div>`).join('')}</div></body></html>`);
    await pg.screenshot({ path: path.join(__dirname, 'sheetDel.jpg'), fullPage: true, type: 'jpeg', quality: 90 }); await b.close();
    console.log('ok', s.errors().slice(0, 3));
  } finally { await s.close(); reset(); }
})().catch(e => { console.error(e); reset(); process.exit(1); });
