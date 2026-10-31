// 음 인식 정확도 측정: 합성 피아노를 가짜 마이크로 넣고, 앱이 만든 빗방울(hitLog)과 정답을 비교
//   node tools/serve.js &   (먼저 서버)
//   node tools/accuracy.js                 → 기존 방식
//   AI=1 node tools/accuracy.js            → AI 음 인식(Basic Pitch)
//   WIDE=1 ...                             → 넓은 음역 세트
//   REAL=1 ...                             → 실제 연주에 가까운 세트(화음·페달·잔향)
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const OUT = path.join(__dirname, 'out');
const SET = process.env.REAL ? '_real' : process.env.WIDE ? '_wide' : '';
const wavName = 'piano' + SET + '.wav', truthName = 'truth' + SET + '.json';
if (!fs.existsSync(path.join(OUT, wavName))) { console.log('먼저 node tools/synth-piano' + SET.replace('_', '-') + '.js'); process.exit(1); }
const wav = path.join(OUT, wavName).split(path.sep).join('/');
const truth = JSON.parse(fs.readFileSync(path.join(OUT, truthName)));
const URL = (process.env.BASE || 'http://localhost:8766/') + (process.env.AI ? '?ai=1' + (process.env.Q || '') : (process.env.Q ? '?' + process.env.Q : ''));
(async () => {
  const browser = await chromium.launch({ args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--use-file-for-fake-audio-capture=' + wav, '--autoplay-policy=no-user-gesture-required', '--use-angle=d3d11'] });
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 760 }, permissions: ['microphone'] })).newPage();
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.goto(URL);
  await page.waitForTimeout(800);
  if (!(await page.evaluate(() => RK.started))) await page.mouse.click(640, 380);
  if (process.env.AI) {                                                     // 모델이 준비된 뒤 처음부터 다시 듣기
    await page.waitForFunction(() => RK.bp.state === 'on', null, { timeout: 60000 });
    await page.evaluate(() => RK.restart()); await page.waitForTimeout(300);
  }
  await page.waitForTimeout(31000);
  const res = await page.evaluate(() => ({ log: RK.hitLog.slice(), t0: RK.capT0, bp: { state: RK.bp.state, backend: RK.bp.backend, ms: Math.round(RK.bp.ms), latMs: Math.round(RK.bp.lat * 1000) } }));
  await browser.close();
  const det = res.log.map(h => ({ m: h.midi, t: h.t - res.t0 })).filter(d => d.t < 30), tr = truth.filter(n => n.t < 29.5);
  // 가짜 마이크 시작 시점을 모르므로 가장 잘 맞는 시간 차이를 찾음
  let best = null;
  for (let off = -0.3; off <= 0.8; off += 0.005) {
    const used = new Set(); let hit = 0;
    for (const d of det) { const k = tr.findIndex((n, i) => !used.has(i) && n.m === d.m && d.t - off - n.t > -0.03 && d.t - off - n.t < 0.12); if (k >= 0) { used.add(k); hit++; } }
    if (!best || hit > best.hit) best = { off, hit, used };
  }
  // 잘못 잡은 음의 종류: 가장 가까운 정답 음과의 음정(0=같은 음이 한 번 더, 12=옥타브 …)
  const wrong = {}; const tol = 0.15;
  for (const d of det) {
    if (tr.some((n, i) => best.used.has(i) && n.m === d.m && Math.abs(d.t - best.off - n.t) < 0.13)) continue;
    const near = tr.filter(n => Math.abs(d.t - best.off - n.t) < tol).map(n => d.m - n.m).sort((x, y) => Math.abs(x) - Math.abs(y))[0];
    const k = near === undefined ? 'none' : near; wrong[k] = (wrong[k] || 0) + 1;
  }
  const reg = (lo, hi) => { const t = tr.map((n, i) => ({ ...n, i })).filter(n => n.m >= lo && n.m <= hi); return t.length ? (t.filter(n => best.used.has(n.i)).length / t.length).toFixed(2) + '/' + t.length : '-'; };
  console.log(JSON.stringify({ mode: process.env.AI ? 'ai' : 'dsp', set: wavName, detections: det.length, truth: tr.length,
    precision: +(best.hit / det.length).toFixed(3), recall: +(best.used.size / tr.length).toFixed(3),
    recallByRegister: { lowUnder36: reg(21, 35), mid: reg(36, 88), highOver88: reg(89, 108) }, wrongByInterval: wrong, bp: res.bp, errs }));
})();
