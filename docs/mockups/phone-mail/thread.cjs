// 메일: 받은 · 보낸 나누기 + 답장 스레드 — 시안 4개 × (목록 · 열었을 때). 실제 폰 메일 화면 CSS 위에 그려 찍어요
// A 아래 탭(전화 앱 ax_dock) · 접힌 원래 메일 / 답장 카드  B 한 목록 + 보낸 표시 · 스레드 전부 펼침
// C 위 칩(ax_chips) · 아래 "답장" 줄  D 메일함 첫 화면(받은 · 보낸) · 원래 메일은 인용 칸
const { open } = require('/home/user/NarrativeArchive/tools/dev/probe.cjs');
const OWN = 'Mara';
const M = [
  { from: 'Jonas Weber', subject: 'Wohnungsübergabe am Freitag', text: 'Hallo Mara,\n\nkönnen wir die Übergabe auf Freitag 17 Uhr legen? Bitte bring beide Schlüssel mit.\n\nViele Grüße\nJonas', ko: '마라, 인계를 금요일 17시로 해도 될까요? 열쇠 두 개 다 가져와 주세요.', time: '10-24 09:12' },
  { from: OWN, to: 'Jonas Weber', subject: 'Re: Wohnungsübergabe am Freitag', text: 'Hallo Jonas,\n\nFreitag 17 Uhr passt. Ich bringe beide Schlüssel mit.\n\nMara', ko: '금요일 17시 좋아요. 열쇠 두 개 다 가져갈게요.', time: '10-24 11:40' },
  { from: 'Varo Air', subject: 'Ihre Buchungsbestätigung VAR → BER', text: 'Vielen Dank für Ihre Buchung.', ko: '예약해 주셔서 감사합니다.', time: '10-25 08:02', unread: true },
  { from: OWN, to: 'Anja', subject: 'Fotos vom Wochenende', text: 'Hier sind die Fotos vom See!', ko: '호수에서 찍은 사진이야!', time: '10-25 19:20' },
  { from: 'Anja', subject: 'Re: Fotos vom Wochenende', text: 'Wie schön! Das zweite ist mein Lieblingsbild.', ko: '예쁘다! 두 번째가 제일 좋아.', time: '10-25 21:05', unread: true },
];
(async () => {
  const out = process.argv[2]; const s = await open('light', { out }); const p = s.p;
  await p.waitForTimeout(2000);
  await s.to('mail'); await p.waitForTimeout(300);
  const H = await p.evaluate(async ([M, OWN]) => {
    const { ax, axLetter } = await import('/scripts/extensions/third-party/NarrativeArchive/src/phoneapps.js');
    const sent = x => !!x.to, who = x => (sent(x) ? x.to : x.from), t = x => x.time.slice(6);
    const ko = (a, b) => `${a}${b ? `<span class="ax_ko"> ${b}</span>` : ''}`;
    const ans = x => { const b = x.subject.replace(/^(Re|AW|Fwd):\s*/i, ''); return M.find(y => y !== x && y.subject === b && /^(Re|AW):/i.test(x.subject)) || null; };
    const replies = x => M.filter(y => ans(y) === x);
    const row = (x, extra = '') => `<div class="ax_rw ax_rwm">${x.unread ? '<i class="ax_dot"></i>' : ''}${axLetter(who(x), 42)}<span class="ax_tx"><span class="ax_h"><b>${extra}${who(x)}</b><small class="cg_num">${t(x)}</small></span><span class="ax_s ${x.unread ? 'u' : ''}">${x.subject}</span><span class="ax_p">${ko(x.text.replace(/\s+/g, ' '), x.ko)}</span></span></div>`;
    const head = (x, big = true) => `<div class="ax_card ax_rw ax_mfrom">${axLetter(x.from, 44)}<span class="ax_tx"><b>${x.from}</b><span class="ax_p">받는 사람: ${sent(x) ? x.to : OWN}</span></span><small class="cg_num">${x.time.slice(3, 5)}.${x.time.slice(0, 2)}. ${t(x)}</small></div>`;
    const body = x => `<div class="ax_mbody">${x.text}</div><div class="ax_mko">${x.ko}</div>`;
    const fold = (x, lab) => `<div class="ax_sec">${lab}</div><div class="ax_card"><div class="ax_rw ax_rwm">${axLetter(x.from, 36)}<span class="ax_tx"><span class="ax_h"><b>${x.from}</b><small class="cg_num">${t(x)}</small></span><span class="ax_p" style="-webkit-line-clamp:1">${x.text.replace(/\s+/g, ' ')}</span></span>${ax('chev', 15, '#b7bdc6', 2.4)}</div></div>`;
    const tool = (rep) => `<div class="ax_ntool ax_mtool"><span class="ax_ntb">${ax('trash2', 22, 'currentColor', 1.9)}</span><span class="ax_ntc cg_num">${rep}</span><span class="ax_ntb"${rep === '답장 1' ? '' : ' style="opacity:.35"'}>${ax('reply', 22, 'currentColor', 1.9)}</span></div>`;
    const list = M.map((x, i) => [x, i]).reverse();
    const out = {};
    // A: the call app's bottom tabs; detail: the mail it answers folded on top, its reply folded under
    const dockA = on => `<div class="ax_dock"><button type="button" class="${on === 0 ? 'on' : ''}">받은편지함</button><button type="button" class="${on === 1 ? 'on' : ''}">보낸편지함</button></div>`;
    out.A1 = { html: `<div class="ax_h1"><b>받은편지함</b><span>안 읽음 2</span></div><div class="ax_card">${list.filter(([x]) => !sent(x)).map(([x]) => row(x)).join('')}</div><i class="ax_pad big"></i>`, after: dockA(0) };
    out.A1s = { html: `<div class="ax_h1"><b>보낸편지함</b></div><div class="ax_card">${list.filter(([x]) => sent(x)).map(([x]) => row(x, '<span style="color:#8a929d;font-weight:500">받는 사람: </span>')).join('')}</div><i class="ax_pad big"></i>`, after: dockA(1) };
    const R = M[1];
    out.A2 = { html: `${fold(M[0], '원래 메일')}${head(R)}<div class="ax_msub">${R.subject}</div>${body(R)}<i class="ax_pad big"></i>`, after: tool('보낸편지함') };
    // B: one list, a sent mail marked by an arrow and its receiver; detail: the whole thread open, oldest first
    const sentMark = `<span style="display:inline-flex;vertical-align:-2px;margin-right:4px;color:#8a929d">${ax('reply', 14, '#8a929d', 2.2).replace('<svg', '<svg style="transform:scaleX(-1)"')}</span>`;
    out.B1 = { html: `<div class="ax_h1"><b>메일</b><span>안 읽음 2</span></div><div class="ax_card">${list.map(([x]) => row(x, sent(x) ? sentMark : '')).join('')}</div><i class="ax_pad"></i>` };
    out.B2 = { html: `<div class="ax_msub" style="padding-top:4px">Wohnungsübergabe am Freitag <span style="font-size:13px;color:#8a929d;font-weight:500">2개</span></div>${[M[0], M[1]].map(x => `${head(x)}${body(x)}`).join('<div style="height:14px"></div>')}<i class="ax_pad big"></i>`, after: tool('메일') };
    // C: chips on top (전체 · 받은 · 보낸); detail: the mail, then 답장 rows to open
    const chips = on => `<div class="ax_chips" style="padding:0 16px 12px">${['전체', '받은', '보낸'].map((c, i) => `<button type="button" class="${i === on ? 'on' : ''}">${c}</button>`).join('')}</div>`;
    out.C1 = { html: `<div class="ax_h1"><b>메일</b><span>안 읽음 2</span></div>${chips(0)}<div class="ax_card">${list.map(([x]) => row(x, sent(x) ? '<span style="color:#8a929d;font-weight:500">→ </span>' : '')).join('')}</div><i class="ax_pad"></i>` };
    const O = M[0];
    out.C2 = { html: `${head(O)}<div class="ax_msub">${O.subject}</div>${body(O)}<div class="ax_sec" style="margin-top:14px">답장 1개</div><div class="ax_card">${replies(O).map(x => `<div class="ax_rw ax_rwm">${axLetter(x.from, 36)}<span class="ax_tx"><span class="ax_h"><b>${x.from}</b><small class="cg_num">${t(x)}</small></span><span class="ax_p">${x.text.replace(/\s+/g, ' ')}</span></span>${ax('chev', 15, '#b7bdc6', 2.4)}</div>`).join('')}</div><i class="ax_pad big"></i>`, after: tool('답장 1') };
    // D: a mailboxes screen first (as Apple Mail); detail: the mail it answers as a grey quote under the reply
    const ic = (k, c) => `<span class="ax_si" style="background:${c}">${ax(k, 17, '#fff')}</span>`;
    out.D1 = { html: `<div class="ax_h1"><b>메일함</b></div><div class="ax_card"><div class="ax_rw">${ic('mail', '#7fa6cf')}<span class="ax_tx"><span class="ax_n">받은편지함</span></span><span class="ax_v">2</span>${ax('chev', 15, '#b7bdc6', 2.4)}</div><div class="ax_rw">${ic('send', '#8fb5a0')}<span class="ax_tx"><span class="ax_n">보낸편지함</span></span><span class="ax_v"></span>${ax('chev', 15, '#b7bdc6', 2.4)}</div></div><i class="ax_pad"></i>` };
    out.D2 = { html: `${head(R)}<div class="ax_msub">${R.subject}</div><div class="ax_mbody">${R.text}</div><div style="margin:4px 22px 0;padding:2px 0 2px 12px;border-left:3px solid #d7dce3;color:#6b7380;font-size:13.5px;line-height:1.5"><div style="font-size:12px;margin-bottom:4px">${O.time.slice(3, 5)}.${O.time.slice(0, 2)}. ${t(O)} · ${O.from}:</div>${O.text.replace(/\n/g, '<br>')}</div><div class="ax_mko">${R.ko}</div><i class="ax_pad big"></i>`, after: tool('받은편지함') };
    return out;
  }, [M, OWN]);
  for (const [k, v] of Object.entries(H)) {
    await s.to(k.endsWith('2') ? 'mailone:0' : 'mail'); await p.waitForTimeout(300);
    await p.evaluate(v => {
      const scr = document.querySelector('.na_ph_frame .na_ph_scr'), sc = scr.querySelector('.ax_scroll'); sc.innerHTML = v.html; sc.scrollTop = 0;
      scr.querySelectorAll('.ax_ntool, .ax_dock').forEach(e => e.remove());
      if (v.after) sc.insertAdjacentHTML('afterend', v.after);
    }, v);
    await p.waitForTimeout(300); await s.shot('ml_' + k);
  }
  console.log(JSON.stringify(s.errors())); await s.close();
})().catch(e => { console.error(String(e).slice(0, 400)); process.exit(1); });
