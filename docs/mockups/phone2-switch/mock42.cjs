// 4-2 mockup: the real phone, with the 폰 2 pieces drawn in on top (nothing in src changes)
const { open } = require('/home/user/NarrativeArchive/tools/dev/probe.cjs'); const fs = require('fs');
const OUT = process.argv[2];
const CSS = `
.mk_pill{position:absolute;left:22px;top:12px;height:26px;padding:0 10px;border-radius:13px;background:#1f8a7a;color:#fff;font:600 15px/26px -apple-system,'Inter Tight',sans-serif;z-index:50;box-shadow:inset 0 1px 0 rgba(255,255,255,.22)}
.mk_pillsub{position:absolute;left:24px;top:41px;font:600 10.5px -apple-system,sans-serif;color:#1f8a7a;z-index:50}
.mk_island{position:absolute;left:50%;top:10px;transform:translateX(-50%);height:30px;padding:0 14px 0 12px;border-radius:15px;background:#111;color:#eafff7;font:600 12px/30px -apple-system,'Noto Sans KR',sans-serif;z-index:50;display:flex;align-items:center;gap:7px;box-shadow:0 4px 14px rgba(0,0,0,.18)}
.mk_island i{width:7px;height:7px;border-radius:50%;background:#3ddc97;box-shadow:0 0 0 3px rgba(61,220,151,.18)}
.mk_island em{font-style:normal;color:#9fb3ac;font-weight:500}
.mk_chip{position:absolute;left:50%;bottom:30px;transform:translateX(-50%);white-space:nowrap;padding:6px 12px;border-radius:999px;background:rgba(255,255,255,.72);backdrop-filter:blur(10px);color:#1f6e63;font:600 11.5px -apple-system,'Noto Sans KR',sans-serif;z-index:50;box-shadow:0 1px 2px rgba(22,27,34,.06),0 6px 18px rgba(22,27,34,.1);display:flex;gap:6px;align-items:center}
.mk_chip i{width:6px;height:6px;border-radius:50%;background:#1f8a7a}
.mk_chip em{font-style:normal;color:#7b818c;font-weight:500}
.mk_frame{outline:4px solid #1f8a7a;outline-offset:-2px;border-radius:44px}
.mk_tab{position:absolute;left:50%;top:9px;transform:translateX(-50%);white-space:nowrap;padding:4px 12px 5px;border-radius:0 0 12px 12px;background:#1f8a7a;color:#fff;font:600 12px -apple-system,'Noto Sans KR',sans-serif;z-index:60}
.mk_tab em{font-style:normal;opacity:.75;font-weight:500;margin-left:6px}
.mk_seg{display:flex;gap:4px;margin:2px 0 0;padding:4px;border-radius:14px;background:#eef0f3}
.mk_seg b{flex:1;text-align:center;padding:9px 0 8px;border-radius:11px;font:600 14px -apple-system,'Noto Sans KR',sans-serif;color:#6b7280;line-height:1.25}
.mk_seg b small{display:block;font-size:11px;font-weight:500;color:#9aa0a8;margin-top:1px}
.mk_seg b.on{background:#fff;color:#111;box-shadow:0 1px 2px rgba(22,27,34,.08),0 4px 10px rgba(22,27,34,.06)}
.mk_seg b.on.live{color:#1f6e63}
.mk_seg b.off{opacity:.45}
.mk_card{margin:0 14px 6px;background:#fff;border-radius:22px;padding:14px 14px 14px;box-shadow:0 1px 2px rgba(22,27,34,.04),0 8px 24px rgba(22,27,34,.05)}
.mk_card .mk_t{font:600 15px -apple-system,'Noto Sans KR',sans-serif;color:#111;margin:0 2px 10px;display:flex;justify-content:space-between;align-items:baseline}
.mk_card .mk_t span{font-size:12px;font-weight:500;color:#1f8a7a}
.mk_none{margin:10px 2px 0;font:500 12.5px -apple-system,'Noto Sans KR',sans-serif;color:#8a9099;display:flex;justify-content:space-between;align-items:center}
.mk_none u{text-decoration:none;padding:6px 11px;border-radius:999px;background:#eef0f3;color:#b0b5bc;font-weight:600}
.mk_notch{position:absolute;left:50%;top:11px;transform:translateX(-50%);width:120px;height:34px;border-radius:17px;background:#000;z-index:50;display:flex;align-items:center;justify-content:flex-end;padding-right:12px;box-sizing:border-box}
.mk_notch i{width:6px;height:6px;border-radius:50%;background:#3ddc97}
.mk_notch.sh{width:auto;justify-content:center;gap:7px;padding:0 13px;color:#d8efe7;font:600 11.5px -apple-system,'Noto Sans KR',sans-serif}
.mk_hide{display:none!important}
.mk_live2{display:inline-block;margin-left:8px;padding:2px 8px;border-radius:999px;background:#e3f3ef;color:#1f6e63;font:600 11px -apple-system,'Noto Sans KR',sans-serif;vertical-align:middle}
`;
const V = { A: 'pill', B: 'island', C: 'chip', D: 'frame' };
(async () => {
  const s = await open('light', { out: OUT });
  const ind = async (v, shift) => s.p.evaluate(([v, shift, CSS]) => {
    if (!document.getElementById('mk_css')) { const st = document.createElement('style'); st.id = 'mk_css'; st.textContent = CSS; document.head.append(st); }
    const scr = document.querySelector('.na_ph_frame .na_ph_scr'), fr = document.querySelector('.na_ph_frame');
    scr.querySelectorAll('.mk_pill,.mk_pillsub,.mk_island,.mk_chip').forEach(e => e.remove()); fr.querySelectorAll('.mk_tab').forEach(e => e.remove()); fr.classList.remove('mk_frame');
    const t = (scr.querySelector('.ax_sb .cg_num, .cg_sb .cg_num, .cg_num') || {}).textContent || '17:42';
    if (v === 'pill') { scr.insertAdjacentHTML('beforeend', `<span class="mk_pill">${t}</span>${shift ? `<span class="mk_pillsub">현실보다 +2일</span>` : ''}`); const c = scr.querySelector('.ax_sb .cg_num, .cg_sb > span:first-child'); if (c) c.style.visibility = 'hidden'; }
    if (v === 'notch') scr.insertAdjacentHTML('beforeend', `<span class="mk_notch"><i></i></span>`);
    if (v === 'notchs') scr.insertAdjacentHTML('beforeend', shift ? `<span class="mk_notch sh"><i></i>현실보다 +2일</span>` : `<span class="mk_notch"><i></i></span>`);
    if (v === 'island') scr.insertAdjacentHTML('beforeend', `<span class="mk_island"><i></i>폰 2${shift ? ' <em>+2일</em>' : ''}</span>`);
    if (v === 'chip') scr.insertAdjacentHTML('beforeend', `<span class="mk_chip"><i></i>실시간 폰${shift ? ' <em>· 현실보다 +2일</em>' : ''}</span>`);
    if (v === 'frame') { fr.classList.add('mk_frame'); fr.style.position = 'relative'; fr.insertAdjacentHTML('beforeend', `<span class="mk_tab">폰 2 · 실시간${shift ? '<em>현실보다 +2일</em>' : ''}</span>`); }
  }, [v, shift, CSS]);
  // 설정: the 폰 1 · 폰 2 switch card under the person, and 폰 1's data buttons hidden in 폰 2
  const NAMES = { a: [['이야기', '롤플 속 폰'], ['실시간', '지금 이 시각']], b: [['이야기 폰', '롤플 따라 흘러요'], ['메신저 폰', '내가 직접 연락해요']], c: [['롤플', '이야기 속 시간'], ['현실', '내 시계로 흘러요']] };
  const setCard = (state, nm = 'a') => s.p.evaluate(([state, N]) => {
    const me = document.querySelector('.na_ph_frame .ax_me')?.closest('.ax_card'); if (!me) return;
    me.insertAdjacentHTML('afterend', `<div class="ax_sec">휴대폰</div><div class="mk_card"><div class="mk_seg"><b class="${state === 'live' ? '' : 'on'}">${N[0][0]}<small>${N[0][1]}</small></b><b class="${state === 'live' ? 'on live' : state === 'none' ? 'off' : ''}">${N[1][0]}<small>${N[1][1]}</small></b></div>${state === 'none' ? `<div class="mk_none">아직 ${N[1][0]}이 없어요<u>시작하기</u></div>` : ''}</div><div class="ax_foot">${state === 'live' ? '폰 2는 지금 시각으로 흘러가요. 폰 1 기록은 여기 안 보여요.' : '폰 2는 메신저로 페르소나와 주고받는 실시간 폰이에요.'}</div>`);
    if (state === 'live') { for (const sel of ['.na_ph_setupd', '[data-go=setsync]', '[data-go=setremake]', '.na_ph_storyreset', '.na_ph_setdel', '.na_ph_setinj']) document.querySelectorAll('.na_ph_frame ' + sel).forEach(e => e.classList.add('mk_hide')); document.querySelectorAll('.na_ph_frame .ax_sec').forEach(e => { if (e.textContent === '아카이브') { e.textContent = '폰 2'; } }); document.querySelectorAll('.na_ph_frame .ax_foot').forEach(e => { if (/롤플에 넣기/.test(e.textContent)) e.textContent = '반영 · 되돌리기 · 다시 만들기는 폰 2용이 따로 생길 때까지 꺼 둬요.'; }); }
  }, [state, NAMES[nm]]);
  // 인물: 폰 2's people only (Mara · Ren), the title says which phone
  const who = () => s.p.evaluate(() => {
    const h = document.querySelector('.na_ph_frame .ax_h1, .na_ph_frame h1'); if (h) h.innerHTML = h.innerHTML.replace(/3명/, '2명') + '<span class="mk_live2">폰 2</span>';
    const rows = [...document.querySelectorAll('.na_ph_frame .ax_card .ax_rw')]; rows.forEach(r => { if (/Ivo/.test(r.textContent)) r.classList.add('mk_hide'); if (/Ren/.test(r.textContent)) { const w = document.createTreeWalker(r, NodeFilter.SHOW_TEXT); let n; while ((n = w.nextNode())) if (/아직 폰 없음/.test(n.nodeValue)) n.nodeValue = '폰 있음'; } });
    const sec = [...document.querySelectorAll('.na_ph_frame .ax_sec')].find(e => /로어북/.test(e.textContent)); if (sec) { sec.classList.add('mk_hide'); sec.nextElementSibling?.classList.add('mk_hide'); }
    document.querySelector('.na_ph_frame .ax_scroll')?.insertAdjacentHTML('beforeend', '<div class="ax_foot">폰 2에 있는 사람만 보여요. 폰 1 인물은 폰 1에서 골라요.</div>');
  });
  for (const v of ['notch', 'notchs']) { await s.to('home'); await s.p.waitForTimeout(400); await ind(v, true); await s.shot(`N_${v}_home`);
    await s.to('setwho'); await s.p.waitForTimeout(400); await who(); await ind(v, true); await s.shot(`N_${v}_who`); }
  for (const nm of ['a', 'b', 'c']) { await s.to('set'); await s.p.waitForTimeout(400); await setCard('live', nm); await ind('notch', true); await s.shot(`N_set_${nm}`);
    await s.to('set'); await s.p.waitForTimeout(400); await setCard('none', nm); await s.shot(`N_none_${nm}`); }
  console.log(s.errors().slice(0, 3)); await s.close();
})();
