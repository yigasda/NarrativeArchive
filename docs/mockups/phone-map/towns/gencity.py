# 다녀간 곳: makes src/phonemapcity.js from citytable.md (+ alias.py, the cities' other names). Run: python3 docs/mockups/phone-map/towns/gencity.py
import json,re
import os
HERE=os.path.dirname(os.path.abspath(__file__)); ROOT=os.path.join(HERE,'..','..','..','..')
src=open(os.path.join(ROOT,'src','phonemaptowns.js'),encoding='utf8').read()
KO=dict(re.findall(r"(\w+): '([^']*)'",src[src.index('export const TOWN_KO'):])); NAME={v:k for k,v in KO.items()}; NAME['만 해안']='bay'
s=open(os.path.join(HERE,'citytable.md'),encoding='utf8').read()
def kinds(txt):
    items=[x.strip() for x in txt.split(' · ')]; out=[]; i=0
    while i<len(items):
        a=items[i]
        if i+1<len(items) and a+' · '+items[i+1] in NAME: a=a+' · '+items[i+1]; i+=2
        else: i+=1
        if a.startswith('이집트'): a='이집트'
        k=NAME.get(a) or NAME.get(re.sub(r'\(.*?\)','',a).strip())
        if not k: raise SystemExit('unknown '+a)
        if k not in out: out.append(k)
    return out
exec(open(os.path.join(HERE,'alias.py'),encoding='utf8').read())
def names(label):
    label=label.replace('(',' · ').replace(')',' ')
    out=[]
    for t in label.split(' · '):
        t=t.strip()
        if not t or '○○' in t: continue
        m=re.match(r'^([가-힣\s]+?)\s+([A-Za-zÀ-ÿ\'\.\- ]+)$',t)
        parts=[m.group(1),m.group(2)] if m else [t]
        for q in parts:
            q=q.strip()
            for z in [q]+ALIAS.get(q,[]):
                z=z.lower()
                if len(z)>=2 and z not in out and z not in GENERIC: out.append(z)
    return out
CITY=[];HINT=[];GEN=[]
skip=('표에 없는','이름 모를')
for l in s.split('\n'):
    if not l.startswith('| ') or l.startswith('| 도시') : continue
    p=[x.strip() for x in l.strip().strip('|').split(' | ')]
    if len(p)==2:
        if p[0].startswith(skip): continue
        CITY.append([names(p[0]),kinds(p[1])])
    elif len(p)==3:
        ws=[w.replace('○○','').strip().lower() for w in p[1].split(' · ')]
        ws=[w for w in ws if len(w)>=2]
        ks=kinds(p[2])
        if p[0].startswith('('): GEN.append([ws,ks])
        else: HINT.append([p[0].strip().lower(),ws,ks])
COMMON=kinds('큰 강 대도시 · 바둑판 + 호수 · 골목 주택가 · 아파트 단지 · 도심 업무지구 · 역 앞 번화가 · 교외 고리길 · 미국 소도시 · 유럽 소도시 광장 · 두 강이 만나는 곳 · 산 아래 도시 · 방사형 광장 · 만 해안 · 학교 캠퍼스 동네 · 언덕 주택가 · 테라스 하우스 동네 · 중정 블록 시가지 · 단독주택 주택가 · 넓은 교외 · 옛 시내 + 새 시내')
CLUE=[
 ('해변 · 해수욕장 · beach · strand · plage · playa · spiaggia · ビーチ', '해변 소도시 · 열대 해변 리조트 · 만 해안'),
 ('항구 · 포구 · 부두 · harbor · harbour · port · hafen · porto · 港', '계단식 언덕 항구 · 컨테이너 항구 · 만 해안'),
 ('island · insel · 섬마을 · 島', '섬 · 다도해'),
 ('station · bahnhof · gare · stazione · 駅', '역 앞 번화가 · 교외 역세권'),
 ('공항 · airport · flughafen · aéroport · 空港', '공항 옆 동네'),
 ('대학 · 캠퍼스 · 기숙사 · university · campus · college · universität · 大学', '학교 캠퍼스 동네 · 대학가 · 원룸촌'),
 ('castle · schloss · château · castello · 城', '해자 두른 성 마을'),
 ('temple · shrine · 사찰 · 신사 · 寺 · 神社', '사원 유적'),
 ('mountain · 등산 · berg · montagne · 山', '산 아래 도시 · 알프스 골짜기'),
 ('호수 · lake · see · lac · lago · 湖', '호숫가 휴양지 · 호숫가 교외 도시'),
 ('사막 · desert · wüste · désert', '사막 오아시스'),
 ('운하 · canal · kanal · gracht', '운하 바둑판'),
 ('아파트 · 단지 · apartment', '아파트 단지 · 대로 사이 큰 단지'),
 ('빌라 · 원룸 · 고시원 · 옥탑', '빌라촌 · 대학가 · 원룸촌'),
 ('시장 · 터미널 · 군청 · 읍내 · market · markt · marché', '지방 소도시 시내 · 시골 읍내'),
 ('ski · 스키 · 스키장', '알프스 골짜기 · 목조 주택 교외'),
 ('farm · 농장 · 과수원 · 목장', '논밭 사이 마을 · 들판 마을'),
]
for w,k in CLUE: GEN.append([[x.strip().lower() for x in w.split(' · ')],kinds(k)])
ORDER=json.loads(re.search(r"export const TOWN_KINDS = (\[[^\]]*\])", src).group(1).replace("'", '"'))
ix=lambda ks: [ORDER.index(k) for k in ks]
js="""// 캐릭터 휴대폰 · 다녀간 곳: which town drawing suits a town. Made by docs/mockups/phone-map/towns/gencity.py from
// citytable.md and alias.py there (CITY: a town's names → the maps that suit it; HINT: a neighbourhood's words in a place's
// name → the maps to try first; CLUE: words that suit a map wherever they are; COMMON: for a town nobody listed).
// The maps are written as their place in TOWN_KINDS (smaller), and turned back into names here. Regenerate, never edit.
import { TOWN_KINDS } from './phonemaptowns.js';
const K = ks => ks.map(i => TOWN_KINDS[i]);
"""
js+="export const CITY = "+json.dumps([[n,ix(k)] for n,k in CITY],ensure_ascii=False,separators=(',',':'))+".map(([n, k]) => [n, K(k)]);\n"
js+="export const HINT = "+json.dumps([[t,w,ix(k)] for t,w,k in HINT],ensure_ascii=False,separators=(',',':'))+".map(([t, w, k]) => [t, w, K(k)]);\n"
js+="export const CLUE = "+json.dumps([[w,ix(k)] for w,k in GEN],ensure_ascii=False,separators=(',',':'))+".map(([w, k]) => [w, K(k)]);\n"
js+="export const COMMON = K("+json.dumps(ix(COMMON))+");\n"
open(os.path.join(ROOT,'src','phonemapcity.js'),'w',encoding='utf8').write(js)
print(len(CITY),len(HINT),len(GEN),len(js))
