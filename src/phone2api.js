// 폰 화면이 부르는 창구 (P). 화면은 아래 이름들을 phonedata.js 등에서 직접 부르지 않고 P.이름(...)으로 불러요.
// 타임라인(폰 1)일 때는 폰 1 함수를 그대로, 같은 인자로 불러요. 실시간(폰 2)일 때 다르게 해야 하는 일은
// 폰 1 파일이 아니라 src/phone2*.js 안에서 해요. 옮긴 것: 사진 · 메모(일기) · 초안 · 녹음 (phone2act.js), 화면의 지금 · 상태창 (이 파일), 연도 (phone2year.js), 롤플에 넣기 (phone2note.js),
// 기기 정보 · 자산 준비 (phone2fill.js), 투자 채우기 · 시세 업데이트 · 평가 날짜 · 기록 모으기 · 차트 시세 · 은행 환율 (phone2invest.js), 말투 읽기 (phone2voice.js),
// 은행 채우기 (phone2money.js), 음성 메모 (phone2fill.js), 생활 · 배달 · 스크린타임 · 동네 가게 (phone2life.js),
// 위치 다시 연동 (phone2where.js).
// 요청 뼈대는 phone2req.js.
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
import { liveStoryYear, liveEnsureYear, liveSetStoryYear } from './phone2year.js';
import { liveNote } from './phone2note.js';
import { liveFillDevice, livePrepareWealth, liveFillVoice } from './phone2fill.js';
import { liveFillScreen, liveRefreshNearby, liveFillLife, liveFillDelivery } from './phone2life.js';
import { liveCollectInvestmentRecords, liveFillChartHistory, liveRefreshBankFX, liveFillInvestment, liveRefreshMarket, liveInvestmentDate } from './phone2invest.js';
import { liveLearnVoices, livePickVoices } from './phone2voice.js';
import { liveFillMoney } from './phone2money.js';
import { liveRereadPlaces } from './phone2where.js';

// 실시간 폰(꼬리표가 붙은 폰)을 실시간 서랍 없이 부르면 멈춰요: 폰 1 함수가 실시간 폰을 만지지 않게
const LIVE_PHONE = Symbol.for('narrative-archive.live');
// 갈림 하나: 첫 인자가 실시간 서랍이면 폰 2 함수, 아니면 폰 1 함수를 같은 인자로 그대로
// (at: 폰이 몇째 인자인지. 대개 둘째(1), 말투 읽기는 (m, owner, p)라 셋째(2))
const split = (one, two, at = 1) => async (...a) => {
    if (isLiveMeta(a[0])) return two(...a);
    if (a[at]?.[LIVE_PHONE]) throw new Error('실시간 폰은 실시간 화면에서만 돼요');
    return one(...a);
};

// 지금 · 상태창: 폰(첫 인자)이 실시간 폰이거나 서랍(m)이 실시간 서랍이면 폰 2의 것
//   지금 = 서랍의 흐르는 시계, 서랍이 없으면 폰에 저장된 시각. 롤플 상태창은 실시간 폰의 것이 아니라 없음(null)
const liveP = (p, m) => isLiveMeta(m) || !!p?.[LIVE_PHONE];
// (타임라인의 nowOn: 예전 화면이 부르던 그대로 storyNow(p), 메타는 안 넘겨요)
const nowOn = (p, m = null) => (liveP(p, m) ? liveNowText(m, p) : storyNow(p));
const storyNowP = (...a) => (liveP(a[0], a[2]) ? liveNowText(a[2], a[0]) : storyNow(...a));
const statusAtP = (...a) => (liveP(a[0], a[2]) ? null : statusAt(...a));
// 연도 (인자: 서랍 m, 폰 p, …): 실시간 서랍이면 폰 2의 것. 화면이 폰을 복사해서 넘기기도 해서({ ...p, year: 0 }) 서랍으로 갈라요
const guard = (m, p) => { if (!isLiveMeta(m) && p?.[LIVE_PHONE]) throw new Error('실시간 폰은 실시간 화면에서만 돼요'); };
const storyYearP = (...a) => (isLiveMeta(a[0]) ? liveStoryYear(a[0], a[1]) : (guard(a[0], a[1]), storyYear(...a)));
const ensureYearP = (...a) => (isLiveMeta(a[0]) ? liveEnsureYear(a[0], a[1]) : (guard(a[0], a[1]), ensureYear(...a)));
const setStoryYearP = (...a) => (isLiveMeta(a[0]) ? liveSetStoryYear(...a) : (guard(a[0], a[1]), setStoryYear(...a)));
// 롤플에 넣기 (m: 채팅의 메타, live: 실시간 폰들): 폰 1의 글은 폰 1 함수 그대로, 그 뒤에 실시간 폰의 글
const phoneBlockP = (m, live = null) => phoneBlock(m) + liveNote(live);
// 분기 알아채기는 폰 1의 폰만 해요: 실시간 서랍 · 실시간 폰이면 폰 1 함수를 안 부르고 아무것도 안 해요(null)
// (실시간 폰의 분기는 phone2story.js liveBranched가 가려요)
const settleBranchP = async (...a) => (isLiveMeta(a[0]) || a[1]?.[LIVE_PHONE] ? null : settleBranch(...a));
// 결제 다시 읽기는 폰 1 반영의 것이에요(롤플 메시지를 다시 읽어요). 실시간 폰은 메신저 반영이 다음 차례에 다시 읽어요
const retryMoneyP = async (...a) => { if (isLiveMeta(a[0])) throw new Error('실시간 폰은 다음 반영 때 결제를 다시 읽어요'); return retryMoney(...a); };
// 평가 날짜 (m, p): 실시간 서랍이면 폰 2의 것 (흐르는 시계의 날). 화면이 그릴 때마다 물어서 오류 없이 바로 답해요
const investmentDateP = (...a) => (isLiveMeta(a[0]) ? liveInvestmentDate(...a) : (guard(a[0], a[1]), investmentDate(...a)));
// 폰 만들기 준비(위치 · 연도를 먼저 읽는 화면)는 폰이 없을 때의 것이에요. 실시간에서는 폰을 처음 만들지 않아서 안 열려요
const preparePhoneP = async (...a) => { if (isLiveMeta(a[0])) throw new Error('실시간 폰에서는 폰 만들기 준비를 하지 않아요'); return preparePhone(...a); };

export const P = Object.freeze({
    // 폰 만들기 · 다시 만들기
    preparePhone: preparePhoneP, makePhone, rereadPlaces: split(rereadPlaces, liveRereadPlaces),
    // 앱 채우기
    fillMoney: split(fillMoney, liveFillMoney), retryMoney: retryMoneyP, fillVoice: split(fillVoice, liveFillVoice), fillDevice: split(fillDevice, liveFillDevice),
    fillLife: split(fillLife, liveFillLife), fillDelivery: split(fillDelivery, liveFillDelivery), fillScreen: split(fillScreen, liveFillScreen), refreshNearby: split(refreshNearby, liveRefreshNearby),
    learnVoices: split(learnVoices, liveLearnVoices, 2), pickVoices: split(pickVoices, livePickVoices, 2),
    // 앱 안에서 하나 만들기
    takePhoto: split(takePhoto, liveTakePhoto), writeEntry: split(writeEntry, liveWriteEntry), makeDraft: split(makeDraft, liveMakeDraft), recordVoice: split(recordVoice, liveRecordVoice),
    // 돈 · 투자
    prepareWealth: split(prepareWealth, livePrepareWealth), collectInvestmentRecords: split(collectInvestmentRecords, liveCollectInvestmentRecords), fillInvestment: split(fillInvestment, liveFillInvestment),
    fillChartHistory: split(fillChartHistory, liveFillChartHistory), refreshMarket: split(refreshMarket, liveRefreshMarket), refreshBankFX: split(refreshBankFX, liveRefreshBankFX),
    investmentDate: investmentDateP,
    // 지금 · 연도 · 상태창
    storyNow: storyNowP, nowOn, statusAt: statusAtP, storyYear: storyYearP, setStoryYear: setStoryYearP, ensureYear: ensureYearP,
    // 분기 · 롤플에 넣기
    settleBranch: settleBranchP, phoneBlock: phoneBlockP,
});
