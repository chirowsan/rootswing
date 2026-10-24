// Boot, game flow and the fixed-step loop.
import { save, loadSave, writeSave, diff } from './save.js';
import { initAudio, sfx, playSong, applyVolumes } from './audio.js';
import { input, initInput, pollInput, endStep, pressed, held, computeLayout, drawTouch, clearAll, simButton, simAxes } from './input.js';
import { World, VIEW_H, playerStats } from './world.js';
import { Tutorial } from './tutorial.js';
import { drawHUD } from './hud.js';
import { GADGETS } from './weapons.js';
import * as UI from './ui.js';
import { TILE } from './util.js';
const STEP = 1 / 60;
const canvas = document.getElementById('c'); const g = canvas.getContext('2d', { alpha: false });
const game = {
  state: 'title', world: null, tut: null, bossShown: null, paused: false, dpr: 1, cssW: 0, cssH: 0, perf: { frames: 0, slow: 0, ms: [] }, runStart: 0, god: false,
  bossBar(e) { this.bossShown = e; },
  saveRunState(W, cellIndex) { save.run = { seed: W.seed, cellIndex, hp: W.player.hp, flasks: W.player.flasks, weapon: W.player.weapon, glim: W.runGlim, cleared: [...W.cleared], visited: [...W.visited], opened: [...W.opened], boss: false, kills: W.player.stats.kills, t: this.runTime() }; writeSave(); },
  runTime() { return (save.run && save.run.t || 0) + (performance.now() - this.runStart) / 1000; },
  openStation(n) { this.paused = true; clearAll(); if (n === 1) UI.showShop(); else if (n === 2) UI.showLoadout(); else UI.showJournal(); UI.ui.back = 'game'; },
  useDoor(W) {
    if (W.mode === 'tutorial') { save.progress.tutorialDone = true; writeSave(); this.go('hub'); }
    else if (W.mode === 'hub') { save.progress.runs++; save.run = null; writeSave(); this.runStart = performance.now(); this.go('run', {}); }
    else if (W.mode === 'run') { const P = W.player; save.run = { seed: W.seed, hp: P.hp, flasks: P.flasks, weapon: P.weapon, glim: W.runGlim, boss: true, kills: P.stats.kills, rooms: W.visited.size, t: this.runTime() }; this.runStart = performance.now(); save.progress.bossSeen = true; writeSave(); this.go('boss', { player: { hp: P.hp, flasks: P.flasks, weapon: P.weapon }, glim: W.runGlim, kills: P.stats.kills }); }
  },
  onDeath(W, info) {
    if (this.world !== W) return;
    const found = W.runGlim, kept = W.mode === 'run' || W.mode === 'boss' ? Math.round(found * diff().keep) : 0;
    save.progress.glimmers += kept; save.progress.totalGlimmers += kept; save.progress.bestDepth = Math.max(save.progress.bestDepth, W.visited.size); save.run = null; writeSave();
    this.paused = true; UI.showDeath(info, kept, found, { rooms: (save.lastRooms || 0) + W.visited.size, kills: W.player.stats.kills });
  },
  onVictory(W) {
    if (this.world !== W) return;
    const glim = W.runGlim; save.progress.glimmers += glim; save.progress.totalGlimmers += glim; save.progress.wins++; save.progress.bossBeaten++; save.run = null; writeSave();
    const t = Math.round(this.runTime()); this.paused = true; UI.showVictory(glim, { kills: W.player.stats.kills, time: Math.floor(t / 60) + 'm ' + String(t % 60).padStart(2, '0') + 's' });
  },
  go(mode, opts = {}) {
    UI.close(); this.paused = false; this.bossShown = null; clearAll(); this.state = 'play';
    const W = new World(this, mode, opts); W.god = this.god; this.world = W; W.viewW = this.cssW && this.cssH ? VIEW_H * this.cssW / this.cssH : 760; W.snapCamera();
    if (opts.kills) W.player.stats.kills = opts.kills;
    for (const b of ['attack', 'dash', 'hook', 'parry', 'skill1', 'skill2', 'flask']) input.visible[b] = true;
    input.visible.skill2 = W.player.gadgets.length > 1; input.highlight = {};
    this.tut = mode === 'tutorial' ? new Tutorial(W) : null;
    if (mode === 'run' || mode === 'boss') { if (!save.run) this.saveRunState(W, 0); }
    this.relayout();
  },
  relayout() { input.layout = computeLayout(game.cssW, game.cssH); input.layout && (input.visible.skill2 = !game.world || game.world.player.gadgets.length > 1); },
  pause() { if (this.state !== 'play' || this.paused || !this.world) return; this.paused = true; clearAll(); sfx('uiBack'); UI.showPause(this.world.mode); },
};
UI.initUI({
  play() { initAudio(); if (!save.progress.tutorialDone) game.go('tutorial'); else game.go('hub'); },
  continueRun() { initAudio(); const r = save.run; if (!r) return; game.runStart = performance.now(); if (r.boss) game.go('boss', { player: { hp: r.hp, flasks: r.flasks, weapon: r.weapon }, glim: r.glim, kills: r.kills }); else game.go('run', { seed: r.seed, cellIndex: r.cellIndex, player: { hp: r.hp, flasks: r.flasks, weapon: r.weapon }, glim: r.glim, cleared: r.cleared, visited: r.visited, opened: r.opened, kills: r.kills }); },
  resume() { UI.close(); game.paused = false; clearAll(); },
  toHub() { game.go('hub'); }, toTitle() { game.state = 'title'; game.world = null; UI.showTitle(); playSong('hub'); },
  leaveRun() { const W = game.world; game.onDeath(W, { name: 'giving up', tip: 'No worries! Your kept glimmers are safe in the Seedhouse.' }); },
  skipTutorial() { save.progress.tutorialDone = true; writeSave(); game.go('hub'); },
  replayTutorial() { game.go('tutorial'); },
  relayout() { game.relayout(); }, statsChanged() { const W = game.world; if (W && W.mode === 'hub') { const s = playerStats(); Object.assign(W.player, { maxHp: s.maxHp, hp: s.maxHp, maxFlasks: s.maxFlasks, flasks: s.maxFlasks, weapon: s.weapon, gadgets: s.gadgets, hookRange: s.hookRange }); input.visible.skill2 = s.gadgets.length > 1; } },
});
function resize() {
  const q = save.settings.quality; const cap = q === 'high' ? 2.5 : q === 'low' ? 1 : (game.lowPerf ? 1.25 : 2);
  game.dpr = Math.min(devicePixelRatio || 1, cap); game.cssW = innerWidth; game.cssH = innerHeight;
  canvas.width = Math.round(game.cssW * game.dpr); canvas.height = Math.round(game.cssH * game.dpr); canvas.style.width = game.cssW + 'px'; canvas.style.height = game.cssH + 'px';
  game.relayout(); UI.showRotate(game.cssH > game.cssW * 1.05);
}
addEventListener('resize', resize); addEventListener('orientationchange', () => setTimeout(resize, 200));
document.addEventListener('visibilitychange', () => { if (document.hidden) game.pause(); });
let last = performance.now(), acc = 0, titleT = 0, menuCd = 0;
function frame(now) {
  requestAnimationFrame(frame);
  let real = Math.min(0.1, (now - last) / 1000); last = now; perfTrack(real);
  pollInput();
  const W = game.world;
  if (UI.isOpen()) { menuInput(real); endStep(); }
  else if (game.manual) { /* tests drive the simulation with __RS.step */ }
  else if (W && game.state === 'play' && !game.paused) {
    if (pressed('pause')) { game.pause(); endStep(); }
    else {
      acc += real * save.settings.speed; let n = 0;
      while (acc >= STEP && n < 4) { W.update(STEP); game.tut && game.tut.update(STEP); if (game.god) { W.player.hp = W.player.maxHp; } endStep(); acc -= STEP; n++; }
      if (n === 4) acc = 0;
    }
  } else endStep();
  render(real);
}
function menuInput(dt) {
  menuCd -= dt; const y = input.my, x = input.mx;
  if (menuCd <= 0 && (y || x)) { UI.menuNav(y > 0 || x > 0 ? 1 : -1); menuCd = 0.22; } if (!y && !x) menuCd = 0;
  if (pressed('confirm') || pressed('jump')) UI.menuNav(0, true); else if (pressed('pause') || pressed('dash')) UI.menuNav(0, false, true);
}
function render(dt) {
  const W = game.world, cw = canvas.width, ch = canvas.height;
  if (!W) { titleScene(dt); return; }
  const rs = ch / VIEW_H; W.draw(g, cw, ch, rs);
  if (game.tut) { g.setTransform(rs, 0, 0, rs, -W.camx * rs, -W.camy * rs); game.tut.drawWorld(g); }
  const s = game.dpr * Math.max(0.8, Math.min(1.25, game.cssH / 412));
  g.setTransform(1, 0, 0, 1, 0, 0); drawHUD(g, W, cw, ch, s);
  g.setTransform(game.dpr, 0, 0, game.dpr, 0, 0);
  if (!UI.isOpen()) { const P = W.player; drawTouch(g, W.t, P.gadgets.map((k) => GADGETS[k].icon), { skill1: P.gcd[0] / GADGETS[P.gadgets[0]].cd, skill2: P.gadgets[1] ? P.gcd[1] / GADGETS[P.gadgets[1]].cd : 0, dash: P.dashCd > 0 ? P.dashCd / 0.38 : 0 }, P.flasks); game.tut && game.tut.drawScreen(g); }
}
let titleWorld = null;
function titleScene(dt) { // the title screen shows a live, idle hub behind the menu
  if (!titleWorld) { titleWorld = new World(game, 'hub', {}); titleWorld.countdown = 0; titleWorld.fade = 0; }
  titleWorld.viewW = VIEW_H * game.cssW / game.cssH; titleWorld.t += dt; titleWorld.fx.update(dt); titleWorld.player.t += dt;
  titleWorld.cam.x = titleWorld.player.cx - titleWorld.viewW / 2 + Math.sin(titleWorld.t * 0.1) * 80; titleWorld.cam.y = titleWorld.player.cy - VIEW_H * 0.66;
  if (Math.random() < dt * 8) titleWorld.fx.burst(titleWorld.cam.x + Math.random() * titleWorld.viewW, titleWorld.cam.y + VIEW_H, 1, { color: '#e8ffb0', min: 10, max: 30, g: -20, drag: 0, life: 6, size: 2.2, angle: -Math.PI / 2, spread: 0.5, glow: 1 });
  titleWorld.draw(g, canvas.width, canvas.height, canvas.height / VIEW_H);
}
function perfTrack(dt) {
  const p = game.perf; p.frames++; p.ms.push(dt * 1000); if (p.ms.length > 120) p.ms.shift();
  if (save.settings.quality === 'auto' && !game.lowPerf && p.frames > 240 && p.frames % 120 === 0) { const avg = p.ms.reduce((a, b) => a + b, 0) / p.ms.length; if (avg > 22) { game.lowPerf = true; resize(); } }
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
loadSave(); initInput(canvas); resize(); UI.showTitle(); requestAnimationFrame(frame);
// --------- test API (used by automated tests; harmless for players) ---------
window.__RS = {
  game, save, input, TILE, writeSave, loadSave, continueRun: () => document.querySelector('[data-act="continueRun"]').click(), layout: () => input.layout,
  get W() { return game.world; },
  start(mode, opts) { initAudio(); game.go(mode, opts); },
  press(b) { simButton(b, true); }, release(b) { simButton(b, false); }, axes(x, y) { simAxes(x, y); },
  god(on = true) { game.god = on; if (game.world) game.world.god = on; },
  manual(on = true) { game.manual = on; },
  step(n = 1) { for (let i = 0; i < n; i++) { pollInput(); const W = game.world; if (!W || game.state !== 'play' || game.paused || UI.isOpen()) { endStep(); continue; } W.update(STEP); game.tut && game.tut.update(STEP); if (game.god) W.player.hp = W.player.maxHp; endStep(); } return this.state(); },
  tut() { const t = game.tut; return t ? { step: t.step, done: [...t.done] } : null; },
  skipCountdown() { if (game.world) { game.world.countdown = 0.001; } },
  state() { const W = game.world; if (!W) return { state: game.state, ui: UI.ui.open }; const P = W.player; return { state: game.state, ui: UI.ui.open, mode: W.mode, x: P.x, y: P.y, vx: P.vx, vy: P.vy, hp: P.hp, onGround: P.onGround, hook: P.hook.s, enemies: W.enemies.length, glim: W.runGlim, cell: W.curCell ? W.curCell.index : -1, cells: W.cells.length, boss: W.boss ? { hp: W.boss.hp, phase: W.boss.phase, st: W.boss.st } : null, paused: game.paused, fps: 1000 / (game.perf.ms.reduce((a, b) => a + b, 0) / Math.max(1, game.perf.ms.length)) }; },
};
