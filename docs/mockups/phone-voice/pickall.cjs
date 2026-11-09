// 설정 › 말투: 화면 전체에 "뽑기" — 골라서 뽑기 + 전체 선택. 시안 4개 × (평소 · 고르는 중), 실제 폰 위에 그려 찍어요
// A 오른쪽 위 알약 → 편집처럼 왼쪽 동그라미 + 아래 버튼 · B 제목 아래 카드 줄 → 오른쪽 체크, 섹션마다 "전체"
// C 오른쪽 위 알약 → 아래에서 올라오는 시트에 이름 목록 · D 아래에 늘 있는 큰 버튼 → 체크 + 위 "전체 선택" 칩
const { open } = require('/home/user/NarrativeArchive/tools/dev/probe.cjs');
const R = [['Mara', '친구에겐 반말', 1, 0], ['Ivo', '존댓말', 3, 0], ['Ren', '늘 반말', 2, 1], ['Anja', '다정하게', 0, 1]];
(async () => {
  const out = process.argv[2]; const s = await open('light', { out }); const p = s.p;
  await p.waitForTimeout(2000);
  await s.to('setvoice'); await p.waitForTimeout(300);
  const H = await p.evaluate(async R => {
    const { ax, axLetter } = await import('/scripts/extensions/third-party/NarrativeArchive/src/phoneapps.js');
    const chev = ax('chev', 15, '#b7bdc6', 2.4), WAND = 'M15 4V2M15 10V8M11 6h2M17 6h2M4 20L14 10M19 13v2M18 14h2';
    const wand = (c = 'currentColor', n = 15) => `<svg width="${n}" height="${n}" viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="2" stroke-linecap="round" style="flex:none"><path d="${WAND}"/></svg>`;
    const sel = new Set(['Ren', 'Anja']);
    const radio = on => `<span class="ax_radio${on ? ' on' : ''}" style="--axd:#2f6bff;flex:none">${on ? ax('check', 14, '#fff', 3.4) : ''}</span>`;
    const sub = ([, a, n]) => `<span class="ax_p" style="-webkit-line-clamp:1">${a}${n ? ` <span style="color:#a9b0ba">외 ${n}개</span>` : ''}</span>`;
    const nm = (w, g) => `<span class="ax_n"${g ? ' style="color:#6b7380"' : ''}>${w}</span>`;
    const foot = '<div class="ax_foot">지운 사람은 다시 안 뽑아요.</div>';
    const foot2 = '<div class="ax_foot">일기 · 메모에는 안 써요. 이미 옮긴 글은 그대로예요.</div>';
    const add = '<div class="ax_rw ax_rwn"><span class="ax_tx"><span class="ax_n ax_blue">사람 추가</span></span></div>';
    const head = '<div class="ax_h1"><b>말투</b><span>4명</span></div>';
    const body = (row, { secR = () => '', addRow = true, top = '' } = {}) => {
      const mine = R.filter(r => !r[3]), auto = R.filter(r => r[3]);
      return `${head}${top}<div class="ax_sec" style="display:flex;justify-content:space-between;align-items:center">내가 정한 말투${secR(mine)}</div><div class="ax_card">${mine.map(row).join('')}${addRow ? add : ''}</div><div class="ax_sec" style="display:flex;justify-content:space-between;align-items:center">이야기에서 뽑은 말투${secR(auto)}</div><div class="ax_card">${auto.map(row).join('')}</div>${foot}${foot2}<i class="ax_pad" style="height:120px"></i>`;
    };
    const plain = r => `<div class="ax_rw">${axLetter(r[0], 36)}<span class="ax_tx">${nm(r[0], r[3])}${sub(r)}</span>${chev}</div>`;
    const pill = `<span style="display:inline-flex;align-items:center;gap:5px;font-size:16px;font-weight:600;color:#2f6bff">${wand('currentColor', 16)}뽑기</span>`;
    const bar = (t, dim) => `<div style="position:absolute;left:0;right:0;bottom:0;padding:12px 16px 30px;background:linear-gradient(rgba(242,243,246,0),#f2f3f6 30%)"><div style="height:50px;border-radius:14px;display:flex;align-items:center;justify-content:center;gap:7px;background:#fff;color:${dim ? '#b4bac3' : '#2f6bff'};font-size:16px;font-weight:600;box-shadow:0 1px 2px rgba(22,27,34,.04),0 8px 24px rgba(22,27,34,.08)">${wand('currentColor', 17)}${t}</div></div>`;
    const out = {};
    // A: pill top right → edit mode: 취소 top right, 전체 선택 under the title, a circle at each row's left, the button at the bottom
    out.A0 = { top: pill, html: body(plain) };
    out.A1 = { top: '<span style="font-size:16px;font-weight:600;color:#2f6bff">취소</span>', html: body(r => `<div class="ax_rw">${radio(sel.has(r[0]))}${axLetter(r[0], 36)}<span class="ax_tx">${nm(r[0], r[3])}${sub(r)}</span></div>`, { addRow: false, top: '<div style="margin:-6px 18px 10px;font-size:14.5px;font-weight:600;color:#2f6bff">전체 선택</div>' }), over: bar('2명 뽑기') };
    // B: a card row under the title → check at the right, "전체" on each section's title
    const cardRow = `<div class="ax_card"><div class="ax_rw">${`<span class="ax_si" style="background:#8faed1">${wand('#fff', 17)}</span>`}<span class="ax_tx"><span class="ax_n">이야기에서 뽑기</span><span class="ax_p" style="-webkit-line-clamp:1">고른 사람의 말투를 이야기에서 찾아요</span></span>${chev}</div></div>`;
    out.B0 = { html: body(plain, { top: cardRow }) };
    out.B1 = { top: '<span style="font-size:16px;font-weight:600;color:#2f6bff">취소</span>', html: body(r => `<div class="ax_rw">${axLetter(r[0], 36)}<span class="ax_tx">${nm(r[0], r[3])}${sub(r)}</span>${radio(sel.has(r[0]))}</div>`, { addRow: false, secR: rs => `<span style="font-size:13px;font-weight:600;color:#2f6bff;text-transform:none">${rs.every(r => sel.has(r[0])) ? '전체 해제' : '전체'}</span>` }), over: bar('2명 뽑기') };
    // C: pill top right → a sheet from the bottom: 전체 선택, the names with checks, 취소 · N명 뽑기
    out.C0 = { top: pill, html: body(plain) };
    const sheetRows = R.map(r => `<div style="display:flex;align-items:center;gap:12px;height:52px;padding:0 18px;border-top:0.5px solid rgba(60,60,67,.14)">${axLetter(r[0], 30)}<span style="flex:1;font-size:16px;color:#161b22">${r[0]}</span>${radio(sel.has(r[0]))}</div>`).join('');
    // C·: the phone's own alert (askPick's rows, askInput's two buttons) — only its rows are new: 전체 선택, then each person with a check
    const ck = on => `<span style="margin-left:auto;width:22px;display:grid;place-items:center">${on ? ax('check', 18, '#2c4a80', 2.6) : ''}</span>`;
    out.C1 = { top: pill, html: body(plain), card: `<div class="pcf_msg"><b>이야기에서 뽑기</b><span>고른 사람의 말투를 이야기에서 찾아요.</span></div><div class="pcf_btns v"><div class="pcf_ok safe pcf_pick"><span class="pcf_pt"><span>전체 선택</span></span>${ck(false)}</div>${R.map(r => `<div class="pcf_ok safe pcf_pick">${axLetter(r[0], 26)}<span class="pcf_pt"><span>${r[0]}</span></span>${ck(sel.has(r[0]))}</div>`).join('')}</div><div class="pcf_btns"><div class="pcf_no">취소</div><div class="pcf_ok safe">2명 뽑기</div></div>` };
    // D: a big button always at the bottom → checks at the right, a 전체 선택 chip row on top
    const chips = `<div style="display:flex;gap:8px;margin:-4px 16px 12px"><span style="padding:7px 13px;border-radius:999px;background:#e1e9ff;color:#2f6bff;font-size:13.5px;font-weight:600">전체 선택</span><span style="padding:7px 13px;border-radius:999px;background:#fff;color:#4f5763;font-size:13.5px;font-weight:600;box-shadow:0 1px 2px rgba(22,27,34,.06)">이야기에서 뽑은 것만</span></div>`;
    out.D0 = { html: body(plain), over: bar('이야기에서 뽑기') };
    out.D1 = { top: '<span style="font-size:16px;font-weight:600;color:#2f6bff">취소</span>', html: body(r => `<div class="ax_rw">${axLetter(r[0], 36)}<span class="ax_tx">${nm(r[0], r[3])}${sub(r)}</span>${radio(sel.has(r[0]))}</div>`, { addRow: false, top: chips }), over: bar('2명 뽑기') };
    return out;
  }, R);
  for (const [k, v] of Object.entries(H)) {
    await s.to('setvoice'); await p.waitForTimeout(250);
    await p.evaluate(v => {
      const scr = document.querySelector('.na_ph_frame .na_ph_scr'), sc = scr.querySelector('.ax_scroll'); sc.innerHTML = v.html; sc.scrollTop = 0;
      const tr = scr.querySelector('.ax_topr'); if (tr) tr.innerHTML = v.top || '';
      if (v.over) { if (getComputedStyle(scr).position === 'static') scr.style.position = 'relative'; scr.insertAdjacentHTML('beforeend', `<div style="position:absolute;inset:0;pointer-events:none;z-index:50">${v.over}</div>`); }
    }, v);
    if (v.card) {
      await p.evaluate(() => { const r = document.createElement('div'); r.className = 'ax_rw na_ph_kvadd'; r.id = 'pk_add'; r.style.display = 'none'; document.querySelector('.na_ph_frame .ax_scroll').appendChild(r); r.click(); });
      await p.waitForSelector('.pcf .pcf_field'); await p.waitForTimeout(250);
      await p.evaluate(card => { document.activeElement?.blur(); const el = document.querySelector('.pcf'), no = el.querySelector('.pcf_no'); no.id = 'pk_no'; const keep = document.createElement('div'); keep.style.display = 'none'; keep.appendChild(no); el.appendChild(keep); el.querySelector('.pcf_card').innerHTML = card; }, v.card);
    }
    await p.waitForTimeout(300); await s.shot('pa_' + k);
    if (v.card) { await p.evaluate(() => document.getElementById('pk_no')?.click()); await p.waitForTimeout(200); }
  }
  console.log(JSON.stringify(s.errors())); await s.close();
})().catch(e => { console.error(String(e).slice(0, 400)); process.exit(1); });
