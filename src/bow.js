// v2.4 Thornbow: one button. Tap = quick shot, hold = draw (charge) for a piercing power shot. No ammo — limited by a short cooldown.
// Aim: 8-way from the stick + soft auto-aim (22° cone, line of sight, gravity-compensated). Charged shots aim for the head (BULLSEYE crit).
import { sfx } from './audio.js';
export const BOW = { TAP: 0.12, DRAW: 0.55, MINK: 0.3, CONE: 0.4, RANGE: 430,
  quick: { dmg: 8, speed: 780, g: 430, cd: 0.2, kb: 110 }, // 8 dmg per ~0.25 s
  power: { dmg0: 11, dmg1: 22, speed0: 820, speed1: 1180, g0: 300, g1: 150, cd: 0.28, kb: 300 } };
export function shotParams(k) {
  if (k < BOW.MINK) return { ...BOW.quick, ch: false, full: false, k: 0 };
  const p = BOW.power, e = (k - BOW.MINK) / (1 - BOW.MINK), full = k >= 1;
  return { dmg: Math.round(p.dmg0 + (p.dmg1 - p.dmg0) * e), speed: p.speed0 + (p.speed1 - p.speed0) * e, g: p.g0 + (p.g1 - p.g0) * e, cd: p.cd, kb: full ? p.kb : 180, ch: true, full, k };
}
export function origin(P) { return [P.cx + P.face * 6, P.cy - 7]; }
function los(W, x0, y0, x1, y1) { const d = Math.hypot(x1 - x0, y1 - y0), n = Math.ceil(d / 12); for (let i = 1; i < n; i++) { const t = i / n; if (W.map.solidPx(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t)) return false; } return true; }
// base aim (world angle) from the stick; returns { ang, tgt, aimY }
export function aim(W, P, mx, my, sp) {
  const sx = Math.abs(mx) > 0.3, f = P.face; let base = 0;
  if (my < -0.5) base = sx ? -Math.PI / 4 : -Math.PI / 2 + 0.0001;
  else if (my > 0.5 && !P.onGround) base = sx ? Math.PI / 4 : Math.PI / 2 - 0.0001;
  const A = f > 0 ? base : Math.PI - base; const [ox, oy] = origin(P);
  let best = null, bs = 1e9;
  for (const e of W.enemies) {
    if (e.dead || e.hidden || e.friendly) continue;
    const hx = e.cx !== undefined ? e.cx : e.x + e.w / 2, hy = e.y + e.h * (sp.ch ? 0.2 : 0.5), dx = hx - ox, dy = hy - oy, d = Math.hypot(dx, dy);
    if (d > BOW.RANGE || d < 6) continue;
    let da = Math.atan2(dy, dx) - A; while (da > Math.PI) da -= Math.PI * 2; while (da < -Math.PI) da += Math.PI * 2;
    if (Math.abs(da) > BOW.CONE) continue; const sc = Math.abs(da) + d / 1600; if (sc < bs && los(W, ox, oy, hx, hy)) { bs = sc; best = { e, hx, hy, d }; }
  }
  if (!best) return { ang: A, tgt: null };
  const t = best.d / sp.speed, lift = 0.5 * sp.g * t * t; // aim above to cancel the drop
  return { ang: Math.atan2(best.hy - lift - oy, best.hx - ox), tgt: best.e, hx: best.hx, hy: best.hy };
}
export function update(W, P, dt, mx, my, pressedA, heldA) {
  if (P.bowCd > 0) P.bowCd -= dt; if (P.bowRel > 0) P.bowRel -= dt;
  if (pressedA && !P.bowS) { P.bowS = { t: 0, k: 0, full: false, rel: false }; sfx('bowNock'); W.emit && W.emit('attack'); if (Math.abs(mx) <= 0.2 && P.autoFace) P.autoFace(W); }
  const s = P.bowS; if (!s) return null;
  if (P.dashT > 0 || P.hurtT > 0 || (P.hook.s !== 'none' && P.hook.s !== 'swing')) { P.bowS = null; return null; } // clean cancels
  s.t += dt; if (Math.abs(mx) > 0.3) P.face = Math.sign(mx);
  if (heldA && !s.rel) {
    if (s.t > BOW.TAP) { const k0 = s.k; s.k = Math.min(1, (s.t - BOW.TAP) / BOW.DRAW); if (k0 === 0 && s.k > 0) sfx('bowDraw');
      if (s.k >= 1 && !s.full) { s.full = true; sfx('bowFull'); W.fx.burst(P.cx, P.cy - 6, 10, { color: ['#fff3b0', '#a6e47a'], kind: 'spark', min: 40, max: 140, life: 0.35, glow: 1, size: 3 }); } }
  } else s.rel = true;
  const sp = shotParams(s.k); const a = aim(W, P, mx, my, sp); s.ang = a.ang; s.tgt = a.tgt; s.hx = a.hx; s.hy = a.hy; s.sp = sp;
  if (!P.onGround && s.k > 0 && P.vy > 150 && P.hook.s === 'none') P.vy = 150; // aim hang while drawing in the air
  if (s.rel && !(P.bowCd > 0)) return fire(W, P, s);
  return null;
}
export function fire(W, P, s) {
  const sp = s.sp || shotParams(s.k), [ox, oy] = origin(P), c = Math.cos(s.ang), si = Math.sin(s.ang);
  W.shots.push({ x: ox + c * 12, y: oy + si * 12, vx: c * sp.speed + P.vx * 0.12, vy: si * sp.speed, r: sp.full ? 6 : 4, dmg: sp.dmg, g: sp.g, owner: 'player', life: 1.1,
    pierce: sp.full, big: sp.full, breaks: sp.full, kb: sp.kb, hs: sp.full ? 0.07 : sp.ch ? 0.045 : 0.03, arrow: true, ch: sp.ch, full: sp.full, hit: new Set(), tr: [], t: 0 });
  sfx(sp.full ? 'bowPower' : 'bowRelease'); P.bowCd = sp.cd; P.bowRel = 0.16; P.bowK = s.k; P.bowAng = s.ang; P.bowS = null; if (P.stats) P.stats.attacks = (P.stats.attacks || 0) + 1;
  if (sp.full) { P.vx -= c * 110; W.fx.shake(0.1); if (W.zoomKick) W.zoomKick(0.22); }
  W.fx.burst(ox + c * 16, oy + si * 16, sp.ch ? 7 : 3, { color: ['#e8ffd0', '#a6e47a'], kind: 'leaf', min: 30, max: 120, life: 0.3, size: 3 });
  return sp;
}
// world-space bow: limbs bend with draw, string pulls back, nocked arrow; dotted predicted arc + target bracket
export function draw(g, P, W, hand) {
  const s = P.bowS, rel = P.bowRel > 0 && !s; if (!s && !rel) return;
  const ang = s ? (s.ang !== undefined ? s.ang : (P.face > 0 ? 0 : Math.PI)) : P.bowAng, k = s ? s.k : 0, ux = Math.cos(ang), uy = Math.sin(ang), nx = -uy, ny = ux;
  const [ox, oy] = origin(P), Gx = hand ? hand[0] * 0.5 + (ox + ux * 6) * 0.5 : ox + ux * 6, Gy = hand ? hand[1] * 0.5 + (oy + uy * 6) * 0.5 : oy + uy * 6;
  if (s && s.sp && (s.t > 0.06)) { // predicted arc
    let x = ox + ux * 12, y = oy + uy * 12, vx = ux * s.sp.speed, vy = uy * s.sp.speed; const n = 26 + Math.round(k * 14);
    g.save(); for (let i = 0; i < n; i++) { vy += s.sp.g / 60; x += vx / 60; y += vy / 60; if (W.map.solidPx(x, y)) break; if (i % 3 === 0) { g.globalAlpha = (0.55 - i / n * 0.5) * Math.min(1, s.t * 6); g.fillStyle = s.full ? '#ffe27a' : '#e8ffd0'; g.beginPath(); g.arc(x, y, s.full ? 2.8 : 2.1, 0, 7); g.fill(); } }
    g.restore();
    if (s.tgt && s.hx !== undefined) { const r = 9 - Math.sin(W.t * 14) * 1.5, X = s.hx, Y = s.hy; g.save(); g.strokeStyle = s.full ? '#ffe27a' : '#ffffff'; g.lineWidth = 1.6; g.globalAlpha = 0.85;
      for (const [a, b] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) { g.beginPath(); g.moveTo(X + a * r, Y + b * r - b * 4); g.lineTo(X + a * r, Y + b * r); g.lineTo(X + a * r - a * 4, Y + b * r); g.stroke(); } g.restore(); }
  }
  const bend = 2 + 5 * k, L = 14, vib = rel ? Math.sin(P.bowRel * 90) * P.bowRel * 14 : 0;
  const T1 = [Gx + nx * L - ux * bend, Gy + ny * L - uy * bend], T2 = [Gx - nx * L - ux * bend, Gy - ny * L - uy * bend];
  const pull = s ? 3 + 13 * k : 3 - vib * 0.2, Px = Gx - ux * pull, Py = Gy - uy * pull;
  g.save(); g.lineCap = 'round';
  g.strokeStyle = 'rgba(240,240,220,0.9)'; g.lineWidth = 1; g.beginPath(); g.moveTo(T1[0], T1[1]); g.quadraticCurveTo(Px + nx * vib * 0.3, Py + ny * vib * 0.3, Px, Py); g.lineTo(T2[0], T2[1]); g.stroke();
  for (const [lw, col] of [[4.6, '#1d140c'], [2.6, '#8a5a2a']]) { g.strokeStyle = col; g.lineWidth = lw; g.beginPath(); g.moveTo(T1[0], T1[1]); g.quadraticCurveTo(Gx + nx * 9 + ux * 4, Gy + ny * 9 + uy * 4, Gx, Gy); g.quadraticCurveTo(Gx - nx * 9 + ux * 4, Gy - ny * 9 + uy * 4, T2[0], T2[1]); g.stroke(); }
  g.fillStyle = '#7fd05a'; g.beginPath(); g.arc(T1[0], T1[1], 2, 0, 7); g.arc(T2[0], T2[1], 2, 0, 7); g.fill(); g.fillStyle = '#4c8a32'; g.fillRect(Gx - 2, Gy - 2, 4, 4);
  if (s) { // nocked arrow
    const hx = Px + ux * 26, hy = Py + uy * 26; g.strokeStyle = '#1d140c'; g.lineWidth = 3; g.beginPath(); g.moveTo(Px, Py); g.lineTo(hx, hy); g.stroke(); g.strokeStyle = '#d9c49a'; g.lineWidth = 1.4; g.beginPath(); g.moveTo(Px, Py); g.lineTo(hx, hy); g.stroke();
    g.fillStyle = s.full ? '#ffe27a' : '#cfe8ff'; g.beginPath(); g.moveTo(hx + ux * 6, hy + uy * 6); g.lineTo(hx + nx * 3, hy + ny * 3); g.lineTo(hx - nx * 3, hy - ny * 3); g.fill();
    if (s.full) { g.globalCompositeOperation = 'lighter'; g.globalAlpha = 0.35 + 0.25 * Math.sin(W.t * 20); g.fillStyle = '#ffe27a'; g.beginPath(); g.arc(hx + ux * 3, hy + uy * 3, 7, 0, 7); g.fill(); }
  }
  g.restore();
}
