// 받아 둔 답장 고르기: L1(아래 시트)을 다듬은 것 넷. 답장이 많아도 시트 안에서 굴려 봐요(위 제목 · 아래 버튼은 고정).
// node docs/mockups/phone2-edit/mockList2.cjs → sheetList2.jpg
const { open } = require('../../../tools/dev/probe.cjs');
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path'), os = require('os');
const CHAT = path.join(os.homedir(), 'sillytavern/data/default-user/chats/default_Seraphina/na_test.jsonl');
const reset = () => fs.copyFileSync(path.join(__dirname, '../../../tools/dev/na_test.jsonl'), CHAT);
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'list2mock'));
const CHK = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12.500l4.500 4.500L20 6"/></svg>';
// 받아 둔 답장 일곱 (예시): [원문, 한국어]
const V = [
  [['Kann ich machen', '할 수 있어'], ['Zehn ist aber früh', '근데 열 시는 이르다'], ['Bring Kaffee mit', '커피 가져와']],
  [['Samstag? Da hab ich Schicht', '토요일? 나 근무야'], ['Geht auch Sonntag', '일요일도 돼?']],
  [['Zehn Uhr, na gut', '열 시, 뭐 좋아'], ['Aber du zahlst das Frühstück', '대신 아침은 네가 사']],
  [['Ja klar, Samstag passt!', '응 좋아, 토요일 괜찮아!'], ['Bring Kuchen mit 😄', '케이크 가져와 😄']],
  [['Hm, muss Ivo fragen', '음, 이보한테 물어봐야 해'], ['Meld mich gleich', '금방 연락할게']],
  [['Nur wenn du pünktlich bist', '네가 제시간에 오면'], ['Letztes Mal hab ich gewartet', '저번엔 내가 기다렸잖아']],
  [['Passt', '돼']],
];
const NOW = 3, ON = new Set([0, 1]);
const CSS = `
.mk_shade { position: absolute; inset: 0; background: rgba(20,22,30,.34); z-index: 40; }
.mk_sheet { position: absolute; left: 8px; right: 8px; bottom: 8px; height: 520px; z-index: 41; border-radius: 30px; box-shadow: 0 -10px 30px rgba(20,22,30,.2); color: #161b22; display: flex; flex-direction: column; overflow: hidden; }
.mk_grab { flex: none; display: block; width: 40px; height: 5px; border-radius: 3px; background: #d4d7dd; margin: 10px auto 6px; }
.mk_sh { flex: none; display: flex; justify-content: space-between; align-items: baseline; padding: 4px 20px 10px; font-size: 17px; font-weight: 600; } .mk_sh span { font: 600 13px 'Inter Tight', sans-serif; color: #8a8f99; }
.mk_sc { flex: 1; min-height: 0; overflow: hidden; position: relative; }
.mk_sc::after { content: ''; position: absolute; left: 0; right: 0; bottom: 0; height: 34px; pointer-events: none; }
.mk_ft { flex: none; display: flex; gap: 8px; padding: 10px 14px 16px; } .mk_ft span { flex: 1; text-align: center; padding: 14px 0; border-radius: 16px; font-size: 14.500px; font-weight: 600; }
.mk_keep { background: #e6e8ec; color: #161b22; } .mk_drop { background: #15161a; color: #fff; box-shadow: inset 0 1px 0 rgba(255,255,255,.16); }
.mk_ck { flex: none; width: 22px; height: 22px; border-radius: 50%; border: 2px solid #c9cdd4; box-sizing: border-box; display: flex; align-items: center; justify-content: center; } .mk_ck.on { background: #15161a; border-color: #15161a; }
.mk_no { font: 600 12px 'Inter Tight', sans-serif; color: #8a8f99; } .mk_nowc { display: inline-block; margin-left: 6px; padding: 2px 8px; border-radius: 999px; background: #15161a; color: #fff; font: 600 10.500px sans-serif; vertical-align: 1px; }
/* A: 회색 바탕 + 흰 카드 (우리 앱 목록의 결) */
.A.mk_sheet { background: #f2f2f4; } .A .mk_sc::after { background: linear-gradient(transparent, #f2f2f4); }
.A .mk_card { margin: 0 12px 10px; padding: 12px 14px; border-radius: 22px; background: #fff; box-shadow: 0 1px 2px rgba(22,27,34,.05), 0 6px 16px rgba(22,27,34,.06); }
.A .mk_hd { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
.A .mk_bb { display: inline-block; max-width: 88%; margin: 0 0 4px; padding: 8px 12px; border-radius: 16px; border-bottom-left-radius: 6px; background: #f1f2f5; font-size: 14px; line-height: 1.35; } .A .mk_bb small { display: block; font-size: 12px; color: #7a808a; margin-top: 2px; } .A .mk_bl { display: flex; flex-direction: column; align-items: flex-start; }
.A .mk_card.sel { box-shadow: 0 0 0 2px #15161a, 0 6px 16px rgba(22,27,34,.08); }
/* B: 방 색이 비치는 유리 시트 + 진짜 말풍선 */
.B.mk_sheet { background: rgba(255,255,255,.62); backdrop-filter: blur(26px) saturate(1.3); -webkit-backdrop-filter: blur(26px) saturate(1.3); box-shadow: inset 0 1px 0 rgba(255,255,255,.7), 0 -10px 30px rgba(20,22,30,.2); }
.B .mk_grab { background: rgba(30,32,40,.25); } .B .mk_sh span, .B .mk_no { color: rgba(30,32,40,.6); }
.B .mk_sc::after { background: linear-gradient(transparent, rgba(240,244,236,.9)); }
.B .mk_row { display: flex; gap: 10px; align-items: flex-start; padding: 0 14px 14px; } .B .mk_bl { flex: 1; min-width: 0; display: flex; flex-direction: column; align-items: flex-start; gap: 5px; }
.B .mk_bb { max-width: 92%; padding: 9px 13px; border-radius: 20px; border-bottom-left-radius: 7px; background: rgba(255,255,255,.78); box-shadow: 0 4px 12px rgba(20,22,40,.08); font-size: 14.500px; line-height: 1.36; } .B .mk_bb small { display: block; font-size: 12px; color: rgba(30,32,40,.6); margin-top: 3px; padding-top: 3px; border-top: 1px solid rgba(30,32,40,.1); }
.B .mk_ck { margin-top: 20px; border-color: rgba(30,32,40,.3); background: rgba(255,255,255,.5); } .B .mk_ck.on { background: #15161a; border-color: #15161a; } .B .mk_keep { background: rgba(255,255,255,.7); }
/* C: 방 목록처럼 한 줄씩 (번호 동그라미 · 첫 말 굵게 · 나머지 미리보기) */
.C.mk_sheet { background: #fff; } .C .mk_sc::after { background: linear-gradient(transparent, #fff); }
.C .mk_row { display: flex; align-items: center; gap: 12px; padding: 11px 18px; } .C .mk_row + .mk_row { box-shadow: inset 0 1px 0 #eef0f3; }
.C .mk_nb { flex: none; width: 42px; height: 42px; border-radius: 50%; background: #e8f0e4; color: #3d7a4a; font: 600 15px 'Inter Tight', sans-serif; display: flex; align-items: center; justify-content: center; } .C .mk_nb.now { background: #15161a; color: #fff; }
.C .mk_tx { flex: 1; min-width: 0; } .C .mk_tx b { display: block; font-size: 15px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; } .C .mk_tx span { display: block; font-size: 12.500px; color: #8a8f99; margin-top: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
/* D: 흰 시트, 왼쪽 가는 줄에 번호 · 말풍선은 테두리 없이 글만 (가볍게) */
.D.mk_sheet { background: #fbfbfc; } .D .mk_sc::after { background: linear-gradient(transparent, #fbfbfc); }
.D .mk_row { display: flex; gap: 12px; padding: 0 18px 16px; align-items: flex-start; } .D .mk_rail { flex: none; width: 30px; text-align: center; font: 600 13px 'Inter Tight', sans-serif; color: #b0b5be; padding-top: 2px; } .D .mk_rail.now { color: #15161a; }
.D .mk_bl { flex: 1; min-width: 0; padding-left: 12px; border-left: 2px solid #e6e8ec; } .D .mk_row.now .mk_bl { border-left-color: #15161a; }
.D .mk_ln { font-size: 14.500px; line-height: 1.4; margin-bottom: 6px; } .D .mk_ln small { display: block; font-size: 12px; color: #8a8f99; } .D .mk_ck { margin-top: 2px; }
`;
const ck = on => `<span class="mk_ck${on ? ' on' : ''}">${on ? CHK : ''}</span>`;
const nowc = '<span class="mk_nowc">지금</span>';
const shell = (cls, body, n) => `<div class="mk_shade"></div><div class="mk_sheet ${cls}"><i class="mk_grab"></i><div class="mk_sh">받아 둔 답장<span>${V.length}</span></div><div class="mk_sc">${body}</div><div class="mk_ft"><span class="mk_keep">지금 것만 남기기</span><span class="mk_drop">${n}개 버리기</span></div></div>`;
const H = {
  A: shell('A', V.map((v, i) => `<div class="mk_card${ON.has(i) ? ' sel' : ''}"><div class="mk_hd"><span class="mk_no">${i + 1}${i === NOW ? nowc : ''}</span>${ck(ON.has(i))}</div><div class="mk_bl">${v.map(([t, k]) => `<span class="mk_bb">${t}<small>${k}</small></span>`).join('')}</div></div>`).join(''), ON.size),
  B: shell('B', V.map((v, i) => `<div class="mk_row">${ck(ON.has(i))}<div class="mk_bl"><span class="mk_no">${i + 1}${i === NOW ? nowc : ''}</span>${v.map(([t, k]) => `<span class="mk_bb">${t}<small>${k}</small></span>`).join('')}</div></div>`).join(''), ON.size),
  C: shell('C', V.map((v, i) => `<div class="mk_row"><span class="mk_nb${i === NOW ? ' now' : ''}">${i + 1}</span><span class="mk_tx"><b>${v[0][0]}</b><span>${v.slice(1).map(x => x[0]).join(' · ') || v[0][1]}</span></span>${ck(ON.has(i))}</div>`).join(''), ON.size),
  D: shell('D', V.map((v, i) => `<div class="mk_row${i === NOW ? ' now' : ''}"><span class="mk_rail${i === NOW ? ' now' : ''}">${i + 1}</span><div class="mk_bl">${v.map(([t, k]) => `<div class="mk_ln">${t}<small>${k}</small></div>`).join('')}</div>${ck(ON.has(i))}</div>`).join(''), ON.size),
};
(async () => {
  const s = await open('light', { out: TMP }); const p = s.p;
  try {
    await s.run(async ({ m }) => { const n = SillyTavern.getContext().chat.length - 1; const t = String(m.text), cut = t.search(/\n# STATE/), add = `\n## #26–#${n} — Am Fluss (Oct 25, night, Varo)\n- Sie redeten.\n`; m.text = cut >= 0 ? t.slice(0, cut).replace(/\s*$/, '') + '\n' + add + t.slice(cut) : t + add; m.boundary = n; });
    await s.to('set'); await p.click('.na_ph_pmode[data-v=live]'); await p.waitForTimeout(600); await p.click('.na_ob_start'); await p.waitForTimeout(2000);
    await s.to('orbitnew'); await p.waitForTimeout(400); await p.locator('.na_ph_frame .na_ob_pick', { hasText: 'Mara' }).first().click(); await p.waitForTimeout(300); await p.click('.na_ph_frame .na_ob_make'); await p.waitForTimeout(500);
    await p.evaluate(() => { const f = document.querySelector('.na_ph_frame .na_ob_in'); f.textContent = '내일 열 시에 정비소 올 수 있어?'; f.dispatchEvent(new Event('input', { bubbles: true })); }); await p.click('.na_ph_frame .ob_send'); await p.waitForTimeout(4500);
    await p.evaluate(css => { const st = document.createElement('style'); st.textContent = css; document.head.append(st); }, CSS);
    const shots = {};
    for (const k of Object.keys(H)) { await p.evaluate(() => document.querySelectorAll('.na_ph_frame .mk_shade, .na_ph_frame .mk_sheet').forEach(x => x.remove())); await p.evaluate(h => document.querySelector('.na_ph_frame .cg_canvas').insertAdjacentHTML('beforeend', h), H[k]); await p.waitForTimeout(300); shots[k] = await s.shot('list2_' + k); }
    const names = { A: 'A. 회색 바탕 + 흰 카드', B: 'B. 유리 시트 + 진짜 말풍선', C: 'C. 방 목록처럼 한 줄씩', D: 'D. 번호 줄 + 글만 (가볍게)' };
    const b = await chromium.launch(), pg = await b.newPage({ deviceScaleFactor: 1 });
    await pg.setContent(`<html><body style="margin:0;padding:24px;background:#d9dbe0;font-family:-apple-system,'Noto Sans KR',sans-serif;width:max-content"><div style="display:flex;gap:18px">${Object.keys(names).map(k => `<div><h2 style="font-size:16px;margin:0 0 10px">${names[k]}</h2><img style="width:330px;display:block;border-radius:22px" src="data:image/png;base64,${fs.readFileSync(shots[k]).toString('base64')}"></div>`).join('')}</div></body></html>`);
    await pg.screenshot({ path: path.join(__dirname, 'sheetList2.jpg'), fullPage: true, type: 'jpeg', quality: 88 }); await b.close();
    console.log('ok', s.errors().slice(0, 3));
  } finally { await s.close(); reset(); }
})().catch(e => { console.error(e); reset(); process.exit(1); });
