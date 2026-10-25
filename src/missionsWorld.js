// v1.8 mission wiring for the live game: run trackers (no-hit rooms, hook chains, mini-boss timer, potion-free areas),
// lost critters (find -> happy hop -> follow -> sparkle home), the painted hub Mission Board, hub friends, toasts and the HUD tracker.
import { TILE, clamp } from './util.js';
import { has, spr, tinted } from './gfx.js';
import { drawGlow, drawIcon, PAL } from './art.js';
import { sfx, stinger } from './audio.js';
import { save, writeSave } from './save.js';
import { missions, missionEvent, missionIcon, TYPES, pickCritterSpots, CRITTERS, CAPES } from './missions.js';
export function drawMIcon(g, icon, x, y, size, color = '#fff') { // atlas sprite or vector icon, centred
  if (icon.startsWith('spr:')) { const n = icon.slice(4); if (has(n)) { spr(g, n, x, y + size * 0.45, size * 0.92, 0.5, 1); return; } icon = 'pet'; }
  if (icon.startsWith('hatx:')) { drawHat(g, icon.slice(5), x, y + size * 0.18, size / 19, 1); return; }
  drawIcon(g, icon, x, y, size, color);
}
export function rewardIcon(r) { const [k, v] = r.split(':'); return k === 'wpn' ? 'spr:w_' + v : k === 'pet' ? 'spr:cr_' + v : k === 'cape' ? 'cape' : k === 'hat' ? 'hatx:' + v : k === 'vine' ? 'hook' : k === 'badge' ? 'badge' : 'glimmer'; }
export function rewardColor(r) { const [k, v] = r.split(':'); if (k === 'wpn') return { hammer: '#ff8a2a', whip: '#9ae04a' }[v] || '#bff5c8'; if (k === 'cape') return (CAPES.find((c) => c.id === v) || {}).b || '#fff'; if (k === 'vine') return { berry: '#d9a6ff', frost: '#e2f2ff', sunset: '#ffc46a', rainbow: '#ffa6d8' }[v] || '#9be070'; if (k === 'hat') return { flower: '#ffa6d8', acorn: '#c98a4a', leafcrown: '#9be070', mush: '#ff6a5a', crown: '#ffe27a' }[v] || '#fff'; return '#ffe27a'; }
// ---- toasts (game-level so they survive scene changes) ----
export function toast(game, o) { // v2.0: one toast per mission -- progress updates in place (no stacking), a completion replaces its progress toast
  if (!game) return; const L = game.toasts || (game.toasts = []), key = o.key || o.icon + o.color;
  const same = L.find((x) => x.key === key && !x.done);
  if (same && !o.done) { same.prog = o.prog; same.target = o.target; same.t = Math.min(same.t, 0.25); same.life = 2.0; same.bump = 1; return; }
  if (same) L.splice(L.indexOf(same), 1);
  L.push({ t: 0, life: o.done ? 3.4 : 2.0, ...o, key, bump: 0 }); while (L.length > 3) { const i = L.findIndex((x) => !x.done); L.splice(i >= 0 ? i : 0, 1); }
}
function report(W, list) {
  const game = W.game, P = W.player;
  for (const r of list) {
    const T = TYPES[r.mi.type], done = r.kind === 'done';
    toast(game, { key: 'm' + (r.mi.id ?? r.mi.type), icon: missionIcon(r.mi), color: T.color, prog: r.mi.prog, target: r.mi.target, done, reward: done ? r.reward[0] : null });
    if (done) { sfx('unlock'); setTimeout(() => stinger('mission'), 180); W.fx.burst(P.cx, P.y, 34, { color: ['#ffe27a', '#fff', T.color, '#ffa6d8'], min: 80, max: 330, g: 200, kind: 'star', life: 1.1, size: 6 }); W.fx.ring(P.cx, P.cy, 70, T.color, 0.6, 6); }
    else sfx('pickup');
  }
}
export function mEvent(W, name, data) { if (W.mode !== 'run' && W.mode !== 'boss' && name !== 'dailyDone') return []; const list = missionEvent(name, data); report(W, list); return list; }
// ---- attach to a World ----
export function attachMissions(W) {
  W.mt = { chain: 0, hit: new Set(), fightT0: 0 }; W.critters = []; W.friends = [];
  const daily = W.game && W.game.daily; if (daily && (W.mode === 'run' || W.mode === 'boss')) { W.daily = daily; W.dmgTaken = daily.mod.taken; W.dmgDealt = daily.mod.dealt; }
  if (W.mode === 'run' && W._L) for (const c of pickCritterSpots(W._L, W.seed + W.stage * 7919)) if (!W.opened.has(c.id)) W.critters.push({ ...c, px: c.x * TILE + 12, py: (c.y + 1) * TILE, hx: c.x * TILE + 12, st: 'lost', t: Math.random() * 3, face: 1, hop: 0 });
  if (W.mode === 'hub') { const m = missions(); CRITTERS.filter((c) => m.owned.includes('pet:' + c)).forEach((c, i) => W.friends.push({ kind: c, px: 0, py: 0, t: i * 1.3, face: 1, hop: 0, home: i, sel: m.wardrobe.pet === c })); }
  W.on((n, d) => {
    const mt = W.mt, P = W.player;
    if (n === 'hurt' || n === 'hazard') { const c = W.curCell; if (c) mt.hit.add(c.index); }
    else if (n === 'roomClear') { if (!mt.hit.has(d)) mEvent(W, 'roomClean'); }
    else if (n === 'hookAttach') { mt.chain = P.onGround ? 1 : mt.chain + 1; if (mt.chain >= 2) mEvent(W, 'chain', mt.chain); }
    else if (n === 'land') mt.chain = 0;
    else if (n === 'fightStart') mt.fightT0 = W.t;
    else if (n === 'miniboss') mEvent(W, 'minibossTime', W.t - mt.fightT0);
    else if (n === 'secret' || n === 'critter') mEvent(W, n);
    else if (n === 'kill') mEvent(W, 'kill', d);
    else if (n === 'glim') mEvent(W, 'glim', 1);
    else if (n === 'flask') { if (W.game) W.game.areaFlask = true; }
  });
}
// ---- critters ----
const CR_H = 39; // v2.0: critters 1.4x bigger (was 28) so kids can read their faces
function groundY(W, x, y) { for (let k = 0; k < 8; k++) { const ty = Math.floor((y - 1) / TILE) + k; if (W.map.solid(Math.floor(x / TILE), ty + 1) || W.map.get(Math.floor(x / TILE), ty + 1) === '=') return (ty + 1) * TILE; } return y; }
export function updateMissions(W, dt) {
  const P = W.player, game = W.game;
  if (game && game.toasts) { for (const o of game.toasts) o.t += dt; game.toasts = game.toasts.filter((o) => o.t < o.life); }
  for (const c of W.critters) {
    c.t += dt;
    if (c.st === 'lost') { c.hop = Math.max(0, Math.sin(c.t * 2.2) * (Math.sin(c.t * 0.7) > 0.4 ? 1 : 0)); c.face = Math.sin(c.t * 0.45) > 0 ? 1 : -1;
      if (!P.dead && Math.abs(P.cx - c.px) < 22 && Math.abs(P.y + P.h - c.py) < 30) { c.st = 'happy'; c.t = 0; c.face = P.cx > c.px ? 1 : -1; W.opened.add(c.id); sfx('secret'); W.fx.burst(c.px, c.py - 14, 14, { color: ['#ff9ab0', '#ffd0e0', '#fff'], min: 40, max: 160, g: -60, kind: 'star', life: 0.9, size: 5 }); } }
    else if (c.st === 'happy') { c.hop = Math.abs(Math.sin(c.t * 9)) * 1.6; if (c.t > 0.95) { c.st = 'follow'; c.t = 0; } }
    else if (c.st === 'follow') { const tx = P.cx - P.face * 20, ty = P.y + P.h; c.face = tx > c.px ? 1 : -1; c.px += (tx - c.px) * Math.min(1, dt * 5); c.py += (ty - c.py) * Math.min(1, dt * 7); c.hop = Math.abs(Math.sin(c.t * 8)) * (Math.abs(tx - c.px) > 3 ? 1 : 0.3);
      if (c.t > 2.4) { c.st = 'home'; c.t = 0; sfx('chest'); W.fx.burst(c.px, c.py - 10, 26, { color: ['#ffe27a', '#bff2ff', '#fff', '#ffa6d8'], min: 60, max: 240, g: -40, kind: 'star', life: 1, size: 5, glow: 1 }); W.fx.ring(c.px, c.py - 10, 36, '#ffe27a', 0.5, 4); } }
    else if (c.st === 'home') { if (c.t > 0.45 && !c.gone) { c.gone = true; W.emit('critter', c.kind); } }
  }
  W.critters = W.critters.filter((c) => !(c.gone && c.t > 0.6));
  for (const f of W.friends) { // hub friends: the worn one follows Sprig, the rest play by the Mission Board
    f.t += dt; const board = W.props.find((o) => o.kind === 'station' && o.n === 4);
    if (f.sel) { const tx = P.cx - P.face * 22; f.face = tx > f.px + 2 ? 1 : tx < f.px - 2 ? -1 : f.face; if (!f.px) { f.px = tx; f.py = P.y + P.h; } f.px += (tx - f.px) * Math.min(1, dt * 4); f.py = groundY(W, f.px, P.y + P.h - 6); f.hop = Math.abs(tx - f.px) > 4 ? Math.abs(Math.sin(f.t * 8)) : 0; }
    else if (board) { const hx = board.x + board.w / 2 + (f.home - 1.2) * 26 + Math.sin(f.t * 0.6 + f.home) * 14; f.face = Math.cos(f.t * 0.6 + f.home) > 0 ? 1 : -1; f.px = hx; f.py = board.y + board.h; f.hop = Math.max(0, Math.sin(f.t * 3 + f.home)) * 0.8; }
  }
}
function drawCritter(g, W, kind, x, y, hop, face, t, a = 1, k = 1, st = 'idle', ct = 0) { // v2.0: breathing idle, trembling when lost, stretch-hop + spin when happy
  const n = 'cr_' + kind, h = CR_H * k, ph = x * 0.37; let jy = -hop * 9, sx = 1, sy = 1, rot = 0, ox = 0;
  const br = Math.sin(t * 2.6 + ph); sy = 1 + br * 0.035; sx = 1 - br * 0.025; rot = Math.sin(t * 1.3 + ph) * 0.05; // breathe + gentle sway
  if (hop > 0) { const land = hop < 0.15; sy = land ? 0.9 : 1.08; sx = land ? 1.1 : 0.94; }
  if (st === 'lost') { ox = Math.sin(t * 38) * 0.9; rot = Math.sin(t * 2.1 + ph) * 0.12; sy *= 0.95; } // shivering, peeking around
  let spin = 1; if (st === 'happy') { const u = (ct % 0.9) / 0.9; jy = -Math.sin(u * Math.PI) * 18; sy = u < 0.12 ? 0.84 : u > 0.88 ? 0.9 : 1.12; sx = 2 - sy; if (ct < 0.9) spin = Math.cos(u * Math.PI * 2); }
  g.save(); g.globalAlpha *= a; g.fillStyle = 'rgba(10,8,18,0.35)'; g.beginPath(); g.ellipse(x, y, 14 * k * (1 + jy / 60), 3 * k, 0, 0, 7); g.fill();
  if (has(n)) { g.translate(x + ox, y + jy); g.rotate(rot); g.scale(face * sx * (Math.abs(spin) < 0.15 ? 0.15 * Math.sign(spin || 1) : spin), sy); for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) spr(g, n, dx, dy, h, 0.5, 1, false, tinted(n, '#15131f')); spr(g, n, 0, 0, h, 0.5, 1);
    if (st !== 'happy' && Math.sin(t * 1.7 + x) > 0.96) { g.fillStyle = '#3a2a1a'; g.globalAlpha *= 0.7; g.fillRect(0.5, -h * 0.62, h * 0.3, h * 0.08); } } // quick blink
  else { g.fillStyle = '#9be070'; g.beginPath(); g.arc(x, y - 11 + jy, 11, 0, 7); g.fill(); }
  g.restore();
  if (st === 'happy' && W.fx && Math.random() < 0.25) W.fx.burst(x + (Math.random() - 0.5) * 30, y - h * 0.6 + jy, 1, { color: ['#ffe27a', '#ffa6d8', '#8ff6ff'], kind: 'star', min: 10, max: 50, g: -40, life: 0.6, size: 4 });
}
export function drawCritters(g, W) {
  const t = W.t;
  for (const c of W.critters) {
    if (c.st === 'lost') { g.globalCompositeOperation = 'lighter'; drawGlow(g, c.px, c.py - 10, 26, '#ffd0e0', 0.22 + Math.sin(t * 3) * 0.06); g.globalCompositeOperation = 'source-over';
      const by = c.py - 60 + Math.sin(t * 3 + c.px) * 2; g.fillStyle = 'rgba(255,250,240,0.92)'; g.strokeStyle = '#15131f'; g.lineWidth = 1.5; g.beginPath(); g.arc(c.px, by, 8, 0, 7); g.fill(); g.stroke(); g.beginPath(); g.moveTo(c.px - 3, by + 7); g.lineTo(c.px, by + 12); g.lineTo(c.px + 3, by + 7); g.fill();
      drawIcon(g, 'heart', c.px, by, 10 * (1 + Math.sin(t * 6) * 0.08), '#ff6a8a'); }
    const a = c.st === 'home' ? Math.max(0, 1 - c.t / 0.45) : 1, k = c.st === 'home' ? 1 + c.t * 0.8 : 1;
    if (c.st === 'happy' || c.st === 'follow') { const hy = c.py - 54 - (c.t * 18) % 14; g.globalAlpha = 0.8; drawIcon(g, 'heart', c.px + Math.sin(c.t * 5) * 5, hy, 7, '#ff8aa0'); g.globalAlpha = 1; }
    if (a > 0) drawCritter(g, W, c.kind, c.px, c.py, c.hop, c.face, t, a, k, c.st, c.t);
  }
  for (const f of W.friends) if (f.px) drawCritter(g, W, f.kind, f.px, f.py, f.hop, f.face, t, 1, 1, 'idle');
}
// ---- the painted Mission Board in the hub (station 4) ----
export function drawBoard(g, W, o) {
  const t = W.t, X = o.x + o.w / 2, Y = o.y + o.h, H = 86, m = missions();
  if (!has('board')) return false; const w = H * 198 / 213;
  g.globalCompositeOperation = 'lighter'; drawGlow(g, X - w * 0.39, Y - H * 0.72, 22, '#ffb13b', 0.5 + Math.sin(t * 3) * 0.08); g.globalCompositeOperation = 'source-over';
  for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) spr(g, 'board', X + dx, Y + 1 + dy, H, 0.5, 1, false, tinted('board', '#15131f')); spr(g, 'board', X, Y + 1, H, 0.5, 1);
  const fx0 = X - w / 2 + w * 0.19, fx1 = X - w / 2 + w * 0.755, fy0 = Y - H + H * 0.215, fy1 = Y - H + H * 0.55, nw = (fx1 - fx0) / 3;
  m.active.slice(0, 3).forEach((mi, i) => { const T = TYPES[mi.type], cx = fx0 + nw * (i + 0.5), cy = (fy0 + fy1) / 2 + (i % 2 ? 1.5 : -1), rot = (i - 1) * 0.07 + Math.sin(t * 1.3 + i) * 0.015, done = mi.prog >= mi.target;
    g.save(); g.translate(cx, cy); g.rotate(rot); g.fillStyle = 'rgba(20,12,6,0.35)'; g.fillRect(-nw * 0.42 + 1.2, -12 + 1.5, nw * 0.84, 25);
    g.fillStyle = '#f6ecd2'; g.fillRect(-nw * 0.42, -12, nw * 0.84, 25); g.strokeStyle = '#6a4a2a'; g.lineWidth = 0.7; g.strokeRect(-nw * 0.42, -12, nw * 0.84, 25);
    g.fillStyle = '#d8622a'; g.beginPath(); g.arc(0, -11, 1.6, 0, 7); g.fill(); // pin
    drawMIcon(g, missionIcon(mi), 0, -2, 12, T.color === '#ffe27a' ? '#c99a1a' : '#3a5a3a');
    const bw = nw * 0.66; g.fillStyle = '#d9cba8'; g.fillRect(-bw / 2, 7, bw, 3); g.fillStyle = done ? '#ffb13b' : '#5aa84a'; g.fillRect(-bw / 2, 7, bw * Math.min(1, mi.prog / mi.target), 3);
    g.restore(); });
  // little floating "!" bubble so kids notice it
  const by = Y - H - 10 + Math.sin(t * 2.2) * 3; drawGlow(g, X, by, 26, '#ffe27a', 0.55); g.fillStyle = 'rgba(20,18,32,0.85)'; g.beginPath(); g.arc(X, by, 12, 0, 7); g.fill(); g.strokeStyle = '#ffe27a'; g.lineWidth = 1.5; g.stroke(); drawIcon(g, 'board', X, by, 15, '#ffe27a');
  return true;
}
// ---- hero cosmetics: a cloth cape (verlet, anchored to the animated frame's back) and a hat on the head ----
export function updateCape(P, ax, ay, dt) {
  const n = 6; if (!P.cape || Math.hypot(P.cape[0].x - ax, P.cape[0].y - ay) > 80) P.cape = Array.from({ length: n }, (_, i) => ({ x: ax, y: ay + i * 4, px: ax, py: ay + i * 4 }));
  const c = P.cape; c[0].x = ax; c[0].y = ay;
  for (let i = 1; i < n; i++) { const p = c[i], vx = (p.x - p.px) * 0.88, vy = (p.y - p.py) * 0.88; p.px = p.x; p.py = p.y; p.x += vx - P.face * 10 * dt - P.vx * 0.012 * dt * 60 * 0.1 + Math.sin(P.t * 6 + i) * 0.18; p.y += vy + 0.32; }
  for (let k = 0; k < 3; k++) for (let i = 1; i < n; i++) { const a = c[i - 1], b = c[i], dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1, f = (d - 4.4) / d; b.x -= dx * f; b.y -= dy * f; }
}
export function drawCape(g, P, cape) {
  const c = P.cape; if (!c) return; const n = c.length, L = [], R = [];
  for (let i = 0; i < n; i++) { const a = c[Math.max(0, i - 1)], b = c[Math.min(n - 1, i + 1)], dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1, w = 2.6 + i * 1.05; L.push([c[i].x - dy / d * w, c[i].y + dx / d * w]); R.push([c[i].x + dy / d * w, c[i].y - dx / d * w]); }
  const path = () => { g.beginPath(); g.moveTo(L[0][0], L[0][1]); for (const p of L) g.lineTo(p[0], p[1]); const e = c[n - 1]; g.quadraticCurveTo(e.x + (c[n - 1].x - c[n - 2].x) * 0.8, e.y + 3, R[n - 1][0], R[n - 1][1]); for (let i = n - 1; i >= 0; i--) g.lineTo(R[i][0], R[i][1]); g.closePath(); };
  g.save(); g.lineJoin = 'round'; path(); g.strokeStyle = PAL.ink; g.lineWidth = 3; g.stroke();
  const gr = g.createLinearGradient(c[0].x, c[0].y, c[n - 1].x, c[n - 1].y); gr.addColorStop(0, cape.b); gr.addColorStop(0.35, cape.a); gr.addColorStop(1, cape.a); g.fillStyle = gr; g.fill();
  g.clip(); g.strokeStyle = 'rgba(255,255,255,0.22)'; g.lineWidth = 1; for (let i = 1; i < n - 1; i += 2) { g.beginPath(); g.moveTo(L[i][0], L[i][1]); g.lineTo(R[i][0], R[i][1]); g.stroke(); }
  if (cape.star) { g.fillStyle = cape.b; for (let i = 2; i < n; i += 2) drawIcon(g, 'star', c[i].x, c[i].y, 4.5, cape.b); }
  g.restore();
}
export function drawHat(g, id, x, y, s, face) { // x,y = top of head (world), s = scale (1 ~ hero head size)
  if (!id || id === 'none') return; g.save(); g.translate(x, y); g.scale(s * face, s); g.lineJoin = 'round'; g.lineWidth = 1.4; g.strokeStyle = PAL.ink;
  const blob = (cx, cy, r, col) => { g.beginPath(); g.arc(cx, cy, r, 0, 7); g.fillStyle = col; g.fill(); g.stroke(); };
  if (id === 'flower') { for (let i = -2; i <= 2; i++) { blob(i * 3.4, 1 + Math.abs(i) * 0.6, 2.4, ['#ffa6d8', '#fff2a8', '#bff2ff', '#ffa6d8', '#fff2a8'][i + 2]); } blob(0, 0.5, 1, '#ffd36b'); }
  else if (id === 'acorn') { g.beginPath(); g.ellipse(0, 0, 7.5, 4.5, 0, Math.PI, 0); g.closePath(); g.fillStyle = '#8a5a2a'; g.fill(); g.stroke(); g.strokeStyle = 'rgba(40,20,8,0.6)'; g.lineWidth = 0.8; for (let i = -2; i <= 2; i++) { g.beginPath(); g.moveTo(i * 2.6, -0.3); g.lineTo(i * 2.6 + 1.5, -3.6); g.stroke(); } g.strokeStyle = PAL.ink; g.lineWidth = 1.6; g.beginPath(); g.moveTo(0, -4.3); g.lineTo(1.2, -7); g.stroke(); }
  else if (id === 'leafcrown') { for (let i = -2; i <= 2; i++) { g.save(); g.translate(i * 3.2, 0.5); g.rotate(i * 0.35); g.beginPath(); g.ellipse(0, -3, 1.9, 4, 0, 0, 7); g.fillStyle = i % 2 ? '#5aa84a' : '#9be070'; g.fill(); g.stroke(); g.restore(); } }
  else if (id === 'mush') { g.beginPath(); g.ellipse(0, -0.5, 8.5, 5.5, 0, Math.PI, 0); g.closePath(); g.fillStyle = '#e8483a'; g.fill(); g.stroke(); g.fillStyle = '#fff4e0'; for (const [dx, dy, r] of [[-4, -2.5, 1.3], [1, -4, 1.1], [4.5, -1.8, 1.2]]) { g.beginPath(); g.arc(dx, dy, r, 0, 7); g.fill(); } }
  else if (id === 'crown') { g.beginPath(); g.moveTo(-6, 1); g.lineTo(-6.5, -5); g.lineTo(-3, -2); g.lineTo(0, -6.5); g.lineTo(3, -2); g.lineTo(6.5, -5); g.lineTo(6, 1); g.closePath(); g.fillStyle = '#ffd34a'; g.fill(); g.stroke(); g.fillStyle = '#ff6a8a'; g.beginPath(); g.arc(0, -1.5, 1.2, 0, 7); g.fill(); }
  g.restore();
}
// ---- HUD: toasts (top centre) + the toggleable mini mission tracker (left, under the flasks) ----
export function drawMissionHUD(g, W, w, h, s) {
  const game = W.game, m = missions(), t = W.t;
  if (m.hud && (W.mode === 'run' || W.mode === 'boss' || W.mode === 'hub')) {
    const x = 14 * s, y0 = 78 * s; g.save();
    g.fillStyle = 'rgba(10,8,18,0.5)'; g.beginPath(); g.roundRect(x - 4 * s, y0 - 4 * s, 88 * s, 3 * 19 * s + 6 * s, 10 * s); g.fill();
    m.active.slice(0, 3).forEach((mi, i) => { const T = TYPES[mi.type], y = y0 + i * 19 * s + 8 * s, k = Math.min(1, mi.prog / mi.target);
      drawMIcon(g, missionIcon(mi), x + 9 * s, y, 15 * s, T.color);
      g.fillStyle = 'rgba(255,255,255,0.14)'; g.beginPath(); g.roundRect(x + 21 * s, y - 3 * s, 42 * s, 6 * s, 3 * s); g.fill();
      g.fillStyle = T.color; g.beginPath(); g.roundRect(x + 21 * s, y - 3 * s, Math.max(6 * s, 42 * s * k), 6 * s, 3 * s); if (k > 0) g.fill();
      g.font = `800 ${8.5 * s}px system-ui,sans-serif`; g.textAlign = 'left'; g.fillStyle = '#fff'; g.fillText(mi.type === 'quick' ? '⏱' : String(Math.min(mi.prog, mi.target)) + '/' + mi.target, x + 66 * s, y + 3 * s); });
    g.restore();
  }
  const L = (game && game.toasts) || []; const S = s * 1.3; L.forEach((o, i) => {
    o.sy = o.sy === undefined ? i : o.sy + (i - o.sy) * 0.22; if (o.bump) o.bump = Math.max(0, o.bump - 0.06); // v2.0: slots glide instead of jumping
    const k = Math.min(1, o.t / 0.25), out = Math.max(0, (o.t - (o.life - 0.3)) / 0.3), e = 1 - Math.pow(1 - k, 3), y = (40 + o.sy * 46) * S - (1 - e) * 30 * S - out * 20 * S, cx = w / 2;
    const bw = (o.done ? 150 : 110) * S, bh = 38 * S; g.save(); g.globalAlpha = (1 - out) * e; if (o.bump) { const bs = 1 + o.bump * 0.12; g.translate(cx, y + bh / 2); g.scale(bs, bs); g.translate(-cx, -(y + bh / 2)); }
    if (o.done) { g.globalCompositeOperation = 'lighter'; drawGlow(g, cx, y + bh / 2, 90 * S, o.color, 0.35); g.globalCompositeOperation = 'source-over'; }
    g.fillStyle = 'rgba(16,12,26,0.88)'; g.strokeStyle = o.done ? '#ffe27a' : o.color; g.lineWidth = 2 * S; g.beginPath(); g.roundRect(cx - bw / 2, y, bw, bh, 14 * S); g.fill(); g.stroke();
    drawMIcon(g, o.icon, cx - bw / 2 + 20 * S, y + bh / 2, 22 * S, o.color);
    if (o.done) { drawIcon(g, 'star', cx - 8 * S, y + bh / 2, 22 * S * (1 + Math.max(0, 0.3 - o.t) * 2), '#ffe27a'); drawIcon(g, 'right', cx + 14 * S, y + bh / 2, 10 * S, '#fff');
      if (o.reward) { const rc = rewardColor(o.reward), ri = rewardIcon(o.reward); drawGlow(g, cx + bw / 2 - 26 * S, y + bh / 2, 20 * S, rc, 0.6); drawMIcon(g, ri, cx + bw / 2 - 26 * S, y + bh / 2, 22 * S, rc); }
      for (let j = 0; j < 6; j++) { const a = j / 6 * 6.28 + o.t * 2, r = (24 + o.t * 30) * S; g.globalAlpha = Math.max(0, 1 - o.t / 1.2) * (1 - out); drawIcon(g, 'star', cx + Math.cos(a) * r * 2.2, y + bh / 2 + Math.sin(a) * r * 0.7, 7 * S, ['#ffe27a', '#ffa6d8', '#8ff6ff'][j % 3]); } }
    else { const n = Math.min(o.target, 10), pw = 9 * S, x0 = cx - bw / 2 + 40 * S; if (o.target <= 10) for (let j = 0; j < n; j++) { g.fillStyle = j < o.prog ? o.color : 'rgba(255,255,255,0.18)'; g.beginPath(); g.arc(x0 + j * pw * (o.target > 6 ? 0.7 : 1) + 4 * S, y + bh / 2, 3.4 * S, 0, 7); g.fill(); }
      else { g.fillStyle = 'rgba(255,255,255,0.15)'; g.beginPath(); g.roundRect(x0, y + bh / 2 - 3.5 * S, 58 * S, 7 * S, 3.5 * S); g.fill(); g.fillStyle = o.color; g.beginPath(); g.roundRect(x0, y + bh / 2 - 3.5 * S, Math.max(7 * S, 58 * S * o.prog / o.target), 7 * S, 3.5 * S); g.fill(); } }
    g.restore(); });
}
// ---- capes are a recolour of Sprig's painted scarf/cape on every animation frame (cached sheet per cape) ----
const SHEETS = new Map();
export function capeSheet(H, id) {
  if (!id || id === 'none' || !H || !H.img) return null; if (SHEETS.has(id)) return SHEETS.get(id);
  const cp = CAPES.find((c) => c.id === id); if (!cp) return null; let cv = null;
  try {
    const W = H.img.width, Hh = H.img.height; cv = document.createElement('canvas'); cv.width = W; cv.height = Hh; const g = cv.getContext('2d', { willReadFrequently: true }); g.drawImage(H.img, 0, 0);
    const D = g.getImageData(0, 0, W, Hh), d = D.data, hx = (c) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16)), A = hx(cp.a), B = hx(cp.b);
    const cut = new Int16Array(W * Hh).fill(-1); // only recolour above each frame's knee line (boots/straps keep their leather)
    for (const F of Object.values(H.f)) { const lim = Math.round(F[1] + F[5] + 100); for (let y = F[1]; y < Math.min(Hh, F[1] + F[3]); y++) for (let x = F[0]; x < Math.min(W, F[0] + F[2]); x++) cut[y * W + x] = y < lim ? 1 : 0; }
    for (let i = 0, p = 0; i < d.length; i += 4, p++) {
      if (d[i + 3] < 13 || cut[p] !== 1) continue; const r = d[i] / 255, gg = d[i + 1] / 255, b = d[i + 2] / 255, mx = Math.max(r, gg, b), mn = Math.min(r, gg, b), s = (mx - mn) / (mx + 1e-6); if (mx !== r) continue;
      let h = ((gg - b) / (mx - mn + 1e-6)) * 60; if (h < 0) h += 360; const red = h < 40 || h > 345;
      if (!(red && ((s > 0.5 && mx > 0.5) || (s > 0.8 && mx > 0.3) || (h < 22 && s > 0.86 && mx > 0.2)))) continue;
      const k = Math.min(1, Math.max(0, (mx - 0.18) / 0.65)); for (let c = 0; c < 3; c++) d[i + c] = A[c] + (B[c] - A[c]) * k;
    }
    g.putImageData(D, 0, 0);
  } catch (e) { cv = null; }
  SHEETS.set(id, cv); return cv;
}
