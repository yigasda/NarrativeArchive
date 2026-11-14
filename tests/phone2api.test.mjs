// 화면 창구(P): 이름이 빠지거나, 타임라인 쪽이 같은 이름의 폰 1 함수가 아니면 실패해요.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const SRC = new URL('../src/', import.meta.url);
const NAMES = ['preparePhone', 'makePhone', 'rereadPlaces', 'fillMoney', 'retryMoney', 'fillVoice', 'fillDevice', 'fillLife', 'fillDelivery', 'fillScreen', 'refreshNearby',
    'learnVoices', 'pickVoices', 'takePhoto', 'writeEntry', 'makeDraft', 'recordVoice', 'prepareWealth', 'collectInvestmentRecords', 'fillInvestment', 'fillChartHistory',
    'refreshMarket', 'refreshBankFX', 'investmentDate', 'storyNow', 'nowOn', 'statusAt', 'storyYear', 'setStoryYear', 'ensureYear', 'settleBranch', 'phoneBlock'];

test('P: 화면이 부르는 이름이 다 있고, 타임라인 쪽은 폰 1 파일에서 가져온 그 함수예요', async () => {
    const src = await readFile(new URL('phone2api.js', SRC), 'utf8');
    const imported = new Set([...src.matchAll(/import \{([^}]*)\} from '\.\/(?:phonedata|investdata|phoneai|phonelife|phonetr)\.js'/g)].flatMap(m => m[1].split(',').map(s => s.trim()).filter(Boolean)));
    const body = src.slice(src.indexOf('export const P = Object.freeze({'), src.lastIndexOf('});'));
    // (an entry is a name, or name: split(name, live…) once its 실시간 side has moved to a phone2 file)
    const entries = body.split('\n').filter(l => !/^\s*\/\//.test(l)).join(' ').replace(/^.*?\{/, '').replace(/split\((\w+), \w+\)/g, '=$1').split(',').map(s => s.trim()).filter(Boolean);
    const listed = new Set(entries.map(e => e.split(':')[0].trim()));
    assert.deepEqual([...listed].sort(), [...NAMES].sort());
    for (const e of entries.filter(e => e.includes(':'))) assert.match(e, /^(\w+): =\1$/, e); // 타임라인 쪽은 같은 이름의 폰 1 함수
    for (const n of NAMES) assert.ok(imported.has(n), n);
    // 창구는 폰 1 파일을 읽기만 해요: 폰 1 파일이 창구를 부르면 안 돼요
    for (const f of ['phonedata.js', 'investdata.js', 'phoneai.js', 'phonelife.js', 'phonetr.js', 'phonesync.js']) assert.ok(!(await readFile(new URL(f, SRC), 'utf8')).includes('phone2api'), f);
});
