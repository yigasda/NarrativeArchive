# 인수인계 (2026-11-24, 주간 할당량이 끝나 멈춤 → 약 5일 뒤 새 세션)

다음 세션은 이 파일부터 읽어요. 그다음 CLAUDE.md, docs/MARINARA-PORT.md, docs/SERVER-HANDOVER.md.
이 폴더의 다른 파일에 적힌 `/tmp/claude-0/...` 경로(스크립트 · 사본)는 컨테이너와 함께 사라졌어요. 필요하면 다시 만들어요.

## 지금 상태

- **메인 = 3.232.24 (0ebbd21).** 들어간 것: 연결 상태 · 실리 매크로(작가 노트 · 추론 · 요약 · 그림 · 표정 · hasExtension · isMobile) · 시간대 · 언어를 서버에서도 브라우저처럼 · 마리나라 번역(구글 · AI, DeepL · DeepLX는 소망이 뺌) · 답장 지시문의 ko 빼기.
- **브랜치 `ccr-7895cb93-30ms96`:** 메인 위에 "채팅 설정을 방마다로"(2cb04a0 + "(작업 중)" 커밋들)가 있어요. **아직 끝나지 않았어요. 메인에 올리지 않았어요.**
  - 고치기 에이전트가 검토 3개(reviews/review-r1 · r2 · r3)를 반영하던 중에 멈췄어요. 마지막 "(작업 중)" 커밋까지가 남은 것이에요.
  - 다음 세션: `git log`와 `git diff 0ebbd21`로 어디까지 됐는지 보고, 아래 "방마다 설정: 남은 일"을 하나씩 확인해요.

## 방마다 설정 (소망이 정한 것)

- 우리 방 하나 = 마리나라 채팅 하나. 채팅 설정은 방마다 `room.meta`(마리나라 chat.metadata 열쇠 이름 그대로). 표: notes-room/p1~p4.
- 앱 · 폰 전체에 하나로 남는 것: 알림 · 알림음, 번역 기본값, 시간대, 메인 · 기능 모델 · 실리 연결, 카드의 일정 원본, 내 상태, 페르소나("나"는 Orbit 하나), 빠른 전환 별, 일정 생성 선호.
- 추론 레벨의 "Orbit 전체" 줄은 뺌(마리나라에 없음). 일정 생성 연결은 저장하지 않고 그 방의 연결. 하루 말 건 수는 방마다(마리나라와 같음).
- 방 밖(연락처 상태 · 폰 위치 · 매주 갱신): **그 캐릭터가 든 방 중 하나라도 일정이 켜져 있으면 따라감** (소망 '가').
- 옛 Orbit 값은 모든 방(지운 방 포함)에 한 번 복사. 표시 `w.metaPerRoom = 1`.
- **새 방의 처음 값 = 마리나라 설정 마법사(ChatSetupWizard)에서 "시작"을 누른 값** (소망 '가'): 먼저 말 걸기 켜짐, 명령 꺼짐(마법사 기본값이 없을 때), 일정 켜짐/꺼짐을 꼭 적음 등. 마법사 파일을 끝까지 읽고 빠짐없이.
- **꼭 할 것(나중):** 마리나라 설정 마법사를 통째로 가져오기 (소망, 2026-11-24). MARINARA-PORT.md "꼭 할 것"에 들어갔는지 확인.

### 방마다 설정: 남은 일 (고치기 에이전트에 시킨 것 — 들어갔는지 하나씩 확인)

1. 처음 옮기기가 브라우저 · 서버에서 겹치면 바꾼 설정이 되돌아감 → `makeKeep({ prep })`로 syncNow에서 base · server에도 옮기기 먼저 (reviews/review-r2 2번)
2. 옮긴 뒤 Orbit 값을 지우지 않기(옛 탭 · 옛 일꾼이 그대로 읽게), 새 코드는 안 읽기(grep 테스트), `newWorld`에 표시 (review-r2 3 · 6번)
3. 답장 상태 글(stateFor · Merged stateOf)이 그 방의 일정 스위치를 보게 (review-r1 1번: 끈 방에 장소가 보일 수 있음)
4. phone.js 467 · 1174 · 1176 · 1177이 방 id를 넘기게 + 디자인 메시지 (review-r1 2번)
5. 번역 기본값 저장을 방 없이 부르면 오류 (review-r1 3번)
6. tools/plugin/stbrowser · stprofile · stsmoke가 room.meta를 쓰게 (review-r1 4번)
7. 매주 일정 갱신이 그 방의 연결로 (review-r3 3번)
8. 화면에만 있던 칸(프리셋 · 로어 예산 · 기억 · 의미 검색 요약 · 요약 · 연결된 채팅 · 설정 프로필 · 안 되는 명령)을 마리나라 열쇠로 방마다 저장 (표: review-r1). 일정 생성 선호는 앱 전체, 페르소나 끄기는 방마다 아님. 화면 기본값 4·4·0.30 → 마리나라 2·3·0.15는 디자인 메시지로
9. 옮기기 테스트가 ROOM_META_KEYS 전부를 돌게
10. 새 방 처음 값 = 마법사 Start 값
그다음: 검토 2~3명 → 고치기 → 진짜 실리 확인(아래) → **버전 3.232.25 이상으로(꼭: 안 올리면 서버 일꾼이 옛 코드로 돌아 먼저 말 걸기 · 번역이 꺼져요)** → 소망에게 메인 허락.

## 디자인 세션에 전할 메시지 (소망이 전달)

- design-message-translation.md: 번역 화면(DeepL 빼기, 연결 고르기를 마리나라처럼, 번역 칸 · "번역 중…", 입력창 번역 단추, 여러 개 골라 번역 빼기, 말투 표 한 줄 "메신저 번역에는 쓰지 않습니다.")
- design-message-room-settings.md: 설정 화면이 그 방의 설정을 열게(함수가 방 id를 받음), 추론 Orbit 줄 삭제, 일정 생성 연결 변경. 고치기 에이전트가 더 적었을 수 있으니 저장소의 최신판을 봐요.

## 그다음 순서

1. 방마다 설정 끝내고 메인
2. **채팅 요약: 마리나라 것 통째로** (소망: "우리 것 쓰지 말고", 코드 · 지시문 다). 읽기부터, 끝까지.
3. 마리나라 설정 마법사 통째로 (나중)

## 진짜 실리로 확인하는 법 (컨테이너가 바뀌면 다시 준비)

- 실리 1.19.1을 받아 `npm install`, `config.yaml`의 `enableServerPlugins: true`, `plugins/NarrativeArchive`와 `data/default-user/extensions/NarrativeArchive`를 이 저장소로 `ln -s`. 한 번 켜서 기본 데이터를 만들고 `settings.json`의 `firstRun`을 `false`로. (컨테이너에 원래 있는 `/root/sillytavern`은 1.19.0이라 쓰지 않아요.)
- 돌릴 것: `node tools/plugin/stfresh.cjs <실리>` · `stwake.cjs` · `stfreeze.cjs` · `stprofile.cjs` · `stcheck.cjs` (+ `--lazy`), 오라클 `tools/st/oracle-{status,cc,profile,macros}.mjs <실리>` · `NODE_PATH=/opt/node-tools/node_modules node tools/st/oracle-tz.mjs <실리>` (오라클은 기대값 파일을 다시 쓰니 저장소 사본에서), `node tools/st/portcheck.mjs <실리>`.
- 마리나라 원본: `git clone https://github.com/Pasta-Devs/Marinara-Engine` 의 staging (번역 · 방마다 설정은 cfc726e93 기준).
- 매번: `node --test tests/*.test.mjs` (TZ=UTC로도), `tests/fuzz/*.mjs`, PHONE2_POISON 명령(SERVER-HANDOVER), eslint no-undef(plugin 7개 이하).

## 소망과 일하는 법 (꼭)

- 짧고 쉬운 한국어. 질문엔 답만, 코드는 "ㄱㄱ · 응 · ㅇㅇ" 뒤에. 메인은 허락받고. 버전은 manifest.json과 src/core.js 같이.
- 짐작으로 단정하지 않기(전에 터묵스 탓을 했다가 틀림). 모르면 코드를 읽고 말해요.
- 에이전트를 여럿 쓰고 여러 번 검토(소망이 원함). 하지만 지금 일과 상관없는 에이전트는 띄우지 않기.
- 마리나라 기능은 코드 · 지시문 그대로, 끝까지 읽고. 마리나라에 없는 걸 메신저에 더하지 않기.
- 소망의 RP 내용 · 캐릭터 이름은 저장소에 넣지 않기(예시 이름 Mara · Ren · Ivo · Varo · Lio).
