// Minimal HUD: health, flasks, glimmers, weapon, minimap (runs), boss bar, countdown.
import { has, spr, tinted } from './gfx.js';
import { drawIcon, drawGlow, PAL } from './art.js';
import { input } from './input.js';
import { save } from './save.js';
import { WEAPONS, GADGETS } from './weapons.js';
import { CW, CH } from './level.js';
function badge(g, x, y, r, s) { g.fillStyle = 'rgba(12,10,20,0.72)'; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); g.strokeStyle = '#c99a4a'; g.lineWidth = 1.6 * s; g.stroke(); g.strokeStyle = 'rgba(255,230,170,0.25)'; g.lineWidth = 1 * s; g.beginPath(); g.arc(x, y, r - 2.5 * s, 3.6, 5.6); g.stroke(); }
function drawPaintedTop(g, W, P, x, y, s, t) {
  const n = Math.max(1, Math.round(P.maxHp / 20)), per = P.maxHp / n, hp = Math.max(0, P.hp), L = 22 * s, gap = 17 * s, x0 = x + 26 * s, cy = y + 16 * s;
  W._hpShow = W._hpShow === undefined ? hp : W._hpShow + (hp - W._hpShow) * 0.08;
  // backing plate + vine stem
  g.fillStyle = 'rgba(10,8,18,0.5)'; g.beginPath(); g.roundRect(x - 4 * s, y - 2 * s, 34 * s + n * gap, 34 * s, 14 * s); g.fill();
  g.strokeStyle = '#1a1208'; g.lineWidth = 4 * s; g.lineCap = 'round'; g.beginPath(); g.moveTo(x + 8 * s, cy + 6 * s); for (let i = 0; i <= n; i++) g.quadraticCurveTo(x0 + (i - 0.5) * gap, cy + (i % 2 ? 9 : 3) * s, x0 + i * gap, cy + 6 * s); g.stroke();
  g.strokeStyle = '#4e7a2a'; g.lineWidth = 2.2 * s; g.stroke();
  const low = hp / P.maxHp < 0.3, pulse = low ? 1 + Math.sin(t * 9) * 0.08 : 1;
  for (let i = 0; i < n; i++) { const lx = x0 + i * gap, fr = Math.max(0, Math.min(1, (hp - i * per) / per)), ghost = Math.max(0, Math.min(1, (W._hpShow - i * per) / per));
    g.save(); g.translate(lx, cy + 6 * s); g.rotate(-0.35 + (i % 2) * 0.2 + Math.sin(t * 1.8 + i) * 0.04); const sz = L * (fr > 0 ? pulse : 0.9);
    spr(g, 'leafdry', 0, 0, sz, 0.5, 0.95);
    if (ghost > fr) { g.globalAlpha = 0.5; g.save(); g.beginPath(); g.rect(-sz, -sz * (fr + (ghost - fr)), sz * 2, sz * (ghost)); g.clip(); spr(g, 'leaf', 0, 0, sz, 0.5, 0.95, false, tinted('leaf', '#ffffff')); g.restore(); g.globalAlpha = 1; }
    if (fr > 0) { g.save(); g.beginPath(); g.rect(-sz, -sz * fr * 0.95 - 0.5, sz * 2, sz * fr + 1); g.clip(); spr(g, 'leaf', 0, 0, sz, 0.5, 0.95); if (low) { g.globalCompositeOperation = 'source-atop'; g.globalAlpha = 0.25 + Math.sin(t * 9) * 0.15; spr(g, 'leaf', 0, 0, sz, 0.5, 0.95, false, tinted('leaf', '#ff3a4a')); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over'; } g.restore(); }
    g.restore(); }
  // dew drop "heart" at the root of the vine
  drawGlow(g, x + 9 * s, cy + 4 * s, 16 * s, low ? '#ff6a8a' : '#9ff6ff', 0.45); spr(g, 'dew', x + 9 * s, cy + 14 * s, 20 * s * pulse, 0.5, 1);
  g.font = `800 ${9 * s}px system-ui,sans-serif`; g.textAlign = 'left'; g.lineWidth = 3 * s; g.strokeStyle = 'rgba(10,8,18,0.85)'; const txt = Math.ceil(hp) + '/' + P.maxHp; g.strokeText(txt, x0 + n * gap - 4 * s, cy + 18 * s); g.fillStyle = low ? '#ffb0bc' : '#e8ffd8'; g.fillText(txt, x0 + n * gap - 4 * s, cy + 18 * s);
  // flasks, glimmers, weapon, gadgets
  const yy = y + 46 * s;
  for (let i = 0; i < P.maxFlasks; i++) { const full = i < P.flasks, fx = x + 10 * s + i * 18 * s; if (full) { drawGlow(g, fx, yy, 10 * s, '#ff8aa0', 0.35); spr(g, 'flask', fx, yy + 9 * s, 19 * s, 0.5, 1); } else { g.globalAlpha = 0.55; spr(g, 'flask', fx, yy + 9 * s, 19 * s, 0.5, 1, false, tinted('flask', '#2a2436')); g.globalAlpha = 1; } }
  const gx = x + 16 * s + P.maxFlasks * 18 * s; drawGlow(g, gx, yy, 12 * s, PAL.glimmer, 0.5); spr(g, 'glim', gx, yy + 8 * s, 16 * s, 0.5, 1);
  const gl = W.mode === 'hub' || W.mode === 'tutorial' ? save.progress.glimmers : W.runGlim; W._gl = W._gl === undefined ? gl : W._gl + Math.sign(gl - W._gl) * Math.max(1, Math.abs(gl - W._gl) * 0.15) * (Math.abs(gl - W._gl) < 1 ? 0 : 1);
  g.font = `900 ${13 * s}px system-ui,sans-serif`; g.textAlign = 'left'; g.lineWidth = 3 * s; g.strokeStyle = 'rgba(10,8,18,0.85)'; g.strokeText(String(Math.round(W._gl)), gx + 10 * s, yy + 5 * s); g.fillStyle = PAL.glimmer; g.fillText(String(Math.round(W._gl)), gx + 10 * s, yy + 5 * s);
  const wpn = WEAPONS[P.weapon]; const wx = gx + 54 * s; badge(g, wx, yy, 12 * s, s); g.save(); g.translate(wx, yy); g.rotate(-0.78); spr(g, 'w_' + P.weapon, 0, 0, P.weapon === 'bow' ? 18 * s : P.weapon === 'hammer' ? 13 * s : 7.5 * s, 0.5, 0.5); g.restore();
  if (!(input.touchActive || input.forceTouch)) P.gadgets.forEach((gd, i) => { const cx = wx + (28 + i * 26) * s; badge(g, cx, yy, 11 * s, s); if (gd === 'bomb' && has('bomb')) spr(g, 'bomb', cx, yy + 7 * s, 15 * s, 0.5, 1); else drawIcon(g, GADGETS[gd].icon, cx, yy, 14 * s, '#fff'); const cd = P.gcd[i] / GADGETS[gd].cd; if (cd > 0) { g.fillStyle = 'rgba(10,8,18,0.6)'; g.beginPath(); g.moveTo(cx, yy); g.arc(cx, yy, 11 * s, -Math.PI / 2, -Math.PI / 2 + cd * Math.PI * 2); g.fill(); } });
}
export function drawHUD(g, W, w, h, s) {
  const P = W.player; const t = W.t; g.save();
  const x = 14 * s, y = 12 * s;
  if (has('leaf')) drawPaintedTop(g, W, P, x, y, s, t);
  else {
  // health bar
  const bw = 150 * s, bh = 14 * s; const frac = Math.max(0, P.hp / P.maxHp);
  g.fillStyle = 'rgba(14,12,24,0.7)'; g.beginPath(); g.roundRect(x + 14 * s, y + 3 * s, bw + 6 * s, bh + 6 * s, 8 * s); g.fill();
  W._hpShow = W._hpShow === undefined ? frac : W._hpShow + (frac - W._hpShow) * 0.08;
  g.fillStyle = '#ffffff55'; g.beginPath(); g.roundRect(x + 17 * s, y + 6 * s, bw * Math.max(frac, W._hpShow), bh, 6 * s); g.fill();
  g.fillStyle = frac < 0.3 ? '#ff5a7a' : '#7fe08a'; g.beginPath(); g.roundRect(x + 17 * s, y + 6 * s, Math.max(bh, bw * frac), bh, 6 * s); if (frac > 0) g.fill();
  g.fillStyle = 'rgba(255,255,255,0.35)'; g.fillRect(x + 21 * s, y + 7.5 * s, Math.max(0, bw * frac - 8 * s), 3 * s);
  g.fillStyle = '#15131f'; for (let i = 1; i < P.maxHp / 20; i++) g.fillRect(x + 17 * s + bw * i * 20 / P.maxHp, y + 6 * s, 1.5 * s, bh);
  drawGlow(g, x + 12 * s, y + 13 * s, 18 * s, '#ff6a8a', 0.5); drawIcon(g, 'heart', x + 12 * s, y + 13 * s, 22 * s, '#ff6a8a');
  g.font = `800 ${10 * s}px system-ui,sans-serif`; g.textAlign = 'left'; g.fillStyle = '#fff'; g.fillText(Math.ceil(P.hp) + ' / ' + P.maxHp, x + 24 * s, y + 16.5 * s);
  // flasks + glimmers + weapon
  let yy = y + 34 * s;
  for (let i = 0; i < P.maxFlasks; i++) { const full = i < P.flasks; g.globalAlpha = full ? 1 : 0.35; drawIcon(g, 'flask', x + 18 * s + i * 20 * s, yy, 17 * s, full ? '#7ff0ff' : '#aab'); }
  g.globalAlpha = 1;
  const gx = x + 26 * s + P.maxFlasks * 20 * s; drawGlow(g, gx, yy, 12 * s, PAL.glimmer, 0.6); drawIcon(g, 'glimmer', gx, yy, 15 * s, PAL.glimmer);
  const gl = W.mode === 'hub' || W.mode === 'tutorial' ? save.progress.glimmers : W.runGlim; W._gl = W._gl === undefined ? gl : W._gl + Math.sign(gl - W._gl) * Math.max(1, Math.abs(gl - W._gl) * 0.15) * (Math.abs(gl - W._gl) < 1 ? 0 : 1);
  g.fillStyle = PAL.glimmer; g.font = `900 ${13 * s}px system-ui,sans-serif`; g.fillText(String(Math.round(W._gl)), gx + 10 * s, yy + 5 * s);
  const wpn = WEAPONS[P.weapon]; const wx = gx + 52 * s; g.fillStyle = 'rgba(14,12,24,0.6)'; g.beginPath(); g.arc(wx, yy, 11 * s, 0, 7); g.fill(); drawIcon(g, wpn.icon, wx, yy, 15 * s, wpn.color);
  if (!(input.touchActive || input.forceTouch)) { // desktop: gadget icons with cooldown
    P.gadgets.forEach((gd, i) => { const cx = wx + (26 + i * 24) * s; g.fillStyle = 'rgba(14,12,24,0.6)'; g.beginPath(); g.arc(cx, yy, 11 * s, 0, 7); g.fill(); drawIcon(g, GADGETS[gd].icon, cx, yy, 14 * s, '#fff'); const cd = P.gcd[i] / GADGETS[gd].cd; if (cd > 0) { g.fillStyle = 'rgba(0,0,0,0.6)'; g.beginPath(); g.moveTo(cx, yy); g.arc(cx, yy, 11 * s, -Math.PI / 2, -Math.PI / 2 + cd * Math.PI * 2); g.fill(); } });
  }
  }
  // minimap (runs)
  if (W.mode === 'run' && W.cells.length) {
    const cs = 9 * s, chh = 6 * s, mx = w - (W.gw * cs) - (input.touchActive || input.forceTouch ? 64 : 14) * s, my = 12 * s;
    g.fillStyle = 'rgba(14,12,24,0.55)'; g.beginPath(); g.roundRect(mx - 4 * s, my - 4 * s, W.gw * cs + 8 * s, W.gh * chh + 8 * s, 5 * s); g.fill();
    for (const c of W.cells) { const seen = W.visited.has(c.index); const adj = !seen && [...W.visited].some((i) => { const o = W.cells[i]; return Math.abs(o.x - c.x) + Math.abs(o.y - c.y) === 1 && !c.branch; }); if (!seen && !adj) continue;
      g.fillStyle = W.curCell === c ? '#ffe27a' : seen ? (c.kind === 'miniboss' ? '#ff9a5a' : c.kind === 'exit' ? '#ff6a8a' : c.kind === 'dead' ? '#7ff0ff' : '#c9c2e0') : 'rgba(200,190,230,0.25)'; g.fillRect(mx + c.x * cs + 1, my + c.y * chh + 1, cs - 2, chh - 2); }
  }
  // boss bar
  const B = W.game.bossShown; if (B && !B.dead) {
    const bw2 = Math.min(w * 0.5, 420 * s), bx = w / 2 - bw2 / 2, by = (W.mode === 'run' ? 46 : 14) * s, f = Math.max(0, B.hp / B.maxHp);
    g.fillStyle = 'rgba(14,12,24,0.75)'; g.beginPath(); g.roundRect(bx - 4 * s, by - 4 * s, bw2 + 8 * s, 18 * s, 7 * s); g.fill();
    g.fillStyle = '#ff9a5a'; g.beginPath(); g.roundRect(bx, by, bw2 * f, 10 * s, 5 * s); g.fill();
    if (B.type === 'boss') for (const p of [0.66, 0.33]) { g.fillStyle = '#15131f'; g.fillRect(bx + bw2 * p - 1, by, 2 * s, 10 * s); }
    g.font = `900 ${11 * s}px system-ui,sans-serif`; g.textAlign = 'center'; g.fillStyle = '#fff4dc'; g.fillText(B.info.name, w / 2, by + 24 * s);
  }
  // countdown
  if (W.countdown > 0 || W.goT > 0) {
    const n = Math.ceil(W.countdown / 0.5); const label = W.countdown > 0 ? (n > 3 ? '' : String(n)) : 'GO!'; const k = W.countdown > 0 ? 1 - ((W.countdown / 0.5) % 1) : 1 - W.goT / 0.6;
    if (label) { g.save(); g.translate(w / 2, h * 0.42); const sc = (1.4 - Math.min(k, 1) * 0.4) * s; g.scale(sc, sc); g.globalAlpha = W.countdown > 0 ? 1 : 1 - k; g.font = '900 64px system-ui,sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineWidth = 10; g.strokeStyle = '#15131f'; g.strokeText(label, 0, 0); g.fillStyle = label === 'GO!' ? '#7fe08a' : '#ffe27a'; g.fillText(label, 0, 0); g.restore(); g.textBaseline = 'alphabetic'; }
  }
  g.restore();
}
