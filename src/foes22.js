// v2.2 new foes: the Mimic (a chest with teeth) and the Thorn Hunter (an elite that follows you between rooms).
import { TILE, clamp, sign, rand } from './util.js';
import { drawGlow } from './art.js';
import { G, sImg } from './gfx.js';
import { sfx } from './audio.js';
import { diff } from './save.js';
export const INFO22 = {
  mimic: { name: 'Mimic', tip: 'Some chests wobble and have teeth! When it opens its mouth (red !), jump away, then hit it.' },
  hunter: { name: 'Thorn Hunter', tip: 'The Hunter follows you. Watch for the red "!" and parry its slashes. Beat it for a big prize!' },
};
export const DEF22 = {
  mimic: { w: 30, h: 24, hp: 90, dmg: 16, light: false, glim: 20 },
  hunter: { w: 26, h: 40, hp: 150, dmg: 18, light: false, glim: 40 },
};
const bite = (W, e) => W.enemyAttack({ x: e.cx - 30, y: e.y - 6, w: 60, h: e.h + 8 }, e.cdmg, e, { parryable: true, name: e.info.name, tip: e.info.tip });
export const U22 = {
  mimic(W, dt, P, dx, dy, adx, seen) {
    if (this.st === 'sleep') { this.vx = 0; this.physics(W, dt); return; }
    if (this.st === 'wake') { this.tele = Math.min(1, this.t / 0.8); if (this.t > 0.8) { this.st = 'idle'; this.t = 0; this.tele = 0; this.cd = 0.3; } this.physics(W, dt); return; }
    if (this.st === 'idle') { this.face = sign(dx) || this.face; this.vx = adx > 60 ? this.face * 50 : 0; if (this.wallAhead(W, this.face) || this.ledgeAhead(W, this.face)) this.vx = 0;
      if (seen && this.cd <= 0 && adx < 300) { this.st = 'mtele'; this.t = 0; this.vx = 0; sfx('telegraph'); } }
    else if (this.st === 'mtele') { this.tele = this.t / 0.55; if (this.t > 0.55) { this.tele = 0; this.st = 'leap'; this.t = 0; this.vx = clamp(dx * 1.7, -330, 330); this.vy = -440; sfx('jump'); } }
    else if (this.st === 'leap') { if (this.onGround && this.t > 0.15) { this.st = 'rec'; this.t = 0; this.vx = 0; bite(W, this); W.fx.shake(0.2); sfx('thump'); W.fx.burst(this.cx, this.y + this.h, 8, { color: ['#c9a36a', '#fff'], max: 160 }); } }
    else if (this.st === 'rec') { this.vx *= 0.8; if (this.t > 0.75) { this.st = 'idle'; this.t = 0; this.cd = 1.0 / (1 + 0.2 * (diff().smart || 0)); } }
    this.physics(W, dt);
  },
  hunter(W, dt, P, dx, dy, adx, seen) {
    const far = adx > 560 || Math.abs(dy) > 240; this.farT = far ? (this.farT || 0) + dt : 0;
    if (this.st === 'blinkOut') { this.vx = 0; this.alpha = Math.max(0, 1 - this.t / 0.5); if (this.t > 0.5) { const s = blinkSpot(W, P); this.x = s.x - this.w / 2; this.y = s.y - this.h; this.vx = this.vy = 0; this.st = 'blinkIn'; this.t = 0; W.addMarker({ kind: 'circle', x: s.x, y: s.y - 4, r: 30, life: 0.9 }); } this.physics(W, dt); return; }
    if (this.st === 'blinkIn') { this.alpha = Math.min(1, this.t / 0.9); this.tele = this.t / 0.9; if (this.t > 0.9) { this.st = 'idle'; this.t = 0; this.tele = 0; this.cd = 0.6; this.alpha = 1; W.fx.burst(this.cx, this.cy, 14, { color: ['#ff5a7a', '#2a1030'], max: 200 }); } this.physics(W, dt); return; }
    if (this.farT > 2.4 && (this.st === 'idle' || this.st === 'walk')) { this.st = 'blinkOut'; this.t = 0; this.farT = 0; sfx('telegraph'); return; }
    if (this.st === 'idle') { this.face = sign(dx) || this.face; this.vx = adx > 54 ? this.face * 150 : 0;
      if (this.onGround && this.wallAhead(W, this.face)) this.vy = -560; else if (this.onGround && this.ledgeAhead(W, this.face) && dy < 30) this.vx = 0;
      if (this.cd <= 0 && adx < 80 && Math.abs(dy) < 50) { this.st = 'htele'; this.t = 0; this.vx = 0; this.combo = 0; sfx('telegraph'); }
      else if (this.cd <= 0 && adx > 180 && adx < 420 && Math.abs(dy) < 80) { this.st = 'dtele'; this.t = 0; this.vx = 0; sfx('telegraph'); } }
    else if (this.st === 'htele') { const T = this.combo ? 0.3 : 0.5; this.tele = this.t / T; if (this.t > T) { this.tele = 0; this.st = 'slash'; this.t = 0; this.vx = this.face * 260; sfx('dash'); } }
    else if (this.st === 'slash') { W.enemyAttack({ x: this.face > 0 ? this.cx : this.cx - 62, y: this.y, w: 62, h: this.h }, this.cdmg, this, { parryable: true, name: this.info.name, tip: this.info.tip }); this.vx *= 0.85;
      if (this.t > 0.2) { this.combo++; if (this.combo < 2 + ((diff().smart || 0) >= 2 ? 1 : 0)) { this.st = 'htele'; this.t = 0; this.face = sign(P.cx - this.cx) || this.face; } else { this.st = 'rec'; this.t = 0; } } }
    else if (this.st === 'dtele') { this.tele = this.t / 0.6; if (this.t > 0.6) { this.tele = 0; const d = sign(dx) || 1; for (const a of [-0.18, 0, 0.18]) W.spawnEnemyShot(this.cx, this.cy - 6, d * 260 * Math.cos(a), 260 * Math.sin(a), { dmg: 12, r: 6, name: 'Thorn Dart', tip: 'Thorn darts fly straight. Jump over, or parry them back!', life: 2.2 }); sfx('enemyShoot'); this.st = 'rec'; this.t = 0; } }
    else if (this.st === 'rec') { this.vx *= 0.85; if (this.t > 0.65) { this.st = 'idle'; this.t = 0; this.cd = 1.1 / (1 + 0.15 * (diff().smart || 0)); } }
    else this.st = 'idle';
    this.physics(W, dt);
  },
};
function blinkSpot(W, P) { // a floor spot behind the player, or the player's room entrance
  for (const off of [-170, 170, -110, 110]) { const x = P.cx + off * (P.face || 1), y = W.groundY ? W.groundY(x, P.y) : null; if (y && Math.abs(y - (P.y + P.h)) < 60) return { x, y }; }
  const c = W.cellAt(P.cx, P.cy), f = c && W.findFloorIn(c); return f ? { x: f.x, y: f.y } : { x: P.cx - 150, y: P.y + P.h };
}
export function draw22(g, e) {
  const X = e.cx, Y = e.y + e.h, t = e.anim, tele = e.tele || 0;
  if (e.type === 'mimic') {
    const sleep = e.st === 'sleep', open = sleep ? 0 : e.st === 'mtele' ? 0.4 + tele * 0.6 : e.st === 'leap' ? 1 : 0.25, wob = sleep ? Math.sin(t * 9) * (Math.sin(t * 1.3) > 0.7 ? 1.4 : 0) : 0;
    if (G.img.s_mimic) { g.save(); g.translate(X + wob, Y); g.rotate(wob * 0.02); sImg(g, sleep ? 's_mimicC' in G.img ? 's_mimicC' : 's_mimic' : 's_mimic', 0, 0, sleep ? 30 : 34 + open * 6, e.face < 0); g.restore();
      if (!sleep && open > 0.5) drawGlow(g, X, Y - 16, 22, '#ff3a4a', 0.35 * open); }
    else { g.save(); g.translate(X + wob, Y); g.fillStyle = '#15131f'; g.fillRect(-16, -24, 32, 25); g.fillStyle = '#9a6a42'; g.fillRect(-14, -12, 28, 11); g.save(); g.translate(-14, -12); g.rotate(-open * 0.7); g.fillStyle = '#b07a48'; g.fillRect(0, -10, 28, 10); g.fillStyle = '#fff'; for (let i = 0; i < 5; i++) { g.beginPath(); g.moveTo(3 + i * 5, 0); g.lineTo(5 + i * 5, 4); g.lineTo(7 + i * 5, 0); g.fill(); } g.restore();
      g.fillStyle = '#ffe27a'; g.fillRect(-3, -14, 6, 5); if (!sleep) { g.fillStyle = '#ff3a4a'; g.fillRect(-8, -10, 4, 3); g.fillRect(4, -10, 4, 3); } g.restore(); }
    if (sleep && Math.sin(t * 1.3) > 0.7) { g.fillStyle = '#fff'; g.beginPath(); g.moveTo(X - 6, Y - 12); g.lineTo(X - 4, Y - 8); g.lineTo(X - 2, Y - 12); g.fill(); } // the tell: a tooth peeks out
    return;
  }
  if (e.type === 'hunter') {
    g.save(); g.globalAlpha = e.alpha ?? 1; drawGlow(g, X, e.cy, 44, '#ff3a6a', 0.22 + tele * 0.3);
    if (G.img.s_hunter) { g.translate(X, Y + 2); sImg(g, 's_hunter', 0, 0, 58, e.face < 0); }
    else { g.translate(X, Y); g.scale(e.face, 1); g.fillStyle = '#1c1426'; g.beginPath(); g.moveTo(-12, 0); g.lineTo(-10, -30); g.quadraticCurveTo(0, -46, 10, -30); g.lineTo(12, 0); g.fill(); g.fillStyle = '#ff4a6a'; g.fillRect(2, -34, 6, 3); g.strokeStyle = '#8a3c5a'; g.lineWidth = 3; g.beginPath(); g.moveTo(8, -20); g.lineTo(22, -30); g.stroke(); }
    g.restore();
  }
}
