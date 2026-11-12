// 폰 2 답장 요청의 입력 글 (7-1): 실험(run14)에서 답장 지시문을 다듬을 때 보낸 요청과 글자 단위로 같은 모양
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import * as A from '../src/phone2ask.js';

const want = await readFile(new URL('./fixtures/phone2reply-input.txt', import.meta.url), 'utf8');
const S = ['Lyon · in bed waking up to her text · ~07:00', 'Lyon · on the tram to the office, standing by the door · ~08:20', 'Varo Textiles office, Lyon · desk on the third floor, reading sales sheets · ~11:30',
    'Varo Textiles office, Lyon · desk on the third floor, taking a photo of the view · ~11:30', 'Varo Textiles office, Lyon · staff canteen, holding a coffee at a window table · ~13:15', 'Varo Textiles office, Lyon · staff canteen, window table with an empty cup · ~13:15'];
const R = (at, text) => ({ at: `11-06 ${at}`, from: 'Ren', text }), M = (at, i, text) => ({ at: `11-06 ${at}`, from: 'Mara', text, state: S[i] });
const sample = () => ({
    owner: 'Mara', persona: 'Ren', langs: { texts: ['French', 'English'], knows: ['Korean'] },
    messenger: [
        R('06:40', '딸 오늘 금요일이네 ㅎㅎ'), R('06:40', '출근하지? 엄마는 방금 시장 다녀왔어'),
        M('06:42', 0, 'Bonjour maman.'), M('06:42', 0, 'Oui, je me prépare pour le bureau.'), M('06:42', 0, "Tu as acheté quoi au marché ? Ne porte pas trop lourd, s'il te plaît."),
        R('07:55', '출근길이야?'), R('07:55', '아침은 먹었어? 커피만 마시지 말고'),
        M('07:55', 1, 'Je viens de monter dans le tram.'), M('07:55', 1, "J'ai mangé un petit truc, t'inquiète."), M('07:55', 1, "Bois de l'eau chaude toi aussi. Il y avait quoi au marché aujourd'hui ?"),
        R('09:30', '오늘 시장에서 사과가 엄청 싸더라 한 봉지에 만원이래 ㅎㅎ 그래서 두 봉지 샀어 너 오면 먹으라고 근데 생각해보니 너 사과 별로 안 좋아했나? 어릴 땐 하루에 세 개씩 먹었는데'),
        M('09:30', 2, "J'aime toujours les pommes."), M('09:30', 2, "Deux sacs ? Tu les as portés comment jusqu'à la maison ?"), M('09:30', 2, "Je t'ai dit de ne pas porter de choses lourdes."),
        R('11:10', '딸 사무실 창밖은 어떻게 생겼어?'), R('11:10', '사진 하나만 보내줘 엄마 궁금해 ㅎㅎ'),
        M('11:10', 3, "C'est tout gris aujourd'hui. Un vrai novembre lyonnais."), M('11:10', 3, 'Rien de passionnant, maman.'), M('11:10', 3, 'Mais si tu veux vraiment voir...'),
        R('12:40', '점심 먹었어?'), R('12:40', '뭐 먹었는지 엄마한테 보고해 ㅋㅋ'),
        M('12:40', 4, 'Je suis en train de déjeuner, maman.'), M('12:40', 4, 'Juste une quiche et un café.'), M('12:40', 4, 'Rien de spécial. Pas besoin de me surveiller comme une écolière.'),
        R('12:43', '그거 먹고 배불러? 또 대충 먹었지'),
        M('12:43', 5, 'Ça suffit largement pour midi.'), M('12:43', 5, 'Ce soir je mange un vrai repas, promis.'), M('12:43', 5, 'Chez toi il est presque neuf heures. Tu as dîné au moins ?'),
        R('14:00', '엄마 오늘 치과 다녀왔는데 의사가 다음 주에 한 번 더 오래'), R('14:00', '너 오는 주랑 겹치네 ㅠㅠ'),
    ],
    now: { last: S[5], today: [], ahead: ['11-09 17:45 flight to Seoul, lands 11-10 12:05 Seoul'], recorded: 'mail 11-06 06:10 from Air Lumen: "AL 208 Lyon → Incheon, Mon 11-09: upgrade to Business Class available" (opened 06:42)', story: true, first: false },
    clock: "[OWNER'S CLOCK]\nPhone owner: Mara\nLocation: Lyon\nTime now: 11-06 14:00 (Fri)\n\nTime differences from Lyon:\n- Ren (Seoul): +8 hours, now 11-06 22:00 (Fri)",
    weather: 'Lyon · 흐림 · 7° (최고 9° · 최저 3°) · 비 확률 20%',
    today: '11-06',
    recent: [{ app: 'Diary', at: '11-05 22:10', order: 1 }, { app: 'Voice memo', at: '11-05 23:05', order: 2 }, { app: 'Mail', at: '11-06 06:42', order: 3 }, { app: 'Places', at: '11-06 07:55', order: 4 },
        { app: 'Notes', at: '11-06 09:30', order: 5 }, { app: 'Photos', at: '11-06 11:10', order: 6 }, { app: 'Bank, cards & wallet', at: '11-06 12:40', order: 7 }, { app: 'Photos', at: '11-06 08:00', order: 3.5 }],
    situations: [
        { title: 'Flight to Seoul', what: 'Mon 11-09 17:45 CET, AL 208 Lyon → Incheon', state: 'planned', known: 'booked, mail and boarding pass on the phone' },
        { title: "Replacing Ivo's gifts", what: "you plan to buy your mother a new scarf at duty free and throw Ivo's package away.", state: 'planned', open: 'which scarf, whether you tell her' },
        { title: "Ren's dentist", what: 'her dentist wants to see her once more next week', state: 'planned', known: 'the dentist told her to come back next week', open: 'which day, what time' },
    ],
    card: '\n(카드 본문)\n',
    voices: [{ who: 'Lio', style: '극도로 절제된 격식체 존댓말, 짧은 명령형. 문장 끝에 마침표를 꼭 찍음. Ren에게는 이름을 부르며 조용한 어조로 반응함.' },
        { who: 'Mara', to: 'Ren', style: '엄마인 Ren에게 기본적으로 다정한 존댓말(~해요, 엄마)을 쓰지만, Ren이 잔소리를 하면 퉁명스러운 반말(~잖아, 됐어)로 툴툴거림. 프랑스어/영어 동시 사용' }],
    around: '[PEOPLE AROUND]\n- Ren: your mother, in Seoul.\n- Ivo: your ex; you lost interest long ago. Lately he has been sending your mother gifts and keeping in touch with her behind your back.\n- Lio Varo: your father, head of Varo Textiles.',
});

test('실험에서 보낸 요청과 글자 하나까지 같아요', () => {
    const got = A.replyInput(sample());
    if (got !== want) { const a = got.split('\n'), b = want.split('\n'), i = a.findIndex((l, k) => l !== b[k]); assert.equal(a[i], b[i], `line ${i + 1}`); }
    assert.equal(got, want);
});

test('없는 블록은 안 보내요; 가끔 가는 블록은 자리와 이름이 정해져 있어요', () => {
    const d = { ...sample(), langs: null, weather: '', voices: [], recent: [], card: '', around: '', situations: [] };
    const t = A.replyInput(d);
    assert.deepEqual(t.match(/^\[[^\]]+\]$/gm), ['[MESSENGER]', '[NOW]', "[OWNER'S CLOCK]", '[SITUATIONS]']);
    assert.match(t, /\[SITUATIONS\]\n\(none on the phone yet\)$/);
    const all = A.replyInput({ ...sample(), summary: 'Yesterday: …', blind: "[OWNER DOESN'T KNOW]\n- x", story: '## #0–#3 — s\n- a', typed: ['보고 싶', ' '], why: 'just woke up' });
    assert.deepEqual(all.match(/^\[[^\]]+\]$/gm), ['[LANGUAGES]', '[MESSENGER]', '[CHAT SUMMARY]', '[NOW]', "[OWNER'S CLOCK]", '[WEATHER NOW]', '[RECENT ON THE PHONE]', '[SITUATIONS]', "[Mara's card]", '[VOICES]', '[PEOPLE AROUND]', "[OWNER DOESN'T KNOW]", '[STORY]', '[TYPED AND DELETED]', '[WHY NOW]']);
    assert.match(all, /\[TYPED AND DELETED\]\n- 보고 싶\n\n\[WHY NOW\]\njust woke up$/);
    assert.doesNotMatch(all, /\n\n\n/);
});

test('NOW: 처음 메신저 대화, 이야기에서 모르던 사이, 오늘 일정', () => {
    assert.equal(A.nowBlock('Ren', { last: '05:50 · home · asleep', today: ['09:00 dentist', '19:00 dinner with Ivo'], story: true, first: true }),
        '[NOW]\nLast status: 05:50 · home · asleep. Calendar today: 09:00 dentist; 19:00 dinner with Ivo. You and Ren have talked before in the story. This is your first chat on MESSENGER.');
    assert.equal(A.nowBlock('Ren', {}), '[NOW]\nCalendar today: none. You and Ren have not talked before.');
});

test('지시문이 말하는 블록 이름과 같아요 (YOU GET)', async () => {
    const { phone2ReplySystem } = await import('../src/phone2reply.js');
    const sys = phone2ReplySystem({ owner: 'Mara', persona: 'Ren' }), get = sys.slice(sys.indexOf('YOU GET'), sys.indexOf('STATE FIRST'));
    for (const b of ['LANGUAGES', 'MESSENGER', 'CHAT SUMMARY', 'NOW', "OWNER'S CLOCK", 'WEATHER NOW', 'RECENT ON THE PHONE', 'SITUATIONS', "Mara's card", 'VOICES', 'PEOPLE AROUND', "OWNER DOESN'T KNOW", 'STORY', 'TYPED AND DELETED', 'WHY NOW']) assert.ok(get.includes(b), b);
});

test('폰 1은 이 파일을 안 불러요', async () => {
    const src = f => readFile(new URL(`../src/${f}`, import.meta.url), 'utf8');
    assert.doesNotMatch(await src('phone2ask.js'), /^\s*import\b/m);
    for (const f of (await readdir(new URL('../src/', import.meta.url))).filter(f => f.endsWith('.js') && !['phone2ask.js', 'phone2live.js'].includes(f))) assert.doesNotMatch(await src(f), /phone2ask/, f);
});
