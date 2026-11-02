const { chromium } = require('playwright'); const fs = require('fs');
const calls = JSON.parse(fs.readFileSync(process.argv[3]));
(async()=>{ const out=process.argv[2]; const b=await chromium.launch(); const p=await b.newPage({viewport:{width:412,height:860},deviceScaleFactor:2});
 await p.goto('http://127.0.0.1:8000/'); await p.waitForFunction(()=>window.SillyTavern?.getContext?.().characters?.length>0,null,{timeout:60000}); await p.waitForTimeout(2500);
 await p.evaluate(()=>document.body.classList.remove('na_darkui'));
 let i=0;
 for (const c of calls) { i++;
  const done = p.evaluate(async ({args, loc}) => {
    const util = await import('/scripts/extensions/third-party/NarrativeArchive/src/util.js');
    const esc = util.esc;
    const arr = (n, f) => Array.from({ length: n }, (_, k) => f(k));
    const S = {
      esc, $: window.$, Math, String, Number, JSON, Array,
      timeLabel: () => '오늘 21:40', drLabel: () => 'Claude Sonnet', aiLabel: () => 'Claude Opus', short: x => x, fmt: n => Number(n).toLocaleString(),
      cut: ['#130 요약이 "그리고 그녀는"에서 끝나요', '#131 PLOT 줄이 비었어요'], check: { issues: ['#128 다음이 #131이에요 (#129–#130 빠짐)'] },
      end: 118, m: { boundary: 140, quotes: arr(37, k => k) }, x: { s: { title: '#41–#52 — The flooded road' } },
      b: { fit: { at: 0, reason: '섹션 빼기 전' }, ahead: arr(3, k => k) }, secs: arr(8, k => ({ title: `#${k * 12 + 1}–#${k * 12 + 12} — Scene ${k + 1}` })),
      s: { title: '#13–#25 — The flooded road', at: 0, reason: '압축 전' }, label: 'Seraphina – 다른 채팅', todo: arr(12, k => k), need: 4,
      to: loc.startsWith('panelbind') ? 'Varo' : 140, n: 6, pair: { a: 'Mara', b: 'Ren' }, p: { name: '기본 지시문 사본', id: 'x', text: '' },
      who: 'Mara', covered: 118, from: 101, want: '한국어', pend: { from: 101, to: 140, at: 0 }, name: 'Ombos', w: { name: 'Ombos 신전' },
      items: arr(40, k => k), modeName: '한 번에', sendEst: { tok: 18400, req: 1 }, g: {}, scenes: false, last: 142, rows: [], sceneLines: '', BASIC_PROMPT: '', SHORT_PROMPT: '', effort: '보통',
    };
    window.$ && (window.$.fn = window.$.fn); 
    const scope = new Proxy(S, { has: (t, k) => k in t, get: (t, k) => t[k] });
    // the replace-all box reads its search word from the panel
    if (!document.querySelector('#na_rp_find')) { const i = document.createElement('input'); i.id = 'na_rp_find'; i.value = 'Ivo'; i.style.display = 'none'; document.body.append(i); }
    const a = Function('scope', `with (scope) { return [${args}]; }`)(scope);
    window.__r = util.confirm(...a); return true;
  }, c).catch(e => 'ERR ' + e.message);
  const ok = await done; if (ok !== true) { console.log(c.loc, ok); continue; }
  await p.waitForSelector('dialog.popup[open] .na_confirm', { timeout: 5000 }); await p.waitForTimeout(450);
  const box = await (await p.$('dialog.popup[open]')).boundingBox();
  await p.evaluate(l=>{const t=document.createElement('div'); t.className='__tag'; t.textContent=l; t.style.cssText='position:fixed;left:8px;top:8px;font:700 13px monospace;color:#fff;background:#d0306a;padding:3px 6px;border-radius:6px;z-index:99999'; document.querySelector('dialog.popup[open]').append(t);}, `${String(i).padStart(2,'0')} ${c.loc}`);
  await p.screenshot({ path: `${out}/${String(i).padStart(2,'0')}.png`, clip: { x: 0, y: Math.max(0, box.y - 40), width: 412, height: Math.min(860 - Math.max(0, box.y - 40), box.height + 60) } });
  await p.keyboard.press('Escape'); await p.waitForTimeout(400);
 }
 await b.close(); })();
