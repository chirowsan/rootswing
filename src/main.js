// Boot, game flow and the fixed-step loop.
import * as POL from './polish23.js';
import { graph as _ag } from './audio.js';
import { save, loadSave, writeSave, softSave, diff } from './save.js';
import { initAudio, sfx, playSong, applyVolumes, director, stinger, audio, initAudio as _ia } from './audio.js';
import { input, initInput, pollInput, endStep, pressed, held, computeLayout, drawTouch, clearAll, simButton, simAxes } from './input.js';
import { World, VIEW_H, playerStats } from './world.js';
import { Tutorial } from './tutorial.js';
import { drawHUD, drawMap, mapInfo } from './hud.js';
import { GADGETS, WEAPONS } from './weapons.js';
import * as UI from './ui.js';
import { TILE } from './util.js';
import { scoreRun } from './objective.js';
import { trapPhase, TRAP_TIMING, TRAP_DMG } from './traps.js';
import { loadGfx, G } from './gfx.js';
import { drawGlow } from './art.js';
import { Enemy } from './enemies.js';
import { migrateSave, missions, dayKey, dailySeed, dailyMod, dailyScore, recordDaily, DAILY_MODS } from './missions.js';
import { mEvent, drawMissionHUD, toast } from './missionsWorld.js';
import { Warden, TideGolem, Boss, DrownedBloom } from './boss.js';
import * as BR from './brawl.js';
import * as GA from './gauntlet.js';
import * as T20 from './traps20.js';
import { DIFF, ASSIST } from './save.js';
import * as MS from './missions.js';
import * as ST from './story.js';
import * as SU from './storyui.js';
import * as SW from './storyWorld.js';
import * as SP from './surprise.js';
import * as AI22 from './ai22.js';
import { planSurprises } from './surprisePlan.js';
import { showLayoutEditor, moveButton } from './layoutEdit.js';
import { FEEL } from './player.js';
const STEP = 1 / 60;
const canvas = document.getElementById('c'); const g = canvas.getContext('2d', { alpha: false });
const game = {
  state: 'title', chapter: 0, ngRun: 0, world: null, tut: null, bossShown: null, paused: false, dpr: 1, cssW: 0, cssH: 0, perf: { frames: 0, slow: 0, ms: [] }, runStart: 0, god: false,
  bossBar(e) { if (e && e !== this.bossShown) POL.introCard(this.world, e); this.bossShown = e; },
  saveRunState(W, cellIndex) { save.run = { seed: W.seed, stage: W.stage || 0, cellIndex, hp: W.player.hp, flasks: W.player.flasks, weapon: W.player.weapon, glim: W.runGlim, cleared: [...W.cleared], visited: [...W.visited], opened: [...W.opened], seeds: [...(W.seedsGot || [])], treasures: this.treasures || 0, boss: false, kills: W.player.stats.kills, t: this.runTime(), daily: this.daily || null, af: !!this.areaFlask, ch: W.chapter || 0, ng: this.ngRun || 0, sp: SP.persist(W) }; this.runStart = performance.now(); writeSave(); },
  runTime() { return (save.run && save.run.t || 0) + (performance.now() - this.runStart) / 1000; },
  openStation(n) { this.paused = true; clearAll(); if (n === 1) UI.showShop(); else if (n === 2) UI.showLoadout(); else if (n === 4) UI.showBoard(); else UI.showJournal(); UI.ui.back = 'game'; },
  useDoor(W) {
    if (W.mode === 'tutorial') { save.progress.tutorialDone = true; writeSave(); this.go('hub'); }
    else if (W.mode === 'hub') { this.paused = true; clearAll(); SU.showMap({ go: (n) => this.startChapter(n), free: () => this.startFree(), back: () => { this.paused = false; clearAll(); } }); } // v2.1: the door opens the chapter map
    else if (W.mode === 'run') { const P = W.player; save.run = { seed: W.seed, stage: W.stage || 0, hp: P.hp, flasks: P.flasks, weapon: P.weapon, glim: W.runGlim, boss: true, kills: P.stats.kills, rooms: W.visited.size, treasures: this.treasures || 0, t: this.runTime(), daily: this.daily || null, af: !!this.areaFlask, ch: W.chapter || 0, ng: this.ngRun || 0, sp: SP.persist(W) }; this.runStart = performance.now(); save.progress.bossSeen = true; writeSave(); this.go('boss', { seed: W.seed, stage: W.stage || 0, chapter: W.chapter || 0, player: { hp: P.hp, flasks: P.flasks, weapon: P.weapon }, glim: W.runGlim, kills: P.stats.kills }); }
  },
  onDeath(W, info) {
    if (this.world !== W) return;
    const run = W.mode === 'run' || W.mode === 'boss', note = run ? SP.noteDeath(W) : null, R = W.sp && W.sp.run;
    if (note === 'assistOn' && R && R.cont < 99) R.cont += ASSIST.cont; // Assist switching on gives 2 more tries
    if (run && R && save.run && !this.daily && R.cont > 0) { // v2.2 continues: a few tries per chapter, from the last checkpoint
      const nr = SP.persist(W); if (nr.cont < 99) nr.cont--; nr.deaths++; nr.contUsed++; save.run.sp = nr; save.run.hp = Math.max(save.run.hp || 0, Math.round(W.player.maxHp * 0.6)); writeSave();
      this.paused = true; UI.showDeath(info, 0, W.runGlim, { next: null, rooms: W.visited.size, kills: W.player.stats.kills, cont: nr.cont, assistOn: note === 'assistOn' }); return; }
    const found = W.runGlim, kept = W.mode === 'run' || W.mode === 'boss' ? Math.round(found * diff().keep * (diff().reward || 1)) : 0;
    save.progress.glimmers += kept; save.progress.totalGlimmers += kept; save.progress.bestDepth = Math.max(save.progress.bestDepth, W.visited.size); save.run = null; writeSave();
    const dly = this.finishDaily(W, false);
    this.paused = true; UI.showDeath(info, kept, found, { outOfTries: !!(R && R.cont === 0 && run), assistOn: note === 'assistOn', next: ST.nextGoal(W.chapter || 0), rooms: (save.lastRooms || 0) + W.visited.size, kills: W.player.stats.kills, daily: dly });
  },
  onVictory(W) {
    if (this.world !== W) return;
    if (W.mode === 'boss' && W.chapter) { this.chapterVictory(W); return; }
    if (W.mode === 'boss' && !W.stage) { // v1.3: the Furnace opens the way down into biome 2; checkpoint between biomes
      mEvent(W, 'areaDone', { flaskFree: !this.areaFlask }); this.areaFlask = false; // v1.8: each biome is an 'area' for the no-potion mission
      const P = W.player; save.progress.bossBeaten++; const t = this.runTime(); save.run = null; this.runStart = performance.now(); this.carryRooms = W.visited.size;
      this.go('run', { seed: W.seed, stage: 1, player: { hp: P.maxHp, flasks: P.maxFlasks, weapon: P.weapon }, glim: W.runGlim, kills: P.stats.kills }); save.run.t = t; writeSave(); this.world.fx.text(this.world.player.cx, this.world.player.y - 40, 'Biome 2: Drowned Glowroots', '#bffcff', 18); return;
    }
    mEvent(W, 'areaDone', { flaskFree: !this.areaFlask }); const dly = this.finishDaily(W, true);
    const glim = W.runGlim; save.progress.glimmers += glim; save.progress.totalGlimmers += glim; save.progress.wins++; save.progress.bossBeaten++; save.run = null; writeSave();
    const t = Math.round(this.runTime()), fmt = (t) => Math.floor(t / 60) + 'm ' + String(t % 60).padStart(2, '0') + 's', sc = scoreRun(t, this.treasures || 0); this.lastScore = sc;
    this.paused = true; UI.showVictory(glim, { final: (W.stage || 0) >= 1, kills: W.player.stats.kills, time: fmt(t), stars: sc.stars, bonus: sc.bonus, diffLabel: sc.diffLabel, best: sc.best, bestTime: fmt(sc.bestTime), newVine: sc.newVine, treasures: this.treasures || 0, daily: dly });
  },
  // v1.8 daily challenge: one seeded run per real day + a cosmetic/damage-only modifier; local best kept per day
  startDaily() { const key = dayKey(), mod = dailyMod(key); this.chapter = 0; this.spRun = null; this.ngRun = 0; this.daily = { key, seed: dailySeed(key), mod }; this.areaFlask = false; this.carryRooms = 0; this.treasures = 0; save.progress.runs++; save.run = null; writeSave(); this.runStart = performance.now(); this.go('run', { seed: this.daily.seed }); },
  finishDaily(W, win) {
    const d = this.daily; if (!d) return null; this.daily = null;
    const score = dailyScore({ glim: W.runGlim, kills: W.player.stats.kills, rooms: (this.carryRooms || 0) + W.visited.size, critters: [...W.opened].filter((o) => o.startsWith('cr')).length, win });
    const best = recordDaily(d.key, score); mEvent(W, 'dailyDone'); return { score, best: missions().daily.best, newBest: best, mod: d.mod };
  },
  go(mode, opts = {}) {
    UI.close(); this.paused = false; this.bossShown = null; clearAll(); this.state = 'play';
    if (mode === 'run' || mode === 'boss') { const ch = opts.chapter ?? this.chapter ?? 0; this.chapter = ch; opts = { ...opts, chapter: ch }; if (ch && opts.stage === undefined) opts.stage = ST.CHAPTERS[ch].stage; ST.setRunMod(ch, this.ngRun); } else ST.setRunMod(0, 0); // v2.1 chapter extras (run-only)
    const W = new World(this, mode, opts); W.god = this.god; this.world = W; W.viewW = this.cssW && this.cssH ? W.viewH * this.cssW / this.cssH : 760; W.snapCamera();
    if (opts.kills) W.player.stats.kills = opts.kills;
    for (const b of ['attack', 'dash', 'hook', 'parry', 'skill1', 'skill2', 'flask']) input.visible[b] = true;
    input.visible.skill2 = W.player.gadgets.length > 1; input.highlight = {};
    this.tut = mode === 'tutorial' ? new Tutorial(W) : null;
    if (mode === 'run' || mode === 'boss') { if (!save.run) this.saveRunState(W, 0); }
    else { this.chapter = 0; this.ngRun = 0; }
    this.relayout();
  },
  // ---------------- v2.1 story campaign ----------------
  giveUp() { const W = this.world; if (!W) { this.go('hub'); return; } const kept = Math.round(W.runGlim * diff().keep * (diff().reward || 1)); save.progress.glimmers += kept; save.progress.totalGlimmers += kept; save.run = null; this.spRun = null; writeSave(); this.go('hub'); },
  beginRun(ch) { this.spRun = null; this.daily = null; this.areaFlask = false; this.treasures = 0; this.carryRooms = 0; save.progress.runs++; save.run = null; writeSave(); this.runStart = performance.now(); this.chapter = ch; this.ngRun = ch && ST.camp().ngOn ? Math.max(1, ST.camp().ng) : 0; },
  startChapter(n) { if (!ST.isUnlocked(n)) return; this.paused = true; clearAll(); SU.playComic('ch' + n + 'start', ST.chapterStart(n), () => { this.beginRun(n); this.go('run', { chapter: n }); }); },
  startFree() { this.beginRun(0); this.go('run', { chapter: 0 }); },
  storyBeat(W) { if (this.world !== W || !W.chapter) return; this.paused = true; clearAll(); SU.playComic('warden' + W.chapter, ST.wardenBeat(W.chapter), () => { this.paused = false; clearAll(); }); },
  openMoss() { this.paused = true; clearAll(); SU.showMoss({ map: () => this.useDoor(this.world), story: () => SU.playComic('intro', ST.INTRO, () => { this.paused = false; clearAll(); }, { auto: 6000 }), back: () => { this.paused = false; clearAll(); } }); },
  chapterVictory(W) {
    const ch = W.chapter; mEvent(W, 'areaDone', { flaskFree: !this.areaFlask });
    const glim = W.runGlim; save.progress.glimmers += glim; save.progress.totalGlimmers += glim; save.progress.wins++; save.progress.bossBeaten++; save.run = null;
    const ms = SP.chapterWin(W); this.spRun = null; const r = ST.completeChapter(ch); const c = ST.camp(); if (this.ngRun) c.best['ng' + ch] = true; writeSave();
    const t = Math.round(this.runTime()), fmt = (t) => Math.floor(t / 60) + 'm ' + String(t % 60).padStart(2, '0') + 's', sc = scoreRun(t, this.treasures || 0); this.lastScore = sc;
    const show = () => { this.paused = true; UI.showVictory(glim, { title: ch === ST.CH_N ? 'The forest is healed!' : 'Chapter ' + ch + ' clear!', final: ch === ST.CH_N, next: ST.nextGoal(ch), nextCh: ch < ST.CH_N ? ch + 1 : 0, kills: W.player.stats.kills, time: fmt(t), stars: sc.stars, bonus: sc.bonus, diffLabel: sc.diffLabel, best: sc.best, bestTime: fmt(sc.bestTime), newVine: sc.newVine, treasures: this.treasures || 0, extra: SP.masteryHtml(ms) }); };
    this.paused = true; clearAll(); const end = ST.chapterEnd(ch, ST.rootK());
    SU.playComic('ch' + ch + 'end', ch === ST.CH_N ? ST.FINALE.concat(end.slice(1, 2)) : end, show);
    this.lastChapter = { ch, ...r };
  },
  relayout() { if (typeof innerWidth === 'number' && game.cssW && (innerWidth !== game.cssW || innerHeight !== game.cssH)) return resize(); /* v2.3: a late resize event never leaves stale button spots */ input.layout = computeLayout(game.cssW, game.cssH); input.layout && (input.visible.skill2 = !game.world || game.world.player.gadgets.length > 1); },
  pause() { if (this.state !== 'play' || this.paused || !this.world) return; this.paused = true; clearAll(); sfx('uiBack'); UI.showPause(this.world.mode); },
  drawPauseMap() { const W = this.world, cv = document.getElementById('pmap'); if (!cv || !W || W.mode !== 'run') return; const g = cv.getContext('2d'); g.clearRect(0, 0, cv.width, cv.height); const cs = Math.floor(Math.min(cv.width / W.gw, cv.height / W.gh * 1.7)), chh = Math.floor(cs / 1.7); drawMap(g, W, (cv.width - cs * W.gw) / 2, (cv.height - chh * W.gh) / 2, cs, chh, true); if (this.paused && UI.ui.open === 'pause') requestAnimationFrame(() => this.drawPauseMap()); },
};
UI.initUI({
  play() { initAudio(); const c = ST.camp(); const go = () => { if (!save.progress.tutorialDone) game.go('tutorial'); else game.go('hub'); }; if (!c.intro) { c.intro = true; writeSave(); SU.playComic('intro', ST.INTRO, go, { auto: 6000 }); } else go(); },
  playChapter(v) { game.startChapter(+v); },
  editLayout() { showLayoutEditor(() => UI.showSettings(UI.ui.back)); },
  continueRun() { initAudio(); const r = save.run; if (!r) return; game.spRun = null; /* v2.2: the saved run carries its own boons/tries */ game.daily = r.daily ? { ...r.daily, mod: DAILY_MODS.find((m) => m.id === r.daily.mod.id) || r.daily.mod } : null; game.areaFlask = !!r.af; game.chapter = r.ch || 0; game.ngRun = r.ng || 0; game.runStart = performance.now(); game.treasures = r.treasures || 0; if (r.boss) game.go('boss', { seed: r.seed, stage: r.stage || 0, chapter: r.ch || 0, player: { hp: r.hp, flasks: r.flasks, weapon: r.weapon }, glim: r.glim, kills: r.kills }); else game.go('run', { seed: r.seed, stage: r.stage || 0, chapter: r.ch || 0, cellIndex: r.cellIndex, player: { hp: r.hp, flasks: r.flasks, weapon: r.weapon }, glim: r.glim, cleared: r.cleared, visited: r.visited, opened: r.opened, seeds: r.seeds, kills: r.kills }); },
  resume() { UI.close(); game.paused = false; clearAll(); },
  toHub() { game.go('hub'); }, giveUp() { game.giveUp(); }, startDaily() { initAudio(); game.startDaily(); }, toTitle() { game.state = 'title'; game.world = null; UI.showTitle(); playSong('hub'); },
  leaveRun() { const W = game.world; game.onDeath(W, { name: 'giving up', tip: 'No worries! Your kept glimmers are safe in the Seedhouse.' }); },
  skipTutorial() { save.progress.tutorialDone = true; writeSave(); game.go('hub'); },
  replayTutorial() { game.go('tutorial'); },
  relayout() { game.relayout(); }, statsChanged() { const W = game.world; if (W && W.mode === 'hub') { const s = playerStats(); Object.assign(W.player, { maxHp: s.maxHp, hp: s.maxHp, maxFlasks: s.maxFlasks, flasks: s.maxFlasks, weapon: s.weapon, gadgets: s.gadgets, hookRange: s.hookRange }); input.visible.skill2 = s.gadgets.length > 1; } },
});
function resize() {
  const q = save.settings.quality; const coarse = matchMedia && matchMedia('(pointer: coarse)').matches; const cap = q === 'high' ? 2.5 : q === 'low' ? 1 : q === 'med' ? 1.5 : [coarse ? 1.5 : 2, 1.25, 1][game.resLevel || 0]; // v1.4: phones cap at 1.5x; auto steps the resolution down when frames run long
  game.dpr = Math.min(devicePixelRatio || 1, cap); game.cssW = innerWidth; game.cssH = innerHeight;
  canvas.width = Math.round(game.cssW * game.dpr); canvas.height = Math.round(game.cssH * game.dpr); canvas.style.width = game.cssW + 'px'; canvas.style.height = game.cssH + 'px';
  game.relayout(); UI.showRotate(game.cssH > game.cssW * 1.05);
}
addEventListener('resize', resize); addEventListener('orientationchange', () => setTimeout(resize, 200));
document.addEventListener('visibilitychange', () => { const A = audio.ctx; if (document.hidden) { game.pause(); softSave(); if (A && A.state === 'running') A.suspend().catch(() => {}); } else { last = performance.now(); acc = 0; if (A && A.state === 'suspended') A.resume().catch(() => {}); } }); /* v2.3: audio sleeps in the background (battery) */
addEventListener('blur', () => { if (game.state === 'play' && game.world && !game.paused && !UI.isOpen()) game.pause(); }); addEventListener('pagehide', () => softSave());
let last = performance.now(), acc = 0, titleT = 0, menuCd = 0;
function frame(now) {
  requestAnimationFrame(frame);
  if (!game.tracing) tick(now);
}
function tick(now) {
  let real = Math.min(0.1, (now - last) / 1000); last = now; perfTrack(real);
  pollInput();
  const W = game.world;
  if (UI.isOpen()) { menuInput(real); endStep(); }
  else if (game.manual) { /* tests drive the simulation with __RS.step */ }
  else if (W && game.state === 'play' && !game.paused) {
    if (pressed('pause')) { game.pause(); endStep(); }
    else {
      acc += real * save.settings.speed; let n = 0;
      while (acc >= STEP && n < 4) { const r = W.update(STEP); game.tut && game.tut.update(STEP); if (game.god) { W.player.hp = W.player.maxHp; } if (r !== 'hs') endStep(); acc -= STEP; n++; }
      if (n === 4) acc = 0;
    }
  } else endStep();
  director(game, real, UI.ui.open); playClock(real);
  render(real, W && game.state === 'play' && !game.paused && !game.manual && !UI.isOpen() ? acc / STEP : 1);
}
function menuInput(dt) {
  menuCd -= dt; const y = input.my, x = input.mx;
  if (menuCd <= 0 && (y || x)) { UI.menuNav(y > 0 || x > 0 ? 1 : -1); menuCd = 0.22; } if (!y && !x) menuCd = 0;
  if (pressed('confirm') || pressed('jump')) UI.menuNav(0, true); else if (pressed('pause') || pressed('dash')) UI.menuNav(0, false, true);
}
function render(dt, alpha = 1) {
  const W = game.world, cw = canvas.width, ch = canvas.height;
  if (!W) { titleScene(dt); return; }
  const rs = ch / (W.viewH || VIEW_H); const lerpS = W.lerpBegin ? W.lerpBegin(alpha) : null; W.draw(g, cw, ch, rs); W.lerpEnd && W.lerpEnd(lerpS);
  if (game.tut) { if (W.wt) g.setTransform(W.wt[0], 0, 0, W.wt[0], W.wt[1], W.wt[2]); else g.setTransform(rs, 0, 0, rs, -W.camx * rs, -W.camy * rs); game.tut.drawWorld(g); }
  const s = game.dpr * Math.max(0.8, Math.min(1.25, game.cssH / 412));
  g.setTransform(1, 0, 0, 1, 0, 0); if (W.daily && W.daily.mod.tint) { g.fillStyle = W.daily.mod.tint; g.fillRect(0, 0, cw, ch); } SW.drawScreen(g, W, cw, ch, s); SP.drawScreen(g, W, cw, ch, s); drawHUD(g, W, cw, ch, s); drawMissionHUD(g, W, cw, ch, s);
  g.setTransform(game.dpr, 0, 0, game.dpr, 0, 0);
  if (!UI.isOpen()) { const P = W.player; drawTouch(g, W.t, P.gadgets.map((k) => GADGETS[k].icon), { skill1: P.gcd[0] / GADGETS[P.gadgets[0]].cd, skill2: P.gadgets[1] ? P.gcd[1] / GADGETS[P.gadgets[1]].cd : 0, dash: P.dashCd > 0 ? P.dashCd / 0.38 : 0 }, P.flasks); game.tut && game.tut.drawScreen(g); }
}
let titleWorld = null;
let titleMotes = null;
let tGrad = null, tPar = { x: 0, y: 0, tx: 0, ty: 0 }; /* v2.3: cached title gradients + pointer/tilt parallax */
addEventListener('pointermove', (e) => { tPar.tx = (e.clientX / innerWidth - 0.5) * 2; tPar.ty = (e.clientY / innerHeight - 0.5) * 2; }, { passive: true });
addEventListener('deviceorientation', (e) => { if (e.gamma == null) return; tPar.tx = Math.max(-1, Math.min(1, e.beta / 25)); tPar.ty = Math.max(-1, Math.min(1, (e.gamma + 40) / 30 - 1)); }, { passive: true });
function frond(g, x, y, len, ang, w, col) { g.save(); g.translate(x, y); g.rotate(ang); g.fillStyle = col; g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(len * 0.5, -w, len, 0); g.quadraticCurveTo(len * 0.5, w * 0.6, 0, 0); g.fill();
  for (let i = 1; i < 7; i++) { const t = i / 7, px = len * t, s = (1 - t) * w * 1.6; g.beginPath(); g.moveTo(px, -w * 0.3 * (1 - t)); g.quadraticCurveTo(px + s * 0.5, -s, px + s * 0.9, -s * 1.1); g.quadraticCurveTo(px + s * 0.3, -s * 0.3, px, 0); g.fill(); g.beginPath(); g.moveTo(px, 0); g.quadraticCurveTo(px + s * 0.5, s * 0.9, px + s, s); g.quadraticCurveTo(px + s * 0.3, s * 0.2, px, 0); g.fill(); }
  g.restore(); }
function paintedTitle(dt) { // v1.1 painted key art; v2.3 adds parallax layers, foreground fronds, cached gradients
  const img = G.img.title_key, cw = canvas.width, ch = canvas.height, lo = game.lowPerf || save.settings.quality === 'low', calm = save.settings.shake === 'off' || save.settings.flash === 'reduced';
  const tt = (game.titleT = (game.titleT || 0) + dt), k = Math.min(1, dt * 3); if (lo || calm) { tPar.x = tPar.y = 0; } else { tPar.x += (tPar.tx + Math.sin(tt * 0.21) * 0.25 - tPar.x) * k; tPar.y += (tPar.ty * 0.6 - tPar.y) * k; }
  const z = 1.08 + (lo ? 0 : Math.sin(tt * 0.07) * 0.02), sc = Math.max(cw / img.width, ch / img.height) * z;
  const w = img.width * sc, h = img.height * sc, x = (cw - w) / 2 + (lo ? 0 : Math.sin(tt * 0.05) * cw * 0.008) - cw * 0.03 - tPar.x * cw * 0.012, y = (ch - h) / 2 + (lo ? 0 : Math.cos(tt * 0.06) * ch * 0.005) - tPar.y * ch * 0.01;
  g.setTransform(1, 0, 0, 1, 0, 0); g.drawImage(img, x, y, w, h);
  if (!tGrad || tGrad.cw !== cw || tGrad.ch !== ch) { const lg = g.createLinearGradient(0, 0, cw * 0.62, 0); lg.addColorStop(0, 'rgba(8,10,22,0.78)'); lg.addColorStop(0.55, 'rgba(8,10,22,0.35)'); lg.addColorStop(1, 'rgba(8,10,22,0)');
    const vg = g.createRadialGradient(cw / 2, ch / 2, ch * 0.4, cw / 2, ch / 2, Math.max(cw, ch) * 0.75); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(6,4,14,0.55)'); tGrad = { cw, ch, lg, vg }; }
  g.fillStyle = tGrad.lg; g.fillRect(0, 0, cw, ch); g.fillStyle = tGrad.vg; g.fillRect(0, 0, cw, ch);
  if (lo) return;
  g.globalCompositeOperation = 'lighter'; drawGlow(g, x + w * 0.28, y + h * 0.6, ch * 0.35, '#ffc070', 0.22 + Math.sin(tt * 0.8) * 0.04);
  if (!titleMotes) titleMotes = Array.from({ length: 60 }, () => ({ x: Math.random(), y: Math.random(), s: 0.6 + Math.random() * 1.6, v: 0.01 + Math.random() * 0.03, p: Math.random() * 7, c: Math.random() < 0.3 ? '#7ff6e0' : '#ffe9a8' }));
  for (const m of titleMotes) { m.y -= m.v * dt; m.x += Math.sin(tt * 0.6 + m.p) * 0.0006; if (m.y < -0.02) { m.y = 1.02; m.x = Math.random(); }
    const d = m.s / 2.2, a = 0.35 + Math.sin(tt * 2 + m.p) * 0.3, r = m.s * ch / 412, mx = m.x * cw - tPar.x * cw * 0.03 * d, my = m.y * ch - tPar.y * ch * 0.02 * d; g.globalAlpha = Math.max(0, a); drawGlow(g, mx, my, r * 5, m.c, 0.6); g.fillStyle = m.c; g.fillRect(mx - r / 2, my - r / 2, r, r); }
  g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
  const u = ch / 412, fx = -tPar.x * cw * 0.035, fy = -tPar.y * ch * 0.025, sw = Math.sin(tt * 0.9) * 0.04; /* near layer: dark fronds framing the corners */
  frond(g, -20 * u + fx, ch + 10 * u + fy, 210 * u, -0.75 + sw, 26 * u, 'rgba(6,14,10,0.92)'); frond(g, 30 * u + fx, ch + 20 * u + fy, 160 * u, -1.15 + sw * 0.7, 20 * u, 'rgba(10,22,16,0.85)');
  frond(g, cw + 20 * u + fx, ch + 14 * u + fy, 230 * u, -2.35 - sw, 28 * u, 'rgba(6,14,10,0.92)'); frond(g, cw + 10 * u + fx * 1.2, -10 * u + fy, 150 * u, 2.5 + sw * 0.6, 20 * u, 'rgba(8,16,12,0.8)');
}
const TIPS = ['Hold the hook button to swing, let go at the top to fly!', 'A glowing foe is about to attack: jump, dash or parry.', 'Parry spit right back at the thrower!', 'Shields block hits. Try a heavy hit or hit from behind.', 'Shrines and merchants hide in every chapter.', 'Cracked walls hide secrets. Smash them!', 'Lost? Follow the green arrow to the exit.', 'Take a break any time: the game saves for you.'];
let tipI = Math.floor(Math.random() * TIPS.length), tipT = 0, tFade = 0;
function loadingBar(dt) { /* v2.3: kind loading bar + rotating tip while the painted art streams in */
  const cw = canvas.width, ch = canvas.height, u = ch / 412; tipT += dt; if (tipT > 4) { tipT = 0; tipI = (tipI + 1) % TIPS.length; }
  const w = Math.min(cw * 0.5, 320 * u), x = cw - w - 24 * u, y = 52 * u; g.setTransform(1, 0, 0, 1, 0, 0);
  g.fillStyle = 'rgba(8,6,16,0.55)'; g.beginPath(); g.roundRect(x - 12 * u, y - 34 * u, w + 24 * u, 52 * u, 12 * u); g.fill();
  g.fillStyle = 'rgba(255,255,255,0.15)'; g.beginPath(); g.roundRect(x, y, w, 6 * u, 3 * u); g.fill(); g.fillStyle = '#b7f06a'; g.beginPath(); g.roundRect(x, y, Math.max(6 * u, w * (G.prog || 0)), 6 * u, 3 * u); g.fill();
  g.fillStyle = '#fff4dc'; g.font = `700 ${12 * u}px system-ui,sans-serif`; g.textAlign = 'left'; g.globalAlpha = Math.min(1, tipT * 3, (4 - tipT) * 3); g.fillText(TIPS[tipI], x, y - 12 * u, w); g.globalAlpha = 1; }
function titleScene(dt) { // the title screen shows a live, idle hub behind the menu
  if (G.ready && G.img.title_key) { paintedTitle(dt); if (tFade < 1) { tFade = Math.min(1, tFade + dt * 1.6); g.fillStyle = `rgba(8,6,16,${1 - tFade})`; g.fillRect(0, 0, canvas.width, canvas.height); } return; }
  titleSceneHub(dt); if (!G.ready) loadingBar(dt);
}
function titleSceneHub(dt) {
  if (!titleWorld) { titleWorld = new World(game, 'hub', {}); titleWorld.countdown = 0; titleWorld.fade = 0; }
  titleWorld.viewW = VIEW_H * game.cssW / game.cssH; titleWorld.t += dt; titleWorld.fx.update(dt); titleWorld.player.t += dt;
  titleWorld.cam.x = titleWorld.player.cx - titleWorld.viewW / 2 + Math.sin(titleWorld.t * 0.1) * 80; titleWorld.cam.y = titleWorld.player.cy - VIEW_H * 0.66;
  if (Math.random() < dt * 8) titleWorld.fx.burst(titleWorld.cam.x + Math.random() * titleWorld.viewW, titleWorld.cam.y + VIEW_H, 1, { color: '#e8ffb0', min: 10, max: 30, g: -20, drag: 0, life: 6, size: 2.2, angle: -Math.PI / 2, spread: 0.5, glow: 1 });
  titleWorld.draw(g, canvas.width, canvas.height, canvas.height / VIEW_H);
}
if ((navigator.hardwareConcurrency || 8) <= 4 && (navigator.deviceMemory || 8) <= 3) game.resLevel = 1; /* v2.3: modest phones start one auto step down */
function playClock(dt) { /* v2.3 grown-ups: play time today/total + optional break reminder */
  if (game.state !== 'play' || game.paused || !game.world || UI.isOpen() || !(dt > 0) || dt > 0.5) return; const P = save.progress, day = new Date().toDateString();
  if (!P.playDay || P.playDay.d !== day) P.playDay = { d: day, secs: 0 }; P.playDay.secs += dt; P.playSecs = (P.playSecs || 0) + dt; game.sess = (game.sess || 0) + dt;
  const bm = +save.settings.breakMin || 0; if (bm > 0 && game.sess > bm * 60) { game.sess = 0; game.pause(); const c = document.querySelector('#ui .card'); c && c.insertAdjacentHTML('afterbegin', '<div class="breaknote">Great playing! Time for a little break: stretch, drink some water, look out of a window.</div>'); writeSave(); } }
function perfTrack(dt) {
  const p = game.perf; p.frames++; p.ms.push(dt * 1000); if (p.ms.length > 120) p.ms.shift();
  p.tt = (p.tt || 0) + dt; /* v2.3: time-based auto quality - checks every 2 s of play after 3 s warm-up, very slow devices drop two steps at once */
  if (save.settings.quality === 'auto' && (game.resLevel || 0) < 2 && p.tt > 3 && p.frames >= 20 && game.state === 'play' && !game.paused) { p.tt = 1; const m = p.ms.slice(-Math.min(p.ms.length, p.frames)).sort((a, b) => a - b), med = m[m.length >> 1]; if (med > 19) { game.resLevel = Math.min(2, (game.resLevel || 0) + (med > 40 ? 2 : 1)); if (game.resLevel >= 2) game.lowPerf = true; p.frames = 0; resize(); } }
}
// first touch: audio + fullscreen + orientation lock (web only; the Android app is already full-screen landscape)
function firstGesture() {
  initAudio(); applyVolumes();
  const native = !!window.Capacitor?.isNativePlatform?.();
  if (!native && matchMedia('(pointer: coarse)').matches) { const d = document.documentElement; (d.requestFullscreen ? d.requestFullscreen({ navigationUI: 'hide' }) : Promise.reject()).then(() => screen.orientation?.lock?.('landscape')).catch(() => {}); }
}
addEventListener('pointerdown', firstGesture, { once: true }); addEventListener('keydown', firstGesture, { once: true });
// Android back button -> pause / close menu
document.addEventListener('backbutton', () => { if (UI.isOpen()) UI.menuNav(0, false, true); else game.pause(); });
// --------- boot ---------
const boot = () => { loadSave(); if (migrateSave(save.progress)) writeSave(); }; // v1.8: v1.7 saves gain a missions block, nothing lost
boot(); initInput(canvas); resize(); UI.showTitle(); requestAnimationFrame(frame); loadGfx('gfx/');
// --------- test API (used by automated tests; harmless for players) ---------
addEventListener('rs-pausemap', () => game.drawPauseMap());
window.__RS = {
  UI, SP, AU: { audio, stinger, initAudio: _ia, graph: _ag }, AI22, planSurprises, story: ST, storyUI: SU, startChapter: (n) => game.startChapter(n), skipComic: () => SU.skipComic(), FEEL, moveButton, layoutEditor: () => showLayoutEditor(() => UI.close()),
  foes: { Enemy, Warden, TideGolem, Boss, DrownedBloom }, BR, GA, T20, DIFF, MS, toast, WEAPONS, trapPhase, TRAP_TIMING, TRAP_DMG,
  game, save, input, TILE, gfx: G, writeSave, loadSave: boot, missions, continueRun: () => document.querySelector('[data-act="continueRun"]').click(), layout: () => input.layout,
  get W() { return game.world; }, supports() { return game.world ? game.world.auditSupports() : null; },
  drawMap, mapInfo, renderNow() { if (game.world) render(0); },
  start(mode, opts) { initAudio(); game.go(mode, opts); },
  press(b) { simButton(b, true); }, release(b) { simButton(b, false); }, axes(x, y) { simAxes(x, y); },
  god(on = true) { game.god = on; if (game.world) game.world.god = on; },
  manual(on = true) { game.manual = on; },
  step(n = 1) { for (let i = 0; i < n; i++) { pollInput(); const W = game.world; if (!W || game.state !== 'play' || game.paused || UI.isOpen()) { endStep(); continue; } const r = W.update(STEP); game.tut && game.tut.update(STEP); if (game.god) W.player.hp = W.player.maxHp; if (r !== 'hs') endStep(); } return this.state(); },
  // v1.4 frame-pacing trace: drive the real loop with a fake clock at hz with +-noise ms jitter; returns per-frame drawn hero x / camera x
  trace(hz = 60, frames = 240, noise = 0, seed = 1) {
    let r = seed; const rnd = () => ((r = (r * 16807) % 2147483647) / 2147483647);
    const W = game.world; game.tracing = true; game.manual = false; let t = last + 1, out = [];
    for (let i = 0; i < frames; i++) { const dt = 1000 / hz + (noise ? (rnd() * 2 - 1) * noise : 0); t += Math.max(1, dt); const t0 = performance.now(); tick(t); out.push({ dt: Math.max(1, dt), px: W.dbg.px, camx: W.dbg.camx, cost: performance.now() - t0 }); }
    game.tracing = false; last = performance.now(); return out;
  },
  tut() { const t = game.tut; return t ? { step: t.step, done: [...t.done] } : null; },
  skipCountdown() { if (game.world) { game.world.countdown = 0.001; } },
  state() { const W = game.world; if (!W) return { state: game.state, ui: UI.ui.open }; const P = W.player; return { state: game.state, ui: UI.ui.open, mode: W.mode, x: P.x, y: P.y, vx: P.vx, vy: P.vy, hp: P.hp, onGround: P.onGround, hook: P.hook.s, enemies: W.enemies.length, glim: W.runGlim, cell: W.curCell ? W.curCell.index : -1, cells: W.cells.length, boss: W.boss ? { hp: W.boss.hp, phase: W.boss.phase, st: W.boss.st } : null, paused: game.paused, fps: 1000 / (game.perf.ms.reduce((a, b) => a + b, 0) / Math.max(1, game.perf.ms.length)) }; },
};
UI.applyA11y(); // v2.3 bigger text / gentle flashes
