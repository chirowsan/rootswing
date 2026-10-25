// v2.0 "harder" pass: more traps (trap pack placed on safe floor/ceiling spots), more foes per room, foe variants,
// elite affixes, ambush waves, wave-locked arena rooms and mini-boss variants. Everything scales with the
// Difficulty setting (Relaxed / Normal / Hard / Nightmare) and with room depth. Never changes map tiles at plan time,
// so every run still passes the reach validator; arena gates are temporary 'G' tiles like the mini-boss gates.
import { TILE, makeRng, hash2 } from './util.js';
import { CW, CH } from './level.js';
import { diff, save } from './save.js';
import { sfx } from './audio.js';
import * as BR from './brawl.js';
const KEEP_CLEAR = 'PSQDcFWMX1234567'; // never put a new trap or foe next to these
const floorAt = (m, x, y) => !m.solid(x, y) && !m.solid(x, y - 1) && !m.solid(x, y - 2) && m.solid(x, y + 1) && !m.hazard(x, y) && !m.hazard(x, y + 1) && m.get(x, y) === '.' && m.get(x, y + 1) !== '=';
export function floorSpots(m, c, pad = 3) { const out = [], ox = c.x * CW, oy = c.y * CH; for (let y = oy + 2; y < oy + CH - 2; y++) for (let x = ox + pad; x < ox + CW - pad; x++) if (floorAt(m, x, y)) out.push({ x, y }); return out; }
export const VARIANTS = {
  brute: { base: 'charger', name: 'Rustbrute', tip: 'Big and armored. Heavy hits (hammer!) crack its plates.', hp: 2.3, dmg: 1.35, scale: 1.4, armor: 4, aggro: 0.9, aura: '#ffb347' },
  swarm: { base: 'hopper', name: 'Thornling', tip: 'Thornlings come in packs. Spin or sweep to hit them all.', hp: 0.6, dmg: 0.8, scale: 0.8, aggro: 1.5, aura: '#9be070' },
  storm: { base: 'moth', name: 'Stormmoth', tip: 'Swoops twice as often. Parry the swoop!', hp: 1.3, dmg: 1.1, scale: 1.15, aggro: 1.7, aura: '#8ff6ff' },
};
export const AFFIXES = { // elite variants: each shows its own aura colour
  mighty: { label: 'Mighty', aura: '#ff5ad0' }, // classic elite: more HP, bigger
  swift: { label: 'Swift', aura: '#5ad8ff', aggro: 1.6 },
  thorned: { label: 'Thorned', aura: '#ff6a3a', dmg: 1.35 },
  splitter: { label: 'Splitter', aura: '#9bff6a' }, // splits into 2 Thornlings when beaten
};
export const WARDENS = [
  { id: 'classic', name: null, aggro: 1, hp: 1 },
  { id: 'thornback', name: 'Thornback Warden', aggro: 1.1, hp: 1.15, minion: 'charger', aura: '#ff6a3a' },
  { id: 'stormhide', name: 'Stormhide Warden', aggro: 1.35, hp: 0.95, minion: 'moth', aura: '#5ad8ff' },
];
// ---------------- plan (run mode, before spawning) ----------------
export function planRun(W, L) {
  if (W.mode !== 'run' || !L.cells || !L.cells.length) return;
  const D = diff(), m = L.map, rng = makeRng(((W.seed + (W.stage || 0) * 7919) ^ 0x51ed27) >>> 0), main = L.cells.filter((c) => !c.branch), N = Math.max(1, main.length - 1);
  const busy = []; for (const t of L.traps || []) busy.push({ x: t.x, y: t.y, r: 3 }); for (const s of L.spawns) if (KEEP_CLEAR.includes(s.c)) busy.push({ x: s.x, y: s.y, r: 4 }); else if (s.c === 'o' || s.c === 'z') busy.push({ x: s.x, y: s.y, r: 1 });
  const free = (x, y, r = 0) => !busy.some((b) => Math.abs(b.x - x) <= b.r + r && Math.abs(b.y - y) <= b.r + r + 1);
  const ceilAbove = (x, y, lo, hi) => { for (let d = 1; d <= hi; d++) if (m.solid(x, y - d)) return d >= lo ? y - d : -1; return -1; };
  const clearCol = (x, y0, y1) => { for (let y = y0; y <= y1; y++) if (m.solid(x, y)) return false; return true; };
  const extra = [], foes = []; W.plan = { traps: extra, foes, arenas: [], ambush: [] };
  for (const c of main) {
    if (c.kind !== 'normal') continue; const f = c.depth / N; if (f < 0.1) continue; // the first rooms stay teaching rooms
    const spots = floorSpots(m, c).filter((p) => free(p.x, p.y)); if (!spots.length) continue;
    const kinds = ['vine', 'spore', 'stalactite']; if (f > 0.3) kinds.push('pendulum', 'gate'); if (f > 0.5 || D.trap > 1.2) kinds.push('roller');
    for (let i = kinds.length - 1; i > 0; i--) { const j = (rng() * (i + 1)) | 0; [kinds[i], kinds[j]] = [kinds[j], kinds[i]]; }
    let want = Math.min(4, Math.floor((0.35 + 1.6 * f) * D.trap + rng() * 0.8)); // ramp: ~0-1 early, 2 mid, 2-4 late (more on Hard/Nightmare)
    const placed = [];
    for (const k of kinds) {
      if (placed.length >= want) break;
      const order = rng.shuffle(spots.slice()); // v2.2: a real shuffle (a random comparator made sort() order engine-dependent)
      for (const p of order) {
        if (!free(p.x, p.y, 2) || placed.some((q) => Math.abs(q.x - p.x) < 6 && Math.abs(q.y - p.y) < 4)) continue;
        let t = null;
        if (k === 'vine') { const n = floorAt(m, p.x + 1, p.y) && floorAt(m, p.x + 2, p.y) && rng() < 0.6 ? 3 : floorAt(m, p.x + 1, p.y) ? 2 : 0; if (n && floorAt(m, p.x - 1, p.y) && floorAt(m, p.x + n, p.y)) t = { k, x: p.x, y: p.y, n }; } // safe ground both sides
        else if (k === 'spore') { if (floorAt(m, p.x - 2, p.y) && floorAt(m, p.x + 2, p.y)) t = { k, x: p.x, y: p.y }; }
        else if (k === 'stalactite') { const cy = ceilAbove(p.x, p.y, 3, 19); if (cy >= 0) t = { k, x: p.x, y: Math.max(cy + 1, p.y - 7), floor: (p.y + 1) * TILE }; } // hangs from the canopy rope if the ceiling is high
        else if (k === 'pendulum') { const cy = ceilAbove(p.x, p.y, 5, 19); if (cy >= 0) { const py = Math.max(cy + 1, p.y - 4), len = (p.y + 1 - py) * TILE - 24, reach = Math.ceil((len * 0.85 + 16) / TILE); let ok = true; for (let dx = -reach; dx <= reach && ok; dx++) ok = clearCol(p.x + dx, py + 1, p.y) && m.solid(p.x + dx, p.y + 1); if (ok && floorAt(m, p.x - reach - 1, p.y) && floorAt(m, p.x + reach + 1, p.y)) t = { k, x: p.x, y: py, len }; } }
        else if (k === 'gate') { if (clearCol(p.x, p.y - 3, p.y) && floorAt(m, p.x - 2, p.y) && floorAt(m, p.x + 2, p.y)) t = { k, x: p.x, y: p.y, h: 3 }; }
        else if (k === 'roller') { let x2 = p.x; while (x2 + 1 < c.x * CW + CW - 3 && floorAt(m, x2 + 1, p.y) && x2 - p.x < 9) x2++; if (x2 - p.x >= 6 && floorAt(m, p.x - 1, p.y) && free(x2, p.y, 1)) t = { k, x: p.x, x2: x2 - 1, y: p.y }; } // safe ground at both ends
        if (!t) continue; t.cell = c; t.v20 = true; extra.push(t); placed.push(p); busy.push({ x: p.x, y: p.y, r: k === 'roller' ? 3 : 2 }); if (k === 'roller') busy.push({ x: t.x2, y: p.y, r: 2 }); break;
      }
    }
    // more foes per room (steeper ramp, more on Hard/Nightmare)
    const nf = Math.min(4, Math.floor(f * 2.4 * D.foes + rng() * 0.9));
    for (let i = 0; i < nf; i++) { const ok = spots.filter((p) => free(p.x, p.y, 1) && !foes.some((q) => Math.abs(q.x - p.x) < 4 && q.y === p.y)); if (!ok.length) break; const p = ok[(rng() * ok.length) | 0]; foes.push({ c: 'e', x: p.x, y: p.y - 0, cell: c, extra: true }); }
  }
  // arenas (wave-locked) and ambushes on plain L<->R rooms in the back two thirds
  const lr = main.filter((c) => c.kind === 'normal' && c.need.size === 2 && c.need.has('L') && c.need.has('R') && !c.pair && !L.cells.some((o) => o.kind === 'miniboss' && Math.abs(o.x - c.x) + Math.abs(o.y - c.y) <= 1) && c.depth / N > 0.3 && floorSpots(m, c).length >= 8);
  for (let i = lr.length - 1; i > 0; i--) { const j = (rng() * (i + 1)) | 0; [lr[i], lr[j]] = [lr[j], lr[i]]; }
  const na = Math.min(lr.length, D.arenas); W.plan.arenas = lr.slice(0, na); W.plan.ambush = main.filter((c) => c.kind === 'normal' && !W.plan.arenas.includes(c) && c.depth / N > 0.2 && c.depth % 3 === (W.seed >>> 0) % 3).slice(0, D.ambush);
  for (const c of W.plan.arenas) { let n = 0; for (let i = 0; i < extra.length; i++) if (extra[i].cell === c && n++ >= 1) extra.splice(i--, 1); } // arena rooms keep 1 new trap: the waves are the challenge
  for (const t of extra) L.traps.push(t); for (const s of foes) L.spawns.push(s);
}
// ---------------- foes ----------------
export function rollVariant(W, e, depth) {
  if (W.mode !== 'run' || e.boss) return; const D = diff(), r = hash2(Math.round(e.x * 3), Math.round(e.y) ^ (W.seed | 0));
  const want = Object.entries(VARIANTS).find(([, v]) => v.base === e.type); if (!want || depth < 1.2) return;
  if (r < Math.min(0.45, (0.12 + depth * 0.05) * D.foes)) applyVariant(e, want[0]);
}
export function applyVariant(e, id) {
  const v = VARIANTS[id]; e.variant = id; e.info = { name: v.name, tip: v.tip }; e.maxHp = e.hp = Math.round(e.hp * v.hp); e.cdmg = Math.round(e.cdmg * v.dmg); e.aggroK = (e.aggroK || 1) * v.aggro; e.auraVar = v.aura;
  const nw = Math.round(e.w * Math.sqrt(v.scale)), nh = Math.round(e.h * Math.sqrt(v.scale)); e.x -= (nw - e.w) / 2; e.y -= nh - e.h; e.w = nw; e.h = nh; e.eScale = (e.eScale || 1) * v.scale; e.glim = Math.round(e.glim * Math.max(1, v.hp));
  if (v.armor) e.armor = e.maxArmor = v.armor;
}
export function applyAffix(e, id) { const a = AFFIXES[id]; BR.makeElite(e); e.affix = id; e.auraCol = a.aura; if (a.aggro) e.aggroK = (e.aggroK || 1) * a.aggro; if (a.dmg) e.cdmg = Math.round(e.cdmg * a.dmg); }
export function dressFoe(W, e, s) {
  if (W.mode !== 'run') return; const D = diff(); e.maxHp = e.hp = Math.round(e.hp * D.hp); e.cdmg = Math.round(e.cdmg * (1 + (e.depth || 0) * D.rampDmg));
  rollVariant(W, e, e.depth || 0);
  const r = hash2(Math.round(e.x) ^ 77, Math.round(e.y) ^ (W.seed | 0));
  if (!e.elite && (e.depth || 0) >= 1 && r < D.elite * Math.min(1, 0.4 + (e.depth || 0) * 0.15)) BR.makeElite(e);
  if (e.elite && !e.affix) { const ids = Object.keys(AFFIXES), k = ids[Math.floor(hash2(Math.round(e.x), 991) * ids.length)]; applyAffix(e, k); }
  if (s && s.extra) e.extra = true;
}
export function dressWarden(W, w) {
  if (W.mode !== 'run') return; const D = diff(), v = D.label === 'Relaxed' ? WARDENS[0] : WARDENS[((W.seed >>> 0) + (W.stage || 0)) % WARDENS.length];
  w.variant = v.id; w.maxHp = w.hp = Math.round(w.hp * D.hp * v.hp); w.aggroK = v.aggro; if (v.name) w.info = { ...w.info, name: v.name }; if (v.minion && !W.stage) w.minion = v.minion; if (v.aura) w.auraVar = v.aura;
  w.maxPoise = w.poise = Math.max(30, Math.round(w.maxHp * 0.16));
}
export function onFoeDown(W, e) { if (e.affix === 'splitter' && !e.split) { e.split = true; for (const s of [-1, 1]) { W.spawnEnemy('hopper', e.cx + s * 18, e.y + e.h); const n = W.enemies[W.enemies.length - 1]; applyVariant(n, 'swarm'); n.vx = s * 160; n.vy = -280; n.cell = e.cell; } W.fx.text(e.cx, e.y - 20, 'SPLIT!', '#9bff6a', 15); } }
// ---------------- arenas + ambushes ----------------
export class Arenas {
  constructor(W) { this.W = W; this.list = (W.plan ? W.plan.arenas : []).map((c) => ({ c, st: 'idle', wave: 0, waves: 0, t: 0, foes: [], portals: [] })); this.amb = (W.plan ? W.plan.ambush : []).map((c) => ({ c, st: 'idle', portals: [] })); this.active = null; }
  update(dt) {
    const W = this.W, P = W.player, D = diff();
    for (const a of this.list) {
      const r = a.c.room, inside = P.cx > r.x && P.cx < r.x + r.w && P.cy > r.y && P.cy < r.y + r.h;
      if (a.st === 'idle' && inside && !W.cleared.has('A' + a.c.index) && P.cx > r.x + 6 * TILE && P.cx < r.x + r.w - 6 * TILE && !W.fight) this.start(a);
      if (a.st !== 'lock') continue; a.t += dt;
      if (!inside || P.dead || a.t > 100) { this.finish(a, false); continue; } // never soft-lock: leaving (death, teleport) or 100 s opens it
      if (a.delay > 0) { a.delay -= dt; if (a.delay <= 0) this.wave(a); continue; }
      this.tickPortals(a, dt);
      if (!a.portals.length && a.foes.every((e) => e.dead)) { if (a.wave < a.waves) this.wave(a); else this.finish(a, true); }
    }
    for (const b of this.amb) { const r = b.c.room, inside = P.cx > r.x && P.cx < r.x + r.w && P.cy > r.y && P.cy < r.y + r.h;
      if (b.st === 'idle' && inside && Math.abs(P.cx - (r.x + r.w / 2)) < 5 * TILE && !W.fight) { b.st = 'on'; const n = 2 + (D.ambush > 2 ? 1 : 0) + (D.foes > 1.6 ? 1 : 0); this.queue(b, n, 'ambush'); W.fx.text(P.cx, P.y - 40, 'AMBUSH!', '#ff5a7a', 18); sfx('roar', 0.5); W.emit('ambush', b.c.index); }
      if (b.st === 'on') this.tickPortals(b, dt); }
  }
  start(a) {
    const W = this.W, c = a.c, ox = c.x * CW, oy = c.y * CH; a.st = 'lock'; a.t = 0; a.wave = 0; a.waves = diff().waves; a.gates = []; this.active = a;
    for (const gx of [0, CW - 1]) for (let y = 1; y < CH - 1; y++) if (W.map.get(ox + gx, oy + y) === '.') { W.setTile(ox + gx, oy + y, 'G'); a.gates.push([ox + gx, oy + y]); (W.gates = W.gates || []).push([ox + gx, oy + y]); }
    const P = W.player; if (W.map.solidPx(P.cx, P.cy)) P.x = c.room.x + TILE * 2;
    BR.cine(W, { x: P.cx, y: P.cy - 40, life: 1.0, zoom: 1.08, label: 'ARENA!', col: '#ff5a7a' }); sfx('door'); W.emit('arenaStart', c.index); a.delay = 1.2; // first wave after the ARENA! card
  }
  wave(a) { const W = this.W, D = diff(); a.wave++; const n = 2 + a.wave + Math.round(D.foes) - 1; this.queue(a, n, 'arena'); W.fx.text(W.player.cx, W.player.y - 46, 'WAVE ' + a.wave + '/' + a.waves, '#ffe27a', 17); W.emit('arenaWave', a.wave); }
  queue(a, n, why) {
    const W = this.W, P = W.player, f = Math.min(1, (a.c.depth || 0) / 20), pool = W.stage ? ['jelly', 'lurefish', 'shellback', 'hopper', 'knight'] : ['hopper', 'charger', 'moth', 'bomber', 'knight'];
    const nearTrap = (p) => W.traps.list.some((t) => Math.abs((t.px != null ? t.px : t.x * TILE) - p.x * TILE) < 3 * TILE && Math.abs(((t.k === 'pendulum' || t.k === 'stalactite') ? (t.floor || t.py + (t.len || 0)) : t.py) - p.y * TILE) < 4 * TILE);
    let spots = floorSpots(W.map, a.c, 2).filter((p) => Math.abs(p.x * TILE + 12 - P.cx) > 150 && !nearTrap(p)); if (!spots.length) spots = floorSpots(W.map, a.c, 2);
    for (let i = 0; i < n && spots.length; i++) { const p = spots[(Math.random() * spots.length) | 0], type = pool[Math.min(pool.length - 1, (Math.random() * (2 + f * 3 + (a.wave || 0))) | 0)]; a.portals.push({ x: p.x * TILE + 12, y: (p.y + 1) * TILE, t: 0.9 + i * 0.15, type, why }); }
  }
  tickPortals(a, dt) {
    const W = this.W; for (const p of a.portals) { p.t -= dt; if (p.t <= 0 && !p.done) { p.done = true; W.spawnEnemy(p.type, p.x, p.y); const e = W.enemies[W.enemies.length - 1]; e.cell = -1; e.depth = (a.c.depth || 0) * 0.33; dressFoe(W, e, null); e.arena = true; if (a.foes) a.foes.push(e); } }
    a.portals = a.portals.filter((p) => !p.done);
  }
  finish(a, won) {
    const W = this.W; for (const [x, y] of a.gates || []) W.setTile(x, y, '.'); W.gates = (W.gates || []).filter(([x, y]) => !(a.gates || []).some(([u, v]) => u === x && v === y)); a.gates = []; this.active = null;
    if (!won) { a.st = 'idle'; a.portals = []; return; }
    a.st = 'done'; W.cleared.add('A' + a.c.index); const P = W.player; BR.bonus(W, 'ARENA CLEAR', 150, '#ffe27a'); W.dropGlims(P.cx, P.cy - 30, Math.round(8 * diff().reward)); W.pickups.push({ kind: 'heart', x: P.cx, y: P.cy - 40, vx: 0, vy: -240, t: 0 }); sfx('unlock'); W.emit('arenaClear', a.c.index);
  }
  draw(g) { const W = this.W; for (const a of [...this.list, ...this.amb]) for (const p of a.portals) { const k = 1 - Math.max(0, Math.min(1, p.t / 0.9)), r = 10 + 18 * k; g.globalCompositeOperation = 'lighter'; g.fillStyle = 'rgba(255,90,122,' + (0.25 + 0.4 * k) + ')'; g.beginPath(); g.ellipse(p.x, p.y - 4, r, r * 0.35, 0, 0, 7); g.fill(); g.globalCompositeOperation = 'source-over'; g.strokeStyle = '#ff5a7a'; g.lineWidth = 2; g.beginPath(); g.ellipse(p.x, p.y - 4, r, r * 0.35, W.t * 3, 0, 5); g.stroke(); if (k > 0.3) { g.fillStyle = '#ffffff'; g.font = 'bold 18px sans-serif'; g.textAlign = 'center'; g.fillText('!', p.x, p.y - 26); } } }
}
