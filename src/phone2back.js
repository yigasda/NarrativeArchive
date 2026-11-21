// 폰 2(실시간) → 롤플: 메신저에서 나눈 이야기를 짧은 글로 적어 롤플 채팅 끝에 해설 메시지 하나로 넣어요
// (docs/PHONE2-PLAN.md "메신저 대화를 롤플에 전하기"). 저절로는 안 해요: 사람이 버튼을 누르고, 받은 글을 보고(고칠 수
// 있어요), "넣기"를 눌러야 들어가요. 한 번 전한 말은 다시 전하지 않아요(말마다 told 표시).
// 이 파일은 무엇을 전할지 고르고, 요청 글과 넣을 글을 만들고, 전했다고 표시만 해요. 모델을 부르고 롤플 채팅에 넣는 건
// 부르는 쪽(답장을 돌리는 파일)이 해요. 폰 1 · 아카이브는 읽지도 쓰지도 않아요. 폰 1은 이 파일을 부르지 않아요.

import { allRead } from './phone2room.js';
import { liveKey } from './phone2store.js';

// lines: 한 번에 전하는 말 수(오래된 것부터: 남은 건 다음에 이어서); tail: 같이 보여 주는 롤플의 끝 메시지(말투 · 언어를 맞추게); words: 글의 길이
export const BACK = { lines: 400, tail: { lines: 4, chars: 2000 }, words: 120, tokens: 1500 };

const one = v => String(v ?? '').replace(/\s+/g, ' ').trim();
// a message's words as the story is told them: what was typed, or that there was a call; '' for one with nothing said
// (a status change, something done on the phone)
const said = x => (x?.call ? `(call ${Math.max(0, Math.round(Number(x.call.min) || 0))} min)` : x?.act ? '' : one(x?.text));

// 아직 롤플에 안 전한 말: 방마다 [{ room, names, rows: [message] }], 말한 순서대로. 오래된 것부터 BACK.lines개까지
//   → { rooms, count, more (그보다 많아서 이번에 못 실은 새 말 수: 다음에 이어서 전해요) }
export function backLeft(w) {
    const all = Object.values(w?.messenger?.rooms || {}).flatMap(r => (r.messages || []).filter(x => !x.told && !x.copyOf && allRead(x) && said(x)).map(x => ({ r, x })));
    all.sort((a, b) => (a.x.at || 0) - (b.x.at || 0) || (a.x.n || 0) - (b.x.n || 0));
    const kept = all.slice(0, BACK.lines), by = new Map();
    for (const { r, x } of kept) { if (!by.has(r)) by.set(r, []); by.get(r).push(x); }
    return { rooms: [...by].map(([r, rows]) => ({ room: r.id, names: [...new Set([w.persona, ...(r.members || [])].map(one).filter(Boolean))], rows })), count: kept.length, more: all.length - kept.length };
}

// 요약 지시문. persona: 페르소나의 이름 (절대 "the user"가 아니에요)
export function phone2BackSystem({ persona = 'them' } = {}) {
    const P = persona;
    return `GOAL
The story's characters also text each other on a messenger, outside the scenes. Write what happened there as one short note for the story, so the next scene can go on knowing it.

YOU GET
- MESSENGER: the talk the story has not been told yet, room by room (a line of names heads each room), oldest first. Each line has its time; a character's line carries where they were and what they were doing then.
- LAST MESSAGES (sometimes): the story's last messages, as they were written.

THE NOTE
- Only what MESSENGER holds: what was said, asked, promised, refused, decided or found out, and where the characters were. What it leaves open stays open.
- Who said or did what, by name. ${P} is a person in the story like the others.
- Third person, past tense, one paragraph of plain prose: no quoted lines, no list, no heading.
- Times as the story would say them ("that night", "the next morning"): the messenger's dates and clock are not the story's.
- ${BACK.words} words at most; a few lines of talk need one sentence.

LANGUAGE
- The language LAST MESSAGES is written in. With no LAST MESSAGES, the language of MESSENGER.

JSON (one object, nothing before or after it)
{ "note": "…" }`;
}

// 요청 글. left: backLeft의 답; wall(ms) → "MM-DD HH:MM" (부르는 쪽의 시계); tail: 롤플의 끝 메시지들 (["[#n] 이름: 말", …])
export function backInput(w, left, { wall = () => '', tail = [] } = {}) {
    const P = liveKey(w?.persona);
    const rooms = (left?.rooms || []).map(({ names, rows }) => [`— ${names.join(' · ')} —`,
        ...rows.map(x => `${one(wall(x.at))} · ${one(x.from)}${liveKey(x.from) !== P && one(x.state) ? ` (${one(x.state)})` : ''}: ${said(x)}`)].join('\n'));
    const last = (Array.isArray(tail) ? tail : []).map(t => String(t ?? '').replace(/^\[#\d+[^\]\n]*\]\s*/, '').trim()).filter(Boolean);
    return [`[MESSENGER]\n${rooms.join('\n\n')}`, last.length ? `[LAST MESSAGES]\n${last.join('\n\n')}` : ''].filter(Boolean).join('\n\n');
}

// 모델의 답에서 글만: 없거나 비었으면 오류. parse: 답 글 → 객체
// (the object is the first { … } in the answer: a model often puts it in a ```json fence, or a line before it)
export function takeBack(answer, parse = JSON.parse) {
    const t = String(answer ?? ''), a = t.indexOf('{'), b = t.lastIndexOf('}');
    let got = null;
    try { got = a >= 0 && b > a ? parse(t.slice(a, b + 1)) : null; } catch { got = null; }
    const note = String(got?.note ?? '').replace(/\r\n/g, '\n').trim();
    if (!note) throw new Error('모델 답에서 전할 글을 찾지 못했어요');
    return note;
}

// 롤플 채팅에 넣을 메시지의 글: 어디서 온 글인지 알리는 첫 줄, 그 아래 글 (한국어 글이면 한국어 첫 줄)
export function backMessage(note) {
    const t = String(note ?? '').trim(), hangul = (t.match(/[가-힯]/g) || []).length, latin = (t.match(/[A-Za-z]/g) || []).length;
    return `*${hangul > latin * 0.3 ? '(그동안 메신저에서)' : '(Meanwhile, on the messenger)'}*\n\n${t}`;
}

// 전했다고 표시: 요청에 실었던 말들에 (그사이 새로 온 말은 안 건드려요). → 표시한 수
export function markTold(left, at = Date.now()) {
    let n = 0;
    for (const { rows } of left?.rooms || []) for (const x of rows) if (!x.told) { x.told = at; n++; }
    return n;
}
