const { chromium } = require('playwright'); const fs=require('fs');
(async()=>{ const b=await chromium.launch(); const p=await b.newPage({viewport:{width:900,height:940},deviceScaleFactor:2});
 await p.goto('http://127.0.0.1:8000/'); await p.waitForFunction(()=>window.SillyTavern?.getContext?.().characters?.length>0,null,{timeout:60000}); await p.waitForTimeout(2000);
 await p.evaluate(h=>{document.body.classList.remove('na_darkui'); const d=document.createElement('dialog'); d.style.cssText='margin:0;padding:0;border:0;max-width:none;max-height:none;width:100vw;height:100vh;background:#141210'; d.innerHTML=h; document.body.append(d); d.showModal(); document.activeElement && document.activeElement.blur();}, fs.readFileSync(process.argv[2],'utf8'));
 await p.waitForTimeout(800); await p.screenshot({path:process.argv[3]}); await b.close(); })();
