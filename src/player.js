// Sprig, the hero: movement, grappling vine, combat, drawing.
import { TILE, clamp, approach, sign, lerp } from './util.js';
import { moveBody, groundBelow, touchingWall, hazardAt } from './physics.js';
import { input, pressed, held, released, vibrate } from './input.js';
import { sfx } from './audio.js';
import { WEAPONS, GADGETS } from './weapons.js';
import { diff, save } from './save.js';
import { PAL, drawGlow } from './art.js';
import { G, has, spr, sprAspect, shaded, heroFlash } from './gfx.js';

const C = { RUN: 182, ACC_G: 1750, DEC_G: 2100, ACC_A: 1200, GRAV: 1480, GRAV_FALL: 1720, JUMP: 515, CUT: 0.45, MAXFALL: 600, SLIDE: 115, WJX: 235, WJY: 470, DASH: 470, DASH_T: 0.17, DASH_CD: 0.38 };
export const HERO_K = 1.22; // v1.2 visual scale of the hero rig around the feet (hitbox unchanged)
export const HERO_PX = 47 / 223; // v1.3 world units per painted-frame pixel (idle frame = 44 units tall before HERO_K)
// front-fist anchor in frame pixels per painted pose (weapon grip); measured from the annotated sheets
const RUN_BOB = { run3: 16, run7: 16, run2: 5, run6: 5, jump: 0 }; // frame px the body floats above the feet line
const FIST = { slash1: [170, 73], slash2: [124, 23], thrust: [169, 70], hwind: [123, 29], slam: [141, 139], parry: [120, 50], airatk: [150, 60], throw: [161, 45], swing: [81, 11] };
export class Player {
  constructor(x, y, stats) {
    this.w = 18; this.h = 34; this.x = x; this.y = y; this.vx = 0; this.vy = 0; this.face = 1;
    this.maxHp = stats.maxHp; this.hp = stats.hp ?? stats.maxHp; this.maxFlasks = stats.maxFlasks; this.flasks = stats.flasks ?? stats.maxFlasks;
    this.weapon = stats.weapon || 'blade'; this.gadgets = stats.gadgets || ['popseed']; this.gcd = [0, 0]; this.hookRange = stats.hookRange || 220;
    this.onGround = false; this.coyote = 0; this.jumpBuf = 0; this.wallDir = 0; this.wallCoyote = 0; this.wallLock = 0; this.airDash = true; this.freeJump = 0;
    this.dashT = 0; this.dashCd = 0; this.dashDir = 1; this.iframes = 0; this.hurtT = 0; this.flash = 0; this.dead = false; this.deadT = 0; this.respawnT = 0;
    this.hook = { s: 'none' }; this.atk = null; this.chargeT = 0; this.charged = false; this.comboT = 0; this.comboIdx = 0; this.queued = false; this.airHang = 0; this.hookBuf = 0;
    this.parryT = 0; this.parryLock = 0; this.flaskT = 0; this.healLeft = 0;
    this.sx = 1; this.sy = 1; this.runPh = 0; this.stepT = 0; this.t = 0; this.safe = { x, y }; this.hookTarget = null; this.drop = 0; this.mantleT = 0;
    this.scarf = Array.from({ length: 7 }, () => ({ x: x + 9, y: y + 12, px: x + 9, py: y + 12 }));
    this.lastHit = null; this.stats = { jumps: 0, hooks: 0, dashes: 0, attacks: 0, parries: 0, kills: 0 };
  }
  get cx() { return this.x + this.w / 2; } get cy() { return this.y + this.h / 2; }
  get busy() { return this.dead || this.respawnT > 0; }
  update(W, dt) {
    this.t += dt; const D = diff();
    for (const k of ['coyote', 'jumpBuf', 'wallCoyote', 'wallLock', 'dashCd', 'iframes', 'hurtT', 'flash', 'parryT', 'parryLock', 'comboT', 'freeJump', 'drop', 'mantleT', 'hookBuf']) this[k] = Math.max(0, this[k] - dt);
    this.gcd = this.gcd.map((v) => Math.max(0, v - dt));
    this.sx = lerp(this.sx, 1, Math.min(1, dt * 12)); this.sy = lerp(this.sy, 1, Math.min(1, dt * 12));
    this.updateScarf(dt);
    if (this.dead) { this.deadT += dt; this.vx *= 0.9; return; }
    if (this.respawnT > 0) { this.respawnT -= dt; if (this.respawnT <= 0) { this.x = this.safe.x; this.y = this.safe.y; this.vx = this.vy = 0; this.iframes = 1.2; W.fx.burst(this.cx, this.cy, 16, { color: ['#bff7a0', '#fff'], max: 160, g: -50, life: 0.5 }); } return; }
    const mx = input.mx, my = input.my;
    if (Math.abs(mx) > 0.1 && (!this.atk || this.atk.phase === 'rec') && this.dashT <= 0 && this.hook.s !== 'swing') this.face = sign(mx); // v1.4: can turn during attack recovery
    if (pressed('jump')) this.jumpBuf = D.buffer;
    if (pressed('hook')) this.hookBuf = 0.16; // v1.4: buffered hook (fires as soon as an attack can be cancelled / after a zip)
    if (this.jumpBuf > 0 && !this.canCancel()) this.jumpBuf = Math.max(this.jumpBuf, dt * 2); // keep a jump pressed mid-swing alive until recovery
    // healing over time
    if (this.healLeft > 0) { const h = Math.min(this.healLeft, this.maxHp * 0.9 * dt); this.hp = Math.min(this.maxHp, this.hp + h); this.healLeft -= h; }
    if (this.flaskT > 0) this.flaskT -= dt;
    // aim for hook (assist picks the best target)
    this.hookTarget = W.findHookTarget(this, mx, my);
    if (this.hook.s !== 'none') { this.updateHook(W, dt, mx, my); if (this.hook.s === 'swing' || this.hook.s === 'none') this.updateAttack(W, dt, mx, my); this.postMove(W, dt); return; }
    // actions
    if (this.hookBuf > 0 && this.canCancel()) { this.atk = null; this.queued = false; this.hookBuf = 0; this.fireHook(W, mx, my); } // v1.4: hook cancels attack recovery / air attacks
    if (pressed('dash') && this.dashCd <= 0 && (this.onGround || this.airDash || this.coyote > 0)) this.startDash(W, mx);
    if (pressed('parry') && this.parryLock <= 0 && this.dashT <= 0) { this.parryT = D.parry; this.parryLock = D.parry + 0.14; this.atk = null; this.vx *= 0.3; sfx('block'); W.emit('parryTry'); }
    if (pressed('flask') && this.flasks > 0 && this.flaskT <= 0) { if (this.hp < this.maxHp) { this.flasks--; this.flaskT = 0.45; this.healLeft = this.maxHp * 0.5; sfx('flask'); W.fx.burst(this.cx, this.cy, 20, { color: ['#9ff0ff', '#e8ffff', '#7fe0a0'], g: -120, max: 120, life: 0.8, kind: 'star' }); W.emit('flask'); } else W.fx.text(this.cx, this.y - 6, 'Full!', '#bff', 12); }
    for (let i = 0; i < 2; i++) if (pressed(i ? 'skill2' : 'skill1') && this.gadgets[i] && this.gcd[i] <= 0) { this.gcd[i] = GADGETS[this.gadgets[i]].cd; W.useGadget(this.gadgets[i], this); }
    if (pressed('attack') && this.jumpBuf > 0 && !this.atk && (this.onGround || this.coyote > 0) && this.parryLock <= 0 && this.dashT <= 0) this.doJump(W); // jump+attack on the same frame -> jump first, then an air swing
    this.updateAttack(W, dt, mx, my);
    if (this.dashT > 0) {
      this.dashT -= dt; this.vx = this.dashDir * C.DASH; this.vy = 0;
      if (Math.random() < 0.7) W.fx.burst(this.cx - this.dashDir * 8, this.cy + 6, 1, { color: '#e8fff0', min: 10, max: 40, g: 0, life: 0.25, size: 5 });
      if (this.dashT <= 0) this.vx = this.dashDir * C.RUN * 0.9;
    } else {
      // horizontal
      const mm = WEAPONS[this.weapon].moveMul, slow = this.atk ? (!this.onGround ? 1 : this.atk.phase === 'rec' ? Math.max(mm, 0.85) : Math.max(mm, mm * 0.5 + 0.35)) : this.parryLock > 0 ? 0.1 : this.flaskT > 0 ? 0.4 : 1;
      const target = mx * C.RUN * slow;
      if (this.wallLock > 0) { if (mx && sign(mx) !== sign(this.vx)) this.vx = approach(this.vx, target, C.ACC_A * 0.45 * dt); } // v1.4: wall-jump keeps its kick but a stick back toward the wall is honoured gently
      else if (this.onGround) this.vx = approach(this.vx, target, (Math.abs(target) > Math.abs(this.vx) ? C.ACC_G : this.atk ? C.DEC_G * 0.55 : C.DEC_G) * dt);
      else if (Math.abs(this.vx) > C.RUN && sign(this.vx) === sign(target || this.vx) && Math.abs(target) <= Math.abs(this.vx)) this.vx = approach(this.vx, target || sign(this.vx) * C.RUN, (target ? 160 : 520) * dt); // keep fling momentum in the air
      else this.vx = approach(this.vx, target, C.ACC_A * dt);
      if (this.hurtT > 0) this.vx *= 0.98;
      // gravity (lighter at the jump apex while held for floaty control)
      let g = this.vy > 0 ? C.GRAV_FALL : C.GRAV; if (Math.abs(this.vy) < 70 && held('jump')) g *= 0.6;
      if (this.atk && !this.onGround && this.atk.kind === 'air' && this.atk.phase !== 'rec' && this.vy > 0 && (this.airHang += dt) < 0.22) g *= 0.7; // v1.4: only a tiny hang (keeps momentum + gravity)
      this.vy = Math.min(this.vy + g * dt, C.MAXFALL);
      // wall slide
      this.wallDir = 0;
      if (!this.onGround) { for (const d of [-1, 1]) if (touchingWall(W.map, this, d)) this.wallDir = d; }
      if (this.wallDir && !this.onGround && sign(mx) === this.wallDir && this.vy > 0) { this.vy = Math.min(this.vy, C.SLIDE); this.wallCoyote = 0.12; this.wallSide = this.wallDir; if (Math.random() < 0.3) W.fx.burst(this.wallDir > 0 ? this.x + this.w : this.x, this.y + 8, 1, { color: '#cbb', min: 10, max: 30, g: 100, life: 0.3 }); }
      else if (this.wallDir && !this.onGround) { this.wallCoyote = Math.max(this.wallCoyote, 0.06); this.wallSide = this.wallDir; }
      // jump
      if (this.jumpBuf > 0 && this.parryLock <= 0 && this.canCancel()) { // v1.4: jump cancels attack recovery
        const can = this.onGround || this.coyote > 0 || this.freeJump > 0 || this.wallCoyote > 0;
        if (can && this.atk && this.atk.kind !== 'air') { this.atk = null; this.queued = false; }
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
    const r = moveBody(W.map, this, dt, { drop: this.drop > 0, corner: this.vy < -120 });
    this.onGround = r.ground || (this.vy >= 0 && !!groundBelow(W.map, this) && this.drop <= 0 && this.hook.s !== 'zip');
    if (this.onGround) { this.coyote = diff().coyote; this.airDash = true; this.wallJumping = false; this.airHang = 0; if (!wasGround && this.atk && this.atk.kind === 'air' && this.atk.phase !== 'active') { this.atk = null; } } // landing cancels an air swing cleanly
    if (r.ground && !wasGround && prevVy > 160) { this.sy = 0.72; this.sx = 1.25; sfx('land'); W.fx.dust(this.cx, this.y + this.h, prevVy > 420 ? 8 : 5, { speed: 50 + Math.min(80, prevVy * 0.12), size: prevVy > 420 ? 5 : 3.8, life: 0.5 }); W.fx.burst(this.cx, this.y + this.h, 4, { color: '#d9d2c0', min: 30, max: 90, angle: -Math.PI / 2, spread: 1.4, g: 200, life: 0.35 }); }
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
    if (this.onGround && Math.abs(this.vx) > 20) { this.runPh += dt * Math.abs(this.vx) * 0.075; this.stepT -= dt; if (this.stepT <= 0) { this.stepT = 0.28; sfx('step'); if (Math.abs(this.vx) > 120) W.fx.dust(this.cx - sign(this.vx) * 4, this.y + this.h, 2, { dir: -sign(this.vx), speed: 40, size: 3.2, life: 0.4 }); } }
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
    if ((h.s === 'miss' || h.s === 'retract') && pressed('attack')) { this.hook = { s: 'none' }; return; } // v1.4: attack cancels hook recovery
    if ((h.s === 'fly' || h.s === 'zip') && pressed('attack')) h.slash = true; // hook slash / buffered strike on arrival
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
      if (pressed('hook')) { this.hookBuf = 0; const t2 = this.hookTarget; if (t2 && t2 !== h.tgt) { this.hook = { s: 'fly', tgt: t2, hx: h.hx, hy: h.hy, t: 0 }; sfx('hookThrow'); this.stats.hooks++; W.emit('hookThrow'); return; } this.releaseSwing(W, false); return; } // v1.4: re-hook chains straight to the next anchor
      if (pressed('dash')) { this.releaseSwing(W, false); this.startDash(W, mx); return; }
      // v1.4: attacking no longer drops the swing (updateAttack runs after this branch)
      if (h.pop > 0) { const k = Math.min(h.pop, dt); this.vy -= 3000 * k; h.pop -= k; }
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
      const sp = Math.hypot(this.vx, this.vy); if (sp > 560) { const k = Math.max(560 / sp, 1 - 4 * dt); this.vx *= k; this.vy *= k; } // soft speed cap (no snap)
      h.hx = ax; h.hy = ay; this.airDash = true;
      if (h.t > 0.25 && groundBelow(W.map, this) && Math.abs(this.vx) < 30 && my >= 0) { this.hook = { s: 'none' }; }
      if (h.t > 6) this.releaseSwing(W, false);
      return;
    }
    if (h.s === 'zip') {
      const tg = h.tgt; const tx = tg.ent ? tg.ent.cx : tg.x, ty = tg.ent ? tg.ent.cy : tg.y;
      const dx = tx - this.cx, dy = ty - (this.y + 12), d = Math.hypot(dx, dy);
      if (h.v0 == null) h.v0 = Math.max(120, (this.vx * dx + this.vy * dy) / (d || 1));
      const sp = Math.min(640, h.v0 + h.t * 2600) * Math.max(0.5, Math.min(1, d / 70)); // v1.4: ramps from current speed, eases out near the target
      this.vx = dx / (d || 1) * sp; this.vy = dy / (d || 1) * sp; h.hx = tx; h.hy = ty;
      if (Math.random() < 0.6) W.fx.burst(this.cx, this.cy, 1, { color: '#bffaf0', min: 5, max: 30, g: 0, life: 0.25, size: 4 });
      if (d < (tg.ent ? 30 : 20) || h.t > 0.9 || (tg.ent && tg.ent.dead)) this.hookArrive(W);
      else if (h.t > 0.12 && Math.hypot(this.vx, this.vy) < 1) this.hookArrive(W);
      if (pressed('jump') && h.t > 0.08) { this.hookArrive(W); this.doJump(W); }
      return;
    }
    if (h.s === 'retract') { const dx = ox - h.hx, dy = oy - h.hy, d = Math.hypot(dx, dy), sp = 1500 * dt; if (d < sp) this.hook = { s: 'none' }; else { h.hx += dx / d * sp; h.hy += dy / d * sp; } this.freeMove(W, dt, mx); }
  }
  freeMove(W, dt, mx) { if (!this.onGround && Math.abs(this.vx) > C.RUN && sign(mx || this.vx) === sign(this.vx)) this.vx = approach(this.vx, sign(this.vx) * C.RUN, 160 * dt); else this.vx = approach(this.vx, mx * C.RUN, (this.onGround ? C.ACC_G : C.ACC_A) * dt); this.vy = Math.min(this.vy + C.GRAV * dt, C.MAXFALL); }
  attachHook(W, tg) {
    sfx('hookAttach'); vibrate(8); W.fx.burst(tg.x, tg.y, 8, { color: tg.kind === 'zip' ? PAL.zip : PAL.swing, min: 40, max: 140, g: 0, life: 0.3, glow: 1 });
    if (tg.kind === 'swing') { const l = Math.hypot(this.cx - tg.x, this.y + 10 - tg.y); this.hook = { s: 'swing', tgt: tg, len: Math.max(48, l), len0: Math.max(48, l), hx: tg.x, hy: tg.y, t: 0 }; if (this.onGround) { this.hook.pop = 0.08; this.vy = Math.min(this.vy, -40); this.onGround = false; this.vx += sign(tg.x - this.cx) * 40; } W.emit('swing'); }
    else if (tg.kind === 'zip') { this.hook = { s: 'zip', tgt: tg, hx: tg.x, hy: tg.y, t: 0 }; W.emit('zip'); }
    else if (tg.kind === 'enemy') {
      const e = tg.ent;
      if (e.light && !e.boss) { W.hitEnemy(e, { dmg: 4, kb: 0, hs: 0.04, shake: 0.08, stun: 0.9, src: 'hook' }, this); e.yank(this); /* v1.4: yank after the hit (the kb:0 hit used to cancel the pull) */ this.hook = { s: 'retract', hx: tg.x, hy: tg.y, t: 0 }; W.emit('hookEnemy'); }
      else { this.hook = { s: 'zip', tgt: tg, hx: tg.x, hy: tg.y, t: 0, strike: true }; }
    }
  }
  hookArrive(W) {
    const h = this.hook;
    let slash = false;
    if (h.strike && h.tgt.ent && !h.tgt.ent.dead) { const e = h.tgt.ent; slash = !!h.slash; this.face = sign(e.cx - this.cx || this.face); W.hitEnemy(e, slash ? { dmg: 22, kb: 320, hs: 0.1, shake: 0.3, stun: 0.6, src: 'hook' } : { dmg: 14, kb: 260, hs: 0.08, shake: 0.25, stun: 0.4, src: 'hook' }, this); this.vx = -this.face * (slash ? 150 : 200); this.vy = -300; this.iframes = Math.max(this.iframes, 0.3); W.emit('hookEnemy'); if (slash) { sfx('swing'); W.fx.ring(e.cx, e.cy, 26, WEAPONS[this.weapon].color, 0.25, 5); } }
    else { this.vx *= 0.75; this.vy = Math.min(this.vy * 0.75, -200); } // v1.4: keeps the zip's direction instead of snapping
    this.freeJump = 0.32; this.airDash = true; this.hook = { s: 'none' }; this.sy = 1.2; this.sx = 0.85;
    if (h.slash && !slash) { this.atk = null; this.startAttack(W, input.my); } // buffered attack fires on arrival
    if (slash) { this.atk = { kind: 'air', step: 0, phase: 'active', t: 0, wind: 0, def: WEAPONS[this.weapon].air, hit: new Set([h.tgt.ent]), slash: true }; this.stats.attacks++; }
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
    if (a.phase === 'wind' && a.t >= (a.wind ?? d.wind)) { a.phase = 'active'; a.t = 0; sfx(d.sfx); if (d.lunge && this.onGround) { const lv = d.lunge * (Math.abs(input.mx) > 0.1 || W.nearestEnemyAhead(this) ? 1 : 0.4); this.vx = this.face * Math.max(lv, sign(this.vx) === this.face ? Math.abs(this.vx) : 0); } // lunge never slows a running swing
      if (d.proj) W.spawnArrow(this, d); if (d.quake) W.quake(this, d); }
    if (a.phase === 'active') {
      if (!d.proj) { const box = this.attackRect(d); W.attackBox(box, d, this, a.hit); }
      if (a.t >= d.active) { a.phase = 'rec'; a.t = 0; }
    } else if (a.phase === 'rec') {
      if (this.queued && a.t > d.rec * 0.35 && a.kind === 'combo') { const n = wpn.combo.length; if (a.step + 1 < n) { this.queued = false; this.startAttack(W, my, 'combo', a.step + 1); return; } }
      if (this.queued && a.t > d.rec * 0.45 && a.kind === 'air') { this.queued = false; this.atk = null; this.startAttack(W, my); return; } // chained air swings
      if (a.t >= d.rec) { this.atk = null; this.comboT = 0.25; this.comboIdx = a.step + 1; if (this.queued) { this.queued = false; this.comboIdx = 0; this.startAttack(W, my); } } // v1.4: a tap during the finisher restarts the combo instead of being dropped
    }
  }
  attackRect(d, up = !!(this.atk && this.atk.up)) { if (up && !d.both) { const L = d.w * 0.9, Wd = d.h + 10; return { x: this.cx - Wd / 2, y: this.y + 10 - L, w: Wd, h: L }; } const w = d.w, h = d.h; const x = d.both ? this.cx - w / 2 : this.face > 0 ? this.cx - 4 : this.cx + 4 - w; return { x, y: this.cy - h / 2 + (d.oy || 0), w, h }; }
  startAttack(W, my, kind = 'combo', step = 0) {
    const wpn = WEAPONS[this.weapon]; if (Math.abs(input.mx) > 0.2) this.face = sign(input.mx); else this.autoFace(W);
    const up = my < -0.5 && this.weapon !== 'bow' && kind !== 'heavy';
    if (kind === 'combo' && !this.onGround && (this.hook.s === 'none' || this.hook.s === 'swing')) {
      if (my > 0.5 && this.weapon !== 'bow') { this.atk = { kind: 'plunge', phase: 'wind', t: 0, def: { dmg: 16, kb: 200, hs: 0.06, shake: 0.2, breaks: this.weapon === 'hammer' }, hit: new Set() }; this.vy = -120; sfx('swing'); W.emit('attack'); return; }
      this.atk = { kind: 'air', step: 0, phase: 'wind', t: 0, wind: wpn.air.wind * 0.75, def: wpn.air, hit: new Set(), up }; this.stats.attacks++; W.emit('attack'); return;
    }
    if (kind === 'combo' && step === 0 && this.comboT > 0 && this.comboIdx < wpn.combo.length) step = this.comboIdx;
    const def = kind === 'heavy' ? wpn.heavy : wpn.combo[step];
    this.atk = { kind, step, phase: 'wind', t: 0, wind: kind === 'heavy' ? def.wind : def.wind * 0.75, def, hit: new Set(), up: up && !def.proj }; this.stats.attacks++; // v1.4: snappier startup
    this.sx = 1.12; this.sy = 0.9; W.emit('attack');
  }
  canCancel() { const a = this.atk; return !a || a.kind === 'air' || a.phase === 'rec' || (a.phase === 'active' && a.kind === 'combo' && a.t >= 0.034); } // v1.4 cancel window: after the first 2 active frames
  autoFace(W) { // no stick: turn toward a close enemy behind if none is in front
    let ahead = false, back = null; for (const e of W.enemies) { if (e.dead || e.type === 'dummy') continue; const dx = e.cx - this.cx; if (Math.abs(dx) > 70 || Math.abs(e.cy - this.cy) > 50) continue; if (sign(dx) === this.face) ahead = true; else back = e; }
    if (!ahead && back) this.face = -this.face;
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
    if (this.hp <= 0 && W.tryRevive && W.tryRevive(this)) return 'hit';
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
    const pose = G.hero ? this.heroPose(W) : null;
    if (h.s !== 'none' && h.hx !== undefined) {
      let hx0 = X + f * 7, hy0 = this.y + 16; if (pose && pose.hand) [hx0, hy0] = pose.hand;
      this.drawVine(g, hx0, hy0, h, t);
      g.fillStyle = '#d9a35a'; g.beginPath(); g.arc(h.hx, h.hy, 4, 0, 7); g.fill(); g.strokeStyle = PAL.ink; g.lineWidth = 1.5; g.stroke();
    }
    if (pose) this.drawFrames(g, W, pose);
    else {
    // scarf
    const rig = has('head'); if (rig) { g.save(); g.translate(X, Y); g.scale(W.heroK || HERO_K, W.heroK || HERO_K); g.translate(-X, -Y); } g.lineCap = 'round'; g.lineJoin = 'round'; g.beginPath(); g.moveTo(this.scarf[0].x, this.scarf[0].y); for (const p of this.scarf) g.lineTo(p.x, p.y);
    if (rig) { g.strokeStyle = PAL.ink; g.lineWidth = 5; g.stroke(); g.strokeStyle = '#d8622a'; g.lineWidth = 3.2; g.stroke(); g.strokeStyle = '#ffb36a'; g.lineWidth = 1; g.stroke(); }
    else { g.strokeStyle = PAL.scarf; g.lineWidth = 4.5; g.stroke(); g.strokeStyle = '#ffc77a'; g.lineWidth = 1.5; g.stroke(); }
    if (rig) g.restore();
    if (has('head')) this.drawRig(g, W);
    else {
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
    }
    }
    const atk = this.atk;
    // charge glow + parry shield
    if (this.chargeT > 0.2) drawGlow(g, X + f * 10, this.cy - 4, 14 + (this.charged ? 10 + Math.sin(t * 30) * 3 : this.chargeT * 12), WEAPONS[this.weapon].color, this.charged ? 0.9 : 0.5);
    if (this.parryT > 0 || this.parryLock > 0.1) { g.strokeStyle = '#bfefff'; g.lineWidth = 3; g.globalAlpha = this.parryT > 0 ? 0.95 : 0.4; g.beginPath(); g.arc(X, this.cy, 24, f > 0 ? -1.2 : Math.PI - 1.2 + 0.0, f > 0 ? 1.2 : Math.PI + 1.2); g.stroke(); drawGlow(g, X + f * 18, this.cy, 22, '#9fe8ff', 0.5); g.globalAlpha = 1; }
    if (this.flash > 0) { drawGlow(g, X, this.cy, 30, '#ff7090', this.flash * 2); }
    // attack smear
    if (atk && atk.phase === 'active' && atk.def && !atk.def.proj && atk.kind !== 'plunge') { if (atk.up) { g.save(); g.translate(this.cx, this.cy); g.rotate(-this.face * Math.PI / 2); g.translate(-this.cx, -this.cy); } this.drawSmear(g, atk); if (atk.up) g.restore(); }
    if (atk && atk.kind === 'plunge' && atk.phase === 'active') { g.fillStyle = 'rgba(255,255,255,0.5)'; g.beginPath(); g.moveTo(this.x - 4, this.y); g.lineTo(this.x + this.w + 4, this.y); g.lineTo(X, this.y + this.h + 16); g.fill(); }
  }

  // ---- v1.3 painted frame-by-frame hero ----
  heroPose(W) {
    const t = this.t, h = this.hook, atk = this.atk, wpn = this.weapon, air = !this.onGround;
    const run = this.onGround && Math.abs(this.vx) > 20, dash = this.dashT > 0;
    const wall = air && this.wallDir && this.vy > 0 && Math.sign(input.mx) === this.wallDir;
    let n = 'idle0', wa = null, rot = 0, face = this.face, shake = 0;
    const sweep = (a0, a1) => { const d = atk.def || {}; const k = atk.phase === 'wind' ? 0 : atk.phase === 'active' ? Math.min(1, atk.t / Math.max(0.01, d.active || 0.1)) : 1; const e = 1 - (1 - k) * (1 - k); return a0 + (a1 - a0) * e; };
    if (this.dead) n = this.deadT < 0.28 ? 'hurt' : 'dead';
    else if (this.hurtT > 0) n = 'hurt';
    else if (h.s === 'swing') { n = 'swing'; rot = Math.atan2(h.hx - this.cx, -(h.hy - this.cy)) * 0.85; }
    else if (h.s !== 'none') n = 'throw';
    else if (atk) {
      const st = atk.step || 0, ph = atk.phase;
      if (atk.kind === 'plunge') { n = 'slam'; wa = 1.45; }
      else if (wpn === 'bow') { n = 'thrust'; wa = -0.08; }
      else if (atk.kind === 'air') { n = ph === 'wind' ? 'apex' : 'airatk'; wa = ph === 'wind' ? -2.0 : sweep(-1.6, 0.9); if (n === 'apex') wa = null; }
      else if (atk.kind === 'heavy' || (wpn === 'hammer' && st % 2 === 0)) { n = ph === 'wind' ? 'hwind' : 'slam'; wa = ph === 'wind' ? -1.9 : sweep(-1.4, 1.25); }
      else if (wpn === 'hammer' || st % 3 === 1) { n = ph === 'wind' ? 'slash1' : 'slash2'; wa = ph === 'wind' ? 0.9 : sweep(1.0, -1.45); }
      else if (st % 3 === 2) { n = ph === 'wind' ? 'land' : 'thrust'; wa = ph === 'wind' ? null : -0.06; }
      else { n = ph === 'wind' ? 'hwind' : 'slash1'; wa = ph === 'wind' ? -2.1 : sweep(-1.6, 0.85); }
    }
    else if (this.chargeT > 0.2) { if (wpn === 'bow') { n = 'thrust'; wa = -0.08; } else { n = 'hwind'; wa = -2.0; shake = this.charged ? 1.2 : 0.5; } }
    else if (this.parryLock > 0) { n = 'parry'; wa = -1.5; }
    else if (dash) n = 'dash';
    else if (wall) { n = 'wall'; face = this.wallDir; }
    else if (air) n = this.vy < -160 ? 'jump' : this.vy < 160 ? 'apex' : 'fall';
    else if ((this.sy < 0.86 && this.sx > 1.1) || this.mantleT > 0) n = 'land';
    else if (run) n = 'run' + (((Math.floor(this.runPh / (Math.PI * 2) * 8) % 8) + 8) % 8);
    else n = (t % 2.6) > 1.9 ? 'idle1' : 'idle0';
    if (this.dead) rot = 0;
    const F = G.hero.f[n] || G.hero.f.idle0, K = HERO_PX * (W.heroK || HERO_K), pvx = F[4] - 22, pvy = F[5] + 0, X = this.cx, Y = this.y + this.h;
    const sx = (1 + (this.sx - 1) * 0.45) * face, sy = 1 + (this.sy - 1) * 0.45 + (n.startsWith('idle') ? Math.sin(t * 2.4) * 0.012 : 0);
    const pose = { n, F, K, pvx, pvy: F[3] + (RUN_BOB[n] || 0), X, Y, sx, sy, rot, face, wa, shake: shake ? Math.sin(t * 50) * shake : 0, hand: null };
    const fi = FIST[n]; if (fi) pose.hand = this.framePt(pose, fi[0], fi[1]);
    void pvy; return pose;
  }
  framePt(p, fx, fy) { // frame pixel -> world point
    const lx = (fx - p.pvx) * p.K * p.sx, ly = (fy - p.pvy) * p.K * p.sy, c = Math.cos(p.rot), s = Math.sin(p.rot);
    return [p.X + p.shake + lx * c - ly * s, p.Y + lx * s + ly * c];
  }
  drawFrames(g, W, p) {
    const H = G.hero, F = p.F, lo = (W.game && W.game.lowPerf) || save.settings.quality === 'low';
    if (!lo) drawGlow(g, p.X, this.cy - 8, 36, '#0a0814', 0.4);
    const blink = this.iframes > 0 && !this.dead && this.flash <= 0 && Math.sin(this.t * 38) > 0;
    g.save(); g.translate(p.X + p.shake, p.Y); g.rotate(p.rot); g.scale(p.sx * p.K, p.sy * p.K); g.translate(-p.pvx, -p.pvy);
    if (blink) g.globalAlpha = 0.5;
    const fi = FIST[p.n];
    if (p.wa === null || !fi) this.frameWeapon(g, p, F[4] - 30, F[5] + 6, this.weapon === 'bow' ? 1.75 : 1.95, 0.95, 0.72); // sheathed across the back
    g.drawImage(H.img, F[0], F[1], F[2], F[3], 0, 0, F[2], F[3]);
    if (p.wa !== null && fi) this.frameWeapon(g, p, fi[0], fi[1], p.wa, 1);
    if (this.flash > 0) { g.globalAlpha = Math.min(0.85, this.flash * 3 + 0.2); g.drawImage(heroFlash(p.n), 0, 0); }
    g.restore(); g.globalAlpha = 1;
  }
  frameWeapon(g, p, x, y, a, k, len = 1) {
    const w = this.weapon, n = 'w_' + w; if (!has(n)) return; const u = len / HERO_PX; // world units -> frame px
    g.save(); g.translate(x, y); g.rotate(a); if (k !== 1) g.globalAlpha *= k;
    if (w === 'bow') { spr(g, n, 0, 0, 24 * u, 0.35, 0.5); if (this.chargeT > 0.2) { g.strokeStyle = '#eaffc0'; g.lineWidth = 1 * u; g.beginPath(); g.moveTo(-2 * u, -10 * u); g.lineTo(-7 * u, 0); g.lineTo(-2 * u, 10 * u); g.stroke(); } }
    else { const L = (w === 'whip' ? 20 : 27) * u; spr(g, n, 0, 0, L / sprAspect(n), w === 'whip' ? 0.05 : 0.08, 0.5); }
    g.restore();
  }
  drawVine(g, x0, y0, h, t) { // textured, twisting vine rope with leaves
    const wob = h.s === 'fly' || h.s === 'miss' ? 6 : 0, L0 = Math.hypot(h.hx - x0, h.hy - y0) || 1;
    // v1.3 tension wobble: a decaying twang across the vine right after it bites, then it pulls taut (less sag while swinging fast)
    const ht = h.t || 0, twang = !wob && ht < 0.6 ? Math.exp(-ht * 7) * Math.sin(ht * 48) * Math.min(9, L0 * 0.08) : 0, sag = wob ? Math.sin(t * 40) * wob : Math.min(10, L0 * 0.03) * (h.s === 'swing' ? Math.max(0.25, 1 - Math.hypot(this.vx, this.vy) / 420) : 1);
    const mx = (x0 + h.hx) / 2 - (h.hy - y0) / L0 * twang, my = (y0 + h.hy) / 2 + sag + (h.hx - x0) / L0 * twang;
    const pt = (k) => { const u = 1 - k; return [u * u * x0 + 2 * u * k * mx + k * k * h.hx, u * u * y0 + 2 * u * k * my + k * k * h.hy]; };
    g.lineCap = 'round'; g.strokeStyle = PAL.ink; g.lineWidth = 4.6; g.beginPath(); g.moveTo(x0, y0); g.quadraticCurveTo(mx, my, h.hx, h.hy); g.stroke();
    g.strokeStyle = '#3f7a32'; g.lineWidth = 3; g.stroke();
    const L = Math.hypot(h.hx - x0, h.hy - y0), n = Math.max(4, Math.floor(L / 7)), dx = (h.hx - x0) / (L || 1), dy = (h.hy - y0) / (L || 1);
    g.strokeStyle = '#9be070'; g.lineWidth = 1.1; g.beginPath(); // twisting highlight strand
    for (let i = 0; i <= n; i++) { const k = i / n, [px, py] = pt(k), o = Math.sin(k * L * 0.35 + t * 6) * 1.1; i ? g.lineTo(px - dy * o, py + dx * o) : g.moveTo(px - dy * o, py + dx * o); } g.stroke();
    if (has('leaf')) for (let i = 1; i < n; i += 3) { const k = i / n, [px, py] = pt(k), side = (i % 2 ? 1 : -1); g.save(); g.translate(px, py); g.rotate(Math.atan2(dy, dx) + side * 1.1 + Math.sin(t * 5 + i) * 0.2); spr(g, 'leaf', 0, 0, 6, 0.1, 0.9); g.restore(); }
  }
  drawRig(g, W) {
    const HK = W.heroK || HERO_K, rs = (W.rs || 3) * HK, U = 110, Sz = Math.ceil(U * rs); const t = this.t, f = this.face, X = this.cx, Y = this.y + this.h, h = this.hook;
    if (!this._off || this._off.width !== Sz) { const mk = () => { const c = document.createElement('canvas'); c.width = c.height = Sz; return c; }; this._off = mk(); this._tmp = mk(); }
    const off = this._off, o = off.getContext('2d'); o.setTransform(1, 0, 0, 1, 0, 0); o.clearRect(0, 0, Sz, Sz); o.globalCompositeOperation = 'source-over';
    o.setTransform(rs, 0, 0, rs, U / 2 * rs, U * 0.68 * rs);
    let lean = clamp(this.vx / 900, -0.18, 0.18); if (h.s === 'swing') lean = Math.atan2(h.hx - X, -(h.hy - this.cy)) * 0.6;
    if (this.hurtT > 0) lean = -f * 0.25;
    if (this.dead) { lean = 0; o.rotate(Math.min(1.4, this.deadT * 4) * -f); }
    o.rotate(lean); o.scale(this.sx * f, this.sy);
    const run = this.onGround && Math.abs(this.vx) > 20, ph = this.runPh, air = !this.onGround, dash = this.dashT > 0;
    const wall = air && this.wallDir && this.vy > 0 && Math.sign(input.mx) === this.wallDir;
    const bob = run ? -Math.abs(Math.sin(ph)) * 2.4 + 0.6 : air ? 0 : Math.sin(t * 2.4) * 0.6;
    // leg angles (front, back)
    let la = 0, lb = 0;
    if (run) { la = Math.sin(ph) * 0.8; lb = -la; } else if (dash) { la = 0.9; lb = -0.7; } else if (wall) { la = 0.5; lb = 0.2; } else if (air) { if (this.vy < 0) { la = 0.6; lb = -0.25; } else { la = 0.15; lb = -0.35 + Math.sin(t * 12) * 0.1; } }
    if (run) { la = Math.sin(ph) * 0.85; lb = -la; }
    // foot lift on the forward swing (reads as a knee bend), tucked legs when rising
    const liftA = run ? Math.max(0, Math.cos(ph)) * 1.8 : air && this.vy < 0 ? 1.6 : 0, liftB = run ? Math.max(0, -Math.cos(ph)) * 1.8 : air && this.vy < 0 ? 1.2 : 0;
    const leg = (n, x, a, dark, lift) => { o.save(); o.translate(x, -11 - lift); o.rotate(-a); o.scale(1, 1 - lift * 0.05); spr(o, n, 0, -1, 12, 0.5, 0, false, dark ? shaded(n, 0.7) : undefined); o.restore(); };
    // back arm (behind the body, counter-swings the front arm)
    let B = 0.35 + Math.sin(t * 2.4 + 1) * 0.05;
    if (run) B = -Math.sin(ph) * 0.65 + 0.15; else if (dash) B = 1.4; else if (wall) B = -2.2; else if (air) B = this.vy < 0 ? 2.3 : 1.5 + Math.sin(t * 10) * 0.15;
    if (this.hurtT > 0) B = 2.4; if (h.s !== 'none') B = 0.7; if (this.dead) B = 1.2;
    o.save(); o.translate(-1.5, -17 + bob); o.rotate(B); spr(o, 'arm', 0, -1.5, 11.5, 0.5, 0, false, shaded('arm', 0.6)); o.restore();
    leg('leg2', -2.5, lb, true, liftB); leg('leg', 2.5, la, false, liftA);
    o.translate(0, bob);
    // torso with cloak sway
    const sway = clamp(-this.vx / 300, -1, 1) * 0.08 + Math.sin(t * 3) * 0.02;
    o.save(); o.translate(0, -7.5); o.rotate(sway * 0.5); spr(o, 'torso', 0, 0, 13, 0.5, 1); o.restore();
    // head (with hood, sprout and scarf knot)
    o.save(); o.translate(0.5, -17.5 + (run ? Math.abs(Math.sin(ph + 0.4)) * 0.5 : 0)); o.rotate(Math.sin(t * 2.2) * 0.03 - clamp(this.vx / 2500, -0.08, 0.08) + (dash ? 0.1 : 0) + (this.hurtT > 0 ? -0.15 : 0));
    if (has('hood')) this.drawHead(o, t, f); else spr(o, 'head', 0, 0, 22, 0.5, 0.86);
    o.restore();
    // arm + weapon
    const atk = this.atk; let A = -0.75 + (run ? Math.sin(ph) * 0.5 : Math.sin(t * 2.4) * 0.05);
    if (atk) {
      const d = atk.def || {}, alt = atk.step % 2 === 1;
      if (atk.kind === 'plunge') A = 0.05;
      else if (this.weapon === 'bow') A = atk.phase === 'wind' ? -1.4 : -1.57;
      else if (d.thrust) A = atk.phase === 'wind' ? -1.2 : atk.phase === 'active' ? -1.57 : -1.35;
      else if (atk.phase === 'wind') A = alt ? -2.5 : 2.4;
      else if (atk.phase === 'active') { const k = Math.min(1, atk.t / Math.max(0.01, d.active || 0.1)); A = alt ? -2.5 + k * 1.9 : 2.0 - k * 3.7; }
      else A = alt ? -0.5 : -1.5;
    }
    if (this.chargeT > 0.2) A = (this.weapon === 'bow' ? -1.5 : 2.6) + Math.sin(t * 40) * 0.05;
    if (this.parryLock > 0) A = -2.1;
    if (dash) A = 1.1; if (wall && !atk) A = -2.7;
    if (h.s !== 'none') A = Math.atan2(-(h.hx - X) * f, h.hy - (this.y + 16));
    o.save(); o.translate(2.5, -17.5); o.rotate(A); this.drawPaintedWeapon(o); spr(o, 'arm', 0, -1.5, 12, 0.5, 0); o.restore();
    // ---- composite: rim light, hurt flash, ink outline ----
    const lo = (W.game && W.game.lowPerf) || save.settings.quality === 'low'; const tmp = this._tmp, q = tmp.getContext('2d'); const px = Math.max(1, Math.round(rs * 0.7));
    o.setTransform(1, 0, 0, 1, 0, 0);
    if (!lo) { q.globalCompositeOperation = 'source-over'; q.clearRect(0, 0, Sz, Sz); q.drawImage(off, 0, 0); q.globalCompositeOperation = 'source-in'; q.fillStyle = W.biome.key === 'boss' ? '#ffb070' : '#ffe0a0'; q.fillRect(0, 0, Sz, Sz);
      q.globalCompositeOperation = 'destination-out'; q.drawImage(off, -px * 2, px * 1.5); o.globalCompositeOperation = 'source-atop'; o.globalAlpha = 0.75; o.drawImage(tmp, 0, 0); o.globalAlpha = 1; }
    if (this.flash > 0) { o.globalCompositeOperation = 'source-atop'; o.globalAlpha = Math.min(0.85, this.flash * 3 + 0.2); o.fillStyle = '#fff'; o.fillRect(0, 0, Sz, Sz); o.globalAlpha = 1; }
    o.globalCompositeOperation = 'source-over';
    q.globalCompositeOperation = 'source-over'; q.clearRect(0, 0, Sz, Sz); q.drawImage(off, 0, 0); q.globalCompositeOperation = 'source-in'; q.fillStyle = PAL.ink; q.fillRect(0, 0, Sz, Sz); q.globalCompositeOperation = 'source-over';
    const x0 = X - U / 2, y0 = Y - U * 0.68, e = px / rs * 1.2;
    if (this.iframes > 0 && !this.dead && this.flash <= 0 && Math.sin(t * 38) > 0) g.globalAlpha = 0.5;
    if (!lo) drawGlow(g, X, this.cy - 8, 36, '#0a0814', 0.4); // dark backing halo so the hero always separates
    g.save(); g.translate(X, Y); g.scale(HK, HK); g.translate(-X, -Y);
    for (const [dx, dy] of [[-e, 0], [e, 0], [0, -e], [0, e]]) g.drawImage(tmp, x0 + dx, y0 + dy, U, U);
    g.drawImage(off, x0, y0, U, U); g.restore();
    g.globalAlpha = 1; void G;
  }
  drawHead(o, t, f) { // v1.2: hood + spring-driven leaf sprout + expressive eyes (head art is mirrored so the face looks forward)
    const dt = clamp(t - (this._lt ?? t), 0, 0.05); this._lt = t;
    const want = clamp(-this.vx / 420, -0.7, 0.7) * f + clamp(this.vy / 1400, -0.3, 0.4) * 0 + Math.sin(t * 2.6) * 0.06;
    this._spV = (this._spV || 0) + ((want - (this._spA || 0)) * 140 - (this._spV || 0) * 8) * dt; this._spA = (this._spA || 0) + this._spV * dt;
    if (this.sy < 0.8 && !this._kick) { this._spV += 6; this._kick = true; } else if (this.sy > 0.95) this._kick = false;
    o.scale(-1, 1);
    const hh = G.meta.spr.head[3], sh = G.meta.spr.sprout[3];
    o.save(); o.translate(-0.6, -14.3); o.rotate(-this._spA); spr(o, 'sprout', 0, 0, 22 * sh / hh, 0.47, 0.95); o.restore();
    spr(o, 'hood', 0, 0, 22, 0.5, 0.86);
    // eyes (sprite-space centres measured from the painted head)
    const E = [[-6.6, -5.85], [-2.6, -5.8]]; o.fillStyle = '#1a1a14';
    for (const [ex, ey] of E) { o.beginPath(); o.ellipse(ex, ey, 1.35, 1.75, 0, 0, 7); o.fill(); }
    const blink = (t % 3.3) < 0.12, mood = this.dead ? 'dead' : this.hurtT > 0 ? 'hurt' : (this.atk || this.chargeT > 0.2 || this.parryLock > 0) ? 'angry' : (this.dashT > 0 || this.hook.s === 'swing') ? 'focus' : blink ? 'blink' : 'open';
    o.fillStyle = '#f4f8e8'; o.strokeStyle = '#f4f8e8'; o.lineWidth = 0.55; o.lineCap = 'round';
    for (let i = 0; i < 2; i++) { const [ex, ey] = E[i], inner = i === 0 ? 1 : -1; // inner = towards the other eye
      if (mood === 'dead') { o.beginPath(); o.moveTo(ex - 0.8, ey - 0.8); o.lineTo(ex + 0.8, ey + 0.8); o.moveTo(ex + 0.8, ey - 0.8); o.lineTo(ex - 0.8, ey + 0.8); o.stroke(); }
      else if (mood === 'hurt') { o.beginPath(); o.moveTo(ex - 0.7 * inner, ey - 0.8); o.lineTo(ex + 0.6 * inner, ey); o.lineTo(ex - 0.7 * inner, ey + 0.8); o.stroke(); }
      else if (mood === 'blink') { o.fillRect(ex - 0.75, ey + 0.1, 1.5, 0.45); }
      else { const hgt = mood === 'focus' ? 0.75 : mood === 'angry' ? 1.05 : 1.45; o.beginPath(); o.ellipse(ex, ey + (1.45 - hgt) * 0.5, 0.62, hgt, 0, 0, 7); o.fill();
        if (mood === 'angry') { o.fillStyle = '#1a1a14'; o.beginPath(); o.moveTo(ex - 1.2, ey - 1.9 + (inner > 0 ? -0.4 : 1.0)); o.lineTo(ex + 1.2, ey - 1.9 + (inner > 0 ? 1.0 : -0.4)); o.lineTo(ex + 1.2, ey - 2.6); o.lineTo(ex - 1.2, ey - 2.6); o.fill(); o.fillStyle = '#f4f8e8'; }
        o.fillStyle = '#ffffff'; o.fillRect(ex - 0.35, ey - 0.75, 0.35, 0.35); o.fillStyle = '#f4f8e8'; }
    }
  }
  drawPaintedWeapon(o) {
    const w = this.weapon; o.save(); o.translate(0, 10.5);
    if (w === 'bow') { o.rotate(Math.PI / 2); spr(o, 'w_bow', 0, 0, 22, 0.35, 0.5); if (this.chargeT > 0.2) { o.strokeStyle = '#eaffc0'; o.lineWidth = 1; o.beginPath(); o.moveTo(-2, -9); o.lineTo(-6, 0); o.lineTo(-2, 9); o.stroke(); } }
    else { o.rotate(Math.PI / 2); const L = w === 'blade' ? 25 : w === 'hammer' ? 25 : w === 'spear' ? 36 : 18, n = 'w_' + w; spr(o, n, 0, 0, L / sprAspect(n), w === 'whip' ? 0.05 : 0.08, 0.5); }
    o.restore();
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
    const d = atk.def, r = this.attackRect(d, false), k = atk.t / d.active, col = WEAPONS[this.weapon].color;
    g.save(); g.globalAlpha = 0.85 * (1 - k * 0.7); if (G.ready) { g.globalCompositeOperation = 'lighter'; g.shadowColor = col; g.shadowBlur = 0; }
    if (d.thrust) { // spear: straight piercing streak
      const f = this.face, x0 = this.cx + f * 10, y0 = this.cy + (d.oy || 0) - 4, L = d.w * Math.min(1, 0.35 + k * 2);
      const gr = g.createLinearGradient(x0, y0, x0 + f * L, y0); gr.addColorStop(0, 'rgba(127,246,255,0)'); gr.addColorStop(1, col);
      g.fillStyle = gr; g.beginPath(); g.moveTo(x0, y0 - d.h * 0.25); g.lineTo(x0 + f * L, y0); g.lineTo(x0, y0 + d.h * 0.25); g.closePath(); g.fill();
      g.fillStyle = '#eaffff'; g.beginPath(); g.arc(x0 + f * L, y0, 3, 0, 7); g.fill();
    } else if (d.arc === 5 || (this.weapon === 'whip' && !d.both)) { // whip: long wavy lash
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
