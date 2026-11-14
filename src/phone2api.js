// 폰 화면이 부르는 창구 (P). 화면은 아래 이름들을 phonedata.js 등에서 직접 부르지 않고 P.이름(...)으로 불러요.
// 타임라인(폰 1)일 때는 폰 1 함수를 그대로, 같은 인자로 불러요. 실시간(폰 2)일 때 다르게 해야 하는 일은
// 폰 1 파일이 아니라 src/phone2*.js 안에서 해요. 옮긴 것: 사진 · 메모(일기) · 초안 · 녹음 (phone2act.js), 화면의 지금 · 상태창 (이 파일).
// 아직 안 옮긴 이름은 폰 1 함수 그대로예요 (하는 일은 같아요).
// (phoneai.js 먼저: phonedata.js와 서로 부르는 사이라, 이 순서여야 어디서 처음 불러도 읽혀요)
import { makeDraft, recordVoice, takePhoto, writeEntry } from './phoneai.js';
import {
    prepareWealth, rereadPlaces, preparePhone, settleBranch, ensureYear, setStoryYear, storyYear, fillDevice, fillMoney,
    fillVoice, makePhone, retryMoney, storyNow, statusAt, phoneBlock,
} from './phonedata.js';
import { collectInvestmentRecords, fillInvestment, fillChartHistory, refreshMarket, refreshBankFX, investmentDate } from './investdata.js';
import { fillDelivery, fillLife, fillScreen, refreshNearby } from './phonelife.js';
import { learnVoices, pickVoices } from './phonetr.js';
import { isLiveMeta, liveNowText } from './phone2store.js';
import { liveTakePhoto, liveWriteEntry, liveMakeDraft, liveRecordVoice } from './phone2act.js';

// 실시간 폰(꼬리표가 붙은 폰)을 실시간 서랍 없이 부르면 멈춰요: 폰 1 함수가 실시간 폰을 만지지 않게
const LIVE_PHONE = Symbol.for('narrative-archive.live');
// 갈림 하나: 첫 인자가 실시간 서랍이면 폰 2 함수, 아니면 폰 1 함수를 같은 인자로 그대로
const split = (one, two) => async (...a) => {
    if (isLiveMeta(a[0])) return two(...a);
    if (a[1]?.[LIVE_PHONE]) throw new Error('실시간 폰은 실시간 화면에서만 돼요');
    return one(...a);
};

// 지금 · 상태창: 폰(첫 인자)이 실시간 폰이거나 서랍(m)이 실시간 서랍이면 폰 2의 것
//   지금 = 서랍의 흐르는 시계, 서랍이 없으면 폰에 저장된 시각. 롤플 상태창은 실시간 폰의 것이 아니라 없음(null)
const liveP = (p, m) => isLiveMeta(m) || !!p?.[LIVE_PHONE];
// (타임라인의 nowOn: 예전 화면이 부르던 그대로 storyNow(p), 메타는 안 넘겨요)
const nowOn = (p, m = null) => (liveP(p, m) ? liveNowText(m, p) : storyNow(p));
const storyNowP = (...a) => (liveP(a[0], a[2]) ? liveNowText(a[2], a[0]) : storyNow(...a));
const statusAtP = (...a) => (liveP(a[0], a[2]) ? null : statusAt(...a));

export const P = Object.freeze({
    // 폰 만들기 · 다시 만들기
    preparePhone, makePhone, rereadPlaces,
    // 앱 채우기
    fillMoney, retryMoney, fillVoice, fillDevice, fillLife, fillDelivery, fillScreen, refreshNearby, learnVoices, pickVoices,
    // 앱 안에서 하나 만들기
    takePhoto: split(takePhoto, liveTakePhoto), writeEntry: split(writeEntry, liveWriteEntry), makeDraft: split(makeDraft, liveMakeDraft), recordVoice: split(recordVoice, liveRecordVoice),
    // 돈 · 투자
    prepareWealth, collectInvestmentRecords, fillInvestment, fillChartHistory, refreshMarket, refreshBankFX, investmentDate,
    // 지금 · 연도 · 상태창
    storyNow: storyNowP, nowOn, statusAt: statusAtP, storyYear, setStoryYear, ensureYear,
    // 분기 · 롤플에 넣기
    settleBranch, phoneBlock,
});
