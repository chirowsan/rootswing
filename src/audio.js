// Original synthesized sound effects + music loops (WebAudio only, no files).
import { save } from './save.js';
let ctx = null, master, comp, sfxBus, musBus, noiseBuf;
const last = {};
export const audio = { ready: false, song: null, muted: false };

export function initAudio() {
  if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
  const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
  ctx = new AC();
  comp = ctx.createDynamicsCompressor(); comp.threshold.value = -16; comp.knee.value = 12; comp.ratio.value = 4; comp.attack.value = 0.004; comp.release.value = 0.2;
  master = ctx.createGain(); master.gain.value = 0.9; master.connect(comp); comp.connect(ctx.destination);
  sfxBus = ctx.createGain(); sfxBus.connect(master); musBus = ctx.createGain(); musBus.connect(master);
  noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate); const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  applyVolumes(); audio.ready = true;
  document.addEventListener('visibilitychange', () => { if (!ctx) return; if (document.hidden) ctx.suspend(); else ctx.resume(); });
  setInterval(schedule, 25);
}
export function applyVolumes() {
  if (!ctx) return; const s = save.settings;
  sfxBus.gain.setTargetAtTime(s.sfx * 0.9, ctx.currentTime, 0.05);
  musBus.gain.setTargetAtTime(s.music * 0.42, ctx.currentTime, 0.1);
}
function env(g, t, a, peak, dur) { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(Math.max(peak, 0.0002), t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); }
function tone(type, f0, f1, dur, vol, { a = 0.005, when = 0, bus = sfxBus, filter = 0, detune = 0 } = {}) {
  const t = ctx.currentTime + when; const o = ctx.createOscillator(); const g = ctx.createGain();
  o.type = type; o.frequency.setValueAtTime(f0, t); if (f1 && f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(f1, 20), t + dur); o.detune.value = detune;
  env(g, t, a, vol, dur);
  if (filter) { const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = filter; o.connect(f); f.connect(g); } else o.connect(g);
  g.connect(bus); o.start(t); o.stop(t + dur + 0.05);
}
function noise(dur, freq, vol, { q = 1, type = 'bandpass', f1 = 0, when = 0, a = 0.004, bus = sfxBus } = {}) {
  const t = ctx.currentTime + when; const s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = true;
  const f = ctx.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(freq, t); if (f1) f.frequency.exponentialRampToValueAtTime(f1, t + dur); f.Q.value = q;
  const g = ctx.createGain(); env(g, t, a, vol, dur); s.connect(f); f.connect(g); g.connect(bus); s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.05);
}
const SFX = {
  jump: () => { tone('triangle', 260, 520, 0.12, 0.18); noise(0.08, 1800, 0.05); },
  land: () => noise(0.09, 400, 0.14, { type: 'lowpass', f1: 120 }),
  step: () => noise(0.04, 900, 0.035, { q: 2 }),
  walljump: () => { tone('triangle', 300, 600, 0.1, 0.16); noise(0.06, 1200, 0.07); },
  swing: () => noise(0.14, 900, 0.16, { f1: 3200, q: 1.4 }),
  swingHeavy: () => { noise(0.28, 300, 0.2, { f1: 1400, q: 1 }); tone('sine', 110, 70, 0.25, 0.12); },
  hit: () => { tone('square', 220, 90, 0.08, 0.1, { filter: 2400 }); noise(0.07, 2500, 0.14, { q: 0.8 }); },
  hitHeavy: () => { tone('sine', 140, 45, 0.22, 0.32); noise(0.16, 900, 0.2, { type: 'lowpass', f1: 200 }); },
  pop: () => { tone('sine', 700, 1400, 0.09, 0.14); tone('triangle', 1050, 2100, 0.12, 0.08, { when: 0.04 }); noise(0.12, 3000, 0.07, { q: 3 }); },
  hurt: () => { tone('sawtooth', 380, 140, 0.22, 0.12, { filter: 1600 }); noise(0.12, 600, 0.1); },
  dash: () => noise(0.2, 600, 0.17, { f1: 2600, q: 1.2 }),
  hookThrow: () => { tone('triangle', 900, 1600, 0.1, 0.07); noise(0.1, 2600, 0.06, { q: 4 }); },
  hookAttach: () => { tone('square', 1200, 900, 0.05, 0.06, { filter: 3500 }); tone('sine', 1800, 1800, 0.12, 0.07, { when: 0.02 }); },
  hookMiss: () => tone('triangle', 600, 300, 0.12, 0.06),
  parry: () => { [1568, 2093, 2637].forEach((f, i) => tone('sine', f, f, 0.5, 0.13, { when: i * 0.03 })); noise(0.1, 5000, 0.12, { q: 2 }); },
  block: () => tone('square', 500, 420, 0.07, 0.07, { filter: 2000 }),
  pickup: () => { const f = 1300 + Math.random() * 500; tone('sine', f, f * 1.5, 0.09, 0.07); },
  flask: () => { [523, 659, 784, 1046].forEach((f, i) => tone('sine', f, f, 0.25, 0.1, { when: i * 0.06 })); noise(0.3, 1200, 0.04, { q: 6, f1: 3000 }); },
  chest: () => { [392, 523, 659, 784, 1046].forEach((f, i) => tone('triangle', f, f, 0.3, 0.11, { when: i * 0.07 })); },
  ui: () => tone('sine', 880, 1100, 0.06, 0.08),
  uiBack: () => tone('sine', 700, 500, 0.07, 0.07),
  charge: () => tone('sawtooth', 200, 600, 0.45, 0.05, { filter: 1200 }),
  charged: () => tone('sine', 1320, 1320, 0.15, 0.09),
  bow: () => { noise(0.08, 3000, 0.1, { q: 3 }); tone('triangle', 400, 200, 0.1, 0.1); },
  bomb: () => tone('triangle', 500, 250, 0.15, 0.08),
  explode: () => { noise(0.45, 900, 0.32, { type: 'lowpass', f1: 80, q: 0.7 }); tone('sine', 120, 40, 0.4, 0.3); },
  roar: () => { tone('sawtooth', 110, 70, 0.9, 0.12, { filter: 600, a: 0.08 }); tone('sawtooth', 116, 66, 0.9, 0.1, { filter: 500, a: 0.1 }); noise(0.8, 300, 0.12, { type: 'lowpass', a: 0.1 }); },
  telegraph: () => { tone('square', 990, 990, 0.08, 0.05, { filter: 3000 }); tone('square', 990, 990, 0.08, 0.05, { filter: 3000, when: 0.12 }); },
  door: () => { tone('sine', 220, 440, 0.6, 0.12, { a: 0.1 }); tone('sine', 330, 660, 0.6, 0.08, { a: 0.1 }); },
  unlock: () => { [523, 784, 1046, 1568].forEach((f, i) => tone('triangle', f, f, 0.35, 0.11, { when: i * 0.08 })); },
  death: () => { [392, 330, 262, 196].forEach((f, i) => tone('triangle', f, f * 0.98, 0.35, 0.12, { when: i * 0.14 })); },
  victory: () => { [523, 659, 784, 1046, 784, 1046, 1318].forEach((f, i) => tone('triangle', f, f, 0.4, 0.12, { when: i * 0.1 })); },
  beep: () => tone('sine', 660, 660, 0.15, 0.12),
  go: () => { tone('sine', 990, 990, 0.3, 0.14); tone('sine', 1320, 1320, 0.3, 0.08); },
  enemyShoot: () => { tone('sine', 400, 250, 0.12, 0.08); noise(0.06, 800, 0.05); },
  shieldBreak: () => { noise(0.3, 2000, 0.2, { q: 0.6, f1: 500 }); tone('square', 300, 100, 0.2, 0.08, { filter: 1500 }); },
  thump: () => { tone('sine', 90, 40, 0.3, 0.3); noise(0.2, 300, 0.15, { type: 'lowpass' }); },
  secret: () => { [659, 831, 988, 1319].forEach((f, i) => tone('sine', f, f, 0.4, 0.09, { when: i * 0.09 })); },
};
export function sfx(name, minGap = 0.035) {
  if (!ctx || !SFX[name] || save.settings.sfx <= 0) return;
  const now = ctx.currentTime; if (last[name] && now - last[name] < minGap) return; last[name] = now;
  try { SFX[name](); } catch (e) { /* ignore */ }
}

// ---------- Music: tiny step sequencer with three original loops ----------
const N = (n) => 440 * Math.pow(2, (n - 69) / 12); // midi -> Hz
const SONGS = {
  hub: { bpm: 84, chords: [[62, 66, 69, 74], [59, 62, 66, 71], [55, 59, 62, 67], [57, 61, 64, 69]], arp: [0, 1, 2, 3, 2, 1, 2, 3], drums: 'soft', lead: [74, -1, 76, 78, -1, 76, 74, -1, 71, -1, 74, 73, -1, -1, 69, -1] },
  biome: { bpm: 104, chords: [[57, 60, 64, 69], [53, 57, 60, 65], [48, 55, 60, 64], [55, 59, 62, 67]], arp: [0, 2, 1, 3, 0, 2, 3, 2], drums: 'mid', lead: [76, -1, 74, 72, -1, 71, 72, -1, 69, -1, -1, 72, 74, -1, 76, -1] },
  boss: { bpm: 132, chords: [[50, 57, 62, 65], [46, 53, 58, 62], [48, 55, 60, 64], [45, 52, 57, 61]], arp: [0, 3, 2, 3, 1, 3, 2, 3], drums: 'hard', lead: [74, 74, -1, 77, -1, 76, 74, -1, 72, -1, 74, -1, 69, -1, -1, -1] },
  calm: { bpm: 70, chords: [[60, 64, 67, 72], [57, 60, 64, 69], [53, 57, 60, 65], [55, 59, 62, 67]], arp: [0, 1, 2, 3, 2, 1, 0, 1], drums: 'none', lead: [] },
};
let step = 0, nextT = 0;
export function playSong(name) { if (audio.song === name) return; audio.song = name; step = 0; if (ctx) nextT = ctx.currentTime + 0.1; }
function mtone(type, f, t, dur, vol, filter) {
  const o = ctx.createOscillator(), g = ctx.createGain(); o.type = type; o.frequency.value = f;
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  if (filter) { const fl = ctx.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = filter; o.connect(fl); fl.connect(g); } else o.connect(g);
  g.connect(musBus); o.start(t); o.stop(t + dur + 0.05);
}
function pad(freqs, t, dur) {
  for (const f of freqs) for (const d of [-7, 7]) {
    const o = ctx.createOscillator(), g = ctx.createGain(), fl = ctx.createBiquadFilter(); o.type = 'sawtooth'; o.frequency.value = f; o.detune.value = d;
    fl.type = 'lowpass'; fl.frequency.value = 900; g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.018, t + dur * 0.3); g.gain.linearRampToValueAtTime(0.0001, t + dur);
    o.connect(fl); fl.connect(g); g.connect(musBus); o.start(t); o.stop(t + dur + 0.05);
  }
}
function drum(kind, t, vol) {
  if (kind === 'k') { const o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.setValueAtTime(130, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.18); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22); o.connect(g); g.connect(musBus); o.start(t); o.stop(t + 0.25); }
  else { const s = ctx.createBufferSource(); s.buffer = noiseBuf; const f = ctx.createBiquadFilter(); f.type = kind === 'h' ? 'highpass' : 'bandpass'; f.frequency.value = kind === 'h' ? 7000 : 1800; const g = ctx.createGain(); const d = kind === 'h' ? 0.04 : 0.14; g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + d); s.connect(f); f.connect(g); g.connect(musBus); s.start(t, Math.random() * 0.5); s.stop(t + d + 0.02); }
}
function schedule() {
  if (!ctx || !audio.song || save.settings.music <= 0 || ctx.state !== 'running') { if (ctx) nextT = Math.max(nextT, ctx.currentTime + 0.05); return; }
  const song = SONGS[audio.song]; const sp = 60 / song.bpm / 2; // eighth notes
  if (nextT < ctx.currentTime - 0.2) nextT = ctx.currentTime + 0.05;
  while (nextT < ctx.currentTime + 0.15) {
    const bar = Math.floor(step / 8) % song.chords.length, s8 = step % 8, ch = song.chords[bar], t = nextT;
    if (s8 === 0) { pad(ch, t, sp * 8); mtone('triangle', N(ch[0] - 12), t, sp * 3.5, 0.11); }
    if (s8 === 4) mtone('triangle', N(ch[0] - 12), t, sp * 2.5, 0.08);
    if (song.drums === 'mid' || song.drums === 'hard') { if (s8 === 2 || s8 === 6) mtone('triangle', N(ch[0] - 12), t, sp * 0.8, 0.06); }
    mtone('triangle', N(ch[song.arp[s8]] + 12), t, sp * 1.6, 0.032, 2600);
    const li = step % 16, ln = song.lead[li]; if (song.lead.length && ln > 0 && Math.floor(step / 16) % 2 === 1) mtone('sine', N(ln), t, sp * 1.8, 0.045);
    if (song.drums === 'soft') { if (s8 === 0) drum('k', t, 0.18); if (s8 % 2 === 1) drum('h', t, 0.02); }
    if (song.drums === 'mid') { if (s8 === 0 || s8 === 5) drum('k', t, 0.3); if (s8 === 4) drum('s', t, 0.09); drum('h', t, s8 % 2 ? 0.025 : 0.015); }
    if (song.drums === 'hard') { if (s8 % 4 === 0 || s8 === 3) drum('k', t, 0.34); if (s8 === 2 || s8 === 6) drum('s', t, 0.12); drum('h', t, 0.03); }
    nextT += sp; step++;
  }
}
