## 커밋 4520363 검토: 답장 지시문의 ko · VOICES 빼기

**결론:** 지시문 자체는 깨끗하게 바뀌었고, 테스트 1670개도 다 통과해요. 그런데 "기록에 영어와 한국어가 같이 있어서 약 15000토큰"이라는 원인은 코드와 맞지 않아요. 그래서 이번 변경으로 입력 토큰은 조금만 줄었어요. 저장소는 고치지 않았고 진짜 모델도 부르지 않았어요.

### 1. 지시문 형식 (PROMPT-RULES)
- **문제 없음.** 옛 지시문과 줄 단위로 비교했더니 바뀐 줄은 셋뿐이에요.
  - YOU GET에서 `VOICES (…for "ko" only), ` 한 조각이 빠졌어요.
  - TEXTING의 `"ko"` 줄, JSON 예시의 `"ko"` 칸이 빠졌어요.
  - 나머지는 글자 하나까지 같아요.
- `gatherReply` → `replyInput`으로 실제 요청을 만들어 블록 이름을 대 봤어요. 보내는 블록은 LANGUAGES · MESSENGER · CHAT SUMMARY · NOW · CONTEXT · OWNER'S CLOCK · WEATHER NOW · RECENT ON THE PHONE · SITUATIONS · 카드 · PERSONA · PEOPLE AROUND · OWNER DOESN'T KNOW · STORY · LAST MESSAGES · TYPED AND DELETED · WHY NOW예요. YOU GET과 다 맞고, 남는 것도 빠진 것도 없어요.
- JSON 예시와 `takeReply`(src/phone2run.js:33-58)도 맞아요. 모델이 옛 버릇으로 ko를 보내도 그냥 무시돼요.
- 지시문에 ko · Korean · VOICES · translation이 하나도 안 남았어요. 번호 매긴 규칙은 원래 없어요.
- 스케줄 있는 사람 · 반응 끈 방 · 상태 명령 끈 방에서 지시문을 고치는 부분(src/phone2reply.js:13, 22-25)도 그대로 작동해요.
- 지시문 크기는 5,715 → 5,395자(약 1,433 → 1,353토큰)로, 문서 72줄의 숫자와 같아요.
- 참고(이번 커밋 전부터): WEATHER NOW, RECENT ON THE PHONE, 카드, PEOPLE AROUND, OWNER DOESN'T KNOW는 없을 때도 있는데 "(sometimes)" 표시가 없어요.

### 2. 기록이 영어만 가는지
- **참고:** 모델에 가는 기록은 모든 길에서 `x.text`만 써요. `extra.translation`이나 옛 `ko`를 모델에 보내는 길은 없어요. 확인한 길:
  - 바로 답장 · 늦은 답 · 먼저 말 걸기: gatherJob → gatherReply (src/phone2live.js:89)
  - Merged 단체방: gatherMerged (src/phone2go.js:420)
  - 답할 사람 고르기: roomTurns (src/phone2sched.js:515)
  - 요약: src/phone2digest.js:48
  - 반영: rowOf (src/phone2reflect.js:32) · feedText (src/phone2feed.js:48). 반영 세션 몫이라 보고만 해요.
- **고쳐야 함(진단):** 31d0425에서도 MESSENGER는 `x.text`만 보냈어요. 한국어 번역은 원래부터 기록에 없었어요.
  - 그래서 "영어 + 한국어 기록 때문에 15000토큰"은 맞지 않아요.
  - 소망에게 "이걸로 15000이 풀렸다"고 말하기 전에 바로잡아야 해요.
- **참고:** 지금 입력에 남은 한국어는 두 가지예요.
  - 소망이 직접 친 페르소나의 한국어 말: "내 메시지 번역"(translateInput)이 기본으로 꺼져 있어서 그대로 가요.
  - 날씨 줄의 한국어 낱말(흐림 · 최고 · 비 확률, src/phone2live.js:18, 99).
  - 기록을 정말 영어로만 보내려면 채팅 설정 › 번역의 "내 메시지 번역"을 켜면 돼요. 마리나라 기능 그대로예요.

### 3. VOICES로 없어진 것
- **담던 것:** 설정 › 말투 표(`p.koVoice`)예요. 사람마다, 누구에게 하는지까지 적은 한국어 말투예요. 예: "Mara → Ren: 다정한 존댓말, 잔소리하면 반말". 옛 요청은 그 폰의 표를 통째로(최대 80줄) 보냈어요.
- **고쳐야 함:** 이제 메신저 번역은 이 표를 전혀 안 써요. 소망이 손으로 적은 말투가 메신저에서는 아무 말 없이 안 쓰여요.
  - 말투 화면(src/phoneapps.js:725-760)에는 그런 표시가 없어요.
  - 폰 안의 다른 앱(문자 · 게시물 등) 번역(phonetr.js fillKo)에는 아직 써요.
- 마리나라 번역은 말풍선 하나마다 `Translate the following text to {언어}:\n\n{글}`만 보내요. 그래서 함께 없어진 게 있어요.
  - 누가 누구에게 하는 말인지(존댓말 · 반말이 들쭉날쭉해질 수 있어요)
  - 용어집 이름 표기
  - 주변 인물
  - 원문에 없는 마침표 · 쉼표를 지우던 처리(`koLike`)
  - 이 셋(말투표 · 주변 인물 · 용어집)을 쓰던 `liveRetranslate`도 지워졌어요.
- 마리나라 지시문은 바꾸면 안 되니, 방법은 둘이에요.
  - 그대로 받아들이고 소망에게 알리기
  - 말투 화면에 "메신저 번역에는 쓰지 않습니다." 한 줄 넣기(디자인 세션 몫)
- 받는 응답 프롬프트에 말투를 적어도, 마리나라 번역은 말한 사람 이름을 안 넘겨서 사람마다 다르게 할 수 없어요.
- **고쳐야 함(동작이 달라짐):** 전에는 답장마다 한국어가 저절로 왔어요. 이제는 그렇지 않아요.
  - 자동 번역(`autoTranslate`)은 기본이 꺼짐이에요 (src/phone2translate.js:68).
  - "내 언어" 기본값은 마리나라 그대로 `'en'`이에요 (src/phone2translate.js:88, 92).
  - 그래서 지금 있는 채팅에서는 번역 설정에서 둘 다 바꾸기 전까지 한국어가 안 나와요. 소망에게 알리거나 번역 기본값을 저장해 둬야 해요.
- **참고(남은 옛 주석):**
  - src/phone2go.js:403: Merged 방에 "번역이 없다"고 적혀 있지만, 이제 `afterTranslation`이 Merged 방도 번역해요.
  - src/phone2feed.js:12: 메시지 모양에 아직 `ko?`가 있어요.

### 4. 토큰이 줄었는지
- **고쳐야 함(기대와 다름):** 줄긴 했는데 조금이에요.

| 무엇 | 전 | 후 |
|---|---|---|
| 지시문 | 약 1,433토큰 | 약 1,353토큰 (-80) |
| 테스트 입력(fixtures/phone2reply-input.txt) | 4,816자 · 약 1,479토큰 | 4,624자 · 약 1,363토큰 |
| VOICES 블록 | 2줄 192자 · 약 116토큰 | 없음 |

- VOICES는 말투 표가 크면 몇천 토큰이었을 수 있어요(최대 80줄 × 300자).
- 실제 크기 시험: 말 450개 방에서 400개가 들어가요. 입력은 약 11,600토큰이고, 그중 MESSENGER가 약 11,500이에요.
  - 주인(영어) 말이 약 7,900토큰이에요. 말마다 상태 `(place · doing · ~until)`가 다시 붙어요.
  - 페르소나가 친 한국어가 약 3,600토큰이에요.
  - 여기에 STORY가 최대 40,000자(약 10,000토큰) 더 붙어요.
  - 15000의 원인은 이 둘(MESSENGER · STORY)이에요.
- 출력에서는 답장마다 나오던 ko 목록이 없어졌어요.
- 대신 자동 번역을 켜면 말풍선마다 번역 요청이 하나씩 따로 가요. 요청 하나가 대략 65토큰 + 말풍선 길이예요. Google 번역을 고르면 모델 토큰은 안 들어요.

작업 파일: /tmp/claude-0/-home-user-NarrativeArchive/975737c5-a9a7-512f-9518-c3206c8f1a25/scratchpad/size.mjs, /tmp/claude-0/-home-user-NarrativeArchive/975737c5-a9a7-512f-9518-c3206c8f1a25/scratchpad/real.mjs