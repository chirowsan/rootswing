// Boot, game flow and the fixed-step loop.
import { save, loadSave, writeSave, diff } from './save.js';
import { initAudio, sfx, playSong, applyVolumes } from './audio.js';
import { input, initInput, pollInput, endStep, pressed, held, computeLayout, drawTouch, clearAll, simButton, simAxes } from './input.js';
import { World, VIEW_H, playerStats } from './world.js';
import { Tutorial } from './tutorial.js';
import { drawHUD, drawMap } from './hud.js';
import { GADGETS } from './weapons.js';
import * as UI from './ui.js';
import { TILE } from './util.js';
import { loadGfx, G } from './gfx.js';
import { drawGlow } from './art.js';
const STEP = 1 / 60;
const canvas = document.getElementById('c'); const g = canvas.getContext('2d', { alpha: false });
const game = {
  state: 'title', world: null, tut: null, bossShown: null, paused: false, dpr: 1, cssW: 0, cssH: 0, perf: { frames: 0, slow: 0, ms: [] }, runStart: 0, god: false,
  bossBar(e) { this.bossShown = e; },
  saveRunState(W, cellIndex) { save.run = { seed: W.seed, stage: W.stage || 0, cellIndex, hp: W.player.hp, flasks: W.player.flasks, weapon: W.player.weapon, glim: W.runGlim, cleared: [...W.cleared], visited: [...W.visited], opened: [...W.opened], boss: false, kills: W.player.stats.kills, t: this.runTime() }; this.runStart = performance.now(); writeSave(); },
  runTime() { return (save.run && save.run.t || 0) + (performance.now() - this.runStart) / 1000; },
  openStation(n) { this.paused = true; clearAll(); if (n === 1) UI.showShop(); else if (n === 2) UI.showLoadout(); else UI.showJournal(); UI.ui.back = 'game'; },
  useDoor(W) {
    if (W.mode === 'tutorial') { save.progress.tutorialDone = true; writeSave(); this.go('hub'); }
    else if (W.mode === 'hub') { save.progress.runs++; save.run = null; writeSave(); this.runStart = performance.now(); this.go('run', {}); }
    else if (W.mode === 'run') { const P = W.player; save.run = { seed: W.seed, stage: W.stage || 0, hp: P.hp, flasks: P.flasks, weapon: P.weapon, glim: W.runGlim, boss: true, kills: P.stats.kills, rooms: W.visited.size, t: this.runTime() }; this.runStart = performance.now(); save.progress.bossSeen = true; writeSave(); this.go('boss', { seed: W.seed, stage: W.stage || 0, player: { hp: P.hp, flasks: P.flasks, weapon: P.weapon }, glim: W.runGlim, kills: P.stats.kills }); }
  },
  onDeath(W, info) {
    if (this.world !== W) return;
    const found = W.runGlim, kept = W.mode === 'run' || W.mode === 'boss' ? Math.round(found * diff().keep) : 0;
    save.progress.glimmers += kept; save.progress.totalGlimmers += kept; save.progress.bestDepth = Math.max(save.progress.bestDepth, W.visited.size); save.run = null; writeSave();
    this.paused = true; UI.showDeath(info, kept, found, { rooms: (save.lastRooms || 0) + W.visited.size, kills: W.player.stats.kills });
  },
  onVictory(W) {
    if (this.world !== W) return;
    if (W.mode === 'boss' && !W.stage) { // v1.3: the Furnace opens the way down into biome 2; checkpoint between biomes
      const P = W.player; save.progress.bossBeaten++; const t = this.runTime(); save.run = null; this.runStart = performance.now();
      this.go('run', { seed: W.seed, stage: 1, player: { hp: P.maxHp, flasks: P.maxFlasks, weapon: P.weapon }, glim: W.runGlim, kills: P.stats.kills }); save.run.t = t; writeSave(); this.world.fx.text(this.world.player.cx, this.world.player.y - 40, 'Biome 2: Drowned Glowroots', '#bffcff', 18); return;
    }
    const glim = W.runGlim; save.progress.glimmers += glim; save.progress.totalGlimmers += glim; save.progress.wins++; save.progress.bossBeaten++; save.run = null; writeSave();
    const t = Math.round(this.runTime()); this.paused = true; UI.showVictory(glim, { kills: W.player.stats.kills, time: Math.floor(t / 60) + 'm ' + String(t % 60).padStart(2, '0') + 's' });
  },
  go(mode, opts = {}) {
    UI.close(); this.paused = false; this.bossShown = null; clearAll(); this.state = 'play';
    const W = new World(this, mode, opts); W.god = this.god; this.world = W; W.viewW = this.cssW && this.cssH ? W.viewH * this.cssW / this.cssH : 760; W.snapCamera();
    if (opts.kills) W.player.stats.kills = opts.kills;
    for (const b of ['attack', 'dash', 'hook', 'parry', 'skill1', 'skill2', 'flask']) input.visible[b] = true;
    input.visible.skill2 = W.player.gadgets.length > 1; input.highlight = {};
    this.tut = mode === 'tutorial' ? new Tutorial(W) : null;
    if (mode === 'run' || mode === 'boss') { if (!save.run) this.saveRunState(W, 0); }
    this.relayout();
  },
  relayout() { input.layout = computeLayout(game.cssW, game.cssH); input.layout && (input.visible.skill2 = !game.world || game.world.player.gadgets.length > 1); },
  pause() { if (this.state !== 'play' || this.paused || !this.world) return; this.paused = true; clearAll(); sfx('uiBack'); UI.showPause(this.world.mode); this.drawPauseMap(); },
  drawPauseMap() { const W = this.world, cv = document.getElementById('pmap'); if (!cv || !W || W.mode !== 'run') return; const g = cv.getContext('2d'); g.clearRect(0, 0, cv.width, cv.height); const cs = Math.floor(Math.min(cv.width / W.gw, cv.height / W.gh * 1.7)), chh = Math.floor(cs / 1.7); drawMap(g, W, (cv.width - cs * W.gw) / 2, (cv.height - chh * W.gh) / 2, cs, chh, true); if (this.paused && UI.ui.open === 'pause') requestAnimationFrame(() => this.drawPauseMap()); },
};
UI.initUI({
  play() { initAudio(); if (!save.progress.tutorialDone) game.go('tutorial'); else game.go('hub'); },
  continueRun() { initAudio(); const r = save.run; if (!r) return; game.runStart = performance.now(); if (r.boss) game.go('boss', { seed: r.seed, stage: r.stage || 0, player: { hp: r.hp, flasks: r.flasks, weapon: r.weapon }, glim: r.glim, kills: r.kills }); else game.go('run', { seed: r.seed, stage: r.stage || 0, cellIndex: r.cellIndex, player: { hp: r.hp, flasks: r.flasks, weapon: r.weapon }, glim: r.glim, cleared: r.cleared, visited: r.visited, opened: r.opened, kills: r.kills }); },
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
  const rs = ch / (W.viewH || VIEW_H); W.draw(g, cw, ch, rs);
  if (game.tut) { if (W.wt) g.setTransform(W.wt[0], 0, 0, W.wt[0], W.wt[1], W.wt[2]); else g.setTransform(rs, 0, 0, rs, -W.camx * rs, -W.camy * rs); game.tut.drawWorld(g); }
  const s = game.dpr * Math.max(0.8, Math.min(1.25, game.cssH / 412));
  g.setTransform(1, 0, 0, 1, 0, 0); drawHUD(g, W, cw, ch, s);
  g.setTransform(game.dpr, 0, 0, game.dpr, 0, 0);
  if (!UI.isOpen()) { const P = W.player; drawTouch(g, W.t, P.gadgets.map((k) => GADGETS[k].icon), { skill1: P.gcd[0] / GADGETS[P.gadgets[0]].cd, skill2: P.gadgets[1] ? P.gcd[1] / GADGETS[P.gadgets[1]].cd : 0, dash: P.dashCd > 0 ? P.dashCd / 0.38 : 0 }, P.flasks); game.tut && game.tut.drawScreen(g); }
}
let titleWorld = null;
let titleMotes = null;
function paintedTitle(dt) { // v1.1: painted key art with a slow drift, sun bloom and drifting pollen
  const img = G.img.title_key, cw = canvas.width, ch = canvas.height, lo = game.lowPerf || save.settings.quality === 'low';
  const tt = (game.titleT = (game.titleT || 0) + dt), z = 1.06 + (lo ? 0 : Math.sin(tt * 0.07) * 0.025), sc = Math.max(cw / img.width, ch / img.height) * z;
  const w = img.width * sc, h = img.height * sc, x = (cw - w) / 2 + (lo ? 0 : Math.sin(tt * 0.05) * cw * 0.01) - cw * 0.03, y = (ch - h) / 2 + (lo ? 0 : Math.cos(tt * 0.06) * ch * 0.006);
  g.setTransform(1, 0, 0, 1, 0, 0); g.drawImage(img, x, y, w, h);
  const lg = g.createLinearGradient(0, 0, cw * 0.62, 0); lg.addColorStop(0, 'rgba(8,10,22,0.78)'); lg.addColorStop(0.55, 'rgba(8,10,22,0.35)'); lg.addColorStop(1, 'rgba(8,10,22,0)'); g.fillStyle = lg; g.fillRect(0, 0, cw, ch);
  const vg = g.createRadialGradient(cw / 2, ch / 2, ch * 0.4, cw / 2, ch / 2, Math.max(cw, ch) * 0.75); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(6,4,14,0.55)'); g.fillStyle = vg; g.fillRect(0, 0, cw, ch);
  if (lo) return;
  g.globalCompositeOperation = 'lighter'; drawGlow(g, x + w * 0.28, y + h * 0.6, ch * 0.35, '#ffc070', 0.22 + Math.sin(tt * 0.8) * 0.04);
  if (!titleMotes) titleMotes = Array.from({ length: 60 }, () => ({ x: Math.random(), y: Math.random(), s: 0.6 + Math.random() * 1.6, v: 0.01 + Math.random() * 0.03, p: Math.random() * 7, c: Math.random() < 0.3 ? '#7ff6e0' : '#ffe9a8' }));
  for (const m of titleMotes) { m.y -= m.v * dt; m.x += Math.sin(tt * 0.6 + m.p) * 0.0006; if (m.y < -0.02) { m.y = 1.02; m.x = Math.random(); }
    const a = 0.35 + Math.sin(tt * 2 + m.p) * 0.3, r = m.s * ch / 412; g.globalAlpha = Math.max(0, a); drawGlow(g, m.x * cw, m.y * ch, r * 5, m.c, 0.6); g.fillStyle = m.c; g.fillRect(m.x * cw - r / 2, m.y * ch - r / 2, r, r); }
  g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
}
function titleScene(dt) { // the title screen shows a live, idle hub behind the menu
  if (G.ready && G.img.title_key) return paintedTitle(dt);
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
loadSave(); initInput(canvas); resize(); UI.showTitle(); requestAnimationFrame(frame); loadGfx('gfx/');
// --------- test API (used by automated tests; harmless for players) ---------
window.__RS = {
  game, save, input, TILE, gfx: G, writeSave, loadSave, continueRun: () => document.querySelector('[data-act="continueRun"]').click(), layout: () => input.layout,
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
