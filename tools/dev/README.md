# tools/dev — 실제 폰을 띄워 보는 도구 (확장 기능 자체엔 안 쓰임)

- `fakeph.mjs` — :5555의 가짜 모델. 폰 만들기 · 채우기 · 반영 · 검색에 정해진 답(Varo의 Mara)을 줘요.
- `probe.cjs` — Playwright로 로컬 SillyTavern을 열고 폰을 만들어 스크린샷. 모듈로 불러 쓸 수도 있어요.
- `na_test.jsonl` — 테스트 채팅(Seraphina, 메시지 30개). `data/default-user/chats/default_Seraphina/`에 넣어요.

자세한 순서는 `docs/DESIGN.md` › 실제 폰에서 확인.
