# 개발 · 테스트 · 배포

## 바로 보기

빌드가 없습니다. `index.html`을 고치고 새로고침하면 됩니다. 단, **마이크·화면 공유·AI 모델은 `file://`에서 동작하지 않으므로** 로컬 서버로 여세요.

```bash
node tools/serve.js          # http://localhost:8766/
```

자주 쓰는 주소: `?bg=lighthouse&time=dusk`, `?scene=lively`, `?ai=1`.

## 테스트 도구 (`tools/`, Playwright)

```bash
cd tools && npm install && npx playwright install chromium   # 처음 한 번(promo는 설치된 Chrome 사용)
node synth-piano.js            # tools/out/piano.wav + truth.json (정답 악보)
node synth-piano-wide.js       # 넓은 음역 세트
node serve.js &                # 서버
node accuracy.js               # 기존 방식 정확도
AI=1 node accuracy.js          # AI 음 인식 정확도 (WIDE=1 로 넓은 음역)
node render-scenes.js          # 배경×시간대 스크린샷 → tools/out/
node promo.js                  # 10초 홍보 영상 → tools/out/promo.mp4
```

`accuracy.js`는 합성 피아노를 가짜 마이크로 넣고 `RK.hitLog`(생성된 빗방울)를 정답과 맞춰 precision/recall과 음역별 recall을 출력합니다. 음 인식을 고치면 반드시 이 숫자를 전후로 비교하세요. 현재 기준값은 `docs/ARCHITECTURE.md` 3장에 있습니다.

화면을 고친 뒤에는 `render-scenes.js`로 네 배경 × 네 시간대를 확인하는 것이 좋습니다(특히 아침처럼 밝은 장면은 하얗게 날아가기 쉬움).

## 배포 (GitHub Pages)

`main`에 푸시하면 https://bgm5768.github.io/rain-keys/ 에 1~2분 뒤 반영됩니다(브랜치 루트, `.nojekyll`). 빌드가 '빌드 중'에서 멈추면 새로 요청하세요:

```bash
gh api -X POST repos/bgm5768/rain-keys/pages/builds
```

반영 확인은 새로 넣은 코드 문자열이 페이지에 있는지 보면 됩니다(`curl -s "https://bgm5768.github.io/rain-keys/?x=$RANDOM" | grep -c 함수이름`).

## 데스크톱 앱

```bash
cd desktop && npm install
npm start        # 앱
npm run saver    # 화면보호기 모드
npm run dist     # 설치 파일(필요: Go)
```

## 작업 원칙(지금까지 사용자와 정한 것)

- UI 문구는 한국어, 짧고 쉽게. 긴 설명문 대신 ⓘ 툴팁. 단축키 안내는 두지 않음(`A` 번개는 숨은 이스터에그).
- 비는 소리에서 나옴. 예외는 **환경음을 켰을 때**의 무작위 비뿐.
- 목표는 "실제 3D 세계에 카메라만 낮게 둔" 실사 느낌. 화면이 바쁘거나 물이 스스로 흐르는 것처럼 보이면 안 됨(잔잔함 우선).
- 랜덤해 보여야 하는 것(번개, 파도, 등대 회전)은 고정 간격 대신 무작위 간격·크기.
- 처음 기본값: 오로라 호수 · 실시간 · 잔잔한 비 · 보통 · 빠르게, 나머지 끔.
- 커밋 메시지는 한국어로 무엇이 바뀌었는지. 큰 변경은 데스크톱·모바일 화면 크기에서 fps와 에러를 확인한 뒤 푸시.

## 알려진 한계 · 다음 후보

- AI 음 인식은 테스트 단계: 실제 녹음·휴대폰 성능 미측정. 켜면 0.3초쯤 늦게 인식(떨어지는 시간으로 상쇄).
- 공유 창 '공유' 클릭은 브라우저 정책상 생략 불가(데스크톱 앱만 가능).
- 등대 바다의 흰 포말은 노을빛에서 잘 안 보임. 눈·강한 바람 장면은 구조만 준비됨(`SCENES.precip`).
- 크롬 확장 포팅은 검토만 함(탭 소리는 `chrome.tabCapture`로 공유 창 없이 가능).
