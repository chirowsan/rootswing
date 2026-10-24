// v1.5 reachability validator: simulates Sprig's real movement (same constants + the same moveBody collision as the game)
// to prove a map is completable. Moves explored from every standing spot: walk, walk off ledges, jumps (full / short hop,
// left / straight / right, with or without a mid-air dash at a few timings), dropping through planks, and grappling
// (zip pulls with jump-off or fall-off, swings pumped either way with release at many points, re-hooking chains).
// No wall-jumps, no enemies-as-hook-targets, no coyote time: a "pass" therefore never relies on expert tech.
import { moveBody, lineClear, hazardAt, HERO as C, isPlank } from './physics.js';
import { TILE } from './util.js';
const DT = 1 / 60, BW = 18, BH = 34, HOOK_R = 220;
const approach = (v, t, d) => (v < t ? Math.min(v + d, t) : Math.max(v - d, t));
const sgn = (v) => (v > 0 ? 1 : v < 0 ? -1 : 0);
const groundUnder = (map, b) => { const ty = Math.floor((b.y + BH + 1) / TILE); for (let x = Math.floor(b.x / TILE), x1 = Math.floor((b.x + BW - 0.001) / TILE); x <= x1; x++) { const c = map.get(x, ty); if (c === '#' || c === 'B' || c === 'G' || (isPlank(c) && Math.abs(b.y + BH - ty * TILE) < 2)) return c; } return null; };
const bodyFree = (map, x, y) => { for (let tx = Math.floor(x / TILE); tx <= Math.floor((x + BW - 0.001) / TILE); tx++) for (let ty = Math.floor(y / TILE); ty <= Math.floor((y + BH - 0.001) / TILE); ty++) if (map.solid(tx, ty)) return false; return true; };

export function explore(map, anchors, start, opts = {}) {
  const maxStands = opts.maxStands || 40000, R = opts.hookRange || HOOK_R;
  const flyMemo = new Set(); const link = (a, b) => { if (!a) return; if (!edges.has(a)) edges.set(a, new Set()); edges.get(a).add(b); };
  const stands = new Map(), queue = [], edges = new Map(), covered = new Set(), hookMemo = new Set();
  const aGrid = new Map(); for (const a of anchors) { const k = Math.floor(a.x / 240) + ',' + Math.floor(a.y / 240); if (!aGrid.has(k)) aGrid.set(k, []); aGrid.get(k).push(a); }
  const near = (x, y) => { const out = [], gx = Math.floor(x / 240), gy = Math.floor(y / 240); for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) { const l = aGrid.get(gx + i + ',' + (gy + j)); if (l) out.push(...l); } return out; };
  let from = null, steps = 0, hooks = 0; const maxHooks = opts.maxHooks || 6000;
  const addStand = (b) => {
    const tx = Math.floor((b.x + BW / 2) / TILE), fy = Math.round((b.y + BH) / TILE), key = tx + ',' + fy;
    link(from, key);
    if (stands.has(key) || stands.size >= maxStands) return;
    let x = tx * TILE + TILE / 2 - BW / 2; const y = fy * TILE - BH; if (!bodyFree(map, x, y) || !groundUnder(map, { x, y })) x = b.x;
    stands.set(key, { x, y, key }); queue.push(key);
  };
  const cover = (b, set) => { for (let tx = Math.floor(b.x / TILE); tx <= Math.floor((b.x + BW) / TILE); tx++) for (let ty = Math.floor(b.y / TILE); ty <= Math.floor((b.y + BH) / TILE); ty++) set.push(tx + ty * map.w); };
  // free flight (player.update air branch). cfg: mx, hold (frames jump is held; Infinity = full), dashAt (frame) / dashDir
  function fly(b, cfg, t0 = 0) {
    const fk = 'F' + Math.round(b.x / 12) + ',' + Math.round(b.y / 12) + ',' + Math.round(b.vx / 60) + ',' + Math.round(b.vy / 60) + ',' + cfg.mx + ',' + (cfg.hold > 20 ? 'H' : cfg.hold) + ',' + (cfg.dashAt ?? '') + ',' + (cfg.drop ? 1 : 0);
    link(from, fk); if (flyMemo.has(fk)) return null; flyMemo.add(fk);
    const prev = from; from = fk; const out = fly0(b, cfg); from = prev; return out;
  }
  function fly0(b, cfg) {
    const tiles = []; let dashT = 0, held = cfg.hold ?? 0, drop = cfg.drop || 0;
    for (let f = 0; f < 240; f++) {
      steps++;
      if (cfg.dashAt === f) { dashT = C.DASH_T; }
      if (dashT > 0) { dashT -= DT; b.vx = cfg.dashDir * C.DASH; b.vy = 0; if (dashT <= 0) b.vx = cfg.dashDir * C.RUN * 0.9; }
      else {
        const target = cfg.mx * C.RUN;
        if (Math.abs(b.vx) > C.RUN && sgn(b.vx) === sgn(target || b.vx) && Math.abs(target) <= Math.abs(b.vx)) b.vx = approach(b.vx, target || sgn(b.vx) * C.RUN, (target ? 160 : 520) * DT);
        else b.vx = approach(b.vx, target, C.ACC_A * DT);
        const holding = f < held; let g = b.vy > 0 ? C.GRAV_FALL : C.GRAV; if (Math.abs(b.vy) < 70 && holding) g *= 0.6;
        b.vy = Math.min(b.vy + g * DT, C.MAXFALL);
        if (f === held && b.vy < 0 && !cfg.noCut) b.vy *= C.CUT;
      }
      const prevVx = b.vx, r = moveBody(map, b, DT, { drop: drop > 0, corner: b.vy < -120 }); drop -= DT;
      if (b.y > map.h * TILE || b.x < 0 || b.x > map.w * TILE) return null;
      if (hazardAt(map, b)) return null;
      cover(b, tiles);
      if (r.ground) { for (const t of tiles) covered.add(t); addStand(b); return b; }
      // ledge assist (player.tryMantle)
      if (dashT <= 0) { const dir = r.wallL ? -1 : r.wallR ? 1 : 0; if (dir && (cfg.mx === dir || Math.abs(prevVx) > 60) && b.vy > -260 && mantle(b, dir)) { for (const t of tiles) covered.add(t); addStand(b); return b; } }
      if (f % 6 === 3) tryHooks(b, cfg.mx, tiles, null);
    }
    return null;
  }
  function mantle(b, dir) {
    const tx = Math.floor((dir > 0 ? b.x + BW + 2 : b.x - 2) / TILE), feet = b.y + BH;
    for (let ty = Math.floor((feet - 34) / TILE); ty <= Math.floor((feet + 4) / TILE); ty++) {
      const top = ty * TILE; if (top < feet - 34 || top > feet + 4) continue;
      if (map.solid(tx, ty) && !map.solid(tx, ty - 1) && !map.solid(tx, ty - 2) && !map.solid(Math.floor((b.x + BW / 2) / TILE), Math.floor((top - BH) / TILE))) { b.y = top - BH; b.x += dir * 6; if (!bodyFree(map, b.x, b.y)) return false; return true; }
    }
    return false;
  }
  function tryHooks(b, mx, tiles, cur) {
    const ox = b.x + BW / 2, oy = b.y + 10;
    for (const a of near(ox, oy)) {
      if (a === cur) continue; const d = Math.hypot(a.x - ox, a.y - oy); if (d > R || d < 18) continue;
      const rx = ox - a.x, ry = oy - a.y, vt = (b.vx * -ry + b.vy * rx) / d;
      const k = a.x + ',' + a.y + '|' + Math.round(rx / 60) + ',' + Math.round(ry / 60) + ',' + (a.kind === 'zip' ? 0 : Math.round(vt / 250));
      if (hookMemo.has(k)) { link(from, 'H' + k); continue; } if (!lineClear(map, ox, oy, a.x, a.y)) continue; hookMemo.add(k); link(from, 'H' + k);
      pending.push({ b: { ...b }, a, tiles: tiles.slice(-60), from: 'H' + k });
    }
  }
  const pending = [];
  function hook(st) {
    const a = st.a; const tiles = st.tiles.slice();
    for (const mx of [-1, 0, 1]) {
      const b = { ...st.b, w: BW, h: BH }; let hx = b.x + BW / 2, hy = b.y + 10, ok = true;
      // hook head flight (1600 px/s) while Sprig keeps falling
      for (let f = 0; f < 30; f++) {
        const dx = a.x - hx, dy = a.y - hy, d = Math.hypot(dx, dy), sp = 1600 * DT; if (d <= sp) break; hx += dx / d * sp; hy += dy / d * sp;
        b.vx = approach(b.vx, mx * C.RUN, C.ACC_A * DT); b.vy = Math.min(b.vy + C.GRAV * DT, C.MAXFALL); const r = moveBody(map, b, DT); steps++;
        if (hazardAt(map, b)) { ok = false; break; } cover(b, tiles); if (r.ground) break;
      }
      if (!ok) continue;
      if (a.kind === 'zip') { if (mx === 0) zip(b, a, tiles); }
      else if (mx) swing(b, a, mx, tiles);
    }
  }
  function zip(b, a, tiles) {
    let v0 = null;
    for (let t = 0; t < 0.95; t += DT) {
      const dx = a.x - (b.x + BW / 2), dy = a.y - (b.y + 12), d = Math.hypot(dx, dy);
      if (v0 == null) v0 = Math.max(120, (b.vx * dx + b.vy * dy) / (d || 1));
      const sp = Math.min(640, v0 + t * 2600) * Math.max(0.5, Math.min(1, d / 70)); b.vx = dx / (d || 1) * sp; b.vy = dy / (d || 1) * sp;
      if (d < 20) break;
      const r = moveBody(map, b, DT, { corner: b.vy < -120 }); steps++; if (hazardAt(map, b)) return; cover(b, tiles); if (r.ceil) break;
      if (t > 0.12 && Math.hypot(b.vx, b.vy) < 1) break;
    }
    b.vx *= 0.75; b.vy = Math.min(b.vy * 0.75, -200);
    for (const t of tiles) covered.add(t);
    for (const mx of [-1, 0, 1]) {
      fly({ ...b, vy: -C.JUMP }, { mx, hold: 999 }); // jump straight off the bloom (freeJump)
      if (mx) fly({ ...b, vy: -C.JUMP }, { mx, hold: 999, dashAt: 14, dashDir: mx });
      fly({ ...b }, { mx, hold: 0, noCut: true });
    }
  }
  function swing(b, a, pump, tiles) {
    let len = Math.max(48, Math.hypot(b.x + BW / 2 - a.x, b.y + 10 - a.y)); const len0 = len;
    if (groundUnder(map, b)) { b.vy = Math.min(b.vy, -40) - 3000 * 0.08; b.vx += sgn(a.x - b.x - BW / 2) * 40; }
    for (let f = 0; f < 160; f++) {
      const t = f * DT, want = Math.min(118, Math.max(64, len0 * 0.7));
      len = approach(len, want, (t < 0.35 && len > want ? 480 : 150) * DT);
      b.vy += C.GRAV * DT; b.vx += pump * 520 * DT; b.vx *= 1 - 0.15 * DT;
      moveBody(map, b, DT); steps++;
      const nx = b.x + BW / 2 - a.x, ny = b.y + 10 - a.y, nl = Math.hypot(nx, ny);
      if (nl > len) { const ux = nx / nl, uy = ny / nl; b.x = a.x + ux * len - BW / 2; b.y = a.y + uy * len - 10; const vr = b.vx * ux + b.vy * uy; if (vr > 0) { b.vx -= vr * ux; b.vy -= vr * uy; } }
      const sp = Math.hypot(b.vx, b.vy); if (sp > 560) { const k = Math.max(560 / sp, 1 - 4 * DT); b.vx *= k; b.vy *= k; }
      if (hazardAt(map, b) || !bodyFree(map, b.x, b.y)) return;
      cover(b, tiles);
      if (t > 0.25 && groundUnder(map, b) && Math.abs(b.vx) < 30) { for (const q of tiles) covered.add(q); addStand(b); return; }
      if (f >= 10 && f % 8 === 2) {
        for (const q of tiles) covered.add(q);
        const rel = { ...b }; rel.vy = Math.min(rel.vy - 240, -430); rel.vx *= 1.15; // jump release boost
        fly({ ...rel }, { mx: pump, hold: 999, noCut: true }); fly({ ...rel }, { mx: 0, hold: 999, noCut: true });
        if (f % 16 === 2) { fly({ ...rel }, { mx: pump, hold: 999, noCut: true, dashAt: 10, dashDir: pump }); tryHooks(b, pump, tiles, a); }
      }
    }
  }
  // start: either a standing spot or a custom state (e.g. just arrived at a door bloom)
  if (start.zipArrive) { const b = { x: start.x - BW / 2, y: start.y - 12, vx: 0, vy: -200, w: BW, h: BH }; for (const mx of [-1, 0, 1]) { fly({ ...b, vy: -C.JUMP }, { mx, hold: 999 }); fly({ ...b }, { mx, hold: 0, noCut: true }); } }
  else { const b = { x: start.x - BW / 2, y: start.y - BH, vx: 0, vy: 0, w: BW, h: BH }; if (groundUnder(map, b)) addStand(b); else fly(b, { mx: 0, hold: 0, noCut: true }); }
  const JUMPS = [];
  for (const mx of [-1, 0, 1]) for (const run of mx ? [0, 1] : [0]) for (const hold of [999, 7]) {
    JUMPS.push({ mx, run, hold });
    if (mx && hold === 999) for (const dashAt of [8, 20, 32]) JUMPS.push({ mx, run, hold, dashAt, dashDir: mx });
  }
  while (queue.length || pending.length) {
    if (!queue.length) { const p = pending.pop(); from = p.from; if (++hooks <= maxHooks) hook(p); continue; }
    const key = queue.shift(), s = stands.get(key); from = key;
    covered.add(Math.floor((s.x + BW / 2) / TILE) + Math.floor((s.y + BH / 2) / TILE) * map.w); covered.add(Math.floor((s.x + BW / 2) / TILE) + Math.floor((s.y + 4) / TILE) * map.w);
    // walk one tile either way, or walk off the edge
    for (const d of [-1, 1]) {
      const b = { x: s.x, y: s.y, vx: d * TILE / DT, vy: 0, w: BW, h: BH }; moveBody(map, b, DT); if (Math.abs(b.x - s.x) < 4) continue;
      if (hazardAt(map, b)) continue;
      if (groundUnder(map, b)) addStand(b);
      else for (const mx of [d, 0, -d]) fly({ ...b, vx: d * C.RUN }, { mx, hold: 0, noCut: true });
    }
    for (const j of JUMPS) fly({ x: s.x, y: s.y, vx: j.run ? j.mx * C.RUN : 0, vy: -C.JUMP, w: BW, h: BH }, j);
    const under = map.get(Math.floor((s.x + BW / 2) / TILE), Math.floor((s.y + BH + 2) / TILE));
    if (isPlank(under)) for (const mx of [-1, 0, 1]) fly({ x: s.x, y: s.y + 2, vx: 0, vy: 0, w: BW, h: BH }, { mx, hold: 0, noCut: true, drop: 0.25 });
    tryHooks({ x: s.x, y: s.y, vx: 0, vy: 0 }, 0, [], null);
  }
  return { stands, edges, covered, steps, hooks };
}
// stands that can still reach one of the goal stands (reverse BFS over the recorded move edges)
export function canReach(res, goalKeys) {
  const rev = new Map(); for (const [a, set] of res.edges) for (const b of set) { if (!rev.has(b)) rev.set(b, []); rev.get(b).push(a); }
  const ok = new Set(goalKeys), q = [...goalKeys]; while (q.length) { const k = q.pop(); for (const a of rev.get(k) || []) if (!ok.has(a)) { ok.add(a); q.push(a); } }
  return ok;
}
export const tileCovered = (res, map, x, y, r = 0) => { for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) if (res.covered.has(x + dx + (y + dy) * map.w)) return true; return false; };
