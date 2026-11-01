const { open } = require('/home/user/NarrativeArchive/tools/dev/probe.cjs');
const P = '.na_ph_frame .pcf';
const glassEdge = `${P}_card, ${P}_no { position: relative; }
${P}_card::before, ${P}_no::before { content: ""; position: absolute; inset: 0; border-radius: inherit; padding: 1px; background: linear-gradient(170deg, rgba(255,255,255,1), rgba(255,255,255,.4) 40%, rgba(255,255,255,.15) 70%, rgba(255,255,255,.6)); -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0); -webkit-mask-composite: xor; mask-composite: exclude; pointer-events: none; }`;
const ICON = (c) => `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' width='22' height='22' viewBox='0 0 24 24' fill='none' stroke='${c}' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><path d='M12 3l9.5 16.5h-19z'/><path d='M12 10v4M12 17.2v.1'/></svg>`)}")`;
const V = {
 A: `${P} { background: rgba(15,20,28,.34); padding: 0 10px 30px; }
  ${P}_box { gap: 10px; }
  ${P}_card { border-radius: 20px; background: #f6f6f9; box-shadow: inset 0 1.5px 1px rgba(255,255,255,.95), 0 1px 2px rgba(22,27,34,.06), 0 14px 34px rgba(22,27,34,.18); }
  ${P}_no { border-radius: 20px; background: #fff; box-shadow: inset 0 1.5px 1px #fff, 0 1px 2px rgba(22,27,34,.06), 0 12px 28px rgba(22,27,34,.16); }
  ${P}_msg { padding: 16px 22px 14px; } ${P}_msg b { color: #59616d; } ${P}_msg span { color: #7a828e; }
  ${P}_ok { border-top-color: rgba(60,60,67,.16); } ${glassEdge}`,
 B: `${P} { background: rgba(15,20,28,.34); padding: 0 10px 30px; }
  ${P}_box { gap: 10px; }
  ${P}_card { border-radius: 22px; background: #f6f6f9; box-shadow: inset 0 1.5px 1px rgba(255,255,255,.95), 0 1px 2px rgba(22,27,34,.06), 0 14px 34px rgba(22,27,34,.18); }
  ${P}_no { border-radius: 22px; background: #fff; box-shadow: inset 0 1.5px 1px #fff, 0 1px 2px rgba(22,27,34,.06), 0 12px 28px rgba(22,27,34,.16); }
  ${P}_msg { padding: 20px 22px 16px; gap: 5px; align-items: center; }
  ${P}_msg::before { content: ""; width: 44px; height: 44px; margin-bottom: 6px; border-radius: 999px; background: ${ICON('#b8573a')} center/22px no-repeat, #f7e1dc; box-shadow: inset 0 1px 0 rgba(255,255,255,.7), 0 4px 10px rgba(184,87,58,.16); }
  ${P}_msg b { font-size: 15px; color: #1f252e; } ${P}_msg span { font-size: 13px; color: #7a828e; }
  ${P}_ok { border-top-color: rgba(60,60,67,.16); font-weight: 600; } ${glassEdge}`,
 C: `${P} { background: rgba(10,12,16,.4); padding: 0 10px 30px; }
  ${P}_box { gap: 10px; }
  ${P}_card { border-radius: 20px; background: #2a2c32; backdrop-filter: blur(30px) saturate(150%); box-shadow: inset 0 1px 0 rgba(255,255,255,.14), 0 14px 34px rgba(0,0,0,.3); }
  ${P}_no { border-radius: 20px; background: #383a41; color: #fff; box-shadow: inset 0 1px 0 rgba(255,255,255,.16), 0 12px 28px rgba(0,0,0,.28); }
  ${P}_msg b { color: rgba(255,255,255,.62); } ${P}_msg span { color: rgba(255,255,255,.5); }
  ${P}_ok { border-top-color: rgba(255,255,255,.1); color: #ff7a6b; }`,
 D: `${P} { background: rgba(15,20,28,.34); padding: 0 10px 30px; }
  ${P}_box { gap: 0; border-radius: 26px; background: #f6f6f9; backdrop-filter: blur(30px) saturate(160%); -webkit-backdrop-filter: blur(30px) saturate(160%); box-shadow: inset 0 1.5px 1px rgba(255,255,255,.95), 0 1px 2px rgba(22,27,34,.06), 0 16px 40px rgba(22,27,34,.2); padding: 8px 12px 12px; }
  ${P}_box::before { content: ""; width: 36px; height: 5px; border-radius: 3px; background: rgba(60,60,67,.18); margin: 0 auto 6px; }
  ${P}_card { background: none; backdrop-filter: none; -webkit-backdrop-filter: none; }
  ${P}_msg b { color: #1f252e; font-size: 15px; } ${P}_msg span { color: #7a828e; }
  ${P}_ok { border: 0; height: 52px; margin-top: 6px; border-radius: 16px; background: #c4553f; color: #fff; font-size: 17px; font-weight: 600; box-shadow: inset 0 1px 0 rgba(255,255,255,.2), 0 6px 16px rgba(196,85,63,.28); }
  ${P}_no { height: 50px; margin-top: 8px; border-radius: 16px; background: #fff; font-size: 17px; box-shadow: inset 0 1px 0 #fff, 0 1px 2px rgba(22,27,34,.06); }`,
};
const L = { A: 'A. 유리 테두리 + 두 겹 그림자', B: 'B. A + 경고 아이콘 · 진한 제목', C: 'C. 어두운 유리', D: 'D. 한 장 시트 + 꽉 찬 버튼' };
(async()=>{ const out=process.argv[2]; const s=await open('light',{out}); const p=s.p;
 for (const k of Object.keys(V)) { await s.to('set'); await s.scroll(); await p.click('.na_ph_storyreset'); await p.waitForSelector('.na_ph_frame .pcf');
  await p.evaluate(([css,l])=>{document.getElementById('qcss')?.remove(); const st=document.createElement('style'); st.id='qcss'; st.textContent=css; document.head.append(st);
   const t=document.createElement('div'); t.textContent=l; t.style.cssText='position:absolute;left:0;right:0;top:58px;text-align:center;font:700 15px sans-serif;color:#d0306a;z-index:99'; document.querySelector('.na_ph_frame .cg_canvas').append(t);}, [V[k], L[k]]);
  await p.waitForTimeout(700); await s.shot(k); await p.click('.na_ph_frame .pcf_no'); await p.waitForTimeout(300); }
 console.log(s.errors()); await s.close(); })();
