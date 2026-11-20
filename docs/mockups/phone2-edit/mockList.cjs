// 받아 둔 답장을 목록으로 보고 고르기 · 지금 것만 남기기 (메신저답게). L1~L3. 실제 방 화면에 끼워 찍어요.
// node docs/mockups/phone2-edit/mockList.cjs → sheetList.jpg
const { open } = require('../../../tools/dev/probe.cjs');
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path'), os = require('os');
const CHAT = path.join(os.homedir(), 'sillytavern/data/default-user/chats/default_Seraphina/na_test.jsonl');
const reset = () => fs.copyFileSync(path.join(__dirname, '../../../tools/dev/na_test.jsonl'), CHAT);
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'listmock'));
const CHK = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12.500l4.500 4.500L20 6"/></svg>';
// 받아 둔 답장 셋 (예시): [원문, 한국어]
const V = [
  [['Kann ich machen', '할 수 있어'], ['Zehn ist aber früh', '근데 열 시는 이르다'], ['Bring Kaffee mit', '커피 가져와']],
  [['Samstag? Da hab ich Schicht', '토요일? 나 근무야'], ['Geht auch Sonntag', '일요일도 돼?']],
  [['Ja klar, Samstag passt!', '응 좋아, 토요일 괜찮아!'], ['Bring Kuchen mit 😄', '케이크 가져와 😄']],
];
const CSS = `
.mk_shade { position: absolute; inset: 0; background: rgba(20,22,30,.34); z-index: 40; }
.mk_sheet { position: absolute; left: 8px; right: 8px; bottom: 8px; z-index: 41; background: rgba(250,250,252,.96); border-radius: 30px; padding: 10px 14px 16px; box-shadow: 0 -10px 30px rgba(20,22,30,.2); color: #161b22; }
.mk_grab { display: block; width: 40px; height: 5px; border-radius: 3px; background: #d4d7dd; margin: 0 auto 8px; }
.mk_sh { display: flex; justify-content: space-between; align-items: baseline; padding: 2px 6px 10px; font-size: 17px; font-weight: 600; } .mk_sh span { font-size: 13px; color: #8a8f99; font-weight: 500; }
.mk_v { display: flex; gap: 10px; align-items: flex-start; padding: 10px 6px; } .mk_v + .mk_v { border-top: 1px solid #eceef1; }
.mk_ck { flex: none; width: 22px; height: 22px; margin-top: 4px; border-radius: 50%; border: 2px solid #c9cdd4; box-sizing: border-box; display: flex; align-items: center; justify-content: center; } .mk_ck.on { background: #15161a; border-color: #15161a; } .mk_ck.w { border-color: rgba(255,255,255,.85); }
.mk_bs { flex: 1; display: flex; flex-direction: column; align-items: flex-start; gap: 4px; min-width: 0; }
.mk_bb { max-width: 100%; padding: 7px 12px; border-radius: 16px; border-bottom-left-radius: 6px; background: #eceef2; font-size: 13.500px; line-height: 1.35; } .mk_bb small { display: block; font-size: 11.500px; color: #7a808a; margin-top: 2px; }
.mk_tag { flex: none; font: 600 11.500px 'Inter Tight', sans-serif; color: #8a8f99; margin-top: 6px; } .mk_tag b { display: inline-block; margin-left: 4px; padding: 2px 7px; border-radius: 999px; background: #15161a; color: #fff; font-size: 10.500px; }
.mk_btns { display: flex; gap: 8px; margin-top: 10px; } .mk_btns span { flex: 1; text-align: center; padding: 13px 0; border-radius: 16px; font-size: 14px; font-weight: 600; background: #e6e8ec; } .mk_btns .red { background: #fbe9e6; color: #c0392b; }
.mk_car { position: absolute; left: 0; right: 0; top: 150px; bottom: 100px; z-index: 41; display: flex; gap: 12px; padding: 0 44px; align-items: center; overflow: hidden; }
.mk_card { flex: none; width: 250px; padding: 14px; border-radius: 26px; background: rgba(255,255,255,.5); backdrop-filter: blur(18px); -webkit-backdrop-filter: blur(18px); box-shadow: inset 0 1px 0 rgba(255,255,255,.6), 0 14px 30px rgba(20,22,30,.2); display: flex; flex-direction: column; gap: 6px; position: relative; } .mk_card.side { opacity: .75; transform: scale(.94); }
.mk_card .mk_bb { background: rgba(255,255,255,.85); font-size: 14.500px; } .mk_card .mk_ck { position: absolute; top: 12px; right: 12px; margin: 0; background: rgba(255,255,255,.6); } .mk_card .mk_ck.on { background: #15161a; }
.mk_card .mk_tag { margin: 0 0 4px; color: #2b2f37; }
.mk_pbar { position: absolute; left: 12px; right: 12px; bottom: 30px; z-index: 42; display: flex; align-items: center; justify-content: space-between; height: 54px; padding: 0 8px 0 18px; border-radius: 999px; background: rgba(255,255,255,.94); box-shadow: inset 0 1px 0 rgba(255,255,255,.7), 0 10px 26px rgba(20,22,30,.18); color: #1b1d24; font-size: 14px; font-weight: 600; box-sizing: border-box; }
.mk_pbar i { font-style: normal; display: flex; gap: 6px; } .mk_pbar span { padding: 9px 12px; border-radius: 999px; background: #eef0f3; font-size: 13px; white-space: nowrap; } .mk_pbar .red { background: #fbe9e6; color: #c0392b; }
.mk_lab { align-self: flex-start; margin: 10px 0 0 34px; font: 600 11.500px 'Inter Tight', sans-serif; color: rgba(255,255,255,.9); } .mk_lab b { margin-left: 5px; padding: 2px 7px; border-radius: 999px; background: rgba(20,22,30,.7); font-size: 10.500px; }
.mk_grp { display: flex; align-items: center; gap: 10px; } .mk_grp > div { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 6px; align-items: flex-start; } .mk_grp .ob_b { max-width: 82%; }
`;
(async () => {
  const s = await open('light', { out: TMP }); const p = s.p;
  try {
    await s.run(async ({ m }) => { const n = SillyTavern.getContext().chat.length - 1; const t = String(m.text), cut = t.search(/\n# STATE/), add = `\n## #26–#${n} — Am Fluss (Oct 25, night, Varo)\n- Sie redeten.\n`; m.text = cut >= 0 ? t.slice(0, cut).replace(/\s*$/, '') + '\n' + add + t.slice(cut) : t + add; m.boundary = n; });
    await s.to('set'); await p.click('.na_ph_pmode[data-v=live]'); await p.waitForTimeout(600); await p.click('.na_ob_start'); await p.waitForTimeout(2000);
    await s.to('orbitnew'); await p.waitForTimeout(400); await p.locator('.na_ph_frame .na_ob_pick', { hasText: 'Mara' }).first().click(); await p.waitForTimeout(300); await p.click('.na_ph_frame .na_ob_make'); await p.waitForTimeout(500);
    await p.evaluate(() => { const f = document.querySelector('.na_ph_frame .na_ob_in'); f.textContent = '내일 열 시에 정비소 올 수 있어?'; f.dispatchEvent(new Event('input', { bubbles: true })); }); await p.click('.na_ph_frame .ob_send'); await p.waitForTimeout(4500);
    await p.evaluate(css => { const st = document.createElement('style'); st.textContent = css; document.head.append(st); }, CSS);
    const rid = await s.run(async ({ m }) => Object.keys(m.live.world.messenger.rooms)[0]);
    const shots = {}, room = async (name, fn, arg) => { await s.to('orbit'); await p.waitForTimeout(200); await s.to('orbitroom', rid); await p.waitForTimeout(500); await p.evaluate(fn, arg); await p.waitForTimeout(250); shots[name] = await s.shot('list_' + name); };
    // L1: 아래 시트 — 답장마다 작은 말풍선 묶음, 왼쪽 동그라미로 고르기, 아래 "지금 것만 남기기 · N개 버리기"
    await room('L1', ({ V, CHK }) => { const c = document.querySelector('.na_ph_frame .cg_canvas'); const on = [true, false, false]; c.insertAdjacentHTML('beforeend', `<div class="mk_shade"></div><div class="mk_sheet"><i class="mk_grab"></i><div class="mk_sh">받아 둔 답장<span>3개</span></div>${V.map((v, i) => `<div class="mk_v"><span class="mk_ck${on[i] ? ' on' : ''}">${on[i] ? CHK : ''}</span><div class="mk_bs">${v.map(([t, k]) => `<div class="mk_bb">${t}<small>${k}</small></div>`).join('')}</div><span class="mk_tag">${i + 1}/3${i === 2 ? '<b>지금</b>' : ''}</span></div>`).join('')}<div class="mk_btns"><span>지금 것만 남기기</span><span class="red">1개 버리기</span></div></div>`); }, { V, CHK });
    // L2: 옆으로 넘기는 유리 카드 — 답장 하나가 카드 한 장, 오른쪽 위 동그라미로 고르기, 아래 줄
    await room('L2', ({ V, CHK }) => { const c = document.querySelector('.na_ph_frame .cg_canvas'); const card = (v, i, side, on) => `<div class="mk_card${side ? ' side' : ''}"><span class="mk_tag">${i + 1}/3${i === 2 ? ' · 지금' : ''}</span><span class="mk_ck${on ? ' on' : ''}">${on ? CHK : ''}</span>${v.map(([t, k]) => `<div class="mk_bb">${t}<small>${k}</small></div>`).join('')}</div>`; c.insertAdjacentHTML('beforeend', `<div class="mk_shade"></div><div class="mk_car" style="margin-left:-190px">${card(V[0], 0, true, true)}${card(V[1], 1, false, false)}${card(V[2], 2, true, false)}</div><div class="mk_pbar">1개 선택<i><span>지금 것만 남기기</span><span class="red">버리기</span><span>취소</span></i></div>`); document.querySelector('.na_ph_frame .ob_inp').style.visibility = 'hidden'; }, { V, CHK });
    // L3: 방 안에서 그대로 펼치기 — 받아 둔 답장이 차례로 보이고(1/3 · 2/3 · 3/3 지금), 여러 개 고를 때와 같은 동그라미 · 아래 줄
    await room('L3', ({ V, CHK }) => { const mi = document.querySelector('.na_ph_frame .ob_mi'); [...mi.querySelectorAll('.ob_b.th, .ob_swd, .ob_typ, .ob_fail')].forEach(x => x.remove()); const on = [true, false, false]; mi.insertAdjacentHTML('beforeend', V.map((v, i) => `<div class="mk_lab">${i + 1}/3${i === 2 ? '<b>지금</b>' : ''}</div><div class="mk_grp"><span class="mk_ck w${on[i] ? ' on' : ''}">${on[i] ? CHK : ''}</span><div>${v.map(([t, k]) => `<div class="ob_b th ob_glass">${t}<span class="ob_ko">${k}</span></div>`).join('')}</div></div>`).join('')); document.querySelector('.na_ph_frame .ob_inp').style.display = 'none'; document.querySelector('.na_ph_frame .cg_canvas').insertAdjacentHTML('beforeend', `<div class="mk_pbar">1개 선택<i><span>지금 것만 남기기</span><span class="red">버리기</span><span>취소</span></i></div>`); mi.parentElement.scrollTop = 1e6; }, { V, CHK });
    const names = { L1: 'L1. 아래 시트: 답장마다 작은 말풍선 묶음', L2: 'L2. 옆으로 넘기는 유리 카드', L3: 'L3. 방 안에서 그대로 펼치기' };
    const b = await chromium.launch(), pg = await b.newPage({ deviceScaleFactor: 1 });
    await pg.setContent(`<html><body style="margin:0;padding:24px;background:#d9dbe0;font-family:-apple-system,'Noto Sans KR',sans-serif;width:max-content"><div style="display:flex;gap:18px">${Object.keys(names).map(k => `<div><h2 style="font-size:16px;margin:0 0 10px">${names[k]}</h2><img style="width:330px;display:block;border-radius:22px" src="data:image/png;base64,${fs.readFileSync(shots[k]).toString('base64')}"></div>`).join('')}</div></body></html>`);
    await pg.screenshot({ path: path.join(__dirname, 'sheetList.jpg'), fullPage: true, type: 'jpeg', quality: 88 }); await b.close();
    console.log('ok', s.errors().slice(0, 3));
  } finally { await s.close(); reset(); }
})().catch(e => { console.error(e); reset(); process.exit(1); });
