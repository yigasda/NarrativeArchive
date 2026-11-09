const { execFileSync } = require('child_process'); const fs = require('fs');
const T = `berlin-mitte 52.5075 13.3900 52.5295 13.4140
berlin-potsdamerplatz 52.4986 13.3640 52.5206 13.3880
berlin-kreuzberg 52.4880 13.4060 52.5100 13.4300
berlin-prenzlauerberg 52.5255 13.4050 52.5475 13.4290
berlin-charlottenburg 52.4930 13.3170 52.5150 13.3410
berlin-marzahn 52.5320 13.5520 52.5540 13.5760
muenchen-marienplatz 48.1264 11.5645 48.1484 11.5865
muenchen-schwabing 48.1480 11.5710 48.1700 11.5930
muenchen-nymphenburg 48.1473 11.4923 48.1693 11.5143
hamburg-stpauli 53.5390 9.9520 53.5610 9.9760
hamburg-hafencity 53.5320 9.9830 53.5540 10.0070
koeln-dom 50.9290 6.9460 50.9510 6.9700
duesseldorf-altstadt 51.2125 6.7650 51.2345 6.7890
frankfurt-bankenviertel 50.0990 8.6580 50.1210 8.6820
leipzig-zentrum 51.3290 12.3630 51.3510 12.3870
dresden-altstadt 51.0410 13.7280 51.0630 13.7520
nuernberg-altstadt 49.4430 11.0650 49.4650 11.0890
heidelberg-altstadt 49.4015 8.6880 49.4235 8.7120`.split('\n').map(l => l.split(' '));
const dir = process.argv[2], outd = process.argv[3]; fs.mkdirSync(outd, { recursive: true });
const done = [];
for (const [n, s, w, nn, e] of T) {
  const src = `${dir}/${n}.json`; if (!fs.existsSync(src)) continue;
  const la = (+s + +nn) / 2, lo = (+w + +e) / 2;
  execFileSync('node', ['/home/user/NarrativeArchive/docs/mockups/phone-map/osm/osmmap.js', src, `${outd}/${n}.html`, String(la), String(lo), '1500'], { stdio: 'inherit', env: { ...process.env, TITLE: n } });
  done.push(n);
}
fs.writeFileSync(`${outd}/list.json`, JSON.stringify(done));
