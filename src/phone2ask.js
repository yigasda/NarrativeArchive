// 폰 2 답장 요청의 입력 글 (docs/PHONE2-PLAN.md 단계 7-1). 답장 지시문(phone2reply.js)은 실험(run14)에서 이 모양의 입력으로
// 다듬어졌어요: 블록 이름 · 순서 · 줄 모양 · 구분 기호 · 시각 형식을 글자 그대로 지켜요(tests/phone2ask.test.mjs가 그때의
// 요청 하나와 글자 단위로 맞는지 봐요, tests/fixtures/phone2reply-input.txt). 이 파일은 아무것도 안 불러요: 이미 모은 값을
// 글로만 바꿔요(모으는 건 phone2live.js). 폰 1은 이 파일을 안 불러요.
//
// 블록 순서(있는 것만, 블록 사이는 빈 줄 하나): LANGUAGES · MESSENGER · CHAT SUMMARY · NOW · OWNER'S CLOCK · WEATHER NOW ·
// RECENT ON THE PHONE · SITUATIONS · [<주인>'s card] · VOICES · PEOPLE AROUND · OWNER DOESN'T KNOW · STORY ·
// TYPED AND DELETED · WHY NOW

const one = v => String(v ?? '').replace(/\s+/g, ' ').trim();
const list = v => (Array.isArray(v) ? v : []).map(one).filter(Boolean);
const end = v => one(v).replace(/[.。]+$/, '');

// [LANGUAGES]: the languages the owner texts in, and those they know but seldom use (none set: no block)
export function languagesBlock(owner, langs) {
    const texts = list(langs?.texts), knows = list(langs?.knows);
    if (!texts.length && !knows.length) return '';
    return ['[LANGUAGES]', one(owner), ...(texts.length ? [`- texts in: ${texts.join(', ')}`] : []), ...(knows.length ? [`- knows but seldom uses: ${knows.join(', ')}`] : [])].join('\n');
}
// [MESSENGER]: one line a bubble, newest last. Another's: "MM-DD HH:MM · Ren: words"; the owner's carries their status
// then: "MM-DD HH:MM · Mara (place · doing · ~until): words". rows: [{ at: "MM-DD HH:MM", from, text, state }]
export function messengerBlock(owner, rows) {
    const me = one(owner).toLowerCase();
    const lines = (Array.isArray(rows) ? rows : []).filter(x => one(x?.text)).map(x => `${one(x.at)} · ${one(x.from)}${one(x.from).toLowerCase() === me && one(x.state) ? ` (${one(x.state)})` : ''}: ${one(x.text)}`);
    return lines.length ? `[MESSENGER]\n${lines.join('\n')}` : '';
}
// [NOW]: one line. last: the owner's last status (no clock in it); today · ahead: calendar lines; recorded: what the
// phone last recorded; story: they knew each other in the story; first: no messenger talk between them yet
export function nowBlock(persona, { last = '', today = [], ahead = [], recorded = '', story = false, first = false } = {}) {
    const P = one(persona), t = list(today), a = list(ahead);
    return `[NOW]\n${[
        one(last) ? `Last status: ${end(last)}.` : '',
        `Calendar today: ${t.length ? t.join('; ') : 'none'}.`,
        a.length ? `Calendar ahead: ${a.join('; ')}.` : '',
        one(recorded) ? `Phone last recorded: ${end(recorded)}.` : '',
        story ? `You and ${P} have talked before in the story.` : `You and ${P} have not talked before.`,
        first ? 'This is your first chat on MESSENGER.' : '',
    ].filter(Boolean).join(' ')}`;
}
// [RECENT ON THE PHONE]: when each app was last used, newest first: today's as "HH:MM", an earlier day's as "MM-DD HH:MM".
// rows: [{ app, at: "MM-DD HH:MM" }] (an app twice: its newest), today: "MM-DD"
export function recentBlock(rows, today) {
    const by = new Map();
    for (const x of Array.isArray(rows) ? rows : []) {
        const app = one(x?.app).toLowerCase(), at = one(x?.at);
        if (!app || !/^\d{2}-\d{2} \d{2}:\d{2}$/.test(at)) continue;
        if (!by.has(app) || x.order > by.get(app).order) by.set(app, { app, at, order: Number(x.order) || 0 });
    }
    const out = [...by.values()].sort((a, b) => b.order - a.order).map(x => `${x.app} ${x.at.slice(0, 5) === today ? x.at.slice(6) : x.at}`);
    return out.length ? `[RECENT ON THE PHONE]\n${out.join(' · ')}` : '';
}
// [SITUATIONS]: matters still open: "- title: what. state: planned. known: …. open: …."
export function situationsBlock(rows) {
    const lines = (Array.isArray(rows) ? rows : []).filter(x => one(x?.title) && one(x?.what)).map(x =>
        `- ${one(x.title)}: ${end(x.what)}.${one(x.state) ? ` state: ${end(x.state)}.` : ''}${one(x.known) ? ` known: ${end(x.known)}.` : ''}${one(x.open) ? ` open: ${end(x.open)}.` : ''}`);
    return `[SITUATIONS]\n${lines.length ? lines.join('\n') : '(none on the phone yet)'}`;
}
// [VOICES]: how each person's words read in Korean ("- Lio: …", "- Mara → Ren: …")
export function voicesBlock(rows) {
    const lines = (Array.isArray(rows) ? rows : []).filter(v => one(v?.who) && one(v?.style)).map(v => `- ${one(v.who)}${one(v.to) ? ` → ${one(v.to)}` : ''}: ${one(v.style)}`);
    return lines.length ? `[VOICES]\n${lines.join('\n')}` : '';
}

// the whole input. d: { owner, persona, langs, messenger, summary, now, clock (the [OWNER'S CLOCK] block), weather (one
// line), recent, today, situations, card, voices, around (the [PEOPLE AROUND] block), blind (the [OWNER DOESN'T KNOW]
// block), story, typed: [words], why }
export function replyInput(d) {
    const O = one(d.owner), body = String(d.card ?? '').trim(), typed = list(d.typed);
    return [
        languagesBlock(O, d.langs),
        messengerBlock(O, d.messenger),
        one(d.summary) ? `[CHAT SUMMARY]\n${String(d.summary).trim()}` : '',
        nowBlock(d.persona, d.now),
        String(d.clock || '').trim(),
        one(d.weather) ? `[WEATHER NOW]\n${one(d.weather)}` : '',
        recentBlock(d.recent, d.today),
        situationsBlock(d.situations),
        body ? `[${O}'s card]\n${body}` : '',
        voicesBlock(d.voices),
        String(d.around || '').trim(),
        String(d.blind || '').trim(),
        String(d.story || '').trim() ? `[STORY]\n${String(d.story).trim()}` : '',
        typed.length ? `[TYPED AND DELETED]\n${typed.map(t => `- ${t}`).join('\n')}` : '',
        one(d.why) ? `[WHY NOW]\n${one(d.why)}` : '',
    ].filter(Boolean).join('\n\n');
}
