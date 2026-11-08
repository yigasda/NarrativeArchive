# 은행 › 재산 · 빚 시안 A–D (Mara, Varo, EUR)
I = {
 'house':'M4 11l8-7 8 7v9H4zM10 20v-5h4v5','car':'M5 16l1.5-5h11L19 16M4 16h16v3H4zM7 19v1M17 19v1M7.5 13.5h.01M16.5 13.5h.01',
 'hand':'M4 13l4-1 5 2 6-3v2l-6 4-5-1-4 1zM12 4v6M9 7h6','gem':'M6 4h12l3 5-9 11L3 9zM3 9h18M9 4l3 16 3-16',
 'chart':'M4 19V5M4 19h16M8 15l3-4 3 2 5-6','bank':'M3 9l9-5 9 5M5 9v9M9 9v9M15 9v9M19 9v9M3 20h18','gift':'M4 10h16v10H4zM3 7h18v3H3zM12 7v13M12 7c-2-4-6-3-5 0M12 7c2-4 6-3 5 0',
 'lock':'M6 11h12v9H6zM8 11V8a4 4 0 0 1 8 0v3','user':'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0','doc':'M7 3h7l4 4v14H7zM14 3v4h4',
 'back':'M15 5l-7 7 7 7','chev':'M9 6l6 6-6 6','info':'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 11v5M12 8h.01','people':'M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM3 20a6 6 0 0 1 12 0M16 11a3 3 0 1 0 0-6M21 20a6 6 0 0 0-4-5.7',
}
ic = lambda k, s=18, c='currentColor', w=2: f'<svg width="{s}" height="{s}" viewBox="0 0 24 24" fill="none" stroke="{c}" stroke-width="{w}" stroke-linecap="round" stroke-linejoin="round"><path d="{I[k]}"/></svg>'
A = [  # name, sub, value, icon, bg, fg, counted, why
 ('Wohnung Varo-Nord','집 · 같이 가진 것 · 절반',105000,'house','#e2e9f5','#2c4a80',True,''),
 ('VW Golf 2017','차',9500,'car','#e4eef3','#2f6f8f',True,''),
 ('ETF-Sparplan','투자 · Trade Republic',3200,'chart','#dcefdf','#3f7d50',True,''),
 ('Darlehen an Ren','받을 돈 · 빌려준 돈',500,'hand','#f5edd6','#8a6a1f',True,''),
 ('Erbe Tante Hilde','받을 예정',15000,'gift','#eceef2','#6b7380',False,'받을 예정'),
 ('Festgeld Altbank','막힘 · 동결',2000,'lock','#eceef2','#6b7380',False,'막힘'),
 ('Omas Ring','귀중품 · 가족 것',1800,'gem','#eceef2','#6b7380',False,'가족 것'),
]
D = [
 ('Hypothek Sparkasse','주택 담보 · 같이 진 빚 · 절반',-88000,'bank','#f6e7e1','#b8573a',True,'','매달 1일'),
 ('KfW Studienkredit','대출',-6400,'doc','#f6e7e1','#b8573a',True,'','D-6'),
 ('Ivo','개인 · 빌린 돈',-200,'user','#fbe4df','#b8573a',True,'','연체'),
 ('Papas Kredit','가족 빚',-12000,'people','#eceef2','#6b7380',False,'가족 빚',''),
 ('Firmenkredit Werkstatt','회사 빚',-30000,'bank','#eceef2','#6b7380',False,'회사 빚',''),
]
dep = 7704.17
eur = lambda n, s=False: (('+' if n>0 and s else '−' if n<0 else '') + f'{abs(n):,.2f}'.replace(',', 'X').replace('.', ',').replace('X', '.') + ' €')
has = sum(a[2] for a in A if a[6]); owe = -sum(d[2] for d in D if d[6]); net = dep + has - owe
bar = lambda: ''
def row(x, debt=False, dim=False):
    n, sub, v, k, bg, fg, cnt, why = x[:8]; tail = x[8] if debt and len(x) > 8 else ''
    badge = f'<span class="dd {"ok" if tail.startswith("매달") else "g" if not tail.startswith("D") and tail!="연체" else ""}">{tail}</span>' if tail else ''
    return f'<div class="rw{" dim" if dim else ""}"><span class="fi" style="background:{bg};color:{fg}">{ic(k,19)}</span><span class="tx"><b>{n}{badge}</b><small>{sub}</small></span><span class="am {"p" if v>0 and not dim else ""}">{eur(v, True)}</span></div>'
head = lambda title, body='', tall=False: f'<div class="bkh{" tall" if tall else ""}"><div class="sb"><b>17:42</b><span>●●● ▮</span></div><div class="bkr"><span class="cb">{ic("back",18,"#fff",2.3)}</span><span class="bkt">{title}</span><span class="cb ghost"></span></div>{body}</div>'
tab = '<div class="tab"><span>홈</span><span>송금</span><span>카드</span><span class="on">더보기</span></div>'
excl = lambda: f'<div class="sec">합계에 안 넣은 것 <span>{len([a for a in A if not a[6]])+len([d for d in D if not d[6]])}개</span></div><div class="card">{"".join(row(a,dim=True) for a in A if not a[6])}{"".join(row(d,True,True) for d in D if not d[6])}</div>'

# A. 순자산 한 화면: 큰 숫자 + 예금·자산·빚 띠 → 가진 것 / 갚을 것 / 합계에 안 넣은 것
tot = dep + has + owe
stripA = f'<div class="nb"><i style="flex:{dep};background:#7fae8a"></i><i style="flex:{has};background:#8fb0d8"></i><i style="flex:{owe};background:#e3a08a"></i></div><div class="lg"><span style="color:#5f9a6c">● 예금</span><span style="color:#5d84b8">● 가진 것</span><span style="color:#c4755c">● 빚</span></div>'
pA = head('재산 · 빚', f'<div class="tot c"><small>순자산 · 예금 + 가진 것 − 빚</small><b>{eur(net)}</b><span>합계에 안 넣은 것 7개 · 아래에 따로</span></div>', True) + f'''<div class="bks"><div class="sc">
  <div class="card pad">{stripA}</div>
  <div class="sec">가진 것 <span>{eur(has)}</span></div><div class="card">{"".join(row(a) for a in A if a[6])}</div>
  <div class="sec">갚을 것 <span>{eur(-owe)}</span></div><div class="card">{"".join(row(d,True) for d in D if d[6])}</div>
  {excl()}</div></div>{tab}'''

# B. 은행 홈 머리에서 넘기기: 예금 | 순자산 알약 + 두 기둥 그림(가진 것 vs 빚)
colH = 190
def col(items, total, kind):
    out=''
    for x in items:
        h = max(6, abs(x[2]) / total * colH); out += f'<i style="height:{h:.0f}px;background:{x[5]}" title="{x[0]}"></i>'
    return out
ha = [('예금',0,dep,0,0,'#7fae8a')] + [a for a in A if a[6]]
big = max(dep+has, owe)
pB = head('', f'<div class="seg"><span>예금</span><span class="on">순자산</span></div><div class="tot c"><small>순자산</small><b>{eur(net)}</b><span>Varo Bank 밖의 것까지</span></div>', True).replace('<span class="bkt"></span>','') + f'''<div class="bks"><div class="sc">
  <div class="card pad"><div class="cols"><div class="colw"><div class="colb">{"".join(f'<i style="height:{max(6,x[2]/big*colH):.0f}px;background:{c}"></i>' for x,c in zip(ha,["#7fae8a","#5d84b8","#8fb0d8","#a9c6e6","#c9dbef"]))}</div><b>가진 것</b><small>{eur(dep+has)}</small></div>
     <div class="colw"><div class="colb">{"".join(f'<i style="height:{max(6,-d[2]/big*colH):.0f}px;background:{c}"></i>' for d,c in zip([d for d in D if d[6]],["#c4755c","#e3a08a","#f0c6b8"]))}</div><b>빚</b><small>{eur(-owe)}</small></div>
     <div class="colk">{"".join(f'<span><i style="background:{c}"></i>{n}</span>' for n,c in [("예금","#7fae8a"),("집 절반","#5d84b8"),("차","#8fb0d8"),("주택 담보","#c4755c"),("학자금","#e3a08a")])}</div></div></div>
  <div class="sec">가진 것</div><div class="card">{"".join(row(a) for a in A if a[6])}</div>
  <div class="sec">빚</div><div class="card">{"".join(row(d,True) for d in D if d[6])}</div>
  <div class="note">{ic("info",15,"#8a6a1f")}<span>받을 예정 · 막힌 것 · 가족 · 회사 것 6개는 합계에 안 넣었어요</span><b>보기</b></div></div></div>{tab}'''

# C. 타일: 종류별 큰 타일 2열(집 · 차 · 투자 · 받을 돈) + 빚은 D-day 카드
tiles = [(a[0],a[1].split(' · ')[0],a[2],a[3],a[4],a[5]) for a in A if a[6]]
pC = head('재산', f'<div class="tot"><small>가진 것 − 빚 · 예금 포함</small><b>{eur(net)}</b><span>가진 것 {eur(dep+has)} · 빚 {eur(-owe)}</span></div>', True) + f'''<div class="bks"><div class="sc">
  <div class="tiles">{"".join(f'<div class="tl"><span class="fi" style="background:{bg};color:{fg}">{ic(k,20)}</span><small>{kind}</small><b>{n}</b><em>{eur(v)}</em></div>' for n,kind,v,k,bg,fg in tiles)}</div>
  <div class="sec">갚을 날</div>
  <div class="due">{"".join(f'<div class="dc{" red" if t in ("연체",) or t.startswith("D") else ""}"><small>{t or "—"}</small><b>{n}</b><em>{eur(v)}</em><span>{s}</span></div>' for n,s,v,k,bg,fg,c,w,t in [d for d in D if d[6]])}</div>
  {excl()}</div></div>{tab}'''

# D. 더보기 안에 한 칸: 등급 카드 밑 "재산 · 빚" 요약 카드 → 줄 목록, 빠진 건 회색 알약
chipsD = ''.join(f'<span class="pill">{a[7]} · {a[0]}</span>' for a in A if not a[6]) + ''.join(f'<span class="pill">{d[7]} · {d[0]}</span>' for d in D if not d[6])
pD = head('더보기', '<div class="bkpr"><span class="av">M</span><span><b>Mara <i class="tier">GOLD</i></b><small>Varo Bank · 골드 고객</small></span></div>') + f'''<div class="bks"><div class="sc">
  <div class="sec">재산 · 빚</div>
  <div class="card pad sum"><div class="sl"><span>예금</span><b>{eur(dep)}</b></div><div class="sl"><span>가진 것</span><b>{eur(has)}</b></div><div class="sl"><span>빚</span><b class="neg">{eur(-owe)}</b></div><div class="sl t"><span>순자산</span><b>{eur(net)}</b></div></div>
  <div class="card">{"".join(row(a) for a in A if a[6])}{"".join(row(d,True) for d in D if d[6])}</div>
  <div class="sec">합계에 안 넣은 것</div><div class="pills">{chipsD}</div>
  <div class="sec">GOLD 혜택</div><div class="card pad ben">해외 결제 수수료 면제 · 무료 ATM 월 5회 · 우대 환율</div></div></div>{tab}'''

css = open('style.css').read()
phones = [('A','한 화면 · 띠 + 목록','은행 첫 화면 "내 계좌" 밑 "재산 · 빚" 줄로 들어가요. 순자산 큰 숫자, 예금 · 가진 것 · 빚 띠, 목록 셋.',pA),
          ('B','은행 머리에서 넘기기','은행 첫 화면 큰 숫자 위 "예금 | 순자산"을 넘기면 이 화면. 가진 것 · 빚 두 기둥 그림.',pB),
          ('C','종류 타일 + 갚을 날','가진 것은 큰 타일 2열, 빚은 옆으로 넘기는 D-day 카드.',pC),
          ('D','더보기 안에 한 칸','새 화면 없이 은행 더보기에 요약 + 줄 목록. 빠진 것은 회색 알약.',pD)]
html = f'<!doctype html><html lang="ko"><head><meta charset="utf-8"><style>{css}</style></head><body><h1>은행 › 재산 · 빚 — 시안 A–D</h1><p class="s">같은 데이터: 예금 7.704 € · 가진 것 4개 · 빚 3개 · 합계에 안 넣은 것 7개(받을 예정 · 막힘 · 가족 · 회사 · 같이 진 건 절반만)</p><div class="row">' + ''.join(f'<div class="col"><b>{k}. {t}</b><small>{d}</small><div class="ph"><div class="bk">{body}</div><i class="ind"></i></div></div>' for k,t,d,body in phones) + '</div></body></html>'
open('wealth.html','w').write(html)
