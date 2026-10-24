// v2.0 trap pack: swinging log pendulums, poison thorn vines, falling branches / stalactites, spore puffballs,
// rolling thorn walls and timed thorn gates. Same rules as v1.5: every one shows red before it can hurt (or is always
// visibly red and moving on a fixed track), hurts a little, never kills outright and never blocks the path (no tiles change).
import { TILE } from './util.js';
import { drawGlow } from './art.js';
import { sfx } from './audio.js';
import { HAZ } from './traps.js';
export const TRAP20_TIMING = {
  pendulum: { period: 3.4, amp: 1.0 }, // always visible; the red arc on the ground shows its whole path
  vine: { idle: 1.8, warn: 0.75, on: 1.0 }, // tendrils wriggle + glow for 0.75 s before thorns spring up
  stalactite: { reach: 64, shake: 0.7, gone: 3.2, g: 1300 }, // shakes + red shadow for 0.7 s once you walk under it
  spore: { idle: 2.0, warn: 0.8, on: 1.0, r: 46 }, // the danger ring is drawn at full size for the whole 0.8 s warning
  roller: { speed: 55, h: 30 }, // always visible, always on its track, low enough to hop over
  gate: { open: 2.2, warn: 0.7, shut: 1.2 }, // gate vines glow + creak for 0.7 s before they snap shut
};
export const TRAP20_DMG = { pendulum: 12, vine: 8, stalactite: 12, spore: 8, roller: 10, gate: 10 };
export const TRAP20_INFO = {
  pendulum: { name: 'Swinging Log', tip: 'Run under it just after it swings past.' }, vine: { name: 'Poison Thorn Vine', tip: 'Purple glow means thorns are coming. Wait, then cross.' },
  stalactite: { name: 'Falling Branch', tip: 'It shakes before it drops. Keep moving!' }, spore: { name: 'Spore Puff', tip: 'Step out of the red ring before it pops.' },
  roller: { name: 'Thorn Roller', tip: 'Hop over the rolling thorns.' }, gate: { name: 'Thorn Gate', tip: 'Wait for the gate to open, then dash through.' },
};
export const KINDS20 = Object.keys(TRAP20_TIMING);
const seqOf = (k) => { const T = TRAP20_TIMING[k]; return k === 'vine' ? [['idle', T.idle], ['warn', T.warn], ['on', T.on]] : k === 'spore' ? [['idle', T.idle], ['warn', T.warn], ['on', T.on]] : k === 'gate' ? [['idle', T.open], ['warn', T.warn], ['on', T.shut]] : null; };
export function phase20(kind, t) { const s = seqOf(kind); if (!s) return { st: 'on', k: 0 }; const c = s.reduce((a, b) => a + b[1], 0); let u = ((t % c) + c) % c; for (const [st, d] of s) { if (u < d) return { st, k: u / d }; u -= d; } return { st: 'idle', k: 0 }; }
export function warnBefore(kind) { const s = seqOf(kind); return s ? s.find((q) => q[0] === 'warn')[1] : kind === 'stalactite' ? TRAP20_TIMING.stalactite.shake : Infinity; } // Infinity = always visible + on a fixed track
export function init20(W, o) {
  o.off = ((o.x * 7 + o.y * 3) % 10) * 0.37;
  if (o.k === 'pendulum') { o.px = o.x * TILE + 12; o.py = o.y * TILE; }
  if (o.k === 'stalactite') { o.st = 'hang'; o.t = 0; o.fy = o.y * TILE + 4; o.vy = 0; }
  if (o.k === 'roller') { o.px = o.x * TILE + 12; o.dir = 1; }
}
export function pendPos(o, t) { const T = TRAP20_TIMING.pendulum, a = T.amp * Math.sin(((t + o.off) / T.period) * Math.PI * 2); return { a, x: o.px + Math.sin(a) * o.len, y: o.py + Math.cos(a) * o.len }; }
export function box20(o, t) {
  const X = o.x * TILE, Y = o.y * TILE;
  if (o.k === 'pendulum') { const p = pendPos(o, t); return { x: p.x - 13, y: p.y - 13, w: 26, h: 26 }; }
  if (o.k === 'vine') return phase20('vine', t + o.off).st === 'on' ? { x: X + 2, y: Y + 8, w: o.n * TILE - 4, h: 16 } : null;
  if (o.k === 'stalactite') return o.st === 'fall' ? { x: X + 4, y: o.fy, w: 16, h: 28 } : null;
  if (o.k === 'spore') { const r = TRAP20_TIMING.spore.r; return phase20('spore', t + o.off).st === 'on' ? { x: X + 12 - r * 0.85, y: Y + TILE - r * 1.5, w: r * 1.7, h: r * 1.5 } : null; }
  if (o.k === 'roller') return { x: o.px - 11, y: Y + TILE - TRAP20_TIMING.roller.h, w: 22, h: TRAP20_TIMING.roller.h };
  if (o.k === 'gate') return phase20('gate', t + o.off).st === 'on' ? { x: X + 6, y: Y + TILE - o.h * TILE, w: 12, h: o.h * TILE } : null;
  return null;
}
export function update20(tr, o, dt, t) {
  const W = tr.W, P = W.player, X = o.x * TILE;
  if (o.k === 'roller') { const x0 = o.x * TILE + 12, x1 = o.x2 * TILE + 12; o.px += o.dir * TRAP20_TIMING.roller.speed * dt; if (o.px > x1) { o.px = x1; o.dir = -1; } if (o.px < x0) { o.px = x0; o.dir = 1; } }
  if (o.k === 'stalactite') { const T = TRAP20_TIMING.stalactite; o.t += dt;
    if (o.st === 'hang' && Math.abs(P.cx - (X + 12)) < T.reach && P.cy > o.y * TILE && P.cy < o.floor + 10) { o.st = 'shake'; o.t = 0; sfx('telegraph', 0.06); }
    else if (o.st === 'shake' && o.t >= T.shake) { o.st = 'fall'; o.t = 0; o.vy = 0; }
    else if (o.st === 'fall') { o.vy += T.g * dt; o.fy += o.vy * dt; if (o.fy + 28 >= o.floor) { o.st = 'gone'; o.t = 0; W.fx.burst(X + 12, o.floor - 4, 12, { color: ['#8a6a50', '#c0a080', '#e8d8b0'], max: 170, g: 600, size: 4 }); W.fx.shake(0.06); sfx('thump', 0.1); } }
    else if (o.st === 'gone' && o.t >= T.gone) { o.st = 'hang'; o.fy = o.y * TILE + 4; W.fx.burst(X + 12, o.y * TILE + 10, 6, { color: ['#a6e47a', '#e8ffb0'], max: 60, g: -30, size: 3 }); } }
  const s = seqOf(o.k); if (s) { const p = phase20(o.k, t + o.off); if (p.st === 'warn' && o.lastSt !== 'warn' && Math.abs(X - P.cx) < 420) sfx('telegraph', 0.05); if (o.k === 'spore' && p.st === 'on' && o.lastSt === 'warn') { W.fx.burst(X + 12, o.y * TILE + 8, 18, { color: ['#c8f0a0', '#f0e0b0', '#ffd0f0'], min: 40, max: 150, g: -40, drag: 2, life: 0.9, size: 6 }); sfx('thump', 0.05); } o.lastSt = p.st; }
  const b = box20(o, t); if (!b) return;
  if (W.overlapPlayer(b, 3)) W.damagePlayer(TRAP20_DMG[o.k], b.x + b.w / 2, { ...TRAP20_INFO[o.k], parryable: false, trap: o.k });
  tr.hitEnemies(b, o.k);
}
// ---------- drawing ----------
export const DRAW20 = {
  draw_pendulum(g, o, X, Y, t) {
    const T = TRAP20_TIMING.pendulum, p = pendPos(o, t);
    g.strokeStyle = 'rgba(255,61,110,0.28)'; g.lineWidth = 3; g.setLineDash([4, 6]); g.beginPath(); g.arc(o.px, o.py, o.len, Math.PI / 2 - T.amp, Math.PI / 2 + T.amp); g.stroke(); g.setLineDash([]); // the whole swing path, always shown
    g.fillStyle = '#15131f'; g.beginPath(); g.arc(o.px, o.py + 2, 5, 0, 7); g.fill();
    g.strokeStyle = '#15131f'; g.lineWidth = 4.4; g.beginPath(); g.moveTo(o.px, o.py + 2); g.lineTo(p.x, p.y); g.stroke(); g.strokeStyle = '#4f7a3a'; g.lineWidth = 2.2; g.stroke();
    drawGlow(g, p.x, p.y, 30, HAZ, 0.35 + 0.25 * Math.abs(Math.cos(p.a)));
    g.save(); g.translate(p.x, p.y); g.rotate(-p.a); g.fillStyle = '#6a4428'; g.strokeStyle = '#15131f'; g.lineWidth = 2.4; g.beginPath(); g.roundRect(-16, -11, 32, 22, 8); g.fill(); g.stroke();
    g.fillStyle = '#c8a070'; g.beginPath(); g.ellipse(-16, 0, 4, 10, 0, 0, 7); g.ellipse(16, 0, 4, 10, 0, 0, 7); g.fill(); g.stroke();
    g.fillStyle = HAZ; g.lineWidth = 1; for (let i = 0; i < 4; i++) { g.beginPath(); g.moveTo(-12 + i * 8, 11); g.lineTo(-8 + i * 8, 17); g.lineTo(-4 + i * 8, 11); g.fill(); g.stroke(); } g.restore();
  },
  draw_vine(g, o, X, Y, t) {
    const p = phase20('vine', t + o.off), base = Y + TILE, w = o.n * TILE, h = p.st === 'on' ? 17 * Math.min(1, p.k * 8) : p.st === 'warn' ? 3 + 3 * Math.abs(Math.sin(p.k * 16)) : 2;
    g.fillStyle = '#2a1830'; g.beginPath(); g.ellipse(X + w / 2, base - 2, w / 2 + 2, 4.5, 0, 0, 7); g.fill();
    g.strokeStyle = '#5a3a6a'; g.lineWidth = 3; g.beginPath(); for (let x = 0; x <= w; x += 4) g.lineTo(X + x, base - 3 + Math.sin(x * 0.4 + t * 3) * 1.5); g.stroke(); // creeping vine, always visible
    const col = p.st === 'idle' ? '#6a4a7a' : p.st === 'warn' ? '#c050ff' : '#b040e0';
    g.fillStyle = col; g.strokeStyle = '#15131f'; g.lineWidth = 1.4; g.beginPath();
    for (let i = 0; i < o.n * 3; i++) { const x = X + 1 + i * 7.6, c = Math.sin(i * 2.1) * 1.8; g.moveTo(x, base - 3); g.quadraticCurveTo(x + 2 + c, base - 3 - h * 0.6, x + 3.6 + c, base - 3 - h); g.quadraticCurveTo(x + 5 + c, base - 3 - h * 0.5, x + 7.4, base - 3); }
    g.fill(); g.stroke();
    if (p.st === 'warn') { drawGlow(g, X + w / 2, base - 6, 20 + w * 0.5, '#c050ff', 0.4 + 0.4 * Math.abs(Math.sin(p.k * 14))); drawGlow(g, X + w / 2, base - 6, 16 + w * 0.3, HAZ, 0.35); }
    if (p.st === 'on') { drawGlow(g, X + w / 2, base - 10, 18 + w * 0.4, '#b040e0', 0.4); g.fillStyle = '#c8ff8a'; for (let i = 0; i < o.n * 2; i++) { const yy = base - 6 - ((t * 40 + i * 9) % 22); g.globalAlpha = 0.7; g.beginPath(); g.arc(X + 6 + i * 11, yy, 1.6, 0, 7); g.fill(); } g.globalAlpha = 1; }
  },
  draw_stalactite(g, o, X, Y, t) {
    const caverns = this.W.stage >= 1, cx = X + 12, sh = o.st === 'shake' ? Math.sin(t * 60) * 1.8 : 0;
    if (o.st === 'shake' || o.st === 'fall') { const k = o.st === 'shake' ? o.t / TRAP20_TIMING.stalactite.shake : 1; g.globalAlpha = 0.3 + 0.5 * k; g.fillStyle = HAZ; g.beginPath(); g.ellipse(cx, o.floor - 2, 8 + 10 * k, 3 + 2 * k, 0, 0, 7); g.fill(); g.globalAlpha = 1; drawGlow(g, cx, o.floor - 4, 26, HAZ, 0.45 * k); }
    if (o.st === 'gone') { const k = o.t / TRAP20_TIMING.stalactite.gone; g.globalAlpha = Math.min(1, k); g.fillStyle = caverns ? '#5a7a8a' : '#4f7a3a'; g.beginPath(); g.ellipse(cx, Y + 4, 5 * k, 4 * k, 0, 0, 7); g.fill(); g.globalAlpha = 1; return; }
    const y = o.st === 'fall' ? o.fy : Y + 4; g.save(); g.translate(cx + sh, y);
    g.fillStyle = caverns ? '#7a90a0' : '#6a4428'; g.strokeStyle = '#15131f'; g.lineWidth = 2;
    g.beginPath(); if (caverns) { g.moveTo(-9, 0); g.lineTo(9, 0); g.lineTo(2, 22); g.lineTo(0, 28); g.lineTo(-2, 22); } else { g.moveTo(-6, 0); g.lineTo(6, 0); g.lineTo(5, 16); g.lineTo(9, 20); g.lineTo(3, 20); g.lineTo(0, 28); g.lineTo(-3, 20); g.lineTo(-8, 22); g.lineTo(-5, 14); } g.closePath(); g.fill(); g.stroke();
    if (!caverns) { g.fillStyle = '#5a9a40'; g.beginPath(); g.ellipse(-6, 4, 5, 2.4, -0.5, 0, 7); g.ellipse(6, 6, 5, 2.4, 0.5, 0, 7); g.fill(); }
    g.fillStyle = o.st === 'hang' ? '#8a3048' : HAZ; g.beginPath(); g.moveTo(-2.5, 20); g.lineTo(0, 28); g.lineTo(2.5, 20); g.fill(); g.restore();
    if (o.st !== 'hang') drawGlow(g, cx, y + 16, 22, HAZ, 0.5);
  },
  draw_spore(g, o, X, Y, t) {
    const p = phase20('spore', t + o.off), base = Y + TILE, cx = X + 12, r = TRAP20_TIMING.spore.r, sw = p.st === 'warn' ? 1 + p.k * 0.35 + Math.sin(p.k * 30) * 0.05 : p.st === 'on' ? 0.7 : 1;
    if (p.st === 'warn') { g.strokeStyle = HAZ; g.globalAlpha = 0.45 + 0.4 * p.k; g.lineWidth = 2.5; g.setLineDash([6, 5]); g.beginPath(); g.ellipse(cx, base - r * 0.7, r * 0.85, r * 0.75, 0, 0, 7); g.stroke(); g.setLineDash([]); g.globalAlpha = 0.12 + 0.18 * p.k; g.fillStyle = HAZ; g.fill(); g.globalAlpha = 1; }
    g.save(); g.translate(cx, base - 2); g.scale(sw, sw); g.fillStyle = '#15131f'; g.beginPath(); g.ellipse(0, -9, 13, 11, 0, 0, 7); g.fill();
    g.fillStyle = p.st === 'warn' ? '#e890b0' : '#c8a8c0'; g.beginPath(); g.ellipse(0, -9, 11.5, 9.5, 0, 0, 7); g.fill(); g.fillStyle = '#fff0f6'; for (const [dx, dy] of [[-5, -12], [4, -14], [6, -6], [-3, -5]]) { g.beginPath(); g.arc(dx, dy, 1.8, 0, 7); g.fill(); } g.restore();
    if (p.st === 'on') { const a = Math.min(1, p.k * 5) * Math.min(1, (1 - p.k) * 4); g.globalAlpha = 0.5 * a; for (let i = 0; i < 7; i++) { const ang = i * 0.9 + t * 0.6; g.fillStyle = i % 2 ? '#d8f0b0' : '#f0d0e8'; g.beginPath(); g.arc(cx + Math.cos(ang) * r * 0.45, base - r * 0.7 + Math.sin(ang) * r * 0.35, r * 0.45, 0, 7); g.fill(); } g.globalAlpha = 1; drawGlow(g, cx, base - r * 0.7, r * 1.2, HAZ, 0.3 * a); }
  },
  draw_roller(g, o, X, Y, t) {
    const base = Y + TILE, h = TRAP20_TIMING.roller.h, x0 = o.x * TILE + 12, x1 = o.x2 * TILE + 12;
    g.strokeStyle = 'rgba(255,61,110,0.3)'; g.lineWidth = 2; g.setLineDash([3, 5]); g.beginPath(); g.moveTo(x0, base - 1); g.lineTo(x1, base - 1); g.stroke(); g.setLineDash([]); // its track, always shown
    drawGlow(g, o.px, base - h / 2, 28, HAZ, 0.35);
    g.save(); g.translate(o.px, base - h / 2); g.rotate(o.px / 11); g.fillStyle = '#4a3a2a'; g.strokeStyle = '#15131f'; g.lineWidth = 2; g.beginPath(); g.arc(0, 0, h / 2 - 3, 0, 7); g.fill(); g.stroke();
    g.fillStyle = HAZ; g.lineWidth = 1.2; for (let i = 0; i < 9; i++) { const a = (i / 9) * Math.PI * 2; g.beginPath(); g.moveTo(Math.cos(a - 0.25) * (h / 2 - 4), Math.sin(a - 0.25) * (h / 2 - 4)); g.lineTo(Math.cos(a) * (h / 2 + 3), Math.sin(a) * (h / 2 + 3)); g.lineTo(Math.cos(a + 0.25) * (h / 2 - 4), Math.sin(a + 0.25) * (h / 2 - 4)); g.fill(); g.stroke(); }
    g.strokeStyle = '#6a8a4a'; g.lineWidth = 2; g.beginPath(); g.arc(0, 0, h / 4, 0, 5); g.stroke(); g.restore();
  },
  draw_gate(g, o, X, Y, t) {
    const p = phase20('gate', t + o.off), base = Y + TILE, top = base - o.h * TILE, cx = X + 12;
    for (const dx of [-11, 11]) { g.fillStyle = '#15131f'; g.fillRect(cx + dx - 3, top - 4, 6, base - top + 4); g.fillStyle = '#5a3a24'; g.fillRect(cx + dx - 2, top - 3, 4, base - top + 2); g.fillStyle = HAZ; g.beginPath(); g.arc(cx + dx, top - 4, 3, 0, 7); g.fill(); } // posts with red caps, always visible
    const k = p.st === 'on' ? Math.min(1, p.k * 10) : p.st === 'warn' ? 0.12 + Math.abs(Math.sin(p.k * 20)) * 0.08 : 0.06;
    g.strokeStyle = '#15131f'; g.lineWidth = 4; const vines = 3;
    for (let i = 0; i < vines; i++) { const x = cx - 6 + i * 6; g.beginPath(); g.moveTo(x, top); g.lineTo(x + Math.sin(t * 4 + i) * (1 - k) * 2, top + (base - top) * k); g.stroke(); }
    g.strokeStyle = p.st === 'idle' ? '#7a5060' : HAZ; g.lineWidth = 2.2; for (let i = 0; i < vines; i++) { const x = cx - 6 + i * 6; g.beginPath(); g.moveTo(x, top); g.lineTo(x + Math.sin(t * 4 + i) * (1 - k) * 2, top + (base - top) * k); g.stroke(); }
    if (p.st === 'on') { g.fillStyle = HAZ; for (let y = top + 6; y < base - 2; y += 9) for (const s of [-1, 1]) { g.beginPath(); g.moveTo(cx + s * 7, y); g.lineTo(cx + s * 12, y + 3); g.lineTo(cx + s * 7, y + 6); g.fill(); } drawGlow(g, cx, (top + base) / 2, 30, HAZ, 0.35); }
    if (p.st === 'warn') drawGlow(g, cx, top + 6, 26, HAZ, 0.4 + 0.4 * p.k);
  },
};
