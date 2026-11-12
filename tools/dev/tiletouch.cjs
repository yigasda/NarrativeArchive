// 타일 지도 화면을 손가락으로: 지도 자리를 쓸면 지도만 움직이는지, 시트를 끌어내리면 따라 내려가 끝까지 붙고 목록 버튼이 뜨는지,
// 목록 버튼으로 돌아오는지, 시트를 올리면 목록이 스크롤되는지
//   (tilephone.cjs와 같은 준비) node tools/dev/tiletouch.cjs <찍을 폴더>
const { open } = require('./probe.cjs');
const { route } = require('./faketiles.cjs');
(async () => { const s = await open('light', { out: process.argv[2] }); const p = s.p;
  await route(p, [(process.env.OSM_DIR || '/tmp/osm') + '/frankfurt-altstadt.json']);
  const cdp = await p.context().newCDPSession(p); await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 2 });
  const drag = async (x, y0, y1) => { await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y: y0 }] }); for (let i = 1; i <= 12; i++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: y0 + (y1 - y0) * i / 12 }] }); await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await p.waitForTimeout(900); };
  await s.run(async ({ ph }) => { ph.visits = Array.from({ length: 9 }, (_, i) => ({ place: `Ort ${i + 1}`, city: 'Frankfurt', time: `10-${10 + i} 11:00` })); });
  await s.to('map'); await p.waitForTimeout(5000);
  const st = () => p.evaluate(() => { const sc = document.querySelector('.na_ph_frame .mp_wx > .ax_scroll'), sh = document.querySelector('.na_ph_frame .mp_sheet').getBoundingClientRect(); return { top: Math.round(sc.scrollTop), sheetY: Math.round(sh.top), low: !!document.querySelector('.na_ph_frame .mp_low') }; });
  const center = () => p.evaluate(async () => JSON.stringify((await import('/scripts/extensions/third-party/NarrativeArchive/src/phonetilemap.js')).tileCenter()));
  const a = await st(), box = await p.evaluate(() => { const r = document.querySelector('.na_ph_frame .mp_sheet').getBoundingClientRect(), f = document.querySelector('.na_ph_frame .mp_bg').getBoundingClientRect(); return { x: r.left + r.width / 2, sy: r.top + 60, my: f.top + 200 }; });
  const m0 = await center(); await drag(box.x, box.my, box.my + 120); const c = await st(), m1 = await center();   // the map above the sheet
  // the sheet pulled down with a finger: it follows, then rests all the way down (the pill comes), then the pill brings it back
  const mid = []; await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: box.x, y: box.sy }] });
  for (let i = 1; i <= 16; i++) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: box.x, y: box.sy + 400 * i / 16 }] }); if (i === 8) mid.push(await st()); }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await p.waitForTimeout(1500);
  const down = await st(), pill = await p.evaluate(() => !!document.querySelector('.na_ph_frame .mp_up')); await s.shot('touch_down');
  await p.evaluate(() => document.querySelector('.na_ph_frame .mp_up')?.click()); await p.waitForTimeout(1500); const back = await st();
  await drag(box.x, box.sy + 200, box.sy - 100); const b = await st();            // then the sheet up: the list scrolls
  console.log(JSON.stringify({ before: a, afterMapSwipe: c, mapMoved: m0 !== m1, halfway: mid[0], down, pill, back, afterSheetSwipe: b,
    ok: c.top === a.top && m0 !== m1 && mid[0].sheetY > a.sheetY && down.top < 24 && pill && Math.abs(back.top - a.top) < 4 && b.top > back.top }));
  await s.shot('touch'); await s.close(); })().catch(e => { console.error(String(e).slice(0, 400)); process.exit(1); });
