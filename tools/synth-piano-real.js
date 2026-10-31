// 실제 연주 영상에 가까운 시험 음원: 왼손 아르페지오 + 오른손 3~4음 화음과 멜로디, 서스테인 페달(음이 겹쳐 울림),
// 방 울림(잔향), 유튜브처럼 고음이 살짝 깎인 소리 → tools/out/piano_real.wav + truth_real.json
const fs = require('fs');
fs.mkdirSync(__dirname + '/out', { recursive: true });
const SR = 48000, DUR = 32, N = SR * DUR, buf = new Float32Array(N);
let seed = 11; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const notes = [];
function note(m, t0, len, vel) {
  notes.push({ m, t: +t0.toFixed(4), vel });
  const f0 = 440 * Math.pow(2, (m - 69) / 12), B = 0.00012 * Math.pow(2, (m - 48) / 24);
  const i0 = Math.floor(t0 * SR), rel = 0.35, iEnd = Math.min(N, i0 + Math.floor((len + rel * 4) * SR));
  for (let n = 1; n <= 20; n++) {
    const fn = n * f0 * Math.sqrt(1 + B * n * n); if (fn > 9000) break;
    let a = vel / Math.pow(n, 1.2) * (1 + 0.3 * (rnd() - 0.5));
    if (m < 48 && n === 1) a *= 0.5; if (m < 48 && n === 2) a *= 1.15;
    const dec = 0.35 + 0.3 * n * (f0 / 300) + (m > 72 ? 0.9 : 0);
    const w = 2 * Math.PI * fn / SR, ph = rnd() * 6.28;
    for (let i = i0; i < iEnd; i++) {
      const t = (i - i0) / SR;
      let env = Math.min(1, t / 0.003) * Math.exp(-dec * t);
      if (t > len) env *= Math.exp(-(t - len) / rel);
      buf[i] += a * env * Math.sin(w * (i - i0) + ph);
    }
  }
  for (let i = i0; i < Math.min(N, i0 + SR * 0.01); i++) buf[i] += vel * 0.04 * (rnd() * 2 - 1) * (1 - (i - i0) / (SR * 0.01));
}
// 진행: Am - F - C - G (마디당 2초), 페달을 밟아 한 마디 동안 울림
const prog = [[45, [57, 60, 64]], [41, [57, 60, 65]], [48, [55, 60, 64]], [43, [55, 59, 62]]];
const beat = 0.5;
for (let bar = 0; bar < 15; bar++) {
  const t = 0.5 + bar * 2, [root, ch] = prog[bar % 4];
  // 왼손: 근음-5도-옥타브-10도 아르페지오(8분음표)
  [0, 7, 12, 16, 12, 7, 0, 7].forEach((iv, k) => note(root + iv - (k === 0 ? 12 : 0), t + k * beat / 2, 2 - k * beat / 2, k === 0 ? 0.8 : 0.45 + rnd() * 0.15));
  // 오른손: 1·3박 화음(+옥타브 위 멜로디 음), 사이사이 멜로디
  for (const b of [0, 2]) {
    [...ch.map(x => x + 12), ch[0] + 24].forEach(m => note(m, t + b * beat, 1.0, 0.5 + rnd() * 0.15));
  }
  [1, 1.5, 3, 3.5].forEach(b => note(ch[Math.floor(rnd() * 3)] + 24, t + b * beat, 0.4, 0.45 + rnd() * 0.2));
}
// 방 울림: 짧은 반사 여러 개 + 꼬리
const out = new Float32Array(N);
const taps = Array.from({ length: 40 }, (_, k) => [Math.floor(SR * (0.008 + 0.9 * Math.pow(rnd(), 1.6))), (rnd() - 0.5) * 0.5 * Math.exp(-k / 14)]);
for (let i = 0; i < N; i++) { let v = buf[i]; for (const [d, g] of taps) if (i >= d) v += buf[i - d] * g; out[i] = v; }
// 고음 살짝 깎기(압축 음원 느낌)
let lp = 0; for (let i = 0; i < N; i++) { lp += 0.55 * (out[i] - lp); out[i] = lp; }
let mx = 0; for (const v of out) mx = Math.max(mx, Math.abs(v));
const pcm = Buffer.alloc(44 + N * 2);
pcm.write('RIFF', 0); pcm.writeUInt32LE(36 + N * 2, 4); pcm.write('WAVE', 8); pcm.write('fmt ', 12);
pcm.writeUInt32LE(16, 16); pcm.writeUInt16LE(1, 20); pcm.writeUInt16LE(1, 22); pcm.writeUInt32LE(SR, 24); pcm.writeUInt32LE(SR * 2, 28);
pcm.writeUInt16LE(2, 32); pcm.writeUInt16LE(16, 34); pcm.write('data', 36); pcm.writeUInt32LE(N * 2, 40);
for (let i = 0; i < N; i++) pcm.writeInt16LE(Math.round(out[i] / mx * 0.85 * 32767), 44 + i * 2);
fs.writeFileSync(__dirname + '/out/piano_real.wav', pcm);
fs.writeFileSync(__dirname + '/out/truth_real.json', JSON.stringify(notes));
console.log('notes', notes.length);
