const { chromium } = require('playwright');
const B = '/scripts/extensions/third-party/NarrativeArchive/src/';
const sv = (d, s = 22, c = 'currentColor', w = 1.9) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
const PH = '<rect x="6.5" y="2.5" width="11" height="19" rx="2.5"/><path d="M10.5 18.5h3"/>';
const KEEP = '<rect x="6.5" y="2.5" width="11" height="19" rx="2.5"/><path d="M9.5 9.5h5M9.5 12.5h5M9.5 15.5h3"/>';
const NEW = '<path d="M12 3l1.8 4.7L18.5 9.5l-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8z"/><path d="M18.5 15.5l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z"/>';
const CHK = sv('<path d="M5 12.5l4.5 4.5L19 7.5"/>', 14, '#fff', 3.2);
const H = (t, sub) => `<div class="na_v2_title"><b>${t}</b></div>${sub ? `<div class="na_confirm_text">${sub}</div>` : ''}`;
const css = `
.k_note { margin-top: 14px; font-size: 12.5px; color: var(--na-dim); text-align: center; }
.k_ic { width: 40px; height: 40px; border-radius: 12px; display: flex; align-items: center; justify-content: center; flex: none; }
.k_ic.keep { background: #E7EEF6; color: #3D6FB6; } .k_ic.new { background: var(--na-accent-soft); color: var(--na-accent); }
.k_t { display: flex; flex-direction: column; gap: 2px; min-width: 0; text-align: left; }
.k_t b { font-size: 15px; font-weight: 700; color: var(--na-ink); } .k_t span { font-size: 12.5px; color: var(--na-sub); line-height: 1.4; }
.k_rd { width: 22px; height: 22px; border-radius: 999px; border: 2px solid var(--na-line); flex: none; margin-left: auto; display: flex; align-items: center; justify-content: center; box-sizing: border-box; }
.on .k_rd { border: 0; background: var(--na-accent); box-shadow: inset 0 1px 0 rgba(255,255,255,.25); }
/* A: two stacked cards */
.kA { display: flex; flex-direction: column; gap: 10px; margin-top: 16px; }
.kA > div { display: flex; align-items: center; gap: 12px; padding: 14px; border-radius: 18px; background: #FBF6F2; border: 1.5px solid transparent; box-shadow: 0 1px 2px rgba(70,52,40,.05), 0 6px 16px rgba(70,52,40,.07); }
.kA > div.on { border-color: var(--na-accent); background: #FFF8F3; }
/* B: side by side tiles */
.kB { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 16px; }
.kB > div { position: relative; display: flex; flex-direction: column; align-items: center; gap: 10px; padding: 18px 10px 16px; border-radius: 20px; background: #FBF6F2; border: 1.5px solid transparent; text-align: center; box-shadow: 0 1px 2px rgba(70,52,40,.05), 0 6px 16px rgba(70,52,40,.07); }
.kB > div .k_ic { width: 52px; height: 52px; border-radius: 16px; }
.kB > div .k_t { align-items: center; text-align: center; }
.kB > div.on { border-color: var(--na-accent); background: #FFF8F3; }
.kB .k_rd { position: absolute; top: 10px; right: 10px; margin: 0; width: 20px; height: 20px; }
/* C: one grouped list card */
.kC { margin-top: 16px; border-radius: 18px; background: #FBF6F2; box-shadow: 0 1px 2px rgba(70,52,40,.05), 0 6px 16px rgba(70,52,40,.07); overflow: hidden; }
.kC > div { display: flex; align-items: center; gap: 12px; padding: 13px 14px; }
.kC > div { position: relative; } .kC > div + div::before { content: ''; position: absolute; top: 0; left: 66px; right: 0; border-top: 1px solid var(--na-line2); }
.kC .k_rd { border: 0; }
.kC .on .k_rd { background: none; box-shadow: none; }
/* D: segmented switch + what happens */
.kD_seg { display: grid; grid-template-columns: 1fr 1fr; gap: 4px; padding: 4px; margin-top: 16px; border-radius: 999px; background: var(--na-card2); }
.kD_seg > div { display: flex; align-items: center; justify-content: center; gap: 6px; height: 40px; border-radius: 999px; font-size: 14px; font-weight: 600; color: var(--na-mute); }
.kD_seg > div.on { background: #FFF8F3; color: var(--na-accent-ink); box-shadow: 0 1px 2px rgba(70,52,40,.08), 0 4px 10px rgba(70,52,40,.08); }
.kD_box { margin-top: 12px; padding: 14px 16px; border-radius: 16px; background: #FBF6F2; box-shadow: 0 1px 2px rgba(70,52,40,.05), 0 6px 16px rgba(70,52,40,.07); display: flex; flex-direction: column; gap: 8px; }
.kD_box > div { display: flex; align-items: center; gap: 10px; font-size: 13.5px; color: var(--na-ink); }
.kD_box i { width: 22px; height: 22px; border-radius: 999px; background: #E3F2E8; color: #1F6A40; display: flex; align-items: center; justify-content: center; flex: none; font-style: normal; }
`;
const opt = (k, on, name, sub) => `<div class="${on ? 'on' : ''}"><span class="k_ic ${k}">${sv(k === 'keep' ? KEEP : NEW)}</span><span class="k_t"><b>${name}</b><span>${sub}</span></span><span class="k_rd">${on ? CHK : ''}</span></div>`;
const optC = (k, on, name, sub) => `<div class="${on ? 'on' : ''}"><span class="k_ic ${k}">${sv(k === 'keep' ? KEEP : NEW)}</span><span class="k_t"><b>${name}</b><span>${sub}</span></span><span class="k_rd">${on ? sv('<path d="M5 12.5l4.5 4.5L19 7.5"/>', 20, '#B8541F', 2.6) : ''}</span></div>`;
const tick = sv('<path d="M5 12.5l4.5 4.5L19 7.5"/>', 13, '#1F6A40', 3);
const V = {
 A: `${H('이 이야기의 휴대폰')}<div class="kA">${opt('keep', 1, '기존 폰 이어받기', '문자 · 은행 · 사진 그대로')}${opt('new', 0, '새 이야기로 시작', '이 방의 폰 기록을 비워요')}</div><div class="k_note">원래 방은 바뀌지 않아요</div>`,
 B: `${H('이 이야기의 휴대폰')}<div class="kB">${opt('keep', 1, '이어받기', '폰 기록 그대로')}${opt('new', 0, '새로 시작', '폰 기록 비우기')}</div><div class="k_note">원래 방은 바뀌지 않아요</div>`,
 C: `${H('이 이야기의 휴대폰', '같은 이야기인가요?')}<div class="kC">${optC('keep', 1, '네, 이어서 써요', '기존 폰을 그대로 가져와요')}${optC('new', 0, '아니요, 새 이야기예요', '이 방의 폰 기록을 비워요')}</div><div class="k_note">원래 방은 바뀌지 않아요</div>`,
 D: `${H('이 이야기의 휴대폰')}<div class="kD_seg"><div class="on">${sv(KEEP, 16)}이어받기</div><div>${sv(NEW, 16)}새로 시작</div></div><div class="kD_box"><div><i>${tick}</i>문자 · 일정 · 메모 그대로</div><div><i>${tick}</i>은행 · 지갑 · 투자 그대로</div><div><i>${tick}</i>원래 방은 바뀌지 않아요</div></div>`,
};
const L = { A: 'A. 카드 두 장', B: 'B. 나란히 타일', C: 'C. 목록 카드 (질문형)', D: 'D. 분할 버튼 + 무엇이 남는지' };
(async()=>{ const out=process.argv[2]; const b=await chromium.launch(); const p=await b.newPage({viewport:{width:412,height:860},deviceScaleFactor:2});
 await p.goto('http://127.0.0.1:8000/'); await p.waitForFunction(()=>window.SillyTavern?.getContext?.().characters?.length>0,null,{timeout:60000}); await p.waitForTimeout(2500);
 await p.evaluate(()=>document.body.classList.remove('na_darkui'));
 await p.evaluate(c=>{const st=document.createElement('style'); st.textContent=c; document.head.append(st);}, css);
 for (const k of Object.keys(V)) {
  p.evaluate(async B=>(await import(B+'phonestory.js')).choosePhoneStory({}), B);
  await p.waitForSelector('dialog.popup .na_confirm');
  await p.evaluate(([h,l])=>{const c=document.querySelector('dialog.popup[open] .na_confirm'); c.innerHTML=h+'<input type="radio" hidden>'; const t=document.createElement('div'); t.textContent=l; t.style.cssText='position:fixed;left:0;right:0;top:110px;text-align:center;font:700 16px sans-serif;color:#d0306a;z-index:99999'; c.closest('dialog').append(t);}, [V[k], L[k]]);
  await p.waitForTimeout(600); await p.screenshot({path:`${out}/${k}.png`}); await p.keyboard.press('Escape'); await p.waitForTimeout(500); }
 await b.close(); })();
