// 폰 안 "초안 모델" 화면 시안 3개 — 실제 폰 설정 화면 CSS(카드 · 줄 · 라디오 · 파란 글자) 위에 그려 찍어요
// A 한 화면에 다(방식 라디오 + 칸 + 연결 테스트) · B 두 단계(방식 → 칸) · C 지금 모델 카드 + 바꿀 칸
const { open } = require('/home/user/NarrativeArchive/tools/dev/probe.cjs');
(async () => {
  const out = process.argv[2]; const s = await open('light', { out, make: false }); const p = s.p;
  await s.to('prep'); await p.waitForTimeout(400);
  const H = await p.evaluate(async () => {
    const { ax } = await import('/scripts/extensions/third-party/NarrativeArchive/src/phoneapps.js');
    const chev = ax('chev', 15, '#b7bdc6', 2.4), check = ax('check', 14, '#fff', 3.4);
    const radio = on => `<span class="ax_radio${on ? ' on' : ''}">${on ? check : ''}</span>`;
    const opt = (n, sub, on) => `<div class="ax_rw ax_rwn"><span class="ax_tx"><span class="ax_n">${n}</span>${sub ? `<span class="ax_p ax_kvp">${sub}</span>` : ''}</span>${radio(on)}</div>`;
    const row = (n, v, blue) => `<div class="ax_rw ax_rwn"><span class="ax_tx"><span class="ax_n">${n}</span></span><span class="ax_v">${blue ? `<span class="ax_blue">${v}</span>` : v}</span>${chev}</div>`;
    const act = t => `<div class="ax_card"><div class="ax_rw ax_rwn"><span class="ax_tx"><span class="ax_n ax_blue">${t}</span></span></div></div>`;
    const head = t => `<div class="ax_h1"><b>${t}</b></div>`;
    const ways = on => `<div class="ax_card">${opt('쓰지 않음', '', on === 0)}${opt('커스텀 API', 'OpenAI · Anthropic 호환 주소', on === 1)}${opt('Gemini · Vertex AI', '실리태번에 저장한 서비스 계정', on === 2)}</div>`;
    const fields = `<div class="ax_card">${row('주소', 'api.example.com/v1')}${row('API 키', 'sk-…3f9a')}${row('형식', '주소 보고 자동')}${row('생각', '작업마다 알아서')}${row('모델', 'gemini-2.5-flash')}</div>`;
    const foot = '<div class="ax_foot">폰을 채우고 반영하는 모델이에요. 확장 설정 › AI 모델 › 초안 모델과 같은 값이에요.</div>';
    const out = {};
    // A: all on one screen
    out.A = `${head('초안 모델')}<div class="ax_sec">방식</div>${ways(1)}<div class="ax_sec">커스텀 API</div>${fields}${act('연결 테스트')}${foot}<i class="ax_pad"></i>`;
    // B: two steps — the ways (with the model under the one chosen), then its fields on a screen of their own
    out.B1 = `${head('초안 모델')}<div class="ax_card">${opt('쓰지 않음', '', false)}<div class="ax_rw ax_rwn"><span class="ax_tx"><span class="ax_n">커스텀 API</span><span class="ax_p ax_kvp">gemini-2.5-flash · api.example.com</span></span>${radio(true)}</div>${opt('Gemini · Vertex AI', '', false)}</div><div class="ax_card">${row('커스텀 API 설정', '', false)}</div>${foot}<i class="ax_pad"></i>`;
    out.B2 = `${head('커스텀 API')}${fields}${act('연결 테스트')}<div class="ax_foot">모델을 누르면 주소에서 목록을 불러와 고를 수 있어요.</div><i class="ax_pad"></i>`;
    // C: the model now as a card on top (name · way · last test), then what to change
    out.C = `${head('초안 모델')}<div class="ax_card" style="padding:16px 18px"><div style="font-size:12px;color:#8a929d;font-weight:600">지금 쓰는 모델</div><div style="margin-top:4px;font-size:22px;font-weight:600;letter-spacing:-0.01em">gemini-2.5-flash</div><div style="margin-top:3px;font-size:13px;color:#6b7380">커스텀 API · api.example.com</div><div style="margin-top:10px;display:flex;align-items:center;gap:6px;font-size:13px;color:#3f7d50"><i style="width:7px;height:7px;border-radius:50%;background:#3f7d50;display:inline-block"></i>연결 확인됨 · 11.11. 21:02</div></div>${act('연결 테스트')}<div class="ax_sec">바꾸기</div><div class="ax_card">${row('방식', '커스텀 API')}${row('모델', 'gemini-2.5-flash')}${row('주소', 'api.example.com/v1')}${row('API 키', 'sk-…3f9a')}${row('형식', '주소 보고 자동')}${row('생각', '작업마다 알아서')}</div>${foot}<i class="ax_pad"></i>`;
    return out;
  });
  for (const [k, h] of Object.entries(H)) {
    await s.to('prep'); await p.waitForTimeout(250);
    await p.evaluate(h => { const sc = document.querySelector('.na_ph_frame .ax_scroll'); sc.innerHTML = h; sc.scrollTop = 0; }, h);
    await p.waitForTimeout(300); await s.shot('ds_' + k);
  }
  console.log(JSON.stringify(s.errors())); await s.close();
})().catch(e => { console.error(String(e).slice(0, 400)); process.exit(1); });
