// The world: a scene (tutorial, hub, run or boss), its entities, camera and rendering.
import * as CB from './combat.js';
import * as BR from './brawl.js';
import { TILE, clamp, sign, rand, makeRng, rectsOverlap, lerp } from './util.js';
import { G, has, spr, tinted } from './gfx.js';
import { drawPaintedBg, drawForeground, drawMotes, drawGrade, renderPaintedChunk, paintedOK } from './paint.js';
import { buildFixed, generateRun, CW, CH, TileMap } from './level.js';
import { TUTORIAL, HUB, BOSS_ROOM } from './chunks.js';
import { Player } from './player.js';
import { Enemy, ENEMY_INFO } from './enemies.js';
import { Warden, Boss, TideGolem, DrownedBloom } from './boss.js';
import * as GA from './gauntlet.js';
import { FX } from './fx.js';
import { PAL, drawGlow, drawIcon, renderTileChunk, makeBackground, BIOMES, CHUNK_T } from './art.js';
import { sfx, playSong } from './audio.js';
import { save, diff, writeSave } from './save.js';
import { lineClear, moveBody } from './physics.js';
import { WEAPONS } from './weapons.js';
import { vibrate, input } from './input.js';
import { Traps } from './traps.js';
import { computeSupports, auditSupports } from './supports.js';
import { buildGuides, drawGuidesBack, drawGuidesFront } from './guides.js';
import { attachMissions, updateMissions, drawCritters, drawBoard } from './missionsWorld.js';
import * as SW from './storyWorld.js';
import { initSeeds, spawnSeed, updateSeeds, drawSeeds, drawGate, bumpGate } from './objective.js';

export const ANCHOR_GLOW = '#5ff2e8'; // v1.2: every hook anchor glows the same cyan
export const VIEW_H = 340; // v1.0/v1.1 view height (title world)
// v1.2 camera zoom: fewer world units on screen so the hero/enemies read larger (gameplay units and hitboxes unchanged)
export const viewHFor = (mode) => mode === 'boss' ? 270 : 250;
export const heroKFor = (mode) => mode === 'boss' ? 1.28 : 1.22; // hero visual scale; with viewH gives ~1.62-1.66x the v1.1 on-screen height
export function playerStats() {
  const u = save.progress.unlocks;
  return { maxHp: 100 + (u.vigor1 ? 20 : 0) + (u.vigor2 ? 20 : 0), maxFlasks: 2 + (u.flask1 ? 1 : 0) + (u.flask2 ? 1 : 0), weapon: save.progress.weapon || 'blade', gadgets: (save.progress.gadgets || ['popseed']).slice(0, 2), hookRange: u.vine ? 265 : 220 };
}
const CHUNK_KEEP = 40; // ~2.5 screens of painted 384px chunks; long maps stream instead of growing memory
export class World {
  constructor(game, mode, opts = {}) {
    this.game = game; this.mode = mode; this.fx = new FX(); this.quake = (p, d) => BR.quake(this, p, d); this.fx.cap = (game && game.lowPerf) || (save.settings && save.settings.quality === 'low') ? 220 : 480; this.t = 0; this.events = []; this.listeners = [];
    this.enemies = []; this.shots = []; this.bombs = []; this.waves = []; this.markers = []; this.pickups = []; this.props = []; this.anchors = []; this.sentries = []; this.pillars = []; this.lights = [];
    this.hs = 0; this.slow = 0; this.fight = null; this.runGlim = opts.glim || 0; this.cleared = new Set(opts.cleared || []); this.visited = new Set(opts.visited || []); this.opened = new Set(opts.opened || []);
    let L; this.seed = opts.seed ?? ((Math.random() * 1e9) | 0); this.stage = opts.stage || 0; this.chapter = (mode === 'run' || mode === 'boss') ? (opts.chapter || 0) : 0; // stage 0 = Overpass (-> Furnace), stage 1 = Drowned Glowroots (-> Drowned Bloom)
    if (mode === 'tutorial') { L = buildFixed(TUTORIAL); this.biome = BIOMES.overpass; }
    else if (mode === 'hub') { L = buildFixed(HUB); this.biome = BIOMES.hub; }
    else if (mode === 'boss') { L = buildFixed(BOSS_ROOM); this.biome = this.stage ? BIOMES.caverns : BIOMES.boss; }
    else { L = generateRun(this.seed + this.stage * 7919, this.stage ? 'caverns' : 'overpass'); this.biome = this.stage ? BIOMES.caverns : BIOMES.overpass; }
    this.map = L.map; this.cells = L.cells; this.gw = L.gw; this.gh = L.gh; this.cellGrid = new Map(); for (const [i, c] of this.cells.entries()) { c.index = i; this.cellGrid.set(c.x + ',' + c.y, c); }
    this.fullRoom = { x: TILE, y: 0, w: (this.map.w - 2) * TILE, h: this.map.h * TILE };
    const stats = { ...playerStats(), ...(opts.player || {}) };
    let start = L.spawns.find((s) => s.c === 'P');
    initSeeds(this, opts.seeds);
    this.spawnRng = makeRng((this.seed ^ 0x9e3779b9) >>> 0);
    GA.planRun(this, L); // v2.0: more traps, foes, arenas, ambushes (scaled by difficulty + depth)
    for (const s of L.spawns) this.spawnEntity(s);
    let px = start ? start.x * TILE + 12 : 100, py = start ? (start.y + 1) * TILE : 100;
    if (opts.cellIndex !== undefined && this.cells[opts.cellIndex]) { const c = this.cells[opts.cellIndex]; const p = this.findFloorIn(c); px = p.x; py = p.y; }
    this.player = new Player(px - 9, py - 34, stats);
    this.movesHint = 0; if ((mode === 'run' || mode === 'hub') && !opts.noHint) { const pr = save.progress; if ((pr.movesSeen || 0) < 3 && mode === 'run') { pr.movesSeen = (pr.movesSeen || 0) + 1; this.movesHint = this.movesHintMax = 8; try { writeSave(); } catch (e) {} } } // v1.9 icon-only moves card on the first 3 runs
    if (opts.cellIndex !== undefined && this.cells[opts.cellIndex]) { const c = this.cells[opts.cellIndex]; this.lastCheckpoint = opts.cellIndex; for (const o of this.props) if (o.kind === 'shrine' && this.cellAt(o.x + o.w / 2, o.y + o.h - 4) === c) o.lit = true; }
    this.room = this.fullRoom; this.cam = { x: px - 300, y: py - 200 }; this.updateRoom(true); this.snapCamera();
    this.chunkCache = new Map(); this.rs = 0; this.bg = null; this.hazTiles = []; this.traps = new Traps(this, L.traps || []); this.arenas = new GA.Arenas(this); this.guides = buildGuides(this);
    // v1.6: nothing floats - every plank/anchor/trap mount/island gets a drawn support chain to ground, wall, canopy or edge
    this.map.sup = computeSupports(this.map, this.anchors, L.traps || []);
    for (let y = 0; y < this.map.h; y++) for (let x = 0; x < this.map.w; x++) { const c = this.map.get(x, y); if (c === '^' || c === 'v' || c === '~') this.hazTiles.push({ x, y, c }); }
    this.viewH = viewHFor(mode); this.heroK = heroKFor(mode); this.bossIntro = mode === 'boss'; this.countdown = mode === 'run' || mode === 'boss' ? 1.6 : 0; this.fade = 1;
    this._L = L; attachMissions(this); this._L = null; SW.initWorld(this, opts); // v1.8 missions: trackers, lost critters, hub friends
    playSong(mode === 'hub' ? 'hub' : mode === 'boss' ? 'boss' : mode === 'tutorial' ? 'calm' : this.stage ? 'caverns' : 'biome');
  }
  spawnEntity(s) {
    let gy = s.y; if ('cFWD'.includes(s.c)) while (gy < s.y + 6 && !this.map.solid(s.x, gy + 1) && this.map.get(s.x, gy + 1) !== '=') gy++; // props sit on the ground
    const wx = s.x * TILE + 12, wy = (gy + 1) * TILE, depth = s.cell ? (this.stage ? 5 : 0) + s.cell.depth * 0.33 : 0, ci = s.cell ? s.cell.index : -1;
    const E = (type) => { if (ci >= 0 && this.cleared.has(ci)) return; const e = new Enemy(type, wx, wy, depth); e.cell = ci; BR.initFoe(this, e, this.seed | 0); GA.dressFoe(this, e, s); this.enemies.push(e); };
    switch (s.c) {
      case 'o': this.anchors.push({ x: wx, y: s.y * TILE + 12, kind: 'swing', pulse: rand.range(0, 6) }); break;
      case 'z': this.anchors.push({ x: wx, y: s.y * TILE + 12, kind: 'zip', pulse: rand.range(0, 6) }); break;
      case 'e': { const r = this.spawnRng(); if (this.stage) E(r < 0.24 ? 'lurefish' : r < 0.46 ? 'jelly' : r < 0.66 ? 'shellback' : r < 0.78 ? 'knight' : r < 0.9 ? 'hopper' : 'bomber'); else E(depth >= 3 && r < 0.25 ? 'knight' : r < 0.55 ? 'hopper' : r < 0.8 ? 'charger' : 'bomber'); break; }
      case 'w': E('lurefish'); break; case 'y': E('jelly'); break; case 's': E('shellback'); break;
      case 'S': this.props.push({ kind: 'shrine', x: wx - 16, y: wy - 44, w: 32, h: 44, id: 'S' + s.x + '_' + s.y }); this.lights.push({ x: wx, y: wy - 30, lantern: true }); break;
      case 'f': E('moth'); break; case 't': E('puffcap'); break; case 'k': E('knight'); break; case 'b': E('bomber'); break; case 'h': E('charger'); break; case 'j': E('hopper'); break;
      case 'd': E('dummy'); break; case 'q': E('tturret'); break;
      case 'M': if (!this.cleared.has(ci)) { const w = this.chapter ? SW.chapterWarden(this, wx, wy, depth) : this.stage ? new TideGolem(wx, wy, depth) : new Warden(wx, wy, depth); w.cell = ci; if (!this.chapter) GA.dressWarden(this, w); this.enemies.push(w); } break;
      case 'X': { const b = this.chapter ? SW.chapterBoss(this, wx, wy) : this.stage ? new DrownedBloom(wx, wy) : new Boss(wx, wy); b.cell = -1; this.enemies.push(b); this.boss = b; break; }
      case 'c': this.props.push({ kind: 'chest', x: wx - 14, y: wy - 22, w: 28, h: 22, id: 'c' + s.x + '_' + s.y, open: this.opened.has('c' + s.x + '_' + s.y) }); break;
      case 'g': for (let i = 0; i < 5; i++) this.pickups.push({ kind: 'glim', x: wx + (i - 2) * 9, y: wy - 16 - Math.abs(i - 2) * 4, vx: 0, vy: 0, t: 1, float: true }); break;
      case 'F': this.props.push({ kind: 'fountain', x: wx - 18, y: wy - 40, w: 36, h: 40, id: 'F' + s.x + '_' + s.y, open: this.opened.has('F' + s.x + '_' + s.y) }); break;
      case 'W': this.props.push({ kind: 'pedestal', x: wx - 14, y: wy - 30, w: 28, h: 30, id: 'W' + s.x + '_' + s.y, open: this.opened.has('W' + s.x + '_' + s.y), weapon: this.pickWeapon() }); break;
      case 'Q': spawnSeed(this, s); break;
      case 'L': this.lights.push({ x: wx, y: s.y * TILE + 12, lantern: true }); break;
      case 'D': this.props.push({ kind: 'door', x: wx - 20, y: wy - 60, w: 40, h: 60 }); break;
      case '1': case '2': case '3': case '4': case '5': case '6': case '7':
        if (this.mode === 'hub') this.props.push(+s.c === 4 ? { kind: 'station', n: 4, x: wx - 35, y: wy + 2 * TILE - 90, w: 70, h: 90 } : { kind: 'station', n: +s.c, x: wx - 22, y: wy + 2 * TILE - 50, w: 44, h: 50 });
        else this.props.push({ kind: 'trigger', n: +s.c, x: wx, y: wy }); break;
    }
  }
  pickWeapon() { const cur = this.player ? this.player.weapon : (save.progress.weapon || 'blade'); let all = Object.keys(WEAPONS).filter((w) => w !== cur && (this.stage >= 1 || !WEAPONS[w].biome || save.progress.unlocks[w])); const nw = all.filter((w) => WEAPONS[w].biome === 'caverns'); if (this.stage >= 1 && nw.length && this.spawnRng() < 0.6) all = nw; return all[(this.spawnRng() * all.length) | 0]; }
  findFloorIn(c) { // a safe floor spot near the left/top entrance of a cell
    const ox = c.x * CW, oy = c.y * CH;
    const order = c.need.has('L') ? [...Array(CW).keys()] : c.need.has('U') ? [16, 17, 15, 18, 14, 19, 13, 20, 12, 21, 10, 22, 8, 24, 6, 26, 4, 28] : [...Array(CW).keys()].reverse();
    for (const x of order) for (let y = oy + 2; y < oy + CH - 1; y++) { const tx = ox + x; if (!this.map.solid(tx, y) && !this.map.solid(tx, y - 1) && (this.map.solid(tx, y + 1) || this.map.get(tx, y + 1) === '=') && !this.map.hazard(tx, y) && !this.map.hazard(tx, y + 1) && !this.map.hazard(tx - 1, y + 1) && !this.map.hazard(tx + 1, y + 1)) return { x: tx * TILE + 12, y: (y + 1) * TILE }; }
    return { x: (ox + 17) * TILE, y: (oy + 10) * TILE };
  }
  emit(name, data) { for (const l of this.listeners) l(name, data); }
  on(fn) { this.listeners.push(fn); }
  // ---------------- room / camera ----------------
  cellAt(px, py) { if (!this.cells.length) return null; return this.cellGrid.get(Math.floor(px / (CW * TILE)) + ',' + Math.floor(py / (CH * TILE))) || null; }
  updateRoom(initial) {
    const P = this.player; const c = this.cellAt(P.cx, P.cy);
    if (c) { this.room = c.room; if (this.curCell !== c) { this.curCell = c; if (!this.visited.has(c.index)) { this.visited.add(c.index); } if (!initial) this.onEnterCell(c); } }
    else this.room = this.fullRoom;
  }
  onEnterCell(c) { if (this.mode === 'run' && c.kind === 'checkpoint') this.reachCheckpoint(c); }
  reachCheckpoint(c) { // v1.3: saves happen only at checkpoint shrines (every ~10 rooms) and at the start of each biome
    const P = this.player; P.flasks = P.maxFlasks; this.lastCheckpoint = c.index;
    for (const o of this.props) if (o.kind === 'shrine' && this.cellAt(o.x + o.w / 2, o.y + o.h - 4) === c && !o.lit) { o.lit = true; this.fx.burst(o.x + o.w / 2, o.y + 10, 26, { color: ['#9ff6ff', '#e8ffff'], g: -60, max: 170, kind: 'star', life: 1 }); }
    this.game.saveRunState(this, c.index); sfx('unlock'); this.fx.text(P.cx, P.y - 24, 'Checkpoint saved', '#bffcff', 14); this.emit('checkpoint', c.index);
  }
  // v1.4 render interpolation: positions at the start of each fixed step are kept; draw() shows prev + (cur - prev) * alpha
  interpBodies() { const a = new Set([this.player, ...this.enemies, ...this.shots, ...this.pickups, ...this.bombs]); if (this.boss) a.add(this.boss); return a; }
  snapPrev() { for (const o of this.interpBodies()) { o._px = o.x; o._py = o.y; } this._pcx = this.cam.x; this._pcy = this.cam.y; }
  lerpBegin(al) {
    if (!(al < 0.999)) return null; al = Math.max(0, al); const L = [];
    for (const o of this.interpBodies()) { if (o._px === undefined) continue; const dx = o.x - o._px, dy = o.y - o._py; if (dx * dx + dy * dy > 6400) continue; L.push(o, o.x, o.y); o.x = o._px + dx * al; o.y = o._py + dy * al; }
    const cx = this.cam.x, cy = this.cam.y; if (this._pcx !== undefined && Math.abs(cx - this._pcx) + Math.abs(cy - this._pcy) < 200) { this.cam.x = this._pcx + (cx - this._pcx) * al; this.cam.y = this._pcy + (cy - this._pcy) * al; }
    return [L, cx, cy];
  }
  lerpEnd(s) { if (!s) return; const L = s[0]; for (let i = 0; i < L.length; i += 3) { L[i].x = L[i + 1]; L[i].y = L[i + 2]; } this.cam.x = s[1]; this.cam.y = s[2]; }
  snapCamera() { this.camYT = undefined; const t = this.camTarget(); this.cam.x = t.x; this.cam.y = t.y; this.cam.vx = this.cam.vy = 0; }
  camTarget() {
    const P = this.player, VW = this.viewW || 760, VH = this.viewH || VIEW_H;
    const lt = P.face * 44 + clamp(P.vx * 0.2, -56, 56); this.look = (this.look || 0) + (lt - (this.look || 0)) * (Math.abs(P.vx) > 150 ? 0.05 : 0.03); // eased, velocity-led look-ahead (v2.1: catches up faster at full run)
    let x = P.cx + this.look - VW / 2;
    const want = P.cy - VH * 0.55 + (P.vy > 380 ? 36 : 0); // vertical deadzone: hold height through jumps, follow on landing, band exit or long falls
    if (this.camYT === undefined || P.onGround || P.hook.s === 'swing' || P.hook.s === 'zip') this.camYT = want; else { const B = 46; if (want < this.camYT - B) this.camYT = want + B; else if (want > this.camYT + B * 0.5) this.camYT = want - B * 0.5; }
    let y = this.camYT;
    { // v2.1 look down / up: hold down (or up) while standing still to peek; long falls lead the camera downward
      const still = P.onGround && Math.abs(P.vx) < 20 && !P.atk; const ly = still && input.my > 0.5 ? 1 : still && input.my < -0.5 ? -1 : 0;
      this.peekT = ly ? (this.peekT || 0) + 1 / 60 : 0; const pt = this.peekT > 0.35 ? ly * (ly > 0 ? 96 : 64) : 0;
      const fl = !P.onGround && P.vy > 300 ? clamp((P.vy - 300) * 0.25, 0, 70) : 0;
      this.peek = (this.peek || 0) + ((pt + fl) - (this.peek || 0)) * 0.06; y += this.peek;
    }
    const R = this.fight ? this.fight.room : this.room;
    if (R.w <= VW) x = R.x + R.w / 2 - VW / 2; else x = clamp(x, R.x, R.x + R.w - VW);
    if (R.h <= VH) y = R.y + R.h / 2 - VH / 2; else y = clamp(y, R.y, R.y + R.h - VH);
    return { x, y };
  }
  updateCamera(dt) { // v1.4: critically damped spring (no velocity snaps on room changes / target jumps)
    const t = this.camTarget(), c = this.cam; c.vx = c.vx || 0; c.vy = c.vy || 0; const w = this.fight ? 7 : 9, wy = 6.5;
    c.vx += (w * w * (t.x - c.x) - 2 * w * c.vx) * dt; c.vy += (wy * wy * (t.y - c.y) - 2 * wy * c.vy) * dt; c.x += c.vx * dt; c.y += c.vy * dt;
  }
  // ---------------- main update ----------------
  update(dt) {
    this.snapPrev(); this.t += dt; this.fade = Math.max(0, this.fade - dt * 2.5);
    if (this.countdown > 0) { const before = Math.ceil(this.countdown / 0.5); this.countdown -= dt; const after = Math.ceil(this.countdown / 0.5); if (after !== before && this.countdown > 0 && after <= 3) sfx('beep'); if (this.countdown <= 0) { sfx('go'); this.goT = 0.6; if (this.boss && this.boss.st === 'sleep') { this.boss.go('intro'); this.startFight(this.boss); sfx('roar'); this.fx.shake(0.4); } } this.fx.update(dt); this.updateCamera(dt); return; }
    if (this.goT > 0) this.goT -= dt;
    if (this.zoomK > 0) this.zoomK = Math.max(0, this.zoomK - dt * 4.5); BR.tickCine(this, dt);
    if (this.hs > 0) { this.hs -= dt; this.fx.update(dt * 0.3); CB.tickPops(this, dt); return 'hs'; } // v1.4: callers keep button edges through hit-stop
    CB.tickPops(this, dt); if (this.slow > 0) { this.slow -= dt; dt *= 0.4; } if (this.cine && this.cine.slow) dt *= 1 - (1 - this.cine.slow) * BR.cineK(this); // v2.0 cinematic slow-mo
    const P = this.player; P.update(this, dt); this.updateRoom(false);
    const ax = P.cx, ay = P.cy;
    for (const e of this.enemies) { if (e.dead) continue; const near = Math.abs(e.cx - ax) < 640 && Math.abs(e.cy - ay) < 420; if (near || e.boss && e.st !== 'sleep') e.update(this, dt); }
    this.enemies = this.enemies.filter((e) => !e.dead);
    this.updateShots(dt); this.updateBombs(dt); this.updateWaves(dt); this.updatePillars(dt); this.updateSentries(dt); this.updatePickups(dt); SW.update(this, dt); input.ctx = this.ctxIcon(this.player); this.traps.update(dt); this.arenas.update(dt); updateSeeds(this, dt); updateMissions(this, dt);
    for (const m of this.markers) m.t += dt; this.markers = this.markers.filter((m) => m.t < m.life);
    for (const p of this.props) if (p.kind === 'trigger' && !p.fired && Math.abs(P.cx - p.x) < 20 && Math.abs(P.cy - p.y) < 120) { p.fired = true; this.emit('trigger', p.n); }
    if (this.movesHint > 0) this.movesHint -= dt; else if (this.mode === 'hub' && this.t > 1) { const P = this.player; for (const e of this.enemies) if (e.type === 'dummy' && !e.dead && Math.abs(e.cx - P.cx) < 110 && Math.abs(e.cy - P.cy) < 60) { this.movesHint = this.movesHintMax = 4; break; } } // near the hub dummy: show the moves card
    for (const e of this.enemies) BR.tickFoe(e, dt); BR.update(this, dt);
    CB.update(this, dt); if (this.special && (this.special.t += dt) > this.special.life) this.special = null;
    for (const e of this.enemies) if (e.maxPoise && e.poise < e.maxPoise && this.t - (e.lastHitT || 0) > 2.5 && !(e.poiseBroke > 0)) e.poise = Math.min(e.maxPoise, e.poise + e.maxPoise * 0.25 * dt); // v1.9 boss poise regen
    this.fx.update(dt); this.updateCamera(dt);
    // ambient particles: floating spores
    if (Math.random() < dt * 6) this.fx.burst(this.cam.x + Math.random() * (this.viewW || 760), this.cam.y + (this.viewH || VIEW_H) + 10, 1, { color: this.mode === 'boss' ? '#ffb07a' : '#e8ffb0', min: 10, max: 30, g: -20, drag: 0, life: 6, size: 2.2, angle: -Math.PI / 2, spread: 0.5, glow: 1 });
  }
  hitstop(t) { this.hs = Math.max(this.hs, t); }
  zoomKick(k) { this.zoomK = Math.max(this.zoomK || 0, k); } // camera micro-zoom on heavy hits / parries (v1.3)
  // ---------------- hook targets ----------------
  findHookTarget(p, mx, my) {
    const R = p.hookRange, px = p.cx, py = p.y + 10, assist = save.settings.hookAssist;
    let ax, ay; if (Math.abs(mx) > 0.2 || my) { ax = mx; ay = my || -0.35; } else { ax = p.face; ay = -0.9; }
    const al = Math.hypot(ax, ay); ax /= al; ay /= al;
    let best = null, bs = 1e9; const minDot = assist ? -0.25 : 0.45;
    const cur = p.hook.s === 'swing' ? p.hook.tgt : null;
    const consider = (x, y, kind, ent) => {
      const dx = x - px, dy = y - py, d = Math.hypot(dx, dy); if (d > R || d < 18) return; const dot = (dx * ax + dy * ay) / d; if (dot < minDot) return;
      let s = d / R * 0.6 + (1 - dot) * 0.9 + (kind !== 'enemy' && dy > 20 ? 0.5 : 0) + (kind === 'enemy' ? 0.25 : 0);
      if (s < bs && lineClear(this.map, px, py, x, y)) { bs = s; best = { x, y, kind, ent }; }
    };
    for (const a of this.anchors) if (a !== cur && Math.abs(a.x - px) < R && Math.abs(a.y - py) < R) consider(a.x, a.y, a.kind);
    for (const e of this.enemies) if (!e.dead && e.type !== 'dummy' && e.st !== 'sleep' && Math.abs(e.cx - px) < R) consider(e.cx, e.cy, 'enemy', e);
    return best && !best.ent ? this.anchors.find((a) => a.x === best.x && a.y === best.y) : best;
  }
  // ---------------- interaction ----------------
  interactable(p) {
    for (const o of this.props) { if (o.open || o.kind === 'trigger' || o.kind === 'shrine') continue; if (rectsOverlap({ x: p.x - 14, y: p.y - 10, w: p.w + 28, h: p.h + 20 }, o)) { if ((o.kind === 'moss' || o.kind === 'station') && this.enemies.some((e) => !e.dead && Math.abs(e.cx - p.cx) < 150 && Math.abs(e.cy - p.cy) < 90)) continue; return o; } } // v2.1: fighting next to Moss/a station never opens a menu
    return null;
  }
  ctxIcon(p) { const o = p && p.onGround && this.interactable(p); if (!o) return null; return { door: 'door', station: 'gear', moss: 'eye', chest: 'gift', fountain: 'flask', pedestal: 'key' }[o.kind] || null; } // v2.1 contextual Attack icon
  tryInteract(p) {
    const o = this.interactable(p); if (!o || !p.onGround) return false;
    if (o.kind === 'chest' || o.kind === 'fountain' || o.kind === 'pedestal') { this.game.treasures = (this.game.treasures || 0) + 1; SW.onTreasure(this, o); }
    if (o.kind === 'chest') { o.open = true; this.opened.add(o.id); sfx('chest'); this.fx.burst(o.x + 14, o.y + 4, 20, { color: ['#ffe27a', '#fff'], max: 200, kind: 'star', g: 200 }); this.dropGlims(o.x + 14, o.y, rand.int(10, 16)); if (rand.chance(0.5)) this.pickups.push({ kind: 'heart', x: o.x + 14, y: o.y - 10, vx: rand.range(-60, 60), vy: -200, t: 0 }); this.emit('chest'); return true; }
    if (o.kind === 'fountain') { o.open = true; this.opened.add(o.id); p.flasks = p.maxFlasks; p.healLeft += p.maxHp * 0.3; sfx('flask'); this.fx.burst(o.x + 18, o.y + 10, 30, { color: ['#9ff0ff', '#e8ffff'], g: -60, max: 160, kind: 'star', life: 1 }); this.fx.text(o.x + 18, o.y - 10, 'Flasks refilled!', '#bff', 13); return true; }
    if (o.kind === 'pedestal') { o.open = true; this.opened.add(o.id); p.weapon = o.weapon; sfx('unlock'); this.fx.ring(o.x + 14, o.y, 50, WEAPONS[o.weapon].color, 0.5, 5); this.fx.text(o.x + 14, o.y - 16, WEAPONS[o.weapon].name + '!', WEAPONS[o.weapon].color, 14); this.emit('weapon'); return true; }
    if (o.kind === 'station') { this.game.openStation(o.n); return true; }
    if (o.kind === 'moss') { sfx('ui'); this.game.openMoss && this.game.openMoss(); return true; }
    if (o.kind === 'door') { if (this.mode === 'run' && bumpGate(this, o)) return true; sfx('door'); this.game.useDoor(this); return true; }
    return false;
  }
  // ---------------- combat plumbing ----------------
  overlapPlayer(e, inset = 4) { const P = this.player; if (P.dead || P.respawnT > 0) return false; return P.x + inset < e.x + e.w && P.x + P.w - inset > e.x && P.y + inset < e.y + e.h && P.y + P.h - inset > e.y; }
  damagePlayer(dmg, srcX, info) { const r = this.player.hurt(this, dmg, srcX, info); if (r === 'hit') { this.emit('hurt'); BR.hurt(this); } return r; }
  enemyAttack(box, dmg, src, info) { if (this.overlapPlayer(box, 4)) return this.damagePlayer(dmg, src.cx ?? box.x + box.w / 2, { ...info, src }); return null; }
  onParry(p, info) {
    sfx('parry'); vibrate(30); this.hitstop(0.1); this.zoomKick(1); this.slow = 0.35; p.iframes = Math.max(p.iframes, 0.45); this.fx.shake(0.3);
    this.fx.ring(p.cx + p.face * 14, p.cy, 60, '#bff2ff', 0.4, 7); this.fx.burst(p.cx + p.face * 16, p.cy, 18, { color: ['#fff', '#bff2ff', '#ffe27a'], min: 150, max: 420, kind: 'spark', glow: 1, life: 0.4 });
    this.fx.text(p.cx, p.y - 10, 'PARRY!', '#bff2ff', 18); p.counterT = 1.0; CB.gain(p, 15, this); // v1.9: next tap = counter slash
    const e = info.src; if (e && e.cx !== undefined && !e.shot) { e.stun = Math.max(e.stun, e.boss ? 1.5 : 1.8); e.parried = 2.2; e.tele = 0; if (e.st) e.st = e.boss ? 'idle' : 'idle'; if (e.boss) e.cd = 1.4; e.vx = sign(e.cx - p.cx) * (e.boss ? 60 : 200); }
    if (info.shot) { const s = info.shot; s.owner = 'player'; s.vx = -s.vx * 1.4; s.vy = s.ember ? -Math.abs(s.vy) * 0.4 - 200 : -s.vy * 1.4; if (Math.abs(s.vx) < 120) s.vx = p.face * 400; s.dmg *= 3; s.life = 1.6; s.g = s.ember ? 600 : 0; s.reflected = true; }
    this.emit('parry');
  }
  attackBox(box, def, p, hitSet) {
    let any = false; const b2 = { x: box.x - 4, y: box.y - 4, w: box.w + 8, h: box.h + 8 };
    for (const e of this.enemies) { if (e.dead || hitSet.has(e) || !rectsOverlap(b2, e)) continue; hitSet.add(e); any = true; this.hitEnemy(e, { ...def, src: 'melee' }, p); }
    for (const b of this.bombs) if (b.owner === 'enemy' && rectsOverlap(b2, { x: b.x - 8, y: b.y - 8, w: 16, h: 16 })) { b.owner = 'player'; b.vx = p.face * 360; b.vy = -260; b.landed = false; b.fuse = 1.2; sfx('hit'); this.fx.text(b.x, b.y - 10, 'bonk!', '#ffe27a', 12); any = true; }
    for (const s of this.shots) if (s.owner === 'enemy' && !s.ember && rectsOverlap(b2, { x: s.x - s.r, y: s.y - s.r, w: s.r * 2, h: s.r * 2 })) { s.dead = true; this.fx.burst(s.x, s.y, 6, { color: '#c9b8f0', max: 120 }); }
    this.breakTiles(box);
    return any;
  }
  breakTiles(box) {
    const x0 = Math.floor(box.x / TILE), x1 = Math.floor((box.x + box.w) / TILE), y0 = Math.floor(box.y / TILE), y1 = Math.floor((box.y + box.h) / TILE);
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (this.map.get(x, y) === 'B') { this.floodBreak(x, y); return; }
  }
  floodBreak(x, y) {
    const st = [[x, y]]; let n = 0;
    while (st.length) { const [a, b] = st.pop(); if (this.map.get(a, b) !== 'B') continue; this.setTile(a, b, '.'); n++; this.fx.burst(a * TILE + 12, b * TILE + 12, 4, { color: ['#5a5268', '#8a80a0'], max: 200, size: 5, g: 600 }); st.push([a + 1, b], [a - 1, b], [a, b + 1], [a, b - 1]); }
    if (n) { sfx('secret'); this.fx.shake(0.3); this.fx.text(x * TILE, y * TILE, 'Secret!', '#ffe27a', 16); this.emit('secret'); }
  }
  setTile(x, y, c) { this.map.set(x, y, c); const k = Math.floor(x / CHUNK_T) + ',' + Math.floor(y / CHUNK_T); this.chunkCache.delete(k); for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) this.chunkCache.delete(Math.floor((x + dx) / CHUNK_T) + ',' + Math.floor((y + dy) / CHUNK_T)); }
  nearestEnemyAhead(p) { for (const e of this.enemies) if (!e.dead && sign(e.cx - p.cx) === p.face && Math.abs(e.cx - p.cx) < 90 && Math.abs(e.cy - p.cy) < 50) return e; return null; }
  hitEnemy(e, hit, p) {
    if (e.dead) return false;
    if (e.boss && (e.st === 'sleep' || e.st === 'intro' || e.st === 'roar' || e.st === 'dying' || e.st === 'wake')) { sfx('block'); this.fx.burst(e.cx, e.cy, 4, { color: '#fff', max: 120 }); return false; }
    const srcX = p ? p.cx : e.cx;
    let armorMul = 1;
    if (p && hit.src !== 'hazard' && hit.src !== 'splat' && (e.shield || e.armor > 0)) { // v2.0: shields have a guard meter (3 blocks = GUARD BREAK); armored foes need heavy hits
      const facing = e.shield && sign(p.cx - e.cx) === e.face && e.stun <= 0;
      if (e.shield && hit.breaks) { e.shield = false; e.guard = 0; sfx('shieldBreak'); this.fx.burst(e.cx + e.face * 12, e.cy, 16, { color: ['#c8d2e2', '#fff'], max: 260, size: 5 }); this.fx.text(e.cx, e.y - 14, 'SHIELD SMASH!', '#8ff6ff', 15); BR.bonus(this, 'SHIELD SMASH', 25, '#ffe27a'); this.emit('shieldBreak'); }
      else { const gc = BR.guardCheck(this, e, hit, p, facing);
        if (gc === 'block') { sfx('block'); this.fx.burst(e.cx + e.face * 14, e.cy - 4, 6, { color: ['#fff', '#ffe27a'], kind: 'spark', max: 240, glow: 1 }); p.vx = -p.face * 160; this.fx.text(e.cx, e.y - 12, 'blocked', '#cfd6e6', 11); this.hitstop(0.03); this.emit('blocked'); e.blocks = (e.blocks || 0) + 1; return false; }
        armorMul = gc; }
    }
    const tip = !!(p && hit.tip && !hit.quakeHit && Math.abs(e.cx - p.cx) > (hit.w || 80) * 0.6), crit = !!(p && (hit.crit || tip || (e.yankUntil > this.t && hit.src === 'melee')));
    const trapped = !p && hit.src === 'hazard' && e.flungT > this.t && !e.boss; // v2.0: knocked into a trap // v1.9 crits: counters, perfect-dodge follow-ups, hook-zip strikes, hits on yanked foes, Bloom
    let dmg = hit.dmg * (p ? diff().dmgDealt * (this.dmgDealt || 1) : 1) * (e.parried > 0 ? 2 : 1) * (e.boss && e.stun > 0 ? 1.4 : 1) * (crit ? 1.5 : 1) * armorMul * (e.flipT > this.t ? 1.5 : 1); if (trapped) dmg = Math.max(45, dmg * 3);
    if (e.type === 'dummy') { e.flash = 0.07; this.fx.dmg(e.cx, e.y - 6, Math.round(dmg), { key: e, crit, tag: tip ? 'TIP!' : null, heavy: !!hit.fin }); if (p) BR.addHit(this, hit.mv || hit.src || 'hit', dmg, { crit, fin: hit.fin }); BR.react(this, e, sign(e.cx - srcX || 1), hit.fin || crit); this.emit('dummyHit'); sfx(hit.fin ? 'finisherHit' : 'hit'); CB.pop(this, lerp(e.cx, srcX, 0.35), e.cy - 2, hit.fin || hit.crit ? 1.5 : 1, hit.crit ? '#ffe9a0' : '#ffffff'); e.sq = hit.fin ? 0.35 : 0.2; if (hit.fin) CB.leaves(this, e.cx, e.cy, 8); this.hitstop(hit.hs || 0.04); this.fx.burst(e.cx, e.cy, 6, { color: ['#fff', '#ffe27a'], kind: 'spark', max: 260 }); return true; }
    if (e.type === 'tturret') { e.flash = 0.15; e.hitsTaken += hit.reflected ? 99 : 1; sfx('hit'); if (e.hitsTaken < 5) { this.fx.text(e.cx, e.y - 8, hit.reflected ? '' : 'Parry its spit!', '#bff2ff', 11); return true; } dmg = 1e9; }
    dmg = Math.max(1, Math.round(dmg)); e.hp -= dmg; e.flash = 0.07; // v2.0: a crisp 2-frame white flash (was up to 0.3 s in slow-mo)
    const dir0 = sign(e.cx - srcX || 1), dir = hit.kdir === 'pull' ? -dir0 : dir0, stg = hit.stag ?? hit.stun ?? 0.22, armored = e.armor > 0;
    if (!e.boss && armored) { e.vx = dir * (hit.kb || 0) * 0.25; e.sq = 0.9; } // armour: barely moves, no stagger
    else if (!e.boss) { const k = (hit.kb || 0) * (e.light ? 1 : 0.4); e.vx = hit.kdir === 'pull' ? dir * Math.min(k, Math.abs(e.cx - srcX) * 5) : dir * k; if (e.light && k > 0) e.vy = -Math.min(220, k * 0.5);
      if (p && (k >= 200 || hit.launch) && hit.kdir !== 'pull') e.flungT = this.t + 0.85; // v2.0: flung foes splat on walls and take trap KOs
      if (e.light || hit.breaks) { e.stun = Math.max(e.stun, hit.stun || stg); e.tele = 0; if (e.st !== 'hop') e.st = 'idle'; }
      else if (stg >= 0.5 || crit) { e.stun = Math.max(e.stun, 0.3); e.tele = 0; } // v1.9: heavy foes only stagger from big hits
      if (e.light && hit.launch) { e.vy = -hit.launch; e.juggle = 0.9; e.spinV = dir * (9 + Math.random() * 6); e.stun = Math.max(e.stun, 0.8); }
      else if (!e.light && hit.launch >= 400) e.vy = -hit.launch * 0.35;
      if (e.light && hit.air && !e.onGround) { e.vy = Math.min(e.vy, -170); e.juggle = Math.max(e.juggle || 0, 0.5); e.stun = Math.max(e.stun, 0.45); } // juggle: air hits keep light foes aloft
      if (e.light && (crit || hit.fin) && !e.spinV) e.spinV = dir * 12;
      e.sq = 0.78; }
    if (hit.stun && e.boss) e.stun = Math.max(e.stun, 0.2);
    if (e.maxPoise && p) { e.lastHitT = this.t; e.poise -= dmg * (hit.poise || 1) * (hit.fin ? 2 : 1); if (e.poise <= 0 && !(e.poiseBroke > 0)) e.poisePending = true; }
    if (e.poisePending && (e.st === 'idle' || /Tele$/.test(e.st || ''))) { e.poisePending = false; e.poiseBroke = 2.2; e.poise = e.maxPoise; e.stun = Math.max(e.stun, 2.2); if (e.go) e.go('idle'); else e.st = 'idle'; e.tele = 0; e.cd = Math.max(e.cd || 0, 0.8); sfx('poiseBreak'); BR.cine(this, { x: e.cx, y: e.cy, life: 1.1, zoom: 1.22, slow: 0.3, label: 'BREAK!' }); BR.bonus(this, 'POISE BREAK', 60, '#ffe27a'); this.fx.ring(e.cx, e.cy, 70, '#ffe27a', 0.45, 7); CB.leaves(this, e.cx, e.cy, 18); this.hitstop(0.14); this.zoomKick(1); this.fx.flash = 0.3; this.fx.flashColor = '#fff2b0'; this.emit('poiseBreak'); }
    const heavy = dmg >= 25 || !!hit.breaks; this.hitstop(Math.max(hit.hs || 0.035, heavy ? 0.065 : 0)); this.fx.shake(hit.shake || 0.08); sfx(heavy ? 'hitHeavy' : 'hit'); if (heavy) this.zoomKick(0.6);
    this.fx.burst(lerp(e.cx, srcX, 0.3), e.cy, dmg >= 25 ? 12 : 7, { color: ['#fff', '#ffe27a', PAL.inkPop], kind: 'spark', min: 120, max: 360, glow: 1, life: 0.3 });
    this.fx.dmg(e.cx, e.y - 4, dmg, { key: e, heavy: heavy || crit, gold: e.parried > 0 || crit, dir, crit, tag: tip ? 'TIP!' : trapped ? 'TRAP' : null }); BR.react(this, e, dir, heavy || crit || !!hit.fin);
    if (p && hit.src !== 'hazard') BR.addHit(this, hit.mv || hit.src || 'hit', dmg, { crit, fin: hit.fin });
    CB.pop(this, lerp(e.cx, srcX, 0.35), e.cy - 2, heavy || crit ? 1.5 : 1, crit ? '#ffe9a0' : '#ffffff');
    if (crit) { sfx('crit'); this.hitstop(Math.max(hit.hs || 0.035, 0.07)); this.fx.ring(e.cx, e.cy, 30, '#ffe27a', 0.25, 4); this.fx.burst(e.cx, e.cy, 5, { color: ['#fff6d8', '#ffe27a'], kind: 'star', min: 60, max: 200, life: 0.5, size: 6 }); this.emit('crit'); }
    if (hit.fin) { sfx('finisherHit'); CB.leaves(this, e.cx, e.cy, p && p.weapon === 'hammer' ? 5 : 12); this.zoomKick(0.8); }
    if (p && hit.src !== 'special' && hit.src !== 'hazard' && p.gauge !== undefined) CB.gain(p, Math.min(8, dmg * 0.5), this);
    if (trapped) BR.trapKO(this, e, e.hp <= 0);
    if (e.hp <= 0) this.killEnemy(e, p);
    return true;
  }
  killEnemy(e, p) {
    if (e instanceof Boss) { e.hp = 0; e.go('dying'); sfx('roar'); this.fx.shake(0.8); this.slow = 1.0; BR.cine(this, { x: e.cx, y: e.cy, life: 2.5, zoom: 1.28 }); BR.bonus(this, 'BOSS DOWN', 150, '#ff7ac8'); return; }
    e.dead = true; CB.leaves(this, e.cx, e.cy, e.boss ? 24 : 10); CB.spores(this, e.cx, e.cy, e.boss ? 16 : 8); this.fx.shatter(e._dr, e.boss ? 4 : 3, e.boss ? 1.2 : 1); this.fx.pop(e.cx, e.cy, e.boss ? 2 : 1); if (e.boss) this.zoomKick(0.8); sfx('pop'); vibrate(15);
    const lucky = save.progress.unlocks.lucky ? 1.25 : 1; this.dropGlims(e.cx, e.cy, Math.round(e.glim * lucky));
    GA.onFoeDown(this, e);
    if (e.elite) { BR.bonus(this, 'ELITE DOWN', 50, '#ff7ad8'); this.fx.ring(e.cx, e.cy, 70, '#ff7ad8', 0.5, 6); this.hitstop(0.08); this.zoomKick(0.7); this.pickups.push({ kind: 'heart', x: e.cx, y: e.cy, vx: 0, vy: -260, t: 0 }); this.emit('eliteKill', e.type); }
    if (e instanceof Warden) BR.cine(this, { x: e.cx, y: e.cy, life: 1.2, zoom: 1.2, slow: 0.35 });
    if (!e.boss && !e.elite && rand.chance(0.08)) this.pickups.push({ kind: 'heart', x: e.cx, y: e.cy, vx: rand.range(-50, 50), vy: -220, t: 0 });
    this.player.stats.kills++; this.emit('kill', e);
    if (e.cell >= 0 && !this.enemies.some((o) => !o.dead && o.cell === e.cell) && !this.cleared.has(e.cell)) { this.cleared.add(e.cell); this.emit('roomClear', e.cell); }
    if (e instanceof Warden) this.onMinibossDefeated(e);
    if (e.type === 'tturret') this.emit('turretPopped');
  }
  dropGlims(x, y, n) { for (let i = 0; i < n; i++) this.pickups.push({ kind: 'glim', x, y, vx: rand.range(-140, 140), vy: rand.range(-320, -120), t: 0 }); }
  hazardHit(p, kind) {
    const info = kind === '~' ? ENEMY_INFO.smog : ENEMY_INFO.thorns; p.lastHit = info;
    const dmg = this.mode === 'tutorial' || this.god ? 0 : Math.max(4, Math.round(12 * diff().dmgTaken));
    sfx('hurt'); vibrate(30); this.fx.shake(0.35); this.fx.flash = 0.3; this.fx.flashColor = '#ff5a7a';
    this.fx.burst(p.cx, p.cy, 18, { color: ['#ff5a7a', '#fff', '#ffd0d8'], max: 240, kind: 'star', life: 0.5 });
    if (dmg) this.fx.text(p.cx, p.y - 6, '-' + dmg, '#ff8aa0', 14); else this.fx.text(p.cx, p.y - 6, 'Ouch!', '#ff8aa0', 14);
    p.hp -= dmg; p.hook = { s: 'none' }; p.atk = null; p.dashT = 0;
    if (p.hp <= 0 && this.tryRevive(p)) return;
    if (p.hp <= 0) { p.hp = 0; p.dead = true; p.deadT = 0; this.onPlayerDeath(info); return; }
    p.respawnT = 0.5; p.vx = p.vy = 0; this.emit('hazard', kind);
  }
  // v1.3 hub skill "Ember Heart": once per biome (world), rise again at 40% health
  tryRevive(p) { if (!save.progress.unlocks.revive || this.revived || (this.mode !== 'run' && this.mode !== 'boss')) return false;
    this.revived = true; p.hp = Math.round(p.maxHp * 0.4); p.iframes = 2.2; p.dead = false; sfx('unlock'); this.fx.ring(p.cx, p.cy, 90, '#ffb36a', 0.6, 6); this.fx.burst(p.cx, p.cy, 24, { color: ['#ffe27a', '#ff9a5a'], max: 320, life: 0.7, kind: 'star', size: 6 }); this.fx.text(p.cx, p.y - 14, 'Ember Heart!', '#ffb36a', 16); this.slow = 0.5; this.emit('revive'); return true; }
  onPlayerDeath(info) { sfx('death'); this.slow = 0.8; this.fx.shake(0.6); this.emit('death'); setTimeout(() => this.game.onDeath(this, info || this.player.lastHit), 1100); }
  startFight(e) {
    this.emit('fightStart', e);
    if (e instanceof Warden) {
      const c = this.cells[e.cell]; if (!c) return; this.fight = { e, room: c.room }; const ox = c.x * CW, oy = c.y * CH; this.gates = [];
      for (const gx of [0, CW - 1]) for (let y = 14; y <= 17; y++) if (this.map.get(ox + gx, oy + y) === '.') { this.setTile(ox + gx, oy + y, 'G'); this.gates.push([ox + gx, oy + y]); }
      // never trap the player inside a gate tile
      const P = this.player; if (this.map.solidPx(P.cx, P.cy)) P.x = c.room.x + TILE * 2;
      sfx('door'); this.game.bossBar(e); playSong('mini');
    } else { this.fight = { e, room: this.fullRoom }; this.game.bossBar(e); }
  }
  onMinibossDefeated(e) {
    for (const [x, y] of this.gates || []) this.setTile(x, y, '.'); this.gates = []; this.fight = null; this.game.bossBar(null); sfx('victory'); playSong(this.stage ? 'caverns' : 'biome');
    this.fx.text(e.cx, e.y - 30, e.info.name + ' defeated!', '#ffe27a', 18); this.dropGlims(e.cx, e.cy, 10); this.pickups.push({ kind: 'heart', x: e.cx, y: e.cy - 20, vx: 0, vy: -250, t: 0, big: true });
    save.progress.minibossBeaten = (save.progress.minibossBeaten || 0) + 1; this.emit('miniboss'); SW.onWardenDown(this, e);
  }
  onBossPhase(n) { BR.cine(this, { x: this.boss.cx, y: this.boss.cy, life: 1.5, zoom: 1.14, label: n === 2 ? 'PHASE 2' : 'FINAL PHASE', col: '#ffb13b' }); BR.bonus(this, 'PHASE ' + n, 40, '#ffb13b'); this.emit('bossPhase', n); }
  onBossDefeated(b) { this.fx.pop(b.cx, b.cy, 3); this.fx.flash = 0.8; this.fx.flashColor = '#fff6d8'; this.dropGlims(b.cx, b.cy, 40); this.fight = null; this.game.bossBar(null); sfx('victory'); this.bloomT = 0.01; this.emit('bossDefeated'); setTimeout(() => this.game.onVictory(this), 2600); }
  spawnEnemy(type, x, y) { const e = new Enemy(type, x, y, 2); e.cell = -1; e.stun = 0.5; BR.initFoe(this, e, 0, true); this.enemies.push(e); this.fx.burst(x, y - 10, 14, { color: [PAL.inkPop, '#3b2a6b'], max: 160, kind: 'blob', size: 6 }); }
  addMarker(m) { this.markers.push({ t: 0, ...m }); }
  // ---------------- projectiles & hazards ----------------
  spawnEnemyShot(x, y, vx, vy, o) { this.shots.push({ x, y, vx, vy, r: o.r || 7, dmg: o.dmg, g: o.g || 0, owner: 'enemy', life: o.life || 3, info: o, ember: o.ember, burst: o.burst || 0, t: 0 }); }
  spawnArrow(p, d) { const big = d.proj.big; this.shots.push({ x: p.cx + p.face * 12, y: p.cy - 4, vx: p.face * d.proj.speed, vy: 0, r: big ? 7 : 5, dmg: d.dmg, g: 0, owner: 'player', life: d.proj.life, pierce: d.proj.pierce, kb: d.kb, hs: d.hs, breaks: d.breaks, arrow: true, big, hit: new Set(), t: 0 }); }
  updateShots(dt) {
    const P = this.player;
    for (const s of this.shots) {
      s.t += dt; s.life -= dt; s.vy += s.g * dt; s.x += s.vx * dt; s.y += s.vy * dt;
      if (s.life <= 0) { s.dead = true; if (s.ember) this.emberBurst(s); continue; }
      if (this.map.solidPx(s.x, s.y) || (s.ember && s.vy > 0 && this.map.get(Math.floor(s.x / TILE), Math.floor((s.y + s.r) / TILE)) === '=')) { s.dead = true; if (s.ember) this.emberBurst(s); else this.fx.burst(s.x, s.y, 5, { color: s.owner === 'player' ? '#a6e47a' : '#c9b8f0', max: 100 }); this.breakTiles({ x: s.x - 2, y: s.y - 2, w: 4, h: 4 }); continue; }
      if (s.owner === 'enemy') {
        if (this.overlapPlayer({ x: s.x - s.r, y: s.y - s.r, w: s.r * 2, h: s.r * 2 }, 3)) { const r = this.damagePlayer(s.dmg, s.x, { name: s.info.name, tip: s.info.tip, shot: s, parryable: true }); if (r === 'hit') { s.dead = true; this.fx.burst(s.x, s.y, 8, { color: '#c9b8f0', max: 140 }); } else if (r === 'dodge') { /* pass through */ } }
      } else {
        for (const e of this.enemies) { if (e.dead || (s.hit && s.hit.has(e))) continue; if (s.x > e.x - s.r && s.x < e.x + e.w + s.r && s.y > e.y - s.r && s.y < e.y + e.h + s.r) {
          if (s.hit) s.hit.add(e); this.hitEnemy(e, { dmg: s.dmg, kb: s.kb || 200, hs: s.hs || 0.06, shake: 0.15, breaks: s.breaks || s.reflected, reflected: s.reflected, src: 'shot' }, { cx: s.x - s.vx * 0.01, face: sign(s.vx), x: s.x, vx: 0 });
          if (!s.pierce) { s.dead = true; if (s.ember) this.emberBurst(s); break; } } }
      }
    }
    this.shots = this.shots.filter((s) => !s.dead);
  }
  emberBurst(s) { this.fx.burst(s.x, s.y, 12, { color: ['#ffb13b', '#ff6a3a', '#fff'], max: 200, life: 0.4, glow: 1 }); this.fx.ring(s.x, s.y, s.burst || 26, '#ff9a5a', 0.3, 4); sfx('explode', 0.08);
    if (s.owner === 'enemy') { const P = this.player; if (Math.hypot(P.cx - s.x, P.y + P.h - 10 - s.y) < (s.burst || 26) + 8) this.damagePlayer(s.dmg, s.x, { name: s.info.name, tip: s.info.tip, parryable: false }); } }
  throwBomb(e, tx, ty) {
    const T = 0.8, g = 900, x = e.cx, y = e.y - 4; ty = this.groundY(tx, ty);
    this.bombs.push({ x, y, vx: (tx - x) / T, vy: (ty - 8 - y - 0.5 * g * T * T) / T, g, owner: 'enemy', fuse: 0.75, landed: false, t: 0, src: e });
    this.addMarker({ kind: 'circle', x: tx, y: ty - 2, r: 46, life: T + 0.75 });
  }
  groundY(x, y) { const tx = Math.floor(x / TILE); for (let ty = Math.floor((y - 10) / TILE); ty < this.map.h; ty++) { const c = this.map.get(tx, ty); if (c === '#' || c === 'B' || c === '=' || c === 'G') return ty * TILE; } return y; }
  updateBombs(dt) {
    for (const b of this.bombs) {
      b.t += dt;
      if (!b.landed) { b.vy += b.g * dt; const nx = b.x + b.vx * dt, ny = b.y + b.vy * dt;
        if (this.map.solidPx(nx, b.y)) b.vx = -b.vx * 0.4; else b.x = nx;
        if (b.vy > 0 && (this.map.solidPx(b.x, ny + 6) || this.map.get(Math.floor(b.x / TILE), Math.floor((ny + 6) / TILE)) === '=')) { b.landed = true; b.y = Math.floor((ny + 6) / TILE) * TILE - 6; b.vx = 0; b.vy = 0; } else if (this.map.solidPx(b.x, ny - 6)) b.vy = 0; else b.y = ny; }
      else b.fuse -= dt;
      if (b.owner === 'player') { b.fuse -= dt; for (const e of this.enemies) if (!e.dead && Math.abs(e.cx - b.x) < e.w / 2 + 8 && Math.abs(e.cy - b.y) < e.h / 2 + 8) { b.fuse = 0; break; } }
      if (b.fuse <= 0) { b.dead = true; this.explode(b.x, b.y, b.r || 46, b.owner, b.dmg || (b.owner === 'player' ? 32 : 14), b.src); }
    }
    this.bombs = this.bombs.filter((b) => !b.dead);
  }
  explode(x, y, r, owner, dmg, src) {
    sfx('explode'); this.fx.shake(0.35); this.fx.ring(x, y, r, '#ffd36b', 0.35, 6); this.fx.burst(x, y, 22, { color: ['#ffd36b', '#ff8a3a', '#fff', '#7d5cff'], max: 300, glow: 1, life: 0.5 });
    if (owner === 'enemy') { const P = this.player; if (Math.hypot(P.cx - x, P.cy - y) < r + 10) this.damagePlayer(dmg, x, { name: ENEMY_INFO.bomber.name, tip: ENEMY_INFO.bomber.tip, parryable: false }); }
    else for (const e of this.enemies) if (!e.dead && Math.hypot(e.cx - x, e.cy - y) < r + Math.max(e.w, e.h) / 2) this.hitEnemy(e, { dmg, kb: 300, hs: 0.06, shake: 0.2, breaks: true, src: 'bomb' }, { cx: x, face: 1 });
    this.breakTiles({ x: x - r * 0.7, y: y - r * 0.7, w: r * 1.4, h: r * 1.4 });
  }
  spawnWave(x, y, dir, speed, src) { this.waves.push({ x, y, dir, speed, life: 2.6, t: 0, src }); }
  updateWaves(dt) {
    for (const w of this.waves) { w.t += dt; w.x += w.dir * w.speed * dt; w.life -= dt; const tx = Math.floor((w.x + w.dir * 10) / TILE), ty = Math.floor((w.y - 6) / TILE); if (this.map.solid(tx, ty) || !this.map.solid(tx, ty + 1) && this.map.get(tx, ty + 1) !== '=' || w.life <= 0) w.dead = true;
      if (!w.dead) this.enemyAttack({ x: w.x - 10, y: w.y - 22, w: 20, h: 22 }, 12, { cx: w.x - w.dir * 10 }, { parryable: false, name: w.src.info.name + ' shockwave', tip: 'Shockwaves roll along the floor. Jump over them!' }); }
    this.waves = this.waves.filter((w) => !w.dead);
  }
  dropPillar(x, topY, floorY, src) { this.pillars.push({ x: x - 20, y: topY, w: 40, h: 44, vy: 200, floorY, src }); sfx('thump'); }
  updatePillars(dt) {
    for (const p of this.pillars) { p.vy += 1600 * dt; p.y += p.vy * dt; this.enemyAttack(p, 18, { cx: p.x + 20 }, { parryable: false, name: 'Falling Soot Rock', tip: 'Dark shadows on the floor show where rocks will fall.' });
      if (p.y + p.h >= p.floorY) { p.dead = true; this.fx.burst(p.x + 20, p.floorY - 10, 16, { color: ['#5a4a5e', '#8a7a90', '#ffb13b'], max: 260, size: 6 }); this.fx.shake(0.25); sfx('explode', 0.05); } }
    this.pillars = this.pillars.filter((p) => !p.dead);
  }
  useGadget(id, p) {
    if (id === 'popseed') { this.bombs.push({ x: p.cx + p.face * 10, y: p.y + 8, vx: p.face * 270 + p.vx * 0.4, vy: -300, g: 900, owner: 'player', fuse: 1.0, landed: false, t: 0, r: 64, dmg: 34 }); sfx('bow'); this.emit('gadget'); }
    if (id === 'sentry') { this.sentries.push({ x: p.cx, y: p.y + p.h, life: 9, cd: 0.4, t: 0 }); sfx('unlock'); this.fx.burst(p.cx, p.y + p.h - 10, 12, { color: ['#a6e47a', '#fff'], max: 140, kind: 'leaf', size: 5 }); this.emit('gadget'); }
  }
  updateSentries(dt) {
    for (const s of this.sentries) { s.t += dt; s.life -= dt; s.cd -= dt; if (s.life <= 0) { s.dead = true; this.fx.burst(s.x, s.y - 10, 10, { color: '#a6e47a', kind: 'leaf', max: 120 }); continue; }
      if (s.cd <= 0) { let best = null, bd = 300; for (const e of this.enemies) { if (e.dead || e.type === 'dummy' || e.st === 'sleep') continue; const d = Math.hypot(e.cx - s.x, e.cy - (s.y - 16)); if (d < bd && lineClear(this.map, s.x, s.y - 16, e.cx, e.cy)) { bd = d; best = e; } }
        if (best) { s.cd = 0.55; const dx = best.cx - s.x, dy = best.cy - (s.y - 16), d = Math.hypot(dx, dy); this.shots.push({ x: s.x, y: s.y - 16, vx: dx / d * 520, vy: dy / d * 520, r: 4, dmg: 6, g: 0, owner: 'player', life: 0.8, kb: 60, hs: 0.01, arrow: true, hit: new Set(), t: 0 }); sfx('bow', 0.1); s.aim = Math.atan2(dy, dx); } else s.cd = 0.2; } }
    this.sentries = this.sentries.filter((s) => !s.dead);
  }
  updatePickups(dt) {
    const P = this.player;
    for (const k of this.pickups) {
      k.t += dt;
      const dx = P.cx - k.x, dy = P.cy - k.y, d = Math.hypot(dx, dy);
      if (k.t > 0.45 && d < (k.kind === 'glim' ? 90 : 40) && !P.dead) { const sp = 520; k.vx = dx / d * sp; k.vy = dy / d * sp; k.x += k.vx * dt; k.y += k.vy * dt; }
      else if (!k.float) { k.vy = Math.min(k.vy + 900 * dt, 400); k.vx *= 1 - 2 * dt; const nx = k.x + k.vx * dt, ny = k.y + k.vy * dt; if (this.map.solidPx(nx, k.y)) k.vx = -k.vx * 0.3; else k.x = nx; const c = this.map.get(Math.floor(k.x / TILE), Math.floor((ny + 4) / TILE)); if (k.vy > 0 && (c === '#' || c === 'B' || c === 'G' || c === '=')) { k.vy = -k.vy * 0.3; if (Math.abs(k.vy) < 40) { k.vy = 0; k.vx *= 0.8; } } else if (this.map.solidPx(k.x, ny - 4)) k.vy = 0; else k.y = ny; }
      if (d < 18 && !P.dead) { k.dead = true;
        if (k.kind === 'glim') { this.runGlim++; this.emit('glim'); sfx('pickup', 0.03); this.fx.burst(k.x, k.y, 3, { color: PAL.glimmer, max: 60, g: 0, life: 0.3, glow: 1 }); }
        else if (k.kind === 'lore') SW.pickLore(this, k);
        else { const h = k.big ? P.maxHp * 0.5 : P.maxHp * 0.15; P.healLeft += h; sfx('flask'); this.fx.text(P.cx, P.y - 8, '+' + Math.round(h), '#9ff0b0', 14); } }
    }
    this.pickups = this.pickups.filter((k) => !k.dead);
  }
  // ---------------- rendering ----------------
  ensureCaches(rs) {
    if (this.rs !== rs || this.gver !== G.ver) { this.rs = rs; this.gver = G.ver; this.chunkCache.clear(); this.bg = makeBackground(this.biome, Math.min(rs, 2), this.mode === 'boss' ? 3 : this.mode === 'hub' ? 11 : 7); this.skyG = null; }
  }
  draw(g, cw, ch, rs) {
    this.ensureCaches(rs); const VW = cw / rs; this.viewW = VW;
    const [sx, sy] = this.fx.shakeOffset(this.t); const camx = Math.round((this.cam.x + sx) * rs) / rs, camy = Math.round((this.cam.y + sy) * rs) / rs;
    const B = this.biome;
    const lo = (this.game && this.game.lowPerf) || save.settings.quality === 'low';
    const painted = paintedOK(); const PF = this.prof; let pt = PF ? performance.now() : 0; const mk = PF ? (k) => { const n = performance.now(); PF[k] = (PF[k] || 0) + n - pt; pt = n; } : null;
    if (painted) drawPaintedBg(this, g, cw, ch, rs, camx, camy, lo);
    else {
    // sky
    if (!this.skyG || this.skyH !== ch) { this.skyG = g.createLinearGradient(0, 0, 0, ch); this.skyG.addColorStop(0, B.skyTop); this.skyG.addColorStop(0.55, B.skyMid); this.skyG.addColorStop(1, B.skyLow); this.skyH = ch; }
    g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = this.skyG; g.fillRect(0, 0, cw, ch);
    // sun glow
    drawGlow(g, cw * 0.72, ch * 0.62, ch * 0.7, B.light, 0.35);
    // parallax
    const brs = Math.min(rs, 2), scale = rs / brs;
    for (const L of this.bg) {
      const lw = L.c.width * scale, lh = L.c.height * scale; let ox = -((camx * L.f * rs) % lw); if (ox > 0) ox -= lw;
      const oy = ch - lh + L.y * rs * 0.4 - clamp((camy - (this.map.h * TILE - (this.viewH || VIEW_H))) * L.f * rs * 0.25, -ch * 0.3, ch * 0.3);
      for (let x = ox; x < cw; x += lw) g.drawImage(L.c, x, oy, lw + 1, lh);
    }
    // god rays
    if (!lo) { g.globalCompositeOperation = 'lighter'; g.fillStyle = B.fog; for (let i = 0; i < 3; i++) { const x = ((i * 0.37 + 0.15) * cw - camx * rs * 0.05) % (cw * 1.2); g.beginPath(); g.moveTo(x, 0); g.lineTo(x + cw * 0.12, 0); g.lineTo(x + cw * 0.32, ch); g.lineTo(x + cw * 0.18, ch); g.fill(); } g.globalCompositeOperation = 'source-over'; }
    }
    mk && mk('bg');
    const zk = this.zoomK || 0, z = 1 + 0.045 * zk * zk * (3 - 2 * zk); let zr = rs * z, tox = -camx * zr + cw * 0.5 * (1 - z), toy = -camy * zr + ch * 0.5 * (1 - z);
    const ck = BR.cineK(this); if (ck > 0) { const c = this.cine; zr = rs * z * (1 + (c.zoom - 1) * ck); const Sx = lerp((c.x - camx) * rs, cw * 0.5, 0.6 * ck), Sy = lerp((c.y - camy) * rs, ch * 0.48, 0.6 * ck); // v2.0 focus zoom, kept inside the camera view
      tox = clamp(Sx - c.x * zr, cw - (camx + cw / rs) * zr, -camx * zr); toy = clamp(Sy - c.y * zr, ch - (camy + ch / rs) * zr, -camy * zr); }
    this.wt = [zr, tox, toy];
    g.setTransform(zr, 0, 0, zr, tox, toy);
    const vx0 = camx - 40, vx1 = camx + VW + 40, vy0 = camy - 40, vy1 = camy + (this.viewH || VIEW_H) + 40;
    const vr = this.vr = [vx0 - 140, vx1 + 140, vy0 - 140, vy1 + 140]; const offV = (x, y, w = 0, h = 0) => x + w < vr[0] || x > vr[1] || y + h < vr[2] || y > vr[3]; this.offV = offV; // v1.4: cull off-screen props/anchors/markers/shots
    // lanterns light behind tiles
    if (!lo) for (const l of this.lights) if (l.x > vx0 - 100 && l.x < vx1 + 100 && l.y > vy0 - 100 && l.y < vy1 + 100) drawGlow(g, l.x, l.y + 10, 110 + Math.sin(this.t * 2 + l.x) * 6, B.light, 0.35);
    // background dark mass behind level (inside rooms only for runs)
    if (this.mode === 'hub') SW.drawHubBack(g, this);
    // tiles
    const CS = CHUNK_T * TILE; const c0 = Math.floor(vx0 / CS), c1 = Math.floor(vx1 / CS), r0 = Math.floor(vy0 / CS), r1 = Math.floor(vy1 / CS);
    for (let cy = r0; cy <= r1; cy++) for (let cx = c0; cx <= c1; cx++) {
      if (cx < 0 || cy < 0 || cx * CHUNK_T >= this.map.w || cy * CHUNK_T >= this.map.h) continue;
      const k = cx + ',' + cy; let c = this.chunkCache.get(k); if (!c) { c = G.ready ? renderPaintedChunk(this.map, cx, cy, rs, B) : renderTileChunk(this.map, cx, cy, rs, B); this.chunkCache.set(k, c); this.chunkMade = (this.chunkMade || 0) + 1; while (this.chunkCache.size > CHUNK_KEEP) { const old = this.chunkCache.keys().next().value; this.chunkCache.delete(old); this.chunkEvicted = (this.chunkEvicted || 0) + 1; } } else { this.chunkCache.delete(k); this.chunkCache.set(k, c); } // LRU: stream render chunks in/out with the camera
      g.drawImage(c, cx * CS, cy * CS, c.width / rs, c.height / rs);
    }
    if (this.chunkMade === this._cm0) { // v1.4: no chunk was built this frame -> pre-build one neighbour in the scroll direction so crossing a chunk edge never hitches
      const dir = (this.cam.vx || 0) >= 0 ? 1 : -1; outer: for (const cx of [dir > 0 ? c1 + 1 : c0 - 1, dir > 0 ? c0 - 1 : c1 + 1]) for (let cy = r0 - 1; cy <= r1 + 1; cy++) { if (cx < 0 || cy < 0 || cx * CHUNK_T >= this.map.w || cy * CHUNK_T >= this.map.h) continue; const k = cx + ',' + cy; if (!this.chunkCache.has(k)) { if (this.chunkCache.size >= CHUNK_KEEP) this.chunkCache.delete(this.chunkCache.keys().next().value); this.chunkCache.set(k, G.ready ? renderPaintedChunk(this.map, cx, cy, rs, B) : renderTileChunk(this.map, cx, cy, rs, B)); break outer; } }
    }
    this._cm0 = this.chunkMade;
    mk && mk('tiles'); this.drawHazards(g, vx0, vx1, vy0, vy1); this.traps.draw(g, vx0, vx1, vy0, vy1); this.arenas.draw(g);
    drawGuidesFront(g, this); this.drawProps(g); for (const o of this.props) if (o.kind === 'door') drawGate(g, this, o); drawSeeds(g, this);
    drawGuidesBack(g, this); this.drawAnchors(g);
    this.drawMarkers(g);
    for (const s of this.sentries) this.drawSentry(g, s);
    CB.drawBack(g, this); if (this.special) CB.drawSpecialWorld(g, this);
    mk && mk('props'); for (const e of this.enemies) if (e.x + e.w > vx0 && e.x < vx1 && e.y + e.h > vy0 && e.y < vy1) { BR.drawFoeBack(g, this, e, lo); const rk = e.rkT ? Math.max(0, 1 - (this.t - e.rkT) / 0.16) : 0, rot = (e.spin || 0) + (e.boss ? 0 : rk * 0.2 * (e.rkD || 0)) + (e.flipT > this.t ? Math.PI : 0), sc = e.eScale || 1; // v1.9 ragdoll spin; v2.0 recoil lean, flipped shells, elite scale
      if (rot || sc !== 1) { g.save(); g.translate(e.cx, e.y + e.h); g.scale(sc, sc); g.translate(0, -e.h / 2); g.rotate(rot); g.translate(-e.cx, -e.cy); e.draw(g, this); g.restore(); } else e.draw(g, this); BR.drawFoeFront(g, this, e); }
    mk && mk('enemies'); this.dbg = { px: this.player.x, camx }; drawCritters(g, this); this.player.draw(g, this); mk && mk('player');
    this.drawShots(g);
    for (const w of this.waves) { const k = Math.sin(this.t * 30) * 2; g.fillStyle = '#7d5cff'; g.strokeStyle = '#15131f'; g.lineWidth = 2; g.beginPath(); g.moveTo(w.x - 12, w.y); g.quadraticCurveTo(w.x - w.dir * 2, w.y - 26 - k, w.x + w.dir * 12, w.y); g.closePath(); g.fill(); g.stroke(); drawGlow(g, w.x, w.y - 10, 26, '#ff5a7a', 0.6); }
    for (const p of this.pillars) { g.fillStyle = '#4a3e50'; g.strokeStyle = '#15131f'; g.lineWidth = 2.5; g.beginPath(); g.roundRect(p.x, p.y, p.w, p.h, 8); g.fill(); g.stroke(); g.fillStyle = '#ff8a5a'; g.fillRect(p.x + 8, p.y + 14, 6, 6); g.fillRect(p.x + 24, p.y + 26, 5, 5); }
    for (const k of this.pickups) if (!offV(k.x, k.y)) this.drawPickup(g, k);
    if (this.player.hookTarget && this.player.hook.s === 'none' && !this.player.dead) this.drawReticle(g, this.player.hookTarget);
    CB.drawFront(g, this, lo); mk && mk('shots'); this.fx.draw(g); mk && mk('fx');
    if (this.bloomT) this.drawBloom(g);
    if (painted && !lo) drawMotes(this, g, vx0, vx1, vy0, vy1);
    g.setTransform(1, 0, 0, 1, 0, 0);
    mk && mk('motes'); if (painted) drawForeground(this, g, cw, ch, rs, camx, camy); mk && mk('fg');
    // vignette
    if (!this.vig || this.vigW !== cw) { const v = g.createRadialGradient(cw / 2, ch / 2, ch * 0.45, cw / 2, ch / 2, cw * 0.75); v.addColorStop(0, 'rgba(10,8,20,0)'); v.addColorStop(1, 'rgba(10,8,20,0.55)'); this.vig = v; this.vigW = cw; }
    if (!lo) { if (painted) drawGrade(this, g, cw, ch); else { g.fillStyle = this.vig; g.fillRect(0, 0, cw, ch); } }
    if (this.special) CB.drawSpecial(g, this, cw, ch);
    if (this.fx.flash > 0) { g.globalAlpha = this.fx.flash * 0.35; g.fillStyle = this.fx.flashColor; g.fillRect(0, 0, cw, ch); g.globalAlpha = 1; }
    // low health edge pulse
    const P = this.player; if (P.hp / P.maxHp < 0.3 && !P.dead) { g.globalAlpha = 0.18 + Math.sin(this.t * 5) * 0.08; g.strokeStyle = '#ff3d6e'; g.lineWidth = ch * 0.05; g.strokeRect(0, 0, cw, ch); g.globalAlpha = 1; }
    if (this.fade > 0) { g.globalAlpha = this.fade; g.fillStyle = '#0d0b16'; g.fillRect(0, 0, cw, ch); g.globalAlpha = 1; }
    this.camx = camx; this.camy = camy; mk && mk('grade+post'); if (PF) PF.n = (PF.n || 0) + 1;
  }
  drawHazards(g, vx0, vx1, vy0, vy1) {
    const t = this.t, pulse = 0.65 + Math.sin(t * 5) * 0.35;
    for (const h of this.hazTiles) {
      const X = h.x * TILE, Y = h.y * TILE; if (X < vx0 - 24 || X > vx1 || Y < vy0 - 24 || Y > vy1) continue;
      if (h.c === '^' || h.c === 'v') {
        const up = h.c === '^'; const base = up ? Y + TILE : Y, dir = up ? -1 : 1;
        // v1.6 bramble: a thorny vine stem lying along the ground/ceiling with curved red thorns
        g.fillStyle = '#15131f'; g.fillRect(X - 1, up ? Y + TILE - 6 : Y, TILE + 2, 6); g.fillStyle = '#3a4a26'; g.fillRect(X - 1, up ? Y + TILE - 5 : Y + 1, TILE + 2, 4);
        g.fillStyle = '#5f8a3a'; g.beginPath(); g.ellipse(X + 5 + (h.x % 3) * 5, base + dir * 3, 3.4, 1.5, 0.4, 0, 7); g.fill();
        if (G.ready) { const gr = g.createLinearGradient(0, base, 0, base + dir * 18); gr.addColorStop(0, '#5a1420'); gr.addColorStop(0.55, '#d4283c'); gr.addColorStop(1, '#ff9aa8'); g.fillStyle = gr; g.lineWidth = 2.4; } else { g.fillStyle = PAL.hazard; g.lineWidth = 1.8; }
        g.strokeStyle = '#15131f'; g.beginPath();
        for (let i = 0; i < 3; i++) { const x = X + i * 8, hh = 15 + (i % 2) * 3, bend = (i - 1) * 1.5; g.moveTo(x, base + dir * 3); g.quadraticCurveTo(x + 2 + bend, base + dir * hh * 0.6, x + 4 + bend * 1.6, base + dir * hh); g.quadraticCurveTo(x + 5.5 + bend, base + dir * hh * 0.5, x + 8, base + dir * 3); }
        g.fill(); g.stroke();
        g.fillStyle = '#ffd0dc'; for (let i = 0; i < 3; i++) { const x = X + i * 8 + 4; g.fillRect(x - 0.6, base + dir * (12 + (i % 2) * 3), 1.2, 3); }
        if (G.ready || (h.x + h.y) % 2 === 0) drawGlow(g, X + 12, base + dir * 8, 22, PAL.hazardGlow, (G.ready ? 0.3 : 0.35) * pulse);
      } else {
        const top = this.map.get(h.x, h.y - 1) !== '~';
        g.fillStyle = '#5a0f38'; g.fillRect(X, Y + (top ? 8 : 0), TILE, TILE - (top ? 8 : 0));
        if (top) { g.fillStyle = PAL.hazard; g.beginPath(); g.moveTo(X, Y + 10); for (let i = 0; i <= 4; i++) g.lineTo(X + i * 6, Y + 8 + Math.sin(t * 4 + h.x * 1.7 + i) * 2.5); g.lineTo(X + TILE, Y + 14); g.lineTo(X, Y + 14); g.fill();
          drawGlow(g, X + 12, Y + 8, 26, PAL.hazardGlow, 0.45 * pulse);
          if (Math.random() < 0.02) this.fx.burst(X + Math.random() * 24, Y + 8, 1, { color: '#ff8aa8', min: 10, max: 30, g: -60, life: 1, size: 3, glow: 1 }); }
      }
    }
  }
  // v1.6 test hook: audit support chains + paint every chunk (offscreen, rs 0.25) and report pieces the painter never drew
  auditSupports() {
    const sup = this.map.sup; sup.drawn.clear(); const bad = auditSupports(this.map, sup);
    if (G.ready) for (let cy = 0; cy * CHUNK_T < this.map.h; cy++) for (let cx = 0; cx * CHUNK_T < this.map.w; cx++) renderPaintedChunk(this.map, cx, cy, 0.25, this.biome);
    const undrawn = G.ready ? sup.pieces.filter((p) => !sup.drawn.has(p.id)) : [];
    const kinds = {}; for (const p of sup.pieces) { const k = p.kind + ':' + p.sup.type; kinds[k] = (kinds[k] || 0) + 1; }
    const fmt = (p) => `${p.kind}/${p.sub || ''}@${p.x0},${p.y}:${p.sup.type}`;
    return { pieces: sup.pieces.length, bad: bad.map(fmt), undrawn: undrawn.map(fmt), unknown: sup.pieces.filter((p) => p.kind === 'trap' && p.sup.type === 'embedded' && p.sup.ends[0].on !== 'solid').map(fmt), kinds, painted: G.ready };
  }
  drawAnchors(g) {
    const t = this.t, P = this.player, lo = (this.game && this.game.lowPerf) || save.settings.quality === 'low';
    for (const a of this.anchors) {
      if (this.offV && this.offV(a.x, a.y)) continue;
      const near = Math.hypot(a.x - P.cx, a.y - P.cy) < P.hookRange; const k = 0.8 + Math.sin(t * 3 + a.pulse) * 0.2;
      const hl = this.highlightAnchor && near;
      if (a.kind === 'swing') {
        drawGlow(g, a.x, a.y, (near ? 32 : 24) * k * (hl ? 1.6 : 1), ANCHOR_GLOW, near ? 0.8 : 0.5);
        if (has('ring')) { g.strokeStyle = '#15131f'; g.lineWidth = 4; g.beginPath(); g.moveTo(a.x, a.y - 15); g.lineTo(a.x, a.y - 8); g.stroke(); g.strokeStyle = '#3f8a3a'; g.lineWidth = 2; g.stroke(); // vine tie (vine itself is painted with the tiles)
          g.save(); g.translate(a.x, a.y); g.rotate(Math.sin(t * 1.6 + a.pulse) * 0.12); if (!lo) for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) spr(g, 'ring', dx, dy + 11, 22, 0.5, 1, false, tinted('ring', '#15131f')); spr(g, 'ring', 0, 11, 22, 0.5, 1);
          if (!lo) { g.globalCompositeOperation = 'lighter'; g.globalAlpha = near ? 0.6 : 0.35; } else g.globalAlpha = 0; spr(g, 'ring', 0, 11, 22, 0.5, 1, false, tinted('ring', ANCHOR_GLOW)); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over'; g.restore(); }
        else {
        g.strokeStyle = '#15131f'; g.lineWidth = 6; g.beginPath(); g.arc(a.x, a.y, 8, 0, 7); g.stroke(); g.strokeStyle = PAL.swing; g.lineWidth = 3.5; g.stroke();
        g.fillStyle = '#fff6c8'; g.beginPath(); g.arc(a.x - 3, a.y - 4, 1.6, 0, 7); g.fill();
        g.strokeStyle = '#3f8a3a'; g.lineWidth = 2; g.beginPath(); g.moveTo(a.x, a.y - 8); g.lineTo(a.x, a.y - 15); g.stroke(); }
      } else {
        drawGlow(g, a.x, a.y, (near ? 32 : 24) * k * (hl ? 1.6 : 1), ANCHOR_GLOW, near ? 0.8 : 0.5);
        if (has('crystal')) { g.strokeStyle = '#15131f'; g.lineWidth = 4; g.beginPath(); g.moveTo(a.x, a.y - 15); g.lineTo(a.x, a.y - 9 + Math.sin(t * 2 + a.pulse) * 1.5); g.stroke(); g.strokeStyle = '#3f8a3a'; g.lineWidth = 2; g.stroke(); g.save(); g.translate(a.x, a.y + Math.sin(t * 2 + a.pulse) * 1.5); if (!lo) for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) spr(g, 'crystal', dx, dy + 12, 24, 0.5, 1, false, tinted('crystal', '#15131f')); spr(g, 'crystal', 0, 12, 24, 0.5, 1);
          if (!lo) { g.globalCompositeOperation = 'lighter'; g.globalAlpha = near ? 0.6 : 0.35; } else g.globalAlpha = 0; spr(g, 'crystal', 0, 12, 24, 0.5, 1, false, tinted('crystal', ANCHOR_GLOW)); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over'; g.restore(); }
        else { g.save(); g.translate(a.x, a.y); g.rotate(Math.PI / 4 + Math.sin(t * 2 + a.pulse) * 0.1); g.fillStyle = '#15131f'; g.fillRect(-8, -8, 16, 16); g.fillStyle = PAL.zip; g.fillRect(-6, -6, 12, 12); g.fillStyle = '#e8fffb'; g.fillRect(-3, -3, 6, 6); g.restore(); }
      }
      if (hl) { const p = (t * 1.5) % 1; g.globalAlpha = 1 - p; g.strokeStyle = '#fff'; g.lineWidth = 2; g.beginPath(); g.arc(a.x, a.y, 12 + p * 24, 0, 7); g.stroke(); g.globalAlpha = 1; }
    }
  }
  drawReticle(g, tg) {
    const t = this.t, r = 15 + Math.sin(t * 10) * 1.5, col = tg.kind === 'zip' || tg.kind === 'swing' ? ANCHOR_GLOW : '#ff8aa0';
    g.strokeStyle = col; g.lineWidth = 2.5; g.save(); g.translate(tg.x, tg.y); g.rotate(t * 2);
    for (let i = 0; i < 4; i++) { g.rotate(Math.PI / 2); g.beginPath(); g.arc(0, 0, r, -0.4, 0.4); g.stroke(); }
    g.restore();
    const P = this.player; g.globalAlpha = 0.25; g.setLineDash([4, 6]); g.strokeStyle = col; g.lineWidth = 1.5; g.beginPath(); g.moveTo(P.cx, P.y + 12); g.lineTo(tg.x, tg.y); g.stroke(); g.setLineDash([]); g.globalAlpha = 1;
  }
  drawMarkers(g) {
    const t = this.t;
    for (const m of this.markers) {
      if (this.offV && this.offV(m.x, m.y, m.w || 0, m.h || 0)) continue;
      const k = m.t / m.life, blink = 0.45 + 0.35 * Math.sin(t * (10 + k * 25));
      g.save();
      if (m.kind === 'circle') { g.globalAlpha = blink * 0.6; g.fillStyle = '#ff3d6e'; g.beginPath(); g.ellipse(m.x, m.y, m.r, m.r * 0.32, 0, 0, 7); g.fill(); g.globalAlpha = 0.95; g.strokeStyle = '#ffd0dc'; g.lineWidth = 2; g.beginPath(); g.ellipse(m.x, m.y, m.r * (1 - k * 0.7), m.r * 0.32 * (1 - k * 0.7), 0, 0, 7); g.stroke(); g.beginPath(); g.ellipse(m.x, m.y, m.r, m.r * 0.32, 0, 0, 7); g.stroke(); }
      else if (m.kind === 'shadow') { g.globalAlpha = 0.35 + k * 0.5; g.fillStyle = '#15131f'; g.beginPath(); g.ellipse(m.x + m.w / 2, m.y + 4, m.w / 2 * (0.5 + k * 0.6), 6, 0, 0, 7); g.fill(); g.globalAlpha = blink * 0.7; g.strokeStyle = '#ff3d6e'; g.lineWidth = 2; g.stroke(); g.globalAlpha = 0.25 * k; g.fillStyle = '#ff3d6e'; g.fillRect(m.x + m.w / 2 - 2, this.room.y + 30, 4, m.y - this.room.y - 30); }
      else { // v1.3 telegraph: red floor-up gradient that fills as the attack nears, glowing floor line + chevrons (no white box)
        const by = m.y + m.h, gr = g.createLinearGradient(0, m.y, 0, by); gr.addColorStop(0, 'rgba(255,40,70,0)'); gr.addColorStop(0.55, 'rgba(255,40,70,0.28)'); gr.addColorStop(1, 'rgba(255,60,80,0.62)');
        g.globalAlpha = 0.55 + blink * 0.45; g.fillStyle = gr; g.fillRect(m.x, m.y, m.w, m.h);
        g.globalAlpha = 0.35 + 0.5 * k; g.fillStyle = 'rgba(255,70,90,0.55)'; const fh = m.h * k; g.fillRect(m.x, by - fh, m.w, fh);
        g.globalAlpha = 1; drawGlow(g, m.x + m.w / 2, by - 2, m.w * 0.55, '#ff2a4a', 0.35 + blink * 0.3); g.fillStyle = '#ff5a70'; g.fillRect(m.x, by - 3, m.w, 3); g.fillStyle = '#ffd0d8'; g.fillRect(m.x, by - 3, m.w, 1);
        g.fillStyle = '#ff2040'; g.fillRect(m.x, m.y + 4, 2, m.h - 4); g.fillRect(m.x + m.w - 2, m.y + 4, 2, m.h - 4);
        g.strokeStyle = 'rgba(255,220,225,' + (0.5 + blink * 0.5) + ')'; g.lineWidth = 2.4; g.lineJoin = 'round';
        const step = m.kind === 'beam' ? 120 : 40; for (let x = m.x + step / 2; x < m.x + m.w; x += step) { const yy = by - 12 - ((t * 30 + x) % 14); g.beginPath(); g.moveTo(x - 7, yy + 5); g.lineTo(x, yy - 2); g.lineTo(x + 7, yy + 5); g.stroke(); }
        if (m.kind === 'beam') { g.globalAlpha = blink; for (let x = m.x + 60; x < m.x + m.w; x += 120) drawIcon(g, 'up', x, m.y + m.h / 2, 26, '#fff'); } }
      g.restore();
    }
  }
  drawShots(g) {
    for (const s of this.shots) {
      if (this.offV && this.offV(s.x, s.y)) continue;
      if (s.arrow) { const a = Math.atan2(s.vy, s.vx); g.save(); g.translate(s.x, s.y); g.rotate(a); g.fillStyle = s.big ? '#eaffc0' : '#a6e47a'; g.strokeStyle = '#15131f'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(8, 0); g.lineTo(-10, -2.5); g.lineTo(-10, 2.5); g.closePath(); g.fill(); g.stroke(); g.restore(); if (s.big) drawGlow(g, s.x, s.y, 18, '#a6e47a', 0.6); continue; }
      const col = s.reflected ? '#bff2ff' : s.ember ? '#ffb13b' : '#c9b8f0';
      drawGlow(g, s.x, s.y, s.r * 3.2, s.reflected ? '#9fe8ff' : s.ember ? '#ff8a3a' : '#b88aff', 0.8);
      g.fillStyle = '#15131f'; g.beginPath(); g.arc(s.x, s.y, s.r + 1.5, 0, 7); g.fill(); g.fillStyle = col; g.beginPath(); g.arc(s.x, s.y, s.r, 0, 7); g.fill(); g.fillStyle = '#fff'; g.beginPath(); g.arc(s.x - s.r * 0.3, s.y - s.r * 0.3, s.r * 0.3, 0, 7); g.fill();
    }
    for (const b of this.bombs) { g.fillStyle = '#3a3048'; g.strokeStyle = '#15131f'; g.lineWidth = 2; g.beginPath(); g.arc(b.x, b.y, 7, 0, 7); g.fill(); g.stroke(); const blink = b.landed && Math.sin(this.t * 30) > 0; drawGlow(g, b.x + 2, b.y - 8, blink ? 14 : 8, b.owner === 'player' ? '#a6e47a' : '#ff6a3a', 1); if (b.owner === 'player') { g.fillStyle = '#7fe0a0'; g.beginPath(); g.ellipse(b.x + 3, b.y - 7, 4, 2, 0.5, 0, 7); g.fill(); } }
  }
  drawSentry(g, s) {
    g.save(); g.translate(s.x, s.y); g.fillStyle = '#2e7a3f'; g.strokeStyle = '#15131f'; g.lineWidth = 2; g.beginPath(); g.moveTo(-10, 0); g.quadraticCurveTo(0, -26, 10, 0); g.closePath(); g.fill(); g.stroke();
    g.rotate(s.aim || -Math.PI / 2); g.fillStyle = '#a6e47a'; g.fillRect(0, -3, 12, 6); g.restore();
    g.fillStyle = '#fff'; g.beginPath(); g.arc(s.x - 3, s.y - 12, 2, 0, 7); g.arc(s.x + 3, s.y - 12, 2, 0, 7); g.fill();
    if (s.life < 2 && Math.sin(this.t * 20) > 0) drawGlow(g, s.x, s.y - 10, 16, '#a6e47a', 0.6);
  }
  drawPickup(g, k) {
    if (k.kind === 'lore') return SW.drawLore(g, this, k);
    const bob = k.float ? Math.sin(this.t * 3 + k.x) * 3 : 0;
    if (has('glim') && k.kind === 'glim') { const y = k.y + bob, sc = 1 + Math.sin(this.t * 6 + k.x) * 0.08; g.globalCompositeOperation = 'lighter'; drawGlow(g, k.x, y, 12, PAL.glimmer, 0.7); g.globalCompositeOperation = 'source-over'; spr(g, 'glim', k.x, y + 5 * sc, 10 * sc, 0.5, 1); return; }
    if (has('flask') && k.kind !== 'glim') { const y = k.y + Math.sin(this.t * 3 + k.x) * 2, h = k.big ? 20 : 15; drawGlow(g, k.x, y, 18, '#ff8aa0', 0.55); spr(g, 'flask', k.x, y + h / 2, h, 0.5, 1); return; }
    if (k.kind === 'glim') { drawGlow(g, k.x, k.y + bob, 10, PAL.glimmer, 0.8); g.save(); g.translate(k.x, k.y + bob); g.rotate(this.t * 3 + k.x); g.fillStyle = PAL.glimmer; g.beginPath(); for (let i = 0; i < 8; i++) { const r = i % 2 ? 1.6 : 4.2; g.lineTo(Math.cos(i * Math.PI / 4) * r, Math.sin(i * Math.PI / 4) * r); } g.fill(); g.restore(); }
    else { drawGlow(g, k.x, k.y, 16, '#ff8aa0', 0.6); drawIcon(g, 'heart', k.x, k.y, k.big ? 20 : 14, '#ff6a8a'); }
  }
  drawProps(g) {
    const t = this.t, P = this.player, near = this.interactable(P);
    for (const o of this.props) {
      if (this.offV && this.offV(o.x, o.y, o.w || 0, o.h || 0)) continue;
      if ((o.kind === 'moss' || o.kind === 'friend') && SW.drawStoryProp(g, this, o)) {} else if (this.drawPropPainted(g, o)) {}
      else if (o.kind === 'chest') { g.fillStyle = '#15131f'; g.beginPath(); g.roundRect(o.x - 1, o.y - 1 + (o.open ? 6 : 0), o.w + 2, o.h + 2 - (o.open ? 6 : 0), 4); g.fill(); g.fillStyle = '#9a6a42'; g.fillRect(o.x + 1, o.y + 8, o.w - 2, o.h - 9); g.fillStyle = o.open ? '#5c3a24' : '#b8783a'; g.fillRect(o.x + 1, o.y + 1 + (o.open ? 5 : 0), o.w - 2, 8 - (o.open ? 4 : 0)); g.fillStyle = '#ffd36b'; g.fillRect(o.x + o.w / 2 - 3, o.y + 6, 6, 6); if (!o.open) drawGlow(g, o.x + o.w / 2, o.y + 6, 24, '#ffd36b', 0.3 + Math.sin(t * 3) * 0.1); }
      else if (o.kind === 'fountain') { g.fillStyle = '#15131f'; g.beginPath(); g.roundRect(o.x - 2, o.y + 18, o.w + 4, 24, 6); g.fill(); g.fillStyle = '#6a7488'; g.beginPath(); g.roundRect(o.x, o.y + 20, o.w, 20, 5); g.fill(); g.fillStyle = '#6a7488'; g.fillRect(o.x + 14, o.y + 2, 8, 20); if (!o.open) { g.fillStyle = '#7ff0ff'; g.fillRect(o.x + 4, o.y + 20, o.w - 8, 5); drawGlow(g, o.x + 18, o.y + 14, 34, '#7ff0ff', 0.5); if (Math.random() < 0.2) this.fx.burst(o.x + 18, o.y + 2, 1, { color: '#bff', min: 20, max: 60, g: 300, angle: -Math.PI / 2, spread: 0.6, life: 0.6, size: 2.5 }); } }
      else if (o.kind === 'pedestal') { g.fillStyle = '#15131f'; g.fillRect(o.x - 1, o.y + 14, o.w + 2, 17); g.fillStyle = '#6a7488'; g.fillRect(o.x + 1, o.y + 15, o.w - 2, 15); if (!o.open) { const w = WEAPONS[o.weapon]; drawGlow(g, o.x + 14, o.y + 2 + Math.sin(t * 2) * 3, 26, w.color, 0.6); drawIcon(g, w.icon, o.x + 14, o.y + 2 + Math.sin(t * 2) * 3, 20, w.color); } }
      else if (o.kind === 'door') { const open = this.mode !== 'run' || true; g.fillStyle = '#15131f'; g.beginPath(); g.moveTo(o.x - 4, o.y + o.h); g.lineTo(o.x - 4, o.y + 18); g.quadraticCurveTo(o.x + o.w / 2, o.y - 14, o.x + o.w + 4, o.y + 18); g.lineTo(o.x + o.w + 4, o.y + o.h); g.fill(); g.fillStyle = this.mode === 'run' ? '#ff9a5a' : '#ffe2a8'; g.globalAlpha = 0.65 + Math.sin(t * 3) * 0.2; g.beginPath(); g.moveTo(o.x + 2, o.y + o.h); g.lineTo(o.x + 2, o.y + 20); g.quadraticCurveTo(o.x + o.w / 2, o.y - 6, o.x + o.w - 2, o.y + 20); g.lineTo(o.x + o.w - 2, o.y + o.h); g.fill(); g.globalAlpha = 1; drawGlow(g, o.x + o.w / 2, o.y + o.h * 0.5, 60, this.mode === 'run' ? '#ff8a5a' : '#ffe2a8', 0.5); if (open) drawIcon(g, 'door', o.x + o.w / 2, o.y - 18 + Math.sin(t * 3) * 2, 18, '#fff'); }
      else if (o.kind === 'station') this.drawStation(g, o);
      if (near === o && P.onGround) { const bx = o.x + o.w / 2, by = o.y - 30 + Math.sin(t * 5) * 2; g.fillStyle = 'rgba(20,18,32,0.85)'; g.strokeStyle = '#ffe27a'; g.lineWidth = 2; g.beginPath(); g.arc(bx, by, 13, 0, 7); g.fill(); g.stroke(); drawIcon(g, 'attack', bx, by, 16, '#ffe27a'); }
    }
    for (const [x, y] of this.gates || []) { const X = x * TILE, Y = y * TILE; g.fillStyle = '#15131f'; g.fillRect(X + 2, Y, TILE - 4, TILE); g.fillStyle = '#ff5a7a'; g.fillRect(X + 6, Y, 4, TILE); g.fillRect(X + 14, Y, 4, TILE); drawGlow(g, X + 12, Y + 12, 20, '#ff5a7a', 0.4); }
    for (const l of this.lights) { if (!l.lantern) continue; if (has('lantern')) { g.strokeStyle = '#2a2018'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(l.x, l.y - 26); g.lineTo(l.x, l.y - 8); g.stroke(); spr(g, 'lantern', l.x, l.y + 12, 22, 0.5, 1); g.globalCompositeOperation = 'lighter'; drawGlow(g, l.x, l.y + 3, 16, '#ffb13b', 0.5 + Math.sin(t * 7 + l.x) * 0.08); g.globalCompositeOperation = 'source-over'; continue; } g.strokeStyle = '#3a3040'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(l.x, l.y - 24); g.lineTo(l.x, l.y - 4); g.stroke(); g.fillStyle = '#15131f'; g.beginPath(); g.roundRect(l.x - 6, l.y - 6, 12, 15, 3); g.fill(); g.fillStyle = this.biome.light; g.fillRect(l.x - 4, l.y - 3, 8, 9); drawGlow(g, l.x, l.y + 2, 30, this.biome.light, 0.7); }
  }
  drawPropPainted(g, o) {
    const n = o.kind === 'shrine' ? 'crystal' : o.kind; if (!has(n)) return false;
    const t = this.t, X = o.x + o.w / 2, Y = o.y + o.h, ink = (nm, x, y, h) => { for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) spr(g, nm, x + dx, y + dy, h, 0.5, 1, false, tinted(nm, '#15131f')); spr(g, nm, x, y, h, 0.5, 1); };
    if (o.kind === 'chest') { ink('chest', X, Y + 1, 27); if (o.open) { g.globalAlpha = 0.55; spr(g, 'chest', X, Y + 1, 27, 0.5, 1, false, tinted('chest', '#0c0a14')); g.globalAlpha = 1; } else drawGlow(g, X, Y - 10, 26, '#ffd36b', 0.25 + Math.sin(t * 3) * 0.08); }
    else if (o.kind === 'fountain') { ink('fountain', X, Y + 2, 54); if (!o.open) { g.globalCompositeOperation = 'lighter'; drawGlow(g, X, Y - 26, 30, '#5ff2d8', 0.45 + Math.sin(t * 2.5) * 0.1); g.globalCompositeOperation = 'source-over'; } }
    else if (o.kind === 'door') { drawGlow(g, X, Y - 30, 40, '#ffb13b', 0.35); ink('door', X, Y + 1, 66); }
    else if (o.kind === 'shrine') { const lit = o.lit; g.globalCompositeOperation = 'lighter'; drawGlow(g, X, Y - 26, lit ? 54 : 30, lit ? '#8ff4ff' : '#6a8a9a', lit ? 0.6 + Math.sin(t * 2.5) * 0.12 : 0.25); g.globalCompositeOperation = 'source-over'; ink('crystal', X, Y + 1, 46 + (lit ? Math.sin(t * 2) * 1.5 : 0)); if (lit && Math.random() < 0.15) this.fx.burst(X, Y - 30, 1, { color: '#bffcff', g: -40, min: 5, max: 30, life: 1.2, size: 2, glow: 1 }); }
    else if (o.kind === 'pedestal') { ink('pedestal', X, Y + 1, 30); if (!o.open) { const w = WEAPONS[o.weapon], y = o.y - 8 + Math.sin(t * 2) * 3; drawGlow(g, X, y, 30, w.color, 0.7); g.save(); g.translate(X, y); g.rotate(-0.7); spr(g, 'w_' + o.weapon, 0, 0, 10, 0.5, 0.5); g.restore(); } }
    else if (o.kind === 'station' && o.n === 4 && drawBoard(g, this, o)) {}
    else if (o.kind === 'station') { const icon = o.n === 1 ? 'gear' : o.n === 2 ? 'blade' : 'heart'; const col = o.n === 1 ? '#ffd36b' : o.n === 2 ? '#bfe8ff' : '#ff9ab0'; ink('station', X, Y + 1, 40);
      const y = Y - 54 + Math.sin(t * 2 + o.n) * 3; drawGlow(g, X, y, 28, col, 0.6); g.fillStyle = 'rgba(20,18,32,0.8)'; g.beginPath(); g.arc(X, y, 13, 0, 7); g.fill(); g.strokeStyle = col; g.lineWidth = 1.5; g.stroke(); drawIcon(g, icon, X, y, 17, col); }
    else return false;
    return true;
  }
  drawStation(g, o) {
    const t = this.t, X = o.x + o.w / 2, Y = o.y + o.h; const icon = o.n === 1 ? 'gear' : o.n === 2 ? 'blade' : 'heart'; const col = o.n === 1 ? '#ffd36b' : o.n === 2 ? '#bfe8ff' : '#ff9ab0';
    g.fillStyle = '#15131f'; g.beginPath(); g.roundRect(X - 22, Y - 22, 44, 22, 6); g.fill(); g.fillStyle = '#5c3a24'; g.beginPath(); g.roundRect(X - 20, Y - 20, 40, 18, 5); g.fill();
    g.fillStyle = '#2e8a4a'; for (let i = -1; i <= 1; i++) { g.beginPath(); g.ellipse(X + i * 12, Y - 26, 7, 10, i * 0.4, 0, 7); g.fill(); }
    drawGlow(g, X, Y - 44 + Math.sin(t * 2 + o.n) * 3, 28, col, 0.6); g.fillStyle = 'rgba(20,18,32,0.8)'; g.beginPath(); g.arc(X, Y - 44 + Math.sin(t * 2 + o.n) * 3, 14, 0, 7); g.fill(); drawIcon(g, icon, X, Y - 44 + Math.sin(t * 2 + o.n) * 3, 18, col);
  }
  drawBloom(g) { // victory: flowers bloom over the arena
    this.bloomT += 1 / 60; const k = Math.min(1, this.bloomT / 2); const R = this.fullRoom, fy = R.y + R.h - 2 * TILE;
    for (let i = 0; i < 40; i++) { const x = R.x + (i + 0.5) * R.w / 40, h = (8 + (i * 7) % 14) * k; g.strokeStyle = '#2e8a4a'; g.lineWidth = 2; g.beginPath(); g.moveTo(x, fy); g.lineTo(x, fy - h); g.stroke(); g.fillStyle = ['#ffd0f0', '#fff2a8', '#bff2ff'][i % 3]; g.beginPath(); g.arc(x, fy - h, 3.5 * k, 0, 7); g.fill(); }
  }
}
