// 실시간 폰 › 시작한 이야기(요약본) 보기: 여는 자리 시안 A~C와 보기 화면. 실제 실시간 폰(요약본으로 시작)에 끼워 찍어요.
// node docs/mockups/phone2-snap/mock.cjs → sheet.jpg
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
    const setShot = async (name, fn) => { await s.to('set'); await s.p.waitForTimeout(400); await s.p.evaluate(fn); await s.p.waitForTimeout(250); shots[name] = await s.shot('snap_' + name); };
    // A: 휴대폰 카드 밑 설명 줄 끝에 낱말 하나
    await setShot('A', () => { const f = [...document.querySelectorAll('.na_ph_frame .ax_foot')].find(x => x.textContent.includes('지금 내 시각으로')); f.insertAdjacentHTML('beforeend', ' · <span class="mk_link mk_hl">시작한 이야기</span>'); f.scrollIntoView({ block: 'center' }); });
    // B: 지난 반영 머리 오른쪽
    await setShot('B', () => { const h = [...document.querySelectorAll('.na_ph_frame .ax_sec')].find(x => x.textContent.trim() === '지난 반영'); h.classList.add('mk_secr'); h.insertAdjacentHTML('beforeend', '<span class="mk_hl">시작한 이야기</span>'); h.scrollIntoView({ block: 'center' }); });
    // C: 이 폰에 대해 화면 맨 아래 (설정 첫 화면엔 줄이 안 늘어요)
    await s.to('setprofile'); await s.p.waitForTimeout(600);
    await s.p.evaluate(chev => { const sc = document.querySelector('.na_ph_frame .ax_scroll'); const pad = sc.querySelector(':scope > .ax_pad'); const html = `<div class="ax_sec">실시간</div><div class="ax_card"><div class="ax_rw mk_hl"><span class="ax_tx"><span class="ax_n">시작한 이야기</span></span><span class="ax_v">25.10. 밤</span>${chev}</div></div>`; (pad || sc.lastElementChild).insertAdjacentHTML('beforebegin', html); sc.scrollTop = 1e6; }, chev);
    await s.p.waitForTimeout(250); shots.C = await s.shot('snap_C');
    // 보기 화면: 지금 상태 · 장면들(최근 먼저) · 시작 직전
    await s.to('set'); await s.p.waitForTimeout(300);
    await s.p.evaluate(({ snap }) => {
      const esc = t => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;');
      const scenes = snap.body.split(/\n(?=## )/).filter(x => x.startsWith('## ')).map(x => { const [h, ...rest] = x.split('\n'); const m = /^##\s*#(\d+)[–-]#(\d+)\s*—\s*(.*?)(?:\s*\((.*)\))?$/.exec(h) || []; return { from: Number(m[1]) || 0, title: m[3] || h.replace(/^##\s*/, ''), when: m[4] || '', text: rest.join(' ').replace(/\b[A-Z]{3,}:\s*/g, '').replace(/(^|\s)-\s+/g, ' ').trim() }; }).sort((a, b) => b.from - a.from);
      // 지금 상태: "## 이름" 아래 줄을 한 사람씩
      const people = []; let cur = null; for (const l of snap.state.split('\n')) { const t = l.trim(); if (!t || /^#\s*(STATE|OPEN)/i.test(t)) { if (/OPEN/i.test(t)) { cur = { name: '남은 일', lines: [] }; people.push(cur); } continue; } const h = /^##\s*(.+)$/.exec(t); if (h) { cur = { name: h[1], lines: [] }; people.push(cur); } else if (cur) cur.lines.push(t.replace(/^-\s*/, '')); }
      const state = people.slice(0, 4).map(x => `<b>${esc(x.name)}</b>${esc(x.lines.join(' '))}`).join('');
      const recent = snap.recent.flatMap(r => r.split(/\n(?=\[#\d+)/)).filter(Boolean).slice(-3).map(r => { const m = /^\[#(\d+)[^\]]*\]\s*([^:]+):\s*([\s\S]*)$/.exec(r.trim()) || []; return `<div class="mk_rc"><em>${esc(m[2] || '')}</em>${esc((m[3] || r).replace(/\s+/g, ' ').slice(0, 120))}</div>`; }).join('');
      const sc = document.querySelector('.na_ph_frame .ax_scroll');
      document.querySelector('.na_ph_frame .na_ph_scr').classList.add('mk_v');
      sc.innerHTML = `<div class="ax_h1"><b>시작한 이야기</b><span>장면 ${scenes.length}개</span></div>
        ${state ? `<div class="ax_card"><div class="mk_state">${state}</div></div>` : ''}
        <div class="ax_sec">장면</div><div class="ax_card">${scenes.slice(0, 3).map(x => `<div class="mk_sc"><small>${esc(x.when)}</small><b>${esc(x.title)}</b><p>${esc(x.text)}</p></div>`).join('')}</div>
        <div class="ax_sec">시작 직전</div><div class="ax_card">${recent}</div><i class="ax_pad"></i>`;
      sc.scrollTop = 0;
    }, { snap });
    await s.p.waitForTimeout(300); shots.V = await s.shot('snap_V');
    const names = { A: 'A. 휴대폰 설명 줄 끝 낱말', B: 'B. 지난 반영 머리 오른쪽', C: 'C. 이 폰에 대해 맨 아래 줄', V: '보기 화면 (A·B·C 모두 여기로)' };
    const b = await chromium.launch(), p = await b.newPage({ deviceScaleFactor: 1 });
    await p.setContent(`<html><body style="margin:0;padding:24px;background:#d9dbe0;font-family:-apple-system,'Noto Sans KR',sans-serif;width:max-content"><div style="display:flex;gap:20px">${Object.keys(names).map(k => `<div><h2 style="font-size:18px;margin:0 0 10px">${names[k]}</h2><img style="width:330px;display:block;border-radius:22px" src="data:image/png;base64,${fs.readFileSync(shots[k]).toString('base64')}"></div>`).join('')}</div></body></html>`);
    await p.screenshot({ path: path.join(__dirname, 'sheet.jpg'), fullPage: true, type: 'jpeg', quality: 86 }); await b.close();
    console.log('ok', s.errors().slice(0, 3));
  } finally { await s.close(); reset(); }
})().catch(e => { console.error(e); reset(); process.exit(1); });
