const { open } = require('/home/user/NarrativeArchive/tools/dev/probe.cjs');
const T = '이 방의 폰을 새로 시작할까요?', B = '이 방의 모든 인물의 휴대폰 · 계좌 · 투자 · 재력 기준을 초기화해요. 아카이브와 다른 채팅방은 그대로예요.';
const SYS = "font-family:-apple-system,'SF Pro Text','Noto Sans KR',sans-serif;";
const dim = (inner, a = .32, align = 'center') => `<div style="position:absolute;inset:0;z-index:60;background:rgba(15,20,28,${a});display:flex;flex-direction:column;justify-content:${align};align-items:center;${SYS}">${inner}</div>`;
const warn = (s, c) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l9.5 16.5h-19z"/><path d="M12 10v4M12 17.2v.1"/></svg>`;
const redo = (s, c) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 12a8 8 0 1 1-2.3-5.6M20 4v5h-5"/></svg>`;
const V = {
 // A: iOS alert — small frosted card, centered text, two side-by-side text buttons with hairlines
 A: dim(`<div style="width:270px;border-radius:14px;overflow:hidden;background:rgba(242,242,245,.86);backdrop-filter:blur(30px) saturate(160%);-webkit-backdrop-filter:blur(30px) saturate(160%);box-shadow:0 20px 50px rgba(0,0,0,.22)">
   <div style="padding:20px 16px 18px;text-align:center"><div style="font-size:17px;font-weight:600;color:#000;letter-spacing:-.01em">${T}</div>
   <div style="margin-top:5px;font-size:13px;line-height:1.4;color:#1c1c1e">${B}</div></div>
   <div style="display:flex;border-top:.5px solid rgba(60,60,67,.29)"><div style="flex:1;height:44px;display:flex;align-items:center;justify-content:center;font-size:17px;color:#2c4a80">취소</div>
   <div style="width:.5px;background:rgba(60,60,67,.29)"></div><div style="flex:1;height:44px;display:flex;align-items:center;justify-content:center;font-size:17px;font-weight:600;color:#d0453a">새로 시작</div></div></div>`, .28),
 // B: iOS action sheet — slides up from the bottom, message + red action, separate cancel
 B: dim(`<div style="width:calc(100% - 16px);margin-bottom:34px;display:flex;flex-direction:column;gap:8px">
   <div style="border-radius:14px;overflow:hidden;background:rgba(242,242,245,.88);backdrop-filter:blur(30px) saturate(160%);-webkit-backdrop-filter:blur(30px) saturate(160%)">
   <div style="padding:14px 18px 13px;text-align:center"><div style="font-size:13px;font-weight:600;color:#8a8a8e">${T}</div><div style="margin-top:4px;font-size:13px;line-height:1.38;color:#8a8a8e">${B}</div></div>
   <div style="border-top:.5px solid rgba(60,60,67,.29);height:57px;display:flex;align-items:center;justify-content:center;font-size:20px;color:#d0453a">새로 시작</div></div>
   <div style="border-radius:14px;background:rgba(255,255,255,.96);height:57px;display:flex;align-items:center;justify-content:center;font-size:20px;font-weight:600;color:#2c4a80;box-shadow:0 1px 2px rgba(22,27,34,.05)">취소</div></div>`, .3, 'flex-end'),
 // C: bottom sheet — white rounded sheet with a soft icon tile, left-aligned text, two full-width buttons (bank-app feel)
 C: dim(`<div style="width:100%;border-radius:26px 26px 0 0;background:#fff;padding:12px 20px 40px;box-sizing:border-box;box-shadow:0 -8px 30px rgba(22,27,34,.14)">
   <div style="width:36px;height:5px;border-radius:3px;background:#dfe2e7;margin:0 auto 20px"></div>
   <div style="width:48px;height:48px;border-radius:14px;background:#f7e1dc;display:flex;align-items:center;justify-content:center">${redo(24,'#b8573a')}</div>
   <div style="margin-top:14px;font-size:20px;font-weight:700;color:#161b22;letter-spacing:-.02em">${T}</div>
   <div style="margin-top:8px;font-size:14.5px;line-height:1.5;color:#59616d">${B}</div>
   <div style="margin-top:24px;display:flex;gap:10px"><div style="flex:1;height:52px;border-radius:14px;background:#eef0f3;display:flex;align-items:center;justify-content:center;font-size:15.5px;font-weight:600;color:#3a4250">취소</div>
   <div style="flex:1.4;height:52px;border-radius:14px;background:#b8573a;display:flex;align-items:center;justify-content:center;font-size:15.5px;font-weight:600;color:#fff;box-shadow:inset 0 1px 0 rgba(255,255,255,.18),0 6px 16px rgba(184,87,58,.28)">새로 시작</div></div></div>`, .3, 'flex-end'),
 // D: centered card, warning tile on top, stacked full-width buttons (destructive first)
 D: dim(`<div style="width:300px;border-radius:24px;background:#fff;padding:24px 20px 16px;box-sizing:border-box;text-align:center;box-shadow:0 1px 2px rgba(22,27,34,.05),0 20px 50px rgba(22,27,34,.22)">
   <div style="width:52px;height:52px;margin:0 auto;border-radius:999px;background:#f7e1dc;display:flex;align-items:center;justify-content:center">${warn(24,'#b8573a')}</div>
   <div style="margin-top:14px;font-size:17px;font-weight:700;color:#161b22;letter-spacing:-.01em">${T}</div>
   <div style="margin-top:8px;font-size:13.5px;line-height:1.5;color:#59616d">${B}</div>
   <div style="margin-top:20px;height:48px;border-radius:14px;background:#1d3461;display:flex;align-items:center;justify-content:center;font-size:15px;font-weight:600;color:#fff;box-shadow:inset 0 1px 0 rgba(255,255,255,.18),0 6px 16px rgba(29,52,97,.25)">새로 시작</div>
   <div style="margin-top:6px;height:44px;display:flex;align-items:center;justify-content:center;font-size:15px;font-weight:600;color:#59616d">취소</div></div>`, .34),
};
const L = { A: 'A. iOS 알림', B: 'B. 아래 액션 시트', C: 'C. 바텀 시트 + 버튼 두 개', D: 'D. 가운데 카드 + 세로 버튼' };
(async()=>{ const out=process.argv[2]; const s=await open('light',{out});
 for (const k of Object.keys(V)) { await s.to('set'); await s.scroll(); await s.p.evaluate(([h,l])=>{const sc=document.querySelector('.na_ph_frame .na_ph_scr'); sc.style.position='relative'; sc.insertAdjacentHTML('beforeend',h);
   const tag=document.createElement('div'); tag.textContent=l; tag.style.cssText='position:absolute;left:0;right:0;top:58px;text-align:center;font:700 15px sans-serif;color:#d0306a;z-index:99'; sc.append(tag);}, [V[k], L[k]]); await s.p.waitForTimeout(300); await s.shot(k); }
 console.log(s.errors()); await s.close(); })();
