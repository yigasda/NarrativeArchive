const { open } = require('/home/user/NarrativeArchive/tools/dev/probe.cjs');
const OUT = process.argv[2];
const BOOK = 'M5 4.5A1.5 1.5 0 0 1 6.5 3H19v15H6.5A1.5 1.5 0 0 0 5 19.5zM5 19.5A1.5 1.5 0 0 0 6.5 21H19v-3M9 7h6', CMT = 'M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.4A8 8 0 1 1 21 12z';
const CSS = `
.mk_notch{position:absolute;left:50%;top:11px;transform:translateX(-50%);width:120px;height:34px;border-radius:17px;background:#000;z-index:50;display:flex;align-items:center;justify-content:flex-end;padding-right:12px;box-sizing:border-box}
.mk_notch i{width:6px;height:6px;border-radius:50%;background:#3ddc97}
.mk_card{margin:0 14px 6px;background:#fff;border-radius:22px;padding:6px;box-shadow:0 1px 2px rgba(22,27,34,.04),0 8px 24px rgba(22,27,34,.05)}
.mk_seg{display:flex;gap:4px;padding:4px;border-radius:17px;background:#eef0f3}
.mk_seg b{flex:1;display:flex;flex-direction:column;align-items:center;gap:4px;padding:10px 0 9px;border-radius:13px;color:#8a9099;font:600 14.5px -apple-system,'Noto Sans KR',sans-serif}
.mk_seg b.on{background:#fff;color:#3a3f47;box-shadow:0 1px 2px rgba(22,27,34,.08),0 4px 10px rgba(22,27,34,.06)}
.mk_seg b.on.lv{color:#2c4a80}
.mk_seg b.on.lv svg{stroke:#2c4a80}
.mk_seg b.off{opacity:.4}
.mk_seg b svg{stroke:currentColor}
.mk_none{margin:10px 8px 6px;font:500 12.5px -apple-system,'Noto Sans KR',sans-serif;color:#8a9099;display:flex;justify-content:space-between;align-items:center}
.mk_none u{text-decoration:none;padding:6px 11px;border-radius:999px;background:#e2e9f5;color:#2c4a80;font-weight:600;opacity:.45}
.mk_hide{display:none!important}
`;
const ic = d => `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="${d}"/></svg>`;
(async () => {
  const s = await open('light', { out: OUT });
  const card = (state, kind) => s.p.evaluate(([state, kind, CSS, b, c]) => {
    if (!document.getElementById('mk_css')) { const st = document.createElement('style'); st.id = 'mk_css'; st.textContent = CSS; document.head.append(st); }
    const scr = document.querySelector('.na_ph_frame .na_ph_scr'); scr.querySelectorAll('.mk_notch').forEach(e => e.remove());
    if (state === 'live') scr.insertAdjacentHTML('beforeend', '<span class="mk_notch"><i></i></span>');
    const me = document.querySelector('.na_ph_frame .ax_me')?.closest('.ax_card'); if (!me) return;
    const lab = ['동기화', '실시간'];
    const foot = state === 'live' ? '지금 내 시각으로 흘러가는 폰이에요. 메신저로 직접 연락해요.' : '이야기를 따라 반영되는 폰이에요.';
    me.insertAdjacentHTML('afterend', `<div class="ax_sec">휴대폰</div><div class="mk_card"><div class="mk_seg"><b class="${state === 'live' ? '' : 'on'}">${lab[0]}</b><b class="${state === 'live' ? 'on lv' : state === 'none' ? 'off' : ''}">${lab[1]}</b></div>${state === 'none' ? '<div class="mk_none">아직 실시간 폰이 없어요<u>시작하기</u></div>' : ''}</div>${foot ? `<div class="ax_foot">${foot}</div>` : ''}`);
    if (state === 'live') for (const sel of ['.na_ph_setupd', '[data-go=setsync]', '[data-go=setremake]', '.na_ph_storyreset', '.na_ph_setdel', '.na_ph_setinj']) document.querySelectorAll('.na_ph_frame ' + sel).forEach(e => e.classList.add('mk_hide'));
  }, [state, kind, CSS, ic(BOOK), ic(CMT)]);
  for (const kind of ['text']) for (const st of ['story', 'live', 'none']) { await s.to('set'); await s.p.waitForTimeout(400); await card(st, kind); await s.shot(`I_${kind}_${st}`); }
  await s.close();
})();
