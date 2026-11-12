// 실시간 폰 홈 시안 A~D: 위 위젯 두 개를 넓은 Orbit 위젯 하나로. 실제 폰(폰 2, 실시간)의 홈 1쪽에 끼워 찍어요.
// 앱 칸은 원래 8개 그대로(혼자 남던 Orbit 아이콘은 빼요, 위젯을 누르면 Orbit이 열려요). node mock.cjs → sheet.jpg
const { open } = require('../../../tools/dev/probe.cjs');
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path'), os = require('os');
const CHAT = path.join(os.homedir(), 'sillytavern/data/default-user/chats/default_Seraphina/na_test.jsonl');
const reset = () => fs.copyFileSync(path.join(__dirname, '../../../tools/dev/na_test.jsonl'), CHAT);
const B = '/scripts/extensions/third-party/NarrativeArchive/src/';
const TMP = fs.mkdtempSync('/tmp/claude-0/ph2home');

const AURA = { Mara: ['#6f8fe6', '#a9c4f7', '#c7b8f2', '#94acee'], Ivo: ['#e8615a', '#f4ab95', '#f7c9b4', '#ee8b7c'], Ren: ['#59b874', '#f0bf7f', '#cfe08c', '#8dcb8a'], V: ['#8a6fdc', '#d79ad8', '#a7a1ef', '#a688de'] };
const bg = k => { const [a, b, c, d] = AURA[k]; return `radial-gradient(40% 50% at 25% 35%,${a} 0,transparent 70%),radial-gradient(45% 55% at 75% 70%,${b} 0,transparent 70%),radial-gradient(40% 40% at 70% 20%,${c} 0,transparent 70%),${d}`; };
const face = (k, s, l = k[0]) => `<span class="w_face" style="width:${s}px;height:${s}px;font-size:${Math.round(s * .38)}px"><span class="w_blob" style="background:${bg(k)}"></span><b>${l}</b></span>`;
const ROOMS = [{ k: 'Mara', name: 'Mara', last: "Ich erzähl's dir gleich", ko: '바로 말해 줄게', t: '21:02', un: 2 }, { k: 'V', name: 'Varo Werkstatt', l: 'V', last: 'Ivo: Schlüssel liegt unter der Matte', t: '20:40', un: 3 }, { k: 'Ren', name: 'Ren', last: '나: 잘 자 내일 봐', t: '어제', un: 0 }];
const dots = lit => Array.from({ length: 24 }, (_, h) => `<i class="${h === lit ? 'h' : h < lit ? 'p' : ''}" style="height:${h < lit ? [8, 13, 19, 13][h % 4] : 3}px"></i>`).join('');
const logo = s => `<span class="w_logo" style="width:${s}px;height:${s}px"></span>`;

const CSS = `
.w_face{position:relative;overflow:hidden;border-radius:50%;flex:none;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;box-shadow:inset 0 1px 0 rgba(255,255,255,.35),0 2px 6px rgba(22,27,34,.12)}
.w_face b{position:relative;z-index:1}.w_blob{position:absolute;inset:-30%;filter:blur(7px)}
.w_wide{grid-column:span 2;height:168px;box-sizing:border-box;border-radius:26px;position:relative;overflow:hidden;cursor:pointer}
.w_un{position:absolute;right:-3px;top:-3px;min-width:18px;height:18px;padding:0 5px;box-sizing:border-box;border-radius:999px;background:#e5484d;color:#fff;font:600 11px/18px 'Inter Tight',sans-serif;text-align:center;box-shadow:0 0 0 2px rgba(255,255,255,.9);z-index:2}
.w_logo{display:inline-block;border-radius:30%;background:linear-gradient(135deg,#f3c3a6,#e8a7b8 50%,#b5a3dd);position:relative;flex:none}
.w_logo::after{content:'';position:absolute;inset:24%;border-radius:50%;border:2px solid #fff;border-right-color:rgba(255,255,255,.35);border-bottom-color:rgba(255,255,255,.55)}
/* A: 지금 그 사람 + 얼굴 줄 */
.wa{color:#fff;box-shadow:0 12px 30px rgba(70,80,140,.24)}
.wa .w_bg{position:absolute;inset:-30%;filter:blur(26px);background:${bg('Mara')}}
.wa .w_gl{position:absolute;inset:0;background:linear-gradient(180deg,rgba(255,255,255,.22),rgba(255,255,255,0) 45%)}
.wa .w_in{position:relative;z-index:1;padding:15px 18px;height:100%;box-sizing:border-box;display:flex;flex-direction:column}
.wa small{font-size:11.5px;opacity:.9}.wa .w_big{font:600 40px/1 'Inter Tight',sans-serif;letter-spacing:-.02em;margin-top:5px}
.wa .w_big em{font:500 12px -apple-system,'Noto Sans KR',sans-serif;opacity:.9;margin-left:8px;letter-spacing:0}
.wa .w_dots{display:flex;gap:3.6px;align-items:flex-end;height:20px;margin-top:auto}.wa .w_dots i{width:3.4px;border-radius:2px;background:rgba(255,255,255,.45)}.wa .w_dots i.p{background:rgba(255,255,255,.75)}.wa .w_dots i.h{background:#fff;height:20px}
.wa .w_faces{position:absolute;right:16px;top:15px;display:flex;gap:8px;z-index:1}.wa .w_faces span.w_wrap{position:relative}
/* B: 최근 대화 목록 (유리) */
.wb{padding:13px 16px 10px;display:flex;flex-direction:column}
.wb .w_hd{display:flex;align-items:center;gap:7px;font:600 12.5px -apple-system,'Noto Sans KR',sans-serif;color:#3a3f47;margin-bottom:6px}
.wb .w_hd em{font-style:normal;margin-left:auto;font-weight:500;color:#8a8f99;font-size:11.5px}
.wb .w_rm{display:flex;align-items:center;gap:10px;padding:9px 0}
.wb .w_rm+.w_rm{border-top:1px solid rgba(40,50,70,.07)}
.wb .w_t{flex:1;min-width:0}.wb .w_t b{display:block;font-size:13.5px;font-weight:600;color:#1b1d24}.wb .w_t span{display:block;font-size:12px;color:#6b707b;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.wb .w_r{display:flex;flex-direction:column;align-items:flex-end;gap:3px;font:500 11px 'Inter Tight',sans-serif;color:#8a8f99}
.wb .w_n{min-width:18px;height:18px;padding:0 5px;box-sizing:border-box;border-radius:999px;background:#15161a;color:#fff;font:600 10.5px/18px 'Inter Tight',sans-serif;text-align:center}
/* C: 사람 동그라미 줄 */
.wc{padding:14px 16px;display:flex;flex-direction:column}
.wc .w_hd{display:flex;align-items:center;gap:7px;font:600 12.5px -apple-system,'Noto Sans KR',sans-serif;color:#3a3f47}
.wc .w_row{display:flex;justify-content:space-between;margin-top:auto;padding:0 4px}
.wc .w_p{display:flex;flex-direction:column;align-items:center;gap:6px;width:72px}
.wc .w_p .w_wrap{position:relative}
.wc .w_p b{font-size:12.5px;font-weight:600;color:#1b1d24}.wc .w_p span.w_s{font:500 11px 'Inter Tight',-apple-system,sans-serif;color:#6b707b;display:flex;gap:3px;align-items:center;margin-top:-3px}
.wc .w_new{width:54px;height:54px;border-radius:50%;background:rgba(255,255,255,.55);display:flex;align-items:center;justify-content:center;box-shadow:inset 0 1px 0 #fff,0 2px 6px rgba(22,27,34,.08)}

/* B2: 줄마다 그 사람 색이 오른쪽에서 번짐 */
.wb2 .w_rm{position:relative;overflow:hidden;border-radius:14px;padding:8px 10px;margin:0 -6px}
.wb2 .w_rm+.w_rm{border-top:0;margin-top:4px}
.wb2 .w_fx{position:absolute;right:-10px;top:-14px;bottom:-14px;width:65%;-webkit-mask-image:linear-gradient(90deg,transparent,#000 75%);mask-image:linear-gradient(90deg,transparent,#000 75%);opacity:.55}
.wb2 .w_fx span{position:absolute;inset:0;filter:blur(14px)}
.wb2 .w_rm>*:not(.w_fx){position:relative;z-index:1}
/* B3: 흰 카드 + 새 대화 알약 */
.wb3{background:#fff;box-shadow:0 1px 2px rgba(22,27,34,.05),0 12px 28px rgba(40,50,70,.12)}
.wb3 .w_pill{margin-left:auto;display:inline-flex;gap:4px;align-items:center;background:#15161a;color:#fff;border-radius:999px;padding:5px 10px 5px 8px;font-size:11.5px;font-weight:600;box-shadow:inset 0 1px 0 rgba(255,255,255,.16)}
.wb3 .w_rm+.w_rm{border-top-color:#eef0f3}
/* B4: 촘촘 세 줄 */
.wb4 .w_rm{padding:4px 0;gap:9px}
.wb4 .w_t{display:flex;align-items:baseline;gap:6px}
.wb4 .w_t b{flex:none;font-size:13px}.wb4 .w_t span{font-size:12px}
.wb4 .w_r{flex-direction:row;align-items:center;gap:6px}
.wb4 .w_rm.un .w_t span{color:#1b1d24;font-weight:500}

/* 3차: 큰 얼굴 · 큰 이름 · 빨간 배지 · 진짜 Orbit 아이콘 */
.r_ic{display:inline-flex;border-radius:28%;overflow:hidden;box-shadow:0 1px 3px rgba(70,40,70,.2)}
.r_ic svg{display:block}
.r_bd{position:absolute;right:-4px;top:-4px;min-width:20px;height:20px;padding:0 6px;box-sizing:border-box;border-radius:999px;background:#e5484d;color:#fff;font:600 11.5px/20px 'Inter Tight',sans-serif;text-align:center;box-shadow:0 0 0 2px rgba(255,255,255,.92);z-index:2}
.r_fw{position:relative;flex:none;display:inline-flex;align-self:flex-start;width:fit-content}
.r_corner{position:absolute;right:14px;top:14px;z-index:3}
/* R1 두 사람 나란히 */
.r1{display:grid;grid-template-columns:1fr 1fr;padding:16px 14px 14px}
.r1 .r_p{display:flex;flex-direction:column;gap:8px;padding:0 6px;min-width:0}
.r1 .r_p+.r_p{border-left:1px solid rgba(40,50,70,.08);padding-left:14px}
.r1 b{font-size:16px;font-weight:600;color:#1b1d24;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-top:4px}
.r1 .r_m{font-size:13px;line-height:1.35;color:#5b606c;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
/* R2 한 사람 크게 + 옆 얼굴 */
.r2{display:flex;gap:14px;padding:18px 16px}
.r2 .r_main{flex:1;min-width:0;display:flex;flex-direction:column}
.r2 .r_main .r_top{display:flex;align-items:center;gap:12px}
.r2 .r_main b{font-size:19px;font-weight:600;color:#1b1d24}
.r2 .r_main small{display:block;font:500 12px 'Inter Tight',sans-serif;color:#8a8f99;margin-top:2px}
.r2 .r_main .r_m{margin-top:12px;font-size:14.5px;line-height:1.38;color:#2a2e36;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.r2 .r_main .r_m span{color:#7b808b;font-size:12.5px}
.r2 .r_side{display:flex;flex-direction:column;justify-content:space-between;align-items:center;padding:2px 0 0;border-left:1px solid rgba(40,50,70,.08);padding-left:14px}
/* R3 두 줄 크게 */
.r3{padding:10px 16px;display:flex;flex-direction:column;justify-content:center}
.r3 .r_rm{display:flex;align-items:center;gap:12px;padding:10px 0}
.r3 .r_rm+.r_rm{border-top:1px solid rgba(40,50,70,.08)}
.r3 .r_t{flex:1;min-width:0}.r3 .r_t b{display:block;font-size:16px;font-weight:600;color:#1b1d24}
.r3 .r_t span{display:block;font-size:13.5px;color:#5b606c;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-top:1px}
.r3 .r_tm{font:500 12px 'Inter Tight',sans-serif;color:#8a8f99;align-self:flex-start;margin-top:3px;padding-right:30px}
/* R4 그 사람 색 반반 */
.r4{display:grid;grid-template-columns:1fr 1fr;gap:0;background:none;padding:0;box-shadow:0 14px 34px rgba(40,50,70,.14)}
.r4 .r_half{position:relative;overflow:hidden;padding:16px 15px 14px;display:flex;flex-direction:column;color:#fff;min-width:0}
.r4 .r_half .w_blob{inset:-30%;filter:blur(24px)}
.r4 .r_half .r_gl{position:absolute;inset:0;background:linear-gradient(180deg,rgba(255,255,255,.22),rgba(255,255,255,0) 45%)}
.r4 .r_half>*:not(.w_blob):not(.r_gl):not(.r_corner){position:relative;z-index:1}
.r4 .r_half+.r_half{box-shadow:inset 1px 0 0 rgba(255,255,255,.35)}
.r4 b{font-size:16px;font-weight:600;margin-top:10px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.r4 .r_m{font-size:13px;line-height:1.35;opacity:.95;margin-top:3px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.r4 .r_corner{right:12px;top:12px}
/* D: 마지막 말 크게 (그 사람 색) */
.wd{color:#fff;box-shadow:0 12px 30px rgba(70,80,140,.24)}
.wd .w_bg{position:absolute;inset:-30%;filter:blur(26px);background:${bg('Mara')}}
.wd .w_gl{position:absolute;inset:0;background:linear-gradient(180deg,rgba(255,255,255,.2),rgba(255,255,255,0) 45%)}
.wd .w_in{position:relative;z-index:1;padding:14px 16px;height:100%;box-sizing:border-box;display:flex;flex-direction:column}
.wd .w_top{display:flex;align-items:center;gap:8px;font-size:13px;font-weight:600}.wd .w_top em{font:500 11.5px 'Inter Tight',sans-serif;opacity:.85;margin-left:auto;font-style:normal}
.wd .w_bub{margin-top:10px;align-self:flex-start;max-width:86%;background:rgba(255,255,255,.5);backdrop-filter:blur(14px);color:#1b1d24;border-radius:18px;border-bottom-left-radius:6px;padding:9px 13px;font-size:14.5px;line-height:1.35;box-shadow:inset 0 1px 0 rgba(255,255,255,.7)}
.wd .w_bub span{display:block;font-size:12px;color:rgba(30,32,40,.6);margin-top:3px}
.wd .w_more{margin-top:auto;display:flex;align-items:center;gap:6px;font-size:11.5px;opacity:.95}
.wd .w_more .w_face{box-shadow:0 0 0 1.5px rgba(255,255,255,.8)}
`;
const ic = (d, s, c) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="${d}"/></svg>`;
const MOON = 'M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z', CLK = 'M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16zM12 8v4l3 2', PLUS = 'M12 5v14M5 12h14', SUN = 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2';
const FW = (r, sz) => `<span class="r_fw">${face(r.k, sz, r.l)}${r.un ? `<span class="r_bd">${r.un}</span>` : ''}</span>`;
const [R1, R2, R3] = ROOMS;
const W = {
  A: `<div class="w_wide cg_glass r1"><span class="r_corner r_ic">%ICON26%</span>${[R1, R2].map(r => `<div class="r_p">${FW(r, 50)}<b>${r.name}</b><span class="r_m">${r.last}</span></div>`).join('')}</div>`,
  B: `<div class="w_wide cg_glass r2"><div class="r_main"><div class="r_top">${FW(R1, 56)}<div><b>${R1.name}</b><small>${R1.t}</small></div></div><div class="r_m">${R1.last}<br><span>${R1.ko}</span></div></div><div class="r_side"><span class="r_ic">%ICON26%</span>${FW(R2, 38)}${FW(R3, 38)}</div></div>`,
  C: `<div class="w_wide cg_glass r3"><span class="r_corner r_ic">%ICON26%</span>${[R1, R2].map(r => `<div class="r_rm">${FW(r, 46)}<span class="r_t"><b>${r.name}</b><span>${r.last}</span></span><span class="r_tm">${r.t}</span></div>`).join('')}</div>`,
  D: `<div class="w_wide r4">${[R1, R2].map((r, n) => `<div class="r_half"><span class="w_blob" style="background:${bg(r.k)}"></span><span class="r_gl"></span>${n ? '<span class="r_corner r_ic">%ICON26%</span>' : ''}${FW(r, 44)}<b>${r.name}</b><span class="r_m">${r.last}</span></div>`).join('')}</div>`,
};
const NAME = { A: 'R1. 두 사람 나란히', B: 'R2. 한 사람 크게 + 옆 얼굴', C: 'R3. 두 줄 크게', D: 'R4. 그 사람 색 반반' };
(async () => {
  const s = await open('light', { out: TMP });
  try {
    await s.run(async ({ m, arg }) => { const st = await import(arg + 'phone2store.js'); st.startFresh(m, { persona: 'Yuna' }); st.putLivePhone(m, structuredClone(m.phones.mara)); }, B);
    await s.to('set'); await s.p.click('.na_ph_pmode[data-v=live]'); await s.p.waitForTimeout(500);
    const shots = {};
    for (const v of Object.keys(W)) {
      await s.to('home');
      await s.p.evaluate(([CSS, html]) => {
        if (!document.getElementById('w_css')) { const st = document.createElement('style'); st.id = 'w_css'; st.textContent = CSS; document.head.append(st); }
        const ic = document.querySelector('.na_ph_frame .ob_ic svg');
        const icon = sz => ic ? ic.outerHTML.replace('width="62" height="62"', `width="${sz}" height="${sz}"`) : '';
        document.querySelector('.na_ph_frame .ob_ic')?.closest('.cg_cell')?.remove();
        document.querySelector('.na_ph_frame .cg_widgets').innerHTML = html.replace(/%ICON(\d+)%/g, (_, n) => icon(Number(n)));
      }, [CSS, W[v]]);
      await s.p.waitForTimeout(300); shots[v] = await s.shot('home_' + v);
    }
    const b = await chromium.launch(), p = await b.newPage({ deviceScaleFactor: 1 });
    await p.setContent(`<html><body style="margin:0;padding:24px;background:#d9dbe0;font-family:-apple-system,'Noto Sans KR',sans-serif;width:max-content"><div style="display:flex;gap:24px">${Object.keys(W).map(v => `<div><h2 style="font-size:21px;margin:0 0 12px">${NAME[v]}</h2><img style="width:412px;display:block;border-radius:24px" src="data:image/png;base64,${fs.readFileSync(shots[v]).toString('base64')}"></div>`).join('')}</div></body></html>`);
    await p.screenshot({ path: path.join(__dirname, 'sheet.jpg'), fullPage: true, type: 'jpeg', quality: 88 }); await b.close();
    console.log('ok', s.errors().slice(0, 3));
  } finally { await s.close(); reset(); }
})().catch(e => { console.error(e); reset(); process.exit(1); });
