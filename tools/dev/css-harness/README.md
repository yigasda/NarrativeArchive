# css-harness — style.css를 고쳐도 화면이 안 바뀌었는지 기계로 재는 도구

`docs/CSS-CLEANUP-PLAN.md`의 안전망이에요. 정리 전 캡처(기준)와 정리 후 캡처를 픽셀 · 값 단위로 비교해서, 둘 다 0이어야 한 단계가 끝나요.

## 쓰는 법

로컬 SillyTavern이 :8000에 떠 있어야 해요(`docs/DESIGN.md` › 실제 폰에서 확인). 폰 화면은 `tools/dev/fakeph.mjs`가 필요한데, 안 떠 있으면 알아서 띄워요.

```
node tools/dev/css-harness/capture.cjs baseline            # 전체 행렬 (25~35분)
node tools/dev/css-harness/capture.cjs after --quick       # 라이트 · 다크 × 기본 ST 테마 × 412만 (4분쯤)
node tools/dev/css-harness/compare.cjs baseline after      # 다른 곳을 전부 출력, 하나라도 다르면 exit 1
node tools/dev/css-harness/compare.cjs baseline after --diffs   # 다른 픽셀을 빨갛게 칠한 그림도 같이
node tools/dev/css-harness/deadrules.cjs                   # 어디서도 값을 못 정하는 규칙 목록 (지워도 되는 후보)
```

- `--only layers,retitle-result` 로 장면을 고를 수 있어요. `--st default,hostile`, `--w 412` 도 돼요.
- `--skip-existing` 은 이미 찍힌 캡처를 건너뛰어요. 끊긴 돌림을 이어 찍을 때 써요.
- 10장마다 진행률과 남은 시간을 찍어요. 한 장이 평소의 5배 넘게 걸리면 `STOP`을 찍고 멈춰요(exit 3). 그러면 원인을 고치고 `--skip-existing`으로 이어요.
- 비교는 두 라벨에 **둘 다 있는 캡처만** 해요. `--quick`으로 찍은 96장을 전체 기준의 같은 칸과 비교할 수 있어요.
- 결과는 `out/<label>/` 에 쌓여요. git에는 안 올라가요(.gitignore).

```
node tools/dev/css-harness/prune.cjs            # deadrules의 safe 후보를 지우면 어떻게 되는지 (미리 보기)
node tools/dev/css-harness/prune.cjs --write    # 실제로 지움 · 줄 번호와 셀렉터가 맞는 것만
```

`deadrules.cjs`는 후보를 다섯 칸으로 나눠요. **safe**(상태 · 미디어 아님, 소스에 클래스 없음)만 자동으로 지워요. **in-src**는 코드가 그 클래스를 쓰는 거라 도구가 못 여는 화면에서 필요할 수 있어서 손으로 봐요. **state**(호버 · 포커스 · `.on` 등)와 **media**, **pseudo**(`::before` 등)는 안 지워요.

## 나머지 도구

```
tools/dev/css-harness/check.sh step41 [--only a,b]   # ST에 복사 → quick 캡처 → 기준과 비교, 한 번에 (BASE=라벨 로 기준 바꾸기)
node tools/dev/css-harness/leak.cjs                  # 못된 테마가 새는 요소 목록 (방패 만들 때 할 일 → 끝나면 비어야 하는 테스트)
node tools/dev/css-harness/dupes.cjs --from 7232     # 같은 셀렉터가 두 번 이상 쓰인 곳 (4-2)
node tools/dev/css-harness/vars.cjs [--name accent]  # --na-* 변수가 어디서 정의되고 몇 번 쓰이는지 (4-4)
node tools/dev/css-harness/blocks.cjs [--from 7232]  # 주석 블록별 줄 범위 · 길이 · 어느 창 것인지 (4-5)
node tools/dev/css-harness/relax.cjs --range A-B --what important|notx|both   # 구간의 억지 우선순위 떼기 (4-3), 되돌리기는 git checkout
node tools/dev/css-harness/sheet.cjs baseline step41 [--scenes a,b]           # 정리 전 | 정리 후 캡처 시트 한 장
node --test tests/css.test.mjs                       # style.css가 tests/css.budget.json 예산(줄 수 · !important · :not(#na_x))을 넘지 않는지
```

## 무엇을 찍나 (scenes.cjs)

- 창 22개의 처음 화면, 빈 화면 6개, 결과 · 다음 단계 화면(섹션 버전, 제목 다시 짓기 결과, 섹션 합치기 결과, 마법사 2 · 3 · 채점, 아카이브에 질문 답, 작업실 시작 전 · 2 · 3 · 4 · ⋯ 메뉴 · + 메뉴), 확인 팝업 2종, 확장 패널, 폰 4화면.
- 행렬: 확장 테마 라이트 · 다크 × ST 테마(기본 · Dark Lite · Cappuccino · 못된 테마) × 너비 412 · 1280.
- 캡처마다 PNG 한 장과 JSON 한 개예요. JSON은 창 안 모든 요소의 계산된 스타일 50가지(색 · 배경 · 테두리 · 둥글기 · 그림자 · 글꼴 · 여백 · 크기 · 표시 여부 · ::before/::after)이고, 버튼 · 입력칸 같은 건 호버 · 포커스를 강제로 켜서 그 값도 들어 있어요. 캡처에 안 보이는 상태까지 잡으려고요.

## 못된 테마 (hostile.css)

모든 `button` · `label` · `input` · `select`를 자주색 배경 · 파란 점선 테두리 · 노란 그림자로 `!important` 칠하는 가짜 ST 테마예요. 지금은 행렬의 한 칸일 뿐이라 "정리 전후가 같은지"만 봐요. 방패 블록이 생기면(계획 4-3) "우리 창 안에 자주색이 한 픽셀도 없어야 한다"는 테스트로 바뀌어요.

## 같은 결과가 나오는 이유

같은 Chromium · 같은 글꼴 · 고정된 시각(2026-10-26 12:00) · 전환 효과 0초 · 커서 숨김이라, CSS를 안 바꾸면 두 번 찍어도 픽셀이 같아요. 먼저 `capture.cjs a` 와 `capture.cjs b` 를 아무것도 안 바꾸고 두 번 찍어서 `compare.cjs a b` 가 0인지 확인하고 시작해요.
