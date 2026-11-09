// 설정 › 말투 › 사람 추가: 폰에 나오는 사람을 목록에서 골라요 (타이핑 없이). 시안 2개, 실제 폰 위에 그려 찍어요
// A 원래 알림창(askPick 줄 + askInput 버튼) 안에 목록 · B 설정앱 화면 하나(말투 화면과 같은 카드 · 동그라미 · 뽑기 줄)
const { open } = require('/home/user/NarrativeArchive/tools/dev/probe.cjs');
const PEOPLE = [['Lukas', '연락처 · 문자'], ['Mia', '문자'], ['Tom', '댓글'], ['Jonas', '연락처'], ['Elif', '댓글']];
const SEL = ['Lukas', 'Mia'];
(async () => {
  const out = process.argv[2]; const s = await open('light', { out }); const p = s.p;
  await p.waitForTimeout(2000);
  await s.run(async ({ ph }) => { ph.koVoice = [
    { who: 'Mara', style: '친구에겐 반말, 짧고 건조하게', by: 'user' },
    { who: 'Ren', style: '늘 반말, 장난스럽게', by: 'model' }, { who: 'Anja', style: '다정하게', by: 'model' } ]; });
  const H = await p.evaluate(async ([P, S]) => {
    const { ax, axLetter } = await import('/scripts/extensions/third-party/NarrativeArchive/src/phoneapps.js');
    const sel = new Set(S), chev = ax('chev', 15, '#b7bdc6', 2.4);
    const ck = on => `<span style="margin-left:auto;width:22px;display:grid;place-items:center">${on ? ax('check', 18, '#2c4a80', 2.6) : ''}</span>`;
    // A: the phone's own alert
    const A = `<div class="pcf_msg"><b>사람 추가</b><span>말투를 뽑을 사람을 골라요.</span></div><div class="pcf_btns v">${P.map(([w, sub]) => `<div class="pcf_ok safe pcf_pick">${axLetter(w, 26)}<span class="pcf_pt"><span>${w}</span><small>${sub}</small></span>${ck(sel.has(w))}</div>`).join('')}<div class="pcf_ok safe">직접 적기</div></div><div class="pcf_btns"><div class="pcf_no">취소</div><div class="pcf_ok safe">2명 뽑기</div></div>`;
    // B: a settings screen — the 뽑기 row on top, the people as the 말투 list with the settings radio, 직접 적기 at the end
    const radio = on => `<span class="ax_radio${on ? ' on' : ''}">${on ? ax('check', 14, '#fff', 3.4) : ''}</span>`;
    const B = `<div class="ax_h1"><b>사람 추가</b></div>
      <div class="ax_card"><div class="ax_rw"><span class="ax_si" style="background: #8faed1">${ax('wand', 17, '#fff')}</span><span class="ax_tx"><span class="ax_n">2명 뽑기</span><span class="ax_p ax_kvp">고른 사람의 말투를 이야기에서 찾아요</span></span>${chev}</div></div>
      <div class="ax_sec ax_kvsec">폰에 나오는 사람<span class="ax_blue ax_kvall">전체</span></div>
      <div class="ax_card">${P.map(([w, sub]) => `<div class="ax_rw">${axLetter(w, 36)}<span class="ax_tx"><span class="ax_n">${w}</span><span class="ax_p ax_kvp">${sub}</span></span>${radio(sel.has(w))}</div>`).join('')}</div>
      <div class="ax_card"><div class="ax_rw ax_rwn"><span class="ax_tx"><span class="ax_n ax_blue">직접 적기</span></span></div></div>
      <div class="ax_foot">말투표에 없는 사람만 보여요.</div><i class="ax_pad"></i>`;
    return { A, B };
  }, [PEOPLE, SEL]);
  // A: open the real alert (사람 추가), put the list in its card
  await s.to('setvoice'); await p.waitForTimeout(400); await s.shot('ad_0');
  await p.click('.na_ph_frame .na_ph_kvadd'); await p.waitForSelector('.pcf .pcf_field'); await p.waitForTimeout(250);
  await p.evaluate(card => { document.activeElement?.blur(); const el = document.querySelector('.pcf'), no = el.querySelector('.pcf_no'); no.id = 'pk_no'; const keep = document.createElement('div'); keep.style.display = 'none'; keep.appendChild(no); el.appendChild(keep); el.querySelector('.pcf_card').innerHTML = card; }, H.A);
  await p.waitForTimeout(300); await s.shot('ad_A');
  await p.evaluate(() => document.getElementById('pk_no')?.click()); await p.waitForTimeout(200);
  // B: the settings screen
  await s.to('setvoice'); await p.waitForTimeout(300);
  await p.evaluate(h => { const sc = document.querySelector('.na_ph_frame .ax_scroll'); sc.innerHTML = h; sc.scrollTop = 0; }, H.B);
  await p.waitForTimeout(300); await s.shot('ad_B');
  console.log(JSON.stringify(s.errors())); await s.close();
})().catch(e => { console.error(String(e).slice(0, 400)); process.exit(1); });
