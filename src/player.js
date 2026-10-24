// Sprig, the hero: movement, grappling vine, combat, drawing.
import { TILE, clamp, approach, sign, lerp } from './util.js';
import { moveBody, groundBelow, touchingWall, hazardAt } from './physics.js';
import { input, pressed, held, released, vibrate } from './input.js';
import { sfx } from './audio.js';
import { WEAPONS, GADGETS } from './weapons.js';
import { diff, save } from './save.js';
import { PAL, drawGlow } from './art.js';

const C = { RUN: 182, ACC_G: 1750, DEC_G: 2100, ACC_A: 1200, GRAV: 1480, GRAV_FALL: 1720, JUMP: 515, CUT: 0.45, MAXFALL: 600, SLIDE: 115, WJX: 235, WJY: 470, DASH: 470, DASH_T: 0.17, DASH_CD: 0.38 };
export class Player {
  constructor(x, y, stats) {
    this.w = 18; this.h = 34; this.x = x; this.y = y; this.vx = 0; this.vy = 0; this.face = 1;
    this.maxHp = stats.maxHp; this.hp = stats.hp ?? stats.maxHp; this.maxFlasks = stats.maxFlasks; this.flasks = stats.flasks ?? stats.maxFlasks;
    this.weapon = stats.weapon || 'blade'; this.gadgets = stats.gadgets || ['popseed']; this.gcd = [0, 0]; this.hookRange = stats.hookRange || 220;
    this.onGround = false; this.coyote = 0; this.jumpBuf = 0; this.wallDir = 0; this.wallCoyote = 0; this.wallLock = 0; this.airDash = true; this.freeJump = 0;
    this.dashT = 0; this.dashCd = 0; this.dashDir = 1; this.iframes = 0; this.hurtT = 0; this.flash = 0; this.dead = false; this.deadT = 0; this.respawnT = 0;
    this.hook = { s: 'none' }; this.atk = null; this.chargeT = 0; this.charged = false; this.comboT = 0; this.comboIdx = 0; this.queued = false;
    this.parryT = 0; this.parryLock = 0; this.flaskT = 0; this.healLeft = 0;
    this.sx = 1; this.sy = 1; this.runPh = 0; this.stepT = 0; this.t = 0; this.safe = { x, y }; this.hookTarget = null; this.drop = 0; this.mantleT = 0;
    this.scarf = Array.from({ length: 7 }, () => ({ x: x + 9, y: y + 12, px: x + 9, py: y + 12 }));
    this.lastHit = null; this.stats = { jumps: 0, hooks: 0, dashes: 0, attacks: 0, parries: 0, kills: 0 };
  }
  get cx() { return this.x + this.w / 2; } get cy() { return this.y + this.h / 2; }
  get busy() { return this.dead || this.respawnT > 0; }
  update(W, dt) {
    this.t += dt; const D = diff();
    for (const k of ['coyote', 'jumpBuf', 'wallCoyote', 'wallLock', 'dashCd', 'iframes', 'hurtT', 'flash', 'parryT', 'parryLock', 'comboT', 'freeJump', 'drop', 'mantleT']) this[k] = Math.max(0, this[k] - dt);
    this.gcd = this.gcd.map((v) => Math.max(0, v - dt));
    this.sx = lerp(this.sx, 1, Math.min(1, dt * 12)); this.sy = lerp(this.sy, 1, Math.min(1, dt * 12));
    this.updateScarf(dt);
    if (this.dead) { this.deadT += dt; this.vx *= 0.9; return; }
    if (this.respawnT > 0) { this.respawnT -= dt; if (this.respawnT <= 0) { this.x = this.safe.x; this.y = this.safe.y; this.vx = this.vy = 0; this.iframes = 1.2; W.fx.burst(this.cx, this.cy, 16, { color: ['#bff7a0', '#fff'], max: 160, g: -50, life: 0.5 }); } return; }
    const mx = input.mx, my = input.my;
    if (Math.abs(mx) > 0.1 && !this.atk && this.dashT <= 0 && this.hook.s !== 'swing') this.face = sign(mx);
    if (pressed('jump')) this.jumpBuf = D.buffer;
    // healing over time
    if (this.healLeft > 0) { const h = Math.min(this.healLeft, this.maxHp * 0.9 * dt); this.hp = Math.min(this.maxHp, this.hp + h); this.healLeft -= h; }
    if (this.flaskT > 0) this.flaskT -= dt;
    // aim for hook (assist picks the best target)
    this.hookTarget = W.findHookTarget(this, mx, my);
    if (this.hook.s !== 'none') { this.updateHook(W, dt, mx, my); this.postMove(W, dt); return; }
    // actions
    if (pressed('hook') && !this.atk) this.fireHook(W, mx, my);
    if (pressed('dash') && this.dashCd <= 0 && (this.onGround || this.airDash || this.coyote > 0)) this.startDash(W, mx);
    if (pressed('parry') && this.parryLock <= 0 && this.dashT <= 0) { this.parryT = D.parry; this.parryLock = D.parry + 0.14; this.atk = null; this.vx *= 0.3; sfx('block'); W.emit('parryTry'); }
    if (pressed('flask') && this.flasks > 0 && this.flaskT <= 0) { if (this.hp < this.maxHp) { this.flasks--; this.flaskT = 0.45; this.healLeft = this.maxHp * 0.5; sfx('flask'); W.fx.burst(this.cx, this.cy, 20, { color: ['#9ff0ff', '#e8ffff', '#7fe0a0'], g: -120, max: 120, life: 0.8, kind: 'star' }); W.emit('flask'); } else W.fx.text(this.cx, this.y - 6, 'Full!', '#bff', 12); }
    for (let i = 0; i < 2; i++) if (pressed(i ? 'skill2' : 'skill1') && this.gadgets[i] && this.gcd[i] <= 0) { this.gcd[i] = GADGETS[this.gadgets[i]].cd; W.useGadget(this.gadgets[i], this); }
    this.updateAttack(W, dt, mx, my);
    if (this.dashT > 0) {
      this.dashT -= dt; this.vx = this.dashDir * C.DASH; this.vy = 0;
      if (Math.random() < 0.7) W.fx.burst(this.cx - this.dashDir * 8, this.cy + 6, 1, { color: '#e8fff0', min: 10, max: 40, g: 0, life: 0.25, size: 5 });
      if (this.dashT <= 0) this.vx = this.dashDir * C.RUN * 0.9;
    } else {
      // horizontal
      const slow = this.atk ? WEAPONS[this.weapon].moveMul : this.parryLock > 0 ? 0.1 : this.flaskT > 0 ? 0.4 : 1;
      const target = (this.wallLock > 0 ? 0 : mx) * C.RUN * slow;
      if (this.wallLock > 0) { /* keep wall-jump momentum */ }
      else if (this.onGround) this.vx = approach(this.vx, target, (Math.abs(target) > Math.abs(this.vx) ? C.ACC_G : C.DEC_G) * dt);
      else if (Math.abs(this.vx) > C.RUN && sign(this.vx) === sign(target || this.vx) && Math.abs(target) <= Math.abs(this.vx)) this.vx = approach(this.vx, target || sign(this.vx) * C.RUN, (target ? 160 : 520) * dt); // keep fling momentum in the air
      else this.vx = approach(this.vx, target, C.ACC_A * dt);
      if (this.hurtT > 0) this.vx *= 0.98;
      // gravity (lighter at the jump apex while held for floaty control)
      let g = this.vy > 0 ? C.GRAV_FALL : C.GRAV; if (Math.abs(this.vy) < 70 && held('jump')) g *= 0.6;
      if (this.atk && !this.onGround && this.atk.def && this.atk.kind !== 'plunge' && this.atk.phase !== 'rec') g *= 0.35; // brief air-hang when attacking
      this.vy = Math.min(this.vy + g * dt, C.MAXFALL);
      // wall slide
      this.wallDir = 0;
      if (!this.onGround) { for (const d of [-1, 1]) if (touchingWall(W.map, this, d)) this.wallDir = d; }
      if (this.wallDir && !this.onGround && sign(mx) === this.wallDir && this.vy > 0) { this.vy = Math.min(this.vy, C.SLIDE); this.wallCoyote = 0.12; this.wallSide = this.wallDir; if (Math.random() < 0.3) W.fx.burst(this.wallDir > 0 ? this.x + this.w : this.x, this.y + 8, 1, { color: '#cbb', min: 10, max: 30, g: 100, life: 0.3 }); }
      else if (this.wallDir && !this.onGround) { this.wallCoyote = Math.max(this.wallCoyote, 0.06); this.wallSide = this.wallDir; }
      // jump
      if (this.jumpBuf > 0 && !this.atk && this.parryLock <= 0) {
        if (this.onGround || this.coyote > 0 || this.freeJump > 0) this.doJump(W);
        else if (this.wallCoyote > 0) this.doWallJump(W);
      }
      if (released('jump') && this.vy < 0 && !this.wallJumping) this.vy *= C.CUT;
      if (this.vy >= 0) this.wallJumping = false;
      if (pressed('down') && this.onGround && W.map.get(Math.floor(this.cx / TILE), Math.floor((this.y + this.h + 2) / TILE)) === '=') { this.drop = 0.25; this.y += 2; }
    }
    this.postMove(W, dt);
  }
  postMove(W, dt) {
    const wasGround = this.onGround, prevVy = this.vy, prevVx = this.vx;
    const r = moveBody(W.map, this, dt, { drop: this.drop > 0 });
    this.onGround = r.ground || (this.vy >= 0 && !!groundBelow(W.map, this) && this.drop <= 0 && this.hook.s !== 'zip');
    if (this.onGround) { this.coyote = diff().coyote; this.airDash = true; this.wallJumping = false; }
    if (r.ground && !wasGround && prevVy > 160) { this.sy = 0.72; this.sx = 1.25; sfx('land'); W.fx.burst(this.cx, this.y + this.h, 6, { color: '#d9d2c0', min: 30, max: 90, angle: -Math.PI / 2, spread: 1.4, g: 200, life: 0.35 }); }
    // ledge assist: pop up onto a ledge we barely missed
    if (!this.onGround && this.hook.s === 'none' && this.dashT <= 0) {
      const dir = (r.wallL ? -1 : r.wallR ? 1 : 0) || (Math.abs(input.mx) > 0.3 && touchingWall(W.map, this, sign(input.mx)) ? sign(input.mx) : 0);
      if (dir && (sign(input.mx) === dir || Math.abs(prevVx) > 60) && this.vy > -260) this.tryMantle(W, dir);
    }
    if (r.ceil && this.hook.s === 'zip') this.hookArrive(W);
    // safe spot for hazard respawn
    if (this.onGround && r.ground && !r.oneway) {
      const ty = Math.floor((this.y + this.h + 2) / TILE), l = Math.floor((this.x - 10) / TILE), rr = Math.floor((this.x + this.w + 10) / TILE);
      let ok = true; for (let x = l; x <= rr; x++) { if (!W.map.solid(x, ty) || W.map.hazard(x, ty - 1)) ok = false; }
      if (ok) { this.safe.x = this.x; this.safe.y = this.y; }
    }
    // run anim + footsteps
    if (this.onGround && Math.abs(this.vx) > 20) { this.runPh += dt * Math.abs(this.vx) * 0.075; this.stepT -= dt; if (this.stepT <= 0) { this.stepT = 0.28; sfx('step'); } }
    const hz = hazardAt(W.map, this); if (hz && this.respawnT <= 0) W.hazardHit(this, hz);
  }
  tryMantle(W, dir) {
    const tx = Math.floor((dir > 0 ? this.x + this.w + 2 : this.x - 2) / TILE);
    const feet = this.y + this.h;
    for (let ty = Math.floor((feet - 34) / TILE); ty <= Math.floor((feet + 4) / TILE); ty++) {
      const top = ty * TILE;
      if (top < feet - 34 || top > feet + 4) continue;
      if (W.map.solid(tx, ty) && !W.map.solid(tx, ty - 1) && !W.map.solid(tx, ty - 2) && !W.map.solid(Math.floor(this.cx / TILE), Math.floor((top - this.h) / TILE))) {
        this.y = top - this.h; this.x += dir * 6; this.vy = 0; this.vx = dir * 80; this.onGround = true; this.mantleT = 0.15; this.sy = 0.8; this.sx = 1.15; sfx('step'); W.emit('mantle'); return true;
      }
    }
    return false;
  }
  doJump(W) {
    this.vy = -C.JUMP; this.jumpBuf = 0; this.coyote = 0; this.freeJump = 0; this.onGround = false; this.sy = 1.3; this.sx = 0.78; sfx('jump'); this.stats.jumps++; W.emit('jump');
    W.fx.burst(this.cx, this.y + this.h, 5, { color: '#e8e2d0', min: 20, max: 80, angle: Math.PI / 2, spread: 1.2, g: 100, life: 0.3 });
  }
  doWallJump(W) {
    const d = -(this.wallSide || this.wallDir || this.face);
    this.vx = d * C.WJX; this.vy = -C.WJY; this.face = d; this.jumpBuf = 0; this.wallCoyote = 0; this.wallLock = 0.14; this.wallJumping = true; this.airDash = true;
    this.sy = 1.25; this.sx = 0.8; sfx('walljump'); W.emit('walljump');
    W.fx.burst(d > 0 ? this.x : this.x + this.w, this.cy, 6, { color: '#fff', min: 40, max: 120, angle: d > 0 ? 0 : Math.PI, spread: 0.8, g: 0, life: 0.3 });
  }
  startDash(W, mx) {
    this.dashDir = Math.abs(mx) > 0.2 ? sign(mx) : this.face; this.face = this.dashDir; this.dashT = C.DASH_T; this.dashCd = C.DASH_CD; this.iframes = Math.max(this.iframes, 0.26);
    if (!this.onGround) this.airDash = false; this.atk = null; this.sx = 1.35; this.sy = 0.75; sfx('dash'); this.stats.dashes++; W.emit('dash'); vibrate(10);
  }
  // ---------------- grappling vine ----------------
  fireHook(W, mx, my) {
    const t = this.hookTarget; this.stats.hooks++;
    const hx = this.cx + this.face * 6, hy = this.y + 12;
    if (t) { this.hook = { s: 'fly', tgt: t, hx, hy, t: 0 }; sfx('hookThrow'); W.emit('hookThrow'); }
    else { let ax = Math.abs(mx) > 0.2 ? sign(mx) : this.face, ay = my < 0 ? -1 : -0.7; const l = Math.hypot(ax, ay); this.hook = { s: 'miss', hx, hy, dx: ax / l, dy: ay / l, t: 0 }; sfx('hookThrow'); }
  }
  updateHook(W, dt, mx, my) {
    const h = this.hook; h.t += dt; const ox = this.cx, oy = this.y + 10;
    if (h.s === 'miss') { const d = Math.min(1, h.t / 0.12) * this.hookRange * 0.6; const back = h.t > 0.12 ? (h.t - 0.12) / 0.12 : 0; const k = d * (1 - back); h.hx = ox + h.dx * k; h.hy = oy + h.dy * k; if (back >= 1) this.hook = { s: 'none' }; if (h.t > 0.12 && h.t - dt <= 0.12) sfx('hookMiss'); this.freeMove(W, dt, mx); return; }
    if (h.s === 'fly') {
      const tg = h.tgt; const tx = tg.ent ? tg.ent.cx : tg.x, ty = tg.ent ? tg.ent.cy : tg.y; const dx = tx - h.hx, dy = ty - h.hy, d = Math.hypot(dx, dy), sp = 1600 * dt;
      if (tg.ent && tg.ent.dead) { this.hook = { s: 'none' }; return; }
      if (d <= sp) { h.hx = tx; h.hy = ty; this.attachHook(W, tg.ent ? { ...tg, x: tx, y: ty } : tg); } else { h.hx += dx / d * sp; h.hy += dy / d * sp; }
      this.freeMove(W, dt, mx); return;
    }
    if (h.s === 'swing') {
      const ax = h.tgt.x, ay = h.tgt.y;
      if (pressed('jump')) { this.releaseSwing(W, true); return; }
      if (pressed('hook') || pressed('dash')) { this.releaseSwing(W, false); if (pressed('dash')) this.startDash(W, mx); return; }
      if (pressed('attack')) { this.releaseSwing(W, false); this.updateAttack(W, dt, mx, my); return; }
      // reel: auto-shorten toward a comfy length; up/down adjusts
      const want = my < 0 ? 56 : my > 0 ? this.hookRange : Math.min(118, Math.max(64, h.len0 * 0.7));
      h.len = approach(h.len, want, (h.t < 0.35 && h.len > want ? 480 : my ? 200 : 150) * dt); // quick initial reel lifts Sprig off the ground into the arc
      this.vy += C.GRAV * dt; this.vx += mx * 520 * dt; this.vx *= 1 - 0.15 * dt;
      const rx = ox - ax, ry = oy - ay, rl = Math.hypot(rx, ry) || 1;
      // pump: input along the tangent gives energy
      this.face = this.vx > 15 ? 1 : this.vx < -15 ? -1 : this.face;
      moveBody(W.map, this, dt);
      const nx = this.cx - ax, ny = this.y + 10 - ay, nl = Math.hypot(nx, ny);
      if (nl > h.len) { const ux = nx / nl, uy = ny / nl; this.x = ax + ux * h.len - this.w / 2; this.y = ay + uy * h.len - 10; const vr = this.vx * ux + this.vy * uy; if (vr > 0) { this.vx -= vr * ux; this.vy -= vr * uy; } }
      const sp = Math.hypot(this.vx, this.vy); if (sp > 560) { this.vx *= 560 / sp; this.vy *= 560 / sp; }
      h.hx = ax; h.hy = ay; this.airDash = true;
      if (h.t > 0.25 && groundBelow(W.map, this) && Math.abs(this.vx) < 30 && my >= 0) { this.hook = { s: 'none' }; }
      if (h.t > 6) this.releaseSwing(W, false);
      return;
    }
    if (h.s === 'zip') {
      const tg = h.tgt; const tx = tg.ent ? tg.ent.cx : tg.x, ty = tg.ent ? tg.ent.cy : tg.y;
      const dx = tx - this.cx, dy = ty - (this.y + 12), d = Math.hypot(dx, dy);
      const sp = Math.min(640, 200 + h.t * 2600);
      this.vx = dx / (d || 1) * sp; this.vy = dy / (d || 1) * sp; h.hx = tx; h.hy = ty;
      if (Math.random() < 0.6) W.fx.burst(this.cx, this.cy, 1, { color: '#bffaf0', min: 5, max: 30, g: 0, life: 0.25, size: 4 });
      if (d < (tg.ent ? 30 : 20) || h.t > 0.9 || (tg.ent && tg.ent.dead)) this.hookArrive(W);
      else if (h.t > 0.12 && Math.hypot(this.vx, this.vy) < 1) this.hookArrive(W);
      if (pressed('jump') && h.t > 0.08) { this.hookArrive(W); this.doJump(W); }
      return;
    }
    if (h.s === 'retract') { const dx = ox - h.hx, dy = oy - h.hy, d = Math.hypot(dx, dy), sp = 1500 * dt; if (d < sp) this.hook = { s: 'none' }; else { h.hx += dx / d * sp; h.hy += dy / d * sp; } this.freeMove(W, dt, mx); }
  }
  freeMove(W, dt, mx) { this.vx = approach(this.vx, mx * C.RUN, (this.onGround ? C.ACC_G : C.ACC_A) * dt); this.vy = Math.min(this.vy + C.GRAV * dt, C.MAXFALL); }
  attachHook(W, tg) {
    sfx('hookAttach'); vibrate(8); W.fx.burst(tg.x, tg.y, 8, { color: tg.kind === 'zip' ? PAL.zip : PAL.swing, min: 40, max: 140, g: 0, life: 0.3, glow: 1 });
    if (tg.kind === 'swing') { const l = Math.hypot(this.cx - tg.x, this.y + 10 - tg.y); this.hook = { s: 'swing', tgt: tg, len: Math.max(48, l), len0: Math.max(48, l), hx: tg.x, hy: tg.y, t: 0 }; this.vx *= 1.1; if (this.onGround) { this.vy = -240; this.onGround = false; this.vx += sign(tg.x - this.cx) * 60; } W.emit('swing'); }
    else if (tg.kind === 'zip') { this.hook = { s: 'zip', tgt: tg, hx: tg.x, hy: tg.y, t: 0 }; W.emit('zip'); }
    else if (tg.kind === 'enemy') {
      const e = tg.ent;
      if (e.light && !e.boss) { e.yank(this); W.hitEnemy(e, { dmg: 4, kb: 0, hs: 0.04, shake: 0.08, stun: 0.9, src: 'hook' }, this); this.hook = { s: 'retract', hx: tg.x, hy: tg.y, t: 0 }; W.emit('hookEnemy'); }
      else { this.hook = { s: 'zip', tgt: tg, hx: tg.x, hy: tg.y, t: 0, strike: true }; }
    }
  }
  hookArrive(W) {
    const h = this.hook;
    if (h.strike && h.tgt.ent && !h.tgt.ent.dead) { const e = h.tgt.ent; W.hitEnemy(e, { dmg: 14, kb: 260, hs: 0.08, shake: 0.25, stun: 0.4, src: 'hook' }, this); this.vx = -sign(e.cx - this.cx || 1) * 220; this.vy = -330; this.iframes = Math.max(this.iframes, 0.3); W.emit('hookEnemy'); }
    else { this.vx *= 0.35; this.vy = -280; }
    this.freeJump = 0.32; this.airDash = true; this.hook = { s: 'none' }; this.sy = 1.2; this.sx = 0.85;
  }
  releaseSwing(W, boost) {
    if (boost) { this.vy = Math.min(this.vy - 240, -430); this.vx *= 1.15; sfx('jump'); this.sy = 1.3; this.sx = 0.8; W.emit('swingRelease'); }
    this.hook = { s: 'none' }; this.airDash = true; this.wallJumping = true;
  }
  // ---------------- combat ----------------
  updateAttack(W, dt, mx, my) {
    const wpn = WEAPONS[this.weapon];
    if (pressed('attack') && this.parryLock <= 0 && this.dashT <= 0 && this.flaskT <= 0) {
      if (W.tryInteract(this)) { /* used as interact */ }
      else if (!this.atk) this.startAttack(W, my);
      else this.queued = true;
    }
    // charge while holding after the first hit
    if (held('attack') && !this.atk && this.dashT <= 0 && this.parryLock <= 0) {
      this.chargeT += dt; if (this.chargeT > 0.2 && this.chargeT - dt <= 0.2) sfx('charge');
      if (this.chargeT >= 0.62 && !this.charged) { this.charged = true; sfx('charged'); W.fx.ring(this.cx, this.cy, 30, wpn.color, 0.3, 4); W.emit('charged'); }
    }
    if (released('attack') || !held('attack')) {
      if (this.charged && !this.atk) { this.startAttack(W, my, 'heavy'); W.emit('heavy'); }
      this.chargeT = 0; this.charged = false;
    }
    const a = this.atk; if (!a) return;
    a.t += dt;
    if (a.kind === 'plunge') {
      if (a.phase === 'wind' && a.t > 0.08) { a.phase = 'active'; a.t = 0; this.vy = 560; }
      if (a.phase === 'active') { this.vy = 560; this.vx *= 0.9; const box = { x: this.x - 6, y: this.y + this.h - 6, w: this.w + 12, h: 22 }; if (W.attackBox(box, a.def, this, a.hit)) { this.vy = -430; this.atk = null; this.airDash = true; sfx('jump'); return; }
        if (this.onGround) { W.fx.burst(this.cx, this.y + this.h, 10, { color: '#e8e2d0', angle: -Math.PI / 2, spread: 1.4, max: 160, life: 0.35 }); W.fx.shake(0.15); sfx('land'); W.attackBox({ x: this.x - 26, y: this.y + this.h - 18, w: this.w + 52, h: 18 }, a.def, this, a.hit); a.phase = 'rec'; a.t = 0; } }
      if (a.phase === 'rec' && a.t > 0.18) this.atk = null;
      return;
    }
    const d = a.def;
    if (a.phase === 'wind' && a.t >= d.wind) { a.phase = 'active'; a.t = 0; sfx(d.sfx); if (d.lunge && this.onGround) this.vx = this.face * d.lunge * (Math.abs(input.mx) > 0.1 || W.nearestEnemyAhead(this) ? 1 : 0.4);
      if (d.proj) W.spawnArrow(this, d); if (d.quake) W.quake(this, d); }
    if (a.phase === 'active') {
      if (!d.proj) { const box = this.attackRect(d); W.attackBox(box, d, this, a.hit); }
      if (a.t >= d.active) { a.phase = 'rec'; a.t = 0; }
    } else if (a.phase === 'rec') {
      if (this.queued && a.t > d.rec * 0.35 && a.kind === 'combo') { const n = wpn.combo.length; if (a.step + 1 < n) { this.queued = false; this.startAttack(W, my, 'combo', a.step + 1); return; } }
      if (a.t >= d.rec) { this.atk = null; this.comboT = 0.25; this.comboIdx = this.queued ? 0 : a.step + 1; this.queued = false; }
    }
  }
  attackRect(d) { const w = d.w, h = d.h; const x = d.both ? this.cx - w / 2 : this.face > 0 ? this.cx - 4 : this.cx + 4 - w; return { x, y: this.cy - h / 2 + (d.oy || 0), w, h }; }
  startAttack(W, my, kind = 'combo', step = 0) {
    const wpn = WEAPONS[this.weapon]; if (Math.abs(input.mx) > 0.2) this.face = sign(input.mx);
    if (kind === 'combo' && !this.onGround && this.hook.s === 'none') {
      if (my > 0.5 && this.weapon !== 'bow') { this.atk = { kind: 'plunge', phase: 'wind', t: 0, def: { dmg: 16, kb: 200, hs: 0.06, shake: 0.2, breaks: this.weapon === 'hammer' }, hit: new Set() }; this.vy = -120; sfx('swing'); W.emit('attack'); return; }
      this.atk = { kind: 'air', step: 0, phase: 'wind', t: 0, def: wpn.air, hit: new Set() }; this.stats.attacks++; W.emit('attack'); return;
    }
    if (kind === 'combo' && step === 0 && this.comboT > 0 && this.comboIdx < wpn.combo.length) step = this.comboIdx;
    const def = kind === 'heavy' ? wpn.heavy : wpn.combo[step];
    this.atk = { kind, step, phase: 'wind', t: 0, def, hit: new Set() }; this.stats.attacks++;
    this.sx = 1.12; this.sy = 0.9; W.emit('attack');
  }
  hurt(W, dmg, srcX, info = {}) {
    if (this.dead || this.respawnT > 0) return 'none';
    if (this.parryT > 0 && info.parryable !== false) { this.parryT = 0; this.parryLock = 0.12; this.stats.parries++; W.onParry(this, info); return 'parry'; }
    if (W.god) return 'dodge';
    if (this.dashT > 0 || this.iframes > 0) { if (this.dashT > 0 && !this.dodgeShown) { this.dodgeShown = true; W.fx.text(this.cx, this.y - 4, 'dodge!', '#bff7ff', 11); setTimeout(() => (this.dodgeShown = false), 400); } return 'dodge'; }
    const real = Math.max(1, Math.round(dmg * diff().dmgTaken));
    this.hp -= real; this.iframes = 1.0; this.hurtT = 0.22; this.flash = 0.25; this.atk = null; this.hook = { s: 'none' };
    const d = sign(this.cx - srcX) || -this.face; this.vx = d * 230; this.vy = -240; this.lastHit = info;
    W.fx.shake(0.45); W.hitstop(0.08); W.fx.flash = 0.35; W.fx.flashColor = '#ff5a7a'; sfx('hurt'); vibrate(35);
    W.fx.burst(this.cx, this.cy, 10, { color: ['#fff', '#ffd0d8'], max: 200, life: 0.4, kind: 'star', size: 5 });
    W.fx.text(this.cx, this.y - 6, '-' + real, '#ff8aa0', 14);
    if (this.hp <= 0) { this.hp = 0; this.dead = true; this.deadT = 0; W.onPlayerDeath(info); }
    return 'hit';
  }
  updateScarf(dt) {
    const s = this.scarf; const ax = this.cx - this.face * 4, ay = this.y + 13 + (this.sy - 1) * -10;
    s[0].x = ax; s[0].y = ay;
    for (let i = 1; i < s.length; i++) { const p = s[i]; const vx = (p.x - p.px) * 0.9, vy = (p.y - p.py) * 0.9; p.px = p.x; p.py = p.y; p.x += vx - this.face * 8 * dt + Math.sin(this.t * 7 + i) * 0.25; p.y += vy + 150 * dt * dt * 60 * 0.12; }
    for (let k = 0; k < 2; k++) for (let i = 1; i < s.length; i++) { const a = s[i - 1], b = s[i]; const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1, want = 4.2; const f = (d - want) / d; b.x -= dx * f; b.y -= dy * f; }
  }
  // ---------------- drawing ----------------
  draw(g, W) {
    if (this.respawnT > 0) return;
    if (this.iframes > 0 && this.dashT <= 0 && !this.dead && Math.floor(this.t * 20) % 2 === 0 && this.iframes < 0.95) g.globalAlpha = 0.45;
    const t = this.t, f = this.face, X = this.cx, Y = this.y + this.h;
    // vine/hook line
    const h = this.hook;
    if (h.s !== 'none' && h.hx !== undefined) {
      const hx0 = X + f * 7, hy0 = this.y + 16;
      g.strokeStyle = '#2e7a3f'; g.lineWidth = 3.4; g.beginPath(); g.moveTo(hx0, hy0);
      const mxp = (hx0 + h.hx) / 2, myp = (hy0 + h.hy) / 2 + (h.s === 'fly' || h.s === 'miss' ? Math.sin(t * 40) * 6 : 0);
      g.quadraticCurveTo(mxp, myp, h.hx, h.hy); g.stroke(); g.strokeStyle = '#8fe07a'; g.lineWidth = 1.4; g.stroke();
      // leaves along the vine
      g.fillStyle = '#6fcf5a'; for (let i = 1; i < 4; i++) { const k = i / 4; const lx = lerp(hx0, h.hx, k), ly = lerp(hy0, h.hy, k); g.beginPath(); g.ellipse(lx, ly - 2, 3.5, 1.8, k * 3 + t, 0, 7); g.fill(); }
      g.fillStyle = '#d9a35a'; g.beginPath(); g.arc(h.hx, h.hy, 4, 0, 7); g.fill(); g.strokeStyle = PAL.ink; g.lineWidth = 1.5; g.stroke();
    }
    // scarf
    g.strokeStyle = PAL.scarf; g.lineWidth = 4.5; g.lineCap = 'round'; g.beginPath(); g.moveTo(this.scarf[0].x, this.scarf[0].y); for (const p of this.scarf) g.lineTo(p.x, p.y); g.stroke();
    g.strokeStyle = '#ffc77a'; g.lineWidth = 1.5; g.stroke();
    g.save(); g.translate(X, Y);
    let lean = clamp(this.vx / 900, -0.18, 0.18); if (h.s === 'swing') lean = Math.atan2(h.hx - X, -(h.hy - this.cy)) * 0.6;
    if (this.dead) { lean = 0; g.rotate(Math.min(1.4, this.deadT * 4) * -f); }
    g.rotate(lean); g.scale(this.sx * f, this.sy);
    const run = this.onGround && Math.abs(this.vx) > 20, ph = this.runPh;
    const bob = run ? Math.abs(Math.sin(ph)) * -2.5 : Math.sin(t * 2.4) * 0.8;
    // legs
    g.fillStyle = '#3a2f45'; g.strokeStyle = PAL.ink; g.lineWidth = 2;
    const leg = (o, ph2) => { const lx = run ? Math.sin(ph2) * 6 : 0, ly = run ? Math.max(0, -Math.cos(ph2)) * -4 : 0; const air = !this.onGround ? -3 : 0; g.beginPath(); g.roundRect(-3 + o + lx - 3, -9 + ly + air, 6, 9, 2); g.fill(); g.stroke(); g.fillStyle = '#6b4a3a'; g.beginPath(); g.ellipse(o + lx + 1, -1 + ly + air, 4.5, 2.6, 0, 0, 7); g.fill(); g.stroke(); g.fillStyle = '#3a2f45'; };
    leg(-4, ph); leg(4, ph + Math.PI);
    g.translate(0, bob);
    // cloak body
    const sway = clamp(-this.vx / 300, -1, 1) * 4 + Math.sin(t * 3) * 1;
    g.fillStyle = PAL.heroDk; g.beginPath(); g.moveTo(-6, -32); g.quadraticCurveTo(-14, -18, -12 + sway, -6); g.quadraticCurveTo(-6, -3, -2 + sway, -7); g.quadraticCurveTo(3, -2, 8 + sway, -6); g.quadraticCurveTo(13, -14, 6, -32); g.closePath(); g.fill(); g.lineWidth = 2.2; g.stroke();
    g.fillStyle = PAL.hero; g.beginPath(); g.moveTo(-5, -31); g.quadraticCurveTo(-10, -18, -8 + sway * 0.6, -9); g.quadraticCurveTo(0, -6, 6 + sway * 0.6, -9); g.quadraticCurveTo(9, -18, 5, -31); g.closePath(); g.fill();
    // leaf pattern
    g.strokeStyle = PAL.heroDk; g.lineWidth = 1; g.beginPath(); g.moveTo(0, -27); g.lineTo(0, -10); g.moveTo(0, -20); g.lineTo(-4, -16); g.moveTo(0, -16); g.lineTo(4, -12); g.stroke();
    // arm + gauntlet
    const atk = this.atk; let armA = 0.3 + Math.sin(ph) * (run ? 0.5 : 0.05);
    if (atk) { const prog = atk.phase === 'wind' ? -1 : atk.phase === 'active' ? 1 : 0.6; armA = atk.kind === 'plunge' ? 1.5 : prog < 0 ? -2.2 : 1.2 + (atk.step % 2) * -0.4; }
    if (this.chargeT > 0.2) armA = -2.4 + Math.sin(t * 40) * 0.05;
    if (this.parryLock > 0) armA = -0.3;
    if (h.s !== 'none') armA = -Math.atan2(h.hx - X, -(h.hy - this.cy)) * f + (f > 0 ? 0 : 0);
    g.save(); g.translate(3, -24); g.rotate(armA);
    this.drawWeapon(g, atk);
    g.fillStyle = '#c47a3a'; g.beginPath(); g.roundRect(-3, 0, 6, 11, 3); g.fill(); g.strokeStyle = PAL.ink; g.lineWidth = 1.8; g.stroke();
    g.restore();
    // head + hood
    g.translate(0, -36);
    g.fillStyle = PAL.heroDk; g.beginPath(); g.ellipse(0, 0, 11.5, 11, 0, 0, 7); g.fill(); g.strokeStyle = PAL.ink; g.lineWidth = 2.2; g.stroke();
    g.fillStyle = PAL.hero; g.beginPath(); g.ellipse(-1, -2, 10, 9, 0, 0, 7); g.fill();
    // sprout on hood
    const sp = Math.sin(t * 4) * 0.2 - clamp(this.vx / 600, -0.4, 0.4);
    g.save(); g.translate(-2, -10); g.rotate(sp - 0.3); g.strokeStyle = '#2e7a3f'; g.lineWidth = 2; g.beginPath(); g.moveTo(0, 0); g.lineTo(0, -7); g.stroke(); g.fillStyle = '#8fe07a'; g.beginPath(); g.ellipse(-4, -8, 5, 2.6, -0.5, 0, 7); g.fill(); g.beginPath(); g.ellipse(4, -9, 5, 2.6, 0.5, 0, 7); g.fill(); g.restore();
    // face
    g.fillStyle = PAL.skin; g.beginPath(); g.ellipse(3, 1.5, 7, 6.5, 0, 0, 7); g.fill();
    const blink = (t % 3.3) < 0.1;
    g.fillStyle = PAL.ink;
    if (this.dead) { g.lineWidth = 1.5; g.strokeStyle = PAL.ink; for (const ex of [1, 6.5]) { g.beginPath(); g.moveTo(ex - 2, -1); g.lineTo(ex + 2, 3); g.moveTo(ex + 2, -1); g.lineTo(ex - 2, 3); g.stroke(); } }
    else if (blink) { g.fillRect(0, 1, 3.5, 1.2); g.fillRect(5.5, 1, 3.5, 1.2); }
    else { g.beginPath(); g.ellipse(1.8, 1, 1.9, 2.6, 0, 0, 7); g.fill(); g.beginPath(); g.ellipse(7, 1, 1.9, 2.6, 0, 0, 7); g.fill(); g.fillStyle = '#fff'; g.fillRect(2.2, -0.6, 1, 1); g.fillRect(7.4, -0.6, 1, 1); }
    g.fillStyle = 'rgba(255,120,120,0.35)'; g.beginPath(); g.arc(9, 4.5, 1.6, 0, 7); g.fill();
    g.restore(); g.globalAlpha = 1;
    // charge glow + parry shield
    if (this.chargeT > 0.2) drawGlow(g, X + f * 10, this.cy - 4, 14 + (this.charged ? 10 + Math.sin(t * 30) * 3 : this.chargeT * 12), WEAPONS[this.weapon].color, this.charged ? 0.9 : 0.5);
    if (this.parryT > 0 || this.parryLock > 0.1) { g.strokeStyle = '#bfefff'; g.lineWidth = 3; g.globalAlpha = this.parryT > 0 ? 0.95 : 0.4; g.beginPath(); g.arc(X, this.cy, 24, f > 0 ? -1.2 : Math.PI - 1.2 + 0.0, f > 0 ? 1.2 : Math.PI + 1.2); g.stroke(); drawGlow(g, X + f * 18, this.cy, 22, '#9fe8ff', 0.5); g.globalAlpha = 1; }
    if (this.flash > 0) { drawGlow(g, X, this.cy, 30, '#ff7090', this.flash * 2); }
    // attack smear
    if (atk && atk.phase === 'active' && atk.def && !atk.def.proj && atk.kind !== 'plunge') this.drawSmear(g, atk);
    if (atk && atk.kind === 'plunge' && atk.phase === 'active') { g.fillStyle = 'rgba(255,255,255,0.5)'; g.beginPath(); g.moveTo(this.x - 4, this.y); g.lineTo(this.x + this.w + 4, this.y); g.lineTo(X, this.y + this.h + 16); g.fill(); }
  }
  drawWeapon(g, atk) {
    g.save(); g.translate(0, 10);
    const w = this.weapon; g.strokeStyle = PAL.ink; g.lineWidth = 1.8;
    if (w === 'blade') { g.fillStyle = '#d8e6f0'; g.beginPath(); g.moveTo(-2.5, 0); g.lineTo(2.5, 0); g.lineTo(2, 22); g.lineTo(0, 26); g.lineTo(-2, 22); g.closePath(); g.fill(); g.stroke(); g.fillStyle = '#b8783a'; g.fillRect(-5, -1, 10, 3); }
    else if (w === 'hammer') { g.fillStyle = '#8a6a4a'; g.fillRect(-1.5, 0, 3, 20); g.fillStyle = '#ffc06a'; g.beginPath(); g.roundRect(-8, 17, 16, 10, 2); g.fill(); g.stroke(); g.fillStyle = '#c48a3a'; g.beginPath(); g.arc(0, 22, 2.5, 0, 7); g.fill(); }
    else if (w === 'bow') { g.strokeStyle = '#a6e47a'; g.lineWidth = 3; g.beginPath(); g.arc(-4, 8, 13, -1.1, 1.1); g.stroke(); g.strokeStyle = '#fff'; g.lineWidth = 1; g.beginPath(); g.moveTo(-4 + 13 * Math.cos(-1.1), 8 + 13 * Math.sin(-1.1)); g.lineTo(-4 + 13 * Math.cos(1.1) - (this.chargeT > 0.2 ? 6 : 0), 8); g.lineTo(-4 + 13 * Math.cos(1.1), 8 + 13 * Math.sin(1.1)); g.stroke(); }
    else if (w === 'whip') { g.strokeStyle = '#2e7a3f'; g.lineWidth = 3; g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(6, 10, 0, 18); g.stroke(); g.fillStyle = '#7fe0a0'; g.beginPath(); g.arc(0, 18, 3, 0, 7); g.fill(); }
    g.restore();
  }
  drawSmear(g, atk) {
    const d = atk.def, r = this.attackRect(d), k = atk.t / d.active, col = WEAPONS[this.weapon].color;
    g.save(); g.globalAlpha = 0.85 * (1 - k * 0.7);
    if (d.arc === 5 || (this.weapon === 'whip' && !d.both)) { // whip: long wavy lash
      g.strokeStyle = '#7fe0a0'; g.lineWidth = 4; g.beginPath(); const x0 = this.cx, y0 = this.cy - 6; g.moveTo(x0, y0);
      const L = d.w * Math.min(1, k * 2.5), dir = this.face; g.bezierCurveTo(x0 + dir * L * 0.3, y0 - 18, x0 + dir * L * 0.7, y0 + 14, x0 + dir * L, y0 + (d.oy || 0)); g.stroke();
      g.fillStyle = '#eaffc0'; g.beginPath(); g.arc(x0 + dir * L, y0 + (d.oy || 0), 4, 0, 7); g.fill();
    } else if (d.both) { g.strokeStyle = col; g.lineWidth = 6; g.beginPath(); g.ellipse(this.cx, r.y + r.h / 2, r.w / 2 * (0.5 + k * 0.5), r.h / 2, 0, 0, 7); g.stroke(); }
    else {
      const cx = this.cx, cy = this.cy + (d.oy || 0), R = d.w * 0.9, f = this.face, dir = (atk.step % 2 === 0) ? 1 : -1;
      const a0 = -1.3 * dir, a1 = 1.2 * dir; const s = a0 + (a1 - a0) * Math.min(1, k * 1.6);
      g.fillStyle = col; g.beginPath();
      for (let i = 0; i <= 10; i++) { const a = a0 + (s - a0) * i / 10; g.lineTo(cx + Math.cos(a) * R * f, cy + Math.sin(a) * R * 0.75); }
      for (let i = 10; i >= 0; i--) { const a = a0 + (s - a0) * i / 10; const rr = R * (0.55 + 0.25 * (i / 10)); g.lineTo(cx + Math.cos(a) * rr * f, cy + Math.sin(a) * rr * 0.75); }
      g.closePath(); g.fill();
      g.globalAlpha *= 0.6; g.fillStyle = '#fff'; g.beginPath(); for (let i = 0; i <= 10; i++) { const a = a0 + (s - a0) * i / 10; g.lineTo(cx + Math.cos(a) * R * f, cy + Math.sin(a) * R * 0.75); } for (let i = 10; i >= 0; i--) { const a = a0 + (s - a0) * i / 10; g.lineTo(cx + Math.cos(a) * R * 0.9 * f, cy + Math.sin(a) * R * 0.9 * 0.75); } g.fill();
    }
    g.restore();
  }
}
