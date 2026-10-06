// Keyword links: the per-section keyword editor, keyword analysis and the keyword test.

import { askAI, withSpinner } from './ai.js';
import { ctx, getMeta } from './core.js';
import { RANGE_HEAD, keyLabel, linkHits, linkedMap, mutedSet, parseSections, recentChatText, sectionKey } from './sections.js';
import { esc } from './util.js';

// Keyword-link editor: the keywords, candidates found in the section, and AI suggestions. Returns the list or null.
export async function openKeywords(s, body, current) {
    const c = ctx();
    const m = getMeta();
    const split = v => [...new Set(String(v).split(/[,，\n]/).map(x => x.trim().replace(/^["'“”‘’\-*\s]+|["'“”‘’.\s]+$/g, '')).filter(Boolean))];
    const depthN = Math.max(1, Number(m.linkDepth) || 4);
    const $root = $(`
      <div class="na_popup na_v2 na_kw2">
        <div class="na_kw2_head"><small>키워드 연동 · 평소엔 빼 두고, 최근 ${depthN}개 메시지에 나올 때만</small><b class="na_kw_title"></b></div>
        <div class="na_v2_card na_kw2_box">
          <div class="na_kw2_keys"><input type="text" class="na_kw2_add" placeholder="키워드 입력" title="Enter나 쉼표로 넣어요. 여러 개는 쉼표로 나눠 한 번에."></div>
          <input type="hidden" class="na_kw_in">
          <div class="na_kw_check"></div>
          <div class="na_kw2_hint">대화가 한국어면 한국어 키워드도 같이 넣어야 켜져요.</div>
        </div>
        <div class="na_kw_group">
          <div class="na_v2_label">이 섹션에서 두드러지는 말<small>섹션 수 · 메시지 %</small></div>
          <div class="na_kw_chips na_kw_found"></div>
        </div>
        <div class="na_kw_group na_kw_broad_group">
          <div class="na_v2_note">너무 넓은 말 · 넣으면 거의 늘 켜져요</div>
          <div class="na_kw_chips na_kw_broad"></div>
        </div>
        <div class="na_v2_card na_kw2_ai">
          <div class="na_kw2_aihead"><b>AI 제안</b><small class="na_v2_note" title="사건·주제별로, 한국어 표현까지 골라 줘요">사건·주제별</small>
            <button type="button" class="na_v2_pillbtn na_kw_ai" title="AI 기능 모델에게 키워드를 받아요">받기</button></div>
          <div class="na_kw_aiout"></div>
        </div>
        <details class="na_v2_more na_kw2_test">
          <summary>키워드 테스트 <small>문장을 넣으면 이 섹션이 불려 오는지 보여 줘요</small></summary>
          <div class="na_kw_testbox">
            <textarea class="text_pole na_kw_tin" rows="2" placeholder="예: 그 지도 아직 갖고 있어?"></textarea>
            <label class="checkbox_label na_kw_trecent"><input type="checkbox"><span>최근 메시지 ${Math.max(0, depthN - 1)}개도 같이 (다음 메시지로 보낸다고 치기)</span></label>
            <div class="na_kw_tout"></div>
          </div>
        </details>
        <div class="na_v2_row2 na_kw2_acts">
          ${current.length ? '<button type="button" class="na_v2_btn na_kw2_unlink">연동 풀기</button>' : ''}
          <button type="button" class="na_v2_btn primary na_kw2_save">저장</button>
        </div>
      </div>`);
    const $in = $root.find('.na_kw_in').val(current.join(', '));
    $root.find('.na_kw_title').text(s.title);
    const an = keywordAnalysis(m, s, body);
    const stat = an.stat;
    const chipStat = w => `${stat.secCount(w)} · ${pct(stat.chatPct(w))}`;
    const chipTitle = w => `섹션 ${stat.secs}개 중 ${stat.secCount(w)}개, 채팅 메시지 ${stat.msgs}개 중 ${pct(stat.chatPct(w))}에 나와요`;
    const chip = (w, extra = '') => `<button type="button" class="na_pchip ${extra}" data-w="${esc(w)}" title="${chipTitle(w)}">${esc(w)} <small>${/na_pchip_broad/.test(extra) ? pct(stat.chatPct(w)) : chipStat(w)}</small></button>`;
    // AI rows: words as plain text, each one still clickable
    const word = w => { const warn = keywordWarn(w, stat); return `<button type="button" class="na_kw2_word ${warn.length ? 'risk' : ''}" data-w="${esc(w)}" title="${esc([chipTitle(w), ...warn].join(' · '))}">${esc(w)}</button>`; };
    const mark = () => {
        const have = new Set(split($in.val()).map(x => x.toLowerCase()));
        $root.find('.na_pchip[data-w], .na_kw2_word').each(function () { $(this).toggleClass('on', have.has(String($(this).data('w')).toLowerCase())); });
        // what the chosen keywords would do
        const list = split($in.val());
        const lines = list.map(w => ({ w, warn: keywordWarn(w, stat) })).filter(x => x.warn.length);
        const any = list.some(w => stat.chatPct(w) > 0);
        const fire = stat.fireRate(list);
        $root.find('.na_kw2_keys .na_kw2_key').remove();
        $root.find('.na_kw2_add').before(list.map(w => `<span class="na_kw2_key">${esc(w)}<button type="button" class="na_kw2_x" data-w="${esc(w)}" aria-label="빼기">×</button></span>`).join(''));
        $root.find('.na_kw_check').html(!list.length ? '<div class="na_v2_note">키워드가 없으면 연동이 풀려요.</div>' : `
            <div class="na_kw2_fire ${fire > 0.3 ? 'warn' : ''}">
              <span class="na_cp_txt"><small>지금까지 메시지 기준</small><b>${stat.msgs ? `약 ${pct(fire)}에서 켜졌을 거예요` : '아직 메시지가 없어요'}</b>${!any && stat.msgs ? '<small>이 채팅엔 아직 안 나온 말이에요</small>' : ''}</span>
              <span class="na_kw2_meter"><span style="width:${Math.min(100, Math.max(fire > 0 ? 2 : 0, fire * 100)).toFixed(1)}%"></span></span>
            </div>
            ${lines.map(x => `<div class="na_kw_warn"><i class="fa-solid fa-triangle-exclamation"></i> <b>${esc(x.w)}</b> — ${x.warn.map(esc).join(' · ')}</div>`).join('')}`);
    };
    $root.find('.na_kw_found').html(an.distinct.length ? an.distinct.map(r => chip(r.show)).join('') : '<span class="na_v2_note">두드러지는 말이 없어요. AI 제안의 받기를 눌러 보세요.</span>');
    if (an.broad.length) $root.find('.na_kw_broad').html(an.broad.map(r => chip(r.show, 'na_pchip_broad')).join(''));
    else $root.find('.na_kw_broad_group').hide();
    $root.on('click', '.na_pchip[data-w], .na_kw2_word', function () {
        const w = String($(this).data('w'));
        const list = split($in.val());
        const i = list.findIndex(x => x.toLowerCase() === w.toLowerCase());
        i >= 0 ? list.splice(i, 1) : list.push(w);
        $in.val(list.join(', '));
        mark();
    });
    $root.on('click', '.na_kw_addall', function () {
        const words = $(this).closest('.na_kw_concept').find('[data-w]').map((i, e) => String($(e).data('w'))).get();
        const list = split($in.val());
        for (const w of words) if (!list.some(x => x.toLowerCase() === w.toLowerCase())) list.push(w);
        $in.val(list.join(', '));
        mark();
    });
    const depth = Math.max(1, Number(m.linkDepth) || 4);
    const addTyped = () => {
        const $a = $root.find('.na_kw2_add');
        const words = split($a.val());
        $a.val('');
        if (!words.length) return;
        const list = split($in.val());
        for (const w of words) if (!list.some(x => x.toLowerCase() === w.toLowerCase())) list.push(w);
        $in.val(list.join(', '));
        mark(); runTest();
    };
    $root.find('.na_kw2_add').on('keydown', e => {
        if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); e.stopPropagation(); addTyped(); }
        else if (e.key === 'Backspace' && !e.target.value) { const list = split($in.val()); list.pop(); $in.val(list.join(', ')); mark(); runTest(); }
    }).on('blur', addTyped);
    $root.find('.na_kw2_keys').on('click', e => { if (e.target === e.currentTarget) $root.find('.na_kw2_add').trigger('focus'); });
    $root.on('click', '.na_kw2_x', function () {
        const w = String($(this).data('w')).toLowerCase();
        $in.val(split($in.val()).filter(x => x.toLowerCase() !== w).join(', '));
        mark(); runTest();
    });
    $root.find('.na_kw2_save').on('click', function () { $(this).closest('dialog').find('.popup-button-ok').trigger('click'); });
    $root.find('.na_kw2_unlink').on('click', function () {
        $in.val('');
        $root.find('.na_kw2_add').val('');
        $(this).closest('dialog').find('.popup-button-ok').trigger('click');
    });
    const runTest = () => {
        const text = $root.find('.na_kw_tin').val();
        const withRecent = $root.find('.na_kw_trecent input').prop('checked');
        const $out = $root.find('.na_kw_tout');
        if (!text.trim() && !withRecent) return $out.empty();
        const list = split($in.val());
        if (!list.length) return $out.html('<div class="na_kwt_row na_kwt_wait"><i class="fa-solid fa-circle"></i><div class="na_kwt_main">위에 키워드를 먼저 넣어 주세요.</div></div>');
        const src = `${text}\n${withRecent && depth > 1 ? recentChatText(m, depth - 1) : ''}`;
        const hits = linkHits(list, src.toLowerCase());
        $out.html(`<div class="na_kwt_row ${hits.length ? 'na_kwt_on' : 'na_kwt_wait'}">
            <i class="fa-solid ${hits.length ? 'fa-circle-check' : 'fa-circle'}"></i>
            <div class="na_kwt_main">
              <div><b>${hits.length ? '호출됨' : '호출 안 됨'}</b>${hits.length ? ` · ${hits.map(esc).join(', ')}` : ' · 넣은 키워드가 문장에 없어요'}</div>
              ${hits.length ? `<div class="na_kwt_where">${hits.map(w => `<div>${kwSnippet(src, w)}</div>`).join('')}</div>` : ''}
            </div></div>`);
    };
    let tt;
    $root.find('.na_kw_tin').on('input', () => { clearTimeout(tt); tt = setTimeout(runTest, 150); });
    $root.find('.na_kw_trecent input').on('change', runTest);
    $in.on('input', mark);
    $in.on('input', runTest);
    $root.on('click', '.na_pchip[data-w], .na_kw2_word, .na_kw_addall', () => setTimeout(runTest));
    $root.find('.na_kw_ai').on('click', async function () {
        const others = parseSections(m.text).filter(x => !x.group && x.start !== s.start && x.title !== '(머리말)').map(x => `- ${x.title}`).slice(-80).join('\n');
        const broad = [...new Set([...an.broad.map(r => r.show), ...an.distinct.filter(r => r.chat > 0.15).map(r => r.show)])].join(', ') || '(none)';
        const prompt = `[SECTION TITLE]\n${s.title}\n\n[SECTION]\n${body.trim()}\n\n[BROAD TERMS — appear in most sections or most chat messages; do not use]\n${broad}\n\n[OTHER SECTIONS — for contrast; prefer words that set this one apart]\n${others}`;
        const out = await withSpinner($(this), '고르는 중…', () => askAI(prompt, { system: AI_SYS_KEYWORDS, maxTokens: 2000 }));
        if (out === null) return;
        const concepts = out.split('\n').map(l => l.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, '').trim()).filter(l => l.includes('|')).map(l => {
            const parts = l.split('|').map(x => x.trim());
            const [topic, en, ko, why] = parts.length >= 4 ? parts : ['', ...parts];
            return { topic: topic.replace(/^[*_]+|[*_]+$/g, ''), words: [...new Set([...split(en), ...split(ko || '')])], why: why || '' };
        }).filter(x => x.words.length);
        // a model that ignored the format: take one comma line
        if (!concepts.length) { const w = split(out.split('\n').filter(l => l.trim()).pop() || out).slice(0, 16); if (w.length) concepts.push({ words: w, why: '' }); }
        $root.find('.na_kw_aiout').html(concepts.length ? concepts.map(x => `
            <div class="na_kw_concept">
              <div class="na_kw2_chead">${x.topic ? `<b>${esc(x.topic)}</b>` : `<span class="na_kw2_words">${x.words.map(word).join(', ')}</span>`}
                <button type="button" class="na_kw_addall" title="이 줄 모두 넣기">모두</button></div>
              ${x.topic ? `<span class="na_kw2_words">${x.words.map(word).join(', ')}</span>` : ''}
              ${x.why ? `<small class="na_kw2_why">${esc(x.why)}</small>` : ''}
            </div>`).join('') : '<span class="na_v2_note">제안이 없어요.</span>');
        mark();
    });
    mark();
    const r = await c.callGenericPopup($root, c.POPUP_TYPE.CONFIRM, '', { wide: true, allowVerticalScrolling: true, okButton: '저장', cancelButton: '취소' });
    if (r !== c.POPUP_RESULT.AFFIRMATIVE && r !== true) return null;
    addTyped();
    return split($in.val());
}

// where a keyword hit in `src`, so "Set" matching inside "settle" is easy to spot
export function kwSnippet(src, w) {
    const i = src.toLowerCase().indexOf(String(w).toLowerCase());
    if (i < 0) return '';
    const a = Math.max(0, i - 14), b = Math.min(src.length, i + w.length + 14);
    const inWord = /[A-Za-z]/.test(src[i - 1] || '') || /[A-Za-z]/.test(src[i + w.length] || '');
    return `${a ? '…' : ''}${esc(src.slice(a, i))}<mark>${esc(src.slice(i, i + w.length))}</mark>${esc(src.slice(i + w.length, b))}${b < src.length ? '…' : ''}`
        + (inWord ? ` <span class="na_kwt_warn"><i class="fa-solid fa-triangle-exclamation"></i> 다른 단어 속에서 걸렸어요</span>` : '');
}

export async function openKeywordTest() {
    const c = ctx();
    const m = getMeta();
    const depth = Math.max(1, Number(m.linkDepth) || 4);
    const $root = $(`
      <div class="na_popup">
        <div class="na_block_head"><div>
          <h4>키워드 테스트</h4>
          <p>문장을 넣으면 🔑 키워드 연동한 섹션 중 어떤 게 불려 오는지 보여 줘요. 실제 주입은 바뀌지 않아요.</p>
        </div></div>
        <textarea class="text_pole na_kwt_in" rows="3" placeholder="예: 그 지도 아직 갖고 있어?"></textarea>
        <label class="checkbox_label"><input type="checkbox" class="na_kwt_recent"><span>최근 메시지 ${depth - 1}개도 같이 (이 문장을 다음 메시지로 보낸다고 치기)</span></label>
        <div class="na_kwt_out"></div>
      </div>`);
    const linked = Object.entries(linkedMap(m)).filter(([, k]) => Array.isArray(k) && k.length);
    const keys = new Set(parseSections(m.text).map(sectionKey));
    const muted = mutedSet(m);
    const render = () => {
        if (!linked.length) return $root.find('.na_kwt_out').html('<div class="na_empty">키워드 연동한 섹션이 없어요. 아카이브 탭의 섹션 카드에서 카드를 펼쳐 🔑를 눌러 키워드를 정하세요.</div>');
        const text = $root.find('.na_kwt_in').val();
        const withRecent = $root.find('.na_kwt_recent').prop('checked');
        const hay = `${text}\n${withRecent && depth > 1 ? recentChatText(m, depth - 1) : ''}`.toLowerCase();
        const rows = linked.map(([key, ks]) => {
            const hits = text.trim() || withRecent ? linkHits(ks, hay) : [];
            const off = muted.has(key), gone = !keys.has(key);
            const state = gone ? 'gone' : off ? 'off' : hits.length ? 'on' : 'wait';
            return { key, ks, hits, state };
        }).sort((a, b) => ['on', 'wait', 'off', 'gone'].indexOf(a.state) - ['on', 'wait', 'off', 'gone'].indexOf(b.state));
        const label = { on: '호출됨', wait: '호출 안 됨', off: '스위치 꺼짐', gone: '섹션 없음' };
        const icon = { on: 'fa-circle-check', wait: 'fa-circle', off: 'fa-power-off', gone: 'fa-circle-question' };
        const where = w => kwSnippet(`${text}\n${withRecent && depth > 1 ? recentChatText(m, depth - 1) : ''}`, w);
        $root.find('.na_kwt_out').html(rows.map(r => `
            <div class="na_kwt_row na_kwt_${r.state}">
              <i class="fa-solid ${icon[r.state]}"></i>
              <div class="na_kwt_main">
                <div><b>${label[r.state]}</b> · ${esc(keyLabel(r.key))}</div>
                <div class="na_kwt_keys">${r.ks.map(w => `<span class="na_kwt_key ${r.hits.includes(w) ? 'hit' : ''}">${esc(w)}</span>`).join('')}</div>
                ${r.state === 'on' ? `<div class="na_kwt_where">${r.hits.map(w => `<div>${where(w)}</div>`).join('')}</div>` : ''}
              </div>
            </div>`).join(''));
    };
    let t;
    $root.find('.na_kwt_in').on('input', () => { clearTimeout(t); t = setTimeout(render, 150); });
    $root.find('.na_kwt_recent').on('change', render);
    render();
    await c.callGenericPopup($root, c.POPUP_TYPE.TEXT, '', { wide: true, large: false, allowVerticalScrolling: true, leftAlign: true, okButton: '닫기' });
}

// ---- keyword candidates (no AI): capitalised words that keep coming back in a section

export const KW_STOP = new Set(('The A An And But Or Nor If When Then After Before While As At In On Of To For From With Without Into Onto Upon By '
    + 'He She They It We I You His Her Hers Their Its Our My Your Him Them Us Me This That These Those There Here What Who Whom Whose Why How Where Which '
    + 'Not No Yes So Yet Once Still Even Only Also Both Each Every All Some Any None One Two Three Four Five First Second Last Next '
    + 'Day Night Morning Evening Afternoon Dawn Noon Midnight Today Tomorrow Yesterday Mr Mrs Ms Lord Lady Sir '
    + 'Was Were Is Are Be Been Had Has Have Did Does Do Will Would Could Should Can May Might Must Just Now Never Always Again').split(/\s+/));

export const capWords = text => [...String(text).matchAll(/\b[A-Z][a-z][A-Za-z'’]*/g)].map(x => x[0].replace(/['’]s$/, '')).filter(w => w.length > 2 && !KW_STOP.has(w));

// Ranks words of one section by how much they belong to it: frequent here, rare in the other sections,
// and not in most chat messages (a keyword that is everywhere keeps the section always on).
export const KW_STOP_LOW = new Set([...KW_STOP].map(w => w.toLowerCase()).concat(('about above across against along among around away back because being below beside '
    + 'between beyond could down during else ever every from further give gave given going gone have having into itself just keep kept know knew '
    + 'last left less like made make more most much must near need never only other others over own rather same said says seem seemed shall since '
    + 'some something still such than that their them then there these they thing things think thought those though through till under until upon '
    + 'very want wanted were what when where which while whom will with within without would your yours herself himself themselves '
    + 'asked told took take come came went look looked felt feel turned turn tell telling let used once both each even also only again '
    + 'plot state open note true never ever already '
    // everyday scene words: in almost any chat, so they would keep a section on
    + 'inside outside whole part bring brought held hold mind voice eyes face hand hands body head room night morning '
    + 'bed kiss kissed smile smiled laugh laughed looked moment time times today away side front behind word words '
    + 'answer answered someone anyone everyone nothing anything everything people place thing others while').split(/\s+/)));

export const KW_DET = /^(?:a|an|the|his|her|their|my|your|our|its|this|that|these|those|no|any|some|one|two|three|four|five|first|second|every|each)$/;

export function kwTerms(text) {
    const out = [];
    for (const chunk of String(text).split(/[.,;:!?()\[\]{}"“”—–→←·|\n]+/)) {
        const raw = chunk.match(/[A-Za-z][A-Za-z'’-]*/g) || [];
        let prev = null, before = '';
        for (const r0 of raw) {
            const w = r0.replace(/['’]s$/i, '');
            const low = w.toLowerCase();
            const cap = /^[A-Z]/.test(w);
            const ok = !KW_STOP_LOW.has(low) && (low.length >= 4 || (cap && low.length >= 3));
            // after "a / the / her / god's / three ..." it is most likely a noun: a thing that gets talked about
            const noun = KW_DET.test(before) || /['’]s$/i.test(before);
            if (ok) out.push({ t: low, show: w, noun });
            before = r0.toLowerCase();
            if (ok && prev) out.push({ t: `${prev.t} ${low}`, show: `${prev.show} ${w}`, bi: true });
            prev = ok ? { t: low, show: w } : null;
        }
    }
    return out;
}

export function keywordAnalysis(m, s, body) {
    const secs = parseSections(m.text).filter(x => !x.group && x.title !== '(머리말)' && x.title !== '(제목 없음)');
    const N = Math.max(1, secs.length);
    const df = new Map();
    for (const x of secs) for (const t of new Set(kwTerms(m.text.slice(x.start, x.end)).map(y => y.t))) df.set(t, (df.get(t) || 0) + 1);
    const tf = new Map(), shown = new Map(), nouns = new Set();
    for (const y of kwTerms(body)) {
        tf.set(y.t, (tf.get(y.t) || 0) + 1);
        if (y.noun) nouns.add(y.t);
        const sv = shown.get(y.t) || new Map();
        sv.set(y.show, (sv.get(y.show) || 0) + 1);
        shown.set(y.t, sv);
    }
    // the title's subject ("I want a child") counts; its range and the "(date, place)" note do not
    const subject = s.title.replace(RANGE_HEAD, '$5').replace(/^\s*[—–-]\s*/, '').replace(/\([^)]*\)/g, ' ');
    const inTitle = new Set(kwTerms(subject).map(y => y.t));
    const inNote = new Set(kwTerms((s.title.match(/\(([^)]*)\)/g) || []).join(' ')).map(y => y.t));
    const stat = keywordStats(m);
    const rows = [...tf.keys()].map(t => {
        const d = df.get(t) || 1;
        const chat = stat.chatPct(t);
        const bi = t.includes(' ');
        let score = tf.get(t) * Math.log((N + 1) / (d + 0.5)) * (inTitle.has(t) ? 2.5 : 1) * (bi ? 0.8 : 1);
        if (bi && tf.get(t) < 2 && !inTitle.has(t)) score *= 0.3;
        if (inNote.has(t) && !inTitle.has(t)) score *= 0.4; // a place or date from the title's note
        if (!bi && /(?:ed|ing)$/.test(t) && !inTitle.has(t)) score *= 0.35; // verbs make poor triggers
        if (!bi && /ly$/.test(t)) score *= 0.3;
        if (nouns.has(t)) score *= 1.8;
        const show = [...shown.get(t)].sort((x, y) => y[1] - x[1])[0][0];
        const broad = (N >= 4 && d / N > 0.3) || chat > 0.2;
        return { t, show, tf: tf.get(t), df: d, chat, score, broad, title: inTitle.has(t), noun: nouns.has(t) };
    });
    // "child" covers "children": keep the shorter stem when both are candidates
    const keep = rows.filter(r => !rows.some(o => o !== r && !o.t.includes(' ') && o.t.length >= 4 && r.t.startsWith(o.t) && r.t !== o.t && !r.t.includes(' ')));
    const distinct = keep.filter(r => !r.broad && (r.tf >= 2 || r.title || r.noun) && !(r.t.includes(' ') && r.tf < 2 && !r.title)).sort((a, b) => b.score - a.score).slice(0, 12);
    const broad = keep.filter(r => r.broad && !r.t.includes(' ')).sort((a, b) => b.tf - a.tf).slice(0, 8);
    return { distinct, broad, N, stat };
}

// how often a keyword would fire: share of chat messages containing it, sections mentioning it
export function keywordStats(m) {
    const msgs = (ctx().chat || []).filter(Boolean).map(x => String(x.mes || '').toLowerCase());
    const secs = parseSections(m.text).filter(x => !x.group);
    const secTexts = secs.map(x => m.text.slice(x.start, x.end).toLowerCase());
    const cache = new Map();
    const chatPct = w => {
        const k = String(w).toLowerCase();
        if (!k || !msgs.length) return 0;
        if (!cache.has(k)) cache.set(k, msgs.filter(x => x.includes(k)).length / msgs.length);
        return cache.get(k);
    };
    const secCount = w => { const k = String(w).toLowerCase(); return secTexts.filter(x => x.includes(k)).length; };
    // share of messages where any of `list` shows up
    const fireRate = list => {
        const ks = list.map(w => String(w).toLowerCase()).filter(Boolean);
        return msgs.length && ks.length ? msgs.filter(x => ks.some(k => x.includes(k))).length / msgs.length : 0;
    };
    return { chatPct, secCount, fireRate, msgs: msgs.length, secs: secs.length };
}

export const pct = x => x >= 0.995 ? '100%' : x > 0 && x < 0.01 ? '<1%' : `${Math.round(x * 100)}%`;

// warnings for one keyword as the matcher sees it
export function keywordWarn(w, stat) {
    const k = String(w).trim();
    const out = [];
    const chat = stat.chatPct(k);
    if (chat > 0.3) out.push(`채팅 메시지 ${pct(chat)}에 나와요 — 거의 항상 켜져요`);
    else if (chat > 0.15) out.push(`채팅 메시지 ${pct(chat)}에 나와요 — 자주 켜져요`);
    if (/^[A-Za-z]{1,3}$/.test(k)) out.push('짧은 영어 단어라 다른 단어 속에서도 걸려요 (Set → settle)');
    if (/^[가-힣]$/.test(k)) out.push('한 글자라 다른 말 속에서도 걸려요');
    if (stat.secs >= 4 && stat.secCount(k) / stat.secs > 0.5) out.push(`섹션 ${stat.secs}개 중 ${stat.secCount(k)}개에 나오는 말이에요`);
    return out;
}

// ---- spelling near-misses (no AI): a name in the new text that is one or two letters off a name in the archive

export function editDistance(a, b, cap) {
    if (Math.abs(a.length - b.length) > cap) return cap + 1;
    let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
    for (let i = 1; i <= a.length; i++) {
        const cur = [i];
        let best = i;
        for (let j = 1; j <= b.length; j++) {
            cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
            if (cur[j] < best) best = cur[j];
        }
        if (best > cap) return cap + 1;
        prev = cur;
    }
    return prev[b.length];
}

export function nameNearMisses(archive, add) {
    const old = new Set(capWords(archive).filter(w => w.length >= 4));
    const byFirst = new Map();
    old.forEach(w => { const k = w[0]; if (!byFirst.has(k)) byFirst.set(k, []); byFirst.get(k).push(w); });
    const out = [];
    for (const w of new Set(capWords(add).filter(x => x.length >= 4))) {
        if (old.has(w)) continue;
        const cap = w.length >= 7 ? 2 : 1;
        let hit = null, hd = cap + 1;
        for (const o of byFirst.get(w[0]) || []) {
            const d = editDistance(w, o, cap);
            if (d > 0 && d < hd) { hit = o; hd = d; }
        }
        if (hit) out.push({ word: w, like: hit });
    }
    return out;
}

export const AI_SYS_KEYWORDS = `GOAL
Choose trigger keywords for ONE section of a role-play story archive.
This section stays out of the prompt until one of its keywords appears in the recent chat. So a good keyword shows up in chat exactly when this section's events matter again, and rarely at other times.

YOU GET
- SECTION TITLE and SECTION: the section to pick keywords for.
- BROAD TERMS: words that appear almost everywhere. Never use them.
- OTHER SECTIONS: titles of the rest of the archive. Prefer words that set THIS section apart from them.

STEPS
1. List the 2–5 events or topics this section records: an event, object, place, promise, wound or secret. Most important first.
2. For each topic, think: what words would a character actually say when this comes up again?
3. Drop bad keywords:
   - main cast names, and anything under BROAD TERMS
   - everyday words that are in most scenes: bed, night, kiss, room, love, eat, hand, look
   - very short English words that hide inside other words ("Set" also fires on "settle", "sunset")
   - one-syllable Korean stems
4. Shape them for matching. Matching is a plain, case-insensitive "contains" search over the raw chat text, which may be English or Korean.
   - English: the shortest stem that is still specific. "map" also matches "maps"; "treasur" matches "treasure" and "treasury"; "betray" matches "betrayal" and "betrayed".
   - Korean: the forms a Korean chat would really use, as stems without particles (지도, 보물, 배신), plus common synonyms.
5. Give each topic a short Korean name and a short Korean reason.

EXAMPLE
SECTION TITLE: #12–#15 — The bridge (Spring 3, Varo)
SECTION:
- Ren and Mara cross the old bridge at dusk. A plank breaks; Ren cuts his leg and Mara pulls him up: "Now you owe me."
- Ivo waits with the horses: the duke has closed the south road, so they go through Varo's market.
BROAD TERMS: Ren, Mara, Ivo, night
Answer:
무너진 다리 | bridge, plank | 다리, 널빤지 | 다리에서 다친 사건
진 빚 | owe, debt | 빚, 갚 | "Now you owe me" 약속
막힌 남쪽 길 | south road, duke | 남쪽 길, 공작 | 길이 막혀 돌아간 이유

OUTPUT
2 to 5 lines, one per topic, most important first, nothing else, exactly like this:
<topic name, in Korean, under 12 characters> | <english stem>, <english stem> | <korean form>, <korean form> | <why it fits, in Korean, under 25 characters>`;
