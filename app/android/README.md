# NarrativeArchive 앱 (껍데기)

폰 안의 실리태번(기본 `http://127.0.0.1:8000`)을 화면 꽉 채워 띄우는 앱이에요. 상단바 · 하단바가 지금 폰 화면 색을 따라가요.

## 받기
GitHub › Releases › `shell-latest` › `NarrativeArchive.apk` 를 폰에서 받아 설치해요. (Actions › Shell APK › Run workflow 로 새로 만들 수 있어요)

## Termux로 켜기 (앱의 "Termux로 켜기" 버튼)
1. Termux에서 한 번: `mkdir -p ~/.termux && echo "allow-external-apps = true" >> ~/.termux/termux.properties` 후 `termux-reload-settings`
2. 앱이 처음 물어보는 "Termux 명령 실행" 권한을 허용해요
3. 켜는 명령은 꺼진 화면에서 바꿀 수 있어요 (기본 `cd ~/SillyTavern && ./start.sh`)

## 알아 둘 것
- 캐릭터 폰을 열면 기기 상단바가 숨어요(위에서 끌어내리면 잠깐 나와요). 닫으면 돌아와요.
- 앱이 꺼지면 다음에 켤 때 "지난번에 앱이 꺼졌어요" 창이 떠요. "복사"를 눌러 보내 주면 원인을 볼 수 있어요. 화면만 멈춘 건 앱이 알아서 다시 불러와요.
- 앱 안의 실리태번은 크롬과 저장소가 따로예요: 브라우저 저장소(localStorage)에만 있는 것은 넘어오지 않아요. 실리태번 서버에 저장된 채팅 · 캐릭터 · 설정은 그대로예요.
- 서명 키를 정하기 전까진 새 판을 깔 때 먼저 지워야 해요 (`.github/workflows/shell-apk.yml` 맨 위 설명).
