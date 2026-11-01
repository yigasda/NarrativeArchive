const { chromium } = require('playwright');
const B = '/scripts/extensions/third-party/NarrativeArchive/src/';
const D = 'dialog.popup:has(.na_confirm)';
const BX = `body:is(.na_darkui, :not(.na_darkui)) ${D}:not(#na_x)`;
const ICON = c => `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='${c}' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><path d='M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 8v5M12 16.2v.1'/></svg>`)}")`;
const base = `body:not(.na_darkui) ${D} { --na-accent: #B8541F; --na-card: #F7EEE7; --na-card2: #F1E6DD; --na-ink: #463428; --na-mute: #6B5A50; --na-line: #E5D5C9; }
 ${BX} { border: 0 !important; box-shadow: 0 1px 2px rgba(70,52,40,.06), 0 24px 60px rgba(70,52,40,.28) !important; }
 ${D} .na_v2_title b { font-size: 19px; font-weight: 700; letter-spacing: -.02em; color: var(--na-ink); }
 ${D} .na_confirm_text { font-size: 14px; line-height: 1.55; color: var(--na-sub); margin-top: 6px; }
 ${D} .na_confirm > br { display: none; }
 ${D} .na_confirm label { display: flex !important; align-items: center; gap: 12px; cursor: pointer; }
 ${D} .na_confirm label input { appearance: none; -webkit-appearance: none; width: 20px; height: 20px; margin: 0; flex: none; border-radius: 999px; border: 2px solid var(--na-line); background: var(--na-card) !important; box-shadow: none !important; }
 ${D} .na_confirm label input:checked { border: 6px solid var(--na-accent); }
 ${BX} .popup-controls { display: flex !important; gap: 8px; }
 ${BX} .popup-controls.popup-controls .popup-button-cancel.popup-button-cancel { order: -1; }
 ${BX} .popup-controls.popup-controls .menu_button.menu_button { border-radius: 999px !important; font-weight: 600; font-size: 15px; min-height: 46px; display: flex; align-items: center; justify-content: center; margin: 0 !important; filter: none !important; opacity: 1 !important; }
 ${BX} .popup-controls.popup-controls .popup-button-ok.popup-button-ok { background: var(--na-accent) !important; border-color: var(--na-accent) !important; color: #fff !important; box-shadow: inset 0 1px 0 rgba(255,255,255,.2), 0 6px 16px rgba(184,84,31,.25) !important; }`;
const V = {
 A: base + `
 ${BX} { border-radius: 22px !important; padding: 22px 20px 16px !important; }
 ${D} .na_confirm label { padding: 14px 14px; margin-top: 8px; border-radius: 14px; background: var(--na-card); border: 1.5px solid transparent; font-size: 15px; font-weight: 600; }
 ${D} .na_confirm label:has(input:checked) { border-color: var(--na-accent); background: var(--na-accent-soft); color: var(--na-accent-ink); }
 ${D} .na_confirm label:first-of-type { margin-top: 16px; }
 ${BX} .popup-controls { justify-content: flex-end; margin-top: 18px; }
 ${BX} .popup-controls.popup-controls .menu_button.menu_button { padding: 0 22px !important; min-width: 0 !important; }
 ${BX} .popup-controls.popup-controls .popup-button-cancel.popup-button-cancel { background: transparent !important; border-color: transparent !important; color: var(--na-mute) !important; }`,
 B: base + `
 ${BX} { border-radius: 26px !important; padding: 26px 22px 18px !important; text-align: center; }
 ${D} .na_confirm::before { content: ""; display: block; width: 52px; height: 52px; margin: 0 auto 14px; border-radius: 999px; background: ${ICON('#B8541F')} center/26px no-repeat, var(--na-accent-soft); }
 ${D} .na_confirm_text { text-align: center; }
 ${D} .na_confirm { display: flex; flex-direction: column; align-items: stretch; }
 ${D} .na_confirm label { justify-content: center; padding: 12px; margin-top: 8px; border-radius: 999px; background: var(--na-card); font-size: 14.5px; font-weight: 600; color: var(--na-mute); }
 ${D} .na_confirm label input { display: none; }
 ${D} .na_confirm label:has(input:checked) { background: var(--na-fill); color: var(--na-onfill); }
 ${D} .na_confirm label:first-of-type { margin-top: 16px; }
 ${BX} .popup-controls { margin-top: 20px; width: 100%; }
 ${BX} .popup-controls.popup-controls .menu_button.menu_button { flex: 1 1 0 !important; width: auto !important; max-width: none !important; }
 ${BX} .popup-controls.popup-controls .popup-button-cancel.popup-button-cancel { background: var(--na-card) !important; border-color: var(--na-line) !important; color: var(--na-ink) !important; }`,
 C: base + `
 ${BX} { border-radius: 20px !important; padding: 0 !important; overflow: hidden; }
 ${BX} .popup-body { padding: 0 !important; }
 ${D} .na_v2_title { padding: 18px 20px 14px; background: var(--na-card2); border-bottom: 1px solid var(--na-line); }
 ${D} .na_confirm_text { padding: 16px 20px 4px; margin: 0; }
 ${D} .na_confirm label { margin: 10px 16px 0; padding: 14px 16px; border-radius: 14px; background: var(--na-card); flex-direction: row-reverse; justify-content: space-between; font-size: 15px; font-weight: 600; box-shadow: 0 1px 2px rgba(70,52,40,.05); }
 ${D} .na_confirm label:first-of-type { margin-top: 14px; border-radius: 14px 14px 0 0; }
 ${D} .na_confirm label:last-of-type { margin-top: 0; border-radius: 0 0 14px 14px; border-top: 1px solid var(--na-line2); }
 ${BX} .popup-controls { padding: 16px 20px 18px; margin-top: 14px; border-top: 1px dashed var(--na-line); justify-content: flex-end; }
 ${BX} .popup-controls.popup-controls .menu_button.menu_button { padding: 0 22px !important; border-radius: 12px !important; }
 ${BX} .popup-controls.popup-controls .popup-button-cancel.popup-button-cancel { background: var(--na-card) !important; color: var(--na-ink) !important; }`,
 D: base + `
 ${BX} { position: fixed !important; inset: auto 0 0 0 !important; margin: 0 !important; width: 100% !important; max-width: 100% !important; border-radius: 26px 26px 0 0 !important; padding: 10px 20px 26px !important; }
 ${D} .na_confirm::before { content: ""; display: block; width: 38px; height: 5px; border-radius: 3px; background: var(--na-line); margin: 0 auto 18px; }
 ${D} .na_confirm label { padding: 14px 16px; margin-top: 8px; border-radius: 16px; background: var(--na-card); border: 1.5px solid transparent; font-size: 15px; font-weight: 600; }
 ${D} .na_confirm label:has(input:checked) { border-color: var(--na-accent); background: var(--na-accent-soft); color: var(--na-accent-ink); }
 ${D} .na_confirm label:first-of-type { margin-top: 16px; }
 ${BX} .popup-controls { flex-direction: column; align-items: stretch !important; margin-top: 18px; }
 ${BX} .popup-controls.popup-controls .popup-button-cancel.popup-button-cancel { order: 1; background: transparent !important; border-color: transparent !important; color: var(--na-mute) !important; }
 ${BX} .popup-controls.popup-controls .menu_button.menu_button { width: 100% !important; max-width: none !important; min-height: 50px; align-self: stretch !important; flex: none !important; box-sizing: border-box; }
 ${BX} .popup-controls.popup-controls { width: 100% !important; }`,
};
const L = { A: 'A. 크림 카드 · 오른쪽 버튼', B: 'B. 아이콘 머리 · 가운데', C: 'C. 머리 띠 + 목록', D: 'D. 아래 시트' };
(async()=>{ const out=process.argv[2], theme=process.argv[3]||'light'; const b=await chromium.launch(); const p=await b.newPage({viewport:{width:412,height:860},deviceScaleFactor:2});
 await p.goto('http://127.0.0.1:8000/'); await p.waitForFunction(()=>window.SillyTavern?.getContext?.().characters?.length>0,null,{timeout:60000}); await p.waitForTimeout(2500);
 await p.evaluate(t=>document.body.classList.toggle('na_darkui',t==='dark'), theme);
 for (const k of Object.keys(V)) {
  await p.evaluate(([css,l])=>{document.getElementById('xcss')?.remove(); const st=document.createElement('style'); st.id='xcss'; st.textContent=css; document.head.append(st); window.__l=l;}, [V[k], L[k]]);
  for (const kind of ['choice','plain']) {
   p.evaluate(async([B,kind])=>{ if(kind==='choice') (await import(B+'phonestory.js')).choosePhoneStory({}); else (await import(B+'util.js')).confirm('이 섹션을 지울까요?','지운 섹션은 되돌릴 수 없어요.','지우기'); },[B,kind]);
   await p.waitForSelector('dialog.popup .na_confirm'); await p.waitForTimeout(600);
   await p.evaluate(()=>{const t=document.createElement('div'); t.textContent=window.__l; t.style.cssText='position:fixed;left:0;right:0;top:12px;text-align:center;font:700 16px sans-serif;color:#d0306a;z-index:99999'; document.querySelector('dialog.popup[open]:has(.na_confirm)').append(t);});
   await p.screenshot({path:`${out}/${k}_${kind}.png`}); await p.keyboard.press('Escape'); await p.waitForTimeout(500);
  } }
 await b.close(); })();
