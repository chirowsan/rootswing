// v2.4 Vine Whip: a real lash. A 12-link chain whose links follow the handle angle with a delay, so a bend
// travels down the vine and the tip arrives last and fastest (the crack). Hits are tested along the chain
// (swept between frames so the fast tip cannot tunnel); the last 25 % is the tip zone = crit.
import { sfx } from './audio.js';
import * as CB from './combat.js';
export const N = 12, TIP_FROM = 9; // links 9..11 (last 25 %) are the tip zone
const TAU = Math.PI * 2;
// angles in frame space: 0 = forward, -PI/2 = up, +PI/2 = down. r = rest, a0 = cocked, a1 = strike, L = reach (world px),
// lag = share of the active time the bend needs to travel to the tip, ov = follow-through overshoot past a1
export const WM = {
  cut: { r: 0.9, a0: -2.55, a1: 0.02, L: 104, lag: 0.45, ov: 0.3 }, // overhead crack
  rev: { r: 0.9, a0: 2.45, a1: -0.14, L: 104, lag: 0.45, ov: -0.3 }, // low backhand
  rise: { r: 0.9, a0: 1.5, a1: -1.2, L: 96, lag: 0.42, ov: -0.3 }, // sky crack (launches)
  fin: { r: 0.9, a0: -2.95, a1: 0.1, L: 128, lag: 0.55, ov: 0.45 }, // big snap-pull
  up: { r: 0.9, a0: 1.3, a1: -1.5, L: 104, lag: 0.42, ov: -0.25 },
  diag: { r: 0.9, a0: 1.9, a1: -0.72, L: 108, lag: 0.45, ov: -0.25 },
  air: { r: 0.6, a0: -2.4, a1: 0.06, L: 96, lag: 0.42, ov: 0.3 },
  down: { r: 0.3, a0: -1.7, a1: 1.05, L: 96, lag: 0.42, ov: 0.3 },
};
const sm = (k) => (k <= 0 ? 0 : k >= 1 ? 1 : k * k * (3 - 2 * k));
const eo = (k) => (k <= 0 ? 0 : k >= 1 ? 1 : 1 - Math.pow(1 - k, 3));
// handle angle at time tau (seconds since the attack started); W_ = wind, A = active, R = rec
function handleAngle(m, tau, W_, A, R) {
  if (tau <= 0) return m.r;
  if (tau < W_) return m.r + (m.a0 - m.r) * sm(tau / W_); // anticipation: cock it back
  const ta = tau - W_, sweep = A * (1 - m.lag);
  if (ta < sweep) return m.a0 + (m.a1 - m.a0) * eo(ta / sweep); // the snap
  const tr = ta - sweep, ft = A * m.lag + R * 0.5; // follow-through: drift past a1 then settle back toward rest
  if (tr < ft) return m.a1 + m.ov * Math.sin(Math.PI * Math.min(1, tr / ft) * 0.5);
  return m.a1 + m.ov + (m.r - m.a1 - m.ov) * sm((tr - ft) / Math.max(0.01, R * 0.5));
}
function extend(tau, W_, A, R) { // link length scale: coiled in the wind-up, full at the crack, recoils in recovery
  if (tau < W_) return 0.42 + 0.08 * (tau / W_);
  const ta = tau - W_; if (ta < A) return 0.5 + 0.5 * eo(ta / (A * 0.55));
  const tr = ta - A; return 1 - 0.55 * sm(tr / Math.max(0.01, R));
}
export function timing(a) { return { W_: a.wind ?? a.def.wind, A: a.def.active, R: a.def.rec }; }
// chain points in world space from an origin; face mirrors
export function chain(m, tau, T, ox, oy, face) {
  const pts = [[ox, oy]], ext = extend(tau, T.W_, T.A, T.R), seg = (m.L / N) * ext, step = (T.A * m.lag) / N;
  let x = ox, y = oy;
  for (let i = 0; i < N; i++) {
    const th = handleAngle(m, tau - step * (i + 1), T.W_, T.A, T.R) + Math.sin(tau * 9 + i * 0.7) * 0.02 * i, A = face > 0 ? th : Math.PI - th;
    x += Math.cos(A) * seg; y += Math.sin(A) * seg; pts.push([x, y]);
  }
  return pts;
}
export function crackTime(a) { const T = timing(a), m = WM[a.wm]; return T.W_ + T.A * (1 - m.lag) + T.A * m.lag * (N - 1) / N; }
export function origin(P) { return [P.cx + P.face * 5, P.cy - 8]; }
// per frame (all phases). Returns true when anything was hit this frame.
export function update(W, P, a, dt) {
  const m = WM[a.wm]; if (!m) return false;
  a.tau = (a.tau || 0) + dt; const T = timing(a), [ox, oy] = origin(P), pts = chain(m, a.tau, T, ox, oy, P.face);
  const prev = a.pts || pts; a.pts = pts;
  const tip = pts[N]; P.whipTip = tip; (a.tips || (a.tips = [])).push([tip[0], tip[1], a.tau]); if (a.tips.length > 7) a.tips.shift();
  if (!a.cracked && a.tau >= crackTime(a)) { a.cracked = true; sfx('whipCrack'); a.crackT = 0; if (W.fx) W.fx.burst(tip[0], tip[1], 4, { color: ['#fff', '#eaffc0'], kind: 'spark', min: 60, max: 200, life: 0.18, glow: 1, size: 2 }); }
  if (a.crackT !== undefined) a.crackT += dt;
  if (a.phase !== 'active') return false;
  const hd = a.hd || a.def, before = a.hit.size; let any = false;
  const sweptBox = (i, pad) => { const p = pts[i], q = prev[i]; const x0 = Math.min(p[0], q[0]) - pad, y0 = Math.min(p[1], q[1]) - pad; return { x: x0, y: y0, w: Math.abs(p[0] - q[0]) + pad * 2, h: Math.abs(p[1] - q[1]) + pad * 2 }; };
  for (let i = N; i >= TIP_FROM; i--) if (W.attackBox(sweptBox(i, 9), { ...hd, tipHit: true, hs: hd.fin ? 0.07 : 0.05 }, P, a.hit)) any = true;
  const tipN = a.hit.size - before;
  for (let i = TIP_FROM - 1; i >= 3; i--) if (W.attackBox(sweptBox(i, 8), { ...hd, tipHit: false, hs: 0.03 }, P, a.hit)) any = true;
  if (tipN > 0) { // tip crit: spark star, camera punch, crack sound; a finisher / pull tip yanks light foes to you
    let k = 0; const hitNow = [...a.hit].slice(before, before + tipN);
    sfx('whipTip'); W.zoomKick && W.zoomKick(0.35); W.fx.shake(0.12); a.tipHits = (a.tipHits || 0) + tipN;
    W.fx.burst(tip[0], tip[1], 10, { color: ['#fff', '#fff3b0', '#c8f08a'], kind: 'spark', min: 120, max: 360, life: 0.26, glow: 1, size: 3 });
    CB.pop(W, tip[0], tip[1], 1.6, '#fff3b0');
    for (const e of hitNow) { k++; if ((hd.kdir === 'pull' || hd.yank) && e && !e.dead && e.light && !e.boss) { e.vx = Math.sign(P.cx - e.cx) * Math.min(520, 160 + Math.abs(P.cx - e.cx) * 3.2); e.vy = Math.min(e.vy || 0, -180); e.yankUntil = W.t + 0.8; e.stun = Math.max(e.stun || 0, 0.5); } }
  }
  return any;
}
// drawing: tapered vine with an ink edge, leaves, a fading tip smear and the crack star
export function draw(g, P, a, hand, lo) {
  const m = WM[a.wm]; if (!m || !a.tau) return;
  const T = timing(a), [ox, oy] = origin(P), pts = chain(m, a.tau, T, ox, oy, P.face);
  if (hand) { const dx = hand[0] - ox, dy = hand[1] - oy; for (let i = 0; i <= N; i++) { const k = 1 - i / N; pts[i][0] += dx * k; pts[i][1] += dy * k; } } // root the vine in the fist
  const recK = a.phase === 'rec' ? Math.min(1, a.t / Math.max(0.01, a.def.rec)) : 0, alpha = 1 - recK * 0.35;
  g.save(); g.lineCap = 'round'; g.lineJoin = 'round';
  if (!lo && a.tips && a.tips.length > 2 && a.phase !== 'wind') { // smear: ribbon through the last tip positions
    g.globalCompositeOperation = 'lighter'; const L = a.tips.length;
    for (let i = 1; i < L; i++) { const p = a.tips[i - 1], q = a.tips[i], k = i / L; g.globalAlpha = 0.5 * k * alpha; g.strokeStyle = '#d8ffb0'; g.lineWidth = 2 + 7 * k; g.beginPath(); g.moveTo(p[0], p[1]); g.lineTo(q[0], q[1]); g.stroke(); }
    g.globalCompositeOperation = 'source-over';
  }
  const wAt = (i) => 4.6 - 3.2 * (i / N);
  for (let pass = 0; pass < 2; pass++) {
    for (let i = 0; i < N; i++) { const p = pts[i], q = pts[i + 1]; g.globalAlpha = alpha; g.strokeStyle = pass ? (i % 3 === 1 ? '#7fd36a' : '#5fbf4a') : '#1a2414'; g.lineWidth = wAt(i) + (pass ? 0 : 2.2); g.beginPath(); g.moveTo(p[0], p[1]); g.lineTo(q[0], q[1]); g.stroke(); }
  }
  g.strokeStyle = '#c8f08a'; g.lineWidth = 1; g.globalAlpha = 0.8 * alpha; g.beginPath(); g.moveTo(pts[1][0], pts[1][1] - 1); for (let i = 2; i < N; i++) g.lineTo(pts[i][0], pts[i][1] - 1); g.stroke(); // highlight
  g.fillStyle = '#8fdc6a'; for (let i = 2; i < N; i += 3) { const p = pts[i], q = pts[i + 1], an = Math.atan2(q[1] - p[1], q[0] - p[0]) + (i % 2 ? 0.9 : -0.9); g.globalAlpha = alpha; g.beginPath(); g.ellipse(p[0] + Math.cos(an) * 3, p[1] + Math.sin(an) * 3, 3.4, 1.5, an, 0, TAU); g.fill(); }
  const tp = pts[N]; g.fillStyle = '#eaffc0'; g.beginPath(); g.arc(tp[0], tp[1], 2.6, 0, TAU); g.fill(); // tip bud
  if (a.crackT !== undefined && a.crackT < 0.12) { // crack star + ring at the tip
    const k = a.crackT / 0.12, s = 7 + 13 * k; g.globalCompositeOperation = 'lighter'; g.globalAlpha = 1 - k; g.fillStyle = '#fffbe0'; g.beginPath();
    for (let i = 0; i < 8; i++) { const an = i * Math.PI / 4 + 0.4, rr = i % 2 ? s * 0.22 : s; g.lineTo(tp[0] + Math.cos(an) * rr, tp[1] + Math.sin(an) * rr); } g.closePath(); g.fill();
    g.strokeStyle = '#eaffc0'; g.lineWidth = 2; g.beginPath(); g.arc(tp[0], tp[1], 4 + 16 * k, 0, TAU); g.stroke();
  }
  g.restore();
}
export function handleAt(a) { const m = WM[a.wm]; if (!m) return null; const T = timing(a); return handleAngle(m, a.tau || 0, T.W_, T.A, T.R); }
