# 지시문(AI_SYS_*) 형식 규칙

모델에 보내는 지시문을 새로 쓰거나 고치는 세션은 **먼저 이 문서를 읽어요.**
모든 지시문은 같은 형식을 따라요. 형식이 다르면 모델이 블록을 헷갈리고, 사람도 나중에 비교를 못 해요.

## 형식

```
GOAL
무엇을 쓰는지 한두 문장.

YOU GET
- 실제로 보내는 블록 이름 그대로, 하나도 빠짐없이.
- (sometimes)는 없을 때도 있는 블록.

(규칙 칸들: 앱이나 일 이름을 대문자 제목으로. 예: SCREEN TIME, ACCOUNTS, LANGUAGE)
- 한 줄에 하나.

JSON (one object, nothing before or after it)
{ 답 모양 }
Numbers are plain JSON numbers.
```

## 받는 것(YOU GET) 규칙

1. **블록 이름은 코드가 보내는 `[이름]` 그대로 써요.** "캐릭터", "이야기", "the story so far"처럼 뭉뚱그리지 않아요.
2. **보내는 블록은 전부 적어요. 안 보내는 블록은 적지 않아요.** 코드에서 블록을 더하거나 빼면, 같은 커밋에서 지시문 목록도 고쳐요.
3. **`sideRequest`로 보내는 채우기는 이 줄을 그대로 써요.**
   ```
   - ARCHIVE, RECENT CHAT, OWNER, and sometimes STORY YEAR, WORLD, LOREBOOK, OWNER PROFILE and OWNER DOESN'T KNOW. Nothing on the phone may show what the owner doesn't know.
   ```
   - 아카이브가 없으면 ARCHIVE 자리에 본문이 들어가요(블록 제목이 스스로 설명해요).
   - OWNER PROFILE을 안 넘기는 요청이면 그 이름만 빼요.
4. **OWNER DOESN'T KNOW를 받는 지시문에는 "폰에 아는 것처럼 쓰지 않기" 규칙이 꼭 있어야 해요.**
5. 블록 안에 설명이 같이 들어가는 블록(NAMES, ONLY THESE, BODY ON THE PHONE NOW …)은 목록에 없어도 돼요.

## 고칠 때 확인

- 지시문의 YOU GET과 그 지시문을 부르는 코드의 `` `[이름]\n` `` 블록을 나란히 놓고 하나씩 대 봐요.
  - 템플릿 문자열 안의 블록은 `\n`이 붙어 있어서 grep에 안 걸릴 수 있어요. `` `[이름] `` 으로도 찾아요.
- 토큰 수(늘어난 만큼)를 소망에게 보고해요.
- `node --test tests/*.test.mjs`, 반영 지시문이면 퍼즈(`tests/fuzz/reflect.fuzz.mjs`)까지 돌려요.

## 기록

- 3.170.28: 폰 지시문 25개를 대조해서 맞췄어요. 생활 · 배달 · 은행 · 음성 메모 · 기기 · 스크린타임 채우기에 OWNER DOESN'T KNOW 규칙이 빠져 있었어요.
