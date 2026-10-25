// Axis-separated AABB vs tile collision with one-way planks.
import { TILE } from './util.js';
const EPS = 0.001;
// v1.5: hero movement constants live here so the reachability validator (src/reach.js) simulates the exact same numbers.
export const HERO = { RUN: 182, ACC_G: 1750, DEC_G: 2100, ACC_A: 1200, GRAV: 1480, GRAV_FALL: 1720, JUMP: 515, CUT: 0.45, MAXFALL: 600, SLIDE: 115, WJX: 235, WJY: 470, DASH: 470, DASH_T: 0.17, DASH_CD: 0.38 };
export const isPlank = (c) => c === '=' || c === 'u'; // 'u' = crumbling plank (v1.5 trap)
export function moveBody(map, b, dt, opts = {}) {
  const res = { ground: false, wallL: false, wallR: false, ceil: false, oneway: false };
  // X
  let nx = b.x + b.vx * dt;
  if (b.vx !== 0) {
    const dir = b.vx > 0 ? 1 : -1, edge = dir > 0 ? nx + b.w : nx;
    const tx = Math.floor((dir > 0 ? edge - EPS : edge) / TILE), ty0 = Math.floor(b.y / TILE), ty1 = Math.floor((b.y + b.h - EPS) / TILE);
    for (let ty = ty0; ty <= ty1; ty++) if (map.solid(tx, ty)) {
      nx = dir > 0 ? tx * TILE - b.w : (tx + 1) * TILE; if (dir > 0) res.wallR = true; else res.wallL = true; b.vx = 0; break;
    }
  }
  b.x = nx;
  // Y
  let ny = b.y + b.vy * dt;
  const tx0 = Math.floor(b.x / TILE), tx1 = Math.floor((b.x + b.w - EPS) / TILE);
  if (b.vy > 0) {
    const prevBottom = b.y + b.h, bottom = ny + b.h; const ty = Math.floor((bottom - EPS) / TILE);
    for (let x = tx0; x <= tx1; x++) {
      const c = map.get(x, ty);
      const solid = c === '#' || c === 'B' || c === 'G';
      const plank = isPlank(c) && !opts.drop && prevBottom <= ty * TILE + 2;
      if (solid || plank) { ny = ty * TILE - b.h; b.vy = 0; res.ground = true; res.oneway = plank && !solid; break; }
    }
  } else if (b.vy < 0) {
    const ty = Math.floor(ny / TILE);
    const hitAt = (x0) => { for (let x = Math.floor(x0 / TILE), x1 = Math.floor((x0 + b.w - EPS) / TILE); x <= x1; x++) if (map.solid(x, ty)) return true; return false; };
    const bodyFree = (x0) => { for (let x = Math.floor(x0 / TILE), x1 = Math.floor((x0 + b.w - EPS) / TILE); x <= x1; x++) for (let yy = Math.floor(b.y / TILE), y1 = Math.floor((b.y + b.h - EPS) / TILE); yy <= y1; yy++) if (map.solid(x, yy)) return false; return true; };
    if (hitAt(b.x)) {
      let fixed = false; // v1.4 corner correction: clipping a ceiling corner by <= 7 px slides you past it instead of killing the jump
      if (opts.corner) for (let k = 1; k <= 7 && !fixed; k++) for (const d of [-1, 1]) { const x2 = b.x + d * k; if (!hitAt(x2) && bodyFree(x2)) { b.x = x2; fixed = true; res.corner = d * k; break; } }
      if (!fixed) { ny = (ty + 1) * TILE; b.vy = 0; res.ceil = true; }
    }
  }
  b.y = ny;
  return res;
}
// Is there ground directly under the body (for coyote / grounded checks while vy==0)?
export function groundBelow(map, b) {
  const ty = Math.floor((b.y + b.h + 1) / TILE), tx0 = Math.floor(b.x / TILE), tx1 = Math.floor((b.x + b.w - EPS) / TILE);
  for (let x = tx0; x <= tx1; x++) { const c = map.get(x, ty); if (c === '#' || c === 'B' || c === 'G' || (isPlank(c) && Math.abs(b.y + b.h - ty * TILE) < 2)) return c; }
  return null;
}
export function touchingWall(map, b, dir) {
  const tx = Math.floor((dir > 0 ? b.x + b.w + 1 : b.x - 1) / TILE);
  const ty0 = Math.floor((b.y + 6) / TILE), ty1 = Math.floor((b.y + b.h - 6) / TILE);
  for (let ty = ty0; ty <= ty1; ty++) if (map.solid(tx, ty)) return true; return false;
}
// Ray march through tiles for hook line-of-sight.
export function lineClear(map, x0, y0, x1, y1) {
  const d = Math.hypot(x1 - x0, y1 - y0), n = Math.ceil(d / 6);
  for (let i = 1; i < n; i++) { const t = i / n; if (map.solidPx(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t)) return false; }
  return true;
}
// Hazard overlap: thorns hurt in the lower part of the tile; smog pits the whole tile.
export function hazardAt(map, b) {
  const tx0 = Math.floor((b.x + 3) / TILE), tx1 = Math.floor((b.x + b.w - 3) / TILE), ty0 = Math.floor((b.y + 4) / TILE), ty1 = Math.floor((b.y + b.h - 1) / TILE);
  for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) {
    const c = map.get(tx, ty);
    if (c === '^' && b.y + b.h > ty * TILE + 9) return c;
    if (c === 'v' && b.y < (ty + 1) * TILE - 9) return c;
    if (c === '~' && b.y + b.h > ty * TILE + 6) return c;
  }
  return null;
}
// ---------------- v2.4 shared hook-swing integrator (the game AND the reach validator run exactly this) ----------------
export const SWING = {
  PUMP: 700, PUMP_BACK: 0.7, DRAG: 0.02, CAP: 580, ARC_MAX: 0.9, G_K: 1.3, // G_K: swing gravity scale (snappier pendulum now that the body moves once per step) // ARC_MAX: pumping fades out as the arc nears ~85° so the rope never goes slack and snaps at the top // pump along the rope tangent (with the motion = full, against = brake); near-lossless pendulum
  LEN_MIN: 56, AUTO_MIN: 64, AUTO_MAX: 118, AUTO_K: 0.7, LIFT_T: 0.35, LIFT_V: 480, AUTO_V: 150, REEL_IN: 260, REEL_OUT: 200, LEN_ACC: 4200, // reel (rate-limited + accel-limited => no snap)
  TAUT_KEEP: 0.35, POP_V: 240, POP_T: 0.12, // first taut frame: part of the radial speed turns into swing speed; ground attach lift spread over 0.12 s
  REL_VY: 240, REL_MIN: 430, REL_VX: 1.15, REL_K: 0.3, REL_MAX: 110, SWEET_VX: 1.28, // release: old launch + a speed-scaled boost; a forward up-swing release is a "sweet" launch
};
export function swingInit(b, ax, ay, ground, range = 230) {
  const cx = b.x + b.w / 2, l = Math.max(48, Math.hypot(cx - ax, b.y + 10 - ay));
  const s = { ax, ay, len: l, len0: l, lenV: 0, t: 0, pop: 0, taut: true, range };
  if (ground) { s.pop = SWING.POP_T; s.popX = Math.sign(ax - cx) * 40; s.popY = Math.max(0, b.vy + 40); } // lift ramps in over POP_T (no velocity step on the attach frame)
  return s;
}
// one fixed step; caller advances s.t. Returns { taut, crossed } (crossed = passed under the anchor this step)
export function swingStep(map, b, s, mx, my, dt) {
  const S = SWING, ax = s.ax, ay = s.ay, G = HERO.GRAV * S.G_K;
  if (s.pop > 0) { const k = Math.min(s.pop, dt) / S.POP_T; b.vy -= (S.POP_V + (s.popY || 0)) * k; b.vx += (s.popX || 0) * k; s.pop -= k * S.POP_T; }
  const want = my < 0 ? S.LEN_MIN : my > 0 ? s.range : Math.min(S.AUTO_MAX, Math.max(S.AUTO_MIN, s.len0 * S.AUTO_K));
  const rate = s.t < S.LIFT_T && s.len > want ? S.LIFT_V : my < 0 ? S.REEL_IN : my > 0 ? S.REEL_OUT : S.AUTO_V;
  const dv = Math.max(-rate, Math.min(rate, (want - s.len) * 10)); s.lenV += Math.max(-S.LEN_ACC * dt, Math.min(S.LEN_ACC * dt, dv - s.lenV));
  const lp = s.len; s.len = Math.max(S.LEN_MIN * 0.9, s.len + s.lenV * dt);
  const px0 = b.x + b.w / 2 - ax, py0 = b.y + 10 - ay, r0 = Math.hypot(px0, py0) || 1, ux0 = px0 / r0, uy0 = py0 / r0;
  if (mx && uy0 > 0) { const tx = -uy0, ty = ux0, vt = b.vx * tx + b.vy * ty, with_ = Math.sign(mx * tx) === Math.sign(vt) || Math.abs(vt) < 20, at = mx * S.PUMP * tx * (with_ ? 1 : S.PUMP_BACK), pe = G * (s.len - py0), e0 = 0.5 * (b.vx * b.vx + b.vy * b.vy) + pe; b.vx += tx * at * dt; b.vy += ty * at * dt;
    const eM = Math.max(e0, G * s.len * S.ARC_MAX), ke = 0.5 * (b.vx * b.vx + b.vy * b.vy); if (ke + pe > eM && ke > 1) { const k = Math.sqrt(Math.max(0, eM - pe) / ke); b.vx *= k; b.vy *= k; } } // pumping can't push the arc past ~85° (no slack + snap at the top)
  const dk = 1 - S.DRAG * dt; b.vx *= dk; b.vy *= dk;
  const wasTaut = s.taut, steady = Math.abs(s.lenV) < 2 && s.pop <= 0, E0 = 0.5 * (b.vx * b.vx + b.vy * b.vy) - G * b.y; // energy before gravity + constraint
  b.vy += G * dt;
  const mr = moveBody(map, b, dt);
  const nx = b.x + b.w / 2 - ax, ny = b.y + 10 - ay, nl = Math.hypot(nx, ny); let taut = false;
  if (nl > s.len) {
    const ux = nx / nl, uy = ny / nl; b.x = ax + ux * s.len - b.w / 2; b.y = ay + uy * s.len - 10; const vr = b.vx * ux + b.vy * uy;
    if (vr > 0) { b.vx -= vr * ux; b.vy -= vr * uy; if (!s.taut) { const tx = -uy, ty = ux, vt = b.vx * tx + b.vy * ty, sg = Math.abs(vt) > 5 ? Math.sign(vt) : (Math.sign(-nx) || 1) * Math.sign(tx || 1); b.vx += tx * sg * vr * S.TAUT_KEEP; b.vy += ty * sg * vr * S.TAUT_KEEP; } }
    if (s.len < lp && s.taut) { const tx = -uy, ty = ux, vt = b.vx * tx + b.vy * ty, k = Math.min(1.04, lp / s.len) - 1; b.vx += tx * vt * k; b.vy += ty * vt * k; } // reel-in conserves angular momentum
    taut = true;
  } else if (nl < s.len - 2) taut = false; else taut = s.taut;
  s.taut = taut;
  if (taut && wasTaut && steady && !mr.ground && !mr.wallL && !mr.wallR && !mr.ceil) { // v2.4: symplectic-ish correction — the projection would bleed ~10%/swing; restore the pre-step energy along the tangent
    const ke = 0.5 * (b.vx * b.vx + b.vy * b.vy), want = E0 + G * b.y; if (ke > 1 && want > 0) { const k = Math.max(0.97, Math.min(1.03, Math.sqrt(want / ke))); b.vx *= k; b.vy *= k; } }
  const sp = Math.hypot(b.vx, b.vy); if (sp > S.CAP) { const k = Math.max(S.CAP / sp, 1 - 4 * dt); b.vx *= k; b.vy *= k; }
  const crossed = Math.sign(px0) !== Math.sign(nx) && ny > 0; return { taut, crossed };
}
// release from a swing. boost = jump release. Mutates b's velocity; returns { sweet }
export function swingRelease(b, s, boost) {
  if (!boost) return { sweet: false };
  const S = SWING, sp = Math.hypot(b.vx, b.vy), cx = b.x + b.w / 2;
  const sweet = b.vy < -60 && Math.abs(b.vx) > 180 && Math.sign(cx - s.ax) === Math.sign(b.vx) && Math.abs(cx - s.ax) > s.len * 0.25;
  b.vy = Math.min(b.vy - S.REL_VY - Math.min(S.REL_MAX, S.REL_K * Math.max(0, sp - 220)), -S.REL_MIN); b.vx *= sweet ? S.SWEET_VX : S.REL_VX;
  return { sweet };
}
