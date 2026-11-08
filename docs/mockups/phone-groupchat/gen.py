# 메시지 › 단톡 시안 A–D (Mara, Varo) — 위는 대화 목록, 아래는 단톡 방
C = {'Ivo':'#7b4ea6','Lio':'#3f7d50','Nele':'#c0783a','Ren':'#3d9a55','Mama':'#b24a6a','Papa':'#2f6f8f','Jonas':'#8a6a1f'}
COLN = {'Ivo':'#7b4ea6','Lio':'#2f7d4f','Nele':'#b8573a','Ren':'#2f6bff'}
av = lambda n, s=48: f'<span class="av" style="width:{s}px;height:{s}px;background:{C.get(n,"#6b7380")};font-size:{s*0.42:.0f}px">{n[0]}</span>'
PPL = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.1" stroke-linecap="round"><path d="M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM3 20a6 6 0 0 1 12 0M16 11a3 3 0 1 0 0-6M21 20a6 6 0 0 0-4-5.7"/></svg>'
G1 = ('Uni-Freunde', ['Ivo','Lio','Nele','Ren'], 'Lio', 'Wer kommt Freitag?', '금요일 누구 와?', '17:52')
G2 = ('Familie', ['Mama','Papa','Jonas'], 'Mama', 'Ruf mal an, Schatz', '전화 좀 해, 얘야', '어제')
ONE = [('Ren ♥','Ren','Fünf Minuten.','5분만.','17:40',False), ('Ivo (Werkstatt)','Ivo','Ruf mich zurück.','다시 전화해.','17:30',True)]
MSG = [('Lio','Wer kommt Freitag zum Grillen?','금요일 바베큐 누구 와?','17:41'),('Nele','Ich! Bringe Salat mit 🥗','나! 샐러드 가져갈게','17:43'),('Nele','Und Ivo bringt das Bier','그리고 이보가 맥주','17:43'),
       ('Ivo','Immer ich 😂','맨날 나야','17:46'),('me','Bin dabei, aber erst ab 8','갈게, 근데 8시부터','17:50'),('Lio','Wer kommt Freitag?','금요일 누구 와?','17:52')]
def lst(groupav, sub):
    rows = []
    for (title, mem, last, tx, ko, tm) in [G1, G2]:
        rows.append(f'<div class="rw">{groupav(title, mem)}<span class="tx"><span class="h"><b>{title}{"" if variant!="A" else ""}</b><small>{tm}</small></span><span class="p">{sub(title, mem, last, tx)}<span class="ko">{ko}</span></span></span></div>')
    for (n, a, tx, ko, tm, dot) in ONE:
        rows.append(f'<div class="rw">{"<i class=dot></i>" if dot else ""}{av(a)}<span class="tx"><span class="h"><b>{n}</b><small>{tm}</small></span><span class="p">{tx}<span class="ko">{ko}</span></span></span></div>')
    rows.insert(1, rows.pop(2))
    return f'<div class="sb"><b>17:42</b><span>●●● ▮</span></div><div class="top"><span class="cb">‹</span><span class="kp">가 한국어</span></div><div class="h1">메시지 <small>4개 대화</small></div><div class="find">⌕ 검색</div><div class="card">{"".join(rows)}</div>'
def room(head, bubble, chips=''):
    out, prev = [], None
    out.append('<div class="tm"><b>오늘</b> 17:41</div>')
    for k,(f,tx,ko,tm) in enumerate(MSG):
        nxt = MSG[k+1][0] if k+1 < len(MSG) else None
        out.append(bubble(f, tx, ko, prev != f, nxt != f)); prev = f
    return f'<div class="sb"><b>17:42</b><span>●●● ▮</span></div>{head}{chips}<div class="msgs">{"".join(out)}</div><div class="ibar"><span>🔒 보기 전용</span><em>못 보낸 말이 있었을까?</em><b>✎ 떠올리기</b></div>'
plain = lambda f, tx, ko, first, last: (f'<div class="who">{f}</div>' if first and f!='me' else '') + f'<div class="bb {"me" if f=="me" else "them"}{" tail" if last else ""}">{tx}<span class="k">{ko}</span></div>'
pages = []
# A
variant='A'
stack = lambda t, mem: f'<span class="stk">{av(mem[0],34)}{av(mem[1],34)}<i>+{len(mem)-1}</i></span>'
headA = f'<div class="rhead"><span class="cb">‹</span><span class="who2c"><span class="stk sm">{av("Ivo",26)}{av("Lio",26)}{av("Nele",26)}</span><b>Uni-Freunde</b><small>4명 ›</small></span><span class="kp">가 한국어</span></div>'
pages.append(('A','겹친 얼굴 (아이메시지)','목록은 멤버 얼굴 두 개 겹침 + 인원. 방 위에 얼굴 셋 + "4명 ›" → 누르면 멤버 목록. 말풍선 위에 이름만.', lst(stack, lambda t,m,l,x: f'{l}: {x}'), room(headA, plain)))
# B
variant='B'
grid = lambda t, mem: f'<span class="grid4">{"".join(av(n,23) for n in mem[:4])}</span>'
headB = f'<div class="rhead"><span class="cb">‹</span><span class="who2"><b>Uni-Freunde <em>4</em></b><small>Ivo · Lio · Nele · Ren</small></span><span class="kp">가 한국어</span></div>'
def bubB(f, tx, ko, first, last):
    if f == 'me': return plain(f, tx, ko, first, last)
    return f'<div class="brow">{av(f,32) if first else "<i class=avsp></i>"}<span>{f"<span class=who style=margin:0>{f}</span>" if first else ""}<div class="bb them{" tail" if last else ""}">{tx}<span class="k">{ko}</span></div></span></div>'
pages.append(('B','네모 얼굴판 + 옆 얼굴 (카톡)','목록은 멤버 얼굴 4칸 네모. 방 제목 옆 인원 수, 아래 멤버 이름 줄. 말풍선 왼쪽에 보낸 사람 얼굴 + 이름.', lst(grid, lambda t,m,l,x: x), room(headB, bubB)))
# C
variant='C'
tile = lambda t, mem: f'<span class="av sq" style="width:48px;height:48px;background:{"#5d84b8" if t=="Uni-Freunde" else "#b26a84"}">{PPL}</span>'
headC = f'<div class="rhead"><span class="cb">‹</span><span class="who2"><b>Uni-Freunde</b><small>단톡 · 4명</small></span><span class="kp">가 한국어</span></div>'
chipsC = '<div class="chips">' + ''.join(f'<span>{av(n,20)}{n}</span>' for n in ['Ivo','Lio','Nele','Ren']) + '</div>'
pages.append(('C','방 타일 + 멤버 칩','목록은 방마다 여러 명 아이콘 타일(색은 방 이름으로). 미리보기 앞에 "Lio:". 방 위에 멤버 칩 한 줄.', lst(tile, lambda t,m,l,x: f'<b class=sn>{l}</b> {x}'), room(headC, plain, chipsC)))
# D
variant='D'
letter = lambda t, mem: f'<span class="avw">{av(t,48)}<i>{len(mem)+1}</i></span>'
headD = f'<div class="rhead"><span class="cb">‹</span><span class="who2c">{av("Uni-Freunde",34)}<span><b>Uni-Freunde</b><small>Ivo, Lio, Nele, Ren, 나</small></span></span><span class="kp">가 한국어</span></div>'
def bubD(f, tx, ko, first, last):
    if f == 'me': return plain(f, tx, ko, first, last)
    return f'<div class="bb them{" tail" if last else ""}">{f"<b class=bn style=color:{COLN.get(f)}>{f}</b>" if first else ""}{tx}<span class="k">{ko}</span></div>'
pages.append(('D','이름 색 (왓츠앱)','목록은 방 이름 첫 글자 + 인원 배지. 방 위에 멤버 이름 줄. 말풍선 안 맨 위에 사람마다 다른 색 이름.', lst(letter, lambda t,m,l,x: f'{l}: {x}'), room(headD, bubD)))
css = open('style.css').read()
html = f'<!doctype html><html lang="ko"><head><meta charset="utf-8"><style>{css}</style></head><body><h1>메시지 › 단톡 — 시안 A–D</h1><p class="s">위: 대화 목록(단톡 둘 + 1:1 둘) · 아래: 단톡 방 "Uni-Freunde"(Ivo · Lio · Nele · Ren + 나)</p><div class="row">' + ''.join(f'<div class="col"><b>{k}. {t}</b><small>{d}</small><div class="ph">{a}<i class="ind"></i></div><div class="ph">{b}<i class="ind"></i></div></div>' for k,t,d,a,b in pages) + '</div></body></html>'
open('groupchat.html','w').write(html)
