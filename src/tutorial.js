// Hands-on, nearly wordless tutorial: icon bubbles over Sprig, a ghost hand on the real touch button, key caps on keyboard.
import { input } from './input.js';
import { drawIcon, drawGlow } from './art.js';
import { sfx } from './audio.js';
import { TILE } from './util.js';
const STEPS = {
  1: { btn: 'move', icons: ['left', 'right'], keys: ['←', '→'], doneX: 13 },
  2: { btn: 'jump', icons: ['jump'], keys: ['SPACE'], doneX: 23, reveal: [] },
  3: { btn: 'hook', icons: ['hook'], keys: ['V'], doneX: 46, reveal: ['hook'], anchor: true },
  4: { btn: 'attack', icons: ['attack'], keys: ['X'], need: 'dummyHit', count: 3, reveal: ['attack'] },
  5: { btn: 'dash', icons: ['dash'], keys: ['SHIFT'], doneX: 72, reveal: ['dash'] },
  6: { btn: 'hook', icons: ['up', 'hook'], keys: ['V'], doneX: 86, anchor: true },
  7: { btn: 'parry', icons: ['parry'], keys: ['F'], need: 'parry', count: 1, reveal: ['parry'] },
};
export class Tutorial {
  constructor(world) {
    this.W = world; this.step = 0; this.count = 0; this.done = new Set(); this.t = 0; this.okT = 0;
    for (const b of ['attack', 'dash', 'hook', 'parry', 'skill1', 'skill2', 'flask']) input.visible[b] = false;
    world.on((name, data) => this.onEvent(name, data));
  }
  onEvent(name, data) {
    if (name === 'trigger' && !this.done.has(data) && data > this.step) { this.start(data); return; }
    const s = STEPS[this.step]; if (!s || this.done.has(this.step)) return;
    if (s.need === name) { this.count++; if (this.count >= s.count) this.finish(); }
    if (name === 'turretPopped' && this.step === 7) this.finish();
  }
  start(n) {
    if (this.step && !this.done.has(this.step)) this.finish(true);
    this.step = n; this.count = 0; this.t = 0; const s = STEPS[n];
    for (const b of s.reveal || []) { input.visible[b] = true; }
    input.highlight = { [s.btn]: true }; this.W.highlightAnchor = !!s.anchor; sfx('ui');
  }
  finish(silent) {
    this.done.add(this.step); input.highlight = {}; this.W.highlightAnchor = false;
    if (!silent) { sfx('unlock'); this.okT = 1; const P = this.W.player; this.W.fx.burst(P.cx, P.y - 20, 14, { color: ['#ffe27a', '#fff'], kind: 'star', g: -40, max: 140, life: 0.8 }); }
  }
  update(dt) {
    this.t += dt; this.okT = Math.max(0, this.okT - dt);
    const s = STEPS[this.step]; if (!s || this.done.has(this.step)) return;
    if (s.doneX && this.W.player.cx > s.doneX * TILE) this.finish();
  }
  // world-space bubble above Sprig
  drawWorld(g) {
    const P = this.W.player, t = this.t;
    if (this.okT > 0) { g.globalAlpha = Math.min(1, this.okT * 2); g.fillStyle = '#7fe08a'; g.strokeStyle = '#15131f'; g.lineWidth = 3; const y = P.y - 30 - (1 - this.okT) * 16; g.beginPath(); g.arc(P.cx, y, 12, 0, 7); g.fill(); g.stroke(); g.strokeStyle = '#fff'; g.lineWidth = 3; g.beginPath(); g.moveTo(P.cx - 5, y); g.lineTo(P.cx - 1, y + 4); g.lineTo(P.cx + 6, y - 4); g.stroke(); g.globalAlpha = 1; }
    const s = STEPS[this.step]; if (!s || this.done.has(this.step) || this.t < 0.3) return;
    const touch = input.touchActive || input.forceTouch; const n = s.icons.length;
    const bw = n * 24 + 14, x = P.cx, y = P.y - 30 + Math.sin(t * 4) * 2;
    g.globalAlpha = Math.min(1, (this.t - 0.3) * 4);
    g.fillStyle = 'rgba(20,18,32,0.82)'; g.strokeStyle = '#ffe27a'; g.lineWidth = 2; g.beginPath(); g.roundRect(x - bw / 2, y - 16, bw, 30, 10); g.fill(); g.stroke();
    g.beginPath(); g.moveTo(x - 5, y + 14); g.lineTo(x, y + 21); g.lineTo(x + 5, y + 14); g.fill();
    for (let i = 0; i < n; i++) drawIcon(g, s.icons[i], x - (n - 1) * 12 + i * 24, y - 1, 18, '#ffe27a');
    if (!touch) { g.font = '800 10px system-ui,sans-serif'; g.textAlign = 'center'; const label = s.keys.join('  '); const w = g.measureText(label).width + 12; g.fillStyle = '#fff4dc'; g.strokeStyle = '#15131f'; g.lineWidth = 1.5; g.beginPath(); g.roundRect(x - w / 2, y - 34, w, 15, 4); g.fill(); g.stroke(); g.fillStyle = '#15131f'; g.fillText(label, x, y - 23); }
    g.globalAlpha = 1;
  }
  // screen-space ghost hand on the real control
  drawScreen(g) {
    const s = STEPS[this.step]; if (!s || this.done.has(this.step) || !(input.touchActive || input.forceTouch) || !input.layout) return;
    const L = input.layout, t = this.t; let x, y, press;
    if (s.btn === 'move') { const k = (t * 0.8) % 1; x = L.stickHome.x + Math.min(1, k * 2.5) * L.stickR * 0.9; y = L.stickHome.y; press = k < 0.8; }
    else { const b = L[s.btn]; const k = (t * 1.2) % 1; x = b.x; y = b.y; press = k > 0.35 && k < 0.6; if (s.btn === 'hook' && this.step === 6) { /* hold up while hooking: just tap */ } }
    drawHand(g, x, y, press, L.s);
  }
}
export function drawHand(g, x, y, press, s = 1) {
  g.save(); g.translate(x + 6 * s, y + 10 * s + (press ? 0 : 8 * s)); g.scale(s * (press ? 0.92 : 1), s * (press ? 0.92 : 1)); g.globalAlpha = 0.85;
  if (press) { g.strokeStyle = '#ffe27a'; g.lineWidth = 3; g.beginPath(); g.arc(-6, -22, 16, 0, 7); g.stroke(); }
  g.fillStyle = '#fff4dc'; g.strokeStyle = '#15131f'; g.lineWidth = 2.5;
  g.beginPath(); g.roundRect(-11, -26, 10, 30, 5); g.fill(); g.stroke(); // index finger
  g.beginPath(); g.roundRect(-14, -4, 30, 26, 10); g.fill(); g.stroke();
  for (let i = 0; i < 3; i++) { g.beginPath(); g.roundRect(-1 + i * 6, -6 + i, 6, 12, 3); g.fill(); g.stroke(); }
  g.restore();
}
