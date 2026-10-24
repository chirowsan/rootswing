// Tile map + run generator that stitches handmade chunks into one connected biome.
import { TILE, makeRng } from './util.js';
import { CHUNKS as BASE } from './chunks.js';
import { CHUNKS2 } from './chunks2.js';
const CHUNKS = [...BASE, ...CHUNKS2];
export const CW = 34, CH = 20;
export class TileMap {
  constructor(w, h, fill = '#') { this.w = w; this.h = h; this.t = new Array(w * h).fill(fill); this.version = 0; }
  get(x, y) { if (x < 0 || y < 0 || x >= this.w || y >= this.h) return '#'; return this.t[y * this.w + x]; }
  set(x, y, c) { if (x < 0 || y < 0 || x >= this.w || y >= this.h) return; this.t[y * this.w + x] = c; this.version++; }
  solid(x, y) { const c = this.get(x, y); return c === '#' || c === 'B' || c === 'G'; }
  solidPx(px, py) { return this.solid(Math.floor(px / TILE), Math.floor(py / TILE)); }
  hazard(x, y) { const c = this.get(x, y); return c === '^' || c === 'v' || c === '~'; }
}
const ENTITY_CHARS = 'ozefthkbjcgFWLPDMdq1234567XwysS';
function flipRows(rows) { return rows.map((r) => r.split('').reverse().join('')); }
function flipExits(ex) { return ex.replace(/L/g, 'x').replace(/R/g, 'L').replace(/x/g, 'R'); }
function variants(ch) { const v = [{ ch, rows: ch.rows, exits: ch.exits, flip: false }]; v.push({ ch, rows: flipRows(ch.rows), exits: flipExits(ch.exits), flip: true }); return v; }

// Build a fixed layout (tutorial, hub, boss room) into a map + spawn list.
export function buildFixed(rows) {
  const h = rows.length, w = rows[0].length, map = new TileMap(w, h, '.'); const spawns = [];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const c = rows[y][x] || '#';
    if (ENTITY_CHARS.includes(c)) { spawns.push({ c, x, y, cell: null }); map.t[y * w + x] = '.'; } else map.t[y * w + x] = c;
  }
  return { map, spawns, cells: [], gw: 0, gh: 0 };
}


// v1.3 big-map generator: a serpentine main path (~34 rooms) on a 12x8 grid with checkpoint shrines, a mid-biome
// mini-boss arena, wide (2x1) and tall (1x2) rooms, 1-2 drop shortcuts and ~12 side rooms (some two rooms deep).
export const GW = 12, GH = 8;
const BACK = { L: 'R', R: 'L', U: 'D', D: 'U' }, STEP = { L: [-1, 0], R: [1, 0], U: [0, -1], D: [0, 1] };
export function generateRun(seed, biome = 'overpass') {
  const rng = makeRng(seed);
  for (let attempt = 0; attempt < 200; attempt++) {
    const res = tryGenerate(rng, biome); if (res) { res.seed = seed; res.biome = biome; res.attempts = attempt + 1; return res; }
  }
  throw new Error('generator failed');
}
const allowed = (c, biome) => !c.tags.includes('cav') || biome === 'caverns';
function tryGenerate(rng, biome) {
  const grid = new Map(), key = (x, y) => x + ',' + y;
  const target = rng.int(32, 36), mbIndex = Math.floor(target * 0.5);
  const cps = [10, 21, 31].filter((i) => i < target - 2 && Math.abs(i - mbIndex) > 2);
  const forced = new Set([1, mbIndex, mbIndex + 1, ...cps, ...cps.map((i) => i + 1)]);
  let x = 0, y = 0, hd = 1, inRow = 0; const path = [{ x, y }];
  grid.set(key(x, y), { x, y, need: new Set(), kind: 'start', depth: 0 });
  while (path.length < target) {
    const i = path.length, canH = x + hd >= 0 && x + hd < GW, canD = y + 1 < GH, prevD = path.length > 1 && path[i - 1].y !== path[i - 2].y;
    let dir;
    if (forced.has(i) || prevD || i === 1) dir = canH ? 'H' : null;
    else if (!canH) dir = canD ? 'D' : null;
    else if (canD && inRow >= 3 && rng.chance(inRow >= 6 ? 0.55 : 0.28)) dir = 'D';
    else dir = 'H';
    if (!dir) return null;
    const prev = grid.get(key(x, y)); let into;
    if (dir === 'H') { const d = hd > 0 ? 'R' : 'L'; prev.need.add(d); x += hd; into = BACK[d]; inRow++; }
    else { prev.need.add('D'); y++; into = 'U'; hd = -hd; inRow = 0; }
    if (grid.has(key(x, y))) return null;
    const cell = { x, y, need: new Set([into]), kind: 'normal', depth: i }; grid.set(key(x, y), cell); path.push({ x, y });
  }
  const cells = path.map((p) => grid.get(key(p.x, p.y)));
  const last = cells[cells.length - 1]; if (last.need.has('R')) return null; last.kind = 'exit';
  const mb = cells[mbIndex]; if (!(mb.need.size === 2 && !mb.need.has('U') && !mb.need.has('D'))) return null; mb.kind = 'miniboss';
  for (const i of cps) { const c = cells[i]; if (c.need.has('U') || c.need.has('D')) return null; c.kind = 'checkpoint'; }
  const free = (c) => c.kind === 'normal' && !c.pair;
  // multi-cell rooms: 2 wide pairs + up to 2 tall pairs
  let wides = 0;
  for (const i of rng.shuffle([...Array(cells.length - 3).keys()].map((k) => k + 2))) {
    if (wides >= 2) break; const a = cells[i], b = cells[i + 1];
    if (!free(a) || !free(b) || a.y !== b.y || [...a.need, ...b.need].some((e) => e === 'U' || e === 'D') || a.need.size !== 2 || b.need.size !== 2) continue;
    const flip = b.x < a.x, pair = rng.pick(CHUNKS.filter((c) => c.tags.includes('wideA'))), B = CHUNKS.find((c) => c.id === pair.id.replace('A', 'B'));
    a.pair = b; b.pair = a; a.forced = flip ? { ch: pair, rows: flipRows(pair.rows), exits: 'LR', flip: true } : { ch: pair, rows: pair.rows, exits: 'LR', flip: false };
    b.forced = flip ? { ch: B, rows: flipRows(B.rows), exits: 'LR', flip: true } : { ch: B, rows: B.rows, exits: 'LR', flip: false }; wides++;
  }
  let talls = 0;
  for (const i of rng.shuffle([...Array(cells.length - 2).keys()].map((k) => k + 1))) {
    if (talls >= 2) break; const a = cells[i], b = cells[i + 1];
    if (!free(a) || !free(b) || b.y !== a.y + 1 || a.need.size !== 2 || b.need.size !== 2) continue;
    const side = a.need.has('L') ? 'L' : 'R'; if (!b.need.has(side)) continue;
    const A = CHUNKS.find((c) => c.id === 'tallA'), B = CHUNKS.find((c) => c.id === 'tallB'), fl = side === 'R';
    a.pair = b; b.pair = a; a.tall = b.tall = true;
    a.forced = { ch: A, rows: fl ? flipRows(A.rows) : A.rows, exits: fl ? 'RD' : 'LD', flip: fl }; b.forced = { ch: B, rows: fl ? flipRows(B.rows) : B.rows, exits: fl ? 'UR' : 'UL', flip: fl }; talls++;
  }
  // drop shortcuts between vertically adjacent path rooms far apart on the path
  let cuts = 0;
  for (const a of rng.shuffle(cells.slice())) {
    if (cuts >= 2) break; const b = grid.get(key(a.x, a.y + 1));
    if (!b || b.branch || !free(a) || !free(b) || b.depth - a.depth < 5 || a.need.has('D') || b.need.has('U')) continue;
    if (!pickChunk(rng, new Set([...a.need, 'D']), 'normal', new Map(), true, biome) || !pickChunk(rng, new Set([...b.need, 'U']), 'normal', new Map(), true, biome)) continue;
    a.need.add('D'); b.need.add('U'); a.cut = 'D'; b.cut = 'U'; cuts++;
  }
  // side rooms: dead ends (some two rooms deep through a normal room)
  const wants = rng.shuffle(['fountain', 'fountain', 'weapon', 'secret', 'treasure', 'treasure', 'treasure', 'treasure', 'treasure', 'secret', 'treasure', 'weapon']);
  let placed = 0;
  const deadOpts = (want, back) => {
    const pool = CHUNKS.filter((c) => c.exits.length === 1 && allowed(c, biome) && (want === 'fountain' ? c.tags.includes('fountain') : want === 'weapon' ? c.tags.includes('weapon') : c.tags.includes('treasure') || c.tags.includes('secret')));
    const o = []; for (const c of pool) for (const v of variants(c)) if (v.exits === back) o.push(v); return o;
  };
  const inGrid = (nx, ny) => nx >= 0 && ny >= 0 && nx < GW && ny < GH && !grid.has(key(nx, ny));
  for (const want of wants) {
    let ok = false;
    for (let tries = 0; tries < 40 && !ok; tries++) {
      const host = cells[rng.int(1, cells.length - 2)]; if (!free(host) || host.need.size >= 3) continue;
      for (const d of rng.shuffle(['L', 'R', 'U', 'D'])) {
        if (host.need.has(d)) continue; const [dx, dy] = STEP[d], nx = host.x + dx, ny = host.y + dy; if (!inGrid(nx, ny)) continue;
        const hostNeed = new Set([...host.need, d]); if (!pickChunk(rng, hostNeed, 'normal', new Map(), true, biome)) continue;
        const deep = rng.chance(0.4) && want !== 'secret';
        if (deep) { // corridor room + dead end beyond it
          let done = false;
          for (const d2 of rng.shuffle(['L', 'R', 'U', 'D'])) {
            if (d2 === BACK[d]) continue; const [ex, ey] = STEP[d2], fx = nx + ex, fy = ny + ey; if (!inGrid(fx, fy)) continue;
            const midNeed = new Set([BACK[d], d2]); if (!pickChunk(rng, midNeed, 'normal', new Map(), true, biome)) continue;
            const opts = deadOpts(want, BACK[d2]); if (!opts.length) continue;
            host.need.add(d); grid.set(key(nx, ny), { x: nx, y: ny, need: midNeed, kind: 'normal', depth: host.depth + 1, branch: true, side: true });
            grid.set(key(fx, fy), { x: fx, y: fy, need: new Set([BACK[d2]]), kind: 'dead', want, variant: rng.pick(opts), depth: host.depth + 1, branch: true }); done = true; break;
          }
          if (done) { ok = true; break; }
        }
        const opts = deadOpts(want, BACK[d]); if (!opts.length) continue;
        host.need.add(d); if (want === 'secret') host.secret = d;
        grid.set(key(nx, ny), { x: nx, y: ny, need: new Set([BACK[d]]), kind: 'dead', want, variant: rng.pick(opts), depth: host.depth, branch: true }); ok = true; break;
      }
    }
    if (ok) placed++;
  }
  if (placed < 9) return null;
  const used = new Map(), all = [...grid.values()];
  for (const c of all) {
    if (c.kind === 'dead') continue;
    if (c.forced) { c.variant = c.forced; continue; }
    const v = pickChunk(rng, c.need, c.kind, used, false, biome); if (!v) return null; c.variant = v; used.set(v.ch.id, (used.get(v.ch.id) || 0) + 1);
  }
  const res = assemble(all, rng);
  res.path = cells.length; res.checkpoints = cps; res.mbIndex = mbIndex; return res;
}
function pickChunk(rng, need, kind, used, dry = false, biome = 'overpass') {
  const tag = { start: 'start', miniboss: 'miniboss', exit: 'exit', checkpoint: 'checkpoint' }[kind];
  const opts = [];
  for (const c of CHUNKS) {
    if (!allowed(c, biome)) continue;
    if (tag ? !c.tags.includes(tag) : !(c.tags.includes('combat') || c.tags.includes('platform'))) continue;
    if (!tag && c.exits.length < 2) continue;
    if (kind === 'miniboss' && biome === 'caverns' && !c.tags.includes('cav')) continue;
    for (const v of variants(c)) {
      if (kind === 'start' && v.flip) continue;
      if ([...need].every((e) => v.exits.includes(e))) { const extra = v.exits.length - need.size; opts.push({ v, w: (1 / (1 + (used.get(c.id) || 0) * 3)) * (extra === 0 ? 2 : 1) * (biome === 'caverns' && c.tags.includes('cav') ? 2.5 : 1) }); }
    }
  }
  if (!opts.length) return null; if (dry) return true;
  let tot = opts.reduce((s, o) => s + o.w, 0), r = rng() * tot; for (const o of opts) { r -= o.w; if (r <= 0) return o.v; } return opts[opts.length - 1].v;
}
function assemble(cells, rng) {
  const map = new TileMap(GW * CW, GH * CH, '#'); const spawns = [];
  for (const c of cells) {
    const ox = c.x * CW, oy = c.y * CH, rows = c.variant.rows;
    for (let y = 0; y < CH; y++) for (let x = 0; x < CW; x++) map.t[(oy + y) * map.w + ox + x] = rows[y][x];
    for (const e of 'LRUD') {
      const has = c.variant.exits.includes(e), want = c.need.has(e); if (!has) continue;
      if (c.pair && !want) continue; // multi-cell rooms keep their own (open) joint
      const fill = want ? (c.secret === e ? 'B' : '.') : '#';
      if (e === 'L' || e === 'R') { const cx = e === 'L' ? 0 : CW - 1; for (let y = 14; y <= 17; y++) map.t[(oy + y) * map.w + ox + cx] = fill; if (fill === 'B') for (let y = 14; y <= 17; y++) map.t[(oy + y) * map.w + ox + (e === 'L' ? 1 : CW - 2)] = 'B'; }
      if (e === 'U') for (let x = 15; x <= 18; x++) map.t[oy * map.w + ox + x] = want ? '.' : '#';
      if (e === 'D') for (let x = 15; x <= 18; x++) for (let y = CH - 2; y < CH; y++) map.t[(oy + y) * map.w + ox + x] = want ? '.' : '#';
    }
    c.room = { x: ox * TILE, y: oy * TILE, w: CW * TILE, h: CH * TILE };
    c.id = c.variant.ch.id + (c.variant.flip ? '~f' : '');
  }
  // vertical door helpers: a hook bloom just under the top hole and one just above the floor hole, so U doors are climbable
  const at = (x, y) => map.t[y * map.w + x], put = (x, y) => { map.t[y * map.w + x] = 'z'; };
  for (const c of cells) if (c.need.has('U')) {
    const ox = c.x * CW, oy = c.y * CH, ly = [3, 2, 4, 5].find((y) => at(ox + 16, oy + y) === '.' && at(ox + 17, oy + y) === '.');
    if (ly !== undefined) put(ox + 16, oy + ly);
    const uy = oy - CH; const ry = [CH - 5, CH - 6, CH - 4, CH - 7].find((y) => at(ox + 17, uy + y) === '.' && at(ox + 16, uy + y) === '.');
    if (ry !== undefined) put(ox + 17, uy + ry);
  }
  for (const c of cells) if (c.pair) { const a = c.room, b = c.pair.room, x = Math.min(a.x, b.x), y = Math.min(a.y, b.y); c.room = { x, y, w: Math.max(a.x + a.w, b.x + b.w) - x, h: Math.max(a.y + a.h, b.y + b.h) - y }; }
  for (const c of cells) {
    const ox = c.x * CW, oy = c.y * CH;
    for (let y = 0; y < CH; y++) for (let x = 0; x < CW; x++) {
      const i = (oy + y) * map.w + ox + x, ch = map.t[i];
      if (ENTITY_CHARS.includes(ch)) { map.t[i] = '.'; spawns.push({ c: ch, x: ox + x, y: oy + y, cell: c }); }
    }
  }
  // order: main path first (index = path position), then side rooms
  const main = cells.filter((c) => !c.branch).sort((a, b) => a.depth - b.depth), side = cells.filter((c) => c.branch);
  return { map, spawns, cells: [...main, ...side], gw: GW, gh: GH };
}
