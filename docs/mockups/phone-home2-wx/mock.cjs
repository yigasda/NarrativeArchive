const { open } = require('/home/user/NarrativeArchive/tools/dev/probe.cjs');
const CL = 'M7 17a4 4 0 0 1 .5-8A5.5 5.5 0 0 1 18 11a3 3 0 0 1-.5 6zM15 4.5a3 3 0 0 1 3.5 2.5';
const ico = (s, c, w = 1.8) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"><path d="${CL}"/></svg>`;
const gel = (s, r) => `<span style="width:${s}px;height:${s}px;border-radius:${r}px;display:flex;align-items:center;justify-content:center;flex:none;background:linear-gradient(180deg,#cbe5f4d9,#8cc3e3d9);box-shadow:inset 0 1.5px 1px rgba(255,255,255,.8),inset 0 -3px 6px rgba(40,40,60,.14),0 1px 1px rgba(40,50,70,.08),0 8px 20px rgba(40,50,70,.16)">${ico(s*0.5,'#fff',2)}</span>`;
const pill = (t, dark) => `<span style="display:inline-flex;align-items:center;gap:4px;height:30px;padding:0 14px;border-radius:999px;font-size:13px;font-weight:600;${dark ? 'background:#2a313b;color:#fff;box-shadow:inset 0 1px 0 rgba(255,255,255,.18),0 4px 12px rgba(22,27,34,.18)' : 'background:rgba(255,255,255,.6);color:#2a313b;box-shadow:inset 0 1px 0 #fff,0 2px 6px rgba(40,50,70,.08)'}">${t}</span>`;
const card = (inner, extra = '') => `<button type="button" class="cg_glass cg_wcal cg_wwal" style="grid-column:1/-1;height:150px;min-height:150px;${extra}">${inner}</button>`;
const V = {
 A: card(`<span class="cg_wh"><span class="cg_cap">날씨</span><span class="cg_evw">현재 위치</span></span>
   <span style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px">${ico(34,'#8a929d',1.6)}
   <span style="font-size:14px;font-weight:600;color:#3a4250">아직 날씨가 없어요</span><span style="font-size:12px;color:#7a828e">눌러서 채우기</span></span>`),
 B: card(`<span style="display:flex;align-items:center;gap:14px;height:100%">${gel(62,18)}
   <span style="flex:1;min-width:0;display:flex;flex-direction:column;gap:4px;text-align:left"><span class="cg_cap">날씨</span>
   <span style="font-size:17px;font-weight:600;color:#1f252e;letter-spacing:-.01em">지금 있는 곳의 날씨</span><span style="font-size:12.5px;color:#7a828e">채우면 하늘이 여기 떠요</span></span>
   ${pill('채우기', true)}</span>`),
 C: `<button type="button" class="cg_wcal cg_wwal" style="grid-column:1/-1;height:150px;min-height:150px;background:rgba(255,255,255,.14)!important;border:1.5px dashed rgba(90,100,115,.38)!important;box-shadow:none!important;align-items:center;justify-content:center;gap:10px">
   <span style="width:44px;height:44px;border-radius:999px;display:flex;align-items:center;justify-content:center;background:rgba(255,255,255,.7);box-shadow:inset 0 1px 0 #fff,0 4px 12px rgba(40,50,70,.1)"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#3a4250" stroke-width="2.2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg></span>
   <span style="font-size:14px;font-weight:600;color:#3a4250">날씨 위젯 채우기</span></button>`,
 D: card(`<span class="cg_wh"><span style="display:flex;align-items:center;gap:6px">${ico(16,'#59616d',2)}<span class="cg_cap">날씨</span></span>${pill('눌러서 채우기', false)}</span>
   <span style="display:flex;align-items:flex-end;justify-content:space-between;margin-top:10px"><span style="text-align:left"><span style="display:block;font-size:15px;font-weight:600;color:#9aa1ab">현재 위치</span><span style="display:block;font-size:12px;color:#a7adb6;margin-top:2px">최고 --° 최저 --°</span></span>${ico(40,'#c0c5cc',1.4)}</span>
   <span style="flex:1"></span><span style="display:flex;justify-content:space-between;color:#b4bac2;font-size:11px" class="cg_num">${['지금','18시','19시','20시','21시','22시'].map(h=>`<span style="display:flex;flex-direction:column;align-items:center;gap:3px"><span>${h}</span><span style="width:16px;height:2px;border-radius:2px;background:#c6cbd2;margin:5px 0"></span><span>--</span></span>`).join('')}</span>`, 'height:196px;min-height:196px'),
};
const L = { A: 'A. 유리 카드 · 가운데 구름', B: 'B. 젤 아이콘 + 채우기 버튼', C: 'C. 점선 빈 자리 (+)', D: 'D. 빈 날씨 틀 (회색 자리)' };
(async()=>{ const out=process.argv[2]; for (const th of ['light']) { const s=await open(th,{out});
 for (const k of Object.keys(V)) { await s.to('home2'); await s.p.evaluate(([h,l])=>{const w=document.querySelector('.na_ph_frame .cg_widgets'); w.innerHTML=h;
   const tag=document.createElement('div'); tag.textContent=l; tag.style.cssText='position:absolute;left:0;right:0;top:640px;text-align:center;font:700 15px sans-serif;color:#d0306a;z-index:99'; document.querySelector('.na_ph_frame .na_ph_scr').append(tag);}, [V[k], L[k]]); await s.p.waitForTimeout(300); await s.shot(k); }
 console.log(s.errors()); await s.close(); } })();
