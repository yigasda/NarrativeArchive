// 타일 지도를 실제 폰(로컬 SillyTavern)에서 가짜 타일로 찍어요: 지도 · 핀 · 시트 끌어내리기 · 다시 올리기 · 출처. OSM_DIR에 frankfurt-altstadt.json · frankfurt-bankenviertel.json(osm-data의 zip을 푼 것)
//   OSM_DIR=… TILE_GLYPHS=… NODE_PATH=/tmp/tiles/node_modules:$NODE_PATH node tools/dev/tilephone.cjs <찍을 폴더>   (faketiles.cjs 머리말 참고)
const { open } = require('./probe.cjs');
const { route } = require('./faketiles.cjs');
(async () => { const out = process.argv[2]; const s = await open('light', { out }); const p = s.p;
  await route(p, [(process.env.OSM_DIR || '/tmp/osm') + '/frankfurt-altstadt.json', (process.env.OSM_DIR || '/tmp/osm') + '/frankfurt-bankenviertel.json']);
  const logs = []; p.on('console', m => { if (/error|warn/i.test(m.type())) logs.push(m.text().slice(0, 160)); });
  await s.run(async ({ ph }) => { ph.visits = [{ place: 'Städel Museum', city: 'Frankfurt', time: '10-25 11:00', with: ['Ivo'] }, { place: 'Café am Fluss', city: 'Frankfurt', time: '10-24 16:10', with: ['Ren'] }, { place: 'Hauptbahnhof', city: 'Frankfurt', time: '10-23 09:00' }]; });
  await s.to('map'); await p.waitForTimeout(6000);
  const st = await p.evaluate(() => ({ tiled: !!document.querySelector('.na_ph_frame .mp_bg.mp_tiled'), tile: !!document.querySelector('.na_ph_frame .mp_tile canvas'), credit: getComputedStyle(document.querySelector('.na_ph_frame .mp_credit')).display }));
  await s.shot('tile_map');
  // pull the sheet down
  const sh = await p.evaluate(() => { const r = document.querySelector('.na_ph_frame .mp_sheet').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + 30 }; });
  await p.mouse.move(sh.x, sh.y); await p.mouse.down(); await p.mouse.move(sh.x, sh.y + 120, { steps: 6 }); await p.mouse.up(); await p.waitForTimeout(1500);
  const low = await p.evaluate(() => !!document.querySelector('.na_ph_frame .mp_wx.mp_low')); await s.shot('tile_low');
  const pill = await p.evaluate(() => document.querySelector('.na_ph_frame .mp_up')?.textContent || ''); await p.click('.na_ph_frame .mp_up'); await p.waitForTimeout(1200);
  const back = await p.evaluate(() => !document.querySelector('.na_ph_frame .mp_wx.mp_low')); await s.shot('tile_back');
  console.log(JSON.stringify({ st, low, pill, back }), JSON.stringify(s.errors()).slice(0, 300), logs.slice(0, 5)); await s.close(); })().catch(e => { console.error(String(e).slice(0, 500)); process.exit(1); });
