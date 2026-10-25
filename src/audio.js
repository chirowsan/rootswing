// Original synthesized sound effects + music loops (WebAudio only, no files).
import { save } from './save.js';
let ctx = null, master, comp, sfxBus, musBus, noiseBuf, pv = 1, duckG, tensBus, ambBus, stingBus;
const last = {}; let pchain = 0, plast = 0;
export const audio = { ready: false, song: null, muted: false };

export function initAudio() {
  if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
  const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
  ctx = new AC();
  comp = ctx.createDynamicsCompressor(); comp.threshold.value = -16; comp.knee.value = 12; comp.ratio.value = 4; comp.attack.value = 0.004; comp.release.value = 0.2;
  master = ctx.createGain(); master.gain.value = 0.9; master.connect(comp); comp.connect(ctx.destination);
  sfxBus = ctx.createGain(); sfxBus.connect(master); duckG = ctx.createGain(); duckG.connect(master); musBus = ctx.createGain(); musBus.connect(duckG);
  tensBus = ctx.createGain(); tensBus.gain.value = 0.0001; tensBus.connect(musBus); stingBus = ctx.createGain(); stingBus.connect(master); ambBus = ctx.createGain(); ambBus.connect(master); // v2.3 adaptive mix
  noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate); const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  applyVolumes(); audio.ready = true;
  document.addEventListener('visibilitychange', () => { if (!ctx) return; if (document.hidden) ctx.suspend(); else ctx.resume(); });
  setInterval(schedule, 25);
}
export function applyVolumes() {
  if (!ctx) return; const s = save.settings;
  sfxBus.gain.setTargetAtTime(s.sfx * 0.9, ctx.currentTime, 0.05);
  musBus.gain.setTargetAtTime(s.music * 0.42, ctx.currentTime, 0.1);
  stingBus.gain.setTargetAtTime(s.music * 0.5, ctx.currentTime, 0.1); ambBus.gain.setTargetAtTime((s.amb ?? 0.6) * 0.55, ctx.currentTime, 0.2);
  master.gain.setTargetAtTime(s.mute ? 0 : 0.9, ctx.currentTime, 0.05);
}
function env(g, t, a, peak, dur) { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(Math.max(peak, 0.0002), t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); }
function tone(type, f0, f1, dur, vol, { a = 0.005, when = 0, bus = sfxBus, filter = 0, detune = 0 } = {}) {
  const t = ctx.currentTime + when; const o = ctx.createOscillator(); const g = ctx.createGain();
  o.type = type; f0 *= pv; f1 *= pv; o.frequency.setValueAtTime(f0, t); if (f1 && f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(f1, 20), t + dur); o.detune.value = detune;
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
  // v2.0 fighting styles + style rank + set pieces (all synthesized, mixed to sit under music)
  hamA: () => { noise(0.18, 300, 0.2, { type: 'lowpass', f1: 120 }); tone('sine', 140, 48, 0.28, 0.26); noise(0.05, 2200, 0.07, { q: 0.8, when: 0.02 }); },
  hamB: () => { noise(0.14, 400, 0.16, { f1: 2200, q: 1.2 }); tone('triangle', 90, 260, 0.16, 0.14); tone('sine', 120, 50, 0.2, 0.16, { when: 0.04 }); },
  hamFin: () => { tone('sine', 100, 30, 0.6, 0.4); noise(0.5, 600, 0.26, { type: 'lowpass', f1: 70 }); noise(0.1, 3000, 0.1, { q: 0.7 }); tone('square', 70, 40, 0.25, 0.06, { filter: 600, when: 0.03 }); },
  whipCrack: () => { noise(0.05, 5000, 0.12, { f1: 1600, q: 1.5 }); noise(0.02, 9000, 0.14, { type: 'highpass', a: 0.001, when: 0.06 }); tone('square', 2400, 1200, 0.04, 0.03, { when: 0.06, filter: 5000 }); },
  whipSnap: () => { noise(0.08, 4200, 0.14, { f1: 900, q: 1.4 }); noise(0.03, 10000, 0.18, { type: 'highpass', a: 0.001, when: 0.09 }); tone('sine', 900, 300, 0.15, 0.08, { when: 0.09 }); },
  rankUp: () => { [784, 988, 1319].forEach((f, i) => tone('triangle', f, f, 0.14, 0.07, { when: i * 0.05 })); noise(0.2, 7000, 0.04, { type: 'highpass', when: 0.1 }); },
  splat: () => { noise(0.12, 260, 0.26, { type: 'lowpass', f1: 90 }); tone('sine', 180, 60, 0.16, 0.2); noise(0.05, 1800, 0.1, { q: 0.9, when: 0.01 }); },
  trapKO: () => { [523, 659, 784, 1047].forEach((f, i) => tone('square', f, f, 0.1, 0.05, { when: i * 0.045, filter: 3000 })); noise(0.18, 1200, 0.12, { q: 0.7 }); },
  guardBreak: () => { noise(0.22, 3200, 0.22, { f1: 600, q: 0.8 }); [1175, 880, 659].forEach((f, i) => tone('triangle', f, f * 0.98, 0.18, 0.08, { when: i * 0.05 })); tone('sine', 220, 70, 0.25, 0.16); },
  // v1.9 combat set: each hit type has its own swish/body so a combo reads by ear
  slashA: () => { noise(0.11, 1400, 0.15, { f1: 4200, q: 1.6 }); tone('triangle', 520, 300, 0.06, 0.04); },
  slashB: () => { noise(0.12, 4000, 0.14, { f1: 1200, q: 1.6 }); tone('triangle', 400, 620, 0.06, 0.04); },
  spin: () => { noise(0.2, 700, 0.14, { f1: 3000, q: 2.5 }); noise(0.16, 3000, 0.08, { f1: 900, q: 2.5, when: 0.08 }); },
  thrust: () => { noise(0.08, 2600, 0.16, { f1: 6000, q: 3 }); tone('square', 300, 160, 0.06, 0.05, { filter: 2000 }); },
  finisher: () => { noise(0.3, 260, 0.22, { f1: 2400, q: 1 }); tone('sine', 160, 60, 0.3, 0.18); noise(0.12, 5000, 0.06, { type: 'highpass', when: 0.12 }); },
  finisherHit: () => { tone('sine', 90, 38, 0.4, 0.34); noise(0.35, 700, 0.2, { type: 'lowpass', f1: 120 }); [784, 1175].forEach((f, i) => tone('triangle', f, f, 0.25, 0.05, { when: 0.03 + i * 0.04 })); },
  launch: () => { noise(0.16, 600, 0.16, { f1: 4000, q: 1.5 }); tone('triangle', 200, 700, 0.16, 0.12); },
  plungeHit: () => { tone('sine', 220, 520, 0.12, 0.16); noise(0.05, 4000, 0.1, { type: 'highpass' }); },
  slam: () => { tone('sine', 110, 34, 0.45, 0.36); noise(0.4, 500, 0.24, { type: 'lowpass', f1: 90 }); noise(0.08, 2500, 0.08, { q: 0.7 }); },
  kick: () => { tone('sine', 180, 70, 0.12, 0.24); noise(0.06, 1500, 0.12, { q: 1 }); },
  dashSlash: () => { noise(0.14, 6000, 0.14, { f1: 1500, q: 2 }); tone('sawtooth', 900, 300, 0.1, 0.04, { filter: 3000 }); },
  crit: () => { [1760, 2349].forEach((f, i) => tone('sine', f, f * 1.02, 0.18, 0.08, { when: i * 0.025 })); noise(0.03, 8000, 0.1, { type: 'highpass', a: 0.001 }); },
  perfect: () => { [1047, 1319, 1568, 2093].forEach((f, i) => tone('sine', f, f, 0.4, 0.08, { when: i * 0.04 })); noise(0.5, 2500, 0.05, { q: 6, f1: 7000 }); },
  counter: () => { noise(0.04, 8000, 0.14, { type: 'highpass', a: 0.001 }); noise(0.16, 3000, 0.16, { f1: 900, q: 2 }); tone('sine', 1568, 784, 0.2, 0.08); },
  charged2: () => { [988, 1319, 1661, 1976].forEach((f, i) => tone('triangle', f, f, 0.3, 0.07, { when: i * 0.05 })); },
  whirl: () => { for (let i = 0; i < 4; i++) noise(0.12, 800 + i * 400, 0.12, { f1: 3000, q: 2.5, when: i * 0.09 }); },
  vineBurst: () => { noise(0.3, 300, 0.2, { type: 'lowpass', f1: 1600 }); tone('sawtooth', 70, 140, 0.2, 0.08, { filter: 600 }); noise(0.1, 3000, 0.06, { q: 3, when: 0.05 }); },
  specialWind: () => { noise(0.3, 400, 0.12, { f1: 5000, q: 4 }); tone('sine', 220, 880, 0.3, 0.1); },
  special: () => { tone('sine', 80, 40, 0.8, 0.34); [523, 659, 784, 1047, 1319].forEach((f, i) => tone('triangle', f, f, 0.7, 0.07, { when: i * 0.05 })); noise(0.7, 1200, 0.12, { f1: 200, type: 'lowpass' }); },
  poiseBreak: () => { tone('square', 300, 80, 0.3, 0.1, { filter: 1500 }); noise(0.25, 2000, 0.2, { q: 0.6 }); [1319, 988].forEach((f, i) => tone('sine', f, f, 0.3, 0.08, { when: 0.05 + i * 0.07 })); },
  gaugeFull: () => { [784, 1047, 1319].forEach((f, i) => tone('sine', f, f, 0.3, 0.07, { when: i * 0.06 })); },
  plunge: () => { noise(0.18, 500, 0.14, { f1: 2500, q: 2 }); tone('sine', 600, 200, 0.14, 0.06); },
  zip: () => { noise(0.16, 1200, 0.15, { f1: 7000, q: 3 }); tone('triangle', 400, 1200, 0.12, 0.06); },
  jump: () => { tone('triangle', 260, 520, 0.12, 0.18); noise(0.08, 1800, 0.05); noise(0.06, 500, 0.05, { type: 'lowpass' }); },
  land: () => { noise(0.09, 400, 0.14, { type: 'lowpass', f1: 120 }); tone('sine', 120, 60, 0.1, 0.12); noise(0.05, 2400, 0.03, { q: 1.5, when: 0.01 }); }, // thud + grit layer
  step: () => noise(0.04, 900, 0.035, { q: 2 }),
  walljump: () => { tone('triangle', 300, 600, 0.1, 0.16); noise(0.06, 1200, 0.07); },
  swing: () => noise(0.14, 900, 0.16, { f1: 3200, q: 1.4 }),
  swingHeavy: () => { noise(0.28, 300, 0.2, { f1: 1400, q: 1 }); tone('sine', 110, 70, 0.25, 0.12); },
  hit: () => { noise(0.025, 6000, 0.12, { type: 'highpass', a: 0.001 }); tone('square', 220, 90, 0.08, 0.1, { filter: 2400 }); noise(0.07, 2500, 0.14, { q: 0.8 }); tone('sine', 160, 70, 0.1, 0.12); }, // click + crunch + body
  hitHeavy: () => { noise(0.03, 5000, 0.16, { type: 'highpass', a: 0.001 }); tone('sine', 140, 45, 0.22, 0.32); noise(0.16, 900, 0.2, { type: 'lowpass', f1: 200 }); tone('square', 330, 110, 0.12, 0.07, { filter: 1800 }); noise(0.3, 1400, 0.05, { f1: 300, when: 0.05 }); }, // transient + sub + crunch + debris tail
  pop: () => { tone('sine', 700, 1400, 0.09, 0.14); tone('triangle', 1050, 2100, 0.12, 0.08, { when: 0.04 }); noise(0.12, 3000, 0.07, { q: 3 }); tone('sine', 90, 50, 0.16, 0.16); [1760, 2349, 2794].forEach((f, i) => tone('sine', f, f, 0.22, 0.035, { when: 0.06 + i * 0.045 })); }, // pop + low thump + glimmer chime
  hurt: () => { tone('sawtooth', 380, 140, 0.22, 0.12, { filter: 1600 }); noise(0.12, 600, 0.1); },
  dash: () => noise(0.2, 600, 0.17, { f1: 2600, q: 1.2 }),
  hookThrow: () => { tone('triangle', 900, 1600, 0.1, 0.07); noise(0.1, 2600, 0.06, { q: 4 }); },
  hookAttach: () => { tone('square', 1200, 900, 0.05, 0.06, { filter: 3500 }); tone('sine', 1800, 1800, 0.12, 0.07, { when: 0.02 }); },
  hookMiss: () => tone('triangle', 600, 300, 0.12, 0.06),
  parry: () => { tone('sine', 180, 60, 0.18, 0.28); noise(0.03, 7000, 0.14, { type: 'highpass', a: 0.001 }); [1568, 2093, 2637].forEach((f, i) => tone('sine', f, f, 0.5, 0.13, { when: i * 0.03 })); noise(0.1, 5000, 0.12, { q: 2 }); noise(0.5, 3000, 0.03, { q: 8, f1: 6000, when: 0.05 }); },
  block: () => tone('square', 500, 420, 0.07, 0.07, { filter: 2000 }),
  pickup: () => { const now = ctx.currentTime; pchain = now - plast < 0.4 ? Math.min(10, pchain + 1) : 0; plast = now; const f = 1250 * Math.pow(2, pchain / 12 * 2); tone('sine', f, f * 1.5, 0.09, 0.07); if (pchain >= 4) tone('triangle', f * 2, f * 2, 0.08, 0.02, { when: 0.03 }); }, // v2.3 chained pickups climb in pitch
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
const VARY = { hit: 0.14, hitHeavy: 0.1, pop: 0.12, land: 0.16, step: 0.3, jump: 0.08, pickup: 0.1, swing: 0.12, enemyShoot: 0.1, hookAttach: 0.08, slashA: 0.1, slashB: 0.1, spin: 0.08, thrust: 0.08, kick: 0.12, crit: 0.06, whipCrack: 0.12, hamA: 0.08, splat: 0.1 }; // per-play pitch variation
// v2.3 ducking: big hits briefly dip the music so the important sound reads clearly
const DUCK = { hitHeavy: [0.7, 0.25], finisherHit: [0.55, 0.4], slam: [0.6, 0.35], explode: [0.55, 0.45], roar: [0.5, 0.9], hurt: [0.65, 0.3], special: [0.5, 0.7], parry: [0.6, 0.35], death: [0.4, 1.2], victory: [0.5, 0.9], unlock: [0.7, 0.4], secret: [0.65, 0.5], poiseBreak: [0.6, 0.4] };
export function duck(level, dur) {
  if (!ctx) return; const t = ctx.currentTime, g = duckG.gain; g.cancelScheduledValues(t); g.setValueAtTime(Math.min(g.value, 1), t);
  g.linearRampToValueAtTime(level, t + 0.03); g.setValueAtTime(level, t + dur * 0.5); g.linearRampToValueAtTime(1, t + dur + 0.25); audio.duckN = (audio.duckN || 0) + 1;
}
export function sfx(name, minGap = 0.035) {
  if (!ctx || !SFX[name] || save.settings.sfx <= 0) return;
  const now = ctx.currentTime; if (last[name] && now - last[name] < minGap) return; last[name] = now;
  pv = VARY[name] ? 1 + (Math.random() - 0.5) * VARY[name] : 1; try { SFX[name](); } catch (e) { /* ignore */ } pv = 1;
  const dk = DUCK[name]; if (dk) duck(dk[0], dk[1]);
}

// ---------- Music: step sequencer, one bus per song so area changes crossfade (v1.3) ----------
const N = (n) => 440 * Math.pow(2, (n - 69) / 12); // midi -> Hz
// chords: one per bar; lead/counter: 16-step phrases (-1 rest); bass: 8-step pattern of chord-tone indexes (-1 rest)
const SONGS = {
  hub: { bpm: 84, chords: [[62, 66, 69, 74], [59, 62, 66, 71], [55, 59, 62, 67], [57, 61, 64, 69]], arp: [0, 1, 2, 3, 2, 1, 2, 3], drums: 'soft', lead: [[74, -1, 76, 78, -1, 76, 74, -1, 71, -1, 74, 73, -1, -1, 69, -1]], bass: [0, -1, -1, -1, 0, -1, -1, -1], bell: 1 },
  biome: { bpm: 108, chords: [[57, 60, 64, 69], [53, 57, 60, 65], [48, 55, 60, 64], [55, 59, 62, 67], [57, 60, 64, 69], [50, 53, 57, 62], [53, 57, 60, 65], [52, 56, 59, 64]], arp: [0, 2, 1, 3, 0, 2, 3, 2], drums: 'mid',
    lead: [[76, -1, 74, 72, -1, 71, 72, -1, 69, -1, -1, 72, 74, -1, 76, -1], [79, -1, 77, 76, -1, 74, 76, -1, 77, 76, 74, -1, 72, -1, 71, -1], [72, 74, 76, -1, 79, -1, 76, 74, 72, -1, 69, -1, 71, 72, -1, -1]],
    counter: [64, -1, -1, 62, -1, -1, 60, -1, 59, -1, -1, 60, -1, -1, 62, -1], bass: [0, -1, 0, 0, -1, 0, 2, 0], bell: 1 },
  caverns: { bpm: 96, chords: [[50, 57, 60, 65], [46, 53, 57, 62], [43, 50, 55, 58], [45, 52, 55, 61]], arp: [0, 3, 1, 2, 3, 1, 2, 3], drums: 'soft',
    lead: [[69, -1, -1, 72, -1, 70, 69, -1, 65, -1, -1, -1, 67, -1, 69, -1], [74, -1, 72, -1, 70, -1, 69, -1, 70, 72, -1, 69, -1, 65, -1, -1]], counter: [57, -1, -1, -1, 55, -1, -1, -1, 53, -1, -1, -1, 52, -1, -1, -1], bass: [0, -1, -1, 0, -1, -1, 0, -1], bell: 2, drip: 1 },
  mini: { bpm: 124, chords: [[52, 59, 64, 67], [48, 55, 60, 64], [50, 57, 62, 65], [47, 54, 59, 62]], arp: [0, 3, 2, 3, 1, 3, 2, 3], drums: 'hard', lead: [[76, -1, 76, 79, -1, 76, 74, -1, 72, -1, 71, -1, 72, 74, -1, -1]], bass: [0, 0, -1, 0, 0, -1, 2, 0] },
  boss: { bpm: 132, chords: [[50, 57, 62, 65], [46, 53, 58, 62], [48, 55, 60, 64], [45, 52, 57, 61]], arp: [0, 3, 2, 3, 1, 3, 2, 3], drums: 'hard', lead: [[74, 74, -1, 77, -1, 76, 74, -1, 72, -1, 74, -1, 69, -1, -1, -1], [77, -1, 76, 74, -1, 72, 74, -1, 76, -1, 77, -1, 81, -1, -1, -1]], counter: [62, -1, 62, -1, 58, -1, 58, -1, 60, -1, 60, -1, 57, -1, 57, -1], bass: [0, 0, 0, -1, 0, 0, 2, 0] },
  // v2.3 original adaptive score: one theme per chapter, menu/story/ending, three boss phases
  menu: { bpm: 76, chords: [[53, 57, 60, 64], [50, 57, 60, 65], [46, 53, 57, 62], [48, 52, 55, 60]], arp: [0, 2, 3, 1, 2, 3, 1, 2], drums: 'none', bell: 1,
    lead: [[72, -1, -1, 69, -1, 67, -1, 65, -1, -1, 67, -1, 69, -1, -1, -1], [74, -1, 72, -1, 69, -1, 72, -1, 70, -1, -1, 67, -1, -1, -1, -1]], bass: [0, -1, -1, -1, 1, -1, -1, -1] },
  ch2: { bpm: 92, chords: [[50, 57, 60, 64], [48, 55, 59, 64], [46, 53, 57, 62], [45, 52, 57, 60]], arp: [0, 3, 2, 3, 1, 3, 2, 1], drums: 'soft', drip: 1, bell: 2, pluck: 1,
    lead: [[74, -1, -1, 72, 69, -1, -1, -1, 67, -1, 69, -1, 72, -1, -1, -1], [76, -1, 74, -1, 72, -1, 69, -1, 71, -1, 72, -1, 69, -1, -1, -1]], counter: [62, -1, -1, -1, 64, -1, -1, -1, 60, -1, -1, -1, 57, -1, -1, -1], bass: [0, -1, -1, 0, -1, -1, 1, -1] },
  ch3: { bpm: 112, chords: [[52, 59, 62, 67], [48, 55, 60, 64], [50, 57, 62, 66], [47, 54, 59, 62]], arp: [0, 2, 3, 2, 1, 2, 3, 2], drums: 'mid', pluck: 1,
    lead: [[71, -1, 74, -1, 76, 74, 71, -1, 69, -1, 67, -1, 69, 71, -1, -1], [79, -1, 78, 76, -1, 74, 76, -1, 74, -1, 71, -1, 69, -1, 71, -1]], counter: [59, -1, 62, -1, 60, -1, 59, -1, 57, -1, 55, -1, 54, -1, 55, -1], bass: [0, -1, 0, 2, -1, 0, 3, 0] },
  ch4: { bpm: 122, chords: [[55, 62, 65, 71], [53, 60, 64, 69], [48, 55, 60, 64], [50, 57, 62, 65]], arp: [0, 1, 2, 3, 2, 3, 1, 3], drums: 'mid', drive: 1,
    lead: [[79, -1, 77, -1, 74, -1, 77, 79, -1, 81, 79, -1, 77, -1, 74, -1], [74, 76, 77, -1, 79, -1, 74, -1, 72, -1, 74, -1, 70, -1, -1, -1]], counter: [67, -1, -1, 65, -1, -1, 64, -1, 62, -1, -1, 64, -1, -1, 65, -1], bass: [0, 0, -1, 0, 0, -1, 2, 0] },
  ch5: { bpm: 100, chords: [[48, 55, 60, 64], [50, 57, 62, 66], [52, 59, 64, 67], [45, 52, 57, 60]], arp: [0, 2, 1, 3, 2, 3, 1, 2], drums: 'mid', bell: 1, choir: 1,
    lead: [[76, -1, -1, 79, -1, 78, 76, -1, 74, -1, 76, -1, 71, -1, -1, -1], [84, -1, 83, -1, 79, -1, 76, -1, 78, -1, 79, -1, 74, -1, -1, -1]], counter: [64, -1, -1, -1, 66, -1, -1, -1, 67, -1, -1, -1, 64, -1, -1, -1], bass: [0, -1, 0, -1, 0, -1, 2, -1] },
  boss2: { bpm: 140, chords: [[50, 57, 62, 65], [46, 53, 58, 62], [48, 55, 60, 64], [45, 52, 57, 61]], arp: [0, 3, 2, 3, 1, 3, 2, 3], drums: 'hard', drive: 1, lead: [[74, 74, -1, 77, -1, 76, 74, -1, 72, -1, 74, -1, 69, -1, -1, -1], [77, -1, 76, 74, -1, 72, 74, -1, 76, -1, 77, -1, 81, -1, -1, -1]], counter: [62, -1, 62, -1, 58, -1, 58, -1, 60, -1, 60, -1, 57, -1, 57, -1], bass: [0, 0, 0, 0, 0, 0, 2, 0] },
  boss3: { bpm: 150, chords: [[51, 58, 63, 66], [47, 54, 59, 63], [49, 56, 61, 65], [46, 53, 58, 62]], arp: [0, 3, 2, 3, 1, 3, 2, 3], drums: 'hard', drive: 1, choir: 1, lead: [[75, -1, 78, -1, 75, -1, 82, -1, 80, 78, -1, 77, -1, 75, -1, -1], [78, 78, -1, 82, -1, 80, 78, -1, 77, -1, 78, -1, 73, -1, -1, -1]], counter: [63, -1, 63, -1, 59, -1, 59, -1, 61, -1, 61, -1, 58, -1, 58, -1], bass: [0, 0, 2, 0, 0, 0, 3, 0] },
  story: { bpm: 66, chords: [[57, 60, 64, 69], [53, 57, 60, 65], [55, 59, 62, 67], [52, 55, 59, 64]], arp: [0, 1, 2, 3, 2, 1, 2, 1], drums: 'none', bell: 2,
    lead: [[76, -1, -1, -1, 74, -1, 72, -1, 71, -1, -1, -1, 72, -1, -1, -1]], bass: [0, -1, -1, -1, -1, -1, -1, -1] },
  ending: { bpm: 74, chords: [[48, 55, 60, 64], [53, 57, 60, 65], [45, 52, 57, 60], [55, 59, 62, 67]], arp: [0, 1, 2, 3, 2, 3, 1, 2], drums: 'soft', bell: 1, choir: 1,
    lead: [[72, -1, 74, 76, -1, 79, -1, 76, 77, -1, 76, -1, 74, -1, -1, -1], [76, -1, 77, 79, -1, 84, -1, 81, 79, -1, 77, -1, 76, -1, -1, -1]], counter: [60, -1, -1, -1, 65, -1, -1, -1, 64, -1, -1, -1, 62, -1, -1, -1], bass: [0, -1, -1, 0, -1, -1, 2, -1] },
  calm: { bpm: 70, chords: [[60, 64, 67, 72], [57, 60, 64, 69], [53, 57, 60, 65], [55, 59, 62, 67]], arp: [0, 1, 2, 3, 2, 1, 0, 1], drums: 'none', lead: [] },
};
const players = []; const XF = 1.6; // crossfade seconds
export function playSong(name) {
  if (audio.song === name) return; audio.song = name;
  if (!ctx) return; const t = ctx.currentTime;
  for (const p of players) if (!p.end) { p.end = t + XF; p.bus.gain.cancelScheduledValues(t); p.bus.gain.setValueAtTime(p.bus.gain.value, t); p.bus.gain.linearRampToValueAtTime(0.0001, t + XF); }
  if (!SONGS[name]) return; const bus = ctx.createGain(); bus.gain.setValueAtTime(0.0001, t); bus.gain.linearRampToValueAtTime(1, t + XF * 0.8); bus.connect(musBus);
  players.push({ name, bus, step: 0, nextT: t + 0.05, end: 0 });
}
function mtone(bus, type, f, t, dur, vol, filter) {
  const o = ctx.createOscillator(), g = ctx.createGain(); o.type = type; o.frequency.value = f;
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  if (filter) { const fl = ctx.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = filter; o.connect(fl); fl.connect(g); } else o.connect(g);
  g.connect(bus); o.start(t); o.stop(t + dur + 0.05);
}
function pad(bus, freqs, t, dur, cut = 900) {
  for (const f of freqs) for (const d of [-7, 7]) {
    const o = ctx.createOscillator(), g = ctx.createGain(), fl = ctx.createBiquadFilter(); o.type = 'sawtooth'; o.frequency.value = f; o.detune.value = d;
    fl.type = 'lowpass'; fl.frequency.value = cut; g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.017, t + dur * 0.3); g.gain.linearRampToValueAtTime(0.0001, t + dur);
    o.connect(fl); fl.connect(g); g.connect(bus); o.start(t); o.stop(t + dur + 0.05);
  }
}
function drum(bus, kind, t, vol) {
  if (kind === 'k') { const o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.setValueAtTime(130, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.18); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22); o.connect(g); g.connect(bus); o.start(t); o.stop(t + 0.25); }
  else { const s = ctx.createBufferSource(); s.buffer = noiseBuf; const f = ctx.createBiquadFilter(); f.type = kind === 'h' ? 'highpass' : 'bandpass'; f.frequency.value = kind === 'h' ? 7000 : 1800; const g = ctx.createGain(); const d = kind === 'h' ? 0.04 : 0.14; g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + d); s.connect(f); f.connect(g); g.connect(bus); s.start(t, Math.random() * 0.5); s.stop(t + d + 0.02); }
}
function tick(p, song, t, sp) {
  const B = p.bus, st = p.step, bar = Math.floor(st / 8) % song.chords.length, s8 = st % 8, ch = song.chords[bar], phrase = Math.floor(st / 16);
  if (s8 === 0) { pad(B, ch, t, sp * 8, song.drip ? 700 : 900); }
  if (song.bass) { const bi = song.bass[s8]; if (bi >= 0) mtone(B, 'triangle', N(ch[bi] - 12), t, sp * (s8 === 0 ? 3.2 : 0.9), s8 === 0 ? 0.11 : 0.075); }
  mtone(B, 'triangle', N(ch[song.arp[s8]] + 12), t, sp * 1.6, 0.03, 2600);
  if (song.lead.length && phrase % 4 !== 0) { const L = song.lead[Math.floor(phrase / 2) % song.lead.length], ln = L[st % 16]; if (ln > 0) { mtone(B, 'sine', N(ln), t, sp * 1.8, 0.045); mtone(B, 'triangle', N(ln + 12), t, sp * 0.9, 0.008); } }
  if (song.counter && phrase % 2 === 1) { const cn = song.counter[st % 16]; if (cn > 0) mtone(B, 'square', N(cn), t, sp * 2.2, 0.012, 1200); }
  if (song.bell && s8 === 7 && bar % 2 === (song.bell - 1)) mtone(B, 'sine', N(ch[3] + 24), t, sp * 3, 0.02);
  if (song.drip && Math.random() < 0.06) mtone(B, 'sine', N(84 + ((Math.random() * 5) | 0) * 2), t, 0.2, 0.014);
  if (song.pluck && s8 % 2 === 0) mtone(B, 'square', N(ch[(s8 / 2 + bar) % 4] + 24), t, sp * 0.5, 0.009, 1800);
  if (song.drive) mtone(B, 'sawtooth', N(ch[0] - 12), t, sp * 0.55, 0.03, 520);
  if (song.choir && s8 === 0) for (const k of [1, 2]) choir(B, N(ch[k] + 12), t, sp * 8);
  if (!p.end && audio.tension > 0.02) tens(ch, s8, t, sp, phrase);
  const d = song.drums;
  if (d === 'soft') { if (s8 === 0) drum(B, 'k', t, 0.18); if (s8 % 2 === 1) drum(B, 'h', t, 0.02); }
  if (d === 'mid') { if (s8 === 0 || s8 === 5) drum(B, 'k', t, 0.3); if (s8 === 4) drum(B, 's', t, 0.09); drum(B, 'h', t, s8 % 2 ? 0.025 : 0.015); if (phrase % 8 === 7 && s8 >= 6) drum(B, 's', t, 0.07); }
  if (d === 'hard') { if (s8 % 4 === 0 || s8 === 3) drum(B, 'k', t, 0.34); if (s8 === 2 || s8 === 6) drum(B, 's', t, 0.12); drum(B, 'h', t, 0.03); }
}
function choir(bus, f, t, dur) {
  const o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'sine'; o.frequency.value = f; o.detune.value = 5;
  g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.014, t + dur * 0.4); g.gain.linearRampToValueAtTime(0.0001, t + dur); o.connect(g); g.connect(bus); o.start(t); o.stop(t + dur + 0.05);
}
// v2.3 combat tension layer: pulse bass + toms + shaker on its own bus; the director fades it in when foes are close
function tens(ch, s8, t, sp, phrase) {
  mtone(tensBus, 'sawtooth', N(ch[0] - 24), t, sp * 0.6, 0.06, 380);
  if (s8 === 0 || s8 === 3 || s8 === 6) drum(tensBus, 'k', t, 0.22);
  if (s8 === 4) drum(tensBus, 's', t, 0.08);
  drum(tensBus, 'h', t, s8 % 2 ? 0.03 : 0.018);
  if (phrase % 2 === 1 && s8 % 4 === 2) mtone(tensBus, 'square', N(ch[3] + 12), t, sp * 0.4, 0.012, 2200);
}
function schedule() {
  if (!ctx) return; const now = ctx.currentTime; ambTick(now);
  for (let i = players.length - 1; i >= 0; i--) if (players[i].end && now > players[i].end + 0.1) { try { players[i].bus.disconnect(); } catch (e) { /* */ } players.splice(i, 1); }
  if (audio.song && !players.some((p) => !p.end) && SONGS[audio.song]) { const n = audio.song; audio.song = null; playSong(n); }
  if (save.settings.music <= 0 || ctx.state !== 'running') { for (const p of players) p.nextT = Math.max(p.nextT, now + 0.05); return; }
  for (const p of players) {
    const song = SONGS[p.name], sp = 60 / song.bpm / 2; if (p.nextT < now - 0.2) p.nextT = now + 0.05;
    while (p.nextT < now + 0.15 && (!p.end || p.nextT < p.end)) { tick(p, song, p.nextT, sp); p.nextT += sp; p.step++; }
  }
}

// ---------- v2.3 stingers: short original cues on their own bus, music ducks under them ----------
const STING = {
  level: [[60, 64, 67, 72], [0, 0.12, 0.24, 0.36], 'triangle', 1.2],
  mission: [[67, 72, 76, 79, 84], [0, 0.08, 0.16, 0.24, 0.4], 'triangle', 1.1],
  secret: [[76, 80, 83, 88], [0, 0.1, 0.2, 0.3], 'sine', 1.0],
  shrine: [[57, 64, 69, 72, 76], [0, 0.2, 0.4, 0.6, 0.8], 'sine', 1.8],
  merchant: [[72, 76, 79, 76, 84], [0, 0.09, 0.18, 0.27, 0.4], 'square', 0.8],
  warden: [[62, 65, 69, 74], [0, 0.1, 0.2, 0.32], 'triangle', 1.0],
  boss: [[50, 57, 62, 69, 74], [0, 0.18, 0.36, 0.54, 0.75], 'sawtooth', 2.0],
};
export function stinger(name) {
  const FB = { secret: 'secret', mission: 'victory', shrine: 'unlock', merchant: 'chest' };
  if (ctx && save.settings.music <= 0 && FB[name]) return sfx(FB[name]);
  if (!ctx || !STING[name] || save.settings.music <= 0) return; const [notes, at, type, len] = STING[name]; audio.lastSting = name;
  duck(0.3, len); const t0 = ctx.currentTime + 0.02;
  notes.forEach((n, i) => { const t = t0 + at[i]; mtone(stingBus, type, N(n), t, len - at[i] * 0.5, type === 'sine' ? 0.12 : 0.06, type === 'sine' ? 0 : 2400); mtone(stingBus, 'sine', N(n + 12), t, 0.6, 0.025); });
  if (name === 'boss' || name === 'shrine') pad(stingBus, notes.slice(0, 3).map((n) => N(n)), t0, len + 0.6, 1100);
}

// ---------- v2.3 ambience beds per biome: looped filtered noise + scattered critter calls ----------
const AMB = { // layer gains: wind, water, rain; event rates per second: birds, crickets, drips, spores
  hub: { wind: 0.12, birds: 0.5, crickets: 0.4 }, title: { wind: 0.14, birds: 0.3 }, tutorial: { wind: 0.12, birds: 0.6 },
  ch1: { wind: 0.2, birds: 0.7 }, ch2: { water: 0.3, drips: 1.6, wind: 0.06 }, ch3: { wind: 0.12, crickets: 1.4 },
  ch4: { wind: 0.4, rain: 0.18, birds: 0.1 }, ch5: { wind: 0.08, spores: 1.2, birds: 0.2 }, boss: { wind: 0.16 }, none: {},
};
const beds = {}; let ambName = null, ambNext = 0;
function bed(kind) {
  if (beds[kind]) return beds[kind]; const src = ctx.createBufferSource(); src.buffer = noiseBuf; src.loop = true; const f = ctx.createBiquadFilter(), g = ctx.createGain();
  if (kind === 'wind') { f.type = 'lowpass'; f.frequency.value = 420; const l = ctx.createOscillator(), lg = ctx.createGain(); l.frequency.value = 0.09; lg.gain.value = 220; l.connect(lg); lg.connect(f.frequency); l.start(); }
  else if (kind === 'water') { f.type = 'bandpass'; f.frequency.value = 900; f.Q.value = 0.5; } else { f.type = 'highpass'; f.frequency.value = 3500; }
  g.gain.value = 0.0001; src.connect(f); f.connect(g); g.connect(ambBus); src.start(); return (beds[kind] = g);
}
export function setAmbience(name) {
  if (ambName === name) return; ambName = name; audio.amb = name; if (!ctx) return; const A = AMB[name] || {}, t = ctx.currentTime;
  for (const k of ['wind', 'water', 'rain']) { const v = A[k] || 0; if (!v && !beds[k]) continue; const g = bed(k).gain; g.cancelScheduledValues(t); g.setValueAtTime(Math.max(g.value, 0.0001), t); g.linearRampToValueAtTime(Math.max(v, 0.0001), t + 2); }
}
function ambTick(now) {
  if (!ambName || now < ambNext || (save.settings.amb ?? 0.6) <= 0 || ctx.state !== 'running') return; ambNext = now + 0.25; const A = AMB[ambName] || {};
  const r = (k) => Math.random() < (A[k] || 0) * 0.25;
  if (r('birds')) { const f = 2400 + Math.random() * 1800, n = 2 + (Math.random() * 3 | 0); for (let i = 0; i < n; i++) tone('sine', f, f * (1.2 + Math.random() * 0.3), 0.07, 0.03, { when: i * 0.11, bus: ambBus }); }
  if (r('crickets')) { const f = 4300 + Math.random() * 600; for (let i = 0; i < 3; i++) tone('sine', f, f, 0.035, 0.018, { when: i * 0.06, bus: ambBus }); }
  if (r('drips')) { const f = 1100 + Math.random() * 900; tone('sine', f, f * 1.8, 0.06, 0.05, { bus: ambBus }); }
  if (r('spores')) { const f = 1800 + Math.random() * 1600; tone('sine', f, f, 0.9, 0.012, { a: 0.3, bus: ambBus }); }
}

// ---------- v2.3 music director: picks theme, boss phase, tension and ambience from game state every frame ----------
export function songFor(W) {
  if (!W) return 'menu';
  if (W.mode === 'hub') return 'hub'; if (W.mode === 'tutorial') return 'calm';
  const b = W.boss; if (b && !b.dead && (W.mode === 'boss' || (W.fight && W.fight.e === b))) return b.phase >= 3 ? 'boss3' : b.phase === 2 ? 'boss2' : 'boss';
  if (W.fight && W.fight.e && !W.fight.e.dead) return 'mini';
  const c = W.chapter; if (c >= 2) return 'ch' + Math.min(5, c); if (c === 1) return 'biome';
  return W.stage ? 'caverns' : 'biome';
}
function ambFor(W) { if (!W) return 'title'; if (W.mode === 'hub' || W.mode === 'tutorial') return W.mode; if (W.mode === 'boss') return 'boss'; return 'ch' + Math.max(1, Math.min(5, W.chapter || (W.stage ? 2 : 1))); }
let lastPhase = 0, tSm = 0;
export function director(game, dt, uiName) {
  if (!ctx) return; const W = game.state === 'play' ? game.world : null;
  if (uiName === 'comic') playSong(audio.ending ? 'ending' : 'story');
  else if (!W) playSong(game.state === 'title' || !game.world ? 'menu' : audio.song);
  else if (uiName === 'victory') { /* keep current song: the stinger + calm tail plays */ }
  else playSong(songFor(W));
  setAmbience(uiName === 'comic' ? 'none' : ambFor(W));
  // tension: live foes near Sprig in the current room (not counting dummies)
  let want = 0;
  if (W && W.player && !game.paused && W.mode !== 'hub') { const P = W.player; let n = 0; for (const e of W.enemies) if (!e.dead && e.type !== 'dummy' && e.type !== 'mimicIdle' && Math.abs(e.cx - P.cx) < 420 && Math.abs(e.cy - P.cy) < 260) n++; want = Math.min(1, n * 0.34); if (W.fight) want = 0; }
  tSm += (want - tSm) * Math.min(1, dt * (want > tSm ? 2.5 : 0.8)); audio.tension = tSm;
  tensBus.gain.setTargetAtTime(Math.max(0.0001, tSm * 0.9), ctx.currentTime, 0.12);
  const b = W && W.boss; const ph = b && !b.dead ? b.phase : 0; if (ph > lastPhase && lastPhase) stinger('boss'); lastPhase = ph;
}
// v2.3 test hook: a read-only snapshot of the mix graph
export function graph() { if (!ctx) return null; return { state: ctx.state, master: master.gain.value, mus: musBus.gain.value, duck: duckG.gain.value, tens: tensBus.gain.value, sting: stingBus.gain.value, amb: ambBus.gain.value, sfx: sfxBus.gain.value, song: audio.song, ambName: audio.amb, tension: audio.tension || 0, duckN: audio.duckN || 0, lastSting: audio.lastSting || null }; }
