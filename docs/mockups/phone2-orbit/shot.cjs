// node shot.cjs → sheet.jpg: 큰 아이콘 A~D + 실제 폰 홈 1쪽에 끼운 모습(9번째 칸)
const { open } = require('../../../tools/dev/probe.cjs'); const { chromium } = require('playwright');
const { ORBIT, CSS, orbitIcon } = require('./icons.js'); const path = require('path'), fs = require('fs');
const OUT = __dirname, TMP = fs.mkdtempSync('/tmp/claude-0/orb');
const NAME = { A: '1 유리 고리 · 진주 점', B: '2 진주빛 고리 · 민트 구슬', C: '3 입체 고리 · 자두 구슬', D: '4 빛 꼬리 · 빛나는 점' };
(async () => {
  const s = await open('light', { out: TMP });
  await s.to('home');
  const shots = [];
  for (const v of Object.keys(ORBIT)) {
    await s.p.evaluate(([CSS, html]) => {
      if (!document.getElementById('ob_css')) { const st = document.createElement('style'); st.id = 'ob_css'; st.textContent = CSS; document.head.append(st); }
      document.querySelectorAll('.ob_cell').forEach(e => e.remove());
      const g = document.querySelector('.na_ph_frame .cg_grid'), lab = g.querySelector('.cg_cell span:last-child, .cg_cell small, .cg_cell .cg_lab');
      const c = document.createElement('div'); c.className = 'cg_cell ob_cell';
      c.innerHTML = html + (lab ? `<${lab.tagName.toLowerCase()} class="${lab.className}">Orbit</${lab.tagName.toLowerCase()}>` : '<span>Orbit</span>');
      g.append(c);
    }, [CSS, orbitIcon(v)]);
    await s.p.waitForTimeout(250); shots.push(await s.shot('home_' + v));
  }
  await s.close();
  // 한 장: 위에 큰 아이콘, 아래 실제 홈
  const b = await chromium.launch(), p = await b.newPage({ deviceScaleFactor: 1 });
  const big = Object.keys(ORBIT).map(v => `<div class="col"><h2>${NAME[v]}</h2><div class="bigs">${orbitIcon(v, 132)}${orbitIcon(v, 62)}${orbitIcon(v, 40)}</div><img src="data:image/png;base64,${fs.readFileSync(shots[Object.keys(ORBIT).indexOf(v)]).toString('base64')}"></div>`).join('');
  await p.setContent(`<html><head><style>${CSS}body{margin:0;padding:26px;background:#d9dbe0;font-family:-apple-system,'Noto Sans KR',sans-serif;width:max-content}.row{display:flex;gap:26px}.col{width:412px}h2{font-size:22px;margin:0 0 14px}.bigs{display:flex;gap:18px;align-items:flex-end;margin-bottom:18px}img{width:412px;display:block;border-radius:24px}</style></head><body><div class="row">${big}</div></body></html>`);
  await p.waitForTimeout(500);
  await p.screenshot({ path: path.join(OUT, 'sheet.jpg'), fullPage: true, type: 'jpeg', quality: 88 });
  await b.close(); console.log('ok');
})().catch(e => { console.error(e); process.exit(1); });
