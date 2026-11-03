// Every screen the CSS harness captures. A scene = { name, arch, root, open(p, h) }.
//   arch: 'full' (an archive with 4 sections), 'empty' (no archive) or 'studio' (an archive + a studio in progress)
//   root: the CSS selector the screenshot and the style dump are taken inside
//   open: puts the screen on the page; h has B (module base url), fake AI text, and small helpers
const B = '/scripts/extensions/third-party/NarrativeArchive/src/';
const S = [['6', '15', 'The glade', 'Oct 25, morning, Forest'], ['16', '22', 'Night falls', 'Oct 25, night, Camp'], ['23', '29', 'The river', 'Oct 26, River ford']];
const sec = ([a, b, t, d]) => `## #${a}–#${b} — ${t} (${d})\nPLOT:\n- Seraphina and Mara walk into ${t.toLowerCase()} (#${+a + 1}).\n- "The night is calm," Seraphina said (#${+a + 3}).\n- Mara hides the silver map under her coat (#${b}).\n`;
const ARCH = `## #0–#5 — Start (Oct 24, evening, Village)\nPLOT:\n- Seraphina meets the traveler (#2).\n\n` + S.map(sec).join('\n') + `\n---\n# STATE AT #29\n## Seraphina\n- Guarding the glade.\n# OPEN\n- Who left the map?`;
// what the fake model answers, by what the prompt asks for (same as the scratch scripts that drew the mockups)
const answer = body => {
    if (body.includes('current title:')) return '[1] | The traveler arrives\n[2] | Into the glade\n[3] | Fire and quiet\n[4] | Crossing the ford';
    if (body.includes('[RAW LOG]') && body.includes('[SUMMARY]')) return '- 지어냄: Mara가 지도를 코트 밑에 숨겼다고 했지만 원문에는 없어요 (#15)\n- 틀림: "The night is calm"은 Mara가 아니라 Seraphina가 한 말이에요 (#9)\n- 빠짐: 둘이 강을 건너기로 정한 대목이 없어요 (#22)';
    if (body.includes('MESSAGES #')) return '#6 숲으로 들어감\n#16 밤, 야영\n#23 강 건너기';
    return '## #6–#22 — The glade at nightfall (Oct 25, Forest → Camp)\nPLOT:\n- Seraphina and Mara walk into the glade (#7).\n- "The night is calm," Seraphina said (#9).\n- They make camp as night falls (#17).\n- Mara hides the silver map under her coat (#21).';
};
const DLG = 'dialog.popup[open]';
// click by script: the harness only needs the handler to run, and Playwright's own click waits on overlays (toasts, a closing dialog) that are not part of the look
const tap = async (p, sel) => { await p.waitForSelector(sel, { timeout: 8000 }); await p.$eval(sel, e => e.click()); };
const openMod = (p, mod, fn, arg) => { p.evaluate(async ([B, mod, fn, arg]) => { try { await (await import(B + mod))[fn](arg); } catch (e) { console.warn('open', fn, e.message); } }, [B, mod, fn, arg]).catch(() => {}); return p.waitForSelector(DLG, { timeout: 8000 }).then(() => p.waitForTimeout(900)); };
const win = (name, mod, fn, arch = 'full') => ({ name, arch, root: DLG, open: p => openMod(p, mod, fn) });
const studioAt = async (p, stage) => {
    await p.evaluate(async ([B, stage, S]) => {
        const core = await import(B + 'core.js'); const m = core.getMeta(); const now = 1761480000000;
        const scenes = [{ a: 6, b: 15, note: 'The glade · 숲에서 만남' }, { a: 16, b: 22, note: 'Night falls · 야영' }, { a: 23, b: 29, note: 'The river · 강 건너기' }];
        const turns = [{ role: 'user', kind: 'scene', scene: 0, at: now }, { role: 'assistant', scene: 0, text: S[0], at: now }];
        if (stage >= 3) turns.push({ role: 'user', kind: 'talk', text: 'Mara 대사는 원문 그대로 옮겨 줘', at: now }, { role: 'assistant', text: S[0].replace('"The night is calm,"', '"Die Nacht ist ruhig,"'), at: now });
        if (stage >= 4) turns.push({ role: 'user', kind: 'scene', scene: 1, at: now }, { role: 'assistant', scene: 1, text: S[1], at: now }, { role: 'user', kind: 'scene', scene: 2, at: now }, { role: 'assistant', scene: 2, text: S[2], at: now });
        m.studio = { from: 6, to: 29, keepUpTo: -1, at: now, auto: false, scenes, turns, secs: [], changes: '' }; await core.saveMeta();
    }, [B, stage, S.map(sec)]);
    p.evaluate(async ([B]) => { (await import(B + 'studio.js')).openStudio(); }, [B]).catch(() => {});
    await p.waitForSelector(`${DLG} .na_st`, { timeout: 20000 }); await p.waitForTimeout(1500);
};
const SCENES = [
    // --- the windows as they open ---
    win('quotes', 'quotes.js', 'openQuotes'), win('knowledge', 'knowledge.js', 'openKnowledge'), win('drift', 'drift.js', 'openDrift'), win('branches', 'branches.js', 'openBranches'),
    win('wizard', 'wizard.js', 'openWizard'), win('au', 'wizard.js', 'openAuSettings'), win('extract', 'extract.js', 'openExtract'), win('calendar', 'calendar.js', 'openCalendar'),
    win('people', 'people.js', 'openPeople'), win('worlds', 'world.js', 'openWorlds'), win('health', 'health.js', 'openHealth'), win('ask', 'ask.js', 'openAsk'),
    win('preview', 'preview.js', 'openPreview'), win('xray', 'xray.js', 'openXray'), win('retitle', 'retitle.js', 'openRetitle'), win('merge', 'retitle.js', 'openMerge'),
    win('stylesamples', 'scenes.js', 'openStyleSamples'), win('worknote', 'scenes.js', 'openWorkNote'), win('digest', 'digest.js', 'openDigest'), win('glossary', 'translate.js', 'openGlossary'),
    win('unhide', 'hide.js', 'openUnhide'), win('kwtest', 'keywords.js', 'openKeywordTest'),
    // --- empty (no archive yet): the welcome cards ---
    win('quotes-empty', 'quotes.js', 'openQuotes', 'empty'), win('knowledge-empty', 'knowledge.js', 'openKnowledge', 'empty'), win('people-empty', 'people.js', 'openPeople', 'empty'),
    win('drift-empty', 'drift.js', 'openDrift', 'empty'), win('branches-empty', 'branches.js', 'openBranches', 'empty'), win('xray-empty', 'xray.js', 'openXray', 'empty'),
    // --- results and later steps ---
    { name: 'layers', arch: 'full', root: DLG, open: async p => { await p.evaluate(async ([B]) => { const S = await import(B + 'sections.js'); const core = await import(B + 'core.js'); const s = S.parseSections(core.getMeta().text).find(x => x.title.includes('glade')); const m = core.getMeta(); m.fadeForce = {}; m.layers = m.layers || {}; m.layers[S.sectionKey(s)] = { short: 'PLOT:\n- Seraphina and Mara enter the glade (#7); she calls the night calm (#9).', line: '- Mara hides the silver map (#15).' }; (await import(B + 'fade.js')).openLayers(s); }, [B]); await p.waitForSelector(DLG); await p.waitForTimeout(900); } },
    { name: 'layers-long', arch: 'full', root: DLG, open: async p => { await p.evaluate(async ([B]) => { const S = await import(B + 'sections.js'); const core = await import(B + 'core.js'); const s = S.parseSections(core.getMeta().text).find(x => x.title.includes('glade')); const m = core.getMeta(); m.fadeForce = {}; m.layers = m.layers || {}; m.layers[S.sectionKey(s)] = { short: 'PLOT:\n- Seraphina and Mara enter the glade (#7); she calls the night calm (#9).', line: '- Mara hides the silver map (#15).' }; (await import(B + 'fade.js')).openLayers(s); }, [B]); await p.waitForSelector(DLG); await p.waitForTimeout(900); await p.evaluate(() => document.querySelector('dialog.popup[open] .na_ly3_card[data-t="long"]').click()); await p.waitForTimeout(400); } },
    { name: 'layers-line', arch: 'full', root: DLG, open: async p => { await p.evaluate(async ([B]) => { const S = await import(B + 'sections.js'); const core = await import(B + 'core.js'); const s = S.parseSections(core.getMeta().text).find(x => x.title.includes('glade')); const m = core.getMeta(); m.fadeForce = {}; m.layers = m.layers || {}; m.layers[S.sectionKey(s)] = { short: 'PLOT:\n- Seraphina and Mara enter the glade (#7); she calls the night calm (#9).', line: '- Mara hides the silver map (#15).' }; (await import(B + 'fade.js')).openLayers(s); }, [B]); await p.waitForSelector(DLG); await p.waitForTimeout(900); await p.evaluate(() => document.querySelector('dialog.popup[open] .na_ly3_card[data-t="line"]').click()); await p.waitForTimeout(400); } },
    { name: 'layers-edit', arch: 'full', root: DLG, open: async p => { await p.evaluate(async ([B]) => { const S = await import(B + 'sections.js'); const core = await import(B + 'core.js'); const s = S.parseSections(core.getMeta().text).find(x => x.title.includes('glade')); const m = core.getMeta(); m.fadeForce = {}; m.layers = m.layers || {}; m.layers[S.sectionKey(s)] = { short: 'PLOT:\n- Seraphina and Mara enter the glade (#7); she calls the night calm (#9).', line: '- Mara hides the silver map (#15).' }; (await import(B + 'fade.js')).openLayers(s); }, [B]); await p.waitForSelector(DLG); await p.waitForTimeout(900); await p.evaluate(() => document.querySelector('dialog.popup[open] .na_ly3_card[data-t="short"]').click()); await p.waitForTimeout(400); await p.evaluate(() => document.querySelector('dialog.popup[open] .na_ly_edit').click()); await p.waitForTimeout(400); } },
    { name: 'layers-empty', arch: 'full', root: DLG, open: async p => { await p.evaluate(async ([B]) => { const S = await import(B + 'sections.js'); const core = await import(B + 'core.js'); const s = S.parseSections(core.getMeta().text).find(x => x.title.includes('glade')); const m = core.getMeta(); m.fadeForce = {}; m.layers = m.layers || {}; m.layers[S.sectionKey(s)] = {}; (await import(B + 'fade.js')).openLayers(s); }, [B]); await p.waitForSelector(DLG); await p.waitForTimeout(900); } },
    { name: 'retitle-result', arch: 'full', root: DLG, open: async p => { await openMod(p, 'retitle.js', 'openRetitle'); await tap(p, `${DLG} .na_sp_go`); await p.waitForSelector(`${DLG} .na_rt_res:not([hidden])`, { timeout: 15000 }); await p.waitForTimeout(600); } },
    { name: 'merge-result', arch: 'full', root: DLG, open: async p => { await openMod(p, 'retitle.js', 'openMerge'); await tap(p, `${DLG} .na_mg_row:nth-child(2)`); await tap(p, `${DLG} .na_mg_row:nth-child(3)`); await tap(p, `${DLG} .na_mg_go`); await p.waitForSelector(`${DLG} .na_mg_res:not([hidden])`, { timeout: 15000 }); await p.waitForTimeout(600); } },
    { name: 'wizard-2', arch: 'full', root: DLG, open: async p => { await openMod(p, 'wizard.js', 'openWizard'); await p.evaluate(() => document.querySelector('dialog.popup[open] .na_wz2_progress button[data-s="2"]').click()); await p.waitForTimeout(600); } },
    { name: 'wizard-3', arch: 'full', root: DLG, open: async p => { await openMod(p, 'wizard.js', 'openWizard'); await p.evaluate(() => document.querySelector('dialog.popup[open] .na_wz2_progress button[data-s="2"]').click()); await p.fill(`${DLG} .na_wz_out`, S.map(sec).join('\n')); await p.evaluate(() => document.querySelector('dialog.popup[open] .na_wz2_progress button[data-s="3"]').click()); await p.waitForTimeout(600); } },
    { name: 'wizard-grade', arch: 'full', root: DLG, open: async p => { await openMod(p, 'wizard.js', 'openWizard'); await p.evaluate(() => document.querySelector('dialog.popup[open] .na_wz2_progress button[data-s="2"]').click()); await p.fill(`${DLG} .na_wz_out`, S.map(sec).join('\n')); await p.evaluate(() => document.querySelector('dialog.popup[open] .na_wz2_progress button[data-s="3"]').click()); await tap(p, `${DLG} .na_wz2_next`); await p.waitForSelector(`${DLG} .na_wz_gradeout:not([hidden])`, { timeout: 15000 }); await p.waitForTimeout(600); } },
    { name: 'ask-answer', arch: 'full', root: DLG, open: async p => { await openMod(p, 'ask.js', 'openAsk'); const q = await p.$(`${DLG} textarea, ${DLG} input[type=text]`); if (q) { await q.fill('Mara는 지도를 어디에 숨겼어?'); await p.keyboard.press('Enter'); await p.waitForTimeout(2500); } } },
    { name: 'studio-setup', arch: 'studio', root: DLG, open: async p => { p.evaluate(async ([B]) => { (await import(B + 'studio.js')).openStudio(); }, [B]).catch(() => {}); await p.waitForSelector(`${DLG} .na_qc`, { timeout: 20000 }); await p.waitForTimeout(900); } },
    { name: 'studio-2', arch: 'studio', root: DLG, open: p => studioAt(p, 2) },
    { name: 'studio-3', arch: 'studio', root: DLG, open: p => studioAt(p, 3) },
    { name: 'studio-4', arch: 'studio', root: DLG, open: p => studioAt(p, 4) },
    { name: 'studio-menu', arch: 'studio', root: DLG, open: async p => { await studioAt(p, 2); await tap(p, `${DLG} .na_st_dots`); await p.waitForTimeout(500); } },
    { name: 'studio-plus', arch: 'studio', root: DLG, open: async p => { await studioAt(p, 2); await tap(p, `${DLG} .na_st_plus`); await p.waitForTimeout(500); } },
    // --- short questions ---
    { name: 'confirm', arch: 'full', root: DLG, open: async p => { p.evaluate(async ([B]) => { (await import(B + 'util.js')).confirm('저장 안 한 고침', '짧은 버전 · 요점을 고친 게 있어요. 저장할까요?', '저장하기'); }, [B]).catch(() => {}); await p.waitForSelector(DLG); await p.waitForTimeout(600); } },
    { name: 'confirm-danger', arch: 'full', root: DLG, open: async p => { p.evaluate(async ([B]) => { (await import(B + 'util.js')).confirm('새로 시작', '이 작업실 대화와 받은 섹션을 지워요.', '지우기', { danger: true }); }, [B]).catch(() => {}); await p.waitForSelector(DLG); await p.waitForTimeout(600); } },
    // --- the extension panel, unfolded ---
    // --- the extension panel, unfolded: the drawer is taller than a phone screen, so it is shot as the viewport at two scroll positions ---
    { name: 'panel', arch: 'panel', root: '#na_settings', shot: 'page', open: (p, h) => h.panel(p, 0), close: p => tap(p, '#extensions-settings-button .drawer-icon') },
    { name: 'panel-2', arch: 'panel', root: '#na_settings', shot: 'page', open: (p, h) => h.panel(p, 800), close: p => tap(p, '#extensions-settings-button .drawer-icon') },
    // --- the phone (needs tools/dev/fakeph.mjs on :5555; the window scenes intercept that port, the phone talks to the real fake) ---
    { name: 'phone-home', arch: 'full', root: '.na_ph_frame', phone: true, open: async (p, h) => { await h.phone(p); } },
    { name: 'phone-home2', arch: 'full', root: '.na_ph_frame', phone: true, open: async (p, h) => { await h.phone(p); await h.phoneTo(p, 'home2'); } },
    { name: 'phone-bank', arch: 'full', root: '.na_ph_frame', phone: true, open: async (p, h) => { await h.phone(p); await h.phoneMoney(p); await h.phoneTo(p, 'bank'); } },
    { name: 'phone-wallet', arch: 'full', root: '.na_ph_frame', phone: true, open: async (p, h) => { await h.phone(p); await h.phoneMoney(p); await h.phoneTo(p, 'wallet'); } },
];
// block owner (as tools/dev/css-harness/blocks.cjs names them) → the scenes that show it; `capture.cjs --owner 섹션 버전` expands to these
const OWNERS = {
    '섹션 버전': ['layers', 'layers-long', 'layers-line', 'layers-edit', 'layers-empty'], '제목 다시 짓기 · 합치기': ['retitle', 'merge', 'retitle-result', 'merge-result'], '작업실': ['studio-setup', 'studio-2', 'studio-3', 'studio-4', 'studio-menu', 'studio-plus'],
    '압축 마법사 · AU': ['wizard', 'wizard-2', 'wizard-3', 'wizard-grade', 'au'], '원문 뽑기': ['extract'], '누가 아는가': ['knowledge', 'knowledge-empty'], '대사 은행': ['quotes', 'quotes-empty'],
    '말투 지문 · 인물': ['people', 'people-empty'], '이탈 감지 · 분기': ['drift', 'branches', 'drift-empty', 'branches-empty'], 'X-ray': ['xray', 'xray-empty'], '이야기 달력': ['calendar'], '키워드': ['kwtest'],
    '아카이브에 질문 · 고쳐 달라고': ['ask', 'ask-answer'], '요약 받기': ['digest'], '세계관': ['worlds'], '건강': ['health'], '미리보기': ['preview'], '섹션 고르기(공통)': ['quotes', 'knowledge', 'retitle'],
    '확인 팝업': ['confirm', 'confirm-danger'], '확장 패널': ['panel', 'panel-2'], '휴대폰': ['phone-home', 'phone-home2', 'phone-bank', 'phone-wallet'],
    '공통 부품': ['quotes', 'layers', 'retitle-result', 'wizard-2', 'extract', 'glossary', 'worknote', 'stylesamples', 'unhide', 'confirm', 'panel'],
};
module.exports = { SCENES, ARCH, answer, B, DLG, OWNERS };
