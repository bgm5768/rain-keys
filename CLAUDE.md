# Rain Keys

소리를 듣고 음 높이·박자대로 빗방울을 떨어뜨리는 실사풍 웹앱. 앱 전체가 `index.html` 한 파일(빌드 없음), GitHub Pages(`main` 루트)로 배포.

## 먼저 읽을 것

- `docs/ARCHITECTURE.md` — 파일 구조, 한 프레임의 흐름, 음 인식, 렌더링, 장면 데이터(`SCENES`/`BGS`/`TODS`), 소리 합성, 설정 저장
- `docs/DEVELOPMENT.md` — 로컬 실행, `tools/` 테스트(정확도·장면 스크린샷·홍보 영상), 배포, **사용자와 정한 작업 원칙**

## 꼭 지킬 것

- UI 문구는 한국어, 짧게. 단축키 안내 없음(`A` = 숨은 번개 이스터에그만).
- 비는 소리에서만 나옴(예외: 환경음을 켰을 때의 무작위 비).
- 잔잔한 실사 우선: 화면이 바쁘거나 물이 스스로 흐르는 것처럼 보이면 안 됨.
- 음 인식을 고치면 `tools/accuracy.js`로 전후 precision/recall을 비교하고 결과를 남김.
- 화면을 고치면 데스크톱·모바일 크기에서 fps와 콘솔 에러를 확인하고, 밝은 장면(아침)도 확인.
- 마이크·AI 모델은 `file://`에서 안 됨 → `node tools/serve.js`.
- 처음 기본값(오로라 호수 · 실시간 · 잔잔한 비 · 보통 · 빠르게, 나머지 끔)을 바꾸지 말 것.

## Agent skills

### Issue tracker

Issues live in GitHub Issues for `bgm5768/rain-keys`, managed with the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

Default vocabulary: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: one `GLOSSARY.md` and `docs/adr/` at the repo root, created lazily. See `docs/agents/domain.md`.
