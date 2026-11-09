// 설정 › 말투: "뽑기" 버튼 시안 4개 — 실제 폰의 고치기 알림 위에 그려 찍어요 (+ 사람 추가 이름 알림, 바뀐 안내)
// A 버튼 셋 한 줄 · B 칸 아래 작은 뽑기 · C 세로 버튼 · D 이름 알림에서 바로 뽑기 / 직접 쓰기
const { open } = require('/home/user/NarrativeArchive/tools/dev/probe.cjs');
(async () => {
  const out = process.argv[2]; const s = await open('light', { out }); const p = s.p;
  await p.waitForTimeout(2000);
  await s.run(async ({ ph }) => { ph.koVoice = [
    { who: 'Mara', style: '친구에겐 반말, 짧고 건조하게', by: 'user' },
    { who: 'Ren', style: '늘 반말, 장난스럽게, 말끝을 길게 늘임', by: 'model' } ]; });
  const wand = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" style="vertical-align:-3px;margin-right:5px"><path d="M15 4V2M15 10V8M11 6h2M17 6h2M4 20L14 10M19 13v2M18 14h2"/></svg>';
  const V = {
    A: { row: 1, f: (el) => { el.querySelector('.pcf_btns').innerHTML = '<div class="pcf_no">취소</div><div class="pcf_ok safe" style="font-weight:400">뽑기</div><div class="pcf_ok safe">저장</div>'; } },
    B: { row: 1, f: (el, w) => { el.querySelector('.pcf_btns').innerHTML = '<div class="pcf_no">취소</div><div class="pcf_ok safe">저장</div>'; el.querySelector('.pcf_in').insertAdjacentHTML('beforeend', `<div style="display:flex;justify-content:flex-end;margin-top:8px"><span style="display:inline-flex;align-items:center;padding:6px 12px;border-radius:999px;background:#e6ecf5;color:#2c4a80;font-size:13.5px;--axfs:13.5px;font-weight:600">${w}이야기에서 뽑기</span></div>`); } },
    C: { row: 1, f: (el) => { const b = el.querySelector('.pcf_btns'); b.classList.add('v'); b.innerHTML = '<div class="pcf_ok safe" style="font-weight:600;color:#2c4a80">저장</div><div class="pcf_ok safe" style="color:#2c4a80">이야기에서 뽑기</div><div class="pcf_no" style="font-weight:400">취소</div>'; } },
    D: { add: true, f: (el) => { el.querySelector('.pcf_btns').innerHTML = '<div class="pcf_no" style="font-weight:400">직접 쓰기</div><div class="pcf_ok safe">뽑기</div>'; const sp = el.querySelector('.pcf_msg span'); sp.textContent = '이름을 적어요.'; const f = el.querySelector('.pcf_field'); f.value = 'Lukas'; } },
  };
  for (const [k, v] of Object.entries(V)) {
    await s.to('setvoice'); await p.waitForTimeout(300);
    await p.evaluate(() => { const f = [...document.querySelectorAll('.na_ph_frame .ax_foot')]; if (f[0]) f[0].textContent = '지운 사람은 다시 안 뽑아요.'; });
    if (v.add) { await p.click('.na_ph_frame .na_ph_kvadd'); await p.waitForSelector('.pcf .pcf_field'); }
    else { await p.click(`.na_ph_frame .na_ph_kvrow[data-i="${v.row}"]`); await p.waitForSelector('.pcf .pcf_area'); }
    await p.waitForTimeout(300);
    await p.evaluate(([k, src, w]) => { document.activeElement?.blur(); getSelection().removeAllRanges(); const el = document.querySelector('.pcf'); const no = el.querySelector('.pcf_no'); no.id = 'pk_no'; const keep = document.createElement('div'); keep.style.display = 'none'; keep.appendChild(no); el.appendChild(keep); (0, eval)(`(${src})`)(el, w); }, [k, v.f.toString(), wand]);
    await p.waitForTimeout(250); await s.shot('pk_' + k);
    await p.evaluate(() => document.getElementById('pk_no')?.click()); await p.waitForTimeout(200);
  }
  // after: the result line (a toast-like sheet the phone already has) — shown as the list with the new row and the foot
  await s.to('setvoice'); await p.waitForTimeout(300);
  await p.evaluate(() => { const f = [...document.querySelectorAll('.na_ph_frame .ax_foot')]; if (f[0]) f[0].textContent = '지운 사람은 다시 안 뽑아요.'; });
  await s.shot('pk_list');
  console.log(JSON.stringify(s.errors())); await s.close();
})().catch(e => { console.error(String(e).slice(0, 400)); process.exit(1); });
