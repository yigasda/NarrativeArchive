// 가짜 타일(faketiles.cjs)의 시험 글꼴: DejaVu로 Noto Sans 세 벌을 대신해요. node tools/dev/mkglyphs.cjs <글꼴 폴더>
const fontnik = require('fontnik'), fs = require('fs');
const F = { 'Noto Sans Regular': 'DejaVuSans.ttf', 'Noto Sans Bold': 'DejaVuSans-Bold.ttf', 'Noto Sans Italic': 'DejaVuSans.ttf' };
(async () => { for (const [st, f] of Object.entries(F)) { const font = fs.readFileSync('/usr/share/fonts/truetype/dejavu/' + f); const D = (process.argv[2] || 'glyphs') + '/' + st; fs.mkdirSync(D, { recursive: true });
  for (const s of [0, 256, 512, 768, 7680, 8192]) await new Promise((res, rej) => fontnik.range({ font, start: s, end: s + 255 }, (e, d) => { if (e) return rej(e); fs.writeFileSync(`${D}/${s}-${s + 255}.pbf`, d); res(); })); }
  console.log('ok'); })();
