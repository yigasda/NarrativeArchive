// 다녀간 곳 지도 시안: 도시 이름으로 정해지는 동네 지도(블록 · 공원 · 강이나 바다 · 큰길), 배달 앱 cityMap과 같은 방식.
// A: 맨 위 지도 하나(가장 최근 도시) · B: 도시마다 작은 지도 하나. 실제 폰의 다녀간 곳 화면에 얹어 찍어요
const { open } = require('/home/user/NarrativeArchive/tools/dev/probe.cjs');
const TOWN = String.raw`
window.townMap = (city, places, W = 332, H = 150) => {
  let sd = [...String(city).toLowerCase()].reduce((n, ch) => (n * 31 + ch.charCodeAt(0)) % 233280, 11);
  const r = () => { sd = (sd * 9301 + 49297) % 233280; return sd / 233280; };
  const hash = s => [...String(s).toLowerCase()].reduce((n, ch) => (n * 33 + ch.charCodeAt(0)) >>> 0, 5381);
  const out = [];
  // the look of this town: block size, how green, which water, and the tilt of its streets
  const cell = 34 + Math.floor(r() * 26), green = 0.08 + r() * 0.2, water = ['river', 'sea', 'none', 'river', 'lake'][Math.floor(r() * 5)], tilt = r() < 0.4 ? (r() * 16 - 8) : 0;
  const cols = Math.ceil(W / cell) + 3, rows = Math.ceil(H / cell) + 3, blocks = [];
  out.push('<g transform="rotate(' + tilt.toFixed(1) + ' ' + W / 2 + ' ' + H / 2 + ')">');
  for (let i = -1; i < cols; i++) for (let j = -1; j < rows; j++) {
    const x0 = i * cell + 5, y0 = j * cell + 5, w = cell - 10, h = cell - 10;
    if (r() < green) { out.push('<rect x="' + x0 + '" y="' + y0 + '" width="' + w + '" height="' + h + '" rx="5" fill="#d7ebcf"/>');
      for (let k = 0; k < 3; k++) out.push('<circle cx="' + (x0 + 6 + r() * (w - 12)).toFixed(0) + '" cy="' + (y0 + 6 + r() * (h - 12)).toFixed(0) + '" r="' + (3 + r() * 2.5).toFixed(1) + '" fill="#bfdcb3"/>');
    } else { out.push('<rect x="' + x0 + '" y="' + y0 + '" width="' + w + '" height="' + h + '" rx="5" fill="#ebe8e2"/>');
      const n = 1 + Math.floor(r() * 3), bw = (w - 4) / n;
      for (let k = 0; k < n; k++) out.push('<rect x="' + (x0 + 2 + k * bw).toFixed(0) + '" y="' + (y0 + 2) + '" width="' + (bw - 2).toFixed(0) + '" height="' + (h * (0.35 + r() * 0.2)).toFixed(0) + '" rx="2" fill="#e3dfd6"/>');
      blocks.push([x0 + w / 2, y0 + h / 2]); }
  }
  out.push('</g>');
  if (water === 'river') { const y = H * (0.3 + r() * 0.5), a = r() * 40 - 20; out.push('<path d="M-20 ' + (y + a).toFixed(0) + ' C' + (W * 0.3).toFixed(0) + ' ' + (y - 30).toFixed(0) + ' ' + (W * 0.6).toFixed(0) + ' ' + (y + 30).toFixed(0) + ' ' + (W + 20) + ' ' + (y - a).toFixed(0) + '" stroke="#c6dcf0" stroke-width="' + (12 + r() * 10).toFixed(0) + '" fill="none"/>'); }
  if (water === 'sea') { const left = r() < 0.5, x = W * (left ? 0.18 + r() * 0.1 : 0.72 + r() * 0.1); out.push('<path d="M' + x.toFixed(0) + ' -10 Q' + (x + (left ? 30 : -30)).toFixed(0) + ' ' + (H / 2) + ' ' + x.toFixed(0) + ' ' + (H + 10) + (left ? ' H-10 V-10Z' : ' H' + (W + 10) + ' V-10Z') + '" fill="#c6dcf0"/>'); }
  if (water === 'lake') { out.push('<ellipse cx="' + (W * (0.2 + r() * 0.6)).toFixed(0) + '" cy="' + (H * (0.3 + r() * 0.4)).toFixed(0) + '" rx="' + (26 + r() * 20).toFixed(0) + '" ry="' + (16 + r() * 12).toFixed(0) + '" fill="#c6dcf0"/>'); }
  // two main roads and, sometimes, one across
  const ry = H * (0.35 + r() * 0.3), rx = W * (0.3 + r() * 0.4), roads = ['M-20 ' + ry.toFixed(0) + ' H' + (W + 20), 'M' + rx.toFixed(0) + ' -20 V' + (H + 20)];
  if (r() < 0.6) roads.push('M-20 ' + (H * r()).toFixed(0) + ' L' + (W + 20) + ' ' + (H * r()).toFixed(0));
  out.push('<g fill="none" stroke-linecap="round" transform="rotate(' + tilt.toFixed(1) + ' ' + W / 2 + ' ' + H / 2 + ')">' + roads.map(d => '<path d="' + d + '" stroke="#dcd8cf" stroke-width="10"/><path d="' + d + '" stroke="#fff" stroke-width="7"/>').join('') + '</g>');
  // the places: each on a block of its own, picked by its name
  const pin = '<path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11z" fill="var(--axc)" stroke="var(--axd)" stroke-width="2.2" stroke-linejoin="round"/><circle cx="12" cy="10" r="2.1" fill="var(--axd)"/>';
  const inside = blocks.filter(([x, y]) => x > 20 && x < W - 20 && y > 28 && y < H - 8), used = new Set();
  for (const pl of places) { let k = hash(pl) % Math.max(1, inside.length); while (used.has(k) && used.size < inside.length) k = (k + 1) % inside.length; used.add(k);
    const [x, y] = inside[k] || [W / 2, H / 2]; out.push('<g transform="translate(' + (x - 13).toFixed(0) + ' ' + (y - 24).toFixed(0) + ') scale(1.1)" style="filter: drop-shadow(0 2px 3px rgba(22,27,34,.2))">' + pin + '</g>'); }
  return '<svg viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="xMidYMid slice" width="100%" height="100%" style="display:block"><rect width="' + W + '" height="' + H + '" fill="#f0eee9"/>' + out.join('') + '</svg>';
};`;
(async () => {
  const out = process.argv[2]; const s = await open('light', { out }); const p = s.p;
  await s.run(async ({ core, ph }) => { ph.hiddenPlaces = []; ph.visits = [
    { id: 'v1', place: 'Café am Fluss', city: 'Varo', with: ['Ren'], time: '10-24 16:10', src: 'story' },
    { id: 'v2', place: 'Ivo\'s workshop', city: 'Varo', with: ['Ivo'], time: '10-25 18:00', src: 'story' },
    { id: 'v3', place: 'Café am Fluss', city: 'Varo', with: ['Ren', 'Ivo'], time: '10-25 20:30', src: 'story' },
    { id: 'v6', place: 'The old garage', city: 'Varo', with: ['Ren'], time: '10-24 19:30', src: 'story' },
    { id: 'v4', place: 'Chicago', city: 'Chicago', with: [], time: '10-20 19:00', src: 'story' },
    { id: 'v5', place: 'Blue Note', city: 'Chicago', with: ['Anja'], time: '10-20 21:40', src: 'story' },
    { id: 'v7', place: 'Hotel Atlantic', city: 'Chicago', with: [], time: '10-20 23:30', src: 'story' },
    { id: 'v8', place: 'Gare du Nord', city: 'Paris', with: [], time: '10-12 09:10', src: 'story' }]; await core.saveMeta(); });
  await s.to('map'); await p.waitForTimeout(400);
  await p.evaluate(TOWN);
  const groups = () => p.evaluate(() => [...document.querySelectorAll('.na_ph_frame .ax_sec')].map(h => ({ city: h.textContent.split(' · ')[0], places: [...h.nextElementSibling.querySelectorAll('.ax_place .ax_n')].map(e => e.textContent) })));
  const g = await groups();
  // A: the one map on top, the newest city with its places
  await p.evaluate(g => { const a = document.querySelector('.na_ph_frame .ax_mapart'); a.style.background = 'none'; a.style.padding = '0'; a.innerHTML = townMap(g[0].city, g[0].places); }, g);
  await s.shot('A_top'); await s.scroll(); await s.shot('A_bottom');
  // B: no map on top; a small one per city, under its title
  await s.to('map'); await p.waitForTimeout(400); await p.evaluate(TOWN);
  await p.evaluate(g => { document.querySelector('.na_ph_frame .ax_mapart')?.remove();
    for (const h of document.querySelectorAll('.na_ph_frame .ax_sec')) { const c = h.textContent.split(' · ')[0], x = g.find(y => y.city === c); if (!x || c === '그 밖의 곳') continue;
      const d = document.createElement('div'); d.className = 'ax_card'; d.style.cssText = 'height: 110px; overflow: hidden; margin-bottom: 8px'; d.innerHTML = townMap(c, x.places, 332, 110); h.after(d); } }, g);
  await s.shot('B_top'); await s.scroll(); await s.shot('B_bottom');
  // the same code, other towns: how much they differ
  await s.to('map'); await p.waitForTimeout(300); await p.evaluate(TOWN);
  await p.evaluate(() => { const sc = document.querySelector('.na_ph_frame .ax_scroll'); sc.innerHTML = '<div class="ax_h1"><b>여러 도시</b></div>' + ['Seoul', 'Frankfurt', 'Busan', 'New York', 'Kyoto', 'Lisbon'].map(c => '<div class="ax_sec">' + c + '</div><div class="ax_card" style="height:110px;overflow:hidden">' + townMap(c, ['a', 'b'], 332, 110) + '</div>').join(''); });
  await s.shot('C_many'); await s.scroll(); await s.shot('C_many2');
  await s.run(async ({ core, ph }) => { delete ph.visits; await core.saveMeta(); });
  console.log(JSON.stringify(s.errors())); await s.close();
})().catch(e => { console.error(String(e).slice(0, 400)); process.exit(1); });
