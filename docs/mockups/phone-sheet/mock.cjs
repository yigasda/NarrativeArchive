// 폰 확인 창 새 디자인 시안: 4가지 방향 × (지우는 창, 고르는 창), 실제 폰 위에 얹어 찍어요. 마지막 인자 android = 안드로이드 글꼴로
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
const V = {
  // A. 흰 바텀 시트: 화면 아래에 붙는 흰 시트, 손잡이, 아이콘 칸, 왼쪽 정렬 큰 제목, 버튼 두 개
  A: {
    kill: dim(`<div style="background:#fff;border-radius:28px 28px 0 0;padding:10px 22px 40px;box-shadow:0 -10px 34px rgba(22,27,34,.18)">
      <div style="width:38px;height:5px;border-radius:3px;background:#e1e4e9;margin:0 auto 20px"></div>
      <div style="width:46px;height:46px;border-radius:14px;background:#f8e4df;display:flex;align-items:center;justify-content:center">${svg(REDO, 23, RED)}</div>
      <div style="margin-top:14px;font-size:19px;font-weight:700;color:#161b22;letter-spacing:-.02em">${KILL.t}</div>
      <div style="margin-top:6px;font-size:14px;color:#646c78">${KILL.b}</div>
      <div style="margin-top:22px;display:flex;gap:10px"><div style="flex:1;height:50px;border-radius:15px;background:#eef0f3;display:flex;align-items:center;justify-content:center;font-size:15.5px;font-weight:600;color:#3d4550">${KILL.no}</div>
      <div style="flex:1.3;height:50px;border-radius:15px;background:${RED};display:flex;align-items:center;justify-content:center;font-size:15.5px;font-weight:600;color:#fff;box-shadow:inset 0 1px 0 rgba(255,255,255,.2),0 6px 16px rgba(196,80,59,.28)">${KILL.ok}</div></div></div>`),
    date: dim(`<div style="background:#fff;border-radius:28px 28px 0 0;padding:10px 22px 40px;box-shadow:0 -10px 34px rgba(22,27,34,.18)">
      <div style="width:38px;height:5px;border-radius:3px;background:#e1e4e9;margin:0 auto 20px"></div>
      <div style="width:46px;height:46px;border-radius:14px;background:#e2e9f5;display:flex;align-items:center;justify-content:center">${svg(CAL, 23, '#2c4a80')}</div>
      <div style="margin-top:14px;font-size:19px;font-weight:700;color:#161b22;letter-spacing:-.02em">${DATE.t}</div>
      <div style="margin-top:6px;font-size:14px;color:#646c78">${DATE.b}</div>
      <div style="margin-top:18px;border-radius:16px;background:#f4f5f8;overflow:hidden">${[DATE.a, DATE.c].map((o, i) => `${i ? '<div style="height:.5px;background:#e3e6eb;margin:0 16px"></div>' : ''}<div style="display:flex;align-items:center;height:56px;padding:0 16px"><b style="font-size:16px;color:#161b22;width:56px">${o[0]}</b><span style="flex:1;font-size:14px;color:#646c78"><span style="${NUM}color:#161b22;font-weight:600">${o[1]}</span> → ${o[2]}</span>${svg('<path d="M9 6l6 6-6 6"/>', 16, '#b4bac3')}</div>`).join('')}</div>
      <div style="margin-top:14px;text-align:center;font-size:15px;font-weight:600;color:#646c78">${DATE.no}</div></div>`),
  },
  // B. 가운데 카드: 떠 있는 흰 카드, 동그란 아이콘, 가운데 정렬, 버튼은 세로로
  B: {
    kill: dim(`<div style="margin:0 34px;background:#fff;border-radius:26px;padding:26px 20px 14px;text-align:center;box-shadow:${sh2(.06, .26)}">
      <div style="width:54px;height:54px;margin:0 auto;border-radius:999px;background:#f8e4df;display:flex;align-items:center;justify-content:center">${svg(REDO, 25, RED)}</div>
      <div style="margin-top:14px;font-size:17.5px;font-weight:700;color:#161b22;letter-spacing:-.01em">${KILL.t}</div>
      <div style="margin-top:6px;font-size:14px;color:#646c78">${KILL.b}</div>
      <div style="margin-top:20px;height:50px;border-radius:15px;background:${RED};display:flex;align-items:center;justify-content:center;font-size:15.5px;font-weight:600;color:#fff;box-shadow:inset 0 1px 0 rgba(255,255,255,.2)">${KILL.ok}</div>
      <div style="height:46px;display:flex;align-items:center;justify-content:center;font-size:15px;font-weight:600;color:#646c78">${KILL.no}</div></div>`, 'center'),
    date: dim(`<div style="margin:0 26px;background:#fff;border-radius:26px;padding:24px 18px 12px;text-align:center;box-shadow:${sh2(.06, .26)}">
      <div style="font-size:17.5px;font-weight:700;color:#161b22;letter-spacing:-.01em">${DATE.t}</div>
      <div style="margin-top:6px;font-size:13.5px;color:#646c78">상태창의 <span style="${NUM}font-weight:600;color:#161b22">03.11.</span> 은 언제예요?</div>
      <div style="margin-top:16px;display:flex;gap:10px">${[['3월 11일', '월.일'], ['11월 3일', '일.월']].map(([d, n]) => `<div style="flex:1;padding:16px 0 13px;border-radius:18px;background:#f6f7f9;box-shadow:inset 0 0 0 1px #eceef2"><b style="display:block;font-size:18px;color:#161b22">${d}</b><span style="display:block;margin-top:3px;font-size:12px;color:#8a919c">${n}</span></div>`).join('')}</div>
      <div style="margin-top:6px;height:44px;display:flex;align-items:center;justify-content:center;font-size:15px;font-weight:600;color:#646c78">${DATE.no}</div>
      <div style="margin-top:-6px;padding-bottom:4px;font-size:12px;color:#a0a6af">${DATE.b}</div></div>`, 'center'),
  },
  // C. 유리: 블러 없이 밝은 그라데이션 + 윗변 빛 + 진한 그림자, 버튼은 카드 안의 알약
  C: {
    kill: dim(`<div style="margin:0 12px 30px;border-radius:30px;padding:22px 18px 16px;background:linear-gradient(180deg,rgba(255,255,255,.97),rgba(244,246,250,.95));box-shadow:inset 0 1.5px 0 #fff,inset 0 0 0 1px rgba(255,255,255,.7),0 1px 2px rgba(22,27,34,.08),0 22px 50px rgba(10,16,28,.32)">
      <div style="text-align:center;font-size:17px;font-weight:700;color:#161b22">${KILL.t}</div><div style="margin-top:5px;text-align:center;font-size:13.5px;color:#6b7380">${KILL.b}</div>
      <div style="margin-top:18px;height:52px;border-radius:999px;background:linear-gradient(180deg,#d4614b,${RED});display:flex;align-items:center;justify-content:center;font-size:16px;font-weight:600;color:#fff;box-shadow:inset 0 1px 0 rgba(255,255,255,.28),0 8px 18px rgba(196,80,59,.3)">${KILL.ok}</div>
      <div style="margin-top:8px;height:52px;border-radius:999px;background:rgba(22,27,34,.05);display:flex;align-items:center;justify-content:center;font-size:16px;font-weight:600;color:#3d4550">${KILL.no}</div></div>`),
    date: dim(`<div style="margin:0 12px 30px;border-radius:30px;padding:22px 18px 16px;background:linear-gradient(180deg,rgba(255,255,255,.97),rgba(244,246,250,.95));box-shadow:inset 0 1.5px 0 #fff,inset 0 0 0 1px rgba(255,255,255,.7),0 1px 2px rgba(22,27,34,.08),0 22px 50px rgba(10,16,28,.32)">
      <div style="text-align:center;font-size:17px;font-weight:700;color:#161b22">${DATE.t}</div><div style="margin-top:5px;text-align:center;font-size:13.5px;color:#6b7380">${DATE.b}</div>
      ${[DATE.a, DATE.c].map((o, i) => `<div style="margin-top:${i ? 8 : 18}px;height:54px;border-radius:999px;background:#fff;box-shadow:0 1px 2px rgba(22,27,34,.06),0 6px 14px rgba(22,27,34,.07);display:flex;align-items:center;justify-content:center;gap:10px"><b style="font-size:16px;color:#2c4a80">${o[0]}</b><span style="font-size:13px;color:#8a919c"><span style="${NUM}">${o[1]}</span> = ${o[2]}</span></div>`).join('')}
      <div style="margin-top:8px;height:46px;display:flex;align-items:center;justify-content:center;font-size:15px;font-weight:600;color:#6b7380">${DATE.no}</div></div>`),
  },
  // D. 진한 머리: 위는 색 면(지우기는 붉은 갈색, 나머지는 은행 남색)에 흰 글자, 아래 흰 바탕에 버튼
  D: {
    kill: dim(`<div style="margin:0 22px;border-radius:26px;overflow:hidden;background:#fff;box-shadow:${sh2(.06, .3)}">
      <div style="background:#7d2f22;padding:22px 20px 20px;color:#fff;box-shadow:inset 0 1px 0 rgba(255,255,255,.14)"><div style="width:40px;height:40px;border-radius:12px;background:rgba(255,255,255,.14);display:flex;align-items:center;justify-content:center">${svg(REDO, 21, '#fff')}</div>
      <div style="margin-top:12px;font-size:18px;font-weight:700;letter-spacing:-.01em">${KILL.t}</div><div style="margin-top:4px;font-size:13.5px;color:rgba(255,255,255,.72)">${KILL.b}</div></div>
      <div style="display:flex;gap:10px;padding:16px"><div style="flex:1;height:48px;border-radius:14px;background:#eef0f3;display:flex;align-items:center;justify-content:center;font-size:15px;font-weight:600;color:#3d4550">${KILL.no}</div>
      <div style="flex:1.3;height:48px;border-radius:14px;background:${RED};display:flex;align-items:center;justify-content:center;font-size:15px;font-weight:600;color:#fff;box-shadow:inset 0 1px 0 rgba(255,255,255,.2)">${KILL.ok}</div></div></div>`, 'center'),
    date: dim(`<div style="margin:0 22px;border-radius:26px;overflow:hidden;background:#fff;box-shadow:${sh2(.06, .3)}">
      <div style="background:${NAVY};padding:22px 20px 20px;color:#fff;box-shadow:inset 0 1px 0 rgba(255,255,255,.14)"><div style="font-size:12.5px;color:rgba(255,255,255,.7)">상태창</div>
      <div style="margin-top:6px;${NUM}font-size:30px;font-weight:600;letter-spacing:-.02em">Di, 03.11. 18:10</div><div style="margin-top:8px;font-size:14px;color:rgba(255,255,255,.8)">이 날짜는 언제예요?</div></div>
      <div style="padding:14px 16px 6px;display:flex;gap:10px">${[['3월 11일', '월.일'], ['11월 3일', '일.월']].map(([d, n]) => `<div style="flex:1;padding:14px 0 12px;border-radius:16px;background:#f4f5f8;text-align:center"><b style="display:block;font-size:17px;color:#161b22">${d}</b><span style="display:block;margin-top:2px;font-size:12px;color:#8a919c">${n}</span></div>`).join('')}</div>
      <div style="height:44px;display:flex;align-items:center;justify-content:center;font-size:14.5px;font-weight:600;color:#646c78">${DATE.no} · 설정에서 바꿀 수 있어요</div></div>`, 'center'),
  },
};
const L = { A: 'A. 흰 바텀 시트', B: 'B. 가운데 카드', C: 'C. 유리 (블러 없이)', D: 'D. 진한 머리' };
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
