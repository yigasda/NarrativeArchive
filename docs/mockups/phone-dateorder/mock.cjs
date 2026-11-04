// 상태창 날짜 순서: 처음 묻는 팝업 시안 4개 + 설정 자리 시안 2개 (실제 폰 위에 얹어 찍어요)
const { open } = require('/home/user/NarrativeArchive/tools/dev/probe.cjs');
const SYS = "font-family:-apple-system,'SF Pro Text','Noto Sans KR',sans-serif;";
const dim = (inner, align = 'flex-end', pad = '0 10px 30px') => `<div style="position:absolute;inset:0;z-index:60;background:rgba(15,20,28,.34);display:flex;flex-direction:column;justify-content:${align};align-items:stretch;padding:${pad};box-sizing:border-box;${SYS}">${inner}</div>`;
const glass = 'border-radius:20px;overflow:hidden;background:#f6f6f9;box-shadow:inset 0 1.5px 1px rgba(255,255,255,.95),0 1px 2px rgba(22,27,34,.06),0 14px 34px rgba(22,27,34,.18)';
const white = 'border-radius:20px;background:#fff;box-shadow:inset 0 1.5px 1px #fff,0 1px 2px rgba(22,27,34,.06),0 12px 28px rgba(22,27,34,.16)';
const T = '상태창 날짜를 어떻게 쓰세요?', S = '나중에 폰 설정에서 바꿀 수 있어요.';
const chip = s => `<span style="display:inline-block;padding:2px 8px;border-radius:7px;background:#e9ecf1;color:#2a313b;font:600 13px 'Inter Tight',${SYS.slice(12,-1)}">${s}</span>`;
const V = {
 A: dim(`<div style="display:flex;flex-direction:column;gap:10px"><div style="${glass}">
   <div style="padding:16px 22px 14px;text-align:center"><div style="font-size:14.5px;font-weight:600;color:#2a313b">${T}</div><div style="margin-top:4px;font-size:13px;line-height:1.38;color:#7a828e">${S}</div></div>
   <div style="border-top:.5px solid rgba(60,60,67,.16);height:62px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px"><span style="font-size:19px;color:#2c4a80">월.일</span><span style="font-size:12px;color:#8a919c">11.03 = 11월 3일</span></div>
   <div style="border-top:.5px solid rgba(60,60,67,.16);height:62px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px"><span style="font-size:19px;color:#2c4a80">일.월</span><span style="font-size:12px;color:#8a919c">03.11. = 11월 3일</span></div></div>
   <div style="${white};height:57px;display:flex;align-items:center;justify-content:center;font-size:20px;font-weight:600;color:#2c4a80">나중에</div></div>`),
 B: dim(`<div style="display:flex;flex-direction:column;gap:10px"><div style="${glass};padding:20px 18px 18px">
   <div style="text-align:center;font-size:12.5px;color:#7a828e">이 채팅의 상태창에 이렇게 써 있어요</div>
   <div style="margin:10px auto 0;width:max-content;padding:9px 16px;border-radius:12px;background:#fff;box-shadow:0 1px 2px rgba(22,27,34,.06);font:600 19px 'Inter Tight',sans-serif;color:#161b22;letter-spacing:-.01em">Di, 03.11. 18:10</div>
   <div style="margin-top:14px;text-align:center;font-size:15.5px;font-weight:600;color:#2a313b">이 날짜는 언제예요?</div>
   <div style="margin-top:12px;display:flex;gap:10px">
     <div style="flex:1;height:76px;border-radius:16px;background:#fff;box-shadow:0 1px 2px rgba(22,27,34,.05),0 6px 16px rgba(22,27,34,.06);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px"><b style="font-size:18px;color:#161b22">3월 11일</b><span style="font-size:11.5px;color:#8a919c">월.일로 읽기</span></div>
     <div style="flex:1;height:76px;border-radius:16px;background:#fff;box-shadow:0 1px 2px rgba(22,27,34,.05),0 6px 16px rgba(22,27,34,.06);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px"><b style="font-size:18px;color:#161b22">11월 3일</b><span style="font-size:11.5px;color:#8a919c">일.월로 읽기</span></div></div>
   <div style="margin-top:12px;text-align:center;font-size:12px;color:#8a919c">${S}</div></div>
   <div style="${white};height:57px;display:flex;align-items:center;justify-content:center;font-size:20px;font-weight:600;color:#2c4a80">나중에</div></div>`),
 C: dim(`<div style="width:calc(100% + 20px);margin:0 -10px -30px;border-radius:26px 26px 0 0;background:#fff;padding:12px 20px 34px;box-sizing:border-box;box-shadow:0 -8px 30px rgba(22,27,34,.14)">
   <div style="width:36px;height:5px;border-radius:3px;background:#dfe2e7;margin:0 auto 18px"></div>
   <div style="font-size:20px;font-weight:700;color:#161b22;letter-spacing:-.02em">${T}</div>
   <div style="margin-top:6px;font-size:14px;color:#59616d">${S}</div>
   <div style="margin-top:18px;border-radius:16px;background:#f4f5f8;overflow:hidden">
     <div style="display:flex;align-items:center;gap:12px;padding:14px 16px"><span style="width:22px;height:22px;border-radius:999px;background:#2c4a80;box-shadow:inset 0 0 0 6px #2c4a80,inset 0 0 0 9px #fff"></span><span style="flex:1"><b style="font-size:15.5px;color:#161b22">월.일</b><br><span style="font-size:12.5px;color:#7a828e">11.03 → 11월 3일</span></span></div>
     <div style="height:.5px;background:#e3e6eb;margin-left:50px"></div>
     <div style="display:flex;align-items:center;gap:12px;padding:14px 16px"><span style="width:22px;height:22px;border-radius:999px;box-shadow:inset 0 0 0 2px #c7ccd4"></span><span style="flex:1"><b style="font-size:15.5px;color:#161b22">일.월</b><br><span style="font-size:12.5px;color:#7a828e">03.11. → 11월 3일</span></span></div></div>
   <div style="margin-top:18px;height:52px;border-radius:14px;background:#1d3461;display:flex;align-items:center;justify-content:center;font-size:15.5px;font-weight:600;color:#fff;box-shadow:inset 0 1px 0 rgba(255,255,255,.18),0 6px 16px rgba(29,52,97,.25)">이대로 반영하기</div></div>`),
 D: dim(`<div style="width:270px;margin:0 auto;border-radius:14px;overflow:hidden;background:rgba(242,242,245,.96);box-shadow:0 20px 50px rgba(22,27,34,.25)">
   <div style="padding:20px 16px 16px;text-align:center"><div style="font-size:17px;font-weight:600;color:#000">${T}</div>
   <div style="margin-top:6px;font-size:13px;line-height:1.45;color:#1c1c1e">${chip('03.11.')} 이 3월 11일인지<br>11월 3일인지 정해 주세요.</div><div style="margin-top:6px;font-size:12px;color:#7a828e">${S}</div></div>
   <div style="display:flex;border-top:.5px solid rgba(60,60,67,.29)"><div style="flex:1;height:50px;display:flex;flex-direction:column;align-items:center;justify-content:center;color:#2c4a80"><span style="font-size:17px">월.일</span><span style="font-size:10.5px;color:#8a919c">3월 11일</span></div>
   <div style="width:.5px;background:rgba(60,60,67,.29)"></div><div style="flex:1;height:50px;display:flex;flex-direction:column;align-items:center;justify-content:center;color:#2c4a80"><span style="font-size:17px;font-weight:600">일.월</span><span style="font-size:10.5px;color:#8a919c">11월 3일</span></div></div></div>`, 'center', '0'),
};
const L = { A: 'A. 액션 시트 (지금 확인 창 모양)', B: 'B. 상태창 날짜를 보여주고 "언제예요?"', C: 'C. 바텀 시트 + 고르기 + 반영 버튼', D: 'D. iOS 알림, 가로 두 버튼' };
const seg = on => `<span style="display:inline-flex;padding:2px;border-radius:9px;background:#e9ecf1;font-size:13px;font-weight:600"><span style="padding:5px 12px;border-radius:7px;${on === 'md' ? 'background:#fff;box-shadow:0 1px 3px rgba(22,27,34,.12);color:#161b22' : 'color:#7a828e'}">월.일</span><span style="padding:5px 12px;border-radius:7px;${on === 'dm' ? 'background:#fff;box-shadow:0 1px 3px rgba(22,27,34,.12);color:#161b22' : 'color:#7a828e'}">일.월</span></span>`;
(async () => {
    const out = process.argv[2]; const s = await open('light', { out });
    for (const k of Object.keys(V)) {
        await s.to('set'); await s.p.evaluate(([h, l]) => { const sc = document.querySelector('.na_ph_frame .na_ph_scr'); sc.style.position = 'relative'; sc.insertAdjacentHTML('beforeend', h);
            const tag = document.createElement('div'); tag.textContent = l; tag.style.cssText = 'position:absolute;left:0;right:0;top:58px;text-align:center;font:700 15px sans-serif;color:#d0306a;z-index:99'; sc.append(tag); }, [V[k], L[k]]);
        await s.shot('pop_' + k);
    }
    // settings E: 날짜 및 시간 안에 분할 버튼 한 줄
    await s.to('setdate'); await s.p.evaluate(([h]) => { const c = document.querySelectorAll('.na_ph_frame .ax_card'); const last = c[c.length - 1]; last.insertAdjacentHTML('afterend', h);
        const sc = document.querySelector('.na_ph_frame .na_ph_scr'); const tag = document.createElement('div'); tag.textContent = 'E. 날짜 및 시간 안에 한 줄'; tag.style.cssText = 'position:absolute;left:0;right:0;top:58px;text-align:center;font:700 15px sans-serif;color:#d0306a;z-index:99'; sc.style.position = 'relative'; sc.append(tag); },
        [`<div class="ax_sec">상태창</div><div class="ax_card"><div class="ax_rw ax_rwn"><span class="ax_tx"><span class="ax_n">날짜 순서</span></span>${seg('dm')}</div></div><div class="ax_foot">상태창의 03.11. 을 11월 3일로 읽어요.</div>`]);
    await s.shot('set_E');
    // settings F: 설정 › 일반에 한 줄 (누르면 고르는 화면)
    await s.to('set'); await s.p.evaluate(() => { const r = [...document.querySelectorAll('.na_ph_frame [data-go="setdate"]')][0]; r.insertAdjacentHTML('afterend', `<button type="button" class="ax_rw"><span class="ax_si" style="background:#9aa7c0">${r.querySelector('.ax_si').innerHTML}</span><span class="ax_tx"><span class="ax_n">상태창 날짜 순서</span></span><span class="ax_v">일.월</span>${r.querySelector('svg:last-child')?.outerHTML || ''}</button>`);
        const sc = document.querySelector('.na_ph_frame .na_ph_scr'); const tag = document.createElement('div'); tag.textContent = 'F. 설정 › 일반에 한 줄'; tag.style.cssText = 'position:absolute;left:0;right:0;top:58px;text-align:center;font:700 15px sans-serif;color:#d0306a;z-index:99'; sc.style.position = 'relative'; sc.append(tag); });
    await s.shot('set_F');
    console.log(s.errors()); await s.close();
})();
