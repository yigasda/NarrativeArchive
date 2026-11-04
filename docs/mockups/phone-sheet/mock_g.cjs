// 폰 확인 창 C2(유리 알림)를 더 유리답게: 3가지 × (지우는 창, 고르는 창), 실제 폰 위에 얹어 찍어요. 마지막 인자 android = 안드로이드 글꼴로
const { open } = require('/home/user/NarrativeArchive/tools/dev/probe.cjs');
const ANDROID = process.argv[3] === 'android';
const SYS = ANDROID ? "font-family:'Noto Sans KR',sans-serif;" : "font-family:-apple-system,'SF Pro Text','Noto Sans KR',sans-serif;";
const NUM = "font-family:'Inter Tight',sans-serif;font-variant-numeric:tabular-nums;";
const dim = (inner, align = 'flex-end', pad = '0') => `<div style="position:absolute;inset:0;z-index:60;background:rgba(17,22,30,.42);display:flex;flex-direction:column;justify-content:${align};padding:${pad};box-sizing:border-box;${SYS}">${inner}</div>`;
const svg = (d, s, c, w = 2) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
const REDO = '<path d="M20 12a8 8 0 1 1-2.3-5.6M20 4v5h-5"/>', CAL = '<rect x="4" y="5" width="16" height="15" rx="3"/><path d="M8 3v4M16 3v4M4 10h16"/>';
const KILL = { t: '이 방의 폰을 새로 시작할까요?', b: '모든 인물의 폰이 지워져요.', ok: '새로 시작', no: '취소' };
const DATE = { t: '상태창 날짜를 어떻게 쓰세요?', b: '나중에 설정에서 바꿀 수 있어요.', a: ['월.일', '11.03', '11월 3일'], c: ['일.월', '03.11.', '11월 3일'], no: '나중에' };
const RED = '#c4503b', NAVY = '#1d3461';
const sh2 = (a = .06, b = .2) => `0 1px 2px rgba(22,27,34,${a}),0 16px 40px rgba(22,27,34,${b})`;
const GLASS = 'background:linear-gradient(180deg,rgba(255,255,255,.97),rgba(244,246,250,.95));box-shadow:inset 0 1.5px 0 #fff,inset 0 0 0 1px rgba(255,255,255,.7),0 1px 2px rgba(22,27,34,.08),0 22px 50px rgba(10,16,28,.32)';
const HAIR = 'border-top:.5px solid rgba(60,60,67,.18)';
const BLUE = '#2c4a80';
const row = (t, c, extra = '') => `<div style="${HAIR};height:56px;display:flex;align-items:center;justify-content:center;font-size:19px;color:${c};${extra}">${t}</div>`;
const alertKill = (box, hair, extra = '') => dim(`<div style="margin:0 auto;width:286px;border-radius:26px;overflow:hidden;position:relative;${box}">${extra}
      <div style="position:relative;padding:22px 20px 18px;text-align:center"><div style="font-size:17px;font-weight:600;color:#161b22">${KILL.t}</div><div style="margin-top:5px;font-size:13.5px;line-height:1.4;color:#4f5763">${KILL.b}</div></div>
      <div style="position:relative;display:flex;border-top:.5px solid ${hair}"><div style="flex:1;height:48px;display:flex;align-items:center;justify-content:center;font-size:17px;color:${BLUE}">${KILL.no}</div><div style="width:.5px;background:${hair}"></div><div style="flex:1;height:48px;display:flex;align-items:center;justify-content:center;font-size:17px;font-weight:600;color:#d0453a">${KILL.ok}</div></div></div>`, 'center');
const alertDate = (box, hair, extra = '') => dim(`<div style="margin:0 auto;width:286px;border-radius:26px;overflow:hidden;position:relative;${box}">${extra}
      <div style="position:relative;padding:22px 20px 16px;text-align:center"><div style="font-size:17px;font-weight:600;color:#161b22">${DATE.t}</div><div style="margin-top:5px;font-size:13.5px;line-height:1.4;color:#4f5763">상태창의 <b style="${NUM}color:#161b22">03.11.</b> 은 언제예요?</div></div>
      ${[['3월 11일', '월.일'], ['11월 3일', '일.월']].map(([d, n]) => `<div style="position:relative;border-top:.5px solid ${hair};height:50px;display:flex;align-items:center;justify-content:center;gap:8px;font-size:17px;color:${BLUE}">${d}<span style="font-size:12.5px;color:#7d8590">${n}</span></div>`).join('')}
      <div style="position:relative;border-top:.5px solid ${hair};height:50px;display:flex;align-items:center;justify-content:center;font-size:17px;font-weight:600;color:${BLUE}">${DATE.no}</div></div>`, 'center');
// a light edge all round (bright at the top-left, fading, bright again at the bottom), the same ring trick the sheet uses now
const RING = `<div style="position:absolute;inset:0;border-radius:inherit;padding:1px;background:linear-gradient(160deg,rgba(255,255,255,.95),rgba(255,255,255,.25) 35%,rgba(255,255,255,.1) 65%,rgba(255,255,255,.7));-webkit-mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);-webkit-mask-composite:xor;mask-composite:exclude;pointer-events:none;z-index:2"></div>`;
const SHEEN = `<div style="position:absolute;left:0;right:0;top:0;height:46%;background:linear-gradient(180deg,rgba(255,255,255,.55),rgba(255,255,255,0));pointer-events:none"></div>`;
const DEEP = '0 1px 1px rgba(10,16,28,.08),0 10px 24px rgba(10,16,28,.18),0 30px 70px rgba(10,16,28,.34)';
const V = {
  // G1. 진짜 블러: 반투명 흰색 + 뒤 흐림(실리태번 블러 설정이 꺼져 있어도 이 창만 켬) + 빛 테두리
  G1: {
    kill: alertKill(`background:rgba(250,251,253,.62);backdrop-filter:blur(26px) saturate(180%) !important;-webkit-backdrop-filter:blur(26px) saturate(180%);box-shadow:${DEEP}`, 'rgba(60,60,67,.22)', RING),
    date: alertDate(`background:rgba(250,251,253,.62);backdrop-filter:blur(26px) saturate(180%) !important;-webkit-backdrop-filter:blur(26px) saturate(180%);box-shadow:${DEEP}`, 'rgba(60,60,67,.22)', RING),
  },
  // G2. 블러 없이 유리: 위쪽 반사광 띠 + 빛 테두리 + 세 겹 그림자, 아래로 갈수록 살짝 푸른 회색
  G2: {
    kill: alertKill(`background:linear-gradient(180deg,#fdfdfe 0%,#f1f3f7 60%,#e9edf3 100%);box-shadow:inset 0 -1px 0 rgba(10,16,28,.05),${DEEP}`, 'rgba(60,60,67,.16)', SHEEN + RING),
    date: alertDate(`background:linear-gradient(180deg,#fdfdfe 0%,#f1f3f7 60%,#e9edf3 100%);box-shadow:inset 0 -1px 0 rgba(10,16,28,.05),${DEEP}`, 'rgba(60,60,67,.16)', SHEEN + RING),
  },
  // G3. 둘 다: 블러 + 반사광 띠 + 빛 테두리, 살짝 하늘빛
  G3: {
    kill: alertKill(`background:linear-gradient(180deg,rgba(255,255,255,.78),rgba(236,242,250,.6));backdrop-filter:blur(30px) saturate(190%) !important;-webkit-backdrop-filter:blur(30px) saturate(190%);box-shadow:${DEEP}`, 'rgba(60,60,67,.2)', SHEEN + RING),
    date: alertDate(`background:linear-gradient(180deg,rgba(255,255,255,.78),rgba(236,242,250,.6));backdrop-filter:blur(30px) saturate(190%) !important;-webkit-backdrop-filter:blur(30px) saturate(190%);box-shadow:${DEEP}`, 'rgba(60,60,67,.2)', SHEEN + RING),
  },
};
const L = { G1: 'G1. 진짜 블러', G2: 'G2. 블러 없이 반사광', G3: 'G3. 블러 + 반사광' };
(async () => {
  const out = process.argv[2]; const s = await open('light', { out });
  for (const k of Object.keys(V)) for (const w of ['kill', 'date']) {
    await s.to('home'); await s.p.evaluate(() => document.body.classList.remove('no-blur'));
    await s.p.evaluate(([h, l, android]) => { const sc = document.querySelector('.na_ph_frame .na_ph_scr'); sc.style.position = 'relative';
      if (android) sc.querySelectorAll('*').forEach(e => { e.style.fontFamily = "'Noto Sans KR', sans-serif"; });
      sc.insertAdjacentHTML('beforeend', h); const tag = document.createElement('div'); tag.textContent = l; tag.style.cssText = 'position:absolute;left:0;right:0;top:58px;text-align:center;font:700 15px sans-serif;color:#d0306a;z-index:99'; sc.append(tag); }, [V[k][w], L[k] + (ANDROID ? ' · 안드로이드 글꼴' : ''), ANDROID]);
    await s.p.waitForTimeout(300); await s.shot(`${k}_${w}${ANDROID ? '_and' : ''}`);
  }
  console.log(s.errors()); await s.close();
})();
