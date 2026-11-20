// 실시간 폰 › 시작한 이야기(요약본) 보기: 여는 자리 시안 A~C와 보기 화면. 실제 실시간 폰(요약본으로 시작)에 끼워 찍어요.
// node docs/mockups/phone2-snap/mockB.cjs → sheetB.jpg (B 자리 모양 네 가지)
const { open } = require('../../../tools/dev/probe.cjs');
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path'), os = require('os');
const CHAT = path.join(os.homedir(), 'sillytavern/data/default-user/chats/default_Seraphina/na_test.jsonl');
const reset = () => fs.copyFileSync(path.join(__dirname, '../../../tools/dev/na_test.jsonl'), CHAT);
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'snapmock'));
const B = '/scripts/extensions/third-party/NarrativeArchive/src/';
const chev = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#bfc2c7" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6"/></svg>';
const CSS = `
.mk_hl{position:relative}.mk_hl::after{content:'';position:absolute;inset:-4px -6px;border-radius:12px;box-shadow:0 0 0 2px #2f6bff55;pointer-events:none}
.mk_link{color:#2f6bff;font-weight:600}
.mk_secr{display:flex;justify-content:space-between;align-items:baseline}.mk_secr span{color:#2f6bff;font-weight:600;font-size:13px}
.mk_v .ax_scroll{padding-bottom:30px}
.mk_meta{margin:-2px 22px 12px;font-size:12.5px;color:#8a8f99}
.mk_state{padding:12px 16px;font-size:14px;line-height:1.5;color:#161b22}
.mk_state b{display:block;font-size:12px;color:#8a8f99;font-weight:600;margin:8px 0 2px}.mk_state b:first-child{margin-top:0}
.mk_sc{padding:12px 16px;position:relative}.mk_sc+.mk_sc::before{content:'';position:absolute;left:16px;right:0;top:0;height:1px;background:#eef0f3}
.mk_sc small{display:block;font-size:11.5px;color:#8a8f99;font-weight:600;margin-bottom:3px}.mk_sc b{display:block;font-size:14.5px;color:#161b22;margin-bottom:3px}
.mk_sc p{margin:0;font-size:13.5px;line-height:1.45;color:#3a3f47;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}
.mk_rc{padding:10px 16px;font-size:13px;line-height:1.45;color:#3a3f47;position:relative}.mk_rc+.mk_rc::before{content:'';position:absolute;left:16px;right:0;top:0;height:1px;background:#eef0f3}
.mk_rc em{font-style:normal;color:#8a8f99;font-size:11.5px;font-weight:600;margin-right:6px}
`;
(async () => {
  const s = await open('light', { out: TMP });
  try {
    // (요약본으로 시작: 아카이브를 마지막 메시지까지 맞춰서 요청 없이)
    await s.run(async ({ m }) => { const n = SillyTavern.getContext().chat.length - 1; const t = String(m.text), cut = t.search(/\n# STATE/), add = `\n## #26–#${n} — Am Fluss (Oct 25, night, Varo)\n- Mara und Ren redeten leise am Fluss; Ren versprach, morgen zurückzukommen.\n`; m.text = cut >= 0 ? t.slice(0, cut).replace(/\s*$/, '') + '\n' + add + t.slice(cut) : t.replace(/\s*$/, '') + '\n' + add; m.boundary = n; });
    await s.to('set'); await s.p.click('.na_ph_pmode[data-v=live]'); await s.p.waitForTimeout(600); await s.p.click('.na_ob_start'); await s.p.waitForTimeout(2000);
    // 지난 반영 카드가 보이게 (반영 한 번 한 것처럼)
    await s.run(async ({ m }) => { m.live.world.phones.mara.syncLast = { checked: 3, remaining: 0, apps: ['메모'], notes: [], failed: [], changes: [] }; });
    const snap = await s.p.evaluate(async B => { const core = await import(B + 'core.js'), sn = await import(B + 'phone2snap.js'); const d = core.phoneMeta(); const x = d.phoneSnap; const parts = sn.snapParts(x); return { body: parts.body, state: parts.state, recent: x.recent, made: x.made }; }, B);
    await s.p.evaluate(css => { const st = document.createElement('style'); st.textContent = css; document.head.append(st); }, CSS);
    const shots = {};
    const setShot = async (name, fn, arg) => { await s.to('set'); await s.p.waitForTimeout(400); await s.p.evaluate(fn, arg); await s.p.waitForTimeout(250); shots[name] = await s.shot('snapB_' + name); };
    const head = () => [...document.querySelectorAll('.na_ph_frame .ax_sec')].find(x => x.textContent.trim() === '지난 반영');
    // B1: 말투 화면의 "전체"와 같은 파란 작은 글자
    await setShot('B1', () => { const h = [...document.querySelectorAll('.na_ph_frame .ax_sec')].find(x => x.textContent.trim() === '지난 반영'); h.classList.add('ax_kvsec'); h.insertAdjacentHTML('beforeend', '<span class="ax_blue ax_kvall">시작한 이야기</span>'); h.scrollIntoView({ block: 'center' }); });
    // B2: 회색 글자 + 꺾쇠
    await setShot('B2', chev => { const h = [...document.querySelectorAll('.na_ph_frame .ax_sec')].find(x => x.textContent.trim() === '지난 반영'); h.classList.add('ax_kvsec'); h.insertAdjacentHTML('beforeend', `<span class="ax_kvall" style="color:#8a8f99;display:inline-flex;align-items:center;gap:1px">시작한 이야기${chev.replace('width="16" height="16"', 'width="13" height="13"')}</span>`); h.scrollIntoView({ block: 'center' }); }, chev);
    // B3: 카드 안 맨 아래 줄 (다시 반영 · 되돌리기와 같은 모양)
    await setShot('B3', chev => { const h = [...document.querySelectorAll('.na_ph_frame .ax_sec')].find(x => x.textContent.trim() === '지난 반영'); const card = h.nextElementSibling; card.insertAdjacentHTML('beforeend', `<div class="ax_rw ax_rwn"><span class="ax_tx"><span class="ax_n ax_blue">시작한 이야기</span></span>${chev}</div>`); h.scrollIntoView({ block: 'center' }); }, chev);
    // B4: 반영 전에도 보이게 — 제목은 "실시간", 카드 첫 줄이 시작한 이야기, 반영 기록은 그 아래
    await setShot('B4', chev => { const h = [...document.querySelectorAll('.na_ph_frame .ax_sec')].find(x => x.textContent.trim() === '지난 반영'); h.textContent = '실시간'; const card = h.nextElementSibling; card.insertAdjacentHTML('afterbegin', `<div class="ax_rw"><span class="ax_tx"><span class="ax_n">시작한 이야기</span><span class="ax_p">25.10. 밤까지 · 장면 3개</span></span>${chev}</div>`); h.scrollIntoView({ block: 'center' }); }, chev);
    const names = { B1: 'B1. 파란 작은 글자', B2: 'B2. 회색 글자 + 꺾쇠', B3: 'B3. 카드 맨 아래 줄', B4: 'B4. 카드 첫 줄 (반영 전에도)' };
    const b = await chromium.launch(), p = await b.newPage({ deviceScaleFactor: 1 });
    // (설정의 위쪽은 같아서 지난 반영 둘레만 잘라 보여요)
    const crops = {};
    for (const k of Object.keys(names)) { const pg = await b.newPage({ deviceScaleFactor: 1 }); await pg.setContent(`<img id=i src="data:image/png;base64,${fs.readFileSync(shots[k]).toString('base64')}">`); crops[k] = shots[k]; await pg.close(); }
    await p.setContent(`<html><body style="margin:0;padding:24px;background:#d9dbe0;font-family:-apple-system,'Noto Sans KR',sans-serif;width:max-content"><div style="display:flex;gap:20px">${Object.keys(names).map(k => `<div><h2 style="font-size:18px;margin:0 0 10px">${names[k]}</h2><img style="width:330px;display:block;border-radius:22px" src="data:image/png;base64,${fs.readFileSync(crops[k]).toString('base64')}"></div>`).join('')}</div></body></html>`);
    await p.screenshot({ path: path.join(__dirname, 'sheetB.jpg'), fullPage: true, type: 'jpeg', quality: 86 }); await b.close();
    console.log('ok', s.errors().slice(0, 3));
  } finally { await s.close(); reset(); }
})().catch(e => { console.error(e); reset(); process.exit(1); });
