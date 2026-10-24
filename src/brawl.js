// v2.0 "brawl" systems: combo counter + style rank (D..S), enemy reactions, guard/armor, elites,
// wall splats, trap KOs, ground quakes and the boss cinematic camera. Pure game logic + small draw helpers.
import * as CB from './combat.js';
import { sfx } from './audio.js';
import { drawGlow } from './art.js';
import { hash2, clamp } from './util.js';
import { palOf } from './weapons.js';

// ---------------- combo + style rank ----------------
export const RANKS = [
  { id: 'D', min: 0, col: '#c9cfe0' }, { id: 'C', min: 45, col: '#8ff6ff' }, { id: 'B', min: 120, col: '#9be070' },
  { id: 'A', min: 230, col: '#ffd36b' }, { id: 'S', min: 380, col: '#ff7ac8' }];
export const COMBO_T = 2.4; // seconds without a hit before the combo ends
export function sty(W) { return W.sty || (W.sty = { n: 0, t: 0, score: 0, rank: 0, best: 0, bestRank: 0, recent: [], pop: 0, burst: 0, drop: 0, labels: [], hits: 0 }); }
export function rankOf(score) { let r = 0; for (let i = 0; i < RANKS.length; i++) if (score >= RANKS[i].min) r = i; return r; }
function setRank(W, s) {
  s.score = Math.min(s.score, 560); const r = rankOf(s.score);
  if (r > s.rank) { s.rank = r; s.burst = 1; s.bestRank = Math.max(s.bestRank, r); sfx('rankUp');
    const P = W.player; if (P && !P.dead) { CB.petals(W, P.cx, P.cy - 6, 6 + r * 4, { max: 200 }); if (P.gauge !== undefined) CB.gain(P, 3 + r * 2, W); }
    W.emit('rank', r); }
  else if (r < s.rank) s.rank = r;
}
// one landed player hit. kind = move id (variety is rewarded: repeating the same move scores less)
export function addHit(W, kind, dmg, o = {}) {
  const s = sty(W); s.n++; s.hits++; s.t = COMBO_T; s.pop = 1; s.best = Math.max(s.best, s.n);
  const fresh = !s.recent.includes(kind); s.recent.push(kind); if (s.recent.length > 5) s.recent.shift();
  s.score += (5 + Math.min(14, dmg * 0.35)) * (fresh ? 1.4 : 0.7) + Math.min(s.n, 40) * 0.3 + (o.crit ? 6 : 0) + (o.fin ? 10 : 0);
  setRank(W, s); return s;
}
export function bonus(W, label, pts, col = '#ffe27a') {
  const s = sty(W); s.score += pts; s.t = Math.max(s.t, COMBO_T * 0.7);
  const same = s.labels.find((l) => l.s === label && l.t < 0.8); if (same) { same.t = 0; same.n = (same.n || 1) + 1; } else { s.labels.unshift({ s: label, t: 0, col, n: 1 }); if (s.labels.length > 3) s.labels.pop(); }
  setRank(W, s); W.emit('styleBonus', label);
}
export function hurt(W) { const s = sty(W); if (s.n > 0 || s.score > 0) s.drop = 1; s.n = 0; s.t = 0; s.score *= 0.35; s.rank = rankOf(s.score); }
export function update(W, dt) {
  const s = W.sty; if (!s) return;
  s.pop = Math.max(0, s.pop - dt * 5); s.burst = Math.max(0, s.burst - dt * 1.6); s.drop = Math.max(0, s.drop - dt * 2.5);
  if (s.t > 0) { s.t -= dt; s.score = Math.max(0, s.score - dt * (2 + s.rank * 2.5)); if (s.t <= 0) { s.n = 0; } }
  else s.score = Math.max(0, s.score - dt * 70);
  s.rank = Math.min(s.rank, rankOf(s.score));
  for (const l of s.labels) l.t += dt; s.labels = s.labels.filter((l) => l.t < 1.6);
}
// HUD: combo counter + rank badge, right side under the pause button
export function drawCombo(g, W, w, h, s) {
  const S = W.sty; if (!S || (S.n < 2 && S.score < RANKS[1].min && !S.labels.length && S.drop <= 0)) return;
  const R = RANKS[S.rank], x = w - 58 * s, y = 96 * s; g.save();
  const vis = S.n >= 2 || S.score >= RANKS[1].min || S.labels.length;
  if (vis) {
    // rank badge: a diamond that fills toward the next rank
    const nx = RANKS[S.rank + 1], kf = nx ? clamp((S.score - R.min) / (nx.min - R.min), 0, 1) : 1, bs = (1 + S.burst * 0.55) * s, r = 20 * bs;
    if (S.burst > 0) { g.globalCompositeOperation = 'lighter'; drawGlow(g, x, y, 70 * s * (1 + S.burst), R.col, 0.55 * S.burst); for (let i = 0; i < 10; i++) { const a = i / 10 * 6.283 + (1 - S.burst) * 1.5; g.strokeStyle = R.col; g.globalAlpha = S.burst * 0.8; g.lineWidth = 3 * s; g.beginPath(); g.moveTo(x + Math.cos(a) * r * 1.1, y + Math.sin(a) * r * 1.1); g.lineTo(x + Math.cos(a) * r * (1.6 + (1 - S.burst) * 1.4), y + Math.sin(a) * r * (1.6 + (1 - S.burst) * 1.4)); g.stroke(); } g.globalAlpha = 1; g.globalCompositeOperation = 'source-over'; }
    const dia = (rr) => { g.beginPath(); g.moveTo(x, y - rr); g.lineTo(x + rr, y); g.lineTo(x, y + rr); g.lineTo(x - rr, y); g.closePath(); };
    g.fillStyle = 'rgba(14,10,24,0.82)'; dia(r + 3 * s); g.fill();
    g.save(); dia(r); g.clip(); g.fillStyle = R.col; g.globalAlpha = 0.35; g.fillRect(x - r, y + r - 2 * r * kf, 2 * r, 2 * r * kf); g.restore();
    g.strokeStyle = R.col; g.lineWidth = 2.5 * s; dia(r); g.stroke();
    g.font = `italic 900 ${26 * bs}px system-ui,sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineWidth = 5 * s; g.strokeStyle = '#120e1c'; g.strokeText(R.id, x, y + 1 * s); g.fillStyle = S.rank >= 4 ? (Math.sin(performance.now() / 70) > 0 ? '#fff' : R.col) : R.col; g.fillText(R.id, x, y + 1 * s);
    // combo counter to the left of the badge
    if (S.n >= 2) { const ps = (1 + S.pop * 0.45) * s; g.textAlign = 'right'; g.font = `italic 900 ${24 * ps}px system-ui,sans-serif`; g.lineWidth = 5 * s; g.strokeText(String(S.n), x - 28 * s, y - 2 * s); g.fillStyle = S.n >= 20 ? '#ffd36b' : '#ffffff'; g.fillText(String(S.n), x - 28 * s, y - 2 * s);
      g.font = `900 ${8 * s}px system-ui,sans-serif`; g.fillStyle = '#ffe9b8'; g.fillText('HITS', x - 28 * s, y + 13 * s);
      const tf = clamp(S.t / COMBO_T, 0, 1); g.fillStyle = 'rgba(255,255,255,0.18)'; g.fillRect(x - 62 * s, y + 20 * s, 34 * s, 3 * s); g.fillStyle = R.col; g.fillRect(x - 62 * s, y + 20 * s, 34 * s * tf, 3 * s); }
    // bonus labels stacked under the badge
    S.labels.forEach((l, i) => { const k = Math.min(1, l.t / 0.12), out = Math.max(0, (l.t - 1.2) / 0.4); g.globalAlpha = (1 - out); const ly = y + (34 + i * 15) * s, lx = x + (1 - k) * 30 * s;
      g.font = `italic 900 ${(11 + (i === 0 ? (1 - k) * 6 : 0)) * s}px system-ui,sans-serif`; g.textAlign = 'right'; g.lineWidth = 4 * s; g.strokeStyle = '#120e1c'; const txt = l.s + (l.n > 1 ? ' x' + l.n : ''); g.strokeText(txt, lx + 22 * s, ly); g.fillStyle = l.col; g.fillText(txt, lx + 22 * s, ly); });
    g.globalAlpha = 1;
  }
  if (S.drop > 0) { g.globalAlpha = S.drop; g.font = `900 ${10 * s}px system-ui,sans-serif`; g.textAlign = 'center'; g.fillStyle = '#ff8a9a'; g.fillText('combo lost', x - 14 * s, y - 28 * s - (1 - S.drop) * 8 * s); g.globalAlpha = 1; }
  g.restore();
}

// ---------------- per-type hit reactions ----------------
const REACT = {
  hopper: { sq: 0.45, fx: 'leaf' }, charger: { sq: 0.72, fx: 'spark' }, moth: { sq: 0.8, spin: 16, fx: 'dust' },
  puffcap: { sq: 0.55, fx: 'spore' }, knight: { sq: 0.86, fx: 'spark' }, bomber: { sq: 0.66, fx: 'smoke' },
  lurefish: { sq: 0.7, spin: 12, fx: 'bubble' }, jelly: { sq: 0.4, fx: 'bubble' }, shellback: { sq: 0.82, fx: 'spark' }, dummy: { sq: 0.3, fx: 'leaf' } };
export function react(W, e, dir, big) {
  const r = REACT[e.type]; if (!r || e.boss) return; e.sq = Math.min(e.sq, big ? r.sq * 0.85 : r.sq); e.rkT = W.t; e.rkD = dir;
  if (r.spin && e.light) e.spinV = (e.spinV || 0) + dir * r.spin * (big ? 1 : 0.5);
  const x = e.cx, y = e.cy, n = big ? 7 : 3;
  if (r.fx === 'leaf') CB.leaves(W, x, y, n);
  else if (r.fx === 'spore') CB.spores(W, x, e.y + 4, n + 3);
  else if (r.fx === 'spark') W.fx.burst(x + dir * -6, y, n + 2, { color: ['#fff', '#ffe9a0', '#c8d2e2'], kind: 'spark', min: 160, max: 380, glow: 1, life: 0.25 });
  else if (r.fx === 'smoke') W.fx.burst(x, y, n, { color: ['#5a5268', '#8a80a0', '#3a3448'], min: 20, max: 90, size: 6, life: 0.6, g: -60 });
  else if (r.fx === 'bubble') W.fx.burst(x, y, n, { color: ['#bff7ff', '#8ff6ff', '#fff'], kind: 'dot', min: 30, max: 140, size: 3, life: 0.7, g: -80 });
  else if (r.fx === 'dust') W.fx.burst(x, y, n + 2, { color: ['#f0e6c8', '#d8c8a0', '#fff6d8'], kind: 'dot', min: 30, max: 160, size: 2.5, life: 0.8, g: 40 });
}

// ---------------- guard / armor / elites ----------------
export function initFoe(W, e, seed = 0, noElite = false) {
  if (W.mode === 'tutorial') return;
  if (e.type === 'charger') { e.armor = e.maxArmor = 2; }
  if (e.shield) e.guard = e.maxGuard = 3;
  if (!noElite && W.mode === 'run' && !e.boss && e.type !== 'dummy' && e.type !== 'tturret' && (e.depth || 0) >= 1) {
    const roll = (hash2(Math.round(e.x), Math.round(e.y) ^ seed) % 1000) / 1000; if (roll < Math.min(0.22, 0.08 + (e.depth || 0) * 0.03)) makeElite(e);
  }
}
export function makeElite(e) { if (e.elite) return; e.elite = true; e.maxHp = e.hp = Math.round(e.hp * 1.8); e.glim = Math.round(e.glim * 2.5); e.cdmg = Math.round(e.cdmg * 1.2); e.eScale = 1.15; }
// a block or armour check; returns 'block' (no damage), a damage multiplier, or 1
export function guardCheck(W, e, hit, p, facing) {
  const heavy = !!(hit.breaks || hit.fin || hit.dmg >= 20);
  if (e.armor > 0 && hit.src !== 'hazard') {
    if (heavy) { e.armor--; e.armorFlash = 1; sfx(e.armor ? 'block' : 'guardBreak'); W.fx.burst(e.cx, e.cy, e.armor ? 8 : 18, { color: ['#c8d2e2', '#fff', '#8a90a8'], kind: 'shard', min: 120, max: 380, size: 5, life: 0.6, g: 700 });
      if (!e.armor) { W.fx.text(e.cx, e.y - 16, 'ARMOR BREAK!', '#ffe27a', 15); e.stun = Math.max(e.stun, 1.1); bonus(W, 'ARMOR BREAK', 30, '#ffe27a'); W.emit('armorBreak'); }
      return 1; }
    e.armorFlash = 0.6; sfx('block'); W.fx.burst(e.cx - (e.cx - (p ? p.cx : e.cx) > 0 ? 8 : -8), e.cy, 4, { color: ['#fff', '#c8d2e2'], kind: 'spark', max: 260, glow: 1, life: 0.2 }); W.fx.text(e.cx, e.y - 12, 'clank', '#cfd6e6', 11);
    return 0.4;
  }
  if (e.shield && facing && hit.src !== 'bomb') {
    e.guard = (e.guard ?? 3) - (heavy ? 2 : 1); e.guardFlash = 1; // heavy (non-breaker) hits chew 2 pips
    if (e.guard <= 0) { guardBreak(W, e, p); return 1; }
    return 'block';
  }
  return 1;
}
export function guardBreak(W, e, p) {
  e.shield = false; e.guard = 0; e.stun = Math.max(e.stun, 1.4); e.tele = 0; e.st = 'idle'; sfx('guardBreak'); W.hitstop(0.09); W.fx.shake(0.3); W.zoomKick(0.6);
  W.fx.burst(e.cx + e.face * 12, e.cy, 20, { color: ['#c8d2e2', '#fff', '#8ff6ff'], kind: 'shard', min: 140, max: 420, size: 6, life: 0.7, g: 700 }); W.fx.ring(e.cx, e.cy, 54, '#8ff6ff', 0.35, 5);
  W.fx.text(e.cx, e.y - 16, 'GUARD BREAK!', '#8ff6ff', 16); bonus(W, 'GUARD BREAK', 30, '#8ff6ff');
  if (e.type === 'shellback') { e.flipT = W.t + 2.6; e.stun = Math.max(e.stun, 2.6); }
  W.emit('shieldBreak'); W.emit('guardBreak');
}
// overlays drawn around each foe: elite aura, guard pips, armour plates
export function drawFoeBack(g, W, e, lo) {
  if (e.dead) return; if (!e.elite) { if (e.auraVar) { const gy = e.y + e.h; g.globalCompositeOperation = 'lighter'; g.save(); g.translate(e.cx, gy); g.scale(1, 0.3); drawGlow(g, 0, 0, 18 + e.w * 0.7, e.auraVar, 0.45); g.restore(); drawGlow(g, e.cx, e.cy, 22 + e.w * 0.5, e.auraVar, 0.18); g.globalCompositeOperation = 'source-over'; } return; } // v2.0 variant tint
  const t = W.t, pul = 0.5 + Math.sin(t * 5 + e.x) * 0.5, X = e.cx, Y = e.cy, AC = e.auraCol || '#ff5ad0';
  g.globalCompositeOperation = 'lighter'; drawGlow(g, X, Y, 38 + e.w * 0.7 + pul * 8, AC, 0.5 + pul * 0.25); // v2.0: louder elite aura
  const gy = e.y + e.h; g.save(); g.translate(X, gy); g.scale(1, 0.28); drawGlow(g, 0, 0, 26 + e.w * 0.8, AC, 0.55 + pul * 0.2); g.restore();
  if (!lo) { for (let i = 0; i < 3; i++) { const a = t * 2.4 + i * 2.094, r = 18 + e.w * 0.5; drawGlow(g, X + Math.cos(a) * r, Y + Math.sin(a) * r * 0.55, 7, AC, 0.9); }
    for (let i = 0; i < 5; i++) { const k = (t * 0.9 + i / 5 + (e.x % 7) * 0.1) % 1, mx = X + Math.sin(i * 2.3 + t * 2) * e.w * 0.45; drawGlow(g, mx, gy - k * (e.h + 26), 5 * (1 - k) + 2, AC, 0.8 * (1 - k)); } }
  g.globalCompositeOperation = 'source-over';
}
export function drawFoeFront(g, W, e) {
  if (e.dead) return; const X = e.cx, top = e.y - 14;
  if (e.elite) { g.fillStyle = '#ff7ad8'; g.strokeStyle = '#1a0e1c'; g.lineWidth = 1.5; const y = top - (e.maxGuard && e.shield || e.maxArmor && e.armor > 0 ? 16 : 6) + Math.sin(W.t * 3) * 1.5; g.beginPath(); g.moveTo(X - 7, y + 4); g.lineTo(X - 7, y - 2); g.lineTo(X - 3.5, y + 1); g.lineTo(X, y - 4); g.lineTo(X + 3.5, y + 1); g.lineTo(X + 7, y - 2); g.lineTo(X + 7, y + 4); g.closePath(); g.fill(); g.stroke(); }
  if (e.maxGuard && e.shield) { const n = e.maxGuard, f = e.guardFlash || 0; for (let i = 0; i < n; i++) { const x = X - (n - 1) * 5 + i * 10, y = top + 4; g.fillStyle = i < e.guard ? (f > 0.5 ? '#fff' : '#8ff6ff') : 'rgba(30,26,40,0.7)'; g.strokeStyle = '#120e1c'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(x, y - 4); g.lineTo(x + 4, y - 2); g.lineTo(x + 3, y + 3); g.lineTo(x, y + 5); g.lineTo(x - 3, y + 3); g.lineTo(x - 4, y - 2); g.closePath(); g.fill(); g.stroke(); } }
  if (e.maxArmor && e.armor > 0) { const f = e.armorFlash || 0; for (let i = 0; i < e.maxArmor; i++) { const x = X - (e.maxArmor - 1) * 6 + i * 12, y = top + 4; g.fillStyle = i < e.armor ? (f > 0.4 ? '#fff' : '#c8d2e2') : 'rgba(30,26,40,0.6)'; g.strokeStyle = '#120e1c'; g.lineWidth = 1.5; g.fillRect(x - 4, y - 3, 8, 7); g.strokeRect(x - 4, y - 3, 8, 7); } }
}
export function tickFoe(e, dt) { if (e.guardFlash) e.guardFlash = Math.max(0, e.guardFlash - dt * 3); if (e.armorFlash) e.armorFlash = Math.max(0, e.armorFlash - dt * 3); }

// ---------------- wall splat / trap KO ----------------
export function splat(W, e, v) {
  e.flungT = 0; const P = W.player, dmg = Math.round(8 + Math.min(14, Math.abs(v) * 0.025)), wx = v > 0 ? e.x + e.w : e.x;
  W.hitEnemy(e, { dmg, kb: 0, stun: 0.7, stag: 0.7, hs: 0.07, shake: 0.32, src: 'splat' }, P);
  e.vx = -v * 0.28; e.vy = Math.min(e.vy, -150); e.sq = 0.4; sfx('splat');
  W.fx.burst(wx, e.cy, 12, { color: ['#fff', '#e8e2d0', '#ffd08a'], kind: 'star', min: 60, max: 260, life: 0.45, size: 5, angle: v > 0 ? Math.PI : 0, spread: 1.4 });
  W.fx.dust && W.fx.dust(wx, e.cy, 6, { dir: -Math.sign(v), speed: 90, size: 5, life: 0.5 }); W.fx.ring(wx, e.cy, 34, '#ffd08a', 0.3, 5); CB.decal(W, wx, e.cy, 0.7);
  W.fx.text(e.cx, e.y - 12, 'SPLAT!', '#ffb36a', 15); bonus(W, 'WALL SPLAT', 40, '#ffb36a'); W.emit('wallSplat');
}
export function trapKO(W, e, killed) {
  e.flungT = 0; sfx('trapKO'); W.fx.ring(e.cx, e.cy, 60, '#ff7ad8', 0.45, 6); W.fx.burst(e.cx, e.cy, 16, { color: ['#ff7ad8', '#ffe27a', '#fff'], kind: 'star', min: 80, max: 320, life: 0.8, size: 6 });
  if (killed) { W.dropGlims(e.cx, e.cy, 6); W.fx.text(e.cx, e.y - 22, 'TRAP KO!', '#ff7ad8', 20); bonus(W, 'TRAP KO', 80, '#ff7ad8'); W.zoomKick(0.9); W.hitstop(0.1); W.emit('trapKO', e.type); }
  else { W.fx.text(e.cx, e.y - 18, 'TRAP HIT!', '#ff9ae0', 15); bonus(W, 'TRAP HIT', 30, '#ff9ae0'); }
}

// ---------------- ground quake (Thorn Hammer) ----------------
export function quake(W, p, d) {
  if (!p.onGround) return; const small = d.quake === 'small', gy = p.y + p.h, R = small ? 70 : 130, pal = palOf('hammer');
  W.fx.shake(small ? 0.2 : 0.4); CB.wave(W, p.cx + p.face * 20, gy, R, pal[0]); CB.decal(W, p.cx + p.face * 24, gy, small ? 0.8 : 1.3);
  W.fx.burst(p.cx + p.face * 22, gy - 2, small ? 6 : 11, { color: ['#7a5a3a', '#a07a4a', '#5a4030', pal[0]], kind: 'shard', min: 120, max: small ? 280 : 420, angle: -Math.PI / 2, spread: 1.1, size: 5, life: 0.7, g: 900 });
  if (!small) { for (const dir of [-1, 1]) CB.lash(W, p.cx, gy, dir, R, '#d07a3a'); sfx('slam'); }
  W.attackBox({ x: p.cx - R, y: gy - 20, w: R * 2, h: 22 }, { dmg: small ? 6 : 12, kb: 220, launch: small ? 200 : 300, kdir: 'up', stag: 0.6, hs: 0.03, shake: 0.1, breaks: !small, quakeHit: true }, p, new Set(p.atk && p.atk.hit ? [...p.atk.hit] : []));
}

// ---------------- cinematic camera (boss break / phase / death) ----------------
export function cine(W, o) { W.cine = { t: 0, life: o.life || 1, x: o.x, y: o.y, zoom: o.zoom || 1.2, slow: o.slow || 0, bars: o.bars !== false, label: o.label || '', col: o.col || '#ffe27a' }; }
export function tickCine(W, rdt) { const c = W.cine; if (!c) return; c.t += rdt; if (c.t >= c.life) W.cine = null; }
export function cineK(W) { const c = W.cine; if (!c) return 0; const a = Math.min(1, c.t / 0.18), b = Math.min(1, (c.life - c.t) / 0.35); const k = Math.max(0, Math.min(a, b)); return k * k * (3 - 2 * k); }
export function drawCineHUD(g, W, w, h, s) {
  const c = W.cine; if (!c) return; const k = cineK(W), bh = h * 0.085 * k;
  if (c.bars) { g.fillStyle = '#07060c'; g.fillRect(0, 0, w, bh); g.fillRect(0, h - bh, w, bh); }
  if (c.label) { const a = Math.min(1, c.t / 0.12), sc = (1.5 - Math.min(1, c.t / 0.2) * 0.5) * s; g.save(); g.globalAlpha = a * Math.min(1, (c.life - c.t) / 0.3); g.translate(w / 2, h * 0.3); g.scale(sc, sc);
    g.font = 'italic 900 44px system-ui,sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineWidth = 10; g.strokeStyle = '#120e1c'; g.strokeText(c.label, 0, 0); g.fillStyle = c.col; g.fillText(c.label, 0, 0); g.restore(); }
}
