4520363 리뷰예요. 저장소는 건드리지 않았고, 실제 모델은 부르지 않았어요. 막는 문제(blocker)가 둘 있어요: 번역 단추가 화면을 멈추게 하고, 연결 프로필 없이 'ai'를 고르면 서버 자동 번역이 늘 실패해요.

## 테스트 결과 (복사본에서 돌림)
- `node --test tests/*.test.mjs`: 1670개 중 1669개 통과, 1개 실패. 실패한 `plugincode.test.mjs`는 이 커밋 탓이 아니에요. 복사본이 scratch 폴더 안에 있고, 그 옆 `orc` 폴더의 다른 확장을 테스트가 찾아서 생긴 거예요.
- fuzz: runs 5113 / 8663, problems 0
- PHONE2_POISON: 359개 모두 통과
- cmp.mjs: 경로만 복사본으로 바꿔 돌림. "checked 328 diff 0"
- eslint: 오류 0 (경고 5개는 가져온 store 파일)
- 확인용 스크립트 (모두 `…/scratchpad/review-t2/tests/` 안):
  - `/tmp/claude-0/-home-user-NarrativeArchive/975737c5-a9a7-512f-9518-c3206c8f1a25/scratchpad/review-t2/tests/rvtr.test.mjs` (RV1~RV4)
  - `/tmp/claude-0/-home-user-NarrativeArchive/975737c5-a9a7-512f-9518-c3206c8f1a25/scratchpad/review-t2/tests/rvloop.test.mjs` (RVLOOP)

## blocker

**B1. 번역 단추를 누르면 화면이 멈춰요 (다시 그리기가 끝없이 되풀이돼요)**
- 자리: `src/phone2translate.js:290-299`(liveTranslationOpen), `:317-324`(liveTranslate가 store를 구독), `src/phone.js:393`(방을 그릴 때 liveTranslationOpen), `src/phone.js:1541-1548`(obRetr)
- 흐름: 단추 → `liveTranslate`가 store를 구독하고 onChange로 다시 그림 → 그리는 중에 `liveTranslationOpen`이 store에 두 번 씀(`setConfig`, `seedFromMessages`) → store는 값이 같아도 매번 알림 → 또 그림. 단계마다 두 갈래로 퍼져서 2배씩 늘어요. 오류는 store의 try/catch가 삼켜서 멈추지도 않아요.
- 증거(RVLOOP): onChange가 phone.js처럼 방을 그리게 하면 테스트가 120초 안에 안 끝났어요. 깊이를 18로 막아도 단추 한 번에 다시 그리기가 1,572,861번이었어요. 기존 테스트는 onChange가 숫자만 세서 못 잡았어요.
- 고칠 것:
  - `liveTranslationOpen`은 값이 바뀔 때만 store에 써요(chatId · config 비교, 새로 채울 게 있을 때만 seed). 마리나라는 이걸 그리는 중이 아니라 useEffect에서 해요.
  - `liveTranslate`의 onChange는 queueMicrotask나 requestAnimationFrame으로 한 번에 모아서 불러요.

**B2. 번역 연결이 'ai'(실리 자신의 연결, 고른 프로필 없음)면 서버 자동 번역이 매번 실패해요**
- 자리: `src/phone2translate.js:181-186`
- 증거:
  - RV1: 늦은 답장은 서버가 보냈는데, 말풍선마다 "선택된 연결 프로필이 없습니다"로 번역이 실패했어요. 표시(`automaticTranslationSource`)만 남고 번역은 없어요. 다시 해 주는 곳도 없어요.
  - 실리 창에 경고 줄만 남고, 화면에는 이유가 안 보여요. 연결 목록에는 'ai'가 그대로 나와요.
  - 답장은 다른 연결(예: 초안 모델 커스텀)이라 잘 오는데 번역만 늘 빠지는 경우예요. 터묵스에서 브라우저를 닫고 쓰는 소망의 주 사용법이 막혀요.
- 문서의 주장 확인:
  - "프로필이면 generateRaw로만"은 틀려요. 프로필은 서버에서 돼요. 'ai'에 실리에서 고른 프로필이 있을 때(RV2)와 `profile:p1`(RV3) 둘 다 서버에서 번역됐고, 온도 0.3, system + user, max_tokens가 들어갔어요(RV2는 aiMaxTokens 8192, RV3는 4096).
  - 서버에서 안 되는 건 "'ai' + 프로필 없음"뿐이에요. 같은 경우의 답장(`askAIOnce`, `ai.js:526`)도 서버에서 똑같이 실패해요.
  - 커스텀 · Vertex · 실리 연결 방식('source')은 서버의 같은 길(callConn, 옮긴 createGenerationParameters)로 돼요.
- 고칠 것 (마리나라 요청 모양 유지):
  - main_api가 'openai'면 generateRaw 대신 실리의 지금 연결을 'source' 칸으로 보내요: `slotConn('ai', { mode: 'source', source: oai_settings.chat_completion_source, stModel: getChatCompletionModel(oai_settings) }, max)`. 브라우저와 서버 모두 `stSourceData`로 system + user, temperature 0.3, max_tokens가 그대로 가요.
  - 서버에서는 `work.mjs`의 `stOpenai`에 `getChatCompletionModel`(`plugin/st/public/scripts/openai.js:591`)을 더해요.
  - 글 완성 계열(textgen · kobold 등)은 옮긴 `TextCompletionService.processRequest`(`plugin/st/public/scripts/custom-request.js:89`)에 temperature 0.3 + 지시 형식으로 보내요. 이걸 하지 않으면 설정할 때 거절하고, `/auto/status`에 번역 이유를 실어요.
  - `usesSt`(`work.mjs:371`)가 번역 연결도 보게 해요. 지금은 커스텀으로만 답하는 세계가 프로필로 번역하면 연결 확인(naStatus)을 건너뛰어요.

## should-fix

**S1. 서버 번역이 일꾼의 줄(withWorld) 전체를 쥐고 있어요 (마리나라는 "아무 자물쇠도 안 쥠")**
- 자리: `plugin/work.mjs:295-307`, `:311`
- 증거(RV4): A 세계 번역이 걸려 있는 동안 B 세계의 `status`와 늦은 답장 sweep이 1.5초 안에 둘 다 안 끝났어요(timeout).
  - 번역은 말풍선마다 모델을 한 번씩 부르고, 그때마다 settings.json · 프리셋 · 카드 시그니처 · 상태 확인을 다시 해요.
  - AI 번역이 걸리면 다른 채팅의 늦은 답장 · 스케줄러 · 상태 확인이 다 밀려요(브라우저 상태 요청은 15초 시간 제한에 걸림).
  - 방 자물쇠는 안 쥐어요. 테스트에서도 claim이 됐어요.
- 고칠 것:
  - Google · 커스텀은 withWorld 밖에서 `TR.translateText`를 부르고, 저장만 withWorld 안에서 해요(지금 있는 `cached` 길을 그대로 쓰면 돼요).
  - 실리 것(프로필 · source · Vertex)은 답장 하나당 withWorld 한 번으로 묶어요.

**S2. 브라우저 길: 번역 도중 채팅을 바꾸거나 탭을 닫으면 번역이 사라지고, 다시 해 주지 않아요**
- 자리: `src/phone2translate.js:269-274`
- 문제:
  - 표시는 답과 같이 저장됐는데, 번역 저장은 "채팅이 열려 있지 않습니다"로 실패해요. 모델 요청은 이미 보낸 뒤예요(비용).
  - 마리나라의 "closing the browser cannot skip translation" 보장이 브라우저 길에는 없어요.
- 고칠 것:
  - 요청 전에 `isOpen`을 먼저 봐요.
  - 방을 열 때나 `liveGo`를 시작할 때, "표시됨 · 지금 글 · 번역 없음 · 숨김 아님"인 말을 다시 보내요.

**S3. 받아 둔 답장 목록에서 번역이 안 보여요**
- `phone2edit.js:124`가 이제 `translation`을 주는데, `phoneorbit.js:219`는 아직 `b.ko`를 그려요. 디자인 세션에 보낼 메시지로 쓰거나 `phone.js:469`에서 이름을 맞춰요.

**S4. "재번역" 글과 하는 일이 달라요**
- 자리: `phoneorbit.js:192`, `:294`
- 이제 마리나라처럼 켜고 끄는 단추라서, 번역이 있으면 다시 번역하지 않고 숨겨요.
- 여러 개를 고르면 `Promise.all`로 한꺼번에 보내요(전에는 240개씩 묶어 보냄).
- 글을 "번역 · 번역 숨기기"로 바꾸고 동시 요청 수를 막아요(디자인 세션 몫).

**S5. 버전을 안 올렸어요**
- `manifest.json:10`과 `src/core.js:15`가 3.232.19 그대로예요.
- 일꾼은 버전이 바뀔 때만 새 코드로 다시 떠요(`code.mjs:56`). 이대로 올리면 일꾼이 옛 코드(ko 지시문)를 계속 돌려요. 올릴 때 꼭 함께 올려요.

## note
- migrateKo
  - 옮기는 자리: 방의 말 · 받아 둔 답장 · 휴지통(`t.swipes.list` 모양 맞음) · 가져오기 · 분기 복사. 플러그인 저장분은 서버가 서랍을 만들 때 옮겨서 답장과 같이 저장해요.
  - 여러 번 돌려도 같고(멱등), 브라우저와 서버 둘 다 해요. 두 번 보이는 곳도 없어요.
  - 빠진 곳: 지운 방(`w.messenger.trash`)은 되살릴 때 옮겨져서 잃는 건 없어요.
  - 이미 번역이 있으면 ko는 버려요(의도한 것). 다시 고치지 않은 옛 페이지가 그 뒤에 쓴 ko도 버려져요.
  - 모든 `liveMeta`와 방을 그릴 때마다 말을 전부 훑어요(`phone2go.js:117`). 세계에 "옮김 끝" 표시를 두면 좋아요.
- 옛 플러그인(translating 칸 없음)이면 브라우저가 바로 기다리기를 그만둬요. 끝없이 기다리지 않아요.
  - 다만 `waitForServerTranslationToSettle`이 그때그때 `keep.id()`를 읽어서(`phone2keepon.js:77`), 채팅을 바꾸면 엉뚱한 저장을 묻고 끝난 뒤 옛 방에 신호를 보내요. 시작할 때 sid를 고정해 두면 돼요.
- 409: 다시 읽고 받은 번역을 넣는 것까지 맞아요(기존 테스트 통과). 실패 줄은 말마다 한 번이에요(마리나라와 같음).
- 단체방(Merged) · 나뉜 말풍선 · 먼저 건 말: 코드상 다 번역으로 이어져요(`got.ids`, `afterTranslation`). Merged 방 번역 테스트는 없어요.
- 말 없이 한 일만 있는 메시지에도 빈 표시가 붙어요. `job.trIds`가 저장되는 job 줄에 남아요(쓸모없는 값).
- VOICES · liveRetranslate · koLike를 부르는 곳은 남아 있지 않아요.
  - 말투(koVoice) 설정은 폰 앱 번역(fillKo)이 계속 써서 버려진 설정이 아니에요.
  - "한국어 보기"는 이제 Orbit 메신저에 안 먹고, `.na_ob_ko` 누르기는 아무 일도 안 해요.
  - `phoneorbitset.js:273`에 DeepL 고르기가 남아 있어서 고르면 오류가 떠요.
- 'ai' 연결의 최대 토큰은 기본값 aiMaxTokens 8192라서, 마리나라의 4096으로 떨어지는 일이 없어요.
- 반영 세션이 화면 파일(`src/phone.js`, `src/phoneorbitset.js`)을 직접 고쳤어요. 인수인계 0장의 "디자인 세션 몫" 규칙과 달라요.