// 폰 확인 창 C(유리)를 iOS 쪽으로: 3가지 × (지우는 창, 고르는 창), 실제 폰 위에 얹어 찍어요. 마지막 인자 android = 안드로이드 글꼴로
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
const V = {
  // C1. iOS 액션 시트: C의 유리 재질로 메시지 + 줄 버튼(머리카락 선), 따로 떨어진 취소
  C1: {
    kill: dim(`<div style="margin:0 10px 28px;display:flex;flex-direction:column;gap:9px"><div style="border-radius:24px;overflow:hidden;${GLASS}">
      <div style="padding:16px 22px 14px;text-align:center"><div style="font-size:14px;font-weight:600;color:#3d4550">${KILL.t}</div><div style="margin-top:3px;font-size:13px;color:#7a828e">${KILL.b}</div></div>
      ${row(KILL.ok, '#d0453a')}</div>
      <div style="border-radius:24px;${GLASS};height:57px;display:flex;align-items:center;justify-content:center;font-size:19px;font-weight:600;color:${BLUE}">${KILL.no}</div></div>`),
    date: dim(`<div style="margin:0 10px 28px;display:flex;flex-direction:column;gap:9px"><div style="border-radius:24px;overflow:hidden;${GLASS}">
      <div style="padding:16px 22px 14px;text-align:center"><div style="font-size:14px;font-weight:600;color:#3d4550">${DATE.t}</div><div style="margin-top:3px;font-size:13px;color:#7a828e">${DATE.b}</div></div>
      ${[DATE.a, DATE.c].map(o => row(`${o[0]}<span style="margin-left:9px;font-size:14px;color:#8a919c"><span style="${NUM}">${o[1]}</span> = ${o[2]}</span>`, BLUE)).join('')}</div>
      <div style="border-radius:24px;${GLASS};height:57px;display:flex;align-items:center;justify-content:center;font-size:19px;font-weight:600;color:${BLUE}">${DATE.no}</div></div>`),
  },
  // C2. iOS 알림: 가운데 유리 카드, 가운데 글, 아래 버튼은 머리카락 선으로 나눈 칸 (두 개면 가로, 세 개면 세로)
  C2: {
    kill: dim(`<div style="margin:0 auto;width:286px;border-radius:24px;overflow:hidden;${GLASS}">
      <div style="padding:22px 20px 18px;text-align:center"><div style="font-size:17px;font-weight:600;color:#161b22">${KILL.t}</div><div style="margin-top:5px;font-size:13.5px;line-height:1.4;color:#5a626e">${KILL.b}</div></div>
      <div style="display:flex;${HAIR}"><div style="flex:1;height:48px;display:flex;align-items:center;justify-content:center;font-size:17px;color:${BLUE}">${KILL.no}</div><div style="width:.5px;background:rgba(60,60,67,.18)"></div><div style="flex:1;height:48px;display:flex;align-items:center;justify-content:center;font-size:17px;font-weight:600;color:#d0453a">${KILL.ok}</div></div></div>`, 'center'),
    date: dim(`<div style="margin:0 auto;width:286px;border-radius:24px;overflow:hidden;${GLASS}">
      <div style="padding:22px 20px 16px;text-align:center"><div style="font-size:17px;font-weight:600;color:#161b22">${DATE.t}</div><div style="margin-top:5px;font-size:13.5px;line-height:1.4;color:#5a626e">상태창의 <b style="${NUM}color:#161b22">03.11.</b> 은 언제예요?</div></div>
      ${[['3월 11일', '월.일'], ['11월 3일', '일.월']].map(([d, n]) => `<div style="${HAIR};height:50px;display:flex;align-items:center;justify-content:center;gap:8px;font-size:17px;color:${BLUE}">${d}<span style="font-size:12.5px;color:#8a919c">${n}</span></div>`).join('')}
      <div style="${HAIR};height:50px;display:flex;align-items:center;justify-content:center;font-size:17px;font-weight:600;color:${BLUE}">${DATE.no}</div></div>`, 'center'),
  },
  // C3. iOS 설정 묶음: 유리 시트 안에 흰 묶음 칸(설정 앱 목록처럼), 줄 오른쪽에 회색 값, 아래 따로 떨어진 취소
  C3: {
    kill: dim(`<div style="margin:0 10px 28px;display:flex;flex-direction:column;gap:9px"><div style="border-radius:26px;padding:18px 14px 14px;${GLASS}">
      <div style="padding:0 6px;text-align:center"><div style="font-size:16px;font-weight:700;color:#161b22">${KILL.t}</div><div style="margin-top:4px;font-size:13px;color:#6b7380">${KILL.b}</div></div>
      <div style="margin-top:14px;border-radius:14px;background:#fff;box-shadow:0 1px 2px rgba(22,27,34,.05)"><div style="height:50px;display:flex;align-items:center;padding:0 16px;gap:12px;font-size:16px;color:#d0453a">${svg(REDO, 20, '#d0453a')}${KILL.ok}</div></div></div>
      <div style="border-radius:26px;${GLASS};height:56px;display:flex;align-items:center;justify-content:center;font-size:18px;font-weight:600;color:${BLUE}">${KILL.no}</div></div>`),
    date: dim(`<div style="margin:0 10px 28px;display:flex;flex-direction:column;gap:9px"><div style="border-radius:26px;padding:18px 14px 14px;${GLASS}">
      <div style="padding:0 6px;text-align:center"><div style="font-size:16px;font-weight:700;color:#161b22">${DATE.t}</div><div style="margin-top:4px;font-size:13px;color:#6b7380">${DATE.b}</div></div>
      <div style="margin-top:14px;border-radius:14px;background:#fff;box-shadow:0 1px 2px rgba(22,27,34,.05);overflow:hidden">${[DATE.a, DATE.c].map((o, i) => `${i ? '<div style="height:.5px;background:#e3e6eb;margin-left:16px"></div>' : ''}<div style="height:50px;display:flex;align-items:center;padding:0 16px;font-size:16px;color:#161b22"><span style="flex:1">${o[0]}</span><span style="font-size:14.5px;color:#8a919c"><span style="${NUM}">${o[1]}</span> → ${o[2]}</span></div>`).join('')}</div></div>
      <div style="border-radius:26px;${GLASS};height:56px;display:flex;align-items:center;justify-content:center;font-size:18px;font-weight:600;color:${BLUE}">${DATE.no}</div></div>`),
  },
};
const L = { C1: 'C1. 유리 액션 시트', C2: 'C2. 유리 알림', C3: 'C3. 유리 + 설정 묶음' };
(async () => {
  const out = process.argv[2]; const s = await open('light', { out });
  for (const k of Object.keys(V)) for (const w of ['kill', 'date']) {
    await s.to('set'); await s.scroll();
    await s.p.evaluate(([h, l, android]) => { const sc = document.querySelector('.na_ph_frame .na_ph_scr'); sc.style.position = 'relative';
      if (android) sc.querySelectorAll('*').forEach(e => { e.style.fontFamily = "'Noto Sans KR', sans-serif"; });
      sc.insertAdjacentHTML('beforeend', h); const tag = document.createElement('div'); tag.textContent = l; tag.style.cssText = 'position:absolute;left:0;right:0;top:58px;text-align:center;font:700 15px sans-serif;color:#d0306a;z-index:99'; sc.append(tag); }, [V[k][w], L[k] + (ANDROID ? ' · 안드로이드 글꼴' : ''), ANDROID]);
    await s.p.waitForTimeout(300); await s.shot(`${k}_${w}${ANDROID ? '_and' : ''}`);
  }
  console.log(s.errors()); await s.close();
})();
