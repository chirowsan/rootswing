// v1.9 combat feel: per-move pose + blade keyframes, additive crescent trails, vine lashes, ground shockwaves and cracks,
// impact pops, leaf/petal/spore bursts, the Bloom gauge and its screen-wide special. Pure visuals + small helpers; rules live in player/world.
import { sfx } from './audio.js';
export const GAUGE_MAX = 100;
const TAU = Math.PI * 2;
// frame names come from tools/hero-combat-poses.py (rig). w = blade angle keys [wind, active start, active end, recovery] in frame space
// (0 = forward, -PI/2 = up). arc = crescent sweep around the shoulder (same convention), r = radius, th = thickness (world units).
export const MV = {
  cut: { a: 'c_cut_a', s: 'c_cut_s', f: 'c_cut_f', w: [-2.5, -2.0, 0.8, 0.75], arc: [-2.3, 0.95], r: 30, th: 12 },
  rev: { a: 'c_rev_a', s: 'c_rev_s', f: 'c_rev_f', w: [1.8, 1.4, -1.9, -2.0], arc: [1.5, -2.1], r: 31, th: 12 },
  spin: { a: 'c_spin_a', s: 'c_spin_s', f: 'c_spin_s', w: [2.4, 0, 0, 0.3], spin: 1, r: 40, th: 12 },
  lunge: { a: 'c_lunge_a', s: 'c_lunge_f', f: 'c_lunge_f', w: [0.1, 0, 0, 0.05], thrust: 1 },
  slam: { a: 'c_slam_a', s: 'c_slam_f', f: 'c_slam_f', w: [-1.9, -2.3, 1.2, 1.15], arc: [-2.5, 1.35], r: 36, th: 17 },
  rise: { a: 'c_rise_a', s: 'c_rise_f', f: 'c_rise_f', w: [1.9, 1.6, -1.5, -1.6], arc: [1.4, -1.8], r: 36, th: 14 },
  air: { a: 'c_air_a', s: 'c_air_f', f: 'c_air_f', w: [-2.5, -2.0, 0.9, 0.85], arc: [-2.3, 1.0], r: 31, th: 12 },
  airrev: { a: 'c_rev_a', s: 'c_rev_s', f: 'c_rev_f', w: [1.8, 1.4, -1.9, -2.0], arc: [1.6, -2.0], r: 31, th: 12 },
  airspin: { a: 'c_airspin', s: 'c_airspin', f: 'c_airspin', w: [0.4, 0, 0, 0], spin: 1, r: 40, th: 12 },
  dash: { a: 'c_dash', s: 'c_dash', f: 'c_dash', w: [-2.8, 0.2, -2.7, -2.75], line: 1 },
  counter: { a: 'c_lunge_a', s: 'c_counter', f: 'c_counter', w: [0.2, -2.5, 0.75, 0.7], arc: [-2.6, 1.05], r: 40, th: 16 },
  whirl: { a: 'c_charge', s: 'c_whirl', f: 'c_whirl', w: [2.5, 0, 0, 0], spin: 1, r: 52, th: 14 },
  kick: { a: 'c_kick', s: 'c_kick', f: 'c_kick', w: null, foot: 1 },
  bloom: { a: 'c_bloom', s: 'c_bloom', f: 'c_bloom', w: [-1.6, -1.6, -1.6, -1.6] },
  plunge: { a: 'c_plunge', s: 'c_plunge', f: 'c_plunge_l', w: [1.5, 1.55, 1.55, 1.2] },
};
const ease = (k) => 1 - (1 - k) * (1 - k) * (1 - k);
const clamp01 = (k) => (k < 0 ? 0 : k > 1 ? 1 : k);
export function cfx(W) { return W.cfx || (W.cfx = { trails: [], lashes: [], decals: [], pops: [], waves: [] }); }
// crescent trail that rides the hero (offset from his centre); face mirrors the angles
export function trail(W, P, o) { const c = cfx(W); if (c.trails.length > 10) c.trails.shift(); c.trails.push({ P, t: 0, dur: 0.1, fade: 0.14, ox: 2, oy: -6, face: P.face, ...o }); }
export function lash(W, x, y, dir, L, col = '#7fe0a0') { const c = cfx(W); if (c.lashes.length > 6) c.lashes.shift(); c.lashes.push({ x, y, dir, L, t: 0, life: 0.42, col, seed: Math.random() * 9 }); }
export function decal(W, x, y, s = 1) { const c = cfx(W); if (c.decals.length >= 12) c.decals.shift(); const rays = []; for (let i = 0; i < 6; i++) rays.push([(-0.5 + Math.random()) * 1.2 + (i % 2 ? 0 : Math.PI), (14 + Math.random() * 20) * s, Math.random()]); c.decals.push({ x, y, s, t: 0, life: 2.2, rays }); }
export function pop(W, x, y, s = 1, col = '#fff') { const c = cfx(W); if (c.pops.length > 10) c.pops.shift(); c.pops.push({ x, y, s, t: 0, life: 0.12, col, a: Math.random() * 0.6 }); }
export function wave(W, x, y, R = 70, col = '#e8f6d0') { const c = cfx(W); if (c.waves.length > 6) c.waves.shift(); c.waves.push({ x, y, R, t: 0, life: 0.32, col }); }
export function leaves(W, x, y, n, o = {}) { W.fx.burst(x, y, n, { color: o.color || ['#8fdc6a', '#5fbf4a', '#c8f08a', '#3f9a44'], min: 60, max: o.max || 260, size: o.size || 5, life: o.life || 0.9, g: 260, drag: 3, kind: 'leaf', angle: o.angle, spread: o.spread }); }
export function petals(W, x, y, n, o = {}) { W.fx.burst(x, y, n, { color: ['#ffc2e0', '#ff8fc4', '#fff0f6', '#ffd6a0'], min: 40, max: o.max || 220, size: 4, life: o.life || 1.1, g: 120, drag: 2.5, kind: 'leaf', angle: o.angle, spread: o.spread }); }
export function spores(W, x, y, n) { W.fx.burst(x, y, n, { color: ['#e8ffb0', '#bff7a0', '#fff6c8'], min: 20, max: 120, size: 2.4, life: 1.2, g: -30, drag: 1.5, glow: 1, kind: 'dot' }); }
// gauge
export function gain(P, n, W) { const was = P.gauge >= GAUGE_MAX; P.gauge = Math.min(GAUGE_MAX, (P.gauge || 0) + n); if (!was && P.gauge >= GAUGE_MAX && W) { sfx('gaugeFull'); W.fx.text(P.cx, P.y - 16, 'BLOOM READY', '#ffc2e0', 13); W.emit && W.emit('gaugeFull'); } }
export function tickPops(W, dt) { const c = W.cfx; if (!c) return; for (const o of c.pops) o.t += dt; c.pops = c.pops.filter((o) => o.t < o.life); } // real-time: never frozen by hit-stop
export function update(W, dt) {
  const c = W.cfx; if (!c) return;
  for (const k of ['trails', 'lashes', 'decals', 'waves']) { const L = c[k]; for (const o of L) o.t += dt; c[k] = L.filter((o) => o.t < (o.life ?? o.dur + o.fade)); }
}
function crescent(g, cx, cy, r, th, tail, head, face, sq) {
  const N = 14; const outer = [], inner = [];
  for (let i = 0; i <= N; i++) {
    const u = i / N, a = tail + (head - tail) * u, w = th * Math.pow(u, 0.9), A = face > 0 ? a : Math.PI - a;
    const ro = r + w * 0.35, ri = r - w * 0.65, cs = Math.cos(A), sn = Math.sin(A) * sq;
    outer.push(cx + cs * ro, cy + sn * ro); inner.push(cx + cs * ri, cy + sn * ri);
  }
  g.beginPath(); g.moveTo(outer[0], outer[1]); for (let i = 2; i < outer.length; i += 2) g.lineTo(outer[i], outer[i + 1]); for (let i = inner.length - 2; i >= 0; i -= 2) g.lineTo(inner[i], inner[i + 1]); g.closePath(); g.fill();
}
export function drawBack(g, W) { // ground decals (under entities)
  const c = W.cfx; if (!c) return;
  for (const d of c.decals) {
    const k = 1 - d.t / d.life; g.globalAlpha = Math.min(1, k * 2) * 0.75; g.strokeStyle = '#1a1424'; g.lineWidth = 2.2; g.lineCap = 'round';
    g.beginPath(); for (const [a, L, j] of d.rays) { const x1 = d.x + Math.cos(a) * L, y1 = d.y + Math.sin(a) * L * 0.18 - 1; g.moveTo(d.x, d.y - 1); g.lineTo((d.x + x1) / 2 + j * 3, (d.y + y1) / 2 - 2 * j); g.lineTo(x1, y1); } g.stroke();
    g.globalAlpha *= 0.6; g.fillStyle = '#1a1424'; g.beginPath(); g.ellipse(d.x, d.y - 1, 16 * d.s, 3.2 * d.s, 0, 0, TAU); g.fill();
  }
  g.globalAlpha = 1;
}
// v2.0 Vine Whip trail: a living vine that sweeps from the hand to a cracking tip
function drawWhip(g, o, cx, cy, f, ph, pt, fadeK, lo) {
  const [a0, a1] = o.arc, head = a0 + (a1 - a0) * ph, lag = head - (a1 - a0) * 0.42 * (1 - ph * 0.6), L = o.r, P = (a, r) => { const A = f > 0 ? a : Math.PI - a; return [cx + Math.cos(A) * r, cy + Math.sin(A) * r * (o.sq || 1)]; };
  const [hx, hy] = P(a0 + (a1 - a0) * ph * 0.25, 10), [mx, my] = P(lag, L * 0.62), [tx, ty] = P(head, L);
  const tail = a0 + (a1 - a0) * pt * 0.9; g.globalAlpha = 0.22 * fadeK; g.fillStyle = o.col; crescent(g, cx, cy, L * 0.97, 10, tail, head, f, o.sq || 1); // faint sweep ribbon
  const seg = (w, col, al) => { g.globalAlpha = al * fadeK; g.strokeStyle = col; g.lineWidth = w; g.beginPath(); g.moveTo(hx, hy); g.quadraticCurveTo(mx, my, tx, ty); g.stroke(); };
  if (!lo) seg(11, o.col, 0.18); seg(5.5, o.col, 0.85); seg(1.8, o.core || '#fff', 0.95);
  g.fillStyle = o.col; for (let i = 1; i < 6; i++) { const u = i / 6, x = (1 - u) * (1 - u) * hx + 2 * u * (1 - u) * mx + u * u * tx, y = (1 - u) * (1 - u) * hy + 2 * u * (1 - u) * my + u * u * ty; g.globalAlpha = 0.9 * fadeK; g.beginPath(); g.ellipse(x, y - 2, 3.2, 1.6, (head + i) * 0.7, 0, TAU); g.fill(); } // leaves along the vine
  if (ph > 0.7) { const k = clamp01((ph - 0.7) / 0.3) * fadeK, s = 9 + 9 * k; g.globalAlpha = k; g.fillStyle = o.core || '#fff'; g.beginPath(); for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4 + 0.3, rr = i % 2 ? s * 0.2 : s; g.lineTo(tx + Math.cos(a) * rr, ty + Math.sin(a) * rr); } g.closePath(); g.fill(); } // the crack
}
export function drawFront(g, W, lo) { // trails, lashes, shockwaves, impact pops (additive)
  const c = W.cfx; if (!c) return; g.save(); g.globalCompositeOperation = 'lighter'; g.lineCap = 'round'; g.lineJoin = 'round';
  for (const o of c.trails) {
    const P = o.P, f = o.face, cx = P.cx + f * o.ox, cy = P.cy + o.oy, fadeK = o.t > o.dur ? 1 - (o.t - o.dur) / o.fade : 1;
    const ph = ease(clamp01(o.t / o.dur)), pt = ease(clamp01((o.t - o.dur * 0.35) / (o.dur * 0.65 + o.fade)));
    if (o.kind === 'thrust' || o.kind === 'dash') {
      const L = o.L * (o.kind === 'dash' ? 1 : 0.35 + 0.65 * ph), x0 = cx - f * (o.kind === 'dash' ? o.L * 0.85 : 4), y0 = cy + (o.kind === 'dash' ? 4 : 0);
      for (const [wk, col, al] of [[1.5, o.col, 0.22], [1, o.col, 0.55], [0.4, o.core || '#ffffff', 0.9]]) { g.globalAlpha = al * fadeK; g.fillStyle = col; const h = o.h * wk * (1 - pt * 0.6); g.beginPath(); g.moveTo(x0 + f * L * pt * 0.8, y0 - h * 0.15); g.lineTo(x0 + f * L, y0 - h * 0.5 * 0.2); g.lineTo(x0 + f * (L + 10), y0); g.lineTo(x0 + f * L, y0 + h * 0.1); g.lineTo(x0 + f * L * pt * 0.8, y0 + h * 0.15); g.closePath(); g.fill(); }
      if (!lo) { g.globalAlpha = 0.5 * fadeK; g.strokeStyle = o.col; g.lineWidth = 1.5; for (let i = 0; i < 3; i++) { const yy = y0 + (i - 1) * 9, xa = x0 - f * (10 + i * 8) * (1 - pt); g.beginPath(); g.moveTo(xa, yy); g.lineTo(xa + f * L * 0.6, yy); g.stroke(); } }
      continue;
    }
    if (o.kind === 'spin') { // flattened disc that spins around the hero
      const turns = o.turns || 1, head = -Math.PI / 2 + ph * TAU * turns, tail = head - 2.2 * (1 - pt * 0.5);
      for (const [wk, col, al] of [[1.5, o.col, 0.18], [1, o.col, 0.5], [0.38, o.core || '#ffffff', 0.85]]) { g.globalAlpha = al * fadeK; g.fillStyle = col; crescent(g, cx, cy + 2, o.r, o.th * wk * (o.heavy ? 1.3 : 1), tail, head, 1, 0.42); }
      continue;
    }
    if (o.kind === 'foot') { g.globalAlpha = 0.7 * fadeK; g.strokeStyle = o.col; g.lineWidth = 5 * (1 - pt); g.beginPath(); g.arc(cx + f * 10, cy + 12, 16, f > 0 ? -0.9 : Math.PI - 0.9 + 0.0, f > 0 ? 0.9 : Math.PI + 0.9); g.stroke(); continue; }
    if (o.kind === 'whip') { drawWhip(g, o, cx, cy, f, ph, pt, fadeK, lo); continue; }
    const [a0, a1] = o.arc, head = a0 + (a1 - a0) * ph, tail = a0 + (a1 - a0) * pt * 0.92, hk = o.heavy ? 1.35 : 1; // v2.0: 4 layers -- wide soft glow, body, rim, hot core (style palette)
    for (const [wk, col, al] of lo ? [[1, o.col, 0.6], [0.36, o.core || '#ffffff', 0.95]] : [[1.7, o.col, 0.13], [1.25, o.col, 0.3], [1, o.col, 0.55], [0.36, o.core || '#ffffff', 0.95]]) { g.globalAlpha = al * fadeK; g.fillStyle = col; crescent(g, cx, cy, o.r * (wk > 1 ? 1 + (wk - 1) * 0.12 : 1), o.th * wk * hk, tail, head, f, o.sq || 1); }
  }
  for (const l of c.lashes) { // vine whip lash racing along the ground
    const k = l.t / l.life, grow = ease(clamp01(k * 2.2)), fade = 1 - clamp01((k - 0.55) / 0.45), L = l.L * grow;
    g.globalAlpha = 0.9 * fade; g.strokeStyle = l.col; g.lineWidth = 4.5 * (1 - k * 0.5); g.beginPath();
    for (let i = 0; i <= 18; i++) { const u = i / 18, x = l.x + l.dir * L * u, y = l.y - Math.sin(u * 9 + l.seed - k * 14) * 5 * (1 - u) - 2; i ? g.lineTo(x, y) : g.moveTo(x, y); } g.stroke();
    g.lineWidth = 1.6; g.strokeStyle = '#eaffc0'; g.stroke();
    g.fillStyle = '#c8f08a'; for (let i = 2; i < 18; i += 4) { const u = i / 18; if (u > grow) break; const x = l.x + l.dir * L * u, y = l.y - Math.sin(u * 9 + l.seed - k * 14) * 5 * (1 - u) - 2; g.beginPath(); g.moveTo(x, y); g.lineTo(x + l.dir * 3, y - 9 * fade); g.lineTo(x + l.dir * 6, y); g.fill(); }
  }
  for (const w of c.waves) { const k = w.t / w.life, R = w.R * ease(k); g.globalAlpha = 0.8 * (1 - k); g.strokeStyle = w.col; g.lineWidth = 6 * (1 - k) + 1; g.beginPath(); g.ellipse(w.x, w.y - 2, R, R * 0.2, 0, Math.PI, TAU); g.stroke(); g.lineWidth = 2; g.globalAlpha *= 0.6; g.beginPath(); g.ellipse(w.x, w.y - 2, R * 0.7, R * 0.14, 0, 0, TAU); g.stroke(); }
  for (const p of c.pops) { // 4-point impact star
    const k = p.t / p.life, s = (10 + 16 * ease(k)) * p.s; g.globalAlpha = 1 - k; g.fillStyle = p.col;
    g.beginPath(); for (let i = 0; i < 8; i++) { const a = p.a + i * Math.PI / 4, rr = i % 2 ? s * 0.18 : s; g.lineTo(p.x + Math.cos(a) * rr, p.y + Math.sin(a) * rr); } g.closePath(); g.fill();
  }
  g.restore(); g.globalAlpha = 1;
}
// Bloom special: darkened screen with a petal storm and thorn vines erupting in a ring
export function drawSpecialDim(g, W) { // v1.9: dims the world BEHIND the fighters so the hero and foes pop during Bloom
  const s = W.special; if (!s) return; const k = s.t / s.life, a = Math.min(1, s.t * 8) * (1 - clamp01((k - 0.7) / 0.3));
  g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 0.5 * a; g.fillStyle = '#1a0c22'; g.fillRect(0, 0, g.canvas.width, g.canvas.height); g.restore(); g.globalAlpha = 1;
}
export function drawSpecial(g, W, cw, ch) { // edge bloom only (centre stays clear)
  const s = W.special; if (!s) return; const k = s.t / s.life, a = Math.min(1, s.t * 8) * (1 - clamp01((k - 0.7) / 0.3));
  const gr = g.createRadialGradient(cw / 2, ch / 2, ch * 0.35, cw / 2, ch / 2, cw * 0.7); gr.addColorStop(0, 'rgba(255,150,200,0)'); gr.addColorStop(1, 'rgba(255,120,190,0.42)'); g.globalAlpha = a; g.fillStyle = gr; g.fillRect(0, 0, cw, ch);
  g.globalAlpha = 1;
}
function thorn(g, x, y, h, lean, w) { // tapered curved thorn spike with two barbs, rooted at (x, y)
  const tx = x + lean, ty = y - h;
  g.beginPath(); g.moveTo(x - w, y + 2); g.quadraticCurveTo(x - w * 0.6 + lean * 0.3, y - h * 0.55, tx, ty); g.quadraticCurveTo(x + w * 0.6 + lean * 0.3, y - h * 0.45, x + w, y + 2); g.closePath(); g.fill(); g.stroke();
  for (const f of [0.42, 0.66]) { const bx = x + lean * f * f, by = y - h * f, sd = f < 0.5 ? -1 : 1, bw = w * (1 - f) * 0.9; g.beginPath(); g.moveTo(bx + sd * bw * 0.6, by + 3); g.lineTo(bx + sd * (bw + 6), by - 5); g.lineTo(bx + sd * bw * 0.6, by - 2); g.closePath(); g.fill(); }
}
function flower(g, x, y, r, open, t) { g.save(); g.translate(x, y); g.rotate(t * 3);
  for (let i = 0; i < 5; i++) { g.rotate(TAU / 5); g.fillStyle = i % 2 ? '#ff8fc4' : '#ffc2e0'; g.beginPath(); g.ellipse(0, -r * open * 0.7, r * 0.42, r * open * 0.75, 0, 0, TAU); g.fill(); }
  g.fillStyle = '#ffe27a'; g.beginPath(); g.arc(0, 0, r * 0.35, 0, TAU); g.fill(); g.restore(); }
export function drawSpecialWorld(g, W) {
  const s = W.special; if (!s) return; const k = s.t / s.life, R = s.R * ease(clamp01(k * 2.2)), fade = 1 - clamp01((k - 0.7) / 0.3);
  drawSpecialDim(g, W);
  g.save(); g.lineJoin = 'round';
  // ground shock ring (flat, on the floor)
  g.globalCompositeOperation = 'lighter'; g.globalAlpha = 0.7 * fade; g.strokeStyle = '#ffc2e0'; g.lineWidth = 7 * (1 - k) + 2; g.beginPath(); g.ellipse(s.x, s.y - 1, R, R * 0.16, 0, 0, TAU); g.stroke();
  g.globalAlpha = 0.35 * fade; g.lineWidth = 3; g.beginPath(); g.ellipse(s.x, s.y - 1, R * 0.72, R * 0.11, 0, 0, TAU); g.stroke();
  g.globalCompositeOperation = 'source-over';
  // thorns erupt outward along the ground on both sides, staggered by distance; a flower opens on the tallest ones
  const N = 14;
  for (let i = 0; i < N; i++) {
    const side = i % 2 ? 1 : -1, j = (i >> 1) + 1, d = j / (N / 2) * s.R, x = s.x + side * d, born = (d / s.R) * 0.32, lt = s.t - born; if (lt <= 0 || d > R + 8) continue;
    const grow = ease(clamp01(lt / 0.12)), shrink = 1 - clamp01((k - 0.72) / 0.28), h = (22 + ((i * 7) % 3) * 9 + (j === 2 ? 14 : 0)) * grow * shrink, lean = side * (6 + (i % 3) * 3);
    g.globalAlpha = 1; g.fillStyle = '#2f6b2a'; g.strokeStyle = '#173a1a'; g.lineWidth = 1.5; thorn(g, x, s.y, h, lean, 5 + (i % 2));
    g.fillStyle = '#8fdc6a'; g.globalAlpha = 0.55; g.beginPath(); g.moveTo(x - 1, s.y); g.quadraticCurveTo(x - 1.5 + lean * 0.3, s.y - h * 0.5, x + lean * 0.96, s.y - h * 0.96); g.lineTo(x + 1.5, s.y); g.fill();
    if (i % 3 === 0 && h > 18) { g.globalAlpha = shrink; flower(g, x + lean, s.y - h, 6, ease(clamp01((lt - 0.08) / 0.15)), s.t + i); }
    if (lt < 0.06) { g.globalAlpha = 1 - lt / 0.06; g.fillStyle = '#c8a070'; g.beginPath(); g.ellipse(x, s.y, 9, 3, 0, 0, TAU); g.fill(); }
  }
  g.restore(); g.globalAlpha = 1;
}
