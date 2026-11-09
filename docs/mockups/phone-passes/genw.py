# 지갑 › 디지털 표 시안 A–D (애플 지갑 · 티켓 앱 질감). 방향마다 8종류
I = {
 'plane':'M2 16l20-8-20-8v6l14 2-14 2z','train':'M6 4h12a2 2 0 0 1 2 2v9H4V6a2 2 0 0 1 2-2zM4 11h16M8 19l-2 2M16 19l2 2','note':'M9 18V5l12-2v13M9 18a3 3 0 1 1-6 0 3 3 0 0 1 6 0zM21 16a3 3 0 1 1-6 0 3 3 0 0 1 6 0z',
 'ball':'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 7l4 3-1.5 5h-5L8 10z','bed':'M3 18V8M3 14h18v4M21 14v-3a3 3 0 0 0-3-3h-7v6M7 11a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z','film':'M4 5h16v14H4zM8 5v14M16 5v14M4 9h4M4 15h4M16 9h4M16 15h4',
 'museum':'M3 9l9-5 9 5M5 9v9M9 9v9M15 9v9M19 9v9M3 20h18','card':'M3 6h18v12H3zM3 10h18M7 15h4','arrow':'M5 12h14M13 6l6 6-6 6',
}
ic = lambda k, s=16, c='currentColor', w=2: f'<svg width="{s}" height="{s}" viewBox="0 0 24 24" fill="none" stroke="{c}" stroke-width="{w}" stroke-linecap="round" stroke-linejoin="round"><path d="{I[k]}"/></svg>'
# the eight, with a kind colour (muted), the art for event kinds
K = [
 dict(k='flight',ic='plane',kind='항공',by='LUFTHANSA',top=('BOARDING','14:50'),a=('FRA','Frankfurt'),b=('ICN','Seoul'),f=[('GATE','A13'),('SEAT','1A'),('FLIGHT','LH 712'),('DATE','09.11.')],c='#2c4a80'),
 dict(k='train',ic='train',kind='기차',by='DEUTSCHE BAHN',top=('ICE 123','09:54'),a=('Frankfurt','ab 09:54'),b=('Köln','an 11:02'),f=[('WAGEN','7'),('PLATZ','45'),('KLASSE','2'),('DATE','10.11.')],c='#9a3b35'),
 dict(k='concert',ic='note',kind='콘서트',by='FESTHALLE',top=('DOORS','19:00'),title='IU · H.E.R. World Tour',f=[('SECTION','Floor A'),('ROW','7'),('SEAT','12'),('DATE','14.11.')],c='#2a2f55'),
 dict(k='match',ic='ball',kind='경기',by='DEUTSCHE BANK PARK',top=('KICK-OFF','18:30'),title='Eintracht – Bayern',f=[('BLOCK','43'),('ROW','12'),('SEAT','9'),('DATE','22.11.')],c='#2f6a46'),
 dict(k='hotel',ic='bed',kind='숙소',by='HOTEL LISBOA MAR',top=('CHECK-IN','30.10.'),title='3 nights · Deluxe',f=[('CHECK-OUT','02.11.'),('ROOM','412'),('GUESTS','2'),('CONF.','HL-2231')],c='#8a6a4a'),
 dict(k='movie',ic='film',kind='영화',by='CINESTAR',top=('SHOW','20:15'),title='Dune: Part Three',f=[('HALL','5'),('ROW','H'),('SEAT','14'),('DATE','15.11.')],c='#2a2b30'),
 dict(k='museum',ic='museum',kind='전시',by='STÄDEL MUSEUM',top=('ENTRY','11:00'),title='Rembrandt · Licht',f=[('TICKET','Adult'),('DATE','16.11.'),('NO.','ST-2207')],c='#5a6e86'),
 dict(k='member',ic='card',kind='회원권',by='URBAN SPORTS CLUB',top=('PLAN','M'),title='Mara Varo',f=[('VALID','01.10. – 31.12.'),('MEMBER','US-88 204')],c='#2e5e57'),
]
def art(k, w=340, h=96):
    # flat little scenes for the strip (events) — sky, stage, pitch, room, screen, gallery, gym
    S = {
     'concert': f'<rect width="{w}" height="{h}" fill="#20254a"/>' + ''.join(f'<path d="M{70+i*50} 0 L{50+i*50} {h} H{96+i*50}z" fill="#f2d28a" opacity="{.16+.05*(i%2)}"/>' for i in range(5)) + f'<rect y="{h-18}" width="{w}" height="18" fill="#141832"/>' + ''.join(f'<circle cx="{14+i*22}" cy="{h-18}" r="7" fill="#0c0f22"/>' for i in range(16)),
     'match': f'<rect width="{w}" height="{h}" fill="#3a7a52"/>' + ''.join(f'<rect x="{i*40}" width="20" height="{h}" fill="#fff" opacity=".05"/>' for i in range(9)) + f'<rect x="12" y="12" width="{w-24}" height="{h-24}" fill="none" stroke="#fff" stroke-opacity=".35" stroke-width="2"/><path d="M{w/2} 12V{h-12}" stroke="#fff" stroke-opacity=".35" stroke-width="2"/><circle cx="{w/2}" cy="{h/2}" r="18" fill="none" stroke="#fff" stroke-opacity=".35" stroke-width="2"/>',
     'hotel': f'<rect width="{w}" height="{h}" fill="#e9dcc6"/><rect x="40" y="24" width="90" height="56" fill="#9cc4ea"/><path d="M40 70 Q85 52 130 66 V80 H40z" fill="#7fae8a"/><rect x="38" y="22" width="94" height="60" fill="none" stroke="#fff" stroke-width="4"/><rect x="170" y="54" width="140" height="30" rx="6" fill="#fff"/><rect x="170" y="44" width="60" height="18" rx="6" fill="#f6efe3"/><rect y="84" width="{w}" height="12" fill="#cbb79a"/>',
     'movie': f'<rect width="{w}" height="{h}" fill="#1c1d22"/><rect x="40" y="10" width="{w-80}" height="54" rx="4" fill="#d9c79a"/><path d="M40 64 L{w-40} 64 L{w-20} {h} L20 {h}z" fill="#2a2b30"/>' + ''.join(f'<rect x="{30+i*24}" y="{h-16}" width="16" height="10" rx="4" fill="#8e1f2a"/>' for i in range(12)),
     'museum': f'<rect width="{w}" height="{h}" fill="#efe6d6"/>' + ''.join(f'<rect x="{28+i*62}" y="18" width="44" height="54" fill="{c}"/><rect x="{26+i*62}" y="16" width="48" height="58" fill="none" stroke="#5a4a3a" stroke-width="2"/>' for i,c in enumerate(['#c96f4a','#4f6f8f','#e2b65c','#7a9a6a','#8a5a4e'])) + f'<rect y="{h-12}" width="{w}" height="12" fill="#cbb79a"/>',
     'member': f'<rect width="{w}" height="{h}" fill="#2e5e57"/>' + ''.join(f'<ellipse cx="{w-70}" cy="{h/2}" rx="{30+i*8}" ry="{60-i*4}" transform="rotate({i*14} {w-70} {h/2})" fill="none" stroke="#fff" stroke-opacity=".14"/>' for i in range(10)),
     'flight': f'<rect width="{w}" height="{h}" fill="#9cc4ea"/><path d="M0 {h-20} Q90 {h-40} 170 {h-24} T{w} {h-30} V{h} H0z" fill="#7fae8a"/><ellipse cx="70" cy="30" rx="30" ry="9" fill="#fff" opacity=".9"/><ellipse cx="260" cy="40" rx="36" ry="10" fill="#fff" opacity=".8"/>',
     'train': f'<rect width="{w}" height="{h}" fill="#d6e4ec"/><path d="M0 {h-28} Q80 {h-46} 160 {h-32} T{w} {h-38} V{h} H0z" fill="#9fbf9a"/><rect y="{h-16}" width="{w}" height="4" fill="#6b5a4e"/><rect x="60" y="{h-46}" width="220" height="26" rx="12" fill="#fff"/><rect x="60" y="{h-30}" width="220" height="5" fill="#b8323a"/>' + ''.join(f'<rect x="{78+i*32}" y="{h-42}" width="22" height="9" rx="2" fill="#9cc4ea"/>' for i in range(6)),
    }
    return f'<svg class="art" viewBox="0 0 {w} {h}" preserveAspectRatio="xMidYMid slice">{S[k]}</svg>'
fields = lambda xs, cls='': f'<div class="fs {cls}">' + ''.join(f'<span><small>{a}</small><b>{b}</b></span>' for a,b in xs) + '</div>'
def route(p, dark=True):
    return f'<div class="rt"><div><b>{p["a"][0]}</b><small>{p["a"][1]}</small></div><span class="mid">{ic(p["ic"],20)}</span><div class="r"><b>{p["b"][0]}</b><small>{p["b"][1]}</small></div></div>'
# A — 애플 지갑 정석: 색 바탕, 이동은 출발 · 도착 큰 글자 + 가운데 아이콘, 이벤트는 그림 띠(strip)
def A(p):
    mid = route(p) if 'a' in p else f'{art(p["k"])}<div class="ti">{p["title"]}</div>'
    return f'<div class="pA" style="background:{p["c"]}"><div class="hd"><span class="lg">{ic(p["ic"])}</span><b>{p["by"]}</b><span class="tp"><small>{p["top"][0]}</small>{p["top"][1]}</span></div>{mid}{fields(p["f"])}</div>'
# B — 흰 카드 앱 티켓: 흰 바탕, 왼쪽 위 종류 알약(색), 큰 제목, 오른쪽 작은 그림 원, 아래 칸
def B(p):
    title = f'{p["a"][0]} → {p["b"][0]}' if 'a' in p else p['title']
    return f'<div class="pB"><div class="top"><span class="pill" style="background:{p["c"]}">{ic(p["ic"],13,"#fff")}{p["kind"]}</span><span class="by">{p["by"]}</span><span class="thumb">{art(p["k"],64,64)}</span></div><div class="ti">{title}</div><div class="when"><b>{p["top"][1]}</b><small>{p["top"][0]}</small></div>{fields(p["f"],"dk")}</div>'
# C — 그림 카드 (포스터): 위 절반을 그 종류 그림이 채우고, 아래 색 판에 글자
def C(p):
    title = f'{p["a"][0]} → {p["b"][0]}' if 'a' in p else p['title']
    return f'<div class="pC" style="background:{p["c"]}">{art(p["k"],340,110)}<div class="ov"><span class="lg">{ic(p["ic"])}</span><b>{p["by"]}</b><span class="tp">{p["top"][1]}</span></div><div class="ti">{title}</div>{fields(p["f"])}</div>'
# D — 미니멀 다크: 거의 검정 판, 종류 색은 왼쪽 굵은 띠 + 아이콘만, 큰 숫자 한 개
def D(p):
    big = f'{p["a"][0]}<i>{ic("arrow",18)}</i>{p["b"][0]}' if 'a' in p else p['title']
    return f'<div class="pD" style="--c:{p["c"]}"><i class="bar"></i><div class="hd"><span class="lg">{ic(p["ic"],16)}</span><b>{p["by"]}</b><span class="tp"><small>{p["top"][0]}</small>{p["top"][1]}</span></div><div class="big">{big}</div>{fields(p["f"])}</div>'
V = [('A','애플 지갑 정석','색 바탕 하나, 이동(항공 · 기차)은 출발 · 도착 큰 글자 + 가운데 아이콘, 공연 · 경기 · 숙소 · 영화 · 전시는 그 종류 그림 띠. 칸 라벨은 작은 영문 대문자.',A),
     ('B','흰 카드 앱 티켓','흰 카드에 종류 알약(색) · 오른쪽 위 작은 그림 동그라미 · 큰 제목 · 큰 시각. 티켓 앱 · 배달 앱 같은 요즘 화면.',B),
     ('C','그림 카드 (포스터)','위를 그 종류 그림이 채우고 회사 · 시각을 그 위에, 아래 색 판에 제목 · 칸. 덱에서도 그림이 먼저 보여요.',C),
     ('D','미니멀 다크','거의 검정 판에 종류 색은 왼쪽 띠와 아이콘만, 제목 · 도시를 크게. 조용하고 고급.',D)]
css = open('stylew.css').read()
html = f'<!doctype html><html lang="ko"><head><meta charset="utf-8"><style>{css}</style></head><body><h1>지갑 › 디지털 표 — 시안 A–D</h1><p class="s">같은 8장(항공 · 기차 · 콘서트 · 경기 · 숙소 · 영화 · 전시 · 회원권). 고르면 버스 · 배 · 공연 · 놀이공원까지 12종류로</p><div class="row">' + ''.join(f'<div class="col"><b>{k}. {t}</b><small>{d}</small><div class="ph">{"".join(fn(p) for p in K[:4])}</div><div class="ph">{"".join(fn(p) for p in K[4:])}</div></div>' for k,t,d,fn in V) + '</div></body></html>'
open('passesw.html','w').write(html)
