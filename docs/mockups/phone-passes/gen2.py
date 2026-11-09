# 지갑 › 표 시안 2 — 색은 지금 PASS 색 그대로, 무늬만 종류마다 다르게. 항공 · 기차 · 회원권은 확정, 나머지 9종은 ①② 두 안
import math
def S(fg, op, w=.8): return f'stroke="{fg}" stroke-opacity="{op}" fill="none" stroke-width="{w}"'
def kept(k, fg, op=.2):
    s = S(fg, op)
    if k == 'flight':
        cx, cy, r = 270, 150, 120
        o = ''.join(f'<ellipse cx="{cx}" cy="{cy}" rx="{r*abs(math.cos(a/180*math.pi)):.1f}" ry="{r}" {s}/>' for a in range(0, 90, 15))
        o += ''.join(f'<path d="M{cx-r} {cy-r*math.sin(a/180*math.pi):.1f} H{cx+r}" {s}/>' for a in (-45, -20, 0, 20, 45))
        return o + f'<path d="M140 70 Q240 30 330 95" stroke="{fg}" stroke-opacity="{op*2.2}" fill="none" stroke-width="1.1" stroke-dasharray="2 4"/><circle cx="140" cy="70" r="2.4" fill="{fg}" fill-opacity="{op*2.5}"/>'
    if k == 'train':
        return ''.join(f'<path d="M360 84 L-20 {y}" {s}/>' for y in range(-60, 300, 18))
    if k == 'member':
        return ''.join(f'<circle cx="{150+c*16}" cy="{12+r*16}" r="{0.6+(c+r)*0.12:.2f}" fill="{fg}" fill-opacity="{op*1.6}"/>' for c in range(12) for r in range(12))
def m1(k, fg, op=.2):
    s = S(fg, op)
    if k == 'concert':   # rings spreading from a point, like sound in a hall
        return ''.join(f'<circle cx="300" cy="100" r="{r}" {s}/>' for r in range(14, 260, 13))
    if k == 'hotel':     # a facade: rows of thin windows
        return ''.join(f'<rect x="{170+c*20}" y="{14+r*24}" width="10" height="14" rx="5" {s}/>' for c in range(9) for r in range(8))
    if k == 'match':     # the pitch, fine lines
        return f'<rect x="150" y="10" width="300" height="180" {s}/><path d="M260 10 V190" {s}/><circle cx="260" cy="100" r="34" {s}/><circle cx="260" cy="100" r="1.8" fill="{fg}" fill-opacity="{op*2}"/><rect x="380" y="50" width="70" height="100" {s}/>'
    if k == 'movie':     # a projector beam: fine rays from one corner
        return ''.join(f'<path d="M345 -5 L{100+i*14} 210" {s}/>' for i in range(18)) + f'<circle cx="345" cy="-5" r="10" {s}/>'
    if k == 'museum':    # frames hung on a wall
        fr = [(170,24,60,76),(240,24,40,40),(240,74,40,26),(292,24,60,46),(292,80,28,40),(330,80,22,40),(170,112,46,60),(226,112,56,60)]
        return ''.join(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" {s}/><rect x="{x+4}" y="{y+4}" width="{w-8}" height="{h-8}" {S(fg, op*.6)}/>' for x, y, w, h in fr)
    if k == 'bus':       # a route line with stops
        pts = [(150,150),(190,150),(220,120),(270,120),(300,90),(350,90)]
        d = 'M' + ' L'.join(f'{x} {y}' for x, y in pts)
        return f'<path d="{d}" stroke="{fg}" stroke-opacity="{op*2}" fill="none" stroke-width="1.4" stroke-linejoin="round"/>' + ''.join(f'<circle cx="{x}" cy="{y}" r="3.2" fill="none" stroke="{fg}" stroke-opacity="{op*2.4}" stroke-width="1.2"/>' for x, y in pts[::1])
    if k == 'ferry':     # stacked waves
        return ''.join(f'<path d="M140 {y} ' + ' '.join(f'Q{150+i*20} {y-5} {160+i*20} {y} T{180+i*20} {y}' for i in range(0, 12, 2)) + f'" {s}/>' for y in range(20, 200, 12))
    if k == 'theater':   # curtain folds
        return ''.join(f'<path d="M{160+i*12} -5 C{160+i*12+5} 60 {160+i*12-5} 120 {160+i*12+(i-9)*1.6} 210" {s}/>' for i in range(18)) + f'<path d="M150 18 Q250 46 350 18" {S(fg, op*1.6)}/>'
    if k == 'park':      # a wheel: spokes and rim
        cx, cy = 280, 96
        return f'<circle cx="{cx}" cy="{cy}" r="78" {s}/><circle cx="{cx}" cy="{cy}" r="70" {s}/>' + ''.join(f'<path d="M{cx} {cy} L{cx+78*math.cos(a*math.pi/12):.1f} {cy+78*math.sin(a*math.pi/12):.1f}" {s}/><circle cx="{cx+78*math.cos(a*math.pi/12):.1f}" cy="{cy+78*math.sin(a*math.pi/12):.1f}" r="4" {s}/>' for a in range(24)) + f'<path d="M{cx} {cy} L{cx-40} 210 M{cx} {cy} L{cx+40} 210" {s}/>'
def m2(k, fg, op=.2):
    s = S(fg, op)
    if k == 'concert':   # two spotlight cones from above
        o = ''.join(f'<path d="M230 -10 L{200+i*9} 210" {s}/>' for i in range(10))
        return o + ''.join(f'<path d="M330 -10 L{250+i*9} 210" {s}/>' for i in range(10))
    if k == 'hotel':     # a crescent moon over a quiet horizon
        return f'<path d="M300 30 a34 34 0 1 0 22 60 a28 28 0 1 1 -22 -60z" {S(fg, op*1.5)}/>' + ''.join(f'<path d="M150 {150+i*9} H360" {S(fg, op*(1-i*.12))}/>' for i in range(6)) + ''.join(f'<circle cx="{x}" cy="{y}" r=".9" fill="{fg}" fill-opacity="{op*2}"/>' for x, y in [(200,30),(240,62),(184,96),(262,20),(350,120),(220,118)])
    if k == 'match':     # stadium bowl: rounded rings
        return ''.join(f'<rect x="{180-i*14}" y="{60-i*14}" width="{200+i*28}" height="{80+i*28}" rx="{40+i*14}" {s}/>' for i in range(8))
    if k == 'movie':     # film strip along the right edge
        o = f'<path d="M262 -5 V210 M338 -5 V210" {s}/>' + ''.join(f'<rect x="268" y="{y}" width="64" height="40" rx="2" {s}/>' for y in range(-10, 210, 48))
        return o + ''.join(f'<rect x="{x}" y="{y}" width="4" height="6" rx="1" {s}/>' for x in (254, 342) for y in range(0, 210, 14))
    if k == 'museum':    # fluted columns
        return ''.join(f'<path d="M{170+c*44+i*5} 30 V190" {s}/>' for c in range(4) for i in range(6)) + f'<path d="M160 24 H360 M160 196 H360" {S(fg, op*1.6)}/>'
    if k == 'bus':       # lane dashes into the distance
        o = f'<path d="M250 70 L150 210 M290 70 L390 210" {s}/>'
        return o + ''.join(f'<path d="M270 {70+t*t*140:.1f} V{70+(t+.06)**2*140:.1f}" stroke="{fg}" stroke-opacity="{op*2}" stroke-width="{1+t*3:.1f}"/>' for t in [i*.12 for i in range(1, 9)]) + ''.join(f'<path d="M150 {70-i*8} H390" {S(fg, op*.5)}/>' for i in range(6))
    if k == 'ferry':     # sea chart: compass rose and bearings
        cx, cy = 290, 100
        return ''.join(f'<path d="M{cx} {cy} L{cx+150*math.cos(a*math.pi/16):.1f} {cy+150*math.sin(a*math.pi/16):.1f}" {s}/>' for a in range(32)) + ''.join(f'<circle cx="{cx}" cy="{cy}" r="{r}" {s}/>' for r in (24, 48))
    if k == 'theater':   # nested arches of a stage
        return ''.join(f'<path d="M{200-i*14} 210 V{110-i*4} A{80+i*14} {80+i*14} 0 0 1 {360+i*14} {110-i*4} V210" {s}/>' for i in range(7))
    if k == 'park':      # a coaster track: two rails with ties
        t = [(i/60) for i in range(61)]
        f = lambda u: (140+u*230, 120-60*math.sin(u*math.pi*2.2)*(1-u*.3))
        a = 'M' + ' L'.join(f'{x:.1f} {y:.1f}' for x, y in map(f, t)); b = 'M' + ' L'.join(f'{x:.1f} {y+10:.1f}' for x, y in map(f, t))
        return f'<path d="{a}" {S(fg, op*1.6)}/><path d="{b}" {S(fg, op*1.6)}/>' + ''.join(f'<path d="M{f(u)[0]:.1f} {f(u)[1]:.1f} v10" {s}/>' for u in t[::2]) + ''.join(f'<path d="M{f(u)[0]:.1f} {f(u)[1]+10:.1f} V210" {S(fg, op*.6)}/>' for u in t[::6])
# colors: today's PASS map (src/phonemoney.js); new kinds take colors already on the phone
C = dict(flight='#2c4a80', train='#8e3a33', member='#2e5e57', concert='#26304f', hotel='#efe2cf', match='#2f6a3a', movie='#1d1d22', museum='#f3ede4', bus='#2f6f8f', ferry='#24505c', theater='#6a2a3e', park='#8a5a2e')
ACC = dict(flight='#a9c4f0', train='#f2b6a6', member='#a8dccc', concert='#c9b8ff', hotel='#8a5a2a', match='#bfe6a0', movie='#f0c96a', museum='#7a5a3a', bus='#a8e0f2', ferry='#9fe0dc', theater='#f2b8c8', park='#ffd28a')
LIGHT = {'hotel', 'museum'}
K = dict(
 flight=dict(by='LUFTHANSA', kind='탑승권', a='FRA', b='ICN', ac='Frankfurt', bc='Seoul', when=('탑승','14:50'), f=[('날짜','09.11.'),('탑승구','A13'),('좌석','1A'),('편명','LH 712')]),
 train=dict(by='DEUTSCHE BAHN', kind='승차권', a='Frankfurt', b='Köln', ac='09:54', bc='11:02', when=('출발','09:54'), f=[('날짜','10.11.'),('열차','ICE 123'),('칸','7'),('좌석','45')]),
 member=dict(by='URBAN SPORTS CLUB', kind='회원권', title='MARA VARO', sub='M · 월 회원', when=('까지','31.12.'), f=[('시작','01.10.'),('번호','US-88 204')]),
 concert=dict(by='FESTHALLE', kind='콘서트', title='IU', sub='H.E.R. World Tour', when=('입장','19:00'), f=[('날짜','14.11.'),('구역','Floor A'),('열','7'),('좌석','12')]),
 hotel=dict(by='HOTEL LISBOA MAR', kind='숙소', title='30.10. – 02.11.', sub='3박 · Deluxe', when=('체크인','15:00'), f=[('객실','412'),('인원','2'),('예약','HL-2231')]),
 match=dict(by='DEUTSCHE BANK PARK', kind='경기', title='Eintracht – Bayern', sub='Bundesliga · 12. Spieltag', when=('킥오프','18:30'), f=[('날짜','22.11.'),('블록','43'),('열','12'),('좌석','9')]),
 movie=dict(by='CINESTAR METROPOLIS', kind='영화', title='Dune: Part Three', sub='OV · IMAX', when=('상영','20:15'), f=[('날짜','16.11.'),('관','5'),('열','H'),('좌석','14')]),
 museum=dict(by='STÄDEL MUSEUM', kind='전시', title='Rembrandt — Licht', sub='특별전', when=('입장','11:00'), f=[('날짜','18.11.'),('입장권','성인'),('번호','ST-4471')]),
 bus=dict(by='FLIXBUS', kind='버스', a='Frankfurt', b='Berlin', ac='07:30', bc='13:05', when=('출발','07:30'), f=[('날짜','20.11.'),('좌석','12C'),('예약','FX-3302')]),
 ferry=dict(by='TRANSTEJO', kind='배', a='Lisboa', b='Cacilhas', ac='10:20', bc='10:30', when=('출항','10:20'), f=[('날짜','31.10.'),('갑판','2'),('예약','TT-0917')]),
 theater=dict(by='OPER FRANKFURT', kind='공연', title='La Traviata', sub='Verdi · 3막', when=('개막','19:30'), f=[('날짜','25.11.'),('층','1. Rang'),('열','3'),('좌석','21')]),
 park=dict(by='EUROPA-PARK', kind='놀이공원', title='1일 입장권', sub='성인 1 · 패스트레인', when=('개장','09:00'), f=[('날짜','29.11.'),('인원','1'),('번호','EP-55 120')]),
)
def card(k, art):
    p, bg, fg, acc = K[k], C[k], ('#3a2e1e' if k in LIGHT else '#ffffff'), ACC[k]
    txt = '#1b1f27' if k in LIGHT else '#ffffff'; sub = 'rgba(27,31,39,.55)' if k in LIGHT else 'rgba(255,255,255,.62)'
    big = (f'<div class="rt"><div><b>{p["a"]}</b><small>{p["ac"]}</small></div><span class="ln" style="background:{acc}"></span><div class="r"><b>{p["b"]}</b><small>{p["bc"]}</small></div></div>'
           if 'a' in p else f'<div class="tt"><b>{p["title"]}</b><small>{p["sub"]}</small></div>')
    if 'a' in p and len(p['a']) > 4: big = big.replace('class="rt"', 'class="rt sm"')
    fl = '<div class="fs">' + ''.join(f'<span><small>{a}</small><b>{b}</b></span>' for a, b in p['f']) + '</div>'
    return f'''<div class="ps" style="background:{bg};color:{txt};--sub:{sub};--acc:{acc}"><svg class="mo" viewBox="0 0 340 200" preserveAspectRatio="xMaxYMid slice">{art(k, fg, .26 if k in LIGHT else .2)}</svg>
<div class="hd"><i class="dot" style="background:{acc}"></i><b>{p["by"]}</b><span class="kd">{p["kind"]}</span></div>{big}<div class="bt">{fl}<div class="wh"><small>{p["when"][0]}</small><b>{p["when"][1]}</b></div></div></div>'''
NEW = ['concert', 'hotel', 'match', 'movie', 'museum', 'bus', 'ferry', 'theater', 'park']
NAME = dict(concert=('소리 퍼지는 원', '조명 두 줄기'), hotel=('건물 창문', '달 + 수평선'), match=('경기장 선', '관중석 고리'), movie=('영사기 빛', '필름 띠'), museum=('벽에 건 액자', '기둥 홈'), bus=('노선 + 정류장', '차선'), ferry=('물결', '나침반 방위선'), theater=('막 주름', '무대 아치'), park=('관람차', '롤러코스터 선로'))
css = open('stylep.css').read() + '.rt.sm b{font-size:30px}.ps .wh b{color:var(--acc)}.lab{font-size:12px;font-weight:700;color:#444;margin:4px 4px -6px}.grid{display:grid;grid-template-columns:repeat(3,410px);gap:24px}'
col = lambda title, body: f'<div class="col"><b>{title}</b><div class="ph list">{body}</div></div>'
keep = col('그대로 둔 3종', ''.join(card(k, kept) for k in ('flight', 'train', 'member')) + '<div class="lab" style="margin-top:14px">지갑 덱</div><div class="deck">' + ''.join(f'<div class="sh">{card(k, m1)}</div>' for k in ('concert', 'hotel', 'match', 'movie')) + f'<div class="sh">{card("member", kept)}</div><div class="op">{card("flight", kept)}</div></div>')
one = col('① 안', ''.join(f'<div class="lab">{k} · {NAME[k][0]}</div>{card(k, m1)}' for k in NEW))
two = col('② 안', ''.join(f'<div class="lab">{k} · {NAME[k][1]}</div>{card(k, m2)}' for k in NEW))
html = f'<!doctype html><html lang="ko"><head><meta charset="utf-8"><style>{css}</style></head><body><h1>지갑 › 표 — 시안 2</h1><p class="s">색은 지금 지갑 색 그대로 · 항공 · 기차 · 회원권 무늬는 그대로 · 나머지 9종은 무늬 ①② 중에 골라 주세요 (섞어도 돼요)</p><div class="grid">{keep}{one}{two}</div></body></html>'
open('passes2.html', 'w').write(html)
