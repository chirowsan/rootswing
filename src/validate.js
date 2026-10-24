// v1.5: run + chunk completability checks built on the movement simulator (src/reach.js). Used by tests and tools/reach15.mjs.
import { explore, canReach, tileCovered } from './reach.js';
import { assemble, variants, CW, CH } from './level.js';
import { CHUNKS15, lintChunk } from './chunks15.js';
import { TILE } from './util.js';
const anchorsOf = (spawns) => spawns.filter((s) => s.c === 'o' || s.c === 'z').map((s) => ({ x: s.x * TILE + 12, y: s.y * TILE + 12, kind: s.c === 'o' ? 'swing' : 'zip' }));
const standsIn = (res, x0, y0, x1, y1) => [...res.stands.values()].filter((s) => { const tx = Math.floor((s.x + 9) / TILE), fy = Math.round((s.y + 34) / TILE); return tx >= x0 && tx <= x1 && fy >= y0 && fy <= y1; }).map((s) => s.key);
export function validateRun(R) {
  const t0 = Date.now(), map = R.map, P = R.spawns.find((s) => s.c === 'P'), door = R.spawns.find((s) => s.c === 'D');
  const res = explore(map, anchorsOf(R.spawns), { x: P.x * TILE + 12, y: (P.y + 1) * TILE }, { maxHooks: 20000 });
  const problems = [];
  const main = R.cells.filter((c) => !c.branch);
  for (const c of main) { let hit = false; for (let y = c.y * CH; y < c.y * CH + CH && !hit; y++) for (let x = c.x * CW; x < c.x * CW + CW && !hit; x++) if (res.covered.has(x + y * map.w)) hit = true; if (!hit) problems.push(`main room ${c.depth} (${c.id}) never reached`); }
  const seeds = R.spawns.filter((s) => s.c === 'Q'); for (const s of seeds) if (!tileCovered(res, map, s.x, s.y, 1)) problems.push(`seed in room ${s.cell.depth} (${s.cell.id}) unreachable`);
  if (seeds.length !== 3) problems.push(`expected 3 seeds, got ${seeds.length}`);
  const doorOk = door && tileCovered(res, map, door.x, door.y, 1); if (!doorOk) problems.push('boss gate unreachable');
  const extras = R.spawns.filter((s) => 'cFW'.includes(s.c)); const missedExtras = extras.filter((s) => !tileCovered(res, map, s.x, s.y, 1)).map((s) => `${s.c}@${s.cell.id}`);
  let softlocks = [];
  if (door) {
    const goal = standsIn(res, door.x - 3, door.y - 1, door.x + 3, door.y + 2), ok = canReach(res, goal);
    const bad = [...res.stands.keys()].filter((k) => !ok.has(k));
    const cellsBad = new Map(); for (const k of bad) { const [tx, fy] = k.split(',').map(Number); const c = R.cells.find((c) => c.x === Math.floor(tx / CW) && c.y === Math.floor((fy - 1) / CH)); const id = c ? c.id + '#' + c.depth : '?'; cellsBad.set(id, (cellsBad.get(id) || 0) + 1); }
    softlocks = [...cellsBad.entries()].map(([id, n]) => `${id}:${n}`);
    if (softlocks.length) problems.push('soft-lock spots (cannot get back to the gate): ' + softlocks.join(' '));
  }
  return { ok: !problems.length, problems, stands: res.stands.size, steps: res.steps, ms: Date.now() - t0, missedExtras };
}
// Each chunk variant is dropped between flat "pad" rooms and every entry -> exit (and the seed spot) is proven.
const PAD = { id: 'pad', exits: 'LRUD', tags: [], tier: 0, rows: Array.from({ length: CH }, (_, y) => Array.from({ length: CW }, (_, x) => (y === 0 || y >= 18 || x === 0 || x === CW - 1 ? '#' : '.')).join('')) };
const STEP = { L: [-1, 0], R: [1, 0], U: [0, -1], D: [0, 1] }, BACK = { L: 'R', R: 'L', U: 'D', D: 'U' };
export function validateChunk(ch, flip = false) {
  const v = variants(ch).find((q) => q.flip === flip), out = [];
  if (!flip) for (const p of lintChunk(ch)) out.push(p);
  const exits = v.exits.split('').filter((e) => !(ch.tags.includes('wideA') && e === 'R') && !(ch.tags.includes('wideB') && e === 'L'));
  if (ch.tags.includes('wideA') || ch.tags.includes('wideB')) return out; // proven as a pair inside full runs
  const cells = [{ x: 1, y: 1, need: new Set(exits), kind: 'normal', variant: { ...v, rows: v.rows.map((r) => r.replace(/Q/g, 'Q')) }, seed: true }];
  for (const e of exits) { const [dx, dy] = STEP[e]; cells.push({ x: 1 + dx, y: 1 + dy, need: new Set([BACK[e]]), kind: 'normal', variant: { ch: PAD, rows: PAD.rows, exits: 'LRUD', flip: false }, pad: e }); }
  const R = assemble(cells, null), map = R.map, anchors = anchorsOf(R.spawns);
  const seed = R.spawns.find((s) => s.c === 'Q' && s.cell === cells[0]);
  const entries = ch.id === 'tallB' ? exits.filter((e) => e === 'U') : ch.id === 'tallA' ? exits.filter((e) => e !== 'D') : exits; // tall pairs are only ever walked top -> bottom
  for (const e of entries) {
    let start;
    if (e === 'L') start = { x: (CW - 6) * TILE, y: (CH + 18) * TILE }; else if (e === 'R') start = { x: (2 * CW + 6) * TILE, y: (CH + 18) * TILE };
    else if (e === 'U') start = { x: (CW + 16) * TILE + 12, y: 17 * TILE }; // fall in from the room above
    else start = { zipArrive: true, x: (CW + 16) * TILE + 12, y: (2 * CH + 4) * TILE + 12 }; // climb in from below via the door bloom
    if (e === 'U') start = { x: (CW + 13) * TILE, y: 18 * TILE }; // stand beside the hole in the pad above, then walk/fall in
    const res = explore(map, anchors, start);
    for (const x of exits) {
      if (x === e) continue; const [dx, dy] = STEP[x], px = (1 + dx) * CW, py = (1 + dy) * CH;
      let hit = false; for (let y = py + 1; y < py + CH - 1 && !hit; y++) for (let xx = px + 1; xx < px + CW - 1 && !hit; xx++) if (res.covered.has(xx + y * map.w)) hit = true;
      if (!hit) out.push(`${ch.id}${flip ? '~f' : ''}: ${e} -> ${x} not reachable`);
    }
    if (seed && !tileCovered(res, map, seed.x, seed.y, 1)) out.push(`${ch.id}${flip ? '~f' : ''}: seed spot not reachable from ${e}`);
    for (const s of R.spawns.filter((s) => 'cFWS'.includes(s.c))) if (!tileCovered(res, map, s.x, s.y, 1)) out.push(`${ch.id}${flip ? '~f' : ''}: ${s.c} not reachable from ${e}`);
    // dead ends must let you back out
    if (exits.length === 1) { const pad = cells[1], gk = standsIn(res, pad.x * CW + 1, pad.y * CH + 1, pad.x * CW + CW - 2, pad.y * CH + CH); const ok = canReach(res, gk); const bad = [...res.stands.keys()].filter((k) => !ok.has(k)); if (bad.length) out.push(`${ch.id}${flip ? '~f' : ''}: ${bad.length} soft-lock spots`); }
  }
  return out;
}
export function validateAllChunks() { const out = []; for (const ch of CHUNKS15) for (const f of [false, true]) out.push(...validateChunk(ch, f)); return out; }
