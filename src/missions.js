// v1.8 Side missions: an icon-driven Mission Board (3 active missions that refresh when done), earn-only cosmetic rewards,
// lost forest critters to rescue and a seeded Daily Challenge. Pure logic lives here (Node-testable); the World/HUD/UI wire it in.
import { save, writeSave } from './save.js';
import { makeRng, hash2 } from './util.js';
import { VINES } from './objective.js';
export const MVER = 1;
export const CRITTERS = ['bunny', 'squirrel', 'beetle', 'hog'];
export const HUNT = ['hopper', 'charger', 'bomber'];
// every mission type: icon (art.js drawIcon name or 'spr:<atlas sprite>'), the World event it listens to and a target per tier
export const TYPES = {
  rescue: { icon: 'spr:cr_bunny', ev: 'critter', tiers: [1, 2, 3], color: '#9be070' },
  clean: { icon: 'shield', ev: 'roomClean', tiers: [1, 2, 3], color: '#8ff6ff' },
  secret: { icon: 'key', ev: 'secret', tiers: [1, 1, 2], color: '#ffe27a' },
  hunt: { icon: 'spr:hopper', ev: 'kill', tiers: [3, 5, 8], color: '#ff9a7a' },
  chain: { icon: 'chain', ev: 'chain', tiers: [2, 3, 4], max: true, color: '#5ff2e8' },
  quick: { icon: 'clock', ev: 'minibossTime', tiers: [1, 1, 1], limits: [150, 120, 95], color: '#ffb36a' },
  gold: { icon: 'glimmer', ev: 'glim', tiers: [30, 60, 100], color: '#ffe27a' },
  dry: { icon: 'noflask', ev: 'areaDone', tiers: [1, 1, 1], color: '#ff9ab0' },
  daily: { icon: 'sun', ev: 'dailyDone', tiers: [1, 1, 1], color: '#ffd36b' },
};
export const TYPE_IDS = Object.keys(TYPES);
// cosmetics: capes + hats are layered on the animated hero; vines recolour the hook vine; friends live in the Seedhouse
export const CAPES = [
  { id: 'none' },
  { id: 'leaf', a: '#1c6a6a', b: '#7ff0c8' }, { id: 'sky', a: '#2a5aa8', b: '#9fd8ff' }, { id: 'berry', a: '#6a2a8a', b: '#e2a6ff' },
  { id: 'gold', a: '#a8781a', b: '#ffe27a', star: true }, { id: 'night', a: '#1c1a3a', b: '#7f8cff', star: true },
];
export const HATS = [{ id: 'none' }, { id: 'flower' }, { id: 'acorn' }, { id: 'leafcrown' }, { id: 'mush' }, { id: 'crown' }];
export const REWARDS = [ // earn order (each new mission shows the next reward it will give)
  'cape:leaf', 'wpn:hammer', 'vine:berry', 'pet:bunny', 'wpn:whip', 'hat:flower', 'cape:sky', 'pet:squirrel', 'vine:frost', 'hat:acorn', 'cape:berry',
  'pet:beetle', 'hat:leafcrown', 'vine:sunset', 'cape:gold', 'pet:hog', 'hat:mush', 'cape:night', 'hat:crown', 'vine:rainbow',
];
export const BADGES = [...TYPE_IDS.map((t) => ({ id: 'b_' + t, icon: TYPES[t].icon, color: TYPES[t].color })),
  { id: 'm1', icon: 'star', n: 1, color: '#ffe27a' }, { id: 'm5', icon: 'star', n: 5, color: '#9be070' }, { id: 'm10', icon: 'star', n: 10, color: '#8ff6ff' },
  { id: 'm25', icon: 'star', n: 25, color: '#ffa6d8' }, { id: 'friends', icon: 'heart', color: '#ff9ab0' }];
export const DAILY_MODS = [ // cosmetic or damage-only: never touches gravity/jump/hook physics, so every reach proof still holds
  { id: 'glass', icon: 'heart', color: '#ff8aa0', taken: 1.5, dealt: 1 },
  { id: 'mighty', icon: 'blade', color: '#bfe8ff', taken: 1, dealt: 1.5 },
  { id: 'firefly', icon: 'moon', color: '#c9b8ff', taken: 1, dealt: 1, tint: 'rgba(40,30,110,0.28)' },
  { id: 'golden', icon: 'glimmer', color: '#ffe27a', taken: 1, dealt: 1, tint: 'rgba(255,190,60,0.12)' },
];
export function defaultMissions() {
  return { ver: MVER, active: [], done: 0, made: 0, typeDone: {}, badges: [], owned: [], rescued: 0,
    wardrobe: { cape: 'none', hat: 'none', pet: 'none' }, daily: { date: '', best: 0, bestDate: '', plays: 0 }, hud: true };
}
// ---- v1.7 -> v1.8 save migration: keep everything, add the missions block, carry star vines over as owned ----
export function migrateSave(p) {
  const fresh = !p.missions; const m = Object.assign(defaultMissions(), p.missions || {});
  m.wardrobe = Object.assign(defaultMissions().wardrobe, m.wardrobe || {}); m.daily = Object.assign(defaultMissions().daily, m.daily || {});
  for (const k of ['active', 'badges', 'owned']) if (!Array.isArray(m[k])) m[k] = [];
  m.ver = MVER; p.missions = m; p.saveVer = 20; // v2.0: fighting styles live in progress.unlocks (blade/hammer/whip); old saves keep their weapon
  p.unlocks = Object.assign({ blade: true }, p.unlocks || {}); if (!p.weapon) p.weapon = 'blade';
  if (!m.active.length) fillMissions(m);
  return fresh;
}
const M = () => { if (!save.progress.missions || (save.progress.saveVer || 0) < 20) migrateSave(save.progress); return save.progress.missions; };
export const missions = M;
export const owns = (m, r) => m.owned.includes(r) || (r.startsWith('wpn:') && !!(save.progress.unlocks || {})[r.slice(4)]);
export function nextReward(m) { const used = new Set(m.active.map((a) => a.reward)); return REWARDS.find((r) => !owns(m, r) && !used.has(r)) || 'glim:25'; }
export function makeMission(m, rng = makeRng((0x51ed + m.made * 7919) >>> 0)) {
  const busy = new Set(m.active.map((a) => a.type)), today = dayKey();
  const pool = TYPE_IDS.filter((t) => !busy.has(t) && !(t === 'daily' && m.daily.date === today));
  const type = pool[Math.floor(rng() * pool.length)], T = TYPES[type], tier = Math.min(2, Math.floor((m.typeDone[type] || 0) / 2));
  const mi = { id: ++m.made, type, target: T.tiers[tier], prog: 0, tier, reward: null };
  if (type === 'hunt') mi.enemy = HUNT[Math.floor(rng() * HUNT.length)];
  if (type === 'quick') mi.limit = T.limits[tier];
  mi.reward = nextReward(m); return mi;
}
export function fillMissions(m) { while (m.active.length < 3) m.active.push(makeMission(m)); return m; }
export const missionIcon = (mi) => mi.type === 'hunt' ? 'spr:' + mi.enemy : TYPES[mi.type].icon;
// ---- event -> progress. Returns [{ mi, kind: 'progress' | 'done', reward }] for toasts ----
export function missionEvent(name, data, m = M()) {
  const out = [];
  for (const mi of m.active) {
    const T = TYPES[mi.type]; if (T.ev !== name || mi.prog >= mi.target) continue;
    let p = mi.prog;
    if (mi.type === 'hunt') { if (!data || data.type !== mi.enemy) continue; p++; }
    else if (mi.type === 'chain') { if ((data | 0) <= p) continue; p = Math.min(mi.target, data | 0); }
    else if (mi.type === 'quick') { if (!(data <= mi.limit)) continue; p = mi.target; }
    else if (mi.type === 'dry') { if (!data || !data.flaskFree) continue; p++; }
    else if (mi.type === 'gold') p += typeof data === 'number' ? data : 1;
    else p++;
    mi.prog = Math.min(mi.target, p); out.push({ mi, kind: mi.prog >= mi.target ? 'done' : 'progress' });
  }
  if (name === 'critter') m.rescued = (m.rescued || 0) + 1;
  for (const o of out) if (o.kind === 'done') o.reward = completeMission(m, o.mi);
  if (out.length) writeSave();
  return out;
}
export function grant(m, r) {
  if (r.startsWith('glim:')) { save.progress.glimmers += +r.slice(5); save.progress.totalGlimmers += +r.slice(5); return r; }
  if (!owns(m, r)) m.owned.push(r);
  const [k, v] = r.split(':'); if (k === 'wpn') { save.progress.unlocks[v] = true; save.progress.weapon = v; return r; } // v2.0: a new fighting style, equipped right away
  if (k === 'cape' || k === 'hat' || k === 'pet') m.wardrobe[k] = v; else if (k === 'vine') save.progress.vine = v; // wear it right away
  return r;
}
export function completeMission(m, mi) {
  m.done++; m.typeDone[mi.type] = (m.typeDone[mi.type] || 0) + 1; const got = [grant(m, mi.reward)];
  const badge = (id) => { if (!m.badges.includes(id)) { m.badges.push(id); got.push('badge:' + id); } };
  badge('b_' + mi.type); for (const b of BADGES) if (b.n && m.done >= b.n) badge(b.id);
  if (CRITTERS.every((c) => owns(m, 'pet:' + c))) badge('friends');
  m.active = m.active.filter((a) => a !== mi); m.active.push(makeMission(m)); // refresh the slot with a brand-new mission
  return got;
}
// ---- wardrobe ----
export function unlockedVines() { const st = save.progress.totalStars || 0, m = M(); return VINES.filter((v) => v.mission ? owns(m, 'vine:' + v.id) : st >= v.stars); }
export function wear(kind, id) { const m = M(); if (kind === 'wpn') { if (id === 'blade' || (save.progress.unlocks || {})[id]) save.progress.weapon = id; writeSave(); return; } if (kind === 'vine') { if (unlockedVines().some((v) => v.id === id)) save.progress.vine = id; }
  else if (id === 'none' || owns(m, kind + ':' + id)) m.wardrobe[kind] = id; writeSave(); }
// ---- Daily Challenge: one seeded run per real (local) day, with one cosmetic/damage modifier ----
export function dayKey(d = new Date()) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
export function dailySeed(key = dayKey()) { let h = 2166136261; for (const ch of 'rootswing-daily:' + key) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return (h >>> 0) % 1000000000; }
export function dailyMod(key = dayKey()) { return DAILY_MODS[Math.floor(hash2(dailySeed(key) % 100003, 811) * DAILY_MODS.length)]; }
export function dailyScore(s) { return Math.max(0, Math.round((s.glim || 0) + (s.kills || 0) * 5 + (s.rooms || 0) * 10 + (s.critters || 0) * 25 + (s.win ? 150 : 0))); }
export function recordDaily(key, score) { const m = M(), d = m.daily; if (d.date !== key) { d.date = key; d.best = 0; } d.plays = (d.plays || 0) + 1; const best = score > d.best; if (best) d.best = score; writeSave(); return best; }
// ---- critters: up to 2 per run, beside loot spots (chests / fountains / pedestals) that validateChunk already proves reachable;
// side-path (branch / dead-end) rooms first so they feel hidden ----
export function pickCritterSpots(L, seed) {
  const rng = makeRng(((seed ^ 0xc7177e5) >>> 0) || 1), map = L.map;
  const loot = L.spawns.filter((s) => 'cFW'.includes(s.c) && s.cell);
  const side = loot.filter((s) => s.cell.branch || s.cell.kind === 'dead'), pool = side.length >= 2 ? side : loot;
  const order = pool.map((s) => [rng(), s]).sort((a, b) => a[0] - b[0]).map((a) => a[1]), out = [], usedCells = new Set();
  const floor = (x, y) => !map.solid(x, y) && !map.solid(x, y - 1) && (map.solid(x, y + 1) || map.get(x, y + 1) === '=') && !map.hazard(x, y) && !map.hazard(x, y + 1);
  for (const s of order) {
    if (out.length >= 2 || usedCells.has(s.cell)) continue;
    let gy = s.y; while (gy < s.y + 6 && !map.solid(s.x, gy + 1) && map.get(s.x, gy + 1) !== '=') gy++;
    const dx = [2, -2, 1, -1, 0].find((d) => floor(s.x + d, gy)); if (dx === undefined) continue;
    usedCells.add(s.cell); out.push({ x: s.x + dx, y: gy, cell: L.cells.indexOf(s.cell), kind: CRITTERS[Math.floor(rng() * CRITTERS.length)], id: 'cr' + (s.x + dx) + '_' + gy });
  }
  return out;
}
