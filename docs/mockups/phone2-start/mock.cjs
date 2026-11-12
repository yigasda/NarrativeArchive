// 5단계 시작 버튼 시안 A~D: 실제 폰 설정 › 휴대폰 카드(실시간 폰 없음)에서 시작하기를 누른 뒤. 마지막 칸은 실시간 폰이 있을 때 "새로 시작".
// 화면 위에 시안만 끼워 찍어요(코드는 안 바꿔요). node mock.cjs → sheet.jpg
const { open } = require('../../../tools/dev/probe.cjs');
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path'), os = require('os');
const CHAT = path.join(os.homedir(), 'sillytavern/data/default-user/chats/default_Seraphina/na_test.jsonl');
const reset = () => fs.copyFileSync(path.join(__dirname, '../../../tools/dev/na_test.jsonl'), CHAT);
const TMP = fs.mkdtempSync('/tmp/claude-0/ph2start');

const CSS = `
.sk_cardx{margin:8px 8px 4px;display:flex;flex-direction:column;gap:8px}
.sk_opt{display:flex;align-items:center;gap:12px;padding:12px 12px;border-radius:16px;background:#f4f5f7;cursor:pointer}
.sk_opt.on{background:#fff;box-shadow:0 0 0 2px #2c4a80,0 4px 12px rgba(44,74,128,.12)}
.sk_opt.off{opacity:.45}
.sk_opt b{display:block;font-size:14.5px;font-weight:600;color:#1b1d24}.sk_opt span.s{display:block;font-size:12px;color:#7b808b;margin-top:2px}
.sk_opt .t{flex:1}
.sk_ic{width:34px;height:34px;border-radius:11px;display:flex;align-items:center;justify-content:center;flex:none}
.sk_go{margin:6px 8px 4px;height:46px;border-radius:999px;background:#15161a;color:#fff;display:flex;align-items:center;justify-content:center;font-size:15px;font-weight:600;box-shadow:inset 0 1px 0 rgba(255,255,255,.16),0 8px 18px rgba(22,27,34,.18)}
.sk_date{display:flex;align-items:center;justify-content:center;gap:8px;font:600 13px 'Inter Tight',-apple-system,sans-serif;color:#3a3f47;margin:2px 0 2px}
.sk_date em{font-style:normal;font-weight:500;color:#2c4a80;background:#e2e9f5;border-radius:999px;padding:2px 8px;font-size:11.5px}
/* C: 전체 화면 */
.sk_full{position:absolute;inset:0;z-index:20;background:#f2f2f4;display:flex;flex-direction:column}
.sk_full .top{display:flex;justify-content:space-between;align-items:center;padding:58px 18px 10px}
.sk_full .cb{width:46px;height:46px;border-radius:50%;background:#fff;display:flex;align-items:center;justify-content:center;box-shadow:0 1px 2px rgba(22,27,34,.05),0 6px 16px rgba(22,27,34,.07)}
.sk_full h1{font-size:21px;font-weight:600}
.sk_hero{position:relative;overflow:hidden;margin:6px 16px 0;height:190px;border-radius:26px;color:#fff;box-shadow:0 10px 26px rgba(70,80,140,.22)}
.sk_hero i{position:absolute;inset:-30%;filter:blur(26px);background:radial-gradient(40% 50% at 25% 35%,#f3c3a6 0,transparent 70%),radial-gradient(45% 55% at 75% 70%,#b5a3dd 0,transparent 70%),radial-gradient(40% 40% at 70% 20%,#e8a7b8 0,transparent 70%),#e8a7b8}
.sk_hero .in{position:relative;padding:20px}
.sk_hero small{font-size:12px;opacity:.9}.sk_hero .big{font:600 44px/1.05 'Inter Tight',sans-serif;letter-spacing:-.02em;margin-top:8px}
.sk_hero .big em{font:500 13px -apple-system,'Noto Sans KR',sans-serif;opacity:.9;margin-left:8px}
.sk_hero .pill{display:inline-block;margin-top:14px;font-size:12px;background:rgba(255,255,255,.28);border-radius:999px;padding:4px 10px;box-shadow:inset 0 1px 0 rgba(255,255,255,.35)}
.sk_list{margin:14px 16px 0;background:#fff;border-radius:24px;padding:6px;box-shadow:0 1px 2px rgba(22,27,34,.04),0 8px 24px rgba(22,27,34,.05);display:flex;flex-direction:column;gap:4px}
.sk_list .sk_opt{background:none}.sk_list .sk_opt.on{background:#f4f5f7;box-shadow:none}
.sk_ck{width:24px;height:24px;border-radius:50%;border:2px solid #d4d7dd;box-sizing:border-box}
.sk_ck.on{border:0;background:#15161a;display:flex;align-items:center;justify-content:center}
.sk_full .sk_go{position:absolute;left:16px;right:16px;bottom:34px;height:58px;margin:0;font-size:15.5px}
`;
const svg = (d, c, s = 18, w = 2) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"><path d="${d}"/></svg>`;
const BOOK = 'M5 4h9a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3zM5 17a3 3 0 0 1 3-3h9', SPARK = 'M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6', CHK = 'M4 12.5l4.5 4.5L20 6', BACK = 'M15 5l-7 7 7 7';
const opt = (k, on, off, title, sub) => `<div class="sk_opt${on ? ' on' : ''}${off ? ' off' : ''}"><span class="sk_ic" style="background:${k === 'story' ? '#e2e9f5' : '#f3e4ea'}">${svg(k === 'story' ? BOOK : SPARK, k === 'story' ? '#2c4a80' : '#a0537a')}</span><span class="t"><b>${title}</b>${sub ? `<span class="s">${sub}</span>` : ''}</span></div>`;
const sheet = (title, opts, no = '취소') => `<div class="pcf" role="dialog"><div class="pcf_box"><div class="pcf_card"><div class="pcf_msg"><b>${title}</b></div><div class="pcf_btns v">${opts.map(o => `<div class="pcf_ok safe${o.bad ? ' pcf_bad' : ''}${o.off ? '' : ''}" style="${o.off ? 'opacity:.4' : ''}">${o.sub ? `<span class="pcf_sub">${o.sub}</span>` : ''}${o.label}</div>`).join('')}<div class="pcf_no">${no}</div></div></div></div></div>`;
const V = {
  A: { name: 'A. 바로 시트', patch: { sheet: sheet('실시간 폰', [{ label: '이야기에서 시작', sub: '10월 25일 · 현실보다 +2일' }, { label: '처음부터', sub: '곧', off: 1 }]) } },
  B: { name: 'B. 카드 안에서 펼치기', patch: { card: `<div class="sk_cardx">${opt('story', 1, 0, '이야기에서 시작', '10월 25일 17:42까지')}${opt('fresh', 0, 1, '처음부터', '곧')}<div class="sk_date">10.25. 21:10<em>현실보다 +2일</em></div><div class="sk_go">시작</div></div>` } },
  C: { name: 'C. 전체 화면', patch: { full: `<div class="sk_full"><div class="top"><span class="cb">${svg(BACK, '#15171c', 20)}</span><h1>실시간</h1><span style="width:46px"></span></div>
      <div class="sk_hero"><i></i><div class="in"><small>유나 · 서울 지금</small><div class="big">21:10<em>10월 25일</em></div><span class="pill">현실보다 +2일</span></div></div>
      <div class="sk_list">${opt('story', 1, 0, '이야기에서 시작', '10월 25일 17:42까지').replace('</span></div>', '</span><span class="sk_ck on">' + svg(CHK, '#fff', 13, 3.2) + '</span></div>')}${opt('fresh', 0, 1, '처음부터', '곧').replace(/<\/span><\/div>$/, '</span><span class="sk_ck"></span></div>')}</div>
      <div class="sk_go">시작</div></div>` } },
  D: { name: 'D. 한 번에 (확인 한 줄)', patch: { sheet: sheet('이야기에서 이어서 시작할까요?', [{ label: '시작', sub: '10월 25일 · 현실보다 +2일' }]) } },
};
const RESET = sheet('실시간 폰 새로 시작', [{ label: '대화만 남기기', sub: 'Orbit 대화 그대로' }, { label: '통째로 지우기', bad: 1 }]);
(async () => {
  const s = await open('light', { out: TMP });
  try {
    await s.to('set');
    const shots = {};
    const put = P => s.p.evaluate(([CSS, P]) => {
      if (!document.getElementById('sk_css')) { const st = document.createElement('style'); st.id = 'sk_css'; st.textContent = CSS; document.head.append(st); }
      const cv = document.querySelector('.na_ph_frame .cg_canvas');
      cv.querySelectorAll('.pcf,.sk_full,.sk_cardx').forEach(e => e.remove());
      if (P.card) { const c = cv.querySelector('.ax_pmode'); c.querySelector('.ax_pmnone')?.remove(); c.insertAdjacentHTML('beforeend', P.card); }
      if (P.sheet) cv.insertAdjacentHTML('beforeend', P.sheet);
      if (P.full) cv.insertAdjacentHTML('beforeend', P.full);
    }, [CSS, P]);
    for (const v of Object.keys(V)) { await s.to('set'); await put(V[v].patch); await s.p.waitForTimeout(250); shots[v] = await s.shot('start_' + v); }
    // 실시간 폰이 있을 때: 설정 맨 아래 "실시간 폰 새로 시작" → 고르기
    await s.run(async ({ m }) => { const st = await import('/scripts/extensions/third-party/NarrativeArchive/src/phone2store.js'); st.startFresh(m, { persona: 'Yuna' }); st.putLivePhone(m, structuredClone(m.phones.mara)); });
    await s.to('set'); await s.p.click('.na_ph_pmode[data-v=live]'); await s.p.waitForTimeout(400); await put({ sheet: RESET }); shots.R = await s.shot('start_R');
    const b = await chromium.launch(), p = await b.newPage({ deviceScaleFactor: 1 });
    const names = { ...Object.fromEntries(Object.entries(V).map(([k, x]) => [k, x.name])), R: '실시간 폰이 있을 때: 새로 시작' };
    await p.setContent(`<html><body style="margin:0;padding:24px;background:#d9dbe0;font-family:-apple-system,'Noto Sans KR',sans-serif;width:max-content"><div style="display:flex;gap:20px">${Object.keys(shots).map(k => `<div><h2 style="font-size:19px;margin:0 0 10px">${names[k]}</h2><img style="width:330px;display:block;border-radius:22px" src="data:image/png;base64,${fs.readFileSync(shots[k]).toString('base64')}"></div>`).join('')}</div></body></html>`);
    await p.screenshot({ path: path.join(__dirname, 'sheet.jpg'), fullPage: true, type: 'jpeg', quality: 86 }); await b.close();
    console.log('ok', s.errors().slice(0, 3));
  } finally { await s.close(); reset(); }
})().catch(e => { console.error(e); reset(); process.exit(1); });
