TR = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3.5 5h9M8 3v2M5.5 5c.6 2.6 2.4 5 5 6M10.5 5c-.6 2.8-2.6 5.4-6 7M11.5 20l4-9 4 9M12.9 17h5.2"/></svg>'
V = {
 'A': ('가운데 유리 카드 (확인 창과 같은 질감)', '지금 폰의 확인 창(유리 카드) 그대로. 뒤가 살짝 어두워지고, 버튼은 닫기 | 다시 하기 반반. 화면을 막아서 꼭 보여요.',
       '<div class="dim"></div><div class="pA"><div class="card"><i class="ic">'+TR+'</i><b>한국어 번역을 못 했어요</b><span>다시 하면 빈 것만 번역해요</span><div class="btns"><em>닫기</em><em class="ok">다시 하기</em></div></div></div>'),
 'B': ('위에서 내려오는 알림 배너', '아이폰 알림처럼 위에서 내려와요. 뒤를 안 막고, 버튼 두 개가 배너 안에. 쓰던 화면을 계속 볼 수 있어요.',
       '<div class="pB"><i class="ic">'+TR+'</i><div class="t"><b>한국어 번역을 못 했어요</b><span>다시 하면 빈 것만 번역해요</span></div><div class="bb"><em>닫기</em><em class="ok">다시 하기</em></div></div>'),
 'C': ('아래 떠 있는 카드', '홈 막대 바로 위에 떠 있는 작은 카드. 한 줄 글 + 오른쪽 "다시 하기" 알약, 왼쪽 위 ✕로 닫기.',
       '<div class="pC"><i class="x">✕</i><i class="ic">'+TR+'</i><div class="t"><b>한국어 번역을 못 했어요</b><span>빈 것만 다시 번역해요</span></div><em class="ok">다시 하기</em></div>'),
 'D': ('아래서 올라오는 시트 (액션 시트)', '아래서 올라오는 유리 시트 + 따로 떨어진 "닫기". 위치 정보 도시 고르기 시트와 같은 모양.',
       '<div class="dim lt"></div><div class="pD"><div class="sh"><div class="hd"><b>한국어 번역을 못 했어요</b><span>다시 하면 빈 것만 번역해요</span></div><div class="o">'+TR+' 다시 하기</div></div><div class="sh x">닫기</div></div>'),
}
bases = ['b_home_light.png', 'b_msg_light.png']
css = open('style.css').read()
html = f'<!doctype html><html lang="ko"><head><meta charset="utf-8"><style>{css}</style></head><body><h1>번역 못 했을 때 팝업 — 시안 A–D</h1><p class="s">폰이 어느 화면에 있든 떠요(위: 홈 · 아래: 문자). 다시 하기 = 빈 한국어만 번역, 닫기 = 그 회차엔 다시 안 뜸</p><div class="row">' + ''.join(f'<div class="col"><b>{k}. {t}</b><small>{d}</small>' + ''.join(f'<div class="ph" style="background-image:url({b})"><div class="scr">{body}</div></div>' for b in bases) + '</div>' for k,(t,d,body) in V.items()) + '</div></body></html>'
open('trfail.html','w').write(html)
