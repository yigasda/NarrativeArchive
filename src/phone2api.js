// 폰 화면이 부르는 창구 (P). 화면은 아래 이름들을 phonedata.js 등에서 직접 부르지 않고 P.이름(...)으로 불러요.
// 타임라인(폰 1)일 때는 폰 1 함수를 그대로, 같은 인자로 불러요. 실시간(폰 2)일 때 다르게 해야 하는 일은
// 폰 1 파일이 아니라 src/phone2*.js 안에서 해요. 지금은 전부 폰 1 함수 그대로예요 (옮기는 중, 하는 일은 같아요).
// (phoneai.js 먼저: phonedata.js와 서로 부르는 사이라, 이 순서여야 어디서 처음 불러도 읽혀요)
import { makeDraft, recordVoice, takePhoto, writeEntry } from './phoneai.js';
import {
    prepareWealth, rereadPlaces, preparePhone, settleBranch, ensureYear, setStoryYear, storyYear, fillDevice, fillMoney,
    fillVoice, makePhone, retryMoney, storyNow, nowOn, statusAt, phoneBlock,
} from './phonedata.js';
import { collectInvestmentRecords, fillInvestment, fillChartHistory, refreshMarket, refreshBankFX, investmentDate } from './investdata.js';
import { fillDelivery, fillLife, fillScreen, refreshNearby } from './phonelife.js';
import { learnVoices, pickVoices } from './phonetr.js';

export const P = Object.freeze({
    // 폰 만들기 · 다시 만들기
    preparePhone, makePhone, rereadPlaces,
    // 앱 채우기
    fillMoney, retryMoney, fillVoice, fillDevice, fillLife, fillDelivery, fillScreen, refreshNearby, learnVoices, pickVoices,
    // 앱 안에서 하나 만들기
    takePhoto, writeEntry, makeDraft, recordVoice,
    // 돈 · 투자
    prepareWealth, collectInvestmentRecords, fillInvestment, fillChartHistory, refreshMarket, refreshBankFX, investmentDate,
    // 지금 · 연도 · 상태창
    storyNow, nowOn, statusAt, storyYear, setStoryYear, ensureYear,
    // 분기 · 롤플에 넣기
    settleBranch, phoneBlock,
});
