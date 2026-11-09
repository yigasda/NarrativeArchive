# 지갑 › 표 시안 6 — 항공 · 기차 · 회원권 두 번째 무늬, 가는 선 겹치기 말고 서로 다른 기법으로 ①~④
import math, sys
sys.dont_write_bytecode = True
from gen2 import card, S, kept, ACC
cos, sin, PI = math.cos, math.sin, math.pi
F = lambda fg, a: f'fill="{fg}" fill-opacity="{a}"'
# Eurasia as dots, Frankfurt → Seoul lit
MAP = ["    xxx   xxxxxxxxxxxxxx    ", "   xxxxx xxxxxxxxxxxxxxxxx  ", "  xxxxxxxxxxxxxxxxxxxxxxxx  ", "  xxxxxxxxxxxxxxxxxxxxxxx x ",
       "   xxxxxxxxxxxxxxxxxxxxx xx ", "   xx xxxxxxxxxxxxxxxxx  x  ", "  xxx  xxxxxxx xxxxxxx      ", "  xxxx  xxxxx   xxxxx  x    ",
       "  xxxxx  xxx     xxx x      ", "   xxxx   x       x  xx    ", "    xxx            x  xxx   ", "     x                 xx   "]
def flight(v, fg, acc):
    if v == 0:
        o = ''.join(f'<circle cx="{150+c*8}" cy="{30+r*8}" r="1.9" {F(fg, .22)}/>' for r, row in enumerate(MAP) for c, ch in enumerate(row) if ch == 'x')
        a, b = (150+6*8, 30+3*8), (150+22*8, 30+5*8)
        return o + f'<path d="M{a[0]} {a[1]} Q{(a[0]+b[0])/2} {a[1]-46} {b[0]} {b[1]}" stroke="{acc}" stroke-width="1.4" fill="none" stroke-dasharray="3 3"/>' + ''.join(f'<circle cx="{x}" cy="{y}" r="3.4" fill="{acc}"/><circle cx="{x}" cy="{y}" r="8" fill="none" stroke="{acc}" stroke-opacity=".5"/>' for x, y in (a, b))
    if v == 1:   # cabin windows
        return ''.join(f'<rect x="{168+i*46}" y="46" width="34" height="52" rx="17" {F(fg, .05)} stroke="{fg}" stroke-opacity=".16"/><rect x="{173+i*46}" y="52" width="24" height="40" rx="12" {F("#000", .1)}/><path d="M{178+i*46} 60 q4 -4 10 -2" stroke="{fg}" stroke-opacity=".35" fill="none" stroke-width="1.2" stroke-linecap="round"/>' for i in range(5))
    if v == 2:   # cloud layers, filled
        def cloud(y, s, a):
            d = f'M-20 210 V{y} ' + ' '.join(f'a{s} {s*.8} 0 0 1 {s*1.6} {(-1)**i * 4}' for i in range(int(420 // (s*1.6)) + 2)) + ' V210 Z'
            return f'<path d="{d}" {F(fg, a)}/>'
        return cloud(120, 22, .05) + cloud(145, 18, .07) + cloud(170, 14, .1)
    # jet stream: a bundle of curves
    return ''.join(f'<path d="M140 {190-i*3} C230 {200-i*6} 250 {40+i*5} 380 {20+i*4}" stroke="{fg}" stroke-opacity="{.08+.18*(1-abs(i-8)/8):.2f}" fill="none" stroke-width=".9"/>' for i in range(17))
def train(v, fg, acc):
    if v == 0:   # hills going by, with motion streaks
        hill = lambda y, amp, ph, a: f'<path d="M-20 210 V{y} ' + ' '.join(f'Q{-10+i*40} {y-amp*(1 if (i+ph) % 2 else -0.3)} {170+i*40} {y}' for i in range(11)) + f' V210 Z" {F(fg, a)}/>'
        return hill(110, 26, 0, .05) + hill(140, 18, 1, .08) + hill(170, 10, 0, .12) + ''.join(f'<path d="M{200+i*23%90} {30+i*11} h{40+i*7%30}" stroke="{fg}" stroke-opacity=".25" stroke-linecap="round"/>' for i in range(6))
    if v == 1:   # split-flap board
        o = ''
        for r, word in enumerate(('KÖLN', '11:02', 'GL 7')):
            for c, ch in enumerate(word.ljust(5)):
                x, y = 196 + c * 30, 22 + r * 46
                o += f'<rect x="{x}" y="{y}" width="26" height="38" rx="4" {F("#000", .1)}/><path d="M{x} {y+19} h26" stroke="{fg}" stroke-opacity=".08"/>'
                if ch.strip(): o += f'<text x="{x+13}" y="{y+28}" text-anchor="middle" font-family="Inter Tight, sans-serif" font-size="24" font-weight="500" {F(fg, .12)}>{ch}</text>'
        return o
    if v == 2:   # the carriage side, running off the card
        o = f'<path d="M-20 70 H330 Q372 70 386 120 V150 H-20 Z" {F(fg, .07)} stroke="{fg}" stroke-opacity=".22"/>'
        o += ''.join(f'<rect x="{160+i*34}" y="84" width="24" height="22" rx="4" {F("#000", .22)}/>' for i in range(-3, 5)) + f'<path d="M-20 128 H384" stroke="{acc}" stroke-opacity=".6" stroke-width="2"/><path d="M-20 160 H390 M-20 166 H390" stroke="{fg}" stroke-opacity=".2"/>'
        return o + ''.join(f'<circle cx="{180+i*60}" cy="152" r="7" {F("#000", .25)}/>' for i in range(4))
    # points: tracks splitting
    return ''.join(f'<path d="M140 {150+d} H220 C270 {150+d} 280 {150+d-k*40} 380 {150+d-k*60}" stroke="{fg}" stroke-opacity=".22" fill="none" stroke-width="1.4"/>' for k in (0, 1, 2) for d in (0, 8))
def member(v, fg, acc, brand='URBAN SPORTS CLUB'):
    if v == 0:   # a big outlined initial
        return f'<text x="390" y="210" text-anchor="end" font-family="Inter Tight, sans-serif" font-size="260" font-weight="700" fill="none" stroke="{fg}" stroke-opacity=".22" stroke-width="1.2">{brand[0]}</text>'
    if v == 1:   # tonal rings from the corner, filled
        return ''.join(f'<circle cx="380" cy="210" r="{230-i*40}" {F(fg, .045)}/>' for i in range(5))
    if v == 2:   # a hologram strip
        g = f'<defs><linearGradient id="holo" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffd1f0"/><stop offset=".35" stop-color="#c4f2ff"/><stop offset=".7" stop-color="#d9ffc9"/><stop offset="1" stop-color="#fff1b8"/></linearGradient></defs>'
        return g + f'<rect x="262" y="-10" width="46" height="230" fill="url(#holo)" fill-opacity=".28"/>' + ''.join(f'<path d="M{262+i*4} -10 V220" stroke="#fff" stroke-opacity=".12"/>' for i in range(12))
    # a sport band across
    return f'<path d="M220 210 L330 -10 H372 L262 210 Z" fill="{acc}" fill-opacity=".3"/><path d="M276 210 L386 -10" stroke="{acc}" stroke-opacity=".55" stroke-width="2"/>'
NAME = dict(flight=('점 지도 + 항로', '비행기 창문', '구름 층', '제트 기류'), train=('창밖 언덕', '출발 안내판', '객차 옆모습', '선로 분기'), membership=('큰 머리글자', '모서리 색 고리', '홀로그램 띠', '스포츠 띠'))
_N = [0]
def faded(fn):
    def g(v, fg, acc):
        _N[0] += 1; i = _N[0]
        return (f'<defs><linearGradient id="fd{i}" x1="0" x2="1"><stop offset=".08" stop-color="#fff" stop-opacity="0"/><stop offset=".55" stop-color="#fff"/></linearGradient>'
                f'<mask id="fm{i}"><rect x="0" y="-20" width="400" height="260" fill="url(#fd{i})"/></mask></defs><g mask="url(#fm{i})">{fn(v, fg, acc)}</g>')
    return g
DRAW = dict(flight=faded(flight), train=faded(train), membership=faded(member))
css = open('stylep.css').read() + '.rt.sm b{font-size:30px}.ps .wh b{color:var(--acc)}.lab{font-size:12px;font-weight:700;color:#444;margin:4px 4px -6px}.grid{display:grid;grid-template-columns:repeat(3,410px);gap:24px}body{width:1330px}'
col = lambda k, body: f'<div class="col"><b>{k}</b><div class="ph list">{body}</div></div>'
cols = []
for k, kk in (('flight', 'flight'), ('train', 'train'), ('membership', 'member')):
    cols.append(col(k, f'<div class="lab">이미 합격</div>{card(kk, kept)}' + ''.join(f'<div class="lab">{"①②③④"[v]} {NAME[k][v]}</div>{card(kk, lambda _k, fg, op, v=v, k=k, kk=kk: DRAW[k](v, fg, ACC[kk]))}' for v in range(4))))
open('passes6.html', 'w').write(f'<!doctype html><html lang="ko"><head><meta charset="utf-8"><style>{css}</style></head><body><h1>지갑 › 표 — 시안 6</h1><p class="s">항공 · 기차 · 회원권 두 번째 무늬 — 선 겹치기 말고 점 · 면 · 실루엣 · 색 띠 · 글자로 서로 다르게</p><div class="grid">{"".join(cols)}</div></body></html>')
