# 지갑 › 표 디자인 시안 A–D. 같은 표 4장(항공 · 콘서트 · 기차 · 전시)
P = [
 dict(k='flight', by='LUFTHANSA', lab='탑승', t='14:50', big=('FRA','ICN'), f=[('날짜','09.11.'),('탑승구','A13'),('좌석','1A'),('편명','LH 712')], c='#2c4a80', c2='#1d3461', ic='M2 16l20-8-20-8v6l14 2-14 2z'),
 dict(k='concert', by='ALTE OPER FRANKFURT', lab='입장', t='20:00', title='Max Richter · Voices', f=[('날짜','14.11.'),('구역','Parkett'),('좌석','Reihe 7 · 12'),('번호','AO-8821')], c='#26304f', c2='#171d33', ic='M9 18V5l12-2v13M9 18a3 3 0 1 1-6 0 3 3 0 0 1 6 0zM21 16a3 3 0 1 1-6 0 3 3 0 0 1 6 0z'),
 dict(k='train', by='DEUTSCHE BAHN', lab='출발', t='09:54', big=('Frankfurt Hbf','Köln Hbf'), f=[('날짜','10.11.'),('열차','ICE 123'),('좌석','Wg 7 · 45')], c='#8e3a33', c2='#6c2a25', ic='M6 4h12a2 2 0 0 1 2 2v9H4V6a2 2 0 0 1 2-2zM4 11h16M8 19l-2 2M16 19l2 2M8 15h.01M16 15h.01'),
 dict(k='museum', by='STÄDEL MUSEUM', lab='관람', t='11:00', title='Rembrandt · Licht', f=[('날짜','16.11.'),('입장권','성인'),('번호','ST-2207')], c='#efe2cf', c2='#d9c6aa', ic='M3 9l9-5 9 5M5 9v9M9 9v9M15 9v9M19 9v9M3 20h18', light=True),
]
I = lambda d, s=16, c='currentColor', w=1.9: f'<svg width="{s}" height="{s}" viewBox="0 0 24 24" fill="none" stroke="{c}" stroke-width="{w}" stroke-linecap="round" stroke-linejoin="round"><path d="{d}"/></svg>'
# --- per-kind art for A (patterns) and B (illustration strip) and D (big glyph)
def patA(p):
    k=p['k']; o='rgba(255,255,255,.09)' if not p.get('light') else 'rgba(80,60,30,.09)'
    if k=='flight': return f'<path d="M-10 150 Q170 20 350 120" stroke="{o}" stroke-width="2" fill="none" stroke-dasharray="6 7"/><circle cx="280" cy="40" r="70" fill="{o}"/><circle cx="280" cy="40" r="110" fill="none" stroke="{o}" stroke-width="10"/>'
    if k=='concert': return ''.join(f'<path d="M260 -10 L{80+i*40} 230" stroke="{o}" stroke-width="{18-i*2}"/>' for i in range(6)) + f'<circle cx="260" cy="-10" r="26" fill="{o}"/>'
    if k=='train': return ''.join(f'<path d="M0 {150+i*9} L340 {150+i*9}" stroke="{o}" stroke-width="2"/>' for i in range(2)) + ''.join(f'<rect x="{i*28}" y="146" width="10" height="24" fill="{o}"/>' for i in range(13))
    return ''.join(f'<path d="M{170+i*40} 230 V110 a20 20 0 0 1 40 0 V230" stroke="{o}" stroke-width="5" fill="none"/>' for i in range(5))
def stripB(p):
    k=p['k']
    if k=='flight': return '<rect width="340" height="74" fill="#9cc4ea"/><path d="M0 60 Q90 40 170 56 T340 50 V74 H0z" fill="#7fae8a"/><path d="M0 66 Q120 54 220 64 T340 62 V74 H0z" fill="#5f9a6c"/><ellipse cx="70" cy="22" rx="26" ry="8" fill="#fff" opacity=".9"/><ellipse cx="250" cy="30" rx="34" ry="9" fill="#fff" opacity=".8"/><path d="M150 30 l26 -6 -26 -6 v4 l14 2 -14 2z" fill="#fff"/>'
    if k=='concert': return '<rect width="340" height="74" fill="#1b2140"/>' + ''.join(f'<path d="M{60+i*55} 0 L{40+i*55} 74 H{90+i*55}z" fill="#f2d28a" opacity="{.18+.06*(i%2)}"/>' for i in range(5)) + '<rect y="58" width="340" height="16" fill="#0f1326"/>' + ''.join(f'<circle cx="{20+i*24}" cy="62" r="7" fill="#0b0e1c"/>' for i in range(14))
    if k=='train': return '<rect width="340" height="74" fill="#cfe0ea"/><path d="M0 50 Q80 30 160 46 T340 40 V74 H0z" fill="#9fbf9a"/><rect y="58" width="340" height="4" fill="#6b5a4e"/><rect x="40" y="34" width="200" height="22" rx="10" fill="#fff"/><rect x="40" y="48" width="200" height="4" fill="#b8323a"/>' + ''.join(f'<rect x="{56+i*30}" y="38" width="20" height="8" rx="2" fill="#9cc4ea"/>' for i in range(6))
    return '<rect width="340" height="74" fill="#efe6d6"/><rect x="0" y="0" width="340" height="12" fill="#d9c6aa"/>' + ''.join(f'<rect x="{30+i*60}" y="18" width="40" height="44" fill="{c}"/>' for i,c in enumerate(['#c96f4a','#4f6f8f','#e2b65c','#7a9a6a','#8a5a4e'])) + '<rect y="62" width="340" height="12" fill="#cbb79a"/>'
def glyphD(p):
    return f'<svg class="gD" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"><path d="{p["ic"]}"/></svg>'
def body(p, big_cls='', white=False):
    fg = 'f' + (' dk' if p.get('light') and not white else '')
    mid = (f'<div class="rt"><b class="{"bg" if len(p["big"][0])<=4 else "sm"}">{p["big"][0]}</b><i>✈</i><b class="{"bg" if len(p["big"][1])<=4 else "sm"} r">{p["big"][1]}</b></div>' if 'big' in p else f'<div class="ti">{p["title"]}</div>')
    flds = '<div class="fl">' + ''.join(f'<span><small>{a}</small><b>{b}</b></span>' for a,b in p['f']) + '</div>'
    return mid + flds
def head(p): return f'<div class="hd"><span class="lg">{I(p["ic"])}</span><span class="by">{p["by"]}</span><span class="hr">{p["lab"]}<b>{p["t"]}</b></span></div>'
def cardA(p, full):
    return f'<div class="ps A{" lt" if p.get("light") else ""}" style="background:{p["c"]}"><svg class="pat" viewBox="0 0 340 230" preserveAspectRatio="xMidYMid slice">{patA(p)}</svg>{head(p)}{body(p) if full else ""}</div>'
def cardB(p, full):
    return f'<div class="ps B"><svg class="strip" viewBox="0 0 340 74" preserveAspectRatio="none">{stripB(p)}</svg><div class="bbar" style="background:{p["c"] if not p.get("light") else "#8a6a4a"}">{head(p)}</div>{("<div class=bbody>"+body(p, white=True)+"</div>") if full else ""}</div>'
def cardC(p, full):
    return f'<div class="ps C" style="--c:{p["c"] if not p.get("light") else "#a8875a"}"><div class="main">{head(p)}{body(p, white=True) if full else ""}</div>{("<div class=stub><i></i><b>"+p["t"]+"</b><small>"+p["f"][0][1]+"</small><span class=bars>"+"".join("<u style=height:%dpx></u>"%(8+(i*7)%14) for i in range(14))+"</span></div>") if full else "<div class=stub sm><b>"+p["t"]+"</b></div>"}</div>'
def cardD(p, full):
    return f'<div class="ps D{" lt" if p.get("light") else ""}" style="background:{p["c"]};--c2:{p["c2"]}"><div class="half"></div>{glyphD(p)}{head(p)}{body(p) if full else ""}</div>'
def deck(fn):
    return '<div class="deck">' + ''.join(f'<div class="sh">{fn(p, False)}</div>' for p in P[:3]) + f'<div class="op">{fn(P[3] if False else P[0], True)}</div></div>'
def deck2(fn, op):
    order=[x for x in P if x is not op]+[op]
    return '<div class="deck">' + ''.join(f'<div class="sh">{fn(p, False)}</div>' for p in order[:-1]) + f'<div class="op">{fn(op, True)}</div></div>'
V=[('A','무늬 (은행 카드처럼)','지금 색은 그대로, 종류마다 흰 무늬를 옅게: 항공은 항로 점선 · 해, 공연은 조명 빛줄기, 기차는 철로, 전시는 아치. 카드들과 같은 질감.',cardA),
   ('B','그림 띠 + 흰 몸통','위에 그 종류의 플랫 그림 띠(하늘과 비행기, 무대 조명, 달리는 열차, 액자 벽), 가운데 색 띠에 회사, 아래는 흰 종이에 정보.',cardB),
   ('C','진짜 티켓 (떼는 쪽)','오른쪽에 점선으로 떼는 부분(시간 · 날짜 · 바코드), 가운데 홈 두 개. 몸통은 흰 종이, 위 색 띠.',cardC),
   ('D','큰 아이콘 + 두 톤','종류 아이콘을 카드 오른쪽에 크게 비침(선만), 아래 반을 진한 색으로 나눠 두 톤. 글자는 그대로.',cardD)]
css=open('style.css').read()
html=f'<!doctype html><html lang="ko"><head><meta charset="utf-8"><style>{css}</style></head><body><h1>지갑 › 표 디자인 — 시안 A–D</h1><p class="s">같은 표 4장 · 위: 항공이 펼쳐진 덱, 아래: 콘서트 · 전시가 펼쳐진 모습. 고르면 12종류(항공 · 기차 · 버스 · 배 · 숙소 · 콘서트 · 공연 · 영화 · 경기 · 전시 · 놀이공원 · 회원권)로 그려요</p><div class="row">' + ''.join(f'<div class="col"><b>{k}. {t}</b><small>{d}</small><div class="ph"><div class="h1">지갑</div>{deck2(fn,P[0])}</div><div class="ph"><div class="one">{fn(P[1],True)}</div><div class="one">{fn(P[3],True)}</div><div class="one">{fn(P[2],True)}</div></div></div>' for k,t,d,fn in V) + '</div></body></html>'
open('passes.html','w').write(html)
