// 지도 아이콘(icons.js의 ICON · OFF, osmmap.js의 종류 색 CAT) → src/phonemapicons.js(타일 지도가 써요). 아이콘을 고치면 iconbox.cjs 다음에 돌려요.
//   node docs/mockups/phone-map/osm/genmapicons.cjs
const fs = require('fs'), path = require('path'), D = __dirname;
const { ICON, OFF } = require(path.join(D, 'icons.js'));
const src = fs.readFileSync(path.join(D, 'osmmap.js'), 'utf8'), CAT = eval('(' + src.match(/const CAT = (\{[^}]*\})/)[1] + ')');
const out = Object.fromEntries(Object.keys(ICON).map(k => [k, [ICON[k], OFF[k] || [0, 0], CAT[k] || '#6f7783']]));
fs.writeFileSync(path.join(D, '..', '..', '..', '..', 'src', 'phonemapicons.js'), `// 캐릭터 휴대폰 · 다녀간 곳 › 타일 지도 아이콘: [24칸 선 그림, 가운데 맞춤 이동, 종류 색]. docs/mockups/phone-map/osm/genmapicons.cjs가 만들어요(손으로 고치지 않아요)\nexport const MAP_ICONS = ${JSON.stringify(out)};\n`);
console.log(Object.keys(out).length, 'icons');
