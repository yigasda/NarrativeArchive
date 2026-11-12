// 말투 화면: 폰 주인("나") 줄이 아직 없을 때 "쓰는 언어" 한 줄을 어디 둘지 시안 A~C. 실제 폰 말투 화면에 끼워 찍어요.
// node mock.cjs → sheet.jpg
const { open } = require('../../../tools/dev/probe.cjs');
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path'), os = require('os');
const CHAT = path.join(os.homedir(), 'sillytavern/data/default-user/chats/default_Seraphina/na_test.jsonl');
const reset = () => fs.copyFileSync(path.join(__dirname, '../../../tools/dev/na_test.jsonl'), CHAT);
const TMP = fs.mkdtempSync('/tmp/claude-0/voicelangs');
const chev = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#bfc2c7" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6"/></svg>';
const globe = '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17M12 3.5c2.5 2.5 3.6 5.3 3.6 8.5s-1.1 6-3.6 8.5c-2.5-2.5-3.6-5.3-3.6-8.5s1.1-6 3.6-8.5z"/></svg>';
const V = {
  A: { name: '1a. 나 줄 · 말투 없음', sub: '말투 없음', who: 'Mara' },
  B: { name: '1b. 나 줄 · 쓰는 언어를 보조 줄로', sub: '한국어, English (Deutsch)', who: 'Mara' },
  C: { name: '1c. 나 줄 · 이름 옆에 나', sub: '말투 없음', who: 'Mara', me: true },
};
const CSS = `.mk_tag{display:inline-block;margin-left:6px;padding:1px 7px;border-radius:999px;background:#e2e9f5;color:#2c4a80;font-size:11px;font-weight:600;vertical-align:1px}.mk_dim{color:#a2a7af!important}.mk_me{width:36px;height:36px;border-radius:50%;display:inline-grid;place-items:center;flex:none;background:#c98f6a;color:#fff;font-weight:700;font-size:15px}.ax .mk_row{width:100%}`;
(async () => {
  const s = await open('light', { out: TMP });
  try {
    await s.run(async ({ ph }) => { ph.koVoice = [{ who: 'Ren', style: '장난스러운 반말', by: 'user', label: '장난 반말' }, { who: 'Ivo', style: '건조한 반말', by: 'model', label: '건조한 반말' }]; });
    const shots = {};
    for (const v of Object.keys(V)) {
      await s.to('setvoice');
      await s.p.evaluate(([CSS, x]) => {
        if (!document.getElementById('mk_css')) { const st = document.createElement('style'); st.id = 'mk_css'; st.textContent = CSS; document.head.append(st); }
        // (지금 화면의 진짜 줄(Ren)을 복사해서 폰 주인 줄로: 같은 얼굴 · 같은 글자)
        const sc = document.querySelector('.na_ph_frame .ax_scroll'), cards = sc.querySelectorAll(':scope > .ax_card'), ren = cards[1].firstElementChild, me = ren.cloneNode(true);
        me.querySelectorAll('.ax_n').forEach(e => { e.textContent = x.who; if (x.me) e.insertAdjacentHTML('beforeend', ' <span class="mk_tag">나</span>'); });
        const sub = me.querySelector('.ax_p, .ax_kvp'); if (sub) { sub.textContent = x.sub; sub.classList.add('mk_dim'); }
        const face = me.querySelector('.ax_avc'); if (face) { face.textContent = 'M'; face.style.background = '#c98f6a'; }
        cards[1].insertBefore(me, ren);
      }, [CSS, V[v]]);
      await s.p.waitForTimeout(250); shots[v] = await s.shot('voice_' + v);
    }
    const b = await chromium.launch(), p = await b.newPage({ deviceScaleFactor: 1 });
    await p.setContent(`<html><body style="margin:0;padding:24px;background:#d9dbe0;font-family:-apple-system,'Noto Sans KR',sans-serif;width:max-content"><div style="display:flex;gap:22px">${Object.keys(V).map(v => `<div><h2 style="font-size:20px;margin:0 0 10px">${V[v].name}</h2><img style="width:360px;display:block;border-radius:22px" src="data:image/png;base64,${fs.readFileSync(shots[v]).toString('base64')}"></div>`).join('')}</div></body></html>`);
    await p.screenshot({ path: path.join(__dirname, 'sheet.jpg'), fullPage: true, type: 'jpeg', quality: 86 }); await b.close();
    console.log('ok', s.errors().slice(0, 3));
  } finally { await s.close(); reset(); }
})().catch(e => { console.error(e); reset(); process.exit(1); });
