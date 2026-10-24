// v1.6 "nothing floats": every one-way plank run, crumbling branch, swing/zip anchor, trap mount and detached solid
// island gets a support chain that ends on permanent ground ('#'/'G'), the map edge, or (for stacked branches) a lower
// plank run that is itself supported. The painter draws exactly these chains, and the test audits them.
export const TILE_PX = 24;
const PERM = (c) => c === '#' || c === 'G';
const PLANK = (c) => c === '=' || c === 'u';
const GMAX = 9, CMAX = 7, AMAX = 11, WMAX = 5;
export function computeSupports(map, anchors = [], traps = []) {
  const W = map.w, H = map.h, at = (x, y) => map.get(x, y), out = (x, y) => x < 0 || y < 0 || x >= W || y >= H;
  const pieces = [], runOf = new Map();
  // plank runs ('=' and crumbling 'u')
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (!PLANK(at(x, y)) || PLANK(at(x - 1, y))) continue; let e = x; while (PLANK(at(e + 1, y))) e++;
    const p = { id: 'p' + pieces.length, kind: 'plank', x0: x, x1: e, y, crumble: at(x, y) === 'u' }; pieces.push(p); for (let i = x; i <= e; i++) runOf.set(i + ',' + y, p);
  }
  // scan straight down from (x, y) through air/planks of other runs: first permanent solid, first other plank, or the edge
  const down = (x, y, self) => { for (let yy = y; ; yy++) { if (out(x, yy)) return { tx: x, ty: yy, on: 'edge', d: yy - y }; const c = at(x, yy); if (PERM(c)) return { tx: x, ty: yy, on: 'solid', d: yy - y }; const r = runOf.get(x + ',' + yy); if (r && r !== self) return { tx: x, ty: yy, on: 'plank', ref: r.id, d: yy - y }; } };
  const up = (x, y) => { for (let yy = y; ; yy--) { if (out(x, yy)) return { tx: x, ty: yy, on: 'edge', d: y - yy }; if (PERM(at(x, yy))) return { tx: x, ty: yy, on: 'solid', d: y - yy }; } };
  const runSupport = (x0, x1, y, self, endCols) => {
    const wl = PERM(at(x0 - 1, y)), wr = PERM(at(x1 + 1, y));
    if (wl || wr) { const ends = []; if (wl) ends.push({ tx: x0 - 1, ty: y, on: 'solid' }); if (wr) ends.push({ tx: x1 + 1, ty: y, on: 'solid' }); return { type: wl && wr ? 'log' : 'wall', ends, side: wl && wr ? 0 : wl ? -1 : 1 }; }
    const n = x1 - x0 + 1, cols = endCols ? [x0, x1] : n <= 3 ? [(x0 + x1) >> 1] : [x0 + 1, x1 - 1];
    const g = cols.map((c) => down(c, y + 1, self)), gd = Math.max(...g.map((e) => e.d));
    const v = [x0, x1].map((c) => up(c, y - 1)), vd = Math.max(...v.map((e) => e.d));
    if (gd <= GMAX && g.every((e) => e.on !== 'edge')) return { type: 'trunk', ends: g, cols };
    if (vd <= CMAX && v.every((e) => e.on === 'solid')) return { type: 'vines', ends: v, cols: [x0, x1] };
    if (g.every((e) => e.on !== 'edge') || gd <= vd + 4) return { type: 'trunk', ends: g, cols };
    return { type: 'vines', ends: v, cols: [x0, x1] };
  };
  for (const p of pieces.slice()) p.sup = runSupport(p.x0, p.x1, p.y, p);
  // detached solid islands (not connected to the border through solids)
  const sol = (x, y) => { const c = at(x, y); return c === '#' || c === 'G' || c === 'B'; }, seen = new Uint8Array(W * H), q = [];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if ((x === 0 || y === 0 || x === W - 1 || y === H - 1) && sol(x, y)) { seen[y * W + x] = 1; q.push(x, y); }
  const flood = (q, mark, list) => { while (q.length) { const y = q.pop(), x = q.pop(); if (list) list.push([x, y]); for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + dx, ny = y + dy; if (out(nx, ny) || seen[ny * W + nx] || !sol(nx, ny)) continue; seen[ny * W + nx] = mark; q.push(nx, ny); } } };
  flood(q, 1);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (sol(x, y) && !seen[y * W + x]) {
    seen[y * W + x] = 2; const tiles = []; flood([x, y], 2, tiles);
    const by = Math.max(...tiles.map((t) => t[1])), bot = tiles.filter((t) => t[1] === by).map((t) => t[0]), x0 = Math.min(...bot), x1 = Math.max(...bot);
    const n = x1 - x0 + 1, cols = n <= 2 ? [x0] : [x0, x1].filter((c, i, a) => a.indexOf(c) === i), g = cols.map((c) => down(c, by + 1, null));
    pieces.push({ id: 'i' + pieces.length, kind: 'island', x0, x1, y: by, n: tiles.length, sup: { type: 'trunk', ends: g, cols, island: true } });
  }
  // anchors: vine to the canopy above, else a branch from the nearest wall, else a long vine to the canopy/edge
  for (const a of anchors) {
    const tx = Math.floor(a.x / TILE_PX), ty = Math.floor(a.y / TILE_PX), p = { id: 'a' + pieces.length, kind: 'anchor', ax: a.x, ay: a.y, x0: tx, x1: tx, y: ty, sub: a.kind };
    let u = null; for (let yy = ty - 1; ; yy--) { if (out(tx, yy)) { u = { tx, ty: yy, on: 'edge', d: ty - yy }; break; } if (PERM(at(tx, yy))) { u = { tx, ty: yy, on: 'solid', d: ty - yy }; break; } const r = runOf.get(tx + ',' + yy); if (r) { u = { tx, ty: yy, on: 'plank', ref: r.id, d: ty - yy }; break; } }
    if (u.d <= AMAX) p.sup = { type: 'vine', ends: [u] };
    else { let w = null; for (let d = 1; d <= WMAX && !w; d++) for (const s of [-1, 1]) { const xx = tx + s * d; let clear = true; for (let k = 1; k < d; k++) if (at(tx + s * k, ty) !== '.' && at(tx + s * k, ty) !== ' ') clear = false; if (clear && PERM(at(xx, ty))) { w = { tx: xx, ty, on: 'solid', d }; break; } }
      p.sup = w ? { type: 'branch', ends: [w], side: Math.sign(w.tx - tx) } : { type: 'vine', ends: [u] }; }
    pieces.push(p);
  }
  // trap mounts
  for (const t of traps) {
    if (t.k === 'crumble') continue; const p = { id: 't' + pieces.length, kind: 'trap', sub: t.k, x0: t.x, x1: t.k === 'saw' ? t.x2 : t.x, y: t.y };
    if (t.k === 'shooter') p.sup = { type: 'embedded', ends: [{ tx: t.x, ty: t.y, on: PERM(at(t.x, t.y)) ? 'solid' : 'none' }] };
    else if (t.k === 'spike' || t.k === 'vent') { const f = down(t.x, t.y + 1, null); p.sup = f.d === 0 ? { type: 'floor', ends: [f] } : { type: 'trunk', ends: [f], cols: [t.x] }; }
    else if (t.k === 'crusher') p.sup = { type: 'rope', ends: [up(t.x, t.y - 1)] };
    else if (t.k === 'saw') p.sup = runSupport(t.x, t.x2, t.y, null, true);
    else if (t.k === 'pendulum' || t.k === 'stalactite') p.sup = { type: 'rope', ends: [up(t.x, t.y - 1)] }; // v2.0 trap pack
    else if (t.k === 'vine' || t.k === 'spore' || t.k === 'roller' || t.k === 'gate') { const f = down(t.x, t.y + 1, null); p.sup = f.d === 0 ? { type: 'floor', ends: [f] } : { type: 'trunk', ends: [f], cols: [t.x] }; }
    pieces.push(p);
  }
  const byId = new Map(pieces.map((p) => [p.id, p]));
  return { pieces, byId, drawn: new Set() };
}
// audit: every piece resolves (recursively, acyclic) to permanent ground or the map edge
export function auditSupports(map, sup) {
  const bad = [], ok = new Map();
  const resolve = (p, stack = new Set()) => {
    if (ok.has(p.id)) return ok.get(p.id); if (stack.has(p.id)) return false; stack.add(p.id);
    let r = !!(p.sup && p.sup.ends && p.sup.ends.length);
    if (r) for (const e of p.sup.ends) {
      const oob = e.tx < 0 || e.ty < 0 || e.tx >= map.w || e.ty >= map.h, c = map.get(e.tx, e.ty);
      if (e.on === 'edge') r = r && oob; else if (e.on === 'solid') r = r && (c === '#' || c === 'G'); else if (e.on === 'plank') { const q = sup.byId.get(e.ref); r = r && !!q && resolve(q, stack); } else r = false;
    }
    stack.delete(p.id); ok.set(p.id, r); return r;
  };
  for (const p of sup.pieces) if (!resolve(p)) bad.push(p);
  return bad;
}
