// 쓰레드용 10초 홍보 영상(1080×1350): 실제 앱을 돌리며 화면 + 소리(피아노·빗소리·천둥·파도)를 녹화 → tools/out/promo.mp4
// 필요: 설치된 Chrome(MP4 녹화), node tools/synth-piano.js 로 만든 tools/out/piano.wav.  사용: node tools/promo.js [출력경로]
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const path = require('path'), fs = require('fs');
const wav = path.join(__dirname, 'out', 'piano.wav').split(path.sep).join('/');
const OUT = process.argv[2] || path.join(__dirname, 'out', 'promo.mp4');
(async () => {
  const srv = spawn(process.execPath, [path.join(__dirname, 'serve.js')], { stdio: 'ignore' });
  await new Promise(r => setTimeout(r, 800));
  const b = await chromium.launch({ channel: 'chrome', args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--use-file-for-fake-audio-capture=' + wav, '--autoplay-policy=no-user-gesture-required', '--use-angle=d3d11'] });
  const ctx = await b.newContext({ viewport: { width: 1080, height: 1350 }, deviceScaleFactor: 1, permissions: ['microphone'] });
  await ctx.addInitScript(() => { try { localStorage.setItem('rainkeys.prefs', JSON.stringify({ sens: 0.9, fallT: 0.4, showKeys: true })); } catch (e) {} });
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); else if (m.text().startsWith('HITS')) console.log(m.text()); });
  await p.goto('http://localhost:8766/?bg=city&time=night&scene=calm');
  await p.addStyleTag({ content: '#toast,#dock,#card,#tap{display:none!important}' });
  for (let i = 0; i < 40 && !(await p.evaluate(() => RK.started)); i++) await p.waitForTimeout(250);
  await p.evaluate(() => { document.getElementById('overlay').style.display = 'none'; RK.storm.on = false; });
  await p.keyboard.press('m'); await p.waitForTimeout(200); await p.keyboard.press('m');   // 오디오만 준비(환경음 자동 재생은 끔: 녹화 중 즉석 합성으로 화면이 멈추지 않게)
  await p.waitForTimeout(2500);                    // 비가 내리기 시작할 때까지
  const b64 = await p.evaluate(async () => {
    const amb = RK.amb, ac = amb.ctx, dest = ac.createMediaStreamDestination();
    amb.busy = 1e9; await ac.resume();
    const rg = ac.createGain(); rg.gain.value = 1.4; amb.rain.connect(rg).connect(dest);   // 빗소리
    // 천둥·파도 소리는 미리 만들어 두고 정해진 순간에 틈
    const tb = RK.thunderBuf(ac, 0.25, true), wb = RK.waveBuf(ac, 1.0, 50);
    const play = (buf, at, gain) => { const s = ac.createBufferSource(), gg = ac.createGain(); s.buffer = buf; gg.gain.value = gain; s.connect(gg).connect(dest); s.start(at); };
    const mic = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
    const pg = ac.createGain(); pg.gain.value = 0.75; ac.createMediaStreamSource(mic).connect(pg).connect(dest);
    // 합성 캔버스: 바다(WebGL) + 건반(2D) + 자막
    const gl = document.getElementById('gl'), kc = document.getElementById('c');
    const cv = document.createElement('canvas'); cv.width = gl.width; cv.height = gl.height;
    const g = cv.getContext('2d'), W = cv.width, H = cv.height;
    // 글은 두 번만: 첫 2초의 한 줄, 마지막 이름
    const CAP = [
      [0.15, 2.3, '이 비, 전부 소리로 내려요', ''],
      [7.9, 10.4, 'RAIN KEYS', 'bgm5768.github.io/rain-keys']
    ];
    let t0 = 0;
    const fade = (t, a, b) => Math.min(1, Math.max(0, Math.min((t - a) / 0.2, (b - t) / 0.35)));
    function comp() {
      const t = (performance.now() - t0) / 1000;
      g.globalAlpha = 1; g.drawImage(gl, 0, 0, W, H); g.drawImage(kc, 0, 0, W, H);
      // 장면 바뀔 때 짧게 어두워졌다 밝아짐
      for (const c of [3.4, 6.6]) { const k = 1 - Math.min(1, Math.abs(t - c) / 0.16); if (k > 0) { g.fillStyle = `rgba(0,0,0,${k})`; g.fillRect(0, 0, W, H); } }
      for (const [a, bb, txt, sub] of CAP) {
        const al = fade(t, a, bb); if (al <= 0) continue;
        g.globalAlpha = al; g.textAlign = 'center'; g.fillStyle = '#fff';
        g.shadowColor = 'rgba(0,0,0,0.65)'; g.shadowBlur = 24;
        const big = txt === 'RAIN KEYS';
        g.font = big ? `200 ${W * 0.13}px 'Malgun Gothic', sans-serif` : `600 ${W * 0.06}px 'Malgun Gothic', sans-serif`;
        if (big && g.letterSpacing !== undefined) g.letterSpacing = `${W * 0.02}px`;
        const y = H * (big ? 0.56 : 0.86) - (1 - al) * H * 0.01;
        g.fillText(txt, W / 2, y);
        if (g.letterSpacing !== undefined) g.letterSpacing = '0px';
        if (sub) { g.font = `400 ${W * 0.042}px 'Malgun Gothic', sans-serif`; g.globalAlpha = al * 0.85; g.fillText(sub, W / 2, y + W * 0.085); }
        g.shadowBlur = 0;
      }
      g.globalAlpha = 1;
      if (t < 10.6 || t < 0) requestAnimationFrame(comp);
    }
    const stream = new MediaStream([...cv.captureStream(30).getVideoTracks(), ...dest.stream.getAudioTracks()]);
    const rec = new MediaRecorder(stream, { mimeType: 'video/mp4;codecs=avc1.640028,mp4a.40.2', videoBitsPerSecond: 14e6, audioBitsPerSecond: 192e3 });
    const chunks = []; rec.ondataavailable = e => chunks.push(e.data);
    g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
    const done = new Promise(r => rec.onstop = r);
    // 녹화기가 실제로 첫 조각을 내보낸 뒤부터 시간을 셈(앞부분이 잘리지 않게)
    // 화면을 먼저 그려 둔 뒤 녹화 시작(앞부분이 검게 담기지 않게), 첫 조각이 나온 순간이 0초
    t0 = performance.now() + 1e9; requestAnimationFrame(comp);
    await new Promise(r => setTimeout(r, 400));
    rec.start(100); t0 = performance.now();          // 녹화 시작 순간이 0초(준비 중에도 프레임은 담김)
    // 첫 장면부터 바로 가까운 번개(번쩍) + 천둥
    RK.strike(0.25, false); play(tb, ac.currentTime + 0.12, 1.0);
    setTimeout(() => RK.strike(0.6, false), 1150);
    // 등대 바다: 바뀌자마자 큰 파도가 다가와 부서지게
    setTimeout(() => { RK.setBg('lighthouse'); RK.setTod('dusk');
      RK.sea.waves = [{ z: 56, h: 1.0, age: -1, seed: Math.random() }, { z: 96, h: 0.9, age: -1, seed: Math.random() }]; RK.sea.next = 7; }, 3400);
    play(wb, ac.currentTime + 4.3, 1.0);                                             // 큰 파도가 부서지는 순간
    setTimeout(() => { RK.setBg('aurora'); RK.setTod('night'); }, 6600);
    setTimeout(() => RK.strike(5, false), 7300);                                    // 먼 구름 속 번개
    await new Promise(r => setTimeout(r, 10400)); rec.stop(); await done;
    const blob = new Blob(chunks, { type: 'video/mp4' });
    return await new Promise(r => { const fr = new FileReader(); fr.onload = () => r(fr.result.split(',')[1]); fr.readAsDataURL(blob); });
  });
  fs.writeFileSync(OUT, Buffer.from(b64, 'base64'));
  console.log('saved', OUT, (fs.statSync(OUT).size / 1e6).toFixed(1) + 'MB', 'fps', Math.round(await p.evaluate(() => RK.fps)), JSON.stringify(errs.slice(0, 3)));
  await b.close(); srv.kill();
})();
