# 지갑 › 표 시안 7 — 항공 · 기차 두 번째 무늬 ①~④ (항로 · 가는 선 겹치기 없이). 점 지도는 Natural Earth 땅 자료(world-atlas land-50m)를 1.5°로 찍은 것
import math, sys, json
sys.dont_write_bytecode = True
from gen2 import card, kept, ACC
F = lambda fg, a: f'fill="{fg}" fill-opacity="{a}"'
L = json.load(open('land15.json'))
def dotmap(fg, lon_a=-25, lon_b=150, lat_a=72, lat_b=-5, x0=118, y0=6, u=1.62):
    st, d = L['step'], ''
    for r, row in enumerate(L['rows']):
        lat = L['lat0'] - (r + .5) * st
        if not (lat_b <= lat <= lat_a): continue
        for c, ch in enumerate(row):
            lon = L['lon0'] + (c + .5) * st
            if ch == '1' and lon_a <= lon <= lon_b: d += f'M{x0 + (lon - lon_a) * u:.1f} {y0 + (lat_a - lat) * u:.1f}h0'
    return f'<path d="{d}" stroke="{fg}" stroke-opacity=".3" stroke-width="1.6" stroke-linecap="round"/>'
_N = [0]
def fade(inner, at=.5):
    _N[0] += 1; i = _N[0]
    return (f'<defs><linearGradient id="fd{i}" x1="0" x2="1"><stop offset=".1" stop-color="#fff" stop-opacity="0"/><stop offset="{at}" stop-color="#fff"/></linearGradient>'
            f'<mask id="fm{i}"><rect x="-20" y="-20" width="420" height="260" fill="url(#fd{i})"/></mask></defs><g mask="url(#fm{i})">{inner}</g>')
def flight(v, fg, acc):
    if v == 0: return fade(dotmap(fg), .45)
    if v == 1:   # the wing seen from the window seat: leading edge lit, flaps below
        return fade(f'<path d="M410 30 L196 150 Q186 156 198 160 L410 118 Z" {F(fg, .1)}/><path d="M410 30 L196 150" stroke="{fg}" stroke-opacity=".35" stroke-width="1.4"/>'
                    f'<path d="M410 118 L198 160 L214 172 L410 140 Z" {F(fg, .05)}/><path d="M262 138 L270 160 M318 124 L328 150 M372 112 L382 142" stroke="{fg}" stroke-opacity=".18"/><circle cx="200" cy="155" r="2.6" fill="{acc}"/>', .35)
    if v == 2:   # the tail fin, livery-like
        return (f'<path d="M206 190 L270 46 Q276 34 290 34 L322 34 L306 190 Z" {F(fg, .1)}/>'
                f'<path d="M240 114 L314 114 L310 140 L229 140 Z" fill="{acc}" fill-opacity=".32"/><circle cx="288" cy="76" r="14" fill="none" stroke="{fg}" stroke-opacity=".35" stroke-width="1.4"/>')
    # the seat map, your seat lit
    o = ''
    for r in range(7):
        for c in range(6):
            x, y = 178 + c * 24 + (14 if c > 2 else 0), 30 + r * 22
            o += f'<rect x="{x}" y="{y}" width="18" height="16" rx="5" ' + (f'fill="{acc}" fill-opacity=".9"/>' if (r, c) == (0, 0) else f'fill="none" stroke="{fg}" stroke-opacity=".16"/>')
    return fade(o, .45)
def train(v, fg, acc):
    if v == 0:   # the nose of a high-speed train coming at you
        return fade(f'<path d="M196 186 C198 110 228 44 270 42 C312 44 342 110 344 186 Z" {F(fg, .09)}/><path d="M218 104 C228 80 248 68 270 68 C292 68 312 80 322 104 C300 98 240 98 218 104 Z" {F("#000", .22)}/>'
                    f'<path d="M204 150 Q270 136 336 150" stroke="{acc}" stroke-opacity=".7" stroke-width="2.4" fill="none"/><circle cx="226" cy="166" r="4.5" fill="#fff" fill-opacity=".6"/><circle cx="314" cy="166" r="4.5" fill="#fff" fill-opacity=".6"/>', .5)
    if v == 1:   # lit windows of a night train going past
        bars = [(176, 40, 70), (260, 40, 44), (150, 72, 54), (214, 72, 96), (190, 104, 62), (262, 104, 80), (160, 136, 88), (258, 136, 50)]
        return fade(''.join(f'<rect x="{x}" y="{y}" width="{w}" height="16" rx="8" fill="#fff" fill-opacity="{.06 + (k % 3) * .03:.2f}"/>' for k, (x, y, w) in enumerate(bars)), .45)
    if v == 2:   # the departure time, very large, outlined
        return f'<text x="392" y="176" text-anchor="end" font-family="Inter Tight, sans-serif" font-size="150" font-weight="700" letter-spacing="-6" fill="none" stroke="{fg}" stroke-opacity=".16" stroke-width="1.2">09:54</text>'
    # the station clock at the departure time
    cx, cy, R = 266, 100, 66
    o = f'<circle cx="{cx}" cy="{cy}" r="{R}" {F(fg, .06)}/>'
    o += ''.join(f'<path d="M{cx+R*.9*math.sin(a*math.pi/30):.1f} {cy-R*.9*math.cos(a*math.pi/30):.1f} L{cx+R*(.72 if a % 5 == 0 else .84)*math.sin(a*math.pi/30):.1f} {cy-R*(.72 if a % 5 == 0 else .84)*math.cos(a*math.pi/30):.1f}" stroke="{fg}" stroke-opacity=".3" stroke-width="{3 if a % 5 == 0 else 1}"/>' for a in range(60))
    h, m = 9 + 54 / 60, 54
    hand = lambda ang, ln, w: f'<path d="M{cx} {cy} L{cx+ln*math.sin(ang):.1f} {cy-ln*math.cos(ang):.1f}" stroke="{fg}" stroke-opacity=".45" stroke-width="{w}" stroke-linecap="round"/>'
    return fade(o + hand(h / 12 * 2 * math.pi, R * .45, 5) + hand(m / 60 * 2 * math.pi, R * .66, 3.4) + f'<circle cx="{cx}" cy="{cy}" r="3.4" fill="{acc}"/>', .45)
NAME = dict(flight=('점 지도 (실제 땅)', '창밖 날개', '꼬리 날개', '좌석 배치도 (내 자리)'), train=('고속열차 앞모습', '밤 차창 불빛', '큰 출발 시각', '역 시계 (출발 시각)'))
DRAW = dict(flight=flight, train=train)
css = open('stylep.css').read() + '.rt.sm b{font-size:30px}.ps .wh b{color:var(--acc)}.lab{font-size:12px;font-weight:700;color:#444;margin:4px 4px -6px}.grid{display:grid;grid-template-columns:repeat(2,410px);gap:24px}body{width:900px}'
col = lambda k, body: f'<div class="col"><b>{k}</b><div class="ph list">{body}</div></div>'
cols = [col(k, f'<div class="lab">이미 합격</div>{card(k, kept)}' + ''.join(f'<div class="lab">{"①②③④"[v]} {NAME[k][v]}</div>{card(k, lambda _k, fg, op, v=v, k=k: DRAW[k](v, fg, ACC[k]))}' for v in range(4))) for k in ('flight', 'train')]
open('passes7.html', 'w').write(f'<!doctype html><html lang="ko"><head><meta charset="utf-8"><style>{css}</style></head><body><h1>지갑 › 표 — 시안 7</h1><p class="s">항공 · 기차 두 번째 무늬 — 항로 없이, 서로 다른 그림으로</p><div class="grid">{"".join(cols)}</div></body></html>')
