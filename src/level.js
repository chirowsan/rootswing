// Tile map + run generator that stitches handmade chunks into one connected biome.
import { TILE, makeRng } from './util.js';
import { CHUNKS } from './chunks.js';
export const CW = 34, CH = 20;
export class TileMap {
  constructor(w, h, fill = '#') { this.w = w; this.h = h; this.t = new Array(w * h).fill(fill); this.version = 0; }
  get(x, y) { if (x < 0 || y < 0 || x >= this.w || y >= this.h) return '#'; return this.t[y * this.w + x]; }
  set(x, y, c) { if (x < 0 || y < 0 || x >= this.w || y >= this.h) return; this.t[y * this.w + x] = c; this.version++; }
  solid(x, y) { const c = this.get(x, y); return c === '#' || c === 'B' || c === 'G'; }
  solidPx(px, py) { return this.solid(Math.floor(px / TILE), Math.floor(py / TILE)); }
  hazard(x, y) { const c = this.get(x, y); return c === '^' || c === 'v' || c === '~'; }
}
const ENTITY_CHARS = 'ozefthkbjcgFWLPDMdq1234567X';
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

export function generateRun(seed) {
  const rng = makeRng(seed); const GW = 9, GH = 4;
  for (let attempt = 0; attempt < 60; attempt++) {
    const res = tryGenerate(rng, GW, GH); if (res) { res.seed = seed; return res; }
  }
  throw new Error('generator failed');
}
function tryGenerate(rng, GW, GH) {
  const grid = new Map(); const key = (x, y) => x + ',' + y;
  let x = 0, y = rng.int(0, 1); const path = [{ x, y }]; grid.set(key(x, y), { x, y, need: new Set(), kind: 'start', depth: 0 });
  const target = rng.int(10, 12), mbIndex = Math.floor(target * 0.55);
  let downs = 0;
  while (path.length < target) {
    const i = path.length; const canR = x + 1 < GW, canD = y + 1 < GH && !grid.has(key(x, y + 1));
    let dir;
    if (i === 1 || i === mbIndex || i === mbIndex + 1 || i === target - 1 && rng.chance(0.5)) dir = canR ? 'R' : canD ? 'D' : null;
    else dir = canR && (!canD || rng.chance(downs >= 2 ? 0.8 : 0.6)) ? 'R' : canD ? 'D' : canR ? 'R' : null;
    if (!dir) break;
    const prev = grid.get(key(x, y));
    if (dir === 'R') { prev.need.add('R'); x++; } else { prev.need.add('D'); y++; downs++; }
    const cell = { x, y, need: new Set([dir === 'R' ? 'L' : 'U']), kind: 'normal', depth: path.length };
    grid.set(key(x, y), cell); path.push({ x, y });
  }
  if (path.length < 9) return null;
  const cells = path.map((p) => grid.get(key(p.x, p.y)));
  cells[cells.length - 1].kind = 'exit';
  const mb = cells[mbIndex]; if (!(mb.need.has('L') && mb.need.has('R') && mb.need.size === 2)) return null; mb.kind = 'miniboss';
  // side branches (dead ends): fountain, weapon, treasure, secret
  const wants = rng.shuffle(['fountain', 'weapon', 'secret', 'treasure', 'treasure']);
  let fails = 0;
  for (const want of wants) {
    let placed = false;
    for (let tries = 0; tries < 20 && !placed; tries++) {
      const host = cells[rng.int(1, cells.length - 2)]; if (host.kind !== 'normal') continue;
      const dirs = rng.shuffle(['L', 'R']);
      for (const d of dirs) {
        if (host.need.has(d)) continue;
        const nx = host.x + (d === 'L' ? -1 : d === 'R' ? 1 : 0), ny = host.y + (d === 'U' ? -1 : d === 'D' ? 1 : 0);
        if (nx < 0 || ny < 0 || nx >= GW || ny >= GH || grid.has(key(nx, ny))) continue;
        const back = { L: 'R', R: 'L', U: 'D', D: 'U' }[d];
        // which dead-end chunk fits?
        const pool = CHUNKS.filter((c) => c.exits.length === 1 && (want === 'fountain' ? c.tags.includes('fountain') : want === 'weapon' ? c.tags.includes('weapon') : c.tags.includes('treasure') || c.tags.includes('secret')));
        const opts = []; for (const c of pool) for (const v of variants(c)) if (v.exits === back) opts.push(v);
        if (!opts.length) continue;
        // host must have a chunk variant with the extra exit
        const hostNeed = new Set([...host.need, d]); if (!pickChunk(rng, hostNeed, 'normal', new Map(), true)) continue;
        host.need.add(d); if (want === 'secret') host.secret = d;
        const dead = { x: nx, y: ny, need: new Set([back]), kind: 'dead', want, variant: rng.pick(opts), depth: host.depth, branch: true };
        grid.set(key(nx, ny), dead); placed = true; break;
      }
    }
    if (!placed) fails++;
  }
  if (fails > 2) return null;
  // choose chunks for path cells
  const used = new Map(); const all = [...grid.values()];
  for (const c of all) {
    if (c.kind === 'dead') continue;
    const v = pickChunk(rng, c.need, c.kind, used); if (!v) return null; c.variant = v; used.set(v.ch.id, (used.get(v.ch.id) || 0) + 1);
  }
  return assemble(all, GW, GH, rng);
}
function pickChunk(rng, need, kind, used, dry = false) {
  const tag = { start: 'start', miniboss: 'miniboss', exit: 'exit' }[kind];
  const opts = [];
  for (const c of CHUNKS) {
    if (tag ? !c.tags.includes(tag) : !(c.tags.includes('combat') || c.tags.includes('platform'))) continue;
    if (!tag && c.exits.length < 2) continue;
    for (const v of variants(c)) {
      if (kind === 'start' && v.flip) continue;
      if ([...need].every((e) => v.exits.includes(e))) { const extra = v.exits.length - need.size; opts.push({ v, w: (1 / (1 + (used.get(c.id) || 0) * 3)) * (extra === 0 ? 2 : 1) }); }
    }
  }
  if (!opts.length) return null; if (dry) return true;
  let tot = opts.reduce((s, o) => s + o.w, 0), r = rng() * tot; for (const o of opts) { r -= o.w; if (r <= 0) return o.v; } return opts[opts.length - 1].v;
}
function assemble(cells, GW, GH, rng) {
  const map = new TileMap(GW * CW, GH * CH, '#'); const spawns = [];
  for (const c of cells) {
    const ox = c.x * CW, oy = c.y * CH, rows = c.variant.rows;
    for (let y = 0; y < CH; y++) for (let x = 0; x < CW; x++) map.t[(oy + y) * map.w + ox + x] = rows[y][x];
    // doors
    for (const e of 'LRUD') {
      const has = c.variant.exits.includes(e), want = c.need.has(e); if (!has) continue;
      const fill = want ? (c.secret === e ? 'B' : '.') : '#';
      if (e === 'L' || e === 'R') { const cx = e === 'L' ? 0 : CW - 1; for (let y = 14; y <= 17; y++) map.t[(oy + y) * map.w + ox + cx] = fill; if (fill === 'B') for (let y = 14; y <= 17; y++) map.t[(oy + y) * map.w + ox + (e === 'L' ? 1 : CW - 2)] = 'B'; }
      if (e === 'U') for (let x = 15; x <= 18; x++) map.t[oy * map.w + ox + x] = want ? '.' : '#';
      if (e === 'D') for (let x = 15; x <= 18; x++) for (let y = CH - 2; y < CH; y++) map.t[(oy + y) * map.w + ox + x] = want ? '.' : '#';
    }
    c.room = { x: ox * TILE, y: oy * TILE, w: CW * TILE, h: CH * TILE };
    c.id = c.variant.ch.id + (c.variant.flip ? '~f' : '');
  }
  // extract entities
  for (const c of cells) {
    const ox = c.x * CW, oy = c.y * CH;
    for (let y = 0; y < CH; y++) for (let x = 0; x < CW; x++) {
      const i = (oy + y) * map.w + ox + x, ch = map.t[i];
      if (ENTITY_CHARS.includes(ch)) { map.t[i] = '.'; spawns.push({ c: ch, x: ox + x, y: oy + y, cell: c }); }
    }
  }
  return { map, spawns, cells, gw: GW, gh: GH };
}
