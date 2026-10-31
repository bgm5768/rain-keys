// 합성 피아노(넓은 음역: A0~C8 포함) WAV + 정답 → tools/out/piano_wide.wav, truth_wide.json
require('fs').mkdirSync(__dirname + '/out', { recursive: true });
const fs = require('fs');
const SR = 48000, DUR = 32;
const N = SR * DUR, buf = new Float32Array(N);
let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const notes = [];
function note(m, t0, len, vel) {
  notes.push({ m, t: t0, vel });
  const f0 = 440 * Math.pow(2, (m - 69) / 12), B = 0.00012 * Math.pow(2, (m - 48) / 24);
  const i0 = Math.floor(t0 * SR), iEnd = Math.min(N, i0 + Math.floor((len + 0.25) * SR));
  for (let n = 1; n <= 24; n++) {
    const fn = n * f0 * Math.sqrt(1 + B * n * n); if (fn > 9000) break;
    // 저음은 기음이 2·3배음보다 약함(실제 피아노 특성)
    let a = vel / Math.pow(n, 1.15);
    if (m < 48 && n === 1) a *= (m < 36 ? 0.2 : 0.45); if (m < 48 && n === 2) a *= 1.2;
    const dec = 0.5 + 0.35 * n * (f0 / 300) + (m > 72 ? 1.2 : 0);
    const w = 2 * Math.PI * fn / SR, ph = rnd() * 6.28;
    for (let i = i0; i < iEnd; i++) {
      const t = (i - i0) / SR;
      let env = Math.min(1, t / 0.003) * Math.exp(-dec * t);
      if (t > len) env *= Math.exp(-(t - len) / 0.06);
      buf[i] += a * env * Math.sin(w * (i - i0) + ph);
    }
  }
  for (let i = i0; i < Math.min(N, i0 + SR * 0.012); i++) buf[i] += vel * 0.05 * (rnd() * 2 - 1) * (1 - (i - i0) / (SR * 0.012));   // 해머 소리
}
const beat = 60 / 128;           // 8분음표 길이 = beat/2
const roots = [41, 31, 38, 28, 36, 45, 24, 41];
let t = 0.5, bar = 0, cur = 62;
while (t < DUR - 2) {
  const r = roots[bar % roots.length];
  note(r, t, beat * 2, 0.9); note(r + 7, t, beat * 2, 0.55); note(r + 12, t + beat, beat, 0.5);
  // 멜로디: 한 마디(8개 8분음표), 음역을 골고루 훑도록 목표 음역을 마디마다 바꿈
  const target = [56, 96, 84, 102, 79, 60, 92, 105][bar % 8];
  for (let k = 0; k < 8; k++) {
    cur += Math.sign(target - cur) * (1 + Math.floor(rnd() * 3)) + (rnd() < 0.3 ? (rnd() < 0.5 ? -2 : 2) : 0);
    cur = Math.max(50, Math.min(106, cur));
    note(cur, t + k * beat / 2, beat / 2 * 0.9, 0.45 + rnd() * 0.3);
  }
  t += beat * 4; bar++;
}
let mx = 0; for (const v of buf) mx = Math.max(mx, Math.abs(v));
const pcm = Buffer.alloc(44 + N * 2);
pcm.write('RIFF', 0); pcm.writeUInt32LE(36 + N * 2, 4); pcm.write('WAVE', 8); pcm.write('fmt ', 12);
pcm.writeUInt32LE(16, 16); pcm.writeUInt16LE(1, 20); pcm.writeUInt16LE(1, 22); pcm.writeUInt32LE(SR, 24); pcm.writeUInt32LE(SR * 2, 28);
pcm.writeUInt16LE(2, 32); pcm.writeUInt16LE(16, 34); pcm.write('data', 36); pcm.writeUInt32LE(N * 2, 40);
for (let i = 0; i < N; i++) pcm.writeInt16LE(Math.round(buf[i] / mx * 0.85 * 32767), 44 + i * 2);
fs.writeFileSync(__dirname + '/out/piano_wide.wav', pcm);
fs.writeFileSync(__dirname + '/out/truth_wide.json', JSON.stringify(notes));
console.log('notes', notes.length, 'midi range', Math.min(...notes.map(n => n.m)), Math.max(...notes.map(n => n.m)));
