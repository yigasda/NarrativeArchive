# 지갑 › 표 시안 3 — 무늬가 하나뿐인 5종(숙소 · 전시 · 공연 · 배 · 영화)의 두 번째 무늬 후보 ①②③. 왼쪽은 이미 합격한 무늬
import math
from gen2 import card, S, m1, m2, C, ACC, K, LIGHT
cos, sin, PI = math.cos, math.sin, math.pi
def n(k, fg, op=.2, v=0):
    s = S(fg, op)
    if k == 'hotel':
        if v == 0:   # arched windows
            return ''.join(f'<path d="M{170+c*26} {40+r*44} v-14 a8 8 0 0 1 16 0 v14 z" {s}/>' for c in range(7) for r in range(4))
        if v == 1:   # door frames, one inside another
            return ''.join(f'<rect x="{230-i*12}" y="{30-i*12}" width="{80+i*24}" height="{200}" rx="{40+i*12}" {s}/>' for i in range(8))
        return ''.join(f'<path d="M150 {200-i*14} H{170+i*6} V{180-i*14} H{190+i*8} V{160-i*14} H360" {s}/>' for i in range(10))  # stepped skyline
    if k == 'museum':
        if v == 0:   # frames inside frames, off centre
            return ''.join(f'<rect x="{250-i*14}" y="{70-i*12}" width="{60+i*28}" height="{60+i*24}" {s}/>' for i in range(8))
        if v == 1:   # a dome: ribs and rings
            cx, cy = 270, 210
            return ''.join(f'<path d="M{cx} {cy-150} Q{cx+(i-6)*30} {cy-120} {cx+(i-6)*24} {cy}" {s}/>' for i in range(13)) + ''.join(f'<path d="M{cx-r} {cy} A{r} {150*r/150} 0 0 1 {cx+r} {cy}" {s}/>' for r in (60, 100, 145))
        return ''.join(f'<path d="M{150+i*20} 200 L{250+i*10} 20" {s}/><path d="M{350-i*20} 200 L{250-i*10} 20" {s}/>' for i in range(6)) + ''.join(f'<path d="M{150+j*8} {200-j*16} H{350-j*8}" {s}/>' for j in range(11))  # pyramid lattice
    if k == 'theater':
        if v == 0:   # rows of seats, curved, dotted
            return ''.join(f'<path d="M{150} {80+i*18} Q260 {130+i*24} 370 {80+i*18}" {s} stroke-dasharray="1.2 5" stroke-linecap="round" stroke-width="1.6"/>' for i in range(7))
        if v == 1:   # a spotlight pool on the stage floor
            return ''.join(f'<ellipse cx="270" cy="170" rx="{20+i*14}" ry="{6+i*4.5}" {s}/>' for i in range(8)) + f'<path d="M250 -10 L210 170 M290 -10 L330 170" {s}/>'
        return ''.join(f'<path d="M{150+i*24} -10 L{150+i*24+120} 210 M{150+i*24} 210 L{150+i*24+120} -10" {s}/>' for i in range(-3, 9))  # harlequin diamonds
    if k == 'ferry':
        if v == 0:   # a wake behind the boat
            return ''.join(f'<path d="M330 40 L{150} {60+i*22} M330 40 L{150+i*14} 210" {s}/>' for i in range(8))
        if v == 1:   # depth contours of a sea chart
            return ''.join(f'<path d="M{150+i*6} {200} C{180+i*8} {120-i*6} {260} {150-i*12} {300-i*2} {80-i*8} S{350} {20+i*4} {370} {10+i*14}" {s}/>' for i in range(10))
        return ''.join(f'<path d="M140 {20+i*30} Q260 {i*30} 380 {20+i*30}" {s}/>' for i in range(7)) + ''.join(f'<path d="M{170+j*40} -10 Q{180+j*44} 100 {170+j*48} 210" {s}/>' for j in range(5))  # latitude · longitude
    if k == 'movie':
        if v == 0:   # the countdown leader
            cx, cy = 275, 100
            return ''.join(f'<circle cx="{cx}" cy="{cy}" r="{r}" {s}/>' for r in (40, 62)) + f'<path d="M{cx-90} {cy} H{cx+90} M{cx} {cy-90} V{cy+90}" {s}/><path d="M{cx} {cy} L{cx} {cy-62} A62 62 0 0 1 {cx+62*sin(PI*.7):.1f} {cy-62*cos(PI*.7):.1f} Z" fill="{fg}" fill-opacity="{op*.5}"/>'
        if v == 1:   # a reel
            cx, cy = 280, 100
            return f'<circle cx="{cx}" cy="{cy}" r="84" {s}/><circle cx="{cx}" cy="{cy}" r="10" {s}/>' + ''.join(f'<circle cx="{cx+46*cos(a*PI/3):.1f}" cy="{cy+46*sin(a*PI/3):.1f}" r="22" {s}/>' for a in range(6))
        return ''.join(f'<rect x="{230-i*16}" y="{80-i*6.7:.1f}" width="{96+i*32}" height="{40+i*13.4:.1f}" rx="2" {s}/>' for i in range(8))  # screen frames
NEW = ['hotel', 'museum', 'theater', 'ferry', 'movie']
HAVE = dict(hotel=(m1, '건물 창문'), museum=(m2, '기둥 홈'), theater=(m2, '무대 아치'), ferry=(m1, '물결'), movie=(m1, '영사기 빛'))
NAME = dict(hotel=('아치 창', '겹친 문틀', '계단 지붕선'), museum=('겹친 액자', '돔', '피라미드 격자'), theater=('객석 줄', '바닥 조명', '마름모 격자'), ferry=('항적', '해도 등고선', '위경도'), movie=('카운트다운', '필름 릴', '스크린 틀'))
css = open('stylep.css').read() + '.rt.sm b{font-size:30px}.ps .wh b{color:var(--acc)}.lab{font-size:12px;font-weight:700;color:#444;margin:4px 4px -6px}.grid{display:grid;grid-template-columns:repeat(4,410px);gap:24px}body{width:1760px}'
col = lambda title, body: f'<div class="col"><b>{title}</b><div class="ph list">{body}</div></div>'
cols = [col('이미 합격', ''.join(f'<div class="lab">{k} · {HAVE[k][1]}</div>{card(k, HAVE[k][0])}' for k in NEW))]
for v, t in enumerate('①②③'):
    cols.append(col(f'{t} 안', ''.join(f'<div class="lab">{k} · {NAME[k][v]}</div>{card(k, lambda kk, fg, op, v=v: n(kk, fg, op, v))}' for k in NEW)))
open('passes3.html', 'w').write(f'<!doctype html><html lang="ko"><head><meta charset="utf-8"><style>{css}</style></head><body><h1>지갑 › 표 — 시안 3</h1><p class="s">무늬가 하나뿐인 5종의 두 번째 무늬 후보. 마음에 드는 걸 골라 주세요</p><div class="grid">{"".join(cols)}</div></body></html>')
