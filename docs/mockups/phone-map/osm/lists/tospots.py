# 받을 목록(lists/*.tsv)의 곳 → src/phonemapspots.js: 다녀간 곳 타일 지도의 가운데 좌표. 손으로 고치지 않아요.
#   python3 docs/mockups/phone-map/osm/lists/tospots.py
# 한 줄: [slug, 나라, 종류, lat, lon, 도시(지도 표의 한국어 이름), [이름들]] — 이름은 한국어 이름 · 찾기 첫 토막 · 표 동네
# 특수 색: 사막(slug 목록) · 눈(위도 60° 위, 스키 마을)은 종류 뒤에 붙여요(산·사막, 바다·눈)
import os, re, json
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.join(HERE, '..', '..', '..', '..', '..')
src = open(os.path.join(HERE, 'tocity.py'), encoding='utf8').read()
exec(src[src.index('CITY_OF = '):src.index('ONE_TZ = ')])   # CITY_OF, CITY_EN, SPECIAL_CITY
FILES = [('de', 'de'), ('de', 'de-plus'), ('kr', 'kr'), ('jp', 'jp'), ('us', 'us'), ('gb', 'gb'), ('fr', 'fr'), ('it', 'it'), ('cn', 'cn'), ('au', 'au'), ('ca', 'ca'), ('no', 'no')]
DESERT = set('grandcanyon-village monumentvalley page-antelope deathvalley-furnace brycecanyon arches whitesands joshuatree zion-springdale moab sedona marfa roswell yulara alicesprings cooberpedy brokenhill drumheller'.split())
SKI = set('courchevel valdisere megeve mtbuller thredbo hemsedal trysil geilo beitostolen finse whistler'.split())
seen, out = set(), []
for cc, f in FILES:
    lines = open(os.path.join(HERE, f + '.tsv'), encoding='utf8').read().strip().split('\n')
    head = lines[0].split('\t')
    for l in lines[1:]:
        r = dict(zip(head, l.split('\t') + [''] * 8))
        if not r['lat'] or r['slug'] in seen: continue
        seen.add(r['slug']); slug = r['slug']; la, lo = float(r['lat']), float(r['lon'])
        city = SPECIAL_CITY.get(slug, CITY_OF.get(slug.split('-')[0]) if '-' in slug else None) or ''
        names = []
        def add(n):
            n = re.sub(r'\(.*?\)', '', n or '').strip()
            if city and n.startswith(city + ' '): n = n[len(city) + 1:]
            for x in [n] + n.split(' · '):
                x = x.strip()
                if len(x) >= 2 and x not in names: names.append(x)
        add(r['이름']); add(r['찾기'].split(',')[0])
        if r.get('표 동네'): add(r['표 동네'].split(': ', 1)[-1])
        kind = r['종류'] + ('·사막' if slug in DESERT else '·눈' if la >= 60 or slug in SKI else '')
        out.append([slug, cc, kind, round(la, 5), round(lo, 5), city, names])
js = """// 캐릭터 휴대폰 · 다녀간 곳 › 타일 지도의 가운데: 받을 목록의 곳(docs/mockups/phone-map/osm/lists/*.tsv)에서
// tospots.py가 만들어요. 손으로 고치지 않아요. [slug, 나라, 종류(·사막 · ·눈), lat, lon, 도시(지도 표 이름, 없으면 그 곳이 도시), 이름들]
export const SPOTS = """ + json.dumps(out, ensure_ascii=False, separators=(',', ':')) + ";\n"
open(os.path.join(ROOT, 'src', 'phonemapspots.js'), 'w', encoding='utf8').write(js)
print(len(out), 'spots', len(js) // 1024, 'KB')
