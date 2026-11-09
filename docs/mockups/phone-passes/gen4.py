# 지갑 › 표 시안 4 — 영화 · 전시의 두 번째 무늬 후보 ①~④. 왼쪽은 이미 합격한 무늬
import math, sys
sys.dont_write_bytecode = True
from gen2 import card, S, m1, m2
cos, sin, PI = math.cos, math.sin, math.pi
def n(k, fg, op=.2, v=0):
    s = S(fg, op)
    if k == 'museum':
        if v == 0:   # marble veins
            return ''.join(f'<path d="M150 {30+i*16} C200 {10+i*18} 240 {70+i*10} 290 {40+i*14} S350 {60+i*12} 380 {30+i*16}" {S(fg, op*(1.4 if i % 3 == 0 else .7))}/>' for i in range(11))
        if v == 1:   # an arcade going away
            o, x = '', 380
            for i in range(7):
                w = 64 * 0.82 ** i; top = 60 + i * 14; x -= w + 6
                o += f'<path d="M{x:.1f} 210 V{top + w/2:.1f} A{w/2:.1f} {w/2:.1f} 0 0 1 {x + w:.1f} {top + w/2:.1f} V210" {s}/><path d="M{x+5:.1f} 210 V{top + w/2:.1f} A{w/2-5:.1f} {w/2-5:.1f} 0 0 1 {x + w - 5:.1f} {top + w/2:.1f} V210" {S(fg, op*.6)}/>'
            return o
        if v == 2:   # floor tiles in perspective
            return ''.join(f'<path d="M260 40 L{120+i*28} 210" {s}/>' for i in range(11)) + ''.join(f'<path d="M150 {60+j*j*4} H380" {s}/>' for j in range(1, 8))
        cx, cy = 275, 100   # a rosette: circles round a circle
        return ''.join(f'<circle cx="{cx+40*cos(a*PI/6):.1f}" cy="{cy+40*sin(a*PI/6):.1f}" r="40" {s}/>' for a in range(12)) + f'<circle cx="{cx}" cy="{cy}" r="80" {s}/>'
    if k == 'movie':
        if v == 0:   # rows of seats
            return ''.join(f'<rect x="{160+c*22+(r%2)*11}" y="{40+r*26}" width="16" height="14" rx="5" {s}/>' for c in range(9) for r in range(6))
        if v == 1:   # clapper stripes
            o = f'<path d="M150 70 H380 M150 100 H380" {s}/>'
            return o + ''.join(f'<path d="M{150+i*22} 70 l22 30" {S(fg, op*1.4)}/>' for i in range(11)) + ''.join(f'<path d="M{150+i*22} 30 l22 30 M150 30 H380 M150 60 H380" {s}/>' for i in range(11))
        if v == 2:   # scan lines of a screen
            return ''.join(f'<path d="M150 {8+i*6} H380" {S(fg, op*(.5+.5*sin(i*.35)**2))}/>' for i in range(33))
        return ''.join(f'<path d="M{275+cos(a*PI/8)*20:.1f} {100+sin(a*PI/8)*20:.1f} L{275+cos(a*PI/8)*140:.1f} {100+sin(a*PI/8)*140:.1f}" {s}/>' for a in range(16)) + ''.join(f'<path d="M{275+cos(a*PI/4)*90:.1f} {100+sin(a*PI/4)*90-8:.1f} l2.4 6 6 2.4 -6 2.4 -2.4 6 -2.4 -6 -6 -2.4 6 -2.4z" {S(fg, op*1.6)}/>' for a in range(8))  # premiere rays and stars
NAME = dict(museum=('대리석 결', '회랑 아치', '바닥 타일', '둥근 장식'), movie=('좌석 줄', '슬레이트 줄무늬', '스크린 주사선', '시사회 빛'))
HAVE = dict(museum=(m2, '기둥 홈'), movie=(m1, '영사기 빛'))
css = open('stylep.css').read() + '.rt.sm b{font-size:30px}.ps .wh b{color:var(--acc)}.lab{font-size:12px;font-weight:700;color:#444;margin:4px 4px -6px}.grid{display:grid;grid-template-columns:repeat(2,410px);gap:24px}body{width:900px}'
col = lambda title, body: f'<div class="col"><b>{title}</b><div class="ph list">{body}</div></div>'
cols = [col(k, f'<div class="lab">이미 합격 · {HAVE[k][1]}</div>{card(k, HAVE[k][0])}' + ''.join(f'<div class="lab">{"①②③④"[v]} {NAME[k][v]}</div>{card(k, lambda kk, fg, op, v=v: n(kk, fg, op, v))}' for v in range(4))) for k in ('museum', 'movie')]
open('passes4.html', 'w').write(f'<!doctype html><html lang="ko"><head><meta charset="utf-8"><style>{css}</style></head><body><h1>지갑 › 표 — 시안 4</h1><p class="s">전시 · 영화의 두 번째 무늬 후보 ①~④</p><div class="grid">{"".join(cols)}</div></body></html>')
