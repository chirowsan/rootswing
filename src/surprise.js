// v2.2 Surprises runtime: seeded per-run events (boons, shrines, merchant, mimics, ambushes, hunters, traps, weather),
// one set-piece per chapter, hidden pockets with mini-games, sap orbs, continues, rank and mastery bookkeeping.
// Every hazard here is telegraphed (marker, rumble text or banner) before it can hurt, and nothing can lock a door.
import { save, diff, writeSave, assist, assistActive } from './save.js';
import { TILE, clamp, sign, rand, makeRng, rectsOverlap } from './util.js';
import { CW, CH } from './level.js';
import { sfx } from './audio.js';
import { drawGlow, drawIcon } from './art.js';
import { G, sImg } from './gfx.js';
import * as UI from './ui.js';
import { clearAll } from './input.js';
import { planSurprises, cellSpots } from './surprisePlan.js';
import * as ST from './story.js';
import * as AI from './ai22.js';

// ---------------- boons (roguelite cards) ----------------
export const BOONS = {
  sharp: { n: 'Thorn Edge', d: 'Hit 20% harder.', c: '#ff8a5a', i: 'sword', stack: 1 },
  bark: { n: 'Bark Skin', d: 'Take 18% less damage.', c: '#c89a5a', i: 'shield', stack: 1 },
  bloom: { n: 'Bloom Heart', d: 'Heal a little on every pop.', c: '#ff7ab8', i: 'heart' },
  volt: { n: 'Spark Dash', d: 'Dashing through foes zaps them.', c: '#8ff6ff', i: 'dash' },
  thorns: { n: 'Bramble Coat', d: 'When hit, thorns burst out.', c: '#a6f05a', i: 'star' },
  echo: { n: 'Echo Parry', d: 'Parries make a shockwave.', c: '#bfa6ff', i: 'shield' },
  ember: { n: 'Ember Edge', d: 'Every 4th hit sets foes on fire.', c: '#ffb36a', i: 'fire' },
  sapling: { n: 'Sapling Flask', d: '+1 potion slot (filled).', c: '#7affc0', i: 'flask', stack: 1 },
  magnet: { n: 'Glim Magnet', d: 'Pops drop extra glimmers.', c: '#ffe27a', i: 'glimmer' },
  second: { n: 'Second Sprout', d: 'Once: get back up at 40% HP.', c: '#9dff8a', i: 'leaf' },
  chain: { n: 'Chain Bloom', d: 'Pops zap the nearest foe.', c: '#ffd36a', i: 'star' },
  vigor: { n: 'Big Leaf', d: '+15 max HP and heal 15.', c: '#6fe07a', i: 'heart', stack: 1 },
};
const BKEYS = Object.keys(BOONS);
const has = (W, b) => !!(W.sp && W.sp.run && W.sp.run.boons.includes(b));
const cnt = (W, b) => (W.sp && W.sp.run ? W.sp.run.boons.filter((x) => x === b).length : 0);
// shrine pacts: a blessing always comes with a curse (kids read both, pick one or walk away)
export const PACTS = [
  { id: 'power', b: 'Hit 35% harder', c: 'Take 25% more damage', col: '#ff8a5a' },
  { id: 'heal', b: 'Full heal + 1 potion', c: 'A Thorn Hunter starts chasing you', col: '#9dff8a' },
  { id: 'rich', b: '+60 glimmers', c: 'Foes get 25% more HP', col: '#ffe27a' },
  { id: 'gift', b: 'Pick a boon card', c: '-1 potion slot', col: '#bfa6ff' },
  { id: 'swift', b: 'Two boon cards', c: 'Lose 30% of your HP now', col: '#8ff6ff' },
];
export const STOCK = [
  { id: 'heal', n: 'Berry Pie', d: 'Heal 60%', p: 25, i: 'heart', c: '#ff7ab8' },
  { id: 'flask', n: 'Potion Refill', d: '+1 potion', p: 35, i: 'flask', c: '#7affc0' },
  { id: 'boon', n: 'Boon Seed', d: 'Pick a boon card', p: 60, i: 'star', c: '#bfa6ff' },
  { id: 'hp', n: 'Oak Acorn', d: '+10 max HP', p: 45, i: 'leaf', c: '#a6f05a' },
  { id: 'bag', n: 'Mystery Bag', d: 'Who knows?', p: 20, i: 'gift', c: '#ffe27a' },
  { id: 'map', n: 'Secret Map', d: 'Shows hidden walls', p: 30, i: 'eye', c: '#8ff6ff' },
];
const LORE22 = [
  'Scratched in the bark: "Sprig was here!" ...wait, that is you?',
  'An old note: "The Hollow King sleeps under the Root. Five Ember Sparks wake the way."',
  'A tiny drawing of a mushroom with a crown. Someone loves Puffcaps.',
  'Pip the merchant wrote: "Prices go up the deeper you go. Sorry!"',
  'A stone says: "Parry at the last moment and the forest gives you sap."',
  'A carved riddle: "Walls that sound hollow are hiding friends."',
  'A golden acorn is stuck in the stone! (+25 glimmers)',
  'Moss scribbles: "When a boss falls, wait. Some get back up."',
];
export const TYPES = { 0: ['hopper', 'charger', 'puffcap'], 1: ['hopper', 'charger', 'puffcap'], 2: ['jelly', 'lurefish', 'hopper'], 3: ['knight', 'charger', 'moth'], 4: ['knight', 'moth', 'puffcap', 'charger'], 5: ['knight', 'jelly', 'charger', 'moth'], 6: ['knight', 'charger', 'moth', 'jelly'] };

export function newRun() { const D = diff(); return { boons: [], cont: D.cont >= 99 ? 99 : D.cont, deaths: 0, hits: 0, bossHits: 0, secrets: 0, kills: 0, contUsed: 0, foeHp: 1, dmgT: 1, dmgD: 1, hunted: 0, map: 0, second: 0 }; }
export const persist = (W) => (W && W.sp && W.sp.run ? JSON.parse(JSON.stringify(W.sp.run)) : null);
const runMode = (W) => W.mode === 'run' || W.mode === 'boss';

// ---------------- planning (called from the World ctor right after GA.planRun) ----------------
export function plan(W, L) {
  W.spPlan = null; if (W.mode !== 'run' || !L.cells || !L.cells.length || W.daily || (W.game && W.game.daily)) return;
  const skip = new Set(((W.plan && W.plan.arenas) || []).map((c) => L.cells.indexOf(c)));
  W.spPlan = planSurprises(L, ((W.seed + (W.stage || 0) * 7919) >>> 0), W.chapter || 0, diff().surprise || 1, skip);
}

// ---------------- init ----------------
export function initWorld(W, opts = {}) {
  const g = W.game || {};
  W.sp = { t: 0, banner: null, orbs: [], flies: [], drops: [], logs: [], bolts: [], fall: [], cellEv: new Map(), active: [], pockets: [], orbCd: 0, cur: -1, set: null, setOn: null, wall: null, water: null, gust: null, dark: 0, pending: 0, pendingN: 0, ambush: null, trap: null, later: [], rank: 'B', score: 0, run: null };
  W.on((n, d) => onEvent(W, n, d));
  if (!runMode(W)) return;
  let R = null;
  if (save.run && save.run.sp) R = JSON.parse(JSON.stringify(save.run.sp));
  else if (opts.player && g.spRun) R = g.spRun;
  W.sp.run = R || newRun(); g.spRun = W.sp.run;
  applyBoons(W, true);
  // revive hook for Second Sprout
  const orig = W.tryRevive.bind(W);
  W.tryRevive = (p) => { if (orig(p)) return true; const R2 = W.sp.run; if (has(W, 'second') && !R2.second) { R2.second = 1; p.hp = Math.round(p.maxHp * 0.4); p.iframes = 2.2; p.dead = false; sfx('unlock'); W.fx.ring(p.cx, p.cy, 90, '#9dff8a', 0.6, 6); W.fx.text(p.cx, p.y - 14, 'Second Sprout!', '#9dff8a', 16); W.slow = 0.5; return true; } return false; };
  const oh = W.hitEnemy.bind(W);
  W.hitEnemy = (e, hit, p) => { const r = oh(e, hit, p); if (r !== false && p && !e.dead && has(W, 'ember') && hit.src !== 'burn') { e.burnN = (e.burnN || 0) + 1; if (e.burnN % 4 === 0) { e.burn = 2; W.fx.text(e.cx, e.y - 10, 'burn!', '#ffb36a', 12); } } return r; };
  if (W.mode === 'boss') return;
  const P = W.spPlan; if (!P) return;
  for (const e of P.events) {
    if (W.opened.has(e.id)) continue;
    if (['boon', 'shrine', 'merchant', 'mimic', 'trap', 'lore'].includes(e.k)) addProp(W, e.k, e.x, e.y, e.id, { cell: e.cell });
    else W.sp.cellEv.set(e.cell, e);
  }
  if (P.set && !W.opened.has('set' + P.set.cell)) W.sp.set = P.set;
  for (const pk of P.pockets) { const q = { ...pk, done: W.opened.has(pk.id), on: false, t: 0, seq: [], step: 0 }; W.sp.pockets.push(q); if (q.done) continue;
    const fx = pk.ix + Math.floor(pk.iw / 2), fy = pk.iy + pk.ih - 1;
    if (pk.game === 'treasure') addProp(W, 'spark', fx, fy, pk.id + 't', { pk: pk.id });
    else if (pk.game === 'runes') { const xs = [pk.ix + 1, pk.ix + Math.floor(pk.iw / 2), pk.ix + pk.iw - 2]; xs.forEach((x, i) => addProp(W, 'rune', x, fy, pk.id + 'r' + i, { pk: pk.id, n: i, keep: 1 })); }
  }
  const rng = makeRng((W.seed ^ 0x77aa) >>> 0); W.sp.stock = rng.shuffle(STOCK.slice()).slice(0, 3).map((s) => ({ ...s, p: Math.round(s.p * (1 + 0.15 * (W.chapter || 0))), sold: false }));
}
function addProp(W, ev, tx, ty, id, extra = {}) { const w = ev === 'merchant' ? 40 : ev === 'shrine' ? 40 : 30, h = ev === 'merchant' ? 48 : ev === 'shrine' ? 52 : 32; const o = { kind: 'sp', ev, x: tx * TILE + 12 - w / 2, y: (ty + 1) * TILE - h, w, h, id, open: W.opened.has(id), ...extra }; W.props.push(o); return o; }
function applyBoons(W, init) { const R = W.sp.run, P = W.player; W.dmgDealt = (W.dmgDealt || 1) * Math.pow(1.2, cnt(W, 'sharp')) * R.dmgD; W.dmgTaken = (W.dmgTaken || 1) * Math.pow(0.82, cnt(W, 'bark')) * R.dmgT;
  if (init) { P.maxHp += 15 * cnt(W, 'vigor') + 10 * (R.hpUp || 0); P.maxFlasks = Math.max(0, P.maxFlasks + cnt(W, 'sapling') - (R.flaskDown || 0)); P.flasks = Math.min(P.flasks, P.maxFlasks); P.hp = Math.min(P.hp, P.maxHp);
    if (R.foeHp !== 1) for (const e of W.enemies) if (!e.boss) { e.hp = Math.round(e.hp * R.foeHp); e.maxHp = Math.round((e.maxHp || e.hp) * R.foeHp); } } }
function gainBoon(W, b) { const R = W.sp.run, P = W.player; R.boons.push(b); const B = BOONS[b];
  if (b === 'sharp') W.dmgDealt = (W.dmgDealt || 1) * 1.2; if (b === 'bark') W.dmgTaken = (W.dmgTaken || 1) * 0.82;
  if (b === 'sapling') { P.maxFlasks++; P.flasks++; } if (b === 'vigor') { P.maxHp += 15; P.hp = Math.min(P.maxHp, P.hp + 15); }
  sfx('unlock'); W.fx.ring(P.cx, P.cy, 70, B.c, 0.5, 6); W.fx.text(P.cx, P.y - 20, B.n + '!', B.c, 16); W.emit('boon', b); }

// ---------------- UI panels (pause the game while open) ----------------
function openUI(W, name, html, hook) { const g = W.game; if (!g || typeof document === 'undefined') return false; g.paused = true; clearAll(); UI.hooks[name] = (a, v, el) => { const r = hook(a, v, el); if (r === 'close') { UI.close(); g.paused = false; clearAll(); } return true; }; UI.show(name, html, 'sp22'); return true; }
export function offerBoons(W, why = 'Pick a boon!', n = 1) {
  if (!W.sp || !W.sp.run) return; const R = W.sp.run, pool = BKEYS.filter((b) => BOONS[b].stack || !R.boons.includes(b)); const pick = rand.shuffle ? rand.shuffle(pool.slice()).slice(0, 3) : pool.slice(0, 3);
  const card = (b, i) => { const B = BOONS[b]; return `<button class="boon" data-act="boonPick${i}" style="--c:${B.c}"><span class="b-art">${ic2(B.i, B.c)}</span><b>${B.n}</b><small>${B.d}</small>${R.boons.includes(b) ? '<em>stacks!</em>' : ''}</button>`; };
  const html = `<div class="card sp-panel"><h2>${why}</h2><p class="sp-sub">Boons last for this whole chapter.${n > 1 ? ' (' + n + ' picks)' : ''}</p><div class="sp-cards">${pick.map(card).join('')}</div></div>`;
  openUI(W, 'boons', html, (a) => { const m = /^boonPick(\d)$/.exec(a || ''); if (!m) return false; gainBoon(W, pick[+m[1]] || pick[0]); if (n > 1) { setTimeout(() => offerBoons(W, 'One more boon!', n - 1), 30); } return 'close'; });
}
const S2 = (W) => W.sp;
const ic2 = (i, c) => UI.ic(i, c, 46);
function openShrine(W, o) {
  const rng = makeRng((W.seed ^ 0x5419) >>> 0), two = rng.shuffle(PACTS.slice()).slice(0, 2);
  const html = `<div class="card sp-panel shrine"><div class="sp-hero shrine-art"></div><h2>The Old Shrine</h2><p class="sp-sub">A blessing, but every blessing has a price...</p><div class="sp-cards">${two.map((p, i) => `<button class="boon pact" data-act="shrinePick${i}" style="--c:${p.col}"><b>${p.b}</b><span class="curse">but: ${p.c}</span></button>`).join('')}</div><button class="big" data-act="shrineSkip">Walk away</button></div>`;
  openUI(W, 'shrine', html, (a) => { if (a === 'shrineSkip') { o.open = true; W.opened.add(o.id); return 'close'; } const m = /^shrinePick(\d)$/.exec(a || ''); if (!m) return false; o.open = true; W.opened.add(o.id); const r = pact(W, two[+m[1]]); return r || 'close'; });
}
function pact(W, p) { const R = W.sp.run, P = W.player; sfx('roar'); W.fx.flash = 0.4; W.fx.flashColor = p.col;
  if (p.id === 'power') { R.dmgD *= 1.35; R.dmgT *= 1.25; W.dmgDealt = (W.dmgDealt || 1) * 1.35; W.dmgTaken = (W.dmgTaken || 1) * 1.25; }
  if (p.id === 'heal') { P.hp = P.maxHp; P.flasks = Math.min(P.maxFlasks, P.flasks + 1); S2(W).hunterLater = 1.5; }
  if (p.id === 'rich') { W.runGlim += 60; R.foeHp *= 1.25; for (const e of W.enemies) if (!e.boss && !e.dead) { e.hp = Math.round(e.hp * 1.25); e.maxHp = Math.round((e.maxHp || e.hp) * 1.25); } }
  if (p.id === 'gift') { R.flaskDown = (R.flaskDown || 0) + 1; P.maxFlasks = Math.max(0, P.maxFlasks - 1); P.flasks = Math.min(P.flasks, P.maxFlasks); UI.close(); W.game.paused = false; setTimeout(() => offerBoons(W, 'The shrine gives you a boon'), 30); return 'keep'; }
  if (p.id === 'swift') { P.hp = Math.max(1, Math.round(P.hp * 0.7)); UI.close(); W.game.paused = false; setTimeout(() => offerBoons(W, 'Two boons from the shrine', 2), 30); return 'keep'; }
  banner(W, 'Pact made!', p.b + ' / ' + p.c, p.col); return null; }
function openShop(W, o) {
  const render = () => `<div class="card sp-panel shop"><div class="sp-hero merch-art"></div><h2>Pip's Wandering Wagon</h2><p class="sp-sub">You have ${UI.ic('glimmer', '#ffe27a', 18)} <b>${W.runGlim}</b> glimmers. Stock changes every run!</p><div class="sp-cards">${W.sp.stock.map((s, i) => `<button class="boon ware${s.sold ? ' sold' : ''}" data-act="shopBuy" data-v="${i}" style="--c:${s.c}"><span class="b-art">${ic2(s.i, s.c)}</span><b>${s.n}</b><small>${s.d}</small><em>${s.sold ? 'SOLD' : s.p + ' glim'}</em></button>`).join('')}</div><button class="big" data-act="shopLeave">Bye, Pip!</button></div>`;
  openUI(W, 'shop', render(), (a, v) => { if (a === 'shopLeave') return 'close'; if (a !== 'shopBuy') return false; const s = W.sp.stock[+v]; if (!s || s.sold) return true;
    if (W.runGlim < s.p) { sfx('uiBack'); const el = document.querySelector('#ui .sp-sub'); if (el) el.innerHTML = 'Not enough glimmers! Pop more baddies.'; return true; }
    W.runGlim -= s.p; s.sold = true; sfx('pickup'); const P = W.player, R = W.sp.run;
    if (s.id === 'heal') P.hp = Math.min(P.maxHp, P.hp + Math.round(P.maxHp * 0.6)); if (s.id === 'flask') P.flasks = Math.min(P.maxFlasks, P.flasks + 1); if (s.id === 'hp') { R.hpUp = (R.hpUp || 0) + 1; P.maxHp += 10; P.hp += 10; }
    if (s.id === 'map') R.map = 1; if (s.id === 'bag') { const r = rand(); if (r < 0.4) W.runGlim += 45; else if (r < 0.7) P.hp = P.maxHp; else { UI.close(); W.game.paused = false; setTimeout(() => offerBoons(W, 'The bag had a boon!'), 30); return 'keep'; } }
    if (s.id === 'boon') { UI.close(); W.game.paused = false; setTimeout(() => offerBoons(W, 'Boon Seed'), 30); return 'keep'; }
    UI.show('shop', render(), 'sp22'); return true; });
}

// ---------------- interact / props ----------------
export function icon(o) { return { boon: 'star', shrine: 'eye', merchant: 'gift', mimic: 'gift', trap: 'gift', lore: 'eye', spark: 'gift', rune: 'star' }[o.ev] || 'eye'; }
export function interact(W, o, p) {
  const S = W.sp; if (!S) return false;
  if (o.ev === 'boon') { o.open = true; W.opened.add(o.id); sfx('chest'); offerBoons(W, 'A Boon Bloom!'); return true; }
  if (o.ev === 'shrine') { sfx('ui'); openShrine(W, o); return true; }
  if (o.ev === 'merchant') { sfx('ui'); openShop(W, o); return true; }
  if (o.ev === 'lore') { o.open = true; W.opened.add(o.id); const i = (W.seed + o.cell * 7) % LORE22.length, txt = LORE22[i]; if (i === 6) W.runGlim += 25; sfx('secret'); if (W.story) W.story.toast = { t: 6, text: txt }; else banner(W, 'Old stone', txt, '#b8ff9a'); return true; }
  if (o.ev === 'mimic') { o.open = true; W.opened.add(o.id); W.props.splice(W.props.indexOf(o), 1); const e = spawn(W, 'mimic', o.x + o.w / 2, o.y + o.h); if (e) { e.mimic = 1; e.st = 'wake'; e.t = 0; } sfx('roar'); W.fx.shake(0.3); W.fx.text(o.x + 15, o.y - 20, 'MIMIC!', '#ff5a7a', 20); return true; }
  if (o.ev === 'trap') { o.open = true; W.opened.add(o.id); S.trap = { t: 0, x: o.x + o.w / 2, y: o.y + o.h, foes: [], cell: o.cell, done: false }; banner(W, "IT'S A TRAP!", 'Dodge the falling rocks - watch the shadows!', '#ff5a7a'); sfx('roar'); W.fx.shake(0.5); return true; }
  if (o.ev === 'spark') { o.open = true; W.opened.add(o.id); winPocket(W, o.pk); return true; }
  if (o.ev === 'rune') { const q = S.pockets.find((k) => k.id === o.pk); if (!q || q.done || q.showT > 0) return true; o.lit = 0.5; if (q.seq[q.step] === o.n) { sfx('pickup'); q.step++; if (q.step >= q.seq.length) winPocket(W, q.id); } else { sfx('uiBack'); W.fx.text(o.x + 15, o.y - 12, 'Oops! Watch again', '#ffb36a', 13); q.step = 0; q.showT = 2.6; } return true; }
  return false;
}
function winPocket(W, id) { const S = W.sp, q = S.pockets.find((k) => k.id === id); if (q) q.done = true; W.opened.add(id); const c = ST.camp(); c.sparks = (c.sparks || 0) + 1; S.run.secrets++; writeSave();
  const P = W.player; sfx('victory'); W.fx.burst(P.cx, P.cy, 30, { color: ['#ffb36a', '#ffe27a', '#fff'], max: 300, kind: 'star', size: 6 }); W.dropGlims(P.cx, P.y, 8);
  banner(W, 'EMBER SPARK!', c.sparks >= 5 && !c.done[6] ? 'The Hollow Root is awake... check the map!' : 'Sparks found: ' + c.sparks + ' (5 open a secret)', '#ffb36a'); W.emit('spark'); }
export function drawProp(g, W, o) {
  const t = W.t, cx = o.x + o.w / 2, by = o.y + o.h;
  if (o.ev === 'boon') { if (o.open) return; drawGlow(g, cx, by - 18, 46, '#bfa6ff', 0.5 + 0.2 * Math.sin(t * 3)); if (!sImg(g, 's_altar', cx, by + 2, 46)) { g.fillStyle = '#5a4a7a'; g.fillRect(cx - 14, by - 10, 28, 10); } for (let i = 0; i < 3; i++) { const a = t * 1.5 + i * 2.1; drawIcon(g, 'star', cx + Math.cos(a) * 12, by - 34 + Math.sin(a) * 5, 12, ['#ff8a5a', '#8ff6ff', '#9dff8a'][i]); } return; }
  if (o.ev === 'shrine') { drawGlow(g, cx, by - 30, 56, o.open ? '#555' : '#ff7ad8', o.open ? 0.15 : 0.45); if (!sImg(g, 's_shrine', cx, by + 2, 70, false, o.open ? 0.6 : 1)) { g.fillStyle = '#6a5a7a'; g.fillRect(cx - 16, by - 50, 32, 50); } return; }
  if (o.ev === 'merchant') { if (!sImg(g, 's_merchant', cx, by + 2, 64, W.player.cx > cx)) { g.fillStyle = '#c87a3a'; g.beginPath(); g.ellipse(cx, by - 22, 18, 22, 0, 0, 7); g.fill(); } if (!o.open) { g.fillStyle = '#fff'; g.font = '900 11px system-ui'; g.textAlign = 'center'; g.fillText('Pip', cx, by - 70 + Math.sin(t * 2) * 2); } return; }
  if (o.ev === 'mimic' || o.ev === 'trap' || o.ev === 'spark') { if (o.open) return; const gold = o.ev !== 'mimic'; drawGlow(g, cx, by - 12, 36, gold ? '#ffe27a' : '#ffd36a', 0.45);
    if (o.ev === 'trap') { for (let i = 0; i < 7; i++) { g.fillStyle = i % 2 ? '#ffe27a' : '#ffc23a'; g.beginPath(); g.ellipse(cx - 12 + (i % 4) * 8, by - 4 - Math.floor(i / 4) * 7, 6, 4, 0, 0, 7); g.fill(); } g.fillStyle = '#fff'; g.font = '900 10px system-ui'; g.textAlign = 'center'; g.fillText('Treasure!', cx, by - 26); return; }
    const wob = o.ev === 'mimic' ? Math.max(0, Math.sin(t * 0.9)) ** 12 * 2 : 0; g.save(); g.translate(cx + wob * Math.sin(t * 40), by); g.fillStyle = o.ev === 'spark' ? '#c86a3a' : '#9a6a3a'; g.strokeStyle = '#3a2418'; g.lineWidth = 2; g.beginPath(); g.roundRect(-14, -22, 28, 22, 4); g.fill(); g.stroke(); g.fillStyle = '#ffd36a'; g.fillRect(-14, -13, 28, 3); g.fillRect(-2, -15, 4, 6);
    if (o.ev === 'mimic') { g.fillStyle = '#fff'; for (let i = -10; i <= 8; i += 6) { g.beginPath(); g.moveTo(i, -13); g.lineTo(i + 2, -9 - wob); g.lineTo(i + 4, -13); g.fill(); } } // the honest tell: tiny teeth peek out
    g.restore(); return; }
  if (o.ev === 'lore') { if (!o.open) drawGlow(g, cx, by - 14, 30, '#b8ff9a', 0.3 + 0.2 * Math.sin(t * 2)); g.fillStyle = '#6a6a7a'; g.beginPath(); g.roundRect(cx - 11, by - 26, 22, 26, [9, 9, 2, 2]); g.fill(); g.strokeStyle = o.open ? '#8a8a9a' : '#b8ff9a'; g.lineWidth = 2; g.beginPath(); g.moveTo(cx - 5, by - 18); g.lineTo(cx + 5, by - 18); g.moveTo(cx - 5, by - 12); g.lineTo(cx + 3, by - 12); g.stroke(); return; }
  if (o.ev === 'rune') { const q = W.sp.pockets.find((k) => k.id === o.pk), lit = (o.lit > 0) || (q && q.flash === o.n) || (q && q.done); if (o.lit > 0) o.lit -= 1 / 60; const col = ['#ff7ab8', '#8ff6ff', '#ffe27a'][o.n]; if (lit) drawGlow(g, cx, by - 14, 40, col, 0.8); g.fillStyle = lit ? col : '#4a4458'; g.beginPath(); g.roundRect(cx - 10, by - 28, 20, 28, 6); g.fill(); drawIcon(g, ['heart', 'star', 'leaf'][o.n], cx, by - 14, 14, lit ? '#fff' : col); }
}

// ---------------- events ----------------
function onEvent(W, n, d) {
  const S = W.sp; if (!S) return; const R = S.run, P = W.player;
  if (n === 'attack') { AI.onPlayerAttack(W); return; }
  if (!R) return;
  if (n === 'hurt') { R.hits++; if (W.mode === 'boss') R.bossHits++; if (has(W, 'thorns')) aoe(W, P.cx, P.cy, 75, 20, '#a6f05a'); }
  if (n === 'parry' || n === 'perfectDodge') { if (n === 'parry' && has(W, 'echo')) aoe(W, P.cx, P.cy, 95, 26, '#bfa6ff'); if (S.orbCd <= 0) { S.orbCd = 2.2; S.orbs.push({ x: P.cx + P.face * 30, y: P.cy - 20, vy: -60, t: 0 }); } }
  if (n === 'dash' && has(W, 'volt')) S.volt = { t: 0.3, hit: new Set() };
  if (n === 'kill' && d) { R.kills++; if (has(W, 'bloom')) P.hp = Math.min(P.maxHp, P.hp + Math.max(1, Math.round(P.maxHp * 0.03)));
    if (has(W, 'magnet')) W.dropGlims(d.cx, d.cy, 2);
    if (has(W, 'chain')) { let best = null, bd = 170; for (const e of W.enemies) if (e !== d && !e.dead && !e.boss) { const dd = Math.hypot(e.cx - d.cx, e.cy - d.cy); if (dd < bd) { bd = dd; best = e; } } if (best) { S.bolts.push({ x1: d.cx, y1: d.cy, x2: best.cx, y2: best.cy, t: 0.25, col: '#ffd36a' }); W.hitEnemy(best, { dmg: 18, kb: 120, src: 'burn' }, null); } }
    if (d.mimic) { W.dropGlims(d.cx, d.cy, 10); S.pending = 0.9; S.pendingWhy = 'The mimic dropped a boon!'; }
    if (d.hunter) { W.dropGlims(d.cx, d.cy, 14); W.pickups.push({ kind: 'heart', x: d.cx, y: d.cy - 10, vx: 0, vy: -200, t: 0 }); S.pending = 1; S.pendingWhy = 'Hunter bounty! Pick a boon'; banner(W, 'HUNTER DOWN!', 'Bounty: glimmers, a heart and a boon', '#ff7ad8'); }
  }
  if (n === 'miniboss') { S.pending = 1.6; S.pendingWhy = 'Warden reward: pick a boon'; }
  if (n === 'secret') checkPockets(W, true);
}
function aoe(W, x, y, r, dmg, col) { W.fx.ring(x, y, r, col, 0.35, 5); for (const e of W.enemies) if (!e.dead && Math.hypot(e.cx - x, e.cy - y) < r + e.w / 2) W.hitEnemy(e, { dmg, kb: 220, src: 'burn' }, null); }
function spawn(W, type, x, y) { const n = W.enemies.length; W.spawnEnemy(type, x, y); const e = W.enemies[n]; if (!e) return null; if (W.sp.run && W.sp.run.foeHp !== 1) { e.hp = Math.round(e.hp * W.sp.run.foeHp); e.maxHp = e.hp; } return e; }
export function spawnHunter(W, forced) {
  if (!W.sp || W.mode !== 'run' || W.player.dead) return; const P = W.player, D = diff(); let x = P.cx - P.face * 220; if (W.map.solidPx(x, P.cy) || W.map.solidPx(x, P.y)) x = P.cx + P.face * 160; if (W.map.solidPx(x, P.cy)) x = P.cx;
  W.addMarker({ kind: 'circle', x, y: W.groundY(x, P.y) - 2, r: 30, life: 1.2 });
  W.sp.hunterIn = { t: 1.2, x, y: W.groundY(x, P.y) }; banner(W, 'A THORN HUNTER IS TRACKING YOU!', forced ? 'The shrine called it. Beat it for a bounty!' : 'It follows you room to room. Beat it for a bounty!', '#ff7ad8'); sfx('roar'); void D;
}
export function banner(W, text, sub, col = '#ffe27a') { if (W.sp) W.sp.banner = { text, sub, col, t: 3.2 }; }

function startCellEvent(W, e, c) {
  const S = W.sp, D = diff(); W.opened.add(e.id); const ox = c.x * CW * TILE, oy = c.y * CH * TILE, ev = { k: e.k, t: 0, c, ox, oy, life: 0, n: 0, next: 1.4 };
  if (e.k === 'ambush') { ev.life = 99; ev.spots = cellSpots(W.map, c).filter((s) => Math.abs(s.x * TILE - W.player.cx) > 110).sort(() => rand() - 0.5).slice(0, 2 + Math.min(2, D.smart || 0)); for (const s of ev.spots) W.addMarker({ kind: 'circle', x: s.x * TILE + 12, y: (s.y + 1) * TILE - 2, r: 28, life: 1.1 }); banner(W, 'AMBUSH!', 'Portals are opening - get ready!', '#ff5a7a'); sfx('roar'); }
  if (e.k === 'storm') { ev.life = 13; banner(W, 'THUNDERSTORM!', 'Lightning strikes where the red light glows', '#8ff6ff'); }
  if (e.k === 'blight') { ev.life = 12; banner(W, 'BLIGHT SURGE!', 'Spikes burst from red circles - keep moving', '#bf7aff'); }
  if (e.k === 'fireflies') { ev.life = 99; const sp = cellSpots(W.map, c, 3); for (let i = 0; i < 7 && sp.length; i++) { const s = sp[Math.floor(rand() * sp.length)]; S.flies.push({ x: s.x * TILE + 12, y: (s.y - 1 - rand() * 3) * TILE, hx: s.x * TILE + 12, hy: (s.y - 1 - rand() * 3) * TILE, ph: rand() * 6, cell: c }); } ev.total = S.flies.length; banner(W, 'Fireflies!', 'Catch them all for a reward', '#ffe27a'); }
  if (e.k === 'flood' ) { ev.life = 14; S.water = { base: oy + (CH - 2) * TILE, y: oy + (CH - 2) * TILE, top: oy + (CH - 2) * TILE - (CH * TILE) * 0.3, t: 0, life: 14, ox, w: CW * TILE, warn: 1.8 }; banner(W, 'FLASH FLOOD!', 'The water is rising - climb up high!', '#8ff6ff'); }
  if (e.k === 'collapse') { ev.life = 99; ev.collapse = 3.5; banner(W, 'Crumbly planks!', 'Planks shake, then fall. Keep moving!', '#ffb36a'); }
  if (e.k === 'hunter') { ev.life = 0.1; if (!W.enemies.some((x) => x.hunter && !x.dead)) spawnHunter(W, false); }
  S.active.push(ev);
}
function startSet(W, c) {
  const S = W.sp, set = S.set, D = diff(); if (!set) return; W.opened.add('set' + set.cell); S.set = null; const ox = c.x * CW * TILE, oy = c.y * CH * TILE, P = W.player, from = P.cx < ox + CW * TILE / 2 ? -1 : 1; W.emit('setPiece', set.k);
  const ev = { k: 'set:' + set.k, t: 0, c, ox, oy, life: 99, n: 0, next: 1.6 }; S.active.push(ev);
  if (set.k === 'logchase') { ev.from = -from; ev.left = 3 + Math.min(3, D.smart || 0); banner(W, 'ROLLING LOGS!', 'Logs come rolling - JUMP over them!', '#ffb36a'); }
  if (set.k === 'sporeflood') { ev.life = 16; S.water = { base: oy + (CH - 2) * TILE, y: oy + (CH - 2) * TILE, top: oy + (CH - 2) * TILE - CH * TILE * 0.42, t: 0, life: 16, ox, w: CW * TILE, warn: 2.2, spore: 1 }; banner(W, 'THE GLOW-TIDE RISES!', 'Climb the platforms before the water rises!', '#8ff6ff'); }
  if (set.k === 'bridge') { ev.collapse = 5; ev.gust = 3; banner(W, 'THE OLD BRIDGE!', 'Planks fall behind you and the wind pushes - hurry!', '#ffb36a'); }
  if (set.k === 'canopy') { ev.life = 14; banner(W, 'FALLING BRANCHES!', 'Watch the shadows on the ground', '#a6f05a'); }
  if (set.k === 'dark') { ev.life = 99; S.dark = 1; ev.moths = 2 + (D.smart || 0); banner(W, 'LIGHTS OUT!', 'Only your glow lights the way. Listen for wings...', '#bfa6ff'); }
  if (set.k === 'escape') { const sp = D.smart >= 2 ? 112 : D.smart >= 1 ? 98 : 70; S.wall = { x: from < 0 ? ox - 40 : ox + CW * TILE + 40, dir: -from, v: sp, t: -1.6, ox, oy, end: from < 0 ? ox + CW * TILE - 70 : ox + 70, c }; banner(W, 'RUN!', 'The Blight wave is coming - get to the other side!', '#ff5a7a'); sfx('roar'); W.fx.shake(0.6); }
}
export function onEnterCell(W, c) {
  const S = W.sp; if (!S || W.mode !== 'run' || !S.run) return; const idx = W.cells.indexOf(c); if (idx === S.cur) return; S.cur = idx;
  for (const ev of S.active) if (ev.c !== c && ev.k !== 'hunter') ev.leave = true; // events end when you leave their room
  const e = S.cellEv.get(idx); if (e && !W.opened.has(e.id)) { S.cellEv.delete(idx); startCellEvent(W, e, c); }
  if (S.set && S.set.cell === idx) startSet(W, c);
  if (S.run.map) for (const q of S.pockets) if (q.cell === idx && !q.done) W.fx.text(q.ex * TILE + 12, q.ey * TILE - 20, 'hollow wall!', '#8ff6ff', 13);
}
function dmgP(W, dmg, x, name, tip) { return W.damagePlayer(Math.round(dmg), x, { name, tip, src: { cx: x } }); }
const inCell = (W, c, x, y) => x >= c.x * CW * TILE && x < (c.x + 1) * CW * TILE && y >= c.y * CH * TILE && y < (c.y + 1) * CH * TILE;
function updEvent(W, ev, dt) {
  const S = W.sp, P = W.player, D = diff(), k = ev.k; ev.t += dt; const here = inCell(W, ev.c, P.cx, P.cy);
  if (k === 'ambush') { if (ev.t > 1.1 && !ev.spawned) { ev.spawned = 1; const ty = TYPES[W.chapter || (W.stage ? 2 : 1)] || TYPES[1]; ev.foes = ev.spots.map((s, i) => spawn(W, ty[(i + (W.seed >>> 2)) % ty.length], s.x * TILE + 12, (s.y + 1) * TILE)).filter(Boolean); }
    if (ev.spawned && ev.foes.every((e) => e.dead)) { ev.done = 1; W.dropGlims(P.cx, P.y - 10, 6); W.fx.text(P.cx, P.y - 30, 'Ambush cleared!', '#ffe27a', 15); } return; }
  if (k === 'storm' && here) { ev.next -= dt; if (ev.next <= 0) { ev.next = (1.6 + rand() * 0.6) / Math.max(0.8, D.aggro || 1); const x = clamp(P.cx + (rand() - 0.5) * 300 + P.vx * 0.5, ev.ox + 40, ev.ox + CW * TILE - 40), gy = W.groundY(x, P.y); W.addMarker({ kind: 'zone', x: x - 20, y: gy - 230, w: 40, h: 230, life: 0.9 }); S.drops.push({ kind: 'bolt', x, y: gy, t: 0, at: 0.9 }); } }
  if (k === 'blight' && here) { ev.next -= dt; if (ev.next <= 0) { ev.next = 1.5 / Math.max(0.8, D.aggro || 1); for (let i = 0; i < 1 + (D.smart >= 2 ? 1 : 0); i++) { const x = clamp(P.cx + (rand() - 0.5) * 220 + P.vx * 0.4, ev.ox + 40, ev.ox + CW * TILE - 40), gy = W.groundY(x, P.y); W.addMarker({ kind: 'circle', x, y: gy - 2, r: 30, life: 1.0 }); S.drops.push({ kind: 'spike', x, y: gy, t: 0, at: 1.0 }); } } }
  if (k === 'fireflies') { if (!S.flies.some((f) => f.cell === ev.c)) { ev.done = 1; S.orbs.push({ x: P.cx, y: P.cy - 30, vy: -60, t: 0 }, { x: P.cx + 20, y: P.cy - 30, vy: -80, t: 0 }); W.dropGlims(P.cx, P.y, 6); banner(W, 'All fireflies caught!', 'They give you sap and glimmers', '#ffe27a'); } return; }
  if ((k === 'collapse' || k === 'set:bridge') && here) { crumble(W, ev.collapse, dt); if (ev.gust !== undefined) { ev.gust -= dt; if (ev.gust <= 0 && !S.gust) { S.gust = { t: -1.0, dir: rand() < 0.5 ? -1 : 1, life: 1.5 }; ev.gust = 4 + rand() * 2; } } }
  if (k === 'set:canopy' && here) { ev.next -= dt; if (ev.next <= 0) { ev.next = 1.1 / Math.max(0.8, D.aggro || 1); const x = clamp(P.cx + (rand() - 0.5) * 260 + P.vx * 0.5, ev.ox + 40, ev.ox + CW * TILE - 40), gy = W.groundY(x, P.y); W.addMarker({ kind: 'shadow', x: x - 18, y: gy, w: 36, life: 0.9 }); S.drops.push({ kind: 'rock', x, y: gy, t: 0, at: 0.9 }); } }
  if (k === 'set:logchase' && here) { ev.next -= dt; if (ev.next <= 0 && ev.left > 0) { ev.left--; ev.next = 2.3 / Math.max(0.85, D.aggro || 1); const x = ev.from > 0 ? ev.ox + CW * TILE - 50 : ev.ox + 50; S.logs.push({ x, y: W.groundY(x, P.y) - 22, vx: -ev.from * (190 + 25 * (D.smart || 0)), vy: 0, r: 22, warn: 0.9, rot: 0, ox: ev.ox }); sfx('telegraph'); }
    if (ev.left <= 0 && !S.logs.length) { ev.done = 1; banner(W, 'You outran the logs!', '', '#a6f05a'); W.dropGlims(P.cx, P.y, 6); } }
  if (k === 'set:dark') { if (ev.t > 3 && ev.moths > 0) { ev.moths--; ev.t = 1.2; const x = P.cx + (ev.moths % 2 ? 200 : -200); W.addMarker({ kind: 'circle', x, y: P.y - 40, r: 26, life: 0.9 }); S.later.push({ t: 0.9, type: 'moth', x, y: P.y - 20 }); sfx('telegraph'); } }
  if (k === 'set:escape' && S.wall && S.wall.done) { ev.done = 1; S.wall = null; banner(W, 'You escaped!', 'The wave fades away', '#a6f05a'); W.dropGlims(P.cx, P.y, 8); }
  if (ev.life && ev.t > ev.life) ev.done = 1;
}
function crumble(W, delay, dt) { // planks under Sprig shake (telegraph) then fall; they always grow back
  const S = W.sp, P = W.player; if (!P.onGround) return; const ty = Math.floor((P.y + P.h + 2) / TILE), tx = Math.floor(P.cx / TILE);
  if (W.map.get(tx, ty) !== '=' || S.fall.some((f) => f.y === ty && Math.abs(f.x - tx) < 1)) return;
  let a = tx, b = tx; while (W.map.get(a - 1, ty) === '=' && tx - a < 3) a--; while (W.map.get(b + 1, ty) === '=' && b - tx < 3) b++;
  for (let x = a; x <= b; x++) if (!S.fall.some((f) => f.x === x && f.y === ty)) S.fall.push({ x, y: ty, t: 0, shake: 0.55, back: delay }); sfx('telegraph'); void dt;
}
export function update(W, dt) {
  const S = W.sp; if (!S) return; S.t += dt; const P = W.player, D = diff(); if (S.banner && (S.banner.t -= dt) <= 0) S.banner = null; if (S.orbCd > 0) S.orbCd -= dt;
  if (!S.run) return;
  if (S.pending > 0 && (S.pending -= dt) <= 0 && !P.dead) offerBoons(W, S.pendingWhy || 'Pick a boon!');
  for (const ev of S.active) { if (ev.leave && ev.k !== 'ambush' && ev.k !== 'fireflies') ev.done = 1; if (!ev.done) updEvent(W, ev, dt); }
  S.active = S.active.filter((e) => !e.done); if (!S.active.some((e) => e.k === 'set:dark')) S.dark = Math.max(0, S.dark - dt * 2);
  for (const l of S.later) if ((l.t -= dt) <= 0) { l.done = 1; spawn(W, l.type, l.x, l.y); } S.later = S.later.filter((l) => !l.done);
  if (S.hunterLater > 0 && (S.hunterLater -= dt) <= 0) spawnHunter(W, true);
  // hunter entrance
  if (S.hunterIn && (S.hunterIn.t -= dt) <= 0) { const h = S.hunterIn; S.hunterIn = null; const e = spawn(W, 'hunter', h.x, h.y); if (e) { e.hunter = true; const k = (1 + 0.15 * (W.chapter || 1)) * (D.hp || 1); e.hp = e.maxHp = Math.round(150 * k * (W.sp.run.foeHp || 1)); e.cell = -1; } }
  // drops: bolts, spikes, rocks (telegraphed by markers spawned with them)
  for (const d of S.drops) { d.t += dt; if (d.t >= d.at && !d.hit) { d.hit = 1; const w = d.kind === 'spike' ? 30 : 20, box = { x: d.x - w, y: d.y - (d.kind === 'bolt' ? 230 : 56), w: w * 2, h: d.kind === 'bolt' ? 230 : 56 };
    if (rectsOverlap(box, P)) dmgP(W, d.kind === 'bolt' ? 14 : 12, d.x, d.kind === 'bolt' ? 'Lightning' : d.kind === 'spike' ? 'Blight Spikes' : 'Falling Branch', d.kind === 'bolt' ? 'Step out of the glowing red column!' : 'Keep moving when red marks appear!');
    for (const e of W.enemies) if (!e.dead && !e.boss && rectsOverlap(box, e)) W.hitEnemy(e, { dmg: 30, kb: 200, src: 'hazard' }, null);
    if (d.kind === 'bolt') { W.fx.flash = Math.max(W.fx.flash || 0, 0.25); W.fx.flashColor = '#cfe8ff'; sfx('explode'); W.fx.shake(0.2); } else { W.fx.burst(d.x, d.y - 4, 10, { color: d.kind === 'spike' ? ['#bf7aff', '#5a2a7a'] : ['#7a5a3a', '#a6f05a'], max: 220, size: 5 }); sfx('thump'); } } }
  S.drops = S.drops.filter((d) => d.t < d.at + 0.35);
  // trap room: rocks + 2 foes, then the real treasure
  const T = S.trap; if (T && !T.done) { T.t += dt; if (T.t < 6.5) { T.nx = (T.nx || 0) - dt; if (T.nx <= 0) { T.nx = 0.65 / Math.max(0.8, D.aggro || 1); const x = clamp(P.cx + (rand() - 0.5) * 240 + P.vx * 0.4, P.cx - 200, P.cx + 200), gy = W.groundY(x, P.y); if (!W.map.solidPx(x, gy - 10)) { W.addMarker({ kind: 'shadow', x: x - 18, y: gy, w: 36, life: 0.85 }); S.drops.push({ kind: 'rock', x, y: gy, t: 0, at: 0.85 }); } } }
    if (T.t > 1.2 && !T.sp) { T.sp = 1; const ty = TYPES[W.chapter || 1] || TYPES[1]; for (const dx of [-150, 150]) { const x = T.x + dx; if (!W.map.solidPx(x, T.y - 20)) { W.addMarker({ kind: 'circle', x, y: T.y - 2, r: 26, life: 1 }); T.foes.push({ x, at: T.t + 1, type: ty[(dx > 0) | 0] }); } } }
    for (const f of T.foes) if (!f.e && T.t > f.at) f.e = spawn(W, f.type, f.x, T.y) || { dead: true };
    if (T.t > 6.5 && T.foes.every((f) => f.e && f.e.dead)) { T.done = 1; banner(W, 'You survived!', 'Here is the REAL treasure', '#ffe27a'); W.dropGlims(T.x, T.y - 20, 14); S.pending = 0.8; S.pendingWhy = 'Trap survived! Pick a boon'; S.trap = null; } }
  // logs
  for (const L of S.logs) { if (L.warn > 0) { L.warn -= dt; continue; } L.x += L.vx * dt; L.rot += L.vx * dt / L.r; const gy = W.groundY(L.x, L.y + L.r - 4); if (gy > L.y + L.r + 2) { L.vy += 900 * dt; L.y += L.vy * dt; } else { L.y = gy - L.r; L.vy = 0; }
    if (W.map.solidPx(L.x + Math.sign(L.vx) * L.r, L.y)) L.gone = 1; if (Math.hypot(P.cx - L.x, P.cy - L.y) < L.r + 14) dmgP(W, 14, L.x, 'Rolling Log', 'Jump right over the logs!');
    for (const e of W.enemies) if (!e.dead && !e.boss && Math.abs(e.cx - L.x) < L.r + e.w / 2 && Math.abs(e.cy - L.y) < L.r + e.h / 2 && !(L.hit || (L.hit = new Set())).has(e)) { L.hit.add(e); W.hitEnemy(e, { dmg: 30, kb: 260, src: 'hazard' }, null); } }
  S.logs = S.logs.filter((L) => !L.gone && Math.abs(L.x - L.ox - CW * TILE / 2) < CW * TILE / 2 + 30 && L.y < W.map.h * TILE);
  // falling planks
  for (const f of S.fall) { f.t += dt; if (f.t >= f.shake && !f.down) { f.down = 1; W.setTile(f.x, f.y, '.'); W.fx.burst(f.x * TILE + 12, f.y * TILE + 6, 6, { color: ['#8a6a4a', '#5a4030'], max: 160, size: 5, g: 700 }); } if (f.down && f.t >= f.shake + f.back) { const pb = { x: f.x * TILE, y: f.y * TILE, w: TILE, h: TILE }; if (!rectsOverlap(pb, P)) { W.setTile(f.x, f.y, '='); f.gone = 1; } } }
  S.fall = S.fall.filter((f) => !f.gone);
  // gust
  if (S.gust) { S.gust.t += dt; if (S.gust.t > 0) { P.vx += S.gust.dir * 520 * dt; P.x += S.gust.dir * 60 * dt; } if (S.gust.t > S.gust.life) S.gust = null; }
  // water
  const Wt = S.water; if (Wt) { Wt.t += dt; const k = Wt.t < Wt.warn ? 0 : Wt.t > Wt.life - 2 ? clamp((Wt.life - Wt.t) / 2, 0, 1) : clamp((Wt.t - Wt.warn) / 5, 0, 1); Wt.y = Wt.base + (Wt.top - Wt.base) * k;
    if (P.y + P.h > Wt.y + 14 && P.cx > Wt.ox && P.cx < Wt.ox + Wt.w) { Wt.tick = (Wt.tick || 0) - dt; if (Wt.tick <= 0) { Wt.tick = 0.9; dmgP(W, Wt.spore ? 8 : 6, P.cx, Wt.spore ? 'Glow-Tide' : 'Flood Water', 'Climb up when the water rises!'); } }
    if (Wt.t > Wt.life || (S.cur >= 0 && !inCell(W, W.cells[S.cur], Wt.ox + 10, Wt.base - 10))) S.water = null; }
  // escape wall
  const Wl = S.wall; if (Wl && !Wl.done) { Wl.t += dt; if (Wl.t > 0) { Wl.x += Wl.dir * Wl.v * dt; if ((Wl.dir > 0 && Wl.x >= Wl.end) || (Wl.dir < 0 && Wl.x <= Wl.end)) Wl.done = 1; }
    const behind = Wl.dir > 0 ? P.cx < Wl.x : P.cx > Wl.x; if (Wl.t > 0 && behind && Math.abs(P.cy - (Wl.oy + CH * TILE / 2)) < CH * TILE / 2) { dmgP(W, 12, Wl.x - Wl.dir * 30, 'Blight Wave', 'Run! Keep ahead of the purple wave.'); P.vx = Wl.dir * 420; P.x += Wl.dir * 10; }
    if (!inCell(W, Wl.c, P.cx, P.cy) && Wl.t > 0) Wl.done = 1; }
  // flies
  for (const f of S.flies) { f.ph += dt; f.x = f.hx + Math.sin(f.ph * 1.3) * 26; f.y = f.hy + Math.cos(f.ph * 1.7) * 14; if (Math.hypot(P.cx - f.x, P.cy - f.y) < 28) { f.got = 1; sfx('pickup'); W.fx.burst(f.x, f.y, 6, { color: ['#ffe27a', '#fff'], max: 120, kind: 'star', size: 4 }); } }
  S.flies = S.flies.filter((f) => !f.got);
  // sap orbs
  const heal = (D.orb || 0.07) * (1 + 0); for (const o of S.orbs) { o.t += dt; o.vy = Math.min(o.vy + 200 * dt, 40); o.y += o.vy * dt; const dx = P.cx - o.x, dy = P.cy - o.y, d = Math.hypot(dx, dy); if (d < 120 && o.t > 0.3) { o.x += dx / d * 260 * dt; o.y += dy / d * 260 * dt; } if (d < 22) { o.got = 1; const h = Math.max(2, Math.round(P.maxHp * heal)); P.hp = Math.min(P.maxHp, P.hp + h); sfx('pickup'); W.fx.text(P.cx, P.y - 10, '+' + h, '#9dff8a', 13); } }
  S.orbs = S.orbs.filter((o) => !o.got && o.t < 8);
  // volt dash
  if (S.volt) { S.volt.t -= dt; for (const e of W.enemies) if (!e.dead && !S.volt.hit.has(e) && rectsOverlap({ x: P.x - 8, y: P.y, w: P.w + 16, h: P.h }, e)) { S.volt.hit.add(e); S.bolts.push({ x1: P.cx, y1: P.cy, x2: e.cx, y2: e.cy, t: 0.2, col: '#8ff6ff' }); W.hitEnemy(e, { dmg: 14, kb: 140, src: 'burn' }, null); } if (S.volt.t <= 0) S.volt = null; }
  for (const b of S.bolts) b.t -= dt; S.bolts = S.bolts.filter((b) => b.t > 0);
  // burning foes
  for (const e of W.enemies) if (e.burn > 0 && !e.dead) { e.burn -= dt; e.burnTick = (e.burnTick || 0) - dt; if (e.burnTick <= 0) { e.burnTick = 0.5; W.hitEnemy(e, { dmg: 4, kb: 0, src: 'burn' }, null); W.fx.burst(e.cx, e.cy, 3, { color: ['#ffb36a', '#ff5a3a'], max: 80, size: 4 }); } }
  checkPockets(W, false, dt);
  // rank (live, shown on the HUD)
  const t = W.game && W.game.runTime ? W.game.runTime() : S.t, R = S.run, par = 300 + 60 * (W.chapter || 2);
  S.score = Math.round(1000 + 12 * R.kills + 200 * R.secrets - 30 * R.hits - 220 * R.deaths - Math.max(0, t - par) * 1.2); S.rank = S.score >= 1500 ? 'S' : S.score >= 1150 ? 'A' : S.score >= 800 ? 'B' : 'C';
}
function checkPockets(W, broke, dt = 0) {
  const S = W.sp, P = W.player; for (const q of S.pockets) { if (q.done) continue; const open = W.map.get(q.ex, q.ey) === '.';
    if (open && !q.found) { q.found = 1; if (broke) banner(W, 'A HIDDEN ROOM!', q.game === 'runes' ? 'Tap the runes in the order they glow' : q.game === 'fireflies' ? 'Catch the fireflies before they fly away!' : 'Something shiny inside...', '#8ff6ff'); }
    const inside = open && P.cx > q.ix * TILE - 8 && P.cx < (q.ix + q.iw) * TILE + 8 && P.cy > q.iy * TILE - 8 && P.cy < (q.iy + q.ih) * TILE + 8;
    if (q.game === 'runes' && inside) { if (!q.seq.length) { const rng = makeRng((W.seed ^ q.ex * 31) >>> 0); q.seq = rng.shuffle([0, 1, 2]).concat([rng.int(0, 2)]); q.showT = 2.6; }
      if (q.showT > 0) { q.showT -= dt; const i = Math.floor((2.6 - q.showT) / 0.6); q.flash = i < q.seq.length && ((2.6 - q.showT) % 0.6) < 0.45 ? q.seq[i] : -1; } else q.flash = -1; }
    if (q.game === 'fireflies' && inside && !q.on) { q.on = 1; q.t = 9; for (let i = 0; i < 5; i++) S.flies.push({ x: 0, y: 0, hx: (q.ix + 0.6 + (q.iw - 1.2) * i / 4) * TILE, hy: (q.iy + 0.5 + (i % 2)) * TILE, ph: i, pk: q.id }); }
    if (q.game === 'fireflies' && q.on) { q.t -= dt; if (!S.flies.some((f) => f.pk === q.id)) winPocket(W, q.id); else if (q.t <= 0) { q.on = 0; S.flies = S.flies.filter((f) => f.pk !== q.id); W.fx.text(P.cx, P.y - 20, 'They flew off! Step out and try again', '#ffb36a', 13); } }
  }
}

// ---------------- drawing ----------------
export function drawWorld(g, W) {
  const S = W.sp; if (W.boss && W.boss.drawThorns) W.boss.drawThorns(g, W); if (!S) return; const t = W.t;
  for (const q of S.pockets) if (!q.done && (W.map.get(q.ex, q.ey) === 'B' ? (S.run && S.run.map) || ((t * 0.7 + q.ex) % 4) < 0.5 : false)) { const x = q.ex * TILE + 12, y = q.ey * TILE; drawGlow(g, x, y, 26, '#8ff6ff', 0.35); }
  if (S.water) { const Wt = S.water; g.save(); g.globalAlpha = 0.55; g.fillStyle = Wt.spore ? '#3a8a9a' : '#2a6a9a'; g.fillRect(Wt.ox, Wt.y, Wt.w, Wt.base + 2 * TILE - Wt.y); g.globalAlpha = 0.9; g.strokeStyle = Wt.spore ? '#8ff6ff' : '#bfe8ff'; g.lineWidth = 3; g.beginPath(); for (let x = Wt.ox; x <= Wt.ox + Wt.w; x += 16) g.lineTo(x, Wt.y + Math.sin(t * 3 + x * 0.05) * 3); g.stroke(); if (Wt.t < Wt.warn) { g.fillStyle = '#fff'; g.font = '900 16px system-ui'; g.textAlign = 'center'; g.globalAlpha = 0.6 + 0.4 * Math.sin(t * 12); g.fillText('WATER RISING!', W.player.cx, W.player.y - 50); } g.restore(); }
  for (const L of S.logs) { g.save(); if (L.warn > 0) { g.globalAlpha = 0.5 + 0.5 * Math.sin(t * 20); drawIcon(g, L.vx > 0 ? 'right' : 'left', L.x, L.y - 40, 30, '#ff5a70'); g.fillStyle = '#ff5a70'; g.font = '900 14px system-ui'; g.textAlign = 'center'; g.fillText('LOG!', L.x, L.y - 62); g.globalAlpha = 0.35; }
    g.translate(L.x, L.y); g.rotate(L.rot); g.fillStyle = '#7a5434'; g.beginPath(); g.arc(0, 0, L.r, 0, 7); g.fill(); g.strokeStyle = '#3a2418'; g.lineWidth = 3; g.stroke(); g.strokeStyle = '#c8a070'; g.lineWidth = 2; g.beginPath(); g.arc(0, 0, L.r * 0.55, 0, 7); g.moveTo(L.r * 0.2, 0); g.arc(0, 0, L.r * 0.2, 0, 7); g.stroke(); g.restore(); }
  for (const f of S.fall) { const x = f.x * TILE, y = f.y * TILE; if (!f.down) { g.fillStyle = 'rgba(255,90,112,' + (0.35 + 0.3 * Math.sin(t * 30)) + ')'; g.fillRect(x + Math.sin(t * 50) * 2, y - 2, TILE, 6); } }
  for (const d of S.drops) { if (d.t < d.at) { if (d.kind === 'rock') { const k = d.t / d.at, y = d.y - 260 + 260 * k * k; g.fillStyle = '#6a5a4a'; g.beginPath(); g.ellipse(d.x, y - 14, 14, 12, k * 4, 0, 7); g.fill(); } }
    else if (d.kind === 'bolt' && d.t < d.at + 0.18) { g.save(); g.strokeStyle = '#eaf6ff'; g.lineWidth = 5; g.shadowColor = '#8ff6ff'; g.shadowBlur = 16; g.beginPath(); let x = d.x; g.moveTo(x, d.y - 240); for (let y = d.y - 220; y <= d.y; y += 20) { x = d.x + (rand() - 0.5) * 22; g.lineTo(x, y); } g.stroke(); g.restore(); }
    else if (d.kind === 'spike' && d.t < d.at + 0.35) { g.fillStyle = '#bf7aff'; for (let i = -2; i <= 2; i++) { g.beginPath(); g.moveTo(d.x + i * 12 - 6, d.y); g.lineTo(d.x + i * 12, d.y - 40 + Math.abs(i) * 8); g.lineTo(d.x + i * 12 + 6, d.y); g.fill(); } } }
  if (S.wall) { const Wl = S.wall, x = Wl.x, top = Wl.oy, h = CH * TILE; g.save(); const gr = g.createLinearGradient(x - Wl.dir * 160, 0, x, 0); gr.addColorStop(0, 'rgba(60,10,80,0.95)'); gr.addColorStop(1, 'rgba(160,60,220,0.0)'); g.fillStyle = gr; g.fillRect(Math.min(x, x - Wl.dir * 600), top, 600, h); g.fillStyle = '#bf7aff'; for (let y = top; y < top + h; y += 22) { const w = 14 + Math.sin(t * 8 + y) * 8; g.beginPath(); g.ellipse(x, y, w, 10, 0, 0, 7); g.fill(); } g.restore(); }
  if (S.gust && S.gust.t < 0) { g.save(); g.globalAlpha = 0.7; g.fillStyle = '#fff'; g.font = '900 15px system-ui'; g.textAlign = 'center'; g.fillText('WIND!', W.player.cx, W.player.y - 50); drawIcon(g, S.gust.dir > 0 ? 'right' : 'left', W.player.cx, W.player.y - 74, 26, '#bfe8ff'); g.restore(); }
  else if (S.gust) { g.save(); g.strokeStyle = 'rgba(220,240,255,0.5)'; g.lineWidth = 2; for (let i = 0; i < 8; i++) { const y = W.player.y - 60 + i * 14, x = W.player.cx + ((t * 600 * S.gust.dir + i * 97) % 500) - 250; g.beginPath(); g.moveTo(x, y); g.lineTo(x - S.gust.dir * 40, y); g.stroke(); } g.restore(); }
  for (const f of S.flies) { drawGlow(g, f.x, f.y, 18, '#ffe27a', 0.7); g.fillStyle = '#fff6c0'; g.beginPath(); g.arc(f.x, f.y, 3, 0, 7); g.fill(); }
  for (const o of S.orbs) { drawGlow(g, o.x, o.y, 22, '#9dff8a', 0.7); g.fillStyle = '#d8ffcc'; g.beginPath(); g.arc(o.x, o.y, 5 + Math.sin(o.t * 8), 0, 7); g.fill(); }
  for (const b of S.bolts) { g.save(); g.strokeStyle = b.col; g.lineWidth = 3; g.shadowColor = b.col; g.shadowBlur = 10; g.beginPath(); g.moveTo(b.x1, b.y1); g.lineTo((b.x1 + b.x2) / 2 + (rand() - 0.5) * 20, (b.y1 + b.y2) / 2 + (rand() - 0.5) * 20); g.lineTo(b.x2, b.y2); g.stroke(); g.restore(); }
  for (const e of W.enemies) if (e.burn > 0 && !e.dead) drawGlow(g, e.cx, e.cy, 22, '#ff8a3a', 0.5);
  if (S.dark > 0.01) { const P = W.player, vx = W.cam.x - 50, vy = W.cam.y - 50, vw = (W.viewW || 800) + 100, vh = (W.viewH || 500) + 100; g.save(); g.globalAlpha = 0.9 * S.dark; const gr = g.createRadialGradient(P.cx, P.cy, 60, P.cx, P.cy, 190); gr.addColorStop(0, 'rgba(6,4,14,0)'); gr.addColorStop(1, 'rgba(6,4,14,1)'); g.fillStyle = gr; g.fillRect(vx, vy, vw, vh); g.restore();
    for (const e of W.enemies) if (!e.dead) { g.fillStyle = '#ff5a7a'; g.beginPath(); g.arc(e.cx - 4, e.y + 10, 2.4, 0, 7); g.arc(e.cx + 4, e.y + 10, 2.4, 0, 7); g.fill(); if (AI.attacking(e)) drawGlow(g, e.cx, e.cy, 40, '#ff3d6e', 0.6); } }
}
export function drawScreen(g, W, cw, ch, s) {
  const S = W.sp; if (!S) return; g.save(); g.textAlign = 'center';
  if (S.banner) { const B = S.banner, a = Math.min(1, B.t * 2, (3.2 - B.t) * 5), w = Math.min(cw * 0.86, 520 * s); g.globalAlpha = a; g.fillStyle = 'rgba(10,8,18,0.72)'; g.beginPath(); g.roundRect(cw / 2 - w / 2, ch * 0.3 - 30 * s, w, B.sub ? 62 * s : 44 * s, 16 * s); g.fill(); g.strokeStyle = B.col; g.lineWidth = 2.5 * s; g.stroke();
    g.fillStyle = B.col; g.font = `900 ${21 * s}px system-ui,sans-serif`; g.fillText(B.text, cw / 2, ch * 0.3 - 2 * s); if (B.sub) { g.fillStyle = '#fff'; g.font = `700 ${12.5 * s}px system-ui,sans-serif`; g.fillText(B.sub, cw / 2, ch * 0.3 + 19 * s); } g.globalAlpha = 1; }
  if (S.run && W.mode !== 'hub') { const x = cw - 40 * s, y = 96 * s, col = { S: '#ffe27a', A: '#9dff8a', B: '#8ff6ff', C: '#ffb3c8' }[S.rank]; g.fillStyle = 'rgba(10,8,18,0.55)'; g.beginPath(); g.roundRect(x - 26 * s, y - 20 * s, 52 * s, 42 * s, 10 * s); g.fill(); g.fillStyle = '#cfc8e0'; g.font = `800 ${8.5 * s}px system-ui`; g.fillText('RANK', x, y - 7 * s); g.fillStyle = col; g.font = `900 ${20 * s}px system-ui`; g.fillText(S.rank, x, y + 14 * s);
    const R = S.run; let yy = y + 32 * s; if (R.cont < 99) { g.fillStyle = 'rgba(10,8,18,0.55)'; g.beginPath(); g.roundRect(x - 26 * s, yy - 12 * s, 52 * s, 20 * s, 8 * s); g.fill(); g.fillStyle = '#ffd0dc'; g.font = `800 ${10 * s}px system-ui`; g.fillText('♥ x' + R.cont, x, yy + 2 * s); yy += 24 * s; }
    if (R.boons.length) { const u = [...new Set(R.boons)]; u.forEach((b, i) => { const bx = x + 14 * s - (i % 3) * 18 * s, by = yy + Math.floor(i / 3) * 18 * s; g.fillStyle = BOONS[b].c; g.globalAlpha = 0.9; g.beginPath(); g.arc(bx, by, 7 * s, 0, 7); g.fill(); g.globalAlpha = 1; drawIcon(g, BOONS[b].i, bx, by, 9 * s, '#15131f'); }); }
    if (assistActive()) { g.fillStyle = 'rgba(30,70,30,0.7)'; g.beginPath(); g.roundRect(x - 34 * s, y - 46 * s, 68 * s, 20 * s, 10 * s); g.fill(); g.fillStyle = '#b8ff9a'; g.font = `800 ${10 * s}px system-ui`; g.fillText('🌱 ASSIST', x, y - 32 * s); } }
  g.restore();
}

// ---------------- deaths, continues, assist, mastery ----------------
export function noteDeath(W) { const ch = W.chapter || 0; const p = save.progress; p.chDeaths = p.chDeaths || {}; p.chDeaths[ch] = (p.chDeaths[ch] || 0) + 1;
  if (save.settings.assist === 'auto' && p.chDeaths[ch] >= 4 && !assist.on && (save.settings.difficulty || 'normal') !== 'relaxed') { assist.on = true; return 'assistOn'; } return null; }
export function chapterWin(W) {
  const ch = W.chapter || 0, p = save.progress, R = (W.sp && W.sp.run) || newRun(); p.chDeaths = p.chDeaths || {}; p.chDeaths[ch] = 0; assist.on = false;
  const M = (p.mastery = p.mastery || {}), m = (M[ch] = M[ch] || {}), t = W.game && W.game.runTime ? W.game.runTime() : 0, par = 300 + 60 * ch, fresh = [];
  const got = { clear: true, nocont: R.contUsed === 0 && !assistActive(), nohit: R.bossHits === 0, speed: t > 0 && t < par };
  for (const k of Object.keys(got)) if (got[k] && !m[k]) { m[k] = 1; fresh.push(k); }
  const bonus = fresh.length * 50 * (diff().reward || 1); p.glimmers += bonus; p.totalGlimmers += bonus;
  const score = W.sp ? W.sp.score : 0, rank = W.sp ? W.sp.rank : 'B'; const rb = (M.rank = M.rank || {}); const order = 'CBAS'; if (!rb[ch] || order.indexOf(rank) > order.indexOf(rb[ch])) rb[ch] = rank;
  return { rank, score, got, fresh, bonus, par, stars: Object.keys(got).filter((k) => m[k]).length };
}
export const MASTERY = { clear: 'Clear the chapter', nocont: 'No continues used', nohit: 'Beat the boss without a hit', speed: 'Speedrun under par' };
export function masteryHtml(r) { if (!r) return ''; return `<div class="mastery"><div class="rank rank-${r.rank}">RANK <b>${r.rank}</b><small>${r.score} pts</small></div>${Object.keys(MASTERY).map((k) => `<div class="ms${r.got[k] ? ' on' : ''}${r.fresh.includes(k) ? ' new' : ''}">${r.got[k] ? '★' : '☆'} ${MASTERY[k]}${k === 'speed' ? ' (' + Math.floor(r.par / 60) + ' min)' : ''}${r.fresh.includes(k) ? ' <em>+' + Math.round(50 * (diff().reward || 1)) + '</em>' : ''}</div>`).join('')}</div>`; }
export const totalStars = () => { const M = save.progress.mastery || {}; let n = 0; for (const k of Object.keys(M)) if (k !== 'rank') n += Object.keys(M[k]).length; return n; };
