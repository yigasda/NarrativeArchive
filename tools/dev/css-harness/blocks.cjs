// The comment blocks of style.css as a table: line range, length, what they mostly style, and their heading — step 4-5's floor plan.
//   node tools/dev/css-harness/blocks.cjs [--from 7232] [--min 20]
// A block runs from one top-level comment line to the next. "Owner" is guessed from the class prefixes inside it (see OWNERS).
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '../../..');
const lines = fs.readFileSync(path.join(ROOT, 'style.css'), 'utf8').split('\n');
const args = process.argv.slice(2); const opt = k => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : null; };
const from = +(opt('--from') || 0), min = +(opt('--min') || 0);
const OWNERS = [
    [/\.na_ly|\.na_layers|\.na_fp/, '섹션 버전'], [/\.na_rt|\.na_mg/, '제목 다시 짓기 · 합치기'], [/\.na_st\b|\.na_st_|\.na_qc/, '작업실'], [/\.na_wz|\.na_wiz|\.na_au/, '압축 마법사 · AU'],
    [/\.na_ex2|\.na_cp_|\.na_ex_/, '원문 뽑기'], [/\.na_kn/, '누가 아는가'], [/\.na_qb|\.na_quotes|\.na_q_/, '대사 은행'], [/\.na_vc|\.na_voice|\.na_pp_/, '말투 지문 · 인물'],
    [/\.na_dr|\.na_bn/, '이탈 감지 · 분기'], [/\.na_xr/, 'X-ray'], [/\.na_cal/, '이야기 달력'], [/\.na_kw/, '키워드'], [/\.na_ask|\.na_fix/, '아카이브에 질문 · 고쳐 달라고'],
    [/\.na_dg/, '요약 받기'], [/\.na_wd|\.na_world/, '세계관'], [/\.na_hl|\.na_health/, '건강'], [/\.na_pv|\.na_preview/, '미리보기'], [/\.na_ap|\.na_add/, '아카이브에 추가'],
    [/\.na_sp|\.na_pchip/, '섹션 고르기(공통)'], [/\.na_confirm|\.na_sc_/, '확인 팝업'], [/\.na_px/, '팝업 틀(공통)'],
    [/\.na_ph|\.ax\b|\.ax_|\.cg_|\.lf_|\.dv_|\.cd_|\.iv_|\.na_phone/, '휴대폰'], [/#na_settings|\.na_nav|\.na_block|\.na_meter|\.na_chip|\.na_tab/, '확장 패널'],
    [/\.na_v2_|\.na_btn|\.na_toggle|\.na_tgl|\.na_ck|\.na_popup/, '공통 부품'],
];
const heads = []; lines.forEach((l, i) => { if (/^\/\*/.test(l)) heads.push(i); });
heads.push(lines.length);
const rows = [];
for (let h = 0; h < heads.length - 1; h++) {
    const a = heads[h], b = heads[h + 1]; if (a + 1 < from || b - a < min) continue;
    const body = lines.slice(a, b).join('\n'); const counts = OWNERS.map(([re, name]) => [name, (body.match(new RegExp(re.source, 'g')) || []).length]).filter(x => x[1]).sort((x, y) => y[1] - x[1]);
    const owner = counts[0] ? counts[0][0] + (counts[1] && counts[1][1] > counts[0][1] / 2 ? ' + ' + counts[1][0] : '') : '—';
    const imp = (body.match(/!important/g) || []).length, notx = (body.match(/:not\(#na_x\)/g) || []).length;
    rows.push({ from: a + 1, to: b, len: b - a, owner, imp, notx, head: lines[a].replace(/^\/\*\s*=*\s*/, '').replace(/\s*\*\/\s*$/, '').slice(0, 90) });
}
for (const r of rows) console.log(`${String(r.from).padStart(5)}–${String(r.to).padEnd(5)} ${String(r.len).padStart(4)}줄  !${String(r.imp).padEnd(3)} x${String(r.notx).padEnd(3)} ${r.owner.padEnd(22)} ${r.head}`);
console.log(`\n${rows.length} blocks · ${rows.reduce((a, r) => a + r.len, 0)} lines`);
const byOwner = {}; for (const r of rows) { byOwner[r.owner] = (byOwner[r.owner] || 0) + r.len; }
console.log(Object.entries(byOwner).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(' · '));
