// 폰도 인물도 없는 채팅의 첫 화면 다시 그리기 (P1~P4, 우리 앱 화면의 결: 밝은 바탕 · 흰 카드 · 파스텔 타일 · 검정 알약. 보라 그라데이션 없음): 인물 이름 적기 + 메신저 채팅 가져오기. 실제 폰 틀 안에 끼워 찍어요.
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
const BG = '#f4f5f7', INK = '#161b22', GR = '#8a8f99';
const tile = (d, bg, c, w = 38, r = 12, i = 19) => `<span style="width:${w}px;height:${w}px;border-radius:${r}px;background:${bg};display:flex;align-items:center;justify-content:center;flex:none">${svg(d, c, i)}</span>`;
const card = (inner, m = '14px 16px 0') => `<div style="margin:${m};background:#fff;border-radius:22px;box-shadow:${SH};padding:2px 16px">${inner}</div>`;
const sec = t => `<div style="margin:22px 22px 0;font-size:13px;font-weight:600;color:${GR}">${t}</div>`;
const go = `<span style="width:34px;height:34px;border-radius:50%;background:#15161a;display:flex;align-items:center;justify-content:center;box-shadow:inset 0 1px 0 rgba(255,255,255,.18);flex:none">${svg(ARR, '#fff', 16, 2.4)}</span>`;
const impRow = `<div style="display:flex;align-items:center;gap:12px;padding:12px 0">${tile(CHATIC, '#e4f0e6', '#3d7a4a')}<span style="flex:1"><b style="display:block;font-size:15px;font-weight:600">메신저 채팅 가져오기</b><span style="font-size:12.500px;color:${GR}">메시지 12개</span></span>${svg(CHEV, '#bfc2c7', 16, 2.2)}</div>`;
const V = {
  // P1: 설정 화면처럼. 큰 제목, 작은 회색 제목 → 흰 카드 둘
  P1: `<div style="position:absolute;inset:0;background:${BG};color:${INK}">${SB(INK)}
    <div style="padding:26px 22px 0;font-size:28px;font-weight:700;letter-spacing:-.01em">휴대폰</div>
    ${sec('인물')}${card(`<div style="display:flex;align-items:center;gap:12px;padding:12px 0">${tile(USER, '#e2e9f5', '#2c4a80')}<span style="flex:1;font-size:15px;color:#a6abb3">이름</span>${go}</div>`, '8px 16px 0')}
    ${sec('메신저')}${card(impRow, '8px 16px 0')}${IND('#15161a')}</div>`,
  // P2: 연락처 새로 만들기처럼. 가운데 큰 회색 얼굴, 이름 칸 카드, 검정 알약, 아래 가져오기 줄
  P2: `<div style="position:absolute;inset:0;background:${BG};color:${INK}">${SB(INK)}
    <div style="display:flex;flex-direction:column;align-items:center;margin-top:64px"><span style="width:104px;height:104px;border-radius:50%;background:#e3e6eb;display:flex;align-items:center;justify-content:center;box-shadow:inset 0 1px 0 rgba(255,255,255,.7),0 8px 22px rgba(22,27,34,.08)">${svg(USER, '#9aa0aa', 48, 1.7)}</span><div style="font-size:22px;font-weight:700;margin-top:18px;letter-spacing:-.01em">누구의 폰인가요</div></div>
    ${card(`<div style="padding:15px 0;font-size:16px;color:#a6abb3">이름</div>`, '26px 16px 0')}
    <div style="margin:14px 16px 0;padding:15px 0;border-radius:999px;background:#15161a;color:#fff;text-align:center;font-size:15px;font-weight:600;box-shadow:inset 0 1px 0 rgba(255,255,255,.16),0 10px 24px rgba(22,27,34,.2)">폰 보기</div>
    <div style="position:absolute;left:0;right:0;bottom:42px">${card(impRow, '0 16px')}</div>${IND('#15161a')}</div>`,
  // P3: Orbit 새 대화처럼. 둥근 뒤로 없이 가운데 제목, 흰 목록, 아래 검정 알약
  P3: `<div style="position:absolute;inset:0;background:${BG};color:${INK}">${SB(INK)}
    <div style="text-align:center;padding:22px 0 0;font-size:18px;font-weight:600">새 휴대폰</div>
    ${card(`<div style="display:flex;align-items:center;gap:12px;padding:12px 0">${tile(USER, '#e2e9f5', '#2c4a80', 46, 50, 21)}<span style="flex:1"><span style="display:block;font-size:12px;color:${GR}">폰 주인</span><span style="font-size:16px;color:#a6abb3">이름</span></span></div><div style="height:1px;background:#eef0f3;margin-left:58px"></div><div style="display:flex;align-items:center;gap:12px;padding:12px 0">${tile(CHATIC, '#e4f0e6', '#3d7a4a', 46, 50, 21)}<span style="flex:1"><b style="display:block;font-size:15px;font-weight:600">메신저 채팅 가져오기</b><span style="font-size:12.500px;color:${GR}">메시지 12개</span></span>${svg(CHEV, '#bfc2c7', 16, 2.2)}</div>`, '22px 16px 0')}
    <div style="position:absolute;left:50%;bottom:34px;transform:translateX(-50%);padding:14px 30px;border-radius:999px;background:#15161a;color:#fff;font-size:14.500px;font-weight:600;opacity:.35;white-space:nowrap">폰 보기</div>${IND('#15161a')}</div>`,
  // P4: 가운데 한 덩어리. 파스텔 아이콘 타일 · 제목 · 흰 입력 알약(검정 화살표) · 그 아래 흰 줄
  P4: `<div style="position:absolute;inset:0;background:${BG};color:${INK}">${SB(INK)}
    <div style="position:absolute;left:0;right:0;top:50%;transform:translateY(-58%)"><div style="display:flex;flex-direction:column;align-items:center">${tile(USER, '#e2e9f5', '#2c4a80', 62, 18, 28)}<div style="font-size:21px;font-weight:700;margin-top:16px;letter-spacing:-.01em">누구의 폰인가요</div></div>
      <div style="margin:22px 16px 0;background:#fff;border-radius:999px;box-shadow:${SH};padding:7px 7px 7px 20px;display:flex;align-items:center"><span style="flex:1;font-size:15.500px;color:#a6abb3">이름</span><span style="width:40px;height:40px;border-radius:50%;background:#15161a;display:flex;align-items:center;justify-content:center;box-shadow:inset 0 1px 0 rgba(255,255,255,.18)">${svg(ARR, '#fff', 17, 2.4)}</span></div>
      ${card(impRow, '12px 16px 0')}</div>${IND('#15161a')}</div>`,
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
    const names = { now: '지금', P1: 'P1. 설정 화면처럼', P2: 'P2. 새 연락처처럼', P3: 'P3. Orbit 새 대화처럼', P4: 'P4. 가운데 한 덩어리' };
    const b = await chromium.launch(), pg = await b.newPage({ deviceScaleFactor: 1 });
    await pg.setContent(`<html><body style="margin:0;padding:24px;background:#d9dbe0;font-family:-apple-system,'Noto Sans KR',sans-serif;width:max-content"><div style="display:flex;gap:18px">${Object.keys(names).map(k => `<div><h2 style="font-size:16px;margin:0 0 10px">${names[k]}</h2><img style="width:300px;display:block;border-radius:22px" src="data:image/png;base64,${fs.readFileSync(shots[k]).toString('base64')}"></div>`).join('')}</div></body></html>`);
    await pg.screenshot({ path: path.join(__dirname, 'sheetE.jpg'), fullPage: true, type: 'jpeg', quality: 88 }); await b.close();
    console.log('ok', s.errors().slice(0, 3));
  } finally { await s.close(); reset(); }
})().catch(e => { console.error(e); reset(); process.exit(1); });
