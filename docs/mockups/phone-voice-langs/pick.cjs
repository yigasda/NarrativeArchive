// 말투 맨 아래 "언어" 카드(자주 쓰는 언어 · 가끔 쓰는 언어)와, 눌렀을 때 고르는 화면 시안 A~C. 실제 폰 말투 화면에 끼워 찍어요.
// node pick.cjs → pick.jpg
const { open } = require('../../../tools/dev/probe.cjs');
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path'), os = require('os');
const CHAT = path.join(os.homedir(), 'sillytavern/data/default-user/chats/default_Seraphina/na_test.jsonl');
const reset = () => fs.copyFileSync(path.join(__dirname, '../../../tools/dev/na_test.jsonl'), CHAT);
const TMP = fs.mkdtempSync('/tmp/claude-0/voicepick');
const LANGS = ['한국어', 'English', 'Deutsch', '日本語', '中文', 'Français', 'Español', 'Italiano', 'Português', 'Русский', 'Nederlands', 'Polski', 'Türkçe', 'Tiếng Việt', 'ไทย', 'Bahasa Indonesia', 'العربية', 'हिन्दी'];
const chev = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#bfc2c7" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6"/></svg>';
const chk = c => `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12.5l4.5 4.5L20 6"/></svg>`;
const back = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#161b22" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg>';
const on = new Set(['Deutsch', 'English']);
const CARD = `<div class="ax_sec">언어</div><div class="ax_card mk_lang">
  <button type="button" class="ax_rw"><span class="ax_tx"><span class="ax_n">자주 쓰는 언어</span></span><span class="ax_v">Deutsch, English</span>${chev}</button>
  <button type="button" class="ax_rw"><span class="ax_tx"><span class="ax_n">가끔 쓰는 언어</span></span><span class="ax_v">한국어</span>${chev}</button></div>`;
const CSS = `
.mk_lang .ax_v{max-width:170px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.mk_shade{position:absolute;inset:0;background:rgba(20,22,30,.3);z-index:40}
/* A 바텀 시트 */
.mk_sheet{position:absolute;left:8px;right:8px;bottom:8px;height:560px;z-index:41;background:#f4f5f7;border-radius:30px;display:flex;flex-direction:column;box-shadow:0 -10px 30px rgba(20,22,30,.18);overflow:hidden}
.mk_sh{display:flex;align-items:center;justify-content:space-between;padding:16px 20px 10px}
.mk_sh b{font-size:17px;font-weight:600;color:#161b22}.mk_sh span{font-size:15px;font-weight:600;color:#2f6bff}
.mk_grab{width:40px;height:5px;border-radius:3px;background:#d4d7dd;margin:8px auto 0}
.mk_list{flex:1;overflow:hidden;margin:4px 14px 14px;background:#fff;border-radius:20px;box-shadow:0 1px 2px rgba(22,27,34,.04),0 8px 24px rgba(22,27,34,.05)}
.mk_it{display:flex;align-items:center;justify-content:space-between;padding:13px 16px;font-size:15.5px;color:#161b22;position:relative}
.mk_it+.mk_it::before{content:'';position:absolute;left:16px;right:0;top:0;height:1px;background:#eef0f3}
.mk_it.on{color:#2c4a80;font-weight:600}
/* B 화면 하나 */
.mk_page{position:absolute;inset:0;z-index:41;background:#f4f5f7;display:flex;flex-direction:column}
.mk_top{padding:58px 16px 0}.mk_cb{width:40px;height:40px;border-radius:50%;background:#fff;display:flex;align-items:center;justify-content:center;box-shadow:0 1px 2px rgba(22,27,34,.05),0 5px 14px rgba(22,27,34,.07)}
.mk_h1{font-size:30px;font-weight:700;margin:12px 20px 4px;color:#161b22}.mk_sub{font-size:12.5px;color:#8a8f99;margin:0 22px 12px}
.mk_page .mk_list{flex:1;margin:0 14px 30px}
/* C 바퀴(하나씩) */
.mk_wheel{position:absolute;left:8px;right:8px;bottom:8px;z-index:41;background:#f4f5f7;border-radius:30px;padding-bottom:22px;box-shadow:0 -10px 30px rgba(20,22,30,.18)}
.mk_wh{position:relative;height:232px;margin:4px 14px 0;overflow:hidden;-webkit-mask-image:linear-gradient(transparent,#000 30%,#000 70%,transparent);mask-image:linear-gradient(transparent,#000 30%,#000 70%,transparent)}
.mk_band{position:absolute;left:0;right:0;top:94px;height:44px;border-radius:13px;background:#fff;box-shadow:0 1px 2px rgba(22,27,34,.05),0 4px 12px rgba(22,27,34,.06)}
.mk_wi{position:relative;height:44px;line-height:44px;text-align:center;font-size:17px;color:#8a8f99}
.mk_wi.mid{color:#161b22;font-weight:600;font-size:19px}
.mk_two{display:flex;gap:8px;margin:0 14px}.mk_two .mk_wh{flex:1;margin:4px 0 0}
.mk_lab{display:flex;gap:8px;margin:2px 14px 0}.mk_lab span{flex:1;text-align:center;font-size:12.5px;color:#8a8f99;font-weight:600}

/* D 바퀴 + 칩 */
.mk_tabs{display:flex;gap:4px;margin:4px 14px 0;padding:4px;border-radius:15px;background:#e6e8ec}
.mk_tabs b{flex:1;text-align:center;padding:8px 0 7px;border-radius:11px;font-size:13.5px;font-weight:600;color:#8a8f99}
.mk_tabs b.on{background:#fff;color:#161b22;box-shadow:0 1px 2px rgba(22,27,34,.08),0 4px 10px rgba(22,27,34,.06)}
.mk_chips{display:flex;flex-wrap:wrap;gap:6px;margin:12px 16px 2px;min-height:32px}
.mk_chip{display:inline-flex;align-items:center;gap:6px;height:32px;padding:0 8px 0 12px;border-radius:16px;background:#fff;font-size:14px;font-weight:600;color:#2c4a80;box-shadow:0 1px 2px rgba(22,27,34,.06),0 3px 8px rgba(22,27,34,.06)}
.mk_chip i{width:18px;height:18px;border-radius:50%;background:#e2e9f5;display:flex;align-items:center;justify-content:center}
.mk_none{font-size:13px;color:#a2a7af;line-height:32px}
.mk_whrow{display:flex;align-items:center;gap:10px;margin:2px 14px 0}.mk_whrow .mk_wh{flex:1;margin:0}
.mk_add{height:44px;padding:0 16px;border-radius:13px;background:#15161a;color:#fff;font-size:14.5px;font-weight:600;display:flex;align-items:center;box-shadow:inset 0 1px 0 rgba(255,255,255,.16)}
.mk_add.dim{opacity:.35}
.mk_wi.had{color:#c4c8ce}
`;
const list = sel => `<div class="mk_list">${LANGS.slice(0, 11).map(l => `<div class="mk_it${sel.has(l) ? ' on' : ''}">${l}${sel.has(l) ? chk('#2c4a80') : ''}</div>`).join('')}</div>`;
const wheel = (arr, mid) => `<div class="mk_wh"><div class="mk_band"></div>${arr.map((l, i) => `<div class="mk_wi${i === mid ? ' mid' : ''}">${l}</div>`).join('')}</div>`;
const xs = '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#2c4a80" stroke-width="3.4" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>';
const chips = arr => `<div class="mk_chips">${arr.length ? arr.map(l => `<span class="mk_chip">${l}<i>${xs}</i></span>`).join('') : '<span class="mk_none">아직 없어요</span>'}</div>`;
const wheel2 = (arr, mid, had = []) => `<div class="mk_wh"><div class="mk_band"></div>${arr.map((l, i) => `<div class="mk_wi${i === mid ? ' mid' : ''}${had.includes(l) ? ' had' : ''}">${l}</div>`).join('')}</div>`;
const chipSheet = (tab, got, arr, mid, dim) => `<div class="mk_shade"></div><div class="mk_wheel"><i class="mk_grab"></i><div class="mk_sh"><b>언어</b><span>완료</span></div><div class="mk_tabs"><b class="${tab === 0 ? 'on' : ''}">자주 쓰는 언어</b><b class="${tab === 1 ? 'on' : ''}">가끔 쓰는 언어</b></div>${chips(got)}<div class="mk_whrow">${wheel2(arr, mid, got)}<span class="mk_add${dim ? ' dim' : ''}">추가</span></div></div>`;
const V = {
  D1: { name: 'D1. 자주 쓰는 언어: 두 개 고름', put: chipSheet(0, ['Deutsch', 'English'], ['中文', 'English', 'Français', 'Español', 'Italiano'], 2) },
  D2: { name: 'D2. 이미 고른 건 바퀴에서 흐리게', put: chipSheet(0, ['Deutsch', 'English'], ['한국어', 'English', 'Deutsch', '日本語', '中文'], 2, true) },
  D3: { name: 'D3. 가끔 쓰는 언어 탭', put: chipSheet(1, ['한국어'], ['English', '日本語', '中文', 'Français', 'Español'], 2) },
  card: { name: '닫은 뒤: 말투 맨 아래', put: '' },
};
(async () => {
  const s = await open('light', { out: TMP });
  try {
    await s.run(async ({ ph }) => { ph.koVoice = [{ who: 'Ren', style: '장난스러운 반말', by: 'user', label: '장난 반말' }, { who: 'Ivo', style: '건조한 반말', by: 'model', label: '건조한 반말' }]; });
    const shots = {};
    for (const v of Object.keys(V)) {
      await s.to('setvoice');
      await s.p.evaluate(([CSS, CARD, put]) => {
        if (!document.getElementById('mk_css')) { const st = document.createElement('style'); st.id = 'mk_css'; st.textContent = CSS; document.head.append(st); }
        const sc = document.querySelector('.na_ph_frame .ax_scroll'), foot = [...sc.querySelectorAll(':scope > .ax_foot')].pop();
        foot.insertAdjacentHTML('afterend', CARD);
        if (put) document.querySelector('.na_ph_frame .cg_canvas').insertAdjacentHTML('beforeend', put);
      }, [CSS, CARD, V[v].put]);
      await s.p.waitForTimeout(250); shots[v] = await s.shot('pick_' + v);
    }
    const b = await chromium.launch(), p = await b.newPage({ deviceScaleFactor: 1 });
    await p.setContent(`<html><body style="margin:0;padding:24px;background:#d9dbe0;font-family:-apple-system,'Noto Sans KR',sans-serif;width:max-content"><div style="display:flex;gap:20px">${Object.keys(V).map(v => `<div><h2 style="font-size:19px;margin:0 0 10px">${V[v].name}</h2><img style="width:330px;display:block;border-radius:22px" src="data:image/png;base64,${fs.readFileSync(shots[v]).toString('base64')}"></div>`).join('')}</div></body></html>`);
    await p.screenshot({ path: path.join(__dirname, 'pick2.jpg'), fullPage: true, type: 'jpeg', quality: 86 }); await b.close();
    console.log('ok', s.errors().slice(0, 3));
  } finally { await s.close(); reset(); }
})().catch(e => { console.error(e); reset(); process.exit(1); });
