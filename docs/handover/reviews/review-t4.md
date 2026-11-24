## 번역 2차 검토 (81de03a)

막는 문제(blocker)는 없어요. 고쳐야 할 것 6개, 참고 몇 개예요. 저장소는 건드리지 않았고(복사본 `review-t4`), 실제 모델은 부르지 않았어요.

### 테스트 결과
- **`node --test tests/*.test.mjs`:** 1684개 중 1682개 통과.
  - 실패 1: `plugincode.test.mjs`. 복사본이 scratchpad 안에 있어서 생기는 것으로, 알려진 일이에요.
  - 실패 2: `phone2isolation`의 afterarchive. 다른 테스트와 같이 돌 때 6초를 넘겨 떨어졌어요. 혼자 돌리면 4개 다 통과하고, TZ=UTC로 전체를 돌릴 때도 통과했어요. 이번 커밋 탓이 아니라 부하 때문이에요.
- **TZ=UTC:** 1683개 통과, `plugincode` 1개만 실패.
- **fuzz:** fill 5113회 · reflect 8663회, 문제 0.
- **PHONE2_POISON:** 359개 모두 통과.
- **cmp.mjs:** checked 328, diff 0.

### 앞 검토(t1 · t2 · t3)가 정말 고쳐졌나
t2의 확인용 테스트를 새 코드에 다시 돌렸어요. 가져온 파일 하나(`token-estimator.js`)만 불러오기 목록에 더했어요.

- **B1 (번역 단추가 화면을 멈춤):** 고쳐졌어요. RVLOOP의 다시 그리기가 157만 번에서 2번으로 줄었어요.
- **B2 ('ai' 연결 + 고른 프로필 없음):** 고쳐졌어요. 서버가 openrouter의 모델로 system + user, 온도 0.3, max 8192를 보내서 번역돼요(RV1b).
  - RV1 자체는 아직 "실패"로 나와요. 하네스의 oai 설정에 `openrouter_model`이 없어서 "모델을 선택하세요."로 떨어진 것이라, 코드 문제가 아니에요.
- **S1 (번역이 일꾼의 줄을 쥠):** 고쳐졌어요. RV4에서 다른 세계의 상태 확인과 늦은 답장이 둘 다 시간 안에 끝났어요.
- **t1 1~6:** 다 고쳐졌어요(답 저장 직후 번역 시작, 설정은 일 시작 때 잡음, 보이는 글 복사, 토큰 어림, sm:flex 안내, %s 로그).
  - `token-estimator.js`는 마리나라 원본과 한 줄(`!` 표시)만 달라요.
  - `safeFetch`, `enqueueTranslationPersistence`의 두 번째 확인, `dispatchAutomaticTranslations`도 마리나라와 다시 대 봤는데, 고친 곳 밖에서 달라진 동작은 없어요.
- **t1 7 (a)~(e):** 다 문서에 들어갔어요.
- **S3 (받아 둔 답장 목록), sid 고정, `trIds` 정리, 옛 주석:** 고쳐졌어요.
- **S5 (버전):** 아직 3.232.19 그대로예요. 아래 6번.

### 고쳐야 할 것 (should-fix)

**1. 서버가 번역하는 동안 말을 고치면, 옛 글의 번역이 새 글의 번역으로 저장돼요**
- 자리: `plugin/work.mjs:315-340`.
  - `ask`는 사본에서 그때의 글을 번역해요.
  - `put`은 다시 읽은 말에 `cached`를 넣는데, 이때 비교 기준이 새 글이 돼요.
- 증거(`zz_pw.test.mjs` R4-EDIT): 번역 도중 'sorry'를 'sorry, edited'로 고쳤더니 이렇게 저장됐어요.
  - `translation: "KO:sorry"`
  - `translationSource: "sorry, edited"`
  - `automaticTranslationSource`도 새 글로 덮였어요.
- 마리나라는 끝에서 `expectedContent`로 처음 읽은 글을 확인해서, 이럴 때 아무것도 저장하지 않아요.
- `SERVER-HANDOVER.md:218`의 "그사이 글을 고쳤으면 안 넣어요"는 지금 코드와 맞지 않아요. 409로 다시 넣는 길도 같아요.
- 고칠 것: `ask`가 `{ source, translation }`을 돌려주게 해요. `put`에서 다시 읽은 말의 `text`가 `source`와 다르면 `null`로 끝내요.

**2. 이어서 번역(`resumeAutomaticTranslations`)이 실패한 번역을 다시 물어요. 마리나라는 일부러 그렇게 하지 않아요**
- 자리: `src/phone2translate.js:337-365`, `src/phone2go.js:186`.
- 증거(`zz_rvloop.test.mjs` R4-RESUME):
  - 표시만 있고 번역이 없는 말이면 무엇이든 다시 보내요. 서버가 실패한 것(제공자 오류 · 빈 결과 · 거절된 API)도 들어가요.
  - 자동 번역이 꺼져 있어도 보내요(지금 설정으로: 'google').
  - 페이지마다 한 번씩, 모든 방, 오래된 기록까지예요. 방끼리는 `Promise.all`로 한꺼번에 보내요.
- 마리나라 `GameNarration.tsx:1589-1601`: "The server owns this attempt; a failed translation stays manually retryable." "Try each completed source once; failures stay manually retryable, not an API retry loop."
- `/auto/status`가 실패하면(플러그인이 다시 뜨는 중 등) 서버가 아직 번역하는 방도 브라우저가 같이 보내요(중복 비용).
- `MARINARA-PORT.md:200`은 "채팅을 바꾸거나 탭을 닫아 끝나지 못한 것"만 이어서 한다고 적혀 있어서, 실제 동작과 달라요.
- 고칠 것:
  - 브라우저 길에서 묻기 직전에 "아직 안 끝남" 목록을 localStorage에 넣고, 끝나면(성공이든 실패든) 빼요.
  - 이어서 하기는 그 목록에 남은 것만 해요. 서버가 맡은 표시는 서버 몫이니 건드리지 않아요.
  - `autoTranslateOn`이 꺼져 있으면 하지 않아요.
  - 문서도 그대로 적어요.

**3. migrateKo의 "세계마다 한 번만 훑기"가 지운 방을 놓쳐요**
- 자리: `src/phone2translate.js:60`. 훑는 곳이 `w.messenger.rooms`뿐이고 `w.messenger.trash`(지운 방)는 없어요.
- 증거(R4-KO):
  - 한 번 훑은 뒤 `restoreRoom`으로 되살린 방의 `ko`가 그대로 남아요. 방을 그려도 안 옮겨져요.
  - 'na-live-change' 전에 그 말을 고치면, 나중에 훑을 때 `translationSource`가 고친 글이 돼요(옛 한국어가 새 글의 번역처럼 보여요).
- 옛 페이지 · 옛 플러그인 · 가져오기 · 분기 복사는 문제없어요.
  - 플러그인에서 받으면 'na-live-change'로 표시를 지워요.
  - 가져오기는 바로 `extra.translation`에 넣어요.
  - 분기 · 서버 일꾼은 새 객체라 다시 훑어요.
- 고칠 것: migrateKo가 `w.messenger.trash[].room`의 말 · 받아 둔 답장 · 휴지통도 훑어요. 아니면 `restoreRoom` 뒤에 `forgetKoMoved()`를 불러요.

**4. 여러 개를 골라 번역하면 다시 그리기가 너무 많아요**
- 자리: `src/phone2translate.js:438`, `src/phone.js:1546`.
- `liveTranslate`마다 자기 구독이 있어서, store가 한 번 바뀔 때 고른 수만큼 다시 그려요.
- 증거(R4-MANY, 응답 시간을 5~200ms로 흩음): 40개를 고르면 다시 그리기가 860번이에요.
- 고칠 것: 같은 `onChange`는 모듈 하나에서 한 틱에 한 번만 부르게 묶어요(Set으로 줄 세우고 microtask 하나).

**5. 디자인 메시지 (`notes-tr/design-message.md`)**
- (a) 연결 고르기가 마리나라와 달라요.
  - 마리나라는 `ConnectionSelect`예요. 누르면 모델 고르기 창이 뜨고, 제목은 "Model for {{job}}"(job = "Translation")이에요.
  - 고른 뒤에는 단추에 " · Set for this chat"이 붙어요.
  - 메시지에는 select와 "연결 선택…"만 있어요. 이 둘을 en.json 글로 넣어요.
- (b) 마리나라에 없는 것을 넣고 있어요.
  - 3장 "여러 개 골라 번역: 둘지 뺄지 정해 주세요 … 한 번에 3개씩"은 마리나라에 없는 기능이고, 숫자도 지어낸 것이에요. "빼요"로 적거나 소망에게 물어요.
  - 4-3 `translateWhy`를 화면에 보이기도 마리나라에 없어요. 소망 허락을 받거나 빼요.
- (c) 1장 섹션 도움말: 지금 화면 글은 "automatic response translation"까지 빠졌어요. "for Game mode"만 빼고 옮겨요: "…제공자, 대상 언어, 응답 자동 번역이 포함됩니다."
- 안쪽 값(연결 id 등)을 화면에 내라는 곳은 없어요. 말투 표 한 줄은 허락받은 대로예요.

**6. 버전을 아직 안 올렸어요**
- `manifest.json:10`과 `src/core.js:15`가 3.232.19예요.
- 일꾼은 버전이 바뀔 때만 새 코드로 다시 떠요. 이대로 메인에 올리면 서버는 옛 코드(ko 지시문, 번역 없음)를 계속 돌려요. 올릴 때 꼭 둘 다 같이 올려요.

### 참고 (note)
- **요청 몸통**
  - 채팅 완성: 실리 `createGenerationParameters` 그대로이고, 온도 0.3 · max · system + user예요. 샘플링은 중립값(top_p 1, 벌점 0)이라 "마리나라는 온도와 최대 토큰만 보낸다"와 같아요.
  - 글 완성: 프로필 길의 `processRequest`와 같지만 프리셋 · `instructSettings` · `secret_id`는 없어요(문서 199에 적힘). 그래서 Ollama(`num_predict`) · llama.cpp(`n_predict`)는 최대 토큰이 안 먹고, 지시 모드가 꺼져 있으면 끝을 막는 글(stop)이 없어요.
- **모델이 비었을 때:** 실리의 지금 연결에 모델이 없으면 "모델을 선택하세요."가 경고 줄에만 남아요. `translateWhy`는 ''예요.
- **닫힌 채팅의 알림:** `waitForServerTranslationToSettle`은 그사이 채팅을 바꾸면 알림을 아예 안 보내요. 마리나라는 늘 보내요(finally). 문서 189에 동작은 적혀 있지만 "다른 점"으로는 안 적혀 있어요. 그리고 189의 `afterTranslation`은 이제 없는 이름이에요(`startTranslation` · `cueAfter`).
- **불필요한 다시 그리기:** `goNow`의 이어서 하기가 할 일이 없어도 `.finally(tell)`로 매번 한 번 다시 그려요.
- **runLive:** 첫 `save()`가 실패하면 표시만 남고 번역하지 않아요(마리나라도 저장이 안 된 답은 번역하지 않아요).
- **서버 쪽 코드 (문제없음):**
  - 409 처리 맞아요.
  - 방 자물쇠를 쥐지 않아요.
  - 실리의 것으로 번역할 때는 답 하나를 줄 한 번에 해요.
  - 줄 밖에서 하는 커스텀 길은 `ctx`를 읽지 않아요.
  - NovelAI 거절과 `/auto/status`의 이유가 테스트대로 나와요.
- **문서 (번역 칸 · 3-6b):**
  - 위의 1(218줄) · 2(200줄) · 3(203줄)만 코드와 달라요.
  - Orbit 전체 설정(마리나라는 채팅마다), 4096, 대체 연결 없음, 글 완성 차이는 솔직하게 적혀 있어요.
- **방을 바꿀 때의 단체 조각:** 마리나라는 번역만 표시를 바꿀 때 단체 조각의 차례 보이기를 다시 하지 않아요(`ConversationMessage.tsx` 664~700). Orbit에 차례 보이기가 있다면 같아야 해요(디자인 몫).

### 파일 (모두 /tmp/claude-0/-home-user-NarrativeArchive/975737c5-a9a7-512f-9518-c3206c8f1a25/scratchpad/ 안)
- 확인용 테스트:
  - `review-t4/tests/zz_rvloop.test.mjs` (RVLOOP · R4-KO · R4-RESUME · R4-MANY)
  - `review-t4/tests/zz_rvtr.test.mjs` (RV1~RV4 · RV1b)
  - `review-t4/tests/zz_pw.test.mjs` (R4-EDIT)
- 로그: `review-t4-tests.log`, `review-t4-tests-utc.log`, `review-t4-extra.log`