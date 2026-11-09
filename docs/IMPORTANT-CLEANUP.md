# `!important` 정리 기록 (1,151개 → 227개)

`css/*.css`의 `!important`를 화면 하나 안 바꾸고 줄인 작업의 전 과정과 도구예요. 다음에 또 줄이거나, 새 화면을 만들다 `!important`가 필요해 보일 때 이 문서부터 봐요.

| 장 | 무엇 |
|---|---|
| 1. 규칙 | 절대 지키는 것 |
| 2. 왜 이렇게 많았나 | 쌓인 이유, 방패 구조 |
| 3. 한 파일 정리 순서 | 매번 똑같이 하는 순서 |
| 4. 도구 | 쓰는 명령, 각자 하는 일 |
| 5. 사고 기록 | 실제로 깨진 것과 배운 것 |
| 6. 지금 남은 227개 | 왜 남았는지 |
| 7. 다음에 할 수 있는 것 | |

관련 문서: `docs/CSS-CLEANUP-PLAN.md`(처음 계획 · 안전망 뜻), `tools/dev/css-harness/README.md`(캡처 도구 사용법), `docs/DESIGN.md` 4장(테마 충돌 규칙).

---

## 1. 규칙

- **`!important`는 절대 늘리지 않아요.** `tests/css.budget.json`의 `important`가 막고 있어요. 줄이면 그 숫자도 같이 내려요. 올려서 맞추지 않아요. (`lines`는 새 화면이 생기면 올라가도 돼요.)
- **"같아 보여요"가 아니라 기계로 증명해요.** 정리 전후 캡처의 계산된 스타일(창 안 모든 요소, 호버 · 포커스 포함)이 **0개 다름**이어야 커밋해요.
- **세 가지 조건에서 다 0이어야 해요.** 소망 테마(Blue Lemonade 켬), 테마 끔(ST 기본), 못된 테마(`hostile.css`). `!important`는 대부분 테마를 이기려고 있어서, 테마를 하나만 보면 반드시 놓쳐요.
- **그 규칙이 실제로 화면에 나오는지 먼저 봐요.** 캡처 장면에 그 클래스가 한 번도 안 나오면 "0개 다름"은 아무 뜻이 없어요. 장면을 먼저 더하고 정리해요(5장 사고 대부분이 이거예요).
- **확인 못 한 건 남겨요.** 장면으로 못 여는 화면(투자 앱 일부, 이탈 메시지, 파일 고스트 등)의 `!important`는 지우지 않았어요.
- 파일 하나 = 커밋 하나예요. 작업 브랜치에서 하고, 메인은 소망 OK 뒤에 올려요. 커밋 제목에 몇 개 → 몇 개, 어떤 조건에서 확인했는지 적어요.

## 2. 왜 이렇게 많았나

- SillyTavern 테마는 모든 `button` · `label` · `input` · `select` · `.menu_button`에 배경 · 테두리 · 그림자 · 글꼴을 칠하고, 어떤 테마(소망이 쓰는 Blue Lemonade 포함)는 `!important`까지 써요.
- 창 하나 고칠 때마다 원래 규칙을 고치지 않고 끝에 더 센 규칙(`!important`, `:not(#na_x)`)을 붙여 이겼어요. 그래서 같은 속성에 `!important`가 겹겹이 쌓였어요.

**해결 방법은 "방패"예요.** `!important`는 방패 규칙 한 곳에만 두고, 나머지 규칙은 변수만 정해요.

| 방패 | 파일 | 변수 | 덮는 것 |
|---|---|---|---|
| 휴대폰 방패 | `css/52-phone-sns.css` | `--axbg` `--axsh` `--axfs` `--axfg` `--axff` `--axls` `--axr` … | 폰 안 모든 `button` · `label` |
| 컨트롤 방패 | `css/69-components.css` | `--c-*` | 확장 패널 · 팝업의 버튼 · 입력칸 · 칩 |
| 닫기 줄 방패 | `css/61-ask-fix.css` | `--k-h` `--k-fs` `--k-flex` `--k-bg` `--k-fg` `--k-sh` `--k-op` | 팝업 아래 닫기 · 하는 일 버튼 줄 |
| 확인 팝업 버튼 방패 | `css/45-theme-guard-confirm.css` | `--k-bg` `--k-bc` `--k-fg` `--k-sh` | 확인 창의 취소 · 하는 일 |

```css
/* 방패: !important는 여기 한 번만 */
… .menu_button.menu_button.menu_button { background: var(--k-bg, …) !important; opacity: var(--k-op, 1) !important; … }
/* 나머지는 변수만 */
dialog.popup:has(.na_cp3) .popup-button-ok.disabled { --k-op: 0.5; pointer-events: none; }
```

- 방패 선택자는 `:not(#na_x):not(#na_y):not(#na_z):not(#na_w)`(아이디 넷) + `.menu_button` 세 번처럼 우선순위를 크게 올려 둬요. 테마의 `!important`끼리 붙으면 우선순위가 큰 쪽이 이기기 때문이에요.
- 방패가 덮는 버튼에 `background:`를 직접 쓰면 안 먹어요. 변수를 써요(`docs/DESIGN.md` 4장).

## 3. 한 파일 정리 순서

1. **서버 띄우기.** 로컬 SillyTavern(:8000)과 가짜 모델(`tools/dev/fakeph.mjs`, :5555). 둘 다 2시간이면 꺼지니 `run_in_background` + 긴 timeout으로 띄우거나 `stkeep.sh`를 돌려요.
2. **확장 복사.** `cp -r src css style.css manifest.json ~/sillytavern/data/default-user/extensions/NarrativeArchive/`
3. **이 파일 규칙이 나오는 장면 확인.** `impstrip.py`가 `out/nb10` 기준 캡처에서 이 파일 클래스가 나오는 장면을 알아서 골라요. 0개거나 너무 적으면 `scenes.cjs`에 장면을 먼저 더해요(예: phone-lock, phone-cam, calendar-day, chatpick).
4. **자동 정리.** `BL_PARK=<임시폴더>/bl-ext python3 tools/dev/css-harness/impstrip.py css/X.css [--scenes a,b]`
   - 기준 캡처(원본, 테마 끔 · 켬) → 모든 `!important` 뗀 캡처 → 바뀐 요소에 닿는 이 파일 규칙만 `!important`를 되돌림 → 바뀐 게 0개가 될 때까지 반복(최대 6바퀴).
   - 끝에 `done: 36 → 9`처럼 찍혀요. `giving every !important back`이 찍히면 실패라서 원래대로 둬요.
   - 여러 파일을 줄줄이: `NA_BRANCH=<작업 브랜치> tools/dev/css-harness/impchain.sh css/A.css css/B.css`(깨끗이 끝난 것만 예산 내리고 테스트 → 커밋 → 푸시).
5. **못된 테마로 한 번 더.** `python3 tools/dev/css-harness/cmpgen.py css/X.css hostile <장면들>` → `done 0 changed`여야 해요. 아니면 바뀐 줄의 `!important`를 되돌려요.
6. **한 줄씩 손으로(남은 것).** `tools/dev/css-harness/tryone.sh css/X.css '<그 줄에만 있는 글자>' <장면들>` — 그 줄의 `!important`만 떼고 켬 · 끔 · 못된 테마 셋 다 0이면 남기고, 아니면 되돌려요.
7. **움직임 규칙은 손으로 세요.** 캡처는 애니메이션을 안 봐요. `prefers-reduced-motion` 규칙은 "0개 다름"이 나와도 믿지 말고, `reduce: true` 장면(phone-weather-still, phone-home2-still)에서 `document.getAnimations()`로 움직이는 요소 수를 정리 전후로 세서 같아야 해요.
8. **예산 · 테스트.** `tests/css.budget.json`의 `important`를 새 개수로 내리고 `node --test tests/*.test.mjs`.
9. **실제 폰 / 창 눈으로 보기.** 바꾼 파일이 그리는 화면을 `tools/dev/probe.cjs`로 찍어 원래와 비교해요. 특히 잠금 화면처럼 캡처 장면이 없던 곳.
10. 커밋(파일 하나) → 작업 브랜치 푸시 → 소망 OK → 메인(버전 두 곳 같이).

## 4. 도구

모두 `tools/dev/css-harness/`에 있어요.

| 도구 | 하는 일 |
|---|---|
| `capture.cjs <라벨> [--nopng] [--st default,hostile] [--w 412] [--only 장면들]` | 장면마다 창 안 모든 요소의 계산된 스타일(50가지, 호버 · 포커스 강제 포함)을 JSON으로, 원하면 PNG도 떠요. 폰 장면은 폰 만들기 준비 화면(preplink → prepmake → askPair b)을 거쳐 열어요. `reduce: true` 장면은 `prefers-reduced-motion: reduce`로 떠요. |
| `scenes.cjs` | 찍는 장면 목록. 이번에 더한 것: phone-make · prep · ask · photoone · looks · cam · home-gray · lock · settheme · wlist · diaryone · home2-wx · timer · weather-still · home2-still, calendar-day, chatpick, fadepick |
| `compare.cjs a b [--diffs]` | 두 라벨의 캡처를 비교. 하나라도 다르면 exit 1 |
| `impstrip.py css/X.css [--scenes] [--iters]` | 3장 4번의 자동 정리. 작업 폴더는 `out/imp_<이름>/`(`orig.css` 원본, `keep.json` 남긴 선언). `_done.json`이 있으면 기준 캡처를 다시 안 찍고 이어요. |
| `cmpgen.py css/X.css <st> <장면들>` | 그 파일의 HEAD와 작업본을 한 테마에서 비교(`DIFF …` 줄, 끝에 `done N changed`) |
| `tryone.sh css/X.css '<글자>' <장면들>` | 한 줄의 `!important`만 떼고 켬 · 끔 · 못된 테마 셋 다 비교, 남기거나 되돌림 |
| `impchain.sh css/A.css …` | `impstrip`을 여러 파일에 차례로, 깨끗한 것만 커밋 · 푸시(`NA_BRANCH` 필요) |
| `stkeep.sh` | :8000이 안 대답하면 SillyTavern을 다시 띄움(백그라운드로) |
| `hostile.css` | 못된 테마. 모든 컨트롤을 자주색 · 파란 점선 · 노란 그림자로 `!important` 칠해요 |
| `leak.cjs` | 못된 테마가 새는 요소 목록 |
| `deadrules.cjs` · `prune.cjs` | 어디서도 이기지 못하는 규칙 찾기 · 지우기 |
| `relax.cjs` · `relaxloop.py` | 구간의 `!important` · `:not(#na_x)` 떼기(옛 방식, impstrip 전) |
| `phonevars.py` · `ctlvars.py` · `fieldvars.py` · `varblock.py` | 방패 변수로 옮기는 변환(배경 → `--axbg` 등) |
| `tests/css.test.mjs` + `tests/css.budget.json` | 줄 수 · `!important` · `:not(#na_x)` · 양쪽 테마 규칙 수 예산 |

**Blue Lemonade 켜고 끄기:** 테마 확장 폴더 `~/sillytavern/data/default-user/extensions/blue-lemonade`를 임시 폴더(`BL_PARK`, 기본 `<임시>/bl-ext`)로 옮기면 꺼지고, 되돌리면 켜져요. 도구가 끝나면 켠 상태로 돌려놔요. 중간에 죽으면 폴더가 어디 있는지 먼저 봐요.

**임시 폴더:** `tryone.sh` · `impchain.sh`는 `NA_SCRATCH`(기본 `/tmp/na-css`)에 로그와 백업을 둬요.

## 5. 사고 기록 (같은 실수 안 하려고)

| 무엇 | 왜 | 고친 것 · 배운 것 |
|---|---|---|
| 54 정리 뒤 **잠금 화면 시계 · 날짜가 깨짐** | 캡처 장면에 잠금 화면이 없어서 "0개 다름"이 나왔어요 | `cg_lkclock` · `cg_lkdate`의 `!important` 되살림, `phone-lock` 장면 추가. **그 클래스가 장면에 나오는지 꼭 확인** |
| 52 한국어 버튼 · 55 위젯 · 70 `.on/.plain` · 20 `dr2_msg` | 같은 이유(장면에 안 나옴) | 장면을 더해서 다시 재거나, 못 여는 건 되살려 남김 |
| 53 카메라 셔터 | 테마 켬 · 끔은 0인데 **못된 테마에서만** 깨짐 | 되살림. 못된 테마 비교를 순서에 넣음 |
| reduced-motion 규칙 "0개 다름" | 캡처가 애니메이션을 안 봄. 손으로 세니 94개 중 73개가 계속 움직였어요 | 둘 다 되돌림. 움직임 규칙은 `getAnimations()`로 손으로 셈 |
| 규칙 번호로 고치다 **규칙이 둘로 복사되고 라이트 변수가 덮임** | 파일이 바뀐 뒤 옛 번호를 썼어요 | git에서 되살리고 글자로 찾아 다시 함. 번호가 아니라 글자로 고쳐요 |
| 61 비교가 무의미했음 | stash가 섞여 HEAD와 작업본이 같은 걸 비교했어요 | `git checkout stash@{0} -- 파일`로 되찾고 다시 비교. 비교 전 `git diff --stat`로 바뀐 게 있는지 봐요 |
| 테스트 스크립트가 15분 넘게 멈춤 | `evaluate` 안에서 `openPhone()`을 await함(폰이 닫혀야 끝나요) | await 안 함 |
| 컨테이너 재시작 | 반쯤 바뀐 css가 남았어요 | 원본(`out/imp_*/orig.css`)으로 되살리고 `_done.json` 기준으로 이어 돌림 |
| 메인 합칠 때 예산 충돌 | 서로 다른 세션이 `css.budget.json`을 같이 고침 | 줄 수는 메인 것, `important`는 실제로 센 수 |
| 캡처가 "폰 만들기"에서 멈춤 | 폰 만들기 준비 화면이 생겨서 바로 잠금 화면이 안 나옴 | `capture.cjs` · `probe.cjs`가 준비 화면을 거치게 고침 |
| 필드 방패(`--f-*`) 시도 | 오히려 `!important`가 늘었어요 | 뺐어요. 방패는 한 규칙에 모일 때만 이득 |

## 6. 지금 남은 227개

| 파일 | 개수 | 왜 남았나 |
|---|---|---|
| `69-components` | 55 | 컨트롤 방패 자체(필요) |
| `54-phone-layer` | 33 | 폰 창 자체 규칙, 잠금 화면 시계 · 날짜 |
| `45-theme-guard-confirm` | 23 | 확인 팝업 방패 |
| `61-ask-fix` | 20 | 닫기 줄 방패 |
| `42-home` | 16 | 홈 탭. 90개 중 74개를 뗐고, 남은 16개는 떼면 테마 켬 · 끔에서 화면이 달라졌어요 |
| `31-screen-fixes` | 14 | 창 고침. 20개 중 6개를 뗐고, 남은 건 떼면 화면이 달라졌어요 |
| `52-phone-sns` | 11 | 휴대폰 방패 자체 |
| `55-phone-invest` | 10 | 투자 앱. 장면으로 다 못 열어서 확인 못 했어요 |
| `57-phone-delivery` | 9 | 폰 확인 창 · 배달 |
| `10-base` | 8 | 기본. 73개 중 65개를 뗐고, 남은 건 떼면 화면이 달라졌어요 |
| 나머지 12개 파일 | 28 | 1~5개씩. 못된 테마 · 움직임 · 못 여는 화면 |

## 7. 다음에 할 수 있는 것

- 투자 앱 · 이탈 메시지 · 파일 고스트를 여는 장면을 `scenes.cjs`에 더하면 그 파일들도 더 줄일 수 있어요.
- `42-home` · `31-screen-fixes`는 컨트롤 방패 변수(`--c-*`)로 옮기면 줄 수 있어요(방패가 이미 덮는지 먼저 `leak.cjs`로 봐요).
- 새 화면은 처음부터 방패 변수만 써요. 그러면 이 문서의 일을 다시 할 일이 없어요.
