// Health check: AI-free checks of the archive and its settings.

import { branchState, openBranches } from './branches.js';
import { ctx, getMeta, saveMeta } from './core.js';
import { buildExtract, extractToText } from './extract.js';
import { applyHide } from './hide.js';
import { applyInjection, currentInjection } from './inject.js';
import { capWords, editDistance, keywordStats, keywordWarn, openKeywords } from './keywords.js';
import { showArchiveView, showTab, syncPanel } from './panel.js';
import { cachedTokens, checkHeadings, headingRanges, keyLabel, linkedMap, mutedSet, parseSections, pinnedSet, sectionKey, setLinked, splitTail } from './sections.js';
import { refreshStatusSoon } from './status.js';
import { SVG_B, svgB } from './theme.js';
import { glossaryEntries, openGlossary } from './translate.js';
import { countTokens, esc, fmt, timeLabel } from './util.js';

// Cheap, AI-free checks of the archive and its settings. Each item: { level: 'bad'|'warn'|'info'|'ok', title, detail?, fix? }

export let nearMemo = { text: null, out: [] };
export function selfNearMisses(text) {
    if (nearMemo.text === text) return nearMemo.out;
    const out = selfNearMissesRaw(text);
    nearMemo = { text, out };
    return out;
}

export function selfNearMissesRaw(text) {
    const counts = new Map();
    // names only: a word that also shows up in lower case ("Sending" / "sending") is an ordinary word
    // and it must be capitalised mid-sentence at least once, so a sentence-opening "Seeing" does not count
    const lower = new Set((text.match(/\b[a-z][a-z'’]+\b/g) || []));
    const mid = new Set([...text.matchAll(/[a-z,;]\s+([A-Z][a-z][A-Za-z'’]*)/g)].map(x => x[1].replace(/['’]s$/, '')));
    capWords(text).filter(w => w.length >= 4 && mid.has(w) && !lower.has(w.toLowerCase())).forEach(w => counts.set(w, (counts.get(w) || 0) + 1));
    const words = [...counts.keys()];
    const out = [];
    for (const w of words) {
        const cap = w.length >= 7 ? 2 : 1;
        for (const o of words) {
            if (o === w || o[0] !== w[0] || counts.get(o) <= counts.get(w)) continue;
            // a plural or possessive is not a misspelling
            if (o + 's' === w || w + 's' === o || o.startsWith(w) || w.startsWith(o)) continue;
            const d = editDistance(w, o, cap);
            if (d > 0 && d <= cap) { out.push({ word: w, like: o, n: counts.get(w), m: counts.get(o) }); break; }
        }
    }
    return out.slice(0, 8);
}

export async function healthChecks(m, { build, afterTok, after } = {}) {
    build ||= await currentInjection();
    const chat = ctx().chat || [];
    const last = chat.length - 1;
    if (afterTok === undefined) { after = m.boundary >= 0 ? buildExtract(m.boundary + 1, last) : []; afterTok = await countTokens(extractToText(after)); }
    const items = [];
    const add = (level, title, detail = '', fix = null, short = '') => items.push({ level, title, detail, fix, short });
    const secs = parseSections(m.text);
    const cards = secs.filter(x => !x.group && x.title !== '(머리말)' && x.title !== '(제목 없음)');
    const keys = new Set(secs.map(sectionKey));

    // numbering
    const hc = checkHeadings(m.text);
    if (hc.issues.length) add('warn', `제목 번호 문제 ${hc.issues.length}개`, hc.issues.slice(0, 5).map(x => `${x.title.slice(0, 40)} — ${x.msg}`).join('\n'), { label: '제목 검사 보기', run: () => { $('dialog .popup-button-ok').last().trigger('click'); showTab('archive'); showArchiveView('cards'); $('#na_hcheck').prop('open', true)[0]?.scrollIntoView({ block: 'center' }); } });
    else if (hc.ranged) add('ok', '제목 번호가 빈틈 없이 이어져요', '', null, '번호 이어짐');

    // STATE / boundary agree with the last section
    const ranges = headingRanges(m.text);
    const lastR = ranges.length ? ranges[ranges.length - 1] : null;
    const [, tail] = splitTail(m.text);
    const stateN = (tail.match(/^# STATE\b[^\n]*#(\d+)/m) || [])[1];
    if (lastR && stateN !== undefined && Number(stateN) !== lastR.to) add('warn', `STATE 번호(#${stateN})가 마지막 섹션 끝(#${lastR.to})과 달라요`, '압축 결과에서 STATE를 새로 안 받았을 수 있어요.');
    if (lastR && m.boundary >= 0 && lastR.to <= last && m.boundary !== lastR.to) {
        add('warn', `경계선 #${m.boundary}이 마지막 섹션 끝 #${lastR.to}과 달라요`, '', { label: `경계선을 #${lastR.to}로`, run: async () => { m.boundary = lastR.to; await saveMeta(); syncPanel(); toastr.success(`경계선 #${lastR.to}`); } });
    }

    const br = branchState(m);
    if (br.ahead.length) add('bad', `분기 지점(#${br.last}) 뒤의 섹션 ${br.ahead.length}개가 섞여 있어요`, '원본 채팅에서 분기 뒤에 쓴 섹션이에요.', { label: '분기 정리', run: () => openBranches() });

    // compression due, hiding
    if (m.boundary >= 0) {
        const hideEnd = m.boundary - Math.max(0, Number(m.keep) || 0);
        const open = chat.slice(0, Math.max(0, hideEnd + 1)).map((x, i) => (x && !x.is_system ? i : -1)).filter(i => i >= 0);
        const shown = open.length;
        if (shown) add('warn', `압축한 메시지 ${shown}개가 안 숨겨져 있어요`, `${shown > 1 ? `#${open[0]} – #${open[shown - 1]}` : `#${open[0]}`} · 아카이브와 같이 들어가요`, { label: '숨기기 적용', danger: true, run: () => applyHide() });
        else add('ok', '압축한 메시지는 다 숨겨져 있어요', '', null, '숨김');
    }

    // token cap
    if (build.over) add('bad', `토큰 상한 ${fmt(build.cap)}을 넘었어요 (${fmt(build.tokens)})`, '망각 곡선을 켜거나 섹션을 꺼 주세요.');
    else if (build.trimmed.length) add('info', `상한에 맞추느라 섹션 ${build.trimmed.length}개를 뺐어요`);

    // keyword links
    const lm = linkedMap(m);
    const stat = Object.keys(lm).length ? keywordStats(m) : null;
    for (const [k, ws] of Object.entries(lm)) {
        if (!keys.has(k)) { add('warn', `키워드 연동한 섹션이 없어졌어요: ${keyLabel(k).slice(0, 40)}`, '', { label: '연동 지우기', run: async () => { await setLinked(k, []); } }); continue; }
        const bad = (ws || []).map(w => ({ w, warn: keywordWarn(w, stat) })).filter(x => x.warn.length);
        if (bad.length) {
            const s = secs.find(x => sectionKey(x) === k);
            add('warn', `키워드 확인: ${keyLabel(k).slice(0, 40)}`, bad.map(x => `${x.w} — ${x.warn[0]}`).join('\n'),
                s ? { label: '키워드 고치기', run: async () => { const ks = await openKeywords(s, m.text.slice(s.start, s.end), lm[k] || []); if (ks) await setLinked(k, ks); } } : null);
        }
    }
    const dangling = [...mutedSet(m), ...pinnedSet(m)].filter(k => !keys.has(k));
    if (dangling.length) add('info', `없어진 섹션의 스위치·고정 설정 ${dangling.length}개가 남아 있어요`, '', { label: '정리', run: async () => { m.muted = m.muted.filter(k => keys.has(k)); m.pinned = m.pinned.filter(k => keys.has(k)); await saveMeta(); applyInjection(); syncPanel(); } });

    // sections
    const empty = cards.filter(x => !m.text.slice(x.start, x.end).replace(/^#{1,2} [^\n]*\n?/, '').trim());
    if (empty.length) add('warn', `빈 섹션 ${empty.length}개`, empty.slice(0, 5).map(x => x.title.slice(0, 50)).join('\n'));
    const big = [];
    for (const x of cards) { const t = await cachedTokens(m.text.slice(x.start, x.end)); if (t > 2500) big.push(`${(x.title.match(/(?:\S+ )?#\d+\s*[–-]\s*#\d+/) || [x.title.slice(0, 40)])[0]} · ${fmt(t)} 토큰`); }
    if (big.length) add('info', `아주 큰 섹션 ${big.length}개`, `${big.slice(0, 5).join('\n')} — 다시 압축하거나 나누면 좋아요`);

    // spelling drift inside the archive
    const nm = selfNearMisses(m.text);
    if (nm.length) add('warn', `비슷한 이름 ${nm.length}쌍 — 철자가 흔들렸을 수 있어요`, nm.map(x => `${x.word} (${x.n}번) ↔ ${x.like} (${x.m}번)`).join('\n'));

    // backup
    if (!m.backup) add('warn', '아직 백업한 적이 없어요', '', { label: '.json 백업', run: () => $('#na_export_json').trigger('click') });
    else if (m.backupEvery > 0 && m.sinceBackup >= m.backupEvery) add('warn', '백업한 지 오래됐어요', `마지막 .json 백업 뒤 ${m.sinceBackup}번 바뀜 · ${timeLabel(m.backup.at)}`, { label: '.json 백업', run: () => $('#na_export_json').trigger('click') });
    else add('ok', `백업 ${timeLabel(m.backup.at)}`, '', null, '백업');

    if (!glossaryEntries(m).length && Object.keys(m.trMem || {}).length) add('info', '번역 용어집이 비어 있어요', '이름 표기가 번역마다 달라질 수 있어요.', { label: '용어집 열기', run: () => openGlossary() });

    const pen = { bad: 15, warn: 6, info: 1, ok: 0 };
    const score = Math.max(0, 100 - items.reduce((a, x) => a + pen[x.level], 0));
    const order = { bad: 0, warn: 1, info: 2, ok: 3 };
    items.sort((a, b) => order[a.level] - order[b.level]);
    return { score, items };
}

export async function openHealth() {
    const c = ctx();
    const m = getMeta();
    const $root = $(`<div class="na_popup na_v2 na_hl2"><div class="na_health_body na_v2"><div class="na_empty">점검하는 중…</div></div></div>`);
    const render = async () => {
        const h = await healthChecks(m);
        const fix = h.items.map((x, i) => ({ x, i })).filter(({ x }) => x.level === 'bad' || x.level === 'warn');
        const info = h.items.map((x, i) => ({ x, i })).filter(({ x }) => x.level === 'info');
        const ok = h.items.filter(x => x.level === 'ok');
        const tone = h.score >= 80 ? 'good' : h.score >= 60 ? 'mid' : 'low';
        const word = h.score >= 90 ? '건강해요' : h.score >= 70 ? '거의 괜찮아요' : '손볼 곳이 있어요';
        const R = 38, C = 2 * Math.PI * R;
        const txt = x => `<span class="na_hl2_txt"><b>${esc(x.title)}</b>${x.detail ? `<small>${esc(x.detail).replace(/\n/g, '<br>')}</small>` : ''}</span>`;
        const item = ({ x, i }) => {
            const red = x.level === 'bad' || x.fix?.danger;
            return `
          <div class="na_v2_card na_hl2_item ${x.level}${red ? ' red' : ''}">
            <span class="na_hl2_bar"></span>
            <div class="na_hl2_main">
              ${txt(x)}
              ${x.fix ? `<button type="button" class="na_v2_btn ${red ? 'danger' : 'primary'} na_health_fix" data-i="${i}">${esc(x.fix.label)}</button>` : ''}
            </div>
          </div>`;
        };
        // 참고: no colour bar, a blue (i) at the left, a quiet pill if it can be fixed
        const infoItem = ({ x, i }) => `
          <div class="na_v2_card na_hl2_info">
            ${svgB(SVG_B.info, 18, 2, 'na_hl2_infoic')}
            <div class="na_hl2_infomain">${txt(x)}${x.fix ? `<button type="button" class="na_v2_pillbtn na_health_fix" data-i="${i}">${esc(x.fix.label)}</button>` : ''}</div>
          </div>`;
        const counts = [fix.length ? `고칠 것 ${fix.length}개` : '', info.length ? `참고 ${info.length}개` : ''].filter(Boolean).join(', ');
        $root.find('.na_health_body').html(`
          <div class="na_v2_card na_hl2_top">
            <div class="na_hl2_ring ${tone}">
              <svg viewBox="0 0 92 92" width="92" height="92"><circle cx="46" cy="46" r="${R}" class="bg"/><circle cx="46" cy="46" r="${R}" class="fg" stroke-dasharray="${(C * h.score / 100).toFixed(1)} 999" transform="rotate(-90 46 46)"/></svg>
              <span><b>${h.score}</b><small>점</small></span>
            </div>
            <div class="na_hl2_sum"><b>${word}</b><small>AI 없이 번호·숨기기·키워드·백업을 훑어봤어요.${counts ? ` ${counts}.` : ''}</small></div>
          </div>
          ${fix.length ? `<div class="na_v2_label">고칠 것</div>${fix.map(item).join('')}` : ''}
          ${info.length ? `<div class="na_v2_label">참고</div>${info.map(infoItem).join('')}` : ''}
          ${ok.length ? `<details class="na_v2_card na_hl2_ok"><summary><span class="na_ck_ic">${svgB(SVG_B.check, 12, 3)}</span><span class="na_hl2_okn">괜찮은 것 <b>${ok.length}</b>개</span><span class="na_hl2_oks">${esc(ok.map(x => x.short || x.title).join(' · '))}</span>${svgB(SVG_B.down, 15, 2.2, 'na_hl2_chev')}</summary><ul>${ok.map(x => `<li>${esc(x.title)}</li>`).join('')}</ul></details>` : ''}`);

        $root.find('.na_health_fix').on('click', async function () {
            const it = h.items[Number(this.dataset.i)];
            $(this).prop('disabled', true);
            try { await it.fix.run(); } finally { setTimeout(render, 300); }
        });
    };
    render();
    await c.callGenericPopup($root, c.POPUP_TYPE.TEXT, '', { wide: true, large: true, allowVerticalScrolling: true, leftAlign: true, okButton: '닫기' });
    refreshStatusSoon();
}
