// 폰도 인물도 없는 채팅의 첫 화면 다시 그리기 (R1~R4): 인물 이름 적기 + 메신저 채팅 가져오기. 실제 폰 틀 안에 끼워 찍어요.
// node docs/mockups/phone2-import/mockE.cjs → sheetE.jpg
const { open } = require('../../../tools/dev/probe.cjs');
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path'), os = require('os');
const CHAT = path.join(os.homedir(), 'sillytavern/data/default-user/chats/default_Seraphina/na_test.jsonl');
const reset = () => fs.copyFileSync(path.join(__dirname, '../../../tools/dev/na_test.jsonl'), CHAT);
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'impmockE'));
const B = '/scripts/extensions/third-party/NarrativeArchive/src/';
const svg = (d, c, w = 20, sw = 2) => `<svg width="${w}" height="${w}" viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round"><path d="${d}"/></svg>`;
const USER = 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4.5 20a7.500 7.500 0 0 1 15 0', CHATIC = 'M5 5h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-7l-5 4v-4H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z', CHEV = 'M9 6l6 6-6 6', ARR = 'M5 12h13M13 6l6 6-6 6';
const DUSK = 'radial-gradient(120% 80% at 20% 10%,#6a7bd8 0,transparent 55%),radial-gradient(90% 70% at 90% 90%,#d77aa8 0,transparent 60%),linear-gradient(160deg,#2b2f63,#5b3a6e 60%,#7a4565)';
const SB = c => `<div style="display:flex;justify-content:space-between;align-items:center;padding:16px 30px 0;font:600 15px 'Inter Tight',sans-serif;color:${c}"><span>9:41</span><span style="display:flex;gap:6px;align-items:center"><i style="width:17px;height:11px;border-radius:2px;background:${c};opacity:.9;display:block"></i><i style="width:24px;height:12px;border-radius:4px;border:1.500px solid ${c};display:block;box-sizing:border-box"></i></span></div>`;
const IND = c => `<i style="position:absolute;left:50%;bottom:9px;width:134px;height:5px;border-radius:3px;background:${c};transform:translateX(-50%)"></i>`;
const SH = '0 1px 2px rgba(22,27,34,.05),0 8px 22px rgba(22,27,34,.07)';
const V = {
  // R1: 실시간 시작 화면과 같은 밝은 앱 화면. 노을 카드 + 흰 목록 두 줄 + 검정 알약
  R1: `<div style="position:absolute;inset:0;background:#f4f5f7;color:#161b22">${SB('#161b22')}
    <div style="padding:26px 22px 0;font-size:26px;font-weight:700;letter-spacing:-.01em">휴대폰</div>
    <div style="margin:16px 16px 0;height:150px;border-radius:26px;background:${DUSK};position:relative;overflow:hidden;box-shadow:0 10px 26px rgba(60,50,110,.22)"><div style="position:absolute;left:20px;bottom:18px;color:#fff"><div style="font-size:12.500px;opacity:.85">이 채팅</div><div style="font-size:22px;font-weight:600;margin-top:2px">아직 폰이 없어요</div></div></div>
    <div style="margin:16px 16px 0;background:#fff;border-radius:22px;box-shadow:${SH};padding:4px 16px">
      <div style="display:flex;align-items:center;gap:12px;padding:13px 0"><span style="width:38px;height:38px;border-radius:12px;background:#e2e9f5;display:flex;align-items:center;justify-content:center;flex:none">${svg(USER, '#2c4a80', 19)}</span><span style="flex:1;font-size:15px;color:#a6abb3">인물 이름</span><span style="width:34px;height:34px;border-radius:50%;background:#15161a;display:flex;align-items:center;justify-content:center;box-shadow:inset 0 1px 0 rgba(255,255,255,.18)">${svg(ARR, '#fff', 16, 2.4)}</span></div>
      <div style="height:1px;background:#eef0f3;margin-left:50px"></div>
      <div style="display:flex;align-items:center;gap:12px;padding:13px 0"><span style="width:38px;height:38px;border-radius:12px;background:#e4f0e6;display:flex;align-items:center;justify-content:center;flex:none">${svg(CHATIC, '#3d7a4a', 19)}</span><span style="flex:1"><b style="display:block;font-size:15px;font-weight:600">메신저 채팅 가져오기</b><span style="font-size:12.500px;color:#8a8f99">메시지 12개</span></span>${svg(CHEV, '#bfc2c7', 16, 2.2)}</div>
    </div>${IND('#15161a')}</div>`,
  // R2: 잠금 화면처럼. 노을 배경에 큰 시계, 아래 유리 시트
  R2: `<div style="position:absolute;inset:0;background:${DUSK};color:#fff">${SB('#fff')}
    <div style="text-align:center;margin-top:74px"><div style="font-size:15px;opacity:.85">10월 26일 월요일</div><div style="font:600 92px/1 'Inter Tight',sans-serif;letter-spacing:-.03em;margin-top:6px">9:41</div></div>
    <div style="position:absolute;left:12px;right:12px;bottom:26px;border-radius:30px;background:rgba(255,255,255,.16);backdrop-filter:blur(22px);-webkit-backdrop-filter:blur(22px);box-shadow:inset 0 1px 0 rgba(255,255,255,.28),0 14px 34px rgba(20,16,50,.28);padding:18px 16px 16px">
      <div style="font-size:13px;opacity:.8;padding:0 4px 10px">누구의 폰인가요</div>
      <div style="display:flex;align-items:center;gap:10px;background:rgba(255,255,255,.92);border-radius:18px;padding:6px 6px 6px 16px"><span style="flex:1;font-size:15.500px;color:#a6abb3">인물 이름</span><span style="width:40px;height:40px;border-radius:14px;background:#15161a;display:flex;align-items:center;justify-content:center">${svg(ARR, '#fff', 17, 2.4)}</span></div>
      <div style="display:flex;align-items:center;gap:10px;margin-top:10px;padding:13px 14px;border-radius:18px;background:rgba(255,255,255,.14)">${svg(CHATIC, '#fff', 18)}<span style="flex:1;font-size:14.500px;font-weight:600">메신저 채팅 가져오기</span>${svg(CHEV, 'rgba(255,255,255,.7)', 15, 2.2)}</div>
    </div></div>`,
  // R3: 새 폰 처음 켤 때처럼. 흰 화면에 큰 제목, 밑줄 입력, 검정 알약, 아래 글자
  R3: `<div style="position:absolute;inset:0;background:#fbfbfc;color:#15161a">${SB('#15161a')}
    <div style="padding:120px 30px 0"><div style="width:56px;height:56px;border-radius:18px;background:${DUSK};box-shadow:0 8px 20px rgba(60,50,110,.25)"></div>
      <div style="font-size:31px;font-weight:700;letter-spacing:-.02em;line-height:1.25;margin-top:26px">누구의<br>폰인가요</div>
      <div style="margin-top:34px;border-bottom:2px solid #15161a;padding:10px 2px;font-size:20px;color:#b3b7be">인물 이름</div></div>
    <div style="position:absolute;left:22px;right:22px;bottom:92px;padding:16px 0;border-radius:999px;background:#15161a;color:#fff;text-align:center;font-size:15.500px;font-weight:600;box-shadow:inset 0 1px 0 rgba(255,255,255,.16),0 10px 24px rgba(22,27,34,.2)">폰 보기</div>
    <div style="position:absolute;left:0;right:0;bottom:50px;text-align:center;font-size:14px;font-weight:600;color:#5b6170;display:flex;justify-content:center;align-items:center;gap:6px">${svg(CHATIC, '#5b6170', 15)}메신저 채팅 가져오기</div>${IND('#15161a')}</div>`,
  // R4: 노을 배경에 유리 타일 둘 (인물의 폰 · 메신저 가져오기)
  R4: `<div style="position:absolute;inset:0;background:${DUSK};color:#fff">${SB('#fff')}
    <div style="padding:150px 26px 0;font-size:28px;font-weight:700;letter-spacing:-.02em">어떻게 시작할까요</div>
    <div style="display:flex;gap:12px;margin:26px 18px 0">${[[USER, '인물의 폰', '이름 적기'], [CHATIC, '메신저 채팅', '가져오기 · 12개']].map(([i, t, s]) => `<div style="flex:1;height:170px;border-radius:26px;background:rgba(255,255,255,.16);backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);box-shadow:inset 0 1px 0 rgba(255,255,255,.28),0 12px 28px rgba(20,16,50,.24);padding:18px;box-sizing:border-box;display:flex;flex-direction:column;justify-content:space-between"><span style="width:46px;height:46px;border-radius:15px;background:rgba(255,255,255,.9);display:flex;align-items:center;justify-content:center">${svg(i, '#3a3463', 22)}</span><span><b style="display:block;font-size:17px;font-weight:600">${t}</b><span style="font-size:12.500px;opacity:.8">${s}</span></span></div>`).join('')}</div>${IND('#fff')}</div>`,
};
(async () => {
  const s = await open('light', { out: TMP }); const p = s.p;
  try {
    await p.evaluate(async B => { const core = await import(B + 'core.js'); const m = core.getMeta(); delete m.phones; delete m.live; m.text = ''; delete m.phonePre; delete m.phoneOwner; document.getElementById('na_phl')?.close(); }, B);
    await p.waitForTimeout(300); await p.evaluate(async B => { (await import(B + 'phone.js')).openPhone(); }, B); await p.waitForTimeout(1200);
    const shots = {};
    shots.now = await s.shot('e_now');
    for (const k of Object.keys(V)) {
      await p.evaluate(html => { const sc = document.querySelector('.na_ph_frame .na_ph_scr'); const w = sc.clientWidth, h = sc.clientHeight; sc.style.position = 'relative'; sc.style.overflow = 'hidden'; sc.innerHTML = `<div style="position:absolute;left:0;top:0;width:390px;height:${Math.round(h * 390 / w)}px;transform:scale(${w / 390});transform-origin:0 0;font-family:-apple-system,'Noto Sans KR',sans-serif;text-align:left">${html}</div>`; }, V[k]);
      await p.waitForTimeout(300); shots[k] = await s.shot('e_' + k);
    }
    const names = { now: '지금', R1: 'R1. 밝은 앱 화면 (실시간 화면과 같은 결)', R2: 'R2. 잠금 화면처럼', R3: 'R3. 새 폰 처음 켤 때처럼', R4: 'R4. 유리 타일 둘' };
    const b = await chromium.launch(), pg = await b.newPage({ deviceScaleFactor: 1 });
    await pg.setContent(`<html><body style="margin:0;padding:24px;background:#d9dbe0;font-family:-apple-system,'Noto Sans KR',sans-serif;width:max-content"><div style="display:flex;gap:18px">${Object.keys(names).map(k => `<div><h2 style="font-size:16px;margin:0 0 10px">${names[k]}</h2><img style="width:300px;display:block;border-radius:22px" src="data:image/png;base64,${fs.readFileSync(shots[k]).toString('base64')}"></div>`).join('')}</div></body></html>`);
    await pg.screenshot({ path: path.join(__dirname, 'sheetE.jpg'), fullPage: true, type: 'jpeg', quality: 88 }); await b.close();
    console.log('ok', s.errors().slice(0, 3));
  } finally { await s.close(); reset(); }
})().catch(e => { console.error(e); reset(); process.exit(1); });
