# 지갑 › 표 시안 5 — 항공 · 기차 · 회원권의 두 번째 무늬 후보 ①~④. 맨 위는 이미 합격한 무늬
import math, sys
sys.dont_write_bytecode = True
from gen2 import card, S, kept
cos, sin, PI = math.cos, math.sin, math.pi
def n(k, fg, op=.2, v=0):
    s = S(fg, op)
    if k == 'flight':
        if v == 0:   # a runway going away, dashed centre line
            o = f'<path d="M250 40 L170 210 M290 40 L370 210" {s}/>' + ''.join(f'<path d="M{250-t*80:.1f} {40+t*170:.1f} H{290+t*80:.1f}" {S(fg, op*.5)}/>' for t in (0.2, 0.45, 0.75))
            return o + ''.join(f'<path d="M270 {40+t*t*170:.1f} V{40+(t+.05)**2*170:.1f}" stroke="{fg}" stroke-opacity="{op*2}" stroke-width="{1+t*2.5:.1f}"/>' for t in [i*.1 for i in range(1, 10)])
        if v == 1:   # a heading dial
            cx, cy = 290, 200
            return ''.join(f'<path d="M{cx+150*cos(a*PI/36):.1f} {cy-150*sin(a*PI/36):.1f} L{cx+(138 if a % 3 else 128)*cos(a*PI/36):.1f} {cy-(138 if a % 3 else 128)*sin(a*PI/36):.1f}" {s}/>' for a in range(0, 37)) + ''.join(f'<circle cx="{cx}" cy="{cy}" r="{r}" {s}/>' for r in (150, 110, 70)) + f'<path d="M{cx} {cy} L{cx-60} {cy-150}" {S(fg, op*2)}/>'
        if v == 2:   # isobars, like a weather chart
            return ''.join(f'<ellipse cx="290" cy="110" rx="{18+i*22}" ry="{12+i*15}" transform="rotate(-18 290 110)" {s}/>' for i in range(8))
        return ''.join(f'<path d="M150 {30+i*22} Q260 {10+i*22} 380 {40+i*22}" {s}/>' for i in range(8)) + f'<path d="M160 150 C230 40 300 30 360 60" {S(fg, op*2.2, 1.1)} stroke-dasharray="2 4"/>'  # flight path over lat lines
    if k == 'train':
        if v == 0:   # rails and sleepers
            o = f'<path d="M262 30 L190 210 M278 30 L350 210" {S(fg, op*1.6)}/>'
            return o + ''.join(f'<path d="M{262-t*72-10*t:.1f} {30+t*180:.1f} H{278+t*72+10*t:.1f}" {s}/>' for t in [(i/12)**1.6 for i in range(1, 13)])
        if v == 1:   # a transit map: parallel lines bending
            return ''.join(f'<path d="M150 {120+i*8} H{220+i*6} L{270+i*6} {70+i*8} H380" {S(fg, op*1.4, 1.2)}/>' for i in range(4)) + ''.join(f'<circle cx="{x}" cy="{y}" r="4" fill="none" {S(fg, op*2, 1.2)}/>' for x, y in ((200, 132), (300, 82), (350, 82)))
        if v == 2:   # overhead wires between masts
            return ''.join(f'<path d="M{170+i*60} 10 V200" {s}/>' for i in range(4)) + ''.join(f'<path d="M{170+i*60} {30+j*10} Q{200+i*60} {50+j*10} {230+i*60} {30+j*10}" {s}/>' for i in range(4) for j in range(3))
        return ''.join(f'<path d="M{270-30*1.18**i:.1f} 210 V{110-10*1.18**i:.1f} A{30*1.18**i:.1f} {30*1.18**i:.1f} 0 0 1 {270+30*1.18**i:.1f} {110-10*1.18**i:.1f} V210" {s}/>' for i in range(9))  # a tunnel mouth
    if k == 'membership':
        if v == 0:   # fine diagonal hatching
            return ''.join(f'<path d="M{140+i*9} 210 L{240+i*9} -10" {s}/>' for i in range(30))
        if v == 1:   # a seal: rings with ticks
            cx, cy = 290, 100
            return ''.join(f'<circle cx="{cx}" cy="{cy}" r="{r}" {s}/>' for r in (40, 64, 70, 94)) + ''.join(f'<path d="M{cx+70*cos(a*PI/30):.1f} {cy+70*sin(a*PI/30):.1f} L{cx+82*cos(a*PI/30):.1f} {cy+82*sin(a*PI/30):.1f}" {s}/>' for a in range(60))
        if v == 2:   # a plus grid
            return ''.join(f'<path d="M{160+c*20-3} {14+r*20} h6 M{160+c*20} {14+r*20-3} v6" {S(fg, op*1.5)}/>' for c in range(11) for r in range(10))
        return ''.join(f'<rect x="{250-i*14}" y="{70-i*12}" width="{80+i*28}" height="{60+i*24}" rx="{10+i*6}" {s}/>' for i in range(8))  # nested cards
NAME = dict(flight=('활주로', '방위 다이얼', '등압선', '위도선 + 항로'), train=('선로 침목', '노선도', '가선 · 전주', '터널'), membership=('사선', '도장 고리', '십자 격자', '겹친 카드'))
css = open('stylep.css').read() + '.rt.sm b{font-size:30px}.ps .wh b{color:var(--acc)}.lab{font-size:12px;font-weight:700;color:#444;margin:4px 4px -6px}.grid{display:grid;grid-template-columns:repeat(3,410px);gap:24px}body{width:1330px}'
col = lambda k, kk, body: f'<div class="col"><b>{k}</b><div class="ph list">{body}</div></div>'
cols = []
for k, kk in (('flight', 'flight'), ('train', 'train'), ('membership', 'member')):
    cols.append(col(k, kk, f'<div class="lab">이미 합격</div>{card(kk, kept)}' + ''.join(f'<div class="lab">{"①②③④"[v]} {NAME[k][v]}</div>{card(kk, lambda _k, fg, op, v=v, k=k: n(k, fg, op, v))}' for v in range(4))))
open('passes5.html', 'w').write(f'<!doctype html><html lang="ko"><head><meta charset="utf-8"><style>{css}</style></head><body><h1>지갑 › 표 — 시안 5</h1><p class="s">항공 · 기차 · 회원권의 두 번째 무늬 후보 ①~④</p><div class="grid">{"".join(cols)}</div></body></html>')
