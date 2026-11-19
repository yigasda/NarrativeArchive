// 폰 1 파일 지킴이: 폰 1의 데이터 파일에 폰 2 낱말이 늘어나면 실패해요.
// 폰 2 일은 src/phone2*.js 안에서만 해요. 아래 숫자는 지금 남아 있는 개수(줄 수)이고, 줄어들 수만 있어요.
// 폰 2 쪽을 phone2*.js로 다 옮기면 맨 오른쪽 숫자(폰 2가 생기기 전)까지 내려가요.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';

const SRC = new URL('../src/', import.meta.url);
const WORDS = /isLivePhone|phoneUpto|phoneNow|phoneRecent|phoneJournal|liveYear|liveAgain|liveHeld|liveMeta|resetLive|\.live\b|phone2|실시간|\bnowOn\b|\brecentOf\b|\breadUpto\b|\breadMark\b|isLive|storyUpto/;
// file: [지금 허용, 폰 2 전]
const LEFT = {
    'chats.js': [2, 0], 'investdata.js': [3, 3], 'phonedata.js': [8, 5],
    'phonelife.js': [7, 7], 'phonestory.js': [2, 0],
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

// 폰 2 파일은 폰 1의 "읽는 범위 · 지금 · 연도 · 요청 뼈대" 함수를 부르지 않아요. 그 자리는 live… 사본이에요.
// (사본의 한 줄이 폰 1 이름으로 되돌아가면 글자 비교 시험은 못 봐요. 여기서 잡아요.)
const P1_ONLY = ['secondTurn', 'readMark', 'sideRequest', 'windowOf', 'fillClock', 'fillClockRows', 'storyNow', 'statusAt', 'storyYear', 'ensureYear', 'setStoryYear', 'yearBlock', 'phoneRequest', 'whereRequest'];
const bare = t => t.replace(/\/\*[\s\S]*?\*\//g, '').split('\n').map(l => l.replace(/^\s*\/\/.*$/, '').replace(/\s\/\/ .*$/, '')).join('\n');
test('폰 2 파일은 폰 1의 읽는 범위 · 지금 · 연도 · 요청 함수를 부르지도 가져오지도 않아요 (창구만 가져와요)', async () => {
    const files = (await readdir(SRC)).filter(f => /^phone2.*\.js$/.test(f) && f !== 'phone2api.js');
    assert.ok(files.length > 10);
    for (const f of files) {
        const code = bare(await readFile(new URL(f, SRC), 'utf8'));
        const imports = [...code.matchAll(/import\s*\{([^}]*)\}\s*from\s*'\.\/(?!phone2)[^']+'/g)].flatMap(m => m[1].split(',').map(x => x.trim().split(/\s+as\s+/)[0]));
        for (const n of P1_ONLY) {
            assert.ok(!imports.includes(n), `${f}: 폰 1의 ${n}을 가져와요. live… 사본을 써요.`);
            assert.ok(!new RegExp(`(^|[^\\w.$])${n}\\(`).test(code), `${f}: 폰 1의 ${n}(…)을 불러요. live… 사본을 써요.`);
        }
    }
});

// 화면 파일은 창구 P에 있는 이름을 폰 1 파일에서 바로 가져오지 않아요 (그러면 실시간에서 폰 1 함수가 돌아요)
test('화면 파일은 창구의 이름을 폰 1 파일에서 직접 가져오지 않아요', async () => {
    const { P } = await import('../src/phone2api.js').catch(() => ({}));
    const api = await readFile(new URL('phone2api.js', SRC), 'utf8');
    const names = P ? Object.keys(P) : [...api.slice(api.indexOf('export const P = Object.freeze({')).matchAll(/^\s{4}(?!\/\/)(.+)$/gm)].flatMap(m => m[1].split(',').map(x => x.trim().split(':')[0]).filter(x => /^\w+$/.test(x)));
    assert.ok(names.length >= 32, String(names.length));
    const ui = (await readdir(SRC)).filter(f => f.endsWith('.js') && !/^phone2/.test(f));
    let users = 0;
    for (const f of ui) {
        const code = bare(await readFile(new URL(f, SRC), 'utf8'));
        if (!code.includes("'./phone2api.js'")) continue;
        users++;
        const direct = [...code.matchAll(/import\s*\{([^}]*)\}\s*from\s*'\.\/(?:phonedata|investdata|phoneai|phonelife|phonetr)\.js'/g)].flatMap(m => m[1].split(',').map(x => x.trim().split(/\s+as\s+/)[0]));
        for (const n of names.filter(n => n !== 'nowOn')) assert.ok(!direct.includes(n), `${f}: ${n}을 폰 1 파일에서 직접 가져와요. P.${n}으로 불러요.`);
    }
    assert.ok(users >= 5, String(users));
});
