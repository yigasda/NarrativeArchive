## 마리나라 번역 가져오기 검토 (4520363)

막는 문제(blocker)는 없어요. 고쳐야 할 것 7개, 참고 몇 개예요.

**테스트:** `node --test tests/*.test.mjs` 결과 1670개 중 1669개 통과, 1개 실패. 실패한 건 `tests/plugincode.test.mjs:41` 하나인데, 제가 복사본을 scratchpad에 둬서 옆의 다른 복사본(orc 폴더)을 확장으로 잡은 것이에요. 이번 변경과는 관계없어요.

### 마리나라와 똑같은 것 (줄 단위로 대 봄)
- **파일 4개는 TS 타입만 뺐고 나머지는 같아요:** `translation.store.js`, `quote-format.js`(diff로 확인), `translation-prompt.js`(지시문 한 글자도 같음), `translator-defaults.js`(DeepL 키 둘과 제공자 둘만 빠짐).
- **`translation.service.js`:**
  - 그대로인 것: 사용자 줄, 온도 0.3, 시스템 프롬프트 처리(trim → 기본값 → `{{targetLanguage}}` 바꾸기), 결과 trim.
  - Google 요청: gtx 주소와 인자, 15초, 1MB, 조각 잇기.
  - 자동 번역: 건너뛰기 규칙(translationHidden · hiddenFromUser · commandOnly, 같은 원문이면 건너뜀), 표시를 먼저 남기는 순서, 빈 번역이면 오류.
- **`use-translate.js`:** 기다리던 요청 재사용 · 줄 세우기, invalidated 처리, 토글로 숨기기(translationHidden: true를 저장), 실패 토스트가 같아요.
- **나머지:**
  - `translate-text.js` · `draft-translation.js`: 같아요.
  - `use-translator-defaults.js`: 알림 글 3개가 en.json과 뜻이 같아요.
  - `seedFromMessages` · `translationDisplayOnly` 조건: 같아요.
  - 나뉜 답: 앞 조각부터 번역해요.
  - 서버 상태의 translating: 1.5초마다, 30분까지, 요청 시간 제한 15초.
  - 보낼 때 번역: 실패하면 원문을 보내고 알림 글도 같아요.
- **invalidateTranslation:** 마리나라에서 부르는 곳은 `GameSurface.tsx` 8811 · 8835 · 8849뿐이에요(게임 모드만). 그래서 "대화 모드는 고쳐도 번역을 그대로 둔다"는 문서 말이 맞아요.
- **번역 오류 · 로그 글:** 모두 뜻이 같은 합니다체예요.
- **Google 5000자 글에서 "DeepL or"를 뺀 것:** DeepL이 없어서 맞는 판단이고, 문서에도 적혀 있어요.
- **옛 값 "deepl" · "deeplx":** 모르는 제공자로 버려져 Google로 읽혀요. 마리나라가 모르는 제공자를 버리는 것과 같아요.

### 고쳐야 할 것 (should-fix)
1. **답장 뒤 처리 중 오류가 나면 번역을 아예 안 보내요.**
   - 우리: `src/phone2go.js:186`, `:263`. `afterTranslation`이 `after`의 맨 끝(상태 · 카드 · `line.save` · handOff 다음)에 있어서, 그사이에 오류가 나면 표시만 남은 말이 번역되지 않아요.
   - 마리나라: `generate.routes.ts:16266`, `:16278`. 오류가 나도 finally에서 이미 저장된 답은 번역해요.
   - 고칠 것: `took`이나 `after` 첫머리에서 번역을 시작하고, 알림(`replied`)만 그 약속을 기다리게 해요. runLive의 catch 길에서도 보내요.
2. **번역 설정을 "요청 시작 때"가 아니라 "보낼 때" 읽어요.**
   - 우리: `src/phone2go.js:191`이 `autoTranslateOn`을 다시 봐요. `phone2translate.js:270`의 `browserAutoTranslate`와 `plugin/work.mjs:296`도 그때 설정을 읽어요. 그래서 그사이 자동 번역을 끄면 표시만 있고 번역 안 된 말이 남아요.
   - 마리나라: `generate.routes.ts:1991`. 시작할 때 `outputTranslationConfig`를 한 번 잡아 표시와 번역 둘 다에 써요.
   - 저장 모양 때문에 어쩔 수 없는 차이가 아니에요. 고칠 것: gather에서 `job.trConfig = autoTranslateOn ? translationConfigOf : null`로 잡아 두고, 표시와 보내기 모두 그 값만 써요.
3. **"번역만 표시"일 때 복사가 원문을 복사해요.**
   - 우리: `src/phone.js:1529`의 `.na_ob_mcopy`가 `x.text`를 복사해요.
   - 마리나라: `ConversationMessage.tsx:793~801`은 `displayedContent`를 복사해요.
   - 고칠 것: `liveTranslationView(...).displayedContent`를 복사해요. 이 일을 디자인 세션 메시지에 넣어도 돼요.
4. **토큰 어림이 틀렸어요.**
   - 디자인 메시지 4번의 "글자 수 ÷ 4 정도로"는 틀려요. 마리나라 `shared/utils/token-estimator.ts`는 글자 종류마다 달라요: 한글 0.5, 한자 · 가나 0.67, 나머지 0.25, 올림. 표시 글은 `~{{tokens}} tokens`이고 숫자는 `toLocaleString`이에요(`client/lib/character-token-count.ts:6`).
   - 고칠 것: `estimateTextTokens`를 `src/marinara/`로 가져오고, 디자인 메시지를 고쳐요. 글은 "~N 토큰"으로 옮겨요.
5. **디자인 메시지에 빠진 것.**
   - 보내기 옆 초안 번역 단추는 마리나라에서 `hidden ... sm:flex`예요(`ConversationInput.tsx:2350~2355`). 좁은 화면(폰)에서는 안 보이고, 도구 탭 것만 늘 보여요.
   - 고칠 것: 이 점을 디자인 메시지에 적어요.
6. **브라우저 경고 로그의 %s가 안 바뀌어요.**
   - 우리: `phone2translate.js:273`. `console.warn('[narrative-archive]', fmt, id, err)`처럼 첫 인자가 형식 글이 아니라서, 로그에 "%s"가 그대로 찍혀요.
   - 고칠 것: `'[narrative-archive] ' + fmt`처럼 형식 글을 첫 인자로 합쳐요.
7. **MARINARA-PORT.md 번역 칸에 차이로 적어야 할 것.**
   - (a) 마리나라는 번역 설정이 **채팅(방)마다**인데, 우리는 Orbit 전체가 함께 써요. 새 방은 기본값을 받지 않아요. 지금 문서는 "저장 자리"로만 적혀 있고 차이라고 말하지 않아요.
   - (b) 플러그인이 없을 때 자동 번역 도중에 채팅을 바꾸면 그 번역은 저장되지 않아요. 마리나라는 서버가 저장해요.
   - (c) 실리 연결 프로필(`profile:`)의 최대 토큰은 늘 4096이에요(`phone2translate.js:162`).
   - (d) Google 응답 본문을 읽다가 시간이 넘으면 "Google 번역 요청 시간이 초과되었습니다" 대신 날것의 TimeoutError가 나요(`translation.service.js:220`의 `readCapped`가 `.catch` 밖에 있어요). `.catch` 안으로 옮기면 돼요.
   - (e) `enqueueTranslationPersistence`의 저장 뒤 두 번째 `isValid()` 확인이 빠졌어요(`use-translate.ts:42`). 지금은 무효로 만드는 곳이 없어서 동작은 같아요.

### 참고 (note)
- **문서 주장:** MARINARA-PORT.md 번역 칸의 주장은 위 7번 말고는 코드와 맞아요. "일부"(프로필 얹기 · 설정 마법사)와 "디자인 세션 몫"(DeepL 고르기 빼기, 복원 · 기본값 단추, 초안 번역 단추)도 솔직하게 적혀 있어요. 지금 화면에서 DeepL을 고르면 "번역 서비스는 google 또는 ai여야 합니다." 알림이 떠요.
- **동작이 바뀐 점:** 기본값이 마리나라대로 'en'에 자동 번역 꺼짐이라, 이제 새 답장에 한국어가 붙지 않아요. 소망이 내 언어를 ko로 두고 자동 번역을 켜야 해요.
- **따옴표 바꾸기:** 마리나라는 내 말을 그릴 때와 번역 원문을 만들 때 `formatTextQuotes`를 써요(`ConversationMessage.tsx:443`). 우리 화면에는 없어서, 지금은 원문이 그대로 일관돼요.
- **서버 상태 응답:** 번역 중이면서 전에 계산해 둔 값이 없으면 `can: true`로 답해요(`plugin/work.mjs:526`).
- **보내는 중 폰을 닫으면:** 번역하는 동안 폰을 닫으면 메시지를 보내지 않고 끝나요(`phone.js:1818`). 마리나라는 계속 보내요.
- **en.json 대조:** 디자인 메시지의 화면 글은 위 4 · 5번만 빼고 en.json과 다 맞아요. 섹션 도움말의 "for Game mode"를 뺀 것도 괜찮아요.