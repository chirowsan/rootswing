// Original synthesized sound effects + music loops (WebAudio only, no files).
import { save } from './save.js';
let ctx = null, master, comp, sfxBus, musBus, noiseBuf, pv = 1;
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
const VARY = { hit: 0.14, hitHeavy: 0.1, pop: 0.12, land: 0.16, step: 0.3, jump: 0.08, pickup: 0.1, swing: 0.12, enemyShoot: 0.1, hookAttach: 0.08, slashA: 0.1, slashB: 0.1, spin: 0.08, thrust: 0.08, kick: 0.12, crit: 0.06 }; // per-play pitch variation
export function sfx(name, minGap = 0.035) {
  if (!ctx || !SFX[name] || save.settings.sfx <= 0) return;
  const now = ctx.currentTime; if (last[name] && now - last[name] < minGap) return; last[name] = now;
  pv = VARY[name] ? 1 + (Math.random() - 0.5) * VARY[name] : 1; try { SFX[name](); } catch (e) { /* ignore */ } pv = 1;
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
  const d = song.drums;
  if (d === 'soft') { if (s8 === 0) drum(B, 'k', t, 0.18); if (s8 % 2 === 1) drum(B, 'h', t, 0.02); }
  if (d === 'mid') { if (s8 === 0 || s8 === 5) drum(B, 'k', t, 0.3); if (s8 === 4) drum(B, 's', t, 0.09); drum(B, 'h', t, s8 % 2 ? 0.025 : 0.015); if (phrase % 8 === 7 && s8 >= 6) drum(B, 's', t, 0.07); }
  if (d === 'hard') { if (s8 % 4 === 0 || s8 === 3) drum(B, 'k', t, 0.34); if (s8 === 2 || s8 === 6) drum(B, 's', t, 0.12); drum(B, 'h', t, 0.03); }
}
function schedule() {
  if (!ctx) return; const now = ctx.currentTime;
  for (let i = players.length - 1; i >= 0; i--) if (players[i].end && now > players[i].end + 0.1) { try { players[i].bus.disconnect(); } catch (e) { /* */ } players.splice(i, 1); }
  if (audio.song && !players.some((p) => !p.end) && SONGS[audio.song]) { const n = audio.song; audio.song = null; playSong(n); }
  if (save.settings.music <= 0 || ctx.state !== 'running') { for (const p of players) p.nextT = Math.max(p.nextT, now + 0.05); return; }
  for (const p of players) {
    const song = SONGS[p.name], sp = 60 / song.bpm / 2; if (p.nextT < now - 0.2) p.nextT = now + 0.05;
    while (p.nextT < now + 0.15 && (!p.end || p.nextT < p.end)) { tick(p, song, p.nextT, sp); p.nextT += sp; p.step++; }
  }
}
