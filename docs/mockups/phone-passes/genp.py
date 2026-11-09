# 지갑 › 표 시안 (다듬은 판) — 그림 대신 종류마다 가는 선 무늬, 여백, 큰 숫자 하나
import math
def motif(k, fg, w=340, h=200, op=.22):
    s = f'stroke="{fg}" stroke-opacity="{op}" fill="none" stroke-width=".8"'
    if k == 'flight':   # globe meridians + a great-circle route
        cx, cy, r = 270, 150, 120
        out = ''.join(f'<ellipse cx="{cx}" cy="{cy}" rx="{r*abs(math.cos(a/180*math.pi)):.1f}" ry="{r}" {s}/>' for a in range(0, 90, 15))
        out += ''.join(f'<path d="M{cx-r} {cy-r*math.sin(a/180*math.pi):.1f} H{cx+r}" {s}/>' for a in (-45, -20, 0, 20, 45))
        return out + f'<path d="M150 40 Q250 -10 330 70" stroke="{fg}" stroke-opacity="{op*2.2}" fill="none" stroke-width="1.1" stroke-dasharray="2 4"/><circle cx="150" cy="40" r="2.4" fill="{fg}" fill-opacity="{op*2.5}"/>'
    if k == 'train':    # speed lines to a vanishing point
        return ''.join(f'<path d="M{w+20} {h*0.42} L{-20} {y}" {s}/>' for y in range(-60, 300, 18))
    if k == 'concert':  # a sound wave, fine bars
        return ''.join(f'<path d="M{140+i*5} {100-v:.1f} V{100+v:.1f}" stroke="{fg}" stroke-opacity="{op*1.6}" stroke-width="2" stroke-linecap="round"/>' for i, v in enumerate([abs(math.sin(i*.42)*math.sin(i*.09+1)*58)+3 for i in range(40)]))
    if k == 'hotel':    # art deco fan
        out = ''.join(f'<path d="M270 210 L{270+170*math.cos((180+a)/180*math.pi):.1f} {210+170*math.sin((180+a)/180*math.pi):.1f}" {s}/>' for a in range(0, 181, 9))
        return out + ''.join(f'<path d="M{270-r} 210 A{r} {r} 0 0 1 {270+r} 210" {s}/>' for r in (60, 100, 140))
    if k == 'match':    # a net, hexagons
        out = ''
        for row in range(9):
            for col in range(10):
                x = 150 + col * 22 + (11 if row % 2 else 0); y = row * 19
                out += f'<path d="M{x} {y-11} l9.5 5.5 v11 l-9.5 5.5 l-9.5 -5.5 v-11z" {s}/>'
        return out
    if k == 'member':   # a dotted grid, larger where the corner is
        return ''.join(f'<circle cx="{150+c*16}" cy="{12+r*16}" r="{0.6+ (c+r)*0.12:.2f}" fill="{fg}" fill-opacity="{op*1.6}"/>' for c in range(12) for r in range(12))
    return ''
K = [
 dict(k='flight', by='LUFTHANSA', kind='탑승권', a='FRA', b='ICN', ac='Frankfurt', bc='Seoul', when=('탑승','14:50'), f=[('날짜','09.11.'),('탑승구','A13'),('좌석','1A'),('편명','LH 712')]),
 dict(k='train', by='DEUTSCHE BAHN', kind='승차권', a='Frankfurt', b='Köln', ac='09:54', bc='11:02', when=('출발','09:54'), f=[('날짜','10.11.'),('열차','ICE 123'),('칸','7'),('좌석','45')]),
 dict(k='concert', by='FESTHALLE', kind='콘서트', title='IU', sub='H.E.R. World Tour', when=('입장','19:00'), f=[('날짜','14.11.'),('구역','Floor A'),('열','7'),('좌석','12')]),
 dict(k='hotel', by='HOTEL LISBOA MAR', kind='숙소', title='30.10. – 02.11.', sub='3박 · Deluxe', when=('체크인','15:00'), f=[('객실','412'),('인원','2'),('예약','HL-2231')]),
 dict(k='match', by='DEUTSCHE BANK PARK', kind='경기', title='Eintracht – Bayern', sub='Bundesliga · 12. Spieltag', when=('킥오프','18:30'), f=[('날짜','22.11.'),('블록','43'),('열','12'),('좌석','9')]),
 dict(k='member', by='URBAN SPORTS CLUB', kind='회원권', title='MARA VARO', sub='M · 월 회원', when=('까지','31.12.'), f=[('시작','01.10.'),('번호','US-88 204')]),
]
# three palettes: A deep tones + fine lines, B dusty pastel light, C graphite + one accent
PAL = {
 'A': dict(flight=('#1e2f52','#e9eef7'), train=('#5a2a2a','#f3e6e1'), concert=('#1f2233','#f2d28a'), hotel=('#23413a','#e6cf9a'), match=('#20392b','#dfeadf'), member=('#2b2b31','#e7e1d4')),
 'B': dict(flight=('#dfe8f4','#2c4a80'), train=('#f2e1dc','#8e3a33'), concert=('#e6e2f0','#3a3a6a'), hotel=('#f1e8d8','#7a5a2a'), match=('#dcebdf','#2f6a46'), member=('#ebe8e2','#3f4a5a')),
 'C': dict(flight=('#1c1d21','#7aa7e8'), train=('#1c1d21','#e07a6a'), concert=('#1c1d21','#e2c26a'), hotel=('#1c1d21','#c9b28a'), match=('#1c1d21','#6cc28e'), member=('#1c1d21','#a9b1bd')),
}
def card(p, v):
    bg, fg = PAL[v][p['k']]
    txt = '#ffffff' if v in 'AC' else '#1b1f27'
    sub = 'rgba(255,255,255,.62)' if v in 'AC' else 'rgba(27,31,39,.55)'
    mfg = fg if v != 'B' else fg
    acc = fg
    if 'a' in p:
        big = f'<div class="rt"><div><b>{p["a"]}</b><small>{p["ac"]}</small></div><span class="ln" style="background:{acc}"></span><div class="r"><b>{p["b"]}</b><small>{p["bc"]}</small></div></div>'
    else:
        big = f'<div class="tt"><b>{p["title"]}</b><small>{p["sub"]}</small></div>'
    fl = '<div class="fs">' + ''.join(f'<span><small>{a}</small><b>{b}</b></span>' for a, b in p['f']) + '</div>'
    ring = f'<i class="dot" style="background:{acc}"></i>'
    return f'''<div class="ps {v}" style="background:{bg};color:{txt};--sub:{sub};--acc:{acc}"><svg class="mo" viewBox="0 0 340 200" preserveAspectRatio="xMaxYMid slice">{motif(p["k"], mfg, op=.20 if v!="B" else .28)}</svg>
<div class="hd">{ring}<b>{p["by"]}</b><span class="kd">{p["kind"]}</span></div>{big}<div class="bt">{fl}<div class="wh"><small>{p["when"][0]}</small><b>{p["when"][1]}</b></div></div></div>'''
V = [('A','딥 톤 + 가는 선 무늬','짙은 색 바탕에 종류마다 다른 가는 선 무늬(항공 지구 경선 · 기차 속도선 · 콘서트 음파 · 숙소 아르데코 부채 · 경기 그물 · 회원권 점 격자). 은행 카드와 같은 무게.'),
     ('B','먼지 낀 파스텔 (밝게)','폰의 파스텔 결을 따라 밝은 바탕 + 같은 계열 진한 선 · 글자. 무늬는 같은 것, 색만 밝게.'),
     ('C','그래파이트 + 한 색','바탕은 다 같은 짙은 회색, 종류는 무늬 색 하나로만 구분(파랑 · 다홍 · 금 · 모래 · 초록 · 은). 제일 조용함.')]
css = open('stylep.css').read()
deck = lambda v: '<div class="deck">' + ''.join(f'<div class="sh">{card(p, v)}</div>' for p in K[1:]) + f'<div class="op">{card(K[0], v)}</div></div>'
html = f'<!doctype html><html lang="ko"><head><meta charset="utf-8"><style>{css}</style></head><body><h1>지갑 › 표 — 다듬은 시안 A–C</h1><p class="s">그림 대신 종류마다 다른 가는 선 무늬 · 큰 글자 하나 · 여백. 위: 지갑 덱, 아래: 펼친 6장</p><div class="row">' + ''.join(f'<div class="col"><b>{k}. {t}</b><small>{d}</small><div class="ph"><div class="h1">지갑</div>{deck(k)}</div><div class="ph list">{"".join(card(p, k) for p in K)}</div></div>' for k, t, d in V) + '</div></body></html>'
open('passesp.html', 'w').write(html)
