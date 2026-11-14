// 폰 1 파일 지킴이: 폰 1의 데이터 파일에 폰 2 낱말이 늘어나면 실패해요.
// 폰 2 일은 src/phone2*.js 안에서만 해요. 아래 숫자는 지금 남아 있는 개수(줄 수)이고, 줄어들 수만 있어요.
// 폰 2 쪽을 phone2*.js로 다 옮기면 맨 오른쪽 숫자(폰 2가 생기기 전)까지 내려가요.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';

const SRC = new URL('../src/', import.meta.url);
const WORDS = /isLivePhone|phoneUpto|phoneNow|phoneRecent|phoneJournal|liveYear|liveAgain|liveHeld|liveMeta|resetLive|\.live\b|phone2|실시간|\bnowOn\b|\brecentOf\b|\breadUpto\b|\breadMark\b/;
// file: [지금 허용, 폰 2 전]
const LEFT = {
    'chats.js': [2, 0], 'investdata.js': [5, 3], 'phonedata.js': [34, 5],
    'phonelife.js': [8, 7], 'phonestory.js': [2, 0],
};
// 폰 2 낱말이 하나도 없어야 하는 폰 1 데이터 파일
const CLEAN = ['phoneai.js', 'phonesync.js', 'phonesynclife.js', 'phonesyncmoney.js', 'phonetr.js', 'phoneparse.js', 'phoneclock.js', 'wealth.js', 'finance.js', 'people.js', 'placehoods.js', 'phonestime.js', 'phoneflags.js'];
const count = async f => (await readFile(new URL(f, SRC), 'utf8')).split('\n').filter(l => WORDS.test(l)).length;

test('폰 1 데이터 파일에 폰 2 낱말이 늘지 않아요 (줄어들기만)', async () => {
    for (const [f, [now]] of Object.entries(LEFT)) {
        const n = await count(f);
        assert.ok(n <= now, `${f}: 폰 2 낱말이 든 줄이 ${now} → ${n}줄로 늘었어요. 폰 2 일은 src/phone2*.js 안에서 해요.`);
    }
});

test('폰 2 낱말이 없던 폰 1 데이터 파일은 계속 없어요', async () => {
    const have = new Set(await readdir(SRC));
    for (const f of CLEAN) { if (!have.has(f)) continue; assert.equal(await count(f), 0, `${f}: 폰 2 낱말이 들어왔어요. 폰 2 일은 src/phone2*.js 안에서 해요.`); }
});
