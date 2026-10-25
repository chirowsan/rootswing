// v2.2 "surprise budget": a pure, seeded plan of what is different in this run -- events per room, one set-piece per
// chapter and hidden pockets carved behind cracked (breakable) walls. Pure (map + cells + seed) so tests can run it in Node.
import { makeRng } from './util.js';
import { CW, CH } from './level.js';
export const EVENT_KINDS = ['boon', 'shrine', 'merchant', 'mimic', 'ambush', 'storm', 'blight', 'fireflies', 'flood', 'collapse', 'hunter', 'trap', 'lore'];
export const SET_PIECES = { 1: 'logchase', 2: 'sporeflood', 3: 'bridge', 4: 'dark', 5: 'escape', 6: 'escape' };
const WEIGHT = { boon: 3, shrine: 2, merchant: 2, mimic: 2, ambush: 2, storm: 1.5, blight: 1.5, fireflies: 1.5, flood: 1, collapse: 1.5, hunter: 1.2, trap: 1.5, lore: 2 };
const ONCE = new Set(['merchant', 'shrine', 'hunter', 'trap']);
const solidT = (m, x, y) => m.get(x, y) === '#';
export const floorAt = (m, x, y) => m.get(x, y) === '.' && m.get(x, y - 1) === '.' && m.get(x, y - 2) === '.' && m.solid(x, y + 1) && !m.hazard(x, y) && !m.hazard(x, y + 1) && m.get(x, y + 1) !== 'G';
export function cellSpots(m, c, pad = 4) { const out = [], ox = c.x * CW, oy = c.y * CH; for (let y = oy + 2; y < oy + CH - 2; y++) for (let x = ox + pad; x < ox + CW - pad; x++) if (floorAt(m, x, y)) out.push({ x, y }); return out; }
const planks = (m, c) => { let n = 0; const ox = c.x * CW, oy = c.y * CH; for (let y = oy; y < oy + CH; y++) for (let x = ox; x < ox + CW; x++) if (m.get(x, y) === '=') n++; return n; };
// find a solid block inside cell c that can hold a hidden pocket: entrance (2 'B' tiles) beside a floor spot, room behind
export function findPocket(m, c, rng) { // pockets dig into solid rock next to the room (usually an unused map slot)
  const ox = c.x * CW, oy = c.y * CH, sizes = [[8, 4], [6, 3]], tries = [];
  for (let y = oy + 3; y <= oy + CH - 2; y++) for (let x = ox + 1; x <= ox + CW - 2; x++) if (floorAt(m, x, y)) for (const dir of [1, -1]) if (solidT(m, x + dir, y) && solidT(m, x + dir, y - 1)) tries.push({ x: x + dir, y, dir });
  rng.shuffle(tries);
  for (const [iw, ih] of sizes) for (const t of tries) {
    const x0 = t.dir > 0 ? t.x : t.x - (iw + 1), x1 = x0 + iw + 1, y0 = t.y - ih, y1 = t.y + 1; // walls included
    const mx0 = t.dir > 0 ? x0 : x0 - 1, mx1 = t.dir > 0 ? x1 + 1 : x1;
    if (mx0 < 1 || mx1 > m.w - 2 || y0 - 1 < 1 || y1 + 1 > m.h - 2) continue;
    let ok = true; for (let y = y0 - 1; y <= y1 + 1 && ok; y++) for (let x = mx0; x <= mx1 && ok; x++) if (!solidT(m, x, y)) ok = false;
    if (!ok) continue;
    return { ex: t.x, ey: t.y, dir: t.dir, ix: t.dir > 0 ? t.x + 1 : x0 + 1, iy: t.y - ih + 1, iw, ih };
  }
  return null;
}
export function carvePocket(m, p) { for (let y = p.iy; y < p.iy + p.ih; y++) for (let x = p.ix; x < p.ix + p.iw; x++) m.set(x, y, '.'); m.set(p.ex, p.ey, 'B'); m.set(p.ex, p.ey - 1, 'B'); }
// the whole plan; k = difficulty surprise factor; skip = cells already used by arenas
export function planSurprises(L, seed, chapter = 0, k = 1, skip = new Set()) {
  const rng = makeRng(((seed | 0) ^ 0x5b7e3a ^ Math.imul(chapter + 1, 0x9e37)) >>> 0), m = L.map, idx = (c) => L.cells.indexOf(c);
  const main = L.cells.filter((c) => !c.branch), N = Math.max(1, main.length - 1);
  const pool = main.filter((c) => c.kind === 'normal' && c.depth / N > 0.12 && c.depth / N < 0.97 && !skip.has(idx(c)) && !L.cells.some((o) => o.kind === 'miniboss' && Math.abs(o.x - c.x) + Math.abs(o.y - c.y) <= 1));
  const plan = { seed, chapter, events: [], pockets: [], set: null, budget: 0 };
  // set-piece first (one per chapter; free runs pick one by seed)
  const sk = SET_PIECES[chapter] || ['logchase', 'sporeflood', 'bridge', 'dark', 'escape'][(seed >>> 3) % 5];
  const lr = pool.filter((c) => c.need.has('L') && c.need.has('R') && c.need.size === 2 && c.depth / N > 0.35);
  let sc = null, kind = sk;
  if (sk === 'bridge') { const pl = pool.filter((c) => c.depth / N > 0.3).map((c) => [c, planks(m, c)]).sort((a, b) => b[1] - a[1]); if (pl.length && pl[0][1] >= 4) sc = pl[0][0]; else kind = 'canopy'; }
  if (!sc && (kind === 'logchase' || kind === 'escape')) sc = lr.length ? lr[(rng() * lr.length) | 0] : null;
  if (!sc) { const mid = pool.filter((c) => c.depth / N > 0.35); sc = mid.length ? mid[(rng() * mid.length) | 0] : pool[0]; if (kind === 'logchase' || kind === 'escape') kind = 'canopy'; }
  if (sc) plan.set = { k: kind, cell: idx(sc) };
  // event budget: varies per run (3..9), a bit more on harder difficulties
  const budget = Math.max(3, Math.min(9, Math.round((2.5 + main.length * 0.1 + rng() * 2.5) * k))); plan.budget = budget;
  const cand = rng.shuffle(pool.filter((c) => c !== sc)); const used = new Set(), byDepth = [];
  let bag = []; const draw = () => { if (!bag.length) { bag = EVENT_KINDS.filter((e) => !(ONCE.has(e) && used.has(e))).flatMap((e) => Array(Math.max(1, Math.round(WEIGHT[e] * 2))).fill(e)); rng.shuffle(bag); } return bag.pop(); };
  for (const c of cand) {
    if (plan.events.length >= budget) break; if (byDepth.some((d) => Math.abs(d - c.depth) < 1)) continue;
    let e = null; for (let i = 0; i < 12 && !e; i++) { const t = draw(); if (!t || (ONCE.has(t) && used.has(t))) continue; if (t === 'collapse' && planks(m, c) < 3) continue; if (plan.events.length && plan.events[plan.events.length - 1].k === t) continue; e = t; }
    if (!e) continue; const sp = cellSpots(m, c); if (!sp.length) continue; const s = sp[Math.floor(sp.length * (0.35 + rng() * 0.3))];
    used.add(e); byDepth.push(c.depth); plan.events.push({ k: e, cell: idx(c), x: s.x, y: s.y, id: 'sp' + plan.events.length + '_' + idx(c) });
  }
  if (!plan.events.some((e) => e.k === 'boon') && plan.events.length) plan.events[0].k = 'boon'; // every run offers at least one boon pick
  // hidden pockets (1-3) behind cracked walls, each with a mini-game and an Ember Spark
  const want = 1 + ((seed >>> 5) & 1) + (k > 1.05 ? 1 : 0), pc = rng.shuffle(L.cells.filter((c) => c.kind === 'normal' || c.kind === 'dead')), games = rng.shuffle(['fireflies', 'runes', 'treasure']);
  for (const c of pc) { if (plan.pockets.length >= want) break; const p = findPocket(m, c, rng); if (!p) continue; carvePocket(m, p); plan.pockets.push({ ...p, cell: idx(c), game: games[plan.pockets.length % games.length], id: 'pk' + idx(c) + '_' + p.ex + '_' + p.ey }); }
  return plan;
}
