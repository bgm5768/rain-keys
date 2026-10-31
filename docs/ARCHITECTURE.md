# Rain Keys 구조

앱 전체가 `index.html` 한 파일(약 2,500줄, 빌드 없음)입니다. 외부에서 받는 것은 AI 음 인식을 켰을 때의 TensorFlow.js(CDN)뿐이고, 나머지(셰이더·소리 합성·아이콘·모델 파일)는 모두 레포 안에 있습니다.

```
index.html              앱 전체(HTML · CSS · GLSL 셰이더 · JS)
assets/                 설정 카드 아이콘(bg-*.png, scene-*.png), AI 모델(basic-pitch/)
v1/index.html           예전 주소 → ?scene=lively 로 넘겨 줌
desktop/                Windows 앱 · 화면보호기(Electron + Go 런처)
tools/                  테스트·녹화 도구(Playwright) — docs/DEVELOPMENT.md
docs/                   이 문서들, docs/agents/(에이전트 작업 규칙)
```

## 1. 한 프레임의 흐름

```
소리 입력 ─┬─ AnalyserNode(FFT 8192) ── analyze() ──┬─ 새 음(온셋) ──▶ spawnNote() ──▶ 큰 방울(drops)
           │                                         └─ 지속음 세기 ──▶ spawnDrizzle() ─▶ 잔비(rainS)
           └─ (AI 켜면) AudioWorklet 22.05kHz ── bpStep() ── Basic Pitch ──▶ spawnNote()
                                                                         (켜면 analyze()의 새 음 검출은 쉼)
step(dt): 하늘·등대·번개·바다 갱신 → 분석 → 비 양(rainAmt) → 바람 → 방울 착수(impact → splash/ripple) → 스플래시 물리
draw():   ① 바다·하늘 셰이더 → 프레임버퍼  ② 블릿(피사계 심도·번짐·비네팅·하이라이트 압축)
          ③ 스플래시 메쉬·물방울 구(거울상 먼저)  ④ 빗줄기  ⑤ 필름 그레인  ⑥ 2D 캔버스(건반)
```

`frame()`이 `step()` · `draw()` · UI 갱신(`updateSrc`, `drawDial`, `updateAmb`)을 부릅니다. 3초 연속 40fps 미만이면 저사양(LOW)으로 자동 전환합니다.

## 2. 카메라와 좌표

- 월드 1 = 약 20cm. 카메라는 높이 `hc`에서 +Z(남쪽)를 봄. 화면 `x = cx + f·X/Z`, `y = y0 + f·(hc−Y)/Z`.
- `y0 = 0.34H`가 수평선, `f = max(0.9W, 0.85H)`.
- 건반(`keyFrac(midi)`)은 화면 위 88건반(A0~C8) 실제 배치. 방울은 그 건반의 화면 x에 떨어지도록 3D 위치를 역산합니다.

## 3. 소리 → 빗방울

| 함수 | 하는 일 |
|---|---|
| `startCapture(kind)` | `'system'`(getDisplayMedia, 전체 화면+오디오 미리 선택) 또는 `'mic'`. 출력 없이 분석만(무음 게인으로 연결) |
| `analyze(dt)` | 스펙트럼 피크(포물선 보간, 골짜기 돋보임 `PROM`) → 반음별 레벨 `L[s]` → 온셋(기준선 대비 급상승) → 45ms 모아 배음 억제(`HARM`, `HSH` 2~24배음 그림자) → `lowFix`(저음 옥타브 보정) → `spawnNote` |
| `bpStep()` | AI 음 인식. 처음 켤 때 WebGL·WASM·WebGPU 중 이 기기에서 가장 빠른 계산 방식을 재서 고름(`bpLoad`). 최근 2초(43,844샘플@22.05kHz)를 계산 시간만큼의 간격(최소 0.1초)으로 모델에 넣고, 끝 8프레임(`BP_EDGE`)을 뺀 새 구간에서 onset 확률 봉우리를 새 음으로. 문턱은 곡 분위기를 따라감(보통 0.7, 아주 조용 0.55 ~ 아주 시끄러움 0.84, C2 아래 `bp.thrLow`=0.5). 거의 같은 순간 옥타브·12도·2옥타브 떨어진 음이 훨씬 확실하면 약한 쪽은 배음 착각으로 버림(`bp.harmK`=0.85) |
| `spawnNote(s, str, tDet, late)` | 건반이 켜지고 큰 방울 생성. `late`(인식 지연)만큼 떨어지는 시간을 줄여 착수 순간은 소리에 맞춤 |
| `spawnDrizzle(midi, lv)` | 지속음 세기만큼 그 건반 주변 잔비. 환경음이 켜져 있으면 `step()`이 무작위 건반으로도 부름 |

곡 분위기 = `sens`(온셋 문턱), 비 떨어지는 속도 = `fallT`(건반→물 시간, 사실상 싱크).

### 측정된 정확도 (tools/accuracy.js, 합성 피아노)

| 세트 | 기존 방식 P / R | AI(Basic Pitch) P / R |
|---|---|---|
| 일반(`synth-piano.js`, 172음) | 0.87 / 0.87 | 0.90 / 0.98 |
| 넓은 음역(`synth-piano-wide.js`, A0~C8) | 0.70 / 0.87 | 0.88 / 0.94 |
| 실제 연주풍(`synth-piano-real.js`, 화음·페달·잔향, 290음) | 0.66 / **0.45** | 0.81 / **0.89** |

실제 연주처럼 음이 많고 겹칠수록 기존 방식은 크게 놓침(사용자 보고: "노트를 전부 못 잡음"). 시험용 주소 파라미터: `aithr`, `aithrlow`, `aiharm`, `aiedge`, `aibe`(계산 방식 고정).

AI: 인식 15~40ms·지연 약 0.18초(RTX 3080 Ti). 갤럭시 S23 Ultra 첫 측정은 인식 200ms·지연 470ms(백엔드 자동 선택·`BP_EDGE` 15→8 적용 전). 지연이 비 떨어지는 시간보다 길면 설정 카드에 '느리게' 이상을 권하는 문구가 나옴.

## 4. 렌더링

- **바다 셰이더 `FS_SEA`**: 28개 분산 파랑(`uCalm`으로 거의 끔, 등대 바다만 너울 `uSwell` + 다가와 부서지는 파도 `uWave`) + 해석적 파문 `ripple()`(최대 64개, `uWater` 0 매끈한 고리 / 1 촘촘한 파문 열차) + 절차적 잔비 고리 `rainField()`. 반사는 `sky()`.
- **하늘 `sky()`**: 시간대 색(`uZen/uMid/uHor…`) → 해 쪽 노을 → 해·달·별·은하수·오로라(`celestial`, 구름에 가려짐) → 흐르는 구름(해 쪽 면이 밝음) → 번개 → 배경 함수 `bgNeon/bgCity/bgLight/bgDream`.
- **스플래시**: CPU 물리(`splash`, `newCrater/newCrown/newJet/emit`) → 메쉬(크라운·제트·분화구)와 구 임포스터(물방울·기포). 수면 거울상도 그림. `TSCALE=3`(효과 시간축).
- **빗줄기**: 인스턴스 사각형, 꼬리 = 3D 속도 × 셔터 0.008초, 바람장 `updateWind` + 난류.

## 5. 장면 데이터(확장 지점)

| 목록 | 항목 하나 = | 새로 더하려면 |
|---|---|---|
| `SCENES` (비 효과) | 물 표현 `water`, 파문 수명 `rippleTau`, 가까운 파문 수 `nearRate`, 바람 배율 `wind`, 아이콘 | 항목 + 아이콘. 눈 같은 새 강수는 `precip` 값을 읽는 코드 추가 |
| `BGS` (배경) | 셰이더 번호 `bg`, 자체 물결 `calm`, 구름 양 `cover`, 밤 하늘색 `night`, 아이콘 | 항목 + 셰이더 `bgXxx()` + `sky()`의 분기 + `AMBP`(환경음) |
| `TODS` (시간대) | 실시간 또는 오늘 일출·일몰 기준 시각 | `todDate()`에 시각 규칙 |

설정 카드 타일은 이 목록에서 자동으로 만들어집니다(`tileRow`).

## 6. 하늘·해·달

`astro(date)`가 위도 37.5°(한국 표준시면 경도 127°) 기준으로 해(적위·균시차)와 달(위상 29.53일 주기)의 고도·방위, 오늘 일출·일몰을 계산합니다. `skyDir()`이 실제 고도 0~75°를 화면에 보이는 하늘 띠로 눌러 담고, `SKYK` 표(태양 고도별 하늘색)를 보간해 `SKY`를 만들어 약 1초에 걸쳐 바뀝니다.

## 7. 소리 효과(녹음 파일 없음, 즉석 합성)

- `initAmb()`: 빗소리('쏴—' 화이트 노이즈 + 톡톡 반복 버퍼 `patterBuf`), 물소리(브라운 노이즈 + 저주파 LFO), 도시 웅웅거림. 배경별 값 `AMBP`.
- `thunderBuf()`: 가까우면 '지직'(0.1~0.3초) → '쾅' → 들쭉날쭉 우르릉(4~7초), 멀면 낮은 우르릉. 거리 1km당 약 3초 늦게.
- `waveBuf()`: 등대 바다 파도가 부서지는 순간 그 크기만큼 '촤아—쏴아'.
- 공유로 들을 때 `restrictOwnAudio: true`로 이 페이지 소리를 분석에서 뺍니다(브라우저 지원에 따라 다름).

## 8. 상태·설정

- 저장: `localStorage['rainkeys.prefs']` = `{sens, fallT, showKeys, scene, bg, tod, amb, storm, ai}`.
- 처음 기본값: 오로라 호수 · 실시간 · 잔잔한 비 · 보통(0.5) · 빠르게(0.2초), 나머지 끔.
- 주소 파라미터: `?bg=city&time=dusk&scene=lively&ai=1`(시험용 `aithr`, `aithrlow`).
- 첫 화면은 바로 바다. 아무 곳이나 한 번 누르면 연결(PC 기기 소리, 휴대폰 마이크). `소리 연결` 버튼에서 방식 선택.
- 숨은 키: `A` = 가까운 번개 한 번(이스터에그), `Esc` = 설정 닫기. 다른 단축키는 없음.
- `window.RK`: 테스트용 훅(`strike`, `setBg`, `setTod`, `bp`, `sea`, `storm`, `hitLog`, `fps`, `amb` …).

## 9. 데스크톱 앱(`desktop/`)

Electron이 같은 `index.html`을 띄우고, `setDisplayMediaRequestHandler`로 공유 창 없이 WASAPI 루프백 소리를 넘깁니다. `preload.js`가 `window.rainKeysHost`(모드 `app`/`saver`, 화면보호기 설치)를 넣어 주고, 페이지는 `HOST`로 이를 알아챕니다. `native/win-scr/main.go`는 Windows가 부르는 `.scr` 런처입니다. 패키징 시 `assets/`도 함께 넣습니다.
