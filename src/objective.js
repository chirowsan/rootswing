// v1.5 objective: every area hides 3 Root Seeds. Collect all 3 -> the vine gate in front of the boss door unlocks.
// Beat the area's guardian to restore the Great Root. Everything here is icon-driven (no reading needed).
import { TILE } from './util.js';
import { drawGlow, drawIcon } from './art.js';
import { sfx } from './audio.js';
import { save, writeSave } from './save.js';
export const SEED_COL = '#a6f05a', SEED_GOLD = '#ffe27a', NEED = 3;
export const VINES = [ // persistent cosmetic rewards: hook-vine colours (unlocked by total stars)
  { id: 'green', stars: 0, dark: '#3f7a32', light: '#9be070' },
  { id: 'gold', stars: 1, dark: '#a07a20', light: '#ffe27a' },
  { id: 'bloom', stars: 3, dark: '#a03a6a', light: '#ffa6d8' },
  { id: 'glow', stars: 6, dark: '#2a7a8a', light: '#8ff6ff' },
];
export const vineColors = () => VINES.find((v) => v.id === (save.progress.vine || 'green')) || VINES[0];
export function initSeeds(W, got) { W.seeds = []; W.seedsGot = new Set(got || []); W.gateOpenT = 0; W.seedBanner = 0; }
export function spawnSeed(W, s) {
  const id = 'Q' + s.x + '_' + s.y, x = s.x * TILE + 12, y = s.y * TILE + 12;
  W.seeds.push({ id, x, y, cell: s.cell ? s.cell.index : -1, got: W.seedsGot.has(id), bob: (s.x * 7) % 6 });
}
export const seedCount = (W) => W.seedsGot.size;
export const gateOpen = (W) => W.mode !== 'run' || seedCount(W) >= NEED || !W.seeds.length;
export function updateSeeds(W, dt) {
  if (!W.seeds.length) return; const P = W.player;
  if (W.gateOpenT > 0 && W.gateOpenT < 3) W.gateOpenT += dt; if (W.seedBanner > 0) W.seedBanner -= dt;
  for (const s of W.seeds) {
    if (s.got) continue;
    if (Math.abs(P.cx - s.x) < 26 && Math.abs(P.cy - s.y) < 34 && !P.dead) {
      s.got = true; W.seedsGot.add(s.id); const n = seedCount(W); W.seedBanner = 2.2;
      sfx('secret'); W.fx.ring(s.x, s.y, 70, SEED_COL, 0.6, 6); W.fx.burst(s.x, s.y, 30, { color: [SEED_COL, SEED_GOLD, '#ffffff'], max: 260, kind: 'star', g: 80, life: 0.9, size: 6 });
      W.hitstop(0.06); W.emit('seed', n);
      if (n >= NEED) { W.gateOpenT = 0.01; sfx('unlock'); W.fx.flash = 0.5; W.fx.flashColor = '#eaffc8'; W.fx.shake(0.25); W.emit('gateOpen'); }
    }
  }
}
// gate in front of the boss door: three sockets + vine bars; returns true if the player bumped a locked gate
export function bumpGate(W, o) {
  if (gateOpen(W)) return false;
  sfx('block'); o.shakeT = 0.4; W.fx.shake(0.12); W.emit('gateLocked', seedCount(W)); return true;
}
function seedShape(g, x, y, r, col, empty) {
  g.save(); g.translate(x, y);
  g.fillStyle = empty ? 'rgba(20,18,32,0.75)' : col; g.strokeStyle = '#15131f'; g.lineWidth = Math.max(1.5, r * 0.22);
  g.beginPath(); g.moveTo(0, -r); g.bezierCurveTo(r * 0.95, -r * 0.3, r * 0.8, r, 0, r); g.bezierCurveTo(-r * 0.8, r, -r * 0.95, -r * 0.3, 0, -r); g.fill(); g.stroke();
  if (empty) { g.strokeStyle = 'rgba(166,240,90,0.55)'; g.lineWidth = Math.max(1, r * 0.14); g.setLineDash([r * 0.3, r * 0.25]); g.beginPath(); g.arc(0, r * 0.1, r * 0.55, 0, 7); g.stroke(); g.setLineDash([]); }
  else { g.fillStyle = 'rgba(255,255,255,0.55)'; g.beginPath(); g.ellipse(-r * 0.3, -r * 0.15, r * 0.18, r * 0.35, 0.3, 0, 7); g.fill();
    g.fillStyle = '#4fb83a'; g.strokeStyle = '#15131f'; g.lineWidth = Math.max(1, r * 0.15); g.beginPath(); g.moveTo(0, -r); g.quadraticCurveTo(r * 0.7, -r * 1.7, r * 1.1, -r * 1.3); g.quadraticCurveTo(r * 0.5, -r * 0.9, 0, -r); g.fill(); g.stroke(); }
  g.restore();
}
export function drawSeedIcon(g, x, y, size, filled) { seedShape(g, x, y, size / 2, SEED_COL, !filled); }
export function drawSeeds(g, W) {
  const t = W.t;
  for (const s of W.seeds) {
    if (s.got) continue; const y = s.y + Math.sin(t * 2.4 + s.bob) * 4;
    // light beam so it reads from far away, plus a soft frame ring
    g.save(); g.globalCompositeOperation = 'lighter'; const gr = g.createLinearGradient(0, y - 160, 0, y); gr.addColorStop(0, 'rgba(166,240,90,0)'); gr.addColorStop(1, 'rgba(166,240,90,0.22)'); g.fillStyle = gr; g.fillRect(s.x - 9, y - 160, 18, 160);
    drawGlow(g, s.x, y, 46, SEED_COL, 0.55 + Math.sin(t * 4) * 0.12); g.restore();
    g.strokeStyle = 'rgba(232,255,200,' + (0.35 + Math.sin(t * 3 + s.bob) * 0.2) + ')'; g.lineWidth = 2; g.beginPath(); g.arc(s.x, y, 17 + Math.sin(t * 3) * 1.5, 0, 7); g.stroke();
    seedShape(g, s.x, y, 9, SEED_COL, false);
  }
}
export function drawGate(g, W, o) {
  const t = W.t, n = seedCount(W), open = gateOpen(W), X = o.x + o.w / 2, Y = o.y + o.h, k = open ? Math.min(1, W.gateOpenT > 0 ? W.gateOpenT / 1.2 : 1) : 0;
  if (o.shakeT > 0) o.shakeT -= 1 / 60; const sh = o.shakeT > 0 ? Math.sin(t * 70) * 2.5 : 0;
  if (!W.seeds.length) return;
  // vine bars that pull up into the arch as the gate opens
  const barH = (o.h - 6) * (1 - k);
  if (barH > 1) { for (let i = 0; i < 4; i++) { const bx = o.x + 6 + i * ((o.w - 12) / 3) + sh; g.strokeStyle = '#15131f'; g.lineWidth = 6; g.beginPath(); g.moveTo(bx, o.y + 6); g.lineTo(bx, o.y + 6 + barH); g.stroke(); g.strokeStyle = '#3f7a32'; g.lineWidth = 3.5; g.stroke();
      for (let j = 12; j < barH; j += 14) { g.fillStyle = '#ff3d6e'; g.beginPath(); g.moveTo(bx - 1, o.y + 6 + j); g.lineTo(bx - 5, o.y + 9 + j); g.lineTo(bx - 1, o.y + 11 + j); g.fill(); } } }
  // three sockets above the arch
  for (let i = 0; i < NEED; i++) { const sx = X + (i - 1) * 18 + sh, sy = o.y - 18 + (i === 1 ? -6 : 0); const full = i < n;
    if (full) drawGlow(g, sx, sy, 22, SEED_COL, 0.6 + (open ? Math.sin(t * 5 + i) * 0.2 : 0));
    g.fillStyle = 'rgba(20,18,32,0.85)'; g.beginPath(); g.arc(sx, sy, 10, 0, 7); g.fill(); g.strokeStyle = full ? SEED_COL : '#7a6a8a'; g.lineWidth = 2; g.stroke(); seedShape(g, sx, sy + 1, 6, SEED_COL, !full); }
  if (open) { g.save(); g.globalCompositeOperation = 'lighter'; drawGlow(g, X, Y - 30, 54, SEED_COL, 0.35 + Math.sin(t * 3) * 0.1); g.restore();
    if (k < 1) W.fx.burst(X + (Math.random() - 0.5) * o.w, o.y + 6 + barH, 1, { color: [SEED_COL, '#3f7a32'], max: 90, g: 300, size: 4 }); }
}
// HUD tracker (top centre): 3 seed slots + a gate icon that turns green when it is open
export function drawTracker(g, W, w, h, s) {
  if (W.mode !== 'run' || !W.seeds.length) return;
  const n = seedCount(W), open = n >= NEED, cx = w / 2, y = 22 * s, pop = W.seedBanner > 0 ? 1 + Math.max(0, W.seedBanner - 1.8) * 1.2 : 1;
  g.save(); g.translate(cx, y); g.scale(pop, pop);
  g.fillStyle = 'rgba(14,12,24,0.66)'; g.beginPath(); g.roundRect(-58 * s, -14 * s, 116 * s, 28 * s, 14 * s); g.fill(); g.strokeStyle = open ? SEED_COL : '#c99a4a'; g.lineWidth = 1.6 * s; g.stroke();
  for (let i = 0; i < NEED; i++) { const x = (-38 + i * 22) * s; if (i < n) drawGlow(g, x, 0, 14 * s, SEED_COL, 0.55); drawSeedIcon(g, x, 1 * s, 16 * s, i < n); }
  const gx = 38 * s; g.fillStyle = open ? SEED_COL : 'rgba(255,255,255,0.18)'; g.beginPath(); g.arc(gx, 0, 10 * s, 0, 7); g.fill();
  drawIcon(g, 'door', gx, 0, 13 * s, open ? '#15131f' : '#cfc6e6');
  if (!open) { g.strokeStyle = '#ff3d6e'; g.lineWidth = 2 * s; g.beginPath(); g.moveTo(gx - 6 * s, -6 * s); g.lineTo(gx + 6 * s, 6 * s); g.stroke(); }
  g.restore();
  // celebration banner when the gate opens: big seeds -> gate icon, then an edge arrow pointing to the gate for the rest of the run
  if (open && W.gateOpenT > 0 && W.gateOpenT < 2.6) { const a = Math.min(1, W.gateOpenT * 3, (2.6 - W.gateOpenT) * 2), sc = s * (1 + Math.sin(Math.min(1, W.gateOpenT * 2) * Math.PI) * 0.2);
    g.save(); g.globalAlpha = a; g.translate(w / 2, h * 0.36); g.scale(sc, sc); drawGlow(g, 0, 0, 120, SEED_COL, 0.5);
    for (let i = 0; i < 3; i++) drawSeedIcon(g, -70 + i * 30, 0, 26, true); drawIcon(g, 'right', 30, 0, 26, '#fff'); g.fillStyle = SEED_COL; g.beginPath(); g.arc(78, 0, 24, 0, 7); g.fill(); drawIcon(g, 'door', 78, 0, 30, '#15131f'); g.restore(); }
  if (open) { const d = W.props.find((o) => o.kind === 'door'); if (d) edgeArrow(g, W, d.x + d.w / 2, d.y + d.h / 2, w, h, s, SEED_COL, 'door'); }
}
function edgeArrow(g, W, wx, wy, w, h, s, col, icon) {
  const z = w / (W.viewW || w), sx = (wx - W.cam.x) * z, sy = (wy - W.cam.y) * z; if (sx > 0 && sx < w && sy > 0 && sy < h) return;
  const m = 46 * s, ax = Math.max(m, Math.min(w - m, sx)), ay = Math.max(m + 30 * s, Math.min(h - m, sy)), ang = Math.atan2(sy - ay, sx - ax), b = 1 + Math.sin(W.t * 5) * 0.08;
  g.save(); g.translate(ax, ay); g.scale(b, b); g.fillStyle = 'rgba(14,12,24,0.7)'; g.beginPath(); g.arc(0, 0, 17 * s, 0, 7); g.fill(); g.strokeStyle = col; g.lineWidth = 2 * s; g.stroke(); drawIcon(g, icon, 0, 0, 16 * s, col);
  g.rotate(ang); g.fillStyle = col; g.beginPath(); g.moveTo(26 * s, 0); g.lineTo(18 * s, -7 * s); g.lineTo(18 * s, 7 * s); g.fill(); g.restore();
}
// rank + rewards at the end of a full run. stars: restored (always) + under par time + found treasures
export const PAR_SECONDS = 22 * 60;
export function scoreRun(t, treasures) {
  const stars = 1 + (t <= PAR_SECONDS ? 1 : 0) + (treasures >= 4 ? 1 : 0);
  const P = save.progress, prevBest = P.bestTime || 0, best = !prevBest || t < prevBest;
  if (best) P.bestTime = Math.round(t); P.bestStars = Math.max(P.bestStars || 0, stars); P.totalStars = (P.totalStars || 0) + stars; P.rootRestored = true;
  const before = P.totalStars - stars, fresh = VINES.filter((v) => v.stars > before && v.stars <= P.totalStars), top = fresh[fresh.length - 1];
  if (top) P.vine = top.id; writeSave();
  return { stars, best, bestTime: P.bestTime, newVine: top || null, totalStars: P.totalStars };
}
