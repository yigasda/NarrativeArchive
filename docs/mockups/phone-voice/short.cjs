// 설정 › 말투: 긴 말투를 목록에서 어떻게 줄일지 시안 4개 — 실제 폰 설정 화면 CSS 위에 그려 찍어요
// 1 이름만 · 2 쉼표 앞까지 · 3 태그 · 4 눌러서 펼치기
const { open } = require('/home/user/NarrativeArchive/tools/dev/probe.cjs');
const ROWS = [
  ['Mara', '친구에겐 반말, 짧고 건조하게', 'user'],
  ['Ivo', '존댓말, 딱딱하고 짧게, 화나면 존댓말이 더 딱딱해지고 문장이 짧아짐. 이모티콘은 거의 안 씀', 'user'],
  ['Ren', '늘 반말, 장난스럽게, 이모티콘 가끔, 말끝을 길게 늘임', 'model'],
  ['Anja', '반말, 다정하게, 하트 자주', 'model'],
];
(async () => {
  const out = process.argv[2]; const s = await open('light', { out }); const p = s.p;
  await s.to('set'); await p.waitForTimeout(2500);
  const H = await p.evaluate(async R => {
    const { ax, axLetter } = await import('/scripts/extensions/third-party/NarrativeArchive/src/phoneapps.js');
    const chev = ax('chev', 15, '#b7bdc6', 2.4);
    const parts = st => st.split(/[,.，。]\s*/).map(x => x.trim()).filter(Boolean);
    const head = '<div class="ax_h1"><b>말투</b><span>4명</span></div>';
    const add = '<div class="ax_rw ax_rwn"><span class="ax_tx"><span class="ax_n ax_blue">사람 추가</span></span></div>';
    const foot = '<div class="ax_foot">남에게 하는 말투예요. 일기 · 메모에는 안 써요.<br>이미 옮긴 문장은 그대로예요. 다시 맞추려면 그 앱에서 "가 한국어"를 꾹 눌러요.</div>';
    const page = row => {
      const mine = R.filter(r => r[2] !== 'model'), auto = R.filter(r => r[2] === 'model');
      return `${head}<div class="ax_sec">내가 정한 말투</div><div class="ax_card">${mine.map((r, i) => row(r, false, i)).join('')}${add}</div><div class="ax_sec">번역기가 정한 말투</div><div class="ax_card">${auto.map((r, i) => row(r, true, i + 9)).join('')}</div><div class="ax_foot">고치면 내가 정한 말투로 옮겨져요.</div>${foot}<i class="ax_pad"></i>`;
    };
    const nm = (w, grey) => `<span class="ax_n"${grey ? ' style="color:#6b7380"' : ''}>${w}</span>`;
    // 1: name only — the style opens on tap
    const A = page(([w], g) => `<div class="ax_rw">${axLetter(w, 36)}<span class="ax_tx">${nm(w, g)}</span>${chev}</div>`);
    // 2: up to the first comma — one short word, no …
    const B = page(([w, st], g) => { const ps = parts(st); return `<div class="ax_rw">${axLetter(w, 36)}<span class="ax_tx">${nm(w, g)}<span class="ax_p" style="-webkit-line-clamp:1">${ps[0]}${ps.length > 1 ? ` <span style="color:#a9b0ba">외 ${ps.length - 1}개</span>` : ''}</span></span>${chev}</div>`; });
    // 3: tags — each comma piece a small chip, two shown and +N
    const chip = (t, more) => `<span style="display:inline-block;padding:3px 9px;margin:0 5px 0 0;border-radius:999px;background:${more ? '#f3f4f7' : '#eaf0f8'};color:${more ? '#8a929d' : '#3d5a80'};font-size:12px;--axfs:12px;font-weight:600;line-height:1.4;white-space:nowrap">${t}</span>`;
    const C = page(([w, st], g) => { const ps = parts(st), sh = ps.slice(0, 2); return `<div class="ax_rw">${axLetter(w, 36)}<span class="ax_tx">${nm(w, g)}<span style="display:flex;flex-wrap:nowrap;overflow:hidden;margin-top:5px">${sh.map(t => chip(t)).join('')}${ps.length > 2 ? chip(`+${ps.length - 2}`, true) : ''}</span></span>${chev}</div>`; });
    // 4: tap to open in place — closed rows are the name only, the open one shows the whole style + 고치기
    const down = ax('chev', 15, '#b7bdc6', 2.4).replace('<svg', '<svg style="transform:rotate(90deg)"');
    const upc = ax('chev', 15, '#8a929d', 2.4).replace('<svg', '<svg style="transform:rotate(-90deg)"');
    const D = page(([w, st], g, i) => i === 1
      ? `<div class="ax_rw" style="align-items:flex-start;flex-wrap:wrap">${axLetter(w, 36)}<span class="ax_tx" style="padding-top:7px">${nm(w, g)}</span><span style="padding-top:9px">${upc}</span><div style="flex-basis:100%;margin:10px 0 2px 48px;padding:11px 13px;border-radius:12px;background:#f3f4f7;font-size:14px;line-height:1.5;color:#2a2f37">${st}<div style="margin-top:8px;text-align:right;font-size:13px;font-weight:600;color:#2f6bff">고치기</div></div></div>`
      : `<div class="ax_rw">${axLetter(w, 36)}<span class="ax_tx">${nm(w, g)}</span>${down}</div>`);
    return { '1': A, '2': B, '3': C, '4': D };
  }, ROWS);
  for (const [k, h] of Object.entries(H)) { await s.to('set'); await p.waitForTimeout(250); await p.evaluate(h => { const sc = document.querySelector('.na_ph_frame .ax_scroll'); sc.innerHTML = h; sc.scrollTop = 0; }, h); await p.waitForTimeout(300); await s.shot('short_' + k); }
  console.log(JSON.stringify(s.errors())); await s.close();
})().catch(e => { console.error(String(e).slice(0, 400)); process.exit(1); });
