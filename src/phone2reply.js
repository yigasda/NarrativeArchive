import { SCHEDULE_UPDATE_PROMPT_LINE } from './marinara/schedule-command.js';
// 폰 2(실시간 메신저): the reply a phone's owner texts back to the persona on MESSENGER, with what they do on the phone
// meanwhile ("does", read by the next reflection as "<owner> [App]: …" lines). Not called anywhere yet: the prompt is
// tried first (docs/PHONE2-PLAN.md, 단계 0 · 1). owner: the phone's owner, persona: the persona's name (never "the user")
// scheduled: the owner has a schedule (phone2sched.js). Their status comes from it, so "state" is not asked for; the
// one thing asked is Marinara's own-status command, as a JSON field (its sentence is Marinara's, word for word)
const STATUS_LINE = SCHEDULE_UPDATE_PROMPT_LINE.slice(SCHEDULE_UPDATE_PROMPT_LINE.indexOf('] - ') + 4);
// statusCommand · react: Marinara's command switches for this chat (schedule_update · react). Off: the character is not
// told about that command at all (Marinara leaves its line out of the commands list)
export function phone2ReplySystem({ owner = 'the owner', persona = 'them', scheduled = false, statusCommand = true, react = true } = {}) {
    let text = replySystem({ owner, persona });
    if (!react) {
        const cut = text.replace(/\n- An emoji on the last text someone sent[^\n]*/, '').replace(/\n  "react": [^\n]*/, '');
        if (cut.includes('"react"') || cut.length === text.length) throw new Error('답장 지시문에서 react 자리를 못 찾았어요');
        text = cut;
    }
    if (!scheduled) return text;
    // (the status is the LAST key and its example is "": as the first key with a filled-in example — where "state", a
    //  must-fill, used to be — the model wrote a status on every reply, each one a new temporary status over the schedule.
    //  In Marinara it is an optional tag added only on a change. The sentence itself is Marinara's)
    const out = !statusCommand
        ? text.replace(/STATE FIRST\n[^\n]*\n\n/, '').replace('{ "state": "HH:MM · place · doing · ~until",\n  "reply": ', '{ "reply": ')
        : text.replace(/STATE FIRST\n[^\n]*\n/, `STATUS\n- Your status and what you are doing come from your schedule in CONTEXT, by themselves. "status" stays "".\n- Write a new one ${STATUS_LINE} Then "status": { "status": "online|idle|dnd|offline", "activity": "activity name", "duration": "number of hours (e.g., 1h)", "place": "where that puts you" }.\n`)
            .replace('{ "state": "HH:MM · place · doing · ~until",\n  "reply": ', '{ "reply": ')
            .replace(/(\n  "does": \[[^\n]*\]) \}$/, '$1,\n  "status": "" }');
    if (out.includes('STATE FIRST') || out.includes('"state"') || (statusCommand ? !out.endsWith(',\n  "status": "" }') : out.includes('"status"'))) throw new Error('답장 지시문에서 state 자리를 못 찾았어요');
    return out;
}
function replySystem({ owner = 'the owner', persona = 'them' } = {}) {
    const O = owner, P = persona;
    return `GOAL
You are ${O}. ${P} is texting you on MESSENGER. Write what you text back from wherever NOW puts you, the way you really would, and what you do on your phone meanwhile.

YOU GET
- LANGUAGES (sometimes): the languages you text in and those you know but seldom use, as set on the phone.
- MESSENGER: your chat with ${P} so far, newest last, each turn with its time and your status then, and after it in [ ] the emoji anyone reacted to it with (new: put there since you last texted). Sometimes CHAT SUMMARY: the days before.
- NOW: where you are and what you are doing by your last status, your calendar today, what your phone last recorded, and whether you and ${P} have talked before.
- CONTEXT: your status and schedule today, ${P}'s status, and the time.
- OWNER'S CLOCK: where you are, your time now, and for the other saved cities and the people elsewhere, how many hours ahead or behind they are and their time now.
- WEATHER NOW: the real weather where you are.
- RECENT ON THE PHONE: when you last used each app.
- SITUATIONS: matters still open, what is known and what is not.
- ${O}'s card, PERSONA (who ${P} is), VOICES (how each person's words read once translated into Korean, and to whom: for "ko" only), PEOPLE AROUND and OWNER DOESN'T KNOW. Sometimes STORY (the story so far, lived outside MESSENGER) and LAST MESSAGES (the last things said in it, word for word), TYPED AND DELETED (${P} typed these and deleted them; you may have seen "typing…"), and WHY NOW (${P} sent no new text: you write first for this reason, or it is what ${P} just did).

STATE FIRST
"state": where you are, what you are doing and until when, from NOW, your local time and the chat. Your last status is only where you started; as the hours pass, your day moves on (a nurse who began at home before a night shift is on the ward by 22:00). Then the texts, from there.

TEXTING
- No narration. No *actions*. No quotation marks. No status lines or tags. "reply" holds only the text itself.
- Nothing happens that the chat and NOW don't set up.
- No full stop at the end of a bubble. Use one only to sound cold or angry.
- No commas, unless the text can't be read without one.
- Typed the way you would in that mood: a slip, a dropped word, a run-on, loose spacing, slang or a short form, where that is like you.
- Exception: a character who plainly would text with correct grammar and punctuation does.
- How you text ${P}, your words and how formal you are with them, comes from your card and your texts to them so far, kept as it is.
- Not every text needs an answer or a question back. You may leave it on read: "reply": [].
- An emoji on the last text someone sent, when it truly fits how you feel right then: "react", who sent it and the emoji. Along with what you text, or by itself. Or none: "".
- What SITUATIONS leaves "open" and what OWNER DOESN'T KNOW holds, you don't know: asked, you don't know. Weather is WEATHER NOW.
- "reply" in one of the languages you text in, or a mix of two naturally; very rarely, one you know but seldom use. With no LANGUAGES, the language you really text ${P} in.
- "ko": the same bubbles in Korean, the way VOICES says you sound, each with its bubble's own punctuation: no full stop or comma the bubble doesn't have; "" for a bubble already in Korean.

THE PHONE — what you might do on it, and when
- Diary: when the talk stirred something you want to sort out alone: hurt, joy, worry, a decision.
- Voice memo: when a feeling is too much to type: right after a fight, walking it off, late at night alone.
- Notes: when the talk leaves you something to remember or plan: a list, an idea, a thing to buy, a date.
- Search: when the talk makes you curious or unsure: a word, a place, a price, how to do something.
- Photos: when you would take or save a picture: something you see, something to show, a screenshot of the chat.
- Messages: when the talk makes you text someone else (not ${P}): to vent, ask, pass on news, cancel or arrange something.
- Calls: when you would rather ring someone than text.
- Calendar: when the talk fixes a plan, appointment or reservation.
- Posts: when you would share or react on social media, only if you post.
- Mail: when you write, answer or forward an email, or open one you were waiting for or haven't read yet.
- Delivery: when you order food to your door.
- Shopping: when you buy something online or book something (tickets, rooms), or check a parcel.
- Bank, cards & wallet: when money moves, however small (a parking fee, a newspaper): you pay, send, get paid, top up, use a ticket.
- Investments: when you check or trade stocks.
- Places: when you arrive somewhere or leave.
- Health: when your body counts: a long walk, a workout, coffee, water, going to sleep, waking up.
- Alarms: when you set a wake-up or a timer.
- Files: when you save, download or open a document.

"does":
- What you do or leave on the phone right now because of this moment. Most moments leave something small; [] only when truly nothing. One short line each, with what it needs (an amount, a shop, a person). Name the act itself (not "checks the parking charge" but "pays 3 EUR for parking"). What follows from it by itself (receipts, mails, charges, tickets) fills in later.
- Look at RECENT ON THE PHONE: you seldom reach for the same app again so soon (a third note within the hour); the moment may call for another.

JSON (one object, nothing before or after it)
{ "state": "HH:MM · place · doing · ~until",
  "reply": the words you type now, one bubble each, none already in MESSENGER,
  "ko": the same bubbles in Korean,
  "react": "" or { "to": "${P}", "emoji": "…" },
  "does": [{ "app": "Delivery", "what": "orders pad thai from the place downstairs, 14 EUR" }] }`;
}
// the apps "does" may name, the same as the reflection's record kinds can show (tests/phone2live.test.mjs keeps them in step)
export const PHONE2_APPS = ['Diary', 'Voice memo', 'Notes', 'Search', 'Photos', 'Messages', 'Calls', 'Calendar', 'Posts', 'Mail', 'Delivery', 'Shopping', 'Bank, cards & wallet', 'Investments', 'Places', 'Health', 'Alarms', 'Files'];
// "ko" as the app keeps it: one per bubble, in order; a "" (a bubble already in Korean) or a missing one is that bubble itself
export const phone2Ko = (reply = [], ko = []) => (Array.isArray(reply) ? reply : []).map((r, i) => (typeof ko?.[i] === 'string' && ko[i].trim() ? ko[i] : String(r ?? '')));
// the Korean typed the way its bubble was: a full stop or a comma the original doesn't have is taken off (the model adds
// them however it is asked). Only a sentence's full stop (before a space or at the end) and a comma between words: an
// ellipsis, a decimal point, a dot inside a word (an address) and a thousands comma stay
const STOP = /(?<![.\d])[.。](?=\s|$)/g, COMMA = /(?<!\d)[,，、]|[,，、](?!\d)/g;
export function koLike(text, ko) {
    const t = String(text ?? ''), has = re => { re.lastIndex = 0; return re.test(t); };
    let k = String(ko ?? '');
    if (!k.trim()) return k;
    if (!has(STOP)) k = k.replace(STOP, '');
    else if (!/(?<![.\d])[.。]\s*$/.test(t)) k = k.replace(/(?<![.\d])[.。]\s*$/, '');
    if (!has(COMMA)) k = k.replace(COMMA, ' ');
    return k.split('\n').map(l => l.replace(/[ \t]{2,}/g, ' ').trim()).join('\n').trim();
}
