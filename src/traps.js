// v1.5 traps. Every trap telegraphs in the hazard red/magenta before it can hurt, hurts a little (never instant death),
// knocks Sprig back, and also hurts enemies that wander into it. Timings are exported so tests can check the warning window.
import { TILE, rectsOverlap } from './util.js';
import { drawGlow } from './art.js';
import { kitDraw } from './paint.js';
import { sfx } from './audio.js';
export const HAZ = '#ff3d6e', HAZ_DK = '#5a1420';
export const TRAP_TIMING = {
  spike: { idle: 1.6, warn: 0.6, up: 0.9, down: 0.25 }, // spikes peek + glint for 0.6 s before popping up
  vent: { idle: 1.8, warn: 0.7, blast: 1.0 }, // grate hisses and puffs for 0.7 s before the steam column
  crusher: { idle: 1.5, warn: 0.75, fall: 0.22, hold: 0.5, rise: 1.0 }, // shakes + red shadow grows on the floor for 0.75 s
  crumble: { shake: 0.6, gone: 3.0 }, // shakes for 0.6 s after you land, then drops; grows back after 3 s
  saw: { speed: 80 }, // always visible, always on its rail
  shooter: { idle: 2.2, warn: 0.6, speed: 190 }, // mouth glows for 0.6 s before a thorn flies
};
export const TRAP_DMG = { spike: 10, vent: 8, crusher: 14, saw: 10, shooter: 8 };
const INFO = { spike: { name: 'Spike Trap', tip: 'Watch the red glint, then hop over.' }, vent: { name: 'Steam Vent', tip: 'Wait for the hiss to stop.' }, crusher: { name: 'Crusher', tip: 'Dash past when the red shadow fades.' }, saw: { name: 'Rail Saw', tip: 'Jump when the saw rolls away.' }, shooter: { name: 'Thorn Spitter', tip: 'Duck the thorn or parry it.' } };
const cycleOf = (k) => { const T = TRAP_TIMING[k]; return k === 'spike' ? T.idle + T.warn + T.up + T.down : k === 'vent' ? T.idle + T.warn + T.blast : k === 'crusher' ? T.idle + T.warn + T.fall + T.hold + T.rise : k === 'shooter' ? T.idle + T.warn : 1; };
// pure phase function: { st: 'idle' | 'warn' | 'on' | 'rise' ..., k: 0..1 progress inside the state }
export function trapPhase(kind, t) {
  const T = TRAP_TIMING[kind], c = cycleOf(kind); let u = ((t % c) + c) % c;
  const seq = kind === 'spike' ? [['idle', T.idle], ['warn', T.warn], ['on', T.up], ['down', T.down]] : kind === 'vent' ? [['idle', T.idle], ['warn', T.warn], ['on', T.blast]] : kind === 'crusher' ? [['idle', T.idle], ['warn', T.warn], ['fall', T.fall], ['on', T.hold], ['rise', T.rise]] : [['idle', T.idle], ['warn', T.warn]];
  for (const [st, d] of seq) { if (u < d) return { st, k: u / d }; u -= d; }
  return { st: seq[0][0], k: 0 };
}
export class Traps {
  constructor(W, list) {
    this.W = W; this.list = []; this.thorns = []; this.enemyCd = new Map();
    const crumbles = list.filter((t) => t.k === 'crumble').sort((a, b) => a.y - b.y || a.x - b.x);
    for (const t of list) {
      if (t.k === 'crumble') continue;
      const o = { ...t, off: 0 };
      if (t.k === 'spike') o.off = (t.group % 2) * cycleOf('spike') * 0.5 + (t.cell ? t.cell.depth * 0.37 : 0);
      if (t.k === 'vent') o.off = (t.x % 3) * 0.9;
      if (t.k === 'crusher') { o.off = (t.x % 3) * 1.1; let gy = t.y + 1; while (gy < W.map.h && !W.map.solid(t.x, gy) && W.map.get(t.x, gy) !== '=') gy++; o.ground = gy * TILE; }
      if (t.k === 'saw') { o.px = t.start * TILE + 12; o.dir = 1; }
      if (t.k === 'shooter') { o.off = (t.y % 2) * 1.1; o.fired = -1; }
      this.list.push(o);
    }
    for (const c of crumbles) { const g = this.list.find((o) => o.k === 'crumble' && o.y === c.y && o.x + o.n === c.x); if (g) g.n++; else this.list.push({ k: 'crumble', x: c.x, y: c.y, n: 1, st: 'solid', t: 0, cell: c.cell }); }
  }
  box(o, t) { // current hurt box (or null)
    if (o.k === 'spike') { const p = trapPhase('spike', t + o.off); return p.st === 'on' ? { x: o.x * TILE + 3, y: o.y * TILE + 10, w: 18, h: 14 } : null; }
    if (o.k === 'vent') { const p = trapPhase('vent', t + o.off); return p.st === 'on' ? { x: o.x * TILE + 2, y: (o.y + 1) * TILE - 104, w: 20, h: 100 } : null; }
    if (o.k === 'crusher') { const y = this.crusherY(o, t), p = trapPhase('crusher', t + o.off); return p.st === 'fall' || (p.st === 'on' && p.k < 0.25) ? { x: o.x * TILE + 12 - 20, y, w: 40, h: 30 } : null; }
    if (o.k === 'saw') return { x: o.px - 12, y: o.y * TILE + 12 - 12, w: 24, h: 24 };
    return null;
  }
  crusherY(o, t) {
    const p = trapPhase('crusher', t + o.off), top = o.y * TILE, bot = o.ground - 30;
    if (p.st === 'fall') return top + (bot - top) * p.k * p.k; if (p.st === 'on') return bot; if (p.st === 'rise') return bot + (top - bot) * p.k; return top;
  }
  update(dt) {
    const W = this.W, P = W.player, t = W.t;
    for (const [e, c] of this.enemyCd) { if (c - dt <= 0) this.enemyCd.delete(e); else this.enemyCd.set(e, c - dt); }
    for (const o of this.list) {
      const ox = o.x * TILE; if (Math.abs(ox - P.cx) > 900 || Math.abs(o.y * TILE - P.cy) > 600) continue;
      if (o.k === 'saw') { const x0 = o.x * TILE + 12, x1 = o.x2 * TILE + 12; o.px += o.dir * TRAP_TIMING.saw.speed * dt; if (o.px > x1) { o.px = x1; o.dir = -1; } if (o.px < x0) { o.px = x0; o.dir = 1; } }
      if (o.k === 'crumble') { this.updateCrumble(o, dt); continue; }
      if (o.k === 'shooter') { this.updateShooter(o, t); continue; }
      const p = o.k === 'saw' ? null : trapPhase(o.k, t + o.off);
      if (p && p.st === 'warn' && o.lastSt !== 'warn' && Math.abs(ox - P.cx) < 420) sfx('telegraph', 0.05);
      if (o.k === 'crusher' && p.st === 'on' && o.lastSt === 'fall') { W.fx.shake(Math.abs(ox - P.cx) < 300 ? 0.18 : 0.05); W.fx.burst(ox + 12, o.ground, 10, { color: ['#c8b8a8', '#8a7a70'], max: 160, g: 300, size: 4 }); sfx('thump', 0.12); }
      if (o.k === 'vent' && p.st === 'on' && Math.random() < dt * 30) W.fx.burst(ox + 12, (o.y + 1) * TILE - 8, 1, { color: ['#ffd0dc', '#ffffff'], min: 160, max: 260, g: -200, drag: 1, life: 0.5, size: 6, angle: -Math.PI / 2, spread: 0.25 });
      if (p) o.lastSt = p.st;
      const b = this.box(o, t); if (!b) continue;
      if (W.overlapPlayer(b, 3)) W.damagePlayer(TRAP_DMG[o.k], b.x + b.w / 2, { ...INFO[o.k], parryable: false, trap: o.k });
      this.hitEnemies(b, o.k);
    }
    this.updateThorns(dt);
  }
  hitEnemies(b, kind) {
    for (const e of this.W.enemies) { if (e.dead || e.boss || this.enemyCd.has(e) || !rectsOverlap(b, e)) continue; this.enemyCd.set(e, 0.9); this.W.hitEnemy(e, { dmg: 18, kb: 260, stun: 0.4, hs: 0.02, src: 'hazard' }, null); this.W.emit('trapHitEnemy', kind); }
  }
  updateCrumble(o, dt) {
    const W = this.W, P = W.player, T = TRAP_TIMING.crumble, x0 = o.x * TILE, x1 = (o.x + o.n) * TILE, top = o.y * TILE;
    if (o.st === 'solid') { if (P.onGround && Math.abs(P.y + P.h - top) < 3 && P.x + P.w > x0 && P.x < x1) { o.st = 'shake'; o.t = 0; sfx('telegraph', 0.04); } }
    else if (o.st === 'shake') { o.t += dt; if (o.t >= T.shake) { o.st = 'gone'; o.t = 0; for (let i = 0; i < o.n; i++) W.setTile(o.x + i, o.y, '.'); W.fx.burst((x0 + x1) / 2, top + 6, 12, { color: ['#8a6a50', '#c0a080'], max: 140, g: 700, size: 5 }); sfx('thump', 0.06); } }
    else if (o.st === 'gone') { o.t += dt; if (o.t >= T.gone && !rectsOverlap({ x: x0, y: top - 2, w: x1 - x0, h: 14 }, P)) { o.st = 'solid'; for (let i = 0; i < o.n; i++) W.setTile(o.x + i, o.y, 'u'); W.fx.burst((x0 + x1) / 2, top + 4, 8, { color: ['#a6e47a', '#e8ffb0'], max: 80, g: -40, size: 3 }); } }
  }
  updateShooter(o, t) {
    const T = TRAP_TIMING.shooter, c = cycleOf('shooter'), n = Math.floor((t + o.off) / c), p = trapPhase('shooter', t + o.off);
    if (p.st === 'idle' && n !== o.fired && (t + o.off) % c < 0.1 && t > 0.5) { o.fired = n; this.thorns.push({ x: o.x * TILE + 12 + o.dir * 14, y: o.y * TILE + 12, vx: o.dir * T.speed, life: 4, o }); sfx('enemyShoot', 0.06); }
  }
  updateThorns(dt) {
    const W = this.W;
    for (const s of this.thorns) {
      s.x += s.vx * dt; s.life -= dt; if (s.life <= 0 || W.map.solidPx(s.x, s.y)) { s.dead = true; W.fx.burst(s.x, s.y, 4, { color: HAZ, max: 80 }); continue; }
      const b = { x: s.x - 6, y: s.y - 4, w: 12, h: 8 };
      if (!s.refl && W.overlapPlayer(b, 2)) { const r = W.damagePlayer(TRAP_DMG.shooter, s.x, { ...INFO.shooter, parryable: true }); if (r === 'hit') s.dead = true; if (r === 'parry') { s.refl = true; s.vx = -s.vx * 1.6; s.life = 1.5; } }
      for (const e of W.enemies) if (!e.dead && !e.boss && rectsOverlap(b, e)) { W.hitEnemy(e, { dmg: 14, kb: 200, stun: 0.3, src: 'hazard' }, null); s.dead = true; break; }
    }
    this.thorns = this.thorns.filter((s) => !s.dead);
  }
  // ---------- drawing (pure canvas, hazard colour language) ----------
  draw(g, vx0, vx1, vy0, vy1) {
    const t = this.W.t;
    for (const o of this.list) {
      const X = o.x * TILE, Y = o.y * TILE; if (X < vx0 - 200 || X > vx1 + 200 || Y < vy0 - 200 || Y > vy1 + 200) continue;
      this['draw_' + o.k](g, o, X, Y, t);
    }
    for (const s of this.thorns) { g.save(); g.translate(s.x, s.y); g.scale(Math.sign(s.vx) || 1, 1); g.fillStyle = HAZ; g.strokeStyle = '#15131f'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(8, 0); g.lineTo(-6, -4); g.lineTo(-3, 0); g.lineTo(-6, 4); g.closePath(); g.fill(); g.stroke(); g.restore(); drawGlow(g, s.x, s.y, 14, HAZ, 0.5); }
  }
  // v1.6 forest skins: same shapes, hitboxes, timings and red telegraphs as v1.5
  draw_spike(g, o, X, Y, t) { // thorn bramble growing from a root knot
    const p = trapPhase('spike', t + o.off), base = Y + TILE;
    const h = p.st === 'on' ? 16 : p.st === 'warn' ? 3 + 3 * Math.abs(Math.sin(p.k * 18)) : p.st === 'down' ? 16 * (1 - p.k) : 2;
    g.fillStyle = '#15131f'; g.beginPath(); g.ellipse(X + 12, base - 2, 13, 4.5, 0, 0, 7); g.fill(); g.fillStyle = '#5a3a24'; g.beginPath(); g.ellipse(X + 12, base - 2.5, 11.5, 3.2, 0, 0, 7); g.fill(); // root knot, always visible
    g.fillStyle = '#3f7a3a'; g.beginPath(); g.ellipse(X + 5, base - 4, 3, 1.4, -0.5, 0, 7); g.ellipse(X + 19, base - 4, 3, 1.4, 0.5, 0, 7); g.fill();
    g.fillStyle = p.st === 'idle' ? '#7a5060' : HAZ; g.strokeStyle = '#15131f'; g.lineWidth = 1.6; g.beginPath();
    for (let i = 0; i < 3; i++) { const x = X + 1 + i * 7.3, c = (i - 1) * 1.6; g.moveTo(x, base - 4); g.quadraticCurveTo(x + 2 + c, base - 4 - h * 0.6, x + 3.6 + c, base - 4 - h); g.quadraticCurveTo(x + 5 + c, base - 4 - h * 0.5, x + 7.3, base - 4); }
    g.fill(); g.stroke();
    if (p.st === 'warn') { drawGlow(g, X + 12, base - 6, 26, HAZ, 0.45 + 0.4 * Math.abs(Math.sin(p.k * 14))); g.fillStyle = '#fff'; g.fillRect(X + 4 + ((p.k * 40) % 16), base - 8, 2, 2); }
    if (p.st === 'on') drawGlow(g, X + 12, base - 10, 22, HAZ, 0.35);
  }
  draw_vent(g, o, X, Y, t) { // spore vent: a fungus mouth in the earth that puffs a spore plume
    const p = trapPhase('vent', t + o.off), base = Y + TILE;
    g.fillStyle = '#15131f'; g.beginPath(); g.ellipse(X + 12, base - 3, 13, 6, 0, Math.PI, 0); g.fill();
    g.fillStyle = '#7a5a6a'; g.beginPath(); g.ellipse(X + 12, base - 3, 11, 4.6, 0, Math.PI, 0); g.fill(); // cap rim
    g.fillStyle = '#c8a8b0'; for (const dx of [-7, 0, 7]) { g.beginPath(); g.arc(X + 12 + dx, base - 5, 1.3, 0, 7); g.fill(); } // spots
    g.fillStyle = p.st === 'idle' ? '#3a2a34' : HAZ; g.beginPath(); g.ellipse(X + 12, base - 3, 6, 2.2, 0, 0, 7); g.fill(); // mouth (glows red when about to puff)
    if (p.st === 'warn') { drawGlow(g, X + 12, base - 6, 24, HAZ, 0.3 + 0.5 * p.k); if (Math.random() < 0.3) this.W.fx.burst(X + 12, base - 8, 1, { color: '#f0e0b0', min: 30, max: 80, g: -60, life: 0.4, size: 3, angle: -Math.PI / 2, spread: 0.5 }); }
    if (p.st === 'on') { const a = Math.min(1, p.k * 6) * Math.min(1, (1 - p.k) * 6); g.globalAlpha = 0.55 * a; const gr = g.createLinearGradient(0, base, 0, base - 104); gr.addColorStop(0, '#fff6d8'); gr.addColorStop(0.4, '#f0d8a0'); gr.addColorStop(1, 'rgba(255,61,110,0)'); g.fillStyle = gr; g.beginPath(); g.moveTo(X + 4, base - 6); g.quadraticCurveTo(X - 6 + Math.sin(t * 20) * 3, base - 60, X - 2, base - 104); g.lineTo(X + 26, base - 104); g.quadraticCurveTo(X + 30 + Math.sin(t * 17) * 3, base - 60, X + 20, base - 6); g.fill();
      g.fillStyle = '#fff2c0'; for (let i = 0; i < 6; i++) { const yy = base - ((t * 90 + i * 17) % 100), xx = X + 12 + Math.sin(t * 6 + i * 2) * 8; g.beginPath(); g.arc(xx, yy, 1.8, 0, 7); g.fill(); } g.globalAlpha = 1; drawGlow(g, X + 12, base - 30, 36, HAZ, 0.3 * a); }
  }
  draw_crusher(g, o, X, Y, t) { // falling log on two vine ropes from the canopy (ropes are painted to the trap tile; these reach the log)
    const p = trapPhase('crusher', t + o.off), y = this.crusherY(o, t), cx = X + 12, sh = p.st === 'warn' ? Math.sin(t * 60) * 2 : 0;
    for (const dx of [-6, 6]) { g.strokeStyle = '#15131f'; g.lineWidth = 4.4; g.beginPath(); g.moveTo(cx + dx, Y - 2); g.lineTo(cx + dx + sh, y + 2); g.stroke(); g.strokeStyle = '#4f7a3a'; g.lineWidth = 2.2; g.stroke(); }
    const sk = p.st === 'warn' ? p.k : p.st === 'fall' ? 1 : p.st === 'idle' ? 0.15 : p.st === 'on' ? 1 : 1 - p.k;
    g.globalAlpha = 0.25 + 0.55 * sk; g.fillStyle = sk > 0.2 ? HAZ : '#15131f'; g.beginPath(); g.ellipse(cx, o.ground - 2, 10 + 12 * sk, 3 + 2 * sk, 0, 0, 7); g.fill(); g.globalAlpha = 1;
    if (p.st === 'warn') drawGlow(g, cx, o.ground - 4, 30, HAZ, 0.5 * p.k);
    // the log: bark body, cut ring ends, red thorn teeth underneath
    if (!kitDraw(g, 'glog', cx - 23 + sh, cx + 23 + sh, y - 1, 32, (o.x & 1) === 1, 'brightness(0.9)', 'rgba(255,220,160,0.6)')) { g.fillStyle = '#6a4428'; g.strokeStyle = '#15131f'; g.lineWidth = 2.5; g.beginPath(); g.roundRect(cx - 20 + sh, y, 40, 30, 9); g.fill(); g.stroke(); }
    g.fillStyle = p.st === 'warn' || p.st === 'fall' ? HAZ : '#8a3048'; g.strokeStyle = '#15131f'; g.lineWidth = 1;
    for (let i = 0; i < 4; i++) { g.beginPath(); g.moveTo(cx - 18 + i * 10 + sh, y + 30); g.lineTo(cx - 13 + i * 10 + sh, y + 37); g.lineTo(cx - 8 + i * 10 + sh, y + 30); g.fill(); g.stroke(); }
    g.fillStyle = p.st === 'warn' ? '#ffe0e8' : '#2a1a14'; g.beginPath(); g.ellipse(cx - 6.5 + sh, y + 12, 3, 3.4, 0, 0, 7); g.ellipse(cx + 6.5 + sh, y + 12, 3, 3.4, 0, 0, 7); g.fill(); // knot-hole eyes light up before the slam
  }
  draw_saw(g, o, X, Y, t) { // spinning seed-pod on a branch rail (rail ends sit on trunk posts painted with the tiles)
    const y = Y + 12, x0 = o.x * TILE + 12, x1 = o.x2 * TILE + 12;
    // v1.7: the pod runs in a carved groove along a fallen log (groove sits at 54% of the painted log height)
    const LH = 22, okLog = kitDraw(g, 'glog', x0 - 18, x1 + 18, y - LH * 0.54, LH, (o.x & 1) === 1, 'brightness(0.78) saturate(0.9)', 'rgba(255,220,160,0.55)');
    if (!okLog) { g.strokeStyle = '#15131f'; g.lineWidth = 12; g.lineCap = 'round'; g.beginPath(); g.moveTo(x0 - 10, y); g.lineTo(x1 + 10, y); g.stroke(); g.strokeStyle = '#6a4428'; g.lineWidth = 9; g.stroke(); }
    g.strokeStyle = 'rgba(10,6,4,0.85)'; g.lineWidth = 3.2; g.lineCap = 'round'; g.beginPath(); g.moveTo(x0, y); g.lineTo(x1, y); g.stroke(); // groove
    g.strokeStyle = 'rgba(255,61,110,0.35)'; g.lineWidth = 1; g.beginPath(); g.moveTo(x0, y + 0.5); g.lineTo(x1, y + 0.5); g.stroke();
    for (const x of [x0, x1]) { g.fillStyle = '#15131f'; g.beginPath(); g.arc(x, y, 4, 0, 7); g.fill(); g.fillStyle = HAZ; g.beginPath(); g.arc(x, y, 2.6, 0, 7); g.fill(); }
    g.save(); g.translate(o.px, y); g.rotate(t * 12 * o.dir); g.fillStyle = '#e8d8b0'; g.strokeStyle = '#15131f'; g.lineWidth = 2; g.beginPath();
    for (let i = 0; i < 16; i++) { const a = (i / 16) * Math.PI * 2, r = i % 2 ? 9 : 13; g.lineTo(Math.cos(a) * r, Math.sin(a) * r); } g.closePath(); g.fill(); g.stroke();
    g.fillStyle = '#7a5030'; g.beginPath(); g.arc(0, 0, 7, 0, 7); g.fill(); g.fillStyle = HAZ; g.beginPath(); g.arc(0, 0, 4, 0, 7); g.fill(); g.restore(); drawGlow(g, o.px, y, 26, HAZ, 0.3);
  }
  draw_crumble(g, o, X, Y, t) { // rotten branch: grey-green wood with cracks and fungus, shakes red before it snaps
    if (o.st === 'gone') { const k = o.t / TRAP_TIMING.crumble.gone; if (k > 0.6) { g.globalAlpha = (k - 0.6) * 1.2; g.strokeStyle = '#a6e47a'; g.setLineDash([3, 3]); g.strokeRect(X + 1, Y + 1, o.n * TILE - 2, 8); g.setLineDash([]); g.globalAlpha = 1; } return; }
    const sh = o.st === 'shake' ? Math.sin(t * 70) * 1.6 : 0;
    const okB = kitDraw(g, 'br' + (o.x % 3), X - 5 + sh, X + o.n * TILE + 5 + sh, Y - 5, 19, (o.x & 1) === 1, 'saturate(0.35) brightness(0.85) sepia(0.25)', 'rgba(220,235,190,0.6)');
    if (!okB) { g.fillStyle = '#15131f'; g.beginPath(); g.roundRect(X - 1 + sh, Y - 1.5, o.n * TILE + 2, 11, 5); g.fill(); }
    for (let i = 0; i < o.n; i++) { const x = X + i * TILE + sh; if (!okB) { g.fillStyle = i % 2 ? '#7a6a52' : '#84745a'; g.fillRect(x, Y, TILE, 8); }
      g.strokeStyle = o.st === 'shake' ? HAZ : 'rgba(30,22,16,0.85)'; g.lineWidth = 1.4; g.beginPath(); g.moveTo(x + 6, Y); g.lineTo(x + 10, Y + 5); g.lineTo(x + 8, Y + 9); g.moveTo(x + 16, Y); g.lineTo(x + 14, Y + 7); g.stroke();
      if ((i + o.x) % 2 === 0) { g.fillStyle = '#e0c890'; g.strokeStyle = '#15131f'; g.lineWidth = 1; g.beginPath(); g.ellipse(x + 18, Y + 10, 4, 2, 0, 0, Math.PI); g.fill(); g.stroke(); } }
    if (o.st === 'shake') drawGlow(g, X + o.n * 12, Y + 4, 24 + o.n * 6, HAZ, 0.4);
  }
  draw_shooter(g, o, X, Y, t) { // knot-hole in the bark that spits thorns
    const p = trapPhase('shooter', t + o.off), mx = X + 12 + o.dir * 10, my = Y + 12;
    g.fillStyle = '#5a3a24'; g.strokeStyle = '#15131f'; g.lineWidth = 2; g.beginPath(); g.ellipse(mx, my, 7, 9, 0, 0, 7); g.fill(); g.stroke();
    g.strokeStyle = '#8a6040'; g.lineWidth = 1; g.beginPath(); g.ellipse(mx, my, 5, 7, 0, 0, 7); g.stroke();
    g.fillStyle = p.st === 'warn' ? HAZ : '#1e140e'; g.beginPath(); g.arc(mx + o.dir * 2, my, 3.5 + (p.st === 'warn' ? p.k * 2 : 0), 0, 7); g.fill();
    if (p.st === 'warn') drawGlow(g, mx + o.dir * 4, my, 18 + 12 * p.k, HAZ, 0.4 + 0.4 * p.k);
  }
}
