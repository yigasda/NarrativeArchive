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

SEC_CC={'한국':'kr','일본':'jp','중국 · 대만 · 홍콩':'cn','독일':'de','영국 · 아일랜드':'gb','프랑스':'fr','이탈리아':'it','노르웨이':'no','스페인 · 포르투갈':'es','네덜란드 · 벨기에':'nl','러시아 · 동유럽':'ru','그리스 · 튀르키예':'gr','이집트':'eg','미국':'us','호주 · 뉴질랜드':'au','캐나다':'ca','인도':'in','유럽 (그 밖)':'hr'}
CITY_CC={}
for cc_,ns in {'hk':'홍콩','mo':'마카오','tw':'타이베이 지우펀 가오슝','id':'발리 자카르타','kh':'시엠레아프 앙코르','mm':'바간','vn':'사파 하노이 호찌민 호이안 후에 하롱베이 다낭','ph':'바나웨 마닐라 세부 보라카이','cn':'윈난 라싸','sg':'싱가포르','my':'쿠알라룸푸르','mv':'몰디브','pf':'보라보라','fj':'피지','np':'카트만두','ae':'두바이 아부다비','qa':'도하','sa':'리야드 메카','tr':'카파도키아 괴레메 이스탄불 앙카라 이즈미르 안탈리아','jo':'페트라 와디럼','il':'예루살렘','sy':'다마스쿠스','ma':'마라케시 페스','tn':'튀니스','ke':'나이로비 마사이마라','tz':'아루샤 세렝게티 잔지바르','na':'에토샤','mu':'모리셔스','sc':'세이셸','za':'케이프타운','ng':'라고스','gh':'아크라','ie':'더블린 골웨이','mc':'모나코','pt':'리스본 포르투 코임브라 알가르브','be':'브뤼셀 브뤼헤 겐트 앤트워프','ch':'취리히 바젤 베른 제네바 로잔 루체른 인터라켄 체르마트 그린델발트 생모리츠','at':'할슈타트 잘츠부르크 인스브루크 빈','cz':'프라하 체스키크룸로프 브르노','pl':'바르샤바 크라쿠프 그단스크','hu':'부다페스트','ua':'키이우','lv':'리가','ee':'탈린','lt':'빌뉴스','se':'스톡홀름 예테보리 말뫼 웁살라 키루나 아비스코','fi':'헬싱키 투르쿠 탐페레 로바니에미 라플란드','dk':'코펜하겐 오르후스 오덴세','is':'레이캬비크 아이슬란드','nz':'오클랜드 웰링턴 퀸스타운','gl':'누크 일룰리사트','cl':'발파라이소 산티아고','pe':'쿠스코 마추픽추 리마','bo':'라파스','th':'방콕 치앙마이 아유타야 푸켓 파타야 코사무이','mx':'멕시코시티 과달라하라 오악사카 과나후아토 칸쿤 툴룸 플라야델카르멘','br':'리우데자네이루 상파울루 살바도르 브라질리아 마나우스','ar':'부에노스아이레스 바릴로체 우수아이아 파타고니아','co':'보고타 메데인 카르타헤나','cu':'하바나','pr':'산후안','hr':'두브로브니크 스플리트'}.items():
    for n in ns.split(): CITY_CC[n]=cc_
CITY=[];HINT=[];GEN=[];PLACE=[];sec=''
skip=('표에 없는','이름 모를')
for l in s.split('\n'):
    if l.startswith('## '): sec=l[3:].strip(); continue
    if not l.startswith('| ') or l.startswith('| 도시') : continue
    p=[x.strip() for x in l.strip().strip('|').split(' | ')]
    if len(p)==2:
        if p[0].startswith(skip): continue
        CITY.append([names(p[0]),kinds(p[1])])
        for t in p[0].replace('(',' · ').replace(')',' ').split(' · '):
            t=t.strip(); m=re.match(r'^([가-힣\s]+?)\s+([A-Za-zÀ-ÿ\'\.\- ]+)$',t); ko=(m.group(1) if m else t).strip()
            if not ko or '○○' in ko or ko in GENERIC or not re.match(r'^[가-힣]',ko): continue
            al=[x for x in ([m.group(2).strip()] if m else [])+ALIAS.get(ko,[]) if x.lower()!=ko]
            seen=[]; [seen.append(x) for x in al if x not in seen]
            PLACE.append([ko,seen,len(CITY)-1,CITY_CC.get(ko) or SEC_CC.get(sec,'')])
    elif len(p)==3:
        ws=[w.replace('○○','').strip().lower() for w in p[1].split(' · ')]
        ws=[w for w in ws if len(w)>=2]
        ks=kinds(p[2])
        if p[0].startswith('('): GEN.append([ws,ks])
        else:
            lab=[w.strip() for w in p[1].split(' · ') if re.match(r'^[가-힣]',w.strip())][:2] or [p[1].split(' · ')[0].strip()]
            HINT.append([p[0].strip().lower(),ws,ks,' · '.join(lab)])
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
js+="export const HINT = "+json.dumps([[t,w,ix(k),lb] for t,w,k,lb in HINT],ensure_ascii=False,separators=(',',':'))+".map(([t, w, k, lb]) => [t, w, K(k), lb]);\n"
js+="// PLACE: a town to find by name: [its Korean name, its other names, its CITY row, its country]\nexport const PLACE = "+json.dumps(PLACE,ensure_ascii=False,separators=(',',':'))+";\n"
js+="export const CLUE = "+json.dumps([[w,ix(k)] for w,k in GEN],ensure_ascii=False,separators=(',',':'))+".map(([w, k]) => [w, K(k)]);\n"
js+="export const COMMON = K("+json.dumps(ix(COMMON))+");\n"
open(os.path.join(ROOT,'src','phonemapcity.js'),'w',encoding='utf8').write(js)
print(len(CITY),len(HINT),len(GEN),len(PLACE),len(js)); print('no country',[x[0] for x in PLACE if not x[3]])
