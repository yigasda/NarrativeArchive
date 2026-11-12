# 받을 목록(lists/*.tsv)의 곳을 지도 표(towns/citytable.md)에 더해요. 다시 돌리면 같은 자리를 새로 써요(손으로 고치지 않아요).
#   python3 docs/mockups/phone-map/osm/lists/tocity.py && python3 docs/mockups/phone-map/towns/gencity.py
# - 큰 도시 안의 곳(slug 앞이 도시: london-, tokyo- …) → 그 도시의 "동네 단서" 줄. 반영 쪽이 그 도시의 시간대를 알아야 해서,
#   표(HOODS)에 있는 도시이거나 시간대가 하나인 나라의 도시만이에요.
# - 혼자 있는 곳(마을 · 산 · 섬 …) → 도시 줄(어울리는 지도는 종류에서). 이미 표에 있는 이름이면 더하지 않아요.
# - 반영 세션에 보낼 새 도시 · 동네와 시간대는 lists/HOODS-ADD.md에 써요.
import os, re, json, subprocess, unicodedata
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.join(HERE, '..', '..', '..', '..', '..')
TABLE = os.path.join(ROOT, 'docs', 'mockups', 'phone-map', 'towns', 'citytable.md')
A, B = '<!-- 받을 목록에서: 시작 (osm/lists/tocity.py가 써요) -->', '<!-- 받을 목록에서: 끝 -->'

SEC = {'de0': '독일', 'de': '독일', 'kr': '한국', 'jp': '일본', 'cn': '중국 · 대만 · 홍콩', 'gb': '영국 · 아일랜드', 'fr': '프랑스', 'it': '이탈리아',
       'us': '미국', 'au': '호주 · 뉴질랜드', 'ca': '캐나다', 'no': '노르웨이'}
FILES = {'de0': 'de', 'de': 'de-plus', 'kr': 'kr', 'jp': 'jp', 'us': 'us', 'gb': 'gb', 'fr': 'fr', 'it': 'it', 'cn': 'cn', 'au': 'au', 'ca': 'ca', 'no': 'no'}
# slug 앞 → 도시(지도 표 · 표에 쓰는 이름)
CITY_OF = {'berlin': '베를린', 'muenchen': '뮌헨', 'frankfurt': '프랑크푸르트', 'hamburg': '함부르크', 'koeln': '쾰른', 'leipzig': '라이프치히',
    'dresden': '드레스덴', 'stuttgart': '슈투트가르트', 'potsdam': '포츠담', 'hannover': '하노버', 'duesseldorf': '뒤셀도르프', 'nuernberg': '뉘른베르크',
    'luebeck': '뤼베크', 'seoul': '서울', 'busan': '부산', 'incheon': '인천', 'daegu': '대구', 'daejeon': '대전', 'gwangju': '광주', 'suwon': '수원',
    'seongnam': '성남', 'goyang': '고양', 'gangneung': '강릉', 'gyeongju': '경주', 'jeonju': '전주', 'tokyo': '도쿄', 'yokohama': '요코하마', 'osaka': '오사카',
    'kyoto': '교토', 'fukuoka': '후쿠오카', 'sapporo': '삿포로', 'nagoya': '나고야', 'kobe': '고베', 'okinawa': '오키나와', 'ny': '뉴욕', 'la': '로스앤젤레스',
    'sf': '샌프란시스코', 'seattle': '시애틀', 'chicago': '시카고', 'boston': '보스턴', 'dc': '워싱턴', 'miami': '마이애미', 'vegas': '라스베이거스',
    'london': '런던', 'manchester': '맨체스터', 'edinburgh': '에든버러', 'paris': '파리', 'lyon': '리옹', 'rome': '로마', 'milan': '밀라노', 'venice': '베네치아',
    'florence': '피렌체', 'naples': '나폴리', 'turin': '토리노', 'beijing': '베이징', 'shanghai': '상하이', 'guangzhou': '광저우', 'shenzhen': '선전',
    'hk': '홍콩', 'macau': '마카오', 'chengdu': '청두', 'qingdao': '칭다오', 'xiamen': '샤먼', 'sanya': '싼야', 'sydney': '시드니', 'melbourne': '멜버른',
    'toronto': '토론토', 'vancouver': '밴쿠버', 'montreal': '몬트리올', 'oslo': '오슬로', 'bergen': '베르겐', 'trondheim': '트론헤임', 'stavanger': '스타방에르',
    'tromso': '트롬쇠'}
CITY_EN = {'베를린': 'Berlin', '뮌헨': 'München', '프랑크푸르트': 'Frankfurt', '함부르크': 'Hamburg', '쾰른': 'Köln', '라이프치히': 'Leipzig', '드레스덴': 'Dresden',
    '슈투트가르트': 'Stuttgart', '포츠담': 'Potsdam', '하노버': 'Hannover', '뒤셀도르프': 'Düsseldorf', '뉘른베르크': 'Nürnberg', '뤼베크': 'Lübeck', '고베': 'Kobe',
    '오키나와': 'Okinawa', '나폴리': 'Napoli', '토리노': 'Torino', '청두': 'Chengdu', '칭다오': 'Qingdao', '샤먼': 'Xiamen', '싼야': 'Sanya', '베르겐': 'Bergen',
    '트론헤임': 'Trondheim', '스타방에르': 'Stavanger', '트롬쇠': 'Tromsø'}
SPECIAL_CITY = {'narita-airport': '도쿄', 'kansai-airport': '오사카', 'shanghai-pudong-airport': '상하이', 'beijing-airport': '베이징', 'mississauga': '토론토',
    'markham': '토론토', 'oakville': '토론토', 'north-vancouver': '밴쿠버', 'burnaby': '밴쿠버', 'richmond-bc': '밴쿠버', 'laval': '몬트리올', 'mutianyu': None}
ONE_TZ = {'de0': 'Europe/Berlin', 'de': 'Europe/Berlin', 'kr': 'Asia/Seoul', 'jp': 'Asia/Tokyo', 'cn': 'Asia/Shanghai', 'gb': 'Europe/London', 'fr': 'Europe/Paris', 'it': 'Europe/Rome', 'no': 'Europe/Oslo'}

# 종류 → 어울리는 그림 지도(실제 지도가 오기 전까지, 그리고 못 받은 곳)
def maps(cc, kind, r):
    asia, newworld = cc in ('kr', 'jp', 'cn'), cc in ('us', 'ca', 'au')
    q = (r['찾기'] + ' ' + r['이름'] + ' ' + r['slug']).lower(); lat = abs(float(r['lat']))
    M = {
        '도심': ['도심 업무지구', '미국 소도시', '큰길 상가 교외', '역 앞 번화가'] if newworld else ['역 앞 번화가', '골목 주택가', '지방 소도시 시내', '도심 업무지구'] if asia
             else ['유럽 소도시 광장', '옛 시내 + 새 시내', '중정 블록 시가지', '역 앞 번화가'],
        '교외': ['넓은 교외', '교외 고리길', '단독주택 주택가', '큰길 상가 교외'] if newworld else ['아파트 단지', '신도시 나들목', '교외 역세권', '빌라촌'] if asia
             else ['교외 고리길', '단독주택 주택가', '아파트 단지', '교외 역세권'],
        '일터': ['도심 업무지구', '대로 사이 큰 단지', '학교 캠퍼스 동네', '컨테이너 항구', '신도시 나들목'],
        '공항': ['공항 옆 동네', '신도시 나들목'],
        '산': ['알프스 골짜기', '산 아래 도시', '시골 읍내', '목조 주택 교외'],
        '호수': ['호숫가 휴양지', '호숫가 교외 도시', '산 아래 도시'],
        '바다': ['해변 소도시', '만 해안', '계단식 언덕 항구'],
        '섬': ['섬', '다도해', '해변 소도시'],
        '강골짜기': ['피오르 마을', '산 아래 도시', '알프스 골짜기'] if cc == 'no' else ['협곡 도시', '두 강이 만나는 곳', '큰 강 대도시', '산 아래 도시'],
        '옛마을': ['골목 주택가', '사원 유적', '지방 소도시 시내', '해자 두른 성 마을'] if asia else ['미국 소도시', '유럽 소도시 광장', '시골 읍내'] if newworld
             else ['유럽 소도시 광장', '해자 두른 성 마을', '골목 주택가', '옛 시내 + 새 시내'],
        '온천': ['산 아래 도시', '시골 읍내', '호숫가 휴양지'],
        '숲': ['목조 주택 교외', '산 아래 도시', '시골 읍내'],
        '시골': ['논밭 사이 마을', '계단식 논', '시골 읍내'] if asia else ['미국 소도시', '들판 마을', '시골 읍내'] if newworld else ['들판 마을', '논밭 사이 마을', '시골 읍내'],
    }[kind]
    first = []
    if re.search(r'canyon|valley|desert|sands|death|arches|monument|joshua|sedona|moab|page,|yulara|alice springs|coober|broken hill|katherine|marfa|roswell|drumheller', q): first += ['협곡 도시', '사막 오아시스']
    if re.search(r'coober|matera|sassi', q): first += ['동굴 · 바위 마을']
    if re.search(r'terrace|longji|다랑논', q): first += ['계단식 논']
    if re.search(r'aso|kona|hilo|volcan', q): first += ['화산 분화구 마을']
    if re.search(r'jeungdo|suncheon|greetsiel|peter-ording|갯벌|염전', q): first += ['염전 · 갯벌 마을']
    if lat > 64 or 'svalbard' in q or 'longyear' in q: first += ['극지 항구', '눈 덮인 노르웨이 도시']
    elif cc == 'no' and kind in ('도심', '바다', '옛마을'): first += ['눈 덮인 노르웨이 도시']
    if lat < 27 and kind in ('바다', '섬'): first += ['열대 해변 리조트']
    if cc == 'fr' and r['slug'].startswith('paris-') and kind == '도심': first += ['오스만 블록 시가지']
    if cc == 'jp' and kind == '교외': first += ['단지(団地)']
    out = []
    for m in first + M:
        if m not in out: out.append(m)
    return out[:6]

def fold(s): return ''.join(c for c in unicodedata.normalize('NFKD', s) if not unicodedata.combining(c)).replace('ø', 'o').replace('Ø', 'O').replace('œ', 'oe').replace('æ', 'ae').replace('ß', 'ss')
EN_OK = re.compile(r"^[A-Za-zÀ-ÿ'\.\- ]+$")
def en_names(q):
    e = re.sub(r'\s+(Station|Visitor Center|Visitor Complex|Port)$', '', q.split(',')[0].strip()); out = []
    for x in (fold(e), e):
        if EN_OK.match(x) and x not in out: out.append(x)
    return out
DROP = {'시내', '옛 시내', '공항', '공원', '둘레', '시내 골목'}
# a town's own name, without what the list says about it ("베르가모 언덕 마을" → 베르가모, "쿠버페디 지하 마을" → 쿠버페디)
DESC = sorted(['언덕 마을', '하얀 마을', '지하 마을', '물의 마을', '성곽 마을', '성벽 마을', '광산 마을', '어촌', '산골 마을', '산골', '농촌 마을', '농가 마을', '포도밭 마을',
    '화가 마을', '차 마을', '도자기 마을', '독일풍 마을', '덴마크풍 마을', '유령 마을', '산양 치즈 마을', '오로라 마을', '공장 도시', '제철 도시', '연구 도시', '광산 항구',
    '옛 성곽 마을', '옛 시내', '옛 거리', '시내', '항구', '해변', '해안', '아래', '입구', '둘레', '공장', '붉은 오두막', '목조 교회 마을', '목조 교회', '스키 마을', '고원 역',
    '골짜기 공장 마을', '밀밭 마을', '옥수수밭 마을', '목장 마을', '케이준 마을', '농촌', '장터', '바닷가', '사막 마을', '황무지', '농촌 마을', '북극곰 마을', '아웃백',
    '합장 마을', '역참 마을', '온천', '운하 마을', '동굴 마을', '트룰리 마을', '골목', '들판', '숲속 마을', '늪 · 화가 마을', '주택가', '아파트 단지', '오일샌드', '박물관 · 항구'], key=len, reverse=True)
def town_ko(name):
    ko = re.sub(r'\(.*?\)', '', name).strip()
    t = ko
    for d in DESC: t = re.sub(r'(^|\s)' + re.escape(d) + r'(?=\s|$)', ' ', t)
    t = re.sub(r'\s+', ' ', t).strip(' ·')
    return t if len(t) >= 2 else ko
# 손으로 다듬은 이름(names.tsv: slug · 한국어 이름 · 그곳 이름): 목록의 이름은 설명이 섞여 있어서(브레머하펜 항구, Havenwelten) 이걸 먼저 써요
NAMES = {}
if os.path.exists(os.path.join(HERE, 'names.tsv')):
    for l in open(os.path.join(HERE, 'names.tsv'), encoding='utf8').read().strip().split('\n'):
        if l and not l.startswith('#'): sl, ko_, lo_ = l.split('\t'); NAMES[sl] = (ko_.strip(), lo_.strip())
GENERIC_W = {'Markt', 'Hauptmarkt', 'Altstadt', '대성당', '컨테이너 항구', 'Downtown'}
def hood_words(r, city):
    if r['slug'] in NAMES:   # the clean name first (its label is the Korean words), then the list's Latin words to find it by
        ko_, lo_ = NAMES[r['slug']]; ws = [w.strip() for w in ko_.split(' · ')] + [lo_]
        for e in [fold(lo_)] + en_names(r['찾기']):
            e2 = re.sub(r'\s+(Station|Centre|Center|Town Centre)$', '', e).strip()
            if e2 and e2.lower() not in (x.lower() for x in ws): ws.append(e2)
        return ws
    ko = town_ko(r['이름'])
    if ko.startswith(city): ko = ko[len(city):].strip()
    ws = [w.strip() for w in ko.split(' · ') if w.strip() and w.strip() not in DROP]
    for e in en_names(r['찾기']):
        e2 = re.sub(r'\s+(Station|Centre|Center|Town Centre)$', '', e).strip()
        if e2.lower() not in (x.lower() for x in ws): ws.append(e2)
    return ws

def load(cc):
    lines = open(os.path.join(HERE, FILES[cc] + '.tsv'), encoding='utf8').read().strip().split('\n')
    head = lines[0].split('\t'); return [dict(zip(head, l.split('\t') + [''] * (len(head) - len(l.split('\t'))))) for l in lines[1:]]

# what the table already knows without our rows: take our block out, make phonemapcity.js, read its towns' names and 동네 단서 words
s = open(TABLE, encoding='utf8').read()
if A in s: s = s[:s.index(A)] + s[s.index(B) + len(B) + 1:]
open(TABLE, 'w', encoding='utf8').write(s)
subprocess.run(['python3', os.path.join(ROOT, 'docs', 'mockups', 'phone-map', 'towns', 'gencity.py')], check=True, capture_output=True, env={**os.environ, 'NO_AREAS': '1'})
known = json.loads(subprocess.run(['node', '-e', """import('%s').then(m=>console.log(JSON.stringify({p:m.PLACE.map(x=>[x[0],...x[1]].map(s=>s.toLowerCase())),h:m.HINT.map(x=>[x[0],x[1]])})))""" % os.path.abspath(os.path.join(ROOT, 'src', 'phonemapcity.js'))],
    capture_output=True, text=True, check=True).stdout)
names = set(n for p in known['p'] for n in p)
# the reflection's table (HOODS): a neighbourhood row only for a town it has a time-zone row for (tests/placehoods.test.mjs wants
# every map town there); the other towns' neighbourhoods wait in HOODS-ADD.md till the reflection session adds the town
hoods_cities = set(json.loads(subprocess.run(['node', '-e', """import('%s').then(m=>console.log(JSON.stringify(m.HOODS.flatMap(r=>r[0].split('|')))))""" % os.path.abspath(os.path.join(ROOT, 'src', 'placehoods.js'))],
    capture_output=True, text=True, check=True).stdout))
names |= set(w.lower() for _, ws in known['h'] for w in ws)   # a neighbourhood the table already has (베르사유 under 파리) is no new town
hint_words = {}
for t, ws in known['h']:
    for c in t.split(' · '): hint_words.setdefault(c.strip(), set()).update(w.lower() for w in ws)

out = [A, '', '# 받을 목록에서 더한 곳 (11-12)', '', '`docs/mockups/phone-map/osm/lists/*.tsv`의 곳이에요. `tocity.py`가 써요. 손으로 고치지 않아요.', '']
add_city, add_hood, report = {}, {}, {}
for cc in FILES:
    for r in load(cc):
        if not r.get('lat'): continue   # 받기 x without a centre: a row that shares another's map
        slug = r['slug']; kind = r['종류']
        city = SPECIAL_CITY.get(slug, CITY_OF.get(slug.split('-')[0]) if '-' in slug else None)
        # 표(HOODS)의 동네도 더해요: 지도 표에 그 낱말이 이미 있으면 아래에서 빠져요(찾은 도시 › 주변 동네가 목록의 동네를 다 보여 줘요)
        if city:
            if re.search(r'-(zentrum|altstadt|mitte|centro|sentrum|downtown|cbd|dom)$', slug): continue   # the city's own centre: the city is enough
            if slug in NAMES:   # a clean name: the table already has the place when it has any of its Korean names (no 센트럴 · 소호 beside 센트럴 · 란콰이퐁); else the whole clean row
                kos = [w.strip().lower() for w in NAMES[slug][0].split(' · ')]
                sp = {w.replace(' ', '') for w in hint_words.get(city, set())} | {fold(w).replace(' ', '') for w in hint_words.get(city, set())}   # 캐피톨 힐 = 캐피톨힐
                ws = [] if any(k.replace(' ', '') in sp for k in kos) or fold(NAMES[slug][1]).lower().replace(' ', '') in sp else [w for w in hood_words(r, city) if w not in GENERIC_W]
            else: ws = [w for w in hood_words(r, city) if w.lower() not in hint_words.get(city, set()) and w not in GENERIC_W]
            if not ws: continue
            if city.lower() not in names and city not in add_city:   # 표에 없는 도시: 도시 줄도 같이
                add_city[city] = (cc, f'{city} {CITY_EN.get(city, "")}'.strip(), ['역 앞 번화가', '도심 업무지구', '골목 주택가', '큰 강 대도시'] if cc in ('kr', 'jp', 'cn') else ['유럽 소도시 광장', '옛 시내 + 새 시내', '큰 강 대도시', '역 앞 번화가'], [])
            if city not in hoods_cities:
                report.setdefault(cc, []).append((city, ' · '.join(ws), slug)); continue   # 반영 쪽 표에 도시 줄이 생기면 더해요
            add_hood.setdefault(cc, []).append((city, ws, maps(cc, kind, r), slug))
            if not r.get('표 동네'): report.setdefault(cc, []).append((city, ' · '.join(ws), slug))   # 표에 있던 동네는 반영 쪽이 이미 알아요
        else:
            ko = town_ko(r['이름']).split(' · ')[0].strip(); ens = en_names(r['찾기'])   # one name: "속초 · 중앙시장" would make 중앙시장 a town
            if slug in NAMES: ko, lo_ = NAMES[slug]; ens = [lo_] + [e for e in en_names(lo_) if e != lo_]
            if ko.lower() in names or any(e.lower() in names for e in ens): continue
            label = ' · '.join([f'{ko} {ens[0]}' if ens else ko] + ens[1:])
            add_city[slug] = (cc, label, maps(cc, kind, r), [])
            names.update([ko.lower()] + [e.lower() for e in ens])   # 나이아가라 폭포 once (Canada's side, then the US one is the same name)
            report.setdefault(cc, []).append((ko, '', slug))
for cc in FILES:
    rows = [v for v in add_city.values() if v[0] == cc]; hoods = add_hood.get(cc, [])
    if not rows and not hoods: continue
    out += [f'## {SEC[cc]}', '| 도시 | 어울리는 지도 |', '|---|---|'] + [f'| {lab} | {" · ".join(ms)} |' for _, lab, ms, _ in rows] + ['']
    if hoods:
        out += [f'### {SEC[cc]} 동네 단서 (받을 목록)', '| 도시 | 동네 낱말 | 앞으로 올릴 지도 |', '|---|---|---|'] + [f'| {c} | {" · ".join(ws)} | {" · ".join(ms)} |' for c, ws, ms, _ in hoods] + ['']
out += [B, '']
mark = '## 표에 없는 도시'
s = s.replace(mark, '\n'.join(out) + mark, 1)
open(TABLE, 'w', encoding='utf8').write(s)
json.dump({cc: v for cc, v in report.items()}, open(os.path.join(HERE, '.tocity.json'), 'w', encoding='utf8'), ensure_ascii=False, indent=0)
print('도시 줄', len(add_city), '· 동네 단서', sum(len(v) for v in add_hood.values()))

# 반영 세션에 보낼 것: 새로 더한 도시 · 곳과 동네, 그리고 시간대(나라에 시간대가 여럿이면 곳마다)
CA = {**{k: 'America/Vancouver' for k in 'revelstoke nelson-bc kelowna penticton whistler tofino ucluelet saltspring victoria'.split()},
      **{k: 'America/Edmonton' for k in 'banff lakelouise jasper canmore calgary edmonton drumheller fortmcmurray yellowknife'.split()},
      **{k: 'America/Whitehorse' for k in 'whitehorse dawsoncity'.split()}, **{k: 'America/Regina' for k in 'regina saskatoon humboldt'.split()},
      **{k: 'America/Winnipeg' for k in 'winnipeg steinbach churchill'.split()},
      **{k: 'America/Halifax' for k in 'halifax peggyscove lunenburg baddeck charlottetown cavendish moncton'.split()},
      **{k: 'America/St_Johns' for k in 'stjohns rockyharbour'.split()}, 'iqaluit': 'America/Iqaluit'}
AU = {**{k: 'Australia/Darwin' for k in 'darwin katherine jabiru yulara alicesprings'.split()},
      **{k: 'Australia/Perth' for k in 'perth fremantle margaretriver broome rottnest exmouth monkeymia albany esperance porthedland'.split()},
      **{k: 'Australia/Adelaide' for k in 'adelaide cooberpedy kingscote tanunda'.split()}, 'brokenhill': 'Australia/Broken_Hill', 'lordhowe': 'Australia/Lord_Howe',
      **{k: 'Australia/Hobart' for k in 'hobart launceston colesbay portarthur strahan'.split()},
      **{k: 'Australia/Brisbane' for k in 'brisbane goldcoast cairns townsville mooloolaba noosa airliebeach hamiltonisland portdouglas capetribulation magneticisland kgari'.split()},
      **{k: 'Australia/Melbourne' for k in 'geelong lorne apollobay portcampbell cowes-phillip healesville daylesford ballarat bendigo bright mtbuller lakesentrance'.split()}}
def tz(cc, slug, lat, lon):
    if cc in ONE_TZ: return ONE_TZ[cc]
    if cc == 'cn': return 'Asia/Hong_Kong' if slug.startswith('hk-') else 'Asia/Macau' if slug.startswith('macau-') else 'Asia/Shanghai'
    if cc == 'ca': return CA.get(slug, 'America/Vancouver' if lon < -120 else 'America/Toronto')
    if cc == 'au': return AU.get(slug, 'Australia/Melbourne' if slug.startswith('melbourne-') else 'Australia/Sydney')
    if cc == 'us':
        if slug == 'monumentvalley': return 'America/Denver'   # Navajo Nation keeps summer time
        if slug == 'marfa': return 'America/Chicago'
        if slug == 'juneau': return 'America/Juneau'
        if lon < -154: return 'Pacific/Honolulu'
        if lat > 54: return 'America/Anchorage'
        if 31.3 < lat < 37.0 and -114.8 < lon < -109.05: return 'America/Phoenix'
        if lon < -114.5: return 'America/Los_Angeles'
        if lon < -101.5: return 'America/Denver'
        if lon < -85.5: return 'America/Chicago'
        return 'America/New_York'
NATION = {'de0': '독일', 'de': '독일', 'kr': '한국', 'jp': '일본', 'cn': '중국 · 홍콩 · 마카오', 'gb': '영국', 'fr': '프랑스', 'it': '이탈리아', 'us': '미국', 'au': '호주', 'ca': '캐나다', 'no': '노르웨이'}
rows_by = {cc: {r['slug']: r for r in load(cc)} for cc in FILES}
md = ['# 반영 세션에 보낼 것: 지도 표에 새로 더한 곳 (11-12)', '',
      '지도 표(HINT · PLACE)에 받을 목록의 곳을 더했어요(`tocity.py`). 반영 쪽 표(`HOODS`)에 더할지는 반영 세션이 정해요.',
      '- **새 동네**: 이미 있는 도시 안의 곳이에요. 그 도시 줄에 동네로 더하면 돼요.',
      '- **새 도시 · 곳**: 표에 없던 도시 · 마을 · 산 · 섬이에요. 시간대가 여럿인 나라(미국 · 캐나다 · 호주)는 곳마다 적었어요.',
      '- 지금도 테스트(`tests/placehoods.test.mjs`)는 다 통과해요. 시간대가 하나인 나라는 지도 표만으로도 반영 쪽이 시간대를 알아요.', '']
for cc in FILES:
    hood = [(c, w, s_) for c, w, s_ in report.get(cc, []) if w]
    town = [(k, s_) for k, w, s_ in report.get(cc, []) if not w]
    newc = [k for k, v in add_city.items() if v[0] == cc and not k.islower()]
    if not (hood or town): continue
    md += [f'## {NATION[cc]}', '']
    if newc: md += ['새 도시(동네가 있어요): ' + ' · '.join(newc), '']
    if hood:
        md += ['| 도시 | 새 동네 | 시간대 |', '|---|---|---|'] + [f'| {c} | {w} | {tz(cc, s_, float(rows_by[cc][s_]["lat"]), float(rows_by[cc][s_]["lon"]))} |' for c, w, s_ in hood] + ['']
    if town:
        md += ['| 새 곳 | 다른 이름 | 시간대 |', '|---|---|---|']
        for k, s_ in town:
            r = rows_by[cc][s_]; md.append(f'| {k} | {" · ".join(en_names(r["찾기"]))} | {tz(cc, s_, float(r["lat"]), float(r["lon"]))} |')
        md.append('')
open(os.path.join(HERE, 'HOODS-ADD.md'), 'w', encoding='utf8').write('\n'.join(md))
os.remove(os.path.join(HERE, '.tocity.json'))
