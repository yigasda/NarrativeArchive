// 설정 › 말투 시안 4개 — 실제 폰 설정 화면 CSS 위에 그려 찍어요 (설정의 카드 · 줄 · 회색 제목 · 파란 글자)
const { open } = require('/home/user/NarrativeArchive/tools/dev/probe.cjs');
const ROWS = [['Mara', '친구에겐 반말, 짧고 건조하게', 'user'], ['Ren', '늘 반말, 장난스럽게, 이모티콘 가끔', 'model'], ['Ivo', '존댓말, 딱딱하고 짧게', 'model'], ['Anja', '반말, 다정하게, 하트 자주', 'user']];
(async () => {
  const out = process.argv[2]; const s = await open('light', { out }); const p = s.p;
  await s.to('set'); await p.waitForTimeout(300);
  const H = await p.evaluate(async R => {
    const apps = await import('/scripts/extensions/third-party/NarrativeArchive/src/phoneapps.js');
    const { ax, axLetter } = apps; const chev = ax('chev', 15, '#b7bdc6', 2.4), esc = s => s;
    const auto = '<span style="margin-left:6px;padding:1px 7px;border-radius:999px;background:#eef0f3;color:#8a929d;font-size:11px;font-weight:600;vertical-align:1px">자동</span>';
    const head = sub => `<div class="ax_h1"><b>말투</b>${sub ? `<span>${sub}</span>` : ''}</div>`;
    const foot = '<div class="ax_foot">남에게 하는 말투예요. 일기 · 메모에는 안 써요.<br>이미 옮긴 문장은 그대로예요. 다시 맞추려면 그 앱에서 "가 한국어"를 꾹 눌러요.</div>';
    const add = t => `<div class="ax_card"><div class="ax_rw ax_rwn"><span class="ax_tx"><span class="ax_n ax_blue">${t}</span></span></div></div>`;
    // A: settings list — face · name (+자동) · the style under it, chevron; tap opens the alert to edit; swipe to delete
    const A = `${head('4명')}<div class="ax_card">${R.map(([w, st, by]) => `<div class="ax_rw">${axLetter(w, 36)}<span class="ax_tx"><span class="ax_n">${w}${by === 'model' ? auto : ''}</span><span class="ax_p">${st}</span></span>${chev}</div>`).join('')}</div>${add('사람 추가')}${foot}<i class="ax_pad"></i>`;
    // B: each person a card, the style written right in it (a line to type), trash at the right
    const B = `${head('')}${R.map(([w, st, by]) => `<div class="ax_card" style="padding:14px 16px 12px"><div style="display:flex;align-items:center;gap:10px">${axLetter(w, 30)}<b style="font-size:15px;font-weight:600;flex:1">${w}${by === 'model' ? auto : ''}</b>${ax('trash2', 19, '#b4bac3', 2)}</div><div style="margin-top:10px;padding:10px 12px;border-radius:12px;background:#f3f4f7;font-size:14.5px;color:#161b22">${st}</div></div>`).join('')}${add('+ 사람 추가')}${foot}<i class="ax_pad"></i>`;
    // C: a sample bubble per person — the style as how they'd text, name under
    const C = `${head('4명')}<div class="ax_foot" style="margin:-4px 28px 12px">사람마다 문자 · 댓글 · 메일이 이렇게 옮겨져요.</div><div class="ax_card" style="padding:6px 0">${R.map(([w, st, by]) => `<div class="ax_rw" style="align-items:flex-start">${axLetter(w, 34)}<span class="ax_tx"><span style="font-size:12px;color:#8a929d">${w}${by === 'model' ? auto : ''}</span><span style="display:inline-block;align-self:flex-start;margin-top:4px;padding:8px 12px;border-radius:16px 16px 16px 4px;background:#e9edf3;font-size:14.5px;color:#161b22;max-width:240px">${st}</span></span>${chev}</div>`).join('')}</div>${add('사람 추가')}<div class="ax_foot">일기 · 메모에는 안 써요. 이미 옮긴 문장은 그대로예요 — 다시 맞추려면 그 앱에서 "가 한국어"를 꾹 눌러요.</div><i class="ax_pad"></i>`;
    // D: two groups — 내가 정한 말투 / 번역기가 정한 말투 (grey, "내 걸로" to keep)
    const mine = R.filter(r => r[2] !== 'model'), auto2 = R.filter(r => r[2] === 'model');
    const row = ([w, st]) => `<div class="ax_rw">${axLetter(w, 36)}<span class="ax_tx"><span class="ax_n">${w}</span><span class="ax_p">${st}</span></span>${chev}</div>`;
    const D = `${head('')}<div class="ax_sec">내가 정한 말투</div><div class="ax_card">${mine.map(row).join('')}<div class="ax_rw ax_rwn"><span class="ax_tx"><span class="ax_n ax_blue">사람 추가</span></span></div></div><div class="ax_sec">번역기가 정한 말투</div><div class="ax_card">${auto2.map(([w, st]) => `<div class="ax_rw">${axLetter(w, 36)}<span class="ax_tx"><span class="ax_n" style="color:#5a626e">${w}</span><span class="ax_p">${st}</span></span><span style="font-size:13px;font-weight:600;color:#2f6bff">고치기</span></div>`).join('')}</div><div class="ax_foot">번역기가 정한 줄은 고치면 내가 정한 말투로 옮겨져요.</div>${foot}<i class="ax_pad"></i>`;
    // E (A + D): A's rows, D's two groups — what I set (with 사람 추가) on top, the translator's under it, its names a little grey
    const rowE = ([w, st], grey) => `<div class="ax_rw">${axLetter(w, 36)}<span class="ax_tx"><span class="ax_n"${grey ? ' style="color:#6b7380"' : ''}>${w}</span><span class="ax_p">${st}</span></span>${chev}</div>`;
    const E = `${head('4명')}<div class="ax_sec">내가 정한 말투</div><div class="ax_card">${mine.map(r => rowE(r)).join('')}<div class="ax_rw ax_rwn"><span class="ax_tx"><span class="ax_n ax_blue">사람 추가</span></span></div></div><div class="ax_sec">번역기가 정한 말투</div><div class="ax_card">${auto2.map(r => rowE(r, true)).join('')}</div><div class="ax_foot">고치면 내가 정한 말투로 옮겨져요.</div>${foot}<i class="ax_pad"></i>`;
    return { A, B, C, D, E };
  }, ROWS);
  for (const [k, h] of Object.entries(H)) { await s.to('set'); await p.waitForTimeout(250); await p.evaluate(h => { const sc = document.querySelector('.na_ph_frame .ax_scroll'); sc.innerHTML = h; sc.scrollTop = 0; }, h); await p.waitForTimeout(300); await s.shot('voice_' + k); }
  // the 설정 row: under 번역 용어집 in 화면
  await s.to('set'); await p.waitForTimeout(300);
  await p.evaluate(async () => { const { ax } = await import('/scripts/extensions/third-party/NarrativeArchive/src/phoneapps.js'); const g = document.querySelector('.na_ph_frame .na_ph_gloss'); g.insertAdjacentHTML('afterend', `<button type="button" class="ax_rw"><span class="ax_si" style="background:#8faed1">${ax('cmt', 17, '#fff')}</span><span class="ax_tx"><span class="ax_n">말투</span></span><span class="ax_v">4명</span>${ax('chev', 15, '#b7bdc6', 2.4)}</button>`); });
  await p.waitForTimeout(300); await s.shot('voice_setrow');
  console.log(JSON.stringify(s.errors())); await s.close();
})().catch(e => { console.error(String(e).slice(0, 400)); process.exit(1); });
