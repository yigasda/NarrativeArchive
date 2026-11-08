# 메시지 › 꾹 누르기 · 여러 개 고르기 시안 A–D (Ivo와의 1:1)
MSG = [('them','Hast du den Schlüssel noch?','열쇠 아직 갖고 있어?','09:12'),('me','Ja. Bring ich Samstag vorbei.','응. 토요일에 갖다줄게.','09:14'),
       ('them','Super, danke!','좋아, 고마워!','09:15'),('me','Kein Ding 😊','별거 아냐','09:15'),('them','Ruf mich zurück. Wichtig.','다시 전화해. 중요해.','17:30')]
I = {'copy':'M9 9h10v10H9zM5 15V5h10','pen':'M4 20l4-1 11-11-3-3L5 16zM14 6l3 3','trash':'M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13','check':'M5 12l4 4 10-10','ko':'M4 6h8M8 4v2M5 10c2 0 5-1 6-4M14 8l4 10M15 15h5','sel':'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM8 12l3 3 5-6','more':'M5 12h.01M12 12h.01M19 12h.01','fwd':'M14 5l6 6-6 6M20 11H8a4 4 0 0 0-4 4v3'}
ic = lambda k, s=18, c='currentColor', w=2: f'<svg width="{s}" height="{s}" viewBox="0 0 24 24" fill="none" stroke="{c}" stroke-width="{w}" stroke-linecap="round" stroke-linejoin="round"><path d="{I[k]}"/></svg>'
head = '<div class="sb"><b>17:42</b><span>●●● ▮</span></div><div class="rhead"><span class="cb">‹</span><span class="who2c" style="flex-direction:row;justify-content:flex-start;gap:10px"><span class="av" style="width:38px;height:38px;background:#7b4ea6;font-size:16px">I</span><span><b style="display:block;font-size:16px">Ivo (Werkstatt)</b><small style="color:#6b7380">연락처 보기 ›</small></span></span><span class="kp">가 한국어</span></div>'
def bub(m, cls='', extra=''):
    w, tx, ko, tm = m
    return f'<div class="bb {"me" if w=="me" else "them"} {cls}">{tx}<span class="k">{ko}</span>{extra}</div>'
def thread(body): return head + f'<div class="msgs"><div class="tm"><b>오늘</b> 09:12</div>{body}</div>'
ibar = '<div class="ibar"><span>🔒 보기 전용</span><em>못 보낸 말이 있었을까?</em><b>✎ 떠올리기</b></div>'
P = 3  # the pressed one
def list_with(fn): return ''.join(fn(k, m) for k, m in enumerate(MSG))
# A — iOS: dim, the bubble lifted, a menu under it; select: circles at the left, bar at the bottom
menuA = '<div class="mA">' + ''.join(f'<div class="{c}"><span>{t}</span>{ic(k,18)}</div>' for t,k,c in [('복사','copy',''),('한국어 복사','ko',''),('수정','pen',''),('선택','sel',''),('삭제','trash','red')]) + '</div>'
pA = thread(list_with(lambda k,m: f'<div class="dim">{bub(m)}</div>' if k!=P else f'<div class="lift">{bub(m)}{menuA}</div>')) + '<div class="veil"></div>'
selA = {1,3}
sA = thread(list_with(lambda k,m: f'<div class="selrow">{"<i class=on>"+ic("check",13,"#fff",3)+"</i>" if k in selA else "<i></i>"}{bub(m, "picked" if k in selA else "")}</div>')) + f'<div class="sbar"><span>2개 선택</span><b>{ic("copy")} 복사</b><b class="red">{ic("trash")} 삭제</b><em>취소</em></div>'
# B — bottom action sheet (our askSheet glass); select: top bar replaced, checks on the right
sheetB = '<div class="shB"><div class="g"><small>Ivo · 09:15</small><b>Kein Ding 😊</b></div>' + ''.join(f'<div class="o {c}">{ic(k,18)}<span>{t}</span></div>' for t,k,c in [('복사','copy',''),('한국어 복사','ko',''),('수정','pen',''),('여러 개 선택','sel',''),('삭제','trash','red')]) + '</div><div class="shB x">취소</div>'
pB = thread(list_with(lambda k,m: f'<div class="dim">{bub(m)}</div>')) + f'<div class="veil"></div><div class="shw">{sheetB}</div>'
selB = {0,1,2}
sB = '<div class="sb"><b>17:42</b><span>●●● ▮</span></div><div class="topsel"><em>취소</em><b>3개 선택됨</b><em>전체</em></div>' + f'<div class="msgs"><div class="tm"><b>오늘</b> 09:12</div>{list_with(lambda k,m: "<div class=selr>" + bub(m, "picked" if k in selB else "") + ("<i class=on>"+ic("check",13,"#fff",3)+"</i>" if k in selB else "<i></i>") + "</div>")}</div><div class="sbarB"><b>{ic("copy")}<span>복사</span></b><b>{ic("ko")}<span>한국어 복사</span></b><b class="red">{ic("trash")}<span>삭제</span></b></div>'
# C — a pill toolbar over the bubble; select: tapped bubbles outlined, floating pill
barC = f'<div class="pC"><span>{ic("copy",16)} 복사</span><span>{ic("pen",16)} 수정</span><span class="red">{ic("trash",16)} 삭제</span><span>{ic("sel",16)} 선택</span></div>'
pC = thread(list_with(lambda k,m: bub(m) if k!=P else f'<div class="cwrap">{barC}{bub(m, "pressed")}</div>'))
selC = {3,4}
sC = thread(list_with(lambda k,m: bub(m, "ring" if k in selC else "faint"))) + f'<div class="fC"><b>2개</b><span>{ic("copy",17)}</span><span>{ic("ko",17)}</span><span class="red">{ic("trash",17)}</span><em>완료</em></div>'
# D — icons in a small bar under the bubble, like a reaction bar; select: count in the header, actions top right
barD = '<div class="pD">' + ''.join(f'<span class="{c}">{ic(k,19)}<small>{t}</small></span>' for t,k,c in [('복사','copy',''),('한국어','ko',''),('수정','pen',''),('선택','sel',''),('삭제','trash','red')]) + '</div>'
pD = thread(list_with(lambda k,m: f'<div class="dim">{bub(m)}</div>' if k!=P else f'<div class="lift">{bub(m)}{barD}</div>')) + '<div class="veil lt"></div>'
selD = {2,3,4}
sD = '<div class="sb"><b>17:42</b><span>●●● ▮</span></div>' + f'<div class="topD"><span class="cb">✕</span><b>3개 선택</b><span class="cb">{ic("copy",17)}</span><span class="cb red">{ic("trash",17)}</span></div>' + f'<div class="msgs"><div class="tm"><b>오늘</b> 09:12</div>{list_with(lambda k,m: "<div class=selrow>" + ("<i class=on>"+ic("check",13,"#fff",3)+"</i>" if k in selD else "<i></i>") + bub(m, "picked" if k in selD else "") + "</div>")}</div>'
pages = [('A','아이메시지: 들어올린 말풍선 + 세로 메뉴','뒤는 흐리게, 누른 말풍선만 떠오르고 밑에 메뉴. 고르기는 왼쪽 동그라미 + 아래 "2개 선택 · 복사 · 삭제" 줄.', pA+ibar, sA),
         ('B','아래 시트 (우리 확인 창 질감)','꾹 누르면 그 문자 미리보기가 든 유리 시트가 아래서 올라와요. 고르기는 위 줄이 "취소 · 3개 선택됨 · 전체", 오른쪽 체크, 아래 아이콘 줄.', pB, sB),
         ('C','말풍선 위 알약 줄','흐리게 안 하고 누른 말풍선 위에 가로 알약(복사 · 수정 · 삭제 · 선택). 고르기는 고른 말풍선에 파란 테, 나머지 옅게, 떠 있는 알약.', pC+ibar, sC),
         ('D','아이콘 줄 (반응 바처럼)','누른 말풍선 밑에 아이콘 + 작은 글자 다섯 개. 고르기는 머리 줄이 "✕ · 3개 선택 · 복사 · 삭제"로 바뀌어요.', pD+ibar, sD)]
css = open('base.css').read() + open('extra.css').read()
html = f'<!doctype html><html lang="ko"><head><meta charset="utf-8"><style>{css}</style></head><body><h1>메시지 › 꾹 누르기 · 여러 개 고르기 — 시안 A–D</h1><p class="s">위: 말풍선 하나를 꾹 눌렀을 때 · 아래: 여러 개 고를 때</p><div class="row">' + ''.join(f'<div class="col"><b>{k}. {t}</b><small>{d}</small><div class="ph">{a}<i class="ind"></i></div><div class="ph">{b}<i class="ind"></i></div></div>' for k,t,d,a,b in pages) + '</div></body></html>'
open('msgpress.html','w').write(html)
