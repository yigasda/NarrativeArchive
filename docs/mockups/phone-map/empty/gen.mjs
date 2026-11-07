const R='/home/user/NarrativeArchive/src/';
const a=await import(R+'phonemapart.js'), c=await import(R+'phonemapcity.js'), fl=await import(R+'phoneflags.js'), f=await import(R+'phonemapfind.js');
import fs from 'node:fs';
const i=a.townPlace('베를린'), v=f.placeView(i), H=v.hoods.map(h=>({n:c.HINT[h][3],k:c.HINT[h][2][0],w:c.HINT[h][1].join(' ')}));
const flag=fl.flagSvg('de',22).replace('class="mq_flag"','class="fl"');
const th=(h,w,hh,r=12)=>`<svg viewBox="80 90 230 ${230*hh/w}" width="${w}" height="${hh}" style="border-radius:${r}px;display:block;flex:none" preserveAspectRatio="xMidYMid slice">${a.townSvg(h.k,390,430,'베를린'+h.n,false,h.w)}</svg>`;
const S=(d,col='#8a929d',sw=2.2,s=17)=>`<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="${col}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round"><path d="${d}"/></svg>`;
const srch=(col)=>S('M11 4a7 7 0 1 0 0 14a7 7 0 0 0 0-14zM20 20l-4-4',col);
const pin=S('M12 21s-6-5.6-6-11a6 6 0 0 1 12 0c0 5.4-6 11-6 11zM12 8.5a1.5 1.5 0 1 0 0 3a1.5 1.5 0 0 0 0-3z','#2f6bff',2.2);
const chev=S('M9 6l6 6-6 6','#c2c7cf',2.4,15);
const head=(right='')=>`<div class="th">${flag}<b>베를린</b><span>사는 곳</span>${right}</div>`;
const field=`<div class="fd">${srch('#8a929d')}<span>도시 · 동네 찾기 (東京, Berlin, 홍대 …)</span></div>`;
const rows=(ico,n=3)=>H.slice(0,n).map(h=>`<div class="rw">${ico(h)}<div class="tx"><b>${h.n}</b><span>동네 지도 보기</span></div>${chev}</div>`).join('');
const C=c.PLACE.filter(x=>x[3]==='de'&&x[0]!=='베를린').slice(0,2);
const kn=(await import('/home/user/NarrativeArchive/src/phonemaptowns.js')).TOWN_KO;
const V={
 A:['목록 카드 · 마지막 줄이 찾기','기록 있는 화면의 목록 카드 그대로. 동네 2줄 + 맨 아래 파란 "다른 도시 · 동네 찾기" 줄.',
   head()+`<div class="card">${rows(()=>`<i class="si">${pin}</i>`,2)}<div class="rw"><i class="si" style="background:#2f6bff">${srch('#fff')}</i><div class="tx"><b style="color:#2f6bff">다른 도시 · 동네 찾기</b><span>東京, Berlin, 홍대 … 어느 말로든</span></div>${chev}</div></div>`],
 B:['검색칸이 먼저','제목 바로 밑에 검색칸(눈에 제일 먼저). 동네는 작은 지도 붙은 목록.',
   head()+field+`<div class="card">${rows(h=>th(h,40,40,11))}</div>`],
 C:['제목 옆 파란 찾기 버튼','제목 줄 오른쪽에 파란 "도시 찾기" 버튼. 아래는 동네 지도 2×2.',
   head(`<em class="pb">${srch('#fff')}도시 찾기</em>`)+`<div class="grid">${H.map(h=>`<div class="gc">${th(h,163,96,14)}<b>${h.n}</b></div>`).join('')}</div>`],
 D:['동네 지도 가로 줄 + 찾기 카드','동네 지도를 옆으로 넘겨 보고, 그 밑에 "다른 도시도 볼 수 있어요" 카드(검색 시작).',
   head()+`<div class="hs">${H.map(h=>`<div class="hc">${th(h,132,92,14)}<b>${h.n.split(' · ')[0]}</b></div>`).join('')}</div>`+`<div class="card"><div class="rw"><i class="si" style="background:#2f6bff">${srch('#fff')}</i><div class="tx"><b>다른 도시 · 동네 찾기</b><span>東京, Berlin, 홍대 … 어느 말로든</span></div>${chev}</div></div>`],

 E:['검색칸 + 동네 하나 크게','검색칸 밑에 첫 동네 하나만 큰 지도 카드로. 보이는 게 둘뿐이라 숨 쉴 데가 많음.',
   head()+field+`<div class="big">${th(H[0],344,96,14)}<div class="tx" style="padding:12px 6px 4px"><b>${H[0].n}</b><span>베를린의 동네 · 지도 보기</span></div></div>`],
 F:['검색 카드 하나에 다 담기','검색칸과 동네 칩이 한 카드 안에. 화면엔 띠 · 제목 · 이 카드 하나.',
   head()+`<div class="card" style="padding:14px 14px 16px"><div class="fd in">${srch('#8a929d')}<span>도시 · 동네 찾기 (東京, Berlin …)</span></div><small class="cl">베를린의 동네</small><div class="cp">${H.slice(0,3).map(h=>`<span class="ch">${h.n.split(' · ')[0]}</span>`).join('')}</div></div>`],
 G:['같은 나라 다른 도시','동네 대신 독일의 다른 도시들(국기 · 어울리는 지도). 마지막 줄이 찾기.',
   head()+`<div class="card">${C.map(x=>`<div class="rw"><i class="si" style="background:#f1f3f6">${fl.flagSvg('de',22).replace('class="mq_flag"','class="fl"')}</i><div class="tx"><b>${x[0]} · ${x[1][0]}</b><span>${kn[a.townCandidates(x[0])[0]]}</span></div>${chev}</div>`).join('')}<div class="rw"><i class="si" style="background:#2f6bff">${srch('#fff')}</i><div class="tx"><b style="color:#2f6bff">다른 도시 · 동네 찾기</b></div>${chev}</div></div>`],
};
const css=`*{box-sizing:border-box;margin:0;padding:0}body{background:#d9dce2;font-family:-apple-system,'Noto Sans KR',sans-serif;color:#161b22;padding:24px;width:1720px}
.big{background:#fff;border-radius:22px;padding:8px 8px 10px;margin:0 8px 18px;box-shadow:0 1px 2px rgba(22,27,34,.04),0 8px 24px rgba(22,27,34,.05)}.big svg{width:100%!important}
.fd.in{margin:0 0 16px;background:#eceef2;box-shadow:none}.cl{display:block;font-size:12.5px;color:#7b818c;font-weight:600;margin:0 4px 10px}.cp{display:flex;gap:8px;overflow:hidden}.ch{height:32px;padding:0 13px;border-radius:999px;background:#f1f3f6;font-size:13.5px;display:flex;align-items:center;white-space:nowrap}
h1{font-size:22px;margin-bottom:16px}.row{display:grid;grid-template-columns:repeat(4,400px);row-gap:40px;gap:24px}.col>b{display:block;font-size:17px}.col>small{display:block;font-size:12.5px;color:#555;margin:4px 0 10px;min-height:34px}
.ph{width:392px;height:833px;position:relative;overflow:hidden;background:url(base.png) 0 0/392px auto no-repeat;border-radius:44px}
.ov{position:absolute;left:8px;right:8px;top:543px;bottom:20px;background:#f3f4f6;overflow:hidden}
.ind{position:absolute;bottom:8px;left:50%;transform:translateX(-50%);width:130px;height:5px;border-radius:3px;background:#111}
.th{display:flex;align-items:center;gap:8px;padding:22px 18px 12px}.th b{font-size:20px;font-weight:600}.th span{font-size:13px;color:#6b7380}.fl{border-radius:3px;box-shadow:0 0 0 .5px rgba(0,0,0,.14)}
.card{background:#fff;border-radius:22px;box-shadow:0 1px 2px rgba(22,27,34,.04),0 8px 24px rgba(22,27,34,.05);margin:0 8px 18px;padding:4px 0}
.rw{display:flex;align-items:center;gap:12px;padding:13px 16px;position:relative}.rw+.rw::before{content:'';position:absolute;left:68px;right:14px;top:0;height:1px;background:#eef0f3}
.si{width:40px;height:40px;border-radius:12px;background:#e1e9ff;display:grid;place-items:center;flex:none}
.tx{flex:1;min-width:0}.tx b{display:block;font-size:15px;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.tx span{display:block;font-size:12.5px;color:#7b818c}
.fd{height:50px;margin:0 8px 18px;border-radius:14px;background:#fff;box-shadow:0 1px 2px rgba(22,27,34,.05),0 6px 16px rgba(22,27,34,.06);display:flex;align-items:center;gap:8px;padding:0 14px;font-size:15px;color:#8a929d;white-space:nowrap;overflow:hidden}
.pb{margin-left:auto;font-style:normal;display:flex;align-items:center;gap:5px;height:32px;padding:0 12px 0 10px;border-radius:999px;background:#2f6bff;color:#fff;font-size:13.5px;font-weight:600;white-space:nowrap}
.grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin:0 8px}.gc{background:#fff;border-radius:18px;padding:6px 6px 8px;box-shadow:0 1px 2px rgba(22,27,34,.04),0 6px 18px rgba(22,27,34,.05)}.gc svg{width:100%!important}.gc b{display:block;font-size:12.5px;font-weight:500;margin:6px 4px 0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.hs{display:flex;gap:12px;overflow:hidden;padding:0 8px 18px}.hc{flex:none;width:144px;background:#fff;border-radius:18px;padding:6px 6px 8px;box-shadow:0 1px 2px rgba(22,27,34,.04),0 6px 18px rgba(22,27,34,.05)}.hc b{display:block;font-size:13px;font-weight:500;margin:6px 4px 0;white-space:nowrap}`;
fs.writeFileSync('empty3.html',`<!doctype html><html lang="ko"><head><meta charset="utf-8"><style>${css}</style></head><body><h1>빈 다녀간 곳 — 여백 넓힘 (A–D) + 새 시안 (E–G)</h1><div class="row">${Object.entries(V).map(([k,[t,s,b]])=>`<div class="col"><b>${k}. ${t}</b><small>${s}</small><div class="ph"><div class="ov">${b}</div><i class="ind"></i></div></div>`).join('')}</div></body></html>`);
