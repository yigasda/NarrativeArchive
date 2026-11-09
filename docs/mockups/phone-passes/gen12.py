# 지갑 › 표 12종류 — 종류마다 다른 표 모양 (플랫, 은행 카드와 같은 그림자)
I = {
 'plane':'M2 16l20-8-20-8v6l14 2-14 2z','train':'M6 4h12a2 2 0 0 1 2 2v9H4V6a2 2 0 0 1 2-2zM4 11h16M8 19l-2 2M16 19l2 2','bus':'M6 4h12a2 2 0 0 1 2 2v10H4V6a2 2 0 0 1 2-2zM4 11h16M7 19v-3M17 19v-3',
 'ship':'M3 17l2 4h14l2-4zM6 17V9h12v8M12 9V4M9 6h6','bed':'M3 18V8M3 14h18v4M21 14v-3a3 3 0 0 0-3-3h-7v6M7 11a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z','note':'M9 18V5l12-2v13M9 18a3 3 0 1 1-6 0 3 3 0 0 1 6 0zM21 16a3 3 0 1 1-6 0 3 3 0 0 1 6 0z',
 'mask':'M4 5h16v6a8 8 0 0 1-16 0zM8 10h.01M16 10h.01M9 14c1.5 1 4.5 1 6 0','film':'M4 5h16v14H4zM8 5v14M16 5v14M4 9h4M4 15h4M16 9h4M16 15h4','ball':'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 7l4 3-1.5 5h-5L8 10z',
 'museum':'M3 9l9-5 9 5M5 9v9M9 9v9M15 9v9M19 9v9M3 20h18','wheel':'M12 3a8 8 0 1 0 0 16 8 8 0 0 0 0-16zM12 3v16M4 11h16M6.3 5.3l11.4 11.4M17.7 5.3L6.3 16.7M8 21h8','card':'M3 6h18v12H3zM3 10h18M7 15h4',
}
ic = lambda k, s=18, c='currentColor', w=1.9: f'<svg width="{s}" height="{s}" viewBox="0 0 24 24" fill="none" stroke="{c}" stroke-width="{w}" stroke-linecap="round" stroke-linejoin="round"><path d="{I[k]}"/></svg>'
F = lambda xs, cls='': f'<div class="fl {cls}">' + ''.join(f'<span><small>{a}</small><b>{b}</b></span>' for a,b in xs) + '</div>'
def qr(n=11):
    import random; r=random.Random(n); return '<span class="qr">' + ''.join(f'<i style="background:{"#111" if r.random()>.5 else "#fff"}"></i>' for _ in range(81)) + '</span>'
bars = lambda n=26, c='#222': '<span class="bars">' + ''.join(f'<u style="width:{1+(i*7)%3}px;background:{c}"></u>' for i in range(n)) + '</span>'
T = []
# 1 항공 — 탑승권: 큰 공항 코드, 항로 점선, 아래 QR 칸
T.append(('항공 · 탑승권', f'''<div class="t fly"><div class="hd"><span class="lg">{ic("plane")}</span><b>LUFTHANSA</b><span class="r"><small>BOARDING</small>14:50</span></div>
<div class="route"><div><b>FRA</b><small>Frankfurt</small></div><svg viewBox="0 0 120 30"><path d="M4 22 Q60 -8 116 22" fill="none" stroke="#fff" stroke-opacity=".55" stroke-dasharray="3 4"/><path d="M56 6 l8 -2 -8 -2 v1.2 l4 .8 -4 .8z" fill="#fff" transform="translate(0 4) scale(1.3) translate(-13 -1)"/></svg><div class="r"><b>ICN</b><small>Seoul</small></div></div>
{F([("날짜","09.11."),("탑승구","A13"),("좌석","1A"),("편명","LH 712")])}<div class="grp"><span>GROUP 1 · PRIORITY</span></div></div>'''))
# 2 기차 — 종이 승차권: 크림 종이, 빨간 머리, 출발 · 도착 시간 표
T.append(('기차 · 승차권', f'''<div class="t rail"><div class="hd"><span class="lg">{ic("train")}</span><b>DB</b><span class="ice">ICE 123</span><span class="r">2. Klasse</span></div>
<div class="tt"><div><small>ab 09:54</small><b>Frankfurt Hbf</b></div><i></i><div><small>an 11:02</small><b>Köln Hbf</b></div></div>
{F([("날짜","10.11."),("칸","Wg 7"),("좌석","45 · Fenster")],"dk")}<div class="perf"></div><div class="foot">Sparpreis · 1 Erwachsener {bars(22,"#6c2a25")}</div></div>'''))
# 3 버스 — 짧은 모바일 표: 초록 띠, 큰 승차 번호
T.append(('버스 · 고속버스', f'''<div class="t bus"><div class="hd"><span class="lg">{ic("bus")}</span><b>FlixBus</b><span class="r">N° 4412</span></div>
<div class="bigline"><b>Frankfurt</b><span>→</span><b>München</b></div>
<div class="row2"><div class="plat"><small>승차장</small><b>12</b></div>{F([("출발","07:30"),("도착","13:15"),("좌석","21C")],"dk")}</div></div>'''))
# 4 배 — 물결 무늬 위, 배 이름
T.append(('배 · 페리', f'''<div class="t ferry"><svg class="waves" viewBox="0 0 340 60" preserveAspectRatio="none"><path d="M0 30 Q42 18 85 30 T170 30 T255 30 T340 30 V60 H0z" fill="#fff" opacity=".12"/><path d="M0 42 Q42 32 85 42 T170 42 T255 42 T340 42 V60 H0z" fill="#fff" opacity=".12"/></svg>
<div class="hd"><span class="lg">{ic("ship")}</span><b>STENA LINE</b><span class="r">Kiel → Göteborg</span></div><div class="ship">M/S Stena Germanica</div>
{F([("승선","19:00"),("객실","Kabine 5214"),("차량","—")])}</div>'''))
# 5 숙소 — 호텔 키카드 느낌: 크림 + 금선, 체크인 ~ 체크아웃 큰 숫자
T.append(('숙소 · 예약 확인', f'''<div class="t hotel"><div class="gold"></div><div class="hd"><span class="lg">{ic("bed")}</span><b>HOTEL LISBOA MAR</b><span class="r">★★★★</span></div>
<div class="stay"><div><small>체크인</small><b>30.10.</b><em>15:00</em></div><span>3박</span><div class="r"><small>체크아웃</small><b>02.11.</b><em>11:00</em></div></div>
{F([("객실","Deluxe 412"),("인원","2명"),("예약","HL-2231")],"dk")}</div>'''))
# 6 콘서트 — 남색 + 무대 빛줄기, 공연 이름 크게, 오른쪽 떼는 쪽
T.append(('콘서트', f'''<div class="t live"><svg class="rays" viewBox="0 0 260 200" preserveAspectRatio="none">{''.join(f'<path d="M200 -10 L{40+i*40} 220" stroke="#f2d28a" stroke-opacity=".14" stroke-width="{16-i*2}"/>' for i in range(5))}</svg>
<div class="main"><div class="hd"><span class="lg">{ic("note")}</span><b>FESTHALLE</b></div><div class="act">IU · H.E.R.</div><div class="sub">World Tour 2026</div>{F([("날짜","14.11."),("구역","Floor A"),("좌석","R7 · 12")])}</div>
<div class="stub"><small>입장</small><b>19:00</b>{bars(14,"#f2d28a")}</div></div>'''))
# 7 공연 · 뮤지컬 — 커튼 빨강, 금색 테두리, 가운데 정렬
T.append(('공연 · 연극 · 뮤지컬', f'''<div class="t stage"><div class="curt l"></div><div class="curt r"></div><div class="in"><span class="lg">{ic("mask")}</span><small>ALTE OPER FRANKFURT</small><b>Les Misérables</b><em>Sa 15.11. · 19:30</em>
{F([("구역","Parkett"),("줄","7"),("좌석","12")],"c")}</div></div>'''))
# 8 영화 — 검정 + 필름 구멍 띠, 관 · 좌석 크게
T.append(('영화', f'''<div class="t cine"><div class="holes t1"></div><div class="hd"><span class="lg">{ic("film")}</span><b>CINESTAR METROPOLIS</b><span class="r">20:15</span></div>
<div class="movie">Dune: Part Three</div><div class="seatbig"><span><small>관</small><b>5</b></span><span><small>줄</small><b>H</b></span><span><small>좌석</small><b>14</b></span><span class="tag">OV · 2D</span></div><div class="holes b1"></div></div>'''))
# 9 경기 — 초록 경기장 줄, 두 팀 vs
T.append(('경기 · 스포츠', f'''<div class="t match"><svg class="pitch" viewBox="0 0 340 170" preserveAspectRatio="none"><rect x="10" y="10" width="320" height="150" fill="none" stroke="#fff" stroke-opacity=".16" stroke-width="2"/><path d="M170 10 V160" stroke="#fff" stroke-opacity=".16" stroke-width="2"/><circle cx="170" cy="85" r="28" fill="none" stroke="#fff" stroke-opacity=".16" stroke-width="2"/></svg>
<div class="hd"><span class="lg">{ic("ball")}</span><b>DEUTSCHE BANK PARK</b><span class="r">Anstoß 18:30</span></div><div class="vs"><b>Eintracht</b><small>vs</small><b>Bayern</b></div>
{F([("날짜","22.11."),("블록","43"),("줄","12"),("좌석","9")])}</div>'''))
# 10 전시 · 박물관 — 흰 종이 + 그림 한 장(액자), 날짜 도장
T.append(('전시 · 박물관', f'''<div class="t art"><div class="frame"><svg viewBox="0 0 90 70"><rect width="90" height="70" fill="#e9d9b8"/><circle cx="62" cy="22" r="10" fill="#e2b65c"/><path d="M0 70 L30 34 L50 52 L64 40 L90 70z" fill="#7a9a6a"/><path d="M0 70 L22 50 L44 70z" fill="#4f6f8f"/></svg></div>
<div class="txt"><small>STÄDEL MUSEUM</small><b>Rembrandt · Licht</b>{F([("날짜","16.11."),("입장권","성인"),("시간","11:00")],"dk")}</div><span class="stamp">14 €</span></div>'''))
# 11 놀이공원 — 손목밴드 느낌: 길고 둥근 띠, 점 무늬, 하루 이용
T.append(('놀이공원', f'''<div class="t park"><div class="dots"></div><div class="hd"><span class="lg">{ic("wheel")}</span><b>EUROPA-PARK</b><span class="r">1-Tag</span></div>
<div class="pk"><b>Tageskarte</b><small>16.11. · 9:00 – 18:00</small></div><div class="band">{qr(5)}<span>ERWACHSENER · Nº 88213</span></div></div>'''))
# 12 회원권 — 카드 모양(은행 카드처럼), 회원 이름, 기간
T.append(('회원권 · 구독', f'''<div class="t member"><svg class="gl" viewBox="0 0 340 200" preserveAspectRatio="none">{''.join(f'<ellipse cx="270" cy="100" rx="{40+i*9}" ry="{90-i*4}" transform="rotate({i*12} 270 100)" fill="none" stroke="#fff" stroke-opacity=".12" stroke-width=".8"/>' for i in range(10))}</svg>
<div class="hd"><span class="lg">{ic("card")}</span><b>URBAN SPORTS CLUB</b><span class="r">M</span></div><div class="mname">MARA VARO</div>
{F([("기간","01.10. ~ 31.12."),("번호","US-88 204")])}</div>'''))
css=open('style12.css').read()
ph = lambda xs: '<div class="ph">' + ''.join(f'<div class="cap">{n}</div>{h}' for n,h in xs) + '</div>'
html=f'<!doctype html><html lang="ko"><head><meta charset="utf-8"><style>{css}</style></head><body><h1>지갑 › 표 12종류 — 종류마다 다른 모양</h1><p class="s">색만 다른 카드 대신, 실제 그 표처럼: 탑승권 · 승차권 · 고속버스 · 페리 · 숙소 확인 · 콘서트 · 공연 · 영화 · 경기 · 전시 · 놀이공원 · 회원권</p><div class="row">{ph(T[0:4])}{ph(T[4:8])}{ph(T[8:12])}</div></body></html>'
open('passes12.html','w').write(html)
