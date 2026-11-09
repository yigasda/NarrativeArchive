// 설정 › 말투: 이야기에서 뽑은 줄의 근거(evidence)를 고치기 알림에 보여 주는 시안 4개 + 바뀐 목록 — 실제 폰 위에 그려 찍어요
const { open } = require('/home/user/NarrativeArchive/tools/dev/probe.cjs');
const EV = ['"Why so cold? Come on, smile a little~"', '"Ugh, fine. You win this time ㅋㅋ"'];
(async () => {
  const out = process.argv[2]; const s = await open('light', { out }); const p = s.p;
  await p.waitForTimeout(2000);
  await s.run(async ({ ph }) => { ph.koVoice = [
    { who: 'Mara', style: '친구에겐 반말, 짧고 건조하게', by: 'user' },
    { who: 'Ivo', style: '존댓말. 딱딱하고 짧게', by: 'user' },
    { who: 'Ren', style: '늘 반말, 장난스럽게, 말끝을 길게 늘임', by: 'model', evidence: ['"Why so cold? Come on, smile a little~"', '"Ugh, fine. You win this time ㅋㅋ"'] },
    { who: 'Anja', style: '다정하게', by: 'model', evidence: ['"Did you eat? Don\'t skip dinner again ♡"'] } ]; });
  await s.to('setvoice'); await p.waitForTimeout(500);
  // the list: section renamed, the foot with the new line
  await p.evaluate(() => {
    const secs = [...document.querySelectorAll('.na_ph_frame .ax_sec')]; const s2 = secs.find(x => x.textContent.includes('번역기')); if (s2) s2.textContent = '이야기에서 뽑은 말투';
    const f = [...document.querySelectorAll('.na_ph_frame .ax_foot')].find(x => x.textContent.startsWith('고치면')); if (f) f.innerHTML = '고치면 내가 정한 말투로 옮겨져요.<br>지우면 다음 번역 때 이야기에서 다시 뽑아요.';
  });
  await s.shot('ev_list');
  const q = t => t.replace(/</g, '&lt;'), bare = t => q(t.replace(/^["“]|["”]$/g, ''));
  const V = {
    // A: under the line that says what to write — small grey quotes, centred like the message
    A: `<div class="evm" style="margin-top:10px;display:flex;flex-direction:column;gap:3px;font-size:12.5px;color:#8a929d;line-height:1.4">${EV.map(e => `<span>「${bare(e)}」</span>`).join('')}</div>`,
    // B: under the field — a small label "이야기에서" and the quotes, left
    B: `<div class="evb" style="margin-top:10px;text-align:left;font-size:12.5px;line-height:1.45;color:#6b7380"><div style="font-size:11px;font-weight:600;color:#9aa1ab;margin-bottom:3px">이야기에서</div>${EV.map(e => `<div>「${bare(e)}」</div>`).join('')}</div>`,
    // C: the quotes as the chat bubbles they came from, above the field
    C: `<div class="evc" style="display:flex;flex-direction:column;align-items:flex-start;gap:5px;margin:0 0 10px">${EV.map(e => `<span style="max-width:86%;padding:7px 11px;border-radius:15px 15px 15px 4px;background:#e9edf3;font-size:13px;--axfs:13px;line-height:1.35;color:#2a2f37;text-align:left">${q(e)}</span>`).join('')}</div>`,
    // D: the line under the title is the evidence itself — a quote card with a bar at the left
    D: `<div class="evd" style="margin-top:10px;padding:8px 11px;border-left:3px solid #c9d3e2;border-radius:4px 10px 10px 4px;background:rgba(255,255,255,.6);text-align:left;font-size:12.5px;line-height:1.45;color:#4f5763">${EV.map(e => `<div>${q(e)}</div>`).join('')}</div>`,
  };
  for (const [k, h] of Object.entries(V)) {
    await s.to('setvoice'); await p.waitForTimeout(300);
    await p.click('.na_ph_frame .na_ph_kvrow[data-i="2"]'); await p.waitForSelector('.pcf .pcf_area'); await p.waitForTimeout(300);
    await p.evaluate(([k, h]) => {
      const el = document.querySelector('.pcf'), msg = el.querySelector('.pcf_msg'), inn = el.querySelector('.pcf_in');
      document.activeElement?.blur(); getSelection().removeAllRanges();
      if (k === 'A') msg.insertAdjacentHTML('beforeend', h);
      if (k === 'B') inn.insertAdjacentHTML('beforeend', h);
      if (k === 'C') inn.insertAdjacentHTML('afterbegin', h);
      if (k === 'D') { msg.querySelector('span').textContent = '이야기에서 이렇게 말했어요.'; msg.insertAdjacentHTML('beforeend', h); }
    }, [k, h]);
    await p.waitForTimeout(250); await s.shot('ev_' + k);
    await p.click('.pcf .pcf_no');
  }
  console.log(JSON.stringify(s.errors())); await s.close();
})().catch(e => { console.error(String(e).slice(0, 400)); process.exit(1); });
