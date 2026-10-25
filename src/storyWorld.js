// v2.1 story inside the world: chapter wardens/bosses, Memory Leaf pickups, the hub's Elder Moss + Great Root + freed Wardens,
// chapter tint/weather, and the warden "freed" story beat. Kept out of world.js so v2.0 code stays put.
import { Warden, Boss, TideGolem, DrownedBloom, Blight } from './boss.js';
import { WARDENS } from './gauntlet.js';
import { G, sImg } from './gfx.js';
import { drawGlow, drawIcon } from './art.js';
import { sfx } from './audio.js';
import { diff, save } from './save.js';
import { TILE } from './util.js';
import * as ST from './story.js';

const SHADOW = { id: 'shadow', name: 'Shadow Warden', aggro: 1.4, hp: 1.3, minion: 'moth', aura: '#a05aff' };
export function initWorld(W, opts) {
  W.chapter = (W.mode === 'run' || W.mode === 'boss') ? (opts.chapter || 0) : 0;
  W.story = { banner: W.chapter ? 4 : 0, toast: null, beatT: 0, drops: [] };
  if (W.chapter) {
    const c = ST.camp(); W.story.drops = ST.loreFor(W.chapter).map((l) => l.id).filter((id) => !c.lore.includes(id));
    W.listeners.push((ev, d) => { if (ev === 'seed') ST.onSeed(W.chapter, d); });
  }
  if (W.mode === 'hub') hubProps(W);
}
// ---- chapter foes ----
export function chapterWarden(W, x, y, depth) {
  const ch = ST.CHAPTERS[W.chapter], id = ch.warden;
  const w = id === 'tide' ? new TideGolem(x, y, depth) : new Warden(x, y, depth); const D = diff();
  const v = id === 'shadow' ? SHADOW : WARDENS.find((k) => k.id === id) || WARDENS[0];
  w.variant = id === 'tide' ? 'classic' : v.id; w.maxHp = w.hp = Math.round(w.hp * D.hp * (id === 'tide' ? 1 : v.hp)); w.aggroK = id === 'tide' ? 1 : v.aggro;
  w.info = { ...w.info, name: ch.wardName }; if (v.minion && id !== 'tide' && id !== 'classic') w.minion = v.minion; if (v.aura && id !== 'tide') w.auraVar = v.aura;
  w.maxPoise = w.poise = Math.max(30, Math.round(w.maxHp * 0.16)); w.storyWarden = W.chapter; return w;
}
export function chapterBoss(W, x, y) {
  const n = W.chapter;
  if (n === 5) return new Blight(x, y);
  if (n === 3) { const b = new Boss(x, y); b.info = { ...b.info, name: 'Thornstack', tip: 'It charges more often. Jump over, then hit its back!' }; b.maxHp = b.hp = 820; b.auraVar = '#ff6a3a'; b.glim = 110;
    b.pools = [['slam', 'volley', 'charge'], ['slam', 'beam', 'charge', 'volley'], ['pillars', 'charge', 'slam', 'volley', 'beam']]; return b; }
  if (n === 4) { const b = new DrownedBloom(x, y); b.info = { ...b.info, name: 'Storm Bloom', tip: 'More bubbles! Stay moving, then strike.' }; b.maxHp = b.hp = 980; b.auraVar = '#5ad8ff'; b.glim = 140; b.minion = 'moth';
    b.pools = [['volley', 'slam', 'tide', 'volley'], ['beam', 'volley', 'tide', 'charge'], ['tide', 'pillars', 'volley', 'charge', 'slam', 'volley']]; return b; }
  return n === 2 ? new DrownedBloom(x, y) : new Boss(x, y);
}
// ---- Memory Leaves ----
function dropLore(W, x, y) { const id = W.story.drops.shift(); if (!id) return false; W.pickups.push({ kind: 'lore', id, x, y: y - 10, vx: 0, vy: -260, t: 0 }); return true; }
export function onWardenDown(W, e) {
  if (!W.chapter) return; dropLore(W, e.cx + 20, e.cy);
  ST.onWardenFreed(W.chapter); W.story.beatT = 1.8; // the comic plays once the dust settles
}
export function onTreasure(W, o) { if (W.chapter) dropLore(W, o.x + 14, o.y); }
export function pickLore(W, k) {
  const L = ST.LORE.find((l) => l.id === k.id), fresh = ST.addLore(k.id); sfx('unlock'); W.fx.ring(k.x, k.y, 40, '#9dff8a', 0.5, 4);
  W.fx.text(k.x, k.y - 14, 'Memory Leaf!', '#b8ff9a', 16); if (fresh && L) W.story.toast = { t: 5, text: L.t }; W.emit('lore', k.id);
}
export function drawLore(g, W, k) {
  const y = k.y + Math.sin(W.t * 3 + k.x) * 3, r = Math.sin(W.t * 2) * 0.3; g.globalCompositeOperation = 'lighter'; drawGlow(g, k.x, y, 22, '#9dff8a', 0.6); g.globalCompositeOperation = 'source-over';
  g.save(); g.translate(k.x, y); g.rotate(r); g.fillStyle = '#7fe06a'; g.beginPath(); g.moveTo(0, -11); g.quadraticCurveTo(10, -2, 0, 11); g.quadraticCurveTo(-10, -2, 0, -11); g.fill();
  g.strokeStyle = '#2f6a2a'; g.lineWidth = 1.4; g.beginPath(); g.moveTo(0, -9); g.lineTo(0, 12); g.stroke(); g.restore();
}
export function update(W, dt) {
  const S = W.story; if (!S) return; if (S.banner > 0) S.banner -= dt; if (S.toast && (S.toast.t -= dt) <= 0) S.toast = null;
  if (S.beatT > 0 && (S.beatT -= dt) <= 0 && W.game.storyBeat) W.game.storyBeat(W);
}
// ---- hub ----
const FRIEND_X = [25, 34, 37, 40];
function hubProps(W) {
  const fy = 18 * TILE; W.props.push({ kind: 'moss', x: 10 * TILE - 2, y: fy - 66, w: 52, h: 66 });
  const c = ST.camp(); [1, 2, 3, 4].forEach((n, i) => { if (c.freed[n]) W.props.push({ kind: 'friend', n, open: true, x: FRIEND_X[i] * TILE, y: fy - 60, w: 40, h: 60 }); });
}
export function drawStoryProp(g, W, o) {
  if (o.kind === 'moss') { const cx = o.x + o.w / 2, by = o.y + o.h + 2, bob = Math.sin(W.t * 1.6) * 1;
    g.fillStyle = 'rgba(5,3,10,0.3)'; g.beginPath(); g.ellipse(cx, by - 1, 26, 4, 0, 0, 7); g.fill();
    g.globalCompositeOperation = 'lighter'; drawGlow(g, cx + 22, by - 44, 26 + Math.sin(W.t * 3) * 3, '#ffc94a', 0.45); g.globalCompositeOperation = 'source-over';
    if (!sImg(g, 's_moss', cx, by + bob, 70, W.player.cx < cx)) { g.fillStyle = '#6a8a4a'; g.fillRect(o.x, o.y, o.w, o.h); }
    if (W.story && ST.camp() && !W.near) { const a = 0.6 + Math.sin(W.t * 4) * 0.4; g.globalAlpha = a; g.fillStyle = '#fff6c8'; g.beginPath(); g.arc(cx, o.y - 12, 7, 0, 7); g.fill(); g.globalAlpha = 1; g.fillStyle = '#3a2a10'; g.font = '900 11px system-ui,sans-serif'; g.textAlign = 'center'; g.fillText('!', cx, o.y - 8); }
    return true; }
  if (o.kind === 'friend') { const cx = o.x + o.w / 2, by = o.y + o.h + 2, col = ST.CHAPTERS[o.n].col, hop = Math.abs(Math.sin(W.t * 2 + o.n)) * 2;
    g.globalCompositeOperation = 'lighter'; drawGlow(g, cx, by - 30, 34, col, 0.25); g.globalCompositeOperation = 'source-over';
    sImg(g, 's_warden', cx, by - hop, o.n === 2 ? 66 : 58, W.player.cx < cx);
    for (let i = 0; i < 3; i++) { const a = W.t * 1.5 + i * 2.1; g.fillStyle = ['#ff8ab8', '#ffe27a', '#9dff8a'][i]; g.beginPath(); g.arc(cx + Math.cos(a) * 16, by - 50 + Math.sin(a) * 4, 2.6, 0, 7); g.fill(); }
    return true; }
  return false;
}
export function drawHubBack(g, W) {
  const k = ST.rootK(), x = 22 * TILE, y = 18 * TILE + 6, H = 258;
  if (G.img.s_root0 && k < 1) sImg(g, 's_root0', x, y, H, false, 1 - k * 0.85);
  if (G.img.s_root1 && k > 0) { g.globalAlpha = 1; sImg(g, 's_root1', x, y, H * (0.72 + 0.28 * k), false, Math.min(1, 0.25 + k)); }
  g.globalAlpha = 1;
  if (k > 0) { g.globalCompositeOperation = 'lighter'; drawGlow(g, x, y - H * 0.42, 50 + k * 50, '#ffd36a', 0.15 + k * 0.3); g.globalCompositeOperation = 'source-over'; }
  const n = ST.doneCount() * 7; for (let i = 0; i < n; i++) { const fx = 3 * TILE + ((i * 157) % 50) * TILE, c = ['#ff8ab8', '#ffe27a', '#b9a0ff', '#9dff8a'][i % 4]; // flowers spread as chapters are cleared
    g.fillStyle = '#3f7a35'; g.fillRect(fx, y - 12, 1.6, 7); g.fillStyle = c; g.beginPath(); g.arc(fx + 0.8, y - 13, 3, 0, 7); g.fill(); }
}
// ---- screen-space: chapter tint + weather, banner, lore toast, hub stamps ----
export function drawScreen(g, W, cw, ch, s) {
  const n = W.chapter, C = n && ST.CHAPTERS[n];
  if (C) { if (C.tint) { g.fillStyle = C.tint; g.fillRect(0, 0, cw, ch); }
    const t = W.t, P = C.parts; if (P) { g.save();
      for (let i = 0; i < 40; i++) { const r1 = (i * 0.6180339) % 1, r2 = (i * 0.4142135) % 1;
        if (P === 'rain') { const x = ((r1 * cw + t * 120 * s) % (cw + 40)) - 20, y = ((r2 * ch + t * 700 * s * (0.8 + r1 * 0.4)) % (ch + 40)) - 20; g.strokeStyle = 'rgba(170,210,255,0.35)'; g.lineWidth = 1.2 * s; g.beginPath(); g.moveTo(x, y); g.lineTo(x - 4 * s, y + 16 * s); g.stroke(); }
        else { const x = ((r1 * cw + Math.sin(t * 0.7 + i) * 30 * s + t * (P === 'ash' ? 14 : -30) * s) % (cw + 40) + cw + 40) % (cw + 40) - 20, y = ((r2 * ch + t * (P === 'ash' ? -18 : 40) * s) % (ch + 40) + ch + 40) % (ch + 40) - 20;
          g.fillStyle = P === 'ash' ? 'rgba(190,150,255,0.45)' : 'rgba(255,120,80,0.5)'; g.beginPath(); g.ellipse(x, y, 3 * s, 1.6 * s, t + i, 0, 7); g.fill(); } }
      g.restore(); } }
  const S = W.story; if (!S) return;
  g.textAlign = 'center';
  if (C && S.banner > 0) { const a = Math.min(1, S.banner, (4 - S.banner) * 3); g.globalAlpha = a; g.fillStyle = 'rgba(10,8,18,0.6)'; g.beginPath(); g.roundRect(cw / 2 - 190 * s, ch * 0.2 - 30 * s, 380 * s, 58 * s, 16 * s); g.fill();
    g.fillStyle = C.col; g.font = `900 ${13 * s}px system-ui,sans-serif`; g.fillText('CHAPTER ' + n + (W.mode === 'boss' ? ' - BOSS' : ''), cw / 2, ch * 0.2 - 10 * s);
    g.fillStyle = '#fff'; g.font = `900 ${22 * s}px system-ui,sans-serif`; g.fillText(W.mode === 'boss' ? C.boss : C.name, cw / 2, ch * 0.2 + 16 * s); g.globalAlpha = 1; }
  if (S.toast) { const a = Math.min(1, S.toast.t * 2), w = Math.min(cw * 0.8, 560 * s); g.globalAlpha = a; g.fillStyle = 'rgba(16,30,14,0.82)'; g.beginPath(); g.roundRect(cw / 2 - w / 2, ch - 110 * s, w, 54 * s, 14 * s); g.fill();
    g.strokeStyle = '#9dff8a'; g.lineWidth = 2 * s; g.stroke(); drawIcon(g, 'star', cw / 2 - w / 2 + 24 * s, ch - 83 * s, 20 * s, '#b8ff9a');
    g.fillStyle = '#eaffdf'; g.font = `800 ${14 * s}px system-ui,sans-serif`; g.textAlign = 'left'; wrap(g, S.toast.text, cw / 2 - w / 2 + 44 * s, ch - 88 * s, w - 56 * s, 17 * s); g.globalAlpha = 1; }
  if (W.mode === 'hub') { const c = ST.camp(), r = 13 * s, x0 = cw / 2 - 2.5 * 30 * s + 15 * s, y0 = 22 * s; // 5 chapter stamps
    g.fillStyle = 'rgba(10,8,18,0.55)'; g.beginPath(); g.roundRect(x0 - 22 * s, y0 - 17 * s, 5 * 30 * s + 14 * s, 34 * s, 17 * s); g.fill();
    for (let i = 1; i <= 5; i++) { const x = x0 + (i - 1) * 30 * s, done = c.done[i], open = i <= c.unlocked; g.fillStyle = done ? ST.CHAPTERS[i].col : open ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.4)'; g.beginPath(); g.arc(x, y0, r, 0, 7); g.fill();
      if (done) drawIcon(g, 'star', x, y0, 16 * s, '#fff'); else if (!open) drawIcon(g, 'lock', x, y0, 13 * s, '#99a'); else { g.fillStyle = '#fff'; g.font = `900 ${13 * s}px system-ui,sans-serif`; g.textAlign = 'center'; g.fillText(String(i), x, y0 + 5 * s); } } }
  g.textAlign = 'left';
}
function wrap(g, text, x, y, w, lh) { const words = text.split(' '); let line = '', yy = y; for (const wd of words) { const tt = line ? line + ' ' + wd : wd; if (g.measureText(tt).width > w && line) { g.fillText(line, x, yy); line = wd; yy += lh; } else line = tt; } g.fillText(line, x, yy); }
