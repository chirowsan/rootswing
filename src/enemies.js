// Smudgelings: cartoon ink critters that pop into ink and sparks. Every attack is telegraphed (glow + "!").
import { TILE, clamp, sign, approach, rand } from './util.js';
import { moveBody, groundBelow, lineClear } from './physics.js';
import { splat } from './brawl.js';
import { PAL, drawGlow } from './art.js';
import { has, spr, tinted, hasE } from './gfx.js';
import { track, drawRig, regPose, wardenPose, bossPose } from './eanim.js';
import { save as _save } from './save.js';
import { sfx } from './audio.js';
import { diff } from './save.js';
import * as AI from './ai22.js';
import { INFO22, DEF22, U22, draw22 } from './foes22.js';

export const ENEMY_INFO = {
  hopper: { name: 'Blotling', tip: 'Blotlings hop at you. Jump over, then strike!' },
  charger: { name: 'Rustbug', tip: 'When a Rustbug glows red, it charges. Jump or dash through it.' },
  moth: { name: 'Smogmoth', tip: 'Moths flash before swooping. Step aside or parry.' },
  puffcap: { name: 'Puffcap', tip: 'Puffcap spit is slow. Parry it to send it back!' },
  knight: { name: 'Kettle Knight', tip: 'Shields block hits. Use a charged heavy hit, or hit from behind.' },
  bomber: { name: 'Fizzpot', tip: 'Red circles show where bombs land. Step out of them.' },
  dummy: { name: 'Practice Dummy', tip: '' }, tturret: { name: 'Practice Puffcap', tip: 'Press parry just as the spit arrives.' },
  lurefish: { name: 'Lurefish', tip: 'Its lantern flares before it dives. Dodge sideways, then strike.' },
  jelly: { name: 'Glowjelly', tip: 'A growing ring means a pulse. Step out of the ring!' },
  shellback: { name: 'Shellback', tip: 'Its shell blocks hits from the front. Hit it from behind or use a heavy hit.' },
  tidegolem: { name: 'Tide Golem', tip: 'Jump its shockwaves, parry its shoulder bash.' },
  drowned: { name: 'The Drowned Bloom', tip: 'Red markers show where the danger lands. Watch the tide.' },
  warden: { name: 'Scrap Warden', tip: 'Jump over its shockwave rings. Parry its shield bash!' },
  boss: { name: 'Grumblestack', tip: 'Watch the red markers: they show exactly where danger lands.' },
  thorns: { name: 'Thorns', tip: 'Red spikes hurt! Jump over them or swing on a gold ring.' },
  smog: { name: 'Smog Pit', tip: 'Glowing red smog hurts. Hook a ring to cross it.' },
};
const DEF = {
  hopper: { w: 22, h: 20, hp: 22, dmg: 10, light: true, glim: 2 },
  charger: { w: 30, h: 20, hp: 34, dmg: 14, light: true, glim: 3 },
  moth: { w: 22, h: 18, hp: 18, dmg: 10, light: true, glim: 2, fly: true },
  puffcap: { w: 26, h: 26, hp: 30, dmg: 10, light: false, glim: 3 },
  knight: { w: 24, h: 38, hp: 70, dmg: 17, light: false, glim: 6 },
  bomber: { w: 24, h: 26, hp: 26, dmg: 14, light: true, glim: 4 },
  lurefish: { w: 24, h: 18, hp: 26, dmg: 12, light: true, glim: 3, fly: true },
  jelly: { w: 24, h: 24, hp: 30, dmg: 8, light: true, glim: 3, fly: true },
  shellback: { w: 32, h: 22, hp: 52, dmg: 14, light: false, glim: 5 },
  dummy: { w: 22, h: 36, hp: 1e9, dmg: 0, light: false, glim: 0 },
  tturret: { w: 26, h: 26, hp: 1e9, dmg: 5, light: false, glim: 0 },
};
Object.assign(ENEMY_INFO, INFO22); Object.assign(DEF, DEF22);
export class Enemy {
  constructor(type, x, y, depth = 0) {
    const d = DEF[type]; Object.assign(this, { type, w: d.w, h: d.h, light: d.light, fly: !!d.fly, glim: d.glim, cdmg: d.dmg });
    this.depth = depth; const scale = 1 + depth * diff().ramp; /* v2.0 steeper ramp per difficulty */ this.maxHp = this.hp = Math.round(d.hp * scale);
    this.x = x - d.w / 2; this.y = y - d.h; this.vx = 0; this.vy = 0; this.face = rand.chance(0.5) ? 1 : -1; this.st = 'idle'; this.t = 0; this.cd = rand.range(0.5, 1.5);
    this.stun = 0; this.flash = 0; this.tele = 0; this.dead = false; this.onGround = false; this.homeX = this.x; this.homeY = this.y; this.anim = rand.range(0, 10); this.sq = 1; this.shield = type === 'knight' || type === 'shellback'; this.hitsTaken = 0;
    this.info = ENEMY_INFO[type];
  }
  get cx() { return this.x + this.w / 2; } get cy() { return this.y + this.h / 2; }
  yank(p) { const d = sign(p.cx - this.cx); this.vx = d * Math.min(1000, Math.max(200, 10 * (Math.abs(p.cx - this.cx) - 26))); this.vy = -160; this.stun = Math.max(this.stun, 0.9); this.st = 'idle'; this.tele = 0; }
  update(W, dt) {
    const P = W.player, A = diff().aggro * (this.aggroK || 1); this.t += dt; this.anim += dt; this.flash = Math.max(0, this.flash - dt); this.sq = approach(this.sq, 1, dt * 4);
    const dx = P.cx - this.cx, dy = P.cy - this.cy, adx = Math.abs(dx);
    const seen = adx < 330 && Math.abs(dy) < 150 && !P.dead;
    if (this.juggle > 0) { this.juggle -= dt; if (this.vy > -400) this.vy -= 1500 * dt * 0.55; } // v1.9 juggle float
    if (this.spinV) { this.spin = (this.spin || 0) + this.spinV * dt; this.spinV *= 1 - dt * 1.5; if ((this.onGround && this.vy >= 0 && !(this.juggle > 0)) || Math.abs(this.spinV) < 1) { this.spinV = 0; this.spin = 0; } }
    if (this.stun > 0 && !AI.mashGuard(W, this, P)) { this.stun -= dt; this.tele = 0; this.physics(W, dt, true); return; }
    this.cd -= dt * A;
    if (!AI.pre(W, this, dt, P, dx, dy, adx, seen)) { const fn = this['u_' + this.type] || U22[this.type]; if (fn) fn.call(this, W, dt, P, dx, dy, adx, seen, A); AI.post(W, this, dt); } // v2.2 AI moves
    // contact damage (not while stunned; dummies harmless)
    if (this.cdmg && this.type !== 'tturret' && this.type !== 'puffcap' && W.overlapPlayer(this, 4) && !(this.alpha < 0.9)) W.damagePlayer(this.cdmg * (this.st === 'charge' || this.st === 'swoop' || this.st === 'lunge' ? 1 : 0.7 * (diff().contact ?? 1)), this.cx, { name: this.info.name, tip: this.info.tip, parryable: this.st === 'charge' || this.st === 'swoop' || this.st === 'lunge', src: this });
  }
  physics(W, dt, stunned) {
    if (this.fly && !stunned) { const r = moveBody(W.map, this, dt); this.onGround = r.ground; return r; }
    this.vy = Math.min(this.vy + 1500 * dt, 600); if (stunned || this.onGround) this.vx *= stunned ? 0.9 : 1;
    const vx0 = this.vx, r = moveBody(W.map, this, dt);
    if (this.flungT > W.t && (r.wallL || r.wallR) && Math.abs(vx0) > 180 && this.type !== 'dummy' && !this.dead) splat(W, this, vx0); // v2.0 wall splat
    this.onGround = r.ground || (this.vy >= 0 && !!groundBelow(W.map, this));
    if (this.fly && stunned && this.onGround) this.vx *= 0.8;
    const hz = W.map.hazard(Math.floor(this.cx / TILE), Math.floor((this.y + this.h - 2) / TILE)); if (hz && !this.fly && this.type !== 'dummy') W.hitEnemy(this, { dmg: 999, kb: 0, src: 'hazard' }, null);
    return r;
  }
  ledgeAhead(W, dir) { const tx = Math.floor((dir > 0 ? this.x + this.w + 2 : this.x - 2) / TILE), ty = Math.floor((this.y + this.h + 2) / TILE); return !W.map.solid(tx, ty) && W.map.get(tx, ty) !== '=' || W.map.hazard(tx, ty - 1) || W.map.hazard(tx, ty); }
  wallAhead(W, dir) { const tx = Math.floor((dir > 0 ? this.x + this.w + 2 : this.x - 2) / TILE); return W.map.solid(tx, Math.floor((this.y + this.h - 4) / TILE)) || W.map.solid(tx, Math.floor((this.y + 4) / TILE)); }
  u_hopper(W, dt, P, dx, dy, adx, seen) {
    if (this.onGround) {
      if (this.st === 'hop') { this.st = 'idle'; this.cd = rand.range(0.7, 1.2); this.sq = 0.6; this.vx = 0; }
      if (this.st === 'idle' && this.cd <= 0) { this.st = 'tele'; this.t = 0; if (seen) this.face = sign(dx) || 1; }
      if (this.st === 'tele') { this.tele = this.t / 0.38; this.sq = 1 - this.tele * 0.3; if (this.t > 0.38) { const d = this.face; this.st = 'hop'; this.tele = 0; this.vy = -360; this.vx = (seen ? clamp(adx * 1.3, 90, 170) : 70) * d; if (!seen && (this.ledgeAhead(W, d) || this.wallAhead(W, d))) this.vx = -this.vx, this.face = -d; this.sq = 1.35; sfx('jump', 0.1); } }
    }
    this.physics(W, dt);
  }
  u_charger(W, dt, P, dx, dy, adx, seen) {
    if (this.st === 'idle') { this.vx = this.face * 45; if (this.wallAhead(W, this.face) || this.ledgeAhead(W, this.face)) this.face *= -1; if (seen && Math.abs(dy) < 50 && adx < 260 && this.cd <= 0) { this.face = sign(dx) || 1; this.st = 'tele'; this.t = 0; this.vx = 0; sfx('telegraph'); } }
    else if (this.st === 'tele') { this.tele = this.t / 0.6; this.vx = -this.face * 20; if (this.t > 0.6) { this.st = 'charge'; this.t = 0; this.tele = 0; } }
    else if (this.st === 'charge') { this.vx = this.face * 300; if (Math.random() < 0.5) W.fx.burst(this.cx - this.face * 12, this.y + this.h, 1, { color: '#cbb', min: 10, max: 50, g: -20, life: 0.3 }); if (this.wallAhead(W, this.face)) { this.stun = 1.3; this.vx = -this.face * 120; this.vy = -150; W.fx.shake(0.15); sfx('thump'); this.st = 'idle'; this.cd = 1.5; W.fx.burst(this.cx + this.face * 14, this.cy, 8, { color: PAL.spark, kind: 'star' }); } else if (this.ledgeAhead(W, this.face) || this.t > 0.9) { this.st = 'rest'; this.t = 0; } }
    else if (this.st === 'rest') { this.vx = approach(this.vx, 0, 900 * dt); if (this.t > 0.7) { this.st = 'idle'; this.cd = 1.2; } }
    this.physics(W, dt);
  }
  u_moth(W, dt, P, dx, dy, adx, seen) {
    if (this.st === 'idle') { const tx = seen ? P.cx - this.w / 2 - sign(dx) * 90 : this.homeX, ty = (seen ? P.y - 70 : this.homeY) + Math.sin(this.anim * 2) * 14; this.vx = approach(this.vx, clamp((tx - this.x) * 2, -110, 110), 300 * dt); this.vy = approach(this.vy, clamp((ty - this.y) * 2, -110, 110), 300 * dt); this.face = sign(dx) || this.face;
      if (seen && this.cd <= 0 && adx < 260 && lineClear(W.map, this.cx, this.cy, P.cx, P.cy)) { this.st = 'tele'; this.t = 0; sfx('telegraph'); } }
    else if (this.st === 'tele') { this.tele = this.t / 0.55; this.vx *= 0.9; this.vy = -30; if (this.t > 0.55) { this.st = 'swoop'; this.t = 0; this.tele = 0; const tx = P.cx - this.cx, ty = P.cy - this.cy, d = Math.hypot(tx, ty) || 1; this.vx = tx / d * 300; this.vy = ty / d * 300; this.face = sign(tx) || 1; } }
    else if (this.st === 'swoop') { const r = this.physics(W, dt); if (this.t > 0.75 || r.ground || r.wallL || r.wallR) { this.st = 'idle'; this.cd = 1.6; this.vy = -80; } return; }
    this.physics(W, dt);
  }
  u_puffcap(W, dt, P, dx, dy, adx, seen) {
    this.face = sign(dx) || this.face;
    if (this.st === 'idle' && seen && adx < 340 && this.cd <= 0 && lineClear(W.map, this.cx, this.y + 6, P.cx, P.cy)) { this.st = 'tele'; this.t = 0; sfx('telegraph'); }
    if (this.st === 'tele') { this.tele = this.t / 0.6; if (this.t > 0.6) { this.st = 'idle'; this.tele = 0; this.cd = 2.2; this.sq = 1.3; const tx = P.cx - this.cx, ty = P.cy - (this.y + 8), d = Math.hypot(tx, ty) || 1; AI.volley(W, this, tx / d, ty / d, 170, { dmg: 10, name: this.info.name, tip: this.info.tip }); sfx('enemyShoot'); } }
    this.physics(W, dt);
  }
  u_tturret(W, dt, P, dx, dy, adx) {
    this.face = sign(dx) || this.face;
    if (this.st === 'idle' && adx < 300 && Math.abs(dy) < 120 && this.cd <= 0) { this.st = 'tele'; this.t = 0; sfx('telegraph'); }
    if (this.st === 'tele') { this.tele = this.t / 0.7; if (this.t > 0.7) { this.st = 'idle'; this.tele = 0; this.cd = 2.6; this.sq = 1.3; W.spawnEnemyShot(this.cx, this.y + 8, sign(dx) * 140, 0, { dmg: 5, name: this.info.name, tip: this.info.tip, training: true }); sfx('enemyShoot'); } }
    this.physics(W, dt);
  }
  u_dummy(W, dt) { this.physics(W, dt); }
  u_knight(W, dt, P, dx, dy, adx, seen) {
    if (this.st === 'idle') { if (seen) { this.face = sign(dx) || 1; this.vx = adx > 48 ? this.face * 55 : 0; if (this.ledgeAhead(W, this.face) || this.wallAhead(W, this.face)) this.vx = 0; if (adx < 70 && Math.abs(dy) < 50 && this.cd <= 0) { this.st = 'tele'; this.t = 0; this.vx = 0; sfx('telegraph'); } } else this.vx = 0; }
    else if (this.st === 'tele') { this.tele = this.t / 0.7; if (this.t > 0.7) { this.st = 'swing'; this.t = 0; this.tele = 0; sfx('swingHeavy'); this.vx = this.face * 90; } }
    else if (this.st === 'swing') { this.vx *= 0.85; const box = { x: this.face > 0 ? this.cx : this.cx - 56, y: this.y - 6, w: 56, h: this.h + 6 }; if (this.t < 0.16) W.enemyAttack(box, 17, this, { parryable: true, name: this.info.name, tip: this.info.tip }); if (this.t > 0.16) { this.st = 'rec'; this.t = 0; } }
    else if (this.st === 'rec') { this.vx = 0; if (this.t > 0.6) { this.st = 'idle'; this.cd = 1.3; } }
    this.physics(W, dt);
  }
  u_bomber(W, dt, P, dx, dy, adx, seen) {
    if (this.st === 'idle') { if (seen) { this.face = sign(dx) || 1; const want = adx < 150 ? -this.face * 70 : adx > 260 ? this.face * 50 : 0; this.vx = want; if (want && (this.ledgeAhead(W, sign(want)) || this.wallAhead(W, sign(want)))) this.vx = 0; if (this.cd <= 0 && adx < 330) { this.st = 'tele'; this.t = 0; this.vx = 0; sfx('telegraph'); } } else this.vx = 0; }
    else if (this.st === 'tele') { this.tele = this.t / 0.55; if (this.t > 0.55) { this.st = 'idle'; this.tele = 0; this.cd = 2.8; W.throwBomb(this, P.cx + P.vx * 0.4, P.y + P.h); sfx('bow'); } }
    this.physics(W, dt);
  }
  u_lurefish(W, dt, P, dx, dy, adx, seen) { // hovers by its lure, flares, then dives in a straight line and swims back
    if (this.st === 'idle') { const tx = seen ? P.cx - this.w / 2 - sign(dx) * 110 : this.homeX, ty = (seen ? P.y - 90 : this.homeY) + Math.sin(this.anim * 1.6) * 10; this.vx = approach(this.vx, clamp((tx - this.x) * 1.5, -90, 90), 220 * dt); this.vy = approach(this.vy, clamp((ty - this.y) * 1.5, -90, 90), 220 * dt); this.face = sign(dx) || this.face;
      if (seen && this.cd <= 0 && adx < 280 && lineClear(W.map, this.cx, this.cy, P.cx, P.cy)) { this.st = 'tele'; this.t = 0; sfx('telegraph'); } }
    else if (this.st === 'tele') { this.tele = this.t / 0.65; this.vx *= 0.88; this.vy = approach(this.vy, -40, 300 * dt); if (this.t > 0.65) { this.st = 'swoop'; this.t = 0; this.tele = 0; const tx = P.cx - this.cx, ty = P.cy - this.cy, d = Math.hypot(tx, ty) || 1; this.vx = tx / d * 360; this.vy = ty / d * 360; this.face = sign(tx) || 1; } }
    else if (this.st === 'swoop') { if (Math.random() < 0.6) W.fx.burst(this.cx, this.cy, 1, { color: '#9ff6ff', min: 5, max: 30, life: 0.4, size: 2, glow: 1 }); const r = this.physics(W, dt); if (this.t > 0.6 || r.ground || r.wallL || r.wallR) { this.st = 'idle'; this.cd = 1.8; this.vy = -60; } return; }
    this.physics(W, dt);
  }
  u_jelly(W, dt, P, dx, dy, adx, seen) { // drifts toward you, then a telegraphed pulse ring
    if (this.st === 'idle') { const tx = seen ? P.cx - this.w / 2 : this.homeX, ty = (seen ? P.y - 30 : this.homeY) + Math.sin(this.anim * 1.2) * 16; this.vx = approach(this.vx, clamp((tx - this.x) * 0.8, -55, 55), 120 * dt); this.vy = approach(this.vy, clamp((ty - this.y) * 0.8, -55, 55), 120 * dt);
      if (seen && this.cd <= 0 && Math.hypot(dx, dy) < 120) { this.st = 'tele'; this.t = 0; sfx('telegraph'); } }
    else if (this.st === 'tele') { this.tele = this.t / 0.8; this.vx *= 0.9; this.vy *= 0.9; if (this.t > 0.8) { this.st = 'pulse'; this.t = 0; this.tele = 0; sfx('explode', 0.4); W.fx.burst(this.cx, this.cy, 14, { color: ['#9ff6ff', '#fff'], min: 80, max: 200, life: 0.35, glow: 1 }); if (Math.hypot(P.cx - this.cx, P.cy - this.cy) < 80) W.damagePlayer(12, this.cx, { name: this.info.name, tip: this.info.tip, parryable: false, src: this }); } }
    else if (this.st === 'pulse') { this.ring = this.t / 0.3; if (this.t > 0.3) { this.st = 'idle'; this.ring = 0; this.cd = 2.2; } }
    this.physics(W, dt);
  }
  u_shellback(W, dt, P, dx, dy, adx, seen) { // shell blocks frontal hits; rolls at you after a rattle
    if (this.st === 'idle') { if (seen) this.face = sign(dx) || this.face; this.vx = this.face * 40; if (this.wallAhead(W, this.face) || this.ledgeAhead(W, this.face)) { this.face *= -1; this.vx = 0; } if (seen && Math.abs(dy) < 50 && adx < 230 && this.cd <= 0) { this.st = 'tele'; this.t = 0; this.vx = 0; sfx('telegraph'); } }
    else if (this.st === 'tele') { this.tele = this.t / 0.55; this.vx = 0; if (this.t > 0.55) { this.st = 'charge'; this.t = 0; this.tele = 0; } }
    else if (this.st === 'charge') { this.vx = this.face * 260; if (this.wallAhead(W, this.face) || this.ledgeAhead(W, this.face) || this.t > 0.8) { this.st = 'rest'; this.t = 0; if (this.wallAhead(W, this.face)) { W.fx.shake(0.1); sfx('thump'); } } }
    else if (this.st === 'rest') { this.vx = approach(this.vx, 0, 900 * dt); if (this.t > 0.8) { this.st = 'idle'; this.cd = 1.6; } }
    this.physics(W, dt);
  }
  // ---------------- drawing ----------------
  drawPainted(g, W) {
    const X = this.cx, Y = this.y + this.h, t = this.anim, n = this.type, tele = this.tele, f = this.face;
    const lo = (W.game && W.game.lowPerf) || _save.settings.quality === 'low';
    const H = { hopper: 27, charger: 27, moth: 30, puffcap: 32, knight: 47, bomber: 31, dummy: 40, tturret: 30, lurefish: 28, jelly: 32, shellback: 30 }[n] * 1.15 || this.h; // v1.2: drawn 15% larger than v1.1 (hitboxes unchanged)
    const hot = tele > 0 || this.st === 'charge' || this.st === 'swoop' || this.st === 'swing';
    if (!lo) drawGlow(g, X, this.cy, H * 0.8, '#07060e', 0.35);
    if (hot) drawGlow(g, X, Y - H * 0.5, H * (0.9 + tele * 0.4), '#ff2a3a', 0.45 + tele * 0.45);
    if (hasE(n + '_base')) { // v1.4: animated painted frames (one drawImage, border baked in)
      track(this); drawRig(g, this, n, regPose(this), H, hot ? 0.25 + tele * 0.35 : 0);
      if (this.shield && n === 'knight' && this.shieldFlash) { g.globalAlpha = Math.min(1, this.shieldFlash * 5); drawGlow(g, X + 8 * f, Y - H * 0.45, 14, '#bfefff', 1); g.globalAlpha = 1; }
      return;
    }
    g.save(); g.translate(X + (tele > 0 ? Math.sin(t * 60) * 1.2 : 0), Y + (this.fly ? Math.sin(t * 4) * 2 : 1));
    const sq = this.sq, st = 1 / Math.sqrt(sq), idle = this.st === 'idle' || !this.st; let rot = 0, bx = 1, by = 1;
    if (idle && n !== 'dummy' && n !== 'tturret') by = 1 + Math.sin(t * 3.2) * 0.035;
    if (n === 'moth') rot = Math.sin(t * 7) * 0.08 + Math.max(-0.35, Math.min(0.35, this.vx / 500)) * f;
    else if (n === 'charger' && this.st === 'charge') rot = Math.sin(t * 40) * 0.05 - 0.05 * f;
    else if (n === 'knight') rot = this.st === 'tele' ? -tele * 0.14 * f : this.st === 'swing' ? 0.14 * f : 0;
    else if (n === 'hopper' && !this.onGround) rot = Math.max(-0.3, Math.min(0.3, this.vy / 900)) * -f;
    else if (n === 'puffcap') { bx = by = 1 + tele * 0.25; }
    else if (n === 'lurefish') rot = Math.sin(t * 5) * 0.06 + (this.st === 'swoop' ? Math.atan2(this.vy, Math.abs(this.vx) + 1) * 0.6 * f : 0);
    else if (n === 'jelly') { by = 1 + Math.sin(t * 4) * 0.08 + tele * 0.15; bx = 1 - Math.sin(t * 4) * 0.05; }
    else if (n === 'shellback' && this.st === 'charge') rot = Math.sin(t * 30) * 0.06;
    else if (n === 'dummy' && this.flash > 0) rot = Math.sin(t * 30) * this.flash * 2;
    g.rotate(rot); g.scale(st * bx, sq * by);
    const flip = f < 0;
    if (!lo) { const ink = tinted(n, '#0c0a14'), rim = tinted(n, '#ff5a28'); for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) spr(g, n, dx * 1.8, dy * 1.8, H, 0.5, 1, flip, ink); for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) spr(g, n, dx * 0.85, dy * 0.85, H, 0.5, 1, flip, rim); } // ink border + red-orange danger rim
    spr(g, n, 0, 0, H, 0.5, 1, flip);
    if (hot) { g.globalAlpha = 0.25 + tele * 0.35; g.globalCompositeOperation = 'lighter'; spr(g, n, 0, 0, H, 0.5, 1, flip, tinted(n, '#ff3040')); g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1; }
    if (this.flash > 0) { g.globalAlpha = Math.min(1, this.flash * 14); spr(g, n, 0, 0, H, 0.5, 1, flip, tinted(n, '#ffffff')); g.globalAlpha = 1; }
    if (this.shield && n === 'knight' && this.shieldFlash) { g.globalAlpha = Math.min(1, this.shieldFlash * 5); drawGlow(g, 8 * f, -H * 0.45, 14, '#bfefff', 1); g.globalAlpha = 1; }
    g.restore();
  }
  draw(g, W) {
    const X = this.cx, Y = this.y + this.h, t = this.anim;
    const tele = this.tele; if (DEF22[this.type]) { draw22(g, this); if (tele > 0) this.drawBang(g, X, this.y - 16, tele); return; }
    const painted = has(this.type); if (painted) this.drawPainted(g, W);
    if (!painted) {
    g.save(); g.translate(X, Y);
    
    const sq = this.sq, stretch = 1 / Math.sqrt(sq);
    g.scale(this.face * stretch, sq);
    g.lineJoin = 'round'; g.lineWidth = 2.2; g.strokeStyle = '#0c0a14';
    const eyeC = tele > 0 ? '#ff4a5a' : PAL.eye;
    const eye = (x, y, r) => { g.fillStyle = eyeC; g.beginPath(); g.ellipse(x, y, r, r * 1.15, 0, 0, 7); g.fill(); g.fillStyle = '#1a1022'; g.beginPath(); g.arc(x + r * 0.3, y, r * 0.45, 0, 7); g.fill(); g.fillStyle = '#fff'; g.fillRect(x + r * 0.1, y - r * 0.6, r * 0.35, r * 0.35); };
    const ink = (path) => { g.fillStyle = PAL.enemy; path(); g.fill(); g.stroke(); };
    if (this.type === 'hopper') {
      ink(() => { g.beginPath(); g.moveTo(-12, 0); g.quadraticCurveTo(-14, -20, 0, -21); g.quadraticCurveTo(14, -20, 12, 0); g.quadraticCurveTo(0, 3, -12, 0); });
      g.fillStyle = PAL.enemyHi; g.beginPath(); g.ellipse(-4, -15, 4, 2.5, -0.4, 0, 7); g.fill();
      for (const s of [-1, 1]) { g.strokeStyle = PAL.enemy; g.lineWidth = 2; g.beginPath(); g.moveTo(s * 4, -20); g.quadraticCurveTo(s * 8, -28 + Math.sin(t * 5 + s) * 2, s * 9, -30); g.stroke(); g.fillStyle = PAL.enemy; g.beginPath(); g.arc(s * 9, -30, 2.6, 0, 7); g.fill(); }
      eye(4, -11, 3.6);
    } else if (this.type === 'charger') {
      const sh = tele > 0 ? Math.sin(t * 60) * 1.5 : 0; g.translate(sh, 0);
      ink(() => { g.beginPath(); g.ellipse(0, -8, 16, 9, 0, 0, 7); });
      g.fillStyle = '#b8612e'; g.beginPath(); g.moveTo(-15, -9); g.quadraticCurveTo(-6, -24, 12, -12); g.lineTo(-15, -9); g.fill(); g.stroke();
      g.strokeStyle = '#ffb07a'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(-10, -12); g.lineTo(6, -15); g.stroke(); g.strokeStyle = '#0c0a14'; g.lineWidth = 2.2;
      g.fillStyle = '#e8d6c0'; g.beginPath(); g.moveTo(14, -10); g.lineTo(23, -15); g.lineTo(16, -5); g.fill(); g.stroke();
      const lp = this.st === 'charge' ? t * 30 : t * 8; g.strokeStyle = PAL.enemy; g.lineWidth = 2.5; for (let i = 0; i < 3; i++) { const o = -8 + i * 8; g.beginPath(); g.moveTo(o, -2); g.lineTo(o + Math.sin(lp + i * 2) * 3, 1); g.stroke(); }
      eye(9, -9, 3);
      if (tele > 0 || this.st === 'charge') drawGlow(g, 10, -9, 16, '#ff4a5a', 0.9);
    } else if (this.type === 'moth') {
      const flap = Math.sin(t * (this.st === 'tele' ? 40 : 16)) * 0.6;
      g.translate(0, -9);
      for (const s of [-1, 1]) { g.save(); g.rotate(s * (0.5 + flap * s * 0.4)); g.fillStyle = tele > 0 ? '#ffb0c0' : '#c9b8f0'; g.beginPath(); g.ellipse(s * 2, -12, 7, 13, s * 0.2, 0, 7); g.fill(); g.stroke(); g.fillStyle = 'rgba(80,60,140,0.5)'; g.beginPath(); g.arc(s * 2, -15, 3, 0, 7); g.fill(); g.restore(); }
      ink(() => { g.beginPath(); g.ellipse(0, 0, 8, 10, 0, 0, 7); });
      g.strokeStyle = PAL.enemy; g.lineWidth = 1.5; g.beginPath(); g.moveTo(3, -9); g.quadraticCurveTo(8, -16, 11, -15); g.stroke();
      eye(3, -2, 3.2);
    } else if (this.type === 'puffcap' || this.type === 'tturret') {
      const inflate = 1 + tele * 0.3;
      ink(() => { g.beginPath(); g.roundRect(-8, -14, 16, 14, 4); });
      eye(2, -8, 3);
      g.save(); g.translate(0, -14); g.scale(inflate, inflate);
      g.fillStyle = this.type === 'tturret' ? '#7ab0ff' : '#c04a7a'; g.beginPath(); g.moveTo(-15, 0); g.quadraticCurveTo(-15, -16, 0, -16); g.quadraticCurveTo(15, -16, 15, 0); g.closePath(); g.fill(); g.stroke();
      g.fillStyle = '#ffe6f0'; for (const [x, y, r] of [[-7, -7, 2.5], [3, -11, 2], [8, -5, 2.2]]) { g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); }
      g.restore();
      g.fillStyle = '#0c0a14'; g.beginPath(); g.ellipse(9, -5, 3, 2 + tele * 2, 0, 0, 7); g.fill();
    } else if (this.type === 'knight') {
      const raise = this.st === 'tele' ? -this.tele * 2.2 : this.st === 'swing' ? 1.4 : 0;
      ink(() => { g.beginPath(); g.moveTo(-11, 0); g.lineTo(-12, -24); g.quadraticCurveTo(0, -30, 12, -24); g.lineTo(11, 0); g.closePath(); });
      // kettle helmet
      g.fillStyle = '#9aa6b8'; g.beginPath(); g.moveTo(-12, -24); g.quadraticCurveTo(-13, -40, 0, -41); g.quadraticCurveTo(13, -40, 12, -24); g.closePath(); g.fill(); g.stroke();
      g.fillStyle = '#6a7488'; g.fillRect(-3, -45, 6, 5); g.strokeRect(-3, -45, 6, 5);
      g.fillStyle = '#0c0a14'; g.fillRect(-2, -32, 14, 4); g.fillStyle = eyeC; g.fillRect(4, -31.5, 5, 3);
      // spout
      g.fillStyle = '#9aa6b8'; g.beginPath(); g.moveTo(11, -30); g.lineTo(19, -36); g.lineTo(20, -33); g.lineTo(12, -26); g.fill(); g.stroke();
      // mace arm
      g.save(); g.translate(-4, -20); g.rotate(raise - 0.4); g.strokeStyle = '#5a4030'; g.lineWidth = 3; g.beginPath(); g.moveTo(0, 0); g.lineTo(0, 18); g.stroke(); g.fillStyle = '#c0c8d8'; g.strokeStyle = '#0c0a14'; g.lineWidth = 2; g.beginPath(); g.arc(0, 22, 6, 0, 7); g.fill(); g.stroke(); g.restore();
      if (this.shield) { g.fillStyle = '#c8d2e2'; g.beginPath(); g.ellipse(13, -16, 6, 13, 0, 0, 7); g.fill(); g.stroke(); g.fillStyle = '#e8eef8'; g.beginPath(); g.ellipse(14, -19, 2, 5, 0, 0, 7); g.fill(); }
      if (this.st === 'swing') { g.globalAlpha = 0.6; g.fillStyle = '#ffd0d0'; g.beginPath(); g.arc(8, -20, 44, -1.4, 1.2); g.arc(8, -20, 30, 1.2, -1.4, true); g.fill(); g.globalAlpha = 1; }
    } else if (this.type === 'bomber') {
      ink(() => { g.beginPath(); g.ellipse(0, -11, 12, 12, 0, 0, 7); });
      g.fillStyle = '#7a8a5a'; g.beginPath(); g.roundRect(-9, -26, 18, 7, 3); g.fill(); g.stroke();
      g.strokeStyle = '#d9a35a'; g.lineWidth = 1.6; g.beginPath(); g.moveTo(0, -26); g.quadraticCurveTo(4, -32, 2, -35); g.stroke();
      drawGlow(g, 2, -35, 7 + Math.sin(t * 20) * 2, '#ffd36b', 0.9);
      eye(4, -12, 3.4);
      if (tele > 0) { g.fillStyle = '#3a3048'; g.beginPath(); g.arc(-6, -30 - tele * 6, 6, 0, 7); g.fill(); g.strokeStyle = '#0c0a14'; g.stroke(); drawGlow(g, -6, -36 - tele * 6, 8, '#ff6a3a', 1); }
    } else if (this.type === 'dummy') {
      const wob = Math.sin(t * 12) * this.flash * 1.5;
      g.rotate(wob); g.fillStyle = '#8a6a42'; g.fillRect(-2, -10, 4, 10); g.fillStyle = '#d9c08a'; g.beginPath(); g.ellipse(0, -22, 11, 14, 0, 0, 7); g.fill(); g.stroke();
      g.strokeStyle = '#a0402a'; g.lineWidth = 2; g.beginPath(); g.arc(0, -22, 6, 0, 7); g.stroke(); g.beginPath(); g.arc(0, -22, 1.5, 0, 7); g.stroke();
    }
    g.restore(); }
    if (this.type === 'jelly' && (tele > 0 || this.ring > 0)) { const r = this.ring > 0 ? 30 + this.ring * 55 : 80 * tele; g.strokeStyle = this.ring > 0 ? 'rgba(200,255,255,' + (1 - this.ring) + ')' : 'rgba(255,80,90,' + (0.35 + tele * 0.5) + ')'; g.lineWidth = this.ring > 0 ? 5 : 2.5; g.beginPath(); g.arc(X, this.cy, r, 0, 7); g.stroke(); if (tele > 0) { g.setLineDash([5, 6]); g.strokeStyle = 'rgba(255,80,90,0.5)'; g.beginPath(); g.arc(X, this.cy, 80, 0, 7); g.stroke(); g.setLineDash([]); } }
    if (this.type === 'lurefish' || this.type === 'jelly') drawGlow(g, X + (this.type === 'lurefish' ? this.face * 14 : 0), this.y - (this.type === 'lurefish' ? 4 : -8), 14 + tele * 10, tele > 0 ? '#ff6a7a' : '#9ff6ff', 0.6 + Math.sin(t * 4) * 0.15);
    if (this.flash > 0) drawGlow(g, X, this.cy, Math.max(this.w, this.h) * 0.9, '#ffffff', this.flash * (painted ? 3 : 5));
    if (tele > 0) this.drawBang(g, X, this.y - 16 - (this.type === 'knight' ? 10 : 0), tele); AI.draw(g, this);
    if (this.stun > 0 && this.type !== 'dummy') { for (let i = 0; i < 3; i++) { const a = t * 5 + i * 2.1; g.fillStyle = '#fff6b0'; g.beginPath(); g.arc(X + Math.cos(a) * 12, this.y - 6 + Math.sin(a) * 4, 2.4, 0, 7); g.fill(); } }
    if (this.hp < this.maxHp && this.maxHp < 1e8) { const w = Math.max(24, this.w + 6); g.fillStyle = 'rgba(10,8,20,0.7)'; g.fillRect(X - w / 2, this.y - 9, w, 4); g.fillStyle = '#ff7aa0'; g.fillRect(X - w / 2, this.y - 9, w * this.hp / this.maxHp, 4); }
  }
  drawBang(g, x, y, k) { // the readable "!" warning
    const s = 1 + Math.sin(k * 20) * 0.08; drawGlow(g, x, y, 18, '#ff4a5a', 0.6);
    g.save(); g.translate(x, y); g.scale(s, s); g.fillStyle = '#ff4a5a'; g.strokeStyle = '#fff'; g.lineWidth = 2; g.beginPath(); g.arc(0, 0, 8, 0, 7); g.fill(); g.stroke();
    g.fillStyle = '#fff'; g.fillRect(-1.3, -5, 2.6, 6); g.fillRect(-1.3, 2.4, 2.6, 2.6); g.restore();
  }
}
